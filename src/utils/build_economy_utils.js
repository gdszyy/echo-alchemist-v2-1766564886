/**
 * build_economy_utils.js - [REQ-20261022-wave-loop · S2] 整备阶段经济的纯函数工具。
 *
 * 设计依据：docs/design/dig_build_defend_loop_v1.md §4（资源）、§5.1 主炮、§5.2 设施、§5.4 道具、
 *           §6 挖矿升级、§8 逐波解锁、§9 纸面推演（数值是测试夹具）。
 * 约束：本文件不得 import 任何大文件（config.js / game_*.js 等），node 可直接导入做单测；
 *       调用方把 CONFIG.gameplay.build 作为 cfg 传入。所有函数不修改入参。
 *
 * 整备状态（BuildState）形状：
 *   {
 *     energy: number, crystal: number,
 *     cannonLevels: { dmg, rate, bounce },
 *     cannonBranch: null | 'pierce' | 'scatter' | 'fire' | 'ice' | 'lightning',
 *     facilities: Array<null | { type, level, cd }>,   // 长度 = cfg.slots.total
 *     facilitySlotsOpen: number,
 *     items: string[],                                  // 道具 id，长度 ≤ cfg.items.slots
 *     miningLevels: { collector },
 *   }
 *
 * 购买动作（action）：
 *   { type: 'cannon', track: 'dmg' | 'rate' | 'bounce' }
 *   { type: 'branch', branch }
 *   { type: 'slot' }                                    // 开下一个设施位
 *   { type: 'build', slot, facility }                   // 在空的已开放设施位建造
 *   { type: 'upgrade', slot }                           // 升级该位设施（Lv3 另需 💎）
 *   { type: 'item', item }                              // 买一次性道具
 *   { type: 'mining', key: 'collector' }                // 挖矿升级
 *
 * 价格（getPrice 的返回，恒三字段）：`{ energy, crystal, materials }`。
 *   `materials` 是**逐料需求**（键只认 pyro / cryo / beast，且**只含正数键**；无料价时为 `{}`，不是 undefined / null）。
 *   旧五件设施是纯能量计价 ⇒ `materials` 恒 `{}`；工坊 / 发电机 / 电池 `cost: 0` 走料价 ⇒ `materials` 取
 *   `facilities[type].materials`（建造）或 `facilities[type].upMaterials[level-1]`（升级，与 `upCost[level-1]` 同下标）。
 *   **付料价的动作必须把料账本作为 `tryPurchase` 第 5 参传入**，否则一律按 `'materials'` 拒绝（绝不静默免费成交）。
 */

// 同目录纯函数（料账本层同样不 import 任何大文件，node 可直接导入做单测）。
import { chargeBuildMaterials, normalizeLedger } from './material_economy_utils.js';

const CANNON_PRICE_KEYS = { dmg: 'damagePrices', rate: 'ratePrices', bounce: 'bouncePrices' };
/** 料价的合法键（与 material_economy_utils.js 的 MATERIAL_KEYS 同序同名；此处不 import，避免价格层依赖账本层）。 */
const PRICE_MATERIAL_KEYS = ['pyro', 'cryo', 'beast'];
export const ITEM_IDS = ['bomb', 'timestop', 'shield', 'extraDig'];
// 顺序即 UI 里建造弹层的排列顺序：旧五件在前，三件料付后勤设施在后。
// `synth` 不加入：盘上 `config.power.synth` 的 `electricPerUnit[5,4,3] × capPerWave[2,3,4]` 算出每波耗电
// 10/12/12，而自身只产 2/3/4⚡，净产出恒为负 ⇒ 上游数值口径自相矛盾，本轮不开放建造。
export const FACILITY_IDS = ['turret', 'lightning', 'frost', 'shieldGen', 'collector', 'workshop', 'generator', 'battery'];
const FACILITY_MAX_LEVEL = 3;

/** 主炮分支 → 主炮射击配方属性（sys_buildCannonShots 使用）。 */
export const BRANCH_SHOT_PROPS = {
    pierce: { pierce: 1 },
    scatter: { scatter: 1 },
    fire: { pyro: 1 },
    ice: { cryo: 1 },
    lightning: { lightning: 1 },
};

function _int(v, fallback = 0) {
    const n = Math.floor(Number(v));
    return Number.isFinite(n) ? n : fallback;
}

function _list(v) {
    return Array.isArray(v) ? v : [];
}

