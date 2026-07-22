# src\entities.js 函数索引

> 自动生成于 2026-07-22 | 总行数: 5465 | 函数数: 107 | 语言: javascript
> **本文件由 code-indexer 脚本自动生成，严禁手动编辑。**

**巨型函数警告**: 本文件包含 2 个超过 200 行的函数，建议优先通过 `@section` 标记进行内部导航。

## 函数列表

> 定位方式：在源文件中 `grep -n "函数名"` 即可跳转，行号不在此列出（行号随代码变化而失效）。

| 函数名 | 类型 | 签名 | 备注 |
|--------|------|------|------|
| setAudioProvider | function | `setAudioProvider(provider)` |  |
| constructor | method | `constructor(type)` |  |
| normalizeRuneSlots | method | `normalizeRuneSlots()` |  |
| getRuneSlotCollected | method | `getRuneSlotCollected()` |  |
| canFuseRune | method | `canFuseRune()` |  |
| getName | method | `getName()` |  |
| getColor | method | `getColor()` |  |
| constructor | method | `constructor(x, y, x2, y2, type, options = {})` |  |
| update | method | `update(timeScale = 1)` |  |
| tryActivate | method | `tryActivate(session)` |  |
| getLaunchDirection | method | `getLaunchDirection()` |  |
| draw | method | `draw(ctx)` |  |
| constructor | method | `constructor(game)` |  |
| spin | method | `spin(x, y, collectedAttributes, callback)` |  |
| update | method | `update(timeScale)` |  |
| getCurrentSlice | method | `getCurrentSlice()` |  |
| finalizeResult | method | `finalizeResult()` |  |
| draw | method | `draw(ctx)` |  |
| constructor | method | `constructor(x, y, type, level)` |  |
| update | method | `update(timeScale)` |  |
| draw | method | `draw(ctx)` |  |
| constructor | method | `constructor(x, y, side, game)` |  |
| spin | method | `spin(callback)` |  |
| getCurrentSlice | method | `getCurrentSlice()` |  |
| update | method | `update(timeScale)` |  |
| draw | method | `draw(ctx)` |  |
| constructor | method | `constructor(x, y, type = 'normal')` |  |
| getColor | method | `getColor()` |  |
| upgrade | method | `upgrade()` |  |
| drawShadow | method | `drawShadow(ctx, lightPos, lightRadius)` |  |
| resetLight | method | `resetLight()` |  |
| resetCooldown | method | `resetCooldown()` |  |
| calculateLight | method | `calculateLight(sourcePos, lightRadius)` |  |
| hit | method | `hit(impactSpeed = 5)` |  |
| drawBarrierPeg | method | `drawBarrierPeg(ctx, color, isLit)` |  |
| draw | method | `draw(ctx, baseRadius, tilt = {x:0, y:0})` |  |
| drawPegPlate | function | `drawPegPlate(radius)` |  |
| drawSwordPeg | method | `drawSwordPeg(ctx, r, isLit)` |  |
| drawWindPeg | method | `drawWindPeg(ctx, r, isLit)` |  |
| drawCryoPeg | method | `drawCryoPeg(ctx, r, isLit)` |  |
| drawPyroPeg | method | `drawPyroPeg(ctx, r, isLit)` |  |
| drawBouncePeg | method | `drawBouncePeg(ctx, r, isLit)` |  |
| drawPiercePeg | method | `drawPiercePeg(ctx, r, isLit)` |  |
| drawScatterPeg | method | `drawScatterPeg(ctx, r, isLit)` |  |
| drawDamagePeg | method | `drawDamagePeg(ctx, r, isLit)` |  |
| drawLaserPeg | method | `drawLaserPeg(ctx, r, isLit)` |  |
| drawPinkPeg | method | `drawPinkPeg(ctx, r, isLit)` |  |
| drawResonancePeg | method | `drawResonancePeg(ctx, r, isLit)` |  |
| drawVenomPeg | method | `drawVenomPeg(ctx, r, isLit)` |  |
| drawLayoutRoleStyle | method | `drawLayoutRoleStyle(ctx, r)` |  |
| drawLevelPips | method | `drawLevelPips(ctx, r)` |  |
| update | method | `update()` |  |
| constructor | method | `constructor(x, y, marbleDef, session)` |  |
| getBuffState | method | `getBuffState()` |  |
| _getPegTriggerKey | method | `_getPegTriggerKey(peg)` |  |
| canScorePeg | method | `canScorePeg(peg)` |  |
| markScoredPeg | method | `markScoredPeg(peg)` |  |
| handlePegInteraction | method | `handlePegInteraction(peg, game)` |  |
| update | method | `update(pegs, slots, width, height, timeScale, tilt = {x:0, y:0})` |  |
| stopSound | method | `stopSound()` |  |
| draw | method | `draw(ctx)` | ⚠️ 巨型函数，见 @section 导航 |
| _drawBaseBall | method | `_drawBaseBall(ctx, r, cLight, cDark)` |  |
| _drawHighlight | method | `_drawHighlight(ctx, r)` |  |
| constructor | method | `constructor(x, y, velocity, width)` |  |
| update | method | `update(timeScale, enemies, game)` |  |
| draw | method | `draw(ctx)` |  |
| constructor | method | `constructor(x, y, angle, scale=1, color='#0ea5e9')` |  |
| update | method | `update(timeScale)` |  |
| draw | method | `draw(ctx)` |  |
| constructor | method | `constructor(x, y, mother, level, config, startDelay = 0)` |  |
| addTarget | method | `addTarget(enemy)` |  |
| searchForTarget | method | `searchForTarget(enemies)` |  |
| update | method | `update(timeScale, enemies, game)` | ⚠️ 巨型函数，见 @section 导航 |
| handleHit | method | `handleHit(enemy, game)` |  |
| stickToEnemy | method | `stickToEnemy(enemy, game)` |  |
| triggerRecall | method | `triggerRecall(targetPos)` |  |
| draw | method | `draw(ctx)` |  |
| constructor | method | `constructor(startX, startY, targetX, targetY, onLandCallback)` |  |
| update | method | `update(timeScale)` |  |
| draw | method | `draw(ctx)` |  |
| constructor | method | `constructor(game)` |  |
| getPosition | method | `getPosition()` |  |
| updatePosition | method | `updatePosition()` |  |
| update | method | `update(timeScale)` |  |
| updateCharging | method | `updateCharging(timeScale)` |  |
| updateReloading | method | `updateReloading(timeScale)` |  |
| updateOrbitalPhysics | method | `updateOrbitalPhysics(timeScale)` |  |
| triggerReload | method | `triggerReload()` |  |
| startAiming | method | `startAiming(mousePos)` |  |
| updateAiming | method | `updateAiming(mousePos)` |  |
| endAiming | method | `endAiming()` |  |
| canFire | method | `canFire()` |  |
| draw | method | `draw(ctx)` |  |
| calculateDrawPosition | method | `calculateDrawPosition()` |  |
| calculateDeformation | method | `calculateDeformation()` |  |
| calculatePreviewRotation | method | `calculatePreviewRotation()` |  |
| drawBase | method | `drawBase(ctx, pos)` |  |
| drawCore | method | `drawCore(ctx, pos, nextAmmo)` |  |
| drawOrbitals | method | `drawOrbitals(ctx, pos, recipe)` |  |
| drawAimLine | method | `drawAimLine(ctx)` |  |
| drawIdleCannon | method | `drawIdleCannon(ctx)` |  |
| constructor | method | `constructor(x, y, type)` |  |
| update | method | `update(timeScale = 1)` |  |
| draw | method | `draw(ctx)` |  |
| constructor | method | `constructor(x, y, runeId)` |  |
| draw | method | `draw(ctx)` |  |
| checkPickup | method | `checkPickup(playerPos, radius = 30)` |  |

