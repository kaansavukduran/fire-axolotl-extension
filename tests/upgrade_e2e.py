# SPDX-License-Identifier: MPL-2.0
"""Upgrade the verified 0.1.0 temporary add-on in an isolated stock Firefox profile."""
import hashlib
import json
import os
from pathlib import Path
from selenium import webdriver
from selenium.webdriver.firefox.options import Options
from selenium.webdriver.firefox.service import Service
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait

ROOT=Path(__file__).resolve().parents[1]
old=Path(os.environ['AION_PREVIOUS_XPI'])
assert hashlib.sha256(old.read_bytes()).hexdigest()=='cccc3b5208d0fb5c7bf1fd6b7dbaa91e14771374263f5ba76ac7ce9ed80d0aeb'
version=json.loads((ROOT/'browser/extension/manifest.json').read_text())['version']
new=ROOT/f'dist/fire-axolotl-extension-{version}-native-newtab-unsigned.xpi'
out=ROOT/'work/upgrade-test-artifacts';out.mkdir(parents=True,exist_ok=True)
options=Options();options.binary_location=os.environ['AION_FIREFOX_BINARY'];options.add_argument('-headless');options.accept_insecure_certs=False
options.set_preference('remote.prefs.recommended',False)
driver=webdriver.Firefox(options=options,service=Service(os.environ['AION_GECKODRIVER'],service_args=['--allow-system-access'],log_output=str(out/'geckodriver.log')))
wait=WebDriverWait(driver,60);results=[]
try:
    old_id=driver.install_addon(str(old.resolve()),temporary=True)
    driver.set_context('chrome')
    uuid=driver.execute_script("return JSON.parse(Services.prefs.getStringPref('extensions.webextensions.uuids'))[arguments[0]]",old_id)
    driver.set_context('content');base=f'moz-extension://{uuid}/'
    driver.get(base+'aion/settings.html')
    wait.until(lambda d:d.find_element(By.TAG_NAME,'body').get_attribute('data-ready')=='true')
    assert driver.execute_script('return browser.runtime.getManifest().version')=='0.1.0'
    driver.execute_async_script('''(async()=>{
      await browser.runtime.sendMessage({type:'save',patch:{theme:'light',aiSource:'en',aiTarget:'tr'}});
      await browser.storage.local.set({aionDraft:'Private sample',aionRunnerBest:7,aionMediaSites:{'https://example.org':1.5}});
      const cache=await caches.open('aion-upgrade-test');await cache.put('https://example.org/test',new Response('local cache sample'));
    })().then(()=>arguments[0](true),e=>arguments[0]({error:e.message}));''')
    driver.get(base+'1p-filters.html')
    wait.until(lambda d:d.execute_script('return !!globalThis.vAPI?.messaging'))
    driver.set_script_timeout(120)
    rule='||upgrade-test.example^'
    before=driver.execute_async_script('vAPI.messaging.send("dashboard",{what:"writeUserFilters",content:arguments[0]+"\\n",enabled:true,trusted:false}).then(arguments[1]);',rule)
    assert before is not None
    check=driver.execute_async_script('vAPI.messaging.send("dashboard",{what:"readUserFilters"}).then(arguments[0]);')
    assert rule in check['content']
    # Firefox closes old extension pages during an upgrade. Keep a normal tab
    # open so closing that page does not close the last browser window.
    driver.switch_to.new_window('tab');driver.get('about:blank')
    new_id=driver.install_addon(str(new.resolve()),temporary=True)
    assert old_id==new_id
    driver.set_context('chrome')
    new_uuid=driver.execute_script("return JSON.parse(Services.prefs.getStringPref('extensions.webextensions.uuids'))[arguments[0]]",new_id)
    driver.set_context('content');assert new_uuid==uuid
    driver.get(base+'aion/settings.html')
    wait.until(lambda d:d.find_element(By.TAG_NAME,'body').get_attribute('data-ready')=='true')
    assert driver.execute_script('return browser.runtime.getManifest().version')==version
    assert driver.execute_script('return UI.settings.theme')=='light'
    assert driver.execute_script('return UI.settings.aiSource')=='en'
    saved=driver.execute_async_script('browser.storage.local.get(["aionDraft","aionRunnerBest","aionMediaSites"]).then(arguments[0]);')
    assert saved['aionDraft']=='Private sample' and saved['aionRunnerBest']==7 and saved['aionMediaSites']['https://example.org']==1.5
    cached=driver.execute_async_script('caches.open("aion-upgrade-test").then(c=>c.match("https://example.org/test")).then(r=>r.text()).then(arguments[0]);')
    assert cached=='local cache sample'
    results.append(f'Real temporary 0.1.0→{version} upgrade preserves extension ID, settings, draft, game record, site rule and CacheStorage')
    driver.get(base+'1p-filters.html')
    wait.until(lambda d:d.execute_script('return !!globalThis.vAPI?.messaging'))
    after=driver.execute_async_script('vAPI.messaging.send("dashboard",{what:"readUserFilters"}).then(arguments[0]);')
    assert rule in after['content']
    results.append('Integrated blocker user filter survives the real temporary upgrade')
    print('PASS',json.dumps(results,ensure_ascii=False),flush=True)
finally:
    (out/'results.json').write_text(json.dumps({'passed':results,'previous_sha256':hashlib.sha256(old.read_bytes()).hexdigest(),'scope':'temporary developer installation; not an AMO signed update'},indent=2)+'\n')
    driver.quit()
