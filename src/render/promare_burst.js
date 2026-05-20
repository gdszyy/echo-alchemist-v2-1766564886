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
    // [cryo signature] 落地结晶分裂：粒子寿命接近 0 时分裂 2 个微小晶体
    globalThis._promareCryoSubSpawn = (x, y, color) => {
        if (!game || typeof game.spawn_createParticle !== 'function') return;
        for (let i = 0; i < 2; i++) {
            const a = (i === 0 ? -1 : 1) * (0.3 + Math.random() * 0.4); // 左右分裂
            const sp = 0.8 + Math.random() * 0.6;
            const sub = game.spawn_createParticle(x, y, color || '#00E5FF', 'cryo_oct');
            if (sub) {
                if (sub.vel) {
                    sub.vel.x = Math.cos(a) * sp;
                    sub.vel.y = -Math.abs(Math.sin(a)) * sp - 0.3; // 微微向上飞
                }
                sub.size *= 0.55;
                sub._splitFired = true; // 防止再次分裂
                sub.life = 0.35;
                sub.maxLife = sub.life;
                sub.decay = 0.07;
                sub.gravity = 0.5; // 重力稍强，落地感
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

    // ===== 元素 signature 二次效果 =====
    // 每个 elementKey 有不同的"额外仪式"，独立于通用碎片群。
    _spawnElementSignature(game, x, y, baseA, elementKey, perf);
}

/**
 * 元素 signature 二次喷发：在通用碎片群之上叠加每个元素独有的仪式特效。
 * @perf-impact: 各 ≤6 额外粒子，按 elementKey 独立路径。
 */
function _spawnElementSignature(game, x, y, baseA, elementKey, perf) {
    if (!game || typeof game.spawn_createParticle !== 'function') return;

    if (elementKey === 'echo') {
        // [echo signature] 多层错时同心环涟漪（0 / 80 / 160 ms 启动）
        const ripples = perf.useStagger ? 3 : 1;
        for (let i = 0; i < ripples; i++) {
            const fire = () => {
                const p = game.spawn_createParticle(x, y, '#FF0090', 'echo_ring');
                if (p) {
                    p.size = 4 + i * 2;
                    p._expandRate = 0.5 + i * 0.15;
                    p.life = 1.0 - i * 0.1;
                    p.maxLife = p.life;
                    p.decay = 0.04 + i * 0.005;
                }
            };
            if (i === 0) fire();
            else setTimeout(fire, i * 80);
        }
    } else if (elementKey === 'wind') {
        // [wind signature] 风暴线：3-5 条更长的 line 粒子沿 baseA ±30° 喷发
        const lineCount = perf.useStagger ? 5 : 3;
        for (let i = 0; i < lineCount; i++) {
            const a = baseA + (Math.random() - 0.5) * 0.6; // ±17° 锥
            const sp = 5 + Math.random() * 3;
            const p = game.spawn_createParticle(x, y, '#00E5FF', 'wind_slash');
            if (p) {
                if (p.vel) {
                    p.vel.x = Math.cos(a) * sp;
                    p.vel.y = Math.sin(a) * sp;
                }
                // 更长更细的「风暴线」
                p.size = 14 + Math.random() * 8;
                p.life = 0.6;
                p.maxLife = p.life;
                p.decay = 0.04;
                p.angle = a;
            }
        }
    } else if (elementKey === 'cryo') {
        // [cryo signature] 不在 burst 处增加；分裂由粒子自身在 update 时触发（已加桥接）。
        // 此分支留空，保留扩展位。
    } else if (elementKey === 'laser') {
        // [laser signature] 8 道激光光柱呈放射状（已有 burst 是少量主体；这里补 8 道）
        const beams = perf.useStagger ? 8 : 4;
        for (let i = 0; i < beams; i++) {
            const a = (i / beams) * Math.PI * 2;
            const p = game.spawn_createParticle(x, y, '#FFFFFF', 'laser_beam');
            if (p) {
                p.angle = a;
                if (p.vel) {
                    p.vel.x = Math.cos(a) * 3.0;
                    p.vel.y = Math.sin(a) * 3.0;
                }
                p.size = 14 + Math.random() * 4;
            }
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
