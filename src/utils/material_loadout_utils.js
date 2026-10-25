/**
 * material_loadout_utils.js - [REQ-20261022-wave-loop · 经济接线 v2] 「每回合能打几发」的纯函数层。
 *
 * 施工依据：`docs/design/economy_wiring_spec_v2_corrections.md`（下称「订正件」），
 *   本文件只做订正件附录 C-3 **第 1 步**（纯函数层）：`pickBindingLimit`、逐料 `M`、只加保底的纯函数。
 *   第 2 步（配置层）之后才接线，本文件**不读 CONFIG、不读 this、不碰任何既有文件**。
 *
 * 口径（逐条对应订正件，实现不得自行改数）：
 *   - **发数**（订正 C1「订正后写法」，替换 v2 §4.1 `:157-163`）：
 *       N = min(A, U, E, M)，且 N ≥ 0（整数）
 *       A = 射速轨上限 = max(1, floor(baseShots + 射速级))   [盘上] 基础 2 + 每级 1，3 级 ⇒ 2..5
 *       U = 弹药工坊产能上限                                取值域 1..5，**初始值必须 < 5**
 *       E = floor(可用电力 / 每发耗电)
 *       M = min over m where cost[m] > 0 of floor(stock[m] / cost[m])
 *     `A` **不由本模块算**（调用方传入，`src/utils/build_economy_utils.js:263` 那条既有算式不动）；
 *     本模块只负责 `U` 的校验、`E` 的取整、`M` 的逐料最小值与四条的合成。
 *   - **`M` 逐料取最小**（订正 C2）：只对 `cost[m] > 0` 的料比较（否则除零）；单料配方向
 *     `floor(stock / cost)` 退化，与盘上 `planLoadout`（`material_economy_utils.js:262`）在单料口径下逐值相同。
 *   - **`卡材料` 必须落到具体料键**（订正 C2「连带必须替换的两处」②）：`ties` 里出现 `M` 时，
 *     `bindingMaterialKeys` 非空，`describeBinding` 会把它拼成 `卡材料·pyro`；裸 `卡材料` 直接抛错。
 *   - **并列按固定顺序输出**（订正 C1 / §6.3）：`LIMIT_KEYS = ['A','U','E','M']`，顺序**只作稳定输出**、
 *     不表达优先级；`bound = ties[0]` 只作展示与统计口径。
 *   - **料键边界**（`material_economy_utils.js:39-43`）：只允许 `pyro` / `cryo` 入配方；
 *     `beast`「只用于建设，不得用于造弹」（`:42` 原文），出现即报错；第三种料键同样报错
 *     （订正 C6：两档 + 一行预留，不放开 `beast`）。
 *   - **最低档硬约束**（订正 C10）：最低档必须在 `FLOOR_BUCKET`（`pyro`）上 `cost ≤ 3`，其它料 `cost = 0`。
 *     反例：最低档 `{ pyro: 1, cryo: 2 }` 且 `cryo` 库存 0 ⇒ `M = 0`，破「每波至少 1 发」。硬编码进校验函数。
 *   - **干回合**（订正 C13 / 附录 C-1 路 A）：干回合不挖、不扣料、沿用上一回合冻结的 `N`、**保底照给**。
 *     只加保底的纯函数 `grantFloorOnly` **不读任何命中计数**，因此结构上不会像
 *     `mat_settleWaveMaterials` 那样把上一波残留的 `coloredHits` 再结一次
 *     （`material_economy_utils.js:192-193` 原文：「同一波重复调用会重复入料」）。
 *     数值上等价于路 B（先 reset 再 settle：`units = floor(0 / per) = 0` ⇒ 结果 `FLOOR + 0`）。
 *
 * 纯函数约束：不读 `this`、不读全局、无副作用、不吃随机数；所有输入显式传入、所有输出显式返回；
 *   不修改入参（账本经 `normalizeLedger` 归一后另行返回）。
 *   本文件只 import 小纯函数模块 `material_economy_utils.js`（不 import config / game_*），node 可直接跑单测。
 *
 * 命名纪律（附录 C-2「命名风险」）：`recipe` 一词在盘上已指「单发子弹配方对象」
 *   （`src/calc_utils.js:332`、`src/ui/hud.js:623`、`src/ui_system.js:1559`），**本文件不出现该词**，
 *   载体名一律写中性字段 `costByMaterial` / `perMaterial`。
 */

