# MiniMax 提示词包（路线 A：正式素材）

> 由 `scripts/pixel_pipeline/asset_catalog.py` 生成，**不要手改本文件**；改条目请改脚本后重跑 `python scripts/pixel_pipeline/asset_catalog.py`。同时生成 `asset_catalog.json`（`run_all.py` 按它把 id 映射到类别）。
>
> 状态：provisional。依据 `docs/design/art_vfx_ui_direction_v1.md` §2 / §3 / §5（A1 = 1 美术像素 ≈ 2 CSS px，A2 = A + C）。不判断好不好看；MiniMax 的具体参数名（种子、参考图、尺寸）本线**未核对**，以你手上的 MiniMax 入口为准。

## 1. 全局风格块（每条提示词已内嵌，单独列出便于统一修改）

**中文**：像素画友好的游戏素材概念图，正交 3/4 俯视角，平涂无光照，无投影、无渐变、无轮廓光、无发光，单一主体居中占画面约 80%，粗而干净的剪影与深色粗描边，大色块，最多 6 种颜色，纯色背景 #00FF00，无文字无字母无 UI 边框

**English**: pixel-art-ready game sprite concept, orthographic 3/4 top-down view, flat unlit cel colours, no cast shadow, no gradient, no rim light, no glow, single subject centred filling about 80% of the frame, bold clean silhouette with a thick dark outline, large flat colour blocks, at most 6 colours, solid pure #00FF00 background, no text, no letters, no UI frame

**图标版**：像素画友好的游戏 UI 图标概念图，正面正交，平涂无光照，无投影、无渐变、无发光，单一符号居中占画面约 80%，粗剪影与深色粗描边，最多 4–6 种颜色，纯色背景 #00FF00，无文字无数字无边框 / pixel-art-ready game UI icon concept, front orthographic view, flat unlit colours, no shadow, no gradient, no glow, one symbol centred filling about 80% of the frame, bold silhouette with a thick dark outline, at most 4-6 colours, solid pure #00FF00 background, no text, no numbers, no frame

**全局负面提示词**：写实、3D 渲染、照片、渐变、柔光、发光、投影、景深、模糊、噪点纹理、细碎细节、多个主体、文字、水印、边框、背景场景 / photorealistic, 3d render, photo, gradient, soft lighting, glow, bloom, drop shadow, depth of field, blur, noisy texture, tiny details, multiple subjects, text, watermark, border, background scenery

**规则要点**

- 敌人、精英、Boss：正交 3/4 视角；图标：正面正交。全部平涂、无投影 / 渐变 / 轮廓光 / 发光。
- 单一主体居中约占 80%；剪影要粗；**每个词条只做一个大造型特征**，不画文字徽章（取代 `R:py` / `A:cr`）。
- 背景纯色键控：默认 `#00FF00`；**主体本身是绿色（毒色带）的条目改用 `#FF00FF`**，否则抠图会吃掉主体。这是本管线的约定，与 §5.4「纯色键控背景（不在调色板里）」一致——两种键色都不在调色板里。
- 颜色只给方向（色带名），最终颜色由管线映射到 `palette.json`；生图阶段越少色越好。
- **风格一致性**：先用 `enemy_residue_1x1` 出一张大家认可的「风格锚图」，放到 `assets_src/minimax/_style_ref/style_anchor.png`。之后每条都：(a) 若你的 MiniMax 入口支持参考图 / 主体参考，就挂这张锚图；(b) 若支持种子，整批固定同一个种子（建议 `20261022`）并记录在 `assets_src/minimax/_style_ref/seed.txt`；(c) 两者都不支持时，风格块逐字不改。以上参数是否存在**未核对**。
- 尺寸：按表中「请求尺寸」（与占格同宽高比）；入口不支持该尺寸时出 1:1，管线会按内容裁切后等比缩放，不会拉伸。

## 2. 放置约定与一键命令

1. 生成后把图存为 `assets_src/minimax/<asset_id>.png`（`.jpg` / `.webp` 也认；文件名必须等于下表 id）。
2. 可选：保护蒙版 `assets_src/minimax/<asset_id>.protect.png`（白 = 眼睛 / 核心 / 词条特征，与原图同尺寸），这些像素不会被去噪删掉。
3. 在仓库根目录运行：

```
python scripts/pixel_pipeline/run_all.py
```

默认读 `assets_src/minimax/`，输出到 `assets_src/pixel_out/`（PNG + 每张一个 JSON 清单 + `check_report.json` + `contact_sheet.png`），**不会写 `assets/`**。只跑部分：`python scripts/pixel_pipeline/run_all.py --only boss_ignis,icon_item_bomb`。机检有 FAIL 时退出码为 1。之后的人工修整与入库见 `README.md`。

## 3. 普通敌人（基底 + 原型 + Boss 随从）（18 条）

| id | 名称 | 类别 / 网格 | 占格 | 必须可读的特征 | 色带 | 键色 | 请求尺寸 |
|---|---|---|---|---|---|---|---|
| `enemy_residue_1x1` | 炼金残渣（标准 1×1） | `enemy_1x1` 24×24 | 1×1 | 居中一颗小镶嵌核心 | stone / echo | `#00FF00` | 1024x1024 |
| `enemy_bastion_3x1` | 重装横梁 heavyArmor | `enemy_3x1` 72×24 | 3×1 | 横向三段厚装甲板 + 两排铆钉，横向封锁感 | steel / stone | `#00FF00` | 1536x512 |
| `enemy_deflector_2x1` | 棱盾兽 deflectionWard | `enemy_2x1` 48×24 | 2×1 | 正面一块斜置的大楔形护板（偏折屏障） | cryo / steel | `#00FF00` | 1536x768 |
| `enemy_echo_spire_1x2` | 共振尖塔 echoRelay | `enemy_1x2` 24×48 | 1×2 | 顶部一颗裂纹晶核 + 两道同心回响环 | echo / stone | `#00FF00` | 768x1536 |
| `enemy_prism_1x3` | 折光棱柱 prism | `enemy_1x3` 24×72 | 1×3 | 纵向三棱柱 + 一道被劈成两束的光 | cryo / laser | `#00FF00` | 512x1536 |
| `enemy_maw_2x2` | 深渊胃囊 maw (devour) | `enemy_2x2` 48×48 | 2×2 | 正面一个张开的大吞噬口（暗红旋涡） | laser / stone | `#00FF00` | 1024x1024 |
| `enemy_hive_2x3` | 孵化巢 hive | `enemy_2x3` 48×72 | 2×3 | 三个排成竖列的孵化卵孔（一个正在开裂） | venom / stone | `#FF00FF` | 1024x1536 |
| `enemy_siege_3x2` | 破阵履带 siege | `enemy_3x2` 72×48 | 3×2 | 底部履带 + 正前方一根撞角 | lightning / steel | `#00FF00` | 1536x1024 |
| `enemy_carrier_3x2` | 铸巢母架 carrier（冂形） | `enemy_3x2` 72×48 | 3×2 | 冂形：下排中间第 5 格必须是空洞（投放舱）（碰撞非矩形：填充率按 3×2 盒计，第 5 格空洞须人工确认） | cryo / steel | `#00FF00` | 1536x1024 |
| `enemy_gravity_core_3x3` | 引力炉心 gravityWell | `enemy_3x3` 72×72 | 3×3 | 中心黑核 + 三层环形炉壁 | echo / steel | `#00FF00` | 1024x1024 |
| `minion_ignis_1x1` | 炉卫随从 furnace_guard | `enemy_1x1` 24×24 | 1×1 | 胸口一个小炉口 | pyro / steel | `#00FF00` | 1024x1024 |
| `minion_glacies_1x1` | 霜缝随从 frost_stitch | `enemy_1x1` 24×24 | 1×1 | 身上一道缝合的冰裂 | cryo / steel | `#00FF00` | 1024x1024 |
| `minion_mikro_1x1` | 裂变细胞 fission_cell | `enemy_1x1` 24×24 | 1×1 | 一分为二的细胞膜（中间缢缩） | echo / white | `#00FF00` | 1024x1024 |
| `minion_devourer_1x1` | 胃域仆从 maw_thrall | `enemy_1x1` 24×24 | 1×1 | 一张小獠牙嘴 | laser / stone | `#00FF00` | 1024x1024 |
| `minion_viridis_1x1` | 孢甲侍从 spore_vassal | `enemy_1x1` 24×24 | 1×1 | 背上两颗孢子囊 | venom / stone | `#FF00FF` | 1024x1024 |
| `minion_tesla_1x1` | 导体 conductor | `enemy_1x1` 24×24 | 1×1 | 头顶一根导电避雷针 | lightning / steel | `#00FF00` | 1024x1024 |
| `minion_chimera_1x1` | 混沌养料 chaos_feed | `enemy_1x1` 24×24 | 1×1 | 左冷右热的半边配色 | pyro / cryo | `#00FF00` | 1024x1024 |
| `minion_ouroboros_1x1` | 回声附环 orbit_echo | `enemy_1x1` 24×24 | 1×1 | 一个首尾相衔的小环 | echo / steel | `#00FF00` | 1024x1024 |

<details><summary>逐条提示词（中 / 英 / 负面）</summary>

#### `enemy_residue_1x1` — 炼金残渣（标准 1×1）

- 依据：`docs/enemy_visual_design_v2.md §4.1`
- 中文：一块切角几何磨石块，表面少量裂纹，中心嵌一颗小紫色晶核。唯一的大机制特征：居中一颗小镶嵌核心。占格 1×1，轮廓填满该比例的外框。配色：磨石（暖灰褐）、回响（靛→紫→淡紫）。像素画友好的游戏素材概念图，正交 3/4 俯视角，平涂无光照，无投影、无渐变、无轮廓光、无发光，单一主体居中占画面约 80%，粗而干净的剪影与深色粗描边，大色块，最多 6 种颜色，纯色背景 #00FF00，无文字无字母无 UI 边框
- English: a chamfered geometric whetstone block with a few cracks and one small violet crystal core inlaid in the centre. One big readable mechanic feature: one small inlaid core in the centre. Footprint 1x1 cells; the silhouette fills a box of that aspect ratio. Palette: warm grey-brown whetstone, echo ramp (indigo to violet to lavender). pixel-art-ready game sprite concept, orthographic 3/4 top-down view, flat unlit cel colours, no cast shadow, no gradient, no rim light, no glow, single subject centred filling about 80% of the frame, bold clean silhouette with a thick dark outline, large flat colour blocks, at most 6 colours, solid pure #00FF00 background, no text, no letters, no UI frame
- 负面 / Negative：写实、3D 渲染、照片、渐变、柔光、发光、投影、景深、模糊、噪点纹理、细碎细节、多个主体、文字、水印、边框、背景场景，绿色主体 / photorealistic, 3d render, photo, gradient, soft lighting, glow, bloom, drop shadow, depth of field, blur, noisy texture, tiny details, multiple subjects, text, watermark, border, background scenery, green subject

#### `enemy_bastion_3x1` — 重装横梁 heavyArmor

- 依据：`src/spawn_system.js:3427 (3x1)`
- 中文：横向三格长的磨石装甲横梁，厚边框，铆钉槽。唯一的大机制特征：横向三段厚装甲板 + 两排铆钉，横向封锁感。占格 3×1，轮廓填满该比例的外框。配色：钢（蓝灰）、磨石（暖灰褐）。像素画友好的游戏素材概念图，正交 3/4 俯视角，平涂无光照，无投影、无渐变、无轮廓光、无发光，单一主体居中占画面约 80%，粗而干净的剪影与深色粗描边，大色块，最多 6 种颜色，纯色背景 #00FF00，无文字无字母无 UI 边框
- English: a long horizontal whetstone armour beam three cells wide, thick frame, riveted slots. One big readable mechanic feature: three thick horizontal armour plates with two rows of rivets, reads as a wall. Footprint 3x1 cells; the silhouette fills a box of that aspect ratio. Palette: steel blue-grey, warm grey-brown whetstone. pixel-art-ready game sprite concept, orthographic 3/4 top-down view, flat unlit cel colours, no cast shadow, no gradient, no rim light, no glow, single subject centred filling about 80% of the frame, bold clean silhouette with a thick dark outline, large flat colour blocks, at most 6 colours, solid pure #00FF00 background, no text, no letters, no UI frame
- 负面 / Negative：写实、3D 渲染、照片、渐变、柔光、发光、投影、景深、模糊、噪点纹理、细碎细节、多个主体、文字、水印、边框、背景场景，绿色主体 / photorealistic, 3d render, photo, gradient, soft lighting, glow, bloom, drop shadow, depth of field, blur, noisy texture, tiny details, multiple subjects, text, watermark, border, background scenery, green subject

#### `enemy_deflector_2x1` — 棱盾兽 deflectionWard

- 依据：`src/spawn_system.js:3426 (2x1)`
- 中文：横向两格的楔形磨石兽，前方顶着一块斜置晶盾。唯一的大机制特征：正面一块斜置的大楔形护板（偏折屏障）。占格 2×1，轮廓填满该比例的外框。配色：冰（深蓝→青→冰白）、钢（蓝灰）。像素画友好的游戏素材概念图，正交 3/4 俯视角，平涂无光照，无投影、无渐变、无轮廓光、无发光，单一主体居中占画面约 80%，粗而干净的剪影与深色粗描边，大色块，最多 6 种颜色，纯色背景 #00FF00，无文字无字母无 UI 边框
- English: a two-cell-wide wedge-shaped whetstone beast pushing a slanted crystal shield plate in front. One big readable mechanic feature: one big slanted wedge barrier plate on the front. Footprint 2x1 cells; the silhouette fills a box of that aspect ratio. Palette: ice ramp (deep blue to cyan to ice white), steel blue-grey. pixel-art-ready game sprite concept, orthographic 3/4 top-down view, flat unlit cel colours, no cast shadow, no gradient, no rim light, no glow, single subject centred filling about 80% of the frame, bold clean silhouette with a thick dark outline, large flat colour blocks, at most 6 colours, solid pure #00FF00 background, no text, no letters, no UI frame
- 负面 / Negative：写实、3D 渲染、照片、渐变、柔光、发光、投影、景深、模糊、噪点纹理、细碎细节、多个主体、文字、水印、边框、背景场景，绿色主体 / photorealistic, 3d render, photo, gradient, soft lighting, glow, bloom, drop shadow, depth of field, blur, noisy texture, tiny details, multiple subjects, text, watermark, border, background scenery, green subject

#### `enemy_echo_spire_1x2` — 共振尖塔 echoRelay

- 依据：`src/spawn_system.js:3425 (1x2)`
- 中文：纵向两格的细高磨石尖塔，塔顶嵌裂纹紫晶。唯一的大机制特征：顶部一颗裂纹晶核 + 两道同心回响环。占格 1×2，轮廓填满该比例的外框。配色：回响（靛→紫→淡紫）、磨石（暖灰褐）。像素画友好的游戏素材概念图，正交 3/4 俯视角，平涂无光照，无投影、无渐变、无轮廓光、无发光，单一主体居中占画面约 80%，粗而干净的剪影与深色粗描边，大色块，最多 6 种颜色，纯色背景 #00FF00，无文字无字母无 UI 边框
- English: a tall thin whetstone spire two cells high with a cracked violet crystal at the tip. One big readable mechanic feature: one cracked crystal core on top with two concentric echo rings. Footprint 1x2 cells; the silhouette fills a box of that aspect ratio. Palette: echo ramp (indigo to violet to lavender), warm grey-brown whetstone. pixel-art-ready game sprite concept, orthographic 3/4 top-down view, flat unlit cel colours, no cast shadow, no gradient, no rim light, no glow, single subject centred filling about 80% of the frame, bold clean silhouette with a thick dark outline, large flat colour blocks, at most 6 colours, solid pure #00FF00 background, no text, no letters, no UI frame
- 负面 / Negative：写实、3D 渲染、照片、渐变、柔光、发光、投影、景深、模糊、噪点纹理、细碎细节、多个主体、文字、水印、边框、背景场景，绿色主体 / photorealistic, 3d render, photo, gradient, soft lighting, glow, bloom, drop shadow, depth of field, blur, noisy texture, tiny details, multiple subjects, text, watermark, border, background scenery, green subject

#### `enemy_prism_1x3` — 折光棱柱 prism

- 依据：`src/spawn_system.js:3423 (1x3)`
- 中文：纵向三格的透明棱柱石，内部有分束的光路。唯一的大机制特征：纵向三棱柱 + 一道被劈成两束的光。占格 1×3，轮廓填满该比例的外框。配色：冰（深蓝→青→冰白）、激光（酒红→粉）。像素画友好的游戏素材概念图，正交 3/4 俯视角，平涂无光照，无投影、无渐变、无轮廓光、无发光，单一主体居中占画面约 80%，粗而干净的剪影与深色粗描边，大色块，最多 6 种颜色，纯色背景 #00FF00，无文字无字母无 UI 边框
- English: a three-cell-tall translucent prism column with a split light path inside. One big readable mechanic feature: a tall triangular prism splitting one beam into two. Footprint 1x3 cells; the silhouette fills a box of that aspect ratio. Palette: ice ramp (deep blue to cyan to ice white), laser ramp (wine red to pink). pixel-art-ready game sprite concept, orthographic 3/4 top-down view, flat unlit cel colours, no cast shadow, no gradient, no rim light, no glow, single subject centred filling about 80% of the frame, bold clean silhouette with a thick dark outline, large flat colour blocks, at most 6 colours, solid pure #00FF00 background, no text, no letters, no UI frame
- 负面 / Negative：写实、3D 渲染、照片、渐变、柔光、发光、投影、景深、模糊、噪点纹理、细碎细节、多个主体、文字、水印、边框、背景场景，绿色主体 / photorealistic, 3d render, photo, gradient, soft lighting, glow, bloom, drop shadow, depth of field, blur, noisy texture, tiny details, multiple subjects, text, watermark, border, background scenery, green subject

#### `enemy_maw_2x2` — 深渊胃囊 maw (devour)

