# 生成系统规范 (Spawn System)

> **数据来源**：`src/spawn_system.js` → `spawn_spawnEnemyRowAt()`
> **文件**：`src/spawn_system.js` | **总行数**：~2163 | **函数数**：28
> **索引**：[auto_index/src_spawn_system_js_index.md](auto_index/src_spawn_system_js_index.md)
> **用途**：记录导演系统（The Director）所有阵型模板的设计意图、触发条件和实现细节。
> **最后更新**：Task B.1（增强 Phalanx/Blitz 模板，新增常量定义）+ Task B.2（新增 SwarmCore/FoodChain）+ Task C.2（战后高压因子联动）

---

## 1. 导演系统概述

导演系统（The Director）在每次 `spawn_spawnEnemyRowAt()` 调用时，以一定概率生成精英小队，提升游戏难度并引导玩家学习特定战术。

| 参数 | 值 | 说明 |
|---|---|---|
| 触发概率 | `min(0.35, 0.15 + round × 0.01)` | 随回合数线性增长，上限 35% |
| 选型机制 | `candidates` 数组随机选一 | 满足条件的阵型均进入候选池 |
| 实现位置 | `spawn_spawnEnemyRowAt` → `@section:spawn_enemy_type_select` (L285) | |

---

## 2. 阵型模板总览

| 阵型 ID | 名称 | 最早回合 | 触发条件 | 教学目标 | 常量引用 |
|---|---|---|---|---|---|
| `phalanx` | 方阵突击 | Round 6 | 通用 | 护盾 + 治愈协同，引导穿透/闪电 | `DIRECTOR_TEMPLATE_PHALANX` |
| `blitz` | 闪电战 | Round 10 | 通用 | 双词缀边路突袭，引导冰霜控制 | `DIRECTOR_TEMPLATE_BLITZ` |
| `berserk_pack` | 狂暴群 | Round 12 | 玩家有火焰属性 | 高温狂暴，引导冰霜降温 | 内联 |
| `jumper_pack` | 跳跃群 | Round 8 | 玩家有冰霜属性 | 跳跃阻挡，引导穿透精准 | 内联 |
| `swarm_core` | 增殖核心 | Round 12 | 通用（15% 随机） | AOE 清场后集火核心 | 内联 |
| `food_chain` | 吞噬链 | Round 12 | 通用（15% 随机） | 倒计时压力，在 devour 吞噬前打破阵型 | 内联 |

---

## 3. 阵型模板详解

### 3.1 phalanx（方阵突击）[Task B.1 增强]

**常量定义**：`DIRECTOR_TEMPLATE_PHALANX`（`src/spawn_system.js` L23-L41）

```
列:  [0]   [1]   [2]   [3]   [4]   [5]
     🛡️    🛡️   (可选🛡️)  空   💖   (可选💖)
     前排 shield 高血量        后排 healer 低血量
     ←── frontCount(2-3) ──→  ←── backCount(1-2) ──→
```

| 属性 | 值 |
|---|---|
| 前排组成 | 2-3 个 shield 高血量（1.5x-1.8x，随机） |
| 后排组成 | 1-2 个 healer 低血量（0.6x-0.8x，随机） |
| 列布局 | 前排左对齐（从列 0 起），后排右对齐（从最右列起） |
| 克制方式 | pierce（穿透）无视护盾；lightning（闪电）连锁打断治愈 |
| 教学目标 | 引导玩家优先击杀后排 healer 治愈者，而非硬刚前排盾牌 |

### 3.2 blitz（闪电战）[Task B.1 增强]

**常量定义**：`DIRECTOR_TEMPLATE_BLITZ`（`src/spawn_system.js` L52-L66）

```
列:  [0]   [1]   [2]   [3]   [4]   [5]
     ⚡🦘  (普通) (普通)  空    空   ⚡🦘
     haste+jump 双词缀              haste+jump 双词缀
     边缘威胁                        边缘威胁
```

