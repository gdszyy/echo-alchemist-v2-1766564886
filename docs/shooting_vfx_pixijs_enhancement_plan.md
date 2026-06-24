# 开炮视觉特效 PixiJS 增强方案

> **版本**：1.0.0  
> **日期**：2026-06-25  
> **状态**：方案设计（待评审）  
> **前置依赖**：PixiJS 迁移阶段一~三 ✅、阶段五 ✅

---

## 一、现状分析

### 1.1 当前开炮视觉链路

开炮时的视觉反馈由以下模块协作完成：

```
fireNextShot()  [game_phase.js]
  ├─ audio.playShoot()                    ← 三层音效合成（正弦低音 + 采样核心 + 瞬态 + 噪声）
  ├─ render_queueLauncherBarrelFireEffect() ← 压入枪口闪光队列（最多 4 条）
  ├─ combat_createProjectile()            ← 创建子弹实体（含拖尾数据初始化）
  └─ triggerScreenShake() / Advanced()    ← 屏幕震动（仅命中/击杀时触发，开炮本身无震动）
```

每帧渲染顺序：

```
render_combat_launcherEmitterBase()  [render_system.js]
  ├─ 炮管旋转绘制（aimRotation）
  ├─ 后坐力偏移（recoilY = sin(π·reloadProgress) × 4px）
  ├─ 冷却热辉余烬层（径向渐变，screen 混合，持续 700-900ms）
  └─ 发射火光层（爆发泛光 + 冲击光锥 + 美术帧叠加，持续 150-210ms）
```

### 1.2 当前瓶颈与局限

| 维度 | 现状 | 问题 |
|------|------|------|
| **枪口火光** | 纯 Canvas 2D 三层渐变 + 美术帧 | `createRadialGradient` + `shadowBlur` 是 Canvas 2D 最昂贵的操作之一；开幕齐射 intensity=1.65 时辉光更重 |
| **子弹拖尾** | `_drawTrail()` 逐点线段 + `globalAlpha` 渐变 | 高强度子弹用 `lighter` 混合模式 + 核心亮线，每帧重绘全部轨迹点；最长 22 个点 × 多子弹 = 大量 draw call |
| **开炮冲击感** | 仅后坐力 4px 正弦偏移 | 无径向冲击波、无空气扭曲、无炮口碎片飞溅、开炮本身不触发屏幕震动 |
| **弹道光照** | 无 | 子弹飞行不产生动态光照，无法照亮周围 Peg/敌人/墙壁 |
| **开幕齐射** | 仅 intensity 系数放大 | 视觉上与普通射击差异不够显著，缺乏"齐射仪式感" |

### 1.3 已有 PixiJS 基础设施

当前 PixiJS 层已迁移 8 种粒子模式 + 18 种特效适配器，提供以下可复用能力：

- **ParticleContainer GPU 批渲染**：同模式粒子共享 1 次 draw call
- **预烘焙纹理**：18 张启动时一次性创建，运行时零 GC
- **Sprite 对象池**：动态增长复用，避免频繁分配
- **特效适配器三函数模式**：`_pixiCreate` / `_pixiSync` / `_pixiDestroy`
- **PIXI.Graphics**：支持 3-pass 辉光（外发光 → 中间层 → 核心）

---

## 二、优化目标

### 2.1 核心目标

将开炮视觉体验从"Canvas 2D 基础渐变"升级为"PixiJS WebGL 沉浸式打击感"，在以下四个维度实现质变：

1. **枪口火光**：从静态三层渐变升级为动态多层粒子爆发 + 动态光照
2. **子弹拖尾**：从逐点线段升级为 GPU 批渲染渐变带 + 属性色带
3. **冲击波/爆发感**：新增径向冲击环、炮口碎片飞溅、空气扭曲暗示
4. **开炮屏幕反馈**：新增开炮震动（尤其是开幕齐射）、边缘闪光

### 2.2 设计原则

- **增量叠加**：不替换现有 Canvas 2D 路径，新增 PixiJS 增强层叠加在上方
- **三档门控**：所有新增效果必须在 high/medium/low 三档都有对应策略
- **零 GC 运行时**：新纹理在启动时预烘焙，Sprite 走对象池
- **保留 fallback**：Canvas 2D 完整路径保留，PixiJS 失效时自动降级
- **性能可控**：新增特效受 `CONFIG.performance` 预算控制，可独立关闭/降级

