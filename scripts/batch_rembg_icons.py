"""
批量 rembg 抠图 + 缩放脚本
处理 ammo (32×32)、rune (48×48)、relic (64×64) 图标
"""
import os
import glob
from PIL import Image

try:
    from rembg import remove, new_session
    session = new_session('u2net')
    print("rembg session created")
except Exception as e:
    print(f"rembg import error: {e}")
    exit(1)

BASE = '/home/ubuntu/echo-alchemist-v2/assets/icons'

# (目录, 目标尺寸)
tasks = [
    (f'{BASE}/ammo',  32),
    (f'{BASE}/rune',  48),
    (f'{BASE}/relic', 64),
]

total = 0
success = 0
errors = []

for dir_path, target_size in tasks:
    raw_files = glob.glob(f'{dir_path}/*_raw.png')
    print(f"\n处理 {dir_path} ({target_size}px) — {len(raw_files)} 个文件")
    
    for raw_path in sorted(raw_files):
        basename = os.path.basename(raw_path)
        # 输出文件名：去掉 _raw 后缀
        out_name = basename.replace('_raw.png', '.png')
        out_path = os.path.join(dir_path, out_name)
        
        total += 1
        try:
            # 读取原图
            img = Image.open(raw_path).convert('RGBA')
            
            # rembg 抠图
            result = remove(img, session=session)
            
            # 缩放到目标尺寸
            result = result.resize((target_size, target_size), Image.LANCZOS)
            
            # 保存
            result.save(out_path)
            success += 1
            print(f"  ✓ {out_name}")
        except Exception as e:
            errors.append((raw_path, str(e)))
            print(f"  ✗ {basename}: {e}")

print(f"\n完成: {success}/{total} 成功")
if errors:
    print("失败列表:")
    for p, e in errors:
        print(f"  {p}: {e}")
