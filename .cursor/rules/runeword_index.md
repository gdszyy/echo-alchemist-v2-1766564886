# 词条索引 (Runeword Index)

> **数据来源**：`src/rune_config.js` → `RUNEWORD_DB`
> **用途**：Agent 快速查询所有词条的 ID、名称、符文组合、效果描述及实现位置，无需全量读取 `rune_config.js`。
> **Spell Form V1**：表中的“符文组合”按法术公式解释；默认 `pattern[1]` 为中心核心符文，必须位于 3×3 中心格，`pattern[0]` / `pattern[2]` 为外环试剂，必须位于同一条穿心轴线两端（可反向）。

## 1. 词条总览（23 个）

### 1.1 元素专属词条（7 个）

| ID | 名称 | 符文组合 | 效果摘要 | 解锁技能 |
|---|---|---|---|---|
| `runeword_meltdown` | 熔毁 | `rune_pyro_1` × 2 + `rune_pyro_2` | 火焰燃烧伤害与过热爆炸最终伤害提升 | 熔毁新星 |
| `runeword_absolute_zero` | 绝对零度 | `rune_cryo_1` × 2 + `rune_cryo_2` | 冰冻状态下每次物理伤害令该敌人本回合受到的所有伤害加深 | 冰牢封印 |
| `runeword_frost_nova` | 冰霜新星 | `rune_cryo_1` × 1 + `rune_bounce_1` × 1 + `rune_cryo_2` × 1 | 弹珠每弹跳数次释放冰霜新星，造成冰属性伤害并降温 | 冰霜新星 |
| `runeword_thunderstorm` | 雷暴之语 | `rune_lightning_1` × 2 + `rune_lightning_2` | 闪电链的伤害衰减系数提升 | 雷神降临 |
| `runeword_thunder_scatter` | 雷霆散射 | `rune_lightning_1` × 1 + `rune_scatter_1` × 1 + `rune_lightning_2` × 1 | 每次成功触发闪电链时，有概率额外释放一条同属性闪电链 | — |
| `runeword_kinetic_surge` | 动能激增 | `rune_bounce_1` × 2 + `rune_bounce_2` | 本次发射的弹珠，后续每次弹射伤害固定增加 | 动能爆发 |
| `runeword_irradiation` | 照射 | `rune_laser_1` × 2 + `rune_laser_2` | 激光变为持续照射，累积照射同一敌人伤害加深 | 辐照领域 |

### 1.2 复合机制词条（6 个）

| ID | 名称 | 符文组合 | 效果摘要 |
|---|---|---|---|
| `runeword_flame_sword` | 炎光剑影 | `rune_pyro_1` × 1 + `rune_pierce_1` × 1 + `rune_pyro_2` × 1 | 子母飞剑/普通子弹穿透时在命中点生成火焰剑光 AOE 伤害（非爆炸），并对范围内敌人额外升温 |
| `runeword_armor_piercing_meteor` | 穿甲流星 | `rune_pierce_2` × 1 + `rune_scatter_1` × 1 + `rune_pierce_1` × 1 | 散射出的子弹丸继承 100% 的穿透层数；每级散射子弹伤害额外 +15%；与炎光剑影联动时散射子弹也可触发剑光 |
| `runeword_blazing_beam` | 炽热光线 | `rune_pyro_1` × 1 + `rune_laser_1` × 1 + `rune_laser_2` × 1 | 激光照射敌人时，每 0.5 秒额外提升敌人温度 |
| `runeword_lightning_shield` | 雷电护盾 | `rune_lightning_2` × 1 + `rune_bounce_2` × 1 + `rune_bounce_1` × 1 | 弹珠弹射时有概率在自身周围生成静电场 |
| `runeword_blade_storm` | 剑刃风暴 | `rune_pierce_1` × 1 + `rune_pierce_2` × 1 + `rune_scatter_1` × 1 | 首个子弹定期对范围内所有敌人生成一次剑光斩击 | 
| `runeword_elemental_fusion` | 元素聚变 | `rune_pyro_2` × 1 + `rune_cryo_2` × 1 + `rune_lightning_2` × 1 | 当敌人同时承受火、冰、雷三种状态时，引发元素聚变爆炸 |

