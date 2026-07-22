# REQ-20260717-ui-polish-integration：UI 打磨串行集成与验收

状态：Goal Complete / Closed
负责人：Codex
开始日期：2026-07-22
最后更新：2026-07-22
当前里程碑：Closed（M5）

## 目标

在共同干净基线中按 A → B → C → D 合并四个 UI/交互批次，解决 pause lease、跨页术语、ARIA、CSS 状态和共享测试冲突，修复 `validate_phase_contracts` 的 gathering HUD 顺序敏感红基线，并完成全量 T1/T3、四档视口浏览器回归、索引/规则/TODO/需求卡同步及 Git 收口。

部分合并、任何红测、缺失浏览器证据、未关闭服务、过期索引或未归属 dirty 路径均不算完成。

## 隔离与基线

- 分支：`codex/REQ-20260717-ui-polish-integration`
- Worktree：`D:/claude/echo-alchemist-REQ-20260717-ui-polish-integration`
- 共同基线：`6f5a74e26858d92549a97ab2408769b02be3ad2c`
- 根 checkout 的战斗/药剂/规范/TODO 历史改动及未跟踪 `src/music_clip_packs.js` 不得被回退、复制进提交或静默吸收。干净模块图断链由 optional boot 提交 `0767b3f` 的受控动态 import 修复，不激活来源/正典不明的 clip-pack loader。

## 必读合同

- [x] `AGENTS.md`
- [x] `.cursor/rules/global.md`
- [x] `.cursor/rules/testing.md`
- [x] `.cursor/rules/process_insights/PI-012_task_closeout_git_hygiene.md`
- [x] `TODO.md`
- [x] `docs/p0_interaction_optimization_todo.md` 0～0.2
- [x] `docs/work_items/active/REQ-20260627-health-all-phases.md` Goal E
- [x] A/B/C/D 四张子 REQ 卡

## 交付提交与顺序

| 批次 | REQ | 交付提交 | 合并状态 |
| :--- | :--- | :--- | :--- |
| A | `REQ-20260717-first-run-tutorial` | `d7ea424` → `4d568c3` | [x] |
| B | `REQ-20260717-run-lifecycle-integrity` | `1146b4b` / `8461cfb` → `7a97ce5` / `0dfb075` | [x] |
| C | `REQ-20260717-mobile-ui-accessibility` | `50e8532` → `f8d0055` | [x] |
| D | `REQ-20260717-launcher-settlement-ux` | `4b27547` → `56c1993` | [x] |

合并前必须审查每批 diff、测试证据、写集和 dirty 归属；冲突逐项解释，不得使用静默覆盖策略。

## 集成职责

- 验证 Goal B 的 `sys_acquirePauseLease(ownerId)` / `sys_releasePauseLease(token)` 与 Goal D launcher token 在真实运行时协作；所有 overlay 只释放自己的 lease。
- 统一“炼金台 / 符文发射器 / 符文配置”“库存 / 仓库”“局内碎片 / 局外符文碎片”的主术语与知识入口。
- 复核遗物、商店、训练场、真理之书、符文发射器、选择器、技能编辑器的 dialog/region、可访问名称、焦点、Escape、disabled / `aria-disabled` 与状态 CSS。
- 将 gathering HUD phase contract 改为验证坐标转换语义，不依赖源码声明排列；C 的 `hud.js` 等价重排不能替代测试修复。
- 更新 `tests/ai_test_runner.js` 与 `tests/README.md`，覆盖本轮相关 T3 入口与使用方式。
- 仅在不扩大交互范围时处理版本/语言/reduced-motion/offline shell；其余保留明确 P2 owner 和状态。
- 复核所有变更源码的 auto index，只通过 `scripts/generate_index.py` 更新。
- 同步 `TODO.md`、P0 TODO、umbrella 卡、A-D 子卡、受影响规则与 process-insights 状态。

## 里程碑

- [x] M0：读取 Goal E、入口规范、测试/收尾合同与四张子卡。
- [x] M1：审查并按 A → B → C → D 合并，解决文本冲突并记录提交。
- [x] M2：完成 pause lease、术语、ARIA、CSS 状态、phase-contract 与共享 runner/README 集成修复。
- [x] M3：所有语法检查、专项 T1、`validate_scenarios`、`validate_phase_contracts` 全绿。
- [x] M4：T1 全绿后运行相关 T3，并在 360×800、390×844、480×854、桌面完成全链路浏览器回归。
- [x] M5：索引、规则、TODO、umbrella/子卡、状态词与 Git 交付内容已收口，最终代码/测试/索引提交为 `aecef4a`；验证服务已精准关闭并确认端口释放。

## 验证顺序

1. 所有变更 JS/MJS `node --check`。
2. A-D 专项 T1 与受影响机制 T1。
3. `node tests/validate_scenarios.js`。
4. `node tests/validate_phase_contracts.mjs`，必须全绿。
5. T1 全绿后启动或复用 `http://localhost:3002`，运行相关 T3。
6. 360×800、390×844、480×854、桌面覆盖：首局教程、pause/abandon、save/continue、shop/resolver、training/truth-book、launcher、gameover；记录真实坐标/滚动尺寸、截图、控制台与 pause lease 嵌套顺序。
7. 精准关闭自启服务，执行索引复核、状态词 `rg`、`git diff --check` 与 `git status --short --branch`。

## 迭代与停止规则

- 任一失败必须定位所属批次或集成层，修复后从同层开始重跑，并重新运行下游闸门。
- 不以预算、耗时或已有子卡证据代替当前合并树上的验证。
- 只有同一外部阻塞连续三轮仍无法突破，且卡片记录尝试、证据和最小用户输入后，才允许标记 `Blocked`。

