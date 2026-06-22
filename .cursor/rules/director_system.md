# 临场导演系统索引 (Live Director System)

> **数据来源**：`src/spawn_system.js`、`src/wave_presets.js`、`src/config.js`
> **用途**：记录局内导演如何根据战场状态调度普通阵型、V2 大型基底 preset、机会布局和反压制节奏。
> **适用场景**：凡修改 `spawn_getDirectorPressureProfile()`、`spawn_scoreWavePresetForDirector()`、`spawn_pickWavePreset()`、`ENEMY_WAVE_PRESETS`、`directorTags`、导演概率或早期压制节奏，必须先读本文档。
> **关联文档**：[`spawn_system.md`](spawn_system.md)、[`enemy_index.md`](enemy_index.md)、[`testing.md`](testing.md)、[`docs/enemy_wave_preset_design.md`](../../docs/enemy_wave_preset_design.md)

---

## 1. 快速入口

| 层级 | 文件 / 函数 | 职责 |
|---|---|---|
| 行生成入口 | `src/spawn_system.js` → `spawn_spawnEnemyRowAt()` | 读取压力画像，决定导演介入、机会布局、V2 preset 和普通填充 |
| 压力画像 | `spawn_getDirectorPressureProfile()` | 把当前战场压缩为 `emptyBoard`、`topPinned`、`overkill`、`dominanceLevel` 等信号 |
| preset 加权 | `spawn_scoreWavePresetForDirector(preset, profile)` | 根据 `directorTags` 与压力画像给 preset 加权 |
| preset 选择 | `spawn_pickWavePreset(options = {})` | 按回合、次数、冷却、同屏上限、压力加成抽取 V2 preset |
| preset 数据 | `src/wave_presets.js` → `ENEMY_WAVE_PRESETS` | 纯数据定义大型基底组合、回合窗、权重、标签和教学提示 |
| 普通阵型权重 | `src/config.js` → `ENEMY_CURVE_CONFIG.TEMPLATE_WEIGHTS` | 控制 `phalanx`、`blitz`、`berserk_pack` 等 1x1 通用词缀阵型 |
| 大型基底回退 | `spawn_trySpawnArchetypes()` | preset 未命中时，以旧随机方式生成单个大型基底 |

---

## 2. 调度流程

```text
spawn_spawnEnemyRowAt()
  -> spawn_getDirectorPressureProfile()
  -> 普通导演 squadType 抽取
       使用 TEMPLATE_WEIGHTS + pressureBonus
  -> Opportunity Generator
       pressure 越高，gap/checkerboard 帮助越少
  -> spawn_trySpawnWavePreset(..., { directorProfile })
       spawn_pickWavePreset()
         -> roundRange / maxUses / cooldown / 同屏大型上限
         -> directorTags + profile 加权
       spawn_findWavePresetPlacement()
       spawn_spawnWavePresetSlot()
  -> spawn_trySpawnArchetypes()
       preset 未命中时回退
  -> Fill Loop
       dominanceLevel >= 2 时 minEnemies +1
```

设计原则：导演不直接改敌人行为，不直接给全局加血加攻，而是用已有敌人职能制造不同“局面题”。

---

## 3. 压力画像信号

| 字段 | 来源 | 语义 | 当前用途 |
|---|---|---|---|
| `activeCount` | `this.enemies` | 当前存活敌人数 | 调试与后续扩展 |
| `clearableCount` | `phase_isEnemyClearable()` | 当前可被战斗击中的敌人数 | 判断是否接近空场 |
| `rowCount` | 存活敌人 Y 网格归类 | 存活敌人占用多少行 | 判断顶部压制 |
| `topPinnedCount` | `combatGridTopY + enemyHeight * 1.35` | 顶部 1-2 行敌人数 | 判断 `topPinned` |
| `activeHpBudget` | 存活敌人 `maxHp/hp` 求和 | 当前场上生命预算 | 判断伤害是否溢出 |
| `recentDamage` | `roundDamage` / `prevRoundDamage` / 近 2 回合均值 | 玩家近期输出能力 | 判断 `overkill` |
| `emptyBoard` | `clearableCount === 0` | 场上无可清敌人 | 提高导演介入 |
| `sparseBoard` | `activeCount <= 5` | 场面太稀疏 | 提高导演介入 |
| `topPinned` | 顶部敌人占比 ≥ 67% 且行数 ≤ 2 | 敌人长期被压在顶部 | 提高反压制 preset 权重 |
| `overkill` | 近期伤害 ≥ 场上 HP 预算 90% | 玩家输出明显溢出 | 提高节奏惩罚/滚雪球题权重 |
| `dominanceLevel` | 综合四类信号，0-3 | 玩家压制程度 | 驱动概率、留空扣减、最低生成数 |

扩展要求：
- 新增信号必须只读已有状态，不能在画像函数里修改游戏状态。
- 新增信号必须在本文档登记来源、语义和用途。
- 如信号依赖高频循环数据，必须确认不会引入额外遍历热点。

---

## 4. 当前调参旋钮

