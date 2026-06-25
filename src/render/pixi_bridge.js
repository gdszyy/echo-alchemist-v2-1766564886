/**
 * src/render/pixi_bridge.js — PixiJS WebGL 渲染管线桥接层
 *
 * [PixiJS 迁移 · 阶段一] T1.1 ~ T1.6
 *
 * 架构：双层 Canvas Overlay
 *   - PixiJS 透明 WebGL canvas 叠加在主 Canvas 2D 上方
 *   - 主 Canvas 负责基底 / 实体 / UI 绘制（不变）
 *   - PixiJS 层负责粒子 / 特效的 GPU 批渲染（阶段二起逐步迁入）
 *
 * 职责：
 *   - 初始化 PixiJS Application（autoStart: false，手动 tick 驱动）
 *   - 管理 gameContainer（屏幕震动同步）
 *   - 预烘焙粒子发光纹理（供阶段二使用）
 *   - 提供粒子模式对应的 ParticleContainer 注册表
 *   - 生命周期：pixiInit → pixiTick / pixiResize → pixiDestroy
 *
 * 依赖：PixiJS 7.x 全局变量（CDN 加载，挂载于 window.PIXI）
 *
 * @module render/pixi_bridge
 * @perf-impact: 本模块是 WebGL 渲染管线入口，所有粒子/特效批渲染均由此驱动
 */

import { CONFIG } from '../config.js';
import { filterUpdateAll, filterDestroyAll } from './pixi_filter_manager.js';

// ─── 模块级状态 ────────────────────────────────────────────────

/** @type {PIXI.Application|null} */
let pixiApp = null;

/** @type {PIXI.Container|null} 游戏根容器（屏幕震动偏移目标） */
let gameContainer = null;

/** @type {boolean} 桥接层是否已就绪 */
let _active = false;

/** 预烘焙纹理注册表 mode → PIXI.Texture */
const _bakedTextures = Object.create(null);

/** 粒子容器注册表 mode → PIXI.ParticleContainer */
const _particleContainers = Object.create(null);

// ─── 纹理预烘焙 ────────────────────────────────────────────────

/**
 * 使用 OffscreenCanvas + 径向渐变一次性烘焙发光纹理。
 * 仅在 pixiInit 时调用一次，后续所有粒子 drawImage 复用同一张纹理，
 * 彻底消除每帧 createRadialGradient 的堆分配开销。
 *
 * @param {string} mode   粒子模式名
 * @param {number} size   纹理边长（像素）
 * @param {string} color  CSS 颜色（中心不透明色）
 * @param {string} [edgeColor] 边缘色（默认 transparent）
 * @returns {PIXI.Texture}
 */
function _bakeGlowTexture(mode, size, color, edgeColor) {
    const canvas = new OffscreenCanvas(size, size);
    const g = canvas.getContext('2d');
    const half = size / 2;
    const grad = g.createRadialGradient(half, half, 0, half, half, half);
    grad.addColorStop(0, color);
    grad.addColorStop(0.4, color);
    grad.addColorStop(1, edgeColor || 'rgba(0,0,0,0)');
    g.fillStyle = grad;
    g.beginPath();
    g.arc(half, half, half, 0, Math.PI * 2);
    g.fill();

    const baseTexture = PIXI.BaseTexture.from(canvas, {
        scaleMode: PIXI.SCALE_MODES.LINEAR,
        resolution: 1,
    });
    const tex = new PIXI.Texture(baseTexture);
    _bakedTextures[mode] = tex;
    return tex;
}

/**
 * 烘焙菱形（shard）纹理
 */
function _bakeShardTexture(size) {
    const canvas = new OffscreenCanvas(size, size);
    const g = canvas.getContext('2d');
    const half = size / 2;
    const grad = g.createRadialGradient(half, half, 0, half, half, half * 0.8);
    grad.addColorStop(0, '#aef');
    grad.addColorStop(0.5, '#69f');
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grad;
    // 菱形
    g.beginPath();
    g.moveTo(half, 2);
    g.lineTo(size - 2, half);
    g.lineTo(half, size - 2);
    g.lineTo(2, half);
    g.closePath();
    g.fill();

    const baseTexture = PIXI.BaseTexture.from(canvas, {
        scaleMode: PIXI.SCALE_MODES.LINEAR,
        resolution: 1,
    });
    const tex = new PIXI.Texture(baseTexture);
    _bakedTextures.shard = tex;
    return tex;
}

/**
 * 初始化全部预烘焙纹理（每种粒子模式一张发光贴图）
 * Phase 2 迁移的三种核心模式使用精细烘焙纹理：
 *   - ember: 暖橙黄径向渐变（替代每帧 3-stop 渐变 + shadowBlur）
 *   - mist: 柔和蓝白径向渐变（替代每帧 createRadialGradient）
 *   - venom: 翠绿径向渐变（替代每帧 3-stop 渐变）
 * 其余模式使用简化白色发光纹理，通过 tint 动态上色。
 */
