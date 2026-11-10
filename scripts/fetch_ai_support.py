# SPDX-License-Identifier: GPL-3.0-or-later
"""Retain Eigen MPL source corresponding to the bundled ONNX Runtime pin."""
from pathlib import Path
import hashlib
import json
import urllib.request
import zipfile

ROOT = Path(__file__).resolve().parents[1]
PIN = {
    'onnxruntime_commit': 'f217402897f40ebba457e2421bc0a4702771968e',
    'component': 'Eigen', 'license': 'MPL-2.0',
    'commit': '1d8b82b0740839c0de7f1242a3585e3390ff5f33',
    'url': 'https://github.com/eigen-mirror/eigen/archive/1d8b82b0740839c0de7f1242a3585e3390ff5f33/eigen-1d8b82b0740839c0de7f1242a3585e3390ff5f33.zip',
    'sha1': '05b19b49e6fbb91246be711d801160528c135e34',
    'provenance': 'Eigen commit from pinned ONNX Runtime cmake/deps.txt. The exact commit is obtained from its public GitHub mirror; archive packaging differs from GitLab. Unmodified source, not executed.'
}
destination = ROOT / 'work/ai-support'
destination.mkdir(parents=True, exist_ok=True)
archive = destination / 'eigen-mpl-corresponding-source.zip'
if not archive.exists():
    with urllib.request.urlopen(PIN['url'], timeout=60) as response:
        data = response.read(20_000_001)
    if len(data) > 20_000_000:
        raise ValueError('Unexpected Eigen source archive size')
    if hashlib.sha1(data).hexdigest() != PIN['sha1']:
        raise ValueError('Eigen source pin mismatch')
    archive.write_bytes(data)
data = archive.read_bytes()
assert hashlib.sha1(data).hexdigest() == PIN['sha1']
with zipfile.ZipFile(archive) as source:
    assert source.testzip() is None
    assert any(name.endswith('/COPYING.MPL2') for name in source.namelist())
(destination / 'AI-SUPPORT-SOURCES.json').write_text(json.dumps({**PIN, 'sha256': hashlib.sha256(data).hexdigest()}, indent=2) + '\n')
print(archive)
