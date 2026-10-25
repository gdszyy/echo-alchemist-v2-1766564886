/**
 * material_economy_utils.js - [REQ-20261022-wave-loop · 料闭环] 「料」账本的纯函数。
 *
 * 口径（锁定，实现不得自行改数）：
 *   - 每发主炮弹耗钉盘料 3（冻结单 v3 §3.3）。
 *   - **产出模型**（冻结单 v3 §3.1 / §13-1）：`M = FLOOR + floor(coloredHits / p)`
 *       `p`            = `perHitsPerMaterial`（盘上 2）
 *       `coloredHits`  = 本波**产料钉**（点名 pyro / cryo 的，以及点名 bounce 供 beast 的）的命中次数，由回调逐次计数得出
 *       `FLOOR`        = `basicFloorPerWave`（= c = 3，每波保底，保证每波至少打得出 1 发）
 *     `s`（彩钉命中占比）= `coloredHits / primaryHits`，**运行时由计数得，不是配置常数**
 *     （冻结单 v3 :38「运行时必须由计数得，不是配置常数」）。
 *   - **未点名的钉不产料**：只有 `pegWeights` 里点到 pyro / cryo / beast 桶的钉类型才算产料钉。
 *     盘上是三色口径：点名 `pyro` / `cryo` 的是**盘料钉**（造弹 / 升容量 / 铸符），点名 `bounce` 的供
 *     **第三色料 `beast`**（只用于建设、不参与造弹）；`normal` 等未点名的钉一律只产电。
 *     本版没有「默认桶」兜底（原先的 `DEFAULT_PEG_MATERIAL` 已撤销——它会让无色钉也产料，等于把 s 偷换成 1）。
 *     `lightning` 是**死键**：`src/utils/peg_type_pool.js:20` 的 `RANDOMIZABLE_PEG_TYPES` 不含它，
 *     钉盘根本不刷该钉型，给它写料权重等于给一个不存在的钉配料。
 *   - **料的存量不设上限**（Owner 2026-10-24 23:34「要人玩的爽就别设置材料上限了」）：本文件没有任何容量 /
 *     clip / 丢弃判断，入账只做累加。原「容量 = materialCapShots × 3」的容量档（3⇒9 / 4⇒12 / 5⇒15）整体作废。
 *   - 钉盘料 pyro / cryo 用于造弹、升容量、铸符；怪物料 beast 只用于建设，两者不互换
 *     ⇒ 造弹只从 pyro + cryo 扣，beast 不参与。
 *   - 副球（同一颗钉额外吐出的第二颗球）不得重复计料，也不得计入 primaryHits：调用方传 secondary=true，本层再兜底一次。
 *
 * 约束：本文件不得 import 任何大文件（config.js / game_*.js 等），node 可直接导入做单测；
 *       调用方把 CONFIG 里的数值作为参数传入。所有函数不修改入参（不可变更新）。
 *
 * 账本形状（MaterialLedger）：
 *   {
 *     pyro: number, cryo: number, beast: number,   // 三类余额（无上限；只增，除装填扣料）
 *     producedThisWave: number,                    // 本波料入 M（波末一次结算写入，= FLOOR + 入料次数）
 *     destroyedThisWave: number,                   // 保留字段：本版不设上限，结构上恒为 0（只为读数出口形状稳定）
 *     primaryHits: number,                         // 本波主球碰钉总次数（分母，副球不计）
 *     coloredHits: number,                         // 本波产料钉命中次数（分子）
 *     coloredHitsByBucket: { pyro, cryo, beast },  // 产料钉命中按桶分流（决定入料落到哪个桶）
 *     coloredHitRemainder: number,                 // 上次波末结算弃掉的余数（= coloredHits − 入料次数 × p）
 *     loadedShots: number,                         // 上次装填实际发弹数（料约束下的结果）
 *     loadRequestedShots: number,                  // 上次装填请求的发数（= 装填上限）
 *     spent: { pyro:number, cryo:number },         // [S5] 本波实际扣掉的料（装填扣料时写入；每波开始归零）
 *     spentTotal: number,                          // [S5] = spent.pyro + spent.cryo（结构性恒等，不单独存真值）
 *   }
 *
 * [S5] `spent` 的口径：**本波实际扣掉的料**（不是「本次调用扣了多少」）。写入方只有装填扣料一步
 *   （`planLoadout`，后续第 4/6 步换成 `chargeShotMaterials` 时同样必须写这两个字段）；
 *   `sys_resetWaveMaterialCounters` 在每波开始把它归零 ⇒ 干回合（不挖不扣料）读出全 0，
 *   不会沿用上一波的值。`spentTotal` 由 `spent` 推导，任何路径都不可能出现两者对不上。
 */

