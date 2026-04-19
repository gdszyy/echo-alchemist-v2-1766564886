# src/spawn_system.js 函数索引

> 自动生成于 2026-04-19 | 总行数: 2154 | 函数数: 28 | 语言: javascript
> **本文件由 code-indexer 脚本自动生成，严禁手动编辑。**

**巨型函数警告**: 本文件包含 2 个超过 200 行的函数，建议优先通过 `@section` 标记进行内部导航。

## 函数列表

| 函数名 | 类型 | 起始行 | 结束行 | 行数 | 签名 |
|--------|------|--------|--------|------|------|
| spawn_windSkillParticles | method | L22 | L85 | 64 | `spawn_windSkillParticles(type, rect, progress)` |
| spawn_createFloatingText | method | L86 | L92 | 7 | `spawn_createFloatingText(x, y, text, color, fontSize)` |
| spawn_generateAffixes | method | L93 | L170 | 78 | `spawn_generateAffixes()` |
| spawn_spawnEnemyRowAt | method | L171 | L530 | **360** | `spawn_spawnEnemyRowAt(yPos)` |
| spawn_addSkillPoint | method | L531 | L541 | 11 | `spawn_addSkillPoint(amount = 1)` |
| spawn_spawnEnemyRow | method | L542 | L547 | 6 | `spawn_spawnEnemyRow(count = 1)` |
| spawn_triggerCloneSpawn | method | L548 | L580 | 33 | `spawn_triggerCloneSpawn(sourceEnemy)` |
| spawn_smallWhirlwind | method | L581 | L615 | 35 | `spawn_smallWhirlwind(x, y)` |
| spawn_stormCore | method | L616 | L645 | 30 | `spawn_stormCore(x, y, radius, bulletDamage, bulletConfig)` |
| spawn_addScore | method | L646 | L657 | 12 | `spawn_addScore(amount)` |
| spawn_generateMarbleOptions | method | L658 | L830 | 173 | `spawn_generateMarbleOptions()` |
| spawn_showMarblePreview | method | L831 | L911 | 81 | `spawn_showMarblePreview(m, tbEntry, supplementDesc)` |
| spawn_createParticle | method | L912 | L978 | 67 | `spawn_createParticle(x, y, color, mode = 'normal')` |
| spawn_pushParticleWithLimit | method | L979 | L1028 | 50 | `spawn_pushParticleWithLimit(p)` |
| spawn_spawnBullet | method | L1029 | L1276 | **248** | `spawn_spawnBullet(x, y, vel, recipe, shotId = null, isLast = false)` |
| spawn_createExplosion | method | L1277 | L1289 | 13 | `spawn_createExplosion(x, y, color)` |
| spawn_createShockwave | method | L1290 | L1303 | 14 | `spawn_createShockwave(x, y, color = null)` |
| spawn_createHealWave | method | L1304 | L1318 | 15 | `spawn_createHealWave(x, y, range = 120)` |
| spawn_createHitFeedback | method | L1319 | L1413 | 95 | `spawn_createHitFeedback(x, y, velocity, type = 'normal')` |
| spawn_triggerLevelUpEvent | method | L1414 | L1456 | 43 | `spawn_triggerLevelUpEvent(uiX, uiY)` |
| spawn_scheduleNextBoss | method | L1457 | L1512 | 56 | `spawn_scheduleNextBoss(extraDelay = 0)` |
| spawn_checkBossRoundFor | method | L1513 | L1537 | 25 | `spawn_checkBossRoundFor(round)` |
| spawn_checkBossRound | method | L1538 | L1562 | 25 | `spawn_checkBossRound()` |
| spawn_calculateBossHP | method | L1563 | L1635 | 73 | `spawn_calculateBossHP(isBigBoss)` |
| spawn_spawnBoss | method | L1636 | L1834 | 199 | `spawn_spawnBoss(bossId, isBigBoss)` |
| spawn_selectBossForRound | method | L1835 | L1862 | 28 | `spawn_selectBossForRound(isBigBoss)` |
| spawn_applyMinionShape | method | L1863 | L2012 | 150 | `spawn_applyMinionShape(e)` |
| spawn_triggerBossEntranceShockwave | method | L2013 | L2155 | 143 | `spawn_triggerBossEntranceShockwave(boss)` |

## 巨型函数内部节点 (@section 标记)

### spawn_spawnEnemyRowAt (L171-L530, 360行)

| 节点标记 | 行号 | 说明 |
|----------|------|------|
| `@section:spawn_enemy_type_select` | L231 | 敌人类型选择与词缀分配 |
| `@section:spawn_position_calc` | L399 | 生成位置计算与间距分布 |
| `@section:spawn_entity_init` | L460 | 敌人实体初始化与注入游戏状态 |

### spawn_spawnBullet (L1029-L1276, 248行)

| 节点标记 | 行号 | 说明 |
|----------|------|------|
| `@section:bullet_velocity_calc` | L1103 | 子弹速度与方向计算 |
| `@section:bullet_entity_create` | L1164 | 子弹实体创建与属性注入 |
| `@section:bullet_pool_push` | L1225 | 子弹推入对象池与粒子预热 |

## 其他 @section 标记

| 节点标记 | 行号 | 说明 |
|----------|------|------|
| `@section:spawn_row_config` | L170 | 行配置读取：波次参数与难度缩放 |
| `@section:bullet_recipe_parse` | L1028 | 弹药配方解析与属性提取 |
