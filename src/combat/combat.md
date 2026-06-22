# 战斗系统规范 (Combat System Architecture)

## 0.3 Combat Arena Bounds (2026-06-21)

Projectile and laser wall logic must use `game.sys_getCombatBounds()` for the left and right walls. The canvas may include decorative side bands that are outside the playable combat arena. Enemy movement, projectile bounce, laser reflection, and aim-guide prediction should all treat `combatGridLeftX` and `combatGridRightX` as the side walls, not `0` and `game.width`.

## 0. Battle Relic Cinematic Timing (2026-06-18)

`relic_runRoundStartHooks()` returns the number of milliseconds needed for round-start relic animations. `phase_finalizeRound()` calls it after `round++`; when the return value is greater than 0, Boss spawning, reward resolving, and the next round banner are delayed until `phase_continueFinalizeRoundAfterRelicHooks()` runs.

Current combat relic presentations:

- `doomsday_timer`: target lock, three staged shockwaves, a red-black countdown readout, clock-face shard particles, and burst particles. It should read as doomsday/countdown rather than lightning. If a strike kills, it can retrigger on another living enemy after a short delay. The retrigger limit starts at 1 and increases by 1 for every 5 round-start main triggers; the returned animation delay must cover the potential chain.
- `corridor_arc`: wall-to-target lightning arcs for enemies near side walls; projectile side-wall hits add purple sparks.
- `mortal_burst`: kill explosions set `_relicCombatCinematicFrames` so the combat end check waits for the blast beat.

New combat relic animations must read `CONFIG.performance.relicCinematicDelayMs`, `relicCinematicSparkCount`, and `relicCinematicBoltCount`, while still respecting the existing effect limits (`shockwaveLimit`, `waveLimit`, `lightningLimit`, and particle limits).

## 0.1 Hit Feedback Labels (2026-06-18)

`combat_getHitFeedbackLabel()` is a visual-only helper used by `combat_damageEnemy()` after `Enemy.takeDamage()` returns. It adds a short floating label near the normal damage number for high-signal outcomes:

- Defense outcomes: `屏障` when a deflection ward absorbs damage, `护盾` when shield charges are actually spent.
- Damage outcomes: `暴击` for focused-fire crits.
- Hit feedback no longer reads a global counter table. `combat_getHitFeedbackLabel()` only emits direct event labels such as shield, barrier, crit, bounce, pierce, and Boss vulnerability progress.
- Projectile outcomes: fallback labels for `弹射` and `穿透` when no higher-priority label applies.
- Boss vulnerability outcomes: `破绽+` when the current hit advances the Boss vulnerability meter, `破绽` when the meter breaks, and `易伤` while the exposed-hit window is being consumed.

The helper must remain side-effect free. It may inspect enemy tags, archetype aliases, projectile config, and the post-hit `damageResult`, but damage formulas stay in the existing damage sections.

## 0.2 Boss Vulnerability Redesign (2026-06-19)

The old static Boss `weakness` field has been replaced by `CONFIG.balance.bossConfigs[*].vulnerability` plus the global `CONFIG.balance.bossVulnerability` tuning block.

- `combat_getBossVulnerabilityProfile()` resolves the active vulnerability attrs, accumulation mode, and round-scaled threshold; Ouroboros uses `rotationIndex` to switch attrs with its affix set.
- `combat_applyBossVulnerability()` runs before `Enemy.takeDamage()` to consume exposed hits and remember whether the hit matched the current vulnerability attrs.
- `combat_updateBossVulnerabilityProgress()` runs after `Enemy.takeDamage()` so `hits` mode counts real damaging hits and `damage` mode uses `damageResult.actualDamage`.
- Breaking the meter before enrage sets `_bossVulnerabilitySuppressedEnrage`, delaying one 50% HP enrage check.
- The mechanic is numeric and label-only; it does not add persistent particles, new blend modes, gradients, or `shadowBlur`.

本文档定义了 `src/combat_system.js` 拆分后的战斗系统模块结构及职责边界。

## 1. 模块拆分与职责

战斗系统已按职责拆分为以下三个核心文件：

