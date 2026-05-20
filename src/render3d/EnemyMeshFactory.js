/**
 * EnemyMeshFactory.js - 程序化生成不同 archetype 的敌人 3D 几何（M3）
 *
 * 9 个 archetype（参考 enemy_v2_metadata）+ 默认 residue：
 *
 *   bastion     (3×1)  长六棱柱（横躺）   — "装甲横梁"
 *   maw         (2×2)  双锥对夹           — "深渊胃囊"
 *   deflector   (2×1)  斜楔（梯形棱柱）   — "棱盾兽"
 *   echoSpire   (1×2)  双层金字塔         — "共振尖塔"
 *   prism       (1×3)  细长三棱柱         — "折光棱柱"
 *   hive        (2×3)  二十面体           — "孵化巢"
 *   siege       (3×2)  方块+顶部炮塔      — "攻城履带"
 *   gravityWell (3×3)  球体+扁圆环框架    — "引力炉心"
 *   residue     (1×1)  方块（默认）       — 普通敌人
 *
 * 每个工厂函数返回 { geometry, color } —— Mesh 由外层 EnemyMeshPool 负责装配，
 * 共用同一份 ShaderMaterial（uniform 上传 type/tier 控制颜色）。
 */

import * as THREE from 'three';

// 调色板（暗黑炼金金属感）
const METAL_BASE  = 0x1f2937;   // slate-800
const TIER_NORMAL = 0x475569;   // slate-500 (normal 敌人主色)
const TIER_ELITE  = 0x22d3ee;   // cyan-400 (精英)
const TIER_BOSS   = 0xf59e0b;   // amber-500 (boss)

/**
 * 主入口：根据 archetype 名返回 BufferGeometry。
 * 所有几何已经预对齐：中心在 (0,0,0)，朝向沿 +z 略前倾（让玩家看到正面）。
 * 缩放交给调用方根据 enemy.width / enemy.height 处理。
 */
export function createGeometryFor(archetype) {
    switch (archetype) {
        case 'bastion':     return _bastion();
        case 'maw':         return _maw();
        case 'deflector':   return _deflector();
        case 'echoSpire':   return _echoSpire();
        case 'echo_spire':  return _echoSpire();  // 兼容下划线写法
        case 'prism':       return _prism();
        case 'hive':        return _hive();
        case 'siege':       return _siege();
        case 'gravityWell': return _gravityWell();
        case 'gravity_core':return _gravityWell();
        case 'residue':     return _residue();
        default:            return _residue();
    }
}

/**
 * 按敌人 type ('normal' | 'elite' | 'boss') 返回 emissive 色（用在 shader uniform）。
 */
export function getTierColor(type) {
    if (type === 'boss')  return TIER_BOSS;
    if (type === 'elite') return TIER_ELITE;
    return TIER_NORMAL;
}

export const METAL_BASE_COLOR = METAL_BASE;

// ============================================================
// 几何工厂（每个返回一个 BufferGeometry，单位长方体大小 = (1, 1, 1)，
// 由 EnemyMeshPool 用 scale 拉伸到 (enemy.width, enemy.height, depth)）
// ============================================================

function _bastion() {
    // 横躺六棱柱：长(x) > 厚(y) ≈ 深(z)
    // 默认 CylinderGeometry 沿 y 轴，我们旋转 90° 让它沿 x 轴方向
    const g = new THREE.CylinderGeometry(0.5, 0.5, 1, 6, 1);
    g.rotateZ(Math.PI / 2);  // 棱柱躺平：长轴 → x
    return g;
}

function _maw() {
    // 上下两个对顶圆锥（jaw 开合的暗示）
    const top = new THREE.ConeGeometry(0.5, 0.5, 5, 1);
    top.translate(0, 0.25, 0);
    const bot = new THREE.ConeGeometry(0.5, 0.5, 5, 1);
    bot.rotateZ(Math.PI);     // 倒置
    bot.translate(0, -0.25, 0);
    const merged = _mergeBuffer([top, bot]);
    return merged;
}

function _deflector() {
    // 斜楔：基于 BoxGeometry 把顶面四个 vertex 朝 +x 推
    const g = new THREE.BoxGeometry(1, 1, 1);
    const pos = g.attributes.position;
    for (let i = 0; i < pos.count; i++) {
        if (pos.getY(i) > 0) pos.setX(i, pos.getX(i) + 0.35);
    }
    pos.needsUpdate = true;
    g.computeVertexNormals();
    return g;
}

function _echoSpire() {
    // 双层金字塔（底层四棱锥，顶层小一些）
    const lower = new THREE.ConeGeometry(0.5, 0.55, 4, 1);
    lower.translate(0, -0.225, 0);
    const upper = new THREE.ConeGeometry(0.3, 0.45, 4, 1);
    upper.translate(0, 0.275, 0);
    return _mergeBuffer([lower, upper]);
}

function _prism() {
    // 细长三棱柱（沿 y 轴）
    const g = new THREE.CylinderGeometry(0.45, 0.45, 1, 3, 1);
    // 略微沿 z 倾斜，给 fresnel 更复杂的表现
    g.rotateX(Math.PI / 28);
    return g;
}

function _hive() {
    // 二十面体（蜂巢质感）
    return new THREE.IcosahedronGeometry(0.55, 0);
}

function _siege() {
    // 方块基座 + 顶部小球（炮塔）
    const base = new THREE.BoxGeometry(1, 0.7, 1);
    base.translate(0, -0.15, 0);
    const turret = new THREE.SphereGeometry(0.32, 12, 8);
    turret.translate(0, 0.35, 0.0);
    return _mergeBuffer([base, turret]);
}

function _gravityWell() {
    // 中央球 + 一个扁平 Torus（笼状框架）
    const sphere = new THREE.SphereGeometry(0.30, 16, 12);
    const torus = new THREE.TorusGeometry(0.45, 0.05, 8, 24);
    torus.rotateX(Math.PI / 2);  // 立成"光环"
    return _mergeBuffer([sphere, torus]);
}

function _residue() {
    // 默认方块（圆角化通过 segments 实现 cheaper）
    const g = new THREE.BoxGeometry(0.9, 0.9, 0.9);
    return g;
}

// ============================================================
// 合并多个 BufferGeometry 为一个（轻量替代 BufferGeometryUtils.mergeGeometries）
// 当前用法都是简单合并，不需要 indexed 转换
// ============================================================
function _mergeBuffer(geoms) {
    let totalPos = 0;
    let totalIdx = 0;
    for (const g of geoms) {
        totalPos += g.attributes.position.count;
        if (g.index) totalIdx += g.index.count;
    }
    const positions = new Float32Array(totalPos * 3);
    const normals   = new Float32Array(totalPos * 3);
    const indices   = totalIdx > 0 ? new Uint32Array(totalIdx) : null;

    let pOff = 0, iOff = 0, vOff = 0;
    for (const g of geoms) {
        const p = g.attributes.position.array;
        const n = g.attributes.normal ? g.attributes.normal.array : null;
        positions.set(p, pOff * 3);
        if (n) normals.set(n, pOff * 3);
        if (indices && g.index) {
            const ix = g.index.array;
            for (let i = 0; i < ix.length; i++) indices[iOff + i] = ix[i] + vOff;
            iOff += ix.length;
        }
        pOff += g.attributes.position.count;
        vOff = pOff;
        g.dispose();
    }
    const merged = new THREE.BufferGeometry();
    merged.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    merged.setAttribute('normal',   new THREE.BufferAttribute(normals, 3));
    if (indices) merged.setIndex(new THREE.BufferAttribute(indices, 1));
    merged.computeVertexNormals();
    return merged;
}
