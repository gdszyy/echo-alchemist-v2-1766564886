/**
 * panel.js - 像素 9 宫格面板（.ui-panel）。
 * @param {{ title?:string, hint?:string, className?:string, id?:string, children?:Node[] }} props
 */
import { el, append } from './_dom.js';

export function createPanel({ title = '', hint = '', className = '', id = null, children = [] } = {}) {
    const panel = el('section', `ui-panel ${className}`.trim(), { id });
    if (title || hint) {
        const head = el('header', 'ui-panel__head');
        if (title) append(head, el('h3', 'ui-panel__title', { text: title }));
        if (hint) append(head, el('span', 'ui-panel__hint', { text: hint }));
        panel.appendChild(head);
    }
    const body = el('div', 'ui-panel__body');
    append(body, children);
    panel.appendChild(body);
    return panel;
}
