# src\render_system.js 函数索引

> 自动生成于 2026-06-27 | 总行数: 1249 | 函数数: 20 | 语言: javascript
> **本文件由 code-indexer 脚本自动生成，严禁手动编辑。**

**巨型函数警告**: 本文件包含 1 个超过 200 行的函数，建议优先通过 `@section` 标记进行内部导航。

## 函数列表

> 定位方式：在源文件中 `grep -n "函数名"` 即可跳转，行号不在此列出（行号随代码变化而失效）。

| 函数名 | 类型 | 签名 | 备注 |
|--------|------|------|------|
| render_clearCanvas | method | `render_clearCanvas()` |  |
| render_background | method | `render_background()` |  |
| render_combat_walls | method | `render_combat_walls(ctx, wallLeftX, wallRightX, wallTopY)` |  |
| render_combat_defeatLine | method | `render_combat_defeatLine(ctx)` |  |
| render_windAnchors | method | `render_windAnchors()` |  |
| render_butterflyPathWave | method | `render_butterflyPathWave(ctx, anchors, center, progress)` |  |
| render_singleWindMatrix | method | `render_singleWindMatrix(matrix)` |  |
| render_floatingTexts | method | `render_floatingTexts(timeScale)` |  |
| render_combat_launcherOrbitals | method | `render_combat_launcherOrbitals()` |  |
| render_combat_aimGuideNode | method | `render_combat_aimGuideNode(ctx, x, y, kind = 'wall', size = 18, alpha = 0.9)` |  |
| render_combat_launcherSignal | method | `render_combat_launcherSignal(ctx, cx, cy, portX, portY, recipe, visual = {})` |  |
| drawDamageReadout | function | `drawDamageReadout()` |  |
| drawBurstReadout | function | `drawBurstReadout()` |  |
| drawAttributeMagazine | function | `drawAttributeMagazine()` |  |
| drawLoadedProjectile | function | `drawLoadedProjectile()` |  |
| render_queueLauncherBarrelFireEffect | method | `render_queueLauncherBarrelFireEffect(vel, recipe = {})` |  |
| render_combat_launcherEmitterBase | method | `render_combat_launcherEmitterBase(ctx, cx, cy, isCharging, chargeProgress, reloadProgress = 0, aimRotation = -Math.PI / 2)` | ⚠️ 巨型函数，见 @section 导航 |
| drawTiltVignette | method | `drawTiltVignette(ctx, tilt)` |  |
| drawTiltIndicator | method | `drawTiltIndicator(ctx, tilt)` |  |
| render_perfOverlay | method | `render_perfOverlay()` |  |

## 巨型函数内部节点 (@section 标记)

### render_combat_launcherEmitterBase

> **缺少 @section 标记**：此巨型函数内部没有节点标记，建议添加以提升导航精度。


## 其他 @section 标记

| 节点标记 | 说明 |
|----------|------|
| `@section:wind_matrix_init` | 初始化进度参数并生成风属粒子特效 |
| `@section:wind_matrix_tunnel` | 隧道型风阵：渐变光带 + 方向箭头动画 |
| `@section:wind_matrix_bowtie` | 蝴蝶结形风阵：蝴蝶路径波局线动画 |
| `@section:wind_matrix_cyclone` | 旋风型风阵：高速切割刃 + 逆向符文环动画 |
