"""
Task 5.A5 — 弹药图标生成器
生成 8 种属性 32×32 炼金法球位图（实际生成 64×64 高分辨率版本）
属性：normal / pyro / cryo / lightning / pierce / bounce / scatter / laser
"""

from PIL import Image, ImageDraw, ImageFilter
import math
import os

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT  = os.path.join(BASE, 'assets', 'icons', 'ammo')
os.makedirs(OUT, exist_ok=True)

SIZE = 64  # 生成 64×64，CSS 可缩放到 32×32

AMMO_DEFS = {
    'normal':    {'core': (220, 230, 245), 'glow': (160, 180, 220), 'ring': (100, 120, 160), 'label': '普通'},
    'pyro':      {'core': (255, 180, 60),  'glow': (255, 100, 20),  'ring': (200, 60, 10),   'label': '火焰'},
    'cryo':      {'core': (200, 240, 255), 'glow': (80, 180, 255),  'ring': (40, 120, 200),  'label': '冰霜'},
    'lightning': {'core': (240, 220, 255), 'glow': (180, 100, 255), 'ring': (120, 60, 200),  'label': '闪电'},
    'pierce':    {'core': (255, 200, 200), 'glow': (255, 80, 80),   'ring': (180, 40, 40),   'label': '穿透'},
    'bounce':    {'core': (200, 255, 210), 'glow': (80, 220, 120),  'ring': (40, 160, 80),   'label': '弹跳'},
    'scatter':   {'core': (255, 240, 180), 'glow': (255, 200, 60),  'ring': (200, 150, 20),  'label': '散射'},
    'laser':     {'core': (255, 255, 255), 'glow': (100, 200, 255), 'ring': (40, 140, 220),  'label': '激光'},
    'explosive': {'core': (255, 160, 160), 'glow': (255, 60, 60),   'ring': (180, 20, 20),   'label': '爆炸'},
}

def make_ammo_icon(ammo_type, defs, size=SIZE):
    img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    
    cx, cy = size // 2, size // 2
    core_c = defs['core']
    glow_c = defs['glow']
    ring_c = defs['ring']

    # 外发光晕（多层叠加）
    for i in range(12, 0, -1):
        alpha = int(100 * (i / 12) ** 1.5)
        r_val = size // 2 - 2 + i
        draw.ellipse([cx - r_val, cy - r_val, cx + r_val, cy + r_val],
                    fill=(*glow_c, alpha))

    # 法球主体（径向渐变感：中心亮→边缘暗）
    ball_r = size // 2 - 6
    # 底色
    draw.ellipse([cx - ball_r, cy - ball_r, cx + ball_r, cy + ball_r],
                fill=(*ring_c, 230))
    # 中层
    mid_r = int(ball_r * 0.75)
    draw.ellipse([cx - mid_r, cy - mid_r, cx + mid_r, cy + mid_r],
                fill=(*glow_c, 220))
    # 核心亮点
    core_r = int(ball_r * 0.45)
    draw.ellipse([cx - core_r, cy - core_r, cx + core_r, cy + core_r],
                fill=(*core_c, 240))

    # 特殊属性装饰
    if ammo_type == 'pyro':
        # 火焰舌（3条）
        for i in range(3):
            angle = math.radians(-90 + i * 30 - 30)
            fx = cx + math.cos(angle) * ball_r * 0.6
            fy = cy + math.sin(angle) * ball_r * 0.6
            tip_x = cx + math.cos(angle) * (ball_r + 8)
            tip_y = cy + math.sin(angle) * (ball_r + 8)
            draw.line([(fx, fy), (tip_x, tip_y)], fill=(255, 220, 80, 180), width=2)

    elif ammo_type == 'cryo':
        # 六角雪花
        for i in range(6):
            angle = math.radians(i * 60)
            ex = cx + math.cos(angle) * (ball_r - 2)
            ey = cy + math.sin(angle) * (ball_r - 2)
            draw.line([(cx, cy), (ex, ey)], fill=(220, 245, 255, 160), width=1)

    elif ammo_type == 'lightning':
        # 闪电纹
        pts = [(cx - 4, cy - ball_r + 4), (cx + 2, cy - 2),
               (cx - 2, cy + 2), (cx + 4, cy + ball_r - 4)]
        draw.line(pts, fill=(255, 255, 200, 200), width=2)

    elif ammo_type == 'pierce':
        # 穿透箭头
        draw.line([(cx - ball_r + 4, cy), (cx + ball_r - 4, cy)],
                 fill=(255, 220, 220, 200), width=2)
        draw.polygon([(cx + ball_r - 4, cy), (cx + ball_r - 10, cy - 4),
                      (cx + ball_r - 10, cy + 4)],
                    fill=(255, 220, 220, 220))

    elif ammo_type == 'bounce':
        # 弹跳弧线
        draw.arc([cx - ball_r + 4, cy - ball_r + 4, cx + ball_r - 4, cy + ball_r - 4],
                start=30, end=150, fill=(180, 255, 200, 180), width=2)

    elif ammo_type == 'scatter':
        # 散射点（5个小点）
        for i in range(5):
            angle = math.radians(i * 72 - 90)
            px = cx + math.cos(angle) * (ball_r - 6)
            py = cy + math.sin(angle) * (ball_r - 6)
            draw.ellipse([px - 2, py - 2, px + 2, py + 2], fill=(255, 240, 160, 200))

    elif ammo_type == 'laser':
        # 激光十字
        draw.line([(cx - ball_r + 2, cy), (cx + ball_r - 2, cy)],
                 fill=(200, 240, 255, 200), width=1)
        draw.line([(cx, cy - ball_r + 2), (cx, cy + ball_r - 2)],
                 fill=(200, 240, 255, 200), width=1)
        # 中心白点
        draw.ellipse([cx - 3, cy - 3, cx + 3, cy + 3], fill=(255, 255, 255, 240))

    elif ammo_type == 'explosive':
        # 爆炸射线
        for i in range(8):
            angle = math.radians(i * 45)
            ex = cx + math.cos(angle) * (ball_r + 6)
            ey = cy + math.sin(angle) * (ball_r + 6)
            draw.line([(cx + math.cos(angle) * (ball_r - 2), cy + math.sin(angle) * (ball_r - 2)),
                       (ex, ey)], fill=(255, 160, 80, 160), width=1)

    # 高光（左上角弧形）
    hl_r = int(ball_r * 0.55)
    draw.arc([cx - hl_r, cy - hl_r, cx + hl_r // 2, cy + hl_r // 2],
             start=200, end=310, fill=(255, 255, 255, 120), width=2)

    # 外环
    draw.ellipse([cx - ball_r, cy - ball_r, cx + ball_r, cy + ball_r],
                outline=(*ring_c, 200), width=1)

    path = os.path.join(OUT, f'ammo_{ammo_type}.png')
    img.save(path)
    print(f"  ✓ ammo_{ammo_type}.png")

for ammo_type, defs in AMMO_DEFS.items():
    make_ammo_icon(ammo_type, defs)

print("✅ Task 5.A5 弹药图标生成完毕！")
