// 世界变迁模拟器 - 可复现随机源
// 供研究脚本和测试注入 seed。默认引擎仍可使用 Math.random。

function hashSeed(seed) {
    const text = String(seed ?? 1);
    let h = 2166136261;
    for (let i = 0; i < text.length; i++) {
        h ^= text.charCodeAt(i);
        h = Math.imul(h, 16777619);
    }
    return h >>> 0;
}

/**
 * 创建一个返回 [0, 1) 的确定性伪随机函数。
 * @param {string|number} seed
 * @returns {() => number}
 */
export function createSeededRandom(seed = 1) {
    let state = hashSeed(seed) || 1;

    return function random() {
        state += 0x6D2B79F5;
        let t = state;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}