---

## 三、分阶段实施计划

### 阶段 A：枪口火光增强（Muzzle Flash V2）

**目标**：将枪口火光从 Canvas 2D 三层渐变升级为 PixiJS 多层粒子爆发。

#### A.1 新增预烘焙纹理（3 张）

在 `pixi_bridge.js` 的 `_initBakedTextures()` 中新增：

| 纹理名 | 尺寸 | 视觉 | 用途 |
|--------|------|------|------|
| `muzzleCore` | 128×128 | 白热核心 → 元素色 → 透明的 5-stop 径向渐变 | 枪口中心爆发光球 |
| `muzzleFlare` | 256×64 | 沿 X 轴拉长的锥形光焰，3-stop 线性渐变 | 枪口方向性光锥 |
| `muzzleSpark` | 16×16 | 明亮小圆点，带 1px 硬边 | 枪口碎片/火星粒子 |

#### A.2 新增特效类：`MuzzleFlashV2`

**位置**：`src/effects/particles.js`

```js
export class MuzzleFlashV2 {
    constructor(x, y, angle, elementColor, intensity = 1.0) {
        this.x = x;
        this.y = y;
        this.angle = angle;        // 炮管朝向角度（弧度）
        this.elementColor = elementColor;
        this.intensity = intensity; // 开幕齐射 1.65，普通 1.0
        this.life = 1.0;
        this.maxLife = intensity > 1.3 ? 0.9 : 0.7; // 秒
        this.flashPhase = intensity > 1.3 ? 0.21 : 0.15; // 高光持续时间

        // PixiJS 显示对象
        this._pixi = null;
        this._pixiCreate();
    }
}
```

**PixiJS 适配器**（`pixi_effect_adapter.js`）结构：

```
_pixi 对象层级：
  PIXI.Container
    ├─ coreSprite (muzzleCore 纹理, ADD 混合)
    │    缩放：0.3 → 1.2 × intensity（前 30% 生命周期）→ 衰减至 0
    │    tint：#fff → elementColor → 暗红
    ├─ flareSprite (muzzleFlare 纹理, ADD 混合)
    │    rotation：锁定 angle
    │    scaleX：0.5 → 2.0 × intensity（前 20% 生命周期）→ 衰减
    │    alpha：1.0 → 0
    ├─ sparkPool (PIXI.ParticleContainer, 复用 muzzleSpark 纹理)
    │    数量：8 × intensity（向上取整）
    │    初速：随机 100~300 px/s，方向 = angle ± 25°
    │    生命周期内线性衰减 alpha + scale
    └─ heatSprite (muzzleCore 纹理, SCREEN 混合)
         仅在 flashPhase 结束后可见
         缓慢膨胀 + 缓慢变暗，模拟冷却热辉
```

**三档策略**：

| 档位 | 核心光球 | 方向光锥 | 火星粒子数 | 冷却热辉 |
|------|---------|---------|-----------|---------|
| high | 128px + tint 动画 | 256px + 拉伸动画 | 8~13 个 | 完整保留 |
| medium | 96px + 简化 tint | 192px | 4~6 个 | 保留（无 tint 动画） |
| low | 64px 单帧 | 关闭 | 0 | 关闭 |

#### A.3 集成点

修改 `render_system.js` 的 `render_queueLauncherBarrelFireEffect()`：

```js
render_queueLauncherBarrelFireEffect(vel, recipe) {
    // ... 现有的 Canvas 2D 队列逻辑保留不变 ...

    // 新增：PixiJS 增强层
    if (pixiIsActive()) {
        const { muzzleX, muzzleY } = this._calcMuzzlePosition(vel);
        const angle = Math.atan2(vel.y, vel.x) - Math.PI / 2;
        const color = this._getElementColor(recipe);
        const intensity = this._openingSalvo ? 1.65 : 1.0;
        this.muzzleFlashes.push(new MuzzleFlashV2(muzzleX, muzzleY, angle, color, intensity));
    }
}
```

Canvas 2D 路径**不删除**，当 `pixiIsActive()` 为 `false` 时继续生效。`MuzzleFlashV2` 的 `draw(ctx)` 中直接 return（PixiJS 激活时跳过 Canvas 2D 绘制）。

---

### 阶段 B：子弹拖尾增强（Trail V2）