## 巨型函数内部节点 (@section 标记)

### draw

> 定位：`grep -n '@section:节点名'` 跳转到对应节点

| 节点标记 | 说明 |
|----------|------|
| `@section:ambient_spotlight` | LAYER 0：环境光晕与混沌闪烁计算 |
| `@section:laser_back_aura` | LAYER 1：激光背光特效 |
| `@section:base_ball_body` | LAYER 2：球体本体绘制（爆破/普通分支） |
| `@section:attribute_overlay` | LAYER 3-4：属性叠加特效（火/冰/雷） |
| `@section:wind_blades` | LAYER 5：风刃环绕特效 |
| `@section:mirror_clone_badge` | LAYER 6：镜像分身标记 |

### update

> 定位：`grep -n '@section:节点名'` 跳转到对应节点

| 节点标记 | 说明 |
|----------|------|
| `@section:son_sword_target_search` | 节流自动寻敌与目标验证 |
| `@section:son_sword_steering` | 基于角度的转向与移动逻辑 |


## 其他 @section 标记

| 节点标记 | 说明 |
|----------|------|
| `@section:peg_shadow_and_transform` | 软阴影与碰撞旋转变换初始化 |
| `@section:peg_base_fill_and_glow` | 基础圆形填充与发光效果 |
| `@section:peg_type_icons` | 各属性钉子专属图标绘制 |
| `@section:peg_border_and_level_pip` | 钉子边框、等级指示器与光照反光 |
| `@section:peg_audio_feedback` | 钉子属性触发音效路由（mutation→playMagic, upgrade→playPowerup, attribute→playMagic） |
| `@section:particle_emission` | 基于当前属性的粒子拖尾生成 |
| `@section:gravity_and_tilt_physics` | 重力计算与倾斜加速度衰减 |
| `@section:slot_detection` | 底部槽位碰撞检测与属性收集触发 |
| `@section:peg_collision_resolution` | 钉子碰撞解算（增强版物理 + 布局修正） |
| `@section:layout_special_effects` | 布局专属特殊效果（漏斗/菱形/稀疏通道） |
| `@section:attribute_collection` | 属性收集逻辑与实时合成判断 |
| `@section:sparse_channel_charge` | sparse 布局通道蓄力检测 |
| `@section:ghost_peg_collision` | diamond 布局虚影钉子碰撞检测 |
| `@section:son_sword_state_machine` | 子剑状态机：冲刺/悬停/回收分支 |
| `@section:charge_shot_audio` | 玩家蓄力发射开始音效（高频 800Hz，区别于敌人预警 200Hz） |
