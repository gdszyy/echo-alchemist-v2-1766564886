/**
 * validate_wave_freeze.mjs - [REQ-20261022-wave-loop · 经济接线 v2 步 6/7] 预演 + 冻结记录 验收。
 *
 * 施工依据：`docs/design/economy_wiring_spec_v2_corrections.md` 附录 C-3 第 6/7 步——
 *   6｜预演 + 冻结记录（含干回合分支调 `mat_grantFloorOnly`）｜前置 步 1–5｜回滚：把 `src\game_phase.js:1539-1545` 切回原调用
 *   7｜冻结记录入档｜前置 步 6｜回滚：删存档字段，缺则首帧重算一次
 *
 * 本文断言的模型（不是某一次跑出来的实现值）：
 *   - `N = min(A, U, E, M)`，`A` 排第一；并列时 `bound` 取靠前者（与 `pickBindingLimit` 同口径，`ties` 保留全部命中项）；
 *   - 断电 ⇒ `U = 0`，且工坊断电时 `E = 0`（工坊是把电换成弹的转换器，断电换不出弹）；
 *   - 多座工坊取**最高等级**那一座，**不求和**；
 *   - 电力口径：战斗设施先扣、工坊后判（`computeAvailablePower` 只喂战斗设施）；
 *   - 干回合：不挖、不扣料、沿用上一波 `N`、保底 +3 走 `grantFloorOnly`；
 *   - 零发（`N = 0`）：不入料账（不写 `spent`、不动余额），登记异常路径并计数。
 *
 * 数值标注：本文件出现的「期望值」全部由**夹具直接给定**（射速轨 A / 料余额 / 产能表 / 每发耗电 / 电池底容量），
 *   不是配置现值。`power.powerPerShot`（`src/config.js:1004`）与 `build.workshop.capacityByLevel`（`:1058`）**已补齐**，
 *   本文件仍用夹具**注入 / 删除**来逐分支断言：A0 断「缺键 ⇒ 该闸门不构成上限」，其余各段注入夹具值跑通闸门逻辑（跑完还原）。
 *   电池底容量按同一手法钉 0 隔离（见 `setBatteryBase`）；真配置下的电池接线由 `tests/validate_power_wiring.mjs` 守。
 *
 * Usage:
 *   node tests/validate_wave_freeze.mjs
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CONFIG } from '../src/config.js';
import { game_phase } from '../src/game_phase.js';
import { material_system } from '../src/material_system.js';
import { normalizeLedger } from '../src/utils/material_economy_utils.js';
import { computeMaterialShots, pickBindingLimit } from '../src/utils/material_loadout_utils.js';

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

// ------------------------------------------------------------------ 夹具
const buildCfg = (CONFIG.gameplay && CONFIG.gameplay.build) || {};
function setPowerPerShot(v) {
    if (v === undefined) delete buildCfg.power.powerPerShot;
    else buildCfg.power.powerPerShot = v;
}
function setWorkshopTable(t) {
    if (t === undefined) delete buildCfg.workshop;
    else buildCfg.workshop = { capacityByLevel: t.slice() };
}
/**
 * 电池底容量夹具（**隔离项**，不是配置现值）：
 *   本文件固定 `baseCapacity = 0`，把「底容量 15 现在会独立点亮工坊」这条新事实从四轴契约里隔离出去——
 *   否则 B1「未建发电机 ⇒ 剩余电 0 ⇒ 断电」的前提当场不成立（`15 ≥ 工坊抽 4` 也算通电），
 *   B 段那一整组「断电 ⇒ U = 0 / E = 0 / N = 0」就再也测不到。
 *   **真配置的电池接线不在本文件守**：`build.power.battery.baseCapacity = 15`（[Owner] D7）与
 *   `capacity = [15,25,40]`（单座增量，不是绝对值）的口径与算例，见 `tests/validate_power_wiring.mjs`
 *   的 A 段（逐级/多座/缺键留痕）与 C 段（`15 − 4 = 11 ⇒ E = 5`）。
 */
function setBatteryBase(v) {
    if (v === undefined) delete buildCfg.power.battery.baseCapacity;
    else buildCfg.power.battery.baseCapacity = v;
}

