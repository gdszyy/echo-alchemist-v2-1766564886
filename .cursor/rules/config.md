---
description: "全局配置结构、数据字典格式与修改规范"
globs: ["src/config.js"]
---
# 配置模块规范 (Config System)

## 1. 配置结构
`src/config.js` 集中管理游戏的所有常量和静态数据字典，主要包含：
- **系统配置**: 屏幕尺寸、帧率、物理引擎参数等。
- **UI 配置**: 颜色主题、字体大小、层级 (z-index) 定义。
- **游戏数值**: 基础採落率、难度系数、经济系统数值。
- **`CONFIG.performance`**: 自适应性能系统的三档特效预算表（`high`/`medium`/`low`）及 FPS 采样参数。**修改此节前必读 [`.cursor/rules/performance.md`](performance.md)。**

## 2. 数据字典格式
- **`ELEMENT_CONFIG`**: 定义弹珠/钉子的元素属性（如物理、火焰、冰霜等）及其对应的颜色、基础伤害倍率和特殊效果。
- **`RELIC_DB`**: 遗物数据库，定义遗物的 ID、名称、描述、稀有度和具体效果逻辑。
- **`SKILL_DB`**: 技能数据库，定义玩家的技能效果和触发条件。现已改为由符文组合（`unlockRuneword`）解锁派生。

## 3. 修改规范
- **集中管理**: 严禁在业务逻辑中硬编码魔法数字（Magic Numbers）或颜色値，必须提取到 `config.js`。
- **格式一致性**: 添加新数据字典条目时，必须严格遵循现有对象的键名 and 数据类型结构。
- **注释说明**: 修改核心数値或添加新配置项时，必须添加注释说明其用途和影响范围。

## 6. Boss 血量公式参数说明（bossHpFormula）

`CONFIG.balance.bossHpFormula` 控制 Boss 血量的混合计算公式。实际计算在 `src/spawn_system.js` 的 `spawn_calculateBossHP` 方法中执行。

| 参数 | 类型 | 默认値 | 说明 |
| :--- | :--- | :--- | :--- |
| `templateWeight` | number | 0.5 | 模板血量权重（后期稳定値） |
| `dynamicWeight` | number | 0.5 | 动态血量权重（后期稳定値） |
| `floorMultiplier` | number | 0.7 | 保底倍率（后期稳定値） |
| `earlyRound` | number | 5 | 前期保护完全生效的最大回合数（第一个 Boss 回合） |
| `lateRound` | number | 20 | 过渡结束回合，完全切换为后期稳定权重 |
| `earlyDynamicWeight` | number | 0.85 | 前期动态权重（高度依赖玩家实时伤害） |
| `earlyFloorMultiplier` | number | 0.45 | 前期保底倍率（降低保底，避免卡死新手） |

**前期保护机制原理**：
- 在 `[earlyRound, lateRound]` 区间内，`dynamicWeight` 和 `floorMultiplier` 均进行线性插展。
- `round <= earlyRound`：`dynamicWeight = earlyDynamicWeight`（前期小 Boss 血量高度跨随玩家实时战力）。
- `round >= lateRound`：`dynamicWeight = dynamicWeight`（后期平衡权重）。
- 模板权重 = `1 - dynamicWeight`，两者互补且总和始终为 1。
- 前期低保底将保底下限 from 70% 降至 45%，使血量更自由地跨随玩家战力浮动。

## 4. RELIC_DB 钉盘形态遗物规范（异型布局版）

钉盘形态遗物通过修改 `Game` 实例上的 `boardLayout` 字段来切换钉盘布局模式。该字段在 `core.js` 中初始化，在 `game_system.js` 的 `sys_resetGame` 中重置。**所有钉盘形态遗物只能获取一次（maxStacks: 1）**。

| 字段 | 类型 | 默认值 | 用途 |
| :--- | :--- | :--- | :--- |
| `boardLayout` | string | `'default'` | 异型布局枚举，可选値见下表 |

**布局枚举列表**：

| `boardLayout` 値 | 遗物 ID | 布局逻辑 | 策略定位 | 与行数遗物联合效果 |
| :--- | :--- | :--- | :--- | :--- |
| `'default'` | （默认） | 标准交错矩形 | 通用 | 行数多=更多行的标准钉盘 |
| `'triangle'` | `triangle_formation` | 顶行最宽，每行递减 1 列 | 漏斗流 | 行越多三角越尖，弹珠越集中于底部中央 |
| `'diamond'` | `diamond_formation` | 前半段扩展，后半段收缩 | 中段爆发流 | 行越多菱形越饱满，中段宽度越大 |
| `'sparse'` | `sparse_interval` | 偶数行正常，奇数行减 4 列居中 | 通道流 | 行越多通道节奏越强 |
| `'mirror_sync'` | `mirror_sync` | 列数减 2，对齐排列；钉子同步；特殊槽镜像 | 镜像同步流 | 行越多直线通道越长，镜像效果越强 |
| `'wide_narrow'` | `wide_narrow` | 偶数行 +2 列，奇数行 -2 列 | 边缘捕获流 | 行越多宽窄层次越丰富 |

