/**
 * src/pixel/world_render.js — 像素模式下的场景层：背景、战斗墙体、防线
 *
 * 原 render_system 的对应函数在像素模式下直接转到这里（不再绘制位图/渐变/模糊光）。
 * 场景只用 slate（结构）+ brass（防线框）+ 元素色阶（刻纹、警示）三类材质。
 * 背景与墙体按缓冲尺寸生成一次并缓存；防线按状态每帧画少量矩形。
 * @module pixel/world_render
 */
import { RAMPS, INK } from './palette.js';
import { Raster, hash2, valueNoise, bayer } from './raster.js';
import { brassBar, rivet } from './materials.js';
import { blit, toBuffer, artRect } from './blit.js';
import { drawPixelText } from './pixel_font.js';

const S = RAMPS.slate;
const _bgCache = new Map();

function cacheGet(key, make) {
    let c = _bgCache.get(key);
    if (!c) {
        c = make();
        _bgCache.set(key, c);
        if (_bgCache.size > 12) _bgCache.delete(_bgCache.keys().next().value);
    }
    return c;
}

/** 石板地面：交错石板 + 灰缝 + 块内两档明暗 + 边缘有序抖动压暗 */
function paintFlagstones(r, seed, tile = 18, tint = 'slate', base = 1) {
    const R = RAMPS[tint];
    const { w, h } = r;
    for (let y = 0; y < h; y++) {
        const row = Math.floor(y / tile);
        const off = (row & 1) ? (tile >> 1) : 0;
        for (let x = 0; x < w; x++) {
            const col = Math.floor((x + off) / tile);
            const lx = (x + off) % tile;
            const ly = y % tile;
            let idx = base;
            const tv = hash2(col, row, seed);
            if (tv < 0.2) idx -= 1;
            else if (tv > 0.92) idx += 1;
            if (lx === 0 || ly === 0) idx = base - 1; // 灰缝
            else if ((lx === 1 || ly === 1) && tv > 0.5) idx = Math.min(idx + 1, base + 1); // 部分石板有左上棱
            // 四边压暗（有序抖动过渡，不用渐变）
            const ex = Math.min(x, w - 1 - x) / (w * 0.18);
            const ey = Math.min(y, h - 1 - y) / (h * 0.12);
            const e = Math.min(1, ex, ey);
            if (e < 1 && bayer(x, y) > e) idx -= 1;
            r.set(x, y, R[Math.max(0, Math.min(R.length - 1, idx))]);
        }
    }
}

/** 地面上浅刻的炼金法阵（只改已有像素颜色） */
function etchCircle(r, cx, cy, rad, rampName, level = 1) {
    const R = RAMPS[rampName];
    const c = R[level];
    const ring = (rr) => {
        const steps = Math.max(24, Math.round(rr * 6.3));
        for (let i = 0; i < steps; i++) {
            const a = (i / steps) * Math.PI * 2;
            r.paint(Math.round(cx + Math.cos(a) * rr), Math.round(cy + Math.sin(a) * rr), c);
        }
    };
    ring(rad);
    ring(Math.round(rad * 0.62));
    // 内接三角与六芒
    for (let k = 0; k < 2; k++) {
        const pts = [0, 1, 2].map((i) => {
            const a = -Math.PI / 2 + k * Math.PI + i * (Math.PI * 2 / 3);
            return [Math.round(cx + Math.cos(a) * rad * 0.62), Math.round(cy + Math.sin(a) * rad * 0.62)];
        });
        for (let i = 0; i < 3; i++) r.line(pts[i][0], pts[i][1], pts[(i + 1) % 3][0], pts[(i + 1) % 3][1], c, 255, true);
    }
    // 刻度
    for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2;
        r.line(Math.round(cx + Math.cos(a) * rad), Math.round(cy + Math.sin(a) * rad),
            Math.round(cx + Math.cos(a) * (rad + 3)), Math.round(cy + Math.sin(a) * (rad + 3)), c, 255, true);
    }
}

function buildCombatBg(bw, bh, field) {
    const r = new Raster(bw, bh);
    // 地面压暗：敌人与弹道才是焦点，地面只做低对比的承托
    paintFlagstones(r, 7, 18, 'slate', 1);
    // 场地中线偏上刻法阵（敌阵区），发射台前一个小法阵
    etchCircle(r, bw >> 1, Math.round(field.cy), Math.round(Math.min(bw, bh) * 0.32), 'cyan', 1);
    etchCircle(r, bw >> 1, Math.round(field.launcherY), Math.round(bw * 0.14), 'brass', 2);
    return r.toCanvas();
}

