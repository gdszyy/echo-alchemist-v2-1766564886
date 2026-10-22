"""mock_defend_screen: full defend phase at logical 187x333 art px (375 CSS px wide, k=2).

Layout (layout_wireframe_v2.html ③):
  y   0..16   top bar: wave, power, fire / ice / lightning / crystal, pause
  y  17..257  battlefield: 6 cols x 26 px grid centred (x 15..170), workshop floor,
              enemies pushing down, dashed amber defence line near the bottom
  y 258..332  factory strip (~75 px): 4 visible slots + main cannon bay in the centre,
              magazine + power budget row underneath

Layers are composed in order background -> interactable -> feedback -> UI. The background
layer is also exported alone so the checker can prove it never uses the outline colour.
"""
from __future__ import annotations

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from PIL import Image  # noqa: E402

import devices  # noqa: E402
import enemy_residue  # noqa: E402
import ui_factory  # noqa: E402
from pxlib import SAMPLES_DIR, Canvas, seeded, text3x5, text_width, upscale  # noqa: E402

W, H = 187, 333
TOP_H = 17
STRIP_Y = 258
GRID_X, GRID_Y, CELL = 15, 19, 26


# ----------------------------------------------------------------------------- background layer
def background() -> Canvas:
    bg = Canvas(W, H, "steel_1")
    # workshop floor: 26px flagstones aligned to the battle grid, two close mid values
    for row in range(-1, 10):
        for col in range(6):
            x0, y0 = GRID_X + col * CELL, GRID_Y + row * CELL
            tile = "bg_0" if (row + col) % 2 == 0 else "steel_2"
            bg.rect(x0, y0, CELL, CELL, tile)
            bg.hline(x0, x0 + CELL - 1, y0, "steel_1")         # grout
            bg.vline(x0, y0, y0 + CELL - 1, "steel_1")
    bg.rect(0, 0, GRID_X, H, "stone_1")                          # side walls
    bg.rect(GRID_X + 6 * CELL + 1, 0, W - (GRID_X + 6 * CELL + 1), H, "stone_1")
    # wall brickwork (very low contrast)
    for y in range(TOP_H, STRIP_Y, 6):
        off = 0 if (y // 6) % 2 == 0 else 3
        for x0, x1 in ((0, GRID_X - 2), (GRID_X + 6 * CELL + 2, W - 1)):
            bg.hline(x0, x1, y, "stone_2")
            for x in range(x0 + off, x1, 7):
                bg.vline(x, y, y + 5, "stone_2")
    # brass pipes running down the walls
    for px in (6, W - 8):
        bg.vline(px, TOP_H, STRIP_Y, "stone_3")
        bg.vline(px + 1, TOP_H, STRIP_Y, "stone_2")
        for y in range(TOP_H + 20, STRIP_Y, 40):
            bg.rect(px - 1, y, 4, 2, "stone_3")
    # faint transmutation runes on a few flagstones (background ramp step <=3)
    rnd = seeded(7)
    for col, row in ((1, 2), (4, 5), (2, 7), (5, 1), (0, 6)):
        cx, cy = GRID_X + col * CELL + 13, GRID_Y + row * CELL + 13
        rune(bg, cx, cy, "bg_1" if (row + col) % 2 else "bg_1", rnd)
    # ground shadow strip right above the factory (depth cue)
    bg.hline(0, W - 1, STRIP_Y - 1, "steel_1")
    return bg


def rune(cv: Canvas, cx: int, cy: int, c: str, rnd) -> None:
    pts = []
    import math
    for a in range(0, 360, 12):
        pts.append((int(round(cx + 8 * math.cos(math.radians(a)))), int(round(cy + 8 * math.sin(math.radians(a))))))
    for p in set(pts):
        cv.put(p[0], p[1], c)
    # inner triangle
    tri = [(cx, cy - 6), (cx + 5, cy + 4), (cx - 5, cy + 4)]
    for i in range(3):
        a, b = tri[i], tri[(i + 1) % 3]
        cv.line(a[0], a[1], b[0], b[1], c)


# ----------------------------------------------------------------------------- compose helpers
def stamp(dst: Canvas, src: Canvas, x: int, y: int) -> None:
    dst.blit(src, x, y)


def frame_of(frames, label):
    return dict(frames)[label]


def draw_9slice(dst: Canvas, src: Canvas, x: int, y: int, w: int, h: int, l: int, r: int, t: int, b: int) -> None:
    sw, sh = src.w, src.h

    def sample(px, py):
        # map destination pixel to source pixel (edges repeat their middle column/row)
        if px < l:
            sx = px
        elif px >= w - r:
            sx = sw - (w - px)
        else:
            sx = l + (px - l) % (sw - l - r)
        if py < t:
            sy = py
        elif py >= h - b:
            sy = sh - (h - py)
        else:
            sy = t + (py - t) % (sh - t - b)
        return src.get(sx, sy)
    for py in range(h):
        for px in range(w):
            c = sample(px, py)
            if c is not None:
                dst.put(x + px, y + py, c)


def bullet(cv: Canvas, x: int, y: int) -> None:
    """Turret fire bolt (feedback layer, no outline): 3x6 travelling up."""
    rows = [".5.", "545", "454", ".4.", ".3.", ".3."]
    cmap = {"5": "pyro_5", "4": "pyro_4", "3": "pyro_3"}
    for j, r in enumerate(rows):
        for i, ch in enumerate(r):
            if ch != ".":
                cv.put(x + i, y + j, cmap[ch])


def alchemy_shot(cv: Canvas, x: int, y: int) -> None:
    """Main-cannon alchemy shot: 5x5 golden orb + short trail toward the lower-left."""
    rows = [".555.", "5ww55", "5w554", "55544", ".444."]
    cmap = {"5": "lightning_5", "w": "white", "4": "pyro_4"}
    for j, r in enumerate(rows):
        for i, ch in enumerate(r):
            if ch != ".":
                cv.put(x + i, y + j, cmap[ch])
    trail = [(x - 1, y + 5), (x - 2, y + 6), (x - 2, y + 7), (x - 3, y + 8), (x - 4, y + 10)]
    for (tx, ty), c in zip(trail, ("pyro_5", "pyro_4", "pyro_4", "pyro_3", "pyro_3")):
        cv.put(tx, ty, c)


def defence_line(cv: Canvas, y: int) -> None:
    x0, x1 = GRID_X, GRID_X + 6 * CELL - 1
    for x in range(x0, x1 + 1):
        if (x - x0) % 6 < 4:
            cv.put(x, y, "lightning_4")
            cv.put(x, y + 1, "lightning_2")
    # end posts
    for x in (x0 - 1, x1 + 1):
        cv.vline(x, y - 2, y + 2, "lightning_3")


# ----------------------------------------------------------------------------- top bar
def top_bar(cv: Canvas) -> None:
    draw_9slice(cv, ui_factory.topbar_9slice(), 0, 0, W, TOP_H, 6, 6, 1, 4)
    ty = 4
    x = 4
    x = text3x5(cv, x, ty, "W2/3", "stone_5", shadow="outline") + 4
    items = [("power", "10/30", "venom_4"), ("fire", "8", "stone_5"), ("ice", "3", "stone_5"),
             ("lightning", "1", "stone_5"), ("crystal", "0", "stone_5")]
    for name, num, col in items:
        stamp(cv, ui_factory.icon(name), x, 2)
        x = text3x5(cv, x + 11, ty, num, col, shadow="outline") + 5
    # pause button
    px = W - 12
    cv.rect(px, 3, 9, 9, "outline")
    cv.rect(px + 1, 4, 7, 7, "steel_2")
    cv.vline(px + 3, 5, 9, "stone_5")
    cv.vline(px + 5, 5, 9, "stone_5")


# ----------------------------------------------------------------------------- factory strip
def factory_strip(cv: Canvas, turret, generator, cannon) -> dict:
    draw_9slice(cv, ui_factory.strip_9slice(), 0, STRIP_Y, W, H - STRIP_Y, 8, 8, 8, 8)
    sy = STRIP_Y + 8
    xs = [13, 44, 114, 145]
    bay_x, bay_y = 75, STRIP_Y + 4
    pos = {}
    # slot 1: turret firing ; slot 2: generator running ; slot 3: turret unpowered ; slot 4: locked
    states = [("occupied", frame_of(turret, "firing")), ("occupied", frame_of(generator, "running_a")),
              ("unpowered", frame_of(turret, "unpowered")), ("locked", None)]
    for x, (st, dev) in zip(xs, states):
        stamp(cv, ui_factory.slot_frame(st), x, sy)
        if dev is not None:
            stamp(cv, dev, x + 2, sy + 2)
        pos[len(pos)] = (x, sy)
    stamp(cv, ui_factory.slot_frame("occupied", 36), bay_x, bay_y)
    stamp(cv, frame_of(cannon, "loaded"), bay_x + 2, bay_y + 2)
    # lower row: magazine (next shots) + power budget meter
    ry = STRIP_Y + 46
    cv.rect(10, ry, 70, 21, "steel_2")
    cv.rect(10, ry, 70, 21, "outline", fill=False)
    for i, el in enumerate(("fire", "fire", "ice")):
        stamp(cv, ui_factory.icon(el), 14 + i * 12, ry + 5)
    text3x5(cv, 52, ry + 8, "x3", "stone_5", shadow="outline")
    # power meter: 10 / 30 budget used by running devices
    mx, mw = 106, 72
    stamp(cv, ui_factory.icon("power"), 92, ry + 1)
    cv.rect(mx, ry + 3, mw, 6, "outline")
    cv.rect(mx + 1, ry + 4, mw - 2, 4, "steel_1")
    fill = int((mw - 2) * 17 / 27)
    cv.rect(mx + 1, ry + 4, fill, 4, "venom_3")
    cv.hline(mx + 1, mx + fill, ry + 4, "venom_4")
    for t in range(mx + 1 + 8, mx + mw - 1, 9):
        cv.vline(t, ry + 4, ry + 7, "steel_1" if t > mx + fill else "venom_2")
    text3x5(cv, mx, ry + 12, "17/27", "stone_5", shadow="outline")
    # next-wave preview text slot (digits only): enemies 14
    return {"turret_tip": (xs[0] + 2 + 12, sy + 2), "cannon_tip": (bay_x + 18, bay_y + 2)}


# ----------------------------------------------------------------------------- main
def build():
    bg = background()
    scene = bg.copy()
    # interactable: enemies on the grid (cells 26, sprite 24 -> +1 inset)
    n = dict(enemy_residue.build(False))
    e = dict(enemy_residue.build(True))
    placements = [
        (1, 0, n["idle_a"]), (4, 0, e["idle_a"]), (0, 1, n["hp_50"]), (2, 1, n["frozen"]),
        (5, 1, n["idle_b"]), (3, 2, n["burning"]), (0, 3, n["hp_75"]), (1, 3, e["armor_broken"]),
        (4, 4, n["hp_25"]),
    ]
    for col, row, spr in placements:
        stamp(scene, spr, GRID_X + col * CELL + 1, GRID_Y + row * CELL + 1)
    defence_line(scene, GRID_Y + 8 * CELL + 3)
    # devices / cannon / ui
    turret = devices.turret_frames()
    gen = devices.generator_frames()
    can = devices.cannon_frames()
    top_bar(scene)
    tips = factory_strip(scene, turret, gen, can)
    # feedback: bullets in flight
    tx, ty = tips["turret_tip"]
    bullet(scene, tx - 1, 196)
    bullet(scene, tx - 1, 150)
    alchemy_shot(scene, 118, 150)
    return bg, scene


def main():
    bg, scene = build()
    os.makedirs(SAMPLES_DIR, exist_ok=True)
    bg.save(os.path.join(SAMPLES_DIR, "mock_defend_screen_bg_layer.png"))
    scene.save(os.path.join(SAMPLES_DIR, "mock_defend_screen.png"))
    upscale(scene.to_image(), 4).save(os.path.join(SAMPLES_DIR, "mock_defend_screen_x4.png"))


if __name__ == "__main__":
    main()
    print("ok")
