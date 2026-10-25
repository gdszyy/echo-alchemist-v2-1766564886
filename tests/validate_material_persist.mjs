/**
 * validate_material_persist.mjs - [REQ-20261022-wave-loop · 料闭环] 步 5 验收：
 *   ① 料账本入档/读档（`materialLedger` / `_materialLoadRound` / `_selectedRecipeId` / `_materialFrozenRecord`）
 *   ② 本波扣减可读（`spent` / `spentTotal`，A5 对账的读数来源）
 *
 * 口径（本文件断言的模型，不是某一跑的实现值）：
 *   - `ledger.spent` = **本波实际扣掉的料**（不是「本次调用扣了多少」），`spentTotal = spent.pyro + spent.cryo`；
 *   - 每波开始由 `sys_resetWaveMaterialCounters` 归零 ⇒ 干回合（不挖不扣料）读出全 0，不残留上一波；
 *   - 旧档缺这些字段 ⇒ 三余额 0 / `_selectedRecipeId` null / `_materialFrozenRecord` null，不抛错；
 *   - 所有新字段必须 JSON 往返不变（无函数 / Map / Set / 类实例）。
 *
 * 注：`readMaterialReadout` 的九键形状被 `tests/validate_material_loop.mjs:314-316` 精确锁死，
 *   因此「本波扣减」走同文件的 `readWaveSpent`，运行时出口 `sys_getMaterialReadout()` 把两者合成。
 *   本文件 D 段同时守住这两件事，防止后来者把键加回纯函数出口而打破冻结断言。
 *
 * Usage:
 *   node tests/validate_material_persist.mjs
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CONFIG } from '../src/config.js';
import { material_system } from '../src/material_system.js';
import {
    MATERIALS_PER_SHOT,
    addMaterial,
    createMaterialLedger,
    normalizeLedger,
    planLoadout,
    readMaterialReadout,
    readWaveSpent,
    recordPegHit,
    settleWaveMaterials,
} from '../src/utils/material_economy_utils.js';
import { grantFloorOnly } from '../src/utils/material_loadout_utils.js';

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
    check(Object.is(actual, expected) || actual === expected, `${name}（实际 ${JSON.stringify(actual)} / 期望 ${JSON.stringify(expected)}）`);
}
function deepEq(actual, expected, name) {
    const a = JSON.stringify(actual);
    const b = JSON.stringify(expected);
    check(a === b, `${name}（实际 ${a} / 期望 ${b}）`);
}
function section(title) {
    console.log(`\n=== ${title} ===`);
}

/** 假宿主：把 material_system 的方法挂上去（与既有 validate_material_loop.mjs 的 E2 段同一手法）。 */
function makeHost(round = 1) {
    const host = { round };
    for (const [k, v] of Object.entries(material_system)) {
        if (typeof v === 'function') host[k] = v.bind(host);
    }
    host.sys_initMaterialLedger();
    return host;
}

const cfgMaterials = (CONFIG.gameplay && CONFIG.gameplay.build && CONFIG.gameplay.build.power
    && CONFIG.gameplay.build.power.materials) || {};
const PER_SHOT = Number(cfgMaterials.materialPerShot) > 0 ? Number(cfgMaterials.materialPerShot) : MATERIALS_PER_SHOT;

console.log('[料账本入档 + 本波扣减] 步 5 验收');
console.log(`  每发耗料 materialPerShot = ${PER_SHOT} [盘上 CONFIG]`);

// ------------------------------------------------------------------ A
section('A. 纯函数层：ledger 带上「本波扣减」');

const fresh = createMaterialLedger();
check(fresh.spent && typeof fresh.spent === 'object', 'A1 新账本有 spent 对象');
deepEq(fresh.spent, { pyro: 0, cryo: 0 }, 'A2 新账本 spent 两桶全 0');
eq(fresh.spentTotal, 0, 'A3 新账本 spentTotal = 0（不是 null / undefined）');

