# Echo Alchemist V2 改造工程 TODO 清单

**最后更新：** 2026年4月11日

## 阶段一：基础设施与知识库搭建 ✅ 全部完成

- [x] **Task 1.1** 初始化 Git 知识库目录结构 ✅ 已验收 (commit bfcbf28)
- [x] **Task 1.2** 提取并归档历史文档（23个任务 + 4个模块规范 MD）✅ 已验收
- [x] **Task 1.3** 开发统一开发者 Skill（echo-developer）✅ 已验收

---

## 阶段二：核心模块物理拆分 ✅ 全部完成

| 任务 | 关键交付物 | 结果 |
| :--- | :--- | :--- |
| Task 2.1 entities.js 工具/特效 | `math_utils.js`(170行) + `particles.js`(781行) | ✅ 已验收 |
| Task 2.2 entities.js 核心实体 | `enemy.js`(1321行) + `projectile.js`(784行)，entities.js 降至 3245 行 | ✅ 已验收 |
| Task 2.3 combat_system.js 拆分 | `damage_calc.js`(273行) + `collision.js`(172行) | ✅ 已验收 |
| Task 2.4 ui_system.js 拆分 | `hud.js`(690行) + `shop.js`(328行) + `rune_launcher.js`(615行) | ✅ 已验收 |

**阶段二成果：** entities.js 从 6141 行降至 3245 行（降幅 47%），ui_system.js 从 ~2021 行降至 519 行（降幅 74%）。

---

## 阶段三：架构解耦与通信重构

- [x] **Task 3.1** 完善 EventBus + 定义标准事件字典 ✅ 已验收
  - 16 个标准事件，覆盖 119 处 TODO[Task 3.2] 标记
  - event_bus.js 新增 EVENT_TYPES 常量、调试模式、错误隔离

- [x] **Task 3.2** 消除 UI 层与业务层的强耦合 ✅ 已验收（commit 2d8b226，分支已合并）
  - combat_system.js 新增 11 处 eventBus.emit，hud.js 注册 8 个监听器
  - event_bus.js 扩展 10 个 UI 类事件常量，所有 TODO[Task 3.2] 标记已清零

- [ ] **Task 3.3** 移除 `Object.assign` Mixin 模式 🚀 派发中 ([对话链接](https://manus.im/app/bkMXLYbuXCXyp3hFRWR2fe))
  - 将 core.js 末尾的 Object.assign(Game.prototype, ...) 改为组合模式
  - 10 个子系统（270+ 个方法）逐步迁移，采用渐进式 bind 方案
  - 更新 global.md 明确禁止 Mixin 模式
