/**
 * src/render/pixi_effect_adapter.js — 特效对象 PixiJS 渲染适配器
 *
 * [PixiJS 迁移 · 阶段三]
 *
 * 职责：
 *   - 为各类特效对象提供 PixiJS 渲染路径（替代 Canvas 2D 的 draw 方法）
 *   - 管理特效层 Sprite/Graphics 的生命周期
 *   - 统一处理 BLEND_MODES.ADD 替代 'lighter' 混合模式
 *
 * 迁移覆盖（按优先级）：
 *   - IceWave:     预烘焙冰晶环纹理 + Sprite（消除 createRadialGradient + lighter）
 *   - CollectionBeam: 预烘焙光柱纹理 + Sprite（消除 2 个渐变 + lighter）
 *   - HealWave:    预烘焙辉光/环纹理 + Sprite（消除 6 个渐变 + 2 个 shadowBlur）
 *   - LaserBeam:   PIXI.Graphics 多层辉光（消除 2 个 shadowBlur + lighter）
 *   - LightningBolt: PIXI.Graphics 批量线段（消除 N 个 shadowBlur）
 *
 * @module render/pixi_effect_adapter
 * @perf-impact: 本模块替代 Canvas 2D 特效渲染，消除 shadowBlur 和 per-frame 渐变
 */

import { pixiGetEffectContainer, pixiGetEffectTexture, pixiGetParticleTexture, pixiCssColor, pixiIsActive, pixiReleaseParticleSprite } from './pixi_bridge.js';

// ─── IceWave 适配器 ────────────────────────────────────────────

/**
 * 为 IceWave 实例创建 PixiJS 显示对象
 * @param {object} iceWave IceWave 实例
 * @returns {{ sprite: PIXI.Sprite, innerRing: PIXI.Sprite }|null}
 */
export function iceWave_pixiCreate(iceWave) {
    const container = pixiGetEffectContainer();
    if (!container) return null;

    const tex = pixiGetEffectTexture('iceRing');
    if (!tex) return null;

    const sprite = new PIXI.Sprite(tex);
    sprite.anchor.set(0.5);
    sprite.blendMode = PIXI.BLEND_MODES.ADD;
    container.addChild(sprite);

    // 内圈用同一个纹理但更小的尺寸 + 更高透明度
    const innerRing = new PIXI.Sprite(tex);
    innerRing.anchor.set(0.5);
    innerRing.blendMode = PIXI.BLEND_MODES.ADD;
    container.addChild(innerRing);

    return { sprite, innerRing };
}

/**
 * 每帧同步 IceWave PixiJS 显示对象属性
 * @param {object} iceWave IceWave 实例
 * @param {{ sprite: PIXI.Sprite, innerRing: PIXI.Sprite }} pixi PixiJS 对象
 */
export function iceWave_pixiSync(iceWave, pixi) {
    const { sprite, innerRing } = pixi;
    sprite.x = iceWave.x;
    sprite.y = iceWave.y;
    // Sprite 纹理是 128×128，需要按 radius*2 缩放
    const d = iceWave.radius * 2;
    sprite.width = d;
    sprite.height = d;
    sprite.alpha = Math.max(0, iceWave.life);

    const id = iceWave.innerRadius * 2;
    innerRing.x = iceWave.x;
    innerRing.y = iceWave.y;
    innerRing.width = id;
    innerRing.height = id;
    innerRing.alpha = Math.max(0, iceWave.innerLife * 0.8);
}

/**
 * 移除 IceWave PixiJS 显示对象
 */
export function iceWave_pixiDestroy(pixi) {
    if (!pixi) return;
    if (pixi.sprite) { pixi.sprite.destroy(); pixi.sprite = null; }
    if (pixi.innerRing) { pixi.innerRing.destroy(); pixi.innerRing = null; }
}

// ─── CollectionBeam 适配器 ─────────────────────────────────────

/**
 * 为 CollectionBeam 创建 PixiJS 显示对象
 * @param {object} beam CollectionBeam 实例
 * @returns {{ beamSprite: PIXI.Sprite, glowSprite: PIXI.Sprite }|null}
 */
export function collectionBeam_pixiCreate(beam) {
    const container = pixiGetEffectContainer();
    if (!container) return null;

    const beamTex = pixiGetEffectTexture('beam');
    const glowTex = pixiGetEffectTexture('glow');
    if (!beamTex || !glowTex) return null;

    // 光柱主体
    const beamSprite = new PIXI.Sprite(beamTex);
    beamSprite.anchor.set(0.5, 1); // 底部中心锚点
    beamSprite.blendMode = PIXI.BLEND_MODES.ADD;
    container.addChild(beamSprite);

    // 底部发光
    const glowSprite = new PIXI.Sprite(glowTex);
    glowSprite.anchor.set(0.5);
    glowSprite.blendMode = PIXI.BLEND_MODES.ADD;
    container.addChild(glowSprite);

    return { beamSprite, glowSprite };
}

/**
 * 每帧同步 CollectionBeam PixiJS 属性
 */
export function collectionBeam_pixiSync(beam, pixi) {
    const { beamSprite, glowSprite } = pixi;

    beamSprite.x = beam.x;
    beamSprite.y = beam.bottomY;
    beamSprite.width = beam.width;
    beamSprite.height = beam.height;
    beamSprite.alpha = Math.max(0, beam.life);

    glowSprite.x = beam.x;
    glowSprite.y = beam.bottomY;
    const glowSize = 80 * beam.life;
    glowSprite.width = glowSize;
    glowSprite.height = glowSize;
    glowSprite.alpha = Math.max(0, beam.life);
}

export function collectionBeam_pixiDestroy(pixi) {
    if (!pixi) return;
    if (pixi.beamSprite) { pixi.beamSprite.destroy(); pixi.beamSprite = null; }
    if (pixi.glowSprite) { pixi.glowSprite.destroy(); pixi.glowSprite = null; }
}

// ─── HealWave 适配器 ───────────────────────────────────────────

/**
 * 为 HealWave 创建 PixiJS 显示对象
 * @returns {{ glowSprite, ringSprite, innerRingSprite }|null}
 */
export function healWave_pixiCreate(healWave) {
    const container = pixiGetEffectContainer();
    if (!container) return null;

    const glowTex = pixiGetEffectTexture('healGlow');
    const ringTex = pixiGetEffectTexture('healRing');
    if (!glowTex || !ringTex) return null;

    const glowSprite = new PIXI.Sprite(glowTex);
    glowSprite.anchor.set(0.5);
    glowSprite.blendMode = PIXI.BLEND_MODES.ADD;
    container.addChild(glowSprite);

    const ringSprite = new PIXI.Sprite(ringTex);
    ringSprite.anchor.set(0.5);
    ringSprite.blendMode = PIXI.BLEND_MODES.ADD;
    container.addChild(ringSprite);

    const innerRingSprite = new PIXI.Sprite(ringTex);
    innerRingSprite.anchor.set(0.5);
    innerRingSprite.blendMode = PIXI.BLEND_MODES.ADD;
    container.addChild(innerRingSprite);

    return { glowSprite, ringSprite, innerRingSprite };
}

export function healWave_pixiSync(hw, pixi) {
    const { glowSprite, ringSprite, innerRingSprite } = pixi;

    // 中心辉光
    glowSprite.x = hw.x;
    glowSprite.y = hw.y;
    const gd = hw.glowRadius * 2;
    glowSprite.width = gd;
    glowSprite.height = gd;
    glowSprite.alpha = Math.max(0, hw.glowLife * 0.6);

    // 主环
    ringSprite.x = hw.x;
    ringSprite.y = hw.y;
    const rd = hw.radius * 2;
    ringSprite.width = rd;
    ringSprite.height = rd;
    ringSprite.alpha = Math.max(0, hw.life);

    // 内环
    innerRingSprite.x = hw.x;
    innerRingSprite.y = hw.y;
    const ird = hw.innerRadius * 2;
    innerRingSprite.width = ird;
    innerRingSprite.height = ird;
    innerRingSprite.alpha = Math.max(0, hw.innerLife * 0.7);
}

export function healWave_pixiDestroy(pixi) {
    if (!pixi) return;
    if (pixi.glowSprite) { pixi.glowSprite.destroy(); pixi.glowSprite = null; }
    if (pixi.ringSprite) { pixi.ringSprite.destroy(); pixi.ringSprite = null; }
    if (pixi.innerRingSprite) { pixi.innerRingSprite.destroy(); pixi.innerRingSprite = null; }
}

// ─── LaserBeam 适配器 ──────────────────────────────────────────

/**
 * 为 LaserBeam 创建 PIXI.Graphics（每帧重绘线段）
 * @returns {{ gfx: PIXI.Graphics }|null}
 */
export function laserBeam_pixiCreate() {
    const container = pixiGetEffectContainer();
    if (!container) return null;

    const gfx = new PIXI.Graphics();
    gfx.blendMode = PIXI.BLEND_MODES.ADD;
    container.addChild(gfx);
    return { gfx };
}

/**
 * 每帧重绘 LaserBeam 的线段（三层辉光替代 shadowBlur）
 */
export function laserBeam_pixiSync(lb, pixi) {
    const gfx = pixi.gfx;
    if (!gfx) return;

    gfx.clear();
    if (lb.life <= 0 || lb.segments.length < 2) return;

    const opacity = Math.pow(lb.life, 0.5);
    const currentWidth = lb.initialWidth * lb.life;
    const color = pixiCssColor(lb.color);

    // 第 1 层：外辉光（宽 + 低透明度）
    gfx.lineStyle(currentWidth * 2.5, color, opacity * 0.3);
    gfx.moveTo(lb.segments[0].x, lb.segments[0].y);
    for (let i = 1; i < lb.segments.length; i++) {
        gfx.lineTo(lb.segments[i].x, lb.segments[i].y);
    }

    // 第 2 层：中间层
    gfx.lineStyle(currentWidth * 1.5, color, opacity * 0.6);
    gfx.moveTo(lb.segments[0].x, lb.segments[0].y);
    for (let i = 1; i < lb.segments.length; i++) {
        gfx.lineTo(lb.segments[i].x, lb.segments[i].y);
    }

    // 第 3 层：核心（窄 + 高亮度白色）
    gfx.lineStyle(currentWidth, 0xFFFFFF, opacity);
    gfx.moveTo(lb.segments[0].x, lb.segments[0].y);
    for (let i = 1; i < lb.segments.length; i++) {
        gfx.lineTo(lb.segments[i].x, lb.segments[i].y);
    }
}

export function laserBeam_pixiDestroy(pixi) {
    if (!pixi) return;
    if (pixi.gfx) { pixi.gfx.destroy(); pixi.gfx = null; }
}

// ─── LightningBolt 适配器 ──────────────────────────────────────

/**
 * 为 LightningBolt 创建 PIXI.Graphics
 * @returns {{ gfx: PIXI.Graphics }|null}
 */
export function lightningBolt_pixiCreate() {
    const container = pixiGetEffectContainer();
    if (!container) return null;

    const gfx = new PIXI.Graphics();
    gfx.blendMode = PIXI.BLEND_MODES.ADD;
    container.addChild(gfx);
    return { gfx };
}

