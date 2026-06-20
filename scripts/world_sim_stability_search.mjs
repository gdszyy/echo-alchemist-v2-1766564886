#!/usr/bin/env node
/**
 * 世界迁移模型 - 晶石灾害稳定性研究脚本。
 *
 * 用法示例：
 *   node scripts/world_sim_stability_search.mjs --scenario ring-front --generations 0 --population 2 --ticks 800 --warmup 200 --seeds 42
 *   node scripts/world_sim_stability_search.mjs --scenario bridge --generations 4 --population 10
 *   node scripts/world_sim_stability_search.mjs --scenario natural --generations 3 --population 8
 */

import { SimulationEngine } from '../src/world_sim/engine.js';
import { DEFAULT_PARAMS } from '../src/world_sim/params.js';
import { CELL_TYPE } from '../src/world_sim/cell.js';
import { createSeededRandom } from '../src/world_sim/rng.js';

const GENE_SPACE = {
    mantleTimeScale: [0.002, 0.08],
    expansionThreshold: [90, 220],
    shrinkThreshold: [0, 30],
    mantleEnergyLevel: [80, 190],
    maxRadius: [12, 28],
    alphaEnergyDemand: [0.02, 6.5],
    mantleAbsorption: [0.06, 0.8],
    crystalMantleAbsorptionThreshold: [35, 115],
    crystalMantleLocalMargin: [-5, 35],
    expansionCost: [7.5, 100],
    maxCrystalEnergy: [42, 180],
    energySharingRate: [0.65, 5],
    energySharingLimit: [0.6, 8],
    energyDecayRate: [0, 0.18],
    thunderstormEnergy: [0, 60],
    edgeGenerationEnergy: [0, 34],
    edgeSupplyPointSpeed: [0, 0.09],
    humanExtractorRadius: [2, 14],
    humanExtractorDrainRate: [1, 1800],
    humanExtractorEfficiency: [0.55, 1],
    humanExtractorCapacity: [100, 2000000],
    humanExtractorMaintenanceCost: [0, 5000],
    humanExtractorMantleFloor: [0, 20],
};

const DEFAULT_RUN = {
    scenario: 'ring-front',
    generations: 5,
    population: 12,
    elite: 3,
    seeds: ['42'],
    width: 50,
    height: 50,
    ticks: 920,
    warmup: 320,
    sampleInterval: 10,
    minStableTicks: 600,
    maxInterventions: 6,
    resolveHorizon: 800,
    minMeanActiveCells: 50,
    targetMeanActiveCells: 600,
    maxMeanActiveCells: 1200,
    resolutionMode: 'siphon',
};

const DISASTER_OPTIONS = {
    activeEnergyThreshold: 20,
    sourceMantleThreshold: 999,
    sourceEnergyThreshold: 10,
    minComponentCells: 9,
    minActiveCells: 6,
    minSourceCells: 1,
    minIsolatedActiveCells: 4,
    maxSourceCellsPerComponent: 1,
};

const REFERENCE_CANDIDATES = [
    {
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
    },
];

function parseArgs(argv) {
    const opts = { ...DEFAULT_RUN };
    for (let i = 0; i < argv.length; i++) {
        const arg = argv[i];
        if (!arg.startsWith('--')) continue;
        const key = arg.slice(2);
        const value = argv[i + 1];
        i++;
        if (['generations', 'population', 'elite', 'ticks', 'warmup', 'sampleInterval', 'width', 'height', 'maxInterventions', 'resolveHorizon', 'minStableTicks', 'minMeanActiveCells', 'targetMeanActiveCells', 'maxMeanActiveCells'].includes(key)) {
            opts[key] = Number(value);
        } else if (key === 'seeds') {
            opts.seeds = value.split(',').map(s => s.trim()).filter(Boolean);
        } else {
            opts[key] = value;
        }
    }
    return opts;
}

function clamp(v, min, max) {
    return Math.max(min, Math.min(max, v));
}

function mean(values) {
    return values.length ? values.reduce((sum, v) => sum + v, 0) / values.length : 0;
}

function getStableWindowTicks(opts) {
    return Math.max(0, opts.ticks - opts.warmup);
}

function coefficientBoundedness(values) {
    if (values.length < 2) return values.length === 1 ? 1 : 0;
    const avg = mean(values);
    const variance = mean(values.map(v => (v - avg) ** 2));
    const cv = Math.sqrt(variance) / (Math.abs(avg) + 1e-6);
    return 1 / (1 + cv);
}