/** 三类料的键名（与 config / 存档字段同名，不得另起别名）。 */
export const MATERIAL_KEYS = ['pyro', 'cryo', 'beast'];
/** 钉盘料：可用于造弹 / 升容量 / 铸符。 */
export const PEG_MATERIAL_KEYS = ['pyro', 'cryo'];
/** 怪物料：只用于建设，不得用于造弹。 */
export const BEAST_MATERIAL_KEY = 'beast';
/** 每发主炮弹耗钉盘料（冻结单 v3 §3.3）。config 缺失时的兜底值。 */
export const MATERIALS_PER_SHOT = 3;
/** 每波保底料 FLOOR := c = 3（冻结单 v3 §3.1）。config 缺失时的兜底值。 */
export const BASIC_FLOOR_PER_WAVE = 3;
/** 保底料落哪个桶：钉盘料池起点（planLoadout 先扣 pyro），保证保底一定能造弹。 */
export const FLOOR_BUCKET = 'pyro';

function _int(v, fallback = 0) {
    const n = Math.floor(Number(v));
    return Number.isFinite(n) ? n : fallback;
}

function _nonNeg(v, fallback = 0) {
    return Math.max(0, _int(v, fallback));
}

function _normalizeBucketCounts(counts) {
    const s = counts && typeof counts === 'object' ? counts : {};
    const out = {};
    for (const key of MATERIAL_KEYS) out[key] = _nonNeg(s[key]);
    return out;
}

/** [S5] 本波扣减只涉及钉盘料两桶（beast 不参与造弹），因此 spent 只有 pyro / cryo 两个键。 */
function _normalizeSpent(spent) {
    const s = spent && typeof spent === 'object' ? spent : {};
    return { pyro: _nonNeg(s.pyro), cryo: _nonNeg(s.cryo) };
}

/**
 * 规范化账本（补默认值、深拷贝），保证后续函数可以安全地做不可变更新。
 * @param {object} ledger
 * @returns {object} 新的 MaterialLedger
 */
export function normalizeLedger(ledger = {}) {
    const s = ledger && typeof ledger === 'object' ? ledger : {};
    const spent = _normalizeSpent(s.spent);
    return {
        pyro: _nonNeg(s.pyro),
        cryo: _nonNeg(s.cryo),
        beast: _nonNeg(s.beast),
        producedThisWave: _nonNeg(s.producedThisWave),
        destroyedThisWave: _nonNeg(s.destroyedThisWave),
        primaryHits: _nonNeg(s.primaryHits),
        coloredHits: _nonNeg(s.coloredHits),
        coloredHitsByBucket: _normalizeBucketCounts(s.coloredHitsByBucket),
        coloredHitRemainder: _nonNeg(s.coloredHitRemainder),
        loadedShots: _nonNeg(s.loadedShots),
        loadRequestedShots: _nonNeg(s.loadRequestedShots),
        spent,
        spentTotal: spent.pyro + spent.cryo,
    };
}

