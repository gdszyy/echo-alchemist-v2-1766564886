# Boss 异型多边形/圆弧渲染 - 交付物报告

**任务 ID**: tsk-c772e12e-86d  
**执行 Agent**: Render-Agent (agt-5088a8f2-043)  
**完成时间**: 2026-04-12

---

## 实现概述

本次任务修改了 `src/entities/enemy.js` 的 `draw()` 方法，为 Boss 实现了异型多边形/圆弧渲染，并为每个 Boss 添加了专属视觉装饰。

---

## 修改内容

### 1. Layer 1 容器裁剪（`draw()` 方法，约第 1062 行）

**修改前**：所有敌人统一使用 `ctx.roundRect` 进行裁剪。

**修改后**：根据 `collisionShape` 属性选择裁剪路径：

| `collisionShape` | 裁剪路径 |
|---|---|
| `'polygon'` | `moveTo/lineTo/closePath` 多边形路径（使用 `collisionData.vertices` 本地坐标） |
| `'arc'` | 环形路径（外圆顺时针 + 内圆逆时针；缺口弧用扇形近似） |
| `'aabb'` 或其他 | 原有 `roundRect` 逻辑（向后兼容） |

### 2. Layer 5 内部边框（约第 1485 行）

同样根据 `collisionShape` 选择描边方式，与 Layer 1 保持一致，确保边框轮廓与裁剪区域对齐。

### 3. Layer 3.8 Boss 专属装饰（新增 `_drawBossDecoration` 方法）

在 Layer 4 裂纹绘制之前插入，为每个 Boss 绘制独特的内部视觉效果：

| Boss | 专属装饰 |
|---|---|
| **Ignis** | 熔岩核心（径向渐变脉冲）+ 狂暴时火星喷射 |
| **Glacies** | 冰晶反射光晕 + 冰尖突出线条 |
| **Mikro** | 六边形细胞网格 + 孢子囊发光点 |
| **Devourer** | 引力流入线 + 中心深渊吸入点 |
| **Viridis** | 生命光晕 + 能量藤蔓（贝塞尔曲线） |
| **Tesla** | 等离子体核心 + 随机折线闪电 |
| **Chimera** | 缝合分割线（渐变）+ 双色能量渗出 |
| **Ouroboros** | 符文光环（旋转北欧符文字符）+ 动态缺口指示箭头 |
| **Prism** | 彩虹光谱流转（7色渐变旋转） |

### 4. Layer 6 外部特效适配（约第 1671 行）

以下外部特效也跟随 Boss 形状改变：
- **Viridis 狂暴光晕**：polygon 时使用顶点缩放路径，arc/aabb 保持原逻辑
- **过热 Stage 4 边框**：polygon/arc 用对应形状，其余用 roundRect
- **入场动画边框脉冲**：polygon/arc 用对应形状，其余用 roundRect

### 5. spawn_system.js 顶点坐标确认

经代码审查，`spawn_system.js` 中所有 Boss 的顶点坐标**已经是相对于 Boss 中心点 (0,0) 的本地坐标**（如 `new Vec2(-bossW * 0.4, bossH * 0.5)`），无需修改。

---

## 向后兼容性

- 所有非 Boss 敌人（`type !== 'boss'`）继续使用原有 `roundRect` 逻辑
- `collisionShape === 'aabb'` 的 Boss 也使用 `roundRect`（如 default 分支）
- 新增的 `_drawBossDecoration` 方法仅在 `type === 'boss' && bossType` 时调用

---

## 提交信息

- **GitHub Commit**: `120a32e` - `feat(render): Boss异型多边形/圆弧渲染 + 专属装饰`
- **修改文件**: `src/entities/enemy.js`（+507 行，-11 行）
