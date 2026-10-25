/**
 * validate_build_materials.mjs - [REQ-20261022-wave-loop · 建造扣料] `chargeBuildMaterials` 纯函数验收。
 *
 * 断言口径是**行为契约**（本件只做函数与测试，不接线任何现有链路）：
 *   1. 余额永不写负（任意三色组合）；                      → S / K 段
 *   2. 凑不齐就整笔不扣，失败时账本与传入等价；            → B / C / E / F 段
 *   3. `shortfall` 精确（只含不足色及其正数差额）；        → B2 / C2 / E2 / F2
 *   4. `chargedByMaterial` 只在 `ok === true` 时有值；     → S5 / B4 / D5 / F7
 *   5. **`spent` / `spentTotal` 一字不动**（建造扣料绝不许进「本波已扣料」）→ G 段 + L 段静态守门
 *   6. `beast` 可以付建造费（与造弹侧相反）；              → S4 / F5–F7 / G8
 *   7. 入参防御：零成本视为不扣；负 / NaN / 非数字拒绝；   → H 段
 *   8. 未知料键必须拒绝，不许静默忽略；                    → I 段
 *   9. 纯函数 / 幂等：不修改入参、同入参同输出；           → J 段
 *  10. 账本形状归一（内部 normalizeLedger，返回同形状）。  → J5 / J9–J15
 *
 * 场景清单（任务要求逐条落地）：三色足额 S / 单个不足 B / 三色全不足 C /
 *   成本恰好等于余额 D（必须成功）/ 成本超 1 E（必须失败）/ 三色混合只有 beast 不足 F /
 *   重复调用同入参 J1 / 入参对象未被修改 S9 · B3 · G12 · J2 · K2。
 *
 * 注：`spent` 是**本波造弹**实际扣掉的料（`material_economy_utils.js:35-42`），只有 pyro / cryo 两键；
 *   被整备屏「本波已扣料」直接读取。G 段是这条的防回归关键，**不许删**。
 *
 * Usage:
 *   node tests/validate_build_materials.mjs
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
    MATERIAL_KEYS,
    addMaterial,
    chargeBuildMaterials,
    createMaterialLedger,
    normalizeLedger,
    planLoadout,
} from '../src/utils/material_economy_utils.js';
// [REQ-20261022-wave-loop 建造接料] 购买级：价格层与购买层（本段只在 P/Q/R/S2 段使用，不动上面 S–L 的纯函数断言）。
import { CONFIG } from '../src/config.js';
import { getPrice, normalizeBuildState, tryPurchase } from '../src/utils/build_economy_utils.js';

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
    check(
        Object.is(actual, expected) || actual === expected,
        `${name}（实测 ${JSON.stringify(actual)} / 期望 ${JSON.stringify(expected)}）`,
    );
}
/** 深比较走**键序无关**的规范化串：账本键序由 normalizeLedger 决定，不该让键序制造假失败。 */
function canon(v) {
    if (Array.isArray(v)) return `[${v.map(canon).join(',')}]`;
    if (v && typeof v === 'object') {
        const keys = Object.keys(v).sort();
        return `{${keys.map(k => `${JSON.stringify(k)}:${canon(v[k])}`).join(',')}}`;
    }
    return JSON.stringify(v === undefined ? '__undefined__' : v);
}
function deepEq(actual, expected, name) {
    check(canon(actual) === canon(expected), `${name}（实测 ${canon(actual)} / 期望 ${canon(expected)}）`);
}
function section(title) {
    console.log(`\n=== ${title} ===`);
}
const clone = v => JSON.parse(JSON.stringify(v));

console.log('[建造扣料] chargeBuildMaterials 纯函数验收（只做函数与测试，不接线）');
console.log(`  料键 MATERIAL_KEYS = ${MATERIAL_KEYS.join(' / ')}（建造三色全收；beast 是合法建造货币）`);

// ------------------------------------------------------------------ S
section('S. 场景：三色足额');

const sLedger = normalizeLedger({ pyro: 10, cryo: 10, beast: 5 });
const sBefore = clone(sLedger);
const sRes = chargeBuildMaterials(sLedger, { pyro: 3, cryo: 2, beast: 1 });

eq(sRes.ok, true, 'S1 三色足额 ⇒ ok = true');
eq(sRes.ledger.pyro, 7, 'S2 pyro 10 − 3 = 7');
eq(sRes.ledger.cryo, 8, 'S3 cryo 10 − 2 = 8');
eq(sRes.ledger.beast, 4, 'S4 beast 5 − 1 = 4（契约 6：beast 真能付建造费）');
deepEq(sRes.chargedByMaterial, { pyro: 3, cryo: 2, beast: 1 }, 'S5 契约 4：chargedByMaterial 记录实际扣除量');
eq(sRes.chargedTotal, 6, 'S6 chargedTotal = 3 + 2 + 1 = 6');
deepEq(sRes.shortfall, {}, 'S7 契约 3：足额分支 shortfall 为空对象');
deepEq(sRes.errors, [], 'S8 合法成本 ⇒ errors 为空');
deepEq(sLedger, sBefore, 'S9 契约 9：入参账本未被修改（深比较证明）');

