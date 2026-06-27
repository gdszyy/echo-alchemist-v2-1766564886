# src\effects\particles.js 函数索引

> 自动生成于 2026-06-27 | 总行数: 5197 | 函数数: 135 | 语言: javascript
> **本文件由 code-indexer 脚本自动生成，严禁手动编辑。**

**巨型函数警告**: 本文件包含 2 个超过 200 行的函数，建议优先通过 `@section` 标记进行内部导航。

## 函数列表

> 定位方式：在源文件中 `grep -n "函数名"` 即可跳转，行号不在此列出（行号随代码变化而失效）。

| 函数名 | 类型 | 签名 | 备注 |
|--------|------|------|------|
| withAlpha | function | `withAlpha(color, alpha)` |  |
| constructor | method | `constructor(x, y, color, mode = 'normal')` |  |
| reset | method | `reset(x, y, color, mode = 'normal')` |  |
| _init | method | `_init(x, y, color, mode = 'normal')` |  |
| update | method | `update(timeScale)` |  |
| draw | method | `draw(ctx)` |  |
| constructor | method | `constructor(x, y, angle, length, color)` |  |
| update | method | `update()` |  |
| draw | method | `draw(ctx)` |  |
| constructor | method | `constructor(x, y, angle, length = 92, color = '#fca5a5', quality = 'high', options = {})` |  |
| update | method | `update(timeScale)` |  |
| draw | method | `draw(ctx)` |  |
| constructor | method | `constructor(x, bottomY)` |  |
| update | method | `update(timeScale)` |  |
| draw | method | `draw(ctx)` |  |
| constructor | method | `constructor(x, y, color, options = {})` |  |
| update | method | `update(timeScale)` |  |
| draw | method | `draw(ctx)` |  |
| _drawImpact | method | `_drawImpact(ctx, isLow, radius, t)` |  |
| _drawAssimilation | method | `_drawAssimilation(ctx, isLow, radius, t)` |  |
| constructor | method | `constructor(x, y, color, options = {})` |  |
| constructor | method | `constructor(x, y, color, options = {})` |  |
| constructor | method | `constructor(x, y, mode = 'prelude', quality = 'high')` |  |
| update | method | `update(timeScale)` |  |
| draw | method | `draw(ctx)` |  |
| constructor | method | `constructor(x, y, chainIndex = 0, quality = 'high')` |  |
| update | method | `update(timeScale)` |  |
| phases | method | `phases()` |  |
| handAngle | method | `handAngle(ph)` |  |
| draw | method | `draw(ctx)` |  |
| constructor | method | `constructor(segments, width, color, isContinuous = false)` |  |
| startFadeOut | method | `startFadeOut()` |  |
| update | method | `update(timeScale)` |  |
| draw | method | `draw(ctx)` |  |
| constructor | method | `constructor(x, y, text, color = '#fbbf24', fontSize = 16, iconImg = null, options = {})` |  |
| update | method | `update(timeScale)` |  |
| accelerateExit | method | `accelerateExit()` |  |
| getRenderScale | method | `getRenderScale()` |  |
| draw | method | `draw(ctx)` |  |
| constructor | method | `constructor(x, y, targetX, targetY, color, initialVel, onArrive, options = {})` |  |
| update | method | `update(timeScale)` |  |
| draw | method | `draw(ctx)` |  |
| constructor | method | `constructor(x1, y1, x2, y2)` |  |
| generateSegments | method | `generateSegments()` |  |
| update | method | `update(timeScale)` |  |
| draw | method | `draw(ctx)` |  |
| constructor | method | `constructor(x, y)` |  |
| update | method | `update(timeScale)` |  |
| draw | method | `draw(ctx)` |  |
| constructor | method | `constructor(enemy)` |  |
| update | method | `update(pos, temp, timeScale)` |  |
| _updateEmbers | method | `_updateEmbers(timeScale)` |  |
| draw | method | `draw(ctx)` |  |
| _drawCanvas2D | method | `_drawCanvas2D(ctx)` |  |
| destroy | method | `destroy()` |  |
| constructor | method | `constructor(enemy, duration = 600)` |  |
| refresh | method | `refresh(duration = 600)` |  |
| update | method | `update(pos, timeScale)` |  |
| _spawnArc | method | `_spawnArc()` |  |
| draw | method | `draw(ctx)` |  |
| _drawCanvas2D | method | `_drawCanvas2D(ctx)` |  |
| destroy | method | `destroy()` |  |
| constructor | method | `constructor(enemy, stacks = 1)` |  |
| addStacks | method | `addStacks(stacks)` |  |
| update | method | `update(pos, timeScale)` |  |
| draw | method | `draw(ctx)` |  |
| _drawCanvas2D | method | `_drawCanvas2D(ctx)` |  |
| destroy | method | `destroy()` |  |
| constructor | method | `constructor(enemy, windLevel = 1)` |  |
| refresh | method | `refresh(windLevel = 1)` |  |
| update | method | `update(pos, timeScale)` |  |
| draw | method | `draw(ctx)` |  |
| _drawCanvas2D | method | `_drawCanvas2D(ctx)` |  |
| destroy | method | `destroy()` |  |
| constructor | method | `constructor(x, y)` |  |
| update | method | `update(timeScale)` |  |
| draw | method | `draw(ctx)` |  |
| constructor | method | `constructor(x, y, tier = 'normal', variant = 'default')` |  |
| _initVenom | method | `_initVenom(tier)` |  |
| _updateVenom | method | `_updateVenom(timeScale)` |  |
| update | method | `update(timeScale)` |  |
| draw | method | `draw(ctx)` | ⚠️ 巨型函数，见 @section 导航 |
| _drawVenom | method | `_drawVenom(ctx)` |  |
| constructor | method | `constructor(x, y, range = 120)` |  |
| update | method | `update(timeScale)` |  |
| draw | method | `draw(ctx)` |  |
| _traceBloomPetal | method | `_traceBloomPetal(ctx, angle, petal, bloom, alpha, isLow, tintOverride = null)` |  |
| constructor | method | `constructor(x, y, radius)` |  |
| update | method | `update(timeScale)` |  |
| draw | method | `draw(ctx)` |  |
| constructor | method | `constructor(x, y, radius = 120)` |  |
| setCenter | method | `setCenter(x, y)` |  |
| fadeOut | method | `fadeOut()` |  |
| update | method | `update(timeScale = 1)` |  |
| _drawBlade | method | `_drawBlade(ctx, ang, r, dirSign, lenScale, widScale, alpha)` |  |
| draw | method | `draw(ctx)` |  |
| constructor | method | `constructor(x, y, color = '#34d399')` |  |
| update | method | `update(timeScale)` |  |
| draw | method | `draw(ctx)` |  |
| constructor | method | `constructor(x, y, rewardType)` |  |
| update | method | `update(timeScale)` |  |
| draw | method | `draw(ctx)` | ⚠️ 巨型函数，见 @section 导航 |
| constructor | method | `constructor(x, y, angle, elementColor, intensity = 1.0)` |  |
| _pixiCreate | method | `_pixiCreate()` |  |
| update | method | `update(dtSec)` |  |
| draw | method | `draw(ctx)` |  |
| constructor | method | `constructor(x, y, angle, elementColor, intensity = 1.0)` |  |
| _pixiCreate | method | `_pixiCreate()` |  |
| update | method | `update(dtSec)` |  |
| draw | method | `draw(ctx)` |  |
| constructor | method | `constructor(x, y, skillType, opts = {})` |  |
| _setupType | method | `_setupType(pmul)` |  |
| update | method | `update(timeScale)` |  |
| draw | method | `draw(ctx)` |  |
| constructor | method | `constructor(enemy)` |  |
| addArc | method | `addArc(hitX, hitY, dirAngle, tier3 = false)` |  |
| update | method | `update(pos, timeScale)` |  |
| _arcAnim | method | `_arcAnim(arc)` |  |
| draw | method | `draw(ctx)` |  |
| _arcGeom | method | `_arcGeom(arc, phase = 0, scale = 1)` |  |
| _drawCanvas2D | method | `_drawCanvas2D(ctx)` |  |
| destroy | method | `destroy()` |  |
| constructor | method | `constructor(enemy)` |  |
| addBurst | method | `addBurst(hitX, hitY, resonance = false)` |  |
| update | method | `update(pos, timeScale)` |  |
| draw | method | `draw(ctx)` |  |
| _drawCanvas2D | method | `_drawCanvas2D(ctx)` |  |
| _starAt | method | `_starAt(ctx, cx, cy, r, alpha)` |  |
| destroy | method | `destroy()` |  |
| constructor | method | `constructor(enemy)` |  |
| addRipple | method | `addRipple(hitX, hitY, tier3 = false)` |  |
| update | method | `update(pos, timeScale)` |  |
| draw | method | `draw(ctx)` |  |
| _drawCanvas2D | method | `_drawCanvas2D(ctx)` |  |
| destroy | method | `destroy()` |  |

## 巨型函数内部节点 (@section 标记)

### draw

> **缺少 @section 标记**：此巨型函数内部没有节点标记，建议添加以提升导航精度。

### draw

> 定位：`grep -n '@section:节点名'` 跳转到对应节点

| 节点标记 | 说明 |
|----------|------|
| `@section:draw_relic_beam` | 遗物奖励：金色光柱 + 金币粒子 + 双层冲击波 |
| `@section:draw_chaos_essence` | 混沌精华奖励：漩涡爆炸 + 碎片四散 + 冲击波 |
| `@section:draw_pure_essence` | 纯净精华奖励：冰晶光柱 + 六角雪花粒子 + 柔和光环 |
