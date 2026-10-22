/**
 * defend_hud.js - [REQ-20261022-wave-loop S2 / R2] 守卫 HUD（#defend-hud，挂在 #phase-combat 内）mixin。
 *
 * 位置：底部发射台上方，左侧设施条（每座设施：占位图标 + 冷却格，触发时脉冲），右侧 2 个道具按钮。
 * 中间列留空，不遮挡发射器与瞄准（art §6.2「守卫」）。弹匣沿用 S1 的 .alchemy-magazine-row（左下弹药舱）。
 * 触发反馈只用 CSS 步进动画（无 shadowBlur、不画在敌人身上）。
 */
import { CONFIG } from '../config.js';
import { getFacilityStats } from '../utils/build_economy_utils.js';
import { FACILITY_LABELS, ITEM_LABELS } from '../build_system.js';
import { BUILD_GLYPHS } from './build_screen.js';
import { el, append } from './components/_dom.js';
import { createButton } from './components/button.js';
import { createCooldownCells } from './components/cooldown_cells.js';
import { createGlyphTile } from './components/slot_card.js';

function glyph(key) {
    const g = BUILD_GLYPHS[key] || ['?', ''];
    return { glyph: g[0], element: g[1] };
}

export const defend_hud_system = {
    /**
     * @method ui_renderDefendHud
     * @param {{ pulseSlots?: number[] }} [options] - 本次触发的设施位，播一次脉冲
     */
    ui_renderDefendHud(options = {}) {
        if (typeof document === 'undefined') return;
        const host = document.getElementById('defend-hud');
        if (!host) return;
        if (this.phase !== 'combat') {
            host.hidden = true;
            return;
        }
        host.hidden = false;
        host.innerHTML = '';
        // 底部弹药舱高度随断点变化（104–150px），HUD 贴在其上沿之上，避免压住弹匣按钮
        const dock = document.getElementById('combat-bottom-dock');
        if (dock && dock.offsetHeight > 0) host.style.bottom = `${dock.offsetHeight + 4}px`;
        const buildCfg = (CONFIG.gameplay && CONFIG.gameplay.build) || {};
        const pulse = Array.isArray(options.pulseSlots) ? options.pulseSlots : [];

        const facWrap = el('div', 'defend-hud__facilities', { 'aria-label': '设施' });
        (this.facilities || []).forEach((f, i) => {
            if (!f) return;
            const lv = getFacilityStats(f.type, f.level, buildCfg);
            const cell = el('div', `defend-fac${pulse.includes(i) ? ' is-pulse' : ''}`, {
                title: `${FACILITY_LABELS[f.type] || f.type} Lv${f.level}`,
                dataset: { slot: String(i), facility: f.type },
            });
            append(cell, createGlyphTile({ ...glyph(f.type), size: 'hud' }));
            if (lv && lv.cooldown) append(cell, createCooldownCells({ total: lv.cooldown, remaining: Math.max(0, f.cd) }));
            else append(cell, el('span', 'defend-fac__tag', { text: '挖' }));
            facWrap.appendChild(cell);
        });
        host.appendChild(facWrap);

        const itemWrap = el('div', 'defend-hud__items', { 'aria-label': '道具' });
        const canUse = typeof this.sys_canUseItem === 'function' ? this.sys_canUseItem() : false;
        const slots = (buildCfg.items && buildCfg.items.slots) || 2;
        const items = Array.isArray(this.items) ? this.items : [];
        const revealed = typeof this.sys_getBuildReveal === 'function' ? this.sys_getBuildReveal().has('items') : false;
        if (revealed || items.length) {
            for (let i = 0; i < slots; i++) {
                const id = items[i];
                itemWrap.appendChild(createButton({
                    variant: id ? 'default' : 'ghost', className: 'defend-item',
                    disabled: !id || !canUse,
                    title: id ? `使用：${ITEM_LABELS[id]}` : '空道具位（整备时购买）',
                    children: [createGlyphTile({ ...(id ? glyph(id) : { glyph: '·' }), size: 'hud' })],
                    onClick: () => this.sys_useItem(i),
                    dataset: { item: id || '' },
                }));
            }
        }
        host.appendChild(itemWrap);
        if (pulse.length) {
            clearTimeout(this._defendHudPulseTimer);
            this._defendHudPulseTimer = setTimeout(() => {
                host.querySelectorAll('.defend-fac.is-pulse').forEach(n => n.classList.remove('is-pulse'));
            }, 700);
        }
    },
};
