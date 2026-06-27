---
description: "阶段转换逻辑与状态机规范"
globs: ["src/game_phase.js"]
---
# 游戏阶段规范 (Game Phase)

## 1. 状态机概述
游戏主流程围绕三个核心阶段进行循环：命运抉择 (Selection) → 研磨 (Gathering) → 战斗 (Combat)。
- 阶段流转由 `game_phase.js` 统一管理。
- 严禁跨阶段直接调用生命周期方法，必须通过标准状态机接口切换。

## 2. 各阶段职责与出入口条件

### 2.0 研磨阶段点击发射规范（防坑）

**`phase_handleInputStart` 中的点击区域判断**：
- 研磨阶段发射弹珠的点击区域阈值为 `pos.y < this.height * 0.85`，覆盖屏幕上方 85% 的区域。
- **禁止将此阈值降低至 0.5 以下**：钉盘分布在屏幕 20%~70% 高度，过小的阈值会导致点击钉盘中下部区域时被错误路由到"倾斜模式"，弹珠无法发射。
- 底部手柄区域（`height - 40 ± 40px`）已在 `game_system.js` 的 `input_handleInputStart` 中提前拦截，`phase_handleInputStart` 无需重复处理。

### 2.1 回合奖励结算阶段 (Round-Start Reward Resolution)
- **职责**: 玩家在回合开始前处理 round-start resolver 结算后的遗物线索与弹珠包研磨入口。当前主循环不再投放精华奖励；`marble_pack` 是显式研磨入口，`run_resource_pack` 仅用于旧存档兜底。
- **[tsk-f35c6d10] 普通选择入口**：`sys_startRoundStartResolver()` 队列为空时，**不再**进入普通弹珠选择（`sys_initSelectionPhase()`），改为调用 `sys_showRoundStartBanner()` 直接进入战斗阶段（跳过研磨）。
- **[杂色包开局]**：`sys_initGameStart()` 在队列遗物奖励后，额外队列一个 `marble_pack`（`packId: 'mixed'`, `source: 'run_start'`）奖励。遗物选完后，resolver 播放弹珠包飞行动画并调用 `sys_startMarblePackGrind()` 直接进入研磨。
- **入口**: `sys_startRoundStartResolver()` 会先消费 `pendingRoundStartRewards`；若命中 `relic`，进入遗物事件；若命中 `marble_pack`，直接生成 3 枚包内弹珠并进入 `phase_startGatheringPhase()`；若命中旧 `run_resource_pack`，只发放局内碎片并自动继续 resolver。新主循环不得主动队列 `chaos_essence` / `pure_essence`。
- **弹珠包边界**：`marble_pack` 不得写入 `pendingSelectionMode.sourceRewardType = 'marble_pack'`，不得展示命运选择。商店购买弹珠包后也必须直接进入研磨结算；若已有可保留子弹，`sys_startMarblePackGrind()` 负责写入 `_chargedAmmoQueue`，研磨完成后再进入替换子弹阶段。
- **[tsk-668f3dba] 替换子弹阶段（当前实现）**：当弹珠包研磨或历史精华兼容流程带有可保留子弹时，系统会将既有子弹写入**充能子弹**（`_chargedAmmoQueue`，`multicast`/`finalHits` 重置为 0）。研磨阶段全部弹珠结算完毕后，若 `_chargedAmmoQueue` 非空，自动调用 `sys_initReplaceAmmoPhase()` 进入替换阶段；否则直接进入战斗。
  - `replaceAmmoContext`：替换阶段上下文，包含 `active`、`newRecipes`（本回合新研磨，左侧）、`chargedRecipes`（上回合充能子弹，右侧）、`selectedIndices`（多选索引数组，默认全选右侧充能子弹）。
  - UI：`ui_renderReplaceAmmoUI()` 展示两行卡片（NEW GRIND / CHARGED），每张卡片显示属性值、Tier 徽章（C/B/A/S）和主属性主题色。玩家可逐张切换选中，必须选 `min(子弹上限, newRecipes.length + chargedRecipes.length)` 张；纯净精华跳过研磨时即使只有 1-2 枚充能子弹，也可以正常确认。
  - 替换确认：`sys_confirmReplaceAmmo()` 按 `selectedIndices` 从 `allRecipes = [...newRecipes, ...chargedRecipes]` 中取出子弹写入 `ammoQueue`，清空 `replaceAmmoContext` 和 `_chargedAmmoQueue`，恢复 gridEl CSS 布局后进入战斗。
  - 跳过：`sys_skipReplaceAmmo()` 直接使用 `newRecipes` 进入战斗，丢弃充能子弹。
  - **纯净精华特殊分支（跳过研磨）**：在纯净精华界面点击“跳过研磨”（`sys_skipGrindGetRune`）时，系统会随机补偿一个符文，并**优先使用 `_chargedAmmoQueue` 作为可保留弹药**（若无则编译当前 `marbleQueue`），随后清空新研磨子弹并进入只展示 CHARGED 行的替换界面。若没有任何可用充能子弹，系统回到标准弹珠选择，避免空弹药进入战斗。
