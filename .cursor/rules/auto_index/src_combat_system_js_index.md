# src\combat_system.js 函数索引

> 自动生成于 2026-07-22 | 总行数: 6381 | 函数数: 115 | 语言: javascript
> **本文件由 code-indexer 脚本自动生成，严禁手动编辑。**

**巨型函数警告**: 本文件包含 6 个超过 200 行的函数，建议优先通过 `@section` 标记进行内部导航。

## 函数列表

> 定位方式：在源文件中 `grep -n "函数名"` 即可跳转，行号不在此列出（行号随代码变化而失效）。

| 函数名 | 类型 | 签名 | 备注 |
|--------|------|------|------|
| combat_createFloatingText | method | `combat_createFloatingText(x, y, text, color)` |  |
| combat_spreadVenomStacks | method | `combat_spreadVenomStacks(sourceEnemy, targets, totalStacks)` |  |
| combat_activatePotionSpell | method | `combat_activatePotionSpell()` |  |
| combat_getPotionVfxProfile | method | `combat_getPotionVfxProfile(potionDef)` |  |
| combat_resolvePotionVfxPoint | method | `combat_resolvePotionVfxPoint(targets = [], opts = {})` |  |
| combat_getPotionVfxBudget | method | `combat_getPotionVfxBudget(targetMode = 'cluster_center')` |  |
| combat_spawnPotionVfxParticle | method | `combat_spawnPotionVfxParticle(x, y, color, mode = 'spark', opts = {})` |  |
| combat_emitPotionRadialParticles | method | `combat_emitPotionRadialParticles(point, color, mode, count, opts = {})` |  |
| combat_emitPotionArcingTrail | method | `combat_emitPotionArcingTrail(profile, origin, point, color, targetMode)` |  |
| combat_emitPotionTargetAccents | method | `combat_emitPotionTargetAccents(profile, targets, color, targetMode)` |  |
| combat_emitPotionShortBolts | method | `combat_emitPotionShortBolts(point, count, radius = 46)` |  |
| combat_playPotionShatterVFX | method | `combat_playPotionShatterVFX(profile, targets, ctx)` |  |
| combat_playPotionBottleVFX | method | `combat_playPotionBottleVFX(potionDef, targets = [], opts = {})` |  |
| combat_buildSpellFormVfxContext | method | `combat_buildSpellFormVfxContext(profile, spellDef, targets = [], opts = {})` |  |
| combat_emitSpellFormCastCue | method | `combat_emitSpellFormCastCue(profile, ctx)` |  |
| combat_emitSpellFormLabel | method | `combat_emitSpellFormLabel(profile, ctx, offset = 32)` |  |
| combat_resolveSpellReleaseProfile | method | `combat_resolveSpellReleaseProfile(profile, preferred = null)` |  |
| combat_playSpellOrbVFX | method | `combat_playSpellOrbVFX(profile, targets = [], ctx)` |  |
| combat_playSpellMineVFX | method | `combat_playSpellMineVFX(profile, targets = [], ctx)` |  |
| combat_playSpellOrbitVFX | method | `combat_playSpellOrbitVFX(profile, targets = [], ctx)` |  |
| combat_playSpellSlashVFX | method | `combat_playSpellSlashVFX(profile, targets = [], ctx)` |  |
| combat_playSpellBeamVFX | method | `combat_playSpellBeamVFX(profile, targets = [], ctx)` |  |
| combat_playSpellMeteorVFX | method | `combat_playSpellMeteorVFX(profile, targets = [], ctx)` |  |
| combat_playSpellSweepingLaserVFX | method | `combat_playSpellSweepingLaserVFX(profile, targets = [], ctx)` |  |
| combat_playSpellTowerVFX | method | `combat_playSpellTowerVFX(profile, targets = [], ctx)` |  |
| combat_playSpellFormVFX | method | `combat_playSpellFormVFX(spellDef, targets = [], opts = {})` |  |
| combat_getPotionSpellTreeRoot | method | `combat_getPotionSpellTreeRoot(potionDef, prepared = {})` |  |
| combat_buildPotionSpellDef | method | `combat_buildPotionSpellDef(potionDef, node = null)` |  |
| combat_applyPotionSpellTree | method | `combat_applyPotionSpellTree(potionDef, prepared)` |  |
| combat_spawnPotionOrbCarrier | method | `combat_spawnPotionOrbCarrier(spellDef, targets = [], opts = {})` |  |
| combat_updatePotionOrbCarrier | method | `combat_updatePotionOrbCarrier(carrier, timeScale = 1, ctx = null)` |  |
| combat_releasePotionOrbCarrier | method | `combat_releasePotionOrbCarrier(carrier)` |  |
| combat_getPotionTowerStats | method | `combat_getPotionTowerStats(prepared = {}, root = {})` |  |
| combat_getPotionTowerHitbox | method | `combat_getPotionTowerHitbox(tower)` |  |
| combat_isEnemyTouchingPotionTower | method | `combat_isEnemyTouchingPotionTower(enemy, tower)` |  |
| combat_getPotionTowerContactDamage | method | `combat_getPotionTowerContactDamage(tower, enemy)` |  |
| combat_applyPotionTowerBlocker | method | `combat_applyPotionTowerBlocker(tower, enemy, timeScale = 1)` |  |
| combat_spawnPotionTower | method | `combat_spawnPotionTower(potionDef, prepared, root)` |  |
| combat_selectPotionTowerTargets | method | `combat_selectPotionTowerTargets(tower, limit = 1)` |  |
| combat_potionTowerPulse | method | `combat_potionTowerPulse(tower, reason = 'active')` |  |
| combat_destroyPotionTower | method | `combat_destroyPotionTower(tower, reason = 'expired')` |  |
| combat_updatePotionTower | method | `combat_updatePotionTower(tower, timeScale = 1, ctx = null)` |  |
| combat_updatePotionRuntime | method | `combat_updatePotionRuntime(timeScale = 1, ctx = null)` |  |
| combat_applyPotionSpell | method | `combat_applyPotionSpell(potionDef, prepared)` |  |
| combat_applyPotionSpellContent | method | `combat_applyPotionSpellContent(potionDef, prepared, opts = {})` |  |
| playReleaseVfx | function | `playReleaseVfx(targets, releaseOpts = {})` |  |
| damage | function | `damage(mult = 1)` |  |
| flash | function | `flash(duration = 180)` |  |
| impact | function | `impact(targets, opts = {})` |  |
| requireEnemies | function | `requireEnemies()` |  |
| requireAmmo | function | `requireAmmo()` |  |
| combat_updateMulticastDisplay | method | `combat_updateMulticastDisplay(bonusAmount = 0)` |  |
| combat_playMulticastTransferEffect | method | `combat_playMulticastTransferEffect(multicastValue)` |  |
| combat_getSkillVisualTier | method | `combat_getSkillVisualTier(skill)` |  |
| combat_getSkillVisualColor | method | `combat_getSkillVisualColor(skill)` |  |
| combat_playSkillCastVFX | method | `combat_playSkillCastVFX(skill, opts = {})` |  |
| combat_playSkillImpactVFX | method | `combat_playSkillImpactVFX(skill, targets, opts = {})` |  |
| combat_activateSkill | method | `combat_activateSkill(skill)` | ⚠️ 巨型函数，见 @section 导航 |
| combat_recomputeActiveSkills | method | `combat_recomputeActiveSkills(opts = {})` |  |
| combat_activateSkillExtended | method | `combat_activateSkillExtended(skill, p, method)` | ⚠️ 巨型函数，见 @section 导航 |
| combat_flyingSword_assignTarget | method | `combat_flyingSword_assignTarget(enemy)` |  |
| combat_flyingSword_addSon | method | `combat_flyingSword_addSon(x, y, mother, level, config, delay = 0)` |  |
| combat_wind_addAnchor | method | `combat_wind_addAnchor(x, y, bulletDamage = 2, bulletConfig = { wind: 1 })` |  |
| combat_wind_triggerSmallWhirlwindDamage | method | `combat_wind_triggerSmallWhirlwindDamage(centerX, centerY, bulletDamage = 2, bulletConfig = { wind: true })` |  |
| combat_wind_triggerMagicCircle | method | `combat_wind_triggerMagicCircle()` |  |
| combat_wind_executeCircleEffect | method | `combat_wind_executeCircleEffect(x, y, w, h, size, shape, element, tunnelVector = null, bulletDamage = 2, bulletConfig = null, type = 'burst')` | ⚠️ 巨型函数，见 @section 导航 |
| combat_wind_triggerButterflyCircle | method | `combat_wind_triggerButterflyCircle()` |  |
| combat_wind_updateButterflyCircles | method | `combat_wind_updateButterflyCircles(timeScale)` |  |
| combat_wind_fireButterflyBlades | method | `combat_wind_fireButterflyBlades(bc)` |  |
| combat_wind_updateButterflyBlades | method | `combat_wind_updateButterflyBlades(timeScale)` |  |
| combat_wind_drawButterflyCircles | method | `combat_wind_drawButterflyCircles(ctx)` |  |
| combat_wind_drawButterflyBlades | method | `combat_wind_drawButterflyBlades(ctx)` |  |
| combat_wind_updateStormCores | method | `combat_wind_updateStormCores(timeScale)` |  |
| combat_wind_releaseStormCoreCyclone | method | `combat_wind_releaseStormCoreCyclone(core)` |  |
| combat_wind_updateActiveCyclones | method | `combat_wind_updateActiveCyclones(timeScale)` |  |
| combat_wind_updateActiveStrangles | method | `combat_wind_updateActiveStrangles(timeScale)` |  |
| combat_wind_updateActiveTunnels | method | `combat_wind_updateActiveTunnels(timeScale)` |  |
| combat_wind_drawStormCores | method | `combat_wind_drawStormCores(ctx)` |  |
| combat_wind_mergeStormCores | method | `combat_wind_mergeStormCores()` |  |
| combat_wind_decayStormCoresEnergy | method | `combat_wind_decayStormCoresEnergy()` |  |
| combat_getProjectileVulnerabilityAttrs | method | `combat_getProjectileVulnerabilityAttrs(config = {}, projectile = null)` |  |
| add | function | `add(attr, value = 0)` |  |
| combat_getBossVulnerabilityProfile | method | `combat_getBossVulnerabilityProfile(boss)` |  |
| combat_applyBossVulnerability | method | `combat_applyBossVulnerability(enemy, config = {}, projectile = null, dmg = 0)` |  |
| combat_updateBossVulnerabilityProgress | method | `combat_updateBossVulnerabilityProgress(enemy, bossVulnerability, actualDamage = 0)` |  |
| combat_getHitFeedbackLabel | method | `combat_getHitFeedbackLabel(enemy, config = {}, projectile = null, damageResult = null, context = {})` |  |
| combat_damageEnemy | method | `combat_damageEnemy(enemy, projectile, damageOverride = null)` | ⚠️ 巨型函数，见 @section 导航 |
| combat_applyExplosionKnockback | method | `combat_applyExplosionKnockback(cx, cy, radius = 100, maxOffset = 12)` |  |
| combat_fireNextShot | method | `combat_fireNextShot(vel, origin = null)` | ⚠️ 巨型函数，见 @section 导航 |
| combat_laser_fire | method | `combat_laser_fire(startX, startY, vel, recipe, shotId = null, isTickFire = false)` | ⚠️ 巨型函数，见 @section 导航 |
| combat_triggerFrostNova | method | `combat_triggerFrostNova(centerPos, sourceConfig, novaParams, probMult = 1.0, chainDepth = 0)` |  |
| combat_bladeStorm_update | method | `combat_bladeStorm_update(timeScale)` |  |
| _bladeStorm_killVortex | method | `_bladeStorm_killVortex()` |  |
| combat_continuousLaser_update | method | `combat_continuousLaser_update(timeScale = 1)` |  |
| _laser_blendRefractionColor | method | `_laser_blendRefractionColor(baseColor)` |  |
| combat_updateHitProgress | method | `combat_updateHitProgress(val, target)` |  |
| relic_runRoundStartHooks | method | `relic_runRoundStartHooks()` |  |
| combat_skillCharge_init | method | `combat_skillCharge_init(preservePersistent = false)` |  |
| combat_skillCharge_initUI | method | `combat_skillCharge_initUI()` |  |
| combat_skillCharge_onHit | method | `combat_skillCharge_onHit(hitX, hitY, isKill = false)` |  |
| combat_skillCharge_tryAward | method | `combat_skillCharge_tryAward()` |  |
| combat_skillCharge_decay | method | `combat_skillCharge_decay(timeScale)` |  |
| combat_skillCharge_updateUI | method | `combat_skillCharge_updateUI()` |  |
| combat_skillCharge_syncLegacyState | method | `combat_skillCharge_syncLegacyState()` |  |
| combat_runeCharge_init | method | `combat_runeCharge_init(preservePersistent = false)` |  |
| combat_runeCharge_initUI | method | `combat_runeCharge_initUI()` |  |
| combat_runeCharge_onHit | method | `combat_runeCharge_onHit(hitX, hitY, isKill = false)` |  |
| combat_runeCharge_levelUp | method | `combat_runeCharge_levelUp()` |  |
| combat_runeCharge_decay | method | `combat_runeCharge_decay(timeScale)` |  |
| combat_runeCharge_updateUI | method | `combat_runeCharge_updateUI()` |  |
| combat_runeCharge_claimReward | method | `combat_runeCharge_claimReward()` |  |
| combat_checkBossPhaseChange | method | `combat_checkBossPhaseChange()` |  |
| combat_triggerBossEnrage | method | `combat_triggerBossEnrage(boss)` |  |
| _triggerDeathFX | method | `_triggerDeathFX(enemy, shotId, options = {})` |  |
| _triggerVenomDeathFX | method | `_triggerVenomDeathFX(enemy, x, y, tier)` |  |