function _initBakedTextures() {
    _bakeGlowTexture('spark',  32, '#fff',    'rgba(255,255,255,0)');
    // ember: 核心亮黄 → 橙红 → 透明（还原 Canvas 2D 的 3-stop 渐变视觉）
    {
        const size = 64, half = 32;
        const c = new OffscreenCanvas(size, size);
        const g = c.getContext('2d');
        const grad = g.createRadialGradient(half, half, 0, half, half, half);
        grad.addColorStop(0,   'rgba(255,255,200,1)');
        grad.addColorStop(0.3, 'rgba(251,146,60,0.8)');
        grad.addColorStop(0.7, 'rgba(249,115,22,0.3)');
        grad.addColorStop(1,   'rgba(249,115,22,0)');
        g.fillStyle = grad;
        g.beginPath(); g.arc(half, half, half, 0, Math.PI * 2); g.fill();
        _bakedTextures.ember = new PIXI.Texture(PIXI.BaseTexture.from(c, { scaleMode: PIXI.SCALE_MODES.LINEAR }));
    }
    // mist: 柔和冷色调发光
    _bakeGlowTexture('mist',  64, 'rgba(207,250,254,0.8)', 'rgba(165,243,252,0)');
    // venom: 翠绿色发光
    {
        const size = 64, half = 32;
        const c = new OffscreenCanvas(size, size);
        const g = c.getContext('2d');
        const grad = g.createRadialGradient(half, half, 0, half, half, half);
        grad.addColorStop(0,   'rgba(200,255,180,0.9)');
        grad.addColorStop(0.4, 'rgba(74,222,128,0.7)');
        grad.addColorStop(1,   'rgba(22,101,52,0)');
        g.fillStyle = grad;
        g.beginPath(); g.arc(half, half, half, 0, Math.PI * 2); g.fill();
        _bakedTextures.venom = new PIXI.Texture(PIXI.BaseTexture.from(c, { scaleMode: PIXI.SCALE_MODES.LINEAR }));
    }
    _bakeShardTexture(48);
    _bakeGlowTexture('smoke',  64, 'rgba(120,120,120,0.4)', 'rgba(60,60,60,0)');
    // [T2.7] wind_slash: 梭形/刀片形状（匹配 Canvas 2D 的 quadraticCurveTo 梭形 + 线性渐变）
    {
        const w = 64, h = 32;
        const c = new OffscreenCanvas(w, h);
        const g = c.getContext('2d');
        const cx = w / 2, cy = h / 2;
        const grad = g.createLinearGradient(0, cy, w, cy);
        grad.addColorStop(0,   'rgba(255,255,255,0)');
        grad.addColorStop(0.2, 'rgba(52,211,153,0.8)');
        grad.addColorStop(0.5, 'rgba(255,255,255,1)');
        grad.addColorStop(0.8, 'rgba(52,211,153,0.8)');
        grad.addColorStop(1,   'rgba(255,255,255,0)');
        g.fillStyle = grad;
        g.beginPath();
        g.moveTo(2, cy);
        g.quadraticCurveTo(cx, cy - h * 0.35, w - 2, cy);
        g.quadraticCurveTo(cx, cy + h * 0.35, 2, cy);
        g.closePath();
        g.fill();
        _bakedTextures.wind_slash = new PIXI.Texture(PIXI.BaseTexture.from(c, { scaleMode: PIXI.SCALE_MODES.LINEAR }));
    }
    // [T2.7] line: 细长水平线（匹配 Canvas 2D 的 round-cap lineTo）
    {
        const w = 64, h = 16;
        const c = new OffscreenCanvas(w, h);
        const g = c.getContext('2d');
        const cy = h / 2;
        const grad = g.createLinearGradient(0, cy, w, cy);
        grad.addColorStop(0,   'rgba(255,255,255,0)');
        grad.addColorStop(0.1, 'rgba(255,255,255,1)');
        grad.addColorStop(0.9, 'rgba(255,255,255,1)');
        grad.addColorStop(1,   'rgba(255,255,255,0)');
        g.strokeStyle = grad;
        g.lineWidth = 4;
        g.lineCap = 'round';
        g.beginPath();
        g.moveTo(4, cy);
        g.lineTo(w - 4, cy);
        g.stroke();
        _bakedTextures.line = new PIXI.Texture(PIXI.BaseTexture.from(c, { scaleMode: PIXI.SCALE_MODES.LINEAR }));
    }
    // [Trail V2] 拖尾段纹理：64×16，水平高斯衰减 + 垂直柔和轮廓
    // 用于 GPU 批渲染的拖尾线段替代 Canvas 2D 逐段 stroke
    {
        const w = 64, h = 16;
        const c = new OffscreenCanvas(w, h);
        const g = c.getContext('2d');
        const cy = h / 2;
        // 水平：中间亮两端透明（模拟拖尾段从首到尾的渐隐）
        const grH = g.createLinearGradient(0, cy, w, cy);
        grH.addColorStop(0,   'rgba(255,255,255,0)');
        grH.addColorStop(0.1, 'rgba(255,255,255,0.8)');
        grH.addColorStop(0.5, 'rgba(255,255,255,1)');
        grH.addColorStop(0.9, 'rgba(255,255,255,0.8)');
        grH.addColorStop(1,   'rgba(255,255,255,0)');
        g.fillStyle = grH;
        g.fillRect(0, 0, w, h);
        // 垂直遮罩：用 destination-in 裁出柔和纵向轮廓
        const grV = g.createLinearGradient(w / 2, 0, w / 2, h);
        grV.addColorStop(0,   'rgba(255,255,255,0)');
        grV.addColorStop(0.2, 'rgba(255,255,255,0.6)');
        grV.addColorStop(0.5, 'rgba(255,255,255,1)');
        grV.addColorStop(0.8, 'rgba(255,255,255,0.6)');
        grV.addColorStop(1,   'rgba(255,255,255,0)');
        g.globalCompositeOperation = 'destination-in';
        g.fillStyle = grV;
        g.fillRect(0, 0, w, h);
        _bakedTextures.trail = new PIXI.Texture(PIXI.BaseTexture.from(c, { scaleMode: PIXI.SCALE_MODES.LINEAR }));
    }
}

