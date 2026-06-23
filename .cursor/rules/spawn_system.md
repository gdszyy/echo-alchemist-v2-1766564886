# 生成系统规范 (Spawn System)

> **数据来源**：`src/spawn_system.js` → `spawn_spawnEnemyRowAt()`
> **文件**：`src/spawn_system.js` | **总行数**：~2183 | **函数数**：28
> **索引**：[auto_index/src_spawn_system_js_index.md](auto_index/src_spawn_system_js_index.md)
> **用途**：记录导演系统（The Director）所有阵型模板的设计意图、触发条件和实现细节。
> **临场导演索引**：[`director_system.md`](director_system.md) 记录压力画像、preset 标签、反压制调参旋钮、扩展流程与测试入口。
> **最后更新**：Boss 顺序预测与 UI 预告共用 `src/utils/boss_schedule_utils.js`，`spawn_selectBossForRound()` 仍是唯一写入 `bossHistory` 的入口（2026-06-23）

---

## 1. 导演系统概述

导演系统（The Director）在每次 `spawn_spawnEnemyRowAt()` 调用时，以一定概率生成精英小队或 V2 大型基底预设波次，提升游戏难度并引导玩家学习特定战术。2026-06-22 起，导演会先通过 `spawn_getDirectorPressureProfile()` 读取场上压制信号，再调节介入概率、机会生成器留空概率、最低填充数量和 preset 权重。

| 参数 | 值 | 说明 |
|---|---|---|
| 触发概率 | `min(0.52, 0.15 + round × 0.01 + pressureBonus)` | 随回合数线性增长；玩家明显压制时追加压力加成 |
| 选型机制（Task B.3 起） | `ENEMY_CURVE_CONFIG.TEMPLATE_WEIGHTS` 权重调度 | 根据当前段落的权重池随机选择模板 |
| 实现位置 | `spawn_spawnEnemyRowAt` → `@section:spawn_enemy_type_select` (L285) | |

### 1.1 局内压力画像（2026-06-22）

`spawn_getDirectorPressureProfile()` 只读取现有战场状态，不新增敌人机制。它输出以下信号：

| 信号 | 判定用途 |
|---|---|
| `emptyBoard` / `sparseBoard` | 场上可清敌人太少或敌人数 ≤ 5，说明玩家正在压制，减少早期留空并提高导演介入 |
| `topPinned` | 存活敌人集中在顶部 1-2 行，优先提高 anti-compression / line-push 类 preset 权重 |
| `overkill` | 本回合或近两回合伤害超过场上敌人生命预算，优先引入 support / tempo / snowball 类组合题 |
| `dominanceLevel` | 0-3 档综合压制等级，驱动导演概率、机会生成器 `helpChance` 扣减和 `minEnemies +1` |

压力画像的目标是避免初期强 build 把敌人长期压在顶部后只剩单调清场；它不会直接加血加攻，而是优先调度已有敌人职能。

### 1.2 V2 大型基底预设波次（2026-06-19）

`src/wave_presets.js` 新增首批 `ENEMY_WAVE_PRESETS`，用于把 V2 大型基底从“纯随机大型单位”推进到“关键回合导演镜头”：

- 入口：`spawn_spawnEnemyRowAt()` 在随机大型基底前先调用 `spawn_trySpawnWavePreset()`。
- 选择：`spawn_pickWavePreset()` 根据 `roundRange`、`scriptId` / `beatId`、剧本重复冷却、陌生演员预算、`weight`、`maxUses`、`cooldownRounds`、同屏大型上限和每回合一次限制抽取。
- 放置：`spawn_findWavePresetPlacement()` 按 `center` / `left` / `right` / `side` lane 找连续 footprint；失败时整个 preset 放弃并回退旧随机生成。
- 实例化：`spawn_spawnWavePresetSlot()` 复用 `Enemy`、`spawn_applyArchetypeShape()`、掉落判定与 Sprite 初始化，不另开实体规则。
- 局内持久化：`_wavePresetUsage`、`_wavePresetIntroShown`、`_wavePresetRoundUsed`、`_directorScriptUsage`、`_directorLastScriptId` 会随局内存档保存/恢复，新开局重置。

首批 preset：

