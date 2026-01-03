# 3D 渲染系统技术文档 (3D Rendering System Technical Documentation)

**作者**: Manus AI
**日期**: 2026年1月2日
**状态**: 实验性/开发中

## 1. 引言 (Introduction)

Echo Alchemist 项目引入了基于 **Three.js** 的实验性 3D 渲染系统，旨在探索更具沉浸感的视觉表现形式，并为未来的功能扩展（如更复杂的环境交互和视觉特效）奠定基础。

该系统的核心设计理念是**逻辑与表现分离**：游戏的核心逻辑（如碰撞检测、伤害计算、实体移动）仍保留在原有的 2D JavaScript 模块中，而 3D 渲染系统则负责将 2D 逻辑实体的状态实时同步到 3D 空间中的视觉网格。

## 2. 架构概览 (Architecture Overview)

3D 渲染系统位于 `src/render3d/` 目录下，主要由以下四个核心模块组成：

| 模块 | 文件路径 | 职责描述 | 关键类/函数 |
| :--- | :--- | :--- | :--- |
| **主控制器** | `src/render3d/index.js` | 系统的入口和核心协调者，负责初始化 Three.js 渲染器、场景、摄像机，并处理 2D 实体到 3D 网格的同步逻辑。 | `RenderSystem3D` |
| **场景管理** | `src/render3d/scene.js` | 负责 3D 场景的环境配置，包括光照、背景、雾效果、以及辅助性的地板和网格。 | `SceneManager` |
| **摄像机控制** | `src/render3d/camera.js` | 管理 3D 摄像机的视角预设（如俯视 2D、等距 3D）和模式间的平滑过渡动画。 | `CameraController` |
| **实体渲染** | `src/render3d/entities/` | 负责特定 2D 游戏实体（如敌人、粒子）的 3D 视觉表现和动态效果。 | `Enemy3D`, `Particle3D` |

## 3. 核心实现细节 (Core Implementation Details)

### 3.1 2D/3D 实体同步 (Entity Synchronization)

`RenderSystem3D` 类通过 `syncEnemies()`、`syncProjectiles()` 和 `syncParticles()` 方法实现 2D 逻辑实体到 3D 视觉网格的实时同步。

**同步机制要点**:

1.  **映射与生命周期管理**: 使用 `Map` 结构（如 `this.enemies3D`）存储 2D 实体 ID 到 3D 网格对象的映射。每帧检查 2D 实体列表，如果发现新的 2D 实体，则创建对应的 3D 网格；如果 2D 实体已销毁，则销毁并移除 3D 网格。
2.  **坐标转换**: 2D Canvas 坐标系需要转换为 3D 世界坐标系。转换公式如下（以敌人同步为例，假设 Canvas 尺寸为 800x600，缩放因子为 50）：
    *   `x = (enemy2D.pos.x - 400) / 50`
    *   `y = -(enemy2D.pos.y - 300) / 50` (Y 轴翻转，且 3D 空间中 Y 轴为高度)
    *   `z = 0`
3.  **状态同步**: 实时同步 2D 实体的重要状态，例如：
    *   **位置**: `Enemy3D.updatePosition()`。
    *   **受击**: 2D 实体上的 `hitTimer` 触发 3D 实体上的 `triggerHitFlash()`。
    *   **温度**: 2D 实体上的 `temp` 属性驱动 3D 实体上的 `updateTemperatureColor()`。

### 3.2 模式切换与摄像机控制 (Mode Switching and Camera Control)

`CameraController` 负责管理 2D/3D 模式的切换，并确保过渡平滑。

| 预设模式 | 描述 | 关键参数 |
| :--- | :--- | :--- |
| **`TOP_DOWN_2D`** | 模拟传统的 2D 俯视视角。摄像机位于高处，垂直向下俯瞰。 | `position: (0, 15, 0)`, `lookAt: (0, 0, 0)`, `FOV: 75` |
| **`ISOMETRIC_3D`** | 实验性的等距 3D 视角。提供深度感和立体感。 | `position: (8, 8, 8)`, `lookAt: (0, 0, 0)`, `FOV: 45` |

