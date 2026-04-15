# 敌人词缀与 Boss 索引 (Enemy Affix & Boss Index)

> **数据来源**：`src/config.js` → `balance.affixes`, `balance.bossConfigs`, `BOSS_DB`；`src/spawn_system.js` → `spawn_generateAffixes()`；`src/systems.js` → `TRUTH_BOOK_DATA.enemies`
> **用途**：Agent 快速查询 8 种敌人词缀和 8 个 Boss 的行为机制、出现回合、克制属性及关键代码位置。

## 1. 敌人词缀总览（8 种）

| 词缀 ID | 图鉴名称 | 图标 | 最早出现回合 | 掉落权重（r=15） | 克制属性 |
|---|---|---|---|---|---|
| `shield` | 护盾魔像 | 🛡️ | Round 3 | 50 | pierce（穿透）、pyro（火焰） |
| `regen` | 再生魔像 | 💚 | Round 5 | 40 | pyro（火焰）、laser（激光） |
| `healer` | 治愈魔像 | 💖 | Round 6 | 60 | lightning（闪电）、scatter（散射） |
| `haste` | 极速魔像 | ⚡ | Round 8 | 50 | cryo（冰霜） |
| `jump` | 跳跃魔像 | 🦘 | Round 9 | 60 | cryo（冰霜）、pierce（穿透） |
| `clone` | 分身魔像 | 🦠 | Round 12 | 50 | lightning（闪电）、scatter（散射）、bounce（弹跳） |
| `devour` | 贪食魔像 | 👅 | Round 12 | 40 | bounce（弹跳）、laser（激光） |
| `berserk` | 狂暴魔像 | 😡 | Round 14 | r×3（无上限） | cryo（冰霜）、pyro（火焰）（降温/升温控制） |

> **词缀数量概率**（`spawn_generateAffixes`）：0 个词缀（默认）；1 个词缀：最高 60%（r=20）；2 个词缀：最高 15%（r=20），Boss 战后临时 +25%。

## 2. 词缀行为详解

### 2.1 shield（护盾）

| 属性 | 值 |
|---|---|
| 受到的伤害倍率 | × 0.5（减伤 50%） |
| 特殊行为 | 反射激光类攻击，改变激光方向 |
| 克制方式 | 穿透（pierce）直接无视护盾；火焰（pyro）高温熔化 |
| 关键配置 | `CONFIG.balance.affixes.shieldReduction = 0.5` |
| 实现位置 | `src/combat_system.js` → `combat_damageEnemy` 伤害计算段 |

### 2.2 regen（再生）

| 属性 | 值 |
|---|---|
| 每回合回血比例 | 最大生命值的 20%（`regenPercent = 0.2`） |
| 特殊行为 | 每回合行动时自动回血，需在回合间隙造成足够伤害才能击杀 |
| 克制方式 | 激光（laser）持续伤害压制；火焰（pyro）高温爆燃一次性高伤 |
| 关键配置 | `CONFIG.balance.affixes.regenPercent = 0.2` |
| 实现位置 | `src/game_phase.js` → 回合行动逻辑 |

### 2.3 healer（治愈者）

| 属性 | 值 |
|---|---|
| 每次治疗比例 | 目标最大生命值的 12%（`healerPercent = 0.12`） |
| 治疗范围 | 自身宽度的 2 倍（`healerRange = 2`） |
| 特殊行为 | 回合行动时治疗周围友军单位（不治疗自身） |
| 克制方式 | 优先击杀治愈者；闪电链（lightning）连锁打击；散射（scatter）覆盖范围 |
| 关键配置 | `CONFIG.balance.affixes.healerPercent`, `healerRange` |
| 实现位置 | `src/game_phase.js` → `phase_enemy_startLogic` 治疗行动段 |

### 2.4 haste（极速）

| 属性 | 值 |
|---|---|
| 每回合行动次数 | 2 次（`hasteActions = 2`） |
| 特殊行为 | 每回合在正常移动后额外追加一次冲刺移动；加速仅作用于移动，不重复结算其他词缀 |
| 克制方式 | 冰霜（cryo）冻结后停止行动；减速类效果 |
| 关键配置 | `CONFIG.balance.affixes.hasteActions = 2` |
| 实现位置 | `src/game_phase.js` → `phase_enemy_startLogic` 行动次数段 |

### 2.5 jump（跳跃）

| 属性 | 值 |
|---|---|
| 跳跃距离 | 2 行（`jumpRows = 2`） |
| 特殊行为 | 当前方被阻挡时，可以直接跳过障碍物继续前进 |
| 克制方式 | 冰霜（cryo）冻结阻止跳跃；穿透（pierce）精准打击 |
| 关键配置 | `CONFIG.balance.affixes.jumpRows = 2` |
| 实现位置 | `src/game_phase.js` → 移动判定段 |

