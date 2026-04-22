# src/plinko_physics.js 函数索引

> 自动生成于 2026-04-22 | 总行数: 597 | 函数数: 15 | 语言: javascript
> **本文件由 code-indexer 脚本自动生成，严禁手动编辑。**

## 函数列表

| 函数名 | 类型 | 起始行 | 结束行 | 行数 | 签名 |
|--------|------|--------|--------|------|------|
| calcVelocityDependentElasticity | function | L155 | L172 | 18 | `calcVelocityDependentElasticity(impactSpeed, eMax = 0.92, eMin = 0.72, vChar = 4.0)` |
| resolveEnhancedCollision | function | L173 | L245 | 73 | `resolveEnhancedCollision(ball, peg, params)` |
| calcMagnusForce | function | L246 | L262 | 17 | `calcMagnusForce(spin, vel, magnusStrength)` |
| decaySpin | function | L263 | L277 | 15 | `decaySpin(spin, decayRate = 0.015)` |
| binomialPMF | function | L278 | L295 | 18 | `binomialPMF(n, k, p)` |
| logBinomialCoeff | function | L296 | L317 | 22 | `logBinomialCoeff(n, k)` |
| calcDropDistribution | function | L318 | L356 | 39 | `calcDropDistribution(rows, cols, layout = 'default', tiltBias = 0)` |
| getEffectiveRows | function | L357 | L385 | 29 | `getEffectiveRows(rows, layout)` |
| interpolateDistribution | function | L386 | L410 | 25 | `interpolateDistribution(src, dstLen)` |
| applyLayoutCorrection | function | L411 | L492 | 82 | `applyLayoutCorrection(probs, layout, rows)` |
| generateHeatmapData | function | L493 | L522 | 30 | `generateHeatmapData(distribution, canvasWidth, boardBottomY, canvasHeight, layout = 'default')` |
| adjustDistributionForEntry | function | L523 | L561 | 39 | `adjustDistributionForEntry(entryX, canvasWidth, baseDistrib)` |
| getLayoutParams | function | L562 | L570 | 9 | `getLayoutParams(layout)` |
| getAllLayoutHints | function | L571 | L590 | 20 | `getAllLayoutHints()` |
| calcOptimalEntryX | function | L591 | L598 | 8 | `calcOptimalEntryX(layout, canvasWidth, cols)` |