/**
 * 每帧重绘 LightningBolt 线段（三层辉光替代 per-segment shadowBlur）
 */
export function lightningBolt_pixiSync(bolt, pixi) {
    const gfx = pixi.gfx;
    if (!gfx) return;

    gfx.clear();
    if (bolt.life <= 0) return;

    const flicker = Math.random() > 0.5 ? 1 : 0.5;
    const opacity = bolt.life * flicker;
    const visibleCount = Math.min(
        bolt.segments.length,
        Math.floor(bolt.segments.length * bolt.progress)
    );

    // 第 1 层：紫色外辉光（批量绘制所有可见线段）
    for (let i = 0; i < visibleCount; i++) {
        const seg = bolt.segments[i];
        if (!seg) continue;
        gfx.lineStyle(seg.width * 4, 0xC084FC, opacity * seg.alpha * 0.5);
        gfx.moveTo(seg.p1.x, seg.p1.y);
        gfx.lineTo(seg.p2.x, seg.p2.y);
    }

    // 第 2 层：白色核心
    for (let i = 0; i < visibleCount; i++) {
        const seg = bolt.segments[i];
        if (!seg) continue;
        gfx.lineStyle(seg.width, 0xFFFFFF, opacity * seg.alpha);
        gfx.moveTo(seg.p1.x, seg.p1.y);
        gfx.lineTo(seg.p2.x, seg.p2.y);
    }

    // 端点发光球
    if (bolt.progress > 0.8) {
        gfx.lineStyle(0);
        gfx.beginFill(0xFFFFFF, opacity);
        gfx.drawCircle(bolt.start.x, bolt.start.y, 3);
        gfx.drawCircle(bolt.end.x, bolt.end.y, 4);
        gfx.endFill();
    }
}

export function lightningBolt_pixiDestroy(pixi) {
    if (!pixi) return;
    if (pixi.gfx) { pixi.gfx.destroy(); pixi.gfx = null; }
}

// ─── Shockwave 适配器 ────────────────────────────────────────────

export function shockwave_pixiCreate(sw) {
    const container = pixiGetEffectContainer();
    if (!container) return null;

    const ringTex = pixiGetEffectTexture('shockwaveRing');
    const ringSprite = ringTex ? new PIXI.Sprite(ringTex) : null;
    if (ringSprite) {
        ringSprite.anchor.set(0.5);
        ringSprite.blendMode = PIXI.BLEND_MODES.ADD;
        container.addChild(ringSprite);
    }

    const gfx = new PIXI.Graphics();
    gfx.blendMode = PIXI.BLEND_MODES.ADD;
    container.addChild(gfx);

    return { ringSprite, gfx, arcJitter: sw.arcJitter, spokes: sw.spokes, seed: sw.seed };
}

export function shockwave_pixiSync(sw, pixi) {
    const { ringSprite, gfx } = pixi;
    if (sw.alpha <= 0) { if (gfx) gfx.clear(); if (ringSprite) ringSprite.alpha = 0; return; }

    const radius = Math.max(0.1, sw.radius);
    const t = Math.min(1, radius / sw.maxRadius);
    const color = pixiCssColor(sw.color);

    // 预烘焙环形纹理
    if (ringSprite) {
        ringSprite.x = sw.x;
        ringSprite.y = sw.y;
        const d = (radius + 24) * 2;
        ringSprite.width = d;
        ringSprite.height = d;
        ringSprite.alpha = sw.alpha * 0.35;
        ringSprite.tint = color;
    }

    gfx.clear();

    // 7 段弧形辉光（三层替代 shadowBlur）
    for (const arc of sw.arcJitter) {
        const r = Math.max(0.1, radius + Math.sin(sw.seed + arc.start + t * 5) * 3);
        const a = sw.alpha * arc.weight;
        const lw = 4.5 * arc.weight * (1 - t * 0.35);
        const startAngle = arc.start;
        const endAngle = arc.start + arc.span;

        // 外辉光
        gfx.lineStyle(lw * 2.5, color, a * 0.3);
        gfx.arc(sw.x, sw.y, r, startAngle, endAngle);
        // 中层
        gfx.lineStyle(lw * 1.5, color, a * 0.6);
        gfx.arc(sw.x, sw.y, r, startAngle, endAngle);
        // 核心
        gfx.lineStyle(lw, 0xFFFFFF, a);
        gfx.arc(sw.x, sw.y, r, startAngle, endAngle);
    }

    // 内圈白环
    gfx.lineStyle(1.5, 0xFFFFFF, sw.alpha * 0.58);
    gfx.drawCircle(sw.x, sw.y, Math.max(0.1, radius - 10));

    // 8 条辐射线
    for (const spoke of sw.spokes) {
        const inner = radius * 0.45;
        const outer = radius * spoke.reach;
        const fade = sw.alpha * (1 - t * 0.45);
        const cos = Math.cos(spoke.angle), sin = Math.sin(spoke.angle);
        gfx.lineStyle(spoke.width, color, fade * 0.42);
        gfx.moveTo(sw.x + cos * inner, sw.y + sin * inner);
        gfx.lineTo(sw.x + cos * outer, sw.y + sin * outer);
    }
}

export function shockwave_pixiDestroy(pixi) {
    if (!pixi) return;
    if (pixi.ringSprite) { pixi.ringSprite.destroy(); pixi.ringSprite = null; }
    if (pixi.gfx) { pixi.gfx.destroy(); pixi.gfx = null; }
}

// ─── FireWave 适配器 ─────────────────────────────────────────────

export function fireWave_pixiCreate(fw) {
    const container = pixiGetEffectContainer();
    if (!container) return null;

    const fireTex = pixiGetEffectTexture('fireRing');
    const fireSprite = fireTex ? new PIXI.Sprite(fireTex) : null;
    if (fireSprite) {
        fireSprite.anchor.set(0.5);
        fireSprite.blendMode = PIXI.BLEND_MODES.ADD;
        container.addChild(fireSprite);
    }

    const gfx = new PIXI.Graphics();
    gfx.blendMode = PIXI.BLEND_MODES.ADD;
    container.addChild(gfx);

    return { fireSprite, gfx, flameArcs: fw.flameArcs, seed: fw.seed };
}

export function fireWave_pixiSync(fw, pixi) {
    const { fireSprite, gfx } = pixi;
    if (fw.life <= 0) { if (gfx) gfx.clear(); if (fireSprite) fireSprite.alpha = 0; return; }

    const t = Math.min(1, fw.radius / fw.maxRadius);

    // 预烘焙火焰环纹理
    if (fireSprite) {
        fireSprite.x = fw.x;
        fireSprite.y = fw.y;
        const d = fw.radius * 2.1;
        fireSprite.width = d;
        fireSprite.height = d;
        fireSprite.alpha = fw.life * 0.4;
    }

    gfx.clear();

    // 9 段火焰弧（三层辉光替代 shadowBlur）
    for (const arc of fw.flameArcs) {
        const r = fw.radius * arc.lift;
        const a = fw.life * (0.72 + 0.28 * arc.lift);
        const lw = 4.2 * (1 - t * 0.25);
        const arcColor = arc.lift > 1 ? 0xEF4444 : 0xF97316;
        gfx.lineStyle(lw * 2, arcColor, a * 0.3);
        gfx.arc(fw.x, fw.y, r, arc.start, arc.start + arc.span);
        gfx.lineStyle(lw, arcColor, a);
        gfx.arc(fw.x, fw.y, r, arc.start, arc.start + arc.span);
    }

    // 8 条辐射线（暖色系）
    const spokeCount = 8;
    for (let i = 0; i < spokeCount; i++) {
        const a = fw.seed + i * Math.PI * 2 / spokeCount + t * 0.25;
        const inner = fw.radius * 0.32;
        const outer = fw.radius * (0.72 + (i % 3) * 0.08);
        const fade = fw.life * 0.45;
        const cos = Math.cos(a), sin = Math.sin(a);
        gfx.lineStyle(1.7, 0xFDBA74, fade);
        gfx.moveTo(fw.x + cos * inner, fw.y + sin * inner);
        gfx.lineTo(fw.x + cos * outer, fw.y + sin * outer);
    }

    // 内弧线
    gfx.lineStyle(1.5, 0xFDE68A, fw.life * 0.55);
    gfx.arc(fw.x, fw.y, fw.radius * 0.55, fw.seed + t, fw.seed + t + Math.PI * 1.35);
}

export function fireWave_pixiDestroy(pixi) {
    if (!pixi) return;
    if (pixi.fireSprite) { pixi.fireSprite.destroy(); pixi.fireSprite = null; }
    if (pixi.gfx) { pixi.gfx.destroy(); pixi.gfx = null; }
}

// ─── DeathExplosion 适配器 ────────────────────────────────────────

export function deathExplosion_pixiCreate(de) {
    const container = pixiGetEffectContainer();
    if (!container) return null;

    const gfx = new PIXI.Graphics();
    gfx.blendMode = PIXI.BLEND_MODES.ADD;
    container.addChild(gfx);
    return { gfx, tier: de.tier };
}

