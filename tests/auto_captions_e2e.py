# SPDX-License-Identifier: MPL-2.0
"""Real Firefox/real bundled inference on a LOCAL HTTPS YouTube-shaped player.

The hostname resolves only to loopback in a disposable profile. A disposable
CA signs its TLS certificate; TLS, sandbox and add-on signature checks stay on.
No public YouTube request, real account or audio transcription is used.
The fixture supplies the minimal CC DOM/metadata contract; playback is real. The fixture deliberately has no source TextTrack. Its DOM/CC interface
exercises the YouTube adapter, including captions hidden by Aion itself.
"""
import json,os,ssl,subprocess,tempfile,base64
from selenium.webdriver.common.action_chains import ActionChains
from selenium.webdriver.common.keys import Keys
from pathlib import Path
from threading import Thread
from http.server import BaseHTTPRequestHandler,ThreadingHTTPServer
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import Select,WebDriverWait
from selenium.webdriver.firefox.options import Options
from selenium.webdriver.firefox.service import Service
ROOT=Path(__file__).resolve().parents[1];out=ROOT/'work/auto-captions-test-artifacts';out.mkdir(parents=True,exist_ok=True)
scratch=tempfile.TemporaryDirectory(prefix='aion-local-https-');local=Path(scratch.name);profile=local/'profile';profile.mkdir()
ca=local/'ca.pem';ca_key=local/'ca-key.pem';cert=local/'server.pem';key=local/'server-key.pem';csr=local/'server.csr';ext=local/'server.ext'
ext.write_text('subjectAltName=DNS:www.youtube.com\nbasicConstraints=critical,CA:FALSE\nkeyUsage=critical,digitalSignature,keyEncipherment\nextendedKeyUsage=serverAuth\n')
for cmd in [
 ['openssl','req','-x509','-newkey','rsa:2048','-nodes','-keyout',str(ca_key),'-out',str(ca),'-days','2','-subj','/CN=Aion Local Fixture CA','-addext','basicConstraints=critical,CA:TRUE','-addext','keyUsage=critical,keyCertSign,cRLSign'],
 ['openssl','req','-newkey','rsa:2048','-nodes','-keyout',str(key),'-out',str(csr),'-subj','/CN=www.youtube.com'],
 ['openssl','x509','-req','-in',str(csr),'-CA',str(ca),'-CAkey',str(ca_key),'-CAcreateserial','-out',str(cert),'-days','2','-extfile',str(ext)],
 ['certutil','-N','-d','sql:'+str(profile),'--empty-password'],
 ['certutil','-A','-d','sql:'+str(profile),'-n','Aion Local Fixture CA','-t','C,,','-i',str(ca)]]:subprocess.run(cmd,check=True,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
requests=[]
class Fixture(BaseHTTPRequestHandler):
    def do_GET(self):
        requests.append(self.headers.get('Host',''))
        if self.path=='/video.webm':body=(ROOT/'tests/fixtures/video.webm').read_bytes();kind='video/webm'
        elif self.path.startswith('/native'):
            body=b'<!doctype html><title>Native caption video</title><video controls muted loop src="/video.webm" style="width:720px"></video><button id="play">Play</button><script>const v=document.querySelector("video"),t=v.addTextTrack("subtitles","English","en");t.addCue(new VTTCue(0,60,"Please close the door."));t.mode="showing";document.getElementById("play").onclick=()=>v.play();</script>';kind='text/html'
        else:
            body='''<!doctype html><meta charset="utf-8"><title>LOCAL YouTube player fixture · not a live YouTube video</title><style>body{background:#182038;color:white;font:16px system-ui}.html5-video-player{position:relative;width:720px;max-width:100%}video{width:100%}.ytp-caption-window-container{position:absolute;bottom:70px;width:100%;text-align:center}.caption-visual-line{background:#1119;color:#fff;font-size:24px}button{padding:10px;margin:4px}</style><h1>LOCAL YouTube player fixture</h1><p>Synthetic test captions, no source TextTrack.</p><div id="movie_player" class="html5-video-player"><video controls muted src="/video.webm"></video><div class="ytp-caption-window-container" style="display:none"><span class="caption-visual-line"><span class="ytp-caption-segment">The cat is sleeping.</span></span></div><button class="ytp-subtitles-button" aria-pressed="false">CC</button></div><button id="play">Prepare video</button><button id="door">Door caption</button><button id="museum">Museum caption</button><button id="blank">Blank caption</button><button id="cat">Cat caption</button><button id="fullscreen">Player fullscreen</button><button id="native-fullscreen">Native video fullscreen</button><button id="navigate">Next video</button><script>
const player=document.getElementById('movie_player'),v=player.querySelector('video'),cc=player.querySelector('.ytp-subtitles-button'),container=player.querySelector('.ytp-caption-window-container'),segment=container.querySelector('.ytp-caption-segment');
player.getOption=(module,key)=>module==='captions'&&key==='track'?{languageCode:'en'}:null;
cc.onclick=()=>{const on=cc.getAttribute('aria-pressed')!=='true';cc.setAttribute('aria-pressed',String(on));container.style.display=on?'block':'none'};
document.getElementById('play').onclick=()=>{v.currentTime=.5;v.loop=true;v.play()};
document.getElementById('door').onclick=()=>{segment.textContent='Please close the door.'};document.getElementById('museum').onclick=()=>{segment.textContent='We visited the museum yesterday.'};document.getElementById('blank').onclick=()=>{segment.textContent=''};document.getElementById('cat').onclick=()=>{segment.textContent='The cat is sleeping.'};document.getElementById('fullscreen').onclick=()=>player.requestFullscreen();document.getElementById('native-fullscreen').onclick=()=>v.requestFullscreen();document.getElementById('navigate').onclick=()=>{history.pushState({},'',location.pathname+'?v=NEXT-LOCAL-FIXTURE');segment.textContent='A new video.'};
</script>'''.encode();kind='text/html'
        self.send_response(200);self.send_header('Content-Type',kind);self.send_header('Content-Length',str(len(body)));self.end_headers();self.wfile.write(body)
    def log_message(self,*_):pass
server=ThreadingHTTPServer(('127.0.0.1',0),Fixture);tls=ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER);tls.load_cert_chain(cert,key);server.socket=tls.wrap_socket(server.socket,server_side=True);Thread(target=server.serve_forever,daemon=True).start()
o=Options();o.binary_location=os.environ['AION_FIREFOX_BINARY'];o.add_argument('-headless');o.accept_insecure_certs=False;o.profile=str(profile);o.set_preference('remote.prefs.recommended',False)
# Bypass the proxy ONLY for the DNS-pinned local fixture. This is never a path
# to the public service: www.youtube.com always resolves to loopback here.
o.set_preference('network.dns.localDomains','www.youtube.com');o.set_preference('network.proxy.no_proxies_on','localhost,127.0.0.1,www.youtube.com')
d=webdriver.Firefox(options=o,service=Service(os.environ['AION_GECKODRIVER'],service_args=['--allow-system-access'],log_output=str(out/'geckodriver.log')));w=WebDriverWait(d,45);passed=[]
def ready():w.until(lambda _:d.find_element(By.TAG_NAME,'body').get_attribute('data-ready')=='true')
def control(id):return d.find_element(By.ID,id)
def request(m):return d.execute_async_script('const [m,done]=arguments;browser.runtime.sendMessage(m).then(done,e=>done({error:e.message}));',m)
def root():return d.find_element(By.CSS_SELECTOR,'[data-aion-captions]').shadow_root
def lines():return root().find_elements(By.CSS_SELECTOR,'section > p')
def popup(js):
    return d.execute_script('const p=browser.extension.getViews({type:"popup"}).find(v=>v.document.visibilityState==="visible");'+js)
