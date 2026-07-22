# P0 交互与机制打磨 TODO（更新至 2026-07-22）

本文档承接“先把现有机制打磨好，bug 解决好，再考虑减法或新大功能”的当前方向。它是后续 Agent 的优化大盘：先看当前最高优先级，再按模块进入具体清单。

## 0. 当前最高优先级

| 优先级 | 主题 | 目标 | 状态 |
| :--- | :--- | :--- | :--- |
| P0-A | 阶段切换状态残留 | 暂停、失败、回合结束、继续游戏、overlay 返回时，不残留战斗提示、技能栏、态势条、浮层或临时状态 | done；debt：极端时机浏览器回归 |
| P0-B | 大型基底生成节奏 | 核对 V2 大型基底进入导演系统的回合、同屏数量、阵型密度和训练场验证入口 | done；debt：后续调参 |
| P0-C | 命运时刻极端状态 | 检查刷新、继续游戏、教程等待、遗物/精华 overlay 返回时的语义一致性 | done；debt：浏览器实机复核 |
| P0-D | 钉板编辑闭环 | 继续补齐编辑态视觉、符文融合预览、错误提示一致性和开始采集边界 | done；debt：体验微调 |
| P0-E | 首局教程可完成 | 首个遗物后沿 `marble_pack -> gathering -> combat` 真实主流程推进教程 | integrated / closed；A `d7ea424 -> 4d568c3` |
| P0-F | Run 生命周期完整性 | abandon、终局、新局后旧回调失效；overlay 只释放自身 pause lease | integrated / closed；B + `db5efa6` |
| P0-G | resolver / 局内商店幂等 | 每个奖励只消费一次、每个阶段只进入一次 | integrated / closed；B `7a97ce5` / `0dfb075` |
| P0-H | 局中存档可恢复 | 版本化安全点保存并恢复阶段、弹药、resolver、overlay 与队列 | integrated / closed；B `7a97ce5` / `0dfb075` |
| P0-I | 移动端关键操作可达 | 360/390/480 下暂停、训练场、系统页关闭/滚动可触达 | integrated / closed；C `50e8532 -> f8d0055` |
| P0-J | 战斗关键信息可见 | combat/training 态势条、dock 安全边界与技能禁用原因符合合同 | integrated / closed；C；移动专项 `60/60` |

P0-E～J 已关闭。最终源码与测试语法检查 `89/89`；全部 `23/23 validate_*` 共 `2774/2774`；360×800、390×844、480×854、1440×900 跨批 T3 为 `32/32`，12 张 PNG + JSON，零未分类问题、零横向溢出。

## 0.1 2026-07-17 实机 / 代码审计 backlog 关闭账

旧页面的“首轮 done”不再作为本批验收证据。以下条目以四个独占实现批次与 Goal E 集成面为准；`integrated` 表示代码与子批验收已合入，最终跨批 T3 仍服从上方统一占位。