export function deathExplosion_pixiSync(de, pixi) {
    const gfx = pixi.gfx;
    if (!gfx) return;
    gfx.clear();
    if (de.life <= 0) return;

    const t = Math.min(1, de.timer / (1 / de.decay));

    // 1. Boss 膨胀阶段
    if (de.expanding && de.expandR > 0) {
        const et = de.expandR / de.expandMax;
        const ringAlpha = (1 - et) * 0.7;
        // 外环（三层辉光）
        gfx.lineStyle(5 * (1 - et * 0.5) * 2.5, 0xFCA5A5, ringAlpha * 0.3);
        gfx.drawCircle(de.x, de.y, de.expandR);
        gfx.lineStyle(5 * (1 - et * 0.5), 0xFCA5A5, ringAlpha);
        gfx.drawCircle(de.x, de.y, de.expandR);
        // 中心辉光
        gfx.beginFill(0xFBB03C, ringAlpha * 0.15);
        gfx.drawCircle(de.x, de.y, de.expandR);
        gfx.endFill();
    }

    // 1b. 精英紫晶裂解
    if (de.tier === 'elite') {
        // 核心裂隙辉光
        gfx.lineStyle(0);
        gfx.beginFill(0xC084FC, de.life * 0.28);
        const hw = 42, hh = 6 + t * 6;
        gfx.drawEllipse(de.x, de.y, hw, hh);
        gfx.endFill();

        // 5 条裂痕线（三层辉光替代 shadowBlur）
        for (const cut of de.eliteCuts) {
            const localT = Math.min(1, t * 1.25);
            const half = cut.length * (0.35 + localT * 0.65) / 2;
            const ca = Math.cos(cut.angle), sa = Math.sin(cut.angle);
            const ox = -sa * cut.offset, oy = ca * cut.offset;
            const cutColor = cut.alpha > 0.72 ? 0xFFFFFF : 0xC084FC;
            gfx.lineStyle(2.2 * 2, 0xC084FC, cut.alpha * de.life * 0.3);
            gfx.moveTo(de.x + ox - ca * half, de.y + oy - sa * half);
            gfx.lineTo(de.x + ox + ca * half, de.y + oy + sa * half);
            gfx.lineStyle(2.2, cutColor, cut.alpha * de.life);
            gfx.moveTo(de.x + ox - ca * half, de.y + oy - sa * half);
            gfx.lineTo(de.x + ox + ca * half, de.y + oy + sa * half);
        }

        // 12 碎片三角形
        for (const shard of de.eliteShards) {
            const sx = de.x + Math.cos(de.eliteFractureAngle) * shard.along - Math.sin(de.eliteFractureAngle) * (Math.sin(shard.angle - de.eliteFractureAngle) * shard.dist);
            const sy = de.y + Math.sin(de.eliteFractureAngle) * shard.along + Math.cos(de.eliteFractureAngle) * (Math.sin(shard.angle - de.eliteFractureAngle) * shard.dist);
            const s = shard.size;
            gfx.beginFill(pixiCssColor(shard.color), shard.alpha * de.life);
            gfx.moveTo(sx - s, sy);
            gfx.lineTo(sx + s * 0.95, sy - s * 0.58);
            gfx.lineTo(sx + s * 0.35, sy + s * 1.05);
            gfx.closePath();
            gfx.endFill();
        }
    }

    // 2. 内爆收缩环
    if (de.collapseStarted) {
        for (const ring of de.collapseRings) {
            if (ring.r <= 0) continue;
            const maxR = de.tier === 'boss' ? 90 : 28;
            const progress = 1 - ring.r / maxR;
            const ringAlpha = ring.alpha * Math.min(1, progress * 2) * Math.max(0, de.life);
            gfx.lineStyle(ring.lw * (0.5 + progress * 0.5) * 2, pixiCssColor(ring.color), ringAlpha * 0.3);
            gfx.drawCircle(de.x, de.y, ring.r);
            gfx.lineStyle(ring.lw * (0.5 + progress * 0.5), pixiCssColor(ring.color), ringAlpha);
            gfx.drawCircle(de.x, de.y, ring.r);
        }
    }

    // 3. 虚空孔洞
    if (de.voidEnabled && de.voidLife > 0 && de.voidRadius > 0) {
        const vl = Math.max(0, de.voidLife);
        const voidColor = de.tier === 'boss' ? 0x782828 : (de.tier === 'elite' ? 0x581C87 : 0x1E1E28);
        gfx.beginFill(voidColor, vl * 0.45);
        gfx.drawCircle(de.x, de.y, de.voidRadius * 2.5);
        gfx.endFill();
        gfx.beginFill(voidColor, vl * 0.85);
        gfx.drawCircle(de.x, de.y, de.voidRadius * 0.6);
        gfx.endFill();
    }

    // 4. 灵魂粒子
    for (const s of de.souls) {
        if (s.dist <= 0) continue;
        const sx = de.x + Math.cos(s.angle) * s.dist;
        const sy = de.y + Math.sin(s.angle) * s.dist;
        const maxDist = de.tier === 'boss' ? 90 : 28;
        const distRatio = s.dist / maxDist;
        const sAlpha = s.alpha * distRatio * Math.max(0, de.life);
        gfx.beginFill(pixiCssColor(s.color), Math.max(0, sAlpha));
        gfx.drawCircle(sx, sy, s.size);
        gfx.endFill();
    }
}

export function deathExplosion_pixiDestroy(pixi) {
    if (!pixi) return;
    if (pixi.gfx) { pixi.gfx.destroy(); pixi.gfx = null; }
}

// ─── SlashEffect 适配器 ──────────────────────────────────────────

export function slashEffect_pixiCreate(se) {
    const container = pixiGetEffectContainer();
    if (!container) return null;

    const spindleTex = pixiGetEffectTexture('slashSpindle');
    const coreSprite = spindleTex ? new PIXI.Sprite(spindleTex) : null;
    if (coreSprite) {
        coreSprite.anchor.set(0.5);
        coreSprite.blendMode = PIXI.BLEND_MODES.ADD;
        container.addChild(coreSprite);
    }

    const glowSprite = spindleTex ? new PIXI.Sprite(spindleTex) : null;
    if (glowSprite) {
        glowSprite.anchor.set(0.5);
        glowSprite.blendMode = PIXI.BLEND_MODES.ADD;
        container.addChild(glowSprite);
    }

    return { coreSprite, glowSprite };
}

export function slashEffect_pixiSync(se, pixi) {
    const { coreSprite, glowSprite } = pixi;
    if (!se.active || se.life <= 0) {
        if (coreSprite) coreSprite.alpha = 0;
        if (glowSprite) glowSprite.alpha = 0;
        return;
    }

    const currentW = se.width * se.life;

    if (coreSprite) {
        coreSprite.x = se.x;
        coreSprite.y = se.y;
        coreSprite.rotation = se.angle;
        coreSprite.width = se.length;
        coreSprite.height = currentW * 2;
        coreSprite.alpha = Math.max(0, se.life);
        coreSprite.tint = 0xFFFFFF;
    }

    if (glowSprite) {
        glowSprite.x = se.x;
        glowSprite.y = se.y;
        glowSprite.rotation = se.angle;
        glowSprite.width = se.length + 40;
        glowSprite.height = currentW * 5;
        glowSprite.alpha = Math.max(0, se.life * 0.6);
        glowSprite.tint = pixiCssColor(se.color);
    }
}

export function slashEffect_pixiDestroy(pixi) {
    if (!pixi) return;
    if (pixi.coreSprite) { pixi.coreSprite.destroy(); pixi.coreSprite = null; }
    if (pixi.glowSprite) { pixi.glowSprite.destroy(); pixi.glowSprite = null; }
}

// ─── PierceCutEffect 适配器 ──────────────────────────────────────

export function pierceCutEffect_pixiCreate(pce) {
    const container = pixiGetEffectContainer();
    if (!container) return null;

    const gfx = new PIXI.Graphics();
    gfx.blendMode = PIXI.BLEND_MODES.ADD;
    container.addChild(gfx);
    return { gfx };
}

export function pierceCutEffect_pixiSync(pce, pixi) {
    const gfx = pixi.gfx;
    if (!gfx) return;
    gfx.clear();
    if (!pce.active || pce.life <= 0) return;

    const t = Math.min(1, pce.age / pce.duration);
    const open = Math.sin(t * Math.PI) * 8;
    const halfL = pce.length / 2;
    const color = pixiCssColor(pce.color);
    const cos = Math.cos(pce.angle), sin = Math.sin(pce.angle);

    // 辅助函数：旋转坐标
    const rx = (lx, ly) => pce.x + lx * cos - ly * sin;
    const ry = (lx, ly) => pce.y + lx * sin + ly * cos;

    // 辉光边缘（双层替代 shadowBlur）
    gfx.lineStyle(pce.cutWidth * 3.6, color, pce.life * 0.18);
    gfx.moveTo(rx(-halfL - 6, -open * 0.35), ry(-halfL - 6, -open * 0.35));
    gfx.lineTo(rx(halfL + 6, -open * 0.5), ry(halfL + 6, -open * 0.5));
    gfx.moveTo(rx(-halfL - 6, open * 0.35), ry(-halfL - 6, open * 0.35));
    gfx.lineTo(rx(halfL + 6, open * 0.5), ry(halfL + 6, open * 0.5));

    gfx.lineStyle(pce.cutWidth * 1.8, color, pce.life * 0.42);
    gfx.moveTo(rx(-halfL - 6, -open * 0.35), ry(-halfL - 6, -open * 0.35));
    gfx.lineTo(rx(halfL + 6, -open * 0.5), ry(halfL + 6, -open * 0.5));
    gfx.moveTo(rx(-halfL - 6, open * 0.35), ry(-halfL - 6, open * 0.35));
    gfx.lineTo(rx(halfL + 6, open * 0.5), ry(halfL + 6, open * 0.5));

    // 核心裂缝线
    const slitAlpha = Math.min(1, pce.life * 1.35);
    gfx.lineStyle(Math.max(1.2, pce.cutWidth * pce.life), 0xFFFFFF, slitAlpha);
    gfx.moveTo(rx(-halfL, 0), ry(-halfL, 0));
    gfx.lineTo(rx(halfL, 0), ry(halfL, 0));

    // 碎片三角形
    for (const chip of pce.chips) {
        const cx = rx(chip.along, chip.side * chip.lift);
        const cy = ry(chip.along, chip.side * chip.lift);
        const s = chip.size;
        gfx.beginFill(color, chip.alpha * pce.life);
        gfx.moveTo(cx - s, cy);
        gfx.lineTo(cx + s * 0.8, cy - s * 0.45);
        gfx.lineTo(cx + s * 0.35, cy + s * 0.85);
        gfx.closePath();
        gfx.endFill();
    }
}

export function pierceCutEffect_pixiDestroy(pixi) {
    if (!pixi) return;
    if (pixi.gfx) { pixi.gfx.destroy(); pixi.gfx = null; }
}

// ─── SwordScar 适配器 ────────────────────────────────────────────

export function swordScar_pixiCreate(ss) {
    const container = pixiGetEffectContainer();
    if (!container) return null;

    const gfx = new PIXI.Graphics();
    gfx.blendMode = PIXI.BLEND_MODES.ADD;
    container.addChild(gfx);
    return { gfx };
}

export function swordScar_pixiSync(ss, pixi) {
    const gfx = pixi.gfx;
    if (!gfx) return;
    gfx.clear();
    if (!ss.active || ss.life <= 0) return;

    const halfL = ss.length / 2;
    const color = pixiCssColor(ss.color);
    const ox = ss.x + ss.offsetX, oy = ss.y + ss.offsetY;
    const cos = Math.cos(ss.angle), sin = Math.sin(ss.angle);

    // 主剑痕（三层辉光替代 shadowBlur）
    const lx1 = -halfL, lx2 = halfL;
    const x1 = ox + lx1 * cos, y1 = oy + lx1 * sin;
    const x2 = ox + lx2 * cos, y2 = oy + lx2 * sin;

    gfx.lineStyle(2.5 * ss.life * 3, color, ss.life * 0.25);
    gfx.moveTo(x1, y1); gfx.lineTo(x2, y2);
    gfx.lineStyle(2.5 * ss.life * 1.5, color, ss.life * 0.5);
    gfx.moveTo(x1, y1); gfx.lineTo(x2, y2);
    gfx.lineStyle(2.5 * ss.life, 0xFFFFFF, ss.life * 0.8);
    gfx.moveTo(x1, y1); gfx.lineTo(x2, y2);

    // 副剑痕
    const offY = -4;
    const sx1 = ox + (-halfL * 0.6) * cos - offY * sin;
    const sy1 = oy + (-halfL * 0.6) * sin + offY * cos;
    const sx2 = ox + (halfL * 0.6) * cos - offY * sin;
    const sy2 = oy + (halfL * 0.6) * sin + offY * cos;
    gfx.lineStyle(1 * ss.life, color, ss.life * 0.4);
    gfx.moveTo(sx1, sy1); gfx.lineTo(sx2, sy2);
}

