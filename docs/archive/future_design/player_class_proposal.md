# Player 类整合方案分析报告

## 1. 当前架构分析

### 1.1 发射器相关代码分布

通过分析 `core.js`，发现发射器（含发射线）和轨道（orbit）相关的代码**分散在 Game 类中**，主要包括以下状态和方法：

#### 状态变量（位于 Game 构造函数中，约 1040-1060 行）

| 变量名 | 类型 | 描述 |
|--------|------|------|
| `isChargingShot` | boolean | 蓄力吸收状态标志 |
| `chargeProgress` | number | 蓄力进度 (0 → 1) |
| `pendingFireVelocity` | Vec2 | 待发射的速度向量 |
| `isReloading` | boolean | 装填抓取状态标志 |
| `reloadProgress` | number | 装填进度 (0 → 1) |
| `orbitalAngle` | number | 轨道旋转角度（弧度） |
| `spinBoost` | number | 额外旋转速度（受撞击增加） |
| `isDragging` | boolean | 拖拽瞄准状态 |
| `dragStart` | Vec2 | 拖拽起始点 |
| `dragCurrent` | Vec2 | 当前拖拽位置 |
| `lastMousePos` | Vec2 | 最后鼠标位置 |

#### 相关方法

| 方法名 | 位置 | 描述 |
|--------|------|------|
| `combat_fireNextShot(vel)` | ~6143 行 | 从弹药队列发射下一发 |
| `render_combat_launcherOrbitals(ctx, x, y, recipe)` | ~7842 行 | 绘制发射器周围的属性轨道 |
| 瞄准线绘制逻辑 | ~7560-7615 行 | 在 `phase_combat_update` 中内联实现 |
| 发射器核心绘制 | ~7720-7770 行 | 调用 `Projectile.drawVisuals` |
| 蓄力/装填物理更新 | ~7241-7284 行 | 在 `phase_combat_update` 中内联实现 |

### 1.2 发射器位置

发射器的位置在代码中**硬编码**为：
```javascript
const startPos = new Vec2(this.width / 2, this.height - 80);
```
这个位置在多处重复出现（约 5842、5940、6143、7561、7617、7728 行等）。

---

## 2. Player 类设计方案

### 2.1 类结构设计

```javascript
// src/entities.js 或新建 src/player.js

class Player {
    constructor(game) {
        this.game = game;
        
        // === 位置与物理 ===
        this.pos = new Vec2(game.width / 2, game.height - 80);
        
        // === 发射状态 ===
        this.isChargingShot = false;
        this.chargeProgress = 0;
        this.pendingFireVelocity = null;
        
        // === 装填状态 ===
        this.isReloading = false;
        this.reloadProgress = 0;
        
        // === 轨道状态 ===
        this.orbitalAngle = 0;
        this.spinBoost = 0;
        
        // === 瞄准状态 ===
        this.isDragging = false;
        this.dragStart = new Vec2(0, 0);
        this.dragCurrent = new Vec2(0, 0);
        this.aimDirection = new Vec2(0, -1); // 默认朝上
        
        // === 视觉参数 ===
        this.baseRadius = 22;
        this.previewRotation = -Math.PI / 2;
        this.deformation = { x: 1, y: 1 };
    }
    
    // === 核心更新方法 ===
    update(timeScale) { ... }
    
    // === 渲染方法 ===
    draw(ctx) { ... }
    drawOrbitals(ctx, recipe) { ... }
    drawAimLine(ctx) { ... }
    
    // === 输入处理 ===
    startAiming(mousePos) { ... }
    updateAiming(mousePos) { ... }
    endAiming() { ... }
    
    // === 发射控制 ===
    startCharging(velocity) { ... }
    fire() { ... }
    triggerReload() { ... }
}
```

### 2.2 可整合的方法清单

根据代码分析，以下方法/逻辑可以整合到 Player 类中：

#### 高优先级整合（核心功能）

