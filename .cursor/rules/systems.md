# 游戏系统与试炼场规范 (systems.js)

> 最后更新：修复 `systems.js` 遗漏导入 `EVENT_TYPES` 导致 TrainingGround.enter() 抛出 ReferenceError 的 Bug。已将第 17 行的 `import { eventBus }` 补全为 `import { eventBus, EVENT_TYPES }`。

本文档定义了 `src/systems.js` 中包含的核心子系统规范，重点涵盖 **试炼场 (TrainingGround)** 和 **真理之书 (TruthBook)** 的架构约定与场景化配置扩展方法。

## 1. 模块职责边界

`systems.js` 包含两个主要的独立子系统，均采用组合模式（Composition）挂载到全局 `Game` 实例上：
*   `TrainingGround` (`game.trainingGround`)：试炼场系统，提供沙盒环境测试敌人词缀、子弹属性与 Boss 机制。
*   `TruthBook` (`game.truthBook`)：真理之书系统，提供游戏内图鉴与机制说明。

## 2. 试炼场场景化配置 (TrainingGround)

试炼场采用 **数据驱动的场景化配置架构**，所有场景定义在 `TRAINING_SCENARIOS` 常量中。后续 Agent 若需新增或修改测试场景，**仅需修改数据结构，无需改动 UI 逻辑**。

### 2.1 场景数据结构契约

新增场景必须在 `TRAINING_SCENARIOS.scenarios` 数组中添加符合以下契约的对象：

```javascript
{
    id: 'unique_scenario_id',    // [必填] 全局唯一标识符
    categoryId: 'enemy',         // [必填] 所属分类（'enemy' | 'attribute' | 'boss'）
    name: '场景显示名称',          // [必填] 右侧边栏显示的按钮文本
    icon: '🛡️',                  // [可选] 按钮前缀图标（Emoji）
    desc: '场景说明文字',          // [可选] 右下角显示的机制说明
    
    // [核心] 初始状态布置钩子
    setup: (game) => {
        // 在此调用 game.spawn_spawnEnemy 或 game.spawn_spawnBoss
        // 坐标参考：
        // 中心：x = game.width / 2, y = game.height / 2
        // 网格对齐：使用 game.enemyWidth 和 game.enemyHeight
    },
    
    // [可选] 预置子弹配置（覆盖默认面板）
    bulletConfig: { 
        damage: 30, 
        bounce: 0, 
        pierce: 0, 
        isLaser: false,
        // ... 其他属性
    },
    
    // [可选] 点击“触发演示”按钮时执行的动作
    demoAction: (game, trainingGround) => {
        // 示例：触发敌人行动波
        // game.phase_enemy_startLogic();
        // 示例：自动发射子弹
        // game.spawn_spawnBullet(x, y, vel, config);
    }
}
```

### 2.2 试炼场 UI 渲染机制（防坑指南）

