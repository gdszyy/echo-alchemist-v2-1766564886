# Echo Alchemist V2 全局 AI 规范 (global.md)

本文档是 Echo Alchemist V2 项目的核心全局规范，所有参与项目重构和开发的 AI Agent 必须严格遵守。它详细规定了项目的整体架构、模块依赖关系以及禁止行为清单，确保代码质量和可维护性。

## 1. 项目整体架构概述

《Echo Alchemist V2》是一个基于 HTML5 Canvas 和 JavaScript 开发的回合制 Roguelike 打砖块游戏。目前，项目正处于从巨型单体脚本演化初期向模块化、解耦架构迁移的阶段。根据诊断报告（`docs/diagnosis-report.md`），项目的核心问题在于巨型 Mixin 模式导致的高耦合、UI 层与业务逻辑的强绑定，以及异常的依赖注入与全局变量。

为了解决这些问题，项目的目标架构如下：

*   **事件驱动（Event-Driven）**：已废弃 `Object.assign(Game.prototype, ...)` 的巨型 Mixin 模式（Task 3.3 已完成移除）。引入 `event_bus.js` 作为事件总线（Event Bus）。各个子系统（如 UI、战斗、掉落等）通过事件进行通信，而不是直接修改全局 `Game` 实例的状态。
*   **视图与数据分离**：UI 渲染逻辑必须从业务模块中剥离，避免在业务逻辑中使用超长的 `innerHTML` 或直接操作 DOM 节点。
*   **模块化封装**：将核心逻辑拆分为多个独立的子系统（如 `game_system.js`、`combat_system.js` 等），每个模块只负责单一职责，通过导出和导入函数进行协作。
*   **资源与状态管理**：音频系统（`audio.js`）延迟初始化以适应浏览器策略，实体系统（`entities.js`）需进行性能优化（如空间分区），以应对高频碰撞检测。

## 2. 模块依赖关系

根据重构计划，项目的核心逻辑已拆分为多个子系统，其依赖关系和核心职责如下：

*   **`core.js`**
    *   **核心职责**：游戏引擎核心，管理全局状态、主循环和音频初始化。作为聚合层，负责导入所有子模块并构建完整的 `Game` 类。
    *   **依赖关系**：依赖 `event_bus.js`、`audio.js`、`config.js`、`entities.js` 以及所有的业务子系统（如 `game_system.js` 等）。
*   **`event_bus.js`**
    *   **核心职责**：轻量级事件总线，提供发布/订阅模式的事件通信机制，解耦子系统间的直接依赖。
    *   **依赖关系**：无外部依赖（纯 ES Module）。
*   **`audio.js`**
    *   **核心职责**：音频管理（`SoundManager` 类及 `audio` 实例），处理音效和背景音乐。
    *   **依赖关系**：被 `core.js` 延迟初始化并注入。
*   **`game_system.js`**
    *   **核心职责**：游戏主循环、初始化、存档读写、游戏重置与输入管理。
    *   **依赖关系**：依赖 `core.js` 中的全局状态，并通过事件总线与其他模块通信。
*   **`game_phase.js`**
    *   **核心职责**：游戏阶段管理（命运抉择、研磨、战斗等阶段的具体逻辑与转场）。
    *   **依赖关系**：依赖 `entities.js`、`config.js`、`audio.js`、`event_bus.js`、`rune_config.js` 和 `systems.js`。**不直接依赖 `combat_system.js` 和 `ui_system.js`**，而是通过事件总线（EventBus）与它们通信（如 `phase:change`、`wave:advance` 等事件）。
*   **`combat_system.js`**
    *   **核心职责**：战斗逻辑、技能触发、伤害计算、动态难度调整（DDA）评估。
    *   **依赖关系**：依赖 `entities.js`（实体行为）和事件总线。
*   **`ui_system.js`**
    *   **核心职责**：UI 更新、商店渲染、HUD 管理，将视图渲染逻辑与业务逻辑分离。
    *   **依赖关系**：监听事件总线以更新视图，依赖 `config.js`。
