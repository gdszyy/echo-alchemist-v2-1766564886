/**
 * promare_burst.js - 普罗米亚风格碎片爆发 spawner
 *
 * 单一入口 `spawnPromareBurst(game, x, y, hitVel, element, severity)` 实现「碎片张力 4 规则」：
 *   1. 方向锥（大 ±25°，小 ±66°）
 *   2. 大小双峰（2-3 大 + 12-16 小）
 *   3. 速度幂律（小用 pow(rand, 1.7)）
 *   4. 时序错落（前 4 立即出生，其余 0~90ms 随机延迟）
 *
 * 配合 `spawnRadialImpact(game, x, y)` 出 8 条辐射 spoke + 1 shockwave。
 *
 * @perf-impact: 单次 burst 在 high 档生成 ≤27 个 promare 粒子；low 档减半。
 *               所有粒子通过 game.spawn_createParticle 走预算门控，超额返回 null。
 */

import { BURST, ELEMENT_CODEX, resolveElementKey, getPromarePerf } from './promare_tokens.js';

// 元素 key → 粒子 mode 名映射
const ELEMENT_TO_MODE = {
    pyro:         'pyro_cone',
    cryo:         'cryo_oct',
    lightning:    'thunder_z',
    pierce:       'pierce_lance',
    bounce:       'bounce_hex',
    scatter:      'scatter_star',
    damage:       'damage_diamond',
    wind:         'wind_slash',     // 复用已有 wind_slash mode
    laser:        'laser_beam',     // 改用专用激光光柱模式
    venom:        'venom_tri',
    echo:         'echo_ring',
    flying_sword: 'damage_diamond',
};

// [Promare] scatter signature: 二次爆裂子粒子 spawner（粒子在 update 内通过 globalThis 桥接调用）
// 由 ensurePromareGlobals(game) 写入，让 scatter_star 粒子能在 life 0.5 点生成 3 个子粒子。
export function ensurePromareGlobals(game) {
    if (typeof globalThis === 'undefined') return;
    if (globalThis._promareScatterSubSpawn) return;
    globalThis._promareScatterSubSpawn = (x, y, color) => {
        if (!game || typeof game.spawn_createParticle !== 'function') return;
        for (let i = 0; i < 3; i++) {
            const a = Math.random() * Math.PI * 2;
            const sp = 1.5 + Math.random() * 1.5;
            const sub = game.spawn_createParticle(x, y, color || '#FFD600', 'scatter_star');
            if (sub && sub.vel) {
                sub.vel.x = Math.cos(a) * sp;
                sub.vel.y = Math.sin(a) * sp;
                sub.size *= 0.5;
                sub._splitFired = true; // 防止子粒子再次分裂（链式爆炸）
                sub.life = 0.4;
                sub.maxLife = sub.life;
                sub.decay = 0.08;
            }
        }
    };
}

/**
 * 在 (x, y) 处沿入射反方向喷出几何碎片群。
 *
 * @param {Game} game - 主 Game 实例，需要 spawn_createParticle、perfQualityLevel
 * @param {number} x - 命中点 x
 * @param {number} y - 命中点 y
 * @param {{x:number,y:number}} hitVel - 入射速度向量（碎片沿其反方向喷出）
 * @param {string} elementType - 元素 type 字符串（如 'pyro' / 'cryo'）
 * @param {'normal'|'big'|'kill'|'low_perf'} severity - 严重程度，影响数量
 */
