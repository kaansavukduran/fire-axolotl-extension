# SPDX-License-Identifier: MPL-2.0
"""Stock Firefox DOM translation plumbing. Fixed strings test application safety,
not model accuracy; actual offline model/UI coverage lives in m2m_e2e.py.
"""
import json
import os
from pathlib import Path
from threading import Thread
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import Select, WebDriverWait
from selenium.webdriver.firefox.options import Options
from selenium.webdriver.firefox.service import Service

ROOT = Path(__file__).resolve().parents[1]
out = ROOT / 'work/page-translation-test-artifacts'
out.mkdir(parents=True, exist_ok=True)

class Fixture(BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path == '/limit':
            html = '<!doctype html><title>Limit fixture</title>' + ''.join(f'<p>Rendered paragraph number {n}.</p>' for n in range(45))
        else:
            html = '''<!doctype html><meta charset="utf-8"><title>Page translation fixture</title>
            <p id="sentence">The cat is sleeping.</p><p id="dynamic">Keep this original line.</p>
            <button id="counter" onclick="this.dataset.clicked='yes'">Count clicks</button>
            <div role="dialog"><p id="dialog-text">Hello, how are you?</p></div>
            <p hidden>hidden attribute secret</p><p style="display:none">display secret</p><p style="visibility:hidden">visibility secret</p>
            <div style="opacity:0"><p>transparent secret</p></div>
            <p translate="no">untranslated secret</p><div contenteditable="true">editable secret</div>
            <input value="input secret"><input type="password" value="password secret"><textarea>textarea secret</textarea>
            <pre>code secret</pre><svg><text>svg secret</text></svg><p>''' + 'L'*1001 + '''</p>
            <iframe srcdoc="<p>iframe secret</p>"></iframe><script>window.fixtureScript=true;</script>'''
        body = html.encode()
        self.send_response(200)
        self.send_header('Content-Type', 'text/html;charset=utf-8')
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        self.wfile.write(body)
    def log_message(self, *_): pass

server = ThreadingHTTPServer(('127.0.0.1', 0), Fixture)
Thread(target=server.serve_forever, daemon=True).start()
options = Options()
options.binary_location = os.environ['AION_FIREFOX_BINARY']
options.add_argument('-headless')
options.accept_insecure_certs = False
options.set_preference('remote.prefs.recommended', False)
driver = webdriver.Firefox(options=options, service=Service(os.environ['AION_GECKODRIVER'], service_args=['--allow-system-access'], log_output=str(out/'geckodriver.log')))
wait = WebDriverWait(driver, 30)
passed = []
def request(message):
    return driver.execute_async_script('const [m,done]=arguments;browser.runtime.sendMessage(m).then(done,e=>done({error:e.message}));', message)
def command(action, **args):
    return request({'type':'pageTranslation', 'tabId':target, 'command':{'action':action, **args}})
try:
    driver.set_window_size(1280, 1000)
    version = json.loads((ROOT/'browser/extension/manifest.json').read_text())['version']
    addon = driver.install_addon(str(ROOT/f'dist/fire-axolotl-extension-{version}-unsigned.xpi'), temporary=True)
    driver.set_context('chrome')
    uuid = driver.execute_script("return JSON.parse(Services.prefs.getStringPref('extensions.webextensions.uuids'))[arguments[0]]", addon)
    driver.set_context('content')
    driver.get(f'moz-extension://{uuid}/aion/ai.html')
    wait.until(lambda _:driver.find_element(By.TAG_NAME,'body').get_attribute('data-ready')=='true')
    controller = driver.current_window_handle
    driver.switch_to.new_window('tab')
    page = driver.current_window_handle
    url = f'http://127.0.0.1:{server.server_port}/'
    driver.get(url)
    driver.switch_to.window(controller)
    driver.find_element(By.ID,'page-refresh').click()
    target = driver.execute_async_script('const [url,done]=arguments;browser.tabs.query({}).then(t=>done(t.find(x=>x.url===url).id));', url)
    Select(driver.find_element(By.ID,'page-tab')).select_by_value(str(target))
    Select(driver.find_element(By.ID,'page-scope')).select_by_value('dialogs')
    driver.find_element(By.ID,'page-scan').click()
    wait.until(lambda _:driver.find_element(By.ID,'page-preview').get_attribute('value')=='Hello, how are you?')
    assert not driver.find_element(By.ID,'page-translate').is_enabled()
    Select(driver.find_element(By.ID,'page-scope')).select_by_value('page')
    driver.find_element(By.ID,'page-scan').click()
    wait.until(lambda _:'The cat is sleeping.' in driver.find_element(By.ID,'page-preview').get_attribute('value'))
    preview = driver.find_element(By.ID,'page-preview').get_attribute('value')
    assert 'secret' not in preview and 'L'*1001 not in preview
    passed.append('Normal AI UI previews website dialogs or page text without a model; hidden, editable, code and iframe text are excluded')
    snapshot = command('scan', scope='page')
    assert len(snapshot['items'])==4 and snapshot['limited']
    items = {item['text']:item['id'] for item in snapshot['items']}
    driver.switch_to.window(page)
    driver.execute_script('document.getElementById("dynamic").textContent="The website changed this line.";')
    driver.switch_to.window(controller)
    assert command('apply', token=snapshot['token'], id=items['Keep this original line.'], text='Do not overwrite') == {'applied':False}
    assert command('apply', token=snapshot['token'], id=items['The cat is sleeping.'], text='Kedi uyuyor.') == {'applied':True}
    assert command('apply', token=snapshot['token'], id=items['Count clicks'], text='Tıklamaları say') == {'applied':True}
    literal='<img src=x onerror="window.injected=true">'
    assert command('apply', token=snapshot['token'], id=items['Hello, how are you?'], text=literal) == {'applied':True}
    driver.switch_to.window(page)
    assert driver.find_element(By.ID,'sentence').text=='Kedi uyuyor.'
    assert driver.find_element(By.ID,'dialog-text').text==literal
    assert not driver.execute_script('return !!window.injected || !!document.querySelector("#dialog-text img");')
    driver.find_element(By.ID,'counter').click()
    assert driver.find_element(By.ID,'counter').get_attribute('data-clicked')=='yes'
    assert driver.find_element(By.CSS_SELECTOR,'input[type=password]').get_attribute('value')=='password secret'
    driver.execute_script('document.getElementById("sentence").textContent="A newer website update.";')
    driver.switch_to.window(controller)
    restored=command('restore')
    assert restored=={'restored':2,'skipped':1}, restored
    driver.switch_to.window(page)
    assert driver.find_element(By.ID,'sentence').text=='A newer website update.'
    assert driver.find_element(By.ID,'counter').text=='Count clicks'
    assert driver.find_element(By.ID,'dialog-text').text=='Hello, how are you?'
    driver.switch_to.window(controller)
    passed.append('Text-only application preserves DOM handlers and form values; apply and restore never overwrite newer website text')
    snapshot=command('scan',scope='dialogs')
    assert command('apply',token=snapshot['token'],id=0,text='Merhaba')['applied']
    fresh=command('scan',scope='dialogs')
    assert fresh['items'][0]['text']=='Hello, how are you?'
    assert command('apply',token=snapshot['token'],id=0,text='Stale')['error']=='pageScanExpired'
    driver.switch_to.window(page)
    driver.get(url+'limit')
    driver.switch_to.window(controller)
    assert command('apply',token=fresh['token'],id=0,text='Stale')['error']=='pageScanExpired'
    limited=command('scan',scope='page')
    assert len(limited['items'])==40 and limited['limited']
    passed.append('A fresh scan restores previous text; stale scans cannot write after rescanning or navigation; the 40-fragment bound holds')
    assert command('apply',token=limited['token'],id=0,text='Yerel örnek')['applied']
    request({'type':'save','patch':{'disabledModules':['ai']}})
    assert command('scan',scope='page')['error']=='moduleDisabled'
    assert command('restore')['restored']==1
    request({'type':'save','patch':{'disabledModules':[]}})
    passed.append('Disabling AI blocks page scans while allowing existing translations to be restored')
    driver.find_element(By.ID,'page-scan').click()
    wait.until(lambda _:'Rendered paragraph' in driver.find_element(By.ID,'page-preview').get_attribute('value'))
    driver.set_window_size(480,1000)
    driver.execute_script('document.getElementById("page-scope").scrollIntoView();')
    assert driver.execute_script('return document.documentElement.scrollWidth <= innerWidth+2;')
    driver.save_screenshot(str(out/'page-translation.png'))
    print('PASS',json.dumps(passed),flush=True)
finally:
    (out/'results.json').write_text(json.dumps({'passed':passed,'inference':'Fixed strings exercise DOM safety only; model accuracy is not asserted here.'},indent=2)+'\n')
    driver.quit()
    server.shutdown()
