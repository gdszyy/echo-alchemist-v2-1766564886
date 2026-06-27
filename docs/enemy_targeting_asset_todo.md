# 敌人针对词缀美术资产 TODO

状态：第一批边框 Overlay 已生成
更新时间：2026-06-23
关联文档：[`docs/enemy_visual_design_v2.md`](enemy_visual_design_v2.md)、[`docs/enemy_art_implementation_impact.md`](enemy_art_implementation_impact.md)、[`design_spec_bitmap.md`](../design_spec_bitmap.md)

本文主要覆盖已经收束保留的敌人针对词缀：`energyArmor`、`phaseShield`、`overloadReactor`、`lowDamageImmune`、`livingArmor`、`armorSpore`、`siegeBreaker`、`carrier`、`deflectShell`。后续生成 PNG / Sprite Sheet 前，以本文作为资产清单和验收入口。

2026-06-23 追加：符文敌人先作为“奖励/构筑词条”记录资产需求，暂不写入 `enemy_sprite_manifest.json`。规划词条为 `runeBearer`（通用符文掉落，持有一个每回合轮换的临时额外词条）与 `adaptiveRune`（记录最后受到的属性伤害/效果，死亡时掉落该属性家族符文）。正式 PNG / JSON 生成前，只能在本文和视觉规范中标记，不得提前登记到 manifest。
2026-06-23 落地更新：上述“暂不写入 manifest”限制已被首版 SVG 占位资产替代。当前已登记 `affix_rune_bearer.svg`、`affix_adaptive_rune.svg`、`overlay_affix_rune_bearer.svg`、`overlay_affix_adaptive_rune.svg` 与 `overlay_adaptive_rune_<element>.svg`，用于避免运行时 404 并提供可验收的低成本占位。后续正式 PNG / Sprite Sheet 可直接覆盖同名语义文件或新增 composite key，但必须保留 `runeBearer` / `adaptiveRune` 的静态 overlay + `adaptiveRune` 元素态 dynamic overlay 分层。

2026-06-23 更新：正式 PNG / Sprite Sheet 生成前，`src/entities/enemy.js` 已加入 `_drawEnemyTargetingFallback()` 作为代码态兜底层。当前版本已从“中心大图标”改为边框/外缘 fallback：蓄能甲、电容条、相位护盾断窗、过量炉底部刻度、低伤免疫硬壳角标、活体护甲边缘甲片、护甲孢子边缘种荚与飞线、撞城者底部齿、铸巢母架空舱口、偏折壳外缘旋转弧都不应遮住敌人主体。正式资产接入时优先做 frame / collision frame / 边缘 overlay，避免重画或覆盖原本敌人美术。

2026-06-23 追加：新边框美术不需要复刻原本敌人纹理，优先把“机制效果”做出差异化。蓄能甲可以更像侧边电容与充能母线；相位护盾可以用错相双框、断窗与短缺口；过量反应炉用底部炉栅、热刻度和排气齿；低伤免疫用铆接硬壳、厚角钢和抗冲击短刻线；活体护甲用可分档的边缘甲片，叠甲版本明显更厚；护甲孢子用边缘种荚/炼金容器与飞线；撞城者用底部冲齿或破城楔；铸巢母架以“冂”形空舱和舱口导轨为主；偏折壳用旋转反射弧与切向小箭头。验收标准是同屏看 `ev2_enemy_targeting_fallback` 时，九类边框即使套在同一敌人基底上也能一眼分辨。

2026-06-23 落地：第一批透明 PNG 边框 Overlay 已生成到 `assets/sprites/enemies/overlays/`，生成脚本为 `scripts/generate_enemy_targeting_overlays.py`，总览图为 `docs/design/enemy_targeting_overlay_contact_sheet.png`。静态 Overlay 已登记：`lowDamageImmune`、`armorSpore`、`siegeBreaker`、`carrier`、`deflectShell`；状态型 Overlay 已登记：`energyArmor charged/empty`、`phaseShield active/disabled`、`livingArmor normal/stack × high/mid/low`、`overloadReactor level1/2/3`。运行时正式 PNG 命中后，`_drawEnemyTargetingFallback()` 只保留缺失兜底，避免 PNG 与 Canvas 线稿重复叠加。

