# src/combat_system.js 函数索引

> 自动生成于 2026-04-22 | 总行数: 3362 | 函数数: 42 | 语言: javascript
> **本文件由 code-indexer 脚本自动生成，严禁手动编辑。**

**巨型函数警告**: 本文件包含 5 个超过 200 行的函数，建议优先通过 `@section` 标记进行内部导航。

## 函数列表

> 定位方式：在源文件中 `grep -n "函数名"` 即可跳转，行号不在此列出（行号随代码变化而失效）。

| 函数名 | 类型 | 签名 | 备注 |
|--------|------|------|------|
| _runeCharge_draw | function | `_runeCharge_draw(chargeLevel)` |  |
| combat_createFloatingText | method | `combat_createFloatingText(x, y, text, color)` |  |
| combat_updateMulticastDisplay | method | `combat_updateMulticastDisplay(bonusAmount = 0)` |  |
| combat_playMulticastTransferEffect | method | `combat_playMulticastTransferEffect(multicastValue)` |  |
| combat_activateSkill | method | `combat_activateSkill(skill)` | ⚠️ 巨型函数，见 @section 导航 |
| combat_flyingSword_assignTarget | method | `combat_flyingSword_assignTarget(enemy)` |  |
| combat_flyingSword_addSon | method | `combat_flyingSword_addSon(x, y, mother, level, config, delay = 0)` |  |
| combat_wind_addAnchor | method | `combat_wind_addAnchor(x, y, bulletDamage = 2, bulletConfig = { wind: 1 })` |  |
| combat_wind_triggerSmallWhirlwindDamage | method | `combat_wind_triggerSmallWhirlwindDamage(centerX, centerY, bulletDamage = 2, bulletConfig = { wind: true })` |  |
| combat_wind_triggerMagicCircle | method | `combat_wind_triggerMagicCircle()` |  |
| combat_wind_executeCircleEffect | method | `combat_wind_executeCircleEffect(x, y, w, h, size, shape, element, tunnelVector = null, bulletDamage = 2, bulletC)` | ⚠️ 巨型函数，见 @section 导航 |
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
| combat_damageEnemy | method | `combat_damageEnemy(enemy, projectile, damageOverride = null)` | ⚠️ 巨型函数，见 @section 导航 |
| combat_fireNextShot | method | `combat_fireNextShot(vel)` | ⚠️ 巨型函数，见 @section 导航 |
| combat_laser_fire | method | `combat_laser_fire(startX, startY, vel, recipe, shotId = null, isTickFire = false)` | ⚠️ 巨型函数，见 @section 导航 |
| combat_bladeStorm_update | method | `combat_bladeStorm_update(timeScale)` |  |
| combat_continuousLaser_update | method | `combat_continuousLaser_update(timeScale = 1)` |  |
| _laser_blendRefractionColor | method | `_laser_blendRefractionColor(baseColor)` |  |
| combat_updateHitProgress | method | `combat_updateHitProgress(val, target)` |  |
| combat_runeCharge_init | method | `combat_runeCharge_init()` |  |
| combat_runeCharge_initUI | method | `combat_runeCharge_initUI()` |  |
| combat_runeCharge_onHit | method | `combat_runeCharge_onHit(hitX, hitY, isKill = false)` |  |
| combat_runeCharge_levelUp | method | `combat_runeCharge_levelUp()` |  |
| combat_runeCharge_decay | method | `combat_runeCharge_decay(timeScale)` |  |
| combat_runeCharge_updateUI | method | `combat_runeCharge_updateUI()` |  |
| combat_runeCharge_claimReward | method | `combat_runeCharge_claimReward()` |  |
| combat_checkBossPhaseChange | method | `combat_checkBossPhaseChange()` |  |
| combat_triggerBossEnrage | method | `combat_triggerBossEnrage(boss)` |  |
| _triggerDeathFX | method | `_triggerDeathFX(enemy, shotId)` |  |

## 巨型函数内部节点 (@section 标记)

### combat_activateSkill

> 定位：`grep -n '@section:{}'` 跳转到对应节点

| 节点标记 | 说明 |
|----------|------|
| `@section:skill_cooldown_and_cost` | 冷却时间检查与能量消耗 |
| `@section:skill_effect_apply` | 技能效果应用（伤害/增益/召唤） |
| `@section:skill_visual_feedback` | 技能视觉反馈与音效触发 |

### combat_wind_executeCircleEffect

> 定位：`grep -n '@section:{}'` 跳转到对应节点

| 节点标记 | 说明 |
|----------|------|
| `@section:wind_circle_hit_detection` | 风圈范围内敌人命中检测 |
| `@section:wind_circle_damage_apply` | 风圈伤害应用与属性反应 |
| `@section:wind_circle_visual_effects` | 风圈视觉特效与粒子生成 |

### combat_damageEnemy

> 定位：`grep -n '@section:{}'` 跳转到对应节点

| 节点标记 | 说明 |
|----------|------|
| `@section:damage_element_bonus` | 属性加成与克制倍率计算 |
| `@section:damage_runeword_hooks` | 符文词条 Hook 注入点 |
| `@section:damage_apply_to_enemy` | 伤害写入敌人并触发属性反应 |
| `@section:damage_kill_check` | 击杀判断与掉落物/经验触发 |
| `@section:damage_dda_feedback` | 动态难度调整（DDA）数据采集 |
| `@section:damage_visual_and_audio` | 伤害视觉反馈与音效播放 |
| `@section:fire_ammo_selection` | 弹药选择与配方读取 |

### combat_fireNextShot

> 定位：`grep -n '@section:{}'` 跳转到对应节点

| 节点标记 | 说明 |
|----------|------|
| `@section:fire_trajectory_calc` | 弹道计算与散射角度 |
| `@section:fire_projectile_spawn` | 子弹实体生成与属性注入 |
| `@section:fire_post_effects` | 射击后效果：后坐力/音效/HUD更新 |
| `@section:laser_ray_cast` | 激光射线投射与穿透检测 |

### combat_laser_fire

> 定位：`grep -n '@section:{}'` 跳转到对应节点

| 节点标记 | 说明 |
|----------|------|
| `@section:laser_hit_processing` | 激光命中处理与连锁反应 |
| `@section:laser_visual_beam` | 激光光束视觉渲染 |

## 其他 @section 标记

| 节点标记 | 说明 |
|----------|------|
| `@section:skill_type_dispatch` | 技能类型分发：主动/被动/触发分支 |
| `@section:wind_circle_geometry` | 风圈几何计算与碰撞范围确定 |
| `@section:damage_pre_calc` | 伤害前置计算：基础值、暴击、穿透 |
