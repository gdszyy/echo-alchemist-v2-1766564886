# src\spawn_system.js 函数索引

> 自动生成于 2026-06-25 | 总行数: 3717 | 函数数: 59 | 语言: javascript
> **本文件由 code-indexer 脚本自动生成，严禁手动编辑。**

**巨型函数警告**: 本文件包含 3 个超过 200 行的函数，建议优先通过 `@section` 标记进行内部导航。

## 函数列表

> 定位方式：在源文件中 `grep -n "函数名"` 即可跳转，行号不在此列出（行号随代码变化而失效）。

| 函数名 | 类型 | 签名 | 备注 |
|--------|------|------|------|
| spawn_windSkillParticles | method | `spawn_windSkillParticles(type, rect, progress)` |  |
| spawn_createFloatingText | method | `spawn_createFloatingText(x, y, text, color, fontSize, iconImg)` |  |
| spawn_generateAffixes | method | `spawn_generateAffixes()` |  |
| spawn_getBossMinionProfile | method | `spawn_getBossMinionProfile(bossId)` |  |
| spawn_applyBossMinionMetadata | method | `spawn_applyBossMinionMetadata(e, bossId, profile = null, roleOverride = null)` |  |
| spawn_applyTeachingGate | method | `spawn_applyTeachingGate(weights, round)` |  |
| spawn_markAffixSeenIfNew | method | `spawn_markAffixSeenIfNew(affix)` |  |
| spawn_getNextBossPreTeach | method | `spawn_getNextBossPreTeach(round)` |  |
| spawn_estimateFieldStrength | method | `spawn_estimateFieldStrength()` |  |
| spawn_spawnEnemyRowAt | method | `spawn_spawnEnemyRowAt(yPos, options = {})` |  |
| addPreset | function | `addPreset(col, hpMult, forceAffixes, extraInit)` |  |
| spawn_addSkillPoint | method | `spawn_addSkillPoint(amount = 1)` |  |
| spawn_spawnEnemyRow | method | `spawn_spawnEnemyRow(count = 1)` |  |
| spawn_spawnEnemyRowOffScreen | method | `spawn_spawnEnemyRowOffScreen(count = 1)` |  |
| spawn_spawnEliteJumperRows | method | `spawn_spawnEliteJumperRows(count = 3)` |  |
| spawn_triggerCloneSpawn | method | `spawn_triggerCloneSpawn(sourceEnemy)` |  |
| spawn_smallWhirlwind | method | `spawn_smallWhirlwind(x, y)` |  |
| spawn_stormCore | method | `spawn_stormCore(x, y, radius, bulletDamage, bulletConfig)` |  |
| spawn_addScore | method | `spawn_addScore(amount, enemy)` |  |
| spawn_dropRuneFragments | method | `spawn_dropRuneFragments(x, y, count, tier)` |  |
| spawn_generateMarbleOptions | method | `spawn_generateMarbleOptions()` | ⚠️ 巨型函数，见 @section 导航 |
| spawn_showMarblePreview | method | `spawn_showMarblePreview(m, tbEntry, supplementDesc)` |  |
| spawn_createParticle | method | `spawn_createParticle(x, y, color, mode = 'normal')` |  |
| spawn_pushParticleWithLimit | method | `spawn_pushParticleWithLimit(p)` |  |
| spawn_spawnBullet | method | `spawn_spawnBullet(x, y, vel, recipe, shotId = null, isLast = false)` | ⚠️ 巨型函数，见 @section 导航 |
| spawn_createExplosion | method | `spawn_createExplosion(x, y, color)` |  |
| spawn_createAssimilationPulse | method | `spawn_createAssimilationPulse(x, y, color, opts = {})` |  |
| spawn_createSlotBurst | method | `spawn_createSlotBurst(x, y, color, opts = {})` |  |
| spawn_createImpactBlast | method | `spawn_createImpactBlast(x, y, color, opts = {})` |  |
| spawn_createSkillIgnition | method | `spawn_createSkillIgnition(x, y, color, opts = {})` |  |
| spawn_createShockwave | method | `spawn_createShockwave(x, y, color = null)` |  |
| spawn_createHealWave | method | `spawn_createHealWave(x, y, range = 120)` |  |
| spawn_createGreedyWheelEffect | method | `spawn_createGreedyWheelEffect(x, y, mode = 'prelude')` |  |
| spawn_createAffixSkillVFX | method | `spawn_createAffixSkillVFX(x, y, skillType, opts = {})` |  |
| spawn_createHitFeedback | method | `spawn_createHitFeedback(x, y, velocity, type = 'normal', options = {})` |  |
| spawn_triggerLevelUpEvent | method | `spawn_triggerLevelUpEvent(uiX, uiY, session = this.currentSession)` |  |
| spawn_scheduleNextBoss | method | `spawn_scheduleNextBoss(extraDelay = 0)` |  |
| spawn_checkBossRoundFor | method | `spawn_checkBossRoundFor(round)` |  |
| spawn_checkBossRound | method | `spawn_checkBossRound()` |  |
| spawn_calculateBossHP | method | `spawn_calculateBossHP(isBigBoss)` |  |
| spawn_spawnBoss | method | `spawn_spawnBoss(bossId, isBigBoss)` | ⚠️ 巨型函数，见 @section 导航 |
| spawn_selectBossForRound | method | `spawn_selectBossForRound(isBigBoss)` |  |
| spawn_applyMinionShape | method | `spawn_applyMinionShape(e)` |  |
| spawn_getDirectorPressureProfile | method | `spawn_getDirectorPressureProfile()` |  |
| spawn_scoreWavePresetForDirector | method | `spawn_scoreWavePresetForDirector(preset, profile)` |  |
| spawn_getDirectorScriptMeta | method | `spawn_getDirectorScriptMeta(scriptId)` |  |
| spawn_collectPresetActorAffixes | method | `spawn_collectPresetActorAffixes(preset)` |  |
| spawn_getPresetActorProfile | method | `spawn_getPresetActorProfile(preset, round = this.round || 1)` |  |
| spawn_canUseDirectorScript | method | `spawn_canUseDirectorScript(preset, actorProfile, round = this.round || 1)` |  |
| spawn_scoreDirectorScriptForRound | method | `spawn_scoreDirectorScriptForRound(preset, actorProfile, round = this.round || 1)` |  |
| spawn_pickWavePreset | method | `spawn_pickWavePreset(options = {})` |  |
| spawn_countActiveArchetypes | method | `spawn_countActiveArchetypes()` |  |
| spawn_canUseWavePreset | method | `spawn_canUseWavePreset(preset, counts)` |  |
| spawn_trySpawnWavePreset | method | `spawn_trySpawnWavePreset(yPos, baseHP, occupiedCols, w, options = {})` |  |
| spawn_findWavePresetPlacement | method | `spawn_findWavePresetPlacement(slot, yPos, occupiedCols, w)` |  |
| spawn_spawnWavePresetSlot | method | `spawn_spawnWavePresetSlot(placement, baseHP, w, options = {})` |  |
| spawn_trySpawnArchetypes | method | `spawn_trySpawnArchetypes(yPos, baseHP, occupiedCols, w, options)` |  |
| spawn_applyArchetypeShape | method | `spawn_applyArchetypeShape(e, archetypeId)` |  |
| spawn_triggerBossEntranceShockwave | method | `spawn_triggerBossEntranceShockwave(boss)` |  |

