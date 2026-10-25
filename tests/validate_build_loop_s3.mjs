/**
 * validate_build_loop_s3.mjs - [REQ-20261022-wave-loop S3] 工厂网格数据结构 + 配置字段落点 + 存档 v3→v4 迁移。
 *
 * 覆盖：
 *   分件 11 —— gameplay.build.power 的键名与数值（含取整规则可复算、合成器乘积口径、电池「单座增量」口径），
 *              以及「既有字段一个都没被动过」；
 *   分件 4  —— grid / power / materials 的默认形状（起手 1 行 3 格）与设备单元 {type,level,buildSeq,enabled}；
 *   分件 12 —— 设计稿三档验证例、复验补的三档（4 槽满 + 3 格满 / 战斗槽有空格 / 两台同类型后勤）、
 *              buildSeq 全局发号、幂等、重复号兜底重排、存量电 B 案、收集器并入、溢出返料、失败兜底。
 *
 * Usage:
 *   node tests/validate_build_loop_s3.mjs
 */

import { CONFIG } from '../src/config.js';
import {
    COMBAT_SLOT_TOTAL,
    assignBuildSeq,
    createCombatSlots,
    createGridState,
    getPowerCapacity,
    hasDuplicateBuildSeq,
    makeDevice,
    migrateV3ToV4,
    repairBuildSeq,
    shouldMigrateV3ToV4,
} from '../src/utils/build_grid_utils.js';

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

const CFG = CONFIG.gameplay.build;
const POWER = CFG.power;
const DRAW = POWER.draw;
const json = v => JSON.stringify(v);
const eq = (a, b) => json(a) === json(b);
const devices = state => [
    ...(state.combatSlots || []).filter(Boolean),
    ...((state.grid && state.grid.cells) || []).filter(Boolean),
];
const seqs = state => devices(state).map(d => d.buildSeq);
const v3 = (facilities, extra = {}) => ({ loopVersion: 3, energy: 0, crystal: 0, facilities, facilitySlotsOpen: 1, ...extra });

console.log('===================================================');
console.log('  Build loop S3 validation (grid + config + v3→v4)');
console.log('===================================================\n');

