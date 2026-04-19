# src/spawn_system.js 函数索引

> 自动生成于 2026-04-19 | 总行数: 2028 | 函数数: 28 | 语言: javascript
> **本文件由 code-indexer 脚本自动生成，严禁手动编辑。**

**巨型函数警告**: 本文件包含 2 个超过 200 行的函数，建议优先通过 `@section` 标记进行内部导航。

## 函数列表

| 函数名 | 类型 | 起始行 | 结束行 | 行数 | 签名 |
|--------|------|--------|--------|------|------|
| spawn_windSkillParticles | method | L21 | L84 | 64 | `spawn_windSkillParticles(type, rect, progress)` |
| spawn_createFloatingText | method | L85 | L91 | 7 | `spawn_createFloatingText(x, y, text, color, fontSize)` |
| spawn_generateAffixes | method | L92 | L167 | 76 | `spawn_generateAffixes()` |
| spawn_spawnEnemyRowAt | method | L168 | L428 | **261** | `spawn_spawnEnemyRowAt(yPos)` |
| spawn_addSkillPoint | method | L429 | L439 | 11 | `spawn_addSkillPoint(amount = 1)` |
| spawn_spawnEnemyRow | method | L440 | L445 | 6 | `spawn_spawnEnemyRow(count = 1)` |
| spawn_triggerCloneSpawn | method | L446 | L478 | 33 | `spawn_triggerCloneSpawn(sourceEnemy)` |
| spawn_smallWhirlwind | method | L479 | L513 | 35 | `spawn_smallWhirlwind(x, y)` |
| spawn_stormCore | method | L514 | L543 | 30 | `spawn_stormCore(x, y, radius, bulletDamage, bulletConfig)` |
| spawn_addScore | method | L544 | L555 | 12 | `spawn_addScore(amount)` |
| spawn_generateMarbleOptions | method | L556 | L728 | 173 | `spawn_generateMarbleOptions()` |
| spawn_showMarblePreview | method | L729 | L809 | 81 | `spawn_showMarblePreview(m, tbEntry, supplementDesc)` |
| spawn_createParticle | method | L810 | L876 | 67 | `spawn_createParticle(x, y, color, mode = 'normal')` |
| spawn_pushParticleWithLimit | method | L877 | L925 | 49 | `spawn_pushParticleWithLimit(p)` |
| spawn_spawnBullet | method | L926 | L1170 | **245** | `spawn_spawnBullet(x, y, vel, recipe, shotId = null, isLast = false)` |
| spawn_createExplosion | method | L1171 | L1183 | 13 | `spawn_createExplosion(x, y, color)` |
| spawn_createShockwave | method | L1184 | L1197 | 14 | `spawn_createShockwave(x, y, color = null)` |
| spawn_createHealWave | method | L1198 | L1212 | 15 | `spawn_createHealWave(x, y, range = 120)` |
| spawn_createHitFeedback | method | L1213 | L1307 | 95 | `spawn_createHitFeedback(x, y, velocity, type = 'normal')` |
| spawn_triggerLevelUpEvent | method | L1308 | L1350 | 43 | `spawn_triggerLevelUpEvent(uiX, uiY)` |
| spawn_scheduleNextBoss | method | L1351 | L1389 | 39 | `spawn_scheduleNextBoss(extraDelay = 0)` |
| spawn_checkBossRoundFor | method | L1390 | L1411 | 22 | `spawn_checkBossRoundFor(round)` |
| spawn_checkBossRound | method | L1412 | L1436 | 25 | `spawn_checkBossRound()` |
| spawn_calculateBossHP | method | L1437 | L1509 | 73 | `spawn_calculateBossHP(isBigBoss)` |
| spawn_spawnBoss | method | L1510 | L1708 | 199 | `spawn_spawnBoss(bossId, isBigBoss)` |
| spawn_selectBossForRound | method | L1709 | L1736 | 28 | `spawn_selectBossForRound(isBigBoss)` |
| spawn_applyMinionShape | method | L1737 | L1886 | 150 | `spawn_applyMinionShape(e)` |
| spawn_triggerBossEntranceShockwave | method | L1887 | L2029 | 143 | `spawn_triggerBossEntranceShockwave(boss)` |
