/**
 * promare_explosion.js - 普罗米亚击杀爆炸特效（T2.A 时间线版）
 *
 * 设计：docs/promare_visual_design_v2.md §2.4 整段是这个文件的契约。
 *   "□（秩序）被 △（Burnish）切开 → 碎成 △（自由）" —— 整部电影的母题在这一帧上演。
 *
 * 时间线（每 5 frames = 83ms ≈ 1 个 12fps step）：
 *   t=0       hitstop + flashOverlay（已在 core.js 处理）
 *   t=83ms    [Frame 5]  切线 △ 沿入射反方向硬切显现，1.6× 敌人对角线长度
 *   t=166ms   [Frame 10] 切线 snap 消失；方块切片（4-6 □）开始向外漂
 *   t=250ms   [Frame 15] 方块切片消失；生成 16-24 △ 碎片（power-law 2 大 + 5 中 + 15 小）
 *   t=333ms   [Frame 20] 2-3 金田光斑（白 △，1 帧硬切显现）
 *   t=416ms+  [Frame 25+] 碎片继续 stepped 漂移，pop-hold-snap 消亡
 *   t=~1.5s              全部清场
 *
 * Boss 击杀：所有时长 ×2、切线 ×3、碎片 ×2，末段 +1 ○ 收束环（唯一合法 ○）。
 *
 * @perf-impact: 单次击杀 ≤32 粒子（4 切片 + 24 △ 碎片 + 3 金田）+ boss 末段 1 ○。
 *               受 perfQualityLevel + budget guard 约束，>95% 跳过整段。
 */

import { PROMARE_PALETTE, getPromarePerf, resolveElementKey } from './promare_tokens.js';

// 元素 key → 主碎片 mode（与 promare_burst.js ELEMENT_TO_MODE 同源）
const ELEMENT_TO_MODE = {
    pyro:         'pyro_cone',
    cryo:         'cryo_oct',
    lightning:    'thunder_z',
    pierce:       'pierce_lance',
    bounce:       'bounce_hex',
    scatter:      'scatter_star',
    damage:       'damage_diamond',
    wind:         'damage_diamond',     // wind_slash 不在 PROMARE_MODES，退化
    laser:        'laser_beam',
    venom:        'venom_tri',
    echo:         'damage_diamond',
    flying_sword: 'damage_diamond',
};

// 元素 → 中心切片三层主配色（《普罗米亚》强对比）
const KILL_PALETTE = {
    pyro:      [PROMARE_PALETTE.PINK,   PROMARE_PALETTE.YELLOW, PROMARE_PALETTE.WHITE],
    cryo:      [PROMARE_PALETTE.CYAN,   PROMARE_PALETTE.WHITE,  PROMARE_PALETTE.WHITE],
    lightning: [PROMARE_PALETTE.YELLOW, PROMARE_PALETTE.PINK,   PROMARE_PALETTE.WHITE],
    pierce:    [PROMARE_PALETTE.WHITE,  PROMARE_PALETTE.PINK,   PROMARE_PALETTE.YELLOW],
    bounce:    [PROMARE_PALETTE.PINK,   PROMARE_PALETTE.YELLOW, PROMARE_PALETTE.WHITE],
    scatter:   [PROMARE_PALETTE.YELLOW, PROMARE_PALETTE.PINK,   PROMARE_PALETTE.WHITE],
    damage:    [PROMARE_PALETTE.WHITE,  PROMARE_PALETTE.YELLOW, PROMARE_PALETTE.PINK],
    wind:      [PROMARE_PALETTE.CYAN,   PROMARE_PALETTE.WHITE,  PROMARE_PALETTE.PINK],
    laser:     [PROMARE_PALETTE.WHITE,  PROMARE_PALETTE.CYAN,   PROMARE_PALETTE.PINK],
    venom:     [PROMARE_PALETTE.YELLOW, PROMARE_PALETTE.PINK,   PROMARE_PALETTE.WHITE],
    echo:      [PROMARE_PALETTE.PINK,   PROMARE_PALETTE.CYAN,   PROMARE_PALETTE.WHITE],
};