// ---------------- 分件 11：配置字段落点 ----------------
{
    const bases = { turret: 4, frost: 6, lightning: 6, shieldGen: 4, workshop: 4 };
    const expected = { turret: [4, 6, 8], frost: [6, 9, 12], lightning: [6, 9, 12], shieldGen: [4, 6, 8], workshop: [4, 6, 8] };
    for (const [type, base] of Object.entries(bases)) {
        const arr = DRAW[type];
        const recomputed = [base, Math.ceil(base * 1.5), base * 2];
        check(Array.isArray(arr) && arr.length === 3, `分件 11：draw.${type} 是 3 档数组（= upCost.length + 1）`);
        check(eq(arr, recomputed), `分件 11：draw.${type} = [基础, ceil(基础×1.5), 基础×2]（耗电只许更贵）`);
        check(eq(arr, expected[type]), `分件 11：draw.${type} = ${json(expected[type])}`);
    }
    check(DRAW.generator === 0 && DRAW.battery === 0, '分件 11：后勤设备耗电明写 0（不省略，保证设施键 ↔ 耗电键一一齐全）');
    check(!Object.prototype.hasOwnProperty.call(DRAW, 'collector') && !Object.prototype.hasOwnProperty.call(DRAW, 'synthesizer'),
        '分件 11：collector 与 synthesizer 都不进 draw（合成器耗电只有乘积一条口径）');

    check(eq(POWER.generate.generator, [10, 15, 20]), '分件 11：发电机 generate = 10/15/20');

    check(POWER.battery.baseCapacity === 15, '分件 11：电池 baseCapacity = 15（不建电池就有底容量）');
    check(eq(POWER.battery.capacity, [15, 25, 40]), '分件 11：电池 capacity = 单座增量 15/25/40');
    check(getPowerCapacity([], CFG) === 15, '分件 11：无电池 → 总容量 15');
    check(getPowerCapacity([{ type: 'battery', level: 1 }], CFG) === 30, '分件 11：一座 Lv1 电池 → 总容量 30（不是 15）');
    check(getPowerCapacity([{ type: 'battery', level: 2 }], CFG) === 40, '分件 11：一座 Lv2 电池 → 总容量 40');
    check(getPowerCapacity([{ type: 'battery', level: 3 }, { type: 'battery', level: 1 }], CFG) === 70, '分件 11：两座电池按单座贡献相加（55 + 15）');

    check(eq(POWER.synth.electricPerUnit, [5, 4, 3]) && eq(POWER.synth.capPerWave, [2, 3, 4]), '分件 11：合成器 electricPerUnit [5,4,3] × capPerWave [2,3,4]');
    const synthDraw = POWER.synth.electricPerUnit.map((u, i) => u * POWER.synth.capPerWave[i]);
    check(eq(synthDraw, [10, 12, 12]), '分件 11：合成器每波耗电 Lv1/Lv2/Lv3 = 10/12/12（Lv3 与 Lv2 打平是刻意的）');

    // 2026-10-25 料经济标定：p 2 → 1（收入侧唯一改动，理由见 config.js:1022-1029 与
    // tests/validate_material_economy_balance.mjs）。本断言仍是精确等值，不许降级成「≥1」。
    check(POWER.materials.perHitsPerMaterial === 1, '分件 11：每 1 次命中给 1 料');
    const weights = POWER.materials.pegWeights;
    // [REQ-20261022-wave-loop 料→建造 再基线] 第四类钉由 `lightning` 换成 `bounce`：
    //   `config.js:1036` 落 `bounce: { beast: 1 }`，且 `lightning` 是死键（不在 peg_type_pool.js:20 的
    //   RANDOMIZABLE_PEG_TYPES 内，钉盘不刷该钉型）⇒ 原期望「weights.lightning.lightning === 1」已与盘上矛盾。
    check(!!weights.gray && !!weights.pyro && !!weights.cryo && !!weights.bounce, '分件 11：pegWeights 四类钉齐全（gray / pyro / cryo / bounce）');
    check(weights.gray.energy === 1 && weights.pyro.pyro === 1 && weights.cryo.cryo === 1 && weights.bounce.beast === 1,
        '分件 11：四类钉各自的账本权重（bounce 供第三色料 beast）');

    check(POWER.grid.cols === 3 && POWER.grid.rowsStart === 1 && POWER.grid.rowsMax === 5, '分件 11：grid = 3 列 / 起手 1 行 / 上限 5 行');
    check(POWER.grid.expandCost.length === 4, '分件 11：扩建 4 级（Lv1–Lv4）');
    check(eq(POWER.grid.expandCost[0], { crystal: 1, pyro: 3, cryo: 3 }) && eq(POWER.grid.expandCost[3], { crystal: 2, pyro: 12, cryo: 12 }),
        '分件 11：扩建首末档 💎1+🔥3+❄3 / 💎2+🔥12+❄12');

    // 既有字段一个都没被动过（本批只新增，不改语义与数值）
    check(eq(CFG.facilities.turret, { cost: 40, upCost: [40, 40], cd: 1, dmg: [6, 9, 13] }), '既有：facilities.turret 未被动过');
    check(CFG.facilities.collector.cost === 60 && eq(CFG.facilities.collector.perDig, [8, 12, 16]) && CFG.facilities.collector.unique === true,
        '既有：facilities.collector 未被动过（本批不动设备表）');
    // [再基线] `slots.openAtStart` 已由本批 1 → 2（`src/config.js:967`）：晶核的**唯一来源**是 Boss 击杀 +3
    //   （`src/core.js:553`），而开一个设施位要 2💎 ⇒ 只开 1 格时前几波不可能同时拥有炮台与工坊；
    //   而「塔吃电 vs 工坊造弹」这条取舍（每发耗电 2 / 工坊自身耗电 4 / 电池底容量 15）至少需要两格才成立。
    check(CFG.facilities.lv3Crystal === 1 && eq(CFG.slots, { total: 3, openAtStart: 2, openCrystal: 2 }),
        '既有：lv3Crystal / slots 未被动过（openAtStart 已再基线为 2，见 `src/config.js:967`）');
    check(eq(CFG.cannon.damagePrices, [30, 30, 45, 60, 80]) && eq(CFG.cannon.ratePrices, [60, 90, 130]) && eq(CFG.cannon.bouncePrices, [25, 40, 60]),
        '既有：主炮三轨价格未被动过');
    // [再基线] `config.js:1140` 把工坊 / 发电机挪进第 1 波解锁（料付设施当波可见、第 2 波才买得起）。
    check(CFG.items.slots === 2 && eq(CFG.reveal[1], ['dmg', 'workshop', 'generator']), '既有：items / reveal[1] 与盘上一致（第 1 波 = dmg + 工坊 + 发电机）');
}

