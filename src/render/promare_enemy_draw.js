/**
 * promare_enemy_draw.js - 普罗米亚风格敌人体（T2.B 方块底 + 词条 overlay 版）
 *
 * 设计契约：docs/promare_visual_design_v2.md §2.2 是这个文件的真理源。
 *   "敌人 = □" —— 方块底承载"体制 / 秩序"语义；元素词条以几何 overlay 贴在方块上
 *   不替换主体。击杀时方块被切线劈开碎成 △（在 promare_explosion.js 处理）。
 *
 * 视觉结构（从底到顶绘制）：
 *   1. 3-layer 方块堆叠（阴影 #2A0A4A 偏 (+3,+3) → 主体 #5C4B7A → 顶/左 1px 高光边）
 *   2. 暗紫 1px 整圈描边
 *   3. 1-2 个白 △ "目光" 在方块上半部（朝玩家方向）
 *   4. 状态 overlay（pyro burn / cryo freeze / lightning / venom）
 *   5. HP 条（底向上白矩形 + 延迟差额）
 *   6. Boss 专属 glyph（drawPromareBoss）
 *   7. 词条 overlay（10 种 affix）
 *
 * Boss 例外（BOSS_REPLACES_BASE）：boss_micro / boss_tesla / boss_chimera / boss_ouroboros
 *   这 4 个 boss 的主体本身是方块组合 / 嵌套 / 拼接 / 环列 —— 由 drawPromareBoss 自己画整体；
 *   drawPromareEnemyBody 跳过 3-layer base 直接走 boss glyph。
 *
 * F2/F4 兑现：所有 fill 走 source-over（无 lighter 加法），描边用主色暗调（非白）。
 *
 * @perf-impact: 单敌人每帧 3-5 fill + 2-3 stroke + 0-3 affix。比旧版多 1 fill（阴影层），
 *               但去掉了 lighter glow（省 1 复合 op），净持平。
 */

import { PROMARE_PALETTE } from './promare_tokens.js';
import { drawPromareBoss } from './promare_boss_draw.js';

// ==================== 配色 ====================

// 敌人主体色（按 type）—— 默认深灰紫，elite 稍亮，boss 稍深更饱
const ENEMY_BASE_COLOR = {
    normal:  '#5C4B7A',
    elite:   '#6B5896',
    boss:    '#4A2B72',
};
// 阴影色（深紫，整个 Promare 视觉的底基）
const SHADOW_COLOR = '#2A0A4A';
// 整圈描边（更暗的紫黑）
const OUTLINE_COLOR = '#1B0B2E';

// 哪些 boss 自己接管方块底（不用 3-layer 默认 base）
const BOSS_REPLACES_BASE = new Set([
    'boss_micro',      // 3×3 □ 网格
    'boss_tesla',      // 3 层嵌套 □
    'boss_chimera',    // 左 □ + 右 □ 拼接
    'boss_ouroboros',  // 8 □ 围环
]);

// 工具：把 hex 颜色亮化 factor 倍（用于高光边）
function _brighten(hex, factor) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    const rb = Math.min(255, Math.floor(r * factor));
    const gb = Math.min(255, Math.floor(g * factor));
    const bb = Math.min(255, Math.floor(b * factor));
    return `rgb(${rb}, ${gb}, ${bb})`;
}

// ==================== 主入口 ====================

