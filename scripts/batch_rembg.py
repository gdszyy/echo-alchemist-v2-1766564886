"""
批量 rembg 抠图脚本
对所有 *_raw.png 文件执行绿幕去除，输出透明底 PNG
"""
import os
import subprocess
import sys

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SKILL_SCRIPT = "/home/ubuntu/skills/rembg-cutout/scripts/remove_bg.py"

# 需要抠图的文件列表：(输入路径, 输出路径, 模型)
JOBS = [
    # UI 面板 — 用 isnet-general-use 获得更干净的边缘
    ("assets/ui/panels/top_bar_raw.png",       "assets/ui/panels/top_bar.png",       "isnet-general-use"),
    ("assets/ui/panels/popup_panel_raw.png",   "assets/ui/panels/popup_panel.png",   "isnet-general-use"),
    ("assets/ui/panels/bottom_panel_raw.png",  "assets/ui/panels/bottom_panel.png",  "isnet-general-use"),
    # 稀有度边框
    ("assets/ui/borders/border_legendary_raw.png", "assets/ui/borders/border_legendary.png", "isnet-general-use"),
    ("assets/ui/borders/border_epic_raw.png",      "assets/ui/borders/border_epic.png",      "isnet-general-use"),
    ("assets/ui/borders/border_rare_raw.png",      "assets/ui/borders/border_rare.png",      "isnet-general-use"),
    ("assets/ui/borders/border_common_raw.png",    "assets/ui/borders/border_common.png",    "isnet-general-use"),
    ("assets/ui/borders/border_cursed_raw.png",    "assets/ui/borders/border_cursed.png",    "isnet-general-use"),
    # SP 宝石 & 按钮
    ("assets/ui/sprites/sp_gem_full_raw.png",   "assets/ui/sprites/sp_gem_full.png",   "u2net"),
    ("assets/ui/sprites/sp_gem_empty_raw.png",  "assets/ui/sprites/sp_gem_empty.png",  "u2net"),
    ("assets/ui/sprites/settings_btn_raw.png",  "assets/ui/sprites/settings_btn.png",  "u2net"),
    ("assets/ui/sprites/speed_btn_raw.png",     "assets/ui/sprites/speed_btn.png",     "u2net"),
]

def run_rembg(inp, out, model):
    inp_abs = os.path.join(BASE, inp)
    out_abs = os.path.join(BASE, out)
    os.makedirs(os.path.dirname(out_abs), exist_ok=True)
    
    if not os.path.exists(inp_abs):
        print(f"  ⚠ 跳过（文件不存在）: {inp}")
        return False
    
    cmd = [sys.executable, SKILL_SCRIPT, inp_abs, out_abs, "-m", model]
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode == 0:
        print(f"  ✓ {os.path.basename(out)}  [{model}]")
        return True
    else:
        print(f"  ✗ 失败: {os.path.basename(inp)}")
        print(f"    stderr: {result.stderr[-200:]}")
        return False

print("🔪 开始批量抠图...")
success = 0
for inp, out, model in JOBS:
    if run_rembg(inp, out, model):
        success += 1

print(f"\n✅ 抠图完成：{success}/{len(JOBS)} 个文件处理成功")
