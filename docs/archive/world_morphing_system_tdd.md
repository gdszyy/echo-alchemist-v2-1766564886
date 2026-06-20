# 世界变迁系统 技术设计文档 (TDD) — 归档

> **归档说明**：本文档记录 `world-morphing-simulator`（独立 TypeScript 原型）的系统设计，以及其引擎核心移植为 Echo `src/world_sim/` 原生 JS 子系统的技术决策。属外部项目的设计沿革，按 `global.md` §4「历史/外部设计方案归档」规范存于 `docs/archive/`。
>
> **活跃规范**见 [`.cursor/rules/world_sim.md`](../../.cursor/rules/world_sim.md)；本文档仅供溯源，不随代码持续更新。

## 1. 系统概述

世界变迁模拟器是一套**元胞自动机（Cellular Automata）星球演化沙盒**。在一张二维网格上，从地质（地幔）到大气（气候）、到资源（晶石）、再到生命（生物）四个层级逐层演化，模拟一颗星球从地壳成形、气候分化、矿藏沉积到生命起源、物种竞争与迁徙灭绝的全过程。

*   **原型技术栈**：TypeScript + React + Vite + shadcn/ui（`world-morphing-simulator`）。模拟核心是 `client/src/lib/simulation/engine.ts`（约 1547 行的 `SimulationEngine` 单体类）+ `perlin.ts`（噪声）。
*   **核心设计原则**：模拟引擎是**纯数据处理层**，与可视化彻底解耦——「视图拉取，引擎不推送」。React 层每帧读取 `engine.grid` 渲染到 Canvas，引擎自身不含任何渲染代码。
*   **移植目标**：将引擎核心（`engine.ts` + `perlin.ts`）移植进 Echo Alchemist V2，**丢弃** React/shadcn 外壳，按 Echo 规范落地为原生 JS 子系统。本轮仅落地引擎与索引，不接入打砖块玩法。

## 2. 元胞与状态模型

网格由元胞（Cell）构成。每个元胞携带跨四层的状态字段，关键如下：

*   `exists`：该格是否为「陆地」（地幔层决定地形边界，虚空格 `exists=false`）。
*   `mantleEnergy`：地幔能量（地质层）。
*   `temperature`：温度（气候层）。
*   `crystalState`：晶石/生物状态，取值 `EMPTY | ALPHA | BETA | BIO`。
*   `storedEnergy` / `crystalEnergy` / `energyFlow`：晶石能量储量、本步获取量、能量流向记录（供可视化）。
*   `prosperity` / `bioAttributes` / `isMining`：生物聚落的繁荣度、物种属性、采矿态。
*   `migrant`：迁徙生物，**独立于 `crystalState`**，可漂浮于任意陆地格之上，与晶石/聚落共存。
*   `hasThunderstorm`：当前格是否处于雷暴。

### 状态机要点

```
        能量枯竭                  繁荣度归零
ALPHA ──────────▶ BETA      BIO ──────────▶ EMPTY（灭绝，散能给邻居）
（活性晶石）       （惰性矿物）  （聚落）
  ▲  富能繁殖          │采矿消耗        │ 环境不足
  │                    ▼                ▼
EMPTY ◀──────────────  被采空      Migrant（迁徙者，择优再定居为 BIO）
```

*   `ALPHA → BETA` 不可逆；`BETA` 只能被生物采矿或随地形塌陷消失。
*   迁徙者是连接「聚落扩张」与「重新定居」的中间态，可跨越不适宜区域寻找宜居地。

## 3. 四层演化管线

每个模拟步严格按 **地幔 → 气候 → 晶石 → 生物** 顺序更新（后层依赖前层产出）。每 1000 步累加一次世代计数 `cycleCount`。

### 3.1 地幔层（Mantle / 地质）

驱动地形与底层能量。三段逻辑：

