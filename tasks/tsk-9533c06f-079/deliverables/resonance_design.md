# Echo Alchemist V2 - 符文属性共鸣系统设计文档

**作者**：Manus AI
**角色**：Game Designer
**任务**：Step2 设计 6 种属性共鸣效果方案

## 1. 系统概述与设计原则

属性共鸣系统是 Echo Alchemist V2 符文机制的横向增益维度。当玩家在 3x3 网格中放置同属性符文，累计属性层数（由 `calcRuneBaseStats` 计算）达到 3 / 6 / 9 层时，分别激活一阶、二阶、三阶共鸣效果，提供属于该属性的专属加强。

本方案基于代码库中已有的 `pyro`（火焰）共鸣设计模式，为 `cryo`、`lightning`、`bounce`、`pierce`、`scatter`、`laser` 六种属性补充完整的设计参数。

### 设计原则
1. **机制强相关**：共鸣效果必须紧密结合该属性的核心代码机制（例如：冰冻温度阈值、闪电链概率、弹跳次数上限、穿透衰减系数、散射分裂角度、激光折射等），避免设计出脱离现有战斗框架的独立效果。
2. **数值平衡**：遵循三阶递进的平衡模型。一阶提供轻微机制增强与基础属性；二阶提供中等机制增强、基础属性与 20% 整体伤害加成；三阶提供最大化机制增强、高额基础属性、50% 整体伤害加成及特殊的机制突破。
3. **参数可读性**：所有共鸣参数命名需与 `combat_system.js` 及相关战斗模块（如 `collision.js`、`damage_calc.js`、`spawn_system.js`）中的实际变量名或公式逻辑保持一致，以便 Step3 的开发人员直接读取实现。

---

## 2. 冰霜共鸣 (Cryo)

**核心机制分析**：
在 `combat_system.js` 和 `config.js` 中，冰霜属性通过降低敌人的温度（`temp`）来触发状态异常。默认冰冻阈值为 `-80°`（`const isFrozen = enemy.temp <= -80;`）。当敌人处于冰冻状态时，受击或死亡会有特殊判定。

**设计方案**：
共鸣通过大幅提高冰冻触发的温度阈值，使敌人极易进入冰冻状态。三阶额外提供冰冻状态下的伤害加深机制，复用现有的 `_frostPrisonAmp` 逻辑或作为独立的战斗乘区。

| 共鸣等级 | 触发层数 | 效果描述 | 参数定义 (`params`) |
|---|---|---|---|
| 一阶 | 3 | 冰冻触发温度提升至 -60°，基础冰霜属性 +5 | `freezeTempThreshold: -60`, `baseCryoBonus: 5`, `cryoMultiplier: 1.0` |
| 二阶 | 6 | 冰冻触发温度提升至 -40°，基础冰霜属性 +10，冰霜伤害整体 +20% | `freezeTempThreshold: -40`, `baseCryoBonus: 10`, `cryoMultiplier: 1.2` |
| 三阶 | 9 | 冰冻触发温度提升至 -20°，基础冰霜属性 +25，冰霜伤害整体 +50%，冰冻状态下受到伤害额外 +30% | `freezeTempThreshold: -20`, `baseCryoBonus: 25`, `cryoMultiplier: 1.5`, `frozenDmgAmp: 0.3` |

---

## 3. 雷霆共鸣 (Lightning)

**核心机制分析**：
在 `damage_calc.js` 的 `combat_lightning_triggerChain` 中，闪电链的基础触发概率由 `CONFIG.mechanics.lightning.baseChainChance`（默认 0.15）决定。闪电链在多次弹跳中存在伤害衰减，衰减系数为 `damageDecayBase`（默认 0.45）。

**设计方案**：
共鸣通过直接提升基础连锁概率，确保闪电链高频触发。三阶放弃了原占位符中的“同一目标二次触发”（可能导致死循环或平衡崩坏），改为降低闪电链的伤害衰减，提升群攻总伤害。

| 共鸣等级 | 触发层数 | 效果描述 | 参数定义 (`params`) |
|---|---|---|---|
| 一阶 | 3 | 闪电链基础触发概率 +15%，基础闪电属性 +5 | `chainChanceBonus: 0.15`, `baseLightningBonus: 5`, `lightningMultiplier: 1.0` |
| 二阶 | 6 | 闪电链基础触发概率 +30%，基础闪电属性 +10，闪电伤害整体 +20% | `chainChanceBonus: 0.30`, `baseLightningBonus: 10`, `lightningMultiplier: 1.2` |
| 三阶 | 9 | 闪电链基础触发概率 +50%，基础闪电属性 +25，闪电伤害整体 +50%，闪电链伤害衰减降低 20% | `chainChanceBonus: 0.50`, `baseLightningBonus: 25`, `lightningMultiplier: 1.5`, `chainDecayReduction: 0.2` |

---

## 4. 弹跳共鸣 (Bounce)

**核心机制分析**：
弹珠在碰撞后会消耗 `bounce` 属性层数（即 `bouncesLeft`），并且每次弹跳后伤害按 `0.5^n` 指数衰减。

**设计方案**：
共鸣直接提升弹跳相关的伤害加成。二阶开始降低弹跳伤害的衰减速度（改变指数底数或减半指数），三阶提供额外的弹跳次数，并完全移除弹跳伤害衰减。