- 依据：`src/spawn_system.js:3424 (2x2)`
- 中文：2×2 的圆角掏空磨石胃囊，底部锯齿石槽。唯一的大机制特征：正面一个张开的大吞噬口（暗红旋涡）。占格 2×2，轮廓填满该比例的外框。配色：激光（酒红→粉）、磨石（暖灰褐）。像素画友好的游戏素材概念图，正交 3/4 俯视角，平涂无光照，无投影、无渐变、无轮廓光、无发光，单一主体居中占画面约 80%，粗而干净的剪影与深色粗描边，大色块，最多 6 种颜色，纯色背景 #00FF00，无文字无字母无 UI 边框
- English: a 2x2 rounded hollow whetstone stomach with a jagged toothed slot at the bottom. One big readable mechanic feature: one huge open devouring mouth with a dark red swirl. Footprint 2x2 cells; the silhouette fills a box of that aspect ratio. Palette: laser ramp (wine red to pink), warm grey-brown whetstone. pixel-art-ready game sprite concept, orthographic 3/4 top-down view, flat unlit cel colours, no cast shadow, no gradient, no rim light, no glow, single subject centred filling about 80% of the frame, bold clean silhouette with a thick dark outline, large flat colour blocks, at most 6 colours, solid pure #00FF00 background, no text, no letters, no UI frame
- 负面 / Negative：写实、3D 渲染、照片、渐变、柔光、发光、投影、景深、模糊、噪点纹理、细碎细节、多个主体、文字、水印、边框、背景场景，绿色主体 / photorealistic, 3d render, photo, gradient, soft lighting, glow, bloom, drop shadow, depth of field, blur, noisy texture, tiny details, multiple subjects, text, watermark, border, background scenery, green subject

#### `enemy_hive_2x3` — 孵化巢 hive

- 依据：`src/spawn_system.js:3422 (2x3)`
- 中文：2 列 3 行的竖向巢穴磨石，表面嵌卵囊。唯一的大机制特征：三个排成竖列的孵化卵孔（一个正在开裂）。占格 2×3，轮廓填满该比例的外框。配色：毒（墨绿→酸绿）、磨石（暖灰褐）。像素画友好的游戏素材概念图，正交 3/4 俯视角，平涂无光照，无投影、无渐变、无轮廓光、无发光，单一主体居中占画面约 80%，粗而干净的剪影与深色粗描边，大色块，最多 6 种颜色，纯色背景 #FF00FF，无文字无字母无 UI 边框
- English: a tall nest-shaped whetstone two cells wide three cells high with egg pods embedded. One big readable mechanic feature: three egg pods in a column, one cracking open. Footprint 2x3 cells; the silhouette fills a box of that aspect ratio. Palette: venom ramp (dark green to acid green), warm grey-brown whetstone. pixel-art-ready game sprite concept, orthographic 3/4 top-down view, flat unlit cel colours, no cast shadow, no gradient, no rim light, no glow, single subject centred filling about 80% of the frame, bold clean silhouette with a thick dark outline, large flat colour blocks, at most 6 colours, solid pure #FF00FF background, no text, no letters, no UI frame
- 负面 / Negative：写实、3D 渲染、照片、渐变、柔光、发光、投影、景深、模糊、噪点纹理、细碎细节、多个主体、文字、水印、边框、背景场景，品红色主体 / photorealistic, 3d render, photo, gradient, soft lighting, glow, bloom, drop shadow, depth of field, blur, noisy texture, tiny details, multiple subjects, text, watermark, border, background scenery, magenta subject

#### `enemy_siege_3x2` — 破阵履带 siege

- 依据：`src/spawn_system.js:3421 (3x2)`
- 中文：3 列 2 行的履带石板，正面撞角。唯一的大机制特征：底部履带 + 正前方一根撞角。占格 3×2，轮廓填满该比例的外框。配色：雷（暗金→亮黄）、钢（蓝灰）。像素画友好的游戏素材概念图，正交 3/4 俯视角，平涂无光照，无投影、无渐变、无轮廓光、无发光，单一主体居中占画面约 80%，粗而干净的剪影与深色粗描边，大色块，最多 6 种颜色，纯色背景 #00FF00，无文字无字母无 UI 边框
- English: a 3x2 tracked stone slab with a battering ram on its front edge. One big readable mechanic feature: tank treads at the bottom and one battering ram in front. Footprint 3x2 cells; the silhouette fills a box of that aspect ratio. Palette: lightning ramp (dark gold to bright yellow), steel blue-grey. pixel-art-ready game sprite concept, orthographic 3/4 top-down view, flat unlit cel colours, no cast shadow, no gradient, no rim light, no glow, single subject centred filling about 80% of the frame, bold clean silhouette with a thick dark outline, large flat colour blocks, at most 6 colours, solid pure #00FF00 background, no text, no letters, no UI frame
- 负面 / Negative：写实、3D 渲染、照片、渐变、柔光、发光、投影、景深、模糊、噪点纹理、细碎细节、多个主体、文字、水印、边框、背景场景，绿色主体 / photorealistic, 3d render, photo, gradient, soft lighting, glow, bloom, drop shadow, depth of field, blur, noisy texture, tiny details, multiple subjects, text, watermark, border, background scenery, green subject

#### `enemy_carrier_3x2` — 铸巢母架 carrier（冂形）

- 依据：`src/spawn_system.js:3420; docs/enemy_visual_design_v2.md §6`
- 中文：3×2 冂形甲板，左右两条腿，下排正中留空。唯一的大机制特征：冂形：下排中间第 5 格必须是空洞（投放舱）。占格 3×2，轮廓填满该比例的外框。配色：冰（深蓝→青→冰白）、钢（蓝灰）。像素画友好的游戏素材概念图，正交 3/4 俯视角，平涂无光照，无投影、无渐变、无轮廓光、无发光，单一主体居中占画面约 80%，粗而干净的剪影与深色粗描边，大色块，最多 6 种颜色，纯色背景 #00FF00，无文字无字母无 UI 边框
- English: a 3x2 upside-down-U deck, two legs left and right, the bottom-centre cell left empty. One big readable mechanic feature: an upside-down U shape: the bottom-middle cell is an empty launch bay. Footprint 3x2 cells; the silhouette fills a box of that aspect ratio. Palette: ice ramp (deep blue to cyan to ice white), steel blue-grey. pixel-art-ready game sprite concept, orthographic 3/4 top-down view, flat unlit cel colours, no cast shadow, no gradient, no rim light, no glow, single subject centred filling about 80% of the frame, bold clean silhouette with a thick dark outline, large flat colour blocks, at most 6 colours, solid pure #00FF00 background, no text, no letters, no UI frame
- 负面 / Negative：写实、3D 渲染、照片、渐变、柔光、发光、投影、景深、模糊、噪点纹理、细碎细节、多个主体、文字、水印、边框、背景场景，下排正中被填满，绿色主体 / photorealistic, 3d render, photo, gradient, soft lighting, glow, bloom, drop shadow, depth of field, blur, noisy texture, tiny details, multiple subjects, text, watermark, border, background scenery, bottom-centre cell filled in, green subject

#### `enemy_gravity_core_3x3` — 引力炉心 gravityWell

- 依据：`src/spawn_system.js:3419 (3x3)`
- 中文：3×3 的圆形炉心磨石，向心网格线。唯一的大机制特征：中心黑核 + 三层环形炉壁。占格 3×3，轮廓填满该比例的外框。配色：回响（靛→紫→淡紫）、钢（蓝灰）。像素画友好的游戏素材概念图，正交 3/4 俯视角，平涂无光照，无投影、无渐变、无轮廓光、无发光，单一主体居中占画面约 80%，粗而干净的剪影与深色粗描边，大色块，最多 6 种颜色，纯色背景 #00FF00，无文字无字母无 UI 边框
- English: a 3x3 round furnace-core whetstone with inward-collapsing grid lines. One big readable mechanic feature: a black core in the centre with three concentric furnace rings. Footprint 3x3 cells; the silhouette fills a box of that aspect ratio. Palette: echo ramp (indigo to violet to lavender), steel blue-grey. pixel-art-ready game sprite concept, orthographic 3/4 top-down view, flat unlit cel colours, no cast shadow, no gradient, no rim light, no glow, single subject centred filling about 80% of the frame, bold clean silhouette with a thick dark outline, large flat colour blocks, at most 6 colours, solid pure #00FF00 background, no text, no letters, no UI frame
- 负面 / Negative：写实、3D 渲染、照片、渐变、柔光、发光、投影、景深、模糊、噪点纹理、细碎细节、多个主体、文字、水印、边框、背景场景，绿色主体 / photorealistic, 3d render, photo, gradient, soft lighting, glow, bloom, drop shadow, depth of field, blur, noisy texture, tiny details, multiple subjects, text, watermark, border, background scenery, green subject

#### `minion_ignis_1x1` — 炉卫随从 furnace_guard

- 依据：`src/config.js:914-923 bossMinionProfiles`
- 中文：单格小磨石怪，Boss 同族配色。唯一的大机制特征：胸口一个小炉口。占格 1×1，轮廓填满该比例的外框。配色：火（暗红→橙→浅黄）、钢（蓝灰）。像素画友好的游戏素材概念图，正交 3/4 俯视角，平涂无光照，无投影、无渐变、无轮廓光、无发光，单一主体居中占画面约 80%，粗而干净的剪影与深色粗描边，大色块，最多 6 种颜色，纯色背景 #00FF00，无文字无字母无 UI 边框
- English: a single-cell small whetstone creature in its boss family colours. One big readable mechanic feature: a small furnace mouth on the chest. Footprint 1x1 cells; the silhouette fills a box of that aspect ratio. Palette: fire ramp (dark red to orange to pale yellow), steel blue-grey. pixel-art-ready game sprite concept, orthographic 3/4 top-down view, flat unlit cel colours, no cast shadow, no gradient, no rim light, no glow, single subject centred filling about 80% of the frame, bold clean silhouette with a thick dark outline, large flat colour blocks, at most 6 colours, solid pure #00FF00 background, no text, no letters, no UI frame
- 负面 / Negative：写实、3D 渲染、照片、渐变、柔光、发光、投影、景深、模糊、噪点纹理、细碎细节、多个主体、文字、水印、边框、背景场景，绿色主体 / photorealistic, 3d render, photo, gradient, soft lighting, glow, bloom, drop shadow, depth of field, blur, noisy texture, tiny details, multiple subjects, text, watermark, border, background scenery, green subject

#### `minion_glacies_1x1` — 霜缝随从 frost_stitch

- 依据：`src/config.js:914-923 bossMinionProfiles`
- 中文：单格小磨石怪，Boss 同族配色。唯一的大机制特征：身上一道缝合的冰裂。占格 1×1，轮廓填满该比例的外框。配色：冰（深蓝→青→冰白）、钢（蓝灰）。像素画友好的游戏素材概念图，正交 3/4 俯视角，平涂无光照，无投影、无渐变、无轮廓光、无发光，单一主体居中占画面约 80%，粗而干净的剪影与深色粗描边，大色块，最多 6 种颜色，纯色背景 #00FF00，无文字无字母无 UI 边框
- English: a single-cell small whetstone creature in its boss family colours. One big readable mechanic feature: one stitched ice crack across the body. Footprint 1x1 cells; the silhouette fills a box of that aspect ratio. Palette: ice ramp (deep blue to cyan to ice white), steel blue-grey. pixel-art-ready game sprite concept, orthographic 3/4 top-down view, flat unlit cel colours, no cast shadow, no gradient, no rim light, no glow, single subject centred filling about 80% of the frame, bold clean silhouette with a thick dark outline, large flat colour blocks, at most 6 colours, solid pure #00FF00 background, no text, no letters, no UI frame
- 负面 / Negative：写实、3D 渲染、照片、渐变、柔光、发光、投影、景深、模糊、噪点纹理、细碎细节、多个主体、文字、水印、边框、背景场景，绿色主体 / photorealistic, 3d render, photo, gradient, soft lighting, glow, bloom, drop shadow, depth of field, blur, noisy texture, tiny details, multiple subjects, text, watermark, border, background scenery, green subject

#### `minion_mikro_1x1` — 裂变细胞 fission_cell

- 依据：`src/config.js:914-923 bossMinionProfiles`
- 中文：单格小磨石怪，Boss 同族配色。唯一的大机制特征：一分为二的细胞膜（中间缢缩）。占格 1×1，轮廓填满该比例的外框。配色：回响（靛→紫→淡紫）、白（仅高光）。像素画友好的游戏素材概念图，正交 3/4 俯视角，平涂无光照，无投影、无渐变、无轮廓光、无发光，单一主体居中占画面约 80%，粗而干净的剪影与深色粗描边，大色块，最多 6 种颜色，纯色背景 #00FF00，无文字无字母无 UI 边框
- English: a single-cell small whetstone creature in its boss family colours. One big readable mechanic feature: a cell membrane pinching into two. Footprint 1x1 cells; the silhouette fills a box of that aspect ratio. Palette: echo ramp (indigo to violet to lavender), white highlights only. pixel-art-ready game sprite concept, orthographic 3/4 top-down view, flat unlit cel colours, no cast shadow, no gradient, no rim light, no glow, single subject centred filling about 80% of the frame, bold clean silhouette with a thick dark outline, large flat colour blocks, at most 6 colours, solid pure #00FF00 background, no text, no letters, no UI frame
- 负面 / Negative：写实、3D 渲染、照片、渐变、柔光、发光、投影、景深、模糊、噪点纹理、细碎细节、多个主体、文字、水印、边框、背景场景，绿色主体 / photorealistic, 3d render, photo, gradient, soft lighting, glow, bloom, drop shadow, depth of field, blur, noisy texture, tiny details, multiple subjects, text, watermark, border, background scenery, green subject

#### `minion_devourer_1x1` — 胃域仆从 maw_thrall

- 依据：`src/config.js:914-923 bossMinionProfiles`
- 中文：单格小磨石怪，Boss 同族配色。唯一的大机制特征：一张小獠牙嘴。占格 1×1，轮廓填满该比例的外框。配色：激光（酒红→粉）、磨石（暖灰褐）。像素画友好的游戏素材概念图，正交 3/4 俯视角，平涂无光照，无投影、无渐变、无轮廓光、无发光，单一主体居中占画面约 80%，粗而干净的剪影与深色粗描边，大色块，最多 6 种颜色，纯色背景 #00FF00，无文字无字母无 UI 边框
- English: a single-cell small whetstone creature in its boss family colours. One big readable mechanic feature: one small fanged mouth. Footprint 1x1 cells; the silhouette fills a box of that aspect ratio. Palette: laser ramp (wine red to pink), warm grey-brown whetstone. pixel-art-ready game sprite concept, orthographic 3/4 top-down view, flat unlit cel colours, no cast shadow, no gradient, no rim light, no glow, single subject centred filling about 80% of the frame, bold clean silhouette with a thick dark outline, large flat colour blocks, at most 6 colours, solid pure #00FF00 background, no text, no letters, no UI frame
- 负面 / Negative：写实、3D 渲染、照片、渐变、柔光、发光、投影、景深、模糊、噪点纹理、细碎细节、多个主体、文字、水印、边框、背景场景，绿色主体 / photorealistic, 3d render, photo, gradient, soft lighting, glow, bloom, drop shadow, depth of field, blur, noisy texture, tiny details, multiple subjects, text, watermark, border, background scenery, green subject

#### `minion_viridis_1x1` — 孢甲侍从 spore_vassal

- 依据：`src/config.js:914-923 bossMinionProfiles`
- 中文：单格小磨石怪，Boss 同族配色。唯一的大机制特征：背上两颗孢子囊。占格 1×1，轮廓填满该比例的外框。配色：毒（墨绿→酸绿）、磨石（暖灰褐）。像素画友好的游戏素材概念图，正交 3/4 俯视角，平涂无光照，无投影、无渐变、无轮廓光、无发光，单一主体居中占画面约 80%，粗而干净的剪影与深色粗描边，大色块，最多 6 种颜色，纯色背景 #FF00FF，无文字无字母无 UI 边框
- English: a single-cell small whetstone creature in its boss family colours. One big readable mechanic feature: two spore pods on its back. Footprint 1x1 cells; the silhouette fills a box of that aspect ratio. Palette: venom ramp (dark green to acid green), warm grey-brown whetstone. pixel-art-ready game sprite concept, orthographic 3/4 top-down view, flat unlit cel colours, no cast shadow, no gradient, no rim light, no glow, single subject centred filling about 80% of the frame, bold clean silhouette with a thick dark outline, large flat colour blocks, at most 6 colours, solid pure #FF00FF background, no text, no letters, no UI frame
- 负面 / Negative：写实、3D 渲染、照片、渐变、柔光、发光、投影、景深、模糊、噪点纹理、细碎细节、多个主体、文字、水印、边框、背景场景，品红色主体 / photorealistic, 3d render, photo, gradient, soft lighting, glow, bloom, drop shadow, depth of field, blur, noisy texture, tiny details, multiple subjects, text, watermark, border, background scenery, magenta subject

#### `minion_tesla_1x1` — 导体 conductor

- 依据：`src/config.js:914-923 bossMinionProfiles`
- 中文：单格小磨石怪，Boss 同族配色。唯一的大机制特征：头顶一根导电避雷针。占格 1×1，轮廓填满该比例的外框。配色：雷（暗金→亮黄）、钢（蓝灰）。像素画友好的游戏素材概念图，正交 3/4 俯视角，平涂无光照，无投影、无渐变、无轮廓光、无发光，单一主体居中占画面约 80%，粗而干净的剪影与深色粗描边，大色块，最多 6 种颜色，纯色背景 #00FF00，无文字无字母无 UI 边框
- English: a single-cell small whetstone creature in its boss family colours. One big readable mechanic feature: one conductor rod sticking up. Footprint 1x1 cells; the silhouette fills a box of that aspect ratio. Palette: lightning ramp (dark gold to bright yellow), steel blue-grey. pixel-art-ready game sprite concept, orthographic 3/4 top-down view, flat unlit cel colours, no cast shadow, no gradient, no rim light, no glow, single subject centred filling about 80% of the frame, bold clean silhouette with a thick dark outline, large flat colour blocks, at most 6 colours, solid pure #00FF00 background, no text, no letters, no UI frame
- 负面 / Negative：写实、3D 渲染、照片、渐变、柔光、发光、投影、景深、模糊、噪点纹理、细碎细节、多个主体、文字、水印、边框、背景场景，绿色主体 / photorealistic, 3d render, photo, gradient, soft lighting, glow, bloom, drop shadow, depth of field, blur, noisy texture, tiny details, multiple subjects, text, watermark, border, background scenery, green subject

#### `minion_chimera_1x1` — 混沌养料 chaos_feed

