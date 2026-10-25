/**
 * validate_shot_recipes.mjs - [REQ-20261022-wave-loop · 经济接线 v2 第 2 步] 弹药配方表断言。
 *
 * 依据：`docs/design/economy_wiring_spec_v2_corrections.md`
 *   附录 C-2（五字段 / `cost` 只收点名料键 / `elements` 显式 0 层 / 默认取最低成本那条 / 命名风险）
 *   C10（[约束]：最低档 `pyro ≤ 3` 且其它料 `cost = 0`，不是可调项）
 *   v2 §5.2（两档、成本与档位同向抬高；**倍率那一半已于 2026-10-25 随 `damageMult` 删除**）
 *
 * 覆盖：表可读 / 缺段与空数组抛错 / 五字段齐 / id 唯一 / 档位判定与越界 / 未知料键（lightning・gold）/
 *       全 0・负数・非整数・非对象 cost / C10 三条反例（两条判红、一条通过）/
 *       已删除字段复活即判红（REMOVED_FIELD，`damageMult` 出现即红）・
 *       跨档成本同向（COST_MULT_NOT_ALIGNED）・同档同成本、靠料配比「互有优劣」的正面用例
 *       （两种料况下两条配方的 M 胜负反转，证明无一条恒劣）/
 *       真实表定稿值锁定（1k–1p：cost 3 / 2+2 / 1+3、五字段无 `damageMult`、
 *       每单位料发数 1/3 ≈ 0.33333… > 1/4 = 0.25、档位差异落在料配比而非伤害）/
 *       默认配方（空解锁・全部未命中・最低成本・并列取字典序・Set 入参）/ 可读串 / 纯函数不改入参。
 *
 * Usage:
 *   node tests/validate_shot_recipes.mjs
 */

import { CONFIG } from '../src/config.js';
import { computeMaterialShots } from '../src/utils/material_loadout_utils.js';
import {
    ELEMENT_KEYS,
    RECIPE_FIELDS,
    TIER_DUAL,
    TIER_SINGLE,
    computeRecipeYield,
    describeRecipeCost,
    describeRecipeTier,
    getRecipeById,
    listRecipes,
    pickDefaultRecipe,
    pickRecipeByYield,
    resolveTier,
    sumRecipeCost,
    validateRecipeTable,
} from '../src/utils/shot_recipe_utils.js';

let passed = 0;
let failed = 0;
const failures = [];

function fmt(v) {
    if (typeof v === 'string') return v;
    try {
        return JSON.stringify(v);
    } catch (e) {
        return String(v);
    }
}

function check(condition, name, actual) {
    const tail = actual === undefined ? '' : `  | actual=${fmt(actual)}`;
    if (condition) {
        passed++;
        console.log(`PASS  ${name}${tail}`);
    } else {
        failed++;
        failures.push(name);
        console.log(`FAIL  ${name}${tail}`);
    }
}

function checkThrows(fn, pattern, name) {
    try {
        fn();
        check(false, `${name}（未抛错）`, '未抛错');
    } catch (e) {
        const msg = String((e && e.message) || e);
        check(pattern.test(msg), `${name}（实抛：${msg}）`);
    }
}

function section(title) {
    console.log(`\n--- ${title} ---`);
}

/** JSON 深拷贝（配置里可能有 `undefined`，两侧同法变换，比较口径一致） */
function clone(value) {
    return JSON.parse(JSON.stringify(value));
}

function deepEqual(a, b) {
    if (a === b) return true;
    if (a === null || b === null || typeof a !== 'object' || typeof b !== 'object') return false;
    if (Array.isArray(a) !== Array.isArray(b)) return false;
    const ka = Object.keys(a);
    const kb = Object.keys(b);
    if (ka.length !== kb.length) return false;
    for (const k of ka) {
        if (!Object.prototype.hasOwnProperty.call(b, k)) return false;
        if (!deepEqual(a[k], b[k])) return false;
    }
    return true;
}

/** 造一个只含 `recipes` 的最小 config */
function wrap(recipes) {
    return { gameplay: { build: { recipes } } };
}

/** 造一条合法基线配方，再按 overrides 覆盖单项（深拷贝，永不改导入的 CONFIG） */
function makeRecipe(overrides = {}) {
    const base = {
        id: 'probe_recipe',
        displayName: '探针弹',
        cost: { pyro: 3 },
        elements: { pyro: 1, cryo: 0, lightning: 0 },
        blueprintRequired: false,
    };
    return Object.assign(base, clone(overrides));
}

function codesOf(result) {
    return (result && Array.isArray(result.errors) ? result.errors : []).map((e) => e.code);
}

function hasError(result, code, messagePattern) {
    const errors = (result && Array.isArray(result.errors) ? result.errors : []);
    return errors.some((e) => e.code === code && (!messagePattern || messagePattern.test(String(e.message || ''))));
}

const configSnapshotBefore = clone(CONFIG);

console.log('===================================================');
console.log('  Shot recipes (economy wiring v2 · step 2)');
console.log('===================================================');

// ---------------------------------------------------------------- 1. 真实配置表
section('1 真实配置表：CONFIG.gameplay.build.recipes');

const realTable = listRecipes(CONFIG);
check(realTable.length >= 3, '1a listRecipes 读到至少 3 条弹药配方', realTable.length);

const realCheck = validateRecipeTable(CONFIG);
check(realCheck.ok === true, '1b 真实配置表整表校验通过（validateRecipeTable(CONFIG).ok）', realCheck.errors);

for (const entry of realTable) {
    const missing = RECIPE_FIELDS.filter((f) => !Object.prototype.hasOwnProperty.call(entry, f));
    check(missing.length === 0, `1c 配方 "${entry.id}" 五字段齐`, missing);
}

