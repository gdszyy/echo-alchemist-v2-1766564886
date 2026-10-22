"""Factory-strip devices: device_turret, device_generator (24x24) and cannon_main (32x32).

Function first (docs/design/factory_resource_v2.md §3, redraw_requirements_v1.md §4):
* Every device sits in a slot and must say: is it powered (lit / dark), is it acting
  (firing / spinning), and where its attack comes from (barrel tip, top centre).
* Material language: iron base plate (steel ramp) bolted into the slot, brass body
  (lightning ramp), glass + glowing reagent (element ramp). Powered = green status lamp
  (venom ramp = the power/battery colour) + glowing reagent; unpowered = every material
  one step darker, reagent dead, small red lamp.
* Light from the top-left: left faces +1 step, right faces -1/-2.
"""
from __future__ import annotations

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from pxlib import PAL, Canvas, export_sheet, offset_bands, ramp  # noqa: E402


# ----------------------------------------------------------------------------- helpers
def vcyl(cv: Canvas, x0: int, x1: int, y0: int, y1: int, name: str, base: int = 3) -> None:
    """Vertical cylinder lit from the left: hi | base... | shadow | deep."""
    for x in range(x0, x1 + 1):
        if x == x0:
            c = ramp(name, min(5, base + 1))
        elif x == x1:
            c = ramp(name, max(1, base - 2))
        elif x >= x1 - (1 if x1 - x0 < 5 else 2):
            c = ramp(name, max(1, base - 1))
        else:
            c = ramp(name, base)
        cv.vline(x, y0, y1, c)


def hband(cv: Canvas, x0: int, x1: int, y: int, name: str, base: int = 3) -> None:
    for x in range(x0, x1 + 1):
        c = ramp(name, base + 1) if x <= x0 + 1 else ramp(name, base - 1) if x >= x1 - 1 else ramp(name, base)
        cv.put(x, y, c)


def shade_mask(cv: Canvas, m: set, name: str, base: int, hl: bool = True) -> None:
    for p in m:
        cv.put(p[0], p[1], ramp(name, base))
    sh = offset_bands(m, 2, 1, 1)
    for p in sh:
        cv.put(p[0], p[1], ramp(name, base - 1))
    for p in offset_bands(m, 1, 1, 1):
        cv.put(p[0], p[1], ramp(name, max(1, base - 2)))
    if hl:
        for p in offset_bands(m, 1, -1, -1):
            if p not in sh:
                cv.put(p[0], p[1], ramp(name, min(5, base + 1)))


def mask_of(fn, w, h):
    t = Canvas(w, h)
    fn(t)
    return t.mask()


def darken(cv: Canvas, keep=()) -> Canvas:
    """Unpowered look: every ramp colour one step darker, step-5 highlights removed."""
    out = cv.copy()

    def fn(x, y, c):
        if c in keep or c == "outline":
            return c
        if c == "white":
            return "steel_4"
        if c.startswith("lightning_"):          # brass loses its shine -> dull stone
            return PAL.shift("stone_" + c.split("_")[1], -1)
        return PAL.shift(c, -1)
    out.recolor(fn)
    return out


def base_plate(cv: Canvas, w: int, y0: int, y1: int, x0: int, x1: int) -> None:
    """Iron mounting plate bolted into the slot."""
    cv.rect(x0, y0, x1 - x0 + 1, y1 - y0 + 1, "steel_3")
    cv.hline(x0, x1, y0, "steel_4")
    cv.hline(x0, x1, y1, "steel_1")
    cv.vline(x1, y0, y1, "steel_2")
    cv.vline(x0, y0, y1 - 1, "steel_4")
    for bx in (x0 + 1, x1 - 1):
        cv.put(bx, y0 + 1, "steel_5")


