# src/spawn_system.js 函数索引

> 自动生成于 2026-04-19 | 总行数: 2099 | 函数数: 28 | 语言: javascript
> **本文件由 code-indexer 脚本自动生成，严禁手动编辑。**

**巨型函数警告**: 本文件包含 2 个超过 200 行的函数，建议优先通过 `@section` 标记进行内部导航。

## 函数列表

| 函数名 | 类型 | 起始行 | 结束行 | 行数 | 签名 |
|--------|------|--------|--------|------|------|
| spawn_windSkillParticles | method | L21 | L84 | 64 | `spawn_windSkillParticles(type, rect, progress)` |
| spawn_createFloatingText | method | L85 | L91 | 7 | `spawn_createFloatingText(x, y, text, color, fontSize)` |
| spawn_generateAffixes | method | L92 | L169 | 78 | `spawn_generateAffixes()` |
| spawn_spawnEnemyRowAt | method | L170 | L475 | **306** | `spawn_spawnEnemyRowAt(yPos)` |
| spawn_addSkillPoint | method | L476 | L486 | 11 | `spawn_addSkillPoint(amount = 1)` |
| spawn_spawnEnemyRow | method | L487 | L492 | 6 | `spawn_spawnEnemyRow(count = 1)` |
| spawn_triggerCloneSpawn | method | L493 | L525 | 33 | `spawn_triggerCloneSpawn(sourceEnemy)` |
| spawn_smallWhirlwind | method | L526 | L560 | 35 | `spawn_smallWhirlwind(x, y)` |
| spawn_stormCore | method | L561 | L590 | 30 | `spawn_stormCore(x, y, radius, bulletDamage, bulletConfig)` |
| spawn_addScore | method | L591 | L602 | 12 | `spawn_addScore(amount)` |
| spawn_generateMarbleOptions | method | L603 | L775 | 173 | `spawn_generateMarbleOptions()` |
| spawn_showMarblePreview | method | L776 | L856 | 81 | `spawn_showMarblePreview(m, tbEntry, supplementDesc)` |
| spawn_createParticle | method | L857 | L923 | 67 | `spawn_createParticle(x, y, color, mode = 'normal')` |
| spawn_pushParticleWithLimit | method | L924 | L973 | 50 | `spawn_pushParticleWithLimit(p)` |
| spawn_spawnBullet | method | L974 | L1221 | **248** | `spawn_spawnBullet(x, y, vel, recipe, shotId = null, isLast = false)` |
| spawn_createExplosion | method | L1222 | L1234 | 13 | `spawn_createExplosion(x, y, color)` |
| spawn_createShockwave | method | L1235 | L1248 | 14 | `spawn_createShockwave(x, y, color = null)` |
| spawn_createHealWave | method | L1249 | L1263 | 15 | `spawn_createHealWave(x, y, range = 120)` |
| spawn_createHitFeedback | method | L1264 | L1358 | 95 | `spawn_createHitFeedback(x, y, velocity, type = 'normal')` |
| spawn_triggerLevelUpEvent | method | L1359 | L1401 | 43 | `spawn_triggerLevelUpEvent(uiX, uiY)` |
| spawn_scheduleNextBoss | method | L1402 | L1457 | 56 | `spawn_scheduleNextBoss(extraDelay = 0)` |
| spawn_checkBossRoundFor | method | L1458 | L1482 | 25 | `spawn_checkBossRoundFor(round)` |
| spawn_checkBossRound | method | L1483 | L1507 | 25 | `spawn_checkBossRound()` |
| spawn_calculateBossHP | method | L1508 | L1580 | 73 | `spawn_calculateBossHP(isBigBoss)` |
| spawn_spawnBoss | method | L1581 | L1779 | 199 | `spawn_spawnBoss(bossId, isBigBoss)` |
| spawn_selectBossForRound | method | L1780 | L1807 | 28 | `spawn_selectBossForRound(isBigBoss)` |
| spawn_applyMinionShape | method | L1808 | L1957 | 150 | `spawn_applyMinionShape(e)` |
| spawn_triggerBossEntranceShockwave | method | L1958 | L2100 | 143 | `spawn_triggerBossEntranceShockwave(boss)` |

## 巨型函数内部节点 (@section 标记)

### spawn_spawnEnemyRowAt (L170-L475, 306行)

| 节点标记 | 行号 | 说明 |
|----------|------|------|
| `@section:spawn_enemy_type_select` | L232 | 敌人类型选择与词缀分配 |
| `@section:spawn_position_calc` | L355 | 生成位置计算与间距分布 |
| `@section:spawn_entity_init` | L416 | 敌人实体初始化与注入游戏状态 |

### spawn_spawnBullet (L974-L1221, 248行)

| 节点标记 | 行号 | 说明 |
|----------|------|------|
| `@section:bullet_velocity_calc` | L1048 | 子弹速度与方向计算 |
| `@section:bullet_entity_create` | L1109 | 子弹实体创建与属性注入 |
| `@section:bullet_pool_push` | L1170 | 子弹推入对象池与粒子预热 |

## 其他 @section 标记

| 节点标记 | 行号 | 说明 |
|----------|------|------|
| `@section:spawn_row_config` | L169 | 行配置读取：波次参数与难度缩放 |
| `@section:bullet_recipe_parse` | L973 | 弹药配方解析与属性提取 |
