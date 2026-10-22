"""Pinboard pieces (redraw_requirements_v1 §4 钉板, factory_resource_v2 §2/§4).

* pegs: plain grey (gives power only -> tiny green core), fire, ice. NO lightning peg.
  hit flash = body +1 step and a ring of feedback pixels (never outlined).
* marbles 6x6: collector = plain silver ball; alchemy = violet + white core + gold glint (2 frames).
* special slots 12x12: recall / multicast / split / relic glyphs on coloured sockets.
* hopper buckets 20x14 with x1/x2/x3 markers; the bucket next to the leak has the highest
  multiplier and a "near leak" warning variant (amber/red hazard stripes).
* background tile 16x16: background-tagged colours only, no outline colour.
* defence line: 1px dashed tile (amber idle / red danger / blue barrier) + end posts.
"""
from __future__ import annotations

from common import Canvas, export, mask_of, offset_bands, shade_mask, stamp_rows
from pxlib import DIGITS_3x5, seeded

PEG = {"plain": "steel", "fire": "pyro", "ice": "cryo"}


def peg(kind, hit=False):
    cv = Canvas(9, 9)
    r = PEG[kind]
    body = mask_of(lambda t: t.ellipse(4.5, 4.5, 2.7, 2.7, "white"), 9, 9)
    shade_mask(cv, body, r, 4 if hit else 3)
    cv.put(3, 3, "white" if hit else f"{r}_5")
    if kind == "plain":
        cv.put(5, 5, "venom_5" if hit else "venom_4")   # power core: plain pegs only give power
    cv.outline()
    if hit:
        ring = {"plain": "venom_5", "fire": "pyro_5", "ice": "cryo_5"}[kind]
        for (x, y) in ((4, 0), (0, 4), (8, 4), (4, 8), (1, 1), (7, 1), (1, 7), (7, 7)):
            cv.put(x, y, ring if (x + y) % 2 == 0 else "white")
    return cv


def marble(kind, phase=0):
    cv = Canvas(6, 6)
    m = mask_of(lambda t: t.ellipse(3, 3, 2.1, 2.1, "white"), 6, 6)
    if kind == "collector":
        shade_mask(cv, m, "steel", 4)
        cv.put(2, 2, "white")
    else:
        shade_mask(cv, m, "echo", 4)
        cv.put(2, 2, "white")
        cv.put(3, 3, "white" if phase == 0 else "echo_5")
        cv.put(3, 2 if phase == 0 else 4, "lightning_5")
    cv.outline()
    return cv


def special_slot(kind):
    sock = {"recall": "cryo", "multicast": "lightning", "split": "pyro", "relic": "echo"}[kind]
    cv = Canvas(12, 12)
    ring = mask_of(lambda t: t.ellipse(6, 6, 5.2, 5.2, "white"), 12, 12)
    shade_mask(cv, ring, sock, 2)
    inner = mask_of(lambda t: t.ellipse(6, 6, 3.9, 3.9, "white"), 12, 12)
    for p in inner:
        cv.put(p[0], p[1], f"{sock}_1")
    g = {
        "recall": ["..w..", ".www.", "w.w.w", "..w..", "www.."],   # up arrow with a return hook
        "multicast": ["w.w.w", "w.w.w", "w.w.w", "w.w.w", "....."],
        "split": ["w...w", ".w.w.", "..w..", "..w..", "..w.."],
        "relic": ["..w..", ".www.", "wwyww", ".www.", "..w.."],
    }[kind]
    stamp_rows(cv, g, {"w": "white", "y": f"{sock}_4"}, 4, 4 if kind != "multicast" else 5)
    cv.outline()
    return cv


