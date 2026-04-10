/**
 * rune_system.js - 符文词条系统核心逻辑
 *
 * 提供 parseRuneGrid(grid, runewordDb) 函数，用于解析 3x3 符文网格，
 * 匹配激活词条并返回合并后的属性加成对象。
 *
 * 变更记录 (Task 1: 数据结构升级)：
 * - 兼容新的对象格式 { id: string, level: number }，同时保持对旧字符串格式的向后兼容
 * - 新增 getRuneId(entry) 辅助函数，统一提取符文 ID
 *
 * 变更记录 (Task 4: 符文合成与重铸逻辑)：
 * - 新增 rune_merge(runeObjects, runeInventory)：三同ID同等级符文合成为高一等级符文
 * - 新增 rune_reforge(runeObjects, runeInventory, game)：任意三符文重铸为新符文
 * - 新增 _removeRuneFromInventory 辅助函数
 */

import { loot_calcRuneDrop } from './loot_system.js';

/**
 * getRuneId - 从网格条目中提取符文 ID（向后兼容辅助函数）
 *
 * @param {string|Object|null} entry - 网格条目，可以是：
 *   - null/undefined: 空格
 *   - string: 旧格式，直接作为 runeId（向后兼容）
 *   - Object { id, level }: 新格式，提取 id 字段
 * @returns {string|null} 符文 ID，若为空则返回 null
 */
function getRuneId(entry) {
    if (entry === null || entry === undefined) return null;
    if (typeof entry === 'string') return entry; // 向后兼容旧格式
    if (typeof entry === 'object' && entry.id) return entry.id; // 新格式
    return null;
}

/**
 * parseRuneGrid - 解析 3x3 符文网格，返回激活词条的合并属性加成
 *
 * @param {Array<string|Object|null>} grid - 长度为 9 的数组，表示 3x3 网格（索引 0~8 对应左上到右下）
 *   支持两种格式：
 *   - 旧格式（向后兼容）: string runeId 或 null
 *   - 新格式: { id: string, level: number } 对象或 null
 *   索引布局：
 *     0 | 1 | 2
 *     3 | 4 | 5
 *     6 | 7 | 8
 * @param {Array<Object>} runewordDb - 词条数据库，每个词条含 id, name, pattern[], stats{}
 * @returns {{ activeStats: Object, activatedRunewords: Array<Object>, activatedCells: Set<number> }}
 *   - activeStats: 所有激活词条的 stats 合并对象，如 { pyro: 3, bounce: 1 }
 *   - activatedRunewords: 激活的词条对象数组
 *   - activatedCells: 参与激活词条的网格格子索引集合（用于高亮显示）
 */
function parseRuneGrid(grid, runewordDb) {
    // 将网格条目统一转换为符文 ID 数组（兼容新旧格式）
    const idGrid = grid.map(entry => getRuneId(entry));

    // 定义 3x3 网格的所有路径（行、列、对角线）
    // 每条路径是格子索引的数组
    const PATHS = [
        // 3 行
        [0, 1, 2],
        [3, 4, 5],
        [6, 7, 8],
        // 3 列
        [0, 3, 6],
        [1, 4, 7],
        [2, 5, 8],
        // 2 条对角线
        [0, 4, 8], // 主对角线（左上到右下）
        [2, 4, 6], // 副对角线（右上到左下）
    ];

    // 提取每条路径上的符文 id 序列（过滤 null）
    const pathSequences = PATHS.map(path => ({
        indices: path,
        runes: path.map(i => idGrid[i]).filter(r => r !== null && r !== undefined),
    }));

    const activatedRunewords = [];
    const activatedCells = new Set();
    const activeStats = {};

    // 遍历每个词条，检查是否有路径匹配
    for (const runeword of runewordDb) {
        const pattern = runeword.pattern;
        if (!pattern || pattern.length === 0) continue;

        // 检查每条路径
        for (const { indices, runes } of pathSequences) {
            if (runes.length < pattern.length) continue;

            // 在路径的符文序列中查找正向或反向匹配
            const matched = findPatternInSequence(runes, pattern, indices, idGrid);
            if (matched) {
                // 避免同一词条重复激活
                if (!activatedRunewords.find(r => r.id === runeword.id)) {
                    activatedRunewords.push(runeword);
                    // 记录参与激活的格子索引
                    matched.forEach(idx => activatedCells.add(idx));
                    // 合并 stats
                    if (runeword.stats) {
                        for (const [key, val] of Object.entries(runeword.stats)) {
                            activeStats[key] = (activeStats[key] || 0) + val;
                        }
                    }
                }
                break; // 一个词条只需激活一次
            }
        }
    }

    return { activeStats, activatedRunewords, activatedCells };
}

