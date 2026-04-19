---
description: "阶段转换逻辑与状态机规范"
globs: ["src/game_phase.js"]
---
# 游戏阶段规范 (Game Phase)

## 1. 状态机概述
游戏主流程围绕三个核心阶段进行循环：命运抉择 (Selection) → 研磨 (Gathering) → 战斗 (Combat)。
- 阶段流转由 `game_phase.js` 统一管理。
- 严禁跨阶段直接调用生命周期方法，必须通过标准状态机接口切换。

## 2. 各阶段职责与出入口条件

### 2.0 研磨阶段点击发射规范（防坑）

**`phase_handleInputStart` 中的点击区域判断**：
- 研磨阶段发射弹珠的点击区域阈值为 `pos.y < this.height * 0.85`，覆盖屏幕上方 85% 的区域。
- **禁止将此阈值降低至 0.5 以下**：钉盘分布在屏幕 20%~70% 高度，过小的阈值会导致点击钉盘中下部区域时被错误路由到"倾斜模式"，弹珠无法发射。
- 底部手柄区域（`height - 40 ± 40px`）已在 `game_system.js` 的 `input_handleInputStart` 中提前拦截，`phase_handleInputStart` 无需重复处理。

### 2.1 命运抗择阶段 (Selection Phase)
- **职责**: 玩家在回合开始前处理 round-start resolver 结算后的**特殊命运时刻**（混沌精华 / 纯净精华 / 遗物）。
- **[tsk-f35c6d10] 普通命运选择已取消**：`sys_startRoundStartResolver()` 队列为空时，**不再**进入普通弹珠选择（`sys_initSelectionPhase()`），改为调用 `sys_showRoundStartBanner()` 直接进入研磨阶段。
- **[开局命运选择] 已恢复**：`sys_initGameStart()` 在队列遗物奖励后，额外队列一个 `chaos_essence`（`source: 'run_start'`）奖励。遗物选完后， resolver 继续处理该奖励，触发标准 3 枚弹珠命运选择界面，作为开局弹珠配置入口。开局流程变为：遗物选择 → 命运选择（3 枚弹珠）→ 研磨阶段。
- **入口**: `sys_startRoundStartResolver()` 会先消费 `pendingRoundStartRewards`；若命中 `relic`，进入遗物事件；若命中 `chaos_essence` 或 `pure_essence`，则先写入 `pendingSelectionMode` 再调用 `sys_initSelectionPhase()` 呈现对应的命运时刻界面。
- **[tsk-668f3dba] 替换子弹阶段**：`sys_initSelectionPhase()` 在 `chaos_essence` 或 `pure_essence` 模式且 `ammoQueue` 非空时，**先**调用 `sys_initReplaceAmmoPhase()` 进入「替换当前子弹」阶段；玩家确认或跳过后再进入原有命运选择流程。`ammoQueue` 为空时自动跳过该阶段。
  - `replaceAmmoContext`：替换阶段上下文，包含 `active`（是否处于替换阶段）、`selectedIndex`（选中的 ammoQueue 索引，-1 表示未选）、`fateMomentMode`（来源命运时刻类型）。
  - 替换确认：`sys_confirmReplaceAmmo()` 记录替换目标，进入命运选择；`ui_confirmSelection()` 确认时将命运选择产出的第一枚弹珠替换 `ammoQueue[selectedIndex]`。
  - 跳过：`sys_skipReplaceAmmo()` 将 `selectedIndex` 置为 -1 并进入命运选择，不执行替换。
- **模式分支**: `chaos_essence` 模式沿用标准 3 选流程，但 UI 需显式标记为“混沌精华”；`pure_essence` 模式要求只选择 `1` 枚弹珠，并在确认前完成 1 个合法符文注入。
- **出口**: 玩家做出选择并确认，触发转场动画进入研磨阶段。纯净精华模式下，确认时必须先完成合法性校验，把注入结果写回 `MarbleDefinition.collected`，并为对应 `marble.type` 写入 `doubleAssimilationBoostRounds`。