**实现警告**：
- 异型布局不修改 `spacingX`/`spacingY`，仅通过逐行控制列数和水平偏移实现形状变化。严禁在遗物效果中修改间距値，否则弹珠会卡在钉子之间。
- `boardLayout` 是互斥枚举，同时只能激活一种布局。玩家获得第二个钉盘形态遗物时，新布局会覆盖旧布局。
- 各布局均保留标准交错偏移（`isOddRow` 逻辑），除非该布局明确需要对齐排列（`mirror_sync`）。
- **单局互斥限制**：`dimension_shard`（行数遗物）与所有布局形态遗物共同构成 `BOARD_STRUCTURE_RELICS` 集合（定义于 `config.js`）。`shop.js` 的 `ui_showRelicSelection` 在过滤遗物池时，若玩家本局已拥有任意一个钉盘结构遗物，则将所有其他钉盘结构遗物从候选池中排除。此外 `dimension_shard` 的 `maxStacks` 已从 `3` 改为 `1`。

## 5. probabilities 初始权重设计规范

`CONFIG.probabilities` 定义了收集阶段钉板刷新时各属性钉子的基础权重，并在每局开始时被复制到 `this.unlockedWeights`。

- **设计原则**：
- **所有弹珠默认进池**：`white` 权重最高，`bounce`、`damage`、`cryo`、`pyro` 等常规弹珠默认可出现，`rainbow`、`matryoshka` 等特殊弹珠使用低权重控制稀有度。
- **遗物权重机制**：玩家选择弹珠倾向遗物时，`shop.js` 中的 `ui_selectRelic` 会提高对应 `this.unlockedWeights[key]`，并立即提供一包对应倾向胚珠；遗物不再负责“解锁弹珠”或触发精华。
- **商人弹珠包定价**：`run_shop.js` 根据 `CONFIG.probabilities` 的归一化期望价值动态计算弹珠包价格。去纯净包、固定低概率弹珠包等必须重新计算概率分布，不允许手填固定价格绕过期望价值。当前调参使用低基准价与低稀有幂，常规包应落在可通过数回合局内碎片购买的区间。
- **闪电属性特殊性**：自 2026-04-14 起，**闪电（lightning）属性不再拥有对应的钉子**，也不再通过遗物直接解锁其生成权重。闪电属性仅能通过收集阶段中【冰霜】与【火焰】属性的抗消（合成）产生。
- **奖励专属属性特殊性**：自 2026-06-21 起，`explosive` / `laser` / `overcharge` 均为底部奖励区专属属性，不进入普通弹珠候选池；相关遗物只能提高底部奖励区权重，不直接发放对应弹珠包。
- **修改警告**：`allPegTypes` / `RANDOMIZABLE_PEG_TYPES` 是钉板初始化随机刷新池，只允许 `bounce` 与 `damage` 两种纯净弹珠属性。严禁在其中加入 `lightning`、`laser`、`overcharge`、`wind` 或其它元素/变异属性；这些属性只能作为弹珠本身、符文融合、奖励区或其它显式来源进入收集结果。调整 `white` 权重会直接影响杂色包价格和玩家获得纯净弹珠的体感，必须同步检查商店包价格。
## 7. Boss 配置参数说明 (bossConfigs)

`CONFIG.balance.bossConfigs` 控制各个特殊 Boss 的专有参数和机制系数。

Boss 对抗属性不再使用旧 `weakness` 字段。每个 Boss 使用 `vulnerability` 描述“破绽谱”：

| 字段 | 类型 | 说明 |
| :--- | :--- | :--- |
| `vulnerability.attrs` | string[] | 固定 Boss 的破绽谱属性。命中这些属性会累积破绽进度。 |
| `vulnerability.label` | string | 破绽满格时的浮字标签。 |
| `vulnerability.mode` | `'hits' \| 'damage'` | 累积方式：按实际造成伤害次数，或按实际伤害量。 |
| `vulnerability.hitThreshold` | number | `hits` 模式基础命中次数阈值。 |
| `vulnerability.damageRatio` | number | `damage` 模式基础伤害阈值，占 Boss 最大生命百分比。 |
| `vulnerability.dynamic` | boolean | `ouroboros` 专用；为 true 时按轮转组读取动态破绽谱。 |
| `vulnerability.rotationAttrs` | string[][] | `ouroboros` 每个轮转组对应的破绽谱属性。 |
| `vulnerability.labels` | string[] | `ouroboros` 每个轮转组的破绽标签。 |
| `vulnerability.rotationModes` | string[] | `ouroboros` 每个轮转组对应的累积方式。 |
| `vulnerability.rotationHitThresholds` | Array<number\|null> | `ouroboros` 命中次数阈值组。 |
| `vulnerability.rotationDamageRatios` | Array<number\|null> | `ouroboros` 伤害比例阈值组。 |

`CONFIG.balance.bossVulnerability` 控制全局 Boss 破绽机制：

| 字段 | 默认值 | 说明 |
| :--- | :--- | :--- |
| `breakThreshold` | `3` | 破绽进度满格阈值。 |
| `baseDamageRatio` | `0.10` | 未显式配置 `damageRatio` 时的基础伤害比例。 |
| `exposedHits` | `3` | 破绽触发后持续的易伤命中次数。 |
| `exposedDamageMult` | `1.35` | 易伤窗口内的伤害倍率。 |
| `counterHitGain` | `1` | 命中破绽谱属性时增加的进度。 |
| `offPatternGain` | `0` | 未命中破绽谱属性时的进度变化；当前不惩罚。 |
| `roundScalingStart` | `5` | 从该回合后开始提高破绽条件。 |
| `roundScalingStep` | `10` | 每隔多少回合提升一次条件。 |
| `hitThresholdRoundBonus` | `1` | 每个缩放步给 `hits` 模式增加的命中次数。 |
| `damageRatioRoundBonus` | `0.015` | 每个缩放步给 `damage` 模式增加的最大生命百分比。 |
| `maxRoundScaleSteps` | `6` | 回合缩放最大步数，避免后期无限膨胀。 |
| `enrageDelayOnBreak` | `true` | 破绽触发后，若 Boss 尚未狂暴，则延后一次 50% 血量狂暴检测。 |

