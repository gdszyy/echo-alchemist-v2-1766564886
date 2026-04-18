# Echo Alchemist V2 改造工程 TODO 清单

**最后更新：** 2026年4月18日 | **状态：⏳ 掉落驱动闭环修复进行中**

---

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

## 阶段三：架构解耦与通信重构 ✅ 全部完成

- [x] **Task 3.1** 完善 EventBus + 定义标准事件字典 ✅ 已验收
  - 16 个标准事件（三段式命名），覆盖 119 处 TODO[Task 3.2] 标记
  - event_bus.js 新增 EVENT_TYPES 常量、调试模式、错误隔离

- [x] **Task 3.2** 消除 UI 层与业务层的强耦合 ✅ 已验收（commit 2d8b226）
  - combat_system.js 新增 11 处 eventBus.emit，hud.js 注册 8 个监听器
  - 所有 TODO[Task 3.2] 标记已清零（119 → 0）

- [x] **Task 3.3** 移除 `Object.assign` Mixin 模式 ✅ 已验收（PR #48 已合并）
  - core.js 末尾的 Object.assign(Game.prototype, ...) 已完全移除
  - 改为构造函数中 bind(this) 组合模式，10 个子系统全部迁移
  - global.md 新增第 5 节「子系统扩展规范」，明确禁止 Mixin 模式

---

## 阶段四：掉落驱动主流程闭环与抽象收尾 ⏳ 进行中

当前仓库已经补上了 **round-start reward queue**、**非 Boss 掉落驱动**、**混沌精华 / 纯净精华命运时刻**、**纯净精华 x2 同化率**、**存档恢复上下文** 等核心闭环，但内部仍存在一层尚未彻底抽离的旧语义：特殊流程在实现层仍大量复用 `selection` 阶段和历史入口。这一抽象工作并不是“代码美化”，而是为了避免后续继续在 UI、教程、暂停、存档、overlay 返回流中到处追加 `if (selectionMode === ...)` 之类的分支，最终重新形成新的隐性耦合。

| 任务 | 必要性 | 计划内容 | 当前状态 |
| :--- | :--- | :--- | :--- |
| Task 4.1 命运时刻阶段语义抽象 | 目前 `selection` 仍同时承载常规选择与命运时刻，阶段语义不够单一，后续维护成本高 | 统一梳理 `phase`、标题、教程、暂停、overlay 返回、顶部栏标签中的命运时刻语义，明确哪些继续复用 `selection` overlay，哪些上升为 `fate_moment` 语义层 | ⏳ 待检查后拆分 |
| Task 4.2 选择态与命运时刻状态模型收口 | 目前 `selectionMode`、`pendingSelectionMode`、`fateMomentContext`、`selectionPreviewState` 已可用，但职责边界仍需进一步收敛 | 明确“待触发上下文”“运行中上下文”“UI 预览态”“overlay 返回态”的边界，避免后续继续散落到多个模块各自判断 | ⏳ 待检查后收口 |
| Task 4.3 round-start resolver 与阶段切换契约固化 | 当前主流程已通，但仍需确认所有恢复入口、关闭入口、失败回退入口都不会重新跳回旧固定流程 | 系统检查 `sys_startRoundStartResolver()`、`ui_closeRelicSelection()`、继续游戏、教程等待点、暂停限制、游戏结束清档等链路 | ⏳ 正在检查 |
| Task 4.4 TODO / 文档 / 测试清单同步 | 旧 TODO 已显示“全部完成”，不再反映当前修复与抽象工作的真实状态 | 持续把新增闭环、抽象必要性、验证范围和待办项回写到 TODO 与规则文档，并补测试检查清单 | ⏳ 进行中 |

### 阶段四检查记录（持续更新）

| 日期 | 检查点 | 发现 | 结论 |
| :--- | :--- | :--- | :--- |
| 2026-04-18 | 顶部栏与阶段语义一致性 | 已新增 `ui_isFateMomentPhase()`，并让 `ui_updateUI()`、阶段标题、顶部短标签统一通过该语义判断控制显示；命运时刻期间不再被 `selection` 的旧隐藏规则整体吞掉 | 该项已完成第一轮抽象收口，后续仅需视是否正式引入 `fate_moment` phase 再做深化 |
| 2026-04-18 | 教程系统与命运时刻兼容性 | 教程进入弹珠选择的等待条件已补上“非命运时刻”过滤，避免 `PHASE_CHANGED -> selection` 在命运时刻期间误推进旧教程 | 主要误触发风险已收口，但 `phase: 'selection'` / `targetId: 'phase-selection'` 仍是后续深化抽象时的关注点 |
| 2026-04-18 | 遗物 overlay 返回 resolver 链路 | `ui_closeRelicSelection()` 已能在 `returnState.phase === 'round_start_resolver'` 时回到 `sys_continueRoundStartResolver()`，在 `returnState.phase === 'selection'` 时恢复当前命运时刻界面 | 该链路当前已基本闭环，属于已验证通过项 |
| 2026-04-18 | 继续游戏 / 新开局 / 游戏结束入口 | `sys_loadRunState()` 恢复后会重新进入 `sys_startRoundStartResolver()`；`meta_startRun()` 与 `_gameover_triggerPhase()` 也都先清除局内存档，再进入新局或结算 | 入口层没有发现重新跳回旧固定选择流程的问题，当前判断为通过 |

## 改造工程总结

| 指标 | 改造前 | 改造后 | 变化 |
| :--- | :--- | :--- | :--- |
| entities.js 行数 | 6,141 行 | 3,245 行 | **-47%** |
| ui_system.js 行数 | ~2,021 行 | 519 行 | **-74%** |
| 最大单文件 Token 估算 | ~63,000 | ~33,000 | **-48%** |
| 模块规范文档 | 0 个 | 9 个 | +9 |
| 标准事件类型 | 0 个 | 26 个 | +26 |
| Game.prototype 方法来源 | Mixin（全局污染） | bind 组合（实例隔离） | 架构升级 |

---

## 维护与修复记录 (2026.04.12) ✅

- [x] **BugFix 4.1** 生产环境 UI 崩溃修复 ✅
  - 修复了 `systems.js` 和 `shop.js` 在缺失 DOM 元素时的脚本中断问题。
  - 统一了商店购买接口 `meta_buyUpgrade` 的命名与参数传递。
  - 补全了 `systems.js` 中 `UIManager`、`TruthBook`、`TrainingGround` 的空值防御。
- [x] **BugFix 4.2** 修复 `src/ui_system.js` 语法错误 ✅
  - 修复了 `src/ui_system.js` 因缺失闭合括号 `};` 导致的 `Uncaught SyntaxError: Unexpected end of input`。
  - 验证了项目中所有 `.js` 文件的语法完整性。
