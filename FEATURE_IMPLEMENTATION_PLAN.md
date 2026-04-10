# Echo Alchemist v2 新功能实现计划

## 1. 项目概述

本项目为 `echo-alchemist-v2` 的新功能迭代计划，旨在增强玩家在游戏中的交互体验和策略深度。本次迭代主要包含三个核心需求：强化手机偏移（倾斜）时的视觉提示效果、实现偏移加速度的动态加成与衰减机制，以及为发射器引入全新的符文词条系统。

本文档基于对现有 Godot 4.x 项目结构及迁移自 JavaScript 的源码分析，提供详细的技术实现方案。

## 2. 手机偏移提示强化方案

### 2.1 需求分析
当前游戏支持通过设备陀螺仪（或鼠标拖拽）产生偏移（`tilt`），影响弹珠的重力方向和背景视差。但当玩家处于偏移状态时，缺乏足够明显的 UI 提示，导致玩家可能无法直观感知当前的倾斜状态和程度。

### 2.2 实现方案

我们需要在游戏界面中增加一个专门的“偏移指示器”（Tilt Indicator），并在背景或边框增加动态反馈。

**1. UI 偏移指示器 (Tilt Gauge)**
*   **位置**：建议放置在屏幕顶部居中或底部中心，避免遮挡主要游戏区域。
*   **形态**：一个水平的进度条或水平仪（Bubble Level）样式。中心点代表平衡（0），左右两侧代表偏移方向和程度。
*   **视觉反馈**：
    *   中心点使用明显的标记（如竖线或菱形）。
    *   当前偏移量使用一个高亮的光标（Indicator）表示。
    *   当偏移量较大时，光标颜色从白色/蓝色渐变为警告色（如橙色/红色）。
    *   在光标两侧可以增加轻微的发光效果（Glow），增强科技感。

**2. 屏幕边缘环境光 (Edge Vignette)**
*   **机制**：利用现有的屏幕四周暗角/环境光逻辑（在 `gathering_scene.gd` 或 `render_effects.gd` 中）。
*   **效果**：当手机向左偏移时，屏幕左侧边缘出现轻微的蓝色或紫色发光；向右偏移时，右侧边缘发光。偏移角度越大，发光范围和透明度越高。这能提供非常直观的外围视觉反馈。

**3. 代码修改定位**
*   **脚本**：`godot_project/scripts/ui/hud.gd` 或新增 `tilt_indicator.gd`。
*   **逻辑**：在 `_process` 中读取 `PhaseManager` 或 `GameManager` 中的 `board_tilt` 值，更新 UI 元素的位置和颜色。
*   **渲染**：在 `godot_project/scripts/systems/render_effects.gd` 中增加基于 `tilt` 的屏幕边缘泛光绘制逻辑。

## 3. 偏移加速度加成衰减机制

### 3.1 需求分析
当前弹珠受到的横向重力是线性的：`vel.x += tilt.x * tilt_influence`。
新需求要求：
1. 在一开始向左/向右偏移时，施加的加速度有 25% 的加成。
2. 该加成会快速衰减。
3. 每一次经过平衡点（不偏左不偏右，即 `tilt.x` 越过 0）都会重置该加成。

### 3.2 实现方案

我们需要在弹珠的物理更新逻辑中引入“动量爆发”（Momentum Boost）状态机。

**1. 状态变量定义**
在 `DropBall` 类（`godot_project/scripts/entities/drop_ball.gd`）中新增以下变量：
*   `current_tilt_direction`: 记录当前的倾斜方向（-1 为左，1 为右，0 为平衡）。
*   `tilt_boost_multiplier`: 当前的加速度加成倍率（初始为 1.25）。
*   `tilt_boost_decay`: 衰减率（例如每帧衰减 0.05，直到 1.0）。

**2. 核心逻辑更新**
在 `DropBall.update()` 方法中修改重力计算逻辑：

