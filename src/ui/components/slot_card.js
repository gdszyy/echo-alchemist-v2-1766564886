/**
 * slot_card.js - 设施位卡片 + 占位图标块。
 *
 * createGlyphTile：**占位图标（PLACEHOLDER）**。正式 24×24 像素图标（显示 48 CSS px）到位前，
 * 用「字形 + 元素色底」方块代替；带 data-placeholder="true" 与 .ui-glyph--placeholder，便于后续批量替换。
 *
 * createSlotCard：state 'locked'（未开放）/ 'empty'（可建造）/ 'built'（已建：等级 + 冷却格）。
 */
import { el, append } from './_dom.js';
import { createCooldownCells } from './cooldown_cells.js';

export function createGlyphTile({ glyph = '?', element = '', placeholder = true, size = 'build' } = {}) {
    const tile = el('span', `ui-glyph ui-glyph--${size}${element ? ` ui-glyph--${element}` : ''}${placeholder ? ' ui-glyph--placeholder' : ''}`, {
        'aria-hidden': 'true',
        dataset: placeholder ? { placeholder: 'true' } : undefined,
    });
    tile.textContent = glyph;
    return tile;
}

export function createSlotCard({ state = 'empty', glyph = '+', element = '', title = '', level = 0, cooldown = null, cooldownMax = null, footer = null, actions = [], slotIndex = 0, pulse = false, size = 'build' } = {}) {
    const card = el('div', `ui-slot ui-slot--${state}${pulse ? ' is-pulse' : ''}`, { dataset: { slot: String(slotIndex) } });
    append(card, createGlyphTile({ glyph, element, size }));
    const info = el('div', 'ui-slot__info');
    append(info, el('span', 'ui-slot__title', { text: title }));
    if (state === 'built' && level > 0) append(info, el('span', 'ui-slot__level', { text: `Lv${level}` }));
    if (cooldownMax) append(info, createCooldownCells({ total: cooldownMax, remaining: cooldown || 0 }));
    if (footer) append(info, footer);
    card.appendChild(info);
    if (actions.length) {
        const act = el('div', 'ui-slot__actions');
        append(act, actions);
        card.appendChild(act);
    }
    return card;
}