// ------------------------------------------------------------------ B
section('B. 场景：单个不足 ⇒ 整笔不扣');

const bLedger = normalizeLedger({ pyro: 10, cryo: 1, beast: 5 });
const bBefore = clone(bLedger);
const bRes = chargeBuildMaterials(bLedger, { pyro: 3, cryo: 2, beast: 1 });

eq(bRes.ok, false, 'B1 cryo 1 < 需求 2 ⇒ ok = false');
deepEq(bRes.shortfall, { cryo: 1 }, 'B2 契约 3：shortfall 只含不足色 cryo = 1（足额的 pyro / beast 不出现）');
eq(bRes.shortfall.pyro, undefined, 'B3 足额色 pyro 不出现在 shortfall 里');
deepEq(bRes.ledger, bBefore, 'B4 契约 2：失败时账本与传入逐字节等价（不先扣有的、剩下的算了）');
deepEq(bRes.chargedByMaterial, { pyro: 0, cryo: 0, beast: 0 }, 'B5 契约 4：失败时 chargedByMaterial 全 0');
eq(bRes.chargedTotal, 0, 'B6 失败时 chargedTotal = 0');
eq(bRes.ledger.pyro, 10, 'B7 失败时足额的 pyro 也一点没扣');
eq(bRes.ledger.beast, 5, 'B8 失败时 beast 也一点没扣');

// ------------------------------------------------------------------ C
section('C. 场景：三色全不足');

const cLedger = normalizeLedger({ pyro: 0, cryo: 0, beast: 0 });
const cBefore = clone(cLedger);
const cRes = chargeBuildMaterials(cLedger, { pyro: 1, cryo: 2, beast: 3 });

eq(cRes.ok, false, 'C1 三色全不足 ⇒ ok = false');
deepEq(cRes.shortfall, { pyro: 1, cryo: 2, beast: 3 }, 'C2 契约 3：shortfall 精确给出每色差额');
check(
    cRes.shortfall.pyro > 0 && cRes.shortfall.cryo > 0 && cRes.shortfall.beast > 0,
    `C3 shortfall 各项均为正数（实测 ${JSON.stringify(cRes.shortfall)} / 期望 三个正数）`,
);
eq(cRes.shortfall.pyro, 1, 'C4 shortfall.pyro = 1（0 − 1 的差额取绝对值）');
deepEq(cRes.ledger, cBefore, 'C5 契约 2：账本不变');

// ------------------------------------------------------------------ D
section('D. 边界：成本恰好等于余额（必须成功）');

const dLedger = normalizeLedger({ pyro: 3, cryo: 2, beast: 1 });
const dRes = chargeBuildMaterials(dLedger, { pyro: 3, cryo: 2, beast: 1 });

eq(dRes.ok, true, 'D1 成本 == 余额 ⇒ 必须成功（差额 0 不算不足）');
eq(dRes.ledger.pyro, 0, 'D2 pyro 扣到 0');
eq(dRes.ledger.cryo, 0, 'D3 cryo 扣到 0');
eq(dRes.ledger.beast, 0, 'D4 beast 扣到 0');
deepEq(dRes.chargedByMaterial, { pyro: 3, cryo: 2, beast: 1 }, 'D5 chargedByMaterial = 整笔成本');
deepEq(dRes.shortfall, {}, 'D6 恰好够 ⇒ shortfall 为空');
check(
    MATERIAL_KEYS.every(k => dRes.ledger[k] === 0 && dRes.ledger[k] >= 0),
    'D7 契约 1：扣到 0 不写负（三色都是 0 而非 -0 以下的数）',
);

// ------------------------------------------------------------------ E
section('E. 边界：成本超 1（必须失败）');

const eLedger = normalizeLedger({ pyro: 2, cryo: 2, beast: 0 });
const eBefore = clone(eLedger);
const eRes = chargeBuildMaterials(eLedger, { pyro: 3 });

eq(eRes.ok, false, 'E1 需求 3 > 余额 2（超 1）⇒ 必须失败');
deepEq(eRes.shortfall, { pyro: 1 }, 'E2 shortfall.pyro = 1（只差 1 也不许通融）');
deepEq(eRes.ledger, eBefore, 'E3 契约 2：账本不变');
eq(eRes.ledger.cryo, 2, 'E4 单色不足时别的颜色也不被扣');

