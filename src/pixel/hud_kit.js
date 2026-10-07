/**
 * src/pixel/hud_kit.js — 像素 HUD 基础组件（全部在缓冲像素空间、单位变换下绘制）
 *
 * 组件只有四种外观，全界面复用：
 * - stonePanel：磨石面板（INK 外框 + 左上亮棱 + 右下暗棱）——承载信息的底板；
 * - insetWell：内凹槽——数值、条、图标的容器；
 * - brassButton：黄铜框按钮——唯一的可点外观（normal / pressed / disabled）；
 * - bar：内凹槽 + 色阶填充 + 可选刻度。
 * 黄铜只出现在可点元素与重要框线上（docs/design/pixel_art_mode.md §2.2）。
 * @module pixel/hud_kit
 */
import { RAMPS, INK, UI } from './palette.js';

const S = RAMPS.slate;
const B = RAMPS.brass;

export function rect(g, x, y, w, h, c) {
    g.fillStyle = c;
    g.fillRect(x | 0, y | 0, w | 0, h | 0);
}

/** 磨石面板 */
export function stonePanel(g, x, y, w, h, o = {}) {
    x |= 0; y |= 0; w |= 0; h |= 0;
    rect(g, x, y, w, h, INK);
    rect(g, x + 1, y + 1, w - 2, h - 2, o.face || S[1]);
    rect(g, x + 1, y + 1, w - 2, 1, S[3]);
    rect(g, x + 1, y + 1, 1, h - 2, S[3]);
    rect(g, x + 1, y + h - 2, w - 2, 1, S[0]);
    rect(g, x + w - 2, y + 1, 1, h - 2, S[0]);
    if (o.trim) {
        // 黄铜角扣（重要面板）
        for (const [cx, cy, dx, dy] of [[x + 2, y + 2, 1, 1], [x + w - 3, y + 2, -1, 1], [x + 2, y + h - 3, 1, -1], [x + w - 3, y + h - 3, -1, -1]]) {
            rect(g, cx, cy, 1, 1, B[5]);
            rect(g, cx + dx, cy, 1, 1, B[3]);
            rect(g, cx, cy + dy, 1, 1, B[3]);
        }
    }
}

/** 内凹槽 */
export function insetWell(g, x, y, w, h, o = {}) {
    x |= 0; y |= 0; w |= 0; h |= 0;
    rect(g, x, y, w, h, o.face || UI.panelInset);
    rect(g, x, y, w, 1, INK);
    rect(g, x, y, 1, h, INK);
    rect(g, x, y + h - 1, w, 1, S[2]);
    rect(g, x + w - 1, y, 1, h, S[2]);
}

/**
 * 黄铜按钮。state: 'normal' | 'pressed' | 'disabled' | 'active'
 * 返回内容区 { x, y, w, h }（按下时内容下移 1px）
 */
export function brassButton(g, x, y, w, h, state = 'normal') {
    x |= 0; y |= 0; w |= 0; h |= 0;
    const disabled = state === 'disabled';
    const pressed = state === 'pressed';
    const active = state === 'active';
    rect(g, x, y, w, h, INK);
    const rimHi = disabled ? S[4] : (active ? B[6] : B[5]);
    const rim = disabled ? S[3] : (active ? B[5] : B[3]);
    const rimLo = disabled ? S[2] : B[1];
    rect(g, x + 1, y + 1, w - 2, h - 2, rim);
    if (!pressed) {
        rect(g, x + 1, y + 1, w - 2, 1, rimHi);
        rect(g, x + 1, y + 1, 1, h - 2, rimHi);
        rect(g, x + 1, y + h - 2, w - 2, 1, rimLo);
        rect(g, x + w - 2, y + 1, 1, h - 2, rimLo);
    } else {
        rect(g, x + 1, y + 1, w - 2, 1, rimLo);
        rect(g, x + 1, y + 1, 1, h - 2, rimLo);
    }
    const face = disabled ? S[1] : (active ? S[3] : S[2]);
    rect(g, x + 2, y + 2, w - 4, h - 4, face);
    const off = pressed ? 1 : 0;
    return { x: x + 2, y: y + 2 + off, w: w - 4, h: h - 4 };
}

/** 进度条：value 0..1；rampName 填充色阶；ticks 为刻度数（0 不画） */
export function bar(g, x, y, w, h, value, rampName = 'cyan', o = {}) {
    insetWell(g, x, y, w, h);
    const R = RAMPS[rampName] || RAMPS.cyan;
    const inner = w - 2;
    const fw = Math.max(0, Math.min(inner, Math.round(inner * Math.max(0, Math.min(1, value)))));
    if (fw > 0) {
        rect(g, x + 1, y + 1, fw, h - 2, R[Math.min(R.length - 2, 3)]);
        rect(g, x + 1, y + 1, fw, 1, R[R.length - 1]);
    }
    if (o.secondary > 0) {
        const sw = Math.max(0, Math.min(inner - fw, Math.round(inner * o.secondary)));
        if (sw > 0) rect(g, x + 1 + fw, y + 1, sw, h - 2, R[1]);
    }
    if (o.ticks > 1) {
        for (let i = 1; i < o.ticks; i++) rect(g, x + 1 + Math.round(inner * i / o.ticks), y + 1, 1, h - 2, INK);
    }
}

/** 把画布按 1:1 画在整像素处 */
export function img(g, c, x, y) {
    if (c) g.drawImage(c, x | 0, y | 0);
}

/** 中文/长文本（Fusion Pixel 12px，单位变换下 = 12 缓冲像素） */
export function label(g, text, x, y, color = UI.textSub, o = {}) {
    g.save();
    g.font = `${o.size || 12}px sans-serif`;
    g.textAlign = o.align || 'left';
    g.textBaseline = o.baseline || 'top';
    if (o.outline) {
        g.strokeStyle = INK;
        g.lineWidth = 2;
        g.strokeText(text, x | 0, y | 0);
    }
    g.fillStyle = color;
    g.fillText(text, x | 0, y | 0);
    const w = g.measureText(text).width;
    g.restore();
    return w;
}
