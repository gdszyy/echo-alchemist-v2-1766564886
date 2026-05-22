/**
 * promare_explosion.js - 普罗米亚击杀爆炸特效
 *
 * 把《普罗米亚》视觉体系的「电磁爆炸」概念落地：
 *   - 几何符号叙事：方形（体制）→ 三角碎片（燃烧者突破）
 *   - 拼贴式高密度：3 层同心切片 + 三角碎片群 + 暗紫烟雾环 + 白色金田光斑
 *   - 故障艺术（色差通道偏移）：仅 pyro/lightning 元素触发，且闪电主体不偏移
 *
 * 调用契约：在 enemy:killed 事件触发，比常规 burst 更密集、更高对比。
 *
 * @perf-impact: 单次击杀 ≤20 粒子 + 3 shockwave + 4 金田光斑 + 6 三角碎片，
 *               额外 0.15s 色差闪烁（仅高档元素）。受 perfQualityLevel 约束。
 */

import { PROMARE_PALETTE, getPromarePerf, resolveElementKey } from './promare_tokens.js';

// 烟雾色（暗紫 / 灰蓝，《普罗米亚》冷色调对比前景高亮）
const SMOKE_COLORS = ['rgba(42, 10, 48, 0.55)', 'rgba(35, 30, 70, 0.45)', 'rgba(20, 20, 40, 0.5)'];

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
 * 击杀爆炸入口。在 enemy:killed 时调用，补在常规 burst 之上。
 *
 * @param {Game} game
 * @param {number} x
 * @param {number} y
 * @param {string} elementType
 * @param {{w?:number,h?:number}} [enemySize] - 用于决定爆炸尺寸（大 boss → 更大）
 */
export function spawnPromareKillExplosion(game, x, y, elementType, enemySize) {
    if (!game || typeof game.spawn_createParticle !== 'function') return;

    const elemKey = resolveElementKey(elementType);
    const palette = KILL_PALETTE[elemKey] || KILL_PALETTE.damage;
    const perf = getPromarePerf(game.perfQualityLevel || 'high');

    // 体积自适应：默认 32px，大型敌人 1.5×（最大 80）
    const baseR = Math.min(80, Math.max(28, ((enemySize && Math.max(enemySize.w || 0, enemySize.h || 0)) || 32) * 0.7));

    // [Promare kill-explosion budget guard] 满载时降级或跳过
    let downscale = 1.0;
    if (game.particles && Array.isArray(game.particles)) {
        const cfg = (typeof globalThis !== 'undefined' && globalThis.CONFIG && globalThis.CONFIG.performance)
            ? globalThis.CONFIG.performance : null;
        const budget = cfg ? (cfg[game.perfQualityLevel || 'high'] || {}).maxParticles : 800;
        if (budget) {
            const ratio = game.particles.length / budget;
            if (ratio > 0.95) return;       // 跳过整个爆炸
            if (ratio > 0.80) downscale = 0.4;
            else if (ratio > 0.60) downscale = 0.7;
        }
    }

    // ===== 1. 中心三层切片堆叠 =====
    // 用 echo_ring 粒子充当切片（已实现 expand + alpha decay 行为）
    const layerCount = downscale < 0.6 ? 1 : (downscale < 1.0 ? 2 : 3);
    for (let layer = 0; layer < layerCount; layer++) {
        const p = game.spawn_createParticle(x, y, palette[layer], 'echo_ring');
        if (p) {
            p.size = baseR * (1.0 + layer * 0.45);
            p._expandRate = 0.4 + layer * 0.3;
            p.life = 1.0 - layer * 0.15;
            p.maxLife = p.life;
            p.decay = 0.05 + layer * 0.01;
        }
    }

    // ===== 2. 方形破裂 → 三角碎片群（叙事核心：燃烧者突破体制）=====
    // 6-12 个 damage_diamond 粒子但配色为 palette[0]，360° 放射（不走方向锥）
    const fragmentCount = Math.max(3, Math.floor((perf.burstSmallN >= 10 ? 12 : 6) * downscale));
    for (let i = 0; i < fragmentCount; i++) {
        const a = (i / fragmentCount) * Math.PI * 2 + (Math.random() - 0.5) * 0.3;
        const sp = 3 + Math.random() * 4;
        const p = game.spawn_createParticle(x, y, palette[0], 'damage_diamond');
        if (p) {
            if (p.vel) {
                p.vel.x = Math.cos(a) * sp;
                p.vel.y = Math.sin(a) * sp;
            }
            p.size = baseR * 0.12 + Math.random() * baseR * 0.08;
            p.life = 1.4;
            p.maxLife = p.life;
            p.decay = 0.025;
            p.angle = a + Math.PI / 4; // 菱形指向飞行方向
            p.spin = (Math.random() - 0.5) * 0.2;
        }
    }

    // ===== 3. 暗紫烟雾环 — 冷色压制反衬前景高亮 =====
    // 用 Shockwave 类（系统已支持）但颜色改深紫
    if (typeof game.spawn_createShockwave === 'function') {
        for (let i = 0; i < Math.min(3, perf.radialSpokes / 3); i++) {
            const smokeColor = SMOKE_COLORS[i % SMOKE_COLORS.length];
            // Shockwave 类自带扩张行为；不同启动延迟造成层叠感
            const delay = i * 40;
            if (delay === 0) {
                game.spawn_createShockwave(x, y, smokeColor);
            } else if (perf.useStagger) {
                setTimeout(() => game.spawn_createShockwave(x, y, smokeColor), delay);
            }
        }
    }

    // ===== 4. 金田光斑：2-3 个白色 echo_ring，瞬时显现 =====
    // 用极小 life 模拟「闪现一帧」的金田光斑感
    const kanadaCount = perf.useStagger ? 3 : 1;
    for (let i = 0; i < kanadaCount; i++) {
        const off = (i - (kanadaCount - 1) / 2) * baseR * 0.8;
        const p = game.spawn_createParticle(x + off, y + (Math.random() - 0.5) * baseR * 0.3, PROMARE_PALETTE.WHITE, 'echo_ring');
        if (p) {
            p.size = baseR * (0.35 + Math.random() * 0.2);
            p._expandRate = 0.8;
            p.life = 0.45;
            p.maxLife = p.life;
            p.decay = 0.12;
        }
    }

    // ===== 5. 色差通道偏移（仅 pyro / lightning / scatter / bounce 触发）=====
    if (CHROMATIC_ELEMENTS.has(elemKey)) {
        _triggerChromaticAberration(game, 0.15);
    }
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
