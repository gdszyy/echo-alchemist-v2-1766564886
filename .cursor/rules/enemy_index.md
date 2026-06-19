# 敌人词缀与 Boss 索引 (Enemy Affix & Boss Index)

> **数据来源**：`src/config.js` → `balance.affixes`, `balance.bossConfigs`, `BOSS_DB`, `ENEMY_CURVE_CONFIG`；`src/spawn_system.js` → `spawn_generateAffixes()`, `spawn_trySpawnWavePreset()`, `spawn_trySpawnArchetypes()`, `spawn_scheduleNextBoss()`；`src/wave_presets.js` → `ENEMY_WAVE_PRESETS`；`src/systems.js` → `TRUTH_BOOK_DATA.enemies`
> **用途**：Agent 快速查询 8 种通用词缀、7 种 V2 基底专属词缀和 8 个 Boss 的行为机制、出现回合、破绽谱及关键代码位置。
> **最后更新**：V2 敌人视觉重设计——尺寸基底 + 专属词条体系（2026-05-02）

## 0. V2 基底专属词条总览（7 种，仅通过基底敌人附带，不进入随机词条池）

> 详见敌人视觉设计 V2 文档。所有基底专属词条均由 `spawn_trySpawnArchetypes()` 在生成大型基底敌人时一次性注入，**不会**通过 `spawn_generateAffixes()` 随机分配。

| 词条 ID | 中文名 | 绑定基底 | 默认尺寸 (cols×rows) | 最早出现回合 | 同屏上限 |
|---|---|---|---|---|---|
| `heavyArmor` | 装甲横梁 | bastion | 3×1 | R5 | 不限（每行最多 1 个大型基底） |
| `deflectionWard` | 棱盾兽 | deflector | 2×1 | R9 | 不限 |
| `echoRelay` | 共振尖塔 | echoSpire | 1×2 | R10 | 不限 |
| `devour` | 深渊胃囊 | maw | 2×2 | R12 | ≤ 2 |
| `prism` | 折光棱柱 | prism | 1×3 | R16 | 不限 |
| `hive` | 孵化巢 | hive | 2×3 | R18 | ≤ 1 |
| `siege` | 攻城履带 | siege | 3×2 | R22 | ≤ 1 |
| `gravityWell` | 引力炉心 | gravityWell | 3×3 | R30 | ≤ 1（出现时跳过其他大型基底） |

### V2 词条行为速查

| 词条 | 行为概要 | 关键代码 |
|---|---|---|
| `deflectionWard` | 屏障 = `maxHp × deflectionWardBarrierPct (=10%)`；只吸收 pierce/bounce 类伤害；普通直击、火焰 DoT、毒素 DoT 绕过；未被打破则每回合开始回满 | `enemy.js#takeDamage` 顶部分支；`game_phase.js#phase_enemy_startLogic` 重置块 |
| `echoRelay` | 每回合额外触发一次周围（半径 ≈ 1.5×width + 0.5×height）敌人的 regen/healer/clone/haste；自身 HP 倍率为 0.5；同回合每个目标只被 echo 一次（`_echoedThisTurn`） | `Enemy._echoRelayRetrigger` 静态方法；`executeTurnAction` 末尾分支 |
| `prism` | 与 shield 共用激光偏折面入口；命中伤害按 `prismLaserDeflect (=0.5)` 衰减；产生七色折射粒子 | `combat/collision.js` 激光检测；`combat_system.js` `hitType === 'prism'` 分支 |
| `hive` | 每 `hiveSpawnInterval (=2)` 回合在巢周围生成血量为自身 `hiveSpawnHpPct (=15%)` 的低血量幼体（无词条，标记 `_isHiveLarva`） | `Enemy._hiveSpawnLarva` 静态方法 |
| `siege` | 每 `siegePushInterval (=3)` 回合执行一次 `+siegePushRows (=2)` 行的额外推进 | `executeTurnAction` siege 分支 |
| `gravityWell` | 在 `gravityWellPullRadius (=220px)` 半径内对所有带速度的子弹按 `gravityWellPullStrength (=0.18)` 施加回拉力 | `projectile.js#update` 顶部块 |

