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
- **匹配逻辑优化 (当前)**:
  - **无序匹配**: 移除了对符文顺序的严格限制。现在只要在同一条路径（横、竖、斜）上凑齐词条所需的符文，无论顺序如何均可激活。
  - **内部实现**: 由 `sequenceMatchesPattern` (严格顺序) 升级为 `sequenceMatchesPatternUnordered` (基于频率统计的无序匹配)。
- **交互优化 (当前)**:
  - **预测匹配**: 在符文选择器中，系统会预计算库存中每个符文放入目标格子后是否能触发新词条（或提升现有词条等级）。
  - **智能排序**: 能够触发新词条的符文会被自动前置到列表首位。
  - **视觉引导**: 能触发新词条的符文会获得 `rune-glow-active` 闪烁特效，并带有 "NEW" 标签提示。
  - **长按预览**: 在选择器中长按符文（500ms），会弹出预览提示框展示放入该格后将激活的新词条及其效果。

## 4. 合成与重铸规则
- **合成 (`rune_merge`)**: 
  - 条件: 3个同 ID、同等级的符文。
  - 结果: 合成为1个高一等级 of 同 ID 符文。
  - **局外奖励**: 合成成功后，根据合成结果等级自动发放符文碎片：Lv.1 得 1 片，Lv.2 得 3 片，Lv.3 得 6 片。奖励在 `ui_doRuneMerge` 中通过 `meta_addCurrency` 发放，并伴随符文碎片飞向局外货币显示区的动画。
- **重铸 (`rune_reforge`)**: 
  - 条件: 任意3个符文。
  - 结果: 消耗这3个符文，产出1个新符文，等级为这3个符文等级的平均値（向下取整）。新符文 ID 通过 `loot_calcRuneDrop` 获取。
- **原子性**: 两个操作都必须有严格的预检机制，确保扣除和产出同时成功或失败。
- **钉盘融合 (`fuseRuneIntoBoard`)**: 模块编辑器里的符文融合会从 `runeInventory` 消耗 1 枚符文，写入 `pendingFusions`，同步更新 `saveData.runeInventory` 并保存；UI 必须立即重建当前钉盘，使融合后的属性钉在开始采集前可见。
- **融合落点**: `phase_gathering_initPachinko` 应用 `pendingFusions` 时会优先选择 `fusionPriority` 高的普通钉子；`rune_lattice` / `rune_focus_module` 负责提供这种融合承载结构。符文等级会提升注入钉子的 `level`，上限为 3，并且必须写回对应钉盘组件实例的 `pegStates`，不得只修改本次生成出来的临时 `Peg` 对象。

### 4.1 钉盘融合交互约定

- `ui_system.js` 的模块编辑器符文融合入口必须采用“选择符文 → 画布高亮预览目标钉 → 确认融合”的两步交互，禁止点选符文行时直接消耗。
- 预览与实际注入必须共用 `selectFusionTargetPegs()`，确保高亮位置与确认后的属性钉位置一致。
- ??????????????????????????????????????????????????? `runeGrid` ? 3x3 ???? `parseRuneGrid()` ???UI ??? `RUNEWORD_DB.pattern` ?????????????????????????????
- 关闭符文融合弹层或切换到模块选择弹层时必须清空 `_moduleEditorRunePreview`，避免残留高亮。

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

## 7. 词条图鉴 (Runeword Codex)

### 7.1 功能说明
- 在符文发射器面板顶部新增 Tab 导航，分为「⚡ 發射器」和「📖 詞條圖鑑」两个 Tab。
- 图鉴展示所有 13 个词条的卡片，已发现的展示完整信息，未发现的显示「???」隐藏卡片（仅显示符文组合图标提示）。
- 已发现卡片底部提供 Lv.1 / Lv.2 / Lv.3 Tab 切换，动态计算并展示对应等级的效果数值。

### 7.2 发现机制
- 词条被激活时（`ui_updateRuneGrid` 中）自动将词条 ID 写入 `saveData.discoveredRunewords: string[]`。
- 存档升级兼容：`sys_loadSaveData` 中确保旧存档没有该字段时自动初始化为空数组。

### 7.3 新增函数（`src/ui/rune_launcher.js`）

| 函数 | 说明 |
|---|---|
| `ui_switchRuneTab(tab)` | 切换发射器 / 图鉴 Tab，`tab` 为 `'launcher'` 或 `'codex'` |
| `ui_renderRuneCodex()` | 渲染图鉴内容，切换到图鉴 Tab 时自动调用 |
| `ui_switchRunewordCodexLevel(runewordId, level)` | 切换单个词条卡片的展示等级 |
| `_ui_calcRunewordDynamicDesc(rw, level)` | 根据词条对象和等级返回动态效果描述字符串 |

