// 世界变迁模拟器 - 生物层（Bio Layer）
// 移植自 world-morphing-simulator/client/src/lib/simulation/engine.ts updateBioLayer() / distributeExtinctionBonus()
// 负责生物聚落与迁徙者的生存、繁衍、变异、迁移、灭绝。
// 物种自动投放与人类重生委托 bio_spawn.js（spawnRandomSpecies / spawnHuman）。
// 方法在 SimulationEngine 构造时 bind 到实例，故 this === 引擎实例。
//
// 变更收集模式：本层先把所有改动收集进 changes[] 再统一应用，避免遍历途中改写网格导致读到半更新状态。

import { CELL_TYPE } from './cell.js';
import {
    canSettleWithinLimit,
    getSmallSettlementFactor,
    isSettlementAtCapacity,
} from './bio_settlement.js';

function terrainStep(fromCell, toCell) {
    return Math.abs((toCell.terrainElevation ?? 0) - (fromCell.terrainElevation ?? 0));
}

function canTraverseTerrain(engine, fromCell, toCell, maxStep) {
    if (!toCell.exists) return false;
    const limit = maxStep ?? engine.params.terrainMigrationMaxStep ?? 0.36;
    return terrainStep(fromCell, toCell) <= limit;
}

function getTerrainMoveCost(engine, fromCell, toCell) {
    const fromElevation = fromCell.terrainElevation ?? 0;
    const toElevation = toCell.terrainElevation ?? 0;
    const step = Math.abs(toElevation - fromElevation);
    const uphill = Math.max(0, toElevation - fromElevation);
    const basinExit = Math.max(0, fromCell.terrainBasinDepth ?? 0) * uphill;
    return 1 +
        step * (engine.params.terrainSlopeMoveCost ?? 10) +
        basinExit * (engine.params.terrainBasinExitCost ?? 8);
}

function getTerrainContact(engine, fromCell, toCell) {
    const penalty = engine.params.terrainContactPenaltySlope ?? 4;
    return 1 / (1 + terrainStep(fromCell, toCell) * penalty);
}

function clampRatio(value) {
    return Math.max(0, Math.min(0.95, value));
}

function getCrystalDamageReduction(engine, attrs) {
    if (typeof attrs.crystalDamageReduction === 'number') {
        return clampRatio(attrs.crystalDamageReduction);
    }
    const civilizationLevel = typeof attrs.civilizationLevel === 'number' ? attrs.civilizationLevel : 0;
    const scale = engine.params.civilizationCrystalDamageReductionScale ?? 0.45;
    return clampRatio(civilizationLevel * scale);
}

function getCivilizationLevel(attrs) {
    return Math.max(0, Math.min(1, attrs.civilizationLevel ?? 0));
}

/**
 * @type {{
 *   updateBioLayer: (this: import('./engine.js').SimulationEngine) => void,
 *   distributeExtinctionBonus: (this: import('./engine.js').SimulationEngine, x: number, y: number, bonus: number) => void,
 * }}
 */
