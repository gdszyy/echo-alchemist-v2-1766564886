# Boss 物理碰撞与反弹机制设计规范

**版本**: v1.0  
**作者**: Mechanic-Logic-Agent  
**日期**: 2026-04-12  
**关联任务**: tsk-f30c59da-6a9

---

## 1. 概述

在《Echo Alchemist V2》中，为配合8个Boss独特的异型外观，现有的 Circle-to-AABB（弹珠对轴对齐矩形）碰撞检测系统需要进行扩展。本文档规范了以下内容：

1. **Circle-to-Polygon** 碰撞检测与反弹算法
2. **Circle-to-Arc** 碰撞检测与反弹算法
3. **8个Boss的碰撞形状分配**
4. **Devourer 吞噬冷却状态机**
5. **Ouroboros 缺口移动逻辑**

---

## 2. 核心碰撞检测算法

### 2.1 Circle-to-Polygon（圆形对多边形）

**文件**: `src/combat/collision_shapes.js`，函数 `calc_getCirclePolygonCollision`

**算法流程**：

1. **逐边最近点查找**：遍历多边形的每一条边（线段），对每条线段计算圆心到线段的最近点（通过投影参数 `t = clamp(0, 1, dot(CP, AB) / |AB|²)` 得到），并记录距离最小的那条边。
2. **碰撞判定**：若最近点到圆心的距离小于 `circleRadius + 2`（含容差），则发生碰撞。
3. **法线计算**：
   - **正常情况**：法线 = 最近点指向圆心的单位向量。
   - **穿模情况（distSq == 0）**：法线 = 当前线段的法向量（垂直于线段，指向外部）。
4. **深度穿模检测**：使用射线法（Ray Casting）判断圆心是否在多边形内部，若在内部则使用最近线段的法线将弹珠推出。
5. **位置修正（Push Out）**：将弹珠沿法线方向推出至 `closestPoint + normal * (radius + 0.1)`。
6. **速度反弹（Reflection）**：`v' = v - 2 * (v · n) * n`，仅在 `dot < 0` 时执行（防止重复反弹）。

### 2.2 Circle-to-Arc（圆形对圆弧）

**文件**: `src/combat/collision_shapes.js`，函数 `calc_getCircleArcCollision`

**算法流程**：

1. **半径环过滤**：计算弹珠圆心到圆弧圆心的距离 `D`，若 `D < arcRadius - hitRadius` 或 `D > arcRadius + hitRadius`，则直接跳过（不在圆弧厚度范围内）。
2. **角度范围判断**：计算弹珠圆心相对于圆弧圆心的角度，检查是否在圆弧的起止角度范围内（支持跨越 0 度线的圆弧）。
3. **最近点确定**：
   - 若角度在圆弧范围内：最近点为圆弧上对应角度的点。
   - 若角度不在圆弧范围内：最近点为圆弧两个端点中较近的一个。
4. **碰撞判定与法线计算**：同 Circle-to-Polygon 的步骤 2-4。

### 2.3 多态碰撞分发（Projectile._handleCollision）

**文件**: `src/entities/projectile.js`，方法 `_handleCollision`

根据敌人的 `collisionShape` 属性进行多态分发：

| `collisionShape` 值 | 调用的算法 | 数据来源 |
| :--- | :--- | :--- |
| `'polygon'` | `calc_getCirclePolygonCollision` | `e.collisionData.vertices` |
| `'arc'` | `calc_getCircleArcCollision` | `e.collisionData.{radius, startAngle, endAngle, thickness}` |
| `'aabb'`（默认） | 原有 AABB 算法 | `e.width`, `e.height` |

---

## 3. 8个Boss的碰撞形状设计

**文件**: `src/spawn_system.js`，方法 `spawn_spawnBoss`

| Boss | 主题 | 碰撞形状 | 形状参数 | 设计意图 |
| :--- | :--- | :--- | :--- | :--- |
| **Ignis** (熔炉守卫) | 熔炉 | 梯形多边形 | 4顶点，底宽顶窄 | 底部宽大，弹珠容易从两侧弹开；顶部收窄，形成更明确的入射窗口 |
| **Glacies** (霜晶缝合怪) | 冰晶 | 5顶点不规则多边形 | 顶部尖锐，两侧斜面 | 不规则斜面导致弹珠反弹角度多变，难以预判 |
| **Micro** (裂变母体) | 细胞 | 完整圆弧（圆形） | 半径 = bossW * 0.3，厚度 = bossH * 0.1 | 圆形表面使弹珠均匀反弹，配合分身机制形成混乱 |
| **Devourer** (噬神者) | 深渊巨口 | 带缺口圆弧 | 缺口约 90°，位于正前方 | 缺口是入射窗口，弹珠进入缺口不反弹（直接命中核心） |
| **Viridis** (翠绿共生体) | 植物 | 5顶点波浪多边形 | 顶部尖，两侧斜面 | 波浪形轮廓提供多种反弹角度，配合高回复形成持久战 |
| **Tesla** (雷霆幻影) | 菱形 | 4顶点菱形 | 宽 = bossW * 0.4，高 = bossH | 菱形碰撞面积小，弹珠容易从尖角处滑过，难以命中 |
| **Chimera** (混沌融合体) | 不规则多边形 | 5顶点不对称多边形 | 形状不对称，狂暴后顶点偏移 | 不对称形状使弹珠反弹方向难以预测 |
| **Ouroboros** (永恒回声) | 蛇环 | 旋转圆弧（带缺口） | 缺口 90°，实体 270°，旋转 | 缺口是唯一伤害入口，需要玩家预判缺口位置 |

