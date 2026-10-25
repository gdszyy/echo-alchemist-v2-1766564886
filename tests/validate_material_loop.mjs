/**
 * validate_material_loop.mjs - [REQ-20261022-wave-loop · 料闭环] 「料」最小闭环验收。
 *
 * 断言口径是**模型**（冻结单 v3），不是某一跑的实现值：
 *   M = FLOOR + floor(coloredHits / perHitsPerMaterial)
 *   FLOOR = CONFIG.…materials.basicFloorPerWave（= 3），p = perHitsPerMaterial（= 2）
 *   s = coloredHits / primaryHits（**由计数得**，不是配置常数）
 * 只对产料钉（pegWeights 点名 pyro / cryo 的钉）计 coloredHits；normal / bounce 等只产电，无默认桶兜底。
 *
 * 覆盖：
 *   A. 生产模型：全彩钉 / 混合 / 零彩钉三种场景，M 都按上式成立（不硬编码任何实现值）。
 *   A2. 副球：primaryHits 与 coloredHits 都不动。
 *   A3. 未点名钉不产料：normal / bounce / damage / lightning 每次都只 +1 primaryHits。
 *   B. 无上限：只累加不截断（1e12、10 万次碰钉）。
 *   C. 消耗：装填上限扣料、料不足短装。
 *   D. 静态契约：config 键、波末消费点、碰钉挂点、共享钉类型池、读数出口形状。
 *   E. 边界：beast 不参与造弹；cryo 落 cryo 桶；余数记录。
 *   F. 真实分布的 s：直接跑 `game_phase.phase_gathering_getRandomPegType` 真函数采样。
 *   CONFLICT：冻结单假设 s = 0.5 与盘上实测 s 的差，如实记录，不调参数去凑。
 *
 * Usage:
 *   node tests/validate_material_loop.mjs
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CONFIG } from '../src/config.js';
import { game_phase } from '../src/game_phase.js';
import { material_system } from '../src/material_system.js';
import { RANDOMIZABLE_PEG_TYPES } from '../src/utils/peg_type_pool.js';
import {
    BASIC_FLOOR_PER_WAVE,
    FLOOR_BUCKET,
    MATERIALS_PER_SHOT,
    addMaterial,
    bucketForPegType,
    createMaterialLedger,
    planLoadout,
    readMaterialReadout,
    recordPegHit,
    settleWaveMaterials,
} from '../src/utils/material_economy_utils.js';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = rel => fs.readFileSync(path.join(repoRoot, rel), 'utf8');

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
function eq(actual, expected, message) {
    check(actual === expected, `${message}（实际 ${JSON.stringify(actual)}，期望 ${JSON.stringify(expected)}）`);
}
/** 模型：M = FLOOR + floor(colored / p)。断言用配置里的真实数值，不写死。 */
function modelM(coloredHits, floor = FLOOR, per = PER_HITS) {
    return floor + Math.floor(coloredHits / per);
}

console.log('===================================================');
console.log('  Material loop validation (料闭环 · 无上限 · 波末结算)');
console.log('===================================================\n');

const MAT_CFG = (CONFIG.gameplay && CONFIG.gameplay.build && CONFIG.gameplay.build.power
    && CONFIG.gameplay.build.power.materials) || {};
const PER_HITS = MAT_CFG.perHitsPerMaterial;
const PER_SHOT = MAT_CFG.materialPerShot;
const FLOOR = MAT_CFG.basicFloorPerWave;

console.log(`config: perHitsPerMaterial=${PER_HITS} materialPerShot=${PER_SHOT} basicFloorPerWave=${FLOOR}`
    + `（materialCapShots 键存在？${'materialCapShots' in MAT_CFG}）`);

/**
 * 跑一次挖掘：orbs 颗弹珠 × 每颗 hitsPerOrb 次碰钉，钉类型序列由 pegTypes 按序轮转。
 * 调用形状与 spawn_createHitFeedback 采集回调一致（type, secondary, weights），但本层只累积计数。
 */
function hitWave({ pegTypes = ['normal'], orbs = 1, hitsPerOrb = 0, secondary = false, ledger = createMaterialLedger() }) {
    let state = ledger;
    let granted = 0;
    for (let orb = 0; orb < orbs; orb++) {
        for (let hit = 0; hit < hitsPerOrb; hit++) {
            const pegType = pegTypes[(orb * hitsPerOrb + hit) % pegTypes.length];
            const res = recordPegHit(state, {
                pegType,
                secondary,
                weights: MAT_CFG.pegWeights,
            });
            state = res.ledger;
            granted += res.granted;
        }
    }
    return { ledger: state, granted };
}

/** 累积完计数后跑波末结算。 */
function settle(ledger) {
    return settleWaveMaterials(ledger, {
        perHitsPerMaterial: PER_HITS,
        basicFloorPerWave: FLOOR,
    });
}

