/**
 * src/pixel/icon_html.js — 菜单模板里的「物品图标」：像素模式给程序化像素图，位图模式原样返回旧图标文字
 *
 * 旧模板用文字/emoji 当图标（模块是 'R'、'▦' 之类的字母符号，商品是 emoji）。像素模式下按物品语义
 * 取像素图标：模块 → 钉阵石板，符文 → 符文石，技能 → 技能印记，弹珠包 → 行囊，槽位 → 槽位物件。
 * @module pixel/icon_html
 */
import { isPixelArtMode } from '../render/art_mode.js';
import { moduleArt, runeArt, skillArt, objectArt, relicArt, emojiArt } from './art_registry.js';

function resolve(spec) {
    switch (spec && spec.kind) {
        case 'module': return moduleArt(spec.id, spec.rarity);
        case 'rune': return runeArt(spec.element, spec.level);
        case 'skill': return skillArt(spec.id);
        case 'relic': return relicArt(spec.id, spec.emoji);
        case 'object': return objectArt(spec.name, spec.ramp, spec.extra);
        case 'emoji': return emojiArt(spec.emoji);
        default: return null;
    }
}

/**
 * @param {object} spec 物品语义（kind + id/element/name…）
 * @param {string} fallback 位图模式（或无像素图标时）原样输出的图标文字
 * @param {string} [cls] 像素图标的 class（尺寸由 pixel_theme.css 定义）
 */
export function pxIconHtml(spec, fallback, cls = 'px-item-icon') {
    if (!isPixelArtMode()) return fallback;
    const e = resolve(spec);
    if (!e) return fallback;
    return `<img class="${cls}" src="${e.url}" alt="" aria-hidden="true" draggable="false">`;
}

/** 局内商店商品 → 图标语义 */
export function runShopItemIconSpec(it) {
    switch (it && it.kind) {
        case 'module': return { kind: 'module', id: it.moduleId, rarity: it.rarity };
        case 'rune': return { kind: 'rune', element: it.element, level: Number((/_(\d)$/.exec(it.runeId || '') || [])[1]) || 1 };
        case 'skill_unlock': return { kind: 'skill', id: it.skillId };
        case 'marble_pack': return { kind: 'object', name: 'bag' };
        case 'starter_boost': return { kind: 'object', name: 'crate', ramp: 'brass', extra: 'star' };
        case 'slot_expand': return { kind: 'object', name: 'slots', ramp: 'cyan' };
        case 'slot_unlock': return { kind: 'object', name: 'key', ramp: 'brass' };
        case 'slot_count': return { kind: 'object', name: 'slots', ramp: 'brass' };
        default: return null;
    }
}