function bandScore(value, min, target, max) {
    if (value < min) return clamp(value / Math.max(1, min), 0, 1);
    if (value <= target) return 1;
    if (value >= max) return 0;
    return clamp(1 - (value - target) / Math.max(1, max - target), 0, 1);
}

function randomCandidate(random) {
    const candidate = {};
    for (const [key, [min, max]] of Object.entries(GENE_SPACE)) {
        candidate[key] = min + random() * (max - min);
    }
    return candidate;
}

function completeCandidate(candidate) {
    const full = { ...candidate };
    for (const key of Object.keys(GENE_SPACE)) {
        full[key] = candidate[key] ?? DEFAULT_PARAMS[key];
    }
    return full;
}

function mutateCandidate(candidate, random, strength = 0.18) {
    const child = completeCandidate(candidate);
    for (const [key, [min, max]] of Object.entries(GENE_SPACE)) {
        if (random() > 0.65) continue;
        const span = max - min;
        child[key] = clamp(child[key] + (random() * 2 - 1) * span * strength, min, max);
    }
    return child;
}

function crossover(a, b, random) {
    const child = {};
    const fullA = completeCandidate(a);
    const fullB = completeCandidate(b);
    for (const key of Object.keys(GENE_SPACE)) {
        child[key] = random() < 0.5 ? fullA[key] : fullB[key];
    }
    return child;
}

function resetCell(cell) {
    cell.exists = false;
    cell.mantleEnergy = 0;
    cell.mantleSourceStrength = 0;
    cell.temperature = 0;
    cell.baseTemperature = 0;
    cell.temperatureChange = 0;
    cell.hasThunderstorm = false;
    cell.crystalState = CELL_TYPE.EMPTY;
    cell.crystalEnergy = 0;
    cell.storedEnergy = 0;
    cell.isAbsorbing = false;
    cell.energyFlow = [];
    cell.humanEnergyDrain = 0;
    cell.isEnergySiphoned = false;
    cell.prosperity = 0;
    cell.isMining = false;
    cell.bioAttributes = undefined;
    cell.migrant = null;
}

function applyBridgeScenario(engine) {
    engine.initialAlphaSeeded = true;
    for (let y = 0; y < engine.height; y++) {
        for (let x = 0; x < engine.width; x++) resetCell(engine.grid[y][x]);
    }

    const offsetX = Math.floor(engine.width / 2) - 4;
    const offsetY = Math.floor(engine.height / 2) - 3;
    const sourceCoords = [[1, 3]];
    const stemCoords = [[2, 3]];
    const bridgeCoords = [[3, 3]];
    const basinCoords = [
        [4, 2], [5, 2], [6, 2],
        [4, 3], [5, 3], [6, 3],
        [4, 4], [5, 4], [6, 4],
    ];
    const allCrystalCoords = [...sourceCoords, ...stemCoords, ...bridgeCoords, ...basinCoords];

    for (const [x0, y0] of allCrystalCoords) {
        for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
                const cell = engine.grid[offsetY + y0 + dy]?.[offsetX + x0 + dx];
                if (cell) {
                    cell.exists = true;
                    cell.mantleEnergy = 22;
                }
            }
        }
    }

    for (const [x0, y0] of allCrystalCoords) {
        const cell = engine.grid[offsetY + y0][offsetX + x0];
        cell.crystalState = CELL_TYPE.ALPHA;
        cell.storedEnergy = 34;
        cell.mantleEnergy = 25;
    }

    for (const [x0, y0] of sourceCoords) {
        const cell = engine.grid[offsetY + y0][offsetX + x0];
        cell.mantleEnergy = 98;
        cell.crystalEnergy = 16;
        cell.isAbsorbing = true;
    }
}

function createEngine(candidate, seed, opts) {
    const params = { ...DEFAULT_PARAMS, ...completeCandidate(candidate) };
    const engine = new SimulationEngine(opts.width, opts.height, params, { seed });
    if (opts.scenario === 'bridge') applyBridgeScenario(engine);
    return engine;
}

function crystalStats(engine, analysis) {
    let alphaCells = 0;
    let activeCells = 0;
    let totalEnergy = 0;

    for (const component of analysis.components) {
        alphaCells += component.cells;
        activeCells += component.activeCells;
        totalEnergy += component.totalEnergy;
    }

    return {
        alphaCells,
        activeCells,
        avgEnergy: alphaCells > 0 ? totalEnergy / alphaCells : 0,
    };
}

function addUniqueTargets(targets, targetKeys, candidates, limit) {
    for (const candidate of candidates) {
        if (!candidate || targets.length >= limit) break;
        const key = `${candidate.x},${candidate.y}`;
        if (targetKeys.has(key)) continue;
        targets.push({ x: candidate.x, y: candidate.y });
        targetKeys.add(key);
    }
}