// 哪些元素触发色差（pyro / lightning / scatter — 力量系）
const CHROMATIC_ELEMENTS = new Set(['pyro', 'lightning', 'scatter', 'bounce']);

/**
 * 击杀爆炸入口 — T2.A 时间线版。
 * Hitstop / flashOverlay / screenShake 由 core.js 在调用前处理；本函数只编排视觉时间线。
 *
 * @param {Game} game
 * @param {number} x
 * @param {number} y
 * @param {string} elementType
 * @param {{w?:number,h?:number,hitVel?:{x:number,y:number},isBoss?:boolean}} [enemyInfo]
 *        敌人尺寸 + 入射速度（决定切线方向）+ boss 标记（决定 ×2 时长 + 结尾 ○）
 */
export function spawnPromareKillExplosion(game, x, y, elementType, enemyInfo) {
    if (!game || typeof game.spawn_createParticle !== 'function') return;

    const elemKey = resolveElementKey(elementType);
    const palette = KILL_PALETTE[elemKey] || KILL_PALETTE.damage;
    const fragMode = ELEMENT_TO_MODE[elemKey] || 'damage_diamond';

    // 敌人尺寸 + isBoss 判定
    const enemyW = (enemyInfo && enemyInfo.w) || 64;
    const enemyH = (enemyInfo && enemyInfo.h) || 64;
    const enemyDiag = Math.hypot(enemyW, enemyH);
    const baseR = Math.min(80, Math.max(28, Math.max(enemyW, enemyH) * 0.7));
    // Boss 判定：显式 isBoss=true，或体积超过普通敌人 1.6× 阈值
    const isBoss = !!(enemyInfo && enemyInfo.isBoss) || Math.max(enemyW, enemyH) >= 100;
    const T = isBoss ? 2 : 1;  // 时长倍率

    // 入射反方向角（默认从下往上）
    const hv = (enemyInfo && enemyInfo.hitVel) || { x: 0, y: -1 };
    const cutAngle = Math.atan2(-hv.y, -hv.x);

    // [budget guard] 满载时降级或跳过
    let downscale = 1.0;
    if (game.particles && Array.isArray(game.particles)) {
        const cfg = (typeof globalThis !== 'undefined' && globalThis.CONFIG && globalThis.CONFIG.performance)
            ? globalThis.CONFIG.performance : null;
        const budget = cfg ? (cfg[game.perfQualityLevel || 'high'] || {}).maxParticles : 800;
        if (budget) {
            const ratio = game.particles.length / budget;
            if (ratio > 0.95) return;       // 跳过整段时间线
            if (ratio > 0.80) downscale = 0.4;
            else if (ratio > 0.60) downscale = 0.7;
        }
    }

    // ===== Frame 5 (t=83ms × T): 切线 △ 硬切显现 =====
    // boss 用 3 道切线（错开 22.5°），普通敌人 1 道
    const cutCount = isBoss ? 3 : 1;
    const cutLength = enemyDiag * 1.6;
    setTimeout(() => {
        for (let i = 0; i < cutCount; i++) {
            const aOffset = (i - (cutCount - 1) / 2) * (Math.PI / 8);
            _spawnCutLine(game, x, y, cutAngle + aOffset, cutLength, palette[0]);
        }
    }, 83 * T);

    // ===== Frame 10 (t=166ms × T): □ 方块切片向外漂 =====
    // boss 6 块、普通 4 块；颜色用敌人暗紫描边色（保留"秩序"残影）
    const shardCount = Math.max(2, Math.floor((isBoss ? 6 : 4) * downscale));
    const shardSize = Math.min(enemyW, enemyH) * 0.25;
    setTimeout(() => {
        for (let i = 0; i < shardCount; i++) {
            // 沿切线两侧扇形展开：±45°-±90°
            const a = cutAngle + (i / shardCount - 0.5) * Math.PI;
            _spawnSquareShard(game, x, y, shardSize, a, palette[2] || PROMARE_PALETTE.WHITE);
        }
    }, 166 * T);

    // ===== Frame 15 (t=250ms × T): 16-24 △ 碎片（power-law）=====
    const totalFragments = Math.floor((isBoss ? 32 : 20) * downscale);
    const largeN = Math.max(1, Math.floor(totalFragments * 0.12));
    const midN   = Math.max(2, Math.floor(totalFragments * 0.25));
    const smallN = totalFragments - largeN - midN;
    setTimeout(() => {
        // 大碎片（沿入射反方向 ±60° 锥，颜色 palette[0]）
        for (let i = 0; i < largeN; i++) {
            const a  = cutAngle + (Math.random() - 0.5) * (Math.PI * 0.66);
            const sp = 4 + Math.random() * 3;
            _spawnShatterTri(game, x, y, palette[0], fragMode, a, sp, 1.8, 1.2);
        }
        // 中碎片
        for (let i = 0; i < midN; i++) {
            const a  = cutAngle + (Math.random() - 0.5) * (Math.PI * 0.8);
            const sp = 3 + Math.random() * 3;
            _spawnShatterTri(game, x, y, palette[1] || palette[0], fragMode, a, sp, 1.0, 0.9);
        }
        // 小碎片（360° 全向）
        for (let i = 0; i < smallN; i++) {
            const a  = Math.random() * Math.PI * 2;
            const sp = 1.5 + Math.random() * 2.5;
            _spawnShatterTri(game, x, y, palette[2] || palette[0], fragMode, a, sp, 0.5, 0.7);
        }
    }, 250 * T);

    // ===== Frame 20 (t=333ms × T): 2-3 金田 △ flash =====
    const kanadaCount = Math.max(1, Math.floor((isBoss ? 5 : 3) * downscale));
    setTimeout(() => {
        for (let i = 0; i < kanadaCount; i++) {
            const offX = (Math.random() - 0.5) * baseR * 1.5;
            const offY = (Math.random() - 0.5) * baseR * 1.5;
            _spawnKanadaFlash(game, x + offX, y + offY, baseR * (0.25 + Math.random() * 0.15));
        }
    }, 333 * T);

    // ===== Boss 末段 (t=1500ms): ○ 收束环 — 整局游戏唯一合法 ○ =====
    if (isBoss) {
        setTimeout(() => {
            _spawnResolutionCircle(game, x, y, baseR * 3.5);
        }, 1500);
    }
}

