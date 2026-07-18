# REQ-20260717-launcher-settlement-ux：发射器与终局结算 UX 收口

状态：Goal Done
负责人：Codex
最后更新：2026-07-18
当前里程碑：M5

## 目标

在不改变药剂合法性、符文公式、经济倍率或 30% 结算公式的前提下，修复炼金台/符文发射器的长按、暂停所有权、键盘与对话框语义、词条图鉴状态、稳定节点 CTA、局内外碎片表达，并使终局收益展示与真实写入一致。

## 工作区与基线

- 分支：`codex/REQ-20260717-launcher-settlement-ux`
- worktree：`D:\\claude\\echo-alchemist-REQ-20260717-launcher-settlement-ux`
- 基线提交：`6f5a74e26858d92549a97ab2408769b02be3ad2c`
- 根 checkout 历史/并行 dirty baseline：`.cursor/rules/auto_index/src_combat_system_js_index.md`、`.cursor/rules/combat.md`、`.cursor/rules/performance.md`、`TODO.md`、`docs/p0_interaction_optimization_todo.md`、`docs/rune_potion_spell_contract.md`、`docs/work_items/active/REQ-20260627-health-all-phases.md`、`src/combat/combat.md`、`src/combat_system.js`、`tests/validate_potion_spell_tree_combat.mjs`，以及未跟踪 `src/music_clip_packs.js`。这些路径不带入、不清理、不回退。

## 范围

允许修改：

- `src/ui/rune_launcher.js`
- `src/ui/game_over.js`
- `tests/validate_launcher_settlement_ux.mjs`（新建）
- `.cursor/rules/ui_system.md`
- `docs/work_items/active/REQ-20260717-launcher-settlement-ux.md`
- 上述源码由 `scripts/generate_index.py` 生成的对应 `.cursor/rules/auto_index/*`

不处理：

- `src/game_system.js`、`src/ui_system.js`、`src/ui/shop.js`、`index.html`、`src/styles/bitmap_ui.css`、`src/systems.js`。
- 药剂合法性、嵌套矩阵、符文/词条公式、经济倍率、失败返还比例与 30% 结算公式。
- 中央 `TODO.md`、P0 TODO、umbrella 卡与共享 runner；由串行 integration REQ 收口。
- pause lease 的系统实现和真实多 overlay 嵌套顺序；本 REQ 只申请、保存和释放 launcher 自己的 token，可用测试 stub 验证。

## 必读入口

- `AGENTS.md`
- `.cursor/rules/global.md`
- `TODO.md`
- `docs/p0_interaction_optimization_todo.md` 的 `UX-P0-06`、`UX-P1-03`、`UX-P1-06`～`UX-P1-09`
- `.cursor/rules/ui.md`
- `.cursor/rules/ui_system.md`
- `.cursor/rules/rune_system.md`
- `docs/rune_potion_spell_contract.md`
- `.cursor/rules/testing.md`
- `.cursor/rules/process_insights/PI-008_tutorial_overlay_rune_launcher_tab_block.md`
- `docs/work_items/active/REQ-20260627-health-all-phases.md` 的冻结接口与 Goal D 完整合同

## 冻结实现合同

- 长按只显示说明；完成长按后的 `touchend`、移动超过 10px、任何 `touchcancel` / `pointercancel` 都不得选择，静止短按仍选择且长列表保留原生滚动。
- 移动端打开发射器调用 `sys_acquirePauseLease('rune_launcher')` 并保存不透明 token；关闭只调用 `sys_releasePauseLease(token)` 释放自身，禁止直接写 `isPaused = false`。PC 常驻侧栏不申请 lease；移动端与 PC 互切时释放自身 token 或隐藏非模态区域，不把常驻区域伪装成弹窗。
- 主面板和符文选择器提供 dialog 名称、Escape、焦点圈定与关闭后焦点恢复。
- 图鉴严格区分未发现、已发现、可激活、已激活、材料不足；发现状态不得冒充激活状态，也不得泄漏内部 ID。
- 稳定药剂节点的“封装”和“继续投料”文案必须分别对应真实可执行 CTA；封装前仍遵守黑箱信息边界。
- 局内碎片与局外符文碎片的名称、用途、作用域可辨。
- 终局同屏区分本局获得、当前剩余、按既有 30% 公式可带出、实际已结算；显示值取自真实写入路径。

## 影响面与同步闸门