## 巨型函数内部节点 (@section 标记)

### combat_activateSkill

> 定位：`grep -n '@section:节点名'` 跳转到对应节点

| 节点标记 | 说明 |
|----------|------|
| `@section:skill_cooldown_and_cost` | 冷却时间检查与能量消耗 |
| `@section:skill_effect_apply` | 技能效果应用（伤害/增益/召唤） |
| `@section:skill_visual_feedback` | 技能视觉反馈与音效触发 |

### combat_activateSkillExtended

> **缺少 @section 标记**：此巨型函数内部没有节点标记，建议添加以提升导航精度。

### combat_wind_executeCircleEffect

> 定位：`grep -n '@section:节点名'` 跳转到对应节点

| 节点标记 | 说明 |
|----------|------|
| `@section:wind_circle_hit_detection` | 风圈范围内敌人命中检测 |
| `@section:wind_circle_damage_apply` | 风圈伤害应用与属性反应 |
| `@section:wind_circle_visual_effects` | 风圈视觉特效与粒子生成 |

### combat_damageEnemy

> 定位：`grep -n '@section:节点名'` 跳转到对应节点

| 节点标记 | 说明 |
|----------|------|
| `@section:damage_element_bonus` | 属性加成与共鸣倍率计算 |
| `@section:damage_runeword_hooks` | 符文词条 Hook 注入点 |
| `@section:damage_apply_to_enemy` | 伤害写入敌人并触发属性反应 |
| `@section:damage_kill_check` | 击杀判断与掉落物/经验触发 |
| `@section:damage_dda_feedback` | 动态难度调整（DDA）数据采集 |
| `@section:damage_visual_and_audio` | 伤害视觉反馈与音效播放 |

