# 世界变迁模拟器规范 (src/world_sim/)

> 最后更新：人类重生点改为每次生物层迭代自动刷新，按天气宜居度、附近晶石风险、附近人类部落支援与地形通行成本评分，并缓存为 `engine.humanRespawnPoint`；`params.humanSpawnPoint` 仍作为显式强制点。新增生物 `crystalDamageReduction`（晶石伤害减免比例）、`civilizationLevel`（聚落文明程度）与 `settlementSize`（聚落规模）属性；构造期会播种多样初始生物圈，部分高耐受物种会围绕未来 Alpha 区域生成。初始中心 Alpha 默认延迟 120 步播种，避免地幔能量尚未抵达中心时直接清空生物。Alpha 相邻会持续降低聚落文明；Beta 采矿改为文明驱动的低速进度制；单个同物种连续聚落受 `bioMaxSettlementCells` 限制，满员后扩张压力转为迁徙者；小部落通过保底繁荣与竞争减伤提高存活率。地块低能塌陷消失机制已取消。稳定性研究入口收束为默认 50×50 环形前缘（ring-front），移除 source-basin/source-circle 双叶源井播种路径。本模块仍为纯数据子系统，**未接入** `Game` 主类、EventBus 或任何渲染层。

本文档定义 `src/world_sim/` 目录下的**世界变迁模拟器**引擎规范。该引擎是一套基于元胞自动机（Cellular Automata）的星球演化模拟，从地幔、气候、晶石到生物四层逐步演化。源头是独立项目 `world-morphing-simulator` 的 `client/src/lib/simulation/engine.ts`（约 1547 行 TS 单体类）+ `perlin.ts`，移植时按 Echo 的「单文件 <500 行」与「组合优于继承」规范拆分为 14 个 ES Module 文件。

## 1. 设计定位与边界

*   **纯数据处理模块**：引擎只维护并演化 `grid` 网格数据，**绝不依赖 DOM / Canvas / 任何渲染或 UI**。可视化的原则是「视图拉取（poll），引擎从不推送（push）」——未来的可视化层只读取 `engine.grid` 与 `cell.energyFlow` 等字段，引擎本身不渲染、不发事件。
*   **独立子系统，尚未接入 gameplay**：本轮移植**不**将引擎挂到 `core.js` 的 `Game` 实例，**不**注册任何 EventBus 事件，**不**与打砖块玩法耦合。`SimulationEngine` 是可独立 `new` 的类，与 Echo 现有的 `_subsystems` 组合数组无关。后续若要接入 gameplay，需另起任务并在本文档登记。
*   **与 Echo 主架构的关系**：引擎**内部**复用了 Echo 的「组合模式（Composition via bind）」——四层逻辑与生物投放各自是对象字面量，在 `SimulationEngine` 构造时 `bind(this)` 注入为实例方法。这与 `core.js` 的 `Game` 构造完全同构，但作用域局限在引擎实例，不触碰全局 `Game`。

## 2. 文件清单与职责

