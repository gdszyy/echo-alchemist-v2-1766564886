---
id: "PI-010"
version: "v1.0"
last_updated: "2026-06-25"
author: "pixijs_migration_phase1-3"
related_modules: ["render_system", "particles", "combat_system", "spawn_system", "game_phase", "pixi_bridge", "pixi_effect_adapter"]
status: "active"
---

# PI-010: PixiJS WebGL 渲染管线迁移流程与防坑指南

## 流程概述

将 Echo Alchemist V2 的粒子系统与特效对象从 Canvas 2D 渲染路径迁移至 PixiJS 7.4.2 WebGL 管线。迁移采用**双 Canvas 叠加 + 适配器模式 + Canvas 2D Fallback** 架构，分 5 阶段推进。本洞察记录迁移过程中的关键耦合点、隐蔽陷阱和维护规范。

## 核心架构

### 双 Canvas 叠加

PixiJS 透明 WebGL Canvas 叠加在原有 Canvas 2D 之上。当 `pixiIsActive()` 返回 `true` 时，特效的 `draw(ctx)` 方法在适配器同步完成后直接 `return`，跳过 Canvas 2D 绘制路径。

### 适配器三函数模式

每种特效类对应三个适配器函数：

| 函数 | 职责 | 调用时机 |
|------|------|---------|
| `xxx_pixiCreate(effect)` | 创建 PIXI 显示对象（Sprite / Graphics / Container） | `draw()` 中首次检测到 `_pixi === null` 时 |
| `xxx_pixiSync(effect, adapter)` | 从游戏对象属性同步到 PIXI 对象（位置/旋转/缩放/透明度） | 每帧 `draw()` 调用 |
| `xxx_pixiDestroy(adapter)` | 销毁 PIXI 对象、释放纹理引用 | 特效从数组移除（splice）或 compaction 循环中 |

### 生命周期清理模式

特效对象从数组移除时，必须在 splice 之前调用 `_pixiDestroy`：

```js
// 专用数组 splice 模式
for (let i = arr.length - 1; i >= 0; i--) {
    if (arr[i].life <= 0) {
        if (arr[i]._pixi) { xxx_pixiDestroy(arr[i]._pixi); arr[i]._pixi = null; }
        arr.splice(i, 1);
    }
}

// 粒子 compaction 循环模式（特效存储在 particles 数组中）
if (p._pixi) {
    if (p instanceof LaserBeam) { laserBeam_pixiDestroy(p._pixi); }
    else if (p instanceof SlashEffect) { slashEffect_pixiDestroy(p._pixi); }
    // ... 其他 instanceof 分支
    p._pixi = null;
}
```

## 核心防坑指南

### 坑 1: 粒子 compaction 循环中的 instanceof 遗漏

**现象**：特效对象生命周期结束后，PixiJS 显示对象残留在 WebGL 场景中，造成视觉残影或内存泄漏。

**根因**：`game_phase.js` 中有两处 compaction 循环（战斗 ~L3122 和研磨 ~L3992），使用 `instanceof` 判断粒子数组中的对象类型来调用对应的 `_pixiDestroy`。新增特效适配器后如果忘记在 compaction 循环中添加对应的 `instanceof` 分支，清理逻辑不会被执行。

**正确做法**：每次新增特效适配器时，必须同时更新以下位置：
1. `game_phase.js` 两处 compaction 循环的 `instanceof` 分支链
2. 如果特效存储在专用数组中，在该数组的 splice 位置添加 `_pixiDestroy` 调用
3. `game_phase.js` 顶部的 `import` 语句中添加新的 `_pixiDestroy` 导入

**关键位置**：`src/game_phase.js` → 搜索 `_pixiDestroy` 和 `instanceof`

---

### 坑 2: 粒子模式 Sprite 同步属性不通用

**现象**：wind_slash / line 粒子使用默认 Sprite 同步逻辑后，视觉表现错误（方向不对、形状变形、颜色异常）。