---

## 4. 专属机制状态机设计

**文件**: `src/entities/enemy.js`，方法 `startTurnAction`

### 4.1 Devourer 吞噬冷却状态机

Devourer 的"巨口"（圆弧缺口）在每个回合开始时按以下状态机更新：

```
IDLE (闭合) ──3回合──> OPENING (张开) ──1回合──> DEVOURING (吞噬中) ──1回合──> COOLDOWN (冷却)
  ^                                                                                    |
  └──────────────────────── 4回合（普通）/ 2回合（狂暴）────────────────────────────────┘
```

| 状态 | 碰撞行为 | 视觉提示 |
| :--- | :--- | :--- |
| `IDLE` | 完整圆弧（缺口 90°），正常反弹 | 缺口闭合 |
| `OPENING` | 缺口扩大至 144°，弹珠可穿入 | 缺口张开动画 |
| `DEVOURING` | 缺口扩大至 324°，弹珠直接命中核心 | 全口张开，吸引力视觉效果 |
| `COOLDOWN` | 完整圆弧（缺口 0°），受到伤害加深 | 闭合，发光提示脆弱状态 |

**狂暴阶段（HP < 50%）**：冷却时间从4回合减为2回合，吞噬频率翻倍。

### 4.2 Ouroboros 缺口移动逻辑

Ouroboros 的圆弧缺口每回合旋转，要求玩家预判缺口位置：

- **普通阶段**：缺口每回合旋转 `π/4`（45°），顺时针旋转。
- **狂暴阶段（HP < 50%）**：缺口每回合旋转 `π/2`（90°），速度翻倍。
- **词缀轮转联动**：每次词缀轮转时，缺口额外旋转 `π`（180°），打乱玩家的节奏。

---

## 5. 数据结构规范

### Enemy.collisionShape 属性

| 属性 | 类型 | 默认值 | 说明 |
| :--- | :--- | :--- | :--- |
| `collisionShape` | `string` | `'aabb'` | 碰撞形状类型：`'aabb'` / `'polygon'` / `'arc'` |
| `collisionData` | `Object\|null` | `null` | 碰撞形状数据 |

### collisionData 结构

**多边形（polygon）**：
```js
{
  vertices: [Vec2, Vec2, ...] // 顶点数组（按顺序连接）
}
```

**圆弧（arc）**：
```js
{
  radius: number,      // 圆弧半径
  startAngle: number,  // 起始角度（弧度）
  endAngle: number,    // 终止角度（弧度）
  thickness: number    // 圆弧厚度
}
```

---

## 6. 架构约定

1. **碰撞算法模块**：所有碰撞检测函数集中在 `src/combat/collision_shapes.js` 中，通过 ES Module 导出。
2. **Projectile 引用**：`src/entities/projectile.js` 在文件顶部通过 `import` 引入碰撞算法。
3. **Boss 形状初始化**：碰撞形状在 `spawn_spawnBoss` 中根据 `bossId` 进行 `switch` 分配，确保每个 Boss 有独立的形状数据实例。
4. **状态机位置**：Devourer 和 Ouroboros 的状态机更新逻辑位于 `Enemy.startTurnAction` 中，在每个回合开始时执行。
5. **向后兼容**：所有普通敌人默认 `collisionShape = 'aabb'`，与原有逻辑完全兼容，无需修改现有代码。

---

## 7. 修改文件清单

| 文件 | 修改类型 | 说明 |
| :--- | :--- | :--- |
| `src/combat/collision_shapes.js` | **新增** | Circle-to-Polygon 和 Circle-to-Arc 碰撞算法 |
| `src/entities/projectile.js` | **修改** | `_handleCollision` 多态分发，引入 collision_shapes.js |
| `src/entities/enemy.js` | **修改** | 构造函数新增 `collisionShape` 和 `collisionData` 属性；`startTurnAction` 新增 Boss 状态机更新 |
| `src/spawn_system.js` | **修改** | `spawn_spawnBoss` 新增 8个Boss的碰撞形状分配 |
| `docs/boss_collision_physics_design.md` | **新增** | 本文档 |
