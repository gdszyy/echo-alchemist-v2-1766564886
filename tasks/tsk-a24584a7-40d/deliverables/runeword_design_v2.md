# Echo Alchemist 符文词条系统扩展正式设计文档 (v2.0)

> **文档说明**：本文档基于 `src/rune_config.js` 中现有的 14 个符文（`RUNE_DB`）、10 个词条（`RUNEWORD_DB`）和克制关系字典（`COUNTER_MAP`），以及 `docs/boss_system_design.md` 中 8 个 Boss 的弱点设计，提供完整的符文词条扩展方案。
>
> **设计约束**：所有词条的 `pattern` 仅使用 `RUNE_DB` 中存在的 14 个符文 ID；`stats` 键仅使用 `pyro / cryo / lightning / bounce / pierce / scatter / laser / damage`；`effect_desc` 完全基于现有机制，不引入新机制。

---

## 1. 现有词条审查

基于最新的数值平衡约束（双符文：单属性 1~3，damage 2~5；三符文：单属性 2~5，damage 5~10），对现有 10 个词条进行逐一审查。

| 词条 ID | 词条名称 | Pattern | 原始 Stats | 审查结论 | 调整理由与新 Stats |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `runeword_inferno` | 烈焰之语 | `rune_pyro_1` + `rune_pyro_2` | `pyro:3, damage:5` | **保留** | 数值符合双符文标准，机制清晰，双火共鸣定位明确。 |
| `runeword_blazing_pierce` | 炎刃之语 | `rune_pyro_1` + `rune_pierce_1` | `pyro:2, pierce:1` | **调整** | 缺乏基础伤害补足，双符文词条应有 damage 加成。新 Stats：`pyro:2, pierce:1, damage:2`。 |
| `runeword_glacial` | 冰封之语 | `rune_cryo_1` + `rune_cryo_2` | `cryo:3, damage:3` | **保留** | 数值符合双符文标准，控制与伤害兼顾，冰系核心词条。 |
| `runeword_frozen_bounce` | 冰弹之语 | `rune_cryo_1` + `rune_bounce_1` | `cryo:2, bounce:1` | **调整** | 缺乏基础伤害补足。新 Stats：`cryo:2, bounce:1, damage:2`。 |
| `runeword_thunderstorm` | 雷暴之语 | `rune_lightning_1` + `rune_lightning_2` | `lightning:3, scatter:1` | **保留** | 数值合理，符合雷电的群攻定位，双雷共鸣效果突出。 |
| `runeword_chain_scatter` | 雷散之语 | `rune_lightning_1` + `rune_scatter_1` | `lightning:2, scatter:2` | **调整** | 缺乏基础伤害补足。新 Stats：`lightning:2, scatter:2, damage:2`。 |
| `runeword_echo_bounce` | 回响之语 | `rune_bounce_1` + `rune_bounce_2` | `bounce:4, damage:2` | **调整** | `bounce:4` 超出双符文单属性上限（1~3）。新 Stats：`bounce:3, damage:3`。 |
| `runeword_laser_focus` | 聚光之语 | `rune_laser_1` + `rune_laser_2` | `laser:3, pierce:1` | **保留** | 数值合理，符合激光高穿透特性，双激光共鸣定位清晰。 |
| `runeword_elemental_surge` | 元素涌动之语 | `rune_pyro_1` + `rune_cryo_1` + `rune_lightning_1` | `pyro:1, cryo:1, lightning:1, damage:8` | **调整** | 三符文词条单属性加成（1）低于下限（2~5）。新 Stats：`pyro:2, cryo:2, lightning:2, damage:8`。 |
| `runeword_piercing_storm` | 穿刺风暴之语 | `rune_pierce_1` + `rune_pierce_2` + `rune_scatter_1` | `pierce:2, scatter:3, damage:4` | **调整** | 三符文词条 damage（4）低于下限（5~10）。新 Stats：`pierce:2, scatter:3, damage:6`。 |

**审查小结**：现有词条中，4 个保留、6 个调整。主要问题集中于：①部分双符文词条缺少 `damage` 加成；②`runeword_echo_bounce` 的 `bounce:4` 超出双符文上限；③`runeword_elemental_surge` 的三属性加成过低。

---

## 2. 新增词条设计（15 个）

