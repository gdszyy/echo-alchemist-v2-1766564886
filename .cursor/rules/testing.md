# 测试基础设施规范 (testing.md)

> 本文档描述 Echo Alchemist V2 的 AI 定制测试体系，涵盖试炼场场景规范、自动化测试脚本使用方式、测试覆盖范围与禁止行为。

---

## 1. 测试架构总览

项目采用三层防护网，从低成本到高成本依次递进：

| 层级 | 工具 | 位置 | 触发时机 | 耗时 |
|------|------|------|----------|------|
| **T1：静态结构校验** | `tests/validate_scenarios.js` | Node.js，无需浏览器 | 每次修改 `systems.js` 后立即执行 | < 30s |
| **T1：阶段契约校验** | `tests/validate_phase_contracts.mjs` | Node.js，无需浏览器 | 每次修改阶段切换、暂停、gameover、命运时刻或 overlay 返回流后执行 | < 30s |
| **T1：预设波次校验** | `tests/validate_wave_presets.mjs` | Node.js，无需浏览器 | 每次修改 `src/wave_presets.js` 或 preset 放置规则后执行 | < 30s |
| **T1：大型基底运行期生成校验** | `tests/validate_enemy_spawn_runtime.mjs` | Node.js + 最小 Canvas/DOM stub | 每次修改大型基底生成限制、preset 回退逻辑或同屏上限后执行 | < 30s |
| **T1：Boss 破绽契约校验** | `tests/validate_boss_vulnerability.mjs` | Node.js，无需浏览器 | 每次修改 Boss 破绽谱、Boss 伤害结算或普通波次机会布局后执行 | < 30s |
| **T2：试炼场实机验证** | 浏览器内 `TrainingGround` 沙盒 | 游戏内置，需部署 | 部署到测试环境后，AI 或人工操作 | 按需 |
| **T3：Puppeteer 自动化** | `tests/ai_test_runner.js` | Puppeteer，需本地游戏服务 | 完整回归测试 | 2~5min |

---

## 2. 试炼场（TrainingGround）场景规范

### 2.1 场景数据结构

每个场景必须包含以下字段：

```js
{
    id: 'snake_case_unique_id',       // 全局唯一，用于 Puppeteer 脚本定位
    categoryId: 'enemy|attribute|boss|runeword|relic',  // 必须属于已注册分类
    name: '简短中文名',                // 在 UI Tab 中显示
    icon: '🔤',                       // Emoji 图标
    desc: '[分类标签] 详细描述...',    // 以 [分类标签] 开头，说明测试目标
    setup: (game) => { ... },         // 初始化战场，只允许操作 game.enemies 和临时状态
    bulletConfig: { ... },            // 完整的 10 键弹珠配置（见下方）
    demoAction: (game, tg) => { ... } // 触发测试动作，更新顶部横幅展示结果
}
```

**bulletConfig 必填键（10 个）：**

```js
{
    damage: number,       // 基础伤害
    bounce: number,       // 弹跳次数
    pierce: number,       // 穿透次数
    scatter: number,      // 散射数量
    multicast: number,    // 多重施法数
    pyro: number,         // 火焰属性
    cryo: number,         // 冰霜属性
    lightning: number,    // 闪电属性
    wind: number,         // 风属性
    isLaser: boolean,     // 是否为激光
    isMatryoshka: boolean,// 是否为套娃弹
    type: string          // 弹珠类型标识
}
```

### 2.2 分类注册表

| 分类 ID | 名称 | 当前场景数 | 核心测试目标 |
|---------|------|-----------|-------------|
| `enemy` | 敌人词条 | 4+ | 护盾、分身、精英、Boss 词条行为 |
| `attribute` | 属性弹珠 | 4+ | 元素弹珠伤害、符文词条触发 |
| `boss` | Boss 机制 | 2+ | Boss 专属技能与阶段切换 |
| `runeword` | 符文词条 | 4+ | focused_fire / mass_collapse / kinetic_decay / echo_shot |
| `relic` | 遗物/精华 | **8** | 保底、精华全链路、存档持久化（见 2.3 节） |

### 2.3 `relic` 分类场景清单

| 场景 ID | 名称 | 测试重点 | 历史 Bug 关联 |
|---------|------|----------|--------------|
| `relic_pity_essence` | 精华保底验证 | DropPity V3 计数器递增与强制触发 | PI-006 |
| `relic_selection_ui` | 遗物选择界面 | `pendingRoundStartRewards` 队列 + UI 弹出与返回流 | PI-006 |
| `relic_chaos_essence` | 混沌精华命运 | `chaos_essence` resolver 触发链路，命运抗决界面 0/3 底栏 | PI-007 |
| `relic_pure_essence` | 纯净精华全链路 | `fateMomentContext` 激活，选 1 弹珠 + 符文注入面板 | PI-007 |
| `relic_pure_essence_skip_grind` | 精华跳过研磨 | `_chargedAmmoQueue` 继承，弹药充能不丢失 | PI-001 |
| `relic_surge_bounce` | 弹性涌潮遗物 | `doubleAssimilationBoostRounds` + `guaranteedNextRound` 状态 | — |
| `relic_board_exclusion` | 钉盘形态互斥 | 已拥有形态遗物时，其他形态遗物从候选池移除 | — |
| `relic_save_restore` | 存档恢复验证 | `pendingRoundStartRewards`、命运时刻 selection 候选卡片与已选状态持久化到 `localStorage` | PI-006 |

