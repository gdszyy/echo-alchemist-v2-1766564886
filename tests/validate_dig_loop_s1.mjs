/**
 * validate_dig_loop_s1.mjs - [REQ-20261022-wave-loop S1] 挖 → 守 循环骨架：纯函数 + 静态契约。
 *
 * 覆盖：炼成弹 3×3 封顶（含 bounce/pierce/scatter 按条目展开）、主炮射击、炼成弹伤害公式、
 *       §3 时间口径（每波挖一次 / Boss 波只挖一次），以及旧循环「惩罚打得好」规则已删除。
 *
 * Usage:
 *   node tests/validate_dig_loop_s1.mjs
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
    alchemyDamage,
    buildCannonShots,
    capAlchemyCollection,
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

// ---------- capAlchemyCollection ----------
{
    const r = capAlchemyCollection([
        'pyro', { type: 'pyro', level: 2 }, { type: 'pyro', level: 3 }, // pyro → 封顶 3
        'cryo',
        { type: 'lightning', level: 1 },
        { type: 'damage', level: 2 }, // 第 4 种属性 → 丢弃
    ]);
    check(r.groups.length === 3, '3×3: 最多 3 种属性');
    check(r.groups.map(g => g.type).join(',') === 'pyro,cryo,lightning', '3×3: 按首次拾取顺序保留属性');
    check(r.groups[0].level === 3, '3×3: 单属性等级封顶 3');
    check(r.totalLevels === 5, '3×3: 总级数 = 3 + 1 + 1');
    check(r.items.length === 3 && r.items[0].type === 'pyro' && r.items[0].level === 3, '3×3: 元素属性输出 1 条 {type, level}');
}
{
    const r = capAlchemyCollection(['bounce', 'bounce', 'bounce', 'bounce', { type: 'pierce', level: 2 }, 'scatter']);
    const count = type => r.items.filter(i => i.type === type).length;
    check(count('bounce') === 3, '3×3: bounce 封顶 3 级并展开为 3 条（编译器按条目 +1）');
    check(count('pierce') === 2, '3×3: pierce 2 级展开为 2 条');
    check(count('scatter') === 1, '3×3: scatter 1 级展开为 1 条');
    check(r.items.every(i => i.level === 1 || !['bounce', 'pierce', 'scatter'].includes(i.type)), '3×3: 展开条目 level 均为 1');
    check(r.totalLevels === 6, '3×3: bounce/pierce/scatter 总级数 = 3 + 2 + 1');
}
{
    const empty = capAlchemyCollection([]);
    check(empty.totalLevels === 0 && empty.items.length === 0, '空瓶：没有拾取 → 总级数 0');
    const runeOnly = capAlchemyCollection([{ type: 'pyro', level: 2, source: 'rune_slot' }]);
    check(runeOnly.totalLevels === 0, '符文槽属性不计入炼成弹');
    const custom = capAlchemyCollection(['pyro', 'cryo', 'lightning'], 2, 1);
    check(custom.groups.length === 2, 'maxTypes 参数生效');
}

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

// ---------- alchemyDamage ----------
check(alchemyDamage(1) === 45, '炼成弹：1 级 = 15 × 3 = 45');
check(alchemyDamage(3) === 75, '炼成弹：3 级 = 75');
check(alchemyDamage(9) === 165, '炼成弹：9 级封顶 = 165');
check(alchemyDamage(2, 10) === 40, '炼成弹：base 参数生效');
check(alchemyDamage(1) >= 4 * buildCannonShots(1, 10)[0].damage, 'P5：最弱炼成弹 ≥ 开局主炮单发 4 倍');
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
check(/_shotKind\s*===\s*['"]alchemy['"][\s\S]{0,300}alchemyMagazine\.push/.test(clearBody), '围墙清空：未发射的炼成弹退回弹匣');
check(/activeEnemies\s*===\s*0\s*&&\s*this\.phase\s*!==\s*['"]combat['"]/.test(gamePhase), '完美清场蓄能升级不在局内设置 _carryOverAmmo / 下回合血量倍率');

check(/waveFixedMult:\s*0\.5/.test(config), 'Boss 血量：配置按波次固定倍率 0.5');
const bossHpStart = spawnSystem.indexOf('spawn_calculateBossHP(isBigBoss) {');
const bossHpBody = spawnSystem.slice(bossHpStart, spawnSystem.indexOf('\n    },', bossHpStart));
check(bossHpStart > 0 && /templateHP\s*\*\s*waveFixedMult/.test(bossHpBody), 'Boss 血量：floor(模板血量 × waveFixedMult)');
check(!/calc_getRecentAverageDamage|combat_calculatePlayerExpectedDamage|dynamicWeight/.test(bossHpBody), 'Boss 血量：不再读取玩家 DPS');

check(/sys_swapNextShotWithAlchemy\s*\(i\)\s*\{/.test(gameSystem), '战斗：存在「下一发换成炼成弹」入口');
check(/sys_canSwapAlchemyShot\s*\(\)\s*\{[\s\S]{0,400}isEnemyTurn[\s\S]{0,120}_roundStartBannerActive[\s\S]{0,200}projectiles/.test(gameSystem), '战斗：换弹仅限玩家回合、非横幅、无飞行子弹');
check(/loopVersion:\s*2/.test(gameSystem) && /state\.energy\s*\?\?\s*state\.runFragments/.test(gameSystem), '存档：loopVersion 2，读档时旧碎片并入能量');
check(/source:\s*['"]boss_kill['"]/.test(read('src/core.js')) && /this\.crystal\s*=\s*\(this\.crystal\s*\|\|\s*0\)\s*\+\s*3/.test(read('src/core.js')), 'Boss 击杀：晶核 +3 并排队遗物三选一');

console.log('\n===================================================');
console.log(`  Result: ${passed}/${passed + failed} passed`);
if (failures.length > 0) {
    console.log('\n  Failed checks:');
    failures.forEach(failure => console.log(`    - ${failure}`));
}
console.log('===================================================');

process.exit(failed > 0 ? 1 : 0);
