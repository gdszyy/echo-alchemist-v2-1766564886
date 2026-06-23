# 战斗阶段场地与 UI 资产重生成设计案

> 日期：2026-06-23
> 范围：`#phase-combat` 战斗背景、墙体、防线、底部发射区、技能栏、符文充能、态势条、战斗 UI 图标与面板底。
> 目标：先统一设计语言，再进入图片生成与接入；本案不修改运行时代码。

## 1. 设计结论

本轮战斗资产重生成建议采用 **“黑曜石炼金战台 + 镶金能量防线 + 精密仪表 UI”**。

战斗阶段应看起来像一座竖屏炼金防御台：敌人从上沿裂隙压入，中场是低对比黑曜石弹道区，两侧墙体是可反弹的能量导轨，底部是发射器与弹药炼成工坊。UI 面板不再各自发光，而是像嵌在战台边缘的仪表盘。

核心变化不是“加更多光”，而是把现有资产统一成三种材质：

| 材质 | 用途 | 视觉规则 |
|---|---|---|
| 黑曜石磨石 | 背景、中场、墙体基座 | 低对比、可见磨损与刻线，不抢弹道和敌人 |
| 暗金金属 | 面板框、发射器、按钮底 | 表达可操作设备，边缘有铆钉和机械槽 |
| 青蓝/琥珀能量 | 墙体反弹线、符文充能、发射器读数 | 只用于机制信号，避免铺满全屏 |

## 2. 阅读层级

战斗首屏资产必须服务这条阅读路径：

1. 顶部/态势条：当前危险程度与敌人数量。
2. 中场：敌人位置、弹道、碰撞墙和状态短标签。
3. 底部发射器：下一发是什么、能造成什么效果。
4. 右下技能栏与符文充能：还能否主动干预。

背景与面板底只能做 L0 环境态，不能把亮度压过敌人、弹丸、伤害数字和状态短标签。

## 3. 资产批次

### Batch A：战斗场地三层背景

| 资产 | 路径建议 | 尺寸 | 用途 | 接入方式 |
|---|---|---:|---|---|
| 主战场背景 V2 | `assets/ui/backgrounds/bg_combat_table_v2.png` | 720x1280 | 替代或试运行于 `bg_main_canvas.png` 的战斗版本 | Canvas `drawImage`，保持低对比 |
| 发射区背景 V2 | `assets/ui/backgrounds/bg_combat_emitter_zone_v2.png` | 720x240 | 替代底部 220px 发射区 | Canvas 裁切叠加 |
| 顶部裂隙/敌人入口 | `assets/ui/backgrounds/bg_combat_spawn_gate_v2.png` | 720x220 | 顶部敌人入场气氛层 | 可先作为背景烘进主图，后续再拆层 |

主战场背景要求：

- 中央 70% 宽度保持暗、干净、无高频纹理，确保弹丸轨迹清楚。
- 左右 10% 可放管线、刻度、能量槽，但亮度低于墙体反弹线。
- 顶部敌人入口有压迫感，但不能出现像敌人本体的形状，避免误读。
- 底部必须为发射器和属性轨道预留视觉空间，不能有强亮图案穿过发射器。

### Batch B：战斗墙与防线资产

现有墙体在 `src/game_phase.js` 中使用渐变线与 `_sb()` 发光绘制。建议后续改成“静态墙体位图 + 轻量 Canvas 线”的混合方案。

| 资产 | 路径建议 | 尺寸 | 用途 | 约束 |
|---|---|---:|---|---|
| 左墙导轨 | `assets/ui/sprites/combat_wall_left_v2.png` | 48x1024 | 左侧可反弹墙体材质 | 纵向可拉伸或重复，右侧渐隐 |
| 右墙导轨 | `assets/ui/sprites/combat_wall_right_v2.png` | 48x1024 | 右侧可反弹墙体材质 | 与左墙镜像，左侧渐隐 |
| 顶部防线横梁 | `assets/ui/sprites/combat_wall_top_v2.png` | 720x64 | 顶部反弹线/敌人入墙边界 | 中央低亮，边缘接左右墙 |
| 危险防线条 | `assets/ui/sprites/combat_defeat_line_v2.png` | 720x32 | 防线危险提示 | 默认低透明，危险时可 CSS/Canvas 提亮 |
| 墙撞火花 | `assets/ui/sprites/wall_impact_spark_v2_0.png` ~ `_3.png` | 64x64 | 子弹撞墙反馈 | 可选；若接入动画需性能评估 |

