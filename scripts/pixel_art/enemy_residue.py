"""enemy_residue_1x1 and enemy_residue_shield_1x1 -- native pixel art, drawn from function.

Design intent (docs/art/redraw_requirements_v1.md §1, art_vfx_ui_direction_v1.md §3):
* A blob-golem of spilled alchemical residue: heavy puddle base with drips (it oozes
  downward toward the defence line), stubby arm lumps, two crystallised shards on top.
* Focal points: a magenta reagent core in the belly (laser ramp) and two yellow eyes
  under angry brows. Both are PROTECTED: damage removes 2x2 clusters from the outside
  in and never touches the core/eye sockets.
* HP = shape: 4 fixed stages (100/75/50/25). Each stage removes a deterministic set of
  clusters (fixed seed) and draws crack segments on the next clusters to go.
* Elite "shield" affix = big readable steel armour (helmet with crest + two pauldrons +
  brass core collar). Armour breaks first ("armor broken" frame) before HP pixels go.
"""
from __future__ import annotations

import math
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from pxlib import PAL, Canvas, export_sheet, offset_bands, ramp, seeded, shade_body  # noqa: E402

W = H = 24
SEED = 20261022

# ----------------------------------------------------------------------------- shapes
def body_mask() -> set:
    t = Canvas(W, H)
    t.ellipse(12, 11.9, 9.3, 8.2, "white")          # dome
    t.ellipse(12, 18.4, 9.9, 3.4, "white")          # puddle base
    t.ellipse(4.6, 14.0, 2.4, 3.0, "white")         # arm lumps
    t.ellipse(19.4, 14.0, 2.4, 3.0, "white")
    # drips: carve gaps along the bottom row so three lobes hang down
    for x in range(0, 24):
        if x in (7, 8, 15, 16):
            t.put(x, 21, None)
    for x in (2, 3, 20, 21):
        t.put(x, 21, None)
    # notch under the arms so they read as separate lumps
    for x, y in ((3, 17), (20, 17), (2, 17), (21, 17)):
        t.put(x, y, None)
    return t.mask()


SHARDS = {  # crystallised residue growing off the right of the crown (asymmetric -> not "ears")
    (15, 2): "echo_5", (14, 2): "echo_5", (14, 3): "echo_4", (15, 3): "echo_3",
    (13, 4): "echo_4", (14, 4): "echo_3",
    (17, 3): "echo_5", (17, 4): "echo_4", (18, 4): "echo_3",
}

FACE = [  # rows 8..20 : slanted angry eyes, jagged mouth, reactor-core diamond with glowing veins
    "......1..........1......",
    ".....1eeo......oee1.....",
    "......1EEo....oEE1......",
    ".......11......11.......",
    ".........o.oo.o.........",
    "..........o..o..........",
    "...........11...........",
    "..........1cc1..........",
    ".........1cCCc1.........",
    "........1cCwWCc1........",
    "........1cCWWCc1........",
    ".........1cCCc1.........",
    "..........1cc1..........",
]
FACE_Y = 8
FACE_MAP = {
    "o": "outline", "1": "echo_1", "e": "pyro_5", "E": "pyro_4",
    "c": "laser_3", "C": "laser_4", "W": "laser_5", "w": "white",
}


def face_pixels():
    out = {}
    for j, row in enumerate(FACE):
        for i, ch in enumerate(row):
            if ch != ".":
                out[(i, FACE_Y + j)] = FACE_MAP[ch]
    return out


def protected_set() -> set:
    """Eyes + core diamond (+ its socket). Never removed by damage; mouth/veins may crack away."""
    return {p for p, c in face_pixels().items() if c in ("pyro_5", "pyro_4", "laser_4", "laser_5", "white")
            or (p[1] >= 14 and c in ("echo_1", "laser_3") and 9 <= p[0] <= 14)}


# ----------------------------------------------------------------------------- base body
def draw_body(include_shards=True) -> Canvas:
    m = body_mask()
    cv = Canvas(W, H)
    spec = [(7, 6), (8, 6), (6, 7)]  # wet highlight on the dome, top-left
    shade_body(cv, m, "echo", base=3, deep=3, spec=spec)
    # goo streaks: a darker drip line running down from the face area
    for p in ((5, 18), (5, 19), (18, 18), (18, 19)):
        if p in m:
            cv.put(p[0], p[1], "echo_2")
    if include_shards:
        for (x, y), c in SHARDS.items():
            cv.put(x, y, c)
    for (x, y), c in face_pixels().items():
        cv.put(x, y, c)
    return cv


