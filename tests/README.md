# Echo Alchemist v2 — AI 自动化测试套件

本目录包含两类测试工具，覆盖游戏核心机制的 AI 可执行验证流程。

---

## 文件结构

| 文件 | 类型 | 依赖 | 说明 |
|---|---|---|---|
| `validate_scenarios.js` | 静态校验 | Node.js（无需浏览器） | 验证 `TRAINING_SCENARIOS` 数据结构完整性 |
| `validate_boss_vulnerability.mjs` | 静态校验 | Node.js（无需浏览器） | 验证 Boss 破绽谱重设计与旧 `weak_spot` 机制移除 |
| `validate_rune_spell_forms.mjs` | 静态校验 | Node.js（无需浏览器） | 验证符文词条 Spell Form V1 的中心法阵匹配契约 |
| `validate_potion_vfx_contract.mjs` | 静态校验 | Node.js（无需浏览器） | 验证药剂法术的药瓶形态字段与战斗 VFX helper 契约 |
| `validate_spell_vfx_design.mjs` | 静态校验 | Node.js（无需浏览器） | 验证法术形态特效设计文档覆盖所有形态与实现契约 |
| `validate_potion_spell_content.mjs` | 运行时规则校验 | Node.js（无需浏览器） | 验证 C4 从 `RUNEWORD_DB` 解析隐藏 spellContent 与黑箱 UI 不泄露 |
| `validate_potion_nesting.mjs` | 运行时规则校验 | Node.js（无需浏览器） | 验证药剂嵌套合法性共享函数的正向与反向规则 |
| `validate_potion_c6_nesting_ui.mjs` | 运行时规则校验 | Node.js（无需浏览器） | 验证 C6 多节点炼成 UI 的合法接入、非法坍塌、不返符文与黑箱预览 |
| `validate_potion_spell_tree_combat.mjs` | 运行时契约校验 | Node.js（无需浏览器） | 验证 Root Orb carrier、Tower active/death 与非法 spellTree 战斗行为 |
| `ai_test_runner.js` | 运行时测试 | Puppeteer + 本地游戏服务 | 驱动浏览器进行实机行为验证 |

---

## 快速开始

### 1. 静态结构校验（无需启动游戏）

```bash
node tests/validate_scenarios.js
```

验证内容：
- 所有分类（enemy / attribute / boss / runeword / **relic**）是否存在
- 8 个遗物/精华专项场景是否完整
- 每个场景的 `bulletConfig`、`name`、`desc` 字段是否齐全
- 场景 ID 唯一性、`categoryId` 合法性

### 1.1 Boss 破绽契约校验（无需启动游戏）

```bash
node tests/validate_boss_vulnerability.mjs
```

验证内容：
- 普通波次不再包含旧 `weak_spot` 低血量弱点怪
- Boss 配置不再使用旧 `weakness` 字段
- 8 个 Boss 都有 `vulnerability` 破绽谱
- 战斗管线保留 Boss 破绽进度与易伤窗口入口
- Boss 覆盖按实际命中次数和按实际伤害量两种累积方式
- 回合缩放参数存在，后期破绽条件更苛刻

### 1.2 符文法阵契约校验（无需启动游戏）

```bash
node tests/validate_rune_spell_forms.mjs
```

验证内容：
- 词条默认必须组成穿过 3x3 中心的轴线法阵
- `pattern[1]` 核心符文必须位于中心格
- 外环试剂允许在同一轴线两端反向
- 同一词条可通过多条穿心轴线提升等级
- `spellFormula.shape = 'loose_line'` 保留旧式无序线匹配回退

### 1.3 药剂药瓶 VFX 契约校验（无需启动游戏）

```bash
node tests/validate_potion_vfx_contract.mjs
```

验证内容：
- 9 个 `POTION_SPELL_DB` 药剂都声明 `spellType`、`formId: 'bottle'`、`nestingMode: 'shatter'`
- 每个药剂都声明 `vfxProfile` 的目标、碎裂样式与语义标签
- 战斗层存在统一的 `combat_playPotionBottleVFX()` helper
- 药瓶碎裂表现复用现有粒子、投射物爆破、同化脉冲、同化波与短电弧入口
- `combat_playPotionShatterVFX()` 覆盖 `seal`、`mist_bloom`、`mark`、`shard_sigil`、`collapse_ring`、`overload_blast` 等具体碎裂样式

### 1.4 法术形态特效设计覆盖校验（无需启动游戏）

```bash
node tests/validate_spell_vfx_design.mjs
```

验证内容：
- `docs/rune_potion_spell_contract.md` 已链接到 `docs/spell_vfx_design.md`
- 特效设计文档覆盖 `bottle`、`orb`、`mine`、`beam`、`orbit`、`slash`、`meteor`、`sweeping_laser`、`tower`
- 文档包含表现矩阵、单形态规格、实现顺序和验收清单
- 文档声明后续运行时入口、配置表、性能预算和 `@perf-impact` 约束

### 1.5 药剂 C4 spellContent 解析校验（无需启动游戏）

```bash
node tests/validate_potion_spell_content.mjs
```

验证内容：
- 合法 `RUNEWORD_DB` 公式可生成隐藏 `spellContentId` / `spellType`
- 同符文集合但核心位不同的公式能稳定区分
- 非法组合进入未成法路径，链式/禁用类词条进入明确排斥路径
- `preparedPotionSpell` 仍可保留旧静态 `potionId`，同时保存 root `spellTree`
- 封装前预览不拼出 `spellContentId`、`runewordId`、`spellType`、药剂名、品质或装药量

### 1.6 药剂嵌套合法性校验（无需启动游戏）

