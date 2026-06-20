// 世界变迁模拟器 - 晶石层（Crystal Layer）
// 移植自 world-morphing-simulator/client/src/lib/simulation/engine.ts updateCrystalLayer()
// 负责晶石能量代谢、网络传输与繁殖：
//   ① 能量获取（Alpha 吸地幔 + 雷暴充能）与维持消耗 ② Alpha 能量网络共享（含衰减）
//   ③ Alpha 富能时向空地繁殖。Alpha 枯竭退化为 Beta，Beta 不可逆向转化。
// 方法在 SimulationEngine 构造时 bind 到实例，故 this === 引擎实例。

import { CELL_TYPE } from './cell.js';

/** @type {{updateCrystalLayer: (this: import('./engine.js').SimulationEngine) => void}} */
export const crystal_layer = {
    /**
     * 更新晶石层：能量代谢 → 网络共享 → 繁殖扩张。
     */
    updateCrystalLayer() {
        const {
            alphaEnergyDemand, betaEnergyDemand, mantleAbsorption,
            thunderstormEnergy, expansionCost, maxCrystalEnergy,
            energySharingRate, energySharingLimit, energyDecayRate,
            crystalMantleAbsorptionThreshold, crystalMantleLocalMargin,
        } = this.params;
        const absorptionThreshold = crystalMantleAbsorptionThreshold ?? 10;
        const absorptionMargin = crystalMantleLocalMargin ?? -999;
        const transferLimit = 5 * Math.max(0.1, (energySharingLimit ?? 1.2) / 1.2);

        /** @type {{x:number, y:number, type:string}[]} */
        const crystalChanges = [];

        // @section:crystal_metabolism - 能量获取（吸地幔/雷暴）与维持消耗，枯竭则 Alpha 退化为 Beta

        for (let y = 0; y < this.height; y++) {
            for (let x = 0; x < this.width; x++) {
                const cell = this.grid[y][x];
                if (!cell.exists || cell.crystalState === CELL_TYPE.EMPTY || cell.crystalState === CELL_TYPE.BIO) continue;

                cell.isAbsorbing = false;
                cell.crystalEnergy = 0;

                // 吸收地幔能量：默认兼容原型；提高阈值/局部高差后，可形成局部源井与远端活跃区。
                const neighbors = this.getNeighbors(x, y);
                const avgMantle = neighbors.length > 0
                    ? neighbors.reduce((sum, n) => sum + n.mantleEnergy, 0) / neighbors.length
                    : cell.mantleEnergy;
                const localMantleSurplus = cell.mantleEnergy - avgMantle;
                const hasMantleSource = (cell.mantleSourceStrength ?? 0) > 0;
                if (cell.mantleEnergy > absorptionThreshold && (hasMantleSource || localMantleSurplus >= absorptionMargin)) {
                    const absorbed = cell.mantleEnergy * mantleAbsorption;
                    cell.storedEnergy += absorbed;
                    cell.crystalEnergy += absorbed;
                    cell.isAbsorbing = true;
                }

                // 雷暴充能
                if (cell.hasThunderstorm) {
                    cell.storedEnergy += thunderstormEnergy;
                    cell.crystalEnergy += thunderstormEnergy;
                }

                // 维持消耗（生命维持成本）
                const demand = cell.crystalState === CELL_TYPE.ALPHA ? alphaEnergyDemand : betaEnergyDemand;
                cell.storedEnergy -= demand;

                // 能量上限截断
                if (cell.storedEnergy > maxCrystalEnergy) {
                    cell.storedEnergy = maxCrystalEnergy;
                }

                // 能量枯竭：Alpha 退化为 Beta；Beta 不因能量耗尽消失（仅被生物开采）
                if (cell.storedEnergy <= 0) {
                    if (cell.crystalState === CELL_TYPE.ALPHA) {
                        cell.crystalState = CELL_TYPE.BETA;
                        cell.storedEnergy = 0;
                    }
                }
            }
        }

        // @section:crystal_energy_network - Alpha 晶石间能量共享（高能流向低能，含传输衰减与流向记录）

        // 重置能量流向记录
        for (let y = 0; y < this.height; y++) {
            for (let x = 0; x < this.width; x++) {
                this.grid[y][x].energyFlow = [];
            }
        }

        const energyChanges = Array(this.height).fill(0).map(() => Array(this.width).fill(0));

        for (let y = 0; y < this.height; y++) {
            for (let x = 0; x < this.width; x++) {
                const cell = this.grid[y][x];
                if (cell.crystalState !== CELL_TYPE.ALPHA) continue;

                const neighbors = this.getNeighbors(x, y);
                const alphaNeighbors = neighbors.filter(n => n.crystalState === CELL_TYPE.ALPHA);

                // 向能量较低的邻居输送能量
                for (const neighbor of alphaNeighbors) {
                    if (cell.storedEnergy > neighbor.storedEnergy) {
                        const diff = cell.storedEnergy - neighbor.storedEnergy;
                        let transferAmount = diff * 0.1 * energySharingRate;

                        // 限制单次传输量，防止震荡
                        if (transferAmount > transferLimit) transferAmount = transferLimit;

                        // 确保传输后不会反超对方（防止能量来回震荡）
                        if (cell.storedEnergy - transferAmount < neighbor.storedEnergy + transferAmount) {
                            transferAmount = diff * 0.4;
                        }

                        if (transferAmount > 0.1) {
                            energyChanges[y][x] -= transferAmount;
                            // 传输损耗（Decay）
                            const receivedAmount = transferAmount * (1 - energyDecayRate);
                            energyChanges[neighbor.y][neighbor.x] += receivedAmount;

                            // 记录流向（供可视化层 poll，引擎本身不渲染）
                            cell.energyFlow.push({
                                x: neighbor.x,
                                y: neighbor.y,
                                amount: transferAmount,
                            });
                        }
                    }
                }
            }
        }

        // 应用能量共享结果
        for (let y = 0; y < this.height; y++) {
            for (let x = 0; x < this.width; x++) {
                const cell = this.grid[y][x];
                if (cell.crystalState === CELL_TYPE.ALPHA) {
                    cell.storedEnergy += energyChanges[y][x];
                    if (cell.storedEnergy < 0) cell.storedEnergy = 0;
                    if (cell.storedEnergy > maxCrystalEnergy) cell.storedEnergy = maxCrystalEnergy;
                }
            }
        }

        // @section:crystal_expansion - 富能 Alpha 向相邻空地繁殖新 Alpha 晶石

        for (let y = 0; y < this.height; y++) {
            for (let x = 0; x < this.width; x++) {
                const cell = this.grid[y][x];
                // 只有能量充足的 Alpha 晶石才能扩张
                if (cell.crystalState === CELL_TYPE.ALPHA && cell.storedEnergy > expansionCost * 2) {
                    const neighbors = this.getNeighbors(x, y);
                    const emptyNeighbors = neighbors.filter(n => n.exists && n.crystalState === CELL_TYPE.EMPTY);

                    if (emptyNeighbors.length > 0) {
                        const target = emptyNeighbors[Math.floor(this.random() * emptyNeighbors.length)];
                        // Alpha 扩张只能生成 Alpha；Beta 只能由 Alpha 枯竭转化而来
                        crystalChanges.push({ x: target.x, y: target.y, type: CELL_TYPE.ALPHA });
                        cell.storedEnergy -= expansionCost;
                    }
                }
            }
        }

        // 应用扩张结果
        for (const change of crystalChanges) {
            const cell = this.grid[change.y][change.x];
            if (cell.crystalState === CELL_TYPE.EMPTY) {
                cell.crystalState = change.type;
                cell.storedEnergy = 10; // 初始能量
            }
        }
    },
};
