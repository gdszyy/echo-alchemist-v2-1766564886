#!/usr/bin/env node
/**
 * validate_combat_pacing.mjs
 * 波 1–8「所需 vs 可用」整局节奏标定 + Boss 排期/血量包络断言
 *
 * 口径声明（三条，缺一不可）
 * ────────────────────────────────────────────────────────────────
 * 1) 全部数值直接读盘：`import { CONFIG } from '../src/config.js'`，本文件不含任何内联副本。
 *    改了 config 重跑即复算，不需要改本文件。
 * 2) 「所需」= 该波新增敌人总血量；「可用」= 玩家单回合整轮输出。
 *    两者同单位（点血），比值 `turnsNeeded` = 清完本波新增所需的满回合数。
 * 3) 本模型**显式不含**下面这些项，它们在盘上是真的，但本脚本没有建模：
 *    · DDA 自适应（`calc_utils.js:76-85` 会把 difficultyGrowthFactor 降到 0.65）
 *    · peakAvg 血量混合（`spawn_system.js:464-473`，只在有历史伤害时生效）
 *    · 战后高压因子 postBossMultiplier、nextRoundHpMultiplier
 *    · 护盾层数（`spawn_system.js:788` shieldCharges = 1 + round，未计入所需血量）
 *    · 炼成弹（alchemyMagazine 替换主炮）、遗物、词条、分支弹
 *    ⇒ 所以「所需」是**下界偏乐观**的估计（未算护盾与自适应上调），
 *      「可用」是**参考建设剖面**（见 PROFILES），不是实测可达路径。
 *
 * 判定标准（本文件自定义，理由随每条断言写明）
 * ────────────────────────────────────────────────────────────────
 *   · turnsNeeded ≤ 5：一波新增若需超过 5 个满回合才能清完，场上就会持续净增，
 *     任何建设都追不回来 —— 这是「包络外」。
 *   · Boss turnsToKill ∈ [2, 8]：< 2 回合的 Boss 没有威胁（形同过场）；
 *     > 8 回合超出「Boss 波不刷普通怪」（`game_phase.js:2922-2926`）的补偿窗口。
 *   · 单回合整轮输出 ≥ 该波单只怪均值血量：保证一回合至少能推进一只，不会卡死。
 *
 * 用法：node tests/validate_combat_pacing.mjs [--table]
 */

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

import { CONFIG } from '../src/config.js';
import { computeNextBossRound } from '../src/utils/boss_schedule_utils.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');

// ─────────────────────────────────────────────────────────────
// 0. 读盘
// ─────────────────────────────────────────────────────────────
const B = CONFIG.balance || {};
const G = CONFIG.gameplay || {};
const CANNON = G.cannon || {};
const BUILD = G.build || {};
const FAC = BUILD.facilities || {};
const BOSS_F = B.bossHpFormula || {};
const CYCLE = B.waveCycle || {};

const ENEMY_BASE = Number(B.enemyBaseHp);
const ENEMY_PER_ROUND = Number(B.enemyHpPerRound);
const HP_EXP = Number(B.hpExponent);
const SPAWN_PROB = Number(B.spawnProb);
const ENEMY_COLS = Number(G.enemyCols);
const SPAWN_MIN = Number(G.spawnMin);

const BASE_SHOTS = Number(CANNON.shotsPerTurn);
const BASE_DMG = Number(CANNON.damage);
const DMG_PER_LV = Number(BUILD.cannon && BUILD.cannon.damagePerLv);
const RATE_PRICES = (BUILD.cannon && BUILD.cannon.ratePrices) || [];
const DAMAGE_PRICES = (BUILD.cannon && BUILD.cannon.damagePrices) || [];

const TURRET = FAC.turret || {};
const TURRET_DMG = Array.isArray(TURRET.dmg) ? TURRET.dmg : [];
const TURRET_CD = Number(TURRET.cd) || 1;
const TURRET_COST = Number(TURRET.cost) || 0;

