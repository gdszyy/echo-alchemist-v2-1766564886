# 第二轮总体复盘评估：掉落驱动重设计后续实施路径

作者：临时 Agent `planner`  
任务 ID：`tsk-50f9b288-cbe`  
日期：2026-04-17

## 一、评估范围与前提

本次复盘明确以前三次同题任务作为对照基线，分别是：`tsk-cf85e441-184`、`tsk-33b634db-ac8`、`tsk-07a61324-422`。本报告先读取了实际任务主仓 `/home/ubuntu/project-repo` 的 `AGENTS.md`、`.cursor/rules/global.md`、`.cursor/rules/process_insights/index.md`，再对照三份前序成果与当前 `main` 分支代码、规则文档和近期提交，判断后续应当**基于现有代码继续开发**，还是**回滚对应修改后重新开发**。

需要特别说明的是：当前主仓实际承载的是 `echo-alchemist` 项目的方案与交付上下文，而不是本会话 GitHub 选择器中的 `web-visual-workbench` 仓库。就本任务目标而言，真正与三次前序任务及当前源码状态直接对应的，是 `/home/ubuntu/project-repo`。

## 二、结论摘要

> **推荐路径：基于当前 `main` 的既有代码继续开发，不建议回滚 `tsk-33b634db-ac8` 的核心 round-start resolver 改造。**
>
> **对 `tsk-07a61324-422` 不建议执行“代码回滚后重做”，因为从当前主仓状态看，这一轮交付并未稳定落在 `main` 上，实际更像“交付摘要已入库，但对应实现未形成主线基线”。因此正确动作不是回滚，而是以 `tsk-33` 已落地的核心状态机为基线，重新收敛并实现 Fate Moment / Pure Essence 的后续接线。**

## 三、判断依据

### 3.1 三次前序任务的职责顺序是清晰且自洽的

`tsk-cf85e441-184` 的规划文档已经明确了本轮重设计的正确顺序：**核心掉落状态机先行，命运时刻与纯净精华 UI 后挂接**。其核心意图不是先堆 UI，而是先把奖励来源、回合出口、存档恢复与待领取状态统一收口，避免奖励流程继续散落在 `phase_finalizeRound()`、UI 回调和实体行为里。

`tsk-33b634db-ac8` 则正是该规划的第一阶段落地。它把“固定回合遗物”改为“下一回合开始统一结算”的 `pendingRoundStartRewards + round-start resolver` 结构，并同步改动了 `src/core.js`、`src/game_system.js`、`src/game_phase.js`、`src/ui/shop.js`、`src/event_bus.js` 与相关规则文档，且对应流程洞察 PI-006 已注册到主仓索引中。

`tsk-07a61324-422` 从摘要看属于第二阶段，即 Fate Moment / Pure Essence 的 UI/数据层接线，理论上应建立在 `tsk-33` 已经稳定的延迟奖励基础之上，而不应反向重定义核心状态流。

### 3.2 当前 `main` 已明确保留 `tsk-33` 的核心成果

当前主仓源码可直接观察到以下事实：

| 证据位置 | 当前状态 | 说明 |
| --- | --- | --- |
| `src/core.js` | 存在 `pendingRoundStartRewards`、`_roundStartResolverActive` | 说明核心运行态已切换到延迟奖励队列模型 |
| `src/core.js` | `enemy:killed` 对非 Boss 敌人调用 `sys_tryQueueEnemyRoundReward()` | 说明敌人奖励已改为登记而非直接弹 UI |
| `src/game_system.js` | 存在 `sys_queueRoundStartReward()`、`sys_tryQueueEnemyRoundReward()`、`sys_startRoundStartResolver()`、`sys_continueRoundStartResolver()` | 说明解析与续跑入口已经在主线代码中 |
| `src/game_system.js` | `sys_saveRunState()` / `sys_loadRunState()` 持久化并恢复 `pendingRoundStartRewards` | 说明新状态已接入局内存档恢复闭环 |
| `src/ui/shop.js` | `ui_showRelicSelection()` 支持 `resumeTarget`，`ui_closeRelicSelection()` 支持 `round_start_resolver` 续跑 | 说明 UI 返回流已与 resolver 对齐 |
| `.cursor/rules/process_insights/index.md` | `PI-006` 被登记为 “Round-Start 延迟奖励结算流程” | 说明规则层也已把该流程确认为当前主线事实 |

这些证据表明：`tsk-33` 不是停留在文档层，而是已经成为当前 `main` 的有效基线。若此时回滚，会直接损失已形成的一致口径：敌人死亡奖励登记、回合开始统一结算、存档恢复迁移以及遗物弹窗正确回到 resolver 的能力。

