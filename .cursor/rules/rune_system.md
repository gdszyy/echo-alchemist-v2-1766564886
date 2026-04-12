---
description: "符文系统完整规范（智能掉落、网格拼图、合成重铸、充能符文）"
globs: ["src/rune_system.js", "src/rune_config.js", "src/loot_system.js", "src/combat_system.js"]
---
# 符文系统规范 (Rune System)

## 1. 系统概述
符文系统是游戏局内的核心策略维度，包含智能掉落算法、网格拼图逻辑、合成重铸规则以及战斗阶段充能符文系统。

## 2. 智能掉落算法 (`loot_system.js`)
- **机制**: 敌人的符文掉落并非纯随机。
- **流程**:
  1. **套路识别**: 分析玩家近几回合的伤害构成。
  2. **克制映射**: 结合套路克制关系（如火焰克制护盾/再生），动态提高相关符文的掉落权重。
  3. **加权抽取**: 基于动态权重进行随机抽取，确保掉落物符合玩家当前构建需求。
- **函数签名** (Boss 符文掉落系统扩展):
  ```js
  loot_calcRuneDrop(game, overrideOptions = {})
  ```
  - `overrideOptions.forcedLevel` {number}: 强制指定掉落等级（如 2）
  - `overrideOptions.themeWeights` {Object}: Boss 主题额外权重注入（如 `{ pyro: 3.0, laser: 3.0 }`）
  - **返回值**: `{ runeId: string|null, level: number }` 对象（原来直接返回字符串，已升级）
- **调用方彿变更警告**: 所有调用方必须适配新返回对象格式。已更新的调用方：
  - `combat_system.js`: Boss 死亡掉落、普通敌人掉落、`combat_runeCharge_initUI`
  - `rune_system.js`: `rune_reforge` 重铸函数

## 3. 网格拼图逻辑 (`rune_system.js`)
- **发射器网格**: 3x3 的符文放置区域。
- **双重增益**:
  - **基础加成**: 网格内符文提供基础属性层数加成。
  - **符文之语**: 当符文排列满足特定形状（如直线、对角线）时，激活强力的组合词条（Runeword）。
- **解析算法变更 (Task 1 升级)**: 
  - `parseRuneGrid` 函数现在会统计同一词条被多条路径匹配的次数，将该次数作为词条的 `level` 写入返回的 `activatedRunewords` 数组中每个对象。
  - 移除了「同一词条仅激活一次」的限制，允许通过天胡布局提升词条等级。

## 4. 合成与重铸规则
- **合成 (`rune_merge`)**: 
  - 条件: 3个同 ID、同等级的符文。
  - 结果: 合成为1个高一等级的同 ID 符文。
- **重铸 (`rune_reforge`)**: 
  - 条件: 任意3个符文。
  - 结果: 消耗这3个符文，产出1个新符文，等级为这3个符文等级的平均值（向下取整）。新符文 ID 通过 `loot_calcRuneDrop` 获取。
- **原子性**: 两个操作都必须有严格的预检机制，确保扣除和产出同时成功或失败。

## 5. 数据结构 (`rune_config.js`)
- 符文对象标准格式: `{ id: String, level: Number }`。
- `RUNE_DB`: 符文基础信息定义（包含 `baseStat`）。
- **`RUNEWORD_DB` (Task 1 升级)**: 
  - 废弃原有扁平的 `stats` 对象。
  - 新增 `effectId` (字符串，效果唯一标识)。
  - 新增 `baseParams` (对象，Lv.1 时的基础参数)。
  - 新增 `perLevelParams` (对象，每级递增参数，Lv.N 时的参数 = baseParams + (N-1) * perLevelParams)。
  - 包含 13 个全新设计的词条（7 个元素专属 + 6 个复合机制）。

## 6. Boss 符文掉落系统 (`combat_system.js` + `config.js`)

### 6.1 Boss 死亡丰厚掉落
- Boss 死亡必定掉落 **3 个** 符文，分别为：
  - **掉落 1**：`forcedLevel: 2` + `themeWeights: bossThemeWeights`（主题符文 + Lv2）
  - **掉落 2**：20% 概率 `forcedLevel: 2`，否则 `forcedLevel: 1`（智能掉落）
  - **掉落 3**：标准掉落（无 overrideOptions）
- 掉落物正常出现在场地，玩家手动拾取。
- `RuneLoot` 对象通过动态属性 `loot.level` 存储掉落等级。

### 6.2 Boss 狂暴阶段即时掉落
- Boss HP 首次降至 50% 时，立即自动掉落 1 个 Lv1 符文并拾取入库。
- 使用 `enemy._bossEnrageDropped` 标志确保每个 Boss 仅触发一次。
- 自动拾取复用现有拾取逻辑（直接 `push` 到 `runeInventory`）。

### 6.3 Boss 主题权重配置 (`config.js` 中的 `BOSS_DB`)
- `BOSS_DB` 包含 8 个 Boss 的 `themeWeights` 配置。
- `themeWeights` 键为 RUNE_DB 中的 `element` 字段，在 `loot_calcRuneDrop` 第三层抽取中放大对应属性符文的掉落权重。
- Boss 实体需将对应的 `BOSS_DB` 条目引用为 `enemy.bossConfig`，供死亡掉落逻辑读取。

