"""
Task 5.A1 — UI 基础位图素材生成器
生成内容：
  - 顶部状态栏 9-Slice PNG (top_bar_panel.png)
  - 底部弹药栏 9-Slice PNG (bottom_panel.png)
  - 通用弹窗面板 9-Slice PNG (popup_panel.png)
  - 5 种稀有度卡片边框 9-Slice PNG (border_common/rare/epic/legendary/cursed.png)
  - SP 宝石空/满两态 (sp_gem_empty.png / sp_gem_full.png)
  - 设置按钮 (settings_btn.png / settings_btn_active.png)
  - 速度按钮 (speed_btn.png / speed_btn_active.png)

风格：暗黑赛博炼金 — 深色金属底板 + 炼金阵纹边框 + 微发光
9-Slice 规格：128px 边距（四角 128×128 固定，中间拉伸）
"""

from PIL import Image, ImageDraw, ImageFilter
import math
import os

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT_PANELS  = os.path.join(BASE, 'assets', 'ui', 'panels')
OUT_BORDERS = os.path.join(BASE, 'assets', 'ui', 'borders')
OUT_SPRITES = os.path.join(BASE, 'assets', 'ui', 'sprites')

os.makedirs(OUT_PANELS,  exist_ok=True)
os.makedirs(OUT_BORDERS, exist_ok=True)
os.makedirs(OUT_SPRITES, exist_ok=True)

# ─── 颜色常量 ─────────────────────────────────────────────────────────────────
BG_DARK     = (10, 12, 20, 255)        # 近黑深蓝底板
BG_METAL    = (18, 22, 38, 255)        # 金属底色
BORDER_GLOW = (80, 60, 140, 200)       # 默认紫色边框发光
CORNER_GOLD = (120, 90, 40, 255)       # 金色角饰
RUNE_LINE   = (60, 80, 120, 120)       # 炼金阵纹线条

RARITY_COLORS = {
    'common':    ((100, 110, 130), (60, 70, 90),    (140, 150, 170)),   # 铁灰
    'rare':      ((40, 100, 200),  (20, 60, 140),   (80, 160, 255)),    # 蓝色
    'epic':      ((120, 40, 200),  (80, 20, 140),   (180, 80, 255)),    # 紫色
    'legendary': ((200, 150, 20),  (140, 100, 10),  (255, 210, 60)),    # 金色
    'cursed':    ((180, 20, 40),   (120, 10, 20),   (255, 60, 80)),     # 血红
}

def hex_to_rgb(h):
    h = h.lstrip('#')
    return tuple(int(h[i:i+2], 16) for i in (0, 2, 4))

def draw_rounded_rect(draw, x0, y0, x1, y1, r, fill=None, outline=None, width=1):
    """绘制圆角矩形"""
    if fill:
        draw.rounded_rectangle([x0, y0, x1, y1], radius=r, fill=fill, outline=outline, width=width)
    else:
        draw.rounded_rectangle([x0, y0, x1, y1], radius=r, outline=outline, width=width)

