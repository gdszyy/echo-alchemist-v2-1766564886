/**
 * build_screen.js - [REQ-20261022-wave-loop S2 / R2] 整备界面（#phase-build）mixin。
 *
 * 一屏可见（§2 P3 / art §6.2）：⚡/💎 余额、主炮 3 轨（等级 / 价格 / 锁定）、设施位与冷却、道具位、
 * 挖矿升级（S2 只开「采集弹珠 +1」，其余显示锁定 S3）、下一波预告、「开战」。
 * 只用 src/ui/components/* 组件 + src/styles/ui_components.css；同一份 DOM，不在侧栏间搬 DOM。
 * 图标全部是占位字形块（.ui-glyph--placeholder），等正式 24×24 像素图标替换。
 */
import { CONFIG } from '../config.js';
import { getWaveInfo } from '../utils/boss_schedule_utils.js';
import { createBuildGrid, getFacilitySlotCapacity, getFacilityStats, getGridConfig, getPrice, isActionRevealed, FACILITY_IDS, ITEM_IDS } from '../utils/build_economy_utils.js';
import { FACILITY_LABELS, ITEM_LABELS, BRANCH_LABELS, uniqueFacilityText } from '../build_system.js';
import { computeRecipeYield, describeMaterialShortfall, formatMaterialShortfall, materialLabel, pickDefaultRecipe, pickRecipeByYield } from '../utils/shot_recipe_utils.js';
// 「改善路径」四轴验算：电力 / 产能两条轴一律转调既有纯函数（**不在这里另写一份耗电或产能算式**）。
import { computePowerShots } from '../utils/material_loadout_utils.js';
import { powerDrawFor } from '../utils/power_budget_utils.js';
import { WORKSHOP_DRAW_KEY } from '../utils/workshop_capacity_utils.js';
import { el, append } from './components/_dom.js';
import { createPanel } from './components/panel.js';
import { createButton } from './components/button.js';
import { createPriceTag } from './components/price_tag.js';
import { createUpgradeTrack } from './components/upgrade_track.js';
import { createSlotCard, createGlyphTile } from './components/slot_card.js';
import { createResourcePill } from './components/resource_pill.js';
import { createModal } from './components/modal.js';
import {
    createWaveAmmoPanel,
    describeBindingReason,
    describeWorkshopStatus,
    DRY_WAVE_TEXT,
    LIMIT_VIEWS,
    limitLabel,
    MATERIAL_VIEWS,
    PREVIEW_UNAVAILABLE_TEXT,
    toCount,
    toLimitDisplay,
} from './components/wave_ammo.js';

/** 占位字形（PLACEHOLDER：正式像素图标到位后替换）与元素色底。 */
export const BUILD_GLYPHS = {
    dmg: ['伤', 'fire'], rate: ['速', 'bolt'], bounce: ['弹', 'echo'],
    turret: ['炮', 'fire'], lightning: ['雷', 'bolt'], frost: ['冰', 'ice'], shieldGen: ['盾', 'ice'], collector: ['金', 'energy'],
    workshop: ['工', 'fire'], generator: ['电', 'bolt'], battery: ['储', 'energy'],
    bomb: ['爆', 'fire'], timestop: ['停', 'echo'], shield: ['护', 'ice'], extraDig: ['挖', 'energy'],
    mining: ['矿', 'energy'],
    pierce: ['穿', 'laser'], scatter: ['散', 'poison'], fire: ['火', 'fire'], ice: ['冰', 'ice'], branchLightning: ['雷', 'bolt'],
};

/**
 * 料价显示：料键 → 屏上字形（**只此一张表**，别处拼料价一律走 `materialPriceTag`，不许就地写字面量）。
 * 三色语义：pyro / cryo 是钉盘料（造弹 / 升容量 / 铸符），beast 是怪物料（只用于建设）。
 */
const MATERIAL_PRICE_GLYPHS = { pyro: '🔥', cryo: '❄', beast: '🦴' };
/** 料价逐项显示顺序（与价格对象的键序无关，屏上顺序恒为火 / 冰 / 骨）。 */
const PRICE_MATERIAL_ORDER = ['pyro', 'cryo', 'beast'];

const FACILITY_DESC = {
    turret: lv => `每回合打最前 1 个敌人 ${lv.dmg}`,
    lightning: lv => `连锁 ${lv.targets} 个敌人，各 ${lv.dmg}`,
    frost: lv => `冻结前排血最高的 ${lv.count} 个`,
    shieldGen: lv => `+1 护盾（上限 ${lv.cap}）`,
    collector: lv => `每次挖掘 +${lv.perDig}⚡（全局 1 座）`,
    // 三件料付后勤设施：数值一律从配置读（工坊产能 / 手工造弹倍率 / 每波发电 / 单座容量增量）。
    workshop: lv => {
        const w = cfg().workshop || {};
        const cap = Array.isArray(w.capacityByLevel) ? w.capacityByLevel[Math.max(0, (lv.level || 1) - 1)] : null;
        const mult = Number(w.manualMaterialMultiplier);
        const capText = cap ? `每波最多造 ${cap} 发` : '提高每波造弹上限';
        return Number.isFinite(mult) && mult > 1
            ? `${capText}；没有工坊只能手工造弹，料耗 ×${mult}`
            : capText;
    },
    generator: lv => {
        const gen = ((cfg().power || {}).generate || {}).generator;
        const out = Array.isArray(gen) ? gen[Math.max(0, (lv.level || 1) - 1)] : null;
        return out ? `每波发电 ${out}⚡（不耗电）` : '每波发电（不耗电）';
    },
    battery: lv => {
        const b = (cfg().power || {}).battery || {};
        const add = Array.isArray(b.capacity) ? b.capacity[Math.max(0, (lv.level || 1) - 1)] : null;
        const base = Number(b.baseCapacity);
        if (add && Number.isFinite(base)) return `可用电力上限 +${add}（底 ${base}，不耗电）`;
        return add ? `可用电力上限 +${add}（不耗电）` : '抬高本波可用电力上限（不耗电）';
    },
};
const ITEM_DESC = {
    bomb: c => `最前敌人附近 ${c.radius}px 内各 ${c.dmg} 伤害`,
    timestop: () => '本回合敌人不下压、不补行',
    shield: c => `护盾 +${c.amount}`,
    extraDig: c => `下次挖掘采集弹珠 +${c.collectors}`,
};

function cfg() {
    return (CONFIG.gameplay && CONFIG.gameplay.build) || {};
}

/** 某个解锁键在第几波 / Boss 后解锁，用于锁定文案。 */
function unlockLabel(key) {
    const table = cfg().reveal || {};
    for (const [k, list] of Object.entries(table)) {
        if (!Array.isArray(list) || !list.includes(key)) continue;
        const m = /^boss(\d+)$/.exec(k);
        return m ? `Boss${m[1] === '1' ? '' : ` ×${m[1]}`}后` : `第${k}波`;
    }
    return '未开放';
}

function glyph(key) {
    const g = BUILD_GLYPHS[key] || ['?', ''];
    return { glyph: g[0], element: g[1] };
}

/** 料价逐项：只列正数料键，按火 / 冰 / 骨固定顺序（与价格对象键序无关）。 */
function materialPriceParts(materials) {
    const src = (materials && typeof materials === 'object') ? materials : {};
    return PRICE_MATERIAL_ORDER
        .map(key => ({ key, need: toCount(src[key]) }))
        .filter(x => x.need > 0);
}

/**
 * 料余额是否付得起这笔料价。
 * **拿不到账本（stock 为 null）⇒ 按不足处理**：整备屏宁可显示「买不起」，也不许假装买得起后点了没反应。
 */
function hasMaterialsFor(materials, stock) {
    return materialPriceParts(materials).every(x => toCount(stock && stock[x.key]) >= x.need);
}

/**
 * 料价标签：沿用既有 `.ui-price` / `.ui-price__part` 形态（缺料项加 `is-short`，整体缺料加 `is-unaffordable`）。
 * 无料价 ⇒ 返回 null（调用方直接放进 children，`append` 会跳过 null）。
 */