# ----------------------------------------------------------------------------- armour (elite)
def draw_armor(cv: Canvas, broken: bool = False) -> None:
    """Steel helmet with crest + pauldrons + brass core collar, with seams."""
    plates = {}

    def plate(pts_fn):
        t = Canvas(W, H)
        pts_fn(t)
        return t.mask()

    helmet = plate(lambda t: (t.ellipse(12, 8.6, 8.2, 5.4, "white"),
                              t.rect(0, 8, 24, 16, None)))           # keep upper half only
    helmet |= {(11, 2), (12, 2), (10, 3), (13, 3)}  # crest
    helmet |= {(4, 5), (19, 5)}  # flared brim tips
    lp = plate(lambda t: t.ellipse(5.0, 12.2, 3.0, 3.0, "white"))
    rp = {(23 - x, y) for (x, y) in lp}
    if broken:
        # right half of helmet sheared off, right pauldron gone, left pauldron cracked
        helmet = {(x, y) for (x, y) in helmet if not (x >= 13 and y <= 6) and not (x >= 16)}
        rp = set()
    for name, m in (("helmet", helmet), ("lp", lp), ("rp", rp)):
        if not m:
            continue
        # 4-step steel ramp lit top-left
        for p in m:
            cv.put(p[0], p[1], "steel_4")
        for p in offset_bands(m, 2, 1, 1):
            cv.put(p[0], p[1], "steel_3")
        for p in offset_bands(m, 1, 1, 1):
            cv.put(p[0], p[1], "steel_2")
        for p in offset_bands(m, 1, -1, -1):
            if p not in offset_bands(m, 2, 1, 1):
                cv.put(p[0], p[1], "steel_5")
        # seam: plate pixels adjacent to body (non-plate opaque) become outline
        for (x, y) in m:
            for dx, dy in ((0, 1), (1, 0), (-1, 0)):
                q = (x + dx, y + dy)
                if q not in m and cv.get(*q) is not None and q not in helmet and q not in lp and q not in rp:
                    if dy == 1:  # bottom seam only -> plates sit ON the body
                        cv.put(x, y, "outline")
        plates[name] = m
    # highlights + rivets (intentional single pixels)
    if "helmet" in plates:
        for p in ((8, 4), (9, 4), (10, 3), (11, 2)):
            if p in plates["helmet"]:
                cv.put(p[0], p[1], "steel_5")
        for y in range(3, 8):
            for p in ((11, y), (12, y)):
                if p in plates["helmet"]:
                    cv.put(p[0], p[1], "steel_5" if p[0] == 11 else "steel_3")
        for p in ((7, 6), (16, 6)):
            if p in plates["helmet"]:
                cv.put(p[0], p[1], "lightning_3")
    for key, riv, hl in (("lp", (5, 12), [(4, 10), (5, 10)]), ("rp", (18, 12), [(18, 10), (19, 10)])):
        if key in plates:
            for p in hl:
                cv.put(p[0], p[1], "steel_5")
            cv.put(riv[0], riv[1], "lightning_3")
    # brass collar around the core socket (keeps core visible = protected focal point)
    collar = [(7, 16), (7, 17), (7, 18), (7, 19), (16, 16), (16, 17), (16, 18), (16, 19)]
    for p in collar:
        cv.put(p[0], p[1], "lightning_3" if p[1] < 18 else "lightning_2")
    for p in ((6, 17), (17, 17)):
        cv.put(p[0], p[1], "lightning_4")
    if broken:
        # cracks in left pauldron + helmet stub
        for p in ((5, 11), (5, 12), (4, 13), (6, 3)):
            cv.put(p[0], p[1], "outline")
        cv.put(16, 18, "outline")
        cv.put(16, 19, None)


# ----------------------------------------------------------------------------- damage
def clusters_for(cv: Canvas):
    """2x2 clusters ordered outside-in with a fixed-seed jitter. Protected pixels are kept
    even when their cluster is removed."""
    m = cv.mask()
    prot = protected_set()
    cl = []
    for cy in range(0, H, 2):
        for cx in range(0, W, 2):
            pix = [(cx + i, cy + j) for i in (0, 1) for j in (0, 1) if (cx + i, cy + j) in m and (cx + i, cy + j) not in prot]
            if pix:
                cl.append((cx, cy, pix))
    rnd = seeded(SEED)
    scored = []
    for cx, cy, pix in cl:
        d = math.hypot(cx + 1 - 12, (cy + 1 - 14) * 1.15)
        top_bias = 2.0 if cy < 6 else 0.0  # crown/crystals chip first
        scored.append((d + top_bias + rnd.uniform(0, 2.4), cx, cy, pix))
    scored.sort(key=lambda s: -s[0])
    return [(cx, cy, pix) for _, cx, cy, pix in scored]


CRACK_ANGLES = (125, 20, 250, 70)
# share of the breakable pool gone per stage (front-loaded so the first hit already reads)
STAGE_FRACTION = {0.75: 0.32, 0.5: 0.6, 0.25: 0.85}