/**
 * 假宿主：把 material_system 与 game_phase 的方法绑上去（与既有 validate_material_persist.mjs 的 makeHost 同一手法）。
 * `shots` = 射速轨上限 A（build_economy_utils.computeCannonStats 的产物，这里直接给定，不重算）。
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
    if (opts.frozen !== undefined) host._materialFrozenRecord = opts.frozen;
    return host;
}

/** 工坊槽位夹具（`{ type, level }`，与 build_economy_utils.js:14 的形状一致）。 */
const ws = level => ({ type: 'workshop', level });
const gen = level => ({ type: 'generator', level });
const turret = level => ({ type: 'turret', level });

console.log('[预演 + 冻结记录] 步 6/7 验收');
console.log(`  盘上现状（本文件 A 段直接断它）：power.powerPerShot = ${JSON.stringify(CONFIG.gameplay.build.power.powerPerShot)}`
    + ` · build.workshop = ${JSON.stringify(CONFIG.gameplay.build.workshop)}（两键已补齐；本文件用夹具注入/删除逐分支断言）`);

// ============================================================ A
section('A. N = min(A, U, E, M)：四轴各自唯一绑定 + 并列口径');

console.log(`  ── 电池底容量隔离：真配置 baseCapacity = ${JSON.stringify(CONFIG.gameplay.build.power.battery.baseCapacity)}`
    + '（[Owner] D7，真接线由 validate_power_wiring.mjs A/C 段守）；本文件四轴用例统一钉 0，'
    + '否则「未建发电机 ⇒ 断电」的前提不成立');
setBatteryBase(0);

setPowerPerShot(undefined);
setWorkshopTable(undefined);

{
    // A0：未接线态（盘上真实态）——U / E 两条闸门尚未标定 ⇒ 不构成上限，N 由既有 A × M 口径决定。
    const host = makeHost({ round: 3, shots: 2, ledger: { pyro: 30, cryo: 0 } });
    const preview = host.sys_getWavePreview();
    console.log('  ── sys_getWavePreview() 实测返回（未接线态，逐字）：');
    console.log(`     ${JSON.stringify(preview)}`);
    eq(preview.round, 3, 'A0a round = 当前回合号');
    eq(preview.shots, 2, 'A0b 未接线态 N = A（U/E 不构成闸门，M 此处 = 10 不绑）');
    eq(preview.bound, 'A', 'A0c 未接线态 bound = A');
    deepEq(preview.ties, [], 'A0d 未接线态 ties = []（bound = A 自己不算并列）');
    eq(preview.detail.A, 2, 'A0e detail.A = 2（夹具射速轨）');
    eq(preview.detail.U, Infinity, 'A0f detail.U = Infinity（工坊产能未标定/未建）');
    eq(preview.detail.E, Infinity, 'A0g detail.E = Infinity（每发耗电未标定）');
    eq(preview.detail.M, 10, 'A0h detail.M = floor(30 / 3) = 10（单料 pyro 3）');
    eq(preview.dry, false, 'A0i 本回合已挖 ⇒ 非干回合');
    eq(preview.recipeId, 'ammo_pyro_single', 'A0j 未选配方 ⇒ 默认取 cost 最低那条');
    eq(preview.workshopBuilt, false, 'A0k 未建工坊 ⇒ workshopBuilt = false（UI 显示「未建造」，不显示断电文案）');
    eq(preview.powered, false, 'A0k2 workshopBuilt = false 时 powered 恒 false，且不参与 UI 判断');
    deepEq(preview.shedOptions, [], 'A0l 无战斗设施 ⇒ shedOptions 为空');
    eq(JSON.stringify(preview.detail), JSON.stringify({ A: 2, U: null, E: null, M: 10 }),
        'A0m Infinity 在 JSON 下渲染成 null（UI 必须读成「该上限未接线」，不许读成 0）');
}

{
    // A1：M 唯一绑定。
    const host = makeHost({ round: 1, shots: 5, ledger: { pyro: 3, cryo: 0 } });
    const preview = host.sys_getWavePreview();
    eq(preview.detail.M, 1, 'A1a detail.M = floor(3 / 3) = 1');
    eq(preview.shots, 1, 'A1b N = 1（M 绑定）');
    eq(preview.bound, 'M', 'A1c bound = M');
    deepEq(preview.ties, [], 'A1d ties = []（单轴绑定 M，无并列）');
    const core = host.phase_wavePreviewCore(5);
    deepEq(core.limit.bindingMaterialKeys, ['pyro'], 'A1e 卡材料必须落到具体料键（pyro），不许裸「卡材料」');
}

