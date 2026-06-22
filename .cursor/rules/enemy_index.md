# 敌人词缀与 Boss 索引 (Enemy Affix & Boss Index)

> **数据来源**：`src/config.js` → `balance.affixes`, `balance.bossConfigs`, `BOSS_DB`, `ENEMY_CURVE_CONFIG`；`src/spawn_system.js` → `spawn_generateAffixes()`, `spawn_trySpawnWavePreset()`, `spawn_trySpawnArchetypes()`, `spawn_scheduleNextBoss()`；`src/wave_presets.js` → `ENEMY_WAVE_PRESETS`；`src/systems.js` → `TRUTH_BOOK_DATA.enemies`
> **用途**：Agent 快速查询 26 种敌人词缀（含 V2 基底专属词缀）和 8 个 Boss 的行为机制、出现回合、破绽谱及关键代码位置。
> **导演调参入口**：[`director_system.md`](director_system.md) 记录临场压力画像、preset 标签和反压制调度规则。
> **最后更新**：补齐 Mikro / Devourer 入场专属敌人机制参与、Ignis 温压流光护盾闭环与 Tesla 导体网络场强机制（2026-06-23）

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
| `deflectionWard` | 屏障 = `maxHp × deflectionWardBarrierPct (=10%)`；只吸收 pierce/bounce 类伤害；吸收 pierce 时会阻断穿透弹道，不允许继续穿过该敌人；普通直击、火焰 DoT、毒素 DoT 绕过；未被打破则每回合开始回满 | `enemy.js#takeDamage` 顶部分支；`projectile.js#_handleCollision` blockedPierce 分支；`game_phase.js#phase_enemy_startLogic` 重置块 |
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
| `early_bastion_brace` | R6-R9 | bastion | 早期反压制横向装甲教学 |
| `teach_deflection_ward` | R9-R14 | deflector | 偏折屏障首次教学 |
| `bastion_wall` | R10-R20 | bastion | 横向装甲墙配后排 |
| `teach_echo_relay` | R12-R18 | echoSpire | 共振尖塔首次教学 |
| `maw_food_chain_v2` | R18-R26 | maw | 吞噬链 V2 |
| `siege_push_line` | R22-R30 | siege | 破阵履带压力 |
| `prism_refraction` | R22-R30 | prism | 折光路径干扰 |
| `hive_incubator` | R24-R34 | hive | 孵化持续压力 |
| `gravity_blackout` | R32-R42 | gravityWell | 稀有大型场控 |

## 1. 敌人词缀总览（26 种）

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
| `radiantAegis` | 流彩护盾 | ✦ | Round 20 | 0（R20+ 低权重） | pierce（穿透）、pyro（火焰）、集中破盾 |
| `livingArmor` | 活体护甲 | 🟩 | Round 6 | 25 | pierce（穿透）、属性伤害、先破甲再爆发 |
| `armorSpore` | 护甲孢子 | 🍃 | Round 13 | 30 | 优先击杀分派者、范围伤害清护甲目标 |
| `siegeBreaker` | 撞城者 | 🧱 | Round 20 | 35 | 击退/冻结/优先击杀，防止贴线撞屏障 |
| `deflectShell` | 偏折壳 | 🔄 | Round 6 | 20 | laser（激光）、pierce（穿透）、非反弹弹道 |
| `energyArmor` | 蓄能甲 | 🔋 | Round 13 | 25 | 多段中伤、先削临时护盾 |
| `phaseShield` | 相位护盾 | 🌓 | Round 20 | 25 | 等待失效回合、失效窗口集中输出 |
| `overloadReactor` | 过量反应炉 | 🧨 | Round 20 | 30 | 控制单回合伤害节奏，避免喂行动次数 |
| `lowDamageImmune` | 低伤免疫 | 🪨 | Round 20 | 25 | 单次高伤、破阈值伤害 |
| `carrier` | 铸巢母架 | ▱ | Round 28 | 基底专属 | 优先击杀母体，清理投放小怪 |

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

### 2.9 radiantAegis（流彩护盾）

