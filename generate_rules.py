import os

rules_dir = '/home/ubuntu/project-repo/.cursor/rules'
os.makedirs(rules_dir, exist_ok=True)

# 1. audio.md
audio_content = """---
description: "音频系统的架构约定、延迟初始化机制与已知问题"
globs: ["src/audio.js"]
---
# 音频系统规范 (Audio System)

## 1. 架构约定
- **核心类**: `SoundManager` 负责管理所有音频播放、加载和状态。
- **事件驱动**: 依赖 `EventBus` 进行解耦，避免与其他模块（如 `core.js`）产生循环依赖。

## 2. 延迟初始化机制
- **浏览器策略限制**: 现代浏览器禁止在用户交互前自动播放音频（Autoplay Policy）。
- **实现方式**: `AudioContext` 必须在用户首次交互（如点击、触摸）时才进行初始化。
- **最佳实践**: 
  - 不要在全局作用域直接实例化 `AudioContext`。
  - 使用 `init()` 或类似方法，在捕获到用户交互事件时初始化音频系统。
  - 播放声音前必须检查音频系统是否已成功初始化。

## 3. 已知问题与修改规范
- **内存泄漏**: 频繁创建 `AudioContext` 或未正确释放音频节点可能导致内存泄漏，需确保资源正确释放。
- **并发限制**: 同时播放过多音效可能导致音频失真或被浏览器截断，需实现音效池或并发控制。
- **修改规范**: 
  - 添加新音效时，必须在配置中统一定义，并通过 `SoundManager` 统一调度。
  - 严禁在 UI 或业务逻辑中直接操作 `AudioContext` 或创建 `Audio` 对象。
"""
with open(os.path.join(rules_dir, 'audio.md'), 'w', encoding='utf-8') as f:
    f.write(audio_content)

# 2. config.md
config_content = """---
description: "全局配置结构、数据字典格式与修改规范"
globs: ["src/config.js"]
---
# 配置模块规范 (Config System)

## 1. 配置结构
`src/config.js` 集中管理游戏的所有常量和静态数据字典，主要包含：
- **系统配置**: 屏幕尺寸、帧率、物理引擎参数等。
- **UI 配置**: 颜色主题、字体大小、层级 (z-index) 定义。
- **游戏数值**: 基础掉落率、难度系数、经济系统数值。

## 2. 数据字典格式
- **`ELEMENT_CONFIG`**: 定义弹珠/钉子的元素属性（如物理、火焰、冰霜等）及其对应的颜色、基础伤害倍率和特殊效果。
- **`RELIC_DB`**: 遗物数据库，定义遗物的 ID、名称、描述、稀有度和具体效果逻辑。
- **`SKILL_DB`**: 技能数据库，定义玩家或敌人的技能效果、冷却时间和触发条件。

## 3. 修改规范
- **集中管理**: 严禁在业务逻辑中硬编码魔法数字（Magic Numbers）或颜色值，必须提取到 `config.js`。
- **格式一致性**: 添加新数据字典条目时，必须严格遵循现有对象的键名和数据类型结构。
- **注释说明**: 修改核心数值或添加新配置项时，必须添加注释说明其用途和影响范围。
"""
with open(os.path.join(rules_dir, 'config.md'), 'w', encoding='utf-8') as f:
    f.write(config_content)

# 3. rune_system.md
rune_content = """---
description: "符文系统完整规范（智能掉落、网格拼图、合成重铸）"
globs: ["src/rune_system.js", "src/rune_config.js", "src/loot_system.js"]
---
# 符文系统规范 (Rune System)

## 1. 系统概述
符文系统是游戏局内的核心策略维度，包含智能掉落算法、网格拼图逻辑以及合成重铸规则。

## 2. 智能掉落算法 (`loot_system.js`)
- **机制**: 敌人的符文掉落并非纯随机。
- **流程**:
  1. **套路识别**: 分析玩家近几回合的伤害构成。
  2. **克制映射**: 结合套路克制关系（如火焰克制护盾/再生），动态提高相关符文的掉落权重。
  3. **加权抽取**: 基于动态权重进行随机抽取，确保掉落物符合玩家当前构建需求。

## 3. 网格拼图逻辑 (`rune_system.js`)
- **发射器网格**: 3x3 的符文放置区域。
- **双重增益**:
  - **基础加成**: 网格内符文提供基础属性层数加成。
  - **符文之语**: 当符文排列满足特定形状（如直线、对角线）时，激活强力的组合词条（Runeword）。
- **解析算法**: `parseRuneGrid` 函数负责遍历网格路径并进行正反向匹配，识别激活的符文之语。

## 4. 合成与重铸规则
- **合成 (`rune_merge`)**: 
  - 条件: 3个同 ID、同等级的符文。
  - 结果: 合成为1个高一等级的同 ID 符文。
- **重铸 (`rune_reforge`)**: 
  - 条件: 任意3个符文。
  - 结果: 消耗这3个符文，产出1个新符文，等级为这3个符文等级的平均值（向下取整）。新符文 ID 通过 `loot_calcRuneDrop` 获取。
- **原子性**: 两个操作都必须有严格的预检机制，确保扣除和产出同时成功或失败。

## 5. 数据结构 (`rune_config.js`)
- 符文对象标准格式: `{ id: String, level: Number }`。
- `RUNE_DB`: 符文基础信息定义（包含 `baseStat`）。
- `RUNEWORD_DB`: 符文之语组合规则定义。
"""
with open(os.path.join(rules_dir, 'rune_system.md'), 'w', encoding='utf-8') as f:
    f.write(rune_content)

# 4. game_phase.md
phase_content = """---
description: "阶段转换逻辑与状态机规范"
globs: ["src/game_phase.js"]
---
# 游戏阶段规范 (Game Phase)

## 1. 状态机概述
游戏主流程围绕三个核心阶段进行循环：命运抉择 (Selection) → 研磨 (Gathering) → 战斗 (Combat)。
- 阶段流转由 `game_phase.js` 统一管理。
- 严禁跨阶段直接调用生命周期方法，必须通过标准状态机接口切换。

## 2. 各阶段职责与出入口条件
### 2.1 命运抉择阶段 (Selection Phase)
- **职责**: 玩家在回合开始前选择初始属性、遗物或符文。
- **入口**: 回合初始化完成，UI 呈现选择卡片。
- **出口**: 玩家做出选择并确认，触发转场动画进入研磨阶段。

### 2.2 研磨阶段 (Gathering Phase)
- **职责**: 核心打砖块玩法，发射弹珠收集属性，填充弹药队列。
- **入口**: 命运抉择结束，钉板生成完毕，玩家获得发射次数。
- **出口**: 玩家耗尽发射次数且所有弹珠结算完毕，进入战斗阶段。

### 2.3 战斗阶段 (Combat Phase)
- **职责**: 使用收集到的弹药队列攻击敌人，进行回合制结算。
- **入口**: 研磨阶段结束，弹药队列生成，敌人刷新。
- **出口**: 
  - 胜利: 敌人血量清零，触发掉落结算，进入下一回合的命运抉择阶段。
  - 失败: 玩家防线被突破，游戏结束 (Game Over)。

## 3. 阶段转换规范
- **清理与重置**: 每次阶段切换（`phase_switchPhase`）时，必须彻底清理上一个阶段的残留状态（如清空粒子特效容器、重置物理引擎状态）。
- **UI 同步**: 阶段切换必须同步触发相应的 UI 更新事件，确保界面呈现与内部状态一致。
"""
with open(os.path.join(rules_dir, 'game_phase.md'), 'w', encoding='utf-8') as f:
    f.write(phase_content)

print("Rules generated successfully.")