function buildGatheringBg(bw, bh) {
    const r = new Raster(bw, bh);
    // 钉盘背板：更暗的冷石 + 细格，弱化存在感，让钉子与弹珠成为主体
    paintFlagstones(r, 11, 24, 'slate', 1);
    for (let y = 0; y < bh; y += 6) for (let x = (y / 6) & 1 ? 3 : 0; x < bw; x += 6) r.paint(x, y, S[2]);
    etchCircle(r, bw >> 1, Math.round(bh * 0.42), Math.round(bw * 0.4), 'arcane', 1);
    return r.toCanvas();
}

function buildMenuBg(bw, bh) {
    const r = new Raster(bw, bh);
    paintFlagstones(r, 23, 22, 'slate', 1);
    etchCircle(r, bw >> 1, Math.round(bh * 0.38), Math.round(bw * 0.36), 'arcane', 1);
    return r.toCanvas();
}

/**
 * 背景（替代 render_clearCanvas + render_background 的位图/网格）
 */
export function pxDrawBackground(game, ctx) {
    const bw = game.canvas.width;
    const bh = game.canvas.height;
    const sy = game.pixelLayout ? game.pixelLayout.sy : 1;
    let img;
    if (game.phase === 'combat' || game.phase === 'training') {
        const field = {
            cy: ((game.combatGridTopY || 90) + (game.defeatLineY || game.height * 0.7)) * 0.5 * sy,
            launcherY: (game.height - 70) * sy,
        };
        img = cacheGet(`c|${bw}x${bh}|${Math.round(field.cy)}`, () => buildCombatBg(bw, bh, field));
    } else if (game.phase === 'gathering') {
        img = cacheGet(`g|${bw}x${bh}`, () => buildGatheringBg(bw, bh));
    } else {
        img = cacheGet(`m|${bw}x${bh}`, () => buildMenuBg(bw, bh));
    }
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(img, 0, 0);
    ctx.restore();
}

// ─── 战斗墙体 ────────────────────────────────────────────────

function buildPillar(w, h, seed) {
    const r = new Raster(w, h);
    // 竖向石柱：块砌 + 右侧（内侧）亮棱 + 每隔一段黄铜箍
    for (let y = 0; y < h; y++) {
        const block = Math.floor(y / 14);
        for (let x = 0; x < w; x++) {
            let idx = 2;
            if (hash2(block, x >> 3, seed) > 0.7) idx = 3;
            if (y % 14 === 0) idx = 0;
            if (x === 0) idx = 1;
            if (x === w - 1) idx = 4;
            if (x === w - 2) idx = 3;
            r.set(x, y, S[idx]);
        }
    }
    for (let y = 20; y < h - 4; y += 56) {
        brassBar(r, 0, y, w, 2);
        rivet(r, (w >> 1) - 1, y + 4);
    }
    return r.toCanvas();
}

function buildLintel(w, h, seed) {
    const r = new Raster(w, h);
    for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
            let idx = 2;
            if (hash2(x >> 4, y >> 3, seed) > 0.75) idx = 3;
            if (x % 16 === 0) idx = 1;
            if (y === h - 1) idx = 4;
            if (y === h - 2) idx = 3;
            if (y === 0) idx = 1;
            r.set(x, y, S[idx]);
        }
    }
    brassBar(r, 0, h - 4, w, 2);
    for (let x = 6; x < w - 4; x += 24) rivet(r, x, 3);
    return r.toCanvas();
}

/**
 * 战斗反弹墙：左右石柱 + 顶部门楣，墙内沿 1px 青色刻线标出碰撞边界（必需读法，不随画质降级）。
 */