### V2 基底生成流程

| 步骤 | 描述 |
|---|---|
| 1. 入口 | `spawn_spawnEnemyRowAt` 在普通敌人填充前先调用 `spawn_trySpawnWavePreset`，未命中或放置失败时再回退 `spawn_trySpawnArchetypes` |
| 2. 总体概率 | `Math.min(0.40, 0.10 + round × 0.012)` |
| 3. 候选筛选 | 排除回合数不足、同屏数量超限、`gravityWell` 在场时跳过其他大型 |
| 4. 加权抽签 | 按 `weight` 字段（`gravityWell=0.025` … `bastion=0.18`）随机一个基底 |
| 5. 位置寻找 | 洗牌列起点，逐个尝试连续 cols 列的空闲位置；失败则放弃本行 |
| 6. 实例化 | 设置 `width = cols × enemyWidth`、`height = rows × enemyHeight`、`baseArchetype`、`gridCols`、`gridRows`、专属词条、移动间隔、特效 |
| 7. 形状 | 调用 `spawn_applyArchetypeShape(e, archetypeId)` 注入语义轮廓（胃囊缺口、棱镜菱形、引力圆等） |

### V2 预设波次速查

| Preset ID | 目标回合 | 核心基底 | 说明 |
|---|---:|---|---|
| `teach_deflection_ward` | R9-R14 | deflector | 偏折屏障首次教学 |
| `bastion_wall` | R10-R20 | bastion | 横向装甲墙配后排 |
| `teach_echo_relay` | R12-R18 | echoSpire | 共振尖塔首次教学 |
| `maw_food_chain_v2` | R18-R26 | maw | 吞噬链 V2 |
| `siege_push_line` | R22-R30 | siege | 破阵履带压力 |
| `prism_refraction` | R22-R30 | prism | 折光路径干扰 |
| `hive_incubator` | R24-R34 | hive | 孵化持续压力 |
| `gravity_blackout` | R32-R42 | gravityWell | 稀有大型场控 |

## 1. 敌人词缀总览（8 种）

| 词缀 ID | 图鉴名称 | 图标 | 最早出现回合 | 掉落权重（r=15） | 克制属性 |
|---|---|---|---|---|---|
| `shield` | 护盾魔像 | 🛡️ | Round 3 | 50 | pierce（穿透）、pyro（火焰） |
| `regen` | 再生魔像 | 💚 | Round 5 | 40 | pyro（火焰）、laser（激光） |
| `healer` | 治愈魔像 | 💖 | Round 6 | 60 | lightning（闪电）、scatter（散射） |
| `haste` | 极速魔像 | ⚡ | Round 8 | 50 | cryo（冰霜） |
| `jump` | 跳跃魔像 | 🦘 | Round 9 | 60 | cryo（冰霜）、pierce（穿透） |
| `clone` | 分身魔像 | 🦠 | Round 12 | 50 | lightning（闪电）、scatter（散射）、bounce（弹跳） |
| `devour` | 贪食魔像 | 👅 | Round 12 | 40 | bounce（弹跳）、laser（激光） |
| `berserk` | 狂暴魔像 | 😡 | Round 14 | r×3（无上限） | cryo（冰霜）、pyro（火焰）（降温/升温控制） |

> **词缀数量概率**（`spawn_generateAffixes`）：0 个词缀（默认）；1 个词缀：最高 60%（r=20）；2 个词缀：最高 15%（r=20），Boss 战后临时 +25%。

## 2. 词缀行为详解

### 2.1 shield（护盾）

| 属性 | 值 |
|---|---|
| 受到的伤害倍率 | × 0.5（减伤 50%） |
| 特殊行为 | 反射激光类攻击，改变激光方向 |
| 克制方式 | 穿透（pierce）直接无视护盾；火焰（pyro）高温熔化 |
| 关键配置 | `CONFIG.balance.affixes.shieldReduction = 0.5` |
| 实现位置 | `src/combat_system.js` → `combat_damageEnemy` 伤害计算段 |