### 7.4 存档字段
- `saveData.discoveredRunewords: string[]` —— 已发现词条的 ID 列表，持久化到 localStorage。

## 8. 掉落权重边际递减 (Marginal Decay)
### 8.1 触发时机
- 计算符文掉落权重时（`loot_system.js` 中的 `_calcBuildVector`）。
### 8.2 机制
- 统计玩家近期伤害占比 `buildVector` 时，如果某一属性的伤害占比超过阈值（默认 60%），则对超出部分进行衰减。
- 衰减系数为 0.5，即超出部分减半。
- 衰减后重新归一化 `buildVector`，防止玩家过度依赖单一属性导致掉落过于单一。

## 8. 战斗阶段充能符文系统 (`combat_system.js`)

> **状态**: 已实现（充能奖励在敌人动作后领取，伴飞入背包动画）

### 8.1 系统概述

战斗阶段顶部 UI 的"GET RUNE"充能条系统。玩家通过击中/击杀敌人积累充能值，充能条满时刷新一次预览符文（并记录充能次数），战斗结束后领取最终预览符文进入背包。

### 8.2 已修复问题

`combat_runeCharge_levelUp` 曾调用 `loot_calcRuneDrop` 并按旧字符串格式处理，导致 `runeChargeCurrentRune` 永远为 `null`。当前实现已改为 `_runeCharge_draw(chargeLevel)`，直接返回 `{ runeDef, runeLevel }`，并同步写入 `runeChargeCurrentRune` 与 `runeChargeCurrentLevel`。

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

**充能符文领取时机（新方案）：**

充能符文不再在 `phase_finalizeRound` 中领取，改为在敌人动作后由 `phase_claimPendingRunes` 统一领取：

- `phase_claimPendingRunes()` 在 `enemyTurnTimer > 60` 时被调用（即敌人动作完毕后）
- 它检查 `runeChargeCurrentRune` 是否有奖励，有则直接入库并重置充能状态
- 同时检查 `runeLootItems` 中的掉落符文，一并入库
- 对所有待领取符文触发 `UI_RUNE_CLAIM_AFTER_ENEMY` 事件，由 `hud.js` 处理飞入背包动画
- 延迟 600ms 后进入 `phase_finalizeRound`

**`combat_runeCharge_claimReward`（已废弃，不再调用）：**

该函数仍保留在 `combat_system.js` 中但不再被任何地方调用。充能符文的入库和动画已全部转移到 `phase_claimPendingRunes` + `UI_RUNE_CLAIM_AFTER_ENEMY` 事件流。

### 8.6 UI 事件变更

- `UI_RUNE_CHARGE_LEVEL_UP` 事件新增 `runeLevel` 字段，`hud.js` 需同步在符文槽上展示等级角标（如 "Lv.2"）。
- `UI_RUNE_CHARGE_CLAIM` 事件已废弃，改由 `UI_RUNE_CLAIM_AFTER_ENEMY` 事件统一处理充能符文和掉落符文的领取动画。
- `UI_RUNE_CLAIM_AFTER_ENEMY` 事件载荷：`{ runes: [{ runeDef, level, source: 'charge'|'loot', x?, y? }] }`，由 `hud.js` 监听并对每个符文创建飞入背包动画。

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

## 10. 成长型低级词条规范 (Task A + Task B)

> **状态**: 已实现（配置注册 + 核心战斗发射流拦截 Task A，实体行为与机制结算 Task B）

### 10.1 新增词条列表

| 词条 ID | effectId | 符文组合 | 核心机制 |
|---|---|---|---|
| `runeword_bloodthirst_edge` | `bloodthirst_growth` | pierce_1, pyro_1, pierce_1 | 击杀累计伤害加成，但惩罚冰/火属性层数 |
| `runeword_scatter_matrix` | `multicast_to_scatter` | bounce_1, lightning_1, bounce_1 | 连射转散射，伤害惩罚，散射角度收窄 |
| `runeword_focused_fire` | `focused_fire` | laser_1, pierce_1, laser_1 | 弹跳/连射转伤害，暴击机制 |
| `runeword_mass_collapse` | `mass_collapse` | bounce_1, pyro_1, bounce_1 | 强制爆炸，连射/散射层数转爆炸范围 |
| `runeword_kinetic_decay` | `kinetic_decay` | bounce_1, pierce_1, bounce_1 | 子弹初始伤害加成，每次命中后衰减 |
| `runeword_echo_shot` | `echo_shot` | scatter_1, bounce_1, scatter_1 | 首次命中有概率额外发射一颗子弹 |

### 10.2 战斗发射流拦截规范 (`combat_fireNextShot`)

所有词条的拦截逻辑统一位于 `combat_system.js` 的 `combat_fireNextShot` 函数中，在 `flatDamageBonus` 叠加之后、`desperation_blade` 遗物处理之前执行。

