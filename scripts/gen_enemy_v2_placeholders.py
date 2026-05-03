#!/usr/bin/env python3
"""
gen_enemy_v2_placeholders.py — V2 敌人占位 Sprite/图标生成器

为 8 个 V2 基底生成可辨认的占位 PNG（Sprite Sheet + 64×64 头像图标），
并写入对应的 JSON manifest。运行后：
    assets/sprites/enemies/v2/<resourceId>.png
    assets/sprites/enemies/v2/<resourceId>.json
    assets/icons/enemies/<resourceId>.png

Sprite Sheet 规格与 golem_normal.json 兼容：
    frameSize=128，行 0 idle(4 帧)，行 1 hit(2 帧)。
    占位图为静帧重复，但保留多帧结构方便正式美术替换。

资源标记为 placeholder，命名/manifest/接入协议正式有效，
后续替换正式美术只需保留同名文件并更新 manifest 内的 frames/fps。
"""
import json
import os
from PIL import Image, ImageDraw

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
SPR_DIR = os.path.join(ROOT, 'assets', 'sprites', 'enemies', 'v2')
ICON_DIR = os.path.join(ROOT, 'assets', 'icons', 'enemies')
os.makedirs(SPR_DIR, exist_ok=True)
os.makedirs(ICON_DIR, exist_ok=True)

FRAME = 128
IDLE_FRAMES = 4
HIT_FRAMES = 2


def manifest():
    return {
        "frameSize": FRAME,
        "placeholder": True,
        "animations": {
            "idle": {"row": 0, "frames": IDLE_FRAMES, "fps": 6},
            "hit":  {"row": 1, "frames": HIT_FRAMES, "fps": 12},
        }
    }


def new_sheet():
    return Image.new('RGBA', (FRAME * IDLE_FRAMES, FRAME * 2), (0, 0, 0, 0))


def draw_text_label(d, text, color=(255, 255, 255, 230)):
    # 帧右下小标签：placeholder 标记
    try:
        d.text((4, FRAME - 14), text, fill=color)
    except Exception:
        pass


def draw_bastion(d, ox, oy, hit=False):
    # 装甲横梁：横向厚板 + 铆钉
    body = (50, 60, 75, 255) if not hit else (110, 110, 130, 255)
    edge = (180, 200, 220, 255)
    d.rectangle([ox + 8, oy + FRAME * 0.30, ox + FRAME - 8, oy + FRAME * 0.70], fill=body, outline=edge, width=3)
    # 铆钉
    for cx in (ox + 24, ox + 64, ox + 104):
        d.ellipse([cx - 5, oy + FRAME * 0.42, cx + 5, oy + FRAME * 0.58], fill=(220, 230, 240, 255), outline=(40, 45, 60, 255))
    # 顶部装饰条
    d.rectangle([ox + 16, oy + FRAME * 0.26, ox + FRAME - 16, oy + FRAME * 0.30], fill=(120, 140, 160, 255))


def draw_maw(d, ox, oy, hit=False):
    # 深渊胃囊：黑红圆腔 + 内部尖牙
    d.ellipse([ox + 10, oy + 10, ox + FRAME - 10, oy + FRAME - 10], fill=(60, 10, 12, 255), outline=(180, 32, 32, 255), width=4)
    # 内部黑核
    d.ellipse([ox + 32, oy + 36, ox + FRAME - 32, oy + FRAME - 16], fill=(15, 0, 0, 255))
    # 尖牙
    teeth_y = oy + FRAME * 0.40
    for i in range(6):
        x = ox + 28 + i * 12
        d.polygon([(x, teeth_y), (x + 6, teeth_y + 14), (x + 12, teeth_y)], fill=(240, 230, 220, 255))
    if hit:
        d.ellipse([ox + 40, oy + 40, ox + FRAME - 40, oy + FRAME - 40], outline=(255, 80, 80, 255), width=3)


def draw_deflector(d, ox, oy, hit=False):
    # 棱盾兽：菱形屏障 + 中央六边核
    cx, cy = ox + FRAME / 2, oy + FRAME / 2
    body = (40, 70, 110, 255) if not hit else (90, 130, 180, 255)
    d.polygon([(cx, cy - 44), (cx + 50, cy), (cx, cy + 44), (cx - 50, cy)], fill=body, outline=(140, 200, 240, 255))
    d.polygon([(cx, cy - 18), (cx + 22, cy), (cx, cy + 18), (cx - 22, cy)], fill=(200, 230, 255, 255))


def draw_echo_spire(d, ox, oy, hit=False):
    # 共振尖塔：纵向晶柱
    cx = ox + FRAME / 2
    base = (120, 30, 130, 255) if not hit else (200, 80, 220, 255)
    d.polygon([(cx, oy + 8), (cx + 22, oy + 40), (cx + 18, oy + FRAME - 14), (cx - 18, oy + FRAME - 14), (cx - 22, oy + 40)],
              fill=base, outline=(240, 180, 250, 255))
    # 共振条纹
    for i in range(3):
        y = oy + 50 + i * 18
        d.line([(cx - 14, y), (cx + 14, y)], fill=(255, 220, 255, 220), width=2)


