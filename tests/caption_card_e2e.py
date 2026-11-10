# SPDX-License-Identifier: MPL-2.0
"""Trusted on-video study controls, cold offline inference and frame isolation."""
import json
import os
from pathlib import Path
from threading import Thread
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.common.keys import Keys
from selenium.webdriver.support.ui import Select, WebDriverWait
from selenium.webdriver.firefox.options import Options
from selenium.webdriver.firefox.service import Service

ROOT=Path(__file__).resolve().parents[1]
out=ROOT/'work/caption-card-test-artifacts';out.mkdir(parents=True,exist_ok=True)
class Fixture(BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path=='/video.webm':body=(ROOT/'tests/fixtures/video.webm').read_bytes();content='video/webm'
        elif self.path=='/iframe':body=b'<!doctype html><title>Nested video</title><iframe src="/" style="width:800px;height:700px"></iframe>';content='text/html'
        else:
            body=b'''<!doctype html><meta charset="utf-8"><title>On-video word study</title>
            <div id="player"><video controls muted loop src="/video.webm" style="width:640px"></video></div>
            <button id="play">Play</button><button id="fullscreen">Player fullscreen</button>
            <script>document.getElementById('play').onclick=()=>document.querySelector('video').play();
            document.getElementById('fullscreen').onclick=()=>document.getElementById('player').requestFullscreen();</script>''';content='text/html'
        self.send_response(200);self.send_header('Content-Type',content);self.send_header('Content-Length',str(len(body)));self.end_headers();self.wfile.write(body)
    def log_message(self,*_):pass
server=ThreadingHTTPServer(('127.0.0.1',0),Fixture);Thread(target=server.serve_forever,daemon=True).start()
o=Options();o.binary_location=os.environ['AION_FIREFOX_BINARY'];o.add_argument('-headless');o.accept_insecure_certs=False;o.set_preference('remote.prefs.recommended',False)
d=webdriver.Firefox(options=o,service=Service(os.environ['AION_GECKODRIVER'],service_args=['--allow-system-access'],log_output=str(out/'geckodriver.log')));w=WebDriverWait(d,40);passed=[]
def ready():w.until(lambda _:d.find_element(By.TAG_NAME,'body').get_attribute('data-ready')=='true')
def request(message):return d.execute_async_script('const [m,done]=arguments;browser.runtime.sendMessage(m).then(done,e=>done({error:e.message}));',message)
def root():return d.find_element(By.CSS_SELECTOR,'[data-aion-captions]').shadow_root
def element(css):return root().find_element(By.CSS_SELECTOR,css)
def study_buttons():return element('.study').find_elements(By.CSS_SELECTOR,':scope > button')
def overlay(tab_id,text='The cat is sleeping.'):
    return request({'type':'mediaTab','tabId':tab_id,'command':{'action':'overlay','original':[{'start':0,'end':3600,'text':text}],'translated':[]}})
try:
    d.set_window_size(1200,1050)
    version=json.loads((ROOT/'browser/extension/manifest.json').read_text())['version'];addon=d.install_addon(str(ROOT/f'dist/fire-axolotl-extension-{version}-unsigned.xpi'),temporary=True)
    d.set_context('chrome');uuid=d.execute_script("return JSON.parse(Services.prefs.getStringPref('extensions.webextensions.uuids'))[arguments[0]]",addon);d.set_context('content');base=f'moz-extension://{uuid}/aion/'
    url=f'http://127.0.0.1:{server.server_port}/';d.get(url);page=d.current_window_handle;d.find_element(By.ID,'play').click();w.until(lambda _:d.execute_script('return document.querySelector("video").videoWidth')==320)
    d.switch_to.new_window('tab');nested=d.current_window_handle;d.get(url+'iframe');d.switch_to.frame(d.find_element(By.TAG_NAME,'iframe'));d.find_element(By.ID,'play').click();w.until(lambda _:d.execute_script('return document.querySelector("video").videoWidth')==320);d.switch_to.default_content()
    d.switch_to.new_window('tab');controller=d.current_window_handle
    d.set_context('chrome');d.execute_script('Services.io.offline=true');d.set_context('content');d.get(base+'popup.html');ready()
    assert request({'type':'save','patch':{'language':'en','aiSource':'en','aiTarget':'tr'}})['aiSource']=='en'
    target=d.execute_async_script('const [url,done]=arguments;browser.tabs.query({}).then(t=>done(t.find(x=>x.url===url).id));',url)
    assert 'error' not in overlay(target)
    d.switch_to.window(page);w.until(lambda _:element('.learn').is_displayed());element('.learn').click();w.until(lambda _:element('.study').is_displayed());assert d.execute_script('return document.querySelector("video").paused')
    assert d.execute_script('return document.querySelector("[data-aion-captions]").shadowRoot') is None
    d.switch_to.window(controller);assert request({'type':'localAI','action':'status'})['phase']=='unloaded'
    d.switch_to.window(page)
    # Browser-generated events are required: a page/script's click cannot load AI.
    d.execute_script('arguments[0].click();',study_buttons()[1]);d.switch_to.window(controller);assert request({'type':'localAI','action':'status'})['phase']=='unloaded';d.switch_to.window(page)
    passed.append('An explicit on-video learning button pauses playback without loading AI; the closed shadow and untrusted-click guard prevent automatic page-triggered inference')
    study_buttons()[1].click();w.until(lambda _:'kedi' in element('.study output').text.lower())
    assert 'uyu' in element('.study output').text.lower()
    words=element('.words').find_elements(By.TAG_NAME,'button');next(button for button in words if button.text=='cat').send_keys(Keys.ENTER);assert element('.study output').text==''
    study_buttons()[1].click();w.until(lambda _:bool(element('.study output').text));assert 'kedi' in element('.study output').text.lower()
    study_buttons()[2].click();w.until(lambda _:'Saved' in element('[role=status]').text);study_buttons()[2].click();w.until(lambda _:'Saved' in element('[role=status]').text)
    d.save_screenshot(str(out/'on-video-word-card.png'))
    d.set_window_size(480,1000);w.until(lambda _:element('.study').rect['x']+element('.study').rect['width']<=d.execute_script('return innerWidth'))
    d.save_screenshot(str(out/'on-video-word-card-narrow.png'));d.set_window_size(1200,1050)
    d.switch_to.window(controller);assert request({'type':'settings'})['vocabulary'].count('cat')==1;assert request({'type':'localAI','action':'status'})['modelKind']=='bergamot'
    passed.append('Trusted sentence and individual-word translations cold-load the actual bundled engine while offline; saving a word twice writes one local vocabulary entry')
    assert 'error' not in overlay(target)
    d.switch_to.window(page);assert element('.study').is_displayed() and 'kedi' in element('.study output').text.lower()
    element('.study select').send_keys(Keys.ESCAPE);w.until(lambda _:not element('.study').is_displayed());assert d.execute_script('return document.querySelector("video").paused')
    element('.learn').click();assert element('.study').is_displayed();d.find_element(By.ID,'fullscreen').click();w.until(lambda _:d.execute_script('return document.fullscreenElement?.id')=='player');assert element('.study').is_displayed()
    d.execute_async_script('document.exitFullscreen().then(()=>arguments[0](true));');study_buttons()[3].click();w.until(lambda _:not d.execute_script('return document.querySelector("video").paused'))
    passed.append('Live overlay refresh retains the current card and answer; Escape keeps playback paused, player fullscreen retains controls, and explicit continue resumes playback')
    d.switch_to.window(controller);overlay(target,"Don't <img src=x onerror=alert(1)> stop. İyi günler!")
    d.switch_to.window(page);element('.learn').click();assert not root().find_elements(By.CSS_SELECTOR,'img');assert "Don't" in [button.text for button in element('.words').find_elements(By.TAG_NAME,'button')];assert 'İyi' in [button.text for button in element('.words').find_elements(By.TAG_NAME,'button')]
    element('.words button').click();study_buttons()[2].click();w.until(lambda _:'Saved' in element('[role=status]').text)
    d.switch_to.window(controller);assert "Don't" in request({'type':'settings'})['vocabulary'];request({'type':'save','patch':{'disabledModules':['translation']}})
    d.switch_to.window(page);study_buttons()[1].click();w.until(lambda _:'disabled' in element('[role=status]').text.lower())
    passed.append('Apostrophes and Turkish words remain selectable; subtitle markup is literal text, and disabling translation blocks an already open card')
    d.switch_to.window(controller);request({'type':'save','patch':{'disabledModules':[],'language':'tr'}});nested_target=d.execute_async_script('const [url,done]=arguments;browser.tabs.query({}).then(t=>done(t.find(x=>x.url===url).id));',url+'iframe');overlay(nested_target)
    d.switch_to.window(nested);d.switch_to.frame(d.find_element(By.TAG_NAME,'iframe'));element('.learn').click();assert 'Kaynak' in element('.study').text
    study_buttons()[0].click();study_buttons()[1].click();w.until(lambda _:'kedi' in element('.study output').text.lower())
    d.switch_to.default_content();d.switch_to.window(controller);request({'type':'mediaTab','tabId':nested_target,'command':{'action':'closeOverlay'}})
    d.switch_to.window(nested);d.switch_to.frame(d.find_element(By.TAG_NAME,'iframe'));w.until(lambda _:not d.find_elements(By.CSS_SELECTOR,'[data-aion-captions]'));d.switch_to.default_content()
    d.switch_to.window(controller);request({'type':'mediaTab','tabId':target,'command':{'action':'closeOverlay'}});d.switch_to.window(page);w.until(lambda _:not d.find_elements(By.CSS_SELECTOR,'[data-aion-captions]'))
    passed.append('Turkish controls translate from an accessible iframe using its own frame capability; explicit stop removes both main-frame and iframe cards')
    print('PASS',json.dumps(passed),flush=True)
except Exception:
    d.save_screenshot(str(out/'failure.png'));raise
finally:
    (out/'results.json').write_text(json.dumps({'passed':passed},ensure_ascii=False,indent=2)+'\n');d.quit();server.shutdown()
