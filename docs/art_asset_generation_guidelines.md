# Echo Alchemist V2 美术资产生成规范

> 更新日期：2026-06-25
> 用途：作为所有 AI 图像生成、人工绘制、后处理和接入任务的统一引用。生成任何 UI、ICON、Toast、敌人或 Boss 相关位图资产前，先读取本文件，再读取对应的资产 TODO 或专项契约。

## 1. 总体风格

Echo Alchemist V2 的视觉基调是 **暗黑赛博炼金**：

- **材质**：黑曜石、深色金属、旧金/暗金镶边、磨损边、铆钉、刻蚀炼金线路、局部晶体。
- **发光**：克制的核心光、裂缝光、边缘冷光；避免整张图被大面积 bloom 洗掉。
- **色彩**：以 charcoal / slate / obsidian / aged gold 为底；青绿、冷蓝、毒绿、炉橙、紫红只作为机制核心或状态强调。
- **文字承载**：图片必须给 DOM 文本留出暗色低对比中心区；不要把标题、数字、价格、回合数、Boss 名称或说明文字烘焙进图。
- **形状语言**：UI 是金属/黑曜石炼金仪器；敌人与 Boss 是几何磨石块基座 + 镶嵌核心，不能变成写实怪物、卡通角色或普通奇幻卷轴。

## 2. 生成前引用顺序

按资产类型读取这些文档：

| 资产类型 | 必读文档 |
|---|---|
| 全局 UI / ICON / 页面资产 | `docs/art_asset_generation_guidelines.md`、`docs/asset_gap_index.md`、`docs/ui_asset_requirements.md`、`design_spec_bitmap.md` |
| 回合 Toast / Boss 预告 | 上述文档 + `docs/design/round_start_boss_toast_asset_contract.md` |
| 战斗场地 / 发射器 / 战斗 HUD | 上述文档 + `docs/design/combat_battlefield_ui_asset_redesign.md` |
| 敌人 V2 / Overlay / collision frame | 上述文档 + `docs/design/enemy_asset_regeneration_plan.md`、`docs/design/enemy_geometric_whetstone_style.md` |
| Boss 本体重绘 | 上述文档 + `docs/boss_sprite_redraw_asset_contract.md` |
| Boss 破绽 Overlay | 上述文档 + `docs/boss_vulnerability_asset_contract.md` |

如果专项契约与本文件冲突，以专项契约为准；如果资产 TODO 只给了路径和尺寸，以本文件补足风格、场景和禁忌。

## 3. 通用生成约束

| 维度 | 要求 |
|---|---|
| 透明资产 | prompt 使用纯绿幕/chroma key 背景，推荐 `#00ff00`；后处理抠图得到透明 PNG。不要要求模型直接输出透明底，也不要输出棋盘格预览。 |
| 9-Slice | 中心必须低噪声、低对比、可承载 DOM 文本；边缘可以有复杂金属/炼金纹，但不要挤入中心阅读区。文件名使用 `_9s.png`。 |
| Icon | 32/48/64px 小尺寸优先识别 silhouette；只保留 1 个主形状 + 1 个核心色 + 少量材质信号。 |
| Button | 不烘焙按钮文字；提供清晰的边框、内凹/凸起层级和 hover/active 可通过 CSS 变亮的材质。 |
| Animation frames | 同一状态帧之间只改变光流、边缘能量或机械微动；不要改变轮廓和文本安全区。 |
| Runtime text | 所有名称、数值、价格、回合数、倒计时、稀有度文案继续由 DOM / Canvas 文本渲染。 |
| Performance | 静态贴图替换优先；不要用新增粒子表达本可由贴图完成的装饰。如果需要粒子、混合模式、`shadowBlur` 或动态渐变，先读 `.cursor/rules/performance.md`。 |
| Runtime fallback | 缺少正式 PNG 时，可先使用同语义 SVG/CSS fallback 防止界面空白或 404，但必须在资产清单中标明 `runtime fallback`，不得写成正式美术完成；后续 PNG/chroma 替换仍遵守本表全部约束。 |

## 4. 场景化要求

### 4.1 首屏标题与开始按钮

目标：第一眼建立“暗黑炼金弹珠 Roguelike”的品牌感。

- 标题徽章使用黑曜石/暗金炼金牌匾，可有细刻线、晶体核心和少量青绿能量。
- 开始按钮底板要像可按下的金属机关，不烘焙“开始”文字。
- 不要做营销海报、人物插画、纯渐变 Logo 或大面积紫色光雾。