def draw_prism(d, ox, oy, hit=False):
    # 折光棱柱：纵向三棱柱 + 彩虹折射
    cx = ox + FRAME / 2
    d.polygon([(cx, oy + 10), (cx + 28, oy + FRAME - 14), (cx - 28, oy + FRAME - 14)],
              fill=(230, 230, 240, 255), outline=(120, 130, 160, 255))
    bands = [(255, 80, 80), (255, 180, 80), (255, 240, 90), (120, 220, 120), (90, 180, 240), (160, 120, 240)]
    for i, c in enumerate(bands):
        y = oy + 36 + i * 12
        d.line([(cx - 16 + i, y), (cx + 16 - i, y)], fill=c + (220,), width=3)
    if hit:
        d.line([(ox + 4, oy + FRAME / 2), (ox + FRAME - 4, oy + FRAME / 2)], fill=(255, 255, 255, 200), width=2)


def draw_hive(d, ox, oy, hit=False):
    # 孵化巢：六边蜂窝 + 卵
    base = (90, 120, 40, 255)
    d.rectangle([ox + 10, oy + 10, ox + FRAME - 10, oy + FRAME - 10], fill=base, outline=(220, 220, 80, 255), width=3)
    for r in range(3):
        for c in range(3):
            cx = ox + 28 + c * 32
            cy = oy + 28 + r * 32
            color = (220, 220, 90, 255) if (r + c) % 2 == 0 else (160, 180, 60, 255)
            d.polygon([(cx, cy - 10), (cx + 9, cy - 5), (cx + 9, cy + 5), (cx, cy + 10), (cx - 9, cy + 5), (cx - 9, cy - 5)], fill=color, outline=(40, 50, 20, 255))
    if hit:
        d.ellipse([ox + FRAME / 2 - 8, oy + FRAME / 2 - 8, ox + FRAME / 2 + 8, oy + FRAME / 2 + 8], fill=(255, 255, 200, 255))


def draw_siege(d, ox, oy, hit=False):
    # 攻城履带：宽履带 + 中央炮塔
    d.rectangle([ox + 8, oy + 30, ox + FRAME - 8, oy + FRAME - 30], fill=(40, 40, 50, 255), outline=(120, 120, 140, 255), width=3)
    # 履带格子
    for i in range(7):
        x = ox + 14 + i * 16
        d.rectangle([x, oy + 36, x + 12, oy + FRAME - 36], outline=(160, 160, 180, 255), width=1)
    # 顶部炮塔
    d.rectangle([ox + 44, oy + 10, ox + FRAME - 44, oy + 36], fill=(80, 60, 40, 255), outline=(200, 160, 80, 255), width=2)
    if hit:
        d.line([(ox + FRAME / 2, oy + 16), (ox + FRAME / 2, oy + FRAME - 16)], fill=(255, 120, 60, 255), width=3)


def draw_gravity_core(d, ox, oy, hit=False):
    # 引力炉心：中心黑核 + 同心环
    cx, cy = ox + FRAME / 2, oy + FRAME / 2
    for r, col in [(58, (60, 30, 110, 200)), (44, (90, 50, 160, 220)), (30, (140, 80, 220, 240))]:
        d.ellipse([cx - r, cy - r, cx + r, cy + r], outline=col, width=2)
    d.ellipse([cx - 16, cy - 16, cx + 16, cy + 16], fill=(0, 0, 0, 255), outline=(220, 180, 255, 255), width=2)
    if hit:
        d.ellipse([cx - 60, cy - 60, cx + 60, cy + 60], outline=(255, 255, 255, 220), width=2)


DRAWERS = {
    'enemy_bastion_3x1':      draw_bastion,
    'enemy_maw_2x2':          draw_maw,
    'enemy_deflector_2x1':    draw_deflector,
    'enemy_echo_spire_1x2':   draw_echo_spire,
    'enemy_prism_1x3':        draw_prism,
    'enemy_hive_2x3':         draw_hive,
    'enemy_siege_3x2':        draw_siege,
    'enemy_gravity_core_3x3': draw_gravity_core,
}


def gen_sheet(resource_id, drawer):
    sheet = new_sheet()
    d = ImageDraw.Draw(sheet)
    # idle row（4 帧，动作差异通过亮度抖动占位）
    for i in range(IDLE_FRAMES):
        ox = i * FRAME
        oy = 0
        drawer(d, ox, oy, hit=False)
        draw_text_label(d, 'PH', color=(255, 255, 255, 120))
    # hit row（2 帧）
    for i in range(HIT_FRAMES):
        ox = i * FRAME
        oy = FRAME
        drawer(d, ox, oy, hit=True)
        draw_text_label(d, 'HIT', color=(255, 200, 200, 180))
    sheet.save(os.path.join(SPR_DIR, resource_id + '.png'))

    with open(os.path.join(SPR_DIR, resource_id + '.json'), 'w', encoding='utf-8') as f:
        json.dump(manifest(), f, ensure_ascii=False, indent=2)


def gen_icon(resource_id, drawer):
    # 64×64 图鉴/UI 头像：缩放第一帧
    full = Image.new('RGBA', (FRAME, FRAME), (0, 0, 0, 0))
    drawer(ImageDraw.Draw(full), 0, 0, hit=False)
    icon = full.resize((64, 64), Image.LANCZOS)
    icon.save(os.path.join(ICON_DIR, resource_id + '.png'))


def main():
    for rid, drawer in DRAWERS.items():
        gen_sheet(rid, drawer)
        gen_icon(rid, drawer)
        print('generated', rid)


if __name__ == '__main__':
    main()