const WAVE_FIXED = Number(BOSS_F.waveFixedMult);
const MINI_MULT = Number(BOSS_F.miniBossMult);
const BIG_MULT = Number(BOSS_F.bigBossMult);
const NORMAL_WAVES_PER_BOSS = Number(CYCLE.normalWavesPerBoss);

const WAVES = 8;

/** 该波「无自适应」基线单只敌人血量（对应 spawn_system.js:453-482，peakAvg=0、倍率全 1）。 */
function baseHpOfRound(r) {
    const expFactor = Math.pow(HP_EXP, Math.max(0, r - 5));
    const linear = (ENEMY_BASE + r * ENEMY_PER_ROUND) * expFactor * 1.0;
    return Math.max(1, Math.floor(linear));
}

/** 该波单行「保证生成」敌人数（对应 spawn_system.js:737-740）。 */
function guaranteedPerRow(r) {
    return Math.min(ENEMY_COLS, SPAWN_MIN + Math.floor(r / 4));
}

/** 该波单行敌人数期望：保证数 + 其余空位 × spawnProb（对应 spawn_system.js:766）。 */
function expectedPerRow(r) {
    const m = guaranteedPerRow(r);
    return m + (ENEMY_COLS - m) * SPAWN_PROB;
}

/**
 * 该波新增敌人总血量（下界口径：只算 1 行；上界口径：3 行）。
 * 行数取自 game_phase.js:2932-2933 —— 场上不足 4 行时一次补 3 行，否则补 1 行。
 */
function waveDemand(r, rows) {
    return rows * expectedPerRow(r) * baseHpOfRound(r);
}

/** Boss 血量（对应 spawn_system.js:2566-2579 + :2614；bossCfg.hpMult 取 1，即大 Boss viridis 路径）。 */
function bossHpOfRound(r, isBigBoss) {
    const expFactor = Math.pow(HP_EXP, Math.max(0, r - 5));
    const mult = isBigBoss ? BIG_MULT : MINI_MULT;
    const template = (ENEMY_BASE + r * ENEMY_PER_ROUND) * expFactor * mult;
    return Math.max(1, Math.floor(template * WAVE_FIXED));
}

// ─────────────────────────────────────────────────────────────
// 1. 可用输出剖面
// ─────────────────────────────────────────────────────────────
/**
 * P0「裸装」：不建设、不升级，主炮 A = shotsPerTurn、单发 = cannon.damage。
 * P1「参考建设」：伤害轨 Lv1 + 射速轨 Lv1 + 炮台 Lv1（炮台每回合触发，cd = 1）。
 *    造价：伤害轨 30 + 射速轨 60 + 炮台 40 = 130 ⚡（`config.js:1006-1008` 一带的 prices 数组首项）。
 *    ⚠ [提案] 这不是实测可达路径：本脚本不模拟能源收入，可达性归
 *      `tests/validate_material_economy_balance.mjs` 与建设侧标定，这里只取包络。
 * P2「上限」：射速轨满级 + 伤害轨 Lv1 + 炮台 Lv3。
 */
const PROFILES = [
    {
        id: 'P0',
        name: '裸装',
        shots: BASE_SHOTS,
        dmg: BASE_DMG,
        turretLv: 0,
    },
    {
        id: 'P1',
        name: '参考建设',
        shots: BASE_SHOTS + 1,
        dmg: BASE_DMG + DMG_PER_LV,
        turretLv: 1,
    },
    {
        id: 'P2',
        name: '上限',
        shots: BASE_SHOTS + RATE_PRICES.length,
        dmg: BASE_DMG + DMG_PER_LV,
        turretLv: Math.max(1, TURRET_DMG.length),
    },
];

function turretOutputPerTurn(lv) {
    if (lv <= 0 || TURRET_DMG.length === 0) return 0;
    const dmg = Number(TURRET_DMG[Math.min(lv, TURRET_DMG.length) - 1]) || 0;
    return dmg / TURRET_CD;
}

