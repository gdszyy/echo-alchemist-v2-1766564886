"""
Task 5.A7 — 遗物图标生成器
生成 39 种遗物 128×128 位图（显示 64×64，边框颜色区分稀有度）
"""

from PIL import Image, ImageDraw, ImageFilter
import math
import os

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT  = os.path.join(BASE, 'assets', 'icons', 'relic')
os.makedirs(OUT, exist_ok=True)

SIZE = 128  # 生成 128×128，CSS 缩放到 64×64

RARITY_BORDER = {
    'common':    ((100, 110, 130), (60, 70, 90)),
    'rare':      ((60,  120, 220), (30, 70, 160)),
    'epic':      ((140, 60,  220), (90, 30, 160)),
    'legendary': ((220, 170, 30),  (160, 120, 10)),
    'cursed':    ((200, 40,  60),  (140, 20, 30)),
}

# 每种遗物的视觉主题
RELIC_THEMES = {
    'gigantism_relic':          {'shape': 'orb',      'color': (140, 80, 200), 'symbol': 'expand'},
    'chaos_essence':            {'shape': 'wheel',    'color': (200, 100, 50), 'symbol': 'spiral'},
    'pure_essence':             {'shape': 'orb',      'color': (220, 220, 255), 'symbol': 'dove'},
    'dimension_shard':          {'shape': 'crystal',  'color': (80, 120, 220), 'symbol': 'void'},
    'dimension_crystal':        {'shape': 'crystal',  'color': (60, 100, 200), 'symbol': 'void2'},
    'stars_shines':             {'shape': 'star',     'color': (255, 220, 80), 'symbol': 'sparkle'},
    'optical_lens':             {'shape': 'lens',     'color': (80, 200, 255), 'symbol': 'beam'},
    'pink_slime':               {'shape': 'blob',     'color': (255, 150, 200), 'symbol': 'drop'},
    'energy_shield':            {'shape': 'shield',   'color': (80, 180, 255), 'symbol': 'hex'},
    'unlock_recall':            {'shape': 'hourglass','color': (200, 180, 100), 'symbol': 'time'},
    'unlock_multicast':         {'shape': 'mirror',   'color': (180, 200, 255), 'symbol': 'twin'},
    'unlock_split':             {'shape': 'atom',     'color': (255, 200, 80), 'symbol': 'split'},
    'slot_expander':            {'shape': 'tool',     'color': (180, 140, 80), 'symbol': 'hammer'},
    'cryo_stone':               {'shape': 'gem',      'color': (80, 180, 255), 'symbol': 'ice'},
    'pyro_stone':               {'shape': 'gem',      'color': (255, 120, 40), 'symbol': 'fire'},
    'lightning_stone':          {'shape': 'gem',      'color': (200, 120, 255), 'symbol': 'bolt'},
    'tactical_kit_pierce':      {'shape': 'kit',      'color': (255, 100, 100), 'symbol': 'arrow'},
    'tactical_kit_scatter':     {'shape': 'kit',      'color': (255, 200, 60), 'symbol': 'scatter'},
    'tactical_kit_damage':      {'shape': 'kit',      'color': (220, 80, 80), 'symbol': 'sword'},
    'explosive_ammo':           {'shape': 'bomb',     'color': (255, 100, 60), 'symbol': 'explosion'},
    'prism_shard':              {'shape': 'prism',    'color': (200, 100, 255), 'symbol': 'rainbow'},
    'russian_doll':             {'shape': 'doll',     'color': (255, 160, 80), 'symbol': 'nest'},
    'triangle_formation':       {'shape': 'triangle', 'color': (255, 100, 80), 'symbol': 'tri'},
    'diamond_formation':        {'shape': 'diamond',  'color': (80, 160, 255), 'symbol': 'dia'},
    'sparse_interval':          {'shape': 'wave',     'color': (100, 180, 180), 'symbol': 'wave'},
    'mirror_sync':              {'shape': 'mirror',   'color': (160, 200, 255), 'symbol': 'reflect'},
    'wide_narrow':              {'shape': 'ruler',    'color': (180, 160, 100), 'symbol': 'measure'},
    'surge_bounce':             {'shape': 'surge',    'color': (80, 200, 120), 'symbol': 'bounce'},
    'surge_pierce':             {'shape': 'surge',    'color': (255, 100, 100), 'symbol': 'pierce'},
    'surge_scatter':            {'shape': 'surge',    'color': (255, 200, 60), 'symbol': 'scatter2'},
    'surge_damage':             {'shape': 'surge',    'color': (220, 80, 80), 'symbol': 'power'},
    'surge_cryo':               {'shape': 'surge',    'color': (80, 180, 255), 'symbol': 'ice2'},
    'surge_pyro':               {'shape': 'surge',    'color': (255, 120, 40), 'symbol': 'fire2'},
    'alchemist_powder_tube':    {'shape': 'tube',     'color': (180, 220, 100), 'symbol': 'alchemy'},
    'smuggler_pouch_common':    {'shape': 'bag',      'color': (160, 140, 100), 'symbol': 'pouch'},
    'smuggler_chest_rare':      {'shape': 'chest',    'color': (180, 160, 80), 'symbol': 'chest'},
    'smuggler_vault_epic':      {'shape': 'vault',    'color': (160, 80, 220), 'symbol': 'key'},
    'smuggler_sanctum_legendary':{'shape': 'temple',  'color': (220, 180, 60), 'symbol': 'pillar'},
    'desperation_blade':        {'shape': 'blade',    'color': (200, 40, 60), 'symbol': 'blood'},
}