### 2.2 regen（再生）

| 属性 | 值 |
|---|---|
| 每回合回血比例 | 最大生命值的 20%（`regenPercent = 0.2`） |
| 特殊行为 | 每回合行动时自动回血，需在回合间隙造成足够伤害才能击杀 |
| 克制方式 | 激光（laser）持续伤害压制；火焰（pyro）高温爆燃一次性高伤 |
| 关键配置 | `CONFIG.balance.affixes.regenPercent = 0.2` |
| 实现位置 | `src/game_phase.js` → 回合行动逻辑 |

### 2.3 healer（治愈者）

| 属性 | 值 |
|---|---|
| 每次治疗比例 | 目标最大生命值的 12%（`healerPercent = 0.12`） |
| 治疗范围 | 自身宽度的 2 倍（`healerRange = 2`） |
| 特殊行为 | 回合行动时治疗周围友军单位（不治疗自身） |
| 克制方式 | 优先击杀治愈者；闪电链（lightning）连锁打击；散射（scatter）覆盖范围 |
| 关键配置 | `CONFIG.balance.affixes.healerPercent`, `healerRange` |
| 实现位置 | `src/game_phase.js` → `phase_enemy_startLogic` 治疗行动段 |

### 2.4 haste（极速）

| 属性 | 值 |
|---|---|
| 每回合行动次数 | 2 次（`hasteActions = 2`） |
| 特殊行为 | 每回合在正常移动后额外追加一次冲刺移动；加速仅作用于移动，不重复结算其他词缀 |
| 克制方式 | 冰霜（cryo）冻结后停止行动；减速类效果 |
| 关键配置 | `CONFIG.balance.affixes.hasteActions = 2` |
| 实现位置 | `src/game_phase.js` → `phase_enemy_startLogic` 行动次数段 |

### 2.5 jump（跳跃）

| 属性 | 值 |
|---|---|
| 跳跃距离 | 2 行（`jumpRows = 2`） |
| 特殊行为 | 当前方被阻挡时，可以直接跳过障碍物继续前进 |
| 克制方式 | 冰霜（cryo）冻结阻止跳跃；穿透（pierce）精准打击 |
| 关键配置 | `CONFIG.balance.affixes.jumpRows = 2` |
| 实现位置 | `src/game_phase.js` → 移动判定段 |

### 2.6 clone（分身）

| 属性 | 值 |
|---|---|
| 回合开始分身概率 | 50%（`cloneChanceTurn = 0.5`） |
| 受击分身概率 | 20%（`cloneChanceHit = 0.2`） |
| 特殊行为 | 分裂出复制体继承本体的所有词缀，可迅速填满战场 |
| 克制方式 | 闪电链（lightning）连锁伤害；散射（scatter）范围覆盖；弹跳（bounce）多目标 |
| 关键配置 | `CONFIG.balance.affixes.cloneChanceTurn`, `cloneChanceHit` |
| 实现位置 | `src/game_phase.js` → 回合开始段 & `src/combat_system.js` → 受击段 |

### 2.7 devour（吞噬）

| 属性 | 值 |
|---|---|
| 吞噬触发概率 | 100%（`devourChance = 1`，每回合行动时） |
| 吞噬范围 | 自身宽度的 2 倍（`devourRange = 2`） |
| 特殊行为 | 每回合行动时，有概率吞噬相邻友军单位，继承其全部血量与所有词缀，被吞噬单位立即死亡 |
| 克制方式 | 弹跳（bounce）多次弹射快速消耗；激光（laser）精准击杀 |
| 关键配置 | `CONFIG.balance.affixes.devourChance`, `devourRange` |
| 实现位置 | `src/game_phase.js` → `phase_enemy_startLogic` 吞噬行动段 |

### 2.8 berserk（狂暴）

