# 像素素材管线（R3 / R6）使用说明

- 状态：provisional（2026-10-22，REQ-20261022-wave-loop）。实现依据 `docs/design/art_vfx_ui_direction_v1.md` §2 / §3 / §5（已采纳：A1 = 1 美术像素 ≈ 2 CSS px；A2 = 路线 C 先过渡 + 路线 A 正式）。
- 证据上限：脚本已在本机（Windows，Python 3.14.5，Pillow 12.2.0）跑通并有单测；**游戏内渲染效果未验证**（本管线不改 `src/`，R1 渲染底座另做）；所有阈值都是起始值。
- 依赖：Python 3 + Pillow。`rembg` 可选（`--rembg`），未装也能用；它的结果依赖模型，不保证逐字节可复现。

## 1. 文件

| 文件 | 作用 |
|---|---|
| `palette.json` / `palette.png` | 固定 46 色索引调色板：1 描边暗色、4 背景中性色、6 条元素 5 阶色带（火 / 冰 / 雷 / 毒 / 激光 / 回响）+ 2 条备用（钢、磨石）、1 白。每色带角色标签 `background` / `interactable` / `feedback` |
| `asset_catalog.json` | 正式素材清单（78 条：敌人 18、精英 19、Boss 8、图标 33），id → 类别 / 键色 / 占格。由 `scripts/pixel_pipeline/asset_catalog.py` 生成 |
| `minimax_prompt_pack.md` | MiniMax 提示词包（同一脚本生成，勿手改） |
| `scripts/pixel_pipeline/pixelize.py` | 单张 / 目录像素化 + 每张一个 JSON 清单 |
| `scripts/pixel_pipeline/check.py` | 机检，退出码 0 / 1 |
| `scripts/pixel_pipeline/contact_sheet.py` | 原图 vs 像素化（按 2 CSS px / 美术像素 × 2 预览 = 4 屏幕像素一格，最近邻）对比图 |
| `scripts/pixel_pipeline/run_all.py` | 批处理：投放文件夹或任务清单 → 像素化 → 机检 → 对比图 |
| `scripts/pixel_pipeline/palette_swatch.py` | 重新生成 `palette.png` |
| `scripts/pixel_pipeline/tests/test_pipeline.py` | 单测（合成图，不依赖仓库素材） |

## 2. 类别（网格 = 碰撞格 × 24 美术像素）

| 类别 | 尺寸 | 色数上限（含描边） | 敌人契约检查 |
|---|---|---|---|
| `enemy_CxR` / `elite_CxR` | 24C × 24R（1×1 = 24×24） | 12 | 是 |
| `boss_CxR` | 24C × 24R（2×2 = 48，3×3 = 72） | 24 | 是 |
| `icon_24` | 24×24（整备界面，显示 48 CSS px） | 10 | 否 |
| `icon_16` | 16×16（战斗 HUD） | 6 | 否 |
| `px_WxH` | 任意 | 32 | 否 |

画面布局：内容区 = 网格 − 4（每边 1px 描边 + 1px 空边），所以 24×24 里轮廓含描边最多 22×22，最外一圈永远透明。默认碰撞框 = 网格 − 2（居中），可用 `--collision WxH` 覆盖。色数上限、碰撞框默认值、「孤立像素」定义都是本管线自定约定，不是规格原文。

## 3. 用法

```bash
# 单张（取精灵表首帧）
python scripts/pixel_pipeline/pixelize.py --in assets/sprites/bosses/boss_ignis.png --src-rect 0,0,256,256 \
    --out tmp/codex/x --class boss_2x2 --id boss_ignis
# MiniMax 绿幕图
python scripts/pixel_pipeline/pixelize.py --in assets_src/minimax/elite_shield_1x1.png --out tmp/codex/x \
    --class elite_1x1 --key-color #00ff00
# 机检
python scripts/pixel_pipeline/check.py tmp/codex/x --report tmp/codex/x/report.json
# 对比图（可加多列变体）
python scripts/pixel_pipeline/contact_sheet.py --in tmp/codex/x --out tmp/codex/x/sheet.png --variant despeckle=tmp/codex/y
# 正式素材批处理（路线 A）
python scripts/pixel_pipeline/run_all.py
# 过渡批处理（路线 C，显式任务清单）
python scripts/pixel_pipeline/run_all.py --jobs tmp/codex/REQ-20261022-wave-loop/pixel_interim/jobs_interim.json --out <dir>
# 改提示词 / 清单后重新生成 md + json
python scripts/pixel_pipeline/asset_catalog.py
# 单测
python scripts/pixel_pipeline/tests/test_pipeline.py
```

