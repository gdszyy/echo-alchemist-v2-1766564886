# src\entities\enemy.js 函数索引

> 自动生成于 2026-07-22 | 总行数: 12216 | 函数数: 195 | 语言: javascript
> **本文件由 code-indexer 脚本自动生成，严禁手动编辑。**

**巨型函数警告**: 本文件包含 10 个超过 200 行的函数，建议优先通过 `@section` 标记进行内部导航。

## 函数列表

> 定位方式：在源文件中 `grep -n "函数名"` 即可跳转，行号不在此列出（行号随代码变化而失效）。

| 函数名 | 类型 | 签名 | 备注 |
|--------|------|------|------|
| setEnemyAudioProvider | function | `setEnemyAudioProvider(provider)` |  |
| _getAffixOverlayImage | function | `_getAffixOverlayImage(src)` |  |
| _getEnemyFrameImage | function | `_getEnemyFrameImage(src)` |  |
| _preloadDefenseShieldMembranes | function | `_preloadDefenseShieldMembranes()` |  |
| _measureImageAlphaBounds | function | `_measureImageAlphaBounds(img)` |  |
| _createDefenseFlowShieldMembraneStack | function | `_createDefenseFlowShieldMembraneStack(kind = 'shield', randomize = true)` |  |
| _hexToRgba | function | `_hexToRgba(hex, alpha)` |  |
| _getBossHpThemePalette | function | `_getBossHpThemePalette(bossType)` |  |
| constructor | method | `constructor(x, y, width, height, hp, maxHp = hp, type = 'normal', affixes = [])` | ⚠️ 巨型函数，见 @section 导航 |
| initSprite | method | `initSprite()` |  |
| _initTexture | method | `_initTexture(width, height)` |  |
| applyExplosionKnockback | method | `applyExplosionKnockback(cx, cy, radius = 100, maxOffset = 12)` |  |
| _tickExplosionKnockback | method | `_tickExplosionKnockback(timeScale)` |  |
| update | method | `update(timeScale, game)` | ⚠️ 巨型函数，见 @section 导航 |
| releasePersistentEffects | method | `releasePersistentEffects()` |  |
| addSwordCrack | method | `addSwordCrack(relPos, angle)` |  |
| updateTempParticles | method | `updateTempParticles(timeScale)` |  |
| advance | method | `advance(amount)` |  |
| _getDevourTargets | method | `_getDevourTargets(game, afx)` |  |
| _isMoveBlocked | method | `_isMoveBlocked(game, rows = 1)` |  |
| _getFootprintCells | method | `_getFootprintCells(game)` |  |
| _getDefenseBarrierDamage | method | `_getDefenseBarrierDamage(game)` |  |
| _areShieldsDisabledThisTurn | method | `_areShieldsDisabledThisTurn()` |  |
| _getAdaptiveRuneAllowedElements | method | `_getAdaptiveRuneAllowedElements()` |  |
| _clearRuneBearerTempAffix | method | `_clearRuneBearerTempAffix()` |  |
| _tickRuneBearerForTurn | method | `_tickRuneBearerForTurn(gameRef = null)` |  |
| _resolveAdaptiveRuneElementFromSource | method | `_resolveAdaptiveRuneElementFromSource(source)` |  |
| _recordAdaptiveRuneElement | method | `_recordAdaptiveRuneElement(element, gameRef = null, reason = 'damage')` |  |
| _recordAdaptiveRuneElementFromSource | method | `_recordAdaptiveRuneElementFromSource(source, gameRef = null, reason = 'damage')` |  |
| _getAdaptiveRuneDropElement | method | `_getAdaptiveRuneDropElement()` |  |
| _tickRuneRewardVisualTimers | method | `_tickRuneRewardVisualTimers(timeScale = 1)` |  |
| _applyPhaseShieldInitialBonus | method | `_applyPhaseShieldInitialBonus()` |  |
| _grantShieldCharges | method | `_grantShieldCharges(amount)` |  |
| _ensureLivingArmor | method | `_ensureLivingArmor(sourceMaxHp = null)` |  |
| _grantLivingArmor | method | `_grantLivingArmor(sourceMaxHp, stackMult = 1)` |  |
| _restoreLivingArmorForTurn | method | `_restoreLivingArmorForTurn()` |  |
| _tickPhaseShieldForTurn | method | `_tickPhaseShieldForTurn(game)` |  |
| _tickArmorSporeForTurn | method | `_tickArmorSporeForTurn(game)` |  |
| _tickCarrierForTurn | method | `_tickCarrierForTurn(game)` |  |
| _tryResolveDefenseBarrierMove | method | `_tryResolveDefenseBarrierMove(game, moveAmount)` |  |
| _selectTurnIntent | method | `_selectTurnIntent(game, afx)` |  |
| _getRadiantAegisConfig | method | `_getRadiantAegisConfig()` |  |
| _initRadiantAegis | method | `_initRadiantAegis()` |  |
| _grantShieldLayer | method | `_grantShieldLayer(amount = 1, options = {})` |  |
| _grantRadiantAegisPulse | method | `_grantRadiantAegisPulse(game, amount = null, options = {})` |  |
| _consumeBossVulnerabilityExposedTurn | method | `_consumeBossVulnerabilityExposedTurn(game)` |  |
| _growBossVulnerabilityThreshold | method | `_growBossVulnerabilityThreshold(game = null)` |  |
| _getRadiantAegisTargets | method | `_getRadiantAegisTargets(game)` |  |
| _tickRadiantAegis | method | `_tickRadiantAegis(game)` |  |
| _getTeslaConfig | method | `_getTeslaConfig()` |  |
| _isTeslaBoss | method | `_isTeslaBoss()` |  |
| _isTeslaConductor | method | `_isTeslaConductor()` |  |
| _ensureTeslaConductorMetadata | method | `_ensureTeslaConductorMetadata()` |  |
| _findTeslaBoss | method | `_findTeslaBoss(game)` |  |
| _addTeslaFieldPower | method | `_addTeslaFieldPower(amount, game = null, label = null)` |  |
| _applyTeslaConductorCharge | method | `_applyTeslaConductorCharge(game, turns = null, fieldGain = null)` |  |
| _tickTeslaConductorForTurn | method | `_tickTeslaConductorForTurn()` |  |
| _getTeslaConductors | method | `_getTeslaConductors(game)` |  |
| _findTeslaConductorSpawnPositions | method | `_findTeslaConductorSpawnPositions(game, count)` |  |
| _teslaSpawnConductors | method | `_teslaSpawnConductors(game, count = 1)` |  |
| _teslaShockRandomEnemies | method | `_teslaShockRandomEnemies(game)` |  |
| _tickTeslaNetwork | method | `_tickTeslaNetwork(game)` |  |
| _getGlaciesConfig | method | `_getGlaciesConfig()` |  |
| _isGlaciesBoss | method | `_isGlaciesBoss()` |  |
| _isGlaciesFrostStitch | method | `_isGlaciesFrostStitch()` |  |
| _findGlaciesBoss | method | `_findGlaciesBoss(game)` |  |
| _getGlaciesGridMetrics | method | `_getGlaciesGridMetrics(game)` |  |
| _getGlaciesGridCol | method | `_getGlaciesGridCol(game, x, metrics = null)` |  |
| _getGlaciesGridRow | method | `_getGlaciesGridRow(y, metrics)` |  |
| _getGlaciesFrostSeamTargets | method | `_getGlaciesFrostSeamTargets(game, bonusTargets = 0)` |  |
| _markGlaciesFrostSeamTarget | method | `_markGlaciesFrostSeamTarget(target)` |  |
| _clearGlaciesFrostSeamTarget | method | `_clearGlaciesFrostSeamTarget(target)` |  |
| _applyGlaciesFrostSeam | method | `_applyGlaciesFrostSeam(game, target, options = {})` |  |
| _tickGlaciesFrostSeams | method | `_tickGlaciesFrostSeams(game, options = {})` |  |
| _tickGlaciesFrostSeamForTurn | method | `_tickGlaciesFrostSeamForTurn(game)` |  |
| _breakGlaciesFrostSeam | method | `_breakGlaciesFrostSeam(source = null, gameRef = null)` |  |
| _getViridisConfig | method | `_getViridisConfig()` |  |
| _isViridisBoss | method | `_isViridisBoss()` |  |
| _isViridisSporeVassal | method | `_isViridisSporeVassal()` |  |
| _findViridisBoss | method | `_findViridisBoss(game)` |  |
| _markViridisSporeTarget | method | `_markViridisSporeTarget(target)` |  |
| _getViridisArmorTargets | method | `_getViridisArmorTargets(game, maxTargets = 2)` |  |
| _addViridisSporeBloom | method | `_addViridisSporeBloom(amount, game = null, label = null)` |  |
| _viridisRecordHeal | method | `_viridisRecordHeal(game, healedCount = 1)` |  |
| _tickViridisSporeArmor | method | `_tickViridisSporeArmor(game)` |  |
| _viridisApplyCounterHit | method | `_viridisApplyCounterHit(source, gameRef = null)` |  |
| _onLivingArmorBroken | method | `_onLivingArmorBroken(gameRef = null, source = null, options = {})` |  |
| _getDevourerConfig | method | `_getDevourerConfig()` |  |
| _isDevourerBoss | method | `_isDevourerBoss()` |  |
| _isDevourerFeed | method | `_isDevourerFeed()` |  |
| _getDevourerMawPrey | method | `_getDevourerMawPrey(game)` |  |
| _devourerAttractPrey | method | `_devourerAttractPrey(game)` |  |
| _devourerDevourTargets | method | `_devourerDevourTargets(game, options = {})` |  |
| _getDevourerFeeders | method | `_getDevourerFeeders(game)` |  |
| _findDevourerFeederSpawnPositions | method | `_findDevourerFeederSpawnPositions(game, count)` |  |
| _devourerSpawnThralls | method | `_devourerSpawnThralls(game, count = 1)` |  |
| _tickDevourerMawField | method | `_tickDevourerMawField(game)` |  |
| _getChimeraConfig | method | `_getChimeraConfig()` |  |
| _isChimeraBoss | method | `_isChimeraBoss()` |  |
| _isChimeraFeed | method | `_isChimeraFeed()` |  |
| _getChimeraGridMetrics | method | `_getChimeraGridMetrics(game)` |  |
| _getChimeraGridCol | method | `_getChimeraGridCol(game, x, metrics = null)` |  |
| _getChimeraGridRow | method | `_getChimeraGridRow(y, metrics)` |  |
| _getChimeraPrey | method | `_getChimeraPrey(game)` |  |
| _isChimeraThermalPrey | method | `_isChimeraThermalPrey(enemy)` |  |
| _getChimeraPreySide | method | `_getChimeraPreySide(enemy)` |  |
| _scoreChimeraSidePrey | method | `_scoreChimeraSidePrey(enemy, side)` |  |
| _chimeraPickSidePrey | method | `_chimeraPickSidePrey(game, side, excluded = [])` |  |
| _findChimeraPullCell | method | `_findChimeraPullCell(game, target)` |  |
| _chimeraAttractPrey | method | `_chimeraAttractPrey(game)` |  |
| _chimeraPickRandomPrey | method | `_chimeraPickRandomPrey(game, excluded = [])` |  |
| _grantChimeraRadiantShield | method | `_grantChimeraRadiantShield(game, amount = 0)` |  |
| _chimeraNormalizeThermalStacks | method | `_chimeraNormalizeThermalStacks(game)` |  |
| _chimeraAbsorbThermalStacks | method | `_chimeraAbsorbThermalStacks(victim, game = null)` |  |
| _chimeraAbsorbNegativeStates | method | `_chimeraAbsorbNegativeStates(victim, game = null)` |  |
| _chimeraDevourTargets | method | `_chimeraDevourTargets(game, options = {})` |  |
| _getChimeraFeeders | method | `_getChimeraFeeders(game)` |  |
| _findChimeraFeederSpawnPositions | method | `_findChimeraFeederSpawnPositions(game, count)` |  |
| _chimeraSpawnFeeders | method | `_chimeraSpawnFeeders(game, count = 1)` |  |
| _chimeraSummonFeedersForTurn | method | `_chimeraSummonFeedersForTurn(game)` |  |
| _tickChimeraMawField | method | `_tickChimeraMawField(game, options = {})` |  |
| _ensureDevourerBodyCollisionShape | method | `_ensureDevourerBodyCollisionShape()` |  |
| _tickBossPhysicsForTurn | method | `_tickBossPhysicsForTurn()` |  |
| _tickBossMechanicsForTurn | method | `_tickBossMechanicsForTurn(game)` |  |
| startTurnAction | method | `startTurnAction(game)` |  |
| executeTurnAction | method | `executeTurnAction(game, options = {})` |  |
| _doMove | function | `_doMove()` |  |
| triggerImmediateAction | method | `triggerImmediateAction(game)` |  |
| performTurnActionAndMove | method | `performTurnActionAndMove(game)` | ⚠️ 巨型函数，见 @section 导航 |
| _getBossActionCount | method | `_getBossActionCount(baseCount)` |  |
| _getOuroborosConfig | method | `_getOuroborosConfig()` |  |
| _isOuroborosBoss | method | `_isOuroborosBoss()` |  |
| _getOuroborosAttachments | method | `_getOuroborosAttachments()` |  |
| _ensureOuroborosOrbitState | method | `_ensureOuroborosOrbitState()` |  |
| _getOuroborosCurrentAttachment | method | `_getOuroborosCurrentAttachment()` |  |
| _applyOuroborosAttachment | method | `_applyOuroborosAttachment(index, game = null, options = {})` |  |
| _getOuroborosEchoes | method | `_getOuroborosEchoes(game)` |  |
| _findOuroborosEchoSpawnPositions | method | `_findOuroborosEchoSpawnPositions(game, count)` |  |
| _ouroborosSpawnEchoes | method | `_ouroborosSpawnEchoes(game, count = 1, slot = null)` |  |
| _performOuroborosAttachmentAction | method | `_performOuroborosAttachmentAction(game, slot)` |  |
| _getOuroborosDamageGateThreshold | method | `_getOuroborosDamageGateThreshold()` |  |
| _recordOuroborosDamageGate | method | `_recordOuroborosDamageGate(actualDamage = 0, gameRef = null)` |  |
| _triggerOuroborosDamageGate | method | `_triggerOuroborosDamageGate(gameRef = null)` |  |
| _tickOuroborosOrbit | method | `_tickOuroborosOrbit(game)` |  |
| _interruptOuroborosAttachment | method | `_interruptOuroborosAttachment(gameRef = null, matchedAttr = null)` |  |
| _performOuroborosRotation | method | `_performOuroborosRotation(game)` |  |
| _glaciesPulseFrostSeamsOnLanding | method | `_glaciesPulseFrostSeamsOnLanding(game)` |  |
| playFreezeBlockEffect | method | `playFreezeBlockEffect(game)` |  |
| triggerLaserHitShake | method | `triggerLaserHitShake()` |  |
| _resolveDefenseImpactVector | method | `_resolveDefenseImpactVector(source = null)` |  |
| _triggerDefenseImpactFx | method | `_triggerDefenseImpactFx(kind, source = null, duration = 16, options = {})` |  |
| _triggerShieldAssimilationFx | method | `_triggerShieldAssimilationFx(source = null, duration = 22)` |  |
| _getDefenseImpactFx | method | `_getDefenseImpactFx(kind, duration = 16)` |  |
| _drawDefenseImpactFeedback | method | `_drawDefenseImpactFeedback(ctx, w, h, r)` | ⚠️ 巨型函数，见 @section 导航 |
| _drawShieldAssimilationFeedback | method | `_drawShieldAssimilationFeedback(ctx, w, h, r, perfLevel = 'high')` |  |
| _tickVisualFxTimers | method | `_tickVisualFxTimers(timeScale)` |  |
| _startJumpFx | method | `_startJumpFx(rows = 1, startY = this.dropTargetY, targetY = this.dropTargetY)` |  |
| _drawRelicMaterialFrame | method | `_drawRelicMaterialFrame(ctx, w, h, r, options = {})` |  |
| strokeFrame | function | `strokeFrame(dx, dy, width, height, radius)` |  |
| drawPlate | function | `drawPlate(x, y, width, height, radius = 2)` |  |
| drawRivet | function | `drawRivet(x, y, size = 2.1)` |  |
| drawCorner | function | `drawCorner(sx, sy)` |  |
| playBurnTickEffect | method | `playBurnTickEffect(game, dmg)` |  |
| playScanFeedback | method | `playScanFeedback()` |  |
| draw | method | `draw(ctx)` | ⚠️ 巨型函数，见 @section 导航 |
| addSwordMark | method | `addSwordMark(amount = 1)` |  |
| takeDamage | method | `takeDamage(amount, source = null, bypassShield = false)` | ⚠️ 巨型函数，见 @section 导航 |
| applyVenom | method | `applyVenom(stacks)` |  |
| applyTemp | method | `applyTemp(amount)` |  |
| getBounds | method | `getBounds()` |  |
| _drawFootprintCue | method | `_drawFootprintCue(ctx, w, h, r)` |  |
| _drawThreatTierBadge | method | `_drawThreatTierBadge(ctx, w, h)` |  |
| _drawBossVulnerabilityAssetOverlay | method | `_drawBossVulnerabilityAssetOverlay(ctx, w, h, stateId, ratio)` |  |
| _drawBossVulnerabilityOverlay | method | `_drawBossVulnerabilityOverlay(ctx, w, h)` | ⚠️ 巨型函数，见 @section 导航 |
| _drawOuroborosOrbitAttachments | method | `_drawOuroborosOrbitAttachments(ctx, w, h, radius, thickness, isBerserk = false)` |  |
| _drawRuneRewardFallback | method | `_drawRuneRewardFallback(ctx, w, h)` |  |
| _drawDefenseHudBadges | method | `_drawDefenseHudBadges(ctx, w, h)` |  |
| _drawStatusBadges | method | `_drawStatusBadges(ctx, w, h)` |  |
| _drawEliteDecoration | method | `_drawEliteDecoration(ctx, w, h)` |  |
| _drawBossSpriteOutsideCollisionClip | method | `_drawBossSpriteOutsideCollisionClip(ctx, w, h)` |  |
| _drawBossRainbowBorder | method | `_drawBossRainbowBorder(ctx, w, h)` |  |
| _drawBossDecoration | method | `_drawBossDecoration(ctx, w, h)` | ⚠️ 巨型函数，见 @section 导航 |
| _drawArchetypeBody | method | `_drawArchetypeBody(ctx, w, h)` | ⚠️ 巨型函数，见 @section 导航 |
| _getAffixTintColor | method | `_getAffixTintColor()` |  |
| _resolveMinionCollisionFrameAsset | method | `_resolveMinionCollisionFrameAsset()` |  |
| _syncCollisionFrameImage | method | `_syncCollisionFrameImage()` |  |
| _clipSpriteForHpWindows | method | `_clipSpriteForHpWindows(ctx, w, h)` |  |
| _drawHpReadabilityOverlay | method | `_drawHpReadabilityOverlay(ctx, w, h, hpRatio, whiteRatio, greenRatio, baseColor)` |  |
| _drawCollisionFrameBitmap | method | `_drawCollisionFrameBitmap(ctx, w, h)` |  |
| _syncAffixOverlayImages | method | `_syncAffixOverlayImages()` |  |
| _drawEnemyTargetingFallback | method | `_drawEnemyTargetingFallback(ctx, w, h)` | ⚠️ 巨型函数，见 @section 导航 |
| _drawAffixBitmapOverlays | method | `_drawAffixBitmapOverlays(ctx, w, h)` |  |
| _drawAffixSigil | method | `_drawAffixSigil(ctx, w, h)` |  |
| getAbsoluteVertices | method | `getAbsoluteVertices()` |  |
| doMove | function | `doMove()` |  |

