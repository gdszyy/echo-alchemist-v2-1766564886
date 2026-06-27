# src\entities\projectile.js 函数索引

> 自动生成于 2026-06-27 | 总行数: 1957 | 函数数: 20 | 语言: javascript
> **本文件由 code-indexer 脚本自动生成，严禁手动编辑。**

**巨型函数警告**: 本文件包含 1 个超过 200 行的函数，建议优先通过 `@section` 标记进行内部导航。

## 函数列表

> 定位方式：在源文件中 `grep -n "函数名"` 即可跳转，行号不在此列出（行号随代码变化而失效）。

| 函数名 | 类型 | 签名 | 备注 |
|--------|------|------|------|
| setProjectileAudioProvider | function | `setProjectileAudioProvider(provider)` |  |
| constructor | method | `constructor(x, y, vel, config, isCopy = false, shotId = null, isLast = false)` |  |
| update | method | `update(width, height, enemies, spawnCallback, timeScale)` |  |
| _handleCollision | method | `_handleCollision(e, enemies, spawnCallback)` | ⚠️ 巨型函数，见 @section 导航 |
| _spawnEffect | method | `_spawnEffect()` |  |
| _applyMove | method | `_applyMove(vel, width, height, spawnCallback)` |  |
| onHit | method | `onHit(enemy, allEnemies)` |  |
| performSlashAttack | method | `performSlashAttack(target, enemies)` |  |
| _tryTriggerEchoBullet | method | `_tryTriggerEchoBullet()` |  |
| _detonateOvercharge | method | `_detonateOvercharge()` |  |
| releasePixiResources | method | `releasePixiResources()` |  |
| destroy | method | `destroy(spawnCallback)` |  |
| stickToEnemy | method | `stickToEnemy(enemy)` |  |
| handleFlyingSwordFinish | method | `handleFlyingSwordFinish(host, game, isBottomExit = false)` |  |
| draw | method | `draw(ctx)` |  |
| _syncBulletGlow | method | `_syncBulletGlow()` |  |
| _drawTrail | method | `_drawTrail(ctx)` |  |
| _drawTrailV2 | method | `_drawTrailV2()` |  |
| _resolveTrailColor | method | `_resolveTrailColor(cfg)` |  |
| _drawTrailCanvas2D | method | `_drawTrailCanvas2D(ctx, perfQuality)` |  |

## 巨型函数内部节点 (@section 标记)

### _handleCollision

> **缺少 @section 标记**：此巨型函数内部没有节点标记，建议添加以提升导航精度。


## 其他 @section 标记

| 节点标记 | 说明 |
|----------|------|
| `@section:draw_entry_transform` | 坐标变换入口（translate + rotate），确定绘制坐标系 |
| `@section:draw_flying_sword` | 飞剑完整绘制：剑身/剑格/剑柄/剑首/剑穗（独立 restore+return） |
| `@section:draw_shape_and_color_resolve` | 形状类型与颜色决策（shapeType / mainColor / glowColor） |
| `@section:draw_orb_special` | 光球(orb)特殊渲染：脉冲光晕 + 纯白核心（独立 restore） |
| `@section:draw_shape_fill` | 形状绘制与填色：arrow/star/crystal/matryoshka/circle 分支 + 渐变/发光 |
| `@section:draw_damage_cracks` | 耐久度低于 0.6 时绘制裂纹贝塞尔曲线 |
| `@section:draw_wind_blades` | 风属性环绕风刃特效：弯月形风刃按轨道旋转 |
