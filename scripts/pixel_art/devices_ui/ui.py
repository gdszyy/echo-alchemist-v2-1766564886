"""Factory strip + top bar + factory-screen UI pieces (same material language as the samples).

Function first (layout_wireframe_v2.html, factory_resource_v2.md §3, redraw_requirements §5):
* strip / slots / top bar: re-exported from the approved sample design (unchanged look);
* cannon bay: the only violet-cornered, double-rimmed frame -> the hero's home;
* conduits: power runs between slots; powered = green dashes moving, unpowered = dead cable;
* hopper intake: the strip's top edge where board materials fall "into the house";
* blueprint card: 24x24 icon well + rarity border; cost chips: element icon + 3x5 digits;
* power budget bar pieces: fill / empty / over-budget (red hatched) / limit marker;
* 开战 button, modal panel: 9-slice; magazine slot per element; item icons; damage plates.
"""
from __future__ import annotations

from common import Canvas, export, mask_of, offset_bands, shade_mask, stamp_rows
from pxlib import DIGITS_3x5

ELEM = {"power": "venom", "fire": "pyro", "ice": "cryo", "lightning": "lightning", "crystal": "echo"}


# ============================================================================= approved re-exports
def strip_9slice():
    s = 24
    cv = Canvas(s, s, "steel_1")
    cv.rect(0, 0, s, s, "outline", fill=False)
    cv.hline(1, s - 2, 1, "steel_3")
    cv.hline(1, s - 2, 2, "steel_2")
    cv.vline(1, 2, s - 2, "steel_2")
    cv.vline(s - 2, 2, s - 2, "steel_1")
    cv.hline(1, s - 2, s - 2, "outline")
    for (cx, cy, sx, sy) in ((1, 1, 1, 1), (s - 2, 1, -1, 1), (1, s - 2, 1, -1), (s - 2, s - 2, -1, -1)):
        for i in range(5):
            cv.put(cx + sx * i, cy, "lightning_2" if sy < 0 else "lightning_3")
            cv.put(cx, cy + sy * i, "lightning_2" if sx < 0 else "lightning_3")
        cv.put(cx + sx * 2, cy + sy * 2, "lightning_2")
    return cv


def topbar_9slice():
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


def padlock(cv, x, y):
    g = ["..oooo..", ".o3333o.", ".o3oo3o.", ".o3oo3o.", "oooooooo",
         "o433322o", "o43oo22o", "o432o22o", "o432222o", "oooooooo"]
    stamp_rows(cv, g, {"o": "outline", "3": "steel_3", "4": "lightning_3", "2": "lightning_2"}, x, y)