| 文件 | 行数 | 导出 | 职责 |
|------|------|------|------|
| `engine.js` | ~154 | `class SimulationEngine` | 引擎主类：构造网格、`bind` 注入四层/辅助层、`update()` 推进单步、`getNeighbors()` 取八邻居，支持 seed/random 注入 |
| `cell.js` | ~100 | `CELL_TYPE`、`createCell()` | 元胞工厂与状态枚举；含地形高度、持久源井与天气状态字段 |
| `params.js` | ~250 | `DEFAULT_PARAMS` | 约 95 个模拟参数（半径、能量、地形、温度、繁衍/变异系数、聚落规模、晶石源井阈值、人类吸能基地等）+ `SimulationParams` 契约 |
| `perlin.js` | ~66 | `generatePerlinNoise(x,y,z)` | 3D Perlin 噪声，供地幔能量场扰动使用 |
| `rng.js` | ~27 | `createSeededRandom(seed)` | 可复现伪随机源，用于测试与稳定性搜索 |
| `mantle_layer.js` | ~245 | `mantle_layer` | 地幔层：能量场演化 + 地形扩张 + 极慢连续高度演化 + 坡度/盆地指标刷新；持久源井下限、人类基地吸能、晶石吸能扣除 |
| `climate_layer.js` | ~278 | `climate_layer` | 气候层：弱基础温度 + 晶石气候异常 → `climatePotential` → 持久 `windX/windY` 风场 → 热输送/雷暴 |
| `crystal_layer.js` | ~158 | `crystal_layer` | 晶石层：能量代谢、Alpha 网络共享、繁殖扩张；支持局部源井吸能与可调传输上限 |
| `crystal_disaster.js` | ~412 | `crystal_disaster` | 晶石灾害拓扑分析：识别稳定活跃区、供能源、关键阻断点，并提供纯数据干预接口 |
| `human_energy.js` | ~188 | `human_energy` | 人类地幔能量汲取基地：创建基地、抽能、维护/升级、输出吸能统计 |
| `terrain_generator.js` | ~61 | `generateInitialTerrainElevation()` | 初始自然地形生成器：多尺度 seed 噪声生成高原、低地、山脊、盆地口袋与谷地切割 |
| `terrain_detectors.js` | ~112 | `terrain_detectors` | 地形识别检测器：纯读识别高原、低地、盆地、山脊、谷地、山口与平原 |
| `bio_settlement.js` | ~59 | `getSettlementSize()` 等 | 生物层纯读辅助：统计同物种连续聚落大小、小部落保护系数与聚落容量约束 |
| `bio_layer.js` | ~478 | `bio_layer` | 生物层：聚落与迁徙者的生存、繁衍、变异、地形感知迁移、灭绝；按物种晶石减伤结算 Alpha 邻接伤害，并在每轮前后刷新人类动态重生点 |
| `bio_spawn.js` | ~452 | `bio_spawn` | 生物投放：构造期初始生物圈、人类（speciesId=0）与随机新物种的选址、聚落规模、属性生成，以及人类动态重生点评分 |

所有文件均 < 500 行；未达到大文件阈值的新增小文件无需生成独立函数索引。若后续文件超过 500 行或 20 个函数，再按 [`auto_index/INDEX.md`](auto_index/INDEX.md) 的自动索引流程重建，不得手动编辑索引文件。

## 3. 元胞状态模型 (cell.js)

晶石/生物状态统一走 `CELL_TYPE` 枚举，**严禁**在业务文件中使用 `'ALPHA'`/`'BIO'` 等裸字符串字面量（`cell.js` 定义枚举本身除外）：

```js
export const CELL_TYPE = { EMPTY: 'EMPTY', ALPHA: 'ALPHA', BETA: 'BETA', BIO: 'BIO' };
```

| 状态 | 含义 | 关键转化 |
|------|------|----------|
| `EMPTY` | 存在的空地块（`exists=true` 且无晶石/生物） | 可被晶石繁殖、生物定居 |
| `ALPHA` | 活性晶石（能量核心） | 能量枯竭（`storedEnergy<=0`）→ 退化为 `BETA` |
| `BETA` | 惰性晶石（矿物） | 不可逆；仅被生物采矿清除为普通空地 |
| `BIO` | 生物聚落 | 繁荣度归零→灭绝；环境不足→转为迁徙者 |

**迁徙者（Migrant）独立于元胞状态**：`cell.migrant` 是与晶石/聚落共存的独立字段（不占用 `crystalState`），可漂浮在任意 `exists` 地块上，择优定居后才转为 `BIO`。

`createCell(x, y, opts={})` 是唯一的元胞构造入口，默认值（`storedEnergy:10.0`、`migrant:null` 等）集中在此，新增字段必须走工厂默认值，不得在各层临时 `cell.xxx = ...` 隐式新建语义字段。

生物属性由 `cell.bioAttributes` 承载。除温度、生长、采矿、迁徙等既有字段外，当前新增三项开局与晶石灾害相关字段：

| 字段 | 含义 | 维护方 |
|------|------|--------|
| `crystalDamageReduction` | 晶石邻接伤害减免比例（0..1，实际结算最高钳制到 0.95） | `bio_spawn.js` 生成，扩张变异时可微变；`bio_layer.js` 只读结算 |
| `civilizationLevel` | 聚落文明程度（0..1），无显式减伤时可折算为晶石减伤 | `bio_spawn.js` 生成，扩张变异时可微变 |
| `settlementSize` | 初始聚落占地规模参考值，用于构造期多格聚落 | `bio_spawn.js` 生成；演化层不把它当硬占地约束 |

地形字段同样必须从 `createCell()` 初始化：

| 字段 | 含义 | 维护方 |
|------|------|--------|
| `terrainElevation` | 地势高度（0..1），越高越接近高原/山脊 | 初始化 + 地幔层持续抬升/侵蚀 |
| `terrainSlope` | 当前格与邻格的最大高度差 | 地幔层每步刷新 |
| `terrainBasinDepth` | 当前格低于周边平均高度的程度 | 地幔层每步刷新 |
| `terrainMoveCost` | 坡度与盆地爬升形成的综合通行代价缓存 | 地幔层每步刷新，生物层只读 |