/**
 * 规范化整备状态（补默认值、深拷贝），保证后续函数可以安全地做不可变更新。
 * @param {object} state
 * @param {object} cfg - CONFIG.gameplay.build
 * @returns {object} 新的 BuildState
 */
export function normalizeBuildState(state = {}, cfg = {}) {
    const total = Math.max(1, _int(cfg.slots && cfg.slots.total, 3));
    const openAtStart = Math.max(1, _int(cfg.slots && cfg.slots.openAtStart, 1));
    const levels = state.cannonLevels || {};
    const facilities = [];
    for (let i = 0; i < total; i++) {
        const f = _list(state.facilities)[i];
        facilities.push(f && f.type ? { type: f.type, level: Math.max(1, _int(f.level, 1)), cd: _int(f.cd, 0) } : null);
    }
    return {
        energy: Math.max(0, Number(state.energy) || 0),
        crystal: Math.max(0, _int(state.crystal, 0)),
        cannonLevels: {
            dmg: Math.max(0, _int(levels.dmg, 0)),
            rate: Math.max(0, _int(levels.rate, 0)),
            bounce: Math.max(0, _int(levels.bounce, 0)),
        },
        cannonBranch: state.cannonBranch || null,
        facilities,
        facilitySlotsOpen: Math.min(total, Math.max(openAtStart, _int(state.facilitySlotsOpen, openAtStart))),
        items: _list(state.items).filter(id => ITEM_IDS.includes(id)),
        miningLevels: { collector: Math.max(0, _int(state.miningLevels && state.miningLevels.collector, 0)) },
    };
}

/**
 * 逐波解锁（§8）：返回已解锁的概念键集合。
 * @param {{ wave:number, bossKills:number }} progress - wave = 第几次挖掘（第几波）；bossKills = 已击败 Boss 数
 * @param {object} cfg - CONFIG.gameplay.build
 * @returns {Set<string>}
 */
export function getReveal(progress = {}, cfg = {}) {
    const wave = Math.max(0, _int(progress.wave, 0));
    const bossKills = Math.max(0, _int(progress.bossKills, 0));
    const table = cfg.reveal || {};
    const out = new Set();
    for (const [key, list] of Object.entries(table)) {
        const m = /^boss(\d+)$/.exec(key);
        const unlocked = m ? bossKills >= Number(m[1]) : wave >= Number(key);
        if (unlocked) _list(list).forEach(k => out.add(k));
    }
    return out;
}

/** 动作对应的解锁键（全部满足才算解锁）。 */
function _revealKeysFor(action) {
    switch (action && action.type) {
        case 'cannon': return [action.track];
        case 'branch': return ['branch'];
        case 'slot': return ['slots'];
        // `build` **只认设施自己的键**：`'slots'` 的语义是「设施位扩位 / 升级」这类**格位级**操作，
        // 不是「能不能盖某座设施」——一座设施该不该可见可建，由它自己的键决定。
        // 盘上 `config.js:1174` 的 reveal 表已把工坊 / 发电机列进第 1 波
        // （原注释：「第 1 波就能看见料付设施（当波买不起，第 2 波凑够）」）；
        // 若这里继续要求 `'slots'`（`config.js:1175` 在第 2 波才开），那两个键永远解不开任何东西。
        case 'build': return [action.facility];
        // **已知的、有意留下的延迟**：`slot` / `upgrade` 仍各自依赖 `'slots'`（升级仍从第 2 波起）。
        // 这两类动作没有「设施类型」可判（`{type:'slot'}` / `{type:'upgrade', slot:i}`），
        // 要按设施分别判定必须先改 action 形状，超出本批范围，故此处不改。
        case 'upgrade': return ['slots'];
        case 'item': return ['items', action.item];
        case 'mining': return ['mining'];
        default: return [];
    }
}

/**
 * 某个动作是否已按 §8 解锁。
 * @param {object} action
 * @param {Set<string>|string[]|null} reveal - null 表示不做解锁检查（试炼 / 测试）
 */
export function isActionRevealed(action, reveal) {
    if (!reveal) return true;
    const set = reveal instanceof Set ? reveal : new Set(_list(reveal));
    return _revealKeysFor(action).every(k => set.has(k));
}

/**
 * 料价归一：只留三色里的**正数**键（负值 / NaN / 非数字 / 未知料键一律不进价格对象）。
 * 无料价 ⇒ `{}`（不是 undefined / null：调用方可以无条件 `.materials` 取值）。
 * @param {object|null|undefined} src - `facilities[type].materials` 或 `upMaterials[level-1]`
 * @returns {{ pyro?:number, cryo?:number, beast?:number }}
 */