// ─── ParticleContainer 管理 ────────────────────────────────────

/**
 * 为指定粒子模式创建/获取 ParticleContainer。
 * 使用 PIXI.ParticleContainer 实现 GPU 批渲染：
 *   - 同模式所有粒子共享一个 draw call
 *   - BLEND_MODES.ADD 映射原 Canvas 2D 的 'lighter' / 'screen'
 *
 * @param {string} mode 粒子模式名
 * @returns {PIXI.ParticleContainer}
 */
export function pixiGetParticleContainer(mode) {
    if (_particleContainers[mode]) return _particleContainers[mode];
    if (!pixiApp || !gameContainer) return null;

    const perfCfg = CONFIG.performance || {};
    const maxCap = perfCfg.maxParticles || 800;

    // ParticleContainer 属性：positions + rotation + scale + uvs + tint + alpha
    const container = new PIXI.ParticleContainer(maxCap, {
        vertices: false,
        position: true,
        rotation: true,
        uvs: true,
        tint: true,
        alpha: true,
        scale: true,
    });
    container.blendMode = PIXI.BLEND_MODES.ADD;
    container.eventMode = 'none';
    gameContainer.addChild(container);
    _particleContainers[mode] = container;
    return container;
}

/**
 * 获取预烘焙纹理（供阶段二粒子 Sprite 使用）
 * @param {string} mode
 * @returns {PIXI.Texture|null}
 */
export function pixiGetTexture(mode) {
    return _bakedTextures[mode] || _bakedTextures.spark || null;
}

// ─── CSS → PixiJS 颜色转换 ────────────────────────────────────

/**
 * 将 CSS 颜色字符串转换为 PixiJS 0xRRGGBB 整数（不含 alpha）。
 * 支持 #hex, rgb(), rgba() 格式。无法解析时返回 0xFFFFFF。
 *
 * @param {string} cssColor CSS 颜色字符串
 * @returns {number} PixiJS 颜色整数
 */
export function pixiCssColor(cssColor) {
    if (!cssColor || typeof cssColor !== 'string') return 0xFFFFFF;
    if (cssColor.startsWith('#')) {
        let hex = cssColor.slice(1);
        if (hex.length === 3) hex = hex.split('').map(c => c + c).join('');
        return parseInt(hex.slice(0, 6), 16) || 0xFFFFFF;
    }
    const m = cssColor.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
    if (m) {
        return (parseInt(m[1]) << 16) | (parseInt(m[2]) << 8) | parseInt(m[3]);
    }
    return 0xFFFFFF;
}

// ─── 粒子 Sprite 对象池 ────────────────────────────────────────

/** @type {PIXI.Sprite[]} 闲置 Sprite 池 */
const _spritePool = [];

/**
 * [T2.3/T2.4] 为粒子获取一个 PIXI.Sprite（优先从池中复用）。
 * 自动添加到对应模式的 ParticleContainer，并设置预烘焙纹理。
 *
 * @param {string} mode 粒子模式（mist/ember/venom/shard/spark 等）
 * @returns {PIXI.Sprite|null} 可用 Sprite；PixiJS 未激活时返回 null
 */
export function pixiAcquireParticleSprite(mode) {
    if (!_active || !gameContainer) return null;

    const container = pixiGetParticleContainer(mode);
    if (!container) return null;

    let sprite;
    if (_spritePool.length > 0) {
        sprite = _spritePool.pop();
    } else {
        sprite = new PIXI.Sprite();
    }

    // 绑定对应模式的预烘焙纹理
    const tex = _bakedTextures[mode];
    if (tex) sprite.texture = tex;

    // 设置混合模式（与 Canvas 2D 的 lighter/screen 对应）
    // ParticleContainer 的 blendMode 由 container 统一控制，
    // 但 sprite 级别也可覆盖（ParticleContainer 7.x 支持 per-sprite blendMode）
    sprite.blendMode = (mode === 'wind_slash') ? PIXI.BLEND_MODES.SCREEN : PIXI.BLEND_MODES.ADD;
    sprite.visible = true;
    sprite.alpha = 1;

    container.addChild(sprite);
    return sprite;
}

/**
 * [T2.4] 释放粒子 Sprite 回池中（隐藏并从容器移除）。
 * 粒子死亡时由 compaction 循环调用。
 *
 * @param {PIXI.Sprite} sprite 要释放的 Sprite
 */
export function pixiReleaseParticleSprite(sprite) {
    if (!sprite) return;
    sprite.visible = false;
    sprite.alpha = 0;
    if (sprite.parent) {
        sprite.parent.removeChild(sprite);
    }
    _spritePool.push(sprite);
}

/**
 * 查询桥接层是否已激活
 * @returns {boolean}
 */
export function pixiIsActive() {
    return _active;
}

// ─── 特效层管理 ────────────────────────────────────────────────

/** @type {PIXI.Container|null} 特效对象根容器（粒子层之上、HUD 之下） */
let _effectContainer = null;

/** 特效专用预烘焙纹理 */
const _effectTextures = Object.create(null);

/**
 * 烘焙特效专用纹理（环形、光柱、发光圆等）
 */
