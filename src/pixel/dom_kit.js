/**
 * src/pixel/dom_kit.js — 把画布像素组件导出给 DOM 菜单用（九宫格边框 + 图标 → CSS 变量）
 *
 * 菜单仍是 DOM（文本、滚动、表单、无障碍），外观与画布 HUD 共用同一套组件画法（hud_kit.js）：
 * 运行时把组件画到小画布 → dataURL → 写到 :root 的 CSS 变量，pixel_theme.css 用 border-image 引用。
 * --px 为 1 个美术像素对应的 CSS 像素（随画布布局更新），边框宽度 = 切片像素 × --px，
 * 配合 image-rendering: pixelated 保证与画布同一像素尺度。
 * @module pixel/dom_kit
 */
import { RAMPS, INK } from './palette.js';
import { stonePanel, insetWell, brassButton } from './hud_kit.js';
import { getIcon } from './icons.js';

function canvas(w, h) {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    return c;
}

function url(c) {
    return `url("${c.toDataURL('image/png')}")`;
}

/** 9×9 九宫格：切片 3（四角 3×3 固定，中间拉伸） */
function frame(draw, w = 9, h = 9) {
    const c = canvas(w, h);
    const g = c.getContext('2d');
    draw(g, w, h);
    return url(c);
}

const RARITY = Object.freeze({
    common: 'slate',
    rare: 'ice',
    epic: 'arcane',
    legendary: 'brass',
    cursed: 'blood',
});

function rarityFrame(rampName) {
    return frame((g, w, h) => {
        const R = RAMPS[rampName];
        g.fillStyle = INK;
        g.fillRect(0, 0, w, h);
        g.fillStyle = R[Math.min(R.length - 2, 4)];
        g.fillRect(1, 1, w - 2, h - 2);
        g.fillStyle = R[R.length - 1];
        g.fillRect(1, 1, w - 2, 1);
        g.fillRect(1, 1, 1, h - 2);
        g.fillStyle = R[1];
        g.fillRect(1, h - 2, w - 2, 1);
        g.fillRect(w - 2, 1, 1, h - 2);
        g.fillStyle = RAMPS.slate[1];
        g.fillRect(2, 2, w - 4, h - 4);
    });
}

let _installed = false;

/** 安装 / 更新 CSS 变量。cssPerArtPx 由画布布局给出。 */
export function installDomKit(cssPerArtPx = 1.5) {
    const root = document.documentElement;
    root.style.setProperty('--px', `${cssPerArtPx}px`);
    if (_installed) return;
    _installed = true;
    const vars = {
        '--px-frame-panel': frame((g, w, h) => stonePanel(g, 0, 0, w, h)),
        '--px-frame-panel-trim': frame((g, w, h) => stonePanel(g, 0, 0, w, h, { trim: true }), 11, 11),
        '--px-frame-inset': frame((g, w, h) => insetWell(g, 0, 0, w, h)),
        '--px-frame-button': frame((g, w, h) => brassButton(g, 0, 0, w, h, 'normal')),
        '--px-frame-button-active': frame((g, w, h) => brassButton(g, 0, 0, w, h, 'active')),
        '--px-frame-button-pressed': frame((g, w, h) => brassButton(g, 0, 0, w, h, 'pressed')),
        '--px-frame-button-disabled': frame((g, w, h) => brassButton(g, 0, 0, w, h, 'disabled')),
    };
    for (const [k, ramp] of Object.entries(RARITY)) vars[`--px-frame-${k}`] = rarityFrame(ramp);
    const icon = (name, ramp) => {
        const ic = getIcon(name, ramp);
        const c = canvas(ic.width, ic.height);
        c.getContext('2d').drawImage(ic, 0, 0);
        return url(c);
    };
    vars['--px-icon-shard'] = icon('shard', 'fire');
    vars['--px-icon-runestone'] = icon('runestone', 'arcane');
    vars['--px-icon-shield'] = icon('shield', 'ice');
    vars['--px-icon-gem'] = icon('gem', 'cyan');
    vars['--px-icon-crown'] = icon('crown', 'brass');
    for (const [k, v] of Object.entries(vars)) root.style.setProperty(k, v);
    root.classList.add('px-kit-ready');
}