// ------------------------------------------------------------------ F
section('F. 场景：三色混合、只有 beast 不足（验证 beast 真能付、真会被判不足）');

const fLedger = normalizeLedger({ pyro: 9, cryo: 9, beast: 0 });
const fRes = chargeBuildMaterials(fLedger, { pyro: 1, cryo: 1, beast: 2 });

eq(fRes.ok, false, 'F1 beast 0 < 需求 2 ⇒ ok = false（beast 短缺是真短缺）');
deepEq(fRes.shortfall, { beast: 2 }, 'F2 shortfall 只有 beast = 2（pyro / cryo 足额不出现）');
eq(fRes.ledger.pyro, 9, 'F3 混合失败时 pyro 未被扣');
eq(fRes.ledger.cryo, 9, 'F4 混合失败时 cryo 未被扣');
eq(fRes.ledger.beast, 0, 'F5 混合失败时 beast 未被写成负数');

const f2Ledger = normalizeLedger({ pyro: 9, cryo: 9, beast: 2 });
const f2Res = chargeBuildMaterials(f2Ledger, { pyro: 1, cryo: 1, beast: 2 });

eq(f2Res.ok, true, 'F6 beast 恰好够 ⇒ ok = true（契约 6：beast 是合法建造货币）');
eq(f2Res.ledger.beast, 0, 'F7 beast 扣到 0');
eq(f2Res.chargedByMaterial.beast, 2, 'F8 chargedByMaterial.beast = 2');
deepEq(f2Res.shortfall, {}, 'F9 成功时 shortfall 为空对象');

// ------------------------------------------------------------------ G
section('G. 契约 5：spent / spentTotal 一字不动（防回归关键段，不许省）');

const gStock = addMaterial(addMaterial(addMaterial(createMaterialLedger(), 'pyro', 30).ledger, 'cryo', 30).ledger, 'beast', 10).ledger;
const gLoaded = planLoadout(gStock, 2, 3).ledger; // 造弹 2 发 × 3 = 6，先扣 pyro

deepEq(gLoaded.spent, { pyro: 6, cryo: 0 }, 'G1 前置：构造 spent 非零的账本（planLoadout 扣 6 pyro）');
eq(gLoaded.spentTotal, 6, 'G2 前置：spentTotal = 6');
const gBefore = clone(gLoaded);

const gRes = chargeBuildMaterials(gLoaded, { pyro: 1, cryo: 2, beast: 3 });

eq(gRes.ok, true, 'G3 该账本付得起建造费 ⇒ ok = true');
deepEq(gRes.ledger.spent, gBefore.spent, 'G4 契约 5：建造扣料后 spent 逐键相等');
eq(gRes.ledger.spentTotal, gBefore.spentTotal, 'G5 契约 5：spentTotal 与传入完全一致');
deepEq(Object.keys(gRes.ledger.spent).sort(), ['cryo', 'pyro'], 'G6 spent 仍只有 pyro / cryo 两键（_normalizeSpent 口径，beast 不进）');
deepEq(gRes.ledger.spent, { pyro: 6, cryo: 0 }, 'G7 spent 的值仍是造弹那 6 点，没被建造费顶替');
eq(gRes.ledger.beast, 7, 'G8 beast 从 10 扣到 7（建造费真扣了）');
deepEq(gRes.ledger.spent, gBefore.spent, 'G9 同一个 spent 对象内容再比一次（防「值动过但数字巧合同」）');

const gRes2 = chargeBuildMaterials(gLoaded, { pyro: 999 });
eq(gRes2.ok, false, 'G10 付不起的建造费 ⇒ ok = false');
deepEq(gRes2.ledger.spent, gBefore.spent, 'G11 失败路径 spent 也不动');
eq(gRes2.ledger.spentTotal, gBefore.spentTotal, 'G12 失败路径 spentTotal 也不动');
deepEq(gLoaded, gBefore, 'G13 两条路径都没改入参（深比较）');
deepEq(gRes.ledger.spent, gRes2.ledger.spent, 'G14 成功路径与失败路径的 spent 完全一致（建造费与 spent 零耦合）');

// ------------------------------------------------------------------ H
section('H. 契约 7：入参防御（零成本视为不扣；非法成本拒绝且不许当加料）');

const hLedger = normalizeLedger({ pyro: 5, cryo: 4, beast: 3, spent: { pyro: 2, cryo: 1 } });
const hBefore = clone(hLedger);
eq(hBefore.spentTotal, 3, 'H0 前置：该账本 spentTotal = 3（非零，用来验证零成本分支也不动它）');