| ID | 优先级 | 原问题与验收信号 | 关闭批次 | 状态 / 当前证据 |
| :--- | :--- | :--- | :--- | :--- |
| `UX-P0-01` | P0 | 首局教程不得等待普通 `selection`；新存档应沿首遗物、弹珠包、采集、战斗完成 | A | integrated / closed；教程 `36/36` |
| `UX-P0-02` | P0 | 360/390 暂停恢复与放弃按钮必须真实坐标可达、安全区无裁切 | C | integrated / closed；移动专项 `60/60` |
| `UX-P0-03` | P0 | abandon/gameover/new run 后旧 banner、resolver、战斗回调不得复活 | B | integrated / closed；run/phase epoch + terminal cleanup |
| `UX-P0-04` | P0 | 遗物跳过 -> 商店 -> `marble_pack` 不得双消费或重复进阶段 | B | integrated / closed；stable reward ID + resolver/session 幂等 |
| `UX-P0-05` | P0 | 安全存档必须覆盖可恢复状态，坏档不得伪造继续入口 | B | integrated / closed；schema v2 + safe checkpoint |
| `UX-P0-06` | P0 | run shop、发射器、模块编辑器关闭只释放自身 pause owner | B + D + E | integrated / closed；真实 lease registry，`db5efa6` 修复同步续调重入 |
| `UX-P0-07` | P0 | combat/training 态势条按阶段可见，不被最终 CSS 反转 | C | integrated / closed；移动专项 `60/60` |
| `UX-P0-08` | P0 | 移动训练场所有控制/说明/退出可单轴滚动到达 | C | integrated / closed；360/390/480 子批实测 |
| `UX-P1-01` | P1 | 移动 dock 与战场共用安全边界，正文/目标达到可读性基线 | C | integrated / closed |
| `UX-P1-02` | P1 | 技能禁用原因可读，并与 `disabled` / `aria-disabled` 一致 | C | integrated / closed |
| `UX-P1-03` | P1 | 核心 overlay/dialog 支持键盘、焦点圈定、Escape 与焦点恢复 | B + D + E | integrated / closed；跨页 ARIA/focus 由 `db5efa6` 收口 |
| `UX-P1-04` | P1 | 商店不足状态不可误触且原因可读；移动列表稳定单轴滚动 | B + C | integrated / closed |
| `UX-P1-05` | P1 | 真理之书保底说明符合权威机制，移动分类/Boss 列表无二维滚动 | C | integrated / closed |
| `UX-P1-06` | P1 | 长按只看说明、短按只选择，取消事件不遗留 press，launcher 只释放自身 lease | D + E | integrated / closed |
| `UX-P1-07` | P1 | 图鉴区分未发现、可激活、已激活、材料不足，不泄漏内部 ID | D | integrated / closed |
| `UX-P1-08` | P1 | 稳定节点文案与真实“封装/继续投料” CTA 一一对应；局内外碎片可辨 | D + E | integrated / closed；术语 `36/36` |
| `UX-P1-09` | P1 | 终局区分本局获得、结算前剩余、30% 可带出、实际已结算 | D | integrated / closed；展示取真实写入路径 |
| `UX-P1-10` | P1 | Continue 显示真实 Round；坏档隐藏/安全降级 | B | integrated / closed |
| `UX-P1-11` | P1 | 教程文案匹配设备与 85% 阈值，并只保留一个持久化完成点 | A | integrated / closed |
| `UX-P1-12` | P1 | 真理之书、发射器/炼金台、配置/库存等术语与知识入口统一 | E | integrated / closed；术语 `36/36`，真理之书与炼金台双向入口 |
| `UX-P1-13` | P1 | PC training 三栏白名单与 phase/layout 合同一致，退出无侧栏残留 | C + E | integrated / closed；1440×900 已纳入最终 T3 `32/32` |
| `UX-P1-14` | P1 | `touchcancel` / `pointercancel` 与正常结束共享幂等清理 | B + D | integrated / closed |
| `VIS-P2-01` | P2 | 首页标题/页脚版本、语言标签、字体和简中产品文案统一来源 | later integration pass | debt；本轮不扩大范围 |
| `VIS-P2-02` | P2 | Emoji/fallback、首页/暂停/系统页与名义 9-Slice 的资产语言统一 | later asset pass | debt；正式位图未完成 |
| `VIS-P2-03` | P2 | reduced motion、离线外部依赖与 CSS `!important` 状态层叠收敛 | E / later tech debt | partial：reduced-motion done；offline shell / CSS cleanup debt |

## 0.2 并行执行与集成边界（已执行）

四个实现批次均从共同干净基线进入独立 `codex/<REQ-ID>` 分支/worktree；中央 TODO、umbrella、共享 runner、跨页术语与最终 auto-index 一致性由串行 integration owner 统一收口。冻结接口为 `sys_acquirePauseLease(ownerId)` / `sys_releasePauseLease(token)`；overlay 只能保存和释放自己的不透明 token。

| 批次 | 独占写集摘要 | 集成映射 / 状态 |
| :--- | :--- | :--- |
| tutorial | `tutorial_system.js`、教程 T1/规则/卡及生成索引 | `d7ea424 -> 4d568c3`；Integrated / Closed |
| lifecycle | run/phase、run shop、relic/shop、生命周期 T1/规则/PI 及生成索引 | `1146b4b` / `8461cfb -> 7a97ce5` / `0dfb075`；Integrated / Closed |
| mobile UI | HTML/CSS shell、systems、HUD、移动 T1/规则及生成索引 | `50e8532 -> f8d0055`；Integrated / Closed |
| launcher | rune launcher、game over、专项 T1/规则及生成索引 | `4b27547 -> 56c1993`；Integrated / Closed |
| integration | 中央 TODO、umbrella/子卡、共享 runner、术语、冲突修复、最终索引/T1/T3/Git | `db5efa6` + optional boot `0767b3f`；最终实现 `aecef4a` | Goal Complete / Closed |

