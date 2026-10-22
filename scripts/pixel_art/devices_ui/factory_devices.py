"""Factory slot devices (24x24, one family) + the main cannon (32x32, hero object).

Family rules for every SLOT device (redraw_requirements_v1 §4, factory_resource_v2 §3.4):
  * same iron base plate (y 19..22) + brass plinth (y 17..18) + status lamp at plate centre
    (green = powered, red = no power); body rises from the plinth, light from top-left;
  * materials: brass housing, steel parts, glass with a glowing reagent whose colour says
    the function (fire vial = turret, ice crystal = frost, yellow ball = lightning, blue dome
    = shield, green = power devices);
  * unpowered = darken() (brass -> dull stone, reagent dead) + red lamp.
The MAIN CANNON is deliberately NOT built from that kit: no base plate/plinth, a full-width
gunmetal carriage with an ammo rack, wide armoured shoulders, a big glass alchemy sphere,
polished steel + violet (echo) accent instead of brass, flared muzzle -> different silhouette.
"""
from __future__ import annotations

from common import (Canvas, base_plate, darken, export, hband, lamp, mask_of, offset_bands,
                    shade_mask, stamp_rows, star, vcyl)

S = 24


def family_base(cv: Canvas, on: bool = True) -> None:
    base_plate(cv, 19, 22, 2, 21)
    # brass plinth shared by the whole device family
    cv.rect(4, 17, 16, 2, "lightning_3")
    cv.hline(4, 19, 17, "lightning_4")
    cv.hline(4, 19, 18, "lightning_2")
    cv.put(19, 17, "lightning_2")
    cv.put(5, 18, "lightning_3")
    cv.put(18, 18, "lightning_1")
    lamp(cv, 11, 20, on)


def finish(raw_fn, active_fx=None, off_fix=None):
    """raw_fn(on: bool, **kw) -> Canvas. Returns (powered, off) outlined canvases."""
    on = raw_fn(True)
    on.outline()
    off = darken(raw_fn(True))
    lamp(off, 11, 20, False)
    if off_fix:
        off_fix(off)
    off.outline()
    return on, off


