# Task 3: 符文基础属性层数应用 - 修改说明

## 任务概述

实现符文等级对弹药属性层数的基础加成，使放置在网格中的符文直接提升对应属性。

## 修改文件列表

### 1. `src/rune_config.js`

**修改内容：** 为 RUNE_DB 中的每个符文对象添加 `baseStat` 字段。

- `baseStat` 字段与 `element` 字段值相同，用于 `calcRuneBaseStats()` 函数识别该符文对应的弹药属性键
- 共为 14 个符文（pyro×2, cryo×2, lightning×2, bounce×2, pierce×2, scatter×1, laser×2）添加了 `baseStat` 字段
- 在 RUNE_DB 注释中补充了 `baseStat` 字段的说明

**示例：**
```js
{
    id: 'rune_pyro_1',
    name: '烈焰符文',
    element: 'pyro',
    baseStat: 'pyro',   // 新增字段
    icon: '🔥',
    ...
}
```

### 2. `src/rune_system.js`

**修改内容：** 新增 `calcRuneBaseStats()` 函数，并更新 `export` 语句。

- **新增函数 `calcRuneBaseStats(runeGrid, runeDb)`：**
  - 遍历 `runeGrid`（9个格子），根据每个符文的 `baseStat` 字段和 `level` 值累加属性层数
  - 兼容两种网格格式：字符串格式（旧，`level` 默认为 1）和对象格式（新，`{ id, level }`）
  - 返回基础属性加成对象，如 `{ pyro: 3, bounce: 2 }`
  - 若符文无 `baseStat` 字段，自动回退到 `element` 字段
- **更新 `parseRuneGrid()` 函数：** 兼容对象格式的网格元素（通过内部 `getRuneId` 辅助函数提取 ID）
- **更新 `export` 语句：** 新增导出 `calcRuneBaseStats`

### 3. `src/combat_system.js`

**修改内容：** 在 `combat_fireNextShot()` 中，在现有词条加成逻辑之后，新增基础属性层数叠加逻辑。

- **新增导入：** `calcRuneBaseStats` 从 `./rune_system.js`，`RUNE_DB` 从 `./rune_config.js`
- **新增逻辑段（位于词条加成逻辑之后）：**
  ```js
  // --- [符文基础属性] 将 calcRuneBaseStats() 的基础属性层数叠加到当前弹药配方 ---
  if (this.runeGrid && Array.isArray(this.runeGrid)) {
      const baseStats = calcRuneBaseStats(this.runeGrid, RUNE_DB);
      for (const [key, val] of Object.entries(baseStats)) {
          if (typeof val === 'number' && val > 0) {
              if (key === 'laser') {
                  finalRecipe.laser = (finalRecipe.laser || 0) + val;
                  if (finalRecipe.laser > 0) finalRecipe.isLaser = true;
              } else {
                  finalRecipe[key] = (finalRecipe[key] || 0) + val;
              }
          }
      }
  }
  ```
- 与词条加成逻辑分离，便于独立调试和扩展

### 4. `src/ui_system.js`

**修改内容：** 在 `ui_updateRuneGrid()` 中调用 `calcRuneBaseStats()` 并在 UI 展示基础加成汇总。

- **新增导入：** `calcRuneBaseStats` 从 `./rune_system.js`（与 `parseRuneGrid` 合并导入）
- **`ui_updateRuneGrid()` 新增步骤 6：** 调用 `calcRuneBaseStats(this.runeGrid, RUNE_DB)` 计算基础属性加成
- **`_ui_updateRuneStatsDisplay()` 函数更新：**
  - 新增 `baseStats` 参数（默认为 `{}`）
  - 分区展示：「基础属性」（蓝色标签）和「词条共鸣」（金色标签）
  - 当网格中有符文时，即使无词条激活，也会显示基础属性加成

### 5. `index.html`

**修改内容：** 更新「属性加成汇总」区域的注释，说明 JS 动态生成的内容结构。

## 设计说明

### 双重增益机制

符文系统实现了两层独立的属性加成：

| 加成类型 | 来源 | 计算函数 | UI 颜色 |
|---------|------|---------|--------|
| 基础属性加成 | 符文等级（每个格子中的符文贡献 level 层数） | `calcRuneBaseStats()` | 蓝色标签 |
| 词条共鸣加成 | 符文排列匹配词条 pattern | `parseRuneGrid()` | 金色标签 |

### 兼容性设计

- `calcRuneBaseStats()` 兼容字符串格式（`runeGrid[i] = 'rune_pyro_1'`，level=1）和对象格式（`runeGrid[i] = { id: 'rune_pyro_1', level: 2 }`）
- 当前游戏使用字符串格式，每个符文贡献 1 层基础属性；未来升级为对象格式后可自动支持多等级

## 关联任务

- **依赖：** Task 1（符文数据结构设计，`RUNE_DB.baseStat` 字段）
- **本任务：** Task 3（符文基础属性层数应用）
