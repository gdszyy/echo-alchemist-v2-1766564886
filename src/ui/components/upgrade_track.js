/**
 * upgrade_track.js - 升级轨（主炮三轨 / 挖矿升级）：图标 + 名称 + 当前值 + 等级格 + 价格按钮。
 * @param {{ icon:string, label:string, value?:string, level:number, max:number,
 *   price?:{energy?:number, crystal?:number}|null, have?:{energy:number, crystal:number},
 *   locked?:boolean, lockedText?:string, onBuy?:Function, id?:string, element?:string }} props
 *   price 为 null 且未锁定 = 已满级。
 */
import { el, append } from './_dom.js';
import { createButton } from './button.js';
import { createPriceTag } from './price_tag.js';
import { createGlyphTile } from './slot_card.js';

export function createUpgradeTrack({ icon = '?', label = '', value = '', level = 0, max = 1, price = null, have = { energy: 0, crystal: 0 }, locked = false, lockedText = '未解锁', onBuy = null, id = null, element = '' } = {}) {
    const row = el('div', `ui-track${locked ? ' is-locked' : ''}`, { id });
    append(row, createGlyphTile({ glyph: locked ? '?' : icon, element: locked ? '' : element }));
    const info = el('div', 'ui-track__info');
    append(info, el('span', 'ui-track__label', { text: label }));
    if (value) append(info, el('span', 'ui-track__value', { text: value }));
    const pips = el('span', 'ui-track__pips', { 'aria-label': `${level}/${max}` });
    for (let i = 0; i < max; i++) append(pips, el('i', `ui-pip${i < level ? ' is-on' : ''}`));
    append(info, pips);
    row.appendChild(info);
    const maxed = !locked && !price;
    const affordable = !!price && (have.energy >= (price.energy || 0)) && (have.crystal >= (price.crystal || 0));
    const priceTag = locked
        ? createPriceTag({ text: lockedText })
        : maxed
            ? createPriceTag({ text: '已满' })
            : createPriceTag({ energy: price.energy || 0, crystal: price.crystal || 0, haveEnergy: have.energy, haveCrystal: have.crystal });
    append(row, createButton({
        variant: affordable ? 'default' : 'ghost',
        className: 'ui-track__buy',
        disabled: locked || maxed || !affordable,
        title: locked ? lockedText : (maxed ? '已满级' : (affordable ? `购买：${label}` : '资源不足')),
        children: [priceTag],
        onClick: onBuy,
        dataset: id ? { buy: id } : null,
    }));
    return row;
}
