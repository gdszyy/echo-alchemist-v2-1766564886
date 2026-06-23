# Task 1: 符文系统数据结构升级 变更说明

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

```javascript
// 修改后注释
// Task 1: 数据结构升级 - runeInventory 和 runeGrid 存储对象格式 { id: string, level: number }
// 例如: { id: 'rune_pyro_1', level: 1 }
this.runeInventory = [];
this.runeGrid = Array(9).fill(null);
```

---

### 3. `src/game_system.js`

**变更类型**: 功能新增

**修改内容**:
- 在 `sys_resetGame()` 函数中添加符文系统的局内重置逻辑
- 每次开始新局时清空 `runeInventory`、`runeGrid`、`activeRunewordStats` 和 `runeLootItems`

```javascript
// 新增代码
// Task 1: 数据结构升级 - 局内重置时清空符文库存和网格
this.runeInventory = [];
this.runeGrid = Array(9).fill(null);
this.activeRunewordStats = {};
this.runeLootItems = [];
```

---

### 4. `src/rune_system.js`

**变更类型**: 向后兼容升级

**修改内容**:
- 新增 `getRuneId(entry)` 辅助函数，统一从网格条目中提取符文 ID
  - 支持旧格式（字符串）：直接返回字符串
  - 支持新格式（对象 `{ id, level }`）：返回 `entry.id`
  - 支持 `null/undefined`：返回 `null`
- 修改 `parseRuneGrid()` 函数，在解析前将网格统一转换为 ID 数组
- 更新 JSDoc 注释，说明支持新旧两种格式
- 导出 `getRuneId` 函数供其他模块使用

```javascript
// 新增辅助函数
function getRuneId(entry) {
    if (entry === null || entry === undefined) return null;
    if (typeof entry === 'string') return entry; // 向后兼容旧格式
    if (typeof entry === 'object' && entry.id) return entry.id; // 新格式
    return null;
}
```

---

### 5. `src/ui_system.js`

**变更类型**: 向后兼容升级

**修改内容**:
- 导入 `getRuneId` 函数
- 修改 `ui_initRuneGrid()` 中的点击处理逻辑：
  - 移除符文时保留原始对象格式（不再解包为字符串）
- 修改 `ui_openRunePicker()` 函数：
  - 使用 `getRuneId()` 提取符文 ID
  - 显示符文等级（`Lv.X`）
  - 移除符文时优先通过对象引用匹配，回退时通过 ID 和等级匹配
  - 放入网格时保留原始对象格式
- 修改 `ui_updateRuneGrid()` 函数：
  - 使用 `getRuneId()` 提取符文 ID
  - 显示等级徽章（等级 > 1 时显示）
- 修改 `_ui_updateRuneInventoryDisplay()` 函数：
  - 使用 `getRuneId()` 提取符文 ID
  - 显示等级信息（等级 > 1 时显示）

---

## 设计原则

本次修改遵循以下原则：

1. **向后兼容**: 所有读取符文数据的地方均通过 `getRuneId()` 辅助函数兼容旧的字符串格式，确保现有数据不会损坏
2. **最小侵入**: 仅修改必要的文件，不改变游戏的整体架构
3. **局内重置**: `runeInventory` 和 `runeGrid` 属于局内状态，在 `sys_resetGame()` 中清空，不影响局外存档

## 后续任务

本次数据结构升级为以下功能奠定基础：
- Task 2: 符文掉落与拾取系统（在 `combat_system.js` 和 `game_phase.js` 中实现）
- Task 3: 符文合成与重铸系统（新增 UI 交互）
- Task 4: 基础属性加成应用（在 `ui_system.js` 的 `ui_updateRuneGrid()` 中累加 baseStat）