function _materialsOf(src) {
    const s = (src && typeof src === 'object') ? src : {};
    const out = {};
    for (const key of PRICE_MATERIAL_KEYS) {
        const n = _int(s[key], 0);
        if (n > 0) out[key] = n;
    }
    return out;
}

/**
 * 价格（不检查余额与解锁）。
 * @returns {{ energy:number, crystal:number, materials:object } | null}
 *   `materials` 恒存在：逐料需求（pyro / cryo / beast，只含正数键）；无料价时为 `{}`。
 *   null = 已满级 / 不可买 / 参数非法
 */
export function getPrice(state, action, cfg = {}) {
    const s = normalizeBuildState(state, cfg);
    const a = action || {};
    if (a.type === 'cannon') {
        const key = CANNON_PRICE_KEYS[a.track];
        if (!key) return null;
        const prices = _list(cfg.cannon && cfg.cannon[key]);
        const lv = s.cannonLevels[a.track];
        return lv < prices.length ? { energy: prices[lv], crystal: 0, materials: {} } : null;
    }
    if (a.type === 'branch') {
        return { energy: 0, crystal: Math.max(0, _int(cfg.cannon && cfg.cannon.branchCrystal, 1)), materials: {} };
    }
    if (a.type === 'slot') {
        if (s.facilitySlotsOpen >= s.facilities.length) return null;
        return { energy: 0, crystal: Math.max(0, _int(cfg.slots && cfg.slots.openCrystal, 2)), materials: {} };
    }
    const facCfg = (cfg.facilities || {});
    if (a.type === 'build') {
        const f = facCfg[a.facility];
        if (!f || !FACILITY_IDS.includes(a.facility)) return null;
        return { energy: _int(f.cost, 0), crystal: 0, materials: _materialsOf(f.materials) };
    }
    if (a.type === 'upgrade') {
        const fac = s.facilities[_int(a.slot, -1)];
        if (!fac) return null;
        const f = facCfg[fac.type];
        if (!f || fac.level >= FACILITY_MAX_LEVEL) return null;
        const energy = _int(_list(f.upCost)[fac.level - 1], 0);
        // 料价与能量价同下标并行取值：Lv(level)→Lv(level+1) 这一档 = upCost[level-1] / upMaterials[level-1]。
        const materials = _materialsOf(_list(f.upMaterials)[fac.level - 1]);
        const crystal = fac.level + 1 >= FACILITY_MAX_LEVEL ? Math.max(0, _int(facCfg.lv3Crystal, 1)) : 0;
        return { energy, crystal, materials };
    }
    if (a.type === 'item') {
        const it = cfg.items && cfg.items[a.item];
        if (!it || !ITEM_IDS.includes(a.item)) return null;
        return { energy: _int(it.cost, 0), crystal: 0, materials: {} };
    }
    if (a.type === 'mining') {
        const m = cfg.mining && cfg.mining[a.key];
        if (!m) return null;
        const prices = _list(m.prices);
        const lv = s.miningLevels[a.key] || 0;
        return lv < prices.length ? { energy: prices[lv], crystal: 0, materials: {} } : null;
    }
    return null;
}

/**
 * 尝试购买（不可变更新）。
 * reason：'invalid' | 'locked' | 'maxed' | 'energy' | 'crystal' | 'materials' | 'branch_set' | 'slot_closed'
 *        | 'slot_full' | 'slot_empty' | 'unique' | 'items_full'
 * @param {object} state - BuildState
 * @param {object} action
 * @param {object} cfg - CONFIG.gameplay.build
 * @param {Set<string>|string[]|null} reveal - getReveal 的结果；null 不检查解锁
 * @param {object} [stockLedger] - 运行时料账本（形状见 material_economy_utils.js 的 normalizeLedger，三色 pyro/cryo/beast）。
 *        价格里 `materials` 非空时**必传**；未传 ⇒ 一律 `reason: 'materials'` 拒绝（绝不放行成免费成交）。
 * @returns {{ ok:boolean, reason:(string|null), state:object, price:(object|null), ledger:(object|null) }}
 *   `ledger` = 扣料后的新账本（价格无料项时 = `normalizeLedger(stockLedger)`；`stockLedger` 未传时 = null）。
 *   **本函数绝不写 `ledger.spent` / `ledger.spentTotal`**（那是「本波造弹实扣」专用口径，整备屏直读），
 *   建造扣料只动三色余额。
 */
