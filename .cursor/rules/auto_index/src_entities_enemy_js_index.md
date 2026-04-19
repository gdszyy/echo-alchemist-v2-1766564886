# src/entities/enemy.js 函数索引

> 自动生成于 2026-04-19 | 总行数: 4399 | 函数数: 26 | 语言: javascript
> **本文件由 code-indexer 脚本自动生成，严禁手动编辑。**

**巨型函数警告**: 本文件包含 3 个超过 200 行的函数，建议优先通过 `@section` 标记进行内部导航。

## 函数列表

| 函数名 | 类型 | 起始行 | 结束行 | 行数 | 签名 |
|--------|------|--------|--------|------|------|
| setEnemyAudioProvider | function | L27 | L45 | 19 | `setEnemyAudioProvider(provider)` |
| Enemy | class | L46 | L46 | 1 | `Enemy()` |
| constructor | method | L47 | L180 | 134 | `constructor(x, y, width, height, hp, maxHp = hp, type = 'normal', affixes = [])` |
| _initTexture | method | L181 | L300 | 120 | `_initTexture(width, height)` |
| update | method | L301 | L462 | 162 | `update(timeScale, game)` |
| addSwordCrack | method | L463 | L477 | 15 | `addSwordCrack(relPos, angle)` |
| updateTempParticles | method | L478 | L587 | 110 | `updateTempParticles(timeScale)` |
| advance | method | L588 | L590 | 3 | `advance(amount)` |
| startTurnAction | method | L591 | L741 | 151 | `startTurnAction(game)` |
| executeTurnAction | method | L742 | L941 | 200 | `executeTurnAction(game)` |
| performTurnActionAndMove | method | L942 | L1078 | 137 | `performTurnActionAndMove(game)` |
| _getBossActionCount | method | L1079 | L1106 | 28 | `_getBossActionCount(baseCount)` |
| _performOuroborosRotation | method | L1107 | L1151 | 45 | `_performOuroborosRotation(game)` |
| _glaciesFreezePegsOnLanding | method | L1152 | L1177 | 26 | `_glaciesFreezePegsOnLanding(game)` |
| playFreezeBlockEffect | method | L1178 | L1206 | 29 | `playFreezeBlockEffect(game)` |
| triggerLaserHitShake | method | L1207 | L1211 | 5 | `triggerLaserHitShake()` |
| playBurnTickEffect | method | L1212 | L1219 | 8 | `playBurnTickEffect(game, dmg)` |
| playScanFeedback | method | L1220 | L1224 | 5 | `playScanFeedback()` |
| draw | method | L1225 | L3474 | **2250** | `draw(ctx)` |
| addSwordMark | method | L3475 | L3482 | 8 | `addSwordMark(amount = 1)` |
| takeDamage | method | L3483 | L3763 | **281** | `takeDamage(amount, source = null, bypassShield = false)` |
| applyTemp | method | L3764 | L3772 | 9 | `applyTemp(amount)` |
| getBounds | method | L3773 | L3781 | 9 | `getBounds()` |
| _drawEliteDecoration | method | L3782 | L3911 | 130 | `_drawEliteDecoration(ctx, w, h)` |
| _drawBossDecoration | method | L3912 | L4386 | **475** | `_drawBossDecoration(ctx, w, h)` |
| getAbsoluteVertices | method | L4387 | L4400 | 14 | `getAbsoluteVertices()` |
