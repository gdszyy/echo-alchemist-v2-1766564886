/**
 * validate_workshop_capacity.mjs - [REQ-20261022-wave-loop · 经济接线 v2 第 4 步] 弹药工坊产能 `U` 纯函数断言。
 *
 * 依据：`docs/design/economy_wiring_spec_v2_corrections.md:56-66`（C1 订正后写法 `N = min(A,U,E,M)`，
 *       `U` 值域 `1..5`、初始 `< 5`）＋ `:69`（§8：只有耗电键 `[盘上]`、无产能键）
 *       ＋ `:294-303` 附录 C-3 第 4 步（前置＝步 3，`U` 按通电与否取值，回滚＝断开「读配置」）。
 *
 * 数值纪律：**产能现值全程 `[待标定]`**——盘上不存在任何产能键（`src/config.js:983` 原文
 *   「该设施尚未落 facilities，先只给耗电键」，`facilities` 段 `:963-970` 无 `workshop`）。
 *   本文件的产能表**全部是夹具**（`TABLE_A` / `TABLE_TOP` 等），**不是标定结果**，不得当成现值引用。
 *   取值域常量一律 import 第 1 步（`material_loadout_utils.js`），等级域一律 import 第 3 步
 *   （`power_budget_utils.js` 的 `FACILITY_LEVELS`），**不手抄 1 / 5 / 3**。
 *   本文件**不 import `src/config.js`**：本步纯函数不读配置，且另一施工方此刻正在改该文件。
 *
 * 覆盖（11 节）：未建工坊 · 单座 Lv1/2/3 · 通电/断电两层的分离 · 运行时 5 合法 ·
 *   多座取最高且**非求和** · 并列取小槽位 · 空数组 · `lv` 四类反例 · 通电判定等号与赤字 ·
 *   产能表七类反例（长度/非整数/非单调/下限/上限/初始） · 与第 1 步**同判**证明 ·
 *   `describe` 三种文案 · 纯函数不改入参。
 *
 * Usage:
 *   node tests/validate_workshop_capacity.mjs
 */

import {
    WORKSHOP_CAPACITY_MAX,
    WORKSHOP_CAPACITY_MIN,
    validateWorkshopCapacity,
} from '../src/utils/material_loadout_utils.js';
import { FACILITY_LEVELS } from '../src/utils/power_budget_utils.js';
import {
    WORKSHOP_DRAW_KEY,
    WORKSHOP_REASONS,
    describeWorkshopCapacity,
    isWorkshopPowered,
    pickWorkshop,
    resolveWorkshopCapacity,
    validateCapacityTable,
} from '../src/utils/workshop_capacity_utils.js';

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

/**
 * 产能表**夹具**（非标定结果）：长度 3、单调不减、首项 < 上界。
 * 选 `1,2,3` 只为让「取最高 ≠ 求和」可算（三者和 = 6，最高座 = 3）。
 */
const TABLE_A = [1, 2, 3];
/** 第二组**夹具**：末项取第 1 步的取值域上界常量，验证「运行时 5 合法、配置域不被改」。 */
const TABLE_TOP = [3, 4, WORKSHOP_CAPACITY_MAX];

console.log('=== 0. 前置：键名与等级域对齐盘上/第 3 步 ===');
{
    check(WORKSHOP_DRAW_KEY === 'workshop',
        `0a 耗电键名与盘上一致（src/config.js:983 power.draw.workshop），实测 "${WORKSHOP_DRAW_KEY}"`);
    check(FACILITY_LEVELS.join(',') === '1,2,3',
        `0b 等级域取第 3 步常量 FACILITY_LEVELS（src/utils/power_budget_utils.js:52），实测 [${FACILITY_LEVELS.join(', ')}]`);
}

