---
id: "PI-006"
version: "v1.2"
last_updated: "2026-04-19"
author: "tsk-f35c6d10-d6f"
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

### 坑 4: `pendingRoundStartRewards` 队列为空时仍进入普通弹珠选择

**现象**：每回合开始时玩家都被迫进入弹珠选择界面，即使没有任何奖励。
**根因**：`sys_startRoundStartResolver()` 在队列为空时仍调用 `sys_initSelectionPhase()`。
**正确做法**：队列为空时调用 `sys_showRoundStartBanner()`，显示回合开始大字提示 1.5 秒后直接进入 `phase_startGatheringPhase()`。
**关键位置**：`src/game_system.js` → `sys_startRoundStartResolver()` 末尾、`sys_showRoundStartBanner()`

### 坑 5: 开局缺少弹珠命运选择阶段

**现象**：玩家开局选完遗物后，直接进入研磨阶段，没有任何弹珠配置界面。
**根因**：`sys_initGameStart()` 只队列了一个 `relic` 奖励；遗物选完后 resolver 队列已空，直接调用 `sys_showRoundStartBanner()` 跳过了弹珠选择。
**正确做法**：`sys_initGameStart()` 必须在队列遗物奖励之后，额外队列一个 `chaos_essence`（`source: 'run_start'`）奖励，确保开局流程为：遗物选择 → 命运选择（3 枚弹珠）→ 研磨阶段。
**关键位置**：`src/game_system.js` → `sys_initGameStart()` 末尾的队列块

## 关键耦合点

- `core.js` 的 `enemy:killed` 监听器只负责登记延迟奖励，不应直接打开 UI。
- `game_phase.js` 负责结束战斗并触发 resolver；`game_system.js` 负责真正解析队列并决定下一阶段。
- `ui/shop.js` 仍保留 gathering 中特殊槽位触发遗物的旧路径，因此默认恢复目标不能被全局覆盖，必须改成可参数化。
- `sys_showRoundStartBanner()` 内部会先调用 `phase_switchPhase('gathering')` 避免横幅期间背景殊留 selection 界面，再初始化展示横幅。

## 版本变更日志

| 版本 | 日期 | 变更内容 | 作者 |
|------|------|---------|------|
| v1.0 | 2026-04-17 | 初始记录：固定回合遗物移除，新增 round-start resolver、延迟奖励队列与存档恢复迁移规则 | tsk-33b634db-ac8 |
| v1.1 | 2026-04-18 | 新增坑 4：普通命运选择已取消，队列为空时改调用 `sys_showRoundStartBanner()` | tsk-f35c6d10-d6f |
| v1.2 | 2026-04-19 | 新增坑 5：开局缺少弹珠命运选择阶段；`sys_initGameStart()` 必须在遗物奖励后额外队列 `chaos_essence`（`source: 'run_start'`） | 当前 Agent |