// 调用契约：调用方已经 ctx.save() / translate / scale / rotate 到敌人本地坐标系。
// 我们只画本地坐标里的几何，画完不 restore（调用方负责）。
export function drawPromareEnemyBody(enemy, ctx, w, h) {
    const isBoss = enemy.type === 'boss';
    const bossReplacesBase = isBoss && BOSS_REPLACES_BASE.has(enemy.bossType);

    // ===== 1-3. 方块底 + 目光 △（除非 boss 自己接管）=====
    if (!bossReplacesBase) {
        _drawSquareStack(ctx, w, h, enemy);
        _drawEyeTriangles(ctx, w, h, enemy);
    }

    // ===== 4. 状态 overlay（元素附着）=====
    if (enemy.isFrozenCurrentTurn || (enemy.frozenCount && enemy.frozenCount > 0)) {
        _drawCryoOverlay(ctx, w, h);
    }
    if (enemy.temp && enemy.temp > 30) {
        _drawPyroOverlay(ctx, w, h);
    }
    if (enemy.venomStacks && enemy.venomStacks > 0) {
        _drawVenomOverlay(ctx, w, h);
    }
    // lightning 状态：用 _lightningHitTimer 衰减帧（如果系统跟踪）
    if (enemy._lightningStunFrames && enemy._lightningStunFrames > 0) {
        _drawLightningOverlay(ctx, w, h);
    }

    // ===== 5. HP 条 =====
    if (enemy.maxHp && enemy.hp !== undefined) {
        _drawHpBar(ctx, w, h, enemy);
    }

    // ===== 6. Boss 专属 glyph =====
    if (isBoss && enemy.bossType) {
        drawPromareBoss(enemy, ctx, w, h);
    }

    // ===== 7. 词条 overlay 派发 =====
    if (Array.isArray(enemy.affixes) && enemy.affixes.length > 0) {
        const t = Date.now() / 1000;
        for (let i = 0; i < enemy.affixes.length; i++) {
            const affix = enemy.affixes[i];
            const drawer = AFFIX_DRAWERS[affix];
            if (drawer) drawer(ctx, w, h, t, enemy);
        }
    }
}

// ==================== 方块底 + 目光 △ ====================

function _drawSquareStack(ctx, w, h, enemy) {
    const mainColor = ENEMY_BASE_COLOR[enemy.type] || ENEMY_BASE_COLOR.normal;
    const highlightColor = _brighten(mainColor, 1.35);

    // 阴影层：偏移 (+3,+3) 的深紫方块
    ctx.fillStyle = SHADOW_COLOR;
    ctx.fillRect(-w / 2 + 3, -h / 2 + 3, w, h);

    // 主体方块
    ctx.fillStyle = mainColor;
    ctx.fillRect(-w / 2, -h / 2, w, h);

    // 整圈描边（暗紫黑）—— F4 暗调描边
    ctx.lineWidth = 2;
    ctx.strokeStyle = OUTLINE_COLOR;
    ctx.strokeRect(-w / 2, -h / 2, w, h);

    // 高光边：顶 + 左 1px（模拟"光从左上来"）
    ctx.lineWidth = 1;
    ctx.strokeStyle = highlightColor;
    ctx.beginPath();
    ctx.moveTo(-w / 2 + 1, h / 2 - 1);
    ctx.lineTo(-w / 2 + 1, -h / 2 + 1);
    ctx.lineTo(w / 2 - 1, -h / 2 + 1);
    ctx.stroke();
}

function _drawEyeTriangles(ctx, w, h, enemy) {
    // 1-2 个白 △ 在方块上半部：默认 2 只眼（敌人朝玩家"看"），boss 时也是 2 只
    // 三角顶点朝下（指向玩家在屏幕下方），底边在上
    const eyeSize = Math.min(w, h) * 0.07;
    const eyeY = -h * 0.18;
    const eyeOffset = w * 0.18;

    ctx.save();
    ctx.fillStyle = PROMARE_PALETTE.WHITE;
    ctx.strokeStyle = OUTLINE_COLOR;
    ctx.lineWidth = 1;

    // 左眼
    ctx.beginPath();
    ctx.moveTo(-eyeOffset, eyeY + eyeSize * 0.7);
    ctx.lineTo(-eyeOffset + eyeSize * 0.7, eyeY - eyeSize * 0.4);
    ctx.lineTo(-eyeOffset - eyeSize * 0.7, eyeY - eyeSize * 0.4);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // 右眼
    ctx.beginPath();
    ctx.moveTo(eyeOffset, eyeY + eyeSize * 0.7);
    ctx.lineTo(eyeOffset + eyeSize * 0.7, eyeY - eyeSize * 0.4);
    ctx.lineTo(eyeOffset - eyeSize * 0.7, eyeY - eyeSize * 0.4);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.restore();
}

// ==================== 状态 overlay（pyro / cryo / lightning / venom）====================