### 2.5 回合开始提示与充能特效 (Round Start Banner)
- **触发时机**: `sys_startRoundStartResolver()` 的 `pendingRoundStartRewards` 队列为空时，调用 `sys_showRoundStartBanner()`。
- **实现**: 先调用 `phase_switchPhase('gathering')` 切换背景，然后显示 `#round-start-banner` 全屏大字提示（「第 X 回合開始」），持续约 1.5 秒后自动调用 `phase_startGatheringPhase()` 完成研磨阶段初始化。
- **充能特效**: 同时为 `#pc-left-sidebar` 添加 CSS 动画类 `.ammo-panel-charging`（high/medium 档：边框光流扫过）或 `.ammo-panel-charging-simple`（low 档：简单淡入淡出）。
- **性能门控**: 特效等级由 `CONFIG.performance[perfQualityLevel].roundStartBannerGlow` 控制（high/medium: `true`，low: `false`）。
- **DOM 元素**: `#round-start-banner`（全屏覆盖层，z-index: 9500）、`#round-start-banner-text`（大字文本）。
- **CSS 类**: `.round-banner-hide`（隐藏）、`.round-banner-show`（显示）、`.round-banner-glow`（光晕动画，需 high/medium 档）。

### 2.2 研磨阶段 (Gathering Phase)
- **职责**: 核心打砖块玩法，发射弹珠收集属性，填充弹药队列。
- **入口**: 命运抉择结束，钉板生成完毕，玩家获得发射次数。
- **出口**: 玩家耗尽发射次数且所有弹珠结算完毕，进入战斗阶段。

### 2.3 战斗阶段 (Combat Phase)
- **职责**: 使用收集到的弹药队列攻击敌人，进行回合制结算。
- **入口**: 研磨阶段结束，弹药队列生成，敌人刷新。
- **出口**: 
  - 胜利: 敌人血量清零，触发掉落结算，`phase_finalizeRound()` 在 `ammoQueue` 为空时自动调用 `sys_saveRunState()` 将局内全量状态写入 `localStorage`，然后进入下一回合的命运抉择阶段。
  - 失败: 玩家防线被突破，调用 `sys_clearRunState()` 清除局内存档，游戏结束 (Game Over)。

### 2.4 局内存档与刷新恢复
- **存档时机**: `phase_finalizeRound()` 末尾，`round++` 之后、`sys_startRoundStartResolver()` 之前；此外，进入命运时刻阶段、切换弹珠选择、绑定纯净精华符文时，也应即时调用 `sys_saveRunState()`，避免刷新后丢失当前选择与注入上下文。
- **存档内容**: round、score、enemies（含 Vec2 坐标）、pegs（type/level/frozenTurns）、ownedRelics、runeInventory、runeGrid、unlockedWeights、guaranteedNextRound、`pendingRoundStartRewards`、`pendingSelectionMode`、`selectionMode`、`selectionRequiredCount`、`selectionInjectedRune`、`selectionPreviewState`、`relicOverlayReturnState`、`fateMomentContext`、`replaceAmmoContext`（[tsk-668f3dba] 替换子弹阶段上下文）、`doubleAssimilationBoostRounds`、Boss 系统字段、难度字段、钉盘形态、技能、统计数据等。
- **恢复入口**: Meta 页面「繼續上次游戲」按钮（`#meta-continue-btn`），调用 `meta_continueRun()`。
- **恢复流程**: `sys_resetGame()` + `meta_applyUpgrades()` → 注入存档状态 → `phase_gathering_initPachinko(true)` 重建钉盘 → `sys_startRoundStartResolver()` 先结算待处理遗物/精华，再决定是否进入选牌阶段。
- **清档时机**: 游戏结束（`_gameover_triggerPhase`）或新开一局（`meta_startRun`）时自动清除。

## 3. 阶段转换规范
- **清理与重置**: 每次阶段切换（`phase_switchPhase`）时，必须彻底清理上一个阶段的残留状态（如清空粒子特效容器、重置物理引擎状态）。
- **UI 同步**: 阶段切换必须同步触发相应的 UI 更新事件，确保界面展现与内部状态一致。

