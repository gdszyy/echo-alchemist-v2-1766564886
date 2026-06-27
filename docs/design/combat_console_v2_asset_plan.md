# 战斗底部操作台 V2 美术资产设计契约

> 日期：2026-06-24  
> 范围：`#phase-combat` 底部操作台、顶部商人旅程、技能点宝石、技能充能与左右下角入口。  
> 目标：在移动端真实宽度下，把战斗 UI 做成“嵌入发射器两侧的炼金操作台”，而不是悬浮面板。

## 1. 结论

战斗底部 UI 拆成三段：左翼信息台、中央发射器井、右翼技能台。

- 左翼负责“下一发/弹药序列/输出分析入口”，补足当前左侧单薄的问题。
- 中央发射器井必须完全留空，不出整条横向底板，也不让装饰跨过发射器。
- 右翼负责“技能/技能点宝石/技能充能/符文配置”，但用边框嵌入和短轨道压缩密度。
- 商人旅程移到顶部栏，运行时不得挡住敌人和弹道。

## 2. 移动端运行约束

当前 390px 宽移动端验证尺寸：

| 区域 | 运行时位置 | 约束 |
|---|---:|---|
| 底部 dock | x=6, y=591, w=378, h=96 | 顶部必须低于警戒线可视带，不进入敌人区域 |
| 左翼面板 | x=6, y=599, w=119, h=88 | 只能承载紧凑信息，不做大段说明 |
| 中央发射器井 | x=129, y=591, w=132, h=96 | 必须透明，不能有 DOM 面板或横向底板穿过 |
| 右翼面板 | x=265, y=599, w=119, h=88 | 技能密度高，必须用小槽和宝石边框化 |
| 发射器安全框 | x=131, y=549, w=128, h=128 | 操作台资产不得覆盖炮台主体 |
| 顶部商人旅程 | 约 x=117, y=8, w=156, h=30 | 只能贴顶栏，不能下压到敌人出生区 |

设计源图建议按 2x 或 3x 制作，运行时由 CSS/Canvas 缩放。正式透明资源必须走纯绿幕 chroma key 后处理流程，不在 prompt 中要求透明背景。

## 3. 层级拆分

| 层级 | 名称 | 归属 | 内容 |
|---|---|---|---|
| L0 | 战场背景层 | Canvas | 战场、墙体、警戒线、敌人、弹道 |
| L1 | 发射器机器层 | Canvas | V3/V4 发射器底座、炮管、充能、枪口反馈 |
| L2 | 操作台美术层 | DOM/CSS | 左翼/右翼 9-slice 面板、边缘扣件、顶部商人小条 |
| L3 | 信息控件层 | DOM | 弹药、技能按钮、技能点宝石、充能条、配置入口 |
| L4 | 反馈动效层 | DOM/CSS/Canvas | 技能 ready、宝石点亮、商人到达、按钮按下 |

L2 不烘焙文字、数字、图标语义；L3 才放运行时数据。L4 默认轻量，除非后续明确接入性能预算。

## 4. 首批资产清单

### 4.1 底部操作台主体

| 资产 | 路径建议 | 源尺寸 | 运行时目标 | 切片 | 说明 |
|---|---|---:|---:|---:|---|
| 左翼主面板 | `assets/ui/panels/combat_console_left_wing_9s.png` | 360x264 | 119x88 | 32 | 左侧弹药/分析操作台，内侧边缘可有短机械扣件 |
| 右翼主面板 | `assets/ui/panels/combat_console_right_wing_9s.png` | 360x264 | 119x88 | 32 | 右侧技能操作台，预留狭长六边形宝石嵌槽和按钮区 |
| 左翼内侧扣件 | `assets/ui/sprites/combat_console_left_clamp.png` | 96x64 | 24x32 | - | 只贴在左翼右边缘，不进入中央井 |
| 右翼内侧扣件 | `assets/ui/sprites/combat_console_right_clamp.png` | 96x64 | 24x32 | - | 只贴在右翼左边缘，不进入中央井 |

不做 `combat_console_full_width_panel.png`。中心透明是这套方案的核心约束。

### 4.2 左翼信息元素