import {
    BASIC_FLOOR_PER_WAVE,
    BEAST_MATERIAL_KEY,
    FLOOR_BUCKET,
    MATERIAL_KEYS,
    PEG_MATERIAL_KEYS,
    addMaterial,
    normalizeLedger,
} from './material_economy_utils.js';

/** 四条上限的**固定输出顺序**（只作稳定展示与统计口径，不表达优先级；`bound = ties[0]`）。 */
export const LIMIT_KEYS = ['A', 'U', 'E', 'M'];

/** 每条上限的玩家可读文案（订正 C1 第 3 项判据表）。`M` 由 `describeBinding` 拼接料键。 */
export const LIMIT_LABELS = {
    A: '卡射速',
    U: '卡产能',
    E: '卡电',
};

/** `U` 的取值域下限（订正 C1 ③「取值域 1..5」）。 */
export const WORKSHOP_CAPACITY_MIN = 1;
/** `U` 的取值域上限（订正 C1 ③）。 */
export const WORKSHOP_CAPACITY_MAX = 5;
/** `U` 的**初始**上限（订正 C1 ③「初始值必须 < 5」，`U ≥ 5` 一建就把射速轨架空）。 */
export const WORKSHOP_CAPACITY_INITIAL_MAX = 4;

function _isPlainObject(v) {
    return !!v && typeof v === 'object' && !Array.isArray(v);
}

function _int(v, fallback = 0) {
    const n = Math.floor(Number(v));
    return Number.isFinite(n) ? n : fallback;
}

/** 非负整数（负值/NaN 归 0）。 */
function _nonNegInt(v) {
    return Math.max(0, _int(v, 0));
}

/**
 * 校验「每发对每种料的需求量」（`costByMaterial`）。
 * 硬约束（不写在注释里、写在代码里）：
 *   ① 必须是对象，键只能是 `MATERIAL_KEYS` 里的三个；
 *   ② `beast` 一律拒绝（`material_economy_utils.js:42`「只用于建设，不得用于造弹」）；
 *   ③ 第三种料键（既不是 pyro / cryo / beast 的键，或既非 `PEG_MATERIAL_KEYS` 的键）一律拒绝（订正 C6）；
 *   ④ 每键必须是 **≥ 0 的整数**；
 *   ⑤ 至少一种料的 `cost > 0`（全 0 的配方算不出 `M`，也违反了「必须显式声明每发需求量」）。
 * 未点名的料键视为 0 需求（订正 C2 ① / 附录 C-2「只有被点名的料键才收」）。
 * @param {object} costByMaterial - 形如 `{ pyro: 3 }` / `{ pyro: 1, cryo: 2 }`
 * @returns {{ ok:boolean, errors:string[] }} 非抛错版本，供配置层 / UI 预校验
 */
