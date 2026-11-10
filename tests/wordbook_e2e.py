# SPDX-License-Identifier: MPL-2.0
"""Normal popup entry, offline vocabulary CRUD, real JSON files and accessibility."""
import json
import os
from pathlib import Path
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.common.keys import Keys
from selenium.webdriver.firefox.options import Options
from selenium.webdriver.firefox.service import Service
from selenium.webdriver.support.ui import Select,WebDriverWait

ROOT=Path(__file__).resolve().parents[1];out=ROOT/'work/wordbook-test-artifacts';out.mkdir(parents=True,exist_ok=True)
o=Options();o.binary_location=os.environ['AION_FIREFOX_BINARY'];o.add_argument('-headless');o.accept_insecure_certs=False
o.set_preference('remote.prefs.recommended',False);o.set_preference('dom.file.createInChild',True)
o.set_preference('browser.download.folderList',2);o.set_preference('browser.download.dir',str(out.resolve()));o.set_preference('browser.download.useDownloadDir',True);o.set_preference('browser.helperApps.neverAsk.saveToDisk','application/json')
d=webdriver.Firefox(options=o,service=Service(os.environ['AION_GECKODRIVER'],service_args=['--allow-system-access'],log_output=str(out/'geckodriver.log')));w=WebDriverWait(d,40);passed=[]
def ready():w.until(lambda _:d.find_element(By.TAG_NAME,'body').get_attribute('data-ready')=='true')
def request(message):return d.execute_async_script('const [m,done]=arguments;browser.runtime.sendMessage(m).then(done,e=>done({error:e.message}));',message)
def state():return request({'type':'settings'})
def control(id):return d.find_element(By.ID,id)
def idle():w.until(lambda _:not control('word-export').get_attribute('disabled'))
def search(text):
    e=control('word-search');e.send_keys(Keys.CONTROL,'a');e.send_keys(text or Keys.BACKSPACE)
    w.until(lambda _:e.get_attribute('value')==text)
def add(text):
    control('word-input').send_keys(text);control('word-add').click();w.until(lambda _:text in state()['vocabulary']);idle()
def choose_backup(name,words,extra=None):
    p=out/name;p.write_text(json.dumps({'format':'fire-axolotl-vocabulary','version':1,'words':words,**(extra or {})},ensure_ascii=False),encoding='utf-8')
    control('word-import').send_keys(str(p.resolve()));w.until(lambda _:control('word-preview').is_displayed());idle();return p
def merge():control('word-import-apply').click();w.until(lambda _:not control('word-preview').is_displayed());idle()
def theme_setting(id,value):
    Select(control(id)).select_by_value(value);w.until(lambda _:d.execute_script('return UI.settings[arguments[0]];',id)==value)