| 属性 | 值 |
|---|---|
| 狂暴概率系数 | `Temp × 0.5`（`berserkChanceMult = 0.5`） |
| 特殊行为 | 每回合结束时自动升温 +20°C，且温度结算执行两次；过热状态下有概率触发狂暴，使本回合非移动行动额外结算一次 |
| 克制方式 | 冰霜（cryo）降温阻止狂暴触发；快速击杀 |
| 关键配置 | `CONFIG.balance.affixes.berserkChanceMult = 0.5` |
| 实现位置 | `src/game_phase.js` → 温度结算段 & 狂暴判定段 |

## 3. Boss 总览（8 个）

### 3.1 Mini-Boss（出场回合：R5 → R12 → R19 → R26，固定对齐主题段落）

| ID | 名称 | 出场回合 | 主题段落 | 词缀 | 破绽谱 | 狂暴行为 |
|---|---|---|---|---|---|---|
| `ignis` | 熔炉守卫·伊格尼斯 | **R5** | 基础教学段（shield+haste） | shield + haste | pierce、pyro | 护盾层数翻倍；每回合升温 +30°C；对周围敌人火焰溅射 |
| `glacies` | 霜晶缝合怪·格拉西斯 | **R12** | 持续压力段（regen+jump） | jump + regen | cryo、pierce | 跳跃行数增加至 3 行；跳跃落地时冻结周围 Peg |
| `mikro` | 裂变母体·米克罗 | **R19** | 群体控制段（clone+healer） | clone + healer | lightning、scatter | 分身概率提升至 100%；每个存活分身提供 10% 减伤（上限 50%） |
| `devourer` | 贪婪之渊·噬神者 | **R26** | 机制复合段（devour+shield） | devour + shield | bounce、laser | 全屏吞噬（吞噬范围 = 99） |

### 3.2 大 Boss（出场回合：R33 → R40 → R47 → R54，固定对齐主题段落）

| ID | 名称 | 出场回合 | 主题段落 | 词缀 | 破绽谱 | 狂暴行为 |
|---|---|---|---|---|---|---|
| `viridis` | 翠绿共生体·维里迪斯 | **R33** | 进阶测试段（regen+healer） | regen + healer | laser、pyro | 放弃治疗他人；自身再生速度 × 3.0 |
| `tesla` | 雷霆幻影·特斯拉 | **R40** | 速度地狱段（haste+clone） | haste + clone | cryo、bounce | 行动次数再 +1（共 4 次） |
| `chimera` | 混沌融合体·奇美拉 | **R47** | 混沌段（berserk+devour） | berserk + devour | pierce、laser | 温度直接达到阈值；受击时有 25% 概率触发全场爆炸 |
| `ouroboros` | 永恒回声·奥罗波罗斯 | **R54** | 终极考验段（全词缀轮转） | 轮转（见下） | 动态 | 词缀轮转加速：每回合切换（正常为每 3 回合） |

### 3.3 奥罗波罗斯词缀轮转规则

| 轮转组 | 词缀 | 对应破绽谱 |
|---|---|---|
| 组 0（初始） | shield + haste | pierce、cryo |
| 组 1 | regen + healer | laser、pyro |
| 组 2 | clone + jump | lightning、scatter |

**轮转间隔**：正常 3 回合切换；狂暴后每回合切换（`_berserkedRotation = true`）。

### 3.4 Boss 破绽机制（2026-06-19）

旧版 Boss 配置中的 `weakness` 字段已移除，普通波次的 `weak_spot` 低血量弱点怪也已删除。当前 Boss 对抗使用 `CONFIG.balance.bossConfigs[*].vulnerability` 与 `CONFIG.balance.bossVulnerability`：