---

## 3. Puppeteer 自动化测试脚本（`tests/ai_test_runner.js`）

### 3.1 套件列表

| 套件名 | 用例数 | 主要断言 |
|--------|--------|---------|
| `smoke` | 5 | 游戏加载、试炼场进入、DOM 渲染、relic 分类存在 |
| `relic` | 6 | 保底计数器、遗物 UI 弹出、钉盘互斥、存档持久化 |
| `essence` | 4 | 混沌精华触发、纯净精华激活、跳过研磨、涌潮遗物 |
| `overlay` | 5 | 符文发射器、遗物选择、真理之书、商店遗物选择、round-start resolver 的打开/关闭返回链路 |
| `pinboard` | 7 | 编辑入口门控、钉板编辑器打开、开始采集阻塞、模块禁用原因、库存装备/卸下、符文融合预览/确认、有效开始采集关闭编辑器 |
| `runeword` | 4 | focused_fire / mass_collapse / kinetic_decay / echo_shot |
| `enemy` | 3 | shield/clone 词条、roundDamage 增加 |

### 3.2 运行方式

```bash
# 安装依赖（仅首次）
pnpm add puppeteer

# 启动游戏服务
npm start

# 运行全部套件
node tests/ai_test_runner.js --url http://localhost:3000

# 运行指定套件
node tests/ai_test_runner.js --suite relic
node tests/ai_test_runner.js --suite essence
node tests/ai_test_runner.js --suite overlay
node tests/ai_test_runner.js --suite pinboard

# CI 无头模式
node tests/ai_test_runner.js --headless
```

### 3.3 断言失败处理

脚本输出格式：
```
  ▶ 测试名称 ... ✅ PASS
  ▶ 测试名称 ... ❌ FAIL — 断言失败: <具体原因>
```

AI 处理失败的标准流程：
1. 读取断言失败信息，定位对应的游戏状态字段（如 `game.dropPity.essence`）
2. 使用 `grep` 在源码中定位相关函数（参考 `auto_index/`）
3. 修复代码后，先运行 `validate_scenarios.js`（T1），再重跑失败套件（T3）

---

## 4. 静态校验脚本（`tests/validate_scenarios.js`）

### 4.1 校验项目

- 分类完整性：5 个分类（enemy / attribute / boss / runeword / relic）全部存在
- 场景总数 >= 30
- `relic` 分类场景数 >= 8
- 8 个必须场景 ID 全部存在且 `categoryId === 'relic'`
- 每个场景的 `name`、`desc` 非空
- `bulletConfig` 包含全部 10 个必填键
- 场景 ID 全局唯一
- 所有场景的 `categoryId` 属于已注册分类

### 4.2 新增场景时的同步要求

新增 `relic` 分类场景时，必须同步在 `validate_scenarios.js` 的 `requiredRelicIds` 数组中追加场景 ID：

```js
const requiredRelicIds = [
    'relic_pity_essence',
    'relic_selection_ui',
    // ... 新增场景 ID
];
```

新增其他分类场景时，在对应分类的校验区块中追加。

### 4.3 V2 大型基底预设波次校验

`tests/validate_wave_presets.mjs` 校验 `src/wave_presets.js` 中的 `ENEMY_WAVE_PRESETS`：

- preset ID 唯一，`roundRange`、`weight`、`slots` 合法。
- 非 `normal` slot 必须注册在 `ENEMY_WAVE_PRESET_ARCHETYPES`，尺寸与专属词条匹配。
- `center` / `left` / `right` / `side` lane 能在 `enemyCols=6` 的列网格中放下，且不越界、不重叠。
- 单 preset 内 `maw ≤ 2`、`hive ≤ 1`、`siege ≤ 1`、`gravityWell ≤ 1`；`gravityWell` 不与其它大型基底同 preset。

运行方式：

```bash
node tests/validate_wave_presets.mjs
```

### 4.4 V2 大型基底运行期生成校验

`tests/validate_enemy_spawn_runtime.mjs` 将 `spawn_system` 真实方法绑定到最小 fake game，并用 Node stub Canvas/DOM 环境执行：
- 强制 preset 路径，确认 `spawn_trySpawnWavePreset()` 可以生成大型基底。
- 强制旧随机大型基底路径，确认 `spawn_trySpawnArchetypes()` 的 `gravityWell`、`maw`、`hive`、`siege` 同屏上限有效。
- 60 回合 seeded 模拟同时覆盖 preset 与随机回退路径，检查活跃敌人不重叠，且 `gridCols/gridRows` 与实际 `width/height` 一致。
- 逐类实例化 8 种 V2 基底，验证 `baseArchetype`、专属词条、`collisionShape/collisionData`、宽体标记、慢速移动间隔和专属初始化（如 deflector 屏障、hive 冷却）。

