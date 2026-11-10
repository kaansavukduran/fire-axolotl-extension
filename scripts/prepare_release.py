# SPDX-License-Identifier: GPL-3.0-or-later
"""Stage developer binaries, matching source, source obligations and SHA256SUMS."""
from pathlib import Path
import hashlib
import json
import shutil
import subprocess
import zipfile
ROOT = Path(__file__).resolve().parents[1]
if subprocess.check_output(['git', 'status', '--porcelain'], cwd=ROOT).strip():
    raise ValueError('Release requires a clean commit')
commit = subprocess.check_output(['git','rev-parse','HEAD'],cwd=ROOT,text=True).strip()
stage=ROOT/'work/release'
if stage.exists():shutil.rmtree(stage)
stage.mkdir(parents=True)
version = json.loads((ROOT/'browser/extension/manifest.json').read_text())['version']
packages = [ROOT/f'dist/fire-axolotl-extension-{version}-unsigned.xpi', ROOT/f'dist/fire-axolotl-extension-{version}-native-newtab-unsigned.xpi']
for p in [*packages, ROOT/'work/components/ublock-origin-1.76.0-corresponding-source.tar.gz',ROOT/'work/components/ublock-origin.json',ROOT/'work/ai-support/eigen-mpl-corresponding-source.zip',ROOT/'work/ai-support/AI-SUPPORT-SOURCES.json',ROOT/'work/bergamot-support/bergamot-corresponding-source.tar.gz',ROOT/'work/bergamot-support/BERGAMOT-SOURCES.json']:
    shutil.copyfile(p,stage/p.name)
assert len(list(stage.glob('*.xpi')))==2
source=stage/f'fire-axolotl-extension-{commit[:12]}-source.zip'
subprocess.run(['git','archive','--format=zip','--prefix=fire-axolotl-extension/',f'--output={source}',commit],cwd=ROOT,check=True)
with zipfile.ZipFile(stage/f'fire-axolotl-extension-{version}-test-evidence.zip','w',zipfile.ZIP_DEFLATED) as z:
    for p in sorted((ROOT/'docs/evidence').glob('*')):z.write(p,p.relative_to(ROOT).as_posix())
    z.write(ROOT/'docs/VALIDATION.md','docs/VALIDATION.md')
for p in stage.glob('*.zip'):
    with zipfile.ZipFile(p) as z:assert z.testzip() is None
(stage/'SHA256SUMS').write_text(''.join(f'{hashlib.sha256(p.read_bytes()).hexdigest()}  {p.name}\n' for p in sorted(stage.iterdir()) if p.is_file() and p.name!='SHA256SUMS'))
print(stage)