/**
 * 新局账本：三类余额取**可选初值**（缺省全 0），本波计数器一律 0。
 *
 * `init` 是可选的三色初值 `{ pyro, cryo, beast }`，运行时来源是
 *   `CONFIG.gameplay.build.startMaterials`（新局启动料，见 `src/material_system.js` 的 `sys_initMaterialLedger()`）。
 * 取值规则：非对象 / 缺键 / 非有限数 / 负数**一律按 0**（经 `_nonNeg`），不猜、不兜底成非 0 默认值。
 *
 * **无参调用必须与历史行为逐字节等价（全 0）**：既有大量测试与运行时懒初始化（如 `if (!this.materialLedger) sys_initMaterialLedger()`）
 * 都靠「无参得全 0」这条；给它任何非 0 默认值，等于把「配置没接上」伪装成「玩家本来就有料」，事后无法归因。
 *
 * 计数项（`producedThisWave` / `destroyedThisWave` / `*Hits` / `loadedShots` / `spent` / `spentTotal`）
 * **不接受初值**：本波还没有发生任何事，只能是 0。
 * @param {{ pyro?:number, cryo?:number, beast?:number }} [init] - 三色启动料（可选）
 * @returns {object} 新的 MaterialLedger
 */
export function createMaterialLedger(init) {
    const s = init && typeof init === 'object' && !Array.isArray(init) ? init : {};
    return normalizeLedger({
        pyro: s.pyro,
        cryo: s.cryo,
        beast: s.beast,
    });
}

/**
 * 钉类型 → 料桶。pegWeights 里点名了 pyro / cryo / beast 就照它落桶；
 * 没点名（normal / bounce / damage / lightning / gray …）返回 null ⇒ **不产料**（本版无默认桶兜底）。
 * @param {string} pegType
 * @param {object} [weights] - CONFIG.gameplay.build.power.materials.pegWeights
 * @returns {string|null} 'pyro' | 'cryo' | 'beast' | null
 */
export function bucketForPegType(pegType, weights) {
    const w = weights && typeof weights === 'object' ? weights[pegType] : null;
    if (w && typeof w === 'object') {
        for (const key of MATERIAL_KEYS) {
            if (Number(w[key]) > 0) return key;
        }
    }
    return null;
}

/**
 * 入账：**纯累加，不截断**。料存量不设上限（Owner 2026-10-24 23:34「要人玩的爽就别设置材料上限了」），
 * 因此这里没有任何 cap / clip / 丢弃判断，`destroyedThisWave` 在本版结构上恒为 0（保留字段只为读数出口形状稳定）。
 * key 不在 MATERIAL_KEYS 内视为「不产料」，granted 返回 0（不落任何桶）。
 * @param {object} ledger
 * @param {string} key - 'pyro' | 'cryo' | 'beast'
 * @param {number} amount
 * @returns {{ ledger:object, granted:number, destroyed:number, key:(string|null) }}
 */
export function addMaterial(ledger, key, amount) {
    const base = normalizeLedger(ledger);
    const bucket = MATERIAL_KEYS.includes(key) ? key : null;
    const granted = bucket ? _nonNeg(amount) : 0;
    if (!bucket || granted <= 0) return { ledger: base, granted: 0, destroyed: 0, key: bucket };
    return {
        ledger: {
            ...base,
            [bucket]: base[bucket] + granted,
            producedThisWave: base.producedThisWave + granted,
        },
        granted,
        destroyed: 0,
        key: bucket,
    };
}

/**
 * 一次碰钉：**只累积计数，不入料**（入料在波末 settleWaveMaterials 一次结算，冻结单 v3 §13-1）。
 * - 主球（secondary=false）⇒ primaryHits + 1；
 * - 若该钉类型是产料钉 ⇒ coloredHits + 1，并按桶累计 coloredHitsByBucket；
 * - 副球（secondary=true）⇒ 两个计数都不动，直接返回原账本。
 * @param {object} ledger
 * @param {{ pegType?:string, secondary?:boolean, weights?:object }} hit
 * @returns {{ ledger:object, granted:number, destroyed:number, key:(string|null) }}
 */
