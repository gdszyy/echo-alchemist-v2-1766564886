# PixiJS 渲染管线迁移 TODO 与验收标准

> **创建时间**：2026-06-24 | **状态**：🔧 执行中（阶段一✅ 阶段二✅ 阶段三✅ 阶段五✅ | 阶段四⬜ 性能验证待实测） | **优先级**：P0 性能基础设施
>
> 本文档定义了将 Echo Alchemist V2 的粒子/特效渲染层从 Canvas 2D 渐进迁移至 PixiJS (WebGL) 的完整任务清单、阶段验收标准和风险控制要求。
>
> **核心目标**：在不改变 gameplay 逻辑和现有 Canvas 2D 实体渲染（Peg、Ball、Enemy、Projectile）的前提下，将性能瓶颈最严重的粒子和特效子系统迁移到 GPU 渲染管线，彻底解决 `shadowBlur` / `createRadialGradient` / `lighter` 混合模式在 Canvas 2D 上的 API 级性能天花板。

---

## 0. 问题根因与迁移原理

### 0.1 Canvas 2D 不可逾越的 API 瓶颈

| API | Canvas 2D 实现方式 | 单帧开销（800 粒子场景） | WebGL 等价方案 | 性能差距 |
|-----|-------------------|------------------------|---------------|---------|
| `shadowBlur` | CPU 侧逐笔画高斯模糊 | ~800 次模糊 pass | `BlurFilter` / `GlowFilter`（GPU fragment shader） | **10-50x** |
| `createRadialGradient` | 堆分配 + CPU 色标插值 | ~400 次对象创建/GC | 预烘焙发光纹理 `drawImage` | **零 GC** |
| `globalCompositeOperation = 'lighter'` | 无法批处理，逐对象混合 | ~800 次独立 draw call | `BLEND_MODES.ADD`（GPU 原生混合 + 自动批处理） | **100x 级别** |
| `arc() + fill()` × 800 | 800 次独立路径光栅化 | ~800 次 draw call | `ParticleContainer`（单次 GPU draw call） | **~100x** |

### 0.2 迁移范围界定

**迁入 PixiJS**（本迁移覆盖）：
- 粒子系统：`Particle`（6 种模式：spark / ember / mist / shard / smoke / venom）
- 特效对象：`Shockwave` / `FireWave` / `HealWave` / `IceWave` / `LightningBolt` / `DeathExplosion` / `SlashEffect` / `PierceCutEffect` / `BladeStormRing` / `BladeStormVortex` / `SwordScar` / `CollectionBeam` / `GreedyWheelEffect` / `RewardDropEffect`
- 能量球：`EnergyOrb`
- 浮动文字：`FloatingText`
- 激光：`LaserBeam`

**保留 Canvas 2D**（本迁移不触碰）：
- `Peg.draw` / `Ball.draw` / `Projectile.draw`（实体层，数量可控）
- `Enemy.draw`（敌人渲染层，含词条 Overlay / HP 条 / Sprite）
- HUD / UI 系统（DOM + Canvas 2D 混合）
- 主循环控制逻辑（`sys_loop` / `phase_combat_update` 的状态机部分）

### 0.3 架构方案：双层 Canvas Overlay

```
┌─────────────────────────────────────────┐
│  #pixi-overlay-canvas  (PixiJS WebGL)   │  ← 粒子/特效层（透明背景）
│  position: absolute; pointer-events: none│
├─────────────────────────────────────────┤
│  #gameCanvas  (Canvas 2D)               │  ← 实体/HUD/背景层（不变）
└─────────────────────────────────────────┘
```

- PixiJS 渲染到独立的 `<canvas>` 元素，CSS `position: absolute` 叠加在主 Canvas 上方
- `pointer-events: none` 确保所有输入事件穿透到主 Canvas
- PixiJS `Application` 的 `backgroundAlpha = 0`（全透明）
- 两层 Canvas 共享同一个 `#game-container` 父容器，`ResizeObserver` 同步调整尺寸
- 主循环 `sys_loop` 在同一帧内先绘制 Canvas 2D 层，再触发 PixiJS 的 `renderer.render()`

