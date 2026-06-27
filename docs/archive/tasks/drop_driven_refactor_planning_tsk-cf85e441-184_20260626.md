# 掉落驱动重设计规划：任务拆分、状态机重构与接口草案

作者：Manus AI  
任务 ID：`tsk-cf85e441-184`  
日期：2026-04-17

## 一、规划结论

本次重设计应当以**核心掉落状态机先行、命运时刻与纯净精华 UI 后挂接**为基本原则。当前项目中，回合推进、掉落生成、待领取符文、Boss 调度以及局内存档均集中耦合在 `game_phase.js` 与 `game_system.js` 一侧，而 UI 侧已经被规则明确约束为“通过事件监听渲染，不直接推进核心状态”的架构方向；同时，命运轮盘 `FortuneWheel` 与掉落实体 `RuneLoot` 又处于 entities 层，说明“奖励规则”“实体表现”“UI 展示”“存档恢复”目前尚未形成单一中间层。[1] [2] [3] [4] [5] [6]

因此，建议把本轮任务拆为两个主轴。第一条主轴是**核心掉落状态机重构**，负责统一“掉落候选计算、掉落条目生成、待结算缓存、领取/跳过/转化、入包入账、回合收尾、存档恢复”的业务闭环。第二条主轴是**命运时刻与纯净精华 UI 解耦**，负责把视觉面板、转盘/弹窗、飞行动画、按钮状态和展示文案从核心逻辑中剥离出去，仅通过事件与快照接口消费状态机输出。这样既能保证状态一致性，也能让后续的奖励形态扩展不再继续向 `phase_finalizeRound()` 或 `ui_updateUI()` 堆叠特殊分支。[2] [3] [4] [5]

## 二、现状诊断与解耦边界

当前系统的关键问题不是“没有掉落算法”，而是**只有掉落计算，没有掉落编排**。`loot_system.js` 当前只负责根据近几回合伤害历史、克制关系与 Boss 主题权重计算一个 `{ runeId, level }` 结果对象，接口中并不包含掉落来源、展示策略、领取策略、持久化表达或 UI 事件约定。[7] 这意味着任何新的“敌人掉落驱动遗物、精华、命运时刻”的设计，一旦继续直接落到阶段逻辑中，就会重复扩大 `game_phase.js` 和 `game_system.js` 的职责半径。

与此同时，阶段规则已经明示：回合推进、胜利出口、掉落结算以及局内存档的闭环由 `phase_finalizeRound()` 和 `sys_saveRunState()` 托底；恢复流程则通过 `meta_continueRun()` 调用 `sys_loadRunState()` 完成。[3] [8] 这说明所谓“掉落状态机”并不是一个纯展示概念，而是必须与**回合结束点、Boss 调度字段、待领取字段、清档时机、继续游戏入口**对齐的运行态对象。如果只重做命运时刻或纯净精华界面，不先定义可序列化的掉落运行态，刷新恢复和局内断点就会再次失真。[3] [8]

从 UI 约束看，项目已经明确要求业务层通过 EventBus 派发事件，由 UI 层监听并渲染；UI 模块虽然可以通过组合模式读取 `this.xxx` 状态，但禁止直接改 `this.phase` 等核心状态。[1] [4] 这为本轮重构提供了清晰边界：**核心状态机负责产出状态变化和领域事件，UI 负责消费事件并展示，不负责推进领取结算本身**。命运轮盘与掉落实体虽然仍位于 entities 层，但 entities 更适合作为“场内可交互表现载体”，不适合作为“奖励结算真理来源”。[5] [6]

下表给出建议的职责切分。

| 领域 | 应归属核心掉落状态机 | 应归属命运时刻 / 纯净精华 UI |
| --- | --- | --- |
| 掉落来源判定 | 是。根据敌人/Boss/失败线/特殊事件决定掉什么 | 否 |
| 掉落条目数据结构 | 是。统一 reward/drop 的标准对象 | 否 |
| 待领取队列与领取结果 | 是。决定何时进入 `pending`、`claimable`、`claimed` | 否 |
| 回合出口联动 | 是。决定何时允许 `phase_finalizeRound()` 收尾 | 否 |
| 局内存档与恢复 | 是。序列化掉落状态和奖励缓存 | 否 |
| 命运轮盘转盘动画 | 否 | 是 |
| 纯净精华面板、飞行动画、按钮态 | 否 | 是 |
| Toast、HUD 标识、弹窗文案 | 否，最多只发事件 | 是 |
| RuneLoot / FortuneWheel 的场内表现 | 部分。仅作为状态机驱动的表现终端 | 是，负责具体视觉和交互体验 |