function materialPriceTag(materials, stock) {
    const parts = materialPriceParts(materials);
    if (!parts.length) return null;
    const tag = el('span', 'ui-price ui-price--materials');
    let short = false;
    parts.forEach(x => {
        const lack = toCount(stock && stock[x.key]) < x.need;
        if (lack) short = true;
        append(tag, el('span', `ui-price__part ui-price__part--${x.key}${lack ? ' is-short' : ''}`, {
            text: `${MATERIAL_PRICE_GLYPHS[x.key] || x.key}${x.need}`,
        }));
    });
    if (short) tag.classList.add('is-unaffordable');
    return tag;
}

/** 造弹只从钉盘料扣（`material_economy_utils.js` 口径）：成本串与缺料判定都只看这两桶。 */
const AMMO_MATERIAL_KEYS = ['pyro', 'cryo'];

/**
 * 运行时读数容错：方法缺失 / 抛错 / 返回非对象 ⇒ 一律 `null`。
 * 预演（第 6 步 `sys_getWavePreview`）与料读数（第 5 步 `sys_getMaterialReadout`）都可能此刻尚未落地，
 * 这一步的任何缺失都只让对应块降级，**不许 throw 到外层中断整备屏**。
 */
function safeRuntimeObject(game, method) {
    try {
        const fn = game && game[method];
        if (typeof fn !== 'function') return null;
        const value = fn.call(game);
        if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
        return value;
    } catch (err) {
        return null;
    }
}

/**
 * 单发成本串，只列正数料键（口径同 `src/utils/shot_recipe_utils.js:250` `describeRecipeCost`）：
 * 配方的 `cost` 里没写的料 = 0 需求，因此不显示，屏上不出现 `cryo 0` 这种噪声。
 */
function recipeCostText(cost) {
    const src = (cost && typeof cost === 'object') ? cost : {};
    const order = [...AMMO_MATERIAL_KEYS, ...Object.keys(src).filter(k => !AMMO_MATERIAL_KEYS.includes(k))];
    const parts = [];
    order.forEach(key => {
        const n = toCount(src[key]);
        // 屏上一律中文料名（`火料 3`），不许把 `pyro` 这种键名打到玩家面前——与缺料提示同一张表。
        if (n > 0) parts.push(`${materialLabel(key)} ${n}`);
    });
    return parts.length ? parts.join(' + ') : '无';
}

/** 已因「缺出口」warn 过的配方 id：整备屏每次重绘都会重新取成本，同一 id 只 warn 一次，不刷屏。 */
const SHOT_COST_WARNED = new Set();

/**
 * 一条配方的**实扣**每发逐料成本（成本只有一个来源：运行时的 `sys_getShotCostForRecipe`）。
 * 该出口内部转调 `phase_shotCostByMaterial`，未建工坊时含手工溢价 ⇒ 屏上的成本串 / 够打几发 / 缺料
 * 与开战时的实扣同源，不会出现「屏上按原价报价、账上按溢价扣钱」。
 * 出口缺失 / 抛错 / 返回空 ⇒ **降级为配方原价**（屏上有数可看）并对该 id warn 一次。
 * @param {object} game - mixin 宿主
 * @param {object} recipe - `CONFIG.gameplay.build.recipes[]` 的一条
 * @returns {Object<string, number>} 逐料每发成本（只含正数料键）
 */
function shotCostOf(game, recipe) {
    if (!recipe || typeof recipe !== 'object') return {};
    const fallback = (recipe.cost && typeof recipe.cost === 'object') ? recipe.cost : {};
    const id = typeof recipe.id === 'string' ? recipe.id : '';
    if (!id) return fallback;
    let got = null;
    try {
        if (game && typeof game.sys_getShotCostForRecipe === 'function') got = game.sys_getShotCostForRecipe(id);
    } catch (err) {
        got = null;
    }
    const per = (got && got.perShotCost && typeof got.perShotCost === 'object') ? got.perShotCost : null;
    if (per) return per;
    if (!SHOT_COST_WARNED.has(id)) {
        SHOT_COST_WARNED.add(id);
        console.warn(`[build_screen] 缺 sys_getShotCostForRecipe（或返回空）⇒ 配方 ${id} 的成本按配方原价显示：`
            + '未建工坊时实扣是原价 × 手工倍率，屏上会偏低');
    }
    return fallback;
}

/**
 * 当前生效的弹药配方 id：
 *   ① 玩家手选过、且仍在已解锁表里 ⇒ 用它（**优先级不动**：手选不许被自动逻辑覆盖）；
 *   ② 否则取**按现有料能打出几发最多**的那条（`pickRecipeByYield`，并列按 id 字典序）；
 *      与运行时 `phase_waveRecipe` **同一条函数、同一份实扣价**（`costOf(recipe)`，不是配方原价）——
 *      两处各写一套就会出现「屏上说能打 2 发、账上按别的配方扣」；
 *   ③ 一条都没有（配方表空 / 全部需设计图）⇒ null，面板那行显示锁定态而不假装选了一条。
 * 料况读数缺失（`stock` 为 null）时 `pickRecipeByYield` 按契约退回「成本最低」的旧口径，
 *   屏上仍有选中态；这是降级路径，不是挑法。
 */
function resolveSelectedRecipeId(game, recipes, costOf, stock) {
    const unlocked = recipes.filter(r => r && r.id && !r.blueprintRequired);
    const chosen = (game && typeof game._selectedRecipeId === 'string') ? game._selectedRecipeId : null;
    if (chosen && unlocked.some(r => r.id === chosen)) return chosen;
    const toCost = typeof costOf === 'function' ? costOf : (r => (r && r.cost) || {});
    const ids = unlocked.map(r => r.id);
    if (!ids.length) return null;
    try {
        return pickRecipeByYield(CONFIG, ids, stock, toCost).id;
    } catch (err) {
        // 只有「配方表读不出来」才会走到这里（`recipes` 与 CONFIG 同源，理论上不该发生）：
        // 退回成本最低口径让屏上仍有选中态，不让整备屏炸掉。
        try {
            return pickDefaultRecipe(CONFIG, ids).id;
        } catch (err2) {
            return null;
        }
    }
}

/**
 * `M`（料）是瓶颈时缺哪几桶：返回**差额明细**（`{key,label,need,have,lack}`，只含真缺的桶）。
 * 差额 = 需要 − 现有，中文名与文案由 `shot_recipe_utils` 统一给（屏上不许出现 `pyro` 这类键名）。
 * @param {Object<string, number>} cost - **已换算好的**每发逐料成本（来源由调用点决定，本函数不读配方）
 */
function shortfallMaterials(cost, readout, shots) {
    const per = (cost && typeof cost === 'object') ? cost : {};
    const n = toCount(shots);
    const need = {};
    AMMO_MATERIAL_KEYS.forEach(key => {
        const v = toCount(per[key]);
        if (v > 0) need[key] = v * n;
    });
    return describeMaterialShortfall(need, readout);
}

/**
 * 缺料提示的统一写法：`料不足：缺 火料 3、冰料 1`。
 * 只在真缺料时给差额；`materials` 为空（纯能量价）或读数缺失时回落「料不足」三字，
 * **绝不**回落到半句话（这也是 `hasMaterialsFor` 判否时的唯一文案来源）。
 */
function shortfallTitle(materials, stock) {
    const text = formatMaterialShortfall(materials, stock);
    return text ? `料不足：${text}` : '料不足';
}

/**
 * 这条配方「以现有料够打几发」＝ 逐料取最小（与 `planLoadout` 的发弹上限口径一致）。
 * §C-3 的「够哪一档」逐档落在配方行上：某档够 0 发，就是这一档现在打不出来。
 * @param {Object<string, number>} cost - **已换算好的**每发逐料成本（来源由调用点决定，本函数不读配方）
 */
function affordableShots(cost, readout) {
    const per = (cost && typeof cost === 'object') ? cost : {};
    let shots = Infinity;
    AMMO_MATERIAL_KEYS.forEach(key => {
        const need = toCount(per[key]);
        if (need <= 0) return;
        shots = Math.min(shots, Math.floor(toCount(readout && readout[key]) / need));
    });
    return Number.isFinite(shots) ? Math.max(0, shots) : 0;
}