export function swordScar_pixiDestroy(pixi) {
    if (!pixi) return;
    if (pixi.gfx) { pixi.gfx.destroy(); pixi.gfx = null; }
}

// ─── BladeStormRing 适配器 ───────────────────────────────────────

export function bladeStormRing_pixiCreate(bsr) {
    const container = pixiGetEffectContainer();
    if (!container) return null;

    const ringTex = pixiGetEffectTexture('bladeStormRing');
    const ringSprite = ringTex ? new PIXI.Sprite(ringTex) : null;
    if (ringSprite) {
        ringSprite.anchor.set(0.5);
        ringSprite.blendMode = PIXI.BLEND_MODES.ADD;
        container.addChild(ringSprite);
    }

    const gfx = new PIXI.Graphics();
    gfx.blendMode = PIXI.BLEND_MODES.ADD;
    container.addChild(gfx);

    return { ringSprite, gfx };
}

export function bladeStormRing_pixiSync(bsr, pixi) {
    const { ringSprite, gfx } = pixi;
    if (!bsr.active || bsr.life <= 0) {
        if (ringSprite) ringSprite.alpha = 0;
        if (gfx) gfx.clear();
        return;
    }

    // 预烘焙环纹理
    if (ringSprite) {
        ringSprite.x = bsr.x;
        ringSprite.y = bsr.y;
        const d = bsr.radius * 2;
        ringSprite.width = d;
        ringSprite.height = d;
        ringSprite.alpha = bsr.life * 0.7;
    }

    gfx.clear();
    // 内圈白色核心环（三层辉光）
    const ir = bsr.radius * 0.85;
    gfx.lineStyle(2 * bsr.life * 3, 0xFFFFFF, bsr.life * 0.15);
    gfx.drawCircle(bsr.x, bsr.y, ir);
    gfx.lineStyle(2 * bsr.life * 1.5, 0xFFFFFF, bsr.life * 0.3);
    gfx.drawCircle(bsr.x, bsr.y, ir);
    gfx.lineStyle(2 * bsr.life, 0xFFFFFF, bsr.life * 0.5);
    gfx.drawCircle(bsr.x, bsr.y, ir);
}

export function bladeStormRing_pixiDestroy(pixi) {
    if (!pixi) return;
    if (pixi.ringSprite) { pixi.ringSprite.destroy(); pixi.ringSprite = null; }
    if (pixi.gfx) { pixi.gfx.destroy(); pixi.gfx = null; }
}

// ─── BladeStormVortex 适配器 ─────────────────────────────────────

export function bladeStormVortex_pixiCreate(bsv) {
    const container = pixiGetEffectContainer();
    if (!container) return null;

    const glowTex = pixiGetEffectTexture('vortexGlow');
    const glowSprite = glowTex ? new PIXI.Sprite(glowTex) : null;
    if (glowSprite) {
        glowSprite.anchor.set(0.5);
        glowSprite.blendMode = PIXI.BLEND_MODES.ADD;
        container.addChild(glowSprite);
    }

    const gfx = new PIXI.Graphics();
    gfx.blendMode = PIXI.BLEND_MODES.ADD;
    container.addChild(gfx);

    return { glowSprite, gfx };
}

export function bladeStormVortex_pixiSync(bsv, pixi) {
    const { glowSprite, gfx } = pixi;
    const alphaBase = bsv.intensity * bsv.fadeT;
    if (bsv.life <= 0 || alphaBase <= 0.01) {
        if (glowSprite) glowSprite.alpha = 0;
        if (gfx) gfx.clear();
        return;
    }

    // 涡心辉光纹理
    if (glowSprite) {
        glowSprite.x = bsv.x;
        glowSprite.y = bsv.y;
        const d = bsv.radius * 1.9;
        glowSprite.width = d;
        glowSprite.height = d;
        glowSprite.alpha = alphaBase;
    }

    gfx.clear();

    // 4 条螺旋线
    for (let i = 0; i < 4; i++) {
        const base = bsv.phase * 0.11 + (i / 4) * Math.PI * 2;
        gfx.lineStyle(1.4, 0x7DD3FC, 0.14 * alphaBase);
        let firstPt = true;
        for (let tt = 0; tt <= 1.0001; tt += 0.05) {
            const a = base - tt * Math.PI * 2 * 1.15;
            const rr = bsv.radius * (0.18 + 0.74 * tt);
            const px = bsv.x + Math.cos(a) * rr;
            const py = bsv.y + Math.sin(a) * rr;
            if (firstPt) { gfx.moveTo(px, py); firstPt = false; } else gfx.lineTo(px, py);
        }
    }

    // 三层剑环
    for (const ring of bsv.rings) {
        const r0 = bsv.radius * ring.rFactor;
        const dirSign = ring.speed >= 0 ? 1 : -1;
        for (let k = 0; k < ring.count; k++) {
            const j = ring.jit[k];
            const ang = ring.speed * bsv.phase * j.s + (k / ring.count) * Math.PI * 2 + j.a;
            const r = r0 * (1 + j.r);
            const flick = 0.7 + 0.3 * Math.sin(bsv.age * 0.35 + j.f);
            const alpha = alphaBase * flick;
            const bx = bsv.x + Math.cos(ang) * r;
            const by = bsv.y + Math.sin(ang) * r;
            const tang = ang + dirSign * Math.PI / 2;
            const L = 21 * ring.len * j.l;
            const W = 3.2 * ring.width;

            // 拖尾（简化为 4 段）
            const trailSpan = 0.6 * ring.len * j.l;
            for (let s = 0; s < 4; s++) {
                const t0 = s / 4, t1 = (s + 1) / 4;
                const a0 = ang - dirSign * trailSpan * t0;
                const a1 = ang - dirSign * trailSpan * t1;
                const fade = 1 - t1;
                gfx.lineStyle(3.4 * ring.width * fade, s < 1 ? 0xEAF6FF : 0x7DD3FC, alpha * fade * 0.7);
                gfx.moveTo(bsv.x + Math.cos(a0) * r, bsv.y + Math.sin(a0) * r);
                gfx.lineTo(bsv.x + Math.cos(a1) * r, bsv.y + Math.sin(a1) * r);
            }

            // 剑刃菱形（外辉光 + 核心）
            const ct = Math.cos(tang), st = Math.sin(tang);
            // 外辉光
            gfx.beginFill(0x7DD3FC, alpha * 0.5);
            gfx.moveTo(bx + ct * L, by + st * L);
            gfx.lineTo(bx - st * W, by + ct * W);
            gfx.lineTo(bx - ct * L * 0.36, by - st * L * 0.36);
            gfx.lineTo(bx + st * W, by - ct * W);
            gfx.closePath();
            gfx.endFill();
            // 白色核心
            gfx.beginFill(0xEAF6FF, alpha);
            gfx.moveTo(bx + ct * L * 0.9, by + st * L * 0.9);
            gfx.lineTo(bx - st * W * 0.42, by + ct * W * 0.42);
            gfx.lineTo(bx - ct * L * 0.28, by - st * L * 0.28);
            gfx.lineTo(bx + st * W * 0.42, by - ct * W * 0.42);
            gfx.closePath();
            gfx.endFill();
        }
    }
}

export function bladeStormVortex_pixiDestroy(pixi) {
    if (!pixi) return;
    if (pixi.glowSprite) { pixi.glowSprite.destroy(); pixi.glowSprite = null; }
    if (pixi.gfx) { pixi.gfx.destroy(); pixi.gfx = null; }
}

// ─── GreedyWheelEffect 适配器 ────────────────────────────────────

export function greedyWheelEffect_pixiCreate(gwe) {
    const container = pixiGetEffectContainer();
    if (!container) return null;

    const gfx = new PIXI.Graphics();
    gfx.blendMode = PIXI.BLEND_MODES.ADD;
    container.addChild(gfx);
    return { gfx };
}

export function greedyWheelEffect_pixiSync(gwe, pixi) {
    const gfx = pixi.gfx;
    if (!gfx) return;
    gfx.clear();
    if (gwe.life <= 0) return;

    const t = Math.min(1, gwe.age / gwe.duration);
    const isFail = gwe.mode === 'fail';
    const isSuccess = gwe.mode === 'success';
    const gold = isFail ? 0xEF4444 : 0xFBBF24;
    const radius = gwe.mode === 'prelude'
        ? 40 - t * 18
        : 18 + t * (isSuccess ? 58 : 42);
    const alpha = gwe.life;
    const spin = gwe.seed + (isFail ? -1 : 1) * t * Math.PI * 1.8;

    // 8 条辐射线
    for (let i = 0; i < 8; i++) {
        const a = spin + i * Math.PI / 4;
        const inner = Math.max(6, radius * 0.45);
        const outer = radius * (gwe.mode === 'prelude' ? (1.15 - t * 0.25) : 1);
        const cos = Math.cos(a), sin = Math.sin(a);
        gfx.lineStyle(3, gold, alpha);
        gfx.moveTo(gwe.x + cos * inner, gwe.y + sin * inner);
        gfx.lineTo(gwe.x + cos * outer, gwe.y + sin * outer);
    }

    // 内圈
    gfx.lineStyle(3, isFail ? 0xFCA5A5 : 0xFDE68A, alpha);
    gfx.drawCircle(gwe.x, gwe.y, Math.max(8, radius * 0.58));

    // 4 段外弧
    gfx.lineStyle(3, isFail ? 0x991B1B : 0xF59E0B, alpha);
    for (let i = 0; i < 4; i++) {
        const a0 = spin + i * Math.PI / 2 + (isFail ? t * 0.8 : 0);
        gfx.arc(gwe.x, gwe.y, radius, a0, a0 + Math.PI * 0.32);
    }

    // 中心点
    if (!isFail) {
        gfx.beginFill(isSuccess ? 0xFFF7ED : 0x451A03, alpha);
        gfx.drawCircle(gwe.x, gwe.y, Math.max(4, radius * 0.16));
        gfx.endFill();
    }
}

export function greedyWheelEffect_pixiDestroy(pixi) {
    if (!pixi) return;
    if (pixi.gfx) { pixi.gfx.destroy(); pixi.gfx = null; }
}

// ─── EnergyOrb 适配器 ────────────────────────────────────────────

export function energyOrb_pixiCreate(orb) {
    const container = pixiGetEffectContainer();
    if (!container) return null;

    const gfx = new PIXI.Graphics();
    gfx.blendMode = PIXI.BLEND_MODES.NORMAL;
    container.addChild(gfx);
    return { gfx };
}

