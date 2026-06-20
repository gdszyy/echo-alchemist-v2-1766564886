# 世界迁移模型：晶石灾害稳定性研究记录

> 日期：2026-06-20
> 范围：`src/world_sim/` 纯数据模型；不接入 `Game`、EventBus、DOM 或渲染。

## 1. 稳定性的判定逻辑

把一次模拟看作离散时间系统：

```text
S(t + 1) = F(S(t), params, rng)
```

`S(t)` 包含地幔能量、地形、温度、晶石状态、晶石储能和生物层状态。晶石灾害不按单格判断，而是在观测窗口 `W=[warmup,ticks)` 上用宏观量判断。

正式“稳定晶石灾害”必须满足：

| 指标 | 记号 | 计算方式 | 当前阈值 |
|------|------|----------|----------|
| 稳定窗口 | `stableWindowTicks` | `ticks - warmup` | `>= 600` |
| 灾害持续率 | `activeRatio` | 窗口内 `analyzeCrystalDisaster().active` 为真的比例 | `>= 0.72` |
| 关键点持久性 | `criticalPersistence` | 同一关键格在窗口样本中出现的最高频率 | `>= 0.55` |
| 规模/能量有界性 | `boundedness` | `alphaCells`、`activeCells`、`avgEnergy` 的 `1/(1+CV)` 平均 | `>= 0.55` |
| 活跃规模区间 | `meanActive` | 窗口内平均活跃 Alpha 数 | `50 <= meanActive <= 240` |
| 干预可解除 | `resolveRate` | 指定阻断/吸能后，在衰减窗口结束时 `active=false` | `= 1` |

稳定分两层：

1. **拓扑稳定**：灾害长期存在，关键割点长期存在，活跃规模不无限泛滥。
2. **可解稳定**：对算法给出的关键位置执行阻断或部署人类吸能基地后，灾害能解除。

短窗口运行只能用于调参预筛，不能作为“稳定参数”结论。

## 2. 数学解释

模型是有限网格上的耗散元胞自动机。晶石储能受 `maxCrystalEnergy` 截断，Alpha 网络共享有 `energyDecayRate` 衰减，地形和天气持续扰动，因此严格逐格固定点并不现实。这里采用“亚稳态/准吸引子”定义：只要求窗口内宏观观测量稳定，而不是每一格完全不变。

要形成“只有指定位置可破解”的灾害结构，至少需要四件事：

1. **持续局部源井**：能量必须从少数位置持续注入，否则初始高能量会在百步内扩散/耗尽。
2. **网络窄颈**：源井到活跃盆地之间必须存在割点或小割集。
3. **断供后衰减**：远端活跃区断供后，维持消耗必须大于自供、天气和扩张补给。
4. **竞争性吸能汇**：人类基地要在 Alpha 吸能前抢夺同一份地幔能量，且局部抽能强度要超过源井补给。

本轮新增 `mantleSourceStrength`。它把源井从“初始高能格”改成“每步可恢复到指定地幔能量下限的持久源”，并且该能量先被人类基地抽取，再被 Alpha 吸收。因此源井既可持续，也可被科技压制。

## 3. 搜索脚本

脚本：

```bash
node scripts/world_sim_stability_search.mjs --scenario source-basin --resolutionMode siphon --generations 0 --population 2 --width 50 --height 50 --ticks 800 --warmup 200 --sampleInterval 10 --seeds generated-a,generated-b --maxInterventions 3 --resolveHorizon 800 --minStableTicks 600 --minMeanActiveCells 50 --targetMeanActiveCells 120 --maxMeanActiveCells 240
```

关键基因包括：

```text
mantleTimeScale, expansionThreshold, shrinkThreshold, mantleEnergyLevel, maxRadius,
alphaEnergyDemand, mantleAbsorption,
crystalMantleAbsorptionThreshold, crystalMantleLocalMargin,
expansionCost, maxCrystalEnergy,
energySharingRate, energySharingLimit, energyDecayRate,
thunderstormEnergy, edgeGenerationEnergy, edgeSupplyPointSpeed,
humanExtractorRadius, humanExtractorDrainRate, humanExtractorEfficiency,
humanExtractorCapacity, humanExtractorMaintenanceCost, humanExtractorMantleFloor
```

评分已经加入两个防误判约束：