## 三、建议的核心掉落状态机模型

建议新增一个独立的掉落领域子系统，名称可暂定为 `drop_flow_system.js` 或 `reward_flow_system.js`。它不负责绘制，也不直接操作 DOM，而是维护**本回合奖励编排上下文**。从设计上看，这个子系统应位于 `loot_system.js` 之上、`game_phase.js` 与 `ui_system.js` 之间，形成“计算层 → 状态机层 → 展示层”的三段式结构。[2] [4] [7]

建议状态机最小化为六个显式状态：`idle`、`collecting_sources`、`resolving_rewards`、`awaiting_claim`、`committing`、`completed`。其中，`collecting_sources` 负责汇总敌人死亡、Boss 狂暴、Boss 击杀、越线怜悯、回合奖励等来源；`resolving_rewards` 负责把来源转成结构化奖励条目；`awaiting_claim` 负责等待场内拾取、动画认领或命运时刻选择完成；`committing` 负责把结果写回背包、货币、遗物、精华账户和统计字段；`completed` 则是允许 `phase_finalizeRound()` 进入 round 递增、Boss 预调度、存档保存和下一阶段初始化的唯一出口。[3] [8]

为了兼容现有“敌人动作后统一领取符文”的流程，建议保留“延后领取”的体验，但把现有 `_runeClaimPending` 从单个布尔值升级为更通用的领域状态，例如：

| 字段 | 类型 | 含义 |
| --- | --- | --- |
| `dropFlow.state` | string | 当前掉落状态机状态 |
| `dropFlow.roundId` | number | 绑定到哪一回合的奖励处理 |
| `dropFlow.sources` | array | 原始掉落来源，如 enemy_kill、boss_enrage、pity_drop |
| `dropFlow.rewards` | array | 结构化奖励条目数组 |
| `dropFlow.pendingClaims` | array | 等待玩家确认或等待动画消费的条目 |
| `dropFlow.committedRewards` | array | 已入账条目，便于统计与恢复 |
| `dropFlow.uiContext` | object | UI 所需的只读快照，如推荐文案、演出类型、来源描述 |
| `dropFlow.blockFinalize` | boolean | 是否阻止回合收尾 |
| `dropFlow.resumeToken` | object/null | 刷新恢复时用于重建掉落处理上下文 |

这种设计的关键价值在于，把现有散落在 `runeLootItems`、`_runeClaimPending`、`FortuneWheel` 回调、临时 Toast、局内货币飞行效果里的隐式状态，收束成一个可被存档、恢复和调试的显式聚合对象。[4] [5] [6] [8]

## 四、状态机重构方案

### 4.1 主循环中的位置调整

当前主线规则说明，`phase_finalizeRound()` 是回合推进与存档写入的唯一合法出口，而 `round++` 也必须只在这里执行一次。[3] [9] 因此，本轮重构不建议把回合推进权下放给 UI，也不建议让命运时刻弹窗直接调用阶段切换。正确做法是把 `phase_finalizeRound()` 改造成“**收尾协调器**”而不是“**掉落细节容器**”。

也就是说，`phase_finalizeRound()` 的核心职责应缩减为三步：先调用掉落状态机的 `dropFlow_finalizeCombatRewards()`；再根据其返回结果判断是否进入 `awaiting_claim` 或 `completed`；最后仅在 `completed` 时执行 round 递增、Boss 预调度、敌人生成、局内存档与进入下一阶段。这样既保留了当前规则对回合出口和存档时机的约束，也把掉落分支从阶段文件中横向剥离出来。[3] [8] [9]

### 4.2 敌人掉落、命运时刻与纯净精华的三层关系

建议把奖励分成三类统一建模，但走不同的后续分支。

