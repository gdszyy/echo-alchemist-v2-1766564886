# src/entities/projectile.js 函数索引

> 自动生成于 2026-04-19 | 总行数: 1001 | 函数数: 13 | 语言: javascript
> **本文件由 code-indexer 脚本自动生成，严禁手动编辑。**

**巨型函数警告**: 本文件包含 2 个超过 200 行的函数，建议优先通过 `@section` 标记进行内部导航。

## 函数列表

| 函数名 | 类型 | 起始行 | 结束行 | 行数 | 签名 |
|--------|------|--------|--------|------|------|
| setProjectileAudioProvider | function | L27 | L46 | 20 | `setProjectileAudioProvider(provider)` |
| Projectile | class | L47 | L47 | 1 | `Projectile()` |
| constructor | method | L48 | L101 | 54 | `constructor(x, y, vel, config, isCopy = false, shotId = null, isLast = false)` |
| update | method | L102 | L166 | 65 | `update(width, height, enemies, spawnCallback, timeScale)` |
| _handleCollision | method | L167 | L416 | **250** | `_handleCollision(e, enemies, spawnCallback)` |
| _spawnEffect | method | L417 | L427 | 11 | `_spawnEffect()` |
| _applyMove | method | L428 | L484 | 57 | `_applyMove(vel, width, height, spawnCallback)` |
| onHit | method | L485 | L531 | 47 | `onHit(enemy, allEnemies)` |
| performSlashAttack | method | L532 | L580 | 49 | `performSlashAttack(target, enemies)` |
| destroy | method | L581 | L605 | 25 | `destroy(spawnCallback)` |
| stickToEnemy | method | L606 | L638 | 33 | `stickToEnemy(enemy)` |
| handleFlyingSwordFinish | method | L639 | L666 | 28 | `handleFlyingSwordFinish(host, game, isBottomExit = false)` |
| draw | method | L667 | L1002 | **336** | `draw(ctx)` |
