/**
 * EnemyMeshPool.js - 敌人 3D 网格的"按需创建 + 池缓存"管理器（M3）
 *
 * 设计：
 *   - 敌人数不多（< 32 同时存在），每个敌人对应一个 THREE.Group：
 *       Group {
 *         Mesh<core geometry, ShaderMaterial>   // archetype 主体
 *         Mesh<shield plane> (if affix shield)
 *         Mesh<regen orbs>   (if affix regen)
 *       }
 *   - 用 Map<enemyId, Group> 跟踪。enemy 没有显式 id → 第一次见到时给它打 `__id3d` 标记
 *   - sync 流程：
 *       1. 标记池中所有 Group 为 stale
 *       2. 遍历当前 enemies[]，每个 active 敌人：
 *          a. 池中已存在 → 复用，update position/scale，标记 fresh
 *          b. 不存在 → 用 EnemyMeshFactory 创建并加入 scene + 池
 *       3. 把仍 stale 的 Group dispose + 从 scene 移除
 *
 * 材质共享：所有敌人共用一份 ShaderMaterial（不同 emissive 颜色靠 instanceColor 形式
 *           注入 uniform 不太方便 → 改为每敌一个材质 clone；性能影响极小因为敌人少）
 */

import * as THREE from 'three';
import { createGeometryFor, getTierColor, METAL_BASE_COLOR } from './EnemyMeshFactory.js';

let _idSeq = 0;
function _ensureId(enemy) {
    if (!enemy.__id3d) enemy.__id3d = ++_idSeq;
    return enemy.__id3d;
}

const ENEMY_DEPTH = 18;       // z 厚度（world units），让敌人在 z=0 平面上立体感
const DEFAULT_FOOTPRINT = 60; // px → 默认敌人尺寸（实际从 enemy.width/height 读）

// 共享主体 shader（每敌实例化时 clone material 设置 uniform）
const VERT_SRC = /* glsl */`
    varying vec3 vNormal;
    varying vec3 vViewPos;
    void main() {
        vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
        vNormal = normalize(normalMatrix * normal);
        vViewPos = mvPos.xyz;
        gl_Position = projectionMatrix * mvPos;
    }
`;

const FRAG_SRC = /* glsl */`
    precision mediump float;
    uniform vec3  uBase;        // 暗金属色
    uniform vec3  uTier;        // 阶级色（emissive）
    uniform float uHit;         // 击中冲量 0..1
    uniform float uTime;
    uniform float uPhase;       // 个体相位
    varying vec3 vNormal;
    varying vec3 vViewPos;

    void main() {
        vec3 N = normalize(vNormal);
        vec3 V = normalize(-vViewPos);
        float ndotv = max(0.0, dot(N, V));

        float rim = pow(1.0 - ndotv, 2.0);
        float pulse = 0.65 + 0.35 * sin(uTime * 1.4 + uPhase);

        // 伪光照：用 view-y 模拟从上方斜下的"舞台灯"
        float fakeLight = 0.5 + 0.5 * max(0.0, N.y * 0.6 + N.z * 0.4);

        vec3 col = uBase * (0.55 + 0.55 * fakeLight);   // 提亮基底，面部可读
        col += uTier * 0.22;                            // 全身 tier 染色（嵌入金属基）
        col += uTier * rim * 1.7 * pulse;               // 边缘按 tier 增强 + 呼吸
        col = mix(col, vec3(1.0), uHit * 0.85);         // 击中瞬白闪

        gl_FragColor = vec4(col, 1.0);
    }
`;

function _createBodyMaterial(tierHex, phase) {
    return new THREE.ShaderMaterial({
        uniforms: {
            uBase:  { value: new THREE.Color(METAL_BASE_COLOR) },
            uTier:  { value: new THREE.Color(tierHex) },
            uHit:   { value: 0 },
            uTime:  { value: 0 },
            uPhase: { value: phase },
        },
        vertexShader: VERT_SRC,
        fragmentShader: FRAG_SRC,
    });
}