- **模式分支**: `chaos_essence` 模式沿用标准 3 选流程，但 UI 需显式标记为"混沌精华"；`pure_essence` 模式要求只选择 `1` 枚弹珠，**符文合成为可选项**：有合成时把符文元素追加到该弹珠的 `MarbleDefinition.collected`，并享受同化率加成；无合成时直接进入研磨（单弹珠，无同化加成）。
- **出口**: 玩家做出选择并确认，触发转场动画进入研磨阶段。纯净精华模式下，确认时必须先完成合法性校验，把合成属性写回 `MarbleDefinition.collected`；研磨发射时必须把弹珠已有 `collected` 拷贝进本次 `currentSession.collected`，确保最终子弹 recipe 获得对应属性，并为对应 `marble.type` 写入 `doubleAssimilationBoostRounds`。

### 2.5 回合开始提示与充能特效 (Round Start Banner)
- **触发时机**: `sys_startRoundStartResolver()` 的 `pendingRoundStartRewards` 队列为空时，调用 `sys_showRoundStartBanner()` 并在横幅结束后进入战斗；`sys_startMarblePackGrind()` 直接进入研磨后，也必须以 `sys_showRoundStartBanner({ enterCombat:false, protectCombat:false })` 播放同一横幅作为非阻塞回合提示。
- **局内商人调度**: 在奖励队列清空后、`sys_showRoundStartBanner()` 之前，`sys_maybeOfferRunShopBeforeRoundStart()` 只负责更新商人到访调度并返回 `false`，不得阻塞回合开始横幅。首访固定第 3 回合，后续由 `sys_rollNextRunShopRound()` 按 3..当前回合数随机等待；每次到访停留 2 回合，由右上角紧凑 `#run-shop-status-dock` 在研磨/战斗阶段显示到访/离开倒计时并打开商店。
- **充能触发条件**: 普通回合开始横幅不触发子弹充能；`ammoQueue` 只来自当前保留的最多 3 枚弹珠或显式替换确认。三发上限来自三枚晶石核心充能位，禁止通过遗物或存档字段扩大选择数量。
- **旧资源包边界**：`run_resource_pack` 只增加 `runFragments` 并播放资源反馈，不得进入 `selection` / `gathering`，不得重建 `marbleQueue` 或 `_chargedAmmoQueue`。新主循环应使用局内商店弹珠包作为研磨入口。
- **弹珠符文槽**: 选择阶段的弹珠预览面板允许把符文直接融合进已选弹珠；每颗弹珠最多 3 个 `runeSlots`，融合会立即消耗 `runeInventory` 中的符文。进入研磨/编译时槽位以 `source: 'rune_slot'` 临时加入属性，结算写回 `marble.collected` 时必须过滤，避免重复叠层。
- **实现**: 默认路径先调用 `phase_switchPhase('combat')` 切换背景，然后显示 `#round-start-banner` 游戏容器内大字提示（「第 X 回合開始」），持续约 2.2 秒后自动调用 `phase_startCombatPhase()` 进入战斗。弹珠包开包/历史精华兼容等显式研磨入口仍必须直接调用 `phase_startGatheringPhase()`，但可以把横幅作为非阻塞 overlay 播放，不得为了横幅把弹珠包重新路由到战斗入口。
- **下一 Boss 威胁预告**: `#round-start-banner` 内的 `#round-start-threat` 必须显示下一 Boss 倒计时；未遭遇 Boss 只能显示未知 Boss + 剪影预告，已遭遇 Boss 才显示名称。预告数据统一来自 `src/utils/boss_schedule_utils.js`，不得调用会写入 `bossHistory` 的 `spawn_selectBossForRound()`。
- **子弹队列边界（2026-06-19）**: `sys_showRoundStartBanner()` 只负责进入下一轮战斗阶段，普通回合开始时不得从 `_lastFiredAmmoSnapshot` 或 `marbleQueue` 重建 `ammoQueue`。这两个来源仅用于精华触发 / 子弹替换等显式充能流程，避免下一回合待发射子弹串成上一轮保留子弹或新生成候选弹珠。
- **空弹珠兜底（2026-06-19）**: `phase_startGatheringPhase()` 只允许由精华/命运选择等显式研磨入口调用，并必须在真正初始化时确认 `marbleQueue` 非空；若存档恢复、overlay 返回或特殊流程清空了队列，应通过 `buildFallbackMarbleQueue()` 从选择池/当前权重补齐可发射弹珠，禁止进入没有弹珠的研磨阶段。
- **充能特效**: 同时为 `#pc-left-sidebar` 添加 CSS 动画类 `.ammo-panel-charging`（high/medium 档：边框光流扫过）或 `.ammo-panel-charging-simple`（low 档：简单淡入淡出）。
- **性能门控**: 特效等级由 `CONFIG.performance[perfQualityLevel].roundStartBannerGlow` 控制（high/medium: `true`，low: `false`）。
- **DOM 元素**: `#round-start-banner`（`#game-container` 内绝对定位覆盖层，z-index: 9500，禁止使用 `100vw/100vh` 作为居中基准）、`#round-start-banner-text`（大字文本）。
- **CSS 类**: `.round-banner-hide`（隐藏）、`.round-banner-show`（显示）、`.round-banner-glow`（光晕动画，需 high/medium 档）。

### 2.2 研磨阶段 (Gathering Phase)
- **职责**: 核心打砖块玩法，发射弹珠收集属性，填充弹药队列。
- **入口**: 命运抉择结束，钉板生成完毕，玩家获得发射次数。
- **出口**: 玩家耗尽发射次数且所有弹珠结算完毕，进入战斗阶段。

