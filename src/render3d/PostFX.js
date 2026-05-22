/**
 * PostFX.js - 后处理管线（M4 核心）
 *
 * 链路（从最早到最晚）：
 *   1. RenderPass        把 scene/camera 渲染到第一个 framebuffer
 *   2. UnrealBloomPass   提取 HDR 高光做模糊 + additive（emissive 自然辉光）
 *   3. LensDistortionPass 桶形畸变 + RGB 色散（电影感焦点感）
 *   4. VignetteGrainPass 边角暗角 + 胶片颗粒（沉浸感氛围）
 *   5. FXAAPass          廉价抗锯齿
 *   6. OutputPass        ACES Filmic 色调映射 + sRGB 输出
 *
 * HDR：WebGL2 设备启用 HalfFloatType 帧缓冲，让 emissive > 1.0 触发 bloom；
 *      WebGL1 / 不支持时回退到 UnsignedByteType（bloom 仍工作但不"炸"）。
 *
 * 任何 import / 构造失败都让 Renderer3D 走 try/catch 兜底，不破坏游戏可玩性。
 */

import * as THREE from 'three';
import { EffectComposer }    from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass }        from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass }   from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass }        from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass }        from 'three/addons/postprocessing/OutputPass.js';
import { FXAAShader }        from 'three/addons/shaders/FXAAShader.js';

// ===================================================================
// [M4 阶段感知] Color Grading 预设
// 每个阶段一套调色板。Renderer3D 在 phase:change / boss:* 事件触发时
// 调 postfx.setGradingPreset(name)；PostFX 内部 1 秒 lerp 到目标。
//
// 设计思路：
//   meta       静谧蓝调，低饱和。主菜单/选择面板，给"等待感"
//   gathering  柔和青蓝，中等饱和。研磨阶段，玩家专注于钉板
//   combat     teal-and-orange（当前默认），暖橙高光 + 冷蓝阴影
//   boss       深红 + 高饱和，整体压重，营造紧迫
//   gameover   去饱和接近黑白，结束氛围
// ===================================================================
// [Promare v2 — F7] 反"暗黑炼金"路线：Promare 不靠后期，靠饱和 + 硬边 + 12fps stutter。
// 历史调优把 bloom 0.85 / chromatic 0.005 / vignette 0.18-0.50 / grading 0.15-0.22 都拉得很满，
// 结果是粒子被 bloom 糊成光雾、色差让颜色边缘抖、vignette 把深紫底拖向黑、grading 把粉/青拉灰。
// 本次：
//   - bloom 减半（baseline 0.55 / HDR 0.65）+ threshold 抬高，让 bloom 只挑真高光
//   - chromatic / distortion 全关（电影里这两个滤镜几乎不出现，是 Promare 反例）
//   - vignetteDarkness 各预设清零或几乎清零（不再吃边角，深紫底全屏铺）
//   - gradingStrength 减半（保留阶段情绪 split-tone，但不拉灰原色）
const GRADING_PRESETS = {
    meta: {
        saturation:       1.30,
        shadowR: 0.04, shadowG: 0.08, shadowB: 0.18,
        highlightR: 0.10, highlightG: 0.10, highlightB: 0.18,
        gradingStrength:  0.09,
        vignetteDarkness: 0.0,
        vignetteOffset:   0.78,
    },
    gathering: {
        saturation:       1.35,
        shadowR: 0.02, shadowG: 0.06, shadowB: 0.14,
        highlightR: 0.12, highlightG: 0.14, highlightB: 0.10,
        gradingStrength:  0.08,
        vignetteDarkness: 0.0,
        vignetteOffset:   0.82,
    },
    combat: {
        saturation:       1.40,
        shadowR: 0.03, shadowG: 0.05, shadowB: 0.12,
        highlightR: 0.16, highlightG: 0.10, highlightB: 0.04,
        gradingStrength:  0.08,
        vignetteDarkness: 0.0,
        vignetteOffset:   0.80,
    },
    boss: {
        saturation:       1.50,
        shadowR: 0.14, shadowG: 0.03, shadowB: 0.05,
        highlightR: 0.22, highlightG: 0.08, highlightB: 0.02,
        gradingStrength:  0.11,
        vignetteDarkness: 0.06,  // Boss 阶段保留极轻边角收口营造紧迫
        vignetteOffset:   0.72,
    },
    gameover: {
        saturation:       0.45,
        shadowR: 0.05, shadowG: 0.05, shadowB: 0.10,
        highlightR: 0.10, highlightG: 0.10, highlightB: 0.10,
        gradingStrength:  0.30,
        vignetteDarkness: 0.30,  // 结束氛围保留 vignette 帮助叙事
        vignetteOffset:   0.55,
    },
};

