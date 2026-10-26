/**
 * validate_build_loop_s2.mjs - [REQ-20261022-wave-loop S2] 整备阶段：纯函数 + §9 确定性推演 + 静态契约。
 *
 * 覆盖：价格 / 购买（不可变更新与拒绝原因）、逐波解锁、主炮数值、设施冷却节奏、收集器；
 *       §9 纸面推演玩家 A / B（测试夹具数值，不是平衡）；挖 → 整备 → 开战接线、设施 / 道具 / 存档字段的静态检查。
 * [2026-10-26] 「炼成弹珠 / 炼成弹匣 / 满匣单选卡」机制下线（Owner 裁定），本文件原「满匣处理」4 条断言一并删除：
 *   其中 3 条测的是已删除的纯函数 `resolveMagazineOverflow`；另 1 条测的是已删除的换炼成弹入口。
 *   开战不能再被满匣阻塞 ⇒ 原「满匣未处理时阻止开战」那条改为只断言「记 `_buildCommittedRound` 后进入战斗」。
 *
 * Usage:
 *   node tests/validate_build_loop_s2.mjs
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
    computeCannonStats,
    getCollectorPayout,
    getPrice,
    getReveal,
    isActionRevealed,
    normalizeBuildState,
    tickFacilities,
    tryPurchase,
} from '../src/utils/build_economy_utils.js';

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

console.log('===================================================');
console.log('  Build loop S2 validation');
console.log('===================================================\n');

// 夹具：与 src/config.js CONFIG.gameplay.build 保持一致（下方另有静态检查锁定 config 数值）。
const CFG = {
    cannon: { damagePerLv: 4, damagePrices: [30, 30, 45, 60, 80], ratePrices: [60, 90, 130], bouncePrices: [25, 40, 60], branchCrystal: 1, branches: ['pierce', 'scatter', 'fire', 'ice', 'lightning'] },
    slots: { total: 3, openAtStart: 1, openCrystal: 2 },
    facilities: {
        turret: { cost: 40, upCost: [40, 40], cd: 1, dmg: [6, 9, 13] },
        lightning: { cost: 50, upCost: [50, 50], cd: 2, dmg: 7, targets: [3, 4, 5] },
        frost: { cost: 50, upCost: [50, 50], cd: 3, count: [1, 2, 3] },
        shieldGen: { cost: 45, upCost: [45, 45], cd: 2, cap: [3, 4, 5] },
        collector: { cost: 60, upCost: [60, 60], perDig: [8, 12, 16], unique: true },
        lv3Crystal: 1,
    },
    items: { slots: 2, bomb: { cost: 20, dmg: 30, radius: 100 }, timestop: { cost: 30 }, shield: { cost: 25, amount: 2 }, extraDig: { cost: 20, collectors: 2 } },
    mining: { collector: { prices: [50, 90, 140] } },
    reveal: {
        // 第 1 波连同料付设施一起开：与 `src/config.js:1174` 逐字一致
        // （原注释：「第 1 波就能看见料付设施（当波买不起，第 2 波凑够）」）。
        1: ['dmg', 'workshop', 'generator'],
        2: ['rate', 'bounce', 'slots', 'turret', 'shieldGen'],
        3: ['crystal', 'items', 'bomb', 'shield', 'mining'],
        boss1: ['branch', 'lightning', 'frost', 'collector', 'timestop', 'extraDig'],
    },
};
const BASE = { baseShots: 2, baseDamage: 10, damageBonus: 0, baseBounce: 2, damagePerLv: 4 };
const stats = s => computeCannonStats(s.cannonLevels, BASE);
const reveal = (wave, bossKills = 0) => getReveal({ wave, bossKills }, CFG);
const buy = (s, action, r) => tryPurchase(s, action, CFG, r);

// ---------- 逐波解锁 ----------
{
    const r1 = reveal(1);
    check(r1.has('dmg') && !r1.has('rate') && !r1.has('turret'), '解锁：第 1 波开伤害轨（射速 / 弹道 / 炮台仍锁）');
    // 第 1 波整备屏（digCount = 1）：`build` 动作只认设施自己的键，不再连带要求 'slots'。
    // 依据 `src/config.js:1174`：「第 1 波就能看见料付设施（当波买不起，第 2 波凑够）」——
    // 表里列了 workshop / generator，若 `build` 还要 'slots'（第 2 波才开）这两个键就永远解不开任何东西。
    check(isActionRevealed({ type: 'build', facility: 'workshop' }, r1) === true,
        '解锁：第 1 波 build/workshop 已解锁（不再依赖 slots）');
    check(isActionRevealed({ type: 'build', facility: 'generator' }, r1) === true,
        '解锁：第 1 波 build/generator 已解锁（不再依赖 slots）');
    check(isActionRevealed({ type: 'build', facility: 'turret' }, r1) === false,
        '解锁：第 1 波 build/turret 仍锁（turret 在 reveal[2]，防把闸门拆成全放开）');
    // 格位级动作仍从第 2 波起：`slots` 管的是「开位 / 升级」，不是「能不能盖某座设施」
    check(isActionRevealed({ type: 'slot' }, r1) === false, '解锁：第 1 波 slot（开位）仍锁');
    check(isActionRevealed({ type: 'upgrade', slot: 0 }, r1) === false, '解锁：第 1 波 upgrade 仍锁（升级从第 2 波起）');
    const r2 = reveal(2);
    check(r2.has('dmg') && r2.has('rate') && r2.has('bounce') && r2.has('turret') && r2.has('shieldGen') && !r2.has('items'), '解锁：第 2 波开射速 / 弹道 / 设施位 / 炮台 / 结界发生器（累计）');
    const r3 = reveal(3);
    check(r3.has('items') && r3.has('bomb') && r3.has('shield') && r3.has('mining') && !r3.has('timestop') && !r3.has('branch'), '解锁：第 3 波开道具 / 炸弹 / 急救结界 / 挖矿；时停与分支仍锁');
    const rb = reveal(4, 1);
    check(rb.has('branch') && rb.has('lightning') && rb.has('frost') && rb.has('collector') && rb.has('timestop') && rb.has('extraDig'), '解锁：击败第 1 个 Boss 后开分支 / 其余设施 / 其余道具');
    check(!reveal(9, 0).has('branch'), '解锁：分支只看 Boss 击杀，不看波数');
}

// ---------- 主炮数值 ----------
{
    const s0 = computeCannonStats({ dmg: 0, rate: 0, bounce: 0 }, BASE);
    check(s0.shots === 2 && s0.damage === 10 && s0.bounce === 2, '主炮：开局 2 发 × 10，反弹 2');
    const s1 = computeCannonStats({ dmg: 2, rate: 3, bounce: 1 }, { ...BASE, damageBonus: 1 });
    check(s1.shots === 5 && s1.damage === 10 + 1 + 8 && s1.bounce === 3, '主炮：射速 +3 → 5 发；伤害 = 10 + (baseDamage-1) + 4×级；弹道 +1');
}

// ---------- §9 纸面推演：玩家 A ----------
{
    let A = normalizeBuildState({ energy: 0, crystal: 0 }, CFG);
    // W1：+52⚡；只开伤害轨
    A = { ...A, energy: A.energy + 52 };
    const rateW1 = buy(A, { type: 'cannon', track: 'rate' }, reveal(1));
    check(!rateW1.ok && rateW1.reason === 'locked', '§9 W1：射速轨未解锁 → locked');
    const w1 = buy(A, { type: 'cannon', track: 'dmg' }, reveal(1));
    check(w1.ok && w1.state.energy === 22 && stats(w1.state).damage === 14, '§9 W1：伤害 +1（30）→ 单发 14，余 22⚡');
    check(A.energy === 52 && A.cannonLevels.dmg === 0, '购买是不可变更新：原状态不变');
    A = w1.state;
    // W2：+48 → 70；可比选项：炮台 40 + 弹道 25 = 65 也买得起
    A = { ...A, energy: A.energy + 48 };
    check(A.energy === 70, '§9 W2：余 22 + 48 = 70⚡');
    {
        const alt1 = buy(A, { type: 'build', slot: 0, facility: 'turret' }, reveal(2));
        const alt2 = alt1.ok ? buy(alt1.state, { type: 'cannon', track: 'bounce' }, reveal(2)) : { ok: false };
        check(alt1.ok && alt2.ok && alt2.state.energy === 5, '§9 W2 可比选项：炮台 40 + 弹道 25 = 65，买得起（余 5）');
    }
    const w2 = buy(A, { type: 'cannon', track: 'rate' }, reveal(2));
    check(w2.ok && w2.state.energy === 10 && stats(w2.state).shots === 3, '§9 W2：射速 +1（60）→ 3 发，余 10⚡');
    A = w2.state;
    // W3：+46，晶脉 +1💎；买结界发生器
    A = { ...A, energy: A.energy + 46, crystal: A.crystal + 1 };
    const w3 = buy(A, { type: 'build', slot: 0, facility: 'shieldGen' }, reveal(3));
    check(w3.ok && w3.state.energy === 11 && w3.state.crystal === 1, '§9 W3：结界发生器（45）→ 余 11⚡ 1💎');
    check(w3.ok && w3.state.facilities[0] && w3.state.facilities[0].cd === 0 && w3.state.facilities[0].level === 1, '§9 W3：新建设施冷却从就绪开始（cd 0）');
    A = w3.state;
    // W4（Boss 波，只挖一次）：+50 → 61；伤害 +1（第 2 级 30）
    A = { ...A, energy: A.energy + 50 };
    const w4 = buy(A, { type: 'cannon', track: 'dmg' }, reveal(4));
    check(w4.ok && w4.state.energy === 31 && stats(w4.state).damage === 18, '§9 W4：伤害 +1（30）→ 单发 18，余 31⚡');
    A = w4.state;
    // Boss 击杀 +3💎：分支 1💎 → 火；开第 2 设施位 2💎
    A = { ...A, crystal: A.crystal + 3 };
    const branchBefore = buy(A, { type: 'branch', branch: 'fire' }, reveal(4, 0));
    check(!branchBefore.ok && branchBefore.reason === 'locked', '分支：击败 Boss 前锁定');
    const br = buy(A, { type: 'branch', branch: 'fire' }, reveal(4, 1));
    check(br.ok && br.state.cannonBranch === 'fire' && br.state.crystal === 3, '§9 Boss 后：分支·火（1💎）');
    const br2 = buy(br.state, { type: 'branch', branch: 'ice' }, reveal(4, 1));
    check(!br2.ok && br2.reason === 'branch_set', '分支：选定后不可更换');
    const slot = buy(br.state, { type: 'slot' }, reveal(4, 1));
    check(slot.ok && slot.state.facilitySlotsOpen === 2 && slot.state.energy === 31 && slot.state.crystal === 1, '§9 Boss 后：开第 2 设施位（2💎）→ 余 31⚡ 1💎');
}

// ---------- §9 对照玩家 B：第 3 波投资 +1 采集弹珠 ----------
{
    let B = normalizeBuildState({ energy: 52 }, CFG);
    B = buy(B, { type: 'cannon', track: 'dmg' }, reveal(1)).state;
    B = { ...B, energy: B.energy + 48 };
    B = buy(B, { type: 'cannon', track: 'rate' }, reveal(2)).state;
    B = { ...B, energy: B.energy + 46 };
    const b3 = buy(B, { type: 'mining', key: 'collector' }, reveal(3));
    check(b3.ok && b3.state.energy === 6 && b3.state.miningLevels.collector === 1, '§9 B W3：+1 采集弹珠（50）→ 余 6⚡');
    const collectors = 5 + b3.state.miningLevels.collector;
    check(collectors === 6, '§9 B W4：采集弹珠 6 颗');
    check(b3.state.energy + 59 === 65, '§9 B W4：挖到 59 → 65⚡（对 A 的 61 + 结界）');
    check(getPrice(b3.state, { type: 'mining', key: 'collector' }, CFG).energy === 90, '挖矿升级价格递增 50 / 90 / 140');
}

// ---------- 设施冷却 ----------
{
    let fac = [{ type: 'shieldGen', level: 1, cd: 0 }, { type: 'turret', level: 1, cd: 0 }, { type: 'collector', level: 1, cd: 0 }];
    const fired = { shieldGen: [], turret: [], collector: [] };
    for (let round = 1; round <= 6; round++) {
        const r = tickFacilities(fac, CFG);
        r.triggers.forEach(t => fired[t.type].push(round));
        fac = r.facilities;
    }
    check(fired.shieldGen.join(',') === '1,3,5', '结界发生器（冷却 2）：第 1、3、5 回合触发');
    check(fired.turret.join(',') === '1,2,3,4,5,6', '炮台（冷却 1）：每回合触发');
    check(fired.collector.length === 0, '收集器按挖掘结算，不参与回合冷却');
    const frost = [];
    let ff = [{ type: 'frost', level: 1, cd: 0 }];
    for (let round = 1; round <= 7; round++) {
        const r = tickFacilities(ff, CFG);
        if (r.triggers.length) frost.push(round);
        ff = r.facilities;
    }
    check(frost.join(',') === '1,4,7', '冰霜塔（冷却 3）：第 1、4、7 回合触发');
    const t = tickFacilities([{ type: 'turret', level: 3, cd: 0 }, null], CFG);
    check(t.triggers[0].stats.dmg === 13 && t.facilities[1] === null, '设施数值随自身等级（炮台 Lv3 = 13）');
    check(getCollectorPayout([{ type: 'collector', level: 2, cd: 0 }, null], CFG) === 12, '收集器 Lv2：每次挖掘 +12⚡');
}

// ---------- 拒绝原因 ----------
{
    const r = reveal(4, 1);
    let s = normalizeBuildState({ energy: 1000, crystal: 0 }, CFG);
    s = buy(s, { type: 'build', slot: 0, facility: 'turret' }, r).state;
    s = buy(s, { type: 'upgrade', slot: 0 }, r).state;
    check(s.facilities[0].level === 2 && s.energy === 920, '设施升级 Lv2（40⚡）');
    const lv3 = buy(s, { type: 'upgrade', slot: 0 }, r);
    check(!lv3.ok && lv3.reason === 'crystal', '设施 Lv3 无 💎 → 拒绝');
    const lv3ok = buy({ ...s, crystal: 1 }, { type: 'upgrade', slot: 0 }, r);
    check(lv3ok.ok && lv3ok.state.facilities[0].level === 3 && lv3ok.state.crystal === 0, '设施 Lv3：40⚡ + 1💎');
    check(!buy(lv3ok.state, { type: 'upgrade', slot: 0 }, r).ok, '设施 Lv3 为上限');
    const closed = buy(s, { type: 'build', slot: 1, facility: 'frost' }, r);
    check(!closed.ok && closed.reason === 'slot_closed', '未开放的设施位不能建造');
    const full = buy(s, { type: 'build', slot: 0, facility: 'frost' }, r);
    check(!full.ok && full.reason === 'slot_full', '已占用的设施位不能再建');
    let c = normalizeBuildState({ energy: 1000, crystal: 10 }, CFG);
    c = buy(c, { type: 'slot' }, r).state;
    c = buy(c, { type: 'slot' }, r).state;
    check(c.facilitySlotsOpen === 3 && c.crystal === 6, '设施位：开到 3 个（各 2💎）');
    const fourth = buy(c, { type: 'slot' }, r);
    check(!fourth.ok && fourth.reason === 'maxed', '第 4 个设施位 → 拒绝');
    c = buy(c, { type: 'build', slot: 0, facility: 'collector' }, r).state;
    const second = buy(c, { type: 'build', slot: 1, facility: 'collector' }, r);
    check(!second.ok && second.reason === 'unique', '第 2 座收集器 → 拒绝（全局 1 座）');
    const poor = buy(normalizeBuildState({ energy: 10 }, CFG), { type: 'cannon', track: 'dmg' }, reveal(1));
    check(!poor.ok && poor.reason === 'energy', '能量不足 → 拒绝');
    let it = normalizeBuildState({ energy: 100 }, CFG);
    it = buy(it, { type: 'item', item: 'bomb' }, reveal(3)).state;
    it = buy(it, { type: 'item', item: 'shield' }, reveal(3)).state;
    check(it.items.join(',') === 'bomb,shield' && it.energy === 55, '道具：炸弹 20 + 急救结界 25');
    const third = buy(it, { type: 'item', item: 'bomb' }, reveal(3));
    check(!third.ok && third.reason === 'items_full', '道具位只有 2 个');
    const ts = buy(normalizeBuildState({ energy: 100 }, CFG), { type: 'item', item: 'timestop' }, reveal(3));
    check(!ts.ok && ts.reason === 'locked', '时停在 Boss 前锁定');
    let rate = normalizeBuildState({ energy: 1000 }, CFG);
    for (let i = 0; i < 3; i++) rate = buy(rate, { type: 'cannon', track: 'rate' }, r).state;
    check(stats(rate).shots === 5 && buy(rate, { type: 'cannon', track: 'rate' }, r).reason === 'maxed', '射速轨上限 5 发');
    check(3 * CFG.items.shield.cost > CFG.facilities.shieldGen.cost, '§5.4：连续买 3 次急救结界比建一座结界发生器贵');
}

// ---------- 静态契约 ----------
const config = read('src/config.js');
const gamePhase = read('src/game_phase.js');
const gameSystem = read('src/game_system.js');
const combatSystem = read('src/combat_system.js');
const core = read('src/core.js');
const buildSystem = read('src/build_system.js');
const indexHtml = read('index.html');
const tutorial = read('src/tutorial_system.js');
const uiSystem = read('src/ui_system.js');

check(/build:\s*\{[\s\S]{0,600}damagePrices:\s*\[30,\s*30,\s*45,\s*60,\s*80\][\s\S]{0,200}ratePrices:\s*\[60,\s*90,\s*130\][\s\S]{0,200}bouncePrices:\s*\[25,\s*40,\s*60\]/.test(config), 'config：主炮三轨价格夹具');
check(/shieldGen:\s*\{\s*cost:\s*45,\s*upCost:\s*\[45,\s*45\],\s*cd:\s*2,\s*cap:\s*\[3,\s*4,\s*5\]\s*\}/.test(config) && /collector:\s*\{\s*cost:\s*60[\s\S]{0,80}unique:\s*true/.test(config), 'config：设施夹具（结界发生器 / 收集器唯一）');
check(/mining:\s*\{\s*collector:\s*\{\s*prices:\s*\[50,\s*90,\s*140\]/.test(config), 'config：挖矿升级价格');
check(/import\s*\{\s*build_system\s*\}\s*from\s*['"]\.\/build_system\.js['"]/.test(core) && /_subsystems\s*=\s*\[[\s\S]{0,400}build_system/.test(core), 'core：build_system 注册进 _subsystems');
check(/build_screen_system/.test(core) && /defend_hud_system/.test(core), 'core：整备界面与守卫 HUD mixin 已注册');
check(/digCount\s*=\s*\(this\.digCount\s*\|\|\s*0\)\s*\+\s*1[\s\S]{0,400}sys_startBuildPhase\(\)/.test(buildSystem), '挖掘结束：digCount++ → 收集器付款 → 进入整备');
check(/digState\.completed\s*=\s*true[\s\S]{0,600}sys_onDigComplete\(\)/.test(gamePhase) && !/digState\.completed\s*=\s*true[\s\S]{0,500}setTimeout\(\(\)\s*=>\s*this\.phase_startCombatPhase\(\),\s*500\)/.test(gamePhase), '挖掘结束不再直接开战，改进整备');
check(/sys_startBuildPhase\s*\(\)\s*\{[\s\S]{0,800}phase_switchPhase\(['"]build['"]\)/.test(buildSystem), '整备：切到 build 阶段');
check(/sys_commitBuild\s*\(\)\s*\{[\s\S]{0,600}_buildCommittedRound\s*=\s*this\.round[\s\S]{0,600}phase_startCombatPhase\(\)/.test(buildSystem), '开战：记 _buildCommittedRound 后进入战斗（满匣前置阻塞已随炼成弹匣下线）');
check(/needsAuto\s*=\s*\[[^\]]*['"]build['"]/.test(uiSystem), 'ui_updateUI：build 阶段面板可交互');
check(/id=["']phase-build["'][^>]*class=["'][^"']*ui-overlay/.test(indexHtml) && /id=["']build-fight-btn["']/.test(indexHtml), 'index：#phase-build 覆盖层与开战按钮');
check(/src\/styles\/ui_tokens\.css/.test(indexHtml) && /src\/styles\/ui_components\.css/.test(indexHtml), 'index：链接 UI 令牌与组件样式');
check(/phase_startCombatPhase\s*\(\)\s*\{[\s\S]{0,2600}sys_getCannonStats\(\)/.test(gamePhase), '开战：主炮弹药按 sys_getCannonStats 生成');
check(/phase_enemy_startLogic\s*\(\)\s*\{[\s\S]{0,1200}sys_triggerFacilities\(\)[\s\S]{0,500}this\.isEnemyTurn\s*=\s*true/.test(gamePhase), '设施在敌人回合开始前触发（isEnemyTurn 之前）');
check(/_timeStopPending[\s\S]{0,200}_enemyDescentSuppressed\s*=\s*true/.test(gamePhase) && /e\.active\s*&&\s*!this\._enemyDescentSuppressed/.test(gamePhase), '时停：本回合敌人不行动');
check(/_enemyDescentSuppressed[\s\S]{0,300}spawn_checkBossRoundFor|else\s+if\s*\(this\._enemyDescentSuppressed\)/.test(gamePhase) && /this\._enemyDescentSuppressed\s*=\s*false/.test(gamePhase), '时停：回合结算跳过补行并清除');
check(/!config\._facility[\s\S]{0,80}hunter_instinct|hunter_instinct[\s\S]{0,40}!config\._facility/.test(combatSystem), '设施伤害不吃主炮类遗物（猎人本能）');
check(/_extraDigPending/.test(gameSystem) && /miningLevels/.test(gameSystem.slice(gameSystem.indexOf('sys_startDigPhase() {'), gameSystem.indexOf('sys_startDigPhase() {') + 1500)), '挖掘：采集弹珠数 = 基础 + 挖矿升级 + 加挖');
check(/loopVersion:\s*3/.test(gameSystem), '存档：loopVersion 3');
for (const field of ['digCount', 'cannonLevels', 'cannonBranch', 'facilities', 'facilitySlotsOpen', 'items', 'miningLevels', '_extraDigPending', '_timeStopPending', '_buildCommittedRound']) {
    check(new RegExp(`${field}:`).test(gameSystem), `存档：保存 ${field}`);
}
check(/sys_shouldResumeBuild\(\)[\s\S]{0,120}sys_startBuildPhase\(\)/.test(gameSystem), '读档：挖完未开战 → 回到整备');
check(/_digDoneRound\s*===\s*this\.round\s*&&\s*this\._buildCommittedRound\s*!==\s*this\.round/.test(buildSystem), '读档恢复判据：本回合已挖且未开战');
check(/id:\s*['"]build_intro['"][\s\S]{0,400}#build-fight-btn[\s\S]{0,1200}data\.to\s*===\s*['"]combat['"]/.test(tutorial) && /gathering_intro[\s\S]{0,1600}data\.to\s*===\s*['"]build['"]/.test(tutorial), '教程：挖掘 → 整备 → 战斗');
check(!/id=["']run-shop-status-dock["']/.test(indexHtml), '商人倒计时浮条已移除（商人 S3 改为 Boss 后固定出现）');
check(!/id=["']chaos-slot-machine-overlay["']/.test(indexHtml) && !/id=["']skill-editor-overlay["']/.test(indexHtml) && !/id=["']sp-panel["']/.test(indexHtml) && !/id=["']hero-gauge-container["']/.test(indexHtml), '旧 DOM：老虎机 / 技能编辑器 / SP 面板 / 充能表已移除');
check(/ui\.id\s*=\s*['"]phase-training['"][\s\S]{0,30000}id="skill-bar"/.test(read('src/systems.js')) && !/id=["']skill-bar["']/.test(indexHtml), '技能栏迁入试炼场 DOM（index 不再有 #skill-bar）');
check(/getElementById\(['"]dig-energy-readout['"]\)/.test(read('src/ui/hud.js')) && /id=["']dig-energy-readout["']/.test(indexHtml), '能量球兜底目标改为挖掘能量读数');
check(/id=["']defend-hud["']/.test(indexHtml) && /ui_renderDefendHud\s*\(options\s*=\s*\{\}\)/.test(read('src/ui/defend_hud.js')), '守卫 HUD：设施冷却条 + 道具按钮');

console.log('\n===================================================');
console.log(`  Result: ${passed}/${passed + failed} passed`);
if (failures.length > 0) {
    console.log('\n  Failed checks:');
    failures.forEach(failure => console.log(`    - ${failure}`));
}
console.log('===================================================');

process.exit(failed > 0 ? 1 : 0);