setWorkshopTable([3, 4, 5]);
setPowerPerShot(undefined);

{
    // A2：U 唯一绑定（工坊 Lv1 产能 3；通电：发电机 Lv1 发 10⚡ ≥ 工坊 Lv1 抽 4⚡）。
    const host = makeHost({ round: 1, shots: 5, ledger: { pyro: 300, cryo: 0 }, facilities: [gen(1), ws(1)] });
    const preview = host.sys_getWavePreview();
    eq(preview.powered, true, 'A2a 剩余电 10 ≥ 工坊抽 4 ⇒ 通电');
    eq(preview.workshopBuilt, true, 'A2a2 已建工坊 ⇒ workshopBuilt = true');
    eq(preview.detail.U, 3, 'A2b detail.U = 产能表 [3,4,5] 的 Lv1 = 3');
    eq(preview.shots, 3, 'A2c N = 3（U 绑定，A = 5 更大）');
    eq(preview.bound, 'U', 'A2d bound = U（卡产能）');
    deepEq(preview.ties, [], 'A2e ties = []（单轴绑定 U，无并列）');
    eq(preview.detail.E, Infinity, 'A2f 每发耗电未标定 ⇒ E = null，不进 min（有工坊通电时它才可能参与）');
}

setPowerPerShot(6);

{
    // A3：E 唯一绑定（每发耗电 6：可用电 = 10 发电 − 4 工坊 = 6 ⇒ E = 1）。
    const host = makeHost({ round: 1, shots: 5, ledger: { pyro: 300, cryo: 0 }, facilities: [gen(1), ws(1)] });
    const preview = host.sys_getWavePreview();
    eq(preview.detail.E, 1, 'A3a detail.E = floor((10 − 4) / 6) = 1（工坊通电时其耗电从可用电力里扣）');
    eq(preview.shots, 1, 'A3b N = 1（E 绑定）');
    eq(preview.bound, 'E', 'A3c bound = E（卡电）');
    deepEq(preview.ties, [], 'A3d ties = []（单轴绑定 E，无并列）');
}

setPowerPerShot(undefined);
setWorkshopTable(undefined);

{
    // A4：并列取靠前者（A 与 M 并列 2）——四条上限的固定输出顺序是 A, U, E, M。
    const host = makeHost({ round: 1, shots: 2, ledger: { pyro: 6, cryo: 0 } });
    const preview = host.sys_getWavePreview();
    eq(preview.detail.M, 2, 'A4a detail.M = floor(6 / 3) = 2');
    eq(preview.shots, 2, 'A4b N = 2');
    deepEq(preview.ties, ['M'], 'A4c ties 只留除 bound 外的并列轴（A 绑定时只留 M）');
    eq(preview.bound, 'A', 'A4d 并列时 bound 取靠前者 = A');
    const mine = pickBindingLimit({ rate: 2, capacity: Infinity, power: Infinity, materials: 2, bindingMaterialKeys: ['pyro'] });
    eq(preview.bound, mine.bound, 'A4e bound 与第 1 步 pickBindingLimit 同口径（不另写一套并列规则）');
}

setWorkshopTable([3, 4, 5]);
setPowerPerShot(2);

{
    // A5：四轴全等 3（A=3、U=3、E=floor(6/2)=3、M=floor(9/3)=3）。
    const host = makeHost({ round: 1, shots: 3, ledger: { pyro: 9, cryo: 0 }, facilities: [gen(1), ws(1)] });
    const preview = host.sys_getWavePreview();
    deepEq(preview.detail, { A: 3, U: 3, E: 3, M: 3 }, 'A5a 四轴实测全为 3');
    deepEq(preview.ties, ['U', 'E', 'M'], 'A5b 四条并列 ⇒ ties 留除 bound(A) 外三项');
    eq(preview.bound, 'A', 'A5c bound 仍取靠前者（A）');
    eq(preview.shots, 3, 'A5d N = 3');
}

// ============================================================ B
section('B. 断电 ⇒ U = 0 ⇒ N = 0；E 不会因为工坊断电被误算成「还能发」');

setWorkshopTable([3, 4, 5]);
setPowerPerShot(1);