// ==================== 内部 spawner helpers ====================

function _spawnCutLine(game, x, y, angle, length, color) {
    const p = game.spawn_createParticle(x, y, color || PROMARE_PALETTE.PINK, 'cut_line');
    if (!p) return;
    p.angle = angle;
    p.size = length / 2;  // particle.size = half-length
    if (p.vel) { p.vel.x = 0; p.vel.y = 0; }
}

function _spawnSquareShard(game, x, y, size, angle, color) {
    const p = game.spawn_createParticle(x, y, color, 'square_shard');
    if (!p) return;
    p.size = size;
    p.angle = angle;
    if (p.vel) {
        const sp = 1.8;  // 慢速 stepped 向外（与 5-frame 寿命匹配）
        p.vel.x = Math.cos(angle) * sp;
        p.vel.y = Math.sin(angle) * sp;
    }
}

function _spawnShatterTri(game, x, y, color, mode, angle, speed, sizeMult, lifeMult) {
    const p = game.spawn_createParticle(x, y, color, mode);
    if (!p) return;
    if (p.vel) {
        p.vel.x = Math.cos(angle) * speed;
        p.vel.y = Math.sin(angle) * speed;
    }
    p.size = (p.size || 2) * sizeMult;
    p.life = (p.life || 1) * lifeMult;
    p.maxLife = p.life;
    if (mode === 'pierce_lance' || mode === 'wind_slash') p.angle = angle;
}

function _spawnKanadaFlash(game, x, y, size) {
    const p = game.spawn_createParticle(x, y, PROMARE_PALETTE.WHITE, 'kanada_tri');
    if (!p) return;
    p.size = size;
}

function _spawnResolutionCircle(game, x, y, size) {
    const p = game.spawn_createParticle(x, y, PROMARE_PALETTE.WHITE, 'resolution_circle');
    if (!p) return;
    p.size = size;
}

