"""
gen_boss_sprites.py — Boss Sprite Sheet 生成脚本
1. 对 raw 目录下的绿幕图进行 rembg 抠图
2. 将每张横向行图切割为 6 帧
3. 每帧缩放到 256×256（Boss 高精度规格）
4. 合并为单行 Sprite Sheet（6×1 = 1536×256）
5. 生成对应 JSON 元数据

[Phase C Task 5.C1~5.C8]
"""
import os
import json
from PIL import Image
import numpy as np

# ─── 配置 ────────────────────────────────────────────────────────────────────
RAW_DIR  = '/home/ubuntu/echo-alchemist-v2/assets/sprites/bosses/raw'
OUT_DIR  = '/home/ubuntu/echo-alchemist-v2/assets/sprites/bosses'
FRAME_SIZE = 256   # Boss 帧尺寸（高精度）
FRAMES_PER_ROW = 6  # 每张参考图的帧数

BOSSES = ['ignis', 'glacies', 'mikro', 'devourer', 'viridis', 'tesla', 'chimera', 'ouroboros']

os.makedirs(OUT_DIR, exist_ok=True)

# ─── rembg 抠图 ───────────────────────────────────────────────────────────────
try:
    from rembg import remove
    REMBG_AVAILABLE = True
    print("✓ rembg 可用，将进行绿幕抠图")
except ImportError:
    REMBG_AVAILABLE = False
    print("⚠ rembg 不可用，跳过抠图（直接使用原图）")

def chroma_key_remove(img: Image.Image, threshold: int = 80) -> Image.Image:
    """基于色度键（绿幕）移除背景，返回 RGBA 图像"""
    img = img.convert('RGBA')
    data = np.array(img, dtype=np.float32)
    r, g, b, a = data[:,:,0], data[:,:,1], data[:,:,2], data[:,:,3]
    # 绿幕判定：G 明显大于 R 和 B
    green_mask = (g > r + threshold) & (g > b + threshold) & (g > 100)
    data[:,:,3] = np.where(green_mask, 0, 255)
    return Image.fromarray(data.astype(np.uint8), 'RGBA')

def remove_background(img: Image.Image) -> Image.Image:
    """优先使用 rembg，fallback 到色度键"""
    if REMBG_AVAILABLE:
        try:
            return remove(img)
        except Exception as e:
            print(f"  rembg 失败: {e}，使用色度键 fallback")
    return chroma_key_remove(img)

# ─── 切帧 + 合并 ──────────────────────────────────────────────────────────────
def process_boss(boss_id: str):
    raw_path = os.path.join(RAW_DIR, f'{boss_id}_idle_raw.png')
    if not os.path.exists(raw_path):
        print(f"⚠ 跳过 {boss_id}：原图不存在 ({raw_path})")
        return

    print(f"\n=== 处理 {boss_id} ===")
    src = Image.open(raw_path).convert('RGBA')
    W, H = src.size
    print(f"  原图尺寸: {W}×{H}")

    # 1. 抠图
    print(f"  正在抠图...")
    src_nobg = remove_background(src)

    # 2. 切割为 6 帧（横向等分）
    frame_w = W // FRAMES_PER_ROW
    frames = []
    for i in range(FRAMES_PER_ROW):
        x0 = i * frame_w
        x1 = x0 + frame_w
        frame = src_nobg.crop((x0, 0, x1, H))
        # 缩放到 FRAME_SIZE × FRAME_SIZE
        frame = frame.resize((FRAME_SIZE, FRAME_SIZE), Image.LANCZOS)
        frames.append(frame)
        print(f"  帧 {i}: ({x0},{0})-({x1},{H}) → {FRAME_SIZE}×{FRAME_SIZE}")

    # 3. 合并为 Sprite Sheet（单行，6 帧）
    sheet_w = FRAME_SIZE * FRAMES_PER_ROW
    sheet_h = FRAME_SIZE
    sheet = Image.new('RGBA', (sheet_w, sheet_h), (0, 0, 0, 0))
    for i, frame in enumerate(frames):
        sheet.paste(frame, (i * FRAME_SIZE, 0), frame)

    # 4. 保存 Sprite Sheet
    out_path = os.path.join(OUT_DIR, f'boss_{boss_id}.png')
    sheet.save(out_path, 'PNG')
    print(f"  ✓ Sprite Sheet 已保存: {out_path} ({sheet_w}×{sheet_h})")

    # 5. 生成 JSON 元数据
    meta = {
        "frameSize": FRAME_SIZE,
        "animations": {
            "idle": {"row": 0, "frames": FRAMES_PER_ROW, "fps": 6}
        }
    }
    meta_path = os.path.join(OUT_DIR, f'boss_{boss_id}.json')
    with open(meta_path, 'w') as f:
        json.dump(meta, f, indent=2)
    print(f"  ✓ 元数据已保存: {meta_path}")

# ─── 主流程 ───────────────────────────────────────────────────────────────────
print(f"开始处理 {len(BOSSES)} 个 Boss Sprite Sheet...\n")
for boss_id in BOSSES:
    try:
        process_boss(boss_id)
    except Exception as e:
        print(f"✗ {boss_id} 处理失败: {e}")

print("\n=== 全部完成 ===")
print(f"输出目录: {OUT_DIR}")
for boss_id in BOSSES:
    out_path = os.path.join(OUT_DIR, f'boss_{boss_id}.png')
    if os.path.exists(out_path):
        img = Image.open(out_path)
        print(f"  ✓ boss_{boss_id}.png  {img.size[0]}×{img.size[1]}")
    else:
        print(f"  ✗ boss_{boss_id}.png  (未生成)")