# ============================================================================= front line
def turret_raw(recoil=0):
    """Approved turret (devices.py) re-seated on the family plinth."""
    cv = Canvas(S, S)
    family_base(cv)
    housing = mask_of(lambda t: (t.ellipse(12, 14.5, 7.2, 5.2, "white"), t.rect(5, 14, 14, 3, "white")), S, S)
    housing = {p for p in housing if p[1] <= 16}
    shade_mask(cv, housing, "lightning", 3)
    cv.hline(6, 17, 16, "lightning_2")
    for p in ((7, 11), (8, 10), (9, 10)):
        cv.put(p[0], p[1], "lightning_5")
    by = 1 + recoil
    vcyl(cv, 10, 13, by + 2, 12, "steel", 4)
    vcyl(cv, 9, 14, by, by + 2, "steel", 3)
    cv.hline(9, 14, by + 2, "steel_2")
    hband(cv, 10, 13, 7 + recoil // 2, "lightning", 3)
    cv.hline(10, 13, by, "outline")
    cv.hline(11, 12, by, "steel_1")
    # fire vial (the turret's ammo) clamped on the left
    cv.rect(3, 12, 4, 6, "pyro_3")
    cv.vline(3, 12, 17, "pyro_4")
    cv.put(4, 13, "pyro_5")
    cv.put(4, 14, "pyro_5")
    cv.hline(3, 6, 12, "steel_4")
    cv.hline(3, 6, 11, "steel_3")
    cv.vline(6, 13, 17, "pyro_2")
    return cv


def turret():
    idle = turret_raw()
    idle.outline()
    fire = turret_raw(recoil=1)
    fire.outline()
    for p in ((4, 15), (5, 15), (4, 16)):
        fire.put(p[0], p[1], "pyro_5")
    star(fire, 12, 0)
    off = darken(turret_raw())
    lamp(off, 11, 20, False)
    off.outline()
    return [("powered_idle", idle), ("firing", fire), ("unpowered", off)]


def frost_raw(glow=0):
    cv = Canvas(S, S)
    family_base(cv)
    # tapered steel spire
    sp = mask_of(lambda t: t.polygon([(8, 17), (16, 17), (14.5, 8), (9.5, 8)], "white"), S, S)
    shade_mask(cv, sp, "steel", 3)
    for y in (11, 14):                      # coolant slits glowing ice
        cv.hline(11, 12, y, "cryo_4" if glow else "cryo_3")
    hband(cv, 9, 14, 8, "lightning", 3)     # brass collar holding the crystal
    # brass claws
    for (x, y) in ((8, 6), (8, 7), (15, 6), (15, 7), (9, 8)):
        cv.put(x, y, "lightning_3")
    cv.put(8, 5, "lightning_4")
    cv.put(15, 5, "lightning_2")
    # ice crystal (diamond)
    rows = ["...5...",
            "..554..",
            ".55443.",
            "5544332",
            ".44332.",
            "..432..",
            "...2..."]
    cmap = {"5": "cryo_5", "4": "cryo_4", "3": "cryo_3", "2": "cryo_2"}
    if glow:
        cmap = {"5": "white", "4": "cryo_5", "3": "cryo_4", "2": "cryo_3"}
    stamp_rows(cv, rows, cmap, 9, 1)
    return cv


def frost_tower():
    idle = frost_raw()
    idle.outline()
    act = frost_raw(glow=1)
    act.outline()
    # snowflake burst around the crystal (feedback)
    for p in ((12, 0), (6, 4), (18, 4), (5, 1), (19, 1), (7, 0), (17, 0)):
        act.put(p[0], p[1], "cryo_5" if p[1] else "white")
    for p in ((4, 4), (20, 4), (6, 8), (18, 8)):
        act.put(p[0], p[1], "cryo_4")
    off = darken(frost_raw())
    lamp(off, 11, 20, False)
    off.outline()
    return [("powered_idle", idle), ("freeze_pulse", act), ("unpowered", off)]


def lightning_raw(charge=0):
    cv = Canvas(S, S)
    family_base(cv)
    vcyl(cv, 11, 12, 6, 16, "steel", 3)                 # central rod
    for i, y in enumerate((15, 12, 9)):                 # stacked coil rings, narrowing upward
        w = 6 - i
        hband(cv, 12 - w, 11 + w, y, "steel", 3)
        cv.hline(12 - w, 11 + w, y + 1, "steel_2")
        cv.put(12 - w, y, "steel_5")
    # brass-capped lightning ball
    ball = mask_of(lambda t: t.ellipse(12, 4, 3.6, 3.6, "white"), S, S)
    shade_mask(cv, ball, "lightning", 4 if charge else 3)
    cv.put(11, 2, "lightning_5")
    cv.put(10, 3, "lightning_5" if charge else "lightning_4")
    if charge:
        cv.put(11, 3, "white")
    return cv


def lightning_tower():
    idle = lightning_raw()
    idle.outline()
    act = lightning_raw(charge=1)
    act.outline()
    # zig-zag arcs jumping out of the ball (feedback)
    for p in ((15, 3), (16, 2), (17, 3), (18, 2), (19, 1), (8, 5), (7, 6), (6, 5), (5, 6), (4, 7),
              (16, 6), (17, 7)):
        act.put(p[0], p[1], "lightning_5")
    for p in ((20, 1), (3, 7), (18, 7)):
        act.put(p[0], p[1], "white")
    off = darken(lightning_raw())
    lamp(off, 11, 20, False)
    off.outline()
    return [("powered_idle", idle), ("chain_strike", act), ("unpowered", off)]


def shield_raw(pulse=0):
    cv = Canvas(S, S)
    family_base(cv)
    # brass emitter box
    box = mask_of(lambda t: t.rect(6, 12, 12, 5, "white"), S, S)
    shade_mask(cv, box, "lightning", 3)
    cv.hline(7, 16, 14, "lightning_2")
    for x in (8, 11, 14):
        cv.put(x, 13, "lightning_5" if x == 8 else "lightning_4")
    # steel dish rim
    cv.hline(4, 19, 11, "steel_4")
    cv.hline(5, 18, 12, "steel_2")
    cv.put(19, 11, "steel_2")
    # blue glass shield dome
    dome = mask_of(lambda t: t.ellipse(12, 11, 7.0, 7.5, "white"), S, S)
    dome = {p for p in dome if p[1] <= 10}
    inner = "cryo_3" if pulse else "cryo_2"
    for p in dome:
        cv.put(p[0], p[1], inner)
    for p in offset_bands(dome, 1, -1, -1):
        cv.put(p[0], p[1], "cryo_4" if not pulse else "cryo_5")
    for p in offset_bands(dome, 1, 1, 1):
        cv.put(p[0], p[1], "cryo_2" if pulse else "cryo_1")
    # hex cell hint + glint
    cv.put(12, 7, "cryo_4" if pulse else "cryo_3")
    cv.put(10, 9, "cryo_4" if pulse else "cryo_3")
    cv.put(14, 9, "cryo_4" if pulse else "cryo_3")
    cv.put(8, 6, "white" if pulse else "cryo_5")
    cv.put(9, 5, "cryo_5")
    return cv


def shield_generator():
    idle = shield_raw()
    idle.outline()
    act = shield_raw(pulse=1)
    act.outline()
    # expanding barrier arc above the dome (feedback)
    arc = mask_of(lambda t: t.ellipse(12, 11, 10.5, 11, "white"), S, S)
    inner = mask_of(lambda t: t.ellipse(12, 11, 9.5, 10, "white"), S, S)
    for p in arc - inner:
        if p[1] <= 9 and act.get(*p) is None:
            act.put(p[0], p[1], "cryo_5" if (p[0] + p[1]) % 3 else "white")
    off = darken(shield_raw())
    lamp(off, 11, 20, False)
    off.outline()
    return [("powered_idle", idle), ("shield_pulse", act), ("unpowered", off)]


# ============================================================================= logistics
def generator_raw(phase, on):
    """Approved generator re-seated on the family plinth (lamp moved to the plate)."""
    cv = Canvas(S, S)
    family_base(cv, on)
    vcyl(cv, 4, 19, 13, 16, "lightning", 3)
    for x in (7, 10, 13, 16):
        cv.vline(x, 14, 16, "lightning_2")
        cv.vline(x - 1, 14, 16, "lightning_4" if x < 12 else "lightning_3")
    cv.hline(4, 19, 13, "lightning_4")
    cv.hline(5, 18, 12, "steel_3")
    dome = mask_of(lambda t: t.ellipse(12, 7.5, 6.6, 6.4, "white"), S, S)
    dome = {p for p in dome if p[1] <= 11}
    for p in dome:
        cv.put(p[0], p[1], "steel_1")
    rim = offset_bands(dome, 1, -1, -1) | offset_bands(dome, 1, 1, 1) | {p for p in dome if p[1] == 11}
    for p in rim:
        cv.put(p[0], p[1], "steel_3")
    for p in offset_bands(dome, 1, -1, -1):
        if p[0] < 12:
            cv.put(p[0], p[1], "steel_4")
    if on:
        for p in dome - rim:
            dx, dy = p[0] - 11.5, p[1] - 7
            d = dx * dx + dy * dy
            if d <= 13:
                cv.put(p[0], p[1], "venom_3" if phase == 0 else "venom_2")
            elif d <= 22:
                cv.put(p[0], p[1], "venom_2" if phase == 0 else "venom_3")
        blade, hub = "venom_5", "white"
    else:
        blade, hub = "steel_3", "steel_4"
    if phase == 0:
        pts = [(11, 4), (12, 4), (11, 5), (12, 5), (11, 8), (12, 8), (11, 9), (12, 9),
               (8, 6), (8, 7), (9, 6), (9, 7), (14, 6), (14, 7), (15, 6), (15, 7)]
    else:
        pts = [(9, 4), (10, 5), (14, 4), (13, 5), (9, 9), (10, 8), (14, 9), (13, 8),
               (8, 4), (15, 4), (8, 9), (15, 9)]
    for p in pts:
        cv.put(p[0], p[1], blade)
    for p in ((11, 6), (12, 6), (11, 7), (12, 7)):
        cv.put(p[0], p[1], hub if p == (11, 6) else ("venom_4" if on else "steel_3"))
    cv.put(8, 3, "steel_5")
    cv.put(7, 4, "steel_5")
    return cv


def generator():
    a = generator_raw(0, True)
    a.outline()
    b = generator_raw(1, True)
    b.outline()
    a.put(16, 0, "venom_5")
    a.put(15, 1, "venom_4")
    b.put(7, 0, "venom_5")
    b.put(8, 1, "venom_4")
    off = darken(generator_raw(0, False))
    lamp(off, 11, 20, False)
    off.outline()
    return [("running_a", a), ("running_b", b), ("unpowered", off)]


def battery_raw(level, on=True):
    """level 0..100: green charge column inside a glass cell held by brass straps."""
    cv = Canvas(S, S)
    family_base(cv, on)
    # glass cell
    cv.rect(7, 4, 10, 13, "steel_1")
    cv.vline(7, 4, 16, "steel_4")
    cv.vline(16, 4, 16, "steel_2")
    cv.hline(7, 16, 4, "steel_3")
    # charge
    rows = 11  # inner y 5..15
    n = round(rows * level / 100)
    for i in range(n):
        y = 15 - i
        cv.hline(8, 15, y, "venom_3")
        cv.put(8, y, "venom_4")
        cv.put(15, y, "venom_2")
    if n:
        cv.hline(8, 15, 16 - n, "venom_5" if n < rows else "venom_4")
    # quarter ticks on the glass
    for y in (7, 10, 13):
        cv.put(9, y, "steel_4" if cv.get(9, y) == "steel_1" else "venom_5")
    cv.put(9, 5, "steel_5")
    # brass straps + caps
    for y in (6, 14):
        hband(cv, 6, 17, y, "lightning", 3)
    cv.rect(6, 2, 12, 2, "lightning_3")
    cv.hline(6, 17, 2, "lightning_4")
    cv.put(17, 3, "lightning_2")
    # terminals (+ steel, - steel)
    cv.rect(8, 0, 2, 2, "steel_4")
    cv.rect(14, 0, 2, 2, "steel_3")
    cv.put(9, 1, "steel_3")
    cv.put(15, 1, "steel_2")
    return cv


def battery():
    out = []
    for lv in (0, 25, 50, 75, 100):
        cv = battery_raw(lv)
        cv.outline()
        out.append((f"charge_{lv}", cv))
    ch = battery_raw(50)
    ch.outline()
    for p in ((8, 0), (9, 0)):
        ch.put(p[0], p[1], "venom_5")
    for p in ((11, 0), (12, 1), (7, 1), (10, 2)):
        ch.put(p[0], p[1], "venom_5" if p[1] else "white")
    out.append(("charging", ch))
    off = darken(battery_raw(25))
    lamp(off, 11, 20, False)
    off.outline()
    out.append(("unpowered", off))
    return out


def synth_raw(phase=-1):
    """Lightning synthesizer: green power tube -> brass reactor -> yellow lightning tube."""
    cv = Canvas(S, S)
    family_base(cv)

    def tube(x0, ramp_name, level_top):
        cv.rect(x0, 4, 4, 13, "steel_1")
        cv.vline(x0, 4, 16, "steel_4")
        cv.vline(x0 + 3, 4, 16, "steel_2")
        for y in range(level_top, 17):
            cv.put(x0 + 1, y, f"{ramp_name}_4")
            cv.put(x0 + 2, y, f"{ramp_name}_3")
        cv.put(x0 + 1, level_top, f"{ramp_name}_5")
        cv.rect(x0, 2, 4, 2, "lightning_3")
        cv.hline(x0, x0 + 3, 2, "lightning_4")
    lv_in = 7 if phase < 0 else (7, 9, 11)[phase]
    lv_out = 11 if phase < 0 else (11, 10, 8)[phase]
    tube(3, "venom", lv_in)
    tube(17, "lightning", lv_out)
    # brass reactor with a round window
    body = mask_of(lambda t: (t.ellipse(12, 11, 4.6, 5.5, "white"), t.rect(8, 11, 8, 6, "white")), S, S)
    body = {p for p in body if p[1] <= 16}
    shade_mask(cv, body, "lightning", 3)
    win = mask_of(lambda t: t.ellipse(12, 11, 2.6, 2.6, "white"), S, S)
    for p in win:
        cv.put(p[0], p[1], "steel_1")
    # feed pipes across the top
    cv.hline(7, 8, 6, "steel_3")
    cv.hline(16, 16, 6, "steel_3")
    cv.hline(7, 8, 7, "steel_2")
    if phase >= 0:
        # spark travelling green -> yellow
        sx = (10, 12, 14)[phase]
        col = ("venom_5", "white", "lightning_5")[phase]
        cv.put(sx, 10, col)
        cv.put(sx, 11, col)
        cv.put(sx - 1, 11, ("venom_4", "lightning_5", "lightning_4")[phase])
        cv.put(sx + 1, 10, ("venom_4", "lightning_5", "lightning_4")[phase])
    else:
        cv.put(12, 11, "lightning_2")
    cv.put(11, 7, "lightning_5")
    return cv


def lightning_synthesizer():
    idle = synth_raw()
    idle.outline()
    frames = [("powered_idle", idle)]
    for i in range(3):
        cv = synth_raw(i)
        cv.outline()
        if i == 2:
            cv.put(20, 0, "lightning_5")
            cv.put(19, 1, "white")
        frames.append((f"working_{i + 1}", cv))
    off = darken(synth_raw())
    lamp(off, 11, 20, False)
    off.outline()
    frames.append(("unpowered", off))
    return frames


def workshop_raw(hammer=0):
    """Ammo workshop: brass press over a bench with a shell being crafted. hammer 0=up 1=mid 2=down."""
    cv = Canvas(S, S)
    family_base(cv)
    # bench (stone = worn wood/stone top) on the plinth
    cv.rect(3, 13, 18, 2, "stone_3")
    cv.hline(3, 20, 13, "stone_4")
    cv.hline(3, 20, 14, "stone_2")
    cv.vline(4, 15, 16, "stone_2")
    cv.vline(19, 15, 16, "stone_1")
    # press column on the right
    vcyl(cv, 16, 18, 2, 12, "steel", 3)
    cv.rect(10, 1, 9, 2, "lightning_3")
    cv.hline(10, 18, 1, "lightning_4")
    cv.hline(10, 18, 2, "lightning_2")
    # ram + hammer head
    hy = (4, 6, 7)[hammer]
    cv.vline(12, 3, hy, "steel_4")
    cv.vline(13, 3, hy, "steel_2")
    cv.rect(10, hy, 6, 2, "steel_3")
    cv.hline(10, 15, hy, "steel_4")
    cv.put(15, hy + 1, "steel_1")
    # shell on the bench (iron casing + fire band)
    shell = mask_of(lambda t: t.ellipse(8.5, 10.5, 3.0, 2.6, "white"), S, S)
    shade_mask(cv, shell, "steel", 3)
    cv.hline(6, 11, 11, "pyro_3")
    cv.put(6, 11, "pyro_4")
    cv.put(7, 9, "steel_5")
    cv.put(8, 7, "stone_4")   # fuse
    cv.put(9, 7, "pyro_4")
    # small crate of finished ammo
    cv.rect(3, 9, 3, 4, "stone_2")
    cv.hline(3, 5, 9, "stone_4")
    return cv


def ammo_workshop():
    idle = workshop_raw(0)
    idle.outline()
    frames = [("powered_idle", idle)]
    for i, h in enumerate((1, 2)):
        cv = workshop_raw(h)
        cv.outline()
        if h == 2:
            for p in ((9, 6), (16, 9), (17, 8), (8, 5)):
                cv.put(p[0], p[1], "pyro_5" if p[0] < 12 else "lightning_5")
            cv.put(16, 7, "white")
        frames.append((f"crafting_{i + 1}", cv))
    off = darken(workshop_raw(0))
    lamp(off, 11, 20, False)
    off.outline()
    frames.append(("unpowered", off))
    return frames


def platform_raw(ext=0, crystal=False):
    """Expansion platform: steel scaffold deck with brass rails; ext slides a new deck plate."""
    cv = Canvas(S, S)
    family_base(cv)
    # scaffold legs + cross brace
    for x in (5, 18):
        cv.vline(x, 8, 16, "steel_3")
        cv.vline(x + 1, 8, 16, "steel_2")
    cv.line(7, 9, 17, 16, "steel_2")
    cv.line(7, 16, 17, 9, "steel_3")
    # deck plate
    cv.rect(3, 6, 18, 2, "steel_3")
    cv.hline(3, 20, 6, "steel_4")
    cv.hline(3, 20, 7, "steel_2")
    for x in (5, 9, 13, 17):
        cv.put(x, 6, "steel_5")
    # brass guard rail
    cv.hline(3, 20, 3, "lightning_3")
    cv.put(3, 3, "lightning_4")
    for x in (3, 11, 20):
        cv.vline(x, 4, 5, "lightning_2")
    # extending plate (slides out to the right)
    if ext:
        cv.rect(15 + ext, 8, 4, 2, "steel_4")
        cv.hline(15 + ext, 18 + ext, 9, "steel_2")
        cv.put(14 + ext, 8, "venom_5")
    if crystal:
        rows = ["..5..", ".543.", "54432", ".432.", "..2.."]
        stamp_rows(cv, rows, {"5": "echo_5", "4": "echo_4", "3": "echo_3", "2": "echo_2"}, 10, 9)
    return cv


def expansion_platform():
    idle = platform_raw()
    idle.outline()
    act = platform_raw(ext=3)
    act.outline()
    # deploy pulse: green power ticks along the deck
    for x in (4, 8, 12, 16, 20):
        act.put(x, 6, "venom_5")
    off = darken(platform_raw())
    lamp(off, 11, 20, False)
    off.outline()
    # unlock visual: crystal core glowing + up arrows (no slot device yet)
    un = platform_raw(crystal=True)
    un.outline()
    for (x, y) in ((4, 1), (19, 1)):
        stamp_rows(un, [".5.", "555", ".5."][:2], {"5": "echo_5"}, x - 1, y)
    fl = platform_raw(crystal=True)
    fl.outline()
    star(fl, 12, 0, big=True, cols=("white", "echo_5", "echo_4"))
    for p in ((2, 9), (21, 9), (3, 12), (20, 12)):
        fl.put(p[0], p[1], "echo_5")
    return [("powered_idle", idle), ("deploying", act), ("unpowered", off),
            ("unlock", un), ("unlock_flash", fl)]


def level_badges():
    """24x24 overlays: Lv pips stacked down the top-left corner of the slot device."""
    out = []
    for lv in (1, 2, 3):
        cv = Canvas(S, S)
        for i in range(lv):
            y = i * 4
            crystal = lv == 3 and i == 2
            hi, lo = ("echo_5", "echo_3") if crystal else ("lightning_5", "lightning_3")
            cv.put(1, y + 1, hi)
            cv.put(2, y + 1, lo if not crystal else "echo_4")
            cv.put(1, y + 2, lo if not crystal else "echo_4")
            cv.put(2, y + 2, lo)
        cv.outline()
        out.append((f"lv{lv}", cv))
    return out


# ============================================================================= main cannon (hero)
ELEMENT = {"fire": "pyro", "ice": "cryo", "lightning": "lightning", "plain": None}


PIP_X = [9 + i * 3 for i in range(5)]
PIP_Y = 27


def wheel(cv, cx, cy, r, lit):
    """Spoked carriage wheel: steel tyre, violet hub (hero accent)."""
    m = mask_of(lambda t: t.ellipse(cx, cy, r, r, "white"), 32, 32)
    inner = mask_of(lambda t: t.ellipse(cx, cy, r - 1.5, r - 1.5, "white"), 32, 32)
    shade_mask(cv, m, "steel", 4)
    for p in inner:
        cv.put(p[0], p[1], "steel_1")
    ix, iy = int(cx), int(cy)
    for dx, dy in ((1, 0), (0, 1)):
        for k in range(1, int(r) - 1):
            cv.put(ix + dx * k, iy + dy * k, "steel_3")
            cv.put(ix - dx * k, iy - dy * k, "steel_3")
    cv.put(ix, iy, "echo_5" if lit else "echo_4")
    cv.put(ix - 1, iy, "echo_3")
    cv.put(ix, iy - 1, "echo_3")


def cannon_raw(state="idle", element=None):
    """state: idle | aim_ready | loaded | firing | recoil"""
    cv = Canvas(32, 32)
    recoil = {"firing": 1, "recoil": 2}.get(state, 0)
    aim = state in ("aim_ready", "loaded", "firing")
    # --- carriage: dark gunmetal trail with the ammo rack (NOT the family plate)
    car = mask_of(lambda t: t.polygon([(8, 22), (24, 22), (25, 31), (7, 31)], "white"), 32, 32)
    shade_mask(cv, car, "steel", 2)
    cv.hline(8, 23, 22, "steel_4")
    cv.hline(8, 24, 25, "echo_2")
    cv.hline(7, 24, 30, "steel_1")
    for x in PIP_X:                        # 5 ammo sockets (filled by the pip overlay)
        cv.rect(x, PIP_Y, 2, 3, "outline")
    # --- armoured cheeks around the chamber
    for side in (-1, 1):
        cx = 16 + side * 8
        sh = mask_of(lambda t, cx=cx: t.ellipse(cx, 19.5, 4.4, 4.6, "white"), 32, 32)
        sh = {p for p in sh if p[1] <= 23}
        shade_mask(cv, sh, "steel", 3)
        cv.put(cx + side * 2, 20, "lightning_3")   # brass rivet = family tie
    # --- big spoked wheels in front: the gun-carriage read no slot device has
    wheel(cv, 5, 25, 5.6, aim)
    wheel(cv, 27, 25, 5.6, aim)
    for x in (7, 24):                              # sight lamps
        cv.put(x, 18, "echo_5" if aim else "steel_1")
    # --- big glass alchemy sphere in a violet collar
    collar = mask_of(lambda t: t.ellipse(16, 18, 8.0, 7.8, "white"), 32, 32)
    shade_mask(cv, collar, "echo", 4 if aim else 3)
    win = mask_of(lambda t: t.ellipse(16, 18, 6.0, 5.8, "white"), 32, 32)
    for p in win:
        cv.put(p[0], p[1], "steel_1")
    for p in offset_bands(win, 1, -1, -1):
        cv.put(p[0], p[1], "steel_3")
    for p in offset_bands(win, 1, 1, 1):
        cv.put(p[0], p[1], "steel_2")
    el = ELEMENT.get(element) if state == "loaded" else None
    if el:
        orb = mask_of(lambda t: t.ellipse(16, 18, 4.4, 4.2, "white"), 32, 32)
        for p in orb:
            cv.put(p[0], p[1], f"{el}_3")
        core = mask_of(lambda t: t.ellipse(15.5, 17.5, 2.8, 2.6, "white"), 32, 32)
        for p in core:
            cv.put(p[0], p[1], f"{el}_4")
        for p in offset_bands(orb, 1, 1, 1):
            cv.put(p[0], p[1], f"{el}_2")
        for p in ((14, 16), (15, 16), (14, 17)):
            cv.put(p[0], p[1], "white")
        cv.put(16, 17, f"{el}_5")
        cv.put(17, 19, f"{el}_5")
    elif state in ("idle", "aim_ready"):
        shot = mask_of(lambda t: t.ellipse(16, 19, 2.6, 2.6, "white"), 32, 32)
        shade_mask(cv, shot, "steel", 3)
        cv.put(15, 18, "steel_5")
        if state == "aim_ready":
            for p in offset_bands(win, 1, 1, 1):
                cv.put(p[0], p[1], "echo_3")
    elif state == "recoil":
        for p in ((15, 20), (16, 20), (17, 21)):
            cv.put(p[0], p[1], "steel_2")
    cv.put(12, 15, "steel_5")
    cv.put(13, 14, "steel_5")
    # --- barrel: heavy polished steel, violet bands, flared bell muzzle
    top = recoil
    vcyl(cv, 12, 19, top + 3, 11, "steel", 4)
    bell = mask_of(lambda t: t.polygon([(10, top), (22, top), (20, top + 4), (12, top + 4)], "white"), 32, 32)
    shade_mask(cv, bell, "steel", 4)
    cv.hline(11, 20, top, "outline")       # bore
    cv.hline(13, 18, top, "steel_1")
    cv.hline(12, 19, top + 4, "steel_2")
    hband(cv, 12, 19, 7 + recoil // 2, "echo", 4 if aim else 3)
    if el:
        for y in range(top + 5, 11):
            cv.put(16, y, f"{el}_4" if y % 2 else f"{el}_5")
    return cv


def cannon():
    frames = []
    for st, el in (("idle", None), ("aim_ready", None), ("loaded", "fire"), ("loaded", "ice"),
                   ("loaded", "lightning"), ("firing", "fire"), ("recoil", None)):
        cv = cannon_raw(st if st != "firing" else "firing", el)
        cv.outline()
        lab = st if st != "loaded" else f"loaded_{el}"
        if st == "loaded":
            e = ELEMENT[el]
            for p in ((7, 13), (25, 13), (16, 11)):
                cv.put(p[0], p[1], f"{e}_5")
        if st == "firing":
            star(cv, 16, 0, big=True)
        if st == "recoil":
            for p in ((12, 0), (13, 0), (19, 0), (20, 1), (11, 1)):
                cv.put(p[0], p[1], "steel_4")
            cv.put(16, 0, "steel_5")
        frames.append((lab, cv))
    return frames


def cannon_pips():
    """32x32 overlays: shots left this turn (0..5) lit into the carriage sockets."""
    out = []
    for n in range(6):
        cv = Canvas(32, 32)
        for i in range(n):
            x, y = PIP_X[i], PIP_Y
            stamp_rows(cv, ["5a", "w4", "43"], {"a": "echo_4", "5": "echo_5", "4": "echo_4",
                                               "w": "white", "3": "echo_2"}, x, y)
        out.append((f"ammo_{n}", cv))
    return out


DEVICES = [("turret", turret), ("frost_tower", frost_tower), ("lightning_tower", lightning_tower),
           ("shield_generator", shield_generator), ("generator", generator), ("battery", battery),
           ("lightning_synthesizer", lightning_synthesizer), ("ammo_workshop", ammo_workshop),
           ("expansion_platform", expansion_platform)]


def build():
    for name, fn in DEVICES:
        export("devices", f"device_{name}", fn(), kind="device")
    export("devices", "device_level_badges", level_badges(), kind="overlay",
           meta_extra={"anchor": "same 24x24 origin as the device frame"})
    export("devices", "cannon_main", cannon(), kind="device")
    export("devices", "cannon_ammo_pips", cannon_pips(), kind="overlay",
           meta_extra={"anchor": "same 32x32 origin as cannon_main"})


if __name__ == "__main__":
    build()
    print("ok")