*   **DOM 动态生成**：`#phase-training` 及其内部的控制面板、右侧边栏完全由 `TrainingGround.initUI()` 动态创建，**并未硬编码在 `index.html` 中**。
*   **右侧边栏 (Sidebar)**：包含分类 Tab 和场景列表。切换分类由 `switchCategory(id)` 处理，点击场景由 `loadScenario(id)` 处理。
*   **演示触发收栏**：`triggerScenarioAction()` 默认会调用 `collapseSidebar()`，让战斗区域腾出空间；需要持续阅读状态说明的验收场景可设置 `keepSidebarOpenOnDemo: true`。
*   **Boss 入场动画特殊处理**：试炼场不走完整的战斗阶段（`phase === 'training'`），因此在 `loadScenario` 中有专门针对 `categoryId === 'boss'` 的硬编码逻辑：强制将 `e._pendingEntrance = false` 并设置 `e.entranceTimer = 1` 以激活 Boss 入场动画。
*   **Boss 破绽视觉验收**：`boss_vulnerability_break` 场景是破绽 Overlay 的逐档验收入口。它通过 `BOSS_VULNERABILITY_VISUAL_BOSSES` / `BOSS_VULNERABILITY_VISUAL_STATES` 轮播 8 个 Boss 的 `0/25/50/75/break/exposed/recover` 状态，并直接写入 `_bossVulnerabilityVisualRatio`、`_bossVulnerabilityExposedTurns`、`_bossVulnerabilityBreakTimer`、`_bossVulnerabilityRecoverTimer` 等视觉状态字段；该场景只用于验收，不代表实战伤害触发流程。
*   **Ouroboros 六附体验收**：`boss_ouroboros` 场景用于实机查看六附体轮转、轨道节点、`附X/断N` 状态短标签和动态破绽谱。场景本身只调用 `spawn_spawnBoss('ouroboros', true)` 与 `phase_enemy_startLogic()`，附体切换和封印必须由 `Enemy._tickOuroborosOrbit()` / `_interruptOuroborosAttachment()` 驱动，禁止在试炼场里写死视觉状态替代实战逻辑。`boss_ouroboros_attachment_slots` 场景用于逐槽验收 Boss 环上的六个附体槽贴图；它必须通过真实 Boss 实例的 `_applyOuroborosAttachment(normalizedIndex, game, { feedback: false })` 切换槽位，并由 `Enemy._drawOuroborosOrbitAttachments()` 绘制 `assets/sprites/bosses/ouroboros_slots/ouroboros_slot_<slotId>.png`。该场景不得调用 `_ouroborosSpawnEchoes()`，不得用普通敌人或会移动的 `orbit_echo` 伴生敌冒充槽位；`orbit_echo` 只用于正式裂群/召唤机制的伴生敌资源验收。
*   **敌人针对 fallback 验收**：`enemy_v2` 分类包含 `ev2_enemy_targeting_fallback` 场景，集中冻结展示 `energyArmor`、`phaseShield`、`overloadReactor`、`lowDamageImmune`、`livingArmor`、`armorSpore`、`siegeBreaker`、`deflectShell` 与 `carrier`。该场景直接写入护甲血量档位、`_armorSporeTrailTimer`、`phaseShieldDisabledThisTurn`、`_overloadBonusThisTurn` 等视觉状态，只用于资产生成前检查 Canvas fallback 可读性，不代表正常生成曲线。
*   **敌人针对 footprint PNG 验收**：`enemy_v2` 分类包含 `ev2_enemy_targeting_footprints` 场景，用于正式 PNG overlay 接入后的多尺寸实机验收。该场景冻结展示 `overloadReactor 3x3`、`phaseShield 1x2`、`energyArmor 2x1`、`lowDamageImmune 3x1`、`livingArmor 2x3`、`carrier 3x2` 与 `siegeBreaker 3x1`，必须确认边框覆盖完整 `gridCols x gridRows` footprint，而不是回退为居中的 1x1 overlay。
*   **V2 预设波次验证**：`enemy_v2` 分类包含 `ev2_wave_preset_spawn` 场景，临时固定 Round 12 与随机数后调用真实 `spawn_trySpawnWavePreset()`，用于验证大型基底能通过导演 preset 入口生成。该场景结束 setup 后必须恢复 `round`、`_wavePresetUsage`、`_wavePresetIntroShown`、`_wavePresetRoundUsed` 和 `Math.random`，避免污染其它试炼场场景。

## 3. 真理之书图鉴配置 (TruthBook)

真理之书同样采用数据驱动架构，数据定义在 `TRUTH_BOOK_DATA` 中。当前 UI 入口统一读取 `TRUTH_BOOK_DATA.entries`，左栏按 `TRUTH_BOOK_DATA.categories` 渲染分类、搜索与条目列表。

### 3.1 图鉴数据结构契约

新增图鉴条目必须在 `TRUTH_BOOK_DATA.entries` 中添加：

```javascript
{
    id: 'entry_id',
    categoryId: 'boss',       // 分类：boss / enemy_affix / enemy_v2 / attribute / core
    title: '条目标题',
    content: '详细说明文字（支持多行）',
    icon: '◇',
    tags: ['机制标签', '反制属性'],
    
    // [可选] 图鉴附带的互动演示
    setup: (demoGame) => {
        // 在右侧画布 (demoGame) 中布置演示场景
    },
    loop: [
        { type: 'log', text: '演示日志' },
        { type: 'enemy_turn' },
        { type: 'wait', frames: 120 },
        { type: 'reset' }
    ],
    trainingScenarioId: 'boss_ignis' // 可选：关联试炼场验收场景
}
```

