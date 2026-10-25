/**
 * validate_material_economy_balance.mjs — [REQ-20261022-wave-loop · 料经济标定] 整局算术表 + 关键不等式。
 *
 * 这是什么：把「料收入 → 每发料价 → 可负担发数 → 该波射速水平」这条链，按**盘上 config 的真实数值**重算一遍，
 *   覆盖第 1..8 波，并断言一组**关键不等式**（不是断言某个具体读数）。
 * 直接读盘：本文件 `import { CONFIG } from '../src/config.js'`，没有任何内联副本；改了 config 重跑即可复算。
 * 复用生产纯函数：料入走 `settleWaveMaterials`（不是照抄公式）、可负担发数走 `computeMaterialShots`、
 *   扣料走 `chargeShotMaterials`。日志里的 M / 分桶 / 扣料与运行时是同一份实现。
 *
 * 口径（每条都标来源）：
 *   [实测] 波 1：primaryHits 45 / coloredHits 15 / byBucket { pyro 5, cryo 9, beast 1 }
 *          —— `tools/verify/readings/20261025-132905/state.json` 的 `waveLoop.steps[0].detail.ledger`。
 *   [实测] 波 2：primaryHits 52 / coloredHits 12 / byBucket { pyro 4, cryo 7, beast 1 }
 *          —— 同一次跑 `run.log` 的 `wave2-build` 行（`waveLoop.steps[3].detail.ledger`）。
 *   [模拟] 波 3..8：沿用波 2 的读数（coloredHits 12 / { 4, 7, 1 }）作**基线**，不改命中数、不假设命中会自己变；
 *          另在「敏感带」一节把 coloredHits 取 10 / 12 / 15 各跑一遍，给出收入下沿。
 *   [模拟] 参考射速进度 `RATE_REF`：第 1..4 波 2 发、第 5..8 波 3 发。依据是**电**侧的收入量级（不是拍的）：
 *          每波 primaryHits 45~52 且 `dig.energyPerPegHit = 1` ⇒ 每波约 45~52 ⚡ 入账；射速轨 L1 要 60 ⚡
 *          （`build.cannon.ratePrices[0]`），而同一份电还要给伤害轨（30/30/45/60/80）与设施
 *          ⇒ 均衡流玩家在第 4~5 波买到射速 L1（A = 3）是可持续的参考线，不是最优线。
 *          满射速轨（A = 5）单独在「上沿」一节算，不混进参考线。
 *
 * 断言（A1..A12）：
 *   A1 建工坊后，每一波的「可负担发数」≥ 该波参考射速 A_ref（含料入累计）。
 *   A2 每波「可负担发数」≥ 1（任何一波都不许出现「打不出第一发」，即 N = 0 的死局）。
 *   A3 无工坊 < 有工坊（工坊的正面收益成立：手工溢价确实咬人）且无工坊 ≥ 1。
 *   A4 开局校准（仅启动料，与 config 注释逐字同口径）：无工坊 1 发、建工坊 2 发，且 2 = 默认 A。
 *   A5 C10：最低档配方 pyro 成本 ≤ config 的 basicFloorPerWave（保底一定付得起 1 发）。
 *   A6 料入不无限增长：M 只取决于本波命中（FLOOR + floor(C/p)），与存量无关；同一份计数器重复结算 = 线性相加。
 *   A7 M 的上界：任一波 M ≤ FLOOR + ceil(C_max / p)，C_max 取实测最大值（15）。
 *   A8 稀缺（一波，取舍形式）：同一波内「按参考射速开火的料耗」+「三件料付设施合计料价」> 本波料入
 *      ⇒ 打出参考射速就建不全设施、建全设施就达不到参考射速。逐料（pyro / cryo）分别判。
 *      为什么不是「单波料入 < 三件设施价」：那条要 trioPyro ≥ 12，即工坊 pyro 价 ≥ 5，
 *      而启动料 pyro 10 − 4 = 6 = 2 发 × 3 是实现「建工坊 2 发」的唯一取值（A4 校准）；
 *      两者不可兼得，故稀缺性写在取舍上、不写在收入绝对值上。开火线取**两料均衡**配方
 *      （`ammo_pyro_cryo_dual`）：若只打 pyro 弹，cryo 只进不出，第 1 波 cryo 入 9 恰好打平
 *      三件 cryo 价 9，稀缺性会被「不打 cryo 弹」这一条白嫖掉。
 *   A9 稀缺（整局）：8 波累计剩余（按参考线开火 + 建工坊）< 全部料付设施 + 全部升级 + 全部网格扩建的总价
 *      ⇒ 攒满整局也买不全（上限）；
 *      下界（「建设真能发生」）取**整局里最富的那个整备时点**能否付清三件地基 —— 不是「第 8 波后还剩多少」：
 *      后者随着局势变稀缺而变小，用它当判据等于「越稀缺越红」，方向与「料必须稀缺」相反（旧的错误口径已改）。
 *   A10 配方冻结护栏：三条弹药的 `cost` / `elements` 逐键等值（谁动了就红），且**不含**已删除的
 *      `damageMult`（2026-10-25 判死：战斗侧零读取，见 `shot_recipe_utils.REMOVED_RECIPE_FIELDS`）。
 *   A11 料未被拆成两种货币 / 未开免费额度：造弹费只用 pyro+cryo（beast 不参与），且不存在「0 价配方」。
 *   A12 兜底口径：config 的 basicFloorPerWave ≥ 纯函数层结构下限 BASIC_FLOOR_PER_WAVE（config 只许更宽，不许更紧）。
 *
 * Usage:
 *   node tests/validate_material_economy_balance.mjs
 */

