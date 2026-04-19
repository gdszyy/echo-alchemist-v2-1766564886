# src/spawn_system.js 函数索引

> 自动生成于 2026-04-19 | 总行数: 2235 | 函数数: 28 | 语言: javascript
> **本文件由 code-indexer 脚本自动生成，严禁手动编辑。**

**巨型函数警告**: 本文件包含 2 个超过 200 行的函数，建议优先通过 `@section` 标记进行内部导航。

## 函数列表

| 函数名 | 类型 | 起始行 | 结束行 | 行数 | 签名 |
|--------|------|--------|--------|------|------|
| spawn_windSkillParticles | method | L76 | L139 | 64 | `spawn_windSkillParticles(type, rect, progress)` |
| spawn_createFloatingText | method | L140 | L146 | 7 | `spawn_createFloatingText(x, y, text, color, fontSize)` |
| spawn_generateAffixes | method | L147 | L224 | 78 | `spawn_generateAffixes()` |
| spawn_spawnEnemyRowAt | method | L225 | L611 | **387** | `spawn_spawnEnemyRowAt(yPos)` |
| spawn_addSkillPoint | method | L612 | L622 | 11 | `spawn_addSkillPoint(amount = 1)` |
| spawn_spawnEnemyRow | method | L623 | L628 | 6 | `spawn_spawnEnemyRow(count = 1)` |
| spawn_triggerCloneSpawn | method | L629 | L661 | 33 | `spawn_triggerCloneSpawn(sourceEnemy)` |
| spawn_smallWhirlwind | method | L662 | L696 | 35 | `spawn_smallWhirlwind(x, y)` |
| spawn_stormCore | method | L697 | L726 | 30 | `spawn_stormCore(x, y, radius, bulletDamage, bulletConfig)` |
| spawn_addScore | method | L727 | L738 | 12 | `spawn_addScore(amount)` |
| spawn_generateMarbleOptions | method | L739 | L911 | 173 | `spawn_generateMarbleOptions()` |
| spawn_showMarblePreview | method | L912 | L992 | 81 | `spawn_showMarblePreview(m, tbEntry, supplementDesc)` |
| spawn_createParticle | method | L993 | L1059 | 67 | `spawn_createParticle(x, y, color, mode = 'normal')` |
| spawn_pushParticleWithLimit | method | L1060 | L1109 | 50 | `spawn_pushParticleWithLimit(p)` |
| spawn_spawnBullet | method | L1110 | L1357 | **248** | `spawn_spawnBullet(x, y, vel, recipe, shotId = null, isLast = false)` |
| spawn_createExplosion | method | L1358 | L1370 | 13 | `spawn_createExplosion(x, y, color)` |
| spawn_createShockwave | method | L1371 | L1384 | 14 | `spawn_createShockwave(x, y, color = null)` |
| spawn_createHealWave | method | L1385 | L1399 | 15 | `spawn_createHealWave(x, y, range = 120)` |
| spawn_createHitFeedback | method | L1400 | L1494 | 95 | `spawn_createHitFeedback(x, y, velocity, type = 'normal')` |
| spawn_triggerLevelUpEvent | method | L1495 | L1537 | 43 | `spawn_triggerLevelUpEvent(uiX, uiY)` |
| spawn_scheduleNextBoss | method | L1538 | L1593 | 56 | `spawn_scheduleNextBoss(extraDelay = 0)` |
| spawn_checkBossRoundFor | method | L1594 | L1618 | 25 | `spawn_checkBossRoundFor(round)` |
| spawn_checkBossRound | method | L1619 | L1643 | 25 | `spawn_checkBossRound()` |
| spawn_calculateBossHP | method | L1644 | L1716 | 73 | `spawn_calculateBossHP(isBigBoss)` |
| spawn_spawnBoss | method | L1717 | L1915 | 199 | `spawn_spawnBoss(bossId, isBigBoss)` |
| spawn_selectBossForRound | method | L1916 | L1943 | 28 | `spawn_selectBossForRound(isBigBoss)` |
| spawn_applyMinionShape | method | L1944 | L2093 | 150 | `spawn_applyMinionShape(e)` |
| spawn_triggerBossEntranceShockwave | method | L2094 | L2236 | 143 | `spawn_triggerBossEntranceShockwave(boss)` |

## 巨型函数内部节点 (@section 标记)

### spawn_spawnEnemyRowAt (L225-L611, 387行)

| 节点标记 | 行号 | 说明 |
|----------|------|------|
| `@section:spawn_enemy_type_select` | L286 | 敌人类型选择与词缀分配 |
| `@section:spawn_position_calc` | L480 | 生成位置计算与间距分布 |
| `@section:spawn_entity_init` | L541 | 敌人实体初始化与注入游戏状态 |

### spawn_spawnBullet (L1110-L1357, 248行)

| 节点标记 | 行号 | 说明 |
|----------|------|------|
| `@section:bullet_velocity_calc` | L1184 | 子弹速度与方向计算 |
| `@section:bullet_entity_create` | L1245 | 子弹实体创建与属性注入 |
| `@section:bullet_pool_push` | L1306 | 子弹推入对象池与粒子预热 |

## 其他 @section 标记

| 节点标记 | 行号 | 说明 |
|----------|------|------|
| `@section:spawn_row_config` | L224 | 行配置读取：波次参数与难度缩放 |
| `@section:bullet_recipe_parse` | L1109 | 弹药配方解析与属性提取 |