function _drawPyroOverlay(ctx, w, h) {
    // 3-5 个粉 △ 顶在方块上边，每 5 帧 stepped flicker（用帧序号决定 alpha）
    const frame = Math.floor(Date.now() / 83); // 12fps step
    const flicker = (frame % 2 === 0) ? 1.0 : 0.6;

    ctx.save();
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 0.9 * flicker;
    const triCount = 4;
    const tw = w / triCount;
    for (let i = 0; i < triCount; i++) {
        const cx = -w / 2 + i * tw + tw / 2;
        const ty = -h / 2;
        // 三角顶尖向上
        ctx.beginPath();
        ctx.moveTo(cx, ty - tw * 0.6);
        ctx.lineTo(cx + tw * 0.4, ty);
        ctx.lineTo(cx - tw * 0.4, ty);
        ctx.closePath();
        ctx.fillStyle = PROMARE_PALETTE.PINK;
        ctx.fill();
        // 内核黄
        ctx.beginPath();
        ctx.moveTo(cx, ty - tw * 0.35);
        ctx.lineTo(cx + tw * 0.2, ty - tw * 0.05);
        ctx.lineTo(cx - tw * 0.2, ty - tw * 0.05);
        ctx.closePath();
        ctx.fillStyle = PROMARE_PALETTE.YELLOW;
        ctx.fill();
    }
    ctx.restore();
}

function _drawCryoOverlay(ctx, w, h) {
    // 1 长菱形针穿对角（45° 横贯方块），青色 + 白核
    ctx.save();
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 0.85;

    const len = Math.hypot(w, h) * 0.6;
    const needleH = Math.min(w, h) * 0.08;

    ctx.rotate(Math.PI / 4); // 对角 45°
    // 外圈青菱形
    ctx.beginPath();
    ctx.moveTo(len, 0);
    ctx.lineTo(0, needleH);
    ctx.lineTo(-len, 0);
    ctx.lineTo(0, -needleH);
    ctx.closePath();
    ctx.fillStyle = PROMARE_PALETTE.CYAN;
    ctx.fill();
    ctx.strokeStyle = '#003E5C';
    ctx.lineWidth = 1;
    ctx.stroke();
    // 内核白
    ctx.beginPath();
    ctx.moveTo(len * 0.6, 0);
    ctx.lineTo(0, needleH * 0.4);
    ctx.lineTo(-len * 0.6, 0);
    ctx.lineTo(0, -needleH * 0.4);
    ctx.closePath();
    ctx.fillStyle = PROMARE_PALETTE.WHITE;
    ctx.fill();
    ctx.restore();
}

function _drawLightningOverlay(ctx, w, h) {
    // 1 Z 字横切方块中部，黄 + 白核；每 3 帧抖动 ±2px stepped
    const frame = Math.floor(Date.now() / 50);
    const jitterX = ((frame % 3) - 1) * 2;
    const jitterY = ((frame % 5) - 2) * 1;

    ctx.save();
    ctx.globalCompositeOperation = 'source-over';
    ctx.translate(jitterX, jitterY);

    const zw = w * 0.4;
    const zh = h * 0.08;
    ctx.beginPath();
    ctx.moveTo(-w / 2, -zh);
    ctx.lineTo(-zw * 0.3, zh * 0.5);
    ctx.lineTo(zw * 0.3, -zh * 0.5);
    ctx.lineTo(w / 2, zh);
    ctx.lineTo(zw * 0.3, zh * 1.5);
    ctx.lineTo(-zw * 0.3, zh * 0.5);
    ctx.closePath();
    ctx.fillStyle = PROMARE_PALETTE.YELLOW;
    ctx.fill();
    ctx.strokeStyle = '#5C5008';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.restore();
}

function _drawVenomOverlay(ctx, w, h) {
    // 底部铺贴 4 个倒 △，黄色，每个有粉色内核
    ctx.save();
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 0.85;
    const cnt = 4;
    const tw = w / cnt;
    for (let i = 0; i < cnt; i++) {
        const cx = -w / 2 + i * tw + tw / 2;
        const cy = h / 2 - tw * 0.3;
        // 黄色倒三角
        ctx.beginPath();
        ctx.moveTo(cx, cy + tw * 0.4);
        ctx.lineTo(cx + tw * 0.35, cy - tw * 0.2);
        ctx.lineTo(cx - tw * 0.35, cy - tw * 0.2);
        ctx.closePath();
        ctx.fillStyle = PROMARE_PALETTE.YELLOW;
        ctx.fill();
        // 粉色内核倒三角
        ctx.beginPath();
        ctx.moveTo(cx, cy + tw * 0.2);
        ctx.lineTo(cx + tw * 0.18, cy - tw * 0.05);
        ctx.lineTo(cx - tw * 0.18, cy - tw * 0.05);
        ctx.closePath();
        ctx.fillStyle = PROMARE_PALETTE.PINK;
        ctx.fill();
    }
    ctx.restore();
}