`run_all.py` 拒绝写入 `assets/`；默认输出到 `assets_src/pixel_out/`。注意 `assets_src/` 目前**没有**被 `.gitignore` 忽略，要不要提交 MiniMax 原图由 Owner 决定（本线未改 `.gitignore`）。

常用参数：`--despeckle`（把单像素色块并入邻色，保护像素除外）、`--pre-contrast` / `--pre-saturation`（缩小前调色，默认 1.0）、`--anchor bottom`（脚底对齐）、`--layer background|feedback`（限制可用色）、`--no-outline`（发光类反馈）、`--dither bayer4`（只在网格 ≥ 32px 时生效，否则拒绝并记录）、`--protect`（保护蒙版，白 = 眼睛 / 核心 / 词条特征）。

## 4. 自动 vs 人工

**自动（脚本做，逐字节可复现）**：键色 / 透明抠图与去溢色、按内容裁切、预乘 alpha 面积平均缩小（BOX，不从大图最近邻取样）、覆盖率 ≥ 0.45 二值透明、加权 RGB（redmean）最近调色板色、去孤立实心点、色数封顶（最少用的颜色并入最近保留色）、1px 四邻描边、清单（帧矩形、参数、调色板哈希、源与产物 sha256、填充率、出框、孤立像素、色数）、机检、对比图。

**必须人工**（规格 §5.4）：

1. 眼睛 / 脸、核心、词条特征的可读性——自动缩小会把它们糊成 1–2 个像素或直接丢掉。
2. 锯齿与块面清理（孤立像素清单在清单 `metrics.orphan_coords` 里，按坐标修）。
3. Boss 的弱点要做成最亮的连续块；像素破碎血量的保护核心蒙版（约 30% 簇）。
4. 16px 图标逐像素重画（规格：单独手绘，不从 24 缩）。
5. 动画帧（本管线只出首帧 / 单帧）。

人工改完 PNG 后再跑 `check.py`：清单里的 sha256 会对不上，报 `WARN manifest`（预期内，说明被人改过）；其它项必须仍 PASS。

## 5. 验收

| 项 | 判据 | 谁判 |
|---|---|---|
| 机检 | `check.py` 退出码 0：调色板内、尺寸等于类别、alpha ∈ {0,255}、边缘一圈无实心像素、敌人填充率 0.60–0.90 且出框 ≤ 1px、色数不超上限、有清单且含帧矩形 | 脚本 |
| 可复现 | 同输入同参数同 Pillow 版本重跑，PNG 与清单逐字节一致（单测覆盖） | 脚本 |
| 可读性 | 词条特征、Boss 弱点在 4× 预览下能一眼认出 | 人工（对比图） |
| 入库 | 人工确认后才复制进 `assets/`，并同步改运行时加载（不在本管线范围） | Owner |

孤立像素只报警（WARN），不判失败；比例阈值可用 `--orphan-warn-ratio` 调。

## 6. 过渡样张（路线 C，2026-10-22）

`tmp/codex/REQ-20261022-wave-loop/pixel_interim/`（忽略目录，不入库）：4 普通敌人、2 精英、2 Boss 首帧、6 图标。

- 机检：14 张中 0 PASS / 11 WARN / 3 FAIL（`--despeckle` 变体：2 PASS / 9 WARN / 3 FAIL）。FAIL 全是填充率：`elite_haste_1x1` 0.574、`boss_ignis` 0.599、`boss_viridis` 0.501——源图是人形或带散落孢子 / 藤蔓的不规则剪影，等比缩进方形碰撞框后填不满。WARN 全是孤立像素（占内部 6%–27%）。
- 重跑逐字节一致（28 个文件，0 差异）。
- 观感（不下审美结论，只描述）：图标与 Boss 的大块明暗还能辨认；1×1 敌人与精英的核心 / 词条特征基本消失，`affix_haste` 16px 只剩一个暗圆。与 §5.2 样张结论一致：路线 C 只能统一精度，正式素材要走路线 A。

## 7. 未验证与边界

- 游戏内是否清晰取决于 R1 渲染底座（低清缓冲、整数倍放大、关闭平滑），本管线未验证。
- Boss 尺寸：规格 2×2 / 3×3，代码现为 4×3 格（`src/spawn_system.js:2587-2595`），待对齐。
- MiniMax 的种子、参考图、自定义尺寸参数名未核对。
- 调色板颜色是起始值，最终观感需用户看截图确认；改色板会改变调色板哈希，旧清单会报 WARN。
