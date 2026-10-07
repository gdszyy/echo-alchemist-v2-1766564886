/**
 * src/pixel/dom_cards.js — 像素模式的菜单卡片（DOM），内容与画布 HUD 同一口径
 *
 * 子弹卡（替换弹药页）：旧卡片只在底部列出属性层数，并把「基础伤害」当成「增幅」层数显示
 * （recipe.damage 是子弹基础伤害，不是增幅层数）；像素卡改为：
 *   形态名（基础弹 / 复合弹 / 光束炮…）+ 稀有度 → 基础伤害（与战斗 HUD「本发 · 基础」同一数）
 *   + 连射发数 → 全部属性（图标 + 名称 + 层数）→ 特殊标记（套娃 / 七彩）。
 * 外观只用像素组件（pixel_theme.css 的 .px-ammo-card 规则）与程序化图标。
 * @module pixel/dom_cards
 */
import { getAmmoReadabilityProfile } from '../utils/ammo_readability.js';
import { ATTRIBUTE_STYLE } from './icons.js';
import { attributeArt, marbleArt, namedGlyphArt } from './art_registry.js';

export const TIER_LABEL = Object.freeze(['普通', '稀有', '史诗', '传说']);
const TIER_KEY = ['C', 'B', 'A', 'S'];

function el(tag, cls, text) {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
}

function icon(url, cls = 'px-ammo-card__icon') {
    const i = el('img', cls);
    i.src = url || '';
    i.alt = '';
    i.setAttribute('aria-hidden', 'true');
    i.draggable = false;
    return i;
}

/**
 * @param {object} o
 * @param {object} o.recipe 子弹配方
 * @param {boolean} o.selected
 * @param {number} o.tier 0..3（C/B/A/S）
 * @param {string} o.mainAttrKey 主属性（决定弹珠颜色）
 * @param {() => void} o.onToggle
 */
export function buildPixelAmmoCard({ recipe, selected, tier, mainAttrKey, onToggle }) {
    const p = getAmmoReadabilityProfile(recipe);
    const card = el('div', `replace-ammo-card px-ammo-card${selected ? ' is-selected' : ''}`);
    card.dataset.tier = TIER_KEY[tier] || 'C';
    card.tabIndex = 0;
    card.setAttribute('role', 'button');
    card.setAttribute('aria-pressed', selected ? 'true' : 'false');

    const marbleType = recipe._marbleType || recipe.type || mainAttrKey || 'white';
    const head = el('div', 'px-ammo-card__head');
    const mUrl = marbleArt(marbleType === 'normal' ? 'white' : marbleType);
    head.appendChild(icon(mUrl && mUrl.url, 'px-ammo-card__marble'));
    const title = el('div', 'px-ammo-card__title');
    const primary = p.entries[0];
    title.appendChild(el('div', 'px-ammo-card__name', primary ? `${primary.name}·${p.shapeLabel}` : p.shapeLabel));
    title.appendChild(el('div', `px-ammo-card__tier tier-${card.dataset.tier}`, TIER_LABEL[tier] || TIER_LABEL[0]));
    head.appendChild(title);
    card.appendChild(head);

    const dmg = el('div', 'px-ammo-card__dmg');
    const sword = namedGlyphArt('sword', 'arcane');
    dmg.appendChild(icon(sword && sword.url));
    dmg.appendChild(el('b', '', String(p.damage)));
    dmg.appendChild(el('span', 'px-ammo-card__dim', '基础伤害'));
    if (p.multicastCount > 1) dmg.appendChild(el('b', 'px-ammo-card__mc', `×${p.multicastCount}`));
    card.appendChild(dmg);

    const list = el('ul', 'px-ammo-card__attrs');
    const rows = p.entries.map((e) => ({ key: e.key, name: (ATTRIBUTE_STYLE[e.key] || {}).name || e.name, value: String(Math.round(e.value)) }));
    if (recipe.isMatryoshka) rows.push({ key: 'matryoshka', name: ATTRIBUTE_STYLE.matryoshka.name, value: '✓' });
    if (recipe.type === 'rainbow' || recipe._marbleType === 'rainbow') rows.push({ key: 'rainbow', name: ATTRIBUTE_STYLE.rainbow.name, value: '✓' });
    if (!rows.length) list.appendChild(el('li', 'px-ammo-card__empty', '无属性'));
    rows.forEach((r) => {
        const li = el('li', 'px-ammo-card__attr');
        const a = attributeArt(r.key);
        li.appendChild(icon(a && a.url));
        li.appendChild(el('span', '', r.name));
        li.appendChild(el('b', '', r.value));
        list.appendChild(li);
    });
    card.appendChild(list);

    if (selected) card.appendChild(el('div', 'px-ammo-card__badge', '已选'));
    card.title = selected ? '已选择，点击或按 Enter 取消' : '点击或按 Enter 选择这枚子弹';
    card.onclick = onToggle;
    card.onkeydown = (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onToggle();
        }
    };
    return card;
}
