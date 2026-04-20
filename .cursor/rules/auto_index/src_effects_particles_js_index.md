# src/effects/particles.js 函数索引

> 自动生成于 2026-04-20 | 总行数: 1829 | 函数数: 62 | 语言: javascript
> **本文件由 code-indexer 脚本自动生成，严禁手动编辑。**

## 函数列表

| 函数名 | 类型 | 起始行 | 结束行 | 行数 | 签名 |
|--------|------|--------|--------|------|------|
| Particle | class | L20 | L20 | 1 | `Particle()` |
| constructor | method | L21 | L93 | 73 | `constructor(x, y, color, mode = 'normal')` |
| update | method | L94 | L116 | 23 | `update(timeScale)` |
| draw | method | L117 | L232 | 116 | `draw(ctx)` |
| SlashEffect | class | L233 | L233 | 1 | `SlashEffect()` |
| constructor | method | L234 | L245 | 12 | `constructor(x, y, angle, length, color)` |
| update | method | L246 | L250 | 5 | `update()` |
| draw | method | L251 | L307 | 57 | `draw(ctx)` |
| CollectionBeam | class | L308 | L308 | 1 | `CollectionBeam()` |
| constructor | method | L309 | L318 | 10 | `constructor(x, bottomY)` |
| update | method | L319 | L324 | 6 | `update(timeScale)` |
| draw | method | L325 | L361 | 37 | `draw(ctx)` |
| Shockwave | class | L362 | L362 | 1 | `Shockwave()` |
| constructor | method | L363 | L371 | 9 | `constructor(x, y, color)` |
| update | method | L372 | L378 | 7 | `update(timeScale)` |
| draw | method | L379 | L414 | 36 | `draw(ctx)` |
| LaserBeam | class | L415 | L421 | 7 | `LaserBeam()` |
| constructor | method | L422 | L435 | 14 | `constructor(segments, width, color, isContinuous = false)` |
| startFadeOut | method | L436 | L439 | 4 | `startFadeOut()` |
| update | method | L440 | L443 | 4 | `update(timeScale)` |
| draw | method | L444 | L483 | 40 | `draw(ctx)` |
| FloatingText | class | L484 | L491 | 8 | `FloatingText()` |
| constructor | method | L492 | L500 | 9 | `constructor(x, y, text, color = '#fbbf24', fontSize = 16)` |
| update | method | L501 | L505 | 5 | `update(timeScale)` |
| draw | method | L506 | L527 | 22 | `draw(ctx)` |
| EnergyOrb | class | L528 | L537 | 10 | `EnergyOrb()` |
| constructor | method | L538 | L569 | 32 | `constructor(x, y, targetX, targetY, color, initialVel, onArrive)` |
| update | method | L570 | L601 | 32 | `update(timeScale)` |
| draw | method | L602 | L659 | 58 | `draw(ctx)` |
| LightningBolt | class | L660 | L660 | 1 | `LightningBolt()` |
| constructor | method | L661 | L669 | 9 | `constructor(x1, y1, x2, y2)` |
| generateSegments | method | L670 | L697 | 28 | `generateSegments()` |
| update | method | L698 | L706 | 9 | `update(timeScale)` |
| draw | method | L707 | L753 | 47 | `draw(ctx)` |
| FireWave | class | L754 | L754 | 1 | `FireWave()` |
| constructor | method | L755 | L762 | 8 | `constructor(x, y)` |
| update | method | L763 | L767 | 5 | `update(timeScale)` |
| draw | method | L768 | L792 | 25 | `draw(ctx)` |
| IceWave | class | L793 | L793 | 1 | `IceWave()` |
| constructor | method | L794 | L804 | 11 | `constructor(x, y)` |
| update | method | L805 | L811 | 7 | `update(timeScale)` |
| draw | method | L812 | L862 | 51 | `draw(ctx)` |
| DeathExplosion | class | L863 | L868 | 6 | `DeathExplosion()` |
| constructor | method | L869 | L953 | 85 | `constructor(x, y, tier = 'normal')` |
| update | method | L954 | L998 | 45 | `update(timeScale)` |
| draw | method | L999 | L1102 | 104 | `draw(ctx)` |
| HealWave | class | L1103 | L1103 | 1 | `HealWave()` |
| constructor | method | L1104 | L1124 | 21 | `constructor(x, y, range = 120)` |
| update | method | L1125 | L1140 | 16 | `update(timeScale)` |
| draw | method | L1141 | L1237 | 97 | `draw(ctx)` |
| BladeStormRing | class | L1238 | L1238 | 1 | `BladeStormRing()` |
| constructor | method | L1239 | L1247 | 9 | `constructor(x, y, radius)` |
| update | method | L1248 | L1259 | 12 | `update(timeScale)` |
| draw | method | L1260 | L1292 | 33 | `draw(ctx)` |
| SwordScar | class | L1293 | L1293 | 1 | `SwordScar()` |
| constructor | method | L1294 | L1306 | 13 | `constructor(x, y)` |
| update | method | L1307 | L1315 | 9 | `update(timeScale)` |
| draw | method | L1316 | L1352 | 37 | `draw(ctx)` |
| RewardDropEffect | class | L1366 | L1366 | 1 | `RewardDropEffect()` |
| constructor | method | L1372 | L1454 | 83 | `constructor(x, y, rewardType)` |
| update | method | L1455 | L1517 | 63 | `update(timeScale)` |
| draw | method | L1518 | L1810 | 293 | `draw(ctx)` |
