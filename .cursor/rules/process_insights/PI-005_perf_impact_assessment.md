---
id: "PI-005"
version: "v1.0"
last_updated: "2026-04-16"
author: "code_auditor"
related_modules: ["performance", "combat_system", "effects", "entities", "render_system", "spawn_system"]
status: "active"
---

# PI-005: 性能自适应影响评估流程

## 流程概述

在 Echo Alchemist V2 中，新增或修改任何可能影响渲染性能的代码（特效、粒子、Canvas 混合模式、高频计算）时，必须执行“性能自适应影响评估”。本洞察记录了评估标准、标记规范以及已知性能瓶颈的处理优先级，确保游戏在中低端设备上的帧率稳定性。

## 核心防坑指南

### 坑 1: 忽视高频触发场景下的性能开销

**现象**：在单一测试场景下，新增的特效表现流畅（60fps），但在实际游戏中的“清场”或“高频连击”场景下，帧率断崖式下跌。

**根因**：特效对象（如 `DeathExplosion`、`IceWave`、`EnergyOrb`）缺乏全局数量上限检查，或者在每帧的渲染循环中高频调用了高开销 API（如 `createRadialGradient`、`shadowBlur`、`lighter`）。

**正确做法**：
1. 任何新增的特效对象，**必须**在 `CONFIG.performance` 中定义三档数量上限。
2. 在特效类的 `draw` 方法中，**必须**通过 `game.perfQualityLevel` 读取当前性能等级，并根据等级执行不同的渲染逻辑（如 `low` 档关闭 `shadowBlur` 和 `lighter`）。
3. 避免在主循环中执行 O(n) 全量扫描或频繁创建 CanvasGradient 对象，应尽可能使用对象池或缓存预渲染。

**关键位置**：`src/config.js` → `CONFIG.performance`，`src/effects/particles.js`，`src/render_system.js`

---

### 坑 2: 漏标可能影响性能的代码修改

**现象**：后续接手的 Agent 无法快速识别哪些代码块涉及性能敏感的渲染操作，导致在重构或修复 Bug 时意外破坏了性能门控逻辑。

**根因**：缺乏统一的标记规范，使得性能敏感代码与普通业务逻辑混杂。

**正确做法**：
1. 在修改涉及 Canvas 混合模式、发光属性、渐变重建或复杂遍历的代码块上方，添加 `// @perf-impact: [影响简述] - [处理方式]` 标记。
2. 在 Git 提交信息的末尾添加 `[perf-impact]` 标签。

**代码示例**：
```javascript
// @perf-impact: 新增冰霜爆裂特效 - 已接入 iceWaveLimit 预算并分级渲染
if (this.iceWaves.length < CONFIG.performance[game.perfQualityLevel].iceWaveLimit) {
    this.iceWaves.push(new IceWave(x, y));
}
```

## 关键耦合点

- `CONFIG.performance` 的三档配置必须与 `game.perfQualityLevel` 的取值（`'high'`/`'medium'`/`'low'`）严格对应。
- `spawn_system.js` 中的基础粒子生成入口（`spawn_createParticle` 和 `spawn_pushParticleWithLimit`）已接入全局粒子预算，但独立特效对象（如 `IceWave`、`DeathExplosion`）需在其自身的创建入口单独检查预算。
- 性能评估结果必须在 PR 或任务总结中显式声明，说明在三档（high/medium/low）下的表现。

## 已知性能瓶颈处理优先级（基准参考）

根据 `docs/perf-optimization-index.md` 的全量审计结果，以下 58 处已知瓶颈的处理优先级如下，供后续 Agent 修复时参考：

### 紧急修复（极高优先级，24 处）
- **核心目标**：消除清场卡顿和高频触发导致的帧率断崖。
- **重点任务**：
  - 建立全局特效预算管理池（拦截超出预算的 `IceWave`、`DeathExplosion`、`EnergyOrb` 等实例创建）。
  - 为 `particles.js` 全局接入 `perfQualityLevel` 门控（在 `low` 档直接跳过 `shadowBlur` 和 `lighter` 调用）。
  - 修复 `spawn_createParticle` 的 O(n) 遍历（替换 7 次 `Array.filter()` 为分类计数器变量）。

### 高优先级优化（21 处）
- **核心目标**：减少常规游戏过程中的渲染开销。
- **重点任务**：
  - 缓存渐变对象与预渲染（如 Boss 光晕、属性轨道球的 `CanvasGradient` 或 `OffscreenCanvas`）。
  - 为实体渲染添加 `perfQualityLevel` 门控（如 `drawLayoutRoleStyle`、`Ball.draw`、词缀渲染）。
  - 清理高频 `console.log` 调用。

### 中低优先级优化（13 处）
- **核心目标**：消除累积性能损耗和边界情况。
- **重点任务**：
  - 修复绕过门控的特效创建（如 Boss 入场冲击波、smoke 粒子）。
  - 拆分 `waveLimit` 语义（分离 `FireWave` 和 `HealWave` 的配额）。
  - 合并同心圆绘制（消除重复 `shadowBlur` 调用）。

## 版本变更日志

| 版本 | 日期 | 变更内容 | 作者 |
|------|------|---------|------|
| v1.0 | 2026-04-16 | 初始记录，定义性能影响评估规范，并整合 58 处已知瓶颈的修复优先级 | code_auditor |
