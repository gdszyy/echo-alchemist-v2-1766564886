/**
 * run_shop.js - [v2] 局内商店
 *
 * 玩家用局内累计的符文碎片 (game.runFragments) 购买：
 *   - 钉板模块（解锁未拥有的模块类型）
 *   - 单个符文（按稀有度定价）
 *   - 模块槽位扩张（一次性 +1）
 *
 * 出现时机：每场战斗结束后，每 N 场（CONFIG.gameplay.runShopInterval）触发一次。
 * 关闭时直接进入下一阶段（round-start resolver）。
 *
 * 与 meta `src/ui/shop.js` 不同：
 *   - meta shop 是局间永久商店，使用 saveData.runeFragments
 *   - 本商店是局内，使用 game.runFragments，购买的内容只在本局有效
 *   - 局结束时未消费的 runFragments 按比例转换为 saveData.runeFragments
 */

import { CONFIG } from '../config.js';
import { RUNE_DB } from '../rune_config.js';
import { MODULE_DEFS } from '../pinboard_modules.js';

const RUNE_PRICE_BY_RARITY = {
    common: 18,
    rare: 40,
    epic: 80,
    legendary: 140,
};

const SLOT_EXPAND_PRICE = 100;

/**
 * 生成商品列表
 */
function generateInventory(game, count) {
    const cfg = CONFIG.gameplay || {};
    const items = [];
    const runesRatio = cfg.runShopRunesRatio != null ? cfg.runShopRunesRatio : 0.6;
    const runeCount = Math.max(1, Math.floor(count * runesRatio));
    const moduleCount = count - runeCount;

    // 模块商品：来自 MODULE_DEFS 中价格 > 0 且玩家未解锁的
    const lockedModules = Object.values(MODULE_DEFS).filter(d => d.price > 0 && (!game.unlockedModuleTypes || !game.unlockedModuleTypes.includes(d.id)));
    for (let i = 0; i < moduleCount && lockedModules.length > 0; i++) {
        const def = lockedModules[Math.floor(Math.random() * lockedModules.length)];
        items.push({ kind: 'module', moduleId: def.id, name: def.name, icon: def.icon, desc: def.desc, price: def.price });
    }

    // 槽位扩张（每次商店至少出现一次，若槽位未满）
    const totalSlots = (cfg.moduleCols || 4) * (cfg.moduleRows || 3);
    if ((game.unlockedModuleSlots || cfg.moduleDefaultSlots || 3) < totalSlots) {
        items.push({ kind: 'slot_expand', name: '模块槽位 +1', icon: '⊞', desc: `当前 ${game.unlockedModuleSlots || cfg.moduleDefaultSlots || 3}/${totalSlots}`, price: SLOT_EXPAND_PRICE });
    }

    // 符文商品：从 RUNE_DB 随机抽
    const allRunes = (RUNE_DB || []).filter(r => r && r.id);
    for (let i = 0; i < runeCount && allRunes.length > 0; i++) {
        const r = allRunes[Math.floor(Math.random() * allRunes.length)];
        const price = RUNE_PRICE_BY_RARITY[r.rarity] || 25;
        items.push({ kind: 'rune', runeId: r.id, name: r.name || r.id, icon: r.icon || '🔮', desc: r.desc || `${r.element} 符文`, price, rarity: r.rarity });
    }

    return items;
}