### combat_fireNextShot

> 定位：`grep -n '@section:节点名'` 跳转到对应节点

| 节点标记 | 说明 |
|----------|------|
| `@section:fire_trajectory_calc` | 弹道计算与散射角度 |
| `@section:fire_projectile_spawn` | 子弹实体生成与属性注入 |
| `@section:fire_post_effects` | 射击后效果：后坐力/音效/HUD更新 |

### combat_laser_fire

> 定位：`grep -n '@section:节点名'` 跳转到对应节点

| 节点标记 | 说明 |
|----------|------|
| `@section:laser_hit_processing` | 激光命中处理与连锁反应 |
| `@section:laser_visual_beam` | 激光光束视觉渲染 |
| `@section:laser_audio` | 激光束发射音效（sawtooth，频率随宽度反比：越粗越低沉，100~800Hz） |


## 其他 @section 标记

| 节点标记 | 说明 |
|----------|------|
| `@section:skill_type_dispatch` | 技能类型分发：主动/被动/触发分支 |
| `@section:wind_circle_geometry` | 风圈几何计算与碰撞范围确定 |
| `@section:damage_pre_calc` | 伤害前置计算：基础值、暴击、穿透 |
| `@section:fire_ammo_selection` | 弹药选择与配方读取 |
| `@section:laser_ray_cast` | 激光射线投射与穿透检测 |
| `@section:rune_charge_levelup_audio` | 充能满条发放技能点音效（520Hz sine，轻柔上升感） |
