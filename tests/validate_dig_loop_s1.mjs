/**
 * validate_dig_loop_s1.mjs - [REQ-20261022-wave-loop S1] 挖 → 守 循环骨架：纯函数 + 静态契约。
 *
 * 覆盖：主炮射击、§3 时间口径（每波挖一次 / Boss 波只挖一次），以及旧循环「惩罚打得好」规则已删除。
 * [2026-10-26] 「炼成弹珠」机制下线（Owner 裁定：研磨阶段已改成采集阶段，不存在专门做子弹的弹珠）后，
 *   本文件原覆盖的「炼成弹 3×3 封顶 / 炼成弹伤害公式 / 换炼成弹入口 / 围墙清空退回弹匣」四项断言
 *   所测的函数与方法都已从代码中删除，断言随之删除（无等价替代——被测对象不存在了）。
 *
 * Usage:
 *   node tests/validate_dig_loop_s1.mjs
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
    buildCannonShots,
    getDigBucketMultiplier,
    shouldDigThisRound,
} from '../src/utils/dig_loop_utils.js';

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
console.log('  Dig loop S1 validation');
console.log('===================================================\n');

// ---------- buildCannonShots ----------
{
    const shots = buildCannonShots(2, 10, 2);
    check(shots.length === 2, '主炮：每回合 2 发');
    check(shots.every(s => s._shotKind === 'cannon'), '主炮：射击标记为 cannon');
    check(shots.every(s => s.multicast === 0), '主炮：multicast 恒为 0');
    check(shots.every(s => s.damage === 10 && s.bounce === 2), '主炮：伤害 / 反弹来自参数');
    const recipeKeys = ['damage', 'bounce', 'pierce', 'scatter', 'explosive', 'isMatryoshka', 'isLaser', 'nestedPayload',
        'chainPayload', 'multicast', 'flying_sword', 'cryo', 'pyro', 'lightning', 'laser', 'overcharge', 'wind', 'level', 'type'];
    check(recipeKeys.every(k => Object.prototype.hasOwnProperty.call(shots[0], k)), '主炮：配方形状与 calc_compileCollectionToRecipe 一致');
    check(shots[0] !== shots[1], '主炮：每发是独立对象');
    check(buildCannonShots(0, 10).length === 0, '主炮：0 发返回空数组');
}

// ---------- 时间口径 / 主炮派生常量 ----------
check(getDigBucketMultiplier() === 1, '桶倍率：S1 占位恒为 ×1');

// ---------- shouldDigThisRound（§3 时间口径） ----------
const boss = { active: true, isDead: false, hp: 100, type: 'boss' };
check(shouldDigThisRound({ round: 1, enemies: [], _digDoneRound: null, _lastBossSpawnRound: null }) === true, '开局第 1 波：挖');
check(shouldDigThisRound({ round: 1, enemies: [], _digDoneRound: 1 }) === false, '同一回合已挖过：不再挖（存档恢复不刷挖矿）');
check(shouldDigThisRound({ round: 2, enemies: [], _digDoneRound: 1 }) === true, '普通波每回合都挖');
check(shouldDigThisRound({ round: 4, enemies: [boss], _digDoneRound: 3, _lastBossSpawnRound: 4 }) === true, 'R4 Boss 登场回合：挖一次');
check(shouldDigThisRound({ round: 5, enemies: [boss], _digDoneRound: 4, _lastBossSpawnRound: 4 }) === false, 'R5 Boss 仍存活：不挖，直接战斗');
check(shouldDigThisRound({ round: 6, enemies: [boss], _digDoneRound: 4, _lastBossSpawnRound: 4 }) === false, '拖 Boss 不能刷挖矿');
check(shouldDigThisRound({ round: 5, enemies: [{ ...boss, active: false, isDead: true, hp: 0 }], _digDoneRound: 4, _lastBossSpawnRound: 4 }) === true, 'R5 Boss 已死：恢复每波挖');
check(shouldDigThisRound(null) === false, '无 game：不挖');

// ---------- 静态契约：旧「惩罚打得好」规则与抽奖援军已删除 ----------
const gamePhase = read('src/game_phase.js');
const gameSystem = read('src/game_system.js');
const spawnSystem = read('src/spawn_system.js');
const config = read('src/config.js');
const finalizeStart = gamePhase.indexOf('phase_finalizeRound() {');
const finalizeEnd = gamePhase.indexOf('phase_continueFinalizeRoundAfterRelicHooks() {');
const finalizeBody = gamePhase.slice(finalizeStart, finalizeEnd);
check(finalizeStart > 0 && finalizeEnd > finalizeStart, 'phase_finalizeRound 可定位');
check(!/HASTE APPLIED/.test(finalizeBody) && !/affixes\.push\(['"]haste['"]\)/.test(finalizeBody), '回合结算：低存活加极速已删除');
check(!/spawn_spawnEnemyRowOffScreen\(1\)/.test(finalizeBody) && !/增援部隊/.test(finalizeBody), '回合结算：≤5 存活补行已删除');
check(!/敌军至少推进 3 行/.test(finalizeBody) && !/_prevRoundCleared/.test(finalizeBody), '回合结算：清屏反扑已删除');
check(/if\s*\(clearedThisRound\)\s*\{\s*this\.spawn_spawnEnemyRowAt\(this\.combatGridTopY\)/.test(finalizeBody), '回合结算：清屏后首行仍生成在围墙内');

const clearStart = gamePhase.indexOf('phase_inWallClearTrigger() {');
const clearEnd = gamePhase.indexOf('phase_enemy_startLogic() {');
const clearBody = gamePhase.slice(clearStart, clearEnd);
check(clearStart > 0 && clearEnd > clearStart, 'phase_inWallClearTrigger 可定位');
check(!/spawn_spawnEliteJumperRows/.test(clearBody), '围墙清空：不再刷精英援军');
check(!/sys_runInWallClearLottery/.test(clearBody), '围墙清空：不再抽奖');
check(/activeEnemies\s*===\s*0\s*&&\s*this\.phase\s*!==\s*['"]combat['"]/.test(gamePhase), '完美清场蓄能升级不在局内设置 _carryOverAmmo / 下回合血量倍率');

check(/waveFixedMult:\s*0\.5/.test(config), 'Boss 血量：配置按波次固定倍率 0.5');
const bossHpStart = spawnSystem.indexOf('spawn_calculateBossHP(isBigBoss) {');
const bossHpBody = spawnSystem.slice(bossHpStart, spawnSystem.indexOf('\n    },', bossHpStart));
check(bossHpStart > 0 && /templateHP\s*\*\s*waveFixedMult/.test(bossHpBody), 'Boss 血量：floor(模板血量 × waveFixedMult)');
check(!/calc_getRecentAverageDamage|combat_calculatePlayerExpectedDamage|dynamicWeight/.test(bossHpBody), 'Boss 血量：不再读取玩家 DPS');

check(/loopVersion:\s*[23]/.test(gameSystem) && /state\.energy\s*\?\?\s*state\.runFragments/.test(gameSystem), '存档：loopVersion ≥ 2（S2 为 3），读档时旧碎片并入能量');
check(/source:\s*['"]boss_kill['"]/.test(read('src/core.js')) && /this\.crystal\s*=\s*\(this\.crystal\s*\|\|\s*0\)\s*\+\s*3/.test(read('src/core.js')), 'Boss 击杀：晶核 +3 并排队遗物三选一');

console.log('\n===================================================');
console.log(`  Result: ${passed}/${passed + failed} passed`);
if (failures.length > 0) {
    console.log('\n  Failed checks:');
    failures.forEach(failure => console.log(`    - ${failure}`));
}
console.log('===================================================');

process.exit(failed > 0 ? 1 : 0);
