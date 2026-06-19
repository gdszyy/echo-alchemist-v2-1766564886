---
description: "utils 模块的设计规范与核心逻辑说明"
globs: ["src/utils/**/*", "src/calc_utils.js", "src/event_bus.js"]
---

# utils 模块规范

## 1. 模块职责

`utils` 模块提供游戏中所有**无副作用的纯工具函数与基础数据结构**，分为三个层次：

| 文件 | 导出对象 | 职责 |
|------|---------|------|
| `src/utils/math_utils.js` | 多个函数 + `Vec2` 类 | 数学工具、颜色处理、UI 提示（从 `entities.js` 拆分，Task 2.1） |
| `src/calc_utils.js` | `calc_utils` mixin | 游戏计算工具（DDA 辅助、弹药配方编译、碰撞辅助、波速计算） |
| `src/event_bus.js` | `eventBus` 实例 + `EVENT_TYPES` | 轻量级发布/订阅事件总线 |

`math_utils.js` 是**零依赖**的纯工具库，不引入任何游戏逻辑模块。`calc_utils.js` 以 Mixin 形式挂载到 `Game` 实例，可访问 `this.xxx` 状态。

## 2. 核心数据模型 / API 接口

### 2.1 math_utils.js 导出 API

| 函数/类 | 签名 | 说明 |
|--------|------|------|
| `Vec2` | `new Vec2(x, y)` | 二维向量类，支持 `add/sub/mult/mag/norm/dist/dot/rotate/distSq` |
| `lerp` | `(start, end, t) => number` | 线性插值 |
| `lerpColor` | `(a, b, amount) => string` | 十六进制颜色线性插值 |
| `adjustColorBrightness` | `(hex, factor) => string` | 调整颜色亮度（乘以系数） |
| `hexToRgba` | `(hex, alpha) => string` | 十六进制颜色转 `rgba()` 字符串 |
| `rotateTowards` | `(currentAngle, targetAngle, maxStep) => number` | 平滑旋转（处理 -π 到 π 突变，走最近弧线） |
| `showToast` | `(msg) => void` | 显示 1500ms 短暂提示（操作 `#toast` DOM 元素，内部防重复定时器） |
| `getThemeSegment` | `(round, curveConfig) => Object` | 根据当前回合数返回对应的主题段落配置对象 |
| `interpolateAffixWeights` | `(round, curveConfig) => Object` | 在相邻段落之间做线性插值，返回当前回合的各词缀权重 Map |
| `weightedRandom` | `(weightMap) => string\|null` | 接受一个 `{key: weight}` 对象，按权重随机返回一个 key |
| `getEliteDualAffixChance` | `(round, postBossRoundsLeft, curveConfig) => number` | 计算当前回合的双词缀精英出现概率（基础值 + 高压加成） |

### 2.2 Vec2 方法速查

```js
v.add(other)    // 向量加法，返回新 Vec2
v.sub(other)    // 向量减法，返回新 Vec2
v.mult(scalar)  // 标量乘法，返回新 Vec2
v.mag()         // 向量长度（模）
v.norm()        // 归一化，返回新 Vec2（零向量返回 (0,0)）
v.dist(other)   // 到另一向量的欧氏距离
v.distSq(other) // 到另一向量的距离平方（避免开方，用于比较）
v.dot(other)    // 点积
v.rotate(angle) // 旋转（弧度），返回新 Vec2
```

### 2.3 calc_utils.js 核心 API（Game 实例方法）

| 方法 | 说明 |
|------|------|
| `calc_getRecentAverageDamage(window=3)` | 近 N 回合伤害滑动平均（DDA 核心数据源） |
| `calc_getPeakAverageDamage()` | **已废弃**，委托给 `calc_getRecentAverageDamage(3)` |
| `calc_evaluateAndAdjustDifficulty()` | 评估并调整动态难度（调用滑动平均，修改敌人血量系数） |
| `calc_calculateDynamicThreshold()` | 计算动态难度调整阈值 |
| `calc_isAreaOccupied(x, y, w, h, excludeEnemy)` | 检测指定区域是否被敌人占据（AABB） |
| `calc_calculateWaveSpeed()` | 计算敌人波浪推进速度（近敌时减速，无敌时全速） |
| `calc_getLineRectIntersection(start, dir, rx, ry, rw, rh)` | 射线与矩形相交检测（Slab Method，返回距离 t） |
| `calc_compileCollectionToRecipe(marbleDef, collectedTypes, totalMulticast)` | 将收集阶段属性列表编译为弹药配方（Recipe 对象） |

