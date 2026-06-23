---
id: "PI-006"
version: "v1.1"
last_updated: "2026-04-18"
author: "tsk-33b634db-ac8"
related_modules: ["game_phase", "game_system", "core", "ui/shop"]
status: "active"
---

# PI-006: Round-Start 延迟奖励结算流程

## 流程概述

当遗物不再由固定回合触发，而是由首局初始化或非 Boss 敌人死亡后延迟到下一回合开始统一结算时，真实的风险点不在掉落概率本身，而在**阶段推进与 UI 恢复目标**。如果继续沿用“遗物弹窗关闭后默认回到 selection/gathering”的旧逻辑，就会把剩余奖励队列、存档恢复和回合切换打散。

## 核心防坑指南

### 坑 1: 在 `phase_finalizeRound()` 里直接 `sys_initSelectionPhase()`

**现象**：非 Boss 敌人已经登记了遗物或精华，但下一回合开始直接进入选牌，待结算奖励被跳过。
**根因**：回合结束后仍沿用旧的固定入口，未经过 `pendingRoundStartRewards` 统一解析。
**正确做法**：`phase_finalizeRound()` 只负责存档与启动 `sys_startRoundStartResolver()`；是否进入选择阶段由 resolver 决定。
**关键位置**：`src/game_phase.js` → `phase_finalizeRound()`

### 坑 2: `ui_closeRelicSelection()` 默认回到 selection/gathering

**现象**：回合开始奖励队列里有多个奖励时，选完一个遗物后剩余奖励不会继续结算。
**根因**：旧逻辑只认 `gathering` 和默认 `selection` 两种恢复目标，没有 `round_start_resolver` 这一中间态。
**正确做法**：`ui_showRelicSelection()` 需要支持显式 `resumeTarget`，`ui_closeRelicSelection()` 在 `round_start_resolver` 分支必须调用 `sys_continueRoundStartResolver()`。
**关键位置**：`src/ui/shop.js` → `ui_showRelicSelection()` / `ui_closeRelicSelection()`

### 坑 3: 局内存档不保存 `pendingRoundStartRewards`

**现象**：玩家在战斗结算后刷新页面，之前登记的遗物或精华全部丢失。
**根因**：新奖励队列只存在于运行时，没有序列化到 `echo_alchemist_run_state`。
**正确做法**：在 `sys_saveRunState()` 中持久化 `pendingRoundStartRewards`，并在 `sys_loadRunState()` 中恢复后立即再次进入 resolver。旧的 `_pendingRelicEvent` / `_pendingBossRelic` 需要迁移成 `relic` 队列项。
**关键位置**：`src/game_system.js` → `sys_saveRunState()` / `sys_loadRunState()`

### 坑 4: 二次复盘时未经比对就假定“前序改动未落主仓”

**现象**：任务描述或口头交接提示需要“重做”同一批掉落与状态机逻辑，但实际主仓可能已经合入该改动；如果直接回滚或重写，会制造无意义改动与新的回归风险。
**根因**：多 Agent 协作场景下，Git 文档库交付物、主仓 `main` 与任务描述的时间点不一定一致。仅凭描述无法判断当前代码真实状态。
**正确做法**：先读取前序任务交付物，再检查主仓关键函数和规则文档是否存在，最后对 `src/core.js`、`src/game_system.js`、`src/game_phase.js`、`src/ui/shop.js`、`src/event_bus.js` 及相关规则文档逐文件 diff。若 diff 为空，则应在现有代码上继续，不应回滚重做。
**关键位置**：`tasks/tsk-33b634db-ac8/deliverables/*` ↔ 当前主仓对应文件

## 关键耦合点

- `core.js` 的 `enemy:killed` 监听器只负责登记延迟奖励，不应直接打开 UI。
- `game_phase.js` 负责结束战斗并触发 resolver；`game_system.js` 负责真正解析队列并决定下一阶段。
- `ui/shop.js` 仍保留 gathering 中特殊槽位触发遗物的旧路径，因此默认恢复目标不能被全局覆盖，必须改成可参数化。

## 版本变更日志

| 版本 | 日期 | 变更内容 | 作者 |
|------|------|---------|------|
| v1.1 | 2026-04-18 | 补充二次复盘防坑项：在决定回滚或续做前，先对前序交付物与主仓对应文件逐项 diff | tsk-bc433262-6fe |
| v1.0 | 2026-04-17 | 初始记录：固定回合遗物移除，新增 round-start resolver、延迟奖励队列与存档恢复迁移规则 | tsk-33b634db-ac8 |