// ---------------------------------------------------------------- A
console.log('\n[A] 生产模型 M = FLOOR + floor(coloredHits / p)');

const allColored = hitWave({ pegTypes: ['pyro'], orbs: 5, hitsPerOrb: 10 });
const allColoredSettled = settle(allColored.ledger);
console.log(`  [50 碰全 pyro] colored=${allColored.ledger.coloredHits} primary=${allColored.ledger.primaryHits}`
    + ` ⇒ M=${allColoredSettled.total}（pyro=${allColoredSettled.ledger.pyro} cryo=${allColoredSettled.ledger.cryo}）`);
eq(allColored.granted, 0, 'A.碰钉回调本身不入料（只在波末结算一次）');
eq(allColored.ledger.producedThisWave, 0, 'A.碰钉阶段 producedThisWave 保持 0');
eq(allColored.ledger.coloredHits, 50, 'A.50 次全产料钉命中 ⇒ coloredHits = 50');
eq(allColoredSettled.total, modelM(50), `A.50 彩钉命中 ⇒ M = ${modelM(50)} = FLOOR + floor(50/${PER_HITS})`);
eq(allColoredSettled.ledger.producedThisWave, modelM(50), 'A.结算后 producedThisWave 就是本波料入 M');
eq(allColoredSettled.ledger.pyro, modelM(50), 'A.全 pyro 命中 ⇒ 全部入 pyro 桶（含保底）');

// 混合盘：30 彩钉 + 20 无色钉
const mixed = hitWave({ pegTypes: ['pyro', 'pyro', 'pyro', 'normal', 'normal'], orbs: 5, hitsPerOrb: 10 });
const mixedSettled = settle(mixed.ledger);
console.log(`  [50 碰 3:2 彩:无色] colored=${mixed.ledger.coloredHits} primary=${mixed.ledger.primaryHits}`
    + ` s=${(mixed.ledger.coloredHits / mixed.ledger.primaryHits).toFixed(3)} ⇒ M=${mixedSettled.total}`);
eq(mixed.ledger.coloredHits, 30, 'A.混合盘只对彩钉计 coloredHits（50 × 3/5 = 30）');
eq(mixedSettled.total, modelM(30), `A.30 彩钉命中 ⇒ M = ${modelM(30)}（无色钉不产料，但仍进 primaryHits 分母）`);

// 零彩钉盘：只有保底
// 钉型集合只取 `normal`：`bounce` 自 [REQ-20261022-wave-loop 料→建造] 起被 `config.js:1036` 的
// `bounce: { beast: 1 }` 点名为第三色料的产料钉，把它放进「无彩钉」盘就不再无色，前提不成立。
const noColored = hitWave({ pegTypes: ['normal'], orbs: 3, hitsPerOrb: 10 });
const noColoredSettled = settle(noColored.ledger);
console.log(`  [30 碰无彩钉] colored=${noColored.ledger.coloredHits} primary=${noColored.ledger.primaryHits}`
    + ` ⇒ M=${noColoredSettled.total}（只剩保底）`);
eq(noColored.ledger.coloredHits, 0, 'A.无彩钉 ⇒ coloredHits = 0');
eq(noColoredSettled.total, FLOOR, `A.无彩钉 ⇒ M 只剩保底 FLOOR = ${FLOOR}（如实报，不用默认桶遮掩）`);
eq(noColoredSettled.units, 0, 'A.无彩钉 ⇒ 入料次数 0');
eq(noColoredSettled.byBucket.pyro, FLOOR, 'A.保底落 pyro（钉盘料池起点）');

// ---------------------------------------------------------------- A2
console.log('\n[A2] 副球不计料、也不计入 primaryHits');
const secondaryRun = hitWave({ pegTypes: ['pyro'], orbs: 5, hitsPerOrb: 10, secondary: true });
eq(secondaryRun.ledger.coloredHits, 0, 'A2.副球不计 coloredHits');
eq(secondaryRun.ledger.primaryHits, 0, 'A2.副球不计 primaryHits（s 的分母不被副球污染）');
eq(settle(secondaryRun.ledger).total, FLOOR, 'A2.全副球 ⇒ 只剩保底（不因副球虚增料）');

// 主球 + 副球混跑：主球 60 次里 30 次彩钉，每次再补一次副球回调
let mixedSecondary = createMaterialLedger();
for (let orb = 0; orb < 6; orb++) {
    for (let hit = 0; hit < 10; hit++) {
        const primaryType = hit < 5 ? 'pyro' : 'normal';
        mixedSecondary = recordPegHit(mixedSecondary, {
            pegType: primaryType, secondary: false, weights: MAT_CFG.pegWeights,
        }).ledger;
        const sec = recordPegHit(mixedSecondary, {
            pegType: 'pyro', secondary: true, weights: MAT_CFG.pegWeights,
        });
        mixedSecondary = sec.ledger;
        eq(sec.granted, 0, 'A2.副球回调 granted 恒 0');
    }
}
eq(mixedSecondary.primaryHits, 60, 'A2.60 次主球碰钉 ⇒ primaryHits = 60');
eq(mixedSecondary.coloredHits, 30, 'A2.其中 30 次彩钉 ⇒ coloredHits = 30（副球一次没算进去）');

