# REQ-20260717-run-lifecycle-integrity: Run 生命周期完整性收口

状态：Goal Active
负责人：Codex
最后更新：2026-07-18
当前里程碑：M3
分支：`codex/REQ-20260717-run-lifecycle-integrity`
Worktree：`D:\\claude\\echo-alchemist-REQ-20260717-run-lifecycle-integrity`
基线提交：`6f5a74e`

## 目标

把 Run 异步回调、round-start resolver、局内商店、遗物 overlay、局中存档、输入取消与暂停所有权收成可取消、可恢复、幂等的单一生命周期合同，关闭 `UX-P0-03`～`UX-P0-06`、`UX-P1-03`、`UX-P1-04`、`UX-P1-10`、`UX-P1-14`。

## 范围

允许修改：

- `src/game_system.js`
- `src/game_phase.js`
- `src/ui_system.js`
- `src/ui/run_shop.js`
- `src/ui/shop.js`
- `tests/validate_run_lifecycle.mjs`
- `.cursor/rules/game_phase.md`
- `.cursor/rules/process_insights/PI-006_round_start_reward_resolver.md`
- `.cursor/rules/process_insights/PI-007_destiny_overlay_return_and_selection_mode.md`
- `.cursor/rules/process_insights/index.md`（仅同步 PI 版本注册）
- 本 REQ 卡
- 上述源码通过 `scripts/generate_index.py` 生成的独立 auto index

不处理：

- `index.html`、任何 CSS、`src/systems.js`、`src/ui/rune_launcher.js`、`src/ui/game_over.js`
- 掉落概率、商品价格、经济倍率、战斗平衡
- `TODO.md`、`docs/p0_interaction_optimization_todo.md`、umbrella 主卡、共享 runner；由最终 integration 批次统一同步
- 根 checkout 的历史/并行 dirty 改动

## 必读入口

- `AGENTS.md`
- `.cursor/rules/global.md`
- `TODO.md`
- `docs/p0_interaction_optimization_todo.md`
- `docs/work_items/active/REQ-20260627-health-all-phases.md` 的 Goal B 完整合同
- `.cursor/rules/game_phase.md`
- `.cursor/rules/ui_system.md`
- `.cursor/rules/testing.md`
- `.cursor/rules/process_insights/PI-001_critical_bugfix_flow.md`
- `.cursor/rules/process_insights/PI-006_round_start_reward_resolver.md`
- `.cursor/rules/process_insights/PI-007_destiny_overlay_return_and_selection_mode.md`
- `.cursor/rules/process_insights/PI-012_task_closeout_git_hygiene.md`

## 冻结接口与实现合同

- 提供 `sys_acquirePauseLease(ownerId) -> opaque token` 与 `sys_releasePauseLease(token)`；关闭路径只能释放自身 lease，不得直接写 `isPaused = false`。
- run/phase epoch 或等价取消令牌使 abandon、gameover、新局后的旧 timer/banner/resolver callback 全部失效。
- reward 消费、resolver continue、overlay close、商店购买均幂等；遗物跳过 → 商店 → `marble_pack` 只进入一次 gathering。
- 重复打开局内商店不得覆盖已有回调或 pause owner。
- `touchcancel` / `pointercancel` 与正常输入结束共享同一幂等清理，并清除所有拖拽/按压/指针身份状态。
- 存档必须有 schema/version 校验并只在明确安全点恢复，或覆盖恢复所需 `ammoQueue`、`projectiles`、resolver、overlay 与生命周期状态。
- 继续按钮显示有效存档的真实 Round；坏档安全隐藏/降级。
- 遗物/商店支持 JS 可实现的 dialog、键盘、Escape、焦点圈定/恢复与 `disabled` / `aria-disabled` 可解释状态；不得跨界修改 HTML/CSS。

## 影响面

代码：

- Run epoch、phase epoch、异步回调守卫与暂停 lease registry
- resolver / 奖励 ID 消费状态机、run shop 与 relic overlay 生命周期
- 局中存档 schema、安全点、恢复路由与继续入口
- Canvas 输入结束/取消统一清理

文档：

- `.cursor/rules/game_phase.md`
- PI-006 / PI-007

测试：

- 新增 `tests/validate_run_lifecycle.mjs`
- 回归 `tests/validate_phase_contracts.mjs`
- 回归 `tests/validate_scenarios.js`
- T1 全绿后才进行 localhost:3002 浏览器全链路

索引与进度账本：

- auto_index：是；仅改动源码对应索引，通过脚本生成
- 模块规范：是；`game_phase.md`
- TODO/进度大盘：本批不得修改，integration owner 统一同步
- process_insights：是；PI-006 / PI-007
- 资产索引/manifest：否

## 里程碑

