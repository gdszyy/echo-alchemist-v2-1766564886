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
| `maxParticles` | 800 | 400 | 150 | 全局粒子上限 |
| `windLimit` | 120 | 60 | 30 | 风属性粒子上限 |
| `emberLimit` | 80 | 40 | 15 | 火焰粒子上限 |
| `mistLimit` | 80 | 30 | 10 | 冰雾粒子上限 |
| `shardLimit` | 60 | 30 | 12 | 碎片粒子上限 |
| `shockwaveLimit` | 20 | 12 | 6 | Shockwave 特效上限 |
| `waveLimit` | 10 | 6 | 3 | FireWave / HealWave 上限 |
| `lightningLimit` | 15 | 8 | 4 | LightningBolt 特效上限 |
| `pegSoftShadow` | `true` | `true` | `false` | Peg 椭圆软阴影开关 |
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
| `spawn_createParticle(x, y, color, type)` | `maxParticles` / `windLimit` / `emberLimit` / `mistLimit` / `shardLimit` | 按粒子类型查询对应上限，超限时跳过创建 |
| `spawn_pushParticleWithLimit(particle)` | `maxParticles` | 通用粒子推入前检查全局上限 |
| `spawn_createShockwave(x, y, color)` | `shockwaveLimit` | 超限时跳过创建 |
| `spawn_createHealWave(x, y, range)` | `waveLimit` | 超限时跳过创建 |

### 5.2 战斗系统（`src/combat_system.js`）

| 位置 | 读取字段 | 行为 |
|------|---------|------|
| 天雷技能循环（约第 144 行） | `lightningLimit` | 超限时跳过 LightningBolt 创建 |
| 闪电技能循环（约第 241 行） | `lightningLimit` | 同上 |
| 燃烧死亡爆炸（约第 3183 行） | `waveLimit` | 超限时跳过 FireWave 创建 |
| 静电场词条（约第 1802 行） | `lightningLimit` | 超限时跳过 LightningBolt 创建 |

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

> **注意**：`_initTexture` 在构造时调用，通过 `window.game` 读取等级（若 `window.game` 尚未初始化则默认开启光泽）。

### 5.6 渲染系统（`src/render_system.js`）

| 函数 | 行为 |
|------|------|
| `render_perfOverlay()` | 当 `perfQualityLevel !== 'high'` 时，在 Canvas 左上角绘制半透明 FPS 数值和等级标签（均衡/省电） |

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
