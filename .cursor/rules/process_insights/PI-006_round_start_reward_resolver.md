---
id: "PI-006"
version: "v1.9"
last_updated: "2026-07-18"
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
**正确做法**：在 `sys_saveRunState()` 中持久化带稳定 ID 的 `pendingRoundStartRewards`，并用 `schema` / `version` / `resumePoint` 区分可恢复安全点。只有 `round_start` 存档才重新进入 resolver；`selection`、`gathering_idle`、`combat_idle` 必须分别恢复自身路由，不能把所有旧档都重放一遍 resolver。旧的 `_pendingRelicEvent` / `_pendingBossRelic` 只允许在校验/迁移层转换为 `relic` 队列项。
**关键位置**：`src/game_system.js` → `sys_saveRunState()` / `sys_loadRunState()`

### 坑 4: `pendingRoundStartRewards` 队列为空时仍进入普通弹珠选择

**现象**：每回合开始时玩家都被迫进入弹珠选择界面，即使没有任何奖励。
**根因**：`sys_startRoundStartResolver()` 在队列为空时仍调用 `sys_initSelectionPhase()`。
**正确做法**：队列为空时调用 `sys_showRoundStartBanner()`，显示回合开始大字提示约 2.2 秒后直接进入 `phase_startCombatPhase()`；只有精华/命运选择确认才进入 `phase_startGatheringPhase()`。
**关键位置**：`src/game_system.js` → `sys_startRoundStartResolver()` 末尾、`sys_showRoundStartBanner()`

### 坑 5: 开局缺少显式弹珠包研磨入口

**现象**：玩家开局选完遗物后直接进入战斗，或仍被路由到已退出主动循环的精华命运选择。
**根因**：`sys_initGameStart()` 只队列遗物，或继续沿用旧版 `chaos_essence` 开局合同。
**正确做法**：`sys_initGameStart()` 必须在遗物奖励之后队列一个 `marble_pack`（`packId: 'mixed'`, `source: 'run_start'`）。当前开局主流程是：遗物选择 → 弹珠包开包 → 研磨；精华仅保留旧存档兼容语义，不得成为新局主动奖励。
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
| v1.9 | 2026-07-18 | 收口稳定 reward ID、原子消费、round-start latch、安全点恢复、局内商店 pack 顺序及 run-token 异步所有权。 | Codex |

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

## Pitfall 10: Resolver 先移出奖励，异步回调再提交副作用

**现象**：快速双击、重复 close、abandon 后旧动画回调或商店购买回调会让同一奖励发两次、漏发，甚至让同一 `marble_pack` 进入两次 gathering。

**根因**：resolver 在打开 overlay/动画前就 `shift()`，并把数组位置当作奖励身份；回调没有 run token，也没有统一的原子完成入口。

**正确做法**：resolver 只窥视队首。每项奖励先经 `sys_ensureRoundStartRewardId()` 获得稳定 ID，所有成功路径只通过 `sys_completeRoundStartReward(id)` 原子消费，重复回调返回 `false`。阶段推进回调必须绑定 run/phase token；被 pause 或 `truth_book` 暂停的必要 continuation 可暂存，真实换阶段或 abandon 后必须取消。terminal key 与 banner key 只能在横幅真正启动后提交，不能在药剂中断确认前抢占。

**关键位置**：`src/game_system.js` → `sys_startRoundStartResolver()` / `sys_completeRoundStartReward()` / `sys_showRoundStartBanner()`。

## Pitfall 11: 用当前 phase 推断安全点，恢复时重放半截流程

**现象**：刷新后重开遗物 overlay、重发资源、重做战斗初始化，或 selection 只剩弹珠类型而丢失符文槽、阈值和双选状态；坏档还可能在 hydration 中途把半份状态写回 localStorage。

**根因**：把 `phase === 'combat'` 或“仍有 pending reward”当作稳定 checkpoint，存档结构只做浅校验，恢复期间 UI 重建又触发保存。

**正确做法**：使用显式 `_roundStartCheckpointReady` / `_combatCheckpointReady` latch 和固定 `resumePoint`。保存前拒绝 resolver、overlay、projectile、研磨动画等活动态；恢复前深度校验奖励 ID、selection/replace 上下文、敌人足迹/碰撞几何和队列。selection 保存完整 `MarbleDefinition` 与 `persistentThreshold`；gathering 保存确定性的 Peg/挡板/粉钉/special slot/奖励区几何；永久增益使用 `permanent` sentinel。hydration 全程启用 restore-write guard，任一异常必须二次 reset、清档并回到 meta；`combat_idle` 恢复不得重放 round 初始化。

**关键位置**：`src/game_system.js` → `sys_getRunStateResumePoint()` / `sys_validateRunStatePayload()` / `sys_saveRunState()` / `sys_loadRunState()` / `sys_resumeCombatCheckpoint()`。

## Pitfall 12: 商店弹珠包插队或生成第二份奖励

**现象**：遗物跳过后购买弹珠包，会跳过队列前方旧资源奖励，或保留原 pack 后再新建一个 pack，导致奖励顺序变化和重复研磨。

**根因**：购买路径只会 `unshift()` 新奖励，未接管 resolver 队列里的原始 `marble_pack`。

**正确做法**：购买路径在原队列位置替换待处理 pack，保留原稳定 reward ID 与更早奖励的顺序；购买/close/session 回调先核对当前 shop session，再原子完成该 reward。`run_resource_pack` 在发放资源并消费 ID 后、打开下一项 overlay 前必须写入 round-start checkpoint。

**关键位置**：`src/ui/run_shop.js` → `ui_buyRunShopItem()`；`src/game_system.js` → resolver 的 `run_resource_pack` 分支。