| 属性 | 值 |
|---|---|
| 边缘组成 | 列 0 和列 (cols-1) 各 1 个 **haste+jump 双词缀**低血量（0.7x） |
| 中间组成 | 1-2 个普通敌人，标准血量（1.0x），无强制词缀 |
| 列布局 | 边缘固定列 0 和 cols-1，中间随机选 1-2 列 |
| 克制方式 | cryo（冰霜）同时克制 haste（冻结行动）和 jump（阻止跳跃） |
| 教学目标 | 训练玩家识别并优先击杀两侧双词缀威胁单位，应对边路突袭 |

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

---

## 4. addPreset 辅助函数

```javascript
const addPreset = (col, hpMult, forceAffixes) => {
    if (col >= 0 && col < CONFIG.gameplay.enemyCols && !occupiedCols[col]) {
        pendingSpawns.push({ col, hp: Math.floor(baseHP * hpMult), affixes: forceAffixes });
        occupiedCols[col] = true; // 导演占座
    }
};
```

- `col`：列索引（0-based，总列数 = `CONFIG.gameplay.enemyCols = 6`）
- `hpMult`：相对于 `baseHP` 的血量倍率
- `forceAffixes`：强制词缀数组（覆盖 `spawn_generateAffixes` 的随机结果，空数组 `[]` 表示无词缀）
- 导演生成的敌人统一存入 `pendingSpawns`，在**第 4 步**统一实例化，确保不与填充循环冲突

---

## 5. 与其他系统的耦合点

| 耦合系统 | 耦合点 | 说明 |
|---------|-------|------|
| `src/config.js` | `CONFIG.gameplay.enemyCols` | 总列数（当前为 6） |
| `src/config.js` | `CONFIG.balance.affixes.*` | shield/healer/haste/jump 词缀参数 |
| `src/entities/enemy.js` | `Enemy` 构造函数 | 敌人实体创建 |
| `src/game_phase.js` | `phase_enemy_startLogic` | 词缀行为实现（healer 治疗、haste 行动次数、jump 跳跃） |
| `src/combat_system.js` | `combat_damageEnemy` | shield 减伤计算 |

---

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

### 6.4 与现有 postBossMultiplier 的关系

| 字段 | 控制目标 | 初始值 | 衰减方式 |
|------|---------|--------|---------|
| `postBossMultiplier` | 敌人 HP 倍率 | 1.3 | 每回合 -0.1，归零后恢复 1.0 |
| `postBossSurgeRoundsLeft` | HP 倍率持续回合数 | 3 | 每回合 -1 |
| `postBossRoundsLeft` | 双词缀精英概率提升 | 3 | 每回合 -1，归零后概率恢复正常 |

---

## 7. Task B.3 预留接口

`DIRECTOR_TEMPLATE_PHALANX.triggerProb` 和 `DIRECTOR_TEMPLATE_BLITZ.triggerProb` 字段（当前均为 `0.15`）是为 Task B.3 权重调度系统预留的接口。Task B.3 实现后，应将候选池逻辑替换为基于 `triggerProb` 的加权随机选择，而非当前的等权随机。

---

## 8. 修改规范

- 新增阵型时，必须在 `@section:spawn_enemy_type_select` 区域的 `candidates.push()` 段添加触发条件
- 阵型实例化逻辑必须在 `if-else` 链末尾追加，不得修改现有阵型逻辑
- 修改后必须运行 `code-indexer` 单文件更新索引
- 必须在本文档中同步更新阵型说明
- **严禁全量读取** `src/spawn_system.js`（2163+ 行大文件），必须通过索引精准定位
- **严禁手动编辑** `.cursor/rules/auto_index/src_spawn_system_js_index.md`
- **严禁删除** `@section` 标记（`spawn_enemy_type_select`、`spawn_position_calc`、`spawn_entity_init`）
- **严禁**在 `spawn_generateAffixes` 中直接修改 `this.postBossRoundsLeft`，该字段由 `phase_finalizeRound` 统一递减
