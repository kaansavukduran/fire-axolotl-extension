# SPDX-License-Identifier: MPL-2.0
"""Real Firefox selection, close confirmation and optional sessions permission."""
import os,json
from pathlib import Path
from threading import Thread
from http.server import BaseHTTPRequestHandler,ThreadingHTTPServer
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.firefox.options import Options
from selenium.webdriver.firefox.service import Service
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
ROOT=Path(__file__).resolve().parents[1];out=ROOT/'work/tab-manager-test-artifacts';out.mkdir(parents=True,exist_ok=True)
class Fixture(BaseHTTPRequestHandler):
    def do_GET(self):
        b=f'<!doctype html><title>Tab manager fixture {self.path}</title><h1>Tab manager fixture {self.path}</h1>'.encode();self.send_response(200);self.send_header('Content-Length',str(len(b)));self.end_headers();self.wfile.write(b)
    def log_message(self,*_):pass
server=ThreadingHTTPServer(('127.0.0.1',0),Fixture);Thread(target=server.serve_forever,daemon=True).start()
o=Options();o.binary_location=os.environ['AION_FIREFOX_BINARY'];o.add_argument('-headless');o.accept_insecure_certs=False;o.set_preference('remote.prefs.recommended',False)
d=webdriver.Firefox(options=o,service=Service(os.environ['AION_GECKODRIVER'],service_args=['--allow-system-access'],log_output=str(out/'geckodriver.log')));w=WebDriverWait(d,30);passed=[]
try:
    d.set_window_size(1280,1000)
    version=json.loads((ROOT/'browser/extension/manifest.json').read_text())['version']
    addon=d.install_addon(str(ROOT/f'dist/fire-axolotl-extension-{version}-unsigned.xpi'),temporary=True)
    d.set_context('chrome');uuid=d.execute_script("return JSON.parse(Services.prefs.getStringPref('extensions.webextensions.uuids'))[arguments[0]]",addon);d.set_context('content');d.get(f'moz-extension://{uuid}/aion/sidebar.html')
    w.until(lambda _:d.find_element(By.TAG_NAME,'body').get_attribute('data-ready')=='true')
    assert not d.execute_async_script('browser.permissions.contains({permissions:["sessions"]}).then(arguments[0]);')
    url=f'http://127.0.0.1:{server.server_port}'
    ids=d.execute_async_script('Promise.all(["/one","/two"].map(path=>browser.tabs.create({url:arguments[0]+path,active:false}))).then(tabs=>arguments[1](tabs.map(t=>t.id)));',url)
    d.find_element(By.ID,'filter').send_keys('Tab manager fixture');w.until(lambda _:len(d.find_elements(By.CSS_SELECTOR,'.tab-row'))==2)
    d.find_element(By.ID,'select-visible').click();w.until(lambda _:not d.find_element(By.ID,'close-selected').get_attribute('disabled'))
    assert len(d.find_elements(By.CSS_SELECTOR,'.tab-row input:checked'))==2
    d.find_element(By.ID,'filter').clear();d.find_element(By.ID,'filter').send_keys('Tab manager fixture /one')
    w.until(lambda _:len(d.find_elements(By.CSS_SELECTOR,'.tab-row'))==1)
    assert not d.find_element(By.ID,'close-selected').is_enabled()
    d.find_element(By.ID,'filter').clear();d.find_element(By.ID,'filter').send_keys('Tab manager fixture');w.until(lambda _:len(d.find_elements(By.CSS_SELECTOR,'.tab-row'))==2)
    d.find_element(By.ID,'select-visible').click();d.find_element(By.ID,'close-selected').click();w.until(EC.alert_is_present()).dismiss()
    assert d.execute_async_script('const [ids,done]=arguments;browser.tabs.query({}).then(t=>done(ids.every(id=>t.some(x=>x.id===id))));',ids)
    d.find_element(By.ID,'close-selected').click();w.until(EC.alert_is_present()).accept()
    w.until(lambda _:d.execute_async_script('const [ids,done]=arguments;browser.tabs.query({}).then(t=>done(ids.every(id=>!t.some(x=>x.id===id))));',ids))
    passed.append('Visible-only selection, filter resets, cancel and confirmed batch close preserve unrelated tabs')
    d.find_element(By.ID,'restore-tab').click();d.set_context('chrome')
    w.until(lambda _:d.execute_script('return document.getElementById("notification-popup")?.state === "open" && !!document.getElementById("addon-webext-permissions-notification")?.button;'))
    d.execute_script('window.focus();')
    w.until(lambda _:d.execute_script('return Services.focus.activeWindow===window && !document.getElementById("addon-webext-permissions-notification").matches(":-moz-window-inactive");'))
    node=d.execute_script('return document.getElementById("addon-webext-permissions-notification").secondaryButton;')
    if not node:
        print(d.execute_script('return [...document.querySelectorAll("#notification-popup button")].map(x=>({id:x.id,label:x.label,text:x.textContent,cls:x.className}));'),flush=True)
        raise AssertionError('Permission deny button unavailable')
    w.until(lambda _:d.execute_script('return !arguments[0].disabled && !arguments[0].shadowRoot.querySelector("button").disabled;',node))
    w.until(lambda _:d.execute_script('const n=document.getElementById("addon-webext-permissions-notification");return ChromeUtils.now()-n.notification.timeShown > Services.prefs.getIntPref("security.notification_enable_delay",1000)+100;'))
    d.execute_script('arguments[0].shadowRoot.querySelector("button").click();',node)
    d.set_context('content')
    w.until(lambda _:d.find_element(By.ID,'status').get_attribute('data-error')=='true')
    assert not d.execute_async_script('browser.permissions.contains({permissions:["sessions"]}).then(arguments[0]);')
    passed.append('Denying optional sessions permission keeps it ungranted')
    d.find_element(By.ID,'restore-tab').click();d.set_context('chrome')
    w.until(lambda _:d.execute_script('return document.getElementById("notification-popup")?.state === "open" && !!document.getElementById("addon-webext-permissions-notification")?.button;'))
    d.execute_script('window.focus();')
    w.until(lambda _:d.execute_script('return Services.focus.activeWindow===window && !document.getElementById("addon-webext-permissions-notification").matches(":-moz-window-inactive");'))
    w.until(lambda _:d.execute_script('const n=document.getElementById("addon-webext-permissions-notification");return ChromeUtils.now()-n.notification.timeShown > Services.prefs.getIntPref("security.notification_enable_delay",1000)+100;'))
    d.execute_script('document.getElementById("addon-webext-permissions-notification").button.shadowRoot.querySelector("button").click();');d.set_context('content')
    w.until(lambda _:d.execute_async_script('const [url,done]=arguments;browser.tabs.query({}).then(t=>done(t.some(x=>x.url?.startsWith(url))));',url))
    assert d.execute_async_script('browser.permissions.contains({permissions:["sessions"]}).then(arguments[0]);')
    # Restoring activates the tab; switch back to the extension controller.
    controller=next(h for h in d.window_handles if h==d.current_window_handle);d.switch_to.window(controller)
    w.until(lambda _:d.find_element(By.ID,'revoke-sessions').is_displayed());d.find_element(By.ID,'revoke-sessions').click()
    w.until(lambda _:not d.execute_async_script('browser.permissions.contains({permissions:["sessions"]}).then(arguments[0]);'))
    passed.append('Granting through Firefox restores a real closed tab; revocation removes permission')
    d.set_window_size(480,900)
    assert d.execute_script('return document.documentElement.scrollWidth<=innerWidth+2;')
    d.save_screenshot(str(out/'tab-manager.png'));print('PASS',json.dumps(passed),flush=True)
finally:
    (out/'results.json').write_text(json.dumps({'passed':passed},indent=2)+'\n');d.quit();server.shutdown()
