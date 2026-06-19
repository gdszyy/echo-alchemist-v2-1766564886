"""
Task 5.A6 — 符文图标生成器
生成 14 种符文 96×96 位图（显示 48×48，含稀有度视觉差异）
符文列表来自 rune_config.js RUNE_DB
"""

from PIL import Image, ImageDraw, ImageFilter
import math
import os

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT  = os.path.join(BASE, 'assets', 'icons', 'rune')
os.makedirs(OUT, exist_ok=True)

SIZE = 96  # 生成 96×96，CSS 缩放到 48×48

RARITY_BG = {
    'common':    ((20, 25, 40),   (80, 90, 110),   (120, 130, 150)),
    'rare':      ((15, 25, 50),   (40, 80, 180),   (80, 140, 255)),
    'epic':      ((25, 15, 50),   (100, 40, 180),  (160, 80, 255)),
    'legendary': ((40, 30, 10),   (160, 120, 20),  (255, 200, 60)),
}

RUNE_DEFS = [
    # id, name, rarity, element, symbol_type
    ('rune_pyro_1',      '烈焰符文', 'common',    'pyro',      'flame'),
    ('rune_pyro_2',      '炎核符文', 'epic',      'pyro',      'volcano'),
    ('rune_cryo_1',      '寒冰符文', 'common',    'cryo',      'snowflake'),
    ('rune_cryo_2',      '冰晶符文', 'epic',      'cryo',      'crystal'),
    ('rune_lightning_1', '雷霆符文', 'rare',      'lightning', 'bolt'),
    ('rune_lightning_2', '电弧符文', 'legendary', 'lightning', 'arc'),
    ('rune_bounce_1',    '弹跃符文', 'common',    'bounce',    'bounce'),
    ('rune_bounce_2',    '回响符文', 'rare',      'bounce',    'echo'),
    ('rune_pierce_1',    '穿刺符文', 'epic',      'pierce',    'arrow'),
    ('rune_pierce_2',    '破甲符文', 'legendary', 'pierce',    'spear'),
    ('rune_scatter_1',   '散裂符文', 'legendary', 'scatter',   'scatter'),
    ('rune_venom_1',     '毒蚀符文', 'rare',      'venom',     'venom'),
    ('rune_venom_2',     '剧毒符文', 'epic',      'venom',     'toxin'),
    ('rune_overcharge_1','超载符文', 'epic',      'overcharge','overcharge'),
    ('rune_echo_1',      '回声符文', 'rare',      'echo',      'echo'),
    ('rune_laser_1',     '光束符文', 'rare',      'laser',     'beam'),
    ('rune_laser_2',     '聚焦符文', 'legendary', 'laser',     'focus'),
    # 额外：通用占位符文
    ('rune_generic',     '符文',     'common',    'generic',   'rune'),
]

ELEMENT_COLORS = {
    'pyro':      (255, 120, 30),
    'cryo':      (80,  180, 255),
    'lightning': (200, 120, 255),
    'bounce':    (80,  220, 120),
    'pierce':    (255, 100, 100),
    'scatter':   (255, 210, 60),
    'venom':     (80,  240, 120),
    'overcharge':(255, 170, 60),
    'echo':      (120, 140, 255),
    'laser':     (120, 220, 255),
    'generic':   (160, 160, 180),
}

