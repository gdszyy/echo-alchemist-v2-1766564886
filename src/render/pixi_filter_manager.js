/**
 * src/render/pixi_filter_manager.js — PixiJS Filter 管理器
 *
 * [PixiJS 迁移 · 滤镜基础设施]
 *
 * 提供 PixiJS 7 Filter 的创建、生命周期管理和预设滤镜工厂。
 * 支持 ColorMatrixFilter（色调变换）、BlurFilter（模糊）和自定义 Fragment Shader。
 *
 * 架构：
 *   - 滤镜通过 DisplayObject.filters 数组施加于 PIXI Container / Sprite
 *   - 全局后处理滤镜施加于 gameContainer（屏幕级效果，如共鸣脉冲）
 *   - 局部滤镜施加于效果适配器内的 PIXI 对象（如 BurnEffect aura）
 *   - 所有滤镜受 CONFIG.performance 三档门控
 *
 * 依赖：PixiJS 7.x 全局变量（CDN 加载，挂载于 window.PIXI）
 *
 * @module render/pixi_filter_manager
 * @perf-impact: Filter 引入额外 framebuffer 渲染通道，每个 filter ≈ 2 draw calls
 */

import { CONFIG } from '../config.js';

// ─── 本地 PixiJS 活跃检查（避免与 pixi_bridge.js 循环依赖）───

/**
 * 本地检查 PixiJS 是否可用（不依赖 pixi_bridge 导出）
 * @returns {boolean}
 */
function _pixiReady() {
    return typeof PIXI !== 'undefined' && !!PIXI.Application;
}

// ─── 滤镜注册表 ────────────────────────────────────────────────

/**
 * 活跃滤镜注册表：key → { target, filters[], updateFn, tag }
 * @type {Map<string, object>}
 */
const _activeFilters = new Map();

/** 自增 ID，用于无名滤镜 */
let _filterIdSeq = 0;

// ─── 性能门控 ────────────────────────────────────────────────

/**
 * 获取当前性能档位
 * @returns {'high'|'medium'|'low'}
 */
function _perfTier() {
    if (typeof game !== 'undefined' && game.perfQualityLevel) {
        return game.perfQualityLevel;
    }
    return 'high';
}

/**
 * 滤镜是否在低画质下允许启用
 * @param {'high'|'medium'|'low'} minTier 最低允许档位
 * @returns {boolean}
 */
function _perfAllowed(minTier) {
    const tier = _perfTier();
    const order = { high: 3, medium: 2, low: 1 };
    return (order[tier] || 3) >= (order[minTier] || 1);
}

// ─── 核心 API ────────────────────────────────────────────────

/**
 * 将滤镜组施加到目标 PIXI 显示对象。
 * 如果该 key 已存在，先移除旧滤镜再施加新的。
 *
 * @param {string} key 唯一标识（如 'cryo_tint_001'）
 * @param {PIXI.DisplayObject} target 目标显示对象
 * @param {PIXI.Filter[]} filters 滤镜数组
 * @param {object} [opts] 选项
 * @param {Function} [opts.updateFn] 每帧更新回调 (filter, dt) => void
 * @param {string} [opts.tag] 分类标签（如 'element_cryo'）
 * @param {'high'|'medium'|'low'} [opts.minTier] 最低性能档位（默认 'low'）
 * @returns {boolean} 是否成功施加
 */
export function filterApply(key, target, filters, opts = {}) {
    if (!_pixiReady() || !target) return false;

    const minTier = opts.minTier || 'low';
    if (!_perfAllowed(minTier)) return false;

    // 移除旧滤镜（如果有）
    if (_activeFilters.has(key)) {
        filterRemove(key);
    }

    // 合并到 target 的现有 filters 数组
    const existing = target.filters ? [...target.filters] : [];
    const merged = existing.concat(filters);
    target.filters = merged;

    _activeFilters.set(key, {
        target,
        filters,
        updateFn: opts.updateFn || null,
        tag: opts.tag || '',
    });

    return true;
}

/**
 * 移除指定 key 的滤镜组。
 *
 * @param {string} key 滤镜标识
 * @returns {boolean} 是否找到并移除
 */