2026-06-23 返工：上一版边框过于工程线稿化，已重写生成器并重新导出为材质化 Overlay。新版本直接从现有 `frame_residue_1x1.png`、`frame_deflector_2x1.png`、`frame_siege_3x2.png`、`frame_bastion_3x1.png` 与 `enemy_residue_1x1_native_hollow_idle.png` 的非透明区域抽取材质，再裁切到各词条边框遮罩里。暗色磨石/金属块体、切削倒角、磨损颗粒、细裂纹和嵌槽是主体，黄/蓝/绿/橙机制色只作为局部晶脉、能量膜、炉栅或导轨。后续继续迭代时，禁止回退到纯线条、纯 UI 图标、纯发光环或无材质的几何符号。

2026-06-23 尺寸适配：targeting overlay 已从单一 1x1 扩展为 footprint-aware 资产族。`assets/sprites/enemies/overlays/` 中每个正式 PNG 均保留 1x1 基准文件，并派生 `_2x1`、`_1x2`、`_2x2`、`_3x1`、`_1x3`、`_2x3`、`_3x2`、`_3x3` 版本；生成器使用九宫格边框扩展，避免把角件、边缘材料和护盾断窗直接拉伸。运行时由 `src/data/enemy_visual_assets.js` 按 `gridCols x gridRows` 自动选择对应文件，静态词条 overlay 与 `energyArmor`、`phaseShield`、`livingArmor`、`overloadReactor` 等动态状态 overlay 均适用。总览图见 `docs/design/enemy_targeting_overlay_footprints_contact_sheet.png`；验收时必须在 2x1、1x2、3x1、2x3、3x2、3x3 敌人上确认边框覆盖真实 footprint，而不是只套 128x128 中心框。

2026-06-23 试炼场落地：`enemy_v2` 分类新增 `ev2_enemy_targeting_footprints`，用于正式 PNG 多尺寸验收。该场景冻结展示 `overloadReactor 3x3`、`phaseShield 1x2`、`energyArmor 2x1`、`lowDamageImmune 3x1`、`livingArmor 2x3`、`carrier 3x2` 与 `siegeBreaker 3x1`，应作为 contact sheet 之外的实机场景检查入口。

2026-06-24 更新：`shield` 与 `radiantAegis` 已补入 footprint-aware PNG overlay 资产族。生成器会导出 `overlay_affix_shield.png`、`overlay_affix_radiantAegis.png` 以及 `_2x1` / `_1x2` / `_2x2` / `_3x1` / `_1x3` / `_2x3` / `_3x2` / `_3x3` 变体；运行时 `radiantAegis` 从 SVG 常驻兜底切到 PNG overlay，Boss 通过 `gridCols=3`、`gridRows=2` 命中 3x2 版本。词条 UI icon 同步补齐：战斗状态条敌方护盾数值使用 `affix_shield.png`，`radiantAegis` 登记为正式 `affix_radiantAegis.png`。
2026-06-24 追补：局内敌人本体的护盾数值展示已改为血量旁常驻 icon badge：`shield` 显示 `affix_shield.png + 层数`，`radiantAegis` 显示 `affix_radiantAegis.png + 百分比`。受击时的浮字/描边反馈只表达瞬时命中，不再承担常驻数值 UI。
2026-06-24 追补：`carrier` 铸巢母架正式运行时美术已生成，不再使用 PH 占位图。源图由 imagegen 按几何磨石/炼金晶核风格生成并保存在 `docs/design/concepts/carrier_imagegen_pass1/`，`scripts/generate_carrier_enemy_assets.py` 只负责绿幕去底、运行时缩放、空舱透明校验与派生图标/碰撞框。已覆盖 `assets/sprites/enemies/v2/enemy_carrier_3x2.png`、`assets/sprites/enemies/archetypes/enemy_carrier_3x2.png`、`assets/sprites/enemies/composites/enemy_carrier_carrier_3x2_idle.png`、`assets/sprites/enemies/frames/frame_carrier_3x2.png`、图鉴头像、基底 UI 图标与 `affix_carrier.png`；manifest 与 `ENEMY_V2_METADATA` 均已改为 `placeholder:false`。验收预览见 `docs/design/enemy_carrier_asset_preview.png`。
2026-06-25 追补：敌人行动/针对词条 UI icon 补齐并正式登记，覆盖 `berserk`、`haste`、`healer`、`clone`、`jump`、`lowDamageImmune`、`deflectShell`、`armorSpore`、`siegeBreaker`、`overloadReactor`。这些 PNG 已接入 `ENEMY_AFFIX_ICON_MAP`、manifest、图鉴、试炼场词缀 chip、敌人信息抽屉与行动预告面板；后续替换正式重绘图时保持同名路径或同步映射即可。
2026-06-25 返工：上述 UI icon 已按当前敌人美术风格降饱和重导出。后续生成同类图标时，底盘优先使用黑曜石/暗金/磨损金属，机制色只作为小面积核心线、晶脉、刻度或边缘提示，避免整张高饱和发光。

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

