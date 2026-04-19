# src/spawn_system.js 函数索引

> 自动生成于 2026-04-19 | 总行数: 2090 | 函数数: 28 | 语言: javascript
> **本文件由 code-indexer 脚本自动生成，严禁手动编辑。**

**巨型函数警告**: 本文件包含 2 个超过 200 行的函数，建议优先通过 `@section` 标记进行内部导航。

## 函数列表

| 函数名 | 类型 | 起始行 | 结束行 | 行数 | 签名 |
|--------|------|--------|--------|------|------|
| spawn_windSkillParticles | method | L22 | L85 | 64 | `spawn_windSkillParticles(type, rect, progress)` |
| spawn_createFloatingText | method | L86 | L92 | 7 | `spawn_createFloatingText(x, y, text, color, fontSize)` |
| spawn_generateAffixes | method | L93 | L169 | 77 | `spawn_generateAffixes()` |
| spawn_spawnEnemyRowAt | method | L170 | L486 | **317** | `spawn_spawnEnemyRowAt(yPos)` |
| spawn_addSkillPoint | method | L487 | L497 | 11 | `spawn_addSkillPoint(amount = 1)` |
| spawn_spawnEnemyRow | method | L498 | L503 | 6 | `spawn_spawnEnemyRow(count = 1)` |
| spawn_triggerCloneSpawn | method | L504 | L536 | 33 | `spawn_triggerCloneSpawn(sourceEnemy)` |
| spawn_smallWhirlwind | method | L537 | L571 | 35 | `spawn_smallWhirlwind(x, y)` |
| spawn_stormCore | method | L572 | L601 | 30 | `spawn_stormCore(x, y, radius, bulletDamage, bulletConfig)` |
| spawn_addScore | method | L602 | L613 | 12 | `spawn_addScore(amount)` |
| spawn_generateMarbleOptions | method | L614 | L786 | 173 | `spawn_generateMarbleOptions()` |
| spawn_showMarblePreview | method | L787 | L867 | 81 | `spawn_showMarblePreview(m, tbEntry, supplementDesc)` |
| spawn_createParticle | method | L868 | L934 | 67 | `spawn_createParticle(x, y, color, mode = 'normal')` |
| spawn_pushParticleWithLimit | method | L935 | L984 | 50 | `spawn_pushParticleWithLimit(p)` |
| spawn_spawnBullet | method | L985 | L1232 | **248** | `spawn_spawnBullet(x, y, vel, recipe, shotId = null, isLast = false)` |
| spawn_createExplosion | method | L1233 | L1245 | 13 | `spawn_createExplosion(x, y, color)` |
| spawn_createShockwave | method | L1246 | L1259 | 14 | `spawn_createShockwave(x, y, color = null)` |
| spawn_createHealWave | method | L1260 | L1274 | 15 | `spawn_createHealWave(x, y, range = 120)` |
| spawn_createHitFeedback | method | L1275 | L1369 | 95 | `spawn_createHitFeedback(x, y, velocity, type = 'normal')` |
| spawn_triggerLevelUpEvent | method | L1370 | L1412 | 43 | `spawn_triggerLevelUpEvent(uiX, uiY)` |
| spawn_scheduleNextBoss | method | L1413 | L1451 | 39 | `spawn_scheduleNextBoss(extraDelay = 0)` |
| spawn_checkBossRoundFor | method | L1452 | L1473 | 22 | `spawn_checkBossRoundFor(round)` |
| spawn_checkBossRound | method | L1474 | L1498 | 25 | `spawn_checkBossRound()` |
| spawn_calculateBossHP | method | L1499 | L1571 | 73 | `spawn_calculateBossHP(isBigBoss)` |
| spawn_spawnBoss | method | L1572 | L1770 | 199 | `spawn_spawnBoss(bossId, isBigBoss)` |
| spawn_selectBossForRound | method | L1771 | L1798 | 28 | `spawn_selectBossForRound(isBigBoss)` |
| spawn_applyMinionShape | method | L1799 | L1948 | 150 | `spawn_applyMinionShape(e)` |
| spawn_triggerBossEntranceShockwave | method | L1949 | L2091 | 143 | `spawn_triggerBossEntranceShockwave(boss)` |

## 巨型函数内部节点 (@section 标记)

### spawn_spawnEnemyRowAt (L170-L486, 317行)

| 节点标记 | 行号 | 说明 |
|----------|------|------|
| `@section:spawn_enemy_type_select` | L230 | 敌人类型选择与词缀分配 |
| `@section:spawn_position_calc` | L355 | 生成位置计算与间距分布 |
| `@section:spawn_entity_init` | L416 | 敌人实体初始化与注入游戏状态 |

### spawn_spawnBullet (L985-L1232, 248行)

| 节点标记 | 行号 | 说明 |
|----------|------|------|
| `@section:bullet_velocity_calc` | L1059 | 子弹速度与方向计算 |
| `@section:bullet_entity_create` | L1120 | 子弹实体创建与属性注入 |
| `@section:bullet_pool_push` | L1181 | 子弹推入对象池与粒子预热 |

## 其他 @section 标记

| 节点标记 | 行号 | 说明 |
|----------|------|------|
| `@section:spawn_row_config` | L169 | 行配置读取：波次参数与难度缩放 |
| `@section:bullet_recipe_parse` | L984 | 弹药配方解析与属性提取 |