---

## 1. 阶段一：PixiJS 基础设施搭建

> **目标**：引入 PixiJS 依赖、创建 overlay canvas、建立 Bridge 层，不迁移任何实际渲染。

| 任务 | 内容 | 涉及文件 | 状态 |
|------|------|---------|------|
| **T1.1** 引入 PixiJS 依赖 | 通过 CDN (`<script>` 标签) 或 npm 引入 PixiJS 8.x；确认项目可正常加载 | `index.html` 或 `package.json` | ✅ |
| **T1.2** 创建 PixiJS Application | 在 `core.js` 构造函数中，于 Canvas 2D 初始化后创建 `PIXI.Application`，配置 `backgroundAlpha: 0`、`autoStart: false`（手动 tick）；将 `pixiApp` 挂到 `Game` 实例 | `src/core.js` | ✅ |
| **T1.3** Overlay Canvas 叠加 | 将 PixiJS 的 canvas 插入 `#game-container`，CSS 叠加在主 Canvas 上方；`pointer-events: none`；`ResizeObserver` 同步 PixiJS renderer 尺寸 | `src/core.js`、`index.html`（CSS） | ✅ |
| **T1.4** Bridge 层模块 | 新建 `src/render/pixi_bridge.js`：导出 `pixiInit()`、`pixiTick()`、`pixiResize(w, h)`、`pixiClear()`、`pixiDestroy()` 五个生命周期函数；`pixiTick()` 内部调用 `pixiApp.renderer.render(pixiApp.stage)` | `src/render/pixi_bridge.js`（新建） | ✅ |
| **T1.5** 主循环接入 | 在 `sys_loop` 末尾（Canvas 2D 绘制完成后、`ctx.restore()` 之前）调用 `pixiTick()`；在 `sys_resize()` 中调用 `pixiResize()`；在页面 `visibilitychange` 隐藏时调用 `pixiApp.stop()` | `src/game_system.js` | ✅ |
| **T1.6** 性能等级桥接 | 在 `pixi_bridge.js` 中导出 `pixiGetQualityLevel()` 函数，读取 `game.perfQualityLevel`，返回 `'high'/'medium'/'low'` 供后续特效层使用 | `src/render/pixi_bridge.js` | ✅ |

### 阶段一验收标准

| 编号 | 验收项 | 验证方式 |
|------|--------|---------|
| AC-1.1 | PixiJS 加载成功，`PIXI.Application` 实例化无报错 | 浏览器 console 无错误；`game.pixiApp` 可访问 |
| AC-1.2 | Overlay canvas 正确叠加，透明背景，不遮挡主 Canvas 的任何内容 | 游戏正常运行，视觉无变化 |
| AC-1.3 | 窗口 resize 时 PixiJS renderer 同步调整尺寸 | 拖拽窗口边缘后 PixiJS canvas 尺寸与主 canvas 一致 |
| AC-1.4 | 页面隐藏时 PixiJS 暂停，恢复时重启 | DevTools Performance 面板确认后台无 GPU 活动 |
| AC-1.5 | 主循环帧同步：Canvas 2D 和 PixiJS 在同一帧内完成渲染 | 录屏逐帧检查无撕裂/延迟 |
| AC-1.6 | 现有所有 gameplay 功能无回归 | 手动走完一局完整流程（选择→研磨→战斗→商店→Boss） |

---

## 2. 阶段二：粒子系统迁移

> **目标**：将 `Particle` 类的 6 种模式（spark / ember / mist / shard / smoke / venom）迁移到 PixiJS `ParticleContainer`，实现 GPU 批渲染。