const single = planLoadout({ ...createMaterialLedger(), pyro: 10, cryo: 0 }, 2, PER_SHOT);
check(single.ledger.spent && typeof single.ledger.spent === 'object', 'A4 planLoadout 返回的 ledger 含 spent');
eq(single.ledger.spentTotal, single.ledger.spent.pyro + single.ledger.spent.cryo, 'A5 ledger.spentTotal === spent.pyro + spent.cryo');
eq(single.ledger.spentTotal, 2 * PER_SHOT, `A6 装填 2 发 ⇒ ledger.spentTotal = ${2 * PER_SHOT}`);
eq(single.ledger.spent.pyro, 2 * PER_SHOT, 'A7 单 pyro 料池：全部从 pyro 扣');
eq(single.ledger.spent.cryo, 0, 'A8 单 pyro 料池：cryo 未被动用');
eq(single.ledger.spentTotal, single.spentTotal, 'A9 ledger.spentTotal 与返回值 spentTotal 一致');

const before = { ...createMaterialLedger(), pyro: 4, cryo: 10 };
const dual = planLoadout(before, 2, PER_SHOT);
eq(before.pyro - dual.ledger.pyro, dual.ledger.spent.pyro, 'A10 双料：pyro 余额差 = spent.pyro');
eq(before.cryo - dual.ledger.cryo, dual.ledger.spent.cryo, 'A11 双料：cryo 余额差 = spent.cryo');
eq(dual.ledger.spent.pyro + dual.ledger.spent.cryo, dual.ledger.spentTotal, 'A12 双料：两桶合计 = spentTotal');
eq(dual.ledger.spentTotal, 2 * PER_SHOT, 'A13 双料：仍按实际装填发数计（先扣 pyro 再扣 cryo）');

const emptyNorm = normalizeLedger({});
deepEq(emptyNorm.spent, { pyro: 0, cryo: 0 }, 'A14 normalizeLedger 缺 spent ⇒ 按 0 起（不是 undefined）');
eq(emptyNorm.spentTotal, 0, 'A15 normalizeLedger 缺 spentTotal ⇒ 按 0 起');
deepEq(normalizeLedger({ spent: { pyro: -5, cryo: 'x' } }).spent, { pyro: 0, cryo: 0 }, 'A16 脏 spent（负值 / 非数）规整为 0');
eq(normalizeLedger({ spent: { pyro: 2, cryo: 3 }, spentTotal: 999 }).spentTotal, 5,
    'A17 spentTotal 由两桶推导，不采信外来值（999 ⇒ 5）');

const hitLedger = recordPegHit({ ...createMaterialLedger(), spent: { pyro: 3, cryo: 1 } }, { pegType: 'pyro' }).ledger;
deepEq(hitLedger.spent, { pyro: 3, cryo: 1 }, 'A18 碰钉（recordPegHit）不丢 spent');
const settledLedger = settleWaveMaterials({ ...createMaterialLedger(), spent: { pyro: 3, cryo: 1 } }, { perHitsPerMaterial: 2, basicFloorPerWave: 3 }).ledger;
deepEq(settledLedger.spent, { pyro: 3, cryo: 1 }, 'A19 波末结算（settleWaveMaterials）不动 spent');
const addedLedger = addMaterial({ ...createMaterialLedger(), spent: { pyro: 3, cryo: 1 } }, 'pyro', 5).ledger;
deepEq(addedLedger.spent, { pyro: 3, cryo: 1 }, 'A20 入料（addMaterial）不动 spent');

// 不改入参
const inputLedger = { ...createMaterialLedger(), pyro: 9, cryo: 9 };
const inputSnapshot = JSON.stringify(inputLedger);
const out = planLoadout(inputLedger, 2, PER_SHOT);
eq(JSON.stringify(inputLedger), inputSnapshot, 'A21 planLoadout 不写回入参（深比较不变）');
check(out.ledger !== inputLedger, 'A22 planLoadout 返回新对象（不是原对象被原地改）');
eq(out.ledger.pyro, 9 - out.ledger.spent.pyro, 'A23 返回对象的余额 = 入参 − spent');

// ------------------------------------------------------------------ B
section('B. 有挖掘的波次：mixin 实跑的 spent = 实际扣减');

