"""unescape_cjk.py - turn \\uXXXX escapes of CJK text in JS source into literal characters.

Escaped Chinese hides from text review and from tools/pixel_art/t2s.py (a file can be
"clean" while the screen shows Traditional characters). Only escapes that decode to CJK
ideographs, CJK punctuation or full-width forms are rewritten; the value of every string
literal / template literal / regex stays identical.

    python tools/pixel_art/unescape_cjk.py --scan
    python tools/pixel_art/unescape_cjk.py --apply
"""
from __future__ import annotations

import argparse
import os
import re
import sys

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
# tests/ 不处理：validate_pixel_art_mode.mjs 故意用转义写一个繁体探针字，避免它出现在源码里
TARGETS = ['index.html', 'src']
SKIP_DIRS = {'node_modules', 'assets', 'archive'}
EXTS = {'.js', '.mjs', '.html'}
ESC = re.compile(r'(?<!\\)((?:\\\\)*)\\u([0-9a-fA-F]{4})')


def is_cjk(cp: int) -> bool:
    return (0x3400 <= cp <= 0x9FFF or 0x3000 <= cp <= 0x303F or 0xFF00 <= cp <= 0xFFEF
            or 0xF900 <= cp <= 0xFAFF)


def convert(text: str):
    n = 0

    def rep(m):
        nonlocal n
        cp = int(m.group(2), 16)
        if not is_cjk(cp):
            return m.group(0)
        n += 1
        return m.group(1) + chr(cp)

    return ESC.sub(rep, text), n


def iter_files():
    for t in TARGETS:
        p = os.path.join(ROOT, t)
        if os.path.isfile(p):
            yield p
            continue
        for dirpath, dirnames, filenames in os.walk(p):
            dirnames[:] = sorted(d for d in dirnames if d not in SKIP_DIRS)
            for fn in sorted(filenames):
                if os.path.splitext(fn)[1] in EXTS:
                    yield os.path.join(dirpath, fn)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--scan', action='store_true')
    ap.add_argument('--apply', action='store_true')
    args = ap.parse_args()
    total = 0
    for path in iter_files():
        with open(path, encoding='utf-8', newline='') as fh:
            text = fh.read()
        new, n = convert(text)
        if not n:
            continue
        total += n
        print(f'{n:6d}  {os.path.relpath(path, ROOT)}')
        if args.apply:
            with open(path, 'w', encoding='utf-8', newline='') as fh:
                fh.write(new)
            with open(path, encoding='utf-8', newline='') as fh:
                assert fh.read() == new, path
    print(f'{total} escaped CJK characters', file=sys.stderr)


if __name__ == '__main__':
    main()