## 巨型函数内部节点 (@section 标记)

### constructor

> **缺少 @section 标记**：此巨型函数内部没有节点标记，建议添加以提升导航精度。

### update

> **缺少 @section 标记**：此巨型函数内部没有节点标记，建议添加以提升导航精度。

### performTurnActionAndMove

> 定位：`grep -n '@section:节点名'` 跳转到对应节点

| 节点标记 | 说明 |
|----------|------|
| `@section:enemy_move_audio` | 敌人移动时的状态音效（regen/split/devour 词缀） |

### _drawDefenseImpactFeedback

> 定位：`grep -n '@section:节点名'` 跳转到对应节点

| 节点标记 | 说明 |
|----------|------|
| `@section:defense_fx_helpers` | 防御反馈绘制工具函数 |
| `@section:defense_fx_type_dispatch` | 各防御层样式分发 |

### draw

> 定位：`grep -n '@section:节点名'` 跳转到对应节点

| 节点标记 | 说明 |
|----------|------|
| `@section:draw_shadow_and_base` | 软阴影与敌人基础形体绘制 |
| `@section:draw_status_effects` | 状态效果视觉（冻结/灼烧/眩晕等） |
| `@section:draw_boss_aura` | Boss 专属光环与粒子特效 |
| `@section:draw_health_bar` | 血条与护盾条绘制 |
| `@section:draw_affix_icons` | 词缀图标与状态标记 |
| `@section:draw_boss_name_plate` | Boss 名牌与阶段指示器 |
| `@section:draw_attack_indicators` | 攻击预警指示器绘制 |
| `@section:draw_special_projectiles` | 特殊投射物与技能特效绘制 |
| `@section:draw_death_animation` | 死亡动画与消散特效 |