| 任务 | 内容 | 涉及文件 | 状态 |
|------|------|---------|------|
| **T2.1** 预烘焙发光纹理集 | 在 `pixi_bridge.js` 中，启动时为每种粒子模式预渲染发光贴图到 `PIXI.Texture`：`spark`（椭圆白色）、`ember`（径向黄→橙→透明）、`mist`（径向青白→透明）、`shard`（菱形纯色）、`smoke`（径向灰→透明）、`venom`（径向绿→透明） | `src/render/pixi_bridge.js` | ✅ |
| **T2.2** ParticleContainer 创建 | 为每种粒子模式创建独立的 `PIXI.ParticleContainer`（capacity = CONFIG 上限），设置允许的 properties（`scale`, `rotation`, `alpha`, `tint`）；加入 `pixiApp.stage` | `src/render/pixi_bridge.js` | ✅ |
| **T2.3** ParticleSprite 适配层 | 新建 `src/render/pixi_particle_adapter.js`：将现有 `Particle` 实例的 `pos` / `vel` / `life` / `size` / `angle` / `mode` 映射到 `PIXI.Sprite` 的 `position` / `rotation` / `alpha` / `scale` / `tint`；`Particle.update()` 保留不变（CPU 侧物理），`Particle.draw()` 改为更新对应 Sprite 属性 | `src/render/pixi_bridge.js`（内联实现）、`src/effects/particles.js` | ✅ |
| **T2.4** 粒子生命周期绑定 | `spawn_createParticle` 创建 `Particle` 时同步创建/复用 `PIXI.Sprite`（从对象池取）；粒子 `life <= 0` 时从 `ParticleContainer` 移除并回收 Sprite 到池 | `src/spawn_system.js`、`src/game_phase.js` | ✅ |
| **T2.5** 混合模式映射 | 为每个 `ParticleContainer` 设置正确的 `blendMode`：`spark` / `shard` → `BLEND_MODES.ADD`；`mist` / `wind_slash` → `BLEND_MODES.SCREEN`；`smoke`（黑色）→ `BLEND_MODES.NORMAL` | `src/render/pixi_bridge.js` | ✅ |
| **T2.6** 旧 draw 路径关闭 | 当 PixiJS 粒子系统激活时，`Particle.draw(ctx)` 不再向 Canvas 2D context 绘制（`if (pixiActive) return`）；保留 fallback 路径用于 PixiJS 初始化失败时的降级 | `src/effects/particles.js` | ✅ |
| **T2.7** wind_slash 与 line 模式迁移 | 这两种非标准粒子（速度方向旋转、线性拖尾）需特殊处理：`wind_slash` 使用线性渐变预烘焙梭形纹理 + 速度方向旋转 + 非均匀拉伸缩放 + SCREEN 混合模式；`line` 使用预烘焙细线纹理 + 速度方向旋转 + `p.scale` 同步 | `src/render/pixi_bridge.js`、`src/spawn_system.js`、`src/game_phase.js` | ✅ |
| **T2.8** ember 模式 shadowBlur 替代 | 原 `shadowBlur` 发光效果改为：在预烘焙纹理中包含外发光圈（大半径低透明度），叠加 `BLEND_MODES.ADD` 模拟 `shadowBlur` 视觉效果 | `src/render/pixi_bridge.js` | ✅ |

### 阶段二验收标准

| 编号 | 验收项 | 验证方式 |
|------|--------|---------|
| AC-2.1 | 6 种粒子模式视觉表现与迁移前一致（颜色、大小、混合效果、消散动画） | 并排录屏对比（Canvas 2D fallback vs PixiJS），逐帧检查无明显差异 |
| AC-2.2 | 粒子数量上限仍受 `CONFIG.performance` 三档预算控制 | 切换到 low 档后粒子上限为 150，high 档为 800 |
| AC-2.3 | 对象池机制正常工作 | 连续发射 2000+ 粒子后 `game._particlePool` 容量不超过 200 |
| AC-2.4 | 清场场景（50+ 敌人同时死亡）帧率不低于迁移前 | DevTools Performance 录制：Canvas 2D 版 vs PixiJS 版帧率对比 |
| AC-2.5 | `wind_slash` / `line` 粒子方向旋转正确 | 风属性技能释放后粒子朝向与弹丸速度方向一致 |
| AC-2.6 | PixiJS 初始化失败时自动 fallback 到 Canvas 2D 路径 | 在 DevTools 中模拟 WebGL 不可用，确认粒子仍正常渲染 |
| AC-2.7 | 移动端（或 Chrome DevTools 模拟低端设备）帧率提升可测量 | Performance 面板录制同等场景，平均帧率提升 ≥ 30% |