check(realTable.every((r) => Object.keys(r.cost).every((k) => ['pyro', 'cryo'].includes(k))),
    '1d 真实表 cost 键只有 pyro / cryo',
    realTable.map((r) => Object.keys(r.cost)));

check(realTable.every((r) => ELEMENT_KEYS.every((k) => Object.prototype.hasOwnProperty.call(r.elements, k))),
    '1e 真实表 elements 三键都显式写了（含 0 层）',
    realTable.map((r) => r.elements));

const realFloor = realTable.slice().sort((a, b) => sumRecipeCost(a.cost) - sumRecipeCost(b.cost))[0];
check(Object.keys(realFloor.cost).length === 1 && realFloor.cost.pyro <= 3,
    `1f 真实表最低档 "${realFloor.id}" 只点名 pyro 且 ≤ 3（C10）`,
    realFloor.cost);

const realDual = realTable.filter((r) => resolveTier(r.cost) === TIER_DUAL);
check(realDual.length >= 2, '1g 真实表双料至少 2 条（同档多条，靠元素与设计图区分）', realDual.length);

// 1h / 1i：**每单位料发数**（单发成本 Σcost 的倒数）。倍率删除后，档位之间只剩「用几种料」一个维度，
//   「谁更省料」必须照实说：单料 1 发 / 3 料 ≈ 0.3333 > 双料 1 发 / 4 料 = 0.25。
const realSingle = realTable.filter((r) => resolveTier(r.cost) === TIER_SINGLE);
const realDualShotsPerMaterial = Array.from(new Set(realDual.map((r) => 1 / sumRecipeCost(r.cost))));
check(realDualShotsPerMaterial.length === 1,
    '1h 真实表双料档每单位料发数全等（同档同成本总量 ⇒ 1/4 = 0.25）',
    realDual.map((r) => ({ id: r.id, cost: sumRecipeCost(r.cost), perMaterialShots: 1 / sumRecipeCost(r.cost) })));

const realSinglePerMaterialShots = Math.max(...realSingle.map((r) => 1 / sumRecipeCost(r.cost)));
const realDualPerMaterialShots = Math.min(...realDual.map((r) => 1 / sumRecipeCost(r.cost)));
check(realSingle.length > 0 && realSinglePerMaterialShots > realDualPerMaterialShots,
    '1i 真实表跨档单调：单料每单位料发数 > 双料（1/3 ≈ 0.33333… > 1/4 = 0.25）——料效率随档位下降，这是删除倍率后的**真实**方向',
    { single: realSinglePerMaterialShots, dual: realDualPerMaterialShots });

const realDualMinCost = Math.min(...realDual.map((r) => sumRecipeCost(r.cost)));
const realSingleMaxCost = Math.max(...realSingle.map((r) => sumRecipeCost(r.cost)));
check(realDualMinCost > realSingleMaxCost,
    '1j 真实表跨档成本同向：双料最低成本 > 单料最高成本（§5.2 :221）',
    { dualMin: realDualMinCost, singleMax: realSingleMaxCost });

// 1k–1p 定稿值锁定（2026-10-25 定稿）：`cost` 的来源是 `[设计稿]` 定稿；料效率结论是 `[推导]`；
//   整备时点分布读数（pyro p50 = 7 / cryo p50 = 84）是 `[实测]`，只用来支撑取值，不进断言。
//   真实表一旦被改回旧值（`1.6` 配比、或把 `damageMult` 加回来），下面 1k–1p 立刻判红——不靠注释约束。
const realSingleRecipe = getRecipeById(CONFIG, 'ammo_pyro_single');
const realDualRecipe = getRecipeById(CONFIG, 'ammo_pyro_cryo_dual');
const realHeavyRecipe = getRecipeById(CONFIG, 'ammo_pyro_cryo_heavy');

check(realSingleRecipe.cost.pyro === 3 && sumRecipeCost(realSingleRecipe.cost) === 3
    && !Object.prototype.hasOwnProperty.call(realSingleRecipe, 'damageMult'),
    '1k 真实表单料档定稿：cost = { pyro: 3 }（总量 3）、且**不含**已删除字段 damageMult',
    { cost: realSingleRecipe.cost, keys: Object.keys(realSingleRecipe) });

check(sumRecipeCost(realDualRecipe.cost) === 4 && sumRecipeCost(realHeavyRecipe.cost) === 4
    && realDualRecipe.cost.pyro === 2 && realDualRecipe.cost.cryo === 2
    && realHeavyRecipe.cost.pyro === 1 && realHeavyRecipe.cost.cryo === 3,
    '1l 真实表两条双料：cost 总量都是 4（2+2 / 1+3），只是配比不同',
    { dual: realDualRecipe.cost, heavy: realHeavyRecipe.cost });

check(sumRecipeCost(realDualRecipe.cost) === sumRecipeCost(realHeavyRecipe.cost)
    && !Object.prototype.hasOwnProperty.call(realDualRecipe, 'damageMult')
    && !Object.prototype.hasOwnProperty.call(realHeavyRecipe, 'damageMult'),
    '1m 真实表两条双料：同档同成本总量（= 4），且都不带 damageMult（同档差异只在配比与 elements）',
    { dual: Object.keys(realDualRecipe), heavy: Object.keys(realHeavyRecipe) });

