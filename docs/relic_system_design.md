# 遗物系统与新手体验优化设计方案

## 1. 问题背景
目前玩家初始状态伤害过低，容易导致新手体验差。虽然游戏已经实现了根据玩家伤害动态计算敌人血量的机制（`spawn_system.js` 中 `spawn_spawnEnemyRowAt`），但仅靠降低敌人血量无法带给玩家足够的爽快感和成长正反馈。我们需要主动推送强力遗物供其选择，并对遗物的给予时机、推荐展示进行优化。

## 2. 优化目标
1. **统一回合开始奖励结算**：首个遗物、非 Boss 敌人掉落的遗物或精华都写入 `pendingRoundStartRewards`，并在下一回合开始由 round-start resolver 统一处理。
2. **强力遗物推荐系统**：在遗物池中主动推荐强力遗物，打上核心关键词标签，并显示推荐 Tip。仅前三次遗物选择进行推荐。
3. **视觉增强**：选择遗物时，加强稀有遗物卡片的视觉效果。

## 3. 详细设计与修改点

### 3.1 遗物给予时机调整
- **涉及文件**：`src/game_phase.js`, `src/game_system.js`, `src/core.js`, `src/ui/shop.js`, `src/event_bus.js`
- **修改逻辑**：
  - `sys_initGameStart()` 不再直接 `ui_showRelicSelection()`，而是先向 `pendingRoundStartRewards` 压入首个 `relic`，再调用 `sys_startRoundStartResolver()`。
  - `phase_finalizeRound()` 不再依赖固定回合判断；非 Boss 敌人在死亡时由 `enemy:killed` 事件监听器登记 `relic` 或 `essence` 掉落，并在下一回合开始统一结算。
  - `sys_loadRunState()` 恢复局内存档后先执行 `sys_startRoundStartResolver()`，保证刷新恢复不会跳过待领取奖励。
  - `ui_closeRelicSelection()` 在 `resumeTarget === 'round_start_resolver'` 时继续解析剩余奖励，而不是默认回到固定的 `selection/gathering`。

### 3.2 强力遗物推荐系统
- **涉及文件**：`src/ui/shop.js`, `src/config.js`, `src/core.js`, `index.html`
- **修改逻辑**：
  - **推荐计数**：在 `core.js` 的 `sys_resetGame` 中增加 `this.relicSelectionCount = 0;`。
  - **强力遗物定义**：在 `config.js` 的 `RELIC_DB` 中，为适合新手的强力遗物（如解锁强力属性、增加弹珠数量、增加特殊槽位等）添加 `recommended: true` 和 `tags: ['核心', '新手推荐']` 等字段。
  - **抽取逻辑**：在 `shop.js` 的 `ui_showRelicSelection` 中：
    - 如果 `this.relicSelectionCount < 3`，则在抽取时增加强力遗物的权重，或者强制保证至少出现 1 个 `recommended` 遗物。
    - 记录本次选择是第几次（`this.relicSelectionCount++`，在 `ui_selectRelic` 或 `ui_skipRelic` 时增加，或者在打开时增加）。
  - **UI 渲染**：
    - 如果该遗物被推荐且 `relicSelectionCount <= 3`（这里注意打开时的计数），在卡片 HTML 中添加推荐标签（Tag）和 Tip 提示。
    - 在 `index.html` 中添加对应的 CSS 样式（如 `.relic-tag`, `.relic-tip`）。

### 3.3 稀有遗物视觉增强
- **涉及文件**：`index.html`
- **修改逻辑**：
  - 修改 `.relic-card.rare`, `.relic-card.legendary` 的 CSS 样式。
  - 增加发光动画（如 `box-shadow` 动画，`@keyframes pulse-glow`）。
  - 增加边框高亮和更强的悬浮效果。

## 4. 实施步骤
1. **Phase 4**: 修改 `src/game_phase.js` 中的回合判断逻辑。
2. **Phase 5**: 修改 `src/config.js` 标记强力遗物；修改 `src/core.js` 添加计数器；修改 `src/ui/shop.js` 实现推荐逻辑和 UI 渲染。
3. **Phase 6**: 修改 `index.html` 添加标签、Tip 和稀有遗物的动画样式。
4. **Phase 7**: 提交代码并更新规范文档。