新增词条覆盖四大方向：**同系三符文高阶词条**（奖励专精）、**跨系复合词条**（利用 COUNTER_MAP 克制关系）、**Boss 特化词条**（针对 8 个 Boss 的明确弱点）、**终极四符文词条**（大后期追求目标）。

### 2.1 同系高阶共鸣（三符文纯色套路，奖励专精玩家）

此类词条要求玩家在网格中放置三个同系符文，数值奖励丰厚，适合深度专精某一属性的构建。

| 词条 ID | 词条名称 | Pattern | Stats | 效果描述 |
| :--- | :--- | :--- | :--- | :--- |
| `runeword_super_inferno` | 极炎之语 | `rune_pyro_1`, `rune_pyro_2`, `rune_pyro_1` | `{ pyro: 5, damage: 8 }` | 三火共鸣，灼烧持续伤害大幅提升，护盾熔化效率极高。专克"熔炉守卫·伊格尼斯"的超载护盾与极速机制。 |
| `runeword_absolute_zero` | 绝对零度之语 | `rune_cryo_1`, `rune_cryo_2`, `rune_cryo_1` | `{ cryo: 5, damage: 6 }` | 三冰共鸣，减速效果推向极致，使敌人迅速陷入冻结状态。完美克制"霜晶缝合怪·格拉西斯"的跳跃与再生机制。 |
| `runeword_infinite_echo` | 无尽回响之语 | `rune_bounce_1`, `rune_bounce_2`, `rune_bounce_1` | `{ bounce: 5, damage: 7 }` | 三弹射共鸣，弹跳次数达到极限，在密集的敌人或分身之间形成不可阻挡的弹幕网，多目标覆盖能力极强。 |

### 2.2 跨系复合词条（利用 COUNTER_MAP 克制关系）

此类词条结合两种相互协同的属性，利用 `COUNTER_MAP` 中的克制关系，针对特定敌人词缀形成双重压制。

| 词条 ID | 词条名称 | Pattern | Stats | 效果描述 | 克制关系 |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `runeword_frost_scatter` | 霜散之语 | `rune_cryo_1`, `rune_scatter_1` | `{ cryo: 2, scatter: 2, damage: 2 }` | 冰霜与散射结合，散射弹幕附带减速效果，大范围覆盖并减缓敌人行动。 | cryo 克制 haste；scatter 克制 clone |
| `runeword_lightning_bounce` | 雷弹之语 | `rune_lightning_1`, `rune_bounce_1` | `{ lightning: 2, bounce: 2, damage: 2 }` | 闪电附着于弹射弹丸，每次弹跳触发闪电链跳跃，对集群敌人造成连锁伤害并中断治疗。 | lightning 克制 clone/healer；bounce 克制 clone |
| `runeword_magma_laser` | 熔岩激光之语 | `rune_pyro_2`, `rune_laser_1` | `{ pyro: 3, laser: 2, damage: 3 }` | 炎核与光束融合，持续的高频灼烧伤害彻底压制敌人的再生与治疗能力，护盾熔化叠加激光精准高伤。 | pyro 克制 regen/shield；laser 克制 regen |

### 2.3 Boss 特化词条（针对 8 个 Boss 的明确弱点）

此类词条专为应对特定 Boss 而设计，结合 Boss 的核心机制与 `COUNTER_MAP` 的克制关系，提供针对性的强力加成。

