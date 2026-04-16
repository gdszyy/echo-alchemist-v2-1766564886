---
id: "PI-002"
version: "v1.0"
last_updated: "2026-04-16"
author: "tsk-016d0df7-dc0 / tsk-3adf3e31-6cd / tsk-f8acb1ae-bc2"
related_modules: ["rune_system", "combat_system", "ui_system", "rune_launcher"]
status: "active"
---

# PI-002: 符文词条 Hook 注入流程

## 流程概述

向战斗系统注入新的符文词条效果时，需要协调 `rune_config.js`（数据定义）、`combat_system.js` / `collision.js` / `projectile.js`（逻辑注入）、`rune_launcher.js`（UI 数据构建）三个层次。任何一层遗漏都会导致词条效果静默失效或 UI 显示异常。

## 核心防坑指南

### 坑 1: `activeRunewordEffects` 的数据结构与访问方式

**现象**：在 Hook 中访问词条参数时，读取到 `undefined`，导致效果不生效但无报错。

**根因**：`activeRunewordEffects` 由 `rune_launcher.js` 的 `ui_updateRuneGrid` 构建，其格式为：
```js
{ effectId: { level: N, params: { key: finalValue } } }
```
`params` 中存储的是**预计算后的最终值**（已根据 `baseParams + level * perLevelParams` 计算完毕），而非原始的 `baseParams` 或 `perLevelParams`。

**正确做法**：在 Hook 中统一使用 `params.key` 访问预计算值，例如 `params.damageBonus`，而非 `params.baseParams.damageBonus`。

**关键位置**：`src/ui/rune_launcher.js` → `ui_updateRuneGrid` 中的 `activeRunewordEffects` 构建逻辑

---

### 坑 2: 词条效果的注入位置选择

**现象**：词条效果在某些情况下不触发，或触发时机与设计不符。

**根因**：不同类型的词条效果有其特定的最佳注入位置，错误的注入位置会导致效果缺失或重复触发。

**正确做法**：按照以下规则选择注入位置：

| 词条类型 | 推荐注入位置 | 说明 |
|---------|------------|------|
| 伤害加成（乘法） | `combat_damageEnemy` 内对应伤害类型的计算处 | 如熔毁词条在火焰伤害计算处 |
| 激光穿透效果 | `combat/collision.js` → `combat_laser_processPenetration` → `hits.forEach` 内 | 激光命中逻辑 |
| 弹丸属性修改 | `entities/projectile.js` → `Projectile.update()` 或 `Projectile.onHit()` | 弹丸生命周期 |
| 召唤类效果 | `combat_damageEnemy` 内对应触发条件分支（如 `isPierceHit`、`isBounceHit`） | 需检查触发条件标志位 |
| 发射前修改 | `combat_fireNextShot` 函数头部 | 影响整次射击的属性 |

---

### 坑 3: 激光词条的 `_irradiationStacks` 计数器未重置

**现象**：激光照射词条（`irradiation`）在第二次激光发射时，伤害异常偏高，因为上一次的层数被累积到了新一次发射中。

**根因**：`_irradiationStacks` 计数器挂载在 `enemy` 对象上，在每次激光发射前没有重置逻辑。

**正确做法**：在每次激光发射开始时（`combat_fireNextShot` 中激光分支的起始位置），遍历所有敌人并重置 `enemy._irradiationStacks = 0`。

**关键位置**：`src/combat_system.js` → `combat_fireNextShot` 激光发射分支

---

### 坑 4: 词条 UI 的 `Lv.N` 显示与 `activeRunewordEffects` 的兼容性

**现象**：词条卡片上显示的效果数值不随等级变化，始终显示 Lv.1 的数值。

**根因**：UI 渲染函数 `_ui_updateActivatedRunewordsDisplay` 需要从 `activeRunewordEffects[effectId].params` 中读取预计算值，但如果 `effectId` 与 `rune_config.js` 中定义的不一致，会导致读取失败并回退到默认值。

**正确做法**：确保 `rune_config.js` 中词条定义的 `effectId` 字段与 Hook 注入时使用的 `effectId` 字符串**完全一致**（区分大小写）。

**关键位置**：`src/rune_config.js` → `RUNEWORD_DB` 中每个词条的 `effectId` 字段

## 关键耦合点

- **三层联动**：`rune_config.js`（定义）→ `rune_launcher.js`（构建 `activeRunewordEffects`）→ `combat_system.js/collision.js/projectile.js`（消费）。新增词条必须同时修改三层。
- **回合重置**：`game_phase.js` 的 `phase_startCombatPhase` 负责在每回合开始时清空 `activeRunewordEffects`，确保词条状态不跨回合污染。修改词条状态结构时需检查此处的重置逻辑。
- **文档同步**：每次新增词条后，必须同步更新 `.cursor/rules/rune_system.md` 和 `.cursor/rules/runeword_index.md`。

## 版本变更日志

| 版本 | 日期 | 变更内容 | 作者 |
|------|------|---------|------|
| v1.0 | 2026-04-16 | 初始记录，整合多个词条注入任务的经验（tsk-016d0df7-dc0、tsk-3adf3e31-6cd、tsk-f8acb1ae-bc2） | repo-indexer |
