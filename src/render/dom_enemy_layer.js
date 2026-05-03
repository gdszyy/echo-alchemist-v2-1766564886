/**
 * dom_enemy_layer.js — DOM/CSS 敌人图层（石像 golem 风）
 *
 * 职责：
 *   - 维护 #enemy-dom-layer 下的 .enemy DOM 节点池，与 game.enemies 数组同步
 *   - 每帧把敌人状态（位置 / HP 三层 / 温度 / 状态机 / HP-tier / 注视）
 *     写到 CSS 变量与 data 属性
 *   - 把全局 screenShake 同步到图层 transform，与 canvas 震屏一致
 *
 * 与 canvas 的边界：
 *   - 当 CONFIG.enemyRender.domRendererEnabled 且 enemy.type ∈ domRendererTypes 时，
 *     enemy.draw() 内部会跳过 canvas 上的本体绘制（HP / 状态层走 DOM）。
 *   - 子弹、粒子、词缀光环、boss 入场等仍由 canvas 绘制。
 */

import { CONFIG } from '../config.js';

const ENEMY_LAYER_ID = 'enemy-dom-layer';
const NODE_KEY = '__domEnemyNode';

/** 把 [-34, +34] 范围的 enemy.temp 归一到 [-1, 1]，用于 CSS hue 与 hp-color 计算 */
function _normalizeTemp(temp) {
    if (typeof temp !== 'number' || !temp) return 0;
    const max = 34;
    return Math.max(-1, Math.min(1, temp / max));
}

/** HP 比 → tier */
function _hpTier(ratio) {
    if (ratio <= 0.3) return 'low';
    if (ratio <= 0.7) return 'mid';
    return 'high';
}

export class DomEnemyLayer {
    constructor() {
        this.container = document.getElementById(ENEMY_LAYER_ID);
        this.enabled = !!(CONFIG.enemyRender && CONFIG.enemyRender.domRendererEnabled);
        this.allowedTypes = new Set(
            (CONFIG.enemyRender && CONFIG.enemyRender.domRendererTypes) || []
        );

        if (!this.container) {
            console.warn('[DomEnemyLayer] #enemy-dom-layer not found in DOM. Disabled.');
            this.enabled = false;
            return;
        }
        if (!this.enabled) this.container.classList.add('is-disabled');

        /** @type {WeakMap<object, HTMLElement>} enemy → DOM 节点 */
        this._nodes = new WeakMap();
        /** @type {Set<HTMLElement>} 已分配（活跃）的节点 */
        this._activeNodes = new Set();
        /** @type {HTMLElement[]} 空闲节点池 */
        this._freePool = [];
    }

    shouldRender(enemy) {
        if (!this.enabled) return false;
        if (!enemy || enemy.active === false) return false;
        if (!this.allowedTypes.has(enemy.type)) return false;
        // Boss 入场动画期间不接管，让 canvas 画 entrance（与 enemy.draw 早退条件对偶）
        if (enemy.type === 'boss' && (enemy.entranceTimer > 0 || enemy._pendingEntrance)) {
            return false;
        }
        return true;
    }

    /**
     * 每帧同步。
     * @param {Array<object>} enemies
     * @param {object} [game] 可选；用于读取 screenShake 等全局状态
     */
    sync(enemies, game) {
        if (!this.enabled) return;

        // 全屏震屏与 canvas 保持一致（canvas 每帧 ctx.translate(shakeX, shakeY)）
        if (game && this.container) {
            // game.sys_loop 中 shakeX/Y 是局部变量；
            // 这里用 game.screenShake 强度 + Math.random 复现近似抖动。
            const shake = (typeof game.screenShake === 'number') ? game.screenShake : 0;
            if (shake > 0.5) {
                const sx = (Math.random() - 0.5) * shake;
                const sy = (Math.random() - 0.5) * shake;
                this.container.style.setProperty('--shake-x', `${sx.toFixed(1)}px`);
                this.container.style.setProperty('--shake-y', `${sy.toFixed(1)}px`);
            } else if (this.container.style.getPropertyValue('--shake-x') !== '0px') {
                this.container.style.setProperty('--shake-x', '0px');
                this.container.style.setProperty('--shake-y', '0px');
            }
        }

        const stillActive = new Set();
        for (const e of enemies) {
            if (!this.shouldRender(e)) continue;
            if (e.pos.y < -e.height) continue; // boss 入场之类的屏外位置

            let node = this._nodes.get(e);
            if (!node) {
                node = this._acquireNode();
                this._nodes.set(e, node);
                this._initNodeForEnemy(node, e);
            }
            this._updateNode(node, e);
            stillActive.add(node);
        }

        // 回收离场节点
        for (const node of this._activeNodes) {
            if (!stillActive.has(node)) this._releaseNode(node);
        }
        this._activeNodes = stillActive;
    }