export function filterRemove(key) {
    const entry = _activeFilters.get(key);
    if (!entry) return false;

    const { target, filters } = entry;
    if (target && target.filters) {
        // 从 target.filters 数组中移除本组的滤镜
        const remaining = target.filters.filter(f => !filters.includes(f));
        target.filters = remaining.length > 0 ? remaining : null;
    }

    // 销毁滤镜对象释放 GPU 资源
    for (const f of filters) {
        if (f && typeof f.destroy === 'function') {
            f.destroy();
        }
    }

    _activeFilters.delete(key);
    return true;
}

/**
 * 更新所有活跃滤镜（由 pixiTick 调用）。
 *
 * @param {number} dt 帧间隔时间（毫秒）
 */
export function filterUpdateAll(dt) {
    for (const [key, entry] of _activeFilters) {
        if (entry.updateFn) {
            for (const f of entry.filters) {
                entry.updateFn(f, dt);
            }
        }
    }
}

/**
 * 移除指定 tag 的所有滤镜。
 * 用于阶段转换时批量清理（如清除所有 'element_*' 滤镜）。
 *
 * @param {string} tagPrefix 标签前缀（如 'element_'）
 */
export function filterRemoveByTag(tagPrefix) {
    const keysToRemove = [];
    for (const [key, entry] of _activeFilters) {
        if (entry.tag && entry.tag.startsWith(tagPrefix)) {
            keysToRemove.push(key);
        }
    }
    for (const key of keysToRemove) {
        filterRemove(key);
    }
}

/**
 * 销毁所有活跃滤镜（pixiDestroy 时调用）。
 */
export function filterDestroyAll() {
    for (const key of [..._activeFilters.keys()]) {
        filterRemove(key);
    }
}

/**
 * 切换滤镜启用状态（不移除，仅 enabled = false）。
 *
 * @param {string} key 滤镜标识
 * @param {boolean} enabled 是否启用
 */
export function filterSetEnabled(key, enabled) {
    const entry = _activeFilters.get(key);
    if (!entry) return;
    for (const f of entry.filters) {
        f.enabled = enabled;
    }
}

// ─── 预设滤镜工厂 ────────────────────────────────────────────────

/**
 * 创建 ColorMatrixFilter 色调滤镜。
 * PixiJS 7 内置: PIXI.filters.ColorMatrixFilter
 *
 * @param {object} [opts] 选项
 * @param {number} [opts.brightness] 亮度 (0-1, 1=原值)
 * @param {number} [opts.contrast] 对比度 (0-1)
 * @param {number} [opts.saturation] 饱和度 (-1=去饱和, 0=原值, 1=过饱和)
 * @param {number} [opts.hue] 色相旋转（角度）
 * @param {number} [opts.alpha] 滤镜混合强度 (0-1)
 * @returns {PIXI.ColorMatrixFilter|null}
 */
export function createColorMatrixFilter(opts = {}) {
    if (!_pixiReady()) return null;
    if (!PIXI.filters || !PIXI.filters.ColorMatrixFilter) return null;

    const cmf = new PIXI.filters.ColorMatrixFilter();

    if (opts.brightness !== undefined) cmf.brightness(opts.brightness, false);
    if (opts.contrast !== undefined) cmf.contrast(opts.contrast, true);
    if (opts.saturation !== undefined) cmf.saturate(opts.saturation, true);
    if (opts.hue !== undefined) cmf.hue(opts.hue, true);
    if (opts.alpha !== undefined) cmf.alpha = opts.alpha;

    return cmf;
}

/**
 * 创建 BlurFilter 模糊滤镜。
 * PixiJS 7 内置: PIXI.filters.BlurFilter
 *
 * @param {object} [opts] 选项
 * @param {number} [opts.strength] 模糊强度（默认 4）
 * @param {number} [opts.quality] 渲染质量（1-4，默认 2）
 * @param {number} [opts.resolution] 分辨率（0.5=半分辨率，默认 1）
 * @returns {PIXI.BlurFilter|null}
 */