**Mikro (裂变母体·米克罗) 专有参数**:
- `cloneChanceHitBonus`: 额外受击分身概率 (默认 0.3)
- `berserkedCloneChance`: 狂暴后分身概率 (默认 1.0)
- `cloneDamageReductionPerClone`: 每个存活分身提供的减伤比例 (默认 0.10)
- `cloneDamageReductionMax`: 分身减伤上限 (默认 0.50)

## 8. 参数调整记录

| 日期 | 文件 | 修改内容 |
|------|------|----------|
| 2026-06-22 | `src/config.js`, `src/game_system.js`, `.cursor/rules/config.md`, `.cursor/rules/game_phase.md` | **弹珠包价格与新研磨替换选择**：下调 `runShopMarblePackBasePrice`、`runShopMarblePackMarkup`、`runShopMarblePackRarityPower`，使局内商人弹珠包从百级碎片价格降到数十级；标准 `marble_pack` 若在已有子弹时触发新研磨，会预充既有子弹并在研磨完成后进入子弹选择。 |
| 2026-06-22 | `src/config.js`, `src/entities/projectile.js`, `docs/relic_system_design.md` | **力场护盾墙体语义修正**：`energy_shield` 文案与实现统一为“每次墙体接触最多消耗 1 层现有反弹/穿透耐久；耐久耗尽后按普通墙体反弹，不销毁子弹”。该改动修复无耐久子弹贴墙后被墙体吞没的问题，并避免角落同帧碰撞连续扣多层；不新增配置项、粒子、Canvas 光效或性能预算消费。 |
| 2026-06-21 | `src/config.js`, `src/ui/run_shop.js`, `src/ui/shop.js`, `src/game_system.js`, `src/game_phase.js`, `src/ui_system.js`, `src/ui/hud.js`, `index.html`, `.cursor/rules/config.md`, `.cursor/rules/game_phase.md`, `.cursor/rules/ui_system.md` | **弹珠包主循环第一批落地**：取消新精华投放，敌人奖励只登记遗物线索；所有弹珠默认进入基础概率池，遗物改为提高对应弹珠权重并立即提供倾向胚珠包；局内商人新增杂色包、去纯包、倾向包和固定穿透包，价格按概率期望动态计算；三发/三弹珠上限固定为晶石核心 3 充能位；商人状态条移至右上角小胶囊；符文获取增加中央揭示动画。 |
| 2026-06-20 | `src/config.js`, `src/game_system.js`, `src/game_phase.js`, `src/ui/run_shop.js`, `src/ui_system.js`, `src/core.js`, `index.html`, `.cursor/rules/config.md`, `.cursor/rules/game_phase.md`, `.cursor/rules/ui_system.md` | **局内商人随机到访调度**：`CONFIG.gameplay` 新增 `runShopFirstOfferRound`、`runShopRandomWaitMin`、`runShopVisitDurationRounds`、`runShopStarterBoostShield`、`runShopStarterBoostFlatDamage`、`runShopStarterBoostDamageRounds`、`runShopStarterBoostFragments`；首访固定第 3 回合且提供免费 `starter_boost` 占位援助包，后续商人按 3..当前回合数随机等待并停留 2 回合，底部 UI 显示到访/离开倒计时。 |
| 2026-06-21 | `src/config.js`, `src/game_phase.js`, `src/entities.js`, `src/calc_utils.js`, `src/ui/shop.js` | **底部奖励分栏收窄与超载接入**：底部奖励区可同时出现 1..3 个，中心入口按两侧实体碰撞板收窄判定；`bottomRewardOnlyTypes` 固定为 `explosive` / `laser` / `overcharge`，三者不进入普通弹珠候选池，遗物只提高奖励区权重。 |
| 2026-06-19 | `src/config.js`, `src/spawn_system.js`, `src/ui/shop.js`, `src/game_phase.js`, `src/entities.js`, `src/calc_utils.js` | **底部奖励分栏与奖励专属属性**：`moduleDefaultSlots` / `moduleInitialSlots` 回调为首行 5 个初始钉板；`CONFIG.gameplay` 新增 `bottomRewardZoneChance`、`bottomRewardZoneWidthMultiplier`、`bottomRewardOnlyTypes`、`bottomRewardZoneWeights` 等底部分栏参数。`explosive` / `laser` 从命运弹珠候选与保底队列中过滤，不再作为普通弹珠出现；对应遗物只校准底部奖励分栏并触发混沌精华。 |
| 2026-06-19 | `src/config.js`, `src/ui/shop.js`, `src/ui_system.js`, `src/game_system.js`, `src/core.js`, `.cursor/rules/config.md`, `.cursor/rules/ui_system.md` | **新增选择刷新遗物**：`fate_reroll_token` 提供每次命运抉择 1 次弹珠候选刷新；`relic_reroll_seal` 提供每次遗物选择 1 次遗物候选刷新。两者为选择 UI 被动遗物，不新增粒子、Canvas 光效或性能预算消费；刷新使用状态进入局内存档，避免刷新页面重复使用。 |
| 2026-06-19 | `src/config.js`, `src/combat_system.js`, `src/spawn_system.js`, `src/entities/enemy.js`, `src/game_system.js`, `src/systems.js`, `.cursor/rules/config.md`, `.cursor/rules/enemy_index.md`, `.cursor/rules/spawn_system.md` | **Boss 破绽机制与旧弱点移除**：删除普通波次 `weak_spot` 低血量弱点怪；Boss 配置从 `weakness` 改为 `vulnerability` 破绽谱；不同 Boss 可按实际命中次数或实际伤害量累积破绽，回合越高阈值越苛刻；满格后触发短暂易伤窗口并延后一次狂暴检测。破绽进度与易伤命中数进入局内存档，Boss 状态短标签显示 `隙` / `破`。 |
| 2026-06-19 | `src/pinboard_modules.js`, `docs/pinboard_component_design_v2.md`, `.cursor/rules/performance.md` | **默认钉盘回归纯交错钉板**：默认 `2x5` 前两行全部使用 `dense_stagger`，不再放入 `starter_*`、转盘、弹力角或异形默认模块。`dense_stagger` 提升为安全上限内的 2x6 交错生成，当前默认盘审计为 120 圆钉 / 0 barrier / 0 SpecialSlot，最小圆钉中心距约 `29.49px`，高于当前倍化弹珠阈值 `23.8px`。旧多异形默认盘、临时 `caret_wheel_field` 超大默认盘与 `starter_*` 默认盘会精确迁移回新版纯交错默认盘。 |
| 2026-06-19 | `src/config.js`, `src/pinboard_modules.js`, `src/entities.js`, `src/game_system.js`, `docs/pinboard_component_design_v2.md`, `.cursor/rules/performance.md` | **初始钉盘 2x5 铺满与异形机关化**：`moduleDefaultSlots` 调整为 10，`moduleInitialSlots` 改为前两行 `[0..9]`，`moduleSpacingX/Y` 调整为 `0`，默认盘面由首发异形组件铺满；新增 `split_lattice_bridge`、`split_gate_light`、`multicast_gate_light`、`recall_loop_light`、`wheel_cup_light`，并新增 `shape='barrier'` 异形 Peg 用于真实挡板/杯口/导流翼。圆钉间距按倍化弹珠半径强制大于约 `23.8px`，默认盘审计为约 75 圆钉 + 10 barrier / 5 SpecialSlot。旧存档若低于当前默认槽数会自动抬到新版 `2x5`，空活动槽会补默认组件。 |
| 2026-06-19 | `src/config.js`, `src/game_system.js`, `src/ui/run_shop.js`, `src/ui/shop.js`, `src/ui_system.js`, `.cursor/rules/game_phase.md`, `.cursor/rules/ui_system.md` | **局内商店接入 round-start resolver**：新增 `runShopOfferAfterBoss`、`runShopMinFragmentsToOffer`、`runShopSkipRelicBonus` 参数；商店改为奖励队列清空后的可选构筑调整节点，跳过遗物会先补偿局内碎片；`runFragments`、货架和刷新次数进入局内存档；`debugOnly` 局外商品默认隐藏并在购买逻辑中二次校验。 |
| 2026-06-19 | `src/pinboard_modules.js`, `src/ui/run_shop.js`, `src/ui_system.js`, `.cursor/rules/game_phase.md`, `.cursor/rules/performance.md` | **商店异形钉盘组件池扩展**：新增 `split_yoke_module`、`hourglass_gate_module`、`crescent_bank_module`、`spiral_return_module`、`prism_splitter_module`、`twin_wheel_bridge_module` 六个路线型商店组件，并为组件增加 `shape` 路线元数据。局内商店与模块安装弹层会展示占位、入口、出口和稀有度摘要，便于玩家理解组件身份。 |
| 2026-06-19 | `src/config.js`, `src/pinboard_modules.js`, `src/game_phase.js`, `src/ui_system.js`, `.cursor/rules/game_phase.md`, `.cursor/rules/performance.md` | **钉盘居中 3+3 初始布局**：`moduleCols` 调整为 5，`moduleDefaultSlots` 调整为 6，并新增 `moduleInitialSlots` / `moduleUnlockOrder`；默认盘面改为两行居中的 `guide_fin_left`、`rune_lattice_light`、`guide_fin_right`、`bounce_chamber`、`crucible_seed`、`catcher_cup` 六个异形组件。构建与编辑器放置校验统一读取 active slot set，不再假设前 N 个 row-major 槽已解锁。 |
| 2026-06-19 | `src/config.js`, `src/ui_system.js`, `src/ui/shop.js`, `src/game_system.js`, `src/core.js`, `.cursor/rules/config.md` | **新增测试用局外购买项**：`debug_pick_any_relic` 归入局外商店「测试工具」分类，价格为 0；购买后打开全遗物池选择界面，将所选遗物写入 `saveData.debugStartRelicId`，新开局时再复用 `ui_selectRelic(..., { skipClose: true })` 的既有效果链路发放，避免被 `sys_resetGame()` 清空。 |
| 2026-06-22 | `src/config.js`, `src/ui/shop.js`, `src/ui_system.js` | **测试工具默认显示**：新增/启用 `CONFIG.debugShopDefaultEnabled`，让局外商店「测试工具」分类默认可见；需要临时关闭时使用 `localStorage.echo_debug_shop = '0'`。 |
| 2026-06-19 | `src/pinboard_modules.js`, `src/ui_system.js`, `src/ui/run_shop.js`, `src/ui/shop.js`, `src/core.js`, `src/game_system.js`, `src/config.js`, `.cursor/rules/game_phase.md`, `.cursor/rules/ui_system.md` | **钉盘组件库存化**：新增 `ownedModuleComponents` 作为可拆装组件库存；局内商店获得的是单个组件实例，编辑器安装时按 `uid` 从库存移除、拆卸时放回库存；`unlockedModuleTypes` 降级为旧存档兼容字段，不再作为无限模板替换来源。 |
| 2026-06-19 | `src/config.js`, `src/game_system.js`, `src/entities.js` | **钉盘倾斜体感调参**：`CONFIG.physics` 新增 `tiltSmoothing`、`tiltDragSensitivity`、`tiltHoverInfluence`、`tiltGripRadius`、`tiltGravityScale`、`tiltVerticalGravityScale`、`tiltDeadzone`、`tiltBoostPeak`、`tiltBoostDecay`；手动手柄可在陀螺仪开启时临时接管倾斜，DropBall 横向/纵向倾斜受力改为配置化并带死区。 |
| 2026-06-18 | `src/config.js`, `src/pinboard_modules.js`, `src/game_phase.js`, `src/core.js`, `src/game_system.js`, `src/ui_system.js`, `.cursor/rules/game_phase.md`, `.cursor/rules/rune_system.md` | **钉盘组件实例化与融合持久化**：`CONFIG.gameplay.moduleDefaultSlots` 调整为 3；`currentModuleLayout` 升级为组件实例 `{ id, uid, pegStates, pluginStates }`，符文融合写回组件 `pegStates`，局内存档同步保存模块布局与待注入队列。 |
| 2026-06-18 | `src/config.js`, `src/combat_system.js`, `src/bitmap_icons.js`, `.cursor/rules/config.md`, `docs/ui_asset_requirements.md` | **新增/改造 5 个战斗构筑遗物**：`rune_siphon` 命中/击杀额外推进符文充能；`ammo_bandolier` 复用 `bullet_cap_up`，命运抉择可保留弹珠 +1，改为传说且不可叠加，并让每回合首发子弹伤害 -15% 约束强度；`opening_salvo` 每回合首发子弹伤害 +25%，且可连射弹种额外连射 +2；`thunder_coil` 取代旧 `thermal_prism`，发射时将连射层数转化为闪电链保底次数，前 X 次闪电弹射概率变为 100%，并清空连射，不增加闪电层数；`ember_fuse` 将原默认火焰过热爆炸拆为遗物效果。新遗物不新增常驻粒子或 Canvas 光效，运行期分别由 `ui_selectRelic` 通用分支、`combat_fireNextShot`、`combat_damageEnemy` 与 `combat_runeCharge_onHit` 读取 `ownedRelics` 生效。 |
| 2026-06-18 | `src/config.js`, `src/pinboard_modules.js`, `src/entities.js`, `src/game_phase.js`, `src/game_system.js`, `src/ui/shop.js` | **钉盘密度与尺寸参数化**：`CONFIG.physics` 新增 `pegRadius`、`maxMarbleSizeBonus`、`pinboardSpacingBuffer`，收集阶段 `marbleRadius` 下调到 5.8；Peg 碰撞/绘制半径统一读取 `pegRadius`。模块生成间距改为按基础弹珠/细钉通行计算，不再以旧的大号弹珠作为密度基线；高开销 Peg 阴影/光晕仍由 `CONFIG.performance` 控制。 |
| 2026-06-18 | `src/pinboard_modules.js`, `src/game_phase.js`, `src/core.js`, `src/game_system.js`, `src/ui_system.js` | **符文融合钉盘模块**：初始组件序列新增 `rune_lattice`；商店组件池新增 `rune_focus_module`。模块可通过 `fusionPriority` 标记融合优先级，`pendingFusions` 应用时会优先注入这些承载钉。 |
| 2026-06-18 | `src/pinboard_modules.js`, `.cursor/rules/game_phase.md` | **钉板模块池扩展**：新增 `split_gate_module`、`recall_loop_module`、`cascade_bank_module`、`crucible_core_module`、`double_wheel_module`、`fusion_garden_module` 六个商店模块，复用现有 Peg、`SpecialSlot` 与 `fusionPriority` 契约，不新增全局状态。 |
| 2026-04-18 | `src/config.js`, `src/game_system.js`, `.cursor/rules/config.md` | **敌人掉落参数配置化**：`CONFIG.gameplay` 新增 `enemyDropBaseChance`、`enemyDropRoundBonus`、`enemyDropAffixBonus`、`enemyDropRelicBaseChance`、`enemyDropRelicHighHpBonus`、`enemyDropPureEssenceChance` 等参数；`sys_tryQueueEnemyRoundReward()` 不再依赖硬编码常数，而是统一读取这些配置计算非 Boss 掉落。 |
| 2026-04-18 | `src/game_system.js`, `src/ui_system.js`, `src/ui/shop.js`, `.cursor/rules/config.md`, `.cursor/rules/game_phase.md`, `.cursor/rules/ui_system.md` | **精华掉落语义闭环修复**：`pendingRoundStartRewards` 现在显式区分 `relic` / `chaos_essence` / `pure_essence`；非 Boss 敌人死亡后直接登记三类奖励，round-start resolver 在下一回合开始触发对应命运时刻；`ui_showRelicSelection()` 不再把混沌精华与纯净精华当作普通遗物候选；纯净精华确认时会把注入结果写回弹珠并写入 `doubleAssimilationBoostRounds`。 |
| 2026-04-17 | `src/config.js`, `src/core.js`, `src/game_system.js`, `src/ui/shop.js`, `src/ui_system.js`, `src/spawn_system.js`, `src/entities.js`, `src/game_phase.js`, `index.html` | **命运时刻 / 纯净精华数据契约回补**：将旧 `fortune_wheel_relic` 更名为 `chaos_essence`，新增 `pure_essence` 数据项；`CONFIG.gameplay` 新增 `assimilationDoubleMultiplier`；运行态补齐 `pendingSelectionMode`、`selectionMode`、`selectionRequiredCount`、`selectionInjectedRune`、`doubleAssimilationBoostRounds`；纯净精华改为“1 枚弹珠 + 1 个合法符文注入”，同化涌潮改为显式 `x2` 概率倍率。 |
| 2026-04-17 | `src/game_phase.js`, `src/game_system.js`, `src/core.js`, `src/ui/shop.js`, `src/event_bus.js`, `src/config.js` | **固定回合遗物移除 + round-start resolver**：删除 `phase_finalizeRound` 中的固定 `isRelicRound` 入口，首个遗物与非 Boss 敌人的遗物/精华掉落统一写入 `pendingRoundStartRewards`，在下一回合开始由 `sys_startRoundStartResolver()` 结算；`CONFIG.gameplay.relicRoundInterval` 配置随之移除。 |
| 2026-04-16 | `src/config.js`, `src/game_system.js`, `src/spawn_system.js`, `src/combat_system.js`, `src/combat/damage_calc.js`, `src/entities.js`, `src/entities/enemy.js`, `src/render_system.js`, `src/core.js` | **自适应性能系统**：在 `CONFIG.performance` 新增三档特效等级（`high`/`medium`/`low`）及完整预算表；`sys_loop` 内加入 60 帧滑动平均 FPS 采样器，连续低帧 3s 降级、连续高帧 10s 升级；粒子系统（`spawn_createParticle` / `spawn_pushParticleWithLimit`）、冲击波、火焰波、治疗波、闪电特效均接入动态预算；Peg 软阴影（`pegSoftShadow`）和底部光晕（`pegGlowHalo`）接入性能开关；敌人材质光泽（`enemyGloss`）接入性能开关；降级时在 Canvas 左上角显示 FPS + 等级指示层。 |
| 2026-04-16 | `src/game_phase.js`, `src/entities.js`, `src/spawn_system.js` | **激光属性设计调整**：移除激光属性对应的钉子生成逻辑（从 `allPegTypes` 中移除 `laser`）；在 `entities.js` 收集逻辑中当 `finalType === 'laser'` 时跳过收集；禁止激光弹珠同化普通钉子（`ballType === 'laser'` 时直接 return）。遗物 `optical_lens` 的 `unlocks: 'laser'` 保留，仅解锁激光弹珠出现。激光属性现在仅能通过弹珠本身或符文系统提供。 |
| 2026-04-16 | `src/config.js`, `src/spawn_system.js` | **前三关难度降低**：`enemyBaseHp` 10→6；`enemyHpPerRound` 8→5；`hpExponent` 1.12→1.10；`startRows` 4→3；`spawnMin` 3→2；`spawn_system.js` 中词缀初始概率 0.1→0.05。整体效果：第1关敌人血量降低约 45%，前三关词缀概率降低约 5%，初始敌人行数减少 1 行。 |
|------|------|----------|
| 2026-04-13 | `src/game_phase.js`, `src/ui/shop.js`, `src/game_system.js`, `src/config.js`, `index.html` | **新手体验优化：遗物时机调整 + 推荐系统 + 视觉增强**：将遗物触发逻辑改为「初始回合给予一次，第 3 回合起每 5 回合给予一次」；在 `RELIC_DB` 中为强力遗物添加 `recommended`、`tags`、`recommendTip` 字段；`shop.js` 前三次遗物选择时提升推荐遗物权重并展示推荐标签/Tip；`index.html` 增强 rare/legendary/cursed 遗物卡片的动画光效。 |
| 2026-04-13 | `src/config.js`, `src/entities.js` | **全局调低弹珠同化概率**：将所有弹珠的基础同化概率及涌潮遗物加成均降低为当前值的 0.65 倍（如 0.2->0.13, 0.3->0.195），以平衡游戏后期同化过快的问题。 |
| 2026-04-13 | `src/config.js`, `src/ui/shop.js` | **钉盘结构遗物单局互斥限制**：新增 `BOARD_STRUCTURE_RELICS` 集合（包含 `dimension_shard`、`triangle_formation`、`diamond_formation`、`sparse_interval`、`mirror_sync`、`wide_narrow`）并导出。`shop.js` 的 `ui_showRelicSelection` 在遗物池过滤时增加互斥判断：若玩家本局已选过任意一个钉盘结构遗物，则所有其他钉盘结构遗物从候选池中排除。同时将 `dimension_shard` 的 `maxStacks` 从 `3` 改为 `1` |
| 2026-04-14 | `src/game_phase.js`, `src/entities.js`, `src/spawn_system.js` | **闪电属性设计调整**：移除闪电属性对应的钉子生成逻辑，移除 `Peg` 类中的闪电绘制与颜色逻辑。更新 Truth Book 描述，明确闪电属性仅通过【冰】+【火】抵消产生。 |
| 2026-04-13 | `src/config.js` | **提升穿透与散射遗物稀有度**：将 `tactical_kit_pierce`、`tactical_kit_scatter`（解锁遗物）以及 `surge_pierce`、`surge_scatter`（涌潮遗物）的稀有度从 `common`/`rare` 提升至 `legendary`，以匹配其作为稀有属性的定位。 |
| 2026-04-12 | `src/config.js` | **Mikro 减伤机制**：在 `bossConfigs.mikro` 中新增 `cloneDamageReductionPerClone` (0.10) 和 `cloneDamageReductionMax` (0.50) 参数，用于控制 Mikro 母体根据场上存活分身数量获得的伤害减免效果。 |
| 2026-04-12 | `src/config.js` | **初始钉子行数减少 1**：`CONFIG.gameplay.rows` 从 `6` 改为 `5`，降低游戏初始复杂度，改善早期游戏体验。 |
| 2026-04-12 | `src/spawn_system.js` | **修复 mikro/micro 命名不一致 Bug**：将 `spawn_system.js` 中的 `switch case 'micro'` 改为 `mikro`，与 `config.js` 中的 Boss ID 保持一致。 |
| 2026-04-12 | `src/config.js` | **Chimera 狂暴爆炸概率配置**：`CONFIG.balance.bossConfigs.chimera` 中新增 `berserkedBlastOnHitChance: 0.25`，表示 Chimera 狂暴后每次受击有5% 概率触发全场爆炸。 |
| 2026-04-12 | `src/config.js` | **Viridis Boss 狂暴配置修正**：`bossConfigs.viridis.berserkedHealerRange` 从 `999` 改为 `0`（狂暴后停止治疗其他敌人），新增 `berserkedSelfRegenMult: 3.0`（狂暴后自身回血速度倍率）。 |
| 2026-04-12 | `src/config.js` | **新增 Glacies 狂暴冻结参数**：在 `CONFIG.balance.bossConfigs.glacies` 中新增 `berserkedFreezePegRadius: 120`，用于控制其狂暴跳跃落地后冻结周围 Peg 的范围。 |