## 0.5 上传前收口清单（2026-06-24 巡检）

本节记录最近本地改动中尚未完整收口、尚未实装或尚未上传 `origin/main` 的事项，避免只停留在聊天记录里。

- [ ] 推送本地领先远程的提交：当前 `main` 领先 `origin/main` 9 个提交，HEAD 为 `14204c2 Fix boss alpha assets and training roster`，`origin/main` 为 `ce53ebc`。
- [x] 复核发射器锚点契约：当前源码/测试以 `port` 为炮台旋转圆心和发射锚点、`muzzle` 为视觉端点；`src/utils/emitter_geometry.js` 已在 Git 跟踪内，`node tests/validate_phase_contracts.mjs` 中该项已通过。
- [x] 修复钉板空槽契约：`node tests/validate_phase_contracts.mjs` 当前为 150/150，通过项包含 `pinboard normalization does not refill intentionally emptied active slots`。
- [ ] 纳入必要未跟踪运行时文件：当前 `git ls-files --others --exclude-standard` 展开为 163 个文件，其中 `assets/sprites/enemies/` 49 个、`assets/ui/sprites/` 41 个、`assets/ui/icons/` 5 个、`assets/icons/enemies/` 1 个；这些包含 manifest / 测试 / 运行时引用的 `carrier`、`radiantAegis`、`runeBearer`、`adaptiveRune`、战斗墙体、发射器、SP 与 loot UI 资产。
- [ ] 整理概念稿与资料目录：`docs/design/concepts/` 53 个、`docs/architecture/music_processing/` 11 个未跟踪文件应作为文档/审稿资产单独分组，不要混入运行时资产提交。
- [x] 整理不应上传的临时文件：当前未跟踪列表已不含 `tmp/`、`codex-*.log`、`_verif.mjs`、`docs/archive/tasks/` 等旧巡检残留；`.gitignore` 已覆盖这些路径。
- [x] 修复 `git diff --check` 报告的行尾空格：当前 `git diff --check` 通过，仅剩 Windows LF/CRLF 提示。
- [ ] 明确当前运行时美术资产：`EMITTER_BARREL_SRC` 当前指向 `emitter_barrel_rotating_v5_runtime.png`，`COMBAT_WALL_*_SRC` 指向 `combat_wall_left/right/top_v2.png`；这些文件处于未跟踪状态，必须随运行时代码一起纳入或回退映射。
- [x] 上传前复跑验证：`git diff --check`、`validate_phase_contracts.mjs`、`validate_enemy_spawn_runtime.mjs`、`validate_scenarios.js`、`validate_wave_presets.mjs`、`validate_boss_sprite_assets.mjs` 均已通过。

## 1. 页面 / 系统状态总览

| 优先级 | 页面 / 系统 | 当前状态 | 下一步判断 |
| :--- | :--- | :--- | :--- |
| P0 | 首局教程 / Run 生命周期 | integrated：真实首局链、epoch/resolver/save/pause lease 与 terminal 清理已合入 | Goal E 最终跨批 T1/T3 已完成；代码范围无 reopen 项 |
| P0 | 战斗主界面（`#phase-combat`） | integrated：态势条、dock 安全边界、禁用原因、发射器可读性与命中反馈 | 移动专项 `60/60`；最终跨批 T3 `32/32` |
| P0 | 敌人视觉系统 | done：足迹/状态/威胁层级、V2 基底外形提示与 low 档性能降级 | debt：生成节奏与同屏数量调参 |
| P0 | 弹珠选择 / 命运时刻（`#phase-selection`） | integrated：移动确认、版本化继续恢复、overlay 返回与 resolver 幂等已收口 | 最终 save/continue 跨批 T3 已完成 |
| P0 | 钉板收集 / 模块编辑（`#phase-gathering` + `#module-editor-layer`） | integrated：编辑闭环与自有 pause lease 已收口 | debt：体验微调 |
| P0 | 暂停 / 训练场移动端 | integrated：关键按钮/控制可达、单轴滚动与桌面三栏合同已合入 | 最终 1440×900 侧栏与同会话 resize 回归已完成 |
| P1 | 符文发射器（`#phase-rune-launcher`） | integrated：触摸、pause lease、dialog/focus、图鉴四态与炼金 CTA 已收口 | Goal E launcher/codex T3 已完成 |
| P1 | 遗物 / 商店 / 真理之书 | integrated：购买/ARIA/焦点/规则文案/移动滚动与跨页术语已收口 | 术语 `36/36`；卡片视觉语法后续可继续 polish |
| P2 | 位图化视觉重构 | 规格与素材需求已建档 | 等 P0/P1 交互闭环稳定后再接入素材 |