export function createBlurFilter(opts = {}) {
    if (!_pixiReady()) return null;
    if (!PIXI.filters || !PIXI.filters.BlurFilter) return null;

    const strength = opts.strength || 4;
    const quality = opts.quality || 2;
    const resolution = opts.resolution !== undefined ? opts.resolution : 1;

    const blur = new PIXI.filters.BlurFilter(strength, quality, resolution);
    return blur;
}

/**
 * 创建 NoiseFilter 噪点滤镜。
 * PixiJS 7 内置: PIXI.filters.NoiseFilter
 *
 * @param {number} [noise=0.5] 噪点强度
 * @param {number} [seed=Math.random()] 随机种子
 * @returns {PIXI.NoiseFilter|null}
 */
export function createNoiseFilter(noise = 0.5, seed) {
    if (!_pixiReady()) return null;
    if (!PIXI.filters || !PIXI.filters.NoiseFilter) return null;

    return new PIXI.filters.NoiseFilter(noise, seed);
}

// ─── 元素专属预设 ────────────────────────────────────────────────

/**
 * 冰冻色调滤镜 — 施加于冰冻效果的 PixiJS 对象。
 * 冷蓝色偏移 + 轻微去饱和，营造冰封质感。
 *
 * @returns {PIXI.ColorMatrixFilter|null}
 */
export function presetCryoTint() {
    const cmf = createColorMatrixFilter({
        brightness: 0.85,
        saturation: -0.3,
        alpha: 0.6,
    });
    // 手动追加蓝色偏移矩阵（multiply=true 叠加到上面的矩阵上）
    if (cmf) {
        // 蓝色通道增强：B += 0.15
        const blueShift = new Float32Array([
            1,    0,    0,    0,   0,
            0,    1,    0,    0,   0,
            0,    0,    1.2,  0,   0.15,
            0,    0,    0,    1,   0,
        ]);
        // 将 blueShift 与当前矩阵相乘
        const orig = new Float32Array(cmf.matrix);
        const out = new Float32Array(20);
        // 5x4 矩阵乘法：result[i] = sum(blueShift[i/5*5..i/5*5+4] * orig[...])
        for (let row = 0; row < 4; row++) {
            for (let col = 0; col < 5; col++) {
                let val = 0;
                for (let k = 0; k < 5; k++) {
                    const a = blueShift[row * 5 + k];
                    const b = k < 4 ? orig[row * 5 + k] : 0;
                    // 5x4 矩阵与偏移相乘的简化版
                    if (k === 4) {
                        val += a; // offset column
                    } else {
                        val += blueShift[row * 5 + k] * orig[k * 5 + col];
                    }
                }
                out[row * 5 + col] = val;
            }
        }
        cmf.matrix = out;
    }
    return cmf;
}

/**
 * 火焰暖调滤镜 — 施加于燃烧效果的 PixiJS 对象。
 * 红色通道增强 + 亮度微升，营造灼热感。
 *
 * @returns {PIXI.ColorMatrixFilter|null}
 */
export function presetPyroTint() {
    return createColorMatrixFilter({
        brightness: 1.15,
        saturation: 0.3,
        alpha: 0.5,
    });
}

/**
 * 闪电脉冲滤镜 — 施加于电弧效果的 PixiJS 对象。
 * 高亮度 + 轻微色相偏移，配合 updateFn 实现闪烁。
 *
 * @returns {{ filter: PIXI.ColorMatrixFilter, updateFn: Function }}
 */
export function presetLightningPulse() {
    const cmf = createColorMatrixFilter({
        brightness: 1.3,
        contrast: 0.2,
        alpha: 0.7,
    });
    if (!cmf) return null;

    // 闪烁更新：alpha 在 0.3-0.9 之间高频振荡
    const updateFn = (filter, dt) => {
        const t = performance.now() * 0.008;
        filter.alpha = 0.3 + (Math.sin(t * 3.7) + 1) * 0.3;
    };

    return { filter: cmf, updateFn };
}

