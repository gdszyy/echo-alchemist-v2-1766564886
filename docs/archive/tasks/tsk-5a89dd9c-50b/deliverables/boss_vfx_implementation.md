# Devourer/Ouroboros 专属视觉反馈实现报告

## 任务概述

本次任务为 Echo Alchemist V2 项目中的两个特殊 Boss 实现了专属视觉特效，代码位于 `src/entities/enemy.js` 的 `draw()` 方法中，新增了 **Layer 6.5** 区块（位于裁剪结束之后、Layer 8 入场动画之前）。

## 实现文件

- **修改文件**: `src/entities/enemy.js`
- **插入位置**: `draw()` 方法内，Layer 6（外部特效）之后，Layer 8（Boss 入场动画）之前
- **新增代码行数**: 约 324 行

---

## 1. Devourer（噬神者）视觉反馈

### 触发条件
```javascript
this.type === 'boss' && this.bossType === 'devourer' && this.collisionShape === 'arc'
```

### 状态机与视觉对应

| 状态 | 视觉表现 | 技术实现 |
|:---|:---|:---|
| **IDLE** | 漏斗缺口闭合，绘制深色凹陷区域 | 紫黑色 radialGradient 填充中心区域 + 深色 V 型封印线 |
| **OPENING** | 缺口逐渐扩张，周围出现引力粒子 | 脉冲动画弧形描边 + 扭曲光晕 + 每帧随机生成向心粒子 |
| **DEVOURING** | 全口张开，紫黑色光芒 + 大量吸入粒子 | 多层 radialGradient 光芒 + 深渊核心 + 旋转能量线 + 高密度吸入粒子（spark + mist） |
| **COOLDOWN** | 缺口闭合，红色警示光晕 | 红色 radialGradient 光晕 + 脉冲警示环 + 收缩弧形描边 |

### 粒子特效说明

- **OPENING 引力粒子**: 在 Boss 周围 1.2~2.0 倍半径范围随机生成紫色 `spark` 粒子，速度指向 Boss 中心，每帧生成概率 40%
- **DEVOURING 吸入粒子**: 高密度（70% 概率）紫色/浅紫色 `spark` 粒子 + 30% 概率暗紫色 `mist` 烟雾粒子，均向 Boss 中心吸入

---

## 2. Ouroboros（永恒回声）视觉反馈

### 触发条件
```javascript
this.type === 'boss' && this.bossType === 'ouroboros' && this.collisionShape === 'arc'
```

### 核心参数

- `gapAngle`: 缺口旋转角度（每回合更新）
- `gapSize`: 缺口大小 = `Math.PI * 0.5`（90度）
- `arcStart`: 实体弧起始角 = `gapAngle + gapSize`
- `arcEnd`: 实体弧结束角 = `gapAngle + Math.PI * 2`
- `isBerserk`: `hp / maxHp < 0.5`

### 视觉层次

| 层次 | 内容 | 狂暴时变化 |
|:---|:---|:---|
| **残影层** | 5 层半透明历史弧，角度依次偏移 | 仅狂暴时显示，紫色调 |
| **主环层** | 带缺口的实体弧形描边 + 内层高光 | 颜色更亮（`#c084fc`），发光更强 |
| **核心层** | 缺口中心处的发光球体（攻击目标提示） | 颜色变粉紫，增加旋转虚线光环 |
| **断口层** | 缺口两端的能量断口发光效果 | 颜色变为粉紫色 |

### 狂暴状态特殊效果

- 环形脉冲频率从 2Hz 提升至 4Hz
- 5 层旋转残影（每层透明度递减）
- 核心脉冲频率从 4Hz 提升至 8Hz
- 核心周围出现旋转虚线光环
- 整体颜色从蓝紫色变为亮紫/粉紫色

---

## 技术细节

### 坐标系
所有绘制均在 `ctx.translate(this.pos.x, this.pos.y + this.bumpOffsetY)` 之后进行，使用以 Boss 中心为原点的局部坐标系。

### 粒子生成
粒子坐标需要转换回世界坐标（`this.pos.x + offset`），因为 `game.spawn_pushParticleWithLimit` 使用世界坐标。

### 性能考虑
- Devourer 粒子生成有概率限制（OPENING: 40%，DEVOURING: 70% + 30%）
- Ouroboros 残影仅在狂暴状态下绘制，避免不必要的性能开销
- 所有绘制使用 `ctx.save()/ctx.restore()` 隔离状态

---

## 与碰撞系统的对应关系

| Boss | 碰撞参数 | 视觉对应 |
|:---|:---|:---|
| Devourer | `radius: bossW * 0.35`, `thickness: bossH * 0.15` | 弧形半径和线宽与碰撞参数一致 |
| Ouroboros | `radius: bossW * 0.4`, `thickness: bossH * 0.2` | 环形半径和厚度与碰撞参数一致，缺口角度与 `gapAngle` 同步 |
