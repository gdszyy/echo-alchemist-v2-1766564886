# Echo Alchemist V2 改造工程 TODO 清单

**最后更新：** 2026年4月11日

## 阶段一：基础设施与知识库搭建 ✅ 全部完成

*目标：建立"代码-文档"协同演进的框架，不涉及大规模业务代码重构。*

- [x] **Task 1.1: 初始化 Git 知识库目录结构** ✅ 已验收 (commit bfcbf28)
  - [x] 创建 `.cursor/rules/` 目录和 `AGENTS.md` 全局规范文件。
  - [x] 创建 `.cursor/rules/global.md`，包含架构概述、模块依赖关系、禁止行为清单。

- [x] **Task 1.2: 提取并归档历史文档** ✅ 已验收
  - [x] 归档 23 个历史任务到 `docs/archive/tasks_summary.md`。
  - [x] 生成 4 个模块规范文件：`audio.md`、`config.md`、`rune_system.md`、`game_phase.md`。
  - [x] 更新 `AGENTS.md` 索引。

- [x] **Task 1.3: 开发统一开发者 Skill（echo-developer）** ✅ 已验收 (docs/skills/echo-developer.md)
  - [x] 6步标准工作流、智能编辑策略决策树（4种模式）和禁止行为清单。

---

## 阶段二：核心模块物理拆分

*目标：降低 Token 消耗，将巨型文件拆分为小文件，为高效编辑铺平道路。*

- [x] **Task 2.1: 拆分 `entities.js`（工具函数与视觉特效）** ✅ 已验收
  - [x] 新增 `src/utils/math_utils.js`（170行）、`src/effects/particles.js`（781行）。
  - [x] `entities.js` 从 6141 行降至 5249 行（减少 14.5%）。
  - [x] 创建 `.cursor/rules/entities.md`。

- [ ] **Task 2.2: 拆分 `entities.js`（核心实体：Enemy 与 Projectile）** 🚀 派发中 ([对话链接](https://manus.im/app/KywSM3XwaEKGqkHQNtAttP))
  - [ ] 提取 `Enemy` 类至 `src/entities/enemy.js`。
  - [ ] 提取 `Projectile` 类至 `src/entities/projectile.js`。
  - [ ] `entities.js` 目标降至 3500 行以内。
  - [ ] 更新 `.cursor/rules/entities.md`。

- [x] **Task 2.3: 拆分 `combat_system.js`（伤害计算与碰撞检测）** ✅ 已验收
  - [x] 新增 `src/combat/damage_calc.js`（273行）、`src/combat/collision.js`（172行）。
  - [x] `combat_system.js` 从 2593 行降至 2258 行。
  - [x] 创建 `.cursor/rules/combat.md`，标记所有 DOM 操作为 `// TODO[Task 3.2]`。

- [x] **Task 2.4: 拆分 `ui_system.js`（UI 渲染模块化）** ✅ 已验收
  - [x] 新增 `src/ui/hud.js`（690行）、`src/ui/shop.js`（328行）、`src/ui/rune_launcher.js`（615行）。
  - [x] `ui_system.js` 从原始行数降至 519 行。
  - [x] 标记 98 处 `// TODO[Task 3.2]` 耦合点；创建 `.cursor/rules/ui_system.md`。

---

## 阶段三：架构解耦与通信重构

*目标：彻底消除巨型 Mixin 带来的状态污染。*

- [ ] **Task 3.1: 完善 EventBus 机制，定义标准事件字典** 🚀 派发中 ([对话链接](https://manus.im/app/bfrrSMwzX54zwzrAEU2DNy))
  - [ ] 扫描所有 `// TODO[Task 3.2]` 标记，整理需替换的 DOM 操作列表。
  - [ ] 定义三段式事件命名规范（`namespace:category:action`）。
  - [ ] 完善 `event_bus.js`（EVENT_TYPES 常量、调试模式、错误处理）。
  - [ ] 创建 `.cursor/rules/events.md` 完整事件字典。

- [ ] **Task 3.2: 消除 UI 层与业务层的强耦合** ⏳ 等待 Task 3.1 完成
  - [ ] 将所有 `// TODO[Task 3.2]` 标记的直接 DOM 操作改为 `eventBus.emit`。
  - [ ] 在 UI 模块中注册对应的事件监听器。

- [ ] **Task 3.3: 移除 `Object.assign` Mixin 模式** ⏳ 等待 Task 3.2 完成
  - [ ] 重构 `core.js`，将混入到 `Game.prototype` 的方法改为组合模式。
  - [ ] 修复由此带来的 `this` 指向问题。
  - [ ] 更新 `.cursor/rules/global.md`，禁止使用 Mixin。
