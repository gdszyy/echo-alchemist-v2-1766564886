import { eventBus, EVENT_TYPES } from './event_bus.js';
import { RUNE_DB, RUNEWORD_DB, STAT_DISPLAY } from './rune_config.js';
import { CONFIG, META_SHOP_CONFIG, RELIC_DB, setDeepValue } from './config.js';
import { getAmmoIconSrcByKey } from './bitmap_icons.js';
import { getAmmoReadabilityProfile } from './utils/ammo_readability.js';
import {
    MODULE_DEFS,
    getModuleSpan,
    getCoveredSlots,
    calcModuleSlotRect,
    createDefaultModuleLayout,
    createModuleRef,
    ensureModuleLayoutInstances,
    getActiveModuleSlots,
    getActiveModuleSlotSet,
    getModuleInstance,
    getModuleIdFromEntry,
    getModuleMetaSummary,
    isModuleRef,
    normalizeModuleInventory,
    selectFusionTargetPegs,
} from './pinboard_modules.js';
import { fuseRuneIntoBoard, getRuneId } from './rune_system.js';
import { showToast } from './utils/math_utils.js';

function _isCoarsePointerInput() {
    if (typeof window === 'undefined') return false;
    return !!(window.matchMedia && window.matchMedia('(pointer: coarse)').matches);
}

function _escapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function _getRuneLevel(entry) {
    return (entry && typeof entry === 'object' && typeof entry.level === 'number' && entry.level > 0)
        ? entry.level
        : 1;
}

function _getStatLabel(statKey) {
    const meta = (STAT_DISPLAY || {})[statKey] || {};
    return `${meta.icon || ''} ${meta.name || statKey}`.trim();
}

// ======================================================================
// 钉板模块编辑器样式表
// 设计原则：
//   - 所有布局尺寸/网格/响应都用 class，禁止 inline style 决定布局
//   - JS 在每次 render 时根据 window.innerWidth 切换 .is-mobile / .is-tablet / .is-desktop
//   - 移动端单列堆叠 + sticky 底部按钮，桌面双栏
// ======================================================================
const ME_STYLES = `
/* ============================================================
   [v2 重构] 钉板内嵌编辑器样式
   设计：编辑器不再是覆盖全屏的抽象网格弹窗，而是直接在实时钉板画布上
   叠加可点击的虚框区域（由 canvas 绘制）。本样式表只负责：
     1) 顶部标题条（不遮挡钉板主体）
     2) 底部操作条（开始采集 / 符文融合入口）
     3) 点击钉板区域后弹出的「更换模块」浮层
   ============================================================ */

/* 编辑器激活时挂在 #game-container 上的薄层，仅承载 DOM 控件，
   不拦截画布点击（pointer-events 由子元素各自开启） */
#module-editor-layer {
    position: absolute; inset: 0; z-index: 150;
    pointer-events: none;
    font-family: 'Cinzel', 'Microsoft YaHei', sans-serif;
    color: #e2e8f0;
}

/* ---- 顶部标题条 ---- */
.me-topbar {
    position: absolute; top: 0; left: 0; right: 0;
    pointer-events: auto;
    display: flex; align-items: center; justify-content: space-between;
    gap: 8px;
    padding: 8px 12px;
    background: linear-gradient(180deg, rgba(8,12,24,0.92) 0%, rgba(8,12,24,0.55) 80%, rgba(8,12,24,0) 100%);
    box-sizing: border-box;
}
.me-topbar-title {
    font-size: 15px; font-weight: 700; letter-spacing: 1px;
    color: #67e8f9; text-shadow: 0 0 8px rgba(34,211,238,0.5);
    white-space: nowrap;
}
.me-topbar-hint {
    font-size: 11px; color: #94a3b8; line-height: 1.3;
    flex: 1; text-align: right;
}

/* ---- 底部操作条 ---- */
.me-bottombar {
    position: absolute; top: 52px; left: 12px; right: auto; bottom: auto;
    pointer-events: none;
    display: flex; align-items: center; justify-content: center;
    gap: 8px;
    padding: 0;
    background: transparent;
    box-sizing: border-box;
}
.me-bottombar > * { pointer-events: auto; }
.me-fusion-summary {
    position: absolute; left: 12px; right: 188px; top: 96px; bottom: auto;
    pointer-events: auto;
    display: flex; align-items: center; justify-content: flex-start; flex-wrap: wrap;
    gap: 6px 8px;
    padding: 7px 9px;
    border: 1px solid rgba(167,139,250,0.24);
    border-radius: 10px;
    background: rgba(15,23,42,0.78);
    box-shadow: 0 6px 20px rgba(2,6,23,0.26);
    max-height: 52px;
    overflow: hidden;
}
.me-fusion-label {
    font-size: 10px; color: #c4b5fd; font-weight: 800; letter-spacing: 0.5px;
    text-transform: uppercase;
}
.me-fusion-chip {
    font-size: 11px; color: #e0f2fe; font-weight: 700;
    padding: 3px 7px;
    border-radius: 999px;
    background: rgba(30,41,59,0.82);
    border: 1px solid rgba(125,211,252,0.26);
}
.me-fusion-note {
    font-size: 10px; color: #94a3b8; line-height: 1.25;
}
.me-editor-alert {
    position: absolute; left: 12px; right: 188px; top: 154px; bottom: auto;
    pointer-events: auto;
    display: flex; align-items: flex-start; gap: 8px;
    padding: 9px 10px;
    border-radius: 10px;
    background: rgba(127, 29, 29, 0.86);
    border: 1px solid rgba(252, 165, 165, 0.38);
    color: #fee2e2;
    box-shadow: 0 8px 24px rgba(2, 6, 23, 0.32);
}
.me-editor-alert[data-type="info"] {
    background: rgba(14, 116, 144, 0.84);
    border-color: rgba(125, 211, 252, 0.38);
    color: #e0f2fe;
}
.me-editor-alert__icon { font-size: 14px; line-height: 1.25; }
.me-editor-alert__body { flex: 1; min-width: 0; }
.me-editor-alert__title { font-size: 12px; font-weight: 800; line-height: 1.25; }
.me-editor-alert__detail { margin-top: 2px; font-size: 10px; line-height: 1.35; color: rgba(255,255,255,0.72); }
.me-btn {
    pointer-events: auto;
    border: none; cursor: pointer;
    border-radius: 10px;
    font-family: inherit; font-weight: 700;
    transition: transform 0.08s ease, filter 0.12s ease;
    -webkit-tap-highlight-color: transparent;
}
.me-btn:active { transform: scale(0.96); }
.me-btn--start {
    flex: 0 0 auto; max-width: none;
    padding: 9px 12px; font-size: 12px; letter-spacing: 1px;
    color: #042f2e;
    background: linear-gradient(135deg, #5eead4, #14b8a6);
    box-shadow: 0 4px 16px rgba(20,184,166,0.45);
}
.me-btn--start:hover { filter: brightness(1.08); }
.me-btn--rune {
    padding: 9px 10px; font-size: 12px;
    color: #ede9fe;
    background: linear-gradient(135deg, #7c3aed, #6d28d9);
    box-shadow: 0 4px 14px rgba(124,58,237,0.4);
    position: relative;
}
.me-btn--rune .me-rune-badge {
    position: absolute; top: -6px; right: -6px;
    min-width: 18px; height: 18px; padding: 0 4px;
    border-radius: 9px; background: #f43f5e; color: #fff;
    font-size: 11px; line-height: 18px; text-align: center;
    box-shadow: 0 0 0 2px rgba(8,12,24,0.9);
}

/* ---- 模块选择浮层（点击钉板区域后弹出）---- */
.me-edit-entry {
    position: absolute; right: 12px; top: 58px; bottom: auto; z-index: 140;
    pointer-events: auto;
    display: flex; justify-content: flex-end;
}
.me-btn--edit-entry {
    padding: 10px 13px;
    color: #e0f2fe;
    background: rgba(15,23,42,0.88);
    border: 1px solid rgba(103,232,249,0.45);
    box-shadow: 0 6px 18px rgba(2,6,23,0.34), 0 0 16px rgba(34,211,238,0.16);
    font-size: 12px;
}
.me-btn--edit-entry span { margin-left: 6px; color: #93c5fd; font-size: 11px; }
.me-inventory-panel {
    position: absolute; left: auto; right: 10px; top: 54px; bottom: auto;
    width: min(168px, calc(100% - 20px));
    max-height: calc(100% - 176px);
    pointer-events: auto;
    display: flex; flex-direction: column;
    gap: 8px;
    padding: 8px;
    border: 1px solid rgba(148,163,184,0.22);
    border-radius: 10px;
    background: rgba(15,23,42,0.82);
    box-shadow: 0 8px 24px rgba(2,6,23,0.32);
    overflow-y: auto;
}
.me-inventory-title,
.me-slot-title {
    font-size: 10px; color: #93c5fd; font-weight: 900;
    text-transform: uppercase; letter-spacing: 0.5px;
}
.me-inventory-grid {
    display: flex; flex-direction: column; gap: 6px;
    overflow-x: hidden; overflow-y: auto;
    max-height: 160px;
    padding-top: 5px; padding-right: 2px;
}
.me-inventory-item {
    flex: 0 0 auto;
    width: 100%;
    min-height: 44px;
    border-radius: 8px;
    border: 1px solid rgba(148,163,184,0.26);
    background: rgba(30,41,59,0.82);
    color: #dbeafe;
    display: flex; flex-direction: row; align-items: center; justify-content: flex-start;
    gap: 3px;
    padding: 6px 8px;
    box-sizing: border-box;
    font-family: inherit;
    cursor: pointer;
}
.me-inventory-item.is-selected {
    border-color: #67e8f9;
    box-shadow: 0 0 0 2px rgba(103,232,249,0.16);
    background: rgba(8,47,73,0.9);
}
.me-inventory-icon { font-size: 18px; line-height: 1; }
.me-inventory-name {
    max-width: 74px;
    overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
    font-size: 10px; font-weight: 800;
}
.me-inventory-empty {
    padding: 12px 8px;
    color: #94a3b8;
    font-size: 11px;
}
.me-slot-panel {
    border-left: 0;
    border-top: 1px solid rgba(148,163,184,0.18);
    padding-left: 0;
    padding-top: 8px;
    min-width: 0;
}
.me-slot-body {
    margin-top: 5px;
    color: #e2e8f0;
    font-size: 11px;
    line-height: 1.35;
}
.me-slot-actions {
    display: flex; flex-wrap: wrap; gap: 6px; margin-top: 7px;
}
.me-action-btn {
    border: 1px solid rgba(148,163,184,0.28);
    border-radius: 7px;
    padding: 5px 7px;
    color: #e2e8f0;
    background: rgba(30,41,59,0.86);
    font-family: inherit; font-size: 10px; font-weight: 800;
    cursor: pointer;
}
.me-action-btn:disabled {
    opacity: 0.45;
    cursor: not-allowed;
}
.me-action-btn--danger {
    border-color: rgba(251,113,133,0.42);
    color: #fecdd3;
}
.me-action-btn--equip {
    border-color: rgba(94,234,212,0.42);
    color: #ccfbf1;
}

.me-picker-backdrop {
    position: fixed; inset: 0; z-index: 250;
    background: rgba(4,8,18,0.78);
    backdrop-filter: blur(3px);
    display: flex; align-items: center; justify-content: center;
    padding: 16px; box-sizing: border-box;
    font-family: 'Cinzel', 'Microsoft YaHei', sans-serif;
    color: #e2e8f0;
}
.me-picker {
    width: 100%; max-width: 460px;
    max-height: 86vh; display: flex; flex-direction: column;
    background: linear-gradient(160deg, #131a2e, #0b1120);
    border: 1px solid rgba(103,232,249,0.25);
    border-radius: 16px;
    box-shadow: 0 20px 60px rgba(0,0,0,0.6);
    overflow: hidden;
}
.me-picker-head {
    display: flex; align-items: center; justify-content: space-between;
    padding: 14px 16px; border-bottom: 1px solid rgba(148,163,184,0.15);
}
.me-picker-title { font-size: 15px; font-weight: 700; color: #67e8f9; }
.me-picker-close {
    width: 30px; height: 30px; border-radius: 8px;
    border: 1px solid rgba(148,163,184,0.25);
    background: rgba(30,41,59,0.6); color: #cbd5e1;
    font-size: 16px; cursor: pointer; line-height: 1;
}
.me-picker-body { padding: 12px; overflow-y: auto; -webkit-overflow-scrolling: touch; }
.me-picker-grid {
    display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px;
}
.me-picker-item {
    text-align: left; cursor: pointer;
    border: 1px solid rgba(148,163,184,0.2);
    background: rgba(30,41,59,0.45);
    border-radius: 12px; padding: 10px;
    display: flex; flex-direction: column; gap: 4px;
    transition: border-color 0.12s ease, background 0.12s ease, transform 0.08s ease;
    color: inherit; font-family: inherit;
}
.me-picker-item:hover { border-color: rgba(103,232,249,0.5); background: rgba(30,41,59,0.75); }
.me-picker-item:active { transform: scale(0.97); }
.me-picker-item.is-current { border-color: #14b8a6; background: rgba(20,184,166,0.18); }
.me-picker-item.is-previewing { border-color: #fbbf24; background: rgba(251,191,36,0.14); }
.me-picker-item.is-disabled {
    opacity: 0.48;
    cursor: not-allowed;
    border-style: dashed;
}
.me-picker-item.is-disabled:hover {
    border-color: rgba(148,163,184,0.2);
    background: rgba(30,41,59,0.45);
}
.me-picker-item.is-remove { grid-column: 1 / -1; align-items: center; flex-direction: row; justify-content: center; gap: 8px; border-style: dashed; color: #fca5a5; border-color: rgba(248,113,113,0.4); }
.me-picker-icon { font-size: 22px; line-height: 1; }
.me-picker-name { font-size: 13px; font-weight: 700; color: #f1f5f9; }
.me-picker-name .me-picker-span { font-size: 11px; color: #67e8f9; font-weight: 600; }
.me-picker-desc { font-size: 11px; color: #94a3b8; line-height: 1.35; }
.me-picker-empty { padding: 24px; text-align: center; color: #94a3b8; font-size: 13px; }

/* ---- 符文融合列表（复用 picker 外壳）---- */
.me-rune-row {
    display: flex; align-items: center; gap: 10px;
    width: 100%; cursor: pointer;
    border: 1px solid rgba(148,163,184,0.2);
    background: rgba(30,41,59,0.45);
    border-radius: 12px; padding: 10px; margin-bottom: 8px;
    color: inherit; font-family: inherit; text-align: left;
}
.me-rune-row:hover { border-color: rgba(167,139,250,0.6); }
.me-rune-row.is-selected { border-color: #a78bfa; background: rgba(124,58,237,0.22); }
.me-rune-row .me-picker-icon { font-size: 24px; }
.me-rune-meta { flex: 1; }
.me-rune-meta .me-picker-name { font-size: 13px; }
.me-rune-lv { color: #a78bfa; font-size: 11px; }
.me-rune-hints { color: #7dd3fc; }
.me-rune-preview {
    position: sticky; bottom: -12px;
    margin: 10px -12px -12px; padding: 10px 12px;
    border-top: 1px solid rgba(167,139,250,0.25);
    background: rgba(15,23,42,0.96);
}
.me-rune-preview-text { font-size: 12px; color: #c4b5fd; line-height: 1.35; margin-bottom: 8px; }
.me-rune-chain {
    margin-bottom: 8px;
    display: flex; flex-direction: column; gap: 4px;
    font-size: 11px; line-height: 1.35; color: #94a3b8;
}
.me-rune-chain strong { color: #e9d5ff; font-weight: 800; }
.me-rune-chain .is-good { color: #86efac; }
.me-rune-chain .is-hint { color: #7dd3fc; }
.me-rune-confirm {
    width: 100%; padding: 11px 12px; border: none; border-radius: 10px;
    background: linear-gradient(135deg, #8b5cf6, #6d28d9);
    color: #f5f3ff; font-family: inherit; font-size: 13px; font-weight: 800;
    cursor: pointer;
}
.me-rune-confirm:disabled {
    cursor: default; opacity: 0.45; filter: grayscale(0.4);
}

@media (max-width: 480px) {
    .me-topbar-title { font-size: 13px; }
    .me-topbar-hint { display: none; }
    .me-bottombar { top: 54px; left: 8px; }
    .me-btn--start { padding: 8px 10px; font-size: 11px; }
    .me-btn--rune { padding: 8px 9px; font-size: 11px; }
    .me-edit-entry { top: 54px; right: 8px; }
    .me-inventory-panel {
        top: 54px; right: 8px;
        width: 148px;
        max-height: calc(100% - 188px);
    }
    .me-inventory-item { min-height: 42px; }
    .me-inventory-name { max-width: 96px; }
    .me-fusion-summary {
        left: 8px; right: 164px; top: 96px;
        max-height: 48px;
    }
    .me-editor-alert {
        left: 8px; right: 164px; top: 150px;
        padding: 8px 9px;
    }
    .me-picker-grid { grid-template-columns: 1fr; }
}

@media (max-width: 360px) {
    .me-inventory-panel { right: 6px; width: 136px; }
    .me-fusion-summary,
    .me-editor-alert { right: 148px; }
}
`;

