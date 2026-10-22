"""1x1 residue family: the base residue (re-exported with the shatter damage language)
and the boss-minion silhouette variants.

Minion silhouettes are the collision polygons of src/spawn_system.js
spawn_applyMinionShape (~2847-2977), mapped to the 24x24 canvas (w = h = 24,
origin at the canvas centre). The body is the polygon raster eroded by 1px so the
1px outline lands exactly on the polygon rim -> silhouette == collision shape.
Each variant keeps the family: goo body lit top-left, angry slit eyes, diamond
reactor core in a dark socket; the boss theme only changes material ramp + a
small crest accent.
"""
from __future__ import annotations

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import enemy_residue as ER  # noqa: E402  (approved sample; imported, never modified)
from common import (Canvas, Theme, death_generic, dilate, draw_face, erode, export, finish, flames_fx,  # noqa: E402
                    frozen_generic, heat_rim, hit_flash, poly_px, ramp, shade_body, shatter)

W = H = 24
RESIDUE_CENTER = (11.5, 13.0)
# notch sites for the base residue: upper-left crown, right flank, lower-left, top-right, ...
RESIDUE_ANGLES = [128, 8, 215, 62, 330, 168, 285, 100]


# ----------------------------------------------------------------------------- base residue
def residue_protected() -> set:
    return dilate(ER.protected_set(), 1)


def residue_damage(raw: Canvas, hp: float, extra_protect: set = frozenset(), seed: int = 7) -> Canvas:
    out, _ = shatter(raw, hp, ER.protected_set() | set(extra_protect), "laser", RESIDUE_CENTER, seed=seed,
                     angles=RESIDUE_ANGLES)
    return out


def residue_idle_b(raw: Canvas) -> Canvas:
    """Same as the approved sample: 1px squash into the puddle + core pulse."""
    raw_b = raw.copy()
    pulse = {"laser_3": "laser_4", "laser_4": "laser_5"}
    raw_b.recolor(lambda x, y, c: pulse.get(c, c) if 12 <= y <= 17 and 8 <= x <= 15 else c)
    lifted = Canvas(W, H)
    for x, y, c in raw_b.pixels():
        if y >= 19:
            lifted.put(x, y, c)
    for x, y, c in raw_b.pixels():
        if y < 19:
            lifted.put(x, y + 1, c)
    return lifted


def residue_frames():
    raw = ER.draw_body(include_shards=True)
    idle_a = finish(raw)
    frames = [("idle_a", idle_a), ("idle_b", finish(residue_idle_b(raw))), ("hit_flash", hit_flash(idle_a))]
    for hp in (0.75, 0.5, 0.25):
        frames.append((f"hp_{int(hp * 100)}", finish(residue_damage(raw, hp))))
    frames.append(("frozen", finish(ER.frozen(raw))))
    b = finish(ER.burning(raw))
    ER.burning_fx(b, raw.mask(), 0)
    frames.append(("burning", b))
    d1, d2 = ER.death_frames(idle_a)
    frames += [("death_1", d1), ("death_2", d2)]
    return frames


# ----------------------------------------------------------------------------- minions
def P(vs):
    """Normalised (-0.5..0.5) collision vertices -> 24x24 canvas coordinates."""
    return [(W / 2 + vx * W, H / 2 + vy * H) for vx, vy in vs]


MINIONS = {
    # boss: (vertices, theme, face layout, accent)
    "ignis": dict(poly=P([(0, -.5), (.5, .5), (-.5, .5)]),
                  theme=Theme("pyro", "lightning", ("lightning_5", "pyro_5")),
                  face=dict(axis=11.5, eye_y=12, core_y=16, size="M", mouth=None),
                  center=(11.5, 15.5), seed=11),
    "glacies": dict(poly=P([(0, -.5), (.5, 0), (0, .5), (-.5, 0)]),
                    theme=Theme("cryo", "laser"),
                    face=dict(axis=11.5, eye_y=7, core_y=12, size="M", mouth=None),
                    center=(11.5, 12.0), seed=12),
    "mikro": dict(poly=P([(0, -.5), (.5, -.25), (.5, .25), (0, .5), (-.5, .25), (-.5, -.25)]),
                  theme=Theme("laser", "venom"),
                  face=dict(axis=11.5, eye_y=7, core_y=13, size="L", mouth=11, core_size="M"),
                  center=(11.5, 12.5), seed=13),
    "devourer": dict(poly=P([(-.5, -.5), (.2, -.5), (.5, -.2), (.5, .5), (-.5, .5)]),
                     theme=Theme("stone", "laser"),
                     face=dict(axis=11.5, eye_y=6, core_y=15, size="L", mouth=10),
                     center=(11.5, 12.5), seed=14),
    "viridis": dict(poly=P([(0, -.5), (.4, -.1), (.5, .2), (.3, .5), (-.3, .5), (-.5, .2), (-.4, -.1)]),
                    theme=Theme("venom", "laser"),
                    face=dict(axis=11.5, eye_y=9, core_y=15, size="L", mouth=None, core_size="M"),
                    center=(11.5, 14.0), seed=15),
    "tesla": dict(poly=P([(.2, -.5), (.5, -.5), (-.2, .5), (-.5, .5)]),
                  theme=Theme("steel", "lightning"),
                  face=None, center=(11.5, 12.0), seed=16, angles=[(147, 17, 4), (327, 7, 18), (327, 16, 5), (147, 7, 18), (147, 19, 2), (327, 5, 20)]),
    "chimera": dict(poly=P([(-.5, -.5), (.3, -.5), (.5, 0), (.2, .5), (-.5, .5)]),
                    theme=Theme("cryo", "laser", body2="pyro"),
                    face=dict(axis=10.5, eye_y=6, core_y=13, size="L", mouth=10, core_size="M"),
                    center=(10.5, 12.0), seed=17),
    "ouroboros": dict(poly=P([(-.2, -.5), (.2, -.5), (.5, -.2), (.5, .2), (.2, .5), (-.2, .5), (-.5, .2), (-.5, -.2)]),
                      theme=Theme("steel", "echo"),
                      face=dict(axis=11.5, eye_y=7, core_y=13, size="L", mouth=11, core_size="M"),
                      center=(11.5, 12.0), seed=18),
}


