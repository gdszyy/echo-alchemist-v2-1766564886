# 显像管(CRT)效果实现方案

## 概述
为Echo Alchemist游戏添加可切换的显像管(CRT)视觉效果，提供复古电视机的视觉体验。

## 技术方案

### 1. CSS叠加层实现
使用CSS Overlay方式实现，优势：
- 性能最优，纯CSS实现
- 可覆盖游戏画面和所有UI元素
- 不影响游戏逻辑和交互

### 2. 效果组成

#### 2.1 扫描线 (Scanlines)
- 使用`linear-gradient`创建横向纹理
- 每4px一条扫描线
- 透明度设置为0.2，保持可见性

#### 2.2 晕影 (Vignette)
- 使用`box-shadow: inset`实现四周暗角
- 聚焦视线到中心区域
- 增强复古显示器效果

#### 2.3 微闪 (Flicker)
- 使用CSS动画模拟电压不稳
- 0.15s循环，透明度在0.92-0.95之间波动
- 效果微弱，不影响游戏体验

#### 2.4 混合模式
- 使用`mix-blend-mode: multiply`增加通透感
- 与背景自然融合

### 3. 交互控制

#### 3.1 控制按钮
- 位置：顶部工具栏(top-bar)
- 图标：📺 (电视机emoji)
- 状态指示：激活时显示琥珀色高亮

#### 3.2 状态持久化
- 使用`localStorage`保存用户偏好
- 键名：`ea_crt_enabled`
- 默认状态：开启

### 4. 实现步骤

1. **CSS部分**：在`<style>`标签末尾添加CRT效果样式
2. **HTML部分**：
   - 在top-bar中添加控制按钮
   - 在game-container中添加overlay层
3. **JavaScript部分**：在`<script type="module">`中添加控制逻辑

### 5. 兼容性考虑
- `pointer-events: none` 确保overlay不拦截鼠标事件
- `z-index: 9999` 确保覆盖所有UI元素
- 使用CSS过渡效果实现平滑切换

## 文件修改清单
- `index.html` - 唯一需要修改的文件
  - CSS样式区域（约70行）
  - HTML结构（2处修改）
  - JavaScript逻辑（约30行）
