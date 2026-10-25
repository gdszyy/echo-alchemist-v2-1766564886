/**
 * validate_build_facilities_config.mjs - [REQ-20261022-wave-loop 料→建造] 建造侧配置契约验收。
 *
 * 断言口径分六段，全部只读 `[盘上]` 的 `CONFIG`，不手抄数值：
 *   A. 第三色料接线：`bounce` 钉产 `beast`，死键 `lightning` 必须 **不产料**；  → A1–A10
 *   B. 三件料付设施的形状（`cost:0` + `materials` 三色键 + `unique` + up* 长度）→ B1–B12
 *   C. 旧五件「能量付」逐字未动（`cost > 0` 且 **没有** `materials` 键）→ C1–C6
 *   D. `U` / `E` 定值（`build.workshop.capacityByLevel` / `manualMaterialMultiplier` / `power.powerPerShot` / `battery.baseCapacity`）→ D1–D8；
 *      **抗复燃（域）**：真表必须真的过 `validateCapacityTable` → D9–D13
 *   E. 逐波解锁表（`reveal` 补 `workshop` / `generator` / `battery`，且不出现 `synth`）→ E1–E7
 *   F. `synth` 本轮不开放（`facilities.synth === undefined`）→ F1–F3
 *
 * 为什么 A 段死键那条是关键：`bucketForPegType` 只认 `MATERIAL_KEYS = ['pyro','cryo','beast']`，
 * **没有默认桶兜底**；`lightning` 又不在 `RANDOMIZABLE_PEG_TYPES`（`src/utils/peg_type_pool.js:20`）里，
 * 钉盘根本不刷该钉型 ⇒ 旧配置 `lightning: { lightning: 1 }` 是一根**永不着地的接线**，第三色料恒 0 的根因即此。
 *
 * Usage:
 *   node tests/validate_build_facilities_config.mjs
 */

import { CONFIG } from '../src/config.js';
import { bucketForPegType, MATERIAL_KEYS } from '../src/utils/material_economy_utils.js';
import { validateCapacityTable } from '../src/utils/workshop_capacity_utils.js';
import {
    WORKSHOP_CAPACITY_MIN,
    WORKSHOP_CAPACITY_MAX,
    WORKSHOP_CAPACITY_INITIAL_MAX,
} from '../src/utils/material_loadout_utils.js';

const BUILD = CONFIG.gameplay.build;
const POWER = BUILD.power;
const PEG_WEIGHTS = POWER.materials.pegWeights;
const FACILITIES = BUILD.facilities;
const REVEAL = BUILD.reveal;

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
function section(title) {
    console.log(`\n=== ${title} ===`);
}
const isPosInt = v => Number.isInteger(v) && v > 0;

console.log('[料→建造] 建造侧配置契约验收（只读 CONFIG，不改任何运行时状态）');
console.log(`  料键 MATERIAL_KEYS = ${MATERIAL_KEYS.join(' / ')}（建造三色全收）`);

// ------------------------------------------------------------------ A
section('A. 第三色料接线（bounce → beast；死键 lightning 不产料）');

eq(bucketForPegType('bounce', PEG_WEIGHTS), 'beast', 'A1 bounce 钉落 beast 桶');
eq(bucketForPegType('pyro', PEG_WEIGHTS), 'pyro', 'A2 pyro 钉落 pyro 桶（未被误改）');
eq(bucketForPegType('cryo', PEG_WEIGHTS), 'cryo', 'A3 cryo 钉落 cryo 桶（未被误改）');
eq(bucketForPegType('lightning', PEG_WEIGHTS), null, 'A4 死键 lightning 不再产料（钉盘不刷该钉型，接它就是接了根假线）');
eq(bucketForPegType('normal', PEG_WEIGHTS), null, 'A5 normal 只产电、不产料（无默认桶兜底）');
eq(bucketForPegType('gray', PEG_WEIGHTS), null, 'A6 gray 只产电、不产料（无默认桶兜底）');
eq(PEG_WEIGHTS.gray && PEG_WEIGHTS.gray.energy, 1, 'A7 pegWeights.gray.energy 仍是 1（未被误改）');
check(FACILITIES.generator !== undefined, 'A8 前置：三件料付设施已落表（供 B/C 段读）');
check(!Object.prototype.hasOwnProperty.call(PEG_WEIGHTS, 'lightning'), 'A9 pegWeights 里不再有 lightning 键（死键整键移除，不留半截）');
check(PEG_WEIGHTS.bounce && PEG_WEIGHTS.bounce.beast === 1, 'A10 pegWeights.bounce = { beast: 1 }（权重仍是 1，只换桶）');

