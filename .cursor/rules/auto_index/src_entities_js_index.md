# src/entities.js 函数索引

> 自动生成于 2026-04-19 | 总行数: 4741 | 函数数: 104 | 语言: javascript
> **本文件由 code-indexer 脚本自动生成，严禁手动编辑。**

**巨型函数警告**: 本文件包含 4 个超过 200 行的函数，建议优先通过 `@section` 标记进行内部导航。

## 函数列表

| 函数名 | 类型 | 起始行 | 结束行 | 行数 | 签名 |
|--------|------|--------|--------|------|------|
| setAudioProvider | function | L59 | L86 | 28 | `setAudioProvider(provider)` |
| MarbleDefinition | class | L87 | L87 | 1 | `MarbleDefinition()` |
| constructor | method | L88 | L100 | 13 | `constructor(type)` |
| getName | method | L101 | L107 | 7 | `getName()` |
| getColor | method | L108 | L116 | 9 | `getColor()` |
| SpecialSlot | class | L117 | L126 | 10 | `SpecialSlot()` |
| constructor | method | L127 | L141 | 15 | `constructor(x, y, x2, y2, type)` |
| draw | method | L142 | L211 | 70 | `draw(ctx)` |
| FortuneWheel | class | L212 | L212 | 1 | `FortuneWheel()` |
| constructor | method | L213 | L235 | 23 | `constructor(game)` |
| spin | method | L236 | L307 | 72 | `spin(x, y, collectedAttributes, callback)` |
| update | method | L308 | L326 | 19 | `update(timeScale)` |
| getCurrentSlice | method | L327 | L333 | 7 | `getCurrentSlice()` |
| finalizeResult | method | L334 | L346 | 13 | `finalizeResult()` |
| draw | method | L347 | L511 | 165 | `draw(ctx)` |
| GhostPeg | class | L512 | L518 | 7 | `GhostPeg()` |
| constructor | method | L519 | L530 | 12 | `constructor(x, y, type, level)` |
| update | method | L531 | L536 | 6 | `update(timeScale)` |
| draw | method | L537 | L605 | 69 | `draw(ctx)` |
| TriangleSideWheel | class | L606 | L612 | 7 | `TriangleSideWheel()` |
| constructor | method | L613 | L654 | 42 | `constructor(x, y, side, game)` |
| spin | method | L655 | L667 | 13 | `spin(callback)` |
| getCurrentSlice | method | L668 | L674 | 7 | `getCurrentSlice()` |
| update | method | L675 | L693 | 19 | `update(timeScale)` |
| draw | method | L694 | L808 | 115 | `draw(ctx)` |
| Peg | class | L809 | L809 | 1 | `Peg()` |
| constructor | method | L810 | L835 | 26 | `constructor(x, y, type = 'normal')` |
| getColor | method | L836 | L864 | 29 | `getColor()` |
| upgrade | method | L865 | L882 | 18 | `upgrade()` |
| drawShadow | method | L883 | L970 | 88 | `drawShadow(ctx, lightPos, lightRadius)` |
| resetLight | method | L971 | L974 | 4 | `resetLight()` |
| resetCooldown | method | L975 | L980 | 6 | `resetCooldown()` |
| calculateLight | method | L981 | L1004 | 24 | `calculateLight(sourcePos, lightRadius)` |
| hit | method | L1005 | L1030 | 26 | `hit(impactSpeed = 5)` |
| draw | method | L1031 | L1262 | **232** | `draw(ctx, baseRadius, tilt = {x:0, y:0})` |
| drawSwordPeg | method | L1263 | L1306 | 44 | `drawSwordPeg(ctx, r, isLit)` |
| drawWindPeg | method | L1307 | L1381 | 75 | `drawWindPeg(ctx, r, isLit)` |
| drawCryoPeg | method | L1382 | L1411 | 30 | `drawCryoPeg(ctx, r, isLit)` |
| drawPyroPeg | method | L1412 | L1434 | 23 | `drawPyroPeg(ctx, r, isLit)` |
| drawBouncePeg | method | L1435 | L1469 | 35 | `drawBouncePeg(ctx, r, isLit)` |
| drawPiercePeg | method | L1470 | L1505 | 36 | `drawPiercePeg(ctx, r, isLit)` |
| drawScatterPeg | method | L1506 | L1542 | 37 | `drawScatterPeg(ctx, r, isLit)` |
| drawDamagePeg | method | L1543 | L1575 | 33 | `drawDamagePeg(ctx, r, isLit)` |
| drawLaserPeg | method | L1576 | L1612 | 37 | `drawLaserPeg(ctx, r, isLit)` |
| drawPinkPeg | method | L1613 | L1647 | 35 | `drawPinkPeg(ctx, r, isLit)` |
| drawLayoutRoleStyle | method | L1648 | L1803 | 156 | `drawLayoutRoleStyle(ctx, r)` |
| drawLevelPips | method | L1804 | L1820 | 17 | `drawLevelPips(ctx, r)` |
| update | method | L1821 | L1860 | 40 | `update()` |
| DropBall | class | L1861 | L1868 | 8 | `DropBall()` |
| constructor | method | L1869 | L1903 | 35 | `constructor(x, y, marbleDef, session)` |
| getBuffState | method | L1904 | L1944 | 41 | `getBuffState()` |
| handlePegInteraction | method | L1945 | L2093 | 149 | `handlePegInteraction(peg, game)` |
| update | method | L2094 | L2867 | **774** | `update(pegs, slots, width, height, timeScale, tilt = {x:0, y:0})` |
| stopSound | method | L2868 | L2878 | 11 | `stopSound()` |
| draw | method | L2879 | L3282 | **404** | `draw(ctx)` |
| _drawBaseBall | method | L3283 | L3290 | 8 | `_drawBaseBall(ctx, r, cLight, cDark)` |
| _drawHighlight | method | L3291 | L3299 | 9 | `_drawHighlight(ctx, r)` |
| SwordQi | class | L3300 | L3300 | 1 | `SwordQi()` |
| constructor | method | L3301 | L3309 | 9 | `constructor(x, y, velocity, width)` |
| update | method | L3310 | L3335 | 26 | `update(timeScale, enemies, game)` |
| draw | method | L3336 | L3354 | 19 | `draw(ctx)` |
| SlashAnim | class | L3355 | L3355 | 1 | `SlashAnim()` |
| constructor | method | L3356 | L3363 | 8 | `constructor(x, y, angle, scale=1, color='#0ea5e9')` |
| update | method | L3364 | L3369 | 6 | `update(timeScale)` |
| draw | method | L3370 | L3395 | 26 | `draw(ctx)` |
| SonSword | class | L3396 | L3396 | 1 | `SonSword()` |
| constructor | method | L3397 | L3436 | 40 | `constructor(x, y, mother, level, config, startDelay = 0)` |
| addTarget | method | L3437 | L3440 | 4 | `addTarget(enemy)` |
| searchForTarget | method | L3441 | L3460 | 20 | `searchForTarget(enemies)` |
| update | method | L3461 | L3667 | **207** | `update(timeScale, enemies, game)` |
| handleHit | method | L3668 | L3711 | 44 | `handleHit(enemy, game)` |
| stickToEnemy | method | L3712 | L3735 | 24 | `stickToEnemy(enemy, game)` |
| triggerRecall | method | L3736 | L3745 | 10 | `triggerRecall(targetPos)` |
| draw | method | L3746 | L3850 | 105 | `draw(ctx)` |
| CloneSpore | class | L3851 | L3851 | 1 | `CloneSpore()` |
| constructor | method | L3852 | L3863 | 12 | `constructor(startX, startY, targetX, targetY, onLandCallback)` |
| update | method | L3864 | L3885 | 22 | `update(timeScale)` |
| draw | method | L3886 | L3922 | 37 | `draw(ctx)` |
| Player | class | L3923 | L3927 | 5 | `Player()` |
| constructor | method | L3928 | L3963 | 36 | `constructor(game)` |
| getPosition | method | L3964 | L3970 | 7 | `getPosition()` |
| updatePosition | method | L3971 | L3981 | 11 | `updatePosition()` |
| update | method | L3982 | L3996 | 15 | `update(timeScale)` |
| updateCharging | method | L3997 | L4021 | 25 | `updateCharging(timeScale)` |
| updateReloading | method | L4022 | L4041 | 20 | `updateReloading(timeScale)` |
| updateOrbitalPhysics | method | L4042 | L4057 | 16 | `updateOrbitalPhysics(timeScale)` |
| triggerReload | method | L4058 | L4069 | 12 | `triggerReload()` |
| startAiming | method | L4070 | L4087 | 18 | `startAiming(mousePos)` |
| updateAiming | method | L4088 | L4097 | 10 | `updateAiming(mousePos)` |
| endAiming | method | L4098 | L4125 | 28 | `endAiming()` |
| canFire | method | L4126 | L4137 | 12 | `canFire()` |
| draw | method | L4138 | L4164 | 27 | `draw(ctx)` |
| calculateDrawPosition | method | L4165 | L4181 | 17 | `calculateDrawPosition()` |
| calculateDeformation | method | L4182 | L4206 | 25 | `calculateDeformation()` |
| calculatePreviewRotation | method | L4207 | L4221 | 15 | `calculatePreviewRotation()` |
| drawBase | method | L4222 | L4234 | 13 | `drawBase(ctx, pos)` |
| drawCore | method | L4235 | L4267 | 33 | `drawCore(ctx, pos, nextAmmo)` |
| drawOrbitals | method | L4268 | L4404 | 137 | `drawOrbitals(ctx, pos, recipe)` |
| drawAimLine | method | L4405 | L4480 | 76 | `drawAimLine(ctx)` |
| drawIdleCannon | method | L4481 | L4502 | 22 | `drawIdleCannon(ctx)` |
| RuneLoot | class | L4503 | L4508 | 6 | `RuneLoot()` |
| constructor | method | L4509 | L4527 | 19 | `constructor(x, y, runeId)` |
| draw | method | L4528 | L4689 | 162 | `draw(ctx)` |
| checkPickup | method | L4690 | L4742 | 53 | `checkPickup(playerPos, radius = 30)` |