- 依据：`src/config.js:914-923 bossMinionProfiles`
- 中文：单格小磨石怪，Boss 同族配色。唯一的大机制特征：左冷右热的半边配色。占格 1×1，轮廓填满该比例的外框。配色：火（暗红→橙→浅黄）、冰（深蓝→青→冰白）。像素画友好的游戏素材概念图，正交 3/4 俯视角，平涂无光照，无投影、无渐变、无轮廓光、无发光，单一主体居中占画面约 80%，粗而干净的剪影与深色粗描边，大色块，最多 6 种颜色，纯色背景 #00FF00，无文字无字母无 UI 边框
- English: a single-cell small whetstone creature in its boss family colours. One big readable mechanic feature: left half cold blue, right half hot orange. Footprint 1x1 cells; the silhouette fills a box of that aspect ratio. Palette: fire ramp (dark red to orange to pale yellow), ice ramp (deep blue to cyan to ice white). pixel-art-ready game sprite concept, orthographic 3/4 top-down view, flat unlit cel colours, no cast shadow, no gradient, no rim light, no glow, single subject centred filling about 80% of the frame, bold clean silhouette with a thick dark outline, large flat colour blocks, at most 6 colours, solid pure #00FF00 background, no text, no letters, no UI frame
- 负面 / Negative：写实、3D 渲染、照片、渐变、柔光、发光、投影、景深、模糊、噪点纹理、细碎细节、多个主体、文字、水印、边框、背景场景，绿色主体 / photorealistic, 3d render, photo, gradient, soft lighting, glow, bloom, drop shadow, depth of field, blur, noisy texture, tiny details, multiple subjects, text, watermark, border, background scenery, green subject

#### `minion_ouroboros_1x1` — 回声附环 orbit_echo

- 依据：`src/config.js:914-923 bossMinionProfiles`
- 中文：单格小磨石怪，Boss 同族配色。唯一的大机制特征：一个首尾相衔的小环。占格 1×1，轮廓填满该比例的外框。配色：回响（靛→紫→淡紫）、钢（蓝灰）。像素画友好的游戏素材概念图，正交 3/4 俯视角，平涂无光照，无投影、无渐变、无轮廓光、无发光，单一主体居中占画面约 80%，粗而干净的剪影与深色粗描边，大色块，最多 6 种颜色，纯色背景 #00FF00，无文字无字母无 UI 边框
- English: a single-cell small whetstone creature in its boss family colours. One big readable mechanic feature: a small ring biting its own tail. Footprint 1x1 cells; the silhouette fills a box of that aspect ratio. Palette: echo ramp (indigo to violet to lavender), steel blue-grey. pixel-art-ready game sprite concept, orthographic 3/4 top-down view, flat unlit cel colours, no cast shadow, no gradient, no rim light, no glow, single subject centred filling about 80% of the frame, bold clean silhouette with a thick dark outline, large flat colour blocks, at most 6 colours, solid pure #00FF00 background, no text, no letters, no UI frame
- 负面 / Negative：写实、3D 渲染、照片、渐变、柔光、发光、投影、景深、模糊、噪点纹理、细碎细节、多个主体、文字、水印、边框、背景场景，绿色主体 / photorealistic, 3d render, photo, gradient, soft lighting, glow, bloom, drop shadow, depth of field, blur, noisy texture, tiny details, multiple subjects, text, watermark, border, background scenery, green subject

</details>

## 4. 精英（词条 = 一个大造型特征）（19 条）

| id | 名称 | 类别 / 网格 | 占格 | 必须可读的特征 | 色带 | 键色 | 请求尺寸 |
|---|---|---|---|---|---|---|---|
| `elite_base_1x1` | 精英底形（无词条） | `elite_1x1` 24×24 | 1×1 | 四角各一枚尖棱（精英冠角），核心比普通怪更大 | stone / echo | `#00FF00` | 1024x1024 |
| `elite_shield_1x1` | 护盾 shield | `elite_1x1` 24×24 | 1×1 | 外层整圈甲片（像盔甲包住身体） | steel / stone | `#00FF00` | 1024x1024 |
| `elite_regen_1x1` | 再生 regen | `elite_1x1` 24×24 | 1×1 | 一道螺旋状的再生愈合缝（新长出的嫩芽） | venom / stone | `#FF00FF` | 1024x1024 |
| `elite_healer_1x1` | 治愈 healer | `elite_1x1` 24×24 | 1×1 | 正中一个大十字核心 | venom / white | `#FF00FF` | 1024x1024 |
| `elite_haste_1x1` | 极速 haste | `elite_1x1` 24×24 | 1×1 | 身体前倾 + 身后三道速度尾迹 | lightning / stone | `#00FF00` | 1024x1024 |
| `elite_jump_1x1` | 跳跃 jump | `elite_1x1` 24×24 | 1×1 | 下蹲弹簧腿（两条压缩的粗腿） | cryo / stone | `#00FF00` | 1024x1024 |
| `elite_clone_1x1` | 增殖 clone | `elite_1x1` 24×24 | 1×1 | 身上冒出三颗芽孢小分身 | echo / stone | `#00FF00` | 1024x1024 |
| `elite_berserk_1x1` | 狂暴 berserk | `elite_1x1` 24×24 | 1×1 | 裂开的外壳露出炽热内核 + 锯齿尖刺 | pyro / stone | `#00FF00` | 1024x1024 |
| `elite_devour_1x1` | 吞噬 devour | `elite_1x1` 24×24 | 1×1 | 正面一张大獠牙口 | laser / stone | `#00FF00` | 1024x1024 |
| `elite_radiantAegis_1x1` | 流彩护盾 radiantAegis | `elite_1x1` 24×24 | 1×1 | 头顶一圈棱镜冠片 | cryo / laser | `#00FF00` | 1024x1024 |
| `elite_livingArmor_1x1` | 活体护甲 livingArmor | `elite_1x1` 24×24 | 1×1 | 树皮状的活体外壳包裹 | venom / stone | `#FF00FF` | 1024x1024 |
| `elite_armorSpore_1x1` | 护甲孢子 armorSpore | `elite_1x1` 24×24 | 1×1 | 甲片上长着两颗孢子囊 | venom / steel | `#FF00FF` | 1024x1024 |
| `elite_siegeBreaker_1x1` | 撞城者 siegeBreaker | `elite_1x1` 24×24 | 1×1 | 正前方一根加固撞角 | steel / stone | `#00FF00` | 1024x1024 |
| `elite_deflectShell_1x1` | 偏折壳 deflectShell | `elite_1x1` 24×24 | 1×1 | 光滑多棱面的倾斜外壳（子弹会被弹偏） | cryo / steel | `#00FF00` | 1024x1024 |
| `elite_energyArmor_1x1` | 蓄能甲 energyArmor | `elite_1x1` 24×24 | 1×1 | 胸前一块蓄电池甲板（电格刻度） | lightning / steel | `#00FF00` | 1024x1024 |
| `elite_phaseShield_1x1` | 相位护盾 phaseShield | `elite_1x1` 24×24 | 1×1 | 偏移半格的幽灵重影外壳 | echo / white | `#00FF00` | 1024x1024 |
| `elite_overloadReactor_1x1` | 过量反应炉 overloadReactor | `elite_1x1` 24×24 | 1×1 | 背后两根反应炉排气管 | pyro / lightning | `#00FF00` | 1024x1024 |
| `elite_lowDamageImmune_1x1` | 低伤免疫 lowDamageImmune | `elite_1x1` 24×24 | 1×1 | 钻石般的厚硬棱面外壳 | steel / white | `#00FF00` | 1024x1024 |
| `elite_runeBearer_1x1` | 符文携带者 runeBearer | `elite_1x1` 24×24 | 1×1 | 背着一块刻符石板（只画符号形，不画文字） | echo / stone | `#00FF00` | 1024x1024 |

<details><summary>逐条提示词（中 / 英 / 负面）</summary>

#### `elite_base_1x1` — 精英底形（无词条）

- 依据：`docs/design/art_vfx_ui_direction_v1.md §2.2`
- 中文：单格切角磨石块，四角突出尖棱。唯一的大机制特征：四角各一枚尖棱（精英冠角），核心比普通怪更大。占格 1×1，轮廓填满该比例的外框。配色：磨石（暖灰褐）、回响（靛→紫→淡紫）。像素画友好的游戏素材概念图，正交 3/4 俯视角，平涂无光照，无投影、无渐变、无轮廓光、无发光，单一主体居中占画面约 80%，粗而干净的剪影与深色粗描边，大色块，最多 6 种颜色，纯色背景 #00FF00，无文字无字母无 UI 边框
- English: a single-cell chamfered whetstone block with four protruding corner spikes. One big readable mechanic feature: four sharp corner spikes (elite crown), larger core than a normal enemy. Footprint 1x1 cells; the silhouette fills a box of that aspect ratio. Palette: warm grey-brown whetstone, echo ramp (indigo to violet to lavender). pixel-art-ready game sprite concept, orthographic 3/4 top-down view, flat unlit cel colours, no cast shadow, no gradient, no rim light, no glow, single subject centred filling about 80% of the frame, bold clean silhouette with a thick dark outline, large flat colour blocks, at most 6 colours, solid pure #00FF00 background, no text, no letters, no UI frame
- 负面 / Negative：写实、3D 渲染、照片、渐变、柔光、发光、投影、景深、模糊、噪点纹理、细碎细节、多个主体、文字、水印、边框、背景场景，绿色主体 / photorealistic, 3d render, photo, gradient, soft lighting, glow, bloom, drop shadow, depth of field, blur, noisy texture, tiny details, multiple subjects, text, watermark, border, background scenery, green subject

#### `elite_shield_1x1` — 护盾 shield

- 依据：`src/config.js gameplay.affixes.shieldReduction`
- 中文：单格精英磨石怪（同精英底形），词条特征占画面 1/3 以上。唯一的大机制特征：外层整圈甲片（像盔甲包住身体）。占格 1×1，轮廓填满该比例的外框。配色：钢（蓝灰）、磨石（暖灰褐）。像素画友好的游戏素材概念图，正交 3/4 俯视角，平涂无光照，无投影、无渐变、无轮廓光、无发光，单一主体居中占画面约 80%，粗而干净的剪影与深色粗描边，大色块，最多 6 种颜色，纯色背景 #00FF00，无文字无字母无 UI 边框
- English: a single-cell elite whetstone creature (same base as the elite), the affix feature covering at least a third of the figure. One big readable mechanic feature: a full ring of outer armour plates wrapping the body. Footprint 1x1 cells; the silhouette fills a box of that aspect ratio. Palette: steel blue-grey, warm grey-brown whetstone. pixel-art-ready game sprite concept, orthographic 3/4 top-down view, flat unlit cel colours, no cast shadow, no gradient, no rim light, no glow, single subject centred filling about 80% of the frame, bold clean silhouette with a thick dark outline, large flat colour blocks, at most 6 colours, solid pure #00FF00 background, no text, no letters, no UI frame
- 负面 / Negative：写实、3D 渲染、照片、渐变、柔光、发光、投影、景深、模糊、噪点纹理、细碎细节、多个主体、文字、水印、边框、背景场景，绿色主体 / photorealistic, 3d render, photo, gradient, soft lighting, glow, bloom, drop shadow, depth of field, blur, noisy texture, tiny details, multiple subjects, text, watermark, border, background scenery, green subject

#### `elite_regen_1x1` — 再生 regen

- 依据：`src/config.js gameplay.affixes.regenPercent`
- 中文：单格精英磨石怪（同精英底形），词条特征占画面 1/3 以上。唯一的大机制特征：一道螺旋状的再生愈合缝（新长出的嫩芽）。占格 1×1，轮廓填满该比例的外框。配色：毒（墨绿→酸绿）、磨石（暖灰褐）。像素画友好的游戏素材概念图，正交 3/4 俯视角，平涂无光照，无投影、无渐变、无轮廓光、无发光，单一主体居中占画面约 80%，粗而干净的剪影与深色粗描边，大色块，最多 6 种颜色，纯色背景 #FF00FF，无文字无字母无 UI 边框
- English: a single-cell elite whetstone creature (same base as the elite), the affix feature covering at least a third of the figure. One big readable mechanic feature: one spiral healing seam with fresh sprouts. Footprint 1x1 cells; the silhouette fills a box of that aspect ratio. Palette: venom ramp (dark green to acid green), warm grey-brown whetstone. pixel-art-ready game sprite concept, orthographic 3/4 top-down view, flat unlit cel colours, no cast shadow, no gradient, no rim light, no glow, single subject centred filling about 80% of the frame, bold clean silhouette with a thick dark outline, large flat colour blocks, at most 6 colours, solid pure #FF00FF background, no text, no letters, no UI frame
- 负面 / Negative：写实、3D 渲染、照片、渐变、柔光、发光、投影、景深、模糊、噪点纹理、细碎细节、多个主体、文字、水印、边框、背景场景，品红色主体 / photorealistic, 3d render, photo, gradient, soft lighting, glow, bloom, drop shadow, depth of field, blur, noisy texture, tiny details, multiple subjects, text, watermark, border, background scenery, magenta subject

#### `elite_healer_1x1` — 治愈 healer

- 依据：`src/config.js gameplay.affixes.healerPercent`
- 中文：单格精英磨石怪（同精英底形），词条特征占画面 1/3 以上。唯一的大机制特征：正中一个大十字核心。占格 1×1，轮廓填满该比例的外框。配色：毒（墨绿→酸绿）、白（仅高光）。像素画友好的游戏素材概念图，正交 3/4 俯视角，平涂无光照，无投影、无渐变、无轮廓光、无发光，单一主体居中占画面约 80%，粗而干净的剪影与深色粗描边，大色块，最多 6 种颜色，纯色背景 #FF00FF，无文字无字母无 UI 边框
- English: a single-cell elite whetstone creature (same base as the elite), the affix feature covering at least a third of the figure. One big readable mechanic feature: a big cross-shaped core in the centre. Footprint 1x1 cells; the silhouette fills a box of that aspect ratio. Palette: venom ramp (dark green to acid green), white highlights only. pixel-art-ready game sprite concept, orthographic 3/4 top-down view, flat unlit cel colours, no cast shadow, no gradient, no rim light, no glow, single subject centred filling about 80% of the frame, bold clean silhouette with a thick dark outline, large flat colour blocks, at most 6 colours, solid pure #FF00FF background, no text, no letters, no UI frame
- 负面 / Negative：写实、3D 渲染、照片、渐变、柔光、发光、投影、景深、模糊、噪点纹理、细碎细节、多个主体、文字、水印、边框、背景场景，品红色主体 / photorealistic, 3d render, photo, gradient, soft lighting, glow, bloom, drop shadow, depth of field, blur, noisy texture, tiny details, multiple subjects, text, watermark, border, background scenery, magenta subject

#### `elite_haste_1x1` — 极速 haste

- 依据：`src/config.js gameplay.affixes.hasteActions`
- 中文：单格精英磨石怪（同精英底形），词条特征占画面 1/3 以上。唯一的大机制特征：身体前倾 + 身后三道速度尾迹。占格 1×1，轮廓填满该比例的外框。配色：雷（暗金→亮黄）、磨石（暖灰褐）。像素画友好的游戏素材概念图，正交 3/4 俯视角，平涂无光照，无投影、无渐变、无轮廓光、无发光，单一主体居中占画面约 80%，粗而干净的剪影与深色粗描边，大色块，最多 6 种颜色，纯色背景 #00FF00，无文字无字母无 UI 边框
- English: a single-cell elite whetstone creature (same base as the elite), the affix feature covering at least a third of the figure. One big readable mechanic feature: body leaning forward with three speed trails behind. Footprint 1x1 cells; the silhouette fills a box of that aspect ratio. Palette: lightning ramp (dark gold to bright yellow), warm grey-brown whetstone. pixel-art-ready game sprite concept, orthographic 3/4 top-down view, flat unlit cel colours, no cast shadow, no gradient, no rim light, no glow, single subject centred filling about 80% of the frame, bold clean silhouette with a thick dark outline, large flat colour blocks, at most 6 colours, solid pure #00FF00 background, no text, no letters, no UI frame
- 负面 / Negative：写实、3D 渲染、照片、渐变、柔光、发光、投影、景深、模糊、噪点纹理、细碎细节、多个主体、文字、水印、边框、背景场景，绿色主体 / photorealistic, 3d render, photo, gradient, soft lighting, glow, bloom, drop shadow, depth of field, blur, noisy texture, tiny details, multiple subjects, text, watermark, border, background scenery, green subject

#### `elite_jump_1x1` — 跳跃 jump

- 依据：`src/config.js gameplay.affixes.jumpRows`
- 中文：单格精英磨石怪（同精英底形），词条特征占画面 1/3 以上。唯一的大机制特征：下蹲弹簧腿（两条压缩的粗腿）。占格 1×1，轮廓填满该比例的外框。配色：冰（深蓝→青→冰白）、磨石（暖灰褐）。像素画友好的游戏素材概念图，正交 3/4 俯视角，平涂无光照，无投影、无渐变、无轮廓光、无发光，单一主体居中占画面约 80%，粗而干净的剪影与深色粗描边，大色块，最多 6 种颜色，纯色背景 #00FF00，无文字无字母无 UI 边框
- English: a single-cell elite whetstone creature (same base as the elite), the affix feature covering at least a third of the figure. One big readable mechanic feature: two crouched spring legs, compressed. Footprint 1x1 cells; the silhouette fills a box of that aspect ratio. Palette: ice ramp (deep blue to cyan to ice white), warm grey-brown whetstone. pixel-art-ready game sprite concept, orthographic 3/4 top-down view, flat unlit cel colours, no cast shadow, no gradient, no rim light, no glow, single subject centred filling about 80% of the frame, bold clean silhouette with a thick dark outline, large flat colour blocks, at most 6 colours, solid pure #00FF00 background, no text, no letters, no UI frame
- 负面 / Negative：写实、3D 渲染、照片、渐变、柔光、发光、投影、景深、模糊、噪点纹理、细碎细节、多个主体、文字、水印、边框、背景场景，绿色主体 / photorealistic, 3d render, photo, gradient, soft lighting, glow, bloom, drop shadow, depth of field, blur, noisy texture, tiny details, multiple subjects, text, watermark, border, background scenery, green subject

#### `elite_clone_1x1` — 增殖 clone

