/**
 * validate_power_budget.mjs - [REQ-20261022-wave-loop · 经济接线 v2 第 3 步] 电力预算纯函数断言。
 *
 * 依据：`docs/design/economy_wiring_spec_v2.md:155-172`（§4.1，`E = floor(可用电力 / 每发耗电)`）
 *       + `docs/design/economy_wiring_spec_v2_corrections.md` C7（合成器产电订正）
 *       + 附录 C-3 第 3 步（电力接线：发电 + 电池 + 合成器产电 − 设施耗电，回滚＝断开「读配置」）。
 *
 * 覆盖：五类设施的 `power.draw` 盘上真值 Lv1/2/3 · `synth` 不得进 draw · 未知类型 / 越界等级 /
 *       非整数等级 · 合成器单算耗电三档与边界（超上限 / 负数 / 非整数 / 0 产）· 设施合计（空 / 求和 / 含 synth 报错）·
 *       分项可核（gross / synthProduced / synthDraw / facilityDraw / available）·
 *       **赤字保留负值且 shots = 0** · **容量 vs 存量语义不同** · 取整方向 floor · 每发耗电非法报错 ·
 *       配置缺陷反例（克隆构造，不改导入对象）· 纯函数不改入参。
 *
 * 数值纪律：**每发耗电全程 `[待标定]`**，本文件用**占位参数** `PLACEHOLDER_POWER_PER_SHOT` 演示，
 *   注释写明「占位，非标定结果」；本文件不把任何值当作现值写进断言之外的语义。
 *   配置真值一律读 `[盘上]` 的 `CONFIG.gameplay.build`（`src/config.js:953` / `:975-1029`），不手抄。
 *
 * Usage:
 *   node tests/validate_power_budget.mjs
 */

import { CONFIG } from '../src/config.js';
import {
    FACILITY_LEVELS,
    SYNTH_TYPE,
    computeAvailablePower,
    generatorOutputFor,
    powerDrawFor,
    resolvePowerShots,
    synthDrawFor,
    totalFacilityDraw,
} from '../src/utils/power_budget_utils.js';

let passed = 0;
let failed = 0;
const failures = [];

function check(condition, message) {
    if (condition) {
        passed++;
        console.log(`PASS  ${message}`);
    } else {
        failed++;
        failures.push(message);
        console.log(`FAIL  ${message}`);
    }
}

function checkThrows(fn, pattern, message) {
    try {
        fn();
        check(false, `${message} —— 未抛错`);
    } catch (e) {
        const msg = String((e && e.message) || e);
        check(pattern.test(msg), `${message} —— 实抛：${msg}`);
    }
}

const clone = (v) => JSON.parse(JSON.stringify(v));

/** `[盘上]` 真配置：`CONFIG.gameplay.build`（`src/config.js:953`；power 段 `:975-1029`）。 */
const BUILD = CONFIG.gameplay.build;
/** `[盘上]` power 段本身，用于验证「两种 config 形状都吃」。 */
const POWER = BUILD.power;

/**
 * 每发耗电的**占位参数**（`[待标定]`）：盘上不存在该键（`spec_v2 :170` 原文点名
 * 「`src\config.js:1005` 那个 `materialPerShot` 是料，不是电，两者不可混用」）。
 * 下面的 4 只是为了让 floor 断言可算，**不是标定结果、不得当成现值引用**。
 */
const PLACEHOLDER_POWER_PER_SHOT = 4;

console.log('=== 1. powerDrawFor：盘上真值（[盘上] src/config.js:979-983） ===');
{
    // turret [4, 6, 8]  => Lv1 4 / Lv2 6 / Lv3 8
    for (const lv of FACILITY_LEVELS) {
        const want = BUILD.power.draw.turret[lv - 1];
        check(powerDrawFor('turret', lv, BUILD) === want && want === [4, 6, 8][lv - 1],
            `1a turret Lv${lv} = ${powerDrawFor('turret', lv, BUILD)}（[盘上] 4/6/8）`);
    }
    // frost [6, 9, 12]
    for (const lv of FACILITY_LEVELS) {
        const got = powerDrawFor('frost', lv, BUILD);
        check(got === [6, 9, 12][lv - 1], `1b frost Lv${lv} = ${got}（[盘上] 6/9/12）`);
    }
    // workshop [4, 6, 8]（该设施无 facilities 条目，等级域按 FACILITY_LEVELS 取）
    for (const lv of FACILITY_LEVELS) {
        const got = powerDrawFor('workshop', lv, BUILD);
        check(got === [4, 6, 8][lv - 1], `1c workshop Lv${lv} = ${got}（[盘上] 4/6/8，且 upCost 缺失不破等级校验）`);
    }
    // generator / battery 恒 0（后勤设备，[盘上] src/config.js:984-985）
    check(FACILITY_LEVELS.every(lv => powerDrawFor('generator', lv, BUILD) === 0),
        '1d generator Lv1/2/3 恒 0（后勤设备不耗电）');
    check(FACILITY_LEVELS.every(lv => powerDrawFor('battery', lv, BUILD) === 0),
        '1e battery Lv1/2/3 恒 0（后勤设备不耗电）');
    // power 段级 config 也吃（与 build 级结果一致）
    check(powerDrawFor('turret', 2, POWER) === powerDrawFor('turret', 2, BUILD),
        '1f 传 power 段本身与传 build 级 config 结果一致');
}

