// 世界变迁模拟器 - 晶石灾害拓扑分析
// 纯数据辅助层：从当前 Alpha 晶石网络中识别「供能源 → 稳定活跃区 → 关键阻断点」。
// 该模块不依赖渲染/UI，不主动推进模拟；调用方可按需 poll 分析结果。

import { CELL_TYPE } from './cell.js';

const DEFAULT_DISASTER_OPTIONS = {
    activeEnergyThreshold: 18,
    sourceMantleThreshold: 120,
    sourceEnergyThreshold: 12,
    minComponentCells: 8,
    minActiveCells: 5,
    minSourceCells: 1,
    minIsolatedActiveCells: 3,
    maxCriticalCells: 8,
    maxCriticalSets: 6,
    maxCutSetSize: 3,
    maxCutSetCandidateCells: 18,
    maxSourceCellsPerComponent: 4,
    interventionMode: 'block',
};

function keyOf(x, y) {
    return `${x},${y}`;
}

function cellKey(cell) {
    return keyOf(cell.x, cell.y);
}

function readOptions(options) {
    return { ...DEFAULT_DISASTER_OPTIONS, ...options };
}

function isAlphaCell(cell) {
    return cell.exists && cell.crystalState === CELL_TYPE.ALPHA;
}

function isActiveAlpha(cell, options) {
    return isAlphaCell(cell) && cell.storedEnergy >= options.activeEnergyThreshold;
}

function isSourceAlpha(cell, options) {
    return isAlphaCell(cell) && (
        cell.mantleEnergy >= options.sourceMantleThreshold ||
        (cell.mantleSourceStrength ?? 0) > 0 ||
        cell.crystalEnergy >= options.sourceEnergyThreshold ||
        cell.isAbsorbing
    );
}

function sourceStrength(cell, options) {
    if (!isAlphaCell(cell)) return 0;
    let strength = 0;
    if (cell.mantleEnergy >= options.sourceMantleThreshold) {
        strength += cell.mantleEnergy - options.sourceMantleThreshold;
    }
    if ((cell.mantleSourceStrength ?? 0) > 0) {
        strength += cell.mantleSourceStrength;
    }
    if (cell.crystalEnergy >= options.sourceEnergyThreshold) {
        strength += cell.crystalEnergy;
    }
    if (cell.isAbsorbing) {
        strength += Math.max(cell.crystalEnergy, 1);
    }
    return strength;
}

function collectAlphaComponents(engine) {
    const visited = new Set();
    const components = [];

    for (let y = 0; y < engine.height; y++) {
        for (let x = 0; x < engine.width; x++) {
            const start = engine.grid[y][x];
            if (!isAlphaCell(start) || visited.has(cellKey(start))) continue;

            const queue = [start];
            const cells = [];
            visited.add(cellKey(start));

            while (queue.length > 0) {
                const cell = queue.shift();
                cells.push(cell);

                for (const neighbor of engine.getNeighbors(cell.x, cell.y)) {
                    const nKey = cellKey(neighbor);
                    if (!visited.has(nKey) && isAlphaCell(neighbor)) {
                        visited.add(nKey);
                        queue.push(neighbor);
                    }
                }
            }

            components.push(cells);
        }
    }

    return components;
}

function floodFromSources(engine, componentKeys, sourceKeys, removedKeys) {
    const reachable = new Set();
    const queue = [];
    const removed = removedKeys instanceof Set ? removedKeys : new Set(removedKeys ? [removedKeys] : []);

    for (const sourceKey of sourceKeys) {
        if (removed.has(sourceKey) || !componentKeys.has(sourceKey)) continue;
        const [x, y] = sourceKey.split(',').map(Number);
        const source = engine.grid[y]?.[x];
        if (!source || !isAlphaCell(source)) continue;
        reachable.add(sourceKey);
        queue.push(source);
    }

    while (queue.length > 0) {
        const cell = queue.shift();
        for (const neighbor of engine.getNeighbors(cell.x, cell.y)) {
            const nKey = cellKey(neighbor);
            if (removed.has(nKey) || reachable.has(nKey) || !componentKeys.has(nKey)) continue;
            if (!isAlphaCell(neighbor)) continue;
            reachable.add(nKey);
            queue.push(neighbor);
        }
    }

    return reachable;
}

