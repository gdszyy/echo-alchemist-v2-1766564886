"""ui_factory_strip: 9-slice frames, slot states, top bar, 10x10 resource icons, 3x5 digits.

Intent (layout_wireframe_v2.html, factory_resource_v2.md §3):
* The strip is the player's "home": a muted iron bench with brass corner brackets.
  Muted = steel 1-3 + dull brass; it must not compete with devices or enemies.
* Slot states read by *structure*, not only colour:
    empty    -> dashed border + faint plus (you can build here)
    occupied -> solid border, brass corners, lit inner rim
    unpowered-> solid but dim border, dark well, tiny red corner lamp
    locked   -> dashed dim border + padlock glyph (needs the "expansion platform")
* Icons (10x10) carry one symbol + one element colour each: battery=power (green),
  flame=fire, faceted crystal=ice, zig-zag=lightning, cut gem=crystal.
"""
from __future__ import annotations

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from pxlib import DIGITS_3x5, Canvas, export_sheet  # noqa: E402


# ----------------------------------------------------------------------------- 9-slice panels
def strip_9slice() -> Canvas:
    """24x24 source, slice = 8px corners. Iron bench with brass corner brackets."""
    s = 24
    cv = Canvas(s, s, "steel_1")
    cv.rect(0, 0, s, s, "outline", fill=False)
    cv.hline(1, s - 2, 1, "steel_3")      # lit top lip
    cv.hline(1, s - 2, 2, "steel_2")
    cv.vline(1, 2, s - 2, "steel_2")
    cv.vline(s - 2, 2, s - 2, "steel_1")
    cv.hline(1, s - 2, s - 2, "outline")
    # brass L-brackets in the 4 corners
    for (cx, cy, sx, sy) in ((1, 1, 1, 1), (s - 2, 1, -1, 1), (1, s - 2, 1, -1), (s - 2, s - 2, -1, -1)):
        for i in range(5):
            cv.put(cx + sx * i, cy, "lightning_2" if sy < 0 else "lightning_3")
            cv.put(cx, cy + sy * i, "lightning_2" if sx < 0 else "lightning_3")
        cv.put(cx + sx * 2, cy + sy * 2, "lightning_2")  # rivet
    return cv


def topbar_9slice() -> Canvas:
    """24x17 source; slice left/right 6, top 1, bottom 4. Dark band with a brass rail at the bottom."""
    w, h = 24, 17
    cv = Canvas(w, h, "steel_1")
    cv.hline(0, w - 1, 0, "steel_2")
    cv.hline(0, w - 1, h - 4, "steel_2")
    cv.hline(0, w - 1, h - 3, "lightning_3")
    cv.hline(0, w - 1, h - 2, "lightning_2")
    cv.hline(0, w - 1, h - 1, "outline")
    for x in (2, w - 3):
        cv.put(x, h - 3, "lightning_4")
    return cv