```gdscript
# 伪代码逻辑
var tilt_x = tilt.x
var new_direction = sign(tilt_x)

# 检查是否越过平衡点 (方向改变，且不是停留在绝对0点)
if new_direction != 0 and new_direction != current_tilt_direction:
    # 越过平衡点，重置加成
    tilt_boost_multiplier = 1.25
    current_tilt_direction = new_direction
elif abs(tilt_x) < 0.05:
    # 处于平衡点附近死区，可视为重置状态
    current_tilt_direction = 0

# 计算衰减
if tilt_boost_multiplier > 1.0:
    tilt_boost_multiplier -= tilt_boost_decay * time_scale
    tilt_boost_multiplier = max(1.0, tilt_boost_multiplier)

# 应用带有加成的加速度
if tilt != Vector2.ZERO:
    vel.x += tilt.x * tilt_influence * tilt_boost_multiplier
```

**3. 视觉协同 (可选)**
当 `tilt_boost_multiplier > 1.0` 时，可以在弹珠后方生成少量的加速尾迹粒子（Trail Particles），或者让弹珠产生轻微的形变（Squash and Stretch），以强调“爆发”感。

## 4. 发射器符文词条系统

### 4.1 需求分析
这是一个全新的核心系统，旨在增加局外/局内的策略深度。
1. **填字机制**：发射器包含一个网格（如 3x3 或 4x4），玩家可以放入符文。
2. **词条组成**：横、竖、斜方向上相邻的符文可以组合成特定的词条（类似《暗黑破坏神2》的符文之语或《流放之路》的机制）。
3. **获取途径**：击杀敌人掉落。
4. **智能掉落**：敌人携带的词条属性会影响掉落符文的倾向，越针对某种套路，越容易掉落加强该套路的符文。

### 4.2 实现方案

**1. 符文数据结构 (`rune_database.gd`)**
定义基础符文（如：火、冰、雷、风、力、速、形等）。
```gdscript
class RuneData:
    var id: String
    var name: String
    var element: String # pyro, cryo, etc.
    var icon: Texture2D
```

**2. 词条组合词典 (`runeword_database.gd`)**
定义组合配方和对应的效果。
```gdscript
const RUNEWORDS = {
    "fire_storm": {
        "pattern": ["fire", "wind", "fire"],
        "effect": "发射时有概率触发火焰风暴",
        "stats": {"pyro_damage": 50, "scatter": 2}
    },
    "ice_spear": {
        "pattern": ["cryo", "force", "shape"],
        "effect": "子弹变为穿透冰矛",
        "stats": {"pierce": 3, "cryo_damage": 30}
    }
}
```

**3. 发射器网格系统 (`launcher_grid.gd`)**
*   **UI 界面**：在 Meta 阶段或商店界面提供一个可交互的网格 UI。玩家可以拖拽库存中的符文到网格中。
*   **解析算法**：每次网格变动时，遍历所有行、列、对角线，提取符文 ID 序列。
*   **匹配逻辑**：将提取的序列与 `RUNEWORDS` 字典进行匹配。支持正向和反向匹配。激活的词条会高亮显示，并将属性加成汇总到全局 `GameManager` 或 `Config` 中，供战斗系统读取。

**4. 智能掉落系统 (`loot_system.gd`)**
*   在敌人死亡时（`enemy.gd` 的 `_on_death` 信号），触发掉落判定。
*   **权重计算**：
    *   读取玩家当前激活的词条或主要的伤害属性。
    *   读取被击杀敌人的属性（如 `enemy.affixes` 或其类型）。
    *   构建一个动态权重池。例如，如果玩家主要使用火焰伤害，且击杀了一个冰霜属性的敌人（被克制），则增加“火”属性符文的掉落权重。
*   **生成符文**：根据计算出的权重随机生成符文，以战利品形式掉落，玩家拾取后存入库存。

### 4.3 开发阶段划分

1.  **第一阶段：底层数据结构**
    *   创建 `rune_database.gd` 和 `runeword_database.gd`。
    *   实现掉落物实体（Loot Entity）和基础拾取逻辑。
2.  **第二阶段：UI 与交互**
    *   开发发射器网格 UI，实现拖拽放置功能。
    *   实现网格解析算法，正确识别激活的词条。
3.  **第三阶段：战斗系统集成**
    *   将激活的词条属性注入到 `combat_system.gd` 的弹药生成逻辑中。
    *   实现智能掉落权重计算逻辑。

## 5. 总结

这三项功能的加入将显著提升游戏的物理反馈感和构筑深度。建议优先实现偏移提示和加速度机制，因为这两项修改集中在现有的物理和 UI 层，见效快；符文词条系统作为一个大型系统，可以作为下一个大版本的核心卖点进行独立分支开发。
