/**
 * PegInstancedMesh.js - 钉子的 3D 实例化网格（M2 核心）
 *
 * 全部钉子共享一个 SphereGeometry，通过 InstancedMesh 一次性提交 GPU。
 * 每个实例携带：
 *   - 变换矩阵（位置 + 均匀缩放至钉子半径）
 *   - 颜色（按 type 查表）
 *   - 相位（错开发光脉动 / 击中表演时间）
 *
 * 容量上限 PEG_CAPACITY。当前默认布局 ~72 个钉子，给 256 余量足够。
 *
 * 类型颜色 LUT 与游戏内 peg.type 字符串一一对应；未知 type 回退到 normal slate。
 */

import * as THREE from 'three';

export const PEG_CAPACITY = 256;
const SEGMENT = 14;

// 与 visual_redesign_3d_plan.md §1.3 调色板对齐
const PEG_COLORS = {
    normal:        [0.30, 0.36, 0.44], // slate
    pink:          [0.94, 0.50, 0.75], // 高弹粉
    wind:          [0.20, 0.72, 0.60], // 风系青绿
    flying_sword:  [0.98, 0.55, 0.20], // 剑系橙
    pyro:          [0.94, 0.27, 0.27], // 火
    cryo:          [0.38, 0.65, 0.98], // 冰
    lightning:     [0.98, 0.80, 0.13], // 雷
    bounce:        [0.64, 0.90, 0.21], // 弹射
    pierce:        [0.97, 0.45, 0.10], // 穿透
    scatter:       [0.75, 0.52, 0.99], // 散射
    damage:        [0.92, 0.92, 0.92], // 增幅
    laser:         [0.20, 0.85, 0.60], // 激光（一般不生成钉子，留位）
    venom:         [0.66, 0.30, 0.85], // 毒
    echo:          [0.55, 0.75, 0.95], // 回响
    resonance:     [0.95, 0.75, 0.95], // 共振
    rainbow:       [0.95, 0.55, 0.85], // 彩虹
    matryoshka:    [0.80, 0.70, 0.50], // 套娃
    explosive:     [0.99, 0.50, 0.25], // 爆破
};

export class PegInstancedMesh {
    constructor() {
        this.geometry = new THREE.SphereGeometry(1, SEGMENT, SEGMENT);

        // 每实例的"相位"——用于错开脉动，避免所有钉子同步呼吸（视觉死板）。
        const phases = new Float32Array(PEG_CAPACITY);
        for (let i = 0; i < PEG_CAPACITY; i++) phases[i] = Math.random() * Math.PI * 2;
        this.geometry.setAttribute(
            'instancePhase',
            new THREE.InstancedBufferAttribute(phases, 1)
        );

        // 击中冲量：被弹珠撞到瞬间这个值飙到 1.0，每帧衰减；驱动整球 emissive 增强 + 微膨胀。
        const hitImpulse = new Float32Array(PEG_CAPACITY);
        this.geometry.setAttribute(
            'instanceHit',
            new THREE.InstancedBufferAttribute(hitImpulse, 1)
        );
        this._hitImpulseAttr = this.geometry.attributes.instanceHit;
        this._hitImpulse = hitImpulse;

        // [3D-Main 修复] 自定义 aColor 替代 instanceColor，避免 three.js 在 setColorAt 调用与否
        // 的两种情况下 shader 报 "undeclared identifier" / "redefinition" 的双向坑。
        const colorBuf = new Float32Array(PEG_CAPACITY * 3);
        this.geometry.setAttribute(
            'aColor',
            new THREE.InstancedBufferAttribute(colorBuf, 3)
        );
        this._colorAttr = this.geometry.attributes.aColor;
        this._colorBuf = colorBuf;

        this.material = new THREE.ShaderMaterial({
            transparent: false,
            uniforms: {
                uTime: { value: 0 },
            },
            vertexShader: /* glsl */`
                // 自定义实例属性（避免与 three.js 内部 instanceColor 命名冲突）
                attribute vec3 aColor;
                attribute float instancePhase;
                attribute float instanceHit;

                varying vec3  vNormal;
                varying vec3  vColor;
                varying vec3  vViewPos;
                varying float vPhase;
                varying float vHit;

                void main() {
                    // 击中时整球沿法线轻微膨胀（squash-and-stretch 雏形）
                    float displ = instanceHit * 0.15;
                    vec3 displaced = position + normal * displ;

                    vec4 instancePos = instanceMatrix * vec4(displaced, 1.0);
                    vec4 mvPos = modelViewMatrix * instancePos;

                    // 法线需经过 instanceMatrix 的 3x3 部分（这里只含均匀缩放，所以 normalize 后等价于纯旋转）
                    vec3 instNormal = mat3(instanceMatrix) * normal;
                    vNormal  = normalize(normalMatrix * instNormal);
                    vColor   = aColor;
                    vViewPos = mvPos.xyz;
                    vPhase   = instancePhase;
                    vHit     = instanceHit;

                    gl_Position = projectionMatrix * mvPos;
                }
            `,
            fragmentShader: /* glsl */`
                precision mediump float;
                uniform float uTime;

                varying vec3  vNormal;
                varying vec3  vColor;
                varying vec3  vViewPos;
                varying float vPhase;
                varying float vHit;

                void main() {
                    vec3 N = normalize(vNormal);
                    vec3 V = normalize(-vViewPos);     // view dir in view space

                    float ndotv = max(0.0, dot(N, V));
                    float rim   = pow(1.0 - ndotv, 1.8);

                    // 缓慢呼吸 emission，每个钉子相位错开
                    float pulse = 0.75 + 0.25 * sin(uTime * 1.6 + vPhase);

                    // [视觉调优] 用户反馈"3D 太暗"——base 从 0.30 提到 0.65（钉子主体颜色饱满可读），
                    // 顶光（N.y 方向）再叠一道 0.35 让钉子从背景里"立"出来；rim 系数 1.7 不动；
                    // 击中冲量保持白闪 0.9，与 base 拉开对比。
                    float topLight = max(0.0, N.y * 0.6 + 0.4);
                    vec3 base     = vColor * (0.65 + 0.35 * topLight);
                    vec3 rimLight = vColor * rim * 1.9 * pulse;
                    vec3 hitFlash = vec3(1.0) * vHit * 0.9;

                    vec3 col = base + rimLight + hitFlash;
                    gl_FragColor = vec4(col, 1.0);
                }
            `,
        });

        this.mesh = new THREE.InstancedMesh(this.geometry, this.material, PEG_CAPACITY);
        this.mesh.count = 0;            // 起步隐藏所有实例
        this.mesh.frustumCulled = false; // 整个 mesh 一直可见，让 instanceMatrix 控制位置
        this.mesh.name = 'PegInstancedMesh';

        // 预分配复用对象（避免每帧 new Matrix4/Color）
        this._tmpMat = new THREE.Matrix4();
        this._tmpColor = new THREE.Color();
        this._pegIndexMap = new Map(); // peg → instance index

        // 击中冲量衰减率（per second）
        this.hitDecay = 4.0;
    }