console.log('\n=== 2. powerDrawFor：拒绝 synth 与非法入参 ===');
{
    checkThrows(() => powerDrawFor(SYNTH_TYPE, 1, BUILD), /synth.*不进 power\.draw|synthDrawFor/,
        '2a powerDrawFor("synth") 抛错并指向 synthDrawFor');
    checkThrows(() => powerDrawFor('laser', 1, BUILD), /未知设施类型 "laser"/,
        '2b 未知类型抛错');
    try {
        powerDrawFor('laser', 1, BUILD);
    } catch (e) {
        const msg = String(e.message || e);
        check(/turret/.test(msg) && /workshop/.test(msg), `2c 未知类型报错列出合法键 —— 实抛：${msg}`);
    }
    checkThrows(() => powerDrawFor('turret', 0, BUILD), /等级越界.*实测 0/,
        '2d lv = 0 抛越界（不回落 Lv1）');
    checkThrows(() => powerDrawFor('turret', 4, BUILD), /等级越界.*实测 4/,
        '2e lv = 4 抛越界（不静默取末项 Lv3）');
    checkThrows(() => powerDrawFor('turret', 1.5, BUILD), /必须是整数.*实测 1\.5/,
        '2f lv = 1.5 抛非整数');
    checkThrows(() => powerDrawFor('generator', 4, BUILD), /等级越界.*实测 4/,
        '2g 标量键 generator 的 lv = 4 同样抛错（标量不受长度保护，靠等级域兜底）');
}

console.log('\n=== 3. synthDrawFor：electricPerUnit × 实产数（[盘上] 5/4/3 × [提案] 2/3/4） ===');
{
    check(synthDrawFor(1, 2, BUILD) === 10, `3a synthDrawFor(1, 2) = ${synthDrawFor(1, 2, BUILD)}（5×2 = 10）`);
    check(synthDrawFor(2, 3, BUILD) === 12, `3b synthDrawFor(2, 3) = ${synthDrawFor(2, 3, BUILD)}（4×3 = 12）`);
    check(synthDrawFor(3, 4, BUILD) === 12, `3c synthDrawFor(3, 4) = ${synthDrawFor(3, 4, BUILD)}（3×4 = 12，Lv2/Lv3 打平是 :1000 已知例外）`);
    check(synthDrawFor(1, 0, BUILD) === 0, `3d 实产 0 ⇒ 耗电 0（不建/空转不收费）`);
    checkThrows(() => synthDrawFor(3, 5, BUILD), /超 Lv3 上限.*capPerWave\[2\] = 4.*实测 5/,
        '3e 实产数超 capPerWave 抛错（不静默截断）');
    checkThrows(() => synthDrawFor(1, -1, BUILD), /不得为负.*实测 -1/,
        '3f 实产数为负抛错');
    checkThrows(() => synthDrawFor(1, 1.5, BUILD), /必须是整数.*实测 1\.5/,
        '3g 实产数非整数抛错');
    checkThrows(() => synthDrawFor(4, 1, BUILD), /等级越界.*实测 4/,
        '3h 合成器 lv = 4 越界抛错');
}

