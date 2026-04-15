# 任务结果：tsk-8b6353dd-c30

## 任务标题
【Task C】spawn_system.js 生成编排增强：Boss 入场压迫感 + 随从阵型协同

## 实现摘要

本次任务在不修改任何 UI 逻辑的前提下，通过增强 `src/spawn_system.js` 和 `src/entities/enemy.js` 中的生成编排逻辑，完成了三项视觉协同增强。

---

## C1. Boss 入场冲击波增强：周围小怪避让反应

**修改文件**：`src/spawn_system.js`

**实现位置**：`spawn_triggerBossEntranceShockwave(boss)` 方法末尾

**实现逻辑**：
- 在冲击波第一圈开始扩散时（`waveDelay * 0.5` 延迟），遍历所有 `active` 且 `type !== 'boss'` 的敌人
- 计算每个敌人与 Boss 的欧氏距离
- 在冲击波有效半径（`cfg.shockwaveMaxRadius`）内的敌人，根据 `ratio = 1 - dist / BUMP_RADIUS` 线性计算推力
- 设置 `e.bumpOffsetY = -(MAX_BUMP * ratio)`（最大 -20 像素），利用 `enemy.js` 已有的 `bumpOffsetY` 自动回弹机制产生波浪式弹跳

---

## C2. 随从阵型呼吸协同（相位偏移）

**修改文件**：`src/spawn_system.js`、`src/entities/enemy.js`

**spawn_system.js 修改**：
- 在填充循环（Fill Loop）中，`new Enemy(...)` 之后立即设置 `e._spawnColIndex = c`
- 在导演生成精英（Pending Spawns）中，同样设置 `e._spawnColIndex = cfg.col`

**enemy.js 修改**：
- Layer 3.5 `shield` 词缀蜂巢格纹绘制中，将 `Math.sin(t35 * 1.2)` 替换为 `Math.sin(t35 * 1.2 + (this._spawnColIndex || 0) * 0.4)`
- 每列之间相位差 0.4 弧度，使同行护盾敌人的蜂巢脉冲形成从左到右的波浪式闪烁

---

## C3. 精英敌人出场强调

**修改文件**：`src/spawn_system.js`

**实现位置**：`spawn_spawnEnemyRowAt()` 方法中 `e.type = 'elite'` 赋值处（两处：填充循环 + 导演生成）

**实现逻辑**：
- 当 `e.affixes.length > 0` 时（即敌人被标记为 elite），立即调用：
  - `this.spawn_createShockwave(e.pos.x, e.pos.y, '#facc15')` — 小型金色冲击波
  - 循环 4~6 次 `this.spawn_createParticle(e.pos.x, e.pos.y, '#facc15', 'spark')` — 金色火花粒子

---

## 文档同步

已同步更新 `.cursor/rules/entities.md` 第 5 节「参数调整记录」，新增 2026-04-15 条目。

## Git Commit

```
feat(spawn): 生成编排增强 (Boss压迫感 + 阵型协同)

- [C1] Boss入场气浪推力: 周围小怪产生波浪式避让弹跳
- [C2] 随从阵型呼吸协同: shield 词缀蜂巢脉冲增加列相位偏移
- [C3] 精英敌人出场强调: 触发金色冲击波和火花粒子
- [Doc] 同步更新 entities.md 参数调整记录
```

Commit hash: `8638df4`