export function validateShotCost(costByMaterial) {
    if (!_isPlainObject(costByMaterial)) {
        return { ok: false, errors: ['costByMaterial 必须是对象（如 { pyro: 3 }）；未点名的料视为 0 需求'] };
    }
    const errors = [];
    let total = 0;
    for (const key of Object.keys(costByMaterial)) {
        if (!MATERIAL_KEYS.includes(key)) {
            errors.push(`未知料键 "${key}"：只允许 ${PEG_MATERIAL_KEYS.join(' / ')} 造弹；第三种料键属预留档，本轮不放开（订正 C6）`);
            continue;
        }
        if (key === BEAST_MATERIAL_KEY) {
            errors.push(`"${BEAST_MATERIAL_KEY}" 只用于建设、不得用于造弹；配方里出现 "${BEAST_MATERIAL_KEY}" 一律拒绝`);
            continue;
        }
        if (!PEG_MATERIAL_KEYS.includes(key)) {
            errors.push(`料键 "${key}" 不在可造弹集合 ${PEG_MATERIAL_KEYS.join(' / ')} 内`);
            continue;
        }
        const n = Number(costByMaterial[key]);
        if (!Number.isFinite(n)) {
            errors.push(`"${key}" 的每发需求量必须是有穷数，实测 ${String(costByMaterial[key])}`);
            continue;
        }
        if (!Number.isInteger(n)) {
            errors.push(`"${key}" 的每发需求量必须是整数，实测 ${n}`);
            continue;
        }
        if (n < 0) {
            errors.push(`"${key}" 的每发需求量不得为负，实测 ${n}`);
            continue;
        }
        total += n;
    }
    if (errors.length === 0 && total <= 0) {
        errors.push('配方必须显式声明每发对每种料的需求量：至少一种料的 cost 必须 > 0（全 0 的配方算不出 M）');
    }
    return { ok: errors.length === 0, errors };
}

/**
 * 逐料最小发数 `M`（订正 C2）：
 *   M = min over m where cost[m] > 0 of floor(stock[m] / cost[m])
 * 单料退化：`cost = { pyro: 3 }` ⇒ `M = floor(stock.pyro / 3)`。
 * `cost[m] = 0` 的料**不参与**比较（否则除零），也不进 `perMaterial`。
 * @param {object} stock - 料余额（`{ pyro, cryo, beast }`，可直接传账本）；负值/NaN 按 0
 * @param {object} costByMaterial - 每发对每种料的需求量
 * @returns {{ M:number, bindingMaterialKeys:string[], perMaterial:Array<{materialKey:string, cost:number, stock:number, shots:number}> }}
 *          `M` 为整数；`bindingMaterialKeys` 是**所有**取到最小值的料键（并列全留，按 `PEG_MATERIAL_KEYS` 顺序）
 * @throws {TypeError} 配方成本不合法（`beast` / 第三种料键 / 负值 / 全 0）——调用方应先 `validateShotCost`
 */
export function computeMaterialShots(stock, costByMaterial) {
    const check = validateShotCost(costByMaterial);
    if (!check.ok) {
        throw new TypeError(`[computeMaterialShots] 配方成本不合法：${check.errors.join('；')}`);
    }
    const s = _isPlainObject(stock) ? stock : {};
    const perMaterial = [];
    let M = Number.POSITIVE_INFINITY;
    for (const key of PEG_MATERIAL_KEYS) {
        if (!Object.prototype.hasOwnProperty.call(costByMaterial, key)) continue;
        const cost = _nonNegInt(costByMaterial[key]);
        if (cost <= 0) continue; // cost[m] = 0 不参与（订正 C2 ①）
        const have = _nonNegInt(s[key]);
        const shots = Math.floor(have / cost);
        perMaterial.push({ materialKey: key, cost, stock: have, shots });
        if (shots < M) M = shots;
    }
    const bindingMaterialKeys = perMaterial.filter(p => p.shots === M).map(p => p.materialKey);
    return { M, bindingMaterialKeys, perMaterial };
}

/**
 * 电力能支撑的发数 `E = floor(可用电力 / 每发耗电)`（订正 C1 / C7）。
 * 合成器产电、电池存量、设施耗电的**接线**属第 3 步，本函数只吃「可用电力」这个已经算好的数。
 * @param {number} availablePower - 可用电力（发电 + 合成器本波实产电 + 电池存量 − 设施本波耗电合计）
 * @param {number} powerPerShot - 每发耗电（盘上不存在的新键，值 `[待标定]`）
 * @returns {number} `E`（≥ 0 的整数）；可用电力为负按 0
 * @throws {RangeError} `每发耗电` 不是 > 0 的有穷数（除零/负数是配置缺陷，不许静默给 0）
 */
