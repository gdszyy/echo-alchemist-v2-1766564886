/**
 * run_shop.js - [v2] 局内商店
 *
 * 玩家用局内累计的符文碎片 (game.runFragments) 购买：
 *   - 钉盘组件（购买单个可拆装的组件实例）
 *   - 单个符文（按稀有度定价）
 *   - 模块槽位扩张（一次性 +1）
 *
 * 出现时机：
 *   - 第 3 回合固定首访；后续按 3..当前回合数随机等待后到访
 *   - 每次到访停留 2 回合，由底部倒计时入口打开
 *   - 放弃遗物时直接进入，并获得一笔局内碎片补偿
 *
 * 与 meta `src/ui/shop.js` 不同：
 *   - meta shop 是局间永久商店，使用 saveData.runeFragments
 *   - 本商店是局内，使用 game.runFragments，购买的内容只在本局有效
 *   - 局结束时未消费的 runFragments 按比例转换为 saveData.runeFragments
 */

import { CONFIG } from '../config.js';
import { RUNE_DB } from '../rune_config.js';
import { MODULE_DEFS, addModuleComponentToInventory, getModuleMetaSummary } from '../pinboard_modules.js';

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
const STARTER_BOOST_ID = 'starter_aid_bundle';
const SLOT_TYPE_META = {
    recall:    { name: '解鎖回溯槽',  icon: '⏳', desc: '加入「回溯」特殊槽到鑒池。' },
    multicast: { name: '解鎖連射槽',  icon: '♊', desc: '加入「連射」特殊槽到鑒池。' },
    split:     { name: '解鎖分裂槽',  icon: '☢️', desc: '加入「分裂」特殊槽到鑒池。' },
};

const MODULE_SHOWCASE_TAG = 'showcase';
const MODULE_SHOWCASE_PRIORITY = 0.65;

function takeRandom(pool) {
    if (!pool || pool.length === 0) return null;
    const idx = Math.floor(Math.random() * pool.length);
    return pool.splice(idx, 1)[0];
}

function takeRandomByTag(pool, tag) {
    if (!Array.isArray(pool) || pool.length === 0 || !tag) return null;
    const candidates = [];
    for (let i = 0; i < pool.length; i++) {
        const def = pool[i];
        if (!def) continue;
        if (Array.isArray(def.tags) && def.tags.includes(tag)) {
            candidates.push(i);
        }
    }
    if (candidates.length === 0) return null;
    const idx = candidates[Math.floor(Math.random() * candidates.length)];
    return pool.splice(idx, 1)[0];
}

function countAffordable(items, fragments) {
    return (items || []).filter(it => it && fragments >= it.price).length;
}

function isStarterBoostVisit(game) {
    const cfg = CONFIG.gameplay || {};
    const firstRound = cfg.runShopFirstOfferRound || 3;
    return !!game && !game.runShopStarterBoostClaimed && (game.runShopLastArrivalRound || 0) === firstRound;
}

function createStarterBoostItem() {
    const cfg = CONFIG.gameplay || {};
    const shield = cfg.runShopStarterBoostShield || 2;
    const damage = cfg.runShopStarterBoostFlatDamage || 1;
    const damageRounds = cfg.runShopStarterBoostDamageRounds || 2;
    const fragments = cfg.runShopStarterBoostFragments || 12;
    return {
        kind: 'starter_boost',
        boostId: STARTER_BOOST_ID,
        name: '商人应急包',
        icon: '✦',
        desc: `免费：获得 ${shield} 层护盾、基础伤害 +${damage}（${damageRounds} 回合），并补给 ${fragments} 局内碎片。`,
        price: 0,
        rarity: 'rare',
    };
}

function createMixedMarblePackItem() {
    const cfg = CONFIG.gameplay || {};
    return {
        kind: 'marble_pack',
        packId: 'mixed',
        name: '杂色弹珠包',
        icon: '🔮',
        desc: '购买后立即开启 3 枚随机弹珠并进入研磨结算；不触发命运选择。',
        price: cfg.runShopMixedMarblePackPrice || 18,
        rarity: 'common',
    };
}

/**
 * 生成商品列表
 */
