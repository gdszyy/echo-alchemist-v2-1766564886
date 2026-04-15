# 游戏系统与试炼场规范 (systems.js)

本文档定义了 `src/systems.js` 中包含的核心子系统规范，重点涵盖 **试炼场 (TrainingGround)** 和 **真理之书 (TruthBook)** 的架构约定与场景化配置扩展方法。

## 1. 模块职责边界

`systems.js` 包含两个主要的独立子系统，均采用组合模式（Composition）挂载到全局 `Game` 实例上：
*   `TrainingGround` (`game.trainingGround`)：试炼场系统，提供沙盒环境测试敌人词缀、子弹属性与 Boss 机制。
*   `TruthBook` (`game.truthBook`)：真理之书系统，提供游戏内图鉴与机制说明。

## 2. 试炼场场景化配置 (TrainingGround)

试炼场采用 **数据驱动的场景化配置架构**，所有场景定义在 `TRAINING_SCENARIOS` 常量中。后续 Agent 若需新增或修改测试场景，**仅需修改数据结构，无需改动 UI 逻辑**。

### 2.1 场景数据结构契约

新增场景必须在 `TRAINING_SCENARIOS.scenarios` 数组中添加符合以下契约的对象：

```javascript
{
    id: 'unique_scenario_id',    // [必填] 全局唯一标识符
    categoryId: 'enemy',         // [必填] 所属分类（'enemy' | 'attribute' | 'boss'）
    name: '场景显示名称',          // [必填] 右侧边栏显示的按钮文本
    icon: '🛡️',                  // [可选] 按钮前缀图标（Emoji）
    desc: '场景说明文字',          // [可选] 右下角显示的机制说明
    
    // [核心] 初始状态布置钩子
    setup: (game) => {
        // 在此调用 game.spawn_spawnEnemy 或 game.spawn_spawnBoss
        // 坐标参考：
        // 中心：x = game.width / 2, y = game.height / 2
        // 网格对齐：使用 game.enemyWidth 和 game.enemyHeight
    },
    
    // [可选] 预置子弹配置（覆盖默认面板）
    bulletConfig: { 
        damage: 30, 
        bounce: 0, 
        pierce: 0, 
        isLaser: false,
        // ... 其他属性
    },
    
    // [可选] 点击“触发演示”按钮时执行的动作
    demoAction: (game, trainingGround) => {
        // 示例：触发敌人行动波
        // game.phase_enemy_startLogic();
        // 示例：自动发射子弹
        // game.spawn_spawnBullet(x, y, vel, config);
    }
}
```

### 2.2 试炼场 UI 渲染机制（防坑指南）

*   **DOM 动态生成**：`#phase-training` 及其内部的控制面板、右侧边栏完全由 `TrainingGround.initUI()` 动态创建，**并未硬编码在 `index.html` 中**。
*   **右侧边栏 (Sidebar)**：包含分类 Tab 和场景列表。切换分类由 `switchCategory(id)` 处理，点击场景由 `loadScenario(id)` 处理。
*   **Boss 入场动画特殊处理**：试炼场不走完整的战斗阶段（`phase === 'training'`），因此在 `loadScenario` 中有专门针对 `categoryId === 'boss'` 的硬编码逻辑：强制将 `e._pendingEntrance = false` 并设置 `e.entranceTimer = 1` 以激活 Boss 入场动画。

## 3. 真理之书图鉴配置 (TruthBook)

真理之书同样采用数据驱动架构，数据定义在 `TRUTH_BOOK_DATA` 中。

### 3.1 图鉴数据结构契约

新增图鉴条目必须在 `TRUTH_BOOK_DATA.entries` 中添加：

```javascript
{
    id: 'entry_id',
    categoryId: 'basic',      // 分类
    title: '条目标题',
    content: '详细说明文字（支持多行）',
    
    // [可选] 图鉴附带的互动演示
    setup: (demoGame) => {
        // 在右侧画布 (demoGame) 中布置演示场景
    },
    demoAction: (demoGame) => {
        // 演示动画逻辑
    }
}
```

## 4. 全局禁止行为

*   **禁止修改 DOM 结构**：若需调整试炼场布局，必须修改 `initUI()` 或 `initSidebar()` 中生成的 HTML 字符串，严禁尝试去 `index.html` 中寻找这些元素。
*   **禁止绕过场景系统硬编码测试**：测试新机制时，必须通过在 `TRAINING_SCENARIOS` 中添加临时场景来进行，严禁直接修改 `TrainingGround.enter()` 的初始逻辑。
