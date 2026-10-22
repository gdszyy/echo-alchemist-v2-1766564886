"""Affix variants on the 1x1 residue (elite = base residue + ONE big readable feature).

Every affix is a *layer*: a dict {(x, y): palette id} painted over the base residue
before outlining, plus optional feedback pixels (trails, sparks) painted after the
outline. Layers only add or recolour pixels, never erase, so

    combined_frame == base_frame (same state) + overlay_only_frame   (pixel-exact; checked)

which lets code composite base + affix at runtime. Damage stages: the base is
shattered with the affix feature protected, then the feature is painted back intact
(requirement: keep protected core / eyes / affix feature).

Silhouettes stay inside the 22x22 content box (x 1..22, y 1..22 incl. outline) like
the approved samples; features live on the body or in its empty corners.
"""
from __future__ import annotations

import math
import os
import sys
from typing import Dict, List, Optional, Tuple

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import enemy_residue as ER  # noqa: E402
from common import (Canvas, dilate, export, finish, hit_flash, offset_bands, save_preview, PREVIEW_DIR)  # noqa: E402
from residue import residue_damage, residue_idle_b  # noqa: E402

W = H = 24
BASE = ER.draw_body(include_shards=True)
BODY = BASE.mask()
BOX = {(x, y) for x in range(2, 22) for y in range(2, 22)}  # paintable area (outline still fits in 1..22)
Layer = Dict[Tuple[int, int], str]


# ----------------------------------------------------------------------------- helpers
def ell(cx, cy, rx, ry) -> set:
    t = Canvas(W, H)
    t.ellipse(cx, cy, rx, ry, "white")
    return t.mask()


def line(x0, y0, x1, y1) -> List[Tuple[int, int]]:
    t = Canvas(W, H)
    t.line(x0, y0, x1, y1, "white")
    pts = []
    dx, dy = abs(x1 - x0), -abs(y1 - y0)
    sx, sy = (1 if x0 < x1 else -1), (1 if y0 < y1 else -1)
    err = dx + dy
    while True:
        pts.append((x0, y0))
        if x0 == x1 and y0 == y1:
            break
        e2 = 2 * err
        if e2 >= dy:
            err += dy
            x0 += sx
        if e2 <= dx:
            err += dx
            y0 += sy
    return pts


def plate(L: Layer, m: set, r: str, base: int = 4, seam: bool = True) -> None:
    """Armour-style plate: same 4-step ramp + top-left rim as enemy_residue.draw_armor."""
    m = m & BOX
    deep = offset_bands(m, 2, 1, 1)
    for p in m:
        L[p] = f"{r}_{base}"
    for p in deep:
        L[p] = f"{r}_{base - 1}"
    for p in offset_bands(m, 1, 1, 1):
        L[p] = f"{r}_{max(1, base - 2)}"
    for p in offset_bands(m, 1, -1, -1):
        if p not in deep:
            L[p] = f"{r}_{min(5, base + 1)}"
    if seam:  # dark seam where the plate's lower edge sits on the body -> reads as ON the body
        for (x, y) in m:
            if (x, y + 1) in BODY and (x, y + 1) not in m:
                L[(x, y)] = "outline"


def paint(cv: Canvas, L: Layer) -> None:
    for (x, y), c in L.items():
        cv.put(x, y, c)


EYE_CORE = ER.protected_set()


# ----------------------------------------------------------------------------- affix layers
# each returns (layer, fx) for a phase (0 = idle_a, 1 = idle_b) and an optional state

def a_shield(phase=0, state=None):
    cv = BASE.copy()
    ER.draw_armor(cv, broken=(state == "armor_broken"))
    L = {(x, y): c for x, y, c in cv.pixels() if BASE.get(x, y) != c}
    return L, {}


