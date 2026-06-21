// 世界变迁模拟器 - 模拟参数字典
// 移植自 world-morphing-simulator/client/src/lib/simulation/engine.ts（SimulationParams / DEFAULT_PARAMS）
// 控制整个模拟系统的物理法则与数值平衡。原 TS interface 转为 JSDoc typedef。

/**
 * @typedef {Object} SimulationParams
 * // --- 地幔层 ---
 * @property {number} mantleTimeScale      地幔能量更新时间尺度（平滑系数）
 * @property {number} expansionThreshold   地形扩张阈值
 * @property {number} shrinkThreshold      地形缩减阈值
 * @property {number} mantleEnergyLevel    地幔基础能量等级（倍率）
 * @property {number} maxRadius            世界最大半径限制
 * @property {number} minRadius            世界最小半径限制（保护核心区域）
 * @property {number} distortionSpeed      噪声扭曲速度
 * @property {number} edgeGenerationWidth  边缘能量生成宽度
 * @property {number} edgeGenerationEnergy 边缘能量生成基础强度
 * @property {number} edgeGenerationOffset 边缘生成径向偏移（从边缘向内第几层）
 * @property {number} edgeSupplyPointCount 边缘能量供给点数量
 * @property {number} edgeSupplyPointSpeed 边缘供给点旋转速度
 * @property {number} mantleHeatFactor     地幔热量系数
 * @property {number} mantleHeatingRate    地幔加热速率（耦合度）
 * // --- 地形层（由地幔层维护，供生物/气候读取）---
 * @property {number} terrainGeologyRate  地势受地幔影响的连续慢速倍率
 * @property {number} terrainMantleUpliftRate 地幔高能抬升地势的混合率
 * @property {number} terrainErosionRate   地形向邻域均值侵蚀的混合率
 * @property {number} terrainMantleScale   地幔能量映射到高度时的尺度
 * @property {number} terrainSourceUpliftBonus 持久源井对高度目标的额外抬升
 * @property {number} terrainMigrationMaxStep 迁徙者单步可跨越的最大高度差
 * @property {number} terrainExpansionMaxStep 聚落直接扩张可跨越的最大高度差
 * @property {number} terrainSlopeMoveCost 坡度带来的移动代价倍率
 * @property {number} terrainBasinExitCost 盆地向外爬升时的额外代价倍率
 * @property {number} terrainContactPenaltySlope 坡度削弱邻接竞争/协作的强度
 * // --- 气候层 ---
 * @property {number} diffusionRate        温度扩散率
 * @property {number} advectionRate        温度平流率（风）
 * @property {number} thunderstormThreshold 雷暴触发阈值
 * @property {number} seasonalAmplitude    季节性温度变化幅度
 * @property {number} terrainElevationCooling 高海拔降低目标温度的强度
 * @property {number} terrainMantleHeatDamping 高海拔削弱地幔加热耦合的强度
 * @property {number} terrainClimateSlopeResistance 坡度削弱热传导/平流的强度
 * @property {number} terrainClimateBarrierThreshold 高于该坡差时显著阻隔热交换
 * @property {number} terrainOrographicStormBoost 坡地抬升对雷暴判定的增益
 * @property {number} terrainBasinHeatRetention 盆地减少辐射散热的比例
 * @property {number} climateBaseTemp     Weak surface climate baseline.
 * @property {number} climateBaseReturnRate Temperature drift rate toward the weak base climate.
 * @property {number} mantleClimateAnomalyScale Mantle energy anomaly scale for climate.
 * @property {number} mantleClimateAnomalyRate Mantle anomaly coupling rate.
 * @property {number} climatePotentialHeatScale Temperature contribution to climate potential.
 * @property {number} climatePotentialCrystalScale Crystal charge contribution to climate potential.
 * @property {number} climatePotentialElevationBias Elevation bias applied to climate potential.
 * @property {number} climatePotentialBasinBias Basin bias applied to climate potential.
 * @property {number} windAcceleration    Potential-gradient acceleration for persistent wind.
 * @property {number} windInertia         Wind persistence between ticks.
 * @property {number} windFriction        Wind damping between ticks.
 * @property {number} windMaxSpeed        Maximum persistent wind speed.
 * @property {number} windCirculationBias Small circulation twist to avoid pure radial flow.
 * @property {number} terrainWindSlopeResistance Slope resistance applied to wind.
 * @property {number} terrainWindBarrierThreshold Steep terrain threshold for wind blocking.
 * @property {number} terrainWindChannelBoost Valley/pass wind boost.
 * @property {number} terrainWindBasinDamping Basin wind damping.
 * @property {number} alphaClimateThermalBias Alpha thermal anomaly.
 * @property {number} alphaClimatePotentialBias Alpha potential anomaly.
 * @property {number} alphaClimateStormBoost Alpha storm boost.
 * @property {number} alphaClimateWindTwist Alpha local wind destabilization.
 * @property {number} betaClimateThermalBias Beta cooling anomaly.
 * @property {number} betaClimatePotentialBias Beta stabilizing potential anomaly.
 * @property {number} betaClimateStormDamping Beta storm damping.
 * // --- 晶石层 ---
 * @property {number} alphaEnergyDemand    Alpha 晶石每帧基础能耗
 * @property {number} betaEnergyDemand     Beta 晶石每帧基础能耗
 * @property {number} mantleAbsorption     Alpha 从地幔吸收能量的效率
 * @property {number} crystalMantleAbsorptionThreshold Alpha 可吸收地幔能量的最低地幔能级
 * @property {number} crystalMantleLocalMargin Alpha 可吸收地幔能量所需的局部能量高差
 * @property {number} thunderstormEnergy   雷暴击中晶石的瞬间能量
 * @property {number} expansionCost        晶石扩张（分裂）能量成本
 * @property {number} maxCrystalEnergy     晶石最大能量上限
 * @property {number} energySharingRate    Alpha 网络能量共享速率
 * @property {number} energySharingLimit   能量共享上限倍率
 * @property {number} energyDecayRate      能量传输衰减率
 * @property {number} harvestThreshold     生物开采 Beta 的效率阈值
 * @property {number} initialAlphaDelaySteps 初始中心 Alpha 延迟播种步数
 * @property {number} initialAlphaRadius   初始中心 Alpha 播种半径
 * // --- 人类地幔能量汲取 ---
 * @property {number} humanExtractorRadius 基地吸能影响半径
 * @property {number} humanExtractorDrainRate 基地单格基础抽能速率
 * @property {number} humanExtractorEfficiency 抽取能量转为基地库存的效率
 * @property {number} humanExtractorCapacity 基地能量库存上限
 * @property {number} humanExtractorMaintenanceCost 基地每步维护消耗
 * @property {boolean} humanExtractorAutoUpgrade 是否允许基地用库存自动升级
 * @property {number} humanExtractorUpgradeThreshold 基地升级所需库存
 * @property {number} humanExtractorMaxLevel 基地最大等级
 * @property {number} humanExtractorLevelDrainMultiplier 每级抽能倍率增幅
 * @property {number} humanExtractorLevelRadiusBonus 每级半径增幅
 * @property {number} humanExtractorMantleFloor 抽能后保留的最低地幔能量
 * @property {number} humanExtractorFalloffPower 半径衰减曲线指数
 * // --- 生物层通用 ---
 * @property {number} extinctionBonus      灭绝时释放的能量/繁荣度总量
 * @property {number} competitionPenalty   异种相邻竞争惩罚系数
 * @property {number} mutationRate         扩张时基因变异概率
 * @property {number} mutationStrength     基因变异强度
 * @property {number} newSpeciesThreshold  判定新物种的属性差异阈值
 * @property {number} minProsperityGrowth  非人类生物最小繁荣度增长
 * @property {number} sameSpeciesBonus     同种相邻协作加成
 * @property {number} civilizationCrystalDamageReductionScale 文明程度转化为晶石伤害减免的倍率
 * @property {number} bioMaxSettlementCells 单个同物种连续聚落的最大占地格数
 * @property {number} bioSmallSettlementSize 小部落保护判定的最大连续格数
 * @property {number} bioSmallSettlementSurvivalBonus 小部落每步繁荣保底补偿
 * @property {number} bioSmallSettlementCompetitionResistance 小部落受到强势邻居竞争时的减伤比例
 * @property {number} bioExpansionCost 聚落扩张或产生迁徙者时消耗/转移的繁荣度
 * @property {number} [migrantSettleMinProsperity] 迁徙者定居所需最低繁荣度；默认使用物种 migrationThreshold
 * @property {number} randomSpeciesMinCrystalDamageReduction 随机物种最低晶石伤害减免比例
 * @property {number} randomSpeciesMaxCrystalDamageReduction 随机物种最高晶石伤害减免比例
 * @property {number} initialBioSpeciesCount 初始地图随机生物物种数
 * @property {number} initialBioMinProsperity 初始聚落最低繁荣度
 * @property {number} initialBioMaxProsperity 初始聚落最高繁荣度
 * @property {number} initialBioMinSettlementSize 初始聚落最小占地格数
 * @property {number} initialBioMaxSettlementSize 初始聚落最大占地格数
 * @property {number} initialBioCrystalTolerantRatio 初始物种中倾向靠近 Alpha 的比例
 * @property {number} initialBioAlphaSafeDistance 非耐受初始物种与 Alpha 的安全距离
 * @property {number} crystalTolerantDamageReductionMin 耐受型初始物种最低晶石伤害减免
 * @property {number} crystalTolerantDamageReductionMax 耐受型初始物种最高晶石伤害减免
 * @property {number} betaMiningRate Beta 晶石开采基础进度倍率
 * @property {number} betaMiningMinRate Beta 晶石最低开采进度，避免低文明完全停摆
 * @property {number} alphaCivilizationDecay Alpha 邻接每步对生物文明的保留比例
 * // --- 人类（默认物种）---
 * @property {number} humanMinTemp
 * @property {number} humanMaxTemp
 * @property {number} humanSurvivalMinTemp
 * @property {number} humanSurvivalMaxTemp
 * @property {number} humanProsperityGrowth
 * @property {number} humanProsperityDecay
 * @property {number} humanExpansionThreshold
 * @property {number} humanMiningReward
 * @property {number} humanMigrationThreshold
 * @property {number} alphaRadiationDamage
 * @property {number} humanCivilizationLevel 人类初始文明程度
 * @property {number} humanCrystalDamageReduction 人类晶石伤害减免比例
 * @property {number} humanInitialMinProsperity 初始人类最低繁荣度
 * @property {number} humanInitialMaxProsperity 初始人类最高繁荣度
 * @property {number} humanInitialMinSettlementSize 初始人类最小聚落格数
 * @property {number} humanInitialMaxSettlementSize 初始人类最大聚落格数
 * @property {boolean} initialHumanSpawn 是否自动投放/重生人类聚落
 * @property {{x:number,y:number}} [humanSpawnPoint] 人类强制重生点
 * @property {number} humanRespawnCrystalRadius 动态重生点检测晶石风险半径
 * @property {number} humanRespawnTribeRadius 动态重生点检测人类部落半径
 * @property {number} humanRespawnTribeSupportCap 人类部落支援评分封顶值
 * @property {number} humanRespawnWeatherWeight 动态重生点天气评分权重
 * @property {number} humanRespawnCrystalWeight 动态重生点晶石安全评分权重
 * @property {number} humanRespawnTribeWeight 动态重生点附近人类部落评分权重
 * @property {number} humanRespawnTerrainWeight 动态重生点地形通行评分权重
 * @property {number} humanRespawnDelay    人类灭绝后重生延迟（步数）
 * @property {number} bioAutoSpawnCount    自动生成新物种的触发阈值（物种数少于此值）
 * @property {number} bioAutoSpawnInterval 自动生成新物种的时间间隔（步数）
 * @property {number} migrantExpansionProb 扩张时生成迁徙者的概率（否则生成新聚落）
 * @property {number} radiationImmunityThreshold Alpha 辐射免疫阈值
 */