### 1.3 特殊变异词条（2 个）

| ID | 名称 | 符文组合 | 效果摘要 |
|---|---|---|---|
| `runeword_sword_resonance` | 剑意共鸣 | `rune_pierce_1` × 3 | 解锁飞剑变异；穿透弹珠碰撞穿透钉子时有70% 概率变异为飞剑钉子 |
| `runeword_storm_resonance` | 风暴共鸣 | `rune_bounce_1` × 3 | 解锁风属性变异；反弹弹珠碰撞反弹钉子时有70% 概率变异为风属性钉子 |

### 1.4 特殊召唤词条（2 个：召剑之语 / 化弹为剑）

| ID | 名称 | 符文组合 | 效果摘要 |
|---|---|---|---|
| `runeword_son_sword_summon` | 召剑之语 | `rune_pierce_2` × 1 + `rune_pierce_1` × 1 + `rune_bounce_1` × 1 | 弹珠每次命中敌人时，有 7% 概率在命中位置召唤一把三级子飞剑；子飞剑继承弹珠属性（火/冰/雷）；词条等级提升时概率额外 +3%、子飞剑伤害额外 +7% |
| `runeword_bullet_to_sword` | 化弹为剑 | `rune_pierce_1` × 2 + `rune_bounce_1` × 1 | 首轮发射的子弹被替换为一把子飞剑（取消连射），原连射层数转化为子飞剑攻击次数（maxAttacks = multicast + 1）；词条等级 1/2/3 对应子飞剑 Lv1/Lv2/Lv3 |

### 1.5 成长型低级词条（6 个，Task A 新增）

| ID | 名称 | 符文组合 | 效果摘要 |
|---|---|---|---|
| `runeword_bloodthirst_edge` | 嗜血初锋 | `rune_pierce_1` × 2 + `rune_pyro_1` × 1 | 每次击杀敌人，全局基础伤害永久 +1；冰霜与火焰属性层数降低 30% |
| `runeword_scatter_matrix` | 散射矩阵 | `rune_bounce_1` × 2 + `rune_lightning_1` × 1 | 连射次数全部转化为散射层数；基础伤害降低 25%，散射夹角缩小 70% |
| `runeword_focused_fire` | 专注射击 | `rune_cryo_1` × 2 + `rune_pierce_1` × 1 | 将所有弹跳和连射层数转化为基础伤害；伤害有 20% 概率暴击造成 200% 伤害（不再依赖激光符文） |
| `runeword_mass_collapse` | 质量坍缩 | `rune_bounce_1` × 2 + `rune_pyro_1` × 1 | 强制获得爆炸属性（范围减半）；只清空所有散射层数（连射保留），每清空 1 层散射爆炸范围 +10% |
| `runeword_kinetic_decay` | 动能衰变 | `rune_bounce_1` × 2 + `rune_pierce_1` × 1 | 子弹初始获得 25% 伤害加成；每次命中后加成乘以 (1 - 7%) 衰减（最低衰减至 0%） |
| `runeword_echo_shot` | 回响射击 | `rune_scatter_1` × 2 + `rune_bounce_1` × 1 | 子弹首次击中敌人时，有 25% 概率按原角度额外发射一颗单发子弹 |

## 1.6 技能系统总览（技能来源扩展）

> **数据来源**：`src/config.js` → `SKILL_DB`（共 19 个技能）。
> **核心入口**：`combat_recomputeActiveSkills(opts)`（`src/combat_system.js`）—— 计算四类来源
> 并集（技能池 `unlockedSkills`）→ 维护装配（`equippedSkillIds`，≤4）→ 推导 `activeSkills`（技能栏内容）
> → 维护 `skill_point` 槽与技能栏/SP/编辑器入口显隐。任意来源变化（放符文/拾遗物/商店买/局开始）都应调用它。

技能效果分发：原 6 个走 `combat_activateSkill` 的 if/else 链；新增 13 个集中在
`combat_activateSkillExtended(skill, p, method)`（同文件），由前者末尾兜底调用。

### 技能来源（4 类，共 19 个）