def a_radiant_aegis(phase=0, state=None):
    """Prismatic shell: a glassy 1px shell standing off the dome + rainbow facet bands."""
    shell_out = (dilate(BODY, 1, ((1, 0), (-1, 0), (0, 1), (0, -1), (1, -1), (-1, -1))) - BODY)
    shell = {p for p in shell_out if p[1] <= 15} & BOX
    rim = {p for p in BODY if p[1] <= 15 and any((p[0] + dx, p[1] + dy) not in BODY for dx, dy in ((1, 0), (-1, 0), (0, -1)))}
    prism = ["cryo_5", "laser_4", "lightning_5", "venom_4", "cryo_4", "echo_5"]
    L: Layer = {}
    for (x, y) in shell | rim:
        ang = math.degrees(math.atan2(12 - y, x - 11.5)) % 360
        k = (int(ang // 30) + phase) % len(prism)
        L[(x, y)] = prism[k] if (x, y) in shell else "echo_1"
    # facet glints on the top-left of the shell
    for p in ((6, 3), (7, 2), (4, 6)):
        if p in L:
            L[p] = "white"
    # inner glass sheen streak over the dome
    for p in ((8, 5), (9, 4), (10, 4)):
        L[p] = "cryo_5"
    return L, {}


def a_haste(phase=0, state=None):
    """Dart silhouette: swept-back fins from the shoulders to the top corners (it moves DOWN,
    so the body reads as an arrowhead) + speed streaks trailing behind (above)."""
    L: Layer = {}
    for side in (0, 1):
        tri = [(4.0, 13.0), (1.6, 3.2), (7.0, 7.5)]
        if side:
            tri = [(24 - x, y) for x, y in tri]
        t = Canvas(W, H)
        t.polygon(tri, "white")
        m = t.mask() & BOX
        for p in m:
            L[p] = "steel_4"
        for p in offset_bands(m, 1, 1, 1):
            L[p] = "steel_2"
        for p in offset_bands(m, 1, -1, -1):
            L[p] = "white" if not side else "steel_5"
        for (x, y) in m:  # seam where the fin overlaps the body
            if (x, y) in BODY and ((x + (1 if not side else -1), y) not in m):
                L[(x, y)] = "outline"
    for p in ((5, 8), (6, 8), (7, 8), (16, 8), (17, 8), (18, 8)):   # lowered brows
        L[p] = "echo_1"
    fx = {}
    off = phase
    for x, y0, n in ((9, 1 + off, 2), (11, 1, 1 + (1 - off)), (14, 1 + off, 2)):
        for k in range(n):
            fx[(x, y0 + k)] = "white" if k == n - 1 else "steel_5"
    return L, fx


def a_regen(phase=0, state=None):
    """Glowing green veins branching from the core socket over the whole body."""
    paths = [((9, 16), (6, 14), (4, 11)), ((14, 16), (17, 14), (19, 11)), ((8, 13), (6, 9), (8, 5)),
             ((15, 13), (17, 9), (15, 5)), ((9, 19), (5, 19)), ((14, 19), (18, 19)), ((11, 13), (12, 6))]
    L: Layer = {}
    nodes = []
    for path in paths:
        for a, b in zip(path, path[1:]):
            for p in line(*a, *b):
                if p in BODY and p not in EYE_CORE:
                    L[p] = "venom_3"
        nodes.append(path[-1])
    for i, n in enumerate(nodes):
        L[n] = "venom_5" if (i + phase) % 2 == 0 else "venom_4"
    for p in list(L):
        if L[p] == "venom_3" and (p[0] + p[1] + phase) % 3 == 0:
            L[p] = "venom_4"
    return L, {}


def a_clone(phase=0, state=None):
    """Three budding offspring: mini residue blobs (own eyes + core dot) splitting off the parent."""
    L: Layer = {}
    buds = [(4.0, 4.6, 2.9, 2.5), (19.8, 5.2, 2.7, 2.5), (4.0, 19.6, 2.7, 2.2)]
    for i, (cx, cy, rx, ry) in enumerate(buds):
        s = 0.3 * phase if i != 1 else -0.2 * phase
        m = ell(cx, cy, rx + s, ry + s) & BOX
        for p in m:
            L[p] = "echo_4"
        for p in offset_bands(m, 1, 1, 1):
            L[p] = "echo_3"
        for p in offset_bands(m, 1, -1, -1):
            L[p] = "echo_5"
        # pinch line between bud and parent (dark seam) -> reads as a separate creature budding off
        for (x, y) in m:
            if any((x + dx, y + dy) in BODY and (x + dx, y + dy) not in m for dx, dy in ((1, 0), (0, 1), (-1, 0), (0, -1))):
                L[(x, y)] = "echo_1"
        cxi, cyi = int(cx), int(cy)
        L[(cxi - 1, cyi)] = "pyro_5"
        L[(cxi + 1, cyi)] = "pyro_5"
        L[(cxi, cyi + 1)] = "laser_4"
        L[(cxi, cyi)] = "echo_1"
    return L, {}


def a_berserk(phase=0, state=None):
    """Cracked hot fissures: lava-bright splits through the body, eyes go white-hot."""
    paths = [((6, 4), (8, 7), (6, 8)), ((16, 3), (14, 6), (16, 8)), ((11, 3), (12, 6), (11, 7)),
             ((3, 13), (6, 15), (4, 18)), ((20, 13), (17, 15), (19, 18))]
    L: Layer = {}
    for path in paths:
        for a, b in zip(path, path[1:]):
            for p in line(*a, *b):
                if p in BODY and p not in EYE_CORE:
                    L[p] = "pyro_5"
                    for q in ((p[0] + 1, p[1]), (p[0], p[1] + 1)):
                        if q in BODY and q not in EYE_CORE and q not in L:
                            L[q] = "pyro_3"
    for p, c in ER.face_pixels().items():
        if c == "pyro_5":
            L[p] = "white"
        elif c == "pyro_4":
            L[p] = "pyro_5"
    for p in ((5, 8), (6, 8), (17, 8), (18, 8)):
        L[p] = "pyro_2"
    fx = {}
    if phase:
        fx = {(4, 2): "pyro_4", (18, 1): "pyro_4", (12, 1): "pyro_5"}
    return L, fx


def a_healer(phase=0, state=None):
    """Core becomes a big glowing green cross."""
    L: Layer = {}
    cross = {(x, y) for x in range(10, 14) for y in range(13, 21)} | {(x, y) for x in range(7, 17) for y in range(15, 19)}
    for p in dilate(cross, 1, ((1, 0), (-1, 0), (0, 1), (0, -1))) & BODY:
        L[p] = "venom_1"
    for p in cross:
        L[p] = "venom_4"
    for p in offset_bands(cross, 1, 1, 1):
        L[p] = "venom_3"
    for p in offset_bands(cross, 1, -1, -1):
        L[p] = "venom_5"
    for p in ((11, 16), (12, 16), (11, 17)):
        L[p] = "white"
    if phase:
        for p in ((10, 14), (8, 16), (15, 16)):
            L[p] = "white"
    return L, {}


def a_devour(phase=0, state=None):
    """A huge maw splitting the lower face; the reactor core glows at the back of the throat."""
    L: Layer = {}
    mouth = ell(11.5, 15.6, 8.3, 4.7 + 0.4 * phase) & BODY
    for p in mouth:
        L[p] = "outline"
    lips = (dilate(mouth, 1, ((1, 0), (-1, 0), (0, 1), (0, -1))) - mouth) & BODY
    for p in lips:
        L[p] = "laser_2"
    ys = [p[1] for p in mouth]
    top, bot = min(ys), max(ys)
    for x in range(5, 19):
        if (x, top) in mouth and x % 2 == 0:
            L[(x, top)] = "stone_5"
            if (x, top + 1) in mouth and x % 4 == 0:
                L[(x, top + 1)] = "stone_4"
        if (x, bot) in mouth and x % 2 == 1:
            L[(x, bot)] = "stone_5"
    for p, c in {(11, 15): "laser_5", (12, 15): "laser_4", (11, 16): "laser_4", (12, 16): "laser_3",
                 (10, 16): "laser_2", (13, 15): "laser_2"}.items():
        L[p] = c
    for x in range(9, 15):
        if (x, bot - 1) in mouth:
            L[(x, bot - 1)] = "laser_3"
    return L, {}


def a_jump(phase=0, state=None):
    """Two coil-spring legs under the puddle (compress on idle_b)."""
    L: Layer = {}
    for x0 in (3, 16):
        rows = ["s", "d", "l", "d", "l", "f"] if phase == 0 else ["s", "l", "d", "l", "f"]
        y0 = 22 - len(rows)
        for j, k in enumerate(rows):
            y = y0 + j
            xs = range(x0, x0 + 5) if k in ("s", "f") else range(x0 + (j % 2), x0 + 4 + (j % 2))
            for x in xs:
                c = {"s": "steel_4", "f": "steel_3", "l": "steel_5", "d": "steel_2"}[k]
                if k == "f" and x == x0:
                    c = "steel_4"
                L[(x, y)] = c
    return L, {}


def a_living_armor(phase=0, state=None):
    """Regrowing bark shell: shaggy bark over crown + shoulders, leafy sprouts at the seams."""
    L: Layer = {}
    m = {p for p in BODY if p[1] <= 7} | {p for p in BODY if p[1] <= 14 and (p[0] <= 4 or p[0] >= 19)}
    m |= {p for p in ell(11.5, 4.5, 8.5, 3.0)} & BOX
    if state == "bark_regrowing":
        m = {p for p in m if p[0] <= 9 or (p[1] <= 4 and p[0] <= 13)}
    m -= EYE_CORE
    plate(L, m, "stone", base=3)
    for (x, y) in m:   # vertical bark grain
        if x % 3 == 0 and L.get((x, y)) != "outline" and (x, y - 1) in m:
            L[(x, y)] = "stone_1"
    for (x, y) in list(m):   # ragged lower edge: drop every other bottom pixel back to body
        if (x, y + 1) not in m and x % 2 == 0 and (x, y) in BODY:
            L.pop((x, y), None)
    leaves = [(5, 2), (15, 2), (2, 8)] if state != "bark_regrowing" else [(10, 2), (9, 5), (13, 2), (8, 8)]
    for i, (x, y) in enumerate(leaves):
        hi = "venom_5" if (i + phase) % 2 == 0 else "venom_4"
        for p, c in {(x, y): hi, (x + 1, y): "venom_4", (x, y + 1): "venom_3", (x + 1, y + 1): "venom_2"}.items():
            L[p] = c
    return L, {}


def a_armor_spore(phase=0, state=None):
    """Spore sacs bulging from the back (above the crown): sulphur pods with dark pores."""
    L: Layer = {}
    pods = [(4.4, 4.8, 3.1, 3.0), (19.4, 4.6, 2.9, 3.0), (11.6, 3.2, 3.0, 2.0)]
    for i, (cx, cy, rx, ry) in enumerate(pods):
        g = 0.35 * phase if i != 2 else 0.0
        m = ell(cx, cy, rx + g, ry + g) & BOX
        for p in m:
            L[p] = "lightning_3"
        for p in offset_bands(m, 1, 1, 1):
            L[p] = "lightning_2"
        for p in offset_bands(m, 1, -1, -1):
            L[p] = "lightning_4"
        cxi, cyi = int(cx), int(cy)
        for p in ((cxi, cyi), (cxi + 1, cyi + 1), (cxi - 1, cyi + 1)):
            if p in m:
                L[p] = "venom_1"
        if (cxi, cyi - 1) in m:
            L[(cxi, cyi - 1)] = "venom_4"
        for (x, y) in m:
            if (x, y + 1) in BODY and (x, y + 1) not in m:
                L[(x, y)] = "outline"
    fx = {}
    if phase:
        fx = {(2, 1): "venom_5", (21, 1): "venom_4", (7, 1): "venom_4", (16, 1): "venom_5"}
    return L, fx


def a_siege_breaker(phase=0, state=None):
    """A spiral drill replaces the right arm, pointing forward (down, toward the defence line)."""
    L: Layer = {}
    top, tip = 10, 21
    cone = set()
    for y in range(top, tip + 1):
        half = 2.6 * (1 - (y - top) / (tip - top + 1)) + 0.4
        for x in range(16, 23):
            if abs(x + 0.5 - 19.8) <= half:
                cone.add((x, y))
    cone &= {(x, y) for x in range(2, 22) for y in range(2, 22)}
    for (x, y) in cone:
        band = ((x + y + phase) // 2) % 2
        L[(x, y)] = "steel_5" if band == 0 else "steel_3"
    for p in offset_bands(cone, 1, 1, 0):
        L[p] = "steel_2"
    for x in range(16, 22):   # brass collar
        L[(x, top - 1)] = "lightning_3" if x > 16 else "lightning_4"
        L[(x, top - 2)] = "lightning_2" if x > 17 else "lightning_3"
    return L, {}


def a_deflect_shell(phase=0, state=None):
    """Five big scales orbiting the body (rotate between idle_a / idle_b)."""
    L: Layer = {}
    for i in range(5):
        a = math.radians(i * 72 + 36 * phase + 90)
        cx, cy = 11.5 + math.cos(a) * 9.0, 11.5 - math.sin(a) * 8.6
        m = ell(cx, cy, 2.5, 2.1) & BOX
        for p in m:
            L[p] = "cryo_3"
        for p in offset_bands(m, 1, 1, 1):
            L[p] = "cryo_1"
        for p in offset_bands(m, 1, -1, -1):
            L[p] = "cryo_5"
        cxi, cyi = int(round(cx - 0.5)), int(round(cy - 0.5))
        L[(cxi, cyi)] = "cryo_4"
        for (x, y) in m:   # every scale gets a dark rim where it lies on the body -> separate plates
            if any((x + dx, y + dy) not in m for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))) and (x, y) in BODY:
                L[(x, y)] = "outline"
    for p in EYE_CORE:
        L.pop(p, None)
    return L, {}


def a_energy_armor(phase=0, state=None):
    """Capacitor plates on both flanks, charged arc jumping across the crown."""
    L: Layer = {}
    for x0 in (2, 20):
        m = {(x, y) for x in range(x0, x0 + 2) for y in range(8, 19)}
        for (x, y) in m:
            L[(x, y)] = "lightning_4" if x == x0 else "lightning_3"
        for y in (11, 14, 17):
            for x in range(x0, x0 + 2):
                L[(x, y)] = "lightning_1"
        L[(x0, 8)] = "steel_5"
        L[(x0 + 1, 8)] = "steel_4"
        L[(x0, 7)] = "steel_3"
        L[(x0 + 1, 7)] = "steel_3"
    fx = {}
    zig = [(3, 6), (4, 5), (5, 5), (6, 4), (7, 4), (8, 2), (9, 3), (10, 2), (11, 1), (12, 2), (13, 1),
           (14, 2), (15, 3), (16, 2), (17, 4), (18, 4), (19, 5), (20, 6)]
    if phase:
        zig = [(x, y + (1 if 6 <= x <= 17 and (x % 2) else 0)) for (x, y) in zig]
    for i, p in enumerate(zig):
        if p not in BODY:
            fx[p] = "lightning_5" if i % 3 else "white"
    return L, fx


def a_phase_shield(phase=0, state=None):
    """Phase emitter gem on the crown + ghost afterimage: a second, offset contour and ghost eyes
    double-exposed over the body. state 'phase_off' (every 3rd turn): emitter dark, no ghost."""
    L: Layer = {}
    off = state == "phase_off"
    gem = {(11, 2): "echo_5", (12, 2): "echo_4", (10, 3): "echo_4", (11, 3): "white", (12, 3): "echo_5", (13, 3): "echo_3",
           (11, 4): "echo_4", (12, 4): "echo_3"}
    for p, c in gem.items():
        L[p] = ("echo_2" if c in ("white", "echo_5") else "echo_1") if off else c
    fx: Layer = {}
    if not off:
        dx, dy = (-3, -1) if phase == 0 else (3, -1)
        edge = {p for p in BODY if any((p[0] + a, p[1] + b) not in BODY for a, b in ((1, 0), (-1, 0), (0, 1), (0, -1)))}
        for (x, y) in edge:
            q = (x + dx, y + dy)
            if q in gem:
                continue
            if q in BODY and q not in EYE_CORE and q not in edge:
                L[q] = "cryo_4" if (q[0] + q[1]) % 2 else "echo_5"
            elif q not in BODY and 1 <= q[0] <= 22 and 1 <= q[1] <= 22:
                fx[q] = "echo_4" if (q[0] + q[1]) % 2 else "cryo_4"
        for (x, y), c in ER.face_pixels().items():
            if c in ("pyro_5", "pyro_4"):
                q = (x + dx, y + dy)
                if q in BODY and q not in EYE_CORE:
                    L[q] = "cryo_5"
    return L, fx


def a_overload_reactor(phase=0, state=None):
    """Core housing torn open: steel containment ring, overheating yellow-white reactor, vents."""
    L: Layer = {}
    ring = ell(11.5, 17.0, 6.2, 4.6) & BODY
    inner = ell(11.5, 17.0, 4.2, 3.0)
    for p in ring - inner:
        L[p] = "steel_3"
    for p in offset_bands(ring, 1, -1, -1):
        L[p] = "steel_5"
    for p in offset_bands(ring, 1, 1, 1):
        L[p] = "steel_2"
    for p in inner:
        L[p] = "pyro_4"
    hot = ell(11.5, 17.0, 2.6, 1.9)
    for p in hot:
        L[p] = "lightning_5"
    for p in ((11, 16), (12, 16), (11, 17), (12, 17)):
        L[p] = "white"
    for p in ((6, 17), (17, 17), (11, 13), (12, 13)):   # bolts
        L[p] = "lightning_3"
    for (x, y) in ((8, 14), (15, 14), (8, 20), (15, 20)):  # vent slots
        L[(x, y)] = "outline"
    fx = {}
    sp = [(10, 12), (14, 11), (8, 12)] if phase == 0 else [(12, 11), (9, 11), (15, 12)]
    for p in sp:
        if p not in BODY:
            fx[p] = "lightning_5"
        else:
            L[p] = "lightning_5"
    return L, fx


def a_low_damage_immune(phase=0, state=None):
    """Thick banded carapace (armadillo-like) covering crown + flanks; 2px-thick rim."""
    L: Layer = {}
    m = ({p for p in ell(11.5, 7.0, 10.0, 5.6)} & {p for p in BOX if p[1] <= 8})
    m |= {p for p in BODY if p[0] <= 4 and 8 <= p[1] <= 18} | {p for p in BODY if p[0] >= 19 and 8 <= p[1] <= 18}
    m -= EYE_CORE
    plate(L, m, "stone", base=4)
    for (x, y) in m:
        if y in (5, 8) and L.get((x, y)) != "outline":
            L[(x, y)] = "stone_2"
        if y in (11, 14, 17) and (x <= 4 or x >= 19):
            L[(x, y)] = "stone_2"
    # inner thickness lip: body pixels just under the carapace go darkest
    for (x, y) in m:
        q = (x, y + 1)
        if q in BODY and q not in m and q not in EYE_CORE:
            L[q] = "echo_1"
    for p in ((7, 3), (8, 3), (9, 2), (2, 9), (2, 12)):
        L[p] = "stone_5"
    return L, {}


def a_rune_bearer(phase=0, state=None):
    """A standing rune stone strapped to the back, rune mark glowing."""
    L: Layer = {}
    slab = {(x, y) for x in range(14, 21) for y in range(2, 10)} | {(x, 1) for x in range(15, 20)}
    slab -= {(20, 2), (14, 9)}
    plate(L, slab, "stone", base=3, seam=False)
    for (x, y) in slab:
        if (x, y + 1) in BODY and (x, y + 1) not in slab:
            L[(x, y)] = "outline"
    rune = [(17, 2), (17, 3), (17, 4), (17, 5), (17, 6), (17, 7), (16, 3), (15, 4), (18, 4), (19, 3), (16, 6), (18, 6)]
    for i, p in enumerate(rune):
        L[p] = "white" if (i + phase) % 5 == 0 else "cryo_4"
    fx = {}
    if phase:
        fx = {(21, 2): "cryo_4", (13, 1): "cryo_4", (21, 6): "cryo_5"}
    return L, fx


AFFIXES = {
    "shield": (a_shield, ["armor_broken"]),
    "radiantAegis": (a_radiant_aegis, []),
    "haste": (a_haste, []),
    "regen": (a_regen, []),
    "clone": (a_clone, []),
    "berserk": (a_berserk, []),
    "healer": (a_healer, []),
    "devour": (a_devour, []),
    "jump": (a_jump, []),
    "livingArmor": (a_living_armor, ["bark_regrowing"]),
    "armorSpore": (a_armor_spore, []),
    "siegeBreaker": (a_siege_breaker, []),
    "deflectShell": (a_deflect_shell, []),
    "energyArmor": (a_energy_armor, []),
    "phaseShield": (a_phase_shield, ["phase_off"]),
    "overloadReactor": (a_overload_reactor, []),
    "lowDamageImmune": (a_low_damage_immune, []),
    "runeBearer": (a_rune_bearer, []),
}


# ----------------------------------------------------------------------------- frames
def paint_fx(cv: Canvas, fx: Layer) -> None:
    for (x, y), c in fx.items():
        if cv.get(x, y) is None:
            cv.put(x, y, c)


def finish_layer(cv: Canvas) -> Canvas:
    """finish() + make sure pixels painted in the outline colour by a layer (seams on the
    rim) still cast the 1px outline, so the silhouette never loses its outer ring."""
    out = finish(cv)
    src = [(x, y) for x, y, c in cv.pixels() if c == "outline"]
    for (x, y) in src:
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            if out.inb(x + dx, y + dy) and out.get(x + dx, y + dy) is None:
                out.put(x + dx, y + dy, "outline")
    return out


def frost_cap(cv: Canvas, L: Layer) -> None:
    """Frozen: affix feature keeps its identity but gets a frost cap on its top pixels."""
    for (x, y) in L:
        if (x, y - 1) not in L and cv.get(x, y) not in (None, "outline"):
            cv.put(x, y, "cryo_4")


def base_frames_raw():
    """Base residue frames (finished) keyed by state; mirrors residue.residue_frames()."""
    idle_a = finish(BASE)
    out = {"idle_a": idle_a, "idle_b": finish(residue_idle_b(BASE)), "hit_flash": hit_flash(idle_a)}
    for hp in (0.75, 0.5, 0.25):
        out[f"hp_{int(hp * 100)}"] = finish(residue_damage(BASE, hp))
    out["frozen"] = finish(ER.frozen(BASE))
    b = finish(ER.burning(BASE))
    ER.burning_fx(b, BASE.mask(), 0)
    out["burning"] = b
    out["death_1"], out["death_2"] = ER.death_frames(idle_a)
    return out


def affix_frames(key: str):
    fn, extra_states = AFFIXES[key]
    L0, fx0 = fn(0)
    L1, fx1 = fn(1)
    feat = set(L0)
    # shield keeps the approved sample behaviour: armour breaks first, HP stages use broken armour
    Ldmg = fn(0, "armor_broken")[0] if key == "shield" else L0

    def combo(raw_base: Canvas, L: Layer, fx: Layer, transform=None) -> Canvas:
        cv = raw_base.copy()
        paint(cv, L)
        if transform:
            cv = transform(cv)
        cv = finish_layer(cv)
        paint_fx(cv, fx)
        return cv

    frames = []
    idle_a = combo(BASE, L0, fx0)
    frames.append(("idle_a", idle_a))
    frames.append(("idle_b", combo(BASE, L1, fx1, residue_idle_b)))
    frames.append(("hit_flash", hit_flash(idle_a)))
    for hp in (0.75, 0.5, 0.25):
        dmg = residue_damage(BASE, hp, extra_protect=set(Ldmg))
        frames.append((f"hp_{int(hp * 100)}", combo(dmg, Ldmg, fx0)))
    fr = ER.frozen(BASE)
    paint(fr, L0)
    frost_cap(fr, L0)
    frames.append(("frozen", finish_layer(fr)))
    braw = ER.burning(BASE)
    paint(braw, L0)
    b = finish_layer(braw)
    ER.burning_fx(b, braw.mask(), 0)
    frames.append(("burning", b))
    d1, d2 = ER.death_frames(idle_a)
    frames += [("death_1", d1), ("death_2", d2)]
    for st in extra_states:
        Ls, fxs = fn(0, st)
        frames.append((st, combo(BASE, Ls, fxs)))
    return frames, feat


def overlay_only(frames, base):
    """overlay = combined pixels that differ from the base frame of the same state."""
    out = []
    erased = 0
    for lab, cv in frames:
        bref = base.get(lab, base["idle_a"])
        o = Canvas(W, H)
        for y in range(H):
            for x in range(W):
                c, b = cv.get(x, y), bref.get(x, y)
                if c is not None and c != b:
                    o.put(x, y, c)
                elif c is None and b is not None:
                    erased += 1
        out.append((lab, o))
    return out, erased


def main():
    base = base_frames_raw()
    report = {}
    for key in AFFIXES:
        frames, feat = affix_frames(key)
        ov, erased = overlay_only(frames, base)
        name = f"elite_residue_{key}_1x1"
        export(name, frames, {
            "kind": "enemy", "grid": [1, 1], "affix": key, "collision": {"shape": "aabb", "w": 24, "h": 24},
            "fill_ratio_frames": ["idle_a", "idle_b"],
            "overlay_sheet": f"{name}_overlay.png",
            "composite_rule": "base enemy_residue_1x1 frame (same label; extra states use idle_a) + overlay frame",
            "overlay_exact": erased == 0, "overlay_erased_px": erased,
        })
        export(f"{name}_overlay", ov, {
            "kind": "enemy_overlay", "affix": key, "base_sheet": "enemy_residue_1x1.png",
            "composite_rule": "draw over the base frame with the same label (extra states over idle_a)",
            "exact": erased == 0,
        }, preview=False)
        report[key] = erased
    return report


if __name__ == "__main__":
    r = main()
    print("overlay erased px:", r)