- 依据：`src/config.js gameplay.affixes.cloneChanceHit`
- 中文：单格精英磨石怪（同精英底形），词条特征占画面 1/3 以上。唯一的大机制特征：身上冒出三颗芽孢小分身。占格 1×1，轮廓填满该比例的外框。配色：回响（靛→紫→淡紫）、磨石（暖灰褐）。像素画友好的游戏素材概念图，正交 3/4 俯视角，平涂无光照，无投影、无渐变、无轮廓光、无发光，单一主体居中占画面约 80%，粗而干净的剪影与深色粗描边，大色块，最多 6 种颜色，纯色背景 #00FF00，无文字无字母无 UI 边框
- English: a single-cell elite whetstone creature (same base as the elite), the affix feature covering at least a third of the figure. One big readable mechanic feature: three budding spores sprouting from the body. Footprint 1x1 cells; the silhouette fills a box of that aspect ratio. Palette: echo ramp (indigo to violet to lavender), warm grey-brown whetstone. pixel-art-ready game sprite concept, orthographic 3/4 top-down view, flat unlit cel colours, no cast shadow, no gradient, no rim light, no glow, single subject centred filling about 80% of the frame, bold clean silhouette with a thick dark outline, large flat colour blocks, at most 6 colours, solid pure #00FF00 background, no text, no letters, no UI frame
- 负面 / Negative：写实、3D 渲染、照片、渐变、柔光、发光、投影、景深、模糊、噪点纹理、细碎细节、多个主体、文字、水印、边框、背景场景，绿色主体 / photorealistic, 3d render, photo, gradient, soft lighting, glow, bloom, drop shadow, depth of field, blur, noisy texture, tiny details, multiple subjects, text, watermark, border, background scenery, green subject

#### `elite_berserk_1x1` — 狂暴 berserk

- 依据：`src/config.js gameplay.affixes.berserkChanceMult`
- 中文：单格精英磨石怪（同精英底形），词条特征占画面 1/3 以上。唯一的大机制特征：裂开的外壳露出炽热内核 + 锯齿尖刺。占格 1×1，轮廓填满该比例的外框。配色：火（暗红→橙→浅黄）、磨石（暖灰褐）。像素画友好的游戏素材概念图，正交 3/4 俯视角，平涂无光照，无投影、无渐变、无轮廓光、无发光，单一主体居中占画面约 80%，粗而干净的剪影与深色粗描边，大色块，最多 6 种颜色，纯色背景 #00FF00，无文字无字母无 UI 边框
- English: a single-cell elite whetstone creature (same base as the elite), the affix feature covering at least a third of the figure. One big readable mechanic feature: split-open shell exposing a red-hot core, jagged spikes. Footprint 1x1 cells; the silhouette fills a box of that aspect ratio. Palette: fire ramp (dark red to orange to pale yellow), warm grey-brown whetstone. pixel-art-ready game sprite concept, orthographic 3/4 top-down view, flat unlit cel colours, no cast shadow, no gradient, no rim light, no glow, single subject centred filling about 80% of the frame, bold clean silhouette with a thick dark outline, large flat colour blocks, at most 6 colours, solid pure #00FF00 background, no text, no letters, no UI frame
- 负面 / Negative：写实、3D 渲染、照片、渐变、柔光、发光、投影、景深、模糊、噪点纹理、细碎细节、多个主体、文字、水印、边框、背景场景，绿色主体 / photorealistic, 3d render, photo, gradient, soft lighting, glow, bloom, drop shadow, depth of field, blur, noisy texture, tiny details, multiple subjects, text, watermark, border, background scenery, green subject

#### `elite_devour_1x1` — 吞噬 devour

- 依据：`src/config.js gameplay.affixes.devourChance`
- 中文：单格精英磨石怪（同精英底形），词条特征占画面 1/3 以上。唯一的大机制特征：正面一张大獠牙口。占格 1×1，轮廓填满该比例的外框。配色：激光（酒红→粉）、磨石（暖灰褐）。像素画友好的游戏素材概念图，正交 3/4 俯视角，平涂无光照，无投影、无渐变、无轮廓光、无发光，单一主体居中占画面约 80%，粗而干净的剪影与深色粗描边，大色块，最多 6 种颜色，纯色背景 #00FF00，无文字无字母无 UI 边框
- English: a single-cell elite whetstone creature (same base as the elite), the affix feature covering at least a third of the figure. One big readable mechanic feature: one big fanged mouth on the front. Footprint 1x1 cells; the silhouette fills a box of that aspect ratio. Palette: laser ramp (wine red to pink), warm grey-brown whetstone. pixel-art-ready game sprite concept, orthographic 3/4 top-down view, flat unlit cel colours, no cast shadow, no gradient, no rim light, no glow, single subject centred filling about 80% of the frame, bold clean silhouette with a thick dark outline, large flat colour blocks, at most 6 colours, solid pure #00FF00 background, no text, no letters, no UI frame
- 负面 / Negative：写实、3D 渲染、照片、渐变、柔光、发光、投影、景深、模糊、噪点纹理、细碎细节、多个主体、文字、水印、边框、背景场景，绿色主体 / photorealistic, 3d render, photo, gradient, soft lighting, glow, bloom, drop shadow, depth of field, blur, noisy texture, tiny details, multiple subjects, text, watermark, border, background scenery, green subject

#### `elite_radiantAegis_1x1` — 流彩护盾 radiantAegis

- 依据：`src/config.js gameplay.affixes.radiantAegisBossRegenPct`
- 中文：单格精英磨石怪（同精英底形），词条特征占画面 1/3 以上。唯一的大机制特征：头顶一圈棱镜冠片。占格 1×1，轮廓填满该比例的外框。配色：冰（深蓝→青→冰白）、激光（酒红→粉）。像素画友好的游戏素材概念图，正交 3/4 俯视角，平涂无光照，无投影、无渐变、无轮廓光、无发光，单一主体居中占画面约 80%，粗而干净的剪影与深色粗描边，大色块，最多 6 种颜色，纯色背景 #00FF00，无文字无字母无 UI 边框
- English: a single-cell elite whetstone creature (same base as the elite), the affix feature covering at least a third of the figure. One big readable mechanic feature: a crown of prismatic plates on top. Footprint 1x1 cells; the silhouette fills a box of that aspect ratio. Palette: ice ramp (deep blue to cyan to ice white), laser ramp (wine red to pink). pixel-art-ready game sprite concept, orthographic 3/4 top-down view, flat unlit cel colours, no cast shadow, no gradient, no rim light, no glow, single subject centred filling about 80% of the frame, bold clean silhouette with a thick dark outline, large flat colour blocks, at most 6 colours, solid pure #00FF00 background, no text, no letters, no UI frame
- 负面 / Negative：写实、3D 渲染、照片、渐变、柔光、发光、投影、景深、模糊、噪点纹理、细碎细节、多个主体、文字、水印、边框、背景场景，绿色主体 / photorealistic, 3d render, photo, gradient, soft lighting, glow, bloom, drop shadow, depth of field, blur, noisy texture, tiny details, multiple subjects, text, watermark, border, background scenery, green subject

#### `elite_livingArmor_1x1` — 活体护甲 livingArmor

- 依据：`src/config.js gameplay.affixes.livingArmorPct`
- 中文：单格精英磨石怪（同精英底形），词条特征占画面 1/3 以上。唯一的大机制特征：树皮状的活体外壳包裹。占格 1×1，轮廓填满该比例的外框。配色：毒（墨绿→酸绿）、磨石（暖灰褐）。像素画友好的游戏素材概念图，正交 3/4 俯视角，平涂无光照，无投影、无渐变、无轮廓光、无发光，单一主体居中占画面约 80%，粗而干净的剪影与深色粗描边，大色块，最多 6 种颜色，纯色背景 #FF00FF，无文字无字母无 UI 边框
- English: a single-cell elite whetstone creature (same base as the elite), the affix feature covering at least a third of the figure. One big readable mechanic feature: a bark-like living shell wrapping the body. Footprint 1x1 cells; the silhouette fills a box of that aspect ratio. Palette: venom ramp (dark green to acid green), warm grey-brown whetstone. pixel-art-ready game sprite concept, orthographic 3/4 top-down view, flat unlit cel colours, no cast shadow, no gradient, no rim light, no glow, single subject centred filling about 80% of the frame, bold clean silhouette with a thick dark outline, large flat colour blocks, at most 6 colours, solid pure #FF00FF background, no text, no letters, no UI frame
- 负面 / Negative：写实、3D 渲染、照片、渐变、柔光、发光、投影、景深、模糊、噪点纹理、细碎细节、多个主体、文字、水印、边框、背景场景，品红色主体 / photorealistic, 3d render, photo, gradient, soft lighting, glow, bloom, drop shadow, depth of field, blur, noisy texture, tiny details, multiple subjects, text, watermark, border, background scenery, magenta subject

#### `elite_armorSpore_1x1` — 护甲孢子 armorSpore

- 依据：`src/config.js gameplay.affixes.armorSporeStackPct`
- 中文：单格精英磨石怪（同精英底形），词条特征占画面 1/3 以上。唯一的大机制特征：甲片上长着两颗孢子囊。占格 1×1，轮廓填满该比例的外框。配色：毒（墨绿→酸绿）、钢（蓝灰）。像素画友好的游戏素材概念图，正交 3/4 俯视角，平涂无光照，无投影、无渐变、无轮廓光、无发光，单一主体居中占画面约 80%，粗而干净的剪影与深色粗描边，大色块，最多 6 种颜色，纯色背景 #FF00FF，无文字无字母无 UI 边框
- English: a single-cell elite whetstone creature (same base as the elite), the affix feature covering at least a third of the figure. One big readable mechanic feature: two spore pods growing on armour plates. Footprint 1x1 cells; the silhouette fills a box of that aspect ratio. Palette: venom ramp (dark green to acid green), steel blue-grey. pixel-art-ready game sprite concept, orthographic 3/4 top-down view, flat unlit cel colours, no cast shadow, no gradient, no rim light, no glow, single subject centred filling about 80% of the frame, bold clean silhouette with a thick dark outline, large flat colour blocks, at most 6 colours, solid pure #FF00FF background, no text, no letters, no UI frame
- 负面 / Negative：写实、3D 渲染、照片、渐变、柔光、发光、投影、景深、模糊、噪点纹理、细碎细节、多个主体、文字、水印、边框、背景场景，品红色主体 / photorealistic, 3d render, photo, gradient, soft lighting, glow, bloom, drop shadow, depth of field, blur, noisy texture, tiny details, multiple subjects, text, watermark, border, background scenery, magenta subject

#### `elite_siegeBreaker_1x1` — 撞城者 siegeBreaker

- 依据：`src/config.js gameplay.affixes.siegeBreakerDamageMult`
- 中文：单格精英磨石怪（同精英底形），词条特征占画面 1/3 以上。唯一的大机制特征：正前方一根加固撞角。占格 1×1，轮廓填满该比例的外框。配色：钢（蓝灰）、磨石（暖灰褐）。像素画友好的游戏素材概念图，正交 3/4 俯视角，平涂无光照，无投影、无渐变、无轮廓光、无发光，单一主体居中占画面约 80%，粗而干净的剪影与深色粗描边，大色块，最多 6 种颜色，纯色背景 #00FF00，无文字无字母无 UI 边框
- English: a single-cell elite whetstone creature (same base as the elite), the affix feature covering at least a third of the figure. One big readable mechanic feature: one reinforced ram horn in front. Footprint 1x1 cells; the silhouette fills a box of that aspect ratio. Palette: steel blue-grey, warm grey-brown whetstone. pixel-art-ready game sprite concept, orthographic 3/4 top-down view, flat unlit cel colours, no cast shadow, no gradient, no rim light, no glow, single subject centred filling about 80% of the frame, bold clean silhouette with a thick dark outline, large flat colour blocks, at most 6 colours, solid pure #00FF00 background, no text, no letters, no UI frame
- 负面 / Negative：写实、3D 渲染、照片、渐变、柔光、发光、投影、景深、模糊、噪点纹理、细碎细节、多个主体、文字、水印、边框、背景场景，绿色主体 / photorealistic, 3d render, photo, gradient, soft lighting, glow, bloom, drop shadow, depth of field, blur, noisy texture, tiny details, multiple subjects, text, watermark, border, background scenery, green subject

#### `elite_deflectShell_1x1` — 偏折壳 deflectShell

- 依据：`src/config.js gameplay.affixes.deflectShellNormalRotateAmp`
- 中文：单格精英磨石怪（同精英底形），词条特征占画面 1/3 以上。唯一的大机制特征：光滑多棱面的倾斜外壳（子弹会被弹偏）。占格 1×1，轮廓填满该比例的外框。配色：冰（深蓝→青→冰白）、钢（蓝灰）。像素画友好的游戏素材概念图，正交 3/4 俯视角，平涂无光照，无投影、无渐变、无轮廓光、无发光，单一主体居中占画面约 80%，粗而干净的剪影与深色粗描边，大色块，最多 6 种颜色，纯色背景 #00FF00，无文字无字母无 UI 边框
- English: a single-cell elite whetstone creature (same base as the elite), the affix feature covering at least a third of the figure. One big readable mechanic feature: a smooth faceted slanted shell that deflects shots. Footprint 1x1 cells; the silhouette fills a box of that aspect ratio. Palette: ice ramp (deep blue to cyan to ice white), steel blue-grey. pixel-art-ready game sprite concept, orthographic 3/4 top-down view, flat unlit cel colours, no cast shadow, no gradient, no rim light, no glow, single subject centred filling about 80% of the frame, bold clean silhouette with a thick dark outline, large flat colour blocks, at most 6 colours, solid pure #00FF00 background, no text, no letters, no UI frame
- 负面 / Negative：写实、3D 渲染、照片、渐变、柔光、发光、投影、景深、模糊、噪点纹理、细碎细节、多个主体、文字、水印、边框、背景场景，绿色主体 / photorealistic, 3d render, photo, gradient, soft lighting, glow, bloom, drop shadow, depth of field, blur, noisy texture, tiny details, multiple subjects, text, watermark, border, background scenery, green subject

#### `elite_energyArmor_1x1` — 蓄能甲 energyArmor

- 依据：`src/config.js gameplay.affixes.energyArmorThresholdPct`
- 中文：单格精英磨石怪（同精英底形），词条特征占画面 1/3 以上。唯一的大机制特征：胸前一块蓄电池甲板（电格刻度）。占格 1×1，轮廓填满该比例的外框。配色：雷（暗金→亮黄）、钢（蓝灰）。像素画友好的游戏素材概念图，正交 3/4 俯视角，平涂无光照，无投影、无渐变、无轮廓光、无发光，单一主体居中占画面约 80%，粗而干净的剪影与深色粗描边，大色块，最多 6 种颜色，纯色背景 #00FF00，无文字无字母无 UI 边框
- English: a single-cell elite whetstone creature (same base as the elite), the affix feature covering at least a third of the figure. One big readable mechanic feature: a battery plate with charge cells on the chest. Footprint 1x1 cells; the silhouette fills a box of that aspect ratio. Palette: lightning ramp (dark gold to bright yellow), steel blue-grey. pixel-art-ready game sprite concept, orthographic 3/4 top-down view, flat unlit cel colours, no cast shadow, no gradient, no rim light, no glow, single subject centred filling about 80% of the frame, bold clean silhouette with a thick dark outline, large flat colour blocks, at most 6 colours, solid pure #00FF00 background, no text, no letters, no UI frame
- 负面 / Negative：写实、3D 渲染、照片、渐变、柔光、发光、投影、景深、模糊、噪点纹理、细碎细节、多个主体、文字、水印、边框、背景场景，绿色主体 / photorealistic, 3d render, photo, gradient, soft lighting, glow, bloom, drop shadow, depth of field, blur, noisy texture, tiny details, multiple subjects, text, watermark, border, background scenery, green subject

#### `elite_phaseShield_1x1` — 相位护盾 phaseShield

- 依据：`src/config.js gameplay.affixes.phaseShieldCycle`
- 中文：单格精英磨石怪（同精英底形），词条特征占画面 1/3 以上。唯一的大机制特征：偏移半格的幽灵重影外壳。占格 1×1，轮廓填满该比例的外框。配色：回响（靛→紫→淡紫）、白（仅高光）。像素画友好的游戏素材概念图，正交 3/4 俯视角，平涂无光照，无投影、无渐变、无轮廓光、无发光，单一主体居中占画面约 80%，粗而干净的剪影与深色粗描边，大色块，最多 6 种颜色，纯色背景 #00FF00，无文字无字母无 UI 边框
- English: a single-cell elite whetstone creature (same base as the elite), the affix feature covering at least a third of the figure. One big readable mechanic feature: a ghostly duplicate shell offset by half a step. Footprint 1x1 cells; the silhouette fills a box of that aspect ratio. Palette: echo ramp (indigo to violet to lavender), white highlights only. pixel-art-ready game sprite concept, orthographic 3/4 top-down view, flat unlit cel colours, no cast shadow, no gradient, no rim light, no glow, single subject centred filling about 80% of the frame, bold clean silhouette with a thick dark outline, large flat colour blocks, at most 6 colours, solid pure #00FF00 background, no text, no letters, no UI frame
- 负面 / Negative：写实、3D 渲染、照片、渐变、柔光、发光、投影、景深、模糊、噪点纹理、细碎细节、多个主体、文字、水印、边框、背景场景，绿色主体 / photorealistic, 3d render, photo, gradient, soft lighting, glow, bloom, drop shadow, depth of field, blur, noisy texture, tiny details, multiple subjects, text, watermark, border, background scenery, green subject

#### `elite_overloadReactor_1x1` — 过量反应炉 overloadReactor

- 依据：`src/config.js gameplay.affixes.overloadStepPct`
- 中文：单格精英磨石怪（同精英底形），词条特征占画面 1/3 以上。唯一的大机制特征：背后两根反应炉排气管。占格 1×1，轮廓填满该比例的外框。配色：火（暗红→橙→浅黄）、雷（暗金→亮黄）。像素画友好的游戏素材概念图，正交 3/4 俯视角，平涂无光照，无投影、无渐变、无轮廓光、无发光，单一主体居中占画面约 80%，粗而干净的剪影与深色粗描边，大色块，最多 6 种颜色，纯色背景 #00FF00，无文字无字母无 UI 边框
- English: a single-cell elite whetstone creature (same base as the elite), the affix feature covering at least a third of the figure. One big readable mechanic feature: two reactor exhaust vents on the back. Footprint 1x1 cells; the silhouette fills a box of that aspect ratio. Palette: fire ramp (dark red to orange to pale yellow), lightning ramp (dark gold to bright yellow). pixel-art-ready game sprite concept, orthographic 3/4 top-down view, flat unlit cel colours, no cast shadow, no gradient, no rim light, no glow, single subject centred filling about 80% of the frame, bold clean silhouette with a thick dark outline, large flat colour blocks, at most 6 colours, solid pure #00FF00 background, no text, no letters, no UI frame
- 负面 / Negative：写实、3D 渲染、照片、渐变、柔光、发光、投影、景深、模糊、噪点纹理、细碎细节、多个主体、文字、水印、边框、背景场景，绿色主体 / photorealistic, 3d render, photo, gradient, soft lighting, glow, bloom, drop shadow, depth of field, blur, noisy texture, tiny details, multiple subjects, text, watermark, border, background scenery, green subject