// ------------------------------------------------------------------ B
section('B. 三件料付设施的形状（cost:0 / materials 三色 / unique / up* 长度）');

const NEW_FACILITIES = ['workshop', 'generator', 'battery'];
for (const id of NEW_FACILITIES) {
    const fac = FACILITIES[id];
    check(!!fac && typeof fac === 'object', `B ${id}：已落 facilities`);
    if (!fac) continue;
    eq(fac.cost, 0, `B ${id}：cost === 0（料付，不付能量）`);

    const mats = fac.materials;
    const matKeys = mats && typeof mats === 'object' ? Object.keys(mats) : [];
    const allKnown = matKeys.every(k => MATERIAL_KEYS.includes(k));
    const allPosInt = matKeys.every(k => isPosInt(mats[k]));
    check(matKeys.length > 0, `B ${id}：materials 是非空对象（实测 ${JSON.stringify(mats)}）`);
    check(allKnown, `B ${id}：materials 全部键都在 MATERIAL_KEYS 内（实测 ${matKeys.join(',') || '无'}）`);
    check(allPosInt, `B ${id}：materials 各值都是正整数（实测 ${JSON.stringify(mats)}）`);

    eq(fac.unique, true, `B ${id}：unique === true（全局最多一座 ⇒ 多座求和口径不存在）`);
    check(Array.isArray(fac.upCost) && fac.upCost.length === 2,
        `B ${id}：upCost.length === 2（getPrice 的 upgrade 分支按 upCost[fac.level-1] 取值，必须对上 FACILITY_MAX_LEVEL=3）`);
    check(Array.isArray(fac.upMaterials) && fac.upMaterials.length === 2,
        `B ${id}：upMaterials.length === 2（对应 Lv1→Lv2 / Lv2→Lv3，与 upCost 同长）`);
    check(Array.isArray(fac.upMaterials) && fac.upMaterials.every(m => m && typeof m === 'object'
        && Object.keys(m).every(k => MATERIAL_KEYS.includes(k)) && Object.values(m).every(isPosInt)),
        `B ${id}：upMaterials 每一档都是「三色键 + 正整数」形状`);
}

eq(FACILITIES.lv3Crystal, 1, 'B12 既有键 facilities.lv3Crystal 仍是 1（三件新设施插在它之前，没把它顶掉）');

// ------------------------------------------------------------------ C
section('C. 旧五件「能量付」逐字未动（cost > 0 且没有 materials 键）');

const LEGACY = ['turret', 'lightning', 'frost', 'shieldGen', 'collector'];
for (const id of LEGACY) {
    const fac = FACILITIES[id];
    check(!!fac, `C ${id}：仍在 facilities`);
    if (!fac) continue;
    check(typeof fac.cost === 'number' && fac.cost > 0, `C ${id}：cost > 0（仍是能量付，实测 ${fac.cost}）`);
    check(!Object.prototype.hasOwnProperty.call(fac, 'materials'),
        `C ${id}：**没有** materials 键（保证旧「能量付」路径零变化，不被料付分支抢走）`);
}

// ------------------------------------------------------------------ D
section('D. U / E 定值（产能、手工溢价、每发耗电、电池底容量）');

const cap = BUILD.workshop && BUILD.workshop.capacityByLevel;
check(Array.isArray(cap) && cap.length === 3, `D1 build.workshop.capacityByLevel 是长度 3 的数组（实测 ${JSON.stringify(cap)}）`);
check(Array.isArray(cap) && cap.every(isPosInt), `D2 capacityByLevel 全是正整数（实测 ${JSON.stringify(cap)}）`);
check(Array.isArray(cap) && cap.every((v, i) => i === 0 || v > cap[i - 1]),
    `D3 capacityByLevel 严格递增（实测 ${JSON.stringify(cap)}）`);
eq(BUILD.workshop && BUILD.workshop.manualMaterialMultiplier, 2,
    'D4 build.workshop.manualMaterialMultiplier === 2（没建工坊时料耗 ×2 —— 工坊的正面收益）');
eq(POWER.powerPerShot, 2, 'D5 build.power.powerPerShot === 2（E = floor(可用电力 / 本值)）');
eq(POWER.battery.baseCapacity, 15, 'D6 build.power.battery.baseCapacity === 15（P3 会读它，不得误改）');
check(Array.isArray(BUILD.workshop && BUILD.workshop.capacityByLevel)
    && !Object.prototype.hasOwnProperty.call(POWER, 'capacityByLevel'),
    'D7 产能键在 build.workshop 而非 build.power（src/game_phase.js:1668 读的就是前者）');