function outputPerTurn(p) {
    return p.shots * p.dmg + turretOutputPerTurn(p.turretLv);
}

const P = Object.fromEntries(PROFILES.map(p => [p.id, p]));

// ─────────────────────────────────────────────────────────────
// 2. 表
// ─────────────────────────────────────────────────────────────
function pad(s, n) {
    s = String(s);
    const w = [...s].reduce((a, ch) => a + (ch.charCodeAt(0) > 127 ? 2 : 1), 0);
    return s + ' '.repeat(Math.max(0, n - w));
}

function buildRows() {
    const bossRounds = new Set();
    // 首次排期从 0 起算（`spawn_system.js:2479-2480`）
    let next = computeNextBossRound(0, NORMAL_WAVES_PER_BOSS);
    for (let i = 1; i <= WAVES + 4; i++) {
        if (next !== null && next !== undefined && i >= next) {
            bossRounds.add(i);
            next = computeNextBossRound(i, NORMAL_WAVES_PER_BOSS);
        }
    }

    const rows = [];
    for (let r = 1; r <= WAVES; r++) {
        const hp = baseHpOfRound(r);
        const demandLo = waveDemand(r, 1);
        const demandHi = waveDemand(r, 3);
        const isBoss = bossRounds.has(r);
        const row = { r, hp, minHp: Math.floor(hp * 0.8), maxHp: Math.floor(hp * 1.2), perRow: expectedPerRow(r), demandLo, demandHi, isBoss };
        for (const p of PROFILES) {
            const out = outputPerTurn(p);
            row[`out_${p.id}`] = out;
            row[`turns_${p.id}`] = demandLo / out;
            row[`shotsToKill_${p.id}`] = Math.ceil(hp / p.dmg);
        }
        if (isBoss) {
            const bossIdx = [...bossRounds].filter(x => x <= r).length;
            const isBig = (bossIdx - 1) >= 4;
            row.bossHp = bossHpOfRound(r, isBig);
            row.bossKind = isBig ? '大BOSS' : 'Mini';
            for (const p of PROFILES) {
                row[`bossTurns_${p.id}`] = bossHpOfRound(r, isBig) / outputPerTurn(p);
            }
        }
        rows.push(row);
    }
    return rows;
}

function printTable(rows) {
    console.log('');
    console.log('波次节奏包络 —— 波 1–8（所需 = 本波新增敌人总血；可用 = 单回合整轮输出）');
    console.log(`盘上参数：base=${ENEMY_BASE} perRound=${ENEMY_PER_ROUND} exp=${HP_EXP} cols=${ENEMY_COLS} spawnMin=${SPAWN_MIN} spawnProb=${SPAWN_PROB} A=${BASE_SHOTS} dmg=${BASE_DMG} dmgPerLv=${DMG_PER_LV} waveFixed=${WAVE_FIXED} mini=${MINI_MULT} big=${BIG_MULT} cycle=${NORMAL_WAVES_PER_BOSS}`);
    console.log(`剖面：P0 裸装 = ${P0out()}；P1 参考建设 = ${outputPerTurn(P.P1)}（${P.P1.shots}发×${P.P1.dmg} + 炮台Lv1 ${turretOutputPerTurn(1)}）；P2 上限 = ${outputPerTurn(P.P2)}`);
    console.log('');

    const head = [
        pad('波', 4), pad('Boss', 6), pad('单只血', 10), pad('单行期望', 9),
        pad('所需(1行)', 11), pad('所需(3行)', 11),
        pad('可用P1', 8), pad('turnsP1', 9), pad('发/只P1', 9),
        pad('turnsP0', 9), pad('Boss血', 9), pad('Boss回合P1', 12),
    ].join('');
    console.log(head);
    console.log('-'.repeat([...head].reduce((a, ch) => a + (ch.charCodeAt(0) > 127 ? 2 : 1), 0)));

    for (const x of rows) {
        console.log([
            pad(x.r, 4),
            pad(x.isBoss ? x.bossKind : '-', 6),
            pad(`${x.minHp}–${x.maxHp}`, 10),
            pad(x.perRow.toFixed(2), 9),
            pad(x.demandLo.toFixed(0), 11),
            pad(x.demandHi.toFixed(0), 11),
            pad(x.out_P1.toFixed(0), 8),
            pad(x.turns_P1.toFixed(2), 9),
            pad(x.shotsToKill_P1, 9),
            pad(x.turns_P0.toFixed(2), 9),
            pad(x.isBoss ? x.bossHp : '-', 9),
            pad(x.isBoss ? x.bossTurns_P1.toFixed(1) : '-', 12),
        ].join(''));
    }
    console.log('');
}

