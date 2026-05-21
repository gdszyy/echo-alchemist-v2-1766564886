# 自适应性能系统规范 (performance.md)

> **状态**：已实现（2026-04-16）  
> **涉及文件**：`src/config.js`、`src/core.js`、`src/game_system.js`、`src/render_system.js`、`src/spawn_system.js`、`src/combat_system.js`、`src/combat/damage_calc.js`、`src/entities.js`、`src/entities/enemy.js`

---

## 1. 设计目标

Echo Alchemist V2 以 Canvas 2D API 渲染，在中低端手机上粒子特效和混合模式叠加会造成严重掉帧。本系统通过**实时采样平均帧率**，在运行时自动调整特效等级，使游戏在所有设备上保持流畅，同时在高端设备上保留完整视觉效果。

---

## 2. 性能瓶颈分析（优先级由高到低）

| 排名 | 瓶颈来源 | 每帧开销原因 | 涉及文件 |
|------|---------|------------|---------|
| 1 | **粒子系统**（`mist`/`ember`/`shard`） | `createRadialGradient` + `shadowBlur` + `lighter`/`screen` 混合；全局上限 800 | `src/effects/particles.js`、`src/spawn_system.js` |
| 2 | **特效对象**（`Shockwave`/`FireWave`/`LightningBolt`/`HealWave`） | 多层 `shadowBlur` + `lighter` 叠加，无原始数量上限 | `src/effects/particles.js`、`src/combat_system.js`、`src/combat/damage_calc.js`、`src/spawn_system.js` |
| 3 | **Peg 软阴影 + 底部光晕** | 每帧对约 50 个 Peg 各执行 `createRadialGradient`（光晕）+ `ellipse`（阴影） | `src/entities.js`（`Peg.draw`） |
| 4 | **敌人材质光泽** | `OffscreenCanvas` 上 `LinearGradient` 叠加，敌人构造时执行 | `src/entities/enemy.js`（`Enemy._initTexture`） |

---

## 3. 架构设计

### 3.1 状态字段（`core.js` → `Game` 实例）

```js
// 当前性能等级：'high' | 'medium' | 'low'
this.perfQualityLevel = 'high';

// FPS 采样窗口（循环缓冲区，长度 = CONFIG.performance.fpsSampleWindow）
this._fpsSamples = [];
this._fpsLastTime = 0;      // 上一帧 performance.now() 时间戳
this.avgFps = 60;           // 当前滑动平均帧率（整数，对外只读）

// 升降级保护计时器（单位：秒）
this._perfDownTimer = 0;    // 连续低帧累计时长，达到 downgradeHoldSec 后降级
this._perfUpTimer = 0;      // 连续高帧累计时长，达到 upgradeHoldSec 后升级
```

### 3.2 FPS 采样器（`game_system.js` → `sys_loop`）

每帧主循环开头执行：

```
1. dt = performance.now() - _fpsLastTime
2. 过滤异常帧（dt < 5ms 或 dt > 200ms）
3. 将 1000/dt 推入 _fpsSamples 滑动窗口（长度 fpsSampleWindow=60）
4. avgFps = round(sum(_fpsSamples) / length)
5. 升降级判断（见 3.3）
```

### 3.3 升降级逻辑

```
if avgFps < fpsThresholdDown (45):
    _perfDownTimer += dt_sec
    _perfUpTimer = 0
    if _perfDownTimer >= downgradeHoldSec (3s):
        perfQualityLevel 降一档（high→medium→low）
        _perfDownTimer = 0

if avgFps > fpsThresholdUp (55):
    _perfUpTimer += dt_sec
    _perfDownTimer = 0
    if _perfUpTimer >= upgradeHoldSec (10s):
        perfQualityLevel 升一档（low→medium→high）
        _perfUpTimer = 0
```

**设计意图**：降级阈值（3s）远小于升级阈值（10s），确保性能压力时快速响应，恢复时保守升级，防止频繁抖动。