| 属性 | 值 |
|---|---|
| Boss 版自增长 | 护盾未破时，每回合开始获得 `ceil(maxHp × 0.02)` 流彩护盾 |
| Boss 版上限 | `ceil(maxHp × 0.10)`；达到上限后再次结算不再自增，改为向周围 1 格扩盾 |
| 精英版自增长 | 随机精英获得半值版本：`ceil(maxHp × 0.01)` / 回合 |
| 精英版上限 | `ceil(maxHp × 0.05)` |
| 扩盾行为 | 已满层且未破时，给周围 1 格内所有存活敌人追加 1 层标准 `shield` 护盾，并补上 `shield` 词缀用于可视与减伤语义 |
| 破盾停摆 | 流彩护盾被打空后写入 `radiantAegisBroken = true`，该敌人本局不再自增长或扩盾 |
| 关键配置 | `CONFIG.balance.affixes.radiantAegisBossRegenPct / BossCapPct / EliteRegenPct / EliteCapPct / SpreadRangeCells` |
| 实现位置 | `Enemy._initRadiantAegis()`、`Enemy._tickRadiantAegis(game)`、`Enemy._grantRadiantAegisPulse(game)`、`Enemy.takeDamage()`；回合入口在 `phase_enemy_startLogic()`；出生初始化在 `spawn_system.js` 各生成路径；Ignis 温压可直接触发一次流光脉冲 |

### 2.10 enemy-targeting affixes（敌人针对词缀组）

| 词缀 | 行为 | 关键配置 | 实现位置 |
|---|---|---|---|
| `livingArmor` | 获得最大生命 10% 的活体护甲；每个敌方回合开始回满；归零后自身不再自动恢复，但可被后续护甲孢子重新挂甲。反弹伤害先打护甲，穿透伤害会同时打护甲和本体，属性/DoT 不被代承。 | `livingArmorPct` | `Enemy._ensureLivingArmor()`、`Enemy._grantLivingArmor()`、`Enemy._restoreLivingArmorForTurn()`、`Enemy.takeDamage()` |
| `armorSpore` | 每个敌方回合给随机友军添加按分派者最大生命计算的活体护甲；目标已有活体护甲时按 50% 数值叠加。 | `armorSporeStackPct` | `Enemy._tickArmorSporeForTurn(game)` |
| `siegeBreaker` | 防线屏障伤害不再固定为 1，而是按敌人占格数计算；撞城者再乘 2。 | `siegeBreakerDamageMult` | `Enemy._getFootprintCells()`、`Enemy._getDefenseBarrierDamage(game)` |
| `deflectShell` | 仅 1×1 敌人生效；物理反弹法线持续旋转，使反弹弹道出现可读但不稳定的偏折。 | `deflectShellNormalRotateAmp`、`deflectShellNormalRotateSpeed` | `Projectile._handleCollision()` |
| `energyArmor` | 单次最终伤害超过最大生命 20% 时，只承受阈值伤害，溢出转为临时数值护盾；相位失效回合不生效。 | `energyArmorThresholdPct`、`energyArmorShieldCapPct` | `Enemy.takeDamage()` |
| `phaseShield` | 初始/新增护盾层数翻倍；每 3 个敌方回合有 1 回合所有护盾层失效，提供集中输出窗口。 | `phaseShieldMult`、`phaseShieldCycle` | `Enemy._applyPhaseShieldInitialBonus()`、`Enemy._tickPhaseShieldForTurn(game)` |
| `overloadReactor` | 本回合每累计受到最大生命 20% 的实际伤害，额外获得 1 次行动和 1 次移动，上限 3。 | `overloadStepPct`、`overloadMaxBonus` | `Enemy.takeDamage()`、`Enemy.executeTurnAction()` |
| `lowDamageImmune` | 小于最大生命 5% 的单次最终伤害无效，用于针对低伤高频流。 | `lowDamageImmunePct` | `Enemy.takeDamage()` |
| `carrier` | 五格“冂”形铸巢母架专属。3×2 编号中 1/2/3/4/6 为占格，第 5 格为空舱；若空舱被占，先将占位敌人向下推出，推不出去则跳过本次投放；每回合在第 5 格空舱投放 1 个 10% 母体生命的小型敌人，固定 `haste+jump`，继承母体一个额外词条，并在生成当回合立即执行移动。 | `carrierSpawnInterval`、`carrierSpawnHpPct`、`carrierHpMult` | `Enemy._tickCarrierForTurn()`、`Enemy._getCarrierBayPosition()`、`Enemy._pushCarrierBayOccupant()`、`Enemy._carrierLaunchDroneMovement()`、`Enemy._carrierSpawnDrone()` |

