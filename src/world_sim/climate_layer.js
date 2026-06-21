// 世界变迁模拟器 - 气候层（Climate Layer）
// 纯数据层：维护温度、气候势能、持久风场、垂直运动和雷暴标记。
import { CELL_TYPE } from './cell.js';

function clamp(value, min, max) {
    if (!Number.isFinite(value)) return min;
    return Math.max(min, Math.min(max, value));
}

function getCell(engine, x, y) {
    return engine.grid[Math.max(0, Math.min(engine.height - 1, y))]?.[Math.max(0, Math.min(engine.width - 1, x))];
}

function terrainExchangeWeight(params, cell, neighbor) {
    if (!neighbor?.exists) return 0.15;
    const step = Math.abs((neighbor.terrainElevation ?? 0) - (cell.terrainElevation ?? 0));
    const resistance = params.terrainClimateSlopeResistance ?? 4;
    const barrierThreshold = params.terrainClimateBarrierThreshold ?? 0.32;
    const barrierWeight = step > barrierThreshold ? 0.25 : 1;
    return barrierWeight / (1 + step * resistance);
}

function terrainWindFactor(params, cell, target) {
    if (!target?.exists) return 0.25;
    const step = Math.abs((target.terrainElevation ?? 0) - (cell.terrainElevation ?? 0));
    const resistance = params.terrainWindSlopeResistance ?? 4;
    const barrierThreshold = params.terrainWindBarrierThreshold ?? 0.32;
    const barrierWeight = step > barrierThreshold ? 0.28 : 1;
    return barrierWeight / (1 + step * resistance);
}

function sampleTemperature(engine, x, y) {
    const x0 = Math.floor(clamp(x, 0, engine.width - 1));
    const y0 = Math.floor(clamp(y, 0, engine.height - 1));
    const x1 = Math.min(x0 + 1, engine.width - 1);
    const y1 = Math.min(y0 + 1, engine.height - 1);
    const wx = clamp(x - x0, 0, 1);
    const wy = clamp(y - y0, 0, 1);

    const t00 = getCell(engine, x0, y0)?.exists ? getCell(engine, x0, y0).temperature : undefined;
    const t10 = getCell(engine, x1, y0)?.exists ? getCell(engine, x1, y0).temperature : undefined;
    const t01 = getCell(engine, x0, y1)?.exists ? getCell(engine, x0, y1).temperature : undefined;
    const t11 = getCell(engine, x1, y1)?.exists ? getCell(engine, x1, y1).temperature : undefined;
    const fallback = t00 ?? t10 ?? t01 ?? t11 ?? 0;

    const a = (t00 ?? fallback) * (1 - wx) + (t10 ?? fallback) * wx;
    const b = (t01 ?? fallback) * (1 - wx) + (t11 ?? fallback) * wx;
    return a * (1 - wy) + b * wy;
}

function updateCrystalClimateCharge(params, cell) {
    const {
        alphaClimatePotentialBias = -10,
        alphaClimateStormBoost = 0.18,
        betaClimatePotentialBias = 3,
    } = params;

    if (cell.crystalState === CELL_TYPE.ALPHA) {
        const energyBoost = Math.min(8, (cell.storedEnergy ?? 0) * alphaClimateStormBoost);
        cell.crystalClimateCharge = alphaClimatePotentialBias + energyBoost;
    } else if (cell.crystalState === CELL_TYPE.BETA) {
        cell.crystalClimateCharge = betaClimatePotentialBias;
    } else {
        cell.crystalClimateCharge = (cell.crystalClimateCharge ?? 0) * 0.9;
        if (Math.abs(cell.crystalClimateCharge) < 0.001) cell.crystalClimateCharge = 0;
    }
}

function computeBaseTemperature(params, cell) {
    const {
        climateBaseTemp = -40,
        mantleClimateAnomalyScale = 8,
        terrainElevationCooling = 24,
        terrainMantleHeatDamping = 0.65,
        terrainBasinHeatRetention = 0.45,
        alphaClimateThermalBias = 8,
        betaClimateThermalBias = -3,
    } = params;

    const elevation = clamp(cell.terrainElevation ?? 0, 0, 1);
    const basinDepth = Math.max(0, cell.terrainBasinDepth ?? 0);
    const mantleHeatDamping = Math.max(0.05, 1 - elevation * terrainMantleHeatDamping);
    const mantleAnomaly = ((cell.mantleEnergy ?? 0) / 100) * mantleClimateAnomalyScale * mantleHeatDamping;
    const crystalThermalBias = cell.crystalState === CELL_TYPE.ALPHA
        ? alphaClimateThermalBias
        : cell.crystalState === CELL_TYPE.BETA
            ? betaClimateThermalBias
            : 0;

    return climateBaseTemp
        - elevation * terrainElevationCooling
        + basinDepth * terrainBasinHeatRetention * 18
        + mantleAnomaly
        + crystalThermalBias;
}