1.  **旋转边缘供给点**：若干个沿世界边缘旋转的能量供给点（基础角速度 + 正弦摆动），周期性向边缘注入能量，使地形生长不均匀、更自然。
2.  **能量场演化**：逐格计算新能量 = Perlin 噪声源扰动（`×0.1`）+ 邻居扩散（`diffusionStrength=0.4`）+ 边缘径向带注入（落在 `innerBound~outerBound` 半径带内，且与最近供给点夹角 `<π/4` 时按 `cos(diff×4)` 加权）+ 晶石吸收损耗。
3.  **地形增减**：依据能量与到圆心半径的累积量判定——能量持续偏低且超出 `minRadius` 的边缘格会塌陷（`shrinkAccumulator>200`）；能量充足且未达 `maxRadius` 的边缘会向外扩张为新陆地（`expansionAccumulator>100`，扩张消耗 `mantleEnergy-=20`）。

### 3.2 气候层（Climate / 大气）

在已成形地形上演化温度场：

1.  **热传导**：相邻格温度按 `diffusionRate` 趋同。
2.  **地幔加热**：目标温度 `targetTemp = -100 + (mantleEnergy/100) × mantleHeatFactor`，以弱耦合 `mantleHeatingRate` 趋近——地幔能量越高，地表越暖。
3.  **迎风对流（upwind advection）**：以温度梯度构造风场（`windX=-gradientX×2.0`），用双线性插值做上风向平流（`advectionStrength=0.4`），形成温度的横向输运。
4.  **辐射冷却**：所有格以 `coolingRate=0.01` 向环境温度 `ambientTemp=-100` 辐射散热。
5.  **雷暴**：温度足够高（`>-50`）且与邻域温差超阈值时，按 `15%` 概率触发雷暴，为下层晶石提供充能机会。

### 3.3 晶石层（Crystal / 资源）

晶石的能量代谢与繁殖（三段）：

1.  **代谢**：晶石吸收地幔能量（`mantleEnergy>10` 时按 `mantleAbsorption` 吸收）、雷暴额外充能；扣除维持消耗（`alphaEnergyDemand`/`betaEnergyDemand`）；能量上限截断。`ALPHA` 能量耗尽（`storedEnergy<=0`）退化为 `BETA`。
2.  **能量网络**：`ALPHA` 晶石间组成能量网，高能流向低能邻居（单次传输上限 5、带 `energyDecayRate` 衰减、含防震荡钳制），并记录 `energyFlow` 供可视化。
3.  **繁殖扩张**：富能 `ALPHA`（`storedEnergy > expansionCost×2`）向相邻空地繁殖新 `ALPHA`（初始能量 10）。`ALPHA` 扩张只生 `ALPHA`，`BETA` 只能由枯竭转化而来。

### 3.4 生物层（Bio / 生命）

最复杂的一层，含聚落与迁徙者两类主体。采用**「先收集 `changes[]` 后统一应用」**模式避免读到半更新网格。流程：

1.  **普查**：统计生物数 `bioCount`、物种集合 `speciesSet`、人类是否存活。
2.  **投放/重生**：物种数低于阈值时按间隔 `spawnRandomSpecies()` 投放新物种；人类（`speciesId=0`）首次在 `timeStep>=50` 生成，灭绝后按 `humanRespawnDelay` 强制重生。
3.  **聚落演化**：极限温度伤害（每度温差 `-2` 繁荣度）→ 宜居温度带来繁荣增长、偏离则递减 → 同种协作加成 / 异种竞争（仅弱者受损）→ `ALPHA` 辐射伤害（繁荣度越高减免越多，达 `radiationImmunityThreshold` 免疫）→ 采矿相邻 `BETA` 换繁荣度 → 繁荣归零则灭绝散能 → 繁荣达 `expansionThreshold` 则概率变异并生成迁徙者或新聚落 → 繁荣低于 `migrationThreshold` 则整体转为迁徙者。
4.  **迁徙者演化**：每步消耗 1 点繁荣度；落在宜温空地则定居为 `BIO`；否则贪婪移动到温度最接近其最佳温度的邻居。
5.  **变异**：扩张时对 7 个属性键按 `mutationRate` 概率施加 `±val×mutationStrength` 扰动，扰动幅度超过 `val×newSpeciesThreshold` 即判为新物种（赋新 `speciesId` 与颜色）。

