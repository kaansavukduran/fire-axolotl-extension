# SPDX-License-Identifier: MPL-2.0
"""Actual toolbar popup, full panel, context containers and local-AI onboarding.

Marionette cannot switch into a popup's XUL browser. Open the actual toolbar
button natively, inspect/operate its HTML controls through extension.getViews,
and capture its real process using WindowGlobalParent.drawSnapshot. Normal tab
and Firefox native-menu interactions use WebDriver controls, not player mocks.
"""
import base64,json,os,html
from pathlib import Path
from threading import Thread
from http.server import BaseHTTPRequestHandler,ThreadingHTTPServer
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.common.action_chains import ActionChains
from selenium.webdriver.common.keys import Keys
from selenium.webdriver.support.ui import Select,WebDriverWait
from selenium.webdriver.firefox.options import Options
from selenium.webdriver.firefox.service import Service
ROOT=Path(__file__).resolve().parents[1];out=ROOT/'work/usability-test-artifacts';out.mkdir(parents=True,exist_ok=True)
class Fixture(BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path=='/video.webm':body=(ROOT/'tests/fixtures/video.webm').read_bytes();kind='video/webm'
        else:
            cookie=html.escape(self.headers.get('Cookie',''))
            body=('''<!doctype html><meta charset="utf-8"><title>UX source</title><p id="cookies">'''+cookie+'''</p><input id="account" value="normal"><button id="login">Login</button><a id="link" href="/linked">Linked page</a><p id="sentence">The cat is sleeping.</p><button id="select">Select sentence</button><video controls muted loop src="/video.webm" style="width:640px"></video><button id="play">Play</button><script>document.getElementById('login').onclick=()=>{document.cookie='session='+document.getElementById('account').value+';path=/';document.getElementById('cookies').textContent=document.cookie};document.getElementById('select').onclick=()=>{const r=document.createRange();r.selectNodeContents(document.getElementById('sentence'));const s=getSelection();s.removeAllRanges();s.addRange(r)};document.getElementById('play').onclick=()=>document.querySelector('video').play();</script>''').encode();kind='text/html'
        self.send_response(200);self.send_header('Content-Type',kind);self.send_header('Content-Length',str(len(body)));self.end_headers();self.wfile.write(body)
    def log_message(self,*_):pass
server=ThreadingHTTPServer(('127.0.0.1',0),Fixture);Thread(target=server.serve_forever,daemon=True).start()
o=Options();o.binary_location=os.environ['AION_FIREFOX_BINARY'];o.add_argument('-headless');o.accept_insecure_certs=False;o.set_preference('remote.prefs.recommended',False)
d=webdriver.Firefox(options=o,service=Service(os.environ['AION_GECKODRIVER'],service_args=['--allow-system-access'],log_output=str(out/'geckodriver.log')));w=WebDriverWait(d,50);passed=[];metrics={}
def ready():w.until(lambda _:d.find_element(By.CSS_SELECTOR,'body').get_attribute('data-ready')=='true')
def request(m):return d.execute_async_script('const [m,done]=arguments;browser.runtime.sendMessage(m).then(done,e=>done({error:e.message}));',m)
def control(id):return d.find_element(By.ID,id)
def popup(js,*args):d.set_context('content');return d.execute_script('const p=browser.extension.getViews({type:"popup"}).find(v=>v.document.visibilityState==="visible");'+js,*args)
def toolbar():
    d.set_context('chrome');ActionChains(d).send_keys(Keys.ESCAPE).perform();node=d.execute_script('return [...document.querySelectorAll("toolbarbutton[data-extensionid]")].find(x=>x.getAttribute("data-extensionid")===arguments[0]&&x.id.endsWith("-BAP"));',addon);node.click()
    is_open=lambda _:d.execute_script('return [...document.querySelectorAll("browser[webextension-view-type=popup]")].some(b=>b.closest("panel")?.state==="open");')
    try:WebDriverWait(d,5).until(is_open)
    except Exception:
        print('NATIVE PANELS',d.execute_script('return {panels:[...document.querySelectorAll("panel")].filter(p=>p.state!=="closed").map(p=>({id:p.id,state:p.state})),button:arguments[0].outerHTML,customizable:typeof CustomizableUI};',node),flush=True)
        ActionChains(d).send_keys(Keys.ESCAPE).perform();node.click();w.until(is_open)
    print('NATIVE TOOLBAR OPEN',flush=True);d.set_context('content');w.until(lambda _:popup('return p?.document.body.dataset.ready==="true";'))
def capture(name):
    d.set_context('chrome');data=d.execute_async_script('const done=arguments[0],b=[...document.querySelectorAll("browser[webextension-view-type=popup]")].find(x=>x.closest("panel")?.state==="open");b.browsingContext.currentWindowGlobal.drawSnapshot(null,1,"white").then(bitmap=>{const c=document.createElementNS("http://www.w3.org/1999/xhtml","canvas");c.width=bitmap.width;c.height=bitmap.height;c.getContext("2d").drawImage(bitmap,0,0);done(c.toDataURL());});');(out/name).write_bytes(base64.b64decode(data.split(',',1)[1]));d.set_context('content')
def new_tab(before):w.until(lambda _:bool(set(d.window_handles)-before));handle=next(iter(set(d.window_handles)-before));d.set_context('content');d.switch_to.window(handle);return handle
def menu(kind,label):
    d.set_context('chrome');prefix='#tabContextMenu' if kind=='tab' else '#contentAreaContextMenu'
    # Firefox populates its grouped extension submenu asynchronously. Wait for
    # either visible entry before deciding whether to expand that group.
    entry=w.until(lambda _:next((e for e in d.find_elements(By.CSS_SELECTOR,prefix+' menu[label="Fire Axolotl Extension"],'+prefix+' menu[id*="aion-container-open"]') if e.is_displayed()),None))
    # Headless Marionette can hover an adjacent submenu while Firefox changes
    # selection-menu geometry. Open the visible native XUL menu itself.
    if entry.get_attribute('label')=='Fire Axolotl Extension':d.execute_script('arguments[0].openMenu(true);',entry)
    parent=w.until(lambda _:next((e for e in d.find_elements(By.CSS_SELECTOR,prefix+' menu[id*="aion-container-open"]') if e.is_displayed()),None));d.execute_script('arguments[0].openMenu(true);',parent)
    child=w.until(lambda _:next((e for e in parent.find_elements(By.CSS_SELECTOR,'menuitem') if e.get_attribute('label')==label and e.is_displayed()),None))
    # Marionette can hit the underlying page on a repeated XUL submenu click.
    # Invoke the visible Firefox menu item's own command; no addon API is mocked.
    d.execute_script('arguments[0].doCommand();document.querySelector(arguments[1]).hidePopup();',child,prefix);d.set_context('content')
try:
    d.set_window_size(1400,1000);version=json.loads((ROOT/'browser/extension/manifest.json').read_text())['version'];addon=d.install_addon(str(ROOT/f'dist/fire-axolotl-extension-{version}-unsigned.xpi'),temporary=True)
    d.set_context('chrome');uuid=d.execute_script("return JSON.parse(Services.prefs.getStringPref('extensions.webextensions.uuids'))[arguments[0]]",addon);d.set_context('content');base=f'moz-extension://{uuid}/aion/';url=f'http://127.0.0.1:{server.server_port}/'
    d.get(url);source=d.current_window_handle;control('login').click();control('play').click();w.until(lambda _:d.execute_script('return document.querySelector("video").videoWidth')==320)
    d.switch_to.new_window('tab');controller=d.current_window_handle;d.get(base+'popup.html');ready();request({'type':'save','patch':{'language':'tr','aiSource':'en','aiTarget':'tr'}})
    source_id=d.execute_async_script('const [url,done]=arguments;browser.tabs.query({}).then(t=>done(t.find(x=>x.url===url).id));',url)
    d.execute_async_script('browser.runtime.getBackgroundPage().then(bg=>{bg.__testContainerClicks=[];bg.browser.menus.onClicked.addListener((info,tab)=>{if(String(info.menuItemId).startsWith("aion-container"))bg.__testContainerClicks.push({id:info.menuItemId,tabId:tab.id,link:info.linkUrl});});arguments[0](true);});')
    toolbar();d.set_context('chrome');d.execute_script('Services.io.offline=true');d.set_context('content')
    metrics=popup('return {width:p.innerWidth,height:p.innerHeight,screenWidth:p.screen.availWidth,declaredWidth:p.document.documentElement.style.width,bodyRight:p.document.body.getBoundingClientRect().right,surface:p.document.documentElement.dataset.surface,visible:[...p.document.querySelectorAll("[data-module]")].filter(n=>!n.hidden).map(n=>n.dataset.module),buttonBottom:p.document.getElementById("auto-captions").getBoundingClientRect().bottom};')
    assert 600<=metrics['width']<=800 and metrics['height']<=600 and metrics['visible']==['translation'],metrics;assert metrics['buttonBottom']<=metrics['height'] and metrics['bodyRight']<=metrics['width']+1,metrics
    assert popup('return p.document.getElementById("local-model-status").textContent.includes("Hazır");');capture('toolbar-popup-tr.png')
    popup('const e=p.document.getElementById("source-text");e.value="The cat is sleeping.";e.dispatchEvent(new p.Event("input",{bubbles:true}));p.document.getElementById("translate-local").click();')
    w.until(lambda _:'kedi' in popup('return p.document.getElementById("translation-result").value;').lower());capture('toolbar-translation-tr.png')
    assert request({'type':'localAI','action':'status'})['modelKind']=='bergamot'
    passed.append('The actual toolbar button opens a wide task popup within Firefox’s 800 px limit with Translate visible; its own controls cold-start bundled EN/TR translation while Firefox is offline')
    popup('p.document.querySelector("[data-show-module=containers]").click();');w.until(lambda _:popup('return !p.document.querySelector("[data-module=containers]").hidden;'));capture('toolbar-containers-tr.png')
    before=set(d.window_handles);popup('p.document.getElementById("open-workspace").click();');workspace=new_tab(before);ready();assert d.find_element(By.CSS_SELECTOR,'body').get_attribute('class')=='workspace';Select(control('target-tab')).select_by_value(str(source_id))
    control('container-name').send_keys('İş E2E');control('container-form').find_element(By.CSS_SELECTOR,'button').click();w.until(lambda _:any(x['name']=='İş E2E' for x in request({'type':'containers'})));identity=next(x['cookieStoreId'] for x in request({'type':'containers'}) if x['name']=='İş E2E')
    control('speed-number').send_keys(Keys.CONTROL,'a');control('speed-number').send_keys('1.5');control('apply-speed').click();d.switch_to.window(source);w.until(lambda _:d.execute_script('return document.querySelector("video").playbackRate')==1.5);control('select').click()
    d.switch_to.window(workspace);control('read-selection').click();w.until(lambda _:control('source-text').get_attribute('value')=='The cat is sleeping.');d.execute_script('scrollTo(0,0)');d.save_screenshot(str(out/'workspace-tr.png'))
    passed.append('The popup opens a persistent full-size panel; choosing its source tab makes video speed and selected-text actions work while the panel itself is active, and the container form explains/creates named sessions')
    d.set_context('chrome');d.execute_script('Services.io.offline=false');d.set_context('content');d.switch_to.window(source);before=set(d.window_handles);ActionChains(d).context_click(control('link')).perform();menu('page','İş E2E');work=new_tab(before);w.until(lambda _:d.current_url==url+'linked');assert 'session=normal' not in control('cookies').text
    control('account').clear();control('account').send_keys('work');control('login').click();assert 'session=work' in control('cookies').text
    d.switch_to.window(source);assert 'session=normal' in control('cookies').text;before=set(d.window_handles);ActionChains(d).context_click(control('link')).perform();menu('page','İş E2E');again=new_tab(before);w.until(lambda _:d.current_url==url+'linked');assert 'session=work' in control('cookies').text
    d.switch_to.window(workspace);created=d.execute_async_script('const [url,done]=arguments;browser.tabs.query({}).then(t=>done(t.filter(x=>x.url===url).map(x=>x.cookieStoreId)));',url+'linked');assert created==[identity,identity]
    passed.append('A real link context menu opens the exact URL in the chosen named container; actual server-visible cookies stay separate from the original account and persist on a second container tab')
    d.switch_to.window(source);before=set(d.window_handles);ActionChains(d).context_click(control('sentence')).perform();menu('page','Yeni geçici konteyner');temp=new_tab(before);w.until(lambda _:d.current_url==url);assert 'session=normal' not in control('cookies').text and 'session=work' not in control('cookies').text
    d.close();d.switch_to.window(workspace);w.until(lambda _:not any(x['temporary'] for x in request({'type':'containers'})));assert any(x['cookieStoreId']==identity for x in request({'type':'containers'}))
    passed.append('The real page context menu creates a fresh temporary session; closing its last tab removes only that temporary container and preserves the named one')
    d.switch_to.window(source);before=set(d.window_handles);d.set_context('chrome');tab=d.execute_script('return [...gBrowser.tabs].find(t=>t.linkedBrowser.currentURI.spec===arguments[0]);',url);ActionChains(d).context_click(tab).perform();menu('tab','İş E2E');tabcopy=new_tab(before);w.until(lambda _:d.current_url==url);assert 'session=work' in control('cookies').text
    passed.append('The native browser-tab context menu also opens the source URL in the selected container without navigating the original tab')
    d.switch_to.window(workspace);before=set(d.window_handles);control('open-video-ai').click();ai=new_tab(before);ready();assert control('video-tab').get_attribute('value')==str(source_id)
    assert control('ai-start-ready').is_enabled();control('ai-start-ready').click();w.until(lambda _:request({'type':'localAI','action':'status'})['phase']=='ready');d.execute_script('scrollTo(0,0)');d.save_screenshot(str(out/'ai-quick-start-tr.png'))
    d.switch_to.window(workspace);before=set(d.window_handles);control('open-qwen').click();qwen=new_tab(before);ready();assert control('aiModel').get_attribute('value')=='qwen' and control('model-download').is_displayed();assert request({'type':'localAI','action':'status'})['phase']=='unloaded';assert control('ai-general-panel').get_attribute('open')
    d.switch_to.window(workspace);control('settings').click();w.until(lambda _:len(d.window_handles)>len(before)+1);settings=next(handle for handle in d.window_handles if handle not in before and handle!=qwen);d.switch_to.window(settings);ready();Select(control('language')).select_by_value('en');w.until(lambda _:d.find_element(By.CSS_SELECTOR,'html').get_attribute('lang')=='en')
    d.switch_to.window(controller);toolbar();assert popup('return p.document.getElementById("open-workspace").textContent;')=='Open full-size panel';capture('toolbar-popup-en.png');popup('p.close();')
    d.switch_to.window(workspace);d.set_window_size(500,1000);w.until(lambda _:d.find_element(By.CSS_SELECTOR,'html').get_attribute('lang')=='en');assert d.execute_script('return document.documentElement.scrollWidth<=innerWidth+1');d.save_screenshot(str(out/'workspace-en-narrow.png'))
    passed.append('Video navigation carries its source into a guided AI screen; one explicit start uses bundled translation, Qwen opens its download/general-question controls without downloading, and English/narrow layouts remain usable')
    print('PASS',json.dumps(passed),flush=True)
except Exception:
    try:
        d.set_context('chrome');print('POPUP CHROME',d.execute_script('return [...document.querySelectorAll("browser[webextension-view-type=popup]")].map(b=>({state:b.closest("panel")?.state,id:b.closest("panel")?.id,rect:b.getBoundingClientRect().toJSON()}));'),flush=True);d.set_context('content')
    except Exception:pass
    try:d.save_screenshot(str(out/'failure.png'))
    except Exception:pass
    try:
        d.set_context('content');d.switch_to.window(controller);print('NATIVE MENU EVENTS',d.execute_async_script('browser.runtime.getBackgroundPage().then(bg=>arguments[0](bg.__testContainerClicks));'),flush=True)
    except Exception:pass
    raise
finally:
    (out/'results.json').write_text(json.dumps({'passed':passed,'popup_metrics':metrics},ensure_ascii=False,indent=2)+'\n');d.quit();server.shutdown()