## 7. 掉落权重边际递减 (Marginal Decay)
### 7.1 触发时机
- 计算符文掉落权重时（`loot_system.js` 中的 `_calcBuildVector`）。
### 7.2 机制
- 统计玩家近期伤害占比 `buildVector` 时，如果某一属性的伤害占比超过阈值（默认 60%），则对超出部分进行衰减。
- 衰减系数为 0.5，即超出部分减半。
- 衰减后重新归一化 `buildVector`，防止玩家过度依赖单一属性导致掉落过于单一。

## 8. 战斗阶段充能符文系统 (`combat_system.js`)

> **状态**: 待实现（当前代码存在 Bug，功能完全失效）

### 8.1 系统概述

战斗阶段顶部 UI 的"GET RUNE"充能条系统。玩家通过击中/击杀敌人积累充能值，充能条满时刷新一次预览符文（并记录充能次数），战斗结束后领取最终预览符文进入背包。

### 8.2 当前 Bug（必须修复）

`combat_runeCharge_levelUp` 中调用 `loot_calcRuneDrop` 时，未适配其新返回值格式 `{ runeId, level }`，仍按旧的字符串格式处理，导致 `runeChargeCurrentRune` 永远为 `null`，充能奖励系统完全失效。

### 8.3 状态字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `runeChargeValue` | number (0~1) | 当前充能进度，每帧自动衰减 |
| `runeChargeLevel` | number | 本场战斗中充能条已满的次数（每满一次 +1） |
| `runeChargeCurrentRune` | object\|null | 当前预览符文定义（来自 RUNE_DB） |
| `runeChargeCurrentLevel` | number | 当前预览符文的等级（**新增字段**，需在 `combat_runeCharge_init` 中初始化为 1） |

### 8.4 抽取算法设计

**核心公式：**

```
最终权重 = baseDropWeight × (1.26/3)^(符文等级 - 1)
         = baseDropWeight × 0.42^(lv - 1)
```

**入池条件（门槛为权重上限）：**

```
最终权重 < threshold(充能等级)
```

门槛随充能等级升高而单调递减。权重越低（稀有度越高或等级越高）的符文越先通过门槛。低稀有度高等级的符文（如 common Lv.3 权重 ≈ 2.12）在高充能等级下仍可入池。

**门槛序列（充能等级 1 → 7+）：**

```js
const RUNE_CHARGE_THRESHOLDS = [999, 999, 6.1, 5.1, 2.6, 2.15, 0.9, 0.4];
// 索引即充能等级，超过 7 时取 index 7
```

| 充能等级 | 门槛值 | 入池变化 |
|---|---|---|
| Lv.1 | 999（无限制） | 全部 Lv.1 符文 |
| Lv.2 | 6.1 | common Lv.1(12.0) 出局；解锁 Lv.2 符文 |
| Lv.3 | 5.1 | rare(w=6) Lv.1(6.0) 出局；解锁 Lv.3 符文 |
| Lv.4 | 2.6 | common Lv.2(5.04)、rare(w=5) Lv.1(5.0) 出局 |
| Lv.5 | 2.15 | common Lv.3(2.12)、rare Lv.2 出局 |
| Lv.6 | 0.9 | epic Lv.1(2.0)、rare Lv.3 出局 |
| Lv.7+ | 0.4 | epic Lv.2(0.84) 出局；仅剩 epic Lv.3 + legendary 全系 |

**可出最高符文等级：** `min(充能等级, 3)`

**各稀有度各等级权重参考：**

| 稀有度 | Lv.1 | Lv.2 | Lv.3 |
|---|---|---|---|
| common (baseDropWeight=12) | 12.00 | 5.04 | 2.12 |
| rare (baseDropWeight=6) | 6.00 | 2.52 | 1.06 |
| rare (baseDropWeight=5) | 5.00 | 2.10 | 0.88 |
| epic (baseDropWeight=2) | 2.00 | 0.84 | 0.35 |
| legendary (baseDropWeight=0.5) | 0.50 | 0.21 | 0.09 |

### 8.5 实现规范

**新增常量（`combat_system.js` 顶部常量区）：**

```js
const RUNE_CHARGE_THRESHOLDS = [999, 999, 6.1, 5.1, 2.6, 2.15, 0.9, 0.4];
const RUNE_CHARGE_DECAY      = 1.26 / 3;   // ≈ 0.42
const RUNE_CHARGE_MAX_LEVEL  = 3;
```

**新增辅助函数 `_runeCharge_draw(chargeLevel)`（模块内函数，非 game 对象方法）：**

