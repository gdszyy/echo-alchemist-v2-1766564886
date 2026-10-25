/**
 * validate_power_wiring.mjs - [REQ-20261022-wave-loop · 四轴接线] 电池容量 / 每发成本单一出口 / 四轴合成 验收。
 *
 * 为什么有这个文件：前八步把四条纯函数（`computeMaterialShots` / `pickBindingLimit` / `computePowerShots` /
 *   `resolveWorkshopCapacity`）都写好并有测试了，但**实机验收证实 `U` 与 `E` 两轴从来没真生效过**：
 *   `src/game_phase.js` 找不到 `build.workshop.capacityByLevel` ⇒ `calibrated = false` ⇒ `U = Infinity`；
 *   找不到 `power.powerPerShot` ⇒ `E = Infinity`；且 `batteryReserve` 被硬编码成 `0`（电池建了毫无作用）。
 *   本文件守的就是这三条**接线本身**（纯函数层的正确性由各步自己的测试守，这里不重测）。
 *
 * 五段：
 *   A. 电池容量：`baseCapacity` 必计入；单座 Lv1/Lv2/Lv3 贡献 = `capacity[lv-1]`（**增量口径**）；多座相加；缺键按 0 且留痕。
 *   B. 每发成本出口：无工坊 ×`manualMaterialMultiplier`、有工坊原价、倍率缺失/非正 ⇒ ×1 且 warn、幂等。
 *   C. 四轴合成：A/U/E/M 串一条完整算例（三组 + 两个变体），中间量逐条断言，不只断 `N`。
 *   D. 静态守门：`computeMaterialShots(` / `mat_chargeShotMaterials(` / `mat_payLoadout(` 的实参里
 *      **没有第二条 `costByMaterial` 直读路径**（屏上报价与实扣料必须同源）。
 *   E. 预演形状：既有键齐全且类型不变；`perShotCost` / `plannedSpent` 自洽。
 *
 * 数值来源纪律：本文件的期望值**全部先按 `src/config.js` 的档位算式手推**再写死（回报里逐组给出算术过程），
 *   不是「先跑一遍看输出、把输出抄成期望」——那样是自证不是测试。
 *   用到的配置现状（`[盘上]`，`src/config.js`，行号为改后实读）：
 *     `power.powerPerShot = 2`（:1009）；`power.battery.baseCapacity = 15`（:1011，[Owner] D7）；
 *     `power.battery.capacity = [15, 25, 40]`（:1012，**单座该等级的增量**）；`power.generate.generator = [10, 15, 20]`（:1004）；
 *     `power.draw.workshop = [4, 6, 8]`（:998）；`power.draw.turret = [4, 6, 8]`（:994）；`power.draw.frost = [6, 9, 12]`（:995）；
 *     `workshop.capacityByLevel = [3, 4, 5]`（:1069，**域内合法 ⇒ C/E 段直接用真表，不再注入夹具**）；
 *     `workshop.manualMaterialMultiplier = 2`（:1072）。
 *   默认弹药配方（未选、非设计图档里 `cost` 总量最低者）= `ammo_pyro_single`，`cost = { pyro: 3 }`。
 *
 * Usage:
 *   node tests/validate_power_wiring.mjs
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CONFIG } from '../src/config.js';
import { game_phase } from '../src/game_phase.js';
import { material_system } from '../src/material_system.js';
import { normalizeLedger } from '../src/utils/material_economy_utils.js';
import { computeMaterialShots, computePowerShots, pickBindingLimit } from '../src/utils/material_loadout_utils.js';
import { computeAvailablePower } from '../src/utils/power_budget_utils.js';
import { resolveWorkshopCapacity, validateCapacityTable } from '../src/utils/workshop_capacity_utils.js';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const readSrc = rel => fs.readFileSync(path.join(repoRoot, rel), 'utf8');

let passed = 0;
let failed = 0;
const failures = [];

function check(condition, name) {
    if (condition) {
        passed++;
        console.log(`  PASS  ${name}`);
    } else {
        failed++;
        failures.push(name);
        console.log(`  FAIL  ${name}`);
    }
}
function eq(actual, expected, name) {
    check(Object.is(actual, expected) || actual === expected,
        `${name}（实测 ${JSON.stringify(actual)} / 期望 ${JSON.stringify(expected)}）`);
}
function deepEq(actual, expected, name) {
    const a = JSON.stringify(actual);
    const b = JSON.stringify(expected);
    check(a === b, `${name}（实测 ${a} / 期望 ${b}）`);
}
function section(title) {
    console.log(`\n=== ${title} ===`);
}

/** 捕获 `console.warn`：返回 fn 的返回值 + 期间的 warn 文本（缺键留痕类断言要用）。 */
function captureWarns(fn) {
    const warns = [];
    const orig = console.warn;
    console.warn = (...args) => { warns.push(args.map(a => String(a)).join(' ')); };
    try {
        return { value: fn(), warns };
    } finally {
        console.warn = orig;
    }
}

// ------------------------------------------------------------------ 夹具
const buildCfg = (CONFIG.gameplay && CONFIG.gameplay.build) || {};
const powerCfg = buildCfg.power || {};