---

## 5. v2 即时感重塑（2026-04-29）

### 5.1 背景与问题

旧版大量遗物机制都是在选中后通过 `sys_queueRoundStartReward({ type: 'chaos_essence' })` "立刻触发一次混沌精华"，依赖钉板的固定流程把"获得=立刻强"的反馈具象化。当钉板从「每回合固定流程」改为「掉落物触发」后：

- 钉板触发时机和频率不可预测，遗物的副作用反馈变得"不及时"。
- 玩家选完遗物后的体感弱化为"等下一次掉落才生效"。
- 大部分钉板遗物（维度碎片、空间凿子、涌潮系列、阵形系列）都受影响。

### 5.2 v2 新增/修改遗物清单

> 数据源：`src/config.js` `RELIC_DB` 末尾的「即时战斗强化遗物（v2 即时感重塑）」分组。

| ID | 名称 | 稀有度 | 类型 | 关键钩子位置 |
|---|---|---|---|---|
| `hunter_instinct` | 猎人本能 | rare | 战斗被动 | `combat_system.js` `combat_damageEnemy`：在 `enemy.takeDamage` 之前对场上 hp 最低敌人 ×1.25 |
| `rune_resonance_core` | 技能共鸣核 | rare | 击杀奖励 | `combat_system.js` `combat_skillCharge_onHit`：击杀 +0.08 技能充能 |
| `mirror_magazine` | 镜像弹夹 | rare | 一次性 | `ui/shop.js` `ui_selectRelic`：复制 `ammoQueue` 中评分最高的子弹至队尾 |
| `doomsday_timer` | 末日计时器 | rare | 回合开始 | `game_phase.js` `phase_finalizeRound`（round++ 之后）→ `combat_system.js` `relic_runRoundStartHooks`；若末日击杀成功，则短延迟后补触发；主触发每累计 5 次，补触发上限 +1 |
| `echo_reverberation` | 余韵回响 | rare | 钉板编译 | `calc_utils.js` `calc_compileCollectionToRecipe`：单属性 ≥10 层时 +1 |
| `element_injector` | 元素注入器 | epic | 一次性 | `ui/shop.js` `ui_selectRelic`：删除 `ammoQueue` 最强/最弱，幸存者属性翻倍 |
| `chaos_burst` | 混沌爆发 | cursed | 掉落联动 | `game_system.js` `sys_dropFieldLoot`：混沌精华掉落时全场固定真实伤害 round×2 |
| `attribute_protocol` | 属性协议 | rare | 发射时 | `combat_system.js` `combat_fireNextShot`：4 种以上属性时按子弹自身属性数 +damage |
| `mortal_burst` | 殒命爆裂 | rare | 击杀联动 | `combat_system.js` killed 块：max(2, maxHp×10%) AOE 真实伤害 |
| `corridor_arc` | 回廊电弧 | epic | 墙撞 + 回合开始 | `entities/projectile.js` `_applyMove`（左右墙壁 +1 闪电层）+ `relic_runRoundStartHooks`（紧贴墙壁 50% 触发电弧） |
| `chaos_pact` | 混沌契约 | cursed | 永久 + 流程 | `ui/shop.js`（拾取时给 3 稀有符文 + 设置 `chaosPactDamageMult=2`）+ `game_phase.js` `phase_startGatheringPhase`（直接跳过研磨）+ `combat_fireNextShot`（伤害倍率应用） |
| `relic_sage_apothecary` | 贤者药匣 | legendary | 特殊解锁 | `ui/shop.js` 拾取 `unlock_potion_alchemy` 后开启炼金台药剂 Tab；`ui/rune_launcher.js` 消耗符文炼成 `preparedPotionSpell`；`systems.js` 渲染药剂槽；`combat_system.js` `combat_activatePotionSpell()` 释放药剂 |
| `greedy_wheel` | 贪婪轮盘 | cursed | 发射时 | `combat_system.js` `combat_fireNextShot`：multicast 折算为 +damage×0.5/层；`game_phase.js` `burstQueue` 在每次贪婪发射后按 75% 概率继续排入下一次续转 |
| `energy_shield`（修改） | 力場護盾 | cursed | 墙壁联动 | `entities/projectile.js` `_applyMove`：每次墙体接触最多消耗 1 层反弹或穿透；同帧角落碰撞也只扣 1 层；无耐久时继续正常墙体反弹 |

