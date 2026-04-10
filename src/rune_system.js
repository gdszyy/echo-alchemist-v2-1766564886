/**
 * rune_system.js - 符文词条系统核心逻辑
 *
 * 提供以下函数：
 * - parseRuneGrid(grid, runewordDb): 解析 3x3 符文网格，匹配激活词条并返回合并后的属性加成对象
 * - calcRuneBaseStats(runeGrid, runeDb): 遍历网格，根据每个符文的 baseStat 和 level 累加基础属性层数
 */

/**
 * parseRuneGrid - 解析 3x3 符文网格，返回激活词条的合并属性加成
 *
 * @param {Array<string|Object|null>} grid - 长度为 9 的数组，表示 3x3 网格（索引 0~8 对应左上到右下）
 *   每个元素可以是：
 *   - string: 符文 ID（旧格式，兼容）
 *   - { id: string, level: number }: 符文对象（新格式，含等级）
 *   - null: 空格
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

    // 辅助函数：从网格元素中提取符文 ID（兼容字符串和对象两种格式）
    const getRuneId = (cell) => {
        if (cell === null || cell === undefined) return null;
        if (typeof cell === 'string') return cell;
        if (typeof cell === 'object' && cell.id) return cell.id;
        return null;
    };

    // 构建 ID 网格（用于词条匹配）
    const idGrid = grid.map(getRuneId);

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
 * calcRuneBaseStats - 计算网格中所有符文的基础属性层数加成
 *
 * 遍历 runeGrid（9个格子），根据每个符文的 baseStat 字段和 level 值，
 * 累加属性层数，返回基础属性加成对象。
 *
 * 兼容两种网格格式：
 * - 字符串格式（旧）: 'rune_pyro_1' → level 默认为 1
 * - 对象格式（新）: { id: 'rune_pyro_1', level: 2 } → level 为对象中的值
 *
 * @param {Array<string|Object|null>} runeGrid - 长度为 9 的符文网格数组
 * @param {Array<Object>} runeDb - 符文数据库（RUNE_DB），每个符文含 id, baseStat 字段
 * @returns {Object} 基础属性加成对象，如 { pyro: 3, bounce: 2 }
 *
 * @example
 * // 网格中有一个 Level 2 的烈焰符文和一个 Level 1 的弹跃符文
 * calcRuneBaseStats(
 *   ['rune_pyro_1', null, null, null, null, null, null, null, { id: 'rune_bounce_1', level: 1 }],
 *   RUNE_DB
 * )
 * // 返回: { pyro: 1, bounce: 1 }  （字符串格式默认 level=1）
 */
function calcRuneBaseStats(runeGrid, runeDb) {
    const baseStats = {};

    for (let i = 0; i < runeGrid.length; i++) {
        const cell = runeGrid[i];
        if (cell === null || cell === undefined) continue;

        // 提取符文 ID 和等级（兼容字符串和对象两种格式）
        let runeId, level;
        if (typeof cell === 'string') {
            runeId = cell;
            level = 1; // 字符串格式默认等级为 1
        } else if (typeof cell === 'object' && cell.id) {
            runeId = cell.id;
            level = (typeof cell.level === 'number' && cell.level > 0) ? cell.level : 1;
        } else {
            continue; // 无效格子，跳过
        }

        // 在 RUNE_DB 中查找对应符文定义
        const runeDef = runeDb.find(r => r.id === runeId);
        if (!runeDef) continue;

        // 获取 baseStat 字段（优先使用 baseStat，回退到 element）
        const statKey = runeDef.baseStat || runeDef.element;
        if (!statKey) continue;

        // 累加属性层数
        baseStats[statKey] = (baseStats[statKey] || 0) + level;
    }

    return baseStats;
}

/**
 * findPatternInSequence - 在路径的符文序列中查找 pattern（正向或反向）
 *
 * @param {string[]} runes - 路径上过滤后的符文 id 数组
 * @param {string[]} pattern - 词条 pattern 数组
 * @param {number[]} indices - 路径的格子索引数组（与 grid 对应）
 * @param {Array<string|null>} grid - 完整的 9 格网格（ID 格式）
 * @returns {number[]|null} 若匹配成功，返回参与匹配的格子索引数组；否则返回 null
 */
function findPatternInSequence(runes, pattern, indices, grid) {
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
        const sliceRunes = slice.map(i => grid[i]);

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
 * @param {Array<string|null>} sliceRunes - 格子序列中的符文（可含 null）
 * @param {string[]} pattern - 目标 pattern
 * @returns {boolean}
 */
function sequenceMatchesPattern(sliceRunes, pattern) {
    const filtered = sliceRunes.filter(r => r !== null && r !== undefined);
    if (filtered.length !== pattern.length) return false;
    return filtered.every((r, i) => r === pattern[i]);
}

export { parseRuneGrid, calcRuneBaseStats };