const rich = makeHost(1);
rich.materialLedger = normalizeLedger({ pyro: 20, cryo: 20 });
rich._materialLoadRound = null;
const pay1 = rich.mat_payLoadout(2);
eq(pay1.charged, true, 'B1 首次装填 charged = true');
eq(pay1.spentTotal, 2 * PER_SHOT, `B2 扣料 ${2 * PER_SHOT}（2 发 × ${PER_SHOT}）`);
eq(pay1.spentTotal, pay1.spent.pyro + pay1.spent.cryo, 'B3 返回值 spentTotal = 两桶相加');
const ro1 = rich.sys_getMaterialReadout();
eq(ro1.spentTotal, pay1.spentTotal, 'B4 读数出口 spentTotal = 本次实际扣料');
deepEq(ro1.spent, pay1.spent, 'B5 读数出口 spent 与扣料一致');
eq(ro1.pyro + ro1.cryo, 40 - pay1.spentTotal, 'B6 余额确实少了 spentTotal（不是只写读数）');

const poor = makeHost(1);
poor.materialLedger = normalizeLedger({ pyro: 5, cryo: 0 });
poor._materialLoadRound = null;
const payPoor = poor.mat_payLoadout(2);
eq(payPoor.loadedShots, 1, 'B7 料 5 只够 1 发');
eq(payPoor.spentTotal, PER_SHOT, `B8 短装只扣实际造出来的 ${PER_SHOT} 料`);
eq(poor.sys_getMaterialReadout().spentTotal, PER_SHOT, 'B9 短装的读数扣减 = 实际扣料（不是请求发数 × 单发成本）');

const dedup = rich.mat_payLoadout(2);
eq(dedup.charged, false, 'B10 同 round 二次装填被拦（charged = false）');
eq(dedup.spentTotal, 0, 'B11 二次装填本次不再扣料（返回 spentTotal = 0）');
eq(rich.sys_getMaterialReadout().spentTotal, pay1.spentTotal,
    'B12 但账本 spent 仍保留本波真实扣减（A5 对账读账本，不被去重返回的 0 带偏）');

// ------------------------------------------------------------------ C
section('C. 干回合：spent 全 0 且不残留上一波');

const dry = makeHost(1);
dry.materialLedger = normalizeLedger({ pyro: 20, cryo: 6 });
dry._materialLoadRound = null;
dry.mat_payLoadout(2);
eq(dry.sys_getMaterialReadout().spentTotal, 2 * PER_SHOT, 'C1 波 1 扣料已记录');
const pyroAfterWave1 = dry.sys_getMaterialReadout().pyro;

dry.round = 2;
dry.sys_resetWaveMaterialCounters();
const dryRo = dry.sys_getMaterialReadout();
deepEq(dryRo.spent, { pyro: 0, cryo: 0 }, 'C2 下一波开始 spent 归零（不残留上一波的 6）');
eq(dryRo.spentTotal, 0, 'C3 下一波开始 spentTotal = 0');
check(dryRo.spentTotal !== 2 * PER_SHOT, 'C4 明确断言「不是沿用上一波的值」');
eq(dryRo.pyro, pyroAfterWave1, 'C5 归零只清本波扣减，不清余额（跨波累积）');
check(dryRo.spent !== null && dryRo.spent !== undefined && typeof dryRo.spent === 'object',
    'C6 干回合读出的 spent 是对象（不是 null / undefined）');

const noMat = makeHost(2);
noMat.materialLedger = normalizeLedger({ pyro: 0, cryo: 0, beast: 99 });
noMat._materialLoadRound = null;
const payDry = noMat.mat_payLoadout(2);
eq(payDry.loadedShots, 0, 'C7 无钉盘料：干回合 0 发');
eq(payDry.spentTotal, 0, 'C8 干回合不扣料（spentTotal = 0）');
eq(noMat.sys_getMaterialReadout().spentTotal, 0, 'C9 干回合读数 spentTotal = 0');
eq(noMat.sys_getMaterialReadout().spent.pyro, 0, 'C10 干回合读数 spent.pyro = 0');
eq(noMat.sys_getMaterialReadout().spent.cryo, 0, 'C11 干回合读数 spent.cryo = 0');
eq(noMat.sys_getMaterialReadout().beast, 99, 'C12 beast 不被造弹动用');

// 干回合的真实形状（订正 C13）：只发保底、不扣料 —— 用第 1 步的 grantFloorOnly 构造，确认它不伪造扣减
const dryRound = makeHost(5);
dryRound.materialLedger = normalizeLedger({ pyro: 0, cryo: 0 });
dryRound.materialLedger = grantFloorOnly(dryRound.materialLedger, { basicFloorPerWave: 3 }).ledger;
eq(dryRound.materialLedger.pyro, 3, 'C13 干回合只发保底 3 料（落 pyro，保底恒发得出来）');
eq(dryRound.sys_getMaterialReadout().spentTotal, 0, 'C14 干回合发保底但不扣料：spentTotal 仍 0');
deepEq(dryRound.sys_getMaterialReadout().spent, { pyro: 0, cryo: 0 }, 'C15 干回合 spent 两桶仍全 0');