export function recordPegHit(ledger, hit = {}) {
    const base = normalizeLedger(ledger);
    if (hit.secondary) return { ledger: base, granted: 0, destroyed: 0, key: null };

    const key = bucketForPegType(hit.pegType, hit.weights);
    const next = { ...base, primaryHits: base.primaryHits + 1 };
    if (!key) return { ledger: next, granted: 0, destroyed: 0, key: null };

    next.coloredHits = base.coloredHits + 1;
    next.coloredHitsByBucket = { ...base.coloredHitsByBucket, [key]: base.coloredHitsByBucket[key] + 1 };
    return { ledger: next, granted: 0, destroyed: 0, key };
}

/**
 * 把入料次数按各桶命中的占比分下去（最大余数法），保证分出的总数**恰好等于** units。
 * @param {number} units
 * @param {object} counts - coloredHitsByBucket
 * @returns {{ pyro:number, cryo:number, beast:number }}
 */
function _allocateUnits(units, counts) {
    const alloc = { pyro: 0, cryo: 0, beast: 0 };
    const total = MATERIAL_KEYS.reduce((sum, key) => sum + _nonNeg(counts[key]), 0);
    if (units <= 0 || total <= 0) return alloc;

    const rows = [];
    let assigned = 0;
    for (const key of MATERIAL_KEYS) {
        const cnt = _nonNeg(counts[key]);
        const quota = (units * cnt) / total;
        const whole = Math.floor(quota);
        alloc[key] = whole;
        assigned += whole;
        rows.push({ key, remainder: quota - whole, count: cnt });
    }
    rows.sort((a, b) => (b.remainder - a.remainder) || (b.count - a.count));
    let left = units - assigned;
    for (let i = 0; left > 0; i = (i + 1) % rows.length) {
        alloc[rows[i].key] += 1;
        left -= 1;
    }
    return alloc;
}

/**
 * 波末结算料入：`M = FLOOR + floor(coloredHits / p)`（冻结单 v3 §3.1 / §13-1 / §13-13）。
 * 保底 FLOOR 落 FLOOR_BUCKET（钉盘料池起点），余下入料次数按彩色命中占比分到各桶。
 * 结算**不重置**本波计数（重置由 sys_resetWaveMaterialCounters 在下一波开始时做），
 * 因此同一波重复调用会重复入料 —— 调用方必须按 round 去重（material_system 已用 _materialSettleRound 守卫）。
 * @param {object} ledger
 * @param {{ perHitsPerMaterial?:number, basicFloorPerWave?:number }} [opts]
 * @returns {{ ledger:object, total:number, floor:number, units:number, remainder:number,
 *             byBucket:object, coloredHits:number, primaryHits:number, destroyed:number }}
 *          `byBucket` = 实际入到各桶的料（含保底落在 FLOOR_BUCKET 的那份），三桶合计 = total。
 */
export function settleWaveMaterials(ledger, opts = {}) {
    const base = normalizeLedger(ledger);
    const per = Math.max(1, _int(opts.perHitsPerMaterial, 2));
    const floorAmt = _nonNeg(opts.basicFloorPerWave === undefined ? BASIC_FLOOR_PER_WAVE : opts.basicFloorPerWave);
    const units = Math.floor(base.coloredHits / per);
    const alloc = _allocateUnits(units, base.coloredHitsByBucket);
    // grantedByBucket 记「实际入到各桶的料」，与 alloc（入料次数分配）分开：保底是固定加数，不参与按比例分配。
    const grantedByBucket = { pyro: 0, cryo: 0, beast: 0 };
    let next = base;
    let total = 0;
    let destroyed = 0;

    if (floorAmt > 0) {
        const res = addMaterial(next, FLOOR_BUCKET, floorAmt);
        next = res.ledger;
        total += res.granted;
        destroyed += res.destroyed;
        grantedByBucket[FLOOR_BUCKET] += res.granted;
    }
    for (const key of MATERIAL_KEYS) {
        const amount = alloc[key];
        if (amount <= 0) continue;
        const res = addMaterial(next, key, amount);
        next = res.ledger;
        total += res.granted;
        destroyed += res.destroyed;
        grantedByBucket[key] += res.granted;
    }

    next = {
        ...next,
        coloredHitRemainder: base.coloredHits - units * per,
        destroyedThisWave: base.destroyedThisWave + destroyed,
    };

    return {
        ledger: next,
        total,
        floor: floorAmt,
        units,
        remainder: base.coloredHits - units * per,
        byBucket: grantedByBucket,
        coloredHits: base.coloredHits,
        primaryHits: base.primaryHits,
        destroyed,
    };
}