| Preset ID | 回合 | 核心组合 | 目标 |
|---|---:|---|---|
| `early_bastion_brace` | R6-R9 | `bastion(3×1)` + 普通敌人 | 早期反顶部压制，教学横向装甲封锁 |
| `teach_deflection_ward` | R9-R14 | `deflector(2×1)` + 普通敌人 | 教学偏折屏障 |
| `bastion_wall` | R10-R20 | `bastion(3×1)` + healer | 横向装甲墙 + 后排 |
| `teach_echo_relay` | R12-R18 | `echoSpire(1×2)` + regen | 教学共振尖塔 |
| `maw_food_chain_v2` | R18-R26 | `maw(2×2)` + 两侧喂食单位 | 强化吞噬链 |
| `siege_push_line` | R22-R30 | `siege(3×2)` + shield 护卫 | 破阵履带压力 |
| `prism_refraction` | R22-R30 | `prism(1×3)` + 普通敌人 | 射线路径干扰 |
| `hive_incubator` | R24-R34 | `hive(2×3)` + 护卫 | 持续产怪压力 |
| `carrier_launch_deck` | R28-R40 | `carrier(5格冂形)` | 铸巢母架每回合从第 5 格空舱投放急速跳跃小怪 |
| `gravity_blackout` | R32-R42 | `gravityWell(3×3)` | 稀有大型场控 |

---

## 2. 阵型模板总览

### 2.0 普通行机会布局（2026-06-19）

`spawn_spawnEnemyRowAt()` 的 Opportunity Generator 只保留两类轻量读线辅助：

| 布局 | 行为 | 说明 |
|---|---|---|
| `gap` | 随机留空一列 | 给弹道提供穿行入口。 |
| `checkerboard` | 按奇偶列留空 | 降低密度并制造弹射/穿透路径。 |

旧 `weak_spot` 低血量无词缀敌人已移除。Boss 对抗改由 `combat_system.js` 的 Boss 破绽机制承担，普通敌人行不再生成“弱点怪”。`spawn_spawnBoss()` 生成 Boss 时必须初始化破绽视觉状态字段（`_bossVulnerabilityVisualRatio`、`_bossVulnerabilityVisualAttrs`、`_bossVulnerabilityExposedTurns`、`_bossVulnerabilityExposedPart`、`_bossVulnerabilityBreakTimer`、`_bossVulnerabilityRecoverTimer`），避免旧存档或复用对象残留上一阶段破绽表现。

### 2.0.1 Boss 入场专属敌人（2026-06-22）

`spawn_triggerBossEntranceShockwave(boss)` 的随从转化优先读取 `CONFIG.balance.bossEntranceShockwave.bossMinionProfiles[bossId]`，而不是只使用函数内的兜底词缀池。配置画像包含：

| 字段 | 用途 |
|---|---|
| `role` | 写入 `enemy.bossMinionRole`，用于 Boss 机制识别具体职能 |
| `affixes` | 完全转化为 Boss 专属随从时覆盖使用的词缀组合 |
| `tags` | 写入 `enemy.bossMechanicTags`，供后续 Tesla 导体、Chimera 养料、Ouroboros 附体等机制复用 |

`spawn_applyBossMinionMetadata(e, bossId, profile, roleOverride)` 是唯一写入 Boss 专属敌人元数据的入口。随从分支使用画像中的 `role`，强化分支使用 `boss_empowered` 作为角色。字段已进入局内存档，后续 Boss 机制不得用临时字符串散落判断“谁的随从”。

Tesla 的 `conductor` 入场画像当前只给 `clone`，不直接给 `haste`。导体的 `haste` 必须来自 Tesla 回合电击或玩家 lightning 命中，便于玩家通过 `导N` / `电XX%` 状态短标签读出网络充能过程。

### 2.0.2 Boss 物理轮廓与美术合同（2026-06-23）

`spawn_spawnBoss()` 会为 8 个 Boss 写入固定 `collisionShape/collisionData`。这些轮廓同时是弹珠碰撞范围和 Boss 本体/破绽 Overlay 资产生成边界，必须与 `docs/boss_sprite_redraw_asset_contract.md`、`docs/boss_vulnerability_asset_contract.md` 和 `assets/sprites/bosses/redraw_drafts/boss_collision_guides_v2_no_three_rings_384x256.png` 保持一致。旧同名图 `boss_collision_guides_384x256.png` 已归档，后续不要继续引用，避免预览缓存显示旧三环轮廓。