def draw_rune_symbol(draw, cx, cy, symbol, color, size, rarity):
    """绘制符文中心符号"""
    r, g, b = color
    sym_r = size * 0.28

    if symbol == 'flame':
        # 火焰形状
        pts = [(cx, cy - sym_r), (cx + sym_r * 0.5, cy - sym_r * 0.3),
               (cx + sym_r * 0.3, cy + sym_r * 0.5), (cx, cy + sym_r * 0.3),
               (cx - sym_r * 0.3, cy + sym_r * 0.5), (cx - sym_r * 0.5, cy - sym_r * 0.3)]
        draw.polygon(pts, fill=(r, g, b, 220))
        # 内核
        draw.ellipse([cx - sym_r * 0.2, cy - sym_r * 0.1,
                      cx + sym_r * 0.2, cy + sym_r * 0.3],
                    fill=(255, 240, 200, 200))

    elif symbol == 'volcano':
        # 火山三角
        pts = [(cx, cy - sym_r), (cx + sym_r * 0.7, cy + sym_r * 0.6),
               (cx - sym_r * 0.7, cy + sym_r * 0.6)]
        draw.polygon(pts, fill=(r, g, b, 220))
        # 熔岩口
        draw.ellipse([cx - sym_r * 0.15, cy - sym_r * 0.2,
                      cx + sym_r * 0.15, cy + sym_r * 0.1],
                    fill=(255, 200, 50, 200))

    elif symbol == 'snowflake':
        # 雪花（6臂）
        for i in range(6):
            angle = math.radians(i * 60)
            ex = cx + math.cos(angle) * sym_r
            ey = cy + math.sin(angle) * sym_r
            draw.line([(cx, cy), (ex, ey)], fill=(r, g, b, 220), width=2)
            # 侧枝
            for j in [-1, 1]:
                branch_angle = angle + j * math.radians(60)
                bx = (cx + ex) / 2 + math.cos(branch_angle) * sym_r * 0.3
                by = (cy + ey) / 2 + math.sin(branch_angle) * sym_r * 0.3
                draw.line([(cx + math.cos(angle) * sym_r * 0.5,
                            cy + math.sin(angle) * sym_r * 0.5), (bx, by)],
                         fill=(r, g, b, 160), width=1)

    elif symbol == 'crystal':
        # 冰晶六边形
        pts = []
        for i in range(6):
            angle = math.radians(i * 60 - 30)
            pts.append((cx + math.cos(angle) * sym_r, cy + math.sin(angle) * sym_r))
        draw.polygon(pts, fill=(r, g, b, 180), outline=(200, 240, 255, 220), width=1)
        # 内六边形
        pts2 = []
        for i in range(6):
            angle = math.radians(i * 60 - 30)
            pts2.append((cx + math.cos(angle) * sym_r * 0.5, cy + math.sin(angle) * sym_r * 0.5))
        draw.polygon(pts2, fill=(220, 245, 255, 200))

    elif symbol == 'bolt':
        # 闪电
        pts = [(cx - sym_r * 0.2, cy - sym_r),
               (cx + sym_r * 0.3, cy - sym_r * 0.1),
               (cx, cy + sym_r * 0.1),
               (cx + sym_r * 0.4, cy + sym_r)]
        draw.line(pts, fill=(r, g, b, 240), width=3)

    elif symbol == 'arc':
        # 电弧（多重闪电）
        for offset in [-sym_r * 0.25, 0, sym_r * 0.25]:
            pts = [(cx + offset - sym_r * 0.1, cy - sym_r),
                   (cx + offset + sym_r * 0.2, cy - sym_r * 0.2),
                   (cx + offset - sym_r * 0.1, cy + sym_r * 0.2),
                   (cx + offset + sym_r * 0.2, cy + sym_r)]
            draw.line(pts, fill=(r, g, b, 180), width=2)

    elif symbol == 'bounce':
        # 弹跳弧（两段弧）
        draw.arc([cx - sym_r, cy - sym_r * 0.3, cx, cy + sym_r * 0.7],
                start=180, end=0, fill=(r, g, b, 220), width=2)
        draw.arc([cx, cy - sym_r * 0.3, cx + sym_r, cy + sym_r * 0.7],
                start=180, end=0, fill=(r, g, b, 220), width=2)

    elif symbol == 'echo':
        # 回响（同心弧）
        for i in range(3):
            r_val = sym_r * (0.4 + i * 0.3)
            draw.arc([cx - r_val, cy - r_val, cx + r_val, cy + r_val],
                    start=220, end=320, fill=(r, g, b, 200 - i * 50), width=2)

    elif symbol == 'arrow':
        # 穿透箭头
        draw.line([(cx - sym_r, cy), (cx + sym_r, cy)], fill=(r, g, b, 220), width=3)
        draw.polygon([(cx + sym_r, cy), (cx + sym_r - 8, cy - 6),
                      (cx + sym_r - 8, cy + 6)], fill=(r, g, b, 240))
        # 尾羽
        draw.line([(cx - sym_r, cy), (cx - sym_r + 6, cy - 5)], fill=(r, g, b, 160), width=1)
        draw.line([(cx - sym_r, cy), (cx - sym_r + 6, cy + 5)], fill=(r, g, b, 160), width=1)

    elif symbol == 'spear':
        # 破甲长矛
        draw.line([(cx - sym_r, cy), (cx + sym_r, cy)], fill=(r, g, b, 220), width=4)
        pts = [(cx + sym_r, cy), (cx + sym_r - 10, cy - 8), (cx + sym_r - 10, cy + 8)]
        draw.polygon(pts, fill=(r, g, b, 240))
        # 破甲裂纹
        draw.line([(cx, cy - 6), (cx + 10, cy + 6)], fill=(255, 200, 100, 160), width=1)

    elif symbol == 'scatter':
        # 散射（中心点+放射线）
        draw.ellipse([cx - 4, cy - 4, cx + 4, cy + 4], fill=(r, g, b, 240))
        for i in range(5):
            angle = math.radians(i * 72 - 90)
            ex = cx + math.cos(angle) * sym_r
            ey = cy + math.sin(angle) * sym_r
            draw.line([(cx, cy), (ex, ey)], fill=(r, g, b, 160), width=1)
            draw.ellipse([ex - 3, ey - 3, ex + 3, ey + 3], fill=(r, g, b, 200))

    elif symbol == 'venom':
        # 毒蚀（液滴 + 腐蚀点）
        pts = [(cx, cy - sym_r), (cx + sym_r * 0.52, cy - sym_r * 0.1),
               (cx + sym_r * 0.38, cy + sym_r * 0.55), (cx, cy + sym_r),
               (cx - sym_r * 0.38, cy + sym_r * 0.55), (cx - sym_r * 0.52, cy - sym_r * 0.1)]
        draw.polygon(pts, fill=(r, g, b, 210))
        draw.ellipse([cx - sym_r * 0.24, cy - sym_r * 0.1,
                      cx + sym_r * 0.24, cy + sym_r * 0.38],
                    fill=(170, 255, 150, 190))
        for ox, oy in [(-0.42, -0.3), (0.45, 0.15), (-0.2, 0.55)]:
            draw.ellipse([cx + sym_r * ox - 2, cy + sym_r * oy - 2,
                          cx + sym_r * ox + 2, cy + sym_r * oy + 2],
                        fill=(220, 255, 180, 160))

    elif symbol == 'toxin':
        # 剧毒（药瓶 + 蒸汽）
        draw.rounded_rectangle([cx - sym_r * 0.42, cy - sym_r * 0.15,
                                cx + sym_r * 0.42, cy + sym_r * 0.75],
                               radius=5, fill=(r, g, b, 180),
                               outline=(210, 255, 170, 220), width=1)
        draw.rectangle([cx - sym_r * 0.22, cy - sym_r * 0.45,
                        cx + sym_r * 0.22, cy - sym_r * 0.12],
                       fill=(r, g, b, 210))
        for i in range(3):
            x = cx + (i - 1) * sym_r * 0.28
            draw.arc([x - 5, cy - sym_r * 0.95, x + 5, cy - sym_r * 0.35],
                     start=90, end=250, fill=(180, 255, 170, 150), width=1)

    elif symbol == 'overcharge':
        # 超载（核心 + 爆裂电弧）
        draw.ellipse([cx - sym_r * 0.36, cy - sym_r * 0.36,
                      cx + sym_r * 0.36, cy + sym_r * 0.36],
                    fill=(255, 230, 120, 220))
        for i in range(8):
            angle = math.radians(i * 45)
            inner = sym_r * 0.42
            outer = sym_r * (0.78 if i % 2 == 0 else 0.62)
            draw.line([(cx + math.cos(angle) * inner, cy + math.sin(angle) * inner),
                       (cx + math.cos(angle) * outer, cy + math.sin(angle) * outer)],
                      fill=(r, g, b, 220), width=2)
        draw.arc([cx - sym_r, cy - sym_r, cx + sym_r, cy + sym_r],
                 start=20, end=150, fill=(255, 255, 210, 150), width=2)

    elif symbol == 'beam':
        # 光束（水平线+光晕）
        for i in range(3):
            y_off = (i - 1) * 4
            alpha = 200 if i == 1 else 100
            draw.line([(cx - sym_r, cy + y_off), (cx + sym_r, cy + y_off)],
                     fill=(r, g, b, alpha), width=2 if i == 1 else 1)
        # 聚焦点
        draw.ellipse([cx - 4, cy - 4, cx + 4, cy + 4], fill=(255, 255, 255, 220))

    elif symbol == 'focus':
        # 聚焦（同心圆+十字）
        for i in range(3):
            r_val = sym_r * (0.3 + i * 0.35)
            draw.ellipse([cx - r_val, cy - r_val, cx + r_val, cy + r_val],
                        outline=(r, g, b, 200 - i * 50), width=1)
        draw.line([(cx - sym_r, cy), (cx + sym_r, cy)], fill=(r, g, b, 160), width=1)
        draw.line([(cx, cy - sym_r), (cx, cy + sym_r)], fill=(r, g, b, 160), width=1)
        draw.ellipse([cx - 5, cy - 5, cx + 5, cy + 5], fill=(255, 255, 255, 240))

    else:  # generic rune
        # 通用符文（三角+圆）
        pts = [(cx, cy - sym_r), (cx + sym_r * 0.8, cy + sym_r * 0.5),
               (cx - sym_r * 0.8, cy + sym_r * 0.5)]
        draw.polygon(pts, outline=(r, g, b, 200), width=2)
        draw.ellipse([cx - sym_r * 0.3, cy - sym_r * 0.3,
                      cx + sym_r * 0.3, cy + sym_r * 0.3],
                    fill=(r, g, b, 180))