### 5.3 状态字段

新增的 game 实例字段（`sys_resetGame` / `sys_saveRunState` / `sys_loadRunState` 三处都已对齐）：

| 字段 | 默认值 | 说明 |
|---|---|---|
| `chaosPactDamageMult` | `1` | 混沌契约的永久伤害倍率，发射时应用到 `finalRecipe.damage` |
| `potionAlchemyUnlocked` | `false` | 贤者药匣是否已解锁本局药剂炼成 |
| `preparedPotionSpell` | `null` | 当前预调制药剂，包含 `potionId`、`charges`、`maxCharges`、`quality` 与来源符文 |
| `knownPotionSpellIds` | `[]` | 本局已炼成/释放过的药剂 ID，供图鉴或后续提示扩展 |
| `potionRecipeHistory` | `[]` | 最近药剂炼成结果，保留成功/失败与返还信息，存档时截断为 10 条 |
| 子弹 recipe `_greedyWheelEnabled` / `_greedyWheelChance` | `false` / `0.75` | 贪婪轮盘发射链标记；续转子弹也会按同一概率继续触发，直到失败或达到防御性最大链长 |
| 子弹 recipe `_attributeProtocolBonus` | `undefined` | 调试用，记录属性协议本次发射叠加的伤害值 |
| 敌人 `_mortalBurstTriggered` | `false` | 殒命爆裂连锁防递归 |

### 5.4 评分算法（_scoreRecipeStrength）

镜像弹夹 / 元素注入器使用同一评分公式：

```
score(r) = r.damage
        + (r.cryo + r.pyro + r.lightning + r.laser + r.wind + r.bounce + r.pierce + r.scatter + r.flying_sword)
        + r.multicast × 2
        + (r.explosive ? 3 : 0)
        + (r.isLaser ? 2 : 0)
```

定义在 `src/ui/shop.js` 文件顶部。`recipe_countAttributeKinds` 同文件导出，供属性协议跨模块复用。

### 5.5 边界情况记录

- **元素注入器**：ammoQueue 长度为 2 时仅删除最弱、保留最强并翻倍；长度为 1 时直接对其翻倍。
- **混沌契约**：第一回合 `_lastFiredAmmoSnapshot` 不存在，自动用 `CONFIG.gameplay.baseDamage` 兜底生成 3 颗基础子弹。
- **回廊电弧**：`ammoQueue` 为空时使用回合数兜底；闪电链伤害近似为 `stacks × maxDmg × 0.33`，避免重写完整闪电链算法。
- **力場護盾诅咒**：墙壁碰撞会优先消耗现有 bounce/pierce 耐久，但每次墙体接触最多只扣 1 层；即使同帧擦到角落两面墙，也不会连续扣多层。耐久耗尽后不再销毁子弹，无 bounce/pierce 子弹应继续按普通墙体反弹，避免墙体表现成“吞子弹”。
- **殒命爆裂**：通过 `enemy._mortalBurstTriggered` 防止 AOE 互相触发的链反应循环。AOE 范围取 `max(60, enemy.width × 2)`。
- **混沌爆发**：仅在 `queuedReward.type === 'chaos_essence'` 时触发，`pure_essence` / `relic` 不触发。

### 5.6 设计目标对照

| 旧问题 | v2 解决方式 |
|---|---|
| 选完遗物要等钉板触发才有反馈 | mirror_magazine / element_injector / chaos_pact 在 `ui_selectRelic` 内立即修改 `ammoQueue` 或 `chaosPactDamageMult`，下次发射就能看到变化 |
| 遗物效果跟回合频率脱钩 | doomsday_timer / corridor_arc 直接挂在 `phase_finalizeRound` 的 round++ 钩子，**强制每回合开始有反馈** |
| 击杀效率与遗物无关 | hunter_instinct / rune_resonance_core / mortal_burst 都直接走击杀通路，杀得越快越爽 |
| 钉板触发的副作用价值不可控 | chaos_burst 把"掉落混沌精华"本身变成全屏伤害事件，与新的掉落驱动正向耦合 |