---

## 3. 阶段三：特效对象迁移

> **目标**：将 `Shockwave`、`FireWave`、`HealWave`、`IceWave`、`LightningBolt`、`DeathExplosion` 等复合特效迁移到 PixiJS `Container + Sprite + Filter` 体系。

| 任务 | 内容 | 涉及文件 | 状态 |
|------|------|---------|------|
| **T3.1** Shockwave 迁移 | 将 `Shockwave.draw` 中的径向渐变填充 + 弧线描边 + 放射线拆为：预烘焙冲击波环纹理 + `PIXI.Sprite` 缩放 + `GlowFilter` 替代 `shadowBlur`；Container 管理 `arcJitter` 和 `spokes` 子 sprite | `src/effects/particles.js`、`src/render/pixi_effect_adapter.js`（新建） | ✅ |
| **T3.2** FireWave / IceWave 迁移 | 同上思路：预烘焙火焰/冰晶扩散环纹理 + scale 动画；`flameArcs` 子 sprite 使用旋转 + alpha | `src/effects/particles.js`、`src/render/pixi_effect_adapter.js` | ✅ |
| **T3.3** HealWave 迁移 | 中心光晕 + 扩散环 + 十字脉冲光线 → Container 内 3 个子 sprite 层 | `src/effects/particles.js`、`src/render/pixi_effect_adapter.js` | ✅ |
| **T3.4** LightningBolt 迁移 | 将 `generateSegments` 生成的线段集合预烘焙为单帧纹理（在 Bolt 创建时一次性渲染到 `PIXI.RenderTexture`），后续每帧仅 drawImage + alpha 衰减 | `src/effects/particles.js`、`src/render/pixi_effect_adapter.js` | ✅ |
| **T3.5** DeathExplosion 分级迁移 | 按 tier（normal / elite / boss）分别预烘焙消散纹理集；Boss 的多阶段动画（膨胀→内爆→虚空）使用 `PIXI.AnimatedSprite` 或手动帧切换 | `src/effects/particles.js`、`src/render/pixi_effect_adapter.js` | ✅ |
| **T3.6** 简单特效批量迁移 | `SlashEffect` / `PierceCutEffect` / `SwordScar` / `BladeStormRing` / `CollectionBeam` / `GreedyWheelEffect`：均为短生命周期单体特效，统一使用预烘焙纹理 + `Sprite` + alpha/scale 动画 | `src/effects/particles.js`、`src/render/pixi_effect_adapter.js` | ✅ |
| **T3.7** BladeStormVortex 迁移 | 最复杂的持续特效：三层剑环 + 涡心渐变 + 螺旋线。改为：剑刃预烘焙纹理 + `PIXI.Container` 旋转动画（三层 Container 各设不同 `rotation` 速度）；涡心使用单个大尺寸径向渐变纹理 | `src/effects/particles.js`、`src/render/pixi_effect_adapter.js` | ✅ |
| **T3.8** LaserBeam 迁移 | 多段折线 → 创建时渲染到 `PIXI.RenderTexture`（一次性），后续仅 alpha 衰减 | `src/effects/particles.js`、`src/render/pixi_effect_adapter.js` | ✅ |
| **T3.9** RewardDropEffect 迁移 | 三种类型（relic / chaos / pure）各自预烘焙纹理集 + Container 子 sprite 动画 | `src/effects/particles.js`、`src/render/pixi_effect_adapter.js` | ✅ |
| **T3.10** EnergyOrb 迁移 | 已是最简化的粒子（无 shadowBlur），迁移成本低：圆形纹理 + 拖尾线段 → `ParticleContainer` 或简单 Sprite | `src/effects/particles.js`、`src/render/pixi_effect_adapter.js` | ✅ |
| **T3.11** FloatingText 迁移 | 文字渲染使用 `PIXI.Text` 或 `PIXI.BitmapText`（性能优于 Canvas 2D `fillText` + `strokeText`） | `src/effects/particles.js`、`src/render/pixi_effect_adapter.js` | ✅ |
| **T3.12** 特效对象池化 | 为所有特效类建立 PixiJS 侧的对象池（Sprite / Container 复用），与现有 Canvas 2D 侧的数组 splice 清理机制对接 | `src/render/pixi_effect_adapter.js` | ⬜ |

