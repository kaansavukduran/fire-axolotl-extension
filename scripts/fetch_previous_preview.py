# SPDX-License-Identifier: GPL-3.0-or-later
"""Fetch the previous public developer preview for an isolated upgrade test."""
import hashlib
from pathlib import Path
import urllib.request

ROOT=Path(__file__).resolve().parents[1]
url='https://github.com/kaansavukduran/fire-axolotl-extension/releases/download/v0.1.0-preview.1/fire-axolotl-extension-0.1.0-native-newtab-unsigned.xpi'
expected='cccc3b5208d0fb5c7bf1fd6b7dbaa91e14771374263f5ba76ac7ce9ed80d0aeb'
path=ROOT/'work/previous-preview-0.1.0.xpi'
path.parent.mkdir(parents=True,exist_ok=True)
if not path.exists() or hashlib.sha256(path.read_bytes()).hexdigest()!=expected:
    temporary=path.with_suffix('.partial')
    with urllib.request.urlopen(url,timeout=90) as src,temporary.open('wb') as dst:
        while block:=src.read(1024*1024):dst.write(block)
    if hashlib.sha256(temporary.read_bytes()).hexdigest()!=expected:
        temporary.unlink(missing_ok=True)
        raise ValueError('Previous preview SHA-256 mismatch')
    temporary.replace(path)
print(path)
