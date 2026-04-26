# src/effects/particles.js 函数索引

> 自动生成于 2026-04-26 | 总行数: 1832 | 函数数: 62 | 语言: javascript
> **本文件由 code-indexer 脚本自动生成，严禁手动编辑。**

**巨型函数警告**: 本文件包含 1 个超过 200 行的函数，建议优先通过 `@section` 标记进行内部导航。

## 函数列表

> 定位方式：在源文件中 `grep -n "函数名"` 即可跳转，行号不在此列出（行号随代码变化而失效）。

| 函数名 | 类型 | 签名 | 备注 |
|--------|------|------|------|
| Particle | class | `Particle()` |  |
| constructor | method | `constructor(x, y, color, mode = 'normal')` |  |
| update | method | `update(timeScale)` |  |
| draw | method | `draw(ctx)` |  |
| SlashEffect | class | `SlashEffect()` |  |
| constructor | method | `constructor(x, y, angle, length, color)` |  |
| update | method | `update()` |  |
| draw | method | `draw(ctx)` |  |
| CollectionBeam | class | `CollectionBeam()` |  |
| constructor | method | `constructor(x, bottomY)` |  |
| update | method | `update(timeScale)` |  |
| draw | method | `draw(ctx)` |  |
| Shockwave | class | `Shockwave()` |  |
| constructor | method | `constructor(x, y, color)` |  |
| update | method | `update(timeScale)` |  |
| draw | method | `draw(ctx)` |  |
| LaserBeam | class | `LaserBeam()` |  |
| constructor | method | `constructor(segments, width, color, isContinuous = false)` |  |
| startFadeOut | method | `startFadeOut()` |  |
| update | method | `update(timeScale)` |  |
| draw | method | `draw(ctx)` |  |
| FloatingText | class | `FloatingText()` |  |
| constructor | method | `constructor(x, y, text, color = '#fbbf24', fontSize = 16)` |  |
| update | method | `update(timeScale)` |  |
| draw | method | `draw(ctx)` |  |
| EnergyOrb | class | `EnergyOrb()` |  |
| constructor | method | `constructor(x, y, targetX, targetY, color, initialVel, onArrive)` |  |
| update | method | `update(timeScale)` |  |
| draw | method | `draw(ctx)` |  |
| LightningBolt | class | `LightningBolt()` |  |
| constructor | method | `constructor(x1, y1, x2, y2)` |  |
| generateSegments | method | `generateSegments()` |  |
| update | method | `update(timeScale)` |  |
| draw | method | `draw(ctx)` |  |
| FireWave | class | `FireWave()` |  |
| constructor | method | `constructor(x, y)` |  |
| update | method | `update(timeScale)` |  |
| draw | method | `draw(ctx)` |  |
| IceWave | class | `IceWave()` |  |
| constructor | method | `constructor(x, y)` |  |
| update | method | `update(timeScale)` |  |
| draw | method | `draw(ctx)` |  |
| DeathExplosion | class | `DeathExplosion()` |  |
| constructor | method | `constructor(x, y, tier = 'normal')` |  |
| update | method | `update(timeScale)` |  |
| draw | method | `draw(ctx)` |  |
| HealWave | class | `HealWave()` |  |
| constructor | method | `constructor(x, y, range = 120)` |  |
| update | method | `update(timeScale)` |  |
| draw | method | `draw(ctx)` |  |
| BladeStormRing | class | `BladeStormRing()` |  |
| constructor | method | `constructor(x, y, radius)` |  |
| update | method | `update(timeScale)` |  |
| draw | method | `draw(ctx)` |  |
| SwordScar | class | `SwordScar()` |  |
| constructor | method | `constructor(x, y)` |  |
| update | method | `update(timeScale)` |  |
| draw | method | `draw(ctx)` |  |
| RewardDropEffect | class | `RewardDropEffect()` |  |
| constructor | method | `constructor(x, y, rewardType)` |  |
| update | method | `update(timeScale)` |  |
| draw | method | `draw(ctx)` | ⚠️ 巨型函数，见 @section 导航 |

## 巨型函数内部节点 (@section 标记)

### draw

> 定位：`grep -n '@section:{}'` 跳转到对应节点

| 节点标记 | 说明 |
|----------|------|
| `@section:draw_relic_beam` | 遗物奖励：金色光柱 + 金币粒子 + 双层冲击波 |
| `@section:draw_chaos_essence` | 混沌精华奖励：漩涡爆炸 + 碎片四散 + 冲击波 |
| `@section:draw_pure_essence` | 纯净精华奖励：冰晶光柱 + 六角雪花粒子 + 柔和光环 |