export function computePowerShots(availablePower, powerPerShot) {
    const per = Number(powerPerShot);
    if (!Number.isFinite(per) || per <= 0) {
        throw new RangeError(`[computePowerShots] 每发耗电必须是 > 0 的有限数，实测 ${String(powerPerShot)}`);
    }
    const avail = Math.max(0, Number.isFinite(Number(availablePower)) ? Math.floor(Number(availablePower)) : 0);
    return Math.floor(avail / per);
}

/**
 * 校验弹药工坊产能 `U`（订正 C1 ③，**硬约束不是可调项**）：
 *   ① 整数；
 *   ② 落在 `1..5`；
 *   ③ **初始值必须 < 5**（默认按「初始配置」校验，即 `{ initial: true }`）。
 * 已建成的运行时取值若可以是 5，调用方须显式传 `{ initial: false }`——默认值取严，配错宁可判红。
 * @param {number} capacity
 * @param {{ initial?:boolean }} [opts] - `initial` 默认 `true`
 * @returns {{ ok:boolean, errors:string[], value:number }}
 */
export function validateWorkshopCapacity(capacity, opts = {}) {
    const isInitial = opts && opts.initial !== undefined ? opts.initial === true : true;
    const errors = [];
    const n = Number(capacity);
    if (!Number.isFinite(n)) {
        errors.push(`U 必须是有穷数，实测 ${String(capacity)}`);
    } else if (!Number.isInteger(n)) {
        errors.push(`U 必须是整数，实测 ${n}`);
    } else {
        if (n < WORKSHOP_CAPACITY_MIN || n > WORKSHOP_CAPACITY_MAX) {
            errors.push(`U 的取值域是 ${WORKSHOP_CAPACITY_MIN}..${WORKSHOP_CAPACITY_MAX}，实测 ${n}`);
        }
        if (isInitial && n > WORKSHOP_CAPACITY_INITIAL_MAX) {
            errors.push(`初始 U 必须 < ${WORKSHOP_CAPACITY_MAX}（实测 ${n}）：U ≥ ${WORKSHOP_CAPACITY_MAX} 一建就把射速轨架空（订正 C1 ③）`);
        }
    }
    return { ok: errors.length === 0, errors, value: Number.isFinite(n) ? n : 0 };
}

/**
 * 最低档配方的硬约束（订正 C10，**`[约束]` 不是待标定数**）：
 *   ① 结构合法（`validateShotCost` 全过）；
 *   ② `cost[FLOOR_BUCKET]`（`pyro`）**≥ 1** 且 **≤ 上限**（默认 `BASIC_FLOOR_PER_WAVE` = 3）；
 *   ③ 其它可造弹料（`cryo`）的 `cost` **必须为 0**。
 * 为什么 ③ 不能省：保底 3 料全落 `pyro`（`material_economy_utils.js:49`），若最低档为 `{ pyro: 1, cryo: 2 }`
 * 而 `cryo` 库存 0，逐料最小值给出 `M = min(floor(1/1), floor(0/2)) = 0`，直接破「每波至少打得出 1 发」。
 * 高档配方单发成本可 > 3（风险由玩家自担），但最低档必须始终付得起 1 发。
 * @param {object} costByMaterial - 最低档配方的每发需求量
 * @param {{ floorCostCap?:number }} [opts] - 缺省上限取 `BASIC_FLOOR_PER_WAVE`（3）
 * @returns {{ ok:boolean, errors:string[], floorCost:number, cap:number }}
 */