function generateInventory(game, count) {
    const cfg = CONFIG.gameplay || {};
    const items = [createMixedMarblePackItem()];

    // 1. 构筑组件：购买得到的是单个组件实例，不是无限使用的模板解锁。
    const modulePool = Object.values(MODULE_DEFS).filter(d => d.price > 0 && !d.isAttrPin);
    const addModuleItem = (preferShowcase = false) => {
        let def = null;
        if (preferShowcase) {
            def = takeRandomByTag(modulePool, MODULE_SHOWCASE_TAG);
        }
        if (!def) def = takeRandom(modulePool);
        if (!def) return false;
        const meta = getModuleMetaSummary(def.id);
        items.push({ kind: 'module', moduleId: def.id, name: def.name, icon: def.icon, desc: def.desc, meta, price: def.price, rarity: def.rarity });
        return true;
    };
    if (items.length < count) {
        const forceShowcase = modulePool.some(d => Array.isArray(d.tags) && d.tags.includes(MODULE_SHOWCASE_TAG));
        addModuleItem(forceShowcase && Math.random() < MODULE_SHOWCASE_PRIORITY);
    }

    // 2. 结构扩展：槽位扩张 / 特殊槽解锁 / 特殊槽数量，三者最多出现一个。
    const totalSlots = (cfg.moduleCols || 4) * (cfg.moduleRows || 3);
    const utilityItems = [];
    if ((game.unlockedModuleSlots || cfg.moduleDefaultSlots || 3) < totalSlots) {
        utilityItems.push({ kind: 'slot_expand', name: '模块槽位 +1', icon: '⊞', desc: `当前 ${game.unlockedModuleSlots || cfg.moduleDefaultSlots || 3}/${totalSlots}`, price: SLOT_EXPAND_PRICE });
    }
    const unlockedSlotSet = new Set(game.unlockedSlots || []);
    for (const slotType of Object.keys(SLOT_TYPE_META)) {
        if (!unlockedSlotSet.has(slotType)) {
            const meta = SLOT_TYPE_META[slotType];
            utilityItems.push({ kind: 'slot_unlock', slotType, name: meta.name, icon: meta.icon, desc: meta.desc, price: SLOT_UNLOCK_PRICE });
        }
    }
    if ((game.slotCount || 0) < 3) {
        utilityItems.push({ kind: 'slot_count', name: '特殊槽數量 +1', icon: '🔨', desc: `當前 ${game.slotCount || 0}/3`, price: SLOT_COUNT_PRICE });
    }
    const utility = takeRandom(utilityItems);
    if (utility && items.length < count) items.push(utility);

    // 3. 符文商品：保底至少一个，其余按缺口补齐到目标数量。
    const allRunes = (RUNE_DB || []).filter(r => r && r.id);
    while (items.length < count && allRunes.length > 0) {
        const r = allRunes[Math.floor(Math.random() * allRunes.length)];
        const price = RUNE_PRICE_BY_RARITY[r.rarity] || 25;
        items.push({ kind: 'rune', runeId: r.id, name: r.name || r.id, icon: r.icon || '🔮', desc: r.desc || `${r.element} 符文`, price, rarity: r.rarity });
    }
    while (items.length < count && addModuleItem()) {}

    return items;
}

function generateInventoryForCurrentVisit(game, count) {
    const items = generateInventory(game, Math.max(1, count));
    if (isStarterBoostVisit(game) && !items.some(it => it && it.kind === 'starter_boost')) {
        items.unshift(createStarterBoostItem());
        return items.slice(0, Math.max(1, count));
    }
    return items;
}

function getRunShopVisitKey(game) {
    if (game && typeof game.sys_isRunShopActive === 'function' && game.sys_isRunShopActive()) {
        return game.runShopLastArrivalRound || game.round || 0;
    }
    return game && game.round ? game.round : 0;
}

function ensureInventoryForCurrentVisit(game, count) {
    const visitKey = getRunShopVisitKey(game);
    const alreadyGenerated = game._runShopInventoryGeneratedForRound === visitKey;
    if (!Array.isArray(game.runShopInventory) || (game.runShopInventory.length === 0 && !alreadyGenerated)) {
        game.runShopInventory = generateInventoryForCurrentVisit(game, count);
        game._runShopInventoryGeneratedForRound = visitKey;
    }
}

function applyStarterBoost(game) {
    const cfg = CONFIG.gameplay || {};
    const shield = cfg.runShopStarterBoostShield || 2;
    const damage = cfg.runShopStarterBoostFlatDamage || 1;
    const damageRounds = cfg.runShopStarterBoostDamageRounds || 2;
    const fragments = cfg.runShopStarterBoostFragments || 12;
    game.playerShield = (game.playerShield || 0) + shield;
    game.flatDamageBonus = (game.flatDamageBonus || 0) + damage;
    game.runShopStarterBoostDamageAmount = (game.runShopStarterBoostDamageAmount || 0) + damage;
    game.runShopStarterBoostDamageRounds = Math.max(game.runShopStarterBoostDamageRounds || 0, damageRounds);
    game.runFragments = (game.runFragments || 0) + fragments;
    game.runShopStarterBoostClaimed = true;
    if (window.showToast) {
        window.showToast(`首访援助：防线屏障 +${shield} / 伤害 +${damage}（${damageRounds} 回合） / 碎片 +${fragments}`);
    }
}

