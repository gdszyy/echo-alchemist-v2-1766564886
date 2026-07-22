# REQ-20260717-mobile-ui-accessibility：移动端 UI 可达性收口

状态：Integrated / Closed
负责人：Codex
最后更新：2026-07-22
当前里程碑：M5 已完成

## 目标

在不改变业务流程、数值、掉落或战斗判定规则的前提下，让 360×800、390×844、480×854 与桌面布局中的暂停、商店列表、战斗 HUD、训练场和真理之书关键内容可见、可滚、可点击，并恢复战斗态势条与技能禁用原因。

## 范围

允许修改：

- `index.html`
- `src/styles/bitmap_ui.css`
- `src/systems.js`
- `src/ui/hud.js`
- `tests/validate_mobile_ui_contracts.mjs`（可新建）
- `.cursor/rules/systems.md`
- 本 REQ 卡
- 仅由 `scripts/generate_index.py` 生成的 `src/systems.js` / `src/ui/hud.js` 对应 auto index

不处理：

- `game_system.js`、`game_phase.js`、`ui_system.js`、`src/ui/shop.js`、rune launcher 等其它批次业务流程；本分支只负责 `index.html` / `bitmap_ui.css` 中商店移动壳层与列表滚动空间。
- 任何数值、掉落概率、经济、战斗判定或存档语义变化。
- `TODO.md`、`docs/p0_interaction_optimization_todo.md`、主需求卡和共享 runner；本子批当时不写，现已由 integration 批次统一同步。
- 全局 `overflow:hidden` 或无边界新增 `!important` 作为遮盖性修复。

## 必读入口

- `AGENTS.md`
- `.cursor/rules/global.md`
- `TODO.md`
- `docs/p0_interaction_optimization_todo.md`：P0-I/P0-J、UX-P0-02/07/08、UX-P1-01/02/04/05/13
- `docs/work_items/active/REQ-20260627-health-all-phases.md`：Goal C 完整合同
- `.cursor/rules/ui.md`
- `.cursor/rules/systems.md`
- `.cursor/rules/testing.md`
- `.cursor/rules/auto_index/INDEX.md`

## 基线与隔离

- 分支：`codex/REQ-20260717-mobile-ui-accessibility`
- worktree：`D:/claude/echo-alchemist-REQ-20260717-mobile-ui-accessibility`
- 干净基线：`6f5a74e26858d92549a97ab2408769b02be3ad2c`
- 根 checkout 的药剂/战斗代码、规范、中央 TODO 与 `src/music_clip_packs.js` 为历史/并行改动，本 REQ 不读取其工作副本作为实现输入、不回退、不混合提交。
- 验证截图、坐标与尺寸原始记录放在忽略目录 `tmp/codex/REQ-20260717-mobile-ui-accessibility/`；稳定结论回写本卡。

## 影响面与同步闸门

- 代码：HTML/CSS shell、Training Ground / Truth Book DOM 布局、HUD 可访问状态。
- 文档：`.cursor/rules/systems.md` 记录移动单轴滚动、阶段可见性与验收合同。
- 测试：新增 `tests/validate_mobile_ui_contracts.mjs`；复跑场景与阶段合同。
- auto index：预计更新 `src_systems_js_index.md` 与 `src_ui_hud_js_index.md`，必须由脚本生成；若某源文件未改则不更新其索引。
- TODO/进度大盘：本子分支未写；integration 现已统一同步。
- process insights：默认不涉及；若发现可复用的隐蔽耦合，只在不越过写集的前提下记录为 integration handoff，不擅自扩写其它路径。
- 资产/manifest：不涉及。

## 里程碑

- [x] M0 合同确认：Goal C、P0/P1 条目、写集、非目标与验收标准已读取并冻结。
- [x] M1 基线审计：定位六类失败的 CSS/DOM/JS 根因，记录现有 T1 与浏览器基线。
- [x] M2 实现完成：白名单内源码、专项测试与系统规范完成。
- [x] M3 验证完成：T1 全绿；四档视口真实坐标、滚动尺寸、截图与桌面回归完成。
- [x] M4 索引同步：受影响大文件索引仅通过脚本更新，状态一致性完成复核。
- [x] M5 收口：临时服务精确关闭、dirty 路径全部归属、diff/status 闸门通过并形成可审查提交。

## 验收标准