const zeroCases = [
    ['H1', 'null', null],
    ['H2', 'undefined', undefined],
    ['H3', '{}', {}],
    ['H4', '全 0', { pyro: 0, cryo: 0, beast: 0 }],
];
for (const [id, label, cost] of zeroCases) {
    const r = chargeBuildMaterials(hLedger, cost);
    eq(r.ok, true, `${id} costByMaterial = ${label} ⇒ ok = true（零成本）`);
    deepEq(r.ledger, hBefore, `${id}b 零成本 ⇒ 账本不变（spent 仍 3）`);
    eq(r.chargedTotal, 0, `${id}c 零成本 ⇒ chargedTotal = 0`);
    deepEq(r.shortfall, {}, `${id}d 零成本 ⇒ shortfall 为空`);
}

const badCases = [
    ['H5', '负成本 { pyro: -1 }', { pyro: -1 }],
    ['H6', 'NaN { pyro: NaN }', { pyro: NaN }],
    ['H7', '非数字字符串 { pyro: "3" }', { pyro: '3' }],
    ['H8', 'Infinity { pyro: Infinity }', { pyro: Infinity }],
    ['H9', '非整数 { pyro: 1.5 }', { pyro: 1.5 }],
    ['H10', '数组 [{ pyro: 1 }]', [{ pyro: 1 }]],
];
for (const [id, label, cost] of badCases) {
    const r = chargeBuildMaterials(hLedger, cost);
    eq(r.ok, false, `${id} ${label} ⇒ 必须拒绝（ok = false）`);
    deepEq(r.ledger, hBefore, `${id}b 拒绝时账本不变`);
    eq(r.chargedTotal, 0, `${id}c 拒绝时 chargedTotal = 0`);
    check(r.errors.length > 0, `${id}d 拒绝时 errors 非空（${id} 错误可归因，实测 ${r.errors.length} 条 / 期望 ≥ 1）`);
}

const hNeg = chargeBuildMaterials(hLedger, { pyro: -2 });
eq(hNeg.ledger.pyro, 5, 'H11 负成本不得当成加料：pyro 仍是 5（不是 7）');
eq(hNeg.ok, false, 'H12 负成本整体判失败（不是「跳过这一色、扣其余」）');

const hNegMix = chargeBuildMaterials(hLedger, { pyro: -2, cryo: 1 });
eq(hNegMix.ledger.cryo, 4, 'H13 混着负成本时，合法的那一色也不扣（整笔拒绝）');
deepEq(hNegMix.ledger, hBefore, 'H14 混负成本 ⇒ 账本与传入等价');

// ------------------------------------------------------------------ I
section('I. 契约 8：未知料键必须拒绝，不许静默忽略');

const iLedger = normalizeLedger({ pyro: 5, cryo: 5, beast: 5 });
const iBefore = clone(iLedger);
const iRes = chargeBuildMaterials(iLedger, { gold: 1 });

eq(iRes.ok, false, 'I1 未知料键 gold ⇒ ok = false');
check(
    iRes.errors.some(e => e.includes('gold')),
    `I2 errors 里点名 gold（实测 ${JSON.stringify(iRes.errors)} / 期望 含 "gold"）`,
);
deepEq(iRes.ledger, iBefore, 'I3 未知料键 ⇒ 账本不变（玩家不会以为付了钱但实际没扣）');
eq(iRes.chargedTotal, 0, 'I4 未知料键 ⇒ chargedTotal = 0');

const iRes2 = chargeBuildMaterials(iLedger, { pyro: 1, gold: 0 });
eq(iRes2.ok, false, 'I5 未知键即使值为 0 也拒绝（配置写错不能静默吞掉）');
deepEq(iRes2.ledger, iBefore, 'I6 该路径账本同样不变');

// ------------------------------------------------------------------ J
section('J. 契约 9 / 10：纯函数、幂等、账本归一形状');

const jLedger = normalizeLedger({
    pyro: 8, cryo: 8, beast: 8,
    spent: { pyro: 1, cryo: 2 },
    loadedShots: 1, loadRequestedShots: 2,
    primaryHits: 7, coloredHits: 4,
    coloredHitsByBucket: { pyro: 2, cryo: 1, beast: 1 },
});
const jBefore = clone(jLedger);
const jCost = { pyro: 1, cryo: 2, beast: 3 };

const j1 = chargeBuildMaterials(jLedger, jCost);
const j2 = chargeBuildMaterials(jLedger, jCost);