| 词条 ID | 词条名称 | Pattern | Stats | 效果描述 | 针对 Boss |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `runeword_shield_breaker` | 破法者之语 | `rune_pyro_1`, `rune_pierce_2` | `{ pyro: 2, pierce: 3, damage: 4 }` | 火焰与破甲的结合，穿透护盾的同时施加灼烧，直接无视护盾造成伤害并持续灼烧削减。 | 熔炉守卫·伊格尼斯（shield+haste）；贪婪之渊·噬神者（devour+shield） |
| `runeword_frost_pierce` | 凛冬穿刺之语 | `rune_cryo_2`, `rune_pierce_1` | `{ cryo: 2, pierce: 2, damage: 3 }` | 冰晶附着于穿刺之上，穿透敌人的同时留下减速效果，有效限制跳跃敌人的落点与移动轨迹。 | 霜晶缝合怪·格拉西斯（jump+regen）；混沌融合体·奇美拉（berserk+devour） |
| `runeword_haste_hunter` | 猎杀者之语 | `rune_cryo_2`, `rune_laser_2` | `{ cryo: 2, laser: 3, damage: 3 }` | 冰晶与聚焦激光融合，持续的精准光束附带极强的减速效果，专克高机动性目标，使其无法逃脱。 | 雷霆幻影·特斯拉（haste+clone）；翠绿共生体·维里迪斯（regen+healer） |
| `runeword_clone_destroyer` | 灭群之语 | `rune_lightning_2`, `rune_bounce_2` | `{ lightning: 3, bounce: 2, damage: 4 }` | 电弧与回响的结合，闪电链在弹跳过程中不断跳跃，瞬间清空全场分身并中断治疗，对集群目标伤害极高。 | 裂变母体·米克罗（clone+healer）；雷霆幻影·特斯拉（haste+clone） |
| `runeword_life_bane` | 枯萎之语 | `rune_pyro_2`, `rune_laser_1` | `{ pyro: 3, laser: 2, damage: 3 }` | 炎核与光束融合，灼烧持续伤害与激光高频输出叠加，彻底压制敌人的再生与治疗能力，使其无法恢复。 | 翠绿共生体·维里迪斯（regen+healer）；霜晶缝合怪·格拉西斯（regen） |
| `runeword_lightning_scatter` | 雷暴散射之语 | `rune_lightning_2`, `rune_scatter_1` | `{ lightning: 3, scatter: 2, damage: 4 }` | 电弧与散裂结合，大范围的散射弹幕附带闪电链，能够瞬间打断多个治疗者的施法并清场分身群体。 | 裂变母体·米克罗（clone+healer）；翠绿共生体·维里迪斯（healer） |

### 2.4 终极复合套路（四符文，大后期追求目标）

四符文词条需要玩家在 3x3 网格中精心排列四个符文才能激活，作为后期的终极追求目标。数值约束：单属性 3~6，damage 8~15。

| 词条 ID | 词条名称 | Pattern | Stats | 效果描述 |
| :--- | :--- | :--- | :--- | :--- |
| `runeword_chaos_storm` | 混沌风暴之语 | `rune_pyro_2`, `rune_cryo_2`, `rune_lightning_2`, `rune_scatter_1` | `{ pyro: 3, cryo: 3, lightning: 3, scatter: 4, damage: 12 }` | 史诗与传说符文的终极融合。散射弹幕同时附带灼烧、减速与闪电链跳跃，造成毁灭性的混合元素打击，应对"永恒回声"的全词缀轮转。 |
| `runeword_infinite_refraction` | 无限折射之语 | `rune_laser_2`, `rune_bounce_2`, `rune_pierce_2`, `rune_laser_1` | `{ laser: 5, bounce: 4, pierce: 3, damage: 14 }` | 激光、弹射与穿透的奇迹结合。光束在穿透敌人后发生多次折射弹跳，形成覆盖全场的致命光网，持续切割战场上的所有目标。 |
| `runeword_abyssal_gaze` | 深渊凝视之语 | `rune_pyro_2`, `rune_pierce_2`, `rune_laser_2`, `rune_bounce_2` | `{ pyro: 4, pierce: 4, laser: 4, damage: 15 }` | 专为摧毁"永恒回声·奥罗波罗斯"设计的终极对策。集极高伤害、穿透、灼烧与持续压制于一体，无视任何防御机制，适应其全词缀轮转的动态弱点。 |

---

## 3. 词条总览与设计说明

### 3.1 新增词条完整列表（15 个）

