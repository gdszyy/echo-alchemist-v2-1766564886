# 回合 Toast 与下一 Boss 预告资产契约

> 日期：2026-06-24  
> 范围：`#round-start-banner`、顶部态势条里的 `#combat-next-threat`、下一 Boss 预告图标与回合开始横幅。  
> 目标：把“第 X 回合开始”和“下一 Boss 威胁”从通用文字/CSS 剪影升级为可复用的位图资产体系，同时不把回合数、Boss 名称、倒计时等动态文本烘进图片。

## 1. 当前缺口

运行时已经具备这些基础能力：

| 位置 | 当前实现 | 问题 |
|---|---|---|
| 回合开始横幅 | `assets/ui/banners/round_banner_1.png` ~ `round_banner_6.png` 做 6 帧底图动画 | 只有通用底图，不能表达普通回合、Boss 将至、本回合 Boss 登场等差异 |
| 下一 Boss 预告 | `round-start-threat-icon` 使用 CSS `clip-path` 几何剪影 | 所有 Boss 都长得一样，未知/已知状态缺少美术差异 |
| 顶部态势条威胁 | `#combat-next-threat-icon` 复用 CSS 剪影 | 24px 小尺寸下不能识别 Boss 类型，也缺少未知剪影资产 |
| 美术清单 | `docs/ui_asset_requirements.md` 误标为“已配齐” | 需要改成“底图已接入，Boss 预告资产待补” |

本轮只定义资产契约和生成方向；正式接入时再修改 `src/bitmap_icons.js`、`src/styles/bitmap_ui.css` 和少量 UI 映射逻辑。

## 2. 设计结论

回合 Toast 拆成三层：

| 层级 | 资产/渲染 | 职责 |
|---|---|---|
| L0 横幅底图 | 通用 6 帧或状态版 6 帧 PNG | 提供金属牌、光晕和入场动势 |
| L1 威胁槽 | 9-Slice 预告小牌 + Boss 小像/剪影 | 表达下一 Boss、倒计时、本回合登场 |
| L2 动态文本 | DOM 文本 | 回合数、Boss 名称、Round N、倒计时和 aria 文案 |

不要为每个数字回合烘焙一张图片。所谓“每个回合的回合 toast”应理解为每个回合都会出现的同一组件，图片只负责状态和材质；`第 ${round} 回合開始` 仍由 DOM 文本渲染。

## 3. 状态映射

| 状态 | 触发 | 视觉要求 |
|---|---|---|
| `normal` | 没有可预告 Boss | 通用暗金横幅，威胁槽隐藏 |
| `countdown` | 下一 Boss 距离 2 回合及以上 | 威胁槽显示“下一威胁”，未知 Boss 用通用封印剪影，已知 Boss 用对应小像 |
| `soon` | 下一 Boss 距离 1 回合 | 横幅边缘转红金，威胁槽加强警戒光，不新增粒子 |
| `now` | 本回合 Boss 登场 | 横幅中心短暂红金闪光，Boss 小像使用高亮边框 |
| `active` | 顶部态势条中已有 Boss 在场 | 小图标显示当前 Boss 类型，文案保持“交战” |

未知 Boss 只显示“封印剪影”，不能泄露形态细节；已遭遇或当前即将登场的 Boss 才使用 Boss 专属预告图。

## 4. 资产清单

### 4.1 回合 Toast 横幅

| 资产 | 路径建议 | 尺寸 | 用途 | 备注 |
|---|---|---:|---|---|
| 主标题牌 | `assets/ui/banners/round_title_panel_9s.png` | 600x200 | DOM 文本“第 X 回合开始”的主背板 | 已于 2026-06-24 接入；动画只做 opacity/scale，不再切回旧 `round_banner_*.png` |
| 通用横幅帧 | `assets/ui/banners/round_toast_normal_1.png` ~ `_6.png` | 600x200 | 普通回合底图 | 可复用当前 `round_banner_*.png` 作为临时版本 |
| 倒计时横幅帧 | `assets/ui/banners/round_toast_countdown_1.png` ~ `_6.png` | 600x200 | Boss 倒计时 2+ 回合 | 在通用版上增加低亮封印纹，不要抢文字 |
| 临近横幅帧 | `assets/ui/banners/round_toast_soon_1.png` ~ `_6.png` | 600x200 | Boss 前 1 回合 | 边缘红金预警，中心仍留暗 |
| 登场横幅帧 | `assets/ui/banners/round_toast_now_1.png` ~ `_6.png` | 600x200 | 本回合 Boss 登场 | 只在横幅上做短促冲击感，Boss 入场遮罩仍由现有逻辑负责 |
| 威胁槽 9-Slice | `assets/ui/banners/round_threat_plate_9s.png` | 420x72 | `round-start-threat` 背板 | 中心必须暗，支持文字 |
| 威胁槽高危版 | `assets/ui/banners/round_threat_plate_danger_9s.png` | 420x72 | `soon` / `now` 状态 | 红金边框，不烘焙文字 |