`mantleSourceStrength` 表示该格是否是持续地幔源井。默认值为 `0`，不改变普通世界演化；当值大于 `0` 时，地幔层会在每步把该格新能量抬到源井下限，再让人类吸能基地抢夺，最后才轮到 Alpha 吸收。灾害分析也把该字段视为供能源信号之一。

天气状态字段同样必须由 `createCell()` 初始化，气候层只读地形/晶石/温度并写回以下气候观测值：

| 字段 | 含义 | 维护方 |
|------|------|--------|
| `climatePotential` | 驱动风场的气候势能，由温度、晶石气候电荷、海拔和盆地项合成 | `climate_layer.js` 每步重算 |
| `windX` / `windY` | 持久局部风向量，不再由单 tick 温度梯度临时推断 | `climate_layer.js` 按势能梯度、惯性、摩擦、地形阻力更新 |
| `verticalMotion` | 风遇坡产生的上升/下沉代理值，用于雷暴评分 | `climate_layer.js` 每步写回 |
| `crystalClimateCharge` | Alpha/Beta 对天气势能的局部异常解释，不移动晶石能量逻辑 | `climate_layer.js` 根据 `CELL_TYPE` 解释 |

当前天气循环为：弱基础温度与晶石热偏置 → `climatePotential` → 地形塑形的持久风场 → 迎风采样热输送 → 风汇聚/抬升/晶石邻接雷暴评分。Alpha 可作为低势能天气核并增加邻近风暴风险，但 Alpha 晶石本体不直接挂 `hasThunderstorm`，避免绕过晶石灾害断供逻辑；Beta 提供正势能稳定项并削弱邻近雷暴。地幔只通过 `mantleClimateAnomalyScale` / `mantleClimateAnomalyRate` 形成弱气候异常，不再直接主导表层温度形状。

## 4. 演化管线 (engine.update)

`SimulationEngine.update()` 每步**严格按固定顺序**推进四层，顺序不可调换（后层读取前层产出的能量/温度）：

```
timeStep++  →  beginHumanEnergyTick()
            →  updateMantleLayer()
            →  updateHumanEnergyBases()
            →  updateClimateLayer()
            →  seedInitialAlpha()（默认第 120 步，若尚未播种）
            →  updateCrystalLayer()
            →  updateBioLayer()
```

每 1000 步 `cycleCount++`（世代计数）。下表为各层的 `@section` 内部节点（>200 行函数用 `@section` 标记；本模块函数虽均 <200 行，仍保留原型的分段标记以便 `grep` 定位）：

| 层 | 方法 | `@section` 节点 | 核心逻辑 |
|----|------|----------------|----------|
| 地幔 | `updateMantleLayer` | `mantle_supply_points` / `mantle_energy_field` / `mantle_terrain_change` / `mantle_terrain_metrics` | 旋转边缘供给点 → 噪声+扩散+边缘注入+人类基地抽能+晶石吸收算新能量，并按 `terrainGeologyRate` 极慢连续更新高度 → 按能量与半径累积判定地形扩张 → 刷新坡度、盆地深度与通行代价 |
| 人类吸能 | `beginHumanEnergyTick` / `applyHumanEnergyExtraction` / `updateHumanEnergyBases` | （单段） | 重置每帧观测值 → 在地幔层逐格抽能并写入基地库存 → 维护消耗与自动升级 |
| 气候 | `updateClimateLayer` | （helper 分段） | 晶石气候电荷 → 弱基础温度 → 气候势能 → 持久风场/垂直运动 → 热扩散与迎风输送 → 风汇聚/抬升/晶石邻接雷暴 |
| 晶石 | `updateCrystalLayer` | `crystal_metabolism` / `crystal_energy_network` / `crystal_expansion` | 只按地幔能量/源井/局部能量差吸能，不读地势；再处理雷暴充能与维持消耗（枯竭 Alpha→Beta）→ Alpha 间能量共享（含衰减+流向记录）→ 富能 Alpha 向空地繁殖 |
| Alpha 初始播种 | `seedInitialAlpha` | （单段） | 默认在第 `initialAlphaDelaySteps=120` 步、气候层后晶石层前播种中心 Alpha；只写入空地，不覆盖已建立生物 |
| 生物 | `updateBioLayer` | `bio_census` / `bio_spawn_respawn` / `bio_settlement` / `bio_migrant` / `bio_apply_changes` | 普查 → 物种稀少自动投放/人类灭绝重生 → 地形削弱邻接竞争/协作 → 聚落演化 → 地形感知迁徙者演化 → 统一应用变更 |