// ==================== HP 条（段化 ◆）====================
// 设计 §3.5：12 段小菱形，不是连续 bar；段减少时 1 帧 snap 消失（不 fade）。
// 横向排列在敌人方块底部（y = h/2 - segH * 1.2），不与目光/词条 overlay 冲突。

const HP_SEGMENTS = 12;

function _drawHpBar(ctx, w, h, enemy) {
    const hpRatio = Math.max(0, Math.min(1, (enemy.displayHp != null ? enemy.displayHp : enemy.hp) / enemy.maxHp));
    const delayedRatio = Math.max(0, Math.min(1, (enemy.delayedHp != null ? enemy.delayedHp / enemy.maxHp : hpRatio)));

    // 当前血量段数 + 延迟段数（用于"掉血动画"差额提示）
    const aliveCount   = Math.ceil(hpRatio * HP_SEGMENTS);
    const delayedCount = Math.ceil(delayedRatio * HP_SEGMENTS);

    // 段尺寸：横向 12 段铺满方块底部，每段是小 ◆
    const segPitch = w / HP_SEGMENTS;          // 每段中心间距
    const segR     = segPitch * 0.35;          // 单段菱形半径
    const segY     = h / 2 - segR * 2.0;       // 距底边稍高，避免出框

    ctx.save();
    ctx.lineWidth = 1;
    for (let i = 0; i < HP_SEGMENTS; i++) {
        const cx = -w / 2 + (i + 0.5) * segPitch;
        const alive   = i < aliveCount;
        const delayed = i < delayedCount;

        // 段菱形 path
        ctx.beginPath();
        ctx.moveTo(cx, segY - segR);
        ctx.lineTo(cx + segR, segY);
        ctx.lineTo(cx, segY + segR);
        ctx.lineTo(cx - segR, segY);
        ctx.closePath();

        if (alive) {
            // 存活段：白色实心 + 暗紫描
            ctx.fillStyle = PROMARE_PALETTE.WHITE;
            ctx.globalAlpha = 0.85;
            ctx.fill();
            ctx.strokeStyle = OUTLINE_COLOR;
            ctx.globalAlpha = 1.0;
            ctx.stroke();
        } else if (delayed) {
            // 延迟段（刚扣血但 displayHp 还没追上）：半透灰 + 暗描
            ctx.fillStyle = '#FFFFFF';
            ctx.globalAlpha = 0.35;
            ctx.fill();
            ctx.strokeStyle = OUTLINE_COLOR;
            ctx.globalAlpha = 0.7;
            ctx.stroke();
        } else {
            // 死段：只描边，不填
            ctx.strokeStyle = OUTLINE_COLOR;
            ctx.globalAlpha = 0.45;
            ctx.stroke();
        }
    }
    ctx.restore();
}

// ==================== 10 词缀 overlay drawer（F2 兑现：去 lighter）====================