### 2.4 EventBus API（`src/event_bus.js`）

```js
eventBus.on(event, handler)    // 订阅事件，返回取消订阅函数
eventBus.off(event, handler)   // 取消订阅
eventBus.once(event, handler)  // 订阅一次性事件
eventBus.emit(event, data)     // 触发事件（handler 异常不影响其他 handler）
```

支持通配符 `'*'` 监听所有事件（仅用于调试）。完整事件类型见 `EVENT_TYPES` 常量（位于 `src/event_bus.js`，共 40+ 个事件）。

## 3. 状态流转 / 业务规则

### 3.1 Vec2 不可变性

`Vec2` 的所有运算方法（`add/sub/mult/norm/rotate`）均返回**新的 Vec2 实例**，不修改原向量。这是设计约定，修改时必须赋值：

```js
// 正确
enemy.pos = enemy.pos.add(delta);
// 错误（add 不修改原向量）
enemy.pos.add(delta);
```

### 3.2 adjustColorBrightness 输入约定

- 输入必须是有效的 6 位十六进制颜色（`#rrggbb` 或 `#rgb`）。
- 输入无效时返回 `"#000000"` 并打印 `console.warn`。
- `factor > 1` 增亮，`factor < 1` 变暗，`factor = 0` 变黑。

### 3.3 calc_compileCollectionToRecipe 属性累加规则

- `damage` 钉子：每个 `{type:'damage', level:N}` 将 `recipe.damage += N`（基础值为 `CONFIG.gameplay.baseDamage`）。
- 元素属性（`cryo/pyro/lightning/laser/wind`）：**层数累加**，支持混合格式（字符串 `'cryo'` 视为 level=1，对象 `{type:'cryo', level:2}` 累加 2 层）。
- 底部奖励分栏属性：`{type:'explosive', level:1, source:'bottom_reward_zone'}` 会设置 `recipe.explosive = true`；`{type:'laser', ...}` 会累加 `recipe.laser` 并使 `recipe.isLaser = true`。
- `flying_sword` 属性：设置 `recipe.type = 'flying_sword'`，`recipe.level` 取所有属性中的最高等级。
- 彩虹属性：**已移除**同步增加元素层数的逻辑，仅保留分裂机制。

### 3.4 EventBus 异常隔离

`eventBus.emit()` 内部对每个 handler 做 try/catch，单个 handler 抛出异常不会阻断其他 handler 的执行。调试模式（`new EventBus({ debug: true })`）下会记录事件历史（最多 100 条）。

### 3.5 showToast 防抖机制

`showToast()` 内部维护 `_toastTimer` 引用，重复调用时会清除上一个定时器，确保 toast 始终在最后一次调用后 1500ms 消失，不会出现多个 toast 叠加。

## 4. 禁止行为

- **严禁**在 `math_utils.js` 中引入任何游戏逻辑依赖（`CONFIG`、`audio`、`eventBus` 等），该文件必须保持零依赖。
- **严禁**直接修改 `Vec2` 实例的 `x`/`y` 属性来实现"移动"效果，应通过 `pos = pos.add(delta)` 赋值新实例（保持不可变性约定）。
- **严禁**使用 `calc_getPeakAverageDamage()`，该方法已废弃，直接调用 `calc_getRecentAverageDamage()`。
- **严禁**在 `calc_utils.js` 中直接修改 `CONFIG` 常量，难度调整必须通过 `Game` 实例的运行时状态字段（如 `this.difficultyMultiplier`）实现。
- **严禁**在 `event_bus.js` 中新增业务逻辑，该文件只维护事件总线基础设施，新增事件类型只需在 `EVENT_TYPES` 对象中添加常量。

## 5. 详细设计文档索引

- 全局规范（Mixin 模式说明）：[global.md](global.md)
- 性能规范（Vec2 热路径优化）：[performance.md](performance.md)
- 实体系统（Vec2 的主要使用场景）：[entities.md](entities.md)