| 资产 | 路径建议 | 源尺寸 | 用途 |
|---|---|---:|---|
| 当前弹药槽 | `assets/ui/panels/combat_current_ammo_slot_9s.png` | 240x72 | 放当前弹药图标、名称、伤害短读数 |
| 弹药序列芯片 | `assets/ui/sprites/combat_ammo_queue_chip.png` | 64x40 | 运行时缩到约 20x16，承载后续弹药图标 |
| 弹药芯片选中框 | `assets/ui/sprites/combat_ammo_queue_chip_active.png` | 64x40 | 下一发/当前队列高亮 |
| 输出分析入口 | `assets/ui/sprites/combat_analysis_socket_button.png` | 64x48 | 左下角小按钮，只表示入口，不展开面板 |

左翼文案只允许 1 行短数字或缩写。不要恢复旧的四个战斗数字。

### 4.3 右翼技能元素

| 资产 | 路径建议 | 源尺寸 | 用途 |
|---|---|---:|---|
| 技能按钮框 V2 | `assets/ui/panels/combat_skill_button_frame_9s.png` | 96x96 | 技能按钮统一框，不包含技能图标 |
| 技能按钮按下覆盖 | `assets/ui/sprites/combat_skill_button_pressed.png` | 96x96 | 按下/触摸态 |
| 技能按钮禁用覆盖 | `assets/ui/sprites/combat_skill_button_disabled.png` | 96x96 | 冷却/不可用态 |
| 技能点宝石空 | `assets/ui/sprites/skill_sp_gem_empty.png` | 32x32 | 狭长六边形宝石，嵌在右翼上边框或下边框 |
| 技能点宝石亮 | `assets/ui/sprites/skill_sp_gem_full.png` | 32x32 | 狭长六边形亮态；运行时约 6-10px |
| 技能充能短轨 | `assets/ui/panels/skill_charge_mini_track_9s.png` | 192x24 | 右翼内的小型充能条 |
| 符文配置 socket | `assets/ui/sprites/rune_config_socket_button.png` | 72x56 | 右翼角落按钮，替代悬浮配置入口 |

现有 `skill_charge_*` 可继续作为临时资产；正式 V2 应压成短轨道，不再像独立大仪表。

### 4.4 顶部商人旅程

| 资产 | 路径建议 | 源尺寸 | 运行时目标 | 说明 |
|---|---|---:|---:|---|
| 商人旅程顶栏 | `assets/ui/panels/merchant_journey_topbar_9s.png` | 360x72 | 156x30 | 贴 `#unified-top-bar` 中部或偏右 |
| 商人旅程填充 | `assets/ui/sprites/merchant_journey_fill.png` | 240x12 | 120x3 | 低亮度进度线 |
| 商人到达微光 | `assets/ui/sprites/merchant_journey_ready_glow.png` | 360x72 | 156x30 | 只在可进入商店时短闪 |

顶部栏不放大面积装饰，不下压，不遮挡敌人出生区。

## 5. 美术语言

主体材质沿用“黑曜石炼金战台 + 暗金机械边 + 青蓝/琥珀能量”。

- 黑曜石用于面板中心，保证文字和图标可读。
- 暗金机械边用于表达实体操作台，不要大面积金色。
- 青蓝能量只用作可交互边缘、宝石、充能轨，不要铺满面板。
- 琥珀只用于临时衰减、商人旅程、警告态的小面积强调。
- 不使用大紫蓝渐变、不做柔软玻璃卡片、不做悬浮云雾。

## 6. 生成 prompt 草案

### 6.1 左右翼操作台面板

```text
Use case: ui-mockup
Asset type: 9-slice mobile game HUD side wing panel on chroma key background
Primary request: compact left/right alchemical console wing for a bottom combat operation table, designed to sit beside a central turret well
Style/medium: polished bitmap game UI asset, dark obsidian alchemy machinery, 9-slice friendly
Composition/framing: low horizontal side panel, one inner mechanical clamp edge, stretchable dark center, no full-width middle bridge
Lighting/mood: restrained cyan rim light, aged dark-gold metal brackets, readable dark inset
Color palette: charcoal black, obsidian, muted cyan, aged gold, tiny amber indicator lights
Materials/textures: beveled dark metal, worn obsidian inset, engraved alchemy circuit ticks, small rivets
Constraints: flat solid #00ff00 chroma key background, no text, no icons, no transparent/checkerboard preview, center area simple and dark, corners support 9-slice slicing
Avoid: bright center glow, large decorative symbols in stretch zones, purple-heavy gradient, long horizontal bridge, cast shadow on green background
```

### 6.2 技能点宝石

