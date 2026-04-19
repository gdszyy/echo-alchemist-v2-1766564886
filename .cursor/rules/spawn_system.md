# 生成系统规范 (Spawn System)

> **数据来源**：`src/spawn_system.js` → `spawn_spawnEnemyRowAt()`
> **用途**：记录导演系统（The Director）所有阵型模板的设计意图、触发条件和实现细节。
> **最后更新**：Task C.2（战后高压因子联动：BOSS_DEFEATED 事件 → postBossRoundsLeft → 双词缀精英概率提升）

## 1. 导演系统概述

导演系统（The Director）在每次 `spawn_spawnEnemyRowAt()` 调用时，以一定概率生成精英小队，提升游戏难度并引导玩家学习特定战术。

| 参数 | 值 | 说明 |
|---|---|---|
| 触发概率 | `min(0.35, 0.15 + round × 0.01)` | 随回合数线性增长，上限 35% |
| 选型机制 | `candidates` 数组随机选一 | 满足条件的阵型均进入候选池 |
| 实现位置 | `spawn_spawnEnemyRowAt` → `@section:spawn_enemy_type_select` (L231) | |

## 2. 阵型模板总览

| 阵型 ID | 名称 | 最早回合 | 触发条件 | 教学目标 |
|---|---|---|---|---|
| `phalanx` | 方阵 | Round 6 | 通用 | 护盾 + 治愈协同，引导穿透/火焰 |
| `blitz` | 闪击 | Round 10 | 通用 | 极速 + 跳跃机动，引导冰霜控制 |
| `berserk_pack` | 狂暴群 | Round 12 | 玩家有火焰属性 | 高温狂暴，引导冰霜降温 |
| `jumper_pack` | 跳跃群 | Round 8 | 玩家有冰霜属性 | 跳跃阻挡，引导穿透精准 |
| `swarm_core` | 增殖核心 | Round 12 | 通用（15% 随机） | AOE 清场后集火核心 |
| `food_chain` | 吞噬链 | Round 12 | 通用（15% 随机） | 倒计时压力，在 devour 吞噬前打破阵型 |

## 3. 阵型模板详解

### 3.1 phalanx（方阵）

| 属性 | 值 |
|---|---|
| 组成 | 1 个 shield 高血量（1.4x）+ 1 个 healer 低血量（0.8x） |
| 列布局 | 相邻两列（随机起始列） |
| 克制方式 | pierce（穿透）无视护盾；pyro（火焰）熔化护盾；lightning（闪电）连锁打断治愈 |

### 3.2 blitz（闪击）

| 属性 | 值 |
|---|---|
| 组成 | 1 个 haste 低血量（0.6x）+ 1 个 jump 低血量（0.6x） |
| 列布局 | 间隔 2 列（随机起始列） |
| 克制方式 | cryo（冰霜）冻结阻止行动 |

### 3.3 berserk_pack（狂暴群）

| 属性 | 值 |
|---|---|
| 组成 | 1 个 berserk 中血量（1.2x） |
| 触发条件 | 玩家弹珠队列前 3 个含 pyro 属性 |
| 克制方式 | cryo（冰霜）降温阻止狂暴 |

### 3.4 jumper_pack（跳跃群）

| 属性 | 值 |
|---|---|
| 组成 | 1 个 jump 低血量（0.8x） |
| 触发条件 | 玩家弹珠队列前 3 个含 cryo 属性 |
| 克制方式 | pierce（穿透）精准打击 |

### 3.5 swarm_core（增殖核心）[Task B.2 新增]

| 属性 | 值 |
|---|---|
| 组成 | 1 个 clone 高血量（1.8x）核心 + 周围 3 个普通低血量（0.4x）护卫 |
| 列布局 | 核心随机列，护卫分布在核心 ±1、±2 列（优先填满） |
| 触发条件 | round >= 12，额外 15% 随机概率进入候选池 |
| 教学目标 | 引导玩家优先 AOE 清场周围护卫，再集火 clone 核心（防止 clone 分裂扩散） |
| 克制方式 | lightning（闪电链）连锁清场；scatter（散射）范围覆盖；bounce（弹跳）多目标 |
| 实现位置 | `spawn_spawnEnemyRowAt` → `else if (squadType === 'swarm_core')` |

**设计注意**：clone 词缀在回合开始有 50% 概率分裂，受击有 20% 概率分裂。若不优先清场，护卫会迅速填满战场，核心的分裂体也会继承 clone 词缀，造成雪崩效应。

### 3.6 food_chain（吞噬链）[Task B.2 新增]

| 属性 | 值 |
|---|---|
| 组成 | 1 个 devour 高血量（2.0x）+ 前排 2 个 shield/regen 低血量（0.5x） |
| 列布局 | devour 随机列，shield（0.5x）在 devour -1 列，regen（0.5x）在 devour +1 列（依次尝试 ±1、±2） |
| 触发条件 | round >= 12，额外 15% 随机概率进入候选池 |
| 教学目标 | devour 每回合行动时吞噬相邻友军，继承其血量与词缀。玩家必须在 devour 吞噬前排之前打破阵型，否则 devour 会越来越强 |
| 克制方式 | bounce（弹跳）多次弹射快速消耗；laser（激光）精准击杀 devour |
| 实现位置 | `spawn_spawnEnemyRowAt` → `else if (squadType === 'food_chain')` |