## 3. Boss 总览（8 个）

### 3.1 Mini-Boss（出场回合：R5 → R12 → R19 → R26，固定对齐主题段落）

| ID | 名称 | 出场回合 | 主题段落 | 词缀 | 破绽谱 | 狂暴行为 |
|---|---|---|---|---|---|---|
| `ignis` | 熔炉守卫·伊格尼斯 | **R5** | 基础教学段（shield+haste+radiantAegis） | shield + haste + radiantAegis | pierce、pyro | 不触发烧伤 DoT；100℃以上结算转为温压，温压满时触发流光彩护盾；狂暴后每回合升温 +30°C |
| `glacies` | 霜晶缝合怪·格拉西斯 | **R12** | 持续压力段（regen+jump） | jump + regen | cryo、pierce | 跳跃行数增加至 3 行；回合 tick / 跳跃落地在战斗场内缝合 `frostStitch` 与周围敌人，提供短暂减伤、回血和护盾；cryo 冻结下一次霜缝 tick，pierce 切断霜缝并增伤 |
| `mikro` | 裂变母体·米克罗 | **R19** | 群体控制段（clone+healer） | clone + healer | lightning、scatter | 分身概率提升至 100%；每个存活分身与入场 `fission_cell` 提供 10% 减伤（上限 50%） |
| `devourer` | 贪婪之渊·噬神者 | **R26** | 机制复合段（devour+shield） | devour + shield | bounce、laser | 全屏吞噬（吞噬范围 = 99）；若周围存在入场 `maw_thrall`，吞噬会优先选中该专属养料 |

### 3.2 大 Boss（出场回合：R33 → R40 → R47 → R54，固定对齐主题段落）

| ID | 名称 | 出场回合 | 主题段落 | 词缀 | 破绽谱 | 狂暴行为 |
|---|---|---|---|---|---|---|
| `viridis` | 翠绿共生体·维里迪斯 | **R33** | 进阶测试段（regen+healer+孢甲） | regen + healer + livingArmor + armorSpore | pyro、venom | 专属孢子侍体和治疗会累积 `viridisSporeBloom`，达到阈值为自身/侍体补活体护甲；火焰/毒素会蚀甲并削资源；狂暴后自疗并加速孢甲循环 |
| `tesla` | 雷霆幻影·特斯拉 | **R40** | 速度地狱段（haste+clone） | haste + clone | cryo、bounce | 每回合电击敌人转为导体；导体越多场强越高，场强提升行动与召唤压力 |
| `chimera` | 混沌融合体·奇美拉 | **R47** | 混沌段（berserk+devour） | berserk + devour | venom、laser | 每回合胃域吸引 +2 格敌人；吞噬胃域内所有非 Boss 敌人并继承负面状态与温度；召唤 `chaos_feed` 养料循环 |
| `ouroboros` | 永恒回声·奥罗波罗斯 | **R54** | 终极考验段（六附体轮转） | 六附体（见下） | 动态六组 | 六个附体槽每回合转位，当前前位附体授予 Boss 词缀与主机制；打满当前破绽会封印该附体并跳到下一个可用槽 |

### 3.3 奥罗波罗斯词缀轮转规则

| 附体槽 | 词缀 | 对应破绽谱 | 主机制 |
|---|---|---|
| 鳞盾附体 | shield + haste | pierce、cryo | 给 Boss 补护盾并维持高速压迫 |
| 愈合附体 | regen + healer | laser、pyro | 治疗 Boss / 轨道回声 |
| 裂群附体 | clone + shield | lightning、scatter | 召唤 `orbit_echo` 专属敌人 |
| 疾步附体 | jump + haste | cryo、bounce | 重置移动冷却并加速轨道回声 |
| 吞尾附体 | devour + regen | pierce、laser | 吞噬轨道回声，转化为回血和护盾 |
| 雷回附体 | haste + berserk | lightning、bounce | 给轨道回声充能并补少量护盾 |