    setEnabled(flag) {
        this.enabled = !!flag;
        if (!this.container) return;
        this.container.classList.toggle('is-disabled', !this.enabled);
        if (!this.enabled) {
            for (const node of this._activeNodes) this._releaseNode(node);
            this._activeNodes.clear();
        }
    }

    // ──────────────────────────────────────────────────────────────
    // 节点池
    // ──────────────────────────────────────────────────────────────

    _acquireNode() {
        const node = this._freePool.pop() || this._createNode();
        node.style.display = '';
        node[NODE_KEY] = true;
        this.container.appendChild(node);
        this._activeNodes.add(node);
        return node;
    }

    _releaseNode(node) {
        node.style.display = 'none';
        node.dataset.state = 'idle';
        this._freePool.push(node);
    }

    _createNode() {
        const root = document.createElement('div');
        root.className = 'enemy';
        root.dataset.state = 'idle';
        root.dataset.tier = 'normal';
        root.dataset.hpTier = 'high';
        root.dataset.idleVariant = '0';
        // 顺序：阴影 → 身体（含纹理）→ HP 三层 → 裂纹 → 面孔（眼睛在最上）
        root.innerHTML = `
            <div class="enemy__shadow"></div>
            <div class="enemy__body"></div>
            <div class="enemy__hp-slot">
                <div class="enemy__hp-green"></div>
                <div class="enemy__hp-delayed"></div>
                <div class="enemy__hp-fill"></div>
            </div>
            <div class="enemy__cracks"></div>
            <div class="enemy__face">
                <div class="enemy__eye enemy__eye--l"></div>
                <div class="enemy__eye enemy__eye--r"></div>
            </div>
        `.trim();
        return root;
    }

    _initNodeForEnemy(node, enemy) {
        const seed = (enemy.visualSeed != null) ? enemy.visualSeed : Math.random();
        node.style.setProperty('--breathe-delay', `${(seed * 2.6).toFixed(2)}s`);

        // 静态倾斜：弧度转 deg
        const tiltDeg = (enemy._staticTilt || 0) * (180 / Math.PI);
        node.style.setProperty('--tilt', `${tiltDeg.toFixed(2)}deg`);

        node.dataset.tier = enemy.type || 'normal';
        // Boss 类型主题（ignis / glacies / mikro / devourer / viridis / tesla / chimera / ouroboros）
        if (enemy.type === 'boss' && enemy.bossType) {
            node.dataset.bossType = enemy.bossType;
        } else {
            delete node.dataset.bossType;
        }

        // idle 变体 0 / 1 / 2，基于 seed 稳定分配（同一敌人始终同一变体）
        node.dataset.idleVariant = String(Math.floor(seed * 3) % 3);

        // 形状：与 collisionShape 严格对齐
        // - aabb（默认）→ 矩形 + 6px 倒角（CSS 缺省，--clip-path 不写）
        // - polygon     → 用碰撞顶点生成 clip-path（视觉与反弹边界一致）
        // - arc         → 仅 boss 用，PoC 不处理
        const clipPath = this._buildClipPathFromCollision(enemy);
        if (clipPath) {
            node.style.setProperty('--clip-path', clipPath);
            node.dataset.shape = enemy.collisionShape;
        } else {
            node.style.removeProperty('--clip-path');
            node.dataset.shape = enemy.collisionShape || 'aabb';
        }
    }

    /**
     * 把 enemy.collisionData.vertices（相对于敌人中心，单位 px）
     * 转成 clip-path: polygon(...%) —— 比例化到敌人的 width × height。
     * @returns {string|null} 形如 "polygon(50% 0%, 100% 100%, 0% 100%)"，无效返回 null
     */
    _buildClipPathFromCollision(enemy) {
        if (enemy.collisionShape !== 'polygon') return null;
        const cd = enemy.collisionData;
        if (!cd || !Array.isArray(cd.vertices) || cd.vertices.length < 3) return null;
        const w = enemy.width;
        const h = enemy.height;
        if (!w || !h) return null;
        const parts = [];
        for (const v of cd.vertices) {
            const xPct = ((v.x + w / 2) / w) * 100;
            const yPct = ((v.y + h / 2) / h) * 100;
            parts.push(`${xPct.toFixed(2)}% ${yPct.toFixed(2)}%`);
        }
        return `polygon(${parts.join(', ')})`;
    }

