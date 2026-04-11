# 符文系统变更说明

本文档汇总了符文系统各任务的修改内容。

---

# Task 1: 符文系统数据结构升级

**任务 ID**: tsk-abf80056-b4f  
**完成时间**: 2026-04-10  
**执行 Agent**: agt-318443a0-437 (developer)

---

## 修改文件列表

### 1. `src/rune_config.js`

**变更类型**: 数据扩展

**修改内容**:
- 为 `RUNE_DB` 中的每个符文对象增加 `baseStat` 字段
- `baseStat` 字段映射到对应的弹药属性类型（与 `element` 字段一致）
- 该字段用于后续实现符文的基础属性层数加成功能

**示例**:
```javascript
// 修改前
{ id: 'rune_pyro_1', name: '烈焰符文', element: 'pyro', ... }

// 修改后
{ id: 'rune_pyro_1', name: '烈焰符文', element: 'pyro', ..., baseStat: 'pyro' }
```

**影响的符文**:
- 火焰系 (pyro): `rune_pyro_1`, `rune_pyro_2` → `baseStat: 'pyro'`
- 冰霜系 (cryo): `rune_cryo_1`, `rune_cryo_2` → `baseStat: 'cryo'`
- 闪电系 (lightning): `rune_lightning_1`, `rune_lightning_2` → `baseStat: 'lightning'`
- 弹射系 (bounce): `rune_bounce_1`, `rune_bounce_2` → `baseStat: 'bounce'`
- 穿透系 (pierce): `rune_pierce_1`, `rune_pierce_2` → `baseStat: 'pierce'`
- 散射系 (scatter): `rune_scatter_1` → `baseStat: 'scatter'`
- 激光系 (laser): `rune_laser_1`, `rune_laser_2` → `baseStat: 'laser'`

---

### 2. `src/core.js`

**变更类型**: 注释更新（数据结构说明）

**修改内容**:
- 在 `runeInventory` 和 `runeGrid` 初始化处添加注释，说明新的数据格式
- 明确标注存储格式为 `{ id: string, level: number }` 对象

---

### 3. `src/game_system.js`

**变更类型**: 功能新增

**修改内容**:
- 在 `sys_resetGame()` 函数中添加符文系统的局内重置逻辑
- 每次开始新局时清空 `runeInventory`、`runeGrid`、`activeRunewordStats` 和 `runeLootItems`

---

### 4. `src/rune_system.js`

**变更类型**: 向后兼容升级

**修改内容**:
- 新增 `getRuneId(entry)` 辅助函数，统一从网格条目中提取符文 ID
- 修改 `parseRuneGrid()` 函数，在解析前将网格统一转换为 ID 数组
- 更新 JSDoc 注释，说明支持新旧两种格式
- 导出 `getRuneId` 函数供其他模块使用

---

### 5. `src/ui_system.js`

**变更类型**: 向后兼容升级

**修改内容**:
- 导入 `getRuneId` 函数
- 修改 `ui_initRuneGrid()`、`ui_openRunePicker()`、`ui_updateRuneGrid()`、`_ui_updateRuneInventoryDisplay()` 中的符文 ID 提取逻辑

---

## 设计原则

1. **向后兼容**: 所有读取符文数据的地方均通过 `getRuneId()` 辅助函数兼容旧的字符串格式
2. **最小侵入**: 仅修改必要的文件，不改变游戏的整体架构
3. **局内重置**: `runeInventory` 和 `runeGrid` 属于局内状态，在 `sys_resetGame()` 中清空

---

---

# Task 3: 符文基础属性层数应用

**任务 ID**: tsk-699961b1-e5e  
**完成时间**: 2026-04-10  
**执行 Agent**: agt-1d91817a-794 (developer)

---

## 任务概述

实现符文等级对弹药属性层数的基础加成，使放置在网格中的符文直接提升对应属性。

## 修改文件列表

### 1. `src/rune_config.js`

**修改内容：** 为 RUNE_DB 中的每个符文对象添加 `baseStat` 字段。

- `baseStat` 字段与 `element` 字段值相同，用于 `calcRuneBaseStats()` 函数识别该符文对应的弹药属性键
- 共为 14 个符文（pyro×2, cryo×2, lightning×2, bounce×2, pierce×2, scatter×1, laser×2）添加了 `baseStat` 字段
- 在 RUNE_DB 注释中补充了 `baseStat` 字段的说明

### 2. `src/rune_system.js`

**修改内容：** 新增 `calcRuneBaseStats()` 函数，并更新 `export` 语句。