export function energyOrb_pixiSync(orb, pixi) {
    const gfx = pixi.gfx;
    if (!gfx) return;
    gfx.clear();
    if (!orb.active) return;

    const color = pixiCssColor(orb.color);

    // 拖尾线段
    if (orb.trail.length > 2) {
        gfx.lineStyle(orb.baseSize, color, orb.trailAlpha);
        gfx.moveTo(orb.trail[0].x, orb.trail[0].y);
        for (let i = 1; i < orb.trail.length; i++) {
            gfx.lineTo(orb.trail[i].x, orb.trail[i].y);
        }
    }

    // 外发光圆
    const flicker = 0.8 + Math.sin(orb.timer * 0.5 + orb.seed) * 0.2;
    gfx.beginFill(color, orb.haloAlpha);
    gfx.drawCircle(orb.pos.x, orb.pos.y, orb.baseSize * 2.0 * flicker);
    gfx.endFill();

    // 核心亮点
    gfx.beginFill(0xFFFFFF, orb.coreAlpha);
    gfx.drawCircle(orb.pos.x, orb.pos.y, orb.baseSize * 0.62);
    gfx.endFill();
}

export function energyOrb_pixiDestroy(pixi) {
    if (!pixi) return;
    if (pixi.gfx) { pixi.gfx.destroy(); pixi.gfx = null; }
}

// ─── FloatingText 适配器 ─────────────────────────────────────────

export function floatingText_pixiCreate(ft) {
    const container = pixiGetEffectContainer();
    if (!container) return null;

    const style = new PIXI.TextStyle({
        fontFamily: 'sans-serif',
        fontWeight: 'bold',
        fontSize: ft.fontSize,
        fill: ft.color,
        stroke: '#000000',
        strokeThickness: Math.max(3, ft.fontSize / 5),
        align: 'center',
    });

    const text = new PIXI.Text(ft.text, style);
    text.anchor.set(0.5, 0.5);
    text.blendMode = PIXI.BLEND_MODES.NORMAL;
    container.addChild(text);

    // 图标 Sprite（如果有）
    let iconSprite = null;
    if (ft.iconImg && ft.iconImg.complete && ft.iconImg.naturalWidth > 0) {
        const iconTex = PIXI.Texture.from(ft.iconImg);
        iconSprite = new PIXI.Sprite(iconTex);
        iconSprite.blendMode = PIXI.BLEND_MODES.NORMAL;
        container.addChild(iconSprite);
    }

    return { text, iconSprite, iconImg: ft.iconImg, fontSize: ft.fontSize };
}

export function floatingText_pixiSync(ft, pixi) {
    const { text, iconSprite } = pixi;
    if (!text) return;

    text.x = ft.pos.x;
    text.y = ft.pos.y;
    text.alpha = Math.max(0, ft.life);

    if (iconSprite && pixi.iconImg) {
        const iconSize = pixi.fontSize * 1.2;
        const textWidth = text.width;
        const totalWidth = iconSize + 3 + textWidth;
        iconSprite.x = ft.pos.x - totalWidth / 2;
        iconSprite.y = ft.pos.y - pixi.fontSize * 0.8;
        iconSprite.width = iconSize;
        iconSprite.height = iconSize;
        iconSprite.alpha = Math.max(0, ft.life);
        // 文字偏移
        text.x = ft.pos.x + (totalWidth / 2 - textWidth / 2);
    }
}

export function floatingText_pixiDestroy(pixi) {
    if (!pixi) return;
    if (pixi.text) { pixi.text.destroy(); pixi.text = null; }
    if (pixi.iconSprite) { pixi.iconSprite.destroy(); pixi.iconSprite = null; }
}

// ─── RewardDropEffect 适配器 ─────────────────────────────────────

export function rewardDropEffect_pixiCreate(rde) {
    const container = pixiGetEffectContainer();
    if (!container) return null;

    const gfx = new PIXI.Graphics();
    gfx.blendMode = PIXI.BLEND_MODES.ADD;
    container.addChild(gfx);
    return { gfx, type: rde.type };
}

export function rewardDropEffect_pixiSync(rde, pixi) {
    const gfx = pixi.gfx;
    if (!gfx) return;
    gfx.clear();
    if (rde.life <= 0) return;

    if (rde.type === 'relic') {
        _syncRelicDrop(rde, gfx);
    } else if (rde.type === 'chaos_essence') {
        _syncChaosDrop(rde, gfx);
    } else {
        _syncPureDrop(rde, gfx);
    }
}

function _syncRelicDrop(rde, gfx) {
    // 冲击波环
    for (const ring of rde.rings) {
        if (ring.r <= 0) continue;
        gfx.lineStyle(2, pixiCssColor(ring.color), ring.alpha * Math.max(0, rde.life));
        gfx.drawCircle(rde.x, rde.y, ring.r);
    }
    // 光柱
    if (rde.beamH > 0 && rde.beamAlpha > 0) {
        const bw = rde.beamW;
        gfx.beginFill(0xFACC15, rde.beamAlpha * 0.5 * Math.max(0, rde.life));
        gfx.drawRect(rde.x - bw / 2, rde.y - rde.beamH, bw, rde.beamH);
        gfx.endFill();
        gfx.lineStyle(2, 0xFFFFFF, rde.beamAlpha * Math.max(0, rde.life));
        gfx.moveTo(rde.x, rde.y);
        gfx.lineTo(rde.x, rde.y - rde.beamH);
    }
    // 金币粒子
    for (const c of rde.coins) {
        const cx = rde.x + Math.cos(c.angle) * c.dist;
        const cy = rde.y + Math.sin(c.angle) * c.dist;
        gfx.beginFill(pixiCssColor(c.color), c.alpha * Math.max(0, rde.life));
        gfx.drawCircle(cx, cy, c.size);
        gfx.endFill();
    }
}

function _syncChaosDrop(rde, gfx) {
    // 冲击波环
    for (const ring of rde.rings) {
        if (ring.r <= 0) continue;
        gfx.lineStyle(2, pixiCssColor(ring.color), ring.alpha * Math.max(0, rde.life));
        gfx.drawCircle(rde.x, rde.y, ring.r);
    }
    // 碎片
    for (const s of rde.shards) {
        const sx = rde.x + Math.cos(s.angle) * s.dist;
        const sy = rde.y + Math.sin(s.angle) * s.dist;
        gfx.beginFill(pixiCssColor(s.color), s.alpha * Math.max(0, rde.life));
        gfx.drawCircle(sx, sy, s.size);
        gfx.endFill();
    }
    // 漩涡
    if (rde.vortexR > 0) {
        gfx.lineStyle(1.5, 0xA855F7, 0.3 * Math.max(0, rde.life));
        gfx.drawCircle(rde.x, rde.y, rde.vortexR);
    }
}

function _syncPureDrop(rde, gfx) {
    // 光环
    for (const ring of rde.rings) {
        if (ring.r <= 0) continue;
        gfx.lineStyle(1.5, pixiCssColor(ring.color), ring.alpha * Math.max(0, rde.life));
        gfx.drawCircle(rde.x, rde.y, ring.r);
    }
    // 冰晶光柱
    if (rde.beamH > 0 && rde.beamAlpha > 0) {
        gfx.lineStyle(2, 0xBFDBFE, rde.beamAlpha * Math.max(0, rde.life));
        gfx.moveTo(rde.x, rde.y);
        gfx.lineTo(rde.x, rde.y - rde.beamH);
    }
    // 雪花粒子
    if (rde.snowflakes) {
        for (const sf of rde.snowflakes) {
            const sx = rde.x + Math.cos(sf.angle) * sf.dist;
            const sy = rde.y + Math.sin(sf.angle) * sf.dist;
            gfx.beginFill(0xBFDBFE, sf.alpha * Math.max(0, rde.life));
            gfx.drawCircle(sx, sy, sf.size);
            gfx.endFill();
        }
    }
}

export function rewardDropEffect_pixiDestroy(pixi) {
    if (!pixi) return;
    if (pixi.gfx) { pixi.gfx.destroy(); pixi.gfx = null; }
}

// ─── MuzzleFlashV2 适配器 [开炮 VFX 增强 · 阶段 A] ─────────────

/**
 * 为 MuzzleFlashV2 创建 PixiJS 显示对象
 * 层级：Container > coreSprite + flareSprite + sparkGraphics + heatSprite
 */
export function muzzleFlashV2_pixiCreate(mf) {
    const container = pixiGetEffectContainer();
    if (!container) return null;

    const coreTex = pixiGetEffectTexture('muzzleCore');
    const flareTex = pixiGetEffectTexture('muzzleFlare');
    const sparkTex = pixiGetEffectTexture('muzzleSpark');
    if (!coreTex) return null;

    const color = pixiCssColor(mf.elementColor);

    // 核心光球
    const coreSprite = new PIXI.Sprite(coreTex);
    coreSprite.anchor.set(0.5);
    coreSprite.blendMode = PIXI.BLEND_MODES.ADD;
    coreSprite.tint = color;
    coreSprite.scale.set(0.3);
    container.addChild(coreSprite);

    // 方向光锥
    let flareSprite = null;
    if (flareTex) {
        flareSprite = new PIXI.Sprite(flareTex);
        flareSprite.anchor.set(0.05, 0.5);  // 从根部发射
        flareSprite.blendMode = PIXI.BLEND_MODES.ADD;
        flareSprite.tint = color;
        flareSprite.scale.set(0.5, 0.8);
        flareSprite.rotation = mf.angle;
        container.addChild(flareSprite);
    }

    // 火星粒子（Graphics 绘制，避免 ParticleContainer 依赖）
    const sparkGfx = new PIXI.Graphics();
    sparkGfx.blendMode = PIXI.BLEND_MODES.ADD;
    container.addChild(sparkGfx);

    // 冷却热辉（复用 coreTex，SCREEN 混合）
    const heatSprite = new PIXI.Sprite(coreTex);
    heatSprite.anchor.set(0.5);
    heatSprite.blendMode = PIXI.BLEND_MODES.SCREEN;
    heatSprite.tint = color;
    heatSprite.alpha = 0;
    heatSprite.scale.set(0.8);
    container.addChild(heatSprite);

    const wrapper = new PIXI.Container();
    wrapper.addChild(coreSprite);
    if (flareSprite) wrapper.addChild(flareSprite);
    wrapper.addChild(sparkGfx);
    wrapper.addChild(heatSprite);
    // 移除直接子节点引用，通过 wrapper 统一管理
    // （实际 addChild 到 container 时已从原 parent 移走）
    container.addChild(wrapper);

    return {
        wrapper,
        coreSprite,
        flareSprite,
        sparkGfx,
        heatSprite,
        color,
    };
}

