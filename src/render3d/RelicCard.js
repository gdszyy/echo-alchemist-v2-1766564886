/**
 * RelicCard.js - 遗物的 3D 卡片表达（M5 核心）
 *
 * 设计：
 *   不再使用 PNG sprite。每张遗物卡片完全程序化生成：
 *
 *     Card Group {
 *       FrontPlate       —— 圆角平板，shader 渲染稀有度边框 + 暗色基底
 *       SigilMesh        —— 中央徽记（程序化 shader，hash(id) → 形状）
 *       TextPanel        —— Canvas 2D 绘制标题/描述/标签 → CanvasTexture
 *       RarityRimGlow    —— 卡片四周薄光环（稀有度色，bloom 友好）
 *     }
 *
 * 用法：
 *   const card = new RelicCard(relic);    // relic = config.RELIC_DB 里一行
 *   card.group.position.set(...);
 *   scene.add(card.group);
 *   ...
 *   card.dispose();                       // 销毁所有资源
 *
 * 整张卡片用 1 个 ShaderMaterial（外加 1 张 CanvasTexture），总 draw call ≤ 3。
 */

import * as THREE from 'three';

// 稀有度色板（与 visual_redesign_3d_plan.md §1.3 一致）
const RARITY_COLORS = {
    common:    { fill: 0xe2e8f0, glow: 0x94a3b8 },
    rare:      { fill: 0x818cf8, glow: 0x6366f1 },
    epic:      { fill: 0xd946ef, glow: 0xc026d3 },
    legendary: { fill: 0xf59e0b, glow: 0xea580c },
    cursed:    { fill: 0x9f1239, glow: 0xbe123c },
};

const CARD_WIDTH  = 4.6;
const CARD_HEIGHT = 6.4;
const CARD_DEPTH  = 0.35;
const CARD_RADIUS = 0.45;  // 圆角半径

// ============================================================
// 字符串哈希 → [0,1) 数字，用作程序化随机种子
// ============================================================
function hashStr(s) {
    let h = 2166136261 >>> 0;
    for (let i = 0; i < s.length; i++) {
        h ^= s.charCodeAt(i);
        h = Math.imul(h, 16777619);
    }
    return (h >>> 0) / 0xffffffff;
}

