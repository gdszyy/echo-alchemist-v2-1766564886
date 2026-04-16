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
- **初始状态只提供反弹属性**：`bounce: 20` 是唯一初始权重大于 0 的特殊属性，其余属性（`pierce`、`scatter`、`damage`、`cryo`、`pyro`、`explosive` 等）均为 `0`。
- **遗物解锁机制**：玩家选择遗物时，`shop.js` 中的 `ui_selectRelic` 会通过 `this.unlockedWeights[key]` 增加对应属性的权重，从而在后续回合的钉板刷新中按概率生成对应属性钉子。
- **闪电属性特殊性**：自 2026-04-14 起，**闪电（lightning）属性不再拥有对应的钉子**，也不再通过遗物直接解锁其生成权重。闪电属性仅能通过收集阶段中【冰霜】与【火焰】属性的抗消（合成）产生。
- **激光属性特殊性**：自 2026-04-16 起，**激光（laser）属性不再拥有对应的钉子**，遉物 `optical_lens` 的 `unlocks: 'laser'` 仅解锁激光弹珠出现，不会产生激光钉子。激光属性仅能通过弹珠本身（`marbleDef.type === 'laser'`）或符文系统（`calcRuneBaseStats`）提供。
- **修改警告**：严禁将除 `bounce` 和 `white` 以外的属性初始权重设置为大于 0 的数値，否则会破坏“遗物解锁属性”的游戏设计意图。严禁在 `allPegTypes` 中重新加入 `lightning` 或 `laser`。
## 7. Boss 配置参数说明 (bossConfigs)

`CONFIG.balance.bossConfigs` 控制各个特殊 Boss 的专有参数和机制系数。

**Mikro (裂变母体·米克罗) 专有参数**:
- `cloneChanceHitBonus`: 额外受击分身概率 (默认 0.3)
- `berserkedCloneChance`: 狂暴后分身概率 (默认 1.0)
- `cloneDamageReductionPerClone`: 每个存活分身提供的减伤比例 (默认 0.10)
- `cloneDamageReductionMax`: 分身减伤上限 (默认 0.50)

## 8. 参数调整记录

| 日期 | 文件 | 修改内容 |
|------|------|----------|
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
- **重置逻辑**: `game_system.js` 中的 `sys_resetGame` 方法除了清空 `ownedRelics` 外，还必须重置受遗物影响的状态变量（如 `pinkPegCount`、`marbleSizeBonus`、`hasCombatWall`、`slotCount`、`unlockedSlots`、`assimilationBoostRounds`）。
- **ID 唯一性**: 确保 `RELIC_DB` 中每个遗物的 `id` 唯一，避免因同名 ID 导致去重或计数逻辑错误（如原有的三个 `tactical_kit` 已拆分为 `tactical_kit_pierce`、`tactical_kit_scatter`、`tactical_kit_damage`）。

## 6. 同化涌潮遗物规范
- **设计意图**: 每种可同化钉子的弹珠（`bounce`、`pierce`、`scatter`、`damage`、`cryo`、`pyro`）各对应一个遗物，命名格式为 `surge_{type}`。
- **effect 字段**: 一律使用 `effect: 'assimilation_surge'`，配合 `marbleType` 字段指定弹珠类型.
- **状态变量**: `game.assimilationBoostRounds` 是一个对象 `{ marbleType: roundsLeft }`，不是数字。
- **涌潮效果**: 获取遗物时向 `guaranteedNextRound` 注入两个该弹珠类型，并将 `assimilationBoostRounds[marbleType]` 设为 2。
- **同化加成**: `entities.js` 中判断 `game.assimilationBoostRounds[ballType] > 0` 时，对该弹珠类型的同化概率 +0.195 (由 0.3 调低，原始 0.5 * 0.65 = 0.325 -> 0.3 * 0.65 = 0.195)。
- **递减逻辑**: `game_phase.js` 的 `phase_finalizeRound` 中遍历 `assimilationBoostRounds` 对象，对每个类型递减回合数，归零时弹出提示。