export const bio_layer = {
    /**
     * 更新生物层：物种普查 → 自动投放/人类重生 → 聚落与迁徙者演化 → 统一应用变更。
     */
    updateBioLayer() {
        const {
            extinctionBonus, competitionPenalty, mutationRate, mutationStrength, newSpeciesThreshold,
        } = this.params;

        // @section:bio_census - 统计生物数量、物种集合与人类存活情况

        let bioCount = 0;
        for (let y = 0; y < this.height; y++) {
            for (let x = 0; x < this.width; x++) {
                if (this.grid[y][x].crystalState === CELL_TYPE.BIO) {
                    bioCount++;
                }
            }
        }

        const speciesSet = new Set();
        let humanExists = false;
        for (let y = 0; y < this.height; y++) {
            for (let x = 0; x < this.width; x++) {
                const cell = this.grid[y][x];
                if (cell.crystalState === CELL_TYPE.BIO && cell.bioAttributes) {
                    speciesSet.add(cell.bioAttributes.speciesId);
                    if (cell.bioAttributes.speciesId === 0) {
                        humanExists = true;
                    }
                }
            }
        }

        // @section:bio_spawn_respawn - 物种稀少时自动投放新物种；人类灭绝后按延迟强制重生

        this.updateHumanRespawnPoint();

        const autoSpawnCount = this.params.bioAutoSpawnCount ?? 5;
        const autoSpawnInterval = this.params.bioAutoSpawnInterval ?? 10;
        if (autoSpawnCount > 0 && speciesSet.size < autoSpawnCount && this.timeStep % autoSpawnInterval === 0) {
            this.spawnRandomSpecies();
        }

        if (!humanExists && this.params.initialHumanSpawn !== false) {
            if (this.isFirstSpawn) {
                if (this.timeStep >= 50) {
                    this.spawnHuman(100); // 初始生成人类（ID=0）
                    this.isFirstSpawn = false;
                }
            } else {
                if (this.bioExtinctionStep === null) {
                    this.bioExtinctionStep = this.timeStep;
                }
                const respawnDelay = this.params.humanRespawnDelay || 20;
                if (this.timeStep - this.bioExtinctionStep >= respawnDelay) {
                    this.spawnHuman(100);
                    this.bioExtinctionStep = null;
                }
            }
        } else {
            this.bioExtinctionStep = null;
        }

        // 变更队列：type ∈ STATE | PROSPERITY | CIVILIZATION | MINING_STATE | MINING_PROGRESS | NEW_BIO | MIGRATE | MIGRANT_ADD | MIGRANT_UPDATE | MIGRANT_REMOVE
        /** @type {{x:number, y:number, type:string, value?:any, toX?:number, toY?:number}[]} */
        const changes = [];
        const minedBetaKeys = new Set();

        for (let y = 0; y < this.height; y++) {
            for (let x = 0; x < this.width; x++) {
                const cell = this.grid[y][x];
                const neighbors = this.getNeighbors(x, y);

                // @section:bio_settlement - 聚落：温度/繁荣/竞争/辐射/采矿/死亡/扩张变异/迁移转化

                if (cell.crystalState === CELL_TYPE.BIO && cell.bioAttributes) {
                    const attrs = cell.bioAttributes;
                    const smallSettlementFactor = getSmallSettlementFactor(this, x, y, attrs.speciesId);

                    // A. 极限温度伤害（不直接致死，而是快速降低繁荣度，每度温差 2 点）
                    let extremeTempDamage = 0;
                    if (cell.temperature < attrs.survivalMinTemp) {
                        extremeTempDamage = (attrs.survivalMinTemp - cell.temperature) * 2;
                    } else if (cell.temperature > attrs.survivalMaxTemp) {
                        extremeTempDamage = (cell.temperature - attrs.survivalMaxTemp) * 2;
                    }

                    // B. 繁荣度更新：宜居温度带来增长，偏离则增长递减（甚至为负）
                    let prosperityChange = 0;
                    prosperityChange += (this.params.bioSmallSettlementSurvivalBonus ?? 0) * smallSettlementFactor;

                    let growth = attrs.prosperityGrowth;
                    if (attrs.speciesId !== 0) {
                        growth = Math.max(growth, this.params.minProsperityGrowth);
                    }

                    if (cell.temperature >= attrs.minTemp && cell.temperature <= attrs.maxTemp) {
                        prosperityChange += growth;
                    } else {
                        let deviation = 0;
                        if (cell.temperature < attrs.minTemp) {
                            deviation = attrs.minTemp - cell.temperature;
                        } else {
                            deviation = cell.temperature - attrs.maxTemp;
                        }
                        const decayFactor = attrs.prosperityDecay || 1.0;
                        const effectiveGrowth = growth - deviation * decayFactor;
                        prosperityChange += effectiveGrowth;
                    }

                    if (extremeTempDamage > 0) {
                        prosperityChange -= extremeTempDamage;
                    }

                    // 邻居影响：同种协作加成；异种竞争中仅繁荣度更低者被伤害（强者不受损）
                    const bioNeighbors = neighbors.filter(n => n.crystalState === CELL_TYPE.BIO && n.bioAttributes);
                    for (const n of bioNeighbors) {
                        const terrainContact = getTerrainContact(this, cell, n);
                        if (n.bioAttributes.speciesId === attrs.speciesId) {
                            prosperityChange += this.params.sameSpeciesBonus * terrainContact;
                        } else if (cell.prosperity < n.prosperity) {
                            const diff = n.prosperity - cell.prosperity;
                            const damage = competitionPenalty * (1 + diff / 100);
                            const resistance = Math.min(
                                0.9,
                                (this.params.bioSmallSettlementCompetitionResistance ?? 0) * smallSettlementFactor
                            );
                            prosperityChange -= damage * terrainContact * (1 - resistance);
                        }
                    }

                    // Alpha 辐射伤害：繁荣度与物种晶石减伤共同削弱伤害，达到免疫阈值后伤害归零
                    const alphaNeighbors = neighbors.filter(n => n.crystalState === CELL_TYPE.ALPHA);
                    if (alphaNeighbors.length > 0) {
                        const baseDamage = Math.max(
                            attrs.prosperityGrowth + 0.2,
                            attrs.alphaRadiationDamage ?? this.params.alphaRadiationDamage
                        );
                        const immunityThreshold = this.params.radiationImmunityThreshold || 200;
                        const immunityFactor = Math.max(0, 1 - (cell.prosperity / immunityThreshold));
                        const reductionFactor = 1 - getCrystalDamageReduction(this, attrs);
                        const finalDamage = baseDamage * immunityFactor * reductionFactor;
                        if (finalDamage > 0) {
                            prosperityChange -= alphaNeighbors.length * finalDamage;
                        }
                        const civilizationDecay = Math.max(0, Math.min(1, this.params.alphaCivilizationDecay ?? 0.98));
                        changes.push({
                            x,
                            y,
                            type: 'CIVILIZATION',
                            value: Math.pow(civilizationDecay, alphaNeighbors.length),
                        });
                    }

                    // C. 采矿（仅聚落可采矿，文明越高越快；单聚落每步最多开采一块）
                    const betaNeighbors = neighbors.filter(n =>
                        n.crystalState === CELL_TYPE.BETA && !minedBetaKeys.has(`${n.x},${n.y}`)
                    );
                    let isMining = false;
                    if (betaNeighbors.length > 0) {
                        isMining = true;
                        const civilization = getCivilizationLevel(attrs);
                        const miningRate = Math.min(
                            1,
                            Math.max(this.params.betaMiningMinRate ?? 0.05, civilization * (this.params.betaMiningRate ?? 1))
                        );
                        const nextMiningProgress = (cell.betaMiningProgress ?? 0) + miningRate;
                        if (nextMiningProgress >= 1) {
                            const target = betaNeighbors[Math.floor(this.random() * betaNeighbors.length)];
                            minedBetaKeys.add(`${target.x},${target.y}`);
                            changes.push({ x: target.x, y: target.y, type: 'STATE', value: 0 });
                            prosperityChange += attrs.miningReward;
                            changes.push({ x, y, type: 'MINING_PROGRESS', value: nextMiningProgress - 1 });
                        } else {
                            changes.push({ x, y, type: 'MINING_PROGRESS', value: nextMiningProgress });
                        }
                    } else {
                        changes.push({ x, y, type: 'MINING_PROGRESS', value: 0 });
                    }
                    changes.push({ x, y, type: 'MINING_STATE', value: isMining ? 1 : 0 });

                    const newProsperity = cell.prosperity + prosperityChange;
                    changes.push({ x, y, type: 'PROSPERITY', value: newProsperity });

                    // D. 死亡判定：繁荣度归零则灭绝，能量散逸给周围（不返还地幔）
                    if (newProsperity <= 0) {
                        changes.push({ x, y, type: 'STATE', value: 0 });
                        this.distributeExtinctionBonus(x, y, extinctionBonus);
                        continue;
                    }

                    // E. 扩张（繁荣度达标，概率变异后生成迁徙者或新聚落）
                    if (newProsperity > attrs.expansionThreshold) {
                        const expansionCost = Math.min(newProsperity * 0.5, this.params.bioExpansionCost ?? 30);
                        const settlementAtCapacity = isSettlementAtCapacity(this, x, y, attrs.speciesId);
                        const newAttrs = { ...attrs };
                        let isNewSpecies = false;
                        const keys = [
                            'minTemp', 'maxTemp', 'prosperityGrowth', 'prosperityDecay',
                            'expansionThreshold', 'miningReward', 'migrationThreshold',
                            'civilizationLevel', 'crystalDamageReduction',
                        ];
                        let mutationDrift = 0;

                        for (const key of keys) {
                            if (this.random() < mutationRate) {
                                const val = newAttrs[key];
                                if (typeof val !== 'number') continue;
                                const change = val * mutationStrength * (this.random() > 0.5 ? 1 : -1);
                                newAttrs[key] += change;
                                mutationDrift += Math.abs(change) / Math.max(1, Math.abs(val));
                            }
                        }
                        if (mutationDrift >= newSpeciesThreshold) {
                            isNewSpecies = true;
                        }
                        newAttrs.civilizationLevel = clampRatio(newAttrs.civilizationLevel ?? 0);
                        newAttrs.crystalDamageReduction = clampRatio(
                            newAttrs.crystalDamageReduction ?? getCrystalDamageReduction(this, newAttrs)
                        );

                        if (isNewSpecies) {
                            newAttrs.speciesId = Math.floor(this.random() * 100000) + 1;
                            newAttrs.color = `hsl(${this.random() * 360}, 70%, 50%)`;
                        }

                        // 决策：大概率生成迁徙者（migrantExpansionProb），否则直接扩张为邻近聚落
                        const migrantProbability = settlementAtCapacity ? 1 : (this.params.migrantExpansionProb ?? 0.8);

                        if (this.random() < migrantProbability) {
                            // 生成迁徙者：默认落在当前格；若已有迁徙者则尝试落到空闲邻居
                            let targetX = x;
                            let targetY = y;

                            if (cell.migrant) {
                                const validNeighbors = neighbors.filter(n =>
                                    n.exists &&
                                    !n.migrant &&
                                    canTraverseTerrain(this, cell, n, this.params.terrainMigrationMaxStep)
                                );
                                if (validNeighbors.length > 0) {
                                    const target = validNeighbors[Math.floor(this.random() * validNeighbors.length)];
                                    targetX = target.x;
                                    targetY = target.y;
                                } else {
                                    targetX = -1; // 无处生成，放弃本次扩张
                                }
                            }

                            if (targetX !== -1) {
                                changes.push({
                                    x: targetX, y: targetY, type: 'MIGRANT_ADD',
                                    value: { prosperity: expansionCost, attrs: newAttrs },
                                });
                                changes.push({ x, y, type: 'PROSPERITY', value: newProsperity - expansionCost });
                            }
                        } else {
                            // 生成新聚落：需有空的邻居，否则回退为迁徙者以保持扩张压力
                            const emptyNeighbors = neighbors.filter(n =>
                                n.exists &&
                                n.crystalState === CELL_TYPE.EMPTY &&
                                canSettleWithinLimit(this, n, newAttrs.speciesId) &&
                                canTraverseTerrain(this, cell, n, this.params.terrainExpansionMaxStep)
                            );
                            if (emptyNeighbors.length > 0) {
                                const target = emptyNeighbors[Math.floor(this.random() * emptyNeighbors.length)];
                                changes.push({
                                    x: target.x, y: target.y, type: 'NEW_BIO',
                                    value: { prosperity: expansionCost, attrs: newAttrs },
                                });
                                changes.push({ x, y, type: 'PROSPERITY', value: newProsperity - expansionCost });
                            } else {
                                changes.push({
                                    x, y, type: 'MIGRANT_ADD',
                                    value: { prosperity: expansionCost, attrs: newAttrs },
                                });
                                changes.push({ x, y, type: 'PROSPERITY', value: newProsperity - expansionCost });
                            }
                        }
                    }

                    // F. 迁移转化（聚落 -> 迁徙者）：环境不足以维持聚落时整体转为迁徙者
                    if (newProsperity < attrs.migrationThreshold && newProsperity > 0) {
                        changes.push({ x, y, type: 'STATE', value: 0 }); // 移除聚落实体
                        changes.push({
                            x, y, type: 'MIGRANT_ADD',
                            value: { prosperity: newProsperity, attrs: attrs },
                        });
                    }
                }

                // @section:bio_migrant - 迁徙者：消耗繁荣度移动、择优定居或贪婪寻找宜温邻居

                if (cell.migrant) {
                    const migrant = cell.migrant;
                    const attrs = migrant.attributes;

                    // 迁徙者每步消耗少量繁荣度
                    const newProsperity = migrant.prosperity - 1;

                    if (newProsperity <= 0) {
                        changes.push({ x, y, type: 'MIGRANT_REMOVE' });
                        continue;
                    }

                    // 尝试定居：当前格为空、温度适宜且繁荣度足以维持聚落时才落地
                    const settleMinProsperity = this.params.migrantSettleMinProsperity ??
                        attrs.migrationThreshold ?? 0;
                    if (cell.crystalState === CELL_TYPE.EMPTY &&
                        canSettleWithinLimit(this, cell, attrs.speciesId) &&
                        newProsperity >= settleMinProsperity &&
                        cell.temperature >= attrs.minTemp &&
                        cell.temperature <= attrs.maxTemp) {
                        changes.push({ x, y, type: 'MIGRANT_REMOVE' });
                        changes.push({
                            x, y, type: 'NEW_BIO',
                            value: { prosperity: newProsperity, attrs: attrs },
                        });
                        continue;
                    }

                    // 移动：贪婪选择温度最接近最佳温度的存在邻居
                    const validNeighbors = neighbors.filter(n =>
                        n.exists &&
                        !n.migrant &&
                        canTraverseTerrain(this, cell, n, this.params.terrainMigrationMaxStep)
                    );
                    if (validNeighbors.length > 0) {
                        const bestTemp = (attrs.minTemp + attrs.maxTemp) / 2;
                        let bestNeighbor = validNeighbors[0];
                        let bestScore = Math.abs(bestNeighbor.temperature - bestTemp) +
                            getTerrainMoveCost(this, cell, bestNeighbor) * 2;

                        for (const n of validNeighbors) {
                            const score = Math.abs(n.temperature - bestTemp) +
                                getTerrainMoveCost(this, cell, n) * 2;
                            if (score < bestScore) {
                                bestScore = score;
                                bestNeighbor = n;
                            }
                        }

                        if (bestNeighbor.x !== x || bestNeighbor.y !== y) {
                            changes.push({ x, y, type: 'MIGRANT_REMOVE' });
                            changes.push({
                                x: bestNeighbor.x, y: bestNeighbor.y,
                                type: 'MIGRANT_ADD',
                                value: { prosperity: newProsperity, attrs: attrs },
                            });
                        } else {
                            changes.push({ x, y, type: 'MIGRANT_UPDATE', value: { prosperity: newProsperity } });
                        }
                    } else {
                        changes.push({ x, y, type: 'MIGRANT_UPDATE', value: { prosperity: newProsperity } });
                    }
                }
            }
        }

        // @section:bio_apply_changes - 统一应用收集到的生物层变更

        for (const change of changes) {
            const cell = this.grid[change.y][change.x];

            if (change.type === 'STATE') {
                if (change.value === 0) {
                    cell.crystalState = CELL_TYPE.EMPTY;
                    cell.prosperity = 0;
                    cell.bioAttributes = undefined;
                    cell.isMining = false;
                    cell.betaMiningProgress = 0;
                }
            } else if (change.type === 'PROSPERITY') {
                cell.prosperity = change.value;
            } else if (change.type === 'CIVILIZATION') {
                if (cell.bioAttributes) {
                    cell.bioAttributes.civilizationLevel = getCivilizationLevel(cell.bioAttributes) * change.value;
                }
            } else if (change.type === 'MINING_STATE') {
                cell.isMining = change.value === 1;
            } else if (change.type === 'MINING_PROGRESS') {
                cell.betaMiningProgress = Math.max(0, Math.min(0.999, change.value));
            } else if (change.type === 'NEW_BIO') {
                if (cell.crystalState === CELL_TYPE.EMPTY) {
                    cell.crystalState = CELL_TYPE.BIO;
                    cell.prosperity = change.value.prosperity;
                    cell.bioAttributes = change.value.attrs;
                }
            } else if (change.type === 'MIGRATE') {
                // 遗留类型：新逻辑下不再产生，保留以防御历史数据
                if (cell.crystalState === CELL_TYPE.EMPTY) {
                    cell.crystalState = CELL_TYPE.BIO;
                    cell.prosperity = change.value.prosperity;
                    cell.bioAttributes = change.value.attrs;
                }
            } else if (change.type === 'MIGRANT_ADD') {
                cell.migrant = {
                    prosperity: change.value.prosperity,
                    attributes: change.value.attrs,
                };
            } else if (change.type === 'MIGRANT_UPDATE') {
                if (cell.migrant) {
                    cell.migrant.prosperity = change.value.prosperity;
                }
            } else if (change.type === 'MIGRANT_REMOVE') {
                cell.migrant = null;
            }
        }

        this.updateHumanRespawnPoint();
    },

    /**
     * 灭绝散能：将 bonus 平均分给八邻居，晶石得能量、生物得繁荣度，不返还地幔。
     * @param {number} x
     * @param {number} y
     * @param {number} bonus
     */
    distributeExtinctionBonus(x, y, bonus) {
        const neighbors = this.getNeighbors(x, y);
        if (neighbors.length === 0) return;

        const bonusPerNeighbor = bonus / neighbors.length;

        for (const n of neighbors) {
            if (n.crystalState === CELL_TYPE.ALPHA || n.crystalState === CELL_TYPE.BETA) {
                n.storedEnergy += bonusPerNeighbor;
            } else if (n.crystalState === CELL_TYPE.BIO) {
                n.prosperity += bonusPerNeighbor;
            }
        }
    },
};