import { CONFIG } from '../src/config.js';
import {
    BASIC_FLOOR_PER_WAVE,
    MATERIAL_KEYS,
    MATERIALS_PER_SHOT,
    FLOOR_BUCKET,
    normalizeLedger,
    settleWaveMaterials,
} from '../src/utils/material_economy_utils.js';
import {
    chargeShotMaterials,
    computeMaterialShots,
    validateShotCost,
} from '../src/utils/material_loadout_utils.js';

let passed = 0;
let failed = 0;
const failures = [];
function check(condition, message) {
    if (condition) {
        passed++;
    } else {
        failed++;
        failures.push(message);
        console.log(`  x ${message}`);
    }
}
function eq(actual, expected, message) {
    check(actual === expected, `${message}（实际 ${JSON.stringify(actual)}，期望 ${JSON.stringify(expected)}）`);
}
function section(title) {
    console.log(`\n=== ${title} ===`);
}

// ============================================================
// 0. 从 config 取数（唯一真值源；下面任何数字都不许另写一份）
// ============================================================
const BUILD = (CONFIG.gameplay && CONFIG.gameplay.build) || {};
const POWER = BUILD.power || {};
const MAT = POWER.materials || {};
const FAC = BUILD.facilities || {};
const GRID = POWER.grid || {};

const P = Number(MAT.perHitsPerMaterial);          // 每 N 次产料钉命中给 1 料
const FLOOR = Number(MAT.basicFloorPerWave);       // 每波保底料（落 FLOOR_BUCKET = pyro）
const MANUAL_MULT = Number(BUILD.workshop && BUILD.workshop.manualMaterialMultiplier);
const SHOTS_PER_TURN = Number(CONFIG.gameplay.cannon && CONFIG.gameplay.cannon.shotsPerTurn);
const RATE_PRICES = (BUILD.cannon && BUILD.cannon.ratePrices) || [];
const START = (BUILD.startMaterials) || {};
const WORKSHOP_MAT = (FAC.workshop && FAC.workshop.materials) || {};

/** 默认弹药配方 = 已解锁里 cost 总量最低的那条（与 `pickDefaultRecipe` 同序：总价升序，并列按 id 字典序）。 */
function pickDefaultRecipe(recipes) {
    const unlocked = recipes.filter(r => r && r.blueprintRequired !== true);
    const sum = c => Object.keys(c || {}).reduce((s, k) => s + (Number(c[k]) || 0), 0);
    return unlocked.slice().sort((a, b) => (sum(a.cost) - sum(b.cost)) || (a.id < b.id ? -1 : 1))[0];
}
const RECIPES = Array.isArray(BUILD.recipes) ? BUILD.recipes : [];
const DEFAULT_RECIPE = RECIPES.length ? pickDefaultRecipe(RECIPES) : { id: '(缺表)', cost: { pyro: MATERIALS_PER_SHOT } };
/** 两料均衡配方（A8 的参考开火线：pyro 与 cryo 都真的被消耗掉）。 */
const DUAL_RECIPE = RECIPES.find(r => r.id === 'ammo_pyro_cryo_dual') || DEFAULT_RECIPE;