console.log('\n=== 1. 未建工坊 ===');
{
    const r = resolveWorkshopCapacity({ workshops: [], capacityByLevel: TABLE_A });
    check(r.capacity === 0, `1a 未建工坊 ⇒ capacity = 0，实测 ${r.capacity}`);
    check(r.effectiveU === 0, `1b 未建工坊 ⇒ effectiveU = 0，实测 ${r.effectiveU}`);
    check(r.reason === WORKSHOP_REASONS.NO_WORKSHOP, `1c 未建工坊 ⇒ reason = '${WORKSHOP_REASONS.NO_WORKSHOP}'，实测 '${r.reason}'`);
    check(r.source === null && r.powered === false,
        `1d 未建工坊 ⇒ source = null 且 powered = false，实测 source=${JSON.stringify(r.source)} / powered=${r.powered}`);
}

console.log('\n=== 2. 单座 Lv1 / Lv2 / Lv3 取表中对应值 ===');
{
    for (const lv of FACILITY_LEVELS) {
        const r = resolveWorkshopCapacity({
            workshops: [{ slotIndex: 0, lv, powered: true }],
            capacityByLevel: TABLE_A,
        });
        const expect = TABLE_A[lv - 1];
        check(r.capacity === expect && r.effectiveU === expect && r.source && r.source.lv === lv,
            `2${'abc'[lv - 1]} 单座 Lv${lv} ⇒ capacity/effectiveU = 表中第 ${lv} 项 ${expect}、source.lv = ${lv}，实测 ${r.capacity}/${r.effectiveU}/${r.source && r.source.lv}`);
    }
}

console.log('\n=== 3. 通电 ⇒ effectiveU = capacity；断电 ⇒ effectiveU = 0 且 capacity 保持原值 ===');
{
    const on = resolveWorkshopCapacity({ workshops: [{ slotIndex: 1, lv: 2, powered: true }], capacityByLevel: TABLE_A });
    check(on.effectiveU === on.capacity, `3a 通电 ⇒ effectiveU === capacity，实测 ${on.effectiveU} === ${on.capacity}`);

    const off = resolveWorkshopCapacity({ workshops: [{ slotIndex: 1, lv: 2, powered: false }], capacityByLevel: TABLE_A });
    check(off.effectiveU === 0, `3b 断电 ⇒ effectiveU = 0（本波不造弹），实测 ${off.effectiveU}`);
    check(off.capacity === TABLE_A[1],
        `3c 断电 ⇒ capacity 仍为原配置值 ${TABLE_A[1]}（取 0 发生在运行时层、未污染配置层），实测 ${off.capacity}`);
    check(off.reason === WORKSHOP_REASONS.UNPOWERED && off.powered === false && off.source && off.source.lv === 2,
        `3d 断电 ⇒ reason='${WORKSHOP_REASONS.UNPOWERED}'、powered=false、source 仍指向那座（lv=2），实测 '${off.reason}'/${off.powered}/${JSON.stringify(off.source)}`);

    check(validateWorkshopCapacity(0).ok === false,
        '3e 配置层不接受 0：第 1 步 validateWorkshopCapacity(0) 判红（两个概念在类型上分开）');
    check(validateWorkshopCapacity(off.effectiveU).ok === false && off.effectiveU === 0,
        '3f 断电产出的 0 只存在于运行时层，不是配置取值域的成员');

    const top = resolveWorkshopCapacity({ workshops: [{ lv: 3, powered: true }], capacityByLevel: TABLE_TOP });
    check(top.capacity === WORKSHOP_CAPACITY_MAX && top.effectiveU === WORKSHOP_CAPACITY_MAX,
        `3g 运行时产能可取到第 1 步上界 ${WORKSHOP_CAPACITY_MAX}（已建成，不是初始值），实测 ${top.capacity}`);
}

