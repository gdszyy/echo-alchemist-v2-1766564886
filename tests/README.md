# Echo Alchemist v2 — AI 自动化测试套件

本目录包含两类测试工具，覆盖游戏核心机制的 AI 可执行验证流程。

---

## 文件结构

| 文件 | 类型 | 依赖 | 说明 |
|---|---|---|---|
| `validate_scenarios.js` | 静态校验 | Node.js（无需浏览器） | 验证 `TRAINING_SCENARIOS` 数据结构完整性 |
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
# 默认监听 http://localhost:3000
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
2. **静态校验**：`node tests/validate_scenarios.js`（无需浏览器，30 秒内完成）
3. **部署游戏**：`npm start` 或推送到测试环境
4. **运行时验证**：`node tests/ai_test_runner.js --suite <目标套件>`
5. **查看报告**：控制台输出通过/失败数量，失败项附带具体断言信息
6. **如有失败**：AI 根据断言信息定位代码，修复后重新执行步骤 2-4