/**
 * 每发逐料价（与 `game_phase.phase_shotCostByMaterial` 同口径）：
 *   建了工坊 = 配方原价；没建工坊 = 配方原价 × manualMaterialMultiplier。
 * 只保留 > 0 的料键（未点名 = 0 需求）。
 */
function pricePerShot(recipe, workshopBuilt) {
    const mult = workshopBuilt ? 1 : MANUAL_MULT;
    const out = {};
    for (const key of Object.keys(recipe.cost || {})) {
        const n = Number(recipe.cost[key]);
        if (!Number.isFinite(n) || n <= 0) continue;
        out[key] = n * mult;
    }
    return out;
}
const priceStr = p => Object.keys(p).sort().map(k => `${k}:${p[k]}`).join('+') || '(空)';

// ============================================================
// 1. 逐波输入（实测 / 模拟分开标）
// ============================================================
const WAVES = [
    { w: 1, primaryHits: 45, coloredHits: 15, byBucket: { pyro: 5, cryo: 9, beast: 1 }, src: '[实测] state.json' },
    { w: 2, primaryHits: 52, coloredHits: 12, byBucket: { pyro: 4, cryo: 7, beast: 1 }, src: '[实测] run.log wave2-build' },
    { w: 3, primaryHits: 52, coloredHits: 12, byBucket: { pyro: 4, cryo: 7, beast: 1 }, src: '[模拟] 沿用波2' },
    { w: 4, primaryHits: 52, coloredHits: 12, byBucket: { pyro: 4, cryo: 7, beast: 1 }, src: '[模拟] 沿用波2' },
    { w: 5, primaryHits: 52, coloredHits: 12, byBucket: { pyro: 4, cryo: 7, beast: 1 }, src: '[模拟] 沿用波2' },
    { w: 6, primaryHits: 52, coloredHits: 12, byBucket: { pyro: 4, cryo: 7, beast: 1 }, src: '[模拟] 沿用波2' },
    { w: 7, primaryHits: 52, coloredHits: 12, byBucket: { pyro: 4, cryo: 7, beast: 1 }, src: '[模拟] 沿用波2' },
    { w: 8, primaryHits: 52, coloredHits: 12, byBucket: { pyro: 4, cryo: 7, beast: 1 }, src: '[模拟] 沿用波2' },
];
/** [模拟] 参考射速进度（见文件头依据）：第 1..4 波 2 发，第 5..8 波 3 发。 */
const RATE_REF = [2, 2, 2, 2, 3, 3, 3, 3];
/** [模拟] 敏感带下限用的命中数：比任何一次实测都低，用来卡「收入下沿仍够不够」。 */
const C_LOW = 10;

console.log('===================================================');
console.log('  Material economy balance (整局料收支 · 第 1..8 波)');
console.log('===================================================');
console.log(`[盘上] perHitsPerMaterial=${P}  basicFloorPerWave=${FLOOR}  manualMaterialMultiplier=${MANUAL_MULT}`);
console.log(`[盘上] 默认配方=${DEFAULT_RECIPE.id} 原价=${priceStr(pricePerShot(DEFAULT_RECIPE, true))}`);
console.log(`[盘上] 手工价=${priceStr(pricePerShot(DEFAULT_RECIPE, false))}  启动料=${priceStr(START)}`);
console.log(`[盘上] 工坊地基价=${priceStr(WORKSHOP_MAT)}  射速轨价=${JSON.stringify(RATE_PRICES)}  基础 A=${SHOTS_PER_TURN}`);

// ============================================================
// 2. 整局算术表：料入 → 每发价 → 可负担发数 → 该波需要几发
// ============================================================
section('1. 整局算术表（料入用实测命中；波 3 以后 [模拟]）');

/**
 * 跑一遍整局。`buyWorkshopAt` = 在第几波整备时买工坊（null ⇒ 全程不买）。
 * 参考线打法：每波按 RATE_REF 开火，不建其它设施（其它建造在 A8/A9 单独算稀缺）。
 */