function scoreCutSet(cells, isolatedActiveCells, isolatedEnergy, sourceKeys) {
    const sourceHits = cells.filter(cell => sourceKeys.has(cellKey(cell))).length;
    return isolatedActiveCells * 10 + isolatedEnergy - cells.length * 3 + sourceHits * 20;
}

function evaluateCutSet(engine, component, componentKeys, sourceKeys, activeKeys, cells, options) {
    const removedKeys = new Set(cells.map(cellKey));
    const reachable = floodFromSources(engine, componentKeys, sourceKeys, removedKeys);
    let isolatedActiveCells = 0;
    let isolatedEnergy = 0;

    for (const cell of component) {
        const cKey = cellKey(cell);
        if (removedKeys.has(cKey) || reachable.has(cKey) || !activeKeys.has(cKey)) continue;
        isolatedActiveCells++;
        isolatedEnergy += cell.storedEnergy;
    }

    if (isolatedActiveCells < options.minIsolatedActiveCells) return null;

    return {
        cells: cells.map(cell => ({ x: cell.x, y: cell.y })),
        size: cells.length,
        isolatedActiveCells,
        isolatedEnergy,
        sourceHits: cells.filter(cell => sourceKeys.has(cellKey(cell))).length,
        score: scoreCutSet(cells, isolatedActiveCells, isolatedEnergy, sourceKeys),
    };
}

function findCriticalCuts(engine, component, sourceKeys, activeKeys, options) {
    const componentKeys = new Set(component.map(cellKey));
    const cuts = [];

    for (const candidate of component) {
        const candidateKey = cellKey(candidate);
        const result = evaluateCutSet(engine, component, componentKeys, sourceKeys, activeKeys, [candidate], options);
        if (result) {
            cuts.push({
                x: candidate.x,
                y: candidate.y,
                isolatedActiveCells: result.isolatedActiveCells,
                isolatedEnergy: result.isolatedEnergy,
                score: result.score,
            });
        }
    }

    cuts.sort((a, b) => b.score - a.score);
    return cuts.slice(0, options.maxCriticalCells);
}

function buildCutSetCandidatePool(component, sourceCells, activeKeys, singleCuts, options) {
    const byKey = new Map();
    const add = (cell) => {
        if (cell) byKey.set(cellKey(cell), cell);
    };
    const byCellKey = new Map(component.map(cell => [cellKey(cell), cell]));

    for (const cell of sourceCells) add(cell);
    for (const cut of singleCuts) add(byCellKey.get(keyOf(cut.x, cut.y)));

    const sorted = [...component].sort((a, b) => {
        const aActive = activeKeys.has(cellKey(a)) ? 1 : 0;
        const bActive = activeKeys.has(cellKey(b)) ? 1 : 0;
        return (bActive - aActive) || (b.storedEnergy - a.storedEnergy);
    });
    for (const cell of sorted) {
        add(cell);
        if (byKey.size >= options.maxCutSetCandidateCells) break;
    }

    return Array.from(byKey.values());
}

function combinations(cells, size, start = 0, prefix = [], out = []) {
    if (prefix.length === size) {
        out.push([...prefix]);
        return out;
    }
    for (let i = start; i <= cells.length - (size - prefix.length); i++) {
        prefix.push(cells[i]);
        combinations(cells, size, i + 1, prefix, out);
        prefix.pop();
    }
    return out;
}