### 2.2.1 模块化钉盘属性生成契约

- **生成入口**：模块化钉盘由 `phase_gathering_initPachinko_v2()` 调用 `buildModuleEntities()` 构造各模块实体。
- **默认钉盘**：缺失或长度不匹配的 `currentModuleLayout` 必须通过 `createDefaultModuleLayout(totalSlots, CONFIG.gameplay.moduleDefaultSlots)` 初始化；当前初始盘面只开放首行 5 个 `dense_stagger` 1x1 模块，全部为普通交错钉板，不包含默认转盘、弹力角或异形机关；后续通过局内商店按 `moduleUnlockOrder` 扩展剩余槽位。
- **技能点槽退役**：`skill_point` 不再作为钉盘特殊槽生成。`phase_gathering_initPachinko_v2()` / legacy 入口必须过滤旧存档或旧逻辑带入的 `skill_point`；SP 的稳定来源统一为战斗技能充能条。
- **居中解锁顺序**：模块化钉盘使用 `CONFIG.gameplay.moduleCols = 5` 与 `moduleUnlockOrder` 控制可编辑/可构建槽位。业务层与编辑器不得再假设“前 N 个 row-major 槽已解锁”；必须通过 `getActiveModuleSlots()` / `getActiveModuleSlotSet()` 获取激活槽。
- **模块接缝**：`moduleSpacingX/Y` 默认为 `0`；默认 `dense_stagger` 依靠同一交错节奏跨模块连续铺排。新增默认组件时必须按倍化弹珠半径审计圆钉两两中心距，挡板/杯口/导流翼必须使用 barrier，不能用近距离圆钉硬拼。
- **组件实例**：`currentModuleLayout` 的管理单位是钉盘组件实例 `{ id, uid, pegStates, pluginStates }`；多格组件的非锚点槽位使用 `{ ref: anchorIdx }`。旧版字符串布局只允许在 `ensureModuleLayoutInstances()` 中兼容升级。
- **组件库存**：可替换来源必须是 `ownedModuleComponents` 中的组件实例。商店或遗物获得组件时只能向该库存加入 1 个实例，禁止通过 `unlockedModuleTypes` 形成“解锁一次即可无限替换”的模板仓库。
- **融合承载模块**：初始盘使用 `rune_lattice_light` 作为轻量符文融合承载组件，`rune_lattice` / `rune_focus_module` 是后续可获得的强化融合组件；三者通过 `fusionPriority` 标记影响符文注入落点。
- **模块扩展池**：商店可出售的组件可组合现有 Peg / `SpecialSlot` 能力形成新玩法，如 `split_gate_module`（分裂槽）、`recall_loop_module`（召回槽）、`cascade_bank_module`（弹钉斜坡）、`crucible_core_module`（固定属性三角）、`double_wheel_module`（双轮盘）、`fusion_garden_module`（2x1 融合承载）、`split_yoke_module`（Y 字分流）、`hourglass_gate_module`（1x2 聚焦/分流）、`crescent_bank_module`（2x1 横移导流）、`spiral_return_module`（2x2 回收）、`prism_splitter_module`（固定属性分光）、`twin_wheel_bridge_module`（3x1 双轮盘横桥）、`launcher_gate_module`（旋向高速发射槽）、`pinwheel_capacitor_module`（5 杆连射蓄能轮）、`turbine_loop_module`（杆轮 + 发射器回路）和 `swerve_cannon_module`（定向斜炮）。
- **机关槽位语义**：`SpecialSlot` 可使用 `launcher` 与 `energy_wheel` 两种可重复触发机关。两者必须设置 `persistent: true`、`activationCooldown` 和 `maxCharges`，通过 `tryActivate()` 控制同一研磨会话的触发上限；旧 `recall` / `multicast` / `split` / `wheel` 槽仍保持触发后消失。`launcher` 只改变当前弹珠速度与位置，`energy_wheel` 只向最多 3 个当前 `gatheringSessions` 增加 `multicast`，不得直接改写 `ammoQueue` 或跨阶段状态。
- **组件路线元数据**：组件可通过 `shape` 声明 `footprint`、`entry`、`exit`。该元数据只用于商店/编辑器说明与后续轻量轮廓绘制，不参与物理结算。
- **编辑器轮廓**：`render_moduleEditorOverlay()` 会根据 `shape.footprint` 绘制轻量组件轮廓（导流翼、菱格、杯形、沙漏、螺旋、桥形等）。轮廓仅使用平面 `stroke` / 曲线，不得新增粒子、渐变或额外 `shadowBlur`。
- **编辑器入口与点击语义**：研磨阶段只显示「编辑钉板」入口，玩家点击后才进入编辑态；`render_moduleEditorOverlay()` 只在编辑态绘制槽位选择提示。`_moduleEditor_handleClick()` 只能选中槽位和刷新预览，装备/卸下必须由库存栏中的「装备到槽位」/「卸下」按钮确认。
- **密度参数**：模块内部最小钉距由 `CONFIG.physics.pegRadius`、`CONFIG.physics.marbleRadius` 与 `CONFIG.physics.pinboardSpacingBuffer` 共同决定；不得在模块生成器里重新硬编码旧版大弹珠间距。
- **权重来源**：模块生成普通钉子时必须读取当前 `game.unlockedWeights`，其中 `white` 映射为普通钉子权重，初始化随机属性钉只允许 `bounce` 与 `damage` 两种纯净弹珠属性。`pierce`、`scatter`、`cryo`、`pyro` 等元素/战斗属性只能由弹珠本身、符文融合、奖励区或其它显式机制写入。
- **禁止类型**：与旧版 `phase_gathering_getRandomPegType()` 保持一致，`laser`、`lightning` 与变异属性 `wind` 不得作为初始化随机钉子类型生成。
- **底部奖励分栏**：`phase_gathering_initPachinko_v2()` 会按 `CONFIG.gameplay.bottomRewardZoneChance` 小概率在底部生成 1 个窄奖励区，宽度由 `bottomRewardZoneWidthMultiplier` 按倍化弹珠直径换算，两侧使用 `shape='barrier'` 的竖直 Peg 挡板。弹珠进入分栏时返回 `reward_zone`，向当前收集列表写入 `{ type, level: 1, source: 'bottom_reward_zone' }`，用于提供 `explosive` / `laser` 等奖励专属属性。
- **覆盖边界**：只允许随机覆盖模块生成出的 `normal` 钉子；模块预置的 `pink`、固定 `cryo` / `pyro` 等特殊钉子必须保留，以免破坏模块本身定位。
- **后置流程**：随机属性生成完成后，`pendingFusions` 会优先注入 `fusionPriority` 更高的普通钉子，再按中下区域价值排序；注入结果必须通过 `setModulePegState()` 写回组件实例的 `pegStates`，保证重建、拆卸或替换其它组件后，被同化钉子的属性不丢失。模块编辑器中选择符文融合后必须立即调用 `phase_gathering_initPachinko(false)` 重建当前盘面，保证玩家在点击「开始采集」前看到真实融合结果。
- **融合预览**：模块编辑器存在 `_moduleEditorRunePreview` 时，`render_moduleEditorOverlay()` 必须用 `selectFusionTargetPegs()` 高亮目标钉子；该高亮只做轻量描边/填充，不新增粒子或高开销阴影。
- **空槽契约（2026-06-23）**：`ensureModuleLayoutInstances()` 只能规范化已有布局，不得把已解锁但为 `null` 的槽位重新补成默认 `dense_stagger`。玩家在编辑器中卸下组件后，该槽位必须保持为空，避免重复向 `ownedModuleComponents` 生成同一默认组件。
- **第二行解锁遗物（2026-06-23）**：`pinboard_second_row` 使用 `effect: 'module_row_unlock'` 将 `unlockedModuleSlots` 提升到 `targetSlots: 10`。只有这次新解锁的槽位允许一次性填入 `dense_stagger` 起始组件；之后玩家可卸下并保持为空。
- **融合目标说明（2026-06-23）**：模块编辑器符文融合预览必须同时说明目标槽位与承载组件名称，并用画布高亮实际落点，避免玩家不清楚符文会融合到哪个钉盘模块。