### 4.1 变更收集模式（生物层关键约定）

`updateBioLayer` 采用**先收集后应用**：遍历途中所有改动 push 进 `changes[]`，遍历结束后在 `@section:bio_apply_changes` 统一落盘。这样可避免遍历过程中改写网格、使后续元胞读到「半更新」状态。`changes` 的 `type` ∈ `STATE | PROSPERITY | CIVILIZATION | MINING_STATE | MINING_PROGRESS | NEW_BIO | MIGRATE | MIGRANT_ADD | MIGRANT_UPDATE | MIGRANT_REMOVE`。新增生物层行为时，**必须沿用此队列模式**，不得在遍历主循环里直接改 `cell.crystalState`。

### 4.1.1 地形高度目标边界

详细规划见 [`docs/world_sim_terrain_elevation_plan.md`](../../docs/world_sim_terrain_elevation_plan.md)。当前地形系统的目标是给“环形前缘”和生物迁徙增加现实地貌阻抗，而不是做完整地理模拟：

*   **要**：默认自然地形受 seed 驱动且可复现，并在开局就具备高原、低地、山脊、盆地和谷地/走廊；高原/平原之间可被陡坡阻断，只有中等高度的山口或窄颈能通行；盆地中心低、盆沿高，跨盆沿迁徙与竞争成本更高；地幔高能和持久源井会以极慢连续方式逐步抬升局部地势；天气读取高海拔、坡地和盆地。
*   **不要**：不要用地形硬编码阵营边界；不要让地形永久锁死全图；不要让地势高低影响晶石吸能；不要引入 UI / Canvas / EventBus；不要为了单个测试坐标写死迁徙路径。
*   **维护要求**：生物层只读取地形字段并沿用 `changes[]` 队列；气候层只读取地形/晶石状态并产出温度、气候势能、持久风场、垂直运动与雷暴，不得反写地形；只有地幔层和初始化播种器能维护 `terrainElevation` 及其派生指标。

### 4.1.2 Alpha 功能相设计入口

后续若要把 Alpha 晶石从单一活性状态扩展为按需分化的内部网络，先阅读 [`docs/world_sim_alpha_role_design.md`](../../docs/world_sim_alpha_role_design.md)。该设计约定 `CELL_TYPE` 仍保持 `ALPHA/BETA` 等既有枚举，分工通过 `alphaRole` 表达；`BETA` 仍是不可逆惰性矿物，不作为休眠态回转为 `ALPHA`。第一版推荐只落地 `collector`、`conduit`、`reservoir`、`frontier`、`dormant`，暂缓需要拓扑割点分析的 `relay`。

### 4.2 初始生物圈与晶石耐受（bio_spawn.js）

`SimulationEngine` 构造网格后会调用 `seedInitialBiosphere()`。该过程只写入纯数据，不参与 DOM、Canvas 或 EventBus。默认会生成多种随机生物聚落，并额外投放人类聚落；实验场景如需完全关闭生命，应同时设置 `initialBioSpeciesCount: 0`、`bioAutoSpawnCount: 0` 与 `initialHumanSpawn: false`。

