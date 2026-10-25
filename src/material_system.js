/**
 * material_system.js - [REQ-20261022-wave-loop · 料闭环] 「料」账本的运行时（mixin，注册在 core.js `_subsystems`）。
 *
 * 分工：
 *   纯函数（计数 / 波末结算 / 装填扣料 / 读数形状）在 src/utils/material_economy_utils.js，本文件只负责
 *   把结果落到 Game 实例，并在正确的挂点被调用：
 *     生产计数 → spawn_system.spawn_createHitFeedback 的采集弹珠碰钉回调（**只计数、不入料**）
 *     生产结算 → build_system.sys_onDigComplete（挖掘两批都落定后唯一收口）⇒ `M = FLOOR + floor(coloredHits / p)`
 *     消耗     → game_phase.phase_startCombatPhase（按装填上限 A 扣 A × 3，料不足按付得起的发数发弹）
 *     读数     → sys_getMaterialReadout（只读，后续 UI 接）
 *
 * **料存量不设上限**（Owner 2026-10-24 23:34「要人玩的爽就别设置材料上限了」）：本文件没有容量档、
 *   没有 cap / clip / 销毁判断，入账只累加。原「容量 = materialCapShots × materialPerShot」已整体作废。
 *
 * 本轮**不做**：UI、符文 / 铸符、扩建购买、电。
 * 存档：[S5] 已落地——`mat_exportPersistState()` / `mat_applyPersistState(state)` 供
 *   `src/game_system.js` 的局内存档白名单区与 `sys_loadRunState()` 调用；旧档缺字段一律按 0 / null 起。
 */

import { CONFIG } from './config.js';
import {
    MATERIALS_PER_SHOT,
    createMaterialLedger,
    normalizeLedger,
    planLoadout,
    readMaterialReadout,
    readWaveSpent,
    recordPegHit,
    settleWaveMaterials,
} from './utils/material_economy_utils.js';
// [步 6] 逐料扣减与干回合保底一律转调第 1 步纯函数（本文件只做「落账 + 补写 spent」的包裹层）。
import { chargeShotMaterials, grantFloorOnly } from './utils/material_loadout_utils.js';

function materialCfg() {
    return (CONFIG.gameplay
        && CONFIG.gameplay.build
        && CONFIG.gameplay.build.power
        && CONFIG.gameplay.build.power.materials) || {};
}

/**
 * [开局可打] 新局启动料的三色初值（`CONFIG.gameplay.build.startMaterials`，`src/config.js` 紧跟 `build.workshop` 段）。
 *
 * **缺键一律按 0 并 `console.warn` 留痕，不静默给非 0 默认值**：静默兜底会让「配置没接上」变成
 *   「玩家莫名有料」，事后无法归因（同 `phase_shotCostByMaterial` 对 `manualMaterialMultiplier` 的处理口径）。
 * 两种缺法分别留痕：
 *   ① 整段缺失 / 不是对象 ⇒ 三色全 0 + 一条 warn；
 *   ② 段在但某个料的键缺失 / 非有限 / 负数 ⇒ 该料按 0 + 一条点名该桶的 warn（不整段作废，
 *      也不拿别的桶的值去补）。
 * @returns {{ pyro:number, cryo:number, beast:number }}
 */
function materialStartMaterials() {
    const build = (CONFIG.gameplay && CONFIG.gameplay.build) || {};
    const raw = build.startMaterials;
    const zero = { pyro: 0, cryo: 0, beast: 0 };
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
        console.warn(`[sys_initMaterialLedger] 配置缺键 build.startMaterials（实测 ${JSON.stringify(raw)}）：新局启动料按全 0 起，不兜底成非 0 默认值`);
        return zero;
    }
    const out = { ...zero };
    for (const key of Object.keys(zero)) {
        const n = Number(raw[key]);
        if (Number.isFinite(n) && n >= 0) {
            out[key] = Math.floor(n);
            continue;
        }
        console.warn(`[sys_initMaterialLedger] 配置键 build.startMaterials.${key} 不是 ≥ 0 的有限数（实测 ${JSON.stringify(raw[key])}）：该项按 0 起`);
    }
    return out;
}