| 奖励类型 | 进入核心状态机的统一表示 | 后续表现层 |
| --- | --- | --- |
| 基础掉落 | `rewardType: 'rune' | 'relic' | 'essence'` | 可直接飞入、掉落实体或 HUD 提示 |
| 命运时刻 | `rewardType: 'fate_moment'` | 触发转盘/抉择 UI，产出二次奖励 |
| 纯净精华 | `rewardType: 'pure_essence'` | 触发精华面板、累计条、消费按钮或转化动作 |

这样做的重点是：**命运时刻不是状态机本身，而是状态机中的一种奖励处理分支**；**纯净精华 UI 不是精华账户本身，而是精华账户的展示和交互层**。一旦保持这种关系，后续不管奖励从敌人掉落、Boss 狂暴、Boss 击杀还是怜悯掉落触发，核心领域层都能先统一收口，再分派到具体表现层执行。

### 4.3 存档与恢复的重构要求

`sys_resetGame()` 当前已集中初始化大量与掉落闭环强相关的字段，包括 `runeLootItems`、`_runeClaimPending`、Boss 调度字段、战后高压因子以及清屏奖励标志。[8] `sys_saveRunState()` 与 `sys_loadRunState()` 也已经承担局内继续游戏闭环。[8] 因此，本轮重构必须把新掉落状态纳入这三处生命周期：

第一，`sys_resetGame()` 必须显式初始化 `dropFlow` 的默认状态，否则会重复触发类似历史上 `specialSlots` 初始化类型错误的陷阱。[8] [9] 第二，`sys_saveRunState()` 必须序列化未结算奖励、命运时刻中间态、纯净精华账户和已提交但未消费的回合奖励摘要。第三，`sys_loadRunState()` 恢复时必须优先重建核心数据，再由 UI 根据快照决定是否恢复弹窗、轮盘或精华面板，而不是反过来由 UI 猜测业务态。[4] [8]

### 4.4 entities 层的重构原则

规则已经确认 `FortuneWheel` 与 `RuneLoot` 属于实体系统。[5] 这意味着本轮重构并不需要把它们移出 entities，但应重新定义它们的定位。建议将 `RuneLoot` 调整为**场内掉落实体表现**，只持有 `rewardId`、`rewardType`、坐标、动画状态与只读展示信息，而不自行决定最终发奖规则。`FortuneWheel` 则应调整为**命运时刻表现器**，负责 spin、draw、交互反馈，但中奖结果应由状态机提供可校验输入，或在回调中回传标准化选择结果，而不是在实体内部自行完成奖励持久化。[5] [6]

## 五、跨模块接口草案

为了避免再次出现“业务逻辑藏在 UI 回调里”或“回调里顺便改阶段”的问题，建议统一定义如下接口族。这里的命名是草案，重点在职责边界。

### 5.1 核心掉落编排接口

| 接口 | 输入 | 输出 | 调用方 | 说明 |
| --- | --- | --- | --- | --- |
| `dropFlow_reset()` | 无 | 初始状态对象 | `sys_resetGame()` | 初始化本局掉落运行态 |
| `dropFlow_registerSource(source)` | 标准来源对象 | 无 | `combat_system.js` / `game_phase.js` / `game_system.js` | 收集敌人掉落、Boss 事件、怜悯掉落等来源 |
| `dropFlow_resolveRoundRewards(context)` | 回合上下文 | `rewards[]` | `phase_finalizeRound()` | 将来源解析成结构化奖励条目 |
| `dropFlow_enterClaimPhase(rewards)` | `rewards[]` | 状态快照 | `phase_finalizeRound()` | 进入待领取/待展示态 |
| `dropFlow_commitReward(choice)` | 玩家选择或自动领取结果 | `commitResult` | UI 回调 / 场内实体交互 | 将奖励正式写入状态 |
| `dropFlow_canFinalizeRound()` | 无 | boolean | `phase_finalizeRound()` | 判断是否允许 round++ |
| `dropFlow_exportRunState()` | 无 | 可序列化对象 | `sys_saveRunState()` | 存档接口 |
| `dropFlow_importRunState(snapshot)` | 存档对象 | 无 | `sys_loadRunState()` | 恢复接口 |

### 5.2 事件总线草案

