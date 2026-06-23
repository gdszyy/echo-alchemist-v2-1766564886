# 生成系统规范 (Spawn System)

> **数据来源**：`src/spawn_system.js` → `spawn_spawnEnemyRowAt()`
> **用途**：记录导演系统（The Director）所有阵型模板的设计意图、触发条件和实现细节。

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