// 预设 lerp 速率（per second）—— 1.0 = 1 秒走到目标
const GRADING_LERP_RATE = 1.6;

// ===================================================================
// 自定义 shader：桶形畸变 + 色散
// ===================================================================
const LENS_DISTORTION_SHADER = {
    name: 'LensDistortionShader',
    uniforms: {
        tDiffuse:    { value: null },
        // [Promare v2 F7] 桶形畸变 + RGB 色散全部关到 0 ——
        // 电影几乎不用这两个滤镜；桶形是"模拟变形镜头"，色散是"模拟廉价镜头"，
        // 都是 cinematography 语言，与 Promare 的"平涂硬切"取向相反。
        uDistortion: { value: 0.0 },
        uChromatic:  { value: 0.0 },
        uVignettePower: { value: 0.0 },  // 不在这里做 vignette
    },
    vertexShader: /* glsl */`
        varying vec2 vUv;
        void main() {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
    `,
    fragmentShader: /* glsl */`
        precision mediump float;
        uniform sampler2D tDiffuse;
        uniform float uDistortion;
        uniform float uChromatic;
        varying vec2 vUv;

        vec2 barrel(vec2 uv, float k) {
            vec2 c = uv - 0.5;
            float r2 = dot(c, c);
            return uv + c * k * r2;
        }

        void main() {
            // 三色通道分别按略不同的畸变量采样，模拟色散
            vec2 uvR = barrel(vUv, uDistortion + uChromatic);
            vec2 uvG = barrel(vUv, uDistortion);
            vec2 uvB = barrel(vUv, uDistortion - uChromatic);

            float r = texture2D(tDiffuse, uvR).r;
            float g = texture2D(tDiffuse, uvG).g;
            float b = texture2D(tDiffuse, uvB).b;

            // 畸变后 uv 出界时回退黑色（避免边缘拉伸）
            vec2 q = abs(uvG - 0.5) * 2.0;
            float inFrame = step(max(q.x, q.y), 1.0);

            gl_FragColor = vec4(vec3(r, g, b) * inFrame, 1.0);
        }
    `,
};