1. `ticks - warmup < 600` 时不能得到 `isStable=true`。
2. `meanActive` 过大时会降分，避免默认参数那种“整片地形都被晶石吞没”的泛滥解。

## 4. 当前 600 步参考候选

`source-basin` 在 50×50 网格上会启用大规模双叶地貌：约 499 格陆地、235 格初始 Alpha 晶石，包含源井叶片、盆地叶片和单格宽窄颈，而不是小岛屿。`source-circle` 使用同一套源井/晶石链/盆地区，但把陆地轮廓替换为半径约 23 格的圆形大陆，50×50 下约 1653 格陆地、235 格初始 Alpha。32×32 仍保留旧尺寸回退，用于兼容小图实验。参考候选：

```json
{
  "mantleTimeScale": 0.002,
  "expansionThreshold": 180,
  "shrinkThreshold": 0,
  "mantleEnergyLevel": 100,
  "maxRadius": 24,
  "alphaEnergyDemand": 0.07,
  "mantleAbsorption": 0.7,
  "crystalMantleAbsorptionThreshold": 60,
  "crystalMantleLocalMargin": 15,
  "expansionCost": 70,
  "maxCrystalEnergy": 120,
  "energySharingRate": 5,
  "energySharingLimit": 1.2,
  "energyDecayRate": 0,
  "thunderstormEnergy": 0,
  "edgeGenerationEnergy": 0,
  "edgeSupplyPointSpeed": 0.01,
  "humanExtractorRadius": 10,
  "humanExtractorDrainRate": 800,
  "humanExtractorEfficiency": 1,
  "humanExtractorCapacity": 800000,
  "humanExtractorMaintenanceCost": 2500,
  "humanExtractorMantleFloor": 0,
  "humanExtractorAutoUpgrade": false,
  "bioAutoSpawnCount": 0
}
```

双种子验证结果：

```text
stableWindowTicks = 600
stableRate = 1.00
activeRatio = 1.00
criticalPersistence = 1.00
boundedness ≈ 0.73
meanActive ≈ 57.5
resolveRate = 1.00
interventionCount = 3
initial landCells = 499
initial alphaCells = 235
stable critical cells: (10,25), (11,25), (12,25), ...
```

圆形大陆 `source-circle` 同参数、同 600 步窗口验证结果：

```text
stableWindowTicks = 600
stableRate = 1.00
activeRatio = 1.00
criticalPersistence = 1.00
boundedness ≈ 0.72
meanActive ≈ 55.5
resolveRate = 1.00
interventionCount = 3
initial landCells ≈ 1653
initial alphaCells = 235
stable critical cells: (10,25), (11,25), (12,25), ...
```

解释：

1. `mantleSourceStrength=700` 由 50×50 地形播种器写入源井格，维持长期供能。
2. `expansionThreshold=180`、`expansionCost=70` 和 `maxCrystalEnergy=120` 抑制地形/晶石泛滥，同时允许更大的初始晶石面。
3. `alphaEnergyDemand=0.07`、`energySharingRate=5` 与 `energySharingLimit=1.2` 让源井能长期供给盆地，但断供后仍会在 800 步内衰减。`energySharingLimit` 现在实际接入单边传输上限，默认值仍等价于旧的 5 点上限。
4. 三个吸能基地属于“强科技”参考值；`humanExtractorMaintenanceCost=2500` 表示基地会持续消耗抽取能量来维持压制系统，避免库存满后停抽。稳定后部署约 800 步衰减窗口内可解除灾害。
5. 圆形大陆没有地形瓶颈；关键割集来自源井到活跃区之间的窄晶石链。因此如果后续允许晶石绕路扩张，需要继续提高扩张成本、加入地形阻隔，或让圆形大陆内出现能量荒漠带。

## 4.1 圆形岛屿环形前缘参数

另一类可用结构不是“源井 - 窄颈 - 盆地”，而是默认 50×50 圆形岛屿中心 Alpha 团块向外扩散后形成的环形前缘。参考参数在固定 seed `42` 下推进 700 步后得到：

```text
center radius <= 6: 113 / 113 Beta, active Alpha = 0
outer radius 12..20: active Alpha ≈ 615
total Alpha ≈ 630
total Beta ≈ 803
```

核心参数特征：