// 反支配（倍率删除后的真实形态）：双料 4 料只打 1 发 ⇒ 每单位料发数 0.25 < 单料 1/3 ≈ 0.33333…
//   ⇒ 单料档在「每单位料发数」维度不被支配；双料的价值落在**别的维度**（能消化 cryo，见 1o）。
const dualPerMaterial = 1 / sumRecipeCost(realDualRecipe.cost);
const singlePerMaterial = 1 / sumRecipeCost(realSingleRecipe.cost);
check(dualPerMaterial === 0.25 && singlePerMaterial === 1 / 3 && dualPerMaterial < singlePerMaterial,
    '1n 反支配：双料每单位料发数 0.25 < 单料 1/3 ≈ 0.33333…（单料档不被支配）',
    { dualPerMaterial, singlePerMaterial });
check(sumRecipeCost(realSingleRecipe.cost) * 4 === sumRecipeCost(realDualRecipe.cost) * 3
    && sumRecipeCost(realDualRecipe.cost) > sumRecipeCost(realSingleRecipe.cost),
    '1n2 整数复核（不用除法、免浮点口径争议）：12 料下 单料 4 发 vs 双料 3 发（3×4 = 4×3 = 12）',
    {
        shotsSingleAt12: 12 / sumRecipeCost(realSingleRecipe.cost),
        shotsDualAt12: 12 / sumRecipeCost(realDualRecipe.cost),
    });

// 档位差异落在**料配比**：只有双料收 cryo，单料只收 pyro ⇒ 冰料要能花出去，只有双料这一条通道。
check(realDualRecipe.cost.cryo > 0 && realHeavyRecipe.cost.cryo > 0
    && !Object.prototype.hasOwnProperty.call(realSingleRecipe.cost, 'cryo'),
    '1o 档位差异在料配比：双料两条都收 cryo，单料只收 pyro（冰料的唯一消化通道是双料档）',
    { single: realSingleRecipe.cost, dual: realDualRecipe.cost, heavy: realHeavyRecipe.cost });

check(sumRecipeCost(realDualRecipe.cost) > sumRecipeCost(realSingleRecipe.cost),
    '1p 跨档成本同向抬高：单料总量 3 → 双料总量 4（§5.2 :221）',
    { single: sumRecipeCost(realSingleRecipe.cost), dual: sumRecipeCost(realDualRecipe.cost) });

// ---------------------------------------------------------------- 2. listRecipes 反例
section('2 listRecipes：缺段 / 非数组 / 空数组一律抛错');

checkThrows(() => listRecipes({ gameplay: { build: {} } }), /CONFIG\.gameplay\.build\.recipes 缺失/,
    '2a 缺 recipes 段 ⇒ 抛错（不许静默返回 []）');
checkThrows(() => listRecipes({ gameplay: { build: { recipes: 'nope' } } }), /必须是数组/,
    '2b recipes 不是数组 ⇒ 抛错');
checkThrows(() => listRecipes({ gameplay: {} }), /读不到/,
    '2c 路径中段不是对象 ⇒ 抛错');
checkThrows(() => listRecipes(wrap([])), /空数组/,
    '2d 空数组 ⇒ 抛错（不许静默返回 []）');
checkThrows(() => listRecipes(null), /读不到/, '2e config 为 null ⇒ 抛错');

// ---------------------------------------------------------------- 3. getRecipeById
section('3 getRecipeById');

check(getRecipeById(CONFIG, 'ammo_pyro_single').id === 'ammo_pyro_single',
    '3a 按 id 取到目标配方', getRecipeById(CONFIG, 'ammo_pyro_single').id);
checkThrows(() => getRecipeById(CONFIG, 'no_such_recipe'), /可选 id：.*ammo_pyro_single/,
    '3b 找不到时抛错且错误里带可选 id 列表');
checkThrows(() => getRecipeById(CONFIG, ''), /非空字符串/,
    '3c id 为空串 ⇒ 抛错');

// ---------------------------------------------------------------- 4. resolveTier
section('4 resolveTier：单料 / 双料 / 越界');

check(resolveTier({ pyro: 3 }) === TIER_SINGLE, '4a { pyro: 3 } ⇒ single', resolveTier({ pyro: 3 }));
check(resolveTier({ pyro: 2, cryo: 2 }) === TIER_DUAL, '4b { pyro: 2, cryo: 2 } ⇒ dual', resolveTier({ pyro: 2, cryo: 2 }));
check(resolveTier({ pyro: 0, cryo: 2 }) === TIER_SINGLE,
    '4c { pyro: 0, cryo: 2 } ⇒ single（0 视为未点名）', resolveTier({ pyro: 0, cryo: 2 }));
checkThrows(() => resolveTier({ pyro: 1, cryo: 1, lightning: 1 }), /正数料键 3 个/,
    '4d 三键 { pyro, cryo, lightning } ⇒ 抛错（预留档不放开）');
checkThrows(() => resolveTier({}), /没有任何正数料键/, '4e 空对象 ⇒ 抛错');
checkThrows(() => resolveTier({ pyro: 0, cryo: 0 }), /没有任何正数料键/, '4f 全 0 ⇒ 抛错');
checkThrows(() => resolveTier('3'), /cost 必须是对象/, '4g 非对象 cost ⇒ 抛错');

// ---------------------------------------------------------------- 5. 未知料键
section('5 未知料键：lightning / gold 判红且点名键与值');

checkThrows(() => resolveTier({ lightning: 1 }), /未知料键 "lightning"/,
    '5a resolveTier({ lightning: 1 }) ⇒ 抛错并点名 "lightning"');

const lightningCost = validateRecipeTable(wrap([makeRecipe({ cost: { pyro: 3, lightning: 1 } })]));
check(hasError(lightningCost, 'BAD_COST', /"lightning"/),
    '5b cost 带 lightning ⇒ BAD_COST 且信息含 "lightning"', codesOf(lightningCost));

