# 词条索引 (Runeword Index)

> **数据来源**：`src/rune_config.js` → `RUNEWORD_DB`
> **用途**：Agent 快速查询所有词条的 ID、名称、符文组合、效果描述及实现位置，无需全量读取 `rune_config.js`。

## 1. 词条总览（22 个）

### 1.1 元素专属词条（7 个）

| ID | 名称 | 符文组合 | 效果摘要 | 解锁技能 |
|---|---|---|---|---|
| `runeword_meltdown` | 熔毁 | `rune_pyro_1` × 2 + `rune_pyro_2` | 火焰燃烧伤害与过热爆炸最终伤害提升 | 熔毁新星 |
| `runeword_absolute_zero` | 绝对零度 | `rune_cryo_1` × 2 + `rune_cryo_2` | 冰冻状态下每次物理伤害令该敌人本回合受到的所有伤害加深 | 冰牢封印 |
| `runeword_frost_nova` | 冰霜新星 | `rune_cryo_1` × 1 + `rune_bounce_1` × 1 + `rune_cryo_2` × 1 | 弹珠每弹跳数次释放冰霜新星，造成冰属性伤害并降温 | — |
| `runeword_thunderstorm` | 雷暴之语 | `rune_lightning_1` × 2 + `rune_lightning_2` | 闪电链的伤害衰减系数提升 | 雷神降临 |
| `runeword_thunder_scatter` | 雷霆散射 | `rune_lightning_1` × 1 + `rune_scatter_1` × 1 + `rune_lightning_2` × 1 | 每次触发闪电链时，有概率额外释放一条同属性闪电链 | — |
| `runeword_kinetic_surge` | 动能激增 | `rune_bounce_1` × 2 + `rune_bounce_2` | 本次发射的弹珠，后续每次弹射伤害固定增加 | 动能爆发 |
| `runeword_irradiation` | 照射 | `rune_laser_1` × 2 + `rune_laser_2` | 激光变为持续照射，累积照射同一敌人伤害加深 | — |

### 1.2 复合机制词条（6 个）

| ID | 名称 | 符文组合 | 效果摘要 |
|---|---|---|---|
| `runeword_flame_sword` | 炎光剑影 | `rune_pyro_1` × 1 + `rune_pierce_1` × 1 + `rune_pyro_2` × 1 | 穿透敌人时，有概率召唤一道火焰剑光 |
| `runeword_armor_piercing_meteor` | 穿甲流星 | `rune_pierce_2` × 1 + `rune_scatter_1` × 1 + `rune_pierce_1` × 1 | 散射出的子弹丸继承 100% 的穿透层数 |
| `runeword_blazing_beam` | 炽热光线 | `rune_pyro_1` × 1 + `rune_laser_1` × 1 + `rune_laser_2` × 1 | 激光照射敌人时，每 0.5 秒额外提升敌人温度 |
| `runeword_lightning_shield` | 雷电护盾 | `rune_lightning_2` × 1 + `rune_bounce_2` × 1 + `rune_bounce_1` × 1 | 弹珠弹射时有概率在自身周围生成静电场 |
| `runeword_blade_storm` | 剑刃风暴 | `rune_pierce_1` × 1 + `rune_pierce_2` × 1 + `rune_scatter_1` × 1 | 首个子弹定期对范围内所有敌人生成一次剑光斩击 | 
| `runeword_elemental_fusion` | 元素聚变 | `rune_pyro_2` × 1 + `rune_cryo_2` × 1 + `rune_lightning_2` × 1 | 当敌人同时承受火、冰、雷三种状态时，引发元素聚变爆炸 |

### 1.3 特殊变异词条（2 个）

| ID | 名称 | 符文组合 | 效果摘要 |
|---|---|---|---|
| `runeword_sword_resonance` | 剑意共鸣 | `rune_pierce_1` × 3 | 解锁飞剑变异；穿透弹珠碰撞穿透钉子时有 70% 概率变异为飞剑钉子 |
| `runeword_storm_resonance` | 风暴共鸣 | `rune_bounce_1` × 3 | 解锁风属性变异；反弹弹珠碰撞反弹钉子时有 70% 概率变异为风属性钉子 |

