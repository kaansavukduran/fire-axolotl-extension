# SPDX-License-Identifier: MPL-2.0
"""Run with selenium, AION_FIREFOX_BINARY and AION_GECKODRIVER; never disable the browser sandbox."""
import json
import os
import base64
import shutil
from pathlib import Path
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from threading import Thread
from urllib.parse import urlparse, parse_qs
from selenium import webdriver
from selenium.webdriver.common.action_chains import ActionChains
from selenium.webdriver.common.by import By
from selenium.webdriver.common.keys import Keys
from selenium.webdriver.firefox.options import Options
from selenium.webdriver.firefox.service import Service
from selenium.webdriver.support.ui import Select, WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from gecko_controls import choose_option

ROOT = Path(__file__).resolve().parents[1]
ARTIFACTS = ROOT / 'work/test-artifacts'
ARTIFACTS.mkdir(parents=True, exist_ok=True)
options = Options()
options.binary_location = os.environ['AION_FIREFOX_BINARY']
options.add_argument('-headless')
options.accept_insecure_certs = False
options.set_preference('remote.prefs.recommended', False)
# Marionette's uploadFiles uses File.createFromFileName in its privileged
# content actor. Opt into this one automation capability, not the recommended
# preference bundle that also disables browser security services.
options.set_preference('dom.file.createInChild', True)
downloads = ARTIFACTS / 'downloads'
downloads.mkdir(exist_ok=True)
options.set_preference('browser.download.folderList', 2)
options.set_preference('browser.download.dir', str(downloads))
options.set_preference('browser.helperApps.neverAsk.saveToDisk', 'application/json')
options.set_preference('browser.download.alwaysOpenPanel', False)
options.set_preference('browser.shell.checkDefaultBrowser', False)
driver = webdriver.Firefox(options=options, service=Service(os.environ['AION_GECKODRIVER'], service_args=['--allow-system-access'], log_output=str(ARTIFACTS / 'geckodriver.log')))
wait = WebDriverWait(driver, 20)
results = []

FIXTURE = b'''<!doctype html><meta charset="utf-8"><title>Aion test fixture</title>
<style>body{font:18px system-ui;background:#eef4ff;padding:2rem}video{width:640px;max-width:100%;display:block}canvas{display:none}</style>
<h1>Aion synthetic video fixture</h1><p id="selected">Hello Aion</p><button id="start">Start test video</button><button id="fullscreen-video">Fullscreen video</button>
<video src="/video.webm" controls muted loop></video><img id="search-image" src="/image.png" alt="Aion test image" width="48" height="48">
<script>document.getElementById('fullscreen-video').onclick=()=>document.querySelector('video').requestFullscreen();document.getElementById('start').onclick=async()=>{const v=document.querySelector('video');const t=v.addTextTrack('subtitles','English','en');t.addCue(new VTTCue(0,3600,'Hello Aion'));t.mode='showing';await v.play();};</script>'''


class FixtureHandler(BaseHTTPRequestHandler):
    def do_GET(self):
        special = {
            '/frame-host.html': f'<!doctype html><title>Cross-origin frame fixture</title><iframe src="http://localhost:{self.server.server_port}/" allowfullscreen style="width:800px;height:600px"></iframe>'.encode(),
            '/audio.html': b'<!doctype html><title>Audio fixture</title><audio controls muted loop src="/audio.wav"></audio><button id="play-audio" onclick="document.querySelector(\'audio\').play()">Play</button>',
            '/blocking-fixture.html': b'<!doctype html><title>Blocking fixture</title><script src="/allowed-script.js"></script><script src="/blocked-script.js"></script><h1>Normal page</h1>',
            '/allowed-script.js': b'window.normalScriptRan=true;',
            '/blocked-script.js': b'window.blockedScriptRan=true;',
        }
        if self.path == '/blocked-script.js':
            self.server.blocked_requests += 1
        files = {'/video.webm': ROOT / 'tests/fixtures/video.webm', '/image.png': ROOT / 'browser/extension/icons/48.png'}
        if self.path == '/audio.wav':
            import io,wave
            stream=io.BytesIO()
            with wave.open(stream,'wb') as audio:audio.setnchannels(1);audio.setsampwidth(2);audio.setframerate(8000);audio.writeframes(bytes(16000))
            special['/audio.wav']=stream.getvalue()
        body = files[self.path].read_bytes() if self.path in files else special.get(self.path, FIXTURE)
        content_type = 'audio/wav' if self.path == '/audio.wav' else 'video/webm' if self.path == '/video.webm' else 'image/png' if self.path == '/image.png' else 'application/javascript' if self.path.endswith('.js') else 'text/html; charset=utf-8'
        self.send_response(200); self.send_header('Content-Type', content_type); self.send_header('Cache-Control', 'no-store'); self.send_header('Content-Length', str(len(body))); self.end_headers(); self.wfile.write(body)
    def log_message(self, *_args):
        pass


server = ThreadingHTTPServer(('127.0.0.1', 0), FixtureHandler)
server.blocked_requests = 0
Thread(target=server.serve_forever, daemon=True).start()


def record(name):
    results.append(name)
    print('PASS', name, flush=True)


def value(element_id, text):
    element = driver.find_element(By.ID, element_id)
    element.send_keys(Keys.CONTROL, 'a')
    element.send_keys(str(text), Keys.TAB)


def saved(key, expected):
    wait.until(lambda d: d.execute_script('return globalThis.UI?.settings?.[arguments[0]]', key) == expected)


