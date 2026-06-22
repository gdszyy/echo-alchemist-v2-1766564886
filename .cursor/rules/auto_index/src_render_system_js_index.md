# src\render_system.js 函数索引

> 自动生成于 2026-06-23 | 总行数: 1157 | 函数数: 20 | 语言: javascript
> **本文件由 code-indexer 脚本自动生成，严禁手动编辑。**

**巨型函数警告**: 本文件包含 1 个超过 200 行的函数，建议优先通过 `@section` 标记进行内部导航。

## 函数列表

> 定位方式：在源文件中 `grep -n "函数名"` 即可跳转，行号不在此列出（行号随代码变化而失效）。

| 函数名 | 类型 | 签名 | 备注 |
|--------|------|------|------|
| render_clearCanvas | method | `render_clearCanvas()` |  |
| render_background | method | `render_background()` |  |
| render_windAnchors | method | `render_windAnchors()` |  |
| render_butterflyPathWave | method | `render_butterflyPathWave(ctx, anchors, center, progress)` |  |
| render_singleWindMatrix | method | `render_singleWindMatrix(matrix)` |  |
| render_floatingTexts | method | `render_floatingTexts(timeScale)` |  |
| render_combat_launcherOrbitals | method | `render_combat_launcherOrbitals(ctx, centerX, centerY, recipe)` | ⚠️ 巨型函数，见 @section 导航 |
| render_combat_launcherSignal | method | `render_combat_launcherSignal(ctx, cx, cy, portX, portY, recipe, visual = {})` |  |
| drawInsetPanel | function | `drawInsetPanel(x, y, w, h, color, radius = 5, alpha = 0.9)` |  |
| drawChamberFrame | function | `drawChamberFrame()` |  |
| drawValueScreen | function | `drawValueScreen()` |  |
| drawScatterPreview | function | `drawScatterPreview()` |  |
| drawMuzzlePulse | function | `drawMuzzlePulse()` |  |
| drawBurstStack | function | `drawBurstStack()` |  |
| drawAttributeMagazine | function | `drawAttributeMagazine()` |  |
| drawLoadedProjectile | function | `drawLoadedProjectile()` |  |
| render_combat_launcherEmitterBase | method | `render_combat_launcherEmitterBase(ctx, cx, cy, isCharging, chargeProgress, reloadProgress = 0, aimRotation = -Math.PI / 2)` |  |
| drawTiltVignette | method | `drawTiltVignette(ctx, tilt)` |  |
| drawTiltIndicator | method | `drawTiltIndicator(ctx, tilt)` |  |
| render_perfOverlay | method | `render_perfOverlay()` |  |

## 巨型函数内部节点 (@section 标记)

### render_combat_launcherOrbitals

> 定位：`grep -n '@section:节点名'` 跳转到对应节点

| 节点标记 | 说明 |
|----------|------|
| `@section:launcher_orbital_stats` | 读取下一发属性并生成轨道球列表 |
| `@section:launcher_orbital_motion` | 装填/蓄力时的半径、透明度与缩放 |
| `@section:launcher_orbital_track` | 绘制轨道环和位图连线资源 |
| `@section:launcher_orbital_orbs` | 绘制属性球、图标、连线和吸入轨迹 |


## 其他 @section 标记

| 节点标记 | 说明 |
|----------|------|
| `@section:wind_matrix_init` | 初始化进度参数并生成风属粒子特效 |
| `@section:wind_matrix_tunnel` | 隧道型风阵：渐变光带 + 方向箭头动画 |
| `@section:wind_matrix_bowtie` | 蝴蝶结形风阵：蝴蝶路径波局线动画 |
| `@section:wind_matrix_cyclone` | 旋风型风阵：高速切割刃 + 逆向符文环动画 |
