// World Sim - Human mantle-energy extractor subsystem.
// Pure data layer: human bases compete with Alpha crystals for the same local
// mantle energy, but do not occupy a cell or depend on rendering/gameplay code.

function distance(a, b, x, y) {
    return Math.sqrt((a - x) ** 2 + (b - y) ** 2);
}

function optionValue(base, params, key, fallback) {
    return base[key] ?? params[key] ?? fallback;
}

function effectiveRadius(base, params) {
    const radius = optionValue(base, params, 'radius', params.humanExtractorRadius ?? 4);
    const bonus = params.humanExtractorLevelRadiusBonus ?? 0;
    return radius + Math.max(0, (base.level ?? 1) - 1) * bonus;
}

function effectiveDrainRate(base, params) {
    const drainRate = optionValue(base, params, 'drainRate', params.humanExtractorDrainRate ?? 2);
    const multiplier = params.humanExtractorLevelDrainMultiplier ?? 0;
    return drainRate * (1 + Math.max(0, (base.level ?? 1) - 1) * multiplier);
}

function storageRoom(base) {
    return Math.max(0, (base.capacity ?? Infinity) - (base.storedEnergy ?? 0));
}

/**
 * @type {{
 *   addHumanEnergyBase: (this: import('./engine.js').SimulationEngine, x:number, y:number, options?: Object) => Object|null,
 *   beginHumanEnergyTick: (this: import('./engine.js').SimulationEngine) => void,
 *   applyHumanEnergyExtraction: (this: import('./engine.js').SimulationEngine, x:number, y:number, mantleEnergy:number) => number,
 *   updateHumanEnergyBases: (this: import('./engine.js').SimulationEngine) => void,
 *   getHumanEnergyReport: (this: import('./engine.js').SimulationEngine) => Object,
 * }}
 */