### P0：符文敌人资产标记（待生成，不登记 manifest）

| 资产 | 目标路径 | 用途 | 验收 |
|---|---|---|---|
| 通用符文掉落图标 | `assets/ui/icons/enemy_affixes/affix_rune_bearer.svg` | 图鉴、状态面板、试炼场卡片 | 首版 SVG 占位已落地；正式版需保持嵌入式紫金符文槽，表达“击杀给通用符文”。 |
| 自适应符文图标 | `assets/ui/icons/enemy_affixes/affix_adaptive_rune.svg` | 图鉴、状态面板、试炼场卡片 | 首版 SVG 占位已落地；正式版需保持中心可变色符文核心与外圈切换刻度。 |
| 通用符文常驻 Overlay | `assets/sprites/enemies/overlays/overlay_affix_rune_bearer.svg` | 运行时常驻词条层 | 首版 SVG 占位已落地；正式版保持内嵌符文槽 + 细小轮换刻痕，不能遮住主体、HP 或既有词条。 |
| 自适应符文动态 Overlay | `assets/sprites/enemies/overlays/overlay_adaptive_rune_<element>.svg` | 按 `adaptiveRuneElement` 叠加元素特效 | 首版 SVG 占位已覆盖 `pyro`、`cryo`、`lightning`、`bounce`、`pierce`、`scatter`、`laser`、`venom`、`overcharge`、`echo`、`unknown`；正式版每个属性只改变核心色、纹路和短边缘特效，不重画敌人主体。 |
| 临时词条轮换 VFX | `assets/sprites/enemies/vfx/vfx_rune_bearer_roll_0~3.png` | `runeBearer` 每回合切换临时词条 | 表现为小型符文槽旋转或卡榫拨动，不新增大面积粒子。 |
| 自适应切换 VFX | `assets/sprites/enemies/vfx/vfx_adaptive_rune_shift_<element>_0~3.png` | `adaptiveRune` 记录新属性时 | 只在属性改变瞬间播放短闪；low 档可退化为纯色描边和短标签。 |
| 符文死亡掉落框 | `assets/sprites/enemies/vfx/vfx_rune_drop_mark_0~3.png` | 死亡时提示“将掉符文” | 与场内 `RuneLoot` 区分：这是敌人身上的死亡前提示，不是掉落实体本身。 |

### P1：符文敌人高频组合 Sprite（可选）