墙体视觉语法：

- 平时：冷青玻璃边 + 暗金机械槽，玩家能一眼看见反弹边界。
- 高压：顶部防线与底部危险线变暖，青蓝转橙红，但不改变墙体位置。
- 省电档：必须仍保留平面线和材质边，不依赖发光才能看见。

### Batch C：战斗 HUD 面板底

| 资产 | 路径建议 | 尺寸 | 用途 | 9-Slice |
|---|---|---:|---|---:|
| 态势条底板 | `assets/ui/sprites/combat_status_panel_v2_9s.png` | 640x160 | `#combat-status-panel` | 44 92 |
| 技能栏底板 | `assets/ui/sprites/skill_bar_panel_v2_9s.png` | 384x512 | `#skill-bar.skill-bar-panel` | 38 48 |
| 技能按钮框 | `assets/ui/sprites/skill_button_frame_v2_9s.png` | 96x96 | 单个技能按钮 | 20 |
| 符文充能框 | `assets/ui/sprites/combat_rune_charge_frame_v2_9s.png` | 420x96 | `#combat-rune-charge-ui` | 30 78 |
| 符文充能填充 | `assets/ui/sprites/combat_rune_charge_fill_v2.png` | 224x28 | 符文充能条 | 无 |
| 伤害统计按钮底 | `assets/ui/sprites/damage_stats_button_v2.png` | 132x44 | 伤害统计入口 | 无 |

HUD 资产要求：

- 面板中心区域要足够暗，保证文字数字可读。
- 边框可有暗金和青蓝刻线，但不能使用强烈内发光。
- 技能按钮禁用态应靠“去饱和 + 遮罩”表达，不额外生成一套复杂按钮。
- 9-Slice 边角不应包含重要文字或复杂图形，避免拉伸变形。

### Batch D：战斗图标刷新

当前弹药、符文、遗物图标覆盖率较高。本轮只建议刷新与战斗界面常驻相关的图标，不做全量遗物重绘。

| 资产组 | 路径建议 | 尺寸 | 数量 | 说明 |
|---|---|---:|---:|---|
| 技能图标 V2 | `assets/ui/icons/skills/skill_<id>_v2.png` | 48x48 | 6 | 与技能栏底板同材质；生成用绿幕背景，接入前本地抠 alpha |
| 态势条短图标 | `assets/ui/icons/combat/status_<id>_v2.png` | 24x24 | 8 | 敌人、精英、Boss、盾、弹药、防线、警戒、稳定 |
| 防线状态徽章 | `assets/ui/icons/combat/threat_<safe/watch/danger>_v2.png` | 32x32 | 3 | 给态势条使用 |
| 墙体遗物图标刷新 | `assets/icons/relic/energy_shield_v2.png` | 64x64 | 1 | 与新墙体材质一致 |

图标设计要求：

- 小尺寸先验收：24px 和 32px 下必须可读。
- 不使用文字烘焙进图标。
- 元素类图标继续沿用既有 `assets/icons/ammo/`，避免同一属性出现两套符号。
- 技能图标只重画技能语义，不把按钮框烘进图标本身。

### Batch E：发射器 V4 分层预研

发射器 V3 已经有中央弹丸舱、左右显示区和六个弹仓。本轮不建议立刻替换，先做 V4 概念稿，确认是否值得生成。

关键规则：**炮台底座和炮管必须分开绘制**。底座负责承载不会随瞄准角旋转的数据 UI；炮管只负责表达当前发射方向，围绕底座中央枢轴旋转。