## 3.1 暂停机制 (Pause)
- 暂停**不是阶段切换**，而是以 DOM-only overlay 方式叠加在当前阶段上方。
- 暂停由 `ui_openPause()` 触发，设置 `this.isPaused = true`，`sys_loop` 将跳过所有物理更新。
- 恢复由 `ui_closePause()` 触发，设置 `this.isPaused = false`。
- 仅允许在 `gathering`、`combat`、`training` 阶段暂停；其他阶段调用 `ui_openPause()` 无效。
- `sys_resetGame()` 中会自动重置 `isPaused = false`。

## 4. 敌人回合逻辑与温度结算
### 4.1 扫描波与行动
- 敌人回合通过扫描波自下而上触发。
- 只有未被冰冻（`isFrozenCurrentTurn === false`）且存活的敌人才能执行行动。

### 4.2 温度结算与冰冻判定
- 当敌人温度 `< 0` 时，进行冰冻判定：
  - `temp <= -100`：强制冰冻（100%）。
  - `-100 < temp <= -50`：根据温度概率冰冻（0% ~ 100% 线性增加）。
- **冰冻衰减机制**：若判定被冰冻，则 `e.isFrozenCurrentTurn = true` 且 `e.frozenCount` 增加 1。该计数用于在 `Enemy.applyTemp` 中衰减后续的降温效果（系数为 `0.9 ^ frozenCount`）。
- **温度回暖**：每回合结算时，负温度减半（`Math.ceil(e.temp / 2)`），正温度自然衰减或造成燃烧伤害。

## 5. Boss 系统规范

### 4.1 Boss 回合触发规则
- **第一个 Boss**：固定在 Round 5
- **后续 Boss**：基础间隔为 7-9 回合（均匀随机），并根据玩家击杀上个 Boss 的速度动态延期
- **延期规则**：快速击杀（≤ 2 回合）延期 2 回合；中速（3 回合）延期 1 回合；慢速（≥ 4 回合）不延期
- **延期限制**：第三个 Boss 之后（已生成数量 >= 3）不再延期，固定使用 7-9 回合基础间隔
- **Boss 类型**：第 1-3 个为 Mini-Boss，第 4 个起为大 Boss

### 4.2 Boss 生成流程
1. `phase_finalizeRound` 在 `round++` 之前检测下一回合是否为 Boss 回合（与 `_nextBossRound` 匹配）
2. 若是 Boss 回合，将生成信息存入 `this._pendingBossSpawn`
3. `round++` 执行后，检查 `_pendingBossSpawn` 并调用 `spawn_spawnBoss`
4. Boss 生成后记录 `_lastBossSpawnRound`（生成回合）和 `_bossSpawnCount`（已生成数量）
5. Boss 回合不生成普通敌人行
6. **选择性清场**：`spawn_spawnBoss` 出场时，仅移除与 Boss 最终落点区域（AABB）发生重叠的敌人，保留其余敌人。这确保了玩家前期战斗对场面的影响（如冻结、血量耗损）仍有意义。Boss 占据区域：水平中心为 `centerX`，宽 `bossW = enemyWidth * 3`，高 `bossH = enemyHeight * 2`，垂直中心为 `spawnY`。

**Boss 调度相关状态变量**：
| 变量名 | 说明 | 初始化位置 |
|---|---|---|
| `_nextBossRound` | 下一个 Boss 预定出现的回合数 | `sys_resetGame` 中置 null，首次调用 `spawn_checkBossRoundFor` 时自动初始化 |
| `_lastBossSpawnRound` | 上一个 Boss 生成时的回合数 | `sys_resetGame` 中置 null，在 Boss 生成后由 `game_phase.js` 设置 |
| `_bossSpawnCount` | 本局已生成的 Boss 数量 | `sys_resetGame` 中置 0，在 Boss 生成后由 `game_phase.js` 自增 |

### 4.2.1 Boss 出场演出时机（重要）

**问题背景**：原来 `spawn_spawnBoss()` 在生成 Boss 时立即发射 `boss:spawned` 事件并设置 `entranceTimer = 90`，导致全部演出在研磨阶段就播放完毕，进入战斗阶段时完全看不到任何演出。

**修复方案**：引入 `_pendingEntrance` 标志位，将演出触发时机延迟到进入战斗阶段时。