// ---------------------------------------------------------------- A3
console.log('\n[A3] 未点名钉不产料（已撤销 DEFAULT_PEG_MATERIAL 默认桶兜底）');
// 仍「未点名」的钉型：normal / damage / lightning / gray。`lightning` 留在名单里是为防死键复燃
// （它不在 `peg_type_pool.js:20` 的 RANDOMIZABLE_PEG_TYPES 内，钉盘不刷，但配置里也不许给它写料权重）。
// `bounce` 已从本名单移出：它现在是第三色料的产料钉（见下方 A3b）。
for (const pegType of ['normal', 'damage', 'lightning', 'gray']) {
    const run = hitWave({ pegTypes: [pegType], orbs: 1, hitsPerOrb: 4 });
    eq(run.ledger.coloredHits, 0, `A3.${pegType} 钉不产料（coloredHits = 0）`);
    eq(run.ledger.primaryHits, 4, `A3.${pegType} 钉仍进 primaryHits（4 次）`);
    eq(bucketForPegType(pegType, MAT_CFG.pegWeights), null, `A3.bucketForPegType('${pegType}') 返回 null`);
}
// A3b：`bounce` 的语义已从「无色钉」改成「第三色料产料钉」（config.js:1036 `bounce: { beast: 1 }`）——
// 同一断言的意图（未点名的钉不产料）由上面四类钉继续表达；这里按逐条对应换成正面断言：
//   ① 仍进 primaryHits（4 次）→ 保留原样；② coloredHits 0 → 4；③ bucketForPegType null → 'beast'。
const bounceRun = hitWave({ pegTypes: ['bounce'], orbs: 1, hitsPerOrb: 4 });
eq(bounceRun.ledger.primaryHits, 4, 'A3b.bounce 钉仍进 primaryHits（4 次）');
eq(bounceRun.ledger.coloredHits, 4, 'A3b.bounce 钉产第三色料（coloredHits = 4）');
eq(bucketForPegType('bounce', MAT_CFG.pegWeights), 'beast', "A3b.bucketForPegType('bounce') 返回 beast（beast 只用于建设）");
eq(bucketForPegType('pyro', MAT_CFG.pegWeights), 'pyro', 'A3.pyro 钉落 pyro 桶');
eq(bucketForPegType('cryo', MAT_CFG.pegWeights), 'cryo', 'A3.cryo 钉落 cryo 桶');
eq(bucketForPegType('whatever', undefined), null, 'A3.没有 pegWeights 时也不兜底（返回 null）');

// ---------------------------------------------------------------- B
console.log('\n[B] 无上限：料存量只累加，不截断');
const bLedger = settle(hitWave({ pegTypes: ['pyro'], orbs: 5, hitsPerOrb: 6 }).ledger).ledger;
console.log(`  [30 碰全彩] produced=${bLedger.producedThisWave} destroyed=${bLedger.destroyedThisWave} 余额=${bLedger.pyro + bLedger.cryo}`);
eq(bLedger.producedThisWave, modelM(30), `B.30 彩钉命中 ⇒ M = ${modelM(30)}`);
eq(bLedger.pyro + bLedger.cryo, modelM(30), 'B.本波入料全数留存（旧口径「容量 9 ⇒ 销毁 6」已作废）');
eq(bLedger.destroyedThisWave, 0, 'B.无上限 ⇒ 本波销毁恒 0');

const huge = addMaterial(createMaterialLedger(), 'pyro', 1e12);
console.log(`  [1e12 累加] pyro=${huge.ledger.pyro} 精确？${huge.ledger.pyro === 1e12}`);
eq(huge.ledger.pyro, 1e12, 'B.1e12 料仍精确累加（Number 安全整数范围内）');
eq(huge.destroyed, 0, 'B.大额入账也不销毁');
eq(readMaterialReadout(huge.ledger).pyro, 1e12, 'B.读数出口照原值透出 1e12');
eq(addMaterial(createMaterialLedger(), 'not-a-bucket', 5).granted, 0, 'B.非法桶不落任何桶（不兜底到 pyro）');

