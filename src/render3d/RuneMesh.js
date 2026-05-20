/**
 * RuneMesh.js - 符文的 3D 六边形几何（M5 配套）
 *
 * 与遗物卡片同期上线。每个符文 = 一片薄六边形 + 元素专属 shader。
 * 不再用 emoji icon。
 *
 * 当前支持的元素（与 src/rune_config.js RUNE_DB 对齐）：
 *   pyro / cryo / lightning / bounce / pierce / scatter / laser / wind / flying_sword
 */

import * as THREE from 'three';

const ELEMENT_COLORS = {
    pyro:         { core: 0xef4444, accent: 0xfb7185 },
    cryo:         { core: 0x60a5fa, accent: 0xa5f3fc },
    lightning:    { core: 0xfacc15, accent: 0xfde68a },
    bounce:       { core: 0xa3e635, accent: 0xbef264 },
    pierce:       { core: 0xf97316, accent: 0xfdba74 },
    scatter:      { core: 0xc084fc, accent: 0xddd6fe },
    laser:        { core: 0x34d399, accent: 0x6ee7b7 },
    wind:         { core: 0x14b8a6, accent: 0x5eead4 },
    flying_sword: { core: 0xfb923c, accent: 0xfed7aa },
    default:      { core: 0xa78bfa, accent: 0xc4b5fd },
};

let _hexGeom = null;
function getHexGeometry() {
    if (_hexGeom) return _hexGeom;
    // 六棱柱，俯视薄片：半径 1，高度 0.18（厚度）
    _hexGeom = new THREE.CylinderGeometry(1, 1, 0.18, 6, 1);
    return _hexGeom;
}

export class RuneMesh {
    /**
     * @param {string} element 'pyro' | 'cryo' | ... | 'default'
     * @param {number} [level=1]  符文等级（1..3）。等级越高边缘光越强
     */
    constructor(element, level = 1) {
        this.element = element;
        this.level = Math.max(1, Math.min(3, level | 0));
        const cols = ELEMENT_COLORS[element] || ELEMENT_COLORS.default;

        this.material = new THREE.ShaderMaterial({
            uniforms: {
                uTime:   { value: 0 },
                uCore:   { value: new THREE.Color(cols.core) },
                uAccent: { value: new THREE.Color(cols.accent) },
                uLevel:  { value: this.level },
            },
            vertexShader: /* glsl */`
                varying vec3 vNormal;
                varying vec3 vWorldPos;
                varying vec3 vViewPos;
                varying vec2 vUv;
                void main() {
                    vUv = uv;
                    vec4 mv = modelViewMatrix * vec4(position, 1.0);
                    vViewPos = mv.xyz;
                    vec4 wp = modelMatrix * vec4(position, 1.0);
                    vWorldPos = wp.xyz;
                    vNormal = normalize(normalMatrix * normal);
                    gl_Position = projectionMatrix * mv;
                }
            `,
            fragmentShader: this._buildFragShader(element),
        });

        this.mesh = new THREE.Mesh(getHexGeometry(), this.material);
        this.mesh.frustumCulled = false;
        this.mesh.userData = { runeElement: element, runeLevel: this.level };
    }