**目标**：将子弹拖尾从 Canvas 2D 逐点线段升级为 PixiJS GPU 批渲染渐变带。

#### B.1 新增粒子模式：`trail`

在 `pixi_bridge.js` 中新增第 9 个 ParticleContainer：

```js
// 模式 'trail'：子弹拖尾专用
// 纹理：复用现有 'line' 纹理（64×16 细长水平线），或新增 64×8 渐变线纹理
// 混合模式：ADD
// 特性：支持 position + rotation + scale + alpha + tint
```

**纹理选择**：复用现有 `line` 纹理（64×16），通过旋转对齐运动方向，非均匀 `scaleX` 拉伸实现变宽拖尾。

#### B.2 拖尾渲染逻辑升级

当前 `_drawTrail()` 逐帧重绘全部轨迹点（最多 22 个）。升级为：

```
旧流程：
  每帧 → ctx.beginPath() → 遍历 trail[] → lineTo() → stroke()
  问题：每帧 22 次 lineTo + stroke，高强度子弹还有 lighter 混合 + 核心亮线

新流程（PixiJS 激活时）：
  创建时：为每个 trail 点分配一个 Sprite（从 pool 获取）
  每帧 sync：
    1. trail[0]（最新点）→ Sprite alpha=0.8, scaleX=1.0, tint=元素色
    2. trail[n]（越旧）→ Sprite alpha 线性衰减, scaleX 缩小
    3. 超出 trail 长度的 Sprite → 释放回 pool
  优势：GPU 批渲染，22 个点 = 1 次 draw call（而非 22 次 Canvas stroke）
```

**关键参数映射**：

| 现有属性 | PixiJS 映射 |
|---------|------------|
| trail 点位置 | Sprite.x / Sprite.y |
| trail 点方向 | Sprite.rotation = atan2(dy, dx) |
| trail 点粗细 | Sprite.scaleX = 线宽 / 16（纹理宽度）, scaleY = 段长 / 64 |
| trail 点透明度 | Sprite.alpha（越旧越低） |
| 元素属性色 | Sprite.tint |
| S 级子弹亮度 | blendMode: ADD（默认）vs NORMAL（低强度） |

#### B.3 拖尾宽度动态变化

当前拖尾宽度固定（按元素类型微调）。升级为基于子弹速度动态变宽：

```js
const speed = Math.sqrt(vx * vx + vy * vy);
const trailWidth = baseWidth * (0.5 + 0.5 * Math.min(1, speed / 800));
```

高速子弹拖尾更宽更有冲击感，低速子弹拖尾收窄更细腻。

#### B.4 开幕齐射拖尾增强

开幕齐射的子弹获得"金色拖尾"特殊效果：

```js
if (this._openingSalvo) {
    sprite.tint = 0xFFD700; // 金色 tint 覆盖
    sprite.alpha *= 1.3;    // 更亮
    // 额外分配一个 trail 长度的 1.5 倍长的 ghost sprite（低透明度）
}
```

#### B.5 三档策略

| 档位 | 最大拖尾点数 | 拖尾宽度 | 速度动态 | 开幕齐射增强 |
|------|------------|---------|---------|------------|
| high | 22（现有上限） | 完整 | 启用 | 金色 + ghost |
| medium | 14 | 80% | 启用 | 仅金色 |
| low | 6 | 50% | 关闭 | 关闭 |

---

### 阶段 C：开炮冲击波与爆发感（Firing Burst）

**目标**：新增开炮瞬间的径向冲击环、炮口碎片飞溅和空气扭曲暗示。

#### C.1 新增特效类：`FiringBurst`

**位置**：`src/effects/particles.js`

```js
export class FiringBurst {
    constructor(x, y, angle, elementColor, intensity = 1.0) {
        this.x = x;
        this.y = y;
        this.angle = angle;
        this.elementColor = elementColor;
        this.intensity = intensity;
        this.life = 1.0;
        this.maxLife = 0.4; // 秒 — 冲击波生命周期很短

        this._pixi = null;
        this._pixiCreate();
    }
}
```

**PixiJS 适配器**结构：

