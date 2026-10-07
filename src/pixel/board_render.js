/**
 * src/pixel/board_render.js — 像素模式的钉盘：钉子与弹珠
 *
 * 钉子：菱形石钉（slate），属性钉嵌元素色核心；粉色缓冲钉为圆形 rose；
 *       2/3 级加黄铜角点；被击中点亮（核心变亮、外缘 1px 亮框）；冷却中核心压暗。
 * 弹珠：弹珠类型色阶的像素球 + 最多 2 个最强属性的环绕像素点。
 * @module pixel/board_render
 */
import { RAMPS } from './palette.js';
import { Raster } from './raster.js';
import { ATTRIBUTE_STYLE } from './icons.js';

const _cache = new Map();
function cached(key, make) {
    let c = _cache.get(key);
    if (!c) {
        c = make();
        _cache.set(key, c);
        if (_cache.size > 300) _cache.delete(_cache.keys().next().value);
    }
    return c;
}

const PEG_RAMP = {
    pink: 'rose', bounce: 'rose', damage: 'arcane', cryo: 'ice', pyro: 'fire', pierce: 'blood',
    scatter: 'brass', wind: 'mint', flying_sword: 'cyan', resonance: 'brass', venom: 'venom', laser: 'cyan',
    lightning: 'volt',
};

function buildPeg(type, rad, level, state) {
    const size = rad * 2 + 3;
    const r = new Raster(size, size);
    const c = rad + 1;
    const S = RAMPS.slate;
    const round = type === 'pink';
    const inside = (x, y) => (round ? x * x + y * y <= rad * rad + rad * 0.8 : Math.abs(x) + Math.abs(y) <= rad);
    const typed = type !== 'normal' && PEG_RAMP[type];
    const T = typed ? RAMPS[PEG_RAMP[type]] : null;
    for (let y = -rad; y <= rad; y++) {
        for (let x = -rad; x <= rad; x++) {
            if (!inside(x, y)) continue;
            const edge = !inside(x - 1, y) || !inside(x + 1, y) || !inside(x, y - 1) || !inside(x, y + 1);
            let col;
            if (round || typed) {
                // 属性钉整颗着色：钉子类型是研磨阶段的主要信息
                const n = T.length;
                const hi = state === 'cool' ? 2 : (state === 'lit' ? n - 1 : n - 2);
                const mid = state === 'cool' ? 1 : Math.min(n - 2, Math.floor(n * 0.6));
                const lo = state === 'cool' ? 0 : Math.max(1, Math.floor(n * 0.3));
                col = (x + y) < -rad * 0.3 ? T[hi] : (x + y > rad * 0.4 ? T[lo] : T[mid]);
            } else if (edge) {
                col = (x + y) < 0 ? S[state === 'lit' ? 9 : 7] : S[3];
            } else {
                col = (x + y) < 0 ? S[6] : S[4];
            }
            r.set(c + x, c + y, col);
        }
    }
    if (state === 'lit') r.set(c, c, '#ffffff');
    if (level >= 2) r.set(c, c - rad - 1 >= 0 ? c - rad : 0, RAMPS.brass[6]);
    if (level >= 3) { r.set(c - rad, c, RAMPS.brass[6]); r.set(c + rad, c, RAMPS.brass[6]); }
    r.outline();
    return r.toCanvas();
}

function toBuf(ctx, x, y) {
    const m = ctx.getTransform();
    return { x: m.a * x + m.c * y + m.e, y: m.b * x + m.d * y + m.f, s: Math.hypot(m.a, m.b) || 1 };
}

// @perf-impact: 每颗钉子 1 次缓存精灵 drawImage（按 类型×半径×等级×状态 缓存）；跳过原软阴影。
/** 替代 Peg.draw（圆形钉）；返回 false 表示交给原路径（如线段障碍钉） */
export function pxDrawPeg(ctx, peg, baseRadius) {
    if (peg.shape === 'barrier') return false;
    const p = toBuf(ctx, peg.pos.x, peg.pos.y);
    const lit = peg.lit && peg.litTimer > 0;
    const rad = Math.max(2, Math.round(baseRadius * p.s * (lit ? 1.25 : 1)));
    const state = lit ? 'lit' : ((peg.cooldownTimer > 0 || peg.frozenTurns > 0) ? 'cool' : 'idle');
    const type = peg.type || 'normal';
    const img = cached(`peg|${type}|${rad}|${peg.level || 1}|${state}`, () => buildPeg(type, rad, peg.level || 1, state));
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(img, Math.round(p.x) - (img.width >> 1), Math.round(p.y) - (img.height >> 1));
    ctx.restore();
    return true;
}

function ballSprite(rad, rampName) {
    return cached(`ball|${rad}|${rampName}`, () => {
        const size = rad * 2 + 3;
        const r = new Raster(size, size);
        const c = rad + 1;
        const R = RAMPS[rampName] || RAMPS.slate;
        const n = R.length;
        for (let y = -rad; y <= rad; y++) {
            for (let x = -rad; x <= rad; x++) {
                if (x * x + y * y > rad * rad + rad * 0.8) continue;
                let col = R[Math.min(n - 2, Math.floor(n * 0.6))];
                if (x + y < -rad * 0.4) col = R[n - 2];
                else if (x + y > rad * 0.6) col = R[Math.max(1, Math.floor(n * 0.3))];
                r.set(c + x, c + y, col);
            }
        }
        r.set(c - Math.max(1, rad >> 1), c - Math.max(1, rad >> 1), R[n - 1]);
        r.outline();
        return r.toCanvas();
    });
}

export function marbleRamp(type) {
    if (type === 'white' || !type) return 'slate';
    return (ATTRIBUTE_STYLE[type] && ATTRIBUTE_STYLE[type].ramp) || 'slate';
}

/** 替代 DropBall.draw */
export function pxDrawBall(ctx, ball) {
    const p = toBuf(ctx, ball.pos.x, ball.pos.y);
    const rad = Math.max(2, Math.round((ball.radius || 6) * p.s));
    const img = ballSprite(rad, marbleRamp(ball.def && ball.def.type));
    const bx = Math.round(p.x);
    const by = Math.round(p.y);
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(img, bx - (img.width >> 1), by - (img.height >> 1));
    // 最强两个属性：环绕像素点
    let buffs = null;
    try { buffs = typeof ball.getBuffState === 'function' ? ball.getBuffState() : null; } catch (_) { buffs = null; }
    if (buffs) {
        const top = Object.entries(buffs).filter(([k, v]) => v > 0 && ATTRIBUTE_STYLE[k]).sort((a, b) => b[1] - a[1]).slice(0, 2);
        const t = (ball.lifeTime || 0) * 0.12;
        top.forEach(([k], i) => {
            const a = t + i * Math.PI;
            const R = RAMPS[ATTRIBUTE_STYLE[k].ramp];
            ctx.fillStyle = R[R.length - 2];
            ctx.fillRect(Math.round(bx + Math.cos(a) * (rad + 2)), Math.round(by + Math.sin(a) * (rad + 2)), 1, 1);
        });
    }
    ctx.restore();
}
