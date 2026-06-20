export const DISASTER_OPTIONS = {
  activeEnergyThreshold: 20,
  sourceMantleThreshold: 999,
  sourceEnergyThreshold: 10,
  minComponentCells: 9,
  minActiveCells: 6,
  minSourceCells: 1,
  minIsolatedActiveCells: 4,
  maxSourceCellsPerComponent: 1,
};

export const STABLE_SOURCE_BASIN_PARAMS = {
  mantleTimeScale: 0.002,
  expansionThreshold: 180,
  shrinkThreshold: 0,
  mantleEnergyLevel: 100,
  maxRadius: 24,
  alphaEnergyDemand: 0.07,
  mantleAbsorption: 0.7,
  crystalMantleAbsorptionThreshold: 60,
  crystalMantleLocalMargin: 15,
  expansionCost: 70,
  maxCrystalEnergy: 120,
  energySharingRate: 5,
  energySharingLimit: 1.2,
  energyDecayRate: 0,
  thunderstormEnergy: 0,
  edgeGenerationEnergy: 0,
  edgeSupplyPointSpeed: 0.01,
  humanExtractorRadius: 10,
  humanExtractorDrainRate: 800,
  humanExtractorEfficiency: 1,
  humanExtractorCapacity: 800000,
  humanExtractorMaintenanceCost: 2500,
  humanExtractorMantleFloor: 0,
  humanExtractorAutoUpgrade: false,
  bioAutoSpawnCount: 0,
};

export const RING_FRONT_PARAMS = {
  mantleTimeScale: 0.0088,
  expansionThreshold: 121.4524,
  shrinkThreshold: 10.5589,
  mantleEnergyLevel: 145.3781,
  maxRadius: 20.0939,
  minRadius: 9.9152,
  edgeGenerationWidth: 6.6919,
  edgeGenerationEnergy: 73.7103,
  edgeGenerationOffset: 1.2138,
  edgeSupplyPointCount: 9,
  edgeSupplyPointSpeed: 0.0751,
  alphaEnergyDemand: 4.176,
  mantleAbsorption: 0.2274,
  crystalMantleAbsorptionThreshold: 16.3772,
  crystalMantleLocalMargin: -755.946,
  thunderstormEnergy: 5.8316,
  expansionCost: 7.402,
  maxCrystalEnergy: 114.3295,
  energySharingRate: 0.5819,
  energySharingLimit: 1.8014,
  energyDecayRate: 0.1969,
  humanExtractorRadius: 9,
  humanExtractorDrainRate: 800,
  humanExtractorEfficiency: 1,
  humanExtractorCapacity: 800000,
  humanExtractorMaintenanceCost: 2500,
  humanExtractorMantleFloor: 0,
  humanExtractorAutoUpgrade: false,
  bioAutoSpawnCount: 0,
  humanRespawnDelay: 999999,
};
export const RING_FRONT_SEED = 42;
export const RING_FRONT_PREVIEW_TICKS = 700;
export const RING_FRONT_KEY_SIPHON_COUNT = 6;
export const RING_FRONT_KEY_SIPHON_PLACEMENT_RADIUS_RATIO = 0.32;

export const SCENARIOS = [
  { id: 'natural', label: '默认演化' },
  { id: 'source-basin', label: '源井盆地' },
  { id: 'source-circle', label: '圆形源井' },
];

export function applyScenario(engine, scenarioId) {
  if (scenarioId === 'source-basin' && typeof engine.seedCrystalSourceBasinTerrain === 'function') {
    return engine.seedCrystalSourceBasinTerrain({ angle: 0 });
  }
  if (scenarioId === 'source-circle' && typeof engine.seedCrystalSourceBasinTerrain === 'function') {
    return engine.seedCrystalSourceBasinTerrain({ angle: 0, landShape: 'circle' });
  }
  return null;
}

export function analyzeDisaster(engine) {
  if (!engine || typeof engine.analyzeCrystalDisaster !== 'function') {
    return {
      active: false,
      components: [],
      disasters: [],
      criticalCells: [],
      criticalSets: [],
      sourceSeals: [],
      stats: { alphaCells: 0, componentCount: 0, disasterCount: 0 },
    };
  }
  return engine.analyzeCrystalDisaster(DISASTER_OPTIONS);
}