function computePotential(params, cell) {
    return cell.temperature * (params.climatePotentialHeatScale ?? 0.06)
        + (cell.crystalClimateCharge ?? 0) * (params.climatePotentialCrystalScale ?? 1)
        - (cell.terrainElevation ?? 0) * (params.climatePotentialElevationBias ?? 0.8)
        + (cell.terrainBasinDepth ?? 0) * (params.climatePotentialBasinBias ?? 0.35);
}

function potentialGradient(engine, x, y) {
    const cell = engine.grid[y][x];
    const left = getCell(engine, x - 1, y);
    const right = getCell(engine, x + 1, y);
    const up = getCell(engine, x, y - 1);
    const down = getCell(engine, x, y + 1);
    const leftPotential = left?.exists ? left.climatePotential : cell.climatePotential;
    const rightPotential = right?.exists ? right.climatePotential : cell.climatePotential;
    const upPotential = up?.exists ? up.climatePotential : cell.climatePotential;
    const downPotential = down?.exists ? down.climatePotential : cell.climatePotential;
    return {
        x: (rightPotential - leftPotential) / 2,
        y: (downPotential - upPotential) / 2,
    };
}

function computeWind(engine, x, y) {
    const params = engine.params;
    const cell = engine.grid[y][x];
    const gradient = potentialGradient(engine, x, y);
    const alphaNearby = cell.crystalState === CELL_TYPE.ALPHA ||
        engine.getNeighbors(x, y).some(n => n.crystalState === CELL_TYPE.ALPHA);
    const twistBias = (params.windCirculationBias ?? 0.04) +
        (alphaNearby ? (params.alphaClimateWindTwist ?? 0.06) : 0);

    let nextWindX = (cell.windX ?? 0) * (params.windInertia ?? 0.82) - gradient.x * (params.windAcceleration ?? 0.05);
    let nextWindY = (cell.windY ?? 0) * (params.windInertia ?? 0.82) - gradient.y * (params.windAcceleration ?? 0.05);

    const twistX = -nextWindY * twistBias;
    const twistY = nextWindX * twistBias;
    nextWindX += twistX;
    nextWindY += twistY;

    const dirX = Math.sign(nextWindX);
    const dirY = Math.sign(nextWindY);
    const target = getCell(engine, x + dirX, y + dirY) ?? cell;
    const slopeFactor = terrainWindFactor(params, cell, target);
    const gradientMagnitude = Math.hypot(gradient.x, gradient.y);
    const channelScore = gradientMagnitude > 0.001 && (cell.terrainSlope ?? 0) < 0.18 && (cell.terrainBasinDepth ?? 0) < 0.12 ? 1 : 0;
    const channelBoost = 1 + channelScore * (params.terrainWindChannelBoost ?? 0.35);
    const basinDamping = 1 - Math.min(0.75, (cell.terrainBasinDepth ?? 0) * (params.terrainWindBasinDamping ?? 0.3));
    const friction = 1 - (params.windFriction ?? 0.08);

    nextWindX *= slopeFactor * channelBoost * basinDamping * friction;
    nextWindY *= slopeFactor * channelBoost * basinDamping * friction;

    const speed = Math.hypot(nextWindX, nextWindY);
    const maxSpeed = params.windMaxSpeed ?? 1.6;
    if (speed > maxSpeed && speed > 0) {
        const scale = maxSpeed / speed;
        nextWindX *= scale;
        nextWindY *= scale;
    }

    const elevationStep = target.exists ? (target.terrainElevation ?? 0) - (cell.terrainElevation ?? 0) : 0;
    const verticalMotion = clamp(elevationStep * Math.hypot(nextWindX, nextWindY) * (params.terrainWindSlopeResistance ?? 4), -1, 1);
    return { windX: nextWindX, windY: nextWindY, verticalMotion };
}

function windConvergence(engine, x, y) {
    const cell = engine.grid[y][x];
    const left = getCell(engine, x - 1, y);
    const right = getCell(engine, x + 1, y);
    const up = getCell(engine, x, y - 1);
    const down = getCell(engine, x, y + 1);
    const leftWind = left?.exists ? left.windX : cell.windX;
    const rightWind = right?.exists ? right.windX : cell.windX;
    const upWind = up?.exists ? up.windY : cell.windY;
    const downWind = down?.exists ? down.windY : cell.windY;
    const divergence = ((rightWind - leftWind) + (downWind - upWind)) / 2;
    return Math.max(0, -divergence);
}

