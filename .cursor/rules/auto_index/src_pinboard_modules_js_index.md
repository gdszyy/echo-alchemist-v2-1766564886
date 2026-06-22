# src\pinboard_modules.js 函数索引

> 自动生成于 2026-06-22 | 总行数: 1762 | 函数数: 80 | 语言: javascript
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
| normalizeModuleInventory | function | `normalizeModuleInventory(inventory)` |  |
| addModuleComponentToInventory | function | `addModuleComponentToInventory(inventory, moduleId)` |  |
| getDefaultSlotOrder | function | `getDefaultSlotOrder(totalSlots, cfg = CONFIG.gameplay || {})` |  |
| getActiveModuleSlots | function | `getActiveModuleSlots(unlockedSlots, totalSlots, cfg = CONFIG.gameplay || {})` |  |
| getActiveModuleSlotSet | function | `getActiveModuleSlotSet(unlockedSlots, totalSlots, cfg = CONFIG.gameplay || {})` |  |
| migrateModuleLayoutToCurrentGrid | function | `migrateModuleLayoutToCurrentGrid(layout, totalSlots, defaultSlots)` |  |
| shouldResetLegacyStarterLayout | function | `shouldResetLegacyStarterLayout(layout, totalSlots, defaultSlots)` |  |
| ensureModuleLayoutInstances | function | `ensureModuleLayoutInstances(layout, totalSlots, defaultSlots = CONFIG.gameplay.moduleDefaultSlots || 3)` |  |
| getRandomPegTypeFromWeights | function | `getRandomPegTypeFromWeights(weights)` |  |
| applyWeightedPegTypes | function | `applyWeightedPegTypes(pegs, ctx)` |  |
| generateStaggeredPegs | function | `generateStaggeredPegs(originX, originY, w, h, cols, rows, type = 'normal')` |  |
| generateFunnelPegs | function | `generateFunnelPegs(originX, originY, w, h, topCols, rows)` |  |
| markFusionFocus | function | `markFusionFocus(pegs, originX, originY, w, h, maxPriority = 3)` |  |
| makePegAt | function | `makePegAt(ox, oy, w, h, px, py, type = 'normal', row = 0, col = 0)` |  |
| makeBarrierAt | function | `makeBarrierAt(ox, oy, w, h, ax, ay, bx, by, type = 'pink', row = 0, col = 0)` |  |
| hasNearbyPeg | function | `hasNearbyPeg(pegs, x, y, minDistance)` |  |
| addModuleSeamPegs | function | `addModuleSeamPegs(pegs, ox, oy, w, h, moduleId)` |  |
| enforceCirclePegSpacing | function | `enforceCirclePegSpacing(pegs, minDistance = MIN_PEG_SPACING)` |  |
| buildGuideFin | function | `buildGuideFin(ox, oy, w, h, mirror = false)` |  |
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
| getModuleMetaSummary | function | `getModuleMetaSummary(moduleId)` |  |
| getCoveredSlots | function | `getCoveredSlots(anchorIdx, span, totalCols, totalRows)` |  |