function _initEffectTextures() {
    if (typeof PIXI === 'undefined') return;

    // 通用发光圆（白→透明），用于中心辉光 / HealWave / DeathExplosion
    {
        const s = 128, h = 64;
        const c = new OffscreenCanvas(s, s);
        const g = c.getContext('2d');
        const gr = g.createRadialGradient(h, h, 0, h, h, h);
        gr.addColorStop(0, 'rgba(255,255,255,1)');
        gr.addColorStop(0.5, 'rgba(255,255,255,0.4)');
        gr.addColorStop(1, 'rgba(255,255,255,0)');
        g.fillStyle = gr; g.beginPath(); g.arc(h, h, h, 0, Math.PI * 2); g.fill();
        _effectTextures.glow = new PIXI.Texture(PIXI.BaseTexture.from(c));
    }

    // 冰晶扩散环（蓝色环形渐变），用于 IceWave
    {
        const s = 128, h = 64;
        const c = new OffscreenCanvas(s, s);
        const g = c.getContext('2d');
        const gr = g.createRadialGradient(h, h, h * 0.55, h, h, h);
        gr.addColorStop(0, 'rgba(186,230,253,0)');
        gr.addColorStop(0.4, 'rgba(186,230,253,0.35)');
        gr.addColorStop(0.7, 'rgba(186,230,253,0.25)');
        gr.addColorStop(1, 'rgba(186,230,253,0)');
        g.fillStyle = gr; g.beginPath(); g.arc(h, h, h, 0, Math.PI * 2); g.fill();
        _effectTextures.iceRing = new PIXI.Texture(PIXI.BaseTexture.from(c));
    }

    // 收集光柱（上白下蓝垂直渐变），用于 CollectionBeam
    {
        const w = 64, ht = 256;
        const c = new OffscreenCanvas(w, ht);
        const g = c.getContext('2d');
        const gr = g.createLinearGradient(w / 2, 0, w / 2, ht);
        gr.addColorStop(0, 'rgba(14,165,233,0)');
        gr.addColorStop(0.4, 'rgba(14,165,233,0.5)');
        gr.addColorStop(1, 'rgba(255,255,255,1)');
        g.fillStyle = gr; g.fillRect(0, 0, w, ht);
        _effectTextures.beam = new PIXI.Texture(PIXI.BaseTexture.from(c));
    }

    // HealWave 中心辉光（绿白→粉色→透明）
    {
        const s = 128, h = 64;
        const c = new OffscreenCanvas(s, s);
        const g = c.getContext('2d');
        const gr = g.createRadialGradient(h, h, 0, h, h, h);
        gr.addColorStop(0, 'rgba(255,255,240,0.9)');
        gr.addColorStop(0.3, 'rgba(134,239,172,0.5)');
        gr.addColorStop(0.6, 'rgba(244,114,182,0.2)');
        gr.addColorStop(1, 'rgba(244,114,182,0)');
        g.fillStyle = gr; g.beginPath(); g.arc(h, h, h, 0, Math.PI * 2); g.fill();
        _effectTextures.healGlow = new PIXI.Texture(PIXI.BaseTexture.from(c));
    }

    // HealWave 扩散环（粉色环形）
    {
        const s = 128, h = 64;
        const c = new OffscreenCanvas(s, s);
        const g = c.getContext('2d');
        const gr = g.createRadialGradient(h, h, h * 0.55, h, h, h);
        gr.addColorStop(0, 'rgba(244,114,182,0)');
        gr.addColorStop(0.3, 'rgba(134,239,172,0.2)');
        gr.addColorStop(0.6, 'rgba(244,114,182,0.25)');
        gr.addColorStop(1, 'rgba(244,114,182,0)');
        g.fillStyle = gr; g.beginPath(); g.arc(h, h, h, 0, Math.PI * 2); g.fill();
        _effectTextures.healRing = new PIXI.Texture(PIXI.BaseTexture.from(c));
    }

    // Shockwave / FireWave 通用冲击环（白色半透明环形渐变）
    {
        const s = 128, h = 64;
        const c = new OffscreenCanvas(s, s);
        const g = c.getContext('2d');
        const gr = g.createRadialGradient(h, h, h * 0.4, h, h, h);
        gr.addColorStop(0, 'rgba(255,255,255,0)');
        gr.addColorStop(0.35, 'rgba(255,255,255,0.3)');
        gr.addColorStop(0.6, 'rgba(255,255,255,0.2)');
        gr.addColorStop(1, 'rgba(255,255,255,0)');
        g.fillStyle = gr; g.beginPath(); g.arc(h, h, h, 0, Math.PI * 2); g.fill();
        _effectTextures.shockwaveRing = new PIXI.Texture(PIXI.BaseTexture.from(c));
    }

    // FireWave 火焰环（橙→红→透明环形渐变）
    {
        const s = 128, h = 64;
        const c = new OffscreenCanvas(s, s);
        const g = c.getContext('2d');
        const gr = g.createRadialGradient(h, h, h * 0.35, h, h, h);
        gr.addColorStop(0, 'rgba(255,200,0,0)');
        gr.addColorStop(0.3, 'rgba(249,115,22,0.35)');
        gr.addColorStop(0.6, 'rgba(220,38,38,0.25)');
        gr.addColorStop(1, 'rgba(127,29,29,0)');
        g.fillStyle = gr; g.beginPath(); g.arc(h, h, h, 0, Math.PI * 2); g.fill();
        _effectTextures.fireRing = new PIXI.Texture(PIXI.BaseTexture.from(c));
    }

    // BladeStormVortex 涡心辉光（冰蓝径向渐变）
    {
        const s = 256, h = 128;
        const c = new OffscreenCanvas(s, s);
        const g = c.getContext('2d');
        const gr = g.createRadialGradient(h, h, 0, h, h, h);
        gr.addColorStop(0, 'rgba(191,233,255,0.22)');
        gr.addColorStop(0.5, 'rgba(56,189,248,0.10)');
        gr.addColorStop(1, 'rgba(56,189,248,0)');
        g.fillStyle = gr; g.beginPath(); g.arc(h, h, h, 0, Math.PI * 2); g.fill();
        _effectTextures.vortexGlow = new PIXI.Texture(PIXI.BaseTexture.from(c));
    }

    // SlashEffect 斩击核心（白色水平梭形渐变）
    {
        const w = 128, ht = 64;
        const c = new OffscreenCanvas(w, ht);
        const g = c.getContext('2d');
        const gr = g.createLinearGradient(0, ht / 2, w, ht / 2);
        gr.addColorStop(0, 'rgba(255,255,255,0)');
        gr.addColorStop(0.2, 'rgba(255,255,255,0.8)');
        gr.addColorStop(0.5, 'rgba(255,255,255,1)');
        gr.addColorStop(0.8, 'rgba(255,255,255,0.8)');
        gr.addColorStop(1, 'rgba(255,255,255,0)');
        g.fillStyle = gr;
        g.beginPath();
        g.moveTo(0, ht / 2);
        g.quadraticCurveTo(w / 2, 0, w, ht / 2);
        g.quadraticCurveTo(w / 2, ht, 0, ht / 2);
        g.fill();
        _effectTextures.slashSpindle = new PIXI.Texture(PIXI.BaseTexture.from(c));
    }

    // BladeStormRing 剑刃风暴扩散环（绿色环形）
    {
        const s = 128, h = 64;
        const c = new OffscreenCanvas(s, s);
        const g = c.getContext('2d');
        const gr = g.createRadialGradient(h, h, h * 0.6, h, h, h);
        gr.addColorStop(0, 'rgba(52,211,153,0)');
        gr.addColorStop(0.4, 'rgba(52,211,153,0.4)');
        gr.addColorStop(0.7, 'rgba(52,211,153,0.3)');
        gr.addColorStop(1, 'rgba(52,211,153,0)');
        g.fillStyle = gr; g.beginPath(); g.arc(h, h, h, 0, Math.PI * 2); g.fill();
        _effectTextures.bladeStormRing = new PIXI.Texture(PIXI.BaseTexture.from(c));
    }

    // ─── [开炮 VFX 增强] 枪口火光 V2 预烘焙纹理 ──────────────────

    // muzzleCore: 白热核心 → 元素色（tint 动态上色）→ 透明的径向渐变
    {
        const s = 128, h = 64;
        const c = new OffscreenCanvas(s, s);
        const g = c.getContext('2d');
        const gr = g.createRadialGradient(h, h, 0, h, h, h);
        gr.addColorStop(0,    'rgba(255,255,255,1)');
        gr.addColorStop(0.15, 'rgba(255,255,240,0.95)');
        gr.addColorStop(0.4,  'rgba(255,255,255,0.6)');
        gr.addColorStop(0.7,  'rgba(255,255,255,0.2)');
        gr.addColorStop(1,    'rgba(255,255,255,0)');
        g.fillStyle = gr; g.beginPath(); g.arc(h, h, h, 0, Math.PI * 2); g.fill();
        _effectTextures.muzzleCore = new PIXI.Texture(PIXI.BaseTexture.from(c, { scaleMode: PIXI.SCALE_MODES.LINEAR }));
    }

    // muzzleFlare: 方向性光锥（沿 X 轴拉长的锥形光焰）
    {
        const w = 256, ht = 64;
        const c = new OffscreenCanvas(w, ht);
        const g = c.getContext('2d');
        const cy = ht / 2;
        // 水平线性渐变：根部亮 → 尖端透明
        const gr = g.createLinearGradient(0, cy, w, cy);
        gr.addColorStop(0,    'rgba(255,255,255,0.95)');
        gr.addColorStop(0.15, 'rgba(255,255,240,0.8)');
        gr.addColorStop(0.5,  'rgba(255,255,255,0.35)');
        gr.addColorStop(1,    'rgba(255,255,255,0)');
        g.fillStyle = gr;
        // 锥形：根部宽 → 尖端收窄
        g.beginPath();
        g.moveTo(0, cy);
        g.quadraticCurveTo(w * 0.3, 0, w, cy);
        g.quadraticCurveTo(w * 0.3, ht, 0, cy);
        g.closePath();
        g.fill();
        _effectTextures.muzzleFlare = new PIXI.Texture(PIXI.BaseTexture.from(c, { scaleMode: PIXI.SCALE_MODES.LINEAR }));
    }

    // muzzleSpark: 火星小圆点（16×16 明亮白点）
    {
        const s = 16, h = 8;
        const c = new OffscreenCanvas(s, s);
        const g = c.getContext('2d');
        const gr = g.createRadialGradient(h, h, 0, h, h, h);
        gr.addColorStop(0,   'rgba(255,255,255,1)');
        gr.addColorStop(0.4, 'rgba(255,255,240,0.9)');
        gr.addColorStop(0.7, 'rgba(255,255,255,0.4)');
        gr.addColorStop(1,   'rgba(255,255,255,0)');
        g.fillStyle = gr; g.beginPath(); g.arc(h, h, h, 0, Math.PI * 2); g.fill();
        _effectTextures.muzzleSpark = new PIXI.Texture(PIXI.BaseTexture.from(c, { scaleMode: PIXI.SCALE_MODES.LINEAR }));
    }

    // ─── [弹道光照] bulletGlow: 子弹环境光纹理 ──────────────────
    // 128×128 柔和径向渐变，白色中心 → 透明边缘
    // 用于子弹飞行时的微弱动态光照 + 命中闪光脉冲
    {
        const s = 128, h = 64;
        const c = new OffscreenCanvas(s, s);
        const g = c.getContext('2d');
        const gr = g.createRadialGradient(h, h, 0, h, h, h);
        gr.addColorStop(0,    'rgba(255,255,255,0.9)');
        gr.addColorStop(0.25, 'rgba(255,255,255,0.5)');
        gr.addColorStop(0.55, 'rgba(255,255,255,0.15)');
        gr.addColorStop(1,    'rgba(255,255,255,0)');
        g.fillStyle = gr; g.beginPath(); g.arc(h, h, h, 0, Math.PI * 2); g.fill();
        _effectTextures.bulletGlow = new PIXI.Texture(PIXI.BaseTexture.from(c, { scaleMode: PIXI.SCALE_MODES.LINEAR }));
    }

    // ─── [元素视觉] 6 张元素专属纹理 ──────────────────────────────

    // frostHex: 六角雪花模板，白色线条，用于 Cryo 共鸣冰裂纹
    {
        const s = 64, h = 32;
        const c = new OffscreenCanvas(s, s);
        const g = c.getContext('2d');
        g.strokeStyle = 'rgba(207, 250, 254, 0.9)';
        g.lineWidth = 1.5;
        g.lineCap = 'round';
        for (let i = 0; i < 6; i++) {
            const a = i * Math.PI / 3;
            g.beginPath();
            g.moveTo(h, h);
            g.lineTo(h + Math.cos(a) * h * 0.85, h + Math.sin(a) * h * 0.85);
            g.stroke();
            // 小分叉
            const bx = h + Math.cos(a) * h * 0.55, by = h + Math.sin(a) * h * 0.55;
            for (const da of [-0.5, 0.5]) {
                g.beginPath();
                g.moveTo(bx, by);
                g.lineTo(bx + Math.cos(a + da) * h * 0.25, by + Math.sin(a + da) * h * 0.25);
                g.stroke();
            }
        }
        _effectTextures.frostHex = new PIXI.Texture(PIXI.BaseTexture.from(c, { scaleMode: PIXI.SCALE_MODES.LINEAR }));
    }

    // electricArc: 短弧段，白色中心→紫色边缘，用于 Lightning 电弧碎片
    {
        const s = 32, w2 = 16, h2 = 8;
        const c = new OffscreenCanvas(s, s);
        const g = c.getContext('2d');
        const gr = g.createLinearGradient(0, h2, s, h2);
        gr.addColorStop(0, 'rgba(192, 132, 252, 0)');
        gr.addColorStop(0.3, 'rgba(192, 132, 252, 0.6)');
        gr.addColorStop(0.5, 'rgba(255, 255, 255, 0.9)');
        gr.addColorStop(0.7, 'rgba(192, 132, 252, 0.6)');
        gr.addColorStop(1, 'rgba(192, 132, 252, 0)');
        g.strokeStyle = gr;
        g.lineWidth = 3;
        g.lineCap = 'round';
        g.beginPath();
        g.moveTo(2, h2 + 2);
        g.quadraticCurveTo(w2, h2 - 6, s - 2, h2 + 1);
        g.stroke();
        _effectTextures.electricArc = new PIXI.Texture(PIXI.BaseTexture.from(c, { scaleMode: PIXI.SCALE_MODES.LINEAR }));
    }

    // venomDrip: 泪滴形绿色渐变，用于 Venom 持续效果滴落
    {
        const s = 48, h2 = 24;
        const c = new OffscreenCanvas(s, s);
        const g = c.getContext('2d');
        // 泪滴形状（上尖下圆）
        const gr = g.createRadialGradient(h2, h2 + 4, 0, h2, h2 + 4, h2 * 0.7);
        gr.addColorStop(0, 'rgba(200, 255, 180, 0.9)');
        gr.addColorStop(0.4, 'rgba(132, 204, 22, 0.7)');
        gr.addColorStop(1, 'rgba(74, 222, 128, 0)');
        g.fillStyle = gr;
        g.beginPath();
        g.moveTo(h2, 2); // 顶部尖点
        g.quadraticCurveTo(s - 4, h2, h2, s - 4); // 右侧弧线
        g.quadraticCurveTo(4, h2, h2, 2); // 左侧弧线
        g.fill();
        _effectTextures.venomDrip = new PIXI.Texture(PIXI.BaseTexture.from(c, { scaleMode: PIXI.SCALE_MODES.LINEAR }));
    }

    // windVortex: 环形翡翠弧线辐射，用于 Wind 持续效果风场标记
    {
        const s = 128, h2 = 64;
        const c = new OffscreenCanvas(s, s);
        const g = c.getContext('2d');
        g.strokeStyle = 'rgba(52, 211, 153, 0.6)';
        g.lineWidth = 2;
        g.lineCap = 'round';
        // 4 条旋转弧线
        for (let i = 0; i < 4; i++) {
            const a = i * Math.PI / 2;
            g.beginPath();
            g.arc(h2, h2, h2 * 0.7, a, a + Math.PI * 0.4);
            g.stroke();
            g.beginPath();
            g.arc(h2, h2, h2 * 0.45, a + 0.3, a + 0.3 + Math.PI * 0.3);
            g.stroke();
        }
        // 中心微弱径向渐变
        const gr = g.createRadialGradient(h2, h2, 0, h2, h2, h2 * 0.3);
        gr.addColorStop(0, 'rgba(52, 211, 153, 0.15)');
        gr.addColorStop(1, 'rgba(52, 211, 153, 0)');
        g.fillStyle = gr;
        g.beginPath(); g.arc(h2, h2, h2 * 0.3, 0, Math.PI * 2); g.fill();
        _effectTextures.windVortex = new PIXI.Texture(PIXI.BaseTexture.from(c, { scaleMode: PIXI.SCALE_MODES.LINEAR }));
    }

    // starBurst: 四角金色辐射线，用于 Scatter 命中星爆
    {
        const s = 64, h2 = 32;
        const c = new OffscreenCanvas(s, s);
        const g = c.getContext('2d');
        g.strokeStyle = 'rgba(250, 204, 21, 0.8)';
        g.lineWidth = 2;
        g.lineCap = 'round';
        // 4 条主辐射线
        for (let i = 0; i < 4; i++) {
            const a = i * Math.PI / 2;
            const gr = g.createLinearGradient(h2, h2, h2 + Math.cos(a) * h2 * 0.9, h2 + Math.sin(a) * h2 * 0.9);
            gr.addColorStop(0, 'rgba(255, 255, 255, 0.9)');
            gr.addColorStop(0.5, 'rgba(250, 204, 21, 0.6)');
            gr.addColorStop(1, 'rgba(250, 204, 21, 0)');
            g.strokeStyle = gr;
            g.beginPath();
            g.moveTo(h2, h2);
            g.lineTo(h2 + Math.cos(a) * h2 * 0.9, h2 + Math.sin(a) * h2 * 0.9);
            g.stroke();
        }
        // 4 条短辅辐射线（45°偏移）
        g.strokeStyle = 'rgba(250, 204, 21, 0.4)';
        g.lineWidth = 1;
        for (let i = 0; i < 4; i++) {
            const a = i * Math.PI / 2 + Math.PI / 4;
            g.beginPath();
            g.moveTo(h2, h2);
            g.lineTo(h2 + Math.cos(a) * h2 * 0.5, h2 + Math.sin(a) * h2 * 0.5);
            g.stroke();
        }
        _effectTextures.starBurst = new PIXI.Texture(PIXI.BaseTexture.from(c, { scaleMode: PIXI.SCALE_MODES.LINEAR }));
    }

    // echoRipple: 3 圈蓝色同心圆波纹，用于 Echo 回响触发
    {
        const s = 128, h2 = 64;
        const c = new OffscreenCanvas(s, s);
        const g = c.getContext('2d');
        const radii = [h2 * 0.35, h2 * 0.6, h2 * 0.85];
        const alphas = [0.7, 0.45, 0.2];
        for (let i = 0; i < 3; i++) {
            g.strokeStyle = `rgba(96, 165, 250, ${alphas[i]})`;
            g.lineWidth = 2.5 - i * 0.5;
            g.beginPath();
            g.arc(h2, h2, radii[i], 0, Math.PI * 2);
            g.stroke();
        }
        _effectTextures.echoRipple = new PIXI.Texture(PIXI.BaseTexture.from(c, { scaleMode: PIXI.SCALE_MODES.LINEAR }));
    }
}