def draw_relic_symbol(draw, cx, cy, symbol, color, size):
    """绘制遗物中心符号"""
    r, g, b = color
    sym_r = size * 0.25

    if symbol in ('expand', 'void', 'void2'):
        # 扩展/虚空：同心圆+向外箭头
        for i in range(3):
            r_val = sym_r * (0.3 + i * 0.35)
            draw.ellipse([cx - r_val, cy - r_val, cx + r_val, cy + r_val],
                        outline=(r, g, b, 180 - i * 40), width=1)
        if symbol == 'expand':
            for i in range(4):
                angle = math.radians(i * 90)
                ex = cx + math.cos(angle) * sym_r
                ey = cy + math.sin(angle) * sym_r
                draw.line([(cx, cy), (ex, ey)], fill=(r, g, b, 160), width=1)

    elif symbol == 'spiral':
        # 螺旋
        pts = []
        for t in range(0, 360 * 3, 10):
            angle = math.radians(t)
            radius = sym_r * t / (360 * 3)
            pts.append((cx + math.cos(angle) * radius, cy + math.sin(angle) * radius))
        if len(pts) >= 2:
            draw.line(pts, fill=(r, g, b, 180), width=1)

    elif symbol == 'dove':
        # 鸽子（简化：翅膀弧线）
        draw.arc([cx - sym_r, cy - sym_r * 0.5, cx, cy + sym_r * 0.5],
                start=0, end=180, fill=(r, g, b, 200), width=2)
        draw.arc([cx, cy - sym_r * 0.5, cx + sym_r, cy + sym_r * 0.5],
                start=0, end=180, fill=(r, g, b, 200), width=2)

    elif symbol == 'sparkle':
        # 星光
        for i in range(8):
            angle = math.radians(i * 45)
            length = sym_r if i % 2 == 0 else sym_r * 0.5
            ex = cx + math.cos(angle) * length
            ey = cy + math.sin(angle) * length
            draw.line([(cx, cy), (ex, ey)], fill=(r, g, b, 200), width=2 if i % 2 == 0 else 1)

    elif symbol == 'beam':
        # 光束
        for i in range(3):
            y_off = (i - 1) * 5
            draw.line([(cx - sym_r, cy + y_off), (cx + sym_r, cy + y_off)],
                     fill=(r, g, b, 200 - abs(i - 1) * 80), width=2 if i == 1 else 1)

    elif symbol == 'drop':
        # 水滴
        draw.ellipse([cx - sym_r * 0.5, cy, cx + sym_r * 0.5, cy + sym_r],
                    fill=(r, g, b, 200))
        pts = [(cx - sym_r * 0.5, cy + sym_r * 0.2), (cx, cy - sym_r * 0.5),
               (cx + sym_r * 0.5, cy + sym_r * 0.2)]
        draw.polygon(pts, fill=(r, g, b, 200))

    elif symbol == 'hex':
        # 六边形
        pts = []
        for i in range(6):
            angle = math.radians(i * 60 - 30)
            pts.append((cx + math.cos(angle) * sym_r, cy + math.sin(angle) * sym_r))
        draw.polygon(pts, outline=(r, g, b, 220), width=2)
        draw.polygon(pts[:3] + [pts[0]], outline=(r, g, b, 100), width=1)

    elif symbol == 'time':
        # 沙漏
        draw.polygon([(cx - sym_r * 0.6, cy - sym_r), (cx + sym_r * 0.6, cy - sym_r),
                      (cx, cy)], fill=(r, g, b, 200))
        draw.polygon([(cx - sym_r * 0.6, cy + sym_r), (cx + sym_r * 0.6, cy + sym_r),
                      (cx, cy)], fill=(r, g, b, 160))

    elif symbol == 'twin':
        # 双子（两个小圆）
        draw.ellipse([cx - sym_r - 4, cy - sym_r * 0.5, cx - 4, cy + sym_r * 0.5],
                    fill=(r, g, b, 200))
        draw.ellipse([cx + 4, cy - sym_r * 0.5, cx + sym_r + 4, cy + sym_r * 0.5],
                    fill=(r, g, b, 200))
        draw.line([(cx - 4, cy), (cx + 4, cy)], fill=(r, g, b, 160), width=1)

    elif symbol in ('split', 'atom'):
        # 分裂/原子
        draw.ellipse([cx - 4, cy - 4, cx + 4, cy + 4], fill=(r, g, b, 240))
        for i in range(3):
            angle = math.radians(i * 120)
            ex = cx + math.cos(angle) * sym_r
            ey = cy + math.sin(angle) * sym_r
            draw.line([(cx, cy), (ex, ey)], fill=(r, g, b, 160), width=1)
            draw.ellipse([ex - 4, ey - 4, ex + 4, ey + 4], fill=(r, g, b, 200))

    elif symbol == 'hammer':
        # 锤子
        draw.rectangle([cx - 4, cy - sym_r * 0.3, cx + 4, cy + sym_r * 0.7],
                      fill=(r, g, b, 200))
        draw.rectangle([cx - sym_r * 0.5, cy - sym_r * 0.7,
                        cx + sym_r * 0.5, cy - sym_r * 0.2],
                      fill=(r, g, b, 220))

    elif symbol in ('ice', 'ice2'):
        # 冰晶
        for i in range(6):
            angle = math.radians(i * 60)
            ex = cx + math.cos(angle) * sym_r
            ey = cy + math.sin(angle) * sym_r
            draw.line([(cx, cy), (ex, ey)], fill=(r, g, b, 200), width=2)

    elif symbol in ('fire', 'fire2'):
        # 火焰
        pts = [(cx, cy - sym_r), (cx + sym_r * 0.5, cy - sym_r * 0.2),
               (cx + sym_r * 0.3, cy + sym_r * 0.5), (cx, cy + sym_r * 0.2),
               (cx - sym_r * 0.3, cy + sym_r * 0.5), (cx - sym_r * 0.5, cy - sym_r * 0.2)]
        draw.polygon(pts, fill=(r, g, b, 220))

    elif symbol == 'bolt':
        # 闪电
        pts = [(cx - sym_r * 0.2, cy - sym_r), (cx + sym_r * 0.3, cy - sym_r * 0.1),
               (cx, cy + sym_r * 0.1), (cx + sym_r * 0.4, cy + sym_r)]
        draw.line(pts, fill=(r, g, b, 240), width=3)

    elif symbol == 'arrow':
        draw.line([(cx - sym_r, cy), (cx + sym_r, cy)], fill=(r, g, b, 220), width=3)
        draw.polygon([(cx + sym_r, cy), (cx + sym_r - 10, cy - 6),
                      (cx + sym_r - 10, cy + 6)], fill=(r, g, b, 240))

    elif symbol in ('scatter', 'scatter2'):
        draw.ellipse([cx - 4, cy - 4, cx + 4, cy + 4], fill=(r, g, b, 240))
        for i in range(5):
            angle = math.radians(i * 72 - 90)
            ex = cx + math.cos(angle) * sym_r
            ey = cy + math.sin(angle) * sym_r
            draw.line([(cx, cy), (ex, ey)], fill=(r, g, b, 160), width=1)
            draw.ellipse([ex - 3, ey - 3, ex + 3, ey + 3], fill=(r, g, b, 200))

    elif symbol == 'sword':
        # 剑
        draw.line([(cx, cy - sym_r), (cx, cy + sym_r * 0.5)], fill=(r, g, b, 220), width=3)
        draw.line([(cx - sym_r * 0.4, cy - sym_r * 0.2), (cx + sym_r * 0.4, cy - sym_r * 0.2)],
                 fill=(r, g, b, 180), width=2)
        draw.polygon([(cx, cy - sym_r), (cx - 4, cy - sym_r + 12), (cx + 4, cy - sym_r + 12)],
                    fill=(r, g, b, 240))

    elif symbol == 'explosion':
        for i in range(8):
            angle = math.radians(i * 45)
            ex = cx + math.cos(angle) * sym_r
            ey = cy + math.sin(angle) * sym_r
            draw.line([(cx, cy), (ex, ey)], fill=(r, g, b, 180), width=2)
        draw.ellipse([cx - 8, cy - 8, cx + 8, cy + 8], fill=(r, g, b, 240))

    elif symbol == 'rainbow':
        # 彩虹棱柱
        for i, c in enumerate([(255, 80, 80), (255, 160, 40), (255, 220, 40),
                                 (80, 220, 80), (40, 160, 255), (160, 80, 255)]):
            draw.arc([cx - sym_r + i * 3, cy - sym_r + i * 3,
                      cx + sym_r - i * 3, cy + sym_r - i * 3],
                    start=180, end=0, fill=(*c, 180), width=2)

    elif symbol == 'nest':
        # 套娃（同心圆）
        for i in range(3):
            r_val = sym_r * (0.3 + i * 0.35)
            draw.ellipse([cx - r_val, cy - r_val, cx + r_val, cy + r_val],
                        outline=(r, g, b, 200 - i * 50), width=2)

    elif symbol == 'tri':
        pts = [(cx, cy - sym_r), (cx + sym_r * 0.87, cy + sym_r * 0.5),
               (cx - sym_r * 0.87, cy + sym_r * 0.5)]
        draw.polygon(pts, fill=(r, g, b, 200))

    elif symbol == 'dia':
        pts = [(cx, cy - sym_r), (cx + sym_r, cy), (cx, cy + sym_r), (cx - sym_r, cy)]
        draw.polygon(pts, fill=(r, g, b, 200))

    elif symbol == 'wave':
        pts = []
        for i in range(0, int(sym_r * 2) + 1, 4):
            x = cx - sym_r + i
            y = cy + math.sin(i * math.pi / sym_r) * sym_r * 0.4
            pts.append((x, y))
        if len(pts) >= 2:
            draw.line(pts, fill=(r, g, b, 200), width=2)

    elif symbol == 'reflect':
        # 镜像（左右对称线）
        draw.line([(cx, cy - sym_r), (cx, cy + sym_r)], fill=(r, g, b, 200), width=2)
        for i in range(3):
            y_off = (i - 1) * sym_r * 0.4
            draw.line([(cx - sym_r * 0.6, cy + y_off), (cx - 4, cy + y_off)],
                     fill=(r, g, b, 180), width=1)
            draw.line([(cx + 4, cy + y_off), (cx + sym_r * 0.6, cy + y_off)],
                     fill=(r, g, b, 180), width=1)

    elif symbol == 'measure':
        # 量尺
        draw.rectangle([cx - sym_r, cy - 4, cx + sym_r, cy + 4], fill=(r, g, b, 200))
        for i in range(5):
            x = cx - sym_r + i * sym_r // 2
            draw.line([(x, cy - 8), (x, cy + 8)], fill=(r, g, b, 180), width=1)

    elif symbol in ('bounce', 'pierce'):
        if symbol == 'bounce':
            draw.arc([cx - sym_r, cy - sym_r * 0.3, cx, cy + sym_r * 0.7],
                    start=180, end=0, fill=(r, g, b, 220), width=2)
            draw.arc([cx, cy - sym_r * 0.3, cx + sym_r, cy + sym_r * 0.7],
                    start=180, end=0, fill=(r, g, b, 220), width=2)
        else:
            draw.line([(cx - sym_r, cy), (cx + sym_r, cy)], fill=(r, g, b, 220), width=3)
            draw.polygon([(cx + sym_r, cy), (cx + sym_r - 10, cy - 6),
                          (cx + sym_r - 10, cy + 6)], fill=(r, g, b, 240))

    elif symbol == 'power':
        # 能量符号（圆弧+竖线）
        draw.arc([cx - sym_r * 0.7, cy - sym_r * 0.7, cx + sym_r * 0.7, cy + sym_r * 0.7],
                start=120, end=60, fill=(r, g, b, 220), width=3)
        draw.line([(cx, cy - sym_r * 0.7), (cx, cy - sym_r * 0.2)],
                 fill=(r, g, b, 220), width=3)

    elif symbol == 'alchemy':
        # 炼金管（三角+圆）
        pts = [(cx, cy - sym_r), (cx + sym_r * 0.7, cy + sym_r * 0.5),
               (cx - sym_r * 0.7, cy + sym_r * 0.5)]
        draw.polygon(pts, outline=(r, g, b, 200), width=2)
        draw.ellipse([cx - 6, cy - 6, cx + 6, cy + 6], fill=(r, g, b, 220))

    elif symbol in ('pouch', 'chest', 'key', 'pillar'):
        if symbol == 'pouch':
            draw.ellipse([cx - sym_r * 0.6, cy - sym_r * 0.3,
                          cx + sym_r * 0.6, cy + sym_r * 0.7], fill=(r, g, b, 200))
            draw.line([(cx - sym_r * 0.3, cy - sym_r * 0.3), (cx, cy - sym_r * 0.7),
                       (cx + sym_r * 0.3, cy - sym_r * 0.3)], fill=(r, g, b, 180), width=2)
        elif symbol == 'chest':
            draw.rectangle([cx - sym_r * 0.7, cy - sym_r * 0.3,
                            cx + sym_r * 0.7, cy + sym_r * 0.5], fill=(r, g, b, 200))
            draw.rectangle([cx - sym_r * 0.7, cy - sym_r * 0.6,
                            cx + sym_r * 0.7, cy - sym_r * 0.3], fill=(r, g, b, 180))
            draw.ellipse([cx - 5, cy - 5, cx + 5, cy + 5], fill=(255, 220, 80, 220))
        elif symbol == 'key':
            draw.ellipse([cx - sym_r * 0.4, cy - sym_r * 0.6,
                          cx + sym_r * 0.4, cy + sym_r * 0.2], outline=(r, g, b, 220), width=3)
            draw.line([(cx, cy + sym_r * 0.2), (cx, cy + sym_r * 0.7)],
                     fill=(r, g, b, 220), width=3)
            draw.line([(cx, cy + sym_r * 0.5), (cx + 8, cy + sym_r * 0.5)],
                     fill=(r, g, b, 180), width=2)
        else:  # pillar
            draw.rectangle([cx - 10, cy - sym_r, cx + 10, cy + sym_r], fill=(r, g, b, 200))
            draw.rectangle([cx - sym_r * 0.5, cy - sym_r, cx + sym_r * 0.5, cy - sym_r + 8],
                          fill=(r, g, b, 220))

    elif symbol == 'blood':
        # 血刃
        pts = [(cx, cy - sym_r), (cx + 6, cy + sym_r * 0.5), (cx - 6, cy + sym_r * 0.5)]
        draw.polygon(pts, fill=(r, g, b, 220))
        draw.ellipse([cx - 4, cy + sym_r * 0.3, cx + 4, cy + sym_r * 0.7],
                    fill=(200, 40, 60, 200))

    else:
        # 通用：圆形
        draw.ellipse([cx - sym_r, cy - sym_r, cx + sym_r, cy + sym_r],
                    fill=(r, g, b, 180))


