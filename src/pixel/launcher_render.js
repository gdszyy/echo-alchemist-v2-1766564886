/**
 * src/pixel/launcher_render.js — 像素模式的发射器与子弹
 *
 * 发射器：八角磨石台 + 黄铜环 + 6 颗充能符文（按蓄力进度点亮）+ 炮管（64 个角度桶各生成一张
 * 像素线条炮管，避免任意角度旋转位图造成的重采样）+ 弹膛里本发子弹的主属性色球。
 * 子弹：主属性色阶的像素球（1px INK 描边、左上高光），拖尾为隔点取样的递暗方块。
 * 当前子弹的数值读数不再画在发射器上（统一放在底部"本发"面板，避免两处不一致）。
 * @module pixel/launcher_render
 */
import { RAMPS, INK } from './palette.js';
import { Raster } from './raster.js';
import { shadeStone, maskFromShapes, rivet } from './materials.js';
import { ATTRIBUTE_STYLE } from './icons.js';
import { getAmmoReadabilityProfile } from '../utils/ammo_readability.js';

const _cache = new Map();
function cached(key, make) {
    let c = _cache.get(key);
    if (!c) {
        c = make();
        _cache.set(key, c);
        if (_cache.size > 200) _cache.delete(_cache.keys().next().value);
    }
    return c;
}

function octagon(cx, cy, r) {
    const c = Math.round(r * 0.42);
    return [[cx - r + c, cy - r], [cx + r - c, cy - r], [cx + r, cy - r + c], [cx + r, cy + r - c], [cx + r - c, cy + r], [cx - r + c, cy + r], [cx - r, cy + r - c], [cx - r, cy - r + c]];
}

function buildBase(size) {
    const r = new Raster(size, size);
    const c = size >> 1;
    const R = c - 1;
    const mask = maskFromShapes(size, size, [{ poly: octagon(c, c, R) }]);
    shadeStone(r, mask, { ramp: 'slate', base: 3, seed: 41, bevel: 1, cluster: 6 });
    // 黄铜环
    const B = RAMPS.brass;
    const ringR = Math.round(R * 0.62);
    for (let y = -ringR; y <= ringR; y++) {
        for (let x = -ringR; x <= ringR; x++) {
            const d = Math.sqrt(x * x + y * y);
            if (d <= ringR && d > ringR - 2) r.set(c + x, c + y, (x + y) < 0 ? B[5] : B[2]);
            else if (d <= ringR - 2) r.set(c + x, c + y, RAMPS.slate[1]);
        }
    }
    for (let i = 0; i < 4; i++) {
        const a = Math.PI / 4 + i * Math.PI / 2;
        rivet(r, Math.round(c + Math.cos(a) * R * 0.82) - 1, Math.round(c + Math.sin(a) * R * 0.82) - 1);
    }
    r.outline();
    return r.toCanvas();
}

function buildBarrel(len, bucket, buckets) {
    const a = (bucket / buckets) * Math.PI * 2;
    const size = len * 2 + 6;
    const r = new Raster(size, size);
    const c = size >> 1;
    const dx = Math.cos(a);
    const dy = Math.sin(a);
    const B = RAMPS.brass;
    // 三条平行线组成 3px 宽炮管：上侧亮、中间主色、下侧暗（光从左上）
    const nx = -dy;
    const ny = dx;
    const lit = (nx * -1 + ny * -1) > 0; // 法线朝左上的一侧更亮
    for (let k = -1; k <= 1; k++) {
        const ox = Math.round(nx * k);
        const oy = Math.round(ny * k);
        let col = B[3];
        if (k !== 0) col = ((k === -1) === lit) ? B[2] : B[5];
        r.line(c + ox, c + oy, Math.round(c + dx * len) + ox, Math.round(c + dy * len) + oy, col);
    }
    // 炮口箍
    const mx = Math.round(c + dx * len);
    const my = Math.round(c + dy * len);
    for (let k = -2; k <= 2; k++) r.set(mx + Math.round(nx * k), my + Math.round(ny * k), B[6]);
    r.outline();
    return r.toCanvas();
}

function orbSprite(rad, rampName) {
    return cached(`orb|${rad}|${rampName}`, () => {
        const size = rad * 2 + 3;
        const r = new Raster(size, size);
        const c = rad + 1;
        const R = RAMPS[rampName] || RAMPS.slate;
        const n = R.length;
        for (let y = -rad; y <= rad; y++) {
            for (let x = -rad; x <= rad; x++) {
                const d = x * x + y * y;
                if (d > rad * rad + rad * 0.8) continue;
                let col = R[Math.min(n - 2, 3)];
                if (x + y < -rad * 0.3) col = R[n - 2];
                if (x + y > rad * 0.6) col = R[Math.max(1, Math.floor(n * 0.3))];
                r.set(c + x, c + y, col);
            }
        }
        r.set(c - Math.max(1, rad >> 1), c - Math.max(1, rad >> 1), R[n - 1]);
        r.outline();
        return r.toCanvas();
    });
}