### 阶段三验收标准

| 编号 | 验收项 | 验证方式 |
|------|--------|---------|
| AC-3.1 | 所有 15 种特效类视觉表现与迁移前一致 | 逐特效并排录屏对比 |
| AC-3.2 | `shadowBlur` 发光效果由 `GlowFilter` / 预烘焙纹理替代，视觉一致 | 截图对比，允许 ±10% 亮度偏差 |
| AC-3.3 | 特效数量上限仍受 `CONFIG.performance` 预算控制 | shockwaveLimit / waveLimit / lightningLimit 等在三档下数值正确 |
| AC-3.4 | Boss 死亡（DeathExplosion boss tier）多阶段动画完整播放 | 手动触发 Boss 死亡，观察膨胀→内爆→虚空→消散四阶段 |
| AC-3.5 | BladeStormVortex 三层剑环独立旋转、淡出飞散动画正确 | 触发剑刃风暴技能，观察入场/持续/淡出三阶段 |
| AC-3.6 | LightningBolt 生长动画（progress 0→1）保留 | 闪电链释放时从起点向终点逐段生长 |
| AC-3.7 | 清场场景（14+ 敌人同时死亡）不再出现帧率断崖 | DevTools Performance：迁移前 vs 迁移后帧率对比，帧时间尖峰降低 ≥ 50% |
| AC-3.8 | 所有特效在 low 档正确降级（关闭发光、减少子 sprite、降低动画精度） | 切换 low 档后逐个检查特效 |

---

## 4. 阶段四：性能验证与调优

> **目标**：在真实游戏场景中验证迁移收益，调整参数，确保三档质量等级均满足帧率要求。

| 任务 | 内容 | 涉及文件 | 状态 |
|------|------|---------|------|
| **T4.1** 基准测试场景搭建 | 在训练场中创建 4 个压测场景：(A) 50 普通敌人清场 (B) 8 Boss 同时在场 + 范围技能 (C) 风属性满粒子 + 剑刃风暴 (D) 持续 5 分钟综合战斗 | `src/training_ground.js` 或测试脚本 | ⬜ |
| **T4.2** 帧率基准采集 | 在 Canvas 2D 模式下运行 4 个压测场景，记录 avgFps / 1% low fps / 帧时间 P99 | 测试脚本 | ⬜ |
| **T4.3** PixiJS 模式帧率采集 | 在 PixiJS 模式下运行相同场景，同样指标 | 测试脚本 | ⬜ |
| **T4.4** 内存/GC 压力对比 | 使用 Chrome DevTools Memory 面板对比两种模式的 GC 频率和堆分配速率 | 手动 | ⬜ |
| **T4.5** 参数调优 | 根据测试结果调整 `ParticleContainer` capacity、预烘焙纹理尺寸、`GlowFilter` 强度等参数 | `src/render/pixi_bridge.js` | ⬜ |
| **T4.6** 降级逻辑验证 | 验证 FPS 采样器在 PixiJS 模式下仍正常触发升降级 | 人工降帧测试 | ⬜ |
| **T4.7** 移动端真机验证 | 在至少 1 台中低端手机上运行，验证 WebGL 兼容性和帧率 | 手动 | ⬜ |
| **T4.8** WebGL 上下文丢失恢复 | 处理 `webglcontextlost` / `webglcontextrestored` 事件，确保 GPU 上下文丢失后自动重建纹理和 Container | `src/render/pixi_bridge.js` | ⬜ |

### 阶段四验收标准