function setManualMultiplier(v) {
    if (v === undefined) delete buildCfg.workshop.manualMaterialMultiplier;
    else buildCfg.workshop.manualMaterialMultiplier = v;
}

/**
 * 产能表：**C/E 段直接用真配置表**（`CONFIG.gameplay.build.workshop.capacityByLevel` = `[3, 4, 5]`）。
 * 本文件曾注入 `[4, 5, 5]` 夹具绕障——因为旧真表 `[4, 6, 8]` 的 Lv2 = 6 / Lv3 = 8 **超出第 1 步
 *   `validateWorkshopCapacity` 的 `1..5` 取值域**（`material_loadout_utils.js:64-68`：`WORKSHOP_CAPACITY_MAX = 5`、
 *   初始值必须 `< 5`），会让 `phase_wavePreviewCore → pickWorkshop → validateCapacityTable` 对**任意等级**的工坊抛
 *   `RangeError`。真表已改为域内合法（见 F 段正面断言），夹具**按纪律删除**：
 *   留着它就等于用一张「盘上并不存在的表」证明接线正确。
 * 若将来配置文件里其它键确实会干扰算例，隔离手法应**只替换产能表这一项**并在注释里写明原因；现在没有这个需要，
 *   故本文件对 `capacityByLevel` 不做任何注入。
 */

/**
 * 假宿主：把 `material_system` 与 `game_phase` 的方法绑上去（与既有 `validate_wave_freeze.mjs` 的 makeHost 同一手法）。
 * `shots` = 射速轨上限 `A`（`sys_getCannonStats()` 的产物，这里直接给定，不重算）。
 */
function makeHost(opts = {}) {
    const round = opts.round === undefined ? 1 : opts.round;
    const host = {
        round,
        facilities: (opts.facilities || []).slice(),
        cannonLevels: {},
        _testShots: opts.shots === undefined ? 2 : opts.shots,
        _digDoneRound: opts.digDoneRound === undefined ? round : opts.digDoneRound,
        _selectedRecipeId: opts.recipeId === undefined ? null : opts.recipeId,
        sys_getCannonStats() {
            return { shots: this._testShots, damage: 10, bounce: 0, branch: null };
        },
    };
    for (const [k, v] of Object.entries(material_system)) if (typeof v === 'function') host[k] = v.bind(host);
    for (const [k, v] of Object.entries(game_phase)) if (typeof v === 'function') host[k] = v.bind(host);
    host.sys_initMaterialLedger();
    if (opts.ledger) host.materialLedger = normalizeLedger(opts.ledger);
    return host;
}

const ws = level => ({ type: 'workshop', level });
const gen = level => ({ type: 'generator', level });
const turret = level => ({ type: 'turret', level });
const frost = level => ({ type: 'frost', level });
const battery = level => ({ type: 'battery', level });

console.log('[四轴接线] 电池容量 / 每发成本单一出口 / 四轴合成 验收');
console.log(`  盘上配置：[盘上] powerPerShot = ${JSON.stringify(powerCfg.powerPerShot)}`
    + ` · battery = ${JSON.stringify(powerCfg.battery)}`
    + ` · workshop = ${JSON.stringify(buildCfg.workshop)}`);

// ============================================================ A
section('A. 电池容量：baseCapacity 必计入 / 单座是增量口径 / 多座相加 / 缺键按 0 且留痕');

{
    // A1：真配置 + 未建电池 ⇒ 只剩底容量。15 + 0 = 15。
    eq(game_phase.phase_batteryReserve(powerCfg, []), 15,
        'A1 未建电池 ⇒ reserve = baseCapacity = 15（[Owner] D7 的底容量必须计入，接线前这里是硬编码 0）');

    // A2–A4：单座三级的贡献是 `capacity[lv-1]`（增量），不是绝对值。
    eq(game_phase.phase_batteryReserve(powerCfg, [battery(1)]), 30,
        'A2 单座 Lv1 ⇒ 15 + capacity[0]=15 = 30（当绝对值读会得 15，Lv1 电池等于不加容）');
    eq(game_phase.phase_batteryReserve(powerCfg, [battery(2)]), 40,
        'A3 单座 Lv2 ⇒ 15 + capacity[1]=25 = 40');
    eq(game_phase.phase_batteryReserve(powerCfg, [battery(3)]), 55,
        'A4 单座 Lv3 ⇒ 15 + capacity[2]=40 = 55');

    // A5：多座相加（电池现为 unique，但口径不假设只有一座）。
    eq(game_phase.phase_batteryReserve(powerCfg, [battery(1), battery(3)]), 70,
        'A5 两座（Lv1 + Lv3）⇒ 15 + 15 + 40 = 70（按座相加，不取最高级）');

    // A6：capacity 缺失 ⇒ 该座贡献 0，且必须留痕（点名缺哪个键）。
    {
        const r = captureWarns(() => game_phase.phase_batteryReserve({ battery: { baseCapacity: 15 } }, [battery(1)]));
        eq(r.value, 15, 'A6a capacity 缺键 ⇒ 该座按 0，reserve 仍是底容量 15（不静默编一个数）');
        check(r.warns.some(w => w.includes('battery.capacity')),
            `A6b capacity 缺键必须留痕（warn 点名 build.power.battery.capacity），实测 warns = ${JSON.stringify(r.warns)}`);
    }

    // A7：baseCapacity 缺失 ⇒ 按 0，且必须留痕。
    {
        const r = captureWarns(() => game_phase.phase_batteryReserve({ battery: { capacity: [15, 25, 40] } }, []));
        eq(r.value, 0, 'A7a baseCapacity 缺键 ⇒ 按 0');
        check(r.warns.some(w => w.includes('baseCapacity')),
            `A7b baseCapacity 缺键必须留痕（warn 点名该键），实测 warns = ${JSON.stringify(r.warns)}`);
    }

    // A8：误传 `build`（而不是 `power`）也能吃，内部取 `.power`（防止调用点写错一级就静默变 0）。
    eq(game_phase.phase_batteryReserve(buildCfg, []), 15,
        'A8 传 build（含 .power）与传 power 同值 ⇒ 15（不因多/少一级包装丢配置）');
}