```text
Use case: stylized-concept
Asset type: small game UI gem sprite on chroma key background
Primary request: tiny faceted skill point gem for a dark alchemy combat console, empty and full states
Style/medium: polished bitmap UI sprite, strong silhouette, readable at 8px
Composition/framing: centered diamond/cabochon gem with generous padding, no frame, no text
Lighting/mood: empty state dark glass, full state cyan-teal inner glow
Color palette: dark slate, cyan, teal, small white highlight
Constraints: flat solid #00ff00 chroma key background, no shadow spill on background, no text, no button frame
Avoid: green body color close to chroma key, overexposed glow, tiny noisy facets, large aura
```

### 6.3 顶部商人旅程

```text
Use case: ui-mockup
Asset type: compact 9-slice top bar progress widget on chroma key background
Primary request: merchant journey progress capsule for a dark alchemy battle top bar
Style/medium: polished bitmap game UI asset, compact metal instrument
Composition/framing: narrow horizontal capsule, dark readable center, small amber travel groove, stretchable middle
Lighting/mood: restrained amber indicator light with cyan metal rim
Color palette: charcoal, aged gold, muted amber, tiny cyan accents
Materials/textures: dark metal, obsidian inset, engraved measuring ticks
Constraints: flat solid #00ff00 chroma key background, no text, no icons, no large glow, supports 9-slice
Avoid: wide decorative banner, bright center, parchment style, stock sci-fi screen
```

## 7. 接入顺序

1. 先生成 `combat_console_left_wing_9s.png`、`combat_console_right_wing_9s.png` 和 `merchant_journey_topbar_9s.png` 概念图。
2. 在 390px 宽截图中验证左右翼不进入中央发射器井，顶部商人条不挡敌人。
3. 再生成宝石、技能按钮框、弹药芯片和 socket 小件。
4. 最后再考虑发射器 V4 正式绿幕分层，因为它必须与中央井尺寸对齐。

正式接入时只改 `src/styles/bitmap_ui.css` 和集中资源映射；不改战斗逻辑、不改发射器物理、不把文字烘焙进图片。

## 8. 验收标准

- 390px 宽下，左右操作台均不与发射器安全框重叠。
- bottom dock 总高度仍为 96px 以内，面板视觉高度仍约 88px。
- 警戒线可见，操作台顶部低于警戒线可视带。
- 左翼能读出当前弹药、短队列和分析入口，不再空。
- 右翼能读出技能、技能点、充能和配置入口，但不显得堆。
- 顶部商人旅程不遮挡敌人，不抢顶部状态栏主体信息。
- low 性能档关闭额外 glow 后，面板边界、按钮、宝石仍可识别。

## 9. Pass 1 概念生成记录

2026-06-24 已生成第一批操作台概念图，全部保存到 `docs/design/concepts/combat_console_v2_pass1/`。这些图只用于风格评审和后续切图参考，尚未进入运行时资产目录。

| 产物 | 文件 | 初评 |
|---|---|---|
| 汇总 contact sheet | `combat_console_v2_contact_sheet_concept.png` | 整体材质方向成立；右侧圆形槽过重，正式版需要压回技能按钮区 |
| 左右翼绿幕源概念 | `combat_console_side_wings_raw_concept.png` | 最接近可落地资产；两翼分离清楚，中间不形成横向底板，可作为正式重做母版 |
| 商人旅程绿幕源概念 | `merchant_journey_topbar_raw_concept.png` | 比例合适，适合顶栏；装饰略豪华，正式版应压暗并缩短边缘球形端帽 |
| SP 宝石绿幕源概念 | `skill_sp_gem_states_raw_concept.png` | 已选第 2 列狭长六边形宝石；正式切图不使用圆形/八边形候选 |

后续正式资产应从这些概念中重新裁切或再生绿幕源图，再按 `assets/ui/{panels,sprites}/` 的命名进入运行时目录。不得直接把 contact sheet 接入游戏。

### 9.1 SP 宝石选型锁定

用户已确认技能点宝石采用 `skill_sp_gem_states_raw_concept.png` 中第 2 列的狭长六边形。已裁出审稿候选：

