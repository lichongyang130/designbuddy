#!/usr/bin/env python3
"""Install the pinned, offline English recognizer. No uploaded audio or credentials."""
import hashlib
import io
import json
import os
from pathlib import Path
import platform
import subprocess
import sys
import tempfile
import urllib.request
import zipfile

ROOT = Path(__file__).resolve().parents[1]
PIN = json.loads((ROOT / 'server/skills/asr-assets.json').read_text())
TARGET = Path(os.environ.get('DESIGNBUDDY_ASR_ROOT') or ROOT / 'data/skill-models/asr-en-v1').resolve()
if sys.platform != 'linux' or platform.machine() != 'x86_64' or sys.version_info[:2] != (3, 11):
    raise SystemExit('This pinned runtime requires Linux x86_64 and Python 3.11; no other platform is claimed ready.')

def verify(site):
    for name, info in PIN['files'].items():
        path = site / name
        if not path.is_file() or path.is_symlink() or path.stat().st_size != info['size'] or hashlib.sha256(path.read_bytes()).hexdigest() != info['sha256']:
            raise RuntimeError('Pinned ASR files missing or modified; not overwriting an existing installation: ' + name)

TARGET.parent.mkdir(parents=True, exist_ok=True)
if TARGET.exists():
    verify(TARGET / 'site')
else:
    with urllib.request.urlopen(PIN['wheelURL'], timeout=60) as response:
        wheel = response.read(35_000_001)
    if len(wheel) > 35_000_000 or hashlib.sha256(wheel).hexdigest() != PIN['wheelSHA256']:
        raise SystemExit('ASR wheel hash mismatch; installation not activated.')
    with tempfile.TemporaryDirectory(prefix='.asr-stage-', dir=TARGET.parent) as temp:
        stage = Path(temp) / 'install'
        site = stage / 'site'
        with zipfile.ZipFile(io.BytesIO(wheel)) as archive:
            entries = [entry for entry in archive.infolist() if not entry.is_dir()]
            if len(entries) != len(PIN['files']) or {e.filename for e in entries} != set(PIN['files']):
                raise SystemExit('Unexpected wheel entries.')
            for entry in entries:
                path = site / entry.filename
                if path.resolve().is_relative_to(site.resolve()) is False or entry.file_size != PIN['files'][entry.filename]['size']:
                    raise SystemExit('Unsafe wheel entry.')
                path.parent.mkdir(parents=True, exist_ok=True)
                path.write_bytes(archive.read(entry))
        verify(site)
        stage.rename(TARGET)

# The actual bundled decoder and actual speech must work before enabling the entry.
probe = '''import sys,wave,json
sys.path.insert(0,sys.argv[1])
from pocketsphinx import Decoder
from pathlib import Path
p=Path(sys.argv[1])/'pocketsphinx/model/en-us'
d=Decoder(hmm=str(p/'en-us'),lm=str(p/'en-us.lm.bin'),dict=str(p/'cmudict-en-us.dict'),samprate=16000,loglevel='ERROR')
with wave.open(sys.argv[2],'rb') as f: pcm=f.readframes(f.getnframes())
d.start_utt();d.process_raw(pcm,full_utt=True);d.end_utt()
assert d.hyp().hypstr=='go forward ten meters', 'Actual recognition self-test failed'
print(json.dumps({'hypothesis':d.hyp().hypstr,'audioSamplesUnchanged':True}))
'''
result = subprocess.run([sys.executable, '-I', '-B', '-c', probe, str(TARGET/'site'), str(ROOT/'server/skills/testing/audio/goforward.wav')], check=True, capture_output=True, timeout=30, text=True)
marker = {'wheelSHA256': PIN['wheelSHA256'], 'python': str(Path(sys.executable).resolve()), 'pythonVersion': '3.11', 'selfTest': json.loads(result.stdout)}
temp_marker = TARGET / '.ready.tmp'
temp_marker.write_text(json.dumps(marker, indent=2)+'\n')
temp_marker.replace(TARGET/'ready.json')
print('Offline English ASR verified and configured at', TARGET)
print('Model files remain in ignored data/. Run this setup on each deployment; no runtime downloads.')