如果短期只生成一套横幅，优先生成 `round_threat_plate_9s.png` 和 Boss 小像；当前 `round_banner_*.png` 可以继续承接 L0。

### 4.2 Boss 预告小像

| 资产 | 路径建议 | 尺寸 | 用途 |
|---|---|---:|---|
| 未知 Boss 封印剪影 | `assets/ui/icons/boss_preview/boss_unknown_seal.png` | 96x96 | 未遭遇 Boss 的回合 Toast |
| 未知 Boss 小图标 | `assets/ui/icons/boss_preview/boss_unknown_seal_tiny.png` | 32x32 | 顶部态势条 |
| Boss 预告小像 | `assets/ui/icons/boss_preview/boss_<bossId>_preview.png` | 96x96 | 回合 Toast 已知 Boss |
| Boss 顶栏小图标 | `assets/ui/icons/boss_preview/boss_<bossId>_tiny.png` | 32x32 | `#combat-next-threat-icon` |
| Boss 高危边框 | `assets/ui/icons/boss_preview/boss_preview_frame_danger.png` | 112x112 | `soon` / `now` 小像叠层 |

Boss ID：

```text
ignis, glacies, mikro, devourer, viridis, tesla, chimera, ouroboros
```

小像可以从已接入的 `assets/sprites/bosses/redraw_drafts/boss_<bossId>_redraw_idle_draft_sheet.png` 抽第一帧后重新构图，也可以用 AI 生成概念图。但必须和 Boss 本体的“几何磨石块基座 + 镶嵌核心”风格一致，不能变成另一套角色设计。

## 5. Boss 小像识别规则

| Boss | 预告图关键词 | 小尺寸必须读出的形状 |
|---|---|---|
| Ignis | 熔炉、炉门、重盾铰链、橙红炉芯 | 顶窄底宽熔炉盾形 |
| Glacies | 冰晶缝合、尖顶冰脊、冷蓝裂缝 | 顶部尖冰晶和斜肩 |
| Mikro | 分裂母核、子节点、环绕孢室 | 中央圆核 + 小节点 |
| Devourer | 深渊巨口、紫黑胃囊、齿槽 | 不规则张口轮廓 |
| Viridis | 藤蔓共生、孢甲、毒绿核心 | 尖顶藤蔓壳和绿色孢室 |
| Tesla | 窄菱形电核、导体尖塔、蓝白电弧 | 竖向窄菱形 |
| Chimera | 双核心缝合、红紫反应炉、异质装甲 | 左右不对称双核 |
| Ouroboros | 完整闭合环、六附体槽、金紫轮转 | 闭合圆环和 6 个槽位 |

96px 预告图可以保留更多纹理；32px 顶栏图标必须简化为清晰 silhouette + 1 个核心色。

## 6. 生成 Prompt 草案

### 6.1 回合 Toast 横幅底图

```text
Use case: ui-mockup
Asset type: game round-start toast banner, 600x200
Primary request: dark alchemy metal banner frame for a roguelike pachinko round start toast
Style/medium: polished bitmap UI asset, dark fantasy alchemy, obsidian metal and aged gold, 9-slice friendly center
Composition/framing: horizontal plaque, dark readable center for dynamic text, subtle mechanical brackets, no baked text
Lighting/mood: restrained gold rim light with faint cyan alchemy lines, low contrast center
Color palette: charcoal, obsidian black, aged gold, muted cyan, tiny crimson warning accents
Materials/textures: worn dark metal, beveled obsidian, engraved alchemy circuits, small rivets
Constraints: no text, no numbers, no logo, no characters, center area must remain dark and readable, no transparent/checkerboard preview
Avoid: large bright glow behind text, purple-heavy gradients, parchment style, busy symbols in the center
```

`countdown` / `soon` / `now` 变体只改边缘和威胁符号强度，不改变中心文字区。

### 6.2 Boss 预告小像

```text
Use case: stylized-concept
Asset type: square boss preview icon for game UI, 96x96
Primary request: compact preview icon of <boss name and key silhouette>, matching the Echo Alchemist geometric whetstone boss style
Style/medium: polished bitmap game icon, dark alchemy boss portrait, geometric carved stone body with embedded glowing core
Composition/framing: centered bust/icon silhouette, readable at small size, generous padding, no text
Lighting/mood: restrained rim light, core glow only, no large aura
Color palette: boss-specific core color plus charcoal stone and aged gold accents
Materials/textures: faceted obsidian stone, metal brackets, engraved cracks, embedded crystal/core
Constraints: flat solid #00ff00 chroma key background for alpha extraction, no text, no numbers, no UI frame baked into the boss body, no cast shadow on the green background
Avoid: full-body scene, background environment, overexposed bloom, unrelated monster design, tiny noisy details, transparent/checkerboard preview
```

### 6.3 未知 Boss 封印剪影