*   初始随机物种数量由 `initialBioSpeciesCount` 控制；每个物种会随机生成 `civilizationLevel`、`crystalDamageReduction`、`settlementSize` 与初始繁荣度。
*   `initialBioCrystalTolerantRatio` 控制高耐受物种比例。耐受型物种会倾向在当前 Alpha 或未来中心 Alpha 附近选址，`crystalDamageReduction` 默认从 `crystalTolerantDamageReductionMin..Max` 抽样，使晶石灾害期间仍可能存在生物活跃区。
*   非耐受初始物种仍按 `initialBioAlphaSafeDistance` 避开 Alpha，保持普通生态扩散空间。
*   人类聚落使用 `humanCivilizationLevel` 与 `humanCrystalDamageReduction`，初始繁荣度与占地规模由 `humanInitial*` 参数控制。`initialHumanSpawn:false` 会同时关闭后续人类自动重生。
*   `updateHumanRespawnPoint()` 每次生物层迭代前后运行，扫描可用空地并缓存 `engine.humanRespawnPoint`。评分参考温度、雷暴/风/垂直运动等天气状态，目标点与邻域内 Alpha/Beta 晶石风险，以及 `humanRespawnTribeRadius` 内现有人类部落的繁荣度支援；评分明细保存在返回对象中，便于实验脚本读取。
*   `params.humanSpawnPoint` 是强制调试/剧情点，优先级高于动态点且可覆盖原物体；未配置强制点时，`spawnHuman()` 使用当前 `engine.humanRespawnPoint`，若没有可用动态点才退回旧的随机宜居空地选址。
*   `spawnRandomSpecies(options?)` 与 `spawnHuman(prosperity, options?)` 返回 boolean，表示是否成功投放；测试或实验脚本可据此确认生命生成。
*   `bioAutoSpawnCount: 0` 会真正关闭运行期自动投放。不要再依赖 `||` fallback 判断该参数，否则会让显式 0 失效。
*   聚落扩张时的变异分支由 `mutationRate`、`mutationStrength` 与 `newSpeciesThreshold` 共同控制：每次扩张会累计本轮属性相对漂移，累计值达到阈值时才分配新的 `speciesId` 与颜色。不要用单个属性变化量直接和阈值比较，否则默认小步变异会永远无法形成新物种。

### 4.2.1 聚落规模与小部落保护（bio_settlement.js / bio_layer.js）
单个同物种连续聚落的占地由 `bioMaxSettlementCells` 控制，默认上限为 8 格。聚落达到上限后，扩张判定不再直接占据相邻空地，而是强制生成迁徙者，促使同一物种建立分散聚落而不是单块无限铺图。

*   `bio_settlement.js` 只能纯读 `grid`，不得写入元胞状态。
*   迁徙者定居时也会检查 `canSettleWithinLimit()`，避免把多个满员同物种聚落重新粘连成超大连续块。
*   迁徙者只有在当前繁荣度不低于 `migrantSettleMinProsperity`（未配置时使用物种 `migrationThreshold`）时才会定居，避免低繁荣逃难者刚落地就因聚落迁徙阈值再次弹回迁徙状态。
*   `bioSmallSettlementSize`、`bioSmallSettlementSurvivalBonus` 与 `bioSmallSettlementCompetitionResistance` 用于保护 1..3 格的小部落：提供少量繁荣补偿，并降低其受到强势邻居竞争时的损耗。
*   默认参数已降低 `minProsperityGrowth`、初始繁荣度、采矿速度和开采奖励，避免少数步数内完成快速文化/空间扩张。

### 4.3 Alpha 邻接文明损耗（bio_layer.js）
Alpha 邻接不只造成繁荣度伤害，也会持续压低聚落文明。每个相邻 Alpha 会按 `alphaCivilizationDecay` 叠乘一次文明保留比例，默认 `0.965`，例如一个聚落同时邻接两个 Alpha 时该步文明约乘以 `0.965^2`。

*   `crystalDamageReduction` 只减免 Alpha 的繁荣度伤害，不抵消文明损耗。
*   Alpha 文明损耗必须通过 `changes[]` 的 `CIVILIZATION` 类型统一应用，不得在遍历主循环中直接写 `bioAttributes.civilizationLevel`。

### 4.4 Beta 采矿（bio_layer.js）

Beta 采矿不再瞬间完成。每个 BIO 聚落有 `cell.betaMiningProgress`，当相邻存在 Beta 时按文明程度推进；`civilizationLevel=1` 时每步最多完成一块，低文明按比例变慢，`betaMiningMinRate` 只提供最低保底进度。

*   单个聚落每步最多开采一块 Beta；同一块 Beta 在同一 tick 内只允许被结算一次，避免多个邻近聚落重复开采。
*   成功开采时，Beta 晶石转为 `CELL_TYPE.EMPTY`，地块本身仍存在；聚落获得 `miningReward`。
*   Beta 开采不再降低开采者或周围 BIO 聚落的文明，文明损耗只由 Alpha 邻接等明确灾害来源触发。
*   采矿进度与晶石状态变更必须继续走 `changes[]` 队列，不得在生物层遍历主循环中直接改网格。

### 4.5 人类地幔能量汲取（human_energy.js）

`human_energy` 是纯数据层的持续干预机制，用于表达“人类基地发展出地幔能量汲取科技，开始与晶石争夺能量”。它不占用 `CELL_TYPE`，不替代生物聚落，也不依赖玩法层；未来 gameplay 可把建筑、科技或任务结果映射为 `addHumanEnergyBase(x, y, options)`。