// ============================================================ B
section('B. 每发逐料成本单一出口：无工坊 ×倍率 / 有工坊原价 / 倍率缺键或非正 ⇒ ×1 且 warn / 幂等');
{
    // B1：无工坊 ⇒ 原价 3 × 2 = 6。
    const hostNoWs = makeHost({ round: 1, shots: 5, ledger: { pyro: 30 } });
    deepEq(hostNoWs.phase_shotCostByMaterial(buildCfg), { pyro: 6 },
        'B1 无工坊 ⇒ 配方原价 { pyro: 3 } × manualMaterialMultiplier 2 = { pyro: 6 }');

    // B2：有工坊 ⇒ 原价。
    const hostWs = makeHost({ round: 1, shots: 5, ledger: { pyro: 30 }, facilities: [ws(1)] });
    deepEq(hostWs.phase_shotCostByMaterial(buildCfg), { pyro: 3 },
        'B2 已建工坊 ⇒ 恢复原价 { pyro: 3 }（工坊的正面收益：省一半料）');

    // B3：倍率缺键 ⇒ ×1 且 warn（**不许按 2 兜底**：缺键时静默加倍会让玩家莫名变穷）。
    {
        setManualMultiplier(undefined);
        const r = captureWarns(() => hostNoWs.phase_shotCostByMaterial(buildCfg));
        deepEq(r.value, { pyro: 3 }, 'B3a manualMaterialMultiplier 缺键 ⇒ 按 1（不是按 2 兜底）');
        check(r.warns.some(w => w.includes('manualMaterialMultiplier')),
            `B3b 倍率缺键必须留痕（warn 点名该键），实测 warns = ${JSON.stringify(r.warns)}`);
        setManualMultiplier(2);
    }

    // B4：倍率非正整数（0 / 负数 / 小数）⇒ 一律按 1 且 warn。
    {
        const cases = [0, -2, 1.5];
        for (const v of cases) {
            setManualMultiplier(v);
            const r = captureWarns(() => hostNoWs.phase_shotCostByMaterial(buildCfg));
            deepEq(r.value, { pyro: 3 }, `B4 manualMaterialMultiplier = ${JSON.stringify(v)}（非正整数）⇒ 按 1`);
            check(r.warns.length > 0, `B4w manualMaterialMultiplier = ${JSON.stringify(v)} ⇒ 留痕 warn`);
        }
        setManualMultiplier(2);
    }

    // B5：幂等 —— 同一波内连调两次同值，且不写任何运行时状态。
    {
        const before = JSON.stringify({
            frozen: hostNoWs._materialFrozenRecord === undefined ? null : hostNoWs._materialFrozenRecord,
            loadRound: hostNoWs._materialLoadRound === undefined ? null : hostNoWs._materialLoadRound,
            settleRound: hostNoWs._materialSettleRound === undefined ? null : hostNoWs._materialSettleRound,
            ledger: hostNoWs.materialLedger,
        });
        const first = hostNoWs.phase_shotCostByMaterial(buildCfg);
        const second = hostNoWs.phase_shotCostByMaterial(buildCfg);
        deepEq(second, first, 'B5a 连调两次逐键同值（幂等）');
        const after = JSON.stringify({
            frozen: hostNoWs._materialFrozenRecord === undefined ? null : hostNoWs._materialFrozenRecord,
            loadRound: hostNoWs._materialLoadRound === undefined ? null : hostNoWs._materialLoadRound,
            settleRound: hostNoWs._materialSettleRound === undefined ? null : hostNoWs._materialSettleRound,
            ledger: hostNoWs.materialLedger,
        });
        eq(after, before, 'B5b 调用不写任何运行时状态（冻结记录 / 去重标记 / 料账一字未动）');
        eq(hostNoWs.materialLedger.pyro, 30, 'B5c 余额未被本方法动过（仍 30）');
    }

    // B6：双料配方 —— 返回只含正数料键，且逐键各自乘倍率。
    {
        const hostDual = makeHost({ round: 1, shots: 5, ledger: { pyro: 9, cryo: 9 }, recipeId: 'ammo_pyro_cryo_dual' });
        deepEq(hostDual.phase_shotCostByMaterial(buildCfg), { pyro: 4, cryo: 4 },
            'B6a 双料 · 无工坊 ⇒ { pyro: 2×2, cryo: 2×2 } = { pyro: 4, cryo: 4 }');
        const hostDualWs = makeHost({
            round: 1, shots: 5, ledger: { pyro: 9, cryo: 9 }, recipeId: 'ammo_pyro_cryo_dual', facilities: [ws(1)],
        });
        deepEq(hostDualWs.phase_shotCostByMaterial(buildCfg), { pyro: 2, cryo: 2 },
            'B6b 双料 · 有工坊 ⇒ { pyro: 2, cryo: 2 }（原价）');
    }
}