### 1.4 成长型低级词条（6 个，Task A 新增）

| ID | 名称 | 符文组合 | 效果摘要 |
|---|---|---|---|
| `runeword_bloodthirst_edge` | 嗜血初锋 | `rune_pierce_1` × 2 + `rune_pyro_1` × 1 | 每次击杀敌人，全局基础伤害永久 +1；冰霜与火焰属性层数降低 30% |
| `runeword_scatter_matrix` | 散射矩阵 | `rune_bounce_1` × 2 + `rune_lightning_1` × 1 | 连射次数全部转化为散射层数；基础伤害降低 25%，散射夹角缩小 70% |
| `runeword_focused_fire` | 专注射击 | `rune_laser_1` × 2 + `rune_pierce_1` × 1 | 将所有弹跳和连射层数转化为基础伤害；伤害有 20% 概率暴击造成 200% 伤害 |
| `runeword_mass_collapse` | 质量坍缩 | `rune_bounce_1` × 2 + `rune_pyro_1` × 1 | 强制获得爆炸属性（范围减半）；每清空 1 层连射/散射，爆炸范围 +10% |
| `runeword_kinetic_decay` | 动能衰变 | `rune_bounce_1` × 2 + `rune_pierce_1` × 1 | 子弹初始获得 25% 伤害加成；每次命中后加成衰减 7% |
| `runeword_echo_shot` | 回响射击 | `rune_scatter_1` × 2 + `rune_bounce_1` × 1 | 子弹首次击中敌人时，有 25% 概率按原角度额外发射一颗单发子弹 |

## 2. 词条 effectId 与实现位置速查

| effectId | 词条名称 | 主要实现位置 | 关键状态字段 |
|---|---|---|---|
| `meltdown` | 熔毁 | `src/combat_system.js` 火焰伤害段 | `activeRunewordEffects['meltdown']` |
| `absolute_zero` | 绝对零度 | `src/combat_system.js` 冰霜伤害段 | `activeRunewordEffects['absolute_zero']` |
| `frost_nova` | 冰霜新星 | `src/combat_system.js` 弹跳判定处 | `activeRunewordEffects['frost_nova']` |
| `thunderstorm` | 雷暴之语 | `src/combat/damage_calc.js` 闪电链计算 | `activeRunewordEffects['thunderstorm']` |
| `thunder_scatter` | 雷霆散射 | `src/combat/damage_calc.js` 闪电链触发后 | `activeRunewordEffects['thunder_scatter']` |
| `kinetic_surge` | 动能激增 | `src/combat_system.js` 弹跳伤害段 | `activeRunewordEffects['kinetic_surge']` |
| `irradiation` | 照射 | `src/combat_system.js` 约第 2466 行 | `activeRunewordEffects['irradiation']`, `e._irradiationStacks` |
| `flame_sword` | 炎光剑影 | `src/combat_system.js` 约第 1755 行 | `activeRunewordEffects['flame_sword']` |
| `armor_piercing_meteor` | 穿甲流星 | `src/combat_system.js` 穿透判定处 | `activeRunewordEffects['armor_piercing_meteor']` |
| `blazing_beam` | 炽热光线 | `src/combat_system.js` 激光照射循环 | `activeRunewordEffects['blazing_beam']` |
| `lightning_shield` | 雷电护盾 | `src/combat_system.js` 约第 1778 行 | `activeRunewordEffects['lightning_shield']` |
| `blade_storm` | 剑刃风暴 | `src/combat_system.js` 约第 359 行 | `activeRunewordEffects['blade_storm']` |
| `elemental_fusion` | 元素聚变 | `src/combat_system.js` 元素状态判定 | `activeRunewordEffects['elemental_fusion']` |
| `flying_sword_unlock` | 剑意共鸣 | `src/spawn_system.js` 钉子变异逻辑 | `activeRunewordEffects['flying_sword_unlock']` |
| `wind_unlock` | 风暴共鸣 | `src/spawn_system.js` 钉子变异逻辑 | `activeRunewordEffects['wind_unlock']` |
| `bloodthirst_growth` | 嗜血初锋 | `src/combat_system.js` 约第 2037 行、2320 行 | `activeRunewordEffects['bloodthirst_growth']`, `game.runewordKillCount` |
| `multicast_to_scatter` | 散射矩阵 | `src/combat_system.js` 约第 2340 行（配方应用） | `activeRunewordEffects['multicast_to_scatter']` |
| `focused_fire` | 专注射击 | `src/combat_system.js` 约第 1714 行（暴击判定）、2358 行（配方应用） | `activeRunewordEffects['focused_fire']`, `finalRecipe._critChance`, `finalRecipe._critDamage` |
| `mass_collapse` | 质量坍缩 | `src/combat_system.js` 约第 2375 行（配方应用） | `activeRunewordEffects['mass_collapse']`, `finalRecipe._explosionRadiusMult` |
| `kinetic_decay` | 动能衰变 | `src/entities/projectile.js` 命中逻辑 | `activeRunewordEffects['kinetic_decay']`, `finalRecipe._kineticDecayBonus`, `finalRecipe._kineticDecayRate` |
| `echo_shot` | 回响射击 | `src/entities/projectile.js` 首次命中逻辑 | `activeRunewordEffects['echo_shot']`, `finalRecipe._echoShotChance` |

