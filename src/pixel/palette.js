/**
 * src/pixel/palette.js — 像素风唯一调色板（世界层与界面层共用）
 *
 * 规则（docs/design/pixel_art_mode.md §材质与色彩）：
 * - 每个色阶从暗到亮排列；暗部偏冷、亮部偏暖（像素画常规色阶做法）。
 * - 材质只从固定色阶取色：结构石材 slate、敌人磨石 stone、交互/重要边框 brass、
 *   能量与发光按元素色阶；描边统一 INK。
 * - 新颜色先找现有色阶；确需新增时整条色阶一起加，不零散加单色。
 * @module pixel/palette
 */

export const INK = '#07060c';      // 统一描边 / 最深阴影
export const VOID = '#0c0b14';     // 场景最暗底色

export const RAMPS = Object.freeze({
    // 冷灰石：场景结构、面板底、墙体
    slate: ['#0f1218', '#181d25', '#232a34', '#313a46', '#46505d', '#606b79', '#828d9a', '#a9b2bc', '#d4dae0', '#f0f3f5'],
    // 磨石（深灰黑曜石）：敌人基座——暗部偏冷紫、亮部微暖，低饱和
    stone: ['#121016', '#1d1a21', '#2a262e', '#3a353d', '#4e474f', '#665e63', '#857b7c', '#aa9f9b'],
    // 黄铜：可交互元素与重要框线的唯一金属
    brass: ['#2c1a0a', '#4f3212', '#7a4e14', '#a87418', '#d29c2a', '#efc75a', '#fde9a6'],
    // 元素/能量色阶
    fire: ['#3d110d', '#76220f', '#ad3f12', '#dd6c19', '#f99b2a', '#ffcf5e', '#fff3c8'],
    blood: ['#2a0710', '#560f1f', '#8c1d2e', '#c13a3c', '#e8685c', '#fba494'],
    cyan: ['#03202a', '#06404f', '#0a6878', '#1497a6', '#3ec6cc', '#86ecea', '#d2fffb'],
    ice: ['#16244a', '#24478a', '#336fc4', '#509fec', '#8fcbff', '#d8f0ff'],
    arcane: ['#1a0b30', '#34195e', '#552a8e', '#7c41bb', '#a768dc', '#cf9cf2', '#f1d4ff'],
    venom: ['#05271a', '#0f4d29', '#1d7a2a', '#3daa2c', '#86d14e', '#cff29a'],
    volt: ['#3a2a07', '#6e5208', '#a88407', '#dcbb12', '#f8e34a', '#fff9b8'],
    mint: ['#062a26', '#0d5246', '#16806a', '#2bb28e', '#64dfb4', '#b9fbe0'],
    rose: ['#3a0b2a', '#6c1a4c', '#a2307a', '#d454a8', '#f08bd0', '#ffc8ec'],
});

/** 取色阶中的某一级；超界时夹到两端 */
export function ramp(name, i) {
    const r = RAMPS[name] || RAMPS.slate;
    return r[Math.max(0, Math.min(r.length - 1, i))];
}

/**
 * 界面语义色（只放有消费者的角色）
 * - text: 主/次/弱文字
 * - panel: 面板底 / 内凹槽 / 分隔线
 * - action: 可交互的主色（黄铜），选中/焦点
 * - status: 正面/警告/危险/信息
 */
export const UI = Object.freeze({
    textMain: '#f0f3f5',
    textSub: '#a9b2bc',
    textDim: '#606b79',
    textGold: '#efc75a',
    panelBg: '#0f1218',
    panelFace: '#181d25',
    panelInset: '#0a0d12',
    panelLine: '#313a46',
    panelHi: '#46505d',
    brassDark: '#7a4e14',
    brass: '#d29c2a',
    brassHi: '#fde9a6',
    focus: '#86ecea',
    good: '#86d14e',
    warn: '#f99b2a',
    danger: '#e8685c',
    info: '#8fcbff',
    sp: '#3ec6cc',
});

/** 解析 #rrggbb → [r,g,b] */
export function hexToRgb(hex) {
    const h = hex.replace('#', '');
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

export function rgba(hex, a) {
    const [r, g, b] = hexToRgb(hex);
    return `rgba(${r},${g},${b},${a})`;
}