- **新增函数 `calcRuneBaseStats(runeGrid, runeDb)`：**
  - 遍历 `runeGrid`（9个格子），根据每个符文的 `baseStat` 字段和 `level` 值累加属性层数
  - 兼容两种网格格式：字符串格式（旧，`level` 默认为 1）和对象格式（新，`{ id, level }`）
  - 返回基础属性加成对象，如 `{ pyro: 3, bounce: 2 }`
  - 若符文无 `baseStat` 字段，自动回退到 `element` 字段
- **更新 `export` 语句：** 新增导出 `calcRuneBaseStats`

### 3. `src/combat_system.js`

**修改内容：** 在 `combat_fireNextShot()` 中，在现有词条加成逻辑之后，新增基础属性层数叠加逻辑。

- **新增导入：** `calcRuneBaseStats` 从 `./rune_system.js`，`RUNE_DB` 从 `./rune_config.js`

### 4. `src/ui_system.js`

**修改内容：** 在 `ui_updateRuneGrid()` 中调用 `calcRuneBaseStats()` 并在 UI 展示基础加成汇总。

- **新增导入：** `calcRuneBaseStats` 从 `./rune_system.js`（与 `parseRuneGrid`、`getRuneId` 合并导入）
- **`_ui_updateRuneStatsDisplay()` 函数更新：** 分区展示「基础属性」（蓝色标签）和「词条共鸣」（金色标签）

### 5. `index.html`

**修改内容：** 更新「属性加成汇总」区域的注释，说明 JS 动态生成的内容结构。

## 设计说明

### 双重增益机制

符文系统实现了两层独立的属性加成：

| 加成类型 | 来源 | 计算函数 | UI 颜色 |
|---------|------|---------|--------|
| 基础属性加成 | 符文等级（每个格子中的符文贡献 level 层数） | `calcRuneBaseStats()` | 蓝色标签 |
| 词条共鸣加成 | 符文排列匹配词条 pattern | `parseRuneGrid()` | 金色标签 |

---

---

# Task 4 修改说明 — 符文合成与重铸逻辑

**任务 ID**: tsk-a6181a7f-1da  
**完成时间**: 2026-04-10  
**负责人**: developer (agt-47fa321a-a66)

---

## 修改文件

### `src/rune_system.js`

**新增内容**：

1. **`import { loot_calcRuneDrop } from './loot_system.js'`**  
   在文件顶部新增对 `loot_system.js` 的导入，供 `rune_reforge` 函数调用智能掉落算法。

2. **辅助函数 `_removeRuneFromInventory(runeInventory, runeObj)`**  
   从 `runeInventory` 数组中精确移除一个匹配 `{ id, level }` 的符文对象（每次只移除一个）。

3. **`rune_merge(runeObjects, runeInventory)`** — 符文合成函数  
   - **输入**：三个符文对象数组 `[{id, level}, {id, level}, {id, level}]` 及符文背包引用。
   - **校验**：三个符文的 `id` 必须相同，且 `level` 必须相同；背包中需有足够数量的符文（原子性预检）。
   - **效果**：从 `runeInventory` 移除这三个符文，将 `{ id: 同id, level: level+1 }` 加入 `runeInventory`。
   - **返回**：`{ success: boolean, result: {id, level}|null, error: string|null }`

4. **`rune_reforge(runeObjects, runeInventory, game)`** — 符文重铸函数  
   - **输入**：任意三个符文对象数组及符文背包引用、Game 实例。
   - **等级计算**：`newLevel = Math.max(1, Math.floor((lvA + lvB + lvC) / 3))`
   - **种类选择**：调用 `loot_calcRuneDrop(game)` 智能掉落算法获取新符文 ID。
   - **效果**：从 `runeInventory` 移除这三个符文，将 `{ id: newId, level: newLevel }` 加入 `runeInventory`。
   - **返回**：`{ success: boolean, result: {id, level}|null, error: string|null }`

5. **更新导出**：在文件末尾的 `export` 语句中新增 `rune_merge`、`rune_reforge` 和 `calcRuneBaseStats`。

---

## 设计说明

### 原子性保障

合成和重铸操作在执行移除前均进行**预检**（dry-run），确认背包中存在足够数量的目标符文后才执行实际修改。这避免了"部分移除"导致的背包状态不一致问题。

### 与现有系统的集成