export function pxDrawCombatWalls(game, ctx, wallLeftX, wallRightX, wallTopY) {
    const a = toBuffer(ctx, wallLeftX, wallTopY);
    const b = toBuffer(ctx, wallRightX, game.height);
    const bw = Math.max(4, Math.round(a.x));
    const bh = Math.max(4, Math.round(b.y - a.y));
    const pillarW = Math.min(bw, 10);
    const topH = 8;
    const left = cacheGet(`pl|${pillarW}x${bh}`, () => buildPillar(pillarW, bh, 3));
    const right = cacheGet(`pr|${pillarW}x${bh}`, () => buildPillar(pillarW, bh, 5));
    const fieldW = Math.round(b.x - a.x);
    const lintel = cacheGet(`lt|${fieldW + pillarW * 2}x${topH}`, () => buildLintel(fieldW + pillarW * 2, topH, 9));
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.imageSmoothingEnabled = false;
    const lx = Math.round(a.x) - pillarW;
    const rx = Math.round(b.x);
    const ty = Math.round(a.y);
    ctx.drawImage(left, lx, ty);
    ctx.drawImage(right, rx + pillarW, ty, -pillarW, bh); // 镜像：亮棱朝场内
    ctx.drawImage(lintel, lx, ty - topH);
    // 碰撞边界刻线
    ctx.fillStyle = RAMPS.cyan[3];
    ctx.fillRect(Math.round(a.x) - 1, ty, 1, bh);
    ctx.fillRect(rx, ty, 1, bh);
    ctx.fillRect(Math.round(a.x) - 1, ty - 1, rx - Math.round(a.x) + 2, 1);
    ctx.restore();
}

// ─── 防线 ────────────────────────────────────────────────────

// @perf-impact: 防线每帧按缓冲宽度逐像素 fillRect（约 300–900 次，缓冲宽 ~287）；背景与墙体按尺寸缓存为整张画布，每帧各 1 次 drawImage。
/**
 * 防线（必需读法）：三种状态
 * - 有屏障：冰蓝符文链 + 「屏障 ×N」
 * - 危险（敌人进入 1.45 格内）：血红警示斜纹闪动 + 「危险」
 * - 平时：暗黄铜虚线 + 「防线」
 */
export function pxDrawDefeatLine(game, ctx) {
    if (!Number.isFinite(game.defeatLineY)) return;
    const lineY = game.defeatLineY - 2;
    const shield = game.playerShield || 0;
    const enemies = Array.isArray(game.enemies) ? game.enemies : [];
    const dangerRange = Math.max(58, (game.enemyHeight || 42) * 1.45);
    const isDanger = enemies.some((e) => e && !e.dead && e.pos && (e.pos.y + (e.height || game.enemyHeight || 0) / 2) >= lineY - dangerRange);
    const p = toBuffer(ctx, 0, lineY);
    const bw = game.canvas.width;
    const y = Math.round(p.y);
    const t = Math.floor(performance.now() / (isDanger ? 120 : 260));
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    if (shield > 0) {
        const I = RAMPS.ice;
        for (let x = 0; x < bw; x++) {
            const m = (x + t) % 8;
            ctx.fillStyle = m < 5 ? I[4] : I[2];
            ctx.fillRect(x, y, 1, 1);
            if (m === 0) { ctx.fillStyle = I[5]; ctx.fillRect(x, y - 1, 1, 3); }
        }
    } else if (isDanger) {
        const B = RAMPS.blood;
        for (let x = 0; x < bw; x++) {
            for (let k = -1; k <= 1; k++) {
                const stripe = ((x + k + t) >> 2) & 1;
                ctx.fillStyle = stripe ? B[4] : B[1];
                ctx.fillRect(x, y + k, 1, 1);
            }
        }
    } else {
        const Br = RAMPS.brass;
        for (let x = 0; x < bw; x++) {
            if (((x + t) % 10) < 6) { ctx.fillStyle = Br[3]; ctx.fillRect(x, y, 1, 1); }
        }
    }
    ctx.restore();
    const label = shield > 0 ? `屏障×${shield}` : (isDanger ? '危险' : '防线');
    const color = shield > 0 ? RAMPS.ice[5] : (isDanger ? RAMPS.blood[5] : RAMPS.brass[5]);
    if (game.pixelFontReady !== false) {
        ctx.save();
        ctx.font = '12px sans-serif';
        ctx.textAlign = 'right';
        ctx.textBaseline = 'bottom';
        ctx.fillStyle = color;
        ctx.strokeStyle = INK;
        ctx.lineWidth = 2;
        const lx = (Number.isFinite(game.combatGridRightX) ? game.combatGridRightX : game.width) - 4;
        ctx.strokeText(label, lx, lineY - 3);
        ctx.fillText(label, lx, lineY - 3);
        ctx.restore();
    }
}

export { artRect, blit, drawPixelText };