## 巨型函数内部节点 (@section 标记)

### draw (L1031-L1262, 232行)

| 节点标记 | 行号 | 说明 |
|----------|------|------|
| `@section:peg_base_fill_and_glow` | L1065 | 基础圆形填充与发光效果 |
| `@section:peg_type_icons` | L1103 | 各属性钉子专属图标绘制 |
| `@section:peg_border_and_level_pip` | L1145 | 钉子边框、等级指示器与光照反光 |

### update (L2094-L2867, 774行)

| 节点标记 | 行号 | 说明 |
|----------|------|------|
| `@section:particle_emission` | L2111 | 基于当前属性的粒子拖尾生成 |
| `@section:gravity_and_tilt_physics` | L2186 | 重力计算与倾斜加速度衰减 |
| `@section:slot_detection` | L2320 | 底部槽位碰撞检测与属性收集触发 |
| `@section:peg_collision_resolution` | L2488 | 钉子碰撞解算（增强版物理 + 布局修正） |
| `@section:layout_special_effects` | L2634 | 布局专属特殊效果（漏斗/菱形/稀疏通道） |
| `@section:attribute_collection` | L2720 | 属性收集逻辑与实时合成判断 |
| `@section:sparse_channel_charge` | L2813 | sparse 布局通道蓄力检测 |
| `@section:ghost_peg_collision` | L2838 | diamond 布局虚影钉子碰撞检测 |

