# 符文索引 (Rune Index)

> **数据来源**：`src/rune_config.js` → `RUNE_DB`
> **用途**：Agent 快速查询所有符文的 ID、名称、稀有度、属性、亲和标签，无需全量读取 `rune_config.js`。

## 1. 符文总览

| ID | 名称 | 图标 | 稀有度 | 属性 (element) | 每级层数 | 掉落权重 | 亲和标签 |
|---|---|---|---|---|---|---|---|
| `rune_pyro_1` | 烈焰符文 | 🔥 | common | pyro | 1 | 12 | `shield`, `regen` |
| `rune_pyro_2` | 炎核符文 | 🌋 | epic | pyro | 2 | 2 | `shield`, `healer` |
| `rune_cryo_1` | 寒冰符文 | ❄️ | common | cryo | 1 | 12 | `haste`, `jump` |
| `rune_cryo_2` | 冰晶符文 | 🧊 | epic | cryo | 2 | 2 | `haste`, `regen` |
| `rune_lightning_1` | 雷霆符文 | ⚡ | rare | lightning | 1 | 6 | `clone`, `healer` |
| `rune_lightning_2` | 电弧符文 | 🌩️ | legendary | lightning | 4 | 0.5 | `clone`, `haste` |
| `rune_bounce_1` | 弹跃符文 | 🔄 | common | bounce | 2 | 12 | `clone`, `jump` |
| `rune_bounce_2` | 回响符文 | ↩️ | rare | bounce | 4 | 5 | `clone`, `devour` |
| `rune_pierce_1` | 穿刺符文 | ↗️ | epic | pierce | 1 | 2 | `shield`, `jump` |
| `rune_pierce_2` | 破甲符文 | 🗡️ | legendary | pierce | 3 | 0.5 | `shield`, `devour` |
| `rune_scatter_1` | 散裂符文 | 🔱 | legendary | scatter | 2 | 0.5 | `clone`, `healer` |
| `rune_laser_1` | 光束符文 | ☄️ | rare | laser | 1 | 6 | `regen`, `devour` |
| `rune_laser_2` | 聚焦符文 | 🔦 | legendary | laser | 4 | 0.5 | `regen`, `haste` |

> **注**：`rune_scatter_2`（稀有散射符文）在代码中暂未定义，散射系仅有 `rune_scatter_1` 一枚传说级符文。

## 2. 稀有度分布

| 稀有度 | 颜色 | 基础掉落权重 | 符文列表 |
|---|---|---|---|
| common（普通） | `#aaaaaa` | 12 | `rune_pyro_1`, `rune_cryo_1`, `rune_bounce_1` |
| rare（稀有） | `#4a90d9` | 5~6 | `rune_lightning_1`, `rune_bounce_2`, `rune_laser_1` |
| epic（史诗） | `#9b59b6` | 2 | `rune_pyro_2`, `rune_cryo_2`, `rune_pierce_1` |
| legendary（传说） | `#f39c12` | 0.5 | `rune_lightning_2`, `rune_pierce_2`, `rune_scatter_1`, `rune_laser_2` |

**概率分布（总权重 ≈ 61）**：普通 ≈ 59%，稀有 ≈ 27.9%，史诗 ≈ 9.8%，传说 ≈ 3.3%

## 3. 属性分组

| 属性 | 符文列表 | 对应词条（需要该属性符文） |
|---|---|---|
| pyro（火焰） | `rune_pyro_1`（common）, `rune_pyro_2`（epic） | 熔毁、炎光剑影、炽热光线、元素聚变、嗜血初锋、质量坍缩 |
| cryo（冰霜） | `rune_cryo_1`（common）, `rune_cryo_2`（epic） | 绝对零度、冰霜新星、元素聚变 |
| lightning（闪电） | `rune_lightning_1`（rare）, `rune_lightning_2`（legendary） | 雷暴之语、雷霆散射、雷电护盾、元素聚变、散射矩阵 |
| bounce（弹跳） | `rune_bounce_1`（common）, `rune_bounce_2`（rare） | 动能激增、冰霜新星、雷电护盾、风暴共鸣、散射矩阵、质量坍缩、动能衰变、回响射击 |
| pierce（穿透） | `rune_pierce_1`（epic）, `rune_pierce_2`（legendary） | 炎光剑影、穿甲流星、剑刃风暴、剑意共鸣、嗜血初锋、专注射击、动能衰变 |
| scatter（散射） | `rune_scatter_1`（legendary） | 穿甲流星、剑刃风暴、回响射击 |
| laser（激光） | `rune_laser_1`（rare）, `rune_laser_2`（legendary） | 照射、炽热光线、专注射击 |

## 4. 亲和标签说明

亲和标签（`affinity_tags`）用于**智能掉落权重计算**：当玩家当前面对的敌人具有对应词缀时，该符文的掉落概率会提升。

| 亲和标签 | 含义 | 具有该亲和标签的符文 |
|---|---|---|
| `shield` | 克制护盾型敌人 | `rune_pyro_1`, `rune_pyro_2`, `rune_pierce_1`, `rune_pierce_2` |
| `regen` | 克制再生型敌人 | `rune_pyro_1`, `rune_cryo_2`, `rune_laser_1`, `rune_laser_2` |
| `haste` | 克制极速型敌人 | `rune_cryo_1`, `rune_cryo_2`, `rune_lightning_2`, `rune_laser_2` |
| `jump` | 克制跳跃型敌人 | `rune_cryo_1`, `rune_bounce_1`, `rune_pierce_1` |
| `clone` | 克制分身型敌人 | `rune_lightning_1`, `rune_lightning_2`, `rune_bounce_1`, `rune_bounce_2`, `rune_scatter_1` |
| `healer` | 克制治疗者型敌人 | `rune_pyro_2`, `rune_lightning_1`, `rune_scatter_1` |
| `devour` | 克制吞噬型敌人 | `rune_bounce_2`, `rune_pierce_2`, `rune_laser_1` |

## 5. 关键代码位置

| 功能 | 文件 | 说明 |
|---|---|---|
| 符文数据定义 | `src/rune_config.js` → `RUNE_DB` | 所有符文的原始数据 |
| 符文掉落逻辑 | `src/loot_system.js` | 基于 `baseDropWeight` 和 `affinity_tags` 的加权随机 |
| 符文网格解析 | `src/rune_system.js` → `parseRuneGrid()` | 解析 3×3 网格，匹配词条 |
| 基础属性计算 | `src/rune_system.js` → `calcRuneBaseStats()` | `level × baseStatPerLevel` 计算层数 |
| UI 展示 | `src/ui/rune_launcher.js` | 符文放置、预览、共鸣激活 |