/**
 * findPatternInSequence - 在路径的符文序列中查找 pattern（正向或反向）
 *
 * @param {string[]} runes - 路径上过滤后的符文 id 数组
 * @param {string[]} pattern - 词条 pattern 数组
 * @param {number[]} indices - 路径的格子索引数组（与 grid 对应）
 * @param {Array<string|null>} idGrid - 完整的 9 格符文 ID 网格（已统一为字符串格式）
 * @returns {number[]|null} 若匹配成功，返回参与匹配的格子索引数组；否则返回 null
 */
function findPatternInSequence(runes, pattern, indices, idGrid) {
    const patternLen = pattern.length;
    const runesLen = runes.length;

    // 构建路径上所有格子（含 null）的索引序列，用于精确定位
    // indices 是路径上所有格子的索引（包含 null 格）
    // 我们需要在 indices 中找到连续的非 null 格子序列匹配 pattern

    // 策略：在 indices 数组中，找到一个子序列（连续索引），
    // 其对应的非 null 符文恰好等于 pattern（正向或反向）

    // 枚举所有可能的起始位置
    for (let start = 0; start <= indices.length - patternLen; start++) {
        // 提取从 start 开始的 patternLen 个格子
        const slice = indices.slice(start, start + patternLen);
        const sliceRunes = slice.map(i => idGrid[i]);

        // 正向匹配：slice 中的符文（忽略 null）与 pattern 完全一致
        if (sequenceMatchesPattern(sliceRunes, pattern)) {
            return slice;
        }
        // 反向匹配：slice 中的符文（忽略 null）与 pattern 反转后完全一致
        if (sequenceMatchesPattern(sliceRunes, [...pattern].reverse())) {
            return slice;
        }
    }

    return null;
}

/**
 * sequenceMatchesPattern - 检查格子序列（含 null）是否与 pattern 完全匹配
 *
 * 规则：过滤掉 null 后，剩余符文与 pattern 完全相同（顺序一致，数量相等）
 *
 * @param {Array<string|null>} sliceRunes - 格子序列中的符文（可含 null，已统一为字符串格式）
 * @param {string[]} pattern - 目标 pattern
 * @returns {boolean}
 */
function sequenceMatchesPattern(sliceRunes, pattern) {
    const filtered = sliceRunes.filter(r => r !== null && r !== undefined);
    if (filtered.length !== pattern.length) return false;
    return filtered.every((r, i) => r === pattern[i]);
}

// ==================== 符文合成与重铸系统 ====================

/**
 * _removeRuneFromInventory - 从 runeInventory 中移除一个符文对象（精确匹配 id 和 level）
 *
 * 每次调用只移除一个匹配项（防止一次性移除多个相同符文）。
 *
 * @param {Array<{id: string, level: number}>} runeInventory - 符文背包数组
 * @param {{ id: string, level: number }} runeObj - 要移除的符文对象
 * @returns {boolean} 是否成功移除
 */
function _removeRuneFromInventory(runeInventory, runeObj) {
    const idx = runeInventory.findIndex(r => r.id === runeObj.id && r.level === runeObj.level);
    if (idx === -1) return false;
    runeInventory.splice(idx, 1);
    return true;
}

/**
 * rune_merge - 符文合成：三个同 ID、同等级的符文合成为高一等级的同名符文
 *
 * 规则（来自设计文档 §4.1）：
 *   Rune A (Lv X) × 3  =>  Rune A (Lv X+1)
 *
 * @param {Array<{id: string, level: number}>} runeObjects - 三个符文对象数组
 * @param {Array<{id: string, level: number}>} runeInventory - 符文背包（会被原地修改）
 * @returns {{
 *   success: boolean,
 *   result: {id: string, level: number}|null,
 *   error: string|null
 * }}
 *   - success: 合成是否成功
 *   - result: 合成产出的新符文对象（成功时）
 *   - error: 失败原因描述（失败时）
 */