| 共鸣等级 | 触发层数 | 效果描述 | 参数定义 (`params`) |
|---|---|---|---|
| 一阶 | 3 | 弹跳伤害加成 +15%，基础弹跳属性 +5 | `bounceDmgBonus: 0.15`, `baseBounceBonus: 5` |
| 二阶 | 6 | 弹跳伤害加成 +30%，基础弹跳属性 +10，弹跳伤害衰减降低 50% | `bounceDmgBonus: 0.30`, `baseBounceBonus: 10`, `bounceDecayReduction: 0.5` |
| 三阶 | 9 | 弹跳伤害加成 +50%，基础弹跳属性 +25，弹跳次数额外 +2，弹跳后伤害不衰减 | `bounceDmgBonus: 0.50`, `baseBounceBonus: 25`, `extraBounces: 2`, `noBounceDecay: true` |

---

## 5. 穿透共鸣 (Pierce)

**核心机制分析**：
穿透（`pierce`）属性允许子弹穿透敌人，消耗 `piercesLeft`，且每次穿透后伤害减半。

**设计方案**：
原占位符中的“额外施加火焰温度”与穿透的核心定位不符。现调整为：共鸣专注提升穿透伤害，二阶和三阶逐步降低穿透后的伤害衰减系数，三阶提供额外的穿透次数。

| 共鸣等级 | 触发层数 | 效果描述 | 参数定义 (`params`) |
|---|---|---|---|
| 一阶 | 3 | 穿透伤害加成 +15%，基础穿透属性 +5 | `pierceDmgBonus: 0.15`, `basePierceBonus: 5` |
| 二阶 | 6 | 穿透伤害加成 +30%，基础穿透属性 +10，穿透伤害衰减降低 20% | `pierceDmgBonus: 0.30`, `basePierceBonus: 10`, `pierceDecayReduction: 0.2` |
| 三阶 | 9 | 穿透伤害加成 +50%，基础穿透属性 +25，穿透次数额外 +1，穿透伤害衰减降低 40% | `pierceDmgBonus: 0.50`, `basePierceBonus: 25`, `extraPierces: 1`, `pierceDecayReduction: 0.4` |

---

## 6. 散射共鸣 (Scatter)

**核心机制分析**：
在 `spawn_system.js` 中，散射子弹根据 `recipe.scatter` 数量分裂，分裂角度受 `_scatterAngleMultiplier` 变量控制。

**设计方案**：
共鸣直接增加分裂出的子弹数量（`extraScatterShots`），提升散射伤害。三阶通过缩小分裂角度（`scatterAngleReduction`），使火力更加集中，提升单体爆发能力。

| 共鸣等级 | 触发层数 | 效果描述 | 参数定义 (`params`) |
|---|---|---|---|
| 一阶 | 3 | 散射子弹数量额外 +1，基础散射属性 +5 | `extraScatterShots: 1`, `baseScatterBonus: 5`, `scatterMultiplier: 1.0` |
| 二阶 | 6 | 散射子弹数量额外 +2，基础散射属性 +10，散射伤害整体 +20% | `extraScatterShots: 2`, `baseScatterBonus: 10`, `scatterMultiplier: 1.2` |
| 三阶 | 9 | 散射子弹数量额外 +3，基础散射属性 +25，散射伤害整体 +50%，散射角度收窄 30% | `extraScatterShots: 3`, `baseScatterBonus: 25`, `scatterMultiplier: 1.5`, `scatterAngleReduction: 0.3` |

---

## 7. 激光共鸣 (Laser)

**核心机制分析**：
在 `collision.js` 中，激光命中敌人时，如果有 `blazing_beam` 词条会额外提升温度。激光折射概率受 `CONFIG.gameplay.laserRefractionBaseChance` 控制。

**设计方案**：
共鸣内置了类似炽热光线（`blazing_beam`）的升温效果，且随阶数提升升温幅度。三阶额外提升激光折射的基础概率，增强激光在密集敌人中的清场能力。

| 共鸣等级 | 触发层数 | 效果描述 | 参数定义 (`params`) |
|---|---|---|---|
| 一阶 | 3 | 激光每次命中额外升温 +5°，基础激光属性 +5 | `laserTempBonus: 5`, `baseLaserBonus: 5`, `laserMultiplier: 1.0` |
| 二阶 | 6 | 激光每次命中额外升温 +10°，基础激光属性 +10，激光伤害整体 +20% | `laserTempBonus: 10`, `baseLaserBonus: 10`, `laserMultiplier: 1.2` |
| 三阶 | 9 | 激光每次命中额外升温 +20°，基础激光属性 +25，激光伤害整体 +50%，激光折射基础概率 +20% | `laserTempBonus: 20`, `baseLaserBonus: 25`, `laserMultiplier: 1.5`, `laserRefractionBonus: 0.2` |

---

## 8. 下一步开发建议 (给 Step3 的提示)

1. **参数读取**：在 `combat_system.js` 或相关逻辑模块中，通过 `this.activeElementResonances['<element>']` 读取共鸣状态，并提取 `.params`。
2. **叠加逻辑**：所有 `baseXxxBonus` 均应在计算基础伤害或判定前，叠加到当前的属性层数上（如 `effectiveCryo = config.cryo + cryoBonus`）。
3. **衰减修改**：对于 `pierce` 和 `bounce` 的衰减降低（如 `pierceDecayReduction`），建议在计算 `Math.pow(0.5, index)` 时，将底数 `0.5` 提升为 `0.5 + pierceDecayReduction`。
4. **角度控制**：对于 `scatter` 的角度收窄，在 `spawn_system.js` 派生子弹时，将 `_scatterAngleMultiplier` 乘以 `(1 - scatterAngleReduction)`。