{
    // B1：没建发电机 ⇒ 本波发电 0 ⇒ 剩余电 0 < 工坊抽 4 ⇒ 断电。
    const host = makeHost({ round: 1, shots: 5, ledger: { pyro: 300, cryo: 0 }, facilities: [ws(1)] });
    const preview = host.sys_getWavePreview();
    eq(preview.powered, false, 'B1a 未建发电机 ⇒ 剩余电 0 < 4 ⇒ 断电');
    eq(preview.workshopBuilt, true, 'B1a2 工坊已建 ⇒ workshopBuilt = true（UI 才允许显示断电文案）');
    eq(preview.detail.U, 0, 'B1b 断电 ⇒ U = 0');
    eq(preview.detail.E, 0, 'B1c 断电 ⇒ E = 0（工坊换不出弹，不许「还能发」）');
    eq(preview.detail.M, 100, 'B1d 料充足（M = 100），说明 0 发不是料卡住');
    eq(preview.shots, 0, 'B1e N = min(5, 0, 0, 100) = 0');
    eq(preview.bound, 'U', 'B1f bound = U');
    deepEq(preview.ties, ['E'], 'B1g ties = [E]（U 是绑定轴不进 ties，E 同时归零才算并列）');
    // —— 下面这几条守的是「断电 ⇒ 本波真打不出弹」，即 0 发没有被「至少补 1 发」的兜底钳回 1。
    const frozen = host.phase_freezeWaveRecord(5);
    eq(frozen.N, 0, 'B1h 断电 ⇒ 冻结记录 N = 0（真 0 发，不是被钳成 1 发）');
    eq(frozen.bound, 'U', 'B1i 冻结记录 bound = U（发数被产能闸门压住）');
    deepEq(frozen.spent, { pyro: 0, cryo: 0 }, 'B1j 0 发不入料账：spent 全 0');
    eq(host.materialLedger.pyro, 300, 'B1k 0 发不动余额（pyro 仍 300）');
    host._waveZeroShotThisRound = true;
    eq(host.phase_shouldBackfillAmmo(0), false, 'B1l 有意 0 发 ⇒ 不补 1 发（断电口径优先于兜底）');
    eq(host.phase_shouldBackfillAmmo(2), false, 'B1m 队列非空 ⇒ 不补');
    host._waveZeroShotThisRound = false;
    eq(host.phase_shouldBackfillAmmo(0), true, 'B1n 异常空（非上限压 0）⇒ 仍补 1 发，保留既有防死循环兜底');
}

{
    // B2：战斗设施先扣 —— 电网够但被炮台吃掉，工坊照样断电；shedOptions 给出「关掉它能腾多少电」。
    const host = makeHost({ round: 1, shots: 5, ledger: { pyro: 300, cryo: 0 }, facilities: [gen(1), turret(3), ws(1)] });
    const preview = host.sys_getWavePreview();
    eq(preview.powered, false, 'B2a 发电 10 − 炮台 Lv3 抽 8 = 2 < 工坊 4 ⇒ 断电（战斗设施先扣）');
    eq(preview.shots, 0, 'B2b N = 0');
    deepEq(preview.shedOptions, [{ key: 'turret#1', draw: 8 }], 'B2c shedOptions 指出关掉炮台可腾 8 电（key = 类型#槽位号）');
}

{
    // B3：shedOptions 按可腾电降序。
    const host = makeHost({
        round: 1, shots: 5, ledger: { pyro: 300, cryo: 0 },
        facilities: [gen(1), turret(1), { type: 'frost', level: 1 }, ws(1)],
    });
    const preview = host.sys_getWavePreview();
    deepEq(preview.shedOptions, [{ key: 'frost#2', draw: 6 }, { key: 'turret#1', draw: 4 }],
        'B3a shedOptions 按可腾电降序（frost 6 > turret 4）');
}

{
    // B4：扣掉消耗后刚好够 ⇒ 算通电（等号打通电）。
    const host = makeHost({ round: 1, shots: 5, ledger: { pyro: 300, cryo: 0 }, facilities: [gen(1), turret(2), ws(1)] });
    const preview = host.sys_getWavePreview();
    eq(preview.powered, true, 'B4a 发电 10 − 炮台 Lv2 抽 6 = 4，等于工坊抽 4 ⇒ 通电（等号算通电）');
    eq(preview.detail.U, 3, 'B4b 通电 ⇒ U 取产能表 Lv1 = 3');
    eq(preview.detail.E, 0, 'B4c 剩余电全部被工坊吃掉 ⇒ E = floor(0 / 1) = 0');
    eq(preview.shots, 0, 'B4d N = 0（E 绑定时 U 再大也换不出弹）');
    eq(preview.bound, 'E', 'B4e bound = E');
}

