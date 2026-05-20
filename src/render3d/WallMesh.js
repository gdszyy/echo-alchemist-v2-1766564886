/**
 * WallMesh.js - 左右外墙的 3D 视觉表达（M2 新增）
 *
 * 物理意义：弹珠物理已经在 entities.js DropBall.update 里处理了 x 边界反弹（保留 60% 能量）。
 *           本类只负责"让玩家能看见墙"——把那两道隐形边界做成发光的能量壁。
 *
 * 视觉：两块薄 Box，竖立在画布左右边缘（world-x = ±W/2*scale），高度覆盖玩法区。
 *       材质用自定义 shader：
 *         - 垂直流光（从上往下扫的能量条纹）
 *         - 边缘 Fresnel 提亮
 *         - 击中时短暂闪烁（M3 接入；当前留 uniform 钩子）
 */

import * as THREE from 'three';

const WALL_COLOR_BASE  = 0x1e293b;  // 钢灰
const WALL_COLOR_GLOW  = 0x38bdf8;  // 青蓝能量光

export class WallMesh {
    constructor() {
        this.group = new THREE.Group();
        this.group.name = 'WallMesh';

        const geom = new THREE.BoxGeometry(1, 1, 1);
        this.geometry = geom;

        // 左右共用同一个材质（uniform 共享；可以拿到 uHitL / uHitR 分别播放反馈）
        this.material = new THREE.ShaderMaterial({
            transparent: true,
            depthWrite: false,
            blending: THREE.NormalBlending,
            uniforms: {
                uTime:      { value: 0 },
                uColorBase: { value: new THREE.Color(WALL_COLOR_BASE) },
                uColorGlow: { value: new THREE.Color(WALL_COLOR_GLOW) },
            },
            vertexShader: /* glsl */`
                varying vec3 vWorldPos;
                varying vec3 vNormal;
                varying vec2 vUv;
                void main() {
                    vUv = uv;
                    vec4 wp = modelMatrix * vec4(position, 1.0);
                    vWorldPos = wp.xyz;
                    vNormal = normalize(normalMatrix * normal);
                    gl_Position = projectionMatrix * viewMatrix * wp;
                }
            `,
            fragmentShader: /* glsl */`
                precision mediump float;
                uniform float uTime;
                uniform vec3  uColorBase;
                uniform vec3  uColorGlow;
                varying vec3 vNormal;
                varying vec3 vWorldPos;
                varying vec2 vUv;

                void main() {
                    // 朝玩家方向的面给一个 fresnel 边缘
                    vec3 viewDir = normalize(cameraPosition - vWorldPos);
                    float fres = pow(1.0 - max(0.0, dot(vNormal, viewDir)), 1.8);

                    // 垂直流光（沿 v 轴推动）
                    float scroll = fract(vUv.y * 2.0 - uTime * 0.18);
                    float band   = smoothstep(0.45, 0.50, scroll) - smoothstep(0.52, 0.58, scroll);

                    // 顶部 / 底部柔化（避免硬边缘）
                    float edgeY = smoothstep(0.0, 0.03, vUv.y) * (1.0 - smoothstep(0.97, 1.0, vUv.y));

                    // 基底色（很暗）
                    vec3 col = uColorBase * 0.4;
                    // 边缘 fresnel
                    col += uColorGlow * fres * 0.85;
                    // 流光条纹
                    col += uColorGlow * band * 0.75;

                    // 整体 alpha：边缘 + 条纹处更不透明，靠中心透
                    float alpha = (0.18 + fres * 0.6 + band * 0.55) * edgeY;
                    gl_FragColor = vec4(col, clamp(alpha, 0.0, 0.95));
                }
            `,
        });

        // 两面墙先建一个空壳，resize() 时调位置与缩放
        this.left  = new THREE.Mesh(geom, this.material);
        this.right = new THREE.Mesh(geom, this.material);
        this.left.name  = 'WallLeft';
        this.right.name = 'WallRight';
        this.left.frustumCulled  = false;
        this.right.frustumCulled = false;
        this.group.add(this.left, this.right);

        this._configured = false;
    }

    /**
     * 根据当前 canvas 尺寸 + scale 重新摆放两堵墙。
     * @param {Object} coords  CoordsMapper
     * @param {Object} [opts]
     * @param {number} [opts.thickness=2]   墙厚（world units）
     * @param {number} [opts.depth=8]       墙深（往 -z 拉出，制造厚度立体感）
     * @param {number} [opts.heightRatio=1] 墙高占画布高的比例（1=满高）
     */
    resize(coords, opts = {}) {
        const thickness = opts.thickness ?? 2;
        const depth     = opts.depth     ?? 8;
        const heightRatio = opts.heightRatio ?? 1.0;

        const wWorld = coords.W * coords.scale;
        const hWorld = coords.H * coords.scale * heightRatio;

        // 左墙：x = -W/2 - thickness/2（紧贴画布左缘外侧）
        this.left.scale.set(thickness, hWorld, depth);
        this.left.position.set(-wWorld * 0.5 - thickness * 0.5, 0, 0);

        this.right.scale.set(thickness, hWorld, depth);
        this.right.position.set(wWorld * 0.5 + thickness * 0.5, 0, 0);

        this._configured = true;
    }

    /** @param {number} t seconds elapsed */
    update(t) {
        this.material.uniforms.uTime.value = t;
    }

    /** 切到非战斗/研磨阶段时调用 */
    setVisible(v) {
        this.group.visible = !!v;
    }

    dispose() {
        this.geometry.dispose();
        this.material.dispose();
    }
}
