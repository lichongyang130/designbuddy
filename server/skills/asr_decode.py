#!/usr/bin/env python3
"""Trusted offline PCM decoder. Invoked only by the API-owned process broker."""
import ctypes
import hashlib
import io
import json
import math
import os
from pathlib import Path
import resource
import signal
import struct
import sys

# Hard bounds survive loss of the Node caller. This is not an OS/network sandbox.
resource.setrlimit(resource.RLIMIT_CORE, (0, 0))
resource.setrlimit(resource.RLIMIT_AS, (512*1024*1024, 512*1024*1024))
resource.setrlimit(resource.RLIMIT_CPU, (15, 15))
signal.signal(signal.SIGALRM, signal.SIG_DFL)
signal.alarm(25)
libc = ctypes.CDLL(None, use_errno=True)
if libc.prctl(1, signal.SIGKILL, 0, 0, 0) != 0 or os.getppid() != int(sys.argv[2]):
    os._exit(70)

def exact(n):
    chunks = bytearray()
    while len(chunks) < n:
        part = sys.stdin.buffer.read(n-len(chunks))
        if not part:
            raise ValueError('input')
        chunks.extend(part)
    return bytes(chunks)

try:
    root = Path(sys.argv[1])
    pin = json.loads(Path(__file__).with_name('asr-assets.json').read_text())
    for name, info in pin['files'].items():
        f = root/'site'/name
        if f.stat().st_size != info['size'] or hashlib.sha256(f.read_bytes()).hexdigest() != info['sha256']:
            raise ValueError('model')
    n = struct.unpack('<I', exact(4))[0]
    if n < 16000 or n > 480000 or n % 2:
        raise ValueError('input')
    pcm = exact(n)
    sys.path.insert(0, str(root/'site'))
    from pocketsphinx import Decoder, Segmenter
    p = root/'site/pocketsphinx/model/en-us'
    decoder = Decoder(hmm=str(p/'en-us'), lm=str(p/'en-us.lm.bin'), dict=str(p/'cmudict-en-us.dict'), samprate=16000, loglevel='ERROR')
    regions = []
    for speech in Segmenter(sample_rate=16000).segment(io.BytesIO(pcm)):
        decoder.start_utt()
        decoder.process_raw(speech.pcm, full_utt=True)
        decoder.end_utt()
        hyp = decoder.hyp()
        words = []
        if hyp:
            for word in decoder.seg():
                if not math.isfinite(word.prob):
                    raise ValueError('output')
                words.append({'rawWord':word.word,'startFrame':word.start_frame,'endFrameInclusive':word.end_frame,'posteriorApprox':word.prob})
        regions.append({'speechStart':speech.start_time,'speechEnd':speech.end_time,'hypothesis':hyp.hypstr if hyp else '', 'words':words})
        if len(regions)>32 or sum(len(r['words']) for r in regions)>600:
            raise ValueError('output')
    print(json.dumps({'engine':'pocketsphinx','version':'5.1.1','frameRate':100,'regions':regions}), flush=True)
except Exception:
    # No tracebacks, model paths, source bytes or environment secrets in client errors.
    print(json.dumps({'error':'ASR_DECODE_FAILED'}), flush=True)
    sys.exit(2)