// ===================================================================
// 自定义 shader：边角暗角 + 胶片颗粒 + Cinematic Color Grading
// 一个 pass 完成三件事，省 framebuffer。
// ===================================================================
const VIGNETTE_GRAIN_SHADER = {
    name: 'VignetteGrainShader',
    uniforms: {
        tDiffuse:          { value: null },
        uTime:             { value: 0 },
        // [Promare v2 F7] vignette / grain baseline 全清零；grading 减半。
        // setGradingPreset() 会立刻把这些 lerp 到 GRADING_PRESETS 里对应阶段值。
        uVignetteOffset:   { value: 0.80 },
        uVignetteDarkness: { value: 0.0 },   // 旧 0.20 → 0（让深紫底铺满屏）
        uGrainAmount:      { value: 0.0 },   // 旧 0.018 → 0（颗粒污染平涂色块）
        uResolution:       { value: new THREE.Vector2(1, 1) },
        // [M4 调优] Color grading 参数
        uSaturation:       { value: 1.40 },   // 全局饱和度（1.0=原色）
        uShadowTint:       { value: new THREE.Color(0.03, 0.05, 0.12) }, // 冷蓝阴影（更轻）
        uHighlightTint:    { value: new THREE.Color(0.16, 0.10, 0.04) }, // 暖橙高光（更轻）
        uGradingStrength:  { value: 0.08 },   // 旧 0.16 → 0.08（保留情绪 split-tone，但不拉灰）
        // [M4] 暴击/大伤害瞬时白闪强度（0..1），由 CameraController 每帧推送，自然衰减
        uFlash:            { value: 0.0 },
        uFlashColor:       { value: new THREE.Color(1.0, 0.98, 0.92) }, // 略偏暖白
    },
    vertexShader: /* glsl */`
        varying vec2 vUv;
        void main() {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
    `,
    fragmentShader: /* glsl */`
        precision mediump float;
        uniform sampler2D tDiffuse;
        uniform float uTime;
        uniform float uVignetteOffset;
        uniform float uVignetteDarkness;
        uniform float uGrainAmount;
        uniform vec2  uResolution;
        uniform float uSaturation;
        uniform vec3  uShadowTint;
        uniform vec3  uHighlightTint;
        uniform float uGradingStrength;
        uniform float uFlash;
        uniform vec3  uFlashColor;
        varying vec2 vUv;

        float hash21(vec2 p) {
            p = fract(p * vec2(123.34, 456.21));
            p += dot(p, p + 45.32);
            return fract(p.x * p.y);
        }

        // Rec.709 luma
        float luma(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }

        void main() {
            vec4 color = texture2D(tDiffuse, vUv);
            vec3 col = color.rgb;

            // === [M4] Cinematic Color Grading ===
            // 1) 饱和度
            float L = luma(col);
            col = mix(vec3(L), col, uSaturation);
            // 2) Split-tone：阴影 → cool blue，高光 → warm amber
            //    用 luma 做 mask；shadowMask 在暗处大，highlightMask 在亮处大
            float shadowMask    = 1.0 - smoothstep(0.0, 0.55, L);
            float highlightMask = smoothstep(0.45, 1.0, L);
            col += uShadowTint    * shadowMask    * uGradingStrength;
            col += uHighlightTint * highlightMask * uGradingStrength;
            // 3) 微微抬黑（避免阴影完全死）
            col = mix(col, col * 0.92 + vec3(0.015), 0.5);

            // === Vignette：以画面中心为圆心，距离 > offset 后线性变暗 ===
            vec2 c = vUv - 0.5;
            c.x *= uResolution.x / max(uResolution.y, 1.0);   // 椭圆校准
            float r = length(c) * 1.6;
            float vig = 1.0 - smoothstep(uVignetteOffset, uVignetteOffset + 0.45, r);
            float vAmt = mix(1.0 - uVignetteDarkness, 1.0, vig);
            col *= vAmt;

            // === Film grain ===
            float grain = hash21(vUv * uResolution + uTime * 137.0) - 0.5;
            col += grain * uGrainAmount;

            // === [M4] Critical flash overlay ===
            // uFlash 由 CameraController 在大伤害/暴击事件时拉高到 0.3-0.6，每帧衰减回 0。
            // 用 mix 而非 add，避免完全过曝吃掉颜色信息；中心稍弱，边缘稍强（vignette-aware）。
            if (uFlash > 0.001) {
                float flashAmt = uFlash * (0.75 + (1.0 - vig) * 0.25);
                col = mix(col, uFlashColor, clamp(flashAmt, 0.0, 1.0));
            }

            gl_FragColor = vec4(col, 1.0);
        }
    `,
};