| 产物 | 文件 | 说明 |
|---|---|---|
| 空态 raw crop | `extracted/skill_sp_gem_hex_empty_raw_crop.png` | 绿幕裁切源，保留给后续重抠或重裁 |
| 亮态 raw crop | `extracted/skill_sp_gem_hex_full_raw_crop.png` | 绿幕裁切源，保留给后续重抠或重裁 |
| 空态 alpha 候选 | `extracted/skill_sp_gem_hex_empty_candidate.png` | 已通过 chroma-key helper 抠出 alpha |
| 亮态 alpha 候选 | `extracted/skill_sp_gem_hex_full_candidate.png` | 已通过 chroma-key helper 抠出 alpha |
| 尺寸可读性检查 | `extracted/skill_sp_gem_hex_readability_sheet.png` | 64/32/16/10/6px 缩放检查 |

验收判断：亮态在 10px 与 6px 下仍能读出尖晶体轮廓；空态在 6px 偏弱，正式 UI 中需要保留暗描边或槽位阴影，状态识别主要依赖亮态。

## 10. Pass 2 综合概念

2026-06-24 已生成第二张综合概念图：`docs/design/concepts/combat_console_v2_pass2/combat_console_v2_integrated_mockup_hex_gems.png`。

本轮用于验证三件事：

- 中央发射器井以半圆缺口形式留空，不做整条底板。
- 右翼技能点宝石使用狭长六边形，并嵌在面板上边框。
- 左翼继续承载当前弹药槽与短队列，使左右信息密度更接近。

初评：整体操作台方向成立；右侧圆形大槽仍偏重，正式切图时需要压低视觉权重，让技能按钮和宝石成为主信息，而不是大圆盘。

## 11. 390px 拆件预览

2026-06-24 已将 Pass 1 拆件候选按真实移动端坐标合成预览：`docs/design/concepts/combat_console_v2_pass2/combat_console_v2_390_candidate_preview.png`。

预览结论：

- 中央 132px 发射器井未被左右翼覆盖，约束成立。
- 狭长六边形 SP 宝石嵌入右翼上边框后，在 10px 级别仍能读出晶体轮廓。
- Pass 1/Pass 3 侧翼源图偏横条，压入 119x88 后存在非等比压缩感；这些图只能作为材质方向参考，不得作为正式切图母版。
- 后续所有 390px 预览禁止用非等比缩放“塞进格子”。若候选图 alpha bbox 比例不在 1.20-1.55 之间，应标记为比例不合格并重生。
- 正式左右翼源图继续采用 360x264 目标比例，对应运行时 119x88，允许 9-slice 拉伸中心，但不允许整体横向挤压。

## 12. 移动端触控面积修正

2026-06-24 补充硬约束：移动端所有可点击目标最小热区为 40x40。

右侧 119x88 面板最多承载 2x2 个技能热区：

- 技能按钮热区：40x40，图标视觉可为 22-26px，但按钮背景与 hit target 必须 40x40。
- 技能点宝石：非点击状态信息，嵌在上边框，不占技能热区。
- 技能充能：非点击短轨，放在边框或技能区外侧，不占技能热区。
- 符文配置：不能再做 20x18 小按钮；需移到左翼操作区或另设 40x40 独立热区。

左侧 119x88 面板建议采用“信息区 + 两个 40x40 操作按钮”：

- 当前弹药/队列为非点击或弱点击信息区。
- 伤害分析按钮：40x40。
- 符文配置按钮：40x40。

若未来主动技能超过 4 个，底部右侧不得继续缩小按钮硬塞，应进入技能抽屉、轮盘或局内配置选择方案。

## 13. Pass 4 触控与比例修正记录

2026-06-24 针对移动端点击热区和旧预览压缩问题，重新生成并校验了一批候选：

| 产物 | 文件 | 结论 |
|---|---|---|
| 左翼 40x40 触控版 raw | `docs/design/concepts/combat_console_v2_pass4/combat_console_left_touch_target_raw_concept.png` | 材质方向可用，右侧两枚 40x40 操作槽明确 |
| 左翼 alpha 候选 | `docs/design/concepts/combat_console_v2_pass4/combat_console_left_touch_target_candidate.png` | alpha bbox 比例 1.231，通过 1.20-1.55 比例门槛 |
| 右翼 40x40 初版 | `docs/design/concepts/combat_console_v2_pass4/combat_console_right_touch_target_candidate.png` | 2x2 技能区成立，但主体比例 1.011，过方，作废 |
| 右翼宽版 raw | `docs/design/concepts/combat_console_v2_pass4/combat_console_right_touch_target_wide_raw_concept.png` | 去掉大圆盘，SP 宝石平嵌边框，结构正确 |
| 右翼宽版 alpha 候选 | `docs/design/concepts/combat_console_v2_pass4/combat_console_right_touch_target_wide_candidate.png` | alpha bbox 比例 1.489，通过比例门槛 |
| 390px 触控预览 | `docs/design/concepts/combat_console_v2_pass4/combat_console_v2_390_touch_target_art_preview.png` | 使用等比缩放：左翼 108x88，右翼 119x80；无非等比压缩 |