#### 3.1.1 兼容层

- `TRUTH_BOOK_DATA.enemies` 与 `TRUTH_BOOK_DATA.attributes` 仍作为旧入口保留；命运选择页仍读取 `TRUTH_BOOK_DATA.attributes` 作为弹珠说明来源。
- `TRUTH_BOOK_DATA.entries` 由旧敌人词缀、属性条目、Boss 条目与核心机制条目归一化生成，条目同时具备 `title/content` 与兼容字段 `name/desc`。
- V2 敌人条目继续由 `ENEMY_V2_METADATA` 构建；`id` 以 `v2_` 开头的条目归入 `enemy_v2` 分类，其余旧敌人条目归入 `enemy_affix`。

#### 3.1.2 当前分类

| 分类 ID | 用途 |
|---|---|
| `boss` | 8 个 Boss 专属机制、破绽谱、狂暴变化与试炼场入口 |
| `enemy_affix` | 普通/精英敌人词缀演示 |
| `enemy_v2` | 多格敌人、V2 基底与专属形体 |
| `attribute` | 弹药属性、元素反应与子弹演示 |
| `core` | 技能/符文充能、子弹替换、掉落保底、智能符文掉落 |

## 3.3 符文词条场景分类 (`categoryId: 'runeword'`)

试炼场新增第四个场景分类：**符文词条**，用于展示和测试所有 `RUNEWORD_DB` 中定义的词条效果。

### 3.3.1 场景数据结构扩展

符文词条场景在标准场景对象基础上新增两个字段：

```javascript
{
    id: 'rw_<name>',              // [必填] 场景唯一标识符，建议以 'rw_' 为前缀
    categoryId: 'runeword',       // [必填] 分类标识
    runewordId: 'runeword_xxx',   // [runeword 分类必填] 对应 RUNEWORD_DB 中的词条 id
    runewordLevel: 1,             // [runeword 分类可选] 模拟的词条等级，默认为 1
    name: '词条名称',
    icon: '🔮',
    desc: '词条效果说明与测试建议',
    setup: (game) => { /* 布置测试敵人 */ },
    bulletConfig: { /* 预设子弹属性 */ },
    demoAction: (game, tg) => { /* 触发演示 */ }
}
```

### 3.3.2 词条效果注入机制

`loadScenario` 方法中新增了对 `runeword` 分类的特殊处理逻辑：

1. **清空旧效果**：每次切换场景时，将 `game.activeRunewordEffects` 和 `game.activeRunewordStats` 重置为空对象，防止不同场景间的词条效果互相干扰。
2. **动态注入**：根据 `scenario.runewordId` 在 `RUNEWORD_DB` 中查找词条定义，按照 `runewordLevel` 计算最终参数（`baseParams + (level-1) * perLevelParams`），并将结果写入 `game.activeRunewordEffects[effectId]`。
3. **全局透明**：注入后，战斗系统中所有读取 `activeRunewordEffects` 的逻辑均可正常生效，无需任何额外适配。

### 3.3.3 已实现场景列表

目前已实现 **21 个**符文词条场景，覆盖 `RUNEWORD_DB` 中全部 21 个词条：