```js
function _runeCharge_draw(chargeLevel) {
    const threshold = RUNE_CHARGE_THRESHOLDS[Math.min(chargeLevel, 7)];
    const maxRuneLv = Math.min(chargeLevel, RUNE_CHARGE_MAX_LEVEL);
    const pool = [];
    for (const rune of RUNE_DB) {
        for (let lv = 1; lv <= maxRuneLv; lv++) {
            const w = rune.baseDropWeight * Math.pow(RUNE_CHARGE_DECAY, lv - 1);
            if (w < threshold) pool.push({ runeDef: rune, runeLevel: lv, weight: w });
        }
    }
    if (!pool.length) return { runeDef: null, runeLevel: 1 };
    const total = pool.reduce((s, c) => s + c.weight, 0);
    let rand = Math.random() * total;
    for (const c of pool) {
        rand -= c.weight;
        if (rand <= 0) return { runeDef: c.runeDef, runeLevel: c.runeLevel };
    }
    const last = pool[pool.length - 1];
    return { runeDef: last.runeDef, runeLevel: last.runeLevel };
}
```

**修改 `combat_runeCharge_init`（新增 `runeChargeCurrentLevel` 初始化）：**

```js
combat_runeCharge_init() {
    this.runeChargeValue        = 0;
    this.runeChargeLevel        = 0;
    this.runeChargeCurrentRune  = null;
    this.runeChargeCurrentLevel = 1;   // 新增
    this.combat_runeCharge_initUI();
},
```

**修改 `combat_runeCharge_levelUp`（修复 Bug + 接入新抽取逻辑）：**

```js
combat_runeCharge_levelUp() {
    this.runeChargeLevel = (this.runeChargeLevel || 0) + 1;
    const { runeDef, runeLevel } = _runeCharge_draw(this.runeChargeLevel);
    this.runeChargeCurrentRune  = runeDef  || null;
    this.runeChargeCurrentLevel = runeLevel || 1;
    eventBus.emit(EVENT_TYPES.UI_RUNE_CHARGE_LEVEL_UP, {
        runeDef:   this.runeChargeCurrentRune,
        runeLevel: this.runeChargeCurrentLevel
    });
    try { if (audio?.playTone) audio.playTone(520, 'sine', 0.1, 0.25); } catch(e) {}
},
```

**修改 `combat_runeCharge_claimReward`（使用动态等级入库）：**

```js
combat_runeCharge_claimReward() {
    const runeDef = this.runeChargeCurrentRune;
    if (!runeDef) return;
    const level = this.runeChargeCurrentLevel || 1;
    this.runeInventory.push({ id: runeDef.id, level });
    eventBus.emit(EVENT_TYPES.UI_RUNE_CHARGE_CLAIM, { runeDef, level });
    try { if (audio?.playPowerup) audio.playPowerup(); } catch(e) {}
    this.runeChargeValue        = 0;
    this.runeChargeLevel        = 0;
    this.runeChargeCurrentRune  = null;
    this.runeChargeCurrentLevel = 1;
},
```

### 8.6 UI 事件变更

- `UI_RUNE_CHARGE_LEVEL_UP` 事件新增 `runeLevel` 字段，`hud.js` 需同步在符文槽上展示等级角标（如 "Lv.2"）。
- `UI_RUNE_CHARGE_CLAIM` 事件新增 `level` 字段，入背包动画需展示正确等级。

## 9. 特殊变异解锁词条规范

### 9.1 设计原则

飞剑（`flying_sword`）和风属性（`wind`）钉子的变异，**不再由全局概率乘子 `specialMutationMult` 控制**，而是完全依赖符文词条解锁。`config.js` 中 `specialMutationMult` 已设为 `0`，确保无词条时变异概率为零。

### 9.2 新增词条

| 词条 ID | 名称 | 符文组合 | effectId | 基础变异概率 | 每级增量 |
|---|---|---|---|---|---|
| `runeword_sword_resonance` | 剑意共鸣 | `rune_pierce_1 × 3` | `flying_sword_unlock` | 70% | +10% |
| `runeword_storm_resonance` | 风暴共鸣 | `rune_bounce_1 × 3` | `wind_unlock` | 70% | +10% |

词条等级（`level`）通过 `parseRuneGrid` 的多路径匹配机制累加，最终写入 `activeRunewordEffects[effectId].params`。

### 9.3 变异概率读取规范

`entities.js` 的 `handlePegInteraction` 中，变异概率从 `game.activeRunewordEffects` 读取：

```js
// 飞剑变异
if (rule.result === 'flying_sword' && game.activeRunewordEffects['flying_sword_unlock']) {
    chance = game.activeRunewordEffects['flying_sword_unlock'].params.mutationChance || 0.7;
}
// 风属性变异
if (rule.result === 'wind' && game.activeRunewordEffects['wind_unlock']) {
    chance = game.activeRunewordEffects['wind_unlock'].params.mutationChance || 0.7;
}
```

无对应词条时 `chance` 保持为 `0`，即不触发变异。

### 9.4 等级注入规范

变异成功时，钉子等级（`peg.level`）从词条 `params.level` 读取，而非固定为 `1`：

```js
peg.level = game.activeRunewordEffects['flying_sword_unlock'].params.level || 1;
```

这使高等级词条（如词条等级 3）能直接生成 Lv.3 的特殊钉子，解锁更强的视觉效果和战斗行为。
