---
description: "effects 模块的设计规范与核心逻辑说明"
globs: ["src/effects/**/*"]
---

# effects 模块规范

## 1. 模块职责

`effects` 模块负责游戏中所有**视觉特效**的生命周期管理与渲染，位于 `src/effects/particles.js`。

该模块从 `entities.js` 中拆分而来（Task 2.1），**零依赖**于任何游戏逻辑模块（无 `CONFIG`、无 `audio`），仅依赖 `src/utils/math_utils.js` 中的 `Vec2` 和 `lerp`。所有特效类均通过 `update(timeScale)` + `draw(ctx)` 接口驱动，由 `Game` 主循环统一调度。

## 2. 核心数据模型 / API 接口

### 2.1 特效类一览

| 类名 | 构造函数签名 | 说明 |
|------|------------|------|
| `Particle` | `(x, y, color, mode='normal')` | 通用粒子，支持 8 种物理模式 |
| `SlashEffect` | `(x, y, angle, length, color)` | 斩击弧线特效 |
| `CollectionBeam` | `(x, bottomY)` | 收集阶段的光柱特效 |
| `Shockwave` | `(x, y, color)` | 圆形冲击波扩散环 |
| `LaserBeam` | `(segments, width, color, isContinuous=false)` | 激光光束（折线段渲染） |
| `FloatingText` | `(x, y, text, color='#fbbf24', fontSize=16)` | 浮动伤害/提示文字 |
| `EnergyOrb` | `(x, y, targetX, targetY, color, initialVel, onArrive)` | 飞行能量球（到达目标后触发回调） |
| `LightningBolt` | `(x1, y1, x2, y2)` | 闪电链（锯齿折线） |
| `FireWave` | `(x, y)` | 火焰波扩散环 |
| `IceWave` | `(x, y)` | 冰霜波扩散环 |
| `DeathExplosion` | `(x, y, tier='normal')` | 死亡爆炸（三档：normal/elite/boss） |
| `HealWave` | `(x, y, range=120)` | 治愈波纹（绿色扩散） |
| `BladeStormRing` | `(x, y, radius)` | 刀刃风暴旋转环 |
| `SwordScar` | `(x, y)` | 剑痕残影（斜线淡出） |

### 2.2 Particle 的 8 种物理模式（mode 参数）

| mode | 物理特征 | 典型用途 |
|------|---------|---------|
| `normal` | 四向随机速度，中等阻力 | 通用碎片 |
| `spark` | 高速爆发，轻重力，快速衰减 | 命中火花 |
| `ember` | 向上漂浮，微重力，横向摇摆 | 火焰余烬 |
| `mist` | 慢速下沉，大体积，半透明 | 烟雾/爆炸残留 |
| `shard` | 四向爆发，中等重力，随机旋转拉伸 | 冰晶碎片 |
| `smoke` | 向上漂移，缓慢衰减 | 普通烟雾 |
| `line` | 静止，快速衰减 | 线条残影 |
| `wind_slash` | 外部设置速度，无阻力 | 风刃粒子 |

### 2.3 DeathExplosion 的三档 tier

| tier | 视觉特征 | 适用对象 |
|------|---------|---------|
| `normal` | 内缩消散，1~2 缕烟尘 | 普通敌人 |
| `elite` | 紫色能量环内缩 + 虚空孔洞（`voidMaxRadius=18`） | 精英敌人 |
| `boss` | 先膨胀（`expandMax=80`）再内爆，三重收缩环，虚空涡旋，18 颗灵魂粒子 | Boss |

### 2.4 EnergyOrb 回调机制

`EnergyOrb` 在到达目标坐标时调用 `onArrive()` 回调，用于触发治疗、充能等游戏逻辑。回调在 `update()` 内部检测到 `dist < threshold` 时执行，**回调函数必须是幂等的**（防止多帧触发）。

## 3. 状态流转 / 业务规则

### 3.1 特效生命周期

所有特效类均遵循统一的生命周期模型：

```
构造（初始化物理参数）
  → update(timeScale) 循环（每帧递减 life / 推进动画状态）
    → 当 life <= 0 时标记为失活（active = false 或 life <= 0）
      → Game 主循环过滤并移除失活特效
```

`timeScale` 由 `Game` 主循环传入，用于支持慢动作/加速效果。

### 3.2 Particle 湍流机制

当 `particle.turbulence > 0` 时，每帧在垂直于速度方向产生正弦波动，模拟气流扰动。外部设置 `turbulence` 值可控制粒子轨迹的随机抖动强度。

### 3.3 LaserBeam 连续模式

`isContinuous=true` 时，激光光束不会随 `life` 衰减，需由外部调用 `setSegments()` 更新折线段数据，并在激光停止时手动调用 `deactivate()` 触发淡出。

### 3.4 元素聚变特效规范

元素聚变（`elemental_fusion`）触发时，需按以下顺序创建特效（来自 `damage_calc.js` 的实现规范）：
1. 三重冲击波（橙/青/紫粉，`Shockwave`）
2. 三属性粒子爆发（火焰 spark × 16 + 冰晶 shard × 16 + 雷电 spark × 16）
3. 白色核心爆发（spark × 10）
4. 三色烟雾残留（mist × 6 + mist × 6）

## 4. 禁止行为

- **严禁**在 `particles.js` 中引入任何游戏逻辑依赖（`CONFIG`、`audio`、`eventBus` 等），该文件必须保持零依赖于游戏逻辑。
- **严禁**在特效类的 `update()` 中直接修改 `Game` 实例状态，所有游戏逻辑触发必须通过 `EnergyOrb.onArrive()` 等回调机制传递。
- **严禁**在 `DeathExplosion` 之外自行实现死亡爆炸逻辑，新增敌人等级必须扩展 `tier` 参数而非另写独立特效类。
- **严禁**直接修改 `Particle.life` 为负值来强制销毁粒子，应通过加大 `decay` 值使其自然衰减。

## 5. 详细设计文档索引

- 函数级索引：[auto_index/src_effects_particles_js_index.md](auto_index/src_effects_particles_js_index.md)
- 性能规范（粒子数量上限）：[performance.md](performance.md)
- 实体系统（特效的创建入口）：[entities.md](entities.md)
