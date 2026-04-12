---
description: "全局配置结构、数据字典格式与修改规范"
globs: ["src/config.js"]
---
# 配置模块规范 (Config System)

## 1. 配置结构
`src/config.js` 集中管理游戏的所有常量和静态数据字典，主要包含：
- **系统配置**: 屏幕尺寸、帧率、物理引擎参数等。
- **UI 配置**: 颜色主题、字体大小、层级 (z-index) 定义。
- **游戏数值**: 基础掉落率、难度系数、经济系统数值。

## 2. 数据字典格式
- **`ELEMENT_CONFIG`**: 定义弹珠/钉子的元素属性（如物理、火焰、冰霜等）及其对应的颜色、基础伤害倍率和特殊效果。
- **`RELIC_DB`**: 遗物数据库，定义遗物的 ID、名称、描述、稀有度和具体效果逻辑。
- **`SKILL_DB`**: 技能数据库，定义玩家或敌人的技能效果、冷却时间和触发条件。

## 3. 修改规范
- **集中管理**: 严禁在业务逻辑中硬编码魔法数字（Magic Numbers）或颜色値，必须提取到 `config.js`。
- **格式一致性**: 添加新数据字典条目时，必须严格遵循现有对象的键名和数据类型结构。
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
- 前期低保底将保底下限从 70% 降至 45%，使血量更自由地跨随玩家战力浮动。

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

## 5. probabilities 初始权重设计规范

`CONFIG.probabilities` 定义了收集阶段钉板刷新时各属性钉子的基础权重，并在每局开始时被复制到 `this.unlockedWeights`。

**设计原则**：
- **初始状态只提供反弹属性**：`bounce: 20` 是唯一初始权重大于 0 的特殊属性，其余属性（`pierce`、`scatter`、`damage`、`cryo`、`pyro`、`explosive` 等）均为 `0`。
- **遗物解锁机制**：玩家选择遗物时，`shop.js` 中的 `ui_selectRelic` 会通过 `this.unlockedWeights[key]` 增加对应属性的权重，从而在后续回合的钉板刷新中按概率生成对应属性钉子。
- **修改警告**：严禁将除 `bounce` 和 `white` 以外的属性初始权重设置为大于 0 的数値，否则会破坏“遗物解锁属性”的游戏设计意图。

## 5. 遗物重复获取机制规范
- **数据结构**: 遗物数据字典 (`RELIC_DB`) 中使用 `maxStacks` 字段控制遗物的最大可获取次数。
- **获取记录**: 玩家已拥有的遗物存储在 `Game.ownedRelics` 数组中。支持重复获取的遗物会在该数组中出现多次。
- **UI 显示**: `ui_showRelicSelection` 在渲染遗物卡片时，若 `maxStacks > 1`，将显示当前层数与最大层数的进度提示。
- **重置逻辑**: `game_system.js` 中的 `sys_resetGame` 方法除了清空 `ownedRelics` 外，还必须重置受遗物影响的状态变量（如 `pinkPegCount`、`marbleSizeBonus`、`hasCombatWall`、`slotCount`、`unlockedSlots`）。
- **ID 唯一性**: 确保 `RELIC_DB` 中每个遗物的 `id` 唯一，避免因同名 ID 导致去重或计数逻辑错误（如原有的三个 `tactical_kit` 已拆分为 `tactical_kit_pierce`、`tactical_kit_scatter`、`tactical_kit_damage`）。
