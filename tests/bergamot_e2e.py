# SPDX-License-Identifier: MPL-2.0
"""Packaged EN/TR inference in ONE combined XPI, cold-started offline.

No separate model download/import, native Firefox translation API or helper
process. Uses the normal popup/AI UI, actual video and a local VTT file.
"""
import json
import os
import re
from pathlib import Path
from threading import Thread
from http.server import BaseHTTPRequestHandler,ThreadingHTTPServer
from gecko_controls import disable_automatic_captions
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import Select,WebDriverWait
from selenium.webdriver.firefox.options import Options
from selenium.webdriver.firefox.service import Service

ROOT=Path(__file__).resolve().parents[1];out=ROOT/'work/bergamot-test-artifacts';out.mkdir(parents=True,exist_ok=True)
class Fixture(BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path=='/video.webm':body=(ROOT/'tests/fixtures/video.webm').read_bytes();content='video/webm'
        elif self.path=='/page':body=b'<!doctype html><meta charset="utf-8"><title>Bundled translation page</title><p id="sentence">Please close the door.</p><div role="dialog"><p id="dialog">The cat is sleeping.</p></div>';content='text/html'
        else:
            body=b'''<!doctype html><meta charset="utf-8"><title>Bundled translation video</title><video controls muted loop src="/video.webm" style="width:640px"></video><button id="start">Play</button><button id="fullscreen">Fullscreen</button><script>document.getElementById('fullscreen').onclick=()=>document.querySelector('video').requestFullscreen();document.getElementById('start').onclick=()=>{const v=document.querySelector('video'),t=v.addTextTrack('subtitles','English','en');t.addCue(new VTTCue(0,3600,'The cat is sleeping.'));t.mode='showing';v.play();};</script>''';content='text/html'
        self.send_response(200);self.send_header('Content-Type',content);self.send_header('Content-Length',str(len(body)));self.end_headers();self.wfile.write(body)
    def log_message(self,*_):pass
server=ThreadingHTTPServer(('127.0.0.1',0),Fixture);Thread(target=server.serve_forever,daemon=True).start()
o=Options();o.binary_location=os.environ['AION_FIREFOX_BINARY'];o.add_argument('-headless');o.accept_insecure_certs=False;o.set_preference('remote.prefs.recommended',False);o.set_preference('dom.file.createInChild',True)
d=webdriver.Firefox(options=o,service=Service(os.environ['AION_GECKODRIVER'],service_args=['--allow-system-access'],log_output=str(out/'geckodriver.log')));w=WebDriverWait(d,40);passed=[];quality=[];observations=[]
def ready():w.until(lambda _:d.find_element(By.TAG_NAME,'body').get_attribute('data-ready')=='true')
def request(message):return d.execute_async_script('const [m,done]=arguments;browser.runtime.sendMessage(m).then(done,e=>done({error:e.message}));',message)
def setting(name,value):Select(d.find_element(By.ID,name)).select_by_value(value);w.until(lambda _:d.execute_script('return UI.settings[arguments[0]];',name)==value)
def translate(text):
    d.execute_script('document.getElementById("ai-text").value=arguments[0];document.getElementById("ai-result").value="";',text)
    d.find_element(By.ID,'ai-translate').click();w.until(lambda _:bool(d.find_element(By.ID,'ai-result').get_attribute('value')))
    return d.find_element(By.ID,'ai-result').get_attribute('value')
try:
    d.set_window_size(1280,1000)
    version=json.loads((ROOT/'browser/extension/manifest.json').read_text())['version'];addon=d.install_addon(str(ROOT/f'dist/fire-axolotl-extension-{version}-unsigned.xpi'),temporary=True)
    assert addon=='fire-axolotl-extension@kaansavukduran.github.io'
    d.set_context('chrome');uuid=d.execute_script("return JSON.parse(Services.prefs.getStringPref('extensions.webextensions.uuids'))[arguments[0]]",addon);d.set_context('content');base=f'moz-extension://{uuid}/aion/'
    disable_automatic_captions(d,base)
    url=f'http://127.0.0.1:{server.server_port}/';d.get(url);video_handle=d.current_window_handle;d.find_element(By.ID,'start').click();w.until(lambda _:d.execute_script('return document.querySelector("video").videoWidth')==320)
    d.switch_to.new_window('tab');page_handle=d.current_window_handle;d.get(url+'page')
    d.switch_to.new_window('tab');controller=d.current_window_handle
    # Offline BEFORE the first AI page/worker is opened. Only packaged assets
    # can supply model data; the fixtures have already been loaded.
    d.set_context('chrome');d.execute_script('Services.io.offline=true');d.set_context('content')
    d.get(base+'ai.html');ready();assert d.find_element(By.ID,'aiModel').get_attribute('value')=='bergamot'
    assert request({'type':'localAI','action':'status'})['phase']=='unloaded'
    assert not d.find_element(By.ID,'model-download').is_displayed() and not d.find_element(By.ID,'model-files-details').is_displayed()
    setting('aiSource','en');setting('aiTarget','tr')
    d.get(base+'popup.html');ready();d.find_element(By.ID,'source-text').send_keys('The cat is sleeping.');d.find_element(By.ID,'translate-local').click()
    w.until(lambda _:bool(d.find_element(By.ID,'translation-result').get_attribute('value')))
    answer=d.find_element(By.ID,'translation-result').get_attribute('value');quality.append({'input':'The cat is sleeping. (cold popup)','output':answer,'passed':'kedi' in answer.lower() and 'uyu' in answer.lower()})
    state=request({'type':'localAI','action':'status'});assert state['modelKind']=='bergamot' and state['phase']=='ready' and state['model']['embedded']
    assert d.execute_async_script('caches.keys().then(x=>arguments[0](x.filter(n=>n.startsWith("fire-axolotl-"))));')==[]
    passed.append('One combined XPI cold-loads its bundled EN/TR model through the normal local-translate popup while Firefox networking is already offline; no model cache/import/download is used')
    d.get(base+'ai.html');ready();assert d.find_element(By.ID,'aiModel').get_attribute('value')=='bergamot';assert not d.find_element(By.ID,'ai-generate').is_enabled()
    d.save_screenshot(str(out/'bergamot-offline-model.png'))
    for text,words in [('Please close the door.',['kapı','kapat']),('We visited the museum yesterday.',['dün','müze'])]:
        answer=translate(text);quality.append({'input':text,'output':answer,'passed':all(word in answer.lower() for word in words)})
    setting('aiSource','tr');setting('aiTarget','en');answer=translate('Merhaba, nasılsın?');quality.append({'input':'Merhaba, nasılsın?','output':answer,'passed':bool(re.search(r'\b(?:hello|hi)\b',answer.lower())) and 'you' in answer.lower()})
    setting('aiSource','auto');setting('aiTarget','tr');answer=translate('The cat is sleeping.');quality.append({'input':'The cat is sleeping. (auto)','output':answer,'passed':'kedi' in answer.lower() and 'uyu' in answer.lower()})
    setting('aiSource','en');observations.append({'input':'I was about to give up.','output':translate('I was about to give up.'),'note':'Known idiom-quality failure is recorded, not counted as a quality pass.'})
    setting('aiSource','fr');d.execute_script('document.getElementById("status").textContent="";');d.find_element(By.ID,'ai-translate').click();w.until(lambda _:d.find_element(By.ID,'status').get_attribute('data-error')=='true');assert d.execute_script('return document.getElementById("status").textContent===UI.t("aiBergamotPairUnsupported");')
    setting('aiSource','en')
    passed.append('Packaged model works in both directions and with local automatic detection; unsupported language pairs fail explicitly; idiom quality is recorded separately')
    d.find_element(By.ID,'page-refresh').click();target=d.execute_async_script('const [url,done]=arguments;browser.tabs.query({}).then(t=>done(t.find(x=>x.url===url).id));',url+'page');Select(d.find_element(By.ID,'page-tab')).select_by_value(str(target));d.find_element(By.ID,'page-scan').click();w.until(lambda _:'Please close the door.' in d.find_element(By.ID,'page-preview').get_attribute('value'));d.find_element(By.ID,'page-translate').click();w.until(lambda _:d.find_element(By.ID,'page-progress').get_attribute('value')=='2')
    d.switch_to.window(page_handle);assert 'kapı' in d.find_element(By.ID,'sentence').text.lower() and 'kedi' in d.find_element(By.ID,'dialog').text.lower();d.save_screenshot(str(out/'bergamot-offline-page.png'))
    d.switch_to.window(controller);d.find_element(By.ID,'page-restore').click();w.until(lambda _:'2' in d.find_element(By.ID,'page-result').text)
    passed.append('Reviewed page and website-dialog text translate with the actual bundled engine offline and can be restored')
    target=d.execute_async_script('const [url,done]=arguments;browser.tabs.query({}).then(t=>done(t.find(x=>x.url===url).id));',url);Select(d.find_element(By.ID,'video-tab')).select_by_value(str(target));d.find_element(By.ID,'live-mode').click();w.until(lambda _:'kedi' in d.find_element(By.ID,'live-translation').text.lower())
    d.switch_to.window(video_handle);w.until(lambda _:bool(d.find_elements(By.CSS_SELECTOR,'[data-aion-captions]')));d.save_screenshot(str(out/'bergamot-live-dual-captions.png'));d.find_element(By.ID,'fullscreen').click();w.until(lambda _:d.execute_script('return document.fullscreenElement===document.querySelector("video");'))
    assert d.execute_script('const c=[...document.querySelector("video").textTracks].find(t=>t.label==="Aion").cues;return c.length===2&&c[0].startTime===c[1].startTime&&c[0].endTime===c[1].endTime;')
    d.execute_async_script('document.exitFullscreen().then(()=>arguments[0](true));');d.switch_to.window(controller);d.find_element(By.ID,'stop-video').click();d.switch_to.window(video_handle);w.until(lambda _:not d.find_elements(By.CSS_SELECTOR,'[data-aion-captions]'));assert d.execute_script('return [...document.querySelector("video").textTracks].find(t=>t.label==="English").mode;')=='showing';d.switch_to.window(controller)
    passed.append('Bundled local translation reaches live dual captions and native video fullscreen at paired timestamps; stopping restores the player track')
    file=out/'input.vtt';file.write_text('WEBVTT\n\n00:00:01.000 --> 00:00:03.000\nThe cat is sleeping.\n',encoding='utf-8');d.find_element(By.ID,'subtitle-file').send_keys(str(file.resolve()));d.find_element(By.ID,'translate-file').click();w.until(lambda _:d.find_element(By.ID,'subtitle-download').is_displayed());vtt=d.execute_async_script('fetch(document.getElementById("subtitle-download").href).then(r=>r.text()).then(arguments[0]);');assert '00:00:01.000 --> 00:00:03.000' in vtt and 'kedi' in vtt.lower()
    passed.append('A real local VTT file translates offline with the bundled model and exports its unchanged timestamps')
    d.find_element(By.ID,'model-unload').click();w.until(lambda _:request({'type':'localAI','action':'status'})['phase']=='unloaded');Select(d.find_element(By.ID,'aiModel')).select_by_value('qwen');w.until(lambda _:d.find_element(By.ID,'model-files-details').is_displayed());assert d.find_element(By.CSS_SELECTOR,'#aiBackend option[value=webgpu]').is_enabled()
    passed.append('Unloading releases the worker; Qwen remains separately selectable with its import and backend controls')
    assert all(item['passed'] for item in quality),quality
    print('PASS',json.dumps(passed),flush=True)
except Exception:
    state=request({'type':'localAI','action':'status'});print(json.dumps({k:state.get(k) for k in ['phase','error','detail','modelKind']},ensure_ascii=False),flush=True)
    d.save_screenshot(str(out/'failure.png'));raise
finally:
    (out/'results.json').write_text(json.dumps({'passed':passed,'quality_checks':quality,'observations':observations},ensure_ascii=False,indent=2)+'\n');d.quit();server.shutdown()
