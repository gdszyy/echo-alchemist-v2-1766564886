# 试炼场场景化配置方案设计

## 1. 需求分析

目标：在试炼场（TrainingGround）中添加右侧边栏导航，支持场景化配置方案，用于演示敌人词条效果和具体的属性效果。

核心功能：
1.  **右侧边栏导航**：分类展示可用的演示场景（如：敌人/属性/Boss等）。
2.  **场景化配置**：每个场景通过配置参数即可完成初始化，无需硬编码复杂逻辑。
3.  **场景要素**：
    *   **初始的敌人布置**：设置初始状态（位置、血量、词条、温度等）。
    *   **敌人行动波的触发**：演示敌人特有行为。
    *   **玩家子弹配置**：预设特定的子弹属性组合（如高弹射、穿透、特定元素）。
    *   **发射玩家子弹**：自动或手动发射预设子弹，展示属性效果。

## 2. 现有组件与方法复用

通过分析现有代码（特别是 `systems.js` 中的 `TruthBook` 和 `TrainingGround`，以及 `spawn_system.js`、`game_phase.js`），我们发现试炼场已经具备了实现上述功能的大部分底层方法：

*   **敌人布置**：可以直接实例化 `Enemy` 对象并推入 `game.enemies` 数组。
*   **子弹配置**：`TrainingGround` 已有 `bulletConfig` 属性和 `resetBullet`、`adjustBullet` 方法。
*   **发射子弹**：`TrainingGround` 已有 `fireBullet` 方法（设置 `pendingFireVelocity`），或者可以直接调用 `spawn_spawnBullet` 生成特定子弹。
*   **敌人行动触发**：可以通过调用 `game.phase_enemy_processTurn(enemy)` 强制触发敌人行动。
*   **场景数据结构**：`TruthBook` 系统中的 `TRUTH_BOOK_DATA` 已经定义了一套非常完善的演示数据结构（包含 `setup` 和 `loop` 指令序列），这套机制非常适合直接迁移或适配到试炼场中。

## 3. 场景配置数据结构设计

我们可以在 `config.js` 或新建一个配置文件中定义试炼场的场景数据 `TRAINING_SCENARIOS`，结构参考 `TRUTH_BOOK_DATA`：

```javascript
const TRAINING_SCENARIOS = {
    categories: [
        { id: 'affix', name: '敵人詞條' },
        { id: 'attribute', name: '屬性效果' },
        { id: 'boss', name: '首領機制' }
    ],
    scenarios: [
        {
            id: 'demo_shield',
            categoryId: 'affix',
            name: '護盾魔像測試',
            icon: '🛡️',
            desc: '測試護盾的減傷效果與激光反射。',
            // 初始的敌人布置
            setup: (game) => {
                const w = game.enemyWidth;
                const h = game.enemyHeight;
                const top = game.combatGridTopY;
                // 放置一个带有 shield 词条的敌人
                game.enemies.push(new Enemy(2.5 * w + w/2, top + 1 * h + h/2, 60, 60, 1000, 1000, 'normal', ['shield']));
            },
            // 玩家子弹预设配置
            bulletConfig: {
                damage: 50, bounce: 0, pierce: 0, scatter: 0, multicast: 0,
                pyro: 0, cryo: 0, lightning: 0, wind: 0,
                isLaser: false, isMatryoshka: false, type: 'normal'
            },
            // 自动执行的演示序列 (可选，如果只是提供环境让玩家自己玩可以不要)
            // 试炼场主要是提供一个预设好的沙盒，所以 action 可能是可选的，
            // 或者是提供一个 "触发演示" 按钮来执行特定动作。
            demoAction: (game) => {
                // 例如：强制触发敌人行动，或自动发射一发子弹
            }
        },
        // ... 其他场景
    ]
};
```

## 4. UI 结构修改方案 (`index.html`)

在 `phase-training` 容器中，添加右侧边栏。