### 3.3 当前 `main` 没有显示出 `tsk-07` 摘要所声称的主线实现痕迹

与 `tsk-33` 相比，`tsk-07a61324-422` 摘要中列出的关键字段和接线，在当前主仓代码里没有被检出，包括但不限于：`pendingSelectionMode`、`selectionMode`、`selectionRequiredCount`、`selectionInjectedRune`、`selectionPreviewState`、`relicOverlayReturnState`、`doubleAssimilationBoostRounds`、`assimilationDoubleMultiplier`。

同时，当前主仓的流程洞察索引中，`PI-006` 仍然是 `tsk-33` 的 round-start resolver 文档，而不是 `tsk-07` 摘要中所称的命运时刻 overlay 返回流文档。这说明至少有一件事成立：**`tsk-07` 的结果摘要与当前 `main` 的实际代码/规则状态并不一致**。

这类不一致带来的含义不是“应该回滚当前主仓”，而是：

| 可能情况 | 对后续判断的影响 |
| --- | --- |
| `tsk-07` 代码从未真正合入主线 | 不存在回滚对象，应视为未落地主线的候选实现 |
| `tsk-07` 曾短暂落地后被后续提交覆盖 | 应先做提交级溯源，再选择性恢复，不应把 `tsk-33` 一并回滚 |
| `tsk-07` 摘要高估了实际落地范围 | 后续开发应回到当前 `main` 真相，而非摘要文本真相 |

### 3.4 近期提交没有提供“必须整体回滚”的信号

关键文件的提交历史显示：`src/core.js`、`src/game_system.js`、`src/game_phase.js`、`src/ui/shop.js` 最近一次相关大改均指向 `tsk-33b634db-ac8`。其中，`src/core.js`、`src/game_system.js`、`src/game_phase.js`、`src/ui/shop.js` 自 `tsk-33` 后未出现明显针对 Fate/Pure Essence 的二次重构提交；而 `src/ui_system.js`、`src/spawn_system.js`、`src/entities.js`、`index.html` 的最近提交也没有体现 `tsk-07` 摘要中的字段和行为。

因此，从提交链角度看，更像是：**主线已经停在“核心奖励入口已改造，但第二阶段 UI/数据层尚未稳定落地”的中间状态**。这不是“主线被错误改坏”的信号，而是“后续阶段尚未完成或未并入”的信号。

## 四、风险评估

### 4.1 若回滚 `tsk-33`，风险高于收益

回滚 `tsk-33` 会重新引入以下问题：

| 风险 | 具体表现 |
| --- | --- |
| 回合入口退化 | 重新回到固定回合遗物或战后散点弹窗逻辑，打破当前统一结算口径 |
| 存档恢复退化 | 失去 `pendingRoundStartRewards` 的持久化与旧字段迁移能力 |
| UI 返回流重新分叉 | `round_start_resolver` 恢复路径丢失，再次依赖旧的 selection/gathering 默认返回 |
| 文档与代码重新失配 | 当前 `.cursor/rules` 与 PI-006 已同步 round-start resolver，回滚将制造新的活文档失真 |

也就是说，回滚 `tsk-33` 并不能帮助 Fate/Pure Essence 更快落地，反而会先破坏当前已经稳定的第一阶段成果。

### 4.2 若直接照搬 `tsk-07` 摘要继续写，存在“基于假前提开发”的风险

虽然不建议回滚，但也不能直接把 `tsk-07` 摘要当作已落地主线的事实继续往下叠。当前最大的风险在于：**交付摘要与主仓真相不一致**。如果团队默认这些字段已经在 `main` 上存在，后续开发容易出现以下问题：

| 风险 | 具体表现 |
| --- | --- |
| 重复造字段 | 在不清楚现有选择阶段状态结构的情况下，再造一套 `selectionMode` 相关状态 |
| 错误耦合到旧 UI | 把命运时刻 overlay 返回流继续绑定到遗物弹窗旧路径，而不是基于 resolver 输出做标准接线 |
| 流程洞察编号冲突 | `PI-006` 在主仓已被占用，若继续沿用 `tsk-07` 摘要中的命名，会破坏索引一致性 |
| 验收对象失真 | 以摘要作为验收基线，而不是以当前 `main` 代码和规则为验收基线 |

### 4.3 当前最需要防的不是“功能缺失”，而是“状态边界再次失控”

