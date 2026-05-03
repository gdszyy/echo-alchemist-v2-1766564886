/**
 * dom_enemy_layer.js — DOM/CSS 敌人图层（可爱风 PoC）
 *
 * 职责：
 *   - 维护 #enemy-dom-layer 下的 .enemy DOM 节点池，与 game.enemies 数组同步
 *   - 每帧把敌人状态（位置/HP/受击/冻结/预警/注视）写到 CSS 变量与 data 属性
 *   - 配合 enemy_dom.css，通过 CSS 实现所有动画与神态切换
 *
 * 与 canvas 的边界：
 *   - 当 CONFIG.enemyRender.domRendererEnabled 且 enemy.type ∈ domRendererTypes 时，
 *     enemy.draw() 内部会跳过 Layer 1（本体/材质/HP 槽/状态层）的 canvas 绘制；
 *   - 子弹、粒子、词缀光环、boss 入场等仍由 canvas 绘制。
 *
 * 使用：
 *   import { DomEnemyLayer } from './render/dom_enemy_layer.js';
 *   const layer = new DomEnemyLayer();        // 在 game-container 渲染初始化后构造
 *   layer.sync(this.enemies, this.width, this.height); // 每帧（在 enemy.update/draw 之后）调用
 *
 * 性能：
 *   - 节点池：敌人离场时 DOM 不立刻删除，只是 hidden + 标记 free，等下次 spawn 复用。
 *   - 每帧只更新 CSS 变量 / data-attribute；transform 通过 translate3d，GPU 合成层。
 */

import { CONFIG } from '../config.js';

const ENEMY_LAYER_ID = 'enemy-dom-layer';
const NODE_KEY = '__domEnemyNode';

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
        /** @type {Set<HTMLElement>} 已分配（活跃）的节点集合，用于离场清理 */
        this._activeNodes = new Set();
        /** @type {HTMLElement[]} 空闲节点池 */
        this._freePool = [];
    }

    /**
     * 当前敌人是否应该被 DOM 层接管？
     * @param {object} enemy
     * @returns {boolean}
     */
    shouldRender(enemy) {
        if (!this.enabled) return false;
        if (!enemy || enemy.active === false) return false;
        return this.allowedTypes.has(enemy.type);
    }

    /**
     * 每帧同步：根据 game.enemies 数组创建/更新/隐藏 DOM 节点
     * @param {Array<object>} enemies
     * @param {number} _width  未使用，保留接口
     * @param {number} _height 未使用，保留接口
     */
    sync(enemies, _width, _height) {
        if (!this.enabled) return;

        const stillActive = new Set();

        for (const e of enemies) {
            if (!this.shouldRender(e)) continue;
            if (e.pos.y < -e.height) continue; // 屏幕外（boss 入场之类）跳过

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

    /** 关闭整个图层（例如调试时切回纯 canvas 模式） */
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
        root.innerHTML = `
            <div class="enemy__shadow"></div>
            <div class="enemy__body"></div>
            <div class="enemy__cheeks"></div>
            <div class="enemy__eyes">
                <div class="enemy__eye enemy__eye--l"></div>
                <div class="enemy__eye enemy__eye--r"></div>
            </div>
            <div class="enemy__mouth"></div>
            <div class="enemy__hp"></div>
        `.trim();
        return root;
    }

    _initNodeForEnemy(node, enemy) {
        // 给眨眼/呼吸不同延迟，避免群体同步
        const seed = (enemy.visualSeed != null) ? enemy.visualSeed : Math.random();
        node.style.setProperty('--blink-delay', `${(seed * 4.8).toFixed(2)}s`);
        node.style.setProperty('--breathe-delay', `${(seed * 2.6).toFixed(2)}s`);
        // 静态倾斜：敌人构造时已有 _staticTilt（弧度），转为 deg
        const tiltDeg = (enemy._staticTilt || 0) * (180 / Math.PI);
        node.style.setProperty('--tilt', `${tiltDeg.toFixed(2)}deg`);
        node.dataset.tier = enemy.type || 'normal';
    }

    // ──────────────────────────────────────────────────────────────
    // 每帧更新
    // ──────────────────────────────────────────────────────────────

    _updateNode(node, enemy) {
        const w = enemy.width;
        const h = enemy.height;

        // 位置：canvas 1:1 映射到 game-container 像素
        // bumpOffsetY 是受击 / 入场偏移
        const x = enemy.pos.x;
        const y = enemy.pos.y + (enemy.bumpOffsetY || 0);

        const style = node.style;
        style.setProperty('--x', `${x.toFixed(1)}px`);
        style.setProperty('--y', `${y.toFixed(1)}px`);
        style.setProperty('--w', `${w}px`);
        style.setProperty('--h', `${h}px`);

        // HP 比例
        const hp = enemy.displayHp != null ? enemy.displayHp : enemy.hp;
        const hpRatio = Math.max(0, Math.min(1, hp / enemy.maxHp));
        style.setProperty('--hp', hpRatio.toFixed(3));

        // 注视方向：让瞳孔朝着最近的子弹（如果有）；否则随机微动
        const look = this._computeLookDirection(enemy);
        style.setProperty('--look-x', look.x.toFixed(2));
        style.setProperty('--look-y', look.y.toFixed(2));

        // 状态机：优先级 dying > telegraph > frozen > hit > low > idle
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

        // Affix 装饰（PoC 仅做几个最显眼的）
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

    /**
     * 计算瞳孔注视方向 ∈ [-1, 1]^2
     * 优先注视 actionPhase===telegraphing 时的红色目标，
     * 否则锁定最近的子弹（_lookTarget 由外部注入），
     * 否则用一个低频 wobble。
     */
    _computeLookDirection(enemy) {
        const t = enemy._lookTarget;
        if (t && typeof t.x === 'number' && typeof t.y === 'number') {
            const dx = t.x - enemy.pos.x;
            const dy = t.y - enemy.pos.y;
            const m = Math.hypot(dx, dy) || 1;
            return { x: Math.max(-1, Math.min(1, dx / m)), y: Math.max(-1, Math.min(1, dy / m)) };
        }
        const now = performance.now() / 1000;
        const seed = enemy.visualSeed || 0.5;
        return {
            x: Math.sin(now * 0.7 + seed * 6.28) * 0.4,
            y: Math.cos(now * 0.5 + seed * 4.0) * 0.25 - 0.15, // 略向下，更萌
        };
    }
}
