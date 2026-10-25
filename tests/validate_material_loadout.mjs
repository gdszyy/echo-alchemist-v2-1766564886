/**
 * validate_material_loadout.mjs - [REQ-20261022-wave-loop · 经济接线 v2 第 1 步] 纯函数层断言。
 *
 * 依据：`docs/design/economy_wiring_spec_v2_corrections.md`
 *   C1（`N = min(A,U,E,M)`、`U ∈ 1..5` 且初始 < 5、`卡射速` 与 `卡产能` 的区别）
 *   C2（逐料最小值、`卡材料` 必须落料键）· C9（零发兜底是异常路径）
 *   C10（最低档 `pyro ≤ 3`、其它料 `cost = 0`）· C13 + 附录 C-1 路 A（干回合只加保底）
 *
 * 覆盖：四条上限各自单独压制 / 四条相等并列且顺序稳定 / 双料配方一料为 0 ⇒ N = 0 且最低档校验拒收 /
 *       单料退化（与盘上 `planLoadout` 同值的回归基线）/ `A < 配方配置发数` 不造多余的、不扣料 /
 *       干回合（不扣料、沿用 N、保底照给、不重复入料）/ `beast` 报错 / 第三种料键报错 / 初始 `U = 5` 判红。
 *
 * Usage:
 *   node tests/validate_material_loadout.mjs
 */

import {
    BASIC_FLOOR_PER_WAVE,
    FLOOR_BUCKET,
    planLoadout,
    settleWaveMaterials,
} from '../src/utils/material_economy_utils.js';
import {
    LIMIT_KEYS,
    chargeShotMaterials,
    computeMaterialShots,
    computePowerShots,
    describeBinding,
    grantFloorOnly,
    pickBindingLimit,
    resolveDryRound,
    resolveShotsPerTurn,
    validateFloorTierCost,
    validateShotCost,
    validateWorkshopCapacity,
} from '../src/utils/material_loadout_utils.js';

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

function section(title) {
    console.log(`\n--- ${title} ---`);
}

console.log('===================================================');
console.log('  Material loadout (economy wiring v2 · step 1)');
console.log('===================================================');

// ============================================================
section('1. 四条上限各自单独压制（每例只应有一条等于 N）');
// ============================================================
{
    const r = resolveShotsPerTurn({
        rateShots: 2, workshopCapacity: 5, power: 10,
        stock: { pyro: 30 }, costByMaterial: { pyro: 1 },
    });
    check(r.N === 2, `1a A 压制：N = ${r.N}（期望 2）`);
    check(r.ties.join(',') === 'A', `1a A 压制：ties = [${r.ties}]（期望 [A]）`);
    check(r.bound === 'A', `1a A 压制：bound = ${r.bound}`);
    check(r.label === '卡射速', `1a A 压制：label = ${r.label}（期望 卡射速）`);
    check(r.U > r.N && r.E > r.N && r.M > r.N, `1a A 压制：另三条都严格大于 N（U=${r.U} E=${r.E} M=${r.M}）`);
    check([r.A, r.U, r.E, r.M].every(v => Number.isFinite(v)), `1a A 压制：四值并列可见 A/U/E/M = ${r.A}/${r.U}/${r.E}/${r.M}`);
}
{
    const r = resolveShotsPerTurn({
        rateShots: 5, workshopCapacity: 3, power: 10,
        stock: { pyro: 30 }, costByMaterial: { pyro: 1 },
    });
    check(r.N === 3, `1b U 压制：N = ${r.N}（期望 3）`);
    check(r.ties.join(',') === 'U', `1b U 压制：ties = [${r.ties}]（期望 [U]）`);
    check(r.label === '卡产能', `1b U 压制：label = ${r.label}（期望 卡产能）`);
    check(r.A > r.N && r.E > r.N && r.M > r.N, `1b U 压制：另三条都严格大于 N`);
}
{
    const r = resolveShotsPerTurn({
        rateShots: 5, workshopCapacity: 5, power: 1,
        stock: { pyro: 30 }, costByMaterial: { pyro: 1 },
    });
    check(r.N === 1, `1c E 压制：N = ${r.N}（期望 1）`);
    check(r.ties.join(',') === 'E', `1c E 压制：ties = [${r.ties}]（期望 [E]）`);
    check(r.label === '卡电', `1c E 压制：label = ${r.label}（期望 卡电）`);
    check(r.A > r.N && r.U > r.N && r.M > r.N, `1c E 压制：另三条都严格大于 N`);
}
{
    const r = resolveShotsPerTurn({
        rateShots: 5, workshopCapacity: 5, power: 10,
        stock: { pyro: 6 }, costByMaterial: { pyro: 2 },
    });
    check(r.N === 3, `1d M 压制：N = ${r.N}（期望 3 = floor(6/2)）`);
    check(r.ties.join(',') === 'M', `1d M 压制：ties = [${r.ties}]（期望 [M]）`);
    check(r.bindingMaterialKeys.join(',') === 'pyro', `1d M 压制：bindingMaterialKeys = [${r.bindingMaterialKeys}]`);
    check(r.label === '卡材料·pyro', `1d M 压制：label = ${r.label}（期望 卡材料·pyro，不许裸「卡材料」）`);
    check(r.A > r.N && r.U > r.N && r.E > r.N, `1d M 压制：另三条都严格大于 N`);
}