| assetKey | 建议文件 | 说明 |
|---|---|---|
| `residue:1x1:runeBearer` | `assets/sprites/enemies/composites/enemy_residue_runebearer_1x1_idle.png` + `.json` | 首批通用符文敌人；保留单格磨石主体，符文槽嵌在核心旁。 |
| `residue:1x1:adaptiveRune` | `assets/sprites/enemies/composites/enemy_residue_adaptiverune_1x1_idle.png` + `.json` | 首批自适应符文敌人；基础态为无属性紫白核心，属性态走动态 Overlay。 |
| `bastion:3x1:runeBearer` | `assets/sprites/enemies/composites/enemy_bastion_runebearer_3x1_idle.png` + `.json` | 只在后续确认大型符文敌人可读后制作；符文槽沿 3 格横梁分段排布。 |
| `deflector:2x1:adaptiveRune` | `assets/sprites/enemies/composites/enemy_deflector_adaptiverune_2x1_idle.png` + `.json` | 可作为属性教学变体；自适应元素不要覆盖偏折屏障的青蓝前缘。 |

### P0：直接影响机制读法

| 资产 | 目标路径 | 用途 | 验收 |
|---|---|---|---|
| 铸巢母架本体 Sprite Sheet | `assets/sprites/enemies/v2/enemy_carrier_3x2.png` + `.json` | 图鉴、V2 基底、运行时主体 | 已落地；imagegen 绘制主体，3×2 “冂”形留出第 5 格空舱，主体符合几何磨石/晶石灾害背景。 |
| 铸巢母架 archetype Sprite | `assets/sprites/enemies/archetypes/enemy_carrier_3x2.png` + `.json` | manifest 基底回退 | 已落地；与 V2 本体同 silhouette，不额外填满空舱。 |
| 铸巢母架 collision frame | `assets/sprites/enemies/frames/frame_carrier_3x2.png` | 表达真实凹陷物理边界 | 已落地；只描 1/2/3/4/6 占格外壳，第 5 格透明，不画成完整 3×2 实心框。 |
| 铸巢母架头像 | `assets/icons/enemies/enemy_carrier_3x2.png` | 图鉴/试炼场小图 | 已落地；64×64 仍能看出“冂”形空舱。 |
| ~~低伤免疫图标~~ | `assets/ui/icons/enemy_affixes/affix_lowDamageImmune.png` | ✅ 已生成并接入图鉴/状态面板/行动预告映射 | 金属硬壳符号，和普通 shield 图标明显不同。 |
| ~~偏折壳图标~~ | `assets/ui/icons/enemy_affixes/affix_deflectShell.png` | ✅ 已生成并接入图鉴/状态面板/行动预告映射 | 旋转硬壳/偏折边界，表现“反弹方向改变”。 |
| 活体护甲三档 Overlay | 见 §3 | 运行时护甲层状态 | 普通三档与叠加强化三档必须一眼可分。 |

### P1：补齐常驻词条与触发读法