console.log('\n=== 4. totalFacilityDraw：Σ power.draw，synth 必须拒收 ===');
{
    check(totalFacilityDraw([], BUILD) === 0, `4a 空数组 = ${totalFacilityDraw([], BUILD)}（无耗电设施）`);
    const two = totalFacilityDraw([{ type: 'turret', lv: 2 }, { type: 'frost', lv: 1 }], BUILD);
    check(two === 6 + 6, `4b turret Lv2 + frost Lv1 = ${two}（6 + 6）`);
    check(totalFacilityDraw([{ type: 'workshop', lv: 3 }], BUILD) === 8, '4c workshop Lv3 = 8');
    check(totalFacilityDraw([{ type: 'generator', lv: 2 }, { type: 'battery', lv: 3 }], BUILD) === 0,
        '4d 后勤设备可在列表内出现，贡献恒 0');
    checkThrows(() => totalFacilityDraw([{ type: 'turret', lv: 1 }, { type: 'synth', lv: 1 }], BUILD),
        /出现 "synth".*重复计费/, '4e 列表含 synth 抛错（否则与单算口径重复计费）');
    checkThrows(() => totalFacilityDraw([{ type: 'turret' }], BUILD), /缺少 lv/,
        '4f 元素缺 lv 抛错（不得默认按 Lv1 计）');
    checkThrows(() => totalFacilityDraw(null, BUILD), /必须是 \[{ type, lv }\] 数组/,
        '4g 非数组抛错');
}

console.log('\n=== 5. computeAvailablePower：分项可核 ===');
{
    // 无合成器、无耗电设施 ⇒ available = generator + reserve（[盘上] generator Lv1 = 10）
    const bare = computeAvailablePower({ generatorLv: 1, batteryReserve: 5, synth: null, facilities: [] }, BUILD);
    check(bare.available === 15 && bare.gross === 15,
        `5a 无合成器/无耗电设施：available = ${bare.available} = generator 10 + reserve 5`);
    check(bare.synthProduced === 0 && bare.synthDraw === 0 && bare.facilityDraw === 0,
        `5b 同一场景三个耗/产项全 0（synthProduced ${bare.synthProduced} / synthDraw ${bare.synthDraw} / facilityDraw ${bare.facilityDraw}）`);

    // 有耗电设施：facilityDraw = 4 + 6 = 10，generator Lv2 = 15，reserve 0
    const loaded = computeAvailablePower({
        generatorLv: 2, batteryReserve: 0, synth: null,
        facilities: [{ type: 'turret', lv: 1 }, { type: 'workshop', lv: 2 }],
    }, BUILD);
    check(loaded.facilityDraw === 10, `5c facilityDraw = ${loaded.facilityDraw}（turret Lv1 4 + workshop Lv2 6）`);
    check(loaded.available === 5, `5d available = ${loaded.available} = 15 − 10（有耗电设施后相应减少）`);

    // 有合成器：generator Lv1 = 10，reserve 0，synth Lv3 满产 4
    const withSynth = computeAvailablePower({
        generatorLv: 1, batteryReserve: 0, synth: { lv: 3, producedUnits: 4 }, facilities: [],
    }, BUILD);
    check(withSynth.gross === 14, `5e gross = ${withSynth.gross} = 10 + 4（合成器产电计入 gross）`);
    check(withSynth.synthProduced === 4 && withSynth.synthDraw === 12 && withSynth.facilityDraw === 0,
        `5f synthProduced ${withSynth.synthProduced} 单列、synthDraw ${withSynth.synthDraw} 单列、facilityDraw 不含它（${withSynth.facilityDraw}）`);
    check(withSynth.available === withSynth.gross - withSynth.facilityDraw - withSynth.synthDraw,
        `5g available = gross − facilityDraw − synthDraw = ${withSynth.available}`);
    check(withSynth.available !== withSynth.gross - withSynth.facilityDraw,
        `5h 不扣合成器耗电会得 ${withSynth.gross - withSynth.facilityDraw} ≠ ${withSynth.available}（证明合成器耗电真被扣了）`);
    check(withSynth.available !== withSynth.gross - withSynth.facilityDraw - 2 * withSynth.synthDraw,
        `5i 重复计费会得 ${withSynth.gross - withSynth.facilityDraw - 2 * withSynth.synthDraw} ≠ ${withSynth.available}（证明没重复计费）`);
    // 把它算进 facilityDraw 的路径结构上不存在
    checkThrows(() => totalFacilityDraw([{ type: 'synth', lv: 3 }], BUILD), /出现 "synth"/,
        '5j 「把 synth 算进 facilityDraw」这条路被结构挡住（totalFacilityDraw 拒收）');

    // 未建发电机 ⇒ 发电 0（[假设]），不是免费给 Lv1
    const noGen = computeAvailablePower({ generatorLv: null, batteryReserve: 7, synth: null, facilities: [] }, BUILD);
    check(noGen.generator === 0 && noGen.available === 7,
        `5k generatorLv = null ⇒ generator ${noGen.generator}、available = reserve 7`);
    checkThrows(() => computeAvailablePower({ generatorLv: 1, synth: null, facilities: [] }, BUILD),
        /batteryReserve 必须是有穷数/, '5l 漏传 batteryReserve 抛错（不得静默当 0）');
    checkThrows(() => computeAvailablePower({ generatorLv: 1, batteryReserve: -3, synth: null, facilities: [] }, BUILD),
        /batteryReserve 不得为负.*实测 -3/, '5m 负存量抛错（赤字应由耗电超出产生，不是负存量）');
    checkThrows(() => computeAvailablePower({ generatorLv: 1, batteryReserve: 0, synth: { lv: 2 } }, BUILD),
        /synth 缺少 producedUnits/, '5n synth 缺 producedUnits 抛错（料约束本步不建模，实产数必须显式传入）');
}

