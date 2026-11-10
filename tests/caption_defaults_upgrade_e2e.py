# SPDX-License-Identifier: MPL-2.0
"""Real 0.13.0 -> current migration and persistent user-off preference."""
import hashlib,json,os,urllib.request
from pathlib import Path
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.firefox.options import Options
from selenium.webdriver.firefox.service import Service
from selenium.webdriver.support.ui import WebDriverWait
ROOT=Path(__file__).resolve().parents[1]
old=ROOT/'work/previous-caption-preview-0.13.0.xpi'
expected='c4c2c304c0606d86ed4ab94ee26cd422a47746f9da65a8f791c4744120ec6e8f'
local=ROOT/'dist/fire-axolotl-extension-0.13.0-native-newtab-unsigned.xpi'
if not old.exists() or hashlib.sha256(old.read_bytes()).hexdigest()!=expected:
    if local.exists() and hashlib.sha256(local.read_bytes()).hexdigest()==expected:old.write_bytes(local.read_bytes())
    else:
        url='https://github.com/kaansavukduran/fire-axolotl-extension/releases/download/v0.13.0-preview.1/fire-axolotl-extension-0.13.0-native-newtab-unsigned.xpi'
        with urllib.request.urlopen(url,timeout=90) as source,old.with_suffix('.partial').open('wb') as target:
            while block:=source.read(1024*1024):target.write(block)
        assert hashlib.sha256(old.with_suffix('.partial').read_bytes()).hexdigest()==expected
        old.with_suffix('.partial').replace(old)
assert hashlib.sha256(old.read_bytes()).hexdigest()==expected
version=json.loads((ROOT/'browser/extension/manifest.json').read_text())['version']
new=ROOT/f'dist/fire-axolotl-extension-{version}-native-newtab-unsigned.xpi'
out=ROOT/'work/caption-defaults-upgrade-test-artifacts';out.mkdir(parents=True,exist_ok=True)
o=Options();o.binary_location=os.environ['AION_FIREFOX_BINARY'];o.add_argument('-headless');o.accept_insecure_certs=False;o.set_preference('remote.prefs.recommended',False)
d=webdriver.Firefox(options=o,service=Service(os.environ['AION_GECKODRIVER'],service_args=['--allow-system-access'],log_output=str(out/'geckodriver.log')));w=WebDriverWait(d,45);passed=[]
def request(m):return d.execute_async_script('const [m,done]=arguments;browser.runtime.sendMessage(m).then(done,e=>done({error:e.message}));',m)
def load(path):
    d.get('about:blank');identity=d.install_addon(str(path.resolve()),temporary=True)
    d.set_context('chrome');uuid=d.execute_script("return JSON.parse(Services.prefs.getStringPref('extensions.webextensions.uuids'))[arguments[0]]",identity);d.set_context('content')
    d.get(f'moz-extension://{uuid}/aion/popup.html');w.until(lambda _:d.find_element(By.TAG_NAME,'body').get_attribute('data-ready')=='true')
    return identity
try:
    identity=load(old)
    saved=request({'type':'save','patch':{'autoCaptions':False,'language':'tr','theme':'light','vocabulary':['Işık'],'aiSource':'auto','aiTarget':'tr','captionSize':32}})
    assert saved['autoCaptions'] is False and 'autoCaptionsDefaultVersion' not in saved
    assert load(new)==identity
    settings=request({'type':'settings'});assert settings['autoCaptions'] is True and settings['autoCaptionsDefaultVersion']==1
    assert settings['vocabulary']==['Işık'] and settings['theme']=='light' and settings['captionSize']==32
    assert settings['aiSource']=='auto' and settings['aiTarget']=='tr'
    passed.append('Real upgrade from 0.13.0 opens its former saved-off default automatically while preserving vocabulary, language, appearance and caption preferences')
    stopped=request({'type':'autoCaptions','action':'set','enabled':False})
    assert stopped.get('enabled') is False, {'response':stopped,'settings':request({'type':'settings'}),'state':request({'type':'autoCaptions'})}
    assert load(new)==identity
    settings=request({'type':'settings'});assert settings['autoCaptions'] is False and settings['autoCaptionsDefaultVersion']==1
    w.until(lambda _:request({'type':'autoCaptions'})['enabled'] is False)
    assert not d.find_element(By.ID,'auto-captions').is_selected()
    passed.append('Explicitly turning captions off survives actual add-on reinstallation/background restart; the new default is not reapplied')
    assert request({'type':'autoCaptions','action':'set','enabled':True})['enabled'] is True
    assert load(new)==identity
    assert request({'type':'settings'})['autoCaptions'] is True
    assert request({'type':'settings'})['vocabulary']==['Işık']
    passed.append('Re-enabling also survives real reinstallation without resetting unrelated data')
    print('PASS',json.dumps(passed),flush=True)
finally:
    (out/'results.json').write_text(json.dumps({'passed':passed,'scope':'Stock Firefox temporary add-on upgrades; not an AMO signed install/update'},ensure_ascii=False,indent=2)+'\n');d.quit()