---

## 4. 三档等级预算表（`CONFIG.performance`）

> 真理来源：`src/config.js` → `CONFIG.performance`

| 参数 | `high`（高画质） | `medium`（均衡） | `low`（省电） | 说明 |
|------|---------------|----------------|-------------|------|
| `maxParticles` | 800 | 400 | 150 | 全局粒子总上限 |
| `windLimit` | 120 | 60 | 30 | 风属性粒子上限 |
| `emberLimit` | 80 | 40 | 15 | 火焰粒子上限 |
| `mistLimit` | 80 | 30 | 10 | 冰雾粒子上限 |
| `shardLimit` | 60 | 30 | 12 | 碎片粒子上限 |
| `sparkLimit` | 100 | 50 | 20 | 通用火星粒子上限（机械类受击电弧、能量泄漏等） |
| `smokeLimit` | 60 | 25 | 8 | 烟雾粒子上限（狂暴受击烟雾、死亡爆炸等） |
| `venomLimit` | 60 | 30 | 0 | 毒液粒子上限（中毒敌人漂浮液滴 + 命中爆发；省电模式完全关闭） |
| `shockwaveLimit` | 20 | 12 | 6 | Shockwave 特效上限 |
| `waveLimit` | 10 | 6 | 3 | FireWave / HealWave 上限 |
| `lightningLimit` | 15 | 8 | 4 | LightningBolt 特效上限 |
| `pegSoftShadow` | `true` | `true` | `false` | Peg 渓圆软阴影开关 |
| `pegGlowHalo` | `true` | `false` | `false` | Peg 底部径向光晕开关 |
| `enemyGloss` | `true` | `true` | `false` | 敌人材质光泽渐变开关 |

**FPS 采样参数**（同在 `CONFIG.performance` 根节点）：

| 参数 | 值 | 说明 |
|------|----|------|
| `fpsSampleWindow` | 60 | 滑动平均窗口帧数 |
| `fpsThresholdDown` | 45 | 触发降级的 FPS 下限 |
| `fpsThresholdUp` | 55 | 触发升级的 FPS 上限 |
| `downgradeHoldSec` | 3 | 降级所需连续低帧时长（秒） |
| `upgradeHoldSec` | 10 | 升级所需连续高帧时长（秒） |

---

## 5. 消费端关联索引

所有读取 `CONFIG.performance` 或 `this.perfQualityLevel` 的代码位置：

### 5.1 粒子系统（`src/spawn_system.js`）

| 函数 | 读取字段 | 行为 |
|------|---------|------|
| `spawn_createParticle(x, y, color, type)` | `maxParticles` / `windLimit` / `emberLimit` / `mistLimit` / `shardLimit` / `sparkLimit` / `smokeLimit` / `venomLimit` | 按粒子类型查询对应上限，超限时跳过创建 |
| `spawn_pushParticleWithLimit(particle)` | `maxParticles` / `sparkLimit` / `smokeLimit` / `venomLimit` | 通用粒子推入前检查全局上限及 spark/smoke/venom 独立限制 |
| `spawn_createShockwave(x, y, color)` | `shockwaveLimit` | 超限时跳过创建 |
| `spawn_createHealWave(x, y, range)` | `waveLimit` | 超限时跳过创建 |

### 5.2 战斗系统（`src/combat_system.js`）

| 位置 | 读取字段 | 行为 |
|------|---------|------|
| 天雷技能循环（约第 144 行） | `lightningLimit` | 超限时跳过 LightningBolt 创建 |
| 闪电技能循环（约第 241 行） | `lightningLimit` | 同上 |
| 燃烧死亡爆炸（约第 3183 行） | `waveLimit` | 超限时跳过 FireWave 创建 |
| 静电场词条（约第 1802 行） | `lightningLimit` | 超限时跳过 LightningBolt 创建 |
| 毒素命中粒子爆发（约第 1739 行） | `venomLimit`（经 spawn_createParticle 间接读取） | 叠加毒层时在命中点发射 1~4 颗毒液粒子 |

