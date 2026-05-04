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
import { MODULE_DEFS, ATTR_PIN_TYPES } from '../pinboard_modules.js';

const RUNE_PRICE_BY_RARITY = {
    common: 18,
    rare: 40,
    epic: 80,
    legendary: 140,
};

const SLOT_EXPAND_PRICE = 100;

// [v2] 旧的「特殊槽解锁/数量+1」遗物迁移到商店出售
const SLOT_UNLOCK_PRICE = 60;
const SLOT_COUNT_PRICE = 50;
const SLOT_TYPE_META = {
    recall:    { name: '解鎖回溯槽',  icon: '⏳', desc: '加入「回溯」特殊槽到鑒池。' },
    multicast: { name: '解鎖連射槽',  icon: '♊', desc: '加入「連射」特殊槽到鑒池。' },
    split:     { name: '解鎖分裂槽',  icon: '☢️', desc: '加入「分裂」特殊槽到鑒池。' },
};

// [v2] 属性钉板：商店随机刷新一个带某属性的钉板模块（按当前属性权重）
const ATTR_PIN_PRICE = 70;
const ATTR_PIN_LABEL = {
    bounce: '彈性', pierce: '穿透', scatter: '散射',
    damage: '增幅', cryo: '冰霜',   pyro: '火焰', wind: '疾風',
};

function rollAttributePinType(game) {
    const weights = (game && game.unlockedWeights) || {};
    const candidates = [];
    let total = 0;
    for (const t of ATTR_PIN_TYPES) {
        const w = Math.max(0, weights[t] || 0);
        if (w > 0) { candidates.push({ type: t, w }); total += w; }
    }
    if (total <= 0 || candidates.length === 0) return null;
    let r = Math.random() * total;
    for (const c of candidates) { if (r < c.w) return c.type; r -= c.w; }
    return candidates[candidates.length - 1].type;
}

/**
 * 生成商品列表
 */
function generateInventory(game, count) {
    const cfg = CONFIG.gameplay || {};
    const items = [];
    const runesRatio = cfg.runShopRunesRatio != null ? cfg.runShopRunesRatio : 0.6;
    const runeCount = Math.max(1, Math.floor(count * runesRatio));
    const moduleCount = count - runeCount;

    // 模块商品：来自 MODULE_DEFS 中价格 > 0 且玩家未解锁的（不含 attr_pin_*：那些由属性钉板分支独立刷新）
    const lockedModules = Object.values(MODULE_DEFS).filter(d => d.price > 0 && !d.isAttrPin && (!game.unlockedModuleTypes || !game.unlockedModuleTypes.includes(d.id)));
    for (let i = 0; i < moduleCount && lockedModules.length > 0; i++) {
        const def = lockedModules[Math.floor(Math.random() * lockedModules.length)];
        items.push({ kind: 'module', moduleId: def.id, name: def.name, icon: def.icon, desc: def.desc, price: def.price });
    }

    // 槽位扩张（每次商店至少出现一次，若槽位未满）
    const totalSlots = (cfg.moduleCols || 4) * (cfg.moduleRows || 3);
    if ((game.unlockedModuleSlots || cfg.moduleDefaultSlots || 3) < totalSlots) {
        items.push({ kind: 'slot_expand', name: '模块槽位 +1', icon: '⊞', desc: `当前 ${game.unlockedModuleSlots || cfg.moduleDefaultSlots || 3}/${totalSlots}`, price: SLOT_EXPAND_PRICE });
    }

    // [v2] 特殊槽解锁：未解锁的类型作为商品出售
    const unlockedSlotSet = new Set(game.unlockedSlots || []);
    for (const slotType of Object.keys(SLOT_TYPE_META)) {
        if (!unlockedSlotSet.has(slotType)) {
            const meta = SLOT_TYPE_META[slotType];
            items.push({ kind: 'slot_unlock', slotType, name: meta.name, icon: meta.icon, desc: meta.desc, price: SLOT_UNLOCK_PRICE });
        }
    }
    // [v2] 特殊槽数量 +1（最多 3）
    if ((game.slotCount || 0) < 3) {
        items.push({ kind: 'slot_count', name: '特殊槽數量 +1', icon: '🔨', desc: `當前 ${game.slotCount || 0}/3`, price: SLOT_COUNT_PRICE });
    }

    // [v2] 属性钉板：按当前属性权重随机刷出一个带属性的钉板模块
    const attrPinType = rollAttributePinType(game);
    if (attrPinType) {
        const moduleId = `attr_pin_${attrPinType}`;
        const def = MODULE_DEFS[moduleId];
        const alreadyUnlocked = (game.unlockedModuleTypes || []).includes(moduleId);
        if (def && !alreadyUnlocked) {
            items.push({
                kind: 'attr_pin',
                moduleId,
                attribute: attrPinType,
                name: def.name,
                icon: def.icon,
                desc: `3×3 釘板，全部釘子為 [${ATTR_PIN_LABEL[attrPinType] || attrPinType}] 屬性。`,
                price: ATTR_PIN_PRICE,
                rarity: 'rare',
            });
        }
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
        if (it.kind === 'module' || it.kind === 'attr_pin') {
            if (!Array.isArray(this.unlockedModuleTypes)) this.unlockedModuleTypes = [];
            if (!this.unlockedModuleTypes.includes(it.moduleId)) {
                this.unlockedModuleTypes.push(it.moduleId);
            }
            if (window.showToast) window.showToast(`已解锁模块: ${it.name}`);
        } else if (it.kind === 'slot_expand') {
            const totalSlots = (cfg.moduleCols || 4) * (cfg.moduleRows || 3);
            this.unlockedModuleSlots = Math.min(totalSlots, (this.unlockedModuleSlots || cfg.moduleDefaultSlots || 3) + 1);
            if (window.showToast) window.showToast(`钉板槽位 +1（当前 ${this.unlockedModuleSlots}/${totalSlots}）`);
        } else if (it.kind === 'slot_unlock') {
            if (!Array.isArray(this.unlockedSlots)) this.unlockedSlots = [];
            if (!this.unlockedSlots.includes(it.slotType)) {
                this.unlockedSlots.push(it.slotType);
            }
            if ((this.slotCount || 0) === 0) this.slotCount = 1;
            if (window.showToast) window.showToast(`已解锁特殊槽: ${it.name}`);
        } else if (it.kind === 'slot_count') {
            this.slotCount = Math.min(3, (this.slotCount || 0) + 1);
            if (window.showToast) window.showToast(`特殊槽數量 +1（當前 ${this.slotCount}/3）`);
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
