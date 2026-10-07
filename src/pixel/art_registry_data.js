/**
 * src/pixel/art_registry_data.js — 程序化图标的数据表（纯数据，Node 可直接导入测试）
 *
 * - SKILL_GLYPH / SKILL_RAMP：技能印记用的字形与元素色阶（技能名的元素与 ATTRIBUTE_STYLE 同色）。
 * - EMOJI_ICON：界面文字里出现的彩色 emoji → [字形, 色阶]。像素模式下这些 emoji 一律换成
 *   7×7 点阵图标（系统彩色 emoji 与像素画不是同一种画法，旧 UI 的一致性问题之一）。
 *   箭头、几何符号等单色文字符号不在表内，按普通文字渲染。
 * @module pixel/art_registry_data
 */

export const SKILL_GLYPH = Object.freeze({
    skill_frost_prison: 'snow',
    skill_thunder_call: 'bolt',
    skill_kinetic_burst: 'burst',
    skill_meltdown_nova: 'flame',
    skill_blade_rain: 'sword',
    skill_prismatic_shot: 'beam',
    skill_arcane_missiles: 'star',
    skill_kinetic_charge: 'battery',
    skill_frost_nova_burst: 'burst',
    skill_irradiate_field: 'spores',
    skill_flame_sword_dance: 'flysword',
    skill_static_field: 'rings',
    skill_precision_volley: 'arrow',
    skill_gravity_well: 'nested',
    skill_chrono_freeze: 'hourglass',
    skill_phoenix_blessing: 'up',
    skill_meteor_strike: 'down',
    skill_prism_overload: 'star',
    skill_fortune_strike: 'coin',
});

const SKILL_RAMP = Object.freeze({
    skill_frost_prison: 'ice',
    skill_thunder_call: 'volt',
    skill_kinetic_burst: 'mint',
    skill_meltdown_nova: 'fire',
    skill_blade_rain: 'slate',
    skill_prismatic_shot: 'rose',
    skill_arcane_missiles: 'arcane',
    skill_kinetic_charge: 'volt',
    skill_frost_nova_burst: 'ice',
    skill_irradiate_field: 'venom',
    skill_flame_sword_dance: 'fire',
    skill_static_field: 'cyan',
    skill_precision_volley: 'blood',
    skill_gravity_well: 'arcane',
    skill_chrono_freeze: 'mint',
    skill_phoenix_blessing: 'fire',
    skill_meteor_strike: 'fire',
    skill_prism_overload: 'rose',
    skill_fortune_strike: 'brass',
});

export function skillRampOf(id) {
    return SKILL_RAMP[id] || 'cyan';
}