export function muzzleFlashV2_pixiSync(mf, pixi) {
    if (!pixi) return;
    const { coreSprite, flareSprite, sparkGfx, heatSprite, color } = pixi;
    const progress = Math.max(0, Math.min(1, 1 - mf.life / mf.maxLife));

    // 同步位置
    pixi.wrapper.x = mf.x;
    pixi.wrapper.y = mf.y;

    // ── 核心光球 ──
    if (progress < 0.3) {
        // 膨胀阶段
        const t = progress / 0.3;
        const s = (0.3 + 0.9 * t) * mf.intensity;
        coreSprite.scale.set(s);
        coreSprite.alpha = 0.8 + 0.2 * t;
    } else {
        // 衰减阶段
        const t = (progress - 0.3) / 0.7;
        const s = 1.2 * mf.intensity * (1 - t * 0.6);
        coreSprite.scale.set(Math.max(0.05, s));
        coreSprite.alpha = Math.max(0, 1.0 - t);
        // tint 渐变：白热 → 元素色 → 暗红（简化为 alpha 衰减）
        if (t > 0.6) {
            coreSprite.tint = 0x8B2020;
        }
    }

    // ── 方向光锥 ──
    if (flareSprite) {
        const flashEnd = mf.flashPhase / mf.maxLife;
        if (progress < flashEnd) {
            const t = progress / flashEnd;
            flareSprite.scale.set(0.5 + 1.5 * t * mf.intensity, 0.8 + 0.4 * t);
            flareSprite.alpha = Math.max(0, 1.0 - t * 0.9);
            flareSprite.rotation = mf.angle;
        } else {
            flareSprite.alpha = 0;
        }
    }

    // ── 火星粒子 ──
    sparkGfx.clear();
    for (const s of mf.sparks) {
        if (s.life <= 0) continue;
        const sa = Math.max(0, s.life * 2.5);
        sparkGfx.beginFill(color, sa);
        sparkGfx.drawCircle(s.x, s.y, s.size);
        sparkGfx.endFill();
    }

    // ── 冷却热辉 ──
    const flashEnd = mf.flashPhase / mf.maxLife;
    if (progress > flashEnd) {
        const t = (progress - flashEnd) / (1 - flashEnd);
        heatSprite.alpha = 0.3 * (1 - t);
        heatSprite.scale.set(0.8 + 0.4 * t);
    } else {
        heatSprite.alpha = 0;
    }
}

export function muzzleFlashV2_pixiDestroy(pixi) {
    if (!pixi) return;
    if (pixi.wrapper) { pixi.wrapper.destroy({ children: true }); pixi.wrapper = null; }
}

// ─── FiringBurst 适配器 [开炮 VFX 增强 · 阶段 C] ────────────────

/**
 * 为 FiringBurst 创建 PixiJS 显示对象
 * 层级：Container > ringGraphics + coneGraphics + debrisGraphics
 */
export function firingBurst_pixiCreate(fb) {
    const container = pixiGetEffectContainer();
    if (!container) return null;

    const color = pixiCssColor(fb.elementColor);

    // 扩散环 + 方向锥 + 碎片全部用 Graphics 绘制
    const gfx = new PIXI.Graphics();
    gfx.blendMode = PIXI.BLEND_MODES.ADD;
    container.addChild(gfx);

    return { gfx, color };
}

export function firingBurst_pixiSync(fb, pixi) {
    if (!pixi || !pixi.gfx) return;
    const { gfx, color } = pixi;
    const progress = Math.max(0, Math.min(1, 1 - fb.life / fb.maxLife));
    const alpha = Math.max(0, 1 - progress);

    gfx.clear();

    // 径向扩散环（三层辉光替代 shadowBlur）
    if (fb.ringWidth > 0.5) {
        const r = Math.max(0.1, fb.ringRadius);
        // 外辉光
        gfx.lineStyle(fb.ringWidth * 2.5, color, alpha * 0.2);
        gfx.drawCircle(fb.x, fb.y, r);
        // 中层
        gfx.lineStyle(fb.ringWidth * 1.5, color, alpha * 0.5);
        gfx.drawCircle(fb.x, fb.y, r);
        // 核心
        gfx.lineStyle(fb.ringWidth, 0xFFFFFF, alpha * 0.8);
        gfx.drawCircle(fb.x, fb.y, r);
    }

    // 方向冲击锥（前 30% 生命周期）
    if (progress < 0.3) {
        const coneAlpha = alpha * (1 - progress / 0.3) * 0.6;
        const dist = 60 * fb.intensity * (progress / 0.3);
        const cos1 = Math.cos(fb.angle - 0.26), sin1 = Math.sin(fb.angle - 0.26);
        const cos2 = Math.cos(fb.angle + 0.26), sin2 = Math.sin(fb.angle + 0.26);
        // 外辉光
        gfx.lineStyle(1, color, coneAlpha * 0.3);
        gfx.moveTo(fb.x, fb.y);
        gfx.lineTo(fb.x + cos1 * dist * 1.1, fb.y + sin1 * dist * 1.1);
        gfx.moveTo(fb.x, fb.y);
        gfx.lineTo(fb.x + cos2 * dist * 1.1, fb.y + sin2 * dist * 1.1);
        // 填充锥（用三角形近似）
        gfx.beginFill(color, coneAlpha * 0.4);
        gfx.moveTo(fb.x, fb.y);
        gfx.lineTo(fb.x + cos1 * dist, fb.y + sin1 * dist);
        gfx.lineTo(fb.x + cos2 * dist, fb.y + sin2 * dist);
        gfx.closePath();
        gfx.endFill();
    }

    // 碎片
    for (const d of fb.debris) {
        if (d.life <= 0) continue;
        const da = Math.max(0, d.life * 3) * alpha;
        gfx.beginFill(color, da);
        const dx = fb.x + d.x;
        const dy = fb.y + d.y;
        // 小三角形碎片
        const sz = d.size;
        const cos = Math.cos(d.rot), sin = Math.sin(d.rot);
        gfx.drawPolygon([
            dx + cos * sz,        dy + sin * sz,
            dx - sin * sz * 0.6,  dy + cos * sz * 0.6,
            dx - cos * sz * 0.5,  dy - sin * sz * 0.5,
        ]);
        gfx.endFill();
    }
}

export function firingBurst_pixiDestroy(pixi) {
    if (!pixi) return;
    if (pixi.gfx) { pixi.gfx.destroy(); pixi.gfx = null; }
}

// ─── BurnEffect 适配器 ──────────────────────────────────────────

/**
 * 为 BurnEffect 创建 PixiJS 显示对象
 * @param {object} be BurnEffect 实例
 * @returns {{ auraSprite: PIXI.Sprite, gfx: PIXI.Graphics, emberSprites: PIXI.Sprite[] }}
 */
export function burnEffect_pixiCreate(be) {
    const container = pixiGetEffectContainer();
    if (!container) return null;

    // 层 1：热光环 — 复用 fireRing 预烘焙纹理
    const fireRingTex = pixiGetEffectTexture('fireRing');
    const auraSprite = fireRingTex ? new PIXI.Sprite(fireRingTex) : null;
    if (auraSprite) {
        auraSprite.anchor.set(0.5);
        auraSprite.blendMode = PIXI.BLEND_MODES.ADD;
        container.addChild(auraSprite);
    }

    // 层 2：体焰弧 — PIXI.Graphics（三层辉光替代 shadowBlur）
    const gfx = new PIXI.Graphics();
    gfx.blendMode = PIXI.BLEND_MODES.ADD;
    container.addChild(gfx);

    // 层 3：火星飘升 — 复用 ember 粒子纹理
    const emberTex = pixiGetParticleTexture('ember');
    const emberSprites = [];
    if (emberTex) {
        for (let i = 0; i < 4; i++) {
            const sp = new PIXI.Sprite(emberTex);
            sp.anchor.set(0.5);
            sp.blendMode = PIXI.BLEND_MODES.ADD;
            sp.alpha = 0;
            container.addChild(sp);
            emberSprites.push(sp);
        }
    }

    return { auraSprite, gfx, emberSprites };
}

/**
 * 同步 BurnEffect 状态到 PixiJS 显示对象
 * @param {object} be BurnEffect 实例
 * @param {object} pixi 适配器对象
 */
export function burnEffect_pixiSync(be, pixi) {
    const { auraSprite, gfx, emberSprites } = pixi;
    if (be.intensity < 0.01) {
        if (auraSprite) auraSprite.alpha = 0;
        if (gfx) gfx.clear();
        for (const sp of emberSprites) sp.alpha = 0;
        return;
    }

    const intensity = be.intensity;
    const t = be.time;
    const w = be.width, h = be.height;

    // 层 1：热光环脉冲
    if (auraSprite) {
        const pulse = (Math.sin(t * 2.5) + 1) * 0.5;
        const auraAlpha = intensity * (0.15 + pulse * 0.1);
        const auraScale = Math.max(w, h) * (1.2 + pulse * 0.15);
        auraSprite.x = be.x;
        auraSprite.y = be.y;
        auraSprite.width = auraScale;
        auraSprite.height = auraScale;
        auraSprite.alpha = auraAlpha;
    }

    // 层 2：体焰弧（三层辉光替代 shadowBlur）
    gfx.clear();
    for (const seed of be._flameSeeds) {
        const flicker = Math.sin(t * seed.speed + seed.phase);
        const r = Math.max(w, h) * 0.45 * seed.lift;
        const arcAlpha = intensity * (0.4 + flicker * 0.2);
        const lw = 2.5 + flicker * 0.8;
        const startAngle = seed.angle + t * 0.3 * seed.speed;
        const color = seed.lift > 0.85 ? 0xFBBF24 : 0xF97316;

        // 外辉光（宽、淡）
        gfx.lineStyle(lw * 2, color, Math.max(0, arcAlpha * 0.3));
        gfx.arc(be.x, be.y, r, startAngle, startAngle + seed.span);
        // 中层
        gfx.lineStyle(lw * 1.3, color, Math.max(0, arcAlpha * 0.6));
        gfx.arc(be.x, be.y, r, startAngle, startAngle + seed.span);
        // 核心
        gfx.lineStyle(lw, 0xFFFFFF, Math.max(0, arcAlpha * 0.4));
        gfx.arc(be.x, be.y, r, startAngle, startAngle + seed.span);
    }

    // 层 3：火星飘升 Sprite 同步
    for (let i = 0; i < emberSprites.length; i++) {
        const sp = emberSprites[i];
        const ember = be._embers[i];
        if (ember && ember.active) {
            const ea = (ember.life / ember.maxLife) * intensity;
            sp.x = ember.x;
            sp.y = ember.y;
            sp.alpha = Math.max(0, ea * 0.7);
            const sz = ember.size * 4;
            sp.width = sz;
            sp.height = sz;
        } else {
            sp.alpha = 0;
        }
    }
}

/**
 * 销毁 BurnEffect 的 PixiJS 显示对象
 * @param {object} pixi 适配器对象
 */
export function burnEffect_pixiDestroy(pixi) {
    if (!pixi) return;
    if (pixi.auraSprite) { pixi.auraSprite.destroy(); pixi.auraSprite = null; }
    if (pixi.gfx) { pixi.gfx.destroy(); pixi.gfx = null; }
    if (pixi.emberSprites) {
        for (const sp of pixi.emberSprites) sp.destroy();
        pixi.emberSprites = null;
    }
}

// ─── ElectrocuteEffect 适配器 ────────────────────────────────────

/**
 * 为 ElectrocuteEffect 创建 PixiJS 显示对象
 * @param {object} ee ElectrocuteEffect 实例
 * @returns {{ gfx: PIXI.Graphics }}
 */