def _accent(name: str, cv: Canvas, body: set) -> set:
    """Small boss-theme crest accent inside the body (protected like the face)."""
    pts = {}
    if name == "ignis":     # ember crest at the apex
        pts = {(11, 3): "pyro_5", (12, 3): "lightning_5", (11, 4): "pyro_4", (12, 4): "pyro_5",
               (11, 5): "pyro_4", (12, 5): "pyro_4", (10, 6): "pyro_4", (13, 6): "pyro_4"}
    elif name == "glacies":  # ice shards on the crown (light from top-left)
        pts = {(11, 2): "cryo_5", (11, 3): "white", (12, 3): "cryo_4", (11, 4): "cryo_5", (12, 4): "cryo_4",
               (9, 4): "cryo_5", (14, 4): "cryo_4"}
    elif name == "mikro":    # membrane nuclei: two small venom vesicles
        pts = {(5, 9): "venom_4", (6, 9): "venom_5", (5, 10): "venom_3", (18, 15): "venom_4", (17, 15): "venom_5",
               (18, 16): "venom_3"}
    elif name == "devourer":  # broken tooth row along the cut corner
        pts = {(16, 2): "stone_5", (17, 3): "stone_5", (18, 4): "stone_5", (19, 5): "stone_5", (20, 6): "stone_5",
               (17, 2): "outline", (18, 3): "outline", (19, 4): "outline", (20, 5): "outline"}
    elif name == "viridis":  # leaf sprout at the drop tip
        pts = {(11, 2): "venom_5", (12, 3): "venom_5", (11, 3): "venom_4", (10, 4): "venom_4", (12, 4): "venom_2",
               (11, 4): "venom_4"}
    elif name == "chimera":  # ice shard (cold left) + ember (hot right)
        pts = {(3, 3): "cryo_5", (4, 3): "cryo_4", (3, 4): "cryo_4", (16, 3): "pyro_5", (17, 3): "pyro_4",
               (17, 4): "pyro_4"}
    elif name == "ouroboros":  # orbit ring band across the brow
        pts = {(x, 4): ("echo_4" if x % 3 else "echo_5") for x in range(6, 18)}
    keep = set()
    for p, c in pts.items():
        if p in body:
            cv.put(p[0], p[1], c)
            keep.add(p)
    return keep