    // ──────────────────────────────────────────────────────────────
    // 每帧更新
    // ──────────────────────────────────────────────────────────────

    _updateNode(node, enemy) {
        const w = enemy.width;
        const h = enemy.height;

        const x = enemy.pos.x;
        const y = enemy.pos.y + (enemy.bumpOffsetY || 0);

        const style = node.style;
        style.setProperty('--x', `${x.toFixed(1)}px`);
        style.setProperty('--y', `${y.toFixed(1)}px`);
        style.setProperty('--w', `${w}px`);
        style.setProperty('--h', `${h}px`);

        // ─── HP 三层（与原 canvas Layer 2 视觉一致）───
        const hp        = enemy.displayHp != null ? enemy.displayHp : enemy.hp;
        const delayedHp = enemy.delayedHp != null ? enemy.delayedHp : hp;
        const greenHp   = enemy.greenHp   != null ? enemy.greenHp   : hp;
        const maxHp = enemy.maxHp || 1;
        const hpRatio        = Math.max(0, Math.min(1, hp / maxHp));
        const delayedRatio   = Math.max(0, Math.min(1, delayedHp / maxHp));
        const greenRatio     = Math.max(0, Math.min(1, greenHp   / maxHp));
        style.setProperty('--hp',         hpRatio.toFixed(3));
        style.setProperty('--hp-delayed', delayedRatio.toFixed(3));
        style.setProperty('--hp-green',   greenRatio.toFixed(3));

        // 温度归一 → CSS hue 偏移
        style.setProperty('--temp', _normalizeTemp(enemy.temp).toFixed(3));

        // 注视方向
        const look = this._computeLookDirection(enemy);
        style.setProperty('--look-x', look.x.toFixed(2));
        style.setProperty('--look-y', look.y.toFixed(2));

        // HP tier（驱动 idle / hit 动画分档与配色）
        const hpTier = _hpTier(hpRatio);
        if (node.dataset.hpTier !== hpTier) node.dataset.hpTier = hpTier;

        // 状态机：dying > telegraph > frozen > hit > low > idle
        let state = 'idle';
        if (!enemy.active || enemy.hp <= 0) {
            state = 'dying';
        } else if (enemy.actionPhase === 'telegraphing') {
            state = 'telegraph';
        } else if (enemy.isFrozenCurrentTurn || (typeof enemy.temp === 'number' && enemy.temp <= -34)) {
            state = 'frozen';
        } else if (enemy.hitTimer > 0 || (enemy._hitImpact && enemy._hitImpact > 0.02)) {
            state = 'hit';
        } else if (hpRatio < 0.3) {
            state = 'low';
        }
        if (node.dataset.state !== state) node.dataset.state = state;

        // Affix 简化指示
        const affixes = enemy.affixes || [];
        this._setAffixFlag(node, 'shield', affixes.includes('shield') || (enemy.shieldCharges > 0));
        this._setAffixFlag(node, 'regen',  affixes.includes('regen'));
        this._setAffixFlag(node, 'haste',  affixes.includes('haste'));
    }

    _setAffixFlag(node, name, on) {
        const key = `affix${name.charAt(0).toUpperCase()}${name.slice(1)}`;
        const expected = on ? '1' : '0';
        if (node.dataset[key] !== expected) node.dataset[key] = expected;
    }

    _computeLookDirection(enemy) {
        const t = enemy._lookTarget;
        if (t && typeof t.x === 'number' && typeof t.y === 'number') {
            const dx = t.x - enemy.pos.x;
            const dy = t.y - enemy.pos.y;
            const m = Math.hypot(dx, dy) || 1;
            return {
                x: Math.max(-1, Math.min(1, dx / m)),
                y: Math.max(-1, Math.min(1, dy / m)),
            };
        }
        const now = performance.now() / 1000;
        const seed = enemy.visualSeed || 0.5;
        return {
            x: Math.sin(now * 0.7 + seed * 6.28) * 0.4,
            y: Math.cos(now * 0.5 + seed * 4.0) * 0.25,
        };
    }
}