| 原位置 | 方法/逻辑 | 整合后方法名 | 说明 |
|--------|-----------|--------------|------|
| Game 构造函数 | 发射器状态变量 | 构造函数属性 | 所有发射器相关状态 |
| `phase_combat_update` | 蓄力进度更新 (~7241-7256) | `updateCharging(timeScale)` | 蓄力动画物理 |
| `phase_combat_update` | 装填进度更新 (~7258-7271) | `updateReloading(timeScale)` | 装填动画物理 |
| `phase_combat_update` | 轨道旋转物理 (~7273-7284) | `updateOrbitalPhysics(timeScale)` | 轨道惯性与阻力 |
| `render_combat_launcherOrbitals` | 整个方法 (~7842-7965) | `drawOrbitals(ctx, recipe)` | 属性轨道渲染 |
| `phase_combat_update` 内联 | 瞄准线绘制 (~7560-7615) | `drawAimLine(ctx)` | 瞄准线与反射预览 |
| `phase_combat_update` 内联 | 发射器核心绘制 (~7720-7770) | `drawCore(ctx, recipe)` | 发射器本体渲染 |
| `phase_handleInputStart` | 拖拽开始逻辑 (~5840-5845) | `startAiming(pos)` | 开始瞄准 |
| `input_handleInputEnd` | 发射触发逻辑 (~5937-5953) | `endAiming()` | 结束瞄准并触发发射 |

#### 中优先级整合（辅助功能）

| 原位置 | 方法/逻辑 | 整合后方法名 | 说明 |
|--------|-----------|--------------|------|
| 多处硬编码 | 发射器位置计算 | `getPosition()` | 统一位置获取 |
| `input_getTiltOffset` | 视觉偏移计算 | `getVisualOffset()` | 倾斜视差偏移 |
| `combat_fireNextShot` 部分 | 发射音效触发 | `playFireSound()` | 发射音效封装 |
| `phase_combat_update` | 抖动效果计算 | `calculateShake()` | 蓄力时的视觉抖动 |

#### 低优先级整合（可选扩展）

| 功能 | 整合后方法名 | 说明 |
|------|--------------|------|
| 发射器升级系统 | `upgrade(type)` | 未来扩展：发射器强化 |
| 发射器皮肤系统 | `setSkin(skinId)` | 未来扩展：视觉定制 |
| 发射器技能系统 | `useSkill(skillId)` | 未来扩展：主动技能 |

---

## 3. 实现步骤建议

### 阶段一：创建 Player 类骨架

1. 在 `src/entities.js` 中创建 `Player` 类
2. 将状态变量从 Game 迁移到 Player
3. 在 Game 构造函数中实例化 `this.player = new Player(this)`

### 阶段二：迁移更新逻辑

1. 创建 `Player.update(timeScale)` 方法
2. 将蓄力、装填、轨道物理逻辑迁移
3. 在 `phase_combat_update` 中调用 `this.player.update(timeScale)`

### 阶段三：迁移渲染逻辑

1. 创建 `Player.draw(ctx)` 方法
2. 迁移 `render_combat_launcherOrbitals`
3. 迁移瞄准线绘制逻辑
4. 迁移发射器核心绘制逻辑

### 阶段四：迁移输入处理

1. 创建 `Player.startAiming(pos)` / `updateAiming(pos)` / `endAiming()` 方法
2. 在 `phase_handleInputStart` 和 `input_handleInputEnd` 中调用 Player 方法

### 阶段五：清理与优化

1. 移除 Game 中的冗余代码
2. 更新架构文档 (`architecture_map.md`)
3. 添加单元测试

---

## 4. 代码示例

### 4.1 Player 类核心实现

