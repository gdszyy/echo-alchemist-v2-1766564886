---
id: "PI-006"
version: "v1.6"
last_updated: "2026-06-22"
author: "Codex"
related_modules: ["game_phase", "game_system", "core", "ui/shop", "ui/run_shop"]
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
**正确做法**：队列为空时调用 `sys_showRoundStartBanner()`，显示回合开始大字提示约 2.2 秒后直接进入 `phase_startCombatPhase()`；只有精华/命运选择确认才进入 `phase_startGatheringPhase()`。
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
- `sys_showRoundStartBanner()` 内部会先调用 `phase_switchPhase('combat')` 避免横幅期间残留 selection 界面，再初始化展示横幅；横幅结束必须进入战斗，不能触发研磨。
- `ui/run_shop.js` 的常规商人到访只应通过底部状态入口打开；`sys_maybeOfferRunShopBeforeRoundStart()` 只更新调度状态并保存，不应再显示商店 overlay 或返回 `true` 阻塞横幅。

## 版本变更日志

| 版本 | 日期 | 变更内容 | 作者 |
|------|------|---------|------|
| v1.0 | 2026-04-17 | 初始记录：固定回合遗物移除，新增 round-start resolver、延迟奖励队列与存档恢复迁移规则 | tsk-33b634db-ac8 |
| v1.1 | 2026-04-18 | 新增坑 4：普通命运选择已取消，队列为空时改调用 `sys_showRoundStartBanner()` | tsk-f35c6d10-d6f |
| v1.2 | 2026-04-19 | 新增坑 5：开局缺少弹珠命运选择阶段；`sys_initGameStart()` 必须在遗物奖励后额外队列 `chaos_essence`（`source: 'run_start'`） | 当前 Agent |

| v1.3 | 2026-06-19 | Pitfall 6: normal round-start banner must not rebuild `ammoQueue` from `_lastFiredAmmoSnapshot` or `marbleQueue`; those sources are only for explicit essence / replace-ammo charge flows. | Current Agent |
| v1.4 | 2026-06-19 | Pitfall 7: gathering initialization must rebuild missing launchable `marbleQueue` entries without touching `ammoQueue`, preventing empty grind phases after banner/resume edge cases. | Codex |
| v1.5 | 2026-06-20 | Pitfall 8: scheduled run-shop visits must update beside the round-start banner instead of opening an overlay from resolver, preserving reward queue and banner flow. | Codex |
| v1.6 | 2026-06-22 | Pitfall 9: standard `marble_pack` selection is still an explicit new grind and must pre-charge existing bullets so gathering completion enters replace-ammo selection. | Codex |
| v1.7 | 2026-06-23 | Pitfall 9 deprecated: active marble packs were removed; legacy `marble_pack` rewards must normalize to `run_resource_pack` and never enter selection / gathering. | Codex |
| v1.8 | 2026-06-23 | Corrects v1.7: essence rewards are removed from the active loop; `marble_pack` is the run-start / run-shop grind entry and must go directly to gathering. | Codex |

## Pitfall 6: Normal Round-Start Banner Reuses Charge Sources

**Symptom**: after selecting or replacing bullets, the next round's pending shots can unexpectedly become either the previously selected charged bullets or the newly generated / newly ground marble candidates.

**Root cause**: `sys_showRoundStartBanner()` ran on the ordinary empty-reward round-start path, but it also rebuilt `ammoQueue` from `_lastFiredAmmoSnapshot` or `marbleQueue`. Those sources belong to explicit charge flows such as `chaos_essence`, `pure_essence`, `sys_skipGrindGetRune()`, and `sys_initReplaceAmmoPhase()`.

**Correct approach**: ordinary round-start banner only shows the transition and then calls `phase_startCombatPhase()`. It must not rebuild `ammoQueue`, and it must not enter gathering; any grind or charged-ammo preservation must go through the explicit essence / replace-ammo flow.