def damage(cv: Canvas, hp: float) -> Canvas:
    out = cv.copy()
    order = clusters_for(cv)
    n = len(order)
    gone = int(STAGE_FRACTION[hp] * n)
    for cx, cy, pix in order[:gone]:
        for p in pix:
            out.put(p[0], p[1], None)
    # crack lines: from the broken edge toward the core; inner pixels leak core light
    prot = protected_set()
    n_cracks = {0.75: 2, 0.5: 3, 0.25: 4}.get(hp, 0)
    for ang in CRACK_ANGLES[:n_cracks]:
        a = math.radians(ang)
        cx0, cy0 = 12.0, 16.0
        edge = None
        for r in range(1, 16):
            x, y = int(round(cx0 + math.cos(a) * r)), int(round(cy0 - math.sin(a) * r))
            if out.get(x, y) is None:
                break
            edge = (x, y)
        if edge is None:
            continue
        pts = []
        for r in range(0, 5):
            x, y = int(round(edge[0] - math.cos(a) * r)), int(round(edge[1] + math.sin(a) * r))
            if (x, y) in prot or out.get(x, y) is None:
                break
            pts.append((x, y))
        for i, (x, y) in enumerate(pts):
            out.put(x, y, "outline" if i < 2 else "laser_3")
    out.remove_orphans(min_neighbours=1)
    # break off thin slivers (pixels with a single neighbour on a removed edge) at deep stages
    return out


# ----------------------------------------------------------------------------- overlays
def frozen(cv: Canvas) -> Canvas:
    out = cv.copy()
    ice_core = {"laser_3": "laser_2", "laser_4": "laser_3", "laser_5": "laser_4", "white": "laser_5"}

    def fn(x, y, c):
        if c.startswith("echo_"):
            return {"echo_1": "steel_1", "echo_2": "steel_2", "echo_3": "steel_3", "echo_4": "steel_4", "echo_5": "steel_5"}[c]
        if c in ice_core:
            return ice_core[c]
        if c in ("pyro_5", "pyro_4"):
            return "cryo_5" if c == "pyro_5" else "cryo_4"
        return c
    out.recolor(fn)
    m = cv.mask()
    # crust: top 2 px of every column + left/right edge, thicker on top-left (light side)
    for x in range(W):
        ys = sorted(y for (xx, y) in m if xx == x)
        if not ys:
            continue
        top = ys[0]
        out.put(x, top - 1, "cryo_4")
        out.put(x, top, "cryo_3" if x > 12 else "cryo_4")
        if x < 12:
            out.put(x, top + 1, "cryo_3")
    for y in range(H):
        xs = sorted(x for (x, yy) in m if yy == y)
        if not xs or y > 17:
            continue
        out.put(xs[0], y, "cryo_4" if y < 12 else "cryo_3")
        out.put(xs[-1], y, "cryo_3")
    # icicles hanging off the arm lumps
    for x, y0 in ((3, 17), (20, 17)):
        out.put(x, y0, "cryo_3")
        out.put(x, y0 + 1, "cryo_4")
    # glints
    for p in ((7, 4), (8, 4), (5, 7)):
        if out.get(*p) is not None or (p[0], p[1] + 1) in m:
            out.put(p[0], p[1], "cryo_5")
    return out


FLAME = ["..5..", ".545.", ".343.", "34443"]
FLAME_S = [".5.", "545", "343"]


def burning(cv: Canvas) -> Canvas:
    out = cv.copy()
    m = cv.mask()
    tops = {}
    for (x, y) in m:
        tops[x] = min(tops.get(x, 99), y)
    # heated rim: top body pixels glow
    for x, y in tops.items():
        c = out.get(x, y)
        if c and c.startswith("echo_"):
            out.put(x, y, "pyro_3")
        c2 = out.get(x, y + 1)
        if c2 and c2.startswith("echo_"):
            out.put(x, y + 1, "pyro_2")
    return out