function findCriticalCutSets(engine, component, sourceCells, sourceKeys, activeKeys, singleCuts, options) {
    const componentKeys = new Set(component.map(cellKey));
    const candidatePool = buildCutSetCandidatePool(component, sourceCells, activeKeys, singleCuts, options);
    const sets = [];
    const seen = new Set();

    for (let size = 1; size <= options.maxCutSetSize; size++) {
        for (const combo of combinations(candidatePool, size)) {
            const key = combo.map(cellKey).sort().join('|');
            if (seen.has(key)) continue;
            seen.add(key);
            const result = evaluateCutSet(engine, component, componentKeys, sourceKeys, activeKeys, combo, options);
            if (result) {
                sets.push({ ...result, key });
            }
        }
    }

    sets.sort((a, b) => (a.size - b.size) || (b.score - a.score));
    return sets.slice(0, options.maxCriticalSets);
}

function summarizeComponent(engine, component, options) {
    const sourceCells = component
        .filter(cell => isSourceAlpha(cell, options))
        .sort((a, b) => sourceStrength(b, options) - sourceStrength(a, options))
        .slice(0, options.maxSourceCellsPerComponent);
    const activeCells = component.filter(cell => isActiveAlpha(cell, options));
    const sourceKeys = new Set(sourceCells.map(cellKey));
    const activeKeys = new Set(activeCells.map(cellKey));
    const totalEnergy = component.reduce((sum, cell) => sum + cell.storedEnergy, 0);
    const avgEnergy = component.length > 0 ? totalEnergy / component.length : 0;
    const criticalCuts = findCriticalCuts(engine, component, sourceKeys, activeKeys, options);
    const criticalSets = findCriticalCutSets(engine, component, sourceCells, sourceKeys, activeKeys, criticalCuts, options);
    const sourceSeals = sourceCells.map(cell => ({
        x: cell.x,
        y: cell.y,
        strength: sourceStrength(cell, options),
    }));
    const activeRatio = component.length > 0 ? activeCells.length / component.length : 0;
    const stabilityScore = sourceCells.length * 0.35 + activeRatio * 0.45 + Math.min(avgEnergy / 50, 1) * 0.2;

    return {
        id: component.map(cellKey).sort().join('|'),
        cells: component.length,
        activeCells: activeCells.length,
        sourceCells: sourceCells.length,
        totalEnergy,
        avgEnergy,
        stabilityScore,
        bounds: {
            minX: Math.min(...component.map(cell => cell.x)),
            maxX: Math.max(...component.map(cell => cell.x)),
            minY: Math.min(...component.map(cell => cell.y)),
            maxY: Math.max(...component.map(cell => cell.y)),
        },
        criticalCuts,
        criticalSets,
        sourceSeals,
        isDisaster: component.length >= options.minComponentCells &&
            activeCells.length >= options.minActiveCells &&
            sourceCells.length >= options.minSourceCells &&
            criticalSets.length > 0,
    };
}

/**
 * @type {{
 *   analyzeCrystalDisaster: (this: import('./engine.js').SimulationEngine, options?: Object) => Object,
 *   applyCrystalInterventions: (this: import('./engine.js').SimulationEngine, cells: {x:number,y:number}[], options?: Object) => Object,
 *   applyCrystalIntervention: (this: import('./engine.js').SimulationEngine, x: number, y: number, options?: Object) => Object,
 * }}
 */