try:
    d.set_window_size(1200,1050)
    version=json.loads((ROOT/'browser/extension/manifest.json').read_text())['version'];addon=d.install_addon(str(ROOT/f'dist/fire-axolotl-extension-{version}-unsigned.xpi'),temporary=True)
    d.set_context('chrome');uuid=d.execute_script("return JSON.parse(Services.prefs.getStringPref('extensions.webextensions.uuids'))[arguments[0]]",addon);d.execute_script('Services.io.offline=true');d.set_context('content');base=f'moz-extension://{uuid}/aion/'
    d.get(base+'popup.html');ready();popup=d.current_window_handle
    before=set(d.window_handles);control('settings').click();w.until(lambda _:len(set(d.window_handles)-before)==1);settings=next(iter(set(d.window_handles)-before));d.switch_to.window(settings);ready();theme_setting('language','tr');d.switch_to.window(popup);w.until(lambda _:d.find_element(By.TAG_NAME,'html').get_attribute('lang')=='tr')
    control('source-text').send_keys('Işık');control('save-word').click();w.until(lambda _:'Işık' in state()['vocabulary'])
    before=set(d.window_handles);control('open-wordbook').click();w.until(lambda _:len(set(d.window_handles)-before)==1);book=next(iter(set(d.window_handles)-before));d.switch_to.window(book);ready()
    assert d.execute_script('return browser.runtime.getManifest().version')==version
    assert d.find_element(By.TAG_NAME,'html').get_attribute('lang')=='tr'
    add('İyi günler! Çığ, ıslak öğün.');add('<img src=x onerror=alert(1)>');assert not d.find_elements(By.CSS_SELECTOR,'#words img')
    search('ışık');w.until(lambda _:len(d.find_elements(By.CSS_SELECTOR,'#words li'))==1)
    control('words').find_element(By.TAG_NAME,'button').send_keys(Keys.ENTER);w.until(lambda _:'Işık' not in state()['vocabulary']);idle()
    assert d.execute_script('return document.activeElement.id')=='word-undo'
    d.switch_to.window(popup);control('source-text').clear();control('source-text').send_keys('concurrent word');control('save-word').click();w.until(lambda _:'concurrent word' in state()['vocabulary'])
    d.switch_to.window(book);control('word-undo').send_keys(Keys.ENTER);w.until(lambda _:'Işık' in state()['vocabulary']);idle();assert 'concurrent word' in state()['vocabulary'] and control('word-search').get_attribute('value')=='ışık'
    passed.append('The normal popup opens the offline vocabulary page; Turkish case search, literal markup, keyboard removal/undo and a word saved in another page preserve each other')
    search('');before_words=state()['vocabulary'];incoming=before_words+['reading '+str(n) for n in range(120)]+['reading 0']
    choose_backup('pages.json',incoming,{'settings':{'theme':'light','endpoint':'https://untrusted.example/translate'}});assert state()['vocabulary']==before_words
    merge();assert len(state()['vocabulary'])==len(before_words)+120 and state()['theme']=='dark' and state()['endpoint']==''
    w.until(lambda _:len(d.find_elements(By.CSS_SELECTOR,'#words li'))==50);control('word-next').click();assert control('word-page').text=='2 / 3';control('word-previous').click();assert control('word-page').text=='1 / 3'
    assert 'Atlanan aynı kayıt: 5' in control('word-import-result').text and '120' in control('word-import-result').text
    bad=out/'invalid.json';bad.write_text('{"format":"fire-axolotl-vocabulary","version":1,"words":["okay",null]}');control('word-import').send_keys(str(bad.resolve()));w.until(lambda _:control('status').get_attribute('data-error')=='true');assert not control('word-preview').is_displayed() and len(state()['vocabulary'])==124
    choose_backup('cancel.json',['not imported']);control('word-import-cancel').click();assert 'not imported' not in state()['vocabulary']
    passed.append('A real JSON file previews without writes, merges 120 new records while skipping duplicates and ignoring injected settings, paginates at 50 rows, and invalid/cancelled files leave data unchanged')
    existing_downloads=set(out.glob('fire-axolotl-vocabulary*.json'))
    control('word-export').click();w.until(lambda _:control('word-download').is_displayed());idle()
    exported=d.execute_async_script('fetch(document.getElementById("word-download").href).then(r=>r.json()).then(arguments[0]);')
    assert set(exported)=={'format','version','words'} and exported['words']==state()['vocabulary']
    w.until(lambda _:bool(set(out.glob('fire-axolotl-vocabulary*.json'))-existing_downloads))
    downloaded=next(iter(set(out.glob('fire-axolotl-vocabulary*.json'))-existing_downloads));assert json.loads(downloaded.read_text())==exported
    search('concurrent word');control('words').find_element(By.TAG_NAME,'button').click();w.until(lambda _:'concurrent word' not in state()['vocabulary']);idle()
    control('word-import').send_keys(str(downloaded.resolve()));w.until(lambda _:control('word-preview').is_displayed());merge();assert state()['vocabulary'].count('concurrent word')==1
    passed.append('The browser downloads an actual UTF-8 word-only JSON backup; importing that exported file restores a removed entry without duplicating existing words or exporting settings/drafts')
    search('İyi');control('word-input').send_keys('Taslak korunmalı ÇĞİÖŞÜ')
    control('open-settings').click();d.switch_to.window(settings);ready()
    theme_setting('language','en');theme_setting('font','opendyslexic');theme_setting('theme','contrast')
    for id,value in [('scale-number',200),('textSize-number',140)]:control(id).send_keys(Keys.CONTROL,'a');control(id).send_keys(str(value),Keys.TAB);w.until(lambda _:state()['scale' if id.startswith('scale') else 'textSize']==value)
    d.switch_to.window(book);w.until(lambda _:d.find_element(By.TAG_NAME,'html').get_attribute('lang')=='en');assert control('word-search').get_attribute('value')=='İyi' and control('word-input').get_attribute('value')=='Taslak korunmalı ÇĞİÖŞÜ'
    d.set_window_size(500,1050);assert d.execute_script('return document.documentElement.scrollWidth<=innerWidth+1')
    assert d.execute_script('return getComputedStyle(document.body).fontFamily.includes("OpenDyslexic") && document.documentElement.dataset.theme==="contrast"')
    assert d.execute_async_script('document.fonts.ready.then(()=>arguments[0](document.fonts.check("16px OpenDyslexic")));')
    control('word-add').click();w.until(lambda _:'Taslak korunmalı ÇĞİÖŞÜ' in state()['vocabulary']);idle();d.save_screenshot(str(out/'wordbook-en-200-narrow.png'))
    d.switch_to.window(settings);theme_setting('language','tr');theme_setting('font','system');theme_setting('theme','dark');control('reset-scale').click();control('reset-text').click();w.until(lambda _:state()['scale']==100 and state()['textSize']==100)
    d.switch_to.window(book);d.set_window_size(1200,1050);w.until(lambda _:d.find_element(By.TAG_NAME,'html').get_attribute('lang')=='tr');search('');d.save_screenshot(str(out/'wordbook-tr.png'))
    passed.append('Real settings controls switch TR/EN, dark/high-contrast, OpenDyslexic, 200% UI and independent 140% text; the narrow page stays usable and preserves its filter and draft')
    current=state()['vocabulary'];full=current+['capacity-'+str(n) for n in range(5000-len(current))];choose_backup('full.json',full);merge();assert len(state()['vocabulary'])==5000 and len(d.find_elements(By.CSS_SELECTOR,'#words li'))==50
    control('word-input').send_keys('must not disappear');control('word-add').click();w.until(lambda _:control('status').get_attribute('data-error')=='true');idle();assert '5.000' in control('status').text and control('word-input').get_attribute('value')=='must not disappear' and 'must not disappear' not in state()['vocabulary']
    choose_backup('overflow.json',['one overflow']);control('word-import-apply').click();w.until(lambda _:control('status').get_attribute('data-error')=='true');idle();assert control('word-preview').is_displayed() and len(state()['vocabulary'])==5000;control('word-import-cancel').click()
    d.switch_to.window(popup);control('source-text').clear();control('source-text').send_keys('popup overflow');control('save-word').click();w.until(lambda _:control('status').get_attribute('data-error')=='true');assert '5.000' in control('status').text and len(state()['vocabulary'])==5000
    d.switch_to.window(settings);d.refresh();ready();assert len(d.find_elements(By.CSS_SELECTOR,'#word-list li'))==50
    passed.append('A 5,000-entry import stays paginated; full-capacity manual/popup/import attempts report errors without false success, losing records or clearing the draft/preview; settings render only 50 preview rows')
    # Disable Translation through its normal settings checkbox. Existing private
    # data management remains usable without enabling inference or cloud access.
    toggle=d.find_element(By.CSS_SELECTOR,'input[data-module=translation]');toggle.click();w.until(lambda _:'translation' in state()['disabledModules'])
    d.switch_to.window(book);w.until(lambda _:not control('word-add').is_enabled());search('Işık');control('words').find_element(By.TAG_NAME,'button').click();w.until(lambda _:'Işık' not in state()['vocabulary']);idle();control('word-undo').click();w.until(lambda _:'Işık' in state()['vocabulary']);idle()
    d.refresh();ready();assert len(state()['vocabulary'])==5000 and not control('word-add').is_enabled();assert request({'type':'localAI','action':'status'})['phase']=='unloaded'
    passed.append('With Translation disabled, saved data remains searchable, removable and restorable; reopening preserves all records and no AI engine was loaded during the offline workflow')
    print('PASS',json.dumps(passed),flush=True)
except Exception:
    d.save_screenshot(str(out/'failure.png'));raise
finally:
    (out/'results.json').write_text(json.dumps({'passed':passed},ensure_ascii=False,indent=2)+'\n');d.quit()
