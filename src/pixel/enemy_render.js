/**
 * src/pixel/enemy_render.js — 像素模式下的敌人绘制（替代 Enemy.draw 的位图/矢量路径）
 *
 * 本体：enemy_sprites.js 的程序化磨石精灵（原型轮廓 + 机制核心；精英黄铜扣带；首领冠饰）。
 * 动态：全部整像素——待机 1px 起伏、受击白闪 + 1px 抖动、预警抖动、跳跃整像素抬升 + 像素阴影。
 * 状态覆层：冻结（冰色抖动罩 + 冰壳描边）、过热（橙色描边闪烁 + 火星）、剧毒（绿色滴落）、
 *           低血（<30% 裂纹）。
 * 读数（固定四角，不叠字，docs/design/pixel_art_mode.md §5）：
 *   底边中 = 血量（下降时红）；精英/首领加 2px 血条
 *   左上   = 防御（护盾层 / 光耀 / 能量 / 活体护甲，最多 2 个）
 *   右侧列 = 状态（热 / 寒 / 毒）+ 随机词条图标（合计最多按高度排）
 *   右上   = 行动倒计时（重甲、首领：_moveCooldown）
 *   头顶   = 敌方回合预警意图（只在 telegraphing 时）
 * @module pixel/enemy_render
 */
import { RAMPS, INK, UI } from './palette.js';
import { getEnemySprite, BOSS_RAMP, hasEnemyArchetype } from './enemy_sprites.js';
import { getIcon, getAffixIcon, AFFIX_STYLE } from './icons.js';
import { getPixelTextCanvas } from './pixel_font.js';
import { hash2 } from './raster.js';

const _silhouette = new WeakMap();

function makeCanvas(w, h) {
    if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(w, h);
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    return c;
}

/** 精灵的纯色剪影（白闪 / 冰罩用），按 (精灵, 颜色) 缓存 */
function silhouette(sprite, color) {
    let byColor = _silhouette.get(sprite);
    if (!byColor) { byColor = new Map(); _silhouette.set(sprite, byColor); }
    let c = byColor.get(color);
    if (c) return c;
    c = makeCanvas(sprite.width, sprite.height);
    const g = c.getContext('2d');
    g.drawImage(sprite, 0, 0);
    g.globalCompositeOperation = 'source-in';
    g.fillStyle = color;
    g.fillRect(0, 0, c.width, c.height);
    byColor.set(color, c);
    return c;
}

/** 冰罩：剪影上的 50% 有序抖动 */
function frostOverlay(sprite) {
    let byColor = _silhouette.get(sprite);
    if (!byColor) { byColor = new Map(); _silhouette.set(sprite, byColor); }
    let c = byColor.get('__frost');
    if (c) return c;
    c = makeCanvas(sprite.width, sprite.height);
    const g = c.getContext('2d');
    g.drawImage(silhouette(sprite, RAMPS.ice[4]), 0, 0);
    const id = g.getImageData(0, 0, c.width, c.height);
    for (let y = 0; y < c.height; y++) {
        for (let x = 0; x < c.width; x++) {
            if (((x + y) & 1) === 0) id.data[(y * c.width + x) * 4 + 3] = 0;
        }
    }
    g.putImageData(id, 0, 0);
    byColor.set('__frost', c);
    return c;
}

function archetypeOf(enemy) {
    if (enemy.type === 'boss') return 'boss';
    if (enemy.baseArchetype && hasEnemyArchetype(enemy.baseArchetype)) return enemy.baseArchetype;
    if (enemy.isElite) return 'eliteGolem';
    return 'residue';
}

function bossTheme(enemy) {
    const id = String(enemy.bossType || enemy.bossId || '').toLowerCase();
    for (const k of Object.keys(BOSS_RAMP)) if (id.includes(k)) return BOSS_RAMP[k];
    return 'blood';
}

function digits(g, text, x, y, color, font = '5x7', align = 'left') {
    const c = getPixelTextCanvas(String(text), { font, color, outline: INK });
    let px = x;
    if (align === 'center') px -= c.width >> 1;
    else if (align === 'right') px -= c.width;
    g.drawImage(c, px | 0, y | 0);
    return c.width;
}