| 来源 (`source`) | 解锁条件 | 数量 | 技能 |
|---|---|---|---|
| `base` | 每局常驻（保证 SP 永远有去处） | 2 | 奥术飞弹、蓄能填装 |
| `runeword` | 对应 `unlockRuneword` 词条激活 | 11 | 冰牢封印/雷神降临/动能爆发/熔毁新星/剑刃雨/棱光炮（原）+ 冰霜新星/辐照领域/炎光剑舞/静电力场/精准齐射（新） |
| `relic` | 拥有 `unlockRelic` 遗物（`effect:'unlock_skill'`） | 3 | 引力坍缩(`relic_gravity_core`)、时滞冻结(`relic_chrono_shard`)、不死鸟祝福(`relic_phoenix_feather`) |
| `shop` | 局内商店购买（写入 `purchasedSkillIds`，`shopPrice` 定价） | 3 | 陨石轰击、棱镜超载、财富打击 |

视觉层级：`combat_getSkillVisualTier()` 将 `base` 技能归为 `default`，将 `runeword` / `relic` / `shop` 技能归为 `premium`；默认技能只播放轻量点火，高价值技能会追加双段点火与有限目标铭刻脉冲。该层级仅影响表现，不改变技能来源或装配池。

### 技能装配（loadout）

- **技能池 `unlockedSkills`**：四类来源并集，可超过 4 个。**装备 `equippedSkillIds`**：玩家选择进入战斗技能栏的子集（≤ `CONFIG.gameplay.maxEquippedSkills`，默认 4，受锁定的 2×2 布局约束）。`activeSkills` = 池中已装备项（按装备顺序），即技能栏渲染/可释放的内容。
- **自动装备**：新解锁技能若有空位则自动装备；满 4 个时进池不装备，并**强制弹出技能编辑器**（`ui_openSkillEditor({forced:true})`）让玩家取舍。
- **卸下可重装**：编辑器里「卸下」的技能仍留在池中，可随时重装；用 `_seenSkillIds`（上次池快照）避免把手动卸下的技能反复自动装回。词条技能随符文重排动态增减，离开池时自动从装备中剔除。
- **编辑器 UI**：`src/ui/rune_launcher.js` 的 `ui_openSkillEditor / ui_closeSkillEditor / ui_renderSkillEditor / ui_toggleEquipSkill`；DOM 为 `index.html#skill-editor-overlay` + 顶栏入口 `#skill-editor-open-btn`；样式在 `src/styles/bitmap_ui.css`。入口按钮随时可开。

状态字段（均持久化于局存档）：`equippedSkillIds`、`purchasedSkillIds`、`_seenSkillIds`、`_activeRunewordIds`；`unlockedSkills`/`activeSkills` 为运行时派生不持久化。

### 技能图鉴（真理之书内）