### draw (L2879-L3282, 404行)

| 节点标记 | 行号 | 说明 |
|----------|------|------|
| `@section:ambient_spotlight` | L2890 | LAYER 0：环境光晕与混沌闪烁计算 |
| `@section:laser_back_aura` | L2965 | LAYER 1：激光背光特效 |
| `@section:base_ball_body` | L2970 | LAYER 2：球体本体绘制（爆破/普通分支） |
| `@section:attribute_overlay` | L3025 | LAYER 3-4：属性叠加特效（火/冰/雷） |
| `@section:wind_blades` | L3101 | LAYER 5：风刃环绕特效 |
| `@section:mirror_clone_badge` | L3174 | LAYER 6：镜像分身标记 |

### update (L3461-L3667, 207行)

| 节点标记 | 行号 | 说明 |
|----------|------|------|
| `@section:son_sword_target_search` | L3530 | 节流自动寻敌与目标验证 |
| `@section:son_sword_steering` | L3580 | 基于角度的转向与移动逻辑 |

## 其他 @section 标记

| 节点标记 | 行号 | 说明 |
|----------|------|------|
| `@section:peg_shadow_and_transform` | L1030 | 软阴影与碰撞旋转变换初始化 |
| `@section:son_sword_state_machine` | L3460 | 子剑状态机：冲刺/悬停/回收分支 |