运行方式：
```bash
node tests/validate_enemy_spawn_runtime.mjs
```

### 4.5 阶段清理与命运时刻契约校验

`tests/validate_phase_contracts.mjs` 通过静态契约锁定阶段切换和命运时刻返回流的关键收口：
- `ui_updateUI()` 离开 combat 后必须清理战斗 HUD，且 training 只保留态势面板。
- meta / shop / truth_book / gameover 等 terminal 阶段必须清理 transient overlays。
- 暂停“放弃本局”必须走 `ui_abandonRunToMeta()`，gameover 触发前必须清理临时浮层。
- `_proceedToFateMomentSelection()` 必须重建 `fateMomentContext.active = true` 语义。
- round-start reward resolver 打开遗物 overlay 时必须带 `resumeTarget: 'round_start_resolver'`。
- 继续游戏若命中 selection / 命运时刻存档，必须恢复 `phase`、`marblesPool`、`selectedMarbles`、注入符文与预览 UI，禁止直接落回 `sys_startRoundStartResolver()`。

运行方式：
```bash
node tests/validate_phase_contracts.mjs
```

### 4.6 Boss 破绽契约校验

`tests/validate_boss_vulnerability.mjs` 静态锁定 Boss 破绽重设计：
- `spawn_system.js` 不得重新出现旧 `weak_spot` 普通波次低血量弱点怪。
- `config.js` 不得重新使用旧 `weakness:` Boss 字段。
- 8 个 Boss 必须配置 `vulnerability` 破绽谱。
- `combat_system.js` 必须保留 `combat_applyBossVulnerability()`、`combat_updateBossVulnerabilityProgress()` 与 `_bossVulnerabilityExposedHits` 易伤窗口消费。
- 固定 Boss 必须同时覆盖 `hits` 与 `damage` 两类累积方式。
- `CONFIG.balance.bossVulnerability` 必须保留回合缩放参数，确保回合越高破绽条件越苛刻。
- `ouroboros` 必须使用动态轮转破绽谱。

运行方式：
```bash
node tests/validate_boss_vulnerability.mjs
```

---

## 5. 测试覆盖范围与已知盲区

### 5.1 已覆盖

| 机制 | 覆盖层级 | 备注 |
|------|---------|------|
| 遗物保底（DropPity V3） | T2 + T3 | 保底计数器递增、强制触发 |
| 遗物选择 UI 返回流 | T2 + T3 | `pendingRoundStartRewards` 队列 |
| 混沌精华 resolver | T2 + T3 | 命运抗决界面触发 |
| 纯净精华全链路 | T2 + T3 | `fateMomentContext`、选弹珠、符文注入 |
| 跳过研磨弹药继承 | T2 + T3 | `_chargedAmmoQueue` 不丢失 |
| 同化涌潮遗物 | T2 + T3 | `doubleAssimilationBoostRounds` |
| 钉盘形态互斥 | T2 + T3 | `ownedRelics` 过滤 |
| 存档持久化 | T2 + T3 | `localStorage` 写入验证 |
| 符文词条（4 个） | T2 + T3 | focused_fire / mass_collapse / kinetic_decay / echo_shot |
| 敌人词条（shield/clone） | T2 + T3 | 词条生成与伤害输出 |

### 5.2 已知盲区（需人工实机测试）

| 机制 | 原因 | 建议 |
|------|------|------|
| 完整 Boss 战流程 | 需要多回合状态累积，Puppeteer 超时风险高 | 人工实机测试 |
| 音频触发 | Puppeteer headless 模式无音频上下文 | 人工验证 |
| 移动端触摸事件 | Puppeteer 模拟触摸与真实设备存在差异 | 真机测试 |
| 存档恢复后的完整游戏流程 | 需刷新页面后继续游戏，跨页面状态复杂 | 人工实机测试 |
| 多遗物组合效果 | 组合数量指数级增长，无法穷举 | 选取高频组合人工测试 |

---

## 6. 禁止行为

- **禁止在 `setup()` 中修改持久化游戏状态**：`setup()` 只能操作 `game.enemies`（战场实体）和临时测试辅助状态，不得修改 `game.ownedRelics`、`game.dropPity`、`game.pendingRoundStartRewards` 等存档字段（`relic_save_restore` 场景除外，该场景专门测试存档行为）。
- **禁止跳过 T1 直接运行 T3**：静态校验是最低成本的防护网，必须先通过 T1 再执行 T3。
- **禁止手动编辑 `auto_index/` 下的文件**：函数索引由 `code-indexer` 脚本自动维护，手动编辑会在下次脚本运行时被覆盖。
- **禁止在测试脚本中硬编码游戏版本相关的行号**：定位方式必须使用函数名 `grep` 或 `@section` 标记，与行号完全解耦。
- **禁止在 Puppeteer 脚本中使用 `page.waitForTimeout`**：改用 `page.waitForFunction` 或 `page.waitForSelector` 进行条件等待，避免因帧率差异导致的不稳定。