export const ui_system = {
    // @section:ui_fly_effects - 飞行特效池管理
    _flyEffectPool: [],
    _getFlyEffectNode() {
        if (this._flyEffectPool.length > 0) return this._flyEffectPool.pop();
        const node = document.createElement('div');
        node.className = 'resource-fly-effect';
        node.style.cssText = `
            position: absolute;
            pointer-events: none;
            z-index: 1000;
            font-weight: bold;
            font-family: 'Cinzel', serif;
            text-shadow: 0 0 10px rgba(0,0,0,0.8);
            display: flex;
            align-items: center;
            gap: 4px;
            transition: all 0.8s cubic-bezier(0.19, 1, 0.22, 1);
        `;
        return node;
    },
    _releaseFlyEffectNode(node) {
        if (node.parentNode) node.parentNode.removeChild(node);
        this._flyEffectPool.push(node);
    },

    ui_playResourceFlyEffect(startX, startY, amount) {
        const container = document.getElementById('game-container');
        if (!container) return;
        const node = this._getFlyEffectNode();
        node.innerHTML = `<span>+${amount}</span><span style="color:#a855f7">🔮</span>`;
        node.style.left = startX + 'px';
        node.style.top = startY + 'px';
        node.style.opacity = '1';
        node.style.transform = 'translate(-50%, -50%) scale(0.5)';
        container.appendChild(node);

        requestAnimationFrame(() => {
            node.style.transform = 'translate(-50%, -150%) scale(1.2)';
            setTimeout(() => {
                node.style.opacity = '0';
                node.style.transform = 'translate(-50%, -250%) scale(0.8)';
                setTimeout(() => this._releaseFlyEffectNode(node), 800);
            }, 600);
        });
    },

    /**
     * @method ui_playLootToCardAnimation
     * @description 播放掉落物开启 → 飞出「卡片」的 3D 动画。
     * [BUGFIX #8] 旧版本只是把图标整体放大并翻转，没有「卡片从掉落物中飞出」的实感。
     * 新版本分两段：
     *   1) 掉落物原地脉冲一下并迸发出 8 道光束（开启感）
     *   2) 一张带边框/标题/图标的「卡片」从掉落物位置弹出，缩小 → 沿弧线飞向屏幕中央
     *      并放大成最终展示卡片，再淡出移交给后续选择 UI。
     */
    ui_playLootToCardAnimation(startX, startY, type, callback) {
        const container = document.getElementById('game-container');
        if (!container) return callback && callback();

        let icon = '🏆';
        let glow = 'rgba(250, 204, 21, 0.85)';
        let cardBg = 'linear-gradient(160deg,#78350f 0%,#3b1f05 60%,#150b01 100%)';
        let cardBorder = '#fbbf24';
        let title = '遺物';
        if (type === 'chaos_essence') {
            icon = '🔮'; glow = 'rgba(168, 85, 247, 0.85)';
            cardBg = 'linear-gradient(160deg,#4a1d96 0%,#2e1065 60%,#0f0528 100%)';
            cardBorder = '#c084fc';
            title = '混沌精華';
        } else if (type === 'pure_essence') {
            icon = '💎'; glow = 'rgba(56, 189, 248, 0.85)';
            cardBg = 'linear-gradient(160deg,#0c4a6e 0%,#082f49 60%,#020f1a 100%)';
            cardBorder = '#38bdf8';
            title = '純淨精華';
        }

        // ---- A. 掉落物开启脉冲 + 光束迸发（保留原图标位置感） ----
        const burst = document.createElement('div');
        burst.style.cssText = `
            position: absolute;
            left: ${startX}px;
            top: ${startY}px;
            width: 8px; height: 8px;
            transform: translate(-50%, -50%);
            border-radius: 50%;
            box-shadow: 0 0 0 0 ${glow};
            z-index: 1990;
            pointer-events: none;
            transition: box-shadow 0.35s ease-out, opacity 0.35s ease-out;
            opacity: 1;
        `;
        container.appendChild(burst);

        const ray = document.createElement('div');
        ray.style.cssText = `
            position: absolute;
            left: ${startX}px;
            top: ${startY}px;
            width: 4px; height: 4px;
            transform: translate(-50%, -50%);
            z-index: 1991;
            pointer-events: none;
        `;
        for (let i = 0; i < 8; i++) {
            const beam = document.createElement('div');
            const angle = (i / 8) * 360;
            beam.style.cssText = `
                position: absolute;
                left: 0; top: 0;
                width: 2px; height: 60px;
                background: linear-gradient(to top, transparent, ${glow});
                transform-origin: 1px 0;
                transform: rotate(${angle}deg) translateY(0);
                opacity: 0;
                transition: transform 0.45s ease-out, opacity 0.45s ease-out;
            `;
            ray.appendChild(beam);
        }
        container.appendChild(ray);

        // ---- B. 创建「飞出的卡片」节点 ----
        const card = document.createElement('div');
        card.className = 'loot-fly-card';
        card.innerHTML = `
            <div class="loot-fly-card-icon">${icon}</div>
            <div class="loot-fly-card-title">${title}</div>
        `;
        card.style.cssText = `
            position: absolute;
            left: ${startX}px;
            top: ${startY}px;
            width: 84px;
            height: 116px;
            transform: translate(-50%, -50%) scale(0.05) rotate(-12deg);
            opacity: 0;
            background: ${cardBg};
            border: 2px solid ${cardBorder};
            border-radius: 10px;
            box-shadow: 0 12px 32px rgba(0,0,0,0.6), 0 0 18px ${glow};
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            gap: 8px;
            color: #f8fafc;
            font-family: 'Cinzel', serif;
            z-index: 2000;
            pointer-events: none;
            transition: transform 0.7s cubic-bezier(0.22, 1.2, 0.36, 1), opacity 0.5s ease-out, left 0.7s cubic-bezier(0.22, 1.2, 0.36, 1), top 0.7s cubic-bezier(0.22, 1.2, 0.36, 1);
        `;
        const iconEl = card.querySelector('.loot-fly-card-icon');
        if (iconEl) iconEl.style.cssText = `font-size: 38px; text-shadow: 0 0 14px ${glow};`;
        const titleEl = card.querySelector('.loot-fly-card-title');
        if (titleEl) titleEl.style.cssText = `font-size: 12px; letter-spacing: 2px; color: ${cardBorder}; text-shadow: 0 0 6px ${glow};`;
        container.appendChild(card);

        const targetX = this.width / 2;
        const targetY = this.height * 0.4;

        // 触发开启脉冲
        requestAnimationFrame(() => {
            burst.style.boxShadow = `0 0 0 80px rgba(255,255,255,0)`;
            burst.style.opacity = '0';
            ray.querySelectorAll('div').forEach((beam) => {
                const angle = beam.style.transform.match(/rotate\(([-\d.]+)deg\)/);
                const a = angle ? parseFloat(angle[1]) : 0;
                beam.style.opacity = '0.9';
                beam.style.transform = `rotate(${a}deg) translateY(-40px)`;
            });

            // 卡片从掉落物中蹦出（先稍微停留一帧再起飞，强化「打开掉落物」的感觉）
            setTimeout(() => {
                card.style.opacity = '1';
                card.style.transform = 'translate(-50%, -50%) scale(0.6) rotate(-6deg)';
            }, 80);

            // 沿弧线飞向中心，并放大
            setTimeout(() => {
                card.style.left = targetX + 'px';
                card.style.top = targetY + 'px';
                card.style.transform = 'translate(-50%, -50%) scale(1.4) rotate(0deg)';
            }, 220);

            // 抵达后短暂停留 → 淡出，触发后续 UI
            setTimeout(() => {
                card.style.transition = 'transform 0.25s ease-in, opacity 0.25s ease-in';
                card.style.opacity = '0';
                card.style.transform = 'translate(-50%, -50%) scale(1.7) rotate(0deg)';
                setTimeout(() => {
                    if (card.parentNode) card.parentNode.removeChild(card);
                    if (burst.parentNode) burst.parentNode.removeChild(burst);
                    if (ray.parentNode) ray.parentNode.removeChild(ray);
                    if (callback) callback();
                }, 260);
            }, 920);
        });
    },

    ui_updateSlowMotion() {
        const overlay = document.getElementById('slow-motion-overlay');
        if (!overlay) return;
        if (this.isSlowMotion) {
            overlay.classList.remove('hidden');
            overlay.style.opacity = '1';
        } else {
            overlay.style.opacity = '0';
            setTimeout(() => overlay.classList.add('hidden'), 300);
        }
    },

    ui_updateMetaCurrency() {
        const value = this.meta_getResourceCount('rune_fragments') || 0;
        const el = document.getElementById('meta-currency-value') || document.getElementById('meta-currency-display');
        if (el) el.innerText = value.toLocaleString();
    },

    ui_updateRuneCountDisplay() {
        const el = document.getElementById('rune-count-value');
        if (el) el.innerText = (this.runeInventory || []).length;
    },

    ui_updateShieldPill() {
        const pill = document.getElementById('shield-pill');
        const countEl = document.getElementById('shield-count');
        if (!pill || !countEl) return;
        const shield = this.playerShield || 0;
        countEl.innerText = String(shield);
        pill.classList.toggle('is-visible', shield > 0 && this.phase !== 'meta');
        pill.title = shield > 0
            ? `守护者结界：剩余 ${shield} 层。敌人越线时消耗 1 层并抵消失败。`
            : '守护者结界：当前没有护盾';
    },

    ui_updateCombatStatusPanel(force = false) {
        const panel = document.getElementById('combat-status-panel');
        if (!panel) return;
        if (this.phase !== 'combat' && this.phase !== 'training') {
            panel.classList.add('is-hidden');
            this._combatStatusSignature = '';
            return;
        }

        const now = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
        if (!force && this._combatStatusUpdatedAt && now - this._combatStatusUpdatedAt < 180) return;
        this._combatStatusUpdatedAt = now;

        const activeEnemies = (this.enemies || []).filter(e => e && e.active && !e.isDead && e.hp > 0);
        let eliteCount = 0;
        let bossCount = 0;
        let shieldedCount = 0;

        activeEnemies.forEach(enemy => {
            if (enemy.type === 'elite') eliteCount++;
            if (enemy.type === 'boss') bossCount++;
            if ((enemy.shieldCharges || 0) > 0 || (enemy.affixes || []).includes('shield')) shieldedCount++;
        });

        const playerShield = this.playerShield || 0;
        const ammoCount = (this.ammoQueue || []).length;
        const currentAmmo = ammoCount > 0 ? this.ammoQueue[0] : null;
        const ammoProfile = currentAmmo ? getAmmoReadabilityProfile(currentAmmo) : null;
        const ammoLabel = currentAmmo
            ? ammoProfile.attributeSummary + (ammoProfile.scatter > 0 ? ` / S${ammoProfile.scatterPelletCount}` : '') + (ammoProfile.multicast > 0 ? ` / x${ammoProfile.multicastCount}` : '')
            : 'no ammo';

        let threatClass = '';
        let threatLabel = 'Combat';
        let note = activeEnemies.length > 0
            ? `Enemies ${activeEnemies.length} / Next ${ammoLabel}`
            : `Clear / Next ${ammoLabel}`;

        if (activeEnemies.length === 0) {
            threatLabel = 'Clear';
        } else if (bossCount > 0) {
            threatClass = 'is-danger';
            threatLabel = 'Boss';
        } else if (eliteCount >= 2) {
            threatClass = 'is-watch';
            threatLabel = 'Elite';
        }

        const signature = [
            threatClass, threatLabel, activeEnemies.length, eliteCount, bossCount,
            shieldedCount, playerShield, ammoCount, ammoLabel, note
        ].join('|');
        if (!force && signature === this._combatStatusSignature) return;
        this._combatStatusSignature = signature;

        const threatPill = document.getElementById('combat-threat-pill');
        const threatLabelEl = document.getElementById('combat-threat-label');
        const enemyCountEl = document.getElementById('combat-enemy-count');
        const eliteCountEl = document.getElementById('combat-elite-count');
        const bossCountEl = document.getElementById('combat-boss-count');
        const shieldCountEl = document.getElementById('combat-shield-count');
        const ammoCountEl = document.getElementById('combat-ammo-count');
        const noteEl = document.getElementById('combat-status-note');

        panel.classList.remove('is-hidden');
        if (threatPill) {
            threatPill.classList.toggle('is-watch', threatClass === 'is-watch');
            threatPill.classList.toggle('is-danger', threatClass === 'is-danger');
        }
        if (threatLabelEl) threatLabelEl.innerText = threatLabel;
        if (enemyCountEl) enemyCountEl.innerText = String(activeEnemies.length);
        if (eliteCountEl) eliteCountEl.innerText = String(eliteCount);
        if (bossCountEl) bossCountEl.innerText = String(bossCount);
        if (shieldCountEl) shieldCountEl.innerText = String(playerShield);
        if (ammoCountEl) ammoCountEl.innerText = String(ammoCount);
        if (noteEl) noteEl.innerText = note;
    },
    ui_resetCombatPhaseHud(options = {}) {
        const preserveStatusPanel = !!options.preserveStatusPanel;
        const statusPanel = document.getElementById('combat-status-panel');
        if (!preserveStatusPanel) {
            if (statusPanel) statusPanel.classList.add('is-hidden');
            this._combatStatusSignature = '';
        }

        const recipeHud = document.getElementById('recipe-hud-container');
        if (recipeHud) {
            recipeHud.classList.add('hidden');
            recipeHud.classList.remove('recipe-hud-floating');
            recipeHud.innerHTML = '';
        }

        const skillBar = document.getElementById('skill-bar');
        if (skillBar) skillBar.style.display = 'none';

        const runeChargeUi = document.getElementById('combat-rune-charge-ui');
        if (runeChargeUi) runeChargeUi.style.display = 'none';

        const damageDisplay = document.getElementById('round-damage-display');
        const damageValue = document.getElementById('round-damage-val');
        const damageDps = document.getElementById('round-damage-dps');
        if (this._damageScrollInterval) {
            clearInterval(this._damageScrollInterval);
            this._damageScrollInterval = null;
        }
        if (damageDisplay) {
            damageDisplay.classList.add('opacity-0');
            damageDisplay.classList.remove('opacity-100');
        }
        if (damageValue) damageValue.innerText = '0';
        if (damageDps) damageDps.innerText = '';

        const damageTab = document.getElementById('tab-damage');
        const drawer = document.getElementById('info-drawer');
        const damageTabActive = damageTab && !damageTab.classList.contains('hidden');
        if (damageTabActive && drawer && !drawer.classList.contains('translate-y-full')) {
            if (this.ui && typeof this.ui.closeDrawer === 'function') this.ui.closeDrawer();
            else drawer.classList.add('translate-y-full');
        }
    },

    ui_clearTransientOverlays(options = {}) {
        const keepRuneLauncher = !!options.keepRuneLauncher;
        const keepRelicOverlay = !!options.keepRelicOverlay;

        const bossOverlay = document.getElementById('boss-entrance-overlay');
        if (bossOverlay) {
            bossOverlay.style.display = 'none';
            bossOverlay.classList.remove('active');
            bossOverlay.innerHTML = '';
        }

        const chaosOverlay = document.getElementById('chaos-slot-machine-overlay');
        if (chaosOverlay) chaosOverlay.style.display = 'none';

        if (!keepRelicOverlay) {
            const relicOverlay = document.getElementById('phase-relic');
            if (relicOverlay && this.phase !== 'relic') {
                relicOverlay.style.display = 'none';
                relicOverlay.style.pointerEvents = 'none';
                relicOverlay.classList.add('hidden-phase');
                relicOverlay.classList.remove('active-phase', 'relic-debug-picker');
            }
            this.relicOverlayReturnState = null;
            this.stateBeforeRelic = null;
        }

        if (!keepRuneLauncher) {
            if (typeof this.ui_closeRunePicker === 'function') {
                this.ui_closeRunePicker();
            } else {
                const runePickerOverlay = document.getElementById('rune-picker-overlay');
                if (runePickerOverlay) runePickerOverlay.classList.add('hidden');
                this._pendingRuneGridIndex = null;
            }
        }

        const moduleLayer = document.getElementById('module-editor-layer');
        if (moduleLayer) moduleLayer.remove();
        const moduleEntryLayer = document.getElementById('module-editor-entry-layer');
        if (moduleEntryLayer) moduleEntryLayer.remove();
        if (typeof this._moduleEditor_closePicker === 'function') this._moduleEditor_closePicker();
        this._moduleEditorActive = false;
        this._moduleEditorState = null;
        this._moduleEditorSelectedComponentUid = null;
        this._moduleEditorSelectedSlotIdx = null;

        const toast = document.getElementById('toast');
        if (toast && (this.phase === 'meta' || this.phase === 'gameover')) {
            toast.classList.remove('toast-visible');
            toast.innerText = '';
        }
    },

    ui_getSelectionRequirement() {
        return this.selectionRequiredCount || 3;
    },

    ui_isSelectionConfirmReady() {
        const required = this.ui_getSelectionRequirement();
        if ((this.selectedMarbles || []).length !== required) return false;
        if (this.selectionMode === 'pure_essence') {
            // [feat] 纯净精华允许不注入符文直接进入研磨（只有一个弹珠）
            // 有符文注入时仍需校验 marbleIndex 匹配；无符文时直接放行
            return true;
        }
        return true;
    },

    ui_updateSelectionChoiceStrip() {
        const stripEl = document.getElementById('selection-choice-strip');
        const progressEl = document.getElementById('selection-progress');
        if (!stripEl && !progressEl) return;

        const attrDisplay = (typeof CONFIG !== 'undefined' && CONFIG.ui?.attributeDisplay) ? CONFIG.ui.attributeDisplay : {};
        const isReplace = !!(this.replaceAmmoContext && this.replaceAmmoContext.active);
        let required = this.ui_getSelectionRequirement();
        let selectedItems = [];

        if (isReplace) {
            const ctx = this.replaceAmmoContext;
            const allRecipes = [...(ctx.newRecipes || []), ...(ctx.chargedRecipes || [])];
            const bulletCap = (CONFIG.gameplay.selectionReq || 3);
            required = Math.min(bulletCap, allRecipes.length);
            selectedItems = (ctx.selectedIndices || [])
                .filter(idx => idx >= 0 && idx < allRecipes.length)
                .map(idx => {
                    const recipe = allRecipes[idx];
                    const profile = getAmmoReadabilityProfile(recipe);
                    const source = idx < (ctx.newRecipes || []).length ? '新' : '充';
                    return {
                        icon: profile.primary?.icon || '',
                        label: `${source} ${profile.shapeLabel || '子弹'}`,
                        detail: profile.attributeSummary || profile.directSummary || '',
                    };
                });
        } else {
            required = this.ui_getSelectionRequirement();
            selectedItems = (this.selectedMarbles || []).map(idx => {
                const marble = this.marblesPool?.[idx];
                if (!marble) return null;
                const info = attrDisplay[marble.type] || {};
                const runeCount = Array.isArray(marble.runeSlots) ? marble.runeSlots.length : 0;
                const maxRuneSlots = marble.maxRuneSlots || 3;
                return {
                    icon: info.icon || '',
                    label: marble.getName ? marble.getName() : (info.name || marble.type || '弹珠'),
                    detail: `${info.name || marble.type || ''}${runeCount ? ` / Rune ${runeCount}/${maxRuneSlots}` : ''}`,
                };
            }).filter(Boolean);
        }

        const filled = Math.min(selectedItems.length, required);
        if (stripEl) {
            const chips = [];
            for (let i = 0; i < Math.max(required, filled); i++) {
                const item = selectedItems[i];
                if (item) {
                    const title = [item.label, item.detail].filter(Boolean).join(' · ');
                    chips.push(`<span class="selection-choice-chip is-filled" title="${_escapeHtml(title)}"><span>${i + 1}</span><strong>${item.icon ? `${_escapeHtml(item.icon)} ` : ''}${_escapeHtml(item.label)}</strong></span>`);
                } else {
                    chips.push(`<span class="selection-choice-chip is-empty"><span>${i + 1}</span><strong>待选择</strong></span>`);
                }
            }
            stripEl.innerHTML = chips.join('');
        }

        if (progressEl) {
            progressEl.innerHTML = Array.from({ length: Math.max(1, required) }, (_, i) => (
                `<span class="selection-progress-dot${i < filled ? ' is-filled' : ''}"></span>`
            )).join('');
        }
    },

    ui_getPureEssenceRuneOptions(marbleDef) {
        // [feat] 纯净精华允许任意自己拥有的符文与弹珠合成，
        // 合成后保留弹珠原类型，并把符文元素追加到本轮子弹属性中。
        return (this.runeInventory || []).map((rune, inventoryIndex) => {
            const runeDef = (RUNE_DB || []).find(item => item.id === rune.id);
            if (!runeDef) return null;
            return { inventoryIndex, rune, runeDef };
        }).filter(Boolean);
    },

    ui_fuseRuneIntoMarble(selectionIndex, inventoryIndex) {
        if (!(this.selectedMarbles || []).includes(selectionIndex)) {
            if (typeof showToast === 'function') showToast('Select this marble first.');
            return;
        }
        const marbleDef = this.marblesPool?.[selectionIndex];
        if (!marbleDef) return;
        if (!Array.isArray(marbleDef.runeSlots)) marbleDef.runeSlots = [];
        marbleDef.maxRuneSlots = marbleDef.maxRuneSlots || 3;
        if (marbleDef.runeSlots.length >= marbleDef.maxRuneSlots) {
            if (typeof showToast === 'function') showToast('Rune slots full.');
            return;
        }
        const option = this.ui_getPureEssenceRuneOptions(marbleDef).find(item => item.inventoryIndex === inventoryIndex);
        if (!option) {
            if (typeof showToast === 'function') showToast('Rune not found.');
            return;
        }
        const level = Math.max(1, option.rune.level || 1);
        const statAmount = level * Math.max(1, option.runeDef.baseStatPerLevel || 1);
        marbleDef.runeSlots.push({
            runeId: option.rune.id,
            level,
            element: option.runeDef.element,
            statAmount,
            name: option.runeDef.name,
            icon: option.runeDef.icon,
            rarity: option.runeDef.rarity || 'common',
        });
        if (typeof marbleDef.normalizeRuneSlots === 'function') marbleDef.normalizeRuneSlots();
        if (Array.isArray(this.runeInventory) && inventoryIndex >= 0) {
            this.runeInventory.splice(inventoryIndex, 1);
            if (this.saveData) this.saveData.runeInventory = (this.runeInventory || []).slice();
        }
        this.selectionInjectedRune = null;
        this.ui_updateRuneCountDisplay();
        this.ui_refreshSelectionModeUI();
        if (typeof this.sys_saveRunState === 'function') this.sys_saveRunState();
        if (typeof showToast === 'function') showToast(`Fused ${option.runeDef.name} into marble.`);
    },

    ui_selectPureEssenceRune(selectionIndex, inventoryIndex) {
        this.ui_fuseRuneIntoMarble(selectionIndex, inventoryIndex);
        return;
        if (this.selectionMode !== 'pure_essence') return;
        if (!(this.selectedMarbles || []).includes(selectionIndex)) {
            if (typeof showToast === 'function') showToast('請先選中這枚彈珠，再注入符文。');
            return;
        }
        const marbleDef = this.marblesPool?.[selectionIndex];
        const option = this.ui_getPureEssenceRuneOptions(marbleDef).find(item => item.inventoryIndex === inventoryIndex);
        if (!option) {
            if (typeof showToast === 'function') showToast('找不到该符文。');
            return;
        }
        this.selectionInjectedRune = {
            marbleIndex: selectionIndex,
            inventoryIndex,
            runeId: option.rune.id,
            level: option.rune.level || 1,
            element: option.runeDef.element,
            icon: option.runeDef.icon,
            name: option.runeDef.name,
            baseStatPerLevel: option.runeDef.baseStatPerLevel || 1,
        };
        this.ui_refreshSelectionModeUI();
        if (typeof this.sys_saveRunState === 'function') this.sys_saveRunState();
    },

    ui_renderMarbleRuneSlotsPanel(host, marbleDef, selectionIndex) {
        const isSelected = (this.selectedMarbles || []).includes(selectionIndex);
        if (!Array.isArray(marbleDef.runeSlots)) marbleDef.runeSlots = [];
        marbleDef.maxRuneSlots = marbleDef.maxRuneSlots || 3;
        if (typeof marbleDef.normalizeRuneSlots === 'function') marbleDef.normalizeRuneSlots();
        const slots = marbleDef.runeSlots || [];
        const attrDisplay = (typeof CONFIG !== 'undefined' && CONFIG.ui?.attributeDisplay) ? CONFIG.ui.attributeDisplay : {};
        const slotHtml = Array.from({ length: marbleDef.maxRuneSlots }, (_, idx) => {
            const slot = slots[idx];
            if (!slot) {
                return `<span class="inline-flex min-w-[46px] items-center justify-center rounded-md border border-dashed border-slate-500/70 bg-slate-900/50 px-2 py-1 text-[11px] text-slate-500">EMPTY</span>`;
            }
            const attr = attrDisplay[slot.element] || {};
            return `<span class="inline-flex min-w-[46px] items-center justify-center gap-1 rounded-md border border-amber-300/70 bg-amber-500/15 px-2 py-1 text-[11px] text-amber-100" title="${_escapeHtml(slot.name || slot.runeId)}">${_escapeHtml(slot.icon || attr.icon || '✦')} ${_escapeHtml(attr.name || slot.element)} +${slot.statAmount || slot.level || 1}</span>`;
        }).join('');
        const options = this.ui_getPureEssenceRuneOptions(marbleDef);
        let optionsHtml = '';
        if (!isSelected) {
            optionsHtml = '<div class="text-xs text-slate-400">Select this marble to fuse runes.</div>';
        } else if (slots.length >= marbleDef.maxRuneSlots) {
            optionsHtml = '<div class="text-xs text-amber-200">Rune slots full.</div>';
        } else if (options.length === 0) {
            optionsHtml = '<div class="text-xs text-slate-400">Rune inventory empty.</div>';
        } else {
            optionsHtml = options.map(item => {
                const attr = attrDisplay[item.runeDef.element] || {};
                const amount = Math.max(1, item.rune.level || 1) * Math.max(1, item.runeDef.baseStatPerLevel || 1);
                return `<button type="button" data-inventory-index="${item.inventoryIndex}" class="pure-essence-rune-btn px-2 py-1 rounded-lg border border-slate-600 bg-slate-800/80 text-xs text-slate-200 transition-all hover:border-amber-300 hover:text-white">${item.runeDef.icon || '✦'} ${item.runeDef.name} Lv.${item.rune.level || 1} / ${attr.name || item.runeDef.element} +${amount}</button>`;
            }).join('');
        }
        host.style.display = 'block';
        host.innerHTML = `
            <div class="preview-divider"></div>
            <div class="preview-peg-label">MARBLE RUNE SLOTS</div>
            <div class="text-xs text-slate-300 mb-2">Each marble can hold up to 3 fused runes. Fusing consumes the rune immediately and adds its attribute to this marble.</div>
            <div class="flex flex-wrap gap-2 mb-2">${slotHtml}</div>
            <div class="flex flex-wrap gap-2">${optionsHtml}</div>
        `;
        host.querySelectorAll('.pure-essence-rune-btn').forEach(btn => {
            btn.onclick = () => this.ui_fuseRuneIntoMarble(selectionIndex, Number(btn.dataset.inventoryIndex));
        });
    },

    ui_renderPureEssencePanel(marbleDef, selectionIndex) {
        const panel = document.getElementById('marble-preview-panel');
        if (!panel) return;
        let host = document.getElementById('selection-augment-panel');
        if (!host) {
            host = document.createElement('div');
            host.id = 'selection-augment-panel';
            host.className = 'mt-3';
            panel.appendChild(host);
        }
        if (!marbleDef || selectionIndex < 0) {
            host.style.display = 'none';
            host.innerHTML = '';
            return;
        }
        if (typeof this.ui_renderMarbleRuneSlotsPanel === 'function') {
            this.ui_renderMarbleRuneSlotsPanel(host, marbleDef, selectionIndex);
            return;
        }
        if (this.selectionMode !== 'pure_essence' || !marbleDef || selectionIndex < 0) {
            host.style.display = 'none';
            host.innerHTML = '';
            return;
        }
        host.style.display = 'block';
        const options = this.ui_getPureEssenceRuneOptions(marbleDef);
        const selectedIndex = (this.selectedMarbles || [])[0];
        const isSelected = selectedIndex === selectionIndex;
        const selectedRune = (isSelected && this.selectionInjectedRune && this.selectionInjectedRune.marbleIndex === selectionIndex)
            ? this.selectionInjectedRune
            : null;
        const attrDisplay = (typeof CONFIG !== 'undefined' && CONFIG.ui?.attributeDisplay) ? CONFIG.ui.attributeDisplay : {};
        const currentDisplay = attrDisplay[marbleDef.type] || {};
        const currentAttrHtml = `<span class="inline-flex items-center gap-1 rounded-full border border-slate-200/45 bg-slate-100/10 px-2 py-0.5 text-[11px] text-slate-100">${currentDisplay.icon || '\u2726'} ${currentDisplay.name || marbleDef.type}</span>`;
        let optionsHtml = '';
        if (!isSelected) {
            optionsHtml = '<div class="text-xs text-slate-400">\u5148\u9078\u4e2d\u9019\u679a\u5f48\u73e0\uff0c\u518d\u5f9e\u4e0b\u65b9\u7b26\u6587\u4e2d\u6ce8\u5165\u3002</div>';
        } else if (options.length === 0) {
            optionsHtml = '<div class="text-xs text-rose-300">\u7576\u524d\u7b26\u6587\u5eab\u70ba\u7a7a\u3002\u53ef\u76f4\u63a5\u4ee5\u539f\u5c6c\u6027\u9032\u5165\u7814\u78e8\uff0c\u6216\u9ede\u300c\u8df3\u904e\u7814\u78e8\u300d\u7372\u5f97\u96a8\u6a5f\u7b26\u6587\u3002</div>';
        } else {
            optionsHtml = options.map(item => {
                const active = selectedRune && selectedRune.inventoryIndex === item.inventoryIndex;
                return `<button type="button" data-inventory-index="${item.inventoryIndex}" class="pure-essence-rune-btn px-2 py-1 rounded-lg border text-xs transition-all ${active ? 'border-amber-300 bg-amber-500/20 text-amber-100' : 'border-slate-600 bg-slate-800/80 text-slate-200 hover:border-slate-200 hover:text-white'}">${item.runeDef.icon || '\u2726'} ${item.runeDef.name} Lv.${item.rune.level || 1}</button>`;
            }).join('');
        }
        const selectedRuneText = selectedRune
            ? `\u5df2\u9078\u4e2d\u5408\u6210\u7b26\u6587\uff1a${selectedRune.icon || '\u2726'} ${selectedRune.name} \u2192 \u5c07\u70ba\u5f48\u73e0\u984d\u5916\u6dfb\u52a0 ${attrDisplay[selectedRune.element]?.name || selectedRune.element} +${Math.max(1, selectedRune.level || 1) * Math.max(1, selectedRune.baseStatPerLevel || 1)}`
            : '\u672a\u9078\u4e2d\u7b26\u6587\uff1a\u5c07\u4ee5\u539f\u5c6c\u6027\u9032\u5165\u7814\u78e8\u3002';
        host.innerHTML = `
            <div class="preview-divider"></div>
            <div class="preview-peg-label">\u7d14\u6de8\u7cbe\u83ef / \u7b26\u6587\u5408\u6210</div>
            <div class="text-xs text-slate-300 mb-2">\u53ef\u9078\u64c7\u4efb\u610f\u7b26\u6587\u8207\u5f48\u73e0\u5408\u6210\uff0c\u70ba\u672c\u8f2a\u5b50\u5f48\u6dfb\u52a0\u5c0d\u61c9\u5c6c\u6027\uff1b\u4e5f\u53ef\u4e0d\u5408\u6210\u4ee5\u539f\u5c6c\u6027\u9032\u5165\u7814\u78e8\u3002</div>
            <div class="flex flex-wrap gap-2 mb-2">\u5f48\u73e0\u539f\u5c6c\u6027\uff1a${currentAttrHtml}</div>
            <div class="flex flex-wrap gap-2">${optionsHtml}</div>
            <div class="text-xs ${selectedRune ? 'text-amber-200' : 'text-slate-500'} mt-2">${selectedRuneText}</div>
        `;
        host.querySelectorAll('.pure-essence-rune-btn').forEach(btn => {
            btn.onclick = () => this.ui_selectPureEssenceRune(selectionIndex, Number(btn.dataset.inventoryIndex));
        });
    },

    ui_isFateMomentPhase() {
        return this.phase === 'selection' && this.fateMomentContext && this.fateMomentContext.active;
    },

    /**
     * @method ui_showChaosBulletSlotMachine
     * @description [chaos-skip-upgrade] 渲染混沌精华跳过时的子弹老虎机覆盖层并播放动画。
     * @param {string[][]} slotAttrs 每个 slot 可用的属性列表（顺序）。
     * @param {string[]} finalPicks 每个 slot 最终命中的属性。
     * @param {Object<string,string>} ATTR_LABEL 属性 key -> 显示文本映射。
     * @param {boolean} allSame 是否三连同款。
     * @param {Function} onComplete 玩家点击「进入战斗」按钮后的回调。
     */
    ui_showChaosBulletSlotMachine(slotAttrs, finalPicks, ATTR_LABEL, allSame, onComplete) {
        const overlay = document.getElementById('chaos-slot-machine-overlay');
        const slotsEl = document.getElementById('chaos-slot-machine-slots');
        const resultEl = document.getElementById('chaos-slot-machine-result');
        const continueBtn = document.getElementById('chaos-slot-machine-continue');
        if (!overlay || !slotsEl || !resultEl || !continueBtn) {
            if (typeof onComplete === 'function') onComplete();
            return;
        }

        slotsEl.innerHTML = '';
        resultEl.innerText = '';
        continueBtn.style.display = 'none';

        const ITEM_HEIGHT = 64;
        const slotElements = [];
        slotAttrs.forEach((attrs, idx) => {
            const slotEl = document.createElement('div');
            slotEl.className = 'chaos-slot';
            const win = document.createElement('div');
            win.className = 'chaos-slot-window';
            const inner = document.createElement('div');
            inner.className = 'chaos-slot-window-inner chaos-slot-spinning';
            // 构造一个滚动序列，反复循环 attrs，最后一项确保是 finalPicks[idx]
            const cycleCount = 22 + idx * 6;
            const sequence = [];
            for (let i = 0; i < cycleCount; i++) sequence.push(attrs[i % attrs.length]);
            sequence.push(finalPicks[idx]);
            sequence.push(finalPicks[idx]);
            sequence.forEach(attr => {
                const div = document.createElement('div');
                div.innerText = ATTR_LABEL[attr] || attr;
                inner.appendChild(div);
            });
            win.appendChild(inner);
            slotEl.appendChild(win);
            const labelEl = document.createElement('div');
            labelEl.className = 'chaos-slot-label';
            labelEl.innerText = `子弹 ${idx + 1}`;
            slotEl.appendChild(labelEl);
            slotsEl.appendChild(slotEl);
            slotElements.push({ slotEl, inner, sequenceLen: sequence.length });
        });

        overlay.style.display = 'flex';

        const baseSpinDuration = 1200;
        const stagger = 380;
        slotElements.forEach((s, idx) => {
            const targetIdx = s.sequenceLen - 2; // finalPicks 是倒数第二项（最后一项是缓冲）
            const totalDistance = targetIdx * ITEM_HEIGHT;
            s.inner.style.top = '0px';
            s.inner.style.transition = `top ${baseSpinDuration + idx * stagger}ms cubic-bezier(0.15, 0.85, 0.25, 1)`;
            requestAnimationFrame(() => {
                s.inner.style.top = `-${totalDistance}px`;
            });
            setTimeout(() => {
                s.inner.classList.remove('chaos-slot-spinning');
                s.slotEl.classList.add('chaos-slot-locked');
            }, baseSpinDuration + idx * stagger);
        });

        const totalDuration = baseSpinDuration + (slotElements.length - 1) * stagger + 250;
        setTimeout(() => {
            if (allSame) {
                slotElements.forEach(s => s.slotEl.classList.add('chaos-slot-jackpot'));
                const attr = finalPicks[0];
                resultEl.innerText = `🎉 三连同款【${ATTR_LABEL[attr] || attr}】：每枚子弹 ${ATTR_LABEL[attr] || attr} +5`;
            } else {
                const summary = finalPicks.map((p, i) => `子弹${i+1} ${ATTR_LABEL[p] || p} +2`).join(' ｜ ');
                resultEl.innerText = summary;
            }
            continueBtn.style.display = 'inline-flex';
            continueBtn.onclick = () => {
                overlay.style.display = 'none';
                if (typeof onComplete === 'function') onComplete();
            };
        }, totalDuration);
    },

    ui_renderReplaceAmmoUI() {
        // @section:replace_ammo_init - 初始化上下文、获取 DOM 元素并设置标题文字
        const ctx = this.replaceAmmoContext;
        if (!ctx || !ctx.active) return;

        const gridEl = document.getElementById('marble-selection-grid');
        const labelEl = document.getElementById('selection-mode-label');
        const subtitleEl = document.getElementById('selection-mode-subtitle');
        const confirmBtn = document.getElementById('confirm-selection-btn');
        const skipGrindBtn = document.getElementById('skip-grind-btn');
        const countEl = document.getElementById('selected-count');
        const requiredEl = document.getElementById('selected-required-count');
        const recipeHud = document.getElementById('recipe-hud-container');
        const previewPanel = document.getElementById('marble-preview-panel');

        if (recipeHud) recipeHud.classList.add('hidden');
        if (skipGrindBtn) skipGrindBtn.style.display = 'none';
        const _skipChaosBtnInReplace = document.getElementById('skip-chaos-btn');
        if (_skipChaosBtnInReplace) _skipChaosBtnInReplace.style.display = 'none';
        if (previewPanel) previewPanel.className = 'marble-preview-hidden';

        const newRecipes = ctx.newRecipes || [];
        const chargedRecipes = ctx.chargedRecipes || [];
        const bulletCap = (CONFIG.gameplay.selectionReq || 3);
        const maxSelect = Math.min(bulletCap, newRecipes.length + chargedRecipes.length);
        const selectedIndices = ctx.selectedIndices || [];
        const needed = Math.max(0, maxSelect - selectedIndices.length);

        if (labelEl) labelEl.innerText = '子弹替换';
        if (subtitleEl) {
            subtitleEl.style.display = 'block';
            subtitleEl.innerText = '选择最终进入战斗的 ' + maxSelect + ' 枚子弹';
        }
        if (countEl) countEl.innerText = String(selectedIndices.length);
        if (requiredEl) requiredEl.innerText = String(maxSelect);
        this.ui_updateSelectionChoiceStrip();

        // @section:replace_ammo_tier_calc - 子弹等级与主属性计算函数（_calcTier / _calcDominant）
        // [tsk-bullet-ui] 稀有度同时考虑普通属性、连射倍率以及爆破/套娃/激光/共鸣/七彩等特殊属性。
        const _statKeys = ['damage','bounce','pierce','scatter','cryo','pyro','lightning','laser','flying_sword','wind','resonance','venom','overcharge','echo'];
        const _calcSpecialBonus = (recipe) => {
            let bonus = 0;
            if (recipe.explosive) bonus += 8;            // 爆破：等同 1 张 A 级属性
            if (recipe.isMatryoshka) bonus += 6;         // 套娃：连锁载荷
            if (recipe.isLaser) bonus += 5;              // 激光本体
            if (recipe.type === 'rainbow' || recipe._marbleType === 'rainbow') bonus += 6;
            if (recipe.type === 'resonance' || recipe._marbleType === 'resonance') bonus += 4;
            if (recipe.type === 'venom' || recipe._marbleType === 'venom') bonus += 4;
            if (recipe.type === 'overcharge' || recipe._marbleType === 'overcharge') bonus += 5;
            if (recipe.type === 'echo' || recipe._marbleType === 'echo') bonus += 4;
            return bonus;
        };
        const _calcTier = (recipe) => {
            const mc = recipe.multicast || 0;
            const mcTier = mc >= 12 ? 3 : mc >= 6 ? 2 : mc >= 3 ? 1 : 0;
            let statSum = 0;
            _statKeys.forEach(k => { if (recipe[k] > 0) statSum += recipe[k]; });
            statSum += _calcSpecialBonus(recipe);
            const statTier = statSum >= 35 ? 3 : statSum >= 20 ? 2 : statSum >= 8 ? 1 : 0;
            return Math.max(mcTier, statTier);
        };

        const _calcDominant = (recipe) => {
            let statSum = 0;
            let maxKey = null, maxVal = 0;
            _statKeys.forEach(k => {
                const v = recipe[k] || 0;
                if (v > 0) { statSum += v; if (v > maxVal) { maxVal = v; maxKey = k; } }
            });
            // [tsk-bullet-ui] 主题色优先取特殊属性（爆破/激光/飞剑/套娃），保证视觉与玩法对应
            if (recipe.explosive && (!maxKey || maxVal < 6)) maxKey = 'pyro';
            if (recipe.isLaser) { maxKey = 'laser'; maxVal = Math.max(maxVal, 8); }
            if (recipe.isMatryoshka && !maxKey) maxKey = 'lightning';
            if (!maxKey || maxVal <= 5 || statSum === 0 || maxVal / statSum < 0.5) return null;
            const ATTR_THEMES = {
                pyro:        ['linear-gradient(160deg,#7c2d12 0%,#431407 60%,#1c0a03 100%)', '#f97316', '#fdba74', '#7c2d12'],
                cryo:        ['linear-gradient(160deg,#0c4a6e 0%,#082f49 60%,#020f1a 100%)', '#06b6d4', '#bae6fd', '#0c4a6e'],
                lightning:   ['linear-gradient(160deg,#3b0764 0%,#1e0536 60%,#0a0118 100%)', '#c084fc', '#e9d5ff', '#3b0764'],
                laser:       ['linear-gradient(160deg,#0c2a4a 0%,#061525 60%,#020810 100%)', '#60a5fa', '#bfdbfe', '#0c2a4a'],
                bounce:      ['linear-gradient(160deg,#14532d 0%,#052e16 60%,#010f07 100%)', '#22c55e', '#bbf7d0', '#14532d'],
                pierce:      ['linear-gradient(160deg,#7f1d1d 0%,#450a0a 60%,#1a0303 100%)', '#ef4444', '#fecaca', '#7f1d1d'],
                scatter:     ['linear-gradient(160deg,#713f12 0%,#3b1f05 60%,#150b01 100%)', '#eab308', '#fef08a', '#713f12'],
                damage:      ['linear-gradient(160deg,#4a1d96 0%,#2e1065 60%,#0f0528 100%)', '#a855f7', '#e9d5ff', '#4a1d96'],
                wind:        ['linear-gradient(160deg,#064e3b 0%,#022c22 60%,#010f0a 100%)', '#34d399', '#a7f3d0', '#064e3b'],
                flying_sword:['linear-gradient(160deg,#0c4a6e 0%,#082f49 60%,#020f1a 100%)', '#0ea5e9', '#bae6fd', '#0c4a6e'],
                resonance:   ['linear-gradient(160deg,#78350f 0%,#451a03 60%,#1c0a00 100%)', '#f59e0b', '#fde68a', '#78350f'],
                venom:       ['linear-gradient(160deg,#14532d 0%,#052e16 60%,#010f07 100%)', '#4ade80', '#bbf7d0', '#14532d'],
                overcharge:  ['linear-gradient(160deg,#78350f 0%,#451a03 60%,#1c0a00 100%)', '#f59e0b', '#fde68a', '#78350f'],
                echo:        ['linear-gradient(160deg,#0c2a4a 0%,#061525 60%,#020810 100%)', '#60a5fa', '#bfdbfe', '#0c2a4a'],
            };
            const theme = ATTR_THEMES[maxKey] || null;
            return theme ? { key: maxKey, val: maxVal, theme } : null;
        };

        const TIER_STYLES = [
            { label: 'C', labelColor: '#94a3b8', borderIdle: '#475569', bgIdle: 'rgba(30,41,59,0.75)', bgSelected: 'rgba(245,158,11,0.12)', pulseClass: '' },
            { label: 'B', labelColor: '#34d399', borderIdle: '#34d399', bgIdle: 'rgba(6,78,59,0.35)', bgSelected: 'rgba(245,158,11,0.15)', pulseClass: 'pulse-b' },
            { label: 'A', labelColor: '#c084fc', borderIdle: '#c084fc', bgIdle: 'rgba(88,28,135,0.35)', bgSelected: 'rgba(245,158,11,0.15)', pulseClass: 'pulse-a' },
            { label: 'S', labelColor: '#facc15', borderIdle: '#facc15', bgIdle: 'rgba(120,53,15,0.40)', bgSelected: 'rgba(245,158,11,0.22)', pulseClass: 'pulse-s' },
        ];

        // @section:replace_ammo_card_render - 子弹卡片 DOM 渲染：renderCard + makeRow + 将卡片添加到网格
        if (gridEl) {
            // [BUGFIX v2] 改用绝对定位方案，彻底绕开多层 flex 高度链传递问题。
            // 原方案依赖 flex:1 逐层传递高度（phase-selection→parentEl→gridEl→wrapper→row→cards），
            // 任何一层的 padding/items-center/justify-content:space-between 都可能导致高度塌陷。
            // 新方案：parentEl 设为 position:relative，gridEl 绝对定位充满 parentEl，
            // 完全绕开 flex 高度传递，gridEl 的高度 = parentEl 的实际高度（由 flex:1 正确分配）。
            const parentEl = gridEl.parentElement;
            if (parentEl) {
                parentEl.style.position = 'relative';
                parentEl.style.overflow = 'hidden';
            }
            gridEl.style.cssText = 'position:absolute;inset:0;display:flex;flex-direction:column;padding:0;max-width:none;margin:0;gap:0;overflow:hidden;';
            gridEl.innerHTML = '';

            const wrapper = document.createElement('div');
            wrapper.style.cssText = 'width:100%;flex:1;min-height:0;overflow:hidden;display:flex;flex-direction:column;gap:12px;box-sizing:border-box;padding:20px 12px 4px;';

            const renderCard = (recipe, globalIdx) => {
                const isSelected = selectedIndices.includes(globalIdx);
                const tier = _calcTier(recipe);
                const ts = TIER_STYLES[tier];
                const dominant = _calcDominant(recipe);

                const cardWrap = document.createElement('div');
                // [tsk-bullet-ui] 添加 .replace-ammo-card 类用于全局 hover 样式（鼠标悬浮时上抬+加亮）
                cardWrap.className = 'replace-ammo-card';
                cardWrap.style.cssText = 'position:relative;border-radius:12px;overflow:visible;height:100%;display:flex;flex-direction:column;box-sizing:border-box;transition:transform 0.25s cubic-bezier(0.34,1.56,0.64,1), box-shadow 0.25s ease;';
                cardWrap.tabIndex = 0;
                cardWrap.setAttribute('role', 'button');
                cardWrap.setAttribute('aria-pressed', isSelected ? 'true' : 'false');
                cardWrap.title = isSelected ? '已选择，点击或按 Enter 取消' : '点击或按 Enter 选择这枚子弹';
                cardWrap.dataset.dominantColor = dominant ? dominant.theme[1] : ts.borderIdle;
                // [bitmap-replace-ammo] 标记稀有度，CSS 用 [data-tier] 切换 9-Slice 边框
                cardWrap.dataset.tier = ['C','B','A','S'][tier] || 'C';
                if (isSelected) {
                    cardWrap.style.margin = '0 6px';
                    cardWrap.style.transform = 'translateY(-8px) scale(1.05)';
                    cardWrap.style.boxShadow = '0 12px 32px rgba(0,0,0,0.6), 0 0 20px ' + (dominant ? dominant.theme[1] : ts.borderIdle) + '44';
                }

                const card = document.createElement('div');
                card.className = isSelected ? ts.pulseClass : '';
                if (dominant) {
                    const [bgGrad, accent, embossL, embossD] = dominant.theme;
                    const embossOverlay = 'linear-gradient(135deg,' + embossL + '22 0%,transparent 40%,transparent 60%,' + embossD + '44 100%)';
                    card.style.background = bgGrad;
                    const embossLayer = document.createElement('div');
                    embossLayer.style.cssText = 'position:absolute;inset:0;border-radius:12px;pointer-events:none;background:' + embossOverlay + ';';
                    cardWrap.appendChild(embossLayer);
                } else {
                    card.style.background = isSelected ? ts.bgSelected : ts.bgIdle;
                }

                const qualityBorder = dominant ? dominant.theme[1] : ts.borderIdle;
                card.style.cssText += [
                    'position:relative',
                    'display:flex',
                    'flex-direction:column',
                    'align-items:stretch',
                    'padding:24px 6px 8px',
                    'border-radius:12px',
                    'cursor:pointer',
                    'user-select:none',
                    'flex:1',
                    'height:100%',
                    'border:2px solid ' + qualityBorder,
                    isSelected ? 'outline:2px solid #f59e0b;outline-offset:3px;' : 'outline:none;',
                ].join(';');
                cardWrap.appendChild(card);

                const iconArea = document.createElement('div');
                // [tsk-bullet-ui] 顶部图标常驻：所有卡片都展示主属性图标（原来仅在 isSelected 时浮动）
                iconArea.style.cssText = 'position:absolute;top:-18px;left:50%;transform:translateX(-50%);z-index:20;pointer-events:none;';
                iconArea.className = isSelected ? 'card-floating' : 'card-icon-idle';

                const attrIcons = (typeof CONFIG !== 'undefined' && CONFIG.ui && CONFIG.ui.attributeDisplay) ? CONFIG.ui.attributeDisplay : {};
                // [tsk-bullet-ui] 主属性优先识别：爆破/激光/套娃/连射 等特殊属性优先显示，其次才是数值最高的元素属性
                let mainAttrKey;
                if (recipe.explosive) mainAttrKey = 'explosive';
                else if (recipe.isLaser) mainAttrKey = 'laser';
                else if (recipe.isMatryoshka) mainAttrKey = 'matryoshka';
                else if (recipe.type === 'rainbow' || recipe._marbleType === 'rainbow') mainAttrKey = 'rainbow';
                else if (recipe.type === 'resonance' || recipe._marbleType === 'resonance') mainAttrKey = 'resonance';
                else if (recipe.type === 'venom' || recipe._marbleType === 'venom') mainAttrKey = 'venom';
                else if (recipe.type === 'overcharge' || recipe._marbleType === 'overcharge') mainAttrKey = 'overcharge';
                else if (recipe.type === 'echo' || recipe._marbleType === 'echo') mainAttrKey = 'echo';
                else if (dominant) mainAttrKey = dominant.key;
                else mainAttrKey = recipe.pyro > 0 ? 'pyro' : recipe.cryo > 0 ? 'cryo' : recipe.lightning > 0 ? 'lightning' : 'damage';
                const mainAttrInfo = attrIcons[mainAttrKey] || { icon: '🔮', color: '#94a3b8' };
                const _iconBorderColor = (mainAttrInfo.color && mainAttrInfo.color.indexOf('gradient') === -1) ? mainAttrInfo.color : '#facc15';

                // [icon-fix] 替换子弹卡片：优先使用与命运选择卡片一致的 ammo 位图
                const ammoBitmapSrc = getAmmoIconSrcByKey(mainAttrKey);
                const iconInner = ammoBitmapSrc
                    ? `<img src="${ammoBitmapSrc}" alt="${mainAttrInfo.icon}" style="width:24px;height:24px;object-fit:contain;display:block;" loading="lazy" onerror="this.outerHTML='${(mainAttrInfo.icon || '').replace(/'/g, '&#39;')}';" />`
                    : (mainAttrInfo.icon || '');
                iconArea.innerHTML = `
                    <div style="width:38px;height:38px;background:rgba(15,23,42,0.92);border:2px solid ${_iconBorderColor};border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:20px;box-shadow:0 4px 12px rgba(0,0,0,0.55), 0 0 10px ${_iconBorderColor}88;">
                        ${iconInner}
                    </div>
                `;
                cardWrap.appendChild(iconArea);

                const tierBadge = document.createElement('div');
                tierBadge.style.cssText = 'position:absolute;top:4px;left:6px;font-size:10px;font-weight:900;padding:1px 4px;border-radius:4px;z-index:12;color:' + (dominant ? dominant.theme[1] : ts.labelColor) + ';background:rgba(15,23,42,0.8);border:1px solid ' + (dominant ? dominant.theme[1] : ts.labelColor) + ';';
                tierBadge.innerText = tier === 3 ? '✦ S' : tier === 2 ? 'A' : tier === 1 ? 'B' : 'C';
                card.appendChild(tierBadge);

                // [tsk-bullet-ui] 显示数值属性 + 特殊属性（爆破/套娃/激光/连射/七彩/共鸣）
                const attrKeys = ['damage','bounce','pierce','scatter','cryo','pyro','lightning','laser','flying_sword','wind','resonance','venom','overcharge','echo'];
                const sortedAttrs = attrKeys
                    .map(k => ({ key: k, val: recipe[k] || 0 }))
                    .filter(a => a.val > 0)
                    .sort((a, b) => b.val - a.val);

                const specialAttrs = [];
                if (recipe.explosive) specialAttrs.push({ key: 'explosive', label: '✓' });
                if (recipe.isMatryoshka) specialAttrs.push({ key: 'matryoshka', label: '✓' });
                if (recipe.isLaser && (recipe.laser || 0) === 0) specialAttrs.push({ key: 'laser', label: '✓' });
                if (recipe.type === 'rainbow' || recipe._marbleType === 'rainbow') specialAttrs.push({ key: 'rainbow', label: '✓' });
                if (recipe.type === 'resonance' || recipe._marbleType === 'resonance') specialAttrs.push({ key: 'resonance', label: '✓' });
                if (recipe.type === 'venom' || recipe._marbleType === 'venom') specialAttrs.push({ key: 'venom', label: '✓' });
                if (recipe.type === 'overcharge' || recipe._marbleType === 'overcharge') specialAttrs.push({ key: 'overcharge', label: '✓' });
                if (recipe.type === 'echo' || recipe._marbleType === 'echo') specialAttrs.push({ key: 'echo', label: '✓' });
                if ((recipe.multicast || 0) > 0) specialAttrs.push({ key: 'multicast', label: 'x' + recipe.multicast });

                const attrsContainer = document.createElement('div');
                attrsContainer.style.cssText = 'display:flex;flex-direction:column;gap:3px;margin-top:auto;width:100%;';

                // 特殊属性优先显示在顶部（更醒目），数值属性补足到 4 行
                const allRows = specialAttrs.concat(sortedAttrs).slice(0, 4);
                allRows.forEach(attr => {
                    const info = attrIcons[attr.key] || {};
                    const isSpecial = attr.label !== undefined;
                    const valText = isSpecial ? attr.label : String(attr.val);
                    const borderColor = (info.color && info.color.indexOf('gradient') === -1) ? info.color : '#facc15';
                    const labelColor = borderColor;
                    const row = document.createElement('div');
                    row.style.cssText = `display:flex;align-items:center;justify-content:space-between;width:100%;padding:2px 6px;background:rgba(0,0,0,${isSpecial ? '0.45' : '0.3'});border-radius:4px;border-left:2px solid ${borderColor};`;
                    row.innerHTML = `
                        <span style="font-size:10px;color:${labelColor};display:flex;align-items:center;gap:2px;">
                            <span style="font-size:11px;">${info.icon || '◆'}</span>
                            <span>${info.name || attr.key}</span>
                        </span>
                        <span style="font-size:11px;font-weight:800;color:#fff;">${valText}</span>
                    `;
                    attrsContainer.appendChild(row);
                });
                card.appendChild(attrsContainer);

                cardWrap.onclick = () => this.ui_toggleReplaceAmmoCard(globalIdx);
                cardWrap.onkeydown = (e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        this.ui_toggleReplaceAmmoCard(globalIdx);
                    }
                };
                return cardWrap;
            };

            const makeRow = (recipes, startIdx, headerText, headerColor) => {
                const row = document.createElement('div');
                row.style.cssText = 'display:flex;flex-direction:column;gap:6px;flex:1;min-height:0;overflow:hidden;';
                const header = document.createElement('div');
                header.style.cssText = 'font-size:11px;color:' + headerColor + ';font-weight:800;text-align:center;text-transform:uppercase;letter-spacing:1px;margin-bottom:4px;';
                header.innerText = headerText;
                row.appendChild(header);
                const cards = document.createElement('div');
                cards.style.cssText = 'display:grid;gap:8px;width:100%;flex:1;min-height:0;align-content:stretch;';
                cards.style.gridTemplateColumns = 'repeat(' + recipes.length + ', 1fr)';
                cards.style.gridTemplateRows = '1fr';
                recipes.forEach((recipe, i) => {
                    cards.appendChild(renderCard(recipe, startIdx + i));
                });
                row.appendChild(cards);
                return row;
            };

            if (newRecipes.length > 0) wrapper.appendChild(makeRow(newRecipes, 0, '✨ NEW GRIND', '#38bdf8'));
            if (chargedRecipes.length > 0) wrapper.appendChild(makeRow(chargedRecipes, newRecipes.length, '⚡ CHARGED', '#fbbf24'));
            gridEl.appendChild(wrapper);
        }

        // @section:replace_ammo_confirm_btn - 确认按鈕与跳过按鈕状态同步
        if (confirmBtn) {
            confirmBtn.disabled = maxSelect <= 0 || selectedIndices.length !== maxSelect;
            confirmBtn.innerText = '确认（已选 ' + selectedIndices.length + '/' + maxSelect + '）';
            confirmBtn.innerText = maxSelect <= 0
                ? '没有可用子弹'
                : '确认（已选 ' + selectedIndices.length + '/' + maxSelect + '）';
            confirmBtn.title = confirmBtn.disabled
                ? (maxSelect <= 0 ? '当前没有可用子弹' : `还需要选择 ${needed} 枚子弹`)
                : '确认这些子弹并进入战斗';
            confirmBtn.setAttribute('aria-disabled', confirmBtn.disabled ? 'true' : 'false');
            confirmBtn.onclick = () => { if (typeof this.sys_confirmReplaceAmmo === 'function') this.sys_confirmReplaceAmmo(); };
        }

        let hintEl = document.getElementById('selection-action-hint');
        if (!hintEl && confirmBtn && confirmBtn.parentNode) {
            hintEl = document.createElement('div');
            hintEl.id = 'selection-action-hint';
            hintEl.className = 'selection-action-hint';
            confirmBtn.parentNode.insertBefore(hintEl, confirmBtn);
        }
        if (hintEl) {
            hintEl.style.display = 'block';
            hintEl.className = 'selection-action-hint' + (needed > 0 || maxSelect <= 0 ? ' warn' : '');
            hintEl.innerText = maxSelect <= 0
                ? '没有可用子弹，无法进入战斗。'
                : needed > 0
                    ? `还需要选择 ${needed} 枚子弹。`
                    : '选择完成，可以确认进入战斗。';
        }

        let skipBtn = document.getElementById('replace-ammo-skip-btn');
        if (!skipBtn) {
            skipBtn = document.createElement('button');
            skipBtn.id = 'replace-ammo-skip-btn';
            skipBtn.className = 'mt-2 flex items-center gap-1.5 px-4 py-2 bg-slate-800/80 border border-slate-600/60 rounded-lg text-xs text-slate-300 hover:bg-slate-700/80 hover:border-slate-400/80 hover:text-white transition-all duration-200';
            skipBtn.innerHTML = '<span>⏩</span><span>跳过，使用新研磨子弹</span>';
            if (confirmBtn && confirmBtn.parentNode) confirmBtn.parentNode.insertBefore(skipBtn, confirmBtn.nextSibling);
        }
        // [bullet-replace-fix] 纯净精华跳过研磨场景下没有「新研磨子弹」可回退，
        // 跳过将导致 ammoQueue 为空进入战斗死循环，因此仅在有新研磨子弹时显示该按钮。
        skipBtn.style.display = newRecipes.length > 0 ? 'flex' : 'none';
        skipBtn.onclick = () => { if (typeof this.sys_skipReplaceAmmo === 'function') this.sys_skipReplaceAmmo(); };
    },

    ui_toggleReplaceAmmoCard(globalIdx) {
        const ctx = this.replaceAmmoContext;
        if (!ctx || !ctx.active) return;
        const selectedIndices = ctx.selectedIndices || [];
        const bulletCap = (CONFIG.gameplay.selectionReq || 3);
        const maxSelect = Math.min(bulletCap, ((ctx.newRecipes || []).length + (ctx.chargedRecipes || []).length));
        const idx = selectedIndices.indexOf(globalIdx);
        if (idx > -1) {
            selectedIndices.splice(idx, 1);
        } else if (selectedIndices.length < maxSelect) {
            selectedIndices.push(globalIdx);
        } else {
            showToast(`最多选择 ${maxSelect} 枚子弹`);
        }
        ctx.selectedIndices = selectedIndices;
        this.ui_renderReplaceAmmoUI();
    },

    ui_selectReplaceAmmoTarget(ammoIdx) {
        if (this.replaceAmmoContext) this.replaceAmmoContext.selectedIndex = ammoIdx;
    },

    ui_rerollMarbleSelection() {
        if (this.phase !== 'selection' || (this.replaceAmmoContext && this.replaceAmmoContext.active)) return;
        if (!(this.ownedRelics || []).includes('fate_reroll_token')) {
            if (window.showToast) showToast('需要遗物「命运重铸币」才能刷新弹珠候选。');
            return;
        }
        if (this.selectionRerollUsed) {
            if (window.showToast) showToast('本次命运抉择已经刷新过。');
            return;
        }
        this.selectionRerollUsed = true;
        this.selectedMarbles = [];
        this.selectionInjectedRune = null;
        this.selectionPreviewState = null;
        const countEl = document.getElementById('selected-count');
        const confirmBtn = document.getElementById('confirm-selection-btn');
        if (countEl) countEl.innerText = '0';
        if (confirmBtn) confirmBtn.disabled = true;
        if (typeof this.spawn_generateMarbleOptions === 'function') this.spawn_generateMarbleOptions();
        if (typeof this.ui_refreshSelectionModeUI === 'function') this.ui_refreshSelectionModeUI();
        if (window.showToast) showToast('弹珠候选已刷新。');
        if (typeof this.sys_saveRunState === 'function') this.sys_saveRunState();
    },

    ui_refreshSelectionModeUI() {
        // [ammo-replace] \u5982\u679c\u5f53\u524d\u5904\u4e8e\u66ff\u6362\u9636\u6bb5\uff0c\u8df3\u8fc7\u666e\u901a\u9009\u62e9 UI \u5237\u65b0\uff0c\u6539\u7531 ui_renderReplaceAmmoUI \u63a7\u5236
        if (this.replaceAmmoContext && this.replaceAmmoContext.active) {
            const rerollBtn = document.getElementById('selection-reroll-btn');
            if (rerollBtn) rerollBtn.style.display = 'none';
            this.ui_renderReplaceAmmoUI();
            return;
        }
        const countEl = document.getElementById('selected-count');
        const requiredEl = document.getElementById('selected-required-count');
        const labelEl = document.getElementById('selection-mode-label');
        const subtitleEl = document.getElementById('selection-mode-subtitle');
        const confirmBtn = document.getElementById('confirm-selection-btn');
        const selectedCount = (this.selectedMarbles || []).length;
        const required = this.ui_getSelectionRequirement();
        // [pure_essence \u4fee\u590d] \u7eaf\u51c0\u7cbe\u534e\u6a21\u5f0f\u4e0b\u5c55\u793a\u5355\u5361\u5c45\u4e2d\u5e03\u5c40
        const gridEl = document.getElementById('marble-selection-grid');
        if (gridEl) {
            if (this.selectionMode === 'pure_essence') {
                gridEl.style.gridTemplateColumns = '1fr';
                gridEl.style.maxWidth = '160px';
            } else {
                gridEl.style.gridTemplateColumns = '';
                gridEl.style.maxWidth = '';
            }
        }
        // [pure_essence] \u63a7\u5236\u300c\u8df3\u8fc7\u7814\u78e8\u300d\u6309\u9215\u7684\u663e\u793a/\u9690\u85cf
        const skipGrindBtn = document.getElementById('skip-grind-btn');
        if (skipGrindBtn) {
            skipGrindBtn.style.display = (this.selectionMode === 'pure_essence') ? 'flex' : 'none';
        }
        // [chaos-skip-upgrade] \u6df7\u6c8c\u7cbe\u534e\u8df3\u8fc7\u6309\u94ae\uff1a\u4ec5\u5728\u6df7\u6c8c\u7cbe\u534e\u6a21\u5f0f\u4e0b\uff0c\u4e14\u5b58\u5728\u53ef\u5347\u7ea7\u7684\u5145\u80fd\u5b50\u5f39\u65f6\u663e\u793a
        const skipChaosBtn = document.getElementById('skip-chaos-btn');
        if (skipChaosBtn) {
            const hasChargedAmmo = Array.isArray(this._chargedAmmoQueue) && this._chargedAmmoQueue.length > 0;
            skipChaosBtn.style.display = (this.selectionMode === 'chaos_essence' && hasChargedAmmo) ? 'flex' : 'none';
        }
        // [tsk-668f3dba] \u8fdb\u5165\u6b63\u5e38\u9009\u62e9\u9636\u6bb5\u65f6\u9690\u85cf\u66ff\u6362\u8df3\u8fc7\u6309\u9215
        const replaceSkipBtn = document.getElementById('replace-ammo-skip-btn');
        if (replaceSkipBtn) replaceSkipBtn.style.display = 'none';
        const actionHint = document.getElementById('selection-action-hint');
        if (actionHint) {
            actionHint.innerText = '';
            actionHint.style.display = 'none';
        }
        if (countEl) countEl.innerText = String(selectedCount);
        if (requiredEl) requiredEl.innerText = String(required);
        this.ui_updateSelectionChoiceStrip();
        if (labelEl) {
            labelEl.innerText = this.selectionMode === 'pure_essence'
                ? '\u7d14\u6de8\u7cbe\u83ef'
                : this.selectionMode === 'chaos_essence'
                    ? '\u6df7\u6c8c\u7cbe\u83ef'
                    : '\u80da\u73e0\u5305';
        }
        if (subtitleEl) {
            if (this.selectionMode === 'pure_essence') {
                const injected = this.selectionInjectedRune
                    ? `\u5df2\u9078\uff1a${this.selectionInjectedRune.icon || '\u2726'} ${this.selectionInjectedRune.name}`
                    : '\u5c1a\u672a\u6ce8\u5165\u7b26\u6587';
                subtitleEl.style.display = 'block';
                subtitleEl.classList.remove('hidden');
                subtitleEl.innerText = `\u9078\u64c7 1 \u679a\u5f48\u73e0\u4e26\u6ce8\u5165 1 \u500b\u5408\u6cd5\u7b26\u6587\u3002${injected}`;
            } else if (this.selectionMode === 'chaos_essence') {
                subtitleEl.style.display = 'block';
                subtitleEl.classList.remove('hidden');
                subtitleEl.innerText = `\u547d\u904b\u6642\u523b\u5df2\u958b\u555f\uff0c\u8acb\u9078\u64c7 ${required} \u679a\u5f48\u73e0\u5f8c\u9032\u5165\u7df4\u91d1\u3002`;
            } else {
                subtitleEl.style.display = 'block';
                subtitleEl.classList.remove('hidden');
                subtitleEl.innerText = `从本包胚珠中保留 ${required} 颗，作为本轮晶石核心的充能序列。`;
            }
        }
        if (confirmBtn) {
            confirmBtn.disabled = !this.ui_isSelectionConfirmReady();
            confirmBtn.innerText = this.selectionMode === 'pure_essence'
                ? '\u6ce8\u5165\u5f8c\u958b\u59cb\u7df4\u91d1'
                : this.selectionMode === 'chaos_essence'
                    ? '\u63a5\u53d7\u547d\u904b\u5f8c\u958b\u59cb\u7df4\u91d1'
                    : '\u958b\u59cb\u7df4\u91d1';
        }
        let rerollBtn = document.getElementById('selection-reroll-btn');
        if (!rerollBtn && confirmBtn && confirmBtn.parentNode) {
            rerollBtn = document.createElement('button');
            rerollBtn.id = 'selection-reroll-btn';
            rerollBtn.className = 'mb-2 flex items-center gap-1.5 px-4 py-2 bg-cyan-900/50 border border-cyan-500/60 rounded-lg text-xs text-cyan-100 hover:bg-cyan-800/70 hover:border-cyan-300/80 transition-all duration-200';
            confirmBtn.parentNode.insertBefore(rerollBtn, confirmBtn);
        }
        if (rerollBtn) {
            const hasRerollRelic = (this.ownedRelics || []).includes('fate_reroll_token');
            const canReroll = hasRerollRelic && !this.selectionRerollUsed && this.phase === 'selection';
            rerollBtn.style.display = canReroll ? 'flex' : 'none';
            rerollBtn.innerHTML = '<span>🪙</span><span>刷新弹珠候选</span>';
            rerollBtn.onclick = () => this.ui_rerollMarbleSelection();
        }
        if (this.selectionPreviewState) {
            this.ui_renderPureEssencePanel(this.selectionPreviewState.marble, this.selectionPreviewState.selectionIndex);
        } else {
            this.ui_renderPureEssencePanel(null, -1);
        }
    },

    _meta_ensureResourceStore() {
        if (!this.saveData) this.saveData = {};
        if (!this.saveData.resources || typeof this.saveData.resources !== 'object') {
            this.saveData.resources = {};
        }

        const resources = this.saveData.resources;
        const storedFragments = Number(resources.rune_fragments || 0);
        const legacyFragments = Number(this.saveData.runeFragments || 0);
        const legacyCurrency = Number(this.saveData.currency || 0);
        let canonicalFragments = storedFragments;
        if (!storedFragments && (legacyFragments || legacyCurrency)) {
            canonicalFragments = legacyFragments + legacyCurrency;
        } else {
            canonicalFragments = Math.max(storedFragments, legacyFragments, legacyCurrency);
        }
        resources.rune_fragments = Math.max(0, Math.floor(canonicalFragments || 0));
        this.saveData.runeFragments = resources.rune_fragments;
        this.saveData.currency = resources.rune_fragments;
        return resources;
    },

    _meta_getRuneInventoryResourceCount(resourceId) {
        const resource = META_SHOP_CONFIG.resources[resourceId];
        if (!resource || !resource.element) return 0;
        const runeById = new Map((RUNE_DB || []).map(r => [r.id, r]));
        return (this.runeInventory || this.saveData?.runeInventory || []).reduce((count, item) => {
            const runeId = typeof item === 'string' ? item : item?.id;
            const rune = runeById.get(runeId);
            return count + (rune && rune.element === resource.element ? 1 : 0);
        }, 0);
    },

    meta_getResourceCount(resourceId) {
        const resources = this._meta_ensureResourceStore();
        const stored = Math.max(0, Math.floor(Number(resources[resourceId] || 0)));
        return stored + this._meta_getRuneInventoryResourceCount(resourceId);
    },

    meta_spendResource(resourceId, amount) {
        const cost = Math.max(0, Math.floor(Number(amount || 0)));
        const resources = this._meta_ensureResourceStore();
        if (this.meta_getResourceCount(resourceId) < cost) return false;

        if (resourceId === 'rune_fragments') {
            resources.rune_fragments = Math.max(0, (resources.rune_fragments || 0) - cost);
            this.saveData.runeFragments = resources.rune_fragments;
            this.saveData.currency = resources.rune_fragments;
        } else {
            let remaining = cost;
            const fromStored = Math.min(resources[resourceId] || 0, remaining);
            resources[resourceId] = (resources[resourceId] || 0) - fromStored;
            remaining -= fromStored;
            if (remaining > 0) {
                const resource = META_SHOP_CONFIG.resources[resourceId];
                const runeById = new Map((RUNE_DB || []).map(r => [r.id, r]));
                const inventory = (this.runeInventory || this.saveData?.runeInventory || []).slice();
                for (let i = inventory.length - 1; i >= 0 && remaining > 0; i--) {
                    const runeId = typeof inventory[i] === 'string' ? inventory[i] : inventory[i]?.id;
                    const rune = runeById.get(runeId);
                    if (rune && rune.element === resource?.element) {
                        inventory.splice(i, 1);
                        remaining--;
                    }
                }
                this.runeInventory = inventory;
                if (this.saveData) this.saveData.runeInventory = inventory.slice();
                this.ui_updateRuneCountDisplay();
            }
        }

        this.sys_saveData();
        this.ui_updateMetaCurrency();
        return true;
    },

    ui_updateUI() {
        // [BUGFIX] 使用 _isRuneLauncherOpen() 兼容 PC 模式和移动端模式
        const runeLauncherEl = document.getElementById('phase-rune-launcher');
        const launcherVisible = this._isRuneLauncherOpen ? this._isRuneLauncherOpen()
            : (runeLauncherEl && runeLauncherEl.style.display !== 'none');
        const terminalPhase = ['meta', 'shop', 'truth_book', 'gameover'].includes(this.phase);
        if (terminalPhase) {
            this.ui_clearTransientOverlays({ keepRuneLauncher: launcherVisible });
        }

        // 1. 隐藏所有阶段的主容器 (.ui-overlay)
        // [BUGFIX] 符文发射器打开时跳过隐藏，防止每次调用将其强制关闭
        document.querySelectorAll('.ui-overlay').forEach(el => {
            if (el === runeLauncherEl && launcherVisible) return;
            el.style.display = 'none';
            el.classList.add('hidden-phase');
            el.classList.remove('active-phase');
            el.style.pointerEvents = 'none';
        });

        // 2. 显示当前阶段的主容器
        // [BUGFIX] 符文发射器打开期间，跳过底层阶段面板的重新激活，
        // 防止 #marble-selection-grid 等子元素（pointer-events: auto）遮挡发射器 Tab 按钮
        if (!launcherVisible) {
            const activeEl = document.getElementById(`phase-${this.phase}`);
            if (activeEl) {
                activeEl.style.display = (this.phase === 'gameover') ? 'block' : 'flex';
                // [BUGFIX] 将 'selection' 加入 needsAuto 列表：
                // phase-selection 的父容器 pointer-events 必须为 auto，
                // 否则底部「開始煉金」按钮无法响应点击（父容器 none 会阻断事件传递）。
                // [BUGFIX] 将 'training' 加入 needsAuto 列表：
                // 试炼场 #phase-training 是 DOM 驱动的（场景列表/属性 +/- 按钮/退出按钮等），
                // 默认 pointer-events:none 会让所有按钮失效（点击穿透到底层 canvas）。
                const needsAuto = ['meta', 'shop', 'truth_book', 'gameover', 'relic', 'pause', 'selection', 'training'].includes(this.phase);
                activeEl.style.pointerEvents = needsAuto ? 'auto' : 'none';
                setTimeout(() => {
                    activeEl.classList.remove('hidden-phase');
                    activeEl.classList.add('active-phase');
                }, 10);
            }
        }

        // 3. 各阶段专属 UI 更新
        this.ui_updateMetaCurrency();
        this.ui_updateRuneCountDisplay();
        this.ui_updateShieldPill();
        if (typeof this.ui_updateRunShopScheduleUI === 'function') {
            this.ui_updateRunShopScheduleUI();
        }
        this.ui_updateCombatStatusPanel(true);
        if (this.phase !== 'combat') {
            this.ui_resetCombatPhaseHud({ preserveStatusPanel: this.phase === 'training' });
        } else {
            this.ui_hideModuleEditorEntry();
        }
        if (this.phase === 'meta') {
            this.meta_updateContinueButton();
        }
        if (this.phase === 'selection') {
            if (this.replaceAmmoContext && this.replaceAmmoContext.active) {
                this.ui_renderReplaceAmmoUI();
            } else {
                this.ui_refreshSelectionModeUI();
            }
        }

        // [PC 布局 #3] 同步左侧栏「收集 / 战斗」内容显隐
        if (typeof this._ui_updateLeftSidebarContent === 'function') {
            this._ui_updateLeftSidebarContent(this.phase);
        }
        const pcSidebarPhaseActive = ['gathering', 'combat', 'selection', 'training'].includes(this.phase);
        const pcSidebarVisible = document.body.classList.contains('pc-mode') && pcSidebarPhaseActive;
        const pcLeftSidebar = document.getElementById('pc-left-sidebar');
        const pcRightSidebar = document.getElementById('pc-right-sidebar');
        if (pcLeftSidebar) pcLeftSidebar.style.display = pcSidebarVisible ? 'flex' : 'none';
        if (pcRightSidebar) pcRightSidebar.style.display = pcSidebarVisible ? 'flex' : 'none';

        // 4. 底部面板：仅在收集阶段且非 PC 模式下显示
        const bottomPanel = document.querySelector('.bottom-panel');
        if (bottomPanel) {
            const isPCMode = document.body.classList.contains('pc-mode');
            bottomPanel.style.display = (this.phase === 'gathering' && !isPCMode) ? 'flex' : 'none';
        }

        // 5. 技能栏：仅在战斗阶段且有已解锁技能时显示
        const skillBar = document.getElementById('skill-bar');
        if (skillBar) {
            const hasSkills = this.activeSkills && this.activeSkills.length > 0;
            skillBar.style.display = (this.phase === 'combat' && hasSkills) ? 'flex' : 'none';
        }

        // 6. 连击倍率显示
        const multiplierEl = document.getElementById('multiplier-display');
        if (multiplierEl) {
            multiplierEl.style.opacity = (this.phase === 'combat') ? '1' : '0';
        }

        // 7. 统一顶部栏：在全屏阶段隐藏
        const unifiedTopBar = document.getElementById('unified-top-bar');
        if (unifiedTopBar) {
            const hideInPhases = ['meta', 'shop', 'truth_book', 'training', 'relic', 'selection', 'gameover'];
            const shouldHideTopBar = hideInPhases.includes(this.phase) && !(typeof this.ui_isFateMomentPhase === 'function' && this.ui_isFateMomentPhase());
            unifiedTopBar.classList.toggle('is-gathering', this.phase === 'gathering');
            unifiedTopBar.classList.toggle('is-combat', this.phase === 'combat' || this.phase === 'training');
            unifiedTopBar.style.display = shouldHideTopBar ? 'none' : 'grid';
        }
        const topPhaseLabel = document.getElementById('top-phase-label');
        if (topPhaseLabel) {
            const topLabelMap = {
                gathering: '研磨',
                combat: '战斗',
                training: '试炼',
            };
            topPhaseLabel.textContent = topLabelMap[this.phase] || '';
        }

        // 8. 战斗充能符文 UI
        const runeChargeUi = document.getElementById('combat-rune-charge-ui');
        if (runeChargeUi) {
            runeChargeUi.style.display = (this.phase === 'combat') ? 'flex' : 'none';
        }
    },

    ui_updatePCLayout() {
        const isPC = window.innerWidth > 1024;
        const wasPC = document.body.classList.contains('pc-mode');
        document.body.classList.toggle('pc-mode', isPC);
        const leftSidebar = document.getElementById('pc-left-sidebar');
        const rightSidebar = document.getElementById('pc-right-sidebar');
        const sidebarPhaseActive = ['gathering', 'combat', 'selection'].includes(this.phase);
        if (leftSidebar) leftSidebar.style.display = (isPC && sidebarPhaseActive) ? 'flex' : 'none';
        if (rightSidebar) rightSidebar.style.display = (isPC && sidebarPhaseActive) ? 'flex' : 'none';

        // [PC 布局恢复 #3] 实际把右侧符文发射器、左侧 info-drawer / 收集队列 / 配方 HUD
        // 迁移到 PC 侧边栏；离开 PC 模式时再迁回原始位置。
        this._ui_migrateRuneLauncherToSidebar(isPC);
        this._ui_migrateDrawerToLeftSidebar(isPC);
        this._ui_migrateHUDToLeftSidebar(isPC);
        this._ui_updateLeftSidebarContent(this.phase, wasPC);
    },

    _ui_updateLeftSidebarContent(phase /* , wasPC */) {
        const gatheringPane = document.getElementById('pc-left-gathering');
        const combatPane = document.getElementById('pc-left-combat');
        const isPC = document.body.classList.contains('pc-mode');
        if (!gatheringPane || !combatPane) return;
        if (!isPC) {
            gatheringPane.style.display = 'none';
            combatPane.style.display = 'none';
            return;
        }
        if (phase === 'gathering' || phase === 'selection') {
            gatheringPane.style.display = 'flex';
            combatPane.style.display = 'none';
        } else if (phase === 'combat') {
            gatheringPane.style.display = 'none';
            combatPane.style.display = 'flex';
        } else {
            gatheringPane.style.display = 'none';
            combatPane.style.display = 'none';
        }
    },

    /**
     * @description 在 PC / 移动模式之间迁移指定元素。第一次调用时记录原始 parent，
     * 之后通过 dataset 标志位把元素移入侧边栏挂载点 / 还原回原父节点。
     */
    _ui_movePanelTo(elId, mountId, toSidebar) {
        const el = document.getElementById(elId);
        const mount = document.getElementById(mountId);
        if (!el) return;
        if (toSidebar) {
            if (!mount) return;
            if (el.parentElement !== mount) {
                if (!el.dataset.originalParentId) {
                    const origParent = el.parentElement;
                    if (origParent) {
                        if (!origParent.id) origParent.id = '_orig_parent_' + elId;
                        el.dataset.originalParentId = origParent.id;
                    }
                }
                mount.appendChild(el);
            }
        } else {
            const origId = el.dataset.originalParentId;
            if (origId) {
                const origParent = document.getElementById(origId);
                if (origParent && el.parentElement !== origParent) {
                    origParent.appendChild(el);
                }
            }
        }
    },

    _ui_migrateDrawerToLeftSidebar(toSidebar) {
        this._ui_movePanelTo('info-drawer', 'pc-left-drawer-mount', toSidebar);
    },

    _ui_migrateHUDToLeftSidebar(toSidebar) {
        this._ui_movePanelTo('gathering-queue', 'pc-left-queue-mount', toSidebar);
        this._ui_movePanelTo('gathering-hud-mount', 'pc-left-recipe-mount', toSidebar);
    },

    _ui_migrateRuneLauncherToSidebar(toSidebar) {
        this._ui_movePanelTo('phase-rune-launcher', 'pc-right-rune-mount', toSidebar);
        // PC 模式下符文发射器常驻显示
        const launcher = document.getElementById('phase-rune-launcher');
        if (launcher && toSidebar) {
            launcher.style.display = 'flex';
        }
    },

    /**
     * @method ui_confirmSelection
     * @description 确认玩家选择的弹珠，将 selectedMarbles 映射为 marbleQueue，
     * 处理 pure_essence 注入逻辑，清理选择状态，并进入收集（研磨）阶段。
     * [BUGFIX] 原实现调用不存在的 sys_confirmSelection，导致点击"开始炼金"无响应。
     */
    ui_confirmSelection() {
        // [BUGFIX] 如果当前处于子弹替换阶段，应由 sys_confirmReplaceAmmo 处理，
        // 防止 ui_initEventListeners 绑定的 onclick 在替换阶段被误触发导致进入研磨阶段。
        if (this.replaceAmmoContext && this.replaceAmmoContext.active) {
            console.warn('[ui_confirmSelection] 检测到 replaceAmmoContext 激活，转发到 sys_confirmReplaceAmmo');
            if (typeof this.sys_confirmReplaceAmmo === 'function') this.sys_confirmReplaceAmmo();
            return;
        }
        const required = this.ui_getSelectionRequirement();
        if ((this.selectedMarbles || []).length !== required) {
            console.warn('[DEBUG] ui_confirmSelection: 选中的弹珠数量不符合要求，当前为:', (this.selectedMarbles || []).length, '要求为:', required);
            return;
        }
        this.marbleQueue = this.selectedMarbles.map(i => this.marblesPool[i]);

        if (this.selectionMode === 'pure_essence') {
            const injected = this.selectionInjectedRune;
            const selectedIndex = this.selectedMarbles[0];
            const marble = this.marbleQueue[0];
            if (injected) {
                // Combine the rune with the selected marble: keep the marble type and add rune stats.
                if (injected.marbleIndex !== selectedIndex) {
                    if (typeof showToast === 'function') showToast('純淨精華尚未完成符文注入。');
                    return;
                }
                if (!Array.isArray(marble.collected)) marble.collected = [];
                const injectCount = Math.max(1, injected.level || 1) * Math.max(1, injected.baseStatPerLevel || 1);
                marble.collected.push({ type: injected.element, level: injectCount, source: 'pure_essence_rune' });
                marble.source = 'pure_essence';
                marble.infusedRuneId = injected.runeId;
                marble.infusedAttribute = injected.element;
                marble.assimilationMultiplier = Math.max(1, (typeof CONFIG !== 'undefined' && CONFIG.gameplay.assimilationDoubleMultiplier) || 2);
                if (!this.doubleAssimilationBoostRounds) this.doubleAssimilationBoostRounds = {};
                this.doubleAssimilationBoostRounds[marble.type] = Math.max(this.doubleAssimilationBoostRounds[marble.type] || 0, 1);
                if (Array.isArray(this.runeInventory) && injected.inventoryIndex >= 0) {
                    this.runeInventory.splice(injected.inventoryIndex, 1);
                    if (this.saveData) this.saveData.runeInventory = (this.runeInventory || []).slice();
                }
                this.ui_updateRuneCountDisplay();
                const multiplier = (typeof CONFIG !== 'undefined' && CONFIG.gameplay.assimilationDoubleMultiplier) || 2;
                if (typeof showToast === 'function') showToast(`已為 ${marble.getName()} 合成 ${injected.icon || '✦'} ${injected.name}，本輪子彈獲得 ${injected.element} +${injectCount}，同化率 x${multiplier}。`);
            } else {
                // [feat] 无符文注入时直接进入研磨（纯净精华单弹珠，无同化加成）
                marble.source = 'pure_essence';
                if (typeof showToast === 'function') showToast(`純淨精華：未注入符文，直接進入研磨。`);
            }
        }

        // 清理替换上下文（如果存在）
        this.replaceAmmoContext = null;

        this.selectionMode = 'standard';
        this.selectionRequiredCount = ((typeof CONFIG !== 'undefined' && CONFIG.gameplay.selectionReq) || 3);
        this.selectionInjectedRune = null;
        this.selectionPreviewState = null;
        this.fateMomentContext = null;
        this.phase_startGatheringPhase();
    },

    meta_applyUpgrades() {
        if (typeof this.sys_applyUpgrades === 'function') this.sys_applyUpgrades();
    },

    meta_addCurrency(amount, resourceId = 'rune_fragments') {
        const resources = this._meta_ensureResourceStore();
        const add = Math.max(0, Math.floor(Number(amount || 0)));
        resources[resourceId] = Math.max(0, Math.floor(Number(resources[resourceId] || 0))) + add;
        if (resourceId === 'rune_fragments') {
            this.saveData.runeFragments = resources.rune_fragments;
            this.saveData.currency = resources.rune_fragments;
        }
        this.sys_saveData();
        this.ui_updateMetaCurrency();
    },

    meta_startRun() {
        // [局内存档] 新开一局时清除旧存档
        this.sys_clearRunState();
        this.sys_resetGame();
        this.sys_initGameStart();
        // sys_initGameStart 内部已经调用了 ui_showRelicSelection
    },

    meta_continueRun() {
        const ok = this.sys_loadRunState();
        if (!ok) {
            if (typeof showToast === 'function') showToast('⚠️ 存档读取失败，请开始新游戏');
        }
    },

    meta_updateContinueButton() {
        const btn = document.getElementById('meta-continue-btn');
        if (btn) btn.style.display = this.sys_hasRunState() ? 'block' : 'none';
    },

    meta_openShop() {
        this.phase_switchPhase('shop');
        // meta_currentShopCategory 初始化由 ui_renderShop 内部处理（META_SHOP_CONFIG 在 shop_system 中导入）
        if (!this.meta_currentShopCategory) {
            this.meta_currentShopCategory = 'attribute';
        }
        this.ui_renderShop();
    },

    meta_calculateUpgradeCost(upgrade, level) {
        if (upgrade.cost.type === 'fixed') return upgrade.cost.values[level] || 0;
        return Math.floor(upgrade.cost.base * Math.pow(upgrade.cost.growth, level));
    },

    meta_buyUpgrade(upgradeId) {
        const upgrade = META_SHOP_CONFIG.upgrades.find(u => u.id === upgradeId);
        if (!upgrade) return false;
        const debugShopDisabled = typeof localStorage !== 'undefined'
            && localStorage.getItem('echo_debug_shop') === '0';
        const debugShopEnabled = !debugShopDisabled && (
            CONFIG.debugShopDefaultEnabled === true
            || CONFIG.debug === true
            || this.debugMode === true
            || (typeof localStorage !== 'undefined' && localStorage.getItem('echo_debug_shop') === '1')
        );
        if (upgrade.debugOnly && !debugShopEnabled) {
            if (typeof showToast === 'function') showToast('测试商品未启用');
            return false;
        }

        if (upgrade.effect && upgrade.effect.type === 'debug_pick_any_relic') {
            if (typeof this.ui_showRelicSelection === 'function') {
                this.relicOverlayReturnState = { phase: 'shop' };
                this.ui_showRelicSelection({
                    resumeTarget: 'shop',
                    source: 'debug_pick_any_relic',
                    showAllRelics: true,
                });
                if (typeof showToast === 'function') showToast('测试模式：请选择任意遗物');
                return true;
            }
            return false;
        }

        const isTemporary = upgrade.temporary || false;
        const store = isTemporary
            ? (this.saveData.temporaryUpgrades ||= {})
            : (this.saveData.upgrades ||= {});
        const level = store[upgrade.id] || 0;
        if (level >= upgrade.maxLevel) {
            if (typeof showToast === 'function') showToast('已达到最高等级');
            return false;
        }

        const cost = this.meta_calculateUpgradeCost(upgrade, level);
        const resourceId = upgrade.cost.resourceId || 'rune_fragments';
        if (!this.meta_spendResource(resourceId, cost)) {
            if (typeof showToast === 'function') showToast('资源不足');
            return false;
        }

        store[upgrade.id] = level + 1;
        if (upgrade.effect && upgrade.effect.path) {
            setDeepValue(CONFIG, upgrade.effect.path, upgrade.effect.valuePerLevel, upgrade.effect.type);
        }
        this.sys_saveData();
        if (typeof this.ui_renderShop === 'function') this.ui_renderShop();
        if (typeof showToast === 'function') showToast(`已购买：${upgrade.name}`);
        return true;
    },

    ui_onPhaseChange(newPhase) {
        // [BUGFIX] 移除多余的 ui_updateUI() 调用：
        // phase_switchPhase 已经调用过 ui_updateUI()，再在 ui_onPhaseChange 里重复调用
        // 会导致用旧的 selectionMode 重新渲染上一次的命运选择卡片。
        if (newPhase === 'selection' && this.replaceAmmoContext && this.replaceAmmoContext.active) {
            this.ui_renderReplaceAmmoUI();
        }
    },

    ui_triggerScreenShake(duration = 200) {
        const container = document.getElementById('game-container');
        if (!container) return;
        container.classList.add('shake-hard');
        setTimeout(() => container.classList.remove('shake-hard'), duration);
    },

    ui_initEventListeners() {
        const confirmBtn = document.getElementById('confirm-selection-btn');
        if (confirmBtn) confirmBtn.onclick = () => this.ui_confirmSelection();
        window.addEventListener('resize', () => this.ui_updatePCLayout());
    },

    ui_openTruthBook(options = {}) {
        const fromPhase = this.phase || 'meta';
        const returnablePhases = new Set(['selection', 'gathering', 'combat', 'shop']);
        const defaultReturnState = returnablePhases.has(fromPhase)
            ? {
                phase: fromPhase,
                selectionMode: this.selectionMode || null,
                fateMomentContext: this.fateMomentContext ? { ...this.fateMomentContext } : null,
            }
            : { phase: 'meta' };
        this.truthBookReturnState = options.returnState || defaultReturnState;

        if (this.trainingGround && this.trainingGround.active && typeof this.trainingGround.exit === 'function') {
            this.trainingGround.exit();
            this.truthBookReturnState = { phase: 'meta' };
        }
        if (typeof this.phase_switchPhase === 'function') {
            this.phase_switchPhase('truth_book');
        } else {
            this.phase = 'truth_book';
            this.ui_updateUI();
        }

        const panel = document.getElementById('phase-truth-book');
        if (panel) {
            panel.style.display = 'flex';
            panel.style.pointerEvents = 'auto';
            panel.classList.remove('hidden-phase');
            panel.classList.add('active-phase');
        }
        if (this.truthBook) {
            if (typeof this.truthBook.initUI === 'function') this.truthBook.initUI();
            if (typeof this.truthBook.resize === 'function') this.truthBook.resize();
        }
    },

    ui_closeTruthBook() {
        if (this.truthBook) {
            this.truthBook.active = false;
            this.truthBook.currentEntry = null;
            this.truthBook.demoGame = null;
        }
        const panel = document.getElementById('phase-truth-book');
        if (panel) {
            panel.style.display = 'none';
            panel.style.pointerEvents = 'none';
            panel.classList.add('hidden-phase');
            panel.classList.remove('active-phase');
        }
        const returnState = this.truthBookReturnState || { phase: 'meta' };
        this.truthBookReturnState = null;
        const targetPhase = returnState.phase && returnState.phase !== 'truth_book'
            ? returnState.phase
            : 'meta';

        if (targetPhase === 'selection') {
            if (returnState.selectionMode) this.selectionMode = returnState.selectionMode;
            if (returnState.fateMomentContext) this.fateMomentContext = { ...returnState.fateMomentContext };
        }

        if (typeof this.phase_switchPhase === 'function') {
            this.phase_switchPhase(targetPhase);
        } else {
            this.phase = targetPhase;
            this.ui_updateUI();
        }

        if (targetPhase === 'selection' && typeof this.ui_refreshSelectionModeUI === 'function') {
            this.ui_refreshSelectionModeUI();
        } else if (targetPhase === 'shop' && typeof this.ui_renderShop === 'function') {
            this.ui_renderShop();
        }
    },

    ui_openPause() {
        // [BUGFIX #5] 暂停/设置面板的 DOM id 是 `phase-pause`，原代码错把它当成 `pause-overlay` 处理，
        // 导致点击「⚙️」按鈕没有任何反应。这里改为正确的 id，并补上 hidden-phase / display 切换。
        const pause = document.getElementById('phase-pause');
        if (!pause) return;
        if (!this.isPaused) {
            this._pausedFromPhase = this.phase;
        }
        this.isPaused = true;
        pause.classList.remove('hidden');
        pause.classList.remove('hidden-phase');
        pause.classList.add('active-phase');
        pause.style.display = 'flex';
        pause.style.zIndex = '900';
        pause.style.pointerEvents = 'auto';
        if (typeof this.ui_syncPauseSettings === 'function') this.ui_syncPauseSettings();
    },

    ui_closePause() {
        const pause = document.getElementById('phase-pause');
        this.isPaused = false;
        this._pausedFromPhase = null;
        if (!pause) return;
        pause.classList.add('hidden');
        pause.classList.add('hidden-phase');
        pause.classList.remove('active-phase');
        pause.style.display = 'none';
        pause.style.pointerEvents = 'none';
    },

    ui_abandonRunToMeta() {
        this.ui_closePause();
        if (typeof this.ui_clearTransientOverlays === 'function') this.ui_clearTransientOverlays();
        if (typeof this.ui_closeRuneLauncher === 'function') this.ui_closeRuneLauncher();
        if (typeof this.sys_clearRunState === 'function') this.sys_clearRunState();
        if (typeof this.sys_resetGame === 'function') this.sys_resetGame();
        if (typeof this.phase_switchPhase === 'function') this.phase_switchPhase('meta');
        if (typeof this.meta_updateContinueButton === 'function') this.meta_updateContinueButton();
    },

    ui_syncPauseSettings() {
        if (typeof this.ui_renderPauseRelics === 'function') this.ui_renderPauseRelics();
        // 同步渲染品质按钮高亮
        const activeLevel = this.perfQualityLevel;
        const isAuto = !this._perfManualMode;
        ['low', 'medium', 'high', 'auto'].forEach(id => {
            const btn = document.getElementById(`pause-perf-${id}`);
            if (!btn) return;
            const isActive = id === 'auto' ? isAuto : (!isAuto && id === activeLevel);
            btn.classList.toggle('active', isActive);
        });
    },
    ui_renderPauseRelics() {
        const list = document.getElementById('pause-relic-list');
        if (!list) return;
        const owned = (this.ownedRelics || []);
        if (owned.length === 0) {
            list.innerHTML = '<div class="pause-empty-relics">尚未获得任何遗物</div>';
            return;
        }
        // 统计每件遗物的拥有数量
        const counts = {};
        owned.forEach(id => { counts[id] = (counts[id] || 0) + 1; });
        const html = Object.entries(counts).map(([id, count]) => {
            const def = RELIC_DB.find(r => r.id === id) || { name: id, icon: '❓', desc: '' };
            const stack = count > 1 ? ` <span style="color:#fbbf24;font-weight:bold;">×${count}</span>` : '';
            return `
                <div style="display:flex;align-items:flex-start;gap:8px;padding:8px;margin-bottom:6px;background:rgba(30,41,59,0.6);border:1px solid rgba(100,116,139,0.3);border-radius:8px;">
                    <span style="font-size:20px;line-height:1;">${def.icon || '🔮'}</span>
                    <div style="flex:1;min-width:0;">
                        <div style="font-size:12px;font-weight:bold;color:#e2e8f0;">${def.name}${stack}</div>
                        <div style="font-size:10px;color:#94a3b8;margin-top:2px;line-height:1.4;">${def.desc || ''}</div>
                    </div>
                </div>`;
        }).join('');
        list.innerHTML = html;
    },

    // ======================================================================
    // [v2 重构] 钉板内嵌编辑器
    // ======================================================================
    // 设计目标（用户需求）：
    //   - 直接在实时钉板画布上编辑，能看到真实的钉盘区域；
    //   - 每个「可编辑钉盘区域」（已解锁的模块槽）用虚框描边标出（由 canvas 绘制）；
    //   - 点击空槽 → 打开库存装备组件；点击已装备槽 → 卸下组件并放回库存。
    // 画布上的虚框绘制见 game_phase.js: render_moduleEditorOverlay；
    // 点击命中检测见 game_system.js: input_handleInputStart → _moduleEditor_handleClick。
    _moduleEditorState: null,
    _moduleEditorPlacementPreview: null,

    _moduleEditor_ensureStyles() {
        if (document.getElementById('module-editor-styles')) return;
        const styleEl = document.createElement('style');
        styleEl.id = 'module-editor-styles';
        styleEl.textContent = ME_STYLES;
        document.head.appendChild(styleEl);
    },

    ui_showModuleEditorEntry() {
        const container = document.getElementById('game-container');
        if (!container || this._moduleEditorActive) return;
        this._moduleEditor_ensureStyles();
        const inventory = this._moduleEditor_normalizeComponentInventory
            ? this._moduleEditor_normalizeComponentInventory()
            : normalizeModuleInventory(this.ownedModuleComponents);
        let layer = document.getElementById('module-editor-entry-layer');
        if (!layer) {
            layer = document.createElement('div');
            layer.id = 'module-editor-entry-layer';
            layer.className = 'me-edit-entry';
            container.appendChild(layer);
        }
        layer.innerHTML = `<button id="me-edit-entry-btn" class="me-btn me-btn--edit-entry">编辑钉板<span>库存 ${inventory.length}</span></button>`;
        const btn = layer.querySelector('#me-edit-entry-btn');
        if (btn) btn.addEventListener('click', () => this.ui_showModuleEditor());
    },

    ui_hideModuleEditorEntry() {
        const layer = document.getElementById('module-editor-entry-layer');
        if (layer) layer.remove();
    },

    /**
     * 进入钉板编辑模式。此时游戏已处于 gathering 阶段且实时钉板已构建，
     * 本方法只负责：标记编辑态、冻结倾斜、挂载顶部 / 底部 DOM 控件。
     */
    ui_showModuleEditor(onComplete) {
        const cfg = CONFIG.gameplay || {};
        const cols = cfg.moduleCols || 4;
        const rows = cfg.moduleRows || 3;
        const totalSlots = cols * rows;

        // ---- 确保布局 / 解锁字段已初始化 ----
        if (!Array.isArray(this.currentModuleLayout)) {
            this.currentModuleLayout = createDefaultModuleLayout(totalSlots, cfg.moduleDefaultSlots || 3);
        }
        this.currentModuleLayout = ensureModuleLayoutInstances(
            this.currentModuleLayout,
            totalSlots,
            cfg.moduleDefaultSlots || 3
        );
        this.ownedModuleComponents = normalizeModuleInventory(this.ownedModuleComponents);
        if (!Array.isArray(this.unlockedModuleTypes)) {
            this.unlockedModuleTypes = [];
        }
        if (typeof this.unlockedModuleSlots !== 'number') {
            this.unlockedModuleSlots = cfg.moduleDefaultSlots || 3;
        }

        this._moduleEditorState = { onComplete: onComplete || null };
        this._moduleEditorActive = true;
        this._moduleEditorSelectedComponentUid = null;
        this._moduleEditorSelectedSlotIdx = null;
        this.ui_hideModuleEditorEntry();

        // 编辑期间冻结钉板倾斜，使虚框与指针 1:1 对齐
        if (this.boardTilt) {
            this.boardTilt.target = { x: 0, y: 0 };
            this.boardTilt.current = { x: 0, y: 0 };
        }

        // ---- 注入样式 ----
        this._moduleEditor_ensureStyles();

        this.ui_renderModuleEditorControls();
    },

    /**
     * 渲染 / 刷新编辑器的 DOM 控件（顶部标题条 + 底部操作条）。
     * 真正的钉盘区域虚框由 canvas 在 render_moduleEditorOverlay 中绘制。
     */
    ui_renderModuleEditorControls() {
        const container = document.getElementById('game-container');
        if (!container) return;
        let layer = document.getElementById('module-editor-layer');
        if (!layer) {
            layer = document.createElement('div');
            layer.id = 'module-editor-layer';
            container.appendChild(layer);
        }

        const cfg = CONFIG.gameplay || {};
        const totalSlots = (cfg.moduleCols || 4) * (cfg.moduleRows || 3);
        const activeSlots = getActiveModuleSlots(
            this.unlockedModuleSlots || cfg.moduleDefaultSlots || 3,
            totalSlots,
            cfg
        );
        const layout = this.currentModuleLayout || [];
        let placed = 0;
        for (const i of activeSlots) {
            const e = layout[i];
            if (e && !isModuleRef(e) && getModuleIdFromEntry(e)) placed++;
        }

        const inventory = this._moduleEditor_normalizeComponentInventory();
        if (this._moduleEditorSelectedComponentUid && !inventory.some(item => item && item.uid === this._moduleEditorSelectedComponentUid)) {
            this._moduleEditorSelectedComponentUid = null;
        }
        const componentCount = inventory.length;
        const runeCount = Array.isArray(this.runeInventory) ? this.runeInventory.length : 0;
        const runeBtnHtml = runeCount > 0
            ? `<button id="me-rune-btn" class="me-btn me-btn--rune">✨ 符文融合<span class="me-rune-badge">${runeCount}</span></button>`
            : '';
        const fusionSummaryHtml = this._moduleEditor_buildFusionSummaryHtml();
        const selectedComponent = inventory.find(item => item && item.uid === this._moduleEditorSelectedComponentUid) || null;
        const selectedComponentId = getModuleIdFromEntry(selectedComponent);
        const selectedSlotIdx = Number.isInteger(this._moduleEditorSelectedSlotIdx) ? this._moduleEditorSelectedSlotIdx : null;
        const selectedSlotEntry = selectedSlotIdx !== null ? layout[selectedSlotIdx] : null;
        const selectedSlotId = getModuleIdFromEntry(selectedSlotEntry);
        const selectedSlotDef = selectedSlotId ? MODULE_DEFS[selectedSlotId] : null;
        const selectedComponentDef = selectedComponentId ? MODULE_DEFS[selectedComponentId] : null;
        const inventoryHtml = inventory.length > 0
            ? `<div class="me-inventory-grid">${inventory.map(component => {
                const id = getModuleIdFromEntry(component);
                const def = MODULE_DEFS[id];
                if (!def) return '';
                const selected = component.uid === this._moduleEditorSelectedComponentUid ? ' is-selected' : '';
                return `<button type="button" class="me-inventory-item${selected}" data-inventory-uid="${_escapeHtml(component.uid)}" data-module-id="${_escapeHtml(id)}" title="${_escapeHtml(getModuleMetaSummary(id) || def.desc || '')}">
                    <span class="me-inventory-icon">${def.icon || '▦'}</span>
                    <span class="me-inventory-name">${_escapeHtml(def.name || id)}</span>
                </button>`;
            }).join('')}</div>`
            : '<div class="me-inventory-empty">库存为空：去商店购买钉板组件后会出现在这里。</div>';
        const slotLabel = selectedSlotIdx === null
            ? '未选择槽位'
            : `槽位 ${selectedSlotIdx + 1}`;
        const slotBody = selectedSlotIdx === null
            ? '点击钉板上的槽位查看已装备组件，或先从库存选择组件。'
            : selectedSlotDef
                ? `已装备：${selectedSlotDef.icon || '▦'} ${selectedSlotDef.name || selectedSlotId}`
                : '空槽：可装备库存中的组件。';
        const canEquipSelected = !!(selectedComponent && selectedSlotIdx !== null);
        const canUnequipSelected = !!(selectedSlotId && selectedSlotIdx !== null);
        const slotPanelHtml = `
            <div class="me-slot-panel">
                <div class="me-slot-title">${_escapeHtml(slotLabel)}</div>
                <div class="me-slot-body">
                    <div>${_escapeHtml(slotBody)}</div>
                    <div>${selectedComponentDef ? `已选库存：${_escapeHtml(selectedComponentDef.name || selectedComponentId)}` : '未选库存组件'}</div>
                </div>
                <div class="me-slot-actions">
                    <button id="me-equip-selected-btn" class="me-action-btn me-action-btn--equip" ${canEquipSelected ? '' : 'disabled'}>装备到槽位</button>
                    <button id="me-unequip-selected-btn" class="me-action-btn me-action-btn--danger" ${canUnequipSelected ? '' : 'disabled'}>卸下</button>
                    <button id="me-clear-selection-btn" class="me-action-btn">取消选择</button>
                </div>
            </div>`;

        layer.innerHTML = `
            <div class="me-topbar">
                <div class="me-topbar-title">⚙ 钉板编辑</div>
                <div class="me-topbar-hint">先选库存，再选槽位装备；选中已装备槽可卸下 · 已装备 ${placed}/${activeSlots.length} · 库存 ${componentCount}</div>
            </div>
            ${fusionSummaryHtml}
            <div class="me-inventory-panel">
                <div>
                    <div class="me-inventory-title">组件库存</div>
                    ${inventoryHtml}
                </div>
                ${slotPanelHtml}
            </div>
            <div class="me-bottombar">
                ${runeBtnHtml}
                <button id="me-start-btn" class="me-btn me-btn--start">完成编辑</button>
            </div>
        `;

        const startBtn = layer.querySelector('#me-start-btn');
        if (startBtn) startBtn.addEventListener('click', () => this._moduleEditor_tryStartCollection());
        const runeBtn = layer.querySelector('#me-rune-btn');
        if (runeBtn) runeBtn.addEventListener('click', () => this._moduleEditor_openRunePicker());
        layer.querySelectorAll('[data-inventory-uid]').forEach(btn => {
            btn.addEventListener('click', () => {
                this._moduleEditorSelectedComponentUid = btn.dataset.inventoryUid || null;
                if (Number.isInteger(this._moduleEditorSelectedSlotIdx)) {
                    this._moduleEditor_setPlacementPreview(this._moduleEditorSelectedSlotIdx, btn.dataset.moduleId || null, { mode: 'candidate' });
                }
                this.ui_renderModuleEditorControls();
            });
        });
        const equipBtn = layer.querySelector('#me-equip-selected-btn');
        if (equipBtn) equipBtn.addEventListener('click', () => {
            if (Number.isInteger(this._moduleEditorSelectedSlotIdx) && this._moduleEditorSelectedComponentUid) {
                this._moduleEditor_applyModule(this._moduleEditorSelectedSlotIdx, this._moduleEditorSelectedComponentUid);
            }
        });
        const unequipBtn = layer.querySelector('#me-unequip-selected-btn');
        if (unequipBtn) unequipBtn.addEventListener('click', () => {
            if (Number.isInteger(this._moduleEditorSelectedSlotIdx)) {
                this._moduleEditor_unequipComponent(this._moduleEditorSelectedSlotIdx);
            }
        });
        const clearBtn = layer.querySelector('#me-clear-selection-btn');
        if (clearBtn) clearBtn.addEventListener('click', () => {
            this._moduleEditorSelectedComponentUid = null;
            this._moduleEditorSelectedSlotIdx = null;
            this._moduleEditorPlacementPreview = null;
            this.ui_renderModuleEditorControls();
        });
    },

    _moduleEditor_showNotice(message, options = {}) {
        const layer = document.getElementById('module-editor-layer');
        const host = document.getElementById('me-picker-backdrop')
            || document.getElementById('me-rune-picker-backdrop')
            || layer;
        if (!host) {
            if (typeof showToast === 'function') showToast(message);
            return;
        }
        const type = options.type || 'error';
        const detail = options.detail || '';
        let alert = host.querySelector('#me-editor-alert');
        if (!alert) {
            alert = document.createElement('div');
            alert.id = 'me-editor-alert';
            alert.className = 'me-editor-alert';
            host.appendChild(alert);
        }
        alert.dataset.type = type;
        alert.innerHTML = `
            <div class="me-editor-alert__icon">${type === 'info' ? 'i' : '!'}</div>
            <div class="me-editor-alert__body">
                <div class="me-editor-alert__title">${_escapeHtml(message)}</div>
                ${detail ? `<div class="me-editor-alert__detail">${_escapeHtml(detail)}</div>` : ''}
            </div>
        `;
        if (this._moduleEditorNoticeTimer) clearTimeout(this._moduleEditorNoticeTimer);
        this._moduleEditorNoticeTimer = setTimeout(() => {
            const current = document.getElementById('me-editor-alert');
            if (current) current.remove();
            this._moduleEditorNoticeTimer = null;
        }, options.duration || 3200);
    },

    _moduleEditor_clearNotice() {
        if (this._moduleEditorNoticeTimer) {
            clearTimeout(this._moduleEditorNoticeTimer);
            this._moduleEditorNoticeTimer = null;
        }
        const alert = document.getElementById('me-editor-alert');
        if (alert) alert.remove();
    },

    _moduleEditor_validateBeforeStart() {
        const cfg = CONFIG.gameplay || {};
        const cols = cfg.moduleCols || 4;
        const rows = cfg.moduleRows || 3;
        const totalSlots = cols * rows;
        const layout = this.currentModuleLayout || [];
        const unlockedCount = this.unlockedModuleSlots || cfg.moduleDefaultSlots || 3;
        const activeSlots = getActiveModuleSlots(unlockedCount, totalSlots, cfg);
        const activeSet = getActiveModuleSlotSet(unlockedCount, totalSlots, cfg);

        if (!Array.isArray(this.currentModuleLayout) || this.currentModuleLayout.length !== totalSlots) {
            return { ok: false, reason: '钉板布局尚未初始化', detail: '请重新打开编辑器，或更换一个组件后再开始采集。' };
        }

        const emptySlots = activeSlots.filter(i => !layout[i]);
        if (emptySlots.length > 0) {
            return {
                ok: false,
                reason: `还有 ${emptySlots.length} 个钉板槽未放置组件`,
                detail: '点击空槽安装组件，或先在商店购买更多钉板组件。',
            };
        }

        const seenCovered = new Set();
        for (const i of activeSlots) {
            const entry = layout[i];
            if (!entry) continue;
            if (isModuleRef(entry)) {
                if (!activeSet.has(entry.ref) || !getModuleIdFromEntry(layout[entry.ref])) {
                    return { ok: false, reason: '钉板占位引用失效', detail: `槽位 ${i + 1} 指向了不存在的组件。` };
                }
                continue;
            }

            const moduleId = getModuleIdFromEntry(entry);
            if (!moduleId) {
                return { ok: false, reason: '钉板组件数据异常', detail: `槽位 ${i + 1} 没有有效组件 ID。` };
            }
            const span = getModuleSpan(moduleId);
            const covered = getCoveredSlots(i, span, cols, rows);
            if (!covered) {
                return { ok: false, reason: `${span.cols}x${span.rows} 组件越过钉板边界`, detail: `请调整槽位 ${i + 1} 的组件。` };
            }
            if (covered.some(ci => !activeSet.has(ci))) {
                return { ok: false, reason: `${span.cols}x${span.rows} 组件超出已解锁区域`, detail: `请把槽位 ${i + 1} 的组件换成更小组件，或先扩展槽位。` };
            }
            for (const ci of covered) {
                if (seenCovered.has(ci)) {
                    return { ok: false, reason: '钉板组件覆盖区域重叠', detail: `槽位 ${ci + 1} 被多个组件覆盖。` };
                }
                seenCovered.add(ci);
                if (ci !== i) {
                    const ref = layout[ci];
                    if (!isModuleRef(ref) || ref.ref !== i) {
                        return { ok: false, reason: '多格组件占位未同步', detail: `槽位 ${ci + 1} 应该被槽位 ${i + 1} 的组件占用。` };
                    }
                }
            }
        }

        if (this._moduleEditorRunePreview) {
            return { ok: false, reason: '还有未确认的符文融合预览', detail: '请先确认融合，或关闭符文融合弹层取消预览。' };
        }

        return { ok: true, reason: '', detail: '' };
    },

    _moduleEditor_tryStartCollection() {
        const validation = this._moduleEditor_validateBeforeStart();
        if (!validation.ok) {
            this._moduleEditor_showNotice(validation.reason, { detail: validation.detail });
            if (typeof showToast === 'function') showToast(validation.reason);
            return;
        }
        this._moduleEditor_clearNotice();
        this.ui_hideModuleEditor();
    },

    /**
     * 退出编辑模式：移除 DOM 控件与浮层，恢复正常采集输入。
     */
    ui_hideModuleEditor() {
        this._moduleEditorActive = false;
        const onComplete = (this._moduleEditorState || {}).onComplete;
        this._moduleEditorState = null;
        this._moduleEditorSelectedComponentUid = null;
        this._moduleEditorSelectedSlotIdx = null;
        const layer = document.getElementById('module-editor-layer');
        if (layer) layer.remove();
        this._moduleEditor_clearNotice();
        this._moduleEditor_closePicker();
        if (this.phase === 'gathering' && typeof this.ui_showModuleEditorEntry === 'function') {
            this.ui_showModuleEditorEntry();
        }
        if (typeof onComplete === 'function') onComplete();
    },

    /**
     * [命中检测] 在编辑模式下点击画布时调用，logicPos 为画布坐标。
     * 命中槽位时只更新当前选中槽；装备/卸下由库存栏和槽位操作按钮确认。
     */
    _moduleEditor_handleClick(logicPos) {
        const rects = this._moduleEditor_getSlotRects();
        for (const r of rects) {
            if (logicPos.x >= r.rect.x && logicPos.x <= r.rect.x + r.rect.w &&
                logicPos.y >= r.rect.y && logicPos.y <= r.rect.y + r.rect.h) {
                this._moduleEditorSelectedSlotIdx = r.idx;
                if (this._moduleEditorSelectedComponentUid) {
                    const component = this._moduleEditor_normalizeComponentInventory()
                        .find(item => item && item.uid === this._moduleEditorSelectedComponentUid);
                    this._moduleEditor_setPlacementPreview(r.idx, getModuleIdFromEntry(component), { mode: 'candidate' });
                } else {
                    this._moduleEditor_setPlacementPreview(r.idx, r.moduleId || null, { mode: 'target' });
                }
                this.ui_renderModuleEditorControls();
                return;
            }
        }
    },

    /**
     * 计算所有「可编辑钉盘区域」的画布矩形。
     * 可编辑区域 = moduleUnlockOrder 的前 unlockedModuleSlots 个槽位（与 phase_gathering_initPachinko_v2 一致）。
     * 多格模块只在锚点处返回合并后的矩形；被覆盖的 ref 槽不返回独立矩形。
     * 返回 [{ idx, rect:{x,y,w,h}, moduleId }]
     */
    _moduleEditor_getSlotRects() {
        const cfg = CONFIG.gameplay || {};
        const cols = cfg.moduleCols || 4;
        const rows = cfg.moduleRows || 3;
        const totalSlots = cols * rows;
        const activeSlots = getActiveModuleSlots(
            this.unlockedModuleSlots || cfg.moduleDefaultSlots || 3,
            totalSlots,
            cfg
        );
        const w = (this.width && this.width > 0) ? this.width : 400;
        const h = (this.height && this.height > 0) ? this.height : 600;
        const layout = this.currentModuleLayout || [];
        const out = [];
        for (const i of activeSlots) {
            const entry = layout[i];
            if (isModuleRef(entry)) continue; // 被多格模块覆盖
            const moduleId = getModuleIdFromEntry(entry);
            const span = moduleId ? getModuleSpan(moduleId) : { cols: 1, rows: 1 };
            const rect = calcModuleSlotRect(i, w, h, cfg, span);
            out.push({ idx: i, rect, moduleId });
        }
        return out;
    },

    /**
     * 弹出「更换模块」浮层，slotIdx 为目标槽位锚点索引。
     */
    _moduleEditor_getModulePlacementStatus(slotIdx, moduleId) {
        const cfg = CONFIG.gameplay || {};
        const cols = cfg.moduleCols || 4;
        const rows = cfg.moduleRows || 3;
        const totalSlots = cols * rows;
        const activeSlotSet = getActiveModuleSlotSet(
            this.unlockedModuleSlots || cfg.moduleDefaultSlots || 3,
            totalSlots,
            cfg
        );
        const layout = this.currentModuleLayout || [];
        if (!MODULE_DEFS[moduleId]) {
            return { ok: false, reason: '模块不存在', covered: [], span: { cols: 1, rows: 1 } };
        }

        const span = getModuleSpan(moduleId);
        const covered = getCoveredSlots(slotIdx, span, cols, rows);
        if (!covered) {
            return { ok: false, reason: `${span.cols}x${span.rows} 超出钉盘边界`, covered: [], span };
        }
        if (covered.some(ci => !activeSlotSet.has(ci))) {
            return { ok: false, reason: `需要 ${span.cols}x${span.rows} 空间，超出已解锁区域`, covered, span };
        }

        const currentCovered = new Set([slotIdx]);
        const current = layout[slotIdx];
        const currentId = getModuleIdFromEntry(current);
        if (currentId) {
            const oldCovered = getCoveredSlots(slotIdx, getModuleSpan(currentId), cols, rows) || [slotIdx];
            oldCovered.forEach(ci => currentCovered.add(ci));
        }

        for (const ci of covered) {
            if (currentCovered.has(ci)) continue;
            const occ = layout[ci];
            const occId = getModuleIdFromEntry(occ);
            if (occId) {
                const name = (MODULE_DEFS[occId] && MODULE_DEFS[occId].name) || '相邻模块';
                return { ok: false, reason: `与 ${name} 重叠`, covered, span };
            }
            if (isModuleRef(occ) && occ.ref !== slotIdx) {
                const anchorId = getModuleIdFromEntry(layout[occ.ref]);
                const name = (MODULE_DEFS[anchorId] && MODULE_DEFS[anchorId].name) || '相邻模块';
                return { ok: false, reason: `与 ${name} 重叠`, covered, span };
            }
        }

        return { ok: true, reason: '', covered, span };
    },

    _moduleEditor_closePicker() {
        const bd = document.getElementById('me-picker-backdrop');
        if (bd) bd.remove();
        const rbd = document.getElementById('me-rune-picker-backdrop');
        if (rbd) rbd.remove();
        this._moduleEditorRunePreview = null;
        this._moduleEditorPlacementPreview = null;
    },

    _moduleEditor_setPlacementPreview(slotIdx, moduleId = null, options = {}) {
        const mode = options.mode || 'candidate';
        let status = {
            ok: true,
            reason: '',
            covered: [slotIdx],
            span: { cols: 1, rows: 1 },
        };
        if (moduleId) {
            status = this._moduleEditor_getModulePlacementStatus(slotIdx, moduleId);
            if (!status.covered || status.covered.length <= 0) {
                status.covered = [slotIdx];
            }
        }
        this._moduleEditorPlacementPreview = {
            slotIdx,
            moduleId,
            mode,
            ok: !!status.ok,
            reason: status.reason || '',
            covered: status.covered || [slotIdx],
            span: status.span || { cols: 1, rows: 1 },
        };
    },

    _moduleEditor_normalizeComponentInventory() {
        this.ownedModuleComponents = normalizeModuleInventory(this.ownedModuleComponents);
        return this.ownedModuleComponents;
    },

    _moduleEditor_takeInventoryComponent(componentUid) {
        const inventory = this._moduleEditor_normalizeComponentInventory();
        const idx = inventory.findIndex(item => item && item.uid === componentUid);
        if (idx < 0) return null;
        const [component] = inventory.splice(idx, 1);
        return component || null;
    },

    _moduleEditor_detachComponent(slotIdx, layout, cols, rows) {
        const entry = layout[slotIdx];
        const anchorIdx = isModuleRef(entry) ? entry.ref : slotIdx;
        const component = getModuleInstance(layout[anchorIdx]);
        const moduleId = getModuleIdFromEntry(component);
        const covered = moduleId ? (getCoveredSlots(anchorIdx, getModuleSpan(moduleId), cols, rows) || [anchorIdx]) : [anchorIdx];
        for (const ci of covered) layout[ci] = null;
        if (component) {
            this.ownedModuleComponents = normalizeModuleInventory([...(this.ownedModuleComponents || []), component]);
        }
        return component;
    },

    _moduleEditor_unequipComponent(slotIdx) {
        const cfg = CONFIG.gameplay || {};
        const layout = this.currentModuleLayout;
        if (!Array.isArray(layout)) return null;
        const component = this._moduleEditor_detachComponent(slotIdx, layout, cfg.moduleCols || 4, cfg.moduleRows || 3);
        if (!component) return null;
        if (typeof this.phase_gathering_initPachinko === 'function') {
            this.phase_gathering_initPachinko(false);
        }
        this._moduleEditor_closePicker();
        this._moduleEditorSelectedSlotIdx = slotIdx;
        this._moduleEditorSelectedComponentUid = null;
        this.ui_renderModuleEditorControls();
        if (typeof this.sys_saveRunState === 'function') this.sys_saveRunState();
        const def = MODULE_DEFS[getModuleIdFromEntry(component)];
        this._moduleEditor_showNotice(`已卸下 ${def ? def.name : '钉板组件'}`, {
            type: 'info',
            detail: '组件已放回库存，可点击空槽重新装备。',
            duration: 1800,
        });
        return component;
    },

    /**
     * 应用模块选择：写入 currentModuleLayout，重建实时钉板，刷新控件。
     */
    _moduleEditor_openPicker(slotIdx) {
        this._moduleEditor_closePicker();
        const layout = this.currentModuleLayout || [];
        const curId = getModuleIdFromEntry(layout[slotIdx]);
        this._moduleEditor_setPlacementPreview(slotIdx, curId || null, { mode: 'target' });
        const inventory = this._moduleEditor_normalizeComponentInventory();
        const escapeHtml = (value) => String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');

        const itemsHtml = inventory.map(component => {
            const id = getModuleIdFromEntry(component);
            const def = MODULE_DEFS[id];
            if (!def) return '';
            const span = getModuleSpan(id);
            const spanTag = (span.cols > 1 || span.rows > 1) ? ` <span class="me-picker-span">${span.cols}x${span.rows}</span>` : '';
            const placement = this._moduleEditor_getModulePlacementStatus(slotIdx, id);
            const disabled = placement.ok ? '' : ' is-disabled';
            const disabledAttr = placement.ok
                ? ' data-placement-ok="true"'
                : ` aria-disabled="true" data-placement-ok="false" data-placement-reason="${escapeHtml(placement.reason)}" title="${escapeHtml(placement.reason)}"`;
            const desc = placement.ok ? (def.desc || '') : `不可放置：${placement.reason}`;
            const meta = getModuleMetaSummary(id);
            const metaHtml = meta ? `<div class="me-picker-desc">${escapeHtml(meta)}</div>` : '';
            return `<button type="button" class="me-picker-item${disabled}" data-pick-component="${escapeHtml(component.uid)}" data-module-id="${escapeHtml(id)}"${disabledAttr}>
                <div class="me-picker-icon">${def.icon || '▦'}</div>
                <div class="me-picker-name">${escapeHtml(def.name || id)}${spanTag}</div>
                ${metaHtml}
                <div class="me-picker-desc">${escapeHtml(desc)}</div>
            </button>`;
        }).join('');

        const removeHtml = curId
            ? '<button type="button" class="me-picker-item is-remove" data-pick-module="__remove__">清空此区域</button>'
            : '';
        const bodyHtml = (itemsHtml || removeHtml)
            ? `<div class="me-picker-grid">${itemsHtml}${removeHtml}</div>`
            : '<div class="me-picker-empty">库存没有可安装组件，请在商店购买。</div>';

        const backdrop = document.createElement('div');
        backdrop.className = 'me-picker-backdrop';
        backdrop.id = 'me-picker-backdrop';
        backdrop.innerHTML = `
            <div class="me-picker">
                <div class="me-picker-head">
                    <div class="me-picker-title">安装钉盘组件</div>
                    <button class="me-picker-close" id="me-picker-close">x</button>
                </div>
                <div class="me-picker-body">${bodyHtml}</div>
            </div>`;
        document.body.appendChild(backdrop);

        backdrop.addEventListener('click', (e) => {
            if (e.target === backdrop) this._moduleEditor_closePicker();
        });
        const closeBtn = backdrop.querySelector('#me-picker-close');
        if (closeBtn) closeBtn.addEventListener('click', () => this._moduleEditor_closePicker());
        backdrop.querySelectorAll('[data-pick-component], [data-pick-module]').forEach(btn => {
            const previewModule = btn.dataset.moduleId || null;
            const previewCandidate = () => {
                if (previewModule) this._moduleEditor_setPlacementPreview(slotIdx, previewModule, { mode: 'candidate' });
                else this._moduleEditor_setPlacementPreview(slotIdx, curId || null, { mode: 'target' });
            };
            const restoreTarget = () => this._moduleEditor_setPlacementPreview(slotIdx, curId || null, { mode: 'target' });
            btn.addEventListener('pointerenter', previewCandidate);
            btn.addEventListener('focus', previewCandidate);
            btn.addEventListener('pointerleave', restoreTarget);
            btn.addEventListener('blur', restoreTarget);
            btn.addEventListener('click', () => {
                previewCandidate();
                if (btn.dataset.placementOk === 'false') {
                    this._moduleEditor_showNotice(btn.dataset.placementReason || '该模块无法放置在这里', {
                        detail: '红色预览槽位表示当前组件无法覆盖该区域。',
                    });
                    return;
                }
                if (_isCoarsePointerInput() && btn.dataset.touchReady !== 'true') {
                    backdrop.querySelectorAll('[data-pick-component].is-previewing, [data-pick-module].is-previewing').forEach(el => {
                        el.classList.remove('is-previewing');
                        el.dataset.touchReady = 'false';
                    });
                    btn.classList.add('is-previewing');
                    btn.dataset.touchReady = 'true';
                    this._moduleEditor_showNotice('再次点击以安装该钉盘组件', { type: 'info', duration: 2200 });
                    return;
                }
                this._moduleEditor_applyModule(slotIdx, btn.dataset.pickComponent || btn.dataset.pickModule);
            });
        });
    },

    /**
     * 符文融合浮层：复用 picker 外壳，选中符文即注入钉板。
     */
    _moduleEditor_applyModule(slotIdx, componentKey) {
        const cfg = CONFIG.gameplay || {};
        const cols = cfg.moduleCols || 4;
        const rows = cfg.moduleRows || 3;
        const layout = this.currentModuleLayout;
        if (!Array.isArray(layout)) return;

        if (componentKey === '__remove__') {
            this._moduleEditor_detachComponent(slotIdx, layout, cols, rows);
        } else {
            const candidate = this._moduleEditor_normalizeComponentInventory()
                .find(item => item && item.uid === componentKey);
            const moduleId = getModuleIdFromEntry(candidate);
            if (!candidate || !moduleId) {
                this._moduleEditor_showNotice('该组件已不在库存中', {
                    detail: '库存可能刚刚发生变化，请重新打开组件列表。',
                });
                return;
            }

            const placement = this._moduleEditor_getModulePlacementStatus(slotIdx, moduleId);
            if (!placement.ok) {
                this._moduleEditor_showNotice(placement.reason || '该模块无法放置在这里', {
                    detail: '请根据画布上的红色覆盖预览调整槽位或更换组件。',
                });
                return;
            }

            const component = this._moduleEditor_takeInventoryComponent(componentKey);
            if (!component) {
                this._moduleEditor_showNotice('该组件已不在库存中', {
                    detail: '库存可能刚刚发生变化，请重新打开组件列表。',
                });
                return;
            }
            this._moduleEditor_detachComponent(slotIdx, layout, cols, rows);
            layout[slotIdx] = component;
            for (const ci of placement.covered) {
                if (ci !== slotIdx) layout[ci] = createModuleRef(slotIdx);
            }
        }

        if (typeof this.phase_gathering_initPachinko === 'function') {
            this.phase_gathering_initPachinko(false);
        }
        this._moduleEditor_closePicker();
        this._moduleEditorSelectedSlotIdx = slotIdx;
        this._moduleEditorSelectedComponentUid = null;
        this.ui_renderModuleEditorControls();
        if (typeof this.sys_saveRunState === 'function') this.sys_saveRunState();
    },

    _moduleEditor_getRunePreviewTargets(preview) {
        const fusion = preview ? {
            element: preview.element,
            count: preview.count,
            runeId: preview.runeId,
            sourceLevel: preview.level,
        } : null;
        return selectFusionTargetPegs(this.pegs || [], fusion, this.width || 400, this.height || 600, false);
    },

    _moduleEditor_collectFusionSummary(extraFusion = null) {
        const byElement = {};
        const addFusion = (element, level = 1, runeId = null, count = 1) => {
            if (!element || count <= 0) return;
            if (!byElement[element]) {
                byElement[element] = { element, count: 0, levelTotal: 0, runeIds: new Set() };
            }
            byElement[element].count += count;
            byElement[element].levelTotal += Math.max(1, level || 1) * count;
            if (runeId) byElement[element].runeIds.add(runeId);
        };

        const seenStateKeys = new Set();
        let fusionPegCount = 0;
        for (const peg of (this.pegs || [])) {
            if (!peg || !peg.type || (!peg.infusedRuneId && !peg.fusionSourceLevel)) continue;
            fusionPegCount++;
            if (Number.isInteger(peg.moduleSlotIdx) && peg.modulePegIdx !== undefined) {
                seenStateKeys.add(`${peg.moduleSlotIdx}:${peg.modulePegIdx}`);
            }
            addFusion(peg.type, peg.level || peg.fusionSourceLevel || 1, peg.infusedRuneId || null, 1);
        }

        if (fusionPegCount <= 0) {
            (this.currentModuleLayout || []).forEach((entry, slotIdx) => {
                const inst = getModuleInstance(entry);
                if (!inst || !inst.pegStates) return;
                Object.entries(inst.pegStates).forEach(([pegIdx, state]) => {
                    if (!state || state.source !== 'fusion' || !state.type) return;
                    if (seenStateKeys.has(`${slotIdx}:${pegIdx}`)) return;
                    addFusion(state.type, state.level || state.fusionSourceLevel || 1, state.infusedRuneId || null, 1);
                });
            });
        }

        if (extraFusion && extraFusion.element) {
            addFusion(extraFusion.element, extraFusion.level || extraFusion.sourceLevel || 1, extraFusion.runeId || null, extraFusion.count || 1);
        }

        const entries = Object.values(byElement)
            .map(item => ({
                ...item,
                runeIds: Array.from(item.runeIds),
            }))
            .sort((a, b) => b.levelTotal - a.levelTotal || a.element.localeCompare(b.element));
        const totalCount = entries.reduce((sum, item) => sum + item.count, 0);
        const totalLevel = entries.reduce((sum, item) => sum + item.levelTotal, 0);
        return { entries, totalCount, totalLevel };
    },

    _moduleEditor_getRunewordHintsForRune(runeId, limit = 3) {
        if (!runeId) return [];
        return (RUNEWORD_DB || [])
            .filter(rw => Array.isArray(rw.pattern) && rw.pattern.includes(runeId))
            .slice(0, limit)
            .map(rw => rw.name || rw.id)
            .filter(Boolean);
    },

    _moduleEditor_buildFusionSummaryHtml(extraFusion = null) {
        const summary = this._moduleEditor_collectFusionSummary(extraFusion);
        if (!summary.entries.length) return '';
        const chips = summary.entries.slice(0, 5).map(item => {
            const label = _getStatLabel(item.element);
            return `<span class="me-fusion-chip">${_escapeHtml(label)} x${item.count} / Lv.${item.levelTotal}</span>`;
        }).join('');
        const more = summary.entries.length > 5
            ? `<span class="me-fusion-chip">+${summary.entries.length - 5}</span>`
            : '';
        return `<div class="me-fusion-summary">
            <span class="me-fusion-label">已融合</span>
            ${chips}${more}
            <span class="me-fusion-note">采集中改变属性钉；词条仍在发射器 3x3 排布中激活</span>
        </div>`;
    },

    _moduleEditor_buildRunePreviewChainHtml(preview, targets) {
        if (!preview) return '';
        const targetCount = Array.isArray(targets) ? targets.length : 0;
        const summary = this._moduleEditor_collectFusionSummary({ ...preview, count: targetCount });
        const elementLabel = _getStatLabel(preview.element);
        const hints = this._moduleEditor_getRunewordHintsForRune(preview.runeId, 3);
        const hintHtml = hints.length
            ? `<div class="is-hint">发射器词条线索：${hints.map(_escapeHtml).join(' / ')}</div>`
            : '<div>该符文暂无直接词条线索，可作为属性层补强。</div>';
        const totalHtml = summary.entries.length
            ? `<div class="is-good">确认后钉板累计：${summary.entries.map(item => `${_escapeHtml(_getStatLabel(item.element))} x${item.count}`).join('，')}</div>`
            : '';
        return `<div class="me-rune-chain">
            <div><strong>${_escapeHtml(preview.name)}</strong> 将注入 ${targetCount}/${preview.count} 颗 ${_escapeHtml(elementLabel)} 钉</div>
            ${totalHtml}
            ${hintHtml}
        </div>`;
    },

    _moduleEditor_updateRunePickerPreview() {
        const preview = this._moduleEditorRunePreview;
        const backdrop = document.getElementById('me-rune-picker-backdrop');
        if (!backdrop) return;
        backdrop.querySelectorAll('[data-rune-idx]').forEach(btn => {
            const idx = parseInt(btn.dataset.runeIdx, 10);
            btn.classList.toggle('is-selected', !!preview && preview.inventoryIndex === idx);
        });
        const text = backdrop.querySelector('#me-rune-preview-text');
        const confirm = backdrop.querySelector('#me-rune-confirm');
        const chain = backdrop.querySelector('#me-rune-chain-text');
        if (!text || !confirm) return;
        if (!preview) {
            text.textContent = '选择一个符文预览落点。';
            if (chain) chain.innerHTML = '';
            confirm.disabled = true;
            confirm.textContent = '先选择符文';
            return;
        }
        const targets = this._moduleEditor_getRunePreviewTargets(preview);
        text.textContent = `${preview.name} L${preview.level}：将注入 ${targets.length}/${preview.count} 颗 ${preview.element} 钉。`;
        if (chain) chain.innerHTML = this._moduleEditor_buildRunePreviewChainHtml(preview, targets);
        confirm.disabled = targets.length <= 0;
        confirm.textContent = targets.length > 0 ? '确认融合' : '没有可注入钉';
    },

    _moduleEditor_openRunePicker() {
        this._moduleEditor_closePicker();
        const inventory = Array.isArray(this.runeInventory) ? this.runeInventory : [];
        const pending = Array.isArray(this.pendingFusions) ? this.pendingFusions : [];
        this._moduleEditorRunePreview = null;

        const rowsHtml = inventory.length > 0 ? inventory.map((r, idx) => {
            const id = getRuneId(r);
            const def = (RUNE_DB || []).find(d => d.id === id);
            if (!def) return '';
            const lv = _getRuneLevel(r);
            const element = def.element || def.baseStat || '';
            const hints = this._moduleEditor_getRunewordHintsForRune(id, 2);
            const hintsHtml = hints.length
                ? '<div class="me-picker-desc me-rune-hints">发射器词条：' + hints.map(_escapeHtml).join(' / ') + '</div>'
                : '';
            return '<button type="button" class="me-rune-row" data-rune-idx="' + idx + '">' +
                '<div class="me-picker-icon">' + (def.icon || 'R') + '</div>' +
                '<div class="me-rune-meta">' +
                    '<div class="me-picker-name">' + (def.name || id) + ' <span class="me-rune-lv">L' + lv + '</span></div>' +
                    '<div class="me-picker-desc">预览注入 ' + lv + ' 颗 ' + element + ' 钉</div>' +
                    hintsHtml +
                '</div>' +
            '</button>';
        }).join('') : '<div class="me-picker-empty">背包没有符文</div>';

        const pendingHtml = pending.length > 0
            ? '<div class="me-picker-desc" style="padding:8px 2px 0;">已待注入：' + pending.map(f => f.element + ' x' + f.count).join(', ') + '</div>'
            : '';

        const backdrop = document.createElement('div');
        backdrop.className = 'me-picker-backdrop';
        backdrop.id = 'me-rune-picker-backdrop';
        backdrop.innerHTML = '<div class="me-picker">' +
            '<div class="me-picker-head">' +
                '<div class="me-picker-title">符文融合</div>' +
                '<button class="me-picker-close" id="me-rune-picker-close">x</button>' +
            '</div>' +
            '<div class="me-picker-body">' + rowsHtml + pendingHtml +
                '<div class="me-rune-preview">' +
                    '<div class="me-rune-preview-text" id="me-rune-preview-text">选择一个符文预览落点。</div>' +
                    '<div class="me-rune-chain" id="me-rune-chain-text"></div>' +
                    '<button class="me-rune-confirm" id="me-rune-confirm" disabled>先选择符文</button>' +
                '</div>' +
            '</div>' +
        '</div>';
        document.body.appendChild(backdrop);

        backdrop.addEventListener('click', (e) => {
            if (e.target === backdrop) this._moduleEditor_closePicker();
        });
        const closeBtn = backdrop.querySelector('#me-rune-picker-close');
        if (closeBtn) closeBtn.addEventListener('click', () => this._moduleEditor_closePicker());
        backdrop.querySelectorAll('[data-rune-idx]').forEach(btn => {
            btn.addEventListener('click', () => {
                const idx = parseInt(btn.dataset.runeIdx, 10);
                const rune = (this.runeInventory || [])[idx];
                const runeId = getRuneId(rune);
                const def = (RUNE_DB || []).find(d => d.id === runeId);
                if (!rune || !def) { showToast('该符文不存在或已被消耗'); return; }
                const lv = (typeof rune === 'object' && typeof rune.level === 'number') ? rune.level : 1;
                this._moduleEditorRunePreview = {
                    inventoryIndex: idx,
                    runeId,
                    element: def.element || def.baseStat,
                    count: lv,
                    level: lv,
                    name: def.name || runeId,
                };
                this._moduleEditor_updateRunePickerPreview();
            });
        });
        const confirmBtn = backdrop.querySelector('#me-rune-confirm');
        if (confirmBtn) confirmBtn.addEventListener('click', () => {
            const preview = this._moduleEditorRunePreview;
            if (!preview) return;
            const rune = (this.runeInventory || [])[preview.inventoryIndex];
            if (!rune || getRuneId(rune) !== preview.runeId) {
                showToast('该符文不存在或已被消耗');
                this._moduleEditorRunePreview = null;
                this._moduleEditor_updateRunePickerPreview();
                return;
            }
            const result = fuseRuneIntoBoard(this, rune, RUNE_DB);
            showToast(result.message);
            if (result.ok && typeof this.phase_gathering_initPachinko === 'function') {
                this.phase_gathering_initPachinko(false);
            }
            this._moduleEditor_closePicker();
            this.ui_renderModuleEditorControls();
        });
        this._moduleEditor_updateRunePickerPreview();
    }
};