    /**
     * 每个元素一套独立纹饰（pyro 用噪声扭曲、cryo 用裂纹、雷用闪电分叉…）。
     * 所有 shader 共享相同的顶点+输入；差异在 fragment 主体的 motif 函数里。
     */
    _buildFragShader(element) {
        // 主体 fragment 模板（公共部分）
        const HEAD = /* glsl */`
            precision mediump float;
            uniform float uTime;
            uniform vec3  uCore;
            uniform vec3  uAccent;
            uniform float uLevel;
            varying vec3 vNormal;
            varying vec3 vWorldPos;
            varying vec3 vViewPos;
            varying vec2 vUv;

            float hash(vec2 p) {
                p = fract(p * vec2(123.34, 456.21));
                p += dot(p, p + 45.32);
                return fract(p.x * p.y);
            }
            float noise2(vec2 p) {
                vec2 i = floor(p);
                vec2 f = fract(p);
                f = f*f*(3.0-2.0*f);
                float a = hash(i);
                float b = hash(i + vec2(1.0, 0.0));
                float c = hash(i + vec2(0.0, 1.0));
                float d = hash(i + vec2(1.0, 1.0));
                return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
            }
        `;
        const TAIL = /* glsl */`
            vec3 col = uCore * 0.45 + motif * uAccent * 1.7;
            // 边缘 Fresnel
            vec3 V = normalize(-vViewPos);
            float fres = pow(1.0 - max(0.0, dot(normalize(vNormal), V)), 2.0);
            col += uAccent * fres * (0.7 + 0.3 * uLevel);
            gl_FragColor = vec4(col, 1.0);
        `;

        let motifCode;
        switch (element) {
            case 'pyro':
                motifCode = `
                    float n = noise2(vUv * 6.0 + vec2(uTime * 1.4, uTime * 0.6));
                    motif = smoothstep(0.45, 0.85, n);
                    // 向上流动
                    float rise = smoothstep(0.0, 1.0, vUv.y - uTime * 0.4);
                    motif *= 0.6 + rise * 0.6;
                `;
                break;
            case 'cryo':
                motifCode = `
                    // 裂纹：abs(2*uv-1) 距离 + 噪声扰动
                    vec2 c = vUv - 0.5;
                    float angle = atan(c.y, c.x);
                    float lines = abs(sin(angle * 4.0 + noise2(vUv*4.0)*2.0));
                    motif = 1.0 - smoothstep(0.15, 0.35, lines * (0.4 + length(c) * 1.6));
                    motif += step(0.96, noise2(vUv * 22.0 + uTime * 0.05)) * 0.5;
                `;
                break;
            case 'lightning':
                motifCode = `
                    // 之字形闪电：基于 y 的高频锯齿 + 噪声扰动
                    float zig = abs(fract(vUv.y * 8.0 + noise2(vec2(vUv.y * 10.0, uTime * 1.5)) * 0.5) - 0.5);
                    motif = 1.0 - smoothstep(0.05, 0.10, zig);
                    motif *= smoothstep(0.85, 0.5, abs(vUv.x - 0.5) * 2.0);
                    motif += step(0.97, hash(vec2(floor(uTime * 8.0), 0.0))) * 0.3;
                `;
                break;
            case 'bounce':
                motifCode = `
                    // 同心环波（弹性涟漪）
                    float r = length(vUv - 0.5) * 2.0;
                    motif = sin(r * 12.0 - uTime * 4.0) * 0.5 + 0.5;
                    motif = pow(motif, 2.5);
                `;
                break;
            case 'pierce':
                motifCode = `
                    // 箭头流线（沿 y 向上 + 中央集中）
                    float band = abs(fract(vUv.y * 6.0 - uTime * 1.2) - 0.5);
                    motif = smoothstep(0.4, 0.1, band);
                    motif *= smoothstep(0.6, 0.0, abs(vUv.x - 0.5));
                `;
                break;
            case 'scatter':
                motifCode = `
                    // 三方分裂线
                    vec2 c = vUv - 0.5;
                    float ang = atan(c.y, c.x);
                    float spokes = abs(cos(ang * 1.5));
                    motif = smoothstep(0.85, 1.0, spokes);
                    motif *= smoothstep(0.5, 0.0, length(c));
                `;
                break;
            case 'laser':
                motifCode = `
                    // 一条强光束
                    float beam = smoothstep(0.08, 0.0, abs(vUv.x - 0.5));
                    motif = beam;
                    motif += step(0.5, fract(vUv.y * 2.0 + uTime * 0.3)) * 0.05;
                `;
                break;
            case 'wind':
                motifCode = `
                    // 旋风：螺旋
                    vec2 c = vUv - 0.5;
                    float ang = atan(c.y, c.x) + length(c) * 6.0 - uTime * 1.4;
                    motif = sin(ang * 3.0) * 0.5 + 0.5;
                    motif = pow(motif, 3.0);
                    motif *= smoothstep(0.5, 0.0, length(c));
                `;
                break;
            case 'flying_sword':
                motifCode = `
                    // 刀光：对角斜线 + 噪声尖锐
                    float diag = abs(vUv.x - vUv.y - sin(uTime * 0.6) * 0.05);
                    motif = 1.0 - smoothstep(0.05, 0.12, diag);
                    motif *= 0.7 + 0.3 * noise2(vUv * 8.0 + uTime);
                `;
                break;
            default:
                motifCode = `
                    motif = noise2(vUv * 5.0 + uTime * 0.4);
                `;
                break;
        }

        return HEAD + `
            void main() {
                float motif = 0.0;
                ${motifCode}
                ${TAIL}
            }
        `;
    }

    /** 每帧 update */
    update(t) {
        this.material.uniforms.uTime.value = t;
    }

    dispose() {
        this.material.dispose();
        // 共享 _hexGeom 不在这 dispose
    }
}