function runGame({ buyWorkshopAt = 1, rateRef = RATE_REF } = {}) {
    let stock = normalizeLedger(START);
    let built = false;
    const rows = [];
    for (let i = 0; i < WAVES.length; i++) {
        const wave = WAVES[i];
        // 波末料入：直接喂计数器给生产函数 settleWaveMaterials（不照抄公式）
        const probe = normalizeLedger({
            ...stock,
            primaryHits: wave.primaryHits,
            coloredHits: wave.coloredHits,
            coloredHitsByBucket: wave.byBucket,
        });
        const settled = settleWaveMaterials(probe, { perHitsPerMaterial: P, basicFloorPerWave: FLOOR });
        const income = settled.byBucket;
        const M = settled.total;
        stock = normalizeLedger(settled.ledger); // 只带走余额，计数器每波归零（等价 sys_resetWaveMaterialCounters）

        // 整备：买工坊（唯一一次，付地基价）
        if (!built && buyWorkshopAt !== null && wave.w === buyWorkshopAt) {
            for (const key of MATERIAL_KEYS) {
                const cost = Number(WORKSHOP_MAT[key]) || 0;
                stock[key] = stock[key] - cost;
            }
            built = true;
        }

        const priceManual = pricePerShot(DEFAULT_RECIPE, false);
        // 开火价按**本世界线**取：建了工坊 = 原价，没建 = 手工溢价（与 phase_shotCostByMaterial 同口径）。
        const priceWs = pricePerShot(DEFAULT_RECIPE, built);
        const affordManual = computeMaterialShots(stock, priceManual).M;
        const affordWs = computeMaterialShots(stock, priceWs).M;
        // 最优配方（只看哪种配方在现有存量下能造出最多发数；用来回答「射速上沿靠什么撑」）
        let best = { id: null, M: -1 };
        for (const r of RECIPES) {
            const price = pricePerShot(r, built);
            const m = computeMaterialShots(stock, price).M;
            if (m > best.M) best = { id: r.id, M: m, price };
        }
        const need = rateRef[i];
        const stockBefore = { pyro: stock.pyro, cryo: stock.cryo, beast: stock.beast };
        // 开火：按参考线发数，逐料扣料（生产函数）
        const fired = chargeShotMaterials(stock, { shots: need, costByMaterial: priceWs });
        stock = normalizeLedger(fired.ledger);
        // A8 用的两料均衡开火线：本波「入 − 耗」，与存量无关（存量另由 A9 约束累计上限）
        const dualPrice = pricePerShot(DUAL_RECIPE, built);
        const dualSpendPyro = need * (Number(dualPrice.pyro) || 0);
        const dualSpendCryo = need * (Number(dualPrice.cryo) || 0);
        rows.push({
            w: wave.w, src: wave.src, coloredHits: wave.coloredHits, primaryHits: wave.primaryHits,
            M, pyroIn: income.pyro, cryoIn: income.cryo, beastIn: income.beast,
            built, priceManual, priceWs, affordManual, affordWs, best, need,
            gap: affordWs - need, shortfall: fired.shortfall,
            stockBefore, stockAfter: { pyro: stock.pyro, cryo: stock.cryo, beast: stock.beast },
            dualPrice, dualSpendPyro, dualSpendCryo,
            dualSurplusPyro: income.pyro - dualSpendPyro,
            dualSurplusCryo: income.cryo - dualSpendCryo,
        });
    }
    return rows;
}

const rows = runGame({ buyWorkshopAt: 1 });

const pad = (v, n) => String(v).padStart(n);
console.log('\n波 | 命中 彩/总 | 入 M | pyro入 cryo入 beast入 | 前价  后价 | 可负担前/后 | 参考A | 缺口/盈余 | 赛后余料 pyro/cryo | 来源');
console.log('-' .repeat(150));
for (const r of rows) {
    const gap = r.gap >= 0 ? `+${r.gap}` : `${r.gap}`;
    console.log([
        pad(r.w, 2),
        pad(`${r.coloredHits}/${r.primaryHits}`, 9),
        pad(r.M, 5),
        pad(`${r.pyroIn}/${r.cryoIn}/${r.beastIn}`, 18),
        pad(priceStr(r.priceManual), 6),
        pad(priceStr(r.priceWs), 5),
        pad(`${r.affordManual}/${r.affordWs}`, 12),
        pad(r.need, 6),
        pad(gap, 9),
        pad(`${r.stockAfter.pyro}/${r.stockAfter.cryo}`, 19),
        ` ${r.src}`,
    ].join(' | '));
}
console.log('-'.repeat(150));
console.log('注：可负担前/后 = 同一份存量下「不建工坊（×' + MANUAL_MULT + '）」与「建了工坊（原价）」各自能造出的发数；');
console.log('    缺口/盈余 = 可负担（后）− 参考射速 A；负数即缺口。赛后余料 = 按参考线开火、逐料扣料之后的余额。');
console.log('    口径提醒：「前/后」共用同一份存量（已扣掉第 1 波工坊地基），所以「前」不是「不建工坊的世界线」；');
console.log('    不建工坊的世界线见下一节 1b（那才是「全程不建、按 ×' + MANUAL_MULT + ' 手工价开火」的整局）。');