// ---------------- 分件 4：网格数据结构与默认值 ----------------
{
    const d = createGridState(CFG);
    check(d.grid.cols === 3 && d.grid.rows === 1, '分件 4：起手网格 3 列 × 1 行');
    check(Array.isArray(d.grid.cells) && d.grid.cells.length === 3 && d.grid.cells.every(c => c === null), '分件 4：起手 3 个 null cell');
    check(eq(d.power, { capacity: 15, reserve: 0, buildSeqNext: 0 }), '分件 4：power 默认 { capacity:15, reserve:0, buildSeqNext:0 }');
    check(eq(d.materials, { pyro: 0, cryo: 0, lightning: 0 }), '分件 4：materials 默认三色料归 0');

    const dev = makeDevice('turret', 2, 5);
    check(eq(Object.keys(dev), ['type', 'level', 'buildSeq', 'enabled']), '分件 4：设备单元形状恰为 { type, level, buildSeq, enabled }');
    check(dev.type === 'turret' && dev.level === 2 && dev.buildSeq === 5 && dev.enabled === true, '分件 4：makeDevice 赋值正确、enabled 默认 true');
    check(makeDevice(null, 1) === null, '分件 4：无 type 不产生设备');
    const slots = createCombatSlots();
    check(slots.length === COMBAT_SLOT_TOTAL && COMBAT_SLOT_TOTAL === 4 && slots.every(s => s === null), '分件 4：战斗槽 4 位、起手全 null');
}

// ---------------- 分件 12①②：设计稿三档验证例 ----------------
{
    // ① 的分派例：[turret Lv2, collector Lv1, null]
    const a = migrateV3ToV4(v3([{ type: 'turret', level: 2, cd: 0 }, { type: 'collector', level: 1 }, null]), CFG);
    check(a.migrated && !a.fallback, '三档①：正常迁移（非兜底）');
    check(a.state.loopVersion === 4, '三档①：迁移后 loopVersion = 4');
    check(a.state.combatSlots[0].type === 'turret' && a.state.combatSlots[0].level === 2, '三档①：turret Lv2 落 combatSlots[0]、等级保留');
    check(a.state.combatSlots.slice(1).every(s => s === null), '三档①：combatSlots[1..3] 全 null');
    check(a.state.grid.cells[0].type === 'generator' && a.state.grid.cells[0].level === 1, '三档①：collector 映射为 generator Lv1 落 cells[0]');
    check(a.state.grid.cells[1] === null && a.state.grid.cells[2] === null, '三档①：cells[1..2] 全 null');
    check(a.state.combatSlots[0].buildSeq === 0 && a.state.grid.cells[0].buildSeq === 1 && a.state.power.buildSeqNext === 2,
        '三档①：buildSeq turret 0 / generator 1 / next 2');

    // 验证例 1：[turret Lv1, collector Lv2, null]
    const e1 = migrateV3ToV4(v3([{ type: 'turret', level: 1 }, { type: 'collector', level: 2 }, null]), CFG);
    check(e1.state.combatSlots[0].type === 'turret' && e1.state.combatSlots[0].buildSeq === 0, '例 1：[turret,collector,null] → turret buildSeq 0');
    check(e1.state.grid.cells[0].type === 'generator' && e1.state.grid.cells[0].level === 1 && e1.state.grid.cells[0].buildSeq === 1,
        '例 1：generator Lv1 落 cells[0]，buildSeq 1');
    check(e1.state.power.buildSeqNext === 2, '例 1：buildSeqNext 终值 2');

    // 验证例 2：换排法 [collector Lv2, null, turret Lv1] → 结果与例 1 完全相同
    const e2 = migrateV3ToV4(v3([{ type: 'collector', level: 2 }, null, { type: 'turret', level: 1 }]), CFG);
    check(e2.state.combatSlots[0].type === 'turret' && e2.state.combatSlots[0].buildSeq === 0, '例 2：v3 下标不影响定位 → turret 仍 buildSeq 0');
    check(e2.state.grid.cells[0].type === 'generator' && e2.state.grid.cells[0].buildSeq === 1 && e2.state.power.buildSeqNext === 2,
        '例 2：换排法后落点与发号同例 1（generator 1 / next 2）');
    check(eq(devices(e1.state).map(d => [d.type, d.level, d.buildSeq]), devices(e2.state).map(d => [d.type, d.level, d.buildSeq])),
        '例 2：两例的设备三元组逐台相等');

    // 验证例 3：[turret Lv1, frost Lv1, collector Lv2]（3 台满）
    const e3 = migrateV3ToV4(v3([{ type: 'turret', level: 1 }, { type: 'frost', level: 1 }, { type: 'collector', level: 2 }]), CFG);
    check(e3.state.combatSlots[0].type === 'turret' && e3.state.combatSlots[0].buildSeq === 0, '例 3：turret buildSeq 0');
    check(e3.state.combatSlots[1].type === 'frost' && e3.state.combatSlots[1].buildSeq === 1, '例 3：frost → combatSlots[1]、buildSeq 1');
    check(e3.state.grid.cells[0].type === 'generator' && e3.state.grid.cells[0].buildSeq === 2, '例 3：generator buildSeq 2');
    check(e3.state.power.buildSeqNext === 3, '例 3：buildSeqNext 终值 3');
    check(seqs(e3.state).every((n, i) => n === i), '例 3：号从 0 起连续、无跳号无并列');
}