/**
 * 装填：按「能付得起的发数」发弹。
 * 钉盘料池 = pyro + cryo（beast 不参与造弹）；每发扣 perShot 料，先扣 pyro 再扣 cryo。
 * @param {object} ledger
 * @param {number} requestedShots - 装填上限 A（= sys_getCannonStats().shots）
 * @param {number} [perShot=3]
 * @returns {{ ledger:object, loadedShots:number, requestedShots:number, shortfall:number,
 *             spent:{pyro:number, cryo:number}, spentTotal:number }}
 */
export function planLoadout(ledger, requestedShots, perShot = MATERIALS_PER_SHOT) {
    const base = normalizeLedger(ledger);
    const unit = Math.max(1, _int(perShot, MATERIALS_PER_SHOT));
    const want = _nonNeg(requestedShots);
    const pool = base.pyro + base.cryo;
    const affordable = Math.floor(pool / unit);
    const loadedShots = Math.min(want, affordable);
    let remainingCost = loadedShots * unit;

    const fromPyro = Math.min(base.pyro, remainingCost);
    remainingCost -= fromPyro;
    const fromCryo = Math.min(base.cryo, remainingCost);
    remainingCost -= fromCryo;

    return {
        ledger: {
            ...base,
            pyro: base.pyro - fromPyro,
            cryo: base.cryo - fromCryo,
            loadedShots,
            loadRequestedShots: want,
            // [S5] 本波扣减落账本（A5 对账读数来源）；spentTotal 由两桶相加，恒等于 loadedShots × unit
            spent: { pyro: fromPyro, cryo: fromCryo },
            spentTotal: fromPyro + fromCryo,
        },
        loadedShots,
        requestedShots: want,
        shortfall: want - loadedShots,
        spent: { pyro: fromPyro, cryo: fromCryo },
        spentTotal: loadedShots * unit,
    };
}

/**
 * 只读读数出口（供后续 UI 接，本文件只负责形状）。
 * `coloredHitRatio` 就是 `s`（彩钉命中占比），**由计数得出**；本波一次碰钉都没有时为 0（不臆造默认值）。
 * `producedThisWave` 就是本波料入 `M`（波末结算写入）。
 *
 * **本函数固定九键，不得再加键**：`tests/validate_material_loop.mjs:314-316` 对键集做的是精确比对
 * （`Object.keys(readout).sort().join(',')`）。[S5] 的「本波扣减」因此由同文件的 `readWaveSpent`
 * 单独出口，运行时出口 `sys_getMaterialReadout()` 负责把两者合成一个对象（`src/material_system.js`）。
 * @param {object} ledger
 * @returns {{ pyro:number, cryo:number, beast:number, producedThisWave:number, destroyedThisWave:number,
 *             primaryHits:number, coloredHits:number, coloredHitRatio:number, loadedShots:number }}
 */
export function readMaterialReadout(ledger) {
    const s = normalizeLedger(ledger);
    return {
        pyro: s.pyro,
        cryo: s.cryo,
        beast: s.beast,
        producedThisWave: s.producedThisWave,
        destroyedThisWave: s.destroyedThisWave,
        primaryHits: s.primaryHits,
        coloredHits: s.coloredHits,
        coloredHitRatio: s.primaryHits > 0 ? s.coloredHits / s.primaryHits : 0,
        loadedShots: s.loadedShots,
    };
}