function P0out() {
    return outputPerTurn(P.P0);
}

// ─────────────────────────────────────────────────────────────
// 3. 断言
// ─────────────────────────────────────────────────────────────
let pass = 0;
let fail = 0;
const failures = [];

function check(ok, label, detail) {
    if (ok) {
        pass++;
        console.log(`  ✅ ${label}${detail ? ' :: ' + detail : ''}`);
    } else {
        fail++;
        failures.push(label);
        console.log(`  ❌ ${label}${detail ? ' :: ' + detail : ''}`);
    }
}

const rows = buildRows();
const wantTable = process.argv.includes('--table');

if (wantTable) printTable(rows);

console.log('');
console.log('【A】前期可打性');
// A1：最软的小怪一发即死 —— 否则第一波就出现「打半天打不掉一只」
const w1 = rows[0];
check(P.P0.dmg >= w1.minHp,
    'A1 主炮单发 ≥ 第 1 波最软小怪血量（一发即死）',
    `${P.P0.dmg} ≥ ${w1.minHp}（单只 ${w1.minHp}–${w1.maxHp}）`);

// A2：裸装在第 1–4 波不出包络（不建设也必须能推进）
for (const x of rows.filter(x => x.r <= 4)) {
    check(x.turns_P0 <= 5,
        `A2 裸装 P0 波 ${x.r} 清完新增所需 ≤ 5 回合`,
        `${x.turns_P0.toFixed(2)} 回合（所需 ${x.demandLo.toFixed(0)} / 可用 ${x.out_P0}）`);
}

console.log('');
console.log('【B】包络（参考建设 P1，波 1–8）');
for (const x of rows) {
    check(x.turns_P1 <= 5,
        `B1 P1 波 ${x.r} turnsNeeded ≤ 5`,
        `${x.turns_P1.toFixed(2)} 回合（所需 ${x.demandLo.toFixed(0)} / 可用 ${x.out_P1}）`);
}

console.log('');
console.log('【C】不卡死（参考建设 P1，波 1–8）');
for (const x of rows) {
    check(x.out_P1 >= x.hp,
        `C1 P1 波 ${x.r} 单回合整轮输出 ≥ 单只怪均值血量`,
        `${x.out_P1} ≥ ${x.hp}`);
    check(x.shotsToKill_P1 <= 5,
        `C2 P1 波 ${x.r} 单只怪 ≤ 5 发打死`,
        `${x.shotsToKill_P1} 发（单只 ${x.hp} / 单发 ${P.P1.dmg}）`);
}

console.log('');
console.log('【D】Boss 排期与血量包络');
const bossRows = rows.filter(x => x.isBoss);
const nonBossEarly = rows.filter(x => x.r <= 3 && x.isBoss);
check(nonBossEarly.length === 0,
    'D1 第 1–3 波无 Boss（cycle = 3 个普通波后进 Boss）',
    nonBossEarly.length === 0 ? '波 1–3 全为普通波' : `意外 Boss 波：${nonBossEarly.map(x => x.r).join(',')}`);
check(bossRows.length >= 2 && bossRows[0].r === 4 && bossRows[1].r === 8,
    'D2 Boss 波落在 4 / 8',
    bossRows.map(x => `R${x.r}(${x.bossKind} ${x.bossHp})`).join(' '));