```text
Use case: stylized-concept
Asset type: unknown boss seal icon for game UI, 96x96
Primary request: sealed unknown boss silhouette icon, ominous but not revealing any specific boss shape
Style/medium: polished bitmap game icon, dark alchemy seal, geometric obsidian mask and locked golden sigil
Composition/framing: centered abstract sealed silhouette, clear at 32px, no creature details
Lighting/mood: low contrast slate silhouette with faint gold seal marks
Color palette: charcoal, slate, muted gold, tiny cold cyan cracks
Materials/textures: obsidian mask, metal locking bands, engraved alchemy seal
Constraints: flat solid #00ff00 chroma key background for alpha extraction, no text, no numbers, no boss-specific features
Avoid: revealing horns/mouth/eyes tied to a specific boss, bright glow, background scene, cast shadow on green background
```

## 7. 接入建议

1. 先生成并接入 `boss_unknown_seal.png`、`round_threat_plate_9s.png` 和 8 个 `boss_<id>_preview.png`。
2. 在 `src/bitmap_icons.js` 增加集中映射，例如 `getBossPreviewIconSrc(bossId, { tiny, known })`，禁止散落 `new Image()`。
3. `sys_showRoundStartBanner()` 只负责把 `bossThreat.bossId/stateClass/known` 写成 DOM data 属性或 class；不要把调度逻辑塞进样式层。
4. `ui_updateCombatStatusPanel()` 顶部态势条复用同一映射，32px 图标从 96px 正式图下采样或使用独立 tiny 图。
5. CSS 状态只切换背景图和边框；不新增 Canvas 粒子，不改变 Boss 调度。

## 8. 验收标准

- 390px 宽移动端：横幅文字、威胁槽和 Boss 小像不互相遮挡。
- 32px 顶栏图标：未知状态和至少 8 个 Boss 中的 6 个能一眼区分。
- 未知 Boss 不泄露具体 Boss 轮廓。
- 所有动态文本仍由 DOM 渲染，图片内不包含中文、数字或 Round 字样。
- 低性能档可以只显示静态首帧和小图标，不依赖发光动画才能读懂状态。
- 新增图片走绿幕抠图或明确的透明 PNG 管线，最终运行时资产不得留在 `docs/design/concepts/`。

## 9. 2026-06-24 Pass 1 落地状态

首批已生成并接入运行时：

```text
assets/ui/banners/round_title_panel_9s.png
assets/ui/banners/round_threat_plate_9s.png
assets/ui/icons/boss_preview/boss_unknown_seal.png
assets/ui/icons/boss_preview/boss_unknown_seal_tiny.png
assets/ui/icons/boss_preview/boss_ignis_preview.png
assets/ui/icons/boss_preview/boss_ignis_tiny.png
assets/ui/icons/boss_preview/boss_glacies_preview.png
assets/ui/icons/boss_preview/boss_glacies_tiny.png
assets/ui/icons/boss_preview/boss_mikro_preview.png
assets/ui/icons/boss_preview/boss_mikro_tiny.png
assets/ui/icons/boss_preview/boss_devourer_preview.png
assets/ui/icons/boss_preview/boss_devourer_tiny.png
assets/ui/icons/boss_preview/boss_viridis_preview.png
assets/ui/icons/boss_preview/boss_viridis_tiny.png
assets/ui/icons/boss_preview/boss_tesla_preview.png
assets/ui/icons/boss_preview/boss_tesla_tiny.png
assets/ui/icons/boss_preview/boss_chimera_preview.png
assets/ui/icons/boss_preview/boss_chimera_tiny.png
assets/ui/icons/boss_preview/boss_ouroboros_preview.png
assets/ui/icons/boss_preview/boss_ouroboros_tiny.png
```

源图、抠图中间产物和 contact sheet 保存在：

```text
docs/design/concepts/round_start_boss_toast_pass1/
```

运行时接入点：

- `src/bitmap_icons.js`：新增 `BOSS_PREVIEW_ICON_MAP` 和 `getBossPreviewIconSrc()`。
- `src/game_system.js`：`sys_showRoundStartBanner()` 给 `#round-start-threat-icon` 注入 Boss 预告图。
- `src/ui_system.js`：`ui_updateCombatStatusPanel()` 给 `#combat-next-threat-icon` 注入 tiny 图标。
- `src/styles/bitmap_ui.css`：威胁槽改用 `round_threat_plate_9s.png`，旧 CSS 剪影 fallback 改为 PNG。

仍待生成：

```text
assets/ui/banners/round_toast_normal_1.png ~ _6.png
assets/ui/banners/round_toast_countdown_1.png ~ _6.png
assets/ui/banners/round_toast_soon_1.png ~ _6.png
assets/ui/banners/round_toast_now_1.png ~ _6.png
assets/ui/banners/round_threat_plate_danger_9s.png
assets/ui/icons/boss_preview/boss_preview_frame_danger.png
```

2026-06-24 live2 note:
- `round_threat_plate_9s.png` is rendered as a direct CSS background image in both `index.html` and `src/styles/bitmap_ui.css`.
- This avoids runtime fallback to the old pure-CSS threat plate when `border-image` is not reflected in computed styles or when external CSS is stale.