export function electrocuteEffect_pixiCreate(ee) {
    const container = pixiGetEffectContainer();
    if (!container) return null;

    const gfx = new PIXI.Graphics();
    gfx.blendMode = PIXI.BLEND_MODES.ADD;
    container.addChild(gfx);

    return { gfx };
}

/**
 * 同步 ElectrocuteEffect 状态到 PixiJS 显示对象
 * @param {object} ee ElectrocuteEffect 实例
 * @param {object} pixi 适配器对象
 */
export function electrocuteEffect_pixiSync(ee, pixi) {
    const { gfx } = pixi;
    if (!gfx) return;

    if (ee.intensity < 0.01) {
        gfx.clear();
        return;
    }

    gfx.clear();
    for (const arc of ee._arcs) {
        if (!arc.active || arc.points.length < 2) continue;
        const alpha = (arc.life / arc.maxLife) * ee.intensity;

        // 外层辉光（宽、淡紫色）
        gfx.lineStyle(4, 0xC084FC, Math.max(0, alpha * 0.3));
        gfx.moveTo(ee.x + arc.points[0].x, ee.y + arc.points[0].y);
        for (let i = 1; i < arc.points.length; i++) {
            gfx.lineTo(ee.x + arc.points[i].x, ee.y + arc.points[i].y);
        }

        // 中层
        gfx.lineStyle(2.5, 0xC084FC, Math.max(0, alpha * 0.6));
        gfx.moveTo(ee.x + arc.points[0].x, ee.y + arc.points[0].y);
        for (let i = 1; i < arc.points.length; i++) {
            gfx.lineTo(ee.x + arc.points[i].x, ee.y + arc.points[i].y);
        }

        // 核心白线
        gfx.lineStyle(1.5, 0xFFFFFF, Math.max(0, alpha * 0.7));
        gfx.moveTo(ee.x + arc.points[0].x, ee.y + arc.points[0].y);
        for (let i = 1; i < arc.points.length; i++) {
            gfx.lineTo(ee.x + arc.points[i].x, ee.y + arc.points[i].y);
        }
    }
}

/**
 * 销毁 ElectrocuteEffect 的 PixiJS 显示对象
 */
export function electrocuteEffect_pixiDestroy(pixi) {
    if (!pixi) return;
    if (pixi.gfx) { pixi.gfx.destroy(); pixi.gfx = null; }
}

// ─── VenomEffect 适配器 ──────────────────────────────────────────

/**
 * 为 VenomEffect 创建 PixiJS 显示对象
 * @param {object} ve VenomEffect 实例
 * @returns {{ gfx: PIXI.Graphics }}
 */
export function venomEffect_pixiCreate(ve) {
    const container = pixiGetEffectContainer();
    if (!container) return null;

    const gfx = new PIXI.Graphics();
    gfx.blendMode = PIXI.BLEND_MODES.ADD;
    container.addChild(gfx);

    return { gfx };
}

/**
 * 同步 VenomEffect 状态到 PixiJS 显示对象
 * @param {object} ve VenomEffect 实例
 * @param {object} pixi 适配器对象
 */
export function venomEffect_pixiSync(ve, pixi) {
    const { gfx } = pixi;
    if (!gfx) return;

    if (ve.intensity < 0.01) {
        gfx.clear();
        return;
    }

    const w = ve.width, h = ve.height;
    gfx.clear();

    for (const drip of ve._drips) {
        if (!drip.active) continue;

        const alpha = ve.intensity * 0.5;
        const pathLen = h * 0.7;
        const sx = ve.x + drip.startX * w;
        const sy = ve.y - h * 0.35;
        const ey = sy + pathLen * drip.progress;
        const wobX = Math.sin(ve.time * 2 + drip.wobble) * w * 0.05;

        // 毒液路径辉光（外层）
        gfx.lineStyle(4, 0x84CC16, Math.max(0, alpha * 0.3));
        gfx.moveTo(sx, sy);
        gfx.bezierCurveTo(
            sx + wobX, sy + pathLen * 0.3,
            sx - wobX, sy + pathLen * 0.6,
            sx + wobX * 0.5, ey
        );

        // 核心线
        gfx.lineStyle(2, 0xC8FFB4, Math.max(0, alpha * 0.7));
        gfx.moveTo(sx, sy);
        gfx.bezierCurveTo(
            sx + wobX, sy + pathLen * 0.3,
            sx - wobX, sy + pathLen * 0.6,
            sx + wobX * 0.5, ey
        );

        // 滴落点
        if (drip.progress > 0.7) {
            const dotAlpha = (drip.progress - 0.7) / 0.3 * alpha;
            gfx.beginFill(0xC8FFB4, Math.max(0, dotAlpha * 0.8));
            gfx.drawCircle(sx + wobX * 0.5, ey, 3);
            gfx.endFill();
        }
    }
}

/**
 * 销毁 VenomEffect 的 PixiJS 显示对象
 */
export function venomEffect_pixiDestroy(pixi) {
    if (!pixi) return;
    if (pixi.gfx) { pixi.gfx.destroy(); pixi.gfx = null; }
}

// ─── WindMarkEffect 适配器 ───────────────────────────────────────

/**
 * 为 WindMarkEffect 创建 PixiJS 显示对象
 * @param {object} wm WindMarkEffect 实例
 * @returns {{ ringSprite: PIXI.Sprite, gfx: PIXI.Graphics }}
 */
export function windMarkEffect_pixiCreate(wm) {
    const container = pixiGetEffectContainer();
    if (!container) return null;

    // 底层风环 Sprite（复用 windVortex 纹理）
    const windTex = pixiGetEffectTexture('windVortex');
    const ringSprite = windTex ? new PIXI.Sprite(windTex) : null;
    if (ringSprite) {
        ringSprite.anchor.set(0.5);
        ringSprite.blendMode = PIXI.BLEND_MODES.ADD;
        container.addChild(ringSprite);
    }

    // 上层风线 Graphics
    const gfx = new PIXI.Graphics();
    gfx.blendMode = PIXI.BLEND_MODES.ADD;
    container.addChild(gfx);

    return { ringSprite, gfx };
}

/**
 * 同步 WindMarkEffect 状态到 PixiJS 显示对象
 * @param {object} wm WindMarkEffect 实例
 * @param {object} pixi 适配器对象
 */
export function windMarkEffect_pixiSync(wm, pixi) {
    const { ringSprite, gfx } = pixi;

    if (wm.intensity < 0.01) {
        if (ringSprite) ringSprite.alpha = 0;
        if (gfx) gfx.clear();
        return;
    }

    const w = wm.width, h = wm.height;
    const baseR = Math.max(w, h) * 0.55;

    // 风环 Sprite 同步
    if (ringSprite) {
        ringSprite.x = wm.x;
        ringSprite.y = wm.y;
        const scale = baseR * 2.2;
        ringSprite.width = scale;
        ringSprite.height = scale;
        ringSprite.rotation = wm.rotation;
        ringSprite.alpha = wm.intensity * 0.25;
    }

    // 风线 Graphics 同步
    if (gfx) {
        gfx.clear();
        for (let i = 0; i < wm._bladeCount; i++) {
            const seed = wm._bladeSeeds[i];
            const angle = wm.rotation * seed.speed + seed.offset;
            const r = baseR * seed.radius;
            const alpha = wm.intensity * 0.45;

            // 外层辉光
            gfx.lineStyle(3, 0x34D399, Math.max(0, alpha * 0.3));
            gfx.arc(wm.x, wm.y, r, angle, angle + seed.span);

            // 核心线
            gfx.lineStyle(1.5, 0xD1FAE5, Math.max(0, alpha * 0.7));
            gfx.arc(wm.x, wm.y, r, angle, angle + seed.span);
        }
    }
}

/**
 * 销毁 WindMarkEffect 的 PixiJS 显示对象
 */
export function windMarkEffect_pixiDestroy(pixi) {
    if (!pixi) return;
    if (pixi.ringSprite) { pixi.ringSprite.destroy(); pixi.ringSprite = null; }
    if (pixi.gfx) { pixi.gfx.destroy(); pixi.gfx = null; }
}

// ─── 全局 PixiJS 特效清理 ──────────────────────────────────────

/**
 * [PixiJS 迁移] 阶段转换/重置时销毁所有特效的 PixiJS 适配器
 *
 * 在以下场景必须调用，否则孤立的 PixiJS 显示对象会永久残留在屏幕上：
 *   - 研磨→战斗阶段转换（phase_startCombatPhase）
 *   - 战斗→研磨阶段转换（phase_startGatheringPhase）
 *   - 战场清空（_clearBattlefield）
 *   - 游戏重置（sys_resetGame）
 *
 * @param {object} game - Game 实例（含 iceWaves / fireWaves / collectionBeams / particles 等数组）
 */
// ─── AffixSkillVFX 适配器 ──────────────────────────────────────

/**
 * 为 AffixSkillVFX 实例创建 PixiJS 显示对象
 * 使用 PIXI.Graphics 程序化绘制词条技能特效
 * 粒子通过 game.spawn_createParticle 独立管理（不在此适配器内）
 * @param {AffixSkillVFX} vfx - AffixSkillVFX 实例
 * @returns {{ gfx: PIXI.Graphics, glowSprite: PIXI.Sprite|null }|null}
 */
export function affixSkillVFX_pixiCreate(vfx) {
    const container = pixiGetEffectContainer();
    if (!container) return null;

    const gfx = new PIXI.Graphics();
    gfx.blendMode = PIXI.BLEND_MODES.ADD;
    container.addChild(gfx);

    // Optional glow sprite based on skill type
    let glowSprite = null;
    const glowTexName = {
        regen: 'healGlow', devour: 'vortexGlow', berserk: 'fireRing',
        shield: 'shockwaveRing', jump: 'shockwaveRing', clone: 'vortexGlow',
    }[vfx.skillType];
    if (glowTexName) {
        const tex = pixiGetEffectTexture(glowTexName);
        if (tex) {
            glowSprite = new PIXI.Sprite(tex);
            glowSprite.anchor.set(0.5);
            glowSprite.blendMode = PIXI.BLEND_MODES.ADD;
            container.addChild(glowSprite);
        }
    }

    return { gfx, glowSprite, skillType: vfx.skillType };
}

/**
 * 每帧同步 AffixSkillVFX 状态到 PixiJS 显示对象
 * Graphics 根据 skillType 和当前阶段绘制不同的程序化图形
 */