const goldCost = validateRecipeTable(wrap([makeRecipe({ cost: { pyro: 3, gold: 1 } })]));
check(hasError(goldCost, 'BAD_COST', /"gold"/),
    '5c cost 带 gold ⇒ BAD_COST 且信息含 "gold"', codesOf(goldCost));

const beastCost = validateRecipeTable(wrap([makeRecipe({ cost: { pyro: 3, beast: 1 } })]));
check(hasError(beastCost, 'BAD_COST', /beast/),
    '5d cost 带 beast ⇒ BAD_COST（beast 只用于建设）', codesOf(beastCost));

// ---------------------------------------------------------------- 6. cost 数值反例
section('6 cost 数值反例：全 0 / 负 / 非整数 / 非对象 / 元素缺键');

check(hasError(validateRecipeTable(wrap([makeRecipe({ cost: { pyro: 0, cryo: 0 } })])), 'BAD_COST', /至少一种料的 cost 必须 > 0/),
    '6a 全 0 cost ⇒ BAD_COST');
check(hasError(validateRecipeTable(wrap([makeRecipe({ cost: { pyro: -1 } })])), 'BAD_COST', /不得为负/),
    '6b 负 cost ⇒ BAD_COST');
check(hasError(validateRecipeTable(wrap([makeRecipe({ cost: { pyro: 1.5 } })])), 'BAD_COST', /必须是整数/),
    '6c 非整数 cost ⇒ BAD_COST');
check(hasError(validateRecipeTable(wrap([makeRecipe({ cost: '3' })])), 'BAD_COST', /必须是对象/),
    '6d 非对象 cost ⇒ BAD_COST');
check(hasError(validateRecipeTable(wrap([makeRecipe({ elements: { pyro: 1 } })])), 'BAD_ELEMENTS', /缺键 "cryo"/),
    '6e elements 缺键（0 层未显式写）⇒ BAD_ELEMENTS');
check(hasError(validateRecipeTable(wrap([makeRecipe({ elements: { pyro: 1, cryo: 0, lightning: 0, gold: 1 } })])), 'BAD_ELEMENTS', /未知元素键 "gold"/),
    '6f elements 带未知元素键 ⇒ BAD_ELEMENTS');
// 6g：已删除字段**复活即判红**（`REMOVED_FIELD`）。0 也算「出现」——留 `damageMult: 0` 同样红，
//   避免有人用 0 / null 做兼容位，让界面又能把它读出来。
check(hasError(validateRecipeTable(wrap([makeRecipe({ damageMult: 0 })])), 'REMOVED_FIELD', /damageMult/),
    '6g damageMult = 0 ⇒ REMOVED_FIELD（已删字段不许以任何值复活）');
check(hasError(validateRecipeTable(wrap([makeRecipe({ damageMult: 1 })])), 'REMOVED_FIELD', /damageMult/),
    '6g2 damageMult = 1（正常值也算复活）⇒ REMOVED_FIELD');
check(hasError(validateRecipeTable(wrap([makeRecipe({ blueprintRequired: 'yes' })])), 'BAD_BLUEPRINT_FLAG'),
    '6h blueprintRequired 非布尔 ⇒ BAD_BLUEPRINT_FLAG');

const missingFieldRecipe = makeRecipe();
delete missingFieldRecipe.elements; // 用 delete 真删；Object.assign 覆盖 undefined 会被 JSON 深拷贝吞掉
const missingField = validateRecipeTable(wrap([missingFieldRecipe]));
check(hasError(missingField, 'MISSING_FIELD', /缺字段 "elements"/),
    '6i 缺五字段之一 ⇒ MISSING_FIELD', codesOf(missingField));

// ---------------------------------------------------------------- 7. C10 硬约束
section('7 C10 硬约束反例（[约束]，必须真的判红）');

const floorDual = validateRecipeTable(wrap([makeRecipe({ cost: { pyro: 1, cryo: 2 } })]));
check(hasError(floorDual, 'FLOOR_TIER_VIOLATION'),
    '7a 最低档 { pyro: 1, cryo: 2 } ⇒ FLOOR_TIER_VIOLATION（cryo 必须为 0）', codesOf(floorDual));

const floorOver = validateRecipeTable(wrap([makeRecipe({ cost: { pyro: 4 } })]));
check(hasError(floorOver, 'FLOOR_TIER_VIOLATION'),
    '7b 最低档 { pyro: 4 } ⇒ FLOOR_TIER_VIOLATION（超过保底 3）', codesOf(floorOver));

const floorOk = validateRecipeTable(wrap([makeRecipe({ cost: { pyro: 3 } })]));
check(floorOk.ok === true && !hasError(floorOk, 'FLOOR_TIER_VIOLATION'),
    '7c 最低档 { pyro: 3 } ⇒ 通过（无 FLOOR_TIER_VIOLATION）', floorOk.errors);

const floorOk2 = validateRecipeTable(wrap([makeRecipe({ cost: { pyro: 1 } })]));
check(floorOk2.ok === true, '7d 最低档 { pyro: 1 } ⇒ 通过（≤ 3 且单料）', floorOk2.errors);

// ---------------------------------------------------------------- 8. 档位成本与已删字段
// 本节探针表用的是**任取的合成值**（如 4 / 1.6 成本配比），与 config 现值无关：它们只验证校验器能不能判红/判绿。
//   真实表的定稿值（3 / 2+2 / 1+3）由上面 1k–1p 锁定，别在本节找现值。
section('8 档位成本同向 / 已删字段复活判红');