check(Array.isArray(POWER.generate && POWER.generate.generator) && POWER.generate.generator.length === 3,
    'D8 power.generate.generator 仍是长度 3 的数组（E 轴的供电源头未被误改）');

// ---- D9–D13：抗复燃（**域**，不是形状）----
// 为什么必须有这一组：D1–D3 只测了「长度 3、递增、正整数」，于是 `[4, 6, 8]` 那张必然让
//   `validateCapacityTable` 抛 `RangeError` 的表照样全绿通过 —— 这正是「形状对、域不对」的漏拦。
//   域的定义在 `src/utils/material_loadout_utils.js:64-68`，本组直接从那里取常量，不手抄 1 / 5 / 4。
{
    const t = BUILD.workshop && BUILD.workshop.capacityByLevel;
    let thrown = null;
    try {
        validateCapacityTable(t);
    } catch (e) {
        thrown = e;
    }
    check(thrown === null,
        `D9 把**真表**喂给 validateCapacityTable 不得抛（实测 ${thrown ? `${thrown.constructor.name}: ${thrown.message}` : '未抛'}；表 = ${JSON.stringify(t)}）`
        + ' —— 这张表越域不只是「数值偏大」，是建工坊即抛、整条料→建造→产能链路等于没有');
    check(Array.isArray(t) && t.length === 3 && t.every(Number.isInteger)
        && t.every((v, i) => i === 0 || v > t[i - 1]),
        `D10 真表长度 3 / 全整数 / 逐级严格递增（实测 ${JSON.stringify(t)}）`);
    check(Array.isArray(t) && t[0] >= WORKSHOP_CAPACITY_MIN && t[0] <= WORKSHOP_CAPACITY_INITIAL_MAX,
        `D11 真表 Lv1 落在初始域 ${WORKSHOP_CAPACITY_MIN}..${WORKSHOP_CAPACITY_INITIAL_MAX}（初始值必须 < MAX = ${WORKSHOP_CAPACITY_MAX}，实测 ${JSON.stringify(t)}）`);
    check(Array.isArray(t) && t[2] <= WORKSHOP_CAPACITY_MAX,
        `D12 真表 Lv3 ≤ WORKSHOP_CAPACITY_MAX = ${WORKSHOP_CAPACITY_MAX}（实测 ${JSON.stringify(t)}）`);
    eq(t[2], 5,
        'D13 真表 Lv3 = 5 = `A` 上限（`cannon.shotsPerTurn: 2` + `ratePrices` 三级 = 5）⇒ Lv3 刚好覆盖满射速轨；'
        + '再高就永远不可能成为约束，等于这张表把自己架空');
}

// ------------------------------------------------------------------ E
section('E. 逐波解锁表（reveal）');

const flat = Object.values(REVEAL).flat();
check(Array.isArray(REVEAL[1]) && REVEAL[1].includes('workshop'), `E1 reveal[1] 含 workshop（实测 ${JSON.stringify(REVEAL[1])}）`);
check(Array.isArray(REVEAL[1]) && REVEAL[1].includes('generator'), 'E2 reveal[1] 含 generator');
check(Array.isArray(REVEAL[2]) && REVEAL[2].includes('battery'), `E3 reveal[2] 含 battery（实测 ${JSON.stringify(REVEAL[2])}）`);
check(!flat.includes('synth'), 'E4 reveal 所有数组里都不出现 synth（本轮不开放）');
check(Array.isArray(REVEAL[1]) && REVEAL[1].includes('dmg'), 'E5 reveal[1] 仍含 dmg（既有项未被顶掉）');
check(Array.isArray(REVEAL[3]) && REVEAL[3].includes('mining'), 'E6 reveal[3] 逐字未动（仍含 mining）');
check(Array.isArray(REVEAL.boss1) && REVEAL.boss1.includes('extraDig'), 'E7 reveal.boss1 逐字未动（仍含 extraDig）');

// ------------------------------------------------------------------ F
section('F. synth 本轮不开放');

eq(FACILITIES.synth, undefined, 'F1 facilities.synth === undefined（净产出恒为负，不接线）');
check(!Object.prototype.hasOwnProperty.call(FACILITIES, 'synth'), 'F2 facilities 里根本没有 synth 键（不是靠值兜底）');
check(!!POWER.synth && Array.isArray(POWER.synth.electricPerUnit),
    'F3 power.synth 段保持原样留作记录（数值修好后再接，不得顺手删）');

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
