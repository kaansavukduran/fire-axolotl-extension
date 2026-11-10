# SPDX-License-Identifier: MPL-2.0
"""Real 1.5B inference in stock Firefox, with hash-pinned local model files.

Needs AION_MODEL_DIR, AION_FIREFOX_BINARY and AION_GECKODRIVER. No mock,
remote inference service, native messaging host or browser security overrides.
"""
import json
import os
import time
from pathlib import Path
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from threading import Thread
from selenium.webdriver.support.ui import Select
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.firefox.options import Options
from selenium.webdriver.firefox.service import Service
from selenium.webdriver.support.ui import WebDriverWait

ROOT = Path(__file__).resolve().parents[1]
ARTIFACTS = ROOT / 'work/qwen-test-artifacts'
ARTIFACTS.mkdir(parents=True, exist_ok=True)
options = Options()
options.binary_location = os.environ['AION_FIREFOX_BINARY']
options.add_argument('-headless')
options.accept_insecure_certs = False
options.set_preference('remote.prefs.recommended', False)
options.set_preference('dom.file.createInChild', True)
driver = webdriver.Firefox(options=options, service=Service(os.environ['AION_GECKODRIVER'], service_args=['--allow-system-access'], log_output=str(ARTIFACTS / 'geckodriver.log')))
wait = WebDriverWait(driver, 30)
results = []
quality = []
class Fixture(BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path == '/video.webm':
            body=(ROOT / 'tests/fixtures/video.webm').read_bytes(); content='video/webm'
        else:
            body=b'''<!doctype html><meta charset="utf-8"><title>Local Qwen caption fixture</title><video controls muted loop src="/video.webm" style="width:640px;max-width:100%"></video><button id="play">Play</button><button id="fullscreen">Fullscreen</button><script>document.getElementById("fullscreen").onclick=()=>document.querySelector("video").requestFullscreen();document.getElementById("play").onclick=()=>{const v=document.querySelector("video"),t=v.addTextTrack("subtitles","English","en");t.addCue(new VTTCue(0,3600,"The cat is sleeping."));t.mode="showing";v.play();};</script>''';content='text/html'
        self.send_response(200);self.send_header('Content-Type',content);self.send_header('Content-Length',str(len(body)));self.end_headers();self.wfile.write(body)
    def log_message(self,*_):pass
server=ThreadingHTTPServer(('127.0.0.1',0),Fixture)
Thread(target=server.serve_forever,daemon=True).start()
try:
    addon = driver.install_addon(str(ROOT / 'dist/fire-axolotl-extension-0.3.0-unsigned.xpi'), temporary=True)
    driver.set_context('chrome')
    uuid = driver.execute_script("return JSON.parse(Services.prefs.getStringPref('extensions.webextensions.uuids'))[arguments[0]]", addon)
    driver.set_context('content')
    driver.get(f'moz-extension://{uuid}/aion/ai.html')
    wait.until(lambda d: d.find_element(By.TAG_NAME, 'body').get_attribute('data-ready') == 'true')
    Select(driver.find_element(By.ID,'aiModel')).select_by_value('qwen')
    pin = json.loads((ROOT / 'browser/extension/ai/model.json').read_text())
    model_dir = Path(os.environ['AION_MODEL_DIR'])
    files = [model_dir / name for name in pin['files'] if not name.endswith('model_q4f16.onnx')]
    assert all(path.is_file() for path in files)
    driver.find_element(By.CSS_SELECTOR, 'details summary').click()
    driver.find_element(By.ID, 'model-files').send_keys('\n'.join(str(path.resolve()) for path in files))
    driver.find_element(By.ID, 'model-import').click()
    start = time.monotonic()
    previous = ''
    while time.monotonic() - start < 1800:
        state = driver.execute_async_script('browser.runtime.sendMessage({type:"localAI",action:"status"}).then(arguments[0]);')
        summary = f'{state.get("phase")} {state.get("loaded",0)}/{state.get("total",0)} {state.get("error","")} {state.get("detail","")}'
        if summary != previous:
            print(round(time.monotonic() - start), summary, flush=True); previous = summary
        if state.get('phase') == 'ready': break
        if state.get('phase') == 'error': raise AssertionError(state)
        time.sleep(3)
    else: raise AssertionError('Qwen model loading timed out')
    results.append('Actual SHA-256-verified Qwen 2.5 1.5B uint8 model loaded in the extension WASM worker')
    Select(driver.find_element(By.ID,'aiBackend')).select_by_value('webgpu')
    wait.until(lambda d:d.execute_script('return UI.settings.aiBackend')=='webgpu')
    driver.refresh()
    wait.until(lambda d:d.find_element(By.TAG_NAME,'body').get_attribute('data-ready')=='true')
    assert driver.find_element(By.ID,'aiModel').get_attribute('value')=='qwen'
    assert driver.find_element(By.CSS_SELECTOR,'#aiBackend option[value=webgpu]').is_enabled()
    assert driver.find_element(By.ID,'aiBackend').get_attribute('value')=='webgpu'
    assert 'CPU / WASM' in driver.find_element(By.ID,'ai-state').text
    results.append('Reopening the AI page restores the loaded Qwen selection and backend controls')
    ai_handle=driver.current_window_handle
    driver.switch_to.new_window('tab'); video_handle=driver.current_window_handle
    fixture_url=f'http://127.0.0.1:{server.server_port}/'
    driver.get(fixture_url);driver.find_element(By.ID,'play').click()
    wait.until(lambda d:d.execute_script('return document.querySelector("video").videoWidth')==320)
    driver.switch_to.window(ai_handle)
    driver.find_element(By.ID,'video-refresh').click()
    target=driver.execute_async_script('const [url,done]=arguments;browser.tabs.query({}).then(tabs=>done(tabs.find(tab=>tab.url===url)?.id));',fixture_url)
    Select(driver.find_element(By.ID,'video-tab')).select_by_value(str(target))
    # Network is off before inference: this must be the actual local model.
    driver.set_context('chrome'); driver.execute_script('Services.io.offline = true'); driver.set_context('content')
    driver.find_element(By.CSS_SELECTOR, '#ai-prompt').find_element(By.XPATH,'ancestor::details').find_element(By.TAG_NAME,'summary').click()
    driver.find_element(By.ID,'ai-prompt').send_keys('Say hello.')
    driver.find_element(By.ID,'ai-generate').click()
    WebDriverWait(driver,600).until(lambda d:bool(d.find_element(By.ID,'ai-answer').text.strip()))
    results.append('The same Qwen worker also produced a general response offline; its quality was not graded')
    Select(driver.find_element(By.ID,'aiSource')).select_by_value('en')
    wait.until(lambda d:d.execute_script('return UI.settings.aiSource')=='en')
    driver.execute_script("document.getElementById('ai-text').value='The cat is sleeping.';")
    driver.find_element(By.ID, 'ai-translate').click()
    WebDriverWait(driver, 600).until(lambda d: bool(d.find_element(By.ID, 'ai-result').get_attribute('value')))
    answer = driver.find_element(By.ID, 'ai-result').get_attribute('value')
    correct = 'kedi' in answer.lower() and any(word in answer.lower() for word in ['uyu','uyku'])
    quality.append({'input':'The cat is sleeping.', 'target':'tr', 'output':answer, 'passed':correct})
    results.append('Actual model produces text with browser networking offline; quality is recorded separately')
    driver.save_screenshot(str(ARTIFACTS / 'qwen-offline-translation.png'))
    Select(driver.find_element(By.ID,'aiSource')).select_by_value('auto')
    wait.until(lambda d:d.execute_script('return UI.settings.aiSource')=='auto')
    driver.find_element(By.ID,'live-mode').click()
    WebDriverWait(driver,600).until(lambda d:bool(d.find_element(By.ID,'live-translation').text.strip()))
    driver.switch_to.window(video_handle)
    wait.until(lambda d:bool(d.find_elements(By.CSS_SELECTOR,'[data-aion-captions]')))
    driver.find_element(By.ID,'fullscreen').click()
    wait.until(lambda d:d.execute_script('return document.fullscreenElement===document.querySelector("video");'))
    wait.until(lambda d:d.execute_script('return [...document.querySelector("video").textTracks].find(t=>t.label==="Aion")?.cues?.length===2;'))
    paired=driver.execute_script('const c=[...document.querySelector("video").textTracks].find(t=>t.label==="Aion").cues;return c.length===2 && c[0].startTime===c[1].startTime && c[0].endTime===c[1].endTime;')
    assert paired
    driver.save_screenshot(str(ARTIFACTS/'qwen-live-fullscreen-captions.png'))
    driver.execute_async_script('document.exitFullscreen().then(()=>arguments[0](true));')
    wait.until(lambda d:d.find_element(By.CSS_SELECTOR,'[data-aion-captions]').is_displayed())
    driver.save_screenshot(str(ARTIFACTS/'qwen-live-dual-captions.png'))
    driver.switch_to.window(ai_handle)
    driver.find_element(By.ID,'stop-video').click()
    driver.switch_to.window(video_handle)
    wait.until(lambda d:not d.find_elements(By.CSS_SELECTOR,'[data-aion-captions]'))
    assert driver.execute_script('return [...document.querySelector("video").textTracks].find(t=>t.label==="English").mode')=='showing'
    driver.switch_to.window(ai_handle)
    results.append('Real local model output is overlaid offline at paired caption timestamps and original tracks restore; this is a transport check, not a quality pass')
    driver.find_element(By.ID, 'model-unload').click()
    wait.until(lambda d: d.execute_async_script('browser.runtime.sendMessage({type:"localAI",action:"status"}).then(x=>arguments[0](x.phase==="unloaded"));'))
    results.append('Unloading the shared AI worker releases model memory without deleting model files')
    print('TECHNICAL CHECKS', json.dumps(results, ensure_ascii=False), flush=True)
    assert all(check['passed'] for check in quality), {'quality_failed':quality}
finally:
    (ARTIFACTS / 'results.json').write_text(json.dumps({'passed': results, 'quality_checks':quality}, ensure_ascii=False, indent=2) + '\n')
    driver.quit()
    server.shutdown()
