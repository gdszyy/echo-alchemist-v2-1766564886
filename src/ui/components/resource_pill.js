/**
 * resource_pill.js - 资源胶囊（⚡ 能量 / 💎 晶核），数字用像素字体。
 * @param {{ kind:'energy'|'crystal', value:number, id?:string }} props
 */
import { el, append } from './_dom.js';

export function createResourcePill({ kind = 'energy', value = 0, id = null } = {}) {
    const pill = el('span', `ui-pill ui-pill--${kind}`, { id, title: kind === 'energy' ? '能量' : '晶核' });
    append(pill, el('span', 'ui-pill__icon', { text: kind === 'energy' ? '⚡' : '💎', 'aria-hidden': 'true' }));
    append(pill, el('b', 'ui-pill__value', { text: String(Math.max(0, Math.floor(value || 0))) }));
    return pill;
}