// ------------------------------------------------------------------ D
section('D. 读数出口：两处形状与相互一致');

const frozenKeys = 'beast,coloredHitRatio,coloredHits,cryo,destroyedThisWave,loadedShots,primaryHits,producedThisWave,pyro';
eq(Object.keys(readMaterialReadout(rich.materialLedger)).sort().join(','), frozenKeys,
    'D1 纯函数 readMaterialReadout 仍是冻结九键（不得再加键）');

const mixRo = rich.sys_getMaterialReadout();
const pureRo = readMaterialReadout(rich.materialLedger);
check(Object.keys(pureRo).every(k => k in mixRo), 'D2 运行时读数包含纯函数读数的全部九键');
check('spent' in mixRo && 'spentTotal' in mixRo, 'D3 运行时读数额外带 spent / spentTotal');
const ws = readWaveSpent(rich.materialLedger);
deepEq(mixRo.spent, ws.spent, 'D4 运行时 readout.spent === readWaveSpent().spent');
eq(mixRo.spentTotal, ws.spentTotal, 'D5 运行时 readout.spentTotal === readWaveSpent().spentTotal');
deepEq(ws.spent, rich.materialLedger.spent, 'D6 readWaveSpent 与账本 spent 一致');

// ------------------------------------------------------------------ E
section('E. 存档往返（序列化 → 恢复）');

const persist = makeHost(4);
persist.materialLedger = normalizeLedger({ pyro: 11, cryo: 7, beast: 5, producedThisWave: 9, coloredHits: 4 });
persist._materialLoadRound = 4;
persist._selectedRecipeId = 'ammo_pyro_single';
persist._materialFrozenRecord = {
    round: 4, recipeId: 'ammo_pyro_single', N: 2, bound: 'M', ties: ['A', 'M'], spent: { pyro: 6, cryo: 0 },
};
// [REQ-20261022-wave-loop 步 6/7] 两个「本回合已办」标记也必须入档，否则读档重入会各重复一次：
//   _materialSettleRound —— 本回合是否已结算过弹药（防同一回合二次扣料）；
//   _materialFloorRound  —— 本回合是否已发过干回合保底 +3（防读档刷料：读档后
//                           `src/game_system.js:3788` 会重跑 sys_startRoundStartResolver，
//                           干回合分支再发一次就是白送 basicFloorPerWave）。
persist._materialSettleRound = 4;
persist._materialFloorRound = 3;
const exported = persist.mat_exportPersistState();
deepEq(Object.keys(exported).sort(),
    ['_materialFloorRound', '_materialFrozenRecord', '_materialLoadRound',
        '_materialSettleRound', '_selectedRecipeId', 'materialLedger'].sort(),
    'E1 导出恰六个字段（四字段 + 两个本回合已办标记）');
const wire = JSON.parse(JSON.stringify(exported));

const restored = makeHost(1);
restored.sys_initMaterialLedger();
const applied = restored.mat_applyPersistState(wire);
eq(applied.materialLedger.pyro, 11, 'E2 往返后 pyro 一致');
eq(applied.materialLedger.cryo, 7, 'E3 往返后 cryo 一致');
eq(applied.materialLedger.beast, 5, 'E4 往返后 beast 一致');
eq(applied._selectedRecipeId, 'ammo_pyro_single', 'E5 往返后 _selectedRecipeId 一致');
eq(applied._materialLoadRound, 4, 'E6 往返后 _materialLoadRound 一致');
deepEq(applied._materialFrozenRecord, persist._materialFrozenRecord, 'E7 往返后冻结记录深一致');
eq(applied.materialLedger.producedThisWave, 9, 'E8 本波料入 M 随账本复原');
deepEq(restored.sys_getMaterialReadout().spent, persist.materialLedger.spent,
    'E9 本波扣减随账本复原（重载后 A5 仍读得到）');
