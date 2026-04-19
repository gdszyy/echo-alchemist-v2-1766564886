# src/spawn_system.js 函数索引

> 自动生成于 2026-04-19 | 总行数: 2183 | 函数数: 28 | 语言: javascript
> **本文件由 code-indexer 脚本自动生成，严禁手动编辑。**

**巨型函数警告**: 本文件包含 2 个超过 200 行的函数，建议优先通过 `@section` 标记进行内部导航。

## 函数列表

| 函数名 | 类型 | 起始行 | 结束行 | 行数 | 签名 |
|--------|------|--------|--------|------|------|
| spawn_windSkillParticles | method | L75 | L138 | 64 | `spawn_windSkillParticles(type, rect, progress)` |
| spawn_createFloatingText | method | L139 | L145 | 7 | `spawn_createFloatingText(x, y, text, color, fontSize)` |
| spawn_generateAffixes | method | L146 | L223 | 78 | `spawn_generateAffixes()` |
| spawn_spawnEnemyRowAt | method | L224 | L559 | **336** | `spawn_spawnEnemyRowAt(yPos)` |
| spawn_addSkillPoint | method | L560 | L570 | 11 | `spawn_addSkillPoint(amount = 1)` |
| spawn_spawnEnemyRow | method | L571 | L576 | 6 | `spawn_spawnEnemyRow(count = 1)` |
| spawn_triggerCloneSpawn | method | L577 | L609 | 33 | `spawn_triggerCloneSpawn(sourceEnemy)` |
| spawn_smallWhirlwind | method | L610 | L644 | 35 | `spawn_smallWhirlwind(x, y)` |
| spawn_stormCore | method | L645 | L674 | 30 | `spawn_stormCore(x, y, radius, bulletDamage, bulletConfig)` |
| spawn_addScore | method | L675 | L686 | 12 | `spawn_addScore(amount)` |
| spawn_generateMarbleOptions | method | L687 | L859 | 173 | `spawn_generateMarbleOptions()` |
| spawn_showMarblePreview | method | L860 | L940 | 81 | `spawn_showMarblePreview(m, tbEntry, supplementDesc)` |
| spawn_createParticle | method | L941 | L1007 | 67 | `spawn_createParticle(x, y, color, mode = 'normal')` |
| spawn_pushParticleWithLimit | method | L1008 | L1057 | 50 | `spawn_pushParticleWithLimit(p)` |
| spawn_spawnBullet | method | L1058 | L1305 | **248** | `spawn_spawnBullet(x, y, vel, recipe, shotId = null, isLast = false)` |
| spawn_createExplosion | method | L1306 | L1318 | 13 | `spawn_createExplosion(x, y, color)` |
| spawn_createShockwave | method | L1319 | L1332 | 14 | `spawn_createShockwave(x, y, color = null)` |
| spawn_createHealWave | method | L1333 | L1347 | 15 | `spawn_createHealWave(x, y, range = 120)` |
| spawn_createHitFeedback | method | L1348 | L1442 | 95 | `spawn_createHitFeedback(x, y, velocity, type = 'normal')` |
| spawn_triggerLevelUpEvent | method | L1443 | L1485 | 43 | `spawn_triggerLevelUpEvent(uiX, uiY)` |
| spawn_scheduleNextBoss | method | L1486 | L1541 | 56 | `spawn_scheduleNextBoss(extraDelay = 0)` |
| spawn_checkBossRoundFor | method | L1542 | L1566 | 25 | `spawn_checkBossRoundFor(round)` |
| spawn_checkBossRound | method | L1567 | L1591 | 25 | `spawn_checkBossRound()` |
| spawn_calculateBossHP | method | L1592 | L1664 | 73 | `spawn_calculateBossHP(isBigBoss)` |
| spawn_spawnBoss | method | L1665 | L1863 | 199 | `spawn_spawnBoss(bossId, isBigBoss)` |
| spawn_selectBossForRound | method | L1864 | L1891 | 28 | `spawn_selectBossForRound(isBigBoss)` |
| spawn_applyMinionShape | method | L1892 | L2041 | 150 | `spawn_applyMinionShape(e)` |
| spawn_triggerBossEntranceShockwave | method | L2042 | L2184 | 143 | `spawn_triggerBossEntranceShockwave(boss)` |

## 巨型函数内部节点 (@section 标记)

### spawn_spawnEnemyRowAt (L224-L559, 336行)

| 节点标记 | 行号 | 说明 |
|----------|------|------|
| `@section:spawn_enemy_type_select` | L286 | 敌人类型选择与词缀分配 |
| `@section:spawn_position_calc` | L439 | 生成位置计算与间距分布 |
| `@section:spawn_entity_init` | L500 | 敌人实体初始化与注入游戏状态 |

### spawn_spawnBullet (L1058-L1305, 248行)

| 节点标记 | 行号 | 说明 |
|----------|------|------|
| `@section:bullet_velocity_calc` | L1132 | 子弹速度与方向计算 |
| `@section:bullet_entity_create` | L1193 | 子弹实体创建与属性注入 |
| `@section:bullet_pool_push` | L1254 | 子弹推入对象池与粒子预热 |

## 其他 @section 标记

| 节点标记 | 行号 | 说明 |
|----------|------|------|
| `@section:spawn_row_config` | L223 | 行配置读取：波次参数与难度缩放 |
| `@section:bullet_recipe_parse` | L1057 | 弹药配方解析与属性提取 |