function computeStormScore(engine, x, y, avgTemp) {
    const params = engine.params;
    const cell = engine.grid[y][x];
    const neighbors = engine.getNeighbors(x, y);
    const tempContrast = Math.abs(cell.temperature - avgTemp);
    const convergence = windConvergence(engine, x, y);
    const uplift = Math.max(0, cell.verticalMotion ?? 0);
    const speed = Math.hypot(cell.windX ?? 0, cell.windY ?? 0);
    const slopeLift = (cell.terrainSlope ?? 0) * (params.terrainOrographicStormBoost ?? 18) * Math.min(1, speed);
    const alphaNeighborBoost = neighbors.filter(n => n.crystalState === CELL_TYPE.ALPHA).length * (params.alphaClimateStormBoost ?? 0.18) * 10;
    const betaNeighborDamping = neighbors.filter(n => n.crystalState === CELL_TYPE.BETA).length * (params.betaClimateStormDamping ?? 0.08) * 18;

    return tempContrast + convergence * 24 + uplift * 18 + slopeLift + alphaNeighborBoost - betaNeighborDamping;
}

/** @type {{updateClimateLayer: (this: import('./engine.js').SimulationEngine) => void}} */
export const climate_layer = {
    updateClimateLayer() {
        const params = this.params;
        const nextTemps = this.grid.map(row => row.map(c => c.temperature));
        const nextWinds = this.grid.map(row => row.map(() => ({ windX: 0, windY: 0, verticalMotion: 0 })));

        for (let y = 0; y < this.height; y++) {
            for (let x = 0; x < this.width; x++) {
                const cell = this.grid[y][x];
                if (!cell.exists) continue;
                updateCrystalClimateCharge(params, cell);
                cell.baseTemperature = computeBaseTemperature(params, cell);
                cell.climatePotential = computePotential(params, cell);
            }
        }

        for (let y = 0; y < this.height; y++) {
            for (let x = 0; x < this.width; x++) {
                const cell = this.grid[y][x];
                if (!cell.exists) continue;
                nextWinds[y][x] = computeWind(this, x, y);
            }
        }

        for (let y = 0; y < this.height; y++) {
            for (let x = 0; x < this.width; x++) {
                const cell = this.grid[y][x];
                if (!cell.exists) continue;
                cell.windX = nextWinds[y][x].windX;
                cell.windY = nextWinds[y][x].windY;
                cell.verticalMotion = nextWinds[y][x].verticalMotion;
            }
        }

        for (let y = 0; y < this.height; y++) {
            for (let x = 0; x < this.width; x++) {
                const cell = this.grid[y][x];
                if (!cell.exists) continue;

                const neighbors = this.getNeighbors(x, y);
                let weightedTemp = 0;
                let weightSum = 0;
                for (const n of neighbors) {
                    const weight = terrainExchangeWeight(params, cell, n);
                    weightedTemp += n.temperature * weight;
                    weightSum += weight;
                }
                const avgTemp = weightSum > 0 ? weightedTemp / weightSum : cell.temperature;

                let newTemp = cell.temperature * (1 - (params.diffusionRate ?? 0.2)) + avgTemp * (params.diffusionRate ?? 0.2);
                const baseRate = (params.climateBaseReturnRate ?? 0.006) + (params.mantleClimateAnomalyRate ?? 0.003);
                newTemp = newTemp * (1 - baseRate) + cell.baseTemperature * baseRate;

                const speed = Math.hypot(cell.windX ?? 0, cell.windY ?? 0);
                const srcX = x - (cell.windX ?? 0);
                const srcY = y - (cell.windY ?? 0);
                const sampledTemp = sampleTemperature(this, srcX, srcY);
                const sampleCell = getCell(this, Math.round(clamp(srcX, 0, this.width - 1)), Math.round(clamp(srcY, 0, this.height - 1))) ?? cell;
                const terrainAdvectionWeight = terrainExchangeWeight(params, cell, sampleCell);
                const advectionStrength = clamp((params.advectionRate ?? 0.02) + speed * 0.12, 0, 0.45) * terrainAdvectionWeight;
                newTemp = newTemp * (1 - advectionStrength) + sampledTemp * advectionStrength;

                const basinRetention = Math.min(0.8, (cell.terrainBasinDepth ?? 0) * (params.terrainBasinHeatRetention ?? 0.45));
                const ambientCooling = 0.004 * (1 - basinRetention);
                newTemp -= (newTemp - (params.climateBaseTemp ?? -40)) * ambientCooling;

                if (!Number.isFinite(newTemp)) newTemp = cell.temperature;
                nextTemps[y][x] = newTemp;

                const stormScore = computeStormScore(this, x, y, avgTemp);
                const threshold = params.thunderstormThreshold ?? 39;
                cell.hasThunderstorm = cell.crystalState !== CELL_TYPE.ALPHA &&
                    cell.temperature > -35 &&
                    stormScore > threshold;
            }
        }

        for (let y = 0; y < this.height; y++) {
            for (let x = 0; x < this.width; x++) {
                const cell = this.grid[y][x];
                if (!cell.exists) continue;
                const previousTemp = cell.temperature;
                cell.temperature = nextTemps[y][x];
                cell.temperatureChange = cell.temperature - previousTemp;
            }
        }
    },
};