// ------------------------------------------------------------
// 1b. 对照世界线：全程不建工坊（手工价 ×MANUAL_MULT）
// ------------------------------------------------------------
section('1b. 对照线：全程不建工坊（每发 ×' + MANUAL_MULT + ' 手工价）——工坊是「前提」还是「加速器」');
{
    const noWs = runGame({ buyWorkshopAt: null });
    console.log('波 | 不建工坊 可负担 | 建工坊 可负担 | 参考A | 不建工坊够不够 | 存量 pyro/cryo');
    let firstShort = null;
    let allOk = true;
    for (let i = 0; i < noWs.length; i++) {
        const a = noWs[i];
        const b = rows[i];
        const ok = a.affordWs >= a.need;
        if (!ok) { allOk = false; if (firstShort === null) firstShort = a.w; }
        console.log(`${String(a.w).padStart(2)} | ${String(a.affordWs).padStart(16)} | ${String(b.affordWs).padStart(15)} | `
            + `${String(a.need).padStart(6)} | ${(ok ? '够' : '不够').padStart(14)} | ${a.stockBefore.pyro}/${a.stockBefore.cryo}`);
        check(a.affordWs <= b.affordWs,
            `1b.${a.w} 不建工坊可负担 ${a.affordWs} 发 ≤ 建工坊 ${b.affordWs} 发（工坊严格不差）`);
        check(a.affordWs >= 1, `1b.${a.w} 不建工坊也能打出 ${a.affordWs} 发 ≥ 1（不建不是死局）`);
    }
    if (allOk) {
        console.log(`  ⇒ 结论（如实报，不裁定）：p=1 之后「全程不建工坊」也能打满参考射速全部 8 波；`
            + `工坊从「能不能打第二发」的前提，降级为「每发料价减半 + 省下的料转建造」的加速器。`);
    } else {
        console.log(`  ⇒ 不建工坊线第 ${firstShort} 波起达不到参考射速 ⇒ 工坊仍是「达到参考射速」的前提之一。`);
    }
}

// ------------------------------------------------------------
// 2b. 每波可持续上限（不吃存量的边际口径）
// ------------------------------------------------------------
section('2. 每波可持续发数（只看本波料入，不吃存量）');
console.log('波 | pyro入 | 单料每发价 | 可持续发数(单料) | cryo入 | 双料每发价 | 可持续发数(均衡双料)');
for (const r of rows) {
    const single = Math.floor(r.pyroIn / (pricePerShot(DEFAULT_RECIPE, true).pyro || 1));
    const dual = RECIPES.find(x => x.id === 'ammo_pyro_cryo_dual');
    const dualStr = dual
        ? Math.min(
            Math.floor(r.pyroIn / (pricePerShot(dual, true).pyro || 1)),
            Math.floor(r.cryoIn / (pricePerShot(dual, true).cryo || 1)))
        : 'n/a';
    console.log(`${pad(r.w, 2)} | ${pad(r.pyroIn, 6)} | ${pad(priceStr(pricePerShot(DEFAULT_RECIPE, true)), 10)} | ${pad(single, 16)} | ${pad(r.cryoIn, 6)} | ${pad(dual ? priceStr(pricePerShot(dual, true)) : 'n/a', 10)} | ${pad(dualStr, 21)}`);
}

// ------------------------------------------------------------
// 2c. 上沿：满射速轨（A = 3 + ratePrices.length）靠什么撑
// ------------------------------------------------------------
section('3. 上沿（满射速轨）——储备制，不是可持续制');
const A_MAX = SHOTS_PER_TURN + RATE_PRICES.length;
console.log(`满射速轨 A = ${SHOTS_PER_TURN} + ${RATE_PRICES.length} 级 = ${A_MAX} 发/波`);
for (const r of rows) {
    console.log(`  波 ${r.w}：存量 ${r.stockBefore.pyro}/${r.stockBefore.cryo}，最省料配方 ${r.best.id}（${priceStr(r.best.price)}）⇒ 可负担 ${r.best.M} 发`
        + `${r.best.M >= A_MAX ? '（够满射速）' : `（差 ${A_MAX - r.best.M} 发）`}`);
}

