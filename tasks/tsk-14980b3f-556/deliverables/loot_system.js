/**
 * loot_system.js - 符文智能掉落权重计算系统
 *
 * 职责：
 * - 实现三层智能掉落权重计算逻辑
 * - 第一层：玩家套路成分识别（分析近几回合伤害历史）
 * - 第二层：克制关系映射（将套路成分向量映射为敌人标签权重池）
 * - 第三层：符文关联与抽取（基于权重池对 RUNE_DB 进行加权随机抽取）
 *
 * 导出：
 * - loot_calcRuneDrop(game, overrideOptions): 计算并返回应掉落的符文结果对象
 *
 * 变更记录 (Boss 符文掉落系统):
 * - 新增 overrideOptions 参数支持：
 *   - forcedLevel: 强制指定掉落等级（如 2），覆盖默认的 level: 1
 *   - themeWeights: 注入额外的标签权重（如 { pyro: 3.0, laser: 3.0 }），
 *     在第二层计算完成后叠加，放大 Boss 主题相关符文的掉落概率
 */

import { RUNE_DB, COUNTER_MAP } from './rune_config.js';

// ==================== 常量配置 ====================

/**
 * 智能掉落乘数：亲和标签权重的放大系数
 * 越高则智能掉落效果越明显，符文掉落越贴合玩家套路
 */
const SMART_DROP_MULTIPLIER = 3.0;

/**
 * 历史回合窗口大小：用于移动平均平滑处理
 * 取最近 N 回合的伤害数据进行分析
 */
const HISTORY_WINDOW = 5;

/**
 * Boss 主题权重注入乘数：themeWeights 的放大系数
 * 控制 Boss 主题符文相对于智能掉落的优先级
 */
const BOSS_THEME_MULTIPLIER = 4.0;

// ==================== 第一层：玩家套路成分识别 ====================

/**
 * 从单个 byAttr 对象中提取各属性的总伤害量
 * byAttr 格式：{ attrType: { sourceType: amount, ... }, ... }
 *
 * @param {Object} byAttr - 单回合按属性分类的伤害数据
 * @returns {Object} 各属性的总伤害量，格式 { attrType: totalDamage }
 */
function _extractAttrDamage(byAttr) {
    const result = {};
    if (!byAttr || typeof byAttr !== 'object') return result;

    for (const attrType of Object.keys(byAttr)) {
        const sources = byAttr[attrType];
        if (sources && typeof sources === 'object') {
            let total = 0;
            for (const sourceType of Object.keys(sources)) {
                total += sources[sourceType] || 0;
            }
            if (total > 0) {
                result[attrType] = (result[attrType] || 0) + total;
            }
        }
    }
    return result;
}

/**
 * 第一层：玩家套路成分识别
 *
 * 优先读取 game.roundDamageHistory（近 HISTORY_WINDOW 回合的历史伤害），
 * 将各属性伤害量转化为百分比，得到套路成分向量 buildVector。
 * 若历史数据不足，则使用 game.currentShotDamageByAttr 作为备用。
 *
 * @param {Object} game - Game 实例
 * @returns {Object} 套路成分向量，格式 { attrType: percentage }，所有值之和为 1.0
 */
function _calcBuildVector(game) {
    const attrTotals = {};

    // 优先使用历史回合数据（移动平均）
    const history = game.roundDamageHistory;
    if (history && history.length > 0) {
        // 取最近 HISTORY_WINDOW 回合
        const recentHistory = history.slice(-HISTORY_WINDOW);

        for (const roundRecord of recentHistory) {
            // roundRecord.shots 是该回合所有子弹的数组
            if (roundRecord.shots && Array.isArray(roundRecord.shots)) {
                for (const shot of roundRecord.shots) {
                    if (shot.byAttr) {
                        const shotAttrDamage = _extractAttrDamage(shot.byAttr);
                        for (const [attr, dmg] of Object.entries(shotAttrDamage)) {
                            attrTotals[attr] = (attrTotals[attr] || 0) + dmg;
                        }
                    }
                }
            }
        }
    }

    // 若历史数据不足，使用当前回合实时数据作为备用
    const totalFromHistory = Object.values(attrTotals).reduce((a, b) => a + b, 0);
    if (totalFromHistory === 0 && game.currentShotDamageByAttr) {
        const currentAttrDamage = _extractAttrDamage(game.currentShotDamageByAttr);
        for (const [attr, dmg] of Object.entries(currentAttrDamage)) {
            attrTotals[attr] = (attrTotals[attr] || 0) + dmg;
        }
    }

    // 将伤害量转化为百分比（归一化）
    const grandTotal = Object.values(attrTotals).reduce((a, b) => a + b, 0);
    if (grandTotal === 0) {
        // 无任何伤害数据时，返回空向量（后续将使用纯基础权重）
        return {};
    }

    const buildVector = {};
    for (const [attr, dmg] of Object.entries(attrTotals)) {
        buildVector[attr] = dmg / grandTotal;
    }

    return buildVector;
}

// ==================== 第二层：克制关系映射 ====================

/**
 * 第二层：克制关系映射
 *
 * 将套路成分向量 buildVector 与 COUNTER_MAP 相乘叠加，
 * 得到标签权重池 tagWeights，并进行归一化处理。
 *
 * 计算公式：
 *   tagWeights[tag] += buildVector[attr] * COUNTER_MAP[attr][tag]
 *
 * @param {Object} buildVector - 套路成分向量 { attrType: percentage }
 * @returns {Object} 归一化后的标签权重池 { tag: normalizedWeight }
 */
