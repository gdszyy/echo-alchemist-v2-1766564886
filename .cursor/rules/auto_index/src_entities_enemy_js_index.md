# src\entities\enemy.js 函数索引

> 自动生成于 2026-06-23 | 总行数: 10002 | 函数数: 143 | 语言: javascript
> **本文件由 code-indexer 脚本自动生成，严禁手动编辑。**

**巨型函数警告**: 本文件包含 9 个超过 200 行的函数，建议优先通过 `@section` 标记进行内部导航。

## 函数列表

> 定位方式：在源文件中 `grep -n "函数名"` 即可跳转，行号不在此列出（行号随代码变化而失效）。

| 函数名 | 类型 | 签名 | 备注 |
|--------|------|------|------|
| setEnemyAudioProvider | function | `setEnemyAudioProvider(provider)` |  |
| _getAffixOverlayImage | function | `_getAffixOverlayImage(src)` |  |
| _getEnemyFrameImage | function | `_getEnemyFrameImage(src)` |  |
| _measureImageAlphaBounds | function | `_measureImageAlphaBounds(img)` |  |
| _hexToRgba | function | `_hexToRgba(hex, alpha)` |  |
| _getBossHpThemePalette | function | `_getBossHpThemePalette(bossType)` |  |
| constructor | method | `constructor(x, y, width, height, hp, maxHp = hp, type = 'normal', affixes = [])` | ⚠️ 巨型函数，见 @section 导航 |
| initSprite | method | `initSprite()` |  |
| _initTexture | method | `_initTexture(width, height)` |  |
| update | method | `update(timeScale, game)` |  |
| addSwordCrack | method | `addSwordCrack(relPos, angle)` |  |
| updateTempParticles | method | `updateTempParticles(timeScale)` |  |
| advance | method | `advance(amount)` |  |
| _getDevourTargets | method | `_getDevourTargets(game, afx)` |  |
| _isMoveBlocked | method | `_isMoveBlocked(game, rows = 1)` |  |
| _getFootprintCells | method | `_getFootprintCells(game)` |  |
| _getDefenseBarrierDamage | method | `_getDefenseBarrierDamage(game)` |  |
| _areShieldsDisabledThisTurn | method | `_areShieldsDisabledThisTurn()` |  |
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
| _grantShieldLayer | method | `_grantShieldLayer(amount = 1)` |  |
| _grantRadiantAegisPulse | method | `_grantRadiantAegisPulse(game, amount = null, options = {})` |  |
| _consumeBossVulnerabilityExposedTurn | method | `_consumeBossVulnerabilityExposedTurn(game)` |  |
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
| _getChimeraConfig | method | `_getChimeraConfig()` |  |
| _isChimeraBoss | method | `_isChimeraBoss()` |  |
| _isChimeraFeed | method | `_isChimeraFeed()` |  |
| _getChimeraGridMetrics | method | `_getChimeraGridMetrics(game)` |  |
| _getChimeraGridCol | method | `_getChimeraGridCol(game, x, metrics = null)` |  |
| _getChimeraGridRow | method | `_getChimeraGridRow(y, metrics)` |  |
| _getChimeraPrey | method | `_getChimeraPrey(game)` |  |
| _findChimeraPullCell | method | `_findChimeraPullCell(game, target)` |  |
| _chimeraAttractPrey | method | `_chimeraAttractPrey(game)` |  |
| _chimeraAbsorbNegativeStates | method | `_chimeraAbsorbNegativeStates(victim)` |  |
| _chimeraDevourTargets | method | `_chimeraDevourTargets(game, options = {})` |  |
| _getChimeraFeeders | method | `_getChimeraFeeders(game)` |  |
| _findChimeraFeederSpawnPositions | method | `_findChimeraFeederSpawnPositions(game, count)` |  |
| _chimeraSpawnFeeders | method | `_chimeraSpawnFeeders(game, count = 1)` |  |
| _tickChimeraMawField | method | `_tickChimeraMawField(game)` |  |
| _ensureDevourerBodyCollisionShape | method | `_ensureDevourerBodyCollisionShape()` |  |
| _tickBossPhysicsForTurn | method | `_tickBossPhysicsForTurn()` |  |
| _tickBossMechanicsForTurn | method | `_tickBossMechanicsForTurn(game)` |  |
| startTurnAction | method | `startTurnAction(game)` |  |
| executeTurnAction | method | `executeTurnAction(game)` | ⚠️ 巨型函数，见 @section 导航 |
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
| _tickOuroborosOrbit | method | `_tickOuroborosOrbit(game)` |  |
| _interruptOuroborosAttachment | method | `_interruptOuroborosAttachment(gameRef = null, matchedAttr = null)` |  |
| _performOuroborosRotation | method | `_performOuroborosRotation(game)` |  |
| _glaciesPulseFrostSeamsOnLanding | method | `_glaciesPulseFrostSeamsOnLanding(game)` |  |
| playFreezeBlockEffect | method | `playFreezeBlockEffect(game)` |  |
| triggerLaserHitShake | method | `triggerLaserHitShake()` |  |
| _tickVisualFxTimers | method | `_tickVisualFxTimers(timeScale)` |  |
| _startJumpFx | method | `_startJumpFx(rows = 1, startY = this.dropTargetY, targetY = this.dropTargetY)` |  |
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
| _drawStatusBadges | method | `_drawStatusBadges(ctx, w, h)` |  |
| _drawEliteDecoration | method | `_drawEliteDecoration(ctx, w, h)` |  |
| _drawBossSpriteOutsideCollisionClip | method | `_drawBossSpriteOutsideCollisionClip(ctx, w, h)` |  |
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

### executeTurnAction

> 定位：`grep -n '@section:节点名'` 跳转到对应节点

| 节点标记 | 说明 |
|----------|------|
| `@section:enemy_action_audio` | 敌人行动音效分发：regen/split/freeze 按词缀类型路由 |

### performTurnActionAndMove

> 定位：`grep -n '@section:节点名'` 跳转到对应节点

| 节点标记 | 说明 |
|----------|------|
| `@section:enemy_move_audio` | 敌人移动时的状态音效（regen/split/devour 词缀） |

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
| `@section:draw_entry_and_perf_check` | 绘制入口与性能等级检查 |
| `@section:damage_shield_check` | 护盾吸收与穿透判断 |
| `@section:targeting_fallback_setup` | 计算绘制参数 |
| `@section:boss_deco_phase_check` | Boss 阶段检查与装饰基础参数 |