// ============================================================ F
section('F. 盘上诊断：build.workshop.capacityByLevel 必须真的过 validateCapacityTable（域内合法）');

{
    const table = buildCfg.workshop && buildCfg.workshop.capacityByLevel;
    let thrown = null;
    try {
        resolveWorkshopCapacity({ workshops: [{ slotIndex: 0, lv: 1, powered: true }], capacityByLevel: table });
    } catch (e) {
        thrown = e;
    }
    let thrownValidate = null;
    try {
        validateCapacityTable(table);
    } catch (e) {
        thrownValidate = e;
    }
    console.log(`  ── [盘上] build.workshop.capacityByLevel = ${JSON.stringify(table)}`);
    console.log(`  ── [实测] resolveWorkshopCapacity({ lv: 1, powered: true }) ⇒ ${thrown ? `${thrown.constructor.name}: ${thrown.message}` : '未抛错'}`);
    console.log(`  ── [实测] validateCapacityTable(真表) ⇒ ${thrownValidate ? `${thrownValidate.constructor.name}: ${thrownValidate.message}` : '未抛错'}`);
    if (thrownValidate) {
        console.log('  ── 结论：真表仍越出第 1 步 validateWorkshopCapacity 的 1..5 取值域（material_loadout_utils.js:64-68），');
        console.log('     phase_wavePreviewCore → pickWorkshop → validateCapacityTable 会对**任意等级**的工坊抛 RangeError ⇒ 建工坊即崩，');
        console.log('     此时 C/E 段的合成算例与实机不符，下面 F3 会判红。');
    } else {
        console.log('  ── 结论：真表域内合法 ⇒ C/E 段跑的**就是盘上真表**（不再有任何夹具），算例可直接对实机。');
    }
    check(Array.isArray(table) && table.length === 3, 'F1 真配置 capacityByLevel 是长度 3 的数组');
    eq(table[0], 3, 'F2 真表 Lv1 = 3（> 默认 A=2 ⇒ 默认打法不削；且 C2 的 U 直接取这个数）');
    check(thrownValidate === null,
        `F3 validateCapacityTable(真表) 不抛 —— 这条保护的是 C/E 两段算例本身可信（实测 ${thrownValidate ? `${thrownValidate.constructor.name}: ${thrownValidate.message}` : '未抛错'}）`);
    check(thrown === null,
        `F4 resolveWorkshopCapacity 对真表不抛（「建了工坊就崩」的旧形态已消失，实测 ${thrown ? `${thrown.constructor.name}: ${thrown.message}` : '未抛错'}）`);
}

// ============================================================ C
section('C. 四轴合成：A/U/E/M → N，逐组给足中间量');
// C/E 段直接用真配置表（`[3, 4, 5]`），不注入夹具：理由见 F 段与上方产能表注释。
// 因此下面每组的 `U` 都 = 3（= 真表 Lv1），与本文件曾用的夹具 `[4, 5, 5]`（U = 4）不同。

{
    // ---- C1：无工坊 ----
    // 算术：A = 5（夹具射速轨）；
    //   电池 = 15 + 0 = 15；发电 0（无发电机）；战斗设施耗电 0 ⇒ available = 15；
    //   工坊不存在 ⇒ U = Infinity、E = Infinity（两条闸门都不参与）；
    //   每发成本 = 3 × 2 = 6（手工造弹）⇒ M = floor(24 / 6) = 4；
    //   N = min(5, ∞, ∞, 4) = 4，bound = M。
    const host = makeHost({ round: 1, shots: 5, ledger: { pyro: 24 } });
    const core = host.phase_wavePreviewCore(5);
    eq(core.budget.battery, 15, 'C1a 电池容量 = 15（底容量，未建电池）');
    eq(core.budget.generator, 0, 'C1b 未建发电机 ⇒ 本波发电 0');
    eq(core.budget.facilityDraw, 0, 'C1c 无战斗设施 ⇒ 设施耗电 0');
    eq(core.restAfterCombat, 15, 'C1d available = 15 − 0 = 15');
    eq(core.workshop.exists, false, 'C1e 无工坊 ⇒ exists = false');
    eq(core.workshop.draw, 0, 'C1f 无工坊 ⇒ 抽电 0');
    eq(core.workshop.powered, false, 'C1f2 无工坊 ⇒ powered 恒 false（UI 侧不得把「未建造」读成「断电」）');
    eq(core.workshop.capacity, 0, 'C1g 无工坊 ⇒ 配置产能 0');
    eq(core.workshop.effectiveU, 0, 'C1h 无工坊 ⇒ 有效产能 0');
    eq(core.A, 5, 'C1i A = 5');
    eq(core.U, Infinity, 'C1j U = Infinity（未建工坊 ⇒ 不构成闸门，这是契约不是未接线）');
    eq(core.E, Infinity, 'C1k E = Infinity（无工坊 ⇒ 没有用电换弹这件事）');
    deepEq(core.shotCost, { pyro: 6 }, 'C1l 每发成本 = 3 × 2 = 6（手工溢价）');
    eq(core.M, 4, 'C1m M = floor(24 / 6) = 4（若按原价 3 会得 8 —— 溢价真的进 M 了）');
    eq(core.limit.N, 4, 'C1n N = min(5, ∞, ∞, 4) = 4');
    eq(core.limit.bound, 'M', 'C1o bound = M');
}