```
_pixi 对象层级：
  PIXI.Container
    ├─ ringGraphics (PIXI.Graphics)
    │    径向扩散环：从 muzzle 点向外扩散
    │    初始半径 10px → 最终半径 80 × intensity
    │    线宽 4 → 0.5（衰减）
    │    颜色：elementColor → 透明
    │    alpha：0.8 → 0
    ├─ coneGraphics (PIXI.Graphics)
    │    方向性冲击锥：沿 angle 方向的扇形气流
    │    角度范围 ±15°，距离 60 × intensity
    │    填充：径向渐变 elementColor → 透明
    │    alpha：0.5 → 0（前 30% 生命周期）
    └─ debrisSprites (PIXI.ParticleContainer, muzzleSpark 纹理)
         数量：6 × intensity
         初速：200~500 px/s，方向 = angle ± 40°
         带重力下落（gravity = 400 px/s²）
         旋转速度随机
         alpha + scale 衰减
```

#### C.2 开炮屏幕震动

当前开炮本身不触发屏幕震动。新增：

```js
// game_phase.js — fireNextShot() 中
if (this._openingSalvo) {
    this.triggerScreenShake(3);              // 开幕齐射：3px 震动
    this.triggerScreenShakeAdvanced(2, 8);   // + 高频震动 8 帧
} else if (recipe?.attributes?.includes('explosive')) {
    this.triggerScreenShake(1.5);            // 爆炸弹：轻微震动
}
```

#### C.3 开炮边缘闪光（Screen Flash）

新增一个极简的全屏闪光效果，仅在开炮的前 2 帧可见：

```js
// render_system.js 中新增
if (this._fireFlashFrames > 0) {
    const alpha = this._fireFlashFrames / 2 * 0.08; // 最大 8% 透明度
    ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
    ctx.fillRect(0, 0, w, h);
    this._fireFlashFrames--;
}
```

开幕齐射时 alpha 翻倍（16%），配合元素色 tint。

#### C.4 三档策略

| 档位 | 冲击环 | 方向锥 | 碎片粒子数 | 屏幕震动 | 边缘闪光 |
|------|-------|-------|-----------|---------|---------|
| high | 完整 | 完整 | 6~10 | 完整 | 完整 |
| medium | 简化（无渐变） | 关闭 | 3~5 | 保留 | 保留 |
| low | 关闭 | 关闭 | 0 | 保留（减半幅度） | 关闭 |

---

### 阶段 D：弹道光照与环境反馈（Ambient Lighting）

**目标**：子弹飞行时产生微弱的动态光照，照亮附近的 Peg 和敌人。

#### D.1 轻量光照方案

不做完整的光照计算。使用预烘焙的径向光照纹理叠加在子弹位置：

```js
// 新增预烘焙纹理：'bulletGlow'
// 尺寸 128×128，柔和径向渐变，白色 → 透明
// 混合模式：ADD，低透明度（0.04~0.08）

// 每帧 sync：
bulletGlowSprite.x = projectile.x;
bulletGlowSprite.y = projectile.y;
bulletGlowSprite.tint = elementColor;
bulletGlowSprite.alpha = 0.04 + 0.02 * tierStat; // 高强度子弹略亮
bulletGlowSprite.scale.set(0.8 + 0.2 * tierStat);
```

#### D.2 命中闪光

子弹命中敌人时产生一次短暂的光照脉冲：

```js
// 命中瞬间：bulletGlowSprite.alpha 跳至 0.2 → 在 6 帧内衰减至 0
// 配合现有的敌人 hitTimer 和 spark 粒子
```

#### D.3 三档策略

| 档位 | 弹道光照 | 命中闪光 | 光照范围 |
|------|---------|---------|---------|
| high | 启用 | 启用 | 128px |
| medium | 启用 | 关闭 | 96px |
| low | 关闭 | 关闭 | — |

---

## 四、性能预算评估

### 4.1 新增 GPU 开销估算

| 新增项 | draw call 增量 | 纹理内存 | Sprite 池增量 |
|--------|--------------|---------|-------------|
| MuzzleFlashV2（每次开炮） | +2~3 | +3 张（~100KB） | +4~6/次（瞬态） |
| Trail V2（每颗子弹） | 0（复用 ParticleContainer） | 0（复用 line） | +22/子弹（峰值） |
| FiringBurst（每次开炮） | +1~2 | 0（Graphics 绘制） | +6~10/次（瞬态） |
| 弹道光照（每颗子弹） | 0（复用 ParticleContainer 或 1 Graphics） | +1 张（~64KB） | +1/子弹 |

**最坏情况估算**（high 档，同时 10 颗子弹在场 + 开幕齐射）：