**根因**：标准粒子同步使用均匀缩放 + `p.angle` 旋转 + `pixiCssColor(p.color)` tint。但 wind_slash / line 是特殊粒子：
- 旋转方向应基于速度向量 `Math.atan2(vel.y, vel.x)` 而非 `p.angle`
- 缩放应为非均匀（wind_slash 根据速度拉伸）
- 纹理是预彩色的（3-stop 渐变已烘焙在纹理中），不应再上 tint

**正确做法**：在 compaction 循环的 `_pixiSprite` 同步块中，对特殊模式单独处理：

```js
if (p._pixiSprite) {
    const sp = p._pixiSprite;
    sp.x = p.pos.x;
    sp.y = p.pos.y;
    sp.alpha = Math.max(0, p.life);
    if (p.mode === 'wind_slash') {
        const speed = p.vel ? Math.hypot(p.vel.x, p.vel.y) : 0;
        sp.rotation = speed > 0.1 ? Math.atan2(p.vel.y, p.vel.x) : 0;
        const stretch = Math.min(3.0, 1.0 + speed * 0.1);
        const baseScale = (p.size || 10) / 32;
        sp.scale.set(baseScale * stretch, baseScale);
        // 不设 tint — 纹理已预彩色
    } else if (p.mode === 'line') {
        const speed = p.vel ? Math.hypot(p.vel.x, p.vel.y) : 0;
        sp.rotation = speed > 0.1 ? Math.atan2(p.vel.y, p.vel.x) : 0;
        sp.scale.set(p.scale ? p.scale.x : 1, p.scale ? p.scale.y : 1);
        // 不设 tint
    } else {
        // 标准粒子同步
        const sz = (p.size || 4) * 2.5;
        sp.scale.set(sz / 64, sz / 64);
        sp.rotation = p.angle || 0;
        sp.tint = pixiCssColor(p.color);
    }
}
```

**关键位置**：`src/game_phase.js` → compaction 循环中的 `_pixiSprite` 同步块

---

### 坑 3: 粒子模式 blendMode 与 Canvas 2D 不一致

**现象**：wind_slash 粒子在 PixiJS 中使用了 `BLEND_MODES.ADD`，但 Canvas 2D 原始代码使用的是 `globalCompositeOperation = 'screen'`，导致视觉效果不一致。

**根因**：`pixiAcquireParticleSprite()` 默认为所有粒子模式设置 `BLEND_MODES.ADD`，但不同粒子模式在 Canvas 2D 中可能使用不同的混合模式。

**正确做法**：在 `pixi_bridge.js` 的 `pixiAcquireParticleSprite()` 中按模式设置正确的 blendMode：

```js
sprite.blendMode = (mode === 'wind_slash')
    ? PIXI.BLEND_MODES.SCREEN
    : PIXI.BLEND_MODES.ADD;
```

**关键位置**：`src/render/pixi_bridge.js` → `pixiAcquireParticleSprite()`

---

### 坑 4: 特效对象与粒子对象的 _pixi / _pixiSprite 区分

**现象**：混淆使用 `_pixi` 和 `_pixiSprite`，导致清理逻辑错误或 Sprite 泄漏。

**根因**：
- **粒子对象**（`Particle` 类的实例，存储在 `game.particles` 数组中）使用 `_pixiSprite` 属性，通过对象池 `pixiAcquireParticleSprite` / `pixiReleaseParticleSprite` 管理
- **特效对象**（`IceWave`、`DeathExplosion`、`SlashEffect` 等类的实例）使用 `_pixi` 属性，通过适配器三函数 `_pixiCreate` / `_pixiSync` / `_pixiDestroy` 管理
- 某些特效（如 `LaserBeam`、`SlashEffect`、`PierceCutEffect`、`SwordScar`、`BladeStormVortex`）虽然存储在 `game.particles` 数组中，但它们使用 `_pixi` 而非 `_pixiSprite`

**正确做法**：在 compaction 循环中，先检查 `_pixiSprite`（粒子），再检查 `_pixi`（存储在粒子数组中的特效对象），两者互不干扰。

**关键位置**：`src/game_phase.js` → compaction 循环

---

### 坑 5: BladeStormRing 类已定义但从未实例化

**现象**：为 BladeStormRing 添加了完整的适配器（_pixiCreate/_pixiSync/_pixiDestroy）和 draw() 钩子，但运行时永远不会触发。