/** emoji（去掉 U+FE0F 变体符）→ [字形, 色阶] */
export const EMOJI_ICON = Object.freeze({
    '⚡': ['bolt', 'volt'], '🔥': ['flame', 'fire'], '🔮': ['gem', 'arcane'], '❄': ['snow', 'ice'], '❆': ['snow', 'ice'],
    '✨': ['star', 'volt'], '☠': ['skull', 'venom'], '💀': ['skull', 'slate'], '⚔': ['sword', 'slate'], '🗡': ['sword', 'slate'],
    '🔱': ['trident', 'brass'], '🔦': ['beam', 'cyan'], '💥': ['burst', 'fire'], '🧨': ['burst', 'fire'], '💣': ['burst', 'slate'],
    '🎆': ['burst', 'arcane'], '☀': ['burst', 'volt'], '🔁': ['loop', 'ice'], '🔄': ['loop', 'mint'], '🔂': ['loop', 'ice'],
    '↩': ['loop', 'slate'], '⚗': ['flask', 'mint'], '🧪': ['flask', 'venom'], '💉': ['drop', 'mint'], '↗': ['arrow', 'blood'],
    '🌪': ['tornado', 'mint'], '🌀': ['tornado', 'arcane'], '💨': ['wave', 'slate'], '🌊': ['wave', 'ice'], '〰': ['wave', 'slate'],
    '⚠': ['warn', 'fire'], '❗': ['warn', 'blood'], '❓': ['question', 'slate'], '🔊': ['sound', 'ice'], '🎵': ['sound', 'arcane'],
    '🔇': ['mute', 'slate'], '🔔': ['bell', 'brass'], '📯': ['bell', 'brass'], '⏳': ['hourglass', 'mint'], '⌛': ['hourglass', 'brass'],
    '⏱': ['hourglass', 'blood'], '🛡': ['shield', 'ice'], '🔰': ['shield', 'venom'], '🌈': ['star', 'rose'], '🌟': ['star', 'volt'],
    '🎉': ['star', 'rose'], '🦋': ['star', 'ice'], '🎯': ['target', 'blood'], '🧭': ['target', 'brass'], '🦠': ['spores', 'venom'],
    '☢': ['spores', 'venom'], '☣': ['spores', 'venom'], '😡': ['flame', 'blood'], '👅': ['maw', 'blood'], '👹': ['maw', 'blood'],
    '👾': ['maw', 'arcane'], '🐉': ['maw', 'fire'], '🐍': ['maw', 'venom'], '⚙': ['gear', 'slate'], '🔧': ['gear', 'slate'],
    '🔨': ['gear', 'slate'], '⚒': ['gear', 'brass'], '🏗': ['gear', 'brass'], '☄': ['down', 'fire'], '📦': ['box', 'brass'],
    '🧰': ['box', 'brass'], '🎁': ['box', 'rose'], '🎟': ['box', 'blood'], '💾': ['box', 'cyan'], '💠': ['hex', 'cyan'],
    '🔷': ['hex', 'ice'], '🧩': ['hex', 'arcane'], '🪞': ['hex', 'ice'], '🧊': ['hex', 'ice'], '📺': ['hex', 'slate'],
    '🎮': ['hex', 'slate'], '💡': ['lamp', 'volt'], '⏩': ['speed', 'slate'], '💰': ['bag', 'brass'], '🎒': ['bag', 'brass'],
    '🕳': ['nested', 'arcane'], '🪆': ['nested', 'rose'], '🎡': ['rings', 'brass'], '🔗': ['rings', 'slate'], '📐': ['chart', 'slate'],
    '📉': ['chart', 'blood'], '📊': ['chart', 'cyan'], '🔢': ['chart', 'slate'], '〽': ['chart', 'cyan'], '🎬': ['chart', 'slate'],
    '💖': ['heart', 'rose'], '💗': ['heart', 'rose'], '❤': ['heart', 'blood'], '💔': ['heart', 'blood'], '💚': ['heart', 'venom'],
    '🦘': ['bounce', 'rose'], '📖': ['book', 'brass'], '📚': ['book', 'arcane'], '📘': ['book', 'ice'], '🎰': ['dice', 'brass'],
    '🎲': ['dice', 'slate'], '🔋': ['battery', 'volt'], '🩸': ['drop', 'blood'], '🥚': ['drop', 'slate'], '🧆': ['drop', 'brass'],
    '🌡': ['drop', 'fire'], '🧬': ['clone', 'venom'], '♊': ['clone', 'ice'], '🌩': ['bolt', 'arcane'], '🌋': ['flame', 'fire'],
    '🏆': ['trophy', 'brass'], '🍃': ['leaf', 'mint'], '🌿': ['leaf', 'venom'], '🕊': ['up', 'slate'], '⬆': ['up', 'slate'],
    '👆': ['up', 'slate'], '⬅': ['left', 'slate'], '➡': ['right', 'slate'], '🧱': ['floor', 'slate'], '⬜': ['floor', 'slate'],
    '🚜': ['ram', 'brass'], '🚛': ['ram', 'slate'], '🏰': ['house', 'slate'], '🏛': ['house', 'brass'], '🏚': ['house', 'stone'],
    '🏠': ['house', 'brass'], '🔭': ['eye', 'cyan'], '👁': ['eye', 'arcane'], '🗝': ['key', 'brass'], '🔒': ['key', 'slate'],
    '🌌': ['moon', 'arcane'], '🌑': ['moon', 'slate'], '✅': ['check', 'venom'], '⚪': ['dot', 'slate'], '🔵': ['dot', 'ice'],
    '🟢': ['dot', 'venom'], '🟡': ['dot', 'volt'], '🟣': ['dot', 'arcane'], '🪙': ['coin', 'brass'], '💎': ['gem', 'cyan'],
});

/** 文本中的 emoji 序列匹配（基字 + 可选变体符/肤色/零宽连接序列） */
export const EMOJI_RE = /(?:\p{Extended_Pictographic}|[☀-➿])(?:️|‍(?:\p{Extended_Pictographic}|[☀-➿])️?)*/gu;

/** 取 emoji 的图标规格；不在表内返回 null（保留为文字） */
export function emojiIconSpec(seq) {
    if (!seq) return null;
    const base = seq.replace(/️/g, '').split('‍')[0];
    return EMOJI_ICON[base] || null;
}
