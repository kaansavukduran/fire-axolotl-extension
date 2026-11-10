# SPDX-License-Identifier: GPL-3.0-or-later
"""Build one unsigned extension containing Aion and the pinned uBO engine.

The upstream signature is deliberately removed: this is a modified combined
distribution with its own identity, requiring its own Mozilla signature.
"""
from pathlib import Path
import argparse
import hashlib
import json
import zipfile
from fetch_components import fetch_xpi, fetch_all, PIN

ROOT = Path(__file__).resolve().parents[1]


def replace_once(data, old, new):
    if data.count(old) != 1:
        raise ValueError('Pinned upstream integration point changed: ' + old[:80])
    return data.replace(old, new, 1)


def package(with_sources=False, native_newtab=False):
    xpi = fetch_xpi()
    if with_sources:
        _, source = fetch_all()
        print('Corresponding source:', source)
    with zipfile.ZipFile(xpi) as upstream:
        files = {n: upstream.read(n) for n in upstream.namelist()
                 if not n.startswith('META-INF/') and n != 'mozilla-recommendation.json' and not n.endswith('/')}
    source = ROOT / 'browser/extension'
    aion = json.loads((source / 'manifest.json').read_text())
    manifest = json.loads(files['manifest.json'])
    for key in ['name', 'version', 'description', 'icons', 'browser_specific_settings']:
        manifest[key] = aion[key]
    manifest.pop('short_name', None)
    manifest['author'] = 'Kaan Savuk Duran; Aion contributors; uBlock Origin by Raymond Hill and contributors'
    manifest['permissions'] = sorted(set(manifest['permissions'] + aion['permissions']))
    manifest['optional_permissions'] = []
    manifest['options_ui'] = {'page': 'aion/settings.html', 'open_in_tab': True}
    manifest['browser_action'] = {**aion['browser_action'], 'default_popup': 'aion/popup.html', 'default_title': aion['name']}
    manifest['browser_action']['default_icon'] = {k: 'aion/' + v for k, v in aion['browser_action']['default_icon'].items()}
    manifest['icons'] = {k: 'aion/' + v for k, v in aion['icons'].items()}
    manifest['sidebar_action'] = {**aion['sidebar_action'], 'default_title': 'Fire Axolotl', 'default_panel': 'aion/sidebar.html', 'default_icon': 'aion/icons/32.png'}
    if native_newtab:
        manifest.pop('chrome_url_overrides', None)
    else:
        manifest['chrome_url_overrides'] = {'newtab': 'aion/newtab.html'}
    manifest['commands']['_execute_sidebar_action'] = {'suggested_key': {'default': 'Alt+Shift+A'}}
    for key, description in [('aion-speed-up','Increase video/audio speed'),('aion-speed-down','Decrease video/audio speed'),('aion-speed-reset','Reset video/audio speed')]:
        manifest['commands'][key] = {'description':description}
    manifest['content_security_policy'] = "script-src 'self' 'wasm-unsafe-eval'; object-src 'none'; base-uri 'none'"
    manifest['web_accessible_resources'].extend(['/aion/fonts/*.otf', '/aion/fonts/*.ttf'])
    files['manifest.json'] = (json.dumps(manifest, indent=2) + '\n').encode()
    # Preserve uBO's own root paths and locales; Aion lives under aion/.
    files['background.html'] = replace_once(files['background.html'].decode(), '</body>',
        '<script src="aion/shared.js"></script>\n<script src="aion/ai-service.js"></script>\n<script src="aion/background.js"></script>\n<script src="aion/media-controller.js"></script>\n'
        '<script src="aion/image-search.js"></script>\n<script src="aion/sync.js"></script>\n<script src="aion/site-style.js"></script>\n<script src="aion/browser-integration.js"></script>\n</body>').encode()
    # Both modules own menus in the same extension. Never erase the other module.
    data = files['js/vapi-background.js'].decode()
    data = replace_once(data, 'webext.menus.removeAll();',
        "for (const entry of this._aionOwnedEntries || []) { webext.menus.remove(entry.id).catch(() => {}); }\n"
        '        this._aionOwnedEntries = entries;')
    # Engine migration version must track uBO, independently of our product version.
    data = replace_once(data, 'manifest.version_name || manifest.version', json.dumps(PIN['version']))
    data = replace_once(data, 'return webext.storage.local.clear(...args).catch(reason => {',
        "return webext.storage.local.get(null).then(all => webext.storage.local.remove(\n"
        "            Object.keys(all).filter(key => key !== 'settings' && key !== 'temporaryContainers' && !key.startsWith('aion'))\n"
        '        )).catch(reason => {')
    files['js/vapi-background.js'] = data.encode()
    data = files['js/vapi-common.js'].decode()
    files['js/vapi-common.js'] = replace_once(data, 'manifest.version_name || manifest.version', json.dumps(PIN['version'])).encode()
    data = files['js/start.js'].decode()
    files['js/start.js'] = replace_once(data, 'toInt(details.version) <= toInt(vAPI.app.version)', 'toInt(details.version) <= toInt(browser.runtime.getManifest().version)').encode()
    for path in sorted(source.rglob('*')):
        if path.is_file() and path.name != 'manifest.json':
            files['aion/' + path.relative_to(source).as_posix()] = path.read_bytes()
    runtime = ROOT / 'work/ai-runtime'
    if not (runtime / 'worker.mjs').is_file():
        raise ValueError('Run npm ci and npm run build:ai before packaging')
    receipt = json.loads((runtime / 'RUNTIME.json').read_text())
    if receipt.get('workerSourceSHA256') != hashlib.sha256((source / 'ai/worker.mjs').read_bytes()).hexdigest() or receipt.get('lockSHA256') != hashlib.sha256((ROOT / 'package-lock.json').read_bytes()).hexdigest():
        raise ValueError('AI build is stale: run npm run build:ai')
    for path in sorted(runtime.rglob('*')):
        if path.is_file():
            files['aion/ai/' + path.relative_to(runtime).as_posix()] = path.read_bytes()
    files['THIRD_PARTY_NOTICES.md'] = (ROOT / 'THIRD_PARTY_NOTICES.md').read_bytes()
    files['aion/LICENSE-MPL-2.0'] = (ROOT / 'LICENSE-MPL-2.0').read_bytes()
    files['aion/DONOR.json'] = (ROOT / 'donor.json').read_bytes()
    files['aion/COMPONENTS.json'] = (ROOT / 'components.json').read_bytes()
    files['aion/BUILD.json'] = json.dumps({'newtabOverride': not native_newtab}).encode()
    variant = '-native-newtab' if native_newtab else ''
    output = ROOT / f'dist/fire-axolotl-extension-{aion["version"]}{variant}-unsigned.xpi'
    output.parent.mkdir(exist_ok=True)
    temporary = output.with_suffix('.xpi.tmp')
    with zipfile.ZipFile(temporary, 'w', zipfile.ZIP_DEFLATED, compresslevel=9) as archive:
        for name, data in sorted(files.items()):
            info = zipfile.ZipInfo(name, (2026, 1, 1, 0, 0, 0))
            info.compress_type = zipfile.ZIP_DEFLATED
            info.external_attr = 0o100644 << 16
            archive.writestr(info, data)
    temporary.replace(output)
    output.with_suffix('.xpi.sha256').write_text(hashlib.sha256(output.read_bytes()).hexdigest() + '  ' + output.name + '\n')
    print(output)
    return output


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--with-sources', action='store_true')
    parser.add_argument('--native-newtab', action='store_true', help='Preserve Firefox or another extension’s new-tab page; game remains accessible from the popup')
    args = parser.parse_args()
    package(args.with_sources, args.native_newtab)
