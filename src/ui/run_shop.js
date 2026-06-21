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
import { MarbleDefinition } from '../entities.js';
import { RUNE_DB } from '../rune_config.js';
import { MODULE_DEFS, ATTR_PIN_TYPES, addModuleComponentToInventory, getModuleMetaSummary } from '../pinboard_modules.js';

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

// [v2] 属性钉板：商店随机刷新一个带某属性的钉板模块（按当前属性权重）
const ATTR_PIN_PRICE = 70;
const ATTR_PIN_LABEL = {
    bounce: '彈性', pierce: '穿透', scatter: '散射',
    damage: '增幅', cryo: '冰霜',   pyro: '火焰', wind: '疾風',
};

const MARBLE_PACK_SPECS = {
    mixed: {
        id: 'mixed',
        name: '杂色胚珠包',
        icon: '⚪',
        desc: '按基础概率抽取 3 颗弹珠；纯净弹珠权重最高，价格最低。',
        slots: 3,
        rarity: 'common',
    },
    no_white: {
        id: 'no_white',
        name: '去纯胚珠包',
        icon: '✦',
        desc: '移除纯净弹珠后重新计算概率，抽取 3 颗弹珠。',
        slots: 3,
        exclude: ['white'],
        rarity: 'rare',
        ruleMarkup: 1.18,
    },
    pierce_fixed: {
        id: 'pierce_fixed',
        name: '穿透定向包',
        icon: '↗',
        desc: '固定提供 1 颗穿透弹珠，再按基础概率抽取 2 颗。',
        slots: 2,
        fixed: ['pierce'],
        rarity: 'legendary',
        ruleMarkup: 1.12,
    },
    pyro_bias: {
        id: 'pyro_bias',
        name: '火焰倾向包',
        icon: '🔥',
        desc: '火焰权重大幅提高后抽取 3 颗弹珠，不保证必出。',
        slots: 3,
        bias: { pyro: 3 },
        rarity: 'rare',
        ruleMarkup: 1.08,
    },
};

const MARBLE_PACK_ROTATION = ['mixed', 'no_white', 'pyro_bias', 'pierce_fixed'];

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

function takeRandom(pool) {
    if (!pool || pool.length === 0) return null;
    const idx = Math.floor(Math.random() * pool.length);
    return pool.splice(idx, 1)[0];
}

function getMarbleWeights(game, spec = {}) {
    const base = { ...(CONFIG.probabilities || {}) };
    const boosted = (game && game.unlockedWeights) || {};
    const exclude = new Set(spec.exclude || []);
    const weights = {};
    for (const [type, baseWeight] of Object.entries(base)) {
        if (exclude.has(type)) continue;
        const boostedWeight = Math.max(0, boosted[type] || 0);
        const weight = Math.max(0, boostedWeight || baseWeight || 0);
        if (weight > 0) weights[type] = weight;
    }
    if (spec.bias) {
        for (const [type, mult] of Object.entries(spec.bias)) {
            if (weights[type]) weights[type] *= Math.max(1, mult || 1);
        }
    }
    return weights;
}

function pickWeightedType(weights) {
    const entries = Object.entries(weights || {}).filter(([, w]) => w > 0);
    const total = entries.reduce((sum, [, w]) => sum + w, 0);
    if (total <= 0) return 'white';
    let r = Math.random() * total;
    for (const [type, weight] of entries) {
        r -= weight;
        if (r <= 0) return type;
    }
    return entries[entries.length - 1][0] || 'white';
}

function marbleTypeValue(type) {
    const cfg = CONFIG.gameplay || {};
    const probs = CONFIG.probabilities || {};
    const basePrice = Math.max(1, cfg.runShopMarblePackBasePrice || 16);
    const rarityPower = cfg.runShopMarblePackRarityPower ?? 0.65;
    const reference = Math.max(1, probs.white || 100);
    const p = Math.max(1, probs[type] || 1);
    return basePrice * Math.pow(reference / p, rarityPower);
}

function calcRandomSlotEv(weights) {
    const entries = Object.entries(weights || {}).filter(([, w]) => w > 0);
    const total = entries.reduce((sum, [, w]) => sum + w, 0);
    if (total <= 0) return marbleTypeValue('white');
    return entries.reduce((sum, [type, weight]) => {
        return sum + (weight / total) * marbleTypeValue(type);
    }, 0);
}

function rollMarblePack(game, spec) {
    const result = [];
    (spec.fixed || []).forEach(type => result.push(type));
    const weights = getMarbleWeights(game, spec);
    for (let i = 0; i < (spec.slots || 3); i++) {
        result.push(pickWeightedType(weights));
    }
    return result.slice(0, 3);
}