/**
 * [S5] 弹药配方 id 的类型守卫（`_selectedRecipeId` 存的是**弹药配方 id**，不是单发子弹对象）。
 * 规整为 `null` 而不是抛错：脏档/旧档不该让整局读档失败——`sys_loadRunState` 的 catch 分支会
 * `sys_clearRunState()` 直接清档，代价是玩家整局丢失。
 */
function normalizeSelectedRecipeId(raw) {
    return (typeof raw === 'string' && raw.length > 0) ? raw : null;
}

/**
 * [S5] 冻结记录规范化：`{ round, recipeId, N, bound, ties, spent }`，缺省 `null`。
 * - `round` 是这条记录的锚，缺它整条无意义 ⇒ 返回 null；
 * - `bound` 是四上限里的一个键名（`'A'|'U'|'E'|'M'`），`ties` 是键名数组（见 `material_loadout_utils.pickBindingLimit`）；
 * - `spent` 是本回合已扣料，形状与 `ledger.spent` 一致（`{ pyro, cryo }`）；非该形状一律按 0 起，不猜。
 * 写入方（第 7 步）必须按这个形状写。
 */
function normalizeFrozenRecord(raw) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
    if (!Number.isFinite(raw.round)) return null;
    const spent = raw.spent && typeof raw.spent === 'object' ? raw.spent : {};
    const nonNegInt = v => (Number.isFinite(Number(v)) ? Math.max(0, Math.floor(Number(v))) : 0);
    return {
        round: Math.floor(raw.round),
        recipeId: normalizeSelectedRecipeId(raw.recipeId),
        N: nonNegInt(raw.N),
        bound: typeof raw.bound === 'string' ? raw.bound : null,
        ties: Array.isArray(raw.ties) ? raw.ties.filter(k => typeof k === 'string') : [],
        spent: { pyro: nonNegInt(spent.pyro), cryo: nonNegInt(spent.cryo) },
    };
}