export function ammoRamp(recipe) {
    if (!recipe) return 'slate';
    const p = getAmmoReadabilityProfile(recipe);
    const key = p.primary && p.primary.key;
    return (ATTRIBUTE_STYLE[key] && ATTRIBUTE_STYLE[key].ramp) || 'slate';
}

function toBuf(ctx, x, y) {
    const m = ctx.getTransform();
    return { x: m.a * x + m.c * y + m.e, y: m.b * x + m.d * y + m.f, s: Math.hypot(m.a, m.b) || 1 };
}

/**
 * 发射器底座 + 炮管（替代 render_combat_launcherEmitterBase）。
 */
export function pxDrawLauncher(ctx, x, y, isCharging, chargeProgress, reloadProgress, rotation, recipe) {
    const p = toBuf(ctx, x, y);
    const size = Math.max(24, Math.round(64 * p.s) | 1);
    const base = cached(`base|${size}`, () => buildBase(size));
    const buckets = 64;
    const ang = ((rotation % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
    const bucket = Math.round(ang / (Math.PI * 2) * buckets) % buckets;
    const len = Math.round(size * 0.55);
    const barrel = cached(`barrel|${len}|${bucket}`, () => buildBarrel(len, bucket, buckets));
    const bx = Math.round(p.x);
    const by = Math.round(p.y);
    const recoil = reloadProgress > 0 ? Math.round(Math.sin(reloadProgress * Math.PI) * 2) : 0;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(base, bx - (base.width >> 1), by - (base.height >> 1));
    // 充能符文：6 颗，围绕黄铜环
    const lit = isCharging ? Math.round(Math.max(0, Math.min(1, chargeProgress)) * 6) : 0;
    const rr = Math.round(size * 0.42);
    for (let i = 0; i < 6; i++) {
        const a = -Math.PI / 2 + i * (Math.PI / 3);
        const rx = Math.round(bx + Math.cos(a) * rr);
        const ry = Math.round(by + Math.sin(a) * rr);
        ctx.fillStyle = INK;
        ctx.fillRect(rx - 1, ry - 1, 3, 3);
        ctx.fillStyle = i < lit ? RAMPS.cyan[5] : RAMPS.slate[3];
        ctx.fillRect(rx, ry, 1, 1);
    }
    const dx = Math.round(-Math.cos(ang) * recoil);
    const dy = Math.round(-Math.sin(ang) * recoil);
    ctx.drawImage(barrel, bx - (barrel.width >> 1) + dx, by - (barrel.height >> 1) + dy);
    // 弹膛：本发子弹主色
    if (recipe) {
        const orb = orbSprite(Math.max(2, Math.round(size * 0.1)), ammoRamp(recipe));
        ctx.drawImage(orb, bx - (orb.width >> 1), by - (orb.height >> 1));
    } else {
        ctx.fillStyle = RAMPS.slate[0];
        ctx.fillRect(bx - 2, by - 2, 5, 5);
    }
    ctx.restore();
}

// @perf-impact: 每颗子弹 1 次像素球 drawImage + 最多 6 次拖尾 fillRect；无渐变与模糊。
/**
 * 子弹（替代 Projectile.draw 的矢量路径）。
 */
export function pxDrawProjectile(ctx, proj) {
    const p = toBuf(ctx, proj.pos.x, proj.pos.y);
    const rad = Math.max(1, Math.min(6, Math.round((proj.radius || 5) * p.s * 0.8)));
    const rampName = ammoRamp(proj.config);
    const R = RAMPS[rampName] || RAMPS.slate;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.imageSmoothingEnabled = false;
    // 拖尾：隔点取样，越旧越暗越小
    const trail = proj.trail || [];
    const n = trail.length;
    for (let i = n - 1, k = 0; i >= 0 && k < 6; i -= 2, k++) {
        const t = toBuf(ctx, trail[i].x, trail[i].y);
        const sz = Math.max(1, rad - Math.floor(k / 2));
        ctx.fillStyle = R[Math.max(1, R.length - 2 - k)];
        ctx.fillRect(Math.round(t.x) - (sz >> 1), Math.round(t.y) - (sz >> 1), sz, sz);
    }
    const orb = orbSprite(rad, rampName);
    ctx.drawImage(orb, Math.round(p.x) - (orb.width >> 1), Math.round(p.y) - (orb.height >> 1));
    ctx.restore();
}
