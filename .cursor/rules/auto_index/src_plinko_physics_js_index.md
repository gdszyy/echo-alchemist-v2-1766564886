# src\plinko_physics.js 函数索引

> 自动生成于 2026-06-22 | 总行数: 597 | 函数数: 15 | 语言: javascript
> **本文件由 code-indexer 脚本自动生成，严禁手动编辑。**

## 函数列表

> 定位方式：在源文件中 `grep -n "函数名"` 即可跳转，行号不在此列出（行号随代码变化而失效）。

| 函数名 | 类型 | 签名 | 备注 |
|--------|------|------|------|
| calcVelocityDependentElasticity | function | `calcVelocityDependentElasticity(impactSpeed, eMax = 0.92, eMin = 0.72, vChar = 4.0)` |  |
| resolveEnhancedCollision | function | `resolveEnhancedCollision(ball, peg, params)` |  |
| calcMagnusForce | function | `calcMagnusForce(spin, vel, magnusStrength)` |  |
| decaySpin | function | `decaySpin(spin, decayRate = 0.015)` |  |
| binomialPMF | function | `binomialPMF(n, k, p)` |  |
| logBinomialCoeff | function | `logBinomialCoeff(n, k)` |  |
| calcDropDistribution | function | `calcDropDistribution(rows, cols, layout = 'default', tiltBias = 0)` |  |
| getEffectiveRows | function | `getEffectiveRows(rows, layout)` |  |
| interpolateDistribution | function | `interpolateDistribution(src, dstLen)` |  |
| applyLayoutCorrection | function | `applyLayoutCorrection(probs, layout, rows)` |  |
| generateHeatmapData | function | `generateHeatmapData(distribution, canvasWidth, boardBottomY, canvasHeight, layout = 'default')` |  |
| adjustDistributionForEntry | function | `adjustDistributionForEntry(entryX, canvasWidth, baseDistrib)` |  |
| getLayoutParams | function | `getLayoutParams(layout)` |  |
| getAllLayoutHints | function | `getAllLayoutHints()` |  |
| calcOptimalEntryX | function | `calcOptimalEntryX(layout, canvasWidth, cols)` |  |