| Boss | 运行时碰撞 | 说明 |
|---|---|---|
| `ignis` | 顶窄底宽梯形 `polygon` | 炉门/盾铰链沿梯形边界展开 |
| `glacies` | 顶尖五边形 `polygon` | 冰晶背脊对齐顶点 |
| `mikro` | 近圆/椭圆 12 点 `polygon` | 母核实体，不再是环 |
| `devourer` | 不规则 8 点巨口 `polygon` | 张口/吞噬是视觉状态，不再改变物理缺口 |
| `viridis` | 顶尖波浪五边形 `polygon` | 藤蔓可沿边，但主体仍贴合斜边 |
| `tesla` | 窄菱形 `polygon` | 残影和电弧不能扩大实体宽度 |
| `chimera` | 不对称五边形 `polygon` | 异质核心可不对称，底部落点保留 |
| `ouroboros` | 完整闭合圆弧 `arc` | 唯一环形 Boss；外圈承载 6 个附体槽，`gapAngle` 只作为视觉锚点 |

### 2.0.3 Boss 顺序预测与预告（2026-06-23）

`src/utils/boss_schedule_utils.js` 提供 Boss 调度的纯读取工具：`normalizeBossKey()`、`getBossOrder()`、`predictBossIdFromHistory()` 与 `getNextBossRoundPreview()`。这些函数只读取 `bossHistory`、`_nextBossRound`、`_bossSpawnCount`、`_lastBossSpawnRound` 和 `ENEMY_CURVE_CONFIG.THEME_SEGMENTS`，不得写入游戏状态。

`spawn_selectBossForRound(isBigBoss)` 是唯一允许把选中的 Boss 追加到 `bossHistory` 的入口；UI 的 `#combat-next-threat` 只能调用纯工具做倒计时和未知剪影预告，禁止为了预览调用 `spawn_selectBossForRound()`。

| 阵型 ID | 名称 | 最早回合 | 教学目标 | 常量引用 |
|---|---|---|---|---|
| `phalanx` | 方阵突击 | Round 1 | 护盾 + 治愈协同，引导穿透/闪电 | `DIRECTOR_TEMPLATE_PHALANX` |
| `blitz` | 闪电战 | Round 6 | 双词缀边路突袭，引导冰霜控制 | `DIRECTOR_TEMPLATE_BLITZ` |
| `berserk_pack` | 狂暴群 | Round 12 | 高温狂暴，引导冰霜降温 | 内联 |
| `jumper_pack` | 跳跃群 | Round 8 | 跳跃阻挡，引导穿透精准 | 内联 |
| `swarm_core` | 增殖核心 | Round 12 | AOE 清场后集火核心 | 内联 |
| `food_chain` | 吞噬链 | Round 12 | 倒计时压力，在 devour 吞噬前打破阵型 | 内联 |
| `thermal_bomb` | 过热炸弹 | Round 14 | 训练玩家使用冰霜符文紧急降温控制 | 内联 |

---

## 3. 权重调度系统（Task B.3 新增）

**Task B.3 起**，模板选择从随机候选列表改为基于 `ENEMY_CURVE_CONFIG.TEMPLATE_WEIGHTS` 的权重调度：

```javascript
const segIdx = getThemeSegment(this.round, ENEMY_CURVE_CONFIG);
const tplWeights = ENEMY_CURVE_CONFIG.TEMPLATE_WEIGHTS[segIdx];
// 构建权重池，按权重随机选择模板
```

- `getThemeSegment(round, config)` 函数位于 `src/utils/math_utils.js`，根据当前回合数返回对应的段落索引（0-based）。
- 权重为 0 的模板不会出现；未达到最低回合数的模板也会被排除。

### 各段落模板权重分布

权重数据存储在 `ENEMY_CURVE_CONFIG.TEMPLATE_WEIGHTS`（`src/config.js`），与 `THEME_SEGMENTS` 一一对应：

