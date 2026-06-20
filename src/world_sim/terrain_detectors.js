// 世界变迁模拟器 - 地形识别检测器
// 纯读分析层：识别高原、低地、山脊、盆地、谷地和山口，不反写 grid。

function terrainContext(engine, x, y) {
    const cell = engine.grid[y]?.[x];
    if (!cell || !cell.exists) return null;

    const neighbors = engine.getNeighbors(x, y);
    if (neighbors.length === 0) {
        return {
            x, y, cell, elevation: cell.terrainElevation ?? 0,
            avgElevation: cell.terrainElevation ?? 0,
            maxStep: 0, basinDepth: 0, ridgeLift: 0,
            higherNeighbors: 0, lowerNeighbors: 0,
        };
    }

    const elevation = cell.terrainElevation ?? 0;
    let maxStep = 0;
    let elevationSum = 0;
    let higherNeighbors = 0;
    let lowerNeighbors = 0;
    for (const n of neighbors) {
        const nElevation = n.terrainElevation ?? 0;
        maxStep = Math.max(maxStep, Math.abs(nElevation - elevation));
        elevationSum += nElevation;
        if (nElevation > elevation + 0.08) higherNeighbors++;
        if (nElevation < elevation - 0.08) lowerNeighbors++;
    }

    const avgElevation = elevationSum / neighbors.length;
    return {
        x, y, cell, elevation, avgElevation, maxStep,
        basinDepth: Math.max(0, avgElevation - elevation),
        ridgeLift: Math.max(0, elevation - avgElevation),
        higherNeighbors, lowerNeighbors,
    };
}

export function isTerrainHighland(ctx) {
    return !!ctx && ctx.elevation >= 0.68 && ctx.avgElevation >= 0.56;
}

export function isTerrainLowland(ctx) {
    return !!ctx && ctx.elevation <= 0.32;
}

export function isTerrainBasin(ctx) {
    return !!ctx && ctx.basinDepth >= 0.1 && ctx.elevation <= 0.58 && ctx.higherNeighbors >= 3;
}

export function isTerrainRidge(ctx) {
    return !!ctx && ctx.elevation >= 0.58 && ctx.ridgeLift >= 0.08 && ctx.maxStep >= 0.12;
}

export function isTerrainValley(ctx) {
    return !!ctx && ctx.elevation <= 0.48 && ctx.basinDepth >= 0.06 && ctx.maxStep >= 0.1;
}

export function isTerrainPass(ctx) {
    return !!ctx &&
        ctx.elevation >= 0.36 && ctx.elevation <= 0.66 &&
        ctx.maxStep >= 0.1 && ctx.maxStep <= 0.36 &&
        ctx.higherNeighbors >= 2 && ctx.lowerNeighbors >= 2;
}

export function detectTerrainTypes(engine, x, y) {
    const ctx = terrainContext(engine, x, y);
    if (!ctx) return [];

    const types = [];
    if (isTerrainHighland(ctx)) types.push('highland');
    if (isTerrainLowland(ctx)) types.push('lowland');
    if (isTerrainBasin(ctx)) types.push('basin');
    if (isTerrainRidge(ctx)) types.push('ridge');
    if (isTerrainValley(ctx)) types.push('valley');
    if (isTerrainPass(ctx)) types.push('pass');
    if (types.length === 0) types.push('plain');
    return types;
}

/** @type {{analyzeTerrainFeatures: (this: import('./engine.js').SimulationEngine, options?: {sampleLimit?: number}) => object}} */
export const terrain_detectors = {
    analyzeTerrainFeatures(options = {}) {
        const sampleLimit = options.sampleLimit ?? 20;
        const counts = {
            land: 0, highland: 0, lowland: 0, basin: 0,
            ridge: 0, valley: 0, pass: 0, plain: 0,
        };
        const samples = {
            highland: [], lowland: [], basin: [],
            ridge: [], valley: [], pass: [], plain: [],
        };

        for (let y = 0; y < this.height; y++) {
            for (let x = 0; x < this.width; x++) {
                const cell = this.grid[y][x];
                if (!cell.exists) continue;

                counts.land++;
                const types = detectTerrainTypes(this, x, y);
                for (const type of types) {
                    counts[type]++;
                    if (samples[type].length < sampleLimit) {
                        samples[type].push({ x, y, elevation: cell.terrainElevation ?? 0 });
                    }
                }
            }
        }

        return { counts, samples };
    },
};