{
    // ---- C2：已建工坊通电、无发电机 ----
    // 算术：电池 = 15 + 0 = 15；发电 0（无发电机）；战斗设施耗电 0 ⇒ available = 15；
    //   工坊 Lv1 抽电 4（`power.draw.workshop[0]`）⇒ 15 ≥ 4 ⇒ 通电 ⇒ U = capacityByLevel[0] = 3（真表 [3,4,5]）；
    //   有工坊 ⇒ 每发成本回原价 3 ⇒ M = floor(30 / 3) = 10；
    //   E = floor((available 15 − 工坊抽电 4) / powerPerShot 2) = floor(11 / 2) = 5；
    //   N = min(A 5, U 3, E 5, M 10) = 3，bound = U（卡产能）。
    const host = makeHost({ round: 1, shots: 5, ledger: { pyro: 30 }, facilities: [ws(1)] });
    const core = host.phase_wavePreviewCore(5);
    eq(core.budget.battery, 15, 'C2a 电池容量 = 15');
    eq(core.budget.generator, 0, 'C2b 无发电机 ⇒ 发电 0（本组就是要断「只靠底容量也点得亮工坊」）');
    eq(core.budget.facilityDraw, 0, 'C2c0 只有工坊、无战斗设施 ⇒ 战斗设施耗电 0（工坊自己的 4 不进这一项）');
    eq(core.restAfterCombat, 15, 'C2c available = 15');
    eq(core.workshop.draw, 4, 'C2d 工坊 Lv1 抽电 = power.draw.workshop[0] = 4');
    eq(core.workshop.powered, true, 'C2e 15 ≥ 4 ⇒ 通电（等号也通电）');
    eq(core.workshop.capacity, 3, 'C2f 配置产能 = 真表 capacityByLevel[0] = 3');
    eq(core.workshop.effectiveU, 3, 'C2g 通电 ⇒ effectiveU = capacity = 3');
    eq(core.U, 3, 'C2h U = 3（这条轴现在真的生效了）');
    deepEq(core.shotCost, { pyro: 3 }, 'C2i 有工坊 ⇒ 原价 { pyro: 3 }');
    eq(core.M, 10, 'C2j M = floor(30 / 3) = 10');
    eq(core.E, 5, 'C2k E = floor((15 − 4) / 2) = 5（底容量 15 − 工坊 Lv1 耗电 4 = 11 ⇒ 11/2 = 5.5 ⇒ 5）');
    eq(core.limit.N, 3, 'C2l N = min(5, 3, 5, 10) = 3');
    eq(core.limit.bound, 'U', 'C2m bound = U（卡产能）');
    deepEq(host.phase_waveTieAxes(core.limit), [], 'C2n ties = []（单轴绑定 U）');
}

{
    // ---- C2b：两座塔 Lv1 共耗 8 → E 掉到 1（塔与弹抢电）----
    // 算术：available = 15 − (4 + 4) = 7；工坊抽 4 ⇒ 7 ≥ 4 仍通电 ⇒ U = 3（真表 Lv1）；
    //   E = floor((7 − 4) / 2) = floor(3 / 2) = 1；M = 10；A = 5 ⇒ N = min(5, 3, 1, 10) = 1，bound = E。
    const host = makeHost({ round: 1, shots: 5, ledger: { pyro: 30 }, facilities: [ws(1), turret(1), turret(1)] });
    const core = host.phase_wavePreviewCore(5);
    eq(core.budget.battery, 15, 'C2b0 未建电池 ⇒ 电池容量 = 底容量 15');
    eq(core.budget.generator, 0, 'C2b0b 无发电机 ⇒ 发电 0');
    eq(core.budget.facilityDraw, 8, 'C2b1 两座炮台 Lv1 耗电 = 4 + 4 = 8');
    eq(core.restAfterCombat, 7, 'C2b2 available = 15 − 8 = 7');
    eq(core.workshop.draw, 4, 'C2b2b 工坊 Lv1 自身抽电 = 4（不计入 facilityDraw，但要从 available 里扣）');
    eq(core.workshop.powered, true, 'C2b3 7 ≥ 4 ⇒ 工坊仍通电');
    eq(core.workshop.capacity, 3, 'C2b3b 配置产能 = 真表 Lv1 = 3');
    eq(core.workshop.effectiveU, 3, 'C2b3c 通电 ⇒ effectiveU = 3');
    eq(core.U, 3, 'C2b4 U = 3');
    eq(core.M, 10, 'C2b4b M = floor(30 / 3) = 10（有工坊 ⇒ 原价）');
    eq(core.E, 1, 'C2b5 E = floor((7 − 4) / 2) = 1');
    eq(core.limit.N, 1, 'C2b6 N = min(5, 3, 1, 10) = 1');
    eq(core.limit.bound, 'E', 'C2b7 bound = E（卡电）');
    deepEq(core.shedOptions, [{ key: 'turret#1', draw: 4 }, { key: 'turret#2', draw: 4 }],
        'C2b8 shedOptions 指出两座炮台各可腾 4 电（同耗电按槽位号排）');
}