| 旋钮 | 位置 | 当前值 | 调整影响 |
|---|---|---:|---|
| 普通导演基础概率 | `spawn_spawnEnemyRowAt()` | `0.15 + round * 0.01` | 提高后 1x1 精英小队更常见 |
| 普通导演压力加成 | `directorPressureBonus` | `dominanceLevel * 0.06 + topPinned ? 0.04`，上限 `0.18` | 强 build 更容易触发 phalanx / blitz 等阵型 |
| 普通导演总上限 | `directorChance` | `0.52` | 防止每行都被导演占满 |
| 机会布局基础概率 | `helpChance` | `max(0.42, 0.99 - round * 0.02)` | 越高越容易留空，战斗越爽但更容易压制 |
| 机会布局压力扣减 | `helpPressureCut` | `dominanceLevel * 0.12 + topPinned ? 0.08`，上限 `0.34` | 强压制时减少缺口/棋盘帮助 |
| 机会布局最低值 | `helpChance` | `0.24` | 保留最低弹道空间，避免完全堵死 |
| 最低生成数压力加成 | `pressureMinBonus` | `dominanceLevel >= 2 ? 1 : 0` | 强压制时普通填充更满 |
| V2 preset 基础概率 | `spawn_pickWavePreset()` | `min(0.30, 0.12 + round * 0.006)` | 提高后大型基底镜头更常见 |
| V2 preset 压力概率加成 | `spawn_pickWavePreset()` | `dominanceLevel * 0.07`，上限 `0.24`，另加 `topPinned +0.06`、`emptyBoard +0.04` | 强压制时更容易进入大型基底题 |
| V2 preset 概率总上限 | `spawn_pickWavePreset()` | `0.58` | 防止大型基底过度抢占普通波次 |

调参建议：
- 觉得早期太空：先下调 `helpChance` 或上调 `pressureMinBonus`，不要先加敌人血量。
- 觉得早期太堵：先下调 `directorPressureBonus` 或 `early_bastion_brace.weight`。
- 觉得大型基底太频繁：先下调 V2 preset 概率总上限或单个 preset 的 `weight`。
- 觉得强 build 仍然无聊：优先补 `directorTags` 和 preset 权重，不新增敌人行为。

---

## 5. Preset 标签索引

`directorTags` 是 V2 preset 与压力画像之间的轻量契约。标签只影响权重，不改变敌人行为。

| 标签 | 触发倾向 | 推荐用途 | 当前 preset |
|---|---|---|---|
| `earlyPressure` | `emptyBoard` / `clearableCount <= 2` | 早期反清场过快 | `early_bastion_brace` |
| `antiCompression` | `topPinned`、空场、稀疏场 | 打破顶部压制、制造横向封锁 | `early_bastion_brace`、`teach_deflection_ward`、`bastion_wall` |
| `backlinePriority` | 空场、稀疏场 | 引导优先处理后排 | `bastion_wall` |
| `damageFilter` | `dominanceLevel >= 2` | 让玩家切换伤害路径 | `teach_deflection_ward` |
| `supportPunish` | `overkill` | 让强输出面对支援核心 | `teach_echo_relay` |
| `tempoPunish` | `overkill` | 制造倒计时压力 | `maw_food_chain_v2` |
| `snowball` | `overkill` | 引入会滚雪球的核心 | `teach_echo_relay`、`maw_food_chain_v2`、`hive_incubator` |
| `linePush` | `topPinned` | 用推进单位打破顶端僵持 | `siege_push_line` |
| `antiControl` | `dominanceLevel >= 2` | 对抗单一控制解法 | `siege_push_line` |
| `trajectoryDisrupt` | `topPinned` | 改变弹道或射线路径 | `prism_refraction`、`gravity_blackout` |
| `attrition` | `dominanceLevel >= 2` | 制造持续消耗 | `hive_incubator` |
| `fieldControl` | `topPinned` | 大型场控镜头 | `gravity_blackout` |

新增标签要求：
- 优先复用现有标签；只有确实表达不了新调度意图时才新增。
- 新标签必须同步更新本文档、`tests/validate_wave_presets.mjs` 可读性校验如有白名单化需求。
- 标签命名使用 camelCase，保持纯英文，避免与词缀 ID 混淆。

---

## 6. 扩展流程

### 新增 V2 preset

1. 在 `src/wave_presets.js` 新增 `ENEMY_WAVE_PRESETS` 条目。
2. 选择已有 `archetype` 与专属词条，不在 preset 内定义新敌人行为。
3. 设置 `roundRange`、`weight`、`maxUses`、`cooldownRounds`。
4. 添加 1-3 个 `directorTags`，说明它解决的局面。
5. 跑 `node tests/validate_wave_presets.mjs` 和 `node tests/validate_enemy_spawn_runtime.mjs`。
6. 更新本文档的 Preset 标签索引、`spawn_system.md` 和 `enemy_index.md` 速查表。

### 新增压力信号

1. 在 `spawn_getDirectorPressureProfile()` 只读计算新字段。
2. 在 `spawn_scoreWavePresetForDirector()` 明确该字段影响哪些标签。
3. 补 `tests/validate_enemy_spawn_runtime.mjs` 中的最小断言。
4. 更新本文档“压力画像信号”和“当前调参旋钮”。

