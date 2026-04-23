# src/entities/projectile.js 函数索引

> 自动生成于 2026-04-22 | 总行数: 1021 | 函数数: 13 | 语言: javascript
> **本文件由 code-indexer 脚本自动生成，严禁手动编辑。**

**巨型函数警告**: 本文件包含 2 个超过 200 行的函数，建议优先通过 `@section` 标记进行内部导航。

## 函数列表

> 定位方式：在源文件中 `grep -n "函数名"` 即可跳转，行号不在此列出（行号随代码变化而失效）。

| 函数名 | 类型 | 签名 | 备注 |
|--------|------|------|------|
| setProjectileAudioProvider | function | `setProjectileAudioProvider(provider)` |  |
| Projectile | class | `Projectile()` |  |
| constructor | method | `constructor(x, y, vel, config, isCopy = false, shotId = null, isLast = false)` |  |
| update | method | `update(width, height, enemies, spawnCallback, timeScale)` |  |
| _handleCollision | method | `_handleCollision(e, enemies, spawnCallback)` | ⚠️ 巨型函数，见 @section 导航 |
| _spawnEffect | method | `_spawnEffect()` |  |
| _applyMove | method | `_applyMove(vel, width, height, spawnCallback)` |  |
| onHit | method | `onHit(enemy, allEnemies)` |  |
| performSlashAttack | method | `performSlashAttack(target, enemies)` |  |
| destroy | method | `destroy(spawnCallback)` |  |
| stickToEnemy | method | `stickToEnemy(enemy)` |  |
| handleFlyingSwordFinish | method | `handleFlyingSwordFinish(host, game, isBottomExit = false)` |  |
| draw | method | `draw(ctx)` | ⚠️ 巨型函数，见 @section 导航 |