{
    // ---- C2c：建一座电池 Lv1 ⇒ 底容量 15 + 增量 15 = 30，E 从 5 涨到 13 ----
    // 算术：available = 30 − 0 = 30；工坊抽 4 ⇒ 通电 ⇒ U = 3（真表 Lv1）；
    //   E = floor((30 − 4) / 2) = 13；M = 10；A = 5 ⇒ N = min(5, 3, 13, 10) = 3（此时卡 U，不卡电）。
    const host = makeHost({ round: 1, shots: 5, ledger: { pyro: 30 }, facilities: [ws(1), battery(1)] });
    const core = host.phase_wavePreviewCore(5);
    eq(core.budget.battery, 30, 'C2c1 电池容量 = 15 + capacity[0]=15 = 30（增量口径）');
    eq(core.budget.generator, 0, 'C2c1b 无发电机 ⇒ 发电 0');
    eq(core.budget.facilityDraw, 0, 'C2c1c 电池不耗电 ⇒ 战斗设施耗电 0');
    eq(core.restAfterCombat, 30, 'C2c2 available = 30（电池不耗电，不进设施耗电合计）');
    eq(core.workshop.draw, 4, 'C2c2b 工坊 Lv1 抽电 = 4');
    eq(core.workshop.powered, true, 'C2c3 通电');
    eq(core.workshop.capacity, 3, 'C2c3b 配置产能 = 真表 Lv1 = 3');
    eq(core.workshop.effectiveU, 3, 'C2c3c 通电 ⇒ effectiveU = 3');
    eq(core.U, 3, 'C2c3d U = 3');
    eq(core.M, 10, 'C2c3e M = floor(30 / 3) = 10');
    eq(core.E, 13, 'C2c4 E = floor((30 − 4) / 2) = 13');
    eq(core.limit.N, 3, 'C2c5 N = min(5, 3, 13, 10) = 3');
    eq(core.limit.bound, 'U', 'C2c6 bound = U');
}

{
    // ---- C3：已建工坊断电 ----
    // 算术：available = 15 − (炮台 Lv3 8 + 冰霜 Lv3 12) = −5（赤字，允许为负，不归 0）；
    //   工坊抽 4 ⇒ −5 < 4 ⇒ 断电 ⇒ U = 0（配置产能 capacity 仍保持 3（真表 Lv1），不被 0 污染）；
    //   断电 ⇒ E = 0；工坊存在 ⇒ 每发成本原价 3 ⇒ M = floor(300 / 3) = 100；
    //   N = min(5, 0, 0, 100) = 0，bound = U，ties 过滤掉 bound 后 = ['E']。
    const host = makeHost({ round: 1, shots: 5, ledger: { pyro: 300 }, facilities: [ws(1), turret(3), frost(3)] });
    const core = host.phase_wavePreviewCore(5);
    eq(core.budget.battery, 15, 'C3a0 未建电池 ⇒ 电池容量 = 底容量 15');
    eq(core.budget.generator, 0, 'C3a0b 炮台 / 冰霜都不发电 ⇒ 发电 0');
    eq(core.budget.facilityDraw, 20, 'C3a 炮台 Lv3 8 + 冰霜 Lv3 12 = 20');
    eq(core.restAfterCombat, -5, 'C3b available = 15 − 20 = −5（赤字原样保留，不静默归 0）');
    eq(core.workshop.draw, 4, 'C3b2 工坊 Lv1 自身抽电 = 4');
    eq(core.workshop.powered, false, 'C3c −5 < 4 ⇒ 断电');
    eq(core.workshop.capacity, 3, 'C3d 断电时配置产能仍是 3（真表 Lv1，不被 0 污染）');
    eq(core.workshop.effectiveU, 0, 'C3e 断电 ⇒ effectiveU = 0');
    eq(core.U, 0, 'C3f U = 0');
    eq(core.E, 0, 'C3g E = 0（工坊是把电换成弹的转换器，断电换不出弹）');
    deepEq(core.shotCost, { pyro: 3 }, 'C3h 工坊存在 ⇒ 每发原价 3（断电与溢价是两件事，按契约只看 exists）');
    eq(core.M, 100, 'C3i M = floor(300 / 3) = 100');
    eq(core.limit.N, 0, 'C3j N = min(5, 0, 0, 100) = 0');
    eq(core.limit.bound, 'U', 'C3k bound = U');
    deepEq(host.phase_waveTieAxes(core.limit), ['E'], 'C3l ties = [E]（U 是绑定轴，不进 ties）');

    // 断电 ⇒ 本波真 0 发，且不入料账。
    const frozen = host.phase_freezeWaveRecord(5);
    eq(frozen.N, 0, 'C3m 冻结记录 N = 0（不被「至少补 1 发」的兜底钳回 1）');
    deepEq(frozen.spent, { pyro: 0, cryo: 0 }, 'C3n 0 发不扣料：spent 全 0');
    eq(host.materialLedger.pyro, 300, 'C3o 余额一字未动（仍 300）');
}

