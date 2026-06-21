# 属性索引 (Attribute Index)

> **数据来源**：`src/rune_config.js` → `STAT_DISPLAY`, `ELEMENT_RESONANCE_DB`；`src/systems.js` → `TRUTH_BOOK_DATA.attributes`；`src/config.js` → `ELEMENT_CONFIG`
> **用途**：Agent 快速查询弹药属性的显示名称、共鸣效果及图鉴说明，无需全量读取数据文件。

## 1. 属性总览

| 属性键 | 显示名 | 图标 | 弹珠类型 | 核心机制 |
|---|---|---|---|---|
| `pyro` | 火焰 | 🔥 | 火焰弹珠 | 命中敌人升温，过热（≥200°C）触发爆燃，造成额外伤害 |
| `cryo` | 冰霜 | ❄️ | 冰霜弹珠 | 命中敌人降温，过冷（≤-34°C）触发冰冻，冻结期间受到的伤害提升 |
| `lightning` | 闪电 | ⚡ | 闪电弹珠 | 命中敌人施加感电层数，触发闪电链对周围敌人造成连锁伤害 |
| `bounce` | 弹跳 | 🔄 | 弹性弹珠 | 增加弹珠在敌人之间弹射的次数，适合密集怪群 |
| `pierce` | 穿透 | 💠 | 穿透弹珠 | 使弹珠能穿透敌人身体，直接打击后排目标 |
| `scatter` | 散射 | 🌟 | 散射弹珠 | 弹珠飞行时向两侧分裂出小型子弹，扩大打击覆盖面 |
| `laser` | 激光 | 🔦 | 激光弹珠 | 发射瞬时射线，对路径上所有敌人造成伤害；可被护盾反射 |
| `venom` | 剧毒 | ☠️ | 剧毒弹珠 | 施加持续毒素伤害 |
| `overcharge` | 超载 | ⚡ | 底部奖励区属性 | 为弹药添加超载爆发层数；只能通过底部奖励区进入收集结果 |
| `echo` | 回响 | 🔊 | 回响弹珠 | 通过回响/复制机制强化多段命中 |
| `damage` | 伤害 | ⚔️ | 增幅弹珠 | 直接提升基础伤害，无特殊机制 |

> **注**：`damage` 属性无对应共鸣效果，不在 `ELEMENT_RESONANCE_DB` 中定义。

## 2. 属性关系状态

全局 `COUNTER_MAP` 已移除。属性之间不再维护“玩家属性 → 敌人词缀”的通用克制权重表。

- 智能掉落：`src/loot_system.js` 直接按近期伤害构成 `buildVector[rune.element]` 提升同属性符文权重。
- 战斗反馈：`src/combat_system.js` 不再显示“克制 / 有效”，只显示屏障、护盾、暴击、弹射、穿透、Boss 破绽等直接事件标签。
- Boss：仍使用 `CONFIG.balance.bossConfigs[*].vulnerability` 和 `themeWeights` 表达显式破绽谱与主题掉落。

## 3. 属性共鸣效果（ELEMENT_RESONANCE_DB）

> 数据来源：`src/rune_config.js` → `ELEMENT_RESONANCE_DB`
> 触发条件：在 3×3 符文网格中，同属性符文累计属性层数达到 3 / 6 / 9 时，分别激活 Tier1 / Tier2 / Tier3。

### 3.1 炎焰共鸣（pyro）

| 阶段 | 阈值 | 标签 | 核心效果 |
|---|---|---|---|
| Tier1 | 3 层 | 炎焰共鸣·一阶 | 火焰伤害 +20%，基础火焰属性 +5 |
| Tier2 | 6 层 | 炎焰共鸣·二阶 | 火焰伤害 +30%，基础火焰属性 +10，爆燃阈值降至 100°C |
| Tier3 | 9 层 | 炎焰共鸣·三阶 | 火焰伤害 +50%，基础火焰属性 +25，触发温度降至 0°C |

**战斗消费位置**：`src/combat_system.js` → `combat_damageEnemy` 火焰伤害段

### 3.2 冰霜共鸣（cryo）

| 阶段 | 阈值 | 标签 | 核心效果 |
|---|---|---|---|
| Tier1 | 3 层 | 冰霜共鸣·一阶 | 冰霜伤害 +20%，基础冰霜属性 +5 |
| Tier2 | 6 层 | 冰霜共鸣·二阶 | 冰霜伤害 +30%，基础冰霜属性 +10，冻结触发温度提升至 -25°C |
| Tier3 | 9 层 | 冰霜共鸣·三阶 | 冰霜伤害 +50%，基础冰霜属性 +25，冻结状态下物理伤害加深 +30% |

**战斗消费位置**：`src/combat_system.js` → `combat_damageEnemy` 冰霜伤害段

### 3.3 雷霆共鸣（lightning）

| 阶段 | 阈值 | 标签 | 核心效果 |
|---|---|---|---|
| Tier1 | 3 层 | 雷霆共鸣·一阶 | 闪电链触发概率 +15%，基础闪电属性 +5 |
| Tier2 | 6 层 | 雷霆共鸣·二阶 | 闪电链触发概率 +30%，基础闪电属性 +10，闪电伤害 +20% |
| Tier3 | 9 层 | 雷霆共鸣·三阶 | 闪电链触发概率 +50%，基础闪电属性 +25，允许对同一目标二次触发 |

**战斗消费位置**：`src/combat_system.js` 闪电链触发前 & `src/combat/damage_calc.js`

### 3.4 弹跳共鸣（bounce）