export function spawnPromareBurst(game, x, y, hitVel, elementType, severity = 'normal') {
    if (!game || typeof game.spawn_createParticle !== 'function') return;

    const elementKey = resolveElementKey(elementType);
    const codex = ELEMENT_CODEX[elementKey] || ELEMENT_CODEX.damage;
    const mode = ELEMENT_TO_MODE[elementKey] || 'damage_diamond';

    const perf = getPromarePerf(game.perfQualityLevel || 'high');

    // 数量缩放：normal 用 codex 默认；big/kill 用 perf 上限；low_perf 减半
    let bigN, smallN;
    if (severity === 'kill') {
        bigN   = perf.burstBigN;
        smallN = perf.burstSmallN;
    } else if (severity === 'big') {
        bigN   = Math.max(1, Math.floor(perf.burstBigN * 0.7));
        smallN = Math.max(4, Math.floor(perf.burstSmallN * 0.7));
    } else if (severity === 'low_perf') {
        bigN   = Math.max(1, Math.floor(perf.burstBigN * 0.5));
        smallN = Math.max(3, Math.floor(perf.burstSmallN * 0.5));
    } else {
        // normal：codex.burstCount 提示，但仍受 perf 上限约束
        bigN   = Math.min(perf.burstBigN,   BURST.bigN[0]   + ((Math.random() * BURST.bigN[1])   | 0));
        smallN = Math.min(perf.burstSmallN, BURST.smallN[0] + ((Math.random() * BURST.smallN[1]) | 0));
    }

    // 入射反方向：碎片应朝球反弹方向飞
    const vx = (hitVel && hitVel.x) || 0;
    const vy = (hitVel && hitVel.y) || 1;
    const baseA = Math.atan2(-vy, -vx);

    // ===== 大碎片：立即出生 =====
    for (let i = 0; i < bigN; i++) {
        const aOffset = (Math.random() - 0.5) * BURST.dirConeBig * 2;
        const a = baseA + aOffset;
        const sp = BURST.bigSpeedBase + Math.random() * BURST.bigSpeedRange;
        _spawnOne(game, x, y, mode, a, sp, true, codex);
    }

    // ===== 小碎片：前 4 个立即，其余 0~90ms 错落 =====
    const immediate = perf.useStagger ? Math.min(BURST.immediateSmall, smallN) : smallN;

    for (let i = 0; i < immediate; i++) {
        const aOffset = (Math.random() - 0.5) * BURST.dirConeSmall * 2;
        const a = baseA + aOffset;
        const sp = Math.pow(Math.random(), BURST.smallSpeedPow) * BURST.smallSpeedMax + BURST.smallSpeedBase;
        _spawnOne(game, x, y, mode, a, sp, false, codex);
    }

    if (perf.useStagger) {
        for (let i = immediate; i < smallN; i++) {
            const delay = Math.random() * BURST.staggerMs;
            setTimeout(() => {
                const aOffset = (Math.random() - 0.5) * BURST.dirConeSmall * 2;
                const a = baseA + aOffset;
                const sp = Math.pow(Math.random(), BURST.smallSpeedPow) * BURST.smallSpeedMax + BURST.smallSpeedBase;
                _spawnOne(game, x, y, mode, a, sp, false, codex);
            }, delay);
        }
    }
}

/**
 * 在 (x, y) 处喷出 8 条放射 spoke + 1 Shockwave，作为冲击瞬间的同心圆 + 辐射线。
 * 配合 `spawnPromareBurst` 使用，每次命中调一次。
 *
 * @param {Game} game
 * @param {number} x
 * @param {number} y
 * @param {string} elementType - 用于决定 spoke 数（lightning 用 12，其他用 8）
 */
export function spawnRadialImpact(game, x, y, elementType) {
    if (!game || typeof game.spawn_createParticle !== 'function') return;

    const perf = getPromarePerf(game.perfQualityLevel || 'high');
    const spokeCount = perf.radialSpokes;

    for (let i = 0; i < spokeCount; i++) {
        const a = (i / spokeCount) * Math.PI * 2;
        // 直接调用 spawn_createParticle 创建 radial_spoke
        const p = game.spawn_createParticle(x, y, '#FFFFFF', 'radial_spoke');
        if (p) {
            p.angle = a;
            const sp = BURST.radialSpokeSpeed;
            if (p.vel) {
                p.vel.x = Math.cos(a) * sp;
                p.vel.y = Math.sin(a) * sp;
            }
        }
    }

    // Shockwave（如果游戏有 spawn_createShockwave 方法）
    if (typeof game.spawn_createShockwave === 'function') {
        game.spawn_createShockwave(x, y, '#FFFFFF');
    }
}

// ==================== 内部：单粒子 spawn ====================

function _spawnOne(game, x, y, mode, angle, speed, isBig, codex) {
    const p = game.spawn_createParticle(x, y, codex.primary || '#FFFFFF', mode);
    if (!p) return; // 预算超限被 null 退回

    // 速度覆盖（spawn_createParticle 内部已 reset，这里强制按 burst 规则）
    if (p.vel) {
        p.vel.x = Math.cos(angle) * speed;
        p.vel.y = Math.sin(angle) * speed;
    }
    // 大碎片 size +60%，life 拉长
    if (isBig) {
        p.size = (p.size || 2) * (1.4 + Math.random() * 0.4);
        p.life = 1.4 + Math.random() * 0.4;
        p.maxLife = p.life;
        // 大碎片 decay 减半 → 飞得更远
        if (p.decay) p.decay *= 0.5;
    }
    // 朝速度方向锁定 angle（pierce_lance 类）
    if (mode === 'pierce_lance' || mode === 'wind_slash') {
        p.angle = angle;
    }
}