export function validateFloorTierCost(costByMaterial, opts = {}) {
    const cap = opts && opts.floorCostCap !== undefined ? _nonNegInt(opts.floorCostCap) : BASIC_FLOOR_PER_WAVE;
    const check = validateShotCost(costByMaterial);
    if (!check.ok) {
        return { ok: false, errors: check.errors.slice(), floorCost: 0, cap };
    }
    const errors = [];
    const floorCost = _nonNegInt(costByMaterial[FLOOR_BUCKET]);
    if (floorCost < 1) {
        errors.push(`最低档必须在 ${FLOOR_BUCKET} 上 cost ≥ 1（保底料只落 ${FLOOR_BUCKET}），实测 ${floorCost}`);
    } else if (floorCost > cap) {
        errors.push(`最低档在 ${FLOOR_BUCKET} 上的 cost 必须 ≤ ${cap}（= 每波保底料），实测 ${floorCost}：否则保底付不起 1 发`);
    }
    for (const key of PEG_MATERIAL_KEYS) {
        if (key === FLOOR_BUCKET) continue;
        const n = _nonNegInt(costByMaterial[key]);
        if (n !== 0) {
            errors.push(`最低档的其它料 "${key}" 的 cost 必须为 0（保底料不落该桶），实测 ${n}`);
        }
    }
    return { ok: errors.length === 0, errors, floorCost, cap };
}

/**
 * 合成四条上限：`N = min(A, U, E, M)`，`N ≥ 0`（订正 C1 / §6.3 `pickBindingLimit`）。
 * 四条**必须都给**：缺一条或给 NaN 一律抛错——静默当 0 会让 `N = 0` 触发
 * `src/game_phase.js:1578-1582` 的白补 1 发，把配置缺陷伪装成玩法（订正 C9）。
 * `M` 可以是 `Infinity`（配方无料需求时料不构成闸门），其余三条必须是有限整数。
 * @param {{ rate:number, capacity:number, power:number, materials:number, bindingMaterialKeys?:string[] }} input
 *        `rate`=A（调用方算好的射速轨上限）、`capacity`=U、`power`=E、`materials`=M
 * @returns {{ N:number, bound:string, ties:string[], limitValues:{A:number,U:number,E:number,M:number}, bindingMaterialKeys:string[] }}
 *          `ties` 按 `LIMIT_KEYS` 固定顺序，**保留全部并列项**；`bound = ties[0]` 只作展示与统计口径
 * @throws {TypeError|RangeError} 缺参数 / NaN / 四条全为无穷
 */
export function pickBindingLimit(input = {}) {
    const names = { A: 'rate', U: 'capacity', E: 'power', M: 'materials' };
    const limitValues = {};
    for (const key of LIMIT_KEYS) {
        const param = names[key];
        const v = input ? input[param] : undefined;
        if (v === undefined || v === null) {
            throw new TypeError(`[pickBindingLimit] 缺少 ${param}（= ${key}）：四条上限必须全部给出，缺一条不得静默当 0`);
        }
        if (v === Number.POSITIVE_INFINITY) {
            limitValues[key] = Number.POSITIVE_INFINITY;
            continue;
        }
        const n = Number(v);
        if (!Number.isFinite(n)) {
            throw new TypeError(`[pickBindingLimit] ${param}（= ${key}）必须是有穷数或 Infinity，实测 ${String(v)}`);
        }
        limitValues[key] = _nonNegInt(n);
    }
    const N = Math.min(limitValues.A, limitValues.U, limitValues.E, limitValues.M);
    if (!Number.isFinite(N)) {
        throw new RangeError('[pickBindingLimit] 四条上限全为无穷，无法确定 N：A 必须由调用方给出有限值');
    }
    const ties = LIMIT_KEYS.filter(key => limitValues[key] === N);
    return {
        N,
        bound: ties[0],
        ties,
        limitValues,
        bindingMaterialKeys: Array.isArray(input.bindingMaterialKeys) ? input.bindingMaterialKeys.slice() : [],
    };
}

