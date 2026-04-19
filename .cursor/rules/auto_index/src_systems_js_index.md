# src/systems.js 函数索引

> 自动生成于 2026-04-19 | 总行数: 2800 | 函数数: 85 | 语言: javascript
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
| addStatusItem | method | L647 | L653 | 7 | `addStatusItem(container, title, desc, colorClass)` |
| closeDrawer | method | L654 | L1487 | **834** | `closeDrawer()` |
| TrainingGround | class | L1488 | L1488 | 1 | `TrainingGround()` |
| constructor | method | L1489 | L1512 | 24 | `constructor(game)` |
| initUI | method | L1513 | L1863 | **351** | `initUI()` |
| clearEnemies | method | L1864 | L1869 | 6 | `clearEnemies()` |
| adjustBullet | method | L1870 | L1883 | 14 | `adjustBullet(key, delta)` |
| renderAttributeControls | method | L1884 | L1909 | 26 | `renderAttributeControls()` |
| updateBulletPreview | method | L1910 | L1933 | 24 | `updateBulletPreview()` |
| initSidebar | method | L1934 | L1966 | 33 | `initSidebar()` |
| switchCategory | method | L1967 | L1977 | 11 | `switchCategory(categoryId)` |
| renderScenarioList | method | L1978 | L1995 | 18 | `renderScenarioList()` |
| loadScenario | method | L1996 | L2141 | 146 | `loadScenario(scenarioId)` |
| triggerScenarioAction | method | L2142 | L2160 | 19 | `triggerScenarioAction()` |
| resetCurrentScenario | method | L2161 | L2171 | 11 | `resetCurrentScenario()` |
| toggleSidebar | method | L2172 | L2182 | 11 | `toggleSidebar()` |
| collapseSidebar | method | L2183 | L2193 | 11 | `collapseSidebar()` |
| _clearBattlefield | method | L2194 | L2213 | 20 | `_clearBattlefield()` |
| spawnEnemy | method | L2214 | L2223 | 10 | `spawnEnemy()` |
| fireBullet | method | L2224 | L2245 | 22 | `fireBullet()` |
| fireBulletWithEffects | method | L2246 | L2260 | 15 | `fireBulletWithEffects(recipe)` |
| resetBullet | method | L2261 | L2270 | 10 | `resetBullet()` |
| update | method | L2271 | L2288 | 18 | `update()` |
| enter | method | L2289 | L2323 | 35 | `enter()` |
| exit | method | L2324 | L2334 | 11 | `exit()` |
| toggleMainPanel | method | L2335 | L2346 | 12 | `toggleMainPanel()` |
| switchTab | method | L2347 | L2357 | 11 | `switchTab(tab)` |
| TruthBook | class | L2358 | L2358 | 1 | `TruthBook()` |
| constructor | method | L2359 | L2374 | 16 | `constructor(mainGame)` |
| initUI | method | L2375 | L2389 | 15 | `initUI()` |
| createListButton | method | L2390 | L2403 | 14 | `createListButton(entry)` |
| showEntry | method | L2404 | L2436 | 33 | `showEntry(entry, btnElement)` |
| resetDemo | method | L2437 | L2438 | 2 | `resetDemo()` |
| startDemo | method | L2439 | L2455 | 17 | `startDemo(entry)` |
| resize | method | L2456 | L2469 | 14 | `resize()` |
| update | method | L2470 | L2534 | 65 | `update()` |
| executeInstruction | method | L2535 | L2569 | 35 | `executeInstruction(inst)` |
| addLog | method | L2570 | L2580 | 11 | `addLog(text, colorClass = 'text-cyan-400')` |
| draw | method | L2581 | L2631 | 51 | `draw()` |
| createCombatContext | function | L2632 | L2696 | 65 | `createCombatContext(mainGame, canvas)` |
| triggerScreenShake | method | L2697 | L2699 | 3 | `triggerScreenShake(amount)` |
| ui_triggerScreenShake | method | L2700 | L2700 | 1 | `ui_triggerScreenShake()` |
| spawn_createParticle | method | L2701 | L2703 | 3 | `spawn_createParticle(...args)` |
| spawn_pushParticleWithLimit | method | L2704 | L2706 | 3 | `spawn_pushParticleWithLimit(...args)` |
| spawn_createShockwave | method | L2707 | L2709 | 3 | `spawn_createShockwave(...args)` |
| spawn_createFloatingText | method | L2710 | L2712 | 3 | `spawn_createFloatingText(...args)` |
| spawn_createExplosion | method | L2713 | L2715 | 3 | `spawn_createExplosion(...args)` |
| spawn_smallWhirlwind | method | L2716 | L2718 | 3 | `spawn_smallWhirlwind(...args)` |
| spawn_createHealWave | method | L2719 | L2721 | 3 | `spawn_createHealWave(...args)` |
| spawn_createFireWave | method | L2722 | L2724 | 3 | `spawn_createFireWave(...args)` |
| spawn_createHitFeedback | method | L2725 | L2725 | 1 | `spawn_createHitFeedback()` |
| spawn_spawnBullet | method | L2726 | L2728 | 3 | `spawn_spawnBullet(...args)` |
| spawn_triggerCloneSpawn | method | L2729 | L2731 | 3 | `spawn_triggerCloneSpawn(...args)` |
| spawn_stormCore | method | L2732 | L2734 | 3 | `spawn_stormCore(...args)` |
| combat_wind_updateStormCores | method | L2735 | L2737 | 3 | `combat_wind_updateStormCores(...args)` |
| combat_wind_drawStormCores | method | L2738 | L2740 | 3 | `combat_wind_drawStormCores(...args)` |
| combat_damageEnemy | method | L2741 | L2743 | 3 | `combat_damageEnemy(...args)` |
| combat_lightning_triggerChain | method | L2744 | L2746 | 3 | `combat_lightning_triggerChain(...args)` |
| combat_wind_addAnchor | method | L2747 | L2749 | 3 | `combat_wind_addAnchor(...args)` |
| combat_wind_triggerSmallWhirlwindDamage | method | L2750 | L2752 | 3 | `combat_wind_triggerSmallWhirlwindDamage(...args)` |
| combat_wind_triggerMagicCircle | method | L2753 | L2755 | 3 | `combat_wind_triggerMagicCircle(...args)` |
| combat_wind_triggerButterflyCircle | method | L2756 | L2758 | 3 | `combat_wind_triggerButterflyCircle(...args)` |
| combat_wind_updateButterflyCircles | method | L2759 | L2761 | 3 | `combat_wind_updateButterflyCircles(...args)` |
| combat_wind_updateButterflyBlades | method | L2762 | L2764 | 3 | `combat_wind_updateButterflyBlades(...args)` |
| combat_flyingSword_assignTarget | method | L2765 | L2767 | 3 | `combat_flyingSword_assignTarget(...args)` |
| combat_flyingSword_addSon | method | L2768 | L2770 | 3 | `combat_flyingSword_addSon(...args)` |
| combat_laser_fire | method | L2771 | L2773 | 3 | `combat_laser_fire(...args)` |
| combat_recordDamage | method | L2774 | L2776 | 3 | `combat_recordDamage(...args)` |
| combat_reportDamage | method | L2777 | L2779 | 3 | `combat_reportDamage(...args)` |
| combat_runeCharge_onHit | method | L2780 | L2782 | 3 | `combat_runeCharge_onHit(...args)` |
| combat_checkBossPhaseChange | method | L2783 | L2785 | 3 | `combat_checkBossPhaseChange(...args)` |
| combat_tryMoveEnemy | method | L2786 | L2788 | 3 | `combat_tryMoveEnemy(...args)` |
| calc_isAreaOccupied | method | L2789 | L2791 | 3 | `calc_isAreaOccupied(...args)` |
| spawn_addScore | method | L2792 | L2792 | 1 | `spawn_addScore()` |
| combat_runeCharge_init | method | L2793 | L2793 | 1 | `combat_runeCharge_init()` |
| combat_runeCharge_update | method | L2794 | L2794 | 1 | `combat_runeCharge_update()` |
| combat_runeCharge_draw | method | L2795 | L2801 | 7 | `combat_runeCharge_draw()` |