/** 设施键名 → 中文名（腾电提示用；配置里没有的键原样显示）。 */
function facilityName(key) {
    return FACILITY_LABELS[key] || String(key || '');
}

/**
 * 一条上限读数 → 「参与取最小」的数：`null` / `undefined` / `NaN` / 非有限 ⇒ `Infinity`（该轴不参与取最小）。
 * 语义照 `game_phase.js:1877-1912`：未建工坊时 `U` / `E` 是 `Infinity`（不构成闸门），**不是 0**。
 * 注意 `0` 是真实上限（断电 / 产能 0），必须原样参与取最小。
 * @param {*} value - 预演 `detail[axis]`
 * @returns {number} 非负整数，或不参与取最小的 `Infinity`
 */
function limitNum(value) {
    if (value === null || value === undefined) return Number.POSITIVE_INFINITY;
    const n = Math.floor(Number(value));
    return Number.isFinite(n) ? Math.max(0, n) : Number.POSITIVE_INFINITY;
}

/** 四轴取最小：`N = min(A, U, E, M)`（与 `pickBindingLimit` 同一口径；不参与的轴按 Infinity 处理）。 */
function minOfLimits(a, u, e, m) {
    return Math.min(limitNum(a), limitNum(u), limitNum(e), limitNum(m));
}

/**
 * 本波「战斗设施扣完之后」的可用电力（`phase_wavePreviewCore().restAfterCombat`）。
 * **建工坊不影响这个数**（工坊不进 `combatSlots`，见 `game_phase.js:1792-1815`），所以它同时是
 * 「建完工坊后」那一侧的电力基数。取不到（方法缺失 / 抛错 / 非有限）⇒ `null`，**不猜**。
 * @param {object} game - 同一实例（`game_phase` 与 `build_screen_system` 都绑在它上面）
 * @returns {number|null}
 */
function restPowerAfterCombat(game) {
    if (!game || typeof game.phase_wavePreviewCore !== 'function') return null;
    try {
        const core = game.phase_wavePreviewCore();
        const rest = Number(core && core.restAfterCombat);
        return Number.isFinite(rest) ? rest : null;
    } catch (err) {
        return null;   // 预演核心自己会抛配置错；屏上宁可不说，也不许拿猜的数承诺
    }
}

/**
 * 「建弹药工坊之后」的四条上限——**四轴全算**，不许只看料那一轴（2026-10-25 返工）。
 * 建工坊会同时改三件事，只算料那一侧就会发出假承诺（`docs/review/build-hint-20261025.md` §7）：
 *   - `U`：从「不参与取最小」变成 **Lv1 容量**（`build.workshop.capacityByLevel[0]`，`src/config.js:1086`）；
 *   - `E`：从「不参与」变成有限——`floor((restAfterCombat − 工坊 Lv1 耗电) / powerPerShot)`，
 *     两个数都从配置取（`power.draw.workshop` / `power.powerPerShot`），**不写死 4 / 2**；
 *     与 `phase_wavePreviewCore` 同一算式，且断电（`rest < draw`）时按 0 计（`isWorkshopPowered` 等号算通电）；
 *   - `M`：料耗从「手工溢价」恢复配方原价 ⇒ 用 `现有料 − 工坊料价` 与 `recipe.cost` 重算 `computeRecipeYield`；
 *   - `A`：射速轨不动，原样。
 * 任何一项读不到（料况 / 配方 / 电力基数 / 配置缺键）⇒ `null`，调用方一个字都不加。
 * @param {{ restPower:(number|null), readout:(object|null), recipe:(object|null), detail:(object|null), state:(object|null) }} p
 * @returns {{ A:number, U:(number|null), E:number, M:number, affordable:boolean, materials:Array<{key:string,need:number}> }|null}
 */
function workshopAfterLimits({ restPower, readout, recipe, detail, state }) {
    if (!state || !recipe || !readout) return null;
    const a = Number(detail && detail.A);
    if (!Number.isFinite(a)) return null;
    if (restPower === null || restPower === undefined) return null;
    const build = cfg();
    const power = build.power || {};
    const perShot = Number(power.powerPerShot);
    if (!Number.isFinite(perShot) || perShot <= 0) return null;      // 配置缺键 ⇒ 不猜
    const price = getPrice(state, { type: 'build', facility: 'workshop' }, build);
    if (!price) return null;
    const materials = materialPriceParts(price.materials);
    // 建后料 = 现有料 − 工坊料价（付不起时差额为负 ⇒ 逐料 yield 落 0，`affordable` 会先拦住）
    const after = { ...readout };
    materials.forEach(x => { after[x.key] = toCount(readout[x.key]) - x.need; });
    const mAfter = computeRecipeYield(recipe.cost, after);
    const draw = powerDrawFor(WORKSHOP_DRAW_KEY, 1, build);          // 建后即 Lv1
    const powered = Number(restPower) >= draw;                       // 等号口径与 `isWorkshopPowered` 一致
    const eAfter = powered ? computePowerShots(Number(restPower) - draw, perShot) : 0;
    const capTable = Array.isArray((build.workshop || {}).capacityByLevel) ? build.workshop.capacityByLevel : null;
    // 产能表缺键 ⇒ `U` 不参与取最小（与预演同向，那里已 warn）；断电 ⇒ `U = 0`
    const uAfter = powered ? (capTable ? toCount(capTable[0]) : null) : 0;
    return {
        A: Math.max(0, Math.floor(a)),
        U: uAfter,
        E: eAfter,
        M: mAfter,
        affordable: hasMaterialsFor(price.materials, readout),
        materials: materials.map(x => ({ key: x.key, need: x.need })),
    };
}

/**
 * 「建弹药工坊能多打几发」：**只在四轴取最小之后真能改善时**返回发数，否则 `null`（屏上什么都不加）。
 * 四条全部成立才给——任一条不成立就返回 null，**不许**在「建了也一样」或「建不起」时提示（那是在骗玩家花料）：
 *   ① 当前**没有**工坊（`describeWorkshopStatus().kind === 'unbuilt'`；断电不算未建造，它不会恢复原价）；
 *   ② 付得起工坊料价（料价从 `getPrice({type:'build', facility:'workshop'})` 取，**不写字面量 4/2**）；
 *   ③ 四轴全算（见 `workshopAfterLimits`）；
 *   ④ `min(A_后, U_后, E_后, M_后)` **严格大于**当前发数——只看 `M_后` 会漏掉 `A` / `U` / `E` 卡住的情形。
 *
 * ④ 为什么必须取 min：2026-10-25 的返工缺陷就是只比了 `M_后`。实测自然态 `A=2 / M=2`，
 *   建工坊后 `M` 抬到 4、`U=3`、`E=5`，可 `A` 仍卡 2 ⇒ 一发都不多，而旧屏上写着「建了能多打」。
 * @param {{ restPower:(number|null), workshop:(object|null), readout:(object|null), recipe:(object|null),
 *           shots:number, state:(object|null), detail:(object|null) }} p
 * @returns {number|null} 建后发数（> 当前发数），或 null
 */
function workshopGainShots({ restPower, workshop, readout, recipe, shots, state, detail }) {
    if (!state || !workshop || workshop.kind !== 'unbuilt') return null;   // ①
    const after = workshopAfterLimits({ restPower, readout, recipe, detail, state });
    if (!after || !after.affordable) return null;                          // ② 拿不到价 / 买不起
    const n = minOfLimits(after.A, after.U, after.E, after.M);             // ③ 四轴
    return n > toCount(shots) ? n : null;                                  // ④
}