### 1.1 `combat_system.js`（核心战斗流程控制）
保留核心的战斗循环控制逻辑，主要包括：
- **战斗回合推进** (`combat_activateSkill`, `combat_updateHitProgress`)
- **弹药队列消耗与发射** (`combat_fireNextShot`, `combat_laser_fire`)
- **持续照射状态机** (`combat_continuousLaser_update`)：照射词条激活时，每 0.5s 重算一次激光
- **风系技能核心逻辑** (`combat_wind_triggerMagicCircle`, `combat_wind_executeCircleEffect`)
- **战斗状态管理**（符文充能状态初始化等）

### 1.2 `src/combat/damage_calc.js`（纯伤害计算与统计）
负责所有与数值计算、伤害评估相关的纯逻辑：
- **DDA 评估** (`combat_calculatePlayerExpectedDamage`)
- **伤害记录与统计汇总** (`combat_recordDamage`, `combat_reportDamage`)
- **闪电链触发与计算** (`combat_lightning_triggerChain`)
- **伤害特效触发计算**（如 `combat_triggerChromaticAberration`）

### 1.3 `src/combat/collision.js`（碰撞检测与物理判定）

负责所有的空间计算与碰撞判定逻辑：

- **敌人移动碰撞检测** (`combat_tryMoveEnemy`)：AABB 碰撞与边界检测。
- **激光射线检测** (`combat_laser_castRay`)：墙壁与护盾敌人的反射面检测。
- **激光穿透判定与折射任务生成** (`combat_laser_processPenetration`)：线段与敌人包围盒的相交判定。已实现穿透衰减机制（Task B2，2026-04-11）：按激光路径顺序排序命中敌人，第 n 个目标（从 0 计）受到的伤害 = 原始伤害 × 0.5^n。已新增折射机制（Task B3，2026-04-13）：击中敌人后独立判定折射概率，触发时消耗 1 层 bounce 属性，返回折射任务列表供主函数队列处理。已重构照射词条行为（2026-04-14，见第 5 节）。

函数签名变更：`combat_laser_processPenetration(p1, p2, recipe, remainLen, bouncesLeft, hitEnemiesSet, currentWidth)` 返回 `{ refractionTasks, bouncesLeft }`。

## 2. 架构约定

1. **Mixin 模式注入**：
   - `damage_calc.js` 导出 `DamageCalc` 对象。
   - `collision.js` 导出 `CollisionSystem` 对象。
   - 这两个对象在 `combat_system.js` 的末尾通过 `Object.assign(combat_system, DamageCalc, CollisionSystem)` 注入，保持对外接口（挂载到 `Game` 实例上）不变。
   - 原有 `combat_system.js` 中的函数定义被替换为委托注释，指明其实际位置。

2. **事件驱动 ([Task 3.2 已完成])**：
   - 战斗系统及拆分出的模块中仍包含部分直接操作 DOM 的代码（如 `document.getElementById`）。
   - 这些代码已被标记为 `// [Task 3.2 已完成]: 改为 EventBus...`。
   - 在后续的 Task 3.2 中，所有 DOM 操作必须改为通过 `eventBus.emit` 派发事件，由 `ui_system.js` 监听并处理，实现业务逻辑与 UI 渲染的彻底解耦。

3. **依赖关系**：
   - 战斗计算模块可依赖 `config.js`（读取配置）、`entities.js`（读取实体类）、`calc_utils.js`（复用数学工具如 `calc_getLineRectIntersection`）。
   - 模块间通信应尽量通过 `Game` 实例（`this`）的状态或 `eventBus` 进行，避免强耦合。

## 3. 激光折射机制详解（Task B3，2026-04-13）

激光折射系统将原来仅用于墙壁/护盾镜面反射的 `bounce` 属性改造为更具战略性的敌间折射机制。

### 3.1 参数配置（`config.js` 中的 `gameplay` 对象）