**轮转间隔**：六附体每回合转位；狂暴后仍每回合转位，但 `_berserkedRotation = true` 会保留强闪反馈。当前附体被破绽打断后写入 `ouroborosOrbitStates[index].disabledTurns`，后续轮转会跳过该槽，直到封印回合耗尽。

### 3.3.1 Boss 物理轮廓（2026-06-23）

`spawn_spawnBoss()` 固定以 `3×2` 占格生成 Boss，但每个 Boss 的物理轮廓不同。当前只有最终 Boss `ouroboros` 保留环形碰撞，且是完整闭合环；`gapAngle` 只作为六附体轮转视觉锚点，不再表示可通过的物理缺口。

| Boss | `collisionShape` | 轮廓语义 |
|---|---|---|
| `ignis` | `polygon` | 顶窄底宽梯形炉体 |
| `glacies` | `polygon` | 顶尖五边形冰晶 |
| `mikro` | `polygon` | 近圆/椭圆 12 点母核实体，不是空心环 |
| `devourer` | `polygon` | 不规则 8 点巨口胃囊实体；吞噬张口只改变视觉状态，不改物理缺口 |
| `viridis` | `polygon` | 顶尖波浪五边形共生体 |
| `tesla` | `polygon` | 窄菱形导体核心 |
| `chimera` | `polygon` | 不对称五边形混沌拼合体 |
| `ouroboros` | `arc` | 完整闭合环，用于承载 6 个附体槽 |

### 3.4 Boss 破绽机制（2026-06-22）

旧版 Boss 配置中的 `weakness` 字段已移除，普通波次的 `weak_spot` 低血量弱点怪也已删除。当前 Boss 对抗使用 `CONFIG.balance.bossConfigs[*].vulnerability` 与 `CONFIG.balance.bossVulnerability`：

| 状态 | 规则 |
|---|---|
| 破绽累积 | `combat_damageEnemy()` 先调用 `combat_applyBossVulnerability()` 判断当前破绽谱与暴露回合，再在 `Enemy.takeDamage()` 后调用 `combat_updateBossVulnerabilityProgress()` 按实际命中次数或实际伤害量推进进度。 |
| 破绽触发 | 进度达到 `breakThreshold` 后清零，写入 `_bossVulnerabilityExposedTurns = exposedTurns`，并记录 `_bossVulnerabilityExposedPart`、`_bossVulnerabilityVisualAttrs` 与 `_bossVulnerabilityBreakTimer`。 |
| 易伤窗口 | 暴露回合数大于 0 时，本次伤害乘以 `exposedDamageMult`；该值不按命中消耗，而是在 Boss 即将行动时消耗 1 回合。 |
| 停摆行动 | `Enemy.startTurnAction()` 在 Boss 物理状态机、预警、治疗、吞噬、移动和 Ouroboros 轮转前消费暴露回合；Boss 跳过本次行动并进入恢复闭合视觉。 |
| 回合缩放 | 从 `roundScalingStart` 起，每 `roundScalingStep` 回合提高一次条件；`hits` 模式增加命中次数，`damage` 模式增加最大生命百分比阈值。 |
| 狂暴延后 | 若 `enrageDelayOnBreak` 为 true 且 Boss 尚未狂暴，破绽触发后会延后一次 50% 血量狂暴检测。 |
| 可视反馈 | 命中飘字不再显示 `破绽+` / `破绽` / `易伤`；Boss 身体通过 `_drawBossVulnerabilityOverlay()` 显示属性痕迹、弱点部位、爆开、暴露和恢复。状态短标签统一显示 `隙XX%` 或 `破N`。 |
| 存档 | `_bossVulnerabilityProgress`、`_bossVulnerabilityVisualRatio`、`_bossVulnerabilityVisualAttrs`、`_bossVulnerabilityExposedTurns`、`_bossVulnerabilityExposedPart`、`_bossVulnerabilitySuppressedEnrage`、`_bossVulnerabilityMode`、`_bossVulnerabilityThreshold` 与 break/recover 计时进入 `sys_saveRunState()` / `sys_loadRunState()`；旧 `_bossVulnerabilityExposedHits` 仅做兼容。 |