## 2. 已完成项

### 2.1 战斗主界面

- [x] 新增战斗态势条：聚合防线危险、敌人/精英/Boss 数量、护盾层数、剩余弹药与下一发弹药。
- [x] 固定防线危险语法：稳定 / 压线 / 危险 / 护盾待触发，避免玩家只从敌人位置猜测失败线风险。
- [x] 强化发射器与下一发弹药可读性：HUD 与 Canvas 共用弹药构成、伤害数字、散射弹数、连射次数和主属性摘要。
- [x] Canvas 发射器新增扇形弹丸、装填格、伤害徽标与连射能量条，表达下一发形态。
- [x] 技能栏改为紧凑工具组：顶部显示当前 SP，技能按钮以两列布局呈现图标、成本、可用状态和禁用原因。
- [x] 命中反馈保留“屏障 / 护盾 / 暴击 / 弹射 / 穿透”等直接事件短标签；已移除 `COUNTER_MAP` 驱动的“克制 / 有效”解释标签。

### 2.2 敌人视觉系统

- [x] 明确敌人可碰撞边界和实际占位：大体型、特殊碰撞形状、Boss 会绘制廉价足迹描边和占格分隔线。
- [x] 统一状态 Overlay：护盾、偏折屏障、狂暴、毒素、温度以最多 3 个短标签聚合显示。
- [x] 区分普通、精英、Boss 的第一眼层级：Boss、精英和大型基底会在左上角显示威胁/基底短标签。
- [x] `_drawArchetypeBody()` 覆盖 8 类 V2 基底：`bastion`、`maw`、`deflector`、`echoSpire`、`prism`、`hive`、`siege`、`gravityWell`。
- [x] V2 基底轮廓接入性能降级：low 档关闭 `screen` 混合与 `maw` / `gravityWell` 径向渐变，但保留身份线面。
- [x] 首批大型基底预设波次接入 `src/wave_presets.js`：生成行时先尝试 `spawn_trySpawnWavePreset()`，失败回退旧随机大型基底；每回合最多成功一次，支持 `maxUses`、`cooldownRounds`、intro Toast 和局内存档恢复。

### 2.3 弹珠选择 / 命运时刻

- [x] 子弹替换流程补齐选择数量、禁用原因和上限提示。
- [x] 纯净精华替换路径修复：在没有可替换弹药时能给出合理 fallback。
- [x] 卡片支持键盘焦点、回车/空格确认与基础 ARIA 语义。
- [x] 顶部状态栏加入护盾显示，避免临时护盾只存在于数值层。
- [x] 回合奖励队列和高压提示已接入更明确的反馈入口。
- [x] 移动端粗指针场景下，遗物卡、弹珠卡、钉板模块选择项使用“第一次点选预览 / 第二次确认”的安全流程；桌面鼠标和键盘行为保持不变。

### 2.4 钉板收集 / 模块编辑

- [x] 模块放置从“先清旧布局再尝试写入”改为“先预校验再提交”，避免非法操作破坏旧布局。
- [x] 模块选择浮层会显示不可用项及原因，包括越界、占用、未解锁槽位。
- [x] 模块编辑器补齐键盘逃逸和点击外部关闭的基础交互。
- [x] 为后续符文融合、模块槽视觉状态和开始采集边界预留了交互检查点。

### 2.5 符文发射器

- [x] `#phase-rune-launcher` 已统一配置、管理、图鉴页的面板、Tab、Section、库存卡、激活词条和图鉴卡片视觉语言。
- [x] 符文发射器 Tab 暴露 `data-active` 与 `aria-selected` 状态，CSS 与交互状态在切换后保持一致。

### 2.6 阶段切换状态残留