{
    // ---- C4：「预演说几发」与「实际扣几发料」必须同源 ----
    // 无工坊：每发 6 料（手工溢价）。预演 N = floor(24/6) = 4 ⇒ 实扣 4 × 6 = 24，余 0。
    // 若两条路径不同源（预演按原价 3、实扣按 6），实扣会只扣得出 floor(24/6)=4 发但账面口径对不上；
    // 这里直接把「预演 N」「实扣 spent」「余料」三件一起锁死。
    const host = makeHost({ round: 2, shots: 5, ledger: { pyro: 24 } });
    const preview = host.sys_getWavePreview();
    eq(preview.shots, 4, 'C4a 预演 N = 4');
    deepEq(preview.perShotCost, { pyro: 6 }, 'C4b 预演每发成本 = 6（含手工溢价）');
    deepEq(preview.plannedSpent, { pyro: 24, cryo: 0, beast: 0, total: 24 }, 'C4c 预演将扣料 = 4 × 6 = 24');
    const frozen = host.phase_freezeWaveRecord(5);
    eq(frozen.N, 4, 'C4d 冻结 N 与预演一致 = 4');
    deepEq(frozen.spent, { pyro: 24, cryo: 0 }, 'C4e 实扣 = 4 × 6 = 24（与 plannedSpent 逐键相等，不是按原价扣 12）');
    eq(host.materialLedger.pyro, 0, 'C4f 余额 24 − 24 = 0');
}

// ============================================================ D
section('D. 静态守门：每发成本只有一条路径（除 phase_shotCostByMaterial 外不许直读 costByMaterial）');