## 5. 遗物重复获取机制规范
- **数据结构**: 遗物数据字典 (`RELIC_DB`) 中使用 `maxStacks` 字段控制遗物的最大可获取次数。
- **获取记录**: 玩家已拥有的遗物存储在 `Game.ownedRelics` 数组中。支持重复获取的遗物会在该数组中出现多次。
- **UI 显示**: `ui_showRelicSelection` 在渲染遗物卡片时，若 `maxStacks > 1`，将显示当前层数与最大层数的进度提示。
- **重置逻辑**: `game_system.js` 中的 `sys_resetGame` 方法除了清空 `ownedRelics` 外，还必须重置受遗物影响的状态变量（如 `pinkPegCount`、`marbleSizeBonus`、`hasCombatWall`、`slotCount`、`unlockedSlots`、`flatDamageBonus`、`playerShield`、`assimilationBoostRounds`、`doubleAssimilationBoostRounds`、`pendingSelectionMode`、`selectionMode`、`selectionRequiredCount`、`selectionInjectedRune`）。
- **ID 唯一性**: 确保 `RELIC_DB` 中每个遗物的 `id` 唯一，避免因同名 ID 导致去重或计数逻辑错误（如原有的三个 `tactical_kit` 已拆分为 `tactical_kit_pierce`、`tactical_kit_scatter`、`tactical_kit_damage`）。
- **选择刷新遗物**: `selection_reroll` / `relic_reroll` 类遗物只提供 UI 层刷新入口。刷新按钮必须由 `ownedRelics` 判定显隐，并通过 `selectionRerollUsed` / `relicRerollUsed` 限制为当前选择机会一次；不得通过重复调用 `ui_showRelicSelection()` 推进 `relicSelectionCount`。