- [x] `ui_updateUI()` 新增战斗 HUD 清理收口：离开 `combat` 后统一隐藏/重置 `#recipe-hud-container`、`#skill-bar`、`#round-damage-display`、`#combat-rune-charge-ui` 与伤害统计抽屉，避免进入 meta/gameover/selection/gathering 后残留上一轮战斗浮层。
- [x] `training` 阶段保留 `#combat-status-panel` 的态势语义，但清理 combat 专属配方、技能、伤害数字和符文充能 UI。
- [x] 暂停页现在会写入 `isPaused` / `_pausedFromPhase`，关闭暂停时恢复运行；“放弃本局”统一走 `ui_abandonRunToMeta()`，清理局内存档、符文发射器、暂停层和运行态后再回到 meta。
- [x] PC 三栏布局现在只在 `gathering` / `combat` / `selection` / `training` 显示左右侧栏，回到 meta/shop/gameover 等非运行阶段时隐藏常驻侧栏，避免符文发射器或战斗侧栏残留。
- [x] `_proceedToFateMomentSelection()` 补齐 `fateMomentContext.active = true`，确保子弹替换完成后回到命运时刻时，顶部栏、教程过滤和 overlay 返回语义继续被识别为命运时刻而不是普通 selection。
- [x] `ui_clearTransientOverlays()` 统一清理 Boss 入场、混沌轮盘、遗物层、符文选择器、模块编辑器和终局 Toast；gameover 触发点与 meta/shop/truth_book/gameover 阶段刷新都会主动收掉这些高层临时 DOM。

## 3. 下一轮 P0 详细清单

### 3.1 P0-A 阶段切换状态残留

- [x] 检查 `ui_updateUI()` 在离开 combat/training 后是否同步隐藏或重置：`#combat-status-panel`、`#skill-bar`、`#recipe-hud-container`、`#round-damage-display`、伤害统计面板、符文充能 UI。
- [x] 检查暂停打开/关闭时，技能栏、战斗态势条、伤害数字、战斗消息是否保持正确可见性，不遮挡暂停面板。
- [x] 检查游戏失败 / 回到 meta 后，战斗期 DOM、Canvas 提示、临时 Toast、伤害统计按钮和符文发射器入口是否无误留。（代码侧已通过 `ui_resetCombatPhaseHud()` + `ui_clearTransientOverlays()` 收口；仍建议补浏览器脚本覆盖极端时机）
- [x] 检查回合结束、敌人行动、领取符文、遗物/精华 overlay 返回时，阶段标题与顶部栏标签是否不会闪回旧阶段语义：新增 Puppeteer `overlay` 套件，覆盖符文发射器关闭后保留命运时刻、遗物 overlay 回到 selection/shop、round-start relic 关闭后回调 resolver。
- [x] 给上述路径补最小验证脚本：新增 `tests/validate_phase_contracts.mjs`，静态锁定战斗 HUD 清理、terminal overlay 清理、暂停放弃统一入口、gameover 清浮层、命运时刻 active 标记、训练场侧栏白名单、round-start relic 返回目标与继续游戏 selection 恢复契约。

### 3.2 P0-B 大型基底生成节奏

- [x] 阅读 `src/spawn_system.js`、`.cursor/rules/spawn_system.md`、`docs/enemy_wave_preset_design.md`，确认 V2 基底是否都通过导演系统/预设波次进入，而不是落回普通随机词条池。（已新增首批 `ENEMY_WAVE_PRESETS`；未命中时仍保留旧随机大型基底作为回退）
- [x] 核对 preset 层 `2×2`、`2×3`、`3×2`、`3×3` 大型单位数量与放置边界：新增 `tests/validate_wave_presets.mjs`，校验 `maw ≤ 2`、`hive/siege/gravityWell ≤ 1`、`gravityWell` 不与其它大型基底同 preset，且所有 slot 在 6 列内不重叠不越界。
- [x] 补运行期随机生成模拟：新增 `tests/validate_enemy_spawn_runtime.mjs`，连续多回合覆盖 `spawn_trySpawnWavePreset()` 与 `spawn_trySpawnArchetypes()`，确认活跃战场同屏上限不被旧随机基底回退打破。
- [x] 核对早中后期引入节奏：`heavyArmor` 教学段，`deflectionWard` / `echoRelay` 中期，`hive` / `prism` 后期，`siege` / `gravityWell` 高阶。
- [x] 检查大型基底碰撞、足迹、角标与实际尺寸是否一致：`tests/validate_enemy_spawn_runtime.mjs` 已逐类验证 `baseArchetype`、`gridCols/gridRows`、`width/height`、专属词条、`collisionShape/collisionData` 与关键初始化，避免视觉占格和碰撞包围盒不一致。
- [x] 在训练场或图鉴中补充至少 1 个大型基底验证入口，降低后续调参成本。（`enemy_v2` 分类新增 `ev2_wave_preset_spawn`，固定 Round 12 调用真实 `spawn_trySpawnWavePreset()`）