// 简易确定性 PRNG（同 BackgroundLayer mulberry32）
function mulberry32(seed) {
    return function () {
        let t = seed += 0x6d2b79f5;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

// ============================================================
// 圆角矩形 BufferGeometry（构造一次，所有卡片共享）
// ============================================================
let _sharedCardGeom = null;
function getCardGeometry() {
    if (_sharedCardGeom) return _sharedCardGeom;
    const shape = new THREE.Shape();
    const w = CARD_WIDTH, h = CARD_HEIGHT, r = CARD_RADIUS;
    shape.moveTo(-w / 2 + r, -h / 2);
    shape.lineTo(w / 2 - r, -h / 2);
    shape.quadraticCurveTo(w / 2, -h / 2, w / 2, -h / 2 + r);
    shape.lineTo(w / 2, h / 2 - r);
    shape.quadraticCurveTo(w / 2, h / 2, w / 2 - r, h / 2);
    shape.lineTo(-w / 2 + r, h / 2);
    shape.quadraticCurveTo(-w / 2, h / 2, -w / 2, h / 2 - r);
    shape.lineTo(-w / 2, -h / 2 + r);
    shape.quadraticCurveTo(-w / 2, -h / 2, -w / 2 + r, -h / 2);

    _sharedCardGeom = new THREE.ExtrudeGeometry(shape, {
        depth: CARD_DEPTH,
        bevelEnabled: true,
        bevelSize: 0.05,
        bevelThickness: 0.04,
        bevelSegments: 2,
        curveSegments: 8,
    });
    _sharedCardGeom.center();

    // ExtrudeGeometry 默认 UV 是 shape 坐标范围（约 [-w/2, +w/2]），不是 [0, 1]。
    // 手动归一化到 [0, 1] 以便 shader 里的 vignette / edge 计算工作正常。
    const pos = _sharedCardGeom.attributes.position;
    const uv = new Float32Array(pos.count * 2);
    for (let i = 0; i < pos.count; i++) {
        uv[i * 2 + 0] = (pos.getX(i) + CARD_WIDTH * 0.5) / CARD_WIDTH;
        uv[i * 2 + 1] = (pos.getY(i) + CARD_HEIGHT * 0.5) / CARD_HEIGHT;
    }
    _sharedCardGeom.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    return _sharedCardGeom;
}

// ============================================================
// 文本面板：Canvas 2D 渲染 → CanvasTexture
// ============================================================
function _wrapText(ctx, text, maxWidth) {
    if (!text) return [''];
    // 简易"按字符断行"——适合中文
    const chars = Array.from(text);
    const lines = [];
    let cur = '';
    for (const ch of chars) {
        const tryLine = cur + ch;
        if (ctx.measureText(tryLine).width > maxWidth) {
            if (cur) lines.push(cur);
            cur = ch;
        } else {
            cur = tryLine;
        }
    }
    if (cur) lines.push(cur);
    return lines;
}

function createTextTexture(relic) {
    const W = 512;
    const H = 768;
    const canvas = document.createElement('canvas');
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d');

    // 全透明背景（卡片本体已经渲染基底色）
    ctx.clearRect(0, 0, W, H);

    const rarity = relic.rarity || 'common';
    const colors = RARITY_COLORS[rarity] || RARITY_COLORS.common;
    const glowHex = '#' + colors.glow.toString(16).padStart(6, '0');
    const fillHex = '#' + colors.fill.toString(16).padStart(6, '0');

    // ---- 顶部色带（rarity）----
    const bandH = 88;
    const grad = ctx.createLinearGradient(0, 0, W, 0);
    grad.addColorStop(0, glowHex + '00');
    grad.addColorStop(0.5, glowHex + 'cc');
    grad.addColorStop(1, glowHex + '00');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, bandH);

    // ---- 标题 ----
    ctx.fillStyle = '#f8fafc';
    ctx.font = 'bold 48px "Noto Serif TC", serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = glowHex;
    ctx.shadowBlur = 16;
    ctx.fillText(relic.name || '???', W / 2, bandH / 2 + 8);
    ctx.shadowBlur = 0;

    // ---- 中央徽记位置预留（在 3D 里用 SigilMesh）----
    const sigilY = bandH + 60;
    const sigilSize = 220;
    // 占位标记（透明）—— Sigil 由独立 mesh 覆盖
    // 这里画一圈纹路装饰
    ctx.strokeStyle = glowHex + '66';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(W / 2, sigilY + sigilSize / 2, sigilSize / 2 + 18, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = glowHex + '33';
    ctx.beginPath();
    ctx.arc(W / 2, sigilY + sigilSize / 2, sigilSize / 2 + 30, 0, Math.PI * 2);
    ctx.stroke();

    // ---- 描述文本 ----
    const descY = sigilY + sigilSize + 60;
    ctx.fillStyle = '#cbd5e1';
    ctx.font = '32px "Noto Serif TC", serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    const desc = relic.desc || '';
    const lines = _wrapText(ctx, desc, W - 60);
    const lineH = 44;
    for (let i = 0; i < Math.min(lines.length, 6); i++) {
        ctx.fillText(lines[i], 30, descY + i * lineH);
    }

    // ---- 底部稀有度标 + tags ----
    const footY = H - 60;
    ctx.fillStyle = glowHex;
    ctx.font = 'bold 26px "Noto Serif TC", serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    const rarityLabel = rarity.toUpperCase();
    ctx.fillText(rarityLabel, 30, footY);
    if (relic.tags && relic.tags.length) {
        ctx.fillStyle = '#94a3b8';
        ctx.font = '24px "Noto Serif TC", serif';
        ctx.textAlign = 'right';
        ctx.fillText(relic.tags.slice(0, 2).join(' · '), W - 30, footY);
    }
    if (relic.maxStacks && relic.maxStacks > 1) {
        ctx.fillStyle = '#fbbf24';
        ctx.font = '20px "Noto Serif TC", serif';
        ctx.textAlign = 'right';
        ctx.fillText(`MAX ${relic.maxStacks}`, W - 30, footY - 30);
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.minFilter = THREE.LinearFilter;
    tex.magFilter = THREE.LinearFilter;
    tex.needsUpdate = true;
    return { texture: tex, canvas, sigilSize };
}

// ============================================================
// Sigil shader：程序化徽记（hash → 形状）
// ============================================================
function _createSigilMaterial(relic) {
    const seed = hashStr(relic.id || relic.name || '???');
    const colors = RARITY_COLORS[relic.rarity || 'common'] || RARITY_COLORS.common;
    const rng = mulberry32(Math.floor(seed * 1e8));
    const armCount = 3 + Math.floor(rng() * 6);          // 3..8
    const innerFreq = 2 + Math.floor(rng() * 4);          // 2..5
    const phase = rng() * Math.PI * 2;
    const colorHex = colors.glow;
    return new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        uniforms: {
            uTime:      { value: 0 },
            uColor:     { value: new THREE.Color(colorHex) },
            uColorBri:  { value: new THREE.Color(colors.fill) },
            uArms:      { value: armCount },
            uInner:     { value: innerFreq },
            uPhase:     { value: phase },
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
            uniform vec3  uColor;
            uniform vec3  uColorBri;
            uniform float uArms;
            uniform float uInner;
            uniform float uPhase;
            varying vec2 vUv;

            void main() {
                vec2 c = vUv - 0.5;
                float r = length(c) * 2.0;
                float ang = atan(c.y, c.x);

                // 离散花瓣（"星花"）
                float petal = cos(ang * uArms + uPhase) * 0.5 + 0.5;
                float petalShape = smoothstep(0.6, 0.85, petal) * smoothstep(0.95, 0.5, r);

                // 内圈细纹
                float ring = sin(r * 32.0 + uTime * 0.6) * 0.5 + 0.5;
                float ringMask = smoothstep(0.45, 0.30, r) * (0.4 + ring * 0.6);

                // 中心亮点
                float core = smoothstep(0.12, 0.0, r) * 1.4;

                // 慢速旋转感（让花瓣轻微脉动）
                float pulse = 0.85 + 0.15 * sin(uTime * 1.2);

                vec3 col = uColor * petalShape * 1.6 * pulse;
                col += uColor * ringMask * 0.55;
                col += uColorBri * core;

                // 外环淡出
                float outerFade = smoothstep(1.0, 0.85, r);

                gl_FragColor = vec4(col * outerFade, (petalShape + ringMask + core) * outerFade);
            }
        `,
    });
}

// ============================================================
// RelicCard 主类
// ============================================================
export class RelicCard {
    /**
     * @param {Object} relic { id, name, desc, rarity, tags, maxStacks }
     */
    constructor(relic) {
        this.relic = relic || {};
        this.group = new THREE.Group();
        this.group.name = `RelicCard_${relic.id || 'anon'}`;

        const rarity = relic.rarity || 'common';
        const colors = RARITY_COLORS[rarity] || RARITY_COLORS.common;
        this._rarityHex = colors.glow;
        this._fillHex = colors.fill;

        // ----- 卡牌本体（圆角板 + 边框 shader）-----
        const cardGeom = getCardGeometry();
        this.cardMat = new THREE.ShaderMaterial({
            transparent: true,
            uniforms: {
                uTime:     { value: 0 },
                uRarity:   { value: new THREE.Color(this._rarityHex) },
                uFill:     { value: new THREE.Color(this._fillHex) },
            },
            vertexShader: /* glsl */`
                varying vec3 vNormal;
                varying vec3 vWorldPos;
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
                uniform vec3  uRarity;
                uniform vec3  uFill;
                varying vec3 vNormal;
                varying vec3 vWorldPos;
                varying vec2 vUv;

                void main() {
                    // 朝玩家方向的 fresnel 边光
                    vec3 viewDir = normalize(cameraPosition - vWorldPos);
                    float fres = pow(1.0 - max(0.0, dot(vNormal, viewDir)), 2.5);

                    // 深色基底（不抢文字）
                    vec3 base = vec3(0.04, 0.06, 0.10);

                    // 内部 vignette（中间饱满，边缘掉到 0）
                    float vx = smoothstep(0.0, 0.15, min(vUv.x, 1.0 - vUv.x));
                    float vy = smoothstep(0.0, 0.10, min(vUv.y, 1.0 - vUv.y));
                    float interior = vx * vy;

                    // edgeMask 只在最外圈（vignette 衰减区）激活，避免大面积染色
                    float edgeMask = 1.0 - interior;

                    // 卡牌基底色：中央接近纯黑，仅边缘有 rarity 染色
                    vec3 col = base + uRarity * edgeMask * 0.35;
                    // 加 fresnel 边光（卡牌外缘的 emissive 光环，bloom 会接管）
                    col += uRarity * fres * 0.9;

                    gl_FragColor = vec4(col, 1.0);
                }
            `,
        });
        this.cardMesh = new THREE.Mesh(cardGeom, this.cardMat);
        this.cardMesh.frustumCulled = false;
        this.group.add(this.cardMesh);

        // ----- 文本面板（CanvasTexture 贴在卡牌正面）-----
        const { texture, sigilSize } = createTextTexture(this.relic);
        this._textTexture = texture;
        const textGeom = new THREE.PlaneGeometry(CARD_WIDTH * 0.92, CARD_HEIGHT * 0.92);
        const textMat = new THREE.MeshBasicMaterial({
            map: texture,
            transparent: true,
            depthWrite: false,
        });
        this._textMat = textMat;
        this.textMesh = new THREE.Mesh(textGeom, textMat);
        // 贴在卡牌正面外侧。CARD_DEPTH/2 + bevelThickness(0.06) + 余量 → 至少 0.30
        this.textMesh.position.set(0, 0, CARD_DEPTH / 2 + 0.12);
        this.textMesh.renderOrder = 1;
        this.group.add(this.textMesh);

        // ----- 程序化徽记（在卡牌中央，文字纹理之上）-----
        const sigilMat = _createSigilMaterial(this.relic);
        this._sigilMat = sigilMat;
        // 徽记大小 = sigilSize / canvas_height * CARD_HEIGHT * 0.92
        const sigilWorldSize = (220 / 768) * (CARD_HEIGHT * 0.92);
        const sigilGeom = new THREE.PlaneGeometry(sigilWorldSize, sigilWorldSize);
        this._sigilGeom = sigilGeom;
        this.sigilMesh = new THREE.Mesh(sigilGeom, sigilMat);
        // 卡片纹理里 sigilY = 88+60 = 148, sigilSize = 220
        // 中心 y on canvas = 148 + 110 = 258, canvas H = 768
        // local y = (0.5 - 258/768) * (CARD_HEIGHT*0.92) ≈ 0.964
        const sigilY = (0.5 - (88 + 60 + 220 / 2) / 768) * (CARD_HEIGHT * 0.92);
        this.sigilMesh.position.set(0, sigilY, CARD_DEPTH / 2 + 0.16);
        this.sigilMesh.renderOrder = 2;
        this.group.add(this.sigilMesh);

        // ----- 卡牌四周光环（薄椭圆 plane 在卡背后，bloom 友好）-----
        const glowGeom = new THREE.PlaneGeometry(CARD_WIDTH * 1.35, CARD_HEIGHT * 1.20);
        const glowMat = new THREE.ShaderMaterial({
            transparent: true,
            depthWrite: false,
            blending: THREE.AdditiveBlending,
            uniforms: {
                uColor: { value: new THREE.Color(this._rarityHex) },
                uTime:  { value: 0 },
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
                uniform vec3  uColor;
                uniform float uTime;
                varying vec2 vUv;
                void main() {
                    vec2 c = vUv - 0.5;
                    float r = length(c) * 2.0;
                    float halo = smoothstep(1.05, 0.55, r);
                    float pulse = 0.85 + 0.15 * sin(uTime * 0.8);
                    gl_FragColor = vec4(uColor * halo * pulse * 0.8, halo * 0.65);
                }
            `,
        });
        this._glowMat = glowMat;
        this._glowGeom = glowGeom;
        this.glowMesh = new THREE.Mesh(glowGeom, glowMat);
        // 放在卡牌后面一点
        this.glowMesh.position.set(0, 0, -CARD_DEPTH * 0.6);
        this.group.add(this.glowMesh);
    }

    /** 每帧更新 shader 时间（外层 update loop 调） */
    update(t) {
        if (this.cardMat) this.cardMat.uniforms.uTime.value = t;
        if (this._sigilMat) this._sigilMat.uniforms.uTime.value = t;
        if (this._glowMat) this._glowMat.uniforms.uTime.value = t;
    }

    /** 完全销毁所有 GPU 资源 */
    dispose() {
        // 共享 geometry 不在这里 dispose；只销毁本卡的材质 + 文字纹理
        if (this.cardMat) this.cardMat.dispose();
        if (this._textMat) this._textMat.dispose();
        if (this._sigilMat) this._sigilMat.dispose();
        if (this._textTexture) this._textTexture.dispose();
        if (this._sigilGeom) this._sigilGeom.dispose();
        if (this._glowMat) this._glowMat.dispose();
        if (this._glowGeom) this._glowGeom.dispose();
        if (this.textMesh && this.textMesh.geometry) this.textMesh.geometry.dispose();
    }
}
