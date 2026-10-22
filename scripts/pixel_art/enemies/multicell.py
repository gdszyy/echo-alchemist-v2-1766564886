"""Multi-cell elite archetypes (src/spawn_system.js ~3418-3655).

Canvas = cols*26-2 x rows*26-2 art px. Collision shapes from spawn_applyArchetypeShape,
mapped with w = canvas width, h = canvas height, origin at the canvas centre. Polygon
bodies are the polygon raster eroded by 1px (the outline lands on the polygon rim).

Family rules kept from the approved residue: goo body lit top-left (pxlib.shade_body,
base step 3), armour-style plates (4-step ramp + top-left rim + dark seam), angry slit
eyes under brows, diamond reactor core in a dark socket, 1px outline, feedback pixels
after the outline. Each archetype's function is carried by ONE big structure.
"""
from __future__ import annotations

import math
import os
import sys
from typing import Callable, Dict, List, Optional, Sequence, Tuple

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import (EYES, Canvas, Theme, stamp, death_generic, dilate, draw_face, erode, export, finish, flames_fx,  # noqa: E402
                    frozen_generic, heat_rim, hit_flash, offset_bands, poly_px, ramp, seeded, shade_body, shatter)

CELL = 26
RES = Theme("echo", "laser")


def canvas_size(cols, rows):
    return cols * CELL - 2, rows * CELL - 2


def mapP(vs, W, H):
    return [(W / 2 + vx * W, H / 2 + vy * H) for vx, vy in vs]


def ell(W, H, cx, cy, rx, ry) -> set:
    t = Canvas(W, H)
    t.ellipse(cx, cy, rx, ry, "white")
    return t.mask()


def rect(x0, y0, x1, y1) -> set:
    return {(x, y) for x in range(x0, x1 + 1) for y in range(y0, y1 + 1)}


def rrect(x0, y0, x1, y1, r) -> set:
    out = set()
    for (x, y) in rect(x0, y0, x1, y1):
        cx = min(max(x, x0 + r), x1 - r)
        cy = min(max(y, y0 + r), y1 - r)
        if (x - cx) ** 2 + (y - cy) ** 2 <= r * r + 0.5:
            out.add((x, y))
    return out


def plate(cv: Canvas, m: set, r: str, base: int = 4, body: Optional[set] = None, seam: bool = True) -> None:
    """Armour plate, same recipe as enemy_residue.draw_armor."""
    deep = offset_bands(m, 2, 1, 1)
    for p in m:
        cv.put(p[0], p[1], f"{r}_{base}")
    for p in deep:
        cv.put(p[0], p[1], f"{r}_{base - 1}")
    for p in offset_bands(m, 1, 1, 1):
        cv.put(p[0], p[1], f"{r}_{max(1, base - 2)}")
    for p in offset_bands(m, 1, -1, -1):
        if p not in deep:
            cv.put(p[0], p[1], f"{r}_{min(5, base + 1)}")
    if seam and body is not None:
        for (x, y) in m:
            if (x, y + 1) in body and (x, y + 1) not in m:
                cv.put(x, y, "outline")


BUBBLE = [".44.", "4533", ".32."]   # convex goo bubble, lit top-left
PIT = [".22.", "2114", ".44."]      # concave pocket, lit on its lower-right inner wall