#### `elite_lowDamageImmune_1x1` — 低伤免疫 lowDamageImmune

- 依据：`src/config.js gameplay.affixes.lowDamageImmunePct`
- 中文：单格精英磨石怪（同精英底形），词条特征占画面 1/3 以上。唯一的大机制特征：钻石般的厚硬棱面外壳。占格 1×1，轮廓填满该比例的外框。配色：钢（蓝灰）、白（仅高光）。像素画友好的游戏素材概念图，正交 3/4 俯视角，平涂无光照，无投影、无渐变、无轮廓光、无发光，单一主体居中占画面约 80%，粗而干净的剪影与深色粗描边，大色块，最多 6 种颜色，纯色背景 #00FF00，无文字无字母无 UI 边框
- English: a single-cell elite whetstone creature (same base as the elite), the affix feature covering at least a third of the figure. One big readable mechanic feature: a thick diamond-hard faceted carapace. Footprint 1x1 cells; the silhouette fills a box of that aspect ratio. Palette: steel blue-grey, white highlights only. pixel-art-ready game sprite concept, orthographic 3/4 top-down view, flat unlit cel colours, no cast shadow, no gradient, no rim light, no glow, single subject centred filling about 80% of the frame, bold clean silhouette with a thick dark outline, large flat colour blocks, at most 6 colours, solid pure #00FF00 background, no text, no letters, no UI frame
- 负面 / Negative：写实、3D 渲染、照片、渐变、柔光、发光、投影、景深、模糊、噪点纹理、细碎细节、多个主体、文字、水印、边框、背景场景，绿色主体 / photorealistic, 3d render, photo, gradient, soft lighting, glow, bloom, drop shadow, depth of field, blur, noisy texture, tiny details, multiple subjects, text, watermark, border, background scenery, green subject

#### `elite_runeBearer_1x1` — 符文携带者 runeBearer

- 依据：`src/config.js gameplay.affixes.runeBearerTempAffixPool`
- 中文：单格精英磨石怪（同精英底形），词条特征占画面 1/3 以上。唯一的大机制特征：背着一块刻符石板（只画符号形，不画文字）。占格 1×1，轮廓填满该比例的外框。配色：回响（靛→紫→淡紫）、磨石（暖灰褐）。像素画友好的游戏素材概念图，正交 3/4 俯视角，平涂无光照，无投影、无渐变、无轮廓光、无发光，单一主体居中占画面约 80%，粗而干净的剪影与深色粗描边，大色块，最多 6 种颜色，纯色背景 #00FF00，无文字无字母无 UI 边框
- English: a single-cell elite whetstone creature (same base as the elite), the affix feature covering at least a third of the figure. One big readable mechanic feature: carrying a carved rune tablet (glyph shape only, no letters). Footprint 1x1 cells; the silhouette fills a box of that aspect ratio. Palette: echo ramp (indigo to violet to lavender), warm grey-brown whetstone. pixel-art-ready game sprite concept, orthographic 3/4 top-down view, flat unlit cel colours, no cast shadow, no gradient, no rim light, no glow, single subject centred filling about 80% of the frame, bold clean silhouette with a thick dark outline, large flat colour blocks, at most 6 colours, solid pure #00FF00 background, no text, no letters, no UI frame
- 负面 / Negative：写实、3D 渲染、照片、渐变、柔光、发光、投影、景深、模糊、噪点纹理、细碎细节、多个主体、文字、水印、边框、背景场景，绿色主体 / photorealistic, 3d render, photo, gradient, soft lighting, glow, bloom, drop shadow, depth of field, blur, noisy texture, tiny details, multiple subjects, text, watermark, border, background scenery, green subject

</details>

## 5. Boss（弱点必须可读）（8 条）

| id | 名称 | 类别 / 网格 | 占格 | 必须可读的特征 | 色带 | 键色 | 请求尺寸 |
|---|---|---|---|---|---|---|---|
| `boss_ignis` | 熔炉守卫·伊格尼斯 | `boss_2x2` 48×48 | 2×2 | 外层多块护盾甲片 + 胸口熔炉；**弱点**：胸口熔炉格栅（破甲熔炉：穿透 / 火 3 次命中）（Boss 尺寸以规格 §2.2 为准；当前代码 4×3 格（spawn_system.js:2587）待对齐） | pyro / steel | `#00FF00` | 1024x1024 |
| `boss_glacies` | 霜晶缝合怪·格拉西斯 | `boss_2x2` 48×48 | 2×2 | 全身缝合的冰晶块 + 强壮跳跃后腿；**弱点**：正中一道发光的缝合冰裂（冻结裂隙：冰 / 穿透）（Boss 尺寸以规格 §2.2 为准；当前代码 4×3 格（spawn_system.js:2587）待对齐） | cryo / steel | `#00FF00` | 1024x1024 |
| `boss_mikro` | 裂变母体·米克罗 | `boss_2x2` 48×48 | 2×2 | 半透明细胞母体 + 外缘三个连接分身的链节；**弱点**：膜上三个链节（群体断链：雷 / 散射 5 次命中）（Boss 尺寸以规格 §2.2 为准；当前代码 4×3 格（spawn_system.js:2587）待对齐） | echo / white | `#00FF00` | 1024x1024 |
| `boss_devourer` | 贪婪之渊·噬神者 | `boss_2x2` 48×48 | 2×2 | 占身体一半的深渊巨口；**弱点**：巨口内部（深渊开口：弹射 / 激光）（Boss 尺寸以规格 §2.2 为准；当前代码 4×3 格（spawn_system.js:2587）待对齐） | laser / stone | `#00FF00` | 1024x1024 |
| `boss_viridis` | 翠绿共生体·维里迪斯 | `boss_3x3` 72×72 | 3×3 | 孢甲甲片 + 正中开花的孢子囊；**弱点**：正中孢子花苞（孢甲净化：火 / 毒）（Boss 尺寸以规格 §2.2 为准；当前代码 4×3 格（spawn_system.js:2587）待对齐） | venom / stone | `#FF00FF` | 1024x1024 |
| `boss_tesla` | 雷霆幻影·特斯拉 | `boss_3x3` 72×72 | 3×3 | 肩上两组导体线圈 + 脚下一根接地桩；**弱点**：脚下接地桩（导体接地：冰 / 弹射 4 次命中）（Boss 尺寸以规格 §2.2 为准；当前代码 4×3 格（spawn_system.js:2587）待对齐） | lightning / cryo | `#00FF00` | 1024x1024 |
| `boss_chimera` | 混沌融合体·奇美拉 | `boss_3x3` 72×72 | 3×3 | 左半冰冷、右半炽热的融合体 + 中间污染胃囊；**弱点**：中央污染胃囊（污染胃域：毒 / 激光）（Boss 尺寸以规格 §2.2 为准；当前代码 4×3 格（spawn_system.js:2587）待对齐） | venom / pyro / cryo | `#FF00FF` | 1024x1024 |
| `boss_ouroboros` | 永恒回声·奥罗波罗斯 | `boss_3x3` 72×72 | 3×3 | 首尾相衔的巨蛇环 + 环上六个附体插槽；**弱点**：当前点亮的那个插槽（轮转破绽，6 组）（Boss 尺寸以规格 §2.2 为准；当前代码 4×3 格（spawn_system.js:2587）待对齐） | echo / steel | `#00FF00` | 1024x1024 |

<details><summary>逐条提示词（中 / 英 / 负面）</summary>

#### `boss_ignis` — 熔炉守卫·伊格尼斯

- 依据：`src/config.js bossConfigs.ignis (vulnerability) + BOSS_DB`
- 中文：厚重的熔炉守卫，石甲覆盖全身，胸口炉门。唯一的大机制特征：外层多块护盾甲片 + 胸口熔炉。弱点必须清晰可见并做成最亮色块：胸口熔炉格栅（破甲熔炉：穿透 / 火 3 次命中）。占格 2×2，轮廓填满该比例的外框。配色：火（暗红→橙→浅黄）、钢（蓝灰）。像素画友好的游戏素材概念图，正交 3/4 俯视角，平涂无光照，无投影、无渐变、无轮廓光、无发光，单一主体居中占画面约 80%，粗而干净的剪影与深色粗描边，大色块，最多 6 种颜色，纯色背景 #00FF00，无文字无字母无 UI 边框
- English: a heavy furnace guardian covered in stone armour with a furnace door on the chest. One big readable mechanic feature: layered outer shield plates over a chest furnace. The weak point must be clearly visible as the brightest block: the chest furnace grille (pierce / pyro, 3 hits). Footprint 2x2 cells; the silhouette fills a box of that aspect ratio. Palette: fire ramp (dark red to orange to pale yellow), steel blue-grey. pixel-art-ready game sprite concept, orthographic 3/4 top-down view, flat unlit cel colours, no cast shadow, no gradient, no rim light, no glow, single subject centred filling about 80% of the frame, bold clean silhouette with a thick dark outline, large flat colour blocks, at most 6 colours, solid pure #00FF00 background, no text, no letters, no UI frame
- 负面 / Negative：写实、3D 渲染、照片、渐变、柔光、发光、投影、景深、模糊、噪点纹理、细碎细节、多个主体、文字、水印、边框、背景场景，绿色主体 / photorealistic, 3d render, photo, gradient, soft lighting, glow, bloom, drop shadow, depth of field, blur, noisy texture, tiny details, multiple subjects, text, watermark, border, background scenery, green subject

#### `boss_glacies` — 霜晶缝合怪·格拉西斯

- 依据：`src/config.js bossConfigs.glacies (vulnerability) + BOSS_DB`
- 中文：由冰晶块缝合而成的怪物。唯一的大机制特征：全身缝合的冰晶块 + 强壮跳跃后腿。弱点必须清晰可见并做成最亮色块：正中一道发光的缝合冰裂（冻结裂隙：冰 / 穿透）。占格 2×2，轮廓填满该比例的外框。配色：冰（深蓝→青→冰白）、钢（蓝灰）。像素画友好的游戏素材概念图，正交 3/4 俯视角，平涂无光照，无投影、无渐变、无轮廓光、无发光，单一主体居中占画面约 80%，粗而干净的剪影与深色粗描边，大色块，最多 6 种颜色，纯色背景 #00FF00，无文字无字母无 UI 边框
- English: a monster stitched together from ice crystal chunks. One big readable mechanic feature: stitched ice crystal chunks and strong jumping hind legs. The weak point must be clearly visible as the brightest block: one glowing stitched ice seam in the middle (cryo / pierce). Footprint 2x2 cells; the silhouette fills a box of that aspect ratio. Palette: ice ramp (deep blue to cyan to ice white), steel blue-grey. pixel-art-ready game sprite concept, orthographic 3/4 top-down view, flat unlit cel colours, no cast shadow, no gradient, no rim light, no glow, single subject centred filling about 80% of the frame, bold clean silhouette with a thick dark outline, large flat colour blocks, at most 6 colours, solid pure #00FF00 background, no text, no letters, no UI frame
- 负面 / Negative：写实、3D 渲染、照片、渐变、柔光、发光、投影、景深、模糊、噪点纹理、细碎细节、多个主体、文字、水印、边框、背景场景，绿色主体 / photorealistic, 3d render, photo, gradient, soft lighting, glow, bloom, drop shadow, depth of field, blur, noisy texture, tiny details, multiple subjects, text, watermark, border, background scenery, green subject

#### `boss_mikro` — 裂变母体·米克罗

- 依据：`src/config.js bossConfigs.mikro (vulnerability) + BOSS_DB`
- 中文：巨大的分裂细胞母体，内部有多个核。唯一的大机制特征：半透明细胞母体 + 外缘三个连接分身的链节。弱点必须清晰可见并做成最亮色块：膜上三个链节（群体断链：雷 / 散射 5 次命中）。占格 2×2，轮廓填满该比例的外框。配色：回响（靛→紫→淡紫）、白（仅高光）。像素画友好的游戏素材概念图，正交 3/4 俯视角，平涂无光照，无投影、无渐变、无轮廓光、无发光，单一主体居中占画面约 80%，粗而干净的剪影与深色粗描边，大色块，最多 6 种颜色，纯色背景 #00FF00，无文字无字母无 UI 边框
- English: a giant dividing mother cell with several nuclei inside. One big readable mechanic feature: a translucent mother cell with three link nodes on its rim tethering clones. The weak point must be clearly visible as the brightest block: three link nodes on the membrane (lightning / scatter, 5 hits). Footprint 2x2 cells; the silhouette fills a box of that aspect ratio. Palette: echo ramp (indigo to violet to lavender), white highlights only. pixel-art-ready game sprite concept, orthographic 3/4 top-down view, flat unlit cel colours, no cast shadow, no gradient, no rim light, no glow, single subject centred filling about 80% of the frame, bold clean silhouette with a thick dark outline, large flat colour blocks, at most 6 colours, solid pure #00FF00 background, no text, no letters, no UI frame
- 负面 / Negative：写实、3D 渲染、照片、渐变、柔光、发光、投影、景深、模糊、噪点纹理、细碎细节、多个主体、文字、水印、边框、背景场景，绿色主体 / photorealistic, 3d render, photo, gradient, soft lighting, glow, bloom, drop shadow, depth of field, blur, noisy texture, tiny details, multiple subjects, text, watermark, border, background scenery, green subject

#### `boss_devourer` — 贪婪之渊·噬神者

- 依据：`src/config.js bossConfigs.devourer (vulnerability) + BOSS_DB`
- 中文：贪婪的深渊胃囊巨兽，环形獠牙。唯一的大机制特征：占身体一半的深渊巨口。弱点必须清晰可见并做成最亮色块：巨口内部（深渊开口：弹射 / 激光）。占格 2×2，轮廓填满该比例的外框。配色：激光（酒红→粉）、磨石（暖灰褐）。像素画友好的游戏素材概念图，正交 3/4 俯视角，平涂无光照，无投影、无渐变、无轮廓光、无发光，单一主体居中占画面约 80%，粗而干净的剪影与深色粗描边，大色块，最多 6 种颜色，纯色背景 #00FF00，无文字无字母无 UI 边框
- English: a greedy abyssal stomach beast with a ring of fangs. One big readable mechanic feature: an abyssal mouth taking up half the body. The weak point must be clearly visible as the brightest block: the inside of the mouth (bounce / laser). Footprint 2x2 cells; the silhouette fills a box of that aspect ratio. Palette: laser ramp (wine red to pink), warm grey-brown whetstone. pixel-art-ready game sprite concept, orthographic 3/4 top-down view, flat unlit cel colours, no cast shadow, no gradient, no rim light, no glow, single subject centred filling about 80% of the frame, bold clean silhouette with a thick dark outline, large flat colour blocks, at most 6 colours, solid pure #00FF00 background, no text, no letters, no UI frame
- 负面 / Negative：写实、3D 渲染、照片、渐变、柔光、发光、投影、景深、模糊、噪点纹理、细碎细节、多个主体、文字、水印、边框、背景场景，绿色主体 / photorealistic, 3d render, photo, gradient, soft lighting, glow, bloom, drop shadow, depth of field, blur, noisy texture, tiny details, multiple subjects, text, watermark, border, background scenery, green subject

#### `boss_viridis` — 翠绿共生体·维里迪斯

- 依据：`src/config.js bossConfigs.viridis (vulnerability) + BOSS_DB`
- 中文：巨大的植物-磨石共生体，甲片间长满孢子。唯一的大机制特征：孢甲甲片 + 正中开花的孢子囊。弱点必须清晰可见并做成最亮色块：正中孢子花苞（孢甲净化：火 / 毒）。占格 3×3，轮廓填满该比例的外框。配色：毒（墨绿→酸绿）、磨石（暖灰褐）。像素画友好的游戏素材概念图，正交 3/4 俯视角，平涂无光照，无投影、无渐变、无轮廓光、无发光，单一主体居中占画面约 80%，粗而干净的剪影与深色粗描边，大色块，最多 6 种颜色，纯色背景 #FF00FF，无文字无字母无 UI 边框
- English: a huge plant-and-stone symbiote with spores growing between plates. One big readable mechanic feature: spore-armour plates with a blooming spore pod in the centre. The weak point must be clearly visible as the brightest block: the central spore bloom (pyro / venom). Footprint 3x3 cells; the silhouette fills a box of that aspect ratio. Palette: venom ramp (dark green to acid green), warm grey-brown whetstone. pixel-art-ready game sprite concept, orthographic 3/4 top-down view, flat unlit cel colours, no cast shadow, no gradient, no rim light, no glow, single subject centred filling about 80% of the frame, bold clean silhouette with a thick dark outline, large flat colour blocks, at most 6 colours, solid pure #FF00FF background, no text, no letters, no UI frame
- 负面 / Negative：写实、3D 渲染、照片、渐变、柔光、发光、投影、景深、模糊、噪点纹理、细碎细节、多个主体、文字、水印、边框、背景场景，品红色主体 / photorealistic, 3d render, photo, gradient, soft lighting, glow, bloom, drop shadow, depth of field, blur, noisy texture, tiny details, multiple subjects, text, watermark, border, background scenery, magenta subject

#### `boss_tesla` — 雷霆幻影·特斯拉

- 依据：`src/config.js bossConfigs.tesla (vulnerability) + BOSS_DB`
- 中文：高速的雷电幻影机体。唯一的大机制特征：肩上两组导体线圈 + 脚下一根接地桩。弱点必须清晰可见并做成最亮色块：脚下接地桩（导体接地：冰 / 弹射 4 次命中）。占格 3×3，轮廓填满该比例的外框。配色：雷（暗金→亮黄）、冰（深蓝→青→冰白）。像素画友好的游戏素材概念图，正交 3/4 俯视角，平涂无光照，无投影、无渐变、无轮廓光、无发光，单一主体居中占画面约 80%，粗而干净的剪影与深色粗描边，大色块，最多 6 种颜色，纯色背景 #00FF00，无文字无字母无 UI 边框
- English: a fast lightning phantom construct. One big readable mechanic feature: two conductor coils on the shoulders and one grounding spike below. The weak point must be clearly visible as the brightest block: the grounding spike at the base (cryo / bounce, 4 hits). Footprint 3x3 cells; the silhouette fills a box of that aspect ratio. Palette: lightning ramp (dark gold to bright yellow), ice ramp (deep blue to cyan to ice white). pixel-art-ready game sprite concept, orthographic 3/4 top-down view, flat unlit cel colours, no cast shadow, no gradient, no rim light, no glow, single subject centred filling about 80% of the frame, bold clean silhouette with a thick dark outline, large flat colour blocks, at most 6 colours, solid pure #00FF00 background, no text, no letters, no UI frame
- 负面 / Negative：写实、3D 渲染、照片、渐变、柔光、发光、投影、景深、模糊、噪点纹理、细碎细节、多个主体、文字、水印、边框、背景场景，绿色主体 / photorealistic, 3d render, photo, gradient, soft lighting, glow, bloom, drop shadow, depth of field, blur, noisy texture, tiny details, multiple subjects, text, watermark, border, background scenery, green subject