deepEq(j1, j2, 'J1 契约 9：同入参调两次 ⇒ 结果完全相同（幂等）');
deepEq(jLedger, jBefore, 'J2 契约 9：两次调用后入参仍未被修改');
check(j1.ledger !== jLedger, 'J3 返回的是新对象（不是同一个引用）');
check(j1.ledger.spent !== jLedger.spent, 'J4 spent 也是新对象（不与入参共享引用）');
deepEq(Object.keys(j1.ledger).sort(), Object.keys(normalizeLedger({})).sort(), 'J5 契约 10：返回账本是归一形状（键集与 normalizeLedger 一致）');
eq(j1.ledger.loadedShots, jBefore.loadedShots, 'J6 建造扣料不改装填读数 loadedShots');
eq(j1.ledger.loadRequestedShots, jBefore.loadRequestedShots, 'J7 不改 loadRequestedShots');
deepEq(j1.ledger.coloredHitsByBucket, jBefore.coloredHitsByBucket, 'J8 不改本波命中计数');
eq(j1.ledger.producedThisWave, jBefore.producedThisWave, 'J9 不改 producedThisWave（建造扣料不是产料）');

const jRaw = chargeBuildMaterials({ pyro: 5 }, { pyro: 1 });
eq(jRaw.ok, true, 'J10 契约 10：入参是残缺账本也能跑（内部走 normalizeLedger 取基线）');
eq(jRaw.ledger.pyro, 4, 'J11 残缺账本 pyro 5 − 1 = 4');
eq(jRaw.ledger.cryo, 0, 'J12 缺失的 cryo 归一成 0');
deepEq(jRaw.ledger.spent, { pyro: 0, cryo: 0 }, 'J13 缺失 spent 归一成两键全 0');
eq(jRaw.ledger.spentTotal, 0, 'J14 缺失 spentTotal 归一成 0');

const jPartialFail = chargeBuildMaterials({ pyro: 1 }, { cryo: 1 });
eq(jPartialFail.ok, false, 'J15 残缺账本 cryo 缺 ⇒ 判不足');
eq(jPartialFail.shortfall.cryo, 1, 'J16 shortfall.cryo = 1（0 存量缺 1）');
deepEq(jPartialFail.ledger, normalizeLedger({ pyro: 1 }), 'J17 失败时返回归一基线（不是原始残缺对象，见回报里的口径声明）');

// ------------------------------------------------------------------ K
section('K. 契约 1：任意三色组合下余额永不写负');

const kCosts = [
    { pyro: 1 },
    { cryo: 2 },
    { beast: 3 },
    { pyro: 1, cryo: 1, beast: 1 },
    { pyro: 4 },
    { pyro: 2, beast: 2 },
    { pyro: 3, cryo: 3, beast: 3 },
];
let kTotal = 0;
let kNeg = 0;
let kMutated = 0;
let kOkMismatch = 0;
let kDeductMismatch = 0;
for (let p = 0; p <= 3; p++) {
    for (let c = 0; c <= 3; c++) {
        for (let b = 0; b <= 3; b++) {
            const led = normalizeLedger({ pyro: p, cryo: c, beast: b });
            for (const cost of kCosts) {
                const before = clone(led);
                const r = chargeBuildMaterials(led, cost);
                kTotal++;
                if (MATERIAL_KEYS.some(k => r.ledger[k] < 0)) kNeg++;
                if (canon(led) !== canon(before)) kMutated++;
                const expectOk = MATERIAL_KEYS.every(k => (cost[k] || 0) <= before[k]);
                if (r.ok !== expectOk) kOkMismatch++;
                if (r.ok) {
                    const deductOk = MATERIAL_KEYS.every(k => r.ledger[k] === before[k] - (cost[k] || 0));
                    if (!deductOk) kDeductMismatch++;
                } else if (canon(r.ledger) !== canon(before)) {
                    kDeductMismatch++;
                }
            }
        }
    }
}
check(kTotal === 64 * kCosts.length, `K1 穷举规模正确（实测 ${kTotal} 组 / 期望 ${64 * kCosts.length} 组 = 4³ × ${kCosts.length} 种成本）`);
eq(kNeg, 0, `K2 契约 1：${kTotal} 组里余额写负的次数 = 0`);
eq(kMutated, 0, 'K3 契约 9：穷举过程中入参一次也没被修改');
eq(kOkMismatch, 0, 'K4 ok 恰好等于「三色都够」（不多扣也不通融）');
eq(kDeductMismatch, 0, 'K5 成功时逐桶 = 余额 − 成本；失败时账本与传入等价');

// ------------------------------------------------------------------ L
section('L. 静态守门：函数体不写 spent（契约 5 的代码级兜底）');