function rune_merge(runeObjects, runeInventory) {
    // ---- 输入校验 ----
    if (!Array.isArray(runeObjects) || runeObjects.length !== 3) {
        return { success: false, result: null, error: '合成需要恰好 3 个符文对象' };
    }

    const [runeA, runeB, runeC] = runeObjects;

    // 校验三个符文的 id 必须相同
    if (runeA.id !== runeB.id || runeA.id !== runeC.id) {
        return {
            success: false,
            result: null,
            error: `合成失败：三个符文的 id 必须相同（当前：${runeA.id}, ${runeB.id}, ${runeC.id}）`
        };
    }

    // 校验三个符文的 level 必须相同
    if (runeA.level !== runeB.level || runeA.level !== runeC.level) {
        return {
            success: false,
            result: null,
            error: `合成失败：三个符文的 level 必须相同（当前：${runeA.level}, ${runeB.level}, ${runeC.level}）`
        };
    }

    const sharedId = runeA.id;
    const sharedLevel = runeA.level;

    // ---- 预检：确认背包中有足够数量的符文（原子性保障）----
    // 统计背包中 id 和 level 均匹配的符文数量
    const matchCount = runeInventory.filter(r => r.id === sharedId && r.level === sharedLevel).length;
    if (matchCount < 3) {
        return {
            success: false,
            result: null,
            error: '合成失败：背包中不存在足够数量的目标符文'
        };
    }

    // ---- 从背包移除三个符文 ----
    [runeA, runeB, runeC].forEach(rune => _removeRuneFromInventory(runeInventory, rune));

    // ---- 生成合成结果 ----
    const mergedRune = { id: sharedId, level: sharedLevel + 1 };
    runeInventory.push(mergedRune);

    return { success: true, result: mergedRune, error: null };
}

/**
 * rune_reforge - 符文重铸：任意三个符文重铸为一个全新的随机符文
 *
 * 规则（来自设计文档 §4.2）：
 *   - 等级计算：newLevel = Math.max(1, Math.floor((lvA + lvB + lvC) / 3))
 *   - 种类选择：调用 loot_calcRuneDrop(game) 智能掉落算法获取新符文 ID
 *
 * @param {Array<{id: string, level: number}>} runeObjects - 三个符文对象数组（任意组合）
 * @param {Array<{id: string, level: number}>} runeInventory - 符文背包（会被原地修改）
 * @param {Object} game - Game 实例（传递给 loot_calcRuneDrop 用于智能掉落计算）
 * @returns {{
 *   success: boolean,
 *   result: {id: string, level: number}|null,
 *   error: string|null
 * }}
 *   - success: 重铸是否成功
 *   - result: 重铸产出的新符文对象（成功时）
 *   - error: 失败原因描述（失败时）
 */
function rune_reforge(runeObjects, runeInventory, game) {
    // ---- 输入校验 ----
    if (!Array.isArray(runeObjects) || runeObjects.length !== 3) {
        return { success: false, result: null, error: '重铸需要恰好 3 个符文对象' };
    }

    const [runeA, runeB, runeC] = runeObjects;

    // ---- 计算新等级 ----
    const lvA = runeA.level;
    const lvB = runeB.level;
    const lvC = runeC.level;
    const newLevel = Math.max(1, Math.floor((lvA + lvB + lvC) / 3));

    // ---- 调用智能掉落算法获取新符文 ID ----
    const newId = loot_calcRuneDrop(game);
    if (!newId) {
        return {
            success: false,
            result: null,
            error: '重铸失败：loot_calcRuneDrop 未能返回有效的符文 ID'
        };
    }

    // ---- 预检：确认背包中有足够数量的符文（原子性保障）----
    // 对每个输入符文逐一检查背包中是否存在匹配项（考虑重复符文的情况）
    const inventoryCopy = [...runeInventory];
    const allPresent = [runeA, runeB, runeC].every(rune => {
        const idx = inventoryCopy.findIndex(r => r.id === rune.id && r.level === rune.level);
        if (idx === -1) return false;
        inventoryCopy.splice(idx, 1); // 临时移除，避免重复计数
        return true;
    });
    if (!allPresent) {
        return {
            success: false,
            result: null,
            error: '重铸失败：背包中不存在足够数量的目标符文'
        };
    }

    // ---- 从背包移除三个符文 ----
    [runeA, runeB, runeC].forEach(rune => _removeRuneFromInventory(runeInventory, rune));

    // ---- 生成重铸结果 ----
    const reforgedRune = { id: newId, level: newLevel };
    runeInventory.push(reforgedRune);

    return { success: true, result: reforgedRune, error: null };
}

export { parseRuneGrid, getRuneId, rune_merge, rune_reforge };
