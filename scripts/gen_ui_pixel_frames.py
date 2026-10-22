"""gen_ui_pixel_frames.py - [REQ-20261022-wave-loop S2] 程序化绘制像素 UI 9 宫格边框。

依据 docs/design/art_vfx_ui_direction_v1.md §2.2 / §6.1：1 美术像素 = 2 CSS px，9 宫格切 4 美术像素，
CSS 端 border-image-slice: 4; border-image-width: 8px; image-rendering: pixelated。
颜色与 src/styles/ui_tokens.css 的角色色保持一致（描边 / 背景 0-3 / 能量）。

输出（12×12 美术像素，可重复运行，结果逐字节一致）：
  assets/ui/pixel/panel_frame.png      面板：描边 + 亮上沿 + 暗下沿
  assets/ui/pixel/button_frame.png     按钮：更亮的斜面
  assets/ui/pixel/button_primary.png   主按钮（开战）：能量色斜面
  assets/ui/pixel/slot_frame.png       空位 / 锁定：虚线描边

用法：python scripts/gen_ui_pixel_frames.py
"""
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "assets" / "ui" / "pixel"

OUTLINE = (11, 13, 20, 255)
BG0 = (17, 20, 31, 255)
BG1 = (26, 31, 46, 255)
BG2 = (42, 50, 71, 255)
BG3 = (66, 79, 107, 255)
ENERGY = (245, 197, 66, 255)
ENERGY_DARK = (163, 112, 25, 255)
CLEAR = (0, 0, 0, 0)
N = 12


def frame(fill, hi, lo, dashed=False):
    img = Image.new("RGBA", (N, N), CLEAR)
    px = img.load()
    for y in range(N):
        for x in range(N):
            edge = x in (0, N - 1) or y in (0, N - 1)
            corner = (x in (0, N - 1)) and (y in (0, N - 1))
            if corner:
                continue  # 1 像素切角，避免直角发硬
            if edge:
                if dashed and (x + y) % 2 == 1:
                    continue
                px[x, y] = OUTLINE
            elif y == 1 or x == 1:
                px[x, y] = hi
            elif y == N - 2 or x == N - 2:
                px[x, y] = lo
            else:
                px[x, y] = fill
    return img


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    outputs = {
        "panel_frame.png": frame(BG1, BG2, BG0),
        "button_frame.png": frame(BG2, BG3, BG1),
        "button_primary.png": frame(ENERGY, (255, 230, 140, 255), ENERGY_DARK),
        "slot_frame.png": frame(BG0, BG1, BG0, dashed=True),
    }
    for name, img in outputs.items():
        img.save(OUT / name, optimize=False)
        print(f"wrote {OUT / name} {img.size}")


if __name__ == "__main__":
    main()