### 3.3 P0-C 命运时刻极端状态

- [x] 复查 `selectionMode`、`pendingSelectionMode`、`fateMomentContext`、`selectionPreviewState`、`relicOverlayReturnState` 的职责边界：`tests/validate_phase_contracts.mjs` 已覆盖命运时刻 active 语义、selection 顶栏判断、round-start relic 返回目标与运行态清理收口；后续仍需浏览器实机覆盖完整 overlay 操作链。
- [x] 刷新 / 继续游戏后，如果处于混沌精华、纯净精华或子弹替换选择态，UI 文案、确认按钮和可选项必须恢复一致。（`sys_saveRunState()` 已持久化 `phase`、`marblesPool`、`selectedMarbles`；`sys_loadRunState()` 对 selection 存档优先恢复卡片 DOM、已选状态、注入符文与预览，再刷新 UI，避免落回 `sys_startRoundStartResolver()`）
- [x] 教程不再把普通 `selection` 当作首局必经点：首个遗物后沿真实 `marble_pack -> gathering -> combat` 事件链推进；命运时刻仍由 `ui_isFateMomentPhase()` 隔离，不会误推进教程。
- [x] 中途打开遗物、商店、图鉴、符文发射器等 overlay 后关闭，必须回到原命运时刻语义，而不是重跑普通选择。（`tests/ai_test_runner.js --suite overlay` 已覆盖符文发射器、遗物选择、真理之书、商店遗物选择与 round-start resolver 返回）

### 3.4 P0-D 钉板编辑闭环

- [x] 初始盘回调为首行 5 个 `dense_stagger` 普通交错钉板，剩余槽位继续通过 5 列中心网格逐步扩容。
- [x] 默认盘不再内置转盘、弹力角、`starter_*` 或其它异形默认机关；底部新增小概率奖励分栏，用竖直 `barrier` 挡板提供爆破/激光等奖励专属属性。
- [x] 模块间距归零，并新增倍化弹珠安全间距审计；挡板/杯口/导流翼仍必须使用真实异形钉，不能用近距圆钉硬拼。
- [x] 已安装钉盘组件在编辑态画布中显示轻量异形轮廓，区分导流翼、菱格、杯形、沙漏、螺旋、桥形等组件身份。
- [x] 模块选择浮层 hover/focus 候选组件时，画布同步区分当前选中槽、可放置覆盖槽和不可放置覆盖槽；不可放置项保留原因反馈且不会阻断预览事件。
- [x] 模块选择浮层补统一的错误提示组件，不可放置、库存失效、移动端二次确认和开始采集阻塞统一走编辑器内错误条。
- [x] 符文融合结果在编辑器底栏显示已注入属性钉摘要，并在融合弹层显示实际目标钉数量与发射器词条线索；语义上区分“钉板属性钉”和“发射器 3x3 词条”。
- [x] 开始采集前检查空槽、非法 ref、多格组件越界、超出已解锁槽位、覆盖格不同步、未确认融合预览等边界，并给出阻塞原因。
- [x] 给钉板编辑闭环补浏览器手测脚本或录屏检查清单。（`tests/ai_test_runner.js --suite pinboard` 覆盖编辑器打开、无效开始采集阻塞、模块禁用原因、符文融合预览/确认、有效开始采集关闭编辑器）

## 4. 后续 P1 / P2 清单

### 4.1 P1 符文发射器信息架构

- [x] 统一配置、管理、词条图鉴三个 Tab 的信息层级：当前配方、库存、激活词条、可合成目标、图鉴发现进度；Tab 同步 `data-active` / `aria-selected`。
- [x] 把钉板符文融合结果与发射器可用词条建立明确反馈链：`#rune-pinboard-fusion-summary` 现在在发射器配置页展示已注入钉板属性、采集影响和关联词条线索；钉板编辑器确认融合或替换组件后会刷新该摘要。
- [x] 图鉴卡片补齐未发现、已发现、可激活、已激活、材料不足等状态；显示文案不泄漏内部 `runeword_*` ID。
- [x] 移动端长列表滚动、弹窗关闭、Tab 切换和底部确认区已由 Goal D 子批实测，并由 Goal E 四视口 T3 `32/32` 复核。

### 4.2 P1 药剂炼成闭环与法阵合同

> 规划入口见 [`potion_alchemy_development_plan.md`](potion_alchemy_development_plan.md)；权威规则见 [`rune_potion_spell_contract.md`](rune_potion_spell_contract.md)。

