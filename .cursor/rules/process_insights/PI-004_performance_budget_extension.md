---
id: "PI-004"
version: "v1.0"
last_updated: "2026-04-16"
author: "tsk-c09a932b-213"
related_modules: ["performance", "spawn_system", "combat_system", "entities"]
status: "active"
---

# PI-004: 性能预算扩展与新特效接入流程

## 流程概述

向游戏中新增粒子特效或高开销视觉效果时，必须将其纳入自适应性能预算体系（`CONFIG.performance`），否则在极端战斗场景（如清场技能触发大量死亡特效）下会导致帧率雪崩。本洞察记录了正确的接入流程和已知的遗漏特效清单。

## 核心防坑指南

### 坑 1: 新增特效未接入 `CONFIG.performance` 预算

**现象**：新特效在单个触发时表现正常，但在多敌人同时死亡或高频技能触发时，帧率从 60fps 骤降至 10fps 以下。

**根因**：特效创建逻辑中没有读取 `CONFIG.performance[this.perfQualityLevel || 'high'].xxxLimit` 的上限检查，导致同屏特效数量无限增长。

**正确做法**：每个新增的特效类或特效创建调用，必须遵循以下步骤：
1. 在 `src/config.js` 的 `CONFIG.performance` 三档（`high`/`medium`/`low`）中添加对应的上限字段（如 `iceWaveLimit: [10, 6, 3]`）。
2. 在特效创建处添加预算检查：
   ```js
   const limit = CONFIG.performance[this.perfQualityLevel || 'high'].iceWaveLimit;
   if (this.iceWaves.length < limit) {
       this.iceWaves.push(new IceWave(...));
   }
   ```
3. 在 `.cursor/rules/performance.md` 的特效预算表中注册新字段。

**关键位置**：`src/config.js` → `CONFIG.performance` 对象 / `src/effects/particles.js` → 各特效类的创建调用处

---

### 坑 2: 已知未接入预算的高风险特效（截至 2026-04-16）

以下特效尚未接入自适应性能预算，在高频触发场景下存在严重性能风险：

| 特效类名 | 触发场景 | 风险等级 | 建议上限（high/medium/low） |
|---------|---------|---------|--------------------------|
| `DeathExplosion` | 所有敌人死亡时必定触发 | **极高** | 15/8/4（分级渲染策略） |
| `EnergyOrb` | 弹丸命中时飞向 UI 槽 | **极高** | 40/20/10（聚合策略） |
| `LaserBeam` | 激光发射或折射时 | **高** | 需限制折射次数或关闭边缘发光 |
| `IceWave` | 冰冻敌人死亡时 | **中** | 10/6/3 |
| `CollectionBeam` | 特殊槽收集机制触发时 | **低** | 8/5/2 |

---

### 坑 3: `DeathExplosion` 不能简单限制数量

**现象**：直接为 `DeathExplosion` 添加数量上限后，部分敌人死亡时没有任何视觉反馈，玩家体验严重下降。

**根因**：`DeathExplosion` 是每个敌人死亡时的**必要视觉反馈**，不能直接跳过创建。

**正确做法**：对 `DeathExplosion` 应采用**分级渲染策略**而非数量限制：
- `high` 模式：完整渲染（内缩环 + 虚空渐变 + 灵魂粒子）
- `medium` 模式：关闭灵魂粒子，保留内缩环和简单中心变暗
- `low` 模式：仅保留最外层一道内缩环，关闭所有渐变和混合模式

在 `DeathExplosion.draw()` 方法中，通过读取 `game.perfQualityLevel` 来决定渲染复杂度。

---

### 坑 4: `EnergyOrb` 高频触发的聚合优化

**现象**：使用剑刃风暴、激光持续照射等高频伤害词条时，屏幕上同时存在数百个飞向 UI 的能量球，导致严重卡顿。

**根因**：每次命中都创建一个独立的 `EnergyOrb` 实例，高频技能在极短时间内产生大量实例。

**正确做法**：在 `spawn_createHitFeedback` 中引入**短时间窗口聚合机制**：在 100ms 时间窗口内，将多次命中的能量值累加，合并为一个较大的 `EnergyOrb`（如 10 次命中合并为 1 个价值 10 的能量球），而非创建 10 个独立实例。

**关键位置**：`src/spawn_system.js` → `spawn_createHitFeedback`

## 关键耦合点

- `CONFIG.performance` 的三档配置必须与 `game.perfQualityLevel` 的取值（`'high'`/`'medium'`/`'low'`）严格对应，不得使用其他字符串。
- 新增预算字段后，必须同步更新 `.cursor/rules/performance.md` 的预算表（第 3 节或第 4 节），这是活文档契约的强制要求。
- `spawn_system.js` 中的 `spawn_pushParticleWithLimit` 函数是基础粒子的统一入口，高级特效类（`IceWave`、`DeathExplosion` 等）不经过此函数，需要在各自的创建调用处单独添加预算检查。

## 版本变更日志

| 版本 | 日期 | 变更内容 | 作者 |
|------|------|---------|------|
| v1.0 | 2026-04-16 | 初始记录，整合粒子特效性能评估报告（tsk-c09a932b-213）的发现与建议 | repo-indexer |