- 暂停“恢复/放弃本局”在 360×800 与 390×844 可用真实屏幕坐标命中，且不被安全区裁切。
- 训练场所有控制、场景说明与退出可通过单轴滚动到达；桌面三栏/侧栏白名单符合 training phase，退出后无残留。
- 真理之书分类、Boss 条目与正文不产生二维或超长横滚；保底/精华说明符合现有权威合同。
- `#combat-status-panel` 在 combat/training 按阶段合同可见，在其它阶段隐藏；移动 bottom dock 不侵入战场安全区。
- 技能禁用原因可读，并与 `disabled` / `aria-disabled` 状态一致。
- 主要交互目标与正文达到移动可读性基线；核心 dialog 具备角色和可访问标签；提供 `prefers-reduced-motion`。
- 不使用全局 `overflow:hidden` 或新增无边界 `!important` 掩盖布局问题。

## 验证命令与证据

- `node --check src/systems.js`
- `node --check src/ui/hud.js`
- `node tests/validate_mobile_ui_contracts.mjs`
- `node tests/validate_scenarios.js`
- `node tests/validate_phase_contracts.mjs`
- T1 结果：移动专项 `58/58`、场景合同 `128/128`、阶段合同 `174/174`；`systems.js` / `ui/hud.js` 语法检查与 `git diff --check` 通过。
- 3002 被不可复用的根 checkout 服务占用（HTTP SHA-256 与本 worktree 不同）；按端口规范改用隔离临时服务 `http://localhost:3013`，仅为基线缺失的 `src/music_clip_packs.js` 提供只读 fallback。验证完成后已精确关闭 3013，本 REQ 未触碰原有 3002/3003 进程。
- 暂停真实坐标：360×800 的设置入口 `(332,107)` 为 `44×44`，唯一滚动区 `360/360`、`640/486`、底部 `154/154`；放弃 `(180,604)` 命中 `320×44` 按钮并真实触发 confirm，取消后仍暂停，恢复 `(180,681)` 命中 `320×54` 按钮并解除暂停。390×844 对应坐标为设置 `(362,102)`、放弃 `(195,653)`、恢复 `(195,730)`，滚动区 `390/390`、`640/539`、底部 `100/101`；480×854 三个目标也均命中，且无需滚动。
- 训练场单轴根滚动：360×800 为 `scrollWidth/clientWidth=360/360`、`scrollHeight/clientHeight=1555/640`、底部 `915/915`，底部控制 `(180,690)` 命中 `344×44`、退出 `(330,102)` 命中 `44×44`；390×844 为 `390/390`、`1555/693`、底部 `862/862`，控制 `(195,739)` 命中 `374×44`、退出 `(360,97)` 命中；480×854 为 `480/480`、`1555/853`、底部 `702/702`，控制 `(240,824)` 命中 `464×44`、退出 `(450,22)` 命中。三档无嵌套滚动 owner，退出后滚动归零且 control/sidebar 恢复到 `train-main-area` 内各自 home marker；`#game-container.scrollTop=0`。
- 真理之书：360×800 根滚动 `360/360`、初始 `1455/640`，Boss `(180,479)` 命中后滚到底 `870/870`，详情 `330/330`、sticky header `top:0`、关闭 `(324,108)` 命中 `44×44`；390×844 对应为根 `390/390`、初始 `1455/693`、Boss `(195,474)`、底部 `817/817`、详情 `360/360`、关闭 `(354,103)`。两档均无横向溢出，重开后 `scrollTop=0`、清空旧选中并恢复空态，外层游戏容器始终未滚动。
- 商店：360×800 列表 `336/336`、`1652/280`、底部 `1372/1372`；390×844 为 `366/366`、`1652/333`、底部 `1318/1319`；480×854 为 `456/456`、`1652/493`、底部 `1158/1159`；桌面 1440×900 为 `400/400`、`1460/339`、底部 `1120/1121`。四档均用坐标滚到底并命中末张卡；三档移动购买目标均为 `56×44` 且命中自身，返回目标均为 `44×44` 并回到 `meta`；`#game-container.scrollTop=0`。
- 移动战斗：360/390/480 的设置与倍速入口均为 `44×44` 且坐标命中，倍速真实点击由 `1x` 变为 `2x`。技能按钮均为 `44×44`；仅切换 `isEnemyTurn` 后，无显式重绘调用也会自动显示 `敌方行动中`、`disabled=true`、`aria-disabled=true`，原因字号 `10px`，恢复玩家回合后自动清除。运行时 HUD `browserFixtureCount=0`，弹药、队列、空队列与态势条实际节点最终计算字号均不低于 `10px`。
- 移动 dock：360×800 起点/高度 `520/120`、战场边界差 `0px`；390×844 为 `573.328/120`、差 `0.328px`；480×854 为 `733.328/120`、差 `0.328px`。三档态势条均可见，dock 与战场安全边界对齐，外层游戏容器未滚动。
- 桌面 1440×900：训练配置/战场/场景三栏分别为 `360/480/420px`，control/sidebar 挂载到左右白名单 mount，退出目标 `44×44` 坐标命中；退出后恢复 `meta`、phase 隐藏、control/sidebar 回到 `train-main-area` 内各自 home marker，桌面专属 mount 隐藏。
- 最终权威浏览器记录：`tmp/codex/REQ-20260717-mobile-ui-accessibility/mobile-ui-browser-final-evidence.json`，`result=PASS`、`pageErrors=0`，覆盖 4 个商店、3 个暂停、3 个真实战斗 HUD、2 个真理之书、3 个移动训练场和 1 个桌面训练场场景；18 张截图尺寸均精确等于目标视口。控制台仅有基线已知的缺失音频 404、Tailwind CDN 提示与 headless WebGL `ReadPixels` 性能提示，无本 REQ 新异常；兼容副本为 `mobile-ui-browser-final-delta.json`。