function fmt(n) {
    n = Math.max(0, Math.ceil(n || 0));
    if (n >= 10000) return `${Math.floor(n / 1000)}K`;
    if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
    return String(n);
}

function defenseItems(enemy) {
    const items = [];
    const affixes = enemy.affixes || [];
    const layers = Math.max(0, Math.floor(enemy.shieldCharges || 0));
    if (layers > 0) {
        const phase = affixes.includes('phaseShield');
        items.push({ icon: 'hex', ramp: phase ? (enemy.phaseShieldDisabledThisTurn ? 'slate' : 'arcane') : 'ice', value: layers });
    }
    if ((enemy.radiantAegis || 0) > 0 && !enemy.radiantAegisBroken) items.push({ icon: 'hex', ramp: 'brass', value: enemy.radiantAegis });
    if ((enemy.energyArmorShield || 0) > 0) items.push({ icon: 'shield', ramp: 'volt', value: enemy.energyArmorShield });
    if ((enemy.livingArmorHp || 0) > 0 && !enemy.livingArmorBroken) items.push({ icon: 'shield', ramp: 'venom', value: enemy.livingArmorHp });
    if ((enemy.wardBarrier || 0) > 0) items.push({ icon: 'slant', ramp: 'cyan', value: enemy.wardBarrier });
    return items;
}

const BASE_ONLY = new Set(['heavyArmor', 'deflectionWard', 'echoRelay', 'prism', 'hive', 'siege', 'carrier', 'gravityWell']);

function sideIcons(enemy) {
    const out = [];
    const t = enemy.temp || 0;
    if (t >= 24) out.push(getIcon('flame', 'fire', { dim: t < 34 }));
    else if (t <= -24) out.push(getIcon('snow', 'ice', { dim: t > -34 }));
    if ((enemy.venomStacks || 0) > 0) out.push({ icon: getIcon('drop', 'venom'), n: enemy.venomStacks });
    for (const a of enemy.affixes || []) {
        if (BASE_ONLY.has(a) || !AFFIX_STYLE[a]) continue;
        const ic = getAffixIcon(a);
        if (ic) out.push(ic);
    }
    return out;
}

// @perf-impact: 每个敌人每帧 1 次精灵 drawImage + 0–3 次剪影覆层 + 读数小画布（均缓存）；无渐变、无 shadowBlur、无粒子。
/**
 * 在当前上下文（逻辑坐标变换）下绘制敌人；内部转到缓冲像素空间。
 */