首版视觉规划见 [`docs/boss_vulnerability_visual_plan.md`](../../docs/boss_vulnerability_visual_plan.md)，PNG 资产契约见 [`docs/boss_vulnerability_asset_contract.md`](../../docs/boss_vulnerability_asset_contract.md)。当前代码已接入低成本 Canvas fallback 与透明 PNG Overlay fallback loader，后续可按同一状态阶梯补正式资产。

### 3.5 Boss 入场专属敌人（2026-06-22）

`spawn_triggerBossEntranceShockwave(boss)` 不再只给普通敌人随机追加一条 Boss 主题词缀。命中冲击波并走随从分支时，会优先读取 `CONFIG.balance.bossEntranceShockwave.bossMinionProfiles[bossId]`：

| 字段 | 说明 |
|---|---|
| `bossOwnerId` | 该敌人归属的 Boss ID，如 `ignis` / `tesla` / `chimera` |
| `bossMinionRole` | 机制角色，如 `furnace_guard`、`conductor`、`chaos_feed` |
| `bossMechanicTags` | 后续 Boss 机制识别用标签，如 `furnacePressure`、`teslaConductor`、`chaosFeed` |
| `affixes` | 该 Boss 专属敌人的词缀画像；Ignis 当前为 `shield + radiantAegis`，Mikro 当前为 `clone + healer`（`fission_cell`，计入母体分裂减伤），Devourer 当前为 `devour + shield`（`maw_thrall`，吞噬优先目标），Viridis 当前为 `regen + healer + armorSpore`（孢子侍体），Tesla 当前为 `clone`（被电击或 lightning 命中后临时获得 `haste`），Chimera 当前为 `berserk`（volatile feed，不再带 `devour`），Ouroboros 当前为 `shield + haste + regen`（轨道回声） |

强化分支也会写入 `bossOwnerId`，但 `bossMinionRole` 使用 `boss_empowered`，用于区分“完全转化的专属敌人”和“被冲击波强化的普通敌人”。这些字段已进入 `sys_saveRunState()` / `sys_loadRunState()`。

### 3.6 Ignis 温压（2026-06-22）

Ignis 的火焰对抗语义是“点燃炉心压力”，不是普通烧伤：

| 规则 | 行为 |
|---|---|
| 火焰命中 | 仍通过 `applyTemp()` 升温，但 `combat_system.js` 会跳过 Burn 额外火伤分支，只显示“炉心升温”反馈 |
| 100℃以上回合结算 | `phase_enemy_processTurn()` 将 `temp - 100` 加上基础增量转为 `furnacePressure`，不调用 `takeDamage(dot)` 和 `playBurnTickEffect()` |
| 温压满 | 达到 `bossConfigs.ignis.furnacePressureThreshold` 时调用 `Enemy._grantRadiantAegisPulse()`，触发一次流光彩护盾；若 Ignis 的流光护盾已破，可由温压重新点亮 |
| 冰霜反制 | cryo 命中和负温结算会按配置比例降低 `furnacePressure` |
| 可视状态 | 敌人状态短标签显示 `压XX%`，流光护盾继续显示 `彩XX%` |

### 3.7 Tesla 导体网络（2026-06-22）

Tesla 的速度语义改为“导体网络正反馈”，不再只是固定行动次数高：

