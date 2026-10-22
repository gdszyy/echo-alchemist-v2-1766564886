/**
 * modal.js - 弹层（.ui-modal，层级 --z-popover）。挂在调用方给的宿主里（同一 DOM 树，不搬 DOM）。
 * @param {{ title:string, body?:Node[]|string, actions?:Node[], id?:string }} props
 */
import { el, append } from './_dom.js';

export function createModal({ title = '', body = [], actions = [], id = null } = {}) {
    const backdrop = el('div', 'ui-modal', { id, role: 'dialog', 'aria-modal': 'true', 'aria-label': title });
    const card = el('div', 'ui-modal__card ui-panel');
    if (title) append(card, el('h3', 'ui-modal__title', { text: title }));
    const content = el('div', 'ui-modal__body');
    if (typeof body === 'string') content.textContent = body;
    else append(content, body);
    card.appendChild(content);
    if (actions.length) {
        const row = el('div', 'ui-modal__actions');
        append(row, actions);
        card.appendChild(row);
    }
    backdrop.appendChild(card);
    return backdrop;
}