| 序号 | 词条 ID | 词条名称 | 符文数量 | 类型 |
| :--- | :--- | :--- | :--- | :--- |
| 1 | `runeword_super_inferno` | 极炎之语 | 三符文 | 同系高阶共鸣 |
| 2 | `runeword_absolute_zero` | 绝对零度之语 | 三符文 | 同系高阶共鸣 |
| 3 | `runeword_infinite_echo` | 无尽回响之语 | 三符文 | 同系高阶共鸣 |
| 4 | `runeword_frost_scatter` | 霜散之语 | 双符文 | 跨系复合 |
| 5 | `runeword_lightning_bounce` | 雷弹之语 | 双符文 | 跨系复合 |
| 6 | `runeword_magma_laser` | 熔岩激光之语 | 双符文 | 跨系复合 |
| 7 | `runeword_shield_breaker` | 破法者之语 | 双符文 | Boss 特化 |
| 8 | `runeword_frost_pierce` | 凛冬穿刺之语 | 双符文 | Boss 特化 |
| 9 | `runeword_haste_hunter` | 猎杀者之语 | 双符文 | Boss 特化 |
| 10 | `runeword_clone_destroyer` | 灭群之语 | 双符文 | Boss 特化 |
| 11 | `runeword_life_bane` | 枯萎之语 | 双符文 | Boss 特化 |
| 12 | `runeword_lightning_scatter` | 雷暴散射之语 | 双符文 | Boss 特化 |
| 13 | `runeword_chaos_storm` | 混沌风暴之语 | 四符文 | 终极复合 |
| 14 | `runeword_infinite_refraction` | 无限折射之语 | 四符文 | 终极复合 |
| 15 | `runeword_abyssal_gaze` | 深渊凝视之语 | 四符文 | 终极复合 |

### 3.2 Boss 弱点覆盖矩阵

| Boss 名称 | 核心词缀 | 推荐词条 | 覆盖属性 |
| :--- | :--- | :--- | :--- |
| 熔炉守卫·伊格尼斯 | shield + haste | `runeword_super_inferno`, `runeword_shield_breaker` | pyro + pierce |
| 霜晶缝合怪·格拉西斯 | jump + regen | `runeword_absolute_zero`, `runeword_frost_pierce`, `runeword_life_bane` | cryo + pierce + laser |
| 裂变母体·米克罗 | clone + healer | `runeword_clone_destroyer`, `runeword_lightning_scatter` | lightning + bounce + scatter |
| 贪婪之渊·噬神者 | devour + shield | `runeword_shield_breaker`, `runeword_infinite_echo` | pierce + pyro + bounce |
| 翠绿共生体·维里迪斯 | regen + healer | `runeword_haste_hunter`, `runeword_life_bane`, `runeword_lightning_scatter` | laser + pyro + lightning |
| 雷霆幻影·特斯拉 | haste + clone | `runeword_haste_hunter`, `runeword_clone_destroyer` | cryo + laser + lightning |
| 混沌融合体·奇美拉 | berserk + devour | `runeword_frost_pierce`, `runeword_infinite_refraction` | pierce + laser |
| 永恒回声·奥罗波罗斯 | 全词缀轮转 | `runeword_chaos_storm`, `runeword_abyssal_gaze` | 全属性覆盖 |

### 3.3 数值平衡验证

所有新增词条均严格遵循以下数值约束：

| 词条类型 | 单属性范围（约束） | damage 范围（约束） | 本文档实际范围 | 合规性 |
| :--- | :--- | :--- | :--- | :--- |
| 双符文词条 | 1~3 | 2~5 | 单属性 2~3，damage 2~4 | 全部合规 |
| 三符文词条 | 2~5 | 5~10 | 单属性 5，damage 6~8 | 全部合规 |
| 四符文词条 | 3~6 | 8~15 | 单属性 3~5，damage 12~15 | 全部合规 |

### 3.4 机制合规性声明

本文档所有词条的 `effect_desc` 描述完全基于以下现有机制，**未引入任何不存在的新机制**：

- **pyro**：灼烧持续伤害、护盾熔化
- **cryo**：减速、冻结
- **lightning**：闪电链跳跃、中断治疗
- **bounce**：弹跳次数、多目标
- **pierce**：穿透层数、直接穿透护盾
- **scatter**：散射弹数、范围覆盖
- **laser**：持续光束、精准高伤
- **damage**：基础伤害倍率

所有 `pattern` 均只使用了 `RUNE_DB` 中明确定义的以下 14 个合法符文 ID：`rune_pyro_1`, `rune_pyro_2`, `rune_cryo_1`, `rune_cryo_2`, `rune_lightning_1`, `rune_lightning_2`, `rune_bounce_1`, `rune_bounce_2`, `rune_pierce_1`, `rune_pierce_2`, `rune_scatter_1`, `rune_laser_1`, `rune_laser_2`。

---

*文档版本：v2.0 | 生成者：Designer Agent | 项目：Echo Alchemist V2*