UI 规则要求业务层发事件、UI 层监听处理。[1] [4] 因此建议新增一组奖励领域事件，而不是继续沿用不透明的临时 toast。

| 事件名 | 触发方 | Payload 草案 | 用途 |
| --- | --- | --- | --- |
| `reward:source_registered` | 掉落状态机 | `{ sourceId, sourceType, enemyId, round }` | 调试和统计，可选 |
| `reward:batch_resolved` | 掉落状态机 | `{ round, rewards, summary }` | UI 决定展示总览或动画 |
| `reward:claim_required` | 掉落状态机 | `{ claimMode, rewards, uiContext }` | 打开命运时刻 / 精华 / 掉落认领界面 |
| `reward:claimed` | 掉落状态机 | `{ rewardId, rewardType, delta }` | HUD、飞行动画、Toast |
| `reward:committed` | 掉落状态机 | `{ committedRewards, inventorySnapshot }` | 刷新库存、货币、遗物面板 |
| `reward:flow_completed` | 掉落状态机 | `{ round, summary }` | 允许阶段收尾与下一阶段初始化 |

### 5.3 数据对象草案

建议定义统一奖励对象 `RewardEntry`，最小字段如下。

| 字段 | 示例 | 说明 |
| --- | --- | --- |
| `id` | `rw_boss_5_001` | 奖励条目唯一 ID |
| `sourceType` | `boss_kill` | 来源类型 |
| `rewardType` | `rune` / `pure_essence` / `fate_moment` | 奖励类型 |
| `payload` | `{ runeId:'fire_1', level:2 }` | 具体业务数据 |
| `claimMode` | `auto` / `entity_pickup` / `ui_choice` | 领取模式 |
| `presentation` | `{ entity:'RuneLoot', panel:'fate-wheel' }` | UI/实体表现建议 |
| `state` | `pending` / `claimable` / `claimed` / `committed` | 当前处理状态 |
| `persist` | `true` | 是否需要进入局内存档 |
| `round` | `5` | 归属回合 |

有了这个结构后，`loot_calcRuneDrop()` 就可以保持为纯计算函数，而新的掉落状态机再把其结果封装成 `RewardEntry`。这样既保留了当前智能掉落逻辑，也不会让 `loot_system.js` 被迫承载 UI、存档和阶段推进职责。[7]

## 六、可实施的任务拆分

### 6.1 核心掉落状态机任务包

下表中的任务应认定为**核心掉落状态机改动**，优先级必须高于命运时刻与纯净精华界面。

| 任务包 | 核心目标 | 涉及模块 | 产出 |
| --- | --- | --- | --- |
| P1 领域模型抽取 | 定义 `dropFlow`、`RewardEntry`、来源对象与状态枚举 | `src/` 新增领域文件，`.cursor/rules/game_phase.md`，`.cursor/rules/events.md` | 类型约定、流程图、规则更新 |
| P2 回合出口解耦 | 将 `phase_finalizeRound()` 中掉落收尾逻辑外提为编排调用 | `src/game_phase.js` | 新的收尾协调逻辑 |
| P3 存档闭环改造 | 新增导出/导入/重置接口，接入 continue run | `src/game_system.js`、`src/ui_system.js` | 存档恢复完整性 |
| P4 奖励提交接口 | 实现 claim/commit 流程并统一背包、货币、遗物、精华入账 | `drop_flow_system`、`game_system.js`、`rune_system` 相关模块 | 可测试的提交闭环 |
| P5 事件总线接入 | 新增 reward 领域事件并更新监听关系 | `event_bus.js`、UI 模块 | 解耦后的事件通信 |

### 6.2 命运时刻与纯净精华 UI 任务包

下表中的任务应认定为**UI 和体验层改动**，它们依赖核心掉落状态机提供的标准输出，不应反向定义业务状态。

