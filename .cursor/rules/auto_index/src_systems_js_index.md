# src\systems.js 函数索引

> 自动生成于 2026-06-24 | 总行数: 5282 | 函数数: 72 | 语言: javascript
> **本文件由 code-indexer 脚本自动生成，严禁手动编辑。**

**巨型函数警告**: 本文件包含 3 个超过 200 行的函数，建议优先通过 `@section` 标记进行内部导航。

## 函数列表

> 定位方式：在源文件中 `grep -n "函数名"` 即可跳转，行号不在此列出（行号随代码变化而失效）。

| 函数名 | 类型 | 签名 | 备注 |
|--------|------|------|------|
| buildV2BestiaryEntries | function | `buildV2BestiaryEntries()` |  |
| setupTruthBookBossDemo | function | `setupTruthBookBossDemo(game, bossId, isBigBoss = false)` |  |
| normalizeTruthBookEntry | function | `normalizeTruthBookEntry(entry, categoryId)` |  |
| buildTruthBookEntries | function | `buildTruthBookEntries()` |  |
| constructor | method | `constructor()` |  |
| renderAttributeControls | method | `renderAttributeControls()` |  |
| updateBulletPreview | method | `updateBulletPreview()` |  |
| switchTab | method | `switchTab(tabName)` |  |
| updateSkillBar | method | `updateSkillBar(currentSP, activeSkills)` |  |
| updateSkillPoints | method | `updateSkillPoints(current, max = null)` |  |
| showEnemyInfo | method | `showEnemyInfo(enemy)` |  |
| addStatusItem | method | `addStatusItem(container, title, desc, colorClass)` |  |
| closeDrawer | method | `closeDrawer()` |  |
| resolveBossVulnerabilityAttrs | function | `resolveBossVulnerabilityAttrs(bossId, rotationIndex = 0)` |  |
| setupBossVulnerabilityVisualState | function | `setupBossVulnerabilityVisualState(boss, bossId, state, rotationIndex = 0)` |  |
| getOuroborosOrbitAttachmentSlots | function | `getOuroborosOrbitAttachmentSlots()` |  |
| clearOuroborosOrbitEchoes | function | `clearOuroborosOrbitEchoes(game)` |  |
| setupOuroborosAttachmentSlotAcceptance | function | `setupOuroborosAttachmentSlotAcceptance(game, slotIndex = 0)` |  |
| advanceOuroborosAttachmentSlotAcceptance | function | `advanceOuroborosAttachmentSlotAcceptance(game)` |  |
| buildV2MatrixScenarios | function | `buildV2MatrixScenarios()` |  |
| buildEnemyV2Scenarios | function | `buildEnemyV2Scenarios()` | ⚠️ 巨型函数，见 @section 导航 |
| constructor | method | `constructor(game)` |  |
| initUI | method | `initUI()` | ⚠️ 巨型函数，见 @section 导航 |
| clearEnemies | method | `clearEnemies()` |  |
| setBullet | method | `setBullet(key, rawVal, opts = {})` |  |
| adjustBullet | method | `adjustBullet(key, delta)` |  |
| renderAttributeControls | method | `renderAttributeControls()` |  |
| renderEnemyControls | method | `renderEnemyControls()` |  |
| setEnemyBase | method | `setEnemyBase(id)` |  |
| setEnemyHp | method | `setEnemyHp(rawVal)` |  |
| adjustEnemyHp | method | `adjustEnemyHp(delta)` |  |
| toggleEnemyAffix | method | `toggleEnemyAffix(id)` |  |
| clearEnemyAffixes | method | `clearEnemyAffixes()` |  |
| _initCustomEnemyAffixes | method | `_initCustomEnemyAffixes(e, hp)` |  |
| spawnCustomEnemy | method | `spawnCustomEnemy()` |  |
| updateBulletPreview | method | `updateBulletPreview()` |  |
| initSidebar | method | `initSidebar()` |  |
| switchCategory | method | `switchCategory(categoryId)` |  |
| renderScenarioList | method | `renderScenarioList()` |  |
| loadScenario | method | `loadScenario(scenarioId)` |  |
| triggerScenarioAction | method | `triggerScenarioAction()` |  |
| resetCurrentScenario | method | `resetCurrentScenario()` |  |
| toggleSidebar | method | `toggleSidebar()` |  |
| collapseSidebar | method | `collapseSidebar()` |  |
| _clearV2MatrixOverlay | method | `_clearV2MatrixOverlay()` |  |
| _renderV2MatrixLabels | method | `_renderV2MatrixLabels(labelData)` |  |
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
| constructor | method | `constructor(mainGame)` |  |
| initUI | method | `initUI()` |  |
| getEntries | method | `getEntries()` |  |
| getCategories | method | `getCategories()` |  |
| renderCategoryTabs | method | `renderCategoryTabs()` |  |
| renderEntryList | method | `renderEntryList()` |  |
| createListButton | method | `createListButton(entry)` |  |
| showEntry | method | `showEntry(entry, btnElement)` |  |
| resetDemo | method | `resetDemo()` |  |
| startDemo | method | `startDemo(entry)` |  |
| resize | method | `resize()` |  |
| update | method | `update()` |  |
| executeInstruction | method | `executeInstruction(inst)` |  |
| addLog | method | `addLog(text, colorClass = 'text-cyan-400')` |  |
| draw | method | `draw()` |  |
| createCombatContext | function | `createCombatContext(mainGame, canvas)` | ⚠️ 巨型函数，见 @section 导航 |

## 巨型函数内部节点 (@section 标记)

### buildEnemyV2Scenarios

> 定位：`grep -n '@section:节点名'` 跳转到对应节点

| 节点标记 | 说明 |
|----------|------|
| `@section:enemy_v2_asset_status` | 资源命中状态文本 |
| `@section:enemy_v2_targeting_fallback` | 敌人针对兜底验收 |
| `@section:enemy_v2_targeting_footprints` | 多尺寸 targeting overlay 验收 |
| `@section:enemy_v2_scene_list` | 验收场景列表 |

### initUI

> 定位：`grep -n '@section:节点名'` 跳转到对应节点

| 节点标记 | 说明 |
|----------|------|
| `@section:ui_event_binding` | 鼠标/触摸/键盘事件绑定 |
| `@section:ui_hud_components` | HUD 组件初始化（血条/弹药/符文槽） |
| `@section:ui_overlay_panels` | Overlay 面板初始化（商店/命运/设置） |

### createCombatContext

> 定位：`grep -n '@section:节点名'` 跳转到对应节点

| 节点标记 | 说明 |
|----------|------|
| `@section:demo_state_seed` | 演示状态初始化 |
| `@section:demo_spawn_bridge` | 生成与Boss转发 |
| `@section:demo_combat_bridge` | 战斗逻辑转发 |
| `@section:demo_charge_bridge` | 充能兼容转发 |


## 其他 @section 标记

| 节点标记 | 说明 |
|----------|------|
| `@section:drawer_state_save` | 关闭前状态保存与动画准备 |
| `@section:drawer_rune_grid_finalize` | 符文网格最终化与合成判断 |
| `@section:drawer_reward_calc` | 奖励计算：属性汇总与等级提升 |
| `@section:drawer_session_commit` | 会话数据提交与存档写入 |
| `@section:drawer_ui_transition` | UI 过渡动画与阶段切换触发 |
| `@section:drawer_event_emit` | 事件总线通知与后续流程触发 |
| `@section:ui_canvas_setup` | Canvas 尺寸与 DPI 初始化 |