## 4. 参数系统

约 50 个可调参数集中在 `DEFAULT_PARAMS`（`params.js`），覆盖：世界半径（`maxRadius:15`/`minRadius:10`）、地幔能量（`mantleEnergyLevel:100`）、边缘供给点（`edgeSupplyPointCount:6`）、温度区间（人类 `humanMinTemp:7`/`humanMaxTemp:34`）、晶石能量代谢、生物繁衍/竞争/变异/迁徙系数等。调参即可显著改变星球演化形态，无需改动逻辑代码。

## 5. 移植映射（TS 单体 → JS 多文件）

`engine.ts`（1547 行单类）按 Echo「单文件 <500 行 + 组合优于继承」拆分为 9 个 ES Module：

| 原型来源（engine.ts / perlin.ts） | 移植后文件 | 行数 |
|-----------------------------------|-----------|------|
| `SimulationEngine` 类骨架、构造、`update`、`getNeighbors` | `engine.js` | 138 |
| `CellType` 联合 + `Cell`/`BioAttributes` interface | `cell.js`（`CELL_TYPE` 常量 + JSDoc 契约 + `createCell` 工厂） | 98 |
| `SimulationParams` interface + 默认值 | `params.js` | 126 |
| `perlin.ts` | `perlin.js` | 69 |
| `updateMantleLayer()` (≈371–685) | `mantle_layer.js` | 187 |
| `updateClimateLayer()` (≈695–800) | `climate_layer.js` | 95 |
| `updateCrystalLayer()` (≈812–956) | `crystal_layer.js` | 160 |
| `updateBioLayer()` / `distributeExtinctionBonus()` (≈969–1376) | `bio_layer.js` | 371 |
| `spawnBio` / `spawnHuman` / `spawnRandomSpecies` (≈1378–1523) | `bio_spawn.js` | 168 |

### 移植决策

*   **组合模式**：四层与生物投放各以对象字面量导出，`SimulationEngine` 构造时 `bind(this)` 注入为实例方法——与 Echo `core.js` 的 `Game` 构造同构。
*   **类型剥离**：删类型注解/`private`/`public`；`interface`→JSDoc；联合类型→`CELL_TYPE` 常量。
*   **死代码清理**：删除地幔层未使用的 `hasVoidNeighbor` 分支；折叠生物层「强者竞争」空分支（`diff`/`damage` 算出后从未使用）。保留 `energySharingLimit`（晶石）、`advectionRate`（气候）等「解构未用」参数以忠实原始参数面，并加注释。
*   **状态字符串归一**：所有晶石/生物状态走 `CELL_TYPE.*`，消除原型中散落的裸字符串。
*   **数值保真**：所有扩散系数、阈值、概率、温度公式逐一保留，未做任何「优化」改写。

## 6. 当前集成状态

*   ✅ 引擎核心移植完成，9 文件均 <500 行，登记进自动函数索引。
*   ✅ 冒烟 + 静态契约测试通过（`tests/validate_world_sim.mjs`）：32×32/200 步与 40×40/120 步均无 NaN/Infinity，四层确实演化。
*   ⬜ **未**接入 `Game` 主类 / `core.js` 的 `_subsystems`。
*   ⬜ **未**注册任何 EventBus 事件，**未**与打砖块玩法耦合。
*   ⬜ **未**移植可视化层（React/Canvas 外壳已丢弃）。

> 后续若要把世界变迁接入 Echo gameplay（如作为某种背景演化系统或 meta 玩法），属新范围，须另立任务，并同步更新 [`.cursor/rules/world_sim.md`](../../.cursor/rules/world_sim.md) 与 [`global.md`](../../.cursor/rules/global.md)。