| 参数名 | 默认値 | 说明 |
|---|---|---|
| `laserRefractionBaseChance` | `0.30` | 折射基础触发概率（30%） |
| `laserRefractionBounceBonus` | `0.05` | 每层 bounce 增加的触发概率（+5%） |
| `laserRefractionMaxChance` | `0.80` | 折射触发概率上限（80%） |
| `laserRefractionRadius` | `150` | 折射搜寻范围半径（px） |
| `laserRefractionDamageDecay` | `0.75` | 每次折射的伤害衰减系数 |
| `laserRefractionWidthDecay` | `0.85` | 每次折射的光线宽度衰减系数 |
| `laserRefractionMaxTotal` | `50` | 单次发射最大折射总次数 |
| `laserRefractionDepthDecay` | `0.65` | 每增加一层折射深度，概率乘以该系数 |

### 3.2 折射概率公式

```
baseChance = min(laserRefractionMaxChance, laserRefractionBaseChance + bouncesLeft × laserRefractionBounceBonus)
P(折射) = baseChance × laserRefractionDepthDecay ^ depth
```

其中 `depth` 为当前折射深度（主射线为 0，每折射一次 +1）。示例：拥有 4 层 bounce、depth=0 时，概率 = min(0.80, 0.50) × 0.65^0 = 50%；depth=1 时概率降为 50% × 0.65 = 32.5%；depth=2 时降为 21.1%，以此类推。

**折射触发位置**：根据 `pierce`（穿透）与 `bounce`（反弹/折射）的大小关系动态决定：

| 条件 | 折射行为 |
|---|---|
| `pierce > bounce` | 穿透主导，**完全不触发折射** |
| `bounce > pierce` | 折射主导，**第一个**命中的敌人即触发折射 |
| `bounce === pierce`（含两者均为 0） | 平衡模式，**最后一个**命中的敌人触发折射 |

### 3.3 折射链处理流程

`combat_laser_fire` 采用 **BFS 队列**而非递归处理折射链，避免栈溢出。整条折射链共享同一个 `hitEnemiesSet`，确保每个敌人在同一激光链中不会被重复折射。每次折射消耗 1 层 `bounce`，光线宽度和伤害逐次衰减。折射光线在视觉上颜色略微偏绿（混入 bounce 属性的绿色），以区分主射线。

### 3.4 与镜面反射的共存

折射和镜面反射（墙壁/护盾）共同消耗 `bounce` 层数。折射在穿透敌人时触发，镜面反射在射线到达墙壁/护盾时触发，两者共享同一个 `bouncesLeft` 计数器。

## 4. 维护指南

- **新增伤害公式**：请在 `damage_calc.js` 中添加，并在 `combat_system.js` 中调用。
- **新增弹道或碰撞逻辑**：请在 `collision.js` 中实现检测逻辑。
- **新增战斗阶段控制**：请在 `combat_system.js` 中添加。
- **调整折射参数**：请修改 `config.js` 中 `gameplay` 对象的 `laserRefraction*` 字段，无需修改战斗逻辑代码。
- **UI 表现修改**：禁止在战斗模块中直接修改 DOM，请抛出 `eventBus` 事件并在 UI 系统中处理。

## 5. 照射词条重构详解（2026-04-14）

照射词条（`runeword_irradiation`）的激光行为已从「一次性穿透射线」完全重构为「持续照射 + 随机折射」模式。

### 5.1 持续照射状态机

**状态变量**（挂载于 `Game` 实例）：

| 变量 | 类型 | 说明 |
|---|---|---|
| `_continuousLaserFiring` | `boolean` | 是否处于持续照射状态 |
| `_continuousLaserState` | `Object\|null` | 持续照射状态机数据（startX/Y、vel、recipe、tickFrames、elapsedFrames、**lastHitEnemy** 等） |

**生命周期**：
1. 玩家发射激光弹药时，若照射词条激活且 `_continuousLaserFiring === false`，则启动状态机。
2. `game_phase.js` 的 combat update 循环每帧调用 `combat_continuousLaser_update(timeScale)`。
3. 每 30 帧（0.5s）重新执行一次 `combat_laser_fire`，刷新伤害计算和视觉。
4. 持续 180 帧（3s）后自动结束，重置所有敌人的 `_irradiationStacks`，延迟 600ms 释放 `isVisualEffectActive`。
5. 每回合开始时（`phase_switchPhase` 进入 combat 阶段）强制清理状态。
6. 敌人回合开始时（`phase_enemy_startLogic`）清零所有敌人的 `_irradiationStacks`，防止持续照射被中断时层数残留。

