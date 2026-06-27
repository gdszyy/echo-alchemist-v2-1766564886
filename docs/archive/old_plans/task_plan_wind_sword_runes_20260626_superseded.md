# 风属性/飞剑变异机制与伤害同步开发任务规划

## 1. 任务背景与目标

根据当前需求，需要对 Echo Alchemist V2 项目中的以下机制进行重构与优化：
1. **风暴核合并机制**：解决风暴核累积过多导致画面混乱的问题。相交的风暴核在回合结束时应合并为一个，位置取中点，属性与大小累加，但存在最大值。达到最大值时，额外增加风暴打击的次数和持续时间。
2. **风暴打击特效与伤害同步**：修复目前风暴打击特效结束但伤害未结束的问题，实现两者的严格同步。
3. **飞剑与风属性等级重构**：将飞剑等级和风属性等级的提升方式，改为由特殊的符文组合提供（三个穿透符文提供飞剑等级，三个反弹符文提供风属性等级）。

## 2. 现状分析

### 2.1 风暴核机制现状
目前风暴核的生成在 `src/spawn_system.js` 的 `spawn_stormCore` 中处理，更新、释放和衰减在 `src/combat_system.js` 的 `combat_wind_updateStormCores`、`combat_wind_releaseStormCoreCyclone` 和 `combat_wind_decayStormCoresEnergy` 中处理。
- **合并机制**：目前不存在风暴核合并逻辑，每个风暴核独立存在，回合结束时仅扣除能量并处理透明度衰减。
- **伤害与特效同步**：大旋风（Storm Core Cyclone）和暴风绞杀（Storm Strangle）的伤害通过 `setTimeout` 多段触发，而特效也是通过 `setTimeout` 或独立生命周期管理。由于缺乏统一的进度控制，导致视觉表现与伤害结算脱节。

### 2.2 飞剑与风属性等级现状
目前飞剑等级（`flying_sword_lv`）和风属性等级（`wind_lv`）主要通过配置（如 `systems.js` 中的调试滑块）或进化规则（如 `config.js` 中的 `evolutionRules`）注入到子弹配置（`bulletConfig` / `recipe`）中。
- 飞剑和风属性在实体和战斗系统中通过读取 `level` 字段来改变颜色和行为（如 `entities.js` 和 `projectile.js`）。
- 符文系统（`rune_system.js` 和 `rune_config.js`）目前支持词条组合（`RUNEWORD_DB`）和基础属性累加（`calcRuneBaseStats`），但尚未实现特定同类符文组合直接提升飞剑/风属性等级的逻辑。

## 3. 任务拆分规划

为了确保代码质量和架构一致性，按照 `echo-developer` 技能规范，将该需求拆分为以下三个子任务。

### Task 1: 风暴核合并机制实现

**目标**：在回合结束时，检测并合并相交的风暴核，处理属性累加与上限逻辑。

**执行步骤**：
1.  **修改 `src/config.js`**：
    在 `wind_system.storm_core` 配置中增加合并相关的阈值和上限参数。例如 `maxEnergyCapacity`（最大能量上限）、`maxRadius`（合并后的最大半径上限）以及 `bonusTickThreshold`（触发额外打击次数的阈值）。
2.  **新增合并逻辑函数**：
    在 `src/combat_system.js` 中新增 `combat_wind_mergeStormCores` 方法。该方法遍历当前的 `stormCores` 数组，使用两两相交检测（距离小于两者半径之和）。如果相交，则合并为一个新的风暴核。
    -   **位置**：取两个风暴核的加权中点（可根据能量或半径加权）。
    -   **属性累加**：`radius`、`energy`、`energyRequired` 进行累加，但受限于配置中的最大值。
    -   **溢出处理**：当累加的能量或半径达到最大值时，记录一个 `bonusTicks` 属性，用于后续增加打击次数。
3.  **集成到回合结束流程**：
    修改 `src/game_phase.js` 或 `src/combat_system.js` 中的回合结束调用（如 `combat_wind_decayStormCoresEnergy` 之前或之后），调用 `combat_wind_mergeStormCores`。