```javascript
class Player {
    constructor(game) {
        this.game = game;
        this.pos = new Vec2(game.width / 2, game.height - 80);
        
        // 发射状态
        this.isChargingShot = false;
        this.chargeProgress = 0;
        this.pendingFireVelocity = null;
        
        // 装填状态
        this.isReloading = false;
        this.reloadProgress = 0;
        
        // 轨道状态
        this.orbitalAngle = 0;
        this.spinBoost = 0;
        
        // 瞄准状态
        this.isDragging = false;
        this.lastMousePos = new Vec2(0, 0);
    }
    
    /**
     * 每帧更新发射器物理状态
     */
    update(timeScale) {
        // 1. 蓄力进度更新
        if (this.isChargingShot) {
            this.chargeProgress += 0.08 * timeScale;
            if (this.chargeProgress >= 1.0) {
                this.isChargingShot = false;
                this.chargeProgress = 0;
                if (this.pendingFireVelocity) {
                    this.game.combat_fireNextShot(this.pendingFireVelocity);
                    this.pendingFireVelocity = null;
                    this.triggerReload();
                }
            }
        }
        
        // 2. 装填进度更新
        if (this.isReloading) {
            this.reloadProgress += 0.035 * timeScale;
            if (this.reloadProgress >= 1.0) {
                this.isReloading = false;
                this.reloadProgress = 1.0;
                this.spinBoost = 0.002; // 撞击反馈
            }
        }
        
        // 3. 轨道旋转物理
        const baseSpeed = 0.00012;
        this.spinBoost *= 0.95;
        if (this.spinBoost < 0.0001) this.spinBoost = 0;
        
        let currentFrameSpeed = baseSpeed + this.spinBoost;
        this.orbitalAngle += currentFrameSpeed * timeScale * 60;
    }
    
    /**
     * 绘制发射器（含轨道和瞄准线）
     */
    draw(ctx, nextAmmo) {
        // 1. 绘制轨道
        this.drawOrbitals(ctx, nextAmmo);
        
        // 2. 绘制发射器核心
        this.drawCore(ctx, nextAmmo);
        
        // 3. 绘制瞄准线（如果正在瞄准）
        if (this.isDragging) {
            this.drawAimLine(ctx);
        }
    }
    
    /**
     * 开始瞄准
     */
    startAiming(mousePos) {
        if (this.game.ammoQueue.length === 0) return false;
        if (this.game.projectiles.length > 0) return false;
        if (this.game.burstQueue.length > 0) return false;
        
        this.isDragging = true;
        this.lastMousePos = mousePos;
        return true;
    }
    
    /**
     * 更新瞄准方向
     */
    updateAiming(mousePos) {
        if (!this.isDragging) return;
        this.lastMousePos = mousePos;
    }
    
    /**
     * 结束瞄准并发射
     */
    endAiming() {
        if (!this.isDragging) return;
        
        this.isDragging = false;
        const aimVector = this.lastMousePos.sub(this.pos);
        
        if (aimVector.y < -20) {
            this.game.sys_resetMultiplier();
            this.pendingFireVelocity = aimVector.norm().mult(12);
            this.isChargingShot = true;
            this.chargeProgress = 0;
            audio.playTone(800, 'sine', 0.1, 0.1);
        }
    }
    
    /**
     * 触发装填动画
     */
    triggerReload() {
        this.isReloading = true;
        this.reloadProgress = 0;
    }
    
    // ... drawOrbitals, drawCore, drawAimLine 方法实现 ...
}
```

### 4.2 Game 类修改示例

```javascript
// Game 构造函数中
constructor() {
    // ... 其他初始化 ...
    
    // 创建 Player 实例（替代原有的分散状态）
    this.player = new Player(this);
    
    // 移除以下变量（已迁移到 Player）：
    // this.isChargingShot = false;
    // this.chargeProgress = 0;
    // this.pendingFireVelocity = null;
    // this.isReloading = false;
    // this.reloadProgress = 0;
    // this.orbitalAngle = 0;
    // this.spinBoost = 0;
    // this.isDragging = false;
    // this.dragStart = new Vec2(0,0);
    // this.dragCurrent = new Vec2(0,0);
}

// phase_combat_update 中
phase_combat_update(timeScale) {
    // ... 其他逻辑 ...
    
    // 更新 Player（替代原有的内联物理逻辑）
    this.player.update(timeScale);
    
    // ... 其他逻辑 ...
}

// 渲染部分
// 替代原有的 render_combat_launcherOrbitals 调用
this.player.draw(this.ctx, nextAmmo);
```