## 6. 同化涌潮遗物规范
- **设计意图**: 每种可同化钉子的弹珠（`bounce`、`pierce`、`scatter`、`damage`、`cryo`、`pyro`）各对应一个遗物，命名格式为 `surge_{type}`。
- **effect 字段**: 一律使用 `effect: 'assimilation_surge'`，配合 `marbleType` 字段指定弹珠类型.
- **状态变量**: 兼容保留 `game.assimilationBoostRounds`，但新增的显式倍率字段为 `game.doubleAssimilationBoostRounds`，两者都是 `{ marbleType: roundsLeft }` 结构。
- **涌潮效果**: 获取遗物时向 `guaranteedNextRound` 注入两个该弹珠类型，并同时将 `assimilationBoostRounds[marbleType]` 与 `doubleAssimilationBoostRounds[marbleType]` 设为 2。
- **同化加成**: `entities.js` 中只要 `assimilationBoostRounds[ballType] > 0` 或 `doubleAssimilationBoostRounds[ballType] > 0`，就对基础同化概率乘以 `CONFIG.gameplay.assimilationDoubleMultiplier`（当前为 `2`），禁止继续散落 `+0.195` 等匿名常数。
- **递减逻辑**: `game_phase.js` 的 `phase_finalizeRound` 中需要同时遍历 `assimilationBoostRounds` 与 `doubleAssimilationBoostRounds`，按回合递减并在归零时清理。

