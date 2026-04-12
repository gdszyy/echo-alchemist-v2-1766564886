# 任务交付物：训练场（TrainingGround）改造

**任务 ID**: tsk-d51b88bb-fcf  
**提交时间**: 2026-04-12  
**Git Commit**: eb9a09a

---

## 修改摘要

本次修改涉及两个文件：`src/systems.js` 和 `src/game_phase.js`。

---

## 步骤2：修复 fireBullet() 发射流程

**文件**: `src/systems.js`

### 问题

`TrainingGround.fireBullet()` 直接调用 `this.game.spawn_spawnBullet(x, y, vel, recipe, null, true)`，绕过了 `combat_fireNextShot` 的完整发射流程，导致：

- 缺少充能动画（`isChargingShot` 流程）
- 缺少 `multicast` 多重射击效果
- 缺少 `spinBoost` 视觉效果
- 缺少符文词条加成（`activeRunewordStats`）
- 缺少符文基础属性叠加（`calcRuneBaseStats`）

### 修复方案

将 recipe 推入 `ammoQueue`，设置充能动画状态，由 `phase_combat_update` 中的 `combat_fireNextShot` 统一处理发射：

```js
// 修复前
this.game.spawn_spawnBullet(x, y, vel, recipe, null, true);

// 修复后
this.game.ammoQueue.push(recipe);
this.game.pendingFireVelocity = vel;
this.game.isChargingShot = true;
this.game.chargeProgress = 0;
```

### enter() 方法新增初始化

进入训练场时，重置所有发射相关状态：

```js
this.game.ammoQueue = [];
this.game.burstQueue = [];
this.game.isChargingShot = false;
this.game.chargeProgress = 0;
this.game.pendingFireVelocity = null;
this.game.isReloading = false;
this.game.reloadProgress = 0;
this.game.isEnemyTurn = false;
this.game.combat_runeCharge_init();
```

---

## 步骤3：修复符文充能衰减逻辑

**文件**: `src/game_phase.js`

### 问题

`combat_runeCharge_decay` 只在 `phase === 'combat'` 时触发，训练场（`phase === 'training'`）无法正常衰减充能值。

### 修复方案

```js
// 修复前
if (this.phase === 'combat') {
    this.combat_runeCharge_decay(timeScale);
}

// 修复后
if (this.phase === 'combat' || this.phase === 'training') {
    this.combat_runeCharge_decay(timeScale);
}
```

---

## 步骤1：架构评估（createCombatContext）

**结论：选择方案A（不引入 createCombatContext）**

- 并行任务 tsk-1ebbd3ef-f7a（createCombatContext）尚未完成（进度30%）
- 训练场使用主 Canvas，与图鉴（独立 canvas）场景不同
- 保持现有 `this.game` 引用架构更合适

---

## 验收标准检查

| 验收标准 | 状态 |
|---|---|
| TrainingGround.fireBullet() 通过 ammoQueue + combat_fireNextShot 发射 | ✅ |
| training 阶段的符文充能会正常衰减 | ✅ |
| 训练场发射有与局内相同的充能动画效果 | ✅ |
| 代码提交到 gdszyy/echo-alchemist-v2-1766564886 仓库 | ✅ |