- `rune_merge` 和 `rune_reforge` 均接受 `runeInventory` 作为参数（而非直接访问 `game.runeInventory`），保持函数的纯粹性和可测试性。
- `rune_reforge` 通过 `game` 参数调用 `loot_calcRuneDrop`，与现有智能掉落系统无缝集成。

### 符文对象数据结构

本任务的实现基于设计文档 §4 的规范，符文对象格式为 `{ id: string, level: number }`，与 Task 1 建立的数据结构保持一致。

---

---

# Task 2: 动态掉落率与自动拾取

**任务 ID**: tsk-3557ba9e-bb3  

---

# Task 5: 符文发射器 UI 升级

**任务 ID**: tsk-df78066f-dc3  **完成时间**: 2026-04-10  
**执行 Agent**: developer

---

## 任务概述

本次修改实现了符文系统的两个核心功能：
1. **三因子动态掉落率公式**（替换原有固定 30% 概率）
2. **回合结束自动拾取**（遍历 runeLootItems 并转化为库存对象）

---

## 修改文件

### 1. `src/combat_system.js`

**修改位置**：敌人击杀逻辑中的符文掉落判定（约第 1706 行）

**修改内容**：将原有固定 30% 掉落率替换为三因子动态掉落率公式：

```
FinalDropRate = BaseDropRate × EnemyModifier × OccupancyPenalty
```

- **因子1 - BaseDropRate（基础掉落率）**：随回合数线性增长，公式为 `min(0.05 + (round/10) * 0.05, 0.40)`，上限 40%
- **因子2 - EnemyModifier（敌人数量修正）**：敌人越多，单个掉落率越低，公式为 `max(0.3, 1/sqrt(spawnedEnemiesInRound))`，防止多敌人时掉落过多
- **因子3 - OccupancyPenalty（占用率衰减）**：背包与网格占用率越高，掉落率越低，公式为 `max(0.2, 1 - (runeInventory.length + runesInGrid) / 20)`，防止符文溢出

新增常量 `MAX_RUNE_CAPACITY = 20`（符文库存最大容量）。

### 2. `src/game_phase.js`

**修改位置1**：`phase_startCombatPhase` 函数（约第 298 行）

**修改内容**：在战斗阶段开始时记录当前场上敌人数量到 `this.spawnedEnemiesInRound`，用于动态掉落率的因子2计算。

**修改位置2**：`phase_finalizeRound` 函数（约第 504 行）

**修改内容**：在回合结束时实现自动拾取逻辑：
- 遍历 `runeLootItems` 中所有 `active` 的掉落物
- 查找 `RUNE_DB` 获取符文名称，用于视觉反馈
- 将符文转化为 `{ id: runeId, level: 1 }` 对象推入 `runeInventory`
- 调用 `spawn_createFloatingText` 显示「+符文名称」浮动文字（颜色 `#fbbf24` 金色）
- 清空 `runeLootItems` 数组

**新增导入**：在文件顶部添加 `import { RUNE_DB } from './rune_config.js'`

---

## 设计决策

1. **兼容性**：`runeInventory` 按设计文档要求存储 `{ id, level: 1 }` 对象格式，为 Task 1（数据结构重构）完成后的无缝集成做准备
2. **防御性编程**：`spawnedEnemiesInRound` 使用 `|| Math.max(1, this.enemies.length)` 作为回退值，确保在未记录时也能正常工作
3. **视觉反馈**：使用金色（`#fbbf24`）浮动文字显示拾取信息，与游戏整体视觉风格一致

---

## 测试建议

1. 进入游戏战斗阶段，击杀敌人，观察符文掉落物是否出现
2. 回合结束后，检查 `runeInventory` 是否包含 `{ id, level: 1 }` 格式的符文对象
3. 观察回合结束时是否出现金色「+符文名称」浮动文字
4. 验证高回合数时掉落率是否高于低回合数
5. 验证符文库存接近满时掉落率是否降低
全面升级符文发射器面板的 UI 交互体验，实现符文卡片等级角标、选中高亮、合成/重铸功能按钮，以及基础属性汇总展示。

## 修改文件列表

| 文件 | 修改类型 | 说明 |
|------|---------|------|
| `src/rune_config.js` | 新增常量 | 添加 `STAT_DISPLAY` 属性显示名称与图标映射 |
| `src/ui_system.js` | 功能升级 | 符文卡片 UI 全面升级，支持选中/合成/重铸 |
| `index.html` | 结构新增 | 添加合成炉、重铸炉区域及操作结果提示 |
| `src/game_phase.js` | 功能新增 | 实现符文掉落物的渲染和自动拾取逻辑 |