| 资产 | 路径建议 | 尺寸 | 说明 |
|---|---|---:|---|
| 发射器 V4 旧整体概念 | `docs/design/concepts/combat_ui_pass1/emitter_v4_concept.png` | 1024x1024 | 已用于方向探索；不得直接接入 |
| 静态炮台底座概念 | `docs/design/concepts/combat_ui_pass1/emitter_base_stationary_v4_concept.png` | 1024x1024 | 数据 UI 不旋转，保留中央枢轴 |
| 可旋转炮管概念 | `docs/design/concepts/combat_ui_pass1/emitter_barrel_rotating_v4_concept.png` | 1024x1024 | 单独炮管层，底部锚点对齐底座枢轴 |
| 发射器 V4 正式底座 | `assets/ui/sprites/emitter_base_stationary_v4.png` | 256x256 | 只画底座、读数框、弹仓和枢轴，不画炮管 |
| 发射器 V4 正式炮管 | `assets/ui/sprites/emitter_barrel_rotating_v4.png` | 128x192 或 256x256 | 绿幕抠图后的 PNG，锚点为底部旋转轴；运行时随发射角旋转 |
| 发射器 V4 蓄力层 | `assets/ui/sprites/emitter_charging_v4_0.png` ~ `_5.png` | 256x256 | 只叠加底座能量，不改变炮管方向 |

V4 静态底座必须保留：

- 中央炮管枢轴/弹丸舱。
- 左侧伤害读数框。
- 右侧连射/散射读数位。
- 六个底部装填格。
- `EMITTER_DRAW_SIZE` 目标 128px 时仍可读。

V4 可旋转炮管必须满足：

- 不包含伤害、散射、连射、装填格等数据 UI。
- 默认朝上绘制，运行时以底部枢轴中心旋转。
- 旋转包围盒不能遮挡左右数据屏；正式版应比概念图更瘦。
- 枪口、能量管和蓄力高亮可以随炮管旋转，但炮台读数永远保持水平。

## 4. 生成 Prompt 草案

重要约束：图片生成阶段不要要求“透明背景 / transparent background / no background”。当前透明运行时资产统一采用 **绿幕抠图流程**：prompt 要求纯色 chroma key 背景，生成后再由本地脚本把 key 色转换为 alpha。推荐 key 色为 `#00ff00` 或高饱和纯绿；素材主体不得使用接近 key 色的大面积绿色，边缘不要投影到绿幕上。

### 4.1 主战场背景

```text
Use case: stylized-concept
Asset type: mobile vertical game battle background, 720x1280
Primary request: a dark obsidian alchemy battle table for a roguelike pachinko combat screen
Scene/backdrop: vertical defensive alchemy arena, enemy entrance at the top, clean projectile reading space in the center, launcher workshop area at the bottom
Style/medium: high quality game UI background, painted bitmap asset, dark fantasy alchemy, cyber-alchemical machinery
Composition/framing: straight-on orthographic mobile game board, centered safe combat lane, decorative side rails only at the edges
Lighting/mood: restrained cold cyan edge light with subtle amber metal accents, low contrast center
Color palette: obsidian black, charcoal slate, muted cyan, dark gold, tiny crimson warning accents
Materials/textures: worn obsidian stone, beveled dark metal, engraved alchemy circuit lines, subtle scratches
Constraints: no characters, no enemies, no text, no logos, no bright objects in the central projectile lane, no strong purple dominance
Avoid: busy texture in the middle, atmospheric fog that hides projectiles, stock sci-fi panels, large glowing orbs, UI text
```

### 4.2 墙体导轨

```text
Use case: stylized-concept
Asset type: game UI sprite for a vertical combat wall rail on chroma key background
Primary request: left-side alchemical rebound wall rail for a vertical battle arena
Style/medium: polished bitmap game asset, dark metal and obsidian, rendered on a flat chroma green background
Composition/framing: tall narrow vertical rail, hard readable inner rebound edge, outer side fades to dark material but does not fade into the green screen
Lighting/mood: cold cyan glass edge with subtle amber mechanical clamps
Color palette: charcoal, obsidian, cyan, dark gold
Materials/textures: beveled metal, glass energy channel, engraved alchemy ticks, worn stone sockets
Constraints: flat solid #00ff00 chroma key background, no text, no icons, no enemies, inner edge must be straight and readable
Avoid: checkerboard preview background, green glow, thick bloom, noisy center, curved silhouette, perspective tilt, cast shadow on the green background
```

右墙可由左墙镜像，除非生成结果有明显方向性纹理。

### 4.3 HUD 面板底

