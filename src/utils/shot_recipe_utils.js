/**
 * shot_recipe_utils.js - [REQ-20261022-wave-loop · 经济接线 v2 第 2 步] 「弹药配方表」的纯函数层。
 *
 * 施工依据：`docs/design/economy_wiring_spec_v2_corrections.md`（下称「订正件」）
 *   - 附录 C-2「配方载体定义」（`:272-288`）：载体位置 `CONFIG.gameplay.build.recipes`，与 `facilities`／`power`
 *     **同段族**；每条五字段 `{ id, displayName, cost, elements, blueprintRequired }`
 *     （原六字段里的 `damageMult` 已于 2026-10-25 删除，见 `REMOVED_RECIPE_FIELDS`）；
 *     `cost` 只有被点名的料键才收（未点名＝0 需求，与订正 C2 的逐桶最小值一致）；`elements` 是元素**初始层数**；
 *     `blueprintRequired` 是布尔；「未选时的默认」＝2026-10-25 起按**这堆料能打几发**挑
 *     （`pickRecipeByYield`，料况读数缺失时才退回「`cost` 最低的那一条」`pickDefaultRecipe`）。
 *   - C10（`[约束]`，不是可调项，`corrections:175`）：「最低档配方必须在 `FLOOR_BUCKET`（`pyro`）上 `cost ≤ 3`，
 *     且其它料的 `cost` 必须为 0」。上限取 `[盘上]` `basicFloorPerWave`（`src/config.js:1008`）＝ 3。
 *     **本文件不重写这条规则**，直接复用第 1 步的实现 `validateFloorTierCost`
 *     （`src/utils/material_loadout_utils.js:226`）——两处各写一份必然漂移。
 *   - v2 §5.2（`:209-221`）：档位只有「用几种料」一个维度（现两档：单料／双料／预留三料）；
 *     「倍率与成本必须同向抬高，否则高档恒优、低档成死档」——**其中倍率那一半已随 `damageMult` 一起删除**
 *     （该字段全仓零战斗读取点，多付料不加伤）；剩下的一半（跨档成本同向）仍由 `COST_MULT_NOT_ALIGNED` 强制。
 *   - 附录 C-2「命名风险」：`recipe` 一词在盘上已被 `src/ui/hud.js:623`、`src/ui_system.js:1559`
 *     占用为**单发子弹对象**。因此本文件的函数名一律带 `Recipe`（指**弹药配方**），
 *     配置路径一律写全 `config.gameplay.build.recipes`，不导出任何叫裸 `recipe` 的东西。
 *
 * 纯函数约束：不读 `this`、不读全局运行时状态（`_selectedRecipeId`、冻结记录**都不在这里**）、
 *   无副作用、不吃随机数；所有输入显式传入、所有输出显式返回；**不修改入参**（`config` / `cost` 只读）。
 *   本文件只 import 两个纯函数模块（`material_economy_utils.js` / `material_loadout_utils.js`），
 *   不 import `config`、不 import 任何 `game_*`，node 可直接跑单测。
 *
 * 数值：本文件**不含任何配方数值**——数值全在 `src/config.js` 的 `recipes` 段（2026-10-25 起 `cost` 已定稿，
 *   `elements` 层数与解锁节奏仍是 `[提案]`）。本文件只做结构校验与选择，
 *   故数值替换**不需要**改本文件。
 */

import {
    BASIC_FLOOR_PER_WAVE,
    FLOOR_BUCKET,
    PEG_MATERIAL_KEYS,
} from './material_economy_utils.js';
import { validateFloorTierCost, validateShotCost } from './material_loadout_utils.js';

/** 配方对象的五个必需字段（订正件附录 C-2，逐字、不许增减；`damageMult` 已于 2026-10-25 删除）。 */
export const RECIPE_FIELDS = ['id', 'displayName', 'cost', 'elements', 'blueprintRequired'];

/**
 * **已删除**的配方字段：出现即判 `REMOVED_FIELD`，不许借「未知键不管」悄悄复活。
 *   - `damageMult`（单发倍率 1 / 1.25 / 1.25，2026-10-25 删除）：全仓零战斗读取点——战斗侧吃的是
 *     单发子弹对象的 `recipe.damage`（`src/combat/collision.js:355-357`），配方表里这个字段只被结构校验
 *     与界面显示读过。结果是「多付 1 料不加伤、屏上却写 ×1.25」，界面在说一件战斗里不成立的事。
 *     决定见 `docs/review/gameplay-20261025.md` C-1 与 §7-①（选 B：不接线，从表与界面一并删）。
 *   - 删字段不等于放宽校验：这里从「必须合法」收紧成「不许出现」，方向相反、强度不降。
 */
export const REMOVED_RECIPE_FIELDS = ['damageMult'];

/** 已删除字段的解释（写进错误信息，免得后来者以为只是漏配）。 */
const REMOVED_FIELD_REASONS = {
    damageMult: '单发倍率已删除（战斗侧从未读取该字段：多付料不加伤，屏上写 ×N 就是说谎）——料只决定「打几发」，不许加回',
};

