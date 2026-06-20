/**
 * validate_world_sim.mjs - 世界变迁模拟器（src/world_sim/）冒烟 + 静态契约校验。
 *
 * 三段校验：
 *   1) 运行时冒烟：实例化 SimulationEngine，跑 200 步，断言无 NaN/Infinity，
 *      且地幔/气候/晶石/生物四层确实在演化。
 *   2) 晶石灾害拓扑：构造供能源 - 窄桥 - 活跃区，断言只有关键阻断点能终止灾害。
 *   3) 静态契约：各层以组合对象导出、>200 行函数带 @section 标记、单文件 <500 行、
 *      不再残留 'ALPHA'/'BIO' 等裸字符串晶石状态（应统一走 CELL_TYPE）。
 *
 * Usage:
 *   node tests/validate_world_sim.mjs
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SIM_DIR = 'src/world_sim';

let passed = 0;
let failed = 0;
const failures = [];

function check(condition, message) {
    if (condition) {
        passed++;
    } else {
        failed++;
        failures.push(message);
        console.log(`  x ${message}`);
    }
}

function read(relPath) {
    return fs.readFileSync(path.join(repoRoot, relPath), 'utf8');
}

function isBad(v) {
    return typeof v !== 'number' || Number.isNaN(v) || !Number.isFinite(v);
}

function terrainElevationDelta(a, b) {
    let delta = 0;
    for (let y = 0; y < Math.min(a.height, b.height); y++) {
        for (let x = 0; x < Math.min(a.width, b.width); x++) {
            const ca = a.grid[y][x];
            const cb = b.grid[y][x];
            if (!ca.exists || !cb.exists) continue;
            delta += Math.abs((ca.terrainElevation ?? 0) - (cb.terrainElevation ?? 0));
        }
    }
    return delta;
}

function terrainElevationSnapshot(engine) {
    return {
        width: engine.width,
        height: engine.height,
        grid: engine.grid.map(row => row.map(c => ({
            exists: c.exists,
            terrainElevation: c.terrainElevation,
        }))),
    };
}

function terrainElevationStats(engine) {
    const values = [];
    for (let y = 0; y < engine.height; y++) {
        for (let x = 0; x < engine.width; x++) {
            const cell = engine.grid[y][x];
            if (cell.exists) values.push(cell.terrainElevation ?? 0);
        }
    }
    values.sort((a, b) => a - b);
    return {
        count: values.length,
        min: values[0] ?? 0,
        max: values[values.length - 1] ?? 0,
        lowlands: values.filter(v => v < 0.3).length,
        midlands: values.filter(v => v >= 0.4 && v <= 0.6).length,
        highlands: values.filter(v => v > 0.72).length,
    };
}

function measureRadialCrystalPattern(engine, activeThreshold = 20) {
    const centerX = engine.width / 2;
    const centerY = engine.height / 2;
    const summary = {
        centerLand: 0,
        centerAlpha: 0,
        centerBeta: 0,
        centerActive: 0,
        outerAlpha: 0,
        outerActive: 0,
        totalAlpha: 0,
        totalBeta: 0,
    };
    for (let y = 0; y < engine.height; y++) {
        for (let x = 0; x < engine.width; x++) {
            const cell = engine.grid[y][x];
            if (!cell.exists) continue;
            const radius = Math.hypot(x - centerX, y - centerY);
            const active = cell.crystalState === CELL_TYPE.ALPHA && cell.storedEnergy >= activeThreshold;
            if (cell.crystalState === CELL_TYPE.ALPHA) summary.totalAlpha++;
            if (cell.crystalState === CELL_TYPE.BETA) summary.totalBeta++;
            if (radius <= 6) {
                summary.centerLand++;
                if (cell.crystalState === CELL_TYPE.ALPHA) summary.centerAlpha++;
                if (cell.crystalState === CELL_TYPE.BETA) summary.centerBeta++;
                if (active) summary.centerActive++;
            } else if (radius >= 12 && radius <= 20) {
                if (cell.crystalState === CELL_TYPE.ALPHA) summary.outerAlpha++;
                if (active) summary.outerActive++;
            }
        }
    }
    return summary;
}

console.log('===================================================');
console.log('  World Sim (src/world_sim) smoke + contract checks');
console.log('===================================================\n');

// ---------------------------------------------------------------------------
// 1) 运行时冒烟测试
// ---------------------------------------------------------------------------
console.log('[1] Runtime smoke (200 ticks)\n');

const { SimulationEngine } = await import('./../src/world_sim/engine.js');
const { CELL_TYPE } = await import('./../src/world_sim/cell.js');
const { DEFAULT_PARAMS } = await import('./../src/world_sim/params.js');

// 网格选 32x32：初始陆地半径 (min*0.4≈12.8) < maxRadius(15)，使地幔扩张逻辑被真正触发，
// 陆地会向 maxRadius 均衡圆盘生长（约 817 格）后停止。过大网格（如 48）初始半径已超 maxRadius，
// 地形会静止——那是忠实的引擎行为，但无法验证扩张分支。
const W = 32;
const H = 32;
const engine = new SimulationEngine(W, H);

// 初始陆地数量
let initialLand = 0;
for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
        if (engine.grid[y][x].exists) initialLand++;
    }
}

const TICKS = 200;
let nanHits = 0;
let sawNonZeroTemp = false;
let sawThunderstorm = false;
let maxBioCount = 0;
let maxProsperity = 0;
let sawBetaCrystal = false; // Alpha 枯竭退化为 Beta 的证据
let landChangedTick = -1;
let sawTerrainSlope = false;
let sawBasinDepth = false;

for (let t = 0; t < TICKS; t++) {
    engine.update();

    let landNow = 0;
    let bioNow = 0;
    for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
            const c = engine.grid[y][x];
            // NaN/Infinity 扫描（仅对存在地块的关键数值字段）
            if (c.exists) {
                if (isBad(c.mantleEnergy) || isBad(c.temperature) ||
                    isBad(c.storedEnergy) || isBad(c.prosperity) ||
                    isBad(c.terrainElevation) || isBad(c.terrainSlope) ||
                    isBad(c.terrainBasinDepth) || isBad(c.terrainMoveCost)) {
                    nanHits++;
                }
                landNow++;
                if (c.temperature !== 0) sawNonZeroTemp = true;
                if (c.hasThunderstorm) sawThunderstorm = true;
                if (c.terrainSlope > 0) sawTerrainSlope = true;
                if (c.terrainBasinDepth > 0) sawBasinDepth = true;
                if (c.crystalState === CELL_TYPE.BETA) sawBetaCrystal = true;
                if (c.crystalState === CELL_TYPE.BIO) {
                    bioNow++;
                    if (c.prosperity > maxProsperity) maxProsperity = c.prosperity;
                }
            }
        }
    }
    if (bioNow > maxBioCount) maxBioCount = bioNow;
    if (landChangedTick === -1 && landNow !== initialLand) landChangedTick = t;
}

check(engine.timeStep === TICKS, `timeStep advanced to ${TICKS} (got ${engine.timeStep})`);
check(nanHits === 0, `no NaN/Infinity across 200 ticks (got ${nanHits} bad cells)`);
check(sawNonZeroTemp, 'climate layer ran (temperatures diverged from 0)');
check(landChangedTick !== -1, 'mantle layer can reshape land extent (land count changed)');
check(sawTerrainSlope, 'terrain metrics expose non-zero slopes');
check(sawBasinDepth, 'terrain metrics expose local basin depth');
check(maxBioCount > 0, `bio layer produced life (max bio cells = ${maxBioCount})`);
check(maxProsperity > 0, `prosperity accrued (max prosperity = ${maxProsperity.toFixed(1)})`);
// 雷暴与 Beta 退化属概率/路径事件，单独提示但不计入失败门槛
console.log(`    (info) thunderstorm seen: ${sawThunderstorm}, beta-degradation seen: ${sawBetaCrystal}, land extent first changed at tick ${landChangedTick}`);

// 二次实例化（不同尺寸/随机种子）确保稳健，不是侥幸跑通
const engine2 = new SimulationEngine(40, 40);
let nanHits2 = 0;
for (let t = 0; t < 120; t++) {
    engine2.update();
    for (let y = 0; y < 40; y++) {
        for (let x = 0; x < 40; x++) {
            const c = engine2.grid[y][x];
            if (c.exists && (isBad(c.mantleEnergy) || isBad(c.temperature) || isBad(c.storedEnergy) || isBad(c.prosperity))) nanHits2++;
        }
    }
}
check(nanHits2 === 0, `second instance (40x40, 120 ticks) stays finite (got ${nanHits2} bad cells)`);

const seededA = new SimulationEngine(16, 16, undefined, { seed: 'world-stability' });
const seededB = new SimulationEngine(16, 16, undefined, { seed: 'world-stability' });
const seededC = new SimulationEngine(16, 16, undefined, { seed: 'world-terrain-variant' });
check(seededA.noiseOffsetX === seededB.noiseOffsetX && seededA.noiseOffsetY === seededB.noiseOffsetY, 'seeded engines reproduce initial noise offsets');
check(seededA.grid[8][8].mantleEnergy === seededB.grid[8][8].mantleEnergy, 'seeded engines reproduce initial grid energy');
check(seededA.grid[8][8].terrainElevation === seededB.grid[8][8].terrainElevation, 'seeded engines reproduce initial terrain elevation');
check(terrainElevationDelta(seededA, seededC) > 1, 'different seeds produce visibly different initial terrain elevation');

const richTerrainEngine = new SimulationEngine(50, 50, undefined, { seed: 'rich-terrain' });
const richTerrain = terrainElevationStats(richTerrainEngine);
const richTerrainFeatures = richTerrainEngine.analyzeTerrainFeatures();
check(
    richTerrain.max - richTerrain.min > 0.55 &&
    richTerrain.lowlands >= 10 &&
    richTerrain.midlands >= 300 &&
    richTerrain.highlands >= 50,
    `initial terrain contains lowlands, midlands, and highlands (range ${(richTerrain.max - richTerrain.min).toFixed(2)}, low ${richTerrain.lowlands}, mid ${richTerrain.midlands}, high ${richTerrain.highlands})`
);
check(
    richTerrainFeatures.counts.highland >= 50 &&
    richTerrainFeatures.counts.lowland >= 10 &&
    richTerrainFeatures.counts.basin >= 20 &&
    richTerrainFeatures.counts.ridge >= 50 &&
    richTerrainFeatures.counts.valley >= 50 &&
    richTerrainFeatures.counts.pass >= 20,
    `terrain detectors identify varied landforms (${JSON.stringify(richTerrainFeatures.counts)})`
);

const geologicEngine = new SimulationEngine(24, 24, {
    ...DEFAULT_PARAMS,
    expansionThreshold: 9999,
    shrinkThreshold: -1,
    terrainGeologyRate: 0.01,
}, { seed: 'geologic-terrain' });
const geologicInitial = terrainElevationSnapshot(geologicEngine);
geologicEngine.update();
const oneStepGeologicDelta = terrainElevationDelta(geologicInitial, geologicEngine);
for (let i = 0; i < 99; i++) geologicEngine.update();
const hundredStepGeologicDelta = terrainElevationDelta(geologicInitial, geologicEngine);
check(oneStepGeologicDelta > 0 && oneStepGeologicDelta < 0.05, `terrain elevation evolves continuously but very slowly per step (delta ${oneStepGeologicDelta.toFixed(4)})`);
check(hundredStepGeologicDelta > oneStepGeologicDelta * 20, `slow terrain evolution accumulates over long spans (one ${oneStepGeologicDelta.toFixed(4)}, hundred ${hundredStepGeologicDelta.toFixed(4)})`);

const noShrinkEngine = new SimulationEngine(5, 5, {
    ...DEFAULT_PARAMS,
    mantleTimeScale: 0,
    expansionThreshold: 9999,
    shrinkThreshold: 9999,
    minRadius: 0,
    initialBioSpeciesCount: 0,
    initialHumanSpawn: false,
    initialAlphaDelaySteps: 999999,
}, { seed: 'no-land-shrink' });
for (let y = 0; y < noShrinkEngine.height; y++) {
    for (let x = 0; x < noShrinkEngine.width; x++) {
        const cell = noShrinkEngine.grid[y][x];
        cell.exists = true;
        cell.mantleEnergy = 0;
        cell.crystalState = CELL_TYPE.EMPTY;
        cell.prosperity = 0;
        cell.bioAttributes = undefined;
    }
}
for (let i = 0; i < 20; i++) noShrinkEngine.updateMantleLayer();
const noShrinkLand = noShrinkEngine.grid.flat().filter(cell => cell.exists).length;
check(noShrinkLand === 25, `low mantle energy no longer makes land cells disappear (${noShrinkLand}/25 remain)`);

const crystalTerrainEngine = new SimulationEngine(3, 1, {
    ...DEFAULT_PARAMS,
    alphaEnergyDemand: 0,
    betaEnergyDemand: 0,
    mantleAbsorption: 0.2,
    thunderstormEnergy: 0,
    maxCrystalEnergy: 999,
    crystalMantleAbsorptionThreshold: 0,
    crystalMantleLocalMargin: -999,
}, { seed: 'crystal-terrain-independent' });
for (let x = 0; x < crystalTerrainEngine.width; x++) {
    const cell = crystalTerrainEngine.grid[0][x];
    cell.exists = true;
    cell.mantleEnergy = 80;
    cell.crystalState = CELL_TYPE.EMPTY;
    cell.storedEnergy = 10;
    cell.hasThunderstorm = false;
}
crystalTerrainEngine.grid[0][0].crystalState = CELL_TYPE.ALPHA;
crystalTerrainEngine.grid[0][0].terrainElevation = 0.92;
crystalTerrainEngine.grid[0][2].crystalState = CELL_TYPE.ALPHA;
crystalTerrainEngine.grid[0][2].terrainElevation = 0.08;
crystalTerrainEngine.updateCrystalLayer();
const highlandCrystalEnergy = crystalTerrainEngine.grid[0][0].storedEnergy;
const lowlandCrystalEnergy = crystalTerrainEngine.grid[0][2].storedEnergy;
check(Math.abs(highlandCrystalEnergy - lowlandCrystalEnergy) < 1e-9, 'crystal mantle absorption is independent of terrain elevation');

const bioDiversityEngine = new SimulationEngine(50, 50, {
    ...DEFAULT_PARAMS,
    initialBioSpeciesCount: 8,
    initialBioCrystalTolerantRatio: 1,
}, { seed: 'initial-bio-diversity' });
const initialSpecies = new Set();
const initialReductions = [];
const initialSettlementSizes = [];
let initialBioCells = 0;
let initialBioNearFutureAlpha = 0;
for (let y = 0; y < bioDiversityEngine.height; y++) {
    for (let x = 0; x < bioDiversityEngine.width; x++) {
        const cell = bioDiversityEngine.grid[y][x];
        if (cell.crystalState !== CELL_TYPE.BIO || !cell.bioAttributes) continue;
        initialBioCells++;
        initialSpecies.add(cell.bioAttributes.speciesId);
        initialReductions.push(cell.bioAttributes.crystalDamageReduction ?? 0);
        initialSettlementSizes.push(cell.bioAttributes.settlementSize ?? 1);
        const futureAlphaRadius = bioDiversityEngine.params.initialAlphaRadius ?? 3;
        const distToCenter = Math.hypot(x - bioDiversityEngine.width / 2, y - bioDiversityEngine.height / 2);
        if (distToCenter >= futureAlphaRadius && distToCenter <= futureAlphaRadius + 1) {
            initialBioNearFutureAlpha++;
        }
    }
}
check(initialSpecies.size >= 6, `initial biosphere seeds varied species (${initialSpecies.size} species)`);
check(initialBioCells >= 12, `initial biosphere creates multi-cell settlement activity (${initialBioCells} cells)`);
check(Math.max(...initialSettlementSizes) > Math.min(...initialSettlementSizes), `initial settlement sizes vary (${Math.min(...initialSettlementSizes)}..${Math.max(...initialSettlementSizes)})`);
check(Math.max(...initialReductions) >= 0.45, `initial species include crystal-tolerant biology (max reduction ${Math.max(...initialReductions).toFixed(2)})`);
check(initialBioNearFutureAlpha > 0, `initial crystal-tolerant species reserve cells near the delayed Alpha seed (${initialBioNearFutureAlpha} cells)`);
check(!bioDiversityEngine.grid.flat().some(cell => cell.crystalState === CELL_TYPE.ALPHA), 'initial Alpha is delayed at construction time');
for (let t = 0; t < 120; t++) bioDiversityEngine.update();
let delayedBioNearAlpha = 0;
for (let y = 0; y < bioDiversityEngine.height; y++) {
    for (let x = 0; x < bioDiversityEngine.width; x++) {
        const cell = bioDiversityEngine.grid[y][x];
        if (cell.crystalState === CELL_TYPE.BIO &&
            bioDiversityEngine.getNeighbors(x, y).some(n => n.crystalState === CELL_TYPE.ALPHA)) {
            delayedBioNearAlpha++;
        }
    }
}
check(delayedBioNearAlpha > 0, `crystal-tolerant species remain active near Alpha after delayed seeding (${delayedBioNearAlpha} cells)`);

const reductionEngine = new SimulationEngine(5, 3, {
    ...DEFAULT_PARAMS,
    bioAutoSpawnCount: 0,
    initialBioSpeciesCount: 0,
    initialHumanSpawn: false,
    sameSpeciesBonus: 0,
    competitionPenalty: 0,
}, { seed: 'crystal-reduction' });
reductionEngine.isFirstSpawn = false;
for (let y = 0; y < reductionEngine.height; y++) {
    for (let x = 0; x < reductionEngine.width; x++) {
        const cell = reductionEngine.grid[y][x];
        cell.exists = true;
        cell.crystalState = CELL_TYPE.EMPTY;
        cell.temperature = 20;
        cell.prosperity = 0;
        cell.bioAttributes = undefined;
        cell.migrant = null;
    }
}
const lowReductionAttrs = {
    minTemp: 0,
    maxTemp: 40,
    survivalMinTemp: -100,
    survivalMaxTemp: 100,
    prosperityGrowth: 0,
    prosperityDecay: 0,
    expansionThreshold: 9999,
    miningReward: 0,
    migrationThreshold: 0,
    alphaRadiationDamage: 10,
    civilizationLevel: 0,
    crystalDamageReduction: 0,
    settlementSize: 1,
    speciesId: 21,
    color: '#aaa',
};
const highReductionAttrs = { ...lowReductionAttrs, crystalDamageReduction: 0.8, speciesId: 22 };
reductionEngine.grid[1][1].crystalState = CELL_TYPE.ALPHA;
reductionEngine.grid[1][1].storedEnergy = 30;
reductionEngine.grid[1][3].crystalState = CELL_TYPE.ALPHA;
reductionEngine.grid[1][3].storedEnergy = 30;
reductionEngine.grid[1][0].crystalState = CELL_TYPE.BIO;
reductionEngine.grid[1][0].prosperity = 100;
reductionEngine.grid[1][0].bioAttributes = lowReductionAttrs;
reductionEngine.grid[1][4].crystalState = CELL_TYPE.BIO;
reductionEngine.grid[1][4].prosperity = 100;
reductionEngine.grid[1][4].bioAttributes = highReductionAttrs;
reductionEngine.updateBioLayer();
check(
    reductionEngine.grid[1][4].prosperity - reductionEngine.grid[1][0].prosperity >= 3,
    `crystalDamageReduction lowers Alpha adjacency damage (low ${reductionEngine.grid[1][0].prosperity.toFixed(1)}, high ${reductionEngine.grid[1][4].prosperity.toFixed(1)})`
);

function createMiningEngine(seed) {
    const engine = new SimulationEngine(3, 3, {
        ...DEFAULT_PARAMS,
        bioAutoSpawnCount: 0,
        initialBioSpeciesCount: 0,
        initialHumanSpawn: false,
        initialAlphaDelaySteps: 999999,
        minProsperityGrowth: 0,
        sameSpeciesBonus: 0,
        competitionPenalty: 0,
        betaMiningMinRate: 0,
    }, { seed });
    engine.isFirstSpawn = false;
    for (let y = 0; y < engine.height; y++) {
        for (let x = 0; x < engine.width; x++) {
            const cell = engine.grid[y][x];
            cell.exists = true;
            cell.crystalState = CELL_TYPE.EMPTY;
            cell.temperature = 20;
            cell.prosperity = 0;
            cell.bioAttributes = undefined;
            cell.migrant = null;
            cell.betaMiningProgress = 0;
        }
    }
    return engine;
}

const miningAttrs = {
    minTemp: 0,
    maxTemp: 40,
    survivalMinTemp: -100,
    survivalMaxTemp: 100,
    prosperityGrowth: 0,
    prosperityDecay: 0,
    expansionThreshold: 9999,
    miningReward: 20,
    migrationThreshold: 0,
    alphaRadiationDamage: 0,
    civilizationLevel: 0.25,
    crystalDamageReduction: 0,
    settlementSize: 1,
    speciesId: 31,
    color: '#ddd',
};

const slowMiningEngine = createMiningEngine('slow-beta-mining');
slowMiningEngine.grid[1][0].crystalState = CELL_TYPE.BIO;
slowMiningEngine.grid[1][0].prosperity = 100;
slowMiningEngine.grid[1][0].bioAttributes = { ...miningAttrs };
slowMiningEngine.grid[1][1].crystalState = CELL_TYPE.BETA;
slowMiningEngine.updateBioLayer();
check(slowMiningEngine.grid[1][1].crystalState === CELL_TYPE.BETA, 'low-civilization mining does not finish a Beta crystal in one step');
check(slowMiningEngine.grid[1][0].betaMiningProgress > 0 && slowMiningEngine.grid[1][0].betaMiningProgress < 1, `low-civilization mining accumulates partial progress (${slowMiningEngine.grid[1][0].betaMiningProgress.toFixed(2)})`);

const fastMiningEngine = createMiningEngine('fast-beta-mining');
fastMiningEngine.grid[1][0].crystalState = CELL_TYPE.BIO;
fastMiningEngine.grid[1][0].prosperity = 100;
fastMiningEngine.grid[1][0].bioAttributes = { ...miningAttrs, civilizationLevel: 1, speciesId: 32 };
fastMiningEngine.grid[1][2].crystalState = CELL_TYPE.BIO;
fastMiningEngine.grid[1][2].prosperity = 100;
fastMiningEngine.grid[1][2].bioAttributes = { ...miningAttrs, civilizationLevel: 0.8, speciesId: 33 };
fastMiningEngine.grid[1][1].crystalState = CELL_TYPE.BETA;
fastMiningEngine.updateBioLayer();
check(fastMiningEngine.grid[1][1].crystalState === CELL_TYPE.EMPTY, 'high-civilization mining can finish at most one adjacent Beta crystal in one step');
check(fastMiningEngine.grid[1][0].bioAttributes.civilizationLevel === 0.5 && fastMiningEngine.grid[1][2].bioAttributes.civilizationLevel === 0.4, 'mining a Beta crystal halves civilization for BIO settlements in its +1 neighborhood');

// ---------------------------------------------------------------------------
// 2) 晶石灾害拓扑
// ---------------------------------------------------------------------------
console.log('\n[2] Crystal disaster topology\n');

function createBridgeDisasterEngine() {
    const e = new SimulationEngine(9, 7);

    for (let y = 0; y < e.height; y++) {
        for (let x = 0; x < e.width; x++) {
            const cell = e.grid[y][x];
            cell.exists = false;
            cell.mantleEnergy = 0;
            cell.mantleSourceStrength = 0;
            cell.crystalState = CELL_TYPE.EMPTY;
            cell.storedEnergy = 0;
            cell.crystalEnergy = 0;
            cell.isAbsorbing = false;
            cell.energyFlow = [];
            cell.humanEnergyDrain = 0;
            cell.isEnergySiphoned = false;
            cell.prosperity = 0;
            cell.bioAttributes = undefined;
            cell.migrant = null;
        }
    }

    const sourceCoords = [[1, 2], [2, 2], [1, 3], [2, 3]];
    const bridgeCoords = [[3, 3]];
    const basinCoords = [
        [4, 2], [5, 2], [6, 2],
        [4, 3], [5, 3], [6, 3],
        [4, 4], [5, 4], [6, 4],
    ];

    for (const [x, y] of [...sourceCoords, ...bridgeCoords, ...basinCoords]) {
        const cell = e.grid[y][x];
        cell.exists = true;
        cell.crystalState = CELL_TYPE.ALPHA;
        cell.storedEnergy = 34;
        cell.mantleEnergy = 25;
    }

    for (const [x, y] of sourceCoords) {
        const cell = e.grid[y][x];
        cell.mantleEnergy = 96;
        cell.crystalEnergy = 16;
        cell.isAbsorbing = true;
    }

    return e;
}

const disasterOptions = {
    activeEnergyThreshold: 20,
    sourceMantleThreshold: 999,
    minComponentCells: 10,
    minActiveCells: 6,
    minIsolatedActiveCells: 5,
};

const bridgeEngine = createBridgeDisasterEngine();
const bridgeAnalysis = bridgeEngine.analyzeCrystalDisaster(disasterOptions);
check(bridgeAnalysis.active, 'bridge-fed Alpha basin is detected as an active crystal disaster');
check(bridgeAnalysis.criticalCells.some(c => c.x === 3 && c.y === 3), 'narrow bridge Alpha is identified as a critical intervention point');
check(bridgeAnalysis.criticalSets.some(s => s.cells.length === 1 && s.cells[0].x === 3 && s.cells[0].y === 3), 'narrow bridge Alpha is identified as a single-cell critical set');
check(bridgeAnalysis.sourceSeals.length > 0, 'source well targets are exposed as sourceSeals');

const missEngine = createBridgeDisasterEngine();
const miss = missEngine.applyCrystalIntervention(5, 3, disasterOptions);
check(miss.changed, 'non-critical Alpha intervention still changes the target cell');
check(!miss.hitCritical, 'non-critical basin intervention is not reported as critical');
check(miss.after.active, 'non-critical basin intervention does not resolve the stable disaster');

const hitEngine = createBridgeDisasterEngine();
const hit = hitEngine.applyCrystalIntervention(3, 3, disasterOptions);
check(hit.changed, 'critical bridge intervention changes the target cell');
check(hit.hitCritical, 'critical bridge intervention is reported as critical');
check(hit.hitCriticalSet, 'critical bridge intervention is reported as hitting a critical set');
check(hit.resolved, 'critical bridge intervention breaks source reachability and resolves the disaster');

const siphonEngine = createBridgeDisasterEngine();
const siphonBase = siphonEngine.addHumanEnergyBase(1, 3, {
    radius: 2.5,
    drainRate: 34,
    efficiency: 1,
    capacity: 2000,
    maintenanceCost: 0,
    autoUpgrade: false,
});
check(!!siphonBase, 'human mantle-energy extractor can be placed on an existing cell');

let siphonResolved = false;
for (let t = 0; t < 24; t++) {
    siphonEngine.update();
    if (!siphonEngine.analyzeCrystalDisaster(disasterOptions).active) {
        siphonResolved = true;
        break;
    }
}
const siphonReport = siphonEngine.getHumanEnergyReport();
check(siphonReport.totalExtracted > 0, `human extractor siphoned mantle energy (total = ${siphonReport.totalExtracted.toFixed(1)})`);
check(siphonEngine.grid[3][1].isEnergySiphoned || siphonEngine.grid[3][1].humanEnergyDrain > 0, 'cells expose per-tick human energy siphon observability');
check(siphonResolved, 'sustained human energy extraction can starve the source-fed crystal disaster');

const ringFrontParams = {
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
    initialBioSpeciesCount: 0,
    initialHumanSpawn: false,
    humanRespawnDelay: 999999,
};
const ringFrontEngine = new SimulationEngine(50, 50, { ...DEFAULT_PARAMS, ...ringFrontParams }, { seed: 42 });
for (let t = 0; t < 820; t++) ringFrontEngine.update();
const ringFront = measureRadialCrystalPattern(ringFrontEngine);
check(ringFront.centerLand >= 100 && ringFront.centerBeta === ringFront.centerLand && ringFront.centerActive === 0, `ring-front reference leaves the island center dormant (${ringFront.centerBeta}/${ringFront.centerLand} center Beta, ${ringFront.centerActive} active)`);
check(ringFront.outerActive >= 300 && ringFront.outerAlpha >= ringFront.outerActive, `ring-front reference keeps an active outer crystal band (${ringFront.outerActive} active outer Alpha)`);
check(ringFront.totalAlpha >= 300 && ringFront.totalBeta >= 500, `ring-front reference has both active Alpha front and dormant Beta interior (${ringFront.totalAlpha} Alpha, ${ringFront.totalBeta} Beta)`);

const ringFrontKeyEngine = new SimulationEngine(50, 50, { ...DEFAULT_PARAMS, ...ringFrontParams }, { seed: 42 });
for (let t = 0; t < 820; t++) ringFrontKeyEngine.update();
const ringFrontKeySiphons = [
    { x: 41, y: 25 },
    { x: 33, y: 39 },
    { x: 17, y: 39 },
    { x: 9, y: 25 },
    { x: 17, y: 11 },
    { x: 33, y: 11 },
];
for (const [index, target] of ringFrontKeySiphons.entries()) {
    ringFrontKeyEngine.addHumanEnergyBase(target.x, target.y, { id: `test-ring-front-siphon-${index + 1}` });
}
for (let t = 0; t < 50; t++) ringFrontKeyEngine.update();
const ringFrontAfterKey50 = measureRadialCrystalPattern(ringFrontKeyEngine);
const ringFrontAnalysisAfterKey50 = ringFrontKeyEngine.analyzeCrystalDisaster({ ...disasterOptions, minIsolatedActiveCells: 4, maxSourceCellsPerComponent: 1 });
check(ringFrontAfterKey50.totalAlpha <= 10 && !ringFrontAnalysisAfterKey50.active, `ring-front six-point siphon key pattern resolves the disaster within 50 steps (${ringFrontAfterKey50.totalAlpha} Alpha left)`);
for (let t = 0; t < 50; t++) ringFrontKeyEngine.update();
const ringFrontAfterKey100 = measureRadialCrystalPattern(ringFrontKeyEngine);
check(ringFrontAfterKey100.totalAlpha <= 3, `ring-front six-point siphon key pattern leaves only residual Alpha within 100 steps (${ringFrontAfterKey100.totalAlpha} Alpha left)`);
for (let t = 0; t < 100; t++) ringFrontKeyEngine.update();
const ringFrontAfterKey200 = measureRadialCrystalPattern(ringFrontKeyEngine);
check(ringFrontAfterKey200.totalAlpha === 0, 'ring-front six-point siphon key pattern clears all Alpha within 200 steps');
for (let t = 0; t < 400; t++) ringFrontKeyEngine.update();
const ringFrontAfterKey600 = measureRadialCrystalPattern(ringFrontKeyEngine);
const ringFrontAnalysisAfterKey600 = ringFrontKeyEngine.analyzeCrystalDisaster({ ...disasterOptions, minIsolatedActiveCells: 4, maxSourceCellsPerComponent: 1 });
check(ringFrontAfterKey600.totalAlpha === 0 && !ringFrontAnalysisAfterKey600.active, 'ring-front six-point siphon key pattern remains resolved through the 600-step validation window');

const terrainPassEngine = new SimulationEngine(5, 5, {
    ...DEFAULT_PARAMS,
    bioAutoSpawnCount: 0,
    initialBioSpeciesCount: 0,
    initialHumanSpawn: false,
    humanRespawnDelay: 999999,
    terrainMigrationMaxStep: 0.36,
}, { seed: 'terrain-pass' });
terrainPassEngine.isFirstSpawn = false;
for (let y = 0; y < terrainPassEngine.height; y++) {
    for (let x = 0; x < terrainPassEngine.width; x++) {
        const cell = terrainPassEngine.grid[y][x];
        cell.exists = x >= 1 && x <= 3 && y >= 1 && y <= 3;
        cell.crystalState = CELL_TYPE.EMPTY;
        cell.temperature = 0;
        cell.terrainElevation = 0.8;
        cell.terrainSlope = 0;
        cell.terrainBasinDepth = 0;
        cell.terrainMoveCost = 1;
        cell.prosperity = 0;
        cell.bioAttributes = undefined;
        cell.migrant = null;
    }
}
const migrantAttrs = {
    minTemp: 20,
    maxTemp: 30,
    survivalMinTemp: -100,
    survivalMaxTemp: 100,
    prosperityGrowth: 1,
    prosperityDecay: 0.1,
    expansionThreshold: 9999,
    miningReward: 0,
    migrationThreshold: 0,
    alphaRadiationDamage: 0,
    civilizationLevel: 0,
    crystalDamageReduction: 0,
    settlementSize: 1,
    speciesId: 7,
    color: '#fff',
};
terrainPassEngine.grid[2][1].migrant = { prosperity: 40, attributes: migrantAttrs };
terrainPassEngine.grid[2][2].terrainElevation = 0.55;
terrainPassEngine.grid[2][2].temperature = 15;
terrainPassEngine.grid[1][2].terrainElevation = 0.2;
terrainPassEngine.grid[1][2].temperature = 25;
terrainPassEngine.grid[3][2].terrainElevation = 0.2;
terrainPassEngine.grid[3][2].temperature = 25;
terrainPassEngine.updateBioLayer();
check(!!terrainPassEngine.grid[2][2].migrant, 'migrant takes the only passable mid-slope corridor');
check(!terrainPassEngine.grid[1][2].migrant && !terrainPassEngine.grid[3][2].migrant, 'migrant does not cross blocked plateau-to-plain cliffs despite better temperature');

const terrainClimateEngine = new SimulationEngine(3, 1, {
    ...DEFAULT_PARAMS,
    bioAutoSpawnCount: 0,
    initialBioSpeciesCount: 0,
    initialHumanSpawn: false,
    diffusionRate: 0,
    terrainElevationCooling: 0,
    terrainMantleHeatDamping: 0.8,
}, { seed: 'terrain-climate' });
for (let x = 0; x < 3; x++) {
    const cell = terrainClimateEngine.grid[0][x];
    cell.exists = true;
    cell.mantleEnergy = 100;
    cell.temperature = -100;
    cell.terrainElevation = x === 0 ? 0.9 : x === 2 ? 0.1 : 0.5;
    cell.terrainSlope = 0;
    cell.terrainBasinDepth = 0;
}
terrainClimateEngine.updateClimateLayer();
const highElevationWarmup = terrainClimateEngine.grid[0][0].temperature + 100;
const lowElevationWarmup = terrainClimateEngine.grid[0][2].temperature + 100;
check(highElevationWarmup < lowElevationWarmup, 'high elevation weakens mantle heating under equal mantle energy');

// ---------------------------------------------------------------------------
// 3) 静态契约
// ---------------------------------------------------------------------------
console.log('\n[3] Static contracts\n');

const files = fs.readdirSync(path.join(repoRoot, SIM_DIR)).filter(f => f.endsWith('.js'));
check(files.length === 14, `14 module files present (got ${files.length}: ${files.join(', ')})`);

// 2a. <500 行
for (const f of files) {
    const lines = read(`${SIM_DIR}/${f}`).split('\n').length;
    check(lines < 500, `${f} under 500 lines (${lines})`);
}

// 2b. 各层导出组合对象 + 引擎导出类
check(/export const mantle_layer\s*=/.test(read(`${SIM_DIR}/mantle_layer.js`)), 'mantle_layer exported as composition object');
check(/export const climate_layer\s*=/.test(read(`${SIM_DIR}/climate_layer.js`)), 'climate_layer exported as composition object');
check(/export const crystal_layer\s*=/.test(read(`${SIM_DIR}/crystal_layer.js`)), 'crystal_layer exported as composition object');
check(/export const crystal_disaster\s*=/.test(read(`${SIM_DIR}/crystal_disaster.js`)), 'crystal_disaster exported as composition object');
check(/export const human_energy\s*=/.test(read(`${SIM_DIR}/human_energy.js`)), 'human_energy exported as composition object');
check(/export function generateInitialTerrainElevation/.test(read(`${SIM_DIR}/terrain_generator.js`)), 'terrain_generator exports initial terrain generator');
check(/export const terrain_detectors\s*=/.test(read(`${SIM_DIR}/terrain_detectors.js`)), 'terrain_detectors exported as composition object');
check(/export const bio_layer\s*=/.test(read(`${SIM_DIR}/bio_layer.js`)), 'bio_layer exported as composition object');
check(/export const bio_spawn\s*=/.test(read(`${SIM_DIR}/bio_spawn.js`)), 'bio_spawn exported as composition object');
check(/export function createSeededRandom/.test(read(`${SIM_DIR}/rng.js`)), 'rng exports createSeededRandom');
check(/export class SimulationEngine/.test(read(`${SIM_DIR}/engine.js`)), 'engine exports SimulationEngine class');
check(/val\.bind\(this\)/.test(read(`${SIM_DIR}/engine.js`)), 'engine wires layers via bind(this) composition');

// 2c. 长函数带 @section 标记
const mantleSrc = read(`${SIM_DIR}/mantle_layer.js`);
check(/@section:mantle_supply_points/.test(mantleSrc) && /@section:mantle_energy_field/.test(mantleSrc) && /@section:mantle_terrain_change/.test(mantleSrc), 'mantle_layer carries @section markers');
const bioSrc = read(`${SIM_DIR}/bio_layer.js`);
check(/@section:bio_census/.test(bioSrc) && /@section:bio_settlement/.test(bioSrc) && /@section:bio_migrant/.test(bioSrc) && /@section:bio_apply_changes/.test(bioSrc), 'bio_layer carries @section markers');

// 2d. 不残留裸字符串晶石状态（应统一 CELL_TYPE.*）。cell.js 定义枚举本身除外。
for (const f of files.filter(f => f !== 'cell.js')) {
    const src = read(`${SIM_DIR}/${f}`);
    const leaked = /['"](ALPHA|BETA|BIO|EMPTY)['"]/.test(src);
    check(!leaked, `${f} uses CELL_TYPE.* (no bare crystal-state string literals)`);
}

// ---------------------------------------------------------------------------
console.log('\n===================================================');
console.log(`  Result: ${passed} passed, ${failed} failed`);
console.log('===================================================');
if (failed > 0) {
    console.log('\nFailures:');
    for (const m of failures) console.log(`  - ${m}`);
    process.exit(1);
}
process.exit(0);