*   `addHumanEnergyBase(x, y, options?)`：在已有地块上放置吸能基地/塔。关键参数包括 `radius`、`drainRate`、`efficiency`、`capacity`、`maintenanceCost`、`autoUpgrade`。
*   `applyHumanEnergyExtraction(x, y, mantleEnergy)`：由地幔层在 Alpha 晶石吸能前调用。基地按距离衰减抽取局部地幔能量，写入 `base.storedEnergy`，并在元胞上记录 `cell.humanEnergyDrain` / `cell.isEnergySiphoned`。
*   `updateHumanEnergyBases()`：处理维护消耗和库存升级。默认无基地，因此旧模拟行为保持兼容；只有显式创建基地后才改变能量场。
*   `getHumanEnergyReport()`：返回基地数、总库存、总抽能量、本 tick 抽能量和各基地有效半径/抽能速率。

机制含义：基地与 Alpha 晶石竞争的是**同一份地幔能量**。当基地部署在源井、割集或其邻域时，可以让源头 Alpha 无法持续补能，进而在 `alphaEnergyDemand` 与传输衰减作用下自然退化为 `BETA`，形成“不断能就结束灾害”的动态胜利条件。

### 4.6 晶石灾害拓扑分析（crystal_disaster.js）

`crystal_disaster` 是引擎内部的纯数据辅助层，随 `SimulationEngine` 构造函数一起通过 `bind(this)` 注入，提供两个实例方法：

*   `analyzeCrystalDisaster(options?)`：扫描当前 Alpha 晶石连通分量，按「供能源（高地幔/本帧吸能/雷暴充能）→ 活跃 Alpha 区 → 阻断集合」识别稳定晶石灾害。返回 `active`、`disasters`、`criticalCells`、`criticalSets`、`sourceSeals` 与统计信息。
*   `applyCrystalInterventions(cells, options?)`：对一组晶石格执行干预，用于最小割集或源井封印。默认将 Alpha 转为 `CELL_TYPE.BETA` 作为惰性阻断物，随后重新分析并返回 `hitCriticalSet` / `hitSourceSeal` / `resolved`。
*   `applyCrystalIntervention(x, y, options?)`：单点干预兼容接口，内部委托给 `applyCrystalInterventions()`。

该算法不硬编码目标格。所谓“指定位置”必须从当前地形与 Alpha 网络自然形成：只有当某个 Alpha 格是供能源到活跃区的关键割点时，它才会出现在 `criticalCells`。`maxSourceCellsPerComponent` 用于限制每个连通分量只取最强的若干源井，避免把整片吸能 Alpha 都当成根源。如果打错非关键活跃晶石，灾害分量仍会保持 `active=true`。

### 4.7 稳定性研究与遗传搜索

稳定性研究脚本：`node scripts/world_sim_stability_search.mjs`

核心判据详见 [`docs/world_sim_crystal_stability_research.md`](../../docs/world_sim_crystal_stability_research.md)。当前判据把稳定拆为：灾害持续率、关键点持久性、规模/能量有界性、平均活跃规模、阻断后衰减窗口内是否解除。正式稳定结论要求 `ticks - warmup >= 600`；短窗口只允许作为调参预筛。脚本支持：

```bash
node scripts/world_sim_stability_search.mjs --scenario bridge --generations 6 --population 16 --ticks 800 --warmup 200 --sampleInterval 10 --seeds stable-a,stable-b
node scripts/world_sim_stability_search.mjs --scenario ring-front --resolutionMode siphon --generations 0 --population 2 --width 50 --height 50 --ticks 920 --warmup 320 --sampleInterval 10 --seeds 42 --maxInterventions 6 --resolveHorizon 800 --minStableTicks 600 --minMeanActiveCells 50 --targetMeanActiveCells 600 --maxMeanActiveCells 1200
node scripts/world_sim_stability_search.mjs --scenario natural --generations 2 --population 8
```

当前主参考为“环形前缘”参数族：使用默认 50×50 圆形岛屿中心 Alpha 起点，不额外播种源井；固定 seed `42` 等待 120 步播种 Alpha 后再推进 700 步（总计 820 步），中心半径 6 内均为 Beta、活跃 Alpha 为 0，外圈半径 12..20 保持大量活跃 Alpha。该结构用于表达“中间休眠、外圈活跃”的扩散波前。当前不再维护 source-basin/source-circle 双叶源井播种路径。环形前缘的动态关键点是半径约 16 的六点吸能覆盖阵列：`(41,25)`、`(33,39)`、`(17,39)`、`(9,25)`、`(17,11)`、`(33,11)`，配合 `humanExtractorRadius=9` 可在 50 步内解除灾害并在 200 步内清零；单格阻断当前源点会快速换源，不能解除圆形环带灾害。少于 6 点需要更大的吸能半径（约 11/13/18 对应 5/4/3 点），关键点感反而变弱。

