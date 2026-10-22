/**
 * button.js - 像素按钮（.ui-btn）。variant: 'default' | 'primary' | 'ghost' | 'danger'。
 * 触控热区 ≥ 40 CSS px（--tap-min）。disabled 时仍保留 title 说明原因。
 * @param {{ label?:string, sub?:string, variant?:string, disabled?:boolean, onClick?:Function,
 *   id?:string, title?:string, className?:string, children?:Node[], dataset?:object }} props
 */
import { el, append } from './_dom.js';

export function createButton({ label = '', sub = '', variant = 'default', disabled = false, onClick = null, id = null, title = null, className = '', children = [], dataset = null } = {}) {
    const btn = el('button', `ui-btn ui-btn--${variant} ${className}`.trim(), { type: 'button', id, title, dataset });
    if (label) append(btn, el('span', 'ui-btn__label', { text: label }));
    append(btn, children);
    if (sub) append(btn, el('span', 'ui-btn__sub', { text: sub }));
    btn.disabled = !!disabled;
    if (onClick) {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (!btn.disabled) onClick(e);
        });
    }
    return btn;
}