export const human_energy = {
    /**
     * Add a human extractor base/pylon. The base is data-only and can be placed
     * by gameplay later; in the simulation it acts as a local mantle-energy sink.
     * @param {number} x
     * @param {number} y
     * @param {Object} [options]
     * @returns {Object|null}
     */
    addHumanEnergyBase(x, y, options = {}) {
        const cell = this.grid[y]?.[x];
        if (!cell || !cell.exists) return null;
        if (!Array.isArray(this.humanEnergyBases)) this.humanEnergyBases = [];

        const params = this.params;
        const base = {
            id: options.id ?? `human-extractor-${this.humanEnergyBases.length + 1}`,
            x,
            y,
            active: options.active !== false,
            level: options.level ?? 1,
            radius: options.radius ?? params.humanExtractorRadius,
            drainRate: options.drainRate ?? params.humanExtractorDrainRate,
            efficiency: options.efficiency ?? params.humanExtractorEfficiency,
            capacity: options.capacity ?? params.humanExtractorCapacity,
            storedEnergy: options.storedEnergy ?? 0,
            maintenanceCost: options.maintenanceCost ?? params.humanExtractorMaintenanceCost,
            autoUpgrade: options.autoUpgrade ?? params.humanExtractorAutoUpgrade,
            upgradeThreshold: options.upgradeThreshold ?? params.humanExtractorUpgradeThreshold,
            maxLevel: options.maxLevel ?? params.humanExtractorMaxLevel,
            extractedThisTick: 0,
            cellsTouchedThisTick: 0,
            totalExtracted: 0,
        };

        this.humanEnergyBases.push(base);
        return base;
    },

    beginHumanEnergyTick() {
        if (!Array.isArray(this.humanEnergyBases)) this.humanEnergyBases = [];
        if (this.humanEnergyBases.length === 0) return;

        for (const base of this.humanEnergyBases) {
            base.extractedThisTick = 0;
            base.cellsTouchedThisTick = 0;
        }

        for (let y = 0; y < this.height; y++) {
            for (let x = 0; x < this.width; x++) {
                const cell = this.grid[y][x];
                cell.humanEnergyDrain = 0;
                cell.isEnergySiphoned = false;
            }
        }
    },

    /**
     * Drain mantle energy before Alpha crystals can absorb it.
     * @param {number} x
     * @param {number} y
     * @param {number} mantleEnergy
     * @returns {number}
     */
    applyHumanEnergyExtraction(x, y, mantleEnergy) {
        if (!Array.isArray(this.humanEnergyBases) || this.humanEnergyBases.length === 0) {
            return mantleEnergy;
        }

        const params = this.params;
        const floor = params.humanExtractorMantleFloor ?? 0;
        const falloffPower = params.humanExtractorFalloffPower ?? 1.35;
        let currentEnergy = mantleEnergy;
        let drainedTotal = 0;

        for (const base of this.humanEnergyBases) {
            if (!base.active) continue;
            const radius = effectiveRadius(base, params);
            const dist = distance(base.x, base.y, x, y);
            if (dist > radius || currentEnergy <= floor) continue;

            const remainingStorage = storageRoom(base);
            if (remainingStorage <= 0) continue;

            const efficiency = Math.max(0.01, optionValue(base, params, 'efficiency', 0.75));
            const falloff = Math.max(0, 1 - dist / (radius + 1));
            const requestedDrain = effectiveDrainRate(base, params) * (falloff ** falloffPower);
            const availableDrain = Math.max(0, currentEnergy - floor);
            const storageLimitedDrain = remainingStorage / efficiency;
            const actualDrain = Math.min(requestedDrain, availableDrain, storageLimitedDrain);
            if (actualDrain <= 0) continue;

            currentEnergy -= actualDrain;
            base.storedEnergy += actualDrain * efficiency;
            base.extractedThisTick += actualDrain;
            base.totalExtracted += actualDrain;
            base.cellsTouchedThisTick++;
            drainedTotal += actualDrain;
        }

        const cell = this.grid[y]?.[x];
        if (cell && drainedTotal > 0) {
            cell.humanEnergyDrain = drainedTotal;
            cell.isEnergySiphoned = true;
        }

        return currentEnergy;
    },

    updateHumanEnergyBases() {
        if (!Array.isArray(this.humanEnergyBases) || this.humanEnergyBases.length === 0) return;

        const params = this.params;
        for (const base of this.humanEnergyBases) {
            if (!base.active) continue;

            const maintenanceCost = optionValue(base, params, 'maintenanceCost', 0);
            base.storedEnergy = Math.max(0, base.storedEnergy - maintenanceCost * (base.level ?? 1));

            const autoUpgrade = optionValue(base, params, 'autoUpgrade', false);
            const maxLevel = optionValue(base, params, 'maxLevel', 1);
            const upgradeThreshold = optionValue(base, params, 'upgradeThreshold', Infinity);
            while (autoUpgrade && base.level < maxLevel && base.storedEnergy >= upgradeThreshold) {
                base.storedEnergy -= upgradeThreshold;
                base.level++;
            }
        }
    },

    getHumanEnergyReport() {
        const bases = Array.isArray(this.humanEnergyBases) ? this.humanEnergyBases : [];
        return {
            baseCount: bases.length,
            totalStoredEnergy: bases.reduce((sum, base) => sum + (base.storedEnergy ?? 0), 0),
            totalExtracted: bases.reduce((sum, base) => sum + (base.totalExtracted ?? 0), 0),
            extractedThisTick: bases.reduce((sum, base) => sum + (base.extractedThisTick ?? 0), 0),
            bases: bases.map(base => ({
                id: base.id,
                x: base.x,
                y: base.y,
                active: base.active,
                level: base.level,
                radius: effectiveRadius(base, this.params),
                drainRate: effectiveDrainRate(base, this.params),
                storedEnergy: base.storedEnergy,
                extractedThisTick: base.extractedThisTick,
                totalExtracted: base.totalExtracted,
            })),
        };
    },
};