// 8a：原「跨档倍率单调（DAMAGE_MULT_MONOTONIC）」已随字段删除；替代它的正向判据是「带该字段即红」。
//   用一个**跨档成本合法**的表去带 damageMult，确保判红只可能来自 REMOVED_FIELD，不会与成本规则混淆。
const badRemovedField = validateRecipeTable(wrap([
    makeRecipe({ id: 'single_ref', cost: { pyro: 3 }, damageMult: 2 }),
    makeRecipe({ id: 'dual_ref', cost: { pyro: 4, cryo: 1 } }),
]));
check(hasError(badRemovedField, 'REMOVED_FIELD', /single_ref/),
    '8a 带 damageMult 的配方 ⇒ REMOVED_FIELD 且点名是哪条', codesOf(badRemovedField));
check(!hasError(badRemovedField, 'COST_MULT_NOT_ALIGNED'),
    '8a2 同一张表成本跨档合法 ⇒ 不因成本判红（判红来源只有 REMOVED_FIELD）', codesOf(badRemovedField));

// 8b / 8c：同档两条，一条带已删字段、另一条不带 ⇒ 只有那条红，另一条不受牵连
const mixedRemovedField = validateRecipeTable(wrap([
    makeRecipe({ id: 'dual_clean', cost: { pyro: 2, cryo: 2 } }),
    makeRecipe({ id: 'dual_dirty', cost: { pyro: 1, cryo: 3 }, damageMult: 1.25 }),
]));
check(hasError(mixedRemovedField, 'REMOVED_FIELD', /dual_dirty/) && !hasError(mixedRemovedField, 'REMOVED_FIELD', /dual_clean/),
    '8b 同档一净一脏 ⇒ 只点名带字段的那条（dual_dirty），不连坐 dual_clean', codesOf(mixedRemovedField));
const removedMsg = (mixedRemovedField.errors.find((e) => e.code === 'REMOVED_FIELD') || {}).message || '';
check(/1\.25/.test(removedMsg) && /不许加回/.test(removedMsg),
    '8c REMOVED_FIELD 文本给出实测值 1.25 并说明「不许加回」', removedMsg);

const badCrossTierCost = validateRecipeTable(wrap([
    makeRecipe({ id: 'single_cheap', cost: { pyro: 3 } }),
    makeRecipe({ id: 'dual_flat', cost: { pyro: 2, cryo: 1 } }),
]));
check(hasError(badCrossTierCost, 'COST_MULT_NOT_ALIGNED'),
    '8d 跨档成本反例（双料总量 3 ≤ 单料 3）⇒ COST_MULT_NOT_ALIGNED', codesOf(badCrossTierCost));

const goodTable = validateRecipeTable(wrap([
    makeRecipe({ id: 'good_single', cost: { pyro: 3 } }),
    makeRecipe({ id: 'good_dual', cost: { pyro: 2, cryo: 2 } }),
    makeRecipe({
        id: 'good_dual_ice',
        cost: { pyro: 1, cryo: 3 },
        elements: { pyro: 1, cryo: 2, lightning: 0 },
        blueprintRequired: true,
    }),
]));
check(goodTable.ok === true,
    '8e 同档同成本总量、差异只在料配比与 elements ⇒ 全部通过（新形态正面用例）', goodTable.errors);

// 8f–8i：「互有优劣」证明——同档同倍率同成本总量，但料配比不同 ⇒ 两种料况下各自更抗，无一条恒劣。
//   M 逐料取最小（订正 C2）：cost 配比决定「抗哪种料短缺」，不是决定谁更强。
const balancedCost = { pyro: 2, cryo: 2 };
const cryoHeavyCost = { pyro: 1, cryo: 3 };

const cryoShortBalanced = computeMaterialShots({ pyro: 20, cryo: 2 }, balancedCost).M;
const cryoShortHeavy = computeMaterialShots({ pyro: 20, cryo: 2 }, cryoHeavyCost).M;
check(cryoShortBalanced > cryoShortHeavy,
    '8f 料况 pyro 20 / cryo 2（cryo 紧）⇒ 均衡 {2,2} 的 M 严格大于重冰 {1,3}',
    { balanced: cryoShortBalanced, cryoHeavy: cryoShortHeavy });

const pyroShortBalanced = computeMaterialShots({ pyro: 3, cryo: 20 }, balancedCost).M;
const pyroShortHeavy = computeMaterialShots({ pyro: 3, cryo: 20 }, cryoHeavyCost).M;
check(pyroShortHeavy > pyroShortBalanced,
    '8g 料况 pyro 3 / cryo 20（pyro 紧）⇒ 重冰 {1,3} 的 M 严格大于均衡 {2,2}',
    { balanced: pyroShortBalanced, cryoHeavy: pyroShortHeavy });

check(cryoShortBalanced > cryoShortHeavy && pyroShortHeavy > pyroShortBalanced,
    '8h 两种料况胜负反转 ⇒ 不存在一条配方在所有料况下都劣',
    { cryoShort: [cryoShortBalanced, cryoShortHeavy], pyroShort: [pyroShortBalanced, pyroShortHeavy] });

// 反例留档：cryo 库存为 0 时两条**同为 0**（均衡那条也点名 cryo，逐料最小值同样归零），
//   该料况无法区分优劣，故上面两个方向分别取 cryo = 2 与 pyro = 3。
const zeroCryoBalanced = computeMaterialShots({ pyro: 20, cryo: 0 }, balancedCost).M;
const zeroCryoHeavy = computeMaterialShots({ pyro: 20, cryo: 0 }, cryoHeavyCost).M;
check(zeroCryoBalanced === 0 && zeroCryoHeavy === 0,
    '8i 料况 cryo = 0 ⇒ 两条 M 同为 0（该料况无法区分优劣，留档说明）',
    { balanced: zeroCryoBalanced, cryoHeavy: zeroCryoHeavy });

