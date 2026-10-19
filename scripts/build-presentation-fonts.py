#!/usr/bin/env python3
"""Maintenance only, NOT a runtime download. pip install fonttools==4.60.1 in a venv.
Obtain the pinned upstream Git blob using gh api, base64-decode its content, and
pass that local variable-font TTF as --source. OFL.txt is shipped separately.
"""
import argparse
import hashlib
from pathlib import Path
import fontTools
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont

SOURCE_HASH = 'a3041811a78c361b1de50f953c805e0244951c21c5bd412f7232ef0d899af0da'
INSTANCES = [
    (400, 'NotoSansSC.ttf', 'eeb06b8a64fd04a2744d95579db1571b51027cda61ed78c62e4b730791525461'),
    (700, 'NotoSansSC-Bold.ttf', 'a8d8569e6cf8e93e830736e64c69568c5499ff65bf6a8ff860f0cdacc3eab7d0'),
]

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source', required=True, type=Path)
    args = parser.parse_args()
    if fontTools.__version__ != '4.60.1':
        raise SystemExit('Use fonttools==4.60.1 for byte-reproducible instances.')
    if hashlib.sha256(args.source.read_bytes()).hexdigest() != SOURCE_HASH:
        raise SystemExit('Upstream variable-font SHA-256 does not match the pinned source.')
    dest = Path(__file__).resolve().parent.parent / 'assets' / 'presentation-fonts'
    dest.mkdir(parents=True, exist_ok=True)
    for weight, name, expected in INSTANCES:
        font = TTFont(args.source, recalcTimestamp=False)
        font = instantiateVariableFont(font, {'wght': weight}, inplace=True, updateFontNames=True)
        font.recalcTimestamp = False
        temporary = dest / (name + '.tmp')
        font.save(temporary)
        digest = hashlib.sha256(temporary.read_bytes()).hexdigest()
        if digest != expected:
            temporary.unlink()
            raise SystemExit(f'{name}: derived hash mismatch; existing font was NOT replaced.')
        temporary.replace(dest / name)
        print(name, digest)

if __name__ == '__main__':
    main()