// ---------------- 分件 12④：3→4 位战斗槽 / combatSlotsOpen ----------------
{
    const s = migrateV3ToV4(v3([{ type: 'shieldGen', level: 1 }, null, { type: 'lightning', level: 3 }], { facilitySlotsOpen: 2 }), CFG);
    check(s.state.combatSlots.length === 4, '3→4 位：combatSlots 长度恒 4');
    check(s.state.combatSlots[0].type === 'shieldGen' && s.state.combatSlots[1].type === 'lightning', '3→4 位：保持相对顺序、空位补 null');
    check(s.state.combatSlots[2] === null && s.state.combatSlots[3] === null, '3→4 位：第 4 位恒 null 直到扩建');
    check(s.state.combatSlots[1].level === 3, '3→4 位：等级原样搬');
    check(s.state.combatSlotsOpen === 2, 'facilitySlotsOpen 2 → combatSlotsOpen 2');
}

// ---------------- 复验补的三档（D / E / F）----------------
{
    // D 档：战斗槽 4 位全满 + 网格 3 台全满（7 台）→ 0..6 / next 7
    const d = assignBuildSeq(
        [{ type: 'turret', level: 1 }, { type: 'frost', level: 1 }, { type: 'lightning', level: 1 }, { type: 'shieldGen', level: 1 }],
        [{ type: 'generator', level: 1 }, { type: 'battery', level: 1 }, { type: 'workshop', level: 1 }],
    );
    check(eq(d.combatSlots.map(x => x.buildSeq), [0, 1, 2, 3]), 'D 档：战斗槽 4 满 → 0/1/2/3');
    check(eq(d.cells.map(x => x.buildSeq), [4, 5, 6]), 'D 档：网格 3 满 → 4/5/6');
    check(d.buildSeqNext === 7, 'D 档：buildSeqNext = 7');

    // E 档：战斗槽有空格（slot1、slot3 空）+ 网格 3 台 → 连续不跳号
    const e = assignBuildSeq([{ type: 'turret', level: 1 }, null, { type: 'frost', level: 1 }, null],
        [{ type: 'generator', level: 1 }, { type: 'generator', level: 1 }, { type: 'battery', level: 1 }]);
    check(e.combatSlots[0].buildSeq === 0 && e.combatSlots[2].buildSeq === 1, 'E 档：空格不占号（turret 0 / frost 1）');
    check(eq(e.cells.map(x => x.buildSeq), [2, 3, 4]), 'E 档：网格接续 2/3/4，不因空格跳号');
    check(e.buildSeqNext === 5, 'E 档：buildSeqNext = 5');

    // F 档：两台同类型后勤（两台收集器 → 两台发电机）
    const f = migrateV3ToV4(v3([{ type: 'collector', level: 2 }, { type: 'collector', level: 3 }, null]), CFG);
    const fc = f.state.grid.cells.filter(Boolean);
    check(fc.length === 2 && fc[0].type === 'generator' && fc[1].type === 'generator', 'F 档：两台同类型后勤都落进 cells（行优先）');
    check(fc[0].buildSeq === 0 && fc[1].buildSeq === 1 && f.state.power.buildSeqNext === 2, 'F 档：两台发电机 0/1、next 2');
    check(fc[0].level === 1 && fc[1].level === 1, 'F 档：两台收集器都按并入口径降 Lv1');
}

// ---------------- 分件 12⑦：幂等（判据＝显式标记 _v4Migrate.done）----------------
{
    const old = v3([{ type: 'turret', level: 1 }, { type: 'collector', level: 2 }, null], { energy: 920, facilitySlotsOpen: 3 });
    const first = migrateV3ToV4(old, CFG);
    const second = migrateV3ToV4(first.state, CFG);
    check(first.migrated === true && second.migrated === false, '幂等：第二次迁移直接跳过（migrated=false）');
    check(first.state._v4Migrate && first.state._v4Migrate.done === true, '幂等：迁移成功写入显式标记 _v4Migrate.done = true');
    check(devices(second.state).length === devices(first.state).length, '幂等：设备数不变（不会翻倍）');
    check(eq(seqs(second.state), seqs(first.state)), '幂等：buildSeq 全部不变');
    check(second.state.power.buildSeqNext === first.state.power.buildSeqNext, '幂等：buildSeqNext 不变');
    check(eq(second.state.grid.cells, first.state.grid.cells), '幂等：网格内容逐格相同');
    // 攒下的电不会被二次迁移重新补成满电池
    const spent = { ...first.state, power: { ...first.state.power, reserve: 3 } };
    check(migrateV3ToV4(spent, CFG).state.power.reserve === 3, '幂等：已迁档的 reserve 不会被再次补成满电池');
    // 一台设备都没有的旧档：迁移一次之后也该停（靠标记，不靠网格是否有设备）
    const emptyFirst = migrateV3ToV4(v3([null, null, null]), CFG);
    check(emptyFirst.migrated === true && emptyFirst.state.grid.cells.every(c => c === null), '幂等：空档也产出 3 个 null cell');
    check(migrateV3ToV4(emptyFirst.state, CFG).migrated === false, '幂等：空档第二次不再迁移');
}