#### `boss_chimera` — 混沌融合体·奇美拉

- 依据：`src/config.js bossConfigs.chimera (vulnerability) + BOSS_DB`
- 中文：两种生物拼合的混沌巨兽。唯一的大机制特征：左半冰冷、右半炽热的融合体 + 中间污染胃囊。弱点必须清晰可见并做成最亮色块：中央污染胃囊（污染胃域：毒 / 激光）。占格 3×3，轮廓填满该比例的外框。配色：毒（墨绿→酸绿）、火（暗红→橙→浅黄）、冰（深蓝→青→冰白）。像素画友好的游戏素材概念图，正交 3/4 俯视角，平涂无光照，无投影、无渐变、无轮廓光、无发光，单一主体居中占画面约 80%，粗而干净的剪影与深色粗描边，大色块，最多 6 种颜色，纯色背景 #FF00FF，无文字无字母无 UI 边框
- English: a chaotic beast fused from two creatures. One big readable mechanic feature: left half frozen, right half burning, polluted stomach in the middle. The weak point must be clearly visible as the brightest block: the central polluted stomach (venom / laser). Footprint 3x3 cells; the silhouette fills a box of that aspect ratio. Palette: venom ramp (dark green to acid green), fire ramp (dark red to orange to pale yellow), ice ramp (deep blue to cyan to ice white). pixel-art-ready game sprite concept, orthographic 3/4 top-down view, flat unlit cel colours, no cast shadow, no gradient, no rim light, no glow, single subject centred filling about 80% of the frame, bold clean silhouette with a thick dark outline, large flat colour blocks, at most 6 colours, solid pure #FF00FF background, no text, no letters, no UI frame
- 负面 / Negative：写实、3D 渲染、照片、渐变、柔光、发光、投影、景深、模糊、噪点纹理、细碎细节、多个主体、文字、水印、边框、背景场景，品红色主体 / photorealistic, 3d render, photo, gradient, soft lighting, glow, bloom, drop shadow, depth of field, blur, noisy texture, tiny details, multiple subjects, text, watermark, border, background scenery, magenta subject

#### `boss_ouroboros` — 永恒回声·奥罗波罗斯

- 依据：`src/config.js bossConfigs.ouroboros (vulnerability) + BOSS_DB`
- 中文：回响能量构成的衔尾蛇。唯一的大机制特征：首尾相衔的巨蛇环 + 环上六个附体插槽。弱点必须清晰可见并做成最亮色块：当前点亮的那个插槽（轮转破绽，6 组）。占格 3×3，轮廓填满该比例的外框。配色：回响（靛→紫→淡紫）、钢（蓝灰）。像素画友好的游戏素材概念图，正交 3/4 俯视角，平涂无光照，无投影、无渐变、无轮廓光、无发光，单一主体居中占画面约 80%，粗而干净的剪影与深色粗描边，大色块，最多 6 种颜色，纯色背景 #00FF00，无文字无字母无 UI 边框
- English: an ouroboros serpent made of echo energy. One big readable mechanic feature: a great serpent ring biting its tail with six attachment sockets on the ring. The weak point must be clearly visible as the brightest block: the currently lit socket (rotating weak point, 6 sets). Footprint 3x3 cells; the silhouette fills a box of that aspect ratio. Palette: echo ramp (indigo to violet to lavender), steel blue-grey. pixel-art-ready game sprite concept, orthographic 3/4 top-down view, flat unlit cel colours, no cast shadow, no gradient, no rim light, no glow, single subject centred filling about 80% of the frame, bold clean silhouette with a thick dark outline, large flat colour blocks, at most 6 colours, solid pure #00FF00 background, no text, no letters, no UI frame
- 负面 / Negative：写实、3D 渲染、照片、渐变、柔光、发光、投影、景深、模糊、噪点纹理、细碎细节、多个主体、文字、水印、边框、背景场景，绿色主体 / photorealistic, 3d render, photo, gradient, soft lighting, glow, bloom, drop shadow, depth of field, blur, noisy texture, tiny details, multiple subjects, text, watermark, border, background scenery, green subject

</details>

## 6. UI 图标（33 条）

| id | 名称 | 类别 / 网格 | 占格 | 必须可读的特征 | 色带 | 键色 | 请求尺寸 |
|---|---|---|---|---|---|---|---|
| `icon_energy_24` | 能量 ⚡ | `icon_24` 24×24 | — | 一道粗闪电能量结晶 | lightning | `#00FF00` | 1024x1024 |
| `icon_energy_16` | 能量 ⚡（HUD 16） | `icon_16` 16×16 | — | 一道粗闪电 | lightning | `#00FF00` | 1024x1024 |
| `icon_crystal_24` | 晶核 💎 | `icon_24` 24×24 | — | 一颗切面晶核宝石 | echo | `#00FF00` | 1024x1024 |
| `icon_crystal_16` | 晶核 💎（HUD 16） | `icon_16` 16×16 | — | 一颗菱形宝石 | echo | `#00FF00` | 1024x1024 |
| `icon_cannon_damage` | 主炮·伤害 | `icon_24` 24×24 | — | 炮口 + 一个向上箭头的炮弹（伤害） | pyro / steel | `#00FF00` | 1024x1024 |
| `icon_cannon_rate` | 主炮·射速 | `icon_24` 24×24 | — | 炮口 + 两发连射炮弹 | lightning / steel | `#00FF00` | 1024x1024 |
| `icon_cannon_bounce` | 主炮·弹道（反弹） | `icon_24` 24×24 | — | 一发炮弹走折线反弹轨迹 | cryo / steel | `#00FF00` | 1024x1024 |
| `icon_branch_pierce` | 分支·穿透 | `icon_24` 24×24 | — | 一把贯穿两块石板的飞剑 | steel / white | `#00FF00` | 1024x1024 |
| `icon_branch_scatter` | 分支·散射 | `icon_24` 24×24 | — | 三道扇形散开的风刃 | cryo / steel | `#00FF00` | 1024x1024 |
| `icon_branch_element_pyro` | 分支·元素（火） | `icon_24` 24×24 | — | 炮弹裹着火舌 | pyro | `#00FF00` | 1024x1024 |
| `icon_branch_element_cryo` | 分支·元素（冰） | `icon_24` 24×24 | — | 炮弹镶着冰菱 | cryo | `#00FF00` | 1024x1024 |
| `icon_branch_element_lightning` | 分支·元素（雷） | `icon_24` 24×24 | — | 炮弹缠着折线闪电 | lightning | `#00FF00` | 1024x1024 |
| `icon_facility_turret` | 设施·炮台 | `icon_24` 24×24 | — | 一座单管小炮台 | steel / pyro | `#00FF00` | 1024x1024 |
| `icon_facility_lightning_tower` | 设施·雷击塔 | `icon_24` 24×24 | — | 塔顶放出连锁闪电的高塔 | lightning / steel | `#00FF00` | 1024x1024 |
| `icon_facility_frost_tower` | 设施·冰霜塔 | `icon_24` 24×24 | — | 塔顶一颗冰晶的塔 | cryo / steel | `#00FF00` | 1024x1024 |
| `icon_facility_shield_generator` | 设施·结界发生器 | `icon_24` 24×24 | — | 底座上方一面半圆结界盾 | cryo / echo | `#00FF00` | 1024x1024 |
| `icon_facility_alchemy_collector` | 设施·炼金收集器 | `icon_24` 24×24 | — | 接住闪电能量的炼金漏斗 | lightning / stone | `#00FF00` | 1024x1024 |
| `icon_item_bomb` | 道具·炸弹 | `icon_24` 24×24 | — | 一颗点燃引信的圆炸弹 | pyro / steel | `#00FF00` | 1024x1024 |
| `icon_item_timestop` | 道具·时停 | `icon_24` 24×24 | — | 一只停住的沙漏 | echo / white | `#00FF00` | 1024x1024 |
| `icon_item_emergency_shield` | 道具·急救结界 | `icon_24` 24×24 | — | 一面带十字的盾 | cryo / white | `#00FF00` | 1024x1024 |
| `icon_item_extra_dig` | 道具·加挖 | `icon_24` 24×24 | — | 一把镐 + 两颗额外弹珠 | stone / lightning | `#00FF00` | 1024x1024 |
| `icon_mining_collector_plus1` | 挖矿·采集弹珠 +1 | `icon_24` 24×24 | — | 三颗弹珠排一行，最后一颗发亮 | steel / lightning | `#00FF00` | 1024x1024 |
| `icon_mining_wide_bucket` | 挖矿·宽口能量桶 | `icon_24` 24×24 | — | 一个口特别宽的能量桶 | lightning / stone | `#00FF00` | 1024x1024 |
| `icon_mining_magnet_peg` | 挖矿·磁力钉 | `icon_24` 24×24 | — | 一颗马蹄磁铁形的钉子吸住弹珠 | laser / steel | `#00FF00` | 1024x1024 |
| `icon_mining_throat_widen` | 挖矿·咽喉加宽 | `icon_24` 24×24 | — | 一道窄门被两个向外箭头撑宽 | echo / stone | `#00FF00` | 1024x1024 |
| `icon_mark_pyro` | 元素标记·火 | `icon_16` 16×16 | — | 一簇火舌 | pyro | `#00FF00` | 1024x1024 |
| `icon_mark_cryo` | 元素标记·冰 | `icon_16` 16×16 | — | 一颗冰菱 | cryo | `#00FF00` | 1024x1024 |
| `icon_mark_lightning` | 元素标记·雷 | `icon_16` 16×16 | — | 一道折线闪电 | lightning | `#00FF00` | 1024x1024 |
| `icon_mark_venom` | 元素标记·毒 | `icon_16` 16×16 | — | 一颗液滴 | venom | `#FF00FF` | 1024x1024 |
| `icon_mark_wind` | 元素标记·风 | `icon_16` 16×16 | — | 一个旋涡 | steel / cryo | `#00FF00` | 1024x1024 |
| `icon_mark_laser` | 元素标记·激光 | `icon_16` 16×16 | — | 一道直线光束 | laser | `#00FF00` | 1024x1024 |
| `icon_mark_pierce` | 元素标记·穿透 | `icon_16` 16×16 | — | 一支穿过横线的箭 | steel / white | `#00FF00` | 1024x1024 |
| `icon_mark_scatter` | 元素标记·散射 | `icon_16` 16×16 | — | 三道扇形短线 | cryo / white | `#00FF00` | 1024x1024 |

<details><summary>逐条提示词（中 / 英 / 负面）</summary>

#### `icon_energy_24` — 能量 ⚡

- 依据：`dig_build_defend_loop_v1.md §4`
- 中文：一道粗闪电能量结晶。只表达一个符号 + 一个元素色。配色：雷（暗金→亮黄）。像素画友好的游戏 UI 图标概念图，正面正交，平涂无光照，无投影、无渐变、无发光，单一符号居中占画面约 80%，粗剪影与深色粗描边，最多 6 种颜色，纯色背景 #00FF00，无文字无数字无边框
- English: a chunky lightning-bolt energy crystal. One symbol plus one element colour only. Palette: lightning ramp (dark gold to bright yellow). pixel-art-ready game UI icon concept, front orthographic view, flat unlit colours, no shadow, no gradient, no glow, one symbol centred filling about 80% of the frame, bold silhouette with a thick dark outline, at most 6 colours, solid pure #00FF00 background, no text, no numbers, no frame
- 负面 / Negative：写实、3D 渲染、照片、渐变、柔光、发光、投影、景深、模糊、噪点纹理、细碎细节、多个主体、文字、水印、边框、背景场景，绿色主体 / photorealistic, 3d render, photo, gradient, soft lighting, glow, bloom, drop shadow, depth of field, blur, noisy texture, tiny details, multiple subjects, text, watermark, border, background scenery, green subject

#### `icon_energy_16` — 能量 ⚡（HUD 16）

- 依据：`dig_build_defend_loop_v1.md §4`
- 中文：一道粗闪电。只表达一个符号 + 一个元素色。配色：雷（暗金→亮黄）。像素画友好的游戏 UI 图标概念图，正面正交，平涂无光照，无投影、无渐变、无发光，单一符号居中占画面约 80%，粗剪影与深色粗描边，最多 4 种颜色，纯色背景 #00FF00，无文字无数字无边框
- English: a single chunky lightning bolt. One symbol plus one element colour only. Palette: lightning ramp (dark gold to bright yellow). pixel-art-ready game UI icon concept, front orthographic view, flat unlit colours, no shadow, no gradient, no glow, one symbol centred filling about 80% of the frame, bold silhouette with a thick dark outline, at most 4 colours, solid pure #00FF00 background, no text, no numbers, no frame
- 负面 / Negative：写实、3D 渲染、照片、渐变、柔光、发光、投影、景深、模糊、噪点纹理、细碎细节、多个主体、文字、水印、边框、背景场景，绿色主体 / photorealistic, 3d render, photo, gradient, soft lighting, glow, bloom, drop shadow, depth of field, blur, noisy texture, tiny details, multiple subjects, text, watermark, border, background scenery, green subject

#### `icon_crystal_24` — 晶核 💎

- 依据：`dig_build_defend_loop_v1.md §4`
- 中文：一颗切面晶核宝石。只表达一个符号 + 一个元素色。配色：回响（靛→紫→淡紫）。像素画友好的游戏 UI 图标概念图，正面正交，平涂无光照，无投影、无渐变、无发光，单一符号居中占画面约 80%，粗剪影与深色粗描边，最多 6 种颜色，纯色背景 #00FF00，无文字无数字无边框
- English: one faceted crystal core gem. One symbol plus one element colour only. Palette: echo ramp (indigo to violet to lavender). pixel-art-ready game UI icon concept, front orthographic view, flat unlit colours, no shadow, no gradient, no glow, one symbol centred filling about 80% of the frame, bold silhouette with a thick dark outline, at most 6 colours, solid pure #00FF00 background, no text, no numbers, no frame
- 负面 / Negative：写实、3D 渲染、照片、渐变、柔光、发光、投影、景深、模糊、噪点纹理、细碎细节、多个主体、文字、水印、边框、背景场景，绿色主体 / photorealistic, 3d render, photo, gradient, soft lighting, glow, bloom, drop shadow, depth of field, blur, noisy texture, tiny details, multiple subjects, text, watermark, border, background scenery, green subject

#### `icon_crystal_16` — 晶核 💎（HUD 16）

- 依据：`dig_build_defend_loop_v1.md §4`
- 中文：一颗菱形宝石。只表达一个符号 + 一个元素色。配色：回响（靛→紫→淡紫）。像素画友好的游戏 UI 图标概念图，正面正交，平涂无光照，无投影、无渐变、无发光，单一符号居中占画面约 80%，粗剪影与深色粗描边，最多 4 种颜色，纯色背景 #00FF00，无文字无数字无边框
- English: one rhombus gem. One symbol plus one element colour only. Palette: echo ramp (indigo to violet to lavender). pixel-art-ready game UI icon concept, front orthographic view, flat unlit colours, no shadow, no gradient, no glow, one symbol centred filling about 80% of the frame, bold silhouette with a thick dark outline, at most 4 colours, solid pure #00FF00 background, no text, no numbers, no frame
- 负面 / Negative：写实、3D 渲染、照片、渐变、柔光、发光、投影、景深、模糊、噪点纹理、细碎细节、多个主体、文字、水印、边框、背景场景，绿色主体 / photorealistic, 3d render, photo, gradient, soft lighting, glow, bloom, drop shadow, depth of field, blur, noisy texture, tiny details, multiple subjects, text, watermark, border, background scenery, green subject

#### `icon_cannon_damage` — 主炮·伤害

- 依据：`dig_build_defend_loop_v1.md §5.1`
- 中文：炮口 + 一个向上箭头的炮弹（伤害）。只表达一个符号 + 一个元素色。配色：火（暗红→橙→浅黄）、钢（蓝灰）。像素画友好的游戏 UI 图标概念图，正面正交，平涂无光照，无投影、无渐变、无发光，单一符号居中占画面约 80%，粗剪影与深色粗描边，最多 6 种颜色，纯色背景 #00FF00，无文字无数字无边框
- English: a cannon muzzle with a heavy shell and an up arrow. One symbol plus one element colour only. Palette: fire ramp (dark red to orange to pale yellow), steel blue-grey. pixel-art-ready game UI icon concept, front orthographic view, flat unlit colours, no shadow, no gradient, no glow, one symbol centred filling about 80% of the frame, bold silhouette with a thick dark outline, at most 6 colours, solid pure #00FF00 background, no text, no numbers, no frame
- 负面 / Negative：写实、3D 渲染、照片、渐变、柔光、发光、投影、景深、模糊、噪点纹理、细碎细节、多个主体、文字、水印、边框、背景场景，绿色主体 / photorealistic, 3d render, photo, gradient, soft lighting, glow, bloom, drop shadow, depth of field, blur, noisy texture, tiny details, multiple subjects, text, watermark, border, background scenery, green subject

#### `icon_cannon_rate` — 主炮·射速

- 依据：`dig_build_defend_loop_v1.md §5.1`
- 中文：炮口 + 两发连射炮弹。只表达一个符号 + 一个元素色。配色：雷（暗金→亮黄）、钢（蓝灰）。像素画友好的游戏 UI 图标概念图，正面正交，平涂无光照，无投影、无渐变、无发光，单一符号居中占画面约 80%，粗剪影与深色粗描边，最多 6 种颜色，纯色背景 #00FF00，无文字无数字无边框
- English: a cannon muzzle firing two shells in a row. One symbol plus one element colour only. Palette: lightning ramp (dark gold to bright yellow), steel blue-grey. pixel-art-ready game UI icon concept, front orthographic view, flat unlit colours, no shadow, no gradient, no glow, one symbol centred filling about 80% of the frame, bold silhouette with a thick dark outline, at most 6 colours, solid pure #00FF00 background, no text, no numbers, no frame
- 负面 / Negative：写实、3D 渲染、照片、渐变、柔光、发光、投影、景深、模糊、噪点纹理、细碎细节、多个主体、文字、水印、边框、背景场景，绿色主体 / photorealistic, 3d render, photo, gradient, soft lighting, glow, bloom, drop shadow, depth of field, blur, noisy texture, tiny details, multiple subjects, text, watermark, border, background scenery, green subject