---

## 详细变更说明

### 1. `src/rune_config.js`

- **新增 `STAT_DISPLAY` 常量**：定义属性显示名称与图标映射（pyro/cryo/lightning/bounce/pierce/scatter/laser/damage），用于 UI 展示时的友好名称
- **更新导出**：将 `STAT_DISPLAY` 加入 export 列表

```js
const STAT_DISPLAY = {
    pyro:      { name: '火焰', icon: '🔥' },
    cryo:      { name: '冰霜', icon: '❄️' },
    lightning: { name: '闪电', icon: '⚡' },
    // ...
};
```

### 2. `src/ui_system.js`

**导入更新：**
- 新增从 `rune_system.js` 导入 `rune_merge`、`rune_reforge`
- 新增从 `rune_config.js` 导入 `STAT_DISPLAY`

**`_ui_updateRuneInventoryDisplay()` 方法升级：**
- 符文卡片从扁平标签升级为竖向卡片布局
- 每张卡片右上角显示 **Lv.N 等级角标**（Lv.1 为灰色，高等级为金色）
- 支持**点击选中/取消**（选中时显示紫色高亮边框和发光效果）
- 最多同时选中 3 个符文（超出时自动移除最早选中的）
- 选中时卡片左下角显示 ✓ 标记

**新增 `_ui_updateRuneActionButtons()` 方法：**
- 更新选中计数显示（`rune-selected-count` 元素）
- 判断**合成条件**：3 个同 ID 同等级 → 激活合成按钮（金色样式）
- 判断**重铸条件**：任意 3 个 → 激活重铸按钮（紫色样式）
- 未满足条件时按钮置灰并禁用

**新增 `ui_doRuneMerge()` 方法：**
- 调用 `rune_merge(selectedRunes, this.runeInventory)` 执行合成
- 成功/失败均展示操作结果提示

**新增 `ui_doRuneReforge()` 方法：**
- 调用 `rune_reforge(selectedRunes, this.runeInventory, this)` 执行重铸
- 成功/失败均展示操作结果提示

**新增 `_ui_showRuneActionResult()` 方法：**
- 在 `rune-action-result` 元素中展示操作结果（成功绿色/失败红色）
- 3 秒后自动隐藏

**`_ui_updateRuneStatsDisplay()` 方法改进：**
- 使用 `STAT_DISPLAY` 映射显示属性的友好名称（如"🔥 火焰 +3"而非"pyro +3"）

### 3. `index.html`

**符文库存区域改进：**
- 标题行右侧添加 `rune-selected-count` 选中计数显示

**新增合成炉区域：**
- 金色主题区域，标题"合成炉"
- 按钮 `id="rune-merge-btn"`，默认禁用，满足条件时激活
- 点击调用 `game.ui_doRuneMerge()`

**新增重铸炉区域：**
- 紫色主题区域，标题"重铸炉"
- 按钮 `id="rune-reforge-btn"`，默认禁用，选中任意 3 个时激活
- 点击调用 `game.ui_doRuneReforge()`

**新增操作结果提示：**
- `id="rune-action-result"` 元素，默认隐藏，操作后显示成功/失败信息

### 4. `src/game_phase.js`

**新增导入：**
- 从 `rune_config.js` 导入 `RUNE_DB`

**`phase_combat_update()` 中新增符文掉落物处理：**
- 每帧渲染场地上的 `runeLootItems`（调用 `loot.draw(ctx)`）
- 当所有敌人被清除（`activeEnemies === 0`）时，自动拾取场地上的符文
- 拾取时以 `{ id, level: 1 }` 对象格式加入 `runeInventory`
- 拾取后显示 Toast 提示（"拾取符文：[图标] [名称]"）

---

## 设计说明

### 符文选中状态管理

选中状态存储在 `this._selectedRuneIndices`（Set 类型），记录库存数组的索引。每次库存刷新时重新渲染选中状态，确保 UI 与数据同步。

### 合成/重铸条件判断

| 操作 | 条件 | 结果 |
|------|------|------|
| 合成 | 选中 3 个符文，且 id 相同、level 相同 | 消耗 3 个，产出同 id 高一等级的符文 |
| 重铸 | 选中任意 3 个符文 | 消耗 3 个，产出随机新符文（等级为三者平均值） |

### 符文拾取机制

由于游戏为弹珠射击类型，没有玩家角色位置概念，因此采用**战斗结束自动拾取**策略：当场上所有敌人被清除时，自动将场地上的符文掉落物加入库存。