| 状态 | 规则 |
|---|---|
| 破绽累积 | `combat_damageEnemy()` 调用 `combat_applyBossVulnerability()`；命中当前 Boss 破绽谱属性时增加 `counterHitGain` 进度。 |
| 破绽触发 | 进度达到 `breakThreshold` 后清零，写入 `_bossVulnerabilityExposedHits = exposedHits`。 |
| 易伤窗口 | 易伤命中数大于 0 时，本次伤害乘以 `exposedDamageMult`，随后消耗 1 次命中数。 |
| 狂暴延后 | 若 `enrageDelayOnBreak` 为 true 且 Boss 尚未狂暴，破绽触发后会延后一次 50% 血量狂暴检测。 |
| 可视反馈 | Boss 状态短标签显示 `隙N`（进度）或 `破N`（剩余易伤命中）；命中反馈显示 `破绽+` / `破绽` / `易伤`。 |
| 存档 | `_bossVulnerabilityProgress`、`_bossVulnerabilityExposedHits`、`_bossVulnerabilitySuppressedEnrage` 进入 `sys_saveRunState()` / `sys_loadRunState()`。 |

破绽谱速查：

| Boss | 破绽谱 |
|---|---|
| `ignis` | pierce、pyro |
| `glacies` | cryo、pierce |
| `mikro` | lightning、scatter |
| `devourer` | bounce、laser |
| `viridis` | laser、pyro |
| `tesla` | cryo、bounce |
| `chimera` | pierce、laser |
| `ouroboros` | 动态：shield+haste → pierce/cryo；regen+healer → laser/pyro；clone+jump → lightning/scatter |

## 4. Boss 出场机制（Task C.3 修正后）

> **修正说明（2026-04-19 Task C.3）**：
> - **修正前**：`spawn_scheduleNextBoss` 使用随机间隔（7~9 回合），导致 Boss 出场回合不可预测，无法与主题段落精确对齐。
> - **修正后**：改为直接读取 `ENEMY_CURVE_CONFIG.THEME_SEGMENTS[n].endRound` 作为固定出场回合，实现与八大主题段落的严格对齐。
> - **isBigBoss 修正**：阈值从 `>= 3` 改为 `>= 4`，确保 Devourer（第4个）正确识别为 Mini-Boss。
> - **BOSS_DB 修正**：chimera 的 `affixes` 补充 `berserk`，与 `bossConfigs` 保持一致。

| 参数 | 值 | 说明 |
|---|---|---|
| Boss 出场回合 | **固定**：R5/R12/R19/R26/R33/R40/R47/R54 | 由 `ENEMY_CURVE_CONFIG.THEME_SEGMENTS[n].endRound` 决定 |
| 循环延伸间隔 | 7 回合（最后两段落间隔） | 超出 8 个 Boss 时按此间隔延伸 |
| Mini-Boss 判定 | `_bossSpawnCount < 4` | 第 1-4 个 Boss 为 Mini-Boss |
| 大 Boss 判定 | `_bossSpawnCount >= 4` | 第 5-8 个 Boss 为大 Boss |
| Mini-Boss 顺序 | ignis → glacies → mikro → devourer | 固定顺序 |
| 大 Boss 顺序 | viridis → tesla → chimera → ouroboros | 固定顺序 |
| 降级回退 | 固定回合表 `[5,12,19,26,33,40,47,54]` | `ENEMY_CURVE_CONFIG` 不可用时使用 |

## 5. Boss 血量公式

```
finalHP = max(
    templateHP × floorMultiplier,
    templateHP × templateWeight + dynamicHP × dynamicWeight
)
```

| 参数 | 值 | 说明 |
|---|---|---|
| `miniBossMult` | 12 | Mini-Boss 血量倍率 |
| `bigBossMult` | 28 | 大 Boss 血量倍率 |
| `templateWeight` | 0.4 | 后期稳定值 |
| `dynamicWeight` | 0.6 | 后期稳定值 |
| `earlyDynamicWeight` | 0.85 | 前期（Round ≤ 5）动态权重 |
| `floorMultiplier` | 0.7 | 保底倍率 |

## 6. Boss 进场冲击波效果

| 参数 | 值 | 说明 |
|---|---|---|
| 波数 | 3 | 视觉冲击波圈数 |
| 词缀感染概率 | 35% | 被冲击波命中的普通敌人获得 Boss 特殊词缀 |
| 随从转化概率 | 5% | 被命中后直接转化为 Boss 随从（大 Boss +10%） |

