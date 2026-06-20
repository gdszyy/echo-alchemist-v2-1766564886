// 世界变迁模拟器 - 初始自然地形生成器
// 负责把 seed 噪声转换成丰富初始地势；后续地质演化由 mantle_layer 维护。

import { generatePerlinNoise } from './perlin.js';

function clamp01(value) {
    return Math.max(0, Math.min(1, value));
}

/**
 * 生成单格初始地势高度。该函数只依赖坐标、半径与 seed 噪声偏移，保证同 seed 可复现。
 * 多尺度噪声分别负责高原/低地、山脊、盆地口袋与谷地切割。
 * @param {{x:number,y:number,dist:number,initialRadius:number,noiseOffsetX:number,noiseOffsetY:number}} input
 * @returns {number}
 */
export function generateInitialTerrainElevation(input) {
    const { x, y, dist, initialRadius, noiseOffsetX, noiseOffsetY } = input;
    const broadHighlands = generatePerlinNoise(
        x * 0.07 + noiseOffsetX * 0.43,
        y * 0.07 + noiseOffsetY * 0.43,
        0
    );
    const regionalRelief = generatePerlinNoise(
        x * 0.15 + noiseOffsetX * 0.67,
        y * 0.15 + noiseOffsetY * 0.67,
        5
    );
    const localRoughness = generatePerlinNoise(
        x * 0.38 + noiseOffsetY * 0.29,
        y * 0.38 + noiseOffsetX * 0.29,
        11
    );
    const ridgeRaw = generatePerlinNoise(
        x * 0.21 + noiseOffsetY * 0.37,
        y * 0.21 + noiseOffsetX * 0.37,
        17
    );
    const basinRaw = generatePerlinNoise(
        x * 0.11 + noiseOffsetX * 0.19,
        y * 0.11 + noiseOffsetY * 0.19,
        23
    );
    const valleyRaw = generatePerlinNoise(
        x * 0.18 + noiseOffsetY * 0.51,
        y * 0.18 + noiseOffsetX * 0.51,
        31
    );

    const radial = dist / initialRadius;
    const ridgeLines = Math.max(0, 0.24 - Math.abs(ridgeRaw)) * 0.95;
    const basinPockets = Math.max(0, basinRaw - 0.18) * 0.48;
    const plateauMass = Math.max(0, -basinRaw - 0.14) * 0.34;
    const valleyCuts = Math.max(0, 0.17 - Math.abs(valleyRaw)) * 0.42;

    return clamp01(
        0.54 - radial * 0.1 +
        broadHighlands * 0.26 +
        regionalRelief * 0.16 +
        localRoughness * 0.05 +
        ridgeLines +
        plateauMass -
        basinPockets -
        valleyCuts
    );
}
