# Echo Alchemist V2 改造工程 TODO 清单

**最后更新：** 2026年4月11日

## 阶段一：基础设施与知识库搭建

*目标：建立"代码-文档"协同演进的框架，不涉及大规模业务代码重构。*

- [x] **Task 1.1: 初始化 Git 知识库目录结构** ✅ 已验收 (commit bfcbf28)
  - [x] 在仓库根目录创建 `.cursor/rules/` 目录。
  - [x] 创建根路由文件 `AGENTS.md`，定义全局规范（禁用全量交付、代码风格等）和子模块规范索引。
  - [x] 创建 `.cursor/rules/global.md`，包含架构概述、模块依赖关系、禁止行为清单。

- [ ] **Task 1.2: 提取并归档历史文档** 🚀 派发中 ([对话链接](https://manus.im/app/WwnPSWU72uJR6ToR8mcMkY))
  - [ ] 将 `tasks/` 目录下的历史设计文档整理并汇总到 `docs/archive/tasks_summary.md`。
  - [ ] 从现有代码中提取知识，生成 `.cursor/rules/audio.md`、`.cursor/rules/config.md`、`.cursor/rules/rune_system.md`、`.cursor/rules/game_phase.md`。
  - [ ] 更新 `AGENTS.md` 索引。

- [x] **Task 1.3: 开发统一开发者 Skill（echo-developer）** ✅ 已验收 (docs/skills/echo-developer.md)
  - [x] 编写 `echo-developer` Skill，强制执行"先读 AGENTS.md -> 找对应模块 MD -> 修改代码 -> 更新模块 MD"的标准工作流。
  - [x] 内嵌智能编辑策略决策树（4种模式）和禁止行为清单。

---

## 阶段二：核心模块物理拆分

*目标：降低 Token 消耗，将巨型文件拆分为小文件，为高效编辑铺平道路。*

- [ ] **Task 2.1: 拆分 `entities.js`（工具函数与视觉特效）** 🚀 派发中 ([对话链接](https://manus.im/app/HPRcNrgREVnuQGR2v3N4BP))
  - [ ] 提取数学计算、通用工具函数至 `src/utils/math_utils.js`。
  - [ ] 提取视觉特效类（Particle、Shockwave 等）至 `src/effects/particles.js`。
  - [ ] 创建并完善 `.cursor/rules/entities.md`。

- [ ] **Task 2.2: 拆分 `entities.js`（核心实体：Enemy、Projectile）** ⏳ 等待 Task 2.1 完成
  - [ ] 将 `Enemy`、`Projectile`、`Player` 等核心实体剥离为独立文件。
  - [ ] 更新 `.cursor/rules/entities.md`。

- [ ] **Task 2.3: 拆分 `combat_system.js`（伤害计算与碰撞检测）** 🚀 派发中 ([对话链接](https://manus.im/app/X7m2mtrkRZdBLpfMkgo3YV))
  - [ ] 提取伤害计算逻辑至 `src/combat/damage_calc.js`。
  - [ ] 提取碰撞检测逻辑至 `src/combat/collision.js`。
  - [ ] 标记所有 DOM 操作为 `// TODO[Task 3.2]`。
  - [ ] 创建 `.cursor/rules/combat.md`。

- [ ] **Task 2.4: 拆分 `ui_system.js`（UI 渲染模块化）** 🚀 派发中 ([对话链接](https://manus.im/app/LyQzoFPn9PABUkt8PGYGgG))
  - [ ] 提取 HUD 渲染逻辑至 `src/ui/hud.js`。
  - [ ] 提取商店渲染逻辑至 `src/ui/shop.js`。
  - [ ] 标记所有 Game 实例直接访问为 `// TODO[Task 3.2]`。
  - [ ] 创建 `.cursor/rules/ui.md`。

---

## 阶段三：架构解耦与通信重构

*目标：彻底消除巨型 Mixin 带来的状态污染。*

- [ ] **Task 3.1: 完善 EventBus 机制** ⏳ 等待阶段二完成
  - [ ] 梳理并定义全系统标准事件字典，记录于 `.cursor/rules/events.md`。
  - [ ] 完善 `event_bus.js` 的错误处理和调试能力。

- [ ] **Task 3.2: 消除 UI 层与业务层的强耦合** ⏳ 等待 Task 3.1 完成
  - [ ] 重构业务模块，移除所有 `// TODO[Task 3.2]` 标记的直接 DOM 操作。
  - [ ] 改为通过 EventBus 触发事件，由 UI 模块监听并更新视图。

- [ ] **Task 3.3: 移除 `Object.assign` Mixin 模式** ⏳ 等待 Task 3.2 完成
  - [ ] 重构 `core.js`，将混入到 `Game.prototype` 的方法改为独立导出并按需导入。
  - [ ] 修复由此带来的 `this` 指向问题。
