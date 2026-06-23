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

## 4. Boss 系统规范

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
| `ignis` | 烈焰之心 | Mini-Boss | 护盾+狂暴，狂暴后护盾翻倍 |
| `glacies` | 冰封山峡 | Mini-Boss | 跳跃+再生，狂暴后跳跃行数+1 |
| `mikro` | 细胞山峡 | Mini-Boss | 分裂+极速，狂暴后分裂概率 100% |
| `devourer` | 噬神者 | Mini-Boss | 吞噬相邻敌人获得护盾层数 |
| `viridis` | 绿色山峡 | 大 Boss | 治疗者，狂暴后治疗范围扩大到全场 |
| `tesla` | 特斯拉山峡 | 大 Boss | 极速+多次行动，狂暴后行动次数再+1 |
| `chimera` | 奇美拉 | 大 Boss | 初始高温，狂暴后温度直接达到阈值 |
| `ouroboros` | 奥罗波罗斯 | 大 Boss | 每 N 回合切换词缀组，狂暴后切换加速 |
