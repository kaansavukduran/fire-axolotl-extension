# SPDX-License-Identifier: GPL-3.0-or-later
"""Static checks for our integration, translations, source pins and final XPI."""
from pathlib import Path
from html.parser import HTMLParser
import hashlib
import json
import subprocess
import zipfile

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'browser/extension'
messages = {lang: json.loads((SOURCE / f'_locales/{lang}/messages.json').read_text()) for lang in ['tr', 'en']}
assert messages['tr'].keys() == messages['en'].keys(), 'Translation key mismatch'


class Markup(HTMLParser):
    def handle_starttag(self, tag, attrs):
        for name, value in attrs:
            if name in ['data-i18n', 'data-label', 'data-placeholder']:
                assert value in messages['en'], value
            assert not name.startswith('on'), 'Inline script handler'


for path in SOURCE.rglob('*'):
    if path.suffix == '.json':
        json.loads(path.read_text())
    if path.suffix in ['.js', '.mjs']:
        subprocess.run(['node', '--check', str(path)], check=True, capture_output=True)
    if path.suffix == '.html':
        Markup().feed(path.read_text())
for record in json.loads((SOURCE / 'vendor/SOURCES.json').read_text()).values():
    for name, digest in record['files'].items():
        assert hashlib.sha256((SOURCE / 'vendor' / name).read_bytes()).hexdigest() == digest, name
manifest = json.loads((SOURCE / 'manifest.json').read_text())
package = ROOT / f'dist/fire-axolotl-extension-{manifest["version"]}-unsigned.xpi'
with zipfile.ZipFile(package) as archive:
    assert archive.testzip() is None
    final = json.loads(archive.read('manifest.json'))
    assert final['browser_specific_settings']['gecko']['id'] != 'uBlock0@raymondhill.net'
    assert final['browser_specific_settings']['gecko']['id'] != 'aion@fire-axolotl.browser'
    assert 'sessions' in final['optional_permissions'] and 'sessions' not in final['permissions']
    assert final['options_ui']['page'] == 'aion/settings.html'
    assert final['background'] == {'page': 'background.html'}
    assert 'mozilla-recommendation.json' not in archive.namelist()
    assert not any(name.startswith('META-INF/') for name in archive.namelist())
    for key in ['aion/popup.html', 'aion/newtab.html', 'aion/sidebar.html', 'js/start.js', 'dashboard.html', 'LICENSE.txt']:
        assert key in archive.namelist(), key
    for script in final['content_scripts']:
        for name in script['js']:
            assert name.lstrip('/') in archive.namelist(), name
print('PASS: JavaScript syntax, HTML translation keys, pinned vendor hashes and single-extension package')

optional = ROOT / f'dist/fire-axolotl-extension-{manifest["version"]}-native-newtab-unsigned.xpi'
if optional.is_file():
    with zipfile.ZipFile(optional) as archive:
        variant = json.loads(archive.read('manifest.json'))
        assert 'chrome_url_overrides' not in variant
        assert variant['browser_specific_settings']['gecko']['id'] == final['browser_specific_settings']['gecko']['id']
        assert archive.testzip() is None
with zipfile.ZipFile(package) as archive:
    assert not any(name.endswith('.onnx') or name.endswith('.onnx_data') for name in archive.namelist())
    assert 'aion/ai/worker.mjs' in archive.namelist()
print('PASS: optional native-newtab build and model-data boundary')

# Both local model manifests are packaged unchanged and every referenced weight
# has an explicit size and SHA-256; weights themselves stay outside the XPI.
import re
for name in ['model.json', 'translation-model.json']:
    local = (SOURCE / 'ai' / name).read_bytes()
    pin = json.loads(local)
    with zipfile.ZipFile(package) as archive:
        assert archive.read('aion/ai/' + name) == local
    for entry in pin['files'].values():
        assert isinstance(entry['size'], int) and entry['size'] > 0
        assert re.fullmatch(r'[a-f0-9]{64}', entry['sha256'])
    for variant in pin['variants'].values():
        selected = variant.get('files', [variant.get('file')])
        assert selected and all(path in pin['files'] for path in selected)
    if pin.get('kind') == 'm2m':
        assert len(pin['languages']) == len(set(pin['languages'])) == 100
print('PASS: packaged model manifests, SHA-256 pins and 100 supported translation codes')

bergamot=json.loads((SOURCE/'ai/bergamot-model.json').read_text())
with zipfile.ZipFile(package) as archive:
    assert archive.read('aion/ai/bergamot-model.json')==(SOURCE/'ai/bergamot-model.json').read_bytes()
    for name,record in bergamot['files'].items():
        value=archive.read('aion/ai/bergamot/'+name)
        assert len(value)==record['size'] and hashlib.sha256(value).hexdigest()==record['sha256'],name
    assert 'eval.call' not in archive.read('aion/ai/bergamot/binding.js').decode()
    assert archive.read('aion/ai/bergamot/worker.js')==(SOURCE/'ai/bergamot/worker.js').read_bytes()
    assert 'aion/ai/bergamot/MODEL-LICENSE.txt' in archive.namelist()
    assert 'aion/ai/bergamot/ENGINE-NOTICES.txt' in archive.namelist()
print('PASS: bundled Bergamot EN/TR weights, pinned hashes, browser-only binding and source notices')