**实现位置**：`src/spawn_system.js` → `spawn_triggerBossEntranceShockwave(boss)`

## 7. Boss 狂暴触发机制

**触发条件**：Boss 血量首次降至 50% 以下时触发（`combat_checkBossPhaseChange`）。

**触发流程**：
1. `src/combat_system.js` → `combat_checkBossPhaseChange()` 检测血量阈值
2. 广播 `EVENT_TYPES.BOSS_PHASE_CHANGE` 事件（`phase: 'berserk'`）
3. 调用 `combat_triggerBossEnrage(boss)` 根据 `bossType` 应用狂暴效果
4. 视觉反馈：红色冲击波 + 粒子 + 浮动文字 `❗ENRAGE!` + Toast 提示

**关键状态字段**：

| 字段 | 类型 | 说明 |
|---|---|---|
| `boss.berserked` | boolean | 狂暴阶段标志，防止重复触发 |
| `boss._berserkedTempRise` | number | ignis 专用：每回合升温值 |
| `boss._berserkedFireSplash` | object | ignis 专用：火焰溅射配置 |
| `boss._berserkedJumpRows` | number | glacies 专用：狂暴后跳跃行数 |
| `boss._berserkedFreezePegs` | boolean | glacies 专用：落地冻结 Peg 标志 |
| `boss._berserkedCloneChance` | number | mikro 专用：狂暴后分身概率 |
| `boss._berserkedDevourRange` | number | devourer 专用：狂暴后吞噬范围（99 = 全屏） |
| `boss._berserkedHealerRange` | number | viridis 专用：0 = 停止治疗他人 |
| `boss._berserkedSelfRegenMult` | number | viridis 专用：自身再生倍率 |
| `boss._berserkedActionsBonus` | number | tesla 专用：额外行动次数 |
| `boss._berserkedBlastOnHitChance` | number | chimera 专用：受击全场爆炸概率 |
| `boss._berserkedRotation` | boolean | ouroboros 专用：每回合轮转标志 |

## 8. 关键代码位置

| 功能 | 文件 | 方法 / 行号 |
|---|---|---|
| 词缀生成逻辑 | `src/spawn_system.js` | `spawn_generateAffixes()` |
| 词缀行为实现 | `src/game_phase.js` | `phase_enemy_startLogic()` 及各词缀分支 |
| Boss 生成 | `src/spawn_system.js` | `spawn_spawnBoss(bossId, isBigBoss)` |
| **Boss 调度（固定回合）** | `src/spawn_system.js` | `spawn_scheduleNextBoss()` — 读取 `ENEMY_CURVE_CONFIG.THEME_SEGMENTS[n].endRound` |
| Boss 回合检测 | `src/spawn_system.js` | `spawn_checkBossRoundFor(round)` |
| Boss 出场顺序 | `src/spawn_system.js` | `spawn_selectBossForRound(isBigBoss)` |
| Boss 狂暴触发 | `src/combat_system.js` | `combat_checkBossPhaseChange()` 约第 3072 行 |
| Boss 狂暴效果 | `src/combat_system.js` | `combat_triggerBossEnrage(boss)` 约第 3087 行 |
| Boss 数据配置 | `src/config.js` | `balance.bossConfigs` / `balance.bossVulnerability` |
| Boss 破绽结算 | `src/combat_system.js` | `combat_applyBossVulnerability()` / `combat_getBossVulnerabilityProfile()` |
| Boss 数据库 | `src/config.js` | `BOSS_DB` 约第 1404 行 |
| 主题段落配置 | `src/config.js` | `ENEMY_CURVE_CONFIG.THEME_SEGMENTS` 约第 1477 行 |
| 词缀图鉴 | `src/systems.js` | `TRUTH_BOOK_DATA.enemies` 第 24 行起 |
| Boss 图鉴 | `src/systems.js` | `TRUTH_BOOK_DATA` → `categoryId: 'boss'` 约第 782 行 |