```json
{
  "mantleTimeScale": 0.0088,
  "mantleEnergyLevel": 145.3781,
  "maxRadius": 20.0939,
  "minRadius": 9.9152,
  "edgeGenerationWidth": 6.6919,
  "edgeGenerationEnergy": 73.7103,
  "edgeGenerationOffset": 1.2138,
  "edgeSupplyPointCount": 9,
  "edgeSupplyPointSpeed": 0.0751,
  "alphaEnergyDemand": 4.176,
  "mantleAbsorption": 0.2274,
  "expansionCost": 7.402,
  "maxCrystalEnergy": 114.3295,
  "energySharingRate": 0.5819,
  "energySharingLimit": 1.8014,
  "energyDecayRate": 0.1969,
  "humanExtractorRadius": 9,
  "humanExtractorDrainRate": 800,
  "humanExtractorMaintenanceCost": 2500
}
```

解释：较高 `alphaEnergyDemand` 与能量传输衰减会让中心旧 Alpha 在扩散后耗尽并退化为 Beta；较宽的边缘供能环和较低扩张成本让外侧前缘继续维持活跃。这个图案适合表达“中间休眠、外圈活跃”的晶石灾害阶段，但它的关键性来自环形能量前缘，不天然等价于“只有指定割点能解除”的拓扑谜题。

### 4.2 环形前缘关键点搜索结果

对 4.1 的稳定态继续搜索后，当前结论是：**单格阻断不是动态关键点**。在 700 步时分析器会把 `(18,41)` 识别为当前最强源井/割集；但只阻断这个格子后，环带会在同一连通分量里快速换出新的源点，600 步后仍保持约 629 个活跃 Alpha。因此它只能算“瞬时源点”，不能算可解关卡的关键点。

真正有效的是围绕活跃前缘的 6 点吸能覆盖阵列：

```text
(41,25), (33,39), (17,39), (9,25), (17,11), (33,11)
```

这些点位于 50×50 圆心 `(25,25)` 周围半径约 16 的六边形上。部署 6 座 `radius=9 / drainRate=800 / maintenanceCost=2500` 的地幔吸能基地后，验证结果为：

```text
部署后 25 步：Alpha 17，active Alpha 12，disaster=false
部署后 50 步：Alpha 0，disaster=false
部署后 600 步：Alpha 0，disaster=false
```

少点数与半径搜索显示，关键规律是“角向覆盖缺口”：

| 吸能半径 | 可清零的代表点数 | 代表部署半径 | 结论 |
|----------|------------------|--------------|------|
| 4 | 20 点仍剩约 17 个活跃 Alpha | 16 | 半径过小，单靠本科技强度不足以可靠清零 |
| 5 | 18 点仍剩约 2 个活跃 Alpha | 16 | 接近清零，但仍不稳定 |
| 6 | 10 点 | 16 | 可用，但点数多 |
| 7 | 9 点 | 16 | 可用 |
| 8 | 7 点 | 16 | 可用 |
| 9 | 6 点 | 16 | 当前推荐平衡点 |
| 11 | 5 点 | 14 | 点数更少，但范围更大 |
| 13 | 4 点 | 12 | 已接近“超大范围覆盖” |
| 18 | 3 点 | 14 | 范围过大，关键点感很弱 |

因此，少于 6 点不是不能做到，而是必须把吸能半径放大到 11、13 甚至 18。若目标是“看起来像指定关键点”，6 点 + 半径 9 比 5 点 + 半径 11 或 4 点 + 半径 13 更合理。其数学含义是：圆形环前缘没有地形瓶颈，关键点来自对旋转边缘供能带的角向覆盖；少点数会留下角向缺口，外圈残余 Alpha 会继续吸能并维持灾害判定。

## 5. 结论与边界

当前算法层已经能建模用户需求中的核心结构：

* 稳定活跃晶石区间/地形；
* 算法自然识别出的关键割点与源井封印点；
* 打错非关键位置不会解除灾害；
* 在指定位置阻断或部署人类吸能基地后，灾害解除。

仍需注意：

1. `source-basin` / `source-circle` 是程序化播种器生成的结构，不是默认圆形 Alpha 团块完全自发长出。
2. 当前吸能参考值偏“强科技”，适合证明模型能力；后续可以继续搜索低抽能、多基地、长周期三类更适合关卡节奏的参数。
3. 默认 `natural` 圆形初始条件仍不容易自然长出“源井 - 窄颈 - 盆地”的谜题结构。