**实现细节**：
- `spawn_spawnBoss()`：设置 `boss.entranceTimer = 0`，`boss._pendingEntrance = true`，不发射事件和 showToast
- `entities/enemy.js` `update()`：当 `_pendingEntrance === true` 时，将 Boss 保持在 `_entranceStartY`（屏幕外）不移动
- `phase_startCombatPhase()`：检测到 `_pendingEntrance` 后，设置 `entranceTimer = 90`、清除标志、延迟 100ms 发射 `boss:spawned` 事件和 showToast
- `phase_combat_update()` 中活跃敌人计数：将 `_pendingEntrance` 状态的 Boss 也计入活跃敌人，防止误判完美清场

### 4.3 Boss 阶段变化
- **狂暴阶段**: Boss HP < 50% 时自动触发，通过 `combat_triggerBossEnrage` 处理
- 狂暴状态存储在 `boss.berserked` 属性中，防止重复触发
- 狂暴触发后通过 EventBus 广播 `boss:phase_change` 事件

### 4.4 Boss 事件类型
| 事件名 | 触发时机 | 数据字段 |
|---|---|---|
| `boss:spawned` | Boss 生成时 | `boss`, `bossId`, `bossName`, `isBigBoss`, `round` |
| `boss:phase_change` | Boss 狂暴时 | `boss`, `bossId`, `bossName`, `phase`, `round` |
| `boss:defeated` | Boss 被击杀时 | `boss`, `bossId`, `bossName`, `round` |
| `boss:rotation` | 奥罗波罗斯词缀轮转时 | `boss`, `newAffixes`, `rotationIndex` |

### 4.5 8 个 Boss 特性摘要
| Boss ID | 名称 | 类型 | 核心特性 |
|---|---|---|---|
| `ignis` | 烈焰之心 | Mini-Boss | 护盾+狂暴，狂暴后护盾翻倍，每回合温度急剧上升并对周围敌人造成火焰溅射伤害 |
| `glacies` | 冰封山峡 | Mini-Boss | 跳跃+再生，狂暴后跳跃行数+1，且落地冻结周围 Peg 2 回合 |
| `mikro` | 细胞山峡 | Mini-Boss | 分裂+极速，狂暴后分裂概率 100% |
| `devourer` | 噬神者 | Mini-Boss | 吞噬相邻敌人获得护盾层数 |
| `viridis` | 绿色山峡 | 大 Boss | 治疗者，狂暴后治疗范围扩大到全场 |
| `tesla` | 特斯拉山峡 | 大 Boss | 极速+多次行动，狂暴后行动次数再+1 |
| `chimera` | 奇美拉 | 大 Boss | 初始高温，狂暴后温度直接达到阈值 |
| `ouroboros` | 奥罗波罗斯 | 大 Boss | 每 N 回合切换词缀组，狂暴后切换加速 |

## 6. Boss 遗物与 round-start 延迟奖励处理

**当前设计**：Boss 击杀后仍只掉落符文；固定回合遗物事件已移除。非 Boss 敌人可以在死亡时登记 `relic`、`chaos_essence` 或 `pure_essence` 到 `pendingRoundStartRewards`，并在下一回合开始由 `sys_startRoundStartResolver()` 统一结算。

- `phase_finalizeRound()` 不再计算 `isRelicRound`，只负责存档并启动 round-start resolver。
- `sys_initGameStart()` 的首个遗物也通过 `pendingRoundStartRewards` 进入统一流程，不再直接调用 `ui_showRelicSelection()`。
- `ui_closeRelicSelection()` 在 `resumeTarget === 'round_start_resolver'` 时必须回到 `sys_continueRoundStartResolver()`，而不是默认进入 `selection`/`gathering`。
- 若遗物 overlay 是从 `selection` 阶段中途打开，则关闭时必须按 `relicOverlayReturnState` 恢复原有命运抉择界面，并执行 `ui_refreshSelectionModeUI()`，禁止重新跑 `sys_initSelectionPhase()` 覆盖特殊选择态。
- 命运时刻一旦由 resolver 触发，就应写入 `fateMomentContext`，并与 `selectionPreviewState` / `relicOverlayReturnState` 一起进入存档；只有当玩家确认选择并进入研磨阶段后，才允许清空这些上下文字段。
- `_pendingBossRelic` 和 `_pendingRelicEvent` 仅作为旧存档兼容字段保留；加载旧存档时应迁移为 `pendingRoundStartRewards` 中的 `relic` 条目。