for (const x of bossRows) {
    check(x.bossTurns_P1 >= 2 && x.bossTurns_P1 <= 8,
        `D3 P1 波 ${x.r} ${x.bossKind} 击杀回合 ∈ [2,8]`,
        `${x.bossTurns_P1.toFixed(1)} 回合（Boss ${x.bossHp} / 可用 ${x.out_P1}）`);
}

// D4：教程分支的回合替换必须已移除 —— 这是 925 那条缺陷的直接回归守卫
console.log('');
console.log('【E】925 缺陷回归守卫');
const spawnSrc = readFileSync(resolve(ROOT, 'src/spawn_system.js'), 'utf8');
// 只看代码，不看注释：注释里会引用旧写法做说明，直接全文匹配会把注释也算成命中。
const codeLines = spawnSrc.split(/\r?\n/).map((line, i) => ({
    n: i + 1,
    code: line.replace(/\/\/.*$/, ''),
}));
const tutorialR10Hits = codeLines.filter(l => /_isTutorialRun\s*\?\s*10\s*:/.test(l.code));
check(tutorialR10Hits.length === 0,
    'E1 代码（去注释后）不再存在「教程局把回合替换成 10」的写法',
    tutorialR10Hits.length === 0
        ? '未命中'
        : `仍命中 ${tutorialR10Hits.length} 处：行 ${tutorialR10Hits.map(l => l.n).join(', ')}`);

// E2：按第 2 波实际回合算出的 Boss 血量，与「按第 10 波算」的比值 —— 记录缺陷量级
const leakedHp = Math.max(1, Math.floor((ENEMY_BASE + 10 * ENEMY_PER_ROUND) * Math.pow(HP_EXP, 5) * BIG_MULT * WAVE_FIXED));
const actualHp = bossHpOfRound(2, true);
check(actualHp < leakedHp,
    'E2 第 2 波按实际回合算的 Boss 血量 ＜ 按第 10 波算的',
    `实际 ${actualHp} vs 泄漏 ${leakedHp}（差 ${(leakedHp / actualHp).toFixed(1)}×）`);

// ─────────────────────────────────────────────────────────────
// 【F】教程局旗标：tutorial_end() 必须清掉 _isTutorialRun
// ─────────────────────────────────────────────────────────────
// 缺陷：`_isTutorialRun` 是「本局算不算教程局」的总开关（Boss 排期 / 教程专属钉子 /
//      弹珠权重 / 跳过钉板编辑 共 7 类读取点）。它原先只在 sys_resetGame（新开一局）清除，
//      于是「跳过教程」之后整局仍被判为教程局 ⇒ 第 2 波被强制排入一只大 Boss。
// 判据：读盘源码做静态检查（不另抄逻辑、不 mock）。
console.log('');
console.log('【F】教程旗标清理（tutorial_end 必须清 _isTutorialRun）');

/**
 * 去掉行注释，但**保持字符数与下标不变**（注释替换成等长空格）。
 * 否则 `// 里写着 _isTutorialRun ? 10 :` 这类说明会被当成代码命中 —— 这正是本组断言
 * 上一版踩过的坑。
 */
function stripLineComments(text) {
    return text.replace(/\/\/.*$/gm, (m) => ' '.repeat(m.length));
}

/**
 * 取 `name` 方法的函数体（不含签名行与末尾闭合花括号）。
 * 锚定「行首只有空白 + name(」，避免命中 `this.tutorial_end(...)` 这类调用点。
 * 命中数不为 1 或花括号不配平一律抛错 —— 让断言红在「取不到方法体」，
 * 而不是静默取到空串后恒真。
 */
