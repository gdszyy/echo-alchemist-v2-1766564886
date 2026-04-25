# src/systems.js 函数索引

> 自动生成于 2026-04-24 | 总行数: 2810 | 函数数: 85 | 语言: javascript
> **本文件由 code-indexer 脚本自动生成，严禁手动编辑。**

**巨型函数警告**: 本文件包含 2 个超过 200 行的函数，建议优先通过 `@section` 标记进行内部导航。

## 函数列表

> 定位方式：在源文件中 `grep -n "函数名"` 即可跳转，行号不在此列出（行号随代码变化而失效）。

| 函数名 | 类型 | 签名 | 备注 |
|--------|------|------|------|
| UIManager | class | `UIManager()` |  |
| constructor | method | `constructor()` |  |
| renderAttributeControls | method | `renderAttributeControls()` |  |
| updateBulletPreview | method | `updateBulletPreview()` |  |
| switchTab | method | `switchTab(tabName)` |  |
| updateSkillBar | method | `updateSkillBar(currentSP, activeSkills)` |  |
| updateSkillPoints | method | `updateSkillPoints(current, max = null)` |  |
| showEnemyInfo | method | `showEnemyInfo(enemy)` |  |
| addStatusItem | method | `addStatusItem(container, title, desc, colorClass)` |  |
| closeDrawer | method | `closeDrawer()` | ⚠️ 巨型函数，见 @section 导航 |
| TrainingGround | class | `TrainingGround()` |  |
| constructor | method | `constructor(game)` |  |
| initUI | method | `initUI()` | ⚠️ 巨型函数，见 @section 导航 |
| clearEnemies | method | `clearEnemies()` |  |
| adjustBullet | method | `adjustBullet(key, delta)` |  |
| renderAttributeControls | method | `renderAttributeControls()` |  |
| updateBulletPreview | method | `updateBulletPreview()` |  |
| initSidebar | method | `initSidebar()` |  |
| switchCategory | method | `switchCategory(categoryId)` |  |
| renderScenarioList | method | `renderScenarioList()` |  |
| loadScenario | method | `loadScenario(scenarioId)` |  |
| triggerScenarioAction | method | `triggerScenarioAction()` |  |
| resetCurrentScenario | method | `resetCurrentScenario()` |  |
| toggleSidebar | method | `toggleSidebar()` |  |
| collapseSidebar | method | `collapseSidebar()` |  |
| _clearBattlefield | method | `_clearBattlefield()` |  |
| spawnEnemy | method | `spawnEnemy()` |  |
| fireBullet | method | `fireBullet()` |  |
| fireBulletWithEffects | method | `fireBulletWithEffects(recipe)` |  |
| resetBullet | method | `resetBullet()` |  |
| update | method | `update()` |  |
| enter | method | `enter()` |  |
| exit | method | `exit()` |  |
| toggleMainPanel | method | `toggleMainPanel()` |  |
| switchTab | method | `switchTab(tab)` |  |
| TruthBook | class | `TruthBook()` |  |
| constructor | method | `constructor(mainGame)` |  |
| initUI | method | `initUI()` |  |
| createListButton | method | `createListButton(entry)` |  |
| showEntry | method | `showEntry(entry, btnElement)` |  |
| resetDemo | method | `resetDemo()` |  |
| startDemo | method | `startDemo(entry)` |  |
| resize | method | `resize()` |  |
| update | method | `update()` |  |
| executeInstruction | method | `executeInstruction(inst)` |  |
| addLog | method | `addLog(text, colorClass = 'text-cyan-400')` |  |
| draw | method | `draw()` |  |
| createCombatContext | function | `createCombatContext(mainGame, canvas)` |  |
| triggerScreenShake | method | `triggerScreenShake(amount)` |  |
| ui_triggerScreenShake | method | `ui_triggerScreenShake()` |  |
| spawn_createParticle | method | `spawn_createParticle(...args)` |  |
| spawn_pushParticleWithLimit | method | `spawn_pushParticleWithLimit(...args)` |  |
| spawn_createShockwave | method | `spawn_createShockwave(...args)` |  |
| spawn_createFloatingText | method | `spawn_createFloatingText(...args)` |  |
| spawn_createExplosion | method | `spawn_createExplosion(...args)` |  |
| spawn_smallWhirlwind | method | `spawn_smallWhirlwind(...args)` |  |
| spawn_createHealWave | method | `spawn_createHealWave(...args)` |  |
| spawn_createFireWave | method | `spawn_createFireWave(...args)` |  |
| spawn_createHitFeedback | method | `spawn_createHitFeedback()` |  |
| spawn_spawnBullet | method | `spawn_spawnBullet(...args)` |  |
| spawn_triggerCloneSpawn | method | `spawn_triggerCloneSpawn(...args)` |  |
| spawn_stormCore | method | `spawn_stormCore(...args)` |  |
| combat_wind_updateStormCores | method | `combat_wind_updateStormCores(...args)` |  |
| combat_wind_drawStormCores | method | `combat_wind_drawStormCores(...args)` |  |
| combat_damageEnemy | method | `combat_damageEnemy(...args)` |  |
| combat_lightning_triggerChain | method | `combat_lightning_triggerChain(...args)` |  |
| combat_wind_addAnchor | method | `combat_wind_addAnchor(...args)` |  |
| combat_wind_triggerSmallWhirlwindDamage | method | `combat_wind_triggerSmallWhirlwindDamage(...args)` |  |
| combat_wind_triggerMagicCircle | method | `combat_wind_triggerMagicCircle(...args)` |  |
| combat_wind_triggerButterflyCircle | method | `combat_wind_triggerButterflyCircle(...args)` |  |
| combat_wind_updateButterflyCircles | method | `combat_wind_updateButterflyCircles(...args)` |  |
| combat_wind_updateButterflyBlades | method | `combat_wind_updateButterflyBlades(...args)` |  |
| combat_flyingSword_assignTarget | method | `combat_flyingSword_assignTarget(...args)` |  |
| combat_flyingSword_addSon | method | `combat_flyingSword_addSon(...args)` |  |
| combat_laser_fire | method | `combat_laser_fire(...args)` |  |
| combat_recordDamage | method | `combat_recordDamage(...args)` |  |
| combat_reportDamage | method | `combat_reportDamage(...args)` |  |
| combat_runeCharge_onHit | method | `combat_runeCharge_onHit(...args)` |  |
| combat_checkBossPhaseChange | method | `combat_checkBossPhaseChange(...args)` |  |
| combat_tryMoveEnemy | method | `combat_tryMoveEnemy(...args)` |  |
| calc_isAreaOccupied | method | `calc_isAreaOccupied(...args)` |  |
| spawn_addScore | method | `spawn_addScore()` |  |
| combat_runeCharge_init | method | `combat_runeCharge_init()` |  |
| combat_runeCharge_update | method | `combat_runeCharge_update()` |  |
| combat_runeCharge_draw | method | `combat_runeCharge_draw()` |  |

## 巨型函数内部节点 (@section 标记)

### closeDrawer

> 定位：`grep -n '@section:{}'` 跳转到对应节点

| 节点标记 | 说明 |
|----------|------|
| `@section:drawer_rune_grid_finalize` | 符文网格最终化与合成判断 |
| `@section:drawer_reward_calc` | 奖励计算：属性汇总与等级提升 |
| `@section:drawer_session_commit` | 会话数据提交与存档写入 |
| `@section:drawer_ui_transition` | UI 过渡动画与阶段切换触发 |
| `@section:drawer_event_emit` | 事件总线通知与后续流程触发 |

### initUI

> 定位：`grep -n '@section:{}'` 跳转到对应节点

| 节点标记 | 说明 |
|----------|------|
| `@section:ui_event_binding` | 鼠标/触摸/键盘事件绑定 |
| `@section:ui_hud_components` | HUD 组件初始化（血条/弹药/符文槽） |
| `@section:ui_overlay_panels` | Overlay 面板初始化（商店/命运/设置） |

## 其他 @section 标记

| 节点标记 | 说明 |
|----------|------|
| `@section:drawer_state_save` | 关闭前状态保存与动画准备 |
| `@section:ui_canvas_setup` | Canvas 尺寸与 DPI 初始化 |