## 7. 命运时刻 / 纯净精华奖励规范
- **混沌精华 (`chaos_essence`)**：语义上承接旧命运轮盘，但当前不再作为普通遗物候选出现，而是由非 Boss 敌人掉落并写入 `pendingRoundStartRewards`；resolver 处理到该奖励时，应写入 `pendingSelectionMode = { mode: 'chaos_essence', requiredCount: 3, ... }`，然后进入标准命运抉择。
- **敌人掉落参数**：非 Boss 掉落概率与奖励构成必须通过 `CONFIG.gameplay.enemyDrop*` 参数族统一配置，至少包括基础掉率、回合成长、词缀加成、遗物权重、高血量遗物补正和纯净精华占比，禁止再把这些数值散落为匿名常数。
- **纯净精华 (`pure_essence`)**：同样由非 Boss 敌人掉落并写入 `pendingRoundStartRewards`；resolver 处理到该奖励时，应写入 `pendingSelectionMode = { mode: 'pure_essence', requiredCount: 1, ... }`，由下一次 `sys_initSelectionPhase()` 消费。
- **遗物池边界**：`ui_showRelicSelection()` 必须将 `chaos_essence` 与 `pure_essence` 排除在普通遗物候选池外，避免精华再次通过遗物界面重复发放。
- **纯净精华写回要求**：确认选择时必须把符文元素作为合成属性追加写入 `MarbleDefinition.collected`，不得覆盖 `marble.type` 或清空弹珠原有属性；同时同步写入 `source`、`infusedRuneId`、`infusedAttribute`、`assimilationMultiplier` 等局部运行态，并为对应 `marble.type` 写入 `doubleAssimilationBoostRounds`，确保“同化率 x2”真实生效。研磨发射时 `currentSession.collected` 必须继承该弹珠已有 `collected`，否则合成属性不会进入最终子弹 recipe。
- **运行态契约**：`selectionMode`、`selectionRequiredCount`、`selectionInjectedRune`、`selectionPreviewState`、`relicOverlayReturnState`、`pendingSelectionMode`、`doubleAssimilationBoostRounds`、`fateMomentContext` 必须同时出现在 `core.js` 初始化、`sys_resetGame()` 重置、`sys_saveRunState()` / `sys_loadRunState()` 持久化中。

