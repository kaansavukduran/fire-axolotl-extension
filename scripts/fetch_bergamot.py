# SPDX-License-Identifier: MPL-2.0
"""Prepare the pinned local Bergamot runtime, bundled EN/TR models and source.

Downloads are verified data/source inputs; no downloaded build script is run.
The runtime uses only packaged assets, without native Firefox translation APIs.
"""
import argparse
import base64
import gzip
import hashlib
import io
import json
from pathlib import Path, PurePosixPath
import shutil
import subprocess
import tarfile
import urllib.request
from fetch_components import source_checkout, git

ROOT=Path(__file__).resolve().parents[1]
PIN=ROOT/'browser/extension/ai/bergamot-model.json'
CACHE=ROOT/'work/bergamot-data'
OUTPUT=ROOT/'work/bergamot-runtime'
SUPPORT=ROOT/'work/bergamot-support'

def digest(data):return hashlib.sha256(data).hexdigest()

def download(url, limit):
    with urllib.request.urlopen(url,timeout=90) as response:data=response.read(limit+1)
    if len(data)>limit:raise ValueError('Bergamot input exceeds its pinned size budget')
    return data

def file_data(name,record):
    path=CACHE/name
    if not path.is_file():
        data=download(record['url'],record['size'])
        if len(data)!=record['size'] or digest(data)!=record['sha256']:raise ValueError('Bergamot data pin mismatch: '+name)
        path.write_bytes(data)
    data=path.read_bytes()
    if len(data)!=record['size'] or digest(data)!=record['sha256']:raise ValueError('Bergamot cached input mismatch: '+name)
    return data