- [x] C1 done：中断与覆盖边界。关闭炼金台、切 Tab、进入战斗、刷新恢复时，已投入符文不返还且草稿状态可解释；`tests/validate_phase_contracts.mjs` 已覆盖统一中断入口与旧药剂覆盖提示。
- [x] C2 done：法阵选择第一版。按钮/分段控件选择 `bottle`、`orb`、`beam`、`meteor`、`tower`，不做手绘识别。
- [x] C3 done：共享法阵合法性表。`src/potion_nesting.js` 校验 parent form、parent slot、child form、child spellType、child nesting mode。
- [x] C4 done：`spellContent` 解析。炼金台从 `RUNEWORD_DB` 公式生成隐藏 `spellContentId` / `spellType`，封装前 UI 仍只显示结构稳定/可继续/排斥/坍塌，并保留旧 `potionId` 与 9 个静态药剂释放兼容。
- [x] C5 done：`spellTree` root 存档。封装结果保存 root 草稿树。
- [x] C6 done：继续投料生成新隐藏节点，合法父子查表接入 `root.children`；非法嵌套整炉坍塌，已投入符文不返还，只按失败规则补偿；封装前 UI 仍只显示未知稳定节点、结构稳定/排斥/坍塌。
- [x] C7 done：Root Orb carrier 与 Tower 基础运行时，已覆盖阻挡/承伤、范围/冷却、生命周期、active/death 互斥与非法树拒绝；debt：Tower 专用资产、长期平衡和深层子法术调度。

### 4.3 P1 遗物 / 商店 / 真理之书

- [ ] 统一卡片头部：名称、稀有度、来源、代价、收益、禁用原因。
- [ ] 商店购买、遗物选择、图鉴条目使用同一套“可用 / 不足 / 已拥有 / 已满级”状态语法。
- [ ] 设计局内商人首访免费“临时加成类”商品池：明确每种加成的持续范围、数值、互斥规则、刷新/购买限制与 UI 文案；当前实现仅用 `starter_aid_bundle` 占位援助包承接第 3 回合新手保护（护盾/碎片即时发放，基础伤害临时持续 2 回合）。
- [ ] 真理之书补充核心机制验证入口，优先覆盖符文充能、子弹替换、DropPity、智能掉落和 V2 大型敌人。
- [x] 真理之书与炼金台/符文发射器建立双向知识入口；核心术语通过 `validate_ui_terminology.mjs` `36/36`。

### 4.4 P2 位图化视觉重构

- [x] 敌人美术风格母题收口：新增 `docs/design/enemy_geometric_whetstone_style.md`，将 V2 敌人统一为“几何磨石块基座 + 镶嵌核心”，并同步引用到位图规格、敌人 V2 视觉文档、资源协议和资产影响评估。
- [x] 敌人资产重生成计划：新增 `docs/design/enemy_asset_regeneration_plan.md`，按 Batch A-E 规划 V2 基底、Composite、Overlay/Icon、Normal/Elite fallback 与 Boss 概念预研。
- [x] Pass 1 概念预览：生成 `bastion`、`maw`、`deflector`、`echoSpire` 四张 alpha 概念稿与 contact sheet，保存到 `docs/design/concepts/enemy_pass1/`。
- [x] Pass 1 视角/打光修正：补充正交正面轻俯视与居中前顶光规范，生成 view-fix 版本并保存到 `docs/design/concepts/enemy_pass1_viewfix/`。
- [x] Pass 1 碰撞框材质层：修正“装饰框”误解，按 `collisionShape/collisionData` 生成 4 个 collision-aligned frame，后续建议接入 `frames` manifest 段。
- [x] 回合 Toast / 下一 Boss 预告资产契约：新增 `docs/design/round_start_boss_toast_asset_contract.md`，明确 `#round-start-banner`、`#combat-next-threat`、状态横幅、威胁槽与 8 个 Boss 预告小像的命名、尺寸和 prompt。
- [x] 回合 Toast / 下一 Boss 预告 Pass 1：生成并接入 `round_title_panel_9s.png`、`round_threat_plate_9s.png`、`boss_unknown_seal.png`、8 个 `boss_<bossId>_preview/tiny.png`，并在 `bitmap_icons.js` / `game_system.js` / `ui_system.js` / `bitmap_ui.css` 中替换旧 CSS 剪影与旧标题牌帧。
- [ ] 按 `docs/design/enemy_asset_regeneration_plan.md` 执行 Pass 1：重生成 `bastion`、`maw`、`deflector`、`echoSpire` 四个 V2 基底与对应图标。
- [ ] 按 `docs/design/round_start_boss_toast_asset_contract.md` 继续生成状态化 `round_toast_<state>_*.png` 横幅、`round_threat_plate_danger_9s.png` 和 `boss_preview_frame_danger.png`。
- [ ] 按 `docs/ui_asset_requirements.md` 和 `design_spec_bitmap.md` 逐项补 UI 9-Slice、弹药图标、符文图标、遗物图标、词条图标。
- [ ] 在素材接入前保留现有 DOM / Canvas 逻辑，先替换静态装饰层，避免同时改交互和美术资源。
- [ ] 接入 Sprite 或高开销 Canvas 特效时，必须先读 `.cursor/rules/performance.md` 并补 `// @perf-impact` 与三档评估。

