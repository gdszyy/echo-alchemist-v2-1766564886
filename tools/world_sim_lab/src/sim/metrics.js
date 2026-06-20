// 指标计算：每帧从 engine.grid「拉取」聚合统计。纯读取，不修改任何引擎状态。
import { CELL_TYPE } from './engine-bridge.js';

/**
 * 遍历网格，聚合人口 / 物种 / 温度 / 能量等指标。
 * @param {import('@engine/engine.js').SimulationEngine} engine
 */
export function computeMetrics(engine, analysis = null, humanReport = null) {
  let land = 0,
    empty = 0,
    alpha = 0,
    beta = 0,
    bio = 0,
    migrants = 0,
    storms = 0,
    absorbing = 0,
    mining = 0;
  let tempSum = 0,
    tempMin = Infinity,
    tempMax = -Infinity,
    mantleSum = 0,
    storedSum = 0,
    prosperitySum = 0,
    elevationSum = 0,
    slopeSum = 0,
    maxSlope = 0,
    basinCells = 0;
  const species = new Set();

  const { grid, width, height } = engine;
  for (let y = 0; y < height; y++) {
    const row = grid[y];
    for (let x = 0; x < width; x++) {
      const c = row[x];
      if (!c.exists) continue;
      land++;
      mantleSum += c.mantleEnergy;
      storedSum += c.storedEnergy;
      elevationSum += c.terrainElevation || 0;
      slopeSum += c.terrainSlope || 0;
      if ((c.terrainSlope || 0) > maxSlope) maxSlope = c.terrainSlope || 0;
      if ((c.terrainBasinDepth || 0) > 0.05) basinCells++;
      const t = c.temperature;
      tempSum += t;
      if (t < tempMin) tempMin = t;
      if (t > tempMax) tempMax = t;
      if (c.hasThunderstorm) storms++;

      switch (c.crystalState) {
        case CELL_TYPE.ALPHA:
          alpha++;
          if (c.isAbsorbing) absorbing++;
          break;
        case CELL_TYPE.BETA:
          beta++;
          break;
        case CELL_TYPE.BIO:
          bio++;
          prosperitySum += c.prosperity;
          if (c.isMining) mining++;
          if (c.bioAttributes) species.add(c.bioAttributes.speciesId);
          break;
        default:
          empty++;
      }

      if (c.migrant) {
        migrants++;
        if (c.migrant.attributes) species.add(c.migrant.attributes.speciesId);
      }
    }
  }

  const disasterStats = analysis?.stats || {};
  const report = humanReport || { baseCount: 0, totalStoredEnergy: 0, totalExtracted: 0, extractedThisTick: 0 };

  return {
    timeStep: engine.timeStep,
    cycleCount: engine.cycleCount,
    land,
    empty,
    alpha,
    beta,
    bio,
    migrants,
    storms,
    absorbing,
    mining,
    species: species.size,
    avgTemp: land ? tempSum / land : 0,
    minTemp: land ? tempMin : 0,
    maxTemp: land ? tempMax : 0,
    avgMantle: land ? mantleSum / land : 0,
    avgElevation: land ? elevationSum / land : 0,
    avgSlope: land ? slopeSum / land : 0,
    maxSlope,
    basinCells,
    storedEnergy: storedSum,
    totalProsperity: prosperitySum,
    avgProsperity: bio ? prosperitySum / bio : 0,
    disasterActive: analysis?.active ? 1 : 0,
    disasterCount: disasterStats.disasterCount || 0,
    criticalSets: analysis?.criticalSets?.length || 0,
    criticalCells: analysis?.criticalCells?.length || 0,
    sourceSeals: analysis?.sourceSeals?.length || 0,
    humanBases: report.baseCount || 0,
    humanExtractedTick: report.extractedThisTick || 0,
    humanExtractedTotal: report.totalExtracted || 0,
    humanStoredEnergy: report.totalStoredEnergy || 0,
  };
}

// 实时曲线可绘制的序列定义（key 对应 computeMetrics 的字段）。
export const METRIC_SERIES = [
  { key: 'bio', label: '聚落', color: '#f59e0b', on: true },
  { key: 'migrants', label: '迁徙者', color: '#ffffff', on: true },
  { key: 'species', label: '物种数', color: '#a78bfa', on: true },
  { key: 'alpha', label: 'Alpha', color: '#10b981', on: true },
  { key: 'disasterCount', label: '灾害', color: '#ef4444', on: true },
  { key: 'humanExtractedTick', label: '抽能', color: '#22d3ee', on: true },
  { key: 'beta', label: 'Beta', color: '#64748b', on: false },
  { key: 'avgTemp', label: '均温', color: '#ef4444', on: true },
  { key: 'avgMantle', label: '地幔能量', color: '#fb923c', on: false },
  { key: 'avgElevation', label: '平均地势', color: '#a3e635', on: false },
  { key: 'maxSlope', label: '最大坡度', color: '#facc15', on: false },
  { key: 'totalProsperity', label: '总繁荣', color: '#22d3ee', on: false },
  { key: 'storms', label: '雷暴', color: '#fbbf24', on: false },
];

// 侧栏「世界状态」读数卡片定义。
export const STAT_CARDS = [
  { key: 'timeStep', label: '时间步', fmt: (v) => v.toLocaleString() },
  { key: 'cycleCount', label: '世代', fmt: (v) => String(v) },
  { key: 'land', label: '陆地格', fmt: (v) => String(v) },
  { key: 'bio', label: '聚落', fmt: (v) => String(v) },
  { key: 'species', label: '物种', fmt: (v) => String(v) },
  { key: 'migrants', label: '迁徙者', fmt: (v) => String(v) },
  { key: 'alpha', label: 'Alpha 晶石', fmt: (v) => String(v) },
  { key: 'beta', label: 'Beta 晶石', fmt: (v) => String(v) },
  { key: 'disasterCount', label: '晶石灾害', fmt: (v) => String(v) },
  { key: 'criticalSets', label: '关键割集', fmt: (v) => String(v) },
  { key: 'sourceSeals', label: '源井目标', fmt: (v) => String(v) },
  { key: 'humanBases', label: '吸能基地', fmt: (v) => String(v) },
  { key: 'humanExtractedTick', label: '本帧抽能', fmt: (v) => v.toFixed(1) },
  { key: 'humanStoredEnergy', label: '基地库存', fmt: (v) => v.toFixed(1) },
  { key: 'avgTemp', label: '平均温度', fmt: (v) => v.toFixed(1), unit: '°' },
  { key: 'avgMantle', label: '平均地幔', fmt: (v) => v.toFixed(0) },
  { key: 'avgElevation', label: '平均地势', fmt: (v) => v.toFixed(2) },
  { key: 'maxSlope', label: '最大坡度', fmt: (v) => v.toFixed(2) },
  { key: 'basinCells', label: '盆地格', fmt: (v) => String(v) },
  { key: 'storms', label: '雷暴格', fmt: (v) => String(v) },
  { key: 'avgProsperity', label: '平均繁荣', fmt: (v) => v.toFixed(1) },
];