def prepare(with_sources=False):
    CACHE.mkdir(parents=True,exist_ok=True);SUPPORT.mkdir(parents=True,exist_ok=True)
    pin=json.loads(PIN.read_text());component=json.loads((ROOT/'components.json').read_text())['bergamot']
    package=CACHE/'bergamot-translator-0.4.9.tgz'
    if not package.exists():package.write_bytes(download(component['url'],8_000_000))
    data=package.read_bytes()
    if 'sha512-'+base64.b64encode(hashlib.sha512(data).digest()).decode()!=component['integrity']:raise ValueError('Bergamot npm integrity mismatch')
    members={}
    with tarfile.open(fileobj=io.BytesIO(data),mode='r:gz') as archive:
        total=0
        for entry in archive.getmembers():
            path=PurePosixPath(entry.name)
            if path.is_absolute() or '..' in path.parts or not entry.isfile():raise ValueError('Unexpected Bergamot package member')
            total+=entry.size
            if total>10_000_000:raise ValueError('Bergamot package size exceeded')
            members[entry.name.removeprefix('package/')]=archive.extractfile(entry).read()
    for name,record in component['files'].items():
        if len(members[name])!=record['size'] or digest(members[name])!=record['sha256']:raise ValueError('Bergamot runtime pin mismatch: '+name)
    source=source_checkout('bergamot',component['sources'])
    git(source,'submodule','update','--init','--recursive','--depth=1')
    # Every submodule must be initialized at the commit recorded by its parent.
    submodules=git(source,'submodule','status','--recursive').splitlines()
    if any(line[:1] in ['-','+','U'] for line in submodules):raise ValueError('Incomplete or modified Bergamot submodule tree')
    source_files=sorted(filter(None,subprocess.check_output(['git','-C',str(source),'ls-files','-z','--recurse-submodules']).decode().split('\0')))
    if OUTPUT.exists():shutil.rmtree(OUTPUT)
    OUTPUT.mkdir(parents=True)
    for name in ['bergamot-translator-worker.js','bergamot-translator-worker.wasm']:(OUTPUT/name).write_bytes(members['worker/'+name])
    # Retain the MPL binding classes. Node-only eval and the generic reflective
    # RPC dispatcher are not included in the browser distribution.
    original=members['worker/translator-worker.js'].decode()
    start=original.index('class YAML {');end=original.index('/**\n * Because you can\'t put an Error object')
    binding='/* SPDX-License-Identifier: MPL-2.0\n * Adapted from browsermt/bergamot-translator 0.4.9; Node compatibility and generic RPC removed.\n */\nvar Module = {};\n'+original[start:end]
    binding=binding.replace("self.importScripts('bergamot-translator-worker.js');","try {self.importScripts('bergamot-translator-worker.js');} catch(error) {throw new Error('Bergamot engine script import: '+error.message);}")
    (OUTPUT/'binding.js').write_text(binding)
    bridge=ROOT/'browser/extension/ai/bergamot/worker.js'
    shutil.copyfile(bridge,OUTPUT/'worker.js')
    model_license=file_data('MODEL-LICENSE.txt',{'url':pin['licenseURL'],'size':pin['licenseSize'],'sha256':pin['licenseSHA256']})
    (OUTPUT/'MODEL-LICENSE.txt').write_bytes(model_license)
    for name,record in pin['files'].items():(OUTPUT/name).write_bytes(file_data(name,record))
    model_metadata={}
    for pair in pin['pairs']:
        name=pair['source']+pair['target']
        url=f'https://raw.githubusercontent.com/mozilla/firefox-translations-models/{pin["revision"]}/models/tiny/{name}/metadata.json'
        path=CACHE/(name+'-metadata.json')
        if not path.exists():path.write_bytes(download(url,200_000))
        metadata=json.loads(path.read_text())
        if metadata['hash']!=pin['files'][pair['model']]['sha256']:raise ValueError('Model metadata does not match the distributed model')
        model_metadata[name]=metadata
    (OUTPUT/'MODEL-METADATA.json').write_text(json.dumps(model_metadata,indent=2)+'\n')
    notices=['\n===== Emscripten 3.1.8 runtime =====\n'+file_data('EMSCRIPTEN-LICENSE.txt',component['emscripten_runtime_license']).decode()]
    for relative in source_files:
        path=source/relative
        if not path.is_symlink() and path.name.upper().startswith(('LICENSE','LICENCE','COPYING','NOTICE')):
            body=path.read_bytes()
            if len(body)<=200_000:
                notices.append('\n===== '+relative+' =====\n'+body.decode('utf-8',errors='replace'))
    (OUTPUT/'ENGINE-NOTICES.txt').write_text('Bergamot 0.4.9 source-tree license inventory; not every optional dependency is compiled. Matching source archive and build instructions accompany the release.\n'+''.join(notices))
    canonical_submodules={line.split()[1]:line.split()[0] for line in submodules}
    receipt={'component':component,'model_manifest_sha256':digest(PIN.read_bytes()),'bridge_sha256':digest(bridge.read_bytes()),'submodules':canonical_submodules,'runtime_files':{p.name:digest(p.read_bytes()) for p in sorted(OUTPUT.iterdir())},'source':'Matching full source/submodules, original npm input, model data and training metadata are supplied in bergamot-corresponding-source.tar.gz.'}
    (OUTPUT/'RUNTIME.json').write_text(json.dumps(receipt,indent=2)+'\n')
    (SUPPORT/'BERGAMOT-SOURCES.json').write_text(json.dumps(receipt,indent=2)+'\n')
    if with_sources:
        target=SUPPORT/'bergamot-corresponding-source.tar.gz'
        with target.open('wb') as raw,gzip.GzipFile(filename='',fileobj=raw,mode='wb',mtime=0) as compressed,tarfile.open(fileobj=compressed,mode='w|') as archive:
            def add(name,body,mode=0o644):
                info=tarfile.TarInfo(name);info.size=len(body);info.mode=mode;info.mtime=0;archive.addfile(info,io.BytesIO(body))
            add('README-SOURCE.txt',('Unmodified Bergamot 0.4.9 npm WASM distribution, exact upstream source and recursive submodules.\nMPL-2.0; retain each individual dependency notice.\nThe npm build recipe is in source/wasm/module/package.json and uses Emscripten 3.1.8:\n emcmake cmake -DCOMPILE_WASM=on -DWORMHOLE=off /src\n emmake make -j2\nSee the upstream build-wasm.sh and CMake files. Compiler/toolchain installation is separate.\nAion adaptations and build integration are in the matching extension source commit (scripts/fetch_bergamot.py and browser/extension/ai/bergamot/worker.js).\nMozilla EN/TR model data is copied unmodified, with its MPL license and published training metadata. Source: '+pin['source']+'\nModel training is not claimed reproducible from these exported weights; training metadata and upstream pipeline links are retained.\n').encode())
            add('npm/'+package.name,data)
            add('EMSCRIPTEN-LICENSE.txt',(CACHE/'EMSCRIPTEN-LICENSE.txt').read_bytes())
            add('models/MODEL-LICENSE.txt',model_license);add('models/manifest.json',PIN.read_bytes());add('models/metadata.json',json.dumps(model_metadata,indent=2).encode())
            for name in pin['files']:add('models/'+name,(OUTPUT/name).read_bytes())
            for relative in source_files:
                path=source/relative
                if path.is_symlink():
                    info=tarfile.TarInfo('source/'+relative);info.type=tarfile.SYMTYPE;info.linkname=str(path.readlink());info.mode=0o777;info.mtime=0;archive.addfile(info)
                else:add('source/'+relative,path.read_bytes(),0o755 if path.stat().st_mode&0o111 else 0o644)
        receipt['corresponding_source_sha256']=digest(target.read_bytes());(SUPPORT/'BERGAMOT-SOURCES.json').write_text(json.dumps(receipt,indent=2)+'\n')
    return OUTPUT

if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--with-sources',action='store_true');args=parser.parse_args();print(prepare(args.with_sources))