| 段落 | 回合 | phalanx | blitz | berserk_pack | jumper_pack | swarm_core | food_chain | thermal_bomb |
|------|------|---------|-------|-------------|------------|-----------|-----------|-------------|
| 基础教学段 | R1-R5 | 60 | 0 | 0 | 0 | 0 | 0 | 0 |
| 持续压力段 | R6-R12 | 40 | 40 | 0 | 20 | 0 | 0 | 0 |
| 群体控制段 | R13-R19 | 20 | 30 | 30 | 20 | 0 | 0 | 0 |
| 机制复合段 | R20-R26 | 15 | 25 | 25 | 20 | 0 | 0 | 15 |
| 进阶测试段 | R27-R33 | 10 | 20 | 30 | 15 | 0 | 0 | 25 |
| 速度地狱段 | R34-R40 | 5 | 35 | 20 | 20 | 0 | 0 | 20 |
| 混沌段 | R41-R47 | 5 | 20 | 20 | 15 | 0 | 0 | 40 |
| 终极考验段 | R48-R54 | 10 | 20 | 25 | 15 | 0 | 0 | 30 |

> **注**：`swarm_core` 和 `food_chain` 当前在权重表中为 0，通过权重池的 `(tplWeights.swarm_core || 0) > 0` 判断接入，未来可在 `TEMPLATE_WEIGHTS` 中为其分配权重。V2 preset 不进入 `TEMPLATE_WEIGHTS`，由 `src/wave_presets.js` 的 `DIRECTOR_SCRIPTS`、`DIRECTOR_ACTOR_INTRO_ROUNDS`、`roundRange`、`weight`、`directorTags` 和压力画像共同调度。新增 preset 需先登记剧本，避免同局连续重复同一剧本或同时引入多个陌生词条。2026-06-22 第二批仅保留 `carrier_pressure` 剧本，服务铸巢母架第 5 格空舱投放与推出压力。

---

## 4. 阵型模板详解

### 4.1 phalanx（方阵突击）[Task B.1 增强]

**常量定义**：`DIRECTOR_TEMPLATE_PHALANX`（`src/spawn_system.js` 顶部）

```
列:  [0]   [1]   [2]   [3]   [4]   [5]
     🛡️    🛡️   (可选🛡️)  空   💖   (可选💖)
     前排 shield 高血量        后排 healer 低血量
     ←── frontCount(2-3) ──→  ←── backCount(1-2) ──→
```

| 属性 | 值 |
|---|---|
| 前排组成 | 2-3 个 shield 高血量（1.5x-1.8x，随机） |
| 后排组成 | 1-2 个 healer 低血量（0.6x-0.8x，随机） |
| 列布局 | 前排左对齐（从列 0 起），后排右对齐（从最右列起） |
| 克制方式 | pierce（穿透）无视护盾；lightning（闪电）连锁打断治愈 |
| 教学目标 | 引导玩家优先击杀后排 healer 治愈者，而非硬刚前排盾牌 |

### 4.2 blitz（闪电战）[Task B.1 增强]

**常量定义**：`DIRECTOR_TEMPLATE_BLITZ`（`src/spawn_system.js` 顶部）

```
列:  [0]   [1]   [2]   [3]   [4]   [5]
     ⚡🦘  (普通) (普通)  空    空   ⚡🦘
     haste+jump 双词缀              haste+jump 双词缀
     边缘威胁                        边缘威胁
```

| 属性 | 值 |
|---|---|
| 边缘组成 | 列 0 和列 (cols-1) 各 1 个 **haste+jump 双词缀**低血量（0.7x） |
| 中间组成 | 1-2 个普通敌人，标准血量（1.0x），无强制词缀 |
| 列布局 | 边缘固定列 0 和 cols-1，中间随机选 1-2 列 |
| 克制方式 | cryo（冰霜）同时克制 haste（冻结行动）和 jump（阻止跳跃） |
| 教学目标 | 训练玩家识别并优先击杀两侧双词缀威胁单位，应对边路突袭 |

### 4.3 berserk_pack（狂暴群）

| 属性 | 值 |
|---|---|
| 组成 | 1 个 berserk 中血量（1.2x） |
| 克制方式 | cryo（冰霜）降温阻止狂暴 |

### 4.4 jumper_pack（跳跃群）

| 属性 | 值 |
|---|---|
| 组成 | 1 个 jump 低血量（0.8x） |
| 克制方式 | pierce（穿透）精准打击 |

### 4.5 swarm_core（增殖核心）[Task B.2 新增]