/**
 * [S5] 本波扣减的只读出口（A5 对账读数）。与 `readMaterialReadout` 分开是为了不打破后者的九键冻结形状。
 * 口径：`spent` = **本波实际扣掉的料**（不是「本次调用扣了多少」）；干回合（不挖不扣料）读出全 0，
 * 因为 `sys_resetWaveMaterialCounters` 在每波开始已经把它归零。缺字段的旧账本按 0 起，不返回 null。
 * @param {object} ledger
 * @returns {{ spent:{pyro:number, cryo:number}, spentTotal:number }}
 */
export function readWaveSpent(ledger) {
    const s = normalizeLedger(ledger);
    return {
        spent: { pyro: s.spent.pyro, cryo: s.spent.cryo },
        spentTotal: s.spentTotal,
    };
}

/**
 * 建造费的解析结果（内部用，不导出）：把入参 `costByMaterial` 归一成三键成本表，或给出拒绝理由。
 * 口径：
 *   - `null` / `undefined` ⇒ 零成本（不是错误：没有建造费就别扣）；
 *   - 非普通对象（数组 / 字符串 / 数字 / 函数）⇒ 拒绝；
 *   - 键只能是 `MATERIAL_KEYS` 三色，**遇到未知料键一律拒绝**（值为 0 也拒绝：配置写错一个键，
 *     玩家会以为付了钱但实际没扣，这种错必须炸出来，不能静默忽略）；
 *   - 每键必须是 **≥ 0 的有穷整数**：负值 / `NaN` / `Infinity` / 非数字 / 小数一律拒绝，
 *     **负成本不得当成加料**（本函数只做扣减，不做反向入账）。
 *     整数要求与既有 `validateShotCost`（`material_loadout_utils.js:120-127`）保持同一口径。
 * @param {object|null|undefined} costByMaterial
 * @returns {{ ok:boolean, cost:{pyro:number,cryo:number,beast:number}, errors:string[] }}
 */
function _parseBuildCost(costByMaterial) {
    const zero = { pyro: 0, cryo: 0, beast: 0 };
    if (costByMaterial === null || costByMaterial === undefined) {
        return { ok: true, cost: zero, errors: [] };
    }
    if (typeof costByMaterial !== 'object' || Array.isArray(costByMaterial)) {
        return {
            ok: false,
            cost: zero,
            errors: [`costByMaterial 必须是普通对象（如 { pyro: 2, beast: 3 }），实测 ${Object.prototype.toString.call(costByMaterial)}`],
        };
    }
    const errors = [];
    const cost = { pyro: 0, cryo: 0, beast: 0 };
    for (const key of Object.keys(costByMaterial)) {
        if (!MATERIAL_KEYS.includes(key)) {
            errors.push(`未知料键 "${key}"：建造费只收 ${MATERIAL_KEYS.join(' / ')}；未知键必须拒绝，不许静默忽略`);
            continue;
        }
        const raw = costByMaterial[key];
        if (typeof raw !== 'number' || !Number.isFinite(raw)) {
            errors.push(`"${key}" 的建造需求量必须是有穷数字，实测 ${String(raw)}`);
            continue;
        }
        if (raw < 0) {
            errors.push(`"${key}" 的建造需求量不得为负，实测 ${raw}（负成本不得当成加料）`);
            continue;
        }
        if (!Number.isInteger(raw)) {
            errors.push(`"${key}" 的建造需求量必须是整数，实测 ${raw}`);
            continue;
        }
        cost[key] = raw;
    }
    return { ok: errors.length === 0, cost, errors };
}