## 7. 清屏奖励规则 (Full-Clear Bonus)

**规则描述**：若玩家在上一回合战斗阶段结束时完成了全场清屏（`activeEnemies.length === 0`），则本回合普通敌人行生成数量至少为 3 行。

**实现机制**：
- **标志位**：`this._prevRoundCleared`（布尔型）
  - 在 `phase_finalizeRound` 结尾将 `clearedThisRound` 写入该标志位。
  - 在 `sys_resetGame` 中初始化为 `false`。
- **应用时机**：在 `phase_finalizeRound` 的普通敌人行生成逻辑中，若 `this._prevRoundCleared === true` 且当前计算得到的 `spawnCount < 3`，则强制将 `spawnCount` 提升至 3。
- **与 Boss 回合的关系**：该规则仅在普通回合（非 Boss 回合）下生效，Boss 回合不生成普通敌人行，不受此规则影响。

## 7.1 命运时刻相关回合衰减约束
- `phase_finalizeRound()` 结束时除了旧的 `assimilationBoostRounds` 外，还必须同步递减 `doubleAssimilationBoostRounds`。
- 只要任一同化增益字段对某个 `marbleType` 仍大于 0，该类型在下一轮实体同化判定中都应被视为处于 `x2` 模式。
- 纯净精华不是持续 Buff；`pendingSelectionMode` 在 `sys_initSelectionPhase()` 被消费后应立即清空，避免多回合串味。
- 纯净精华确认后必须把 `doubleAssimilationBoostRounds[marble.type]` 至少写为 `1`（仅覆盖当前命运时刻产出的这次研磨会话；若已有更高层数则保留更高值），并由 `phase_finalizeRound()` 在回合结束时统一递减，禁止只改 UI 文案而不落实际倍率。

## 8. 难度平衡系统 (Difficulty Balance System)
### 8.1 战后高压因子 (Post-Boss Surge)
- **触发时机**: 击杀 Boss 时（监听 `boss:defeated` 事件）
- **机制**: 
  - Boss 击杀后，激活战后高压因子 `postBossMultiplier = 1.3`，持续 `postBossSurgeRoundsLeft = 3` 回合。
  - 在高压期间，普通敌人的基础血量 `finalBaseHP` 会乘以 `postBossMultiplier`。
  - 在高压期间，双词缀精英怪的生成概率临时提升 25%。
- **衰减逻辑**: 
  - 在 `phase_finalizeRound` 中，每回合结束时 `postBossSurgeRoundsLeft` 减 1。
  - `postBossMultiplier` 每次减 0.1，直到恢复至 1.0。

### 8.2 Boss 底线怜悯掉落 (Pity Drop)
- **触发时机**: 敌人越过失败线时（`input_checkDefeat` 检测到越线）
- **机制**: 
  - 如果越线的敌人是 Boss（`e.type === 'boss'`），触发 `_triggerPityDrop` 怜悯掉落。
  - 系统分析玩家近期的伤害历史，找出主属性（占比最高的属性）。
  - 根据 `COUNTER_MAP` 找到该主属性的克制属性。
  - 调用 `loot_calcRuneDrop` 强制生成一个克制属性的 1 级符文，掉落在 Boss 越线位置。
  - 触发 UI 提示："💔 怜悯掉落：获得克制符文"。

### 8.3 掉落权重边际递减 (Marginal Decay)
- **触发时机**: 计算符文掉落权重时（`loot_system.js` 中的 `_calcBuildVector`）
- **机制**: 
  - 统计玩家近期伤害占比 `buildVector` 时，如果某一属性的伤害占比超过阈值（默认 60%），则对超出部分进行衰减。
  - 衰减系数为 0.5，即超出部分减半。
  - 衰减后重新归一化 `buildVector`，防止玩家过度依赖单一属性导致掉落过于单一。
