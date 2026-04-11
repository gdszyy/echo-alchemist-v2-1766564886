---
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
- **函数签名** (Boss 符文掉落系统扩展):
  ```js
  loot_calcRuneDrop(game, overrideOptions = {})
  ```
  - `overrideOptions.forcedLevel` {number}: 强制指定掉落等级（如 2）
  - `overrideOptions.themeWeights` {Object}: Boss 主题额外权重注入（如 `{ pyro: 3.0, laser: 3.0 }`）
  - **返回值**: `{ runeId: string|null, level: number }` 对象（原来直接返回字符串，已升级）
- **调用方彿变更警告**: 所有调用方必须适配新返回对象格式。已更新的调用方：
  - `combat_system.js`: Boss 死亡掉落、普通敌人掉落、`combat_runeCharge_initUI`
  - `rune_system.js`: `rune_reforge` 重铸函数

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

## 6. Boss 符文掉落系统 (`combat_system.js` + `config.js`)

### 6.1 Boss 死亡丰厚掉落
- Boss 死亡必定掉落 **3 个** 符文，分别为：
  - **掉落 1**：`forcedLevel: 2` + `themeWeights: bossThemeWeights`（主题符文 + Lv2）
  - **掉落 2**：20% 概率 `forcedLevel: 2`，否则 `forcedLevel: 1`（智能掉落）
  - **掉落 3**：标准掉落（无 overrideOptions）
- 掉落物正常出现在场地，玩家手动拾取。
- `RuneLoot` 对象通过动态属性 `loot.level` 存储掉落等级。

### 6.2 Boss 狂暴阶段即时掉落
- Boss HP 首次降至 50% 时，立即自动掉落 1 个 Lv1 符文并拾取入库。
- 使用 `enemy._bossEnrageDropped` 标志确保每个 Boss 仅触发一次。
- 自动拾取复用现有拾取逻辑（直接 `push` 到 `runeInventory`）。

### 6.3 Boss 主题权重配置 (`config.js` 中的 `BOSS_DB`)
- `BOSS_DB` 包含 8 个 Boss 的 `themeWeights` 配置。
- `themeWeights` 键为 RUNE_DB 中的 `element` 字段，在 `loot_calcRuneDrop` 第三层抽取中放大对应属性符文的掉落权重。
- Boss 实体需将对应的 `BOSS_DB` 条目引用为 `enemy.bossConfig`，供死亡掉落逻辑读取。

## 7. 掉落权重边际递减 (Marginal Decay)
### 7.1 触发时机
- 计算符文掉落权重时（`loot_system.js` 中的 `_calcBuildVector`）。
### 7.2 机制
- 统计玩家近期伤害占比 `buildVector` 时，如果某一属性的伤害占比超过阈值（默认 60%），则对超出部分进行衰减。
- 衰减系数为 0.5，即超出部分减半。
- 衰减后重新归一化 `buildVector`，防止玩家过度依赖单一属性导致掉落过于单一。
