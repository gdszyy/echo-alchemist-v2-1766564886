/**
 * validate_wave_cycle.mjs - 波次循环（Dome Keeper 式「挖 → 守」）契约与推演。
 *
 * 规则：每回合 = 1 波；一个循环 = 3 个普通波 + 1 个 Boss 波；Boss 波持续到 Boss 被击杀，
 * 击杀后重新数 3 个普通波。
 *
 * Usage:
 *   node tests/validate_wave_cycle.mjs
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
    BOSS_WAVE_IN_PROGRESS,
    computeNextBossRound,
    getBossPreviewInfo,
    getWaveInfo,
    resolveNormalWavesPerBoss,
} from '../src/utils/boss_schedule_utils.js';

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

// ---------- 纯函数 ----------
check(resolveNormalWavesPerBoss(undefined) === 3, 'normalWavesPerBoss 默认 3');
check(resolveNormalWavesPerBoss(0) === 3, 'normalWavesPerBoss 非法值回落 3');
check(computeNextBossRound(0, 3) === 4, '开局第 1 个 Boss 波在 Round 4');
check(computeNextBossRound(6, 3) === 10, 'Boss 在 R6 被击杀 → 下一个 Boss 波在 R10');

// ---------- 推演：模拟 spawn_scheduleNextBoss / spawn_checkBossRoundFor / finalize 的状态机 ----------
// bossLifetimes[i] = 第 i 个 Boss 存活的回合数（1 = 登场当回合击杀）
function simulate(bossLifetimes, totalRounds, n = 3) {
    const game = { round: 1, enemies: [], _bossSpawnCount: 0, bossDefeatedLog: [], _nextBossRound: null };
    const schedule = () => {
        const from = game._bossSpawnCount > 0 ? game.round : 0;
        game._nextBossRound = computeNextBossRound(from, n);
    };
    const timeline = [];
    let boss = null;
    let bossBornRound = 0;
    for (let r = 1; r <= totalRounds; r++) {
        game.round = r;
        // 回合开始：若到达预定回合且无 Boss 在场 → 生成（等价于 finalize 中对 nextRound 的检测 + round++ 后生成）
        if (game._nextBossRound === null) schedule();
        if (!boss && r >= game._nextBossRound) {
            boss = { type: 'boss', active: true, hp: 100 };
            game.enemies = [boss];
            bossBornRound = r;
            game._lastBossSpawnRound = r;
            game._bossSpawnCount++;
            game._nextBossRound = BOSS_WAVE_IN_PROGRESS;
        }
        const info = getWaveInfo(game, n);
        timeline.push(info.isBossWave ? 'B' : String(info.waveInCycle));
        // 战斗阶段：Boss 存活回合数到期则被击杀 → boss:defeated → 重新排期
        if (boss) {
            const life = bossLifetimes[game._bossSpawnCount - 1] || 1;
            if (r - bossBornRound + 1 >= life) {
                boss.hp = 0;
                boss.active = false;
                game.enemies = [];
                game.bossDefeatedLog.push({ round: r });
                boss = null;
                schedule();
            }
        }
    }
    return timeline.join('');
}

const t1 = simulate([1, 1, 1], 12);
check(t1 === '123B123B123B', `Boss 当回合击杀：每 4 波一个 Boss（实得 ${t1}）`);

const t2 = simulate([3, 2], 12);
check(t2 === '123BBB123BB1', `Boss 拖 3 回合：Boss 波持续到击杀，之后重新数 3 个普通波（实得 ${t2}）`);

const t3 = simulate([1, 1, 1, 1, 1, 1, 1, 1], 32);
check((t3.match(/B/g) || []).length === 8, `32 回合内 8 个 Boss（实得 ${t3}）`);

// 同时只存在一个 Boss 波：getWaveInfo 在 Boss 在场时恒为 Boss 波
{
    const g = { round: 9, enemies: [{ type: 'boss', active: true, hp: 10 }], _bossSpawnCount: 2, _lastBossSpawnRound: 7, _nextBossRound: BOSS_WAVE_IN_PROGRESS };
    const info = getWaveInfo(g, 3);
    check(info.isBossWave && info.bossRoundsElapsed === 3 && info.cycle === 2, 'Boss 在场第 3 回合：Boss 波 · 第 3 回合 · 第 2 个循环');
    check(getBossPreviewInfo(g, null, 3) === null, 'Boss 在场时不预告下一个 Boss');
}

// 下一波是 Boss 时的倒计时口径
{
    const g = { round: 3, enemies: [], _bossSpawnCount: 0, bossDefeatedLog: [], _nextBossRound: 4 };
    const info = getWaveInfo(g, 3);
    check(info.waveInCycle === 3 && info.wavesUntilBoss === 1 && !info.isBossWave, 'R3：第 3/3 波，1 波后 Boss');
    check(getBossPreviewInfo(g, null, 3)?.turnsUntil === 1, 'Boss 预告 turnsUntil = 1 波');
}

// DoT/AoE 静默击杀：Boss 已离场但 _nextBossRound 仍是进行中占位 → HUD 不得显示 Boss 波
{
    const g = { round: 6, enemies: [{ type: 'boss', active: false, hp: 0 }], _bossSpawnCount: 1, bossDefeatedLog: [], _nextBossRound: BOSS_WAVE_IN_PROGRESS };
    const info = getWaveInfo(g, 3);
    check(!info.isBossWave && info.nextBossRound === 10 && info.waveInCycle === 1, `静默击杀后按本回合预告下一个 Boss 波（实得 next=${info.nextBossRound} wave=${info.waveInCycle}）`);
}

// 新手教程局：唯一 Boss 在 R2，R1 显示 1/1
{
    const g = { round: 1, enemies: [], _bossSpawnCount: 0, _isTutorialRun: true, _nextBossRound: 2 };
    const info = getWaveInfo(g, 3);
    check(info.waveInCycle === 1 && info.normalWavesPerBoss === 1 && info.wavesUntilBoss === 1, '教程局 R1 显示 1/1，下一波 Boss');
}

{
    const spawn = read('src/spawn_system.js');
    check(/spawn_reconcileBossWave\(\)\s*\{/.test(spawn) && /this\.spawn_reconcileBossWave\(\);/.test(spawn), '回合结算检测前收口静默击杀的 Boss 波');
    const core = read('src/core.js');
    check(/!this\.enemies\.includes\(data\.boss\)\) return;/.test(core), 'boss:defeated 忽略不属于本局的 Boss（真理之书演示）');
}

// 读档兼容：_nextBossRound 已过期也不会错过 Boss 波（>= 匹配）
{
    const spawn = read('src/spawn_system.js');
    check(/if \(round >= this\._nextBossRound\)/.test(spawn), 'spawn_checkBossRoundFor 用 >= 匹配预定回合');
    check(/findActiveBoss\(this\)/.test(spawn), 'spawn_checkBossRoundFor 在 Boss 在场时不再触发');
    check(/computeNextBossRound\(fromRound, normalWaves\)/.test(spawn), 'spawn_scheduleNextBoss 走 computeNextBossRound 唯一口径');
    check(!/THEME_SEGMENTS\[\w*\]?\.endRound|segments\[spawnCount\]\.endRound/.test(spawn), '不再按 THEME_SEGMENTS.endRound 固定 Boss 回合');
}

// ---------- 静态契约 ----------
{
    const config = read('src/config.js');
    check(/waveCycle:\s*\{[\s\S]*?normalWavesPerBoss:\s*3/.test(config), 'CONFIG.balance.waveCycle.normalWavesPerBoss = 3');
    check(!/bossRounds\s*:/.test(config), '旧 bossRounds（firstBoss/延期）配置已下线');

    const core = read('src/core.js');
    check(!/delayFastKill|killDuration/.test(core), 'boss:defeated 不再按击杀速度延期');
    check(/this\.spawn_scheduleNextBoss\(\);/.test(core), 'boss:defeated 重新排期下一个 Boss 波');

    const phase = read('src/game_phase.js');
    check(/this\._nextBossRound = BOSS_WAVE_IN_PROGRESS;/.test(phase), 'Boss 生成后标记 Boss 波进行中');

    const html = read('index.html');
    check(/id="wave-pill"/.test(html) && /id="wave-num"/.test(html) && /id="round-num"/.test(html), '顶栏有波次胶囊且保留 round-num');

    const sys = read('src/game_system.js');
    check(/sys_updateWaveHud\(\)\s*\{/.test(sys), 'game_system 提供 sys_updateWaveHud');
    check(/sys_getWaveBannerText\(sys_getWaveInfo\(this\)\)/.test(sys), '回合横幅显示波次文案');
}

console.log('');
console.log('===================================================');
console.log(`  波次循环校验: ${passed}/${passed + failed} 通过`);
if (failed > 0) {
    console.log('  Failed checks:');
    failures.forEach(f => console.log(`    - ${f}`));
}
console.log('===================================================');
process.exit(failed > 0 ? 1 : 0);
