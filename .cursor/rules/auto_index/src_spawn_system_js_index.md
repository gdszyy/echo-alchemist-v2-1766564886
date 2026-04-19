# src/spawn_system.js 函数索引

> 自动生成于 2026-04-19 | 总行数: 2036 | 函数数: 28 | 语言: javascript
> **本文件由 code-indexer 脚本自动生成，严禁手动编辑。**

**巨型函数警告**: 本文件包含 2 个超过 200 行的函数，建议优先通过 `@section` 标记进行内部导航。

## 函数列表

| 函数名 | 类型 | 起始行 | 结束行 | 行数 | 签名 |
|--------|------|--------|--------|------|------|
| spawn_windSkillParticles | method | L21 | L84 | 64 | `spawn_windSkillParticles(type, rect, progress)` |
| spawn_createFloatingText | method | L85 | L91 | 7 | `spawn_createFloatingText(x, y, text, color, fontSize)` |
| spawn_generateAffixes | method | L92 | L168 | 77 | `spawn_generateAffixes()` |
| spawn_spawnEnemyRowAt | method | L169 | L432 | **264** | `spawn_spawnEnemyRowAt(yPos)` |
| spawn_addSkillPoint | method | L433 | L443 | 11 | `spawn_addSkillPoint(amount = 1)` |
| spawn_spawnEnemyRow | method | L444 | L449 | 6 | `spawn_spawnEnemyRow(count = 1)` |
| spawn_triggerCloneSpawn | method | L450 | L482 | 33 | `spawn_triggerCloneSpawn(sourceEnemy)` |
| spawn_smallWhirlwind | method | L483 | L517 | 35 | `spawn_smallWhirlwind(x, y)` |
| spawn_stormCore | method | L518 | L547 | 30 | `spawn_stormCore(x, y, radius, bulletDamage, bulletConfig)` |
| spawn_addScore | method | L548 | L559 | 12 | `spawn_addScore(amount)` |
| spawn_generateMarbleOptions | method | L560 | L732 | 173 | `spawn_generateMarbleOptions()` |
| spawn_showMarblePreview | method | L733 | L813 | 81 | `spawn_showMarblePreview(m, tbEntry, supplementDesc)` |
| spawn_createParticle | method | L814 | L880 | 67 | `spawn_createParticle(x, y, color, mode = 'normal')` |
| spawn_pushParticleWithLimit | method | L881 | L930 | 50 | `spawn_pushParticleWithLimit(p)` |
| spawn_spawnBullet | method | L931 | L1178 | **248** | `spawn_spawnBullet(x, y, vel, recipe, shotId = null, isLast = false)` |
| spawn_createExplosion | method | L1179 | L1191 | 13 | `spawn_createExplosion(x, y, color)` |
| spawn_createShockwave | method | L1192 | L1205 | 14 | `spawn_createShockwave(x, y, color = null)` |
| spawn_createHealWave | method | L1206 | L1220 | 15 | `spawn_createHealWave(x, y, range = 120)` |
| spawn_createHitFeedback | method | L1221 | L1315 | 95 | `spawn_createHitFeedback(x, y, velocity, type = 'normal')` |
| spawn_triggerLevelUpEvent | method | L1316 | L1358 | 43 | `spawn_triggerLevelUpEvent(uiX, uiY)` |
| spawn_scheduleNextBoss | method | L1359 | L1397 | 39 | `spawn_scheduleNextBoss(extraDelay = 0)` |
| spawn_checkBossRoundFor | method | L1398 | L1419 | 22 | `spawn_checkBossRoundFor(round)` |
| spawn_checkBossRound | method | L1420 | L1444 | 25 | `spawn_checkBossRound()` |
| spawn_calculateBossHP | method | L1445 | L1517 | 73 | `spawn_calculateBossHP(isBigBoss)` |
| spawn_spawnBoss | method | L1518 | L1716 | 199 | `spawn_spawnBoss(bossId, isBigBoss)` |
| spawn_selectBossForRound | method | L1717 | L1744 | 28 | `spawn_selectBossForRound(isBigBoss)` |
| spawn_applyMinionShape | method | L1745 | L1894 | 150 | `spawn_applyMinionShape(e)` |
| spawn_triggerBossEntranceShockwave | method | L1895 | L2037 | 143 | `spawn_triggerBossEntranceShockwave(boss)` |

## 巨型函数内部节点 (@section 标记)

### spawn_spawnEnemyRowAt (L169-L432, 264行)

| 节点标记 | 行号 | 说明 |
|----------|------|------|
| `@section:spawn_enemy_type_select` | L231 | 敌人类型选择与词缀分配 |
| `@section:spawn_position_calc` | L312 | 生成位置计算与间距分布 |
| `@section:spawn_entity_init` | L373 | 敌人实体初始化与注入游戏状态 |

### spawn_spawnBullet (L931-L1178, 248行)

| 节点标记 | 行号 | 说明 |
|----------|------|------|
| `@section:bullet_velocity_calc` | L1005 | 子弹速度与方向计算 |
| `@section:bullet_entity_create` | L1066 | 子弹实体创建与属性注入 |
| `@section:bullet_pool_push` | L1127 | 子弹推入对象池与粒子预热 |

## 其他 @section 标记

| 节点标记 | 行号 | 说明 |
|----------|------|------|
| `@section:spawn_row_config` | L168 | 行配置读取：波次参数与难度缩放 |
| `@section:bullet_recipe_parse` | L930 | 弹药配方解析与属性提取 |