/**
 * `elements` 允许的元素键。
 * 元素与料键**不同轴**：`lightning` 只能作元素层数，**不能**作 `cost` 的料键
 * （订正 C6：第三种料键属预留档，本轮不放开）。
 */
export const ELEMENT_KEYS = ['pyro', 'cryo', 'lightning'];

/** 档位键：单料（`cost` 只有 1 个正数料键）。 */
export const TIER_SINGLE = 'single';
/** 档位键：双料（`cost` 有 2 个正数料键）。 */
export const TIER_DUAL = 'dual';
/**
 * 三色料的**屏上中文名**（唯一真源）：`ui/components/wave_ammo.js` 的 `MATERIAL_VIEWS.label`、
 * 整备屏料价、运行期购买失败提示全部从这里取，**不许就地写字面量**——同一桶料在两处叫两个名，
 * 就是「界面不说谎」这条的破口（2026-10-25 验收 P1-5：屏上出现过「（缺 pyro）」这种泄键名的串）。
 */
export const MATERIAL_LABELS = { pyro: '火料', cryo: '冰料', beast: '怪物料' };
/** 料的固定显示顺序（与价格 / 账本键序无关，屏上一律火 → 冰 → 怪物）。 */
export const MATERIAL_ORDER = ['pyro', 'cryo', 'beast'];

/** 料键 → 中文名；未登记的键原样返回（不拼 `undefined`，也不静默吞掉）。 */
export function materialLabel(key) {
    return MATERIAL_LABELS[key] || String(key === undefined || key === null ? '' : key);
}

/**
 * 缺料明细：**差额 = 需要 − 现有**，只返回真的缺的那几桶，按 `MATERIAL_ORDER` 排。
 * `need` / `stock` 都是逐料读数的普通对象（缺键按 0）。
 * @returns {Array<{key:string,label:string,need:number,have:number,lack:number}>}
 */
export function describeMaterialShortfall(need, stock) {
    const want = _isPlainObject(need) ? need : {};
    const have = _isPlainObject(stock) ? stock : {};
    const out = [];
    MATERIAL_ORDER.forEach(key => {
        const n = Math.max(0, Math.floor(Number(want[key]) || 0));
        if (n <= 0) return;
        const h = Math.max(0, Math.floor(Number(have[key]) || 0));
        if (h >= n) return;
        out.push({ key, label: materialLabel(key), need: n, have: h, lack: n - h });
    });
    return out;
}

/**
 * 缺料一句人话：「缺 火料 4、冰料 1」。无缺口返回空串（调用方据此决定要不要提示）。
 * 屏上**不许**出现料键名（`pyro` / `cryo` / `beast`），也不许只说「料不足」三个字。
 */
export function formatMaterialShortfall(need, stock) {
    const lack = describeMaterialShortfall(need, stock);
    if (!lack.length) return '';
    return `缺 ${lack.map(x => `${x.label} ${x.lack}`).join('、')}`;
}

/** 档位由低到高的固定顺序（跨档单调检查按此序，不表达其它含义）。 */
export const TIER_ORDER = [TIER_SINGLE, TIER_DUAL];
/** 档位中文（UI 文案用；说「弹药配方」不说裸「配方」）。 */
export const TIER_LABELS = { [TIER_SINGLE]: '单料', [TIER_DUAL]: '双料' };

/** 配置路径的**唯一**合法写法（正文与错误信息一律写全，不简写）。 */
const CONFIG_PATH = 'CONFIG.gameplay.build.recipes';
/** 配置路径的可读定位（供错误信息使用，与实际读取逻辑一致）。 */
const CONFIG_SEGMENTS = ['gameplay', 'build', 'recipes'];

function _isPlainObject(v) {
    return !!v && typeof v === 'object' && !Array.isArray(v);
}

function _raw(v) {
    if (v === undefined) return 'undefined';
    if (v === null) return 'null';
    if (typeof v === 'string') return `"${v}"`;
    try {
        return JSON.stringify(v);
    } catch (e) {
        return String(v);
    }
}

function _msg(e) {
    return String((e && e.message) || e);
}

function _cmpStr(a, b) {
    const x = String(a);
    const y = String(b);
    if (x < y) return -1;
    if (x > y) return 1;
    return 0;
}

/**
 * 归一化并校验「每发对每种料的需求量」（`cost`）。
 * 只允许 `pyro` / `cryo`（`PEG_MATERIAL_KEYS`）；每键必须是 ≥ 0 的整数；
 * **未点名的料键视为 0 需求**（订正 C2 ①，`corrections:280`），所以 `{ pyro: 3 }` 与 `{ pyro: 3, cryo: 0 }` 等价。
 * @param {object} cost - 形如 `{ pyro: 3 }` / `{ pyro: 2, cryo: 2 }`
 * @param {string} caller - 调用方函数名（只用于错误信息定位）
 * @returns {Array<{ materialKey:string, cost:number }>} 按 `PEG_MATERIAL_KEYS` 顺序（只含被点名的键，0 也在内）
 * @throws {TypeError} 不是对象 / 键不是 `pyro`·`cryo` / 值不是 ≥ 0 的整数
 */
