# 随从异型几何化实现报告

**任务 ID**: tsk-bbd1ce26-997  
**提交时间**: 2026-04-12  
**Git Commit**: c5ed9d0

---

## 实现概述

根据任务要求，为 Echo Alchemist V2 项目实现了随从的异型几何化功能。随从在战斗中会根据当前 `bossHistory` 最后一个 Boss 类型，自动分配对应的几何碰撞形状，并在绘制时使用多边形轮廓替代原有的圆角矩形。

---

## 修改文件

### 1. `src/spawn_system.js`

**新增方法 `spawn_applyMinionShape(e)`**（第 1554-1691 行）

在 `spawn_spawnEnemyRowAt` 函数的两处 Enemy 创建后（第 372 行和第 395 行）调用此方法，根据 `this.bossHistory` 最后一个 Boss 类型为随从分配 `collisionShape` 和 `collisionData`。

#### 形状分配规则

| 最后一个 Boss | 随从形状 | 顶点数 | 几何描述 |
| :--- | :--- | :---: | :--- |
| `ignis` | 等腰三角形 | 3 | 顶点居中，底边对称 |
| `glacies` | 菱形 | 4 | 4顶点菱形冰晶 |
| `mikro` | 正六边形 | 6 | 6顶点小六边形 |
| `devourer` | 残缺矩形 | 5 | 右上角被切掉（5顶点） |
| `viridis` | 水滴形 | 7 | 多边形近似水滴（顶尖+圆底） |
| `tesla` | 平行四边形 | 4 | 倒斜刀片形 |
| `chimera` | 不规则五边形 | 5 | 不对称碎片 |
| `ouroboros` | 八角形 | 8 | 标准八角形 |
| 无历史 | 默认 AABB | - | `collisionShape='aabb'`, `collisionData=null` |

所有顶点坐标均为相对中心点 `(0,0)` 的偏移量，范围在 `[-w/2, w/2] × [-h/2, h/2]` 内。

### 2. `src/entities/enemy.js`

**Layer 1 裁剪区域**（第 1064-1098 行）

将原有的 `type === 'boss'` 判断扩展为通用的 `collisionShape === 'polygon'` 判断，使 Boss 和随从均可使用多边形裁剪路径。同时保留了 Boss 专用的 `arc` 圆弧裁剪分支。

**Layer 5 边框绘制**（第 1505-1540 行）

同样将原有的 `type === 'boss'` 判断扩展为通用的 `collisionShape === 'polygon'` 判断，使 Boss 和随从均可使用多边形边框。同时保留了 Boss 专用的 `arc` 圆弧边框分支。

### 3. `.cursor/rules/entities.md`

新增"随从异型几何化"章节，记录形状分配规则、实现细节和顶点坐标约定。

---

## 碰撞检测

`src/entities/projectile.js` 的 `_handleCollision` 方法已有完整的 `polygon` 分支（调用 `calc_getCirclePolygonCollision`），随从的多边形碰撞检测无需额外修改，直接复用。

---

## 测试验证

所有 8 种 Boss 类型和无历史情况均通过单元测试：

```
[PASS] ignis: shape=polygon, verts=3 (expected 3)
[PASS] glacies: shape=polygon, verts=4 (expected 4)
[PASS] mikro: shape=polygon, verts=6 (expected 6)
[PASS] devourer: shape=polygon, verts=5 (expected 5)
[PASS] viridis: shape=polygon, verts=7 (expected 7)
[PASS] tesla: shape=polygon, verts=4 (expected 4)
[PASS] chimera: shape=polygon, verts=5 (expected 5)
[PASS] ouroboros: shape=polygon, verts=8 (expected 8)
[PASS] no history: shape=aabb, data=null
All tests PASSED!
```

所有顶点坐标均在合法范围 `±(w/2, h/2)` 内。

---

## 合并说明

在推送时发现远程已有另一个 Agent（tsk-c772e12e-86d）实现了 Boss 的多边形/圆弧绘制，修改了 `enemy.js` 的 Layer 1 和 Layer 5。

冲突解决策略：将两个 PR 的修改合并为统一的条件判断：
- 去掉 `type === 'boss'` 限制，改为通用的 `collisionShape === 'polygon'` 判断（Boss 和随从均适用）
- 保留 Boss 专用的 `arc` 圆弧分支（`type === 'boss' && collisionShape === 'arc'`）
- 默认分支仍使用 `roundRect`/`strokeRect`