console.log('\n=== 4. 多座工坊：取最高等级那一座，不求和 ===');
{
    const shops = [{ slotIndex: 0, lv: 1, powered: true }, { slotIndex: 1, lv: 3, powered: true }, { slotIndex: 2, lv: 2, powered: true }];
    const picked = pickWorkshop(shops, TABLE_A);
    check(picked.lv === 3, `4a 三座 Lv1/Lv3/Lv2 ⇒ 采纳 lv = 3，实测 lv = ${picked && picked.lv}`);
    check(picked.capacity === TABLE_A[2] && picked.slotIndex === 1,
        `4b 采纳的是 slot 1 的 Lv3，capacity = 表中第 3 项 ${TABLE_A[2]}，实测 slot ${picked && picked.slotIndex} / ${picked && picked.capacity}`);
    const sum = TABLE_A.reduce((a, b) => a + b, 0);
    check(picked.capacity !== sum,
        `4c capacity 不等于三座之和 ${sum}（求和会把 U 顶过射速轨天花板、破坏 N ≤ A），实测 ${picked.capacity}`);

    const r = resolveWorkshopCapacity({ workshops: shops, capacityByLevel: TABLE_A });
    check(r.source && r.source.slotIndex === 1 && r.source.lv === 3 && r.effectiveU === TABLE_A[2],
        `4d resolve 回传被采纳那座 { slotIndex: 1, lv: 3 } 供 UI 说明「用的是哪一座」，实测 ${JSON.stringify(r.source)} / effectiveU ${r.effectiveU}`);

    const tie = pickWorkshop([{ slotIndex: 5, lv: 2 }, { slotIndex: 3, lv: 2 }], TABLE_A);
    check(tie.slotIndex === 3, `4e 同等级并列 ⇒ 取 slotIndex 较小者（只作确定性排序，不表达优先级），实测 slot ${tie.slotIndex}`);

    const offTop = resolveWorkshopCapacity({
        workshops: [{ slotIndex: 0, lv: 1, powered: true }, { slotIndex: 2, lv: 3, powered: false }],
        capacityByLevel: TABLE_A,
    });
    check(offTop.effectiveU === 0 && offTop.capacity === TABLE_A[2],
        '4f 最高那座断电 ⇒ effectiveU = 0（不回落去用低等级那座），capacity 仍为该座配置值');
}

console.log('\n=== 5. pickWorkshop 空数组 ===');
{
    check(pickWorkshop([], TABLE_A) === null, '5a pickWorkshop([], table) ⇒ null');
}

console.log('\n=== 6. lv 越界/非整数/缺失 ⇒ 抛错 ===');
{
    checkThrows(() => pickWorkshop([{ slotIndex: 0, lv: 0 }], TABLE_A), /lv 必须是 1\.\.3 的整数.*slot 0 的 lv = 0/,
        '6a lv = 0 抛错并点名 slot 与实测值');
    checkThrows(() => pickWorkshop([{ slotIndex: 2, lv: 4 }], TABLE_A), /slot 2 的 lv = 4/,
        '6b lv = 4 抛错并点名 slot 2 与实测值');
    checkThrows(() => pickWorkshop([{ slotIndex: 0, lv: 1.5 }], TABLE_A), /lv = 1\.5/,
        '6c lv = 1.5 抛错（不四舍五入）');
    checkThrows(() => pickWorkshop([{ slotIndex: 0 }], TABLE_A), /lv = undefined/,
        '6d lv 缺失抛错（不静默当 0/1）');
    checkThrows(() => resolveWorkshopCapacity({ workshops: [{ slotIndex: 0, lv: 4, powered: true }], capacityByLevel: TABLE_A }),
        /\[resolveWorkshopCapacity\].*lv = 4/, '6e 核心入口同样抛错（前缀为 [resolveWorkshopCapacity]）');
}

