# tsk-bc433262-6fe：核心掉落与状态机二次复盘评估

## 结论摘要

本轮先对前序任务 `tsk-33b634db-ac8` 的交付物、当前主仓 `main` 分支代码，以及相关文件的 Git 历史进行交叉核对。结论是：**不应回滚后重做，而应基于现有代码继续开发；但由于前序改动已经完整落入当前主仓，且当前主仓对应文件与前序交付物逐文件无差异，因此本轮无需再次重写核心掉落与状态机代码，后续仅需补充本轮复盘文档与必要流程洞察即可。**

## 判断依据

| 检查项 | 结果 | 说明 |
| --- | --- | --- |
| 前序任务成果是否存在于 Git 文档库 | 是 | `tsk-33b634db-ac8` 已沉淀完整交付物，包括 `core.js`、`game_system.js`、`game_phase.js`、`shop.js`、`event_bus.js`、`game_phase.md` 与 `PI-006` 等文件。 |
| 当前主仓是否已包含同批改动 | 是 | 当前主仓源码已存在 `pendingRoundStartRewards`、`sys_startRoundStartResolver()`、`sys_continueRoundStartResolver()`、`resumeTarget: 'round_start_resolver'` 等关键实现。 |
| 主仓当前文件与前序交付物是否存在差异 | 否 | 对 `src/core.js`、`src/game_system.js`、`src/game_phase.js`、`src/ui/shop.js`、`src/event_bus.js` 以及相关规则文档逐文件 diff，结果均为空。 |
| 改动是否曾被后续提交回退 | 否 | 相关文件当前内容与前序交付一致，未发现回退或破坏性覆盖。 |

## 关键核验点

### 1. 主仓已具备 round-start 延迟奖励队列

当前 `src/core.js` 已声明 `pendingRoundStartRewards` 与 `_roundStartResolverActive`，并在 `enemy:killed` 事件监听中调用 `sys_tryQueueEnemyRoundReward(enemy)`，说明“敌人死亡只登记延迟奖励，不直接弹窗”的链路已经进入主仓。

### 2. 回合结束入口已切换到 resolver

当前 `src/game_phase.js` 的 `phase_finalizeRound()` 在 `ammoQueue.length === 0` 时会先调用 `sys_saveRunState()`，随后调用 `sys_startRoundStartResolver()`，并未回退到旧的固定回合遗物入口。

### 3. UI 恢复目标已支持 `round_start_resolver`

当前 `src/ui/shop.js` 中，`ui_showRelicSelection(options)` 会记录 `options.resumeTarget`，而 `ui_closeRelicSelection()` 已对 `round_start_resolver` 分支调用 `sys_continueRoundStartResolver()`，说明多奖励串行结算链路仍然成立。

### 4. 存档/恢复链路已覆盖新队列并兼容旧字段

当前 `src/game_system.js` 已在 `sys_saveRunState()` 中持久化 `pendingRoundStartRewards`，在 `sys_loadRunState()` 中恢复该队列，并把旧 `_pendingRelicEvent` / `_pendingBossRelic` 迁移为 `relic` 队列项，然后重新进入 `sys_startRoundStartResolver()`。

## 路径决策

本轮应走的路径不是“回滚相关修改后重新开发”，而是“**在现有主仓代码上继续核验并做最小必要补充**”。原因在于：

第一，若当前主仓已经完整吸收前序任务成果，再执行回滚会人为破坏已经正确落地的逻辑，带来不必要的回归风险。

第二，逐文件对比结果为零差异，说明当前主仓与前序交付物在本任务关注的核心文件上是一致的，此时重做不会产生新增价值。

第三，本轮真正新增的信息并非功能缺失，而是**复盘方法论**：在多 Agent 交接场景中，不能仅根据口头描述判断“改动未落主仓”，必须先把 Git 文档库交付物与当前主仓逐文件比对，再决定继续开发还是回滚重做。

## 本轮执行结果

本轮未对核心掉落与状态机代码做重复改写，因为当前主仓已与 `tsk-33b634db-ac8` 的交付物保持一致。为满足仓库活文档契约，本轮补充了：

| 产物 | 作用 |
| --- | --- |
| `docs/result-tsk-bc433262-6fe.md` | 记录本轮复盘结论与路径决策依据 |
| `PI-006` 更新 | 将“二次复盘时先比对交付物与主仓”补充为流程防坑项 |
| `process_insights/index.md` 更新 | 同步 PI-006 版本与更新时间 |

## 后续建议

如果后续再次出现“历史任务似乎已做过，但主仓是否真实落地不确定”的场景，建议固定按以下顺序处理：先读取任务交付物，再检查当前主仓关键函数是否存在，最后做逐文件 diff。只有在存在明确缺失、回退或冲突时，才进入回滚或重做路径。
