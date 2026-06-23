# Task 3.3 交付物：移除 Object.assign Mixin 模式

## 任务完成状态

**完成时间**：2026-04-11  
**分支**：task-3.3-remove-mixin（已合并到 main）  
**PR**：#48

## 变更文件

### 1. src/core.js（核心修改）

**变更内容**：
- 在 `Game` 构造函数开头（第一段代码）添加组合模式注入逻辑
- 完全移除文件末尾的 `Object.assign(Game.prototype, ...)` Mixin 调用
- 通过 `bind(this)` 将 10 个子系统的所有方法注入为实例方法
- 非函数属性（如 `_flyEffectPool`）直接赋值到实例（数组浅拷贝）

**核心代码**：
```js
// Game 构造函数开头
const _subsystems = [
    game_system, game_phase, combat_system, render_system, spawn_system,
    ui_system, hud_system, shop_system, rune_launcher_system,
    calc_utils
];
for (const subsystem of _subsystems) {
    for (const [key, val] of Object.entries(subsystem)) {
        if (typeof val === 'function') {
            this[key] = val.bind(this);
        } else if (typeof val !== 'undefined') {
            this[key] = Array.isArray(val) ? [...val] : val;
        }
    }
}
```

### 2. .cursor/rules/global.md（文档更新）

- 新增第 5 节「子系统扩展规范」
- 记录组合模式实现方式和代码示例
- 明确禁止使用 `Object.assign(Game.prototype, ...)` Mixin 模式
- 说明新增子系统的正确步骤

### 3. AGENTS.md（文档更新）

- 更新架构状态说明，记录 Task 3.3 完成
- 更新战斗系统规范描述（Mixin 注入 -> 组合模式注入）

## 迁移范围

全部 10 个子系统均已完成迁移（无需修改子系统文件）：

| 子系统文件 | 方法数量 | 迁移状态 |
|---|---|---|
| game_system.js | ~28 个方法 | ✅ 完成 |
| game_phase.js | ~40 个方法 | ✅ 完成 |
| combat_system.js | ~68 个方法 | ✅ 完成 |
| render_system.js | ~13 个方法 | ✅ 完成 |
| spawn_system.js | ~36 个方法 | ✅ 完成 |
| ui_system.js | ~31 个方法 + 2 个属性 | ✅ 完成 |
| ui/hud.js | ~26 个方法 | ✅ 完成 |
| ui/shop.js | ~11 个方法 | ✅ 完成 |
| ui/rune_launcher.js | ~17 个方法 | ✅ 完成 |
| calc_utils.js | ~8 个方法 | ✅ 完成 |

## 技术决策说明

### 为何选择 bind 方式而非 class 继承或 Proxy

1. **最小侵入性**：无需修改任何子系统文件（10 个文件），降低回归风险
2. **this 指向正确**：bind(this) 确保子系统方法中的 `this` 始终指向 Game 实例
3. **非函数属性处理**：`_flyEffectPool` 等属性正确注入到实例（而非原型链共享）
4. **单实例游戏**：游戏只有一个 Game 实例，实例方法（非原型方法）的内存开销可忽略

### 与旧 Mixin 模式的差异

| 特性 | 旧 Mixin 模式 | 新组合模式 |
|---|---|---|
| 方法存储位置 | Game.prototype（原型链） | Game 实例（实例属性） |
| 非函数属性 | Game.prototype 上（所有实例共享） | Game 实例上（每实例独立） |
| this 指向 | 调用时动态绑定 | 构造时静态绑定 |
| 子系统文件修改 | 不需要 | 不需要 |
| 内存开销 | 低（原型共享） | 略高（实例独立，单实例无影响） |

## 验证结果

- JavaScript 语法检查：`node --check src/core.js` 通过
- 所有子系统文件语法检查通过
- 无方法名冲突（已验证 10 个子系统间无重名方法）