function extractMethodBody(src, name) {
    const re = new RegExp('^[ \\t]*' + name + '\\s*\\(', 'gm');
    const hits = [...src.matchAll(re)];
    if (hits.length !== 1) throw new Error(`方法定义 ${name} 期望命中 1 处，实际 ${hits.length} 处`);
    const open = src.indexOf('{', hits[0].index);
    if (open < 0) throw new Error(`方法定义 ${name} 未找到方法体起始花括号`);
    let depth = 0;
    for (let i = open; i < src.length; i++) {
        if (src[i] === '{') depth++;
        else if (src[i] === '}') {
            depth--;
            if (depth === 0) return src.slice(open + 1, i);
        }
    }
    throw new Error(`方法定义 ${name} 花括号未闭合`);
}

const tutSrc = readFileSync(resolve(ROOT, 'src/tutorial_system.js'), 'utf8');
const tutEndBodyRaw = extractMethodBody(tutSrc, 'tutorial_end');
const tutEndBodyCode = extractMethodBody(stripLineComments(tutSrc), 'tutorial_end');

// F1：函数体内必须真的执行 `this._isTutorialRun = false;`（去注释后才匹配）
const clearHits = [...tutEndBodyCode.matchAll(/this\._isTutorialRun\s*=\s*false\s*;/g)];
check(clearHits.length >= 1,
    'F1 tutorial_end 函数体（去注释后）清除 _isTutorialRun',
    clearHits.length >= 1
        ? `命中 ${clearHits.length} 处赋值（函数体 ${tutEndBodyCode.length} 字符）`
        : '未命中：tutorial_end 未清除 _isTutorialRun，跳过教程后整局仍被判为教程局');

// F2：那句「不在此处清除」的旧注释不得再存在（防止注释与代码再次背离）
const staleComment = /不在此处清除/.test(tutEndBodyRaw);
check(!staleComment,
    'F2 tutorial_end 不再保留「_isTutorialRun 不在此处清除」的旧注释',
    staleComment ? '旧注释仍在，与代码已背离' : '旧注释已移除');

// F3：全仓回归守卫 —— 教程局把回合替换成 10 的写法不得重现
const TUT_ROUND10 = /_isTutorialRun\s*\?\s*10\s*:/;
const detectorOk =
    TUT_ROUND10.test('const r = this._isTutorialRun ? 10 : this.round;') &&
    !TUT_ROUND10.test(stripLineComments('// 旧写法：this._isTutorialRun ? 10 : this.round'));
check(detectorOk,
    'F3a 探测器自检：能命中真写法、不命中注释里的同款字样',
    detectorOk ? '正向命中 / 注释不误报' : '探测器本身失效（自检未通过）');

const srcRoot = resolve(ROOT, 'src');
const jsFiles = [];
(function walk(dir) {
    for (const name of readdirSync(dir)) {
        const p = resolve(dir, name);
        if (statSync(p).isDirectory()) walk(p);
        else if (name.endsWith('.js')) jsFiles.push(p);
    }
})(srcRoot);

const round10Hits = [];
for (const file of jsFiles) {
    const lines = stripLineComments(readFileSync(file, 'utf8')).split(/\r?\n/);
    lines.forEach((line, i) => {
        if (TUT_ROUND10.test(line)) round10Hits.push(`${file.slice(srcRoot.length + 1)}:${i + 1}`);
    });
}
check(round10Hits.length === 0,
    'F3b 全仓 src/**/*.js（去注释后）不存在「_isTutorialRun ? 10 :」写法',
    round10Hits.length === 0
        ? `扫描 ${jsFiles.length} 个文件，未命中`
        : `仍命中 ${round10Hits.length} 处：${round10Hits.join(', ')}`);

// ─────────────────────────────────────────────────────────────
// 4. 汇总
// ─────────────────────────────────────────────────────────────
if (wantTable) printTable(rows);

console.log('');
console.log('─'.repeat(64));
console.log(`合计：通过 ${pass} / 失败 ${fail}`);
if (fail > 0) {
    console.log('失败项：');
    failures.forEach(f => console.log('  · ' + f));
}
console.log('─'.repeat(64));

process.exit(fail > 0 ? 1 : 0);