```bash
node tests/validate_potion_nesting.mjs
```

验证内容：
- Root Orb 无子节点也合法
- Orb -> Orb、Beam 命中生成 Orb、纯扣血、链式反应、active/death 双槽混用均被共享规则拒绝
- Tower active/death 与 construct 子节点禁用项走同一个 `src/potion_nesting.js` 入口

### 1.7 药剂 spellTree 战斗运行时校验（无需启动游戏）

```bash
node tests/validate_potion_spell_tree_combat.mjs
```

验证内容：
- Root Orb 在 `children: []` 时仍生成 `potion_orb_carrier`，飞行到点后才破裂结算
- Active Tower 生成 `potion_tower` 正式实体并周期作用敌人
- Death Tower 不提前 pulse，销毁时触发一次释放
- 非法 Orb -> Orb 树不会生成 carrier 或 tower 运行时

### 2. 运行时自动化测试（需要本地游戏服务）

**安装依赖：**
```bash
pnpm add puppeteer
# 或
npm install puppeteer
```

**启动游戏服务：**
```bash
npm start
# 默认监听 http://localhost:3002
```

**运行全部测试套件：**
```bash
node tests/ai_test_runner.js --url http://localhost:3000
```

**运行指定套件：**
```bash
node tests/ai_test_runner.js --suite smoke    # 冒烟测试
node tests/ai_test_runner.js --suite relic    # 遗物系统
node tests/ai_test_runner.js --suite essence  # 精华系统
node tests/ai_test_runner.js --suite runeword # 符文词条
node tests/ai_test_runner.js --suite enemy    # 敌人词条
node tests/ai_test_runner.js --suite overlay  # Overlay 返回链路
node tests/ai_test_runner.js --suite pinboard # 钉板编辑闭环
```

**无头模式（CI 环境）：**
```bash
node tests/ai_test_runner.js --headless
```

---

## 测试套件说明

### `smoke` — 冒烟测试
验证游戏基础加载、试炼场进入、DOM 渲染、新增 `relic` 分类是否存在。

### `relic` — 遗物系统测试

| 测试用例 | 验证点 |
|---|---|
| 保底计数器初始化 | `game.dropPity.essence === 0` |
| 模拟击杀后计数器递增 | `dropPity.essence` 增加或奖励队列有内容 |
| 遗物选择界面弹出 | overlay 可见或 `pendingRoundStartRewards` 正确压入 |
| 钉盘形态互斥 | `ownedRelics` 包含 `triangle_formation`，`boardLayout === 'triangle'` |
| 存档持久化 | `localStorage` 中 `pendingRoundStartRewards.length === 2` |

### `essence` — 精华系统测试

| 测试用例 | 验证点 |
|---|---|
| 混沌精华触发 | resolver 启动，阶段切换或队列被消费 |
| 纯净精华激活 | `fateMomentContext.active === true` 或 `selectionMode === 'pure_essence'` |
| 跳过研磨分支 | `_chargedAmmoQueue` 预设正确，`type === 'bounce'` |
| 同化涌潮遗物 | `doubleAssimilationBoostRounds.bounce === 2`，`guaranteedNextRound` 包含 2 个 bounce |

### `runeword` — 符文词条测试

| 测试用例 | 验证点 |
|---|---|
| focused_fire | `ammoQueue` 被消费，词条流程正常 |
| mass_collapse | `scatter+multicast` 清空后爆炸属性生效 |
| kinetic_decay | 子弹携带 `_kineticDecayBonus` 参数 |
| echo_shot | 5 次发射流程正常，`roundDamage >= 0` |

### `enemy` — 敌人词条测试

| 测试用例 | 验证点 |
|---|---|
| 护盾魔像 | 敌人携带 `shield` 词条 |
| 分身魔像 | 敌人携带 `clone` 词条 |
| 伤害输出 | 发射子弹后 `roundDamage` 增加 |

---

## 试炼场场景分类（`relic` 新增）

| 场景 ID | 名称 | 测试重点 |
|---|---|---|
| `relic_pity_essence` | 精华保底验证 | DropPity V3 保底计数器递增与强制触发 |
| `relic_selection_ui` | 遗物选择界面 | `pendingRoundStartRewards` 队列 + UI 弹出 |
| `relic_chaos_essence` | 混沌精华命运 | chaos_essence resolver 触发链路 |
| `relic_pure_essence` | 纯净精华全链路 | `fateMomentContext` 激活，选 1 弹珠 + 符文注入 |
| `relic_pure_essence_skip_grind` | 精华跳过研磨 | `_chargedAmmoQueue` 继承，弹药充能不丢失 |
| `relic_surge_bounce` | 弹性涌潮遗物 | `doubleAssimilationBoostRounds` + `guaranteedNextRound` |
| `relic_board_exclusion` | 钉盘形态互斥 | 已拥有形态遗物时，其他形态遗物从候选池移除 |
| `relic_save_restore` | 存档恢复验证 | `pendingRoundStartRewards` 持久化到 `localStorage` |

---

## 与 AI 协作的测试流程

1. **AI 修改代码** → 提交到仓库
2. **静态校验**：`node tests/validate_scenarios.js`；若修改 Boss 机制，再运行 `node tests/validate_boss_vulnerability.mjs`
3. **部署游戏**：`npm start` 或推送到测试环境
4. **运行时验证**：`node tests/ai_test_runner.js --suite <目标套件>`
5. **查看报告**：控制台输出通过/失败数量，失败项附带具体断言信息
6. **如有失败**：AI 根据断言信息定位代码，修复后重新执行步骤 2-4