### Task 2: 风暴打击特效与伤害同步优化

**目标**：重构大旋风和暴风绞杀的释放逻辑，确保视觉特效的生命周期与伤害结算严格一致。

**执行步骤**：
1.  **重构 `combat_wind_releaseStormCoreCyclone`**：
    -   移除分散的 `setTimeout`。
    -   引入统一的 Tick 管理机制，或者创建一个独立的持续性特效实体（Effect Entity），在 `update` 循环中同步处理伤害和粒子生成。
    -   读取 Task 1 中记录的 `bonusTicks` 属性，动态增加总 Tick 数和持续时间。
2.  **重构暴风绞杀（Storm Strangle）逻辑**：
    -   在 `combat_wind_executeCircleEffect` 中，修改暴风绞杀的伤害触发逻辑，同样避免使用硬编码的 `setTimeout`。
    -   确保风刃粒子的存活时间（`life`）与伤害段数的总时间精确匹配。
3.  **文档更新**：
    更新 `src/combat/combat.md`，记录风暴核生命周期和特效同步的新机制。

### Task 3: 飞剑与风属性等级符文重构

**目标**：将飞剑等级和风属性等级的获取方式改为由符文组合提供。

**执行步骤**：
1.  **修改 `src/rune_config.js`**：
    在 `RUNEWORD_DB` 中新增两个特殊的词条组合：
    -   **剑意共鸣**：需要三个穿透符文（`pattern: ['rune_pierce_1', 'rune_pierce_1', 'rune_pierce_1']` 或匹配同类元素的通用逻辑），效果为提供 `flying_sword_lv: 1`（或叠加层数）。
    -   **风暴共鸣**：需要三个反弹符文（`pattern: ['rune_bounce_1', 'rune_bounce_1', 'rune_bounce_1']`），效果为提供 `wind_lv: 1`。
    *(注：如果 `RUNEWORD_DB` 不支持纯元素类型匹配，可能需要扩展 `parseRuneGrid` 的匹配逻辑，使其支持按 `element` 匹配而不仅是 `id`匹配。)*
2.  **修改 `src/rune_system.js`**：
    更新 `parseRuneGrid`，确保新词条激活时，将 `flying_sword_lv` 和 `wind_lv` 正确写入 `activeStats`。
3.  **修改配方应用逻辑**：
    在 `src/combat_system.js` 的子弹发射逻辑（约 1690 行）中，拦截 `activeRunewordStats`，如果存在 `flying_sword_lv` 或 `wind_lv`，将其赋值给 `finalRecipe.level`，并确保类型正确切换（例如如果有飞剑等级，强制 `finalRecipe.type = 'flying_sword'`）。
4.  **文档更新**：
    更新 `.cursor/rules/rune_system.md`，记录新增的同类符文组合规则及其对变体等级的影响。

## 4. 执行建议

-   **开发分支**：建议在 `feature/wind-sword-rework` 分支上进行开发。
-   **代码规范**：严格遵循 `echo-developer` 技能中的智能编辑策略，避免全量替换超过 500 行的文件。特别是 `combat_system.js`，应使用局部替换（Unified Diff 或精准修改）。
-   **测试重点**：
    -   在训练场（Training Ground）中生成多个风暴核，强制结束回合，观察合并位置和特效。
    -   在符文背包中摆放三个穿透/反弹符文，观察发射的子弹是否正确升级为高级飞剑/风属性。

## 5. 实现记录（已完成）

> 本章节记录 `feature/wind-sword-rework` 分支上的实际实现内容，由开发 Agent 于 2026-04-12 完成。

### 5.1 任务 A：风暴核合并机制与伤害同步

#### 5.1.1 `src/config.js` — `wind_system.storm_core` 新增参数