```html
<div id="phase-training" class="ui-overlay" style="display: none;">
    <!-- 左侧/中间：原有的试炼场主视图与控制面板 -->
    <div id="train-main-view" class="...">
        <!-- 原有的控制面板、预览等 -->
    </div>

    <!-- 新增：右侧边栏导航 -->
    <div id="train-sidebar" class="absolute right-0 top-0 bottom-0 w-64 bg-slate-900/95 border-l border-slate-700/50 flex flex-col z-50 transform transition-transform duration-300">
        <!-- 侧边栏标题 -->
        <div class="p-4 border-b border-slate-800">
            <h3 class="text-lg font-bold text-cyan-400">場景配置</h3>
        </div>
        
        <!-- 导航分类 Tab -->
        <div class="flex border-b border-slate-800">
            <button class="flex-1 py-2 text-xs font-bold text-amber-400 border-b-2 border-amber-400" onclick="game.trainingGround.switchCategory('affix')">敵人</button>
            <button class="flex-1 py-2 text-xs font-bold text-slate-400" onclick="game.trainingGround.switchCategory('attribute')">屬性</button>
            <button class="flex-1 py-2 text-xs font-bold text-slate-400" onclick="game.trainingGround.switchCategory('boss')">Boss</button>
        </div>

        <!-- 场景列表 -->
        <div id="train-scenario-list" class="flex-1 overflow-y-auto p-2 space-y-2 custom-scrollbar">
            <!-- 动态生成场景按钮 -->
        </div>
        
        <!-- 当前场景操作 -->
        <div class="p-4 border-t border-slate-800 bg-slate-950/50">
            <button onclick="game.trainingGround.triggerScenarioAction()" class="w-full py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded font-bold text-sm transition-colors shadow-lg">
                ▶ 觸發場景演示
            </button>
            <button onclick="game.trainingGround.resetCurrentScenario()" class="w-full py-2 mt-2 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded font-bold text-sm transition-colors">
                ⟳ 重置場景
            </button>
        </div>
    </div>
</div>
```

## 5. 核心逻辑实现 (`systems.js`)

修改 `TrainingGround` 类，增加场景管理逻辑。

```javascript
class TrainingGround {
    constructor(game) {
        // ... 原有初始化
        this.currentScenario = null;
        this.currentCategory = 'affix';
    }

    // ... 原有方法

    // 初始化侧边栏 UI
    initSidebarUI() {
        this.renderScenarioList();
    }

    // 切换分类
    switchCategory(categoryId) {
        this.currentCategory = categoryId;
        // 更新 Tab 样式
        // ...
        this.renderScenarioList();
    }

    // 渲染场景列表
    renderScenarioList() {
        const listContainer = document.getElementById('train-scenario-list');
        if (!listContainer) return;
        listContainer.innerHTML = '';
        
        const scenarios = TRAINING_SCENARIOS.scenarios.filter(s => s.categoryId === this.currentCategory);
        
        scenarios.forEach(scenario => {
            const btn = document.createElement('button');
            btn.className = `w-full text-left p-3 rounded-lg border transition-all flex items-center gap-3 ${
                this.currentScenario?.id === scenario.id 
                    ? 'bg-cyan-900/40 border-cyan-500' 
                    : 'bg-slate-800/40 border-slate-700/50 hover:bg-slate-700/60'
            }`;
            btn.innerHTML = `
                <span class="text-xl">${scenario.icon}</span>
                <div class="flex flex-col">
                    <span class="text-sm font-bold text-slate-200">${scenario.name}</span>
                </div>
            `;
            btn.onclick = () => this.loadScenario(scenario);
            listContainer.appendChild(btn);
        });
    }

    // 加载场景
    loadScenario(scenario) {
        this.currentScenario = scenario;
        this.renderScenarioList(); // 更新选中状态
        
        // 清理当前战场
        this.game.enemies = [];
        this.game.projectiles = [];
        this.game.particles = [];
        
        // 1. 设置子弹配置
        if (scenario.bulletConfig) {
            this.bulletConfig = { ...scenario.bulletConfig };
            this.renderAttributeControls();
            this.updateBulletPreview();
        }
        
        // 2. 执行初始敌人布置
        if (scenario.setup) {
            scenario.setup(this.game);
        }
        
        // 显示提示
        if (scenario.desc) {
            // 可以复用战斗阶段的消息提示，或者在侧边栏显示
            this.game.spawn_createFloatingText(this.game.width/2, this.game.height/2, scenario.name + " 已加載", "#22d3ee");
        }
    }

    // 重置当前场景
    resetCurrentScenario() {
        if (this.currentScenario) {
            this.loadScenario(this.currentScenario);
        } else {
            // 默认重置逻辑
            this.game.enemies = [];
            this.resetBullet();
        }
    }

    // 触发场景特有演示动作（如触发敌人攻击、发射特定子弹）
    triggerScenarioAction() {
        if (this.currentScenario && this.currentScenario.demoAction) {
            this.currentScenario.demoAction(this.game, this);
        } else {
            // 如果没有特定动作，默认执行发射子弹
            this.fireBullet();
        }
    }
}
```

## 6. 实施步骤

1.  **定义数据**：在 `systems.js` 中直接定义 `TRAINING_SCENARIOS`（可以大量复用 `TRUTH_BOOK_DATA` 的逻辑）。
2.  **修改 HTML**：在 `index.html` 的 `#phase-training` 中添加右侧边栏 DOM 结构。
3.  **修改 CSS**：添加必要的样式（如侧边栏布局、动画等），确保不遮挡试炼场原有内容。
4.  **修改 `TrainingGround` 类**：实现场景加载、重置、动作触发等逻辑。
5.  **集成测试**：进入试炼场，测试各个场景的加载、子弹配置应用、敌人生成和演示动作触发是否正常。