本轮更新后的底部布局判断：

- 右侧只承载 2x2 技能热区，每个热区 40x40。
- 右翼上边框可放狭长六边形 SP 宝石，但宝石必须平嵌，不得竖成高塔把 bbox 拉方。
- 右翼不再放大圆盘仪表；技能按钮是主信息。
- 左翼可以承载两个 40x40 操作热区，建议用于伤害分析与符文配置。
- 任何后续审稿预览必须报告候选 alpha bbox 比例和等比缩放后的落点尺寸。

## 14. 信息标注

标注图：`docs/design/concepts/combat_console_v2_pass4/combat_console_v2_info_annotation.svg`。

| 编号 | 区域 | 信息内容 | 点击规则 |
|---:|---|---|---|
| 1 | 顶部商人旅程 | 商人进度、到达提示、可进入商店状态 | 若可点，必须有独立 40x40 热区 |
| 2 | 警戒线 | 敌人越线风险提示 | 不可点击 |
| 3 | 当前弹药信息区 | 当前/下一发弹药图标、属性、伤害短读数、关键标签 | 默认不可点击，可弱点击展开详情 |
| 4 | 弹药序列区 | 后续 3-4 发队列芯片、顺序预览 | 不做小按钮 |
| 5 | 伤害分析按钮 | 打开伤害/输出分析面板 | 40x40 |
| 6 | 符文配置按钮 | 打开符文配置/发射器配置 | 40x40 |
| 7 | 发射器井 | 发射器本体、炮管、发射反馈、发射器跟随 UI | 不放 DOM 操作面板 |
| 8 | SP 宝石边框 | 当前 SP / SP 上限，狭长六边形宝石 | 不可点击 |
| 9 | 技能按钮区 | 最多 4 个主动技能，图标、cost、ready/disabled 状态 | 每个 40x40 |
| 10 | 技能充能轨 | actual/temp 技能充能进度 | 不可点击 |

设计边界：右侧技能区只服务“主动技能触发”；符文配置和伤害分析移到左翼，避免压缩技能按钮。主动技能超过 4 个时，必须进入技能抽屉、轮盘或局内配置方案，不允许继续缩小技能按钮。

## 15. Pass 5 叠加小件资产

2026-06-24 已生成第一批叠加在面板上的小件资产，保存到 `docs/design/concepts/combat_console_v2_pass5/`。这些是审稿候选，不是运行时正式资源。

| 资产 | 文件 | 放置位置 | 运行时尺寸 | 说明 |
|---|---|---|---:|---|
| 当前弹药核心槽 | `combat_current_ammo_core_socket_candidate.png` | 左翼左上角 | 40x40 | 中心留空，后续叠运行时弹药 icon |
| 伤害分析按钮 | `combat_damage_analysis_button_candidate.png` | 左翼右上 40x40 热区 | 40x40 | 打开伤害/输出分析 |
| 符文配置按钮 | `combat_rune_config_button_candidate.png` | 左翼右下 40x40 热区 | 40x40 | 打开符文配置/发射器配置 |
| 技能充能端点 | `combat_skill_charge_endpoint_candidate.png` | 右翼右下角 | 26x30 预览 | 非点击状态件，作为技能充能轨收口 |
| 尺寸检查图 | `combat_console_overlay_sprites_size_check.png` | 审稿参考 | 64/40px | 检查 40px 下可读性 |
| 叠加预览 | `combat_console_v2_overlay_sprites_applied_preview.png` | 390px 移动端预览 | - | 将小件放入 Pass 4 操作台布局 |

叠加预览结果：

- 当前弹药核心槽、伤害分析、符文配置均可按 40x40 等比显示。
- 技能充能端点为非点击件，可缩到约 26x30，不占技能热区。
- 当前弹药核心槽仅提供外框/能量槽，实际弹药图标仍由运行时叠加。
- 伤害分析与符文配置都在左翼，避免右侧技能区被配置入口挤占。