// ===================================================================
// PostFX 主类
// ===================================================================
export class PostFX {
    /**
     * @param {THREE.WebGLRenderer} renderer
     * @param {THREE.Scene}         scene
     * @param {THREE.Camera}        camera
     * @param {number}              width
     * @param {number}              height
     * @param {Object}              [opts]
     * @param {boolean}             [opts.hdr=true]     启用 HalfFloat 帧缓冲（WebGL2 支持）
     * @param {number}              [opts.pixelRatio]   composer 内部分辨率
     */
    constructor(renderer, scene, camera, width, height, opts = {}) {
        this.renderer = renderer;
        this.width = Math.max(1, width | 0);
        this.height = Math.max(1, height | 0);

        // 决定 HDR：WebGL2 可用 HalfFloatType；WebGL1 回退
        const wantHDR = opts.hdr !== false;
        const isWebGL2 = !!(renderer && renderer.capabilities && renderer.capabilities.isWebGL2);
        const type = (wantHDR && isWebGL2) ? THREE.HalfFloatType : THREE.UnsignedByteType;
        this.usingHDR = type === THREE.HalfFloatType;

        // Tonemapping 在 OutputPass 末端处理（OutputPass 使用 renderer.toneMapping）
        // 启用 ACES Filmic 让 HDR 高光自然 roll-off
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        renderer.toneMappingExposure = 1.0;

        const rt = new THREE.WebGLRenderTarget(this.width, this.height, {
            type,
            format: THREE.RGBAFormat,
            depthBuffer: true,
            stencilBuffer: false,
        });
        this.composer = new EffectComposer(renderer, rt);
        // composer 默认 setPixelRatio 跟随 renderer
        this.composer.setPixelRatio(renderer.getPixelRatio());

        // --- Pass 1: render the scene ---
        this.renderPass = new RenderPass(scene, camera);
        this.composer.addPass(this.renderPass);

        // --- Pass 2: bloom ---
        // [Promare v2 F7] Bloom 大幅收紧 ——
        // Promare 不靠 bloom 营造亮度，靠"饱和原色 + 硬切色块"。原版 strength 0.78-1.20 让所有
        // 中等亮度区域都参与发光 → 粒子糊成光雾、丢失硬边。
        // 新值：strength 半截以下 + threshold 抬到 0.78（LDR）/ 0.90（HDR），只让真正过曝的
        // 点（白核 / 闪光帧）触发 bloom，正常色块保持硬边。
        this.bloomPass = new UnrealBloomPass(
            new THREE.Vector2(this.width, this.height),
            0.35,    // strength：旧 1.05 → 0.35
            0.45,    // radius：旧 0.55 → 0.45（更聚焦）
            0.78     // threshold：旧 0.42 → 0.78
        );
        if (this.usingHDR) {
            this.bloomPass.threshold = 0.90;
            this.bloomPass.strength = 0.45;
            this.bloomPass.radius = 0.50;
        }
        this.composer.addPass(this.bloomPass);

        // --- Pass 3: lens distortion + chromatic aberration ---
        this.lensPass = new ShaderPass(LENS_DISTORTION_SHADER);
        this.composer.addPass(this.lensPass);

        // --- Pass 4: vignette + film grain ---
        this.vignettePass = new ShaderPass(VIGNETTE_GRAIN_SHADER);
        this.vignettePass.uniforms.uResolution.value.set(this.width, this.height);
        this.composer.addPass(this.vignettePass);

        // --- Pass 5: FXAA antialiasing ---
        this.fxaaPass = new ShaderPass(FXAAShader);
        this.fxaaPass.uniforms.resolution.value.set(1 / this.width, 1 / this.height);
        this.composer.addPass(this.fxaaPass);

        // --- Pass 6: output (ACES Filmic + sRGB conversion) ---
        this.outputPass = new OutputPass();
        this.composer.addPass(this.outputPass);

        this._time = 0;

        // [M4 阶段感知 grading] 当前 + 目标的 grading state
        // 平滑 lerp 让阶段切换时画面缓慢呼吸，不闪。
        this._grading = this._cloneGradingFromUniforms();
        this._gradingTarget = this._cloneGradingFromUniforms();
        // 当前阶段名（仅供 debug 读取）
        this._currentGradingPreset = 'combat';
    }