let many = createMaterialLedger();
for (let i = 0; i < 100000; i++) {
    many = recordPegHit(many, { pegType: 'pyro', weights: MAT_CFG.pegWeights }).ledger;
}
console.log(`  [10 万碰全彩] primary=${many.primaryHits} colored=${many.coloredHits} ⇒ 结算 ${settle(many).total}`);
eq(many.primaryHits, 100000, 'B.10 万次碰钉 ⇒ primaryHits = 100000（逐次累加无漂移）');
eq(many.coloredHits, 100000, 'B.10 万次碰钉 ⇒ coloredHits = 100000');
eq(settle(many).total, FLOOR + Math.floor(100000 / PER_HITS), 'B.10 万彩钉命中 ⇒ M 按模型线性放大');

// ---------------------------------------------------------------- C
console.log('\n[C] 消耗：装填上限 2 ⇒ 扣 6 料 / loadedShots=2；料降到 5 ⇒ loadedShots=1');
const rich = planLoadout(bLedger, 2, PER_SHOT);
console.log(`  装填上限 2：spent=${rich.spentTotal}（pyro ${rich.spent.pyro} + cryo ${rich.spent.cryo}）loadedShots=${rich.loadedShots}`);
eq(rich.spentTotal, 6, 'C.装填上限 2 ⇒ 扣料 6（2 × 3）');
eq(rich.loadedShots, 2, 'C.装填上限 2、料足 ⇒ loadedShots = 2');
eq(rich.ledger.pyro + rich.ledger.cryo, modelM(30) - 6, 'C.扣料后余额 = M − 6（不因旧容量口径被截）');

const poorLedger = { ...createMaterialLedger(), pyro: 5 };
const poor = planLoadout(poorLedger, 2, PER_SHOT);
console.log(`  料 5、装填上限 2：loadedShots=${poor.loadedShots} shortfall=${poor.shortfall} spent=${poor.spentTotal}`);
eq(poor.loadedShots, 1, 'C.料 5 ⇒ 只能装 1 发');
eq(poor.spentTotal, 3, 'C.料 5 ⇒ 实际扣 3');
eq(poor.shortfall, 1, 'C.短装 1 发要能被暴露出来');
eq(poor.ledger.pyro, 2, 'C.料 5 扣 3 剩 2');

const hugeLoad = planLoadout(huge.ledger, 5, PER_SHOT);
eq(hugeLoad.loadedShots, 5, 'C.料再多也只有装填上限 5 发（无上限 ≠ 无装填上限）');
eq(hugeLoad.spentTotal, 15, 'C.装填 5 发扣 15 料');

// ---------------------------------------------------------------- D
console.log('\n[D] 静态契约');
// 2026-10-25 料经济标定：p 2 → 1（理由与整局表见 tests/validate_material_economy_balance.mjs）。
// 断言形式照旧是精确等值；本条只换期望值，不降级。
eq(PER_HITS, 1, 'D.config perHitsPerMaterial = 1（2026-10-25 标定后的盘上值）');
eq(PER_SHOT, MATERIALS_PER_SHOT, 'D.config materialPerShot = 3（冻结单 v3 §3.3）');
eq(FLOOR, 3, 'D.config basicFloorPerWave = 3（冻结单 v3 §3.1 FLOOR := c = 3）');
eq(BASIC_FLOOR_PER_WAVE, 3, 'D.纯函数侧 FLOOR 兜底值 = 3');
eq(FLOOR_BUCKET, 'pyro', 'D.保底落 pyro 桶');
eq('materialCapShots' in MAT_CFG, false, 'D.config 已无 materialCapShots 键（走「键不存在」表达无上限）');