### 2.3 战斗阶段 (Combat Phase)
- **职责**: 使用收集到的弹药队列攻击敌人，进行回合制结算。
- **入口**: 研磨阶段结束，弹药队列生成，敌人刷新。
- **出口**: 
  - 胜利: 敌人血量清零，触发掉落结算，`phase_finalizeRound()` 在 `ammoQueue` 为空时自动调用 `sys_saveRunState()` 将局内全量状态写入 `localStorage`，然后进入下一回合的命运抉择阶段。
  - 失败: 玩家防线被突破，调用 `sys_clearRunState()` 清除局内存档，游戏结束 (Game Over)。

### 2.4 局内存档与刷新恢复
- **存档时机**: `phase_finalizeRound()` 末尾，`round++` 之后、`sys_startRoundStartResolver()` 之前；此外，进入命运时刻阶段、切换弹珠选择、绑定纯净精华符文时，也应即时调用 `sys_saveRunState()`，避免刷新后丢失当前选择与注入上下文。
- **存档内容**: `phase`、round、score、enemies（含 Vec2 坐标）、pegs（type/level/frozenTurns）、ownedRelics、runeInventory、runeGrid、unlockedWeights、guaranteedNextRound、`pendingRoundStartRewards`、`pendingSelectionMode`、`selectionMode`、`selectionRequiredCount`、`marblesPool`、`selectedMarbles`、`selectionInjectedRune`、`selectionPreviewState`、`relicOverlayReturnState`、`fateMomentContext`、`replaceAmmoContext`（[tsk-668f3dba] 替换子弹阶段上下文）、`doubleAssimilationBoostRounds`、Boss 系统字段、难度字段、钉盘形态、`runFragments` / `runShopInventory` / `runShopRefreshes` / `_runShopOpenedRound` / `runShopNextOfferRound` / `runShopActiveUntilRound` / `runShopLastArrivalRound` / `runShopScheduleStartRound` / `runShopScheduleGap` / `runShopStarterBoostClaimed` / `runShopStarterBoostDamageAmount` / `runShopStarterBoostDamageRounds` / `_runShopInventoryGeneratedForRound`、技能、统计数据等。
- **恢复入口**: Meta 页面「繼續上次游戲」按钮（`#meta-continue-btn`），调用 `meta_continueRun()`。
- **恢复流程**: `sys_resetGame()` + `meta_applyUpgrades()` → 注入存档状态 → `phase_gathering_initPachinko(true)` 重建钉盘 → 若存档处于 `replaceAmmoContext.active`，直接恢复替换子弹 UI；若存档来自 `selection` / 命运时刻，必须重建候选卡片 DOM、恢复 `selectedMarbles` / `selectionInjectedRune` / 预览态并执行 `ui_refreshSelectionModeUI()`；只有普通回合恢复才进入 `sys_startRoundStartResolver()` 继续结算待处理遗物/精华。
- **清档时机**: 游戏结束（`_gameover_triggerPhase`）或新开一局（`meta_startRun`）时自动清除。