export function pxDrawEnemy(ctx, enemy) {
    if (!enemy.active) return;
    // 与原 draw 内的视觉计时器保持同步递减
    if (enemy.scanFeedbackTimer > 0) enemy.scanFeedbackTimer = Math.max(0, enemy.scanFeedbackTimer - 0.05);
    if (enemy._rotationFlashTimer > 0) enemy._rotationFlashTimer--;

    const m = ctx.getTransform();
    const s = Math.hypot(m.a, m.b) || 1;
    const cxL = enemy.pos.x + (enemy._blastOffsetX || 0);
    const cyL = enemy.pos.y + (enemy.bumpOffsetY || 0) + (enemy._blastOffsetY || 0);
    const cx = m.a * cxL + m.c * cyL + m.e;
    const cy = m.b * cxL + m.d * cyL + m.f;
    const wA = Math.max(8, Math.round((enemy.width - 2) * s));
    const hA = Math.max(8, Math.round((enemy.height - 2) * s));
    const now = performance.now();
    const seed = Math.floor((enemy.visualSeed || 0.37) * 9973);

    // 整像素动态
    let dx = 0;
    let dy = 0;
    const frozen = !!enemy.isFrozen || (enemy.temp || 0) <= -80;
    if (!frozen && enemy.actionPhase === 'idle' && !(enemy.hitTimer > 0)) {
        dy = (Math.floor(now / 520 + seed * 0.37) & 1) ? 0 : -1;
    }
    if (enemy.hitTimer > 0 || enemy._hitImpact > 0.05 || enemy._laserHitIntensity > 0.1 || enemy.actionPhase === 'telegraphing') {
        dx = (Math.floor(now / 50) & 1) ? 1 : -1;
    }
    let lift = 0;
    if (enemy._jumpFxTimer > 0 && enemy._jumpFxDuration > 0) {
        const p = 1 - enemy._jumpFxTimer / enemy._jumpFxDuration;
        const arc = Math.sin(Math.max(0, Math.min(1, p)) * Math.PI);
        lift = Math.round(Math.min(hA * 0.42, (18 + (enemy._jumpFxRows || 1) * 5) * s) * arc);
    }

    const arch = archetypeOf(enemy);
    const theme = arch === 'boss' ? bossTheme(enemy) : undefined;
    const sprite = getEnemySprite({ archetype: arch, w: wA, h: hA, elite: !!enemy.isElite, seed, theme });
    const bx = Math.round(cx - wA / 2) + dx;
    const by = Math.round(cy - hA / 2) + dy - lift;

    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.imageSmoothingEnabled = false;
    const alpha = Number.isFinite(enemy.alpha) ? Math.max(0, Math.min(1, enemy.alpha)) : 1;
    ctx.globalAlpha = alpha;

    if (lift > 0) {
        // 像素阴影：两行深色
        ctx.fillStyle = INK;
        const sw = Math.round(wA * 0.6);
        ctx.globalAlpha = alpha * 0.5;
        ctx.fillRect(Math.round(cx - sw / 2), Math.round(cy + hA / 2) - 1, sw, 2);
        ctx.globalAlpha = alpha;
    }
    ctx.drawImage(sprite, bx, by);

    // 状态覆层
    const t = enemy.temp || 0;
    if (frozen || t <= -67) {
        ctx.drawImage(frostOverlay(sprite), bx, by);
    }
    if (t >= 100 && (Math.floor(now / 160) & 1)) {
        ctx.globalAlpha = alpha * 0.55;
        ctx.drawImage(silhouette(sprite, RAMPS.fire[4]), bx, by);
        ctx.globalAlpha = alpha;
    }
    if (t >= 34) {
        // 火星：每帧确定性几颗
        const n = t >= 67 ? 4 : 2;
        for (let i = 0; i < n; i++) {
            const ph = (now / 900 + hash2(i, seed, 3)) % 1;
            const ex = bx + Math.round(hash2(i, seed, 7) * wA);
            const ey = by + Math.round(hA * (1 - ph)) - 2;
            ctx.fillStyle = ph < 0.5 ? RAMPS.fire[5] : RAMPS.fire[3];
            ctx.fillRect(ex, ey, 1, 1);
        }
    }
    if ((enemy.venomStacks || 0) > 0) {
        for (let i = 0; i < Math.min(3, enemy.venomStacks); i++) {
            const ph = (now / 700 + hash2(i, seed, 11)) % 1;
            const ex = bx + 3 + Math.round(hash2(i, seed, 13) * (wA - 6));
            ctx.fillStyle = RAMPS.venom[4];
            ctx.fillRect(ex, by + hA - 2 + Math.round(ph * 4), 1, 2);
        }
    }
    const hpRatio = enemy.maxHp > 0 ? enemy.hp / enemy.maxHp : 1;
    if (hpRatio < 0.3) {
        ctx.fillStyle = INK;
        for (let i = 0; i < 3; i++) {
            let x = bx + 4 + Math.round(hash2(i, seed, 21) * (wA - 10));
            let y = by + 4 + Math.round(hash2(seed, i, 23) * (hA - 10));
            for (let k = 0; k < 5; k++) {
                ctx.fillRect(x, y, 1, 1);
                if (hash2(k, i, seed) > 0.5) x++; else y++;
            }
        }
    }
    // 受击白闪（前 2 帧）
    if (enemy.hitTimer > 0 && (enemy.hitTimer > (enemy._hitFlashFrames || 8) - 3)) {
        ctx.drawImage(silhouette(sprite, '#ffffff'), bx, by);
    } else if (enemy._hitImpact > 0.25) {
        ctx.globalAlpha = alpha * 0.6;
        ctx.drawImage(silhouette(sprite, '#ffffff'), bx, by);
        ctx.globalAlpha = alpha;
    }
    // 预警：剪影闪边
    if (enemy.actionPhase === 'telegraphing' && (Math.floor(now / 120) & 1)) {
        ctx.globalAlpha = alpha * 0.35;
        ctx.drawImage(silhouette(sprite, (enemy.telegraphIntent && enemy.telegraphIntent.color) || '#ffffff'), bx, by);
        ctx.globalAlpha = alpha;
    }

    // ── 读数 ──
    if ((enemy.displayHp || 0) > 0) {
        const hpTxt = fmt(enemy.displayHp);
        const dropping = (enemy.displayHp - enemy.hp) > 0.5;
        const hpY = by + hA - 9;
        digits(ctx, hpTxt, Math.round(cx) + dx, hpY, dropping ? RAMPS.blood[5] : UI.textMain, '5x7', 'center');
        if (enemy.isElite || enemy.type === 'boss') {
            const barW = wA - 8;
            const bw = Math.max(0, Math.round(barW * Math.max(0, Math.min(1, hpRatio))));
            ctx.fillStyle = INK;
            ctx.fillRect(bx + 4, by + hA - 2, barW, 2);
            ctx.fillStyle = enemy.type === 'boss' ? RAMPS.blood[4] : RAMPS.brass[4];
            ctx.fillRect(bx + 4, by + hA - 2, bw, 2);
        }
    }
    // 左上：防御
    let ly = by + 2;
    defenseItems(enemy).slice(0, 2).forEach((it) => {
        ctx.drawImage(getIcon(it.icon, it.ramp), bx + 1, ly);
        digits(ctx, fmt(it.value), bx + 10, ly + 2, RAMPS[it.ramp][RAMPS[it.ramp].length - 1], '3x5');
        ly += 10;
    });
    // 右侧列：状态 + 词条
    const side = sideIcons(enemy);
    const maxSide = Math.max(1, Math.floor((hA - 12) / 10));
    side.slice(0, maxSide).forEach((it, i) => {
        const iy = by + 2 + i * 10;
        if (it.icon) {
            ctx.drawImage(it.icon, bx + wA - 10, iy);
            digits(ctx, it.n, bx + wA - 11, iy + 2, RAMPS.venom[5], '3x5', 'right');
        } else {
            ctx.drawImage(it, bx + wA - 10, iy);
        }
    });
    if (side.length > maxSide) digits(ctx, `+${side.length - maxSide}`, bx + wA - 2, by + 2 + maxSide * 10, UI.textSub, '3x5', 'right');
    // 右上（列下方）：行动倒计时
    const affixes = enemy.affixes || [];
    if ((enemy.type === 'boss' || affixes.includes('heavyArmor')) && Number.isFinite(enemy._moveCooldown)) {
        const willMove = enemy._willMoveThisTurn === true || enemy._moveCooldown <= 0;
        const iy = by - 9;
        ctx.drawImage(getIcon(willMove ? 'down' : 'hourglass', willMove ? 'blood' : 'slate'), bx + wA - 18, iy);
        if (!willMove) digits(ctx, enemy._moveCooldown, bx + wA - 8, iy + 1, UI.textMain);
    }
    // 头顶：预警意图
    if (enemy.actionPhase === 'telegraphing') {
        const intent = enemy.telegraphIntent || {};
        const key = String(intent.key || '');
        let iconName = 'eye';
        let ramp = 'blood';
        if (/heal|regen/.test(key)) { iconName = 'cross'; ramp = 'venom'; } else if (/haste/.test(key)) { iconName = 'speed'; ramp = 'volt'; } else if (/jump/.test(key)) { iconName = 'up'; ramp = 'ice'; } else if (/clone/.test(key)) { iconName = 'clone'; ramp = 'arcane'; } else if (/devour|maw/.test(key)) { iconName = 'maw'; ramp = 'blood'; } else if (/berserk/.test(key)) { iconName = 'flame'; ramp = 'blood'; }
        const ix = Math.round(cx) - 5;
        const iy = by - 12 - ((Math.floor(now / 240) & 1) ? 1 : 0);
        ctx.fillStyle = INK;
        ctx.fillRect(ix - 2, iy - 2, 13, 13);
        ctx.fillStyle = RAMPS[ramp][1];
        ctx.fillRect(ix - 1, iy - 1, 11, 11);
        ctx.drawImage(getIcon(iconName, ramp), ix, iy);
    }
    ctx.restore();
}
