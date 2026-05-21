/**
 * GPUParticleSystem.js - GPU 粒子池（M6 核心）
 *
 * 设计：
 *   单 THREE.Points 管理 4096 颗粒子。每帧 CPU 推进 position/velocity/life，
 *   一次性 needsUpdate 提交到 GPU。Shader 用 gl_PointCoord 绘制 mode-specific 形态。
 *
 *   自由列表 + 池复用：spawn() 拿一个 idx，update() 自动归还死亡粒子。
 *
 * 与现有 effects/particles.js 关系：
 *   现有系统是 CPU 2D Canvas 粒子，本类是 3D GPU 粒子。
 *   M6 不动 effects/particles.js，让两套并存：2D 粒子继续画在 #gameCanvas 上层，
 *   3D 粒子画在 #gl-canvas。后续 milestone 可逐步停掉 2D。
 *
 * mode 枚举（int，可用 string 别名）：
 *   0 / 'spark'  → 锐利亮点，快速消散
 *   1 / 'ember'  → 闪烁余烬
 *   2 / 'mist'   → 软雾
 *   3 / 'smoke'  → 慢消散烟
 *   4 / 'shard'  → 锐利碎片（射线状）
 */

import * as THREE from 'three';

const MODE_LUT = { spark: 0, ember: 1, mist: 2, smoke: 3, shard: 4 };

export class GPUParticleSystem {
    /**
     * @param {THREE.Scene} scene
     * @param {Object}      [opts]
     * @param {number}      [opts.capacity=4096]
     */
    constructor(scene, opts = {}) {
        this.scene = scene;
        this.capacity = opts.capacity || 4096;

        // CPU 端缓冲（更新方便）
        this.positions = new Float32Array(this.capacity * 3);
        this.colors    = new Float32Array(this.capacity * 3);
        this.lives     = new Float32Array(this.capacity);   // 归一化 [0..1]，0=死
        this.sizes     = new Float32Array(this.capacity);   // 初始粒子尺寸（屏幕系数）
        this.modes     = new Float32Array(this.capacity);

        // CPU only：速度 & 总寿命
        this.velocities = new Float32Array(this.capacity * 3);
        this.lifetimes  = new Float32Array(this.capacity);  // 秒

        // 自由列表
        this.freeList = new Array(this.capacity);
        for (let i = 0; i < this.capacity; i++) this.freeList[i] = this.capacity - 1 - i;

        // Geometry / material
        const geom = new THREE.BufferGeometry();
        geom.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
        geom.setAttribute('color',    new THREE.BufferAttribute(this.colors, 3));
        geom.setAttribute('aLife',    new THREE.BufferAttribute(this.lives, 1));
        geom.setAttribute('aSize',    new THREE.BufferAttribute(this.sizes, 1));
        geom.setAttribute('aMode',    new THREE.BufferAttribute(this.modes, 1));
        this.geometry = geom;

        this.material = new THREE.ShaderMaterial({
            transparent: true,
            depthWrite: false,
            blending: THREE.AdditiveBlending,
            uniforms: {
                uTime:        { value: 0 },
                uPixelRatio:  { value: (typeof window !== 'undefined' && window.devicePixelRatio) || 1 },
            },
            vertexShader: /* glsl */`
                attribute float aLife;
                attribute float aSize;
                attribute float aMode;
                uniform float uPixelRatio;
                varying vec3  vColor;
                varying float vLife;
                varying float vMode;
                void main() {
                    vColor = color;
                    vLife  = aLife;
                    vMode  = aMode;
                    vec4 mv = modelViewMatrix * vec4(position, 1.0);
                    gl_Position = projectionMatrix * mv;
                    // gl_PointSize：屏幕上的像素大小，按距离自动衰减
                    gl_PointSize = aSize * uPixelRatio * (300.0 / max(1.0, -mv.z)) * (0.25 + aLife * 0.75);
                }
            `,
            fragmentShader: /* glsl */`
                precision mediump float;
                varying vec3  vColor;
                varying float vLife;
                varying float vMode;
                uniform float uTime;
                void main() {
                    if (vLife <= 0.0) discard;
                    vec2 c = gl_PointCoord - 0.5;
                    float d = length(c);
                    if (d > 0.5) discard;

                    int mode = int(vMode + 0.5);
                    float alpha;
                    vec3  col = vColor;

                    if (mode == 0) {
                        // spark：锐利亮点 + 中心爆白
                        alpha = smoothstep(0.5, 0.0, d) * vLife;
                        col += vec3(0.6, 0.55, 0.5) * smoothstep(0.18, 0.0, d) * vLife;
                    } else if (mode == 1) {
                        // ember：闪烁余烬
                        float flick = 0.65 + 0.35 * sin(vLife * 70.0 + (vColor.r + vColor.g) * 12.0);
                        alpha = smoothstep(0.5, 0.0, d) * vLife * flick;
                    } else if (mode == 2) {
                        // mist：软雾团（很弱很大）
                        alpha = exp(-d * 4.0) * vLife * 0.45;
                    } else if (mode == 3) {
                        // smoke：慢消散
                        alpha = smoothstep(0.5, 0.12, d) * vLife * vLife * 0.7;
                        col *= 0.7;
                    } else if (mode == 4) {
                        // shard：锐利
                        alpha = smoothstep(0.5, 0.32, d) * vLife;
                        col += vColor * smoothstep(0.32, 0.0, d) * vLife * 0.8;
                    } else {
                        alpha = smoothstep(0.5, 0.0, d) * vLife;
                    }

                    gl_FragColor = vec4(col, alpha);
                }
            `,
            vertexColors: true,
        });

        this.points = new THREE.Points(geom, this.material);
        this.points.frustumCulled = false;
        this.points.name = 'GPUParticles';
        scene.add(this.points);

        // 标志位（仅在确实有变化时上传 GPU）
        this._needUpload = false;
    }

