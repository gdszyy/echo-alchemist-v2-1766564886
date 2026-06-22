# 敌人针对词缀美术资产 TODO

状态：生成前契约
更新时间：2026-06-23
关联文档：[`docs/enemy_visual_design_v2.md`](enemy_visual_design_v2.md)、[`docs/enemy_art_implementation_impact.md`](enemy_art_implementation_impact.md)、[`design_spec_bitmap.md`](../design_spec_bitmap.md)

本文只覆盖已经收束保留的敌人针对词缀：`energyArmor`、`phaseShield`、`overloadReactor`、`lowDamageImmune`、`livingArmor`、`armorSpore`、`siegeBreaker`、`carrier`、`deflectShell`。后续生成 PNG / Sprite Sheet 前，以本文作为资产清单和验收入口。

2026-06-23 更新：正式 PNG / Sprite Sheet 生成前，`src/entities/enemy.js` 已加入 `_drawEnemyTargetingFallback()` 作为代码态兜底层。当前版本已从“中心大图标”改为边框/外缘 fallback：蓄能甲、电容条、相位护盾断窗、过量炉底部刻度、低伤免疫硬壳角标、活体护甲边缘甲片、护甲孢子边缘种荚与飞线、撞城者底部齿、铸巢母架空舱口、偏折壳外缘旋转弧都不应遮住敌人主体。正式资产接入时优先做 frame / collision frame / 边缘 overlay，避免重画或覆盖原本敌人美术。

## 1. 已定设计决策

| 主题 | 决策 |
|---|---|
| 命名 | `carrier` 显示名固定为“铸巢母架”，不做真实军舰。 |
| 铸巢母架占格 | 3×2 “冂”形，1/2/3/4/6 为占格，第 5 格为空舱；空舱也是物理凹陷，允许子弹穿过。 |
| 铸巢母架投放 | 空舱被占时先推出旧单位；推不出去则跳过本次投放；新小怪生成当回合立即移动。 |
| 活体护甲 | 三档状态：`>50%`、`<50%`、`<20%`；叠加强化后需要另一套三档更厚版本。 |
| 活体护甲恢复 | 破裂后自身不再自动恢复，但可被后续护甲孢子重新挂甲。 |
| 护甲孢子 | 分派者有孢囊/种荚，但必须偏植物、矿物、炼金容器感，避免生理不适。 |
| 偏折壳 | 仅 1×1 敌人可带；只影响反弹/弹跳法线，不影响穿透、激光或普通直击。 |
| 撞城者 | 只需要装饰性加固件；屏障受击沿用现有防线反馈。 |

## 2. 资产优先级

### P0：直接影响机制读法

| 资产 | 目标路径 | 用途 | 验收 |
|---|---|---|---|
| 铸巢母架本体 Sprite Sheet | `assets/sprites/enemies/v2/enemy_carrier_3x2.png` + `.json` | 图鉴、V2 基底、运行时主体 | 3×2 “冂”形必须留出第 5 格空舱；主体符合几何磨石/晶石灾害背景。 |
| 铸巢母架 archetype Sprite | `assets/sprites/enemies/archetypes/enemy_carrier_3x2.png` + `.json` | manifest 基底回退 | 与 V2 本体同 silhouette，不额外填满空舱。 |
| 铸巢母架 collision frame | `assets/sprites/enemies/frames/frame_carrier_3x2.png` | 表达真实凹陷物理边界 | 只描 1/2/3/4/6 占格外壳，第 5 格透明；不能画成完整 3×2 实心框。 |
| 铸巢母架头像 | `assets/icons/enemies/enemy_carrier_3x2.png` | 图鉴/试炼场小图 | 64×64 仍能看出“冂”形空舱。 |
| 低伤免疫图标 | `assets/ui/icons/enemy_affixes/affix_lowDamageImmune.png` | 图鉴与状态面板 | 金属硬壳符号，和普通 shield 图标明显不同。 |
| 偏折壳图标 | `assets/ui/icons/enemy_affixes/affix_deflectShell.png` | 图鉴与状态面板 | 旋转硬壳/偏折边界，表现“反弹方向改变”。 |
| 活体护甲三档 Overlay | 见 §3 | 运行时护甲层状态 | 普通三档与叠加强化三档必须一眼可分。 |