```text
Use case: ui-mockup
Asset type: 9-slice game HUD panel background
Primary request: compact combat status panel frame for a dark alchemy battle UI
Style/medium: high resolution bitmap UI asset, 9-slice friendly, dark fantasy alchemy machinery
Composition/framing: horizontal rounded rectangle with simple corners and stretchable center, center area very dark for text
Lighting/mood: restrained cyan rim light, small dark gold corner brackets
Color palette: near-black slate, muted cyan, aged gold
Materials/textures: dark metal, obsidian inset, engraved thin circuit lines
Constraints: no text, no icons, no large center decoration, corners and edges must support 9-slice slicing
Avoid: bright center glow, complex symbols in stretch zones, soft blurry card style, purple-heavy gradient
```

### 4.4 技能图标

```text
Use case: stylized-concept
Asset type: 48x48 game skill icon on chroma key background
Primary request: <skill semantic>, compact readable icon for a dark alchemy combat skill button
Style/medium: polished small game icon, rendered on a flat chroma green background, strong silhouette
Composition/framing: centered symbol, no button frame, generous padding, readable at 24px
Lighting/mood: restrained inner glow only on the symbol
Color palette: match skill element, with dark metal micro accents
Constraints: flat solid #00ff00 chroma key background, no text, no UI frame, no background card, no watermark
Avoid: checkerboard preview background, green glow, tiny unreadable details, full scene illustration, overexposed glow
```

## 5. 接入顺序

推荐先生成但分阶段接入：

1. **只生成概念预览**：主背景、墙体、态势条、技能栏、符文充能、发射器 V4 各 1 张。
2. **确定风格后生成 Batch A/B/C**：背景、墙体、HUD 面板。
3. **低风险接入**：先替换静态背景与 DOM 9-Slice，不改交互。
4. **墙体接入**：把墙体位图作为 Canvas `drawImage` 层，保留现有线条 fallback。
5. **图标刷新**：技能与态势短图标接入 `src/bitmap_icons.js` 或集中映射文件。
6. **发射器 V4**：只有当 V4 在 128px 绘制尺寸下明显优于 V3，再替换运行时映射。

## 6. 性能边界

本设计优先使用静态位图与 9-Slice，因此默认不需要新增 `CONFIG.performance` 字段。

| 项目 | high | medium | low |
|---|---|---|---|
| 背景 | 1 次主背景 drawImage + 1 次底部层 drawImage | 同 high | 同 high，可降低 alpha |
| 墙体 | 位图墙 + 现有 `_sb()` 门控线 | 位图墙 + 弱线 | 位图墙 + 平面线，无额外发光 |
| HUD 面板 | CSS 9-Slice | 同 high | 同 high |
| 图标 | 固定尺寸图片 | 同 high | 同 high |
| 墙撞火花 | 可选 4 帧 sprite | 可降频 | 可关闭或保留单帧 |

如果后续接入 `wall_impact_spark_v2_*` 或新增墙体动态流光，需要在相关代码补 `// @perf-impact`，并在总结中说明是否复用既有 `sparkLimit` 或仅作固定帧贴图。

## 7. 验收标准

- 移动端 390px 宽度下，墙体位置和实际反弹边界一致。
- 中场敌人、弹丸、伤害数字、短标签不被背景纹理淹没。
- `low` 档关闭发光后，墙体、防线、技能按钮仍能识别。
- `#combat-status-panel`、`#skill-bar`、`#combat-rune-charge-ui` 不因 9-Slice 改变尺寸或遮挡。
- 发射器区域不遮挡底部安全区，不与技能栏抢第一视线。
- 资产命名遵守 `kebab-case` 或既有模块命名；raw 源图保留 `_raw` 后缀，正式 9-Slice 保留 `_9s` 后缀。

## 8. 首轮生成清单

第一轮只做 8 张概念/候选图，供肉眼选风格：

| 序号 | 产物 | 存放建议 |
|---:|---|---|
| 1 | 战斗主背景 V2 概念 | `docs/design/concepts/combat_ui_pass1/bg_combat_table_v2_concept.png` |
| 2 | 底部发射区 V2 概念 | `docs/design/concepts/combat_ui_pass1/bg_combat_emitter_zone_v2_concept.png` |
| 3 | 左墙导轨 V2 概念 | `docs/design/concepts/combat_ui_pass1/combat_wall_left_v2_concept.png` |
| 4 | 顶部防线横梁 V2 概念 | `docs/design/concepts/combat_ui_pass1/combat_wall_top_v2_concept.png` |
| 5 | 态势条 9-Slice 概念 | `docs/design/concepts/combat_ui_pass1/combat_status_panel_v2_concept.png` |
| 6 | 技能栏 9-Slice 概念 | `docs/design/concepts/combat_ui_pass1/skill_bar_panel_v2_concept.png` |
| 7 | 符文充能框概念 | `docs/design/concepts/combat_ui_pass1/combat_rune_charge_frame_v2_concept.png` |
| 8 | 发射器 V4 概念 | `docs/design/concepts/combat_ui_pass1/emitter_v4_concept.png` |

