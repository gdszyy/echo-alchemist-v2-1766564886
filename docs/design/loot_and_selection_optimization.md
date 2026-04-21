# 遗物与精华掉落及选择体验优化设计方案

## 1. 设计目标
优化遗物（Relic）与精华（Essence）从掉落到选择的视觉链路，增强“战利品”的获得感与仪式感。通过 3D 飞行动画将战场掉落物与 UI 选择界面有机结合，消除阶段切换时的视觉断层。

## 2. 核心交互流程

| 阶段 | 动作 | 视觉表现 |
| :--- | :--- | :--- |
| **战斗中** | 敌人击杀 | 触发 `RewardDropEffect` 爆发特效，随后在原地生成**持久掉落物实体**。 |
| **战斗结束** | 回合结算 | 掉落物实体保留在场上，不随战斗特效消失。 |
| **Resolver 启动** | 奖励结算开始 | 镜头（Container）平滑重置，场上掉落物发出吸引光效（前摇）。 |
| **选择阶段** | 卡片/弹珠生成 | 掉落物从场上位置起飞，带**飞行曲线**和**从小到大**的缩放，最终转化为 UI 卡片或弹珠。 |

## 3. 视觉与动画细节设计

### 3.1 场上掉落物实体 (Field Loot Entity)
*   **表现形式**：使用 Canvas 渲染的轻量级实体，具有简单的呼吸缩放和环境光晕。
*   **类型区分**：
    *   **遗物**：金色圣杯/宝箱虚影，带金色粒子环绕。
    *   **混沌精华**：紫红色不规则晶体，带微弱的电火花。
    *   **纯净精华**：蓝白色球体，带冰晶漂浮感。
*   **持久性**：存储在 `game.fieldLootItems` 数组中，生命周期跨越 `combat` 到 `selection` 阶段。

### 3.2 3D 飞行动画 (The "Fly-to-UI" Transition)
当 `sys_startRoundStartResolver` 消费一个奖励项时，触发此动画：
1.  **起点**：掉落物在 Canvas 上的世界坐标。
2.  **终点**：UI 界面中目标卡片（Relic Card）或弹珠（Marble Card）的中心坐标。
3.  **轨迹**：贝塞尔曲线（Bezier Curve），带随机的偏移量，模拟“喷涌而出后被吸入”的动态。
4.  **3D 效果**：
    *   利用 `game-container` 的 `perspective` 属性。
    *   飞行过程中增加 `rotateY` 和 `rotateX` 的旋转动画。
    *   **缩放**：从 `scale(0.2)` 快速增长至 `scale(1.2)`（过冲效果），最后落位回 `scale(1.0)`。

### 3.3 阶段衔接优化
*   **冻结战场**：进入 `selection` 阶段时，战场背景（钉子、存活敌人）保持半透明冻结状态，作为 3D 飞行的背景板。
*   **层级管理**：飞行动画使用独立的 DOM 叠层（或高层级 Canvas），确保在所有 UI 遮罩之上。

## 4. 技术实现方案

### 4.1 数据结构扩展
在 `Game` 类中新增：
*   `this.fieldLootItems = []`: 存储 `{x, y, type, id}`。

### 4.2 关键逻辑钩子
1.  **掉落生成**：修改 `sys_tryQueueEnemyRoundReward`，在播放 `RewardDropEffect` 的同时，向 `fieldLootItems` 添加数据。
2.  **Resolver 消费**：在 `sys_startRoundStartResolver` 的循环中，根据 `reward.source` 找到对应的 `fieldLootItem`，触发 `ui_playLootToCardAnimation`。
3.  **UI 动画函数**：
    ```javascript
    ui_playLootToCardAnimation(startPos, targetPos, type) {
        // 1. 创建 DOM 代理节点
        // 2. 计算贝塞尔曲线路径
        // 3. 执行 CSS Animation / Web Animations API
        // 4. 动画结束时，显示真正的 UI 卡片并移除代理
    }
    ```

### 4.3 性能自适应
*   **High 档**：全量 3D 旋转 + 贝塞尔曲线 + 拖尾粒子。
*   **Medium 档**：简化 3D 旋转，保留缩放与曲线。
*   **Low 档**：线性飞行 + 缩放，禁用 3D 旋转与粒子。

## 5. 待办事项 (TODO)
- [ ] 在 `entities.js` 中定义 `FieldLootItem` 类。
- [ ] 在 `render_system.js` 中添加 `fieldLootItems` 的渲染逻辑。
- [ ] 在 `ui_system.js` 中实现 `ui_playLootToCardAnimation`。
- [ ] 修改 `game_system.js` 的奖励排队与消费逻辑，注入坐标信息。