def toolbar():
    d.set_context('chrome');ActionChains(d).send_keys(Keys.ESCAPE).perform()
    node=d.execute_script('return [...document.querySelectorAll("toolbarbutton[data-extensionid]")].find(x=>x.getAttribute("data-extensionid")===arguments[0]&&x.id.endsWith("-BAP"));',addon);node.click()
    w.until(lambda _:d.execute_script('return [...document.querySelectorAll("browser[webextension-view-type=popup]")].some(b=>b.closest("panel")?.state==="open");'))
    d.set_context('content');w.until(lambda _:popup('return p?.document.body.dataset.ready==="true";'))
def close_popup():
    d.set_context('chrome');ActionChains(d).send_keys(Keys.ESCAPE).perform();d.set_context('content')
try:
    d.set_window_size(1280,1050);version=json.loads((ROOT/'browser/extension/manifest.json').read_text())['version'];addon=d.install_addon(str(ROOT/f'dist/fire-axolotl-extension-{version}-unsigned.xpi'),temporary=True)
    d.set_context('chrome');uuid=d.execute_script("return JSON.parse(Services.prefs.getStringPref('extensions.webextensions.uuids'))[arguments[0]]",addon);d.set_context('content');base=f'moz-extension://{uuid}/aion/';url=f'https://www.youtube.com:{server.server_port}/watch?v=AION-LOCAL-FIXTURE'
    # No popup, AI controller, checkbox or settings action before first playback.
    d.get(url);page=d.current_window_handle;control('play').click()
    w.until(lambda _:bool(d.find_elements(By.CSS_SELECTOR,'[data-aion-captions]')))
    w.until(lambda _:any('kedi' in x.text.lower() for x in lines()));assert any('The cat' in x.text for x in lines())
    assert control('movie_player').find_element(By.CSS_SELECTOR,'.ytp-subtitles-button').get_attribute('aria-pressed')=='true'
    d.save_screenshot(str(out/'automatic-dual-captions.png'))
    passed.append('Fresh installation automatically finds the video, enables CC and cold-starts real bundled EN/TR dual subtitles without opening any extension UI or checking any box')
    # This page is only the privileged WebDriver inspection harness.
    d.switch_to.new_window('tab');harness=d.current_window_handle;d.get(base+'popup.html');ready()
    assert request({'type':'settings'})['autoCaptions'] is True
    toolbar();assert popup('return p.document.getElementById("auto-captions").checked;');close_popup()
    passed.append('The actual toolbar popup is already checked on its first opening; no manual target, model load or activation step is needed')
    d.switch_to.window(page)
    control('door').click();w.until(lambda _:any('kapı' in x.text.lower() for x in lines()));assert any('Please close' in x.text for x in lines())
    control('navigate').click();w.until(lambda _:any('A new video.' in x.text for x in lines()));w.until(lambda _:any(x.text and 'A new video.' not in x.text for x in lines()))
    assert not any('kapı' in x.text.lower() for x in lines())
    passed.append('Caption changes and SPA video navigation automatically continue without re-enabling the switch or showing the previous caption translation')
    d.switch_to.window(harness);toolbar();assert popup('return p.document.getElementById("auto-captions").checked;')
    assert popup('return p.document.getElementById("auto-captions").getBoundingClientRect().bottom<=p.innerHeight;')
    assert popup('return p.document.getElementById("target-section").hidden;')
    d.set_context('chrome');data=d.execute_async_script('const done=arguments[0],b=[...document.querySelectorAll("browser[webextension-view-type=popup]")].find(x=>x.closest("panel")?.state==="open");b.browsingContext.currentWindowGlobal.drawSnapshot(null,1,"white").then(bitmap=>{const c=document.createElementNS("http://www.w3.org/1999/xhtml","canvas");c.width=bitmap.width;c.height=bitmap.height;c.getContext("2d").drawImage(bitmap,0,0);done(c.toDataURL());});');(out/'automatic-popup.png').write_bytes(base64.b64decode(data.split(',',1)[1]));d.set_context('content')
    # Stop with the same single control, then verify native CC restoration.
    popup('p.document.getElementById("auto-captions").click();');w.until(lambda _:not popup('return p.document.getElementById("auto-captions").checked;'));close_popup()
    d.switch_to.window(page);w.until(lambda _:not d.find_elements(By.CSS_SELECTOR,'[data-aion-captions]'));assert d.execute_script('return getComputedStyle(document.querySelector(".ytp-caption-window-container")).opacity')=='1'
    d.switch_to.window(harness);toolbar();assert not popup('return p.document.getElementById("auto-captions").checked;');close_popup()
    passed.append('Reopening the popup retains on state before stopping and off state afterward; its control is above the fold, no target chooser is shown, and switching off restores native captions')
    d.switch_to.window(harness);toolbar();popup('p.document.getElementById("auto-captions").click();');close_popup();d.switch_to.window(page)
    w.until(lambda _:bool(d.find_elements(By.CSS_SELECTOR,'[data-aion-captions]')));root().find_element(By.CSS_SELECTOR,'section > button').click();w.until(lambda _:not d.find_elements(By.CSS_SELECTOR,'[data-aion-captions]'))
    d.switch_to.window(harness);w.until(lambda _:request({'type':'settings'})['autoCaptions'] is False)
    passed.append('Closing subtitles on the video also switches the persistent automatic mode off without resurrecting its overlay')
    d.switch_to.new_window('tab');d.get(f'https://www.youtube.com:{server.server_port}/native');control('play').click();native=d.current_window_handle
    d.switch_to.window(harness);toolbar();popup('p.document.getElementById("auto-captions").click();');close_popup();d.switch_to.window(native)
    w.until(lambda _:bool(d.find_elements(By.CSS_SELECTOR,'[data-aion-captions]')));w.until(lambda _:any('kapı' in x.text.lower() for x in lines()))
    assert any('Please close' in x.text for x in lines())
    passed.append('The same automatic switch detects a second native TextTrack player and renders both original and real local translation without tab selection')
except Exception:
    try:
        d.set_context('content');d.save_screenshot(str(out/'failure.png'))
        if d.current_url.startswith('moz-extension:'):print('AUTO STATE',request({'type':'autoCaptions'}),flush=True)
    except Exception:pass
    raise
finally:
    (out/'summary.json').write_text(json.dumps({'passed':passed,'scope':'Local HTTPS YouTube-shaped fixture; real Firefox toolbar and packaged inference. No claim about blocked public YouTube.'},ensure_ascii=False,indent=2)+'\n');d.quit();server.shutdown();scratch.cleanup()
