"""Mock factory strips (devices + hero cannon in place) and the cannon-vs-device-family comparison.

Outputs (previews only, never runtime assets) in docs/art/batch_devices_ui/:
  mock_strip_a.png / _x4   turret firing Lv2, generator running, frost tower UNPOWERED, locked slot
  mock_strip_b.png / _x4   shield, battery 75%, synthesizer working, ammo workshop crafting
  compare_cannon_vs_devices.png / _x4   cannon (bay) next to all nine slot devices (slots)
"""
from __future__ import annotations

import os

from PIL import Image

import board
import factory_devices as D
import ui
from common import PAL, PREVIEW_DIR, Canvas, upscale
from pxlib import text3x5

W = 187


def nine(dst, src, x, y, w, h, l, r, t, b):
    sw, sh = src.w, src.h
    for py in range(h):
        for px in range(w):
            sx = px if px < l else (sw - (w - px) if px >= w - r else l + (px - l) % (sw - l - r))
            sy = py if py < t else (sh - (h - py) if py >= h - b else t + (py - t) % (sh - t - b))
            c = src.get(sx, sy)
            if c is not None:
                dst.put(x + px, y + py, c)


def frame(frames, label):
    return dict(frames)[label]


def strip(slots, cannon_label="loaded_fire", pips=3):
    """slots: list of 4 (slot_state, device_canvas|None, level|None, powered)."""
    cv = Canvas(W, 84)
    # hopper intake on the top edge (board materials fall in here)
    hx0, hx1 = 60, 127
    cv.blit(ui.hopper_intake("left"), hx0, 0)
    for x in range(hx0 + 8, hx1 - 7, 8):
        cv.blit(ui.hopper_intake("mid", active=(x // 8) % 2 == 0), x, 0)
    cv.blit(ui.hopper_intake("right"), hx1 - 7, 0)
    nine(cv, ui.strip_9slice(), 0, 7, W, 77, 8, 8, 8, 8)
    for x in range(hx0, hx1 + 1):         # re-draw intake lip over the strip top
        cv.put(x, 7, "steel_1")
    xs = [8, 41, 118, 151]
    sy = 15
    badges = D.level_badges()
    for x, (st, dev, lv, _) in zip(xs, slots):
        cv.blit(ui.slot_frame(st), x, sy)
        if dev is not None:
            cv.blit(dev, x + 2, sy + 2)
        if lv:
            cv.blit(badges[lv - 1][1], x + 2, sy + 2)
    bx, by = 75, 11
    cv.blit(ui.cannon_bay(active=cannon_label.startswith("loaded")), bx, by)
    cv.blit(frame(D.cannon(), cannon_label), bx + 2, by + 2)
    cv.blit(D.cannon_pips()[pips][1], bx + 2, by + 2)
    # power bus under the slots (conduits); a dead segment under unpowered slots
    yb = 48
    for x, (st, dev, lv, on) in zip(xs, slots):
        for t in range(x, x + 28, 8):
            seg = ui.conduit("powered" if on else "off", phase=(t // 8) % 2)
            cv.blit(seg, t, yb)
    cv.blit(ui.conduit_end("left", slots[0][3]), 4, yb)
    # lower row: magazine + item + power budget
    ry = 58
    for i, (el, nxt) in enumerate((("fire", True), ("ice", False), (None, False))):
        cv.blit(ui.magazine_slot(el, nxt), 8 + i * 15, ry)
    cv.blit(ui.item_icon("bomb"), 55, ry - 1)
    cv.blit(ui.icon10("power"), 100, ry)
    px = 112
    cv.blit(ui.power_bar_piece("cap_left"), px, ry + 1)
    pieces = ["fill"] * 10 + ["empty"] * 4 + ["limit"]
    for i, k in enumerate(pieces):
        cv.blit(ui.power_bar_piece(k), px + 4 + i * 4, ry + 1)
    cv.blit(ui.power_bar_piece("cap_right"), px + 4 + len(pieces) * 4, ry + 1)
    text3x5(cv, px, ry + 11, "17/27", "stone_5", shadow="outline")
    return cv


def save(cv, name, k=4):
    im = cv.to_image()
    bg = Image.new("RGBA", im.size, PAL.rgb["bg_0"] + (255,))
    bg.alpha_composite(im)
    bg.save(os.path.join(PREVIEW_DIR, f"{name}.png"))
    upscale(bg, k).save(os.path.join(PREVIEW_DIR, f"{name}_x{k}.png"))


def compare():
    """Cannon in its bay next to the nine slot devices, each in an occupied slot (native)."""
    n = len(D.DEVICES)
    cv = Canvas(4 + 36 + 6 + n * 30, 42)
    cv.blit(ui.cannon_bay(active=True), 2, 3)
    cv.blit(frame(D.cannon(), "loaded_fire"), 4, 5)
    cv.blit(D.cannon_pips()[3][1], 4, 5)
    for i, (name, fn) in enumerate(D.DEVICES):
        x = 4 + 36 + 6 + i * 30
        cv.blit(ui.slot_frame("occupied"), x, 7)
        frames = fn()
        cv.blit(dict(frames).get("charge_75", frames[0][1]), x + 2, 9)
    return cv


def build():
    a = strip([("occupied", frame(D.turret(), "firing"), 2, True),
               ("occupied", frame(D.generator(), "running_a"), 1, True),
               ("unpowered", frame(D.frost_tower(), "unpowered"), 1, False),
               ("locked", None, None, False)], "loaded_fire", 3)
    save(a, "mock_strip_a")
    b = strip([("occupied", frame(D.shield_generator(), "shield_pulse"), 1, True),
               ("occupied", frame(D.battery(), "charge_75"), 3, True),
               ("occupied", frame(D.lightning_synthesizer(), "working_2"), 1, True),
               ("occupied", frame(D.ammo_workshop(), "crafting_2"), 2, True)], "aim_ready", 5)
    save(b, "mock_strip_b")
    save(compare(), "compare_cannon_vs_devices")


if __name__ == "__main__":
    build()
    print("ok")