// ============================================================
section('2. 四条相等（并列）与输出顺序稳定性');
// ============================================================
{
    const input = {
        rateShots: 3, workshopCapacity: 3, power: 3,
        stock: { pyro: 3 }, costByMaterial: { pyro: 1 },
    };
    const r1 = resolveShotsPerTurn(input);
    const r2 = resolveShotsPerTurn(input);
    const r3 = resolveShotsPerTurn(input);
    check(r1.N === 3 && r2.N === 3 && r3.N === 3, `2a 四条相等：N = ${r1.N}/${r2.N}/${r3.N}（期望 3）`);
    check(r1.ties.join(',') === 'A,U,E,M', `2a 四条相等：ties 固定顺序 = [${r1.ties}]（期望 [A,U,E,M]）`);
    check(r1.label === '四条并列', `2a 四条相等：label = ${r1.label}（期望 四条并列）`);
    check(r1.bound === 'A', `2a 四条相等：bound = ${r1.bound}（= ties[0]，只作展示口径）`);
    check(JSON.stringify(r1) === JSON.stringify(r2) && JSON.stringify(r2) === JSON.stringify(r3), '2b 顺序稳定：连调三次输出逐字节相同');
    check(LIMIT_KEYS.join(',') === 'A,U,E,M', `2b LIMIT_KEYS = [${LIMIT_KEYS}]（A 排第一条，订正 C1）`);
    const direct = pickBindingLimit({ rate: 3, capacity: 3, power: 3, materials: 3 });
    check(direct.ties.join(',') === r1.ties.join(',') && direct.N === r1.N, '2c pickBindingLimit 直调与合成入口同口径');
    const twoWay = resolveShotsPerTurn({
        rateShots: 2, workshopCapacity: 2, power: 9,
        stock: { pyro: 9 }, costByMaterial: { pyro: 1 },
    });
    check(twoWay.ties.join(',') === 'A,U', `2d 两条并列：ties = [${twoWay.ties}]（期望 [A,U]，全部保留）`);
    check(twoWay.label === '并列（卡射速·卡产能）', `2d 两条并列：label = ${twoWay.label}`);
}