// ---------------- B1 回归：只含战斗设备的旧档（网格全空）连迁三次不得回退 ----------------
{
    // 这是 v3 最常见的形态：玩家只建了炮台、没建收集器 → 迁移后 cells 全 null
    const old = v3([{ type: 'turret', level: 1 }, null, null], { energy: 40, facilitySlotsOpen: 1 });
    const load1 = migrateV3ToV4(old, CFG);
    check(load1.migrated === true && load1.state.grid.cells.every(c => c === null), 'B1：只含战斗设备的旧档首迁成功、网格全空');
    check(load1.state.combatSlots[0].level === 1, 'B1：首迁后炮台 Lv1');

    // 玩家在两次载入之间：炮台升到 Lv3、槽 1 建冰霜塔、把电用到 3
    const played = {
        ...load1.state,
        combatSlots: [
            { ...load1.state.combatSlots[0], level: 3 },
            { type: 'frost', level: 1, buildSeq: load1.state.power.buildSeqNext, enabled: true },
            null, null,
        ],
        power: { ...load1.state.power, buildSeqNext: load1.state.power.buildSeqNext + 1, reserve: 3 },
        energy: 7,
    };
    const load2 = migrateV3ToV4(played, CFG);
    check(load2.migrated === false, 'B1：第二次载入不再重迁（网格全空也算已迁）');
    check(load2.state.combatSlots[0].level === 3, 'B1：炮台等级不回退（玩家升到 Lv3 就还是 Lv3）');
    check(load2.state.combatSlots[1] && load2.state.combatSlots[1].type === 'frost', 'B1：槽 1 的冰霜塔不消失');
    check(load2.state.power.reserve === 3 && load2.state.energy === 7, 'B1：电量不被白送满（reserve 仍 3）');
    check(eq(seqs(load2.state), seqs(played)), 'B1：buildSeq 原样保留');

    const load3 = migrateV3ToV4(load2.state, CFG);
    check(load3.migrated === false && load3.state.combatSlots[0].level === 3 && load3.state.power.reserve === 3, 'B1：连续第三次载入仍不回退、不送电');

    // 迁完后玩家把网格里的发电机拆掉 → 再载入不得复活
    const withGen = migrateV3ToV4(v3([{ type: 'turret', level: 1 }, { type: 'collector', level: 2 }, null]), CFG);
    const removed = { ...withGen.state, grid: { ...withGen.state.grid, cells: [null, null, null] } };
    const reload = migrateV3ToV4(removed, CFG);
    check(reload.migrated === false, 'B1：拆掉发电机后再载入不重迁');
    check(reload.state.grid.cells.every(c => c === null), 'B1：已拆的设备不复活（网格仍全空）');
}

// ---------------- 合法的 v4 档（网格全空、只有战斗设备）→ 闸门判「已迁」 ----------------
{
    const legit = migrateV3ToV4(v3([{ type: 'turret', level: 2 }, null, null]), CFG).state;
    check(shouldMigrateV3ToV4(legit) === false, '闸门：合法 v4 档（网格全空、只有战斗设备）→ 不再迁移');
    check(shouldMigrateV3ToV4({ ...legit, grid: { cells: [null, null, null] } }) === false, '闸门：网格全空也不算没迁（判据是 done 标记，不是 cells）');
    check(shouldMigrateV3ToV4({ loopVersion: 4, facilities: [{ type: 'turret', level: 1 }], _v4Migrate: { done: true } }) === false,
        '闸门：只要 done 为真就跳过（version 与 facilities 都不参与主判据）');
    check(shouldMigrateV3ToV4({ loopVersion: 3, facilities: [{ type: 'turret', level: 1 }] }) === true, '闸门：v3 档（无标记）要迁');
}