| 编号 | 验收项 | 指标 |
|------|--------|------|
| AC-4.1 | high 档桌面端（Chrome latest）50 敌人清场 avgFps | ≥ 55 fps（迁移前目标：≥ 45 fps 即可通过） |
| AC-4.2 | high 档桌面端 8 Boss 同时在场 avgFps | ≥ 50 fps |
| AC-4.3 | high 档桌面端持续 5 分钟综合战斗 1% low fps | ≥ 40 fps |
| AC-4.4 | low 档中低端手机端 avgFps | ≥ 30 fps（迁移前目标：≥ 20 fps 即可通过） |
| AC-4.5 | GC 频率 | 5 分钟战斗内 Major GC ≤ 2 次（迁移前基准：~8-15 次） |
| AC-4.6 | 预烘焙纹理总内存占用 | ≤ 20 MB（所有模式纹理集合计） |
| AC-4.7 | WebGL 上下文丢失后 3 秒内自动恢复 | 在 DevTools 中模拟 `loseContext()`，确认视觉恢复正常 |
| AC-4.8 | 帧率提升幅度 | 同场景同档位下 avgFps 提升 ≥ 40%（桌面 high 档） |

---

## 5. 阶段五：收尾与文档同步

| 任务 | 内容 | 涉及文件 | 状态 |
|------|------|---------|------|
| **T5.1** 更新 performance.md | 在第 4 节预算表中新增 PixiJS 相关参数说明；在第 5 节消费端索引中标注哪些渲染已迁移至 PixiJS | `.cursor/rules/performance.md` | ✅ |
| **T5.2** 更新 perf-optimization-index.md | 标记已迁移解决的瓶颈编号（P-001 ~ P-058 中的对应项）为 `[MIGRATED-TO-PIXI]` | `docs/perf-optimization-index.md` | ✅ |
| **T5.3** 新增流程洞察 | 创建 `PI-010_pixijs_webgl_rendering_migration.md`，记录迁移过程中的 7 个隐蔽陷阱（compaction instanceof 遗漏、粒子模式特殊同步、blendMode 不一致、_pixi/_pixiSprite 区分、BladeStormRing 未实例化、SwordQi 无需迁移、预烘焙纹理形状准确性） | `.cursor/rules/process_insights/PI-010_pixijs_webgl_rendering_migration.md`（新建） | ✅ |
| **T5.4** 更新 AGENTS.md 索引 | 在流程洞察快速预览表中新增 PI-010 条目 | `AGENTS.md` | ✅ |
| **T5.5** 更新自动函数索引 | 运行 `code-indexer` 重建 game_phase.js / particles.js / render_system.js / spawn_system.js 四个大文件索引 | `.cursor/rules/auto_index/` | ✅ |
| **T5.6** Canvas 2D fallback 保留 | 验证全部 18 种特效类的 Canvas 2D `draw(ctx)` 路径完整保留（23~291 行不等）；修复 `pixi_bridge.js` 重复导出 `pixiIsActive` 问题；所有修改文件通过 `node --check` 语法检查 | `src/render/pixi_bridge.js` + 全部特效文件 | ✅ |

### 阶段五验收标准

| 编号 | 验收项 | 验证方式 |
|------|--------|---------|
| AC-5.1 | 所有受影响的规范文档已更新 | 检查 performance.md / perf-optimization-index.md / AGENTS.md |
| AC-5.2 | 流程洞察 PI-006 已注册到 index.md | 检查 `.cursor/rules/process_insights/index.md` |
| AC-5.3 | 自动函数索引与源码同步 | 运行 `python scripts/generate_index.py <repo> --src-dirs src` 无差异 |
| AC-5.4 | WebGL 不可用时游戏仍可正常运行（Canvas 2D fallback） | DevTools 禁用 WebGL 后完整走完一局 |

---

## 6. 风险控制

