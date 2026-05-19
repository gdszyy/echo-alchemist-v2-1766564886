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

    // ===== 1. 中心三层切片堆叠 =====
    // 用 echo_ring 粒子充当切片（已实现 expand + alpha decay 行为）
    for (let layer = 0; layer < 3; layer++) {
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
    const fragmentCount = perf.burstSmallN >= 10 ? 12 : 6;
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

/**
 * 全屏色差通道偏移：通过 body 添加临时 class，CSS filter 处理。
 * 闪电主体本身不偏移（粒子绘制时已写死无偏移）。
 *
 * @param {Game} game
 * @param {number} durationSec - 持续时间秒
 */
function _triggerChromaticAberration(game, durationSec = 0.15) {
    if (typeof document === 'undefined' || !document.body) return;
    // 用 dataset 计数防止多次触发叠加导致一直卡在 chromatic 态
    const body = document.body;
    body.classList.add('promare-chromatic');
    const stamp = Date.now();
    body.dataset.promareChromaticStamp = String(stamp);
    setTimeout(() => {
        // 仅在 stamp 仍是最新时移除，防止覆盖更晚触发的色差
        if (body.dataset.promareChromaticStamp === String(stamp)) {
            body.classList.remove('promare-chromatic');
            delete body.dataset.promareChromaticStamp;
        }
    }, Math.max(50, durationSec * 1000));
}