/**
 * [建造扣料] 从料账本里扣掉一笔**建造费**（纯函数；本函数只做函数与测试，不接线）。
 *
 * 与造弹扣料（`planLoadout` :273 / `material_loadout_utils.js:393 chargeShotMaterials`）的三点差异：
 *   ① **`beast` 可以付建造费**。`BEAST_MATERIAL_KEY` 的语义是「只用于建设，不得用于造弹」（:49-50）
 *      ⇒ 建造侧三色全收（`MATERIAL_KEYS`），造弹侧才把 beast 拒掉（`validateShotCost` 的做法**不**适用这里）；
 *   ② **全或无**：任一色存量 < 该色需求就整笔不扣，返回的账本与传入等价，不学「先扣有的、剩下的算了」；
 *   ③ **绝不写 `spent` / `spentTotal`**：这两个字段是「本波**造弹**实际扣掉的料」的专用口径，
 *      只有两桶（`_normalizeSpent` :74-78 会把 beast 截断），且被整备屏的「本波已扣料」直接读取
 *      ⇒ 建造扣料若写进去，玩家会看到无中生有的本波扣料数。返回账本里这两个字段与传入时完全一致。
 *
 * 余额永不写负是**结构保证**而非事后夹取：成功分支只扣 `need ≤ 余额` 的量（不足已在前面整笔拒掉）。
 * 账本形状归一：内部先过 `normalizeLedger` 取基线，返回的也是归一形状（与既有函数一致，不修改入参）。
 *
 * @param {object} ledger - 料账本（缺字段按 0 起，不抛错）
 * @param {object|null} [costByMaterial] - 建造费，形如 `{ pyro:2, cryo:1, beast:3 }`；
 *        `null` / `undefined` / `{}` / 全 0 视为零成本（`ok === true`、账本不变）；
 *        负值 / `NaN` / 非数字 / 非整数 / 未知料键一律拒绝（`ok === false`、账本不变）。
 * @returns {{ ledger:object, ok:boolean,
 *             chargedByMaterial:{pyro:number,cryo:number,beast:number}, chargedTotal:number,
 *             shortfall:object, errors:string[] }}
 *   - `chargedByMaterial`：本次**实际**扣掉的量，固定三键（未扣的为 0）；失败时全 0；
 *   - `shortfall`：只含**不足**的颜色及其正数差额，足额的颜色不出现；成功与非法入参时为空对象 `{}`；
 *   - `errors`：仅 `costByMaterial` 非法时非空（凑不齐不算错误，走 `shortfall`）。
 */
export function chargeBuildMaterials(ledger, costByMaterial) {
    const base = normalizeLedger(ledger);
    const zeroCharged = () => ({ pyro: 0, cryo: 0, beast: 0 });
    const parsed = _parseBuildCost(costByMaterial);
    if (!parsed.ok) {
        return {
            ledger: base,
            ok: false,
            chargedByMaterial: zeroCharged(),
            chargedTotal: 0,
            shortfall: {},
            errors: parsed.errors,
        };
    }

    const cost = parsed.cost;

    // 先判后扣：不足的颜色只报差额，整笔不扣（余额不可能被写负）。
    const shortfall = {};
    let shortfallTotal = 0;
    for (const key of MATERIAL_KEYS) {
        const need = cost[key];
        if (need <= 0) continue;
        const gap = need - base[key];
        if (gap > 0) {
            shortfall[key] = gap;
            shortfallTotal += gap;
        }
    }
    if (shortfallTotal > 0) {
        return {
            ledger: base,
            ok: false,
            chargedByMaterial: zeroCharged(),
            chargedTotal: 0,
            shortfall,
            errors: [],
        };
    }

    const chargedByMaterial = zeroCharged();
    const next = { ...base };
    let chargedTotal = 0;
    for (const key of MATERIAL_KEYS) {
        const need = cost[key];
        if (need <= 0) continue;
        next[key] = base[key] - need;
        chargedByMaterial[key] = need;
        chargedTotal += need;
    }
    // [契约 5] 建造扣料只动三色余额：spent / spentTotal（以及装填读数、本波计数）全部原样继承 base，
    // 这里不出现任何对 spent 的赋值——「本波已扣料」只认装填扣料那一步。
    return {
        ledger: next,
        ok: true,
        chargedByMaterial,
        chargedTotal,
        shortfall: {},
        errors: [],
    };
}