| 规则 | 行为 |
|---|---|
| Boss 每回合电击 | `Enemy._tickTeslaNetwork(game)` 在 Tesla 正常行动前电击随机非 Boss 敌人，造成 `teslaShockDamage` 点伤害并调用 `_applyTeslaConductorCharge()`，将其标记为 `bossOwnerId='tesla'` / `teslaConductor` 并临时获得 `haste` |
| 导体供能 | 场上 Tesla 专属导体按 `teslaConductorFieldGain` 提升 `teslaFieldPower`；已充能或带 `haste` 的导体额外提供 `teslaChargedConductorBonus` |
| 场强收益 | `teslaFieldPower` 有 `teslaFieldPowerMax` 上限和 `teslaFieldDecay` 回合衰减；每达到 `teslaFieldActionStep` 会给 Tesla 增加额外行动次数，上限 `teslaFieldActionBonusMax` |
| 场强召唤 | Tesla 每回合把当前场强累积进 `_teslaSummonCharge`，达到 `teslaSummonThreshold` 时在非重叠格子生成 `conductor`，受 `teslaSummonMaxPerTurn` 与 `teslaMaxConductors` 限制 |
| lightning 交互 | 玩家 lightning 或雷电护盾 AOE 命中 Tesla 导体时，导体获得 `haste` 并按 `teslaLightningFieldGain` 反向供能给 Tesla |
| cryo 反制 | cryo 命中 Tesla 会按 `teslaCryoFieldDrain` 泄场；cryo 命中导体会清除由 Tesla 机制授予的临时 `haste` |
| bounce 反制 | 发生 bounce 命中 Tesla 时按 `teslaBounceFieldDrain` 降低场强，并设置 `_teslaGroundedTurns`，接地期间网络收益乘以 `teslaGroundedGainMult` |
| 视觉 | Tesla / 导体绘制紫白短电弧，状态短标签显示 `电XX%` 或 `导N`；召唤与电击复用 shockwave、spark 和浮字预算 |

### 3.8 Viridis 孢子活甲网络（2026-06-22）

Viridis 不再只是高血量治疗 Boss，而是围绕 `livingArmor` / `armorSpore` 形成“召唤越稳、护甲越厚、护甲越厚越能保护召唤物”的正反馈网络：

| 规则 | 行为 |
|---|---|
| 入场专属敌人 | Boss 入场冲击波可把敌人转化为 `bossOwnerId='viridis'` / `bossMinionRole='spore_vassal'` / `bossMechanicTags=['sporeArmor']` 的孢子侍体，词缀为 `regen + healer + armorSpore` |
| 孢甲资源 | Viridis 每回合按基础值与存活孢子侍体数量累积 `viridisSporeBloom`；自身再生和治疗友军也会额外累积 |
| 补甲爆发 | `viridisSporeBloom` 达到 `sporeArmorThreshold` 后，优先给周围侍体/友军补 `livingArmor`；已有活甲目标会叠加，狂暴后目标数提高 |
| 非反制破甲 | 若活甲被非火毒伤害打碎，破甲会反哺 Viridis 一段孢甲资源，并可能立刻给其他目标补甲 |
| 火毒反制 | `pyro` / `venom` 命中 Viridis 或孢子侍体会直接侵蚀活甲、降低 `viridisSporeBloom` 并施加短暂腐蚀；`venom` 还会补毒层 |
| 破绽谱 | Viridis 的 Boss 破绽谱为 `pyro` / `venom`，累积方式仍为实际伤害量 |
| 视觉 | Viridis 与孢子侍体绘制黄绿孢甲环、少量孢点与 `孢N` / `腐N` 状态短标签；施加和破甲反馈复用 shockwave、spark 与浮字预算 |

### 3.9 Chimera 胃域循环（2026-06-22）

Chimera 的混沌语义改为“吸入、消化、继承代价”，不再只是初始高温或受击爆炸：