const realHeavyCost = getRecipeById(CONFIG, 'ammo_pyro_cryo_heavy').cost;
check(realHeavyCost.pyro === 1 && realHeavyCost.cryo === 3,
    '8j 真实表重冰那条 cost = pyro 1 / cryo 3（配比已落盘）', realHeavyCost);

// ---------------------------------------------------------------- 9. 结构与 id
section('9 结构：id 唯一 / 档位自述不一致 / 错误形状');

const dupTable = validateRecipeTable(wrap([
    makeRecipe({ id: 'dup_id', cost: { pyro: 3 } }),
    makeRecipe({ id: 'dup_id', cost: { pyro: 3 } }),
]));
check(hasError(dupTable, 'DUPLICATE_ID', /"dup_id"/),
    '9a 重复 id ⇒ DUPLICATE_ID 且点名该 id', codesOf(dupTable));

const emptyId = validateRecipeTable(wrap([makeRecipe({ id: '' })]));
check(hasError(emptyId, 'MISSING_FIELD', /非空字符串/),
    '9b 空 id ⇒ MISSING_FIELD', codesOf(emptyId));

const tierMismatch = validateRecipeTable(wrap([makeRecipe({ cost: { pyro: 3 }, tier: TIER_DUAL })]));
check(hasError(tierMismatch, 'TIER_MISMATCH', /推导的档位 "single"/),
    '9c 自带 tier 与正数料键数不一致 ⇒ TIER_MISMATCH', codesOf(tierMismatch));

const notArray = validateRecipeTable({ gameplay: { build: { recipes: {} } } });
check(hasError(notArray, 'TABLE_INVALID'), '9d recipes 非数组 ⇒ TABLE_INVALID（不抛错）', codesOf(notArray));

const shapeOk = (notArray.errors || []).every((e) => typeof e.code === 'string'
    && Object.prototype.hasOwnProperty.call(e, 'id')
    && typeof e.message === 'string');
check(shapeOk, '9e 每条错误都是 { code, id, message }', notArray.errors);

// ---------------------------------------------------------------- 10. pickDefaultRecipe
section('10 pickDefaultRecipe：默认＝已解锁里最低成本，并列取字典序最小');

checkThrows(() => pickDefaultRecipe(CONFIG, []), /unlockedIds 为空/,
    '10a 已解锁为空 ⇒ 抛错');
checkThrows(() => pickDefaultRecipe(CONFIG, ['ghost_id']), /没有任何一条在/,
    '10b 已解锁 id 全部不在表内 ⇒ 抛错');
checkThrows(() => pickDefaultRecipe(CONFIG, 'ammo_pyro_single'), /必须是数组或 Set/,
    '10c unlockedIds 非数组 / Set ⇒ 抛错');

check(pickDefaultRecipe(CONFIG, realTable.map((r) => r.id)).id === 'ammo_pyro_single',
    '10d 全解锁 ⇒ 返回成本最低的 ammo_pyro_single',
    pickDefaultRecipe(CONFIG, realTable.map((r) => r.id)).id);
check(pickDefaultRecipe(CONFIG, ['ammo_pyro_cryo_heavy']).id === 'ammo_pyro_cryo_heavy',
    '10e 只解锁带设计图那条 ⇒ 返回它',
    pickDefaultRecipe(CONFIG, ['ammo_pyro_cryo_heavy']).id);
check(pickDefaultRecipe(CONFIG, new Set(['ammo_pyro_cryo_dual', 'ammo_pyro_cryo_heavy'])).id === 'ammo_pyro_cryo_dual',
    '10f Set 入参可用；两条双料同成本并列 ⇒ 取 id 字典序最小的 ammo_pyro_cryo_dual',
    pickDefaultRecipe(CONFIG, new Set(['ammo_pyro_cryo_dual', 'ammo_pyro_cryo_heavy'])).id);

const tieTable = [
    makeRecipe({ id: 'zz_tie', cost: { pyro: 2, cryo: 2 } }),
    makeRecipe({ id: 'aa_tie', cost: { pyro: 2, cryo: 2 } }),
];
check(pickDefaultRecipe(wrap(tieTable), ['zz_tie', 'aa_tie']).id === 'aa_tie',
    '10g 并列时取 id 字典序最小（与数组顺序无关）',
    pickDefaultRecipe(wrap(tieTable), ['zz_tie', 'aa_tie']).id);
check(pickDefaultRecipe(wrap(tieTable.slice().reverse()), ['zz_tie', 'aa_tie']).id === 'aa_tie',
    '10h 反转数组顺序后仍取 aa_tie（结果稳定）',
    pickDefaultRecipe(wrap(tieTable.slice().reverse()), ['zz_tie', 'aa_tie']).id);

// ---------------------------------------------------------------- 11. 可读串
section('11 describeRecipeCost / describeRecipeTier');

check(describeRecipeCost({ pyro: 2, cryo: 1 }) === 'pyro 2 + cryo 1',
    '11a 双料可读串 = "pyro 2 + cryo 1"', describeRecipeCost({ pyro: 2, cryo: 1 }));
check(describeRecipeCost({ pyro: 2, cryo: 0 }) === 'pyro 2',
    '11b 只列正数键（cryo 0 不出现）', describeRecipeCost({ pyro: 2, cryo: 0 }));
check(describeRecipeCost({ pyro: 0, cryo: 0 }) === '无',
    '11c 全 0 ⇒ "无"', describeRecipeCost({ pyro: 0, cryo: 0 }));
check(describeRecipeCost({ cryo: 1, pyro: 3 }) === 'pyro 3 + cryo 1',
    '11d 输出顺序固定为 pyro 先（不随对象键序漂移）', describeRecipeCost({ cryo: 1, pyro: 3 }));