/**
 * 共鸣激活全局脉冲滤镜 — 施加于 gameContainer 产生全屏元素色调闪烁。
 * 持续时间短（300-800ms），alpha 从峰值衰减至 0。
 *
 * @param {string} element 元素 key（pyro/cryo/lightning/venom/wind/laser）
 * @param {number} [duration=600] 持续时间（毫秒）
 * @returns {{ key: string, filter: PIXI.ColorMatrixFilter, updateFn: Function }|null}
 */
export function presetResonancePulse(element, duration = 600) {
    // 元素 → 色调参数映射
    const ELEMENT_PRESETS = {
        pyro:      { brightness: 1.2, hue: -10, alpha: 0.4 },
        cryo:      { brightness: 0.9, hue: 200, alpha: 0.35 },
        lightning: { brightness: 1.4, hue: 270, alpha: 0.3 },
        venom:     { brightness: 1.0, hue: 120, alpha: 0.3 },
        wind:      { brightness: 1.1, hue: 160, alpha: 0.25 },
        laser:     { brightness: 1.3, hue: 195, alpha: 0.3 },
    };

    const preset = ELEMENT_PRESETS[element];
    if (!preset) return null;

    const cmf = createColorMatrixFilter(preset);
    if (!cmf) return null;

    const startTime = performance.now();
    const peakAlpha = preset.alpha;

    // 衰减更新：alpha 从峰值线性衰减至 0
    const updateFn = (filter) => {
        const elapsed = performance.now() - startTime;
        const progress = Math.min(1, elapsed / duration);
        filter.alpha = peakAlpha * (1 - progress);
    };

    return {
        key: `resonance_pulse_${element}_${_filterIdSeq++}`,
        filter: cmf,
        updateFn,
    };
}

// ─── 自定义 Shader 滤镜 ──────────────────────────────────────────

/**
 * 热浪扭曲滤镜（Heat Haze）。
 * 使用正弦波位移纹理坐标，模拟热空气折射效果。
 *
 * GLSL 片段着色器：
 *   - uTime: 时间驱动动画
 *   - uIntensity: 扭曲强度（像素偏移量）
 *   - uFrequency: 波纹频率
 *
 * @param {object} [opts] 选项
 * @param {number} [opts.intensity=3.0] 扭曲强度
 * @param {number} [opts.frequency=8.0] 波纹频率
 * @returns {PIXI.Filter|null}
 */
export function createHeatHazeFilter(opts = {}) {
    if (!_pixiReady()) return null;

    const intensity = opts.intensity !== undefined ? opts.intensity : 3.0;
    const frequency = opts.frequency !== undefined ? opts.frequency : 8.0;

    const fragmentSrc = `
        precision mediump float;

        varying vec2 vTextureCoord;
        uniform sampler2D uSampler;
        uniform float uTime;
        uniform float uIntensity;
        uniform float uFrequency;
        uniform vec4 inputClamp;
        uniform vec4 inputSize;

        void main(void)
        {
            vec2 coord = vTextureCoord;

            // 正弦波位移：沿 Y 轴产生水平热浪扭曲
            float wave = sin(coord.y * uFrequency + uTime * 2.5) * uIntensity * inputSize.z;
            coord.x += wave;

            // 钳制到有效纹理区域，防止采样越界
            coord = clamp(coord, inputClamp.xy, inputClamp.zw);

            gl_FragColor = texture2D(uSampler, coord);
        }
    `;

    const filter = new PIXI.Filter(null, fragmentSrc, {
        uTime: 0.0,
        uIntensity: intensity,
        uFrequency: frequency,
    });

    filter.padding = Math.ceil(intensity) + 2;
    return filter;
}

/**
 * 霜冻覆盖滤镜（Frost Overlay）。
 * 冷蓝色调 + 微弱的边缘光晕，模拟冰冻玻璃质感。
 *
 * @param {object} [opts] 选项
 * @param {number} [opts.intensity=0.5] 效果强度 (0-1)
 * @returns {PIXI.Filter|null}
 */