## 3. 阶段转换规范
- **清理与重置**: 每次阶段切换（`phase_switchPhase`）时，必须彻底清理上一个阶段的残留状态（如清空粒子特效容器、重置物理引擎状态）。
- **UI 同步**: 阶段切换必须同步触发相应的 UI 更新事件，确保界面展现与内部状态一致。

## 3.1 暂停机制 (Pause)
- 暂停**不是阶段切换**，而是以 DOM-only overlay 方式叠加在当前阶段上方。
- 暂停由 `ui_openPause()` 触发，设置 `this.isPaused = true`，`sys_loop` 将跳过所有物理更新。
- 恢复由 `ui_closePause()` 触发，设置 `this.isPaused = false`。
- 仅允许在 `gathering`、`combat`、`training` 阶段暂停；其他阶段调用 `ui_openPause()` 无效。
- `sys_resetGame()` 中会自动重置 `isPaused = false`。

## 4. 敌人回合逻辑与温度结算
### 4.1 扫描波与行动
- 敌人回合通过扫描波自下而上触发。
- 只有未被冰冻（`isFrozenCurrentTurn === false`）且存活的敌人才能执行行动。

### 4.2 温度结算与冰冻判定
- 当敌人温度 `< 0` 时，进行冰冻判定：
  - `temp <= -100`：强制冰冻（100%）。
  - `-100 < temp <= -50`：根据温度概率冰冻（0% ~ 100% 线性增加）。
- **冰冻衰减机制**：若判定被冰冻，则 `e.isFrozenCurrentTurn = true` 且 `e.frozenCount` 增加 1。该计数用于在 `Enemy.applyTemp` 中衰减后续的降温效果（系数为 `0.9 ^ frozenCount`）。
- **温度回暖**：每回合结算时，负温度减半（`Math.ceil(e.temp / 2)`），正温度自然衰减或造成燃烧伤害。
- **毒素 DoT（2026-06-26）**：`phase_enemy_processTurn()` 通过 `phase_calcVenomEffectiveStacks()` 计算有效毒层，读取 `CONFIG.mechanics.venom.linearStacks` 与 `overflowSqrtScale`：前段线性，溢出层按 `sqrt` 边际递减。过热仍结算 2 次，冻结仍暂停但保留层数；敌人回合扫描波命中时若检测到刚解冻，必须先调用 `phase_playThawFeedback()` 清除冻结行动标记并播放解冻反馈，再额外结算 1 次毒素回合伤害，并乘以冰霜共鸣的 `frozenPhysDmgBonus`。毒素 DoT 伤害统计必须记录为 `venom`。
- **Ignis 温压例外（2026-06-22）**：`bossType === 'ignis'` 时，100℃以上的正温结算不得调用普通燃烧 DoT。`phase_enemy_processTurn()` 会把 `temp - 100` 加上 `bossConfigs.ignis.furnacePressureBaseGain` 转为 `furnacePressure`，温压达到 `furnacePressureThreshold` 时触发 `Enemy._grantRadiantAegisPulse()`；cryo 命中和负温结算按配置比例泄压。该逻辑只属于 Ignis，不得影响普通敌人的过热路径。
- **Tesla 导体网络（2026-06-22）**：`Enemy.startTurnAction()` 在 Tesla 未暴露破绽、未被冻结时调用 `_tickTeslaNetwork(game)`。该 tick 会先电击随机非 Boss 敌人并转为导体，再按导体数量/充能状态结算 `teslaFieldPower`、召唤进度和非重叠导体生成。`phase_enemy_startLogic()` 同时递减导体 `_teslaChargedTurns`，到期移除由 Tesla 机制授予的临时 `haste`。

## 5. Boss 系统规范

### 4.1 Boss 回合触发规则
- **第一个 Boss**：固定在 Round 5
- **后续 Boss**：基础间隔为 7-9 回合（均匀随机），并根据玩家击杀上个 Boss 的速度动态延期
- **延期规则**：快速击杀（≤ 2 回合）延期 2 回合；中速（3 回合）延期 1 回合；慢速（≥ 4 回合）不延期
- **延期限制**：第三个 Boss 之后（已生成数量 >= 3）不再延期，固定使用 7-9 回合基础间隔
- **Boss 类型**：第 1-3 个为 Mini-Boss，第 4 个起为大 Boss