/**
 * 获取特效根容器（延迟创建）
 * @returns {PIXI.Container|null}
 */
export function pixiGetEffectContainer() {
    if (!_active || !gameContainer) return null;
    if (!_effectContainer) {
        _effectContainer = new PIXI.Container();
        _effectContainer.eventMode = 'none';
        _effectContainer.blendMode = PIXI.BLEND_MODES.ADD;
        gameContainer.addChild(_effectContainer);
    }
    return _effectContainer;
}

/**
 * 获取特效预烘焙纹理
 * @param {string} name 纹理名（glow/iceRing/beam/healGlow/healRing）
 * @returns {PIXI.Texture|null}
 */
export function pixiGetEffectTexture(name) {
    return _effectTextures[name] || null;
}

/**
 * 获取粒子预烘焙纹理（供 BurnEffect 等特效适配器复用 ember/mist 等粒子贴图）
 * @param {string} name 纹理名（spark/ember/mist/venom/smoke/shard/wind_slash/line）
 * @returns {PIXI.Texture|null}
 */
export function pixiGetParticleTexture(name) {
    return _bakedTextures[name] || null;
}

/**
 * [T1.2] 初始化 PixiJS Application 并叠加到 game-container 中。
 * 必须在 Game 构造函数中 canvas 获取之后调用。
 *
 * @returns {boolean} 是否初始化成功
 */
