# Echo Alchemist 符文词条头脑风暴

基于现有的 `RUNE_DB` 和 `RUNEWORD_DB` 结构，以及 `COUNTER_MAP` 中定义的属性和克制关系，以下是为 Echo Alchemist 设计的新符文组合词条（Runeword）的头脑风暴结果。

## 现有系统分析

当前系统包含 7 种基础属性（Element），每种属性在 `COUNTER_MAP` 中都对应着特定的克制关系：
- **pyro (火)**: 克制 shield（护盾）, regen（再生）
- **cryo (冰)**: 克制 haste（极速）, jump（跳跃）
- **lightning (雷)**: 克制 clone（分身）, healer（治疗者）
- **bounce (弹射)**: 克制 clone（分身）, devour（吞噬）
- **pierce (穿透)**: 克制 shield（护盾）, jump（跳跃）
- **scatter (散射)**: 克制 clone（分身）, healer（治疗者）
- **laser (激光)**: 克制 regen（再生）, devour（吞噬）

现有的词条主要包括同系共鸣（如双火、双冰）和部分双系复合（火+穿透、冰+弹射、雷+散射、激光+穿透），以及少量三系复合（火冰雷、双穿透+散射）。

## 头脑风暴方向与新词条设计

为了丰富游戏的策略深度，我们从以下几个方向构思了新的符文词条组合：

### 1. 强化同系共鸣（三符文纯色套路）

目前的同系共鸣主要是双符文组合。为了奖励专精某一属性的玩家，可以引入更高阶的三符文纯色词条。

| 词条名称 | ID | 组合配方 | 效果描述 | Stats 加成 |
| :--- | :--- | :--- | :--- | :--- |
| **极炎之语** | `runeword_super_inferno` | `rune_pyro_1` + `rune_pyro_2` + `rune_pyro_1` | 三火共鸣，引发剧烈的连锁爆炸。灼烧伤害大幅提升，且被灼烧击杀的敌人会产生火焰爆炸，对周围敌人造成基于最大生命值的百分比伤害。 | `{ pyro: 5, damage: 10 }` |
| **绝对零度之语** | `runeword_absolute_zero` | `rune_cryo_1` + `rune_cryo_2` + `rune_cryo_1` | 三冰共鸣，将战场化为冰川。大幅延长减速效果，并有概率将减速转化为“深度冻结”（硬控），冻结状态下的敌人受到物理属性伤害时会产生额外“碎冰”伤害。 | `{ cryo: 5, damage: 8 }` |

### 2. 物理与元素的深度结合

现有的物理与元素结合（如“炎刃之语”）效果相对简单。我们可以设计更多能够显著改变弹道或攻击形态的复合词条。

| 词条名称 | ID | 组合配方 | 效果描述 | Stats 加成 |
| :--- | :--- | :--- | :--- | :--- |
| **雷霆弹跃之语** | `runeword_lightning_bounce` | `rune_lightning_1` + `rune_bounce_1` | 闪电附着于弹射弹丸上。每次弹跳不仅对目标造成伤害，还会向周围发射数道微型闪电链，极大地增强对集群敌人的清理能力。 | `{ lightning: 2, bounce: 2 }` |
| **冰霜散射之语** | `runeword_frost_scatter` | `rune_cryo_1` + `rune_scatter_1` | 冰霜与散射结合。散射出的每一发弹丸都会在地面留下冰霜路径，走过路径的敌人将被减速。 | `{ cryo: 2, scatter: 2 }` |
| **熔岩激光之语** | `runeword_magma_laser` | `rune_pyro_2` + `rune_laser_1` | 炎核与光束融合，发射出粗壮的熔岩射线。光束不仅具有穿透性，还会融化敌人的护甲，使其在短时间内受到的所有伤害增加。 | `{ pyro: 2, laser: 2, damage: 3 }` |

### 3. 针对特定克制关系的特化词条

利用 `COUNTER_MAP` 的设定，我们可以设计专门用于应对某些棘手敌人词缀的特化词条，鼓励玩家根据当前波次的敌人类型动态调整网格。

| 词条名称 | ID | 组合配方 | 效果描述 | Stats 加成 |
| :--- | :--- | :--- | :--- | :--- |
| **破法者之语** | `runeword_shield_breaker` | `rune_pyro_1` + `rune_pierce_2` | 专为摧毁护盾而生。对带有护盾的敌人造成巨额额外伤害，并在击破护盾时使敌人陷入短暂的易伤状态。 | `{ pyro: 1, pierce: 2, damage: 4 }` |
| **猎杀者之语** | `runeword_haste_hunter` | `rune_cryo_2` + `rune_laser_2` | 聚焦与冰晶的结合，专克极速敌人。激光会自动追踪移动速度最快的敌人，并在持续照射下迅速叠加减速层数直至其完全定身。 | `{ cryo: 2, laser: 2 }` |
| **灭群之语** | `runeword_clone_destroyer` | `rune_lightning_2` + `rune_bounce_2` | 电弧与回响的终极结合。当攻击命中分身或集群敌人时，伤害会在目标之间疯狂弹射并产生电弧连锁，目标越密集，总伤害越高。 | `{ lightning: 2, bounce: 2, damage: 3 }` |

### 4. 罕见的高阶复合套路（四符文）

这些终极词条需要玩家在 3x3 网格中精心排列才能激活，作为后期的追求目标。

| 词条名称 | ID | 组合配方 | 效果描述 | Stats 加成 |
| :--- | :--- | :--- | :--- | :--- |
| **混沌风暴之语** | `runeword_chaos_storm` | `rune_pyro_1` + `rune_cryo_1` + `rune_lightning_1` + `rune_scatter_1` | 三元素与散射的完美融合。发射出包含火、冰、雷三种属性的混沌弹幕，每次命中随机附加一种强效元素异常，并引发小范围的元素爆炸。 | `{ pyro: 2, cryo: 2, lightning: 2, scatter: 3, damage: 15 }` |
| **无限折射之语** | `runeword_infinite_refraction` | `rune_laser_1` + `rune_bounce_1` + `rune_pierce_1` + `rune_laser_2` | 激光、弹射与穿透的奇迹结合。发射的激光在穿透敌人后会自动折射向下一个目标，形成一张覆盖全场的光网，持续切割战场。 | `{ laser: 4, bounce: 2, pierce: 2, damage: 10 }` |

### 5. 辅助与生存向词条（引入新机制的设想）

虽然目前游戏以伤害为主，但可以引入一些提供生存或续航的词条概念，为未来的系统扩展做准备。

| 词条名称 | ID | 组合配方 | 效果描述 | Stats 加成 |
| :--- | :--- | :--- | :--- | :--- |
| **生机之语** | `runeword_vitality_drain` | `rune_pierce_1` + `rune_scatter_1` | 汲取敌人生机的特殊技巧。造成的伤害有微小概率转化为玩家的护盾或生命值（取决于游戏是否引入生命机制），或者转化为能量精粹（局外货币）。 | `{ pierce: 1, scatter: 1 }` |
| **时空扭曲之语** | `runeword_time_warp` | `rune_bounce_2` + `rune_laser_2` | 改变战场时间的流速。所有敌人的移动速度和攻击频率略微降低，而玩家的弹药飞行速度和攻击频率提升。 | `{ bounce: 1, laser: 1 }` |

---
*本文档由 Manus AI 生成，旨在为 Echo Alchemist 符文系统的扩展提供创意参考。*