### 4.2 Boss 生成流程
1. `phase_finalizeRound` 在 `round++` 之前检测下一回合是否为 Boss 回合（与 `_nextBossRound` 匹配）
2. 若是 Boss 回合，将生成信息存入 `this._pendingBossSpawn`
3. `round++` 执行后，检查 `_pendingBossSpawn` 并调用 `spawn_spawnBoss`
4. Boss 生成后记录 `_lastBossSpawnRound`（生成回合）和 `_bossSpawnCount`（已生成数量）
5. Boss 回合不生成普通敌人行
6. **选择性清场**：`spawn_spawnBoss` 出场时，仅移除与 Boss 最终落点区域（AABB）发生重叠的敌人，保留其余敌人。这确保了玩家前期战斗对场面的影响（如冻结、血量耗损）仍有意义。Boss 占据区域：水平中心为 `centerX`，宽 `bossW = enemyWidth * 3`，高 `bossH = enemyHeight * 2`，垂直中心为 `spawnY`。

**Boss 调度相关状态变量**：
| 变量名 | 说明 | 初始化位置 |
|---|---|---|
| `_nextBossRound` | 下一个 Boss 预定出现的回合数 | `sys_resetGame` 中置 null，首次调用 `spawn_checkBossRoundFor` 时自动初始化 |
| `_lastBossSpawnRound` | 上一个 Boss 生成时的回合数 | `sys_resetGame` 中置 null，在 Boss 生成后由 `game_phase.js` 设置 |
| `_bossSpawnCount` | 本局已生成的 Boss 数量 | `sys_resetGame` 中置 0，在 Boss 生成后由 `game_phase.js` 自增 |

### 4.2.1 Boss 出场演出时机（重要）

**问题背景**：原来 `spawn_spawnBoss()` 在生成 Boss 时立即发射 `boss:spawned` 事件并设置 `entranceTimer = 90`，导致全部演出在研磨阶段就播放完毕，进入战斗阶段时完全看不到任何演出。

**修复方案**：引入 `_pendingEntrance` 标志位，将演出触发时机延迟到进入战斗阶段时。

**实现细节**：
- `spawn_spawnBoss()`：设置 `boss.entranceTimer = 0`，`boss._pendingEntrance = true`，不发射事件和 showToast
- `entities/enemy.js` `update()`：当 `_pendingEntrance === true` 时，将 Boss 保持在 `_entranceStartY`（屏幕外）不移动
- `phase_startCombatPhase()`：检测到 `_pendingEntrance` 后，设置 `entranceTimer = 90`、清除标志、延迟 100ms 发射 `boss:spawned` 事件和 showToast
- `phase_combat_update()` 中活跃敌人计数：将 `_pendingEntrance` 状态的 Boss 也计入活跃敌人，防止误判完美清场

### 4.3 Boss 阶段变化
- **狂暴阶段**: Boss HP < 50% 时自动触发，通过 `combat_triggerBossEnrage` 处理
- 狂暴状态存储在 `boss.berserked` 属性中，防止重复触发
- 狂暴触发后通过 EventBus 广播 `boss:phase_change` 事件
- **破绽暴露停摆**: 当 Boss 存在 `_bossVulnerabilityExposedTurns > 0` 时，敌人回合仍会进入 `startTurnAction()` 以消费 1 个暴露回合，但必须跳过 Boss 物理状态机、预警、特殊行动、移动和 Ouroboros 轮转；`_willMoveThisTurn` 预计算应为 `false`，避免 UI 误报本回合移动。

### 4.4 Boss 事件类型
| 事件名 | 触发时机 | 数据字段 |
|---|---|---|
| `boss:spawned` | Boss 生成时 | `boss`, `bossId`, `bossName`, `isBigBoss`, `round` |
| `boss:phase_change` | Boss 狂暴时 | `boss`, `bossId`, `bossName`, `phase`, `round` |
| `boss:defeated` | Boss 被击杀时 | `boss`, `bossId`, `bossName`, `round` |
| `boss:rotation` | 奥罗波罗斯词缀轮转时 | `boss`, `newAffixes`, `rotationIndex` |

### 4.5 8 个 Boss 特性摘要
| Boss ID | 名称 | 类型 | 核心特性 |
|---|---|---|---|
| `ignis` | 烈焰之心 | Mini-Boss | 护盾+狂暴，狂暴后护盾翻倍，每回合温度急剧上升并对周围敌人造成火焰溅射伤害 |
| `glacies` | 冰封山峡 | Mini-Boss | 跳跃+再生，回合 tick / 跳跃落地在战斗场内制造霜缝；霜缝缝住专属随从或周围敌人，提供短暂减伤、回血与护盾，cryo / pierce 可反制；不再影响 Peg |
| `mikro` | 细胞山峡 | Mini-Boss | 分裂+极速，狂暴后分裂概率 100% |
| `devourer` | 噬神者 | Mini-Boss | 深渊胃域拉拽并召唤 `maw_thrall`，吞噬胃域内敌人转化为护盾；狂暴后全屏候选 |
| `viridis` | 绿色山峡 | 大 Boss | 孢子活甲网络，治疗与专属侍体累积孢甲资源；狂暴后集中自疗并强化孢甲循环 |
| `tesla` | 特斯拉山峡 | 大 Boss | 导体网络场强：每回合电击并转化导体，场强提升行动与召唤压力，cryo / bounce 可反制 |
| `chimera` | 奇美拉 | 大 Boss | 每回合先吞噬两个目标，左侧倾向低温、右侧倾向高温；吞噬结算后召唤 2-3 名不带 `berserk` 的热核养料，左侧低温、右侧高温；温度按绝对值一比一转热核/冰核，冷热抵消时 100% 生成流彩护盾，狂暴后护盾量翻倍 |
| `ouroboros` | 奥罗波罗斯 | 大 Boss | 六附体每回合轮转，当前附体决定词缀、主机制和动态破绽谱 |