**设计注意**：前排 shield 有减伤 50% 效果，regen 每回合回血 20% 最大血量。玩家需要在 devour 行动前快速击破前排，否则 devour 吞噬后会继承 shield/regen 词缀，变得极难击杀。

## 4. addPreset 辅助函数

```javascript
const addPreset = (col, hpMult, forceAffixes) => {
    if (col >= 0 && col < CONFIG.gameplay.enemyCols && !occupiedCols[col]) {
        pendingSpawns.push({ col, hp: Math.floor(baseHP * hpMult), affixes: forceAffixes });
        occupiedCols[col] = true; // 导演占座
    }
};
```

- `col`：列索引（0-based）
- `hpMult`：血量倍率（相对于 `baseHP`）
- `forceAffixes`：强制词缀数组（空数组 `[]` 表示无词缀）

## 5. 修改规范

- 新增阵型时，必须在 `@section:spawn_enemy_type_select` 区域的 `candidates.push()` 段添加触发条件
- 阵型实例化逻辑必须在 `if-else` 链末尾追加，不得修改现有阵型逻辑
- 修改后必须运行 `code-indexer` 单文件更新索引
- 必须在本文档中同步更新阵型说明

## 6. 战后高压因子联动机制（Task C.2）

### 6.1 机制概述

Boss 被击杀后，游戏进入**战后高压期**，持续 3 个回合。在此期间，`spawn_generateAffixes` 中双词缀精英怪的出现概率临时提升 **25%**，增加战斗压力，形成 Boss 击杀后的紧张感。

### 6.2 数据流

```
BOSS_DEFEATED 事件触发
    ↓
core.js: _setupEventListeners()
    this.postBossRoundsLeft = 3
    ↓
每回合结算: game_phase.js: phase_finalizeRound()
    if (this.postBossRoundsLeft > 0) this.postBossRoundsLeft--
    ↓
敌人生成: spawn_system.js: spawn_generateAffixes()
    const postBossBonus = (this.postBossRoundsLeft > 0) ? 0.25 : 0;
    const effectiveChance2 = Math.min(chance2 + postBossBonus, 0.40);
```

### 6.3 关键字段

| 字段 | 类型 | 初始值 | 说明 |
|------|------|--------|------|
| `this.postBossRoundsLeft` | `number` | `0` | 战后高压期剩余回合数，Boss 击杀时设为 3，每回合结算递减 |

### 6.4 相关代码位置

| 操作 | 文件 | 行号 | 说明 |
|------|------|------|------|
| 事件监听 & 字段设置 | `src/core.js` | ~L367 | `boss:defeated` 监听器中设置 `postBossRoundsLeft = 3` |
| 字段重置 | `src/game_system.js` | ~L367 | `sys_resetGame` 中重置为 0 |
| 存档/读档 | `src/game_system.js` | ~L1522, ~L1635 | `sys_saveRunState` / `sys_loadRunState` 中序列化 |
| 回合递减 | `src/game_phase.js` | ~L1097 | `phase_finalizeRound` 末尾递减 |
| 概率应用 | `src/spawn_system.js` | ~L108 | `spawn_generateAffixes` 中叠加到双词缀概率 |

### 6.5 与现有 postBossMultiplier 的关系

`postBossMultiplier`（`postBossSurgeRoundsLeft`）是另一套战后高压机制，控制敌人 HP 倍率（x1.3，每回合衰减 0.1）。`postBossRoundsLeft` 是专门控制**双词缀精英概率**的独立计数器，两者并行运作，互不干扰。

| 字段 | 控制目标 | 初始值 | 衰减方式 |
|------|---------|--------|---------|
| `postBossMultiplier` | 敌人 HP 倍率 | 1.3 | 每回合 -0.1，归零后恢复 1.0 |
| `postBossSurgeRoundsLeft` | HP 倍率持续回合数 | 3 | 每回合 -1 |
| `postBossRoundsLeft` | 双词缀精英概率提升 | 3 | 每回合 -1，归零后概率恢复正常 |

## 7. spawn_generateAffixes 词缀生成规则

### 7.1 数量概率

| 词缀数 | 基础概率 | 战后高压加成 |
|--------|---------|------------|
| 0 个 | 默认（1 - chance1 - chance2） | 无 |
| 1 个 | `min(0.6, 0.05 + round * 0.025)` | 无 |
| 2 个 | `r > 10 ? min(0.15, (r-10)*0.01) : 0` | `+0.25`（上限 0.40） |

### 7.2 词缀权重池

| 词缀 | 解锁回合 | 权重规则 |
|------|---------|---------|
| `shield` | r >= 3 | r < 8: 100, r >= 8: 50 |
| `regen` | r >= 5 | r < 12: 80, r >= 12: 40 |
| `healer` | r >= 6 | 稳定 60 |
| `haste` | r >= 8 | r < 15: 70, r >= 15: 50 |
| `jump` | r >= 9 | 稳定 60 |
| `clone` | r >= 12 | 稳定 50 |
| `devour` | r >= 12 | 稳定 40 |
| `berserk` | r >= 14 | `r * 3`（无上限，后期极危险） |

## 8. 禁止行为

- **严禁**在 `spawn_system.js` 中直接操作 DOM，所有 UI 更新必须通过 `eventBus.emit` 派发事件
- **严禁**全量读取 `spawn_system.js`（2036+ 行），必须通过 `auto_index` 精准定位后按需读取
- **严禁**在 `spawn_generateAffixes` 中直接修改 `this.postBossRoundsLeft`，该字段由 `phase_finalizeRound` 统一递减