### P1：补齐常驻词条与触发读法

| 资产 | 目标路径 | 用途 | 验收 |
|---|---|---|---|
| 蓄能甲图标 | `assets/ui/icons/enemy_affixes/affix_energyArmor.png` | 图鉴与状态面板 | 电容/蓄能槽，不做元素克制色。 |
| 相位护盾图标 | `assets/ui/icons/enemy_affixes/affix_phaseShield.png` | 图鉴与状态面板 | 双层护盾 + 失效窗口语义。 |
| 过量反应炉图标 | `assets/ui/icons/enemy_affixes/affix_overloadReactor.png` | 图鉴与状态面板 | 炉心刻度/计数，不像普通狂暴。 |
| 活体护甲图标 | `assets/ui/icons/enemy_affixes/affix_livingArmor.png` | 图鉴与状态面板 | 护甲层/再生层，不做恶心有机物。 |
| 护甲孢子图标 | `assets/ui/icons/enemy_affixes/affix_armorSpore.png` | 图鉴与状态面板 | 种荚/孢囊/炼金容器，避免虫卵感。 |
| 撞城者图标 | `assets/ui/icons/enemy_affixes/affix_siegeBreaker.png` | 图鉴与状态面板 | 装饰撞角或加固件。 |
| 铸巢母架词条图标 | `assets/ui/icons/enemy_affixes/affix_carrier.png` | 图鉴与状态面板 | 空舱/巢架符号，不画军舰。 |

### P2：高频组合 Sprite

这些组合不必一次性全做，但首批建议覆盖最容易影响读法的 1×1 敌人：

| assetKey | 建议文件 | 说明 |
|---|---|---|
| `residue:1x1:lowDamageImmune` | `assets/sprites/enemies/composites/enemy_residue_lowdamageimmune_1x1_idle.png` + `.json` | 金属硬壳类视觉，触发显示“过低”。 |
| `residue:1x1:deflectShell` | `assets/sprites/enemies/composites/enemy_residue_deflectshell_1x1_idle.png` + `.json` | 只有 1×1 可带，旋转边界要作为核心特征。 |
| `residue:1x1:overloadReactor` | `assets/sprites/enemies/composites/enemy_residue_overloadreactor_1x1_idle.png` + `.json` | 炉心计数与过热预警必须清楚。 |
| `residue:1x1:energyArmor` | `assets/sprites/enemies/composites/enemy_residue_energyarmor_1x1_idle.png` + `.json` | 蓄能槽/电容甲片。 |
| `residue:1x1:phaseShield` | `assets/sprites/enemies/composites/enemy_residue_phaseshield_1x1_idle.png` + `.json` | 双层护盾与错相结构。 |
| `carrier:3x2:carrier` | `assets/sprites/enemies/composites/enemy_carrier_carrier_3x2_idle.png` + `.json` | 精确组合命中；第 5 格空舱必须透明。 |

## 3. 状态型 Overlay 规格

现有 manifest 的 `overlays` 段按词条 ID 静态解析；状态型资产走 `dynamicOverlays` 段，由 `resolveDynamicEnemyOverlayPaths(enemy)` 按敌人当前状态选择。PNG 真实存在前仍不要登记。

| 资产组 | 建议命名 | 触发条件 | 代码前置 TODO |
|---|---|---|---|
| 活体护甲普通三档 | `overlay_living_armor_high.png` / `mid.png` / `low.png` | `livingArmorHp / livingArmorMax > 50%`、`<=50%`、`<=20%` | 已有动态解析入口；登记到 `dynamicOverlays.livingArmor.normal_high/mid/low`。 |
| 活体护甲叠加强化三档 | `overlay_living_armor_stack_high.png` / `mid.png` / `low.png` | `livingArmorStacked === true` | 已持久化 `livingArmorBaseMax` / `livingArmorStacked`；登记到 `dynamicOverlays.livingArmor.stack_high/mid/low`。 |
| 相位护盾失效态 | `overlay_phase_shield_active.png` / `disabled.png` | `phaseShieldDisabledThisTurn` | 登记到 `dynamicOverlays.phaseShield.active/disabled`。 |
| 过量反应炉计数态 | `overlay_overload_reactor_1.png` / `2.png` / `3.png` | `_overloadBonusThisTurn` | 登记到 `dynamicOverlays.overloadReactor.level1/level2/level3`。 |

