# SPDX-License-Identifier: MPL-2.0
"""Fetch hash-pinned, unmodified uBO and package its corresponding source.

No executable from a downloaded component is run. Source includes the exact
uAssets checkout used for the bundled lists, build scripts and all submodules.
"""
import argparse
import gzip
import hashlib
import io
import json
import os
from pathlib import Path, PurePosixPath
import shutil
import stat
import subprocess
import tarfile
import urllib.request
import zipfile

ROOT = Path(__file__).resolve().parents[1]
CACHE = Path(os.environ.get('AION_COMPONENT_CACHE', ROOT / 'work/components'))
PIN = json.loads((ROOT / 'components.json').read_text())['ublock-origin']


def sha256(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def verify_xpi(path, pin=PIN):
    if sha256(path) != pin['sha256']:
        raise ValueError('uBlock Origin package hash mismatch')
    with zipfile.ZipFile(path) as archive:
        entries = archive.infolist()
        names = [entry.filename for entry in entries]
        if len(names) != len(set(names)) or sum(e.file_size for e in entries) > 100_000_000:
            raise ValueError('Duplicate entries or excessive component size')
        for entry in entries:
            name = PurePosixPath(entry.filename)
            mode = entry.external_attr >> 16
            if (name.is_absolute() or '..' in name.parts or '\\' in entry.filename
                    or stat.S_ISLNK(mode) or entry.flag_bits & 1):
                raise ValueError('Unsafe component archive path or entry')
        manifest = json.loads(archive.read('manifest.json'))
        identity = manifest['browser_specific_settings']['gecko']['id']
        if identity != pin['id'] or manifest['version'] != pin['version']:
            raise ValueError('Unexpected component identity/version')
        for notice in ['LICENSE.txt', 'META-INF/mozilla.rsa', 'META-INF/cose.sig']:
            if notice not in names:
                raise ValueError(f'Missing license or signature: {notice}')
        if archive.testzip():
            raise ValueError('Corrupt component archive')
        return manifest


def fetch_xpi():
    CACHE.mkdir(parents=True, exist_ok=True)
    path = CACHE / Path(PIN['url']).name
    if not path.exists():
        temporary = path.with_suffix('.download')
        try:
            with urllib.request.urlopen(PIN['url'], timeout=60) as response, temporary.open('wb') as output:
                size = 0
                while block := response.read(1024 * 1024):
                    size += len(block)
                    if size > 20_000_000:
                        raise ValueError('Component download exceeds the reviewed size budget')
                    output.write(block)
            verify_xpi(temporary)
            temporary.replace(path)
        finally:
            temporary.unlink(missing_ok=True)
    verify_xpi(path)
    return path


def git(directory, *args):
    return subprocess.check_output(['git', '-c', 'core.autocrlf=false', '-c', 'core.eol=lf', '-C', str(directory), *args], text=True).strip()


def source_checkout(name, record):
    path = CACHE / name
    if not path.exists():
        path.mkdir(parents=True)
        git(path, 'init', '-q')
        git(path, 'remote', 'add', 'origin', record['url'])
        git(path, 'fetch', '--depth=1', 'origin', record['commit'])
        git(path, 'checkout', '--detach', '-q', 'FETCH_HEAD')
        git(path, 'submodule', 'update', '--init', '--recursive', '--depth=1')
    if git(path, 'rev-parse', 'HEAD') != record['commit'] or git(path, 'status', '--porcelain'):
        raise ValueError(f'Wrong or dirty component source checkout: {path}')
    if name == 'uBlock':
        actual = {}
        for line in git(path, 'submodule', 'status', '--recursive').splitlines():
            commit, subpath, *_ = line.split()
            actual[subpath] = commit
        if actual != PIN['submodules']:
            raise ValueError('Unexpected or uninitialized uBO submodule revision')
    return path


def verify_assets(xpi, sources):
    """Bind every copied filter/list to the pinned uAssets build inputs."""
    main, prod = sources['uAssets/main'], sources['uAssets/prod']
    mappings = {}
    for name in ['pgl.yoyo.org', 'publicsuffix.org', 'urlhaus-filter']:
        for file in (main / 'thirdparties' / name).rglob('*'):
            if file.is_file():
                mappings['assets/' + file.relative_to(main).as_posix()] = file
    for name in ['easylist', 'easyprivacy']:
        mappings[f'assets/thirdparties/easylist/{name}.txt'] = prod / f'thirdparties/{name}.txt'
    for name in ['badlists.txt', 'badware.min.txt', 'filters.min.txt', 'privacy.min.txt', 'quick-fixes.min.txt', 'unbreak.min.txt']:
        mappings['assets/ublock/' + name] = prod / 'filters' / name
    with zipfile.ZipFile(xpi) as archive:
        for name, file in mappings.items():
            if archive.read(name) != file.read_bytes():
                raise ValueError(f'Bundled filter does not match source pin: {name}')


def source_archive(sources, xpi):
    output = CACHE / f'ublock-origin-{PIN["version"]}-corresponding-source.tar.gz'
    instructions = (
        'uBlock Origin: unmodified official Firefox package, GPL-3.0-or-later.\n'
        'Copyright Raymond Hill and contributors; retain each upstream notice.\n'
        'See uBlock/LICENSE.txt and uAssets/main/LICENSE; list/library licenses vary.\n'
        'The package/ directory preserves the exact signed distribution, including licenses.\n'
        'To rebuild the unsigned Firefox package, using bash, Python 3 and zip:\n'
        '  cd uBlock\n'
        '  mkdir -p dist/build/uAssets\n'
        '  cp -R ../uAssets/main dist/build/uAssets/main\n'
        '  cp -R ../uAssets/prod dist/build/uAssets/prod\n'
        '  bash tools/make-firefox.sh all\n'
        'Mozilla signing is separate and cannot be reproduced with upstream public source.\n'
    )
    # Stable metadata makes independently fetched, identical pins byte-reproducible.
    with output.open('wb') as raw, gzip.GzipFile(filename='', fileobj=raw, mode='wb', mtime=0) as compressed, tarfile.open(fileobj=compressed, mode='w|') as archive:
        def add(name, data, mode=0o644):
            entry = tarfile.TarInfo(name)
            entry.size, entry.mode, entry.mtime = len(data), mode, 0
            archive.addfile(entry, io.BytesIO(data))
        add('README-SOURCE.txt', instructions.encode())
        add('components.json', (ROOT / 'components.json').read_bytes())
        add('package/' + xpi.name, xpi.read_bytes())
        for name, source in sorted(sources.items()):
            files = subprocess.check_output(['git', '-C', str(source), 'ls-files', '-z', '--recurse-submodules']).decode().split('\0')
            for relative in sorted(filter(None, files)):
                path = source / relative
                if path.is_symlink():
                    entry = tarfile.TarInfo(name + '/' + relative)
                    entry.type, entry.linkname, entry.mode = tarfile.SYMTYPE, os.readlink(path), 0o777
                    archive.addfile(entry)
                else:
                    add(name + '/' + relative, path.read_bytes(), 0o755 if path.stat().st_mode & 0o111 else 0o644)
    return output


def fetch_all():
    xpi = fetch_xpi()
    sources = {name: source_checkout(name, record) for name, record in PIN['sources'].items()}
    verify_assets(xpi, sources)
    archive = source_archive(sources, xpi)
    receipt = {**PIN, 'corresponding_source_sha256': sha256(archive)}
    (CACHE / 'ublock-origin.json').write_text(json.dumps(receipt, indent=2) + '\n')
    return xpi, archive


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--package-only', action='store_true', help='For Gecko tests only; browser builds also require corresponding source')
    args = parser.parse_args()
    print(fetch_xpi() if args.package_only else fetch_all())