function selectInterventionTargets(analysis, limit) {
    const targets = [];
    const targetKeys = new Set();
    addUniqueTargets(targets, targetKeys, analysis.sourceSeals, limit);
    addUniqueTargets(targets, targetKeys, analysis.criticalSets.flatMap(set => set.cells), limit);
    addUniqueTargets(targets, targetKeys, analysis.criticalCells, limit);
    return targets;
}

function applySiphonInterventions(engine, analysis, opts) {
    const targets = selectInterventionTargets(analysis, opts.maxInterventions);
    let placed = 0;
    for (const target of targets) {
        const base = engine.addHumanEnergyBase(target.x, target.y, {
            id: `siphon-${placed + 1}`,
        });
        if (base) placed++;
    }
    return placed;
}

function applyBlockInterventions(engine, opts) {
    let interventionCount = 0;
    while (interventionCount < opts.maxInterventions) {
        const current = engine.analyzeCrystalDisaster(DISASTER_OPTIONS);
        if (!current.active) break;

        const targets = selectInterventionTargets(current, opts.maxInterventions - interventionCount);
        if (targets.length === 0) break;

        engine.applyCrystalInterventions(targets, DISASTER_OPTIONS);
        interventionCount += targets.length;
    }
    return interventionCount;
}

function evaluateRun(candidate, seed, opts) {
    const engine = createEngine(candidate, seed, opts);
    const samples = [];
    const criticalCounts = new Map();

    for (let t = 0; t < opts.ticks; t++) {
        engine.update();
        if (t < opts.warmup || t % opts.sampleInterval !== 0) continue;

        const analysis = engine.analyzeCrystalDisaster(DISASTER_OPTIONS);
        const stats = crystalStats(engine, analysis);
        samples.push({ analysis, stats });

        const sampleCriticalKeys = new Set();
        for (const set of analysis.criticalSets) {
            for (const cell of set.cells) {
                sampleCriticalKeys.add(`${cell.x},${cell.y}`);
            }
        }
        for (const cell of analysis.criticalCells) {
            sampleCriticalKeys.add(`${cell.x},${cell.y}`);
        }
        for (const key of sampleCriticalKeys) {
            criticalCounts.set(key, (criticalCounts.get(key) || 0) + 1);
        }
    }

    const sampleCount = samples.length || 1;
    const activeRatio = samples.filter(s => s.analysis.active).length / sampleCount;
    const alphaSeries = samples.map(s => s.stats.alphaCells);
    const activeSeries = samples.map(s => s.stats.activeCells);
    const energySeries = samples.map(s => s.stats.avgEnergy);
    const boundedness = mean([
        coefficientBoundedness(alphaSeries),
        coefficientBoundedness(activeSeries),
        coefficientBoundedness(energySeries),
    ]);
    const meanActive = mean(activeSeries);
    const sizeScore = bandScore(
        meanActive,
        opts.minMeanActiveCells,
        opts.targetMeanActiveCells,
        opts.maxMeanActiveCells,
    );
    const stableCriticalCells = Array.from(criticalCounts.entries())
        .map(([key, count]) => ({ key, persistence: count / sampleCount }))
        .filter(item => item.persistence >= 0.35)
        .sort((a, b) => b.persistence - a.persistence);
    const criticalPersistence = stableCriticalCells[0]?.persistence || 0;

    const finalAnalysis = engine.analyzeCrystalDisaster(DISASTER_OPTIONS);
    let resolveScore = 0;
    let interventionCount = 0;
    if (finalAnalysis.active) {
        if (opts.resolutionMode === 'siphon') {
            interventionCount = applySiphonInterventions(engine, finalAnalysis, opts);
        } else {
            interventionCount = applyBlockInterventions(engine, opts);
        }
        for (let i = 0; i < opts.resolveHorizon; i++) {
            engine.update();
        }
        const afterIntervention = engine.analyzeCrystalDisaster(DISASTER_OPTIONS);
        resolveScore = finalAnalysis.active && !afterIntervention.active ? 1 : 0;
    }

    const livingWindow = clamp(activeRatio / 0.5, 0, 1);
    const stableWindowTicks = getStableWindowTicks(opts);
    const requiredStableTicks = Math.max(1, opts.minStableTicks || 1);
    const stableWindowScore = clamp(stableWindowTicks / requiredStableTicks, 0, 1);
    const rawScore =
        activeRatio * 0.24 +
        criticalPersistence * 0.22 +
        boundedness * 0.16 * livingWindow +
        sizeScore * 0.18 * livingWindow +
        resolveScore * 0.20;
    const score = rawScore * (0.25 + stableWindowScore * 0.75) * (0.45 + resolveScore * 0.55);

    const isStable =
        stableWindowTicks >= requiredStableTicks &&
        activeRatio >= 0.72 &&
        criticalPersistence >= 0.55 &&
        boundedness >= 0.55 &&
        meanActive >= opts.minMeanActiveCells &&
        meanActive <= opts.maxMeanActiveCells &&
        resolveScore === 1;

    return {
        score,
        isStable,
        stableWindowTicks,
        activeRatio,
        criticalPersistence,
        boundedness,
        meanActive,
        resolveScore,
        interventionCount,
        stableCriticalCells,
    };
}
function evaluateCandidate(candidate, opts) {
    const runs = opts.seeds.map(seed => evaluateRun(candidate, seed, opts));
    return {
        candidate,
        score: mean(runs.map(run => run.score)),
        stableRate: runs.filter(run => run.isStable).length / runs.length,
        activeRatio: mean(runs.map(run => run.activeRatio)),
        criticalPersistence: mean(runs.map(run => run.criticalPersistence)),
        boundedness: mean(runs.map(run => run.boundedness)),
        meanActive: mean(runs.map(run => run.meanActive)),
        resolveRate: mean(runs.map(run => run.resolveScore)),
        interventionCount: mean(runs.map(run => run.interventionCount)),
        stableWindowTicks: Math.min(...runs.map(run => run.stableWindowTicks)),
        criticalCells: runs.flatMap(run => run.stableCriticalCells),
    };
}
function formatCandidate(candidate) {
    return Object.fromEntries(Object.entries(completeCandidate(candidate)).map(([key, value]) => [
        key,
        typeof value === 'number' ? Number(value.toFixed(4)) : value,
    ]));
}
function summarizeTop(results, count = 5) {
    const top = results.slice(0, count);
    return top.map((result, index) => ({
        rank: index + 1,
        score: Number(result.score.toFixed(4)),
        stableRate: Number(result.stableRate.toFixed(2)),
        activeRatio: Number(result.activeRatio.toFixed(2)),
        criticalPersistence: Number(result.criticalPersistence.toFixed(2)),
        boundedness: Number(result.boundedness.toFixed(2)),
        meanActive: Number(result.meanActive.toFixed(1)),
        resolveRate: Number(result.resolveRate.toFixed(2)),
        interventionCount: Number(result.interventionCount.toFixed(1)),
        stableWindowTicks: result.stableWindowTicks,
        candidate: formatCandidate(result.candidate),
    }));
}
function runSearch(opts) {
    const random = createSeededRandom(`ga-${opts.scenario}-${opts.generations}-${opts.population}`);
    let population = [
        {},
        ...REFERENCE_CANDIDATES,
        ...Array.from({ length: Math.max(0, opts.population - 1 - REFERENCE_CANDIDATES.length) }, () => randomCandidate(random)),
    ];
    let ranked = [];

    for (let gen = 0; gen < opts.generations; gen++) {
        ranked = population.map(candidate => evaluateCandidate(candidate, opts))
            .sort((a, b) => b.score - a.score);

        const best = ranked[0];
        console.log(`gen=${gen + 1}/${opts.generations} score=${best.score.toFixed(4)} stableRate=${best.stableRate.toFixed(2)} active=${best.activeRatio.toFixed(2)} critical=${best.criticalPersistence.toFixed(2)} bounded=${best.boundedness.toFixed(2)} resolve=${best.resolveRate.toFixed(2)}`);

        const elites = ranked.slice(0, opts.elite).map(result => result.candidate);
        const next = [...elites];
        while (next.length < opts.population) {
            const a = elites[Math.floor(random() * elites.length)];
            const matingPoolSize = Math.min(ranked.length, Math.max(opts.elite + 2, Math.floor(ranked.length / 2)));
            const b = ranked[Math.floor(random() * matingPoolSize)]?.candidate || a;
            next.push(mutateCandidate(crossover(a, b, random), random));
        }
        population = next;
    }

    ranked = population.map(candidate => evaluateCandidate(candidate, opts))
        .sort((a, b) => b.score - a.score);

    return ranked;
}
const opts = parseArgs(process.argv.slice(2));
const results = runSearch(opts);
console.log('\nTop candidates:');
console.log(JSON.stringify(summarizeTop(results, 5), null, 2));

const best = results[0];
console.log('\nBest stable critical cells observed:');
console.log(JSON.stringify(best.criticalCells.slice(0, 12), null, 2));
