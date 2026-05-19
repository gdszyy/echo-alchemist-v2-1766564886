/**
 * BackgroundLayer.js - 远景/中后景大气层（L0 + L1）
 *
 * 组成：
 *   1. SkyDome - 反法线球体，shader 程序化生成深空蓝→紫的"星云"
 *   2. 远处剪影 - 低多边形 box 阵列（z = -200），暗色无 emissive
 *   3. 体积光柱 - 4 根 additive 圆锥，慢转 + 上下浮动
 *   4. 环境粒子 - 150 颗 GPU points，缓慢上升，循环复位
 *
 * 所有元素都挂在 z < 0 的远景；后续 milestone 玩法面板会放在 z=0。
 */

import * as THREE from 'three';

// 暗黑炼金调色板（同 visual_redesign_3d_plan.md §1.3）
const COLOR_DEEP    = 0x0a0e1a;
const COLOR_MID     = 0x1a1f3a;
const COLOR_ACCENT  = 0x3b2160;
const SILHOUETTE_COL = 0x0d1320;
const CONE_COLORS   = [0x38bdf8, 0xa78bfa, 0x60a5fa, 0xf59e0b];
const PARTICLE_COL  = 0x60a5fa;

export class BackgroundLayer {
    /**
     * @param {THREE.Scene} scene
     */
    constructor(scene) {
        this.scene = scene;
        this.group = new THREE.Group();
        this.group.name = 'BackgroundLayer';
        scene.add(this.group);

        this._createSkyDome();
        this._createDistantSilhouettes();
        this._createVolumetricLights();
        this._createAmbientParticles();
    }

    // -------------------- 天幕 --------------------
    _createSkyDome() {
        const geometry = new THREE.SphereGeometry(450, 24, 16);
        const material = new THREE.ShaderMaterial({
            side: THREE.BackSide,
            depthWrite: false,
            uniforms: {
                uTime:        { value: 0 },
                uColorDeep:   { value: new THREE.Color(COLOR_DEEP) },
                uColorMid:    { value: new THREE.Color(COLOR_MID) },
                uColorAccent: { value: new THREE.Color(COLOR_ACCENT) },
            },
            vertexShader: /* glsl */`
                varying vec3 vDir;
                void main() {
                    vDir = normalize(position);
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                }
            `,
            fragmentShader: /* glsl */`
                precision mediump float;
                uniform vec3  uColorDeep;
                uniform vec3  uColorMid;
                uniform vec3  uColorAccent;
                uniform float uTime;
                varying vec3  vDir;

                // 廉价 hash 噪声（够用即可）
                float hash3(vec3 p) {
                    p = fract(p * 0.3183099 + vec3(0.1, 0.13, 0.17));
                    p *= 17.0;
                    return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
                }
                float noise3(vec3 p) {
                    vec3 i = floor(p);
                    vec3 f = fract(p);
                    f = f * f * (3.0 - 2.0 * f);
                    float n000 = hash3(i + vec3(0.0, 0.0, 0.0));
                    float n100 = hash3(i + vec3(1.0, 0.0, 0.0));
                    float n010 = hash3(i + vec3(0.0, 1.0, 0.0));
                    float n110 = hash3(i + vec3(1.0, 1.0, 0.0));
                    float n001 = hash3(i + vec3(0.0, 0.0, 1.0));
                    float n101 = hash3(i + vec3(1.0, 0.0, 1.0));
                    float n011 = hash3(i + vec3(0.0, 1.0, 1.0));
                    float n111 = hash3(i + vec3(1.0, 1.0, 1.0));
                    float nx00 = mix(n000, n100, f.x);
                    float nx10 = mix(n010, n110, f.x);
                    float nx01 = mix(n001, n101, f.x);
                    float nx11 = mix(n011, n111, f.x);
                    float nxy0 = mix(nx00, nx10, f.y);
                    float nxy1 = mix(nx01, nx11, f.y);
                    return mix(nxy0, nxy1, f.z);
                }

                void main() {
                    // 垂直渐变（深空 → 中蓝）
                    float t = clamp(0.5 + vDir.y * 0.5, 0.0, 1.0);
                    vec3 col = mix(uColorDeep, uColorMid, t);

                    // 星云斑块（低频噪声 + 时间漂移）
                    float n = noise3(vDir * 4.0 + vec3(uTime * 0.015, 0.0, uTime * 0.01));
                    col = mix(col, uColorAccent, smoothstep(0.55, 0.95, n) * 0.35);

                    // 微弱星点
                    float stars = step(0.985, hash3(floor(vDir * 200.0))) * 0.5;
                    col += vec3(stars);

                    gl_FragColor = vec4(col, 1.0);
                }
            `,
        });
        this.skyMaterial = material;
        const dome = new THREE.Mesh(geometry, material);
        dome.name = 'SkyDome';
        this.group.add(dome);
    }