**平滑过渡**:

*   `transitionTo3D()` 和 `transitionTo2D()` 方法启动过渡。
*   过渡时长固定为 1.5 秒 (`transitionDuration`)。
*   使用 `easeInOutCubic` 或 `easeOutElastic` 等缓动函数 (`_animateTransition`) 对摄像机的位置、旋转和视场角（FOV）进行线性插值（`lerp`），实现视觉上的平滑过渡。
*   在过渡期间，2D Canvas 和 3D 容器的透明度 (`opacity`) 会同步变化，实现淡入淡出效果。

### 3.3 敌人实体视觉效果 (`Enemy3D`)

`Enemy3D` 类是 3D 渲染系统的核心视觉单元，它实现了多个复杂的动态效果：

| 效果名称 | 触发条件 | 实现细节 |
| :--- | :--- | :--- |
| **受击闪烁** | 2D 实体 `hitTimer > 0` | 使用正弦波 (`Math.sin`) 驱动 `MeshBasicMaterial.opacity`，实现快速闪烁。同时，通过 `shakeOffset` 向量对 3D 网格施加随机偏移，模拟震动。 |
| **温度变色** | 2D 实体 `temp` 属性变化 | 根据 `temp` 值（正值代表高温，负值代表低温）在基础色、橙红色 (`0xea580c`) 和青蓝色 (`0x0891b2`) 之间进行颜色线性插值 (`lerpColor`)。 |
| **生成动画** | 实体首次创建 (`isSpawning`) | 使用**弹性缓出** (`easeOutElastic`) 缓动函数，使实体从零缩放并从上方弹出，模拟“破土而出”的视觉效果。 |
| **死亡动画** | 2D 实体不再活跃 (`isDying`) | 使用**立方缓入** (`easeInCubic`) 缓动函数，使实体加速向下沉降、缩小，并伴随旋转和透明度降低，最终销毁。 |
| **结构** | 永久特性 | 敌人由一个水平的**反光地板平面**和一个位于其上方的**立方体主体**组成，增强了 3D 空间中的定位感和立体感。 |

## 4. 使用说明 (Usage Instructions)

### 4.1 启用 3D 渲染

要启用 3D 渲染系统，需要在游戏核心逻辑中实例化 `RenderSystem3D` 并调用其模式切换方法。

**步骤**:

1.  **确保引入**: 确保 `index.html` 中正确引入了 `src/render3d/index.js` 模块。
2.  **初始化**: 在 `Game` 类的初始化阶段（或适当的系统初始化阶段）创建实例：
    ```javascript
    // 假设 this.game 是 Game 实例
    this.render3D = new RenderSystem3D(this.game);
    ```
3.  **模式切换**: 在需要切换到 3D 模式时调用：
    ```javascript
    this.render3D.transitionTo3D();
    ```
4.  **更新循环**: 确保在游戏的主循环 (`sys_loop`) 中调用 3D 系统的更新方法：
    ```javascript
    // 在 sys_loop 中
    this.render3D.update(deltaTime);
    ```

### 4.2 切换回 2D 渲染

要切换回传统的 2D 渲染模式，调用：

```javascript
this.render3D.transitionTo2D();
```

系统将自动启动平滑过渡动画，并隐藏 3D 容器，恢复 2D Canvas 的完全可见性。

### 4.3 调试与配置

*   **网格辅助线**: `SceneManager` 默认添加了网格辅助线 (`GridHelper`)，有助于调试 3D 空间中的坐标和尺度。
*   **性能**: 3D 渲染对性能有额外要求。如果遇到性能问题，可以考虑：
    *   减少 `syncParticles()` 中同步的粒子数量。
    *   调整 `SceneManager` 中的光照和阴影配置。
    *   在 `RenderSystem3D` 中，通过 `this.enabled = false` 快速禁用整个 3D 系统。

---
*此文档旨在为项目开发者提供 3D 渲染系统的详细技术参考。*
