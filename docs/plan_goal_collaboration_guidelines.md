# Codex `/plan` + `/goal` 协作使用规范

最后更新：2026-06-27

本文档根据用户提供的知乎文章《GPT-5-Codex 发布 0.42.0 正式支持 goal 功能：9h 持久任务运行实测》整理，并结合 OpenAI 官方 Codex 文档与本项目协作规范，定义 Echo Alchemist V2 中 `/plan` 与 `/goal` 的推荐使用方式。文章中的版本号仅作为来源背景，不写入项目硬约束；实际可用命令与功能状态以当前 Codex 环境和官方文档为准。

核心原则：`/plan` 用来把问题想清楚，`/goal` 用来让 Codex 按可验证终点持续推进。不要把 `/goal` 写成愿望清单，也不要把 `/plan` 当成长期执行状态。

## 1. 适用范围

适合使用 `/plan` + `/goal` 的任务通常具有以下特征：

- 目标明确，但执行路径需要边做边发现，例如性能优化、复杂 bug 复现、跨模块重构、资产接入验证、浏览器实机回归。
- 有可检查证据，例如测试命令、截图、构建结果、性能数据、文档更新、具体文件差异。
- 需要 Codex 在多个回合内持续推进，而不是完成一个单点修改后等待下一条指令。
- 可以限定边界，例如只处理 P0 交互闭环、只改某个子系统、只跑指定验证套件。

不适合使用 `/goal` 的任务：

- 一次性问答、解释代码、查一个状态、改一处小 bug。
- 开放式 backlog，例如“把游戏整体优化一下”“继续做所有 TODO”。
- 没有验收标准的探索，例如“看看有没有什么可以改”。
- 需要用户即时决策、账号授权、外部资源审批才能推进的工作。

## 2. `/plan` 与 `/goal` 的职责边界

| 命令 | 用途 | 产出 | 何时结束 |
| :--- | :--- | :--- | :--- |
| `/plan` | 梳理任务、拆分阶段、确认风险、提出验收标准 | 可审阅计划、问题清单、候选目标文本 | 计划足够清楚，可以执行或转成 `/goal` |
| `/goal` | 建立线程级持久目标，让 Codex 持续执行、验证、修正 | 代码/文档/资产改动、测试记录、完成或阻塞结论 | 证据证明目标完成、用户暂停/清除、预算到达或确实阻塞 |

推荐工作流：

1. 需求模糊时先用 `/plan`。
2. 在 `/plan` 中要求 Codex 输出“可直接粘贴的 `/goal` 草案”。
3. 用户确认或调整后，使用 `/goal <objective>` 启动持续执行。
4. 目标运行期间用 `/goal` 查看状态，用 `/goal pause`、`/goal resume`、`/goal clear` 控制生命周期。

如果需求已经足够清楚，可以直接使用 `/goal`，无需先开 `/plan`。

## 3. Goal 合约模板

本项目推荐的 `/goal` 应包含六个要素：

- **Outcome**：完成后必须为真的结果。
- **Verification**：证明完成的测试、命令、截图、文档或人工可查证据。
- **Constraints**：不能破坏的范围，例如不全量重写大文件、不改无关资产、不跳过文档同步。
- **Boundaries**：允许读取和修改的模块、文档、测试、资源目录。
- **Iteration policy**：每轮失败后如何继续，例如先读日志、缩小复现、补测试、再修。
- **Blocked stop condition**：无法继续时必须交代的证据、尝试路径和所需输入。

通用模板：

```text
/goal 完成 <目标结果>，以 <验证证据> 证明完成，同时保持 <约束条件>。
先阅读 <必读入口文档/文件>，只在 <允许范围> 内修改。
按检查点推进，每个检查点后运行 <验证命令或检查方式>，失败则先修复再进入下一步。
若无法继续，停止并报告已尝试路径、已有证据、阻塞原因和需要用户提供的下一项输入。
```

更适合 Echo Alchemist V2 的模板：

```text
/goal 完成 <具体模块/页面/机制> 的 <具体改造或修复>，验收标准是 <测试命令/浏览器验证/截图/文档同步> 全部通过。
开始前阅读 AGENTS.md、.cursor/rules/global.md、TODO.md、docs/p0_interaction_optimization_todo.md，以及本任务涉及的专项规范。
保持修改范围最小，不全量重写超过 500 行的大文件，不手动编辑 .cursor/rules/auto_index/，不回退用户已有改动。
若修改已索引大文件，按 AGENTS.md 运行 scripts/generate_index.py 更新对应索引。
每轮结束汇报已完成项、验证结果、剩余风险；若同一阻塞连续无法突破，报告阻塞证据和需要的用户决策。
```

## 4. 本项目推荐示例

### 4.1 P0 交互闭环

```text
/goal 收口 docs/p0_interaction_optimization_todo.md 中 P0-A 阶段切换状态残留问题，确保 combat/training/meta/gameover/selection/gathering 之间切换时没有战斗 HUD、浮层或临时状态残留。
验收标准是 node tests/validate_phase_contracts.mjs 通过，并补充必要的静态检查或浏览器验证记录。
开始前阅读 AGENTS.md、.cursor/rules/global.md、.cursor/rules/ui_system.md、.cursor/rules/game_phase.md、docs/p0_interaction_optimization_todo.md。
保持改动局限在相关 UI/phase 模块与测试，不处理无关视觉资产。
```