{
    const src = readSrc('src/game_phase.js');
    // 先剔掉整行 `//` 注释：回滚说明与历史注释里会留旧形态，那是有意保留的（不许把注释判成违规）。
    const codeOnly = src.split('\n').filter(ln => !/^\s*\/\//.test(ln)).join('\n');

    /** 取某函数名在源码里的**全部调用实参文本**（做括号配平，避免内层调用的 ')' 早停）。 */
    function callArgs(text, name) {
        const out = [];
        const re = new RegExp(`${name}\\s*\\(`, 'g');
        let m;
        while ((m = re.exec(text)) !== null) {
            let i = m.index + m[0].length - 1;   // 指向 '('
            const start = i + 1;
            let depth = 0;
            for (; i < text.length; i++) {
                const ch = text[i];
                if (ch === '(') depth++;
                else if (ch === ')') { depth--; if (depth === 0) break; }
            }
            out.push(text.slice(start, i));
            re.lastIndex = i + 1;
        }
        return out;
    }

    const matCalls = callArgs(codeOnly, 'computeMaterialShots');
    check(matCalls.length >= 1, `D1a game_phase.js 里 computeMaterialShots 有调用（实测 ${matCalls.length} 处）`);
    check(matCalls.every(a => !a.includes('costByMaterial')),
        `D1b computeMaterialShots 的实参里没有 costByMaterial 直读（唯一出口 = phase_shotCostByMaterial），实测 ${JSON.stringify(matCalls)}`);
    check(matCalls.some(a => a.includes('shotCost')),
        `D1c computeMaterialShots 至少一处吃 shotCost（新出口的产物），实测 ${JSON.stringify(matCalls)}`);

    const chargeCalls = callArgs(codeOnly, 'mat_chargeShotMaterials');
    check(chargeCalls.length >= 1, `D2a game_phase.js 里 mat_chargeShotMaterials 有调用（实测 ${chargeCalls.length} 处）`);
    check(chargeCalls.every(a => !a.includes('costByMaterial')),
        `D2b mat_chargeShotMaterials 的实参里没有 costByMaterial 直读（实扣料必须与预演同源），实测 ${JSON.stringify(chargeCalls)}`);
    check(chargeCalls.some(a => a.includes('shotCost')),
        `D2c mat_chargeShotMaterials 至少一处吃 shotCost，实测 ${JSON.stringify(chargeCalls)}`);

    const payCalls = callArgs(codeOnly, 'mat_payLoadout');
    check(payCalls.every(a => !a.includes('costByMaterial')),
        `D3 mat_payLoadout 的实参里没有 costByMaterial 直读，实测 ${JSON.stringify(payCalls)}`);

    // 出口本身必须存在并且被 ≥ 2 处消费（定义 + 预演核心 + 外部调用）。
    const costFnCalls = callArgs(codeOnly, 'phase_shotCostByMaterial');
    check(costFnCalls.length >= 2, `D4 phase_shotCostByMaterial 至少 2 处调用（独占出口），实测 ${costFnCalls.length} 处`);
    check(!/batteryReserve\s*:\s*0/.test(codeOnly),
        'D5 game_phase.js 里没有 `batteryReserve: 0` 硬编码（电池容量必须按配置算）');
}

// ============================================================ E
section('E. sys_getWavePreview：既有键齐全且类型不变；perShotCost / plannedSpent 自洽');

{
    const host = makeHost({ round: 3, shots: 5, ledger: { pyro: 30 }, facilities: [ws(1)] });
    const preview = host.sys_getWavePreview();

    // 既有契约（键名与类型一字不许改；本段只追加、不改既有）
    const shape = {
        round: 'number',
        shots: 'number',
        bound: 'string',
        ties: 'object',        // 数组（无并列 ⇒ []）
    };
    for (const [key, type] of Object.entries(shape)) {
        check(Object.prototype.hasOwnProperty.call(preview, key), `E1 ${key} 仍在返回里`);
        eq(typeof preview[key], type, `E2 ${key} 类型仍是 ${type}`);
    }
    check(Array.isArray(preview.ties), 'E3 ties 仍是数组');
    check(preview.detail && typeof preview.detail === 'object', 'E4 detail 仍存在且是对象');
    for (const axis of ['A', 'U', 'E', 'M']) {
        check(Object.prototype.hasOwnProperty.call(preview.detail, axis), `E5 detail.${axis} 仍在返回里`);
        check(preview.detail[axis] === null || typeof preview.detail[axis] === 'number',
            `E6 detail.${axis} 仍是数字或 null（Infinity 在 JSON 下渲染成 null）`);
    }
    eq(typeof preview.dry, 'boolean', 'E7 dry 仍是布尔');
    check(preview.recipeId === null || typeof preview.recipeId === 'string', 'E8 recipeId 仍是字符串或 null');
    eq(typeof preview.workshopBuilt, 'boolean', 'E9 workshopBuilt 仍是布尔');
    eq(typeof preview.powered, 'boolean', 'E10 powered 仍是布尔');
    check(Array.isArray(preview.shedOptions), 'E11 shedOptions 仍是数组');

    // 追加键
    check(preview.perShotCost && typeof preview.perShotCost === 'object', 'E12 perShotCost 是对象（追加键）');
    deepEq(preview.perShotCost, { pyro: 3 }, 'E13 有工坊 ⇒ perShotCost = { pyro: 3 }');
    const ps = preview.plannedSpent;
    check(ps && typeof ps === 'object', 'E14 plannedSpent 是对象（追加键）');
    deepEq(Object.keys(ps).sort(), ['beast', 'cryo', 'pyro', 'total'], 'E15 plannedSpent 四键：pyro / cryo / beast / total');
    eq(ps.beast, 0, 'E16 plannedSpent.beast 恒 0（beast 只用于建设，不参与造弹）');
    eq(ps.total, ps.pyro + ps.cryo + ps.beast, 'E17 plannedSpent.total = 三色相加');
    eq(ps.pyro, preview.shots * preview.perShotCost.pyro, 'E18 plannedSpent.pyro = shots × perShotCost.pyro');
    eq(ps.total, preview.shots * ((preview.perShotCost.pyro || 0) + (preview.perShotCost.cryo || 0)),
        'E19 plannedSpent.total = shots × perShotCost 各色之和（与 shots 一致）');
    eq(ps.total, 9, 'E20 本组 3 发 × 3 料 = 9');

    // 九键的取值仍按老口径给出（U 参与取最小、M 按原价、E 走真值分支）
    eq(preview.round, 3, 'E21 round = 当前回合号');
    eq(preview.shots, 3, 'E22 shots = min(5, 3, 5, 10) = 3（U 卡产能，真表 Lv1 = 3）');
    eq(preview.bound, 'U', 'E23 bound = U');
    eq(preview.detail.U, 3, 'E24 detail.U = 3（= 真表 Lv1 产能，不再长期是 null）');
    eq(preview.detail.E, 5, 'E25 detail.E = 5（不再长期是 null）');
    eq(preview.workshopBuilt, true, 'E26 workshopBuilt = true');
    eq(preview.powered, true, 'E27 powered = true');
}

{
    // 未建工坊：同一套键，perShotCost / plannedSpent 必须换成手工溢价口径。
    const host = makeHost({ round: 4, shots: 5, ledger: { pyro: 24 } });
    const preview = host.sys_getWavePreview();
    deepEq(preview.perShotCost, { pyro: 6 }, 'E28 无工坊 ⇒ perShotCost 含溢价 = { pyro: 6 }');
    deepEq(preview.plannedSpent, { pyro: 24, cryo: 0, beast: 0, total: 24 }, 'E29 无工坊 ⇒ plannedSpent = 4 × 6 = 24');
    eq(preview.detail.U, Infinity, 'E30 无工坊 ⇒ detail.U = Infinity（JSON 下 null，读成「不参与取最小」）');
    eq(preview.detail.E, Infinity, 'E31 无工坊 ⇒ detail.E = Infinity');
    eq(preview.shots, 4, 'E32 shots = min(5, ∞, ∞, 4) = 4');
}

// ============================================================ 还原夹具
// 产能表本文件从不注入 ⇒ 无需还原（真表一直在原位）；倍率夹具仍按原样塞回 2。
setManualMultiplier(2);

console.log('\n===================================================');
console.log(`  passed ${passed} / failed ${failed}  (total ${passed + failed})`);
console.log('===================================================');
if (failed > 0) {
    console.log('  FAILURES:');
    for (const f of failures) console.log(`   - ${f}`);
}
process.exitCode = failed === 0 ? 0 : 1;