def make_relic_icon(relic_id, rarity, theme, size=SIZE):
    img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    
    cx, cy = size // 2, size // 2
    base_r = size // 2 - 4
    color = theme['color']
    r, g, b = color
    border_bright, border_dark = RARITY_BORDER.get(rarity, RARITY_BORDER['common'])

    # 底板（圆角方形）
    draw.rounded_rectangle([2, 2, size - 3, size - 3], radius=12,
                           fill=(20, 25, 40, 230))

    # 内部纹理
    for i in range(0, size, 8):
        alpha = 15
        draw.line([(0, i), (size, i)], fill=(r // 4, g // 4, b // 4, alpha))

    # 稀有度边框（多层）
    bb_r, bb_g, bb_b = border_bright
    bd_r, bd_g, bd_b = border_dark
    for i, alpha in enumerate([60, 120, 200]):
        offset = i
        draw.rounded_rectangle([offset, offset, size - 1 - offset, size - 1 - offset],
                               radius=12 - offset,
                               outline=(bb_r, bb_g, bb_b, alpha), width=1)

    # 发光层
    for i in range(8, 0, -1):
        alpha = int(60 * (i / 8) ** 2)
        draw.rounded_rectangle([i, i, size - 1 - i, size - 1 - i],
                               radius=12,
                               outline=(bb_r, bb_g, bb_b, alpha), width=1)

    # 传说级：四角金色装饰
    if rarity == 'legendary':
        corner_pts = [(8, 8), (size - 9, 8), (8, size - 9), (size - 9, size - 9)]
        for cpx, cpy in corner_pts:
            draw.ellipse([cpx - 3, cpy - 3, cpx + 3, cpy + 3], fill=(bb_r, bb_g, bb_b, 200))

    # 诅咒级：锯齿边框
    elif rarity == 'cursed':
        for i in range(0, size, 8):
            y_pos = 2 if i % 16 == 0 else 5
            draw.point((i, y_pos), fill=(bb_r, bb_g, bb_b, 120))

    # 绘制遗物符号
    draw_relic_symbol(draw, cx, cy, theme['symbol'], color, size)

    # 高光
    draw.arc([6, 6, size // 2 + 10, size // 2 + 10],
             start=200, end=320, fill=(255, 255, 255, 60), width=2)

    path = os.path.join(OUT, f'{relic_id}.png')
    img.save(path)
    print(f"  ✓ {relic_id}.png  [{rarity}]")


# 遗物列表（id, rarity）
RELICS = [
    ('gigantism_relic', 'rare'), ('chaos_essence', 'legendary'), ('pure_essence', 'legendary'),
    ('dimension_shard', 'rare'), ('dimension_crystal', 'legendary'), ('stars_shines', 'rare'),
    ('optical_lens', 'legendary'), ('pink_slime', 'common'), ('energy_shield', 'cursed'),
    ('unlock_recall', 'rare'), ('unlock_multicast', 'rare'), ('unlock_split', 'rare'),
    ('slot_expander', 'common'), ('cryo_stone', 'rare'), ('pyro_stone', 'rare'),
    ('lightning_stone', 'rare'), ('tactical_kit_pierce', 'legendary'), ('tactical_kit_scatter', 'legendary'),
    ('tactical_kit_damage', 'common'), ('explosive_ammo', 'rare'), ('prism_shard', 'legendary'),
    ('russian_doll', 'legendary'), ('triangle_formation', 'rare'), ('diamond_formation', 'legendary'),
    ('sparse_interval', 'rare'), ('mirror_sync', 'legendary'), ('wide_narrow', 'common'),
    ('surge_bounce', 'rare'), ('surge_pierce', 'cursed'), ('surge_scatter', 'legendary'),
    ('surge_damage', 'rare'), ('surge_cryo', 'rare'), ('surge_pyro', 'rare'),
    ('alchemist_powder_tube', 'common'), ('smuggler_pouch_common', 'common'),
    ('smuggler_chest_rare', 'rare'), ('smuggler_vault_epic', 'epic'),
    ('smuggler_sanctum_legendary', 'legendary'), ('desperation_blade', 'cursed'),
]

for relic_id, rarity in RELICS:
    theme = RELIC_THEMES.get(relic_id, {'shape': 'orb', 'color': (120, 120, 160), 'symbol': 'generic'})
    make_relic_icon(relic_id, rarity, theme)

print(f"✅ Task 5.A7 遗物图标生成完毕！共 {len(RELICS)} 个")