`tsk-cf85e441-184` 的规划强调过，后续 UI 接线必须建立在标准奖励对象、统一提交路径和可恢复状态之上。当前 `main` 虽然已具备延迟奖励队列，但还没有看到 Fate Moment / Pure Essence 明确落在统一奖励对象层。因此，如果下一步开发重新把命运时刻选择、精华注入、overlay 返回流分散写进 UI 和实体回调中，就会重新回到本轮重设计前的耦合模式。

## 五、推荐路径

> **推荐采取“保留 `tsk-33` 基线，重新收敛第二阶段实现”的路径，而不是整体回滚重做。**

更具体地说，建议把当前主线视为：

1. **第一阶段已完成且应保留**：延迟奖励队列、round-start resolver、存档恢复迁移、遗物 overlay 恢复流。  
2. **第二阶段未稳定落地**：命运时刻 / 纯净精华运行态、合法性校验、动态选择模式、注入 UI 与文案。  
3. **因此下一步应当是“基于现有基线继续开发”，而不是“推倒重来”。**

## 六、建议实施顺序

### 步骤 1：冻结并验证当前 `tsk-33` 基线

先不要动回合入口，先补一轮最小验证清单，确认以下主线事实仍成立：新开局首个奖励是否进入 resolver；非 Boss 敌人死亡是否登记延迟奖励；回合结束后是否先结算 `pendingRoundStartRewards`；刷新恢复时是否能继续解析奖励队列；遗物弹窗关闭后是否回到 `round_start_resolver`。

这一步的目的不是新增功能，而是把当前基线确认成“可信继续开发点”。

### 步骤 2：对 `tsk-07` 做提交级溯源，但只作为参考，不作为真相源

需要进一步确认 `tsk-07a61324-422` 的代码是否曾经存在于其他分支、临时补丁或未合并快照中。如果能找到真实代码差异，可以作为设计参考；如果找不到，就应承认它只是“已提交到文档库的交付摘要”，而不是当前 `main` 可直接接续的实现基线。

这一步的产出应是一个明确结论：哪些点可复用，哪些点必须按当前 `main` 重新实现。

### 步骤 3：以 resolver 为入口，重新定义 Fate Moment / Pure Essence 的标准奖励对象

后续不建议直接从 `selectionMode` UI 状态下手，而应先把命运时刻、纯净精华纳入当前奖励队列/奖励解析模型，至少明确：奖励类型、进入时机、待确认状态、提交入口、存档快照和恢复策略。

换言之，应先补“领域态”，再补“展示态”。这与 `tsk-cf85e441-184` 的既定规划一致。

### 步骤 4：在统一奖励对象稳定后，再做 UI/选择阶段接线

此时再实现以下内容才是低风险的：

| 子项 | 推荐顺序 | 原因 |
| --- | --- | --- |
| 命运时刻 overlay 容器 | 先做 | 与当前遗物弹窗返回流最接近，易验证 resolver 接续 |
| 纯净精华单弹珠注入模式 | 其次 | 依赖选择阶段状态，但应建立在统一奖励入口之后 |
| 合法性校验与动态确认按钮 | 再后 | 属于 UI 约束层，不应先于领域态出现 |
| 双倍同化率字段与提示 | 最后 | 属于数值/显示增强，优先级低于流程闭环 |

### 步骤 5：重新同步文档与流程洞察

后续实际落地时，必须把 `.cursor/rules/game_phase.md`、`.cursor/rules/ui_system.md`、`.cursor/rules/entities.md`、`.cursor/rules/process_insights/index.md` 同步更新。尤其要注意，**不要复用当前主仓已存在的 `PI-006` 编号去记录新的命运时刻 overlay 流程**；若需要新增新的 UI/恢复防坑文档，应使用新的洞察编号。

## 七、最终建议

综合前序规划、当前 `main` 代码事实、规则层同步情况与近期提交历史，我的最终判断如下：

| 评估项 | 结论 |
| --- | --- |
| 是否回滚 `tsk-33b634db-ac8` | **不建议回滚** |
| 是否整体回滚后重做 | **不建议** |
| 是否应基于当前 `main` 继续开发 | **建议** |
| `tsk-07a61324-422` 应如何处理 | **视为未稳定落地主线的候选实现/摘要，需基于当前 `main` 重新收敛并实现，不应假定其已在主线存在** |
| 下一步最高优先级 | **冻结并验证 round-start resolver 基线，然后重新设计 Fate Moment / Pure Essence 的领域态接线** |

> **一句话结论：保留当前主线已落地的 round-start resolver 核心改造，不做回滚；将命运时刻与纯净精华视为下一阶段基于现有基线继续实现的问题，而不是推倒第一阶段后重新开发的问题。**