function _normalizeCost(cost, caller) {
    if (!_isPlainObject(cost)) {
        throw new TypeError(
            `[${caller}] cost 必须是对象（如 { pyro: 3 }；未点名的料视为 0 需求），实测 ${_raw(cost)}`
        );
    }
    const picked = [];
    for (const key of Object.keys(cost)) {
        if (!PEG_MATERIAL_KEYS.includes(key)) {
            throw new TypeError(
                `[${caller}] 未知料键 "${key}"（值 ${_raw(cost[key])}）：只允许 ${PEG_MATERIAL_KEYS.join(' / ')}；`
                + '第三种料键属预留档，本轮不放开（订正 C6）'
            );
        }
        const n = Number(cost[key]);
        if (!Number.isInteger(n)) {
            throw new TypeError(`[${caller}] 料键 "${key}" 的每发需求量必须是整数，实测 ${_raw(cost[key])}`);
        }
        if (n < 0) {
            throw new TypeError(`[${caller}] 料键 "${key}" 的每发需求量不得为负，实测 ${n}`);
        }
        picked.push({ materialKey: key, cost: n });
    }
    // 固定按 PEG_MATERIAL_KEYS 顺序输出，保证「同输入 ⇒ 同输出」（不依赖对象键的插入顺序）
    picked.sort((a, b) => PEG_MATERIAL_KEYS.indexOf(a.materialKey) - PEG_MATERIAL_KEYS.indexOf(b.materialKey));
    return picked;
}

/**
 * 取 `CONFIG.gameplay.build.recipes` 的配方数组。
 * **缺段或非数组一律抛错**（订正件附录 C-3 第 2 步是配置层的前提：静默返回 `[]` 会让下游把
 * 「没配」当成「没有配方可选」，进而让预演给出 `N = 0` 的白补 1 发，属订正 C9 点名的伪装）。
 * @param {object} config - 整个配置对象（如 `import { CONFIG } from '../src/config.js'`）
 * @returns {Array<object>} 数组的**浅拷贝**（防止调用方 `push`/`splice` 改到配置本体；元素对象仍为只读约定）
 * @throws {TypeError} 缺段 / 非数组 / 空数组
 */
export function listRecipes(config) {
    let node = config;
    for (const seg of CONFIG_SEGMENTS) {
        if (!_isPlainObject(node)) {
            throw new TypeError(
                `[listRecipes] ${CONFIG_PATH} 读不到：路径上的 "${seg}" 处不是对象，实测 ${_raw(node)}`
            );
        }
        node = node[seg];
    }
    if (node === undefined) {
        throw new TypeError(`[listRecipes] ${CONFIG_PATH} 缺失：配置里没有弹药配方表（不是"没有配方可选"，是配置缺陷）`);
    }
    if (!Array.isArray(node)) {
        throw new TypeError(`[listRecipes] ${CONFIG_PATH} 必须是数组，实测 ${_raw(node)}`);
    }
    if (node.length === 0) {
        throw new TypeError(
            `[listRecipes] ${CONFIG_PATH} 是空数组：至少要有一条最低档弹药配方`
            + `（${FLOOR_BUCKET} 上 cost ≤ ${BASIC_FLOOR_PER_WAVE}、其它料 cost = 0，订正 C10）`
        );
    }
    return node.slice();
}

/**
 * 按 `id` 取一条弹药配方。
 * @param {object} config
 * @param {string} id
 * @returns {object} 命中的配方对象（原对象，未拷贝——调用方按只读处理）
 * @throws {TypeError} `id` 不是非空字符串
 * @throws {RangeError} 找不到；错误信息里带**可选 id 列表**
 */
export function getRecipeById(config, id) {
    if (typeof id !== 'string' || id === '') {
        throw new TypeError(`[getRecipeById] id 必须是非空字符串，实测 ${_raw(id)}`);
    }
    const list = listRecipes(config);
    const hit = list.find((entry) => _isPlainObject(entry) && entry.id === id);
    if (!hit) {
        const ids = list.map((entry) => (_isPlainObject(entry) ? String(entry.id) : _raw(entry)));
        throw new RangeError(`[getRecipeById] ${CONFIG_PATH} 里没有 id "${id}"；可选 id：${ids.join(', ')}`);
    }
    return hit;
}

/**
 * 按「`cost` 里有几个正数料键」判定档位（订正件附录 C-2「档位与配方是两层」）。
 * 0 个正数键（全 0 / 空对象）与 ≥3 个正数键一律抛错：本轮只开单料／双料两档，
 * 第三种料键属**预留档**，不放开（订正 C6）。
 *
 * 校验**顺序是刻意**的：先判「值的整数性」→ 再判「正数料键个数」→ 最后判「料键合法性」。
 * 理由：契约把「档位越界」与「未知料键」当两条独立判据。若先验料键，`{ pyro, cryo, lightning }`
 * 会被「未知料键 lightning」提前吃掉，「≥3 正数键」这条分支永远走不到（成了死代码）。
 * 先计数后验键，两条判据各自可达：三键报档位越界，`{ lightning: 1 }` 报未知料键（只 1 个正数键）。
 * 表级校验（`validateRecipeTable`）仍走第 1 步的 `validateShotCost`，那里的顺序不受此影响。
 * @param {object} cost
 * @returns {'single'|'dual'}
 * @throws {TypeError} 非对象 / 值不是 ≥ 0 的整数 / 未知料键
 * @throws {RangeError} 正数料键数不是 1 或 2
 */
