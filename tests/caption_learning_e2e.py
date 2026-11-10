# SPDX-License-Identifier: MPL-2.0
"""Real Firefox native/imported caption learning and playback-loop cleanup.

Uses actual media, a real SRT file input and normal Aion UI. No AI model is
loaded, and no website/player API is mocked.
"""
import json
import os
import time
from pathlib import Path
from threading import Thread
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import Select, WebDriverWait
from selenium.webdriver.firefox.options import Options
from selenium.webdriver.firefox.service import Service

ROOT=Path(__file__).resolve().parents[1]
out=ROOT/'work/caption-learning-test-artifacts';out.mkdir(parents=True,exist_ok=True)
class Fixture(BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path=='/video.webm':body=(ROOT/'tests/fixtures/video.webm').read_bytes();content='video/webm'
        else:
            body=b'''<!doctype html><meta charset="utf-8"><title>Caption learning fixture</title>
            <video controls muted preload="auto" src="/video.webm" style="width:640px"></video>
            <button id="start">Play</button><script>document.getElementById('start').onclick=()=>{
            const v=document.querySelector('video'),t=v.addTextTrack('subtitles','English','en');
            [[.2,.65,'First native line'],[.9,1.3,'Second native line'],[1.6,10,'Last native line']].forEach(c=>t.addCue(new VTTCue(...c)));t.mode='showing';
            window.wraps=0;v.addEventListener('seeking',()=>{if(v.currentTime<.25)window.wraps++;});v.play();};</script>''';content='text/html'
        self.send_response(200);self.send_header('Content-Type',content);self.send_header('Content-Length',str(len(body)));self.end_headers();self.wfile.write(body)
    def log_message(self,*_):pass
server=ThreadingHTTPServer(('127.0.0.1',0),Fixture);Thread(target=server.serve_forever,daemon=True).start()
options=Options();options.binary_location=os.environ['AION_FIREFOX_BINARY'];options.add_argument('-headless');options.accept_insecure_certs=False;options.set_preference('remote.prefs.recommended',False);options.set_preference('dom.file.createInChild',True)
d=webdriver.Firefox(options=options,service=Service(os.environ['AION_GECKODRIVER'],service_args=['--allow-system-access'],log_output=str(out/'geckodriver.log')));w=WebDriverWait(d,30);passed=[]
def ready():w.until(lambda _:d.find_element(By.TAG_NAME,'body').get_attribute('data-ready')=='true')
def media(script):return d.execute_script('const v=document.querySelector("video");'+script)
def request(message):return d.execute_async_script('const [m,done]=arguments;browser.runtime.sendMessage(m).then(done,e=>done({error:e.message}));',message)
try:
    version=json.loads((ROOT/'browser/extension/manifest.json').read_text())['version'];addon=d.install_addon(str(ROOT/f'dist/fire-axolotl-extension-{version}-unsigned.xpi'),temporary=True)
    d.set_context('chrome');uuid=d.execute_script("return JSON.parse(Services.prefs.getStringPref('extensions.webextensions.uuids'))[arguments[0]]",addon);d.set_context('content');base=f'moz-extension://{uuid}/aion/'
    url=f'http://127.0.0.1:{server.server_port}/';d.get(url);page=d.current_window_handle;d.find_element(By.ID,'start').click();w.until(lambda _:media('return v.readyState>=2 && Number.isFinite(v.duration);'));media('v.pause();v.currentTime=.3;')
    d.switch_to.new_window('tab');controller=d.current_window_handle;d.get(base+'ai.html');ready()
    target=d.execute_async_script('const [url,done]=arguments;browser.tabs.query({}).then(t=>done(t.find(x=>x.url===url).id));',url)
    Select(d.find_element(By.ID,'video-tab')).select_by_value(str(target));d.find_element(By.ID,'caption-refresh').click();w.until(lambda _:len(d.find_elements(By.CSS_SELECTOR,'#caption-track option'))==2)
    assert request({'type':'localAI','action':'status'})['phase']=='unloaded'
    Select(d.find_element(By.ID,'caption-track')).select_by_value('0')
    d.find_element(By.ID,'caption-loop').click();w.until(lambda _:d.find_element(By.ID,'study-text').get_attribute('value')=='First native line')
    d.switch_to.window(page);w.until(lambda _:media('return window.wraps>=3;'));media('v.pause();');paused=media('return v.currentTime;');start=time.monotonic()
    w.until(lambda _:time.monotonic()-start>=.8)
    assert abs(media('return v.currentTime;')-paused)<.02
    media('v.play();');wraps=media('return window.wraps;');w.until(lambda _:media('return window.wraps;')>wraps)
    d.switch_to.window(controller);d.find_element(By.ID,'caption-loop-stop').click();d.switch_to.window(page);w.until(lambda _:media('return v.currentTime>.85;'));media('v.pause();v.currentTime=.3;')
    passed.append('Native caption sources are selectable without AI; a real line loops repeatedly, pauses normally, resumes and stops explicitly')
    d.switch_to.window(controller);d.find_element(By.ID,'caption-loop').click();d.switch_to.window(page);media('v.currentTime=1.1;');w.until(lambda _:media('return v.currentTime>1.45;'));media('v.pause();')
    passed.append('Seeking outside the loop lets playback continue and never forces the user back into the old line')
    media('v.currentTime=.3;');d.switch_to.window(controller)
    d.execute_script('document.getElementById("caption-loop").click();document.getElementById("caption-loop-stop").click();')
    w.until(lambda _:not d.find_element(By.ID,'caption-loop').get_attribute('disabled') and d.execute_script('return document.getElementById("status").textContent===UI.t("captionLoopStopped");'))
    d.switch_to.window(page);w.until(lambda _:media('return v.currentTime>.85;'));media('v.pause();')
    passed.append('Stopping immediately after starting cannot leave a late asynchronous loop running')
    media('v.loop=true;v.currentTime=1.7;window.endWraps=0;v.addEventListener("seeking",()=>{if(v.currentTime>=1.6&&v.currentTime<1.65)window.endWraps++;});')
    d.switch_to.window(controller);d.find_element(By.ID,'caption-loop').click();w.until(lambda _:d.find_element(By.ID,'study-text').get_attribute('value')=='Last native line')
    d.switch_to.window(page);w.until(lambda _:media('return window.endWraps>=3;'));assert media('return v.loop;') is False
    d.switch_to.window(controller);d.find_element(By.ID,'caption-loop-stop').click();d.switch_to.window(page);w.until(lambda _:media('return v.loop;') is True);media('v.pause();v.loop=false;')
    passed.append('A final cue extending past media duration loops across actual playback end and restores the original whole-video loop preference')
    # Use the real popup's file-input and button path; activeTab stays the web page.
    d.switch_to.window(controller);d.get(base+'popup.html');ready()
    d.find_element(By.ID,'original-file').find_element(By.XPATH,'ancestor::details').find_element(By.TAG_NAME,'summary').click()
    srt=out/'learning.srt';srt.write_text('1\n00:00:00,200 --> 00:00:00,650\nFirst imported line\n\n2\n00:00:00,900 --> 00:00:01,300\nSecond imported line\n',encoding='utf-8')
    d.find_element(By.ID,'original-file').send_keys(str(srt.resolve()))
    d.execute_async_script('browser.tabs.update(arguments[0],{active:true}).then(arguments[1]);',target)
    d.execute_script('document.getElementById("show-subtitles").click();')
    w.until(lambda _:request({'type':'mediaTab','tabId':target,'command':{'action':'captionSources'}}).get('local') is True)
    d.get(base+'ai.html');ready();Select(d.find_element(By.ID,'video-tab')).select_by_value(str(target));d.find_element(By.ID,'caption-refresh').click()
    w.until(lambda _:len(d.find_elements(By.CSS_SELECTOR,'#caption-track option[value=local]'))==1);Select(d.find_element(By.ID,'caption-track')).select_by_value('local')
    d.switch_to.window(page);media('v.pause();v.currentTime=1.05;');d.switch_to.window(controller);d.find_element(By.ID,'caption-read').click();w.until(lambda _:d.find_element(By.ID,'study-text').get_attribute('value')=='Second imported line')
    d.find_element(By.ID,'caption-previous').click();w.until(lambda _:d.find_element(By.ID,'study-text').get_attribute('value')=='First imported line')
    d.switch_to.window(page);media('v.pause();v.currentTime=.3;');d.switch_to.window(controller);d.find_element(By.ID,'caption-next').click();w.until(lambda _:d.find_element(By.ID,'study-text').get_attribute('value')=='Second imported line')
    d.find_element(By.ID,'caption-save').click();w.until(lambda _:'Second imported line' in request({'type':'settings'})['vocabulary'])
    d.execute_script('const e=document.getElementById("captionOffset");e.value="0.2";e.dispatchEvent(new Event("input",{bubbles:true}));');w.until(lambda _:request({'type':'settings'})['captionOffset']==.2)
    d.switch_to.window(page);media('v.pause();v.currentTime=1.25;');d.switch_to.window(controller)
    d.execute_script('document.getElementById("status").textContent="";');d.find_element(By.ID,'caption-repeat').click();w.until(lambda _:d.execute_script('return [UI.t("captionReplaying"),UI.t("captionPositioned")].includes(document.getElementById("status").textContent);'))
    d.switch_to.window(page);media('v.pause();');position=media('return v.currentTime;');assert 1.1<=position<1.6,position
    d.switch_to.window(controller);d.find_element(By.ID,'reset-caption-offset').click();w.until(lambda _:request({'type':'settings'})['captionOffset']==0)
    passed.append('A real SRT loaded through the popup supports local-source read, previous/next, vocabulary and timing offset without a model')
    d.switch_to.window(page);media('v.pause();v.currentTime=.3;window.wraps=0;');d.switch_to.window(controller);d.find_element(By.ID,'caption-loop').click();w.until(lambda _:d.find_element(By.ID,'study-text').get_attribute('value')=='First imported line')
    d.switch_to.window(page);w.until(lambda _:media('return window.wraps>=3;'))
    d.switch_to.window(controller);d.set_window_size(720,1000);d.execute_script('document.getElementById("caption-loop").scrollIntoView({block:"center"});');d.save_screenshot(str(out/'caption-learning.png'))
    d.close();d.switch_to.window(page)
    w.until(lambda _:not d.find_elements(By.CSS_SELECTOR,'[data-aion-captions]'));w.until(lambda _:media('return v.currentTime>.85;'))
    assert media('return [...v.textTracks].find(t=>t.label==="English").mode;')=='showing'
    passed.append('Loaded caption lines loop too; closing the AI controller stops the loop and removes its overlay while restoring the player track')
    print('PASS',json.dumps(passed),flush=True)
except Exception:
    d.save_screenshot(str(out/'failure.png'));raise
finally:
    (out/'results.json').write_text(json.dumps({'passed':passed},indent=2)+'\n');d.quit();server.shutdown()