export const crystal_disaster = {
    /**
     * 分析当前 Alpha 晶石网络中是否存在稳定活跃灾害区，以及能切断供能的关键阻断点。
     * @param {Object} [options]
     * @returns {{active:boolean, components:Object[], disasters:Object[], criticalCells:Object[], criticalSets:Object[], sourceSeals:Object[], stats:Object}}
     */
    analyzeCrystalDisaster(options = {}) {
        const opts = readOptions(options);
        const components = collectAlphaComponents(this).map(component => summarizeComponent(this, component, opts));
        const disasters = components.filter(component => component.isDisaster);
        const criticalMap = new Map();
        const criticalSetMap = new Map();
        const sourceSealMap = new Map();

        for (const disaster of disasters) {
            for (const cut of disaster.criticalCuts) {
                const key = keyOf(cut.x, cut.y);
                const existing = criticalMap.get(key);
                if (!existing || cut.score > existing.score) {
                    criticalMap.set(key, { ...cut, componentId: disaster.id });
                }
            }
            for (const cutSet of disaster.criticalSets) {
                const key = cutSet.key;
                const existing = criticalSetMap.get(key);
                if (!existing || cutSet.score > existing.score) {
                    criticalSetMap.set(key, { ...cutSet, componentId: disaster.id });
                }
            }
            for (const seal of disaster.sourceSeals) {
                const key = keyOf(seal.x, seal.y);
                const existing = sourceSealMap.get(key);
                if (!existing || seal.strength > existing.strength) {
                    sourceSealMap.set(key, { ...seal, componentId: disaster.id });
                }
            }
        }

        const criticalCells = Array.from(criticalMap.values()).sort((a, b) => b.score - a.score);
        const criticalSets = Array.from(criticalSetMap.values()).sort((a, b) => (a.size - b.size) || (b.score - a.score));
        const sourceSeals = Array.from(sourceSealMap.values()).sort((a, b) => b.strength - a.strength);
        const alphaCells = components.reduce((sum, component) => sum + component.cells, 0);

        return {
            active: disasters.length > 0,
            components,
            disasters,
            criticalCells,
            criticalSets,
            sourceSeals,
            stats: {
                alphaCells,
                componentCount: components.length,
                disasterCount: disasters.length,
            },
        };
    },

    /**
     * 对一组晶石格执行干预，用于最小割集或源井封印。
     * @param {{x:number,y:number}[]} cells
     * @param {Object} [options]
     * @returns {{changed:number, hitCritical:boolean, hitCriticalSet:boolean, hitSourceSeal:boolean, resolved:boolean, before:Object, after:Object, targets:Object[]}}
     */
    applyCrystalInterventions(cells, options = {}) {
        const opts = readOptions(options);
        const before = this.analyzeCrystalDisaster(opts);
        const targetKeys = new Set(cells.map(cell => keyOf(cell.x, cell.y)));
        const targets = [];
        let changed = 0;

        for (const targetCell of cells) {
            const cell = this.grid[targetCell.y]?.[targetCell.x] || null;
            targets.push(cell ? { x: targetCell.x, y: targetCell.y, previousState: cell.crystalState } : { ...targetCell, previousState: null });

            if (cell && isAlphaCell(cell)) {
                cell.crystalState = opts.interventionMode === 'erase' ? CELL_TYPE.EMPTY : CELL_TYPE.BETA;
                cell.storedEnergy = 0;
                cell.crystalEnergy = 0;
                cell.isAbsorbing = false;
                cell.energyFlow = [];
                changed++;
            }
        }

        const after = this.analyzeCrystalDisaster(opts);
        const hitCritical = before.criticalCells.some(cut => targetKeys.has(keyOf(cut.x, cut.y)));
        const hitCriticalSet = before.criticalSets.some(set =>
            set.cells.every(cell => targetKeys.has(keyOf(cell.x, cell.y)))
        );
        const hitSourceSeal = before.sourceSeals.some(seal => targetKeys.has(keyOf(seal.x, seal.y)));

        return {
            changed,
            hitCritical,
            hitCriticalSet,
            hitSourceSeal,
            resolved: before.active && !after.active,
            before,
            after,
            targets,
        };
    },

    /**
     * 对一个晶石格执行干预。默认模式将 Alpha 转为 Beta，使其成为惰性阻断物，避免下一帧立刻被重新扩张填补。
     * @param {number} x
     * @param {number} y
     * @param {Object} [options]
     * @returns {{changed:boolean, hitCritical:boolean, resolved:boolean, before:Object, after:Object, target:Object|null}}
     */
    applyCrystalIntervention(x, y, options = {}) {
        const result = this.applyCrystalInterventions([{ x, y }], options);

        return {
            changed: result.changed > 0,
            hitCritical: result.hitCritical,
            hitCriticalSet: result.hitCriticalSet,
            hitSourceSeal: result.hitSourceSeal,
            resolved: result.resolved,
            before: result.before,
            after: result.after,
            target: result.targets[0],
        };
    },
};