### 5.3 伤害计算（`src/combat/damage_calc.js`）

| 位置 | 读取字段 | 行为 |
|------|---------|------|
| 闪电链 setTimeout 回调（约第 205 行） | `lightningLimit` | 超限时跳过 LightningBolt 创建 |

### 5.4 实体渲染（`src/entities.js` → `Peg.draw`）

| 位置 | 读取字段 | 行为 |
|------|---------|------|
| 软阴影绘制（约第 1036 行） | `pegSoftShadow` | `false` 时跳过 `ellipse` 软阴影 |
| 底部光晕绘制（约第 1084 行） | `pegGlowHalo` | `false` 时跳过 `createRadialGradient` 光晕 |

> **注意**：`Peg.draw` 通过 `game.perfQualityLevel` 读取等级（`typeof game !== 'undefined' && game.perfQualityLevel`），默认回退到 `'high'`。

### 5.5 敌人纹理（`src/entities/enemy.js` → `Enemy._initTexture`）

| 位置 | 读取字段 | 行为 |
|------|---------|------|
| 材质光泽叠加（约第 229 行） | `enemyGloss` | `false` 时跳过 OffscreenCanvas 光泽渐变 |

### 5.6 Arc Boss VFX（`src/entities/enemy.js` → Devourer Layer 6.5 & Ouroboros Layer 6.5）

| 位置 | 读取字段 | 行为 |
|------|---------|------|
| Devourer 深渊核心 lighter 白化叠加（DEVOURING 状态） | `arcBossVfxWhiteGrad` | `false` 时跳过 `createRadialGradient` + `lighter` 叠加（省电模式关闭） |
| Devourer 旋转引力线数量（DEVOURING 状态） | `arcBossVfxLineCount` | 控制 `createLinearGradient` 调用次数（high:6 / medium:6 / low:3） |
| Devourer 吸入粒子每帧生成概率（DEVOURING 状态） | `arcBossVfxSuckProb` | 控制每帧 spark 粒子生成概率（high:0.7 / medium:0.5 / low:0.3） |
| Ouroboros 狂暴共鸣三角形符文数量（狂暴状态） | `arcBossVfxTriCount` | 控制外圈旋转三角形数量（high:6 / medium:3 / low:0），0 时完全跳过循环 |

> **注意**：Arc Boss VFX 通过 `game.perfQualityLevel` 动态读取等级，默认回退到 `'high'`。吸入粒子已通过 `spawn_pushParticleWithLimit` 接入全局 sparkLimit 预算检查。

> **注意**：`_initTexture` 在构造时调用，通过 `window.game` 读取等级（若 `window.game` 尚未初始化则默认开启光泽）。

### 5.7 渲染系统（`src/render_system.js`）

| 函数 | 行为 |
|------|------|
| `render_perfOverlay()` | 当 `perfQualityLevel !== 'high'` 时，在 Canvas 左上角绘制半透明 FPS 数值和等级标签（均衡/省电） |

### 5.8 毒素状态视觉（`src/entities/enemy.js` → `Enemy.draw` Layer 3.4）

| 位置 | 读取字段 | 行为 |
|------|---------|------|
| 毒素叠加层（Layer 3.4，`venomStacks > 0`） | `perfQualityLevel` | `high`：screen 混合径向渐变 + 液滴动画；`medium`：只渐变无液滴；`low`：简单色块无渐变 |
| 毒液粒子发射（Layer 3.4 末尾） | `venomLimit`（经 `spawn_createParticle` 间接读取） | `high` 档 8% 概率/帧发射漂浮毒液粒子，`medium` 4%，`low` 0%（venomLimit=0 兜底截止） |

> **注意**：Layer 3.4 在 `ctx.clip()` 之后执行，叠加层自动被裁剪到敌人形体内部，无需额外剪切。粒子发射使用世界坐标（`this.pos.x / this.pos.y`），与局部 ctx 变换无关。