const economySrc = readSrc('src/utils/material_economy_utils.js');
const fnStart = economySrc.indexOf('export function chargeBuildMaterials');
check(fnStart > -1, 'L1 chargeBuildMaterials 已从 material_economy_utils.js 导出');
const fnEnd = fnStart > -1 ? economySrc.indexOf('\n}', fnStart) : -1;
const fnBody = fnStart > -1 && fnEnd > fnStart ? economySrc.slice(fnStart, fnEnd) : '';
check(fnBody.length > 0, `L2 取到函数体（实测 ${fnBody.length} 字符 / 期望 > 0）`);
check(!/next\.spent/.test(fnBody), 'L3 函数体不写 next.spent（契约 5）');
check(!/next\.spentTotal/.test(fnBody), 'L4 函数体不写 next.spentTotal（契约 5）');
check(/export function planLoadout/.test(economySrc), 'L5 既有 planLoadout 仍在（只追加未改）');
check(/export function normalizeLedger/.test(economySrc), 'L6 既有 normalizeLedger 仍在');
check(/export function readWaveSpent/.test(economySrc), 'L7 既有 readWaveSpent 仍在');

// ------------------------------------------------------------------ P
// [REQ-20261022-wave-loop 建造接料] 以下 P / Q / R / S2 段是**购买级**用例：把料价从配置一路验到
// `tryPurchase` 的判料扣料。上面 S–L 段的 136 条纯函数断言一条不动。
section('P. 购买级：getPrice 的建造料价与配置逐字相等');

const BUILD_CFG = CONFIG.gameplay.build;
/** 三件料付后勤设施（`cost: 0` + `materials`）。 */
const MAT_FACILITIES = ['workshop', 'generator', 'battery'];
/** 旧五件：纯能量计价，逐字未动 ⇒ `materials` 必须是 `{}`。 */
const ENERGY_FACILITIES = ['turret', 'lightning', 'frost', 'shieldGen', 'collector'];

MAT_FACILITIES.forEach(type => {
    const f = BUILD_CFG.facilities[type];
    const p = getPrice({}, { type: 'build', slot: 0, facility: type }, BUILD_CFG);
    check(!!p, `P1.${type} build 有价格`);
    deepEq(p && p.materials, f.materials, `P2.${type} build 的 materials = facilities.${type}.materials（逐字相等）`);
    eq(p && p.energy, f.cost, `P3.${type} build 的 energy 仍按既有取法取 cost（本批不改既有取法）`);
    eq(p && p.crystal, 0, `P4.${type} build 的 crystal = 0`);
});

ENERGY_FACILITIES.forEach(type => {
    const p = getPrice({}, { type: 'build', slot: 0, facility: type }, BUILD_CFG);
    check(!!p, `P5.${type} build 有价格`);
    check(!!p && typeof p.materials === 'object' && !Array.isArray(p.materials) && Object.keys(p.materials).length === 0,
        `P6.${type}（旧纯能量计价）build 的 materials = {}（不是 undefined / null）`);
});

[['cannon', { type: 'cannon', track: 'dmg' }],
    ['branch', { type: 'branch', branch: 'pierce' }],
    ['slot', { type: 'slot' }],
    ['item', { type: 'item', item: 'bomb' }],
    ['mining', { type: 'mining', key: 'collector' }]].forEach(([label, action]) => {
    const p = getPrice({}, action, BUILD_CFG);
    check(!!p, `P7.${label} 仍可定价`);
    deepEq(p && p.materials, {}, `P8.${label} 分支的 materials = {}（料价只出现在设施建造 / 升级）`);
});
check(!JSON.stringify(getPrice({}, { type: 'build', slot: 0, facility: 'workshop' }, BUILD_CFG).materials).includes('undefined'),
    'P9.materials 里不会出现 undefined 键（归一后只留正数键）');

// ------------------------------------------------------------------ Q
section('Q. 购买级：升级料价与 upCost 同下标');

MAT_FACILITIES.forEach(type => {
    const f = BUILD_CFG.facilities[type];
    [1, 2].forEach(level => {
        const state = {
            energy: 0, crystal: 9,
            facilities: [{ type, level, cd: 0 }, null, null],
            facilitySlotsOpen: 3,
        };
        const p = getPrice(state, { type: 'upgrade', slot: 0 }, BUILD_CFG);
        check(!!p, `Q1.${type} Lv${level} 可升级`);
        deepEq(p && p.materials, f.upMaterials[level - 1],
            `Q2.${type} Lv${level}→Lv${level + 1} 的 materials = upMaterials[${level - 1}]`);
        eq(p && p.energy, f.upCost[level - 1],
            `Q3.${type} Lv${level} 的 energy = upCost[${level - 1}]（料价与能量价同下标并行取值）`);
    });
    const maxedState = { energy: 0, crystal: 9, facilities: [{ type, level: 3, cd: 0 }], facilitySlotsOpen: 1 };
    eq(getPrice(maxedState, { type: 'upgrade', slot: 0 }, BUILD_CFG), null, `Q4.${type} 到 Lv3 满级 ⇒ getPrice = null`);
});

