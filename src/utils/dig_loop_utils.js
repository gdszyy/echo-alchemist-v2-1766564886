/**
 * dig_loop_utils.js - [REQ-20261022-wave-loop · S1] 挖 → 守 循环的纯函数工具。
 *
 * 设计依据：docs/design/dig_build_defend_loop_v1.md §3（时间口径）、§5.1（主炮）、§6（挖掘）。
 *   [2026-10-26] §5.3（炼成弹）相关纯函数已随「炼成弹珠」机制整体下线（Owner 裁定），本文件只剩主炮与时间口径。
 * 约束：本文件不得 import 任何大文件（config.js / game_*.js 等），保证 node 可直接导入做单测；
 *       调用方负责把 CONFIG 中的数值作为参数传入。
 */

import { findActiveBoss } from './boss_schedule_utils.js';

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