---

## 6. 修改指南（Agent 防坑）

### 6.1 新增粒子类型时

1. 在 `CONFIG.performance.high/medium/low` 中为新类型添加对应上限字段（如 `newTypeLimit`）。
2. 在 `spawn_createParticle` 的 `switch` 分支中读取该字段。
3. 同步更新本文档第 4 节预算表。

### 6.2 新增特效对象时（如新的 Wave/Bolt 类）

1. 在 `CONFIG.performance` 三档中添加对应上限字段。
2. 在创建该特效对象的函数中加入上限检查：
   ```js
   const _budget = CONFIG.performance[this.perfQualityLevel || 'high'];
   if (this.myEffects.length >= _budget.myEffectLimit) return;
   this.myEffects.push(new MyEffect(...));
   ```
3. 同步更新本文档第 5 节消费端关联索引。

### 6.3 调整 FPS 阈值时

只修改 `CONFIG.performance` 中的 `fpsThresholdDown`、`fpsThresholdUp`、`downgradeHoldSec`、`upgradeHoldSec`，**不要直接修改 `game_system.js` 中的采样逻辑**。

### 6.4 禁止行为

- **禁止**在特效创建函数中硬编码数量上限（如 `if (this.particles.length >= 800)`），必须通过 `CONFIG.performance` 读取。
- **禁止**在 `Peg.draw` 中直接读取 `CONFIG.performance.high`，必须通过 `game.perfQualityLevel` 动态查询。
- **禁止**在 `_initTexture` 中使用 `this.perfQualityLevel`（构造时 `game` 尚未挂载），必须通过 `window.game` 读取。

---

## 7. 对外可观测接口

| 属性/方法 | 位置 | 说明 |
|---------|------|------|
| `game.avgFps` | `Game` 实例 | 当前 60 帧滑动平均帧率（整数） |
| `game.perfQualityLevel` | `Game` 实例 | 当前性能等级：`'high'`/`'medium'`/`'low'` |
| `render_perfOverlay()` | `render_system.js` | 在 Canvas 上绘制 FPS 指示层（降级时自动调用） |

---

## 8. 变更历史

| 日期 | 内容 |
|------|------|
| 2026-04-16 | 初始实现：FPS 采样器、三档等级预算、粒子/特效/Peg/敌人全面接入、FPS 指示层 |
| 2026-04-16 | 新增 `sparkLimit`（high:100/medium:50/low:20）和 `smokeLimit`（high:60/medium:25/low:8）两个预算字段；在 `spawn_createParticle` 和 `spawn_pushParticleWithLimit` 中同步接入 spark/smoke 上限检查，防止能量泄漏、机械类受击等高频 spark 场景占用全局粒子预算 |
| 2026-04-16 | **Arc Boss VFX 性能门控（Task T3 补丁）**：在三档预算表中新增 4 个字段：`arcBossVfxTriCount`（Ouroboros 狂暴三角形数量，high:6/medium:3/low:0）、`arcBossVfxLineCount`（Devourer 引力线数量，high:6/medium:6/low:3）、`arcBossVfxWhiteGrad`（Devourer 深渊核心 lighter 白化叠加开关，high/medium:true/low:false）、`arcBossVfxSuckProb`（Devourer 吸入粒子生成概率，high:0.7/medium:0.5/low:0.3）。在 `enemy.js` Devourer/Ouroboros Layer 6.5 中通过 `game.perfQualityLevel` 动态读取对应字段实施门控。同步更新消费端关联索引（第 5.6 节）。 |
| 2026-04-30 | **毒素敌人专属特效**：新增 `venomLimit`（high:60/medium:30/low:0）预算字段；新增 `venom` 粒子模式（上浮液滴 + screen 渐变绘制）；在 `enemy.js` Layer 3.4 新增毒素状态视觉（径向渐变叠加 + 液滴流淌动画，三档门控）；在 `combat_system.js` 命中毒素时发射 1~4 颗毒液粒子。消费端关联索引见第 5.1/5.2/5.8 节。 |

