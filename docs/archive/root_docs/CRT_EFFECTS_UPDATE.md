# CRT显像管效果增强更新

## 更新日期
2026-01-05

## 更新内容

### 1. 增强微闪效果 (Enhanced Flicker)

**功能描述**：模拟老式CRT显像管电压不稳定的效果，屏幕会产生极其微弱但更加逼真的亮度抖动。

**技术实现**：
- 将原有的单一闪烁动画扩展为双重动画叠加
- `crt-flicker`：3秒周期的基础闪烁，模拟持续的电压波动
- `crt-flicker-random`：8秒周期的随机闪烁，模拟偶尔的电压突变
- 透明度范围：0.88-0.96，配合亮度滤镜(0.95-1.02)
- 关键帧更加细腻，从原来的3个关键帧增加到14个关键帧

**视觉效果**：
- 屏幕产生更自然的呼吸感
- 偶尔会出现轻微的电压跳动
- 完全不影响游戏可读性和舒适度

### 2. 动态色差效果 (Dynamic Chromatic Aberration)

**功能描述**：根据游戏中造成的伤害大小，动态触发RGB信号分离效果，模拟CRT显像管在受到冲击或电磁干扰时的色彩分离现象。

**技术实现**：
- 在`combat_damageEnemy`函数中集成触发逻辑
- 新增`combat_triggerChromaticAberration(damage)`方法
- 频率限制：每100ms最多触发一次，避免过度闪烁
- 三档强度分级：
  - **轻度** (damage ≥ 5)：1px偏移，0.3s持续时间
  - **中度** (damage ≥ 20)：2px偏移，0.4s持续时间
  - **重度** (damage ≥ 50)：3px偏移 + 垂直偏移，0.5s持续时间

**视觉效果**：
- 红色通道向右偏移
- 青色通道向左偏移
- 重度伤害时额外添加绿色通道垂直偏移
- 配合轻微模糊效果，增强真实感
- 仅在CRT效果开启时生效

**性能优化**：
- 使用CSS动画，GPU硬件加速
- 频率限制机制防止过度触发
- 动画结束后自动清理类名

## 兼容性

- 完全兼容现有CRT开关功能
- 效果仅在用户主动开启CRT模式时生效
- 不影响游戏性能和帧率
- 支持所有现代浏览器（Chrome 90+, Firefox 88+, Edge 90+, Safari 14+）

## 使用方式

1. 点击游戏界面右上角的📺按钮开启CRT效果
2. 微闪效果将持续运行，模拟电压不稳
3. 在战斗中造成伤害时，会根据伤害大小自动触发色差效果
4. 伤害越高，色差效果越明显

## 技术细节

### CSS关键帧动画
```css
/* 增强微闪 */
@keyframes crt-flicker { /* 14个关键帧 */ }
@keyframes crt-flicker-random { /* 模拟随机电压波动 */ }

/* 色差效果 */
@keyframes crt-chromatic-aberration-light { /* 轻度 */ }
@keyframes crt-chromatic-aberration-medium { /* 中度 */ }
@keyframes crt-chromatic-aberration-heavy { /* 重度 */ }
```

### JavaScript触发逻辑
```javascript
combat_triggerChromaticAberration(damage) {
    // 检查CRT开启状态
    // 频率限制（100ms）
    // 根据伤害分级
    // 动态添加/移除CSS类
}
```

## 文件修改清单

1. `index.html`
   - 增强`@keyframes crt-flicker`动画
   - 新增`@keyframes crt-flicker-random`动画
   - 新增三档色差效果动画
   - 新增色差效果应用类

2. `src/combat_system.js`
   - 在`combat_damageEnemy`函数中添加色差触发调用
   - 新增`combat_triggerChromaticAberration`方法

## 后续优化建议

1. 可考虑添加用户自定义强度设置
2. 可根据不同伤害类型（火、冰、雷等）使用不同的色差颜色
3. 可添加音效配合色差效果

---

**享受更加沉浸的复古游戏体验！** 🎮📺✨
