# SPDX-License-Identifier: MPL-2.0
"""Real translation model inference in stock Firefox, with hash-pinned local model files.

Needs AION_TRANSLATION_MODEL_DIR, AION_FIREFOX_BINARY and AION_GECKODRIVER. No mock,
remote inference service, native messaging host or browser security overrides.
"""
import json
import os
import time
import re
import tempfile
import subprocess
from urllib.parse import urlsplit
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
ARTIFACTS = ROOT / ('work/m2m-download-test-artifacts' if os.environ.get('AION_TEST_MODEL_DOWNLOAD') == '1' else 'work/m2m-test-artifacts')
ARTIFACTS.mkdir(parents=True, exist_ok=True)
options = Options()
options.binary_location = os.environ['AION_FIREFOX_BINARY']
options.add_argument('-headless')
options.accept_insecure_certs = False
options.set_preference('remote.prefs.recommended', False)
options.set_preference('dom.file.createInChild', True)
# Optional managed-cloud test profile: use the supplied proxy and its supplied CA.
# TLS validation remains enabled; no browser preference on the user's profile changes.
profile_dir = None
if os.environ.get('AION_USE_TEST_PROXY') == '1':
    proxy = urlsplit(os.environ['HTTPS_PROXY'])
    options.set_preference('network.proxy.type', 1)
    options.set_preference('network.proxy.ssl', proxy.hostname)
    options.set_preference('network.proxy.ssl_port', proxy.port)
    options.set_preference('network.proxy.http', proxy.hostname)
    options.set_preference('network.proxy.http_port', proxy.port)
    options.set_preference('network.proxy.no_proxies_on', 'localhost, 127.0.0.1')
    profile_dir = tempfile.TemporaryDirectory(prefix='m2m-firefox-',dir=ROOT/'work')
    db = 'sql:' + profile_dir.name
    subprocess.run(['certutil','-N','-d',db,'--empty-password'],check=True)
    bundle = Path(os.environ['SSL_CERT_FILE']).read_bytes()
    certs = re.findall(rb'-----BEGIN CERTIFICATE-----.*?-----END CERTIFICATE-----',bundle,re.S)
    count = 0
    for cert in certs:
        info = subprocess.run(['openssl','x509','-noout','-subject','-text'],input=cert,capture_output=True,check=True).stdout
        if b'CA:TRUE' not in info or not (b'OpenAI' in info or b'mitmproxy' in info): continue
        path = Path(profile_dir.name)/f'proxy-ca-{count}.pem';path.write_bytes(cert)
        subprocess.run(['certutil','-A','-d',db,'-n',f'test-proxy-{count}','-t','C,,','-i',str(path)],check=True)
        count += 1
    if not count: raise RuntimeError('Supplied proxy CA not found')
    options.profile = profile_dir.name