// ============================================================
section('3. 双料配方 + 其中一料库存 0 ⇒ M = 0，且最低档校验拒收（C2 / C10 反例）');
// ============================================================
{
    const stock = { pyro: 30, cryo: 0 };
    const costByMaterial = { pyro: 1, cryo: 2 };
    const mat = computeMaterialShots(stock, costByMaterial);
    check(mat.M === 0, `3a 双料：M = ${mat.M}（期望 0，不是按总额 30 判成付得起）`);
    check(mat.bindingMaterialKeys.join(',') === 'cryo', `3a 双料：bindingMaterialKeys = [${mat.bindingMaterialKeys}]（期望 [cryo]）`);
    check(mat.perMaterial.length === 2 && mat.perMaterial[1].shots === 0, `3a 双料：perMaterial 两行，cryo 行 shots = ${mat.perMaterial[1].shots}`);
    const r = resolveShotsPerTurn({ rateShots: 5, workshopCapacity: 5, power: 10, stock, costByMaterial });
    check(r.N === 0, `3b 双料：N = ${r.N}（期望 0）`);
    check(r.label === '卡材料·cryo', `3b 双料：label = ${r.label}（期望 卡材料·cryo，指到具体料）`);
    check(r.bound === 'M', `3b 双料：bound = ${r.bound}`);
    check(validateShotCost(costByMaterial).ok === true, '3c 该配方结构合法（逐料 0 库存不是结构错，是玩法结果）');
    const tier = validateFloorTierCost(costByMaterial);
    check(tier.ok === false, '3d 最低档校验：{ pyro:1, cryo:2 } 必须判红（C10 硬约束）');
    check(tier.errors.some(e => e.includes('cryo')), `3d 最低档校验：错误里点名 cryo —— ${tier.errors.join(' / ')}`);
    const floored = grantFloorOnly({ pyro: 0, cryo: 0 }, { basicFloorPerWave: BASIC_FLOOR_PER_WAVE });
    check(floored.ledger.pyro === 3, `3e 保底照给：pyro = ${floored.ledger.pyro}（期望 3）`);
    check(computeMaterialShots(floored.ledger, costByMaterial).M === 0, '3e 破保底反例成立：保底 3 料全落 pyro 后 M 仍为 0（⇒ 破「每波至少 1 发」）');
    const goodTier = validateFloorTierCost({ pyro: 3 });
    check(goodTier.ok === true && goodTier.floorCost === 3, `3f 最低档 { pyro:3 } 合法（cap=${goodTier.cap}）`);
    check(validateFloorTierCost({ pyro: 4 }).ok === false, '3f 最低档 { pyro:4 } 判红（cost > 保底 3）');
    check(validateFloorTierCost({ cryo: 3 }).ok === false, '3f 最低档落在非 FLOOR_BUCKET 判红');
    check(validateFloorTierCost({ pyro: 1, cryo: 0 }).ok === true, '3f cryo 显式 0 是允许的（等价于未点名）');
}

// ============================================================
section('4. 单料退化（与盘上 planLoadout 单料口径同值，作回归基线）');
// ============================================================
{
    const mat = computeMaterialShots({ pyro: 10, cryo: 0 }, { pyro: 3 });
    check(mat.M === Math.floor(10 / 3), `4a 单料退化：M = ${mat.M} = floor(10/3)`);
    check(mat.M === 3, `4a 单料退化：M = ${mat.M}（期望 3）`);
    check(mat.bindingMaterialKeys.join(',') === 'pyro', `4a 单料退化：bindingMaterialKeys = [${mat.bindingMaterialKeys}]`);
    const baseline = planLoadout({ pyro: 10, cryo: 0 }, 5, 3);
    check(baseline.loadedShots === mat.M, `4b 回归基线：planLoadout.loadedShots = ${baseline.loadedShots} 与 M 相同（单料口径等价）`);
    const unlisted = computeMaterialShots({ pyro: 0, cryo: 100 }, { pyro: 3 });
    check(unlisted.M === 0, `4c 未点名的料不参与：M = ${unlisted.M}（期望 0，cryo 100 不算进来）`);
    check(unlisted.perMaterial.length === 1, '4c 未点名的料不进 perMaterial');
    const zeroCost = computeMaterialShots({ pyro: 100 }, { pyro: 0, cryo: 3 });
    check(zeroCost.M === 0, `4d cost = 0 不参与比较（不除零）：M = ${zeroCost.M}（只看 cryo 的 0）`);
}