/** @type {SimulationParams} */
export const DEFAULT_PARAMS = {
    // 地幔层
    mantleTimeScale: 0.002,
    expansionThreshold: 82,
    shrinkThreshold: 22,
    mantleEnergyLevel: 100,
    maxRadius: 15,
    minRadius: 10,
    distortionSpeed: 0.01,
    edgeGenerationWidth: 3,
    edgeGenerationEnergy: 19.5,
    edgeGenerationOffset: 1,
    edgeSupplyPointCount: 6,
    edgeSupplyPointSpeed: 0.05,
    mantleHeatFactor: 197,
    mantleHeatingRate: 0.005,

    // 地形层（由地幔层维护，供生物/气候读取）
    terrainGeologyRate: 0.01,
    terrainMantleUpliftRate: 0.014,
    terrainErosionRate: 0.018,
    terrainMantleScale: 210,
    terrainSourceUpliftBonus: 0.18,
    terrainMigrationMaxStep: 0.36,
    terrainExpansionMaxStep: 0.42,
    terrainSlopeMoveCost: 10,
    terrainBasinExitCost: 8,
    terrainContactPenaltySlope: 4,

    // 气候层
    diffusionRate: 0.2,
    advectionRate: 0.02,
    thunderstormThreshold: 39,
    seasonalAmplitude: 5.0,
    terrainElevationCooling: 24,
    terrainMantleHeatDamping: 0.65,
    terrainClimateSlopeResistance: 4,
    terrainClimateBarrierThreshold: 0.32,
    terrainOrographicStormBoost: 18,
    terrainBasinHeatRetention: 0.45,
    climateBaseTemp: -10,
    climateBaseReturnRate: 0.006,
    mantleClimateAnomalyScale: 8,
    mantleClimateAnomalyRate: 0.003,
    climatePotentialHeatScale: 0.06,
    climatePotentialCrystalScale: 1,
    climatePotentialElevationBias: 0.8,
    climatePotentialBasinBias: 0.35,
    windAcceleration: 0.05,
    windInertia: 0.82,
    windFriction: 0.08,
    windMaxSpeed: 1.6,
    windCirculationBias: 0.04,
    terrainWindSlopeResistance: 4,
    terrainWindBarrierThreshold: 0.32,
    terrainWindChannelBoost: 0.35,
    terrainWindBasinDamping: 0.3,
    alphaClimateThermalBias: 8,
    alphaClimatePotentialBias: -10,
    alphaClimateStormBoost: 0.18,
    alphaClimateWindTwist: 0.06,
    betaClimateThermalBias: -3,
    betaClimatePotentialBias: 3,
    betaClimateStormDamping: 0.08,

    // 晶石层
    alphaEnergyDemand: 4.5,
    betaEnergyDemand: 2.0,
    mantleAbsorption: 0.1,
    crystalMantleAbsorptionThreshold: 10,
    crystalMantleLocalMargin: -999,
    thunderstormEnergy: 32,
    expansionCost: 8.5,
    maxCrystalEnergy: 50,
    energySharingRate: 1.45,
    energySharingLimit: 1.2,
    energyDecayRate: 0.09,
    harvestThreshold: 0.8,
    initialAlphaDelaySteps: 120,
    initialAlphaRadius: 3,

    // 人类地幔能量汲取（默认无基地，显式 addHumanEnergyBase 后生效）
    humanExtractorRadius: 4,
    humanExtractorDrainRate: 2.4,
    humanExtractorEfficiency: 0.75,
    humanExtractorCapacity: 240,
    humanExtractorMaintenanceCost: 0.2,
    humanExtractorAutoUpgrade: true,
    humanExtractorUpgradeThreshold: 160,
    humanExtractorMaxLevel: 5,
    humanExtractorLevelDrainMultiplier: 0.35,
    humanExtractorLevelRadiusBonus: 0.6,
    humanExtractorMantleFloor: 0,
    humanExtractorFalloffPower: 1.35,

    // 生物层通用
    extinctionBonus: 16,
    competitionPenalty: 1.8,
    mutationRate: 0.06,
    mutationStrength: 0.06,
    newSpeciesThreshold: 0.2,
    minProsperityGrowth: 0.35,
    sameSpeciesBonus: 0.2,
    civilizationCrystalDamageReductionScale: 0.32,
    bioMaxSettlementCells: 8,
    bioSmallSettlementSize: 3,
    bioSmallSettlementSurvivalBonus: 0.45,
    bioSmallSettlementCompetitionResistance: 0.55,
    bioExpansionCost: 45,
    randomSpeciesMinCrystalDamageReduction: 0,
    randomSpeciesMaxCrystalDamageReduction: 0.55,
    initialBioSpeciesCount: 10,
    initialBioMinProsperity: 35,
    initialBioMaxProsperity: 85,
    initialBioMinSettlementSize: 1,
    initialBioMaxSettlementSize: 5,
    initialBioCrystalTolerantRatio: 0.35,
    initialBioAlphaSafeDistance: 3,
    crystalTolerantDamageReductionMin: 0.8,
    crystalTolerantDamageReductionMax: 0.95,
    betaMiningRate: 0.25,
    betaMiningMinRate: 0.01,
    alphaCivilizationDecay: 0.965,

    // 人类层（默认生物）
    humanMinTemp: 7,
    humanMaxTemp: 34,
    humanSurvivalMinTemp: -50,
    humanSurvivalMaxTemp: 50,
    humanProsperityGrowth: 0.35,
    humanProsperityDecay: 0.9,
    humanExpansionThreshold: 165,
    humanMiningReward: 10,
    humanMigrationThreshold: 28,
    alphaRadiationDamage: 10,
    humanCivilizationLevel: 0.18,
    humanCrystalDamageReduction: 0.28,
    humanInitialMinProsperity: 50,
    humanInitialMaxProsperity: 95,
    humanInitialMinSettlementSize: 2,
    humanInitialMaxSettlementSize: 5,
    initialHumanSpawn: true,
    humanRespawnCrystalRadius: 4,
    humanRespawnTribeRadius: 6,
    humanRespawnTribeSupportCap: 3,
    humanRespawnWeatherWeight: 55,
    humanRespawnCrystalWeight: 45,
    humanRespawnTribeWeight: 28,
    humanRespawnTerrainWeight: 8,
    humanRespawnDelay: 20,
    bioAutoSpawnCount: 5,
    bioAutoSpawnInterval: 18,
    migrantExpansionProb: 0.9,
    radiationImmunityThreshold: 200,
};