### 5.2 照射模式下的碰撞行为（`collision.js`）

当 `activeRunewordEffects['irradiation']` 激活时，`combat_laser_processPenetration` 进入照射模式：

| 特性 | 普通模式 | 照射模式 |
|---|---|---|
| 穿透 | 命中所有路径上的敌人，第 n 个受 0.5^n 衰减 | **不穿透**：仅命中第一个敌人 |
| 穿透层数（pierce）效果 | 增加射程（每层 +250px） | **伤害加深**：每层 pierce +1% 伤害 |
| 折射 | 概率触发，消耗 bounce 层数 | **强制随机折射**：命中后必定在半径内随机选取目标折射，不消耗 bounce |
| 折射颜色 | 偏绿（bounce 属性色） | 金色（`#fbbf24`，照射词条色） |
| 累积伤害叠加 | 无 | 每次照射同一敌人 `_irradiationStacks++`，额外伤害 = 层数 × damageAmp × 基础伤害 |
| 目标切换重置 | 无 | 命中敌人与 `lastHitEnemy` 不同时，自动重置旧敌人的 `_irradiationStacks = 0`，并更新 `lastHitEnemy` |

## 6. 雷霆散射词条防循环修复（2026-04-15）

### 6.1 问题描述

`thunder_scatter`（雷霆散射）词条在 `combat_lightning_triggerChain` 中的实现存在无限循环风险：

- 原实现：额外链调用 `combat_lightning_triggerChain(selected, nextDmg, extraHistory, level, shotId)` 时，该函数内部也会读取 `thunderScatterEffect` 并再次触发额外链。
- 虽然每次有 50% 概率，但理论上可以无限递归，导致性能问题。

### 6.2 修复方案

为 `combat_lightning_triggerChain` 函数新增 `isExtraChain` 参数（默认值 `false`）：

```javascript
combat_lightning_triggerChain(sourceEnemy, dmg, history, level = 1, shotId = null, chainChanceBonus = 0, isExtraChain = false, chainGuaranteeState = null)
```

- 主链调用（递归）：`isExtraChain = false`（默认），正常触发 thunder_scatter。
- 额外链调用：传入 `isExtraChain = true`，跳过 thunder_scatter 触发逻辑。
- 雷暴线圈等遗物可通过 `chainGuaranteeState._guaranteedLightningChains` 传入保底次数；每次闪电链概率判定成功消耗 1 次保底，使前 N 次弹射概率视为 100%，但不增加 `lightning` 层数。

### 6.3 关键约束

- 额外链继承原链的 `level`（闪电属性层数）和目标选择逻辑（距离加权随机）。
- 额外链使用独立的 `[...history]` 副本，不影响主链的历史记录。
- 额外链触发概率保持 50%（`Math.random() < 0.5`），在合理范围内。
- `isExtraChain` 参数仅影响 thunder_scatter 的触发，不影响其他词条（thunderstorm、elemental_fusion）。
## 2026-06-22 Boss / Clear Count Contract

- Combat clear checks use the arena-wall AABB helper (`calc_isEnemyInsideCombatWalls()` via `phase_isEnemyClearable()`), not `pos.y > 0` row shortcuts. Bosses inside the walls count; ordinary enemies above the top wall do not.
- Boss enrage, enrage rune-drop, and vulnerability-delayed enrage all read `CONFIG.balance.bossEnrageHpRatio` (`0.2`).
- Pierce follow-up hits now create a light impact pulse and short feedback text from `combat_damageEnemy()`; the extra VFX is budgeted by existing shockwave/spark limits.
- `greedy_wheel` still converts `multicast` into flat damage in `combat_fireNextShot()`, then marks the queued shot with `_greedyWheelEnabled` and `_greedyWheelChance`.
- The repeat roll now lives in `game_phase.js` `burstQueue` handling: each greedy-fired bullet schedules a prelude, rolls the same probability, fires on success, and schedules the next roll after that bullet fires. `_isGreedyReFire` is no longer part of the contract.
- Visual feedback uses capped `GreedyWheelEffect` instances via `spawn_createGreedyWheelEffect()`; failure also triggers a light screen shake.