// ------------------------------------------------------------------ R
section('R. 购买级：tryPurchase 判料扣料');

const emptyBuildState = () => ({
    energy: 0, crystal: 0, facilities: [null, null, null], facilitySlotsOpen: 1,
    items: [], miningLevels: { collector: 0 },
});
const workshopAction = { type: 'build', slot: 0, facility: 'workshop' };
const WORKSHOP_NEED = BUILD_CFG.facilities.workshop.materials;   // { pyro: 4, cryo: 2, beast: 3 }（beast 键 2026-10-25 起接入）

// R1–R4：价格含料但第 5 参没传 ⇒ 一律拒绝（静默免费成交是本批要杜绝的第一号缺陷）
const noLedgerState = emptyBuildState();
const noLedgerRes = tryPurchase(noLedgerState, workshopAction, BUILD_CFG, null);
eq(noLedgerRes.ok, false, 'R1 价格含料但不传料账本 ⇒ ok = false（绝不放行成免费成交）');
eq(noLedgerRes.reason, 'materials', "R2 不传账本 ⇒ reason = 'materials'");
deepEq(noLedgerRes.state, normalizeBuildState(noLedgerState, BUILD_CFG), 'R3 失败时 state 与入参等价（未被改动）');
eq(noLedgerRes.ledger, null, 'R4 不传账本 ⇒ 返回 ledger = null');

// R5–R8：余额不足 ⇒ 整笔不扣（全或无）
const poorStock = normalizeLedger({ pyro: WORKSHOP_NEED.pyro - 1, cryo: WORKSHOP_NEED.cryo, beast: 9, spent: { pyro: 1, cryo: 2 } });
const poorStockBefore = clone(poorStock);
const poorState = emptyBuildState();
const poorRes = tryPurchase(poorState, workshopAction, BUILD_CFG, null, poorStock);
eq(poorRes.ok, false, 'R5 料余额不足 ⇒ ok = false');
eq(poorRes.reason, 'materials', "R6 料不足 ⇒ reason = 'materials'");
deepEq(poorRes.ledger, poorStockBefore, 'R7 不足 ⇒ 返回账本与入参逐键相等（全或无：一分料都不扣）');
deepEq(poorStock, poorStockBefore, 'R8 失败时入参账本未被修改');
deepEq(poorRes.state, normalizeBuildState(poorState, BUILD_CFG), 'R9 料不足时 state 与入参等价（设施不落槽）');

// R10–R19：余额充足 ⇒ 成交、三色精确扣减、能量 / 水晶扣 0、spent 不被污染
const richStock = normalizeLedger({ pyro: 10, cryo: 10, beast: 4, spent: { pyro: 3, cryo: 1 }, producedThisWave: 7 });
const richStockBefore = clone(richStock);
const richState = { ...emptyBuildState(), energy: 55, crystal: 1 };
const richRes = tryPurchase(richState, workshopAction, BUILD_CFG, null, richStock);
eq(richRes.ok, true, 'R10 料足 ⇒ ok = true');
eq(richRes.reason, null, 'R11 成交时 reason = null');
eq(richRes.ledger.pyro, 10 - WORKSHOP_NEED.pyro, `R12 pyro 10 − ${WORKSHOP_NEED.pyro} = ${10 - WORKSHOP_NEED.pyro}`);
eq(richRes.ledger.cryo, 10 - WORKSHOP_NEED.cryo, `R13 cryo 10 − ${WORKSHOP_NEED.cryo} = ${10 - WORKSHOP_NEED.cryo}`);
eq(richRes.ledger.beast, 4 - WORKSHOP_NEED.beast,
    `R14 beast 4 − ${WORKSHOP_NEED.beast} = ${4 - WORKSHOP_NEED.beast}（工坊价目已含 beast，兽料是建造出口）`);
eq(richRes.state.facilities[0] && richRes.state.facilities[0].type, 'workshop', 'R15 设施进槽（type = workshop）');
eq(richRes.state.facilities[0] && richRes.state.facilities[0].level, 1, 'R16 新建设施 Lv1');
eq(richRes.state.energy, 55, 'R17 energy 扣 0（工坊 cost 0）');
eq(richRes.state.crystal, 1, 'R18 crystal 扣 0');
deepEq(richRes.ledger.spent, richStockBefore.spent,
    'R19 返回账本的 spent 与传入逐键相等（建造扣料**不许**污染「本波造弹已扣料」）');