def hopper(mult, near_leak=False, w=20, h=14):
    cv = Canvas(w, h)
    rim = {1: ("steel_4", "steel_3"), 2: ("lightning_3", "lightning_2"), 3: ("lightning_5", "lightning_4")}[mult]
    if near_leak:
        rim = ("pyro_5", "pyro_4")
    # bucket body (slightly tapered)
    body = mask_of(lambda t: t.polygon([(1, 2), (w - 1, 2), (w - 3, h - 1), (3, h - 1)], "white"), w, h)
    shade_mask(cv, body, "steel", 3)
    inner = mask_of(lambda t: t.polygon([(3, 3), (w - 3, 3), (w - 4.5, h - 2), (4.5, h - 2)], "white"), w, h)
    for p in inner:
        cv.put(p[0], p[1], "steel_1")
    cv.hline(1, w - 2, 1, rim[0])
    cv.hline(1, w - 2, 2, rim[1])
    # multiplier marker x1/x2/x3 in the well
    col = {1: "steel_4", 2: "lightning_4", 3: "lightning_5"}[mult]
    x = w // 2 - 4
    for ch in "x" + str(mult):
        for j, row in enumerate(DIGITS_3x5[ch]):
            for i, k in enumerate(row):
                if k == "#":
                    cv.put(x + i, 5 + j, col)
        x += 4
    if mult == 3:
        for (px, py) in ((3, 4), (w - 4, 4)):
            cv.put(px, py, "lightning_4")
    if near_leak:
        # amber/red hazard stripes on both inner walls
        for y in range(3, h - 2):
            c = "pyro_3" if (y // 2) % 2 == 0 else "lightning_4"
            for xx in (3, w - 4):
                cv.put(xx, y, c)
    cv.outline()
    return cv


def hopper_divider(h=14):
    cv = Canvas(3, h)
    cv.vline(1, 0, h - 1, "steel_3")
    cv.vline(0, 1, h - 1, "steel_4")
    cv.vline(2, 1, h - 1, "steel_2")
    cv.put(1, 0, "lightning_4")
    cv.put(0, 0, "outline")
    cv.put(2, 0, "outline")
    return cv


def bg_tile(variant=0):
    """16x16 board background: background-tagged colours only (bg_0..bg_2), no outline."""
    rnd = seeded(31 + variant)
    cv = Canvas(16, 16, "bg_0")
    # large flagstones with soft seams
    for x in range(16):
        cv.put(x, 15, "bg_1" if x % 8 else "bg_0")
    for y in range(16):
        cv.put(15 if variant == 0 else 7, y, "bg_1")
    for _ in range(6):
        cv.put(rnd.randrange(1, 14), rnd.randrange(1, 14), "bg_1")
    cv.put(rnd.randrange(2, 12), rnd.randrange(2, 12), "bg_2")
    if variant == 1:
        for (x, y) in ((3, 4), (4, 4), (4, 5)):
            cv.put(x, y, "steel_1")
    return cv


LINE = {"idle": ("lightning_4", "lightning_2"), "danger": ("pyro_4", "pyro_2"), "barrier": ("cryo_4", "cryo_2")}


def defence_tile(state):
    """6x1 dashed tile: 4 on / 2 off."""
    cv = Canvas(6, 1)
    cv.hline(0, 3, 0, LINE[state][0])
    return cv


def defence_post(state):
    cv = Canvas(3, 5)
    hi, lo = LINE[state]
    cv.vline(1, 0, 4, hi)
    cv.put(0, 2, lo)
    cv.put(2, 2, lo)
    cv.put(1, 0, "white" if state != "idle" else "lightning_5")
    return cv


def build():
    export("board", "board_pegs", [(f"{k}{'_hit' if h else ''}", peg(k, h)) for k in PEG for h in (False, True)],
           kind="board", meta_extra={"note": "no lightning peg by design (factory_resource_v2 F1)"})
    export("board", "board_marble_collector", [("collector", marble("collector"))], kind="board")
    export("board", "board_marble_alchemy", [("alchemy_a", marble("alchemy", 0)), ("alchemy_b", marble("alchemy", 1))],
           kind="board")
    export("board", "board_special_slots", [(k, special_slot(k)) for k in ("recall", "multicast", "split", "relic")],
           kind="icon")
    export("board", "board_hopper", [("x1", hopper(1)), ("x2", hopper(2)), ("x3", hopper(3)),
                                     ("x3_near_leak", hopper(3, True))], kind="board",
           meta_extra={"rule": "multiplier rises toward the leak; the bucket next to the leak uses x3_near_leak"})
    export("board", "board_hopper_divider", [("divider", hopper_divider())], kind="board")
    export("board", "board_bg_tile", [("tile_a", bg_tile(0)), ("tile_b", bg_tile(1))], kind="background",
           layer="background")
    export("board", "board_defence_line", [(s, defence_tile(s)) for s in LINE], kind="board",
           meta_extra={"tiling": "repeat horizontally; barrier N layers = N stacked lines 2px apart"})
    export("board", "board_defence_post", [(s, defence_post(s)) for s in LINE], kind="board")


if __name__ == "__main__":
    build()
    print("ok")