## 9. 教学曲线配置 (ENEMY_CURVE_CONFIG)

`ENEMY_CURVE_CONFIG` 控制游戏在不同阶段（Round）的敌人词缀生成概率和难度曲线。

- **`THEME_SEGMENTS`**: 定义了八大主题段落的回合区间和对应的 Boss。
  - R1-R5 基础教学段 (boss_ignis)
  - R6-R12 持续压力段 (boss_glacies)
  - R13-R19 群体控制段 (boss_micro)
  - R20-R26 机制复合段 (boss_devourer)
  - R27-R33 进阶测试段 (boss_viridis)
  - R34-R40 速度地狱段 (boss_tesla)
  - R41-R47 混沌段 (boss_chimera)
  - R48-R54 终极考验段 (boss_ouroboros)
- **`AFFIX_WEIGHT_CURVES`**: 定义了每个段落内各词缀（shield/haste/regen/jump/healer/clone/devour/berserk）的权重值（0-100）。
  - 核心词缀：80-100
  - 引入词缀：30-50
  - 背景词缀：10-20
  - 未引入词缀：0-5
- **`ELITE_DUAL_AFFIX_BASE`**: 双词缀精英基础概率（默认 0.15）。
- **`ELITE_DUAL_AFFIX_POST_BOSS_BOOST`**: Boss 战后高压提升值（+0.25，持续 3 回合）。
## 2026-06-22 Boss 配置补充

- `CONFIG.balance.bossEnrageHpRatio` 是唯一 Boss 狂暴血量阈值，当前为 `0.2`。
- `CONFIG.balance.bossConfigs[id].hpMult` 会在 `spawn_spawnBoss()` 中乘入生成血量；当前 `ignis.hpMult = 1.08`。
- `CONFIG.balance.bossConfigs[id].regenPercentOverride` 可覆盖 Boss 自身 `regen` 词缀回血比例；当前 `glacies.regenPercentOverride = 0.12`，普通敌人仍使用 `CONFIG.balance.affixes.regenPercent`。
## 2026-06-22 Greedy Wheel Tuning

- `CONFIG.gameplay.greedyWheelChance` controls the repeat probability and remains `0.75`.
- `greedyWheelIntervalFrames`, `greedyWheelPreludeFrames`, and `greedyWheelFireDelayFrames` split the chain rhythm into post-shot wait, convergence roll, and success fire delay.
- `greedyWheelMaxChain` is a defensive cap for pathological lucky streaks; normal rolls still use the same probability until that cap.
- `CONFIG.performance.*.greedyWheelEffectLimit` caps the dedicated convergence/success/fail VFX count per quality tier.