- [x] M0 合同读取：Goal B、入口规范、PI 与写集边界明确
- [x] M1 基线与方案：独立 worktree、REQ 卡、T1 红绿基线与函数/状态风险测试矩阵已完成
- [x] M2 实现完成：生命周期、resolver、pause、save、input、overlay 与商店合同完成
- [ ] M3 验证完成：专项 T1、既有 T1 与浏览器全链路全部通过
- [x] M4 索引同步：相关 auto index、`game_phase.md`、PI-006/007 与流程洞察注册表已同步
- [ ] M5 收口交付：服务关闭、临时文件清理、状态词/Git 归属检查、提交完成

## 验收标准

- `node --check` 五个获准源码全部通过。
- `node tests/validate_run_lifecycle.mjs` 全绿。
- `node tests/validate_phase_contracts.mjs` 全绿；已知 gathering HUD 顺序敏感红基线不得被忽略。
- `node tests/validate_scenarios.js` 全绿。
- abandon/gameover/new run 后推进受控假时钟，旧 callback 不改变 meta/gameover、不重开 overlay。
- 重复 close/continue/购买无副作用，同一 reward ID 只消费一次且 gathering 只进入一次。
- pause lease 支持嵌套、逆序/顺序释放、重复释放和无效 token；只在最后一个 lease 释放后恢复。
- combat/gathering/selection 安全存档点刷新后，阶段、弹药、resolver、overlay 和队列一致；坏档不显示伪继续入口。
- `touchcancel` / `pointercancel` 后下一次输入不继承旧 dragging/press 状态。
- 遗物/局内商店可用键盘完成打开—选择/购买—关闭，焦点不落到底层，disabled 状态不可误触且原因可读。
- T1 全绿后在 `http://localhost:3002` 完成合同指定浏览器链路；失败必须修复并重跑同层验证。

## 当前进度记录

| 日期 | 阶段 | Codex 动作 | 结果 | 下一步 |
| :--- | :--- | :--- | :--- | :--- |
| 2026-07-18 | Intake | 读取 Goal B、AGENTS/global/TODO/P0 TODO、game_phase/ui_system/testing、PI-001/006/007/012 与索引入口 | 合同、禁止写集与 T1→浏览器闸门明确 | 创建隔离分支并记录基线 |
| 2026-07-18 | Goal Active | 从 `6f5a74e` 创建独立 worktree；记录根 checkout 历史 dirty baseline，不清理、不搬运 | 分支/目录隔离完成 | 运行未改代码 T1 并审计实现 |
| 2026-07-18 | Goal Active | 未改代码基线：五个 `node --check` 通过；`validate_scenarios` 128/128；`validate_phase_contracts` 173/174 | 唯一红项为 umbrella 合同已记录的 gathering HUD 坐标顺序敏感断言；共享测试不可在本批修改 | 完成函数/状态审计并设计专项 T1 |
| 2026-07-18 | M2 | 落地 run/phase token、可嵌套 pause lease、输入统一取消、stable reward ID/原子消费、overlay session、药剂阻断单 owner 重试与版本化安全点存档恢复 | `validate_run_lifecycle` 90/90；覆盖 stale callback、奖励幂等、双选/replace-ammo 部分选择、确定性钉盘恢复、坏档与 hydration 失败、重复 overlay/购买/close | 同步规则与自动索引 |
| 2026-07-18 | M4 | 同步 `game_phase.md`、PI-006 v1.9、PI-007 v1.4、洞察注册表，并用 `scripts/generate_index.py` 更新三个大文件索引 | 索引器识别的新巨型函数已补齐 `@section` 导航；未手工编辑 auto index | 构建共享基线修复后的临时集成验证面 |
| 2026-07-18 | M3 | 本分支复跑五个 `node --check`、专项与既有 T1 | lifecycle 90/90、scenarios 128/128；phase contracts 173/174，唯一红项仍为未获准修改的共享 HUD runner 基线 | 在临时 detached worktree 合入共享测试修复 `6c3c53d`，全部 T1 绿后再跑浏览器 |

## 根 checkout dirty baseline（只读归属）

以下路径在本 REQ 开始前已存在于根 checkout，属于历史/并行改动；本 REQ 不处理、不复制、不提交：

- `.cursor/rules/auto_index/src_combat_system_js_index.md`
- `.cursor/rules/combat.md`
- `.cursor/rules/performance.md`
- `TODO.md`
- `docs/p0_interaction_optimization_todo.md`
- `docs/rune_potion_spell_contract.md`
- `docs/work_items/active/REQ-20260627-health-all-phases.md`
- `src/combat/combat.md`
- `src/combat_system.js`
- `tests/validate_potion_spell_tree_combat.mjs`
- `src/music_clip_packs.js`（untracked）

## 收口清单

- [ ] 无未归属临时文件
- [ ] 无越界文件改动
- [ ] 所有相关 auto index 由脚本更新
- [ ] 模块规范与 PI 已同步
- [ ] 专项与回归 T1 证据已记录
- [ ] 浏览器证据、端口、PID 与服务关闭状态已记录
- [ ] 中央 TODO/umbrella 同步明确交给 integration 批次
- [ ] `git diff --check` 与 `git status --short --branch` 已记录
