# src/combat_system.js 函数索引

> 自动生成于 2026-04-19 | 总行数: 3331 | 函数数: 42 | 语言: javascript
> **本文件由 code-indexer 脚本自动生成，严禁手动编辑。**

**巨型函数警告**: 本文件包含 5 个超过 200 行的函数，建议优先通过 `@section` 标记进行内部导航。

## 函数列表

| 函数名 | 类型 | 起始行 | 结束行 | 行数 | 签名 |
|--------|------|--------|--------|------|------|
| _runeCharge_draw | function | L33 | L64 | 32 | `_runeCharge_draw(chargeLevel)` |
| combat_createFloatingText | method | L65 | L72 | 8 | `combat_createFloatingText(x, y, text, color)` |
| combat_updateMulticastDisplay | method | L73 | L83 | 11 | `combat_updateMulticastDisplay(bonusAmount = 0)` |
| combat_playMulticastTransferEffect | method | L84 | L95 | 12 | `combat_playMulticastTransferEffect(multicastValue)` |
| combat_activateSkill | method | L96 | L360 | **265** | `combat_activateSkill(skill)` |
| combat_flyingSword_assignTarget | method | L361 | L379 | 19 | `combat_flyingSword_assignTarget(enemy)` |
| combat_flyingSword_addSon | method | L380 | L406 | 27 | `combat_flyingSword_addSon(x, y, mother, level, config, delay = 0)` |
| combat_wind_addAnchor | method | L407 | L424 | 18 | `combat_wind_addAnchor(x, y, bulletDamage = 2, bulletConfig = { wind: 1 })` |
| combat_wind_triggerSmallWhirlwindDamage | method | L425 | L457 | 33 | `combat_wind_triggerSmallWhirlwindDamage(centerX, centerY, bulletDamage = 2, bulletConfig = { wind: true })` |
| combat_wind_triggerMagicCircle | method | L458 | L555 | 98 | `combat_wind_triggerMagicCircle()` |
| combat_wind_executeCircleEffect | method | L556 | L850 | **295** | `combat_wind_executeCircleEffect(x, y, w, h, size, shape, element, tunnelVector = null, bulletDamage = 2, bulletC)` |
| combat_wind_triggerButterflyCircle | method | L851 | L913 | 63 | `combat_wind_triggerButterflyCircle()` |
| combat_wind_updateButterflyCircles | method | L914 | L940 | 27 | `combat_wind_updateButterflyCircles(timeScale)` |
| combat_wind_fireButterflyBlades | method | L941 | L987 | 47 | `combat_wind_fireButterflyBlades(bc)` |
| combat_wind_updateButterflyBlades | method | L988 | L1042 | 55 | `combat_wind_updateButterflyBlades(timeScale)` |
| combat_wind_drawButterflyCircles | method | L1043 | L1085 | 43 | `combat_wind_drawButterflyCircles(ctx)` |
| combat_wind_drawButterflyBlades | method | L1086 | L1157 | 72 | `combat_wind_drawButterflyBlades(ctx)` |
| combat_wind_updateStormCores | method | L1158 | L1192 | 35 | `combat_wind_updateStormCores(timeScale)` |
| combat_wind_releaseStormCoreCyclone | method | L1193 | L1225 | 33 | `combat_wind_releaseStormCoreCyclone(core)` |
| combat_wind_updateActiveCyclones | method | L1226 | L1283 | 58 | `combat_wind_updateActiveCyclones(timeScale)` |
| combat_wind_updateActiveStrangles | method | L1284 | L1334 | 51 | `combat_wind_updateActiveStrangles(timeScale)` |
| combat_wind_updateActiveTunnels | method | L1335 | L1375 | 41 | `combat_wind_updateActiveTunnels(timeScale)` |
| combat_wind_drawStormCores | method | L1376 | L1438 | 63 | `combat_wind_drawStormCores(ctx)` |
| combat_wind_mergeStormCores | method | L1439 | L1496 | 58 | `combat_wind_mergeStormCores()` |
| combat_wind_decayStormCoresEnergy | method | L1497 | L1513 | 17 | `combat_wind_decayStormCoresEnergy()` |
| combat_damageEnemy | method | L1514 | L2312 | **799** | `combat_damageEnemy(enemy, projectile, damageOverride = null)` |
| combat_fireNextShot | method | L2313 | L2540 | **228** | `combat_fireNextShot(vel)` |
| combat_laser_fire | method | L2541 | L2764 | **224** | `combat_laser_fire(startX, startY, vel, recipe, shotId = null, isTickFire = false)` |
| combat_bladeStorm_update | method | L2765 | L2822 | 58 | `combat_bladeStorm_update(timeScale)` |
| combat_continuousLaser_update | method | L2823 | L2884 | 62 | `combat_continuousLaser_update(timeScale = 1)` |
| _laser_blendRefractionColor | method | L2885 | L2918 | 34 | `_laser_blendRefractionColor(baseColor)` |
| combat_updateHitProgress | method | L2919 | L2929 | 11 | `combat_updateHitProgress(val, target)` |
| combat_runeCharge_init | method | L2930 | L2941 | 12 | `combat_runeCharge_init()` |
| combat_runeCharge_initUI | method | L2942 | L2956 | 15 | `combat_runeCharge_initUI()` |
| combat_runeCharge_onHit | method | L2957 | L2992 | 36 | `combat_runeCharge_onHit(hitX, hitY, isKill = false)` |
| combat_runeCharge_levelUp | method | L2993 | L3012 | 20 | `combat_runeCharge_levelUp()` |
| combat_runeCharge_decay | method | L3013 | L3024 | 12 | `combat_runeCharge_decay(timeScale)` |
| combat_runeCharge_updateUI | method | L3025 | L3037 | 13 | `combat_runeCharge_updateUI()` |
| combat_runeCharge_claimReward | method | L3038 | L3071 | 34 | `combat_runeCharge_claimReward()` |
| combat_checkBossPhaseChange | method | L3072 | L3086 | 15 | `combat_checkBossPhaseChange()` |
| combat_triggerBossEnrage | method | L3087 | L3180 | 94 | `combat_triggerBossEnrage(boss)` |
| _triggerDeathFX | method | L3181 | L3332 | 152 | `_triggerDeathFX(enemy, shotId)` |

