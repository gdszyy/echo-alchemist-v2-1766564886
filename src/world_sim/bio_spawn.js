// 世界变迁模拟器 - 生物投放（Bio Spawn）
// 移植自 world-morphing-simulator/client/src/lib/simulation/engine.ts spawnBio() / spawnHuman() / spawnRandomSpecies()
// 负责人类（speciesId=0）与随机新物种的初始投放选址与属性生成。由 bio_layer 在普查后调用。
// 方法在 SimulationEngine 构造时 bind 到实例，故 this === 引擎实例。

import { CELL_TYPE } from './cell.js';

function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

function randomRange(engine, min, max) {
    return min + engine.random() * (max - min);
}

function randomInt(engine, min, max) {
    return Math.floor(randomRange(engine, min, max + 1));
}

function hasAlphaWithin(engine, x, y, distance) {
    for (let dy = -distance; dy <= distance; dy++) {
        for (let dx = -distance; dx <= distance; dx++) {
            const nx = x + dx;
            const ny = y + dy;
            if (nx < 0 || nx >= engine.width || ny < 0 || ny >= engine.height) continue;
            if (engine.grid[ny][nx].crystalState === CELL_TYPE.ALPHA) return true;
        }
    }
    return false;
}

function hasFutureInitialAlphaWithin(engine, x, y, distance) {
    if (engine.initialAlphaSeeded) return false;
    const radius = engine.params.initialAlphaRadius ?? 3;
    const dist = Math.hypot(x - engine.width / 2, y - engine.height / 2);
    return dist >= radius && dist <= radius + Math.max(1, distance);
}

function isFutureInitialAlphaFootprint(engine, x, y) {
    if (engine.initialAlphaSeeded) return false;
    const radius = engine.params.initialAlphaRadius ?? 3;
    return Math.hypot(x - engine.width / 2, y - engine.height / 2) < radius;
}

function scoreTemperature(engine, cell) {
    const temp = Number.isFinite(cell.temperature) ? cell.temperature : 0;
    const min = engine.params.humanMinTemp ?? 7;
    const max = engine.params.humanMaxTemp ?? 34;
    const survivalMin = engine.params.humanSurvivalMinTemp ?? -50;
    const survivalMax = engine.params.humanSurvivalMaxTemp ?? 50;
    if (temp < survivalMin || temp > survivalMax) return null;

    if (temp >= min && temp <= max) {
        const mid = (min + max) / 2;
        const halfRange = Math.max(1, (max - min) / 2);
        return 0.75 + (1 - Math.abs(temp - mid) / halfRange) * 0.25;
    }

    const distance = temp < min ? min - temp : temp - max;
    const buffer = temp < min ? min - survivalMin : survivalMax - max;
    return Math.max(0, 1 - distance / Math.max(1, buffer)) * 0.7;
}

function collectHumanRespawnContext(engine, x, y) {
    const crystalRadius = Math.max(1, Math.floor(engine.params.humanRespawnCrystalRadius ?? 4));
    const tribeRadius = Math.max(1, Math.floor(engine.params.humanRespawnTribeRadius ?? 6));
    let crystalRisk = 0;
    let humanSupport = 0;

    const radius = Math.max(crystalRadius, tribeRadius);
    for (let dy = -radius; dy <= radius; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
            const nx = x + dx;
            const ny = y + dy;
            if (nx < 0 || nx >= engine.width || ny < 0 || ny >= engine.height) continue;
            const distance = Math.hypot(dx, dy);
            if (distance > radius) continue;
            const cell = engine.grid[ny][nx];
            if (!cell.exists) continue;

            if (distance <= crystalRadius) {
                const falloff = 1 - distance / (crystalRadius + 1);
                if (cell.crystalState === CELL_TYPE.ALPHA) crystalRisk += 1.4 * falloff;
                if (cell.crystalState === CELL_TYPE.BETA) crystalRisk += 0.35 * falloff;
            }

            if (distance > 0 && distance <= tribeRadius &&
                cell.crystalState === CELL_TYPE.BIO &&
                cell.bioAttributes?.speciesId === 0) {
                const falloff = 1 - distance / (tribeRadius + 1);
                humanSupport += Math.min(2, (cell.prosperity ?? 0) / 100) * falloff;
            }
        }
    }

    return { crystalRisk, humanSupport };
}