console.log('\n=== 7. isWorkshopPowered：只做比较、等号算通电 ===');
{
    check(isWorkshopPowered({ availablePower: 8, workshopDraw: 8 }) === true,
        '7a available === draw ⇒ true（等号算通电：刚好付得起就该造得出弹）');
    check(isWorkshopPowered({ availablePower: 7, workshopDraw: 8 }) === false, '7b available < draw ⇒ false');
    check(isWorkshopPowered({ availablePower: -5, workshopDraw: 8 }) === false,
        '7c available 为负（电力赤字）⇒ false，不封底改写');
    check(isWorkshopPowered({ availablePower: 0, workshopDraw: 0 }) === true, '7d 双方为 0 ⇒ true（未建工坊不耗电的边界）');
    checkThrows(() => isWorkshopPowered({ workshopDraw: 8 }), /availablePower 必须是有穷数.*undefined/,
        '7e 缺 availablePower 抛错并点名字段');
    checkThrows(() => isWorkshopPowered({ availablePower: 8 }), /workshopDraw 必须是有穷数.*undefined/,
        '7f 缺 workshopDraw 抛错并点名字段');
    checkThrows(() => isWorkshopPowered({ availablePower: '8', workshopDraw: 8 }), /availablePower.*"8"/,
        '7g 非数（字符串）抛错，不隐式转换');
    checkThrows(() => isWorkshopPowered(), /入参必须是对象/, '7h 入参缺失抛错');
}

console.log('\n=== 8. validateCapacityTable 反例 ===');
{
    checkThrows(() => validateCapacityTable([1, 2]), /长度必须 = 3.*实测 2/, '8a 长度 2 抛错并点名实测长度');
    checkThrows(() => validateCapacityTable([1, 2, 3, 4]), /长度必须 = 3.*实测 4/, '8b 长度 4 抛错');
    checkThrows(() => validateCapacityTable([1, 2, 2.5]), /capacityByLevel\[2\]（Lv3）不合规.*必须是整数/,
        '8c 含非整数抛错并点名哪一级');
    checkThrows(() => validateCapacityTable([2, 1, 3]), /单调不减.*Lv1 = 2 > Lv2 = 1/, '8d 非单调 [2,1,3] 抛错并点名相邻两级');
    checkThrows(() => validateCapacityTable([0, 2, 3]), /capacityByLevel\[0\]（Lv1）不合规.*取值域是 1\.\.5，实测 0/,
        '8e 含 0 抛错（取值域下限由第 1 步给出）');
    checkThrows(() => validateCapacityTable([1, 2, WORKSHOP_CAPACITY_MAX + 1]),
        new RegExp(`capacityByLevel\\[2\\]（Lv3）不合规.*实测 ${WORKSHOP_CAPACITY_MAX + 1}`), '8f 超上界抛错并点名 Lv3');
    checkThrows(() => validateCapacityTable([WORKSHOP_CAPACITY_MAX, WORKSHOP_CAPACITY_MAX, WORKSHOP_CAPACITY_MAX]),
        /capacityByLevel\[0\]（Lv1）不合规.*初始 U 必须/, '8g Lv1 取到上界 ⇒ 违反「初始值 < 上限」抛错');
    checkThrows(() => validateCapacityTable('1,2,3'), /必须是数组/, '8h 非数组抛错');
    const ok = validateCapacityTable([1, 2, 2]);
    check(ok.ok === true && JSON.stringify(ok.table) === '[1,2,2]',
        `8i 合法表 [1,2,2] 通过并回传副本，实测 ok=${ok.ok} table=${JSON.stringify(ok.table)}`);
}

console.log('\n=== 9. 证明取值域转调第 1 步 validateWorkshopCapacity（不复制常量） ===');
{
    const probe = (v) => {
        let mineOk = true;
        let mineMsg = '';
        try {
            validateCapacityTable([WORKSHOP_CAPACITY_MIN, WORKSHOP_CAPACITY_MIN, v]);
        } catch (e) {
            mineOk = false;
            mineMsg = String((e && e.message) || e);
        }
        const step1 = validateWorkshopCapacity(v, { initial: false });
        return { mineOk, step1Ok: step1.ok, mineMsg, step1Msg: step1.errors.join('；') };
    };
    const cases = [
        [WORKSHOP_CAPACITY_MIN, '9a 下限值'],
        [WORKSHOP_CAPACITY_MAX, '9b 上限值'],
        [WORKSHOP_CAPACITY_MIN - 1, '9c 下限 - 1'],
        [WORKSHOP_CAPACITY_MAX + 1, '9d 上限 + 1'],
    ];
    for (const [v, label] of cases) {
        const p = probe(v);
        check(p.mineOk === p.step1Ok,
            `${label} ${v}：本模块与第 1 步同判（本模块 ok=${p.mineOk} / 第 1 步 ok=${p.step1Ok}）；第 1 步原文：${p.step1Msg || '（无错）'}`);
    }
}