export function createFrostOverlayFilter(opts = {}) {
    if (!_pixiReady()) return null;

    const intensity = opts.intensity !== undefined ? opts.intensity : 0.5;

    const fragmentSrc = `
        precision mediump float;

        varying vec2 vTextureCoord;
        uniform sampler2D uSampler;
        uniform float uIntensity;
        uniform float uTime;

        void main(void)
        {
            vec4 color = texture2D(uSampler, vTextureCoord);

            // 冷蓝色偏移
            float blueShift = uIntensity * 0.25;
            color.b += blueShift * color.a;

            // 边缘微光：基于纹理坐标到中心的距离
            vec2 center = vec2(0.5);
            float dist = distance(vTextureCoord, center);
            float edgeGlow = smoothstep(0.3, 0.8, dist) * uIntensity * 0.15;
            color.rgb += vec3(0.7, 0.9, 1.0) * edgeGlow;

            // 微弱的冰晶闪烁噪声
            float noise = fract(sin(dot(vTextureCoord * 100.0 + uTime * 0.3, vec2(12.9898, 78.233))) * 43758.5453);
            color.rgb += vec3(1.0) * noise * uIntensity * 0.03;

            gl_FragColor = color;
        }
    `;

    const filter = new PIXI.Filter(null, fragmentSrc, {
        uIntensity: intensity,
        uTime: 0.0,
    });

    return filter;
}

/**
 * 毒液渗流滤镜（Venom Seep）。
 * 绿色通道增强 + 微弱的有机脉动，模拟毒素侵蚀。
 *
 * @param {object} [opts] 选项
 * @param {number} [opts.intensity=0.4] 效果强度 (0-1)
 * @returns {PIXI.Filter|null}
 */
export function createVenomSeepFilter(opts = {}) {
    if (!_pixiReady()) return null;

    const intensity = opts.intensity !== undefined ? opts.intensity : 0.4;

    const fragmentSrc = `
        precision mediump float;

        varying vec2 vTextureCoord;
        uniform sampler2D uSampler;
        uniform float uIntensity;
        uniform float uTime;

        void main(void)
        {
            vec4 color = texture2D(uSampler, vTextureCoord);

            // 绿色通道增强
            color.g += uIntensity * 0.2 * color.a;

            // 有机脉动：低频正弦调制
            float pulse = (sin(uTime * 1.5) + 1.0) * 0.5;
            color.g += pulse * uIntensity * 0.08 * color.a;

            // 轻微去饱和红蓝通道（使绿色更突出）
            color.r *= (1.0 - uIntensity * 0.1);
            color.b *= (1.0 - uIntensity * 0.15);

            gl_FragColor = color;
        }
    `;

    const filter = new PIXI.Filter(null, fragmentSrc, {
        uIntensity: intensity,
        uTime: 0.0,
    });

    return filter;
}

/**
 * 电弧闪烁滤镜（Electric Flicker）。
 * 高频亮度振荡 + 紫色偏移，模拟电弧放电。
 *
 * @param {object} [opts] 选项
 * @param {number} [opts.intensity=0.6] 效果强度 (0-1)
 * @returns {PIXI.Filter|null}
 */
export function createElectricFlickerFilter(opts = {}) {
    if (!_pixiReady()) return null;

    const intensity = opts.intensity !== undefined ? opts.intensity : 0.6;

    const fragmentSrc = `
        precision mediump float;

        varying vec2 vTextureCoord;
        uniform sampler2D uSampler;
        uniform float uIntensity;
        uniform float uTime;

        void main(void)
        {
            vec4 color = texture2D(uSampler, vTextureCoord);

            // 高频闪烁：多层正弦叠加产生不规则闪烁
            float flicker = sin(uTime * 15.0) * 0.5 + sin(uTime * 23.7) * 0.3 + sin(uTime * 7.3) * 0.2;
            flicker = max(0.0, flicker);

            // 亮度脉冲
            float brightness = 1.0 + flicker * uIntensity * 0.5;
            color.rgb *= brightness;

            // 紫色偏移（闪电特征色）
            color.r += flicker * uIntensity * 0.1 * color.a;
            color.b += flicker * uIntensity * 0.15 * color.a;

            gl_FragColor = color;
        }
    `;

    const filter = new PIXI.Filter(null, fragmentSrc, {
        uIntensity: intensity,
        uTime: 0.0,
    });

    return filter;
}