参考资产：
- `assets/ui/sprites/title_badge.png`
- `assets/ui/sprites/start_btn_metal.png`

### 4.2 暂停菜单

目标：暂停时压暗游戏但不割裂战斗气氛。

- 背景应是半透明黑曜石/炼金阵纹覆盖层，中部暗、边缘有轻微金属纹理。
- 菜单按钮是可重复使用的 9-Slice 金属条，支持继续、设置、放弃等 DOM 文本。
- 不要做全新场景背景、强插画或高亮中心图案，以免压住菜单文字。

参考资产：
- `assets/ui/panels/pause_menu_bg.png`
- `assets/ui/sprites/pause_menu_btn_9s.png`

### 4.3 设置弹窗控件

目标：让滑条和关闭按钮与 `settings_modal_9s.png` 同一套材质。

- 滑条轨道像镶嵌在面板里的窄能量槽，中心可横向拉伸。
- 滑块是小型金属/晶体旋钮，24px 仍可辨认。
- 关闭按钮使用熟悉的 X 形符号或留给 CSS/DOM 图标叠加，不烘焙文字。

参考资产：
- `assets/ui/sprites/slider_track.png`
- `assets/ui/sprites/slider_thumb.png`
- `assets/ui/sprites/modal_close_btn.png`

### 4.4 遗物图标

目标：每个遗物图标一眼表达机制，不依赖 emoji。

- 64x64 构图，主体居中，保留 6-8px 安全边距。
- 使用“炼金器物/晶体/金属徽记”表达效果语义，不用完整人物或复杂场景。
- 稀有度不应完全依赖图标本体发光；稀有度边框由 UI 卡片负责。
- cursed 遗物可以使用暗红/紫黑裂纹，但不要让主体不可读。

语义示例：

| 遗物 | 视觉关键词 |
|---|---|
| `guardian_barrier` | 六边形护盾核心、暗金边、青蓝屏障光 |
| `fate_reroll_token` | 命运硬币、双箭头刻印、紫金边 |
| `rune_resonance_core` | 中央符文晶核、环形共鸣纹、青绿核心 |
| `doomsday_timer` | 炼金沙漏/倒计时盘、红金裂缝 |
| `chaos_pact` | 破裂契约印、血红封蜡、黑曜石底 |
| `greedy_wheel` | 金属轮盘、概率齿轮、暗金/紫红高光 |

参考资产：
- `assets/icons/relic/<id>.png`
- 映射入口：`src/bitmap_icons.js` 的 `RELIC_ICON_MAP`

### 4.5 回合 Toast 与 Boss 预告

目标：保留“第 X 回合开始”的动态文本，同时让普通回合、Boss 倒计时、Boss 临近和 Boss 登场有状态差异。

- 横幅中心必须暗、干净、可读。
- `normal` 使用暗金低强度光。
- `countdown` 增加低亮封印纹，不抢文字。
- `soon` 边缘变红金，有警戒感但不新增粒子。
- `now` 可有短促冲击感，但不要变成全屏爆炸。
- Boss 小像必须与 Boss 本体“几何磨石块 + 镶嵌核心”一致，32px tiny 版保留 silhouette。

参考资产：
- `assets/ui/banners/round_toast_<state>_<frame>.png`
- `assets/ui/banners/round_threat_plate_danger_9s.png`
- `assets/ui/icons/boss_preview/boss_preview_frame_danger.png`

### 4.6 Meta / Shop / Gathering

目标：中频页面补足装饰，但不干扰重复操作效率。

- Meta/Shop 分类 Tab 用小型金属标签或炼金分类徽章，不要做大插画按钮。
- SP 货币图标使用晶体/能量币语义，32px 清晰。
- 价格标签是可承载 DOM 数字的短金属底板。
- 研磨钉盘外框应像炼金仪器边框，衔接 `bg_main_canvas.png` 和弹珠台，不遮挡钉子轨迹。

参考资产：
- `assets/ui/sprites/meta_tab_<category>.png`
- `assets/ui/icons/sp_currency.png`
- `assets/ui/sprites/shop_price_tag_9s.png`
- `assets/ui/sprites/gathering_pinboard_frame_9s.png`

### 4.7 真理之书 / 结算 / 数据页

目标：低频页面要更像档案与仪表盘，信息优先。

