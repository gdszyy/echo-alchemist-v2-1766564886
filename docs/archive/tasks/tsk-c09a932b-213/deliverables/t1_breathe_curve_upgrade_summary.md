# T1: 基础呼吸曲线升级（Breathe Curve Upgrade）交付物摘要

## 任务信息
- **任务 ID**: tsk-c09a932b-213
- **执行 Agent**: agt-79cd6f5a-453
- **完成时间**: 2026-04-16
- **Git Commit**: 5f1e74a（gdszyy/echo-alchemist-v2-1766564886）

## 修改文件列表

| 文件 | 修改类型 | 说明 |
|------|----------|------|
| `src/entities/enemy.js` | 代码修改 | D1 呼吸缩放 + D3 边框脉冲升级 |
| `src/config.js` | 配置新增 | 新增 5 个缓动曲线相关参数 |
| `.cursor/rules/entities.md` | 文档同步 | Layer 结构说明 + 参数调整记录 |

## 具体修改内容

### 1. src/config.js — 新增 5 个配置参数

```javascript
// D1/D3 升级：呼吸缓动曲线升级（Breathe Curve Upgrade）
breatheEasingPower: 1.5,          // 呼吸缓动指数（1.0=线性正弦，越大停留感越强）
borderPulseOverglowAlpha: 0.25,   // 边框脉冲过曝叠加层最大透明度（lighter 模式高光描边）
borderPulseEliteMultiplier: 1.8,  // elite 边框光晕强度倍率（体现精英感）
borderPulseBossMultiplier: 2.5,   // boss 边框光晕强度倍率（体现威压感）
borderPulseBossPeriodMult: 0.75,  // boss 边框脉冲周期倍率（越小越快）
```

### 2. src/entities/enemy.js — D1 呼吸缩放升级

**修改前（线性正弦）**：
```javascript
const breatheScale = 1 + Math.sin(breathePhase) * CONFIG.enemyRender.breatheAmplitude;
```

**修改后（非线性缓动）**：
```javascript
// 使用 Math.pow 非线性缓动曲线，增强极值停留感
const breatheIntensity = Math.pow((Math.sin(breathePhase) + 1) * 0.5, CONFIG.enemyRender.breatheEasingPower);
const breatheScale = 1 + (breatheIntensity * 2 - 1) * CONFIG.enemyRender.breatheAmplitude;
```

### 3. src/entities/enemy.js — D3 边框脉冲升级

**升级内容**：
- 同样使用 `Math.pow` 非线性缓动曲线
- boss 脉冲周期缩短（乘以 `borderPulseBossPeriodMult=0.75`）
- 根据敌人类型应用差异化光晕强度倍率（elite ×1.8，boss ×2.5）
- 在峰值时额外叠加 `lighter` 模式高光描边，透明度随 `pulseIntensity` 变化

## 验收标准对照

| 验收项 | 状态 |
|--------|------|
| config.js 中新增 5 个配置参数，有注释说明 | ✅ 完成 |
| enemy.js 中 D1 和 D3 均使用新的缓动曲线 | ✅ 完成 |
| D3 在峰值时有 lighter 模式的高光叠加 | ✅ 完成 |
| elite 和 boss 的光晕强度有差异化处理 | ✅ 完成 |
| entities.md 同步更新 | ✅ 完成 |
| 代码通过 git commit 提交到目标仓库 | ✅ 完成（commit: 5f1e74a） |