### 2.6 clone（分身）

| 属性 | 值 |
|---|---|
| 回合开始分身概率 | 50%（`cloneChanceTurn = 0.5`） |
| 受击分身概率 | 20%（`cloneChanceHit = 0.2`） |
| 特殊行为 | 分裂出复制体继承本体的所有词缀，可迅速填满战场 |
| 克制方式 | 闪电链（lightning）连锁伤害；散射（scatter）范围覆盖；弹跳（bounce）多目标 |
| 关键配置 | `CONFIG.balance.affixes.cloneChanceTurn`, `cloneChanceHit` |
| 实现位置 | `src/game_phase.js` → 回合开始段 & `src/combat_system.js` → 受击段 |

### 2.7 devour（吞噬）

| 属性 | 值 |
|---|---|
| 吞噬触发概率 | 100%（`devourChance = 1`，每回合行动时） |
| 吞噬范围 | 自身宽度的 2 倍（`devourRange = 2`） |
| 特殊行为 | 每回合行动时，有概率吞噬相邻友军单位，继承其全部血量与所有词缀，被吞噬单位立即死亡 |
| 克制方式 | 弹跳（bounce）多次弹射快速消耗；激光（laser）精准击杀 |
| 关键配置 | `CONFIG.balance.affixes.devourChance`, `devourRange` |
| 实现位置 | `src/game_phase.js` → `phase_enemy_startLogic` 吞噬行动段 |

### 2.8 berserk（狂暴）

| 属性 | 值 |
|---|---|
| 狂暴概率系数 | `Temp × 0.5`（`berserkChanceMult = 0.5`） |
| 特殊行为 | 每回合结束时自动升温 +20°C，且温度结算执行两次；过热状态下有概率触发狂暴，使本回合非移动行动额外结算一次 |
| 克制方式 | 冰霜（cryo）降温阻止狂暴触发；快速击杀 |
| 关键配置 | `CONFIG.balance.affixes.berserkChanceMult = 0.5` |
| 实现位置 | `src/game_phase.js` → 温度结算段 & 狂暴判定段 |

## 3. Boss 总览（8 个）

### 3.1 Mini-Boss（出场顺序：Round 5 → 约 12 → 约 19 → 约 26）

| ID | 名称 | 图标 | 词缀 | 弱点 | 狂暴行为 |
|---|---|---|---|---|---|
| `ignis` | 熔炉守卫·伊格尼斯 | 🔥 | shield + haste | pierce、pyro | 护盾层数翻倍；每回合升温 +30°C；对周围敌人火焰溅射 |
| `glacies` | 霜晶缝合怪·格拉西斯 | ❄️ | jump + regen | cryo、pierce | 跳跃行数增加至 3 行；跳跃落地时冻结周围 Peg |
| `mikro` | 裂变母体·米克罗 | 🦠 | clone + healer | lightning、scatter | 分身概率提升至 100%；每个存活分身提供 10% 减伤（上限 50%） |
| `devourer` | 贪婪之渊·噬神者 | 👅 | devour + shield | bounce、laser | 全屏吞噬（吞噬范围 = 99） |

### 3.2 大 Boss（出场顺序：约 Round 33 → 40 → 47 → 54）

| ID | 名称 | 图标 | 词缀 | 弱点 | 狂暴行为 |
|---|---|---|---|---|---|
| `viridis` | 翠绿共生体·维里迪斯 | 🌿 | regen + healer | laser、pyro | 放弃治疗他人；自身再生速度 × 3.0 |
| `tesla` | 雷霆幻影·特斯拉 | ⚡ | haste + clone | cryo、bounce | 行动次数再 +1（共 4 次） |
| `chimera` | 混沌融合体·奇美拉 | 🔴 | berserk + devour | pierce、laser | 温度直接达到阈值；受击时有 25% 概率触发全场爆炸 |
| `ouroboros` | 永恒回声·奥罗波罗斯 | 🔄 | 轮转（见下） | 动态 | 词缀轮转加速：每回合切换（正常为每 3 回合） |

### 3.3 奥罗波罗斯词缀轮转规则

| 轮转组 | 词缀 | 对应弱点 |
|---|---|---|
| 组 0（初始） | shield + haste | pierce、cryo |
| 组 1 | regen + healer | laser、pyro |
| 组 2 | clone + jump | lightning、scatter |

**轮转间隔**：正常 3 回合切换；狂暴后每回合切换（`_berserkedRotation = true`）。

## 4. Boss 出场机制