## 16. Pass 6 贴边放大预览

2026-06-24 根据移动端空间反馈，左右面板不再保留 6px 外边距，改为贴屏幕边缘放置，以提升面板可读性和触控余量。

预览文件：`docs/design/concepts/combat_console_v2_pass6/combat_console_v2_390_edge_attached_overlay_preview.png`。

新目标框：

| 区域 | 坐标/尺寸 | 说明 |
|---|---:|---|
| 左翼面板 | x=0, y=589, w=128, h=104 | 直接贴左边和底边，当前弹药/分析/符文配置更舒展 |
| 发射器井 | x=128, y=589, w=134, h=104 | 中央透明区加宽，不承载 DOM 面板 |
| 右翼面板 | x=262, y=589, w=128, h=104 | 直接贴右边和底边，2x2 技能区保持 40x40+ |

等比缩放结果：

- 左翼候选落点 128x103，接近吃满目标框，无非等比压缩。
- 右翼候选落点 128x85，保留底部余量给技能充能端点和安全空隙。
- 叠加件预览尺寸：当前弹药核心 44x43、伤害分析 42x41、符文配置 42x41、技能充能端点 28x32。

结论：贴边放大版本优先级高于旧的 6px 外边距版本。旧版本只保留为对照，不再作为正式布局目标。

## 17. Runtime shell 接入记录

2026-06-24 已先落地一版 runtime shell，用于验证 Pass6 的真实 DOM/CSS 尺寸与触控边界；随后补入 Pass4/Pass5/Pass1 的 runtime candidate 美术资产，不冒充最终 9-slice 正式资产：

- `#combat-bottom-dock` 改为贴边三段式：左翼 `clamp(112px, 32.82vw, 128px)`、中央透明发射器井、右翼同左翼宽度，390px 下对应 128/134/128。
- 符文配置入口已从右侧技能面板移到左翼，与伤害分析一起作为两个 40x40 操作热区。
- 旧的回合伤害数字显示从底部操作台移除；左翼只保留当前弹药与短弹药序列。
- 右翼技能区固定为 2x2、每格 40x40。`activeSkills` 超过 4 个时不再压缩按钮，先通过 `data-overflow-skill-count` 留给后续抽屉/分页方案。
- 运行时美术候选已接入：
  `assets/ui/panels/combat_console_left_wing_runtime_candidate.png`、
  `assets/ui/panels/combat_console_right_wing_runtime_candidate.png`、
  `assets/ui/panels/merchant_journey_topbar_runtime_candidate.png`、
  `assets/ui/sprites/combat_current_ammo_core_socket_runtime_candidate.png`、
  `assets/ui/sprites/combat_damage_analysis_button_runtime_candidate.png`、
  `assets/ui/sprites/combat_rune_config_button_runtime_candidate.png`、
  `assets/ui/sprites/combat_skill_charge_endpoint_runtime_candidate.png`、
  `assets/ui/sprites/skill_sp_gem_empty_runtime_candidate.png`、
  `assets/ui/sprites/skill_sp_gem_full_runtime_candidate.png`。
- 技能点显示改为横向狭长六边形 PNG 宝石，嵌在右翼上边框；正式 `skill_sp_gem_empty/full.png` 仍待绿幕流程重做后替换。
- `combat-rune-charge-ui` 继续复用现有短轨 CSS/位图资源，文案改为“技能充能”。

本轮使用 `_runtime_candidate` 命名，表示来源于已评审概念候选并进入运行时预览；正式透明 PNG 与 9-slice 命名仍需后续按绿幕/chroma key 与切片流程重做后替换。

## 18. Runtime 坐标审计与 Pass8 锁定

2026-06-24 对运行时资源重新测量后，确认当前接入的是 Pass4/Pass5 候选图，不是正式 9-slice。候选图必须等比 `contain` 显示，禁止 `background-size: 100% 100%` 非等比拉伸。

资源测量结果：

