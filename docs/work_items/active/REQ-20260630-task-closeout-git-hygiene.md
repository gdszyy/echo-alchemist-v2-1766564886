# REQ-20260630-task-closeout-git-hygiene: 任务收尾与 Git 清洁规范

状态：Done
负责人：Codex
最后更新：2026-06-30
当前里程碑：M6

## 目标

把“每个任务结束前必须解释并收口 Git 工作区状态”的规则写入项目规范，使后续 Codex 任务能按同一套闸门自检、清理、汇报。

2026-06-30 追加：把“每完成一个计划批次后必须全仓活跃 work item 状态词一致性检查”和“dirty 路径提交归属/隔离建议”纳入 AGENTS 收尾规范，并整理 AGENTS 中的规范文档位置与索引层级。

## 范围

允许修改：
- `AGENTS.md`
- `.cursor/rules/global.md`
- `.cursor/rules/process_insights/index.md`
- `.cursor/rules/process_insights/PI-012_task_closeout_git_hygiene.md`
- `TODO.md`
- `.gitignore`
- 本需求卡
- 活跃 work item 状态冲突修正

不处理：
- 不提交或推送 Git 提交。
- 不恢复当前已有 stash。
- 不把运行时资产、Godot 工程或旧历史 stash 重新纳入工作区。

## 必读入口

- `AGENTS.md`
- `.cursor/rules/global.md`
- `TODO.md`
- `docs/p0_interaction_optimization_todo.md`
- `.cursor/rules/process_insights/index.md`

## 影响面

代码：
- 不涉及运行时代码。

文档：
- 新增任务收尾硬闸门、Git 清洁 SOP、流程洞察注册。

测试：
- 文档/配置类修改，以 `git diff --check` 与 `git status --short --branch` 为主。

索引与进度账本：
- auto_index：不涉及。
- 模块规范：已更新 `.cursor/rules/global.md`。
- TODO/进度大盘：已更新 `TODO.md`。
- process_insights：已新增 PI-012 并注册索引。
- 资产索引/manifest：不涉及。

## 里程碑

- [x] M0 需求澄清：目标、非目标、验收标准明确
- [x] M1 方案确认：规范入口、全局规则、流程洞察、需求卡、忽略规则明确
- [x] M2 实现完成：文档与忽略规则更新完成
- [x] M3 验证完成：`git diff --check` 与 `git status --short --branch` 完成
- [x] M4 索引同步：确认 auto_index 不涉及，process insights / TODO 已同步
- [x] M5 收口归档：临时文件清理状态与当前 Git 状态已记录
- [x] M6 批次一致性扩展：AGENTS 增补活跃 work item 状态词搜索闸门、dirty 路径归属要求，并整理规范文档索引层级

## 验收标准

- `AGENTS.md` 明确每个任务的 Git 收尾闸门。
- `.cursor/rules/global.md` 明确工作区清洁判定、禁止事项和总结证据。
- `PI-012` 记录仓库变脏原因与标准清理 SOP，并已加入 process insights 注册表。
- `TODO.md` 提供新规范入口。
- `.gitignore` 只新增明确临时/缓存规则，不隐藏运行时资产。
- 最终回复说明当前 Git 状态、验证结果和未提交原因。
- `AGENTS.md` 明确每完成计划批次后需 `rg` 活跃 work item / 相关计划合同中的批次状态词，避免旧 `debt` / `deferred` 残留。
- `AGENTS.md` 说明规范文档位置分层：根入口、`.cursor/rules`、自动索引、`docs/design`、`docs/work_items/active`、`docs/archive` 等。

## 当前进度记录

| 时间 | 阶段 | Codex 动作 | 结果 | 下一步 |
| :--- | :--- | :--- | :--- | :--- |
| 2026-06-30 | Intake | 阅读入口规范与治理技能 | 明确需新增收尾硬闸门 | 编辑规范 |
| 2026-06-30 | Implementing | 更新 AGENTS/global/TODO/process insights/.gitignore | 已完成文件修改 | 运行验证 |
| 2026-06-30 | Verifying | 运行 `git diff --check` 与 `git status --short --branch` | diff check 通过，仅有 Windows LF/CRLF 提示；工作区仅有本需求预期改动 | 完成收口 |
| 2026-06-30 | Follow-up | 根据药剂 C1 验收反思，补充批次状态一致性闸门并整理 AGENTS 文档索引 | 已更新 AGENTS，并修正 `REQ-20260627-health-all-phases.md` 中 C1 状态冲突；`rg` 批次状态词检查未发现 C1 旧 debt/deferred 残留 | 完成收口 |

## 验证记录

- `git diff --check`：通过；仅输出 Windows `LF will be replaced by CRLF` 提示。
- `git status --short --branch`：当前 `main...origin/main [ahead 15]`，工作区包含本需求的 5 个修改文件与 2 个新增文档。
- `rg -n "C1|interruption|deferred|debt" docs/work_items/active TODO.md docs/p0_interaction_optimization_todo.md docs/potion_alchemy_development_plan.md docs/rune_potion_spell_contract.md .cursor/rules/ui_system.md AGENTS.md`：通过；C1 状态已一致。历史遗留状态已复核；2026-06-30 嵌套 UI 已在 `REQ-20260630-potion-c6-nesting-ui.md` 收口，当前药剂线剩余项只保留 Tower 专用资产/长期平衡与正式 PNG/chroma 美术替换。
- `node --check src/potion_nesting.js`：通过。
- Dev server：未启动。
- auto_index：不涉及，未运行索引生成。

## 收口清单

- [x] 无未归属临时文件由本任务新增
- [x] 无错误/过期文档留在活跃入口
- [x] 所有索引已更新或明确无需更新
- [x] 测试证据已记录
- [x] TODO / 需求大盘状态已同步
- [x] 用户可从本卡看懂当前阶段、剩余工作和验收证据