- 代码：launcher 输入/overlay/focus/codex/potion 表现，game-over 只读快照与收益渲染。
- 测试：新增专项 T1；复跑现有 potion、runeword、gameover、phase 合同。
- auto index：需要；`rune_launcher.js` 与 `game_over.js` 均已索引，只能用生成脚本更新。
- 模块规范：需要；同步 `.cursor/rules/ui_system.md`。
- TODO/进度大盘：本分支禁止修改；交 integration REQ。
- process insights：当前不涉及；若发现新的重复性跨模块陷阱再评估，但写权限不扩张。
- 资产/manifest：不涉及。

## 里程碑

- [x] M0 需求澄清：Goal D、冻结接口、写权限、非目标与验收标准明确。
- [x] M1 方案确认：独立 worktree、dirty baseline、影响文件、风险和测试路径明确。
- [x] M2 实现完成：两个 UI 源码、专项 T1 与 UI 规范完成。
- [x] M3 验证完成：源码检查、专项/相关 T1、触屏与鼠标浏览器实测完成。
- [x] M4 索引同步：两个源码 auto index 由脚本更新；状态词与规则同步完成。
- [x] M5 收口交付：临时证据清理，Git 路径逐项归属，提交可供 integration 审查。

## 验收与验证

- `node --check src/ui/rune_launcher.js`
- `node --check src/ui/game_over.js`
- `node tests/validate_launcher_settlement_ux.mjs`
- 现有 potion / runeword / gameover 相关 T1（审计后记录确切命令）
- `node tests/validate_phase_contracts.mjs`；已知基线为 173/174，唯一历史失败是 gathering HUD 顺序敏感正则，若基线仍存在须明确隔离，不得误报全绿。
- T1 满足 Goal D 门槛后，在 `http://localhost:3002` 用触屏和鼠标验证短按、长按、取消、Tab/图鉴状态、药剂稳定节点和终局结算；记录截图、控制台、服务 PID，并精准关闭本 REQ 自启服务。
- 失败后先定位、修复并重跑同层验证；部分推进不算完成。

## 当前进度记录

| 日期 | 阶段 | Codex 动作 | 结果 | 下一步 |
| :--- | :--- | :--- | :--- | :--- |
| 2026-07-18 | Goal Active | 读取 Goal D、UI/符文/药剂/测试/PI-008 合同，盘点根 dirty baseline，创建独立分支/worktree | M0/M1 完成；尚未修改源码 | 审计当前实现并新增专项 T1 |
| 2026-07-18 | Implementing | 修复 Launcher 触摸、焦点、lease、图鉴与炼金 CTA；终局在清零前取快照并展示真实写入 | M2 完成；未修改药剂/符文/经济规则 | 运行专项与回归验证 |
| 2026-07-18 | Verifying | 专项 T1、相关机制 T1、390×844 浏览器与真实 `TouchEvent` Harness、终局 Harness 全部完成 | M3/M4 完成；phase 套件仅保留既知 1 项基线失败 | Git 收口并提交 integration 交付物 |
| 2026-07-18 | Goal Done | 吸收三轮只读复核，补齐 PC/移动端双向切换、触摸位移取消、实时网格图鉴、真实双 CTA 与精确 30% 写入锁定；清理临时服务并核对全部 dirty 路径 | M5 完成；本 REQ 范围内无遗留项 | 交 integration REQ 更新中央 TODO / umbrella 状态 |

## 验证证据（2026-07-18）

### T1 / 静态验证

- `node --check src/ui/rune_launcher.js`：通过。
- `node --check src/ui/game_over.js`：通过。
- `node tests/validate_launcher_settlement_ux.mjs`：`47/47` 通过；动态覆盖 touch 长按/短按/取消/位移、移动与 PC 双向切换、launcher 自有 lease token、dialog/focus、当前网格覆盖陈旧缓存后的四类图鉴状态、稳定节点继续与真实封装、运行时黑箱，以及 11 × 30% → 3、100 × 30% → 30、`meta_addCurrency` 单次写入与余额快照。
- `node tests/validate_rune_spell_forms.mjs`：`8/8`；`validate_potion_spell_content.mjs`：`22/22`；`validate_potion_nesting.mjs`：`10/10`；`validate_potion_c6_nesting_ui.mjs`：`29/29`。
- `node tests/validate_potion_spell_tree_combat.mjs`：`26/26`；`validate_potion_vfx_contract.mjs`：`66/66`；`validate_spell_vfx_design.mjs`：`43/43`。
- `node tests/validate_scenarios.js`：`128/128`。
- `node tests/validate_phase_contracts.mjs`：`173/174`；唯一失败仍是基线既知的 `gathering HUD converts DOM target centers into canvas coordinates` 顺序敏感正则，本 REQ 未修改其源码或测试。
- `git diff --check`：通过，仅有仓库既有 LF/CRLF 转换提示。