**嗜血初锋 (`bloodthirst_growth`)**:
- 读取 `this.runewordKillCount`（本局击杀累计数）。
- `finalRecipe.damage += damagePerKill * killCount`。
- 若 `elementPenalty > 0`，则 `finalRecipe.cryo` 和 `finalRecipe.pyro` 乘以 `(1 - elementPenalty)` 并向下取整（最低为 0）。

**散射矩阵 (`multicast_to_scatter`)**:
- `finalRecipe.scatter += finalRecipe.multicast`，`finalRecipe.multicast = 0`。
- `finalRecipe.damage = Math.ceil(damage * (1 - damagePenalty))`。
- `finalRecipe._scatterAngleMultiplier = angleMultiplier`（由散射发射逻辑读取）。

**专注射击 (`focused_fire`)**:
- `finalRecipe.damage += (finalRecipe.bounce || 0) + (finalRecipe.multicast || 0)`。
- `finalRecipe.bounce = 0`，`finalRecipe.multicast = 0`。
- `finalRecipe._critChance = critChance`，`finalRecipe._critDamage = critDamage`（由 `combat_system.js` 的 `combat_damageEnemy` 函数读取，在 `takeDamage` 调用前执行暴击判定）。

**质量坍缩 (`mass_collapse`)**:
- `layersCleared = (finalRecipe.multicast || 0) + (finalRecipe.scatter || 0)`。
- `finalRecipe.multicast = 0`，`finalRecipe.scatter = 0`。
- `finalRecipe.explosive = true`。
- `finalRecipe._explosionRadiusMult = baseRadiusRatio + layersCleared * radiusBonusPerLayer`。
- 爆炸 AOE 判定处（`combat_system.js` 爆炸逻辑）：半径改为 `100 * (config._explosionRadiusMult || 1.0)`。

**动能衰变 (`kinetic_decay`)**:
- `finalRecipe._kineticDecayBonus = initialBonus`。
- `finalRecipe._kineticDecayRate = decayPerHit`。
- 由 `Projectile` 命中逻辑（`src/entities/projectile.js`）读取并在每次命中后衰减（**Task B 已实现**）。

**回响射击 (`echo_shot`)**:
- `finalRecipe._echoShotChance = triggerChance`。
- 由 `Projectile` 首次命中逻辑（`src/entities/projectile.js`）读取并触发回响子弹（**Task B 已实现**）。

### 10.3 嗜血初锋击杀计数规范

- 字段：`game.runewordKillCount`（number，本局战斗开始时初始化为 0）。
- 每次敌人死亡时（`combat_damageEnemy` 中 `killed` 为 true 时），若 `bloodthirst_growth` 词条激活，则 `this.runewordKillCount++`（**Task B 已实现**）。
- `phase_startCombatPhase` 开始时重置 `this.runewordKillCount = 0`（**Task B 已实现**）。

### 10.4 配方元数据字段速查

| 字段 | 类型 | 来源词条 | 消费方 |
|---|---|---|---|
| `_scatterAngleMultiplier` | number | `multicast_to_scatter` | 散射发射逻辑 |
| `_critChance` | number (0~1) | `focused_fire` | `combat_damageEnemy`（约第 1714 行）|
| `_critDamage` | number (倍率) | `focused_fire` | `combat_damageEnemy`（约第 1714 行）|
| `_explosionRadiusMult` | number | `mass_collapse` | 爆炸 AOE 判定 |
| `_kineticDecayBonus` | number (0~1) | `kinetic_decay` | Projectile 命中 |
| `_kineticDecayRate` | number (0~1) | `kinetic_decay` | Projectile 命中 |
| `_echoShotChance` | number (0~1) | `echo_shot` | Projectile 首次命中 |

## 11. 属性共鸣系统 (Element Resonance)

> **状态**: 已实现（数据字典 + 状态计算 + 火焰战斗集成）

### 11.1 系统概述

属性共鸣是符文系统的横向增益维度。当玩家在 3x3 网格中放置同属性符文，累计属性层数（由 `calcRuneBaseStats` 计算）达到 **3 / 6 / 9** 时，分别激活 Tier1 / Tier2 / Tier3 共鸣效果，提供属于该属性的专属加强。

### 11.2 数据结构 (`rune_config.js`)

新增导出常量 `ELEMENT_RESONANCE_DB`，格式如下：

```js
{
  [element]: {
    name: string,   // 共鸣名称
    icon: string,   // 图标
    tiers: [
      { threshold: 3, label: string, desc: string, params: Object },  // Tier1
      { threshold: 6, label: string, desc: string, params: Object },  // Tier2
      { threshold: 9, label: string, desc: string, params: Object },  // Tier3
    ]
  }
}
```