# ----------------------------------------------------------------------------- slots
def slot_frame(state: str, size: int = 28) -> Canvas:
    s = size
    cv = Canvas(s, s)
    if state in ("empty", "locked"):
        dash = "steel_3" if state == "empty" else "steel_2"
        cv.rect(1, 1, s - 2, s - 2, "steel_1")       # recessed well
        for i in range(s):
            on = (i // 2) % 2 == 0
            if on:
                for p in ((i, 0), (i, s - 1), (0, i), (s - 1, i)):
                    cv.put(p[0], p[1], dash)
        if state == "empty":
            c = s // 2
            cv.hline(c - 3, c + 2, c - 1, "steel_2")
            cv.hline(c - 3, c + 2, c, "steel_2")
            cv.vline(c - 1, c - 4, c + 3, "steel_2")
            cv.vline(c, c - 4, c + 3, "steel_2")
        else:
            padlock(cv, s // 2 - 4, s // 2 - 5)
        return cv
    dim = state == "unpowered"
    edge_hi, edge, edge_lo = ("steel_2", "steel_2", "steel_1") if dim else ("steel_4", "steel_3", "steel_2")
    brass_hi, brass_lo = ("stone_2", "stone_1") if dim else ("lightning_3", "lightning_2")
    cv.rect(0, 0, s, s, "outline", fill=False)
    cv.rect(1, 1, s - 2, s - 2, edge)
    cv.hline(1, s - 2, 1, edge_hi)
    cv.vline(1, 1, s - 2, edge_hi)
    cv.hline(1, s - 2, s - 2, edge_lo)
    cv.vline(s - 2, 1, s - 2, edge_lo)
    well = "steel_2" if not dim else "steel_1"
    cv.rect(2, 2, s - 4, s - 4, well)
    if not dim:
        cv.hline(2, s - 3, 2, "steel_1")       # inner shadow under the lip
        cv.vline(2, 2, s - 3, "steel_1")
    for (cx, cy, sx, sy) in ((0, 0, 1, 1), (s - 1, 0, -1, 1), (0, s - 1, 1, -1), (s - 1, s - 1, -1, -1)):
        for i in range(4):
            cv.put(cx + sx * i, cy, brass_hi if sy > 0 else brass_lo)
            cv.put(cx, cy + sy * i, brass_hi if sx > 0 else brass_lo)
    if dim:
        for p in ((s - 4, 2), (s - 3, 2)):
            cv.put(p[0], p[1], "pyro_3")          # small red "no power" corner lamp
    return cv


def padlock(cv: Canvas, x: int, y: int) -> None:
    """8x10 padlock glyph."""
    g = [
        "..oooo..",
        ".o3333o.",
        ".o3oo3o.",
        ".o3oo3o.",
        "oooooooo",
        "o433322o",
        "o43oo22o",
        "o432o22o",
        "o432222o",
        "oooooooo",
    ]
    cmap = {"o": "outline", "3": "steel_3", "4": "lightning_3", "2": "lightning_2"}
    for j, r in enumerate(g):
        for i, ch in enumerate(r):
            if ch == ".":
                continue
            cv.put(x + i, y + j, cmap[ch])


# ----------------------------------------------------------------------------- icons 10x10
ICONS = {
    "power": ([
        "....ss....",
        "..oossoo..",
        "..o2222o..",
        "..o5443o..",
        "..o5443o..",
        "..o2222o..",
        "..o5443o..",
        "..o5443o..",
        "..o5443o..",
        "..oooooo..",
    ], {"s": "steel_4", "o": "outline", "2": "steel_2", "5": "venom_5", "4": "venom_4", "3": "venom_3"}, False),
    "fire": ([
        "..........",
        "....3.....",
        "....43....",
        "...443.3..",
        "...34433..",
        "..3445443.",
        "..3455543.",
        "..3455543.",
        "...34443..",
        "..........",
    ], {"3": "pyro_3", "4": "pyro_4", "5": "pyro_5"}, True),
    "ice": ([
        "..........",
        "....54....",
        "...5443...",
        "..554433..",
        "..544332..",
        "..544332..",
        "..443322..",
        "...4332...",
        "....32....",
        "..........",
    ], {"5": "cryo_5", "4": "cryo_4", "3": "cryo_3", "2": "cryo_2"}, True),
    "lightning": ([
        "..........",
        ".....554..",
        "....554...",
        "...554....",
        "..5555544.",
        ".....443..",
        "....443...",
        "...43.....",
        "..3.......",
        "..........",
    ], {"5": "lightning_5", "4": "lightning_4", "3": "lightning_3"}, True),
    "crystal": ([
        "..........",
        "...5443...",
        "..554433..",
        ".22222222.",
        ".54443332.",
        "..544332..",
        "...4432...",
        "....43....",
        "..........",
        "..........",
    ], {"5": "echo_5", "4": "echo_4", "3": "echo_3", "2": "echo_2"}, True),
}


def icon(name: str) -> Canvas:
    rows, cmap, auto = ICONS[name]
    cv = Canvas(10, 10)
    cv.grid(rows, cmap)
    if auto:
        cv.outline()
    return cv


def digits_canvas(ch: str, c: str = "stone_5") -> Canvas:
    cv = Canvas(3, 5)
    for j, r in enumerate(DIGITS_3x5[ch]):
        for i, k in enumerate(r):
            if k == "#":
                cv.put(i, j, c)
    return cv


def main():
    export_sheet("ui_strip_9slice", [("strip_9slice_8px", strip_9slice())], kind="ui",
                 meta_extra={"nine_slice": {"left": 8, "right": 8, "top": 8, "bottom": 8}})
    export_sheet("ui_topbar_9slice", [("topbar_9slice", topbar_9slice())], kind="ui",
                 meta_extra={"nine_slice": {"left": 6, "right": 6, "top": 1, "bottom": 4}})
    export_sheet("ui_slot_frames", [(s, slot_frame(s)) for s in ("empty", "occupied", "unpowered", "locked")], kind="ui")
    export_sheet("ui_icons_10", [(n, icon(n)) for n in ("power", "fire", "ice", "lightning", "crystal")], kind="icon", scale=6)
    export_sheet("ui_font_3x5", [(k if k != "/" else "slash", digits_canvas(k)) for k in "0123456789/"], kind="font")


if __name__ == "__main__":
    main()
    print("ok")