    // -------------------- 远处剪影 --------------------
    _createDistantSilhouettes() {
        const silhouetteGroup = new THREE.Group();
        silhouetteGroup.name = 'DistantSilhouettes';
        const mat = new THREE.MeshBasicMaterial({
            color: SILHOUETTE_COL,
            depthWrite: false,
            fog: true,
        });

        // 确定性 PRNG，让剪影布局每次启动一致（便于风格 review）
        const rng = mulberry32(2024);
        const count = 14;
        // 共享几何减少 draw call（box 都用同一个 BufferGeometry，通过 scale 区分大小）
        const baseGeom = new THREE.BoxGeometry(1, 1, 1);
        for (let i = 0; i < count; i++) {
            const w = 6 + rng() * 18;
            const h = 30 + rng() * 80;
            const d = 6 + rng() * 12;
            const m = new THREE.Mesh(baseGeom, mat);
            m.scale.set(w, h, d);
            m.position.set(
                (rng() - 0.5) * 360,
                -40 - rng() * 40,
                -180 - rng() * 60
            );
            silhouetteGroup.add(m);
        }
        this.silhouetteGroup = silhouetteGroup;
        this.group.add(silhouetteGroup);
    }

    // -------------------- 体积光柱 --------------------
    _createVolumetricLights() {
        const lightGroup = new THREE.Group();
        lightGroup.name = 'VolumetricLights';
        // 单个圆锥几何复用（半径靠 scale 拉伸）
        const baseGeom = new THREE.ConeGeometry(1, 1, 18, 1, true);
        for (let i = 0; i < 4; i++) {
            const color = CONE_COLORS[i % CONE_COLORS.length];
            const mat = new THREE.MeshBasicMaterial({
                color,
                transparent: true,
                opacity: 0.06,
                blending: THREE.AdditiveBlending,
                depthWrite: false,
                side: THREE.DoubleSide,
                fog: false,
            });
            const cone = new THREE.Mesh(baseGeom, mat);
            const radius = 20 + i * 6;
            const height = 220 + i * 20;
            cone.scale.set(radius, height, radius);
            cone.position.set(
                -120 + i * 80,
                -40,
                -90 - i * 8
            );
            // 圆锥默认尖端朝 +Y；我们让光"自下而上洒"，所以翻转
            cone.rotation.z = Math.PI;
            cone.userData = { baseY: cone.position.y, phase: i * 1.7 };
            lightGroup.add(cone);
        }
        this.lightGroup = lightGroup;
        this.group.add(lightGroup);
    }

    // -------------------- 环境粒子 --------------------
    _createAmbientParticles() {
        const count = 150;
        const positions = new Float32Array(count * 3);
        const speeds = new Float32Array(count);
        for (let i = 0; i < count; i++) {
            positions[i * 3 + 0] = (Math.random() - 0.5) * 320;
            positions[i * 3 + 1] = -160 + Math.random() * 320;
            positions[i * 3 + 2] = -100 + Math.random() * 80;
            speeds[i] = 2 + Math.random() * 5;
        }
        const geom = new THREE.BufferGeometry();
        geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        const mat = new THREE.PointsMaterial({
            color: PARTICLE_COL,
            size: 1.6,
            sizeAttenuation: true,
            transparent: true,
            opacity: 0.35,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
            fog: true,
        });
        const points = new THREE.Points(geom, mat);
        points.name = 'AmbientParticles';
        this.ambientPoints = points;
        this._ambientSpeeds = speeds;
        this.group.add(points);
    }

    // -------------------- 帧更新 --------------------
    /**
     * @param {number} dt seconds (clamped)
     * @param {number} t  seconds elapsed total
     */
    update(dt, t) {
        if (this.skyMaterial) this.skyMaterial.uniforms.uTime.value = t;

        if (this.lightGroup) {
            const children = this.lightGroup.children;
            for (let i = 0; i < children.length; i++) {
                const cone = children[i];
                const ud = cone.userData;
                cone.position.y = ud.baseY + Math.sin(t * 0.4 + ud.phase) * 3;
                cone.rotation.y = t * 0.05 + ud.phase;
            }
        }

        if (this.ambientPoints) {
            const attr = this.ambientPoints.geometry.attributes.position;
            const arr = attr.array;
            const speeds = this._ambientSpeeds;
            const n = speeds.length;
            for (let i = 0; i < n; i++) {
                arr[i * 3 + 1] += speeds[i] * dt;
                if (arr[i * 3 + 1] > 160) {
                    arr[i * 3 + 1] = -160;
                    arr[i * 3 + 0] = (Math.random() - 0.5) * 320;
                }
            }
            attr.needsUpdate = true;
        }
    }

    dispose() {
        this.group.traverse(obj => {
            if (obj.geometry) obj.geometry.dispose();
            if (obj.material) {
                const m = obj.material;
                if (Array.isArray(m)) m.forEach(x => x.dispose());
                else m.dispose();
            }
        });
        if (this.scene) this.scene.remove(this.group);
    }
}

// 简易确定性 PRNG（mulberry32）—— 让远景剪影每次启动布局一致
function mulberry32(seed) {
    return function () {
        let t = seed += 0x6d2b79f5;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}