## 5. 移植决策与对原型的取舍

移植自 TS 单体类，遵循「保留全部数值计算、剥离类型与死代码」的原则。已记录的有意取舍：

*   **类型剥离**：删除全部类型注解 / `private` / `public`；TS `interface` → JSDoc `@typedef`；联合类型 `CellType` → `CELL_TYPE` 常量对象。
*   **地幔层**：删除原型中计算后从未使用的 `hasVoidNeighbor` 死分支；清理 `[AUTO-GENERATED]` 注释噪声。保留 `noiseVal*0.1` 扰动、`diffusionStrength=0.4`、边缘径向带注入与供给点 `cos(diff*4)` 影响（`diff<π/4`）等全部计算。
*   **地块消失机制**：取消低地幔能量导致的 `exists=false` shrink。地幔层仍可扩张新地块，但已有地块不会因低能塌陷为虚空。
*   **人类吸能基地**：新增 `human_energy.js`，但保持纯数据与显式创建原则；默认没有基地，因此不改变旧的世界演化。基地由地幔层调用，先于 Alpha 吸能生效，用于表达“人类科技与晶石争夺地幔能量”。
*   **稳定地形取舍**：移除 `terrain_features.js` 与 source-basin/source-circle 双叶源井播种路径，主参考收束到默认 50×50 环形前缘；手工 bridge 拓扑仅作为灾害分析算法的单元验证。
*   **初始生物圈**：新增构造期多样生物播种。随机物种与人类聚落均会生成文明程度、晶石伤害减免与聚落规模；部分耐受型物种可贴近 Alpha 存活，用于表达晶石灾害期间仍有生命活动。
*   **生物层竞争分支**：原型「强者 vs 弱者」竞争中，`cell.prosperity > n.prosperity` 分支计算出的 `diff`/`damage` 从未被使用（强者不受损）。移植后折叠为单一 `cell.prosperity < n.prosperity` 判定，行为等价。
*   **晶石层 / 气候层**：`energySharingLimit`（晶石）已接入 Alpha 网络单边传输上限，默认值仍等价于旧的 5 点上限；`advectionRate`（气候）在原型中被解构却未使用，移植时保留解构并加注释说明，以忠实于原始参数面。
*   **晶石源井参数**：新增 `crystalMantleAbsorptionThreshold` / `crystalMantleLocalMargin`，默认值保持旧行为近似兼容；`mantleSourceStrength` 进一步把“初始高能点”升级为可持续地幔源井，用于 600 步稳定灾害研究。
*   **完整性验证**：见第 6 节测试，两种网格尺寸 200/120 步均无 NaN/Infinity，四层确实演化。

## 6. 测试

冒烟 + 静态契约校验：`node tests/validate_world_sim.mjs`