## 进度记录

- 2026-07-22：根 checkout 只读盘点完成；A/B/D worktree 干净，C 初始为 9 条专属 dirty 路径。
- 2026-07-22：C 重新通过语法检查、移动专项 `58/58`、场景 `128/128`、阶段合同 `174/174`、索引生成与 `git diff --check`，形成干净交付提交 `50e8532`。
- 2026-07-22：从共同基线 `6f5a74e` 创建本分支与独立 sibling worktree；按 A → B → C → D 精确 cherry-pick 为 `4d568c3`、`7a97ce5`、`0dfb075`、`f8d0055`、`56c1993`。
- 2026-07-22：修复 launcher 最后 lease 释放时同步 continuation 重入、旧 opener 抢焦点、terminal/reset/abandon 残留 token；gameover 50ms 延迟改用 run lifecycle scheduler 并补 forced fake-clock 回归。
- 2026-07-22：phase contract 改为直接调用 `ui_getCanvasPointForElement()` 验证锚点/缩放/夹取语义；恢复 `hud.js` 原声明顺序后仍为 `175/175`，证明测试不再依赖源码排列。
- 2026-07-22：建立炼金台/符文配置/符文仓库/双碎片 canonical map、真理之书主解释与双向跳转；最终术语测试 `36/36`。
- 2026-07-22：最终源码与测试 JS/MJS 语法检查 `89/89`；全部 `23/23 validate_*` 共 `2774/2774`，其中 launcher/结算 `54/54`、生命周期 `109/109`、phase `175/175`、移动 `60/60`、术语 `36/36`、场景 `128/128`。
- 2026-07-22：全量索引脚本扫描结果为 indexed `36`、skipped `27`；生成/更新 `.cursor/rules/auto_index/INDEX.md`、`_meta.json` 与 `src_ui_system_js_index.md`，所有生成路径归本 integration 批次。
- 2026-07-22：UI T3 在真实 360×800、390×844、480×854、1440×900 四档视口通过 `32/32`，产出 12 张 PNG 与 JSON；零未分类问题、零横向溢出。
- 2026-07-22：T3 精确分类仅包含 optional-local-audio `256` 次与首次导航图片 controlled-navigation-image-abort `97` 次；报告位于 `D:/claude/echo-alchemist-v2-1766564886/tmp/codex/REQ-20260717-ui-polish-integration/t3-final-20260722-r7/ui-polish-report.json`。
- 2026-07-22：测试适配器固定 Google Fonts 与 Pixi 7.4.2 CDN 响应，使 UI T3 使用文档约定的 Canvas2D fallback；本证据不宣称 WebGL 覆盖。
- 2026-07-22：A-D 映射、集成修复 `db5efa6`、optional boot `0767b3f` 与最终代码/测试/索引 `aecef4a` 已记录；根 checkout 的历史 combat/potion/资产 dirty 内容未被吸收。

## 最终验收证据

| 闸门 | 结果 |
| :--- | :--- |
| 源码 + 测试 JS/MJS 语法 | `89/89` |
| 全部 `validate_*` | `23/23` 套件，合计 `2774/2774` |
| 关键专项 | phase `175/175`；术语 `36/36`；移动 `60/60`；生命周期 `109/109`；launcher/结算 `54/54`；场景 `128/128` |
| 四档 UI T3 | 真实 360×800、390×844、480×854、1440×900，`32/32` |
| T3 产物 | 12 PNG + `ui-polish-report.json` |
| 浏览器质量门 | 未分类问题 `0`；横向溢出 `0` |
| 精确分类 | optional-local-audio `256`；controlled-navigation-image-abort `97`（仅首次导航图片） |
| Auto index | indexed `36`、skipped `27`；生成/更新 `INDEX.md`、`_meta.json`、`src_ui_system_js_index.md` |

浏览器证据：`D:/claude/echo-alchemist-v2-1766564886/tmp/codex/REQ-20260717-ui-polish-integration/t3-final-20260722-r7/ui-polish-report.json`。测试适配器固定 Google Fonts 与 Pixi 7.4.2 CDN 响应，按项目文档运行 Canvas2D fallback；该套件不构成 WebGL 覆盖声明。

提交归属：A `d7ea424 -> 4d568c3`；B `1146b4b` / `8461cfb -> 7a97ce5` / `0dfb075`；C `50e8532 -> f8d0055`；D `4b27547 -> 56c1993`；集成修复 `db5efa6`；optional boot `0767b3f`；最终代码/测试/索引 `aecef4a`。

服务关闭：已按 PID 精准停止本轮验证服务 `24584`；复核结果 `ProcessAlive=False`、`:3002 ListenerCount=0`，未遗留后台 Node 服务。

## 同步闸门

- Auto index：done；全量扫描 indexed `36`、skipped `27`，只由 `scripts/generate_index.py` 更新中央 `INDEX.md`、`_meta.json` 与 `src_ui_system_js_index.md`。
- 模块规则：done；集成差异已同步受影响规则，没有复制无关子卡内容。
- 进度文档：done；`TODO.md`、P0 TODO、umbrella、A-D 子卡和本卡状态一致。
- Process insights：done；PI-006/007/008/012 已复核，未为无新耦合的内容虚增 PI。
- 资产/性能：本轮不生成资产、不新增粒子/渐变/混合/阴影；若集成修复触发性能规范，必须补 `@perf-impact` 与三档评估。
- 临时证据：12 张截图与原始 JSON 位于忽略目录 `tmp/codex/REQ-20260717-ui-polish-integration/t3-final-20260722-r7/`，不进入活跃源码路径。