| 场景 ID | 词条 | 分类 | 核心验证点 |
|---|---|---|---|
| `rw_meltdown` | 燔毀 | 火焰系 | 燃烧/爆炸伤害提升 |
| `rw_absolute_zero` | 绝对零度 | 冰霜系 | 冻结状态下伤害加深累加 |
| `rw_frost_nova` | 冰霜新星 | 冰霜系 | 每 5 次弹跳释放冰霜新星 |
| `rw_thunderstorm` | 雷暴之语 | 闪电系 | 闪电链衰减系数提升 |
| `rw_thunder_scatter` | 雷霖散射 | 闪电系 | 闪电链触发时额外释放一条链 |
| `rw_kinetic_surge` | 动能激増 | 弹射系 | 每次弹射伤害固定增加 |
| `rw_irradiation` | 照射 | 激光系 | 激光持续照射伤害累加 |
| `rw_flame_sword` | 炎光剑影 | 穿透系 | 穿透时概率召唤火焰剑光 |
| `rw_armor_piercing_meteor` | 穿甲流星 | 穿透系 | 散射子弹继承穿透层数 |
| `rw_blazing_beam` | 炽热光线 | 复合系 | 激光照射额外升温 |
| `rw_lightning_shield` | 雷电护盾 | 复合系 | 弹射时概率生成静电场 |
| `rw_blade_storm` | 剑刃风暴 | 复合系 | 子弹存活期间周期性剑光斩击 |
| `rw_elemental_fusion` | 元素聚变 | 元素系 | 火冰雷三属性共存引发聚变爆炸 |
| `rw_focused_fire` | 专注射击 | 专注系 | 弹跳/连射转化为基础伤害+暴击 |
| `rw_mass_collapse` | 质量崩塔 | 爆炸系 | 强制爆炸，连射/散射转爆炸范围 |
| `rw_kinetic_decay` | 动能衰变 | 衰变系 | 初始伤害加成逐次衰减 |
| `rw_echo_shot` | 回响射击 | 回响系 | 首次命中概率额外发射一颗 |
| `rw_bloodthirst_edge` | 嗜血初锋 | 成长系 | 击杀累计伤害加成 |
| `rw_scatter_matrix` | 散射矩阵 | 转化系 | 连射转化为散射层数 |
| `rw_sword_resonance` | 剑意共鸣 | 特殊系 | 展示飞剑变异词条激活状态 |
| `rw_storm_resonance` | 风暴共鸣 | 特殊系 | 展示风属性变异词条激活状态 |

## 4. 词条场景 demoAction 发射规范

词条场景的 `demoAction` 需要根据词条效果的应用时机，选择正确的发射方式：

| 发射方式 | 适用场景 | 说明 |
|---|---|---|
| `tg.fireBulletWithEffects(tg.bulletConfig)` | 词条效果在 `combat_fireNextShot` 中预处理的词条 | 将 recipe 推入 `ammoQueue`，经由完整词条应用流程后发射 |
| `game.spawn_spawnBullet(...)` | 词条效果在命中时通过 `activeRunewordEffects` 动态读取的词条 | 直接发射，命中时自动应用效果 |

**需要使用 `fireBulletWithEffects` 的词条**（在 `combat_fireNextShot` 中预处理）：
- `focused_fire`（bounce/multicast → damage 转化 + critChance/critDamage 写入）
- `mass_collapse`（multicast/scatter 清零 + 爆炸属性注入）
- `scatter_matrix`（multicast → scatter 转化）
- `kinetic_decay`（_kineticDecayBonus/_kineticDecayRate 写入）
- `echo_shot`（_echoShotChance 写入）
- `bloodthirst_growth`（击杀累计伤害加成 + 属性惩罚应用）

**可以直接使用 `spawn_spawnBullet` 的词条**（命中时动态读取）：
- `meltdown`、`absolute_zero`、`frost_nova`、`thunderstorm`、`kinetic_surge`
- `irradiation`、`blazing_beam`、`lightning_shield`、`blade_storm`
- `flame_sword`、`elemental_fusion`、`thunder_scatter`、`armor_piercing_meteor`
- `sword_resonance`、`storm_resonance`

## 5. 全局禁止行为

*   **禁止修改 DOM 结构**：若需调整试炼场布局，必须修改 `initUI()` 或 `initSidebar()` 中生成的 HTML 字符串，严禁尝试去 `index.html` 中寻找这些元素。
*   **禁止绕过场景系统硬编码测试**：测试新机制时，必须通过在 `TRAINING_SCENARIOS` 中添加临时场景来进行，严禁直接修改 `TrainingGround.enter()` 的初始逻辑。
*   **禁止在词条场景 demoAction 中直接调用 `spawn_spawnBullet`**：对于需要 `combat_fireNextShot` 预处理的词条，必须使用 `fireBulletWithEffects` 以确保词条效果被正确应用。