function priceMarblePack(game, spec) {
    const cfg = CONFIG.gameplay || {};
    const weights = getMarbleWeights(game, spec);
    const fixedValue = (spec.fixed || []).reduce((sum, type) => sum + marbleTypeValue(type), 0);
    const randomValue = calcRandomSlotEv(weights) * (spec.slots || 3);
    const markup = Math.max(1, cfg.runShopMarblePackMarkup || 1.15) * Math.max(1, spec.ruleMarkup || 1);
    return Math.max(8, Math.round((fixedValue + randomValue) * markup));
}

function createMarblePackItem(game, specId) {
    const spec = MARBLE_PACK_SPECS[specId] || MARBLE_PACK_SPECS.mixed;
    const fixedText = spec.fixed && spec.fixed.length > 0 ? ` 固定: ${spec.fixed.join('/')}` : '';
    return {
        kind: 'marble_pack',
        packId: spec.id,
        name: spec.name,
        icon: spec.icon,
        desc: `${spec.desc}${fixedText}`,
        price: priceMarblePack(game, spec),
        rarity: spec.rarity || 'common',
    };
}

function grantMarblePack(game, packId) {
    const spec = MARBLE_PACK_SPECS[packId] || MARBLE_PACK_SPECS.mixed;
    const types = rollMarblePack(game, spec);
    if (!Array.isArray(game.guaranteedNextRound)) game.guaranteedNextRound = [];
    game.guaranteedNextRound.unshift(...types);
    game.lastMarblePackTypes = types.slice();

    const currentQueueEmpty = !Array.isArray(game.marbleQueue) || game.marbleQueue.length === 0;
    const canPrimeImmediately = currentQueueEmpty && !['combat', 'gathering'].includes(game.phase);
    if (canPrimeImmediately) {
        game.marbleQueue = types.map(type => new MarbleDefinition(type));
        game.marblesPool = game.marbleQueue.slice();
        game.selectedMarbles = game.marbleQueue.map((_, idx) => idx);
    }

    const names = types.map(type => {
        const display = CONFIG.ui?.attributeDisplay?.[type];
        return display ? display.name : type;
    }).join(' / ');
    if (window.showToast) window.showToast(`打开${spec.name}: ${names}`);
    return types;
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

/**
 * 生成商品列表
 */
function generateInventory(game, count) {
    const cfg = CONFIG.gameplay || {};
    const items = [];

    // 0. 弹珠包：商人提供低价杂色包，并随机提供一个更强规则包。
    items.push(createMarblePackItem(game, 'mixed'));
    const packPool = MARBLE_PACK_ROTATION.filter(id => id !== 'mixed');
    const packId = packPool[Math.floor(Math.random() * packPool.length)] || 'no_white';
    items.push(createMarblePackItem(game, packId));

    // 1. 构筑组件：购买得到的是单个组件实例，不是无限使用的模板解锁。
    const modulePool = Object.values(MODULE_DEFS).filter(d => d.price > 0 && !d.isAttrPin);
    const addModuleItem = () => {
        const def = takeRandom(modulePool);
        if (!def) return false;
        const meta = getModuleMetaSummary(def.id);
        items.push({ kind: 'module', moduleId: def.id, name: def.name, icon: def.icon, desc: def.desc, meta, price: def.price, rarity: def.rarity });
        return true;
    };
    if (items.length < count) addModuleItem();

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

    // 3. 属性钉板：按当前属性权重随机刷出一个带属性的钉板模块。
    const attrPinType = rollAttributePinType(game);
    if (attrPinType) {
        const moduleId = `attr_pin_${attrPinType}`;
        const def = MODULE_DEFS[moduleId];
        if (def) {
            if (items.length < count) items.push({
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

    // 4. 符文商品：保底至少一个，其余按缺口补齐到目标数量。
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
        window.showToast(`首访援助：护盾 +${shield} / 伤害 +${damage}（${damageRounds} 回合） / 碎片 +${fragments}`);
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
        if (it.kind === 'module' || it.kind === 'attr_pin') {
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
            grantMarblePack(this, it.packId);
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

        const visiblePhase = this.phase === 'gathering';
        const state = typeof this.sys_getRunShopScheduleState === 'function'
            ? this.sys_getRunShopScheduleState()
            : null;
        if (!visiblePhase || !state || state.hidden) {
            dock.classList.remove('is-gathering-top');
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