// ---------------- 分件 12② 兜底：重复 / 缺失 buildSeq → 整表重排 ----------------
{
    const broken = {
        loopVersion: 4,
        combatSlots: [{ type: 'turret', level: 1, buildSeq: 4, enabled: true }, null, { type: 'frost', level: 1, buildSeq: 4, enabled: false }, null],
        grid: { cols: 3, rows: 1, cells: [{ type: 'generator', level: 1, buildSeq: undefined, enabled: true }, null, null] },
        power: { capacity: 15, reserve: 0, buildSeqNext: 7 },
        materials: { pyro: 0, cryo: 0, lightning: 0 },
    };
    check(hasDuplicateBuildSeq(broken) === true, '重复号兜底：能检出重复/缺失 buildSeq');
    const fixed = repairBuildSeq(broken, CFG);
    check(eq(fixed.combatSlots.filter(Boolean).map(d => d.buildSeq), [0, 1]), '重复号兜底：战斗槽重排为 0/1（槽位序优先）');
    check(fixed.grid.cells[0].buildSeq === 2, '重复号兜底：网格接排 2');
    check(fixed.power.buildSeqNext === 3, '重复号兜底：重排后 buildSeqNext = 台数（最大号 + 1）');
    check(hasDuplicateBuildSeq(fixed) === false, '重复号兜底：重排后不再有重复号');
    check(fixed.combatSlots[2].enabled === false, '重复号兜底：重排不动手动开关 enabled');
    check(fixed.grid.cells[0].type === 'generator' && fixed.grid.cells[0].level === 1, '重复号兜底：只重排号，不动设备本身');
    // 迁移产物永不带重复号
    const m = migrateV3ToV4(v3([{ type: 'turret', level: 1 }, { type: 'frost', level: 2 }, { type: 'collector', level: 3 }]), CFG);
    check(hasDuplicateBuildSeq(m.state) === false, '迁移产物无重复号（构造性保证）');
}

// ---------------- 分件 12 ③：溢出折三色料 ----------------
{
    // v3 手改档 4 台：下标 3 的那台丢弃，按其 cost 的 50% 折三色料平均返还（turret cost 40 → 20 → 7/7/6）
    const m = migrateV3ToV4(v3([
        { type: 'turret', level: 1 }, { type: 'frost', level: 1 }, { type: 'lightning', level: 1 },
        { type: 'turret', level: 2 },
    ]), CFG);
    check(devices(m.state).length === 3, '溢出：只取 3 台（下标 ≥ 3 丢弃）');
    check(m.state.materials.pyro === 7 && m.state.materials.cryo === 7 && m.state.materials.lightning === 6, '溢出：cost 40 的 50% = 20 折三色料 7/7/6（余数按 🔥→❄ 补）');
    check(m.state.materials.pyro + m.state.materials.cryo + m.state.materials.lightning === 20, '溢出：三色合计 = 50% 成本，不少不多');
    check(m.state.crystal === 0, '溢出：💎 不返（D5）');
    check(devices(m.state).every(d => d.type !== 'turret' || d.level === 1), '溢出：被丢弃的是下标 ≥ 3 那台（留下的第一台仍是 Lv1）');
}

// ---------------- 分件 12 ⑤：收集器并入发电机 ----------------
{
    const m = migrateV3ToV4(v3([{ type: 'collector', level: 2 }, null, null]), CFG);
    const gen = m.state.grid.cells[0];
    check(gen.type === 'generator' && gen.level === 1, '并入：Lv2 收集器 → { type: generator, level: 1 }');
    check(gen.buildSeq === 0 && gen.enabled === true, '并入：buildSeq 由网格阶段发号（0）、enabled 初值 true');
    check(m.toasts.includes('炼金收集器已并入发电机'), '并入：播一次 toast「炼金收集器已并入发电机」');
    // 产能按 Lv1 计：发电机 Lv1 每波 +10（而不是 Lv2 收集器的每次挖掘 +12，也不是发电机 Lv2 的 +15）
    check(POWER.generate.generator[gen.level - 1] === 10, '并入：补齐后的产能按 Lv1 计（每波 +10）');
    check(POWER.generate.generator[gen.level - 1] !== CFG.facilities.collector.perDig[1], '并入：不再按收集器 perDig 轴取值（不同轴，不能一一对应）');
    check(m.state.facilities.length === 3 && m.state.facilities[0].type === 'collector', '并入：v3 的 facilities 原样保留（接线期才删，兜底判据还要用它）');
}

// ---------------- 分件 12 存量电 B 案（§8 第 6 条已拍板）----------------
{
    const noBatt = migrateV3ToV4(v3([{ type: 'turret', level: 1 }, null, null], { energy: 920 }), CFG);
    check(noBatt.state.power.reserve === noBatt.state.power.capacity, 'B 案：reserve = 满容量（不按原值折算）');
    check(noBatt.state.power.capacity === 15 && noBatt.state.power.reserve === 15, 'B 案：无电池 → 15/15');
    check(noBatt.state._v4Migrate.legacyEnergy === 920 && noBatt.state._v4Migrate.legacyEnergyPolicy === 'battery-floor',
        'B 案：原值 920 留档在 _v4Migrate，策略标 battery-floor');
    check(noBatt.toasts.some(t => t.includes('满电池起步')), 'B 案：toast 表明按保底处理');
    check(noBatt.state.energy === 15, 'B 案：energy（本波可用电力）置为保底值，920 不泄漏进新账');

    const withBatt = migrateV3ToV4(v3([{ type: 'battery', level: 1 }, { type: 'turret', level: 1 }, null], { energy: 55 }), CFG);
    check(withBatt.state.power.capacity === 30 && withBatt.state.power.reserve === 30, 'B 案：已有 Lv1 电池 → 满容量 30');
    check(withBatt.state.grid.cells[0].type === 'battery' && withBatt.state.grid.cells[0].buildSeq === 1, 'B 案：电池按后勤落 cells，号接在战斗槽之后');
}