## 巨型函数内部节点 (@section 标记)

### spawn_generateMarbleOptions

> **缺少 @section 标记**：此巨型函数内部没有节点标记，建议添加以提升导航精度。

### spawn_spawnBullet

> 定位：`grep -n '@section:节点名'` 跳转到对应节点

| 节点标记 | 说明 |
|----------|------|
| `@section:bullet_velocity_calc` | 子弹速度与方向计算 |
| `@section:bullet_entity_create` | 子弹实体创建与属性注入 |
| `@section:bullet_pool_push` | 子弹推入对象池与粒子预热 |

### spawn_spawnBoss

> **缺少 @section 标记**：此巨型函数内部没有节点标记，建议添加以提升导航精度。


## 其他 @section 标记

| 节点标记 | 说明 |
|----------|------|
| `@section:spawn_row_config` | 行配置读取：波次参数与难度缩放 |
| `@section:spawn_enemy_type_select` | 敌人类型选择与词缀分配 |
| `@section:spawn_position_calc` | 生成位置计算与间距分布 |
| `@section:spawn_entity_init` | 敌人实体初始化与注入游戏状态 |
| `@section:bullet_recipe_parse` | 弹药配方解析与属性提取 |
| `@section:energy_orb_collect_audio` | 能量球收集进度音效（500~750Hz 随进度升调，营造蓄力感） |
| `@section:levelup_audio` | 能量槽满触发多播升级爆发音（pitch = multicast 等级，越高越尖锐） |