- 真理之书（`TruthBook`）新增「主动技能」分类（`TRUTH_BOOK_CATEGORIES` 的 `skill`）。
- 条目由 `buildSkillCodexEntries()`（`src/systems.js`）从 `SKILL_DB` 动态生成，与 `core` 条目同构（纯说明 + 日志循环演示，无敌人 setup）。每条展示：图标、名称、SP 消耗、来源/解锁条件标签、效果描述。新增/修改技能会自动出现在图鉴，无需手动维护。

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
| `flame_sword` | 炎光剑影 | `src/combat_system.js` 约第 1762 行 | `activeRunewordEffects['flame_sword']`，参数：`triggerChance`, `damageRatio`, `tempDamageRatio`；注意：当 `armor_piercing_meteor` 激活时，散射子弹（`isScatterChild=true`）也可触发 |
| `armor_piercing_meteor` | 穿甲流星 | `src/spawn_system.js` 约第 1000 行（散射子弹生成）；`src/combat_system.js` 约第 1762 行（炎光剑影联动） | `activeRunewordEffects['armor_piercing_meteor']`；联动：`config.isScatterChild && armorPiercingActive` 放开炎光剑影触发限制 |
| `blazing_beam` | 炽热光线 | `src/combat_system.js` 激光照射循环 | `activeRunewordEffects['blazing_beam']` |
| `lightning_shield` | 雷电护盾 | `src/combat_system.js` 约第 1776 行 | `activeRunewordEffects['lightning_shield']`；触发时直接对半径 100px 内敌人造成 AOE 伤害（`config.damage * damageRatio`）并施加 `shockStacks` 层感电（`applyTemp`），配合 `LightningBolt` + `spawn_createShockwave` 视觉特效 |
| `blade_storm` | 剑刃风暴 | `src/combat_system.js` `combat_bladeStorm_update` | `activeRunewordEffects['blade_storm']` |
| `elemental_fusion` | 元素聚变 | `src/combat_system.js` 元素状态判定 | `activeRunewordEffects['elemental_fusion']` |
| `flying_sword_unlock` | 剑意共鸣 | `src/spawn_system.js` 钉子变异逻辑 | `activeRunewordEffects['flying_sword_unlock']` |
| `wind_unlock` | 风暴共鸣 | `src/spawn_system.js` 钉子变异逻辑 | `activeRunewordEffects['wind_unlock']` |
| `bloodthirst_growth` | 嗜血初锋 | `src/combat_system.js` 约第 2037 行、2320 行 | `activeRunewordEffects['bloodthirst_growth']`, `game.runewordKillCount`（跨回合持久，仅在 `sys_resetGame` 中重置） |
| `multicast_to_scatter` | 散射矩阵 | `src/combat_system.js` 约第 2340 行（配方应用） | `activeRunewordEffects['multicast_to_scatter']` |
| `focused_fire` | 专注射击 | `src/combat_system.js` 约第 1714 行（暴击判定）、2358 行（配方应用） | `activeRunewordEffects['focused_fire']`, `finalRecipe._critChance`, `finalRecipe._critDamage` |
| `mass_collapse` | 质量坍缩 | `src/combat_system.js` 约第 2375 行（配方应用） | `activeRunewordEffects['mass_collapse']`, `finalRecipe._explosionRadiusMult` |
| `kinetic_decay` | 动能衰变 | `src/entities/projectile.js` 命中逻辑 | `activeRunewordEffects['kinetic_decay']`, `finalRecipe._kineticDecayBonus`, `finalRecipe._kineticDecayRate` |
| `echo_shot` | 回响射击 | `src/entities/projectile.js` 首次命中逻辑 | `activeRunewordEffects['echo_shot']`, `finalRecipe._echoShotChance`, `projectile._echoShotFired` |
| `son_sword_summon` | 召剑之语 | `src/combat_system.js` `combat_damageEnemy` 命中后处理段 | `activeRunewordEffects['son_sword_summon']`；params 包含 `triggerChance`/`swordLevel`/`damageMultiplier`，触发时调用 `combat_flyingSword_addSon(hitX, hitY, null, 3, swordConfig, 0)` + `combat_flyingSword_assignTarget(enemy)`；子飞剑伤害 = `bullet.damage × damageMultiplier` |
| `flame_sword` | 炎光剑影 | `src/combat_system.js` 约第 1762 行（穿透命中后段） | `activeRunewordEffects['flame_sword']`；改为生成 AOE 伤害（非爆炸）：在命中点对 `radius` 范围内敌人造成 `damage × damageRatio` 火属性伤害并升温 `damage × tempDamageRatio` |
| `mass_collapse` | 质量坍缩 | `src/combat_system.js` 约第 2483 行（配方应用） | `activeRunewordEffects['mass_collapse']`；只清空 `finalRecipe.scatter`（连射保留），`_explosionRadiusMult = baseRadiusRatio + scatter × radiusBonusPerLayer` |
| `lightning_shield` | 雷电护盾 | `src/combat_system.js` 约第 1791 行 | `activeRunewordEffects['lightning_shield']`；静电场对范围内敌人造成 AOE 伤害并施加感电；命中后**强制以 `chainChanceBonus = 1.0` 调用 `combat_lightning_triggerChain`**，必定触发闪电链 |
| `frost_nova` | 冰霜新星 | `src/combat_system.js` `combat_triggerFrostNova`；`src/entities/projectile.js` 弹跳 hook | `activeRunewordEffects['frost_nova']`；命中敌人按其当前 `freezeChance = min(100, abs(temp))/2` 链式触发新星，`probMult` 每次链式调用减半，`chainDepth ≤ 8` 安全上限 |
| `bullet_to_sword` | 化弹为剑 | `src/combat_system.js` 约第 2510 行（recipe 注入）；`src/spawn_system.js` `spawn_spawnBullet` 入口处理 | `activeRunewordEffects['bullet_to_sword']`；写入 `_replaceWithSonSword=true`、`_sonSwordLevel=level`，并在 burst 调度处跳过多重射击；spawn_spawnBullet 入口检测后调用 `combat_flyingSword_addSon` + 自动猎杀 |

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
| 动能激增 (`runeword_kinetic_surge`) | 动能爆发 (`skill_kinetic_burst`) | 下一发弹珠弹跳次数上限 +15，每次弹跳伤害额外 +3；当前消耗 2 SP |
| 剑刃风暴 (`runeword_blade_storm`) | 剑刃雨 (`skill_blade_rain`) | 召唤 5 道飞剑同时斩击随机敌人，每道伤害为回合数 × 4 |
| 元素聚变 (`runeword_elemental_fusion`) | 棱光炮 (`skill_prismatic_shot`) | 下一发弹珠同时携带火/冰/雷三种属性，强制触发元素聚变判定 |