// ============================================================ C
section('C. 多座工坊取最高等级，不求和');

setWorkshopTable([3, 4, 5]);
setPowerPerShot(undefined);

{
    // C1：两座 Lv3（产能表 Lv3 = 5）——求和会得 10，取最高级得 5。
    const host = makeHost({ round: 1, shots: 5, ledger: { pyro: 300, cryo: 0 }, facilities: [gen(3), ws(3), ws(3)] });
    const preview = host.sys_getWavePreview();
    eq(preview.detail.U, 5, 'C1a detail.U = 5（取 Lv3 产能 5，不求和成 10）');
    const core = host.phase_wavePreviewCore(5);
    eq(core.workshop.source.lv, 3, 'C1b 采纳的是 Lv3 那座');
    eq(core.workshop.source.slotIndex, 1, 'C1c 同等级并列时取槽位号较小者（槽 1）');
    eq(preview.detail.U < 10, true, 'C1d U < 两座之和（若求和会破 N ≤ A）');
}

{
    // C2：Lv1(3) + Lv3(5) ⇒ 吃 5。
    const host = makeHost({ round: 1, shots: 5, ledger: { pyro: 300, cryo: 0 }, facilities: [gen(3), ws(1), ws(3)] });
    const preview = host.sys_getWavePreview();
    eq(preview.detail.U, 5, 'C2a 混级 ⇒ U = 5（最高级那座）');
    eq(preview.shots, 5, 'C2b N = min(5, 5, ∞, 100) = 5');
}

// ============================================================ D
section('D. 干回合：不扣料、N 沿用、grantFloorOnly 保底 +3 照给、spent 全程 0');

setPowerPerShot(undefined);
setWorkshopTable(undefined);

{
    const prevRecord = { round: 2, recipeId: 'ammo_pyro_single', N: 2, bound: 'A', ties: ['A'], spent: { pyro: 6, cryo: 0 } };
    // 干回合：round 3 本回合没挖（_digDoneRound 还是 2）。
    const host = makeHost({
        round: 3, shots: 5, digDoneRound: 2, ledger: { pyro: 5, cryo: 0 }, frozen: prevRecord,
    });
    eq(host.phase_isDryRound(), true, 'D1 本回合未挖 ⇒ phase_isDryRound() = true');

    const previewDry = host.sys_getWavePreview();
    eq(previewDry.dry, true, 'D2a 预演 dry = true');
    eq(previewDry.shots, 2, 'D2b 预演 shots 沿用上一波冻结 N = 2（不重算成 5）');
    eq(previewDry.bound, 'A', 'D2c 预演 bound 沿用上一波冻结值');

    // game_system.js 干回合分支的动作（这里直接调同一个包裹层）。
    const granted1 = host.mat_grantFloorOnly();
    eq(granted1, 3, 'D3a 干回合保底 +3（grantFloorOnly，落 pyro）');
    eq(host.materialLedger.pyro, 8, 'D3b 余额 5 + 3 = 8');
    eq(host.mat_grantFloorOnly(), 0, 'D3c 同一 round 重入不重复发保底');
    eq(host.materialLedger.pyro, 8, 'D3d 余额仍是 8');

    const frozen = host.phase_freezeWaveRecord(5);
    eq(frozen.dry, true, 'D4a 冻结记录 dry = true');
    eq(frozen.N, 2, 'D4b N 沿用上一波冻结记录 = 2');
    eq(frozen.charged, false, 'D4c 干回合不扣料（charged = false）');
    eq(frozen.granted, 0, 'D4d 保底已由干回合分支发过 ⇒ 本处不再发（granted = 0）');
    eq(host.materialLedger.pyro, 8, 'D4e 余额未被冻结流程再动（8）');
    deepEq(frozen.spent, { pyro: 0, cryo: 0 }, 'D4f 干回合 spent 恒 0');
    deepEq(host.materialLedger.spent, { pyro: 0, cryo: 0 }, 'D4g 账本 spent 全程 0（干回合不写扣减）');
    eq(host.materialLedger.spentTotal, 0, 'D4h spentTotal = 0');

    const again = host.phase_freezeWaveRecord(5);
    eq(again.reused, true, 'D5a 波内重入 ⇒ 复用冻结记录');
    eq(again.N, 2, 'D5b 复用值不变');
    eq(host.materialLedger.pyro, 8, 'D5c 复用不扣料、不再发保底');
}