export function pixiInit() {
    if (pixiApp) return true;
    if (typeof PIXI === 'undefined') {
        console.warn('[pixi_bridge] PIXI global not found — CDN 未加载或版本不匹配，WebGL 层跳过初始化');
        return false;
    }

    try {
        const container = document.getElementById('game-container');
        if (!container) {
            console.warn('[pixi_bridge] #game-container not found');
            return false;
        }

        const rect = container.getBoundingClientRect();
        const w = Math.round(rect.width) || 480;
        const h = Math.round(rect.height) || 854;

        pixiApp = new PIXI.Application({
            width: w,
            height: h,
            backgroundAlpha: 0,           // 透明背景，叠加在主 Canvas 上
            antialias: false,              // 粒子渲染不需要抗锯齿
            autoStart: false,             // 手动 tick 驱动，不启用 PixiJS 内部 rAF
            autoDensity: true,            // 自动适配 devicePixelRatio
            resolution: window.devicePixelRatio || 1,
            powerPreference: 'high-performance',
        });

        // CSS 叠加：透明 canvas 覆盖在主 Canvas 上，不拦截鼠标事件
        const view = pixiApp.view;
        view.style.position = 'absolute';
        view.style.top = '0';
        view.style.left = '0';
        view.style.pointerEvents = 'none';
        view.style.zIndex = '1';         // 高于主 canvas(0)，低于 DOM UI
        container.appendChild(view);

        // 游戏根容器（屏幕震动偏移目标）
        gameContainer = new PIXI.Container();
        gameContainer.eventMode = 'none';
        pixiApp.stage.addChild(gameContainer);
        // 让 stage 不响应交互事件
        pixiApp.stage.eventMode = 'none';

        // 预烘焙发光纹理
        _initBakedTextures();
        // 预烘焙特效纹理（环形、光柱、辉光）
        _initEffectTextures();

        _active = true;
        console.log(`[pixi_bridge] PixiJS ${PIXI.VERSION} 初始化完成 (${w}×${h} @${pixiApp.renderer.resolution}x)`);
        return true;
    } catch (err) {
        console.error('[pixi_bridge] 初始化失败:', err);
        _active = false;
        return false;
    }
}