export function resolveTier(cost) {
    if (!_isPlainObject(cost)) {
        throw new TypeError(
            `[resolveTier] cost 必须是对象（如 { pyro: 3 }；未点名的料视为 0 需求），实测 ${_raw(cost)}`
        );
    }
    const positive = [];
    for (const key of Object.keys(cost)) {
        const n = Number(cost[key]);
        if (!Number.isInteger(n)) {
            throw new TypeError(`[resolveTier] 料键 "${key}" 的每发需求量必须是整数，实测 ${_raw(cost[key])}`);
        }
        if (n < 0) {
            throw new TypeError(`[resolveTier] 料键 "${key}" 的每发需求量不得为负，实测 ${n}`);
        }
        if (n > 0) positive.push(key);
    }
    if (positive.length === 0) {
        throw new RangeError(
            `[resolveTier] cost 里没有任何正数料键（实测 ${_raw(cost)}）：配方必须点名至少 1 种料，`
            + '全 0 的配方算不出每发成本，也无法定档'
        );
    }
    if (positive.length >= 3) {
        throw new RangeError(
            `[resolveTier] 正数料键 ${positive.length} 个（${positive.join(', ')}）：本轮只有单料／双料两档，`
            + '第三种料键属预留档，不放开（订正 C6）'
        );
    }
    for (const key of Object.keys(cost)) {
        if (!PEG_MATERIAL_KEYS.includes(key)) {
            throw new TypeError(
                `[resolveTier] 未知料键 "${key}"（值 ${_raw(cost[key])}）：只允许 ${PEG_MATERIAL_KEYS.join(' / ')}；`
                + '第三种料键属预留档，本轮不放开（订正 C6）'
            );
        }
    }
    return positive.length === 1 ? TIER_SINGLE : TIER_DUAL;
}

/**
 * 单发料成本总量（各料 `cost` 求和）。只用于**排序与并列判定**，不是扣料口径
 * （扣料走第 1 步的 `computeMaterialShots` / `chargeShotMaterials`，逐料取最小、不是加总）。
 * @param {object} cost
 * @returns {number} 非负整数
 * @throws {TypeError} 同 `_normalizeCost`
 */
export function sumRecipeCost(cost) {
    const picked = _normalizeCost(cost, 'sumRecipeCost');
    return picked.reduce((acc, entry) => acc + entry.cost, 0);
}

/**
 * 可读的单发料成本串，**只列正数键**（未点名与点名 0 都不列）。
 * @param {object} cost
 * @returns {string} 如 `pyro 2 + cryo 1`；全 0 时返回 `无`
 * @throws {TypeError} 同 `_normalizeCost`
 */
export function describeRecipeCost(cost) {
    const positive = _normalizeCost(cost, 'describeRecipeCost').filter((entry) => entry.cost > 0);
    if (positive.length === 0) return '无';
    return positive.map((entry) => `${entry.materialKey} ${entry.cost}`).join(' + ');
}

/**
 * 档位的中文名（UI 文案用）。
 * @param {'single'|'dual'} tier
 * @returns {string} `单料` / `双料`
 * @throws {RangeError} 未知档位（带可选值列表）
 */
export function describeRecipeTier(tier) {
    const label = TIER_LABELS[tier];
    if (!label) {
        throw new RangeError(
            `[describeRecipeTier] 未知档位 ${_raw(tier)}：可选值 ${TIER_ORDER.map((t) => `"${t}"（${TIER_LABELS[t]}）`).join(' / ')}`
        );
    }
    return label;
}

/**
 * 「已解锁」→「候选配方对象数组」的唯一入口（`pickDefaultRecipe` / `pickRecipeByYield` 共用）。
 * 两个挑法只差**挑选依据**（成本总量 vs 这堆料能打几发），候选集合的定义必须只有一份，
 * 否则两处各写一遍，迟早一条认 `Set`、一条不认，或一条容忍空 id、一条不容忍。
 * @param {object} config
 * @param {string[]|Set<string>} unlockedIds
 * @param {string} caller - 调用方函数名（只用于错误信息定位）
 * @returns {Array<object>} 候选配方对象（原对象，未拷贝）
 * @throws {TypeError} `unlockedIds` 不是数组／Set，或为空
 * @throws {RangeError} 已解锁列表里没有任何一条落在 `CONFIG.gameplay.build.recipes` 内
 */