| 参数 | 值 | 说明 |
|---|---|---|
| 第一个 Boss 回合 | Round 5 | 固定 |
| 后续 Boss 间隔 | 7~9 回合 | 随机 |
| 快速击杀延期 | +2 回合 | ≤ 2 回合击杀时 |
| 中速击杀延期 | +1 回合 | 3 回合击杀时 |
| 延期上限 | 第 4 个 Boss 起不再延期 | `delayMaxBossIndex = 3` |
| Mini-Boss 顺序 | ignis → glacies → mikro → devourer | 循环 |
| 大 Boss 顺序 | viridis → tesla → chimera → ouroboros | 循环 |

## 5. Boss 血量公式

```
finalHP = max(
    templateHP × floorMultiplier,
    templateHP × templateWeight + dynamicHP × dynamicWeight
)
```

| 参数 | 值 | 说明 |
|---|---|---|
| `miniBossMult` | 15 | Mini-Boss 血量倍率 |
| `bigBossMult` | 35 | 大 Boss 血量倍率 |
| `templateWeight` | 0.5 | 后期稳定值 |
| `dynamicWeight` | 0.5 | 后期稳定值 |
| `earlyDynamicWeight` | 0.85 | 前期（Round ≤ 5）动态权重 |
| `floorMultiplier` | 0.7 | 保底倍率 |

## 6. Boss 进场冲击波效果

| 参数 | 值 | 说明 |
|---|---|---|
| 波数 | 3 | 视觉冲击波圈数 |
| 词缀感染概率 | 35% | 被冲击波命中的普通敌人获得 Boss 特殊词缀 |
| 随从转化概率 | 5% | 被命中后直接转化为 Boss 随从（大 Boss +10%） |

**实现位置**：`src/spawn_system.js` → `spawn_triggerBossEntranceShockwave(boss)`

## 7. Boss 狂暴触发机制

**触发条件**：Boss 血量首次降至 50% 以下时触发（`combat_checkBossPhaseChange`）。

**触发流程**：
1. `src/combat_system.js` → `combat_checkBossPhaseChange()` 检测血量阈值
2. 广播 `EVENT_TYPES.BOSS_PHASE_CHANGE` 事件（`phase: 'berserk'`）
3. 调用 `combat_triggerBossBerserk(boss)` 根据 `bossType` 应用狂暴效果
4. 视觉反馈：红色冲击波 + 粒子 + 浮动文字 `❗ENRAGE!` + Toast 提示

**关键状态字段**：

| 字段 | 类型 | 说明 |
|---|---|---|
| `boss.berserked` | boolean | 狂暴阶段标志，防止重复触发 |
| `boss._berserkedTempRise` | number | ignis 专用：每回合升温值 |
| `boss._berserkedFireSplash` | object | ignis 专用：火焰溅射配置 |
| `boss._berserkedJumpRows` | number | glacies 专用：狂暴后跳跃行数 |
| `boss._berserkedFreezePegs` | boolean | glacies 专用：落地冻结 Peg 标志 |
| `boss._berserkedCloneChance` | number | mikro 专用：狂暴后分身概率 |
| `boss._berserkedDevourRange` | number | devourer 专用：狂暴后吞噬范围（99 = 全屏） |
| `boss._berserkedHealerRange` | number | viridis 专用：0 = 停止治疗他人 |
| `boss._berserkedSelfRegenMult` | number | viridis 专用：自身再生倍率 |
| `boss._berserkedActionsBonus` | number | tesla 专用：额外行动次数 |
| `boss._berserkedBlastOnHitChance` | number | chimera 专用：受击全场爆炸概率 |
| `boss._berserkedRotation` | boolean | ouroboros 专用：每回合轮转标志 |

## 8. 关键代码位置

| 功能 | 文件 | 方法 / 行号 |
|---|---|---|
| 词缀生成逻辑 | `src/spawn_system.js` | `spawn_generateAffixes()` |
| 词缀行为实现 | `src/game_phase.js` | `phase_enemy_startLogic()` 及各词缀分支 |
| Boss 生成 | `src/spawn_system.js` | `spawn_spawnBoss(bossId, isBigBoss)` |
| Boss 出场顺序 | `src/spawn_system.js` | `spawn_selectNextBoss()` 约第 1637 行 |
| Boss 狂暴触发 | `src/combat_system.js` | `combat_checkBossPhaseChange()` 约第 1840 行 |
| Boss 狂暴效果 | `src/combat_system.js` | `combat_triggerBossBerserk(boss)` 约第 2876 行 |
| Boss 数据配置 | `src/config.js` | `balance.bossConfigs` 约第 545 行 |
| Boss 数据库 | `src/config.js` | `BOSS_DB` 约第 1060 行 |
| 词缀图鉴 | `src/systems.js` | `TRUTH_BOOK_DATA.enemies` 第 24 行起 |
| Boss 图鉴 | `src/systems.js` | `TRUTH_BOOK_DATA` → `categoryId: 'boss'` 约第 782 行 |