function scoreHumanRespawnCandidate(engine, cell) {
    if (!cell.exists || cell.crystalState !== CELL_TYPE.EMPTY) return null;
    if (isFutureInitialAlphaFootprint(engine, cell.x, cell.y)) return null;

    const temperatureScore = scoreTemperature(engine, cell);
    if (temperatureScore === null) return null;

    const { crystalRisk, humanSupport } = collectHumanRespawnContext(engine, cell.x, cell.y);
    const windSpeed = Math.hypot(cell.windX ?? 0, cell.windY ?? 0);
    const stormPenalty = cell.hasThunderstorm ? 0.45 : 0;
    const windPenalty = Math.min(0.25, windSpeed / Math.max(1, engine.params.windMaxSpeed ?? 1.6) * 0.25);
    const verticalPenalty = Math.min(0.2, Math.abs(cell.verticalMotion ?? 0) / 80);
    const weatherScore = Math.max(0, temperatureScore - stormPenalty - windPenalty - verticalPenalty);
    const crystalScore = 1 / (1 + crystalRisk);
    const tribeScore = Math.min(1, humanSupport / Math.max(1, engine.params.humanRespawnTribeSupportCap ?? 3));
    const terrainScore = 1 / (1 + Math.max(0, cell.terrainMoveCost ?? 1) * 0.08 + Math.max(0, cell.terrainSlope ?? 0) * 0.4);

    return {
        x: cell.x,
        y: cell.y,
        score:
            weatherScore * (engine.params.humanRespawnWeatherWeight ?? 55) +
            crystalScore * (engine.params.humanRespawnCrystalWeight ?? 45) +
            tribeScore * (engine.params.humanRespawnTribeWeight ?? 28) +
            terrainScore * (engine.params.humanRespawnTerrainWeight ?? 8),
        weatherScore,
        crystalScore,
        tribeScore,
        terrainScore,
        temperature: cell.temperature,
        crystalRisk,
        humanSupport,
    };
}

function collectEmptyLandCandidates(engine, options = {}) {
    const safeDistance = options.safeDistance ?? 3;
    const preferNearAlpha = options.preferNearAlpha ?? false;
    const candidates = [];
    const nearAlpha = [];

    for (let y = 0; y < engine.height; y++) {
        for (let x = 0; x < engine.width; x++) {
            const cell = engine.grid[y][x];
            if (!cell.exists || cell.crystalState !== CELL_TYPE.EMPTY) continue;
            if (isFutureInitialAlphaFootprint(engine, x, y)) continue;

            const alphaNearby = hasAlphaWithin(engine, x, y, Math.max(1, safeDistance)) ||
                hasFutureInitialAlphaWithin(engine, x, y, Math.max(1, safeDistance));
            if (safeDistance > 0 && alphaNearby && !preferNearAlpha) continue;

            candidates.push(cell);
            if (alphaNearby) nearAlpha.push(cell);
        }
    }

    return preferNearAlpha && nearAlpha.length > 0 ? nearAlpha : candidates;
}

function resolveCrystalDamageReduction(engine, civilizationLevel, explicitValue, fallback = 0) {
    const byCivilization = civilizationLevel * (engine.params.civilizationCrystalDamageReductionScale ?? 0.45);
    return clamp(explicitValue ?? Math.max(fallback, byCivilization), 0, 0.95);
}