| 任务包 | 核心目标 | 涉及模块 | 依赖 |
| --- | --- | --- | --- |
| U1 命运时刻容器重构 | 将转盘/弹窗改为消费 `RewardEntry` 的表现器 | `src/entities.js`、`src/ui_system.js`、可能新增 UI 模块 | 依赖 P1/P4 |
| U2 纯净精华账户展示 | HUD、面板、飞行动画、按钮态与文案统一 | `src/ui_system.js`、`src/ui/hud.js` | 依赖 P4/P5 |
| U3 场内掉落实体表现 | `RuneLoot` 仅承载表现与交互，不做持久化决策 | `src/entities.js`、`src/game_phase.js` | 依赖 P2/P4 |
| U4 恢复态 UI 回放 | continue run 后恢复待领取/待选择界面 | `src/ui_system.js` | 依赖 P3 |
| U5 文案与引导 | Toast、提示、帮助文案、按钮禁用态说明 | `src/ui_system.js`、文档 | 依赖 P5 |

### 6.3 文档与规则同步任务包

项目规则要求任何实质性架构和状态变更必须同步更新规则文档，历史方案则应归档到 `docs/archive/`，不能散落在活跃目录中。[1] [2] 因此建议并行准备以下文档任务。

| 任务包 | 目标 |
| --- | --- |
| D1 更新 `.cursor/rules/game_phase.md` | 记录新回合出口与掉落状态机出口 |
| D2 更新 `.cursor/rules/ui_system.md` | 记录命运时刻/纯净精华 UI 的监听边界 |
| D3 更新 `.cursor/rules/entities.md` | 记录 `FortuneWheel` / `RuneLoot` 新定位 |
| D4 更新 `.cursor/rules/events.md` | 注册 reward 领域事件 |
| D5 新增流程洞察 | 沉淀“掉落状态机 + continue run + UI 回放”的防坑文档 |
| D6 归档旧设计 | 将被替代的掉落/转盘旧方案迁入 `docs/archive/` |

## 七、建议开发顺序

本轮任务不应从 UI 开始，而应从**运行态定义与回合出口收敛**开始。建议采用以下顺序。

首先，完成 P1 与 P2，确保 `phase_finalizeRound()` 不再直接承接所有奖励分支，而只协调掉落状态机并等待其完成。此时哪怕 UI 仍沿用旧形式，核心逻辑也已经从阶段机中抽离，能先稳住回合推进正确性。[3] [9]

其次，完成 P3 与 P4，把 `sys_resetGame()`、`sys_saveRunState()`、`sys_loadRunState()` 三条生命周期全部补齐。只有当 continue run 能准确恢复“奖励待领取/待选择”状态后，后续 UI 改造才不会因为刷新、切后台或重开而丢上下文。[8]

再次，完成 P5，并在此基础上推进 U1、U2、U3。也就是说，先让奖励事件和标准快照存在，再把命运时刻、纯净精华和场内掉落表现接上去。这样可以保证 UI 只是监听者，而不是状态推进者。[1] [4]

最后，补 U4、U5 与 D1-D6，把恢复态 UI 回放、文案和文档收尾补齐，并新增一篇流程洞察，专门记录“回合出口—掉落状态机—局内存档—UI 回放”的耦合防坑点。由于项目规则明确要求重大经验沉淀到流程洞察索引，这一步不能省略。[1] [2]

## 八、验收标准

验收不应只检查“界面能不能弹出来”，而应以**状态一致性、可恢复性、模块边界清晰度**为核心。

### 8.1 核心状态机验收

| 编号 | 验收项 | 通过标准 |
| --- | --- | --- |
| A1 | 回合出口唯一性 | `round++` 仍仅在 `phase_finalizeRound()` 的合法出口执行一次，不出现重复递增 [3] [9] |
| A2 | 收尾阻塞正确 | 存在待领取命运时刻/纯净精华时，回合不会提前 finalize |
| A3 | 奖励统一建模 | 敌人掉落、Boss 掉落、怜悯掉落、命运时刻都能转成标准 `RewardEntry` |
| A4 | 提交单一入口 | 奖励入包/入账只有一条 commit 路径，不再散落在 UI 回调和实体逻辑中 |
| A5 | 实体只做表现 | `RuneLoot`、`FortuneWheel` 不直接改核心回合状态，仅回传标准选择/领取结果 |

### 8.2 存档与恢复验收