def slot_frame(state, s=28):
    cv = Canvas(s, s)
    if state in ("empty", "locked"):
        dash = "steel_3" if state == "empty" else "steel_2"
        cv.rect(1, 1, s - 2, s - 2, "steel_1")
        for i in range(s):
            if (i // 2) % 2 == 0:
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
    cv.rect(2, 2, s - 4, s - 4, "steel_1" if dim else "steel_2")
    if not dim:
        cv.hline(2, s - 3, 2, "steel_1")
        cv.vline(2, 2, s - 3, "steel_1")
    for (cx, cy, sx, sy) in ((0, 0, 1, 1), (s - 1, 0, -1, 1), (0, s - 1, 1, -1), (s - 1, s - 1, -1, -1)):
        for i in range(4):
            cv.put(cx + sx * i, cy, brass_hi if sy > 0 else brass_lo)
            cv.put(cx, cy + sy * i, brass_hi if sx > 0 else brass_lo)
    if dim:
        cv.put(s - 4, 2, "pyro_3")
        cv.put(s - 3, 2, "pyro_3")
    return cv


ICONS10 = {
    "power": (["....ss....", "..oossoo..", "..o2222o..", "..o5443o..", "..o5443o..",
               "..o2222o..", "..o5443o..", "..o5443o..", "..o5443o..", "..oooooo.."],
              {"s": "steel_4", "o": "outline", "2": "steel_2", "5": "venom_5", "4": "venom_4", "3": "venom_3"}, False),
    "fire": (["..........", "....3.....", "....43....", "...443.3..", "...34433..",
              "..3445443.", "..3455543.", "..3455543.", "...34443..", ".........."],
             {"3": "pyro_3", "4": "pyro_4", "5": "pyro_5"}, True),
    "ice": (["..........", "....54....", "...5443...", "..554433..", "..544332..",
             "..544332..", "..443322..", "...4332...", "....32....", ".........."],
            {"5": "cryo_5", "4": "cryo_4", "3": "cryo_3", "2": "cryo_2"}, True),
    "lightning": (["..........", ".....554..", "....554...", "...554....", "..5555544.",
                   ".....443..", "....443...", "...43.....", "..3.......", ".........."],
                  {"5": "lightning_5", "4": "lightning_4", "3": "lightning_3"}, True),
    "crystal": (["..........", "...5443...", "..554433..", ".22222222.", ".54443332.",
                 "..544332..", "...4432...", "....43....", "..........", ".........."],
                {"5": "echo_5", "4": "echo_4", "3": "echo_3", "2": "echo_2"}, True),
}


def icon10(name):
    rows, cmap, auto = ICONS10[name]
    cv = Canvas(10, 10)
    cv.grid(rows, cmap)
    if auto:
        cv.outline()
    return cv


# ============================================================================= 16x16 resource icons
def _grid16(rows, cmap):
    for r in rows:
        assert len(r) == 16, (r, len(r))
    cv = Canvas(16, 16)
    cv.grid(rows, cmap)
    cv.outline()
    return cv


def icon16(name):
    if name == "power":
        cv = Canvas(16, 16)
        cv.rect(6, 1, 4, 2, "steel_4")
        cv.put(9, 2, "steel_3")
        cv.rect(4, 3, 8, 12, "steel_3")
        cv.vline(4, 3, 14, "steel_4")
        cv.vline(11, 3, 14, "steel_2")
        cv.rect(5, 4, 6, 10, "steel_1")
        for y in (11, 8, 5):
            cv.hline(5, 10, y, "venom_3")
            cv.hline(5, 10, y + 1, "venom_3")
            cv.vline(5, y, y + 1, "venom_4")
            cv.vline(10, y, y + 1, "venom_2")
        cv.put(6, 5, "venom_5")
        cv.put(6, 8, "venom_5")
        cv.put(6, 11, "venom_5")
        cv.outline()
        return cv
    c5 = {"2": "pyro_2", "3": "pyro_3", "4": "pyro_4", "5": "pyro_5", "w": "white"}
    if name == "fire":
        return _grid16(["................", "......3.........", "......43........", ".....443........",
                        ".....4443...3...", "....34443..33...", "....344443.343..", "...3444544434...",
                        "...34455544443..", "..344555554443..", "..3445555w5443..", "..344555ww5443..",
                        "..2344555554432.", "...23445554432..", "....223333322...", "................"], c5)
    if name == "ice":
        return _grid16(["................", "................", ".......5........", "......554.......",
                        ".....55443......", "....5544433.....", "...554444332....", "...544w44332....",
                        "...54444w332....", "...544444332....", "...444443322....", "....4443322.....",
                        ".....44322......", "......432.......", ".......2........", "................"],
                       {"5": "cryo_5", "4": "cryo_4", "3": "cryo_3", "2": "cryo_2", "w": "white"})
    if name == "lightning":
        return _grid16(["................", "........55554...", ".......55554....", "......55554.....",
                        ".....55554......", "....555555554...", "...5555555544...", "........5444....",
                        ".......5443.....", "......5443......", ".....5443.......", "....443.........",
                        "...43...........", "..3.............", "................", "................"],
                       {"5": "lightning_5", "4": "lightning_4", "3": "lightning_3"})
    if name == "crystal":
        return _grid16(["................", "................", "....54444333....", "...5544443332...",
                        "..555444433322..", ".22222222222222.", ".55444w44333322.", "..5444w4433322..",
                        "...5444433322...", "....54443332....", ".....544332.....", "......5432......",
                        ".......42.......", "................", "................", "................"],
                       {"5": "echo_5", "4": "echo_4", "3": "echo_3", "2": "echo_2", "w": "white"})
    raise KeyError(name)


# ============================================================================= strip: cannon bay, conduits, hopper
def cannon_bay(active=False, s=36):
    """Hero bay: double rim, violet corner brackets, turntable floor. Distinct from the brass slots."""
    cv = Canvas(s, s)
    cv.rect(0, 0, s, s, "outline", fill=False)
    cv.rect(1, 1, s - 2, s - 2, "steel_3")
    cv.hline(1, s - 2, 1, "steel_4")
    cv.vline(1, 1, s - 2, "steel_4")
    cv.hline(1, s - 2, s - 2, "steel_2")
    cv.vline(s - 2, 1, s - 2, "steel_2")
    cv.rect(2, 2, s - 4, s - 4, "outline", fill=False)          # second rim
    cv.rect(3, 3, s - 6, s - 6, "steel_1")
    # turntable floor
    floor = mask_of(lambda t: t.ellipse(s / 2, s - 7.5, 13, 3.4, "white"), s, s)
    for p in floor:
        if 3 <= p[0] < s - 3 and 3 <= p[1] < s - 3:
            cv.put(p[0], p[1], "steel_2")
    for p in offset_bands(floor, 1, 0, -1):
        if 3 <= p[0] < s - 3:
            cv.put(p[0], p[1], "echo_3" if active else "echo_2")
    rim = "echo_4" if active else "echo_3"
    for (cx, cy, sx, sy) in ((0, 0, 1, 1), (s - 1, 0, -1, 1), (0, s - 1, 1, -1), (s - 1, s - 1, -1, -1)):
        for i in range(6):
            cv.put(cx + sx * i, cy, rim if sy > 0 else "echo_2")
            cv.put(cx, cy + sy * i, rim if sx > 0 else "echo_2")
        cv.put(cx + sx, cy + sy, "echo_5" if active else "echo_3")
    if active:
        cv.hline(4, s - 5, 3, "echo_2")
        cv.vline(3, 4, s - 5, "echo_2")
    # top notch: the barrel's aim gap
    cv.hline(s // 2 - 3, s // 2 + 2, 0, "steel_2")
    return cv


def conduit(state, phase=0):
    """8x6 horizontal power line tile between slots."""
    cv = Canvas(8, 6)
    cv.hline(0, 7, 0, "outline")
    cv.hline(0, 7, 1, "steel_3")
    cv.hline(0, 7, 4, "steel_1")
    cv.hline(0, 7, 5, "outline")
    if state == "powered":
        cv.hline(0, 7, 2, "venom_3")
        cv.hline(0, 7, 3, "venom_2")
        for x in range(8):
            if (x + phase * 4) % 8 < 3:
                cv.put(x, 2, "venom_5")
                cv.put(x, 3, "venom_4")
    else:
        cv.hline(0, 7, 2, "steel_2")
        cv.hline(0, 7, 3, "steel_1")
        cv.put(3, 2, "pyro_2")       # dead spot
    for x in (0, 7):                 # brass coupling rings at tile ends
        cv.put(x, 1, "lightning_3")
        cv.put(x, 4, "lightning_2")
    return cv


def conduit_end(side, powered):
    cv = conduit("powered" if powered else "off")
    x = 0 if side == "left" else 6
    cv.rect(x, 0, 2, 6, "steel_3")
    cv.vline(x, 0, 5, "steel_4")
    cv.vline(x + 1, 0, 5, "steel_2")
    cv.put(x, 0, "outline")
    cv.put(x + 1, 5, "outline")
    cv.put(x if side == "left" else x + 1, 2, "venom_4" if powered else "pyro_3")
    return cv


def hopper_intake(piece, active=False):
    """8x8 pieces: the funnel mouth on the strip's top edge where board drops fall in."""
    cv = Canvas(8, 8)
    if piece == "mid":
        cv.hline(0, 7, 0, "lightning_4")
        cv.hline(0, 7, 1, "lightning_2")
        cv.rect(0, 2, 8, 5, "steel_1")
        for x in (1, 4, 7):
            cv.vline(x, 2, 6, "steel_3")
        cv.hline(0, 7, 7, "outline")
        if active:
            for (x, y, c) in ((2, 3, "pyro_4"), (5, 5, "cryo_4"), (6, 2, "venom_4"), (3, 6, "venom_5")):
                cv.put(x, y, c)
        return cv
    left = piece == "left"
    for y in range(8):
        for x in range(8):
            xx = x if left else 7 - x
            if xx >= 7 - y:              # sloped funnel wall
                cv.put(x, y, "steel_2" if xx > 8 - y else "steel_3")
    for i in range(8):
        xx = 7 - i
        cv.put(xx if left else 7 - xx, i, "lightning_3" if i < 2 else "steel_4")
    cv.put(7 if left else 0, 0, "lightning_4")
    cv.hline(0, 7, 7, "outline")
    return cv


# ============================================================================= factory screen
RARITY = {"common": "steel", "rare": "cryo", "epic": "echo", "legendary": "lightning"}


def blueprint_card(rarity, w=32, h=44):
    r = RARITY[rarity]
    cv = Canvas(w, h)
    cv.rect(0, 0, w, h, "outline", fill=False)
    cv.rect(1, 1, w - 2, h - 2, f"{r}_3")
    cv.hline(1, w - 2, 1, f"{r}_4")
    cv.vline(1, 1, h - 2, f"{r}_4")
    cv.hline(1, w - 2, h - 2, f"{r}_2")
    cv.vline(w - 2, 1, h - 2, f"{r}_2")
    cv.rect(2, 2, w - 4, h - 4, "steel_2")
    # icon well 24x24 at (4,4)
    cv.rect(3, 3, 26, 26, "outline", fill=False)
    cv.rect(4, 4, 24, 24, "steel_1")
    # cost row area
    cv.hline(3, w - 4, 30, "steel_3")
    cv.rect(3, 31, w - 6, 10, "steel_1")
    # rarity gem at top centre
    stamp_rows(cv, [".5.", "543", ".3."], {"5": f"{r}_5", "4": f"{r}_4", "3": f"{r}_3"}, w // 2 - 1, 0)
    cv.put(w // 2 - 2, 0, "outline")
    cv.put(w // 2 + 2, 0, "outline")
    if rarity in ("epic", "legendary"):
        for (x, y) in ((1, 1), (w - 2, 1), (1, h - 2), (w - 2, h - 2)):
            cv.put(x, y, f"{r}_5")
    return cv


def cost_chip(el, short=False):
    """22x12: element icon (10x10) + room for up to two 3x5 digits at (13,4)."""
    cv = Canvas(22, 12)
    cv.rect(0, 0, 22, 12, "outline", fill=False)
    cv.rect(1, 1, 20, 10, "steel_1")
    border = "pyro_3" if short else f"{ELEM[el]}_2"
    cv.hline(1, 20, 1, border)
    cv.hline(1, 20, 10, border)
    cv.vline(20, 1, 10, border)
    cv.blit(icon10(el), 1, 1)
    if short:
        cv.put(19, 2, "pyro_4")
    return cv


def power_bar_piece(kind):
    """4x8 pieces of the power-budget meter (tile 'fill'/'empty'/'over' horizontally)."""
    cv = Canvas(4, 8)
    if kind in ("cap_left", "cap_right"):
        cv.rect(0, 0, 4, 8, "outline")
        x = 2 if kind == "cap_left" else 0
        cv.rect(x, 1, 2, 6, "steel_3")
        cv.put(x, 1, "steel_4")
        cv.put(x + 1, 6, "steel_2")
        cv.put(1 if kind == "cap_left" else 2, 3, "lightning_3")
        cv.put(1 if kind == "cap_left" else 2, 4, "lightning_2")
        return cv
    cv.hline(0, 3, 0, "outline")
    cv.hline(0, 3, 7, "outline")
    if kind == "fill":
        cv.rect(0, 1, 4, 6, "venom_3")
        cv.hline(0, 3, 1, "venom_5")
        cv.hline(0, 3, 2, "venom_4")
        cv.hline(0, 3, 6, "venom_2")
        cv.vline(3, 2, 5, "venom_2")      # segment tick
    elif kind == "empty":
        cv.rect(0, 1, 4, 6, "steel_1")
        cv.hline(0, 3, 1, "outline")
        cv.vline(3, 2, 6, "steel_2")
    elif kind == "over":
        cv.rect(0, 1, 4, 6, "pyro_2")
        for y in range(1, 7):
            for x in range(4):
                if (x + y) % 4 < 2:
                    cv.put(x, y, "pyro_4")
        cv.hline(0, 3, 1, "pyro_5")
    elif kind == "limit":
        cv.rect(0, 1, 4, 6, "steel_1")
        cv.vline(1, 0, 7, "white")
        cv.vline(2, 0, 7, "steel_4")
        cv.put(1, 0, "lightning_5")
    return cv


def fight_button(state, w=32, h=16):
    """开战 9-slice source (l/r 5, t 4, b 5). Label is drawn by the runtime text layer."""
    cv = Canvas(w, h)
    if state == "pressed":
        top, body, lo, lip = 1, ("lightning_3", "lightning_2", "lightning_1"), "lightning_2", False
    elif state == "disabled":
        top, body, lo, lip = 0, ("stone_3", "stone_2", "stone_1"), "stone_1", True
    else:
        top, body, lo, lip = 0, ("lightning_5", "lightning_4", "lightning_2"), "lightning_2", True
    hi, mid, dk = body
    y0, y1 = top, h - 1 - (3 if lip else 1) + top
    cv.rect(0, y0, w, y1 - y0 + 1, "outline")
    cv.rect(1, y0 + 1, w - 2, y1 - y0 - 1, mid)
    cv.hline(2, w - 3, y0 + 1, hi)
    cv.vline(1, y0 + 2, y1 - 1, hi)
    cv.hline(2, w - 2, y1 - 1, dk)
    cv.vline(w - 2, y0 + 2, y1 - 1, dk)
    if lip:                                   # 2px pressable depth
        cv.rect(0, y1 + 1, w, 2, lo)
        cv.hline(0, w - 1, h - 1, "outline")
        cv.vline(0, y1, h - 1, "outline")
        cv.vline(w - 1, y1, h - 1, "outline")
    else:
        for y in range(y1 + 1, h):
            cv.hline(0, w - 1, y, None)
    # brass rivets
    rv = "lightning_2" if state != "disabled" else "stone_1"
    for x in (3, w - 4):
        cv.put(x, y0 + 3, rv)
    if state == "disabled":
        cv.put(w - 5, y0 + 2, "pyro_3")
    return cv


def modal_9slice(s=24):
    cv = Canvas(s, s, "steel_1")
    cv.rect(0, 0, s, s, "outline", fill=False)
    cv.rect(1, 1, s - 2, s - 2, "steel_3", fill=False)
    cv.hline(1, s - 2, 1, "steel_4")
    cv.rect(2, 2, s - 4, s - 4, "outline", fill=False)
    cv.hline(3, s - 4, 3, "steel_2")
    for (cx, cy, sx, sy) in ((1, 1, 1, 1), (s - 2, 1, -1, 1), (1, s - 2, 1, -1), (s - 2, s - 2, -1, -1)):
        for i in range(6):
            cv.put(cx + sx * i, cy, "lightning_3" if sy > 0 else "lightning_2")
            cv.put(cx, cy + sy * i, "lightning_3" if sx > 0 else "lightning_2")
        cv.put(cx + sx, cy + sy, "lightning_4")
    return cv


def magazine_slot(el=None, nxt=False):
    cv = Canvas(14, 14)
    cv.rect(0, 0, 14, 14, "outline", fill=False)
    cv.rect(1, 1, 12, 12, "steel_3")
    cv.hline(1, 12, 12, "steel_2")
    cv.vline(12, 1, 12, "steel_2")
    cv.rect(2, 2, 10, 10, "steel_1")
    if el:
        e = ELEM[el]
        orb = mask_of(lambda t: t.ellipse(7, 7, 3.6, 3.6, "white"), 14, 14)
        shade_mask(cv, orb, e, 3)
        cv.put(5, 5, "white")
        cv.put(6, 5, f"{e}_5")
    else:
        cv.put(6, 6, "steel_2")
        cv.put(7, 7, "steel_2")
    if nxt:
        for (x, y) in ((0, 0), (13, 0), (0, 13), (13, 13)):
            cv.put(x, y, "white")
        for (x, y) in ((1, 0), (0, 1), (12, 0), (13, 1), (0, 12), (1, 13), (13, 12), (12, 13)):
            cv.put(x, y, "echo_5")
    return cv


def item_icon(name):
    cv = Canvas(16, 16)
    if name == "bomb":
        ball = mask_of(lambda t: t.ellipse(7.5, 9.5, 5.5, 5.5, "white"), 16, 16)
        shade_mask(cv, ball, "steel", 2)
        cv.hline(3, 12, 10, "pyro_3")
        cv.put(3, 10, "pyro_4")
        cv.put(5, 7, "steel_4")
        cv.put(6, 6, "steel_5")
        cv.rect(8, 3, 3, 2, "steel_3")
        cv.put(8, 3, "steel_4")
        cv.put(11, 2, "stone_4")
        cv.put(12, 1, "stone_4")
        cv.outline()
        for (x, y, c) in ((13, 0, "white"), (14, 1, "pyro_5"), (12, 0, "pyro_5"), (14, 0, "lightning_5")):
            cv.put(x, y, c)
        return cv
    if name == "emergency_shield":
        sh = mask_of(lambda t: t.polygon([(2, 1), (14, 1), (14, 8), (8, 15), (2, 8)], "white"), 16, 16)
        shade_mask(cv, sh, "cryo", 3)
        cv.rect(7, 4, 2, 7, "white")
        cv.rect(5, 6, 6, 2, "white")
        cv.vline(9, 5, 10, "cryo_5")
        cv.outline()
        return cv
    if name == "timestop":
        for y in (1, 14):
            cv.rect(2, y, 12, 1, "lightning_3")
            cv.hline(2, 13, y - 1 if y == 1 else y + 1, "lightning_2" if y == 14 else "lightning_4")
        glass = mask_of(lambda t: (t.polygon([(4, 2), (12, 2), (8.5, 8)], "white"),
                                   t.polygon([(8.5, 8), (4, 14), (12, 14)], "white")), 16, 16)
        for p in glass:
            cv.put(p[0], p[1], "steel_1")
        for p in offset_bands(glass, 1, -1, 0):
            cv.put(p[0], p[1], "steel_4")
        for y in range(11, 14):
            for x in range(4, 13):
                if (x, y) in glass:
                    cv.put(x, y, "cryo_4" if y > 11 else "cryo_5")
        cv.put(8, 9, "cryo_4")
        for y in (3, 4):
            for x in range(5, 12):
                if (x, y) in glass:
                    cv.put(x, y, "cryo_3")
        cv.vline(2, 1, 14, "lightning_3")
        cv.vline(13, 1, 14, "lightning_2")
        cv.outline()
        return cv
    if name == "extra_dig":
        cv.line(3, 14, 10, 7, "stone_3")
        cv.line(4, 14, 11, 7, "stone_2")
        head = [(5, 3), (6, 2), (7, 2), (8, 2), (9, 2), (10, 3), (11, 4), (12, 5), (13, 6), (13, 7), (14, 8),
                (9, 3), (10, 4), (11, 5), (12, 6)]
        for p in head:
            cv.put(p[0], p[1], "steel_4" if p[1] <= 3 else "steel_3")
        cv.put(4, 4, "steel_3")
        cv.put(14, 9, "steel_2")
        cv.outline()
        stamp_rows(cv, [".a.", "aaa", ".a."], {"a": "venom_5"}, 0, 0)
        return cv
    raise KeyError(name)


DMG = {"cannon": ("steel_2", "steel_4", "echo_4"), "facility": ("lightning_2", "lightning_3", "lightning_4"),
       "alchemy": ("echo_2", "white", "white")}


def damage_frame(src, tier):
    """9x9 9-slice plate (slice 3) behind 3x5 damage digits. tier: normal | big.
    cannon = silver plate + violet lip (hero), facility = brass, alchemy = violet plate + white glow edge."""
    fill, edge, top = DMG[src]
    cv = Canvas(9, 9)
    cv.rect(0, 0, 9, 9, "outline")
    cv.rect(1, 1, 7, 7, fill)
    cv.rect(1, 1, 7, 7, edge, fill=False)
    cv.hline(1, 7, 1, top)
    if tier == "big":
        for (x, y) in ((0, 0), (8, 0), (0, 8), (8, 8)):
            cv.put(x, y, None)
        spark = {"cannon": "echo_5", "facility": "lightning_5", "alchemy": "pyro_5"}[src]
        for (x, y) in ((1, 1), (7, 1), (1, 7), (7, 7)):
            cv.put(x, y, spark)
        cv.put(4, 0, "white")
        cv.put(4, 8, "white")
    return cv


def digits_canvas(ch, c="stone_5"):
    cv = Canvas(3, 5)
    for j, r in enumerate(DIGITS_3x5[ch]):
        for i, k in enumerate(r):
            if k == "#":
                cv.put(i, j, c)
    return cv


def build():
    export("ui", "ui_strip_9slice", [("strip_9slice_8px", strip_9slice())], kind="ui",
           meta_extra={"nine_slice": {"left": 8, "right": 8, "top": 8, "bottom": 8}})
    export("ui", "ui_topbar_9slice", [("topbar_9slice", topbar_9slice())], kind="ui",
           meta_extra={"nine_slice": {"left": 6, "right": 6, "top": 1, "bottom": 4}})
    export("ui", "ui_slot_frames", [(s, slot_frame(s)) for s in ("empty", "occupied", "unpowered", "locked")], kind="ui")
    export("ui", "ui_cannon_bay", [("idle", cannon_bay()), ("active", cannon_bay(True))], kind="ui",
           meta_extra={"device_offset": [2, 2]})
    export("ui", "ui_conduit", [("powered_a", conduit("powered", 0)), ("powered_b", conduit("powered", 1)),
                                ("unpowered", conduit("off")), ("end_left_powered", conduit_end("left", True)),
                                ("end_right_powered", conduit_end("right", True)),
                                ("end_left_unpowered", conduit_end("left", False)),
                                ("end_right_unpowered", conduit_end("right", False))], kind="ui",
           meta_extra={"tiling": "horizontal; powered_a/b alternate at ~6 fps"})
    export("ui", "ui_hopper_intake", [("left", hopper_intake("left")), ("mid", hopper_intake("mid")),
                                      ("mid_active", hopper_intake("mid", True)), ("right", hopper_intake("right"))],
           kind="ui", meta_extra={"tiling": "left + mid*n + right along the strip top edge"})
    names = ("power", "fire", "ice", "lightning", "crystal")
    export("ui", "ui_icons_10", [(n, icon10(n)) for n in names], kind="icon")
    export("ui", "ui_icons_16", [(n, icon16(n)) for n in names], kind="icon")
    export("ui", "ui_font_3x5", [(k if k != "/" else "slash", digits_canvas(k)) for k in "0123456789/x+"], kind="font")
    export("ui", "ui_blueprint_card", [(r, blueprint_card(r)) for r in RARITY], kind="ui",
           meta_extra={"icon_area": [4, 4, 24, 24], "cost_area": [3, 31, 26, 10]})
    export("ui", "ui_cost_chip", [(n, cost_chip(n)) for n in names] + [(f"{n}_short", cost_chip(n, True)) for n in names],
           kind="ui", meta_extra={"digit_origin": [13, 4], "font": "ui_font_3x5"})
    export("ui", "ui_power_bar", [(k, power_bar_piece(k)) for k in ("cap_left", "fill", "empty", "over", "limit", "cap_right")],
           kind="ui")
    export("ui", "ui_button_fight", [(s, fight_button(s)) for s in ("normal", "pressed", "disabled")], kind="ui",
           meta_extra={"nine_slice": {"left": 5, "right": 5, "top": 4, "bottom": 5}, "label": "开战 (runtime text)"})
    export("ui", "ui_modal_9slice", [("modal", modal_9slice())], kind="ui",
           meta_extra={"nine_slice": {"left": 8, "right": 8, "top": 8, "bottom": 8}})
    export("ui", "ui_magazine_slot", [("empty", magazine_slot()), ("fire", magazine_slot("fire")),
                                      ("ice", magazine_slot("ice")), ("lightning", magazine_slot("lightning")),
                                      ("next_fire", magazine_slot("fire", True))], kind="ui")
    export("ui", "ui_item_icons_16", [(n, item_icon(n)) for n in ("bomb", "emergency_shield", "timestop", "extra_dig")],
           kind="icon")
    export("ui", "ui_damage_frames", [(f"{s}_{t}", damage_frame(s, t)) for s in DMG for t in ("normal", "big")],
           kind="ui", meta_extra={"nine_slice": {"left": 3, "right": 3, "top": 3, "bottom": 3},
                                  "digit_colour": {"cannon": "white", "facility": "lightning_5", "alchemy": "white"}})


if __name__ == "__main__":
    build()
    print("ok")