def make_rune_icon(rune_id, name, rarity, element, symbol, size=SIZE):
    img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    
    cx, cy = size // 2, size // 2
    elem_c = ELEMENT_COLORS.get(element, (160, 160, 180))
    bg_dark, bg_mid, bg_bright = RARITY_BG.get(rarity, RARITY_BG['common'])

    # 底板（圆形）
    base_r = size // 2 - 3
    draw.ellipse([cx - base_r, cy - base_r, cx + base_r, cy + base_r],
                fill=(*bg_dark, 230))

    # 外发光（稀有度越高越强）
    glow_strength = {'common': 40, 'rare': 70, 'epic': 100, 'legendary': 140}
    glow_a = glow_strength.get(rarity, 40)
    for i in range(8, 0, -1):
        alpha = int(glow_a * (i / 8) ** 2)
        r_val = base_r + i
        draw.ellipse([cx - r_val, cy - r_val, cx + r_val, cy + r_val],
                    fill=(*elem_c, alpha))

    # 内部纹理（六边形网格）
    for gy in range(cy - base_r, cy + base_r, 10):
        for gx in range(cx - base_r, cx + base_r, 10):
            dist = math.sqrt((gx - cx) ** 2 + (gy - cy) ** 2)
            if dist < base_r - 2:
                draw.point((gx, gy), fill=(*bg_mid, 30))

    # 边框（稀有度感）
    for i, alpha in enumerate([80, 150, 220]):
        r_val = base_r - i
        draw.ellipse([cx - r_val, cy - r_val, cx + r_val, cy + r_val],
                    outline=(*bg_bright, alpha), width=1)

    # 传说级：金色外环
    if rarity == 'legendary':
        for i in range(4):
            angle = math.radians(i * 90)
            px = cx + math.cos(angle) * (base_r - 2)
            py = cy + math.sin(angle) * (base_r - 2)
            draw.ellipse([px - 3, py - 3, px + 3, py + 3], fill=(*bg_bright, 200))

    # 绘制符文符号
    draw_rune_symbol(draw, cx, cy, symbol, elem_c, size, rarity)

    # 高光
    draw.arc([cx - base_r + 4, cy - base_r + 4, cx + base_r // 2, cy + base_r // 2],
             start=200, end=320, fill=(255, 255, 255, 80), width=2)

    path = os.path.join(OUT, f'{rune_id}.png')
    img.save(path)
    print(f"  ✓ {rune_id}.png  [{rarity}] {name}")

for rune_id, name, rarity, element, symbol in RUNE_DEFS:
    make_rune_icon(rune_id, name, rarity, element, symbol)

print("✅ Task 5.A6 符文图标生成完毕！")
