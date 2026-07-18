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

import { CONFIG, SKILL_DB } from '../config.js';
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

    // 1.5 [技能来源扩展] 主动技能商品：出售 source:'shop' 的技能，每局每个技能仅售一次。
    const purchasedSkillSet = new Set(game.purchasedSkillIds || []);
    const skillPool = (SKILL_DB || []).filter(s => s && s.source === 'shop' && !purchasedSkillSet.has(s.id));
    const skillItem = takeRandom(skillPool);
    if (skillItem && items.length < count) {
        items.push({
            kind: 'skill_unlock',
            skillId: skillItem.id,
            name: skillItem.name,
            icon: skillItem.icon,
            desc: `${skillItem.desc}（释放需消耗 ${skillItem.cost} SP）`,
            price: skillItem.shopPrice || 80,
            rarity: 'epic',
        });
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
    if (!Number.isInteger(game._runShopItemSequence)) game._runShopItemSequence = 0;
    (game.runShopInventory || []).forEach(item => {
        if (!item.itemId) {
            item.itemId = `shop-${visitKey}-${++game._runShopItemSequence}`;
        }
    });
}

function getDialogFocusable(container) {
    if (!container || typeof container.querySelectorAll !== 'function') return [];
    return Array.from(container.querySelectorAll('button:not([disabled]), [href], [tabindex]:not([tabindex="-1"])'))
        .filter(element => element && element.getAttribute('aria-hidden') !== 'true');
}