*   **运行时冒烟**：实例化 32×32 引擎跑 200 步，断言 `timeStep===200`、全程无 NaN/Infinity、气候层温度偏离 0、地幔层重塑地形、生物层产生生命与繁荣度；再以 40×40 跑 120 步二次验证有限性（非侥幸跑通）。
*   **地形高度验证**：运行期所有存在地块的 `terrainElevation` / `terrainSlope` / `terrainBasinDepth` / `terrainMoveCost` 必须保持有限值；地幔层应产生非零坡度和局部盆地深度。
*   **可复现随机源**：同一 seed 构造出的引擎拥有一致的初始噪声偏移、网格能量与初始地形高度；不同 seed 的初始地形高度必须有可测差异；默认初始地形必须同时覆盖低地、中地与高地。
*   **地形生成/识别验证**：`terrain_generator.js` 负责初始自然地形；`analyzeTerrainFeatures()` 必须能在固定 seed 下识别高原、低地、盆地、山脊、谷地和山口。
*   **地质慢变验证**：地势高度每步都可微变，但单步变化必须很小，长跨度累计应可测。
*   **晶石吸能独立性**：同等地幔能量下，高地与低地 Alpha 晶石吸收的地幔能量必须一致。
*   **晶石灾害拓扑**：手工构造「供能源 - 窄桥 - 活跃晶石区」地形，断言 `analyzeCrystalDisaster()` 能识别窄桥关键点；对非关键活跃格干预后灾害仍存在，对关键窄桥干预后灾害解除。
*   **人类吸能验证**：在同一桥型灾害源井旁部署人类地幔吸能基地，不直接消灭晶石，仅靠持续抽能即可让灾害在衰减窗口内解除。
*   **初始生物圈验证**：固定 seed 下断言初始地图已有多物种、多格聚落、不同聚落规模与高晶石减伤物种；构造期无 Alpha，120 步延迟播种后仍能在 Alpha 附近保留耐受生物。
*   **晶石减伤与 Alpha 文明损耗验证**：手工构造两个同等繁荣度聚落，分别给 0 与 0.8 的 `crystalDamageReduction`，断言高减伤聚落在 Alpha 邻接伤害后保留更多繁荣度；同时断言 Alpha 邻接会按 `alphaCivilizationDecay` 降低文明。
*   **人类动态重生点验证**：手工构造天气良好/雷暴/晶石邻近/人类部落邻近的候选空地，断言 `updateHumanRespawnPoint()` 会优先选择天气适宜、远离晶石且靠近人类部落的位置；当原点变为不可居住时，下一次刷新会自动迁移，并且 `spawnHuman()` 会使用动态点。
*   **Beta 采矿验证**：低文明聚落只积累少量开采进度，高文明聚落仍更快但默认不再一回合完成；开采完成后 Beta 转为空地并提供开采奖励，但周围 BIO 文明保持不变。
*   **聚落规模验证**：小部落能获得生存缓冲；达到 `bioMaxSettlementCells` 的聚落不会继续直接占邻格，而是生成迁徙者。
*   **迁徙者稳定性验证**：低繁荣迁徙者不会立即落地成不稳定聚落；相邻 Beta 晶石不会对迁徙者施加范围伤害。
*   **地块不消失验证**：在低地幔能量、高 shrink 阈值的构造场景中直接运行地幔层，断言已有地块不会消失。
*   **环形前缘验证**：默认 50×50 圆形岛屿中心 Alpha 起点，套用 `RING_FRONT_PARAMS` 推进 820 步（120 步延迟 + 700 步晶石演化），断言中心半径 6 内无活跃 Alpha 且全为 Beta，外圈半径 12..20 至少 300 个活跃 Alpha；随后部署六点吸能阵列，断言 50 步内解除灾害、200 步内 Alpha 清零，且 600 步窗口内不复燃。
*   **地形迁徙与天气验证**：手工构造高原-平原-中坡走廊，断言迁徙者不会跨越陡崖而会选择唯一可通行走廊；同等地幔能量下，高海拔格从地幔获得的升温幅度必须低于低海拔格；天气小场景覆盖持久风衰减、山口风强于陡坡跨越、Alpha 天气核、Beta 稳定器与地幔弱气候异常。
*   **静态契约**：14 个模块文件齐全、均 <500 行、各层以组合对象导出、引擎导出类且用 `bind(this)` 组合、`@section` 标记存在、无裸字符串晶石状态。

> 网格尺寸敏感：常规冒烟测试仍用 32×32，因为默认初始陆地半径 `min(w,h)*0.4≈12.8 < maxRadius(15)`，地幔扩张分支才会被真正触发。稳定性主参考固定使用 50×50 环形前缘。

## 7. 禁止行为

*   **禁止引入渲染/UI/DOM 依赖**：本模块任何文件严禁 `import` 渲染层，严禁出现 `document`/`canvas`/`innerHTML`。引擎必须保持纯数据。
*   **禁止使用裸字符串晶石状态**：一律走 `CELL_TYPE.*`（`cell.js` 枚举定义除外）。`validate_world_sim.mjs` 会校验此项。
*   **禁止在生物层主循环直接改网格**：必须用 `changes[]` 队列收集后统一应用（见 4.1）。
*   **禁止单文件超 500 行**：若某层增长逼近上限，须按 `@section` 边界进一步拆分子文件，而非堆进单文件。
*   **禁止擅自接入 `Game` 主类**：本模块当前为独立引擎。接入 gameplay / EventBus 属于新范围，须另立任务并先更新本文档与 `global.md`。
*   **禁止手动编辑 `auto_index/`**：新增/修改文件后运行 `python scripts/generate_index.py . --src-dirs src` 重建索引，严禁手改索引文件。