| 规则 | 行为 |
|---|---|
| 胃域范围 | `chimeraMawRangeCells = 2`，以 Boss 体积外扩 +2 格扫描非 Boss 敌人 |
| 胃域吸引 | `Enemy._tickChimeraMawField(game)` 在 Chimera 正常行动前触发，调用 `_chimeraAttractPrey()` 将范围内目标向 Boss 移动一格 |
| 安全落点 | 吸引使用战斗网格列 / 行并调用 `calc_isAreaOccupied(..., excludeEnemy)`，找不到合法空格时不移动，禁止重叠 |
| 胃域吞噬 | 消化冷却归零且范围内有目标时，`_selectTurnIntent()` 预告 `chimera_maw`；执行时 `_chimeraDevourTargets()` 吞噬 +2 格范围内所有非 Boss 目标 |
| 状态继承 | 吞噬会把目标 `temp` 相加到 Chimera，并继承 `venomStacks`、`swordMarks` / `markTimer`、`frozenCount`、当前冻结标记、`_irradiationStacks`、`phaseShieldDisabledThisTurn` 等负面状态字段 |
| 养料召唤 | `_chimeraSpawnFeeders()` 按 `chimeraSummonInterval` 与 `chimeraMaxFeeders` 在非重叠格子召唤 `bossOwnerId='chimera'` / `bossMinionRole='chaos_feed'` / `bossMechanicTags=['chaosFeed']` 的专属敌人 |
| 上限与节奏 | 召唤每回合最多 `chimeraSummonMaxPerTurn`，场上养料最多 `chimeraMaxFeeders`；吞噬后进入 `chimeraDigestInterval`，狂暴时使用 `chimeraBerserkDigestInterval` |
| 视觉 | Chimera 绘制紫青胃域环、向内短线和 `MAW feed/status` 标识；状态短标签显示 `胃N/M`，拉拽与吞噬复用浮字、shockwave 和少量粒子预算 |

### 3.10 Ouroboros 六附体轮转（2026-06-23）

Ouroboros 的终局语义从“三组词缀轮换”升级为六个附体槽位围绕本体旋转：

| 规则 | 行为 |
|---|---|
| 六附体槽 | `CONFIG.balance.bossConfigs.ouroboros.orbitAttachments` 定义 6 个附体，每个附体包含 `id/name/icon/affixes/attrs/action/color` |
| 每回合转位 | `Enemy._tickOuroborosOrbit(game)` 在 Boss 正常行动入口触发；当前槽生效后，下一回合转到下一个未封印槽 |
| 当前词缀 | `_applyOuroborosAttachment()` 把当前附体的 `affixes` 写入 Boss 本体，因此普通行动、预警、状态短标签和破绽谱都随槽位变化 |
| 附体主机制 | `_performOuroborosAttachmentAction()` 处理护盾、治疗、召唤、位移、吞噬、加速六类压力；召唤只生成少量 `orbit_echo`，并走非重叠格子检查 |
| 打断附体 | Boss 破绽满格时 `combat_updateBossVulnerabilityProgress()` 调用 `_interruptOuroborosAttachment()`；当前槽被封印若干回合，轮转立即跳到下一个可用槽 |
| 视觉 | 本体环外绘制 6 个小节点，当前槽放大高亮，下一槽次高亮，封印槽划线；状态短标签显示 `附X` 与累计 `断N` |
| 存档 | `ouroborosOrbitStates`、`ouroborosOrbitDisruptions`、`_ouroborosOrbitInitialized` 与既有 `rotationIndex` / `rotationTurnCount` 一起保存和恢复 |

破绽谱速查：