export const run_shop = {
    /**
     * 打开局内商店
     * @param {Function} onClose - 关闭后的回调
     */
    ui_showRunShop(onClose) {
        const cfg = CONFIG.gameplay || {};
        if (!Array.isArray(this.runShopInventory) || this.runShopInventory.length === 0) {
            this.runShopInventory = generateInventory(this, cfg.runShopItemsPerOffer || 5);
        }
        this._runShopOnClose = onClose || null;

        let overlay = document.getElementById('run-shop-overlay');
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.id = 'run-shop-overlay';
            overlay.style.cssText = `
                position: fixed; inset: 0; z-index: 245;
                background: rgba(8, 12, 24, 0.92);
                display: flex; align-items: center; justify-content: center;
                padding: 16px; box-sizing: border-box;
                font-family: 'Cinzel', 'Microsoft YaHei', sans-serif;
                color: #e2e8f0;
            `;
            document.body.appendChild(overlay);
        }
        overlay.style.display = 'flex';
        this.ui_renderRunShop();
    },

    ui_hideRunShop() {
        const overlay = document.getElementById('run-shop-overlay');
        if (overlay) overlay.style.display = 'none';
        const cb = this._runShopOnClose;
        this._runShopOnClose = null;
        if (typeof cb === 'function') cb();
    },

    ui_renderRunShop() {
        const overlay = document.getElementById('run-shop-overlay');
        if (!overlay) return;
        const cfg = CONFIG.gameplay || {};
        const inventory = Array.isArray(this.runShopInventory) ? this.runShopInventory : [];
        const fragments = this.runFragments || 0;
        const refreshCost = cfg.runShopRefreshCost || 10;

        const itemsHtml = inventory.map((it, i) => {
            const canAfford = fragments >= it.price;
            const opacity = canAfford ? '1' : '0.5';
            const cursor = canAfford ? 'pointer' : 'not-allowed';
            const rarityColor = it.rarity === 'legendary' ? '#facc15' :
                it.rarity === 'epic' ? '#a855f7' :
                    it.rarity === 'rare' ? '#3b82f6' : '#94a3b8';
            return `<div data-item-idx="${i}" class="run-shop-item" style="cursor:${cursor};opacity:${opacity};background:rgba(30, 41, 59, 0.7);border:1px solid ${rarityColor};border-radius:8px;padding:10px;display:flex;flex-direction:column;gap:6px;transition:all 0.15s;">
                <div style="display:flex;align-items:center;justify-content:space-between;">
                    <div style="font-size:22px;">${it.icon}</div>
                    <div style="font-size:12px;font-weight:bold;color:${rarityColor};">${it.price} 🔮</div>
                </div>
                <div style="font-size:13px;font-weight:bold;">${it.name}</div>
                <div style="font-size:10px;color:#94a3b8;line-height:1.4;">${it.desc}</div>
            </div>`;
        }).join('');

        overlay.innerHTML = `
            <div style="background: rgba(15, 23, 42, 0.96); border: 1px solid rgba(168, 85, 247, 0.4); border-radius: 12px; padding: 18px; max-width: 760px; width: 100%; max-height: 92vh; overflow: auto; display: flex; flex-direction: column; gap: 14px;">
                <div style="display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid rgba(168, 85, 247, 0.3);padding-bottom:10px;">
                    <div style="font-size:18px;font-weight:bold;color:#c084fc;">局内商店</div>
                    <div style="font-size:13px;">持有: <span style="color:#fbbf24;font-weight:bold;">${fragments} 🔮</span></div>
                </div>
                <div style="display:grid;grid-template-columns:repeat(auto-fill, minmax(160px, 1fr));gap:10px;">
                    ${itemsHtml || '<div style="color:#64748b;font-size:12px;">商店为空</div>'}
                </div>
                <div style="display:flex;justify-content:space-between;align-items:center;border-top:1px solid rgba(168, 85, 247, 0.3);padding-top:10px;">
                    <button id="run-shop-refresh-btn" style="padding:6px 12px;background:rgba(56, 189, 248, 0.4);color:#fff;border:1px solid rgba(56, 189, 248, 0.7);border-radius:6px;cursor:pointer;font-size:12px;">刷新 (${refreshCost} 🔮)</button>
                    <button id="run-shop-close-btn" style="padding:8px 18px;background:rgba(34, 197, 94, 0.55);color:#fff;border:1px solid rgba(34, 197, 94, 0.8);border-radius:6px;cursor:pointer;font-weight:bold;">离开商店</button>
                </div>
            </div>
        `;

        overlay.querySelectorAll('.run-shop-item').forEach(el => {
            el.addEventListener('click', () => {
                const idx = parseInt(el.dataset.itemIdx, 10);
                this.ui_buyRunShopItem(idx);
            });
        });
        const refreshBtn = overlay.querySelector('#run-shop-refresh-btn');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => {
                if ((this.runFragments || 0) < refreshCost) {
                    if (window.showToast) window.showToast('碎片不足');
                    return;
                }
                this.runFragments -= refreshCost;
                this.runShopInventory = generateInventory(this, cfg.runShopItemsPerOffer || 5);
                this.runShopRefreshes = (this.runShopRefreshes || 0) + 1;
                this.ui_renderRunShop();
            });
        }
        const closeBtn = overlay.querySelector('#run-shop-close-btn');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                this.runShopInventory = []; // 离开后清空，下次重新生成
                this.ui_hideRunShop();
            });
        }
    },

    ui_buyRunShopItem(idx) {
        const inventory = Array.isArray(this.runShopInventory) ? this.runShopInventory : [];
        const it = inventory[idx];
        if (!it) return;
        if ((this.runFragments || 0) < it.price) {
            if (window.showToast) window.showToast('碎片不足');
            return;
        }
        const cfg = CONFIG.gameplay || {};
        if (it.kind === 'module') {
            if (!Array.isArray(this.unlockedModuleTypes)) this.unlockedModuleTypes = [];
            if (!this.unlockedModuleTypes.includes(it.moduleId)) {
                this.unlockedModuleTypes.push(it.moduleId);
            }
            if (window.showToast) window.showToast(`已解锁模块: ${it.name}`);
        } else if (it.kind === 'slot_expand') {
            const totalSlots = (cfg.moduleCols || 4) * (cfg.moduleRows || 3);
            this.unlockedModuleSlots = Math.min(totalSlots, (this.unlockedModuleSlots || cfg.moduleDefaultSlots || 3) + 1);
            if (window.showToast) window.showToast(`钉板槽位 +1（当前 ${this.unlockedModuleSlots}/${totalSlots}）`);
        } else if (it.kind === 'rune') {
            if (!Array.isArray(this.runeInventory)) this.runeInventory = [];
            this.runeInventory.push({ id: it.runeId, level: 1 });
            if (window.showToast) window.showToast(`获得符文: ${it.name}`);
        }
        this.runFragments -= it.price;
        // 售出后从商店列表移除
        inventory.splice(idx, 1);
        this.ui_renderRunShop();
    },
};
