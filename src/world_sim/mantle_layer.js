// 世界变迁模拟器 - 地幔层（Mantle Layer）
// 移植自 world-morphing-simulator/client/src/lib/simulation/engine.ts updateMantleLayer()
// 负责：地幔能量场的噪声扰动 + 扩散，边缘供给点驱动的能量注入，以及由能量驱动的地形扩张。
// 以组合对象形式导出，方法在 SimulationEngine 构造时 bind 到实例，故 this === 引擎实例。

import { generatePerlinNoise } from './perlin.js';
import { CELL_TYPE } from './cell.js';

function clamp01(value) {
    return Math.max(0, Math.min(1, value));
}

/** @type {{updateMantleLayer: (this: import('./engine.js').SimulationEngine) => void}} */
export const mantle_layer = {
    /**
     * 更新地幔层：能量演化 + 地形演变。
     * 流程：① 旋转边缘供给点 → ② 逐格计算新能量（噪声源/扩散/边缘注入/晶石吸收）
     *       → ③ 应用能量 → ④ 依据能量与半径判定地形扩张 → ⑤ 应用地形变化。
     */
    updateMantleLayer() {
        const {
            mantleTimeScale, expansionThreshold,
            mantleEnergyLevel, maxRadius, minRadius, distortionSpeed,
            edgeGenerationWidth, edgeGenerationEnergy, edgeGenerationOffset,
            crystalMantleAbsorptionThreshold, crystalMantleLocalMargin,
            terrainGeologyRate, terrainMantleUpliftRate, terrainErosionRate, terrainMantleScale,
            terrainSourceUpliftBonus,
        } = this.params;
        const absorptionThreshold = crystalMantleAbsorptionThreshold ?? 10;
        const absorptionMargin = crystalMantleLocalMargin ?? -999;
        const geologyRate = Math.max(0, terrainGeologyRate ?? 0.01);
        const upliftRate = (terrainMantleUpliftRate ?? 0.014) * geologyRate;
        const erosionRate = (terrainErosionRate ?? 0.018) * geologyRate;
        const elevationScale = terrainMantleScale ?? 210;
        const sourceUpliftBonus = terrainSourceUpliftBonus ?? 0.18;

        const centerX = this.width / 2;
        const centerY = this.height / 2;

        // @section:mantle_supply_points - 旋转边缘供给点（基础速度 + 正弦摆动）

        this.noiseOffsetX += distortionSpeed;
        this.noiseOffsetY += distortionSpeed;

        const supplySpeed = this.params.edgeSupplyPointSpeed || 0.05;
        for (const point of this.edgeSupplyPoints) {
            // 使用参数中的速度，确保实时更新生效
            point.speed = supplySpeed;
            // 正弦波叠加基础速度，产生忽快忽慢/轻微往复的摆动
            const oscillation = Math.sin(this.timeStep * 0.01 * point.frequency + point.phase) * 0.02;
            point.angle += point.speed + oscillation;
            if (point.angle > Math.PI * 2) point.angle -= Math.PI * 2;
            if (point.angle < 0) point.angle += Math.PI * 2;
        }

        // @section:mantle_energy_field - 逐格计算新能量：噪声源 + 邻居扩散 + 边缘注入 + 晶石吸收

        const newEnergies = this.grid.map(row => row.map(c => c.mantleEnergy));
        const newElevations = this.grid.map(row => row.map(c => c.terrainElevation ?? 0));

        for (let y = 0; y < this.height; y++) {
            for (let x = 0; x < this.width; x++) {
                const cell = this.grid[y][x];
                if (!cell.exists) continue;

                // 1. 基础噪声能量源
                const noiseVal = generatePerlinNoise(x * 0.1 + this.noiseOffsetX, y * 0.1 + this.noiseOffsetY);
                const energyFluctuation = 1 + noiseVal * 0.1;

                // 2. 邻居平均（扩散）
                const neighbors = this.getNeighbors(x, y);
                const avgEnergy = neighbors.reduce((sum, n) => sum + n.mantleEnergy, 0) / neighbors.length;

                // 3. 趋向稳定值
                const targetEnergy = mantleEnergyLevel * energyFluctuation;
                let newEnergy = cell.mantleEnergy * (1 - mantleTimeScale) + targetEnergy * mantleTimeScale;

                // 扩散混合（diffusionStrength=0.4，比 0.1 更明显的流动性）
                if (!isNaN(avgEnergy)) {
                    const diffusionStrength = 0.4;
                    newEnergy = newEnergy * (1 - diffusionStrength) + avgEnergy * diffusionStrength;
                }

                // 防止 NaN / 无限值
                if (isNaN(newEnergy) || !isFinite(newEnergy)) {
                    newEnergy = mantleEnergyLevel;
                }

                // 4. 边缘能量生成
                // edgeGenerationOffset 解释为「径向偏移」：能量注入带从最大半径向内缩进 offset 层。
                // 供给点以角度影响（余弦衰减）注入能量，仅作用在 [innerBound, outerBound] 的环带上。
                const distToCenter = Math.sqrt((x - centerX) ** 2 + (y - centerY) ** 2);
                const effectiveMaxRadius = maxRadius;
                const innerBound = effectiveMaxRadius - (edgeGenerationOffset || 0) - edgeGenerationWidth;
                const outerBound = effectiveMaxRadius - (edgeGenerationOffset || 0);

                if (distToCenter >= innerBound && distToCenter <= outerBound) {
                    const angle = Math.atan2(y - centerY, x - centerX);
                    let normalizedAngle = angle;
                    if (normalizedAngle < 0) normalizedAngle += Math.PI * 2;

                    let maxInfluence = 0;
                    for (const point of this.edgeSupplyPoints) {
                        const effectiveAngle = point.angle;
                        let diff = Math.abs(normalizedAngle - effectiveAngle);
                        if (diff > Math.PI) diff = Math.PI * 2 - diff;
                        // 供给点影响范围 PI/4（45 度），余弦衰减
                        if (diff < Math.PI / 4) {
                            const angleInfluence = Math.cos(diff * 4);
                            maxInfluence = Math.max(maxInfluence, angleInfluence);
                        }
                    }

                    if (maxInfluence > 0) {
                        newEnergy += edgeGenerationEnergy * maxInfluence;
                    }
                }

                // 5. 人类基地吸能：在 Alpha 吸收前抢夺局部地幔能量
                const sourceStrength = cell.mantleSourceStrength ?? 0;
                if (sourceStrength > 0) {
                    newEnergy = Math.max(newEnergy, sourceStrength);
                }

                if (typeof this.applyHumanEnergyExtraction === 'function') {
                    newEnergy = this.applyHumanEnergyExtraction(x, y, newEnergy);
                }

                // 6. 晶石吸收（仅 Alpha 晶石吸收地幔能量）
                const localMantleSurplus = !isNaN(avgEnergy) ? newEnergy - avgEnergy : 0;
                const hasMantleSource = (cell.mantleSourceStrength ?? 0) > 0;
                const canCrystalAbsorb = newEnergy > absorptionThreshold &&
                    (hasMantleSource || localMantleSurplus >= absorptionMargin);
                if (cell.crystalState === CELL_TYPE.ALPHA && canCrystalAbsorb) {
                    const absorption = newEnergy * this.params.mantleAbsorption;
                    newEnergy -= absorption;
                }

                newEnergies[y][x] = newEnergy;

                const avgElevation = neighbors.length > 0
                    ? neighbors.reduce((sum, n) => sum + (n.terrainElevation ?? 0), 0) / neighbors.length
                    : (cell.terrainElevation ?? 0);
                const mantleElevationTarget = clamp01(
                    (newEnergy / elevationScale) +
                    (hasMantleSource ? Math.min(sourceUpliftBonus, sourceStrength / Math.max(1, elevationScale) * 0.15) : 0)
                );
                let newElevation = (cell.terrainElevation ?? 0) * (1 - upliftRate) + mantleElevationTarget * upliftRate;
                newElevation = newElevation * (1 - erosionRate) + avgElevation * erosionRate;
                newElevations[y][x] = clamp01(newElevation);
            }
        }

        // 应用能量与高度更新
        for (let y = 0; y < this.height; y++) {
            for (let x = 0; x < this.width; x++) {
                if (this.grid[y][x].exists) {
                    this.grid[y][x].mantleEnergy = newEnergies[y][x];
                    this.grid[y][x].terrainElevation = newElevations[y][x];
                }
            }
        }

        // @section:mantle_terrain_change - 依据能量与半径累积判定地形扩张并应用

        /** @type {{x:number, y:number, action:'expand'}[]} */
        const terrainChanges = [];

        for (let y = 0; y < this.height; y++) {
            for (let x = 0; x < this.width; x++) {
                const cell = this.grid[y][x];
                const dist = Math.sqrt((x - centerX) ** 2 + (y - centerY) ** 2);

                if (cell.exists) {
                    // 地块消失机制已取消：低能地块不再塌陷为虚空。
                    cell.shrinkAccumulator = 0;

                    // 检查扩张
                    if (cell.mantleEnergy > expansionThreshold && dist < maxRadius) {
                        cell.expansionAccumulator += (cell.mantleEnergy - expansionThreshold);
                        if (cell.expansionAccumulator > 100) {
                            const neighbors = this.getNeighbors(x, y, true);
                            const voidNeighbors = neighbors.filter(n => !n.exists);
                            if (voidNeighbors.length > 0) {
                                const target = voidNeighbors[Math.floor(this.random() * voidNeighbors.length)];
                                terrainChanges.push({ x: target.x, y: target.y, action: 'expand' });
                                cell.mantleEnergy -= 20;
                            }
                            cell.expansionAccumulator = 0;
                        }
                    } else {
                        cell.expansionAccumulator = Math.max(0, cell.expansionAccumulator - 1);
                    }
                }
            }
        }

        // 应用地形变化
        for (const change of terrainChanges) {
            const cell = this.grid[change.y][change.x];
            if (change.action === 'expand') {
                cell.exists = true;
                cell.mantleEnergy = 30;
                const neighbors = this.getNeighbors(change.x, change.y);
                const avgElevation = neighbors.length > 0
                    ? neighbors.reduce((sum, n) => sum + (n.terrainElevation ?? 0), 0) / neighbors.length
                    : 0.3;
                cell.terrainElevation = clamp01(avgElevation * 0.9);
            }
        }

        // @section:mantle_terrain_metrics - 刷新坡度、盆地深度与通行代价缓存

        const slopeMoveCost = this.params.terrainSlopeMoveCost ?? 10;
        const basinExitCost = this.params.terrainBasinExitCost ?? 8;
        for (let y = 0; y < this.height; y++) {
            for (let x = 0; x < this.width; x++) {
                const cell = this.grid[y][x];
                if (!cell.exists) continue;

                const neighbors = this.getNeighbors(x, y);
                if (neighbors.length === 0) {
                    cell.terrainSlope = 0;
                    cell.terrainBasinDepth = 0;
                    cell.terrainMoveCost = 1;
                    continue;
                }

                const elevation = cell.terrainElevation ?? 0;
                let maxStep = 0;
                let elevationSum = 0;
                for (const n of neighbors) {
                    const neighborElevation = n.terrainElevation ?? 0;
                    maxStep = Math.max(maxStep, Math.abs(neighborElevation - elevation));
                    elevationSum += neighborElevation;
                }
                const avgElevation = elevationSum / neighbors.length;
                const basinDepth = Math.max(0, avgElevation - elevation);
                cell.terrainSlope = maxStep;
                cell.terrainBasinDepth = basinDepth;
                cell.terrainMoveCost = 1 + maxStep * slopeMoveCost + basinDepth * basinExitCost;
            }
        }
    },
};
