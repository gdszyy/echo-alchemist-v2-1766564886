"""
gen_sprite_sheet.py — 从 AI 生成的横排帧图中切割并合并为标准 Sprite Sheet
输出格式：每行一个动画状态，每列一帧，每帧 128×128 px
"""
from PIL import Image
import numpy as np
import os

FRAME_SIZE = 128  # 目标帧尺寸
BASE = '/home/ubuntu/echo-alchemist-v2/assets/sprites/enemies'


def remove_green_screen(img):
    """将绿幕（#00FF00 附近）替换为透明"""
    img = img.convert('RGBA')
    data = np.array(img)
    r, g, b, a = data[:,:,0], data[:,:,1], data[:,:,2], data[:,:,3]
    # 绿幕检测：G > 150 且 G > 1.5*R 且 G > 1.5*B
    green_mask = (g > 150) & (g.astype(int) > r.astype(int) * 1.4) & (g.astype(int) > b.astype(int) * 1.4)
    data[green_mask] = [0, 0, 0, 0]
    return Image.fromarray(data)


def extract_frames_from_strip(strip_path, num_frames, target_size=FRAME_SIZE):
    """
    从横排帧图中提取各帧
    策略：将图片等分为 num_frames 份，每份中心裁取正方形，缩放到 target_size
    """
    img = Image.open(strip_path).convert('RGBA')
    w, h = img.size
    
    # 先移除绿幕
    img = remove_green_screen(img)
    
    # 等分切割
    frame_w = w // num_frames
    frames = []
    for i in range(num_frames):
        x = i * frame_w
        # 取正方形区域（以高度为准）
        square_size = min(frame_w, h)
        x_offset = (frame_w - square_size) // 2
        frame = img.crop((x + x_offset, 0, x + x_offset + square_size, square_size))
        frame = frame.resize((target_size, target_size), Image.LANCZOS)
        frames.append(frame)
    
    return frames


def build_sprite_sheet(animations, output_path, frame_size=FRAME_SIZE):
    """
    构建 Sprite Sheet
    animations: list of (strip_path, num_frames, row_label)
    输出：每行一个动画，每列一帧
    """
    all_rows = []
    max_frames = max(n for _, n, _ in animations)
    
    for strip_path, num_frames, label in animations:
        print(f"  处理 {label}: {strip_path} ({num_frames} 帧)")
        frames = extract_frames_from_strip(strip_path, num_frames)
        
        # 创建这一行的图像（宽度 = max_frames * frame_size，不足的帧用最后一帧填充）
        row_img = Image.new('RGBA', (max_frames * frame_size, frame_size), (0, 0, 0, 0))
        for i, frame in enumerate(frames):
            row_img.paste(frame, (i * frame_size, 0), frame)
        # 不足的帧用最后一帧填充
        if len(frames) < max_frames:
            last_frame = frames[-1]
            for i in range(len(frames), max_frames):
                row_img.paste(last_frame, (i * frame_size, 0), last_frame)
        
        all_rows.append((row_img, label))
    
    # 合并所有行
    sheet_h = len(all_rows) * frame_size
    sheet_w = max_frames * frame_size
    sheet = Image.new('RGBA', (sheet_w, sheet_h), (0, 0, 0, 0))
    
    for row_idx, (row_img, label) in enumerate(all_rows):
        sheet.paste(row_img, (0, row_idx * frame_size), row_img)
        print(f"  行 {row_idx}: {label}")
    
    sheet.save(output_path)
    print(f"✓ Sprite Sheet 已保存: {output_path} ({sheet_w}×{sheet_h})")
    return sheet


# ============================================================
# 普通魔像 Sprite Sheet (Task 5.B1)
# 行0: idle (6帧), 行1: move (4帧), 行2: hit (2帧)
# ============================================================
print("=== 生成普通魔像 Sprite Sheet ===")
golem_animations = [
    (f'{BASE}/golem_idle_raw.png', 6, 'idle'),
    (f'{BASE}/golem_move_raw.png', 4, 'move'),
    (f'{BASE}/golem_hit_raw.png',  2, 'hit'),
]
build_sprite_sheet(golem_animations, f'{BASE}/golem_normal.png')

# 生成 JSON 元数据（供 SpriteRenderer 使用）
import json
golem_meta = {
    "frameSize": FRAME_SIZE,
    "animations": {
        "idle":  {"row": 0, "frames": 6, "fps": 8},
        "move":  {"row": 1, "frames": 4, "fps": 10},
        "hit":   {"row": 2, "frames": 2, "fps": 12},
    }
}
with open(f'{BASE}/golem_normal.json', 'w') as f:
    json.dump(golem_meta, f, indent=2)
print(f"✓ 元数据已保存: {BASE}/golem_normal.json")

# ============================================================
# 精英魔像 Sprite Sheet (Task 5.B4)
# 行0: idle (8帧), 行1: move (6帧), 行2: hit (3帧), 行3: cast (4帧)
# ============================================================
print("\n=== 生成精英魔像 Sprite Sheet ===")
elite_animations = [
    (f'{BASE}/golem_elite_idle_raw.png', 8, 'idle'),
    (f'{BASE}/golem_elite_move_raw.png', 6, 'move'),
    (f'{BASE}/golem_elite_hit_raw.png',  3, 'hit'),
    (f'{BASE}/golem_elite_cast_raw.png', 4, 'cast'),
]
build_sprite_sheet(elite_animations, f'{BASE}/golem_elite.png')

elite_meta = {
    "frameSize": FRAME_SIZE,
    "animations": {
        "idle":  {"row": 0, "frames": 8, "fps": 8},
        "move":  {"row": 1, "frames": 6, "fps": 10},
        "hit":   {"row": 2, "frames": 3, "fps": 14},
        "cast":  {"row": 3, "frames": 4, "fps": 8},
    }
}
with open(f'{BASE}/golem_elite.json', 'w') as f:
    json.dump(elite_meta, f, indent=2)
print(f"✓ 元数据已保存: {BASE}/golem_elite.json")