### 调整概率或权重

1. 优先改数据权重：`src/wave_presets.js` 的 `weight` 或 `directorTags`。
2. 其次改压力加成：`directorPressureBonus`、`helpPressureCut`、`spawn_pickWavePreset()` 概率。
3. 最后才改敌人血量、移动、词缀行为。
4. 调参后必须记录预期影响：早期 R1-R12、中期 R13-R26、后期 R27+。

---

## 7. 测试与验收

| 场景 | 命令 | 通过条件 |
|---|---|---|
| 语法检查 | `node --check src/spawn_system.js` | 无语法错误 |
| preset 静态结构 | `node tests/validate_wave_presets.mjs` | 所有 preset 可放入 6 列，标签格式正确 |
| 运行期生成 | `node tests/validate_enemy_spawn_runtime.mjs` | 大型基底上限、压力画像、preset 路径通过 |
| 训练场结构 | `node tests/validate_scenarios.js` | 训练场索引合法 |

浏览器实机建议：
- R6-R9 强 build：确认 `early_bastion_brace` 不会每局必出，但压制明显时更容易出现。
- R9-R14：确认 `teach_deflection_ward` 首次出现仍有教学感，不被普通精英淹没。
- 清屏后连续两回合：确认 `gap/checkerboard` 帮助减少，但弹道空间仍存在。

---

## 8. 禁止事项

- 禁止在压力画像函数中修改 `this.enemies`、`this.round`、存档字段或 UI。
- 禁止让 `directorTags` 直接触发敌人行为；行为必须由敌人词缀或基底机制承担。
- 禁止绕过 `spawn_canUseWavePreset()` 的大型基底同屏上限。
- 禁止把 V2 preset 混入 `ENEMY_CURVE_CONFIG.TEMPLATE_WEIGHTS`；该表只管普通 1x1 阵型模板。
- 禁止调参后跳过 `validate_wave_presets.mjs` 与 `validate_enemy_spawn_runtime.mjs`。
- 禁止让 V2 preset 缺少 `scriptId` / `beatId`；新增 preset 必须先登记到 `DIRECTOR_SCRIPTS`，否则导演无法判断它属于哪条剧本线。

## 9. 剧本层索引（2026-06-22）

| 索引 | 位置 | 用途 |
|---|---|---|
| 剧本列表 | `src/wave_presets.js` -> `DIRECTOR_SCRIPTS` | 每条剧本线定义节拍、回合窗口、重复冷却和陌生演员预算 |
| 演员首演回合 | `DIRECTOR_ACTOR_INTRO_ROUNDS` | 词条或大型基底专属词条从哪一回合开始算“已介绍” |
| 全局预算 | `DIRECTOR_SCRIPT_CONFIG` | 控制陌生窗口、每个 preset 的陌生演员上限和默认剧本冷却 |
| 导演门禁 | `spawn_getPresetActorProfile()` / `spawn_canUseDirectorScript()` | 在抽权重前过滤回合不匹配、剧本冷却中、陌生演员超预算的 preset |
| 导演记忆 | `_directorScriptUsage` / `_directorLastScriptId` | 局内记录最近演出的剧本和节拍，随 `sys_saveRunState()` 保存恢复 |

### 9.1 当前剧本

| Script ID | 回合段 | Beat / Preset | 设计目标 |
|---|---:|---|---|
| `armor_line` | R6-R20 | `early_bastion_brace` -> `bastion_wall` | 先引入重装横梁，再组合后排保护，解决早期顶端压制 |
| `ward_filter` | R9-R14 | `teach_deflection_ward` | 单独教学反弹/穿透筛选，避免和其它新机制同时出现 |
| `support_relay` | R12-R18 | `teach_echo_relay` | 引入支援核心，训练玩家优先拆核心 |
| `maw_tempo` | R18-R26 | `maw_food_chain_v2` | 用吞噬倒计时制造节奏压力 |
| `breach_control` | R22-R30 | `siege_push_line` | 通过推线单位打破单一控场解法 |
| `trajectory_lab` | R22-R42 | `prism_refraction` -> `gravity_blackout` | 从弹道干扰过渡到大型场控核心 |
| `attrition_hive` | R24-R34 | `hive_incubator` | 引入持续增殖压力 |

### 9.2 扩展规则

1. 新增 V2 preset 必须填写 `scriptId` 和 `beatId`，并在 `DIRECTOR_SCRIPTS.beats` 中登记同一个 `presetId`。
2. `beats.roundRange` 必须与 preset 自身 `roundRange` 保持一致；静态测试会校验这一点。
3. 首演回合内同时出现的陌生词条数量不得超过 `maxUnfamiliarActors`；默认上限来自 `DIRECTOR_SCRIPT_CONFIG.maxUnfamiliarActorsPerPreset`。
4. 若新增词条或专属基底词条，需要同步补 `DIRECTOR_ACTOR_INTRO_ROUNDS`，否则导演无法判断它是否陌生。
5. 调整重复感时优先改 `repeatCooldownRounds` 或单个 preset 的 `scriptCooldownRounds`，不要用降低 `maxUses` 伪装成多样性。
