# REQ-20260717-run-lifecycle-integrity: Run 生命周期完整性收口

状态：Integrated / Closed
负责人：Codex
最后更新：2026-07-22
当前里程碑：M5
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
- `TODO.md`、`docs/p0_interaction_optimization_todo.md`、umbrella 主卡、共享 runner；子分支当时不写，现已由 integration 批次统一同步
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
- TODO/进度大盘：本子批未修改；integration owner 现已统一同步
- process_insights：是；PI-006 / PI-007
- 资产索引/manifest：否

## 里程碑

- [x] M0 合同读取：Goal B、入口规范、PI 与写集边界明确
- [x] M1 基线与方案：独立 worktree、REQ 卡、T1 红绿基线与函数/状态风险测试矩阵已完成
- [x] M2 实现完成：生命周期、resolver、pause、save、input、overlay 与商店合同完成
- [x] M3 验证完成：专项 T1、既有 T1 与浏览器全链路全部通过
- [x] M4 索引同步：相关 auto index、`game_phase.md`、PI-006/007 与流程洞察注册表已同步
- [x] M5 收口交付：服务关闭、临时文件清理、状态词/Git 归属检查、提交完成

## 验收标准

- `node --check` 五个获准源码与专项测试文件全部通过。
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
| 2026-07-18 | M1 | 从 `6f5a74e` 创建独立 worktree；记录根 checkout 历史 dirty baseline，不清理、不搬运 | 分支/目录隔离完成 | 运行未改代码 T1 并审计实现 |
| 2026-07-18 | M1 | 未改代码基线：五个 `node --check` 通过；`validate_scenarios` 128/128；`validate_phase_contracts` 173/174 | 唯一红项为 umbrella 合同已记录的 gathering HUD 坐标顺序敏感断言；共享测试不可在本批修改 | 完成函数/状态审计并设计专项 T1 |
| 2026-07-18 | M2 | 落地 run/phase token、可嵌套 pause lease、输入统一取消、stable reward ID/原子消费、overlay session、药剂阻断单 owner 重试与版本化安全点存档恢复 | `validate_run_lifecycle` 90/90；覆盖 stale callback、奖励幂等、双选/replace-ammo 部分选择、确定性钉盘恢复、坏档与 hydration 失败、重复 overlay/购买/close | 同步规则与自动索引 |
| 2026-07-18 | M4 | 同步 `game_phase.md`、PI-006 v1.9、PI-007 v1.4、洞察注册表，并用 `scripts/generate_index.py` 更新三个大文件索引 | 索引器识别的新巨型函数已补齐 `@section` 导航；未手工编辑 auto index | 构建共享基线修复后的临时集成验证面 |
| 2026-07-18 | M3 | 本分支复跑五个 `node --check`、专项与既有 T1 | lifecycle 90/90、scenarios 128/128；phase contracts 173/174，唯一红项仍为未获准修改的共享 HUD runner 基线 | 在临时 detached worktree 合入共享测试修复 `6c3c53d`，全部 T1 绿后再跑浏览器 |
| 2026-07-19 | M3 | 在临时 detached worktree 将本 REQ `1146b4b` 与共享 HUD runner 修复 `6c3c53d` 合并为验证面 `0cc8a2b`，先执行全部 T1 | 五个 `node --check` 5/5；lifecycle 90/90；scenarios 128/128；phase contracts 174/174，满足“T1 全绿后才跑浏览器” | 启动 localhost:3002 浏览器全链路 |
| 2026-07-19 | M3 | 浏览器验证遗物 dialog/键盘焦点、跳过→商店、disabled 原因、Escape、双刷新恢复、嵌套 pause owner、abandon 终止，以及真实购买弹珠包 | Enter 选择遗物后只进入一次 Round 1；36 碎片购买 18 碎片弹珠包后只进入一次 gathering；双刷新均恢复同一队列；外层暂停关闭后模块编辑器仍保持；abandon 后等待 2.5 秒未重开回调；控制台 error 为 0 | 清理浏览器、服务与临时验证面 |
| 2026-07-20 | M5 | 关闭浏览器标签并精准停止 localhost:3002 服务 PID `10536`；移除临时验证依赖和 detached worktree | 3002 无监听；临时 `src/music_clip_packs.js`（SHA-256 `F74E95BDA4C8A635A59A3A88A3B2EA372B944D30090C74804693BD6114475563`）未提交且已删除；临时 worktree 已移除 | 完成状态词、diff 与 Git 归属闸门 |
| 2026-07-20 | M3 | 补齐 Goal B 指定的浏览器安全点刷新：gathering、combat、selection；在 selection 1/3 状态重复刷新并双击 Continue | gathering 三弹队列、combat 敌人 HP/弹药、selection 已选 fire 1/3 均原样恢复；Continue 仅消费一次且没有重复 resolver/overlay | 独立审计剩余索引与焦点证据 |
| 2026-07-20 | M2/M4 | 独立审计发现 `run_shop.js` / `shop.js` auto index 过期，以及 overlay close 在 phase resume/onClose 前恢复焦点；补齐 stale relic sessionId、回调后焦点恢复、隐藏触发器的可见 fallback 与重复关闭测试 | `scripts/generate_index.py` 重建两个索引；`ui_renderShop` 四个巨型函数 section 已登记；lifecycle 提升至 106/106 | 全部 T1 再绿后复测浏览器焦点链 |
| 2026-07-20 | M3 | 在全部 T1 绿后复测遗物 Enter 选择与 Escape 放弃→局内商店→Escape，并对两条链各再按一次 Escape | 两条关闭链均回到 `phase-training`，焦点落在可见 `#train-sidebar-toggle`；重复 Escape 不穿透、可见 modal 为 0；控制台 error 为 0 | 关闭浏览器与服务 |
| 2026-07-20 | M5 | 关闭浏览器标签，精准停止复测服务 PID `32288`，再次按固定哈希删除临时 `src/music_clip_packs.js` | 3002 无监听、临时文件不存在；仅剩本 REQ 六个预期 dirty 路径 | 最终 T1、状态词、diff 与提交闸门 |