- 额外 draw call：~5（MuzzleFlashV2 × 1 + FiringBurst × 1 + Trail 批渲染 × 1 + 弹道光照 × 1 + Graphics × 1）
- 额外 Sprite 峰值：~260（22×10 trail + 6 debris + 4 muzzle + 10 glow）
- 额外纹理内存：~164KB（3 张预烘焙）

**与现有预算对比**：

- 当前 ParticleContainer 上限 800 粒子（high），新增 trail 占用约 220 → 需提升上限至 ~1100 或为 trail 开独立容器
- 当前 Sprite 池上限 ~200，新增 trail 后峰值 ~460 → 需扩展池上限

### 4.2 CONFIG.performance 新增字段

```js
// 建议新增以下配置项
muzzleFlashV2: true,          // 枪口火光 V2 总开关
muzzleFlashV2Sparks: [13, 6, 0],  // [high, medium, low] 火星粒子数
trailV2: true,                // 拖尾 V2 总开关
trailV2MaxLength: [22, 14, 6],   // 三档拖尾最大长度
firingBurst: true,            // 开炮冲击波总开关
firingBurstDebris: [10, 5, 0],  // 三档碎片数
firingScreenShake: true,      // 开炮屏幕震动
firingScreenFlash: true,      // 开炮边缘闪光
bulletGlow: true,             // 弹道光照总开关
bulletGlowRadius: [128, 96, 0],  // 三档光照半径
```

---

## 五、实施优先级与依赖关系

```
阶段 A（枪口火光 V2） ← 独立，可优先实施，视觉冲击力最大
    │
    ├─ A.1 预烘焙纹理
    ├─ A.2 MuzzleFlashV2 类 + 适配器
    └─ A.3 集成到 render_system.js

阶段 B（拖尾 V2） ← 依赖 trail ParticleContainer 新增
    │
    ├─ B.1 新增 ParticleContainer
    ├─ B.2 拖尾 Sprite 同步逻辑
    └─ B.5 三档配置

阶段 C（冲击波/爆发感） ← 依赖阶段 A 的 muzzleSpark 纹理
    │
    ├─ C.1 FiringBurst 类 + 适配器
    ├─ C.2 开炮屏幕震动
    └─ C.3 边缘闪光

阶段 D（弹道光照） ← 独立，可最后实施，视觉增益最微妙
    │
    ├─ D.1 bulletGlow 纹理
    └─ D.2 命中闪光
```

**推荐实施顺序**：A → C → B → D

理由：A 和 C 组合后即可获得最显著的"开炮打击感"提升；B 的改造涉及拖尾架构变更（从 draw 函数到 Sprite 同步），风险较高；D 是最微妙的增强，适合锦上添花。

---

## 六、文件修改清单

| 文件 | 修改类型 | 内容 |
|------|---------|------|
| `src/render/pixi_bridge.js` | 修改 | 新增 3~4 张预烘焙纹理、新增 `trail` ParticleContainer、扩展 Sprite 池上限 |
| `src/effects/particles.js` | 修改 | 新增 `MuzzleFlashV2`、`FiringBurst` 类（含 Canvas 2D fallback） |
| `src/effects/pixi_effect_adapter.js` | 修改 | 新增 `MuzzleFlashV2`、`FiringBurst` 的 `_pixiCreate/_pixiSync/_pixiDestroy` 适配器 |
| `src/render_system.js` | 修改 | `render_queueLauncherBarrelFireEffect()` 新增 PixiJS 分支、新增 `_fireFlashFrames` 逻辑、`MuzzleFlashV2` 生命周期管理 |
| `src/entities/projectile.js` | 修改 | `_drawTrail()` 新增 PixiJS 分支（Sprite 同步模式） |
| `src/game_phase.js` | 修改 | compaction 循环新增 `MuzzleFlashV2` / `FiringBurst` 的 instanceof 分支；`fireNextShot()` 新增震动触发 |
| `src/config.js` | 修改 | `CONFIG.performance` 新增 9 个三档配置项 |
| `src/spawn_system.js` | 修改 | 新增 `trail` 模式的 `pixiAcquireParticleSprite` 调用 |
| `.cursor/rules/performance.md` | 修改 | 新增 §5.12 开炮特效增强消费端索引 |
| `.cursor/rules/auto_index/` | 自动更新 | code-indexer 重建受影响文件的索引 |

---

## 七、验收标准