function _calcTagWeights(buildVector) {
    const tagWeights = {};

    // 遍历套路成分向量中的每种属性
    for (const [attr, attrWeight] of Object.entries(buildVector)) {
        // 查找该属性在 COUNTER_MAP 中的克制关系
        const counterEntry = COUNTER_MAP[attr];
        if (!counterEntry) continue;

        // 将克制关系权重叠加到标签权重池
        for (const [tag, counterWeight] of Object.entries(counterEntry)) {
            tagWeights[tag] = (tagWeights[tag] || 0) + attrWeight * counterWeight;
        }
    }

    // 归一化标签权重池
    const totalTagWeight = Object.values(tagWeights).reduce((a, b) => a + b, 0);
    if (totalTagWeight > 0) {
        for (const tag of Object.keys(tagWeights)) {
            tagWeights[tag] /= totalTagWeight;
        }
    }

    return tagWeights;
}

// ==================== 第三层：符文关联与抽取 ====================

/**
 * 加权随机算法（Weighted Random Choice）
 *
 * 根据各候选项的权重，随机抽取一个候选项。
 *
 * @param {Array<{id: string, weight: number}>} candidates - 候选项数组
 * @returns {string|null} 被抽中的候选项 id，若候选项为空则返回 null
 */
function _weightedRandomChoice(candidates) {
    if (!candidates || candidates.length === 0) return null;

    const totalWeight = candidates.reduce((sum, c) => sum + c.weight, 0);
    if (totalWeight <= 0) {
        // 所有权重均为 0，退化为均匀随机
        return candidates[Math.floor(Math.random() * candidates.length)].id;
    }

    let rand = Math.random() * totalWeight;
    for (const candidate of candidates) {
        rand -= candidate.weight;
        if (rand <= 0) {
            return candidate.id;
        }
    }

    // 浮点误差兜底：返回最后一个候选项
    return candidates[candidates.length - 1].id;
}

/**
 * 第三层：符文关联与抽取
 *
 * 遍历 RUNE_DB，计算每个符文的最终权重：
 *   finalWeight = baseDropWeight
 *               + sum(affinity_tags 在 tagWeights 中的值) * SMART_DROP_MULTIPLIER
 *               + sum(affinity_tags 在 themeWeights 中的值) * BOSS_THEME_MULTIPLIER（可选）
 *
 * 使用加权随机算法抽取最终掉落的符文 id。
 *
 * @param {Object} tagWeights - 归一化后的标签权重池 { tag: normalizedWeight }
 * @param {Object} [themeWeights={}] - Boss 主题额外权重注入 { elementKey: bonusWeight }
 * @returns {string} 被抽中的符文 id
 */
function _selectRuneByWeight(tagWeights, themeWeights = {}) {
    const candidates = RUNE_DB.map(rune => {
        // 计算亲和标签在权重池中的累计贡献（智能掉落）
        let affinityBonus = 0;
        if (rune.affinity_tags && Array.isArray(rune.affinity_tags)) {
            for (const tag of rune.affinity_tags) {
                affinityBonus += tagWeights[tag] || 0;
            }
        }

        // 计算 Boss 主题权重注入贡献（按符文 element 匹配 themeWeights 键）
        let themeBonus = 0;
        if (rune.element && themeWeights[rune.element]) {
            themeBonus = themeWeights[rune.element] * BOSS_THEME_MULTIPLIER;
        }

        // 最终权重 = 基础掉落权重 + 亲和标签贡献 * 智能掉落乘数 + Boss 主题贡献
        const finalWeight = (rune.baseDropWeight || 1)
            + affinityBonus * SMART_DROP_MULTIPLIER
            + themeBonus;

        return {
            id: rune.id,
            weight: Math.max(0, finalWeight) // 确保权重非负
        };
    });

    return _weightedRandomChoice(candidates);
}

// ==================== 主函数：智能掉落权重计算 ====================

/**
 * loot_calcRuneDrop - 计算并返回应掉落的符文结果对象
 *
 * 三层逻辑：
 * 1. 玩家套路成分识别：分析近几回合伤害历史，得到套路成分向量
 * 2. 克制关系映射：将套路向量映射为敌人标签权重池（归一化）
 * 3. 符文关联与抽取：基于权重池对 RUNE_DB 进行加权随机抽取
 *
 * @param {Object} game - Game 实例，需包含以下属性：
 *   - game.roundDamageHistory: 历史回合伤害数据数组
 *   - game.currentShotDamageByAttr: 当前回合实时伤害数据（备用）
 * @param {Object} [overrideOptions={}] - 可选覆盖参数（用于 Boss 特殊掉落）：
 *   - forcedLevel {number}: 强制指定掉落等级（如 2），覆盖默认的 level: 1
 *   - themeWeights {Object}: 注入额外的 Boss 主题标签权重（如 { pyro: 3.0, laser: 3.0 }），
 *     按符文 element 字段匹配，放大对应属性符文的掉落概率
 * @returns {{ runeId: string|null, level: number }} 掉落结果对象
 *   - runeId: 被抽中的符文 id（对应 RUNE_DB 中的 id），抽取失败时为 null
 *   - level: 掉落等级（默认 1，或由 forcedLevel 指定）
 */
function loot_calcRuneDrop(game, overrideOptions = {}) {
    const { forcedLevel, themeWeights } = overrideOptions;

    // 第一层：玩家套路成分识别
    const buildVector = _calcBuildVector(game);

    // 第二层：克制关系映射
    const tagWeights = _calcTagWeights(buildVector);

    // 第三层：符文关联与抽取（注入 Boss 主题权重）
    const runeId = _selectRuneByWeight(tagWeights, themeWeights || {});

    // 确定掉落等级：优先使用 forcedLevel，否则默认 1
    const level = (typeof forcedLevel === 'number' && forcedLevel >= 1)
        ? forcedLevel
        : 1;

    return { runeId, level };
}

// ==================== 导出 ====================
export { loot_calcRuneDrop };