| 资源 | 原图尺寸 | alpha bbox | 运行时落点 |
|---|---:|---:|---:|
| 左翼面板 runtime candidate | 1189x966 | 1154x932 | 128x103，贴左下 |
| 右翼面板 runtime candidate | 1288x865 | 1253x830 | 128x85，贴右下 |
| 当前弹药核心槽 | 460x446 | 417x404 | CSS 盒 44x43 |
| 伤害分析按钮 | 400x390 | 358x348 | CSS 盒 42x41，热区 40x40+ |
| 符文配置按钮 | 401x390 | 358x347 | CSS 盒 42x41，热区 40x40+ |
| 技能充能端点 | 388x439 | 346x397 | CSS 盒 28x32 |
| SP 宝石 | 297x167 | 291x161 | CSS 盒 13x8 |

Pass8 DOM 坐标锁定：

| DOM/区域 | 面板局部坐标 | 说明 |
|---|---:|---|
| 左翼弹药信息列 | x=8, y=14, w=panel-58, h=84 | 上半当前弹药，下半短队列 |
| 伤害分析按钮 | right=3, y=8, w=42, h=42 | 对齐左翼右上操作槽 |
| 符文配置按钮 | right=3, y=56, w=42, h=42 | 对齐左翼右下操作槽 |
| 右翼 SP 宝石 | x=9, y=4, w=84, h=12 | 由 `UIManager.updateSkillBar()` 渲染 |
| 右翼技能按钮 | x=9, y=20, w=84, h=84 | 固定 2x2，每格 40x40 |
| 技能充能横轨 | x=9, bottom=7, w=panel-43, h=14 | 对齐右翼底部横向进度槽，读取 `--skill-charge-actual/temp/total` |
| 技能充能端点 | right=3, bottom=2, w=28, h=32 | 非点击装饰与横轨收口 |

后续调整必须先更新本坐标表，再改 `src/styles/bitmap_ui.css`。不要再用流式 grid/flex 自动挤压左右面板内部控件。

### 18.1 Pass9 属性与队列拆分

2026-06-24 根据实机反馈，左翼不再把“下一发子弹 + 属性 + 队列”包成一个单独卡片，而是直接使用面板槽位：

| DOM/区域 | 面板局部坐标 | 说明 |
|---|---:|---|
| 下一发子弹 | x=8, y=14, w=panel-58, h=30 | 子弹 socket、名称、伤害短读数 |
| 子弹属性芯片 | x=8, y=47, w=panel-58, h=20 | 使用共享属性芯片资产，不承载队列 |
| 子弹队列 | x=8, y=70, w=panel-58, h=28 | 后续 1-3 发，显示图标、伤害和主属性色点 |

新增共享属性芯片候选资源：

- `assets/ui/sprites/attribute_chips/attribute_chip_damage.png`
- `assets/ui/sprites/attribute_chips/attribute_chip_bounce.png`
- `assets/ui/sprites/attribute_chips/attribute_chip_pierce.png`
- `assets/ui/sprites/attribute_chips/attribute_chip_scatter.png`
- `assets/ui/sprites/attribute_chips/attribute_chip_cryo.png`
- `assets/ui/sprites/attribute_chips/attribute_chip_pyro.png`
- `assets/ui/sprites/attribute_chips/attribute_chip_lightning.png`
- `assets/ui/sprites/attribute_chips/attribute_chip_laser.png`
- `assets/ui/sprites/attribute_chips/attribute_chip_wind.png`
- `assets/ui/sprites/attribute_chips/attribute_chip_flying_sword.png`
- `assets/ui/sprites/attribute_chips/attribute_chip_resonance.png`
- `assets/ui/sprites/attribute_chips/attribute_chip_venom.png`
- `assets/ui/sprites/attribute_chips/attribute_chip_overcharge.png`
- `assets/ui/sprites/attribute_chips/attribute_chip_echo.png`
- `assets/ui/sprites/attribute_chips/attribute_chip_explosive.png`
- `assets/ui/sprites/attribute_chips/attribute_chip_white.png`
- `assets/ui/sprites/attribute_chips/attribute_chip_empty.png`

这些资源是运行时候选小底片，文字/数值仍由 DOM 叠加。战斗左翼 `.combat-ammo-attribute-chip` 与研磨阶段 `.gathering-ammo-stat-chip` 共用 `.attribute-chip` 基类和同一套位图。

