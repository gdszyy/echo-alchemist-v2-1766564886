# tsk-33b634db-ac8 交付摘要：核心掉落与状态机重构

## 1. 任务完成概述

本次修改将**固定回合遗物事件**替换为**基于延迟奖励队列的 round-start resolver**。新的流程不再依赖 `phase_finalizeRound()` 中的 `isRelicRound` 判断，也不再依赖遗物弹窗关闭后默认回到 `selection/gathering` 的硬编码入口，而是通过 `pendingRoundStartRewards` 在**下一回合开始**统一结算非 Boss 敌人掉落的**遗物或精华**，并覆盖**新开局首个遗物**与**局内存档恢复**两个入口。

## 2. 代码改动摘要

| 文件 | 变更摘要 |
|------|----------|
| `src/core.js` | 在 `enemy:killed` 监听中为非 Boss 敌人登记延迟奖励；新增 `pendingRoundStartRewards` 与 `_roundStartResolverActive` 运行时状态。 |
| `src/game_system.js` | 新增 `sys_queueRoundStartReward()`、`sys_tryQueueEnemyRoundReward()`、`sys_startRoundStartResolver()`、`sys_continueRoundStartResolver()`；新局首个遗物改走 resolver；局内存档新增 `pendingRoundStartRewards` 持久化与旧字段迁移。 |
| `src/game_phase.js` | 删除固定回合遗物分支；回合结算后改为 `sys_saveRunState()` + `sys_startRoundStartResolver()`。 |
| `src/ui/shop.js` | `ui_showRelicSelection()` 支持 `resumeTarget`；`ui_closeRelicSelection()` 新增 `round_start_resolver` 恢复分支。 |
| `src/event_bus.js` | 新增 round-start reward queued / started / finished 事件类型。 |
| `src/config.js` | 移除已失效的固定回合遗物配置 `CONFIG.gameplay.relicRoundInterval`。 |

## 3. 文档与规则同步

| 文件 | 同步内容 |
|------|----------|
| `.cursor/rules/game_phase.md` | 更新阶段入口、存档恢复与遗物处理规则，明确由 round-start resolver 统一结算。 |
| `.cursor/rules/config.md` | 记录固定回合遗物移除与 `relicRoundInterval` 下线。 |
| `.cursor/rules/process_insights/index.md` | 新增 PI-006 索引条目。 |
| `.cursor/rules/process_insights/PI-006_round_start_reward_resolver.md` | 沉淀 round-start resolver 的关键防坑点。 |
| `docs/relic_system_design.md` | 将设计口径从“固定回合赠送遗物”改为“延迟奖励统一结算”。 |
| `docs/architecture/game_flow.md` | 将主流程更新为 `round-start resolver -> selection -> gathering -> combat`。 |

## 4. 行为变化说明

新的行为约束如下。

| 场景 | 旧行为 | 新行为 |
|------|--------|--------|
| 新开一局 | `sys_initGameStart()` 直接打开遗物弹窗 | 首个遗物先写入 `pendingRoundStartRewards`，再由 resolver 统一处理 |
| 非 Boss 敌人死亡 | 仅可能直接掉落符文 | 额外有机会登记下一回合开始结算的遗物或精华 |
| 回合结束 | 可能根据固定回合数直接弹遗物 | 只负责存档并启动 resolver，由 resolver 决定是否先发精华/弹遗物/进入选牌 |
| 遗物弹窗关闭 | 默认回到 gathering 或 selection | 若来源为 round-start resolver，则继续处理剩余奖励 |
| 刷新恢复 | 直接进入 selection | 先恢复并结算 `pendingRoundStartRewards`，避免漏领 |

## 5. 兼容性与验证

本次修改保留了 `_pendingBossRelic` / `_pendingRelicEvent` 的**旧存档兼容入口**，加载旧存档时会自动迁移为 `pendingRoundStartRewards` 中的 `relic` 条目，避免老数据直接丢失。

已完成的验证如下。

| 验证项 | 结果 |
|--------|------|
| `node --check src/event_bus.js` | 通过 |
| `node --check src/core.js` | 通过 |
| `node --check src/game_system.js` | 通过 |
| `node --check src/game_phase.js` | 通过 |
| `node --check src/ui/shop.js` | 通过 |

## 6. 尚未扩展但已留好接口的点

当前“精华”结算复用了现有局外货币增加接口，因此无需额外 UI 资源即可落地。如果后续希望将“精华”独立为新的局内资源，只需要在 `sys_startRoundStartResolver()` 中替换发放逻辑，并补充对应 HUD 展示即可。