export const material_system = {
    /**
     * @method sys_initMaterialLedger
     * @description 新局重置料账本（core.js 构造与 sys_resetGame 调用，跟随 sys_initBuildState）。
     *   [开局可打] 三色存量取 `CONFIG.gameplay.build.startMaterials`（新局启动料）；缺键按 0 并 warn，
     *   见上方 `materialStartMaterials()`。**只覆盖三色存量**，本波计数（`producedThisWave` / `spent` /
     *   `spentTotal` …）由 `createMaterialLedger` 一律归零，不带初值。
     *   **读档不走本方法**：`sys_loadRunState()` 在 `sys_resetGame()` 之后调 `mat_applyPersistState(state)`，
     *   用存档里的 `materialLedger` 整体覆盖（`normalizeLedger(src.materialLedger)`），存档值不会被启动料盖掉。
     */
    sys_initMaterialLedger() {
        this.materialLedger = createMaterialLedger(materialStartMaterials());
        this._materialLoadRound = null;
        this._materialSettleRound = null;
        // [步 6] 干回合保底去重标记：**自己的** round 标记，不得借用 `_materialSettleRound`
        //（订正件附录 C-1 条文 1：借用会与真实结算互相把对方挡掉）。
        this._materialFloorRound = null;
        // [S5] 配方选择与冻结记录缺省为 null。只在未初始化时才写，避免中途（装填/结算懒初始化）抹掉玩家已选的配方。
        if (this._selectedRecipeId === undefined) this._selectedRecipeId = null;
        if (this._materialFrozenRecord === undefined) this._materialFrozenRecord = null;
    },

    /** 本波计数清零（phase_startGatheringPhase 每波调用；余额跨波累积，不清）。 */
    sys_resetWaveMaterialCounters() {
        if (!this.materialLedger) {
            this.sys_initMaterialLedger();
            return;
        }
        this.materialLedger = normalizeLedger({
            ...this.materialLedger,
            producedThisWave: 0,
            destroyedThisWave: 0,
            primaryHits: 0,
            coloredHits: 0,
            coloredHitsByBucket: { pyro: 0, cryo: 0, beast: 0 },
            // [S5] 每波开始把「本波扣减」归零 ⇒ 干回合（不挖不扣料）读出 0，不残留上一波的值
            spent: { pyro: 0, cryo: 0 },
        });
    },

    /**
     * @method mat_recordPegHit
     * @description 一次采集弹珠碰钉：**只累积计数，不入料**（冻结单 v3 §13-1）。
     *   primaryHits + 1；产料钉（pegWeights 点名 pyro / cryo / beast）再给 coloredHits + 1 并按桶累计。
     *   入料在波末 mat_settleWaveMaterials 一次结算，因此这里 granted 恒为 0。
     * @param {string} pegType - 钉类型（决定是否算产料钉、落哪个桶）
     * @param {boolean} secondary - 是否为副球（副球两个计数都不计）
     * @returns {{ granted:number, destroyed:number, key:(string|null) }}
     */
    mat_recordPegHit(pegType = 'normal', secondary = false) {
        if (!this.materialLedger) this.sys_initMaterialLedger();
        const cfg = materialCfg();
        const res = recordPegHit(this.materialLedger, {
            pegType,
            secondary,
            weights: cfg.pegWeights,
        });
        this.materialLedger = res.ledger;
        return { granted: res.granted, destroyed: res.destroyed, key: res.key };
    },

    /**
     * @method mat_settleWaveMaterials
     * @description 波末结算料入：`M = FLOOR(basicFloorPerWave) + floor(coloredHits / perHitsPerMaterial)`。
     *   保底落 pyro（钉盘料池起点），入料次数按彩色命中占比分到各桶。
     *   同一 round 只结算一次（sys_onDigComplete 存在重入 / 补调路径，重复结算会重复入料）。
     * @returns {{ total:number, floor:number, units:number, remainder:number, byBucket:object, charged:boolean }}
     */
    mat_settleWaveMaterials() {
        if (!this.materialLedger) this.sys_initMaterialLedger();
        if (this._materialSettleRound === this.round) {
            return { total: 0, floor: 0, units: 0, remainder: 0, byBucket: { pyro: 0, cryo: 0, beast: 0 }, charged: false };
        }
        const cfg = materialCfg();
        const res = settleWaveMaterials(this.materialLedger, {
            perHitsPerMaterial: cfg.perHitsPerMaterial,
            basicFloorPerWave: cfg.basicFloorPerWave,
        });
        this.materialLedger = res.ledger;
        this._materialSettleRound = this.round;
        return {
            total: res.total,
            floor: res.floor,
            units: res.units,
            remainder: res.remainder,
            byBucket: res.byBucket,
            charged: true,
        };
    },

    /**
     * @method mat_payLoadout
     * @description 战斗开始装填：按装填上限扣料造弹，料不足时按付得起的发数发弹。
     *   同一 round 只结算一次（phase_startCombatPhase 有重入路径，重复调用不得二次扣料）。
     * @param {number} requestedShots - 装填上限 A（= sys_getCannonStats().shots）
     * @returns {{ loadedShots:number, requestedShots:number, shortfall:number, spent:object, charged:boolean }}
     */
    mat_payLoadout(requestedShots = 0) {
        if (!this.materialLedger) this.sys_initMaterialLedger();
        if (this._materialLoadRound === this.round) {
            return {
                loadedShots: this.materialLedger.loadedShots,
                requestedShots: this.materialLedger.loadRequestedShots,
                shortfall: Math.max(0, this.materialLedger.loadRequestedShots - this.materialLedger.loadedShots),
                // 本**次调用**没有再扣料（本波真实扣减在账本 spent 里，A5 对账读 sys_getMaterialReadout）
                spent: { pyro: 0, cryo: 0 },
                spentTotal: 0,
                charged: false,
            };
        }
        const cfg = materialCfg();
        const perShot = Number(cfg.materialPerShot) > 0 ? Number(cfg.materialPerShot) : MATERIALS_PER_SHOT;
        const res = planLoadout(this.materialLedger, requestedShots, perShot);
        this.materialLedger = res.ledger;
        this._materialLoadRound = this.round;
        return {
            loadedShots: res.loadedShots,
            requestedShots: res.requestedShots,
            shortfall: res.shortfall,
            spent: res.spent,
            spentTotal: res.spentTotal,
            charged: true,
        };
    },

    /**
     * @method mat_chargeShotMaterials
     * @description [步 6] 按「实际造弹量 N + 逐料配方成本」扣料，并**补写 `spent` / `spentTotal`**。
     *   `chargeShotMaterials`（`src/utils/material_loadout_utils.js:393`）只把 `loadedShots` / `loadRequestedShots`
     *   写进账本（该文件 `:412-413`），**不写 `spent` / `spentTotal`**；A5 对账读的是 `ledger.spent`，
     *   缺这一步读数会停在旧值。补写落在**本文件（调用包裹层）**而不是 `material_loadout_utils.js`——
     *   后者属第 1 步、不在本步写面内（订正件附录 C-3 步 6 的移交项）。
     *   去重不在这里做：调用方（`game_phase.phase_freezeWaveRecord`）按 `_materialFrozenRecord.round` 判重，
     *   同一 round 不会二次进入本方法。
     * @param {number} shots - 本回合**实际造弹量**（= 冻结记录里的 `N`，不是玩家配置的发数）
     * @param {object} costByMaterial - 弹药配方每发逐料需求（如 `{ pyro: 3 }` / `{ pyro: 2, cryo: 2 }`）
     * @returns {{ chargedShots:number, requestedShots:number, shortfall:number, spent:object, spentTotal:number }}
     */
    mat_chargeShotMaterials(shots, costByMaterial) {
        if (!this.materialLedger) this.sys_initMaterialLedger();
        const res = chargeShotMaterials(this.materialLedger, { shots, costByMaterial });
        // 补写「本波实际扣减」：spentTotal 由 normalizeLedger 从 spent 推导，结构性恒等，不另存外来值。
        this.materialLedger = normalizeLedger({ ...res.ledger, spent: res.spent, spentTotal: res.spentTotal });
        return {
            chargedShots: res.chargedShots,
            requestedShots: res.requestedShots,
            shortfall: res.shortfall,
            spent: { pyro: res.spent.pyro, cryo: res.spent.cryo },
            spentTotal: res.spentTotal,
        };
    },

    /**
     * @method mat_grantFloorOnly
     * @description [步 6] 干回合保底：`basicFloorPerWave`（`3` `[盘上]`，`src/config.js:1008`）入
     *   `FLOOR_BUCKET`（`pyro`）。只加保底、**不读任何命中计数**（走第 1 步 `grantFloorOnly`，附录 C-1 路 A），
     *   因此结构上不会像 `mat_settleWaveMaterials` 那样把上一波残留的 `coloredHits` 再结一次。
     *   按 round 用自己的 `_materialFloorRound` 去重（附录 C-1 条文 1）；同 round 重入返回 0。
     * @returns {number} 本次实际入账的保底量
     */
    mat_grantFloorOnly() {
        if (!this.materialLedger) this.sys_initMaterialLedger();
        if (this._materialFloorRound === this.round) return 0;
        const cfg = materialCfg();
        const res = grantFloorOnly(this.materialLedger, { basicFloorPerWave: cfg.basicFloorPerWave });
        this.materialLedger = normalizeLedger(res.ledger);
        this._materialFloorRound = this.round;
        return res.granted;
    },

    /**
     * @method sys_getMaterialReadout
     * @description 只读读数出口（后续 UI 接这一处，不要直接读 this.materialLedger）。
     *   `coloredHitRatio` 就是 s（彩钉命中占比，由计数得）；`producedThisWave` 就是本波料入 M；
     *   [S5] `spent` / `spentTotal` 就是「本波扣了多少料」（纯函数层由 `readWaveSpent` 单独出口，
     *   因为 `readMaterialReadout` 的九键形状被既有断言锁死，见 `material_economy_utils.js` 注释）。
     * @returns {{ pyro:number, cryo:number, beast:number, producedThisWave:number, destroyedThisWave:number,
     *             primaryHits:number, coloredHits:number, coloredHitRatio:number, loadedShots:number,
     *             spent:{pyro:number, cryo:number}, spentTotal:number }}
     */
    sys_getMaterialReadout() {
        return {
            ...readMaterialReadout(this.materialLedger),
            ...readWaveSpent(this.materialLedger),
        };
    },

    /**
     * @method mat_exportPersistState
     * @description [S5] 局内存档白名单区要取的字段（全部 JSON 安全，可直接进 `JSON.stringify`）。
     *   `materialLedger` 取**整份 normalizeLedger 输出**（含三余额与本波计数/扣减），不是只取三余额：
     *   A5 对账要在重载后仍读得到本波扣减，少存字段会让 `spent` 在重载后归零而与实际发数对不上。
     *   [步 6] 两个 round 去重标记（`_materialSettleRound` 结算、`_materialFloorRound` 保底）一并入档：
     *   读档后若重跑 `sys_onDigComplete`（补调路径）或重入干回合分支，同一 round 不得二次结算 / 二次保底。
     * @returns {{ materialLedger:object, _materialLoadRound:(number|null),
     *             _materialSettleRound:(number|null), _materialFloorRound:(number|null),
     *             _selectedRecipeId:(string|null), _materialFrozenRecord:(object|null) }}
     */
    mat_exportPersistState() {
        if (!this.materialLedger) this.sys_initMaterialLedger();
        return {
            materialLedger: normalizeLedger(this.materialLedger),
            _materialLoadRound: Number.isFinite(this._materialLoadRound) ? this._materialLoadRound : null,
            _materialSettleRound: Number.isFinite(this._materialSettleRound) ? this._materialSettleRound : null,
            _materialFloorRound: Number.isFinite(this._materialFloorRound) ? this._materialFloorRound : null,
            _selectedRecipeId: normalizeSelectedRecipeId(this._selectedRecipeId),
            _materialFrozenRecord: normalizeFrozenRecord(this._materialFrozenRecord),
        };
    },

    /**
     * @method mat_applyPersistState
     * @description [S5] 读档恢复：旧档缺字段时三余额按 0、id / 冻结记录 / 两个去重标记按 null 起，
     *   不抛错、不落 undefined。必须在 `sys_resetGame()`（内部会 `sys_initMaterialLedger()` 归零）之后调用。
     *   [步 6] `_materialSettleRound` / `_materialFloorRound` 由「不入档、读档置 null」改为**按档恢复**：
     *   置 null 会让「本回合已经结算/已经发过保底」这件事在重载后丢失，补调路径就会二次入料。
     * @param {object} state - 存档对象（可整份传进来，本方法只读上面六个字段）
     * @returns {{ materialLedger:object, _materialLoadRound:(number|null),
     *             _materialSettleRound:(number|null), _materialFloorRound:(number|null),
     *             _selectedRecipeId:(string|null), _materialFrozenRecord:(object|null) }}
     */
    mat_applyPersistState(state) {
        const src = state && typeof state === 'object' ? state : {};
        this.materialLedger = normalizeLedger(src.materialLedger);
        this._materialLoadRound = Number.isFinite(src._materialLoadRound)
            ? Math.floor(src._materialLoadRound)
            : null;
        this._materialSettleRound = Number.isFinite(src._materialSettleRound)
            ? Math.floor(src._materialSettleRound)
            : null;
        this._materialFloorRound = Number.isFinite(src._materialFloorRound)
            ? Math.floor(src._materialFloorRound)
            : null;
        this._selectedRecipeId = normalizeSelectedRecipeId(src._selectedRecipeId);
        this._materialFrozenRecord = normalizeFrozenRecord(src._materialFrozenRecord);
        return {
            materialLedger: normalizeLedger(this.materialLedger),
            _materialLoadRound: this._materialLoadRound,
            _materialSettleRound: this._materialSettleRound,
            _materialFloorRound: this._materialFloorRound,
            _selectedRecipeId: this._selectedRecipeId,
            _materialFrozenRecord: this._materialFrozenRecord,
        };
    },
};