driver = webdriver.Firefox(options=options, service=Service(os.environ['AION_GECKODRIVER'], service_args=['--allow-system-access'], log_output=str(ARTIFACTS / 'geckodriver.log')))
wait = WebDriverWait(driver, 30)
results = []
quality = []
observations = []
class Fixture(BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path == '/video.webm':
            body=(ROOT / 'tests/fixtures/video.webm').read_bytes(); content='video/webm'
        elif self.path == '/page':
            body=b'<!doctype html><meta charset="utf-8"><title>Local page translation fixture</title><p id="sentence">The cat is sleeping.</p><div role="dialog"><p id="dialog">The cat is sleeping.</p></div>';content='text/html'
        else:
            body=b'''<!doctype html><meta charset="utf-8"><title>Local Qwen caption fixture</title><video controls muted loop src="/video.webm" style="width:640px;max-width:100%"></video><button id="play">Play</button><button id="fullscreen">Fullscreen</button><script>document.getElementById("fullscreen").onclick=()=>document.querySelector("video").requestFullscreen();document.getElementById("play").onclick=()=>{const v=document.querySelector("video"),t=v.addTextTrack("subtitles","English","en");t.addCue(new VTTCue(0,3600,"The cat is sleeping."));t.mode="showing";v.play();};</script>''';content='text/html'
        self.send_response(200);self.send_header('Content-Type',content);self.send_header('Content-Length',str(len(body)));self.end_headers();self.wfile.write(body)
    def log_message(self,*_):pass
server=ThreadingHTTPServer(('127.0.0.1',0),Fixture)
Thread(target=server.serve_forever,daemon=True).start()
try:
    addon = driver.install_addon(str(ROOT / 'dist/fire-axolotl-extension-0.7.0-unsigned.xpi'), temporary=True)
    driver.set_context('chrome')
    uuid = driver.execute_script("return JSON.parse(Services.prefs.getStringPref('extensions.webextensions.uuids'))[arguments[0]]", addon)
    driver.set_context('content')
    driver.get(f'moz-extension://{uuid}/aion/ai.html')
    wait.until(lambda d: d.find_element(By.TAG_NAME, 'body').get_attribute('data-ready') == 'true')
    Select(driver.find_element(By.ID,'aiModel')).select_by_value('m2m')
    assert len(driver.find_element(By.ID,'aiTarget').find_elements(By.TAG_NAME,'option')) == 100
    assert not driver.find_element(By.CSS_SELECTOR,'#aiBackend option[value=webgpu]').is_enabled()
    pin = json.loads((ROOT / 'browser/extension/ai/translation-model.json').read_text())
    model_dir = Path(os.environ['AION_TRANSLATION_MODEL_DIR'])
    files = [model_dir / name for name in pin['files'] ]
    assert all(path.is_file() for path in files)
    if os.environ.get('AION_TEST_MODEL_DOWNLOAD') == '1':
        driver.find_element(By.ID, 'model-download').click()
    else:
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
    else: raise AssertionError('M2M100 model loading timed out')
    results.append('Actual SHA-256-verified M2M100 418M q8 model loaded in the extension WASM worker')
    ai_handle=driver.current_window_handle
    driver.switch_to.new_window('tab'); video_handle=driver.current_window_handle
    fixture_url=f'http://127.0.0.1:{server.server_port}/'
    driver.get(fixture_url);driver.find_element(By.ID,'play').click()
    wait.until(lambda d:d.execute_script('return document.querySelector("video").videoWidth')==320)
    driver.switch_to.new_window('tab');page_handle=driver.current_window_handle;page_url=fixture_url+'page';driver.get(page_url)
    driver.switch_to.window(ai_handle)
    driver.find_element(By.ID,'video-refresh').click()
    target=driver.execute_async_script('const [url,done]=arguments;browser.tabs.query({}).then(tabs=>done(tabs.find(tab=>tab.url===url)?.id));',fixture_url)
    Select(driver.find_element(By.ID,'video-tab')).select_by_value(str(target))
    page_target=driver.execute_async_script('const [url,done]=arguments;browser.tabs.query({}).then(tabs=>done(tabs.find(tab=>tab.url===url)?.id));',page_url)
    Select(driver.find_element(By.ID,'page-tab')).select_by_value(str(page_target))
    # Network is off before inference: this must be the actual local model.
    driver.set_context('chrome'); driver.execute_script('Services.io.offline = true'); driver.set_context('content')
    Select(driver.find_element(By.ID,'aiSource')).select_by_value('en')
    wait.until(lambda d:d.execute_script('return UI.settings.aiSource')=='en')
    driver.execute_script("document.getElementById('ai-text').value='The cat is sleeping.';")
    driver.find_element(By.ID, 'ai-translate').click()
    WebDriverWait(driver, 600).until(lambda d: bool(d.find_element(By.ID, 'ai-result').get_attribute('value')))
    answer = driver.find_element(By.ID, 'ai-result').get_attribute('value')
    correct = 'kedi' in answer.lower() and any(word in answer.lower() for word in ['uyu','uyku'])
    quality.append({'input':'The cat is sleeping.', 'target':'tr', 'output':answer, 'passed':correct})
    results.append('Actual model produces text with browser networking offline; quality is recorded separately')
    driver.save_screenshot(str(ARTIFACTS / 'm2m-offline-translation.png'))
    driver.execute_script("document.getElementById('ai-text').value='I was about to give up.';document.getElementById('ai-result').value='';")
    driver.find_element(By.ID,'ai-translate').click()
    WebDriverWait(driver,600).until(lambda d:bool(d.find_element(By.ID,'ai-result').get_attribute('value')))
    observations.append({'input':'I was about to give up.','target':'tr','output':driver.find_element(By.ID,'ai-result').get_attribute('value'),'note':'Nuance example for human assessment; not a comprehensive quality benchmark.'})
    driver.execute_script("document.getElementById('ai-text').value='The cat is sleeping.';")
    Select(driver.find_element(By.ID,'aiSource')).select_by_value('auto')
    wait.until(lambda d:d.execute_script('return UI.settings.aiSource')=='auto')
    driver.execute_script("document.getElementById('ai-result').value='';")
    driver.find_element(By.ID,'ai-translate').click()
    WebDriverWait(driver,600).until(lambda d:bool(d.find_element(By.ID,'ai-result').get_attribute('value')))
    detected=driver.find_element(By.ID,'ai-result').get_attribute('value')
    quality.append({'input':'The cat is sleeping. (auto source)','target':'tr','output':detected,'passed':'kedi' in detected.lower() and any(word in detected.lower() for word in ['uyu','uyku'])})
    results.append('Firefox detected the English source locally while offline')
    Select(driver.find_element(By.ID,'aiSource')).select_by_value('tr')
    wait.until(lambda d:d.execute_script('return UI.settings.aiSource')=='tr')
    Select(driver.find_element(By.ID,'aiTarget')).select_by_value('en')
    wait.until(lambda d:d.execute_script('return UI.settings.aiTarget')=='en')
    driver.execute_script("document.getElementById('ai-text').value='Merhaba, nasılsın?';document.getElementById('ai-result').value='';")
    driver.find_element(By.ID,'ai-translate').click()
    WebDriverWait(driver,600).until(lambda d:bool(d.find_element(By.ID,'ai-result').get_attribute('value')))
    reverse=driver.find_element(By.ID,'ai-result').get_attribute('value')
    quality.append({'input':'Merhaba, nasılsın?','target':'en','output':reverse,'passed':'hello' in reverse.lower() and 'you' in reverse.lower()})
    Select(driver.find_element(By.ID,'aiTarget')).select_by_value('tr')
    wait.until(lambda d:d.execute_script('return UI.settings.aiTarget')=='tr')
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
    driver.save_screenshot(str(ARTIFACTS/'m2m-live-fullscreen-captions.png'))
    driver.execute_async_script('document.exitFullscreen().then(()=>arguments[0](true));')
    wait.until(lambda d:d.find_element(By.CSS_SELECTOR,'[data-aion-captions]').is_displayed())
    driver.save_screenshot(str(ARTIFACTS/'m2m-live-dual-captions.png'))
    driver.switch_to.window(ai_handle)
    driver.find_element(By.ID,'stop-video').click()
    driver.switch_to.window(video_handle)
    wait.until(lambda d:not d.find_elements(By.CSS_SELECTOR,'[data-aion-captions]'))
    assert driver.execute_script('return [...document.querySelector("video").textTracks].find(t=>t.label==="English").mode')=='showing'
    driver.switch_to.window(ai_handle)
    results.append('Real local model output is overlaid offline at paired caption timestamps and original tracks restore; this is a transport check, not a quality pass')
    Select(driver.find_element(By.ID,'aiSource')).select_by_value('en')
    wait.until(lambda d:d.execute_script('return UI.settings.aiSource')=='en')
    driver.execute_script('const e=document.getElementById("captionOffset");e.value="0.5";e.dispatchEvent(new Event("input",{bubbles:true}));')
    wait.until(lambda d:d.execute_script('return UI.settings.captionOffset')==.5)
    subtitle = ARTIFACTS / 'sample.vtt'
    subtitle.write_text('WEBVTT\n\n00:00:01.000 --> 00:00:03.000\nThe cat is sleeping.\n',encoding='utf-8')
    driver.find_element(By.CSS_SELECTOR,'input[data-setting=captionOriginal]').click()
    wait.until(lambda d:d.execute_script('return UI.settings.captionOriginal') is False)
    driver.find_element(By.ID,'subtitle-file').send_keys(str(subtitle.resolve()))
    driver.find_element(By.ID,'translate-file').click()
    WebDriverWait(driver,600).until(lambda d:d.find_element(By.ID,'subtitle-download').is_displayed())
    exported=driver.execute_async_script('fetch(document.getElementById("subtitle-download").href).then(r=>r.text()).then(arguments[0]);')
    assert '00:00:01.000 --> 00:00:03.000' in exported and 'kedi' in exported.lower(),exported
    results.append('A local VTT file preserves its exported timestamps even with a nonzero playback offset')
    wait.until(lambda d:d.find_element(By.ID,'caption-track').get_attribute('value')=='local' and d.find_element(By.ID,'caption-track').is_enabled())
    driver.switch_to.window(video_handle);driver.execute_script('const v=document.querySelector("video");v.pause();v.currentTime=1.7;');driver.switch_to.window(ai_handle)
    driver.find_element(By.ID,'caption-read').click()
    wait.until(lambda d:d.find_element(By.ID,'study-text').get_attribute('value')=='The cat is sleeping.')
    results.append('File translation retains its original learning source even when original captions are hidden from the overlay')
    driver.find_element(By.CSS_SELECTOR,'input[data-setting=captionOriginal]').click()
    wait.until(lambda d:d.execute_script('return UI.settings.captionOriginal') is True)
    driver.find_element(By.ID,'reset-caption-offset').click()
    wait.until(lambda d:d.execute_script('return UI.settings.captionOffset')==0)
    driver.find_element(By.ID,'stop-video').click()
    driver.find_element(By.ID,'page-scan').click()
    wait.until(lambda d:'The cat is sleeping.' in d.find_element(By.ID,'page-preview').get_attribute('value'))
    driver.find_element(By.ID,'page-translate').click()
    WebDriverWait(driver,600).until(lambda d:d.find_element(By.ID,'page-progress').get_attribute('value')=='2')
    driver.switch_to.window(page_handle)
    page_outputs=[driver.find_element(By.ID,name).text for name in ['sentence','dialog']]
    quality.append({'input':'The cat is sleeping. (page and dialog offline)','target':'tr','output':page_outputs,'passed':all('kedi' in text.lower() and any(word in text.lower() for word in ['uyu','uyku']) for text in page_outputs)})
    driver.save_screenshot(str(ARTIFACTS/'m2m-offline-page.png'))
    driver.switch_to.window(ai_handle)
    driver.find_element(By.ID,'page-restore').click()
    wait.until(lambda d:'2' in d.find_element(By.ID,'page-result').text)
    driver.switch_to.window(page_handle)
    assert all(driver.find_element(By.ID,name).text=='The cat is sleeping.' for name in ['sentence','dialog'])
    driver.switch_to.window(ai_handle)
    results.append('Normal AI UI translates reviewed page/dialog text with the actual offline model, reuses duplicate text and restores originals')
    driver.find_element(By.ID, 'model-unload').click()
    wait.until(lambda d: d.execute_async_script('browser.runtime.sendMessage({type:"localAI",action:"status"}).then(x=>arguments[0](x.phase==="unloaded"));'))
    results.append('Unloading the shared AI worker releases model memory without deleting model files')
    Select(driver.find_element(By.ID,'aiModel')).select_by_value('qwen')
    wait.until(lambda d:d.find_element(By.ID,'aiModel').get_attribute('value')=='qwen')
    assert driver.find_element(By.CSS_SELECTOR,'#aiBackend option[value=webgpu]').is_enabled()
    results.append('Model selector switches back to Qwen and enables its backend control')
    print('TECHNICAL CHECKS', json.dumps(results, ensure_ascii=False), flush=True)
    assert all(check['passed'] for check in quality), {'quality_failed':quality}
finally:
    (ARTIFACTS / 'results.json').write_text(json.dumps({'passed': results, 'quality_checks':quality, 'observations':observations}, ensure_ascii=False, indent=2) + '\n')
    driver.quit()
    server.shutdown()
    if profile_dir: profile_dir.cleanup()
