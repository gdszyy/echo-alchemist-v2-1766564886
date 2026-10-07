"""english_ui_scan.py - list player-visible English in UI strings (floating texts, toasts, names, labels).

The UI language is Simplified Chinese (docs/design/pixel_art_mode.md §3.1); English is
allowed only for the brand name, unit-like tokens (SP, Lv., CRT, x2, FPS) and code ids.
This scan is a review aid: it lists candidate strings with file:line, not a hard gate.

    python tools/pixel_art/english_ui_scan.py [--all]
"""
from __future__ import annotations

import os
import re
import sys

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
SKIP_DIRS = {'node_modules', 'world_sim', 'tools'}
SKIP_FILES = {'pixel_css_art_paths.js'}

# 调用 / 字段：这些位置的字符串会显示给玩家
SINKS = re.compile(
    r"(spawn_createFloatingText|showToast|createFloatingText|_toast|\.textContent\s*=|\.innerText\s*=|\.title\s*=|"
    r"\b(?:name|desc|label|title|hint|text|subtitle|sub|tip|message|summary)\s*:)"
)
STR = re.compile(r"""(['"`])((?:\\.|(?!\1).)*?)\1""")
ALLOWED = re.compile(r"^(?:SP|Lv\.?|CRT|FPS|HP|Boss|x\d+|X\d+|OK|UI|Echo Alchemist|ECHO ALCHEMIST)$", re.I)
WORD = re.compile(r"[A-Za-z][A-Za-z'\-]{2,}")


def interesting(text: str) -> bool:
    t = re.sub(r"\$\{[^}]*\}", " ", text)
    t = re.sub(r"<[^>]+>", " ", t)  # tags
    t = re.sub(r"(?:class|style|id|data-[\w-]+|aria-[\w-]+|title|alt|type|role)=\S+", " ", t)
    words = [w for w in WORD.findall(t) if not ALLOWED.match(w)]
    if not words:
        return False
    if re.fullmatch(r"[\w\-./#:%() ,]*", t.strip()) and len(words) == 1 and not t.strip().isupper():
        return False  # 单个小写 id / 路径 / css 片段
    return True


def main():
    show_all = '--all' in sys.argv
    hits = 0
    for base in ('src',):
        for dp, dns, fs in os.walk(os.path.join(ROOT, base)):
            dns[:] = [d for d in dns if d not in SKIP_DIRS]
            for f in sorted(fs):
                if not f.endswith('.js') or f in SKIP_FILES:
                    continue
                p = os.path.join(dp, f)
                for i, line in enumerate(open(p, encoding='utf-8'), 1):
                    s = line.strip()
                    if s.startswith('//') or s.startswith('*') or 'console.' in s:
                        continue
                    if not show_all and not SINKS.search(line):
                        continue
                    for m in STR.finditer(line):
                        txt = m.group(2)
                        if interesting(txt):
                            hits += 1
                            print(f"{os.path.relpath(p, ROOT)}:{i}: {txt[:110]}")
    print(f'{hits} candidate strings', file=sys.stderr)


if __name__ == '__main__':
    main()