| 参数 | 值 | 说明 |
|---|---|---|
| `energyMax` | 20 | 合并累加能量上限 |
| `mergeDistanceMult` | 1.0 | 合并触发距离倍率 `(r1+r2)*mult` |
| `mergeRadiusGrowth` | 10 | 合并后半径增量 |
| `bonusTickThreshold` | 15 | 能量达到此值时触发 bonusTicks |
| `bonusTicksOnMax` | 4 | 达到上限时额外增加的打击次数 |
| `bonusDurationOnMax` | 3 | 达到上限时额外增加的持续时间（秒） |

#### 5.1.2 `src/combat_system.js` — 新增函数

- **`combat_wind_mergeStormCores()`**：回合结束时调用，迭代合并所有相交风暴核。按能量加权取中点，累加半径和能量（受上限约束），溢出时记录 `bonusTicks`。
- **`combat_wind_updateActiveCyclones(timeScale)`**：每帧调用，基于 Tick 计数同步大旋风的伤害与粒子特效。替代原 `setTimeout` 方案。
- **`combat_wind_updateActiveStrangles(timeScale)`**：每帧调用，基于 Tick 计数同步暴风绞杀的切割伤害。替代原 `setTimeout` 方案。
- **`combat_wind_updateActiveTunnels(timeScale)`**：每帧调用，基于 Tick 计数同步风道的切割伤害。替代原 `setTimeout` 方案。

#### 5.1.3 `src/combat_system.js` — 重构函数

- **`combat_wind_releaseStormCoreCyclone(core)`**：不再直接执行 `setTimeout`，改为将旋风实体推入 `this.activeCyclones` 列表，由 `updateActiveCyclones` 每帧驱动。读取 `core.bonusTicks` 动态增加总 Tick 数。
- **`combat_wind_executeCircleEffect(...)` 中的暴风绞杀分支**：改为将绞杀实体推入 `this.activeStrangles` 列表。
- **风道分支**：改为将风道实体推入 `this.activeTunnels` 列表。

#### 5.1.4 `src/game_phase.js` — 调用集成

- 在回合结束判断处，于 `decayStormCoresEnergy` 之前调用 `mergeStormCores`。
- 在主循环中，于 `updateStormCores` 之后依次调用 `updateActiveCyclones`、`updateActiveStrangles`、`updateActiveTunnels`。

### 5.2 任务 B：飞剑/风属性符文词条变异解锁机制

#### 5.2.1 `src/rune_config.js` — 新增词条

| 词条 ID | 名称 | 符文组合 | effectId | 效果 |
|---|---|---|---|---|
| `runeword_sword_resonance` | 剑意共鸣 | `pierce_1 × 3` | `flying_sword_unlock` | 解锁飞剑变异，变异概率 70%（每级+10%） |
| `runeword_storm_resonance` | 风暴共鸣 | `bounce_1 × 3` | `wind_unlock` | 解锁风属性变异，变异概率 70%（每级+10%） |

#### 5.2.2 `src/config.js` — 关闭默认变异

- `specialMutationMult` 设为 `0`，彻底关闭无词条时的默认变异。变异概率完全由 `activeRunewordEffects` 中的词条控制。

#### 5.2.3 `src/entities.js` — 重构 `handlePegInteraction`

- **变异概率**：改为读取 `game.activeRunewordEffects['flying_sword_unlock']` 或 `['wind_unlock']` 的 `params.mutationChance`。无对应词条时 `chance = 0`，即不发生变异。
- **等级注入**：变异成功时，从词条的 `params.level` 读取并写入 `peg.level`，使高等级词条能直接生成高等级特殊钉子。
- **强化特效**：变异瞬间触发双重爆破 + 冲击波 + 高亮浮动文字 `✨ MUTATION!`。

#### 5.2.4 `src/entities.js` — 强化特殊钉子视觉

- **`drawSwordPeg`**：等级 ≥ 2 时，剑纹变为金色并增加脉冲发光；等级 ≥ 3 时，加绘旋转剑气圆弧。
- **`drawWindPeg`**：等级 ≥ 2 时，增强光晕强度并加绘外圈风刃圆弧。
