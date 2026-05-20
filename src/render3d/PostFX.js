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
// 自定义 shader：桶形畸变 + 色散
// ===================================================================
const LENS_DISTORTION_SHADER = {
    name: 'LensDistortionShader',
    uniforms: {
        tDiffuse:    { value: null },
        uDistortion: { value: 0.06 },    // 桶形畸变强度
        uChromatic:  { value: 0.005 },   // RGB 色散
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
// 自定义 shader：边角暗角 + 胶片颗粒（合并一个 pass 省 framebuffer）
// ===================================================================
const VIGNETTE_GRAIN_SHADER = {
    name: 'VignetteGrainShader',
    uniforms: {
        tDiffuse:          { value: null },
        uTime:             { value: 0 },
        uVignetteOffset:   { value: 0.70 },   // 半径外开始变暗
        uVignetteDarkness: { value: 0.65 },   // 边角最深度
        uGrainAmount:      { value: 0.045 },  // 颗粒强度
        uResolution:       { value: new THREE.Vector2(1, 1) },
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
        varying vec2 vUv;

        float hash21(vec2 p) {
            p = fract(p * vec2(123.34, 456.21));
            p += dot(p, p + 45.32);
            return fract(p.x * p.y);
        }

        void main() {
            vec4 color = texture2D(tDiffuse, vUv);

            // Vignette：以画面中心为圆心，距离 > offset 后线性变暗
            vec2 c = vUv - 0.5;
            // 椭圆 vignette（考虑 9:16 纵向画面）
            c.x *= uResolution.x / max(uResolution.y, 1.0);
            float r = length(c) * 1.6;
            float vig = 1.0 - smoothstep(uVignetteOffset, uVignetteOffset + 0.45, r);
            // vig=1 表示中心保留原色，vig=0 表示边角全黑
            float vAmt = mix(1.0 - uVignetteDarkness, 1.0, vig);
            color.rgb *= vAmt;

            // Film grain：基于 uv * res + 时间扰动的伪随机噪点
            float grain = hash21(vUv * uResolution + uTime * 137.0) - 0.5;
            color.rgb += grain * uGrainAmount;

            gl_FragColor = vec4(color.rgb, 1.0);
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
        this.bloomPass = new UnrealBloomPass(
            new THREE.Vector2(this.width, this.height),
            0.70,   // strength
            0.45,   // radius
            0.55    // threshold（LDR 模式下需要较低阈值才能触发）
        );
        // HDR 时阈值可以高一些（emissive 自然 > 1）
        if (this.usingHDR) {
            this.bloomPass.threshold = 0.85;
            this.bloomPass.strength = 0.85;
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
        this.composer.render(dt);
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

    dispose() {
        try { this.composer.dispose(); } catch (e) {}
        try { if (this.bloomPass) this.bloomPass.dispose(); } catch (e) {}
    }
}
