/**
 * price_tag.js - 价格标签（⚡ 能量 / 💎 晶核）。买不起时整体变暗，并给不足的那一项加删除线。
 * @param {{ energy?:number, crystal?:number, haveEnergy?:number, haveCrystal?:number, text?:string }} props
 *   text 优先（如「已满」「锁定」）。
 */
import { el, append } from './_dom.js';

export function createPriceTag({ energy = 0, crystal = 0, haveEnergy = Infinity, haveCrystal = Infinity, text = '' } = {}) {
    const tag = el('span', 'ui-price');
    if (text) {
        tag.classList.add('is-text');
        tag.textContent = text;
        return tag;
    }
    if (energy > 0) {
        append(tag, el('span', `ui-price__part ui-price__part--energy${haveEnergy < energy ? ' is-short' : ''}`, { text: `⚡${energy}` }));
    }
    if (crystal > 0) {
        append(tag, el('span', `ui-price__part ui-price__part--crystal${haveCrystal < crystal ? ' is-short' : ''}`, { text: `💎${crystal}` }));
    }
    if (energy <= 0 && crystal <= 0) tag.textContent = '免费';
    if (haveEnergy < energy || haveCrystal < crystal) tag.classList.add('is-unaffordable');
    return tag;
}