function _candidateRecipes(config, unlockedIds, caller) {
    const list = listRecipes(config);
    const ids = unlockedIds instanceof Set
        ? Array.from(unlockedIds)
        : (Array.isArray(unlockedIds) ? unlockedIds.slice() : null);
    if (ids === null) {
        throw new TypeError(`[${caller}] unlockedIds 必须是数组或 Set，实测 ${_raw(unlockedIds)}`);
    }
    const valid = ids.filter((entry) => typeof entry === 'string' && entry !== '');
    if (valid.length === 0) {
        throw new TypeError(`[${caller}] unlockedIds 为空：未解锁任何弹药配方时没有默认项可选（不存在"免费送一发"的兜底）`);
    }
    const wanted = new Set(valid);
    const candidates = list.filter((entry) => _isPlainObject(entry) && wanted.has(entry.id));
    if (candidates.length === 0) {
        const tableIds = list.map((entry) => (_isPlainObject(entry) ? String(entry.id) : _raw(entry)));
        throw new RangeError(
            `[${caller}] 已解锁 id 里没有任何一条在 ${CONFIG_PATH} 内：已解锁 ${valid.join(', ')}；表内 ${tableIds.join(', ')}`
        );
    }
    return candidates;
}

/**
 * 取「已解锁里 `cost` 总量最低的那一条」作为默认弹药配方（订正件附录 C-2「未选时的默认」）。
 * 并列时取 `id` **字典序最小**——保证同一个已解锁集合在任何环境都给出同一条，不随数组顺序漂移。
 *
 * **口径说明（2026-10-25 起）**：这条「按标价最低挑」不再是无料况时的默认挑法——
 *   运行时与整备屏都改走 `pickRecipeByYield`（料只决定「这波能打几发」，就该按发数挑）。
 *   本函数保留两个用途：① `pickRecipeByYield` 的**退回口径**（料况读数缺失时）；② 表级校验
 *   `validateRecipeTable` 里「最低档」的定义（C10 约束仍需一个与料无关的排序）。
 * @param {object} config
 * @param {string[]|Set<string>} unlockedIds - 已解锁的弹药配方 id
 * @returns {object} 命中的配方对象（原对象）
 * @throws {TypeError} `unlockedIds` 不是数组／Set，或为空
 * @throws {RangeError} 已解锁列表里没有任何一条落在 `CONFIG.gameplay.build.recipes` 内
 */
export function pickDefaultRecipe(config, unlockedIds) {
    const candidates = _candidateRecipes(config, unlockedIds, 'pickDefaultRecipe');
    let best = null;
    for (const entry of candidates) {
        const total = sumRecipeCost(entry.cost);
        if (best === null || total < best.total) {
            best = { recipe: entry, total };
            continue;
        }
        if (total === best.total && _cmpStr(entry.id, best.recipe.id) < 0) {
            best = { recipe: entry, total };
        }
    }
    return best.recipe;
}

/**
 * 这批料按这条成本**能打出几发**（订正 C2 的 `M` 口径，逐料取最小）：
 *   `yield = min over m where cost[m] > 0 of floor(stock[m] / cost[m])`
 * 与 `computeMaterialShots`（`material_loadout_utils.js:147`）同一算式，但**不校验成本形状、不抛错**：
 * 这里要能吞下任意一条成本（包括全 0 / 缺键），见 `pickRecipeByYield` 的说明。
 * `cost` 里没有任何正数键 ⇒ `0`（算不出每发成本，按「一发也打不出」计，不返回 `Infinity`）。
 * `stock[m]` 缺失 / 非数 / 负数 ⇒ 按 0（缺键就是没料，不当成错误）。
 * @param {object} cost - 每发逐料成本（**实扣价**，见 `pickRecipeByYield`）
 * @param {object} stockByMaterial - 逐料余额（可直接传账本或 `sys_getMaterialReadout()` 的返回）
 * @returns {number} 发数（≥ 0 的整数）
 */
export function computeRecipeYield(cost, stockByMaterial) {
    const per = _isPlainObject(cost) ? cost : {};
    const have = _isPlainObject(stockByMaterial) ? stockByMaterial : {};
    let shots = Number.POSITIVE_INFINITY;
    for (const key of Object.keys(per)) {
        const need = Number(per[key]);
        if (!Number.isFinite(need) || need <= 0) continue;   // cost[m] = 0 不参与（订正 C2 ①，否则除零）
        const raw = Number(have[key]);
        const stock = Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : 0;
        const n = Math.floor(stock / need);
        if (n < shots) shots = n;
    }
    return Number.isFinite(shots) ? Math.max(0, shots) : 0;
}

