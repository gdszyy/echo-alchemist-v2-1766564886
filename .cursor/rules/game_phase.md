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
### 2.1 命运抉择阶段 (Selection Phase)
- **职责**: 玩家在回合开始前选择初始属性、遗物或符文。
- **入口**: 回合初始化完成，UI 呈现选择卡片。
- **出口**: 玩家做出选择并确认，触发转场动画进入研磨阶段。

### 2.2 研磨阶段 (Gathering Phase)
- **职责**: 核心打砖块玩法，发射弹珠收集属性，填充弹药队列。
- **入口**: 命运抉择结束，钉板生成完毕，玩家获得发射次数。
- **出口**: 玩家耗尽发射次数且所有弹珠结算完毕，进入战斗阶段。

### 2.3 战斗阶段 (Combat Phase)
- **职责**: 使用收集到的弹药队列攻击敌人，进行回合制结算。
- **入口**: 研磨阶段结束，弹药队列生成，敌人刷新。
- **出口**: 
  - 胜利: 敌人血量清零，触发掉落结算，进入下一回合的命运抉择阶段。
  - 失败: 玩家防线被突破，游戏结束 (Game Over)。

## 3. 阶段转换规范
- **清理与重置**: 每次阶段切换（`phase_switchPhase`）时，必须彻底清理上一个阶段的残留状态（如清空粒子特效容器、重置物理引擎状态）。
- **UI 同步**: 阶段切换必须同步触发相应的 UI 更新事件，确保界面呼现与内部状态一致。

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
- **Round 5**: 固定触发第一个 Mini-Boss
- **Round 9-11**: 每回合 33% 概率随机触发 Mini-Boss
- **Round 15**: 固定触发第一个大 Boss
- **Round 20+**: 每 5 回合循环触发大 Boss

### 4.2 Boss 生成流程
1. `phase_finalizeRound` 在 `round++` 之前检测下一回合是否为 Boss 回合
2. 若是 Boss 回合，将生成信息存入 `this._pendingBossSpawn`
3. `round++` 执行后，检查 `_pendingBossSpawn` 并调用 `spawn_spawnBoss`
4. Boss 回合不生成普通敌人行

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

## 6. Boss 遗物与固定回合遗物事件的冲突处理

### 6.1 问题描述
当 Boss 被击杀的回合数恰好是 `relicRoundInterval`（默认为 3）的倍数时（例如：第 5 回合击杀 Boss，`phase_finalizeRound` 后 `round++` 变为 6，而 `6 % 3 == 0`），会同时触发两个遗物弹窗：

1. `combat_system.js` 中 Boss 击杀后的 `setTimeout(() => this.ui_showRelicSelection(), 500)`；
2. `phase_finalizeRound` 中固定回合遗物事件的 `setTimeout(() => this.ui_showRelicSelection(), 500)`。

第二个 `ui_showRelicSelection` 会覆盖 `stateBeforeRelic` 为 `'relic_event'`，导致玩家选择或跳过遗物后，`ui_closeRelicSelection` 走入 `else` 分支直接调用 `sys_initSelectionPhase()`，玩家看起来就像“还没来得及领取遗物就跳到下一个阶段”。

### 6.2 处理方案：串行触发（两个都给）

**设计决策**：Boss 遗物和固定回合遗物事件均不丢弃，改为串行弹出：玩家领完 Boss 遗物后，再接着弹出固定遗物事件。

**涉及标志位**：

| 标志位 | 设置时机 | 清除时机 |
|---|---|---|
| `_pendingBossRelic` | `combat_system.js` Boss 击杀时 | `shop.js` `ui_closeRelicSelection` 关闭时 |
| `_pendingRelicEvent` | `game_phase.js` `phase_finalizeRound` 检测到冲突时 | `shop.js` `ui_closeRelicSelection` 串行弹出时 |

**执行流程**：
1. Boss 击杀 → `_pendingBossRelic = true` + `setTimeout(ui_showRelicSelection, 500)`
2. `phase_finalizeRound` 检测到 `round % 3 == 0` 且 `_pendingBossRelic` 为真 → `_pendingRelicEvent = true`（不立即弹窗）
3. Boss 遗物弹窗弹出，玩家选择/跳过
4. `ui_closeRelicSelection` 检测到 `hadPendingBossRelic && _pendingRelicEvent` → 串行弹出固定遗物事件
5. 玩家再次选择/跳过 → `ui_closeRelicSelection` 走入正常 `else` 分支 → `sys_initSelectionPhase()`

**初始化**：`sys_resetGame` 中同时重置两个标志位为 `false`。

## 7. 难度平衡系统 (Difficulty Balance System)
### 5.1 战后高压因子 (Post-Boss Surge)
- **触发时机**: 击杀 Boss 时（监听 `boss:defeated` 事件）
- **机制**: 
  - Boss 击杀后，激活战后高压因子 `postBossMultiplier = 1.3`，持续 `postBossSurgeRoundsLeft = 3` 回合。
  - 在高压期间，普通敌人的基础血量 `finalBaseHP` 会乘以 `postBossMultiplier`。
  - 在高压期间，双词缀精英怪的生成概率临时提升 25%。
- **衰减逻辑**: 
  - 在 `phase_finalizeRound` 中，每回合结束时 `postBossSurgeRoundsLeft` 减 1。
  - `postBossMultiplier` 每次减 0.1，直到恢复至 1.0。

### 5.2 Boss 底线怜悯掉落 (Pity Drop)
- **触发时机**: 敌人越过失败线时（`input_checkDefeat` 检测到越线）
- **机制**: 
  - 如果越线的敌人是 Boss（`e.type === 'boss'`），触发 `_triggerPityDrop` 怜悯掉落。
  - 系统分析玩家近期的伤害历史，找出主属性（占比最高的属性）。
  - 根据 `COUNTER_MAP` 找到该主属性的克制属性。
  - 调用 `loot_calcRuneDrop` 强制生成一个克制属性的 1 级符文，掉落在 Boss 越线位置。
  - 触发 UI 提示："💔 怜悯掉落：获得克制符文"。

### 5.3 掉落权重边际递减 (Marginal Decay)
- **触发时机**: 计算符文掉落权重时（`loot_system.js` 中的 `_calcBuildVector`）
- **机制**: 
  - 统计玩家近期伤害占比 `buildVector` 时，如果某一属性的伤害占比超过阈值（默认 60%），则对超出部分进行衰减。
  - 衰减系数为 0.5，即超出部分减半。
  - 衰减后重新归一化 `buildVector`，防止玩家过度依赖单一属性导致掉落过于单一。
