# src/systems.js 函数索引

> 自动生成于 2026-04-22 | 总行数: 2810 | 函数数: 85 | 语言: javascript
> **本文件由 code-indexer 脚本自动生成，严禁手动编辑。**

**巨型函数警告**: 本文件包含 2 个超过 200 行的函数，建议优先通过 `@section` 标记进行内部导航。

## 函数列表

| 函数名 | 类型 | 起始行 | 结束行 | 行数 | 签名 |
|--------|------|--------|--------|------|------|
| UIManager | class | L400 | L400 | 1 | `UIManager()` |
| constructor | method | L401 | L444 | 44 | `constructor()` |
| renderAttributeControls | method | L445 | L467 | 23 | `renderAttributeControls()` |
| updateBulletPreview | method | L468 | L486 | 19 | `updateBulletPreview()` |
| switchTab | method | L487 | L509 | 23 | `switchTab(tabName)` |
| updateSkillBar | method | L510 | L547 | 38 | `updateSkillBar(currentSP, activeSkills)` |
| updateSkillPoints | method | L548 | L567 | 20 | `updateSkillPoints(current, max = null)` |
| showEnemyInfo | method | L568 | L646 | 79 | `showEnemyInfo(enemy)` |
| addStatusItem | method | L647 | L654 | 8 | `addStatusItem(container, title, desc, colorClass)` |
| closeDrawer | method | L655 | L1493 | **839** | `closeDrawer()` |
| TrainingGround | class | L1494 | L1494 | 1 | `TrainingGround()` |
| constructor | method | L1495 | L1519 | 25 | `constructor(game)` |
| initUI | method | L1520 | L1873 | **354** | `initUI()` |
| clearEnemies | method | L1874 | L1879 | 6 | `clearEnemies()` |
| adjustBullet | method | L1880 | L1893 | 14 | `adjustBullet(key, delta)` |
| renderAttributeControls | method | L1894 | L1919 | 26 | `renderAttributeControls()` |
| updateBulletPreview | method | L1920 | L1943 | 24 | `updateBulletPreview()` |
| initSidebar | method | L1944 | L1976 | 33 | `initSidebar()` |
| switchCategory | method | L1977 | L1987 | 11 | `switchCategory(categoryId)` |
| renderScenarioList | method | L1988 | L2005 | 18 | `renderScenarioList()` |
| loadScenario | method | L2006 | L2151 | 146 | `loadScenario(scenarioId)` |
| triggerScenarioAction | method | L2152 | L2170 | 19 | `triggerScenarioAction()` |
| resetCurrentScenario | method | L2171 | L2181 | 11 | `resetCurrentScenario()` |
| toggleSidebar | method | L2182 | L2192 | 11 | `toggleSidebar()` |
| collapseSidebar | method | L2193 | L2203 | 11 | `collapseSidebar()` |
| _clearBattlefield | method | L2204 | L2223 | 20 | `_clearBattlefield()` |
| spawnEnemy | method | L2224 | L2233 | 10 | `spawnEnemy()` |
| fireBullet | method | L2234 | L2255 | 22 | `fireBullet()` |
| fireBulletWithEffects | method | L2256 | L2270 | 15 | `fireBulletWithEffects(recipe)` |
| resetBullet | method | L2271 | L2280 | 10 | `resetBullet()` |
| update | method | L2281 | L2298 | 18 | `update()` |
| enter | method | L2299 | L2333 | 35 | `enter()` |
| exit | method | L2334 | L2344 | 11 | `exit()` |
| toggleMainPanel | method | L2345 | L2356 | 12 | `toggleMainPanel()` |
| switchTab | method | L2357 | L2367 | 11 | `switchTab(tab)` |
| TruthBook | class | L2368 | L2368 | 1 | `TruthBook()` |
| constructor | method | L2369 | L2384 | 16 | `constructor(mainGame)` |
| initUI | method | L2385 | L2399 | 15 | `initUI()` |
| createListButton | method | L2400 | L2413 | 14 | `createListButton(entry)` |
| showEntry | method | L2414 | L2446 | 33 | `showEntry(entry, btnElement)` |
| resetDemo | method | L2447 | L2448 | 2 | `resetDemo()` |
| startDemo | method | L2449 | L2465 | 17 | `startDemo(entry)` |
| resize | method | L2466 | L2479 | 14 | `resize()` |
| update | method | L2480 | L2544 | 65 | `update()` |
| executeInstruction | method | L2545 | L2579 | 35 | `executeInstruction(inst)` |
| addLog | method | L2580 | L2590 | 11 | `addLog(text, colorClass = 'text-cyan-400')` |
| draw | method | L2591 | L2641 | 51 | `draw()` |
| createCombatContext | function | L2642 | L2706 | 65 | `createCombatContext(mainGame, canvas)` |
| triggerScreenShake | method | L2707 | L2709 | 3 | `triggerScreenShake(amount)` |
| ui_triggerScreenShake | method | L2710 | L2710 | 1 | `ui_triggerScreenShake()` |
| spawn_createParticle | method | L2711 | L2713 | 3 | `spawn_createParticle(...args)` |
| spawn_pushParticleWithLimit | method | L2714 | L2716 | 3 | `spawn_pushParticleWithLimit(...args)` |
| spawn_createShockwave | method | L2717 | L2719 | 3 | `spawn_createShockwave(...args)` |
| spawn_createFloatingText | method | L2720 | L2722 | 3 | `spawn_createFloatingText(...args)` |
| spawn_createExplosion | method | L2723 | L2725 | 3 | `spawn_createExplosion(...args)` |
| spawn_smallWhirlwind | method | L2726 | L2728 | 3 | `spawn_smallWhirlwind(...args)` |
| spawn_createHealWave | method | L2729 | L2731 | 3 | `spawn_createHealWave(...args)` |
| spawn_createFireWave | method | L2732 | L2734 | 3 | `spawn_createFireWave(...args)` |
| spawn_createHitFeedback | method | L2735 | L2735 | 1 | `spawn_createHitFeedback()` |
| spawn_spawnBullet | method | L2736 | L2738 | 3 | `spawn_spawnBullet(...args)` |
| spawn_triggerCloneSpawn | method | L2739 | L2741 | 3 | `spawn_triggerCloneSpawn(...args)` |
| spawn_stormCore | method | L2742 | L2744 | 3 | `spawn_stormCore(...args)` |
| combat_wind_updateStormCores | method | L2745 | L2747 | 3 | `combat_wind_updateStormCores(...args)` |
| combat_wind_drawStormCores | method | L2748 | L2750 | 3 | `combat_wind_drawStormCores(...args)` |
| combat_damageEnemy | method | L2751 | L2753 | 3 | `combat_damageEnemy(...args)` |
| combat_lightning_triggerChain | method | L2754 | L2756 | 3 | `combat_lightning_triggerChain(...args)` |
| combat_wind_addAnchor | method | L2757 | L2759 | 3 | `combat_wind_addAnchor(...args)` |
| combat_wind_triggerSmallWhirlwindDamage | method | L2760 | L2762 | 3 | `combat_wind_triggerSmallWhirlwindDamage(...args)` |
| combat_wind_triggerMagicCircle | method | L2763 | L2765 | 3 | `combat_wind_triggerMagicCircle(...args)` |
| combat_wind_triggerButterflyCircle | method | L2766 | L2768 | 3 | `combat_wind_triggerButterflyCircle(...args)` |
| combat_wind_updateButterflyCircles | method | L2769 | L2771 | 3 | `combat_wind_updateButterflyCircles(...args)` |
| combat_wind_updateButterflyBlades | method | L2772 | L2774 | 3 | `combat_wind_updateButterflyBlades(...args)` |
| combat_flyingSword_assignTarget | method | L2775 | L2777 | 3 | `combat_flyingSword_assignTarget(...args)` |
| combat_flyingSword_addSon | method | L2778 | L2780 | 3 | `combat_flyingSword_addSon(...args)` |
| combat_laser_fire | method | L2781 | L2783 | 3 | `combat_laser_fire(...args)` |
| combat_recordDamage | method | L2784 | L2786 | 3 | `combat_recordDamage(...args)` |
| combat_reportDamage | method | L2787 | L2789 | 3 | `combat_reportDamage(...args)` |
| combat_runeCharge_onHit | method | L2790 | L2792 | 3 | `combat_runeCharge_onHit(...args)` |
| combat_checkBossPhaseChange | method | L2793 | L2795 | 3 | `combat_checkBossPhaseChange(...args)` |
| combat_tryMoveEnemy | method | L2796 | L2798 | 3 | `combat_tryMoveEnemy(...args)` |
| calc_isAreaOccupied | method | L2799 | L2801 | 3 | `calc_isAreaOccupied(...args)` |
| spawn_addScore | method | L2802 | L2802 | 1 | `spawn_addScore()` |
| combat_runeCharge_init | method | L2803 | L2803 | 1 | `combat_runeCharge_init()` |
| combat_runeCharge_update | method | L2804 | L2804 | 1 | `combat_runeCharge_update()` |
| combat_runeCharge_draw | method | L2805 | L2811 | 7 | `combat_runeCharge_draw()` |