// ============================================================
// Affix 装饰：当前 M3 只做最常见的两种（shield / regen），其余 milestone 再补
// ============================================================
function _createShieldDecor() {
    // 六边形蜂巢盾，半透明青蓝，悬浮在敌人正面
    const ring = new THREE.RingGeometry(0.55, 0.62, 6, 1);
    const mat = new THREE.MeshBasicMaterial({
        color: 0x60a5fa,
        transparent: true,
        opacity: 0.45,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
    });
    const ringMesh = new THREE.Mesh(ring, mat);
    // 中央填充薄板（更"实体感"）
    const hex = new THREE.CircleGeometry(0.55, 6);
    const hexMat = new THREE.MeshBasicMaterial({
        color: 0x60a5fa,
        transparent: true,
        opacity: 0.15,
        side: THREE.DoubleSide,
        depthWrite: false,
    });
    const hexMesh = new THREE.Mesh(hex, hexMat);

    const grp = new THREE.Group();
    grp.add(ringMesh, hexMesh);
    grp.userData = { affix: 'shield', _materials: [mat, hexMat] };
    return grp;
}

function _createRegenDecor() {
    // 3 颗小绿球绕顶部螺旋
    const grp = new THREE.Group();
    const mat = new THREE.MeshBasicMaterial({
        color: 0x4ade80,
        transparent: true,
        opacity: 0.85,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
    });
    const geom = new THREE.SphereGeometry(0.07, 8, 6);
    for (let i = 0; i < 3; i++) {
        const m = new THREE.Mesh(geom, mat);
        m.userData = { angle: (i / 3) * Math.PI * 2, radius: 0.4, ySpeed: 0.4 };
        grp.add(m);
    }
    grp.userData = { affix: 'regen', _material: mat, _geometry: geom };
    return grp;
}

// ============================================================
// Pool
// ============================================================
export class EnemyMeshPool {
    constructor(scene) {
        this.scene = scene;
        this.map = new Map();   // id → entry { group, body, archetype, affixSet, fresh }
        this._tmpV = new THREE.Vector3();
    }

    /**
     * 把当前 enemies[] 同步到 3D 场景。
     * @param {Array} enemies game.enemies
     * @param {Object} coords CoordsMapper
     */
    sync(enemies, coords) {
        // 1. 标记所有 entry 为 stale
        for (const entry of this.map.values()) entry.fresh = false;

        // 2. 遍历活跃敌人
        for (const e of enemies) {
            if (!e || !e.active) continue;
            // 入场动画 / 待生成的敌人：屏幕外的暂不渲染（pos.y < 0 多半是顶部入场）
            // 这里允许 pos.y < 0 也渲染——可表现 boss"从天而降"
            const id = _ensureId(e);
            let entry = this.map.get(id);
            const archetype = e.baseArchetype || 'residue';
            const wantedAffixes = (e.affixes || []).slice().sort();
            const affixKey = wantedAffixes.join('|');

            if (!entry) {
                entry = this._createEntry(e, archetype);
                this.map.set(id, entry);
                this.scene.add(entry.group);
            } else if (entry.archetype !== archetype) {
                // archetype 罕见变化（一般不会发生）；保守重建
                this.scene.remove(entry.group);
                this._disposeEntry(entry);
                entry = this._createEntry(e, archetype);
                this.map.set(id, entry);
                this.scene.add(entry.group);
            }

            // 同步 affix 装饰
            if (entry.affixKey !== affixKey) {
                this._syncAffixes(entry, wantedAffixes);
                entry.affixKey = affixKey;
            }

            // 同步位置 + 缩放
            const w = coords.toWorld(e.pos.x, e.pos.y, 0);
            entry.group.position.set(w.x, w.y, 0);

            const widthWorld  = (e.width  || DEFAULT_FOOTPRINT) * coords.scale;
            const heightWorld = (e.height || DEFAULT_FOOTPRINT) * coords.scale;
            const depthWorld  = Math.min(widthWorld, heightWorld) * 0.65;
            entry.body.scale.set(widthWorld, heightWorld, depthWorld);

            // tier 颜色可能变化（精英化等）
            const tierHex = getTierColor(e.type);
            if (entry.tierHex !== tierHex) {
                entry.body.material.uniforms.uTier.value.setHex(tierHex);
                entry.tierHex = tierHex;
            }

            // 受击冲量：从 enemy._hitImpact 拉取（如果存在）
            if (e._hitImpact !== undefined) {
                entry.body.material.uniforms.uHit.value =
                    Math.max(entry.body.material.uniforms.uHit.value * 0.85, e._hitImpact);
            }

            entry.fresh = true;
        }

        // 3. 移除 stale entries
        for (const [id, entry] of this.map) {
            if (!entry.fresh) {
                this.scene.remove(entry.group);
                this._disposeEntry(entry);
                this.map.delete(id);
            }
        }
    }