export function tryPurchase(state, action, cfg = {}, reveal = null, stockLedger = undefined) {
    const s = normalizeBuildState(state, cfg);
    const a = action || {};
    const hasStockLedger = stockLedger !== undefined && stockLedger !== null;
    const baseLedger = hasStockLedger ? normalizeLedger(stockLedger) : null;
    const fail = (reason, price = null) => ({ ok: false, reason, state: s, price, ledger: baseLedger });
    if (!a.type) return fail('invalid');
    if (!isActionRevealed(a, reveal)) return fail('locked');

    // 结构性前置条件（先于价格判断，给出更准确的拒绝原因）
    const total = s.facilities.length;
    if (a.type === 'branch') {
        if (s.cannonBranch) return fail('branch_set');
        const allowed = _list(cfg.cannon && cfg.cannon.branches);
        if (!allowed.includes(a.branch)) return fail('invalid');
    }
    if (a.type === 'slot' && s.facilitySlotsOpen >= total) return fail('maxed');
    if (a.type === 'build') {
        const slot = _int(a.slot, -1);
        if (slot < 0 || slot >= total) return fail('invalid');
        if (slot >= s.facilitySlotsOpen) return fail('slot_closed');
        if (s.facilities[slot]) return fail('slot_full');
        const f = (cfg.facilities || {})[a.facility];
        if (f && f.unique && s.facilities.some(x => x && x.type === a.facility)) return fail('unique');
    }
    if (a.type === 'upgrade') {
        const slot = _int(a.slot, -1);
        if (slot < 0 || slot >= total) return fail('invalid');
        if (!s.facilities[slot]) return fail('slot_empty');
        if (s.facilities[slot].level >= FACILITY_MAX_LEVEL) return fail('maxed');
    }
    if (a.type === 'item') {
        const slots = Math.max(0, _int(cfg.items && cfg.items.slots, 2));
        if (s.items.length >= slots) return fail('items_full');
    }

    const price = getPrice(s, a, cfg);
    if (!price) return fail(a.type === 'cannon' || a.type === 'mining' ? 'maxed' : 'invalid');
    if (s.energy < price.energy) return fail('energy', price);
    if (s.crystal < price.crystal) return fail('crystal', price);

    // 料价判在能量 / 水晶之后（先扣能付的、再判料），失败原因更准确。
    const materialCost = (price.materials && typeof price.materials === 'object') ? price.materials : {};
    const needsMaterials = PRICE_MATERIAL_KEYS.some(key => _int(materialCost[key], 0) > 0);
    let nextLedger = baseLedger;
    if (needsMaterials) {
        if (!hasStockLedger) {
            // 静默免费成交是本批要杜绝的第一号缺陷：没账本就不许成交。
            console.warn('[build_economy_utils] 建造料价必须传料账本（tryPurchase 第 5 参）');
            return fail('materials', price);
        }
        const charged = chargeBuildMaterials(baseLedger, materialCost);
        if (!charged.ok) return fail('materials', price);
        nextLedger = charged.ledger;
    }

    const next = normalizeBuildState(s, cfg);
    next.energy = s.energy - price.energy;
    next.crystal = s.crystal - price.crystal;
    switch (a.type) {
        case 'cannon': next.cannonLevels[a.track] += 1; break;
        case 'branch': next.cannonBranch = a.branch; break;
        case 'slot': next.facilitySlotsOpen += 1; break;
        // §5.2：新建设施冷却从「就绪」开始（cd = 0），建成后第一个敌人回合前就会触发。
        case 'build': next.facilities[_int(a.slot)] = { type: a.facility, level: 1, cd: 0 }; break;
        case 'upgrade': {
            const slot = _int(a.slot);
            next.facilities[slot] = { ...next.facilities[slot], level: next.facilities[slot].level + 1 };
            break;
        }
        case 'item': next.items = [...next.items, a.item]; break;
        case 'mining': next.miningLevels[a.key] = (next.miningLevels[a.key] || 0) + 1; break;
        default: return fail('invalid');
    }
    return { ok: true, reason: null, state: next, price, ledger: nextLedger };
}