### 4.2 性能/特效改造

```text
/goal 完成 <某个特效/粒子/敌人渲染> 的性能自适应接入，确保 high/medium/low 三档都有明确表现，并通过相关测试或浏览器实机检查。
开始前阅读 AGENTS.md、.cursor/rules/performance.md、.cursor/rules/process_insights/PI-005_perf_impact_assessment.md，以及涉及文件的 auto_index。
所有新增高开销渲染代码必须添加 // @perf-impact 标记，接入 CONFIG.performance 或说明无需新增预算。
完成时输出性能自适应影响评估，不跳过文档同步。
```

### 4.3 大型跨模块重构

```text
/goal 按既有架构规范完成 <子系统/机制> 的局部重构，使 <旧耦合点> 收口到 <目标接口/事件/模块>，并保持现有测试通过。
开始前阅读 AGENTS.md、.cursor/rules/global.md、对应模块规范、.cursor/rules/process_insights/index.md 和相关 auto_index。
先列出影响文件和编辑策略；超过 200 行的结构性修改优先拆小文件或脚本化，不全量重写大文件。
每完成一个检查点后运行对应验证；若验证失败，先修复失败再继续扩展范围。
```

### 4.4 文档整理/交接

```text
/goal 整理 <主题> 的项目规范文档，目标是让后续 Codex 能按文档独立执行该类任务。
验收标准是新增或更新的 Markdown 包含适用范围、必读入口、执行流程、验收闸门、禁止行为和示例提示词。
只修改 docs/ 或 .cursor/rules/ 中与主题直接相关的文档，不改运行时代码。
完成前检查链接、路径和术语，统一使用“Codex / 后续 Codex”表述。
```

## 5. 执行期间的协作规范

Goal 启动后，用户仍可以继续发消息调整方向。最新用户消息优先级最高；如果新消息改变目标，应暂停、清除或重写 Goal，而不是让旧目标继续驱动执行。

Codex 在 Goal 中应遵守：

- 先读本项目入口文档和相关专项规范，再动文件。
- 每个阶段只处理一个可验证检查点，避免一次吞下过大范围。
- 修改代码时同步考虑测试、文档、auto_index、性能标记和 dev server 管理规则。
- 对已有脏工作树保持克制，不回退非本轮产生的改动。
- 不能因为“预算快到了”“大概完成了”“看起来没问题”而标记完成。
- 完成必须基于证据：测试通过、构建通过、截图/浏览器检查、文档路径存在、diff 可查。

用户在 Goal 中应尽量提供：

- 目标优先级：P0/P1/P2 或必须先完成的模块。
- 可接受范围：哪些文件能动，哪些不能动。
- 验收方式：测试命令、页面路径、截图目标、性能指标。
- 中止条件：做到什么程度需要停下来问用户。

## 6. 完成、阻塞与预算口径

### 完成

只有当目标中定义的验收证据已经出现，Codex 才能认为 Goal 完成。完成总结必须包含：

- 改了什么。
- 验证了什么。
- 没验证什么，以及原因。
- 是否留下后续风险。

### 阻塞

阻塞不是“任务很难”，而是 Codex 已经无法在当前信息和权限下继续取得有效进展。阻塞总结必须包含：

- 阻塞点。
- 已尝试路径。
- 关键证据或日志。
- 需要用户提供的最小输入。

### 预算

预算到达只代表停止继续消耗，不代表完成。预算耗尽时应总结进度和下一步，而不是把目标标记为完成。

## 7. 禁止写法

不要这样写 `/goal`：

```text
/goal 优化整个游戏
/goal 把所有 TODO 都做完
/goal 继续修 bug，直到没有 bug
/goal 让 UI 更好看
```

这些目标都缺少边界和验收证据。应改写为：

```text
/goal 修复 docs/p0_interaction_optimization_todo.md 中 P0-A 阶段切换状态残留，验收为 validate_phase_contracts.mjs 通过且浏览器检查 combat -> gameover -> meta 无旧 HUD 残留。
```

## 8. `/plan` 输出要求

当用户使用 `/plan` 时，Codex 的计划应尽量包含：

- 目标复述：用一句话确认要解决的问题。
- 上下文入口：列出必须阅读的项目文档和关键文件。
- 范围边界：明确不处理的内容。
- 检查点：每个检查点都应有可验证结果。
- 风险和决策：指出需要用户确认或可能影响范围的点。
- 可转 Goal：最后给出一条可直接使用的 `/goal` 草案。

推荐 `/plan` 提示：

```text
/plan 帮我把 <任务描述> 拆成适合 Codex 持续执行的计划。请输出必读文档、影响文件、检查点、验证命令、风险，以及一条可直接粘贴的 /goal 草案。
```

## 9. 参考资料

- 用户提供文章：[GPT-5-Codex 发布 0.42.0 正式支持 goal 功能：9h 持久任务运行实测](https://zhuanlan.zhihu.com/p/2035288538678288989)
- OpenAI Developers：[Follow a goal](https://developers.openai.com/codex/use-cases/follow-goals)
- OpenAI Developers：[Using Goals in Codex](https://developers.openai.com/cookbook/examples/codex/using_goals_in_codex)
- OpenAI Developers：[Codex CLI slash commands](https://developers.openai.com/codex/cli/slash-commands)
- OpenAI Developers：[Codex app commands](https://developers.openai.com/codex/app/commands)
