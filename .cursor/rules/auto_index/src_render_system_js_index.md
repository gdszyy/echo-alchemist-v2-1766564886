# src/render_system.js 函数索引

> 自动生成于 2026-04-24 | 总行数: 647 | 函数数: 10 | 语言: javascript
> **本文件由 code-indexer 脚本自动生成，严禁手动编辑。**

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
| render_combat_launcherOrbitals | method | `render_combat_launcherOrbitals(ctx, centerX, centerY, recipe)` |  |
| drawTiltVignette | method | `drawTiltVignette(ctx, tilt)` |  |
| drawTiltIndicator | method | `drawTiltIndicator(ctx, tilt)` |  |
| render_perfOverlay | method | `render_perfOverlay()` |  |

## 其他 @section 标记

| 节点标记 | 说明 |
|----------|------|
| `@section:wind_matrix_init` | 初始化进度参数并生成风属粒子特效 |
| `@section:wind_matrix_tunnel` | 隧道型风阵：渐变光带 + 方向箭头动画 |
| `@section:wind_matrix_bowtie` | 蝴蝶结形风阵：蝴蝶路径波局线动画 |
| `@section:wind_matrix_cyclone` | 旋风型风阵：高速切割刃 + 逆向符文环动画 |