## UX 关闭证据

| ID | 关闭实现 | 验证证据 |
| :--- | :--- | :--- |
| `UX-P0-03` | run/phase epoch、受控 timeout/RAF 与终止时统一失效 | lifecycle T1 推进假时钟；浏览器 abandon 后等待 2.5 秒仍停留 meta，无 overlay/继续入口复活 |
| `UX-P0-04` | stable reward ID、原子消费、resolver/session/in-flight 幂等与商店购买顺序保持 | lifecycle T1 重复 close/continue/购买；浏览器跳过后真实购买 `marble_pack`，只进入一次 gathering |
| `UX-P0-05` | schema v2、安全 checkpoint、完整队列/选择/钉板状态序列化与失败双重清理 | lifecycle T1 覆盖 gathering/selection/replace-ammo/坏档/hydration 失败；浏览器分别刷新恢复 gathering 三弹队列、combat 敌人 HP/弹药、selection 已选 fire 1/3 |
| `UX-P0-06` | `sys_acquirePauseLease(ownerId)` / `sys_releasePauseLease(token)` 与 overlay 自有 lease | lifecycle T1 覆盖嵌套、乱序、重复与无效 token；浏览器先关外层暂停，内层模块编辑器仍保持暂停与打开状态 |
| `UX-P1-03` | 遗物/商店 dialog 语义、键盘、Escape、焦点圈定与恢复；旧 sessionId 不得关闭新 overlay | 浏览器验证 `role=dialog`/`aria-modal`、Tab/Shift+Tab 环、Enter 选择遗物、Escape 关闭商店；原触发器因 phase 恢复隐藏时，两条链均 fallback 到可见 `#train-sidebar-toggle`，重复 Escape 无穿透 |
| `UX-P1-04` | 原生 `disabled` + `aria-disabled` + 可读缺额原因 | 浏览器 12 碎片时 18 碎片商品不可触发且显示“还差 6 碎片”；36 碎片时同商品可购买 |
| `UX-P1-10` | 继续入口读取经校验 checkpoint 的真实 Round，坏档不暴露入口 | lifecycle T1 覆盖坏档；浏览器三类安全点均显示并恢复 `Round 1`，selection 双击 Continue 仍只恢复一次 |
| `UX-P1-14` | pointer/touch 正常结束与 cancel 进入同一幂等输入清理 | lifecycle T1 覆盖 `pointercancel`、`touchcancel`、active pointer/drag/press 全清理，并验证下一次 pointer 输入仅拥有新 identity/press 状态 |

