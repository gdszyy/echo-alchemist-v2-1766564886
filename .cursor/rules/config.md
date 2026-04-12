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

## 4. RELIC_DB 钉盘形态遗物规范（新增）

钉盘形态遗物通过修改 `Game` 实例上的以下字段来动态调整钉盘布局，这些字段在 `core.js` 中初始化，在 `game_system.js` 的 `sys_resetGame` 中重置：

| 字段 | 类型 | 默认值 | 用途 |
| :--- | :--- | :--- | :--- |
| `boardSpacingXMult` | number | `1.0` | 水平间距乘数，密集阵列遗物缩小、宽幅延展遗物增大 |
| `boardSpacingYMult` | number | `1.0` | 垂直间距乘数，垂直压缩遗物缩小 |
| `boardColsBonus` | number | `0` | 额外列数，菱形矩阵和宽幅延展遗物增加 |
| `boardDoubleStagger` | boolean | `false` | 开启双重交错模式，镜像交错遗物开启 |

**钉盘形态遗物列表**：

| 遗物 ID | 效果标识 | 策略定位 | 与行数遗物联合效果 |
| :--- | :--- | :--- | :--- |
| `dense_array` | `board_spacing_down` | 高频触发流 | 行数多+间距小=超密集钉盘 |
| `wide_spread` | `board_spacing_up` | 路径控制流 | 行数多+间距大=超宽广钉盘 |
| `diamond_matrix` | `board_cols_up` | 槽位流 | 行数多+列数多=最大面积 |
| `vertical_compress` | `board_spacing_y_down` | 极限触发流 | 行数多+垂直压缩=有限空间内最多行 |
| `mirror_stagger` | `board_double_stagger` | 随机爆发流 | 行数多+双重交错=最大随机化 |

**修改警告**：
- `boardSpacingXMult` 和 `boardSpacingYMult` 每次叠加是乘法关系，不是加法。三层密集阵列后 spacingX 为基础值的 `0.8^3 = 51.2%`。
- 严禁将 `boardSpacingXMult` 设置为小于 `0.3`，否则钉子会重叠。
- `boardColsBonus` 增加后，钉盘宽度不得超过 Canvas 宽度，否则钉子会超出屏幕。

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