def goo(cv: Canvas, m: set, r: str = "echo", deep: int = 3, spec=None, detail: bool = True) -> None:
    """Residue goo, same shading as the 1x1 (shade_body base 3) + for big bodies the same
    texture density as the 1x1 (bubbles, pits, drip streaks) so large areas never go flat."""
    tl = sorted(m, key=lambda p: (p[0] + p[1], p[1]))
    if spec is None:
        spec = [p for p in tl[4:20] if (p[0] + 1, p[1] + 1) in m][:3]
    shade_body(cv, m, r, base=3, deep=deep, spec=spec)
    if not detail or len(m) < 700:
        return
    rnd = seeded(len(m))
    # bulging lobes: the 1x1 is one lit dome; big bodies get several overlapping domes so the
    # volume reads at the same density (lit crescent top-left, shadow crescent bottom-right)
    inner0 = sorted(p for p in m if all((p[0] + dx, p[1] + dy) in m for dx in (-6, 0, 6) for dy in (-5, 0, 5)))
    lobes = []
    for i in range(max(2, len(m) // 520)):
        c = rnd.choice(inner0)
        if any(abs(c[0] - q[0]) < 11 and abs(c[1] - q[1]) < 8 for q in lobes):
            continue
        lobes.append(c)
        rx, ry = rnd.uniform(6, 9), rnd.uniform(4, 6)
        for (x, y) in m:
            dx, dy = (x + 0.5 - c[0]) / rx, (y + 0.5 - c[1]) / ry
            d = dx * dx + dy * dy
            if 0.72 <= d <= 1.0 and cv.get(x, y) == ramp(r, 3):
                if dx + dy < -0.5:
                    cv.put(x, y, ramp(r, 4))
                elif dx + dy > 0.6:
                    cv.put(x, y, ramp(r, 2))
    inner = sorted(p for p in m if all((p[0] + dx, p[1] + dy) in m for dx in (-4, 0, 4) for dy in (-4, 0, 4)))
    placed = []
    for i in range(len(m) // 170):
        p = rnd.choice(inner)
        if any(abs(p[0] - q[0]) < 7 and abs(p[1] - q[1]) < 6 for q in placed):
            continue
        placed.append(p)
        kind = rnd.random()
        if kind < 0.45:
            g = BUBBLE
        elif kind < 0.75:
            g = PIT
        else:
            for k in range(rnd.choice((3, 4))):   # drip streak
                cv.put(p[0], p[1] + k, ramp(r, 2))
            continue
        for j, row in enumerate(g):
            for i2, ch in enumerate(row):
                if ch != ".":
                    cv.put(p[0] + i2 - 1, p[1] + j - 1, ramp(r, int(ch)))


def drips(cv: Canvas, m: set, r: str, xs: Sequence[int]) -> None:
    for x in xs:
        ys = [y for (xx, y) in m if xx == x]
        if ys:
            yb = max(ys)
            for y in (yb - 3, yb - 2, yb - 1):
                if (x, y) in m:
                    cv.put(x, y, ramp(r, 2))


def rivets(cv: Canvas, pts) -> None:
    for p in pts:
        cv.put(p[0], p[1], "lightning_3")


def sites_along(W, H, n, jitter_seed=5):
    """Notch sites spread along the long axis, alternating sides (envelope stays long)."""
    rnd = seeded(jitter_seed)
    out = []
    horiz = W >= H
    for i in range(n):
        f = ((i * 0.618 + 0.17) % 1.0) * 0.8 + 0.1
        side = i % 2
        if horiz:
            ox, oy = W * f, H / 2
            ang = (90 if side == 0 else 270) + rnd.uniform(-25, 25)
        else:
            ox, oy = W / 2, H * f
            ang = (180 if side == 0 else 0) + rnd.uniform(-25, 25)
        out.append((ang, ox, oy))
    return out


class Arch:
    """Holds the raw art + metadata; generic frames come from build_frames()."""

    def __init__(self, name, cols, rows, collision, theme=RES):
        self.name, self.cols, self.rows = name, cols, rows
        self.W, self.H = canvas_size(cols, rows)
        self.collision = collision      # dict for JSON
        self.theme = theme
        self.raw = Canvas(self.W, self.H)
        self.prot: set = set()
        self.inside: Optional[set] = None
        self.body_ramps = [theme.body]
        self.center = (self.W / 2 - 0.5, self.H / 2)
        self.core_c = (self.W // 2, self.H // 2)
        self.sites = None
        self.states: List[Tuple[str, Callable[["Arch"], Canvas]]] = []
        self.pulse_extra: Dict[Tuple[int, int], str] = {}
        self.frozen_fn: Optional[Callable[["Arch"], Canvas]] = None
        self.poly_frames = ["idle_a", "idle_b", "hit_flash", "hp_75", "hp_50", "hp_25", "frozen"]
        self.notes: Dict[str, str] = {}


def build_frames(a: Arch):
    raw = a.raw
    core = a.theme.core
    idle_a = finish(raw)
    rb = raw.copy()

    def pulse(x, y, c):
        if (x, y) in a.prot and c in (ramp(core, 3), ramp(core, 4)):
            return ramp(core, 4) if c == ramp(core, 3) else ramp(core, 5)
        return c
    rb.recolor(pulse)
    for p, c in a.pulse_extra.items():
        rb.put(p[0], p[1], c)
    frames = [("idle_a", idle_a), ("idle_b", finish(rb)), ("hit_flash", hit_flash(idle_a))]
    big = min(a.W, a.H) >= 40
    n_sites = (3, 6, 9) if big else (3, 5, 8)
    sites = a.sites or (sites_along(a.W, a.H, 9) if max(a.W, a.H) > 1.6 * min(a.W, a.H) else None)
    for hp in (0.75, 0.5, 0.25):
        out, _ = shatter(raw, hp, a.prot, core, a.center, seed=sum(map(ord, a.name)), n_sites=n_sites,
                         depth_k=(0.30, 0.42, 0.55) if not big else (0.24, 0.34, 0.44),
                         holes=(0, 1, 2) if not big else (1, 2, 4), angles=sites)
        frames.append((f"hp_{int(hp * 100)}", finish(out)))
    if a.frozen_fn:
        frames.append(("frozen", a.frozen_fn(a)))
    else:
        frames.append(("frozen", finish(frozen_generic(raw, a.body_ramps + ["steel", "stone", "cryo"], core,
                                                       a.theme.eye, keep=a.prot, inside=a.inside))))
    b = finish(heat_rim(raw, a.body_ramps + ["steel", "stone", "cryo"]))
    xs = sorted({p[0] for p in raw.mask()})
    n = max(3, a.W // 16)
    spots = [(xs[int(len(xs) * (i + 0.5) / n)] - 2, i % 2 == 1) for i in range(n)]
    flames_fx(b, raw.mask(), spots, [(xs[0] + 1, 2), (xs[-1] - 1, 1), (a.W // 2, 0)])
    frames.append(("burning", b))
    d1, d2 = death_generic(idle_a, a.core_c, core, 6 if big else 4)
    frames += [("death_1", d1), ("death_2", d2)]
    for lab, fn in a.states:
        frames.append((lab, fn(a)))
    return frames


# ============================================================================ archetypes
def bastion() -> Arch:
    """3x1 AABB heavy wall: three riveted steel slabs with battlements; eyes peer through a visor
    slit; seams between slabs = where piercing / laser gets through."""
    a = Arch("bastion", 3, 1, {"shape": "aabb"})
    W, H = a.W, a.H
    cv = a.raw
    body = rrect(2, 4, W - 3, H - 3, 3) | ell(W, H, 12, 5, 7, 3.2) | ell(W, H, W - 13, 5, 7, 3.2) | ell(W, H, W / 2, 4.2, 9, 3.4)
    body |= {(x, H - 2) for x in range(3, W - 3) if x % 9 not in (0, 1)}
    goo(cv, body)
    drips(cv, body, "echo", [10, 30, 46, 66])
    slabs = [(3, 24), (26, 49), (51, 72)]
    for (x0, x1) in slabs:
        m = rect(x0, 7, x1, 19)
        for mx in range(x0, x1 + 1, 6):  # merlons
            m |= rect(mx, 5, min(x1, mx + 3), 6)
        plate(cv, m, "steel", base=3, body=body)
        rivets(cv, [(x0 + 2, 9), (x1 - 2, 9), (x0 + 2, 17), (x1 - 2, 17)])
        for y in range(9, 18):  # vertical plank seam on the side slabs
            if x0 != 26:
                cv.put((x0 + x1) // 2, y, "steel_2")
    # visor slit across the centre slab: eyes peer out
    for x in range(28, 48):
        for y in (9, 10, 11, 12):
            cv.put(x, y, "outline")
    a.prot = draw_face(cv, RES, 37.5, 9, 13, "L", None, "M")
    for x in range(28, 48):
        cv.put(x, 8, "steel_4")
    a.notes["mechanic"] = "heavyArmor: 2x HP, moves every 2 turns; seams between slabs read as weak points"
    a.center = (37.5, 13)
    a.core_c = (37, 15)
    return a


def deflector() -> Arch:
    a = Arch("deflector", 2, 1, None)
    W, H = a.W, a.H
    poly = mapP([(-.5, .30), (-.3, -.45), (.3, -.45), (.5, .30), (.3, .5), (-.3, .5)], W, H)
    a.collision = {"shape": "polygon", "vertices_canvas": [[round(x, 2), round(y, 2)] for x, y in poly]}
    pm = poly_px(poly, W, H)
    body = erode(pm)
    a.inside = pm
    cv = a.raw
    goo(cv, body)
    shell = {p for p in body if p[1] <= 4 or p[0] <= 10 - (p[1] - 4) * 0 and p[0] <= 11 or p[0] >= W - 12}
    shell = {p for p in shell if not (14 <= p[0] <= W - 15 and p[1] > 4)}
    a.shell = shell
    _deflector_shell(cv, shell, body, "full")
    drips(cv, body, "echo", [18, 31])
    a.prot = draw_face(cv, RES, 24.5, 6, 13, "L", 10, "M")
    a.body = body
    a.states = [("barrier_full", lambda A: _deflector_state(A, "full")),
                ("barrier_broken", lambda A: _deflector_state(A, "broken"))]
    a.notes["mechanic"] = "deflectionWard: barrier (10% HP) absorbs bounce/pierce damage; idle = barrier up"
    a.center = (24.5, 13)
    a.core_c = (24, 15)
    return a


def _deflector_shell(cv, shell, body, state):
    if state == "full":
        plate(cv, shell, "cryo", base=3, body=body)
        # glowing barrier rim on the outer edge + facet seams
        for (x, y) in shell:
            if any((x + dx, y + dy) not in body for dx, dy in ((1, 0), (-1, 0), (0, -1))):
                cv.put(x, y, "cryo_5" if (x + y) % 3 else "white")
        for y in range(5, 22, 5):
            for (x, yy) in shell:
                if yy == y and (x, y - 1) in shell:
                    cv.put(x, y, "cryo_2")
    else:
        # barrier broken: shell glass goes dark, shot through with bright fracture lines,
        # a few shards missing (goo shows through)
        plate(cv, shell, "cryo", base=2, body=body)
        rnd = seeded(9)
        xs = sorted({p[0] for p in shell})
        for k in range(7):
            x = rnd.choice(xs)
            ys = sorted(y for (xx, y) in shell if xx == x)
            if not ys:
                continue
            y = ys[0]
            for step in range(9):
                if (x, y) in shell:
                    cv.put(x, y, "outline")
                    if (x - 1, y) in shell:
                        cv.put(x - 1, y, "cryo_4")
                x += rnd.choice((-1, 0, 1))
                y += 1
        for (x, y) in sorted(shell):
            if rnd.random() < 0.06:
                for q in ((x, y), (x + 1, y), (x, y + 1)):
                    if q in shell:
                        cv.put(q[0], q[1], "echo_2")


def _deflector_state(a, st):
    cv = a.raw.copy()
    _deflector_shell(cv, a.shell, a.body, st)
    for p in a.prot:
        cv.put(p[0], p[1], a.raw.get(*p))
    out = finish(cv)
    if st == "full":
        for x in range(2, a.W - 2, 3):   # barrier sheen just above the shell (feedback)
            if out.get(x, 0) is None and out.get(x, 1) is not None:
                out.put(x, 0, "cryo_5")
    return out


def echo_spire() -> Arch:
    a = Arch("echoSpire", 1, 2, None)
    W, H = a.W, a.H
    poly = mapP([(0, -.5), (.3, -.3), (.4, .45), (-.4, .45), (-.3, -.3)], W, H)
    a.collision = {"shape": "polygon", "vertices_canvas": [[round(x, 2), round(y, 2)] for x, y in poly]}
    pm = poly_px(poly, W, H)
    body = erode(pm)
    a.inside = pm
    cv = a.raw
    goo(cv, body)
    # resonance tiers: bright bands that ring the spire
    for y in (12, 18, 38):
        for (x, yy) in body:
            if yy == y:
                cv.put(x, y, "echo_5" if x < W / 2 else "echo_4")
            if yy == y + 1:
                cv.put(x, y + 1, "echo_2")
    # crystal antenna tip
    tip = {(11, 2): "white", (12, 2): "echo_5", (11, 3): "echo_5", (12, 3): "echo_4", (10, 4): "echo_5",
           (11, 4): "echo_4", (12, 4): "echo_4", (13, 4): "echo_3", (10, 5): "echo_4", (11, 5): "echo_3",
           (12, 5): "echo_3", (13, 5): "echo_2"}
    for p, c in tip.items():
        if p in body:
            cv.put(p[0], p[1], c)
    drips(cv, body, "echo", [6, 17])
    a.prot = draw_face(cv, RES, 11.5, 21, 29, "M", 26, "M") | {p for p in tip if p in body}
    a.pulse_extra = {(11, 2): "echo_5", (12, 3): "echo_5"}
    a.states = [("link", _spire_link)]
    a.notes["mechanic"] = "echoRelay: forwards neighbour affixes; 'link' = resonance arcs reaching both neighbours"
    a.center = (11.5, 28)
    a.core_c = (11, 31)
    return a


def _spire_link(a):
    out = finish(a.raw)
    for p, c in {(11, 2): "white", (12, 2): "white", (11, 3): "white"}.items():
        out.put(p[0], p[1], c)
    # sound-wave arcs ")" on both sides at three heights, reaching the canvas edge (to neighbours)
    for cy in (12, 24, 36):
        for k, col in ((0, "echo_5"), (2, "echo_4")):
            for dy in range(-3, 4):
                dx = int(round(1.2 * (1 - (dy / 3.5) ** 2) * 2)) - k
                for xl in (2 - dx, ):
                    if 0 <= xl < a.W and out.get(xl, cy + dy) is None:
                        out.put(xl, cy + dy, col)
                xr = a.W - 3 + dx
                if 0 <= xr < a.W and out.get(xr, cy + dy) is None:
                    out.put(xr, cy + dy, col)
    return out


def maw() -> Arch:
    a = Arch("maw", 2, 2, None)
    W, H = a.W, a.H
    poly = mapP([(-.45, -.45), (.45, -.45), (.5, .10), (.2, .5), (-.2, .5), (-.5, .10)], W, H)
    a.collision = {"shape": "polygon", "vertices_canvas": [[round(x, 2), round(y, 2)] for x, y in poly]}
    pm = poly_px(poly, W, H)
    body = erode(pm)
    a.inside = pm
    cv = a.raw
    goo(cv, body, deep=4)
    a.body = body
    _maw_mouth(cv, body, 0)
    # small mean eyes high up + tiny shards on the crown
    eyes = stamp(cv, EYES["L"], 24.5, 8, RES.cmap())
    prot = {p for p, c in eyes.items() if c in RES.eye or c == "outline"}
    for p, c in {(33, 3): "echo_5", (34, 3): "echo_4", (34, 4): "echo_3", (14, 4): "echo_5", (15, 4): "echo_4"}.items():
        cv.put(p[0], p[1], c)
    a.prot = prot | {p for p in body if cv.get(*p) in ("laser_5", "white") or (p in cv.core_px)}
    a.states = [("feeding", _maw_feeding)]
    a.notes["mechanic"] = "devour: swallows adjacent allies (inherits HP + affixes); 'feeding' = jaw wide, prey sucked in"
    a.center = (24.5, 30)
    a.core_c = (24, 32)
    return a


def _maw_mouth(cv, body, wide):
    W, H = cv.w, cv.h
    mouth = ell(W, H, 24.5, 30.5, 17.5 + wide, 9.5 + 2 * wide) & body
    lips = (dilate(mouth, 2, ((1, 0), (-1, 0), (0, 1), (0, -1))) - mouth) & body
    for p in lips:
        cv.put(p[0], p[1], "laser_2")
    for p in offset_bands(lips | mouth, 1, -1, -1) & lips:
        cv.put(p[0], p[1], "laser_3")
    for p in mouth:
        cv.put(p[0], p[1], "outline")
    ys = [p[1] for p in mouth]
    top, bot = min(ys), max(ys)
    # fangs: 3px triangles from the top jaw, 2px from the bottom
    for x in range(10, 40, 4):
        for k in range(3):
            for dx in range(-(2 - k) // 2, (2 - k) // 2 + 1):
                p = (x + dx, top + k)
                if p in mouth:
                    cv.put(p[0], p[1], "stone_5" if dx <= 0 else "stone_4")
    for x in range(12, 38, 4):
        for k in range(2):
            p = (x, bot - k)
            if p in mouth:
                cv.put(p[0], p[1], "stone_5" if k == 0 else "stone_4")
    # throat glow: the reactor core sits deep in the throat
    core = {}
    cy = 30 + wide
    for p, c in {(24, cy): "white", (25, cy): "laser_5", (24, cy + 1): "laser_5", (25, cy + 1): "laser_4",
                 (23, cy): "laser_4", (26, cy): "laser_3", (24, cy - 1): "laser_4", (25, cy - 1): "laser_3",
                 (23, cy + 1): "laser_3", (26, cy + 1): "laser_2", (24, cy + 2): "laser_3", (25, cy + 2): "laser_2"}.items():
        cv.put(p[0], p[1], c)
        core[p] = c
    for x in range(17, 33):   # tongue
        if (x, bot - 2) in mouth and cv.get(x, bot - 2) == "outline":
            cv.put(x, bot - 2, "laser_2" if x % 3 else "laser_3")
    cv.core_px = set(core)  # type: ignore[attr-defined]


def _maw_feeding(a):
    cv = a.raw.copy()
    goo(cv, a.body, deep=4)
    _maw_mouth(cv, a.body, 1)
    for p in a.prot:
        if p[1] < 20:
            cv.put(p[0], p[1], a.raw.get(*p))
    # prey: a small residue blob being sucked in (upper-left of the mouth), its eyes still lit
    prey = ell(cv.w, cv.h, 13.0, 27.0, 3.2, 2.6)
    for p in prey:
        cv.put(p[0], p[1], "echo_4")
    for p in offset_bands(prey, 1, 1, 1):
        cv.put(p[0], p[1], "echo_2")
    for p in ((12, 26), (14, 26)):
        cv.put(p[0], p[1], "pyro_5")
    cv.put(13, 28, "laser_4")
    out = finish(cv)
    # suction streaks (feedback) converging on the throat
    for (x0, y0) in ((6, 22), (6, 36), (42, 22), (43, 36)):
        for k in range(3):
            x = x0 + (1 if x0 < 24 else -1) * k * 2
            y = y0 + (1 if y0 < 30 else -1) * k
            if out.get(x, y) in ("outline",):
                out.put(x, y, "laser_4")
    return out


def prism() -> Arch:
    a = Arch("prism", 1, 3, None, Theme("cryo", "laser"))
    W, H = a.W, a.H
    poly = mapP([(0, -.5), (.45, 0), (0, .5), (-.45, 0)], W, H)
    a.collision = {"shape": "polygon", "vertices_canvas": [[round(x, 2), round(y, 2)] for x, y in poly]}
    pm = poly_px(poly, W, H)
    body = erode(pm)
    a.inside = pm
    cv = a.raw
    # crystal: left facet lit, right facet shaded, centre ridge bright (top-left light)
    for (x, y) in body:
        cv.put(x, y, "cryo_4" if x < 11 else ("cryo_5" if x == 11 else "cryo_3"))
    for p in offset_bands(body, 1, 1, 1):
        cv.put(p[0], p[1], "cryo_2")
    for p in offset_bands(body, 1, -1, -1):
        cv.put(p[0], p[1], "cryo_5")
    for y in range(4, 72, 9):   # facet bands
        for (x, yy) in body:
            if yy == y and x != 11:
                cv.put(x, y, "cryo_2" if x > 11 else "cryo_3")
    # residue goo belt where the face lives (family link)
    belt = {p for p in body if 27 <= p[1] <= 48}
    goo(cv, belt)
    for (x, y) in belt:
        if (x, y - 1) not in belt and (x, y - 1) in body:
            cv.put(x, y - 1, "outline")
    # refracted beam running through the crystal (laser) above and below the belt
    for y in list(range(5, 26)) + list(range(50, 72)):
        if (11, y) in body:
            cv.put(11, y, "laser_4" if y % 4 else "laser_5")
        if (12, y) in body and y % 3 == 0:
            cv.put(12, y, "laser_3")
    a.prot = draw_face(cv, RES, 11.5, 30, 37, "M", 35, "M")
    a.pulse_extra = {(11, y): "white" for y in range(8, 24, 5)}
    a.notes["mechanic"] = "prism: refracts lasers (50%); the beam inside shows the refraction path"
    a.center = (11.5, 38)
    a.core_c = (11, 39)
    a.body_ramps = ["cryo", "echo"]
    return a


def hive() -> Arch:
    a = Arch("hive", 2, 3, {"shape": "aabb"}, Theme("echo", "laser"))
    W, H = a.W, a.H
    cv = a.raw
    body = rrect(2, 2, W - 3, H - 3, 12)
    goo(cv, body, r="echo", deep=4)
    a.body = body
    cells = _hive_cells()
    a.cells = cells
    for (cx, cy) in cells:
        _hive_cell(cv, cx, cy, 0)
    drips(cv, body, "echo", [9, 20, 31, 41])
    a.prot = draw_face(cv, RES, 24.5, 8, 15, "L", None, "M")
    _hive_pips(cv, 0)
    a.states = [("about_to_hatch", _hive_hatch)]
    a.notes["mechanic"] = "hive: hatches a minion every 2 turns; pips = countdown, 'about_to_hatch' = bottom egg cracking"
    a.center = (24.5, 40)
    a.core_c = (24, 18)
    return a


def _hive_cells():
    out = []
    for r, y in enumerate((30, 42, 54)):
        for x in ((14, 24, 34) if r % 2 == 0 else (19, 29)):
            out.append((x, y))
    out.append((24, 64))
    return out


def _hive_cell(cv, cx, cy, state):
    # hex-ish comb cell: dark rim, egg inside (echo goo with a sleeping eye slit)
    hexm = {(x, y) for x in range(cx - 4, cx + 5) for y in range(cy - 4, cy + 5) if abs(x - cx) + abs(y - cy) * 0.6 <= 5.2}
    for p in hexm:
        cv.put(p[0], p[1], "echo_1")
    egg = ell(cv.w, cv.h, cx + 0.5, cy + 0.5, 3.2 + 0.6 * state, 3.0 + 0.6 * state)
    for p in egg:
        cv.put(p[0], p[1], "venom_3" if not state else "venom_4")
    for p in offset_bands(egg, 1, -1, -1):
        cv.put(p[0], p[1], "venom_4" if not state else "venom_5")
    for p in offset_bands(egg, 1, 1, 1):
        cv.put(p[0], p[1], "venom_2" if not state else "venom_3")
    if state:
        for p in ((cx - 1, cy), (cx + 1, cy)):
            cv.put(p[0], p[1], "pyro_5")
        for p in ((cx - 2, cy - 2), (cx - 1, cy - 1), (cx + 2, cy - 3), (cx + 1, cy - 2), (cx, cy + 2)):
            cv.put(p[0], p[1], "outline")
        cv.put(cx, cy - 1, "white")
    else:
        cv.put(cx, cy, "venom_1")
        cv.put(cx + 1, cy, "venom_1")


def _hive_pips(cv, lit):
    for i, x in enumerate((19, 30)):
        on = i < lit
        for p, c in {(x, 71): "lightning_5" if on else "lightning_1", (x + 1, 71): "lightning_4" if on else "lightning_1",
                     (x, 72): "lightning_4" if on else "lightning_1", (x + 1, 72): "lightning_3" if on else "outline"}.items():
            cv.put(p[0], p[1], c)


def _hive_hatch(a):
    cv = a.raw.copy()
    _hive_cell(cv, 24, 64, 1)
    _hive_pips(cv, 2)
    out = finish(cv)
    for p in ((22, 59), (27, 59), (24, 58)):
        if out.get(*p) not in (None,):
            out.put(p[0], p[1], "venom_5")
    return out


def siege() -> Arch:
    a = Arch("siege", 3, 2, None, Theme("echo", "laser"))
    W, H = a.W, a.H
    poly = mapP([(-.5, -.2), (-.3, -.5), (.3, -.5), (.5, -.2), (.5, .2), (.3, .5), (-.3, .5), (-.5, .2)], W, H)
    a.collision = {"shape": "polygon", "vertices_canvas": [[round(x, 2), round(y, 2)] for x, y in poly]}
    pm = poly_px(poly, W, H)
    body = erode(pm)
    a.inside = pm
    cv = a.raw
    goo(cv, body, deep=4)
    # tracks along both flanks (it grinds forward)
    for x0, x1 in ((1, 12), (W - 13, W - 2)):
        tr = {p for p in body if x0 <= p[0] <= x1 and 8 <= p[1] <= H - 6}
        plate(cv, tr, "steel", base=2, body=body)
        for (x, y) in tr:
            if y % 4 == 0 and x0 + 1 <= x <= x1 - 1:
                cv.put(x, y, "steel_1")
        for wy in range(12, H - 8, 8):
            for p, c in {((x0 + x1) // 2, wy): "steel_4", ((x0 + x1) // 2 + 1, wy): "steel_3",
                         ((x0 + x1) // 2, wy + 1): "steel_3", ((x0 + x1) // 2 + 1, wy + 1): "steel_2"}.items():
                cv.put(p[0], p[1], c)
    # yellow ram plate across the front (bottom = toward the defence line) with hazard chevrons
    ram = {p for p in body if 15 <= p[0] <= W - 16 and p[1] >= H - 13}
    plate(cv, ram, "lightning", base=3, body=body, seam=False)
    for (x, y) in ram:
        if (x, y - 1) not in ram:
            cv.put(x, y, "outline")
        elif (x - y) % 6 in (0, 1) and y < H - 4:
            cv.put(x, y, "outline")
    # armoured brow plate
    brow = {p for p in body if 18 <= p[0] <= W - 19 and 2 <= p[1] <= 7}
    plate(cv, brow, "lightning", base=3, body=body)
    rivets(cv, [(20, 5), (W - 21, 5)])
    a.prot = draw_face(cv, RES, 37.5, 11, 20, "L", 16, "M")
    a.frozen_fn = _siege_frozen
    a.poly_frames = ["idle_a", "idle_b", "hit_flash", "hp_75", "hp_50", "hp_25"]  # frozen = ice shards flying off (feedback)
    a.notes["mechanic"] = "siege: immune to freeze (frozen frame = ice shatters off, body stays live); pushes the blocking chain 1 row"
    a.center = (37.5, 22)
    a.core_c = (37, 23)
    return a


def _siege_frozen(a):
    out = finish(a.raw)
    # frost tries to grab the hull and shatters: ice chips on the rim + flying shards (no recolour = immune)
    rnd = seeded(77)
    rim = [p for p in a.raw.mask() if any(a.raw.get(p[0] + dx, p[1] + dy) is None for dx, dy in ((1, 0), (-1, 0), (0, -1)))]
    rim.sort()
    for p in rim:
        if rnd.random() < 0.18:
            out.put(p[0], p[1], "cryo_4")
    for p in ((5, 3), (8, 1), (70, 2), (67, 5), (2, 20), (73, 22), (38, 0)):
        if out.get(*p) is None:
            out.put(p[0], p[1], "cryo_5")
            if out.get(p[0] + 1, p[1]) is None:
                out.put(p[0] + 1, p[1], "cryo_3")
    return out


def carrier() -> Arch:
    a = Arch("carrier", 3, 2, None, Theme("echo", "laser"))
    W, H = a.W, a.H
    poly = mapP([(-.5, -.5), (.5, -.5), (.5, .5), (.18, .5), (.18, .08), (-.18, .08), (-.18, .5), (-.5, .5)], W, H)
    a.collision = {"shape": "polygon", "vertices_canvas": [[round(x, 2), round(y, 2)] for x, y in poly],
                   "footprintMask": [[1, 1, 1], [1, 0, 1]]}
    pm = poly_px(poly, W, H)
    body = erode(pm)
    a.inside = pm
    cv = a.raw
    goo(cv, body, deep=4)
    a.body = body
    # hull plating on the deck + both pylons (cyan-steel ship)
    deck = {p for p in body if p[1] <= 8}
    plate(cv, deck, "steel", base=3, body=body)
    for x0, x1 in ((1, 22), (W - 23, W - 2)):
        py = {p for p in body if x0 <= p[0] <= x1 and 30 <= p[1] <= H - 4}
        plate(cv, py, "cryo", base=3, body=body)
        for y in range(34, H - 4, 5):
            for x in range(x0 + 2, x1 - 1):
                if (x, y) in py:
                    cv.put(x, y, "cryo_2")
    rivets(cv, [(4, 4), (W - 5, 4), (24, 4), (W - 25, 4)])
    # bay hatch: ceiling of the empty bottom-middle bay
    a.hatch = [(x, y) for x in range(27, 49) for y in (26, 27) if (x, y) in body]
    _carrier_hatch(cv, False)
    a.prot = draw_face(cv, RES, 37.5, 9, 15, "L", None, "M")
    a.states = [("dropping", _carrier_drop)]
    a.notes["mechanic"] = "carrier: drops a haste + jump minion into the empty bottom-middle bay each turn"
    a.center = (37.5, 14)
    a.core_c = (37, 18)
    a.sites = [(90, 12, 20), (270, 12, 30), (90, 63, 20), (270, 63, 30), (180, 10, 40), (0, 65, 40),
               (90, 37, 10), (270, 37, 22), (0, 22, 42)]
    return a


def _carrier_hatch(cv, open_):
    for (x, y) in [(x, y) for x in range(27, 49) for y in (26, 27)]:
        if cv.get(x, y) is None:
            continue
        if open_:
            cv.put(x, y, "outline" if y == 26 else "laser_3")
        else:
            cv.put(x, y, "steel_4" if y == 26 else "steel_2")
    for x in (28, 37, 38, 47):
        if cv.get(x, 25) is not None:
            cv.put(x, 25, "laser_5" if open_ else "lightning_4")


def _carrier_drop(a):
    cv = a.raw.copy()
    _carrier_hatch(cv, True)
    # the dropped minion: tiny residue with a haste fin and spring legs, mid-drop in the bay
    m = ell(cv.w, cv.h, 37.5, 37.5, 5.0, 4.4)
    for p in m:
        cv.put(p[0], p[1], "echo_3")
    for p in offset_bands(m, 1, 1, 1):
        cv.put(p[0], p[1], "echo_2")
    for p in offset_bands(m, 1, -1, -1):
        cv.put(p[0], p[1], "echo_4")
    for p, c in {(35, 36): "pyro_5", (36, 36): "pyro_4", (39, 36): "pyro_4", (40, 36): "pyro_5",
                 (37, 39): "laser_4", (38, 39): "laser_3", (34, 43): "steel_4", (35, 43): "steel_2",
                 (40, 43): "steel_4", (41, 43): "steel_2", (34, 44): "steel_5", (41, 44): "steel_5"}.items():
        cv.put(p[0], p[1], c)
    out = finish(cv)
    for x in (34, 37, 41):   # drop streaks from the hatch
        for y in (29, 30):
            if out.get(x, y) is None:
                out.put(x, y, "laser_4" if y == 30 else "laser_5")
    return out


def gravity_core() -> Arch:
    a = Arch("gravityCore", 3, 3, None, Theme("echo", "laser"))
    W, H = a.W, a.H
    r = 0.45 * min(W, H)
    a.collision = {"shape": "arc", "radius": round(r, 2), "center_canvas": [W / 2, H / 2]}
    pm = {(x, y) for x in range(W) for y in range(H) if math.hypot(x + 0.5 - W / 2, y + 0.5 - H / 2) <= r}
    body = erode(pm)
    a.inside = pm
    cv = a.raw
    goo(cv, body, deep=5)
    cx, cy = W / 2, H / 2
    # accretion bands: spiral arms swirling into the well (dark troughs + bright crests)
    for (x, y) in body:
        dx, dy = x + 0.5 - cx, y + 0.5 - cy
        d = math.hypot(dx, dy)
        ang = math.atan2(dy, dx)
        s = (ang * 3 + d * 0.32) % (2 * math.pi)
        if 12 < d < r - 3:
            if s < 0.45:
                cv.put(x, y, "echo_1")
            elif s < 0.8:
                cv.put(x, y, "echo_5" if dx < 0 and dy < 0 else "echo_4")
    # the well: concentric dark rings around the core
    for (x, y) in body:
        d = math.hypot(x + 0.5 - cx, y + 0.5 - (cy + 4))
        if 9.5 <= d < 10.6:
            cv.put(x, y, "outline")
        elif 7.5 <= d < 9.5:
            cv.put(x, y, "echo_1")
    a.prot = draw_face(cv, RES, 37.5, 22, 35, "L", None, "L")
    # orbiting debris (stone chunks) on the rim
    for ang in (30, 140, 220, 320):
        t = math.radians(ang)
        px, py = int(cx + math.cos(t) * (r - 4)), int(cy + math.sin(t) * (r - 4))
        for p, c in {(px, py): "stone_4", (px + 1, py): "stone_3", (px, py + 1): "stone_3", (px + 1, py + 1): "stone_2"}.items():
            cv.put(p[0], p[1], c)
    a.notes["mechanic"] = "gravityWell: pulls bullets within 220px; 'pull_aura' shows the pull direction at sprite scale, runtime draws the full radius"
    a.states = [("pull_aura", _gravity_aura)]
    a.center = (37.5, 38)
    a.core_c = (37, 38)
    a.sites = None
    return a


def _gravity_aura(a):
    out = finish(a.raw)
    W, H = a.W, a.H
    cx, cy = W / 2, H / 2
    # inward chevrons on a ring just outside the body + dotted spiral streaks in the corners
    for i in range(12):
        t = math.radians(i * 30 + 15)
        for k, col in ((0, "echo_5"), (1, "echo_4"), (2, "echo_3")):
            rr = 36.5 + k * 0.0
            px = cx + math.cos(t) * (rr + k)
            py = cy + math.sin(t) * (rr + k)
            for side in (-1, 1):
                q = (int(px + math.cos(t + side * 1.2) * k), int(py + math.sin(t + side * 1.2) * k))
                if 0 <= q[0] < W and 0 <= q[1] < H and out.get(*q) is None:
                    out.put(q[0], q[1], col)
    for i in range(4):
        base = math.radians(45 + i * 90)
        for k in range(10):
            d = 52 - k * 1.4
            t = base + k * 0.09
            q = (int(cx + math.cos(t) * d), int(cy + math.sin(t) * d))
            if 0 <= q[0] < W and 0 <= q[1] < H and out.get(*q) is None and k % 2 == 0:
                out.put(q[0], q[1], "echo_4" if k < 6 else "echo_5")
    return out


ARCHES = [bastion, deflector, echo_spire, maw, prism, hive, siege, carrier, gravity_core]


def main():
    for fn in ARCHES:
        a = fn()
        frames = build_frames(a)
        per_row = 6 if a.W * a.H > 2000 else 0
        export(f"elite_{a.name}_{a.cols}x{a.rows}", frames, {
            "kind": "enemy", "grid": [a.cols, a.rows], "archetype": a.name, "collision": a.collision,
            "collision_box_px": [a.W, a.H], "collision_mapping": "w,h = canvas (cols*26-2, rows*26-2), origin at canvas centre",
            "polygon_check_frames": a.poly_frames if a.collision.get("shape") != "aabb" else [],
            "mechanic_states": [lab for lab, _ in a.states],
            "notes": a.notes, "source": "src/spawn_system.js spawn_applyArchetypeShape",
        }, scale=6, per_row=per_row)


if __name__ == "__main__":
    main()
    print("ok")