## 4. 事件特效资产

下列资产可以先由 Canvas 反馈兜底；若做位图，建议放在 `assets/sprites/enemies/vfx/`，不要混入常驻 Overlay。

| 事件 | 建议资产 | 说明 |
|---|---|---|
| 护甲孢子分派 | `vfx_armor_spore_trail_0~3.png` | 现有 Canvas fallback 会在目标上记录 `_armorSporeTrailTimer` 与来源坐标，绘制从分派者孢囊飞向目标的轻量飞线；位图版本应保持清爽，不做黏液。 |
| 活体护甲反弹代承 | `vfx_living_armor_block_0~3.png` | 护甲层短闪，伤害不进本体。 |
| 活体护甲穿透双层命中 | `vfx_living_armor_pierce_0~3.png` | 护甲与本体同时受击，必须明确是双层反馈。 |
| 低伤免疫 | 可继续使用浮字“过低” | 现有 fallback 已画金属硬壳；不需要单独复杂触发特效。 |
| 偏折壳反弹偏折 | `vfx_deflect_shell_turn_0~3.png` | 现有 fallback 只在 1×1 敌人上画旋转壳；位图事件表示反弹法线被旋转，不应用于非反弹命中。 |
| 铸巢母架推出 | 可继续使用浮字“推出” | 后续可补短推力线，但不是 P0。 |

## 5. Manifest 登记规则

1. PNG 和同名 JSON 真实存在前，不把 composite 写入 `assets/sprites/enemies/enemy_sprite_manifest.json`，避免试炼场误判为已命中 Composite Sprite。
2. 词条图标真实存在前，不登记到 `affixIcons`；否则图鉴可能显示破图。
3. 静态 Overlay 真实存在且不需要状态切换时，才登记到 `overlays`。
4. 状态型 Overlay 走 `dynamicOverlays`，不要混入静态 `overlays`。
5. 铸巢母架生成后，应同步更新内嵌默认 manifest：`src/data/enemy_visual_assets.js` 的 `_DEFAULT_COMPOSITES`、`_DEFAULT_ARCHETYPE_FILES`、`_DEFAULT_ARCHETYPE_ICONS`、`_DEFAULT_AFFIX_ICONS`、`_DEFAULT_FRAMES`。

## 6. 验收清单

- `node tests/validate_enemy_spawn_runtime.mjs` 继续覆盖铸巢母架空舱、推出、推不出去跳过、立即移动。
- `node tests/validate_phase_contracts.mjs` 继续覆盖敌人针对词缀 Canvas fallback、护甲孢子飞线状态、铸巢母架空舱绘制与偏折壳 1×1 限制。
- 试炼场 `enemy_v2` 分类的 `ev2_enemy_targeting_fallback` 场景用于生成前人工验收：一次性查看九个保留词缀、活甲/叠甲三档、护甲孢子飞线与铸巢母架第 5 格空舱。
- 新增 PNG 后运行图鉴/试炼场，`describeAssetHitStatus()` 不得把缺失资源显示为已命中。
- 铸巢母架第 5 格空舱在 Sprite、collision frame、图鉴头像中都必须可见。
- 活体护甲三档资产在 128px 缩放下仍能分辨 `>50%`、`<50%`、`<20%`。
- 叠加强化三档必须比普通三档更厚、更稳，不只是换色。
- 护甲孢子分派者孢囊不得走黏液、腐败、虫卵、生理不适方向。
- 低伤免疫触发只显示“过低”，避免长机制名遮挡战场。
- 偏折壳只在反弹/弹跳受影响时播放偏折反馈。