/**
 * 把 `ties` 翻成玩家可读的「卡在哪条」（订正 C1 第 3 项判据表 + C2 的料键要求）。
 * 规则：
 *   - 单条命中 ⇒ 该条的文案（`卡射速` / `卡产能` / `卡电` / `卡材料·<料名>`）；
 *   - 四条全等 ⇒ `四条并列`（订正 C1 第 3 项那一格）；
 *   - 其余并列（2～3 条）⇒ `并列（<逐条文案以 · 连接>）`——**订正件没定这一格**，本实现的取法见文件末尾「歧义登记」。
 * `M` 命中时**必须**带具体料键：`bindingMaterialKeys` 为空直接抛错，禁止裸「卡材料」（订正 C2）。
 * @param {{ N:number, ties:string[], bindingMaterialKeys?:string[] }} input
 * @returns {{ label:string, labels:string[], isTie:boolean, allEqual:boolean }}
 */
export function describeBinding(input = {}) {
    const list = Array.isArray(input.ties) ? input.ties.filter(k => LIMIT_KEYS.includes(k)) : [];
    if (list.length === 0) {
        throw new TypeError('[describeBinding] ties 为空：至少要有一条上限等于 N');
    }
    const labels = [];
    for (const key of LIMIT_KEYS) {
        if (!list.includes(key)) continue;
        if (key === 'M') {
            const given = Array.isArray(input.bindingMaterialKeys) ? input.bindingMaterialKeys : [];
            const keys = PEG_MATERIAL_KEYS.filter(k => given.includes(k));
            if (keys.length === 0) {
                throw new TypeError('[describeBinding] 卡材料必须落到具体料键（如 卡材料·pyro），不许只写「卡材料」');
            }
            for (const k of keys) labels.push(`卡材料·${k}`);
            continue;
        }
        labels.push(LIMIT_LABELS[key]);
    }
    const allEqual = list.length === LIMIT_KEYS.length;
    let label;
    if (allEqual) label = '四条并列';
    else if (labels.length === 1) label = labels[0];
    else label = `并列（${labels.join('·')}）`;
    return { label, labels, isTie: list.length > 1, allEqual };
}

/**
 * 本回合「能打几发」的合成入口（纯函数）：一次算完 `A / U / E / M`、`N`、卡在哪条、料逐桶明细。
 * 这是第 6 步（预演 + 冻结记录）与第 8 步（UI）唯一该调的入口；第 1 步只把它做出来、不接线。
 * `E` 两种给法：直接给 `power`（已算好的 E），或给 `availablePower` + `powerPerShot` 由本函数取整；
 * 两者都给时以 `power` 为准（避免双口径）。
 * @param {{
 *   rateShots:number, workshopCapacity:number,
 *   power?:number, availablePower?:number, powerPerShot?:number,
 *   stock:object, costByMaterial:object
 * }} input
 * @returns {{
 *   N:number, A:number, U:number, E:number, M:number,
 *   bound:string, ties:string[], label:string, labels:string[],
 *   bindingMaterialKeys:string[],
 *   perMaterial:Array<{materialKey:string, cost:number, stock:number, shots:number}>
 * }}
 */
export function resolveShotsPerTurn(input = {}) {
    const mat = computeMaterialShots(input.stock, input.costByMaterial);
    const E = input.power !== undefined
        ? _nonNegInt(input.power)
        : computePowerShots(input.availablePower, input.powerPerShot);
    const picked = pickBindingLimit({
        rate: input.rateShots,
        capacity: input.workshopCapacity,
        power: E,
        materials: mat.M,
        bindingMaterialKeys: mat.bindingMaterialKeys,
    });
    const desc = describeBinding({
        N: picked.N,
        ties: picked.ties,
        bindingMaterialKeys: picked.bindingMaterialKeys,
    });
    return {
        N: picked.N,
        A: picked.limitValues.A,
        U: picked.limitValues.U,
        E: picked.limitValues.E,
        M: picked.limitValues.M,
        bound: picked.bound,
        ties: picked.ties,
        label: desc.label,
        labels: desc.labels,
        bindingMaterialKeys: picked.bindingMaterialKeys,
        perMaterial: mat.perMaterial,
    };
}