/**
 * [T1.4] 每帧 tick：手动驱动 PixiJS 渲染一帧。
 * 由 sys_loop() 在 ctx.restore() 之前调用。
 *
 * @param {number} shakeX 当前帧屏幕震动 X 偏移
 * @param {number} shakeY 当前帧屏幕震动 Y 偏移
 */
export function pixiTick(shakeX, shakeY) {
    if (!_active || !pixiApp) return;

    // 同步屏幕震动到 PixiJS 根容器（与 ctx.translate 保持一致）
    if (gameContainer) {
        gameContainer.x = shakeX || 0;
        gameContainer.y = shakeY || 0;
    }

    // 更新所有活跃滤镜（动画参数、衰减等）
    filterUpdateAll(16);

    pixiApp.renderer.render(pixiApp.stage);
}

/**
 * [T1.3] 响应窗口 / Canvas 尺寸变化，同步 PixiJS renderer 尺寸。
 * 由 sys_resize() 在 canvas.width/height 设置之后调用。
 *
 * @param {number} w 新宽度
 * @param {number} h 新高度
 */
export function pixiResize(w, h) {
    if (!_active || !pixiApp) return;
    pixiApp.renderer.resize(w, h);
}

/**
 * [T1.5] 页面可见性处理：后台时停止 PixiJS ticker，前台时恢复。
 * 由 sys_setupVisibilityHandling() 在对应分支中调用。
 *
 * @param {boolean} hidden 页面是否隐藏
 */