def build_minion_raw(name: str):
    d = MINIONS[name]
    th: Theme = d["theme"]
    pm = poly_px(d["poly"], W, H)
    body = erode(pm)
    cv = Canvas(W, H)
    tl = sorted(body, key=lambda p: (p[0] + p[1], p[1]))
    spec = [p for p in tl[3:12] if (p[0] + 1, p[1] + 1) in body][:3]
    shade_body(cv, body, th.body, base=3, deep=1 if name == "tesla" else 3, spec=spec)
    if th.body2:  # chimera: right (hot) half re-ramped
        mid = d["face"]["axis"] if d["face"] else 11.5
        for (x, y) in body:
            c = cv.get(x, y)
            if c and x > mid + (y - 12) * -0.25:
                cv.put(x, y, f"{th.body2}_{c.rsplit('_', 1)[1]}")
        th = Theme(th.body, th.core, th.eye)
    # goo drips: two short darker streaks near the bottom (family detail)
    ys = [p[1] for p in body]
    yb = max(ys)
    for x in (sorted({p[0] for p in body if p[1] == yb - 2})[1:2] + sorted({p[0] for p in body if p[1] == yb - 2})[-2:-1]):
        for y in (yb - 2, yb - 1):
            if (x, y) in body:
                cv.put(x, y, ramp(th.body, 2))
    keep = _accent(name, cv, body)
    if d["face"]:
        f = d["face"]
        prot = draw_face(cv, th, f["axis"], f["eye_y"], f["core_y"], f["size"], f.get("mouth"), f.get("core_size"))
    else:  # tesla blade: a compact diagonal face that follows the blade (eyes stacked on the slant)
        cm = th.cmap()
        b1 = "steel_1"
        face = {(14, 5): b1, (17, 5): b1,
                (13, 6): cm["e"], (14, 6): cm["E"], (15, 6): "outline", (16, 6): cm["E"], (17, 6): cm["e"],
                (13, 7): b1, (16, 7): b1,
                (14, 9): "outline", (13, 10): "outline",
                (10, 12): b1, (11, 12): b1,
                (9, 13): b1, (10, 13): "lightning_4", (11, 13): "lightning_5", (12, 13): b1,
                (8, 14): b1, (9, 14): "lightning_4", (10, 14): "white", (11, 14): "lightning_4", (12, 14): b1,
                (8, 15): b1, (9, 15): "lightning_3", (10, 15): "lightning_4", (11, 15): b1,
                (8, 16): b1, (9, 16): b1,
                (20, 1): "white", (21, 1): "lightning_5", (19, 2): "lightning_5", (18, 3): "lightning_4", (17, 4): "lightning_4",
                (5, 20): "lightning_4", (6, 19): "lightning_4", (7, 18): "lightning_3"}
        for p, c in face.items():
            if p in body:
                cv.put(p[0], p[1], c)
        prot = {p for p in face if p in body and 5 <= p[1] <= 16}
    return cv, prot | keep, th, pm


def minion_frames(name: str):
    d = MINIONS[name]
    raw, prot, th, pm = build_minion_raw(name)
    body_ramps = [th.body] + ([d["theme"].body2] if d["theme"].body2 else [])
    idle_a = finish(raw)
    # idle B: core pulse + eye glint (silhouette locked to the collision shape)
    rb = raw.copy()
    core = th.core

    def pulse(x, y, c):
        if (x, y) in prot and c in (ramp(core, 3), ramp(core, 4)):
            return ramp(core, 4) if c == ramp(core, 3) else ramp(core, 5)
        return c
    rb.recolor(pulse)
    frames = [("idle_a", idle_a), ("idle_b", finish(rb)), ("hit_flash", hit_flash(idle_a))]
    for hp in (0.75, 0.5, 0.25):
        out, _ = shatter(raw, hp, prot, core, d["center"], seed=d["seed"], angles=d.get("angles"))
        frames.append((f"hp_{int(hp * 100)}", finish(out)))
    frames.append(("frozen", finish(frozen_generic(raw, body_ramps, core, th.eye, keep=set(), inside=pm))))
    b = finish(heat_rim(raw, body_ramps))
    xs = sorted({p[0] for p in raw.mask()})
    flames_fx(b, raw.mask(), [(xs[len(xs) // 5] - 1, False), (xs[len(xs) // 2] - 1, True), (xs[3 * len(xs) // 4] - 2, False)],
              [(xs[0], 3), (min(22, xs[-1]), 1)])
    frames.append(("burning", b))
    cyc = [p for p in prot if raw.get(*p) in ("white", ramp(core, 5))]
    cc = (sum(p[0] for p in cyc) // max(1, len(cyc)), sum(p[1] for p in cyc) // max(1, len(cyc))) if cyc else (12, 12)
    d1, d2 = death_generic(idle_a, cc, core, 4)
    frames += [("death_1", d1), ("death_2", d2)]
    return frames, d["poly"]


def main():
    frames = residue_frames()
    export("enemy_residue_1x1", frames, {
        "kind": "enemy", "grid": [1, 1], "collision": {"shape": "aabb", "w": 24, "h": 24},
        "fill_ratio_frames": ["idle_a", "idle_b"],
        "protected": "eyes + core socket (dilated 1px) never removed by shatter stages",
        "damage_language": "shatter: rim notches + holes, core-glow break rims, dark cracks; envelope kept",
    })
    for name, d in MINIONS.items():
        frames, poly = minion_frames(name)
        export(f"enemy_minion_{name}_1x1", frames, {
            "kind": "enemy", "grid": [1, 1], "boss_theme": name,
            "collision": {"shape": "polygon", "w": 24, "h": 24,
                          "vertices_canvas": [[round(x, 2), round(y, 2)] for x, y in poly],
                          "source": "src/spawn_system.js spawn_applyMinionShape"},
            "polygon_check_frames": ["idle_a", "idle_b", "hit_flash", "hp_75", "hp_50", "hp_25", "frozen"],
        })


if __name__ == "__main__":
    main()
    print("ok")