## 巨型函数内部节点 (@section 标记)

### closeDrawer (L655-L1493, 839行)

| 节点标记 | 行号 | 说明 |
|----------|------|------|
| `@section:drawer_rune_grid_finalize` | L751 | 符文网格最终化与合成判断 |
| `@section:drawer_reward_calc` | L902 | 奖励计算：属性汇总与等级提升 |
| `@section:drawer_session_commit` | L1053 | 会话数据提交与存档写入 |
| `@section:drawer_ui_transition` | L1204 | UI 过渡动画与阶段切换触发 |
| `@section:drawer_event_emit` | L1355 | 事件总线通知与后续流程触发 |

### initUI (L1520-L1873, 354行)

| 节点标记 | 行号 | 说明 |
|----------|------|------|
| `@section:ui_event_binding` | L1587 | 鼠标/触摸/键盘事件绑定 |
| `@section:ui_hud_components` | L1688 | HUD 组件初始化（血条/弹药/符文槽） |
| `@section:ui_overlay_panels` | L1789 | Overlay 面板初始化（商店/命运/设置） |

## 其他 @section 标记

| 节点标记 | 行号 | 说明 |
|----------|------|------|
| `@section:drawer_state_save` | L654 | 关闭前状态保存与动画准备 |
| `@section:ui_canvas_setup` | L1519 | Canvas 尺寸与 DPI 初始化 |
