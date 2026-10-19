#!/usr/bin/env python3
"""Build a source deployment bundle from an explicit allowlist; never include live data/secrets."""
import hashlib
import io
import pathlib
import subprocess
import tarfile

root = pathlib.Path(__file__).resolve().parent.parent
output = root / 'releases'
output.mkdir(exist_ok=True)
allowed_dirs = {'assets', 'frontend', 'shared', 'server', 'packages', 'plugins', 'skills', 'design-templates', 'design-systems', 'scripts', 'deploy'}
allowed_files = {'Dockerfile', '.dockerignore', '.gitignore', '.env.auth.example', 'package.json', 'pnpm-lock.yaml', 'pnpm-workspace.yaml'}
files = subprocess.check_output(['git', 'ls-files', '-co', '--exclude-standard', '-z'], cwd=root).decode().split('\0')
selected = []
for name in sorted(set(filter(None, files))):
    p = pathlib.PurePosixPath(name)
    if not (p.parts[0] in allowed_dirs or name in allowed_files or name.startswith('apps/web/')):
        continue
    if any(x in p.parts for x in ('node_modules', 'dist', '.cache', '__pycache__', 'playwright-report', 'test-results')):
        continue
    if any(x.startswith('.env') and x not in ('.env.example', '.env.auth.example') for x in p.parts):
        continue
    path = root / name
    if not path.is_file() or path.is_symlink():
        continue
    if path.suffix in ('.sqlite', '.db') or name.endswith(('.sqlite-wal', '.sqlite-shm')):
        raise RuntimeError('Refusing database: ' + name)
    selected.append(name)
assert 'deploy/.env.example' in selected and 'Dockerfile' in selected
assert len([n for n in selected if n.startswith('apps/web/public/welcome-templates/png/') and n.endswith('.png')]) == 15
prefix = 'designbuddy-server/'
manifest = ''.join(f'{hashlib.sha256((root / n).read_bytes()).hexdigest()}  {n}\n' for n in selected)
archive = output / 'designbuddy-server.tar.gz'
with tarfile.open(archive, 'w:gz', compresslevel=6) as tar:
    for n in selected:
        tar.add(root / n, arcname=prefix + n, recursive=False)
    for n, content in {
        'MANIFEST.sha256': manifest,
        'SOURCE_REVISION.txt': subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=root).decode() + 'Bundled files are authoritative; verify MANIFEST.sha256.\n',
        'README.txt': '安装说明：deploy/README.zh-CN.md\n这是源码部署包；首次启动需要 Docker 联网构建。\n未包含密钥、数据库、桌面 Electron 或 node_modules。\n',
    }.items():
        data = content.encode()
        info = tarfile.TarInfo(prefix + n)
        info.size = len(data)
        info.mode = 0o644
        tar.addfile(info, io.BytesIO(data))
digest = hashlib.sha256(archive.read_bytes()).hexdigest()
(archive.with_name(archive.name + '.sha256')).write_text(f'{digest}  {archive.name}\n')
print(f'{archive}\n{len(selected)} source files; {archive.stat().st_size / 1024 / 1024:.1f} MiB\nSHA256 {digest}')