def draw_rune_pattern(draw, x, y, w, h, color, density=0.4):
    """在区域内绘制炼金阵纹（六边形网格 + 符文线条）"""
    r, g, b = color
    # 六边形网格
    hex_size = 12
    for gy in range(y, y + h, int(hex_size * 1.5)):
        for gx in range(x, x + w, int(hex_size * 1.73)):
            offset_y = hex_size * 0.75 if ((gx - x) // int(hex_size * 1.73)) % 2 else 0
            cx, cy = gx, gy + offset_y
            if cx < x + w and cy < y + h:
                pts = []
                for i in range(6):
                    angle = math.radians(60 * i - 30)
                    pts.append((cx + hex_size * 0.4 * math.cos(angle),
                                cy + hex_size * 0.4 * math.sin(angle)))
                draw.polygon(pts, outline=(r, g, b, 30))

def draw_corner_ornament(draw, cx, cy, size, color, flip_x=False, flip_y=False):
    """绘制角落炼金装饰（L形金属角）"""
    r, g, b = color
    sx = -1 if flip_x else 1
    sy = -1 if flip_y else 1
    # 外L形
    pts_h = [(cx, cy), (cx + sx * size, cy), (cx + sx * size, cy + sy * 3)]
    pts_v = [(cx, cy), (cx, cy + sy * size), (cx + sx * 3, cy + sy * size)]
    draw.line(pts_h, fill=(r, g, b, 220), width=2)
    draw.line(pts_v, fill=(r, g, b, 220), width=2)
    # 内L形（偏移 4px）
    off = 4
    pts_h2 = [(cx + sx * off, cy + sy * off), (cx + sx * (size - 4), cy + sy * off)]
    pts_v2 = [(cx + sx * off, cy + sy * off), (cx + sx * off, cy + sy * (size - 4))]
    draw.line(pts_h2, fill=(r, g, b, 120), width=1)
    draw.line(pts_v2, fill=(r, g, b, 120), width=1)
    # 角点菱形
    diamond_size = 3
    draw.polygon([
        (cx + sx * 1, cy),
        (cx, cy + sy * 1),
        (cx - sx * 1, cy),
        (cx, cy - sy * 1),
    ], fill=(r, g, b, 200))

def make_glow_layer(size_w, size_h, color, radius=20, alpha_max=80):
    """生成发光边缘层"""
    r, g, b = color
    glow = Image.new('RGBA', (size_w, size_h), (0, 0, 0, 0))
    gd = ImageDraw.Draw(glow)
    # 四边发光条
    for i in range(radius):
        a = int(alpha_max * (1 - i / radius) ** 2)
        gd.rectangle([i, i, size_w - 1 - i, size_h - 1 - i],
                     outline=(r, g, b, a))
    return glow

# ─── 1. 9-Slice 面板生成 ──────────────────────────────────────────────────────

def make_9slice_panel(filename, w, h, border_color, bg_color=BG_METAL,
                      corner_color=None, has_rune=True, glow_alpha=60):
    """
    生成 9-Slice 面板 PNG
    w, h: 总尺寸（建议 384×384 以保证 128px 边距）
    border_color: (r,g,b) 边框主色
    """
    img = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    
    r, g, b = border_color
    br, bg_, bb = bg_color[:3]
    cc = corner_color or border_color

    # 底板（带渐变感的深色金属）
    for y in range(h):
        ratio = y / h
        # 从上到下轻微渐变
        lum = int(br + (bg_ - br) * ratio)
        draw.line([(0, y), (w, y)], fill=(lum, lum, lum + 8, 240))

    # 炼金阵纹（仅在中心区域，不覆盖边框）
    if has_rune:
        draw_rune_pattern(draw, 20, 20, w - 40, h - 40, (r // 3, g // 3, b // 3))

    # 外边框（3层叠加：暗/中/亮）
    border_w = 3
    for i, alpha in enumerate([60, 120, 200]):
        offset = i
        draw.rounded_rectangle(
            [offset, offset, w - 1 - offset, h - 1 - offset],
            radius=8 - offset,
            outline=(r, g, b, alpha),
            width=1
        )

    # 内边框（发光线）
    glow_layer = make_glow_layer(w, h, (r, g, b), radius=16, alpha_max=glow_alpha)
    img = Image.alpha_composite(img, glow_layer)
    draw = ImageDraw.Draw(img)

    # 四角装饰
    corner_size = min(24, w // 6)
    draw_corner_ornament(draw, 8, 8, corner_size, cc)
    draw_corner_ornament(draw, w - 9, 8, corner_size, cc, flip_x=True)
    draw_corner_ornament(draw, 8, h - 9, corner_size, cc, flip_y=True)
    draw_corner_ornament(draw, w - 9, h - 9, corner_size, cc, flip_x=True, flip_y=True)

    # 边框中点装饰（菱形）
    mid_x, mid_y = w // 2, h // 2
    diamond_pts = [
        (mid_x, 3), (mid_x + 4, 7), (mid_x, 11), (mid_x - 4, 7)
    ]
    draw.polygon(diamond_pts, fill=(r, g, b, 180))
    diamond_pts_b = [
        (mid_x, h - 4), (mid_x + 4, h - 8), (mid_x, h - 12), (mid_x - 4, h - 8)
    ]
    draw.polygon(diamond_pts_b, fill=(r, g, b, 180))

    path = os.path.join(OUT_PANELS, filename)
    img.save(path)
    print(f"  ✓ {filename}")
    return img

# 顶部状态栏（宽384×高160，9-Slice 128px边距）
make_9slice_panel('top_bar_panel.png', 384, 160,
                  border_color=(80, 100, 160),
                  bg_color=(15, 18, 32),
                  corner_color=(100, 120, 180),
                  glow_alpha=50)

# 底部弹药栏（宽384×高160）
make_9slice_panel('bottom_panel.png', 384, 160,
                  border_color=(60, 80, 140),
                  bg_color=(12, 16, 28),
                  corner_color=(90, 110, 160),
                  glow_alpha=45)

# 通用弹窗面板（384×384）
make_9slice_panel('popup_panel.png', 384, 384,
                  border_color=(100, 60, 180),
                  bg_color=(14, 10, 28),
                  corner_color=(140, 90, 220),
                  glow_alpha=70)

print("✅ 面板生成完成")

# ─── 2. 5 种稀有度卡片边框 ────────────────────────────────────────────────────

def make_rarity_border(rarity_name, w=256, h=320):
    """
    生成稀有度卡片边框 9-Slice PNG
    w×h: 卡片尺寸（256×320，9-Slice 128px边距）
    """
    mid_c, dark_c, bright_c = RARITY_COLORS[rarity_name]
    
    img = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    r, g, b = mid_c
    dr, dg, db = dark_c
    br2, bg2, bb2 = bright_c

    # 底板（透明度较低，保留 CSS 背景透出）
    draw.rounded_rectangle([0, 0, w - 1, h - 1], radius=10,
                           fill=(dr, dg, db, 200))

    # 炼金阵纹
    draw_rune_pattern(draw, 8, 8, w - 16, h - 16, (r // 2, g // 2, b // 2))

    # 多层边框（由外到内：暗→亮）
    for i, (alpha, lw) in enumerate([(80, 3), (150, 2), (220, 1)]):
        offset = i * 1
        draw.rounded_rectangle(
            [offset, offset, w - 1 - offset, h - 1 - offset],
            radius=10 - offset,
            outline=(br2, bg2, bb2, alpha),
            width=lw
        )

    # 发光层
    glow = make_glow_layer(w, h, (r, g, b), radius=12, alpha_max=80)
    img = Image.alpha_composite(img, glow)
    draw = ImageDraw.Draw(img)

    # 四角装饰
    corner_size = 18
    draw_corner_ornament(draw, 6, 6, corner_size, bright_c)
    draw_corner_ornament(draw, w - 7, 6, corner_size, bright_c, flip_x=True)
    draw_corner_ornament(draw, 6, h - 7, corner_size, bright_c, flip_y=True)
    draw_corner_ornament(draw, w - 7, h - 7, corner_size, bright_c, flip_x=True, flip_y=True)

    # 稀有度特殊装饰
    if rarity_name == 'legendary':
        # 顶部金色横线
        for i in range(3):
            y_pos = 4 + i * 2
            alpha = 200 - i * 60
            draw.line([(20, y_pos), (w - 20, y_pos)], fill=(br2, bg2, bb2, alpha), width=1)
    elif rarity_name == 'epic':
        # 顶部菱形链
        for i in range(5):
            cx = w // 2 + (i - 2) * 12
            draw.polygon([(cx, 3), (cx + 3, 6), (cx, 9), (cx - 3, 6)],
                        fill=(br2, bg2, bb2, 160))
    elif rarity_name == 'cursed':
        # 顶部锯齿（诅咒感）
        pts = []
        for i in range(0, w, 8):
            pts.append((i, 2 if i % 16 == 0 else 6))
        if len(pts) >= 2:
            draw.line(pts, fill=(br2, bg2, bb2, 120), width=1)

    path = os.path.join(OUT_BORDERS, f'border_{rarity_name}.png')
    img.save(path)
    print(f"  ✓ border_{rarity_name}.png")

for rarity in ['common', 'rare', 'epic', 'legendary', 'cursed']:
    make_rarity_border(rarity)

print("✅ 稀有度边框生成完成")

# ─── 3. SP 宝石（空/满两态）────────────────────────────────────────────────────

def make_sp_gem(filename, is_full=False, size=48):
    """生成 SP 宝石 Sprite（48×48，实际显示 24×24 可缩放）"""
    img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    
    cx, cy = size // 2, size // 2
    gem_r = size // 2 - 4

    if is_full:
        # 满状态：翠绿发光菱形宝石
        # 外发光
        for i in range(8, 0, -1):
            alpha = int(120 * (i / 8) ** 2)
            pts = [(cx, cy - gem_r - i), (cx + gem_r + i, cy),
                   (cx, cy + gem_r + i), (cx - gem_r - i, cy)]
            draw.polygon(pts, fill=(0, 200, 100, alpha))
        # 宝石主体（渐变感）
        pts = [(cx, cy - gem_r), (cx + gem_r, cy), (cx, cy + gem_r), (cx - gem_r, cy)]
        draw.polygon(pts, fill=(0, 220, 120, 240))
        # 高光
        pts_hl = [(cx, cy - gem_r + 2), (cx + gem_r // 2, cy - 2),
                  (cx, cy - 4), (cx - gem_r // 2, cy - 2)]
        draw.polygon(pts_hl, fill=(180, 255, 220, 160))
        # 内核
        draw.ellipse([cx - 4, cy - 4, cx + 4, cy + 4], fill=(200, 255, 200, 200))
    else:
        # 空状态：暗淡晶体凹槽
        pts = [(cx, cy - gem_r), (cx + gem_r, cy), (cx, cy + gem_r), (cx - gem_r, cy)]
        draw.polygon(pts, fill=(30, 40, 60, 200))
        draw.polygon(pts, outline=(60, 80, 100, 160), width=1)
        # 内部暗纹
        pts_inner = [(cx, cy - gem_r + 4), (cx + gem_r - 4, cy),
                     (cx, cy + gem_r - 4), (cx - gem_r + 4, cy)]
        draw.polygon(pts_inner, outline=(50, 70, 90, 80), width=1)

    img.save(os.path.join(OUT_SPRITES, filename))
    print(f"  ✓ {filename}")

make_sp_gem('sp_gem_empty.png', is_full=False)
make_sp_gem('sp_gem_full.png',  is_full=True)
print("✅ SP 宝石生成完成")

# ─── 4. 功能按钮（设置/速度）────────────────────────────────────────────────────

def make_button(filename, symbol_type='gear', is_active=False, size=80):
    """生成圆形金属按钮（80×80，实际显示 40×40 可缩放）"""
    img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    
    cx, cy = size // 2, size // 2
    btn_r = size // 2 - 4

    # 按钮外发光
    glow_color = (100, 160, 255) if is_active else (60, 80, 120)
    for i in range(6, 0, -1):
        alpha = int(80 * (i / 6) ** 2) if is_active else int(30 * (i / 6) ** 2)
        draw.ellipse([cx - btn_r - i, cy - btn_r - i,
                      cx + btn_r + i, cy + btn_r + i],
                     fill=(*glow_color, alpha))

    # 按钮底座
    base_color = (40, 60, 100) if is_active else (25, 35, 60)
    draw.ellipse([cx - btn_r, cy - btn_r, cx + btn_r, cy + btn_r],
                fill=base_color + (240,))
    
    # 金属边框
    border_color = (100, 140, 220) if is_active else (60, 80, 130)
    draw.ellipse([cx - btn_r, cy - btn_r, cx + btn_r, cy + btn_r],
                outline=border_color + (220,), width=2)
    draw.ellipse([cx - btn_r + 2, cy - btn_r + 2, cx + btn_r - 2, cy + btn_r - 2],
                outline=(*border_color, 100), width=1)

    # 高光（顶部弧形）
    draw.arc([cx - btn_r + 3, cy - btn_r + 3, cx + btn_r - 3, cy + btn_r - 3],
             start=200, end=340, fill=(180, 200, 255, 80), width=2)

    # 符号绘制
    sym_color = (160, 200, 255) if is_active else (100, 130, 180)
    sym_r = btn_r * 0.45

    if symbol_type == 'gear':
        # 齿轮符号
        teeth = 8
        outer_r = sym_r
        inner_r = sym_r * 0.65
        hole_r  = sym_r * 0.25
        pts = []
        for i in range(teeth * 2):
            angle = math.radians(i * 360 / (teeth * 2) - 90)
            r_val = outer_r if i % 2 == 0 else inner_r
            pts.append((cx + r_val * math.cos(angle), cy + r_val * math.sin(angle)))
        draw.polygon(pts, fill=(*sym_color, 220))
        draw.ellipse([cx - hole_r, cy - hole_r, cx + hole_r, cy + hole_r],
                    fill=(25, 35, 60, 255))
        draw.ellipse([cx - hole_r, cy - hole_r, cx + hole_r, cy + hole_r],
                    outline=(*sym_color, 180), width=1)

    elif symbol_type == 'speed':
        # 速度/快进符号（双三角）
        tri_w = sym_r * 0.5
        tri_h = sym_r * 0.8
        # 左三角
        pts1 = [(cx - tri_w * 0.2, cy - tri_h * 0.5),
                (cx - tri_w * 0.2 + tri_w, cy),
                (cx - tri_w * 0.2, cy + tri_h * 0.5)]
        # 右三角
        pts2 = [(cx + tri_w * 0.2, cy - tri_h * 0.5),
                (cx + tri_w * 0.2 + tri_w, cy),
                (cx + tri_w * 0.2, cy + tri_h * 0.5)]
        draw.polygon(pts1, fill=(*sym_color, 220))
        draw.polygon(pts2, fill=(*sym_color, 220))

    img.save(os.path.join(OUT_SPRITES, filename))
    print(f"  ✓ {filename}")

make_button('settings_btn.png',        symbol_type='gear',  is_active=False)
make_button('settings_btn_active.png', symbol_type='gear',  is_active=True)
make_button('speed_btn.png',           symbol_type='speed', is_active=False)
make_button('speed_btn_active.png',    symbol_type='speed', is_active=True)
print("✅ 功能按钮生成完成")

print("\n🎉 Task 5.A1 全部 UI 基础素材生成完毕！")