#### `icon_cannon_bounce` — 主炮·弹道（反弹）

- 依据：`dig_build_defend_loop_v1.md §5.1`
- 中文：一发炮弹走折线反弹轨迹。只表达一个符号 + 一个元素色。配色：冰（深蓝→青→冰白）、钢（蓝灰）。像素画友好的游戏 UI 图标概念图，正面正交，平涂无光照，无投影、无渐变、无发光，单一符号居中占画面约 80%，粗剪影与深色粗描边，最多 6 种颜色，纯色背景 #00FF00，无文字无数字无边框
- English: one shell on a zig-zag bouncing path. One symbol plus one element colour only. Palette: ice ramp (deep blue to cyan to ice white), steel blue-grey. pixel-art-ready game UI icon concept, front orthographic view, flat unlit colours, no shadow, no gradient, no glow, one symbol centred filling about 80% of the frame, bold silhouette with a thick dark outline, at most 6 colours, solid pure #00FF00 background, no text, no numbers, no frame
- 负面 / Negative：写实、3D 渲染、照片、渐变、柔光、发光、投影、景深、模糊、噪点纹理、细碎细节、多个主体、文字、水印、边框、背景场景，绿色主体 / photorealistic, 3d render, photo, gradient, soft lighting, glow, bloom, drop shadow, depth of field, blur, noisy texture, tiny details, multiple subjects, text, watermark, border, background scenery, green subject

#### `icon_branch_pierce` — 分支·穿透

- 依据：`dig_build_defend_loop_v1.md §5.1`
- 中文：一把贯穿两块石板的飞剑。只表达一个符号 + 一个元素色。配色：钢（蓝灰）、白（仅高光）。像素画友好的游戏 UI 图标概念图，正面正交，平涂无光照，无投影、无渐变、无发光，单一符号居中占画面约 80%，粗剪影与深色粗描边，最多 6 种颜色，纯色背景 #00FF00，无文字无数字无边框
- English: a flying sword piercing through two stone slabs. One symbol plus one element colour only. Palette: steel blue-grey, white highlights only. pixel-art-ready game UI icon concept, front orthographic view, flat unlit colours, no shadow, no gradient, no glow, one symbol centred filling about 80% of the frame, bold silhouette with a thick dark outline, at most 6 colours, solid pure #00FF00 background, no text, no numbers, no frame
- 负面 / Negative：写实、3D 渲染、照片、渐变、柔光、发光、投影、景深、模糊、噪点纹理、细碎细节、多个主体、文字、水印、边框、背景场景，绿色主体 / photorealistic, 3d render, photo, gradient, soft lighting, glow, bloom, drop shadow, depth of field, blur, noisy texture, tiny details, multiple subjects, text, watermark, border, background scenery, green subject

#### `icon_branch_scatter` — 分支·散射

- 依据：`dig_build_defend_loop_v1.md §5.1`
- 中文：三道扇形散开的风刃。只表达一个符号 + 一个元素色。配色：冰（深蓝→青→冰白）、钢（蓝灰）。像素画友好的游戏 UI 图标概念图，正面正交，平涂无光照，无投影、无渐变、无发光，单一符号居中占画面约 80%，粗剪影与深色粗描边，最多 6 种颜色，纯色背景 #00FF00，无文字无数字无边框
- English: three wind blades fanning out. One symbol plus one element colour only. Palette: ice ramp (deep blue to cyan to ice white), steel blue-grey. pixel-art-ready game UI icon concept, front orthographic view, flat unlit colours, no shadow, no gradient, no glow, one symbol centred filling about 80% of the frame, bold silhouette with a thick dark outline, at most 6 colours, solid pure #00FF00 background, no text, no numbers, no frame
- 负面 / Negative：写实、3D 渲染、照片、渐变、柔光、发光、投影、景深、模糊、噪点纹理、细碎细节、多个主体、文字、水印、边框、背景场景，绿色主体 / photorealistic, 3d render, photo, gradient, soft lighting, glow, bloom, drop shadow, depth of field, blur, noisy texture, tiny details, multiple subjects, text, watermark, border, background scenery, green subject

#### `icon_branch_element_pyro` — 分支·元素（火）

- 依据：`dig_build_defend_loop_v1.md §5.1`
- 中文：炮弹裹着火舌。只表达一个符号 + 一个元素色。配色：火（暗红→橙→浅黄）。像素画友好的游戏 UI 图标概念图，正面正交，平涂无光照，无投影、无渐变、无发光，单一符号居中占画面约 80%，粗剪影与深色粗描边，最多 6 种颜色，纯色背景 #00FF00，无文字无数字无边框
- English: a shell wrapped in flame tongues. One symbol plus one element colour only. Palette: fire ramp (dark red to orange to pale yellow). pixel-art-ready game UI icon concept, front orthographic view, flat unlit colours, no shadow, no gradient, no glow, one symbol centred filling about 80% of the frame, bold silhouette with a thick dark outline, at most 6 colours, solid pure #00FF00 background, no text, no numbers, no frame
- 负面 / Negative：写实、3D 渲染、照片、渐变、柔光、发光、投影、景深、模糊、噪点纹理、细碎细节、多个主体、文字、水印、边框、背景场景，绿色主体 / photorealistic, 3d render, photo, gradient, soft lighting, glow, bloom, drop shadow, depth of field, blur, noisy texture, tiny details, multiple subjects, text, watermark, border, background scenery, green subject

#### `icon_branch_element_cryo` — 分支·元素（冰）

- 依据：`dig_build_defend_loop_v1.md §5.1`
- 中文：炮弹镶着冰菱。只表达一个符号 + 一个元素色。配色：冰（深蓝→青→冰白）。像素画友好的游戏 UI 图标概念图，正面正交，平涂无光照，无投影、无渐变、无发光，单一符号居中占画面约 80%，粗剪影与深色粗描边，最多 6 种颜色，纯色背景 #00FF00，无文字无数字无边框
- English: a shell set with ice rhombus crystals. One symbol plus one element colour only. Palette: ice ramp (deep blue to cyan to ice white). pixel-art-ready game UI icon concept, front orthographic view, flat unlit colours, no shadow, no gradient, no glow, one symbol centred filling about 80% of the frame, bold silhouette with a thick dark outline, at most 6 colours, solid pure #00FF00 background, no text, no numbers, no frame
- 负面 / Negative：写实、3D 渲染、照片、渐变、柔光、发光、投影、景深、模糊、噪点纹理、细碎细节、多个主体、文字、水印、边框、背景场景，绿色主体 / photorealistic, 3d render, photo, gradient, soft lighting, glow, bloom, drop shadow, depth of field, blur, noisy texture, tiny details, multiple subjects, text, watermark, border, background scenery, green subject

#### `icon_branch_element_lightning` — 分支·元素（雷）

- 依据：`dig_build_defend_loop_v1.md §5.1`
- 中文：炮弹缠着折线闪电。只表达一个符号 + 一个元素色。配色：雷（暗金→亮黄）。像素画友好的游戏 UI 图标概念图，正面正交，平涂无光照，无投影、无渐变、无发光，单一符号居中占画面约 80%，粗剪影与深色粗描边，最多 6 种颜色，纯色背景 #00FF00，无文字无数字无边框
- English: a shell wrapped in zig-zag lightning. One symbol plus one element colour only. Palette: lightning ramp (dark gold to bright yellow). pixel-art-ready game UI icon concept, front orthographic view, flat unlit colours, no shadow, no gradient, no glow, one symbol centred filling about 80% of the frame, bold silhouette with a thick dark outline, at most 6 colours, solid pure #00FF00 background, no text, no numbers, no frame
- 负面 / Negative：写实、3D 渲染、照片、渐变、柔光、发光、投影、景深、模糊、噪点纹理、细碎细节、多个主体、文字、水印、边框、背景场景，绿色主体 / photorealistic, 3d render, photo, gradient, soft lighting, glow, bloom, drop shadow, depth of field, blur, noisy texture, tiny details, multiple subjects, text, watermark, border, background scenery, green subject

#### `icon_facility_turret` — 设施·炮台

- 依据：`dig_build_defend_loop_v1.md §5.2`
- 中文：一座单管小炮台。只表达一个符号 + 一个元素色。配色：钢（蓝灰）、火（暗红→橙→浅黄）。像素画友好的游戏 UI 图标概念图，正面正交，平涂无光照，无投影、无渐变、无发光，单一符号居中占画面约 80%，粗剪影与深色粗描边，最多 6 种颜色，纯色背景 #00FF00，无文字无数字无边框
- English: a small single-barrel turret. One symbol plus one element colour only. Palette: steel blue-grey, fire ramp (dark red to orange to pale yellow). pixel-art-ready game UI icon concept, front orthographic view, flat unlit colours, no shadow, no gradient, no glow, one symbol centred filling about 80% of the frame, bold silhouette with a thick dark outline, at most 6 colours, solid pure #00FF00 background, no text, no numbers, no frame
- 负面 / Negative：写实、3D 渲染、照片、渐变、柔光、发光、投影、景深、模糊、噪点纹理、细碎细节、多个主体、文字、水印、边框、背景场景，绿色主体 / photorealistic, 3d render, photo, gradient, soft lighting, glow, bloom, drop shadow, depth of field, blur, noisy texture, tiny details, multiple subjects, text, watermark, border, background scenery, green subject

#### `icon_facility_lightning_tower` — 设施·雷击塔

- 依据：`dig_build_defend_loop_v1.md §5.2`
- 中文：塔顶放出连锁闪电的高塔。只表达一个符号 + 一个元素色。配色：雷（暗金→亮黄）、钢（蓝灰）。像素画友好的游戏 UI 图标概念图，正面正交，平涂无光照，无投影、无渐变、无发光，单一符号居中占画面约 80%，粗剪影与深色粗描边，最多 6 种颜色，纯色背景 #00FF00，无文字无数字无边框
- English: a tower releasing a chain of lightning from its tip. One symbol plus one element colour only. Palette: lightning ramp (dark gold to bright yellow), steel blue-grey. pixel-art-ready game UI icon concept, front orthographic view, flat unlit colours, no shadow, no gradient, no glow, one symbol centred filling about 80% of the frame, bold silhouette with a thick dark outline, at most 6 colours, solid pure #00FF00 background, no text, no numbers, no frame
- 负面 / Negative：写实、3D 渲染、照片、渐变、柔光、发光、投影、景深、模糊、噪点纹理、细碎细节、多个主体、文字、水印、边框、背景场景，绿色主体 / photorealistic, 3d render, photo, gradient, soft lighting, glow, bloom, drop shadow, depth of field, blur, noisy texture, tiny details, multiple subjects, text, watermark, border, background scenery, green subject

#### `icon_facility_frost_tower` — 设施·冰霜塔

- 依据：`dig_build_defend_loop_v1.md §5.2`
- 中文：塔顶一颗冰晶的塔。只表达一个符号 + 一个元素色。配色：冰（深蓝→青→冰白）、钢（蓝灰）。像素画友好的游戏 UI 图标概念图，正面正交，平涂无光照，无投影、无渐变、无发光，单一符号居中占画面约 80%，粗剪影与深色粗描边，最多 6 种颜色，纯色背景 #00FF00，无文字无数字无边框
- English: a tower topped with an ice crystal. One symbol plus one element colour only. Palette: ice ramp (deep blue to cyan to ice white), steel blue-grey. pixel-art-ready game UI icon concept, front orthographic view, flat unlit colours, no shadow, no gradient, no glow, one symbol centred filling about 80% of the frame, bold silhouette with a thick dark outline, at most 6 colours, solid pure #00FF00 background, no text, no numbers, no frame
- 负面 / Negative：写实、3D 渲染、照片、渐变、柔光、发光、投影、景深、模糊、噪点纹理、细碎细节、多个主体、文字、水印、边框、背景场景，绿色主体 / photorealistic, 3d render, photo, gradient, soft lighting, glow, bloom, drop shadow, depth of field, blur, noisy texture, tiny details, multiple subjects, text, watermark, border, background scenery, green subject

#### `icon_facility_shield_generator` — 设施·结界发生器

- 依据：`dig_build_defend_loop_v1.md §5.2`
- 中文：底座上方一面半圆结界盾。只表达一个符号 + 一个元素色。配色：冰（深蓝→青→冰白）、回响（靛→紫→淡紫）。像素画友好的游戏 UI 图标概念图，正面正交，平涂无光照，无投影、无渐变、无发光，单一符号居中占画面约 80%，粗剪影与深色粗描边，最多 6 种颜色，纯色背景 #00FF00，无文字无数字无边框
- English: a half-dome barrier shield above a base. One symbol plus one element colour only. Palette: ice ramp (deep blue to cyan to ice white), echo ramp (indigo to violet to lavender). pixel-art-ready game UI icon concept, front orthographic view, flat unlit colours, no shadow, no gradient, no glow, one symbol centred filling about 80% of the frame, bold silhouette with a thick dark outline, at most 6 colours, solid pure #00FF00 background, no text, no numbers, no frame
- 负面 / Negative：写实、3D 渲染、照片、渐变、柔光、发光、投影、景深、模糊、噪点纹理、细碎细节、多个主体、文字、水印、边框、背景场景，绿色主体 / photorealistic, 3d render, photo, gradient, soft lighting, glow, bloom, drop shadow, depth of field, blur, noisy texture, tiny details, multiple subjects, text, watermark, border, background scenery, green subject

#### `icon_facility_alchemy_collector` — 设施·炼金收集器

- 依据：`dig_build_defend_loop_v1.md §5.2`
- 中文：接住闪电能量的炼金漏斗。只表达一个符号 + 一个元素色。配色：雷（暗金→亮黄）、磨石（暖灰褐）。像素画友好的游戏 UI 图标概念图，正面正交，平涂无光照，无投影、无渐变、无发光，单一符号居中占画面约 80%，粗剪影与深色粗描边，最多 6 种颜色，纯色背景 #00FF00，无文字无数字无边框
- English: an alchemy funnel catching lightning energy. One symbol plus one element colour only. Palette: lightning ramp (dark gold to bright yellow), warm grey-brown whetstone. pixel-art-ready game UI icon concept, front orthographic view, flat unlit colours, no shadow, no gradient, no glow, one symbol centred filling about 80% of the frame, bold silhouette with a thick dark outline, at most 6 colours, solid pure #00FF00 background, no text, no numbers, no frame
- 负面 / Negative：写实、3D 渲染、照片、渐变、柔光、发光、投影、景深、模糊、噪点纹理、细碎细节、多个主体、文字、水印、边框、背景场景，绿色主体 / photorealistic, 3d render, photo, gradient, soft lighting, glow, bloom, drop shadow, depth of field, blur, noisy texture, tiny details, multiple subjects, text, watermark, border, background scenery, green subject

#### `icon_item_bomb` — 道具·炸弹

- 依据：`dig_build_defend_loop_v1.md §5.4`
- 中文：一颗点燃引信的圆炸弹。只表达一个符号 + 一个元素色。配色：火（暗红→橙→浅黄）、钢（蓝灰）。像素画友好的游戏 UI 图标概念图，正面正交，平涂无光照，无投影、无渐变、无发光，单一符号居中占画面约 80%，粗剪影与深色粗描边，最多 6 种颜色，纯色背景 #00FF00，无文字无数字无边框
- English: one round bomb with a lit fuse. One symbol plus one element colour only. Palette: fire ramp (dark red to orange to pale yellow), steel blue-grey. pixel-art-ready game UI icon concept, front orthographic view, flat unlit colours, no shadow, no gradient, no glow, one symbol centred filling about 80% of the frame, bold silhouette with a thick dark outline, at most 6 colours, solid pure #00FF00 background, no text, no numbers, no frame
- 负面 / Negative：写实、3D 渲染、照片、渐变、柔光、发光、投影、景深、模糊、噪点纹理、细碎细节、多个主体、文字、水印、边框、背景场景，绿色主体 / photorealistic, 3d render, photo, gradient, soft lighting, glow, bloom, drop shadow, depth of field, blur, noisy texture, tiny details, multiple subjects, text, watermark, border, background scenery, green subject

#### `icon_item_timestop` — 道具·时停

- 依据：`dig_build_defend_loop_v1.md §5.4`
- 中文：一只停住的沙漏。只表达一个符号 + 一个元素色。配色：回响（靛→紫→淡紫）、白（仅高光）。像素画友好的游戏 UI 图标概念图，正面正交，平涂无光照，无投影、无渐变、无发光，单一符号居中占画面约 80%，粗剪影与深色粗描边，最多 6 种颜色，纯色背景 #00FF00，无文字无数字无边框
- English: one frozen hourglass. One symbol plus one element colour only. Palette: echo ramp (indigo to violet to lavender), white highlights only. pixel-art-ready game UI icon concept, front orthographic view, flat unlit colours, no shadow, no gradient, no glow, one symbol centred filling about 80% of the frame, bold silhouette with a thick dark outline, at most 6 colours, solid pure #00FF00 background, no text, no numbers, no frame
- 负面 / Negative：写实、3D 渲染、照片、渐变、柔光、发光、投影、景深、模糊、噪点纹理、细碎细节、多个主体、文字、水印、边框、背景场景，绿色主体 / photorealistic, 3d render, photo, gradient, soft lighting, glow, bloom, drop shadow, depth of field, blur, noisy texture, tiny details, multiple subjects, text, watermark, border, background scenery, green subject

#### `icon_item_emergency_shield` — 道具·急救结界

- 依据：`dig_build_defend_loop_v1.md §5.4`
- 中文：一面带十字的盾。只表达一个符号 + 一个元素色。配色：冰（深蓝→青→冰白）、白（仅高光）。像素画友好的游戏 UI 图标概念图，正面正交，平涂无光照，无投影、无渐变、无发光，单一符号居中占画面约 80%，粗剪影与深色粗描边，最多 6 种颜色，纯色背景 #00FF00，无文字无数字无边框
- English: a shield with a cross on it. One symbol plus one element colour only. Palette: ice ramp (deep blue to cyan to ice white), white highlights only. pixel-art-ready game UI icon concept, front orthographic view, flat unlit colours, no shadow, no gradient, no glow, one symbol centred filling about 80% of the frame, bold silhouette with a thick dark outline, at most 6 colours, solid pure #00FF00 background, no text, no numbers, no frame
- 负面 / Negative：写实、3D 渲染、照片、渐变、柔光、发光、投影、景深、模糊、噪点纹理、细碎细节、多个主体、文字、水印、边框、背景场景，绿色主体 / photorealistic, 3d render, photo, gradient, soft lighting, glow, bloom, drop shadow, depth of field, blur, noisy texture, tiny details, multiple subjects, text, watermark, border, background scenery, green subject

