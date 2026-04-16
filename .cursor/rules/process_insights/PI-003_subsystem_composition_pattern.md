---
id: "PI-003"
version: "v1.0"
last_updated: "2026-04-16"
author: "tsk-383d739f-d25 / tsk-3b0fed00-b7e"
related_modules: ["core", "game_system", "combat_system", "ui_system"]
status: "active"
---

# PI-003: 子系统扩展与组合模式注入流程

## 流程概述

自 Task 3.3 完成后，`core.js` 已完全移除 `Object.assign(Game.prototype, ...)` Mixin 模式，改为**构造函数组合模式（Composition via bind）**。本洞察记录了在此架构下新增或修改子系统时的正确流程，以及历史上曾出现的迁移陷阱。

## 核心防坑指南

### 坑 1: 误用 `Object.assign(Game.prototype, ...)` 新增子系统

**现象**：新增子系统后，其方法可以被调用，但非函数属性（如 `_flyEffectPool: []`）在多次游戏重置后出现数据污染——所有实例共享同一个数组引用。

**根因**：`Object.assign(Game.prototype, ...)` 将属性挂载到**原型链**上，所有 `Game` 实例共享同一个引用。虽然游戏只有一个实例，但在游戏重置（`sys_resetGame`）时，如果没有显式重新初始化这些属性，旧数据会残留。

**正确做法**：新增子系统必须遵循组合模式，在 `core.js` 构造函数的 `_subsystems` 数组中注册，而非在文件末尾使用 `Object.assign`。组合模式会在每次 `new Game()` 时将属性浅拷贝到实例上，确保每个实例拥有独立副本。

**关键位置**：`src/core.js` → `Game` 构造函数开头的 `_subsystems` 数组

---

### 坑 2: 子系统文件中的 `this` 指向问题

**现象**：在子系统文件（如 `game_system.js`）中，方法内的 `this` 指向 `undefined` 或全局对象，而非 `Game` 实例。

**根因**：子系统文件以对象字面量形式导出方法，直接调用时 `this` 不会自动指向 `Game` 实例。

**正确做法**：通过组合模式注入后，`bind(this)` 已在构造时将 `this` 静态绑定到 `Game` 实例，子系统文件本身**无需任何修改**。如果在子系统文件外部直接调用这些方法（如 `game_system.someMethod()`），则会丢失 `this` 绑定，这是错误的调用方式。所有子系统方法必须通过 `game` 实例调用（如 `game.someMethod()`）。

---

### 坑 3: 注释和文档中残留的 Mixin 模式描述

**现象**：新 Agent 读取代码注释或旧文档后，误以为项目仍在使用 Mixin 模式，按照旧模式新增子系统，导致架构回退。

**根因**：Task 3.3 完成后，部分子系统文件（如 `ui_system.js`、`hud.js`、`shop.js`、`rune_launcher.js`）的注释中仍残留了 `Object.assign Mixin 模式` 的描述，与实际架构不符。

**正确做法**：在修改任何子系统文件时，如果发现注释中提到 `Object.assign` 或 `Mixin`，必须同步将其更新为 `bind(this) 组合模式` 的描述。这是活文档契约的一部分。

**关键位置**：`.cursor/rules/ui_system.md` 第 2 节和第 4.2 节（已于 tsk-3b0fed00-b7e 修正）

---

### 坑 4: 新增子系统的非函数属性初始化

**现象**：新增子系统中定义了 `someArray: []`，在游戏运行中向其 push 数据后，调用 `sys_resetGame` 重置游戏，发现数组中的数据没有被清空。

**根因**：组合模式在构造时对数组进行**浅拷贝**（`[...val]`），但 `sys_resetGame` 中可能没有针对新属性的重置逻辑。

**正确做法**：新增子系统后，必须在 `game_system.js` 的 `sys_resetGame` 函数中**显式添加对新属性的重置逻辑**（如 `this.someArray = []`）。不能依赖构造函数的初始化来替代游戏重置。

**关键位置**：`src/game_system.js` → `sys_resetGame`

## 关键耦合点

- `_subsystems` 数组的顺序可能影响方法名冲突检测。添加新子系统前，应验证新子系统的方法名与现有 10 个子系统中的方法名不重复（可通过 `node --check` 和运行时验证）。
- 组合模式创建的是**实例方法**，不在原型链上，因此 `Game.prototype.someMethod` 的方式无法访问这些方法。

## 版本变更日志

| 版本 | 日期 | 变更内容 | 作者 |
|------|------|---------|------|
| v1.0 | 2026-04-16 | 初始记录，整合 Task 3.3 Mixin 迁移经验（tsk-383d739f-d25）和文档修正经验（tsk-3b0fed00-b7e） | repo-indexer |