| Boss | 破绽谱 | 累积方式 |
|---|---|
| `ignis` | pierce、pyro | 命中次数，基础 3 次 |
| `glacies` | cryo、pierce | 实际伤害量，基础 10% 最大生命 |
| `mikro` | lightning、scatter | 命中次数，基础 5 次 |
| `devourer` | bounce、laser | 实际伤害量，基础 8% 最大生命 |
| `viridis` | pyro、venom | 实际伤害量，基础 12% 最大生命 |
| `tesla` | cryo、bounce | 命中次数，基础 4 次 |
| `chimera` | venom、laser | 实际伤害量，基础 9% 最大生命 |
| `ouroboros` | 动态六组：鳞盾 pierce/cryo；愈合 laser/pyro；裂群 lightning/scatter；疾步 cryo/bounce；吞尾 pierce/laser；雷回 lightning/bounce | 动态：命中次数 / 实际伤害量按附体配置切换 |

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
| `boss._glaciesBerserkSeamBoost` | boolean | glacies 专用：狂暴后强化战斗场霜缝；不再写入 Peg 冻结 |
| `enemy.frostSeamTurns` | number | glacies 霜缝目标专用：剩余缝合回合，期间非 cryo / pierce 命中被减伤 |
| `boss._berserkedCloneChance` | number | mikro 专用：狂暴后分身概率 |
| `boss._berserkedDevourRange` | number | devourer 专用：狂暴后吞噬范围（99 = 全屏） |
| `boss._berserkedHealerRange` | number | viridis 专用：0 = 停止治疗他人 |
| `boss._berserkedSelfRegenMult` | number | viridis 专用：自身再生倍率 |
| `boss.viridisSporeBloom` | number | viridis 专用：孢子活甲资源，达到阈值后为孢子侍体/自身补活体护甲 |
| `boss._viridisBerserkSporeArmor` | boolean | viridis 专用：狂暴后提高孢甲补甲目标数和回合收益 |
| `enemy._viridisSporeCorrodedTurns` | number | viridis / 孢子侍体专用：火毒反制后的腐蚀回合，降低孢甲收益 |
| `boss._berserkedActionsBonus` | number | tesla 专用：额外行动次数 |
| `boss.teslaFieldPower` | number | tesla 专用：导体网络当前场强 |
| `boss._teslaSummonCharge` | number | tesla 专用：场强累积召唤进度 |
| `enemy._teslaChargedTurns` | number | tesla 导体专用：临时 haste / 充能剩余回合 |
| `boss._berserkedBlastOnHitChance` | number | chimera 兼容旧狂暴爆炸字段；当前核心机制以胃域吸引 / 吞噬为主 |
| `boss.chimeraFeedStacks` | number | chimera 专用：已吞噬养料 / 敌人的累计层数 |
| `boss.chimeraInheritedStatusCount` | number | chimera 专用：吞噬继承的负面状态累计显示层 |
| `boss._chimeraDigestCooldown` | number | chimera 专用：胃域吞噬冷却 |
| `boss._chimeraSummonCooldown` | number | chimera 专用：养料召唤冷却 |
| `boss._berserkedRotation` | boolean | ouroboros 专用：每回合轮转标志 |
| `boss.ouroborosOrbitStates` | Array | ouroboros 专用：六附体槽状态，记录封印回合与被打断次数 |
| `boss.ouroborosOrbitDisruptions` | number | ouroboros 专用：累计打断附体次数，状态短标签显示为 `断N` |
| `boss._ouroborosOrbitInitialized` | boolean | ouroboros 专用：首回合不跳过初始鳞盾附体的初始化标记 |

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
| Boss 破绽结算 | `src/combat_system.js` | `combat_applyBossVulnerability()` / `combat_updateBossVulnerabilityProgress()` / `combat_getBossVulnerabilityProfile()` |
| Boss 数据库 | `src/config.js` | `BOSS_DB` 约第 1404 行 |
| 主题段落配置 | `src/config.js` | `ENEMY_CURVE_CONFIG.THEME_SEGMENTS` 约第 1477 行 |
| 词缀图鉴 | `src/systems.js` | `TRUTH_BOOK_DATA.enemies` 第 24 行起 |
| Boss 图鉴 | `src/systems.js` | `TRUTH_BOOK_DATA` → `categoryId: 'boss'` 约第 782 行 |
## 2026-06-22 Boss 数值调整

- Boss 狂暴触发阈值统一为 `CONFIG.balance.bossEnrageHpRatio = 0.2`，即 20% HP；`combat_checkBossPhaseChange()`、狂暴符文掉落和破绽延后狂暴均读取该配置。
- `ignis`：`moveInterval` 从 2 调整为 3，`hpMult = 1.08`，通过 `spawn_spawnBoss()` 乘入生成血量。
- `glacies`：`regenPercentOverride = 0.12`，Boss 专属 regen 覆盖普通 `CONFIG.balance.affixes.regenPercent = 0.2`；`frostSeam*` 参数控制战斗场霜缝目标数、持续、减伤、回血与 cryo / pierce 反制。
## 附：导演剧本调度提示

V2 preset 不再只按 `roundRange` 和权重抽取；所有 preset 均需通过 `DIRECTOR_SCRIPTS` 的 `scriptId` / `beatId` 调度，并受剧本冷却与陌生演员预算限制。修改 preset、专属词条首演回合或导演权重时，需同步阅读 [`director_system.md`](director_system.md)。