    /** 每帧推进时间 + 装饰动画 */
    update(dt, t) {
        for (const entry of this.map.values()) {
            // 主体 shader 时间
            entry.body.material.uniforms.uTime.value = t;
            // 击中冲量衰减
            const u = entry.body.material.uniforms.uHit;
            if (u.value > 0.001) u.value *= Math.max(0, 1 - 5.0 * dt);

            // regen 球轨道
            if (entry.regenGroup) {
                for (const orb of entry.regenGroup.children) {
                    const ud = orb.userData;
                    ud.angle += dt * 1.6;
                    orb.position.set(
                        Math.cos(ud.angle) * ud.radius,
                        0.5 + Math.sin(t * 1.2 + ud.angle * 2) * 0.15,
                        Math.sin(ud.angle) * ud.radius
                    );
                }
            }
            // shield 旋转
            if (entry.shieldGroup) {
                entry.shieldGroup.rotation.z = t * 0.4;
            }
        }
    }

    clear() {
        for (const entry of this.map.values()) {
            this.scene.remove(entry.group);
            this._disposeEntry(entry);
        }
        this.map.clear();
    }

    // -------- 内部 --------
    _createEntry(enemy, archetype) {
        const geom = createGeometryFor(archetype);
        const tierHex = getTierColor(enemy.type);
        const phase = ((enemy.__id3d || 0) * 0.37) % (Math.PI * 2);
        const mat = _createBodyMaterial(tierHex, phase);
        const body = new THREE.Mesh(geom, mat);
        body.frustumCulled = false;

        const group = new THREE.Group();
        group.add(body);
        group.name = `Enemy_${enemy.__id3d}_${archetype}`;

        return {
            group,
            body,
            archetype,
            tierHex,
            affixKey: '',
            shieldGroup: null,
            regenGroup: null,
            fresh: true,
        };
    }

    _syncAffixes(entry, affixes) {
        const set = new Set(affixes);

        // shield
        if (set.has('shield')) {
            if (!entry.shieldGroup) {
                entry.shieldGroup = _createShieldDecor();
                // 摆在敌人正前方（+z）一点点
                entry.shieldGroup.position.set(0, 0, 0.55);
                entry.group.add(entry.shieldGroup);
            }
        } else if (entry.shieldGroup) {
            entry.group.remove(entry.shieldGroup);
            this._disposeShield(entry.shieldGroup);
            entry.shieldGroup = null;
        }

        // regen
        if (set.has('regen')) {
            if (!entry.regenGroup) {
                entry.regenGroup = _createRegenDecor();
                entry.group.add(entry.regenGroup);
            }
        } else if (entry.regenGroup) {
            entry.group.remove(entry.regenGroup);
            this._disposeRegen(entry.regenGroup);
            entry.regenGroup = null;
        }
    }

    _disposeEntry(entry) {
        try {
            entry.body.geometry.dispose();
            entry.body.material.dispose();
        } catch (e) {}
        if (entry.shieldGroup) this._disposeShield(entry.shieldGroup);
        if (entry.regenGroup) this._disposeRegen(entry.regenGroup);
    }

    _disposeShield(grp) {
        try {
            for (const m of grp.children) m.geometry.dispose();
            const mats = grp.userData._materials || [];
            for (const m of mats) m.dispose();
        } catch (e) {}
    }

    _disposeRegen(grp) {
        try {
            if (grp.userData._geometry) grp.userData._geometry.dispose();
            if (grp.userData._material) grp.userData._material.dispose();
        } catch (e) {}
    }

    dispose() {
        this.clear();
    }
}