// ---------------- 分件 12 ⑥：失败兜底（H1 修正后三条硬约束）----------------
{
    const corrupt = { loopVersion: 3, crystal: 5, cannonLevels: { dmg: 2 }, digCount: 4, energy: 300 };
    Object.defineProperty(corrupt, 'facilities', { enumerable: true, get() { throw new Error('corrupt save'); } });
    const r = migrateV3ToV4(corrupt, CFG);
    check(r.fallback === true && r.migrated === false, '兜底：坏档走 fallback，不抛出');
    // ① 不得删除旧键——facilities 读不出来也必须「键仍在」
    check(Object.prototype.hasOwnProperty.call(r.state, 'facilities'), '兜底①：facilities 键仍在（不得整键消失）');
    check(Object.prototype.hasOwnProperty.call(r.state, 'energy'), '兜底①：energy 键仍在');
    // ② 不得置 done、不得写版本 4
    check(!(r.state._v4Migrate && r.state._v4Migrate.done === true), '兜底②：_v4Migrate.done 不为真');
    check(Number(r.state.loopVersion) !== 4, '兜底②：不写 loopVersion 4（否则等于把这次失败钉成永久状态）');
    // ③ 只留诊断
    check(r.state._v4Migrate.lastError === 'corrupt save', '兜底③：lastError 记录异常信息，但 done 不置真');
    check(r.state.crystal === 5 && r.state.digCount === 4 && eq(r.state.cannonLevels, { dmg: 2 }), '兜底：保留 crystal / digCount / cannonLevels（不丢已付费内容）');
    check(r.state.grid.cells.length === 3 && r.state.grid.cells.every(c => c === null), '兜底：grid 取起手 3 格空');
    check(r.state.power.reserve === 0 && r.state.materials.pyro === 0, '兜底：reserve 归 0、materials 归 0');
    check(shouldMigrateV3ToV4(r.state) === true, '兜底：下次载入仍判「需要迁」（靠 done 不为真，不靠版本号）');
    // 再「载入」一次：必须是重试，而不是「迁空成功 + 写版本 4」式的永久删号
    const retry = migrateV3ToV4(r.state, CFG);
    check(retry.migrated === false && retry.fallback === true, '兜底：第二次载入仍在重试（不是迁空成功）');
    check(Number(retry.state.loopVersion) !== 4 && !(retry.state._v4Migrate && retry.state._v4Migrate.done === true),
        '兜底：重试后仍不置 done、不写版本 4');
    check(Object.prototype.hasOwnProperty.call(retry.state, 'facilities'), '兜底：重试路径上 facilities 键依然在');
}

// ---------------- v1.4：facilities 形态分流（复验 M1）----------------
{
    const TOAST = '存档里的工厂布局无法识别，已按初始布局恢复';

    // ① null：值读得出来、只是不带设备信息 → 按空设备正常迁移（不判坏档）
    const rNull = migrateV3ToV4(v3(null, { energy: 40 }), CFG);
    check(rNull.migrated === true && rNull.fallback === false, 'M1：facilities:null → 正常迁移，不判坏档');
    check(rNull.state._v4Migrate && rNull.state._v4Migrate.done === true, 'M1：facilities:null 迁移后置 done');
    check(rNull.state.grid.cells.length === 3 && rNull.state.grid.cells.every(c => c === null), 'M1：facilities:null → 起手 3 格全 null');
    check(rNull.toasts.includes(TOAST), 'M1：facilities:null 带玩家可见提示');
    check(eq(rNull.state.materials, { pyro: 0, cryo: 0, lightning: 0 }), 'M1：facilities:null → 三色料均 0');

    // ② 其它非数组（字符串）→ 同上，同一条提示
    const rStr = migrateV3ToV4(v3('oops'), CFG);
    check(rStr.migrated === true && rStr.state._v4Migrate.done === true, 'M1：facilities:"oops" → 正常迁移并置 done');
    check(rStr.state.grid.cells.every(c => c === null) && rStr.state.combatSlots.every(s => s === null), 'M1：facilities:"oops" → 按空设备迁移');
    check(rStr.toasts.includes(TOAST), 'M1：facilities:"oops" 带同一条提示');
    check(rStr.state.materials.pyro === 0 && rStr.state.materials.cryo === 0 && rStr.state.materials.lightning === 0, 'M1：facilities:"oops" → 三色料均 0');

    // ③ 键在、值 undefined（兜底路径留下的痕迹）→ 仍判坏档、继续重试
    const rUndef = migrateV3ToV4({ loopVersion: 3, crystal: 7, energy: 100, facilities: undefined }, CFG);
    check(rUndef.fallback === true && rUndef.migrated === false, 'M1：facilities:undefined → 仍走兜底重试');
    check(!(rUndef.state._v4Migrate && rUndef.state._v4Migrate.done === true), 'M1：facilities:undefined 不置 done');
    check(rUndef.version === 3 && Number(rUndef.state.loopVersion) === 3, 'M1：facilities:undefined 返回 version 3（不写 4）');
    check(rUndef.state.crystal === 7, 'M1：facilities:undefined 仍保留 crystal');

    // ④ 幂等：null 档迁过之后再载一次不重迁
    check(migrateV3ToV4(rNull.state, CFG).migrated === false, 'M1：facilities:null 迁过后再载入不重迁');
}