### 7.1 视觉验收

| 编号 | 验收项 | 标准 |
|------|--------|------|
| AC-V1 | 枪口火光 V2 | 开炮瞬间可见多层粒子爆发（核心光球 + 方向光锥 + 火星飞溅），元素色正确，开幕齐射明显更强烈 |
| AC-V2 | 子弹拖尾 V2 | 子弹拖尾为连续渐变带，宽度随速度动态变化，高强度子弹发光更明显 |
| AC-V3 | 开炮冲击波 | 开炮瞬间可见径向扩散环 + 方向性碎片飞溅 |
| AC-V4 | 开炮震动 | 开幕齐射有 3px 震动 + 8 帧高频震动；爆炸弹有轻微震动 |
| AC-V5 | 开幕齐射仪式感 | 金色拖尾 + 更强火光 + 屏幕震动 + 边缘闪光，与普通射击有显著视觉差异 |
| AC-V6 | 弹道光照 | 子弹飞行时有微弱光晕，命中时短暂脉冲 |
| AC-V7 | Canvas 2D 降级 | `pixiIsActive() === false` 时，所有效果回退到现有 Canvas 2D 路径，无崩溃 |

### 7.2 性能验收

| 编号 | 验收项 | 标准 |
|------|--------|------|
| AC-P1 | 帧率影响 | high 档 10 颗子弹同时在场 + 连续开炮，FPS 下降 ≤ 3 |
| AC-P2 | GC 频率 | 5 分钟连续战斗，Major GC 次数不超过迁移前基线 |
| AC-P3 | low 档体验 | 所有新增特效在 low 档均可安全关闭，无残留显示对象 |
| AC-P4 | 内存增长 | 新增纹理总内存 ≤ 200KB；Sprite 池峰值增长 ≤ 300 个 |

### 7.3 兼容性验收

| 编号 | 验收项 | 标准 |
|------|--------|------|
| AC-C1 | Canvas 2D fallback | 移除 PixiJS CDN 后游戏正常运行，开炮视觉等价 |
| AC-C2 | compaction 清理 | MuzzleFlashV2/FiringBurst 生命周期结束后 PixiJS 显示对象正确销毁 |
| AC-C3 | 屏幕震动同步 | 开炮震动与 gameContainer.x/y 和 ctx.translate 同步正确 |

---

## 八、风险与缓解

| 风险 | 影响 | 缓解措施 |
|------|------|---------|
| Trail V2 架构变更引入 bug | 子弹拖尾显示异常 | 保留完整 `_drawTrail()` Canvas 2D 路径作为 fallback；通过 `CONFIG.performance.trailV2` 一键回滚 |
| 新增 Sprite 池压力导致 GC | 帧率抖动 | 扩展池上限至 ~500；trail Sprite 在子弹消亡时批量释放 |
| ParticleContainer 总粒子超限 | 新粒子创建失败 | 为 trail 开独立 ParticleContainer（上限 300），不挤占现有 800 配额 |
| 开幕齐射多效果叠加卡顿 | 瞬间帧率骤降 | 开幕齐射特效受独立上限控制（同时最多 1 个 MuzzleFlashV2 + 1 个 FiringBurst） |
| 阶段四性能验证未做 | 无法量化收益 | 建议先完成阶段四基线测试，再做本优化，以便对比 |

---

## 九、代码示例：MuzzleFlashV2 适配器骨架