## 进度记录

| 日期 | 阶段 | Codex 动作 | 结果 | 下一步 |
| :--- | :--- | :--- | :--- | :--- |
| 2026-07-18 | Goal Active | 读取 Goal C、P0/P1 合同与模块/测试规范；盘点 dirty 根基线；从四批共同干净基线创建独立 worktree | M0 完成；worktree 干净 | 运行基线测试并审计六类根因 |
| 2026-07-18 | M1–M2 | 审计暂停/商店/训练/真理之书/态势条/dock/禁用技能七类根因；在白名单内完成 DOM、响应式、生命周期与可访问性修复 | 专项测试覆盖 47 条合同；无业务流程或数值变更 | 四视口实机验证 |
| 2026-07-19 | M3–M4 | 使用真实坐标完成 360/390/480/桌面点击、滚动、截图；补测商店与 10px 可读性；同步 `systems.md`，通过脚本生成 systems/hud 索引 | T1 全绿；35 条原始记录 + 5 条最终增量场景及 14 张截图归档 | M5 Git 收口与提交 |
| 2026-07-20 | M5 | 消除最终层叠与生命周期盲区；使用严格源码 harness 重跑全部目标视口，不注入 HUD fixture；完成写集/业务语义/滚动 owner/索引审计 | 专项 `58/58`；最终浏览器证据 `PASS`、18 张截图、0 page error；临时 3013 已关闭 | 已由 integration 同步中央 TODO/主卡并合入 |

## 收口清单

- [x] 无未归属临时文件或本 REQ 遗留服务进程；浏览器原始证据位于已忽略的 REQ 临时目录。
- [x] 专项测试、场景测试、阶段合同与四视口证据已记录。
- [x] `systems.md` 与受影响 auto index 已同步；索引只由 `scripts/generate_index.py` 生成。
- [x] 中央 TODO/主卡当时保留给 integration owner；现已在集成分支同步。
- [x] `git diff --check` 与 `git status --short --branch` 已记录，所有 dirty 路径均属于本 REQ。

## 集成关闭记录（2026-07-22）

- 交付提交 `50e8532` 已以 `f8d0055` 合入 `codex/REQ-20260717-ui-polish-integration`。
- 集成分支的移动端专项合同现为 `60/60`；phase contract 已改为运行时语义并通过 `175/175`，术语校验通过 `36/36`。
- 本卡保留的 18 张子分支截图是 Goal C 独立证据；Goal E 最终在真实 360×800、390×844、480×854、1440×900 通过 T3 `32/32`，12 PNG + JSON，零未分类问题、零横向溢出；移动静态合同 `60/60`，全部验证 `2774/2774`。报告：`D:/claude/echo-alchemist-v2-1766564886/tmp/codex/REQ-20260717-ui-polish-integration/t3-final-20260722-r7/ui-polish-report.json`。
- 本子需求已完成集成并关闭；P2 的语言/版本统一、正式位图替换、offline shell/CSS 清理不在本卡冒充完成。
