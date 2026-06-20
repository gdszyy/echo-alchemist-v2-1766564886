// 世界变迁模拟器 - 气候层（Climate Layer）
// 移植自 world-morphing-simulator/client/src/lib/simulation/engine.ts updateClimateLayer()
// 负责地表温度分布与天气：① 地幔加热 ② 热扩散（传导）③ 热平流（风，一阶迎风格式）
//   ④ 辐射散热 ⑤ 雷暴判定。方法在 SimulationEngine 构造时 bind 到实例，故 this === 引擎实例。

function terrainExchangeWeight(params, cell, neighbor) {
    const step = Math.abs((neighbor.terrainElevation ?? 0) - (cell.terrainElevation ?? 0));
    const resistance = params.terrainClimateSlopeResistance ?? 4;
    const barrierThreshold = params.terrainClimateBarrierThreshold ?? 0.32;
    const barrierWeight = step > barrierThreshold ? 0.25 : 1;
    return barrierWeight / (1 + step * resistance);
}

/** @type {{updateClimateLayer: (this: import('./engine.js').SimulationEngine) => void}} */
export const climate_layer = {
    /**
     * 更新气候层：计算每格新温度并判定雷暴。
     * 温度受地幔能量驱动（弱耦合），经传导/平流流动，再辐射散热回环境本底。
     */
    updateClimateLayer() {
        const {
            diffusionRate, advectionRate, thunderstormThreshold, mantleHeatFactor, mantleHeatingRate,
            terrainElevationCooling, terrainMantleHeatDamping, terrainOrographicStormBoost, terrainBasinHeatRetention,
        } = this.params;

        const newTemps = this.grid.map(row => row.map(c => c.temperature));

        for (let y = 0; y < this.height; y++) {
            for (let x = 0; x < this.width; x++) {
                const cell = this.grid[y][x];
                if (!cell.exists) continue;

                // 1. 热扩散（传导）：温度趋向邻居平均值
                const neighbors = this.getNeighbors(x, y);
                let weightedTemp = 0;
                let weightSum = 0;
                for (const n of neighbors) {
                    const weight = terrainExchangeWeight(this.params, cell, n);
                    weightedTemp += n.temperature * weight;
                    weightSum += weight;
                }
                const avgTemp = weightSum > 0 ? weightedTemp / weightSum : cell.temperature;
                let newTemp = cell.temperature * (1 - diffusionRate) + avgTemp * diffusionRate;

                // 2. 地幔加热：地幔能量转化为目标温度，弱耦合（mantleHeatingRate）混合
                const elevation = Math.max(0, Math.min(1, cell.terrainElevation ?? 0.5));
                const elevationCooling = (elevation - 0.5) * (terrainElevationCooling ?? 24);
                const mantleHeatDamping = Math.max(0.05, 1 - elevation * (terrainMantleHeatDamping ?? 0.65));
                const targetTemp = -100 + (cell.mantleEnergy / 100) * mantleHeatFactor * mantleHeatDamping - elevationCooling;
                newTemp = newTemp * (1 - mantleHeatingRate) + targetTemp * mantleHeatingRate;

                // 3. 热平流（风携带热量移动）
                // 局部温度梯度驱动风：风从高温吹向低温，风速 ∝ 梯度
                const tLeft = this.grid[y][Math.max(x - 1, 0)].temperature;
                const tRight = this.grid[y][Math.min(x + 1, this.width - 1)].temperature;
                const tUp = this.grid[Math.max(y - 1, 0)][x].temperature;
                const tDown = this.grid[Math.min(y + 1, this.height - 1)][x].temperature;

                const gradientX = Number.isFinite(tRight - tLeft) ? (tRight - tLeft) / 2 : 0;
                const gradientY = Number.isFinite(tDown - tUp) ? (tDown - tUp) / 2 : 0;

                const windX = -gradientX * 2.0;
                const windY = -gradientY * 2.0;

                // 一阶迎风格式（Upwind Scheme）：从上游位置双线性插值采样温度
                const rawSrcX = x - windX;
                const rawSrcY = y - windY;
                const srcX = Number.isFinite(rawSrcX) ? Math.max(0, Math.min(this.width - 1, rawSrcX)) : x;
                const srcY = Number.isFinite(rawSrcY) ? Math.max(0, Math.min(this.height - 1, rawSrcY)) : y;

                const x0 = Math.floor(srcX);
                const x1 = Math.min(x0 + 1, this.width - 1);
                const y0 = Math.floor(srcY);
                const y1 = Math.min(y0 + 1, this.height - 1);

                const wx = srcX - x0;
                const wy = srcY - y0;

                const t00 = this.grid[y0][x0].temperature;
                const t10 = this.grid[y0][x1].temperature;
                const t01 = this.grid[y1][x0].temperature;
                const t11 = this.grid[y1][x1].temperature;

                const tSrc = (t00 * (1 - wx) + t10 * wx) * (1 - wy) +
                             (t01 * (1 - wx) + t11 * wx) * wy;

                // 应用平流：混合当前温度与上游温度（advectionStrength=0.4）
                // advectionRate 作为小幅可调项，地形高度差会削弱跨坡热输运。
                const sampledCell = this.grid[Math.round(srcY)]?.[Math.round(srcX)] ?? cell;
                const terrainAdvectionWeight = terrainExchangeWeight(this.params, cell, sampledCell);
                const advectionStrength = Math.max(0, Math.min(0.75, 0.4 + (advectionRate ?? 0.02))) * terrainAdvectionWeight;
                newTemp = newTemp * (1 - advectionStrength) + tSrc * advectionStrength;

                // 4. 环境冷却（辐射散热）：散热速率 ∝ (T - 环境本底温度)
                const basinRetention = Math.min(0.8, (cell.terrainBasinDepth ?? 0) * (terrainBasinHeatRetention ?? 0.45));
                const coolingRate = 0.01 * (1 - basinRetention);
                const ambientTemp = -100;
                newTemp -= (newTemp - ambientTemp) * coolingRate;

                newTemps[y][x] = newTemp;

                // 5. 雷暴判定：温度梯度大（对流强）且温度较高（> -50）时概率触发
                const tempDiff = Math.abs(cell.temperature - avgTemp);
                const orographicLift = (cell.terrainSlope ?? 0) * (terrainOrographicStormBoost ?? 18);
                const effectiveThunderstormThreshold = Math.max(5, thunderstormThreshold - orographicLift);
                const stormChance = Math.min(0.35, 0.15 + (cell.terrainSlope ?? 0) * 0.25);
                if (cell.temperature > -50 && tempDiff > effectiveThunderstormThreshold && this.random() < stormChance) {
                    cell.hasThunderstorm = true;
                } else {
                    cell.hasThunderstorm = false;
                }
            }
        }

        // 应用温度更新
        for (let y = 0; y < this.height; y++) {
            for (let x = 0; x < this.width; x++) {
                if (this.grid[y][x].exists) {
                    this.grid[y][x].temperature = newTemps[y][x];
                }
            }
        }
    },
};