### takeDamage

> 定位：`grep -n '@section:节点名'` 跳转到对应节点

| 节点标记 | 说明 |
|----------|------|
| `@section:damage_element_reaction` | 属性反应触发（克制/共鸣/温度系统） |
| `@section:damage_apply_and_feedback` | 伤害应用、浮动文字与击退效果 |
| `@section:damage_death_trigger` | 死亡判断与掉落物触发 |

### _drawBossVulnerabilityOverlay

> 定位：`grep -n '@section:节点名'` 跳转到对应节点

| 节点标记 | 说明 |
|----------|------|
| `@section:boss_vuln_state_resolve` | 解析破绽状态与资产 |
| `@section:boss_vuln_draw_helpers` | 低成本弱点绘制工具 |
| `@section:boss_vuln_boss_shapes` | 各 Boss 弱点形态 |
| `@section:boss_vuln_break_burst` | 爆开残光绘制 |

### _drawBossDecoration

> 定位：`grep -n '@section:节点名'` 跳转到对应节点

| 节点标记 | 说明 |
|----------|------|
| `@section:boss_deco_crown_and_wings` | 皇冠/翅膀/触手等 Boss 专属装饰 |
| `@section:boss_deco_aura_rings` | 光环圆环动画绘制 |
| `@section:boss_deco_rune_symbols` | 符文符号与能量纹路绘制 |

### _drawArchetypeBody

> **缺少 @section 标记**：此巨型函数内部没有节点标记，建议添加以提升导航精度。

### _drawEnemyTargetingFallback

> 定位：`grep -n '@section:节点名'` 跳转到对应节点

| 节点标记 | 说明 |
|----------|------|
| `@section:targeting_fallback_border_frame` | border-only fallback art |


## 其他 @section 标记

| 节点标记 | 说明 |
|----------|------|
| `@section:enemy_telegraph_audio` | 敌人特殊动作预警蓄力音（低频 200Hz，区别于玩家蓄力 800Hz） |
| `@section:enemy_action_audio` | 敌人行动音效分发：regen/split/freeze 按词缀类型路由 |
| `@section:draw_entry_and_perf_check` | 绘制入口与性能等级检查 |
| `@section:damage_shield_check` | 护盾吸收与穿透判断 |
| `@section:targeting_fallback_setup` | 计算绘制参数 |
| `@section:boss_deco_phase_check` | Boss 阶段检查与装饰基础参数 |
