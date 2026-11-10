# SPDX-License-Identifier: MPL-2.0
"""Fetch hash-pinned, unmodified Linux test executables, never distribute them as our browser."""
import hashlib
import json
import os
import platform
from pathlib import Path
import tarfile
import urllib.request
import zipfile

ROOT = Path(__file__).resolve().parents[1]
destination = ROOT / 'work/test-runtime'
destination.mkdir(parents=True, exist_ok=True)
manifest_name = 'windows-runtime.json' if platform.system() == 'Windows' else 'gecko-runtime.json'
manifest = json.loads((ROOT / 'tests' / manifest_name).read_text())
environment = {}
for name, record in manifest.items():
    archive = destination / Path(record['url']).name
    if not archive.exists():
        with urllib.request.urlopen(record['url'], timeout=60) as response, archive.open('wb') as output:
            while block := response.read(1024 * 1024):
                output.write(block)
    algorithm = 'sha512' if 'sha512' in record else 'sha256'
    with archive.open('rb') as stream:
        digest = hashlib.file_digest(stream, algorithm).hexdigest()
    if digest != record[algorithm]:
        raise ValueError(f'{name} checksum mismatch')
    target = destination / name
    target.mkdir(exist_ok=True)
    if archive.suffix == '.zip':
        with zipfile.ZipFile(archive) as source:
            for info in source.infolist():
                path = Path(info.filename)
                if path.is_absolute() or '..' in path.parts or ':' in info.filename or '\\' in info.filename:
                    raise ValueError('Unsafe test runtime ZIP path')
            source.extractall(target)
    else:
        with tarfile.open(archive) as source:
            source.extractall(target, filter='data')
    key = 'AION_FIREFOX_BINARY' if name == 'firefox' else 'AION_GECKODRIVER'
    environment[key] = str(target / record['binary'])
    print(f'{key}={environment[key]}')
if os.environ.get('GITHUB_ENV'):
    with open(os.environ['GITHUB_ENV'], 'a') as stream:
        for key, value in environment.items():
            stream.write(f'{key}={value}\n')
