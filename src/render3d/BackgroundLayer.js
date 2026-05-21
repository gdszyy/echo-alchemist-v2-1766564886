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
const COLOR_MID     = 0x1c2348;     // 略提亮中间色，避免大面积死黑
const COLOR_ACCENT  = 0x5b2d8a;     // 紫调更饱满，星云有存在感
const COLOR_FORGE   = 0x6b2418;     // 底部"炼金炉"暖红光（焦点引导）
const SILHOUETTE_COL = 0x161d33;    // 略提亮，让远处剪影从天幕中"浮"出来
const CONE_COLORS   = [0x38bdf8, 0xa78bfa, 0x60a5fa, 0xf59e0b, 0xec4899, 0x22d3ee];
const PARTICLE_COL  = 0x93c5fd;     // 提亮粒子色

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
        this._createAlchemyStage();
    }

    // -------------------- 炼金台基（底部锚定焦点） --------------------
    _createAlchemyStage() {
        // 一道环形发光环，定位在屏幕下方"地平线"位置，象征"炼金引擎舞台"。
        // M3+ 加入发射器实体后，这环会与发射器同心，强化"舞台中心"概念。
        const stageGroup = new THREE.Group();
        stageGroup.name = 'AlchemyStage';

        // 主环：薄圆环，emissive 橙金。半径按 z=-10 处视域宽度（约 ±28）校准。
        const ringGeom = new THREE.RingGeometry(34, 38, 64, 1);
        const ringMat = new THREE.ShaderMaterial({
            transparent: true,
            depthWrite: false,
            blending: THREE.AdditiveBlending,
            side: THREE.DoubleSide,
            uniforms: {
                uTime: { value: 0 },
                uColor: { value: new THREE.Color(0xfb923c) },
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
                uniform float uTime;
                uniform vec3 uColor;
                varying vec2 vUv;
                void main() {
                    // uv.x 在环周方向，uv.y 在环宽方向；让中心更亮、两侧衰减
                    float radial = 1.0 - abs(vUv.y - 0.5) * 2.0;
                    radial = pow(radial, 1.5);
                    // 沿环周的流光（4 段亮纹环绕）
                    float flow = 0.5 + 0.5 * sin(vUv.x * 12.566 + uTime * 1.8);
                    flow = pow(flow, 4.0);
                    float alpha = radial * (0.4 + flow * 0.6);
                    gl_FragColor = vec4(uColor * (0.6 + flow * 1.2), alpha);
                }
            `,
        });
        const ring = new THREE.Mesh(ringGeom, ringMat);
        // 平躺在地面上，y 位置略低于相机看向的中心
        // 平躺在地面上；y 位置紧靠视域下边缘，z 略推后避开后续玩法面板（z=0）
        ring.rotation.x = -Math.PI / 2;
        ring.position.set(0, -38, -10);
        stageGroup.add(ring);
        this.ringMaterial = ringMat;

        // 二级辉光（内圈，更小、更亮）
        // [视觉调优] opacity 0.25→0.55，让炼金台环更"金"，作为视觉锚点。
        const innerRingGeom = new THREE.RingGeometry(26, 30, 48, 1);
        const innerRingMat = new THREE.MeshBasicMaterial({
            color: 0xfde68a,
            transparent: true,
            opacity: 0.55,
            depthWrite: false,
            blending: THREE.AdditiveBlending,
            side: THREE.DoubleSide,
        });
        const innerRing = new THREE.Mesh(innerRingGeom, innerRingMat);
        innerRing.rotation.x = -Math.PI / 2;
        innerRing.position.set(0, -37.5, -10);
        stageGroup.add(innerRing);

        this.stageGroup = stageGroup;
        this.group.add(stageGroup);
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
                uColorForge:  { value: new THREE.Color(COLOR_FORGE) },
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
                uniform vec3  uColorForge;
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
                    // 垂直渐变（深空 → 中蓝），曲线 pow 让中段更浓
                    float ty = clamp(0.5 + vDir.y * 0.5, 0.0, 1.0);
                    float t = pow(ty, 0.7);
                    vec3 col = mix(uColorDeep, uColorMid, t);

                    // 星云斑块：两层 octave 叠加，幅度更大
                    float n1 = noise3(vDir * 3.0  + vec3(uTime * 0.012, 0.0, uTime * 0.008));
                    float n2 = noise3(vDir * 8.0  + vec3(0.0, uTime * 0.020, 0.0));
                    float neb = n1 * 0.75 + n2 * 0.25;
                    col = mix(col, uColorAccent, smoothstep(0.40, 0.85, neb) * 0.65);

                    // 底部炼金炉膛暖光：仰角 < 0 时增强（焦点向下引导）
                    // GLSL smoothstep 要求 edge0 < edge1；反方向需用 1 - smoothstep。
                    float forgeMask = 1.0 - smoothstep(-0.55, 0.05, vDir.y);
                    // 中央集束 + 横向衰减
                    float forgeCenter = pow(max(0.0, 1.0 - abs(vDir.x) * 1.2), 2.0);
                    col += uColorForge * forgeMask * forgeCenter * 2.2;
                    // 炉口高光（中心更亮一圈橙金）+ 缓慢搏动
                    float pulse = 0.85 + 0.15 * sin(uTime * 0.9);
                    col += vec3(0.95, 0.55, 0.20) * forgeMask * pow(forgeCenter, 3.5) * 1.1 * pulse;

                    // 顶部高空蓝紫提亮
                    col += vec3(0.04, 0.06, 0.18) * smoothstep(0.3, 0.95, vDir.y);

                    // 星点（两档密度 + 闪烁）
                    float starRand = hash3(floor(vDir * 220.0));
                    float bright = step(0.992, starRand);
                    float dim    = step(0.975, starRand) * step(starRand, 0.992);
                    float twinkle = 0.7 + 0.3 * sin(uTime * 3.0 + starRand * 30.0);
                    col += vec3(bright * 1.0 * twinkle + dim * 0.35);

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

        // 6 根光柱全部置于远景（z < -180），靠两侧分布避开中央玩法区。
        // 不放中心柱——中心由 skydome 的炉膛暖光承担焦点引导。
        // [视觉调优] 用户反馈"3D 太透明太暗"——光柱整体不透明度上调 ~2.5×，
        // 让左右两侧的青/紫/橙/粉色帷幕真的"打进"画面，作为色板主光源。
        const config = [
            // x,    y,    z,     radius, height, colorIdx, opacity
            [-160,  -30,  -210,   28,     300,    0, 0.32], // 远景左主光（青）
            [ 160,  -30,  -210,   28,     300,    1, 0.32], // 远景右主光（紫）
            [-230,  -40,  -260,   20,     260,    2, 0.22], // 更远的左侧蓝
            [ 230,  -40,  -260,   20,     260,    3, 0.22], // 更远的右侧橙
            [-100,  -60,  -270,   16,     240,    4, 0.18], // 中左副柱（粉）
            [ 100,  -60,  -270,   16,     240,    4, 0.18], // 中右副柱（粉）
        ];

        for (let i = 0; i < config.length; i++) {
            const [px, py, pz, radius, height, ci, op] = config[i];
            const color = CONE_COLORS[ci % CONE_COLORS.length];
            const mat = new THREE.MeshBasicMaterial({
                color,
                transparent: true,
                opacity: op,
                blending: THREE.AdditiveBlending,
                depthWrite: false,
                side: THREE.DoubleSide,
                fog: false,
            });
            const cone = new THREE.Mesh(baseGeom, mat);
            cone.scale.set(radius, height, radius);
            cone.position.set(px, py, pz);
            // 圆锥默认尖端朝 +Y；让光"自下而上洒"，翻转
            cone.rotation.z = Math.PI;
            cone.userData = { baseY: cone.position.y, phase: i * 1.13, baseOpacity: op };
            lightGroup.add(cone);
        }
        this.lightGroup = lightGroup;
        this.group.add(lightGroup);
    }

    // -------------------- 环境粒子 --------------------
    _createAmbientParticles() {
        // 双层粒子：近层（大、慢、亮）+ 远层（小、快、暗）共同营造深度
        this.ambientPoints = [];
        this._ambientSpeeds = [];

        // [视觉调优] 近层粒子 opacity 0.75→0.95（更鲜亮），远层 0.45→0.65（提示层级感）。
        const layers = [
            { count: 180, sizeRange: [2.4, 4.2], color: PARTICLE_COL, opacity: 0.95, zRange: [-60, -10],  speedRange: [3, 8],   xRange: 320 },
            { count: 200, sizeRange: [1.0, 2.0], color: 0xa78bfa,     opacity: 0.65, zRange: [-150, -80], speedRange: [1, 4],   xRange: 360 },
        ];

        for (const layer of layers) {
            const count = layer.count;
            const positions = new Float32Array(count * 3);
            const speeds = new Float32Array(count);
            const sizes = new Float32Array(count);
            for (let i = 0; i < count; i++) {
                positions[i * 3 + 0] = (Math.random() - 0.5) * layer.xRange;
                positions[i * 3 + 1] = -180 + Math.random() * 360;
                positions[i * 3 + 2] = layer.zRange[0] + Math.random() * (layer.zRange[1] - layer.zRange[0]);
                speeds[i] = layer.speedRange[0] + Math.random() * (layer.speedRange[1] - layer.speedRange[0]);
                sizes[i] = layer.sizeRange[0] + Math.random() * (layer.sizeRange[1] - layer.sizeRange[0]);
            }
            const geom = new THREE.BufferGeometry();
            geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
            const mat = new THREE.PointsMaterial({
                color: layer.color,
                size: (layer.sizeRange[0] + layer.sizeRange[1]) * 0.5, // 平均尺寸；细粒度由 size attribute 自定义着色器才能用
                sizeAttenuation: true,
                transparent: true,
                opacity: layer.opacity,
                blending: THREE.AdditiveBlending,
                depthWrite: false,
                fog: true,
            });
            const points = new THREE.Points(geom, mat);
            points.name = 'AmbientParticles_' + layer.count;
            this.ambientPoints.push(points);
            this._ambientSpeeds.push(speeds);
            this.group.add(points);
        }
    }

    // -------------------- 帧更新 --------------------
    /**
     * @param {number} dt seconds (clamped)
     * @param {number} t  seconds elapsed total
     */
    update(dt, t) {
        if (this.skyMaterial) this.skyMaterial.uniforms.uTime.value = t;
        if (this.ringMaterial) this.ringMaterial.uniforms.uTime.value = t;
        if (this.stageGroup) {
            // 内外环缓慢反向旋转，制造"机械感"
            this.stageGroup.children[0].rotation.z = t * 0.15;
            this.stageGroup.children[1].rotation.z = -t * 0.22;
        }

        if (this.lightGroup) {
            const children = this.lightGroup.children;
            for (let i = 0; i < children.length; i++) {
                const cone = children[i];
                const ud = cone.userData;
                cone.position.y = ud.baseY + Math.sin(t * 0.4 + ud.phase) * 3;
                cone.rotation.y = t * 0.05 + ud.phase;
                // 呼吸式透明度（基准 ±20%）
                const breath = 0.85 + 0.15 * Math.sin(t * 0.6 + ud.phase * 0.7);
                cone.material.opacity = ud.baseOpacity * breath;
            }
        }

        if (this.ambientPoints && this.ambientPoints.length) {
            for (let li = 0; li < this.ambientPoints.length; li++) {
                const pts = this.ambientPoints[li];
                const attr = pts.geometry.attributes.position;
                const arr = attr.array;
                const speeds = this._ambientSpeeds[li];
                const n = speeds.length;
                for (let i = 0; i < n; i++) {
                    arr[i * 3 + 1] += speeds[i] * dt;
                    if (arr[i * 3 + 1] > 180) {
                        arr[i * 3 + 1] = -180;
                        arr[i * 3 + 0] = (Math.random() - 0.5) * 320;
                    }
                }
                attr.needsUpdate = true;
            }
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
