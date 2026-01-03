# Phase Combat Update 重构计划

## 目标
将 `phase_combat_update()` 函数拆分为:
- `combat_updateLogic()`: 纯逻辑更新
- `combat_render2D()`: 纯2D渲染

## 分析结果

### 原函数结构 (7246-7858行, 613行)

**纯逻辑部分 (7246-7376, 131行)**:
- 子剑队列处理
- 充能动画
- 重装填动画
- 轨道旋转物理
- UI更新
- 剑气更新
- 爆发队列处理
- 视差参数计算

**混合部分 (7377-7858, 482行)** - 需要拆分:
- 背景网格绘制 (渲染)
- 敌人回合扫描波绘制 + 逻辑触发 (混合)
- 墙壁绘制 (渲染)
- 敌人更新 + 绘制 (混合)
- 弹丸更新 + 绘制 (混合)
- 特效更新 + 绘制 (混合)
- 子剑更新 + 绘制 (混合)
- 回合结束逻辑 (逻辑)
- 炮台绘制 (渲染)

## 重构策略

### 1. combat_updateLogic() 包含:
- 所有实体的 `.update()` 调用
- 所有状态修改 (hasActedThisTurn, isEnemyTurn等)
- 所有数组操作 (.splice, .filter)
- 回合逻辑 (phase_enemy_*, phase_finalize*)
- 计时器更新
- 游戏结束判定
- 货币结算
- 能量衰减

### 2. combat_render2D() 包含:
- 所有 ctx.* 绘制调用
- 所有实体的 `.draw()` 调用
- 背景、网格、墙壁绘制
- UI叠加层绘制

### 3. 共享数据:
通过实例变量传递状态:
- `this.activeEnemies`
- `this.anyEnemyMoving`
- `this.gameOver`

## 实施步骤

1. 创建 combat_updateLogic() 函数
   - 复制纯逻辑部分
   - 从混合部分提取所有update调用
   - 添加状态变量存储

2. 创建 combat_render2D() 函数
   - 复制所有渲染代码
   - 移除update调用
   - 使用实例变量读取状态

3. 修改 phase_combat_update()
   - 调用 combat_updateLogic()
   - 调用 combat_render2D()

4. 测试验证
   - 游戏逻辑正常
   - 2D渲染正常
   - 无功能回归