function placeBioCluster(engine, target, attrs, prosperity, settlementSize, options = {}) {
    const placed = [];
    const queue = [target];
    const seen = new Set([`${target.x},${target.y}`]);
    const allowTargetOverride = options.allowTargetOverride ?? false;

    while (queue.length > 0 && placed.length < settlementSize) {
        const cell = queue.shift();
        const canUse = cell.exists && (cell.crystalState === CELL_TYPE.EMPTY || (allowTargetOverride && cell === target));
        if (canUse) {
            cell.crystalState = CELL_TYPE.BIO;
            cell.prosperity = prosperity * randomRange(engine, 0.75, 1.15);
            cell.storedEnergy = 0;
            cell.crystalEnergy = 0;
            cell.isAbsorbing = false;
            cell.isMining = false;
            cell.betaMiningProgress = 0;
            cell.bioAttributes = { ...attrs, settlementSize };
            placed.push(cell);
        }

        const neighbors = engine.getNeighbors(cell.x, cell.y)
            .filter(n => n.exists && n.crystalState === CELL_TYPE.EMPTY && !isFutureInitialAlphaFootprint(engine, n.x, n.y))
            .sort(() => engine.random() - 0.5);
        for (const n of neighbors) {
            const key = `${n.x},${n.y}`;
            if (!seen.has(key)) {
                seen.add(key);
                queue.push(n);
            }
        }
    }

    return placed.length;
}

/**
 * @type {{
 *   seedInitialBiosphere: (this: import('./engine.js').SimulationEngine) => void,
 *   updateHumanRespawnPoint: (this: import('./engine.js').SimulationEngine) => Object|null,
 *   spawnBio: (this: import('./engine.js').SimulationEngine, prosperity: number, options?: Object) => boolean,
 *   spawnHuman: (this: import('./engine.js').SimulationEngine, prosperity: number, options?: Object) => boolean,
 *   spawnRandomSpecies: (this: import('./engine.js').SimulationEngine, options?: Object) => boolean,
 * }}
 */