/**
 * 「升一级射速轨能多打几发」：**只在四轴取最小之后真能改善时**返回升后发数与这一档价，否则 `null`。
 * 四条全部成立才给（任一条不成立就返回 null）：
 *   ① 射速轨没满级——`getPrice({type:'cannon', track:'rate'})` 有下一档（满级时它返回 null）；
 *   ② ⚡ 够付下一档——读**屏上那颗 ⚡**（`sys_getBuildState().energy`，即本波可用电力），
 *      不用历史结余、也不在面板里另算一份电力；
 *   ③ 升后 `A = A + 1`，再与**当前** `U` / `E` / `M` 取最小；
 *   ④ 那个 min **严格大于**当前发数。
 * ③ 为什么必须取 min：自然态 `A=2 / M=2`，升一级 `A=3` 而 `M` 仍 2 ⇒ 一发都不多，
 *   旧判据只看 `A+1 > shots` 就写出「升一级（60 电）后打 3 发」——玩家花 60⚡ 一发不多，属假承诺。
 * @param {{ state:(object|null), detail:(object|null), shots:number }} p
 * @returns {{ shots:number, price:number }|null}
 */
function rateUpgradeGain({ state, detail, shots }) {
    if (!state) return null;
    const a = Math.floor(Number(detail && detail.A));
    if (!Number.isFinite(a)) return null;                                    // A 读不到 ⇒ 不猜
    const price = getPrice(state, { type: 'cannon', track: 'rate' }, cfg());
    if (!price) return null;                                                 // ① 满级 / 不可买
    if (toCount(state.energy) < toCount(price.energy)) return null;           // ② 付不起
    const after = minOfLimits(Math.max(0, a) + 1, detail && detail.U, detail && detail.E, detail && detail.M);   // ③
    return after > toCount(shots) ? { shots: after, price: toCount(price.energy) } : null;                       // ④
}

/**
 * 「两件都做才多打」的组合增益：**单做任一件都不变、两件都做才变多**时给出（自然态正是这种）。
 * 调用方必须先确认两个单步都没给出（`rateGain` / `workshopGain` 都是 null），本函数只负责算组合那一侧：
 *   ① 未建造工坊（否则「建工坊」这件事不成立）；
 *   ② **两件都付得起**——料够建工坊 **且** ⚡ 够升一级；任一件付不起 ⇒ `null`（退回只说现状，一个字不加）；
 *   ③ `min(A+1, U_后, E_后, M_后)` **严格大于**当前发数。
 * 返回的 `materials` 是建工坊的料价（逐项 `{key,need}`），屏上翻成中文料名——本函数不出任何文案。
 * @param {{ restPower:(number|null), state:(object|null), detail:(object|null), readout:(object|null),
 *           recipe:(object|null), shots:number, workshop:(object|null) }} p
 * @returns {{ shots:number, price:number, materials:Array<{key:string,need:number}> }|null}
 */
function comboGain({ restPower, state, detail, readout, recipe, shots, workshop }) {
    if (!state || !workshop || workshop.kind !== 'unbuilt') return null;     // ①
    const a = Math.floor(Number(detail && detail.A));
    if (!Number.isFinite(a)) return null;
    const price = getPrice(state, { type: 'cannon', track: 'rate' }, cfg());
    if (!price) return null;                                                 // 射速轨满级 ⇒ 没有「两件」
    const energyCost = toCount(price.energy);
    if (!energyCost || toCount(state.energy) < energyCost) return null;       // ② ⚡ 付不起
    const after = workshopAfterLimits({ restPower, readout, recipe, detail, state });
    if (!after || !after.affordable) return null;                            // ② 料付不起建工坊
    const n = minOfLimits(Math.max(0, after.A) + 1, after.U, after.E, after.M);   // ③ 四轴（A 已 +1）
    if (n <= toCount(shots)) return null;
    return { shots: n, price: energyCost, materials: after.materials };
}