| 编号 | 验收项 | 通过标准 |
| --- | --- | --- |
| B1 | 新局重置完整 | `sys_resetGame()` 能正确清空 `dropFlow` 与历史待领取态，不复用旧局脏数据 [8] [9] |
| B2 | 刷新恢复正确 | 在待领取奖励、命运时刻中、纯净精华待确认三种中间态刷新后，`meta_continueRun()` 都能恢复 [3] [8] |
| B3 | 失败清档正确 | Game Over 或新开一局后，不残留旧奖励快照 [3] |
| B4 | Boss 状态兼容 | Boss 调度字段与掉落状态机共同恢复，不出现 Boss 奖励重复结算 [3] [8] |

### 8.3 UI 解耦验收

| 编号 | 验收项 | 通过标准 |
| --- | --- | --- |
| C1 | 事件驱动 | UI 主要通过 reward 领域事件刷新，不从业务层直接操作 DOM [1] [4] |
| C2 | 禁止越权 | 命运时刻与纯净精华 UI 不直接修改 `this.phase` 或执行 round 推进 [1] [4] |
| C3 | 界面可回放 | continue run 后能恢复对应弹窗/轮盘/面板展示，而不是仅恢复数据 |
| C4 | 文案一致 | Toast、HUD、面板标题与按钮状态围绕统一奖励对象生成，不出现同一奖励多套说法 |

## 九、实施风险与对应防坑策略

本任务最大的风险并不是代码量，而是**隐式状态迁移不完整**。PI-001 已经证明，`phase_switchPhase` 的双重赋值、`round++` 的重复执行和 `specialSlots` 的错误初始化，都会在看似小改动时引发核心流程失真。[9] 掉落状态机重构同样会触碰这些高风险点，因此建议在实现过程中把以下检查列为强制项。

| 风险 | 说明 | 应对策略 |
| --- | --- | --- |
| 回合出口重复触发 | 奖励完成时若 UI 和阶段层都触发 finalize，会导致 round 双增 | 明确只允许 `phase_finalizeRound()` 读取 `dropFlow_canFinalizeRound()` 后推进 |
| 恢复态重复发奖 | 存档恢复后重复执行 resolve/commit | 将 `RewardEntry.state` 纳入存档，恢复后只回放未完成状态 |
| UI 回调越权 | 命运轮盘或精华弹窗直接改 phase/库存 | 所有 UI 回调只调用 `dropFlow_commitReward()` |
| entities 仍持有业务真相 | `FortuneWheel` 内继续自己算奖励并持久化 | 调整为消费预先下发的 options 或回传选择结果 |
| 文档失配 | 代码改了但规则没改，后续 Agent 再次踩坑 | 同 Commit 更新规则文档与流程洞察 [1] [2] |

## 十、推荐落地里程碑

若按两到三轮实现推进，建议采用如下里程碑划分。

| 里程碑 | 内容 | 结果判定 |
| --- | --- | --- |
| M1 | 核心模型与回合出口解耦 | `dropFlow` 已接管奖励状态，旧逻辑不再散落于 `phase_finalizeRound()` |
| M2 | 存档恢复闭环 | continue run 可恢复所有奖励中间态 |
| M3 | 命运时刻与纯净精华 UI 接线 | 新 UI 基于标准事件与快照工作 |
| M4 | 文档与洞察收束 | 规则、流程洞察、归档文档同步更新完成 |

## References

[1]: file:///home/ubuntu/project-repo/AGENTS.md "Echo Alchemist V2 AGENTS.md"
[2]: file:///home/ubuntu/project-repo/.cursor/rules/global.md "全局规则 global.md"
[3]: file:///home/ubuntu/project-repo/.cursor/rules/game_phase.md "游戏阶段规范 game_phase.md"
[4]: file:///home/ubuntu/project-repo/.cursor/rules/ui_system.md "UI 系统规范 ui_system.md"
[5]: file:///home/ubuntu/project-repo/.cursor/rules/entities.md "实体系统规范 entities.md"
[6]: file:///home/ubuntu/project-repo/src/entities.js "实体聚合入口 entities.js"
[7]: file:///home/ubuntu/project-repo/src/loot_system.js "掉落计算模块 loot_system.js"
[8]: file:///home/ubuntu/project-repo/src/game_system.js "游戏系统 game_system.js"
[9]: file:///home/ubuntu/project-repo/.cursor/rules/process_insights/PI-001_critical_bugfix_flow.md "PI-001 核心 Bug 修复流程与高频陷阱"
