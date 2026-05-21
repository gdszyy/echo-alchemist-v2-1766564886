/**
 * BallMesh.js - 弹珠 / 子弹的 3D 实例化网格（M2 补丁）
 *
 * 与 PegInstancedMesh 同思路，但实例数小（同时同屏一般 < 32）。
 * 共享一个 SphereGeometry，按 marbleType / projectile.color 染色，
 * 通过 emissive 让弹珠/子弹本身就是光源（PostFX bloom 会自动接管）。
 *
 * 通用类，承担 DropBalls + Projectiles 双角色——两者本质都是 "运动小球" 视觉。
 */

import * as THREE from 'three';

const BALL_CAPACITY = 64;
const SEGMENT = 12;

// 与 PegInstancedMesh PEG_COLORS 一致命名，但弹珠默认更亮（emissive）
const BALL_COLORS = {
    normal:        [0.95, 0.93, 0.85],
    damage:        [1.00, 0.30, 0.20],
    pyro:          [1.00, 0.32, 0.18],
    cryo:          [0.42, 0.78, 1.00],
    lightning:     [1.00, 0.92, 0.18],
    bounce:        [0.72, 1.00, 0.30],
    pierce:        [1.00, 0.50, 0.10],
    scatter:       [0.85, 0.55, 1.00],
    laser:         [0.20, 1.00, 0.60],
    explosive:     [1.00, 0.45, 0.15],
    rainbow:       [1.00, 0.55, 0.85],
    matryoshka:    [0.85, 0.70, 0.45],
    echo:          [0.55, 0.85, 1.00],
    venom:         [0.75, 0.30, 0.95],
    resonance:     [1.00, 0.75, 1.00],
    // 子弹默认（无 marbleType 时回退）
    bullet:        [1.00, 0.95, 0.65],
};

const FRAG_SRC = /* glsl */`
    precision mediump float;
    uniform float uTime;
    varying vec3  vNormal;
    varying vec3  vColor;
    varying vec3  vViewPos;
    void main() {
        vec3 N = normalize(vNormal);
        vec3 V = normalize(-vViewPos);
        float ndotv = max(0.0, dot(N, V));
        float rim = pow(1.0 - ndotv, 1.6);

        // [视觉调优] 用户反馈"3D 太暗" → 弹珠/子弹是核心视觉焦点，提亮：
        //   base 0.6 → 0.85，rim 系数 1.2 → 1.5，specular 0.4 → 0.55。
        //   配合 PostFX bloom threshold 下调，弹珠会主动激活泛光。
        vec3 col = vColor * (0.85 + rim * 1.5);
        col += vec3(1.0) * pow(ndotv, 10.0) * 0.55;

        gl_FragColor = vec4(col, 1.0);
    }
`;

const VERT_SRC = /* glsl */`
    attribute vec3 aColor;
    varying vec3 vNormal;
    varying vec3 vColor;
    varying vec3 vViewPos;
    void main() {
        vec4 mv = modelViewMatrix * instanceMatrix * vec4(position, 1.0);
        vViewPos = mv.xyz;
        vec3 instNormal = mat3(instanceMatrix) * normal;
        vNormal = normalize(normalMatrix * instNormal);
        vColor = aColor;
        gl_Position = projectionMatrix * mv;
    }
`;

export class BallMesh {
    constructor(opts = {}) {
        this.capacity = opts.capacity || BALL_CAPACITY;
        this.geometry = new THREE.SphereGeometry(1, SEGMENT, SEGMENT);

        const colorBuf = new Float32Array(this.capacity * 3);
        this.geometry.setAttribute(
            'aColor',
            new THREE.InstancedBufferAttribute(colorBuf, 3)
        );
        this._colorAttr = this.geometry.attributes.aColor;
        this._colorBuf = colorBuf;

        this.material = new THREE.ShaderMaterial({
            transparent: false,
            uniforms: { uTime: { value: 0 } },
            vertexShader: VERT_SRC,
            fragmentShader: FRAG_SRC,
        });

        this.mesh = new THREE.InstancedMesh(this.geometry, this.material, this.capacity);
        this.mesh.count = 0;
        this.mesh.frustumCulled = false;
        this.mesh.name = opts.name || 'BallMesh';

        this._tmpMat = new THREE.Matrix4();
    }

    /**
     * 同步 game.dropBalls 或 game.projectiles 数组到实例化 mesh。
     * @param {Array} balls2D each elem: { pos: {x,y}, type?, radius?, color?, recipe? }
     * @param {Object} coords CoordsMapper
     * @param {Object} [opts]
     * @param {number} [opts.defaultRadiusPx=8] 没有 .radius 时的默认像素半径
     * @param {string} [opts.colorKey='type'] 从对象的哪个字段读色（type / marbleType）
     */
    sync(balls2D, coords, opts = {}) {
        if (!balls2D || balls2D.length === 0) {
            this.mesh.count = 0;
            return;
        }
        const defaultR = opts.defaultRadiusPx ?? 8;
        const colorKey = opts.colorKey || 'type';
        const n = Math.min(balls2D.length, this.capacity);

        let active = 0;
        for (let i = 0; i < n; i++) {
            const b = balls2D[i];
            if (!b || !b.pos || b.active === false) continue;

            const w = coords.toWorld(b.pos.x, b.pos.y, 0.5);  // 弹珠略前于钉子 (z=0.5)
            const rPx = b.radius || defaultR;
            const wR = Math.max(0.06, rPx * coords.scale);

            this._tmpMat.makeScale(wR, wR, wR);
            this._tmpMat.setPosition(w.x, w.y, w.z);
            this.mesh.setMatrixAt(active, this._tmpMat);

            // 颜色：优先 ball.color 数值 → BALL_COLORS[type] → 默认 bullet
            let arr;
            if (b._3dColor) {
                arr = b._3dColor;
            } else {
                const key = b[colorKey] || b.marbleType || (b.recipe && b.recipe.type) || 'bullet';
                arr = BALL_COLORS[key] || BALL_COLORS.bullet;
            }
            this._colorBuf[active * 3 + 0] = arr[0];
            this._colorBuf[active * 3 + 1] = arr[1];
            this._colorBuf[active * 3 + 2] = arr[2];

            active++;
        }
        this.mesh.count = active;
        this.mesh.instanceMatrix.needsUpdate = true;
        this._colorAttr.needsUpdate = true;
    }

    update(dt, t) {
        if (this.material && this.material.uniforms) {
            this.material.uniforms.uTime.value = t;
        }
    }

    clear() { this.mesh.count = 0; }

    dispose() {
        try { this.geometry.dispose(); } catch (e) {}
        try { this.material.dispose(); } catch (e) {}
    }
}