    /** 从 vignettePass uniforms 拷一份当前 grading 数值 */
    _cloneGradingFromUniforms() {
        const u = this.vignettePass.uniforms;
        return {
            saturation:       u.uSaturation.value,
            shadowR:          u.uShadowTint.value.r,
            shadowG:          u.uShadowTint.value.g,
            shadowB:          u.uShadowTint.value.b,
            highlightR:       u.uHighlightTint.value.r,
            highlightG:       u.uHighlightTint.value.g,
            highlightB:       u.uHighlightTint.value.b,
            gradingStrength:  u.uGradingStrength.value,
            vignetteDarkness: u.uVignetteDarkness.value,
            vignetteOffset:   u.uVignetteOffset.value,
        };
    }

    /**
     * [M4 阶段感知] 切换 grading 预设。Renderer3D 监听 eventBus 调用此方法。
     * 预设之间用 1 秒线性 lerp，避免突跳。
     * @param {string} name 'meta'|'gathering'|'combat'|'boss'|'gameover'
     */
    setGradingPreset(name) {
        const preset = GRADING_PRESETS[name];
        if (!preset) return;
        this._currentGradingPreset = name;
        Object.assign(this._gradingTarget, preset);
    }

    resize(width, height) {
        const W = Math.max(1, width | 0);
        const H = Math.max(1, height | 0);
        if (W === this.width && H === this.height) return;
        this.width = W;
        this.height = H;
        this.composer.setSize(W, H);
        if (this.bloomPass && this.bloomPass.setSize) this.bloomPass.setSize(W, H);
        this.vignettePass.uniforms.uResolution.value.set(W, H);
        this.fxaaPass.uniforms.resolution.value.set(1 / W, 1 / H);
    }

    /**
     * @param {number} dt seconds
     */
    render(dt) {
        this._time += dt;
        this.vignettePass.uniforms.uTime.value = this._time;
        // [M4 阶段感知] 平滑 lerp 到目标 grading
        this._tickGrading(Math.min(0.1, dt));
        this.composer.render(dt);
    }

    /** 每帧推进 grading 当前值 → 目标值 */
    _tickGrading(dt) {
        const cur = this._grading;
        const tgt = this._gradingTarget;
        const alpha = Math.min(1, dt * GRADING_LERP_RATE);
        let changed = false;
        for (const k of Object.keys(cur)) {
            const before = cur[k];
            const after  = before + (tgt[k] - before) * alpha;
            if (Math.abs(after - before) > 1e-5) {
                cur[k] = after;
                changed = true;
            }
        }
        if (!changed) return;
        const u = this.vignettePass.uniforms;
        u.uSaturation.value       = cur.saturation;
        u.uShadowTint.value.setRGB(cur.shadowR, cur.shadowG, cur.shadowB);
        u.uHighlightTint.value.setRGB(cur.highlightR, cur.highlightG, cur.highlightB);
        u.uGradingStrength.value  = cur.gradingStrength;
        u.uVignetteDarkness.value = cur.vignetteDarkness;
        u.uVignetteOffset.value   = cur.vignetteOffset;
    }

    /** 调节畸变强度（M4.5 / 动态镜头会用：受击高、平时低） */
    setDistortion(distortion, chromatic) {
        if (distortion !== undefined) this.lensPass.uniforms.uDistortion.value = distortion;
        if (chromatic !== undefined)  this.lensPass.uniforms.uChromatic.value  = chromatic;
    }

    /** 调节 bloom 强度（剧烈事件时短暂拉高） */
    setBloomStrength(s) {
        this.bloomPass.strength = s;
    }

    /** [M4] 设置全屏白闪强度 0..1（每帧由 CameraController 推送 + 自然衰减） */
    setFlash(amt) {
        this.vignettePass.uniforms.uFlash.value = Math.max(0, Math.min(1, amt));
    }

    dispose() {
        try { this.composer.dispose(); } catch (e) {}
        try { if (this.bloomPass) this.bloomPass.dispose(); } catch (e) {}
    }
}