| 属性 | 值 |
|---|---|
| 组成 | 1 个 clone 高血量（1.8x）核心 + 周围 3 个普通低血量（0.4x）护卫 |
| 列布局 | 核心随机列，护卫分布在核心 ±1、±2 列（优先填满） |
| 触发条件 | round >= 12，权重表中 swarm_core 权重 > 0 时出现 |
| 教学目标 | 引导玩家优先 AOE 清场周围护卫，再集火 clone 核心（防止 clone 分裂扩散） |
| 克制方式 | lightning（闪电链）连锁清场；scatter（散射）范围覆盖；bounce（弹跳）多目标 |

**设计注意**：clone 词缀在回合开始有 50% 概率分裂，受击有 20% 概率分裂。若不优先清场，护卫会迅速填满战场，核心的分裂体也会继承 clone 词缀，造成雪崩效应。

### 4.6 food_chain（吞噬链）[Task B.2 新增]

| 属性 | 值 |
|---|---|
| 组成 | 1 个 devour 高血量（2.0x）+ 前排 2 个 shield/regen 低血量（0.5x） |
| 列布局 | devour 随机列，shield（0.5x）在 devour -1 列，regen（0.5x）在 devour +1 列（依次尝试 ±1、±2） |
| 触发条件 | round >= 12，权重表中 food_chain 权重 > 0 时出现 |
| 教学目标 | devour 每回合行动时吞噬相邻友军，继承其血量与词缀。玩家必须在 devour 吞噬前排之前打破阵型，否则 devour 会越来越强 |
| 克制方式 | bounce（弹跳）多次弹射快速消耗；laser（激光）精准击杀 devour |

**设计注意**：前排 shield 有减伤 50% 效果，regen 每回合回血 20% 最大血量。玩家需要在 devour 行动前快速击破前排，否则 devour 吞噬后会继承 shield/regen 词缀，变得极难击杀。

### 4.7 thermal_bomb（过热炸弹）[Task B.3 新增]

| 属性 | 值 |
|---|---|
| 组成 | 1-2 个 berserk 词缀敌人（HP×1.3），初始温度 56-72°C |
| 生成数量 | R14-R19：1 个；R20+：50% 概率 2 个 |
| 列布局 | 随机列，多个时避免重叠 |
| 触发条件 | round >= 14，权重表中 thermal_bomb 权重 > 0 时出现 |
| 教学目标 | 训练玩家使用冰霜符文紧急降温控制，防止 berserk 词缀触发狂暴 |
| 克制方式 | cryo（冰霜）降温是唯一有效手段 |

**技术细节**：
- berserk 狂暴触发条件：`Math.random() < (temp / 100) * berserkChanceMult`（默认 `berserkChanceMult = 0.5`）
- 初始温度 56-72°C，第一个回合升温 +20°C 后进入 76-92°C 高概率狂暴区（temp=80 时概率 40%）
- 通过 `addPreset` 的 `extraInit.temp` 字段传递初始温度，在 `pendingSpawns` 实例化阶段写入 `e.temp`

---

## 5. addPreset 辅助函数

```javascript
const addPreset = (col, hpMult, forceAffixes, extraInit) => {
    if (col >= 0 && col < CONFIG.gameplay.enemyCols && !occupiedCols[col]) {
        pendingSpawns.push({ col, hp: Math.floor(baseHP * hpMult), affixes: forceAffixes, extraInit });
        occupiedCols[col] = true; // 导演占座
    }
};
```

- `col`：列索引（0-based，总列数 = `CONFIG.gameplay.enemyCols = 6`）
- `hpMult`：相对于 `baseHP` 的血量倍率
- `forceAffixes`：强制词缀数组（覆盖 `spawn_generateAffixes` 的随机结果，空数组 `[]` 表示无词缀）
- `extraInit`（Task B.3 新增）：额外初始化参数对象，如 `{ temp: 64 }` 用于设置初始温度
- 导演生成的敌人统一存入 `pendingSpawns`，在**第 4 步**统一实例化，确保不与填充循环冲突

---

## 6. 战后高压因子联动机制（Task C.2）

### 6.1 机制概述

Boss 被击杀后，游戏进入**战后高压期**，持续 3 个回合。在此期间，`spawn_generateAffixes` 中双词缀精英怪的出现概率临时提升 **25%**，增加战斗压力，形成 Boss 击杀后的紧张感。

### 6.2 数据流