// ============================================================ E
section('E. 零发兜底：N = 0 ⇒ 不入料账');

{
    // 料为 0 ⇒ M = 0 ⇒ N = 0（非干回合）。
    const host = makeHost({ round: 4, shots: 2, ledger: { pyro: 0, cryo: 0 } });
    eq(host.sys_getWavePreview().shots, 0, 'E1a N = 0（M = 0）');
    const frozen = host.phase_freezeWaveRecord(2);
    eq(frozen.N, 0, 'E1b 冻结记录 N = 0');
    eq(frozen.charged, false, 'E1c 零发不调扣料');
    deepEq(frozen.spent, { pyro: 0, cryo: 0 }, 'E1d 零发 spent = {0,0}');
    deepEq(host.materialLedger.spent, { pyro: 0, cryo: 0 }, 'E1e 账本 spent 未写');
    eq(host.materialLedger.spentTotal, 0, 'E1f 账本 spentTotal 未写');
    eq(host.materialLedger.pyro, 0, 'E1g 余额不动');
    eq(host.materialLedger.cryo, 0, 'E1h 余额不动（cryo）');
    eq(host._materialZeroShotCount, 1, 'E1i 零发登记为异常路径并计数一次');
    host.phase_freezeWaveRecord(2);
    eq(host._materialZeroShotCount, 1, 'E1j 波内重入不重复计数（复用分支不计）');
}

// ============================================================ F
section('F. 冻结记录：六键齐全 / 波内不重算 / round 缺失 ⇒ null / spent 传数字 ⇒ 按 0');

setPowerPerShot(undefined);
setWorkshopTable(undefined);

{
    const host = makeHost({ round: 7, shots: 3, ledger: { pyro: 30, cryo: 0 } });
    const frozen = host.phase_freezeWaveRecord(3);
    eq(frozen.N, 3, 'F1a 冻结 N = 3');
    const rec = host._materialFrozenRecord;
    deepEq(Object.keys(rec).sort(), ['N', 'bound', 'recipeId', 'round', 'spent', 'ties'],
        'F1b 冻结记录形状六键齐全（round / recipeId / N / bound / ties / spent）');
    eq(rec.round, 7, 'F1c round = 冻结时的回合号');
    eq(rec.recipeId, 'ammo_pyro_single', 'F1d recipeId = 默认最低档');
    eq(rec.bound, 'A', 'F1e bound = A');
    deepEq(rec.spent, { pyro: 9, cryo: 0 }, 'F1f spent = 3 发 × pyro 3 = 9');
    deepEq(host.materialLedger.spent, { pyro: 9, cryo: 0 }, 'F1g 账本 spent 已补写（chargeShotMaterials 自身不写，包裹层补）');
    eq(host.materialLedger.spentTotal, 9, 'F1h spentTotal = 9（由 spent 推导）');
    eq(host.materialLedger.pyro, 21, 'F1i 余额 30 − 9 = 21');
    eq(host.materialLedger.loadedShots, 3, 'F1j 账本 loadedShots = 3');

    // 波内多次读预演 / 再冻结：已冻结值一律不变。
    const before = JSON.stringify(host._materialFrozenRecord);
    host.sys_getWavePreview();
    host.sys_getWavePreview();
    const again = host.phase_freezeWaveRecord(5);   // 故意传更大的 A
    eq(JSON.stringify(host._materialFrozenRecord), before, 'F2a 波内多次读预演 + 再次冻结 ⇒ 冻结记录一字不变');
    eq(again.N, 3, 'F2b 再次冻结返回的仍是 3（不按新参数重算）');
    eq(host.materialLedger.pyro, 21, 'F2c 不二次扣料（余额仍 21）');

    // round 缺失 ⇒ 整条 null。
    const host2 = makeHost({ round: 7 });
    host2.mat_applyPersistState({ _materialFrozenRecord: { recipeId: 'ammo_pyro_single', N: 3 } });
    eq(host2._materialFrozenRecord, null, 'F3a round 缺失 ⇒ 整条按 null（不猜）');

    // spent 传纯数字 ⇒ 按 0（不猜）。
    host2.mat_applyPersistState({ _materialFrozenRecord: { round: 2, N: 3, spent: 7 } });
    deepEq(host2._materialFrozenRecord.spent, { pyro: 0, cryo: 0 }, 'F3b spent 传纯数字 ⇒ 按 0 处理');

    // 字段类型规整。
    host2.mat_applyPersistState({ _materialFrozenRecord: { round: 2.9, N: 'x', bound: 5, ties: [1, 'A', 'Z'] } });
    eq(host2._materialFrozenRecord.round, 2, 'F3c round 取整');
    eq(host2._materialFrozenRecord.N, 0, 'F3d N 非数 ⇒ 0');
    eq(host2._materialFrozenRecord.bound, null, 'F3e bound 非字符串 ⇒ null');
    deepEq(host2._materialFrozenRecord.ties, ['A', 'Z'], 'F3f ties 只留字符串项');
}