#### `icon_item_extra_dig` — 道具·加挖

- 依据：`dig_build_defend_loop_v1.md §5.4`
- 中文：一把镐 + 两颗额外弹珠。只表达一个符号 + 一个元素色。配色：磨石（暖灰褐）、雷（暗金→亮黄）。像素画友好的游戏 UI 图标概念图，正面正交，平涂无光照，无投影、无渐变、无发光，单一符号居中占画面约 80%，粗剪影与深色粗描边，最多 6 种颜色，纯色背景 #00FF00，无文字无数字无边框
- English: a pickaxe with two extra marbles. One symbol plus one element colour only. Palette: warm grey-brown whetstone, lightning ramp (dark gold to bright yellow). pixel-art-ready game UI icon concept, front orthographic view, flat unlit colours, no shadow, no gradient, no glow, one symbol centred filling about 80% of the frame, bold silhouette with a thick dark outline, at most 6 colours, solid pure #00FF00 background, no text, no numbers, no frame
- 负面 / Negative：写实、3D 渲染、照片、渐变、柔光、发光、投影、景深、模糊、噪点纹理、细碎细节、多个主体、文字、水印、边框、背景场景，绿色主体 / photorealistic, 3d render, photo, gradient, soft lighting, glow, bloom, drop shadow, depth of field, blur, noisy texture, tiny details, multiple subjects, text, watermark, border, background scenery, green subject

#### `icon_mining_collector_plus1` — 挖矿·采集弹珠 +1

- 依据：`dig_build_defend_loop_v1.md §6`
- 中文：三颗弹珠排一行，最后一颗发亮。只表达一个符号 + 一个元素色。配色：钢（蓝灰）、雷（暗金→亮黄）。像素画友好的游戏 UI 图标概念图，正面正交，平涂无光照，无投影、无渐变、无发光，单一符号居中占画面约 80%，粗剪影与深色粗描边，最多 6 种颜色，纯色背景 #00FF00，无文字无数字无边框
- English: three marbles in a row, the last one glowing. One symbol plus one element colour only. Palette: steel blue-grey, lightning ramp (dark gold to bright yellow). pixel-art-ready game UI icon concept, front orthographic view, flat unlit colours, no shadow, no gradient, no glow, one symbol centred filling about 80% of the frame, bold silhouette with a thick dark outline, at most 6 colours, solid pure #00FF00 background, no text, no numbers, no frame
- 负面 / Negative：写实、3D 渲染、照片、渐变、柔光、发光、投影、景深、模糊、噪点纹理、细碎细节、多个主体、文字、水印、边框、背景场景，绿色主体 / photorealistic, 3d render, photo, gradient, soft lighting, glow, bloom, drop shadow, depth of field, blur, noisy texture, tiny details, multiple subjects, text, watermark, border, background scenery, green subject

#### `icon_mining_wide_bucket` — 挖矿·宽口能量桶

- 依据：`dig_build_defend_loop_v1.md §6`
- 中文：一个口特别宽的能量桶。只表达一个符号 + 一个元素色。配色：雷（暗金→亮黄）、磨石（暖灰褐）。像素画友好的游戏 UI 图标概念图，正面正交，平涂无光照，无投影、无渐变、无发光，单一符号居中占画面约 80%，粗剪影与深色粗描边，最多 6 种颜色，纯色背景 #00FF00，无文字无数字无边框
- English: an energy bucket with an extra-wide mouth. One symbol plus one element colour only. Palette: lightning ramp (dark gold to bright yellow), warm grey-brown whetstone. pixel-art-ready game UI icon concept, front orthographic view, flat unlit colours, no shadow, no gradient, no glow, one symbol centred filling about 80% of the frame, bold silhouette with a thick dark outline, at most 6 colours, solid pure #00FF00 background, no text, no numbers, no frame
- 负面 / Negative：写实、3D 渲染、照片、渐变、柔光、发光、投影、景深、模糊、噪点纹理、细碎细节、多个主体、文字、水印、边框、背景场景，绿色主体 / photorealistic, 3d render, photo, gradient, soft lighting, glow, bloom, drop shadow, depth of field, blur, noisy texture, tiny details, multiple subjects, text, watermark, border, background scenery, green subject

#### `icon_mining_magnet_peg` — 挖矿·磁力钉

- 依据：`dig_build_defend_loop_v1.md §6`
- 中文：一颗马蹄磁铁形的钉子吸住弹珠。只表达一个符号 + 一个元素色。配色：激光（酒红→粉）、钢（蓝灰）。像素画友好的游戏 UI 图标概念图，正面正交，平涂无光照，无投影、无渐变、无发光，单一符号居中占画面约 80%，粗剪影与深色粗描边，最多 6 种颜色，纯色背景 #00FF00，无文字无数字无边框
- English: a horseshoe-magnet peg pulling a marble. One symbol plus one element colour only. Palette: laser ramp (wine red to pink), steel blue-grey. pixel-art-ready game UI icon concept, front orthographic view, flat unlit colours, no shadow, no gradient, no glow, one symbol centred filling about 80% of the frame, bold silhouette with a thick dark outline, at most 6 colours, solid pure #00FF00 background, no text, no numbers, no frame
- 负面 / Negative：写实、3D 渲染、照片、渐变、柔光、发光、投影、景深、模糊、噪点纹理、细碎细节、多个主体、文字、水印、边框、背景场景，绿色主体 / photorealistic, 3d render, photo, gradient, soft lighting, glow, bloom, drop shadow, depth of field, blur, noisy texture, tiny details, multiple subjects, text, watermark, border, background scenery, green subject

#### `icon_mining_throat_widen` — 挖矿·咽喉加宽

- 依据：`dig_build_defend_loop_v1.md §6`
- 中文：一道窄门被两个向外箭头撑宽。只表达一个符号 + 一个元素色。配色：回响（靛→紫→淡紫）、磨石（暖灰褐）。像素画友好的游戏 UI 图标概念图，正面正交，平涂无光照，无投影、无渐变、无发光，单一符号居中占画面约 80%，粗剪影与深色粗描边，最多 6 种颜色，纯色背景 #00FF00，无文字无数字无边框
- English: a narrow gate pushed wider by two outward arrows. One symbol plus one element colour only. Palette: echo ramp (indigo to violet to lavender), warm grey-brown whetstone. pixel-art-ready game UI icon concept, front orthographic view, flat unlit colours, no shadow, no gradient, no glow, one symbol centred filling about 80% of the frame, bold silhouette with a thick dark outline, at most 6 colours, solid pure #00FF00 background, no text, no numbers, no frame
- 负面 / Negative：写实、3D 渲染、照片、渐变、柔光、发光、投影、景深、模糊、噪点纹理、细碎细节、多个主体、文字、水印、边框、背景场景，绿色主体 / photorealistic, 3d render, photo, gradient, soft lighting, glow, bloom, drop shadow, depth of field, blur, noisy texture, tiny details, multiple subjects, text, watermark, border, background scenery, green subject

#### `icon_mark_pyro` — 元素标记·火

- 依据：`art_vfx_ui_direction_v1.md §4.2`
- 中文：一簇火舌。只表达一个符号 + 一个元素色。配色：火（暗红→橙→浅黄）。像素画友好的游戏 UI 图标概念图，正面正交，平涂无光照，无投影、无渐变、无发光，单一符号居中占画面约 80%，粗剪影与深色粗描边，最多 4 种颜色，纯色背景 #00FF00，无文字无数字无边框
- English: one flame tongue. One symbol plus one element colour only. Palette: fire ramp (dark red to orange to pale yellow). pixel-art-ready game UI icon concept, front orthographic view, flat unlit colours, no shadow, no gradient, no glow, one symbol centred filling about 80% of the frame, bold silhouette with a thick dark outline, at most 4 colours, solid pure #00FF00 background, no text, no numbers, no frame
- 负面 / Negative：写实、3D 渲染、照片、渐变、柔光、发光、投影、景深、模糊、噪点纹理、细碎细节、多个主体、文字、水印、边框、背景场景，绿色主体 / photorealistic, 3d render, photo, gradient, soft lighting, glow, bloom, drop shadow, depth of field, blur, noisy texture, tiny details, multiple subjects, text, watermark, border, background scenery, green subject

#### `icon_mark_cryo` — 元素标记·冰

- 依据：`art_vfx_ui_direction_v1.md §4.2`
- 中文：一颗冰菱。只表达一个符号 + 一个元素色。配色：冰（深蓝→青→冰白）。像素画友好的游戏 UI 图标概念图，正面正交，平涂无光照，无投影、无渐变、无发光，单一符号居中占画面约 80%，粗剪影与深色粗描边，最多 4 种颜色，纯色背景 #00FF00，无文字无数字无边框
- English: one ice rhombus. One symbol plus one element colour only. Palette: ice ramp (deep blue to cyan to ice white). pixel-art-ready game UI icon concept, front orthographic view, flat unlit colours, no shadow, no gradient, no glow, one symbol centred filling about 80% of the frame, bold silhouette with a thick dark outline, at most 4 colours, solid pure #00FF00 background, no text, no numbers, no frame
- 负面 / Negative：写实、3D 渲染、照片、渐变、柔光、发光、投影、景深、模糊、噪点纹理、细碎细节、多个主体、文字、水印、边框、背景场景，绿色主体 / photorealistic, 3d render, photo, gradient, soft lighting, glow, bloom, drop shadow, depth of field, blur, noisy texture, tiny details, multiple subjects, text, watermark, border, background scenery, green subject

#### `icon_mark_lightning` — 元素标记·雷

- 依据：`art_vfx_ui_direction_v1.md §4.2`
- 中文：一道折线闪电。只表达一个符号 + 一个元素色。配色：雷（暗金→亮黄）。像素画友好的游戏 UI 图标概念图，正面正交，平涂无光照，无投影、无渐变、无发光，单一符号居中占画面约 80%，粗剪影与深色粗描边，最多 4 种颜色，纯色背景 #00FF00，无文字无数字无边框
- English: one zig-zag bolt. One symbol plus one element colour only. Palette: lightning ramp (dark gold to bright yellow). pixel-art-ready game UI icon concept, front orthographic view, flat unlit colours, no shadow, no gradient, no glow, one symbol centred filling about 80% of the frame, bold silhouette with a thick dark outline, at most 4 colours, solid pure #00FF00 background, no text, no numbers, no frame
- 负面 / Negative：写实、3D 渲染、照片、渐变、柔光、发光、投影、景深、模糊、噪点纹理、细碎细节、多个主体、文字、水印、边框、背景场景，绿色主体 / photorealistic, 3d render, photo, gradient, soft lighting, glow, bloom, drop shadow, depth of field, blur, noisy texture, tiny details, multiple subjects, text, watermark, border, background scenery, green subject

#### `icon_mark_venom` — 元素标记·毒

- 依据：`art_vfx_ui_direction_v1.md §4.2`
- 中文：一颗液滴。只表达一个符号 + 一个元素色。配色：毒（墨绿→酸绿）。像素画友好的游戏 UI 图标概念图，正面正交，平涂无光照，无投影、无渐变、无发光，单一符号居中占画面约 80%，粗剪影与深色粗描边，最多 4 种颜色，纯色背景 #FF00FF，无文字无数字无边框
- English: one droplet. One symbol plus one element colour only. Palette: venom ramp (dark green to acid green). pixel-art-ready game UI icon concept, front orthographic view, flat unlit colours, no shadow, no gradient, no glow, one symbol centred filling about 80% of the frame, bold silhouette with a thick dark outline, at most 4 colours, solid pure #FF00FF background, no text, no numbers, no frame
- 负面 / Negative：写实、3D 渲染、照片、渐变、柔光、发光、投影、景深、模糊、噪点纹理、细碎细节、多个主体、文字、水印、边框、背景场景，品红色主体 / photorealistic, 3d render, photo, gradient, soft lighting, glow, bloom, drop shadow, depth of field, blur, noisy texture, tiny details, multiple subjects, text, watermark, border, background scenery, magenta subject

#### `icon_mark_wind` — 元素标记·风

- 依据：`art_vfx_ui_direction_v1.md §4.2`
- 中文：一个旋涡。只表达一个符号 + 一个元素色。配色：钢（蓝灰）、冰（深蓝→青→冰白）。像素画友好的游戏 UI 图标概念图，正面正交，平涂无光照，无投影、无渐变、无发光，单一符号居中占画面约 80%，粗剪影与深色粗描边，最多 4 种颜色，纯色背景 #00FF00，无文字无数字无边框
- English: one swirl vortex. One symbol plus one element colour only. Palette: steel blue-grey, ice ramp (deep blue to cyan to ice white). pixel-art-ready game UI icon concept, front orthographic view, flat unlit colours, no shadow, no gradient, no glow, one symbol centred filling about 80% of the frame, bold silhouette with a thick dark outline, at most 4 colours, solid pure #00FF00 background, no text, no numbers, no frame
- 负面 / Negative：写实、3D 渲染、照片、渐变、柔光、发光、投影、景深、模糊、噪点纹理、细碎细节、多个主体、文字、水印、边框、背景场景，绿色主体 / photorealistic, 3d render, photo, gradient, soft lighting, glow, bloom, drop shadow, depth of field, blur, noisy texture, tiny details, multiple subjects, text, watermark, border, background scenery, green subject

#### `icon_mark_laser` — 元素标记·激光

- 依据：`art_vfx_ui_direction_v1.md §4.2`
- 中文：一道直线光束。只表达一个符号 + 一个元素色。配色：激光（酒红→粉）。像素画友好的游戏 UI 图标概念图，正面正交，平涂无光照，无投影、无渐变、无发光，单一符号居中占画面约 80%，粗剪影与深色粗描边，最多 4 种颜色，纯色背景 #00FF00，无文字无数字无边框
- English: one straight beam. One symbol plus one element colour only. Palette: laser ramp (wine red to pink). pixel-art-ready game UI icon concept, front orthographic view, flat unlit colours, no shadow, no gradient, no glow, one symbol centred filling about 80% of the frame, bold silhouette with a thick dark outline, at most 4 colours, solid pure #00FF00 background, no text, no numbers, no frame
- 负面 / Negative：写实、3D 渲染、照片、渐变、柔光、发光、投影、景深、模糊、噪点纹理、细碎细节、多个主体、文字、水印、边框、背景场景，绿色主体 / photorealistic, 3d render, photo, gradient, soft lighting, glow, bloom, drop shadow, depth of field, blur, noisy texture, tiny details, multiple subjects, text, watermark, border, background scenery, green subject

#### `icon_mark_pierce` — 元素标记·穿透

- 依据：`art_vfx_ui_direction_v1.md §4.2`
- 中文：一支穿过横线的箭。只表达一个符号 + 一个元素色。配色：钢（蓝灰）、白（仅高光）。像素画友好的游戏 UI 图标概念图，正面正交，平涂无光照，无投影、无渐变、无发光，单一符号居中占画面约 80%，粗剪影与深色粗描边，最多 4 种颜色，纯色背景 #00FF00，无文字无数字无边框
- English: one arrow passing through a bar. One symbol plus one element colour only. Palette: steel blue-grey, white highlights only. pixel-art-ready game UI icon concept, front orthographic view, flat unlit colours, no shadow, no gradient, no glow, one symbol centred filling about 80% of the frame, bold silhouette with a thick dark outline, at most 4 colours, solid pure #00FF00 background, no text, no numbers, no frame
- 负面 / Negative：写实、3D 渲染、照片、渐变、柔光、发光、投影、景深、模糊、噪点纹理、细碎细节、多个主体、文字、水印、边框、背景场景，绿色主体 / photorealistic, 3d render, photo, gradient, soft lighting, glow, bloom, drop shadow, depth of field, blur, noisy texture, tiny details, multiple subjects, text, watermark, border, background scenery, green subject

#### `icon_mark_scatter` — 元素标记·散射

- 依据：`art_vfx_ui_direction_v1.md §4.2`
- 中文：三道扇形短线。只表达一个符号 + 一个元素色。配色：冰（深蓝→青→冰白）、白（仅高光）。像素画友好的游戏 UI 图标概念图，正面正交，平涂无光照，无投影、无渐变、无发光，单一符号居中占画面约 80%，粗剪影与深色粗描边，最多 4 种颜色，纯色背景 #00FF00，无文字无数字无边框
- English: three short lines fanning out. One symbol plus one element colour only. Palette: ice ramp (deep blue to cyan to ice white), white highlights only. pixel-art-ready game UI icon concept, front orthographic view, flat unlit colours, no shadow, no gradient, no glow, one symbol centred filling about 80% of the frame, bold silhouette with a thick dark outline, at most 4 colours, solid pure #00FF00 background, no text, no numbers, no frame
- 负面 / Negative：写实、3D 渲染、照片、渐变、柔光、发光、投影、景深、模糊、噪点纹理、细碎细节、多个主体、文字、水印、边框、背景场景，绿色主体 / photorealistic, 3d render, photo, gradient, soft lighting, glow, bloom, drop shadow, depth of field, blur, noisy texture, tiny details, multiple subjects, text, watermark, border, background scenery, green subject

</details>

## 7. 未覆盖与待拍板

- **Boss 尺寸**：规格 §2.2 是 2×2 / 3×3 且与碰撞一致；当前代码所有 Boss 按 4×3 格生成（`src/spawn_system.js:2587-2595`）。本包按规格出图；若最终保留 4×3，把对应条目类别改为 `boss_4x3`（96×72）再跑即可，提示词的宽高比也要跟着改。
- **双词条精英**：不逐组合出图；先按单词条出，组合态由运行时叠加或人工合成（未定）。
- **Boss 动画帧、受击帧、像素破碎血量的保护核心蒙版**：需人工；本包只出首帧概念。
- **16px 图标**：规格要求单独手绘；这里的 16px 条目只给概念与自动初稿，必须人工逐像素修。
- **风元素**：调色板 v1 没有独立风色带，风标记用钢 + 冰色（见 `palette.json` notes）。

