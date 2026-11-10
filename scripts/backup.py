# SPDX-License-Identifier: MPL-2.0
"""Create and verify a source ZIP, complete reachable Git bundle and commit receipt."""
import argparse
from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path
import re
import subprocess
import zipfile
from zoneinfo import ZoneInfo

ROOT = Path(__file__).resolve().parents[1]


def git(*args):
    return subprocess.check_output(['git', *args], cwd=ROOT).decode().strip()


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--output', type=Path, default=ROOT / 'work/backups')
    args = parser.parse_args()
    if git('status', '--porcelain'):
        raise ValueError('Commit or preserve local changes before making a commit-matched backup')
    commit = git('rev-parse', 'HEAD')
    # Scan all reachable text blobs without printing any matching secret values.
    patterns = [rb'-----BEGIN (?:RSA |EC |OPENSSH |ENCRYPTED )?PRIVATE KEY-----', rb'\b(?:gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{40,})\b', rb'\bAKIA[A-Z0-9]{16}\b']
    for line in git('rev-list', '--objects', '--all').splitlines():
        parts = line.split(' ', 1)
        if len(parts) < 2:
            continue
        sha, path = parts
        if git('cat-file', '-t', sha) != 'blob':
            continue
        body = subprocess.check_output(['git', 'cat-file', 'blob', sha], cwd=ROOT)
        if b'\0' in body[:4096]:
            continue
        if any(re.search(pattern, body) for pattern in patterns):
            raise ValueError(f'Potential credential in reachable history at {path}; refusing to create backup')
    output = args.output.resolve()
    output.mkdir(parents=True, exist_ok=True)
    prefix = f'fire-axolotl-extension-{commit[:12]}'
    source = output / f'{prefix}-source.zip'
    bundle = output / f'{prefix}-history.bundle'
    subprocess.run(['git', 'archive', '--format=zip', '--prefix=fire-axolotl-extension/', f'--output={source}', commit], cwd=ROOT, check=True)
    subprocess.run(['git', 'bundle', 'create', str(bundle), '--all'], cwd=ROOT, check=True)
    with zipfile.ZipFile(source) as archive:
        if archive.testzip() is not None:
            raise ValueError('Source ZIP failed verification')
    subprocess.run(['git', 'bundle', 'verify', str(bundle)], cwd=ROOT, check=True)
    now = datetime.now(timezone.utc)
    receipt = {
        'repository': git('remote', 'get-url', 'origin'),
        'branch': git('branch', '--show-current'), 'commit': commit,
        'created_utc': now.isoformat(), 'created_istanbul': now.astimezone(ZoneInfo('Europe/Istanbul')).isoformat(),
        'refs': git('show-ref').splitlines(),
        'files': {p.name: {'bytes': p.stat().st_size, 'sha256': hashlib.sha256(p.read_bytes()).hexdigest()} for p in [source, bundle]},
        'verification': ['source ZIP CRC verified', 'git bundle verify passed', 'common credential-pattern scan of reachable text blobs passed'],
        'limitations': 'Pattern scanning is not a guarantee that no secret exists. This backs up the independent extension source and full reachable Git history. User profiles, cached model weights and credentials are excluded. Pinned third-party runtime/model inputs are documented in components.json, package-lock.json and browser/extension/ai/model.json.'
    }
    metadata = output / f'{prefix}-metadata.json'
    metadata.write_text(json.dumps(receipt, indent=2, ensure_ascii=False) + '\n')
    print(json.dumps({'files': [str(p) for p in [source, bundle, metadata]], 'commit': commit}, indent=2))


if __name__ == '__main__':
    main()