目前已定义 7 种属性的共鸣：`pyro`、`cryo`、`lightning`、`bounce`、`pierce`、`scatter`、`laser`。

### 11.3 状态计算入口 (`src/ui/rune_launcher.js`)

在 `ui_updateRuneGrid()` 的步骤 6.5 中，基于 `calcRuneBaseStats` 返回的 `baseStats` 计算当前激活的共鸣等级，并写入 `this.activeElementResonances`：

```js
// 结构：{ [element]: { label, desc, threshold, statCount, params } }
this.activeElementResonances = newResonances;
```

- 从高阶到低阶逐一检查，取满足阈值的**最高阶**共鸣。
- 共鸣等级变化时自动弹出 Toast 提示（如 `✨ 🔥 炎焰共鸣·一阶已激活！`）。

### 11.4 战斗层消费规范

各属性共鸣在战斗代码中的消费位置和参数如下：

#### 11.4.1 Pyro (炎焰)
- **位置**：`src/combat_system.js` (`combat_damageEnemy` 火焰伤害段)
- **参数**：
  - `burnTempThreshold`: 降低触发温度 (默认 34° -> 30°/0°)
  - `basePyroBonus`: 基础属性加成 (+5/+10/+25)
  - `pyroMultiplier`: 整体伤害倍率 (1.0/1.2/1.5)
  - `explodeThreshold`: 爆燃阈值 (默认 200° -> 100°)

#### 11.4.2 Cryo (冰霜)
- **位置**：`src/combat_system.js` (`combat_damageEnemy` 冰霜伤害段)
- **参数**：
  - `freezeTempThreshold`: 提升触发温度 (默认 -34° -> -25°/-15°/-5°)
  - `baseCryoBonus`: 基础属性加成 (+5/+10/+25)
  - `cryoMultiplier`: 整体伤害倍率 (1.0/1.2/1.5)
  - `frozenPhysDmgBonus`: 冻结状态下物理伤害加深 (三阶 +30%)

#### 11.4.3 Lightning (雷霆)
- **位置**：`src/combat_system.js` (`combat_damageEnemy` 闪电链触发前) & `src/combat/damage_calc.js` (`combat_lightning_triggerChain`)
- **参数**：
  - `chainChanceBonus`: 闪电链触发概率加成 (+15%/+30%/+50%)
  - `baseLightningBonus`: 基础属性加成 (+5/+10/+25)
  - `lightningMultiplier`: 整体伤害倍率 (1.0/1.2/1.5)
  - `allowDoubleChain`: 允许对同一目标二次触发 (三阶 true)

#### 11.4.4 Bounce (弹跳)
- **位置**：`src/combat_system.js` (`combat_damageEnemy` 弹跳判定处) & `src/entities/projectile.js`
- **参数**：
  - `bounceDmgBonus`: 弹跳伤害加成 (+15%/+30%/+50%)
  - `baseBounceBonus`: 基础属性加成 (+5/+10/+25)
  - `noBounceDecay`: 每次弹跳后伤害不衰减 (二阶/三阶 true)
  - `extraBounces`: 额外弹跳次数 (+2)

#### 11.4.5 Pierce (穿透)
- **位置**：`src/combat_system.js` (`combat_damageEnemy` 穿透判定处)
- **参数**：
  - `pierceDmgBonus`: 穿透伤害加成 (+15%/+30%/+50%)
  - `basePierceBonus`: 基础属性加成 (+5/+10/+25)
  - `pierceApplyTemp`: 命中后额外施加火焰温度 (+5°/+15°)
  - `extraPierces`: 额外穿透次数 (+1)

#### 11.4.6 Scatter (散射)
- **位置**：`src/spawn_system.js` (`spawn_spawnBullet` 散射发射逻辑)
- **参数**：
  - `extraScatterShots`: 额外散射子弹数 (+1/+2/+3)
  - `baseScatterBonus`: 基础属性加成 (+5/+10/+25)
  - `scatterMultiplier`: 整体伤害倍率 (1.0/1.2/1.5)
  - `scatterAngleReduction`: 散射角度收窄 (三阶 20%)

#### 11.4.7 Laser (激光)
- **位置**：`src/combat/collision.js` (`combat_laser_processPenetration`)
- **参数**：
  - `laserTempBonus`: 命中额外升温 (+3°/+8°/+15°)
  - `baseLaserBonus`: 基础属性加成 (+5/+10/+25)
  - `laserMultiplier`: 整体伤害倍率 (1.0/1.2/1.5)
  - `extraLaserPierces`: 额外穿透次数 (+1)

### 11.5 重置规范

- `sys_resetGame` 中已添加 `this.activeElementResonances = {}` 重置。
- 存档恢复时通过 `ui_updateRuneGrid()` 自动重建共鸣状态，无需额外处理。
