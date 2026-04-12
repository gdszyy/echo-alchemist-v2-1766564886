# 碰撞系统集成报告

**任务 ID**: tsk-4e1cb441-1cb  
**执行 Agent**: Physics-Agent (agt-ba820378-73f)  
**完成时间**: 2026-04-12

---

## 一、坐标系确认

### 结论：本地坐标 + 正确转换，无需修改

`spawn_system.js` 中 Boss 的 `collisionData.vertices` 使用**本地坐标**（相对于 Boss 中心点的偏移量），例如：

```js
vertices: [
    new Vec2(-bossW * 0.4,  bossH * 0.5), // 左底（相对中心的偏移）
    new Vec2(-bossW * 0.3,  0),           // 左中
    // ...
]
```

`enemy.js` 中的 `getAbsoluteVertices()` 方法正确地将本地坐标转换为世界坐标：

```js
getAbsoluteVertices() {
    return this.collisionData.vertices.map(v => 
        new Vec2(this.pos.x + v.x, this.pos.y + v.y)
    );
}
```

`calc_getCirclePolygonCollision` 接受世界坐标顶点，子弹的 `pos` 也是世界坐标，**坐标系一致，无需修改**。

---

## 二、_handleCollision 方法完善

### 2.1 法线反弹验证

法线反弹公式 `v' = v - 2*(v·n)*n` 已正确实现：

```js
const dot = this.vel.dot(normal);
if (dot < 0) {  // 只在子弹撞向表面时反弹（dot < 0）
    this.vel = this.vel.sub(normal.mult(2 * dot));
}
```

- `polygon/arc` 碰撞时，`hitResult.normal` 由 `calc_getCirclePolygonCollision` / `calc_getCircleArcCollision` 提供，优先使用
- `AABB` 碰撞时，法线从 `distVecX/dist, distVecY/dist` 计算（最近点→圆心方向）
- 深度穿透（`dist === 0`）时，从 AABB 重叠量计算法线

### 2.2 pierce（穿透）处理

```js
if (this.piercesLeft > 0) {
    this.piercesLeft--;
    return; // 穿透，继续飞行，不反弹
}
```

- 穿透时消耗一层 `piercesLeft`，直接 `return`（不反弹，不销毁）
- polygon/arc 碰撞时同样适用 ✓

### 2.3 bounce（弹跳）处理

```js
if (this.bouncesLeft > 0) {
    this.bouncesLeft--;
    // ... 词条 Hook（kinetic_surge, frost_nova）...
    // 使用 shapeNormal（polygon/arc 提供）或计算法线
    const dot = this.vel.dot(normal);
    if (dot < 0) {
        this.vel = this.vel.sub(normal.mult(2 * dot));
    }
}
```

- 弹跳时消耗一次 `bouncesLeft`，使用精确法线反弹
- polygon/arc 碰撞时 `shapeNormal` 已由碰撞检测提供，优先使用 ✓

---

## 三、Devourer 吞噬逻辑

### 3.1 角度修复（enemy.js）

**问题**：OPENING 状态设置的角度（`0.1π~1.9π`）导致 DEVOURING 状态的缺口只有 36°，与设计文档（缺口 324°）不符。

**修复**：

```js
// 修复前（OPENING 状态设置）：
this.collisionData.startAngle = Math.PI * 0.1;  // 圆弧 324°，缺口 36°
this.collisionData.endAngle = Math.PI * 1.9;

// 修复后：
this.collisionData.startAngle = Math.PI * 0.9;  // 162°，圆弧 36°，缺口 324°
this.collisionData.endAngle = Math.PI * 1.1;    // 198°
```

**角度说明**：
- 圆弧实体：162°~198°（36°，在左方）
- 缺口范围：198°~162°（经过 0°，共 324°，缺口中心在右方）
- 与 IDLE 状态缺口方向一致（IDLE 缺口在右方 0°）

| 状态 | 圆弧实体 | 缺口 | 设计文档 |
|:---|:---|:---|:---|
| IDLE | 45°~315°（270°） | 90°（在右方） | 缺口 90° ✓ |
| OPENING | 72°~288°（216°） | 144°（在右方） | 缺口 144° ✓ |
| **DEVOURING** | **162°~198°（36°）** | **324°（在右方）** | **缺口 324° ✓** |
| COOLDOWN | 0°~360°（360°） | 0° | 缺口 0° ✓ |

### 3.2 吞噬逻辑实现（projectile.js）

在 arc 碰撞检测之后，当 `hitResult = null`（子弹在缺口中）且敌人是 Devourer 处于 DEVOURING 状态时，检查子弹是否在圆弧半径范围内：

```js
if (!hitResult && e.bossType === 'devourer' && e.devourState === 'DEVOURING') {
    const dx = this.pos.x - e.pos.x;
    const dy = this.pos.y - e.pos.y;
    const distToCenter = Math.sqrt(dx * dx + dy * dy);
    const halfThick = e.collisionData.thickness / 2;
    const innerRadius = e.collisionData.radius - halfThick - this.radius;
    const outerRadius = e.collisionData.radius + halfThick + this.radius;

    if (distToCenter >= innerRadius && distToCenter <= outerRadius) {
        // 子弹进入缺口区域，触发吞噬效果
        this.active = false;
        if (typeof game !== 'undefined') {
            // 吞噬特效：紫色冲击波 + 粒子散射
            game.spawn_createShockwave(this.pos.x, this.pos.y, '#a855f7');
            for (let i = 0; i < 6; i++) {
                game.spawn_createParticle(
                    this.pos.x + (Math.random() - 0.5) * 20,
                    this.pos.y + (Math.random() - 0.5) * 20,
                    '#c084fc', 'mist'
                );
            }
            game.spawn_createFloatingText(
                this.pos.x, this.pos.y - 20,
                'DEVOURED', '#a855f7'
            );
        }
        return; // 子弹被吞噬，不造成伤害
    }
}
```

**逻辑说明**：
- `hitResult = null`：子弹不在圆弧实体上（在缺口中或完全离开圆弧区域）
- `distToCenter >= innerRadius && distToCenter <= outerRadius`：子弹在圆弧半径范围内（确认在缺口区域，而非完全离开）
- `this.active = false`：子弹消失，不触发 `destroy()`（不产生链式/嵌套弹药）
- 不调用 `onHit()`：不造成伤害
- 触发紫色吞噬特效（冲击波 + mist 粒子 + DEVOURED 浮动文字）

---

## 四、修改文件列表

| 文件 | 修改内容 |
|:---|:---|
| `src/entities/enemy.js` | 修复 DEVOURING 状态圆弧角度（0.9π~1.1π） |
| `src/entities/projectile.js` | 添加 Devourer 吞噬逻辑（缺口区域子弹消失） |

**Git Commit**: `5cea1c8` - fix(collision): 修复Devourer碰撞角度并添加吞噬逻辑