def burning_fx(out: Canvas, cv_mask: set, phase: int = 0) -> None:
    """Feedback layer: flames + embers, drawn after outline (never outlined)."""
    cmap = {"3": "pyro_3", "4": "pyro_4", "5": "pyro_5"}
    tops = {}
    for (x, y) in cv_mask:
        tops[x] = min(tops.get(x, 99), y)
    for fx, small in ((5, False), (12, True), (16, False)):
        g = FLAME_S if small else FLAME
        gw = len(g[0])
        base = tops.get(fx + gw // 2, 10)
        oy = base - len(g) + 1 - (1 if phase else 0)
        for j, row in enumerate(g):
            for i, ch in enumerate(row):
                if ch != ".":
                    out.put(fx + i, oy + j, cmap[ch])
    for p in ((3, 4), (20, 2), (1, 9)):
        out.put(p[0], p[1], "pyro_5")


def hit_flash(cv: Canvas) -> Canvas:
    out = cv.copy()
    out.recolor(lambda x, y, c: c if c == "outline" else "white")
    return out


def death_frames(idle: Canvas):
    frames = []
    cxc, cyc = 12, 14
    for stage in (1, 2):
        out = Canvas(W, H)
        k = 4
        for by in range(0, H, k):
            for bx in range(0, W, k):
                cells = [(bx + i, by + j) for i in range(k) for j in range(k) if idle.get(bx + i, by + j) is not None]
                if len(cells) < 4:
                    continue
                vx, vy = bx + 2 - cxc, by + 2 - cyc
                sx = (vx > 0) - (vx < 0)
                sy = (vy > 0) - (vy < 0)
                if stage == 1:   # split into quadrants along a cross crack
                    ox, oy = sx, sy
                else:            # pieces fly further and fall
                    ox, oy = sx * 3, sy * 2 + 2
                if stage == 2 and ((bx // k + by // k) % 2 == 1):
                    continue
                for (x, y) in cells:
                    if stage == 2 and not (bx + 1 <= x <= bx + 2 and by + 1 <= y <= by + 2):
                        continue
                    out.put(x + ox, y + oy, idle.get(x, y))
        # core rupture burst (feedback layer)
        if stage == 1:
            for p in ((12, 12), (11, 13), (12, 13), (13, 13), (10, 14), (11, 14), (12, 14), (13, 14),
                      (14, 14), (11, 15), (12, 15), (13, 15), (12, 16), (11, 12), (11, 16)):
                out.put(p[0], p[1], "white")
            for p in ((9, 14), (15, 14), (12, 11), (11, 17), (12, 17)):
                out.put(p[0], p[1], "laser_5")
        else:
            for p in ((12, 10), (12, 18), (8, 14), (16, 14), (9, 11), (15, 11), (9, 17), (15, 17)):
                out.put(p[0], p[1], "laser_4")
            for p in ((12, 11), (12, 17), (9, 14), (15, 14)):
                out.put(p[0], p[1], "laser_5")
        out.remove_orphans(keep=("laser_4", "laser_5", "white"), min_neighbours=1)
        frames.append(out)
    return frames


# ----------------------------------------------------------------------------- assemble
def finish(cv: Canvas) -> Canvas:
    out = cv.copy()
    out.outline("outline")
    return out


def build(shield: bool):
    raw = draw_body(include_shards=not shield)
    if shield:
        draw_armor(raw)
    idle_a = finish(raw)
    # idle B: 1px squash-bob (body sinks 1px into the puddle) + core pulse
    raw_b = raw.copy()
    pulse = {"laser_3": "laser_4", "laser_4": "laser_5"}
    raw_b.recolor(lambda x, y, c: pulse.get(c, c) if 12 <= y <= 17 and 8 <= x <= 15 else c)
    # squash: everything above the puddle sinks 1px into it (puddle anchored -> no drift)
    lifted = Canvas(W, H)
    for x, y, c in raw_b.pixels():
        if y >= 19:
            lifted.put(x, y, c)
    for x, y, c in raw_b.pixels():
        if y < 19:
            lifted.put(x, y + 1, c)
    idle_b = finish(lifted)

    frames = [("idle_a", idle_a), ("idle_b", idle_b), ("hit_flash", hit_flash(idle_a))]
    dmg_src = raw
    if shield:
        broken = draw_body(include_shards=False)
        draw_armor(broken, broken=True)
        frames.append(("armor_broken", finish(broken)))
        dmg_src = draw_body(include_shards=False)   # armour gone -> HP pixels start to go
        draw_armor(dmg_src, broken=True)
    for hp in (0.75, 0.5, 0.25):
        frames.append((f"hp_{int(hp*100)}", finish(damage(dmg_src, hp))))
    fr = finish(frozen(raw))
    frames.append(("frozen", fr))
    b = finish(burning(raw))
    burning_fx(b, raw.mask(), 0)
    frames.append(("burning", b))
    d1, d2 = death_frames(idle_a)
    frames.append(("death_1", d1))
    frames.append(("death_2", d2))
    return frames


def main():
    out = {}
    for shield, name in ((False, "enemy_residue_1x1"), (True, "enemy_residue_shield_1x1")):
        frames = build(shield)
        export_sheet(name, frames, kind="enemy", meta_extra={
            "fill_ratio_frames": ["idle_a", "idle_b"] + (["armor_broken"] if shield else []),
            "protected": "face + core sockets (dilated 1px) never removed by damage stages",
            "damage_seed": SEED,
        })
        out[name] = frames
    return out


if __name__ == "__main__":
    main()
    print("ok")