| 风险 | 概率 | 影响 | 缓解措施 |
|------|------|------|---------|
| WebGL 在部分老旧移动端浏览器不可用 | 中 | 粒子/特效完全不渲染 | 保留 Canvas 2D 完整 fallback 路径（T5.6）；启动时检测 WebGL 支持，不支持则跳过 PixiJS 初始化 |
| PixiJS 纹理预烘焙在低端设备上导致初始化卡顿 | 低 | 首次进入战斗时 1-2 秒卡顿 | 纹理预烘焙在 loading 阶段异步完成，使用 `requestIdleCallback` 分批执行 |
| Canvas 2D 层和 PixiJS 层的 z-order 不一致导致视觉层叠错误 | 中 | 特效出现在不该出现的层上方/下方 | 严格按渲染层序：背景(Canvas2D) → 实体(Canvas2D) → 粒子/特效(PixiJS overlay) → HUD(DOM/Canvas2D)；如有需要，将部分 HUD 也迁入 PixiJS |
| PixiJS 8.x 的 breaking change 影响已有代码 | 低 | 迁移后 PixiJS API 调用失败 | 锁定 PixiJS 版本号；使用 `PIXI.VERSION` 在启动时做版本断言 |
| 双层 Canvas 在某些浏览器的合成层 (compositing layer) 行为不一致 | 低 | 透明度/混合效果异常 | 使用 `will-change: transform` 强制 GPU 合成层；在 Safari / Firefox / Chrome 三端测试 |

---

## 7. 依赖关系

```
阶段一（基础设施） ─────────────────────────────────┐
       ↓                                              │
阶段二（粒子迁移）──── 可独立验证帧率收益 ────────────┤
       ↓                                              │
阶段三（特效迁移）──── 依赖阶段二的纹理/Container 框架 ┤
       ↓                                              │
阶段四（性能验证）──── 依赖阶段二+三完成 ─────────────┤
       ↓                                              │
阶段五（文档收尾）──── 可与阶段四并行 ────────────────┘
```

**建议执行顺序**：阶段一 → 阶段二 → [验证帧率收益] → 阶段三 → 阶段四 → 阶段五

阶段二完成后即可获得显著的帧率提升（粒子系统是最大瓶颈），即使阶段三延后执行，用户体感也会有明显改善。

---

## 8. 性能影响标记规范（迁移专用）

所有涉及 PixiJS 迁移的代码修改，在 Commit Message 中使用 `[pixi-migration]` 标签，并同步添加 `[perf-impact]` 标签（因为渲染管线变更属于性能相关修改）。

```
feat(render): 粒子系统迁移至 PixiJS ParticleContainer [pixi-migration] [perf-impact]
```

---

## 9. 变更历史

