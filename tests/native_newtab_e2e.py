# SPDX-License-Identifier: MPL-2.0
"""Verify the optional build preserves normal new tabs but still opens Aion Run."""
import json
import os
from pathlib import Path
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.firefox.options import Options
from selenium.webdriver.firefox.service import Service
from selenium.webdriver.support.ui import WebDriverWait
ROOT=Path(__file__).resolve().parents[1]
artifacts=ROOT/'work/native-newtab-test-artifacts';artifacts.mkdir(parents=True,exist_ok=True)
options=Options();options.binary_location=os.environ['AION_FIREFOX_BINARY'];options.add_argument('-headless');options.accept_insecure_certs=False
options.set_preference('remote.prefs.recommended',False)
driver=webdriver.Firefox(options=options,service=Service(os.environ['AION_GECKODRIVER'],service_args=['--allow-system-access'],log_output=str(artifacts/'geckodriver.log')))
wait=WebDriverWait(driver,30);results=[]
try:
    addon=driver.install_addon(str(ROOT/'dist/fire-axolotl-extension-0.7.0-native-newtab-unsigned.xpi'),temporary=True)
    driver.set_context('chrome');uuid=driver.execute_script("return JSON.parse(Services.prefs.getStringPref('extensions.webextensions.uuids'))[arguments[0]]",addon);driver.set_context('content')
    base=f'moz-extension://{uuid}/aion/'
    driver.get(base+'popup.html');wait.until(lambda d:d.find_element(By.TAG_NAME,'body').get_attribute('data-ready')=='true')
    controller=driver.current_window_handle;before=set(driver.window_handles)
    driver.execute_async_script('browser.tabs.create({}).then(()=>arguments[0](true));')
    wait.until(lambda d:len(set(d.window_handles)-before)==1);driver.switch_to.window(next(iter(set(driver.window_handles)-before)))
    wait.until(lambda d:d.current_url=='about:newtab')
    results.append('Native-newtab build preserves the normal Firefox new-tab entry point')
    driver.switch_to.window(controller);before=set(driver.window_handles)
    driver.find_element(By.ID,'open-game').click()
    wait.until(lambda d:len(set(d.window_handles)-before)==1);driver.switch_to.window(next(iter(set(driver.window_handles)-before)))
    wait.until(lambda d:d.execute_script('return !!document.getElementById("fireaxolotl-runner")?.shadowRoot.querySelector("canvas");'))
    results.append('Aion Run remains accessible explicitly from the toolbar popup')
    print('PASS',results,flush=True)
finally:
    (artifacts/'results.json').write_text(json.dumps({'passed':results},indent=2)+'\n');driver.quit()