## 3. 词条激活机制

词条激活的完整流程如下：

1. **网格解析**：`src/rune_system.js` → `parseRuneGrid(grid, RUNEWORD_DB)` 扫描 3×3 网格，按路径匹配 `pattern`。
2. **等级计算**：同一词条的 `pattern` 在网格中出现 N 次，则 `level = N`；`effectiveParams = baseParams + (level-1) × perLevelParams`。
3. **效果注册**：激活的词条以 `{ effectId: effectiveParams }` 写入 `this.activeRunewordEffects`。
4. **战斗消费**：各子系统在对应逻辑点读取 `this.activeRunewordEffects[effectId]` 并执行效果。
5. **重置时机**：`sys_resetGame` 中重置 `this.activeRunewordEffects = {}`。

## 4. 词条与技能的解锁关系

以下词条激活后，会同时解锁对应的主动技能（在商店中可购买）：

| 词条 | 解锁技能 | 技能效果摘要 |
|---|---|---|
| 熔毁 (`runeword_meltdown`) | 熔毁新星 (`skill_meltdown_nova`) | 对所有敌人施加过热状态，温度拉至爆炸阈值的 80% |
| 绝对零度 (`runeword_absolute_zero`) | 冰牢封印 (`skill_frost_prison`) | 冻结所有敌人 3 秒，冻结期间受到的伤害提升 30% |
| 雷暴之语 (`runeword_thunderstorm`) | 雷神降临 (`skill_thunder_call`) | 对所有敌人各落一道天雷，伤害基于回合数 × 8 |
| 动能激增 (`runeword_kinetic_surge`) | 动能爆发 (`skill_kinetic_burst`) | 下一发弹珠弹跳次数上限 +15，每次弹跳伤害额外 +3 |
| 剑刃风暴 (`runeword_blade_storm`) | 剑刃雨 (`skill_blade_rain`) | 召唤 5 道飞剑同时斩击随机敌人，每道伤害为回合数 × 4 |
| 元素聚变 (`runeword_elemental_fusion`) | 棱光炮 (`skill_prismatic_shot`) | 下一发弹珠同时携带火/冰/雷三种属性，强制触发元素聚变判定 |

## 5. 词条配方元数据字段速查

> 详细规范见 `.cursor/rules/rune_system.md` 第 10.4 节。

| 字段 | 类型 | 来源词条 | 消费方 |
|---|---|---|---|
| `_scatterAngleMultiplier` | number | `multicast_to_scatter` | 散射发射逻辑 |
| `_critChance` | number (0~1) | `focused_fire` | Projectile 命中 |
| `_critDamage` | number (倍率) | `focused_fire` | Projectile 命中 |
| `_explosionRadiusMult` | number | `mass_collapse` | 爆炸 AOE 判定 |
| `_kineticDecayBonus` | number (0~1) | `kinetic_decay` | Projectile 命中 |
| `_kineticDecayRate` | number (0~1) | `kinetic_decay` | Projectile 命中 |
| `_echoShotChance` | number (0~1) | `echo_shot` | Projectile 首次命中 |