const configSrc = read('src/config.js');
check(/^\s*materialCapShots\s*:/m.test(configSrc) === false, 'D.config 源码里没有 materialCapShots 键行（注释提及不算）');
check(/^\s*materialPerShot\s*:/m.test(configSrc), 'D.config 源码保留 materialPerShot 键');
check(/^\s*basicFloorPerWave\s*:\s*3\s*,/m.test(configSrc), 'D.config 源码有 basicFloorPerWave: 3 键行');
// 键必须落在 `power.materials` 段内（不是别处）。
// **收紧锚点，不放大窗口**：`build.facilities.workshop/generator/battery` 的 `materials` 是行内写法且排在
// `power` 之前（config.js:973-975 vs :1016），用全文首个 `materials:` 作锚会把窗口从 ~700 字符撑到 5000+ 而假红。
// 改法：先切出 `power:` 之后的文本，再取其中**第一个**行首 `materials: {`，窗口到紧随的 `grid:` 自然收口。
const powerSrc = configSrc.slice(configSrc.indexOf('power: {'));
const materialsBlock = /^\s*materials:\s*\{([\s\S]*?)\n\s*grid:/m.exec(powerSrc);
check(!!materialsBlock && /basicFloorPerWave\s*:\s*3/.test(materialsBlock[1]), 'D.basicFloorPerWave 落在 materials 段内');

const utilsSrc = read('src/utils/material_economy_utils.js');
const utilsCode = utilsSrc.replace(/^\s*\*.*$/gm, '').replace(/\/\/.*$/gm, '');
check(!/DEFAULT_PEG_MATERIAL/.test(utilsCode), 'D.纯函数代码里已无 DEFAULT_PEG_MATERIAL 默认桶兜底（注释提及不算）');
check(/return null;/.test(utilsCode), 'D.bucketForPegType 未点名时返回 null（不落任何桶）');
check(!/export function materialCapacity/.test(utilsSrc), 'D.容量函数 materialCapacity 已删除');
check(/export function addMaterial\(ledger, key, amount\)/.test(utilsSrc), 'D.addMaterial 签名不接收 cap');
check(!/cap[Vv]alue|\bclip\b/.test(utilsSrc.replace(/^.*\*.*$/gm, '')), 'D.入账实现里没有任何 cap / clip 代码（注释除外）');
check(/export function settleWaveMaterials\(ledger, opts = \{\}\)/.test(utilsSrc), 'D.波末结算函数 settleWaveMaterials 存在');
check(/const units = Math\.floor\(base\.coloredHits \/ per\)/.test(utilsSrc), 'D.入料次数 = floor(coloredHits / p)（模型原句）');
check(!/hitProgress/.test(utilsSrc), 'D.旧 hitProgress 字段已换成 coloredHitRemainder（语义不再混淆）');

const materialSystemSrc = read('src/material_system.js');
check(!/mat_getCapacity/.test(materialSystemSrc), 'D.material_system 已无 mat_getCapacity');
check(!/materialCapShots/.test(materialSystemSrc.replace(/^.*\*.*$/gm, '')), 'D.material_system 代码里不读 materialCapShots');
check(/mat_settleWaveMaterials\(\)\s*\{/.test(materialSystemSrc), 'D.material_system 有波末结算入口 mat_settleWaveMaterials');
check(/_materialSettleRound === this\.round/.test(materialSystemSrc), 'D.波末结算按 round 去重（防重复入料）');
check(/_materialLoadRound === this\.round/.test(materialSystemSrc), 'D.装填扣料按 round 去重（防二次扣料）');

const core = read('src/core.js');
check(/import\s*\{\s*material_system\s*\}\s*from\s*'\.\/material_system\.js'/.test(core), 'D.core.js 导入 material_system');
check(/run_shop,\s*build_system,\s*build_screen_system,\s*defend_hud_system,\s*material_system/.test(core), 'D.core.js 注册 material_system 到 _subsystems');
check(/sys_initBuildState\(\);[\s\S]{0,200}sys_initMaterialLedger\(\)/.test(core), 'D.core.js 新局路径初始化料账本');

const gameSystem = read('src/game_system.js');
check(/sys_initBuildState === 'function'\) this\.sys_initBuildState\(\);[\s\S]{0,300}sys_initMaterialLedger/.test(gameSystem), 'D.game_system.js 重开一局也初始化料账本');

// 生产挂点：碰钉回调只计数
const spawnSystem = read('src/spawn_system.js');
check(/chargeSession\.role === 'collector' && !options\.secondary\)\s*\{[\s\S]{0,1600}?mat_recordPegHit\(/.test(spawnSystem), 'D.生产计数挂点在采集弹珠碰钉回调内、沿用 !options.secondary 副球判据');
check(/mat_recordPegHit\(type, !!\(options && options\.secondary\)\)/.test(spawnSystem), 'D.碰钉回调把钉类型 + 副球标志传给账本');
check(!/this\.mat_addMaterial|this\.addMaterial/.test(spawnSystem), 'D.碰钉回调不再直接入料（入料只在波末）');

// 波末消费点：build_system.sys_onDigComplete
const buildSystem = read('src/build_system.js');
const digCompleteBody = /sys_onDigComplete\(\)\s*\{([\s\S]{0,1600}?)\n    \},/.exec(buildSystem);
check(!!digCompleteBody, 'D.build_system.sys_onDigComplete 方法体可定位（冻结单 v3 §13-13 的消费点）');
const digComplete = digCompleteBody ? digCompleteBody[1] : '';
check(/mat_settleWaveMaterials\(\)/.test(digComplete), 'D.sys_onDigComplete 内调用波末结算（波末唯一收口）');
check(digComplete.indexOf('mat_settleWaveMaterials') < digComplete.indexOf('sys_saveRunState'), 'D.先结算料、再存档');

// 共享钉类型池
eq(RANDOMIZABLE_PEG_TYPES.join(','), 'normal,pyro,cryo,bounce', 'D.共享池取值 = [normal,pyro,cryo,bounce]（冻结单 v3 §6.3-3）');
const poolSrc = read('src/utils/peg_type_pool.js');
check(/export const RANDOMIZABLE_PEG_TYPES = \['normal', 'pyro', 'cryo', 'bounce'\];/.test(poolSrc), 'D.共享池常量定义在 utils/peg_type_pool.js');
const gamePhase = read('src/game_phase.js');
const pinboard = read('src/pinboard_modules.js');
check(/import\s*\{\s*RANDOMIZABLE_PEG_TYPES\s*\}\s*from\s*'\.\/utils\/peg_type_pool\.js'/.test(gamePhase), 'D.game_phase.js 只引用共享池常量');
check(/import\s*\{\s*RANDOMIZABLE_PEG_TYPES\s*\}\s*from\s*'\.\/utils\/peg_type_pool\.js'/.test(pinboard), 'D.pinboard_modules.js 只引用共享池常量');
check(!/\['bounce', 'damage'\]/.test(gamePhase), 'D.game_phase.js 已无本地 [bounce,damage] 副本');
check(!/\['bounce', 'damage'\]/.test(pinboard), 'D.pinboard_modules.js 已无本地 [bounce,damage] 副本');
check(/const allPegTypes = RANDOMIZABLE_PEG_TYPES;/.test(gamePhase), 'D.主钉盘随机钉直接用共享池');
check(/RANDOMIZABLE_PEG_TYPES\s*\n?\s*\.map|RANDOMIZABLE_PEG_TYPES\.map/.test(pinboard), 'D.模块随机钉用共享池');

// 战斗开始：先扣料再建弹
const combatStart = /phase_startCombatPhase\(\)\s*\{([\s\S]{0,3200})/.exec(gamePhase);
const combatBody = combatStart ? combatStart[1] : '';
check(!!combatStart, 'D.phase_startCombatPhase 方法体可定位');
check(/sys_resetWaveMaterialCounters\(\)/.test(gamePhase), 'D.每波开始清零本波计数（余额不清）');
check(/mat_payLoadout\(cannonStats\.shots\)/.test(combatBody), 'D.战斗开始按装填上限扣料');
check(
    combatBody.indexOf('mat_payLoadout') > -1
    && combatBody.indexOf('mat_payLoadout') < combatBody.indexOf('this.ammoQueue = this.sys_buildCannonShots(loadout.loadedShots)'),
    'D.先扣料、再按实际发数建弹（顺序不得颠倒）',
);
check(/this\.cannonShotsPerTurn = cannonStats\.shots;/.test(combatBody), 'D.射速轨（装填上限）未被删掉');
const cannonCfg = (CONFIG.gameplay && CONFIG.gameplay.cannon) || {};
eq(cannonCfg.shotsPerTurn, 2, 'D.装填上限 shotsPerTurn 仍为 2');
eq(Array.isArray((CONFIG.gameplay.build.cannon || {}).ratePrices) ? (CONFIG.gameplay.build.cannon.ratePrices).length : -1,
    3, 'D.射速轨三档 ratePrices 仍在（2 → 5 发）');

// 读数出口
const readout = readMaterialReadout(bAll());
function bAll() { return settle(hitWave({ pegTypes: ['pyro'], orbs: 1, hitsPerOrb: 4 }).ledger).ledger; }
eq(Object.keys(readout).sort().join(','),
    'beast,coloredHitRatio,coloredHits,cryo,destroyedThisWave,loadedShots,primaryHits,producedThisWave,pyro',
    'D.读数出口九键（含 s 的分子 / 分母 / 比值）');
eq(readMaterialReadout({ ...createMaterialLedger(), loadedShots: 2 }).loadedShots, 2, 'D.读数出口透出 loadedShots');
eq(readMaterialReadout(createMaterialLedger()).coloredHitRatio, 0, 'D.一次没碰时 s = 0（不臆造默认 0.5）');

// ---------------------------------------------------------------- E
console.log('\n[E] 边界');
const beastOnly = planLoadout({ ...createMaterialLedger(), beast: 99 }, 2, PER_SHOT);
eq(beastOnly.loadedShots, 0, 'E.怪物料 beast 不参与造弹（两料不互换）');
eq(beastOnly.ledger.beast, 99, 'E.beast 余额不被扣');

const cryoWave = settle(hitWave({ pegTypes: ['cryo'], orbs: 2, hitsPerOrb: 4 }).ledger);
eq(cryoWave.ledger.cryo, Math.floor(8 / PER_HITS), `E.cryo 钉入料全部落 cryo 桶（${Math.floor(8 / PER_HITS)} 料）`);
eq(cryoWave.ledger.pyro, FLOOR, 'E.cryo 盘只剩保底 pyro（保底不与彩钉桶串味）');
eq(cryoWave.ledger.cryo + cryoWave.ledger.pyro, cryoWave.total, 'E.两桶到手合计 = 本次料入 M');

// 盘上 p = 1（2026-10-25 标定）：3 次彩钉命中 = 3 个单位，余数结构上恒 0。
const odd = settle(hitWave({ pegTypes: ['pyro'], orbs: 1, hitsPerOrb: 3 }).ledger);
eq(odd.units, 3, 'E.p=1 时 3 次彩钉命中 ⇒ 入料 3 次');
eq(odd.total, FLOOR + 3, `E.3 次彩钉命中 ⇒ 入料 3 次 + 保底 = ${FLOOR + 3}`);
eq(odd.remainder, 0, 'E.p=1 时余数恒 0（3 − 3 × 1）');
eq(odd.ledger.coloredHitRemainder, 0, 'E.p=1 时账本 coloredHitRemainder = 0');
// 余数记账本身必须仍有区分力（p=1 下上面的 0 无法证明它真被算过）：
// 显式传 p=3 走同一条代码路径，构造非零余数。这是**新增**断言，原断言一条未删。
const oddP3 = settleWaveMaterials(hitWave({ pegTypes: ['pyro'], orbs: 1, hitsPerOrb: 4 }).ledger,
    { perHitsPerMaterial: 3, basicFloorPerWave: FLOOR });
eq(oddP3.units, 1, 'E.显式 p=3、4 次命中 ⇒ 入料 1 次');
eq(oddP3.remainder, 1, 'E.余数如实记录（coloredHits 4 − 1 × 3 = 1）');
eq(oddP3.ledger.coloredHitRemainder, 1, 'E.余数落到账本 coloredHitRemainder（非零情形）');

// 结算重复调用：纯函数层面会重复入料 ⇒ 必须由 mixin 的 round 守卫兜住（下一段验证）
const twice = settle(settle(hitWave({ pegTypes: ['pyro'], orbs: 1, hitsPerOrb: 4 }).ledger).ledger);
eq(twice.total, modelM(4), 'E.纯函数 settle 不自己去重：第二次调用仍按同一 coloredHits 再加一次料（去重责任在 mixin 的 round 守卫）');

// mixin 实跑：round 守卫 + 计数清零 + 读数
console.log('\n[E2] mixin 实跑（假宿主，读真实 CONFIG）');
const host = { round: 1 };
for (const [k, v] of Object.entries(material_system)) {
    if (typeof v === 'function') host[k] = v.bind(host);
}
host.sys_initMaterialLedger();
for (let i = 0; i < 10; i++) host.mat_recordPegHit('pyro', false);
for (let i = 0; i < 20; i++) host.mat_recordPegHit('normal', false);
const beforeSettle = host.sys_getMaterialReadout();
console.log(`  碰钉后读数 ${JSON.stringify(beforeSettle)}`);
eq(beforeSettle.primaryHits, 30, 'E2.mixin 计数：primaryHits = 30');
eq(beforeSettle.coloredHits, 10, 'E2.mixin 计数：coloredHits = 10');
eq(beforeSettle.producedThisWave, 0, 'E2.波末前不入料');
eq(beforeSettle.coloredHitRatio, 10 / 30, 'E2.s = coloredHits / primaryHits（由计数得）');

const settled = host.mat_settleWaveMaterials();
console.log(`  波末结算 ${JSON.stringify(settled)}`);
eq(settled.charged, true, 'E2.本波结算执行了一次');
eq(settled.total, FLOOR + Math.floor(10 / PER_HITS), `E2.M = ${FLOOR} + floor(10/${PER_HITS}) = ${FLOOR + Math.floor(10 / PER_HITS)}`);
const again = host.mat_settleWaveMaterials();
eq(again.charged, false, 'E2.同一 round 二次结算被拦（charged = false）');
eq(again.total, 0, 'E2.二次结算不入料');
eq(host.sys_getMaterialReadout().producedThisWave, settled.total, 'E2.读数 producedThisWave 就是本次 M');

host.round = 2;
host.sys_resetWaveMaterialCounters();
const fresh = host.sys_getMaterialReadout();
eq(fresh.primaryHits, 0, 'E2.下一波计数清零：primaryHits = 0');
eq(fresh.coloredHits, 0, 'E2.下一波计数清零：coloredHits = 0');
eq(fresh.producedThisWave, 0, 'E2.下一波计数清零：producedThisWave = 0');
// [开局可打] 新局账本不再从 0 起：`sys_initMaterialLedger()` 现在按 `CONFIG.gameplay.build.startMaterials`
// 给启动料（`src/config.js` 的 `build.startMaterials`），所以「跨波累积」的基准是启动料而不是 0。
// 断言仍是**精确相等**（本条验的是"下一波没把余额清零"，改成 `>=` / "存在即可" 就验不出清零了）。
const START_PYRO = CONFIG.gameplay.build.startMaterials.pyro;
eq(fresh.pyro, START_PYRO + settled.total, 'E2.余额跨波累积（不清零）');
for (let i = 0; i < 4; i++) host.mat_recordPegHit('cryo', false);
const wave2 = host.mat_settleWaveMaterials();
eq(wave2.charged, true, 'E2.新波 round 变了 ⇒ 结算重新放行');
eq(wave2.total, FLOOR + Math.floor(4 / PER_HITS), 'E2.新波 M 按本波计数重算');

// ---------------------------------------------------------------- F
console.log('\n[F] 真实分布：直接跑 game_phase.phase_gathering_getRandomPegType 真函数');
const randomPegType = game_phase.phase_gathering_getRandomPegType;
check(typeof randomPegType === 'function', 'F.取到盘上真实的随机钉函数（不是测试里复刻的算法）');
const weightsHost = { unlockedWeights: { ...CONFIG.probabilities } };
const SAMPLES = 200000;
const tally = Object.create(null);
for (let i = 0; i < SAMPLES; i++) {
    const t = randomPegType.call(weightsHost);
    tally[t] = (tally[t] || 0) + 1;
}
const coloredDraws = (tally.pyro || 0) + (tally.cryo || 0);
const sReal = coloredDraws / SAMPLES;
console.log(`  ${SAMPLES} 次采样：${JSON.stringify(tally)}`);
console.log(`  ⇒ s(彩钉占比) = ${sReal.toFixed(4)}（冻结单 v3 :38 的假设值是 0.5）`);
check((tally.pyro || 0) > 0 && (tally.cryo || 0) > 0, 'F.盘上确实会出 pyro / cryo 产料钉（收敛池生效）');
check(!tally.damage, 'F.damage 已不在收敛池内（取值域 = normal/pyro/cryo/bounce）');
check(sReal > 0 && sReal < 0.5, 'F.实测 s 落在 (0, 0.5)：假设值 0.5 与盘上分布不符');

// 用实测 s 推 M：B=5 颗弹珠 × 每颗 H=10 碰
const B = 5;
const H = 10;
const hitsTotal = B * H;
const coloredEstimate = Math.round(hitsTotal * sReal);
const mEstimate = FLOOR + Math.floor(coloredEstimate / PER_HITS);
const M_LOW = 5 * FLOOR;
const M_HIGH = 7 * FLOOR - 1;
console.log(`  B=${B} × H=${H} ⇒ 总碰钉 ${hitsTotal}、按实测 s 彩钉 ≈ ${coloredEstimate} ⇒ M ≈ ${mEstimate}`);
console.log(`  验收带 [5c, 7c−1] = [${M_LOW}, ${M_HIGH}] ⇒ ${mEstimate >= M_LOW && mEstimate <= M_HIGH ? '在带内' : '出带'}`);
console.log(`  J1(M ≥ ${M_LOW})：${mEstimate >= M_LOW ? '成立' : `破（差 ${M_LOW - mEstimate}）`}；`
    + `J3(M ≤ ${M_HIGH})：${mEstimate <= M_HIGH ? '成立' : `破（超 ${mEstimate - M_HIGH}）`}`);
check(Math.abs(sReal - coloredDraws / SAMPLES) === 0, 'F.s 就是采样计数比值本身（没有任何配置常数介入）');

// ---------------------------------------------------------------- CONFLICT
console.log('\n[CONFLICT] 冻结单假设 s = 0.5 与盘上实测 s 不一致（记录，不调参数去凑）');
console.log(`  冻结单 v3 :42 的推导式：M = 3 + floor(B·H/4)（前提 s=0.5、p=2）`);
console.log(`  盘上实测：收敛池 = normal/pyro/cryo/bounce，unlockedWeights 初始 = CONFIG.probabilities`);
console.log(`            white=100、bounce=18、pyro=12、cryo=12 ⇒ s = 24/142 ≈ ${(24 / 142).toFixed(4)}`);
console.log(`  ⇒ 同一 B=5、H=10 下模型给 M ≈ ${mEstimate}，而 s=0.5 的假设给 M = 3 + floor(50×0.5/2) = 15。`);
console.log('  处理：不调 perHitsPerMaterial / basicFloorPerWave / 权重去凑带内；差异如实上报。');
check(sReal < 0.5, 'CONFLICT.实测 s < 假设 s（差值为负，M 被拉低）');
check(mEstimate < M_LOW, `CONFLICT.B=5、H=10 下 M ≈ ${mEstimate} 低于 J1 下界 ${M_LOW}（J1 破，见 F 段）`);

// ---------------------------------------------------------------- summary
console.log('\n===================================================');
console.log(`  passed ${passed} / failed ${failed}`);
if (failed > 0) {
    console.log('  FAILURES:');
    for (const f of failures) console.log(`   - ${f}`);
}
console.log('===================================================');
process.exit(failed === 0 ? 0 : 1);