export const run_shop = {
    /**
     * 打开局内商店
     * @param {Function} onClose - 关闭后的回调
     */
    ui_showRunShop(onClose, options = {}) {
        const cfg = CONFIG.gameplay || {};
        ensureInventoryForCurrentVisit(this, cfg.runShopItemsPerOffer || 5);
        this._runShopOpenedRound = this.round || 0;
        this._runShopReason = options.reason || this._runShopReason || 'manual';
        this._runShopOnClose = onClose || null;
        this._runShopPausedByOverlay = false;
        if (!onClose && ['gathering', 'combat', 'selection'].includes(this.phase) && !this.isPaused) {
            this.isPaused = true;
            this._runShopPausedByOverlay = true;
        }

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

    ui_offerRunShop(onClose, reason = 'interval') {
        const cfg = CONFIG.gameplay || {};
        ensureInventoryForCurrentVisit(this, cfg.runShopItemsPerOffer || 5);
        this._runShopOpenedRound = this.round || 0;
        this._runShopReason = reason;

        const fragments = this.runFragments || 0;
        const affordableCount = countAffordable(this.runShopInventory, fragments);
        let overlay = document.getElementById('run-shop-offer-overlay');
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.id = 'run-shop-offer-overlay';
            overlay.style.cssText = `
                position: fixed; inset: 0; z-index: 244;
                background: rgba(2, 6, 23, 0.72);
                display: flex; align-items: center; justify-content: center;
                padding: 18px; box-sizing: border-box;
                font-family: 'Cinzel', 'Microsoft YaHei', sans-serif;
                color: #e2e8f0;
            `;
            document.body.appendChild(overlay);
        }
        const reasonText = reason === 'boss' ? 'Boss 余波后，商人带来了稀有货架。' : '商人到访，可在下一轮研磨前调整构筑。';
        const openDisabled = affordableCount <= 0;
        overlay.innerHTML = `
            <div style="width:min(420px, 100%);background:rgba(15,23,42,0.97);border:1px solid rgba(168,85,247,0.45);border-radius:12px;padding:18px;box-shadow:0 18px 45px rgba(0,0,0,0.35);">
                <div style="font-size:18px;font-weight:bold;color:#c084fc;margin-bottom:6px;">局内商人</div>
                <div style="font-size:12px;color:#94a3b8;line-height:1.6;margin-bottom:12px;">${reasonText}</div>
                <div style="display:flex;justify-content:space-between;gap:10px;font-size:12px;margin-bottom:14px;">
                    <span>持有 <b style="color:#fbbf24;">${fragments} 🔮</b></span>
                    <span>可购买 <b style="color:${affordableCount > 0 ? '#86efac' : '#f87171'};">${affordableCount}</b> 件</span>
                </div>
                <div style="display:flex;gap:10px;justify-content:flex-end;">
                    <button id="run-shop-offer-skip" style="padding:8px 12px;background:rgba(30,41,59,0.9);color:#cbd5e1;border:1px solid rgba(148,163,184,0.35);border-radius:6px;cursor:pointer;">继续</button>
                    <button id="run-shop-offer-open" ${openDisabled ? 'disabled' : ''} style="padding:8px 14px;background:${openDisabled ? 'rgba(51,65,85,0.8)' : 'rgba(168,85,247,0.68)'};color:${openDisabled ? '#64748b' : '#fff'};border:1px solid rgba(216,180,254,0.65);border-radius:6px;cursor:${openDisabled ? 'not-allowed' : 'pointer'};font-weight:bold;">进入商店</button>
                </div>
            </div>
        `;
        overlay.style.display = 'flex';
        const closeOffer = () => {
            overlay.style.display = 'none';
            if (typeof this.sys_saveRunState === 'function') this.sys_saveRunState();
        };
        const skipBtn = overlay.querySelector('#run-shop-offer-skip');
        if (skipBtn) {
            skipBtn.addEventListener('click', () => {
                this.runShopInventory = [];
                this._runShopInventoryGeneratedForRound = 0;
                closeOffer();
                if (typeof onClose === 'function') onClose();
            });
        }
        const openBtn = overlay.querySelector('#run-shop-offer-open');
        if (openBtn && !openDisabled) {
            openBtn.addEventListener('click', () => {
                closeOffer();
                this.ui_showRunShop(onClose, { reason });
            });
        }
    },

    ui_hasAffordableRunShopItem() {
        const cfg = CONFIG.gameplay || {};
        ensureInventoryForCurrentVisit(this, cfg.runShopItemsPerOffer || 5);
        return countAffordable(this.runShopInventory, this.runFragments || 0) > 0;
    },

    ui_hideRunShop() {
        const overlay = document.getElementById('run-shop-overlay');
        if (overlay) overlay.style.display = 'none';
        if (this._runShopPausedByOverlay) {
            this.isPaused = false;
            this._runShopPausedByOverlay = false;
        }
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
            const metaHtml = it.meta ? `<div style="font-size:9px;color:${rarityColor};line-height:1.35;text-transform:uppercase;">${it.meta}</div>` : '';
            const priceLabel = (it.price || 0) <= 0 ? '免费' : `${it.price} 🔮`;
            return `<div data-item-idx="${i}" class="run-shop-item" style="cursor:${cursor};opacity:${opacity};background:rgba(30, 41, 59, 0.7);border:1px solid ${rarityColor};border-radius:8px;padding:10px;display:flex;flex-direction:column;gap:6px;transition:all 0.15s;">
                <div style="display:flex;align-items:center;justify-content:space-between;">
                    <div style="font-size:22px;">${it.icon}</div>
                    <div style="font-size:12px;font-weight:bold;color:${rarityColor};">${priceLabel}</div>
                </div>
                <div style="font-size:13px;font-weight:bold;">${it.name}</div>
                ${metaHtml}
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
                this._runShopInventoryGeneratedForRound = getRunShopVisitKey(this);
                this.runShopRefreshes = (this.runShopRefreshes || 0) + 1;
                if (typeof this.sys_saveRunState === 'function') this.sys_saveRunState();
                this.ui_renderRunShop();
            });
        }
        const closeBtn = overlay.querySelector('#run-shop-close-btn');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                if (typeof this.sys_isRunShopActive !== 'function' || !this.sys_isRunShopActive()) {
                    this.runShopInventory = []; // 非到访期的旧入口离开后清空，下次重新生成
                    this._runShopInventoryGeneratedForRound = 0;
                }
                if (typeof this.sys_saveRunState === 'function') this.sys_saveRunState();
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
            this.ownedModuleComponents = addModuleComponentToInventory(this.ownedModuleComponents, it.moduleId);
            if (window.showToast) window.showToast(`获得钉盘组件: ${it.name}`);
        } else if (it.kind === 'starter_boost') {
            applyStarterBoost(this);
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
        } else if (it.kind === 'marble_pack') {
            this.runFragments -= it.price;
            inventory.splice(idx, 1);
            if (typeof this.sys_saveRunState === 'function') this.sys_saveRunState();
            if (typeof this.sys_startMarblePackGrind === 'function') {
                this.sys_startMarblePackGrind({ packId: it.packId || 'mixed', source: 'run_shop_purchase', round: this.round || 1 });
            }
            return;
        }
        this.runFragments -= it.price;
        // 售出后从商店列表移除
        inventory.splice(idx, 1);
        if (typeof this.sys_saveRunState === 'function') this.sys_saveRunState();
        this.ui_renderRunShop();
    },

    ui_updateRunShopScheduleUI() {
        const dock = document.getElementById('run-shop-status-dock');
        if (!dock) return;

        const visiblePhase = this.phase === 'gathering' || this.phase === 'combat';
        const state = typeof this.sys_getRunShopScheduleState === 'function'
            ? this.sys_getRunShopScheduleState()
            : null;
        if (!visiblePhase || !state || state.hidden) {
            dock.classList.remove('is-gathering-top');
            dock.classList.remove('is-combat-top');
            dock.style.display = 'none';
            return;
        }

        const titleEl = document.getElementById('run-shop-status-title');
        const detailEl = document.getElementById('run-shop-status-detail');
        const fillEl = document.getElementById('run-shop-status-fill');
        const btn = document.getElementById('run-shop-status-open');
        const pct = Math.max(0, Math.min(100, Math.round((state.progress || 0) * 100)));

        dock.style.display = 'flex';
        dock.classList.toggle('is-gathering-top', this.phase === 'gathering');
        dock.classList.toggle('is-combat-top', this.phase === 'combat');
        dock.classList.toggle('is-active', !!state.isActive);
        if (fillEl) fillEl.style.width = `${pct}%`;

        if (state.isActive) {
            const remaining = state.remainingRounds || 1;
            if (titleEl) titleEl.textContent = '商人已到访';
            if (detailEl) detailEl.textContent = remaining <= 1 ? '下回合离开' : `${remaining} 回合后离开`;
            if (btn) {
                btn.style.display = 'inline-flex';
                btn.disabled = false;
            }
        } else {
            const wait = state.roundsUntilArrival || 0;
            if (titleEl) titleEl.textContent = '商人旅程';
            if (detailEl) detailEl.textContent = wait <= 0 ? '本回合到访' : (wait === 1 ? '下回合到访' : `${wait} 回合后到访`);
            if (btn) {
                btn.style.display = 'none';
                btn.disabled = true;
            }
        }

        if (btn && btn.dataset.runShopBound !== 'true') {
            btn.dataset.runShopBound = 'true';
            btn.addEventListener('click', () => {
                if (typeof this.sys_isRunShopActive === 'function' && !this.sys_isRunShopActive()) return;
                this.ui_showRunShop(null, { reason: 'status_dock' });
            });
        }
    },
};