## 5. 词条配方元数据字段速查

> 详细规范见 `.cursor/rules/rune_system.md` 第 10.4 节。

| 字段 | 类型 | 来源词条 | 消费方 |
|---|---|---|---|
| `_scatterAngleMultiplier` | number | `multicast_to_scatter` | 散射发射逻辑 |
| `_critChance` | number (0~1) | `focused_fire` | `combat_damageEnemy`（约第 1714 行）|
| `_critDamage` | number (倍率) | `focused_fire` | `combat_damageEnemy`（约第 1714 行）|
| `_explosionRadiusMult` | number | `mass_collapse` | 爆炸 AOE 判定 |
| `_kineticDecayBonus` | number (0~1) | `kinetic_decay` | Projectile 命中 |
| `_kineticDecayRate` | number (0~1) | `kinetic_decay` | Projectile 命中 |
| `_echoShotChance` | number (0~1) | `echo_shot` | Projectile 首次命中（回响子弹中此字段强制为 0，防止无限循环） |
| `_echoShotFired` | boolean | `echo_shot` | Projectile 实例内部标记（非 recipe 字段），防止同一子弹重复触发 |
| `_pierceDecayReduction` | number (0~1) | 穿透共鸣 (T2/T3) | 全局穿透衰减消费段（`combat_damageEnemy` 约第 1530 行）：每次穿透命中伤害衰减 35%（最低 15%），`pierceDecayReduction` 减小衰减率 |
| `_replaceWithSonSword` | boolean | `bullet_to_sword` | `spawn_spawnBullet` 入口判断；触发后改为生成一把 SonSword 而非常规弹丸 |
| `_sonSwordLevel` | number (1~3) | `bullet_to_sword` | `spawn_spawnBullet` 入口；对应生成的子飞剑等级（词条等级 → 子飞剑 Lv） |
## 2026-06-22 新增属性词条补充

| effectId | 词条名称 | 主要实现位置 | 关键状态字段 |
|---|---|---|---|
| `toxic_bloom` | 毒花绽放 | `src/combat_system.js` 剧毒命中段 | `finalRecipe._toxicBloom`：`radius` / `spreadStacks` / `bonusStacks` |
| `overload_core` | 超载核心 | `src/entities/projectile.js` `_detonateOvercharge()` | `finalRecipe._overloadRadiusBonus`, `finalRecipe._overloadDamageMult` |
| `echo_chamber` | 回响腔体 | `src/entities/projectile.js` `_tryTriggerEchoBullet()` | `finalRecipe._echoChamberChanceBonus`, `finalRecipe._echoChamberInheritBonus` |

三条词条对应最新加入的 `venom`、`overcharge`、`echo` 子弹属性；定义位于 `src/rune_config.js` 的 `RUNEWORD_DB`，并由 `combat_fireNextShot()` 写入最终子弹配方。