# ----------------------------------------------------------------------------- turret
def turret_raw(recoil: int = 0) -> Canvas:
    cv = Canvas(24, 24)
    base_plate(cv, 24, 19, 22, 2, 21)
    # brass rotating housing (dome on a drum)
    housing = mask_of(lambda t: (t.ellipse(12, 15.5, 7.2, 5.2, "white"), t.rect(5, 15, 14, 5, "white")), 24, 24)
    housing = {p for p in housing if p[1] <= 19}
    shade_mask(cv, housing, "lightning", 3)
    cv.hline(6, 17, 18, "lightning_2")            # drum seam
    for p in ((7, 12), (8, 11), (9, 11)):         # specular on dome
        cv.put(p[0], p[1], "lightning_5")
    # barrel (steel), banded with brass, muzzle ring at the top
    by = 2 + recoil
    vcyl(cv, 10, 13, by + 2, 13, "steel", 4)
    vcyl(cv, 9, 14, by, by + 2, "steel", 3)        # muzzle ring
    cv.hline(9, 14, by + 2, "steel_2")
    hband(cv, 10, 13, 8 + recoil // 2, "lightning", 3)
    cv.hline(10, 13, by, "outline")                 # bore opening reads as a hole
    cv.hline(11, 12, by, "steel_1")
    # reagent vial clamped on the left (fire ammo)
    vial = mask_of(lambda t: (t.rect(3, 13, 4, 6, "white"),), 24, 24)
    for p in vial:
        cv.put(p[0], p[1], "pyro_3")
    cv.vline(3, 13, 18, "pyro_4")
    cv.put(4, 14, "pyro_5")
    cv.put(4, 15, "pyro_5")
    cv.hline(3, 6, 13, "steel_4")                  # cork / cap
    cv.hline(3, 6, 12, "steel_3")
    cv.vline(6, 14, 18, "pyro_2")
    # status lamp (power = green)
    cv.put(11, 20, "venom_4")
    cv.put(12, 20, "venom_3")
    cv.put(11, 21, "venom_3")
    cv.put(12, 21, "venom_2")
    return cv


def muzzle_flash(cv: Canvas, cx: int, top: int, big: bool = False) -> None:
    """Feedback layer: star-shaped flash, brightest steps + white, never outlined."""
    if big:
        rows = ["....5....",
                "..5.w.5..",
                "...www...",
                ".5wwwww5.",
                "...www...",
                "..4.5.4.."]
    else:
        rows = ["..5..",
                "5.w.5",
                ".www.",
                "4w5w4"]
    cmap = {"w": "white", "5": "lightning_5", "4": "pyro_5"}
    w = len(rows[0])
    for j, r in enumerate(rows):
        for i, ch in enumerate(r):
            if ch != ".":
                cv.put(cx - w // 2 + i, top + j, cmap[ch])


def turret_frames():
    idle = turret_raw()
    idle.outline()
    fire = turret_raw(recoil=1)
    fire.outline()
    # vial flares while firing
    for p in ((4, 16), (5, 16), (4, 17)):
        fire.put(p[0], p[1], "pyro_5")
    muzzle_flash(fire, 12, 0)
    off_raw = darken(turret_raw())
    for p in ((3, 13), (3, 14), (3, 15), (3, 16), (3, 17), (3, 18), (4, 14), (4, 15)):
        off_raw.put(p[0], p[1], "pyro_1")
    for y in range(14, 19):
        for x in (4, 5):
            if (x, y) not in ((4, 14), (4, 15)):
                off_raw.put(x, y, "pyro_1")
    off_raw.put(11, 20, "pyro_4")                  # red OFF lamp
    off_raw.put(12, 20, "pyro_3")
    off_raw.put(11, 21, "pyro_3")
    off_raw.put(12, 21, "pyro_2")
    off_raw.outline()
    return [("powered_idle", idle), ("firing", fire), ("unpowered", off_raw)]


# ----------------------------------------------------------------------------- generator
def generator_raw(phase: int, on: bool) -> Canvas:
    cv = Canvas(24, 24)
    base_plate(cv, 24, 20, 22, 2, 21)
    # brass drum with cooling fins
    vcyl(cv, 4, 19, 14, 19, "lightning", 3)
    for x in (7, 10, 13, 16):
        cv.vline(x, 15, 19, "lightning_2")
        cv.vline(x - 1, 15, 19, "lightning_4" if x < 12 else "lightning_3")
    cv.hline(4, 19, 14, "lightning_4")
    cv.hline(5, 18, 13, "steel_3")                 # glass collar
    # glass dome
    dome = mask_of(lambda t: t.ellipse(12, 8.5, 6.6, 6.4, "white"), 24, 24)
    dome = {p for p in dome if p[1] <= 12}
    inner = "steel_1"
    for p in dome:
        cv.put(p[0], p[1], inner)
    rim = offset_bands(dome, 1, -1, -1) | offset_bands(dome, 1, 1, 1) | {p for p in dome if p[1] == 12}
    for p in rim:
        cv.put(p[0], p[1], "steel_3")
    for p in offset_bands(dome, 1, -1, -1):
        if p[0] < 12:
            cv.put(p[0], p[1], "steel_4")
    # rotor: hub + 2 blades (rotates 45 degrees between frames)
    if on:
        glow = ["venom_2", "venom_3"]
        for p in dome - rim:
            dx, dy = p[0] - 11.5, p[1] - 8
            if dx * dx + dy * dy <= 13:
                cv.put(p[0], p[1], glow[1] if phase == 0 else glow[0])
            elif dx * dx + dy * dy <= 22:
                cv.put(p[0], p[1], glow[0] if phase == 0 else glow[1])
        blade, hub = "venom_5", "white"
    else:
        blade, hub = "steel_3", "steel_4"
    if phase == 0:
        pts = [(11, 5), (12, 5), (11, 6), (12, 6), (11, 9), (12, 9), (11, 10), (12, 10),
               (8, 7), (8, 8), (9, 7), (9, 8), (14, 7), (14, 8), (15, 7), (15, 8)]
    else:
        pts = [(9, 5), (10, 6), (14, 5), (13, 6), (9, 10), (10, 9), (14, 10), (13, 9),
               (8, 5), (15, 5), (8, 10), (15, 10)]
    for p in pts:
        cv.put(p[0], p[1], blade)
    for p in ((11, 7), (12, 7), (11, 8), (12, 8)):
        cv.put(p[0], p[1], hub if p == (11, 7) else ("venom_4" if on else "steel_3"))
    # glass glint
    cv.put(8, 4, "steel_5")
    cv.put(7, 5, "steel_5")
    # terminal cap on top
    cv.rect(10, 0, 4, 2, "lightning_3")
    cv.put(10, 0, "lightning_4")
    cv.put(13, 1, "lightning_2")
    # status lamp on the drum
    if on:
        cv.put(11, 17, "venom_5")
        cv.put(12, 17, "venom_4")
    else:
        cv.put(11, 17, "pyro_4")
        cv.put(12, 17, "pyro_3")
    return cv


def generator_frames():
    a = generator_raw(0, True)
    a.outline()
    b = generator_raw(1, True)
    b.outline()
    # output spark on the terminal (feedback), alternating
    for p in ((9, 0), (14, 1)) if True else ():
        pass
    a.put(15, 0, "venom_5")
    b.put(8, 1, "venom_5")
    off = darken(generator_raw(0, False), keep=("pyro_4", "pyro_3"))
    off.outline()
    return [("running_a", a), ("running_b", b), ("unpowered", off)]


# ----------------------------------------------------------------------------- main cannon
def cannon_raw(state: str) -> Canvas:
    """state: idle | loaded | firing"""
    cv = Canvas(32, 32)
    recoil = 1 if state == "firing" else 0
    # pedestal (iron) with ammo pips = shots left this turn
    base_plate(cv, 32, 26, 30, 2, 29)
    pips = 3 if state != "firing" else 2
    for i in range(5):
        x = 7 + i * 4
        lit = i < pips
        cv.put(x, 28, "lightning_4" if lit else "steel_1")
        cv.put(x + 1, 28, "lightning_3" if lit else "steel_1")
    # brass turntable ring
    ring = mask_of(lambda t: t.ellipse(16, 24.5, 12, 3.2, "white"), 32, 32)
    shade_mask(cv, ring, "lightning", 3)
    # housing (brass, rounded shoulders)
    house = mask_of(lambda t: (t.ellipse(16, 17, 10.2, 8.4, "white"),), 32, 32)
    house = {p for p in house if p[1] <= 24}
    shade_mask(cv, house, "lightning", 3)
    for p in ((10, 11), (11, 10), (12, 10), (9, 12)):
        cv.put(p[0], p[1], "lightning_5")
    # rivets on the housing
    for p in ((8, 17), (23, 17), (9, 21), (22, 21)):
        cv.put(p[0], p[1], "lightning_2")
    # alchemy chamber window (glass) -- shows what is loaded
    win = mask_of(lambda t: t.ellipse(16, 18, 4.6, 4.2, "white"), 32, 32)
    for p in win:
        cv.put(p[0], p[1], "steel_1")
    for p in offset_bands(win, 1, -1, -1) | offset_bands(win, 1, 1, 1):
        cv.put(p[0], p[1], "steel_3")
    if state == "loaded":
        orb = mask_of(lambda t: t.ellipse(16, 18, 3.1, 2.9, "white"), 32, 32)
        for p in orb:
            cv.put(p[0], p[1], "lightning_4")
        for p in offset_bands(orb, 1, 1, 1):
            cv.put(p[0], p[1], "pyro_4")
        for p in ((15, 17), (16, 17), (15, 18)):
            cv.put(p[0], p[1], "white")
        cv.put(16, 18, "lightning_5")
        cv.put(17, 17, "lightning_5")
    elif state == "idle":
        # plain shot resting in the chamber: dull steel ball
        for p in ((15, 18), (16, 18), (15, 19), (16, 19)):
            cv.put(p[0], p[1], "steel_3")
        cv.put(15, 18, "steel_4")
    cv.put(13, 15, "steel_5")                     # glass glint
    # barrel
    top = 1 + recoil
    vcyl(cv, 12, 19, top + 3, 12, "steel", 4)
    vcyl(cv, 11, 20, top, top + 3, "steel", 3)     # muzzle brake
    cv.hline(11, 20, top + 3, "steel_2")
    cv.hline(12, 19, top, "outline")               # bore
    cv.hline(13, 18, top, "steel_1")
    hband(cv, 12, 19, 7 + recoil, "lightning", 3)
    hband(cv, 12, 19, 11, "lightning", 3)
    # conduit: glowing feed line from chamber into the barrel when loaded
    if state == "loaded":
        for y in range(9, 14):
            cv.put(16, y, "lightning_4" if y % 2 else "pyro_4")
    return cv


def cannon_frames():
    out = []
    for st in ("idle", "loaded", "firing"):
        cv = cannon_raw(st)
        cv.outline()
        if st == "firing":
            muzzle_flash(cv, 16, 0, big=True)
        if st == "loaded":
            # feedback glow pixels hugging the chamber (not outlined)
            for p in ((10, 18), (22, 18), (16, 12)):
                cv.put(p[0], p[1], "lightning_5")
        out.append((st, cv))
    return out


def main():
    export_sheet("device_turret", turret_frames(), kind="device")
    export_sheet("device_generator", generator_frames(), kind="device")
    export_sheet("cannon_main", cannon_frames(), kind="device")


if __name__ == "__main__":
    main()
    print("ok")