2026-06-24 补齐共享属性 ICON：`assets/ui/sprites/attribute_icons/attribute_icon_*.png`，覆盖 `damage/bounce/pierce/scatter/cryo/pyro/lightning/laser/wind/flying_sword/resonance/venom/overcharge/echo/explosive/white/rainbow/matryoshka/multicast/empty`。这些 ICON 是透明 PNG 符号层，研磨属性 chip、战斗左翼属性 chip、发射器底部属性孔统一通过 `getAttributeIconSrcByKey()` 读取；不得再用 `getAmmoIconSrcByKey()` 的弹药 orb 资源替代属性符号。审稿 contact sheet：`docs/design/concepts/attribute_icons_pass1/attribute_icon_contact_sheet.png`。

### 18.2 Pass10 选中右翼面板与槽位重标定

2026-06-24 根据实机反馈，右翼不再使用 `combat_console_right_wing_runtime_candidate.png` 宽版候选，改用用户选中的 5 点数/2x2 技能槽/底部横轨面板。运行时资源与归档如下：

- 新右翼运行时面板：`assets/ui/panels/combat_console_right_selected_runtime_candidate.png`，由 `docs/design/concepts/combat_console_v2_pass7/combat_console_right_selected_with_skill_overlays.png` 清理四个烙印技能图标后生成，原图尺寸 956x944。
- 新 SP 亮态叠加：`assets/ui/sprites/skill_sp_gem_hex_full_runtime_candidate.png`；面板已烘焙空态宝石槽，运行时空态 DOM 不再额外铺底。
- 已归档旧候选：`assets/ui/archive/combat_console_v2_replaced_pass10/combat_console_right_wing_runtime_candidate.png`、`combat_skill_charge_endpoint_runtime_candidate.png`、`skill_sp_gem_empty_runtime_candidate.png`、`skill_sp_gem_full_runtime_candidate.png`。

Pass10 坐标约束：

| DOM/区域 | 面板定位 | 说明 |
|---|---:|---|
| 左右面板外框 | `--combat-console-wing: clamp(128px, 38.5vw, 160px)`；`--combat-console-height: clamp(128px, 38vw, 154px)` | 左右等比放大，中央仍保留发射器井 |
| 左翼最终微调 | `transform: scale(1.055)`，origin left bottom | 只放大左翼面板与其槽位内容，不改变中间发射器井网格 |
| 右翼最终微调 | `transform: translateY(5px)`，origin right bottom | 只把用户选中的右翼面板整体下移，保留 2x2/充能槽百分比坐标 |
| 左翼当前弹药圆槽 | left 7%，top 26%，w/h 20% | 对齐左上圆形槽，不再沿用旧卡片左上角 |
| 左翼子弹队列 | left 25.5%，right 22%，bottom 7.5%，4 列 | 对齐底部四个素材格；`hud.js` 从 `ammoQueue[1]` 开始渲染后续弹，不再显示当前待发弹 |
| 右翼技能点 | left 31.5%，top 1.5%，w 47%，h 24% | 最多 5 点，空槽由面板底图承载，满点叠加亮态宝石 |
| 右翼技能按钮 | left 28.2%，top 25.9%，w 55.2%，h 55.8% | 按 2x2 素材槽百分比定位，不沿用旧 40px 绝对坐标 |
| 右翼技能充能 | left 25.8%，right 22.2%，bottom 11.4%，h 5-7px | 直接贴底部横轨，`#combat-charge-bar-shell` 不再绘制额外底板 |
| 右翼技能编辑 | right 0，bottom 0，40x40 热区 | 使用 `assets/ui/sprites/skill_editor_button.png` 贴合右下菱形槽；`#skill-editor-open-btn` 不再放在顶部栏 |

后续不得再把 `skill_charge_panel_9s.png` 或旧端点 Sprite 当作右翼底部充能底板叠在选中面板上；该面板自己的横轨是唯一底图，DOM 只负责 actual/temp fill。

2026-06-26 右下技能装配入口补充：技能编辑按钮从左上顶部栏移入右翼面板右下角。为避免覆盖按钮，运行时可将技能充能轨缩短为上段状态读数；编辑按钮视觉资产来自绿幕源 `skill_editor_button_raw.png`，透明成品为 `skill_editor_button.png`，不包含文字、数字或动态内容。

### 18.3 Pass11 发射器承载当前弹信息

2026-06-24 调整后，发射器本体承载 `ammoQueue[0]` 当前待发弹信息：`render_combat_launcherSignal()` 在发射器美术上叠加当前弹体、左侧逆时针旋转 90 度伤害、底部 6 个圆孔属性图标与层数、右下连射次数。左翼面板从 `ammoQueue[1]` 开始，只负责下一发与后续队列。
