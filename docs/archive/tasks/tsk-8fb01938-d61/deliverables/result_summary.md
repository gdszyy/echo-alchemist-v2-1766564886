# EchoAlchemistV2 Canvas 性能优化 - 任务结果

## 任务概述
对 EchoAlchemistV2 JS 版本（基于 Canvas 的弹珠台类游戏）进行性能优化，修复 Canvas 状态栈泄漏、拆分大型方法、修复内存泄漏。

## 修改文件
- `src/entities.js`
- `src/ui_system.js`

## Git 仓库
- 仓库：`gdszyy/echo-alchemist-v2-1766564886`
- 分支：`fix/canvas-performance`
- 提交：`eb932d4`

---

## 修复详情

### 1. Canvas 状态栈泄漏修复（最高优先级）

**问题**：`ctx.save()` 调用 60 次，`ctx.restore()` 调用 62 次，差值为 +2，导致状态栈下溢。

**根本原因**：`Projectile.drawVisuals()` 函数（行 4256-4580）中，`if (flying_sword)` 分支和 `else` 分支的花括号结构不平衡：
- `flying_sword` 分支内有 `ctx.save()` 和 `ctx.restore()`
- `else` 分支内有 `ctx.save()` 和 `ctx.restore()`
- 但函数的 `if-else` 结构缺少正确的闭合括号，导致两个多余的 `ctx.restore()` 被无条件执行

**修复方案**：
- 重构 `drawVisuals` 函数的 `if-else` 结构，添加缺少的闭合括号
- 修复后全局 `save:restore = 60:60`，差值归零
- 语法检查通过（`node --check`）

### 2. Projectile.update 方法拆分

**问题**：`Projectile.update()` 方法包含大量碰撞检测逻辑，代码耦合度高。

**修复方案**：从 `update()` 中提取两个子方法：

- **`_handleCollision(e, enemies, spawnCallback)`**：处理与单个敌人的碰撞检测（Circle vs AABB），包含：
  - 最近点计算
  - 碰撞判定
  - 穿透/反弹/销毁逻辑
  - 返回 `'destroyed'` 信号供 `update()` 提前退出

- **`_spawnEffect()`**：处理爆炸子弹的粒子特效生成

逻辑完全不变，仅做结构性拆分。

### 3. 内存泄漏修复

#### entities.js

- **`showToast()`**：新增 `_toastTimer` 模块级变量保存定时器引用，重复调用时先 `clearTimeout` 旧定时器，防止多个定时器堆积

- **`FortuneWheel.finalizeResult()`**：新增 `_deactivateTimer` 实例变量，防止 `finalizeResult()` 被重复调用时产生多个悬空定时器

#### ui_system.js

- **`ui_playResourceFlyEffect()`**：实现 DOM 对象池模式：
  - 新增 `_flyEffectPool[]` 数组管理飞行节点
  - 新增 `_flyEffectMaxNodes = 8` 限制最大节点数
  - 新增 `_getFlyEffectNode()` 从池中获取空闲节点（池满时强制回收最早节点）
  - 新增 `_releaseFlyEffectNode()` 将节点归还到池中
  - 每个节点的 `_timer` 引用在重用时先 `clearTimeout`

---

## 验证结果

| 检查项 | 结果 |
|--------|------|
| entities.js 语法检查 | ✅ 通过 |
| ui_system.js 语法检查 | ✅ 通过 |
| save/restore 差值 | ✅ 0（60:60） |
| _handleCollision 方法 | ✅ 已提取（3 处引用） |
| _spawnEffect 方法 | ✅ 已提取（3 处引用） |
| DOM 对象池 | ✅ 已实现（最多 8 节点） |