console.log('\n=== 10. describeWorkshopCapacity 三种状态 ===');
{
    const ok = resolveWorkshopCapacity({ workshops: [{ slotIndex: 0, lv: 2, powered: true }], capacityByLevel: TABLE_A });
    check(describeWorkshopCapacity(ok) === `弹药工坊 Lv2 · 产能 ${TABLE_A[1]} 发`,
        `10a 通电文案，实测 "${describeWorkshopCapacity(ok)}"`);

    const off = resolveWorkshopCapacity({ workshops: [{ slotIndex: 0, lv: 3, powered: false }], capacityByLevel: TABLE_A });
    const offText = describeWorkshopCapacity(off);
    check(offText === '弹药工坊断电（本波不造弹）', `10b 断电文案逐字一致，实测 "${offText}"`);
    check(offText.includes('不造弹'), '10c 断电文案含「不造弹」（玩家可见后果必须说清）');

    const none = resolveWorkshopCapacity({ workshops: [], capacityByLevel: TABLE_A });
    check(describeWorkshopCapacity(none) === '未建弹药工坊', `10d 未建文案，实测 "${describeWorkshopCapacity(none)}"`);

    checkThrows(() => describeWorkshopCapacity({ reason: 'wat' }), /未知 reason "wat"/, '10e 未知 reason 抛错（不静默给空串）');
}

console.log('\n=== 11. 纯函数：不改入参 ===');
{
    const input = {
        workshops: [
            { slotIndex: 0, lv: 2, powered: true, note: '夹具字段，验证不被改写' },
            { slotIndex: 1, lv: 1, powered: false, note: '夹具字段，验证不被重排' },
        ],
        capacityByLevel: clone(TABLE_A),
    };
    const inputSnap = JSON.stringify(input);
    const tableSnap = JSON.stringify(input.capacityByLevel);

    const first = resolveWorkshopCapacity(input);
    const second = resolveWorkshopCapacity(input);
    pickWorkshop(input.workshops, input.capacityByLevel);
    validateCapacityTable(input.capacityByLevel);
    describeWorkshopCapacity(first);

    check(JSON.stringify(input) === inputSnap, '11a 入参对象深比较不变（含 workshops 元素的自定义字段）');
    check(JSON.stringify(input.capacityByLevel) === tableSnap && input.capacityByLevel !== TABLE_A,
        '11b capacityByLevel 深比较不变，且用的是独立副本（不误改夹具常量）');
    check(first.capacity === second.capacity && first.effectiveU === second.effectiveU && first.reason === second.reason,
        `11c 连调两次结果一致（${first.capacity}/${first.effectiveU}/${first.reason}）`);
    const picked = pickWorkshop(input.workshops, input.capacityByLevel);
    check(JSON.stringify(Object.keys(picked).sort()) === '["capacity","lv","slotIndex"]',
        `11d pickWorkshop 只回 { slotIndex, lv, capacity }，不回原对象引用（实测键 ${Object.keys(picked).join(',')}）`);
}

console.log('\n===================================================');
console.log(`  passed ${passed} / failed ${failed}  (total ${passed + failed})`);
console.log('===================================================');
if (failed > 0) {
    console.log('  FAILURES:');
    for (const f of failures) console.log(`   - ${f}`);
}
process.exitCode = failed === 0 ? 0 : 1;
