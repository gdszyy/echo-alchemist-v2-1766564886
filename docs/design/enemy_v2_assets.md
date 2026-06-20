# Enemy V2 Dark Alchemical Fantasy Assets

> 2026-06-19 风格补充：后续替换或扩展本包资源时，统一采用“几何磨石块基座 + 镶嵌核心”的敌人母题。资源应像被打磨、切削、腐蚀过的几何石块，机制核心嵌入石槽内部；不要做成纯光效、纯软体、纯机械载具或 UI 徽章。完整规范见 [`enemy_geometric_whetstone_style.md`](enemy_geometric_whetstone_style.md)。

本包包含两批共 **20 个透明背景 PNG** 资源。所有资源均以纯色底生成后执行抠图处理，并在最终 PNG 中保留约 **10% 透明安全边距**；资源不含文字、数字、Logo、血条、UI 框或完整背景场景，适合 Canvas 战斗棋盘、试炼场卡片与图鉴缩略图使用。

| 文件名 | baseArchetype | footprint | affixes | 推荐用途 |
|---|---:|---:|---|---|
| `enemy_residue_1x1_idle.png` | Residue | 1×1 | 无 | 普通低复杂度对照组，可用于新手怪、填充怪或低威胁棋盘单位。 |
| `enemy_bastion_heavyarmor_3x1_idle.png` | Bastion | 3×1 | heavyArmor | 横向三格重甲阻挡单位，适合前排压迫、占格教学与护甲机制展示。 |
| `enemy_maw_devour_2x2_idle.png` | Maw | 2×2 | devour | 中大型吞噬威胁单位，适合吞噬、吸收、吞牌或吞格相关机制表现。 |
| `enemy_siege_siege_3x2_idle.png` | Siege | 3×2 | siege | 大型破阵履带单位，适合推铲、破防、抗控或区域推进机制表现。 |
| `archetype_bastion.png` | Bastion | UI Icon | 无 | Bastion 基底类型图标，可用于图鉴、卡牌角标或试炼类型标签。 |
| `archetype_maw.png` | Maw | UI Icon | 无 | Maw 基底类型图标，可用于图鉴、卡牌角标或吞噬类敌人索引。 |
| `archetype_siege.png` | Siege | UI Icon | 无 | Siege 基底类型图标，可用于图鉴、卡牌角标或攻城类敌人索引。 |
| `affix_devour.png` | Affix | UI Icon | devour | devour 词条图标，可用于敌人详情、词条筛选与战斗提示。 |
| `affix_heavyArmor.png` | Affix | UI Icon | heavyArmor | heavyArmor 词条图标，可用于护甲词条提示、关卡词缀池与试炼说明。 |
| `affix_siege.png` | Affix | UI Icon | siege | siege 词条图标，可用于破阵、推进、推铲或攻城词缀展示。 |
| `affix_shield.png` | Affix | UI Icon | shield | shield 词条图标，可用于护盾状态、词条说明与图鉴标签。 |
| `affix_regen.png` | Affix | UI Icon | regen | regen 词条图标，可用于再生、回复、修复或持续恢复机制提示。 |
| `enemy_ward_deflection_2x1_idle.png` | Ward | 2×1 | deflectionWard | 棱盾兽单位，适合偏折、反射、护盾方向或斜面防御机制。 |
| `enemy_spire_echorelay_1x2_idle.png` | Spire | 1×2 | echoRelay | 共振尖塔单位，适合回声、连锁、信号放大或复触发机制。 |
| `overlay_affix_shield.png` | Overlay | Scalable | shield | 通用护盾覆盖层，边缘化设计，可叠加到不同尺寸敌人主体上。 |
| `overlay_affix_regen.png` | Overlay | Scalable | regen | 通用再生覆盖层，边缘化设计，可叠加到不同尺寸敌人主体上。 |
| `overlay_affix_haste.png` | Overlay | Scalable | haste | 通用急速覆盖层，边缘化设计，可叠加到不同尺寸敌人主体上。 |
| `overlay_affix_healer.png` | Overlay | Scalable | healer | 通用治疗覆盖层，边缘化设计，可叠加到不同尺寸敌人主体上。 |
| `overlay_affix_clone.png` | Overlay | Scalable | clone | 通用克隆覆盖层，边缘化设计，可叠加到不同尺寸敌人主体上。 |
| `overlay_affix_berserk.png` | Overlay | Scalable | berserk | 通用狂暴覆盖层，边缘化设计，可叠加到不同尺寸敌人主体上。 |

## 质量检查摘要

最终检查结果显示：包内共 **20 个 PNG 文件**；所有文件均为 RGBA 透明 PNG；所有资源外接框边距已约束在 10% 安全边距附近；色键残留已做二次清理。`contact_sheet.png` 是带棋盘底的预览图，仅用于快速检查，不属于游戏内资源本体。