/**
 * 取「**按现有料能打出几发最多**」的那条已解锁弹药配方（本轮默认配方的挑法）。
 *
 * 为什么不是「按标价最低挑」（`pickDefaultRecipe`，2026-10-25 之前的默认）：
 *   本作的料只决定「这波能打几发」，配方字段 `damageMult` 已删除（多付料不加伤）。
 *   按标价最低挑会系统性压到单料档：`{ pyro: 3 }` 总量 3 < 双料 `{ pyro: 2, cryo: 2 }` 总量 4，
 *   于是一律选单料，另一桶料全程零消耗（真机三波实测：cryo 从 0 单调涨到 32，等于白挖）。
 *   按发数挑则是**自动适配料配比**：哪种料紧，就挑那条对紧桶需求低的。
 *
 * **成本一律用 `costOf(recipe)` 的实扣价**（未建工坊时含 `manualMaterialMultiplier` 手工溢价），
 *   **不许用配方原价**：原价算出来是「单料 3 < 双料 4 ⇒ 选单料」，实扣价算出来是
 *   「单料 `{pyro:6}` 打 1 发 / 双料 `{pyro:4,cryo:4}` 打 2 发」——两者结论相反，
 *   用原价正是上面那个 bug 的成因（屏上还会按半价排，与账上实扣不一致）。
 *
 * 挑选规则：`yield` 最大者；**并列按 `id` 字典序最小**（与 `pickDefaultRecipe` 同一确定性口径，
 *   保证「同输入 ⇒ 同输出」，不随数组顺序漂移）。
 *
 * **退回口径**：`stockByMaterial` 缺失／不是普通对象，或 `costOf` 不是函数 ⇒ 直接返回
 *   `pickDefaultRecipe(config, unlockedIds)` 的结果（旧行为）。**退回而不抛错**的理由：
 *   这两项是「料况读数」与「成本出口」，运行时与屏上都可能有尚未接线的时刻（例如账本还没初始化、
 *   屏上运行时出口缺失）；此刻抛错会把「读不到料况」升级成「整备屏炸掉 / 开战卡死」，
 *   而旧口径给的是一个仍然可玩的配方。缺口本身由调用方 warn，不在这里静默补数。
 * @param {object} config
 * @param {string[]|Set<string>} unlockedIds - 已解锁的弹药配方 id（`blueprintRequired: true` 的不许放进来）
 * @param {object|null|undefined} stockByMaterial - 逐料余额
 * @param {(recipe:object)=>(object)} costOf - 取**实扣**每发逐料成本的函数（只含正数料键）
 * @returns {object} 命中的配方对象（原对象）
 * @throws {TypeError} `unlockedIds` 不是数组／Set，或为空（与 `pickDefaultRecipe` 同一套判据）
 * @throws {RangeError} 已解锁列表里没有任何一条落在 `CONFIG.gameplay.build.recipes` 内
 */
export function pickRecipeByYield(config, unlockedIds, stockByMaterial, costOf) {
    if (typeof costOf !== 'function' || !_isPlainObject(stockByMaterial)) {
        return pickDefaultRecipe(config, unlockedIds);
    }
    const candidates = _candidateRecipes(config, unlockedIds, 'pickRecipeByYield');
    let best = null;
    for (const entry of candidates) {
        const shots = computeRecipeYield(costOf(entry), stockByMaterial);
        if (best === null || shots > best.shots) {
            best = { recipe: entry, shots };
            continue;
        }
        if (shots === best.shots && _cmpStr(entry.id, best.recipe.id) < 0) {
            best = { recipe: entry, shots };
        }
    }
    return best.recipe;
}

/**
 * 逐条校验整张弹药配方表（配置层的唯一门）。
 *
 * 校验项（每条都返回 `{ code, id, message }`，`id` 尽量指到具体那条）：
 *   ① 表存在、非空数组（`TABLE_INVALID`）；
 *   ② 五字段齐（`MISSING_FIELD`）；`displayName` 非空字符串（`BAD_DISPLAY_NAME`）；
 *   ②' **已删除字段不许出现**（`REMOVED_FIELD`，见 `REMOVED_RECIPE_FIELDS`：`damageMult` 出现即判红）；
 *   ③ `cost` 键只能是 `pyro`·`cryo`、非负整数、不许全 0（`BAD_COST`，细节沿用第 1 步 `validateShotCost` 的原话）；
 *   ④ `elements` 键只能是 `pyro`·`cryo`·`lightning`、层数为非负整数、**0 层也要显式写**（`BAD_ELEMENTS`）；
 *   ⑤ `blueprintRequired` 是布尔（`BAD_BLUEPRINT_FLAG`）；
 *   ⑥ 档位能判定（`TIER_OUT_OF_RANGE`）；若对象自带 `tier` 字段，必须与正数料键数推导的档位一致（`TIER_MISMATCH`）；
 *   ⑦ `id` 唯一（`DUPLICATE_ID`）；
 *   ⑧ **最低档满足 C10**（`FLOOR_TIER_VIOLATION`）：「最低档」取 `cost` 总量最小的那条（并列按 `id` 字典序），
 *      规则本身复用第 1 步 `validateFloorTierCost`，不在本文件重写；
 *   ⑨ 档位成本（v2 §5.2 `:221`）：**跨档成本同向**（`COST_MULT_NOT_ALIGNED`）：高档每条的 `cost` 总量必须 > 低档每条的 `cost` 总量
 *      （`:221`「料多一档，单发成本也涨」）。
 *      原「同档倍率全等」（`TIER_MULT_MISMATCH`）与「跨档倍率单调」（`DAMAGE_MULT_MONOTONIC`）两条随
 *      `damageMult` 一起删除：字段不存在，这两条检查无对象可查；**它们是删除，不是放宽**——
 *      替代它们的是 ②' 的 `REMOVED_FIELD`（字段复活即判红）。
 *
 * @param {object} config
 * @returns {{ ok:boolean, errors:Array<{code:string, id:(string|null), message:string}> }}
 */