console.log('\n=== 6. 赤字：available 保留负值 且 shots = 0 ===');
{
    // [盘上] turret Lv3 8 + frost Lv3 12 + workshop Lv3 8 = 28；发电 Lv1 = 10、存量 0
    const deficitInput = {
        generatorLv: 1,
        batteryReserve: 0,
        synth: null,
        facilities: [{ type: 'turret', lv: 3 }, { type: 'frost', lv: 3 }, { type: 'workshop', lv: 3 }],
        powerPerShot: PLACEHOLDER_POWER_PER_SHOT,
    };
    const res = resolvePowerShots(deficitInput, BUILD);
    check(res.available === 10 - 28 && res.available < 0,
        `6a 赤字保留负值：available = ${res.available}（= 10 − 28），不静默归 0`);
    check(res.shots === 0, `6b 赤字时 shots = ${res.shots}（[待标定] 每发耗电为占位 ${PLACEHOLDER_POWER_PER_SHOT}）`);
    check(res.budget.facilityDraw === 28, `6c 分项可核：facilityDraw = ${res.budget.facilityDraw}（8 + 12 + 8）`);
    const ep = resolvePowerShots(deficitInput, BUILD);
    check(ep.available === res.available && ep.shots === 0, '6d 同一入参两次调用结果一致（无隐藏状态）');
}

console.log('\n=== 7. 容量 vs 存量：本模块只认 reserve ===');
{
    // [盘上] battery.capacity[0] = 15 是「单座 Lv1 的容量**增量**」，不是存量（src/config.js:993-994）
    const asReserve = computeAvailablePower({ generatorLv: 1, batteryReserve: 30, synth: null, facilities: [] }, BUILD);
    const asCapacity = computeAvailablePower(
        { generatorLv: 1, batteryReserve: BUILD.power.battery.capacity[0], synth: null, facilities: [] }, BUILD);
    check(asReserve.available !== asCapacity.available,
        `7a 传累计存量 30 ⇒ ${asReserve.available}；误传 capacity[0] 15 ⇒ ${asCapacity.available}，两者不等（证明用的是存量语义）`);
    check(asCapacity.available === 10 + BUILD.power.battery.capacity[0],
        `7b 误传路径的读数 = generator ${10} + capacity[0] ${BUILD.power.battery.capacity[0]}（把 capacity 当存量会少算一座满电电池的需求）`);
    const withBatterySeat = computeAvailablePower(
        { generatorLv: 1, batteryReserve: BUILD.power.battery.baseCapacity + BUILD.power.battery.capacity[0], synth: null, facilities: [] }, BUILD);
    check(withBatterySeat.available === 10 + 15 + 15,
        `7c 一座 Lv1 电池的存量上限 = baseCapacity ${BUILD.power.battery.baseCapacity} + capacity[0] ${BUILD.power.battery.capacity[0]} = ${withBatterySeat.available - 10}（容量与存量在此处才对齐）`);
}