check(describeRecipeTier(TIER_SINGLE) === '单料', '11e describeRecipeTier(single) = 单料', describeRecipeTier(TIER_SINGLE));
check(describeRecipeTier(TIER_DUAL) === '双料', '11f describeRecipeTier(dual) = 双料', describeRecipeTier(TIER_DUAL));
checkThrows(() => describeRecipeTier('triple'), /未知档位 "triple"/, '11g 未知档位 ⇒ 抛错');
check(sumRecipeCost({ pyro: 2, cryo: 2 }) === 4, '11h sumRecipeCost({ pyro:2, cryo:2 }) = 4', sumRecipeCost({ pyro: 2, cryo: 2 }));

// ---------------------------------------------------------------- 12. 纯函数不改入参
section('12 纯函数不改入参');

const listCopy = listRecipes(CONFIG);
listCopy.push(makeRecipe({ id: 'injected' }));
check(listRecipes(CONFIG).length === realTable.length,
    '12a listRecipes 返回拷贝：push 不影响 CONFIG', listRecipes(CONFIG).length);

const badTableForPurity = wrap([makeRecipe({ id: 'purity', cost: { pyro: 1, cryo: 2 } })]);
const badTableBefore = clone(badTableForPurity);
validateRecipeTable(badTableForPurity);
check(deepEqual(badTableBefore, badTableForPurity),
    '12b validateRecipeTable 不改入参（坏表跑完深比较一致）', deepEqual(badTableBefore, badTableForPurity));

const costBefore = clone({ pyro: 2, cryo: 1 });
resolveTier(costBefore);
sumRecipeCost(costBefore);
describeRecipeCost(costBefore);
check(deepEqual(costBefore, { pyro: 2, cryo: 1 }),
    '12c resolveTier / sumRecipeCost / describeRecipeCost 不改入参', costBefore);

check(deepEqual(configSnapshotBefore, CONFIG),
    '12d 全部断言跑完，CONFIG 与跑前深比较一致', deepEqual(configSnapshotBefore, CONFIG));

// ---------------------------------------------------------------- 13. pickRecipeByYield
section('13 pickRecipeByYield：按「这堆料能打几发」挑（成本必须用实扣价）');

// 已解锁（`blueprintRequired !== true`）：真机口径下 `ammo_pyro_cryo_heavy` 仍算未解锁。
const yieldUnlocked = realTable.filter((r) => r.blueprintRequired !== true).map((r) => r.id);
// 实扣价 = 原价 × 手工造弹倍率（未建工坊）。这里显式乘配置里的倍率，**不读运行时**：
// 倍率的唯一实现在 `game_phase.phase_shotCostByMaterial`，本测试只喂「已换算好的成本」。
const manualMult = Number(CONFIG.gameplay.build.workshop.manualMaterialMultiplier) || 1;
const realCostOf = (recipe) => {
    const out = {};
    Object.keys(recipe.cost || {}).forEach((key) => {
        const n = Number(recipe.cost[key]);
        if (n > 0) out[key] = n * manualMult;
    });
    return out;
};

// 13a 只有 pyro 有料 ⇒ 选单料。**这是正确行为不是 bug**：只有一种料时单料 yield 必然最高
//     （双料要求 cryo > 0，cryo 缺 ⇒ 双料 yield = 0）。
check(pickRecipeByYield(CONFIG, yieldUnlocked, { pyro: 9, cryo: 0 }, realCostOf).id === 'ammo_pyro_single',
    '13a 只有 pyro 有料（9 / cryo 0）⇒ 选 ammo_pyro_single',
    pickRecipeByYield(CONFIG, yieldUnlocked, { pyro: 9, cryo: 0 }, realCostOf).id);

// 13b 真机第 3 波账本（pyro 9 / cryo 32，倍率 2）⇒ 必须选双料，且 yield = 2（不是 1）。
//     单料 {pyro:6} ⇒ floor(9/6) = 1；双料 {pyro:4,cryo:4} ⇒ min(2, 8) = 2。差一倍，这正是本 bug。
{
    const stock = { pyro: 9, cryo: 32 };
    const picked = pickRecipeByYield(CONFIG, yieldUnlocked, stock, realCostOf);
    const pickedCost = realCostOf(picked);
    const pickedYield = computeRecipeYield(pickedCost, stock);
    check(picked.id === 'ammo_pyro_cryo_dual',
        '13b 真机第 3 波料况（pyro 9 / cryo 32，倍率 2）⇒ 选 ammo_pyro_cryo_dual', picked.id);
    check(pickedYield === 2, '13b2 该配方的 yield = 2（单料只有 1）', pickedYield);
    check(computeRecipeYield(realCostOf(realSingleRecipe), stock) === 1,
        '13b3 同一料况下单料 yield = 1（差一倍，正是按标价挑导致的缺口）',
        computeRecipeYield(realCostOf(realSingleRecipe), stock));
    check(pickedCost.pyro === 4 && pickedCost.cryo === 4,
        '13b4 成本走实扣价：双料每发 pyro 4 / cryo 4（原价 2/2 × 倍率 2）', pickedCost);
}

// 13b5 同一料况下「按成本总量最低」与「按发数最多」给出**相反**的结论：前者选单料（只打 1 发），
//      后者选双料（打 2 发）。这条把本任务变更的那条语义固化成可执行断言（旧口径保留在 `pickDefaultRecipe`，
//      现作「料况读数缺失」时的退回档）。
check(pickDefaultRecipe(CONFIG, yieldUnlocked).id === 'ammo_pyro_single'
    && pickRecipeByYield(CONFIG, yieldUnlocked, { pyro: 9, cryo: 32 }, realCostOf).id === 'ammo_pyro_cryo_dual',
    '13b5 同一料况：按成本总量挑 ⇒ 单料（1 发）；按发数挑 ⇒ 双料（2 发），结论相反',
    {
        byCost: pickDefaultRecipe(CONFIG, yieldUnlocked).id,
        byYield: pickRecipeByYield(CONFIG, yieldUnlocked, { pyro: 9, cryo: 32 }, realCostOf).id,
    });