/**
 * 按「实际造弹量」逐料扣料（订正 C2 的逐料口径 + 订正 C1 ⑤「配多了不扣料」）。
 * **只扣实际造出来的发数**：入参 `shots` 是已经由 `resolveShotsPerTurn` 定下的 `N`，
 * 玩家配置的「配方配置发数」`X` 根本不出现在扣料公式里 ⇒ `A < X` 时多出来的发数**不会被造出来、也不扣料**，
 * 这是结构保证，不是调用纪律。发数不足时按 `M` 截断（与盘上 `planLoadout` 的 `min(want, affordable)` 同义，
 * 但分母改成逐料，不再用 `pyro + cryo` 加总池）。
 * 同 round 去重属运行时（`src/material_system.js:122` `_materialLoadRound`），不在纯函数层。
 * @param {object} ledger - 料账本（也接受任何带 pyro/cryo 的余额对象）
 * @param {{ shots:number, costByMaterial:object }} input
 * @returns {{ ledger:object, chargedShots:number, requestedShots:number, shortfall:number,
 *             spent:{pyro:number, cryo:number}, spentTotal:number,
 *             perMaterial:Array<{materialKey:string, cost:number, stock:number, shots:number}> }}
 * @throws {TypeError} 配方成本不合法
 */
export function chargeShotMaterials(ledger, input = {}) {
    const base = normalizeLedger(ledger);
    const check = validateShotCost(input.costByMaterial);
    if (!check.ok) {
        throw new TypeError(`[chargeShotMaterials] 配方成本不合法：${check.errors.join('；')}`);
    }
    const want = _nonNegInt(input.shots);
    const mat = computeMaterialShots(base, input.costByMaterial);
    const chargedShots = Math.min(want, mat.M);
    const spent = { pyro: 0, cryo: 0 };
    let spentTotal = 0;
    const next = { ...base };
    for (const row of mat.perMaterial) {
        const cost = row.cost * chargedShots;
        if (cost <= 0) continue;
        next[row.materialKey] = base[row.materialKey] - cost;
        spent[row.materialKey] = cost;
        spentTotal += cost;
    }
    next.loadedShots = chargedShots;
    next.loadRequestedShots = want;
    return {
        ledger: next,
        chargedShots,
        requestedShots: want,
        shortfall: want - chargedShots,
        spent,
        spentTotal,
        perMaterial: mat.perMaterial,
    };
}

/**
 * 只加保底的纯函数（订正件附录 C-1 **路 A**；干回合专用）。
 * 只做「`basicFloorPerWave`（`3` `[盘上]`，`src/config.js:1008`）入 `FLOOR_BUCKET`（`pyro`）」这一件事：
 *   - **不读任何命中计数**（不碰 `coloredHits` / `primaryHits` / `coloredHitsByBucket`）⇒ 结构上不会重复入料；
 *   - **不复用 / 不调用** `settleWaveMaterials`（那个函数会把残留 `coloredHits` 再算一次）；
 *   - 归账等价于 `settleWaveMaterials` 的保底分支（`material_economy_utils.js:212-218` 走 `addMaterial`），
 *     因此 `producedThisWave` 同样 +FLOOR，与路 B（先 reset 再 settle）数值一致。
 * 去重（`_materialFloorRound`，**不得借用 `_materialSettleRound`**）属运行时，纯函数层不做。
 * @param {object} ledger
 * @param {{ basicFloorPerWave?:number }} [opts] - 缺省取 `BASIC_FLOOR_PER_WAVE`（3）
 * @returns {{ ledger:object, granted:number, key:string, floor:number }}
 */
export function grantFloorOnly(ledger, opts = {}) {
    const base = normalizeLedger(ledger);
    const floor = opts && opts.basicFloorPerWave !== undefined
        ? _nonNegInt(opts.basicFloorPerWave)
        : BASIC_FLOOR_PER_WAVE;
    if (floor <= 0) return { ledger: base, granted: 0, key: FLOOR_BUCKET, floor: 0 };
    const res = addMaterial(base, FLOOR_BUCKET, floor);
    return { ledger: res.ledger, granted: res.granted, key: FLOOR_BUCKET, floor };
}

