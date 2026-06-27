# P0 交互与机制打磨 TODO（2026-06-19）

本文档承接“先把现有机制打磨好，bug 解决好，再考虑减法或新大功能”的当前方向。它是后续 Agent 的优化大盘：先看当前最高优先级，再按模块进入具体清单。

## 0. 当前最高优先级

| 优先级 | 主题 | 目标 | 状态 |
| :--- | :--- | :--- | :--- |
| P0-A | 阶段切换状态残留 | 暂停、失败、回合结束、继续游戏、overlay 返回时，不残留战斗提示、技能栏、态势条、浮层或临时状态 | 部分处理 |
| P0-B | 大型基底生成节奏 | 核对 V2 大型基底进入导演系统的回合、同屏数量、阵型密度和训练场验证入口 | 部分处理 |
| P0-C | 命运时刻极端状态 | 检查刷新、继续游戏、教程等待、遗物/精华 overlay 返回时的语义一致性 | 基本完成，待浏览器实机复核 |
| P0-D | 钉板编辑闭环 | 继续补齐编辑态视觉、符文融合预览、错误提示一致性和开始采集边界 | 基本完成，待体验微调 |

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
| P0 | 战斗主界面（`#phase-combat`） | 已完成态势条、发射器可读性、命中语义反馈与技能栏层级 | 进入阶段状态残留检查 |
| P0 | 敌人视觉系统 | 已完成足迹/状态/威胁层级、V2 基底外形提示与 low 档性能降级 | 继续核对生成节奏与同屏数量 |
| P0 | 弹珠选择 / 命运时刻（`#phase-selection`） | 已完成首轮交互修正、移动端二次确认、继续游戏恢复契约 | 复查浏览器实机极端状态 |
| P0 | 钉板收集 / 模块编辑（`#phase-gathering` + `#module-editor-layer`） | 已完成模块放置预校验、禁用原因、基础键盘/关闭交互、异形轮廓、放置覆盖预览、符文融合摘要、开始采集边界检查与浏览器脚本 | 后续转入体验微调 |
| P1 | 符文发射器（`#phase-rune-launcher`） | 已完成首轮统一面板/Tab/卡片样式 | 后续建立“钉板融合结果 -> 发射器词条可用”的反馈链 |
| P1 | 遗物 / 商店 / 真理之书 | 局部已有样式修复，整体语法未统一 | 统一奖励、购买、图鉴的卡片结构 |
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
- [x] 教程等待 `PHASE_CHANGED -> selection` 时必须继续排除命运时刻，避免特殊流程误推进新手教程。（代码侧已通过 `ui_isFateMomentPhase()` 统一命运时刻语义；静态契约已锁定该入口）
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

- [ ] 统一配置、管理、词条图鉴三个 Tab 的信息层级：当前配方、库存、激活词条、可合成目标、图鉴发现进度。
- [ ] 把钉板符文融合结果与发射器可用词条建立明确反馈链。
- [ ] 图鉴卡片补齐未发现、已发现、可激活、已激活、材料不足等状态。
- [ ] 移动端检查长列表滚动、弹窗关闭、Tab 切换和底部确认区不被浏览器安全区遮挡。

### 4.2 P1 药剂炼成闭环与法阵 MVP

> 规划入口见 [`potion_alchemy_development_plan.md`](potion_alchemy_development_plan.md)；权威规则见 [`rune_potion_spell_contract.md`](rune_potion_spell_contract.md)。

- [ ] C1 中断与覆盖边界：关闭炼金台、切 Tab、进入战斗、刷新恢复时，已投入符文不返还且草稿状态可解释。
- [ ] C2 法阵选择 MVP：第一版用按钮/分段控件选择 `bottle`、`orb`、`beam`、`meteor`、`tower`，不先做手绘识别。
- [ ] C3 法阵合法性表：扩展 `_potionAlchemyDraft` 记录 `formId`、`nestingMode`、`slotType`，并校验 `spellType x formId`。
- [ ] C4 `spellContent` 解析：从元素宽松匹配迁移到 `RUNEWORD_DB` 的隐藏法术内容，并保留旧 `potionId` 存档兼容。
- [ ] C5 `spellTree` 存档：封装结果保存草稿树，后续 C6 嵌套和 C7 战斗释放都基于该结构推进。

### 4.3 P1 遗物 / 商店 / 真理之书

- [ ] 统一卡片头部：名称、稀有度、来源、代价、收益、禁用原因。
- [ ] 商店购买、遗物选择、图鉴条目使用同一套“可用 / 不足 / 已拥有 / 已满级”状态语法。
- [ ] 设计局内商人首访免费“临时加成类”商品池：明确每种加成的持续范围、数值、互斥规则、刷新/购买限制与 UI 文案；当前实现仅用 `starter_aid_bundle` 占位援助包承接第 3 回合新手保护（护盾/碎片即时发放，基础伤害临时持续 2 回合）。
- [ ] 真理之书补充核心机制验证入口，优先覆盖符文充能、子弹替换、DropPity、智能掉落和 V2 大型敌人。

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