## 5. 分层验收清单

### 5.1 通用静态检查

- `node --check src/ui_system.js`
- `node --check src/systems.js`
- `node --check src/game_system.js`
- `node --check src/combat_system.js`
- `node tests\validate_scenarios.js`
- `node tests\validate_phase_contracts.mjs`（当前运行时语义 `175/175`）
- `node tests\validate_ui_terminology.mjs`（当前 `36/36`）
- `node tests\validate_mobile_ui_contracts.mjs`（当前 `60/60`）
- Goal E 最终结果：源码与测试 JS/MJS 语法 `89/89`；全部 `23/23 validate_*` 共 `2774/2774`，包括 phase `175/175`、术语 `36/36`、移动 `60/60`、生命周期 `109/109`、launcher/结算 `54/54`、场景 `128/128`。

### 5.2 自动索引要求

如果修改已索引大文件，按 `AGENTS.md` 要求更新对应函数索引，例如：

```bash
python scripts/generate_index.py . --file src/ui_system.js
python scripts/generate_index.py . --file src/systems.js
python scripts/generate_index.py . --file src/spawn_system.js
python scripts/generate_index.py . --file src/entities/enemy.js
```

严禁手动编辑 `.cursor/rules/auto_index/` 目录。

### 5.3 浏览器 / 交互检查

- 首页能正常加载，无新增启动期脚本错误。
- 移动宽度下检查：弹珠选择、遗物选择、模块选择、符文发射器、战斗技能栏不遮挡关键操作。
- 战斗阶段检查：态势条、发射器、技能栏、符文充能、伤害数字、敌人状态短标签不互相覆盖。
- 阶段切换检查：combat -> enemy turn -> reward -> selection/gathering/meta/gameover 全链路无 UI 残留。
- Goal E 统一套件：`node tests/ai_test_runner.js --url http://localhost:3002 --suite ui-polish --headless` 在真实 360×800、390×844、480×854、1440×900 通过 `32/32`，生成 12 张 PNG + JSON；零未分类问题、零横向溢出。仅分类记录 optional-local-audio `256` 次与首次导航图片 controlled-navigation-image-abort `97` 次。报告：`D:/claude/echo-alchemist-v2-1766564886/tmp/codex/REQ-20260717-ui-polish-integration/t3-final-20260722-r7/ui-polish-report.json`。测试适配器固定 Google Fonts 与 Pixi 7.4.2 CDN 响应，使本轮 UI T3 使用文档约定的 Canvas2D fallback；该结果不宣称 WebGL 覆盖。

### 5.4 性能评估触发条件

凡涉及新增粒子、特效对象、Canvas 混合模式、`shadowBlur`、`createRadialGradient`、敌人绘制、Peg 光效等修改，必须：

- 先读 `.cursor/rules/performance.md`。
- 在受影响代码处补 `// @perf-impact`。
- 在总结中说明 high / medium / low 三档表现。
- 确认已接入 `CONFIG.performance` 预算或说明为何不需要新预算。

## 6. 工作边界

- 先修现有机制与体验断点，再讨论删减或新增系统。
- 不做核心大文件全量重写；超过局部修改范围时先拆模块或补小型辅助函数。
- 交互优化必须同步更新对应索引入口，避免 TODO 散落在聊天记录里。
- 业务逻辑模块禁止直接操作 DOM；UI 状态应通过 UI 层或 EventBus 收口。
- 本地浏览器如果因安全策略无法打开 `localhost`，不绕过策略；改用静态检查、单元验证或等待用户批准。
