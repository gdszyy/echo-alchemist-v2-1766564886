# src/entities.js 函数索引

> 自动生成于 2026-04-19 | 总行数: 4718 | 函数数: 104 | 语言: javascript
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
| hit | method | L1005 | L1029 | 25 | `hit(impactSpeed = 5)` |
| draw | method | L1030 | L1256 | **227** | `draw(ctx, baseRadius, tilt = {x:0, y:0})` |
| drawSwordPeg | method | L1257 | L1300 | 44 | `drawSwordPeg(ctx, r, isLit)` |
| drawWindPeg | method | L1301 | L1375 | 75 | `drawWindPeg(ctx, r, isLit)` |
| drawCryoPeg | method | L1376 | L1405 | 30 | `drawCryoPeg(ctx, r, isLit)` |
| drawPyroPeg | method | L1406 | L1428 | 23 | `drawPyroPeg(ctx, r, isLit)` |
| drawBouncePeg | method | L1429 | L1463 | 35 | `drawBouncePeg(ctx, r, isLit)` |
| drawPiercePeg | method | L1464 | L1499 | 36 | `drawPiercePeg(ctx, r, isLit)` |
| drawScatterPeg | method | L1500 | L1536 | 37 | `drawScatterPeg(ctx, r, isLit)` |
| drawDamagePeg | method | L1537 | L1569 | 33 | `drawDamagePeg(ctx, r, isLit)` |
| drawLaserPeg | method | L1570 | L1606 | 37 | `drawLaserPeg(ctx, r, isLit)` |
| drawPinkPeg | method | L1607 | L1641 | 35 | `drawPinkPeg(ctx, r, isLit)` |
| drawLayoutRoleStyle | method | L1642 | L1797 | 156 | `drawLayoutRoleStyle(ctx, r)` |
| drawLevelPips | method | L1798 | L1814 | 17 | `drawLevelPips(ctx, r)` |
| update | method | L1815 | L1854 | 40 | `update()` |
| DropBall | class | L1855 | L1862 | 8 | `DropBall()` |
| constructor | method | L1863 | L1897 | 35 | `constructor(x, y, marbleDef, session)` |
| getBuffState | method | L1898 | L1938 | 41 | `getBuffState()` |
| handlePegInteraction | method | L1939 | L2087 | 149 | `handlePegInteraction(peg, game)` |
| update | method | L2088 | L2853 | **766** | `update(pegs, slots, width, height, timeScale, tilt = {x:0, y:0})` |
| stopSound | method | L2854 | L2864 | 11 | `stopSound()` |
| draw | method | L2865 | L3262 | **398** | `draw(ctx)` |
| _drawBaseBall | method | L3263 | L3270 | 8 | `_drawBaseBall(ctx, r, cLight, cDark)` |
| _drawHighlight | method | L3271 | L3279 | 9 | `_drawHighlight(ctx, r)` |
| SwordQi | class | L3280 | L3280 | 1 | `SwordQi()` |
| constructor | method | L3281 | L3289 | 9 | `constructor(x, y, velocity, width)` |
| update | method | L3290 | L3315 | 26 | `update(timeScale, enemies, game)` |
| draw | method | L3316 | L3334 | 19 | `draw(ctx)` |
| SlashAnim | class | L3335 | L3335 | 1 | `SlashAnim()` |
| constructor | method | L3336 | L3343 | 8 | `constructor(x, y, angle, scale=1, color='#0ea5e9')` |
| update | method | L3344 | L3349 | 6 | `update(timeScale)` |
| draw | method | L3350 | L3375 | 26 | `draw(ctx)` |
| SonSword | class | L3376 | L3376 | 1 | `SonSword()` |
| constructor | method | L3377 | L3416 | 40 | `constructor(x, y, mother, level, config, startDelay = 0)` |
| addTarget | method | L3417 | L3420 | 4 | `addTarget(enemy)` |
| searchForTarget | method | L3421 | L3439 | 19 | `searchForTarget(enemies)` |
| update | method | L3440 | L3644 | **205** | `update(timeScale, enemies, game)` |
| handleHit | method | L3645 | L3688 | 44 | `handleHit(enemy, game)` |
| stickToEnemy | method | L3689 | L3712 | 24 | `stickToEnemy(enemy, game)` |
| triggerRecall | method | L3713 | L3722 | 10 | `triggerRecall(targetPos)` |
| draw | method | L3723 | L3827 | 105 | `draw(ctx)` |
| CloneSpore | class | L3828 | L3828 | 1 | `CloneSpore()` |
| constructor | method | L3829 | L3840 | 12 | `constructor(startX, startY, targetX, targetY, onLandCallback)` |
| update | method | L3841 | L3862 | 22 | `update(timeScale)` |
| draw | method | L3863 | L3899 | 37 | `draw(ctx)` |
| Player | class | L3900 | L3904 | 5 | `Player()` |
| constructor | method | L3905 | L3940 | 36 | `constructor(game)` |
| getPosition | method | L3941 | L3947 | 7 | `getPosition()` |
| updatePosition | method | L3948 | L3958 | 11 | `updatePosition()` |
| update | method | L3959 | L3973 | 15 | `update(timeScale)` |
| updateCharging | method | L3974 | L3998 | 25 | `updateCharging(timeScale)` |
| updateReloading | method | L3999 | L4018 | 20 | `updateReloading(timeScale)` |
| updateOrbitalPhysics | method | L4019 | L4034 | 16 | `updateOrbitalPhysics(timeScale)` |
| triggerReload | method | L4035 | L4046 | 12 | `triggerReload()` |
| startAiming | method | L4047 | L4064 | 18 | `startAiming(mousePos)` |
| updateAiming | method | L4065 | L4074 | 10 | `updateAiming(mousePos)` |
| endAiming | method | L4075 | L4102 | 28 | `endAiming()` |
| canFire | method | L4103 | L4114 | 12 | `canFire()` |
| draw | method | L4115 | L4141 | 27 | `draw(ctx)` |
| calculateDrawPosition | method | L4142 | L4158 | 17 | `calculateDrawPosition()` |
| calculateDeformation | method | L4159 | L4183 | 25 | `calculateDeformation()` |
| calculatePreviewRotation | method | L4184 | L4198 | 15 | `calculatePreviewRotation()` |
| drawBase | method | L4199 | L4211 | 13 | `drawBase(ctx, pos)` |
| drawCore | method | L4212 | L4244 | 33 | `drawCore(ctx, pos, nextAmmo)` |
| drawOrbitals | method | L4245 | L4381 | 137 | `drawOrbitals(ctx, pos, recipe)` |
| drawAimLine | method | L4382 | L4457 | 76 | `drawAimLine(ctx)` |
| drawIdleCannon | method | L4458 | L4479 | 22 | `drawIdleCannon(ctx)` |
| RuneLoot | class | L4480 | L4485 | 6 | `RuneLoot()` |
| constructor | method | L4486 | L4504 | 19 | `constructor(x, y, runeId)` |
| draw | method | L4505 | L4666 | 162 | `draw(ctx)` |
| checkPickup | method | L4667 | L4719 | 53 | `checkPickup(playerPos, radius = 30)` |
