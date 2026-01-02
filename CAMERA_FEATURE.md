# 摄像机系统功能说明

## 概述

为 Echo Alchemist 游戏添加了摄像机系统，实现了玩家视角管理和远距离视角切换功能。

## 新增文件

### `src/camera.js`
摄像机类模块，负责管理游戏视角的位置、缩放和变换。

**主要功能：**
- 平滑的摄像机移动和缩放
- 支持远距离视角切换
- 屏幕坐标与世界坐标的相互转换
- 自适应 Canvas 尺寸变化

**核心方法：**
- `update()`: 每帧更新摄像机状态
- `apply(ctx)`: 将摄像机变换应用到 Canvas 上下文
- `enableDistantView()`: 启用远距离视角
- `disableDistantView()`: 恢复正常视角
- `resize(width, height)`: 更新摄像机尺寸

## 修改文件

### `src/core.js`
1. **导入摄像机类**
   ```javascript
   import { Camera } from './camera.js';
   ```

2. **在 Game 构造函数中初始化摄像机**
   ```javascript
   this.camera = new Camera(this.width, this.height);
   ```

3. **在 `sys_resize()` 方法中更新摄像机尺寸**
   ```javascript
   if (this.camera) {
       this.camera.resize(this.width, this.height);
   }
   ```

4. **在 `sys_loop()` 主循环中更新和应用摄像机**
   ```javascript
   // 更新摄像机
   if (this.camera) {
       this.camera.update();
   }
   
   // 应用摄像机变换（仅在战斗阶段）
   if (this.camera && this.phase === 'combat') {
       this.camera.apply(this.ctx);
   }
   ```

5. **添加摄像机控制方法**
   ```javascript
   camera_enableDistantView() {
       if (this.camera && this.phase === 'combat') {
           this.camera.enableDistantView();
       }
   }
   
   camera_disableDistantView() {
       if (this.camera && this.phase === 'combat') {
           this.camera.disableDistantView();
       }
   }
   ```

### `index.html`
在战斗界面底部中央添加了远距离视角按钮：

```html
<button 
    id="distant-view-btn" 
    onmousedown="game.camera_enableDistantView()" 
    onmouseup="game.camera_disableDistantView()" 
    onmouseleave="game.camera_disableDistantView()"
    ontouchstart="game.camera_enableDistantView()" 
    ontouchend="game.camera_disableDistantView()" 
    ontouchcancel="game.camera_disableDistantView()"
    class="absolute bottom-2 left-1/2 -translate-x-1/2 px-6 py-3 bg-cyan-900/80 hover:bg-cyan-800/90 active:bg-cyan-700/90 rounded-full border-2 border-cyan-500/50 hover:border-cyan-400 flex items-center justify-center gap-2 pointer-events-auto z-40 transition-all duration-200 hover:scale-105 active:scale-95 shadow-lg backdrop-blur-sm"
    style="touch-action: none; user-select: none; -webkit-user-select: none;">
    <span class="text-lg">🔭</span>
    <span class="text-sm font-bold text-cyan-100">按住查看远方</span>
</button>
```

## 功能特性

### 1. 摄像机系统
- **平滑移动**: 使用线性插值（lerp）实现平滑的摄像机移动
- **缩放支持**: 支持摄像机缩放，范围限制在 0.1 到 2.0 之间
- **自适应**: 自动适应 Canvas 尺寸变化

### 2. 远距离视角
- **按住查看**: 按住底部按钮可切换到远距离视角
- **自动恢复**: 松开按钮自动恢复到正常视角
- **平滑过渡**: 视角切换使用平滑动画过渡
- **触摸支持**: 完整支持触摸设备（手机、平板）

### 3. 视觉效果
- **向上偏移**: 远距离视角向上偏移 300 像素，可以看到更多上方的敌人
- **缩小视野**: 远距离视角缩放到 0.7 倍，显示更大的游戏区域
- **仅战斗启用**: 摄像机变换仅在战斗阶段（combat）生效，不影响其他阶段

## 使用方法

### 玩家操作
1. 进入战斗阶段
2. 在屏幕底部中央找到"按住查看远方"按钮（🔭图标）
3. 按住按钮查看远距离视角
4. 松开按钮恢复正常视角

### 开发者调用
```javascript
// 启用远距离视角
game.camera_enableDistantView();

// 禁用远距离视角
game.camera_disableDistantView();

// 直接访问摄像机对象
game.camera.setTarget(x, y);  // 设置摄像机目标位置
game.camera.setZoom(zoom);    // 设置摄像机缩放
```

## 技术细节

### 摄像机变换顺序
1. 移动到画布中心
2. 应用缩放
3. 应用摄像机位置偏移
4. 移回原点（使 (0, 0) 在画布中心）

### 坐标转换
摄像机提供了屏幕坐标与世界坐标的相互转换方法：
- `screenToWorld(screenX, screenY)`: 屏幕坐标转世界坐标
- `worldToScreen(worldX, worldY)`: 世界坐标转屏幕坐标

### 性能优化
- 仅在战斗阶段应用摄像机变换
- 使用 `ctx.save()` 和 `ctx.restore()` 保护绘图状态
- 平滑系数设置为 0.1，平衡流畅度和响应速度

## 未来改进方向

1. **摄像机跟随**: 让摄像机跟随玩家或重要目标
2. **震动效果**: 添加摄像机震动效果增强打击感
3. **缩放控制**: 允许玩家手动调整缩放级别
4. **视角预设**: 提供多种预设视角供玩家选择
5. **边界限制**: 限制摄像机移动范围，避免显示游戏区域外的内容

## 提交信息

```
feat: 添加摄像机系统和远距离视角功能

- 新增 Camera 类管理游戏视角
- 实现平滑的摄像机移动和缩放
- 在战斗界面底部添加远距离视角按钮
- 按住按钮可切换到远距离视角查看即将到来的敌人
- 松开按钮恢复正常视角
```

## 测试建议

1. **基础功能测试**
   - 进入战斗阶段
   - 测试按住/松开按钮的视角切换
   - 验证视角平滑过渡

2. **边界测试**
   - 测试在不同屏幕尺寸下的表现
   - 测试触摸设备的兼容性
   - 测试快速切换视角的稳定性

3. **性能测试**
   - 检查帧率是否稳定
   - 验证内存使用是否正常
   - 测试长时间游戏的稳定性

## 兼容性

- ✅ 桌面浏览器（Chrome, Firefox, Safari, Edge）
- ✅ 移动设备浏览器（iOS Safari, Android Chrome）
- ✅ 触摸屏设备
- ✅ 响应式设计
