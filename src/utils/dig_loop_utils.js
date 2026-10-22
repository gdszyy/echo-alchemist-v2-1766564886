/**
 * dig_loop_utils.js - [REQ-20261022-wave-loop · S1] 挖 → 守 循环的纯函数工具。
 *
 * 设计依据：docs/design/dig_build_defend_loop_v1.md §3（时间口径）、§5.1（主炮）、§5.3（炼成弹）、§6（挖掘）。
 * 约束：本文件不得 import 任何大文件（config.js / game_*.js 等），保证 node 可直接导入做单测；
 *       调用方负责把 CONFIG 中的数值作为参数传入。
 */

import { findActiveBoss } from './boss_schedule_utils.js';

/** calc_compileCollectionToRecipe 对这三类属性按「条目数」+1，而不是按 level 累加。 */
const COUNT_STACKED_TYPES = new Set(['bounce', 'pierce', 'scatter']);

function _itemType(item) {
    if (typeof item === 'string') return item;
    return item && typeof item.type === 'string' ? item.type : null;
}

function _itemLevel(item) {
    if (typeof item === 'string') return 1;
    const level = Math.floor(Number(item && item.level) || 1);
    return Math.max(1, level);
}

/**
 * 炼成弹封顶：最多 maxTypes 种属性（按首次拾取顺序），每种最多 maxLevel 级。
 * 输出的 items 可直接喂给 calc_compileCollectionToRecipe：
 *   - bounce / pierce / scatter：编译器按条目 +1，所以输出 level 份 { type, level: 1 }；
 *   - 其他属性：输出 1 条 { type, level }。
 * @param {Array<string|{type:string, level?:number}>} list - 炼成弹珠的拾取列表
 * @param {number} [maxTypes=3]
 * @param {number} [maxLevel=3]
 * @returns {{ items: Array<{type:string, level:number}>, groups: Array<{type:string, level:number}>, totalLevels: number }}
 */
export function capAlchemyCollection(list, maxTypes = 3, maxLevel = 3) {
    const typeCap = Math.max(0, Math.floor(Number(maxTypes) || 0));
    const levelCap = Math.max(1, Math.floor(Number(maxLevel) || 1));
    const order = [];
    const levels = new Map();
    for (const item of Array.isArray(list) ? list : []) {
        if (item && typeof item === 'object' && item.source === 'rune_slot') continue;
        const type = _itemType(item);
        if (!type) continue;
        if (!levels.has(type)) {
            if (order.length >= typeCap) continue;
            order.push(type);
            levels.set(type, 0);
        }
        levels.set(type, Math.min(levelCap, levels.get(type) + _itemLevel(item)));
    }

    const groups = order.map(type => ({ type, level: levels.get(type) }));
    const items = [];
    for (const group of groups) {
        if (COUNT_STACKED_TYPES.has(group.type)) {
            for (let i = 0; i < group.level; i++) items.push({ type: group.type, level: 1 });
        } else {
            items.push({ type: group.type, level: group.level });
        }
    }
    const totalLevels = groups.reduce((sum, g) => sum + g.level, 0);
    return { items, groups, totalLevels };
}

/**
 * 主炮射击：每回合 n 发无限弹药（限射速），配方形状与 calc_compileCollectionToRecipe 一致。
 * @param {number} n - 本回合射击次数
 * @param {number} damage - 单发伤害（HP / 次命中，已含 baseDamage 加成；flatDamageBonus 在发射时另加）
 * @param {number} [bounce=0] - 弹道反弹次数
 * @returns {object[]}
 */
export function buildCannonShots(n, damage, bounce = 0) {
    const count = Math.max(0, Math.floor(Number(n) || 0));
    const dmg = Math.max(1, Math.floor(Number(damage) || 1));
    const bounces = Math.max(0, Math.floor(Number(bounce) || 0));
    const shots = [];
    for (let i = 0; i < count; i++) {
        shots.push({
            damage: dmg,
            bounce: bounces, pierce: 0, scatter: 0,
            explosive: false,
            isMatryoshka: false,
            isLaser: false,
            nestedPayload: null, chainPayload: null,
            multicast: 0,
            flying_sword: 0,
            cryo: 0, pyro: 0, lightning: 0, laser: 0,
            overcharge: 0,
            wind: 0,
            level: 1,
            type: 'normal',
            finalHits: 0,
            _shotKind: 'cannon',
        });
    }
    return shots;
}

/**
 * 炼成弹伤害（夹具公式，§5.3）：base × (2 + 属性总级数)，炼成时锁定。
 * @param {number} totalLevels
 * @param {number} [base=15]
 */
export function alchemyDamage(totalLevels, base = 15) {
    const levels = Math.max(0, Math.floor(Number(totalLevels) || 0));
    const b = Number.isFinite(Number(base)) ? Number(base) : 15;
    return b * (2 + levels);
}

/**
 * §3 时间口径：普通波每回合挖一次；Boss 波只在 Boss 登场的那一回合挖一次，Boss 存活的后续回合不挖。
 * @param {object} game - 需要 round / _digDoneRound / _lastBossSpawnRound / enemies
 * @returns {boolean}
 */
export function shouldDigThisRound(game) {
    if (!game) return false;
    if (game._digDoneRound === game.round) return false;
    if (findActiveBoss(game) && game._lastBossSpawnRound !== game.round) return false;
    return true;
}

/**
 * [S2 占位] 能量桶倍率（§6 每波重抽 [×1,×1,×2,×2,×3]）。S1 恒为 ×1。
 * @returns {number}
 */
export function getDigBucketMultiplier(/* game, x */) {
    return 1;
}
