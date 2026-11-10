# SPDX-License-Identifier: MPL-2.0
"""Download the exact public Qwen data files for an offline import/test.

Model data is not executable source and is never added to Git. Browser users
can instead press Download in the extension. Completed files are hash checked.
"""
import argparse
import hashlib
import json
from pathlib import Path
import urllib.request

ROOT = Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--backend', choices=['wasm','webgpu'], default='wasm')
parser.add_argument('--output', type=Path, default=ROOT / 'work/local-model')
args = parser.parse_args()
pin = json.loads((ROOT / 'browser/extension/ai/model.json').read_text())
base = f'https://huggingface.co/{pin["id"]}/resolve/{pin["revision"]}/'
for name, record in pin['files'].items():
    if name.startswith('onnx/') and name != pin['variants'][args.backend]['file']:
        continue
    path = args.output / name
    path.parent.mkdir(parents=True, exist_ok=True)
    if path.is_file() and path.stat().st_size == record['size']:
        with path.open('rb') as stream:
            if hashlib.file_digest(stream,'sha256').hexdigest() == record['sha256']:
                print('Verified existing', name, flush=True)
                continue
    temporary = path.with_suffix(path.suffix + '.partial')
    print('Downloading', name, record['size'], 'bytes', flush=True)
    digest = hashlib.sha256()
    count = 0
    with urllib.request.urlopen(base + name, timeout=90) as response, temporary.open('wb') as output:
        while block := response.read(1024 * 1024):
            count += len(block)
            if count > record['size']:
                raise ValueError('Model exceeds pinned size')
            output.write(block)
            digest.update(block)
    if count != record['size'] or digest.hexdigest() != record['sha256']:
        temporary.unlink(missing_ok=True)
        raise ValueError('Model integrity check failed: ' + name)
    temporary.replace(path)
    print('Verified', name, flush=True)
