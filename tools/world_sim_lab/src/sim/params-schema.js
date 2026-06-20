// 参数面板元数据：把引擎 DEFAULT_PARAMS 的数值参数按「地幔/地形/气候/晶石/生物/人类」
// 分组，并为每个参数提供中文标签、滑块范围与步长。范围围绕引擎默认值给出便于调参的区间，
// 不改变引擎默认值本身（默认值仍从引擎实时读取，见 engine-bridge.js）。
//
// 注意：参数 key 必须与引擎 params.js 完全一致。lab 启动时会用引擎真实的 DEFAULT_PARAMS
// 做一次「键覆盖校验」（main.js），缺漏会在控制台告警，保证与引擎演进保持同步。

export const PARAM_GROUPS = [
  {
    id: 'mantle',
    label: '地幔层',
    params: [
      { key: 'mantleTimeScale', label: '地幔时间尺度', min: 0, max: 0.05, step: 0.0005 },
      { key: 'expansionThreshold', label: '地形扩张阈值', min: 0, max: 200, step: 1 },
      { key: 'shrinkThreshold', label: '地形缩减阈值', min: 0, max: 200, step: 1 },
      { key: 'mantleEnergyLevel', label: '地幔基础能量', min: 0, max: 300, step: 1 },
      { key: 'maxRadius', label: '世界最大半径', min: 1, max: 100, step: 1 },
      { key: 'minRadius', label: '世界最小半径', min: 1, max: 80, step: 1 },
      { key: 'distortionSpeed', label: '噪声扭曲速度', min: 0, max: 0.2, step: 0.001 },
      { key: 'edgeGenerationWidth', label: '边缘生成宽度', min: 0, max: 12, step: 1 },
      { key: 'edgeGenerationEnergy', label: '边缘生成强度', min: 0, max: 120, step: 0.5 },
      { key: 'edgeGenerationOffset', label: '边缘径向偏移', min: 0, max: 12, step: 1 },
      { key: 'edgeSupplyPointCount', label: '供给点数量 *', min: 1, max: 24, step: 1, structural: true },
      { key: 'edgeSupplyPointSpeed', label: '供给点转速 *', min: 0, max: 0.5, step: 0.005, structural: true },
      { key: 'mantleHeatFactor', label: '地幔热量系数', min: 0, max: 400, step: 1 },
      { key: 'mantleHeatingRate', label: '地幔加热速率', min: 0, max: 0.1, step: 0.001 },
    ],
  },
  {
    id: 'climate',
    label: '气候层',
    params: [
      { key: 'diffusionRate', label: '温度扩散率', min: 0, max: 1, step: 0.01 },
      { key: 'advectionRate', label: '温度平流率', min: 0, max: 1, step: 0.01 },
      { key: 'thunderstormThreshold', label: '雷暴触发阈值', min: 0, max: 120, step: 1 },
      { key: 'seasonalAmplitude', label: '季节温变幅度', min: 0, max: 40, step: 0.5 },
    ],
  },
  {
    id: 'terrain',
    label: '地形层',
    params: [
      { key: 'terrainGeologyRate', label: '地质变迁倍率', min: 0, max: 0.05, step: 0.0005 },
      { key: 'terrainMantleUpliftRate', label: '地幔抬升率', min: 0, max: 0.08, step: 0.001 },
      { key: 'terrainErosionRate', label: '侵蚀回落率', min: 0, max: 0.08, step: 0.001 },
      { key: 'terrainMantleScale', label: '地幔高度尺度', min: 20, max: 500, step: 5 },
      { key: 'terrainSourceUpliftBonus', label: '源井抬升加成', min: 0, max: 0.5, step: 0.01 },
      { key: 'terrainMigrationMaxStep', label: '迁徙最大坡差', min: 0, max: 1, step: 0.01 },
      { key: 'terrainExpansionMaxStep', label: '扩张最大坡差', min: 0, max: 1, step: 0.01 },
      { key: 'terrainSlopeMoveCost', label: '坡度通行代价', min: 0, max: 40, step: 0.5 },
      { key: 'terrainBasinExitCost', label: '盆地爬升代价', min: 0, max: 40, step: 0.5 },
      { key: 'terrainContactPenaltySlope', label: '坡度接触削弱', min: 0, max: 20, step: 0.25 },
      { key: 'terrainElevationCooling', label: '高海拔降温', min: 0, max: 80, step: 1 },
      { key: 'terrainMantleHeatDamping', label: '高地隔绝地幔热', min: 0, max: 1, step: 0.01 },
      { key: 'terrainClimateSlopeResistance', label: '坡地阻热', min: 0, max: 20, step: 0.25 },
      { key: 'terrainClimateBarrierThreshold', label: '热阻断坡差', min: 0, max: 1, step: 0.01 },
      { key: 'terrainOrographicStormBoost', label: '地形雷暴增益', min: 0, max: 80, step: 1 },
      { key: 'terrainBasinHeatRetention', label: '盆地热滞留', min: 0, max: 2, step: 0.05 },
    ],
  },
  {
    id: 'crystal',
    label: '晶石层',
    params: [
      { key: 'alphaEnergyDemand', label: 'Alpha 能耗', min: 0, max: 20, step: 0.1 },
      { key: 'betaEnergyDemand', label: 'Beta 能耗', min: 0, max: 20, step: 0.1 },
      { key: 'mantleAbsorption', label: '地幔吸收效率', min: 0, max: 1, step: 0.01 },
      { key: 'crystalMantleAbsorptionThreshold', label: '吸收地幔能级阈值', min: 0, max: 100, step: 1 },
      { key: 'crystalMantleLocalMargin', label: '吸收局部高差(−999=关)', min: -999, max: 50, step: 1 },
      { key: 'thunderstormEnergy', label: '雷暴充能', min: 0, max: 120, step: 1 },
      { key: 'expansionCost', label: '繁殖能量成本', min: 0, max: 120, step: 0.5 },
      { key: 'maxCrystalEnergy', label: '晶石能量上限', min: 1, max: 240, step: 1 },
      { key: 'energySharingRate', label: '能量共享速率', min: 0, max: 5, step: 0.05 },
      { key: 'energySharingLimit', label: '能量共享上限', min: 0, max: 8, step: 0.05 },
      { key: 'energyDecayRate', label: '能量传输衰减', min: 0, max: 1, step: 0.01 },
      { key: 'harvestThreshold', label: '开采效率阈值', min: 0, max: 5, step: 0.05 },
    ],
  },
  {
    id: 'bio',
    label: '生物层（通用）',
    params: [
      { key: 'extinctionBonus', label: '灭绝释放能量', min: 0, max: 200, step: 1 },
      { key: 'competitionPenalty', label: '异种竞争惩罚', min: 0, max: 50, step: 0.5 },
      { key: 'mutationRate', label: '基因变异概率', min: 0, max: 1, step: 0.01 },
      { key: 'mutationStrength', label: '基因变异强度', min: 0, max: 1, step: 0.01 },
      { key: 'newSpeciesThreshold', label: '新物种判定阈值', min: 0, max: 1, step: 0.01 },
      { key: 'minProsperityGrowth', label: '最小繁荣增长', min: 0, max: 50, step: 0.5 },
      { key: 'sameSpeciesBonus', label: '同种协作加成', min: 0, max: 5, step: 0.05 },
    ],
  },
  {
    id: 'human',
    label: '人类 / 物种参数',
    params: [
      { key: 'humanMinTemp', label: '宜居最低温', min: -50, max: 100, step: 1 },
      { key: 'humanMaxTemp', label: '宜居最高温', min: -50, max: 100, step: 1 },
      { key: 'humanSurvivalMinTemp', label: '极限最低温', min: -150, max: 50, step: 1 },
      { key: 'humanSurvivalMaxTemp', label: '极限最高温', min: 0, max: 150, step: 1 },
      { key: 'humanProsperityGrowth', label: '繁荣增长率', min: 0, max: 10, step: 0.1 },
      { key: 'humanProsperityDecay', label: '繁荣衰减率', min: 0, max: 10, step: 0.1 },
      { key: 'humanExpansionThreshold', label: '扩张阈值', min: 0, max: 200, step: 1 },
      { key: 'humanMiningReward', label: '开采奖励', min: 0, max: 100, step: 1 },
      { key: 'humanMigrationThreshold', label: '迁移阈值', min: 0, max: 200, step: 1 },
      { key: 'alphaRadiationDamage', label: 'Alpha 辐射伤害', min: 0, max: 100, step: 1 },
      { key: 'humanRespawnDelay', label: '灭绝重生延迟', min: 0, max: 200, step: 1 },
      { key: 'bioAutoSpawnCount', label: '自动投放阈值', min: 0, max: 30, step: 1 },
      { key: 'bioAutoSpawnInterval', label: '自动投放间隔', min: 1, max: 200, step: 1 },
      { key: 'migrantExpansionProb', label: '迁徙者生成概率', min: 0, max: 1, step: 0.01 },
      { key: 'radiationImmunityThreshold', label: '辐射免疫阈值', min: 0, max: 500, step: 5 },
    ],
  },
  {
    id: 'extractor',
    label: '人类吸能基地',
    params: [
      { key: 'humanExtractorRadius', label: '吸能半径', min: 0.5, max: 14, step: 0.1 },
      { key: 'humanExtractorDrainRate', label: '单格抽能速率', min: 0, max: 1800, step: 5 },
      { key: 'humanExtractorEfficiency', label: '库存转化效率', min: 0.05, max: 1, step: 0.01 },
      { key: 'humanExtractorCapacity', label: '库存上限', min: 10, max: 2000000, step: 1000 },
      { key: 'humanExtractorMaintenanceCost', label: '维护消耗', min: 0, max: 5000, step: 5 },
      { key: 'humanExtractorAutoUpgrade', label: '自动升级', type: 'boolean' },
      { key: 'humanExtractorUpgradeThreshold', label: '升级库存阈值', min: 10, max: 1000, step: 10 },
      { key: 'humanExtractorMaxLevel', label: '最大等级', min: 1, max: 10, step: 1 },
      { key: 'humanExtractorLevelDrainMultiplier', label: '每级抽能增幅', min: 0, max: 1, step: 0.01 },
      { key: 'humanExtractorLevelRadiusBonus', label: '每级半径增幅', min: 0, max: 2, step: 0.05 },
      { key: 'humanExtractorMantleFloor', label: '地幔保底能量', min: 0, max: 60, step: 1 },
      { key: 'humanExtractorFalloffPower', label: '半径衰减指数', min: 0.2, max: 4, step: 0.05 },
    ],
  },
];

// 结构性参数：仅在构造时被引擎读取（构造边缘供给点等），改动后需要重建引擎才生效。
// 标 " *" 的参数 onChange 会触发 rebuild。其余参数均为「逐帧读取」，滑块改动下一帧即生效。
export const STRUCTURAL_KEYS = new Set(
  PARAM_GROUPS.flatMap((g) => g.params.filter((p) => p.structural).map((p) => p.key))
);

/** 返回 schema 覆盖的全部参数 key（用于与引擎 DEFAULT_PARAMS 做覆盖校验）。 */
export function schemaKeys() {
  return PARAM_GROUPS.flatMap((g) => g.params.map((p) => p.key));
}