```js
// pixi_effect_adapter.js

import { pixiIsActive, pixiGetEffectTexture, pixiGetGameContainer } from '../render/pixi_bridge.js';

// ─── MuzzleFlashV2 ───────────────────────────────────────

export function muzzleFlashV2_pixiCreate(fx) {
    if (!pixiIsActive()) return;
    const container = new PIXI.Container();
    
    // 核心光球
    const coreTex = pixiGetEffectTexture('muzzleCore');
    const coreSprite = new PIXI.Sprite(coreTex);
    coreSprite.anchor.set(0.5);
    coreSprite.blendMode = PIXI.BLEND_MODES.ADD;
    coreSprite.tint = PIXI.utils.string2hex(fx.elementColor);
    container.addChild(coreSprite);

    // 方向光锥
    const flareTex = pixiGetEffectTexture('muzzleFlare');
    const flareSprite = new PIXI.Sprite(flareTex);
    flareSprite.anchor.set(0.1, 0.5); // 从根部发射
    flareSprite.rotation = fx.angle;
    flareSprite.blendMode = PIXI.BLEND_MODES.ADD;
    flareSprite.tint = PIXI.utils.string2hex(fx.elementColor);
    container.addChild(flareSprite);

    // 火星粒子（使用 Graphics 绘制简单圆点，避免额外纹理依赖）
    const sparkGraphics = new PIXI.Graphics();
    container.addChild(sparkGraphics);

    // 冷却热辉
    const heatSprite = new PIXI.Sprite(coreTex);
    heatSprite.anchor.set(0.5);
    heatSprite.blendMode = PIXI.BLEND_MODES.SCREEN;
    heatSprite.alpha = 0;
    heatSprite.tint = PIXI.utils.string2hex(fx.elementColor);
    container.addChild(heatSprite);

    container.x = fx.x;
    container.y = fx.y;

    fx._pixi = {
        container,
        coreSprite,
        flareSprite,
        sparkGraphics,
        heatSprite,
        sparks: _initSparks(fx), // 初始化火星位置和速度
    };

    pixiGetGameContainer().addChild(container);
}

export function muzzleFlashV2_pixiSync(fx, dt) {
    if (!fx._pixi) return;
    const p = fx._pixi;
    const progress = 1 - fx.life; // 0 → 1

    // 核心光球：快速膨胀 → 缓慢衰减
    if (progress < 0.3) {
        const t = progress / 0.3;
        p.coreSprite.scale.set(0.3 + 0.9 * t * fx.intensity);
        p.coreSprite.alpha = 0.8 + 0.2 * t;
    } else {
        const t = (progress - 0.3) / 0.7;
        p.coreSprite.scale.set(1.2 * fx.intensity * (1 - t * 0.6));
        p.coreSprite.alpha = 1.0 - t;
        // tint 从白热 → 元素色 → 暗红
        if (t > 0.6) {
            p.coreSprite.tint = lerpColor(fx.elementColor, '#8B0000', (t - 0.6) / 0.4);
        }
    }

    // 方向光锥：仅在 flashPhase 内可见
    if (progress < fx.flashPhase / fx.maxLife) {
        const t = progress / (fx.flashPhase / fx.maxLife);
        p.flareSprite.scale.set(0.5 + 1.5 * t * fx.intensity, 0.8 + 0.4 * t);
        p.flareSprite.alpha = 1.0 - t * 0.8;
    } else {
        p.flareSprite.alpha = 0;
    }

    // 火星粒子：物理模拟
    _updateSparks(fx, p, dt);

    // 冷却热辉：flashPhase 后缓慢出现
    if (progress > fx.flashPhase / fx.maxLife) {
        const t = (progress - fx.flashPhase / fx.maxLife) / (1 - fx.flashPhase / fx.maxLife);
        p.heatSprite.alpha = 0.3 * (1 - t);
        p.heatSprite.scale.set(0.8 + 0.4 * t);
    }

    // 同步位置（可能被屏幕震动偏移）
    p.container.x = fx.x;
    p.container.y = fx.y;
}

export function muzzleFlashV2_pixiDestroy(fx) {
    if (!fx._pixi) return;
    fx._pixi.container.destroy({ children: true });
    fx._pixi = null;
}
```

---

## 十、总结

本方案通过四个阶段（枪口火光 V2 → 开炮冲击波 → 拖尾 V2 → 弹道光照）系统性地将开炮视觉体验从 Canvas 2D 基础渲染升级为 PixiJS WebGL 沉浸式效果。所有新增特效遵循现有的三函数适配器模式、三档性能预算和 Canvas 2D fallback 保留策略，确保架构一致性和降级安全性。

**预期视觉提升**：

- 枪口火光：从"渐变圆"变为"多层粒子爆发 + 动态光锥 + 火星飞溅"
- 开炮打击感：从"后坐力 4px"变为"冲击环 + 碎片 + 屏幕震动 + 边缘闪光"
- 子弹拖尾：从"逐点线段"变为"GPU 批渲染渐变带 + 速度动态宽度"
- 开幕齐射：从"略亮一点"变为"金色拖尾 + 更强火光 + 显著震动 = 仪式感"

**预估工作量**：阶段 A ~2 天、阶段 C ~1.5 天、阶段 B ~3 天、阶段 D ~1 天，合计约 7.5 天（含测试调优）。