通过后再进入正式资源目录，避免概念稿污染运行时资产。

## 9. 不做事项

- 不在这一轮重画敌人/Boss 本体；敌人已有独立资产计划。
- 不全量重画遗物/符文图标；只处理战斗常驻技能和态势图标。
- 不新增粒子系统或持续高频 Canvas 特效。
- 不把文字烘焙进图片。
- 不改 DOM 结构、不改战斗逻辑、不改阶段流转。

## 10. Pass 1 概念生成记录

2026-06-23 已生成第一轮概念图，全部保存在 `docs/design/concepts/combat_ui_pass1/`。这些文件只用于风格评审，尚未进入运行时资产目录。

| 产物 | 文件 | 初评 |
|---|---|---|
| 汇总图 | `combat_ui_pass1_contact_sheet.png` | 用于快速横向比较整体风格 |
| 战斗主背景 | `bg_combat_table_v2_concept.png` | 中场干净、边轨明确，适合作为正式背景方向 |
| 底部发射区 | `bg_combat_emitter_zone_v2_concept.png` | 中央凹槽和两侧能量管清晰，可继续压暗中心 |
| 左墙导轨 | `combat_wall_left_v2_concept.png` | 直线内缘明确；后续正式版应从绿幕源图裁成窄条并本地抠 alpha |
| 顶部横梁 | `combat_wall_top_v2_concept.png` | 下沿冷色线可作为反弹边界视觉锚点 |
| 态势条底板 | `combat_status_panel_v2_concept.png` | 中心可读性好，可继续简化边角细节 |
| 技能栏底板 | `skill_bar_panel_v2_concept.png` | 结构感强，但按钮槽烘得较重；正式版建议拆成面板底与按钮框 |
| 符文充能框 | `combat_rune_charge_frame_v2_concept.png` | 左侧 socket 适合承载符文图标，正式版需压暗上下能量管 |
| 发射器 V4 | `emitter_v4_concept.png` | 读数位、中央弹舱和六弹仓清楚，值得进入正式拆层预研 |
| 静态炮台底座 | `emitter_base_stationary_v4_concept.png` | 数据 UI 固定在底座，中央枢轴清楚，符合拆层方向 |
| 可旋转炮管 | `emitter_barrel_rotating_v4_concept.png` | 独立方向层成立；正式版建议收窄，避免旋转时压住底座读数 |
| V4 分层运行时预览 | `emitter_v4_split_runtime_preview.png` | 同一底座叠加三种炮管角度；用于验收数据 UI 固定、炮管独立旋转 |

注意：本轮概念图为 RGB 预览图，部分“透明”区域是生成器烘焙出的棋盘格，并非真实 alpha。后续正式生成不要在 prompt 中要求透明底，应要求纯绿幕 key 背景，再由本地脚本抠成透明 PNG，并按运行时目标尺寸裁切。

## 11. V4 分层运行时撤回记录

2026-06-23 已撤回第一版 V4 分层发射器运行时资源：这些文件来自非绿幕透明/棋盘格 prompt 后处理，不符合当前 chroma key 资产流程。原文件已移动到 `docs/design/concepts/combat_ui_pass1/rejected_chroma_key_required/`，仅保留为反例和重做参考。运行时已切回 V3 发射器资源，`EMITTER_BARREL_SRC` 当前为 `null`。