浏览器验证使用的 `src/music_clip_packs.js` 是根 checkout 开始前已有的未跟踪依赖；因 `core.js` 当前存在静态 import，临时复制到验证 worktree 后才可启动模块。该文件不属于本 REQ、未进入提交，两轮浏览器验证结束后均按 SHA-256 `F74E95BDA4C8A635A59A3A88A3B2EA372B944D30090C74804693BD6114475563` 核对并删除。中央 TODO、P0 TODO 与 umbrella 主卡已由 integration owner 在 2026-07-22 同步；可选依赖启动兼容由 `0767b3f` 收口。

## 最终验证（2026-07-20）

- `node --check`：五个获准源码 + `tests/validate_run_lifecycle.mjs`，6/6 通过。
- `node tests/validate_run_lifecycle.mjs`：106/106 通过。
- `node tests/validate_scenarios.js`：128/128 通过。
- 共享 HUD runner 修复 `6c3c53d` 对应的 phase contract 内容在当前源码上无落盘执行：174/174 通过；本 REQ 未越界修改共享 runner。
- localhost:3002 浏览器全链路：gathering/combat/selection 安全点、重复 Continue、遗物/商店键盘与焦点、disabled 原因、嵌套 pause owner、abandon 终止均通过；最终控制台 error 为 0。
- 浏览器标签已关闭；PID `32288` 已停止；3002 无监听；临时验证依赖已删除。

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

- [x] 无未归属临时文件
- [x] 无越界文件改动
- [x] 所有相关 auto index 由脚本更新
- [x] 模块规范与 PI 已同步
- [x] 专项与回归 T1 证据已记录
- [x] 浏览器证据、端口、PID 与服务关闭状态已记录
- [x] 中央 TODO/P0 TODO/umbrella 已由 integration 批次同步
- [x] `git diff --check` 与 `git status --short --branch` 已记录

## 集成关闭记录（2026-07-22）

- 交付提交 `1146b4b` / `8461cfb` 已分别以 `7a97ce5` / `0dfb075` 合入 `codex/REQ-20260717-ui-polish-integration`。
- 集成修复 `db5efa6` 收口 pause lease 同步续调重入、跨 overlay 焦点/关闭顺序、terminal 清理和术语冲突；可选音乐包启动兼容修复为 `0767b3f`。
- 历史 `173/174` 或临时验证面的 `174/174` 仅是子分支记录；集成分支当前 phase contract 为运行时语义 `175/175`，术语校验为 `36/36`。
- Goal E 最终验收通过：源码/测试语法 `89/89`；全部 `23/23 validate_*` 共 `2774/2774`，其中生命周期 `109/109`、phase `175/175`；四档真实视口 T3 `32/32`、12 PNG + JSON、零未分类问题、零横向溢出。报告：`D:/claude/echo-alchemist-v2-1766564886/tmp/codex/REQ-20260717-ui-polish-integration/t3-final-20260722-r7/ui-polish-report.json`。
- 本子需求已完成集成并关闭；后续状态只在 `REQ-20260717-ui-polish-integration` 维护。
