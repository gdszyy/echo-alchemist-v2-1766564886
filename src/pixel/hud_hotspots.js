/**
 * src/pixel/hud_hotspots.js — 画布 HUD 的透明 DOM 热区
 *
 * 画布负责外观；可点区域生成同位置的透明 <button>：
 * - 键盘可聚焦、带 aria-label（不可用时 aria-disabled + 原因）；
 * - 点击复用原有处理函数：target 选择器 → 触发原 DOM 按钮的 click()，或直接调用 action；
 * - mousedown / touchstart 不冒泡，避免同时触发画布瞄准。
 * 只有可操作项生成按钮；纯信息项（info）仅用于读屏摘要。
 * @module pixel/hud_hotspots
 */

let _root = null;
const _nodes = new Map();
let _lastSig = '';

function ensureRoot() {
    if (_root && _root.isConnected) return _root;
    const container = typeof document !== 'undefined' ? document.getElementById('game-container') : null;
    if (!container) return null;
    _root = document.createElement('div');
    _root.id = 'px-hud-hotspots';
    _root.setAttribute('aria-label', '战斗操作');
    container.appendChild(_root);
    return _root;
}

function makeButton(item) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'px-hotspot';
    const stop = (e) => e.stopPropagation();
    b.addEventListener('mousedown', stop);
    b.addEventListener('touchstart', stop, { passive: true });
    b.addEventListener('click', (e) => {
        e.stopPropagation();
        const cur = b.__item;
        if (!cur || cur.disabled) return;
        if (typeof cur.action === 'function') {
            cur.action();
        } else if (cur.target) {
            const el = document.querySelector(cur.target);
            if (el) el.click();
        }
    });
    return b;
}

/**
 * @param {object} game
 * @param {Array<{id:string,x:number,y:number,w:number,h:number,label:string,target?:string,action?:Function,disabled?:boolean,info?:boolean}>} items 缓冲像素坐标
 */
export function syncHotspots(game, items) {
    const root = ensureRoot();
    if (!root) return;
    const layout = game.pixelLayout;
    const sx = layout ? layout.sx : 1;
    const sy = layout ? layout.sy : 1;
    const actionable = items.filter((it) => !it.info);
    const sig = actionable.map((it) => `${it.id}:${it.x},${it.y},${it.w},${it.h},${it.disabled ? 1 : 0},${it.label}`).join('|');
    // 每帧刷新 action 闭包（技能对象可能换了），位置/文案只在变化时写 DOM
    for (const it of actionable) {
        const node = _nodes.get(it.id);
        if (node) node.__item = it;
    }
    if (sig === _lastSig) return;
    _lastSig = sig;
    const keep = new Set();
    for (const it of actionable) {
        keep.add(it.id);
        let node = _nodes.get(it.id);
        if (!node) {
            node = makeButton(it);
            _nodes.set(it.id, node);
            root.appendChild(node);
        }
        node.__item = it;
        node.style.left = `${(it.x / sx).toFixed(2)}px`;
        node.style.top = `${(it.y / sy).toFixed(2)}px`;
        node.style.width = `${(it.w / sx).toFixed(2)}px`;
        node.style.height = `${(it.h / sy).toFixed(2)}px`;
        node.setAttribute('aria-label', it.label);
        node.title = it.label;
        node.setAttribute('aria-disabled', it.disabled ? 'true' : 'false');
        node.dataset.hotspot = it.id;
    }
    for (const [id, node] of _nodes) {
        if (!keep.has(id)) {
            node.remove();
            _nodes.delete(id);
        }
    }
}