    /**
     * 发射粒子簇。
     * @param {Object} opts
     * @param {number} opts.x world x
     * @param {number} opts.y world y
     * @param {number} [opts.z=0]
     * @param {number|string} [opts.color=0xffffff] hex 或 string '#rrggbb'
     * @param {number} [opts.count=12]
     * @param {string|number} [opts.mode='spark'] 'spark'|'ember'|'mist'|'smoke'|'shard' 或对应整数
     * @param {number} [opts.size=4]
     * @param {number} [opts.lifetime=0.8] 秒
     * @param {number} [opts.spread=1.0]   速度发散因子
     * @param {number} [opts.speed=8]      基础速度
     * @param {number} [opts.dirX=0]       速度偏向 x
     * @param {number} [opts.dirY=0]       速度偏向 y
     */
    spawn(opts) {
        const count = Math.min(opts.count ?? 12, this.freeList.length);
        if (count <= 0) return;

        const tmpColor = new THREE.Color(opts.color ?? 0xffffff);
        const modeRaw = opts.mode ?? 0;
        const modeNum = (typeof modeRaw === 'string') ? (MODE_LUT[modeRaw] ?? 0) : modeRaw;

        const baseSize = opts.size ?? 4;
        const life     = opts.lifetime ?? 0.8;
        const spread   = opts.spread ?? 1.0;
        const speed    = opts.speed ?? 8;
        const dirX     = opts.dirX ?? 0;
        const dirY     = opts.dirY ?? 0;

        for (let i = 0; i < count; i++) {
            const idx = this.freeList.pop();
            if (idx === undefined) break;

            this.positions[idx * 3 + 0] = opts.x;
            this.positions[idx * 3 + 1] = opts.y;
            this.positions[idx * 3 + 2] = opts.z ?? 0;

            const ang = Math.random() * Math.PI * 2;
            const r = Math.random() * spread;
            this.velocities[idx * 3 + 0] = Math.cos(ang) * r * speed + dirX * speed;
            this.velocities[idx * 3 + 1] = Math.sin(ang) * r * speed + dirY * speed;
            this.velocities[idx * 3 + 2] = 0;

            this.colors[idx * 3 + 0] = tmpColor.r;
            this.colors[idx * 3 + 1] = tmpColor.g;
            this.colors[idx * 3 + 2] = tmpColor.b;

            this.sizes[idx] = baseSize * (0.55 + Math.random() * 0.95);
            this.modes[idx] = modeNum;
            this.lifetimes[idx] = life * (0.7 + Math.random() * 0.6);
            this.lives[idx] = 1.0;
        }

        this._needUpload = true;
    }

    /**
     * @param {number} dt seconds
     */
    update(dt) {
        const h = Math.min(0.05, Math.max(0, dt));
        const cap = this.capacity;
        const damping = Math.pow(0.96, h * 60);   // ~每秒折损到 0.08，但跟 h 解耦

        let anyAlive = false;
        for (let i = 0; i < cap; i++) {
            if (this.lives[i] <= 0) continue;
            anyAlive = true;
            this.lives[i] -= h / Math.max(0.05, this.lifetimes[i]);
            if (this.lives[i] <= 0) {
                this.lives[i] = 0;
                this.freeList.push(i);
                continue;
            }
            // 位置积分
            this.positions[i * 3 + 0] += this.velocities[i * 3 + 0] * h;
            this.positions[i * 3 + 1] += this.velocities[i * 3 + 1] * h;
            this.positions[i * 3 + 2] += this.velocities[i * 3 + 2] * h;
            // 阻尼
            this.velocities[i * 3 + 0] *= damping;
            this.velocities[i * 3 + 1] *= damping;
        }

        if (anyAlive || this._needUpload) {
            this.geometry.attributes.position.needsUpdate = true;
            this.geometry.attributes.color.needsUpdate    = true;
            this.geometry.attributes.aLife.needsUpdate    = true;
            this.geometry.attributes.aSize.needsUpdate    = true;
            this.geometry.attributes.aMode.needsUpdate    = true;
            this._needUpload = false;
        }

        this.material.uniforms.uTime.value += h;
    }

    /** 全部归零（阶段切换时调） */
    clear() {
        for (let i = 0; i < this.capacity; i++) this.lives[i] = 0;
        this.freeList.length = 0;
        for (let i = 0; i < this.capacity; i++) this.freeList[i] = this.capacity - 1 - i;
        this._needUpload = true;
    }

    dispose() {
        try {
            if (this.scene) this.scene.remove(this.points);
            this.geometry.dispose();
            this.material.dispose();
        } catch (e) {}
    }

    /** 当前活跃粒子数（调试用） */
    aliveCount() {
        return this.capacity - this.freeList.length;
    }
}