/**
 * 干回合结算（订正 C13）：**不挖、不扣料、沿用上一回合冻结的 `N`、保底照给**。
 * - `N` 必须来自冻结记录；缺记录属缺陷（订正 C8），**抛错而不是给 0**——
 *   给 0 会立刻触发 `src/game_phase.js:1579-1582` 白补 1 发，干回合反而每回只打 1 发（决策本 `:178` 已记此坑）。
 * - `spent` 恒为 0：干回合不造弹、不扣料（弹数是沿用的，料已经在上一回合付过）。
 * - 保底走 `grantFloorOnly`（路 A），不走 `settleWaveMaterials`。
 * @param {{ previous?:{N:number, bound?:string, ties?:string[]}, ledger:object, basicFloorPerWave?:number }} input
 * @returns {{ N:number, bound:(string|null), ties:string[], dry:boolean, charged:boolean,
 *             spent:{pyro:number, cryo:number}, spentTotal:number,
 *             granted:number, floorBucket:string, ledger:object, zeroShotRisk:boolean }}
 * @throws {TypeError} 冻结记录缺失 / `N` 不是非负整数
 */
export function resolveDryRound(input = {}) {
    const prev = _isPlainObject(input.previous) ? input.previous : null;
    const N = prev ? Number(prev.N) : NaN;
    if (!Number.isFinite(N) || N < 0 || !Number.isInteger(N)) {
        throw new TypeError(`[resolveDryRound] 干回合必须沿用上一回合冻结的 N（缺冻结记录属缺陷，订正 C8），实测 ${String(prev && prev.N)}`);
    }
    const ties = Array.isArray(prev.ties) ? prev.ties.filter(k => LIMIT_KEYS.includes(k)) : [];
    const grant = grantFloorOnly(input.ledger, { basicFloorPerWave: input.basicFloorPerWave });
    const bound = LIMIT_KEYS.includes(prev.bound) ? prev.bound : (ties.length > 0 ? ties[0] : null);
    return {
        N,
        bound,
        ties,
        dry: true,
        charged: false,
        spent: { pyro: 0, cryo: 0 },
        spentTotal: 0,
        granted: grant.granted,
        floorBucket: grant.key,
        ledger: grant.ledger,
        // 干回合必须发 N 发；N = 0 会落到白补 1 发的异常路径（订正 C9），调用方据此打日志并计数。
        zeroShotRisk: N === 0,
    };
}

/*
 * 歧义登记（施工时读规格没找到对应条文、按以下解释实现；如需改口径请改规格、别改本文件）：
 *   1. **2～3 条并列**：订正 C1 第 3 项判据表只定义「单条」与「四条并列」两格，未定义部分并列。
 *      本实现输出 `并列（卡射速·卡电）` 这类串，`ties` 仍保留全部命中项；`bound = ties[0]` 供统计。
 *   2. **配方全 0 成本**：订正 C2 ①只说不比较 `cost[m] = 0`，没说「一条都没有」怎么办。
 *      本实现判为非法（`validateShotCost` 报错），因为「配方必须显式声明每发对每种料的需求量」；
 *      `computeMaterialShots` 因此不会返回 `Infinity`，`pickBindingLimit` 仍保留 `Infinity` 通道给将来的无料配方。
 *   3. **未建工坊时 U 的取值**：订正 C1 ③定 `U ∈ 1..5`，但验收项写「0 级工坊时 `U < 5`」，
 *      没写 0 级工坊给 0 还是给 1。本实现：校验函数按 `1..5` 判（spec 原文），
 *      合成函数 `pickBindingLimit` 是全域的（`0` 照算、`bound = 'U'`），不在纯函数层替调用方决定。
 *   4. **「配方配置发数 X」不是一条上限**：订正 C1 ⑤要求「`A < X` 时多出来的不扣料」，
 *      但发数公式里没有 `X`。本实现不让 `X` 进公式（`chargeShotMaterials` 只吃 `N`），
 *      `X` 只作为展示用读数由调用方自己持有。
 */
