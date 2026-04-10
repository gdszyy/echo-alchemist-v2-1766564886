/**
 * rune_system.js - 符文词条系统核心逻辑
 *
 * 提供 parseRuneGrid(grid, runewordDb) 函数，用于解析 3x3 符文网格，
 * 匹配激活词条并返回合并后的属性加成对象。
 *
 * 变更记录 (Task 1: 数据结构升级)：
 * - 兼容新的对象格式 { id: string, level: number }，同时保持对旧字符串格式的向后兼容
 * - 新增 getRuneId(entry) 辅助函数，统一提取符文 ID
 */

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

export { parseRuneGrid, getRuneId };