- 真理之书可以带卷轴/书页质感，但仍保持暗黑炼金，不要转成羊皮纸奇幻风。
- 数据图背景必须低对比，网格线细，方便 DOM/SVG 折线覆盖。
- 统计卡片与 ribbon 不烘焙具体数值。

参考资产：
- `assets/ui/sprites/truth_book_tab_<chapter>.png`
- `assets/ui/panels/stat_card_9s.png`
- `assets/ui/sprites/data_chart_bg.png`
- `assets/ui/sprites/best_record_ribbon.png`

### 4.8 敌人与 Boss

目标：敌人是可被弹珠反弹/命中的物理对象，不是纯装饰头像。

- 普通/V2 敌人必须保持清晰物理边界和 HP 可读性。
- 基底主体使用几何磨石块、切削面、镶嵌核心、裂纹；词条 overlay 只做机制覆层，不覆盖主体 silhouette。
- Boss 本体必须贴合 collision guide，使用真实透明孔洞/裂缝露出 HP 液体，不靠整图调淡。
- Boss 预告图可以重构构图，但不能改变 Boss 识别母题。

## 5. Prompt 模板

### 5.1 UI 9-Slice / 面板

```text
Use case: game UI asset
Asset type: <panel/button/banner>, <size>
Primary request: dark alchemy <asset role> for Echo Alchemist V2
Style/medium: polished bitmap UI, dark cyber alchemy, obsidian metal, aged gold trim, subtle engraved circuits
Composition/framing: 9-slice friendly, readable dark center for dynamic DOM text, stronger detail on borders, no baked text
Lighting/mood: restrained rim light, faint cyan/emerald alchemy glow, low contrast center
Color palette: charcoal, slate, obsidian black, aged gold, tiny accent color based on state
Materials/textures: worn dark metal, beveled obsidian, small rivets, engraved alchemy lines
Constraints: no text, no numbers, no logo, no character, no large bloom, no transparent/checkerboard preview
Avoid: parchment fantasy, purple-heavy fog, busy symbols in the text area, marketing poster composition
```

### 5.2 Transparent UI Sprite / Icon

```text
Use case: game icon asset
Asset type: <icon/sprite>, <size>
Primary request: compact alchemy icon representing <mechanic/effect>
Style/medium: polished bitmap game icon, dark cyber alchemy, clear silhouette at small size
Composition/framing: centered object, 6-8 px safe margin, one primary shape, one mechanism color, no background scene
Lighting/mood: restrained core glow only, readable edge highlights
Color palette: charcoal metal base, aged gold accents, <mechanic color> core glow
Materials/textures: obsidian, metal bevels, crystal core, engraved cracks
Constraints: flat solid #00ff00 chroma key background for alpha extraction, no text, no numbers, no cast shadow on green background
Avoid: full scene, character portrait, tiny noisy details, overexposed bloom, transparent/checkerboard preview
```

### 5.3 Boss / Enemy Preview

```text
Use case: stylized game enemy asset
Asset type: <boss preview icon / enemy sprite>, <size>
Primary request: <enemy or boss name>, matching Echo Alchemist geometric whetstone style
Style/medium: polished bitmap asset, geometric carved stone body with embedded glowing core
Composition/framing: centered silhouette, collision-readable outline, visible core, no UI frame baked into body
Lighting/mood: restrained rim light, core/crack glow only
Color palette: charcoal stone, aged metal, boss/mechanic-specific core color
Materials/textures: faceted whetstone, chipped edges, mineral veins, metal brackets, crystal core
Constraints: flat solid #00ff00 chroma key background if transparency is required, no text, no numbers, no unrelated monster design
Avoid: soft organic creature, full illustration background, overexposed aura, hidden collision boundary
```

## 6. 生成后验收

生成资产进入运行时前，至少检查：

- 文件路径与 `docs/asset_gap_index.md` 的建议路径一致，或同步更新索引。
- 图片没有文字、数字、价格、回合数、Boss 名称等动态内容。
- 透明资产无绿幕残边；PNG alpha 正常。
- 9-Slice 中心可读，边缘装饰不会拉伸穿帮。
- 32px / 64px 图标缩小时仍能识别主形状。
- 移动端宽度下不会遮挡关键按钮或 DOM 文本。
- 对应映射已接入 `src/bitmap_icons.js` 或样式已写入 `src/styles/bitmap_ui.css`。
- 如涉及 Boss / enemy，相关验证脚本通过。