// ============================================================
section('5. A < 配方配置发数：多出来的不造出来、也不扣料（C1 ⑤）');
// ============================================================
{
    const configuredShots = 8; // 玩家/配方配了 8 发
    const plan = resolveShotsPerTurn({
        rateShots: 2, workshopCapacity: 5, power: 10,
        stock: { pyro: 30 }, costByMaterial: { pyro: 1 },
    });
    check(plan.N === 2 && plan.N < configuredShots, `5a 配了 ${configuredShots} 发、A = ${plan.A} ⇒ N = ${plan.N}`);
    const charged = chargeShotMaterials({ pyro: 30 }, { shots: plan.N, costByMaterial: { pyro: 1 } });
    check(charged.chargedShots === 2, `5b 只造出 ${charged.chargedShots} 发（不是 ${configuredShots}）`);
    check(charged.spent.pyro === 2 && charged.spentTotal === 2, `5b 只扣 ${charged.spent.pyro} 料（不是 ${configuredShots}）`);
    check(charged.ledger.pyro === 28, `5b 余额 = ${charged.ledger.pyro}（期望 28 = 30 − 2）`);
    check(charged.ledger.pyro !== 30 - configuredShots, `5c 余额 ≠ 30 − ${configuredShots}（多出来的发数没扣料）`);
    check(charged.requestedShots === 2, `5c requestedShots 记录的是实际请求发数 ${charged.requestedShots}`);
}
{
    const charged = chargeShotMaterials({ pyro: 5 }, { shots: 5, costByMaterial: { pyro: 2 } });
    check(charged.chargedShots === 2, `5d 料不足时按 M 截断：chargedShots = ${charged.chargedShots}（期望 2）`);
    check(charged.shortfall === 3, `5d shortfall = ${charged.shortfall}（期望 3）`);
    check(charged.ledger.pyro === 1, `5d 余额 = ${charged.ledger.pyro}（期望 1）`);
    const dual = chargeShotMaterials({ pyro: 10, cryo: 10 }, { shots: 3, costByMaterial: { pyro: 2, cryo: 3 } });
    check(dual.spent.pyro === 6 && dual.spent.cryo === 9, `5e 逐料扣减：spent = pyro ${dual.spent.pyro} / cryo ${dual.spent.cryo}（期望 6 / 9）`);
    check(dual.ledger.pyro === 4 && dual.ledger.cryo === 1, `5e 逐料余额 = pyro ${dual.ledger.pyro} / cryo ${dual.ledger.cryo}（期望 4 / 1）`);
    check(dual.ledger.beast === 0, '5e beast 不参与扣料');
}

// ============================================================
section('6. 干回合：不扣料、沿用 N、保底照给（C13 + 附录 C-1 路 A）');
// ============================================================
{
    const ledger = { pyro: 10, cryo: 4, beast: 2, coloredHits: 7, primaryHits: 9, producedThisWave: 0 };
    const dry = resolveDryRound({
        previous: { N: 2, bound: 'A', ties: ['A'] },
        ledger,
        basicFloorPerWave: BASIC_FLOOR_PER_WAVE,
    });
    check(dry.N === 2, `6a 沿用上一回合 N = ${dry.N}（期望 2，不是 0）`);
    check(dry.dry === true && dry.charged === false, '6a 标记为干回合、未扣料');
    check(dry.spent.pyro === 0 && dry.spent.cryo === 0 && dry.spentTotal === 0, '6a 不扣料：spent 全 0');
    check(dry.ledger.pyro === 13, `6a 保底照给：pyro = ${dry.ledger.pyro}（期望 10 + 3）`);
    check(dry.granted === 3 && dry.floorBucket === FLOOR_BUCKET, `6a 保底 ${dry.granted} 落 ${dry.floorBucket}`);
    check(dry.ledger.cryo === 4 && dry.ledger.beast === 2, '6a 其它料不动');
    check(dry.ledger.coloredHits === 7 && dry.ledger.primaryHits === 9, '6a 不读不改命中计数（coloredHits 7 / primaryHits 9 原样）');
    check(dry.bound === 'A' && dry.ties.join(',') === 'A', '6a bound / ties 随冻结记录沿用');
    check(dry.zeroShotRisk === false, '6a N > 0 ⇒ 不触发白补 1 发风险');
    const again = resolveDryRound({ previous: { N: 2 }, ledger: dry.ledger, basicFloorPerWave: 3 });
    check(again.ledger.pyro === 16, `6b 纯函数层不去重（去重属运行时 _materialFloorRound）：再调一次 +3 ⇒ ${again.ledger.pyro}`);
    const grant = grantFloorOnly(ledger, { basicFloorPerWave: 3 });
    const settled = settleWaveMaterials({ pyro: 10, cryo: 4, beast: 2, coloredHits: 0, primaryHits: 0 }, { basicFloorPerWave: 3, perHitsPerMaterial: 2 });
    check(grant.ledger.pyro === settled.ledger.pyro, `6c 路 A 与路 B 同值：grantFloorOnly.pyro = ${grant.ledger.pyro} / reset+settle.pyro = ${settled.ledger.pyro}`);
    check(grant.ledger.producedThisWave === settled.ledger.producedThisWave, `6c producedThisWave 同值 = ${grant.ledger.producedThisWave}`);
    const risky = resolveDryRound({ previous: { N: 0 }, ledger, basicFloorPerWave: 3 });
    check(risky.N === 0 && risky.zeroShotRisk === true, '6d N = 0 的干回合被标 zeroShotRisk（登记为异常路径，C9）');
    checkThrows(() => resolveDryRound({ ledger }), /冻结/, '6e 缺冻结记录 ⇒ 抛错（不许静默给 0，C8）');
    checkThrows(() => resolveDryRound({ previous: { N: -1 }, ledger }), /冻结/, '6e N = −1 ⇒ 抛错');
}

