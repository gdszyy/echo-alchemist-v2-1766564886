# 重构待办清单 (Refactoring TODO List)

本文档旨在记录《回声炼金师》项目中可被进一步解耦和提取的模块，作为未来代码工程化重构的路线图。

## 核心原则

- **单一职责原则 (Single Responsibility Principle)**: 每个类或模块应该只负责一项功能。
- **组合优于继承 (Composition over Inheritance)**: 通过将功能模块组合到 `Game` 类中，而不是让 `Game` 类无限制地膨胀。

---

## 1. UI 管理器 (`UIManager`)

- **当前状态**: `UIManager` 类已存在，但功能非常有限。大量 UI 更新逻辑散落在 `Game` 类中（以 `ui_` 前缀标识）。
- **重构目标**: 将所有与 DOM 操作和 UI 渲染相关的逻辑从 `Game` 类中剥离，整合进 `UIManager`。
- **待迁移方法**:
  - `ui_updateSlowMotion`
  - `ui_updateMultiplierUI`
  - `ui_updateUI`
  - `ui_showRelicSelection`
  - `ui_closeRelicSelection`
  - `ui_renderRecipeHUD`
  - `ui_renderRecipeCard`
  - `ui_updateUICache`
  - `ui_updateGatheringQueueUI`
  - `ui_updateAmmoUI`
  - `ui_renderAmmoIcon`
  - `ui_drawLauncherOrbitals`
  - `ui_selectRelic`
  - `ui_skipRelic`
  - `ui_confirmSelection`
- **实现方式**: `UIManager` 在构造时接收 `game` 实例，通过 `game.state` 获取数据，并直接操作 DOM 元素。

## 2. 实体工厂 (`EntityManager` / `Factory`)

- **当前状态**: 所有实体的创建逻辑（`spawn_` 和 `create_`）都直接在 `Game` 类中实现。
- **重构目标**: 创建一个专门的工厂类，负责所有游戏对象的实例化。
- **待迁移方法**:
  - `spawn_createFloatingText`
  - `spawn_generateAffixes`
  - `spawn_spawnEnemyRowAt`
  - `spawn_addSkillPoint`
  - `spawn_spawnEnemyRow`
  - `spawn_triggerCloneSpawn`
  - `spawn_addSonSword`
  - `spawn_generateMarbleOptions`
  - `spawn_createParticle`
  - `spawn_triggerLightningChain`
  - `spawn_spawnBullet`
  - `spawn_createExplosion`
  - `spawn_createShockwave`
  - `spawn_createHitFeedback`
  - `spawn_triggerLevelUpEvent`
- **实现方式**: `EntityManager` 接收 `game` 实例，提供如 `create("enemy", options)` 的接口，并将创建的实体添加到 `game.enemies` 等数组中。

## 3. 输入处理器 (`InputHandler`)

- **当前状态**: 输入事件监听和处理逻辑在 `sys_setupInputs` 中定义，直接调用 `Game` 类的 `handle_` 方法。
- **重构目标**: 将所有输入事件（鼠标、触摸、陀螺仪）的监听和原始数据处理封装到 `InputHandler` 中。
- **待迁移方法**:
  - `input_handleOrientation`
  - `input_getTiltOffset`
  - `input_checkEnemyHover`
  - `input_handleInputEnd`
  - `input_handleInputMove`
  - `phase_handleInputStart` (应重命名为 `input_handleInputStart`)
- **实现方式**: `InputHandler` 监听 DOM 事件，然后调用 `game` 实例上的高级接口，如 `game.combat_fireNextShot()` 或 `game.ui_selectRelic()`。

## 4. 战斗逻辑管理器 (`CombatManager`)

- **当前状态**: 战斗相关的计算和逻辑（`combat_`）紧密耦合在 `Game` 类中。
- **重构目标**: 创建一个 `CombatManager` 来处理所有与战斗直接相关的逻辑，如伤害计算、技能效果、状态应用等。
- **待迁移方法**：
  - `combat_calculatePlayerExpectedDamage`
  - `combat_damageEnemy`
  - `combat_activateSkill`
  - `combat_fireNextShot`
  - `combat_fireLaser`
  - `combat_castRayToReflectors`
  - `combat_processLaserPenetration`
- **实现方式**: `CombatManager` 接收 `game` 实例，操作 `game.enemies` 和 `game.projectiles` 数组。

---

*此文档由 AI Agent 生成，作为代码重构的路线图。*