## 6. Boss 遗物与 round-start 延迟奖励处理

**当前设计**：Boss 击杀后仍只掉落符文；固定回合遗物事件已移除。非 Boss 敌人可以在死亡时登记 `relic`、`chaos_essence` 或 `pure_essence` 到 `pendingRoundStartRewards`，并在下一回合开始由 `sys_startRoundStartResolver()` 统一结算。

- 当 `pendingRoundStartRewards` 同时存在多个奖励时，resolver 必须显示“回合奖励 X/Y：奖励类型”的进度提示；单个奖励保持原有类型提示即可，避免 Toast 噪声。
- 奖励队列清空后，局内商人只能作为右上角状态入口出现；`sys_maybeOfferRunShopBeforeRoundStart()` 不得打开 overlay 或打断横幅。调度状态由 `runShopNextOfferRound`、`runShopActiveUntilRound`、`runShopLastArrivalRound`、`runShopScheduleStartRound`、`runShopScheduleGap` 共同描述；首访第 3 回合固定生成免费 `starter_boost` 占位援助包（护盾/碎片即时发放，基础伤害按 `runShopStarterBoostDamageRounds` 临时衰减），后续商人按 3..当前回合数随机等待并停留 2 回合。放弃遗物进入商店时仍必须先发放 `runShopSkipRelicBonus`。
- `phase_finalizeRound()` 不再计算 `isRelicRound`，只负责存档并启动 round-start resolver。
- `sys_initGameStart()` 的首个遗物也通过 `pendingRoundStartRewards` 进入统一流程，不再直接调用 `ui_showRelicSelection()`。
- `ui_closeRelicSelection()` 在 `resumeTarget === 'round_start_resolver'` 时必须回到 `sys_continueRoundStartResolver()`，而不是默认进入 `selection`/`gathering`。
- 若遗物 overlay 是从 `selection` 阶段中途打开，则关闭时必须按 `relicOverlayReturnState` 恢复原有命运抉择界面，并执行 `ui_refreshSelectionModeUI()`，禁止重新跑 `sys_initSelectionPhase()` 覆盖特殊选择态。
- 命运时刻一旦由 resolver 触发，就应写入 `fateMomentContext`，并与 `selectionPreviewState` / `relicOverlayReturnState` 一起进入存档；只有当玩家确认选择并进入研磨阶段后，才允许清空这些上下文字段。
- `_pendingBossRelic` 和 `_pendingRelicEvent` 仅作为旧存档兼容字段保留；加载旧存档时应迁移为 `pendingRoundStartRewards` 中的 `relic` 条目。

## 7. 清屏奖励规则 (Full-Clear Bonus)

**规则描述**：若玩家在上一回合战斗阶段结束时完成了全场清屏（`activeEnemies.length === 0`），则本回合普通敌人行生成数量至少为 3 行。

**实现机制**：
- **标志位**：`this._prevRoundCleared`（布尔型）
  - 在 `phase_finalizeRound` 结尾将 `clearedThisRound` 写入该标志位。
  - 在 `sys_resetGame` 中初始化为 `false`。
- **应用时机**：在 `phase_finalizeRound` 的普通敌人行生成逻辑中，若 `this._prevRoundCleared === true` 且当前计算得到的 `spawnCount < 3`，则强制将 `spawnCount` 提升至 3。
- **反馈要求**：触发该规则时必须给出“清屏反扑”提示，避免玩家误以为清屏成功后被无提示惩罚。
- **与 Boss 回合的关系**：该规则仅在普通回合（非 Boss 回合）下生效，Boss 回合不生成普通敌人行，不受此规则影响。

## 7.1 命运时刻相关回合衰减约束
- `phase_finalizeRound()` 结束时除了旧的 `assimilationBoostRounds` 外，还必须同步递减 `doubleAssimilationBoostRounds`。
- 只要任一同化增益字段对某个 `marbleType` 仍大于 0，该类型在下一轮实体同化判定中都应被视为处于 `x2` 模式。
- 纯净精华不是持续 Buff；`pendingSelectionMode` 在 `sys_initSelectionPhase()` 被消费后应立即清空，避免多回合串味。
- 纯净精华确认后必须把 `doubleAssimilationBoostRounds[marble.type]` 至少写为 `1`（仅覆盖当前命运时刻产出的这次研磨会话；若已有更高层数则保留更高值），并由 `phase_finalizeRound()` 在回合结束时统一递减，禁止只改 UI 文案而不落实际倍率。

## 8. 难度平衡系统 (Difficulty Balance System)
### 8.1 战后高压因子 (Post-Boss Surge)
- **触发时机**: 击杀 Boss 时（监听 `boss:defeated` 事件）
- **机制**: 
  - Boss 击杀后，激活战后高压因子 `postBossMultiplier = 1.3`，持续 `postBossSurgeRoundsLeft = 3` 回合。
  - 在高压期间，普通敌人的基础血量 `finalBaseHP` 会乘以 `postBossMultiplier`。
  - 在高压期间，双词缀精英怪的生成概率临时提升 25%。
- **反馈要求**: Boss 击杀时必须提示“Boss 余波 / 高压反扑”，让玩家明确接下来 3 回合的压力来自战后事件。
- **衰减逻辑**: 
  - 在 `phase_finalizeRound` 中，每回合结束时 `postBossSurgeRoundsLeft` 减 1。
  - `postBossMultiplier` 每次减 0.1，直到恢复至 1.0。