// 13c 料况读数缺失 / 非普通对象 / costOf 不是函数 ⇒ 退回 pickDefaultRecipe 的旧结果（同一 id），不抛错。
{
    const expectedId = pickDefaultRecipe(CONFIG, yieldUnlocked).id;
    check(pickRecipeByYield(CONFIG, yieldUnlocked, undefined, realCostOf).id === expectedId,
        '13c stockByMaterial 缺失 ⇒ 退回 pickDefaultRecipe 的结果',
        pickRecipeByYield(CONFIG, yieldUnlocked, undefined, realCostOf).id);
    check(pickRecipeByYield(CONFIG, yieldUnlocked, null, realCostOf).id === expectedId,
        '13c2 stockByMaterial = null ⇒ 同样退回', pickRecipeByYield(CONFIG, yieldUnlocked, null, realCostOf).id);
    check(pickRecipeByYield(CONFIG, yieldUnlocked, [9, 32], realCostOf).id === expectedId,
        '13c3 stockByMaterial 是数组（非普通对象）⇒ 同样退回',
        pickRecipeByYield(CONFIG, yieldUnlocked, [9, 32], realCostOf).id);
    check(pickRecipeByYield(CONFIG, yieldUnlocked, { pyro: 9, cryo: 32 }, null).id === expectedId,
        '13c4 costOf 不是函数 ⇒ 同样退回', pickRecipeByYield(CONFIG, yieldUnlocked, { pyro: 9, cryo: 32 }, null).id);
}

// 13d yield 并列 ⇒ 按 id 字典序最小；且同一输入多跑几次结果不变（确定性）。
//     真表构造：单料 {pyro:6} 与双料 {pyro:4,cryo:4} 在 stock {pyro:12, cryo:8} 下都是 2 发。
{
    const tieStock = { pyro: 12, cryo: 8 };
    check(computeRecipeYield(realCostOf(realSingleRecipe), tieStock) === 2
        && computeRecipeYield(realCostOf(realDualRecipe), tieStock) === 2,
        '13d 真表并列前提成立：单料与双料在 pyro 12 / cryo 8 下都得 2 发',
        { single: computeRecipeYield(realCostOf(realSingleRecipe), tieStock), dual: computeRecipeYield(realCostOf(realDualRecipe), tieStock) });
    const tieIds = ['ammo_pyro_single', 'ammo_pyro_cryo_dual'];
    const expectTieId = tieIds.slice().sort()[0];
    check(pickRecipeByYield(CONFIG, tieIds, tieStock, realCostOf).id === expectTieId,
        `13d2 并列 ⇒ 取 id 字典序最小（期望 ${expectTieId}）`,
        pickRecipeByYield(CONFIG, tieIds, tieStock, realCostOf).id);
    const runs = [];
    for (let i = 0; i < 5; i++) {
        runs.push(pickRecipeByYield(CONFIG, tieIds.slice().reverse(), tieStock, realCostOf).id);
    }
    check(new Set(runs).size === 1 && runs[0] === expectTieId,
        '13d3 同一输入跑 5 次（且入参顺序反转）结果恒定', Array.from(new Set(runs)).join('/'));
}

// 13e 入参守卫与 pickDefaultRecipe 同一套判据（不另起一套错误口径）。
checkThrows(() => pickRecipeByYield(CONFIG, [], { pyro: 9 }, realCostOf), /unlockedIds 为空/,
    '13e 已解锁为空 ⇒ 抛错（不返回 null 伪装成"没有默认项"）');
checkThrows(() => pickRecipeByYield(CONFIG, 'ammo_pyro_single', { pyro: 9 }, realCostOf), /必须是数组或 Set/,
    '13e2 unlockedIds 非数组 / Set ⇒ 抛错');
checkThrows(() => pickRecipeByYield(CONFIG, ['ghost_id'], { pyro: 9 }, realCostOf), /没有任何一条在/,
    '13e3 已解锁 id 全部不在表内 ⇒ 抛错');

// 13f 不改入参 + 全 0 成本的退化：`cost` 没有正数键 ⇒ yield = 0（不是 Infinity，也不是 NaN）。
{
    const stockBefore = clone({ pyro: 9, cryo: 32 });
    pickRecipeByYield(CONFIG, yieldUnlocked, stockBefore, realCostOf);
    check(deepEqual(stockBefore, { pyro: 9, cryo: 32 }), '13f pickRecipeByYield 不改入参', stockBefore);
    check(computeRecipeYield({ pyro: 0, cryo: 0 }, { pyro: 9, cryo: 32 }) === 0,
        '13f2 成本无正数键 ⇒ yield = 0（不是 Infinity / NaN）', computeRecipeYield({ pyro: 0, cryo: 0 }, { pyro: 9, cryo: 32 }));
    check(computeRecipeYield({ pyro: 2 }, {}) === 0, '13f3 料键缺失按 0 ⇒ yield = 0', computeRecipeYield({ pyro: 2 }, {}));
}

// ---------------------------------------------------------------- 汇总
console.log('\n===================================================');
console.log(`  passed ${passed} / failed ${failed}  (total ${passed + failed})`);
console.log('===================================================');
if (failed > 0) {
    console.log('\n失败断言：');
    for (const name of failures) console.log(`  - ${name}`);
    process.exitCode = 1;
} else {
    process.exitCode = 0;
}