*   **`entities.js`**
    *   **核心职责**：实体系统聚合入口，re-export 所有实体类。直接定义 `MarbleDefinition`、`SpecialSlot`、`FortuneWheel`、`Peg`、`DropBall`、飞剑系统（`SwordQi`、`SlashAnim`、`SonSword`）、`CloneSpore`、`Player`、`RuneLoot` 等实体；通过 import/re-export 聚合已拆分的子模块（`Enemy` → `entities/enemy.js`，`Projectile` → `entities/projectile.js`，工具函数 → `utils/math_utils.js`，特效类 → `effects/particles.js`）。包含高频调用的 `update` 方法，是性能优化的重点。
    *   **依赖关系**：依赖 `audio.js`（通过 `setAudioProvider` 注入，并统一分发给 `enemy.js` 和 `projectile.js`）、`config.js`、`utils/math_utils.js`、`effects/particles.js`、`entities/enemy.js` 和 `entities/projectile.js`。
*   **`config.js` / `rune_config.js`**
    *   **核心职责**：全局常量、属性字典、遗物、技能、商店配置及符文系统的数据字典。
    *   **依赖关系**：被几乎所有模块引用。

## 3. 智能编辑策略决策树

为了降低 Token 消耗并提高修改的精确度，在对代码进行修改时，必须严格遵守以下智能编辑策略决策树：

1.  **微型修改（< 20 行）**
    *   **判断标准**：修改涉及局部变量重命名、简单逻辑修复或单行代码调整。
    *   **执行策略**：使用搜索替换（Search and Replace）或行内编辑。

2.  **中型修改（20 - 200 行）**
    *   **判断标准**：修改涉及单一函数的重构、新增中等规模特性或局部接口调整。
    *   **执行策略**：使用 Unified Diff 格式进行补丁应用（Patch）。

3.  **大型修改（> 200 行）**
    *   **判断标准**：修改涉及对整个较小文件（< 500 行）的彻底重写。
    *   **执行策略**：全文件重写（Full File Rewrite）。**警告：严禁对超过 500 行的文件执行此策略。**

4.  **脚本化修改（结构化重构）**
    *   **判断标准**：修改涉及跨文件的大规模 API 替换、统一的格式化调整或复杂的结构重构。
    *   **执行策略**：编写 Python 或 Node.js 脚本，利用 AST 或正则表达式进行自动化重构。

## 4. 禁止行为清单

为保障项目的稳定性和工程规范，特制定以下禁止行为清单。任何违反以下规定的行为都将被视为不合格：

*   **禁止全量交付超大文件**：绝对禁止在未拆分的情况下，直接输出或覆盖超过 500 行的巨型文件（如 `entities.js` 约 3249 行，`combat_system.js` 约 2216 行；另有子模块 `entities/enemy.js` 约 1702 行、`ui/hud.js` 约 879 行、`game_phase.js` 约 1674 行等）。对于此类文件，必须先拆分，再局部修改。
*   **禁止跳过文档更新步骤**：任何对代码核心逻辑、API、架构或状态管理的修改，**必须在同一个 Commit 中同步更新对应模块的 `.cursor/rules/*.md` 文档**。代码与规范文档必须保持强一致性。
*   **禁止直接修改全局状态**：严禁在子系统（如 `game_phase.js` 或 `combat_system.js`）中直接通过 `this` 或 `window` 访问并修改全局 `Game` 实例的状态。必须使用 `event_bus.js` 进行状态同步。
*   **禁止业务逻辑操作 DOM**：严禁在非 UI 模块（特别是 `combat_system.js` 和 `entities.js`）中直接调用 DOM API（如 `innerHTML`、`classList.add` 等）。所有视图更新必须通过事件总线交由 `ui_system.js` 处理。
*   **禁止遗留魔法数字和 TODO**：在重构过程中，必须将硬编码的魔法数字提取到 `config.js` 中。严禁提交带有 `[AUTO-GENERATED] TODO:` 等无意义的机器生成注释的代码。
*   **禁止不当的历史文档存放**：历史更新文档、废弃的设计方案必须归档到 `docs/archive/` 目录，禁止散落在项目根目录或活跃的 `docs/` 目录中。
*   **禁止使用 Mixin 模式扩展 Game 类**：严禁在 `core.js` 文件末尾或任何地方使用 `Object.assign(Game.prototype, ...)` 将子系统方法批量混入 `Game` 原型。新增子系统必须遵循第 5 节「子系统扩展规范」中的组合模式。

## 5. 子系统扩展规范（Task 3.3 新增）

自 Task 3.3 起，`core.js` 已完全移除 `Object.assign(Game.prototype, ...)` Mixin 模式。当前采用的是**组合模式（Composition via bind）**。