export const build_screen_system = {
    /**
     * @method ui_renderBuildScreen
     * @description 重绘整备界面（每次购买 / 满匣处理后调用）。保留滚动位置。
     */
    ui_renderBuildScreen() {
        if (typeof document === 'undefined') return;
        const root = document.getElementById('build-screen-root');
        if (!root) return;
        const scroller = root.querySelector('.build-scroll');
        const scrollTop = scroller ? scroller.scrollTop : 0;
        root.innerHTML = '';

        const state = this.sys_getBuildState();
        const reveal = this.sys_getBuildReveal();
        const have = { energy: Math.floor(state.energy), crystal: state.crystal };
        // 料余额读数出口（只读一次、全场共用）。取不到 ⇒ null，料价一律按「不足」处理并给提示。
        const stock = safeRuntimeObject(this, 'sys_getMaterialReadout');
        const buy = action => () => this.sys_buildPurchase(action);
        const priceOf = action => getPrice(state, action, cfg());
        const revealed = action => isActionRevealed(action, reveal);

        // ---------- 头部：标题 + 余额 + 下一波预告 ----------
        const head = el('header', 'build-head');
        const info = getWaveInfo(this, CONFIG.balance?.waveCycle?.normalWavesPerBoss);
        append(head, el('h2', 'build-head__title', { text: `整备 · 第 ${this.digCount || 1} 波` }));
        const pills = el('div', 'build-head__pills');
        append(pills, createResourcePill({ kind: 'energy', value: state.energy, id: 'build-energy' }),
            createResourcePill({ kind: 'crystal', value: state.crystal, id: 'build-crystal' }));
        head.appendChild(pills);
        const foes = (this.enemies || []).filter(e => e && e.active && !e.isDead && e.hp > 0);
        const hasBoss = info.isBossWave || foes.some(e => e.type === 'boss') || !!this._pendingBossSpawn;
        const elites = foes.filter(e => e.type !== 'boss' && Array.isArray(e.affixes) && e.affixes.length >= 2).length;
        append(head, el('div', `build-head__wave${hasBoss ? ' is-boss' : ''}`, {
            id: 'build-wave-preview',
            text: hasBoss ? `下一波：Boss · 敌 ${foes.length}` : `下一波：敌 ${foes.length}${elites ? ` · 精英 ${elites}` : ''}${info.wavesUntilBoss === 1 ? ' · 再下一波 Boss' : ''}`,
        }));
        // 回合口径（2026-10-25 定，`docs/review/gameplay-20261025.md` §6-③）：**一波 = 一个回合**，
        // 目标是「撑住 / 不被击破」，不是「把棋盘清空」。旧口径「消灭所有敌人后进入下一回合」只留在
        // `tutorial_system.js:166`（本轮不在本执行方写权限内），此处按新口径给玩家一句目标。
        append(head, el('p', 'build-locked-note', {
            id: 'build-goal-note',
            text: '目标：撑住本回合 —— 敌人越过击破线才算输，没清完不算输',
        }));
        root.appendChild(head);

        const scroll = el('div', 'build-scroll');
        root.appendChild(scroll);

        // ---------- 本波弹药（现有料 / 预演发数 / 弹药配方 / 本波将扣料） ----------
        // 这四块解释「这一波为什么只打得出 N 发」，而设施 / 工厂网格正是改变这四条上限的杠杆之一。
        // [首屏顺序 2026-10-26] 本块**先构建、后落位**：真落位在网格面板之后的统一 append 处，
        //   因为教程第 9 步要求「建造一座设施」，而改造前本块占满首屏、建造面落在折叠线以下。
        // 任何异常都只让这一块降级为占位，整备屏其余面板照常渲染。
        let ammoPanel = null;
        try {
            ammoPanel = this.ui_buildWaveAmmoPanel();
        } catch (err) {
            ammoPanel = null;
        }
        let ammoBlock;
        if (ammoPanel) {
            ammoBlock = ammoPanel;
        } else {
            ammoBlock = createPanel({
                title: '本波弹药', hint: '料 → 弹 · 每发扣料', id: 'build-ammo',
                children: [el('p', 'build-locked-note', { text: PREVIEW_UNAVAILABLE_TEXT })],
            });
        }

        // ---------- 主炮 ----------
        const stats = this.sys_getCannonStats();
        const cc = cfg().cannon || {};
        const tracks = [
            { track: 'dmg', label: '伤害', value: `单发 ${stats.damage}`, max: (cc.damagePrices || []).length },
            { track: 'rate', label: '射速', value: `${stats.shots} 发/回合`, max: (cc.ratePrices || []).length },
            { track: 'bounce', label: '弹道', value: `反弹 ${stats.bounce}`, max: (cc.bouncePrices || []).length },
        ].map(t => {
            const action = { type: 'cannon', track: t.track };
            const locked = !revealed(action);
            return createUpgradeTrack({
                ...glyph(t.track), icon: glyph(t.track).glyph,
                label: t.label, value: t.value, level: state.cannonLevels[t.track], max: t.max,
                price: priceOf(action), have, locked, lockedText: unlockLabel(t.track),
                onBuy: buy(action), id: `build-cannon-${t.track}`,
            });
        });
        const branchRow = el('div', 'build-branch');
        if (state.cannonBranch) {
            append(branchRow, el('span', 'build-branch__chosen', { text: `分支：${BRANCH_LABELS[state.cannonBranch] || state.cannonBranch}` }));
        } else if (!revealed({ type: 'branch' })) {
            append(branchRow, el('span', 'build-branch__locked', { text: `分支：${unlockLabel('branch')}解锁（1💎 三选一，选定不可换）` }));
        } else {
            append(branchRow, el('span', 'build-branch__label', { text: '分支（1💎，选定不可换）' }));
            const opts = el('div', 'build-branch__opts');
            (cc.branches || []).forEach(b => {
                const action = { type: 'branch', branch: b };
                const p = priceOf(action);
                const g = glyph(b === 'lightning' ? 'branchLightning' : b);
                append(opts, createButton({
                    variant: 'default', className: 'build-branch__btn',
                    disabled: !p || state.crystal < p.crystal,
                    title: `主炮分支：${BRANCH_LABELS[b]}`,
                    children: [createGlyphTile({ ...g, size: 'hud' }), el('span', 'ui-btn__label', { text: BRANCH_LABELS[b] })],
                    onClick: buy(action), dataset: { buy: `branch-${b}` },
                }));
            });
            branchRow.appendChild(opts);
        }
        // [首屏顺序 2026-10-26] 先构建、后落位（落位在网格面板之后的统一 append 处）。
        const cannonBlock = createPanel({ title: '主炮', hint: '无限弹药 · 限射速', children: [...tracks, branchRow], id: 'build-cannon' });

        // ---------- 设施 ----------
        // 面板按「**有没有已解锁的设施**」决定渲染，不按 `'slots'`：
        //   ① 已开格（`i < facilitySlotsOpen`）**总是渲染**——空位给「建造」按钮（弹层 `ui_openFacilityPicker`
        //      自己按设施逐个判锁定，`:677` 起）；一格都不给的话，第 1 波列进 `reveal[1]` 的工坊 / 发电机
        //      连名字都上不了屏（`config.js:1174` 的意图是「第 1 波就能看见料付设施」）。
        //   ② `'slots'` 只管「开位 / 升级」这类**格位级**动作（口径见 `build_economy_utils.js` 的 `_revealKeysFor`），
        //      所以 `!slotsRevealed` 只是**不渲染未开格上的「开位」按钮**，不再把整块面板吃掉。
        //   ③ 只有当一座设施都没解锁时，才退回今天那行整块提示（此时渲染设施位没有意义）。
        const facPanelChildren = [];
        const slotsRevealed = revealed({ type: 'slot' });
        const anyFacilityRevealed = FACILITY_IDS.some(type => revealed({ type: 'build', facility: type }));
        if (!anyFacilityRevealed) {
            facPanelChildren.push(el('p', 'build-locked-note', { text: `设施位：${unlockLabel('slots')}解锁` }));
        } else {
            const grid = el('div', 'build-slots');
            const pulse = (this._facilityPulse && Array.isArray(this._facilityPulse.slots)) ? this._facilityPulse.slots : [];
            state.facilities.forEach((f, i) => {
                if (i >= state.facilitySlotsOpen) {
                    const action = { type: 'slot' };
                    const p = priceOf(action);
                    // 「开位」走 `{type:'slot'}`，它仍要求 `'slots'` ⇒ 未解锁时不给按钮（与权限层同一判据）。
                    const canOpen = slotsRevealed && i === state.facilitySlotsOpen && !!p;
                    grid.appendChild(createSlotCard({
                        state: 'locked', glyph: '锁', title: `设施位 ${i + 1}`, slotIndex: i,
                        actions: canOpen ? [createButton({
                            variant: state.crystal >= p.crystal ? 'default' : 'ghost', className: 'build-slot__btn',
                            disabled: state.crystal < p.crystal, title: '开放设施位',
                            children: [el('span', 'ui-btn__label', { text: '开位' }), createPriceTag({ crystal: p.crystal, haveCrystal: state.crystal })],
                            onClick: buy(action), dataset: { buy: `slot-${i}` },
                        })] : [],
                    }));
                    return;
                }
                if (!f) {
                    grid.appendChild(createSlotCard({
                        state: 'empty', glyph: '+', title: '空位', slotIndex: i,
                        actions: [createButton({
                            label: '建造', variant: 'default', className: 'build-slot__btn',
                            onClick: () => this.ui_openFacilityPicker(i), dataset: { buy: `build-${i}` },
                        })],
                    }));
                    return;
                }
                const lv = getFacilityStats(f.type, f.level, cfg());
                const up = { type: 'upgrade', slot: i };
                // 升级走 `{type:'upgrade'}`，权限层仍要求 `'slots'`（见 `build_economy_utils.js` 的 `_revealKeysFor`）
                // ⇒ 这里必须与设施选择弹层同一口径判定（那里是 `!locked && …`），否则会出现
                // 「按钮能点、点下去被 tryPurchase 以 locked 拒掉」的假交互。
                const upRevealed = revealed(up);
                const p = priceOf(up);
                // 料价与能量 / 水晶价并列判定：缺任一项就不呈可买（按钮置灰 + title 写明「料不足」）。
                const matOk = hasMaterialsFor(p && p.materials, stock);
                const affordable = upRevealed && !!p && have.energy >= p.energy && have.crystal >= p.crystal && matOk;
                grid.appendChild(createSlotCard({
                    state: 'built', ...glyph(f.type), title: FACILITY_LABELS[f.type] || f.type, level: f.level,
                    cooldown: lv.cooldown ? Math.max(0, f.cd) : null, cooldownMax: lv.cooldown, slotIndex: i,
                    pulse: pulse.includes(i),
                    footer: el('span', 'ui-slot__desc', { text: FACILITY_DESC[f.type] ? FACILITY_DESC[f.type](lv) : '' }),
                    actions: [createButton({
                        variant: affordable ? 'default' : 'ghost',
                        className: 'build-slot__btn',
                        disabled: !affordable,
                        title: !upRevealed ? `${unlockLabel('slots')}解锁` : (!p ? '已满级' : (matOk ? `升到 Lv${f.level + 1}` : shortfallTitle(p.materials, stock))),
                        children: p ? [
                            el('span', 'ui-btn__label', { text: '升级' }),
                            // 能量 / 水晶为 0 时不出「免费」：料付设施（工坊 / 发电机 / 电池）的能量价就是 0，
                            // 让「免费」与料价同框会出现「免费但要料」的矛盾读数。
                            (p.energy > 0 || p.crystal > 0)
                                ? createPriceTag({ energy: p.energy, crystal: p.crystal, haveEnergy: have.energy, haveCrystal: have.crystal })
                                : null,
                            materialPriceTag(p.materials, stock),
                        ] : [createPriceTag({ text: '已满' })],
                        onClick: buy(up), dataset: { buy: `upgrade-${i}` },
                    })],
                }));
            });
            facPanelChildren.push(grid);
        }
        // [首屏顺序 2026-10-26] 先构建、后落位（落位在网格面板之后的统一 append 处）。
        const facilityBlock = createPanel({ title: '设施', hint: '敌人回合前按冷却自动触发', children: facPanelChildren, id: 'build-facilities' });

        // ---------- 工厂网格（[批次 2] 只读盘面 ＋ [批次 3] 扩建一行） ----------
        // 每一格只看「谁在哪一格」：`buildGrid.cells[i].slot` → `state.facilities[slot]`。
        // 设备本体只存在 `facilities`，网格不存第二份（形状见 `build_economy_utils.js` 的 createBuildGrid 注释）。
        // 每格一个 button（热区 ≥ `--tap-min`），类型 / 等级一律用文字给出，不靠颜色单独承载信息。
        const gridCfg = getGridConfig(cfg());
        // `sys_getBuildState()` 正常都会带 buildGrid（归一化里补的）；这里的兜底只防「喂进来的状态缺键」
        // 这类降级输入（例如注入式夹具），按 config 建一张空盘继续渲染，不因为一块网格把整屏打掉。
        const buildGrid = state.buildGrid || createBuildGrid(cfg());
        const rowsMax = gridCfg.rowsMax;
        const gridWrap = el('div', 'build-grid');
        buildGrid.cells.forEach((cell, i) => {
            const slot = (cell && Number.isInteger(cell.slot)) ? cell.slot : null;
            const f = slot === null ? null : state.facilities[slot];
            const dataset = { cell: String(i) };
            if (f && slot !== null) dataset.slot = String(slot);
            const label = f ? (FACILITY_LABELS[f.type] || f.type) : '空位';
            const sub = f ? `Lv${f.level} · 位${slot + 1}` : `格 ${i + 1}`;
            gridWrap.appendChild(createButton({
                label, sub,
                variant: f ? 'default' : 'ghost',
                className: `build-grid__cell${f ? ' is-built' : ' is-empty'}`,
                title: f ? `${label} Lv${f.level}（设施位 ${slot + 1}）` : `第 ${i + 1} 格：空位`,
                dataset,
            }));
        });
        const gridChildren = [gridWrap];

        // 扩建只走既有通道 `sys_buildPurchase({type:'expand'})`（相位校验 / 料账本 / 应用 / 重绘 / 存档都在那里）。
        // [批次 4] 扩建的**产能后果**：每多一行 = 多 cols 个设施位（算式只在 getFacilitySlotCapacity 一处）。
        //   屏上所有「多几个设施位」的数字都从下面这几个派生值取，**不许在文案里写字面量 3**。
        const slotsNow = getFacilitySlotCapacity(buildGrid.rows, cfg());
        const slotsPerRow = getFacilitySlotCapacity(buildGrid.rows + 1, cfg()) - slotsNow;
        const slotsMax = getFacilitySlotCapacity(rowsMax, cfg());
        const expandAction = { type: 'expand' };
        const expandPrice = priceOf(expandAction);
        const atMax = buildGrid.rows >= rowsMax;
        const matOk = hasMaterialsFor(expandPrice && expandPrice.materials, stock);
        const crystalOk = !!expandPrice && have.crystal >= expandPrice.crystal;
        const canExpand = !atMax && !!expandPrice && crystalOk && matOk;
        const expandTitle = atMax
            ? `已到上限 ${rowsMax} 行（设施位 ${slotsNow} 个）`
            : (!expandPrice
                ? '当前不可扩建'
                : (!crystalOk
                    ? `缺 💎 ${expandPrice.crystal - have.crystal}（需 ${expandPrice.crystal}💎）`
                    : (!matOk ? shortfallTitle(expandPrice.materials, stock) : `扩建 +1 行：+${buildGrid.cols} 格、+${slotsPerRow} 个设施位（${buildGrid.rows + 1} 行 / 设施位 ${slotsNow + slotsPerRow} 个）`)));
        gridChildren.push(createButton({
            label: atMax ? '已到上限' : '扩建 1 行',
            variant: canExpand ? 'primary' : 'ghost',
            className: 'build-grid__expand',
            disabled: !canExpand,
            title: expandTitle,
            children: expandPrice ? [
                createPriceTag({ crystal: expandPrice.crystal, haveCrystal: have.crystal }),
                materialPriceTag(expandPrice.materials, stock),
            ] : [],
            onClick: buy(expandAction),
            dataset: { buy: 'expand' },
        }));
        // [批次 4] 网格承载两件事：①「哪一格有什么」；② 盘面本身是**设施位的来源**——每扩建一行，
        //   设施数组与可用位各 +cols（算式见 getFacilitySlotCapacity）。所以这里不再写「本批只读」：
        //   扩建按钮早就能点，写了会与实现矛盾。仍未做的是「把设备搬进/搬出格子」以及「未落格后勤不计产能」，
        //   文案只提这后半句、不承诺摆放，数字全部取上面的派生值（无字面量）。
        gridChildren.push(el('p', 'build-locked-note', {
            text: `扩建连带设施位：每 +1 行 = 盘面 +${buildGrid.cols} 格、设施位 +${slotsPerRow} 个（现 ${slotsNow} 个，上限 ${slotsMax} 个），新位当波即可建造。设备摆放与产能联动尚未接入。`,
        }));
        const gridPanel = createPanel({
            title: '工厂网格',
            hint: `${buildGrid.cols} 列 · ${buildGrid.rows}/${rowsMax} 行 · ${buildGrid.cells.length} 格 · 设施位 ${slotsNow}（可用 ${state.facilitySlotsOpen}）`,
            children: gridChildren,
            id: 'build-grid',
        });
        // `--build-grid-cols` 设在 `#build-grid` 上，`.build-grid` 子容器继承（列数只此一处来源）。
        // 用 setAttribute 写内联自定义属性：真实 DOM 与测试夹具（只有 setAttribute，没有 style 对象）都能落地。
        gridPanel.setAttribute('style', `--build-grid-cols: ${buildGrid.cols};`);
        // ---------- 面板落位顺序（首屏优先放建造面） ----------
        // 2026-10-26 修：改造前面板按「本波弹药 → 主炮 → 设施 → 工厂网格 → 道具 → 挖矿 → 弹匣」落位
        //   （末位那个「炼成弹匣」面板已于 2026-10-26 随炼成弹珠机制一并下线，顺序描述保留作历史对照），
        //   而教程第 9 步（`build_facility`）要求的动作是「建造一座设施」⇒ 玩家首屏看不到任何建造入口，
        //   得先自己想到往下滚（实测 1280×800 首屏可视 646px，`#build-facilities` 在 885、`#build-grid` 在 1155）。
        //   另一条路（把设施提成滚动区之上的常驻块）已实测否决：375×812 下滚动区被压到 225px、滚动比 3:1 → 5.84:1，
        //   扩建按钮又落回折叠线以下（y≈873），属于把走查 C-5 换个形式重演。
        // 这里只调**顺序**，不动字号 / 行高 / 内边距 —— 不靠挤压换空间（同屏的「目标」行已被挤过一次，见走查 R-3）。
        //   「本波弹药」仍紧跟在两处建造面之后：它解释「这一波为什么只打得出 N 发」，
        //   而设施（工坊 / 发电机）正是改变那四条上限的杠杆之一，因果相邻、不拆开。
        [facilityBlock, gridPanel, ammoBlock, cannonBlock].forEach(node => {
            if (node) scroll.appendChild(node);
        });

        // ---------- 道具 ----------
        const itemsCfg = cfg().items || {};
        const itemChildren = [];
        if (!reveal.has('items')) {
            itemChildren.push(el('p', 'build-locked-note', { text: `道具位：${unlockLabel('items')}解锁` }));
        } else {
            const owned = el('div', 'build-items-owned');
            for (let i = 0; i < (itemsCfg.slots || 2); i++) {
                const id = state.items[i];
                owned.appendChild(createSlotCard({
                    state: id ? 'built' : 'empty', ...(id ? glyph(id) : { glyph: '·' }), size: 'hud',
                    title: id ? ITEM_LABELS[id] : '空道具位', slotIndex: i,
                }));
            }
            itemChildren.push(owned);
            const shop = el('div', 'build-items-shop');
            ITEM_IDS.forEach(id => {
                const action = { type: 'item', item: id };
                const locked = !revealed(action);
                const p = priceOf(action);
                const full = state.items.length >= (itemsCfg.slots || 2);
                shop.appendChild(createButton({
                    variant: locked || full || !p || have.energy < p.energy ? 'ghost' : 'default',
                    className: 'build-item-btn',
                    disabled: locked || full || !p || have.energy < p.energy,
                    title: locked ? `${unlockLabel(id)}解锁` : (ITEM_DESC[id] ? ITEM_DESC[id](itemsCfg[id] || {}) : ''),
                    children: [
                        createGlyphTile({ ...(locked ? { glyph: '?' } : glyph(id)), size: 'hud' }),
                        el('span', 'ui-btn__label', { text: ITEM_LABELS[id] }),
                        locked ? createPriceTag({ text: unlockLabel(id) }) : createPriceTag({ energy: p ? p.energy : 0, haveEnergy: have.energy }),
                    ],
                    onClick: buy(action), dataset: { buy: `item-${id}` },
                }));
            });
            itemChildren.push(shop);
        }
        scroll.appendChild(createPanel({ title: '道具', hint: '一次性 · 战斗中使用', children: itemChildren, id: 'build-items' }));

        // ---------- 挖矿升级 ----------
        const miningAction = { type: 'mining', key: 'collector' };
        const miningLocked = !revealed(miningAction);
        const miningRows = [createUpgradeTrack({
            ...glyph('mining'), icon: glyph('mining').glyph,
            label: '采集弹珠 +1', value: `${((CONFIG.gameplay.dig && CONFIG.gameplay.dig.collectorCount) || 5) + (state.miningLevels.collector || 0)} 颗/次`,
            level: state.miningLevels.collector || 0, max: ((cfg().mining && cfg().mining.collector && cfg().mining.collector.prices) || []).length,
            price: priceOf(miningAction), have, locked: miningLocked, lockedText: unlockLabel('mining'),
            onBuy: buy(miningAction), id: 'build-mining-collector',
        })];
        // 其余 3 项挖矿升级（§6）留 S3：只占一行锁定说明，不占三条轨
        miningRows.push(el('p', 'build-locked-note', { text: '宽口能量桶 · 磁力钉 · 咽喉加宽：S3 开放' }));
        scroll.appendChild(createPanel({ title: '挖矿', hint: '投资后期', children: miningRows, id: 'build-mining' }));

        // ---------- 底部：开战 ----------
        // [2026-10-26] 「炼成弹珠 / 炼成弹匣」机制下线（Owner 裁定）后不再有「满匣未处理」的前置阻塞，
        //   开战按钮恒可点；原 `_pendingAlchemyOverflow` 的禁用与「先处理满匣」提示一并删除。
        const foot = el('footer', 'build-foot');
        foot.appendChild(createButton({
            id: 'build-fight-btn', label: '开战', variant: 'primary', className: 'build-fight',
            title: '提交整备，进入战斗',
            onClick: () => this.sys_commitBuild(),
        }));
        root.appendChild(foot);

        const newScroll = root.querySelector('.build-scroll');
        if (newScroll) newScroll.scrollTop = scrollTop;

        // [2026-10-26] 本次采集的元素素材读数：整备屏重绘时一并刷新（实现在 src/ui/hud.js）。
        // 定义在 hud mixin 上，单测里只挂 build_screen_system 时不存在 ⇒ 必须先判类型再调。
        if (typeof this.ui_renderElementCollectReadout === 'function') this.ui_renderElementCollectReadout();
    },

    /**
     * @method ui_buildWaveAmmoPanel
     * @description 组装「本波弹药」面板（步 8）：现有料 / 预演发数 / 弹药配方 / 本波将扣料。
     *   数据只来自四处运行时出口（`sys_getMaterialReadout`、`sys_getWavePreview`、`sys_getShotCostForRecipe`、
     *   `sys_getBuildState`）与配置的 `build.recipes`，
     *   本方法不写死任何配方数值、不自造发数。任一出缺失时对应块降级，不抛错。
     *   `sys_getBuildState` 只用来给「改善路径」那两句（⚡ 余额 / 射速轨下一档价 / 工坊料价）——
     *   拿不到就退回「只说现状」，**不猜**。
     *   电力基数另读 `phase_wavePreviewCore().restAfterCombat`（同一实例上的预演核心，**不另算一份耗电**）：
     *   建工坊会同时改 `U` / `E` / `M` 三轴，只按料一侧判就会承诺出「建了能多打」而实际不发一发
     *   （`docs/review/build-hint-20261025.md` §7）。取不到 ⇒ 三条改善子句都不给。
     *   **成本只有一个来源**：`costOf` 一次取出（优先运行时出口，取不到才降级为配方原价并 warn 一次），
     *   配方行成本串 / 缺料点名 / 够打几发 / 默认配方挑选四处共用同一份，屏里没有第二套倍率。
     * @returns {HTMLElement} 面板元素（可单独测试，不依赖整备屏其余部分）
     */
    ui_buildWaveAmmoPanel() {
        const recipes = Array.isArray(cfg().recipes) ? cfg().recipes.filter(r => r && typeof r === 'object' && r.id) : [];
        const readout = safeRuntimeObject(this, 'sys_getMaterialReadout');
        const preview = safeRuntimeObject(this, 'sys_getWavePreview');
        // 整备状态（⚡ 是本波可用电力；射速轨等级也在里面）——「改善路径」两句的唯一余额/价格来源，
        // 与主炮轨、设施卡读的是同一份（`ui_renderBuildScreen` 里那颗 ⚡ 也是它）。
        const state = safeRuntimeObject(this, 'sys_getBuildState');
        // 成本唯一来源：每条配方只经出口取一次（同一次渲染内复用，避免重复调用与重复 warn）。
        const costCache = new Map();
        const costOf = recipe => {
            const key = (recipe && typeof recipe.id === 'string') ? recipe.id : '';
            if (!costCache.has(key)) costCache.set(key, shotCostOf(this, recipe));
            return costCache.get(key);
        };
        const selectedId = resolveSelectedRecipeId(this, recipes, costOf, readout);
        const selectedRecipe = recipes.find(r => r.id === selectedId) || null;

        // ① 现有料：三色（缺读数时按 0 起，不显示 undefined / NaN）
        const materials = MATERIAL_VIEWS.map(view => ({ ...view, value: toCount(readout && readout[view.key]) }));

        // ② 预演：N + 四条上限 + 一句绑定原因 + 未建造 / 断电 / 干回合 / 腾电提示
        let previewProps = null;
        if (preview) {
            const shots = toCount(preview.shots);
            const detail = (preview.detail && typeof preview.detail === 'object') ? preview.detail : {};
            const bound = typeof preview.bound === 'string' ? preview.bound : null;
            // 工坊三态：未建造 / 断电 / 通电。字段缺失时用 detail.U === null 推断，两者都没有就不给工坊提示。
            const workshop = describeWorkshopStatus({
                workshopBuilt: preview.workshopBuilt,
                powered: preview.powered,
                detailU: detail.U,
            });
            const displays = {};
            LIMIT_VIEWS.forEach(view => { displays[view.key] = toLimitDisplay(detail[view.key]); });
            // 「改善路径」的电力基数只读一次（`phase_wavePreviewCore().restAfterCombat`；建工坊不改变它）。
            // 惰性求值：三处都判不出改善时就不去调预演核心，省一次重算。
            let restPowerCache;
            const restPowerOf = () => {
                if (restPowerCache === undefined) restPowerCache = restPowerAfterCombat(this);
                return restPowerCache;
            };
            // 单步两个：各自按四轴取最小验算（`A` 升一级 / 建工坊三轴同时变）
            const rateGain = rateUpgradeGain({ state, detail, shots });
            const workshopGain = workshopGainShots({
                restPower: restPowerOf(), workshop, readout, recipe: selectedRecipe, shots, state, detail,
            });
            // 组合只在前两条都无效时才算：单步能变多就说单步，别让玩家为了一发去做两件事
            const combined = (rateGain || workshopGain) ? null : comboGain({
                restPower: restPowerOf(), state, detail, readout, recipe: selectedRecipe, shots, workshop,
            });
            const notes = [];
            // 绑定轴为 U 时，那句工坊文案已由原因行给出，这里不重复写
            if (bound !== 'U' && workshop.text) notes.push(workshop.text);
            if (preview.dry) notes.push(DRY_WAVE_TEXT);
            const shed = Array.isArray(preview.shedOptions) ? preview.shedOptions.find(o => o && o.key) : null;
            if (shed) notes.push(`关掉 ${facilityName(shed.key)} 可腾 ${toCount(shed.draw)}⚡`);
            // 并列提示：滤掉绑定轴自身（API 可能把 bound 也列进去），也滤掉未建造的轴（它不参与取最小）
            const tieKeys = Array.isArray(preview.ties)
                ? preview.ties.filter(k => typeof k === 'string' && k && k !== bound && displays[k] && displays[k].built)
                : [];
            previewProps = {
                shots,
                bound,
                reason: describeBindingReason({
                    bound, shots, workshop,
                    missing: shortfallMaterials(costOf(selectedRecipe), readout, shots),
                    // 「怎么做能变多」三类子句：都判过「四轴取最小之后真能变多」才给数，否则 null ⇒ 文案一个字不加。
                    workshopGain,
                    rateGain,
                    comboGain: combined,
                }),
                ties: tieKeys.length ? `并列：${tieKeys.map(limitLabel).join(' · ')}` : '',
                notes,
                // 未建造的轴不进绑定态：它压根没参与 min，高亮它等于说「0 卡住了你」
                limitChips: LIMIT_VIEWS.map(view => ({
                    key: view.key,
                    label: view.label,
                    display: displays[view.key],
                    active: view.key === bound && displays[view.key].built,
                })),
            };
        }

        // ③ 弹药配方：逐条（成本、够打几发都从「成本出口 + 现有料」读；`blueprintRequired` 一律锁定——设计图解锁状态尚未落地）
        // 成本串与够几发都走 `costOf`（实扣口径，未建工坊含手工溢价）⇒ 屏上数字与开战时的扣料同源。
        // 倍率位已删：配方字段 `damageMult` 判死（战斗侧从未读取），屏上逐条只剩「成本 · 够几发」。
        const recipeProps = recipes.map(r => ({
            id: r.id,
            displayName: r.displayName || r.id,
            costText: recipeCostText(costOf(r)),
            affordText: `够 ${affordableShots(costOf(r), readout)} 发`,
            state: r.blueprintRequired ? 'locked' : (r.id === selectedId ? 'selected' : 'idle'),
        }));

        // ④ 本波**将**扣料：数据源 `sys_getWavePreview().plannedSpent`。
        //    整备屏是开战前的屏，真实扣料发生在开战时刻，`readout.spent` 此刻恒为 0（不是本轮缺陷，也不是读数）；
        //    预演缺失 / 无 plannedSpent ⇒ 按 0（不显示 undefined / NaN），文案已写明「开战时才扣」。
        const planned = (preview && preview.plannedSpent && typeof preview.plannedSpent === 'object') ? preview.plannedSpent : {};
        const spentPyro = toCount(planned.pyro);
        const spentCryo = toCount(planned.cryo);
        const spentBeast = toCount(planned.beast);
        const spentTotalRaw = Number(planned.total);
        const spentTotal = Number.isFinite(spentTotalRaw) ? toCount(spentTotalRaw) : spentPyro + spentCryo + spentBeast;

        return createWaveAmmoPanel({
            materials,
            preview: previewProps,
            recipes: recipeProps,
            onSelect: id => this.ui_selectAmmoRecipe(id),
            spent: { total: spentTotal, pyro: spentPyro, cryo: spentCryo, beast: spentBeast },
        });
    },

    /**
     * @method ui_selectAmmoRecipe
     * @description 选一条弹药配方并重绘。锁定态（`blueprintRequired`）与不存在的 id 一律不写，
     *   避免「点得进去但选不上」的假交互。写入优先走运行时的 `sys_selectRecipe`（若第 6/7 步提供），
     *   否则落到第 5 步存档已在用的同一字段 `_selectedRecipeId`。
     * @param {string} recipeId
     */
    ui_selectAmmoRecipe(recipeId) {
        const id = typeof recipeId === 'string' ? recipeId : '';
        if (!id) return;
        const recipes = Array.isArray(cfg().recipes) ? cfg().recipes : [];
        const hit = recipes.find(r => r && r.id === id);
        if (!hit || hit.blueprintRequired) return;
        if (typeof this.sys_selectRecipe === 'function') this.sys_selectRecipe(id);
        else this._selectedRecipeId = id;
        if (typeof this.ui_renderBuildScreen === 'function') this.ui_renderBuildScreen();
    },

    /**
     * @method ui_openFacilityPicker
     * @description 空设施位「建造」→ 选择设施的弹层（未解锁项显示解锁时机）。
     */
    ui_openFacilityPicker(slot) {
        const root = document.getElementById('build-screen-root');
        if (!root) return;
        const old = document.getElementById('build-facility-picker');
        if (old) old.remove();
        const state = this.sys_getBuildState();
        const reveal = this.sys_getBuildReveal();
        // 弹层是独立入口（不经过 ui_renderBuildScreen 的闭包），料余额自己再读一次。
        const stock = safeRuntimeObject(this, 'sys_getMaterialReadout');
        const close = () => { const m = document.getElementById('build-facility-picker'); if (m) m.remove(); };
        const list = FACILITY_IDS.map(type => {
            const action = { type: 'build', slot, facility: type };
            const locked = !isActionRevealed(action, reveal);
            const p = getPrice(state, action, cfg());
            // 「全局 1 座」按配置的 `unique` 判（不只是收集器），否则工坊 / 发电机 / 电池会显示可建却建不了。
            const unique = !!((cfg().facilities || {})[type] || {}).unique
                && state.facilities.some(f => f && f.type === type);
            const matOk = hasMaterialsFor(p && p.materials, stock);
            const ok = !locked && !unique && !!p && state.energy >= p.energy && state.crystal >= p.crystal && matOk;
            // 价格节点用**扁平**数组拼（`append` 只 flat 一层，嵌套数组在真 DOM 下会 appendChild(Array) 抛错）。
            const priceNodes = [];
            if (locked) {
                priceNodes.push(createPriceTag({ text: unlockLabel(type) }));
            } else {
                // 能量 / 水晶都为 0 时不出「免费」：料付设施的 energy 就是 0，与料价同框会读出「免费但要料」。
                if (p && (p.energy > 0 || p.crystal > 0)) {
                    priceNodes.push(createPriceTag({ energy: p.energy, crystal: p.crystal, haveEnergy: state.energy, haveCrystal: state.crystal }));
                }
                const matTag = materialPriceTag(p && p.materials, stock);
                if (matTag) priceNodes.push(matTag);
            }
            return createButton({
                variant: ok ? 'default' : 'ghost', className: 'build-picker__btn', disabled: !ok,
                // 「全局 1 座」这句与运行期拒绝**同一句**（`build_system.js` 的 `uniqueFacilityText`）：
                // 弹层过去只写「全局只能建 1 座」不点名，读起来像对所有设施都成立——8 件里只有 4 件 unique。
                title: locked ? `${unlockLabel(type)}解锁` : (unique ? uniqueFacilityText(type) : (matOk ? '' : shortfallTitle(p && p.materials, stock))),
                children: [
                    createGlyphTile(locked ? { glyph: '?' } : glyph(type)),
                    el('span', 'build-picker__text', {}),
                    ...priceNodes,
                ],
                onClick: () => { close(); this.sys_buildPurchase(action); },
                dataset: { facility: type },
            });
        });
        list.forEach((btn, i) => {
            const type = FACILITY_IDS[i];
            const text = btn.querySelector('.build-picker__text');
            const lv = getFacilityStats(type, 1, cfg());
            append(text, el('b', '', { text: FACILITY_LABELS[type] }),
                el('small', '', { text: `${FACILITY_DESC[type](lv)}${lv.cooldown ? ` · 冷却 ${lv.cooldown}` : ''}` }));
        });
        root.appendChild(createModal({
            id: 'build-facility-picker', title: `建造设施 · 位 ${slot + 1}`,
            body: list,
            actions: [createButton({ label: '取消', variant: 'ghost', onClick: close })],
        }));
    },
};