| 日期 | 内容 |
|------|------|
| 2026-06-24 | 初版创建：5 阶段迁移计划、33 个子任务、36 条验收标准 |
| 2026-06-24 | **阶段一完成**：PixiJS 7.4.2 CDN 引入、`src/render/pixi_bridge.js` 桥接模块创建、`core.js` 初始化接入、`game_system.js` 主循环/resize/visibility 三处集成点 |
| 2026-06-24 | **阶段二完成**：6 种粒子模式预烘焙纹理（ember/venom 使用精细 3-stop 渐变）、按模式懒创建 ParticleContainer、Sprite 对象池（acquire/release）、`Particle._pixiSprite` 钩子、`spawn_createParticle` 为 mist/ember/venom 注入 Sprite、两处 compaction 循环同步 Sprite 属性+释放。T2.7 (wind_slash/line) 延至阶段三 |
| 2026-06-24 | **阶段三部分完成**：新建 `src/render/pixi_effect_adapter.js`，完成 5 种特效适配器——IceWave（双层冰环 Sprite）、HealWave（3 层光晕+环 Sprite）、LightningBolt（PIXI.Graphics 3-pass 辉光+端点球）、LaserBeam（PIXI.Graphics 3-pass 辉光折线）、CollectionBeam（beam+glow 双 Sprite）。特效生命周期清理对接：iceWaves/healWaves/lightningBolts/collectionBeams 的 splice 处插入 `_pixiDestroy`；LaserBeam 通过 particles compaction 循环的 `instanceof` 分支清理。预烘焙特效纹理 5 张（glow/iceRing/beam/healGlow/healRing） |
| 2026-06-24 | **阶段三完成**：新增 12 种特效适配器——Shockwave（预烘焙环 Sprite+7 弧线 3-pass 辉光+8 辐条）、FireWave（预烘焙火环 Sprite+9 焰弧+8 辐条）、DeathExplosion（PIXI.Graphics 三级分支：boss 膨胀/elite 碎裂+碎片/normal 坍缩环+虚空洞+灵魂粒子）、SlashEffect（双 Sprite 核心+辉光）、PierceCutEffect（Graphics 辉光边缘+核心狭缝+缺口三角）、SwordScar（Graphics 3-pass 主痕+副痕）、BladeStormRing（预烘焙环 Sprite+Graphics 内白环）、BladeStormVortex（预烘焙涡心+Graphics 4 螺旋丝+3 环 N  blade 含 4 段拖尾+钻石体+白芯）、GreedyWheelEffect（Graphics 8 辐条+内圆+4 外弧+中心点+模式依赖）、EnergyOrb（Graphics 拖尾线+光晕+核心）、FloatingText（PIXI.Text+TextStyle 描边+可选图标 Sprite）、RewardDropEffect（Graphics 3 子渲染器 relic/chaos/pure）。新增预烘焙纹理 5 张（shockwaveRing/fireRing/vortexGlow/slashSpindle/bladeStormRing）。所有 15 种特效类的 `_pixi` 钩子（constructor `_pixi=null` + draw() 早返回）已完成。game_phase.js 两处 compaction 循环扩展为处理 LaserBeam/SlashEffect/PierceCutEffect/SwordScar/BladeStormVortex 五类 instanceof 清理。9 个专用数组 splice 处添加 _pixiDestroy：fireWaves/deathExplosions/rewardDropEffects/greedyWheelEffects/shockwaves(战斗+研磨)/energyOrbs/floatingTexts(render_system.js)。T3.12（特效对象池化）留作后续优化。 |
| 2026-06-25 | **T2.7 完成**：wind_slash/line 两种非标准粒子模式迁移——(1) pixi_bridge.js: wind_slash 替换为 64×32 梭形预烘焙纹理（5-stop 线性渐变 透明→青→白→青→透明 + quadraticCurveTo 梭形路径），line 替换为 64×16 细线预烘焙纹理（4-stop 线性渐变 + round-cap stroke），pixiAcquireParticleSprite 为 wind_slash 设置 BLEND_MODES.SCREEN；(2) spawn_system.js: spawn_createParticle 和 spawn_pushParticleWithLimit 两处条件扩展加入 wind_slash/line；(3) game_phase.js: 两处 compaction 循环 Sprite 同步增加 wind_slash/line 分支——速度方向 atan2 旋转、wind_slash 非均匀拉伸（1+speed*0.1, max 3.0）+ 基准缩放（size/32）、line 使用 p.scale 同步、两者均跳过 tint（预彩色纹理）。阶段二至此全部 ✅ |
| 2026-06-25 | **阶段五完成**：T5.1 performance.md 新增 §5.11 PixiJS WebGL 渲染层章节（10 行消费端索引 + 资源汇总表 + §6.5 管线修改规范）；T5.2 perf-optimization-index.md 标记 26 项瓶颈为 [MIGRATED-TO-PIXI]（P-009~P-054），新增 §5 迁移覆盖摘要（20 种特效清单 + 未迁移瓶颈表）+ §6 变更历史；T5.3 创建 PI-010（7 个坑位 + 架构说明 + 文件修改清单）并注册到 process_insights/index.md 和 AGENTS.md；T5.4 AGENTS.md 流程洞察预览表新增 PI-010 条目；T5.5 code-indexer 重建 game_phase.js / particles.js / render_system.js / spawn_system.js 四文件索引；T5.6 验证全部 18 种特效类 Canvas 2D fallback 完整保留（23~291 行），修复 pixi_bridge.js 重复导出 pixiIsActive 问题，所有修改文件通过 node --check。阶段四（性能验证）待真机实测。 |