/**
 * 主炮数值（§5.1）：射击次数 = 基础 + 射速级；单发 = 基础伤害 + (baseDamage-1) + 每级 × 伤害级；反弹 = 基础 + 弹道级。
 * @param {{dmg,rate,bounce}} levels
 * @param {{ baseShots?:number, baseDamage?:number, damageBonus?:number, baseBounce?:number, damagePerLv?:number }} base
 * @returns {{ shots:number, damage:number, bounce:number }}
 */
export function computeCannonStats(levels = {}, base = {}) {
    const lv = { dmg: Math.max(0, _int(levels.dmg, 0)), rate: Math.max(0, _int(levels.rate, 0)), bounce: Math.max(0, _int(levels.bounce, 0)) };
    const baseShots = Number.isFinite(Number(base.baseShots)) ? Number(base.baseShots) : 2;
    const baseDamage = Number.isFinite(Number(base.baseDamage)) ? Number(base.baseDamage) : 10;
    const damageBonus = Number(base.damageBonus) || 0;
    const baseBounce = Number.isFinite(Number(base.baseBounce)) ? Number(base.baseBounce) : 2;
    const perLv = Number.isFinite(Number(base.damagePerLv)) ? Number(base.damagePerLv) : 4;
    return {
        shots: Math.max(1, Math.floor(baseShots + lv.rate)),
        damage: Math.max(1, Math.floor(baseDamage + damageBonus + perLv * lv.dmg)),
        bounce: Math.max(0, Math.floor(baseBounce + lv.bounce)),
    };
}

/** 设施某等级的数值（等级 1–3）。 */
export function getFacilityStats(type, level, cfg = {}) {
    const f = (cfg.facilities || {})[type];
    if (!f) return null;
    const i = Math.max(0, Math.min(FACILITY_MAX_LEVEL, _int(level, 1)) - 1);
    const pick = v => (Array.isArray(v) ? v[Math.min(i, v.length - 1)] : v);
    return {
        type,
        level: i + 1,
        cooldown: f.cd === undefined ? null : Math.max(1, _int(f.cd, 1)),
        dmg: pick(f.dmg),
        targets: pick(f.targets),
        count: pick(f.count),
        cap: pick(f.cap),
        perDig: pick(f.perDig),
    };
}

/**
 * 设施冷却推进（每个敌人回合开始前调用一次，§5.2）。
 * 规则：cd ≤ 0 → 触发，并把 cd 设为冷却回合数；随后 cd − 1。新建设施 cd = 0（就绪）。
 *   冷却 1 = 每回合触发；冷却 2 = 第 1、3、5… 回合触发。
 *   按挖掘结算的设施（收集器，无 cd 配置）不参与。
 * @param {Array<null|{type,level,cd}>} facilities
 * @param {object} cfg - CONFIG.gameplay.build
 * @returns {{ facilities: Array, triggers: Array<{ slot:number, type:string, level:number, stats:object }> }}
 */
export function tickFacilities(facilities, cfg = {}) {
    const triggers = [];
    const next = _list(facilities).map((f, slot) => {
        if (!f || !f.type) return null;
        const stats = getFacilityStats(f.type, f.level, cfg);
        if (!stats || stats.cooldown === null) return { ...f };
        let cd = _int(f.cd, 0);
        if (cd <= 0) {
            triggers.push({ slot, type: f.type, level: stats.level, stats });
            cd = stats.cooldown;
        }
        cd -= 1;
        return { ...f, cd };
    });
    return { facilities: next, triggers };
}

/** 收集器每次挖掘支付的能量（全局最多 1 座）。 */
export function getCollectorPayout(facilities, cfg = {}) {
    let total = 0;
    for (const f of _list(facilities)) {
        if (!f || f.type !== 'collector') continue;
        const stats = getFacilityStats('collector', f.level, cfg);
        total += Math.max(0, _int(stats && stats.perDig, 0));
    }
    return total;
}

/**
 * 满匣处理（§5.3）：在整备阶段二选一——替换第 i 发，或丢弃新弹。
 * @param {object[]} mag - 当前弹匣（已满）
 * @param {object} shot - 新炼成弹
 * @param {{ replace:number } | 'discard'} choice
 * @returns {object[] | null} 新弹匣；choice 非法时返回 null
 */
export function resolveMagazineOverflow(mag, shot, choice) {
    const list = _list(mag).slice();
    if (choice === 'discard' || (choice && choice.discard)) return list;
    const i = choice && Number.isInteger(choice.replace) ? choice.replace : -1;
    if (i < 0 || i >= list.length || !shot) return null;
    list[i] = shot;
    return list;
}