// ============================================================
section('7. 配方里出现 beast ⇒ 报错（只用于建设，不得用于造弹）');
// ============================================================
{
    const bad = { pyro: 1, beast: 2 };
    const v = validateShotCost(bad);
    check(v.ok === false, '7a validateShotCost({pyro:1, beast:2}) 判红');
    check(v.errors.some(e => e.includes('beast')), `7a 错误点名 beast —— ${v.errors.join(' / ')}`);
    checkThrows(() => computeMaterialShots({ pyro: 9, beast: 9 }, bad), /beast/, '7b computeMaterialShots 抛错');
    checkThrows(() => chargeShotMaterials({ pyro: 9, beast: 9 }, { shots: 1, costByMaterial: bad }), /beast/, '7c chargeShotMaterials 抛错');
    checkThrows(() => resolveShotsPerTurn({
        rateShots: 2, workshopCapacity: 2, power: 5, stock: { pyro: 9, beast: 9 }, costByMaterial: bad,
    }), /beast/, '7d resolveShotsPerTurn 抛错');
    check(validateFloorTierCost(bad).ok === false, '7e 最低档校验同样拒收 beast 配方');
}

// ============================================================
section('8. 出现第三种料键 ⇒ 报错（两档 + 一行预留，不放开）');
// ============================================================
{
    const v = validateShotCost({ pyro: 1, lightning: 1 });
    check(v.ok === false, '8a {pyro, lightning} 判红（lightning 不是可造弹料）');
    check(v.errors.some(e => e.includes('lightning')), `8a 错误点名该键 —— ${v.errors.join(' / ')}`);
    check(validateShotCost({ pyro: 1, cryo: 1, gold: 1 }).ok === false, '8b {pyro, cryo, gold} 判红（未知第三键）');
    checkThrows(() => computeMaterialShots({ pyro: 9, cryo: 9, gold: 9 }, { pyro: 1, cryo: 1, gold: 1 }), /gold/, '8c computeMaterialShots 抛错');
    check(validateShotCost({ pyro: 1, cryo: 1 }).ok === true, '8d 两料配方合法（本轮上限就是两档）');
    check(validateShotCost({}).ok === false, '8e 空配方判红（必须显式声明每发需求量）');
    check(validateShotCost({ pyro: 0 }).ok === false, '8e 全 0 配方判红（算不出 M）');
    check(validateShotCost({ pyro: -1 }).ok === false, '8e 负成本判红');
    check(validateShotCost({ pyro: 1.5 }).ok === false, '8e 非整数成本判红');
    check(validateShotCost(null).ok === false, '8e 非对象判红');
}