    /**
     * 把游戏的 2D pegs[] 数组同步成 3D 实例。
     *
     * @param {Array}  pegs2D       game.pegs；每个元素需有 pos.x, pos.y, type, level
     * @param {Object} coords       CoordsMapper 实例（提供 toWorld + scale）
     * @param {number} pegRadiusPx  视觉钉子半径（canvas px），由 game_phase 计算后传入
     */
    sync(pegs2D, coords, pegRadiusPx) {
        const n = Math.min(pegs2D.length, PEG_CAPACITY);
        const worldRadius = Math.max(0.05, pegRadiusPx * coords.scale);

        for (let i = 0; i < n; i++) {
            const p = pegs2D[i];
            if (!p || !p.pos) continue;

            const w = coords.toWorld(p.pos.x, p.pos.y, 0);
            this._tmpMat.makeScale(worldRadius, worldRadius, worldRadius);
            this._tmpMat.setPosition(w.x, w.y, w.z);
            this.mesh.setMatrixAt(i, this._tmpMat);

            // 写入自定义 aColor buffer（不走 setColorAt 防 three.js 冲突）
            const arr = PEG_COLORS[p.type] || PEG_COLORS.normal;
            this._colorBuf[i * 3 + 0] = arr[0];
            this._colorBuf[i * 3 + 1] = arr[1];
            this._colorBuf[i * 3 + 2] = arr[2];
        }
        this.mesh.count = n;
        this.mesh.instanceMatrix.needsUpdate = true;
        this._colorAttr.needsUpdate = true;
    }

    /**
     * 触发"被弹珠撞到"的视觉反馈。
     * @param {number} index instance index (0..count-1)
     * @param {number} [intensity=1.0]
     */
    pulse(index, intensity = 1.0) {
        if (index < 0 || index >= PEG_CAPACITY) return;
        this._hitImpulse[index] = Math.min(1.0, this._hitImpulse[index] + intensity);
        this._hitImpulseAttr.needsUpdate = true;
    }

    /**
     * 每帧推进时间 + 衰减击中冲量。
     * @param {number} dt seconds
     * @param {number} t  seconds elapsed total
     */
    update(dt, t) {
        this.material.uniforms.uTime.value = t;

        // 衰减击中冲量
        if (this._hitImpulse) {
            const decay = Math.max(0, 1 - this.hitDecay * dt);
            let anyChanged = false;
            for (let i = 0; i < this.mesh.count; i++) {
                const v = this._hitImpulse[i];
                if (v > 0.001) {
                    this._hitImpulse[i] = v * decay;
                    anyChanged = true;
                } else if (v !== 0) {
                    this._hitImpulse[i] = 0;
                    anyChanged = true;
                }
            }
            if (anyChanged) this._hitImpulseAttr.needsUpdate = true;
        }
    }

    /** 显式隐藏所有钉子（切换出 gathering 阶段时调用） */
    clear() {
        this.mesh.count = 0;
    }

    dispose() {
        this.geometry.dispose();
        this.material.dispose();
    }
}
