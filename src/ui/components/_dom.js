/**
 * _dom.js - [REQ-20261022-wave-loop S2] 组件库共用的极小 DOM 帮手（无依赖）。
 * 组件约定：每个 create*(props) 返回一个新 HTMLElement，不持有全局状态、不读 Game 实例；
 * 事件回调通过 props 传入。样式全部在 src/styles/ui_components.css（只读 ui_tokens.css 变量）。
 */
export function el(tag, className = '', attrs = {}) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    for (const [k, v] of Object.entries(attrs || {})) {
        if (v === undefined || v === null || v === false) continue;
        if (k === 'text') node.textContent = String(v);
        else if (k === 'dataset') Object.assign(node.dataset, v);
        else node.setAttribute(k, v === true ? '' : String(v));
    }
    return node;
}

export function append(parent, ...children) {
    for (const c of children.flat()) {
        if (c === null || c === undefined || c === false) continue;
        parent.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
    }
    return parent;
}