export function validateRecipeTable(config) {
    let list;
    try {
        list = listRecipes(config);
    } catch (e) {
        return { ok: false, errors: [{ code: 'TABLE_INVALID', id: null, message: _msg(e) }] };
    }

    const errors = [];
    const seenIdToIndex = new Map();
    /** 只有结构合格（cost 合法、档位可判定）的条目才参与 ⑧⑨ 的排序类判定 */
    const ranked = [];

    list.forEach((item, index) => {
        const at = `#${index}`;
        if (!_isPlainObject(item)) {
            errors.push({
                code: 'RECIPE_NOT_OBJECT',
                id: null,
                message: `第 ${at} 条不是对象：每条弹药配方必须是五字段对象 { ${RECIPE_FIELDS.join(', ')} }，实测 ${_raw(item)}`,
            });
            return;
        }
        const id = (typeof item.id === 'string' && item.id !== '') ? item.id : null;
        if (id === null) {
            errors.push({
                code: 'MISSING_FIELD',
                id: null,
                message: `第 ${at} 条的 id 必须是非空字符串（配方对象不许拿裸名 recipe 当 id），实测 ${_raw(item.id)}`,
            });
        }

        // ② 五字段齐
        for (const field of RECIPE_FIELDS) {
            if (!Object.prototype.hasOwnProperty.call(item, field)) {
                errors.push({
                    code: 'MISSING_FIELD',
                    id,
                    message: `配方 ${id === null ? at : `"${id}"`} 缺字段 "${field}"：五字段必须齐 { ${RECIPE_FIELDS.join(', ')} }`,
                });
            }
        }
        // ②' 已删除字段不许出现（`damageMult` 等）：删除的字段一律判红，不许静默忽略后「看起来还能跑」
        for (const field of REMOVED_RECIPE_FIELDS) {
            if (Object.prototype.hasOwnProperty.call(item, field)) {
                errors.push({
                    code: 'REMOVED_FIELD',
                    id,
                    message: `配方 ${id === null ? at : `"${id}"`} 出现已删除字段 "${field}"（实测 ${_raw(item[field])}）：`
                        + `${REMOVED_FIELD_REASONS[field] || '该字段已从配方结构里删除'}`,
                });
            }
        }
        // ② displayName
        if (Object.prototype.hasOwnProperty.call(item, 'displayName')
            && (typeof item.displayName !== 'string' || item.displayName === '')) {
            errors.push({
                code: 'BAD_DISPLAY_NAME',
                id,
                message: `配方 "${id}" 的 displayName 必须是非空字符串，实测 ${_raw(item.displayName)}`,
            });
        }

        // ③ cost
        let costOk = false;
        if (Object.prototype.hasOwnProperty.call(item, 'cost')) {
            const costCheck = validateShotCost(item.cost);
            costOk = costCheck.ok;
            for (const detail of costCheck.errors) {
                errors.push({
                    code: 'BAD_COST',
                    id,
                    message: `配方 "${id}" 的 cost 不合法：${detail}`,
                });
            }
        }

        // ④ elements
        if (!_isPlainObject(item.elements)) {
            errors.push({
                code: 'BAD_ELEMENTS',
                id,
                message: `配方 "${id}" 的 elements 必须是对象 { ${ELEMENT_KEYS.join(', ')} }，实测 ${_raw(item.elements)}`,
            });
        } else {
            for (const key of Object.keys(item.elements)) {
                if (!ELEMENT_KEYS.includes(key)) {
                    errors.push({
                        code: 'BAD_ELEMENTS',
                        id,
                        message: `配方 "${id}" 的未知元素键 "${key}"（值 ${_raw(item.elements[key])}）：只允许 ${ELEMENT_KEYS.join(' / ')}`,
                    });
                    continue;
                }
                const layer = Number(item.elements[key]);
                if (!Number.isInteger(layer) || layer < 0) {
                    errors.push({
                        code: 'BAD_ELEMENTS',
                        id,
                        message: `配方 "${id}" 的元素键 "${key}" 的初始层数必须是 ≥ 0 的整数，实测 ${_raw(item.elements[key])}`,
                    });
                }
            }
            for (const key of ELEMENT_KEYS) {
                if (!Object.prototype.hasOwnProperty.call(item.elements, key)) {
                    errors.push({
                        code: 'BAD_ELEMENTS',
                        id,
                        message: `配方 "${id}" 的 elements 缺键 "${key}"：0 层也要显式写（六个键并排读，缺键看不出是 0 还是漏配）`,
                    });
                }
            }
        }

        // ⑥ blueprintRequired
        if (Object.prototype.hasOwnProperty.call(item, 'blueprintRequired')
            && typeof item.blueprintRequired !== 'boolean') {
            errors.push({
                code: 'BAD_BLUEPRINT_FLAG',
                id,
                message: `配方 "${id}" 的 blueprintRequired 必须是布尔，实测 ${_raw(item.blueprintRequired)}`,
            });
        }

        // ⑦ 档位
        let tier = null;
        if (costOk) {
            try {
                tier = resolveTier(item.cost);
            } catch (e) {
                errors.push({
                    code: 'TIER_OUT_OF_RANGE',
                    id,
                    message: `配方 "${id}" 的档位无法判定：${_msg(e)}`,
                });
            }
        }
        if (tier !== null && Object.prototype.hasOwnProperty.call(item, 'tier')) {
            if (item.tier !== tier) {
                errors.push({
                    code: 'TIER_MISMATCH',
                    id,
                    message: `配方 "${id}" 自带 tier ${_raw(item.tier)}，与 cost 正数料键数推导的档位 "${tier}" 不一致`
                        + '（档位只由「用几种料」决定，不许手写；本字段本就不该出现在五字段里）',
                });
            }
        }

        // ⑧ id 唯一
        if (id !== null) {
            if (seenIdToIndex.has(id)) {
                errors.push({
                    code: 'DUPLICATE_ID',
                    id,
                    message: `弹药配方 id "${id}" 重复：第 #${seenIdToIndex.get(id)} 条与 ${at} 条同名（存档按 id 冻结到本波，重名会让冻结记录指向不明）`,
                });
            } else {
                seenIdToIndex.set(id, index);
            }
        }

        if (costOk && tier !== null) {
            ranked.push({
                id: String(id === null ? at : id),
                index,
                tier,
                totalCost: sumRecipeCost(item.cost),
            });
        }
    });

    // ⑧ 最低档满足 C10（最低档＝cost 总量最小者，并列取 id 字典序最小）
    if (ranked.length > 0) {
        const floorRow = ranked
            .slice()
            .sort((a, b) => (a.totalCost - b.totalCost) || _cmpStr(a.id, b.id))[0];
        const floorCheck = validateFloorTierCost(list[floorRow.index].cost);
        if (!floorCheck.ok) {
            for (const detail of floorCheck.errors) {
                errors.push({
                    code: 'FLOOR_TIER_VIOLATION',
                    id: floorRow.id,
                    message: `最低档（单发成本总量最小 = ${floorRow.totalCost}）配方 "${floorRow.id}" 不满足 C10：${detail}`
                        + `（C10 是 [约束]：${FLOOR_BUCKET} 上 ≤ ${BASIC_FLOOR_PER_WAVE} 且其它料 = 0，`
                        + '否则"每波至少打得出 1 发"直接破）',
                });
            }
        }
    }

    // ⑨ 跨档成本同向（`：221`「料多一档，单发成本也涨…否则高档配方恒优、低档配方成死档」）
    //   原「同档倍率必须全等」（TIER_MULT_MISMATCH）与「跨档倍率单调」（DAMAGE_MULT_MONOTONIC）两条已随
    //   `damageMult` 一起删除：字段不在结构里，这两条没有检查对象；字段复活由 ②' 的 REMOVED_FIELD 拦住。
    const byTier = {};
    for (const tier of TIER_ORDER) byTier[tier] = [];
    for (const row of ranked) byTier[row.tier].push(row);
    //   取严口径：高档**每一条**的成本总量都要 > 低档**每一条**（即 min(高档) > max(低档)），
    //   不是只比最低/最高那一条——否则同档内会留下比低档还便宜的高档条目。
    for (let i = 1; i < TIER_ORDER.length; i += 1) {
        const lowerTier = TIER_ORDER[i - 1];
        const upperTier = TIER_ORDER[i];
        const lowerGroup = byTier[lowerTier];
        const upperGroup = byTier[upperTier];
        if (lowerGroup.length === 0 || upperGroup.length === 0) continue;
        const lowerMax = lowerGroup.reduce((acc, row) => (row.totalCost > acc.totalCost ? row : acc), lowerGroup[0]);
        const upperMin = upperGroup.reduce((acc, row) => (row.totalCost < acc.totalCost ? row : acc), upperGroup[0]);
        if (upperMin.totalCost <= lowerMax.totalCost) {
            errors.push({
                code: 'COST_MULT_NOT_ALIGNED',
                id: upperMin.id,
                message: `跨档成本未同向抬高：低档（${describeRecipeTier(lowerTier)} "${lowerMax.id}"）的单发成本总量 ${lowerMax.totalCost}，`
                    + `高档（${describeRecipeTier(upperTier)} "${upperMin.id}"）最低只有 ${upperMin.totalCost}`
                    + `（必须 > ${lowerMax.totalCost}）：§5.2 :221「料多一档，单发成本也涨」，否则高档恒优、低档成死档`,
            });
        }
    }

    return { ok: errors.length === 0, errors };
}