### 浏览器实测

- 默认 `:3002` 被并行 `REQ-20260717-first-run-tutorial` 的 PID `23300` 占用且可识别，本 REQ 未复用错误 worktree、未结束该进程；临时使用 `:3003` 与 `:3004`，收尾时精准关闭自身 PID。
- 独立 worktree 基线缺少已被源码引用的 `src/music_clip_packs.js`；该文件只存在于根 checkout 的历史未跟踪改动。`:3003` 只读回退服务临时从根 checkout 提供该模块，没有复制、编辑或提交越界文件。
- 390×844：Launcher 与 Picker 均呈现具名 `dialog`；初始焦点、Tab/Shift+Tab 闭环、Escape、取消与焦点恢复通过；取消保持空格和库存不变，短按将库存 `8 → 7` 并把符文放入第 1 格。
- 专项浏览器 Harness 使用真实 `TouchEvent`：完成 560ms 长按后 `touchend` 不落子，`touchcancel` 后的迟到 `touchend` 也不落子；两项均为 `pass`。
- 图鉴：浏览器确认 `undiscovered` 文案、组合提示、无内部 `runeword_` ID；专项 T1 同时验证 `active` / `activatable` / `insufficient` / `undiscovered` 四态。
- 炼金：以现有合法公式 `寒冰符文 + 冰晶符文 + 寒冰符文` 实际形成稳定节点；“手动接触封装”和“继续投料（选择符文）”均存在且可用。继续投料只把焦点移到下一枚符文，账本仍为 `3 / 3 current node · 3 in furnace`；预览未泄漏内部 ID/类型；手动封装成功生成现有霜封药剂。
- 终局：专项 Harness 直接导入真实 `src/ui/game_over.js`，实际渲染 `本局获得 20`、`结算前剩余 11`、`30% 可带出 3`、`已结算 +3`、`结算后持有 43`；页面与 app 实测控制台均无 error。截图仅作为 Codex 会话证据展示，未写入仓库。
- 收尾复核：`:3002`、`:3003`、`:3004` 均无监听；无 launcher / settlement 临时日志、截图或服务产物留在 worktree。
- 性能自适应影响：不触发。修改仅涉及 DOM 事件、焦点、状态文案与结算快照；未新增 Canvas 粒子、渐变、混合模式、`shadowBlur` 或 `CONFIG.performance` 消费，高/中/低档行为一致。

### 文档、索引与状态同步

- `.cursor/rules/ui_system.md` 已同步移动端自有 pause lease / PC 非模态区域、双向 resize、触摸终态、dialog/focus、当前网格图鉴状态、双 CTA、碎片作用域与结算快照合同。
- `src_ui_rune_launcher_js_index.md` 与 `src_ui_game_over_js_index.md` 均由 `scripts/generate_index.py --file ...` 生成，未手工编辑。
- 中央 `TODO.md`、P0 TODO 与 umbrella 卡仍可能显示本 Goal 的旧 planning 状态；这是本 REQ 明确禁止写入的 integration-owned 状态，不在本分支越权修正，交后续串行 integration REQ 统一收口。

## 收口清单

- [x] 所有 dirty 路径均属于本 REQ 或已明确隔离。
- [x] 无未归属临时文件、截图或日志留在活跃目录。
- [x] 两个自动索引均由脚本生成并通过复核。
- [x] `.cursor/rules/ui_system.md` 与实现一致。
- [x] 专项与相关 T1 证据完整；浏览器证据完整。
- [x] Dev server 已精准关闭；收尾时 `:3002` / `:3003` / `:3004` 均空闲。
- [x] 中央 TODO/P0 TODO/umbrella 状态同步明确交给 integration REQ。
- [x] Git diff、`git diff --check` 与 `git status --short --branch` 已收口；仅包含本 REQ 允许的 7 条路径，根 checkout 的历史 dirty baseline 未改变。