**根因**：`BladeStormRing` 类在 `particles.js` 中定义并导出，在 `game_phase.js` 中导入，但全项目没有任何 `new BladeStormRing()` 调用。该类可能是预留但未实现的特效。

**影响**：无害。适配器代码和钩子已防御性地添加，如果未来有代码实例化 BladeStormRing，PixiJS 路径会自动生效。无需添加 splice 清理逻辑。

---

### 坑 6: SwordQi 不需要 PixiJS 清理

**现象**：尝试为 `swordQis` 数组添加 `_pixiDestroy` 清理时发现该类没有 `_pixi` 属性。

**根因**：`SwordQi` 类未接入 PixiJS 迁移（没有 `_pixi = null` 构造函数属性，也没有 draw() 钩子）。它是 Canvas 2D-only 的特效。

**影响**：无需处理。`swordQis` 数组的 splice 不需要 PixiJS 清理逻辑。

---

### 坑 7: 预烘焙纹理的形状准确性

**现象**：使用通用圆形发光纹理替代 wind_slash / line 粒子后，视觉效果丢失了原有的形状特征（梭形/刀片形 vs 圆形）。

**根因**：阶段二初始实现为所有粒子模式统一使用圆形发光纹理。但 wind_slash 和 line 模式在 Canvas 2D 中绘制的是特定形状（梭形曲线 / 细长线段），通用纹理无法表达。

**正确做法**：在 `pixi_bridge.js` 的预烘焙纹理初始化中，为特殊模式创建形状准确的纹理：
- `wind_slash`：使用 `quadraticCurveTo` 绘制梭形轮廓 + 水平线性渐变
- `line`：使用 `lineTo` + `round` lineCap 绘制细长线 + 水平线性渐变

**关键位置**：`src/render/pixi_bridge.js` → `_bakedTextures` 初始化块

## 关键耦合点

1. **`pixi_bridge.js` ↔ `pixi_effect_adapter.js`**：bridge 提供 `pixiIsActive()` 和纹理基础设施，adapter 依赖 bridge 的 PIXI 实例和预烘焙纹理
2. **`particles.js` ↔ `pixi_effect_adapter.js`**：每个特效类的构造函数初始化 `this._pixi = null`，draw() 方法入口检查 `pixiIsActive()` 并调用适配器
3. **`game_phase.js` ↔ `pixi_effect_adapter.js`**：game_phase 的 compaction 循环和 splice 位置导入并调用所有 `_pixiDestroy` 函数
4. **`render_system.js` ↔ `pixi_effect_adapter.js`**：floatingTexts 的 splice 位置导入并调用 `floatingText_pixiDestroy`
5. **`spawn_system.js` ↔ `pixi_bridge.js`**：`spawn_createParticle` 和 `spawn_pushParticleWithLimit` 为特定粒子模式调用 `pixiAcquireParticleSprite()`

## 文件修改清单

| 文件 | 修改类型 | 说明 |
|------|---------|------|
| `src/render/pixi_bridge.js` | 新建 | PixiJS 初始化、Canvas 叠加、预烘焙纹理、粒子 Sprite 对象池 |
| `src/render/pixi_effect_adapter.js` | 新建 | 20 种特效的适配器三函数 |
| `src/effects/particles.js` | 修改 | 所有特效类添加 `_pixi = null` + draw() 钩子 |
| `src/game_phase.js` | 修改 | import 扩展 + compaction 循环扩展 + 9 处 splice 清理 |
| `src/render_system.js` | 修改 | floatingText splice 清理 |
| `src/spawn_system.js` | 修改 | 粒子模式 Sprite 获取条件扩展 |
| `src/core.js` | 修改 | PixiJS 初始化接入 |
| `src/game_system.js` | 修改 | 主循环/resize/visibility 集成 |

## 版本变更日志

| 版本 | 日期 | 变更内容 | 作者 |
|------|------|---------|------|
| v1.0 | 2026-06-25 | 初始记录：阶段一～三迁移完成，7 个坑位、20 种特效适配器、26 项性能瓶颈标记 | pixijs_migration |