```
BOSS_DEFEATED 事件触发
    ↓
core.js: _setupEventListeners()
    this.postBossRoundsLeft = 3
    ↓
每回合结算: game_phase.js: phase_finalizeRound()
    if (this.postBossRoundsLeft > 0) this.postBossRoundsLeft--
    ↓
敌人生成: spawn_system.js: spawn_generateAffixes()
    const postBossBonus = (this.postBossRoundsLeft > 0) ? 0.25 : 0;
    const effectiveChance2 = Math.min(chance2 + postBossBonus, 0.40);
```

### 6.3 关键字段

| 字段 | 类型 | 初始值 | 说明 |
|------|------|--------|------|
| `this.postBossRoundsLeft` | `number` | `0` | 战后高压期剩余回合数，Boss 击杀时设为 3，每回合结算递减 |

### 6.4 与现有 postBossMultiplier 的关系

| 字段 | 控制目标 | 初始值 | 衰减方式 |
|------|---------|--------|---------|
| `postBossMultiplier` | 敌人 HP 倍率 | 1.3 | 每回合 -0.1，归零后恢复 1.0 |
| `postBossSurgeRoundsLeft` | HP 倍率持续回合数 | 3 | 每回合 -1 |
| `postBossRoundsLeft` | 双词缀精英概率提升 | 3 | 每回合 -1，归零后概率恢复正常 |

---

## 7. spawn_generateAffixes 词缀生成规则

### 7.1 数量概率

| 词缀数 | 基础概率 | 战后高压加成 |
|--------|---------|------------|
| 0 个 | 默认（1 - chance1 - chance2） | 无 |
| 1 个 | `min(0.6, 0.05 + round * 0.025)` | 无 |
| 2 个 | `r > 10 ? min(0.15, (r-10)*0.01) : 0` | `+0.25`（上限 0.40） |

### 7.2 词缀权重池

| 词缀 | 解锁回合 | 权重规则 |
|------|---------|---------|
| `shield` | r >= 3 | r < 8: 100, r >= 8: 50 |
| `regen` | r >= 5 | r < 12: 80, r >= 12: 40 |
| `healer` | r >= 6 | 稳定 60 |
| `haste` | r >= 8 | r < 15: 70, r >= 15: 50 |
| `jump` | r >= 9 | 稳定 60 |
| `clone` | r >= 12 | 稳定 50 |
| `devour` | r >= 12 | 稳定 40 |
| `berserk` | r >= 14 | `r * 3`（无上限，后期极危险） |
| `radiantAegis` | r >= 20 | R20-R26: 12，R27-R33: 18，R34-R40: 22，R41-R47: 30，R48+: 35；随机精英获得半值版流彩护盾 |

---

## 8. 修改规范

- 新增阵型时，必须在 `@section:spawn_enemy_type_select` 区域的权重池构建段添加条目
- 阵型实例化逻辑必须在 `if-else` 链末尾追加，不得修改现有阵型逻辑
- 新增阵型必须同步在 `ENEMY_CURVE_CONFIG.TEMPLATE_WEIGHTS`（`src/config.js`）中为各段落分配权重
- 修改后必须运行 `code-indexer` 单文件更新索引
- 必须在本文档中同步更新阵型说明
- **严禁全量读取** `src/spawn_system.js`（2183+ 行大文件），必须通过索引精准定位
- **严禁手动编辑** `.cursor/rules/auto_index/src_spawn_system_js_index.md`
- **严禁删除** `@section` 标记（`spawn_enemy_type_select`、`spawn_position_calc`、`spawn_entity_init`）
- **严禁**在 `spawn_generateAffixes` 中直接修改 `this.postBossRoundsLeft`，该字段由 `phase_finalizeRound` 统一递减

## 9. 研磨命中反馈入口

`spawn_createHitFeedback(x, y, velocity, type = 'normal', options = {})` 用于研磨阶段 Peg/Slot 命中后的能量球反馈。第五个参数仅控制 `EnergyOrb` 的视觉参数，例如 `secondary`、`baseSize`、`trailAlpha`、`maxTrailLen`；到达回调、充能计数和 `phase_gathering_attemptComplete()` 语义不得在视觉调整中绕开或删除。

- 普通 Peg 的额外二次反馈应传入 `{ secondary: true }`，避免多颗能量球抢占弹珠本体。
- 新增高亮事件时，优先通过 options 调整现有 `EnergyOrb`，不要在 `spawn_createHitFeedback()` 内新增未受控粒子或冲击波。