// ============================================================ G
section('G. 存档往返：冻结记录 + 两个 round 去重标记逐字段相等；旧档缺字段 ⇒ null 不抛错');

{
    const host = makeHost({ round: 5, shots: 2, ledger: { pyro: 12, cryo: 4 } });
    host.phase_freezeWaveRecord(2);
    host._materialSettleRound = 5;
    host._materialFloorRound = 4;

    const exported = host.mat_exportPersistState();
    deepEq(Object.keys(exported).sort(),
        ['_materialFloorRound', '_materialFrozenRecord', '_materialLoadRound', '_materialSettleRound', '_selectedRecipeId', 'materialLedger'],
        'G1a 存档白名单六项齐（含本轮新增的两个 round 去重标记）');
    eq(exported._materialSettleRound, 5, 'G1b _materialSettleRound 入档');
    eq(exported._materialFloorRound, 4, 'G1c _materialFloorRound 入档');

    // JSON 往返（模拟 localStorage）
    const wire = JSON.parse(JSON.stringify(exported));
    const host2 = makeHost({ round: 5 });
    host2.mat_applyPersistState(wire);
    deepEq(host2._materialFrozenRecord, host._materialFrozenRecord, 'G2a 冻结记录存后读回逐字段相等');
    eq(host2._materialSettleRound, 5, 'G2b _materialSettleRound 存后读回相等');
    eq(host2._materialFloorRound, 4, 'G2c _materialFloorRound 存后读回相等');
    eq(host2.materialLedger.pyro, host.materialLedger.pyro, 'G2d 余额读回相等（pyro）');
    eq(host2.materialLedger.spentTotal, host.materialLedger.spentTotal, 'G2e 本波扣减读回相等');
    eq(host2._materialLoadRound, 5, 'G2f _materialLoadRound 读回相等');

    // 旧档（只有三余额）⇒ 新字段一律 null，不抛错。
    let threw = false;
    try {
        host2.mat_applyPersistState({ materialLedger: { pyro: 4, cryo: 4, beast: 0 } });
    } catch (e) {
        threw = true;
    }
    eq(threw, false, 'G3a 旧档缺新字段不抛错');
    eq(host2._materialFrozenRecord, null, 'G3b 旧档 ⇒ 冻结记录 null');
    eq(host2._materialSettleRound, null, 'G3c 旧档 ⇒ _materialSettleRound null');
    eq(host2._materialFloorRound, null, 'G3d 旧档 ⇒ _materialFloorRound null');
    eq(host2._selectedRecipeId, null, 'G3e 旧档 ⇒ 配方 id null');
    eq(host2.materialLedger.pyro, 4, 'G3f 旧档三余额照常读回');

    // 空对象 / undefined 也不抛错。
    let threw2 = false;
    try {
        host2.mat_applyPersistState(undefined);
        host2.mat_applyPersistState(null);
        host2.mat_applyPersistState({});
    } catch (e) {
        threw2 = true;
    }
    eq(threw2, false, 'G3g mat_applyPersistState(undefined/null/{}) 不抛错');
}

// ============================================================ H
section('H. 静态接线：game_phase.js 确实调用既有纯函数，且没有另写四轴算式');