export function pixiSetVisibility(hidden) {
    if (!_active || !pixiApp) return;
    if (hidden) {
        pixiApp.stop();
    } else {
        // autoStart: false 模式下 stop 只是标记，这里不需要 start
        // 因为渲染完全由 pixiTick 手动驱动
    }
}

/**
 * [T1.6] 释放 PixiJS 资源。
 * 由 Game.destroy() 调用。
 */
export function pixiDestroy() {
    if (!pixiApp) return;
    _active = false;

    // 清理所有活跃滤镜
    filterDestroyAll();

    // 清理所有 ParticleContainer
    for (const key of Object.keys(_particleContainers)) {
        const c = _particleContainers[key];
        if (c) {
            c.destroy({ children: true });
        }
        delete _particleContainers[key];
    }

    // 清理预烘焙纹理
    for (const key of Object.keys(_bakedTextures)) {
        const tex = _bakedTextures[key];
        if (tex) {
            tex.baseTexture.destroy();
            tex.destroy();
        }
        delete _bakedTextures[key];
    }

    // 清理 Sprite 对象池
    for (let i = 0; i < _spritePool.length; i++) {
        _spritePool[i].destroy();
    }
    _spritePool.length = 0;

    // 清理特效容器和纹理
    if (_effectContainer) {
        _effectContainer.destroy({ children: true });
        _effectContainer = null;
    }
    for (const key of Object.keys(_effectTextures)) {
        const tex = _effectTextures[key];
        if (tex) {
            tex.baseTexture.destroy();
            tex.destroy();
        }
        delete _effectTextures[key];
    }

    // 从 DOM 移除 PixiJS canvas
    if (pixiApp.view && pixiApp.view.parentNode) {
        pixiApp.view.parentNode.removeChild(pixiApp.view);
    }

    // 销毁 PixiJS Application
    pixiApp.destroy(true, { children: true, texture: false, baseTexture: false });
    pixiApp = null;
    gameContainer = null;
    console.log('[pixi_bridge] PixiJS 资源已释放');
}
