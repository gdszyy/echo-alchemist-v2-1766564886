# src/spawn_system.js 函数索引

> 自动生成于 2026-04-20 | 总行数: 2225 | 函数数: 28 | 语言: javascript
> **本文件由 code-indexer 脚本自动生成，严禁手动编辑。**

**巨型函数警告**: 本文件包含 2 个超过 200 行的函数，建议优先通过 `@section` 标记进行内部导航。

## 函数列表

| 函数名 | 类型 | 起始行 | 结束行 | 行数 | 签名 |
|--------|------|--------|--------|------|------|
| spawn_windSkillParticles | method | L77 | L140 | 64 | `spawn_windSkillParticles(type, rect, progress)` |
| spawn_createFloatingText | method | L141 | L147 | 7 | `spawn_createFloatingText(x, y, text, color, fontSize)` |
| spawn_generateAffixes | method | L148 | L194 | 47 | `spawn_generateAffixes()` |
| spawn_spawnEnemyRowAt | method | L195 | L591 | **397** | `spawn_spawnEnemyRowAt(yPos)` |
| spawn_addSkillPoint | method | L592 | L602 | 11 | `spawn_addSkillPoint(amount = 1)` |
| spawn_spawnEnemyRow | method | L603 | L608 | 6 | `spawn_spawnEnemyRow(count = 1)` |
| spawn_triggerCloneSpawn | method | L609 | L641 | 33 | `spawn_triggerCloneSpawn(sourceEnemy)` |
| spawn_smallWhirlwind | method | L642 | L676 | 35 | `spawn_smallWhirlwind(x, y)` |
| spawn_stormCore | method | L677 | L706 | 30 | `spawn_stormCore(x, y, radius, bulletDamage, bulletConfig)` |
| spawn_addScore | method | L707 | L718 | 12 | `spawn_addScore(amount)` |
| spawn_generateMarbleOptions | method | L719 | L901 | 183 | `spawn_generateMarbleOptions()` |
| spawn_showMarblePreview | method | L902 | L982 | 81 | `spawn_showMarblePreview(m, tbEntry, supplementDesc)` |
| spawn_createParticle | method | L983 | L1049 | 67 | `spawn_createParticle(x, y, color, mode = 'normal')` |
| spawn_pushParticleWithLimit | method | L1050 | L1099 | 50 | `spawn_pushParticleWithLimit(p)` |
| spawn_spawnBullet | method | L1100 | L1347 | **248** | `spawn_spawnBullet(x, y, vel, recipe, shotId = null, isLast = false)` |
| spawn_createExplosion | method | L1348 | L1360 | 13 | `spawn_createExplosion(x, y, color)` |
| spawn_createShockwave | method | L1361 | L1374 | 14 | `spawn_createShockwave(x, y, color = null)` |
| spawn_createHealWave | method | L1375 | L1389 | 15 | `spawn_createHealWave(x, y, range = 120)` |
| spawn_createHitFeedback | method | L1390 | L1484 | 95 | `spawn_createHitFeedback(x, y, velocity, type = 'normal')` |
| spawn_triggerLevelUpEvent | method | L1485 | L1527 | 43 | `spawn_triggerLevelUpEvent(uiX, uiY)` |
| spawn_scheduleNextBoss | method | L1528 | L1583 | 56 | `spawn_scheduleNextBoss(extraDelay = 0)` |
| spawn_checkBossRoundFor | method | L1584 | L1608 | 25 | `spawn_checkBossRoundFor(round)` |
| spawn_checkBossRound | method | L1609 | L1633 | 25 | `spawn_checkBossRound()` |
| spawn_calculateBossHP | method | L1634 | L1706 | 73 | `spawn_calculateBossHP(isBigBoss)` |
| spawn_spawnBoss | method | L1707 | L1905 | 199 | `spawn_spawnBoss(bossId, isBigBoss)` |
| spawn_selectBossForRound | method | L1906 | L1933 | 28 | `spawn_selectBossForRound(isBigBoss)` |
| spawn_applyMinionShape | method | L1934 | L2083 | 150 | `spawn_applyMinionShape(e)` |
| spawn_triggerBossEntranceShockwave | method | L2084 | L2226 | 143 | `spawn_triggerBossEntranceShockwave(boss)` |

## 巨型函数内部节点 (@section 标记)

### spawn_spawnEnemyRowAt (L195-L591, 397行)

| 节点标记 | 行号 | 说明 |
|----------|------|------|
| `@section:spawn_enemy_type_select` | L256 | 敌人类型选择与词缀分配 |
| `@section:spawn_position_calc` | L450 | 生成位置计算与间距分布 |
| `@section:spawn_entity_init` | L511 | 敌人实体初始化与注入游戏状态 |

### spawn_spawnBullet (L1100-L1347, 248行)

| 节点标记 | 行号 | 说明 |
|----------|------|------|
| `@section:bullet_velocity_calc` | L1174 | 子弹速度与方向计算 |
| `@section:bullet_entity_create` | L1235 | 子弹实体创建与属性注入 |
| `@section:bullet_pool_push` | L1296 | 子弹推入对象池与粒子预热 |

## 其他 @section 标记

| 节点标记 | 行号 | 说明 |
|----------|------|------|
| `@section:spawn_row_config` | L194 | 行配置读取：波次参数与难度缩放 |
| `@section:bullet_recipe_parse` | L1099 | 弹药配方解析与属性提取 |