### 8.2 Boss 底线怜悯掉落 (Pity Drop)
- **触发时机**: 敌人在没有防线屏障保护时越过失败线（`input_checkDefeat` 检测到越线）
- **防线屏障前置规则**:
  - `playerShield > 0` 时，守护者结界不是越线后抵消失败，而是在失败线前形成能量屏障。
  - 敌人移动到屏障前的当回合只会被拦停；下一次移动尝试会撞击屏障并消耗 `占格数 × 词缀倍率` 层 `playerShield`，本次不再移动。
  - `siegeBreaker`（撞城者）会让屏障伤害再乘以 `CONFIG.balance.affixes.siegeBreakerDamageMult`；非 1×1 大型敌人默认按 `gridCols × gridRows` 计算防线伤害。
  - `input_checkDefeat` 只负责兜底把越线敌人夹回屏障位置，不得扣盾或删除敌人。
- **怜悯掉落机制**:
  - 如果越线的敌人是 Boss（`e.type === 'boss'`），触发 `_triggerPityDrop` 怜悯掉落。
  - 系统分析玩家近期的伤害历史，找出主属性（占比最高的属性）。
  - 将该主属性作为 `themeWeights` 注入 `loot_calcRuneDrop`。
  - 调用 `loot_calcRuneDrop` 生成一个同主题 1 级符文，掉落在 Boss 越线位置。
  - 触发 UI 提示："💔 怜悯掉落：获得主属性符文"。

### 8.3 掉落权重边际递减 (Marginal Decay)
- **触发时机**: 计算符文掉落权重时（`loot_system.js` 中的 `_calcBuildVector`）

## 2026-06-23 技能充能阶段契约

- 进入战斗阶段时，`phase_startCombat()` 调用 `combat_skillCharge_init()` 初始化技能充能状态与顶部 HUD。
- 战斗 / 训练阶段的逐帧更新调用 `combat_skillCharge_decay(timeScale)`，只衰减临时条；实际条保留到满条或战斗重置。
- 敌人动作后的 `phase_claimPendingRunes()` 只负责场地掉落符文入库与飞行动画，不再检查或领取 `runeChargeCurrentRune`。
- 旧 `combat_runeCharge_*` 方法仅作为兼容代理存在；新增阶段逻辑必须使用 `combat_skillCharge_*`。
- **机制**: 
  - 统计玩家近期伤害占比 `buildVector` 时，如果某一属性的伤害占比超过阈值（默认 60%），则对超出部分进行衰减。
  - 衰减系数为 0.5，即超出部分减半。
  - 衰减后重新归一化 `buildVector`，防止玩家过度依赖单一属性导致掉落过于单一。
## 2026-06-21 Simultaneous Marble Charge

- Gathering now launches the selected marble queue as one charge batch instead of one marble per click.
- `phase_gathering_createSession()` creates one independent session per marble. The compatibility field `currentSession` may point to the first session, but gameplay settlement must read `gatheringSessions`.
- `phase_gathering_attemptComplete()` waits until all drop balls, energy orbs, side wheels, and session `activeBalls` are finished, then compiles each session into one ammo recipe.
- Result handling inside `phase_gathering_update()` must use `ball.session` for collected stats, multicast, split clones, mirror clones, and rainbow shards.
- Normal gathering sessions must initialize `session.multicast` from `marbleDef.multicast`; otherwise the second round silently drops stored multicast layers and every bullet fires only once. Essence charged ammo may still reset multicast/finalHits by design.
- Peg-hit energy feedback must carry the triggering marble `session` into `spawn_createHitFeedback()`. Energy-orb arrival and level-up callbacks may only fall back to `currentSession` for legacy single-marble flows.
- When several sessions level up in one simultaneous batch, `persistentThreshold` must be written back as the max observed session threshold so late-arriving orbs cannot roll the global threshold backward.
- Do not add new sequential-click dependencies to gathering. One player click should produce the final bullet list for the current charge batch.

## 2026-06-21 Combat Aim Guide Scatter Parity

- `buildCombatAimGuides()` must not treat `recipe.scatter` as the direct number of preview branches.
- The scatter preview must mirror `spawn_spawnBullet()` branch semantics: `floor(scatterCount / 2) + (scatterCount % 2)`, with non-laser scatter resonance adding `extraScatterShots` and applying `scatterAngleReduction`.
- The main guide remains separate from scatter guides; wind recipes stay single-shot in the preview.

## 2026-06-21 Combat Arena Bounds

- Combat uses an inset arena inside the canvas because the left and right side bands are decorative.
- `sys_resize()` derives `combatGridLeftX`, `combatGridRightX`, `combatGridWidth`, and `enemyWidth` from `CONFIG.gameplay.combatSideInsetRatio`, `combatSideInsetMin`, and `combatSideInsetMax`.
- Use `sys_getCombatBounds()` for left/right wall positions and `sys_getCombatColumnCenterX(col, spanCols)` for enemy column centers.
- Visible walls, projectile wall bounce, laser wall reflection, enemy movement bounds, Boss center, and row/preset spawning must share these bounds.
- Do not use `0` or `this.width` as combat side walls unless the code is explicitly drawing decorative side bands.