| 资产 | 文件 | 说明 |
|---|---|---|
| 静态底座 raw | `assets/ui/sprites/emitter_base_stationary_v4_alpha_raw.png` | 从概念图/绿幕源图后处理出 alpha 后的源尺寸裁切版 |
| 静态底座运行时 | `assets/ui/sprites/emitter_base_stationary_v4.png` | 已撤回；256x256；承载读数框、弹仓和中央枢轴，不包含炮管 |
| 可旋转炮管 raw | `assets/ui/sprites/emitter_barrel_rotating_v4_alpha_raw.png` | 从概念图/绿幕源图后处理出 alpha 后的源尺寸裁切版 |
| 可旋转炮管运行时 | `assets/ui/sprites/emitter_barrel_rotating_v4.png` | 已撤回；256x256；运行时以底部圆环为锚点旋转 |
| 蓄力叠加层 | `assets/ui/sprites/emitter_charging_v4_0.png` ~ `_5.png` | 已撤回；只叠加底座能量，不旋转数据 UI |
| 分层验收预览 | `docs/design/concepts/combat_ui_pass1/emitter_v4_split_runtime_preview.png` | 使用运行时底座、炮管和同一 pivot 规则合成，确认读数 UI 不跟随炮管旋转 |

运行时映射已恢复为 V3：`src/bitmap_icons.js` 中 `EMITTER_BASE_SRC = emitter_base_v3.png`，`EMITTER_BARREL_SRC = null`，`EMITTER_CHARGING_SRCS` 指向 V3 蓄力帧。`src/render_system.js` 的 `render_combat_launcherEmitterBase()` 仍保留可选炮管分层绘制能力，等绿幕重做资产合格后再重新启用，不改变实际发射物理与瞄准线锚点。

性能自适应影响评估：撤回后不再新增炮管 `drawImage`；当前恢复到 V3 底图 + V3 蓄力帧路径。后续绿幕版 V4 重新接入时，再重新记录 1 次额外炮管 `drawImage` 的影响评估。

## 12. 战斗场地 V2 运行时接入与撤回记录

2026-06-23 已将首轮概念稿中的完整背景处理为第一版运行时资源，并以 `_v2` 后缀非破坏式接入。依赖透明边缘的墙体/HUD 资源已撤回，原因同上：源图未按绿幕/chroma key 流程生成。

| 资产 | 文件 | 说明 |
|---|---|---|
| 战斗主背景 | `assets/ui/backgrounds/bg_combat_table_v2.png` | 720x1280；仅 `phase === 'combat'` 时替代原 `bg_main_canvas.png` |
| 战斗底部发射区 | `assets/ui/backgrounds/bg_combat_emitter_zone_v2.png` | 720x220；仅战斗阶段替代原 `bg_emitter_zone.png` |
| 左反弹墙 | `assets/ui/sprites/combat_wall_left_v2.png` | 已撤回；48x1024；需绿幕源图重做 |
| 右反弹墙 | `assets/ui/sprites/combat_wall_right_v2.png` | 已撤回；48x1024；需绿幕源图重做 |
| 顶部反弹墙梁 | `assets/ui/sprites/combat_wall_top_v2.png` | 已撤回；720x64；需绿幕源图重做 |
| 态势条底板 | `assets/ui/sprites/combat_status_panel_v2_9s.png` | 已撤回；640x160；需绿幕源图重做 |
| 技能栏底板 | `assets/ui/sprites/skill_bar_panel_v2_9s.png` | 已撤回；384x512；需绿幕源图重做 |
| 符文充能框 | `assets/ui/sprites/combat_rune_charge_frame_v2_9s.png` | 已撤回；420x96；需绿幕源图重做 |
| 运行时资产预览 | `docs/design/concepts/combat_ui_pass1/combat_ui_runtime_v2_asset_preview.png` | 用于检查正式资源尺寸、alpha 与整体方向 |

运行时映射集中在 `src/bitmap_icons.js`：战斗阶段继续使用 `BG_COMBAT_TABLE_SRC`、`BG_COMBAT_EMITTER_ZONE_SRC`；墙体 `COMBAT_WALL_LEFT_SRC`、`COMBAT_WALL_RIGHT_SRC`、`COMBAT_WALL_TOP_SRC` 当前为 `null`。`src/render_system.js` 的 `render_combat_walls()` 因此走旧渐变墙 fallback。`src/game_phase.js` 只从内联墙体绘制切换为调用该渲染函数，不改变碰撞边界、敌人生成、子弹反弹或阶段流转。

性能自适应影响评估：当前只保留战斗背景每帧 1 次全屏 `drawImage` 与底部发射区 1 次裁剪 `drawImage`；墙体回到旧渐变 fallback，HUD 回到旧 CSS/9-Slice 资源。后续绿幕版墙体重新接入时，再重新记录最多 3 次静态 `drawImage` 的影响评估。
