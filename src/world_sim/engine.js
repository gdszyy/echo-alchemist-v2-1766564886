// 世界变迁模拟器 - 模拟引擎主类（SimulationEngine）
// 移植自 world-morphing-simulator/client/src/lib/simulation/engine.ts（SimulationEngine 类骨架）
// 纯数据处理模块：不依赖 DOM / Canvas / 任何渲染或 UI。可视化层只「拉取」grid 数据，引擎从不「推送」。
//
// 架构：四层演化逻辑（地幔/气候/晶石/生物）、晶石灾害辅助层与生物投放各自维护为对象字面量，
// 在构造时通过 bind(this) 注入为实例方法，与 Echo Game 主类一致的「组合优于继承」模式。

import { DEFAULT_PARAMS } from './params.js';
import { createCell, CELL_TYPE } from './cell.js';
import { generateInitialTerrainElevation } from './terrain_generator.js';
import { mantle_layer } from './mantle_layer.js';
import { climate_layer } from './climate_layer.js';
import { crystal_layer } from './crystal_layer.js';
import { crystal_disaster } from './crystal_disaster.js';
import { human_energy } from './human_energy.js';
import { terrain_detectors } from './terrain_detectors.js';
import { bio_layer } from './bio_layer.js';
import { bio_spawn } from './bio_spawn.js';
import { createSeededRandom } from './rng.js';

export class SimulationEngine {
    /**
     * @param {number} width  网格宽度
     * @param {number} height 网格高度
     * @param {import('./params.js').SimulationParams} [params] 模拟参数，默认 DEFAULT_PARAMS
     * @param {{seed?: string|number, random?: () => number}} [options] 可选随机源，研究/测试用
     */
    constructor(width, height, params = DEFAULT_PARAMS, options = {}) {
        this.width = width;
        this.height = height;
        this.params = params;
        this.random = typeof options.random === 'function'
            ? options.random
            : options.seed !== undefined
                ? createSeededRandom(options.seed)
                : Math.random;
        this.timeStep = 0;
        this.cycleCount = 0;

        this.noiseOffsetX = this.random() * 1000;
        this.noiseOffsetY = this.random() * 1000;

        // 生物重生控制
        /** @type {number|null} */
        this.bioExtinctionStep = null;
        this.isFirstSpawn = true;
        this.humanEnergyBases = [];
        this.humanRespawnPoint = null;
        this.initialAlphaSeeded = false;

        // 组合模式：将各层方法绑定到实例（与 Echo Game 主类一致，this 指向引擎实例）
        const _subsystems = [
            mantle_layer, human_energy, terrain_detectors,
            climate_layer, crystal_layer, crystal_disaster, bio_layer, bio_spawn,
        ];
        for (const subsystem of _subsystems) {
            for (const [key, val] of Object.entries(subsystem)) {
                if (typeof val === 'function') {
                    this[key] = val.bind(this);
                }
            }
        }

        // 均匀分布边缘供给点
        const count = params.edgeSupplyPointCount || 3;
        const baseSpeed = params.edgeSupplyPointSpeed || 0.05;
        this.edgeSupplyPoints = Array(count).fill(0).map((_, i) => ({
            angle: (i / count) * Math.PI * 2, // 均匀分布角度
            speed: baseSpeed, // 基础旋转速度
            phase: this.random() * Math.PI * 2, // 随机相位
            frequency: 0.5 + this.random() * 1.5, // 随机频率
        }));

        this.grid = this.initializeGrid();
        if ((this.params.initialAlphaDelaySteps ?? 120) <= 0) {
            this.seedInitialAlpha();
        }
        this.seedInitialBiosphere();
        this.updateHumanRespawnPoint();
    }

    /**
     * 初始化网格：以中心为圆心、半径 min(w,h)*0.4 的圆内为陆地；
     * 初始 Alpha 默认延迟播种，避免地幔能量尚未抵达中心时过早杀死生物。
     * @returns {import('./cell.js').Cell[][]}
     */
    initializeGrid() {
        const grid = [];
        const centerX = this.width / 2;
        const centerY = this.height / 2;

        for (let y = 0; y < this.height; y++) {
            const row = [];
            for (let x = 0; x < this.width; x++) {
                const dist = Math.sqrt((x - centerX) ** 2 + (y - centerY) ** 2);
                const initialRadius = Math.min(this.width, this.height) * 0.4;
                const exists = dist < initialRadius;

                const initialElevation = exists
                    ? Math.max(0.05, Math.min(0.95, generateInitialTerrainElevation({
                        x, y, dist, initialRadius,
                        noiseOffsetX: this.noiseOffsetX,
                        noiseOffsetY: this.noiseOffsetY,
                    })))
                    : 0;

                row.push(createCell(x, y, {
                    exists,
                    mantleEnergy: exists ? 50 + this.random() * 20 : 0,
                    crystalState: CELL_TYPE.EMPTY,
                    terrainElevation: initialElevation,
                }));
            }
            grid.push(row);
        }
        return grid;
    }

    /**
     * 播种初始中心 Alpha 晶石。仅写入空地，避免覆盖已建立的生物聚落。
     */
    seedInitialAlpha() {
        if (this.initialAlphaSeeded) return;

        const centerX = this.width / 2;
        const centerY = this.height / 2;
        const radius = this.params.initialAlphaRadius ?? 3;
        for (let y = 0; y < this.height; y++) {
            for (let x = 0; x < this.width; x++) {
                const cell = this.grid[y][x];
                if (!cell.exists || cell.crystalState !== CELL_TYPE.EMPTY) continue;
                const dist = Math.sqrt((x - centerX) ** 2 + (y - centerY) ** 2);
                if (dist < radius) {
                    cell.crystalState = CELL_TYPE.ALPHA;
                    cell.storedEnergy = Math.max(cell.storedEnergy ?? 0, 10);
                    cell.isAbsorbing = false;
                }
            }
        }
        this.initialAlphaSeeded = true;
    }

    /**
     * 推进一个模拟步：按 地幔 → 气候 → 晶石 → 生物 顺序更新四层。
     * 每 1000 步累加一次 cycleCount（世代计数）。
     */
    update() {
        this.timeStep++;
        if (this.timeStep % 1000 === 0) {
            this.cycleCount++;
        }

        this.beginHumanEnergyTick();
        this.updateMantleLayer();
        this.updateHumanEnergyBases();
        this.updateClimateLayer();
        if (!this.initialAlphaSeeded && this.timeStep >= (this.params.initialAlphaDelaySteps ?? 120)) {
            this.seedInitialAlpha();
        }
        this.updateCrystalLayer();
        this.updateBioLayer();
    }

    /**
     * 取 (x,y) 的八邻居。默认仅返回 exists 的地块；includeVoid=true 时连虚空也返回。
     * @param {number} x
     * @param {number} y
     * @param {boolean} [includeVoid=false]
     * @returns {import('./cell.js').Cell[]}
     */
    getNeighbors(x, y, includeVoid = false) {
        const neighbors = [];
        const dirs = [
            [-1, -1], [0, -1], [1, -1],
            [-1, 0], [1, 0],
            [-1, 1], [0, 1], [1, 1],
        ];

        for (const [dx, dy] of dirs) {
            const nx = x + dx;
            const ny = y + dy;

            if (nx >= 0 && nx < this.width && ny >= 0 && ny < this.height) {
                const cell = this.grid[ny][nx];
                if (includeVoid || cell.exists) {
                    neighbors.push(cell);
                }
            }
        }

        return neighbors;
    }
}