function addUnique(targets, seen, candidates, limit) {
  for (const item of candidates) {
    if (!item || targets.length >= limit) break;
    const key = `${item.x},${item.y}`;
    if (seen.has(key)) continue;
    seen.add(key);
    targets.push({ x: item.x, y: item.y });
  }
}

function nearestExistingCell(engine, x, y) {
  let best = null;
  let bestDist = Infinity;
  for (let yy = 0; yy < engine.height; yy++) {
    for (let xx = 0; xx < engine.width; xx++) {
      const cell = engine.grid[yy][xx];
      if (!cell.exists) continue;
      const dist = (xx - x) ** 2 + (yy - y) ** 2;
      if (dist < bestDist) {
        bestDist = dist;
        best = { x: xx, y: yy };
      }
    }
  }
  return best;
}

export function selectRingFrontKeySiphons(engine, count = RING_FRONT_KEY_SIPHON_COUNT) {
  if (!engine?.grid?.length) return [];
  const centerX = engine.width / 2;
  const centerY = engine.height / 2;
  const radius = Math.min(engine.width, engine.height) * RING_FRONT_KEY_SIPHON_PLACEMENT_RADIUS_RATIO;
  const targets = [];
  const seen = new Set();

  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2;
    const target = nearestExistingCell(
      engine,
      Math.round(centerX + Math.cos(angle) * radius),
      Math.round(centerY + Math.sin(angle) * radius),
    );
    if (!target) continue;
    const key = `${target.x},${target.y}`;
    if (seen.has(key)) continue;
    seen.add(key);
    targets.push(target);
  }

  return targets;
}

export function selectInterventionTargets(analysis, limit = 3) {
  const targets = [];
  const seen = new Set();
  addUnique(targets, seen, analysis.sourceSeals || [], limit);
  addUnique(targets, seen, (analysis.criticalSets || []).flatMap((set) => set.cells || []), limit);
  addUnique(targets, seen, analysis.criticalCells || [], limit);
  return targets;
}

export function deployRecommendedSiphons(engine, analysis, limit = 3) {
  if (!engine || typeof engine.addHumanEnergyBase !== 'function') return 0;
  let count = 0;
  for (const target of selectInterventionTargets(analysis, limit)) {
    const base = engine.addHumanEnergyBase(target.x, target.y, {
      id: `lab-siphon-${engine.humanEnergyBases.length + 1}`,
    });
    if (base) count++;
  }
  return count;
}

export function deployRingFrontKeySiphons(engine) {
  if (!engine || typeof engine.addHumanEnergyBase !== 'function') {
    return { placed: 0, targets: [] };
  }
  const occupied = new Set((engine.humanEnergyBases || []).map((base) => `${base.x},${base.y}`));
  const targets = selectRingFrontKeySiphons(engine);
  let placed = 0;
  for (const target of targets) {
    const key = `${target.x},${target.y}`;
    if (occupied.has(key)) continue;
    const base = engine.addHumanEnergyBase(target.x, target.y, {
      id: `lab-ring-front-siphon-${engine.humanEnergyBases.length + 1}`,
    });
    if (base) {
      occupied.add(key);
      placed++;
    }
  }
  return { placed, targets };
}

export function hitBestCriticalSet(engine, analysis) {
  if (!engine || typeof engine.applyCrystalInterventions !== 'function') return null;
  const targets = analysis.criticalSets?.[0]?.cells || analysis.criticalCells?.slice(0, 1) || [];
  if (targets.length === 0) return null;
  return engine.applyCrystalInterventions(targets, DISASTER_OPTIONS);
}

export function clearHumanEnergyBases(engine) {
  if (engine && Array.isArray(engine.humanEnergyBases)) {
    engine.humanEnergyBases.length = 0;
  }
}

export function getHumanEnergyReport(engine) {
  if (engine && typeof engine.getHumanEnergyReport === 'function') return engine.getHumanEnergyReport();
  return { baseCount: 0, totalStoredEnergy: 0, totalExtracted: 0, extractedThisTick: 0, bases: [] };
}