// ---------------- v1.4 M2-2 / L2：产物归一 ＋ 成功路径只读一次 ----------------
{
    // ① 畸形原值不得原样进产物（落盘侧 `(this.facilities || []).map(...)` 对非数组抛 TypeError）
    const rStr = migrateV3ToV4(v3('oops'), CFG);
    check(Array.isArray(rStr.state.facilities) && rStr.state.facilities.length === 0,
        'M2-2：facilities:"oops" → 产物 facilities 归一为 []（畸形原值不带入）');

    // ② null 与 {} → 同上
    const rNull = migrateV3ToV4(v3(null), CFG);
    const rObj = migrateV3ToV4(v3({}), CFG);
    check(Array.isArray(rNull.state.facilities) && rNull.state.facilities.length === 0,
        'M2-2：facilities:null → 产物 facilities 为 []');
    check(Array.isArray(rObj.state.facilities) && rObj.state.facilities.length === 0,
        'M2-2：facilities:{} → 产物 facilities 为 []');

    // ③ 只读一次（计数 getter）：判据读 1 次，克隆阶段跳过该键
    let readCount = 0;
    const getterState = {
        loopVersion: 3, energy: 0, crystal: 0, facilitySlotsOpen: 1,
        get facilities() { readCount++; return [{ type: 'turret', level: 1 }]; },
    };
    const rGetter = migrateV3ToV4(getterState, CFG);
    check(readCount === 1, 'L2：成功路径对 facilities 只读一次（实测 ' + readCount + ' 次）');
    check(rGetter.migrated === true && rGetter.state.combatSlots[0] && rGetter.state.combatSlots[0].type === 'turret',
        'L2：计数 getter 档迁出的战斗槽第一台是 turret');

    // ④ 落盘形状：对归一后的产物跑落盘侧那一行表达式，不抛且为 []
    let saveThrew = null;
    let saveOut = null;
    try {
        saveOut = (rStr.state.facilities || []).map(f => (f ? { ...f } : null));
    } catch (err) {
        saveThrew = err;
    }
    check(saveThrew === null && Array.isArray(saveOut) && saveOut.length === 0,
        'M2-2：产物过落盘侧 (facilities || []).map(...) 不抛（TypeError 已消除）');

    // ⑤ 元素级不回渗（L3）：产物里的元素必须是拷贝，改产物不得改到入参（用 `slice()` 会静默退化）
    const srcFacilities = [{ type: 'turret', level: 2 }];
    const rRef = migrateV3ToV4(v3(srcFacilities), CFG);
    const srcBefore = JSON.stringify(srcFacilities);
    rRef.state.facilities[0].level = 99;
    check(JSON.stringify(srcFacilities) === srcBefore, '产物归一后改元素不回渗入参');
}

// ---------------- 迁移闸门（主判据＝_v4Migrate.done）----------------
{
    check(shouldMigrateV3ToV4({ loopVersion: 3, facilities: [null, null, null] }) === true, '闸门：v3 档要迁');
    check(shouldMigrateV3ToV4({ loopVersion: 4, facilities: [{ type: 'turret', level: 1 }], grid: { cells: [null, null, null] } }) === false,
        '闸门：缺 done 标记的 v4 档按已迁处理（宁可不迁也不重迁——重迁是抹进度的方向）');
    check(shouldMigrateV3ToV4({ loopVersion: 4, facilities: [], grid: { cells: [null, null, null] } }) === false, '闸门：干净的空 v4 档不重复迁');
    check(shouldMigrateV3ToV4({ _v4Migrate: { done: true }, loopVersion: 3 }) === false, '闸门：done 为真即跳过（版本号只是二次保险）');
}

console.log('\n===================================================');
console.log(`  Result: ${passed}/${passed + failed} passed`);
if (failures.length > 0) {
    console.log('\n  Failed checks:');
    failures.forEach(failure => console.log(`    - ${failure}`));
}
console.log('===================================================');

process.exit(failed > 0 ? 1 : 0);