const AFFIX_DRAWERS = {
    shield: (ctx, w, h /*, t */) => {
        // 第二层方块外框（偏移 +4px，白 1px 描边）
        ctx.save();
        ctx.globalAlpha = 0.75;
        ctx.strokeStyle = PROMARE_PALETTE.WHITE;
        ctx.lineWidth = 1;
        ctx.strokeRect(-w / 2 - 4, -h / 2 - 4, w + 8, h + 8);
        ctx.restore();
    },

    regen: (ctx, w, h, t) => {
        // 3 行向上滚动 chevron，stepped 每 10 帧 +4px
        const frame = Math.floor(t * 12);  // 12fps step
        const scrollOffset = ((frame * 4) % (h * 0.6));

        ctx.save();
        ctx.globalAlpha = 0.55;
        ctx.strokeStyle = PROMARE_PALETTE.WHITE;
        ctx.lineWidth = 2;
        const bandH = h * 0.2;
        for (let i = 0; i < 4; i++) {
            const yy = h / 2 - bandH * i - scrollOffset;
            if (yy < -h / 2 - bandH) continue;
            ctx.beginPath();
            ctx.moveTo(-w * 0.4, yy);
            ctx.lineTo(0, yy - bandH * 0.4);
            ctx.lineTo(w * 0.4, yy);
            ctx.stroke();
        }
        ctx.restore();
    },

    haste: (ctx, w, h, t) => {
        // 双 45° 斜条 stepped 位移，每 5 帧 +6px
        const frame = Math.floor(t * 12);
        const phase = ((frame * 6) % w);

        ctx.save();
        ctx.globalAlpha = 0.55;
        ctx.fillStyle = PROMARE_PALETTE.YELLOW;
        ctx.beginPath();
        ctx.rect(-w / 2, -h / 2, w, h);
        ctx.clip();
        ctx.translate(-phase, 0);
        const stripeW = 10;
        for (let i = -1; i < 3; i++) {
            const x0 = i * w * 0.5;
            ctx.beginPath();
            ctx.moveTo(x0, -h / 2);
            ctx.lineTo(x0 + stripeW, -h / 2);
            ctx.lineTo(x0 + h + stripeW, h / 2);
            ctx.lineTo(x0 + h, h / 2);
            ctx.closePath();
            ctx.fill();
        }
        ctx.restore();
    },

    clone: (ctx, w, h, t, enemy) => {
        // 右下角伸出 1 个微小子方块（主体色）
        const mainColor = ENEMY_BASE_COLOR[(enemy && enemy.type) || 'normal'];
        const subSize = Math.min(w, h) * 0.25;

        ctx.save();
        ctx.globalAlpha = 0.85;
        ctx.fillStyle = mainColor;
        ctx.fillRect(w / 2 - subSize * 0.3, h / 2 - subSize * 0.3, subSize, subSize);
        ctx.lineWidth = 1;
        ctx.strokeStyle = OUTLINE_COLOR;
        ctx.strokeRect(w / 2 - subSize * 0.3, h / 2 - subSize * 0.3, subSize, subSize);
        ctx.restore();
    },

    healer: (ctx, w, h) => {
        // 8 辐射线星爆 → 改为 4 个对称 △（保留"治疗光"语义但用三角表达）
        ctx.save();
        ctx.globalAlpha = 0.7;
        ctx.fillStyle = PROMARE_PALETTE.WHITE;
        const r = Math.min(w, h) * 0.18;
        const dirs = [
            { x: 0, y: -1 }, { x: 1, y: 0 },
            { x: 0, y: 1 }, { x: -1, y: 0 },
        ];
        for (const d of dirs) {
            ctx.save();
            ctx.translate(d.x * r * 1.4, d.y * r * 1.4);
            ctx.rotate(Math.atan2(d.y, d.x) + Math.PI / 2);
            ctx.beginPath();
            ctx.moveTo(0, -r * 0.6);
            ctx.lineTo(r * 0.3, r * 0.2);
            ctx.lineTo(-r * 0.3, r * 0.2);
            ctx.closePath();
            ctx.fill();
            ctx.restore();
        }
        ctx.restore();
    },

    devour: (ctx, w, h, t) => {
        // 4 角内向 chevron 指中心，每 8 帧抖动
        const frame = Math.floor(t * 12);
        const jitter = ((frame % 8) - 4) * 0.3;

        ctx.save();
        ctx.globalAlpha = 0.7;
        ctx.strokeStyle = PROMARE_PALETTE.PINK;
        ctx.lineWidth = 2;
        const corners = [
            { x: -w * 0.45, y: -h * 0.45, ax: 1, ay: 1 },
            { x:  w * 0.45, y: -h * 0.45, ax: -1, ay: 1 },
            { x:  w * 0.45, y:  h * 0.45, ax: -1, ay: -1 },
            { x: -w * 0.45, y:  h * 0.45, ax: 1, ay: -1 },
        ];
        const len = Math.min(w, h) * 0.18;
        for (const c of corners) {
            ctx.beginPath();
            ctx.moveTo(c.x + c.ax * jitter, c.y + c.ay * jitter);
            ctx.lineTo(c.x + c.ax * len, c.y);
            ctx.moveTo(c.x + c.ax * jitter, c.y + c.ay * jitter);
            ctx.lineTo(c.x, c.y + c.ay * len);
            ctx.stroke();
        }
        ctx.restore();
    },

    jump: (ctx, w, h, t) => {
        // 底部 3 行向上 chevron 梯（stepped pulse）
        const frame = Math.floor(t * 12);
        const pulseAlpha = (frame % 4 < 2) ? 0.7 : 0.5;

        ctx.save();
        ctx.globalAlpha = pulseAlpha;
        ctx.strokeStyle = PROMARE_PALETTE.YELLOW;
        ctx.lineWidth = 2;
        const stepY = h * 0.1;
        for (let i = 0; i < 3; i++) {
            const yy = h * 0.45 - i * stepY;
            ctx.beginPath();
            ctx.moveTo(-w * 0.3, yy);
            ctx.lineTo(0, yy - stepY * 0.4);
            ctx.lineTo(w * 0.3, yy);
            ctx.stroke();
        }
        ctx.restore();
    },

    berserk: (ctx, w, h, t) => {
        // 顶边横滚锯齿三角，每 5 帧 stepped 切显隐 + 位移
        const frame = Math.floor(t * 12);
        const visible = (frame % 2 === 0);
        if (!visible) return;
        const scrollX = (frame * 4) % w;

        ctx.save();
        ctx.globalAlpha = 0.85;
        ctx.fillStyle = PROMARE_PALETTE.PINK;
        const teeth = 10;
        const tw = w / teeth;
        ctx.beginPath();
        ctx.moveTo(-w / 2, -h * 0.5);
        for (let i = -1; i <= teeth; i++) {
            const x0 = -w / 2 + i * tw - scrollX;
            ctx.lineTo(x0 + tw / 2, -h * 0.5 - tw * 0.5);
            ctx.lineTo(x0 + tw, -h * 0.5);
        }
        ctx.lineTo(w / 2, -h * 0.5);
        ctx.lineTo(w / 2, -h * 0.55);
        ctx.lineTo(-w / 2, -h * 0.55);
        ctx.closePath();
        ctx.fill();
        // 黄内核（小一点的锯齿）
        ctx.globalAlpha = 0.65;
        ctx.fillStyle = PROMARE_PALETTE.YELLOW;
        ctx.beginPath();
        ctx.moveTo(-w / 2, -h * 0.5);
        for (let i = -1; i <= teeth; i++) {
            const x0 = -w / 2 + i * tw - scrollX;
            ctx.lineTo(x0 + tw / 2, -h * 0.5 - tw * 0.25);
            ctx.lineTo(x0 + tw, -h * 0.5);
        }
        ctx.closePath();
        ctx.fill();
        ctx.restore();
    },

    heavyArmor: (ctx, w, h) => {
        // 第二层方块外框（偏 +6px）+ 双 X 全身
        ctx.save();
        ctx.globalAlpha = 0.65;
        ctx.strokeStyle = PROMARE_PALETTE.WHITE;
        ctx.lineWidth = 1;
        // 外框
        ctx.strokeRect(-w / 2 - 6, -h / 2 - 6, w + 12, h + 12);
        // 双 X
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(-w * 0.4, -h * 0.4);
        ctx.lineTo(w * 0.4, h * 0.4);
        ctx.moveTo(w * 0.4, -h * 0.4);
        ctx.lineTo(-w * 0.4, h * 0.4);
        ctx.stroke();
        ctx.restore();
    },

    deflectionWard: (ctx, w, h) => {
        // 单 chevron + halo 环（halo 改为对角的两条线段，避免半圆）
        ctx.save();
        ctx.globalAlpha = 0.7;
        ctx.strokeStyle = PROMARE_PALETTE.CYAN;
        ctx.lineWidth = 2;
        // 上部 chevron
        ctx.beginPath();
        ctx.moveTo(-w * 0.25, -h * 0.15);
        ctx.lineTo(0, -h * 0.32);
        ctx.lineTo(w * 0.25, -h * 0.15);
        ctx.stroke();
        // 两侧短斜线（替换原 halo 圆弧 —— 避免引入圆语言）
        ctx.beginPath();
        ctx.moveTo(-w * 0.35, -h * 0.05);
        ctx.lineTo(-w * 0.42, -h * 0.18);
        ctx.moveTo(w * 0.35, -h * 0.05);
        ctx.lineTo(w * 0.42, -h * 0.18);
        ctx.stroke();
        ctx.restore();
    },
};