## 9. 性能影响标记规范

为了在持续迭代中保护自适应性能系统，所有 AI Agent 在修改或新增可能影响渲染性能的代码时，**必须**执行以下标记与评估流程：

### 9.1 触发条件

当你的代码修改涉及以下任何一项时，即触发本规范：
- 新增或修改 `Particle`、`Shockwave`、`LightningBolt` 等特效类的实例创建逻辑
- 在 Canvas 渲染上下文中使用或修改高开销 API：
  - `createRadialGradient` / `createLinearGradient`
  - `shadowBlur` / `shadowColor`
  - `globalCompositeOperation`（特别是 `lighter`、`screen` 等加法混合模式）
- 在主循环（`update` / `draw`）中新增复杂的遍历逻辑（如 `Array.filter`）

### 9.2 标记格式

1. **代码注释标记**：在受影响的代码块（如函数定义、循环体）上方添加标准注释标记：
   ```javascript
   // @perf-impact: [影响简述] - [处理方式]
   // 例如：
   // @perf-impact: 新增高频渐变创建 - 已通过 perfQualityLevel 降级处理
   ```

2. **Commit Message 标记**：在 Git 提交信息的末尾添加 `[perf-impact]` 标签：
   ```text
   feat(effects): 新增冰霜爆裂特效 [perf-impact]
   ```

### 9.3 强制评估模板

在任务总结或 PR 描述中，必须包含以下“性能自适应影响评估”说明：

```markdown
### 性能自适应影响评估

- **修改内容**：简述新增或修改了什么视觉效果。
- **高开销 API**：列出使用的 `shadowBlur`、`createRadialGradient` 等。
- **预算接入情况**：
  - [x] 已在 `CONFIG.performance` 中添加对应上限字段（如 `newEffectLimit`）
  - [x] 已在特效创建入口处添加 `CONFIG.performance[game.perfQualityLevel]` 检查
- **三档表现说明**：
  - `high` 档：完整效果表现
  - `medium` 档：降级策略说明（如减少粒子数量、关闭某些渐变）
  - `low` 档：极致降级策略说明（如关闭所有发光和混合模式）
```

---

## N. Promare 视觉模式性能预算

详见 [`promare_design.md`](promare_design.md)。Promare 模式相较 classic 在多数场景下 **净改善 FPS**，因为：
- 删除每敌人 `_textureCanvas`（offscreen procedural noise）
- 删除每帧 4-6 个 `createLinearGradient` / 敌人
- 删除所有 `shadowBlur` 调用（移动 GPU 上单帧最昂贵的 Canvas2D 操作）
- 用 `globalCompositeOperation='lighter'` + 多次半透明 fill 替代发光，更便宜

预算映射（`getPromarePerf(qualityLevel)`，定义在 `src/render/promare_tokens.js`）：

| 项 | high | medium | low |
|---|---|---|---|
| `burstBigN` | 3 | 2 | 1 |
| `burstSmallN` | 16 | 10 | 5 |
| `radialSpokes` | 8 | 6 | 4 |
| `hitstopMax` | 4 帧 | 3 帧 | 0（跳过） |
| `flashFrames` | 4 | 4 | 2 |
| `useStagger` | true | true | false（跳过 setTimeout） |

Promare 新增 mode 走现有 `CONFIG.performance[level].maxParticles` 全局上限。`particleCounts` 在 `core.js` 已扩展所有 promare mode 计数器。

**修改 promare 路径时**：
1. 新增的粒子模式必须在 `particleCounts` 初始化加 counter
2. 子粒子分裂（scatter/cryo）必须设 `_splitFired=true` 防止链式爆炸
3. 监控 medium 档 6+ 敌人场景的同帧粒子峰值，不应触及 `maxParticles=400` 上限