## 巨型函数内部节点 (@section 标记)

### combat_activateSkill (L96-L360, 265行)

| 节点标记 | 行号 | 说明 |
|----------|------|------|
| `@section:skill_cooldown_and_cost` | L151 | 冷却时间检查与能量消耗 |
| `@section:skill_effect_apply` | L202 | 技能效果应用（伤害/增益/召唤） |
| `@section:skill_visual_feedback` | L293 | 技能视觉反馈与音效触发 |

### combat_wind_executeCircleEffect (L556-L850, 295行)

| 节点标记 | 行号 | 说明 |
|----------|------|------|
| `@section:wind_circle_hit_detection` | L625 | 风圈范围内敌人命中检测 |
| `@section:wind_circle_damage_apply` | L706 | 风圈伤害应用与属性反应 |
| `@section:wind_circle_visual_effects` | L777 | 风圈视觉特效与粒子生成 |

### combat_damageEnemy (L1514-L2312, 799行)

| 节点标记 | 行号 | 说明 |
|----------|------|------|
| `@section:damage_element_bonus` | L1609 | 属性加成与克制倍率计算 |
| `@section:damage_runeword_hooks` | L1760 | 符文词条 Hook 注入点 |
| `@section:damage_apply_to_enemy` | L1912 | 伤害写入敌人并触发属性反应 |
| `@section:damage_kill_check` | L2064 | 击杀判断与掉落物/经验触发 |
| `@section:damage_dda_feedback` | L2166 | 动态难度调整（DDA）数据采集 |
| `@section:damage_visual_and_audio` | L2237 | 伤害视觉反馈与音效播放 |
| `@section:fire_ammo_selection` | L2312 | 弹药选择与配方读取 |

### combat_fireNextShot (L2313-L2540, 228行)

| 节点标记 | 行号 | 说明 |
|----------|------|------|
| `@section:fire_trajectory_calc` | L2379 | 弹道计算与散射角度 |
| `@section:fire_projectile_spawn` | L2450 | 子弹实体生成与属性注入 |
| `@section:fire_post_effects` | L2501 | 射击后效果：后坐力/音效/HUD更新 |
| `@section:laser_ray_cast` | L2540 | 激光射线投射与穿透检测 |

### combat_laser_fire (L2541-L2764, 224行)

| 节点标记 | 行号 | 说明 |
|----------|------|------|
| `@section:laser_hit_processing` | L2624 | 激光命中处理与连锁反应 |
| `@section:laser_visual_beam` | L2705 | 激光光束视觉渲染 |

## 其他 @section 标记

| 节点标记 | 行号 | 说明 |
|----------|------|------|
| `@section:skill_type_dispatch` | L95 | 技能类型分发：主动/被动/触发分支 |
| `@section:wind_circle_geometry` | L555 | 风圈几何计算与碰撞范围确定 |
| `@section:damage_pre_calc` | L1513 | 伤害前置计算：基础值、暴击、穿透 |