// ============================================================
section('9. U 的取值域 1..5，且初始必须 < 5（C1 ③ 硬约束）');
// ============================================================
{
    const init5 = validateWorkshopCapacity(5);
    check(init5.ok === false, '9a 初始 U = 5 判红（默认按初始配置校验）');
    check(init5.errors.some(e => e.includes('初始')), `9a 错误说明是「初始」越界 —— ${init5.errors.join(' / ')}`);
    check(validateWorkshopCapacity(4).ok === true, '9b 初始 U = 4 合法');
    check(validateWorkshopCapacity(1).ok === true, '9b 初始 U = 1 合法');
    check(validateWorkshopCapacity(5, { initial: false }).ok === true, '9c 非初始（已建成）U = 5 合法——取值域上限仍是 5');
    check(validateWorkshopCapacity(6, { initial: false }).ok === false, '9c U = 6 超出取值域');
    check(validateWorkshopCapacity(0).ok === false, '9d U = 0 不在取值域 1..5');
    check(validateWorkshopCapacity(2.5).ok === false, '9d U = 2.5 非整数判红');
    check(validateWorkshopCapacity('abc').ok === false, '9d U 非数值判红');
}

// ============================================================
section('10. 边界与健壮性');
// ============================================================
{
    checkThrows(() => pickBindingLimit({ rate: 2, capacity: 2, power: 2 }), /materials/, '10a 缺第四条上限 ⇒ 抛错（不许静默当 0）');
    checkThrows(() => pickBindingLimit({ rate: 2, capacity: 2, power: NaN, materials: 2 }), /power/, '10b NaN ⇒ 抛错');
    checkThrows(() => pickBindingLimit({
        rate: Infinity, capacity: Infinity, power: Infinity, materials: Infinity,
    }), /无穷/, '10c 四条全为 Infinity ⇒ 抛错');
    const clamped = pickBindingLimit({ rate: -3, capacity: 5, power: 5, materials: 5 });
    check(clamped.N === 0 && clamped.ties.join(',') === 'A', `10d N ≥ 0：负 A 被归 0 ⇒ N = ${clamped.N}，bound = ${clamped.bound}`);
    checkThrows(() => describeBinding({ N: 2, ties: ['M'], bindingMaterialKeys: [] }), /料键/, '10e 裸「卡材料」⇒ 抛错（必须落料键）');
    checkThrows(() => describeBinding({ N: 2, ties: [] }), /ties/, '10f ties 为空 ⇒ 抛错');
    const mat = pickBindingLimit({ rate: 9, capacity: 9, power: 9, materials: Infinity });
    check(mat.N === 9 && mat.ties.join(',') === 'A,U,E', `10g M = Infinity（无料需求）不参与压制 ⇒ N = ${mat.N}，ties = [${mat.ties}]`);
    check(computePowerShots(10, 4) === 2, `10h computePowerShots(10,4) = ${computePowerShots(10, 4)}（期望 2）`);
    check(computePowerShots(-5, 4) === 0, '10h 负可用电力归 0');
    checkThrows(() => computePowerShots(10, 0), /每发耗电/, '10i 每发耗电 = 0 ⇒ 抛错（不静默除零）');
    const viaPower = resolveShotsPerTurn({
        rateShots: 5, workshopCapacity: 5, availablePower: 9, powerPerShot: 4,
        stock: { pyro: 9 }, costByMaterial: { pyro: 1 },
    });
    check(viaPower.E === 2 && viaPower.N === 2, `10j 可用电力/每发耗电走 E = floor(9/4) = ${viaPower.E} ⇒ N = ${viaPower.N}`);
}
{
    const ledger = { pyro: 20, cryo: 5, beast: 3, coloredHits: 4, primaryHits: 8 };
    const snap = JSON.stringify(ledger);
    resolveShotsPerTurn({ rateShots: 4, workshopCapacity: 4, power: 4, stock: ledger, costByMaterial: { pyro: 2 } });
    chargeShotMaterials(ledger, { shots: 2, costByMaterial: { pyro: 2 } });
    grantFloorOnly(ledger, { basicFloorPerWave: 3 });
    resolveDryRound({ previous: { N: 2 }, ledger, basicFloorPerWave: 3 });
    check(JSON.stringify(ledger) === snap, '10k 纯函数不改入参（账本四次调用后逐字节不变）');
}

// ============================================================
console.log('\n===================================================');
console.log(`  passed ${passed} / failed ${failed}  (total ${passed + failed})`);
console.log('===================================================');
if (failed > 0) {
    console.log('  FAILURES:');
    for (const f of failures) console.log(`   - ${f}`);
}
process.exit(failed === 0 ? 0 : 1);