**Key location**: `src/game_system.js` -> `sys_showRoundStartBanner()`.

## Pitfall 7: Gathering Background Without Launchable Marbles

**Symptom**: the game sometimes shows the gathering/grind phase, but the queue has no marbles to launch.

**Root cause**: older round-start code called `phase_switchPhase('gathering')` before the actual `phase_startGatheringPhase()` initializer ran, so the saved/restored phase could temporarily be `gathering`. If a resume path, overlay return, or special fate flow had cleared `marbleQueue`, the later initializer could enter a visually valid gathering phase with no launchable marble definitions.

**Correct approach**: `phase_startGatheringPhase()` is the final lifecycle gate for grind initialization. Before building the board/HUD, it must ensure `marbleQueue` contains launchable `MarbleDefinition` entries. If it is empty, rebuild from selected `marblesPool` entries first, then from the pool itself, and finally from current unlocked weights. This must not rebuild `ammoQueue`; combat ammo is still produced only by gathering completion or explicit charge/replace flows.

**Key location**: `src/game_phase.js` -> `buildFallbackMarbleQueue()` / `phase_startGatheringPhase()`.

## Pitfall 8: Scheduled Run-Shop Visit Blocks Round-Start Banner

**Symptom**: when the merchant is due, the round-start resolver opens a shop overlay before the banner. Closing the shop can re-enter reward resolution, skip the banner, or make the same merchant visit behave like a one-shot modal instead of a two-round stay.

**Root cause**: the old shop hook treated the merchant as another resolver interruption point. The new design makes merchant arrival a run-state schedule (`runShopNextOfferRound`, `runShopActiveUntilRound`) rendered by the bottom UI, so resolver must not own the shop overlay lifecycle.

**Correct approach**: `sys_maybeOfferRunShopBeforeRoundStart()` should call `sys_updateRunShopScheduleForRound()`, persist the run, and return `false`. `ui_updateRunShopScheduleUI()` reads `sys_getRunShopScheduleState()` every UI tick and shows the bottom countdown/open button during gathering/combat. The first visit is fixed at round 3, later waits are rolled by `sys_rollNextRunShopRound(fromRound)` from `runShopRandomWaitMin` through the current round, and each visit stays active for `runShopVisitDurationRounds`.

**Key location**: `src/game_system.js` -> `sys_updateRunShopScheduleForRound()` / `sys_maybeOfferRunShopBeforeRoundStart()`, `src/ui/run_shop.js` -> `ui_updateRunShopScheduleUI()`.

## Pitfall 9: Marble Pack Must Directly Enter Gathering, Not Fate Selection

**Symptom**: buying a marble pack in the run shop does not start a grind next, or the code routes the pack through fate / essence selection semantics.

**Root cause**: `marble_pack`, `run_resource_pack`, and `chaos_essence` / `pure_essence` have been conflated across several refactors. The current design removes essence rewards from the active loop. A marble pack is not a fate choice and should not write `pendingSelectionMode`.

**Correct approach**: run start queues one `marble_pack` after the first relic. The run shop must sell mixed marble packs. Both routes call `sys_startMarblePackGrind()`, which fills `marbleQueue`, snapshots any keepable ammo into `_chargedAmmoQueue`, and calls `phase_startGatheringPhase()` directly. It may play `sys_showRoundStartBanner({ enterCombat:false, protectCombat:false })` as a non-blocking round / next-Boss threat overlay after entering gathering, but must not wait for the banner or route the pack through the combat-only banner path. Legacy `essence` rewards may normalize to `marble_pack`; new active rewards must not queue `chaos_essence` / `pure_essence`.

**Key location**: `src/game_system.js` -> `sys_queueRoundStartReward()` / `sys_startMarblePackGrind()` / `sys_startRoundStartResolver()`, `src/ui/run_shop.js` -> `ui_buyRunShopItem()`.