export const bio_spawn = {
    /**
     * Recompute the best current human respawn point from climate, crystal risk,
     * nearby human settlements, and traversability. params.humanSpawnPoint stays
     * as an explicit fixed override and is never mutated here.
     * @returns {Object|null}
     */
    updateHumanRespawnPoint() {
        if (this.params.initialHumanSpawn === false) {
            this.humanRespawnPoint = null;
            return null;
        }

        let best = null;
        for (let y = 0; y < this.height; y++) {
            for (let x = 0; x < this.width; x++) {
                const candidate = scoreHumanRespawnCandidate(this, this.grid[y][x]);
                if (!candidate) continue;
                if (!best || candidate.score > best.score) best = candidate;
            }
        }

        this.humanRespawnPoint = best;
        return best;
    },

    /**
     * 构造期初始生物圈：直接在已有陆地上投放多物种、多规模聚落。
     */
    seedInitialBiosphere() {
        const speciesCount = Math.max(0, Math.floor(this.params.initialBioSpeciesCount ?? 0));
        for (let i = 0; i < speciesCount; i++) {
            const tolerant = this.random() < (this.params.initialBioCrystalTolerantRatio ?? 0.35);
            this.spawnRandomSpecies({
                safeDistance: tolerant ? 0 : (this.params.initialBioAlphaSafeDistance ?? 3),
                preferNearAlpha: tolerant,
                prosperity: randomRange(
                    this,
                    this.params.initialBioMinProsperity ?? 45,
                    this.params.initialBioMaxProsperity ?? 120
                ),
                settlementSize: randomInt(
                    this,
                    this.params.initialBioMinSettlementSize ?? 1,
                    this.params.initialBioMaxSettlementSize ?? 5
                ),
                civilizationLevel: tolerant ? randomRange(this, 0.18, 0.55) : randomRange(this, 0, 0.28),
                crystalDamageReduction: tolerant
                    ? randomRange(
                        this,
                        this.params.crystalTolerantDamageReductionMin ?? 0.45,
                        this.params.crystalTolerantDamageReductionMax ?? 0.9
                    )
                    : undefined,
                wideTemperatureTolerance: tolerant,
            });
        }

        if (this.params.initialHumanSpawn !== false) {
            const spawnedHuman = this.spawnHuman(
                randomRange(
                    this,
                    this.params.humanInitialMinProsperity ?? 70,
                    this.params.humanInitialMaxProsperity ?? 140
                ),
                {
                    ignoreTemperature: true,
                    settlementSize: randomInt(
                        this,
                        this.params.humanInitialMinSettlementSize ?? 2,
                        this.params.humanInitialMaxSettlementSize ?? 5
                    ),
                }
            );
            if (spawnedHuman) this.isFirstSpawn = false;
        } else {
            this.isFirstSpawn = false;
        }
    },

    /**
     * 投放人类聚落（speciesId=0）。优先用 humanSpawnPoint 强制点（可覆盖原物体），
     * 否则在宜居温度的空地中随机选址。
     * @param {number} prosperity 初始繁荣度
     * @param {Object} [options]
     * @returns {boolean} 是否成功投放
     */
    spawnBio(prosperity, options = {}) {
        const humanSpawnPoint = this.params.humanSpawnPoint ?? this.humanRespawnPoint;
        const isForcedSpawnPoint = !!this.params.humanSpawnPoint;
        let targetX = -1;
        let targetY = -1;

        if (humanSpawnPoint) {
            targetX = humanSpawnPoint.x;
            targetY = humanSpawnPoint.y;
        } else {
            // 寻找宜居空地
            const candidates = [];
            for (let y = 0; y < this.height; y++) {
                for (let x = 0; x < this.width; x++) {
                    const cell = this.grid[y][x];
                    if (cell.exists && cell.crystalState === CELL_TYPE.EMPTY) {
                        if (isFutureInitialAlphaFootprint(this, x, y)) continue;
                        const temp = cell.temperature;
                        if (options.ignoreTemperature || (temp >= this.params.humanMinTemp && temp <= this.params.humanMaxTemp)) {
                            candidates.push(cell);
                        }
                    }
                }
            }

            if (candidates.length > 0) {
                const target = candidates[Math.floor(this.random() * candidates.length)];
                targetX = target.x;
                targetY = target.y;
            }
        }

        // 指定生成点可强制覆盖；随机选址点必须为 EMPTY
        let canSpawn = false;
        if (isForcedSpawnPoint && humanSpawnPoint && targetX === humanSpawnPoint.x && targetY === humanSpawnPoint.y) {
            canSpawn = true;
        } else if (targetX !== -1 && this.grid[targetY][targetX].crystalState === CELL_TYPE.EMPTY) {
            canSpawn = true;
        }

        if (canSpawn && targetX !== -1) {
            const cell = this.grid[targetY][targetX];
            // 强制覆盖：清除原有状态
            cell.crystalState = CELL_TYPE.BIO;
            cell.prosperity = prosperity;
            cell.storedEnergy = 0; // 清除可能存在的晶石能量
            cell.isMining = false;
            cell.betaMiningProgress = 0;

            const civilizationLevel = clamp(
                options.civilizationLevel ?? this.params.humanCivilizationLevel ?? 0.55,
                0,
                1
            );
            const attrs = {
                minTemp: this.params.humanMinTemp,
                maxTemp: this.params.humanMaxTemp,
                survivalMinTemp: this.params.humanSurvivalMinTemp,
                survivalMaxTemp: this.params.humanSurvivalMaxTemp,
                prosperityGrowth: this.params.humanProsperityGrowth,
                prosperityDecay: this.params.humanProsperityDecay,
                expansionThreshold: this.params.humanExpansionThreshold,
                miningReward: this.params.humanMiningReward,
                migrationThreshold: this.params.humanMigrationThreshold,
                alphaRadiationDamage: this.params.alphaRadiationDamage,
                civilizationLevel,
                crystalDamageReduction: resolveCrystalDamageReduction(
                    this,
                    civilizationLevel,
                    options.crystalDamageReduction ?? this.params.humanCrystalDamageReduction,
                    this.params.humanCrystalDamageReduction ?? 0.4
                ),
                settlementSize: options.settlementSize ?? 1,
                speciesId: 0, // 0 代表人类
                color: '#FFA500', // 橙色
            };
            cell.bioAttributes = attrs;
            placeBioCluster(this, cell, attrs, prosperity, options.settlementSize ?? 1, {
                allowTargetOverride: true,
            });
            return true;
        }
        return false;
    },

    /**
     * 重生/投放人类，当前等价于 spawnBio。
     * @param {number} prosperity 初始繁荣度
     * @param {Object} [options]
     * @returns {boolean} 是否成功投放
     */
    spawnHuman(prosperity, options = {}) {
        return this.spawnBio(prosperity, options);
    },

    /**
     * 投放随机新物种：在远离 Alpha 晶石（曼哈顿外接 3 格内无 Alpha）的空地随机选址，
     * 以人类参数为基线做 ±50% 量级的属性变异，speciesId 取 1..100000 避免与人类冲突。
     * @param {Object} [options]
     * @returns {boolean} 是否成功投放
     */
    spawnRandomSpecies(options = {}) {
        const candidates = collectEmptyLandCandidates(this, {
            safeDistance: options.safeDistance ?? 3,
            preferNearAlpha: options.preferNearAlpha ?? false,
        });

        if (candidates.length > 0) {
            const target = candidates[Math.floor(this.random() * candidates.length)];

            const speciesId = Math.floor(this.random() * 100000) + 1; // +1 避免与人类(0)冲突
            const color = `hsl(${this.random() * 360}, 70%, 50%)`;

            // 以人类参数为基线
            const baseAttrs = {
                minTemp: this.params.humanMinTemp,
                maxTemp: this.params.humanMaxTemp,
                survivalMinTemp: this.params.humanSurvivalMinTemp,
                survivalMaxTemp: this.params.humanSurvivalMaxTemp,
                prosperityGrowth: this.params.humanProsperityGrowth,
                prosperityDecay: this.params.humanProsperityDecay,
                expansionThreshold: this.params.humanExpansionThreshold,
                miningReward: this.params.humanMiningReward,
                migrationThreshold: this.params.humanMigrationThreshold,
                alphaRadiationDamage: this.params.alphaRadiationDamage,
            };

            // 随机波动 ×(0.5 ~ 1.5)
            const randomize = (val) => val * (0.5 + this.random());
            const civilizationLevel = clamp(options.civilizationLevel ?? this.random(), 0, 1);
            const reduction = resolveCrystalDamageReduction(
                this,
                civilizationLevel,
                options.crystalDamageReduction ?? randomRange(
                    this,
                    this.params.randomSpeciesMinCrystalDamageReduction ?? 0,
                    this.params.randomSpeciesMaxCrystalDamageReduction ?? 0.75
                )
            );
            const settlementSize = Math.max(1, Math.floor(options.settlementSize ?? 1));

            const attrs = {
                minTemp: baseAttrs.minTemp + (this.random() - 0.5) * 20,
                maxTemp: baseAttrs.maxTemp + (this.random() - 0.5) * 20,
                survivalMinTemp: baseAttrs.survivalMinTemp, // 保持极限生存范围，避免秒死
                survivalMaxTemp: baseAttrs.survivalMaxTemp,
                prosperityGrowth: randomize(baseAttrs.prosperityGrowth),
                prosperityDecay: randomize(baseAttrs.prosperityDecay),
                expansionThreshold: randomize(baseAttrs.expansionThreshold),
                miningReward: randomize(baseAttrs.miningReward),
                migrationThreshold: randomize(baseAttrs.migrationThreshold),
                alphaRadiationDamage: baseAttrs.alphaRadiationDamage,
                civilizationLevel,
                crystalDamageReduction: reduction,
                settlementSize,
                speciesId,
                color,
            };
            if (options.wideTemperatureTolerance) {
                attrs.minTemp = Math.min(attrs.minTemp, -20);
                attrs.maxTemp = Math.max(attrs.maxTemp, 80);
                attrs.survivalMinTemp = Math.min(attrs.survivalMinTemp, -100);
                attrs.survivalMaxTemp = Math.max(attrs.survivalMaxTemp, 140);
                attrs.prosperityGrowth = Math.max(attrs.prosperityGrowth, this.params.minProsperityGrowth ?? 0.35);
                attrs.prosperityDecay = Math.min(attrs.prosperityDecay, 0.35);
            }
            return placeBioCluster(this, target, attrs, options.prosperity ?? 50, settlementSize) > 0;
        }
        return false;
    },
};