eq(restored.sys_getMaterialReadout().spentTotal, persist.materialLedger.spentTotal, 'E10 复原后的 spentTotal 一致');
eq(applied._materialSettleRound, 4, 'E11 往返后 _materialSettleRound 一致（防同回合二次扣料）');
eq(applied._materialFloorRound, 3, 'E12 往返后 _materialFloorRound 一致（防读档重复领干回合保底）');

// ------------------------------------------------------------------ F
section('F. 旧档兼容：缺字段一律 0 / null，不抛错');

let legacyThrew = false;
let legacyApplied = null;
try {
    const legacyHost = makeHost(1);
    legacyApplied = legacyHost.mat_applyPersistState({ round: 3, energy: 12, crystal: 2, loopVersion: 2 });
    legacyHost.__ledger = legacyHost.materialLedger;
    legacyApplied.ledger = legacyHost.materialLedger;
} catch (e) {
    legacyThrew = true;
    console.log(`  旧档抛错：${e && e.message}`);
}
eq(legacyThrew, false, 'F1 旧档（无任何新字段）恢复不抛错');
eq(legacyApplied.ledger.pyro, 0, 'F2 旧档恢复后 pyro = 0');
eq(legacyApplied.ledger.cryo, 0, 'F3 旧档恢复后 cryo = 0');
eq(legacyApplied.ledger.beast, 0, 'F4 旧档恢复后 beast = 0');
eq(legacyApplied._selectedRecipeId, null, 'F5 旧档恢复后 _selectedRecipeId = null');
eq(legacyApplied._materialFrozenRecord, null, 'F6 旧档恢复后 _materialFrozenRecord = null');
eq(legacyApplied._materialLoadRound, null, 'F7 旧档恢复后 _materialLoadRound = null');
check(legacyApplied.ledger.spent !== undefined, 'F8 旧档恢复后 spent 不落 undefined');

let nullThrew = false;
try {
    makeHost(1).mat_applyPersistState(null);
    makeHost(1).mat_applyPersistState(undefined);
} catch (e) {
    nullThrew = true;
}
eq(nullThrew, false, 'F9 传 null / undefined 恢复不抛错');

const partial = makeHost(1);
const partialApplied = partial.mat_applyPersistState({ materialLedger: { pyro: 8 } });
eq(partialApplied.materialLedger.pyro, 8, 'F10 旧档只有 pyro ⇒ pyro 保留');
eq(partialApplied.materialLedger.cryo, 0, 'F11 旧档只有 pyro ⇒ cryo 补 0');
eq(partialApplied.materialLedger.spentTotal, 0, 'F12 旧档账本无 spent ⇒ spentTotal 0');

// ------------------------------------------------------------------ G
section('G. 类型守卫与 JSON 往返');

const guard = makeHost(1);
eq(guard.mat_applyPersistState({ _selectedRecipeId: { id: 'x' } })._selectedRecipeId, null,
    'G1 _selectedRecipeId 传对象 ⇒ 规整为 null（选「规整」不选「抛错」）');
eq(guard.mat_applyPersistState({ _selectedRecipeId: 42 })._selectedRecipeId, null, 'G2 传数字 ⇒ null');
eq(guard.mat_applyPersistState({ _selectedRecipeId: '' })._selectedRecipeId, null, 'G3 传空串 ⇒ null');
check(guard.mat_applyPersistState({ _selectedRecipeId: { id: 'x' } })._selectedRecipeId !== undefined,
    'G4 非法值不会静默留下（断言读回值存在且为 null，不是 undefined）');

eq(guard.mat_applyPersistState({ _materialFrozenRecord: 'nope' })._materialFrozenRecord, null, 'G5 冻结记录非对象 ⇒ null');
eq(guard.mat_applyPersistState({ _materialFrozenRecord: { recipeId: 'x' } })._materialFrozenRecord, null,
    'G6 冻结记录缺 round（锚）⇒ null');
const dirty = guard.mat_applyPersistState({
    _materialFrozenRecord: { round: 2.7, recipeId: {}, N: 'a', bound: 5, ties: ['A', 3, null], spent: { pyro: -2, cryo: 'x' } },
})._materialFrozenRecord;
eq(dirty.round, 2, 'G7 冻结记录 round 取整');
eq(dirty.recipeId, null, 'G8 冻结记录 recipeId 非串 ⇒ null');
eq(dirty.N, 0, 'G9 冻结记录 N 脏值 ⇒ 0');
eq(dirty.bound, null, 'G10 冻结记录 bound 非串 ⇒ null');
deepEq(dirty.ties, ['A'], 'G11 冻结记录 ties 过滤掉非字符串项');
deepEq(dirty.spent, { pyro: 0, cryo: 0 }, 'G12 冻结记录 spent 脏值 ⇒ 0');