function trapDialogFocus(event, container, onEscape) {
    if (event.key === 'Escape') {
        event.preventDefault();
        onEscape();
        return;
    }
    if (event.key !== 'Tab') return;
    const focusable = getDialogFocusable(container);
    if (focusable.length === 0) {
        event.preventDefault();
        container.focus?.();
        return;
    }
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
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
        const requestedReason = options.reason || this._runShopReason || 'manual';

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
        if (this._runShopSession?.active) {
            this.ui_renderRunShop();
            getDialogFocusable(overlay)[0]?.focus();
            return false;
        }
        if (typeof this.input_cancelActiveInteraction === 'function') {
            this.input_cancelActiveInteraction(null, { reason: 'overlay:run_shop' });
        }
        this._runShopReason = requestedReason;

        const sessionId = `run-shop:${this._runLifecycleEpoch || 0}:${this.round || 1}:${Date.now()}`;
        const session = {
            id: sessionId,
            active: true,
            onClose: typeof onClose === 'function' ? onClose : null,
            reason: this._runShopReason,
            previousFocus: options.returnFocus || document.activeElement || null,
            pauseToken: null,
        };
        if (typeof this.sys_acquirePauseLease === 'function') {
            session.pauseToken = this.sys_acquirePauseLease(sessionId);
        }
        session.keydownHandler = event => trapDialogFocus(event, overlay, () => this.ui_hideRunShop({ reason: 'escape', sessionId }));
        overlay.addEventListener('keydown', session.keydownHandler);
        this._runShopSession = session;
        this._runShopPauseLeaseToken = session.pauseToken;
        this._runShopOnClose = session.onClose;

        overlay.setAttribute('role', 'dialog');
        overlay.setAttribute('aria-modal', 'true');
        overlay.setAttribute('aria-labelledby', 'run-shop-dialog-title');
        overlay.tabIndex = -1;
        overlay.style.display = 'flex';
        this.ui_renderRunShop();
        (getDialogFocusable(overlay)[0] || overlay).focus?.();
        return true;
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
        const openDisabledReason = openDisabled ? '当前没有买得起的商品' : '';
        overlay.setAttribute('role', 'dialog');
        overlay.setAttribute('aria-modal', 'true');
        overlay.setAttribute('aria-labelledby', 'run-shop-offer-title');
        overlay.tabIndex = -1;
        overlay.innerHTML = `
            <div style="width:min(420px, 100%);background:rgba(15,23,42,0.97);border:1px solid rgba(168,85,247,0.45);border-radius:12px;padding:18px;box-shadow:0 18px 45px rgba(0,0,0,0.35);">
                <div id="run-shop-offer-title" style="font-size:18px;font-weight:bold;color:#c084fc;margin-bottom:6px;">局内商人</div>
                <div style="font-size:12px;color:#94a3b8;line-height:1.6;margin-bottom:12px;">${reasonText}</div>
                <div style="display:flex;justify-content:space-between;gap:10px;font-size:12px;margin-bottom:14px;">
                    <span>持有 <b style="color:#fbbf24;">${fragments} 🔮</b></span>
                    <span>可购买 <b style="color:${affordableCount > 0 ? '#86efac' : '#f87171'};">${affordableCount}</b> 件</span>
                </div>
                <div style="display:flex;gap:10px;justify-content:flex-end;">
                    <button id="run-shop-offer-skip" style="padding:8px 12px;background:rgba(30,41,59,0.9);color:#cbd5e1;border:1px solid rgba(148,163,184,0.35);border-radius:6px;cursor:pointer;">继续</button>
                    <button id="run-shop-offer-open" ${openDisabled ? 'disabled' : ''} aria-disabled="${openDisabled ? 'true' : 'false'}" title="${openDisabledReason || '进入商店'}" aria-label="${openDisabledReason || '进入商店'}" style="padding:8px 14px;background:${openDisabled ? 'rgba(51,65,85,0.8)' : 'rgba(168,85,247,0.68)'};color:${openDisabled ? '#64748b' : '#fff'};border:1px solid rgba(216,180,254,0.65);border-radius:6px;cursor:${openDisabled ? 'not-allowed' : 'pointer'};font-weight:bold;">${openDisabledReason || '进入商店'}</button>
                </div>
            </div>
        `;
        overlay.style.display = 'flex';
        let settled = false;
        const closeOffer = () => {
            if (settled) return false;
            settled = true;
            overlay.style.display = 'none';
            if (typeof this.sys_saveRunState === 'function') this.sys_saveRunState();
            return true;
        };
        const skipBtn = overlay.querySelector('#run-shop-offer-skip');
        if (skipBtn) {
            skipBtn.addEventListener('click', () => {
                if (settled) return;
                this.runShopInventory = [];
                this._runShopInventoryGeneratedForRound = 0;
                closeOffer();
                if (typeof onClose === 'function') onClose();
            });
        }
        const openBtn = overlay.querySelector('#run-shop-offer-open');
        if (openBtn && !openDisabled) {
            openBtn.addEventListener('click', () => {
                if (settled) return;
                closeOffer();
                this.ui_showRunShop(onClose, { reason });
            });
        }
        (skipBtn || openBtn || overlay).focus?.();
    },

    ui_hasAffordableRunShopItem() {
        const cfg = CONFIG.gameplay || {};
        ensureInventoryForCurrentVisit(this, cfg.runShopItemsPerOffer || 5);
        return countAffordable(this.runShopInventory, this.runFragments || 0) > 0;
    },

    ui_hideRunShop(options = {}) {
        const overlay = document.getElementById('run-shop-overlay');
        const session = this._runShopSession;
        if (!session?.active) return false;
        if (options.sessionId && options.sessionId !== session.id) return false;
        session.active = false;
        if (overlay) overlay.style.display = 'none';
        if (overlay && session.keydownHandler) {
            overlay.removeEventListener('keydown', session.keydownHandler);
        }
        const pauseToken = session.pauseToken;
        session.pauseToken = null;
        this._runShopPauseLeaseToken = null;
        const cb = session.onClose;
        session.onClose = null;
        if (this._runShopSession === session) this._runShopSession = null;
        this._runShopOnClose = null;
        if (pauseToken && typeof this.sys_releasePauseLease === 'function') {
            this.sys_releasePauseLease(pauseToken);
        }
        if (options.restoreFocus !== false && !this._runShopSession?.active
            && session.previousFocus?.isConnected !== false) {
            session.previousFocus?.focus?.();
        }
        if (typeof this.sys_saveRunState === 'function') this.sys_saveRunState();
        if (options.invokeOnClose !== false && typeof cb === 'function') cb();
        return true;
    },

    ui_renderRunShop() {
        const overlay = document.getElementById('run-shop-overlay');
        if (!overlay) return;
        const sessionId = this._runShopSession?.active ? this._runShopSession.id : null;
        if (!sessionId) return;
        const activeElement = document.activeElement;
        const restoreFocusAfterRender = !!(activeElement
            && typeof overlay.contains === 'function'
            && overlay.contains(activeElement));
        const focusedItemId = restoreFocusAfterRender ? activeElement.dataset?.itemId || null : null;
        const focusedControlId = restoreFocusAfterRender ? activeElement.id || null : null;
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
            const disabledReason = canAfford ? '' : `还差 ${Math.max(0, it.price - fragments)} 碎片`;
            return `<button type="button" data-item-id="${it.itemId}" data-item-idx="${i}" class="run-shop-item" ${canAfford ? '' : 'disabled'} aria-disabled="${canAfford ? 'false' : 'true'}" title="${canAfford ? `购买 ${it.name}` : disabledReason}" aria-label="${it.name}，${priceLabel}${disabledReason ? `，${disabledReason}` : ''}" style="width:100%;text-align:left;color:inherit;cursor:${cursor};opacity:${opacity};background:rgba(30, 41, 59, 0.7);border:1px solid ${rarityColor};border-radius:8px;padding:10px;display:flex;flex-direction:column;gap:6px;transition:all 0.15s;">
                <div style="display:flex;align-items:center;justify-content:space-between;">
                    <div style="font-size:22px;">${it.icon}</div>
                    <div style="font-size:12px;font-weight:bold;color:${rarityColor};">${priceLabel}</div>
                </div>
                <div style="font-size:13px;font-weight:bold;">${it.name}</div>
                ${metaHtml}
                <div style="font-size:10px;color:#94a3b8;line-height:1.4;">${it.desc}</div>
                ${disabledReason ? `<div style="font-size:10px;color:#fca5a5;">${disabledReason}</div>` : ''}
            </button>`;
        }).join('');

        const canRefresh = fragments >= refreshCost;
        const refreshReason = canRefresh ? '' : `还差 ${refreshCost - fragments} 碎片`;

        overlay.innerHTML = `
            <div style="background: rgba(15, 23, 42, 0.96); border: 1px solid rgba(168, 85, 247, 0.4); border-radius: 12px; padding: 18px; max-width: 760px; width: 100%; max-height: 92vh; overflow: auto; display: flex; flex-direction: column; gap: 14px;">
                <div style="display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid rgba(168, 85, 247, 0.3);padding-bottom:10px;">
                    <div id="run-shop-dialog-title" style="font-size:18px;font-weight:bold;color:#c084fc;">局内商店</div>
                    <div style="font-size:13px;">持有: <span style="color:#fbbf24;font-weight:bold;">${fragments} 🔮</span></div>
                </div>
                <div style="display:grid;grid-template-columns:repeat(auto-fill, minmax(160px, 1fr));gap:10px;">
                    ${itemsHtml || '<div style="color:#64748b;font-size:12px;">商店为空</div>'}
                </div>
                <div style="display:flex;justify-content:space-between;align-items:center;border-top:1px solid rgba(168, 85, 247, 0.3);padding-top:10px;">
                    <button id="run-shop-refresh-btn" ${canRefresh ? '' : 'disabled'} aria-disabled="${canRefresh ? 'false' : 'true'}" title="${canRefresh ? '刷新商品' : refreshReason}" style="padding:6px 12px;background:rgba(56, 189, 248, 0.4);color:#fff;border:1px solid rgba(56, 189,248,0.7);border-radius:6px;cursor:${canRefresh ? 'pointer' : 'not-allowed'};font-size:12px;">刷新 (${refreshCost} 🔮)${refreshReason ? ` · ${refreshReason}` : ''}</button>
                    <button id="run-shop-close-btn" style="padding:8px 18px;background:rgba(34, 197, 94, 0.55);color:#fff;border:1px solid rgba(34, 197, 94, 0.8);border-radius:6px;cursor:pointer;font-weight:bold;">离开商店</button>
                </div>
            </div>
        `;

        overlay.querySelectorAll('.run-shop-item').forEach(el => {
            el.addEventListener('click', () => {
                this.ui_buyRunShopItem(el.dataset.itemId, sessionId);
            });
        });
        const refreshBtn = overlay.querySelector('#run-shop-refresh-btn');
        if (refreshBtn && canRefresh) {
            refreshBtn.addEventListener('click', () => {
                if (!this._runShopSession?.active || this._runShopSession.id !== sessionId) return;
                if ((this.runFragments || 0) < refreshCost) {
                    if (window.showToast) window.showToast('碎片不足');
                    return;
                }
                this.runFragments -= refreshCost;
                this.runShopInventory = generateInventory(this, cfg.runShopItemsPerOffer || 5);
                this._runShopInventoryGeneratedForRound = getRunShopVisitKey(this);
                ensureInventoryForCurrentVisit(this, cfg.runShopItemsPerOffer || 5);
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
                this.ui_hideRunShop({ sessionId });
            });
        }
        if (restoreFocusAfterRender) {
            let nextFocus = null;
            if (focusedItemId) {
                nextFocus = Array.from(overlay.querySelectorAll('[data-item-id]'))
                    .find(element => element.dataset?.itemId === focusedItemId) || null;
            }
            if (!nextFocus && focusedControlId) {
                nextFocus = overlay.querySelector(`#${focusedControlId}`);
            }
            (nextFocus || getDialogFocusable(overlay)[0] || overlay).focus?.();
        }
    },

    ui_buyRunShopItem(itemRef, sessionId = null) {
        const activeSession = this._runShopSession;
        if (!activeSession?.active || (sessionId && sessionId !== activeSession.id)) return false;
        const inventory = Array.isArray(this.runShopInventory) ? this.runShopInventory : [];
        const idx = typeof itemRef === 'string'
            ? inventory.findIndex(item => item?.itemId === itemRef)
            : Number(itemRef);
        const it = inventory[idx];
        if (!it || it._sold || this._runShopPurchaseInFlight) return false;
        if ((this.runFragments || 0) < it.price) {
            if (window.showToast) window.showToast('碎片不足');
            return false;
        }
        this._runShopPurchaseInFlight = it.itemId || `index:${idx}`;
        it._sold = true;
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
        } else if (it.kind === 'skill_unlock') {
            // [技能来源扩展] 购买主动技能：写入 purchasedSkillIds 并重算技能并集
            if (!Array.isArray(this.purchasedSkillIds)) this.purchasedSkillIds = [];
            if (!this.purchasedSkillIds.includes(it.skillId)) this.purchasedSkillIds.push(it.skillId);
            if (typeof this.combat_recomputeActiveSkills === 'function') this.combat_recomputeActiveSkills();
            if (window.showToast) window.showToast(`习得技能: ${it.name}`);
        } else if (it.kind === 'marble_pack') {
            const startPurchasedPackGrind = purchasedPack => {
                if (typeof this.sys_startMarblePackGrind === 'function') {
                    this.sys_startMarblePackGrind(purchasedPack);
                }
            };
            this.runFragments -= it.price;
            inventory.splice(idx, 1);
            const purchasedPack = {
                id: `purchase:${it.itemId}`,
                packId: it.packId || 'mixed',
                source: 'run_shop_purchase',
                round: this.round || 1,
                purchasedItemId: it.itemId,
            };
            // A skipped resolver relic can have other rewards before its queued
            // pack. Replace that pack in place and resume the resolver so order
            // is preserved; consuming a later pack and jumping straight to
            // gathering would strand the earlier rewards.
            if (this._runShopReason === 'skip_relic') {
                const pendingRewards = Array.isArray(this.pendingRoundStartRewards)
                    ? this.pendingRoundStartRewards
                    : (this.pendingRoundStartRewards = []);
                const queuedPackIndex = pendingRewards.findIndex(reward =>
                    reward && (reward.type === 'marble_pack' || reward.type === 'essence'));
                if (queuedPackIndex >= 0) {
                    const queuedPack = pendingRewards[queuedPackIndex];
                    pendingRewards[queuedPackIndex] = {
                        ...queuedPack,
                        type: 'marble_pack',
                        packId: purchasedPack.packId,
                        source: purchasedPack.source,
                        purchasedItemId: purchasedPack.purchasedItemId,
                    };
                } else if (typeof this.sys_queueRoundStartReward === 'function') {
                    this.sys_queueRoundStartReward({ ...purchasedPack, type: 'marble_pack' });
                }
                this.ui_hideRunShop({ invokeOnClose: false, reason: 'marble_pack_purchase' });
                this._runShopPurchaseInFlight = null;
                return typeof this.sys_startRoundStartResolver === 'function'
                    ? this.sys_startRoundStartResolver()
                    : false;
            }
            this.ui_hideRunShop({ invokeOnClose: false, reason: 'marble_pack_purchase' });
            startPurchasedPackGrind(purchasedPack);
            this._runShopPurchaseInFlight = null;
            return true;
        }
        this.runFragments -= it.price;
        // 售出后从商店列表移除
        inventory.splice(idx, 1);
        if (typeof this.sys_saveRunState === 'function') this.sys_saveRunState();
        this._runShopPurchaseInFlight = null;
        this.ui_renderRunShop();
        return true;
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