try:
    wait.until(lambda d: d.window_handles)
    driver.switch_to.window(driver.window_handles[-1])
    driver.switch_to.new_window('tab')
    package = ROOT / 'dist/fire-axolotl-extension-0.4.0-unsigned.xpi'
    addon_id = driver.install_addon(str(package), temporary=True)
    assert addon_id == 'fire-axolotl-extension@kaansavukduran.github.io'
    driver.set_context('chrome')
    ublock_uuid = driver.execute_script("return JSON.parse(Services.prefs.getStringPref('extensions.webextensions.uuids'))[arguments[0]]", addon_id)
    driver.set_context('content')
    blocking_url = f'http://127.0.0.1:{server.server_port}/blocking-fixture.html'
    driver.get(blocking_url)
    assert driver.execute_script('return window.normalScriptRan && window.blockedScriptRan')
    driver.get(f'moz-extension://{ublock_uuid}/1p-filters.html')
    wait.until(lambda d: d.execute_script('return !!document.querySelector(".CodeMirror")?.CodeMirror'))
    # First launch compiles the real bundled filter lists. Give that work time
    # on a four-core host that is also compiling Firefox; do not skip the lists.
    driver.set_script_timeout(120)
    driver.execute_async_script('vAPI.messaging.send("dashboard", {what:"getLists"}).then(()=>arguments[0](true));')
    driver.set_script_timeout(30)
    driver.refresh()
    wait.until(lambda d: d.execute_script('return typeof self.hasUnsavedData === "function" && self.hasUnsavedData() === false;'))
    if not driver.find_element(By.CSS_SELECTOR, '#enableMyFilters input').is_selected():
        driver.find_element(By.CSS_SELECTOR, '#enableMyFilters input').click()
    rule = f'|http://127.0.0.1:{server.server_port}/blocked-script.js$script'
    driver.execute_script('document.querySelector(".CodeMirror").CodeMirror.setValue(arguments[0]);', rule + '\n')
    wait.until(lambda d: d.find_element(By.ID, 'userFiltersApply').is_enabled())
    driver.find_element(By.ID, 'userFiltersApply').click()
    WebDriverWait(driver, 120).until(lambda d: not d.find_element(By.ID, 'userFiltersApply').is_enabled())
    driver.set_script_timeout(120)
    driver.execute_async_script('vAPI.messaging.send("dashboard", {what:"reloadAllFilters"}).then(()=>arguments[0](true));')
    driver.set_script_timeout(30)
    stored_filters = driver.execute_async_script('vAPI.messaging.send("dashboard", {what:"readUserFilters"}).then(arguments[0]);')
    assert stored_filters['enabled'] and rule in stored_filters['content'], stored_filters
    before = server.blocked_requests
    driver.get(blocking_url)
    state = driver.execute_script('return {normal: window.normalScriptRan === true, blocked: window.blockedScriptRan === true};')
    assert state == {'normal': True, 'blocked': False}, state
    assert server.blocked_requests == before, 'The blocked request must not reach the local server'
    record('Integrated hash-pinned uBlock Origin engine blocks a real script request while the normal page still runs')
    record('One independently identified extension supplies both uBO and Aion; no second add-on installed')
    base = f'moz-extension://{ublock_uuid}/aion/'
    driver.get(base + 'settings.html')
    wait.until(lambda d: d.find_element(By.TAG_NAME, 'body').get_attribute('data-ready') == 'true')
    wait.until(lambda d: d.execute_script('return typeof UI !== "undefined" && !!UI.settings'))
    assert driver.execute_script('return UI.settings.theme') == 'dark'
    record('New companion profile defaults to dark')
    Select(driver.find_element(By.ID, 'language')).select_by_value('tr')
    wait.until(lambda d: d.find_element(By.TAG_NAME, 'html').get_attribute('lang') == 'tr')
    assert driver.find_element(By.TAG_NAME, 'h1').text == 'Ayarlar'
    record('Turkish UI through normal settings controls')
    Select(driver.find_element(By.ID, 'theme')).select_by_value('contrast'); saved('theme', 'contrast')
    Select(driver.find_element(By.ID, 'font')).select_by_value('dyslexic'); saved('font', 'dyslexic')
    Select(driver.find_element(By.ID, 'font')).select_by_value('opendyslexic'); saved('font', 'opendyslexic')
    assert driver.execute_async_script("document.fonts.load('16px OpenDyslexic').then(fonts=>arguments[0](fonts.length));") > 0
    record('Bundled OpenDyslexic loads without a network font request')
    value('textSize-number', 150); saved('textSize', 150)
    value('scale-number', 135); saved('scale', 135)
    assert driver.execute_script('return parseFloat(getComputedStyle(document.documentElement).fontSize)') == 21.6
    record('Independent text size, Lexend, contrast and manual 135% interface scale')
    driver.find_element(By.CSS_SELECTOR, '[data-scale="200"]').click(); saved('scale', 200)
    driver.set_window_size(480, 900)
    assert driver.execute_script('return document.documentElement.scrollWidth <= innerWidth + 2')
    driver.save_screenshot(str(ARTIFACTS / 'settings-tr-200-narrow.png'))
    record('200% interface scale on a narrow viewport without horizontal clipping')
    driver.find_element(By.ID, 'reset-scale').click(); saved('scale', 100)
    assert driver.execute_script('return UI.settings.textSize') == 150
    driver.find_element(By.ID, 'scale').send_keys(Keys.ARROW_RIGHT); saved('scale', 105)
    driver.find_element(By.ID, 'reset-text').click(); saved('textSize', 100)
    driver.find_element(By.ID, 'reset-scale').click(); saved('scale', 100)
    record('Keyboard slider step and independent per-setting resets')
    driver.find_element(By.ID, 'progress').click(); saved('progress', False)
    Select(driver.find_element(By.ID, 'language')).select_by_value('en'); saved('language', 'en')
    Select(driver.find_element(By.ID, 'theme')).select_by_value('dark'); saved('theme', 'dark')
    driver.refresh()
    wait.until(lambda d: d.find_element(By.TAG_NAME, 'h1').text == 'Settings')
    assert driver.execute_script('return UI.settings.theme') == 'dark'
    record('English UI and settings persistence after reopening the page')
    driver.set_window_size(1280, 1000)
    driver.save_screenshot(str(ARTIFACTS / 'settings-en-dark.png'))
    driver.get(base + 'popup.html')
    wait.until(lambda d: d.find_element(By.ID, 'container-name').get_attribute('placeholder'))
    value('container-name', 'İş · Learning')
    driver.find_element(By.CSS_SELECTOR, '#container-form button').click()
    wait.until(lambda d: 'İş · Learning' in d.find_element(By.ID, 'container').text)
    assert not driver.find_element(By.ID, 'progress-section').is_displayed()
    record('Real Firefox contextual identity creation while progress is disabled')
    value('source-text', 'Işık, öğrenme, özgürlük')
    driver.find_element(By.ID, 'save-word').click()
    wait.until(lambda d: 'vocabulary' in d.find_element(By.ID, 'status').text.lower())
    driver.find_element(By.ID, 'save-word').click()
    driver.get(base + 'settings.html')
    wait.until(lambda d: d.find_element(By.TAG_NAME, 'body').get_attribute('data-ready') == 'true')
    wait.until(lambda d: '1 ' in d.find_element(By.ID, 'word-count').text)
    assert driver.execute_script('return UI.settings.vocabulary.length') == 1
    record('Real persistent vocabulary, duplicate prevention and optional progress')
    driver.set_context('chrome'); driver.execute_script('Services.io.offline = true'); driver.set_context('content')
    driver.refresh()
    wait.until(lambda d: d.find_element(By.TAG_NAME, 'h1').text == 'Settings')
    Select(driver.find_element(By.ID, 'language')).select_by_value('tr'); saved('language', 'tr')
    record('Offline settings and language switching')
    driver.set_context('chrome'); driver.execute_script('Services.io.offline = false'); driver.set_context('content')
    driver.switch_to.new_window('tab')
    web_handle = driver.current_window_handle
    driver.get(f'http://127.0.0.1:{server.server_port}/')
    driver.find_element(By.ID, 'start').click()
    wait.until(lambda d: d.execute_script('return document.querySelector("video").videoWidth') == 320)
    driver.set_context('chrome')
    driver.find_element(By.ID, 'fire-axolotl-extension_kaansavukduran_github_io-BAP').click()
    driver.set_context('content')
    driver.switch_to.new_window('tab')
    control_handle = driver.current_window_handle
    driver.get(base + 'popup.html')
    wait.until(lambda d: d.execute_script('return typeof UI !== "undefined" && !!UI.settings'))
    web_tab_id = driver.execute_async_script('const [url,done]=arguments;browser.tabs.query({}).then(tabs=>done(tabs.find(tab=>tab.url===url)?.id));', f'http://127.0.0.1:{server.server_port}/')
    assert web_tab_id is not None, 'Toolbar activation must grant access to the original web tab'

    def video_command(command):
        return driver.execute_async_script('''
          const [tabId, command, done] = arguments;
          (async () => {
            await browser.tabs.executeScript(tabId, {file:'/aion/video.js'});
            return browser.tabs.sendMessage(tabId, {type:'aionVideo', command});
          })().then(done, error => done({error:error.message}));
        ''', web_tab_id, command)

    # Use the packaged Apply button and its background handler against a real web tab.
    ui_result = driver.execute_async_script('''
      const [tabId, done] = arguments;
      (async () => {
        await browser.tabs.update(tabId, {active: true});
        document.getElementById('speed-number').value = '1.5';
        document.getElementById('apply-speed').click();
        for (let count=0; count<200; count++) {
          await new Promise(resolve=>setTimeout(resolve,25));
          const status=document.getElementById('status');
          if (status.textContent) return {error:status.dataset.error,text:status.textContent};
        }
        throw new Error('UI video action timed out');
      })().then(done,error=>done({error:error.message}));
    ''', web_tab_id)
    assert ui_result.get('error') == 'false', ui_result
    driver.switch_to.window(web_handle)
    assert driver.execute_script('return document.querySelector("video").playbackRate') == 1.5
    driver.switch_to.window(control_handle)
    record('The real Apply speed UI reaches the privileged background and changes the selected web video')
    response = video_command({'action': 'speed', 'value': 1.35})
    assert response.get('speed') == 1.35, response
    assert response['width'] == 320 and response['height'] == 180, response
    assert video_command({'action': 'speed', 'value': 9})['error'] == 'invalidSpeed'
    assert video_command({'action': 'info'})['speed'] == 1.35
    record('Real activeTab permission, injected video control, 1.35x speed and decoded 320x180 resolution')
    assert 'Hello Aion' in video_command({'action': 'captions'})['text']
    assert video_command({'action': 'quality', 'value': 'hd1080'})['error'] == 'unsupportedQuality'
    record('Real current caption extraction and honest unsupported-quality result')
    response = video_command({'action': 'overlay', 'language': 'tr', 'original': [{'start':0,'end':3600,'text':'Hello Aion'}], 'translated': [{'start':0,'end':3600,'text':'Merhaba Aion'}]})
    assert not response.get('error'), response
    driver.switch_to.window(web_handle)
    assert driver.find_element(By.CSS_SELECTOR, '[data-aion-captions]').is_displayed()
    driver.save_screenshot(str(ARTIFACTS / 'video-dual-captions.png'))
    assert driver.execute_script('return [...document.querySelector("video").textTracks].find(t=>t.label==="English").mode') == 'hidden'
    driver.find_element(By.ID, 'fullscreen-video').click()
    wait.until(lambda d: d.execute_script('return document.fullscreenElement === document.querySelector("video");'))
    wait.until(lambda d: d.execute_script('const track=[...document.querySelector("video").textTracks].find(t=>t.label==="Aion");return track?.mode==="showing" && [...(track.activeCues||[])].some(c=>c.text.includes("Merhaba Aion"));'))
    assert not driver.find_element(By.CSS_SELECTOR, '[data-aion-captions]').is_displayed()
    assert driver.execute_script('return [...document.querySelector("video").textTracks].find(t=>t.label==="Aion").activeCues.length') == 2
    driver.save_screenshot(str(ARTIFACTS / 'video-native-fullscreen-captions.png'))
    record('Native video-element fullscreen displays both local subtitle tracks through Gecko text rendering')
    driver.execute_async_script('document.exitFullscreen().then(()=>arguments[0](true));')
    wait.until(lambda d: d.find_element(By.CSS_SELECTOR, '[data-aion-captions]').is_displayed())
    assert driver.execute_script('return [...document.querySelector("video").textTracks].find(t=>t.label==="Aion").mode') == 'disabled'
    record('Leaving native fullscreen restores the custom subtitle overlay')
    driver.switch_to.window(control_handle)
    video_command({'action':'closeOverlay'})
    driver.switch_to.window(web_handle)
    assert not driver.find_elements(By.CSS_SELECTOR, '[data-aion-captions]')
    assert driver.execute_script('return [...document.querySelector("video").textTracks].some(t=>t.label==="Aion")') is False
    assert driver.execute_script('return [...document.querySelector("video").textTracks].find(t=>t.label==="English").mode') == 'showing'
    record('Real dual-caption overlay and removal without reloading the page')
    driver.switch_to.window(control_handle)
    driver.get(base + 'ai.html')
    wait.until(lambda d:d.find_element(By.TAG_NAME,'body').get_attribute('data-ready')=='true')
    driver.execute_script('const e=document.getElementById("captionOffset");e.value="0.5";e.dispatchEvent(new Event("input",{bubbles:true}));')
    saved('captionOffset',.5)
    cues=[{'start':0,'end':.25,'text':'Timing sample'}]
    response=driver.execute_async_script('browser.runtime.sendMessage({type:"mediaTab",tabId:arguments[0],command:{action:"overlay",original:arguments[1],translated:arguments[1]}}).then(arguments[2]);',web_tab_id,cues)
    assert not response.get('error'),response
    driver.switch_to.window(web_handle)
    driver.execute_script('const v=document.querySelector("video");v.pause();v.currentTime=.1;')
    host=driver.find_element(By.CSS_SELECTOR,'[data-aion-captions]')
    shadow=host.shadow_root
    wait.until(lambda d:not shadow.find_element(By.CSS_SELECTOR,'section').is_displayed())
    driver.execute_script('document.querySelector("video").currentTime=.6;')
    wait.until(lambda d:shadow.find_element(By.CSS_SELECTOR,'section').is_displayed())
    assert shadow.find_elements(By.CSS_SELECTOR,'p')[0].text=='Timing sample'
    shifted=driver.execute_script('const t=[...document.querySelector("video").textTracks].find(t=>t.label==="Aion");t.mode="hidden";const times=[...t.cues].map(c=>[c.startTime,c.endTime]);t.mode="disabled";return times;')
    assert shifted==[[.5,.75],[.5,.75]],shifted
    driver.switch_to.window(control_handle)
    driver.execute_script('const e=document.getElementById("captionOffset");e.value="-0.2";e.dispatchEvent(new Event("input",{bubbles:true}));')
    saved('captionOffset',-.2)
    cues=[{'start':0,'end':.1,'text':'Expired'},{'start':0,'end':1,'text':'Clipped'}]
    driver.execute_async_script('browser.runtime.sendMessage({type:"mediaTab",tabId:arguments[0],command:{action:"overlay",original:arguments[1],translated:arguments[1]}}).then(arguments[2]);',web_tab_id,cues)
    driver.switch_to.window(web_handle)
    clipped=driver.execute_script('const t=[...document.querySelector("video").textTracks].find(t=>t.label==="Aion");t.mode="hidden";const cues=[...t.cues].map(c=>({start:c.startTime,end:c.endTime,text:c.text}));t.mode="disabled";return cues;')
    assert len(clipped)==2 and all(c['start']==0 and abs(c['end']-.8)<.001 and c['text']=='Clipped' for c in clipped),clipped
    driver.switch_to.window(control_handle)
    driver.find_element(By.ID,'reset-caption-offset').click();saved('captionOffset',0)
    driver.execute_async_script('browser.runtime.sendMessage({type:"mediaTab",tabId:arguments[0],command:{action:"closeOverlay"}}).then(arguments[1]);',web_tab_id)
    driver.get(base+'popup.html')
    wait.until(lambda d:d.find_element(By.TAG_NAME,'body').get_attribute('data-ready')=='true')
    driver.switch_to.window(web_handle)
    record('Subtitle offset UI delays both DOM and native cues, clips negative starts, drops expired cues and resets to zero')
    driver.execute_script('const v=document.querySelector("video"),t=[...v.textTracks].find(t=>t.label==="English");v.pause();while(t.cues.length)t.removeCue(t.cues[0]);[[0,.4,"First line"],[.5,.9,"Second line"],[1,1.4,"Third line"]].forEach(c=>t.addCue(new VTTCue(...c)));v.currentTime=.6;')
    driver.switch_to.window(control_handle);driver.get(base+'ai.html')
    wait.until(lambda d:d.find_element(By.TAG_NAME,'body').get_attribute('data-ready')=='true')
    Select(driver.find_element(By.ID,'video-tab')).select_by_value(str(web_tab_id))
    assert driver.execute_async_script('browser.runtime.sendMessage({type:"localAI",action:"status"}).then(x=>arguments[0](x.phase==="unloaded"));')
    driver.find_element(By.ID,'caption-repeat').click()
    wait.until(lambda d:d.find_element(By.ID,'study-text').get_attribute('value')=='Second line')
    driver.switch_to.window(web_handle);driver.execute_script('document.querySelector("video").pause();')
    assert .5 <= driver.execute_script('return document.querySelector("video").currentTime') < 1
    driver.switch_to.window(control_handle);driver.find_element(By.ID,'caption-previous').click()
    wait.until(lambda d:d.find_element(By.ID,'study-text').get_attribute('value')=='First line')
    driver.switch_to.window(web_handle);driver.execute_script('document.querySelector("video").pause();document.querySelector("video").currentTime=.1;')
    driver.switch_to.window(control_handle);driver.find_element(By.ID,'caption-next').click()
    wait.until(lambda d:d.find_element(By.ID,'study-text').get_attribute('value')=='Second line')
    driver.find_element(By.ID,'caption-save').click()
    wait.until(lambda d:d.execute_async_script('browser.storage.local.get("settings").then(x=>arguments[0](x.settings.vocabulary.includes("Second line")));'))
    driver.switch_to.window(web_handle);driver.execute_script('document.querySelector("video").pause();document.querySelector("video").currentTime=1.8;')
    driver.switch_to.window(control_handle);driver.find_element(By.ID,'caption-next').click()
    wait.until(lambda d:d.find_element(By.ID,'status').get_attribute('data-error')=='true')
    driver.switch_to.window(web_handle);assert abs(driver.execute_script('return document.querySelector("video").currentTime')-1.8)<.01
    driver.switch_to.window(control_handle)
    driver.execute_script('const e=document.getElementById("captionOffset");e.value="0.2";e.dispatchEvent(new Event("input",{bubbles:true}));');saved('captionOffset',.2)
    driver.switch_to.window(web_handle);driver.execute_script('document.querySelector("video").currentTime=.8;')
    driver.switch_to.window(control_handle);driver.find_element(By.ID,'caption-read').click()
    wait.until(lambda d:d.find_element(By.ID,'study-text').get_attribute('value')=='Second line')
    driver.find_element(By.ID,'caption-repeat').click()
    wait.until(lambda d:d.find_element(By.ID,'status').get_attribute('data-error')=='false')
    driver.switch_to.window(web_handle);driver.execute_script('document.querySelector("video").pause();')
    assert .7 <= driver.execute_script('return document.querySelector("video").currentTime') < 1.2
    driver.switch_to.window(control_handle);driver.find_element(By.ID,'reset-caption-offset').click();saved('captionOffset',0)
    driver.get(base+'popup.html');wait.until(lambda d:d.find_element(By.TAG_NAME,'body').get_attribute('data-ready')=='true')
    driver.switch_to.window(web_handle)
    record('Caption study buttons replay, navigate, save vocabulary, respect offsets and leave playback unchanged at the end boundary without any AI model')
    handles_before_search = set(driver.window_handles)
    driver.set_context('chrome'); driver.execute_script('Services.io.offline = true;'); driver.set_context('content')
    ActionChains(driver).context_click(driver.find_element(By.ID, 'search-image')).perform()
    driver.set_context('chrome')
    menu_selector = '#contentAreaContextMenu menu[id*="aion-image-search"]'
    # Firefox groups multiple root menus from the same extension under its name.
    grouped = driver.find_elements(By.CSS_SELECTOR, '#contentAreaContextMenu menu[label="Fire Axolotl Extension"]')
    if grouped and grouped[0].is_displayed():
        ActionChains(driver).move_to_element(grouped[0]).perform()
    try:
        wait.until(lambda d: d.find_element(By.CSS_SELECTOR, menu_selector).is_displayed())
    except Exception:
        print('Context menu diagnostic:', driver.execute_script('return [...document.querySelectorAll("#contentAreaContextMenu menu,#contentAreaContextMenu menuitem")].map(x=>({id:x.id,label:x.getAttribute("label"),hidden:x.hidden}));'), flush=True)
        raise
    menu = driver.find_element(By.CSS_SELECTOR, menu_selector)
    ActionChains(driver).move_to_element(menu).perform()
    bing_selector = '#contentAreaContextMenu menuitem[label="Bing"]'
    wait.until(lambda d: d.find_element(By.CSS_SELECTOR, bing_selector).is_displayed())
    driver.save_screenshot(str(ARTIFACTS / 'image-search-context-menu.png'))
    driver.find_element(By.CSS_SELECTOR, bing_selector).click()
    driver.set_context('content')
    wait.until(lambda d: len(set(d.window_handles) - handles_before_search) == 1)
    driver.switch_to.window(next(iter(set(driver.window_handles) - handles_before_search)))
    wait.until(lambda d: d.current_url.startswith('https://www.bing.com/'))
    target = urlparse(driver.current_url)
    assert parse_qs(target.query)['imgurl'] == [f'http://127.0.0.1:{server.server_port}/image.png']
    driver.close(); driver.switch_to.window(control_handle)
    driver.set_context('chrome'); driver.execute_script('Services.io.offline = false;'); driver.set_context('content')
    record('Actual native image menu opens the explicitly chosen provider URL; offline test sends no image to a provider')
    driver.get(base + 'settings.html')
    wait.until(lambda d: d.find_element(By.TAG_NAME, 'body').get_attribute('data-ready') == 'true')
    wait.until(lambda d: d.find_element(By.ID, 'imageSearch').is_selected())
    driver.find_element(By.ID, 'imageSearch').click(); saved('imageSearch', False)
    driver.switch_to.window(web_handle)
    ActionChains(driver).context_click(driver.find_element(By.ID, 'search-image')).perform()
    driver.set_context('chrome')
    wait.until(lambda d: d.find_element(By.ID, 'contentAreaContextMenu').get_attribute('state') == 'open')
    try:
        wait.until(lambda d: not any(item.is_displayed() for item in d.find_elements(By.CSS_SELECTOR, menu_selector)))
    except Exception:
        driver.save_screenshot(str(ARTIFACTS / 'image-menu-disable-failure.png'))
        print('Menu DOM diagnostic:', driver.execute_script('return [...document.querySelectorAll(arguments[0])].map(m=>({id:m.id,hidden:m.hidden,collapsed:m.collapsed,display:getComputedStyle(m).display}));', menu_selector), flush=True)
        driver.set_context('content'); driver.switch_to.window(control_handle)
        print('Menu settings diagnostic:', driver.execute_async_script('browser.runtime.getBackgroundPage().then(async w=>arguments[0]({imageSearch:(await w.readSettings()).imageSearch,controller:!!w.AionImageMenus}));'), flush=True)
        raise
    driver.find_element(By.ID, 'contentAreaContextMenu').send_keys(Keys.ESCAPE)
    driver.set_context('content')
    record('Disabling image search through Aion settings removes its native context menu')
    driver.switch_to.new_window('tab')
    character_handle = driver.current_window_handle
    driver.get(base + 'characters.html')
    wait.until(lambda d: d.find_element(By.ID, 'character-canvas').get_attribute('data-character') == 'aion')
    assert driver.find_element(By.TAG_NAME, 'h1').text == 'Yol arkadaşları'
    for character in ['aion', 'sheep', 'wolf', 'owl']:
        Select(driver.find_element(By.ID, 'character')).select_by_value(character)
        wait.until(lambda d: d.find_element(By.ID, 'character-canvas').get_attribute('data-character') == character)
        assert driver.execute_script('return document.getElementById("character-canvas").getContext("2d").getImageData(0,0,480,480).data.some((v,i)=>i%4===3 && v>0);')
    Select(driver.find_element(By.ID, 'character-activity')).select_by_value('read')
    wait.until(lambda d: d.find_element(By.ID, 'character-canvas').get_attribute('data-activity') == 'read')
    driver.save_screenshot(str(ARTIFACTS / 'character-owl-reading-tr.png'))
    record('All four whole-character companions render locally with an actual reading animation and Turkish controls')
    Select(driver.find_element(By.ID, 'character')).select_by_value('aion')
    wait.until(lambda d: d.find_element(By.ID, 'character-canvas').get_attribute('data-character') == 'aion')
    start_frame = driver.find_element(By.ID, 'character-canvas').get_attribute('data-frame')
    wait.until(lambda d: d.find_element(By.ID, 'character-canvas').get_attribute('data-frame') != start_frame)
    driver.find_element(By.ID, 'character-pause').click(); saved('animations', False)
    assert driver.execute_async_script('const c=document.getElementById("character-canvas"),f=c.dataset.frame;setTimeout(()=>arguments[0](c.dataset.frame===f),550);')
    driver.find_element(By.ID, 'character-pause').send_keys(Keys.ENTER); saved('animations', True)
    driver.set_context('chrome'); driver.execute_script('Services.prefs.setIntPref("ui.prefersReducedMotion",1);'); driver.set_context('content')
    wait.until(lambda d: not d.find_element(By.ID, 'character-pause').is_enabled())
    assert driver.execute_async_script('const c=document.getElementById("character-canvas"),f=c.dataset.frame;setTimeout(()=>arguments[0](c.dataset.frame===f),550);')
    driver.set_context('chrome'); driver.execute_script('Services.prefs.clearUserPref("ui.prefersReducedMotion");'); driver.set_context('content')
    record('Companion frames advance, pause through the normal button/keyboard and honor OS reduced motion')
    driver.find_element(By.ID, 'character-file').send_keys(str(ROOT / 'browser/extension/characters/aion.png'))
    wait.until(lambda d: d.find_element(By.ID, 'character-import').is_enabled())
    value('character-name', 'Kişisel Aion · Test')
    for key, number in [('columns',8),('rows',11),('row',1),('frames',6)]:
        driver.find_element(By.CSS_SELECTOR, 'details summary').click() if key == 'columns' else None
        value('character-' + key, number)
    driver.find_element(By.ID, 'character-import').click()
    wait.until(lambda d: d.find_element(By.ID, 'character-canvas').get_attribute('data-character').startswith('custom-'))
    custom_id = driver.find_element(By.ID, 'character-canvas').get_attribute('data-character')
    driver.refresh()
    wait.until(lambda d: d.find_element(By.ID, 'character-canvas').get_attribute('data-character') == custom_id)
    assert Select(driver.find_element(By.ID, 'character')).first_selected_option.text == 'Kişisel Aion · Test'
    record('A user PNG sprite sheet imports through the file picker and persists with its grid after page reopen')
    export = downloads / 'fire-axolotl-character.json'
    export.unlink(missing_ok=True)
    driver.find_element(By.ID, 'character-export').click()
    # Firefox may create an empty destination before the download completes.
    # Wait for the browser's completion signal before reading or importing it.
    driver.set_context('chrome')
    try:
        wait.until(lambda d: d.execute_async_script('''
            const target = arguments[0], done = arguments[arguments.length - 1];
            const {Downloads} = ChromeUtils.importESModule('resource://gre/modules/Downloads.sys.mjs');
            Downloads.getList(Downloads.ALL).then(list => list.getAll()).then(
                items => done(items.some(item => item.target.path === target && item.succeeded)),
                () => done(false));
        ''', str(export)))
    finally:
        driver.set_context('content')
    backup = json.loads(export.read_text())
    assert backup['format'] == 'fire-axolotl-character' and backup['name'] == 'Kişisel Aion · Test'
    assert base64.b64decode(backup['png']) == (ROOT / 'browser/extension/characters/aion.png').read_bytes()
    driver.find_element(By.ID, 'character-delete').click()
    wait.until(EC.alert_is_present()).accept()
    wait.until(lambda d: d.find_element(By.ID, 'character-canvas').get_attribute('data-character') == 'aion')
    driver.find_element(By.ID, 'character-file').send_keys(str(export))
    wait.until(lambda d: d.find_element(By.ID, 'character-import').is_enabled())
    driver.find_element(By.ID, 'character-import').click()
    wait.until(lambda d: d.find_element(By.ID, 'character-canvas').get_attribute('data-character').startswith('custom-'))
    assert Select(driver.find_element(By.ID, 'character')).first_selected_option.text == 'Kişisel Aion · Test'
    record('Actual character export, confirmed removal and JSON reimport preserve PNG bytes and animation settings')
    driver.get(base + 'settings.html')
    wait.until(lambda d: d.find_element(By.TAG_NAME, 'body').get_attribute('data-ready') == 'true')
    wait.until(lambda d: d.find_element(By.ID, 'language').is_displayed())
    Select(driver.find_element(By.ID, 'language')).select_by_value('en'); saved('language', 'en')
    value('scale-number', 200); saved('scale', 200)
    driver.get(base + 'characters.html')
    wait.until(lambda d: d.find_element(By.TAG_NAME, 'h1').text == 'Companions')
    driver.set_window_size(480, 900)
    assert driver.execute_script('return document.documentElement.scrollWidth <= innerWidth + 2;')
    driver.save_screenshot(str(ARTIFACTS / 'characters-en-200-narrow.png'))
    record('English companion controls remain usable on a narrow screen at 200 percent interface scale')
    driver.set_window_size(1280, 1000)
    driver.get(base + 'settings.html')
    wait.until(lambda d: d.find_element(By.TAG_NAME, 'body').get_attribute('data-ready') == 'true')
    wait.until(lambda d: d.find_element(By.ID, 'reset-scale').is_displayed())
    driver.find_element(By.ID, 'reset-scale').click(); saved('scale', 100)
    wait.until(lambda d: d.find_element(By.ID, 'open-characters').is_displayed())
    driver.find_element(By.ID, 'open-characters').click()
    driver.set_context('chrome')
    wait.until(lambda d: d.execute_script('return SidebarController.currentID?.includes("fire-axolotl-extension_kaansavukduran_github_io");'))
    driver.execute_script('SidebarController.hide();')
    record('The extension sidebar opens through the normal settings button')
    # Exercise the extension-only additions through their own packaged UI.
    driver.set_context('content')
    control_handle = driver.current_window_handle
    driver.get(base + 'sidebar.html')
    wait.until(lambda d: d.find_elements(By.CSS_SELECTOR, '.tab-row'))
    driver.find_element(By.ID, 'filter').send_keys('Aion test fixture')
    wait.until(lambda d: len(d.find_elements(By.CSS_SELECTOR, '.tab-row')) == 1)
    row = driver.find_element(By.CSS_SELECTOR, '.tab-row')
    row.find_element(By.CSS_SELECTOR, '[data-focus-key$="-pin"]').click()
    wait.until(lambda d: '◆' in d.find_element(By.CSS_SELECTOR, '.tab-select').text)
    row = driver.find_element(By.CSS_SELECTOR, '.tab-row')
    row.find_element(By.CSS_SELECTOR, '[data-focus-key$="-pin"]').click()
    wait.until(lambda d: '◆' not in d.find_element(By.CSS_SELECTOR, '.tab-select').text)
    if not driver.find_element(By.ID, 'companions').is_displayed():
        driver.find_element(By.ID, 'characters-toggle').click()
    wait.until(lambda d: d.find_element(By.ID, 'companions').is_displayed())
    driver.find_element(By.ID, 'characters-toggle').click()
    assert driver.find_element(By.ID, 'companions').get_attribute('src') == 'about:blank'
    driver.save_screenshot(str(ARTIFACTS / 'tab-sidebar.png'))
    record('Tab sidebar filters and pins/unpins a real tab; hidden companion document is unloaded')

    driver.get(base + 'tools.html')
    wait.until(lambda d: d.find_elements(By.CSS_SELECTOR, '#target-tab option'))
    Select(driver.find_element(By.ID, 'target-tab')).select_by_value(str(web_tab_id))
    driver.find_element(By.ID, 'page-dark').click()
    driver.switch_to.window(web_handle)
    wait.until(lambda d: d.execute_script('return !!document.querySelector("style.darkreader")'))
    driver.switch_to.window(control_handle)
    driver.find_element(By.ID, 'page-original').click()
    driver.switch_to.window(web_handle)
    wait.until(lambda d: d.execute_script('return !document.querySelector("style.darkreader")'))
    driver.switch_to.window(control_handle)
    record('Bundled Dark Reader applies to a chosen real web tab and restores its original CSS')
    driver.find_element(By.ID, 'qr-text').send_keys('Çığ ışık: https://example.org/kaan')
    driver.find_element(By.ID, 'qr-create').click()
    wait.until(lambda d: d.find_element(By.ID, 'qr-image').is_displayed())
    encoded = driver.find_element(By.ID, 'qr-image').get_attribute('src').split(',', 1)[1]
    import io
    from PIL import Image
    import zxingcpp
    decoded = zxingcpp.read_barcode(Image.open(io.BytesIO(base64.b64decode(encoded))))
    assert decoded.text == 'Çığ ışık: https://example.org/kaan', decoded
    driver.save_screenshot(str(ARTIFACTS / 'local-qr.png'))
    record('A locally generated QR decodes to the exact UTF-8 Turkish input')



    driver.find_element(By.ID,'remember-style').click()
    driver.find_element(By.ID,'page-dark').click()
    driver.switch_to.window(web_handle);driver.refresh()
    wait.until(lambda d:d.execute_script('return !!document.querySelector("style.darkreader")'))
    driver.switch_to.window(control_handle)
    Select(driver.find_element(By.ID,'site-font')).select_by_value('opendyslexic')
    driver.find_element(By.ID,'apply-site-font').click()
    driver.switch_to.window(web_handle)
    wait.until(lambda d:d.execute_script('return getComputedStyle(document.getElementById("selected")).fontFamily.includes("AionSiteOpenDyslexic")'))
    driver.switch_to.window(control_handle);driver.find_element(By.ID,'page-light').click()
    driver.switch_to.window(web_handle)
    try:
        wait.until(lambda d:d.execute_script('return parseInt(getComputedStyle(document.body).backgroundColor.match(/[0-9]+/)[0])>150;'))
    except Exception:
        print('Light-mode diagnostic:',driver.execute_script('return {background:getComputedStyle(document.body).backgroundColor,styles:[...document.querySelectorAll("style.darkreader")].map(s=>({classes:s.className,text:s.textContent.slice(0,1000)}))};'),flush=True)
        driver.save_screenshot(str(ARTIFACTS/'light-mode-failure.png'));raise
    assert driver.execute_script('return getComputedStyle(document.getElementById("selected")).fontFamily.includes("AionSiteOpenDyslexic")')
    driver.switch_to.window(control_handle);driver.find_element(By.ID,'page-original').click()
    driver.switch_to.window(web_handle);driver.refresh()
    wait.until(lambda d:d.execute_script('return !document.querySelector("style.darkreader")'))
    assert 'AionSiteOpenDyslexic' not in driver.execute_script('return getComputedStyle(document.getElementById("selected")).fontFamily')
    driver.switch_to.window(control_handle)
    record('Opt-in site appearance persists on reload, font stays independent of dark/light mode, and reset restores the site')
    driver.switch_to.new_window('tab'); frame_handle=driver.current_window_handle
    host_url=f'http://127.0.0.1:{server.server_port}/frame-host.html'
    driver.get(host_url)
    wait.until(lambda d:d.execute_script('return document.querySelector("iframe").contentDocument===null;'))
    driver.switch_to.frame(driver.find_element(By.TAG_NAME,'iframe'))
    driver.find_element(By.ID,'start').click()
    wait.until(lambda d:d.execute_script('return document.querySelector("video").videoWidth')==320)
    driver.switch_to.default_content();driver.switch_to.window(control_handle)
    host_id=driver.execute_async_script('const [url,done]=arguments;browser.tabs.query({}).then(tabs=>done(tabs.find(t=>t.url===url).id));',host_url)
    frame_result=driver.execute_async_script('browser.runtime.sendMessage({type:"mediaTab",tabId:arguments[0],command:{action:"speed",value:1.65}}).then(arguments[1]);',host_id)
    assert frame_result['speed']==1.65,frame_result
    driver.switch_to.window(frame_handle);driver.switch_to.frame(driver.find_element(By.TAG_NAME,'iframe'))
    assert driver.execute_script('return document.querySelector("video").playbackRate')==1.65
    driver.switch_to.default_content()
    record('The packaged controller controls an actual cross-origin iframe video without weakening same-origin security')
    audio_url=f'http://127.0.0.1:{server.server_port}/audio.html'
    driver.get(audio_url);driver.find_element(By.ID,'play-audio').click()
    wait.until(lambda d:d.execute_script('return !document.querySelector("audio").paused'))
    driver.switch_to.window(control_handle)
    audio_id=driver.execute_async_script('const [url,done]=arguments;browser.tabs.query({}).then(tabs=>done(tabs.find(t=>t.url===url).id));',audio_url)
    audio_result=driver.execute_async_script('browser.runtime.sendMessage({type:"mediaTab",tabId:arguments[0],command:{action:"speed",value:2},remember:true}).then(arguments[1]);',audio_id)
    assert audio_result['speed']==2,audio_result
    driver.switch_to.window(frame_handle);assert driver.execute_script('return document.querySelector("audio").playbackRate')==2
    driver.refresh();driver.find_element(By.ID,'play-audio').click()
    wait.until(lambda d:d.execute_script('return document.querySelector("audio").playbackRate')==2)
    driver.close();driver.switch_to.window(control_handle)
    record('Real audio playback changes to 2x and an explicitly saved site speed survives navigation')
    driver.get(base + 'newtab.html')
    wait.until(lambda d: d.execute_script('return !!document.querySelector("#fireaxolotl-runner")?.shadowRoot.querySelector("canvas")'))
    def game(script):
        return driver.execute_script('const root=document.querySelector("#fireaxolotl-runner").shadowRoot;' + script)
    wait.until(lambda d: game('return !root.querySelector("[data-action=play]").disabled;'))
    assert game('return root.querySelector("canvas").dataset.state') == 'ready'
    game('root.querySelector("[data-action=play]").click();')
    quick = WebDriverWait(driver, 12, poll_frequency=0.025)
    quick.until(lambda d: game('return Number(root.querySelector("canvas").dataset.obstacleX) < 210 && Number(root.querySelector("canvas").dataset.obstacleX) > 190;'))
    canvas = driver.execute_script('return document.querySelector("#fireaxolotl-runner").shadowRoot.querySelector("canvas")')
    assert game('return root.activeElement === root.querySelector("canvas");'), "Game canvas lost keyboard focus"
    game('root.querySelector("canvas").addEventListener("keydown", e => { window.aionTestJump = {code:e.code, ...root.querySelector("canvas").dataset}; }, {once:true});')
    ActionChains(driver).send_keys(Keys.SPACE).perform()
    try:
        quick.until(lambda d: game('return Number(root.querySelector("canvas").dataset.score) >= 1;'))
    except Exception:
        print("Jump timing diagnostic:", game('return {key:window.aionTestJump,current:{...root.querySelector("canvas").dataset}};'), flush=True)
        raise
    ActionChains(driver).send_keys(Keys.ESCAPE).perform()
    assert game('return root.querySelector("canvas").dataset.state') == 'paused'
    game('root.querySelector("[data-action=play]").click();')
    wait.until(lambda d: game('return ["ice","fire"].includes(root.querySelector("canvas").dataset.state);'))
    wait.until(lambda d: d.execute_async_script('browser.storage.local.get("aionRunnerBest").then(x=>arguments[0](x.aionRunnerBest>=1));'))
    driver.refresh()
    wait.until(lambda d: d.execute_script('return document.querySelector("#fireaxolotl-runner")?.shadowRoot.querySelector(".best").textContent.includes("1");'))
    driver.save_screenshot(str(ARTIFACTS / 'offline-runner.png'))
    record('A real keyboard jump clears an obstacle, Escape pauses, and earned game record survives reopening')
    driver.set_context('chrome'); driver.execute_script('Services.io.offline = true'); driver.set_context('content')
    driver.refresh()
    wait.until(lambda d: d.execute_script('return !!document.querySelector("#fireaxolotl-runner")?.shadowRoot.querySelector("canvas")'))
    game('root.querySelector(".hide").click();')
    wait.until(lambda d: not d.find_elements(By.ID, 'fireaxolotl-runner'))
    assert driver.find_element(By.ID, 'search').is_enabled()
    driver.set_context('chrome'); driver.execute_script('Services.io.offline = false'); driver.set_context('content')
    record('New-tab game loads offline and can be hidden without removing the main search control')
    driver.get(base + 'settings.html')
    wait.until(lambda d: d.find_element(By.TAG_NAME, 'body').get_attribute('data-ready') == 'true')
    wait.until(lambda d: d.execute_script('return !!globalThis.UI?.settings'))
    if driver.find_element(By.CSS_SELECTOR, '[data-setting="browserTheme"]').is_selected():
        driver.find_element(By.CSS_SELECTOR, '[data-setting="browserTheme"]').click(); saved('browserTheme', False)
    assert driver.execute_async_script('browser.theme.getCurrent().then(theme=>arguments[0](Object.keys(theme.colors||{}).length));') == 0
    driver.find_element(By.CSS_SELECTOR, '[data-setting="browserTheme"]').click(); saved('browserTheme', True)
    wait.until(lambda d: d.execute_async_script('browser.theme.getCurrent().then(theme=>arguments[0](!!theme.colors?.toolbar));'))
    record('Browser color theme can be independently released and reapplied')



    backup_file=downloads/'fire-axolotl-settings.json';backup_file.unlink(missing_ok=True)
    driver.find_element(By.ID,'export').click()
    def settings_backup():
        try:return json.loads(backup_file.read_text())
        except (OSError,ValueError):return None
    wait.until(lambda d:bool(settings_backup()))
    snapshot=settings_backup();assert snapshot['format']=='fire-axolotl' and snapshot['version']==1
    assert snapshot['local']['aionMediaSites'][f'http://127.0.0.1:{server.server_port}']==2
    assert 'aionSyncEnabled' not in snapshot['local']
    driver.execute_async_script('browser.storage.local.set({aionMediaSites:{}}).then(()=>arguments[0](true));')
    driver.find_element(By.ID,'import').send_keys(str(backup_file))
    wait.until(EC.alert_is_present()).accept()
    wait.until(lambda d:d.execute_async_script('browser.storage.local.get("aionMediaSites").then(x=>arguments[0](Object.values(x.aionMediaSites||{}).includes(2)));'))
    record('Real JSON settings export/import restores saved site speed and excludes cloud-consent state')
    driver.find_element(By.CSS_SELECTOR,'input[data-module="video"]').click()
    wait.until(lambda d:d.execute_script('return UI.settings.disabledModules.includes("video");'))
    driver.get(base+'popup.html')
    wait.until(lambda d:d.find_element(By.TAG_NAME,'body').get_attribute('data-ready')=='true')
    assert not driver.find_element(By.CSS_SELECTOR,'section[data-module="video"]').is_displayed()
    driver.get(base+'settings.html')
    wait.until(lambda d:d.find_elements(By.CSS_SELECTOR,'input[data-module="video"]'))
    driver.find_element(By.CSS_SELECTOR,'input[data-module="video"]').click()
    wait.until(lambda d:not d.execute_script('return UI.settings.disabledModules.includes("video");'))
    driver.find_element(By.ID,'sync-enabled').click()
    driver.find_element(By.ID,'sync-push').click()
    wait.until(lambda d:d.execute_async_script('browser.storage.sync.get("aionPreferences").then(x=>arguments[0](!!x.aionPreferences));'))
    words=driver.execute_script('return UI.settings.vocabulary;')
    Select(driver.find_element(By.ID,'language')).select_by_value('tr');saved('language','tr')
    driver.find_element(By.ID,'sync-pull').click();saved('language','en')
    assert driver.execute_script('return UI.settings.vocabulary;')==words
    record('A module disables and re-enables through normal settings; opt-in storage.sync restores preferences without replacing vocabulary')
    # Reopen the toolbar surface after typing, and exercise a real network failure.
    value('endpoint', 'https://aion-test.invalid/translate')
    driver.find_element(By.ID, 'save-endpoint').click()
    saved('endpoint', 'https://aion-test.invalid/translate')
    driver.get(base + 'popup.html')
    wait.until(lambda d: d.execute_script('return !!globalThis.UI?.settings'))
    wait.until(lambda d: d.find_element(By.TAG_NAME, 'body').get_attribute('data-ready') == 'true')
    value('source-text', 'Taslak korunur · test draft')
    wait.until(lambda d: d.execute_async_script('browser.storage.local.get("aionDraft").then(x=>arguments[0](x.aionDraft==="Taslak korunur · test draft"));'))
    driver.refresh()
    wait.until(lambda d: d.find_element(By.ID, 'source-text').get_attribute('value') == 'Taslak korunur · test draft')
    driver.find_element(By.ID, 'translate').click()
    WebDriverWait(driver, 30).until(lambda d: d.find_element(By.ID, 'translate').is_enabled())
    assert driver.find_element(By.ID, 'status').get_attribute('data-error') == 'true'
    assert driver.find_element(By.ID, 'source-text').get_attribute('value') == 'Taslak korunur · test draft'
    record('Translation draft survives reopening and an actual unavailable-endpoint failure')
    kept = driver.execute_async_script('browser.storage.local.get(["settings","aionRunnerBest","aionDraft","aionSidebarCompanions"]).then(arguments[0]);')
    cleared = driver.execute_async_script('browser.runtime.getBackgroundPage().then(w=>w.vAPI.storage.clear()).then(()=>browser.storage.local.get(["settings","aionRunnerBest","aionDraft","aionSidebarCompanions"])).then(arguments[0]);')
    assert cleared == kept
    record('Integrated blocker storage reset preserves Aion settings, record, draft and sidebar choice')

    before = set(driver.window_handles)
    driver.execute_async_script('browser.tabs.create({}).then(()=>arguments[0](true));')
    wait.until(lambda d: len(set(d.window_handles) - before) == 1)
    driver.switch_to.window(next(iter(set(driver.window_handles) - before)))
    wait.until(lambda d: d.execute_script('return location.href.includes("/aion/newtab.html") && !!document.getElementById("search");'))
    record('A normal new-tab creation opens the registered extension new-tab entry point')

finally:
    (ARTIFACTS / 'results.json').write_text(json.dumps({'mode': 'single-extension-stock-firefox', 'passed': results}, ensure_ascii=False, indent=2) + '\n')
    driver.quit()
    server.shutdown()