const jsonSafe = JSON.parse(JSON.stringify(persist.mat_exportPersistState()));
deepEq(jsonSafe, persist.mat_exportPersistState(), 'G13 导出对象 JSON 往返后语义不变');
const flatTypes = [];
const walk = (v, p) => {
    if (v === null || typeof v === 'number' || typeof v === 'string' || typeof v === 'boolean') return;
    if (Array.isArray(v)) { v.forEach((item, i) => walk(item, `${p}[${i}]`)); return; }
    if (typeof v === 'object') {
        if (v instanceof Map || v instanceof Set) flatTypes.push(`${p}:Map/Set`);
        for (const [k, val] of Object.entries(v)) walk(val, `${p}.${k}`);
        return;
    }
    flatTypes.push(`${p}:${typeof v}`);
};
walk(jsonSafe, 'save');
eq(flatTypes.length, 0, 'G14 导出对象里没有函数 / Map / Set / 类实例');

const negLedger = guard.mat_applyPersistState({ materialLedger: { pyro: -3, cryo: NaN, beast: 2.9 } }).materialLedger;
eq(negLedger.pyro, 0, 'G15 存档里的负余额 ⇒ 0');
eq(negLedger.cryo, 0, 'G16 存档里的 NaN ⇒ 0');
eq(negLedger.beast, 2, 'G17 存档里的小数 ⇒ 向下取整');

// ------------------------------------------------------------------ H
section('H. 静态接线：game_system.js 白名单区 / 读档区');

const gsSrc = readSrc('src/game_system.js');
const saveStart = gsSrc.indexOf('// [REQ-20261022-wave-loop S5] 料账本与弹药配方选择入档');
check(saveStart > -1, 'H1 存档白名单区存在 S5 标记');
const saveSlice = saveStart > -1 ? gsSrc.slice(saveStart, gsSrc.indexOf('// 技能', saveStart)) : '';
check(/materialLedger:\s*this\.materialLedger/.test(saveSlice), 'H2 白名单含 materialLedger');
check(/_materialLoadRound:\s*Number\.isFinite/.test(saveSlice), 'H3 白名单含 _materialLoadRound（保持 number|null 类型）');
check(/_selectedRecipeId:\s*typeof this\._selectedRecipeId === 'string'/.test(saveSlice), 'H4 白名单含 _selectedRecipeId（字符串或 null）');
check(/_materialFrozenRecord:\s*this\._materialFrozenRecord/.test(saveSlice), 'H5 白名单含 _materialFrozenRecord');

const applyIdx = gsSrc.indexOf('this.mat_applyPersistState(state)');
const resetIdx = gsSrc.indexOf('// --- 先重置游戏');
check(applyIdx > -1, 'H6 读档路径调用 mat_applyPersistState(state)');
check(applyIdx > resetIdx && resetIdx > -1, 'H7 恢复在 sys_resetGame 之后（否则会被归零覆盖）');
check(/loopVersion:\s*3/.test(gsSrc), 'H8 loopVersion 仍为 3（本步未擅自升版）');

const msSrc = readSrc('src/material_system.js');
check(!/\brecipe\s*:/.test(msSrc), 'H9 material_system.js 无裸 recipe 键（命名纪律：弹药配方一律带上下文）');
check(!/selectedRecipe\b/.test(msSrc), 'H10 无 selectedRecipe 裸名（应为 _selectedRecipeId）');
check(/_materialSettleRound = null/.test(msSrc), 'H11 读档时显式重置结算去重标记并留注释');

// ------------------------------------------------------------------
console.log('\n===================================================');
if (failed === 0) {
    console.log(`  passed ${passed} / failed ${failed}`);
} else {
    console.log(`  passed ${passed} / failed ${failed}`);
    console.log('  失败项：');
    for (const f of failures) console.log(`    - ${f}`);
    process.exitCode = 1;
}
console.log('===================================================');
