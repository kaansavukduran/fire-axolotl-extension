# SPDX-License-Identifier: MPL-2.0
"""Real Firefox/real bundled inference on a LOCAL HTTPS YouTube-shaped player.

The hostname resolves only to loopback in a disposable profile. A disposable
CA signs its TLS certificate; TLS, sandbox and add-on signature checks stay on.
No public YouTube request, real account or audio transcription is used.
The fixture supplies the minimal CC DOM/metadata contract; playback is real. The fixture deliberately has no source TextTrack. Its DOM/CC interface
exercises the YouTube adapter, including captions hidden by Aion itself.
"""
import json,os,ssl,subprocess,tempfile
from pathlib import Path
from threading import Thread
from http.server import BaseHTTPRequestHandler,ThreadingHTTPServer
from gecko_controls import disable_automatic_captions
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import Select,WebDriverWait
from selenium.webdriver.firefox.options import Options
from selenium.webdriver.firefox.service import Service
ROOT=Path(__file__).resolve().parents[1];out=ROOT/'work/youtube-test-artifacts';out.mkdir(parents=True,exist_ok=True)
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
        else:
            body='''<!doctype html><meta charset="utf-8"><title>LOCAL YouTube player fixture · not a live YouTube video</title><style>body{background:#182038;color:white;font:16px system-ui}.html5-video-player{position:relative;width:720px;max-width:100%}video{width:100%}.ytp-caption-window-container{position:absolute;bottom:70px;width:100%;text-align:center}.caption-visual-line{background:#1119;color:#fff;font-size:24px}button{padding:10px;margin:4px}</style><h1>LOCAL YouTube player fixture</h1><p>Synthetic test captions, no source TextTrack.</p><div id="movie_player" class="html5-video-player"><video controls muted src="/video.webm"></video><div class="ytp-caption-window-container" style="display:none"><span class="caption-visual-line"><span class="ytp-caption-segment">The cat is sleeping.</span></span></div><button class="ytp-subtitles-button" aria-pressed="false">CC</button></div><button id="play">Prepare video</button><button id="door">Door caption</button><button id="museum">Museum caption</button><button id="blank">Blank caption</button><button id="cat">Cat caption</button><button id="fullscreen">Player fullscreen</button><button id="native-fullscreen">Native video fullscreen</button><button id="navigate">Next video</button><script>
const player=document.getElementById('movie_player'),v=player.querySelector('video'),cc=player.querySelector('.ytp-subtitles-button'),container=player.querySelector('.ytp-caption-window-container'),segment=container.querySelector('.ytp-caption-segment');
player.getOption=(module,key)=>module==='captions'&&key==='track'?{languageCode:'en'}:null;
cc.onclick=()=>{const on=cc.getAttribute('aria-pressed')!=='true';cc.setAttribute('aria-pressed',String(on));container.style.display=on?'block':'none'};
document.getElementById('play').onclick=()=>{v.currentTime=.5;v.play().then(()=>v.pause())};
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
def label(key):return d.find_element(By.CSS_SELECTOR,'[data-setting="'+key+'"]')
try:
    d.set_window_size(1280,1050);version=json.loads((ROOT/'browser/extension/manifest.json').read_text())['version'];addon=d.install_addon(str(ROOT/f'dist/fire-axolotl-extension-{version}-unsigned.xpi'),temporary=True)
    d.set_context('chrome');uuid=d.execute_script("return JSON.parse(Services.prefs.getStringPref('extensions.webextensions.uuids'))[arguments[0]]",addon);d.set_context('content');base=f'moz-extension://{uuid}/aion/';url=f'https://www.youtube.com:{server.server_port}/watch?v=AION-LOCAL-FIXTURE'
    disable_automatic_captions(d,base)
    d.get(url);page=d.current_window_handle;control('play').click();w.until(lambda _:d.execute_script('return document.querySelector("video").videoWidth')==320);assert d.execute_script('return document.querySelector("video").textTracks.length')==0
    d.switch_to.new_window('tab');controller=d.current_window_handle;d.get(base+'popup.html');ready();request({'type':'save','patch':{'language':'tr','aiSource':'auto','aiTarget':'tr'}})
    d.execute_async_script('browser.runtime.getBackgroundPage().then(bg=>{bg.__mediaEvents=[];const log=x=>{bg.__mediaEvents.push(x);if(bg.__mediaEvents.length>60)bg.__mediaEvents.shift()};const real=bg.AionMedia.command;bg.AionMedia.command=(id,c)=>{log({event:"command",id,action:c.action});return real(id,c).then(r=>{log({event:"done",id,action:c.action});return r;},e=>{log({event:"error",id,action:c.action,error:e.message});throw e;});};bg.browser.runtime.onConnect.addListener(p=>{if(p.name!=="aion-ai-video")return;log({event:"port",url:p.sender.url});p.onMessage.addListener(m=>log({event:"portMessage",...m}));p.onDisconnect.addListener(()=>log({event:"disconnect"}));});bg.browser.tabs.onRemoved.addListener(id=>log({event:"removed",id}));arguments[0](true);});')
    target=d.execute_async_script('const [url,done]=arguments;browser.tabs.query({}).then(t=>done(t.find(x=>x.url===url).id));',url)
    # Exercise the engine's real runtime icon writers, preserving its badge API.
    for state in [0,1]:
        assert d.execute_async_script('const [id,state,done]=arguments;browser.runtime.getBackgroundPage().then(async bg=>{await bg.vAPI.setIcon(id,{state,parts:7,badge:"7",color:"#666666"});await bg.vAPI.setDefaultIcon("-off","!");done(true);});',target,state)
        d.set_context('chrome');image=d.execute_script('const b=[...document.querySelectorAll("toolbarbutton[data-extensionid]")].find(b=>b.getAttribute("data-extensionid")===arguments[0]&&b.id.endsWith("-BAP"));return getComputedStyle(b).listStyleImage;',addon);assert '/aion/icons/' in image,image;d.save_screenshot(str(out/'aion-toolbar.png'));d.set_context('content')
    d.get(base+'ai.html#focus=video&target='+str(target));ready();assert control('video-tab').get_attribute('value')==str(target);assert control('live-mode').is_enabled();assert request({'type':'localAI','action':'status'})['phase']=='unloaded'
    control('live-mode').click();w.until(lambda _:'kedi' in control('live-translation').text.lower());assert request({'type':'localAI','action':'status'})['modelKind']=='bergamot';assert control('video-source').get_attribute('value')=='auto'
    d.switch_to.window(page);assert control('movie_player').find_element(By.CSS_SELECTOR,'.ytp-subtitles-button').get_attribute('aria-pressed')=='true';w.until(lambda _:'kedi' in lines()[1].text.lower());assert lines()[0].text=='The cat is sleeping.'
    assert d.execute_script('return getComputedStyle(document.querySelector(".ytp-caption-window-container")).opacity')=='0';d.save_screenshot(str(out/'youtube-local-dual-tr.png'))
    control('native-fullscreen').click();w.until(lambda _:d.execute_script('return document.fullscreenElement===document.querySelector("video");'));w.until(lambda _:d.execute_script('const c=[...document.querySelector("video").textTracks].find(t=>t.label==="Aion").cues;return c?.length===2&&c[0].startTime===c[1].startTime&&c[0].endTime===c[1].endTime;'));d.execute_async_script('document.exitFullscreen().then(()=>arguments[0](true));')
    passed.append('The real engine icon writers keep the Aion toolbar logo in both blocking states; the normal video link cold-starts bundled inference, enables CC and displays paired original/Turkish captions without any source TextTrack')
    d.switch_to.window(controller);control('caption-read').click();w.until(lambda _:control('study-text').get_attribute('value')=='The cat is sleeping.');label('captionOriginal').click();d.switch_to.window(page);w.until(lambda _:not lines()[0].is_displayed() and lines()[1].is_displayed())
    d.switch_to.window(controller);label('captionTranslated').click();d.switch_to.window(page);w.until(lambda _:not lines()[0].is_displayed() and not lines()[1].is_displayed());assert d.execute_script('return getComputedStyle(document.querySelector(".ytp-caption-window-container")).opacity')=='0'
    d.switch_to.window(controller);label('captionOriginal').click();d.switch_to.window(page);w.until(lambda _:lines()[0].is_displayed() and not lines()[1].is_displayed())
    d.switch_to.window(controller);label('captionTranslated').click();d.switch_to.window(page);w.until(lambda _:'kedi' in lines()[1].text.lower());control('fullscreen').click();w.until(lambda _:d.execute_script('return document.fullscreenElement?.id')=='movie_player');assert lines()[0].is_displayed() and lines()[1].is_displayed();d.execute_async_script('document.exitFullscreen().then(()=>arguments[0](true));')
    passed.append('Original-only, translation-only, both hidden and both visible work through normal independent switches; native YouTube captions stay covered and player fullscreen retains the paired overlay')
    control('blank').click();w.until(lambda _:not lines()[0].is_displayed() and not lines()[1].is_displayed());control('cat').click();w.until(lambda _:'kedi' in lines()[1].text.lower())
    d.switch_to.window(controller)
    # Delay delivery of ONE actual Bergamot result. The engine still performs
    # real inference; this deterministic gate tests a late result after change.
    d.execute_async_script('browser.runtime.getBackgroundPage().then(bg=>{bg.__realCall=bg.AionLocalAI.call;bg.__held=false;bg.AionLocalAI.call=async m=>{const r=await bg.__realCall(m);if(m.action==="translate"&&m.text==="Please close the door."){bg.__held=true;await new Promise(resolve=>bg.__releaseCaption=resolve);}return r;};arguments[0](true);});')
    d.switch_to.window(page);control('door').click();d.switch_to.window(controller);w.until(lambda _:d.execute_async_script('browser.runtime.getBackgroundPage().then(bg=>arguments[0](bg.__held));'))
    d.switch_to.window(page);control('museum').click();w.until(lambda _:lines()[0].text=='We visited the museum yesterday.' and not lines()[1].is_displayed())
    d.switch_to.window(controller);d.execute_async_script('browser.runtime.getBackgroundPage().then(bg=>{bg.AionLocalAI.call=bg.__realCall;bg.__releaseCaption();arguments[0](true);});');w.until(lambda _:'müze' in control('live-translation').text.lower());d.switch_to.window(page);assert 'kapı' not in lines()[1].text.lower();assert 'müze' in lines()[1].text.lower()
    passed.append('Blank/changed captions clear stale text; a deterministically delayed real inference result cannot be attached to a newer source line, and the newest source is translated next')
    d.switch_to.window(controller);d.execute_script('const b=document.getElementById("live-mode");b.click();b.click();');w.until(lambda _:control('live-mode').is_selected() and 'müze' in control('live-translation').text.lower());d.switch_to.window(page);w.until(lambda _:bool(d.find_elements(By.CSS_SELECTOR,'[data-aion-captions]')))
    root().find_element(By.CSS_SELECTOR,'section > button').click();d.switch_to.window(controller);w.until(lambda _:not control('live-mode').is_selected());d.switch_to.window(page);w.until(lambda _:not d.find_elements(By.CSS_SELECTOR,'[data-aion-captions]'));assert d.execute_script('return getComputedStyle(document.querySelector(".ytp-caption-window-container")).opacity')=='1'
    d.switch_to.window(controller);control('live-mode').click();w.until(lambda _:'müze' in control('live-translation').text.lower());d.switch_to.window(page);control('navigate').click();d.switch_to.window(controller);w.until(lambda _:not control('live-mode').is_selected());w.until(lambda _:control('status').get_attribute('data-error')=='true');d.switch_to.window(page);assert not d.find_elements(By.CSS_SELECTOR,'[data-aion-captions]')
    passed.append('Rapid off/on retains the newest session; the on-video close button stops translation and restores native CC; a YouTube SPA video change stops the old session with an actionable message and no leftover overlay')
    d.execute_script('const b=document.querySelector(".ytp-subtitles-button");b.disabled=true;b.setAttribute("aria-disabled","true");')
    d.switch_to.window(controller);control('live-mode').click();w.until(lambda _:not control('live-mode').is_selected());w.until(lambda _:d.execute_script('return document.getElementById("status").textContent===UI.t("youtubeCaptionsUnavailable");'))
    d.switch_to.window(page);assert not d.find_elements(By.CSS_SELECTOR,'[data-aion-captions]');d.execute_script('const b=document.querySelector(".ytp-subtitles-button");b.disabled=false;b.setAttribute("aria-disabled","false");')
    d.switch_to.window(controller);Select(control('video-source')).select_by_value('en');w.until(lambda _:request({'type':'settings'})['aiSource']=='en');Select(control('video-target')).select_by_value('tr');control('live-mode').click();w.until(lambda _:control('live-mode').is_selected());control('stop-video').click();w.until(lambda _:not control('live-mode').is_selected())
    request({'type':'save','patch':{'language':'en','scale':200,'font':'opendyslexic','textSize':120}});w.until(lambda _:d.find_element(By.TAG_NAME,'html').get_attribute('lang')=='en');d.set_window_size(500,1050);control('live-mode').location_once_scrolled_into_view;assert d.execute_script('return document.documentElement.scrollWidth<=innerWidth+1');assert control('live-mode').is_enabled();d.save_screenshot(str(out/'youtube-controls-en-200-narrow.png'))
    control('live-mode').click();w.until(lambda _:control('live-mode').is_selected());d.switch_to.window(page);w.until(lambda _:bool(d.find_elements(By.CSS_SELECTOR,'[data-aion-captions]')));d.switch_to.window(controller)
    # Suppress ONLY this test document's pagehide callback. Background port
    # cleanup must succeed even when the closing page cannot run cleanup JS.
    d.execute_script('window.addEventListener("pagehide",event=>event.stopImmediatePropagation(),{capture:true,once:true});');d.close();d.switch_to.window(page);w.until(lambda _:not d.find_elements(By.CSS_SELECTOR,'[data-aion-captions]'));assert d.execute_script('return getComputedStyle(document.querySelector(".ytp-caption-window-container")).opacity')=='1';assert requests and all(host.startswith('www.youtube.com:') for host in requests)
    passed.append('Unavailable CC reports an actionable error without an overlay; source/target choices and Stop work normally; English, 200% scale, larger text, OpenDyslexic and a narrow viewport preserve accessible controls, and closing the active controller with its page-side cleanup suppressed still lets the real background restore native CC without a leftover overlay')
    print('PASS',json.dumps(passed),flush=True)
except Exception:
    try:
        d.set_context('content');d.switch_to.new_window('tab');d.get(base+'popup.html');ready();print('LIFECYCLE',d.execute_async_script('browser.runtime.getBackgroundPage().then(bg=>arguments[0](bg.__mediaEvents));'),flush=True)
    except Exception:pass
    try:d.save_screenshot(str(out/'failure.png'))
    except Exception:pass
    raise
finally:
    (out/'results.json').write_text(json.dumps({'passed':passed,'scope':'Local HTTPS YouTube-shaped fixture only; real bundled model, real Firefox and TLS verification; not a live public-video test','public_video_access':'Cloud proxy denied public YouTube with HTTP 403; no bypass attempted'},ensure_ascii=False,indent=2)+'\n');d.quit();server.shutdown();scratch.cleanup()
