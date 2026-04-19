# src/combat_system.js 函数索引

> 自动生成于 2026-04-19 | 总行数: 3305 | 函数数: 42 | 语言: javascript
> **本文件由 code-indexer 脚本自动生成，严禁手动编辑。**

**巨型函数警告**: 本文件包含 5 个超过 200 行的函数，建议优先通过 `@section` 标记进行内部导航。

## 函数列表

| 函数名 | 类型 | 起始行 | 结束行 | 行数 | 签名 |
|--------|------|--------|--------|------|------|
| _runeCharge_draw | function | L33 | L64 | 32 | `_runeCharge_draw(chargeLevel)` |
| combat_createFloatingText | method | L65 | L72 | 8 | `combat_createFloatingText(x, y, text, color)` |
| combat_updateMulticastDisplay | method | L73 | L83 | 11 | `combat_updateMulticastDisplay(bonusAmount = 0)` |
| combat_playMulticastTransferEffect | method | L84 | L94 | 11 | `combat_playMulticastTransferEffect(multicastValue)` |
| combat_activateSkill | method | L95 | L356 | **262** | `combat_activateSkill(skill)` |
| combat_flyingSword_assignTarget | method | L357 | L375 | 19 | `combat_flyingSword_assignTarget(enemy)` |
| combat_flyingSword_addSon | method | L376 | L402 | 27 | `combat_flyingSword_addSon(x, y, mother, level, config, delay = 0)` |
| combat_wind_addAnchor | method | L403 | L420 | 18 | `combat_wind_addAnchor(x, y, bulletDamage = 2, bulletConfig = { wind: 1 })` |
| combat_wind_triggerSmallWhirlwindDamage | method | L421 | L453 | 33 | `combat_wind_triggerSmallWhirlwindDamage(centerX, centerY, bulletDamage = 2, bulletConfig = { wind: true })` |
| combat_wind_triggerMagicCircle | method | L454 | L550 | 97 | `combat_wind_triggerMagicCircle()` |
| combat_wind_executeCircleEffect | method | L551 | L842 | **292** | `combat_wind_executeCircleEffect(x, y, w, h, size, shape, element, tunnelVector = null, bulletDamage = 2, bulletC)` |
| combat_wind_triggerButterflyCircle | method | L843 | L905 | 63 | `combat_wind_triggerButterflyCircle()` |
| combat_wind_updateButterflyCircles | method | L906 | L932 | 27 | `combat_wind_updateButterflyCircles(timeScale)` |
| combat_wind_fireButterflyBlades | method | L933 | L979 | 47 | `combat_wind_fireButterflyBlades(bc)` |
| combat_wind_updateButterflyBlades | method | L980 | L1034 | 55 | `combat_wind_updateButterflyBlades(timeScale)` |
| combat_wind_drawButterflyCircles | method | L1035 | L1077 | 43 | `combat_wind_drawButterflyCircles(ctx)` |
| combat_wind_drawButterflyBlades | method | L1078 | L1149 | 72 | `combat_wind_drawButterflyBlades(ctx)` |
| combat_wind_updateStormCores | method | L1150 | L1184 | 35 | `combat_wind_updateStormCores(timeScale)` |
| combat_wind_releaseStormCoreCyclone | method | L1185 | L1217 | 33 | `combat_wind_releaseStormCoreCyclone(core)` |
| combat_wind_updateActiveCyclones | method | L1218 | L1275 | 58 | `combat_wind_updateActiveCyclones(timeScale)` |
| combat_wind_updateActiveStrangles | method | L1276 | L1326 | 51 | `combat_wind_updateActiveStrangles(timeScale)` |
| combat_wind_updateActiveTunnels | method | L1327 | L1367 | 41 | `combat_wind_updateActiveTunnels(timeScale)` |
| combat_wind_drawStormCores | method | L1368 | L1430 | 63 | `combat_wind_drawStormCores(ctx)` |
| combat_wind_mergeStormCores | method | L1431 | L1488 | 58 | `combat_wind_mergeStormCores()` |
| combat_wind_decayStormCoresEnergy | method | L1489 | L1504 | 16 | `combat_wind_decayStormCoresEnergy()` |
| combat_damageEnemy | method | L1505 | L2293 | **789** | `combat_damageEnemy(enemy, projectile, damageOverride = null)` |
| combat_fireNextShot | method | L2294 | L2517 | **224** | `combat_fireNextShot(vel)` |
| combat_laser_fire | method | L2518 | L2738 | **221** | `combat_laser_fire(startX, startY, vel, recipe, shotId = null, isTickFire = false)` |
| combat_bladeStorm_update | method | L2739 | L2796 | 58 | `combat_bladeStorm_update(timeScale)` |
| combat_continuousLaser_update | method | L2797 | L2858 | 62 | `combat_continuousLaser_update(timeScale = 1)` |
| _laser_blendRefractionColor | method | L2859 | L2892 | 34 | `_laser_blendRefractionColor(baseColor)` |
| combat_updateHitProgress | method | L2893 | L2903 | 11 | `combat_updateHitProgress(val, target)` |
| combat_runeCharge_init | method | L2904 | L2915 | 12 | `combat_runeCharge_init()` |
| combat_runeCharge_initUI | method | L2916 | L2930 | 15 | `combat_runeCharge_initUI()` |
| combat_runeCharge_onHit | method | L2931 | L2966 | 36 | `combat_runeCharge_onHit(hitX, hitY, isKill = false)` |
| combat_runeCharge_levelUp | method | L2967 | L2986 | 20 | `combat_runeCharge_levelUp()` |
| combat_runeCharge_decay | method | L2987 | L2998 | 12 | `combat_runeCharge_decay(timeScale)` |
| combat_runeCharge_updateUI | method | L2999 | L3011 | 13 | `combat_runeCharge_updateUI()` |
| combat_runeCharge_claimReward | method | L3012 | L3045 | 34 | `combat_runeCharge_claimReward()` |
| combat_checkBossPhaseChange | method | L3046 | L3060 | 15 | `combat_checkBossPhaseChange()` |
| combat_triggerBossEnrage | method | L3061 | L3154 | 94 | `combat_triggerBossEnrage(boss)` |
| _triggerDeathFX | method | L3155 | L3306 | 152 | `_triggerDeathFX(enemy, shotId)` |