// ------------------------------------------------------------
// 2d. 敏感带：命中数下沿仍够不够
// ------------------------------------------------------------
section('4. 敏感带（[模拟]：coloredHits 取 10 / 12 / 15，分桶按 4:7:1 比例缩放）');
for (const c of [C_LOW, 12, 15]) {
    const byBucket = { pyro: Math.round(c * 4 / 12), cryo: Math.round(c * 7 / 12), beast: Math.max(0, c - Math.round(c * 4 / 12) - Math.round(c * 7 / 12)) };
    const settled = settleWaveMaterials(normalizeLedger({ primaryHits: 52, coloredHits: Object.values(byBucket).reduce((a, b) => a + b, 0), coloredHitsByBucket: byBucket }), { perHitsPerMaterial: P, basicFloorPerWave: FLOOR });
    const priceWs = pricePerShot(DEFAULT_RECIPE, true);
    const shots = Math.floor(settled.byBucket.pyro / (priceWs.pyro || 1));
    console.log(`  彩色命中 ${c}（分桶 ${JSON.stringify(settled.byBucket)}）⇒ M=${settled.total}，单波可持续 ${shots} 发`);
    check(shots >= 2, `4.${c} 命中 ${c} 时单波可持续发数 ≥ 2（基础 A），实际 ${shots}`);
}

// ============================================================
// 5. 断言
// ============================================================
section('5. 关键不等式');