export function affixSkillVFX_pixiSync(vfx, pixi) {
    const { gfx, glowSprite } = pixi;
    if (!gfx) return;

    gfx.clear();
    if (vfx.life <= 0) {
        if (glowSprite) glowSprite.alpha = 0;
        return;
    }

    const x = vfx.x;
    const y = vfx.y;
    const alpha = vfx._gfxData.alpha;
    const scale = vfx._gfxData.scale;
    const rotation = vfx._gfxData.rotation;
    const phase = vfx.phase;

    // Update glow sprite
    if (glowSprite) {
        glowSprite.x = x;
        glowSprite.y = y;
        const glowSize = 80 * scale;
        glowSprite.width = glowSize;
        glowSprite.height = glowSize;
        glowSprite.alpha = alpha * 0.5;
        glowSprite.rotation = rotation * 0.3;
    }

    // Draw per-type graphics
    switch (vfx.skillType) {
    case 'berserk': {
        // Jagged flame silhouette from bottom
        const segments = vfx._gfxData.flameSegments || 8;
        const baseY = y + 20;
        const flameHeight = 40 * scale * vfx.intensity;
        // Three-pass glow: outer -> mid -> core
        for (let pass = 0; pass < 3; pass++) {
            const widths = [8, 4, 1.5];
            const alphas = [alpha * 0.3, alpha * 0.6, alpha * 0.9];
            const colors = [0xEF4444, 0xF97316, 0xFBBF24];
            gfx.lineStyle(widths[pass], colors[pass], alphas[pass]);
            gfx.moveTo(x - 20 * scale, baseY);
            for (let i = 0; i <= segments; i++) {
                const t = i / segments;
                const px = x - 20 * scale + t * 40 * scale;
                const jag = (i % 2 === 0) ? -flameHeight : -flameHeight * 0.5;
                const flicker = Math.sin(rotation * 3 + i * 1.7) * 5 * scale;
                gfx.lineTo(px, baseY + jag + flicker);
            }
            gfx.lineTo(x + 20 * scale, baseY);
        }
        break;
    }
    case 'shield': {
        // Hexagonal shield outline
        const radius = 30 * scale;
        const sides = 6;
        for (let pass = 0; pass < 3; pass++) {
            const widths = [6, 3, 1];
            const alphas = [alpha * 0.25, alpha * 0.55, alpha * 0.85];
            const colors = [0x93C5FD, 0x93C5FD, 0xFFFFFF];
            gfx.lineStyle(widths[pass], colors[pass], alphas[pass]);
            for (let i = 0; i <= sides; i++) {
                const angle = (i / sides) * Math.PI * 2 + rotation * 0.3;
                const px = x + Math.cos(angle) * radius;
                const py = y + Math.sin(angle) * radius;
                if (i === 0) gfx.moveTo(px, py);
                else gfx.lineTo(px, py);
            }
        }
        // Pulsing hex nodes during burst
        if (phase === 'burst') {
            gfx.lineStyle(0);
            gfx.beginFill(0x93C5FD, alpha * 0.8);
            for (let i = 0; i < sides; i++) {
                const angle = (i / sides) * Math.PI * 2 + rotation * 0.3;
                const px = x + Math.cos(angle) * radius;
                const py = y + Math.sin(angle) * radius;
                gfx.drawCircle(px, py, 3 * scale);
            }
            gfx.endFill();
        }
        break;
    }
    case 'regen': {
        // Vertical liquid column (three-pass)
        const colHeight = 35 * scale;
        const colWidth = 8 * scale;
        for (let pass = 0; pass < 3; pass++) {
            const widths = [colWidth * 2, colWidth, colWidth * 0.3];
            const alphas = [alpha * 0.2, alpha * 0.5, alpha * 0.8];
            const colors = [0x4ADE80, 0x86EFAC, 0xFFFFFF];
            gfx.lineStyle(widths[pass], colors[pass], alphas[phase === 'burst' ? 1 : 0]);
            gfx.moveTo(x, y + 15);
            gfx.lineTo(x, y + 15 - colHeight);
        }
        // Rising bubble outlines during burst
        if (phase === 'burst' && vfx.perfTier === 'high') {
            gfx.lineStyle(1, 0x4ADE80, alpha * 0.4);
            for (let i = 0; i < 3; i++) {
                const by = y + 10 - (vfx._burstProgress * colHeight + i * 12);
                const bx = x + Math.sin(rotation * 2 + i * 2) * 6 * scale;
                gfx.drawCircle(bx, by, 2 + Math.random());
            }
        }
        break;
    }
    case 'haste': {
        // Horizontal speed streaks (three-pass)
        const streakLen = 35 * scale;
        for (let i = 0; i < 3; i++) {
            const sy = y + (i - 1) * 6 * scale;
            const fadeAlpha = alpha * (1 - i * 0.25);
            for (let pass = 0; pass < 3; pass++) {
                const widths = [5, 2.5, 0.8];
                const alphas = [fadeAlpha * 0.2, fadeAlpha * 0.5, fadeAlpha * 0.8];
                const colors = [0xFACC15, 0xFDE047, 0xFFFFFF];
                gfx.lineStyle(widths[pass], colors[pass], alphas[pass]);
                gfx.moveTo(x - streakLen, sy);
                gfx.lineTo(x + 5, sy);
            }
        }
        // Elite/Boss zigzag electric arc
        if (vfx.isElite || vfx.isBoss) {
            gfx.lineStyle(1.5, 0xA78BFA, alpha * 0.6);
            gfx.moveTo(x - streakLen * 0.8, y - 8);
            gfx.lineTo(x - streakLen * 0.4, y + 5);
            gfx.lineTo(x - streakLen * 0.1, y - 5);
            gfx.lineTo(x + 3, y + 3);
        }
        break;
    }
    case 'jump': {
        // Spring coil at bottom (telegraph: compressed, burst: extended)
        const springY = y + 22;
        const compression = phase === 'telegraph' ? (1 - vfx._telegraphProgress * 0.7) : 1.0;
        const springHeight = 15 * scale * compression;
        gfx.lineStyle(2, 0x2DD4BF, alpha * 0.7);
        for (let i = 0; i < 4; i++) {
            const segY = springY - (i / 3) * springHeight;
            const segX = x + (i % 2 === 0 ? -8 : 8) * scale;
            if (i === 0) gfx.moveTo(x, springY);
            gfx.lineTo(segX, segY);
        }
        gfx.lineTo(x, springY - springHeight);
        // Landing shockwave ring (burst phase only)
        if (phase === 'burst') {
            const ringRadius = vfx._burstProgress * 30 * scale;
            gfx.lineStyle(2, 0x38BDF8, alpha * 0.5 * (1 - vfx._burstProgress));
            gfx.drawCircle(x, y, ringRadius);
        }
        break;
    }
    case 'clone': {
        // Cell division: two circles separating
        const separation = phase === 'telegraph'
            ? vfx._telegraphProgress * 8 * scale
            : (8 + vfx._burstProgress * 15) * scale;
        for (let pass = 0; pass < 3; pass++) {
            const widths = [5, 2.5, 0.8];
            const alphas = [alpha * 0.2, alpha * 0.5, alpha * 0.8];
            const colors = [0xC084FC, 0xD8B4FE, 0xFFFFFF];
            gfx.lineStyle(widths[pass], colors[pass], alphas[pass]);
            gfx.drawCircle(x - separation, y, 12 * scale);
            gfx.drawCircle(x + separation, y, 12 * scale);
        }
        // Connecting strand during telegraph
        if (phase === 'telegraph') {
            gfx.lineStyle(1.5, 0xD8B4FE, alpha * 0.6);
            gfx.moveTo(x - separation, y);
            gfx.lineTo(x + separation, y);
        }
        break;
    }
    case 'devour': {
        // Rotating spiral arms (four arms converging to center)
        const arms = 4;
        const armRadius = 35 * scale;
        for (let pass = 0; pass < 3; pass++) {
            const widths = [6, 3, 1];
            const alphas = [alpha * 0.25, alpha * 0.5, alpha * 0.75];
            const colors = [0x991B1B, 0xDC2626, 0xFFFFFF];
            gfx.lineStyle(widths[pass], colors[pass], alphas[pass]);
            for (let a = 0; a < arms; a++) {
                const baseAngle = (a / arms) * Math.PI * 2 + rotation;
                gfx.moveTo(
                    x + Math.cos(baseAngle) * armRadius,
                    y + Math.sin(baseAngle) * armRadius
                );
                // Quadratic curve toward center
                const midAngle = baseAngle + 0.5;
                const midR = armRadius * 0.5;
                gfx.quadraticCurveTo(
                    x + Math.cos(midAngle) * midR,
                    y + Math.sin(midAngle) * midR,
                    x, y
                );
            }
        }
        break;
    }
    }
}

/**
 * 销毁 AffixSkillVFX 的 PixiJS 显示对象
 */
export function affixSkillVFX_pixiDestroy(pixi) {
    if (!pixi) return;
    if (pixi.gfx) { pixi.gfx.destroy(); pixi.gfx = null; }
    if (pixi.glowSprite) { pixi.glowSprite.destroy(); pixi.glowSprite = null; }
}

export function pixiCleanupAllEffects(game) {
    if (!game) return;

    // --- 专用数组：逐个销毁 _pixi 适配器 ---
    const arrayDestroyMap = [
        ['iceWaves',            iceWave_pixiDestroy],
        ['fireWaves',           fireWave_pixiDestroy],
        ['healWaves',           healWave_pixiDestroy],
        ['deathExplosions',     deathExplosion_pixiDestroy],
        ['shockwaves',          shockwave_pixiDestroy],
        ['greedyWheelEffects',  greedyWheelEffect_pixiDestroy],
        ['rewardDropEffects',   rewardDropEffect_pixiDestroy],
        ['collectionBeams',     collectionBeam_pixiDestroy],
        ['lightningBolts',      lightningBolt_pixiDestroy],
        ['floatingTexts',       floatingText_pixiDestroy],
        ['_muzzleFlashesV2',    muzzleFlashV2_pixiDestroy],
        ['_firingBursts',       firingBurst_pixiDestroy],
        ['affixSkillVFXList',   affixSkillVFX_pixiDestroy],
    ];

    for (const [arrName, destroyFn] of arrayDestroyMap) {
        const arr = game[arrName];
        if (Array.isArray(arr)) {
            for (const item of arr) {
                if (item && item._pixi) {
                    destroyFn(item._pixi);
                    item._pixi = null;
                }
            }
        }
    }

    // energyOrbs：用 !active 判定移除
    if (Array.isArray(game.energyOrbs)) {
        for (const orb of game.energyOrbs) {
            if (orb && orb._pixi) {
                energyOrb_pixiDestroy(orb._pixi);
                orb._pixi = null;
            }
        }
    }

    // --- particles 数组：释放 Sprite 回池 + 销毁 _pixi 特效对象 ---
    if (Array.isArray(game.particles)) {
        for (const p of game.particles) {
            if (!p) continue;
            // 粒子 Sprite 释放回对象池
            if (p._pixiSprite) {
                pixiReleaseParticleSprite(p._pixiSprite);
                p._pixiSprite = null;
            }
            // 特效对象 _pixi 销毁（存储在 particles 数组中的特效类）
            if (p._pixi) {
                // 所有 _pixiDestroy 函数均为 null-safe（检查属性存在性），
                // 对非自身类型安全地 no-op，故可全部调用。
                laserBeam_pixiDestroy(p._pixi);
                slashEffect_pixiDestroy(p._pixi);
                pierceCutEffect_pixiDestroy(p._pixi);
                swordScar_pixiDestroy(p._pixi);
                bladeStormVortex_pixiDestroy(p._pixi);
                p._pixi = null;
            }
        }
    }
}
