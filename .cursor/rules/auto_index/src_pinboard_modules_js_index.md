# src\pinboard_modules.js 函数索引

> 自动生成于 2026-06-18 | 总行数: 858 | 函数数: 46 | 语言: javascript
> **本文件由 code-indexer 脚本自动生成，严禁手动编辑。**

## 函数列表

> 定位方式：在源文件中 `grep -n "函数名"` 即可跳转，行号不在此列出（行号随代码变化而失效）。

| 函数名 | 类型 | 签名 | 备注 |
|--------|------|------|------|
| createModuleUid | function | `createModuleUid(moduleId)` |  |
| createModuleInstance | function | `createModuleInstance(moduleId, seed = {})` |  |
| createModuleRef | function | `createModuleRef(anchorIdx)` |  |
| isModuleRef | function | `isModuleRef(entry)` |  |
| getModuleIdFromEntry | function | `getModuleIdFromEntry(entry)` |  |
| getModuleInstance | function | `getModuleInstance(entry)` |  |
| normalizeModuleEntry | function | `normalizeModuleEntry(entry)` |  |
| ensureModuleLayoutInstances | function | `ensureModuleLayoutInstances(layout, totalSlots, defaultSlots = CONFIG.gameplay.moduleDefaultSlots || 3)` |  |
| getRandomPegTypeFromWeights | function | `getRandomPegTypeFromWeights(weights)` |  |
| applyWeightedPegTypes | function | `applyWeightedPegTypes(pegs, ctx)` |  |
| generateStaggeredPegs | function | `generateStaggeredPegs(originX, originY, w, h, cols, rows, type = 'normal')` |  |
| generateFunnelPegs | function | `generateFunnelPegs(originX, originY, w, h, topCols, rows)` |  |
| markFusionFocus | function | `markFusionFocus(pegs, originX, originY, w, h, maxPriority = 3)` |  |
| build | method | `build(ox, oy, w, h)` |  |
| build | method | `build(ox, oy, w, h)` |  |
| build | method | `build(ox, oy, w, h)` |  |
| build | method | `build(ox, oy, w, h)` |  |
| build | method | `build(ox, oy, w, h)` |  |
| build | method | `build(ox, oy, w, h)` |  |
| build | method | `build(ox, oy, w, h)` |  |
| build | method | `build(ox, oy, w, h, ctx, slotIdx)` |  |
| build | method | `build(ox, oy, w, h)` |  |
| build | method | `build(ox, oy, w, h)` |  |
| build | method | `build(ox, oy, w, h)` |  |
| build | method | `build(ox, oy, w, h)` |  |
| build | method | `build(ox, oy, w, h)` |  |
| build | method | `build(ox, oy, w, h)` |  |
| build | method | `build(ox, oy, w, h)` |  |
| build | method | `build(ox, oy, w, h)` |  |
| build | method | `build(ox, oy, w, h)` |  |
| build | method | `build(ox, oy, w, h)` |  |
| build | method | `build(ox, oy, w, h)` |  |
| build | method | `build(ox, oy, w, h)` |  |
| build | method | `build(ox, oy, w, h)` |  |
| build | method | `build(ox, oy, w, h)` |  |
| build | method | `build(ox, oy, w, h)` |  |
| build | method | `build(ox, oy, w, h)` |  |
| createDefaultModuleLayout | function | `createDefaultModuleLayout(totalSlots, activeSlots = CONFIG.gameplay.moduleDefaultSlots || 3)` |  |
| selectFusionTargetPegs | function | `selectFusionTargetPegs(pegs, fusion, canvasWidth, canvasHeight, randomize = false)` |  |
| applyModulePegStates | function | `applyModulePegStates(pegs, ctx, moduleInstance)` |  |
| setModulePegState | function | `setModulePegState(moduleEntry, peg, state)` |  |
| buildModuleEntities | function | `buildModuleEntities(moduleEntry, originX, originY, width, height, ctx, slotIdx)` |  |
| calcModuleSlotRect | function | `calcModuleSlotRect(slotIdx, canvasWidth, canvasHeight, cfg, span)` |  |
| getModuleSpan | function | `getModuleSpan(moduleId)` |  |
| getCoveredSlots | function | `getCoveredSlots(anchorIdx, span, totalCols, totalRows)` |  |
| listAvailableModules | function | `listAvailableModules(unlockedModuleTypes)` |  |
