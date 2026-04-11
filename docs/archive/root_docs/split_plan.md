# Echo Alchemist Core 拆分计划

## 1. 模块拆分建议

| 模块名称 | 职责 | 包含的前缀/类 |
| :--- | :--- | :--- |
| **audio.js** | 音频管理 | `SoundManager` 类, `audio` 实例 |
| **game_system.js** | 游戏主循环、初始化、存档、输入 | `sys_` 前缀方法 |
| **game_phase.js** | 游戏阶段管理（战斗、收集、回合切换） | `phase_` 前缀方法 |
| **combat_system.js** | 战斗逻辑、技能触发、伤害计算 | `combat_` 前缀方法 |
| **render_system.js** | 渲染逻辑、特效绘制 | `render_` 前缀方法 |
| **spawn_system.js** | 实体生成、粒子生成、掉落物生成 | `spawn_` 前缀方法 |
| **ui_system.js** | UI 更新、商店渲染、HUD 管理 | `ui_` 前缀方法 |
| **calc_utils.js** | 数值计算、几何计算、难度调整 | `calc_` 前缀方法 |

## 2. 详细拆分清单

| 模块 | 包含的函数/类 |
| :--- | :--- |
| **audio.js** | `SoundManager`, `audio` (实例) |
| **game_system.js** | `sys_loop`, `sys_resize`, `sys_initGameStart`, `sys_loadSaveData`, `sys_saveData`, `sys_setupInputs`, `sys_resetGame`, `sys_toggleHud`, `sys_toggleMarbleSelection`, `sys_initRecipeHUD`, `sys_initSelectionPhase` |
| **game_phase.js** | `phase_switchPhase`, `phase_startCombatPhase`, `phase_startGatheringPhase`, `phase_combat_update`, `phase_gathering_update`, `phase_enemy_processTurn`, `phase_enemy_startLogic`, `phase_finalizeRound`, `phase_advanceWave`, `phase_gathering_attemptComplete`, `phase_gathering_getRandomPegType`, `phase_gathering_initPachinko`, `phase_handleInputStart` |
| **combat_system.js** | `combat_activateSkill`, `combat_calculatePlayerExpectedDamage`, `combat_damageEnemy`, `combat_fireNextShot`, `combat_reportDamage`, `combat_recordDamage`, `combat_tryMoveEnemy`, `combat_updateHitProgress`, `combat_updateMulticastDisplay`, `combat_flyingSword_addSon`, `combat_flyingSword_assignTarget`, `combat_laser_fire`, `combat_laser_castRay`, `combat_laser_processPenetration`, `combat_lightning_triggerChain`, `combat_playMulticastTransferEffect`, `combat_wind_...` (所有风系战斗逻辑) |
| **render_system.js** | `render_background`, `render_clearCanvas`, `render_floatingTexts`, `render_singleWindMatrix`, `render_windAnchors`, `render_butterflyPathWave`, `render_combat_launcherOrbitals` |
| **spawn_system.js** | `spawn_spawnEnemyRow`, `spawn_spawnEnemyRowAt`, `spawn_spawnBullet`, `spawn_createParticle`, `spawn_createExplosion`, `spawn_createShockwave`, `spawn_createHitFeedback`, `spawn_generateAffixes`, `spawn_generateMarbleOptions`, `spawn_addScore`, `spawn_addSkillPoint`, `spawn_stormCore`, `spawn_smallWhirlwind`, `spawn_triggerCloneSpawn`, `spawn_triggerLevelUpEvent`, `spawn_windSkillParticles` |
| **ui_system.js** | `ui_updateUI`, `ui_renderShop`, `ui_openTruthBook`, `ui_closeTruthBook`, `ui_updateMetaCurrency`, `ui_renderRecipeHUD`, `ui_renderRecipeCard`, `ui_updateAmmoUI`, `ui_renderAmmoIcon`, `ui_showRelicSelection`, `ui_closeRelicSelection`, `ui_selectRelic`, `ui_skipRelic`, `ui_updateSlowMotion`, `ui_playResourceFlyEffect`, `ui_saveShotDamage`, `ui_switchDamageRound`, `ui_toggleDamagePanel`, `ui_updateDamageStats`, `ui_updateRoundDamage`, `ui_updateGatheringQueueUI`, `ui_updateUICache`, `meta_openShop`, `meta_applyUpgrades`, `meta_buyUpgrade`, `meta_calculateUpgradeCost`, `meta_startRun`, `meta_addCurrency` |
| **calc_utils.js** | `calc_calculateDynamicThreshold`, `calc_calculateWaveSpeed`, `calc_compileCollectionToRecipe`, `calc_evaluateAndAdjustDifficulty`, `calc_getLineRectIntersection`, `calc_getPeakAverageDamage`, `calc_isAreaOccupied` |

## 3. 实施步骤

1.  **创建新文件**：在 `src/` 目录下创建上述 8 个 JS 文件。
2.  **迁移代码**：将 `core.js` 中的对应代码块移动到新文件中。
3.  **处理导入导出**：
    *   每个新模块需要导出其包含的函数。
    *   `Game` 类将作为主入口，通过组合或混入（Mixin）的方式集成这些模块的功能。
    *   由于 `Game` 类中的方法大量使用了 `this`，最简单的拆分方式是将这些方法定义为独立的函数，并在 `Game` 类中调用它们，或者使用 `Object.assign(Game.prototype, ...)`。
4.  **更新 `core.js`**：`core.js` 将变成一个聚合层，负责导入所有子模块并构建完整的 `Game` 类。
5.  **验证**：确保 `index.html` 仍然能正常加载并运行游戏。