// ==================== 元素拟声词字典（Promare 拟声词视觉化技法）====================

const ONOMATOPOEIA = {
    pyro:         { text: 'BURN!',    color: '#FF2EA6' },
    cryo:         { text: 'FREEZE!',  color: '#00B4FF' },
    lightning:    { text: 'ZAP!',     color: '#FFE94A' },
    pierce:       { text: 'PIERCE!',  color: '#FFFFFF' },
    bounce:       { text: 'BOUNCE!',  color: '#FF2EA6' },
    scatter:      { text: 'SPLIT!',   color: '#FFE94A' },
    damage:       { text: 'CRIT!',    color: '#FFFFFF' },
    wind:         { text: 'SLASH!',   color: '#00B4FF' },
    laser:        { text: 'FLASH!',   color: '#FFFFFF' },
    venom:        { text: 'POISON!',  color: '#FFE94A' },
    echo:         { text: 'ECHO!',    color: '#FF2EA6' },
    flying_sword: { text: 'STRIKE!',  color: '#FFFFFF' },
};

/**
 * 在击杀位置弹出 Promare 风格拟声词大字。
 * Boss / Elite 字号更大，普通敌人字号小。
 * 字由元素决定，颜色按 5 色家族路由。
 *
 * @param {Game} game
 * @param {number} x
 * @param {number} y
 * @param {string} elementType
 * @param {string} enemyType - 'normal' | 'elite' | 'boss'
 */
export function spawnPromareOnomatopoeia(game, x, y, elementType, enemyType) {
    if (!game || typeof game.spawn_createFloatingText !== 'function') return;
    const elemKey = resolveElementKey(elementType);
    const word = ONOMATOPOEIA[elemKey] || ONOMATOPOEIA.damage;

    // 字号阶梯：boss 64 / elite 44 / normal 28
    let fontSize = 28;
    if (enemyType === 'boss') fontSize = 64;
    else if (enemyType === 'elite') fontSize = 44;

    // FloatingText 已支持 promare 模式下的 Inter Mono + 4 偏移 stamp + 离散 scale snap
    const ft = game.floatingTexts;
    if (!ft) return;
    // 先用现有 spawn 创建，再修改 vel 让大字停得更久（不要一下飘上去）
    game.spawn_createFloatingText(x, y, word.text, word.color, fontSize);
    const created = ft[ft.length - 1];
    if (created) {
        // Boss 拟声词：飘升更慢、寿命更长，停在屏幕中央更久让玩家看清
        if (enemyType === 'boss') {
            if (created.vel) { created.vel.x = 0; created.vel.y = -0.25; }
            // life decay 0.02/帧 → 50 帧 = ~830ms。boss 拟声词应该停 1.5s 才消散。
            // FloatingText.update 是 this.life -= 0.02 * timeScale，无法改 decay 系数，
            // 但可以直接抬高 life 初值（FloatingText.draw 中 globalAlpha = max(0, life)）。
            created.life = 1.8;
        } else if (enemyType === 'elite') {
            if (created.vel) { created.vel.x = 0; created.vel.y = -0.5; }
            created.life = 1.3;
        }
    }
}

/**
 * [Promare v2 F7] 色差通道偏移 — 已废弃为 no-op。
 *
 * 电影《普罗米亚》几乎完全不使用色差（chromatic aberration）—— 这个滤镜是"模拟廉价镜头"的
 * cinematography 语言，与 Promare 的"平涂硬切"取向相反。原版在 pyro/lightning/scatter/bounce
 * 击杀时触发的 0.15s 全屏 RGB 分离是反 Promare 的"故障艺术"惯例，移除以恢复硬边色块。
 *
 * 调用位置（_triggerChromaticAberration / CHROMATIC_ELEMENTS）保持兼容，但不再产生效果。
 * 击杀冲击感由 hitstop + flashRect + 大三角剪影碎裂承担（Tier 2 落地）。
 *
 * @param {Game} _game
 * @param {number} _durationSec
 */
function _triggerChromaticAberration(_game, _durationSec = 0.15) {
    // intentionally empty — see comment above
}