### 当前架构状态

*   **已迁移完成的子系统（全部 10 个）**：
    *   `game_system.js`、`game_phase.js`、`combat_system.js`、`render_system.js`、`spawn_system.js`
    *   `ui_system.js`、`ui/hud.js`、`ui/shop.js`、`ui/rune_launcher.js`、`calc_utils.js`
*   **待迁移子系统**：无（全部完成）

### 组合模式实现方式

在 `Game` 构造函数的第一段，通过以下模式将子系统注入为实例方法：

```js
// core.js 构造函数开头
const _subsystems = [
    game_system, game_phase, combat_system, render_system, spawn_system,
    ui_system, hud_system, shop_system, rune_launcher_system,
    calc_utils
];
for (const subsystem of _subsystems) {
    for (const [key, val] of Object.entries(subsystem)) {
        if (typeof val === 'function') {
            this[key] = val.bind(this);  // 函数绑定到实例
        } else if (typeof val !== 'undefined') {
            this[key] = Array.isArray(val) ? [...val] : val;  // 非函数属性直接赋值
        }
    }
}
```

### 新增子系统的正确方式

如需新增子系统，必须遵循以下步骤：

1.  创建新的子系统文件（如 `src/new_system.js`），以对象字面量形式导出：
    ```js
    export const new_system = {
        newSystem_method() { /* 使用 this 访问 Game 实例 */ },
    };
    ```
2.  在 `core.js` 中导入新子系统：
    ```js
    import { new_system } from './new_system.js';
    ```
3.  将新子系统添加到 `_subsystems` 数组中：
    ```js
    const _subsystems = [
        ...,
        new_system  // 新增
    ];
    ```
4.  **严禁**在文件末尾添加 `Object.assign(Game.prototype, new_system)` 。

### 注意事项

*   组合模式创建的是**实例方法**（存在于实例上，而非原型链），每个 `Game` 实例拥有自己的方法副本。由于游戏只有一个实例，这不是问题。
*   子系统中的非函数属性（如 `_flyEffectPool: []`）会被拷贝到实例上，每个实例拥有独立副本（数组会浅拷贝）。
*   子系统方法中的 `this` 始终指向 `Game` 实例，无需修改子系统文件。

---

## 6. 自适应性能系统概述

> 详细规范见 [`.cursor/rules/performance.md`](performance.md)

### 性能瓶颈排名（Canvas 2D 渲染）

| 排名 | 瓶颈源 | 每帧开销原因 |
|------|---------|----------------|
| 1 | **粒子系统**（`mist`/`ember`/`shard`） | `createRadialGradient` + `shadowBlur` + `lighter`/`screen` 混合；上限 800 |
| 2 | **特效对象**（`Shockwave`/`FireWave`/`LightningBolt`） | 多层 `shadowBlur` + `lighter` 叠加，无原始数量上限 |
| 3 | **Peg 软阴影 + 底部光晕** | 每帧对约 50 个 Peg 各执行 `createRadialGradient` + `ellipse` |
| 4 | **敌人材质光泽** | `OffscreenCanvas` 上 `LinearGradient` 叠加，敌人构造时执行 |

### 性能等级与帧率关系

| 等级 | 触发条件 | 粒子上限 | 光效开关 |
|------|---------|---------|----------|
| `high` | 默认 / FPS > 55 连续 10s | 800 | 全开 |
| `medium` | FPS < 45 连续 3s | 400 | Peg 光晕关闭 |
| `low` | 在 medium 基础上 FPS < 45 连续 3s | 150 | 全关 |

### 对外可观测接口

```js
game.avgFps           // 当前 60 帧滑动平均帧率（整数）
game.perfQualityLevel // 当前性能等级：'high' | 'medium' | 'low'
```

### 修改性能相关功能的必读规则

1. **新增粒子类型**：在 `CONFIG.performance` 三档中添加对应上限字段，并在 `spawn_createParticle` 中读取。
2. **新增特效对象**：在创建处加入 `CONFIG.performance[this.perfQualityLevel || 'high'].xxxLimit` 检查。
3. **禁止硬编码上限**：严禁在特效创建函数中写死数字（如 `>= 800`），必须通过 `CONFIG.performance` 读取。
4. 详见 [`.cursor/rules/performance.md`](performance.md) 第 6 节「修改指南」。