{
    const phaseSrc = readSrc('src/game_phase.js');
    const materialSrc = readSrc('src/material_system.js');
    const sysSrc = readSrc('src/game_system.js');

    const calledInPhase = ['computeMaterialShots', 'pickBindingLimit', 'computePowerShots',
        'computeAvailablePower', 'powerDrawFor', 'pickWorkshop', 'isWorkshopPowered',
        'resolveWorkshopCapacity', 'listRecipes', 'getRecipeById', 'pickDefaultRecipe'];
    for (const fn of calledInPhase) {
        // 允许动态拼接的写法：按函数名断言「名字出现在 game_phase.js 且以调用形态出现」。
        const callRe = new RegExp(`${fn}\\s*\\(`);
        check(callRe.test(phaseSrc), `H1 ${fn} 在 game_phase.js 里以调用形态出现`);
    }
    check(calledInPhase.length >= 4, 'H1z game_phase.js 接线的既有纯函数 ≥ 4 条');

    // 不许另写算式：四轴直写 Math.min(...) 一律不许出现。
    check(!/Math\.min\(\s*A\s*,\s*U\s*,\s*E\s*,\s*M\s*\)/.test(phaseSrc),
        'H2a game_phase.js 不含 `Math.min(A, U, E, M)` 式四轴直写');
    check(!/Math\.min\(\s*rate\s*,/.test(phaseSrc),
        'H2b game_phase.js 不含 `Math.min(rate, ...)` 式发数直写');
    check(!/Math\.min\(\s*limitValues/.test(phaseSrc),
        'H2c game_phase.js 不自己合并 limitValues（合成归 pickBindingLimit）');

    // 扣料与保底的包裹层在 material_system.js（补写 spent / 按 round 去重都在这里）。
    check(/chargeShotMaterials\s*\(/.test(materialSrc), 'H3a material_system.js 调 chargeShotMaterials');
    check(/grantFloorOnly\s*\(/.test(materialSrc), 'H3b material_system.js 调 grantFloorOnly');
    check(/spent:\s*res\.spent/.test(materialSrc), 'H3c 补写 spent 落在 material_system.js 的包裹层');
    check(/_materialFloorRound/.test(materialSrc), 'H3d 保底去重用独立的 _materialFloorRound（不借 _materialSettleRound）');

    // 干回合保底的挂点在 game_system.js 的「不挖 → 直接战斗」那条路。
    check(/mat_grantFloorOnly\s*\(/.test(sysSrc), 'H4a game_system.js 干回合分支调 mat_grantFloorOnly');
    check(/_materialSettleRound:\s*Number\.isFinite/.test(sysSrc), 'H4b 存档白名单写入 _materialSettleRound');
    check(/_materialFloorRound:\s*Number\.isFinite/.test(sysSrc), 'H4c 存档白名单写入 _materialFloorRound');

    // 战斗相位必须走冻结记录，不许再直连装填口径。
    check(/phase_freezeWaveRecord\s*\(/.test(phaseSrc), 'H5a phase_startCombatPhase 走 phase_freezeWaveRecord');
    // H5b 只看可执行行：回滚说明是纯注释（行首 //），保留它是刻意的（订正件附录 C-3 步 6 要求可回滚），
    // 所以先剔掉整行注释再判，否则断言会把「回滚注释里留形」本身判成违规。
    const phaseCodeOnly = phaseSrc.split('\n')
        .filter((ln) => !/^\s*\/\//.test(ln))
        .join('\n');
    check(/this\.ammoQueue\s*=\s*this\.sys_buildCannonShots\(loadedShots\)/.test(phaseCodeOnly),
        'H5b 可执行行改成先用 loadedShots 变量（断点只剩一个）');
    check(!/this\.ammoQueue\s*=\s*this\.sys_buildCannonShots\(loadout\.loadedShots\)/.test(phaseCodeOnly),
        'H5c 可执行行已不再直连 mat_payLoadout 结果造弹（该形态只留回滚注释）');
}

// ============================================================ 还原夹具
setPowerPerShot(undefined);
setWorkshopTable(undefined);
setBatteryBase(15);   // 还原到真配置的底容量（[Owner] D7），不把隔离值留在进程里

console.log('\n===================================================');
console.log(`  passed ${passed} / failed ${failed}  (total ${passed + failed})`);
console.log('===================================================');
if (failed > 0) {
    console.log('  FAILURES:');
    for (const f of failures) console.log(`   - ${f}`);
}
process.exitCode = failed === 0 ? 0 : 1;