eq(richRes.ledger.spentTotal, richStockBefore.spentTotal, 'R20 spentTotal 同样原样继承');
eq(Object.prototype.hasOwnProperty.call(richRes.ledger, 'spent'), true, 'R21 ledger 仍带 spent 键（形状不丢，UI 直读不炸）');
eq(richRes.ledger.producedThisWave, richStockBefore.producedThisWave, 'R22 本波产出计数不被建造扣料改写');
deepEq(richStock, richStockBefore, 'R23 成交时入参账本也未被修改（不可变更新）');

// R24–R27：`beast` 是合法建造货币（只用于建设）——用一份只含 beast 的料价正面验
const beastCfg = {
    slots: { total: 3, openAtStart: 1, openCrystal: 2 },
    facilities: { battery: { cost: 0, materials: { beast: 3 }, upCost: [0, 0], upMaterials: [], unique: true } },
};
const beastStock = normalizeLedger({ pyro: 5, cryo: 5, beast: 3 });
const beastRes = tryPurchase(emptyBuildState(), { type: 'build', slot: 0, facility: 'battery' }, beastCfg, null, beastStock);
eq(beastRes.ok, true, 'R24 beast 单独付得起建造费 ⇒ ok = true（建造侧不排斥 beast）');
eq(beastRes.ledger.beast, 0, 'R25 beast 3 − 3 = 0');
eq(beastRes.ledger.pyro, 5, 'R26 只含 beast 的料价不动 pyro');
eq(beastRes.ledger.cryo, 5, 'R27 只含 beast 的料价不动 cryo');
const beastShort = tryPurchase(emptyBuildState(), { type: 'build', slot: 0, facility: 'battery' }, beastCfg, null,
    normalizeLedger({ pyro: 99, cryo: 99, beast: 2 }));
eq(beastShort.ok, false, 'R28 beast 差 1 也失败（钉盘料再多也不能顶 beast）');
eq(beastShort.reason, 'materials', "R29 beast 不足 ⇒ reason = 'materials'");

// R30：旧五件不传账本照样成交（料价为空 ⇒ 不应被料账本卡住）
const legacystateRes = tryPurchase({ ...emptyBuildState(), energy: 100 }, { type: 'build', slot: 0, facility: 'turret' }, BUILD_CFG, null);
eq(legacystateRes.ok, true, 'R30 旧五件（纯能量）不传账本也能买（料账本只约束料价）');
eq(legacystateRes.ledger, null, 'R31 旧五件不传账本 ⇒ ledger 仍是 null（不凭空造账本）');
const legacyTagged = tryPurchase({ ...emptyBuildState(), energy: 100 }, { type: 'build', slot: 0, facility: 'turret' }, BUILD_CFG, null,
    normalizeLedger({ pyro: 7, cryo: 7, beast: 7 }));
deepEq(legacyTagged.ledger.pyro, 7, 'R32 传了账本但价格无料项 ⇒ 账本原样返回（不扣）');
eq(legacyTagged.ok, true, 'R33 传了账本、价格无料项 ⇒ 照常成交');

// ------------------------------------------------------------------ S2
section('S2. 静态守门：tryPurchase 函数体不写 spent（契约 5 的代码级兜底）');

const buildEconSrc = readSrc('src/utils/build_economy_utils.js');
const tpStart = buildEconSrc.indexOf('export function tryPurchase');
check(tpStart > -1, 'S2.1 tryPurchase 已从 build_economy_utils.js 导出');
const tpEnd = tpStart > -1 ? buildEconSrc.indexOf('\n}', tpStart) : -1;
const tpBody = tpStart > -1 && tpEnd > tpStart ? buildEconSrc.slice(tpStart, tpEnd) : '';
check(tpBody.length > 0, `S2.2 取到函数体（实测 ${tpBody.length} 字符 / 期望 > 0）`);
check(!/\bspent\b/i.test(tpBody), 'S2.3 tryPurchase 函数体完全不出现 spent（连读都没有，杜绝顺手写）');
check(!/\bspentTotal\b/i.test(tpBody), 'S2.4 tryPurchase 函数体不出现 spentTotal');
check(/chargeBuildMaterials\s*\(/.test(tpBody), 'S2.5 扣料走既有纯函数 chargeBuildMaterials（不在购买层重写扣料）');

// ------------------------------------------------------------------ summary
const total = passed + failed;
console.log('\n===================================================');
console.log(`  passed ${passed} / failed ${failed}  (total ${total})`);
if (failed > 0) {
    console.log('  失败项：');
    for (const f of failures) console.log(`    - ${f}`);
}
console.log('===================================================');
process.exit(failed === 0 ? 0 : 1);