| 阶段 | 阈值 | 标签 | 核心效果 |
|---|---|---|---|
| Tier1 | 3 层 | 弹跳共鸣·一阶 | 弹跳伤害 +15%，基础弹跳属性 +5 |
| Tier2 | 6 层 | 弹跳共鸣·二阶 | 弹跳伤害 +30%，基础弹跳属性 +10，弹跳伤害衰减降低 50% |
| Tier3 | 9 层 | 弹跳共鸣·三阶 | 弹跳伤害 +50%，基础弹跳属性 +25，弹跳次数额外 +2，弹跳后伤害不衰减 |

**战斗消费位置**：`src/combat_system.js` 弹跳判定处 & `src/entities/projectile.js`

### 3.5 穿透共鸣（pierce）

| 阶段 | 阈值 | 标签 | 核心效果 |
|---|---|---|---|
| Tier1 | 3 层 | 穿透共鸣·一阶 | 穿透伤害 +15%，基础穿透属性 +5 |
| Tier2 | 6 层 | 穿透共鸣·二阶 | 穿透伤害 +30%，基础穿透属性 +10，穿透伤害衰减降低 20% |
| Tier3 | 9 层 | 穿透共鸣·三阶 | 穿透伤害 +50%，基础穿透属性 +25，穿透次数额外 +1，穿透伤害衰减降低 40% |

**战斗消费位置**：`src/combat_system.js` 穿透判定处

### 3.6 散射共鸣（scatter）

| 阶段 | 阈值 | 标签 | 核心效果 |
|---|---|---|---|
| Tier1 | 3 层 | 散射共鸣·一阶 | 额外散射子弹 +1，基础散射属性 +5 |
| Tier2 | 6 层 | 散射共鸣·二阶 | 额外散射子弹 +2，基础散射属性 +10，散射伤害 +20% |
| Tier3 | 9 层 | 散射共鸣·三阶 | 额外散射子弹 +3，基础散射属性 +25，散射伤害 +50%，散射角度收窄 30% |

**战斗消费位置**：`src/spawn_system.js` → `spawn_spawnBullet` 散射发射逻辑

### 3.7 激光共鸣（laser）

| 阶段 | 阈值 | 标签 | 核心效果 |
|---|---|---|---|
| Tier1 | 3 层 | 激光共鸣·一阶 | 激光命中额外升温 +5°，基础激光属性 +5 |
| Tier2 | 6 层 | 激光共鸣·二阶 | 激光命中额外升温 +10°，基础激光属性 +10，激光伤害 +20% |
| Tier3 | 9 层 | 激光共鸣·三阶 | 激光命中额外升温 +20°，基础激光属性 +25，激光伤害 +50%，激光折射基础概率 +20% |

**战斗消费位置**：`src/combat/collision.js` → `combat_laser_processPenetration`

## 4. 共鸣状态管理

| 操作 | 位置 | 说明 |
|---|---|---|
| 共鸣计算 | `src/ui/rune_launcher.js` → `ui_updateRuneGrid()` 步骤 6.5 | 基于 `calcRuneBaseStats` 返回的 `baseStats` 计算激活等级 |
| 共鸣状态存储 | `this.activeElementResonances` | 结构：`{ [element]: { label, desc, threshold, statCount, params } }` |
| 共鸣激活提示 | `ui_updateRuneGrid()` 内部 | 等级变化时弹出 Toast：`✨ 🔥 炎焰共鸣·一阶已激活！` |
| 共鸣重置 | `sys_resetGame` | `this.activeElementResonances = {}` |

## 5. 属性图鉴说明（TRUTH_BOOK_DATA.attributes）

> 数据来源：`src/systems.js` → `TRUTH_BOOK_DATA.attributes`

| 属性 | 图鉴名称 | 标签 | 图鉴描述 |
|---|---|---|---|
| bounce | 彈性 | 物理、連擊 | 增加彈珠在敵人之間彈射的次數，適合在密集怪群中製造混亂 |
| pierce | 穿透 | 物理、貫穿 | 使彈珠能夠穿透敵人的身體，直接打擊後排目標 |
| scatter | 散射 | 物理、分裂 | 彈珠飛行時會向兩側分裂出小型子彈，擴大打擊覆蓋面 |
| pyro | 火焰 | 元素、灼燒 | 命中敵人時升溫，過熱（≥200°C）觸發爆燃 |
| cryo | 冰霜 | 元素、冰凍 | 命中敵人時降溫，過冷（≤-34°C）觸發冰凍 |
| lightning | 閃電 | 元素、連鎖 | 命中敵人施加感電，觸發閃電鏈連鎖傷害 |
| laser | 激光 | 物理、穿透 | 瞬時射線，對路徑上所有敵人造成傷害；可被護盾反射 |

## 6. 关键代码位置

| 功能 | 文件 | 说明 |
|---|---|---|
| 属性显示名称映射 | `src/rune_config.js` → `STAT_DISPLAY` | 属性键到中文名称和图标的映射 |
| 共鸣效果数据库 | `src/rune_config.js` → `ELEMENT_RESONANCE_DB` | 7 种属性的共鸣分阶效果 |
| 属性图鉴 | `src/systems.js` → `TRUTH_BOOK_DATA.attributes` | 图鉴展示内容与演示配置 |
| 属性配置常量 | `src/config.js` → `ELEMENT_CONFIG` | 每种属性的伤害系数、触发条件等 |
| 共鸣状态计算 | `src/ui/rune_launcher.js` → `ui_updateRuneGrid()` | 步骤 6.5，写入 `activeElementResonances` |
