# 敌人原生镂空重绘方案

> 日期：2026-06-21  
> 目标：解决大型/高覆盖率敌人遮挡底层 HP 液体的问题，但不采用“在完整主体上硬开孔”的后期切洞方案。

参考概念板：[`docs/design/concepts/enemy_native_hollow_concept_2026-06-21.png`](concepts/enemy_native_hollow_concept_2026-06-21.png)

运行时预览：[`docs/screenshots/enemy-native-hollow-runtime-preview.png`](../screenshots/enemy-native-hollow-runtime-preview.png)

## 总原则

敌人主体必须从概念阶段就是可镂空结构：外轮廓负责识别和威胁感，内部通过桥架、肋骨、环形石框、蜂巢孔、履带拱架等结构自然留空，让 Layer 2 的 HP 液体从下方透出。

禁止把血条、数字、UI 框或碰撞框画进主体 PNG。碰撞边界继续由 `frames/` 材质框表达，主体 Sprite 只负责敌人身体、核心和词条形象。

## 否决方向

- 不要在完整石块、完整装甲板、完整圆盘上直接挖矩形洞。
- 不要让镂空边缘看起来像后期蒙版裁掉，必须有倒角、内壁、嵌槽或结构支撑。
- 不要为了露 HP 牺牲 archetype silhouette：玩家仍应一眼看出 1x1 残渣、2x2 吞噬、3x2 攻城、2x3 蜂巢。
- 不要用纯绿描边、发光边或 UI 式窗口提示“这里是洞”。

## 目标资产设计

| 资源 | 原生镂空结构 | 读血窗口 | 保留识别点 |
|---|---|---|---|
| `residue:1x1:` | 三到四段拼合的磨石环，中央核心由细金属/石质支柱悬挂 | 左右侧弧形空腔 + 底部断环 | 单格低威胁、橙色小核心、磨损石材 |
| `maw:2x2:devour` | 四枚弯曲颚板围成吞噬腔，角部是独立咬合爪，不是实心方块 | 四角之间自然透空，底部有喉腔拱门 | 中央红黑吞噬口、锯齿内环、危险感 |
| `siege:3x2:siege` | 左右履带 + 中央高架动力桥，底盘是拱架/梁，不是满板车体 | 三个履带间拱洞 + 前铲分段缝 | 3x2 宽体、履带、推铲、抗冻热管 |
| `hive:2x3` | 纵向蜂巢石架，多层六边形巢室和卵囊节点 | 六边形巢室本身透空，底部两格保留大孔 | 孵化巢、卵囊、多孔结构、竖向压迫 |

## 当前接入

2026-06-21 已从概念板切出第一批透明运行时 PNG，并接入 `enemy_sprite_manifest.json` 与 `src/data/enemy_visual_assets.js` 默认资源表：

| 资源键 | 运行时 PNG |
|---|---|
| `residue:1x1:` | `assets/sprites/enemies/composites/enemy_residue_1x1_native_hollow_idle.png` |
| `maw:2x2:devour` | `assets/sprites/enemies/composites/enemy_maw_devour_2x2_native_hollow_idle.png` |
| `maw` archetype | `assets/sprites/enemies/archetypes/enemy_maw_2x2_native_hollow.png` |
| `siege:3x2:siege` | `assets/sprites/enemies/composites/enemy_siege_siege_3x2_native_hollow_idle.png` |
| `siege` archetype | `assets/sprites/enemies/archetypes/enemy_siege_3x2_native_hollow.png` |
| `hive` archetype | `assets/sprites/enemies/archetypes/enemy_hive_2x3_native_hollow.png` |

生成脚本：`scripts/build_enemy_native_hollow_assets.py`。该脚本只从已确认概念板裁切透明素材，不再做“硬开孔”加工。

## 出图 Prompt 模板

```text
Use case: stylized-concept
Asset type: transparent game enemy sprite, front-facing orthographic view
Primary request: <resourceId>, native hollow enemy body redesign for Echo Alchemist V2
Style/medium: dark alchemical fantasy bitmap sprite, geometric whetstone stone and dark metal, readable at 128px runtime scale
Camera/view: strict orthographic front view with very slight top-down angle, centered silhouette matching <footprint>
Subject: the enemy is designed as an inherently hollow structure, not a solid body with holes cut out later
Structure: <choose ring / jaw plates / bridge chassis / honeycomb lattice>; all openings have beveled inner walls, carved sockets, support ribs, and believable mechanical/stone continuity
HP readability: leave natural transparent openings across the lower third and interior bands so runtime HP liquid can show through; do not draw health bars or UI
Materials/textures: chipped dark whetstone, ground bevels, mineral cracks, embedded alchemical core, restrained accent glow
Composition/framing: transparent background, generous padding, no collision frame, no floor, no cast shadow, no text, no logo
Avoid: rectangular punched holes, flat mask cutouts, solid filled center, decorative UI windows, green outline, oversized glow, side view, three-quarter perspective
```

## 验收标准

- 结构解释成立：每个透明区域都能被理解为环、桥、巢孔、拱洞或机械间隙。
- 运行时底层 HP 可读：底部 1/3 和主体中心至少有连续自然透空区域。
- 轮廓不丢：在 128px 显示时仍能读出 footprint 与 archetype。
- 与 collision frame 分工清楚：主体不画外框，不改变玩家对碰撞范围的判断。
- 透明边缘干净：无绿幕残边、无半透明脏边、无背景纹理。