---

## 5. 注意事项

### 5.1 兼容性考虑

- **渐进式迁移**：建议分阶段迁移，每个阶段完成后进行测试
- **向后兼容**：可以在 Game 类中保留 getter/setter 作为过渡：
  ```javascript
  get isChargingShot() { return this.player.isChargingShot; }
  set isChargingShot(v) { this.player.isChargingShot = v; }
  ```

### 5.2 性能考虑

- Player 类的 `update` 和 `draw` 方法每帧调用，需确保无性能问题
- 避免在 draw 方法中创建新对象，复用已有变量

### 5.3 架构一致性

- 遵循现有命名规范（如 `phase_*`, `combat_*`, `render_*` 前缀）
- 更新 `architecture_map.md` 文档
- 在 `entities.js` 的导出列表中添加 Player 类

---

## 6. 实现文件

**Player 类已实现**：`src/entities.js`（与其他游戏实体类放在一起）

### 6.1 如何在 Game 类中使用

#### 步骤 1：导入 Player 类

```javascript
// 在 core.js 顶部的 entities.js 导入中添加 Player
import { Vec2, Enemy, Projectile, Player, ... } from './entities.js';
```

#### 步骤 2：在 Game 构造函数中实例化

```javascript
// 在 Game 构造函数中（约 1060 行附近）
// 替换原有的分散状态变量
this.player = new Player(this);

// 可以移除以下变量（已迁移到 Player）：
// this.isChargingShot = false;
// this.chargeProgress = 0;
// this.pendingFireVelocity = null;
// this.isReloading = false;
// this.reloadProgress = 0;
// this.orbitalAngle = 0;
// this.spinBoost = 0;
// this.isDragging = false;
// this.dragStart = new Vec2(0,0);
// this.dragCurrent = new Vec2(0,0);
```

#### 步骤 3：在 phase_combat_update 中调用更新和绘制

```javascript
// 在 phase_combat_update 方法中

// 更新 Player 状态（替代原有的内联物理逻辑，约 7241-7284 行）
this.player.update(timeScale);

// 在实体层内部绘制 Player（约 7500 行，敌人绘制之后）
// 这样发射器就与敌人在同一层级
this.player.draw(this.ctx);

// 移除原有的发射器绘制代码（约 7723-7772 行）
```

#### 步骤 4：修改输入处理

```javascript
// 在 phase_handleInputStart 中（约 5840 行）
if (this.player.startAiming(logicPos)) {
    this.ui.closeDrawer();
}

// 在 input_handleInputEnd 中（约 5937 行）
this.player.endAiming();

// 在 input_handleMouseMove 中（约 5999 行）
this.player.updateAiming(logicPos);
```

### 6.2 向后兼容（可选）

如果需要保持向后兼容，可以在 Game 类中添加 getter/setter：

```javascript
// 在 Game 类中添加
get isChargingShot() { return this.player.isChargingShot; }
set isChargingShot(v) { this.player.isChargingShot = v; }

get chargeProgress() { return this.player.chargeProgress; }
set chargeProgress(v) { this.player.chargeProgress = v; }

get isDragging() { return this.player.isDragging; }
set isDragging(v) { this.player.isDragging = v; }

// ... 其他属性类似
```

---

## 7. 总结

将发射器和轨道整合为 `Player` 类的好处：

1. **代码组织**：将分散的 15+ 个状态变量和 8+ 个方法集中管理
2. **可维护性**：发射器相关的修改只需在 Player 类中进行
3. **可扩展性**：便于未来添加发射器升级、皮肤、技能等功能
4. **可测试性**：Player 类可以独立进行单元测试
5. **符合 OOP 原则**：发射器作为游戏中的核心实体，应该有自己的类

建议从**阶段一**开始，逐步完成迁移，每个阶段确保游戏功能正常后再进入下一阶段。
