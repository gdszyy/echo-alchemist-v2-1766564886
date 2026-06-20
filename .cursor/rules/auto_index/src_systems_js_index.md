# src\systems.js 函数索引

> 自动生成于 2026-06-20 | 总行数: 3930 | 函数数: 50 | 语言: javascript
> **本文件由 code-indexer 脚本自动生成，严禁手动编辑。**

**巨型函数警告**: 本文件包含 2 个超过 200 行的函数，建议优先通过 `@section` 标记进行内部导航。

## 函数列表

> 定位方式：在源文件中 `grep -n "函数名"` 即可跳转，行号不在此列出（行号随代码变化而失效）。

| 函数名 | 类型 | 签名 | 备注 |
|--------|------|------|------|
| buildV2BestiaryEntries | function | `buildV2BestiaryEntries()` |  |
| constructor | method | `constructor()` |  |
| renderAttributeControls | method | `renderAttributeControls()` |  |
| updateBulletPreview | method | `updateBulletPreview()` |  |
| switchTab | method | `switchTab(tabName)` |  |
| updateSkillBar | method | `updateSkillBar(currentSP, activeSkills)` |  |
| updateSkillPoints | method | `updateSkillPoints(current, max = null)` |  |
| showEnemyInfo | method | `showEnemyInfo(enemy)` |  |
| addStatusItem | method | `addStatusItem(container, title, desc, colorClass)` |  |
| closeDrawer | method | `closeDrawer()` |  |
| buildV2MatrixScenarios | function | `buildV2MatrixScenarios()` |  |
| buildEnemyV2Scenarios | function | `buildEnemyV2Scenarios()` | ⚠️ 巨型函数，见 @section 导航 |
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

## 巨型函数内部节点 (@section 标记)

### buildEnemyV2Scenarios

> **缺少 @section 标记**：此巨型函数内部没有节点标记，建议添加以提升导航精度。

### initUI

> 定位：`grep -n '@section:节点名'` 跳转到对应节点

| 节点标记 | 说明 |
|----------|------|
| `@section:ui_event_binding` | 鼠标/触摸/键盘事件绑定 |
| `@section:ui_hud_components` | HUD 组件初始化（血条/弹药/符文槽） |
| `@section:ui_overlay_panels` | Overlay 面板初始化（商店/命运/设置） |


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