| 资产 | 目标路径 | 用途 | 验收 |
|---|---|---|---|
| 蓄能甲图标 | `assets/ui/icons/enemy_affixes/affix_energyArmor.png` | 图鉴与状态面板 | 电容/蓄能槽，不做元素克制色。 |
| 相位护盾图标 | `assets/ui/icons/enemy_affixes/affix_phaseShield.png` | 图鉴与状态面板 | 双层护盾 + 失效窗口语义。 |
| ~~过量反应炉图标~~ | `assets/ui/icons/enemy_affixes/affix_overloadReactor.png` | ✅ 已生成并接入图鉴/状态面板/行动预告映射 | 炉心刻度/计数，不像普通狂暴。 |
| 活体护甲图标 | `assets/ui/icons/enemy_affixes/affix_livingArmor.png` | 图鉴与状态面板 | 护甲层/再生层，不做恶心有机物。 |
| ~~护甲孢子图标~~ | `assets/ui/icons/enemy_affixes/affix_armorSpore.png` | ✅ 已生成并接入图鉴/状态面板/行动预告映射 | 种荚/孢囊/炼金容器，避免虫卵感。 |
| ~~撞城者图标~~ | `assets/ui/icons/enemy_affixes/affix_siegeBreaker.png` | ✅ 已生成并接入图鉴/状态面板/行动预告映射 | 装饰撞角或加固件。 |
| 铸巢母架词条图标 | `assets/ui/icons/enemy_affixes/affix_carrier.png` | 图鉴与状态面板 | 已落地；空舱/巢架符号，不画军舰。 |

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
| 蓄能甲状态 | `overlay_energy_armor_charged.png` / `empty.png` | `energyArmorShield > 0` | 已登记到 `dynamicOverlays.energyArmor.charged/empty`。 |
| 活体护甲普通三档 | `overlay_living_armor_high.png` / `mid.png` / `low.png` | `livingArmorHp / livingArmorMax > 50%`、`<=50%`、`<=20%` | 已登记到 `dynamicOverlays.livingArmor.normal_high/mid/low`。 |
| 活体护甲叠加强化三档 | `overlay_living_armor_stack_high.png` / `mid.png` / `low.png` | `livingArmorStacked === true` | 已登记到 `dynamicOverlays.livingArmor.stack_high/mid/low`。 |
| 相位护盾状态 | `overlay_phase_shield_active.png` / `disabled.png` | `phaseShieldDisabledThisTurn` | 已登记到 `dynamicOverlays.phaseShield.active/disabled`。 |
| 过量反应炉计数态 | `overlay_overload_reactor_1.png` / `2.png` / `3.png` | `_overloadBonusThisTurn` | 已登记到 `dynamicOverlays.overloadReactor.level1/level2/level3`。 |

## 4. 事件特效资产

下列资产可以先由 Canvas 反馈兜底；若做位图，建议放在 `assets/sprites/enemies/vfx/`，不要混入常驻 Overlay。

| 事件 | 建议资产 | 说明 |
|---|---|---|
| 护甲孢子分派 | `vfx_armor_spore_trail_0~3.png` | 现有 Canvas fallback 会在目标上记录 `_armorSporeTrailTimer` 与来源坐标，绘制从分派者孢囊飞向目标的轻量飞线；位图版本应保持清爽，不做黏液。 |
| 活体护甲反弹代承 | `vfx_living_armor_block_0~3.png` | 护甲层短闪，伤害不进本体。 |
| 活体护甲穿透双层命中 | `vfx_living_armor_pierce_0~3.png` | 护甲与本体同时受击，必须明确是双层反馈。 |
| 低伤免疫 | 可继续使用浮字“过低” | 现有 `overlay_affix_lowDamageImmune.png` 已画金属硬壳；不需要单独复杂触发特效。 |
| 偏折壳反弹偏折 | `vfx_deflect_shell_turn_0~3.png` | 现有 fallback 只在 1×1 敌人上画旋转壳；位图事件表示反弹法线被旋转，不应用于非反弹命中。 |
| 铸巢母架推出 | 可继续使用浮字“推出” | 后续可补短推力线，但不是 P0。 |

## 5. Manifest 登记规则

1. PNG 和同名 JSON 真实存在前，不把 composite 写入 `assets/sprites/enemies/enemy_sprite_manifest.json`，避免试炼场误判为已命中 Composite Sprite。
2. 词条图标真实存在前，不登记到 `affixIcons`；否则图鉴可能显示破图。
3. 静态 Overlay 真实存在且不需要状态切换时，才登记到 `overlays`。
4. 状态型 Overlay 走 `dynamicOverlays`，不要混入静态 `overlays`。
5. 铸巢母架生成后，应同步更新内嵌默认 manifest：`src/data/enemy_visual_assets.js` 的 `_DEFAULT_COMPOSITES`、`_DEFAULT_ARCHETYPE_FILES`、`_DEFAULT_ARCHETYPE_ICONS`、`_DEFAULT_AFFIX_ICONS`、`_DEFAULT_FRAMES`。
6. `runeBearer` 与 `adaptiveRune` 首版机制和 SVG 占位已接入；后续替换正式 PNG/SVG 时必须同步 `affixIcons`、`overlays` / `dynamicOverlays`、试炼场场景、敌人词缀索引和符文掉落机制验证。

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