// A1
for (const r of rows) {
    check(r.affordWs >= r.need, `A1 第 ${r.w} 波：建工坊后可负担 ${r.affordWs} 发 ≥ 参考射速 ${r.need} 发`);
}
// A2
for (const r of rows) {
    check(r.affordWs >= 1, `A2 第 ${r.w} 波：建工坊后可负担 ${r.affordWs} 发 ≥ 1（不存在打不出第一发）`);
}
// A3
for (const r of rows) {
    check(r.affordManual < r.affordWs, `A3 第 ${r.w} 波：无工坊 ${r.affordManual} 发 < 有工坊 ${r.affordWs} 发（工坊正面收益成立）`);
    check(r.affordManual >= 1, `A3 第 ${r.w} 波：无工坊也能打出 ${r.affordManual} 发 ≥ 1`);
}
// A4 开局校准（仅启动料：与 config 注释逐字同口径，不含波末料入）
{
    const startLedger = normalizeLedger(START);
    const noWs = computeMaterialShots(startLedger, pricePerShot(DEFAULT_RECIPE, false)).M;
    const builtLedger = { ...startLedger };
    for (const key of MATERIAL_KEYS) builtLedger[key] -= Number(WORKSHOP_MAT[key]) || 0;
    const withWs = computeMaterialShots(builtLedger, pricePerShot(DEFAULT_RECIPE, true)).M;
    eq(noWs, 1, 'A4 仅启动料：不建工坊恰好 1 发');
    eq(withWs, 2, 'A4 仅启动料：建工坊恰好 2 发');
    eq(withWs, SHOTS_PER_TURN, 'A4 建工坊后 2 发 == 默认射速 A（config 注释里那条校准等式）');
    console.log(`  A4 口径提醒：本条只算 startMaterials；第一波整备屏实际还能看到本波料入`
        + `（实测读数里 producedThisWave=10 已在屏上），带料入的真实读数是 `
        + `无工坊 ${rows[0].affordManual} 发 / 有工坊 ${rows[0].affordWs} 发。`);
}
// A5 C10
{
    const floorCost = Number(DEFAULT_RECIPE.cost[FLOOR_BUCKET]) || 0;
    check(floorCost >= 1 && floorCost <= FLOOR, `A5 C10：最低档 ${DEFAULT_RECIPE.id} 的 ${FLOOR_BUCKET} 成本 ${floorCost} ∈ [1, ${FLOOR}]`);
}
// A6 不无限增长
{
    const base = normalizeLedger({ pyro: 0, cryo: 0 });
    const counter = { primaryHits: 52, coloredHits: 12, coloredHitsByBucket: { pyro: 3, cryo: 8, beast: 1 } };
    const once = settleWaveMaterials(normalizeLedger({ ...base, ...counter }), { perHitsPerMaterial: P, basicFloorPerWave: FLOOR });
    const twice = settleWaveMaterials(normalizeLedger({ ...once.ledger }), { perHitsPerMaterial: P, basicFloorPerWave: FLOOR });
    eq(twice.total, once.total, 'A6 同一份计数器重复结算 ⇒ 每次入料相同（不因存量变大而变多，无复利）');
    eq(once.total, FLOOR + Math.floor(12 / P), 'A6 M = FLOOR + floor(coloredHits / p)');
    const rich = settleWaveMaterials(normalizeLedger({ pyro: 9999, cryo: 9999, ...counter }), { perHitsPerMaterial: P, basicFloorPerWave: FLOOR });
    eq(rich.total, once.total, 'A6 存量 9999 时料入不变（收入与存量解耦）');
    const dry = settleWaveMaterials(normalizeLedger({ pyro: 50, cryo: 50, primaryHits: 0, coloredHits: 0, coloredHitsByBucket: {} }), { perHitsPerMaterial: P, basicFloorPerWave: FLOOR });
    eq(dry.total, FLOOR, `A6 零命中（干回合）只给保底 ${FLOOR}（不按存量补）`);
}
// A7 上界
{
    const cMax = Math.max(...WAVES.map(w => w.coloredHits));
    for (const r of rows) {
        check(r.M <= FLOOR + Math.ceil(cMax / P), `A7 第 ${r.w} 波：料入 M=${r.M} ≤ 上界 ${FLOOR + Math.ceil(cMax / P)}`);
    }
}
// A8 单波稀缺（取舍形式：打满参考射速 ⟂ 建满设施）
{
    const trioPyro = ['workshop', 'generator', 'battery'].reduce((s, k) => s + (Number(FAC[k] && FAC[k].materials && FAC[k].materials.pyro) || 0), 0);
    const trioCryo = ['workshop', 'generator', 'battery'].reduce((s, k) => s + (Number(FAC[k] && FAC[k].materials && FAC[k].materials.cryo) || 0), 0);
    console.log(`  A8 三件料付设施地基合计：pyro ${trioPyro} / cryo ${trioCryo}（开火线 = ${DUAL_RECIPE.id}）`);
    console.log('  波 | 入pyro 入cryo | 耗pyro 耗cryo | 余pyro 余cryo | 三件价 | 判定（余 < 三件价 ⇒ 打满就建不满）');
    for (const r of rows) {
        const okP = r.pyroIn < r.dualSpendPyro + trioPyro;
        const okC = r.cryoIn < r.dualSpendCryo + trioCryo;
        console.log(`  ${String(r.w).padStart(2)} | ${String(r.pyroIn).padStart(6)} ${String(r.cryoIn).padStart(6)} | `
            + `${String(r.dualSpendPyro).padStart(6)} ${String(r.dualSpendCryo).padStart(6)} | `
            + `${String(r.dualSurplusPyro).padStart(6)} ${String(r.dualSurplusCryo).padStart(6)} | `
            + `${String(trioPyro)}/${String(trioCryo)} | pyro ${okP ? 'ok' : 'NO'} / cryo ${okC ? 'ok' : 'NO'}`);
        check(okP, `A8 第 ${r.w} 波 pyro：本波入 ${r.pyroIn} < 开火耗 ${r.dualSpendPyro} + 三件设施 ${trioPyro}`
            + `（打满参考射速就建不满设施）`);
        check(okC, `A8 第 ${r.w} 波 cryo：本波入 ${r.cryoIn} < 开火耗 ${r.dualSpendCryo} + 三件设施 ${trioCryo}`
            + `（打满参考射速就建不满设施）`);
    }
}
// A9 整局稀缺
{
    const sink = { pyro: 0, cryo: 0 };
    for (const key of Object.keys(FAC)) {
        const f = FAC[key];
        if (!f || typeof f !== 'object') continue;
        for (const k of ['pyro', 'cryo']) sink[k] += Number(f.materials && f.materials[k]) || 0;
        for (const up of (Array.isArray(f.upMaterials) ? f.upMaterials : [])) {
            for (const k of ['pyro', 'cryo']) sink[k] += Number(up && up[k]) || 0;
        }
    }
    for (const step of (Array.isArray(GRID.expandCost) ? GRID.expandCost : [])) {
        for (const k of ['pyro', 'cryo']) sink[k] += Number(step && step[k]) || 0;
    }
    const last = rows[rows.length - 1];
    const leftover = last.stockAfter.pyro + last.stockAfter.cryo;
    const totalSink = sink.pyro + sink.cryo;
    const trioPyro = ['workshop', 'generator', 'battery'].reduce((s, k) => s + (Number(FAC[k] && FAC[k].materials && FAC[k].materials.pyro) || 0), 0);
    const trioCryo = ['workshop', 'generator', 'battery'].reduce((s, k) => s + (Number(FAC[k] && FAC[k].materials && FAC[k].materials.cryo) || 0), 0);
    check(leftover < totalSink, `A9 第 8 波后剩余 ${leftover} < 全部料付设施+升级+扩建总价 ${totalSink}（买不全）`);
    // 下界：整局里最富的整备时点（按参考线开火、扣过工坊地基之后）能否付清三件地基。
    let best = { w: null, pyro: -1, cryo: -1 };
    for (const r of rows) {
        const affordTrio = Math.min(r.stockBefore.pyro / Math.max(1, trioPyro), r.stockBefore.cryo / Math.max(1, trioCryo));
        const cur = Math.min(best.pyro / Math.max(1, trioPyro), best.cryo / Math.max(1, trioCryo));
        if (affordTrio > cur) best = { w: r.w, pyro: r.stockBefore.pyro, cryo: r.stockBefore.cryo };
    }
    check(best.pyro >= trioPyro && best.cryo >= trioCryo,
        `A9 最富整备时点（第 ${best.w} 波：pyro ${best.pyro} / cryo ${best.cryo}）≥ 三件地基（pyro ${trioPyro} / cryo ${trioCryo}）⇒ 建设真能发生`);
    console.log(`  A9 料付总池：pyro ${sink.pyro} / cryo ${sink.cryo}（含升级与网格扩建）；8 波后剩余 pyro ${last.stockAfter.pyro} / cryo ${last.stockAfter.cryo}`
        + `；最富整备时点为第 ${best.w} 波 pyro ${best.pyro} / cryo ${best.cryo}`);
}
// A10 配方冻结护栏
{
    const expect = [
        { id: 'ammo_pyro_single', cost: { pyro: 3 }, elements: { pyro: 1, cryo: 0, lightning: 0 } },
        { id: 'ammo_pyro_cryo_dual', cost: { pyro: 2, cryo: 2 }, elements: { pyro: 1, cryo: 1, lightning: 0 } },
        { id: 'ammo_pyro_cryo_heavy', cost: { pyro: 1, cryo: 3 }, elements: { pyro: 1, cryo: 2, lightning: 0 } },
    ];
    eq(RECIPES.length, expect.length, 'A10 弹药配方条数 = 3');
    for (const exp of expect) {
        const got = RECIPES.find(r => r.id === exp.id);
        check(!!got, `A10 配方 ${exp.id} 存在`);
        if (!got) continue;
        eq(JSON.stringify(got.cost), JSON.stringify(exp.cost), `A10 ${exp.id} cost 冻结（${JSON.stringify(exp.cost)}）`);
        check(!Object.prototype.hasOwnProperty.call(got, 'damageMult'), `A10 ${exp.id} 不含已删除字段 damageMult`);
        eq(JSON.stringify(got.elements), JSON.stringify(exp.elements), `A10 ${exp.id} elements 冻结`);
    }
}
// A11 未拆分货币 / 未开免费额度
{
    for (const r of RECIPES) {
        const ok = validateShotCost(r.cost);
        check(ok.ok, `A11 ${r.id} 的 cost 结构合法（只用 pyro/cryo，beast 不参与）：${ok.errors.join(' / ') || 'ok'}`);
        const sum = Object.keys(r.cost).reduce((s, k) => s + Number(r.cost[k] || 0), 0);
        check(sum > 0, `A11 ${r.id} 不是 0 价（没有免费额度），总量 ${sum}`);
    }
}
// A12 兜底口径
{
    check(FLOOR >= BASIC_FLOOR_PER_WAVE, `A12 config basicFloorPerWave ${FLOOR} ≥ 纯函数层结构下限 ${BASIC_FLOOR_PER_WAVE}（config 只许更宽）`);
    eq(MATERIAL_KEYS.length, 3, 'A12 料的种类 = 3（pyro / cryo / beast，未拆成两种货币）');
}

// ============================================================
// 收尾
// ============================================================
console.log('\n===================================================');
console.log(`  通过 ${passed} / 失败 ${failed}`);
if (failed > 0) {
    console.log('  失败项：');
    for (const f of failures) console.log(`   - ${f}`);
}
console.log('===================================================');
process.exit(failed === 0 ? 0 : 1);