console.log('\n=== 8. resolvePowerShots：floor 取整与每发耗电校验 ===');
{
    // generator Lv3 = 20 + reserve 6 = 26；占位每发耗电 4 ⇒ floor(26/4) = 6（不是 6.5、不是 7）
    const r = resolvePowerShots({
        generatorLv: 3, batteryReserve: 6, synth: null, facilities: [], powerPerShot: PLACEHOLDER_POWER_PER_SHOT,
    }, BUILD);
    check(r.available === 26, `8a available = ${r.available}（20 + 6）`);
    check(r.shots === Math.floor(26 / PLACEHOLDER_POWER_PER_SHOT) && r.shots === 6,
        `8b shots = ${r.shots} = floor(26/4)（占位每发耗电，非标定结果）`);
    check(r.shots !== Math.ceil(26 / PLACEHOLDER_POWER_PER_SHOT), `8c 不取上整（ceil 会得 ${Math.ceil(26 / PLACEHOLDER_POWER_PER_SHOT)}）`);
    check(r.powerPerShot === PLACEHOLDER_POWER_PER_SHOT, `8d 原样回传 powerPerShot = ${r.powerPerShot}（便于 UI 复核）`);
    check(r.budget.available === r.available, '8e shots 与 budget 用同一个 available（不出现双口径）');

    checkThrows(() => resolvePowerShots({ generatorLv: 1, batteryReserve: 0, synth: null, facilities: [], powerPerShot: 0 }, BUILD),
        /每发耗电必须是 > 0 的有限数.*实测 0/, '8f 每发耗电 = 0 抛错（由第 1 步 computePowerShots 抛出，未另写除零）');
    checkThrows(() => resolvePowerShots({ generatorLv: 1, batteryReserve: 0, synth: null, facilities: [], powerPerShot: -2 }, BUILD),
        /每发耗电必须是 > 0 的有限数.*实测 -2/, '8g 每发耗电为负抛错');
    checkThrows(() => resolvePowerShots({ generatorLv: 1, batteryReserve: 0, synth: null, facilities: [], powerPerShot: NaN }, BUILD),
        /每发耗电必须是 > 0 的有限数.*实测 NaN/, '8h 每发耗电为 NaN 抛错');
    checkThrows(() => resolvePowerShots({ generatorLv: 1, batteryReserve: 0, synth: null, facilities: [] }, BUILD),
        /每发耗电必须是 > 0 的有限数.*实测 undefined/, '8i 漏传每发耗电抛错（[待标定] 键不得缺省成 0）');
}

console.log('\n=== 9. 配置缺陷反例（深拷贝构造，不改导入对象） ===');
{
    const badDraw = clone(BUILD);
    badDraw.power.draw.turret = [4, 6]; // 长度 2 ≠ upCost.length + 1 = 3
    checkThrows(() => powerDrawFor('turret', 1, badDraw), /power\.draw\["turret"\] 的长度必须 = 3.*实测 2/,
        '9a power.draw 长度 ≠ upCost.length + 1 时抛错（拓扑口径 ④ 的落点）');

    const badGen = clone(BUILD);
    badGen.power.generate.generator = [10, 15];
    checkThrows(() => generatorOutputFor(1, badGen), /generator 长度必须 = 3.*实测 2/,
        '9b power.generate.generator 长度不足抛错');

    const badSynth = clone(BUILD);
    badSynth.power.synth.electricPerUnit = [5, 4];
    checkThrows(() => synthDrawFor(1, 1, badSynth), /electricPerUnit 长度必须 = 3.*实测 2/,
        '9c power.synth.electricPerUnit 长度不足抛错');

    const noDraw = clone(BUILD);
    delete noDraw.power.draw;
    checkThrows(() => powerDrawFor('turret', 1, noDraw), /缺少 power\.draw 段/,
        '9d power.draw 整段缺失抛错');
}

console.log('\n=== 10. 纯函数：不改入参 ===');
{
    const configSnap = JSON.stringify(BUILD);
    const input = {
        generatorLv: 2,
        batteryReserve: 4,
        synth: { lv: 2, producedUnits: 3 },
        facilities: [{ type: 'turret', lv: 1 }, { type: 'frost', lv: 2 }],
        powerPerShot: PLACEHOLDER_POWER_PER_SHOT,
    };
    const inputSnap = JSON.stringify(input);
    const before = resolvePowerShots(input, BUILD);
    const after = computeAvailablePower(input, BUILD);
    check(JSON.stringify(BUILD) === configSnap, '10a config 深比较不变（不写回、不补默认值）');
    check(JSON.stringify(input) === inputSnap, '10b 入参对象深比较不变（含 synth 与 facilities 子对象）');
    check(before.available === after.available && before.budget.synthDraw === after.synthDraw,
        `10c 两次独立调用的分项一致（available ${before.available} / synthDraw ${before.budget.synthDraw}）`);
    check(Array.isArray(input.facilities) && input.facilities.length === 2 && input.facilities[0].type === 'turret',
        '10d facilities 数组与其元素未被重排/改写');
    check(FACILITY_LEVELS.length === 3 && SYNTH_TYPE === 'synth',
        `10e 常量稳定（FACILITY_LEVELS 长度 ${FACILITY_LEVELS.length}、SYNTH_TYPE "${SYNTH_TYPE}"）`);
}

console.log('\n===================================================');
console.log(`  passed ${passed} / failed ${failed}  (total ${passed + failed})`);
console.log('===================================================');
if (failed > 0) {
    console.log('  FAILURES:');
    for (const f of failures) console.log(`   - ${f}`);
}
process.exit(failed === 0 ? 0 : 1);
