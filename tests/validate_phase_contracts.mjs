/**
 * validate_phase_contracts.mjs - Static contracts for phase cleanup and fate-moment return flow.
 *
 * Usage:
 *   node tests/validate_phase_contracts.mjs
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function read(relPath) {
    return fs.readFileSync(path.join(repoRoot, relPath), 'utf8');
}

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

function has(source, pattern) {
    return typeof pattern === 'string' ? source.includes(pattern) : pattern.test(source);
}

console.log('===================================================');
console.log('  Phase cleanup and fate-moment contract validation');
console.log('===================================================\n');

const uiSystem = read('src/ui_system.js');
const gameSystem = read('src/game_system.js');
const gamePhase = read('src/game_phase.js');
const gameOver = read('src/ui/game_over.js');
const runShop = read('src/ui/run_shop.js');
const indexHtml = read('index.html');
const spawnSystem = read('src/spawn_system.js');
const collisionSystem = read('src/combat/collision.js');
const projectile = read('src/entities/projectile.js');
const config = read('src/config.js');

check(has(uiSystem, /ui_resetCombatPhaseHud\s*\(options\s*=\s*\{\}\)/), 'ui_resetCombatPhaseHud exists');
check(has(uiSystem, /ui_clearTransientOverlays\s*\(options\s*=\s*\{\}\)/), 'ui_clearTransientOverlays exists');
check(has(uiSystem, /ui_abandonRunToMeta\s*\(\)/), 'ui_abandonRunToMeta exists');
check(has(uiSystem, /if\s*\(this\.phase\s*!==\s*['"]combat['"]\)\s*\{\s*this\.ui_resetCombatPhaseHud\(\{\s*preserveStatusPanel:\s*this\.phase\s*===\s*['"]training['"]\s*\}\)/s), 'ui_updateUI resets combat HUD outside combat and preserves training status panel');
check(has(uiSystem, /const\s+terminalPhase\s*=\s*\[[^\]]*['"]meta['"][^\]]*['"]shop['"][^\]]*['"]truth_book['"][^\]]*['"]gameover['"][^\]]*\]\.includes\(this\.phase\)/s), 'terminal phases are centralized for transient overlay cleanup');
check(has(uiSystem, /if\s*\(terminalPhase\)\s*\{\s*this\.ui_clearTransientOverlays\(\{\s*keepRuneLauncher:\s*launcherVisible\s*\}\)/s), 'terminal phases clear transient overlays while preserving visible launcher');
check(has(uiSystem, /const\s+pcSidebarPhaseActive\s*=\s*\[[^\]]*['"]gathering['"][^\]]*['"]combat['"][^\]]*['"]selection['"][^\]]*['"]training['"][^\]]*\]\.includes\(this\.phase\)/s), 'PC sidebar whitelist includes only run phases and training');
check(has(uiSystem, /ui_isFateMomentPhase\s*\(\)\s*\{[^}]*this\.phase\s*===\s*['"]selection['"][^}]*fateMomentContext[^}]*active/s), 'ui_isFateMomentPhase maps active fate context onto selection phase');
check(has(uiSystem, /ui_abandonRunToMeta\s*\(\)\s*\{[^}]*ui_clearTransientOverlays/s), 'abandon run clears transient overlays');
check(has(uiSystem, /ui_abandonRunToMeta\s*\(\)\s*\{[\s\S]*phase_switchPhase\(['"]meta['"]\)/), 'abandon run returns to meta through phase_switchPhase');
check(has(uiSystem, /ui_openTruthBook\s*\(options\s*=\s*\{\}\)/), 'ui_openTruthBook accepts return-state options');
check(has(uiSystem, /this\.truthBookReturnState\s*=\s*options\.returnState\s*\|\|\s*defaultReturnState/), 'truth book records return state on open');
check(has(uiSystem, /const\s+returnState\s*=\s*this\.truthBookReturnState\s*\|\|\s*\{\s*phase:\s*['"]meta['"]\s*\}/), 'truth book close reads stored return state');
check(has(uiSystem, /if\s*\(targetPhase\s*===\s*['"]selection['"]\)[\s\S]*this\.selectionMode\s*=\s*returnState\.selectionMode[\s\S]*this\.fateMomentContext\s*=\s*\{\s*\.\.\.returnState\.fateMomentContext\s*\}/), 'truth book restores fate selection context');
check(has(uiSystem, /_meta_ensureResourceStore\s*\(\)/), 'meta resource store migration helper exists');
check(has(uiSystem, /resources\.rune_fragments[\s\S]*this\.saveData\.runeFragments[\s\S]*this\.saveData\.currency/), 'rune fragment resource is mirrored to legacy save fields');
check(has(uiSystem, /meta_getResourceCount\s*\(resourceId\)\s*\{[\s\S]*this\._meta_ensureResourceStore\(\)/), 'meta resource reads use unified resource store');
check(has(uiSystem, /meta_spendResource\s*\(resourceId,\s*amount\)\s*\{[\s\S]*this\.saveData\.runeFragments\s*=\s*resources\.rune_fragments[\s\S]*this\.saveData\.currency\s*=\s*resources\.rune_fragments/), 'meta resource spend keeps rune fragment fields in sync');
check(has(uiSystem, /meta_addCurrency\s*\(amount,\s*resourceId\s*=\s*['"]rune_fragments['"]\)/), 'meta_addCurrency adds to unified rune fragment resource by default');
check(has(uiSystem, /document\.getElementById\(['"]meta-currency-value['"]\)\s*\|\|\s*document\.getElementById\(['"]meta-currency-display['"]\)/), 'meta currency UI updates the actual home screen currency element');

check(has(gameSystem, /_proceedToFateMomentSelection\s*\(\)\s*\{[\s\S]*this\.fateMomentContext\s*=\s*\{[\s\S]*active:\s*true/), '_proceedToFateMomentSelection activates fateMomentContext');
check(has(gameSystem, /resources:\s*\{\s*rune_fragments:\s*0\s*\}/), 'persistent save defaults include unified resource store');
check(has(gameSystem, /if\s*\(typeof\s+this\._meta_ensureResourceStore\s*===\s*['"]function['"]\)\s*this\._meta_ensureResourceStore\(\)/), 'save load migrates legacy resource fields');
check(has(gameSystem, /ui_showRelicSelection\(\{\s*resumeTarget:\s*['"]round_start_resolver['"]/), 'round-start reward resolver opens relic overlay with resume target');
check(has(gameSystem, /wavePresetUsage/), 'wave preset usage is persisted in run save state');
check(has(gameSystem, /wavePresetRoundUsed/), 'wave preset round lock is persisted in run save state');
check(has(gameSystem, /phase:\s*this\.phase\s*\|\|\s*['"]meta['"]/), 'run save state persists the active phase');
check(has(gameSystem, /marblesPool:\s*marblesPoolData/), 'run save state persists selection marble candidates');
check(has(gameSystem, /selectedMarbles:\s*\(this\.selectedMarbles\s*\|\|\s*\[\]\)\.slice\(\)/), 'run save state persists selected marble indices');
check(has(gameSystem, /const\s+savedPhase\s*=\s*state\.phase\s*\|\|\s*null/), 'run load reads the saved active phase');
check(has(gameSystem, /this\.marblesPool\s*=\s*state\.marblesPool\.map\(m\s*=>\s*\{[\s\S]*new\s+MarbleDefinition\(m\.type\s*\|\|\s*['"]bounce['"]\)/), 'run load restores saved marble candidates as MarbleDefinition instances');
check(has(gameSystem, /const\s+shouldRestoreSelection\s*=\s*savedPhase\s*===\s*['"]selection['"][\s\S]*this\.fateMomentContext[\s\S]*this\.selectionMode[\s\S]*!==\s*['"]standard['"]/), 'run load detects saved fate selection before running resolver');
check(has(gameSystem, /else\s+if\s*\(shouldRestoreSelection\)\s*\{[\s\S]*phase_switchPhase\(['"]selection['"]\)[\s\S]*spawn_generateMarbleOptions\(\)[\s\S]*ui_refreshSelectionModeUI\(\)[\s\S]*spawn_showMarblePreview/), 'run load restores selection UI instead of falling through to round-start resolver');
check(has(gameSystem, /sys_showRoundStartBanner\s*\(\)\s*\{[\s\S]*phase_switchPhase\(['"]combat['"]\)[\s\S]*phase_startCombatPhase\(\)/), 'normal round-start banner transitions to combat, not gathering');
check(has(config, /combatSideInsetRatio\s*:\s*0\.08/), 'combat side inset ratio is configured');
check(has(gameSystem, /combatGridLeftX[\s\S]*combatGridRightX[\s\S]*combatGridWidth[\s\S]*this\.enemyWidth\s*=\s*\(this\.combatGridWidth\s*\/\s*CONFIG\.gameplay\.enemyCols\)/), 'sys_resize derives enemy grid width from inset combat arena');
check(has(gameSystem, /sys_getCombatBounds\s*\(\)/), 'combat bounds helper exists');
check(has(gameSystem, /sys_getCombatColumnCenterX\s*\(col,\s*spanCols\s*=\s*1\)/), 'combat column center helper exists');
check(has(gamePhase, /wallLeftX[\s\S]*wallRightX[\s\S]*createLinearGradient\(wallLeftX[\s\S]*lineTo\(wallRightX,\s*wallTopY\)/), 'combat walls are drawn at inset arena bounds');
check(has(gamePhase, /leftBound\s*=\s*combatBounds\.left\s*\+\s*radius[\s\S]*rightBound\s*=\s*combatBounds\.right\s*-\s*radius[\s\S]*rightBound\s*-\s*current\.x[\s\S]*leftBound\s*-\s*current\.x/), 'combat aim guide uses inset arena side walls');
check(has(spawnSystem, /sys_getCombatColumnCenterX\(c\)/), 'normal enemy spawn columns use inset arena centers');
check(has(spawnSystem, /sys_getCombatColumnCenterX\(startCol,\s*cols\)/), 'wave preset spawn columns use inset arena centers');
check(has(spawnSystem, /sys_getCombatColumnCenterX\(sc,\s*chosen\.cols\)/), 'archetype spawn columns use inset arena centers');
check(has(spawnSystem, /bossBounds[\s\S]*bossBounds\.left\s*\+\s*bossBounds\.right/), 'boss spawn centers on inset combat arena');
check(has(collisionSystem, /moveBounds[\s\S]*newPos\.x\s*-\s*halfW\s*<\s*moveBounds\.left[\s\S]*newPos\.x\s*\+\s*halfW\s*>\s*moveBounds\.right/), 'enemy movement is clamped to inset combat arena');
check(has(collisionSystem, /leftBound\s*=\s*combatBounds\.left\s*\+\s*CONFIG\.physics\.bulletRadius[\s\S]*rightBound\s*=\s*combatBounds\.right\s*-\s*CONFIG\.physics\.bulletRadius[\s\S]*leftBound\s*-\s*start\.x[\s\S]*rightBound\s*-\s*start\.x/), 'laser wall reflection uses inset combat arena');
check(has(projectile, /leftBound\s*=\s*combatBounds\.left\s*\+\s*this\.radius[\s\S]*rightBound\s*=\s*combatBounds\.right\s*-\s*this\.radius[\s\S]*this\.pos\.x\s*<\s*leftBound[\s\S]*this\.pos\.x\s*>\s*rightBound/), 'projectile wall bounce uses inset combat arena');
check(!has(projectile, /ownedRelics\.includes\(['"]energy_shield['"]\)[\s\S]{0,360}destroy\s*\(/), 'energy shield wall collision does not destroy bullets after bounce/pierce are exhausted');
check(has(projectile, /let\s+shieldWallDurabilityConsumed\s*=\s*false/), 'energy shield wall collision tracks per-step durability consumption');
check(has(projectile, /ownedRelics\.includes\(['"]energy_shield['"]\)\s*&&\s*!\s*shieldWallDurabilityConsumed[\s\S]{0,180}this\.bouncesLeft--[\s\S]{0,120}shieldWallDurabilityConsumed\s*=\s*true[\s\S]{0,180}this\.piercesLeft--[\s\S]{0,120}shieldWallDurabilityConsumed\s*=\s*true/), 'energy shield wall collision consumes at most one durability layer per movement step');
check(has(config, /energy_shield[\s\S]{0,280}最多消耗一層[\s\S]{0,120}不會被墻吞沒/), 'energy shield relic copy states one-layer wall durability consumption and no bullet swallowing');
check(has(gameSystem, /runShopFirstOfferRound\)\s*\|\|\s*3|runShopFirstOfferRound\s*\|\|\s*3/), 'run shop first scheduled visit defaults to round 3');
check(has(gameSystem, /runShopVisitDurationRounds\s*\|\|\s*2/), 'run shop visits default to a two-round stay');
check(has(gameSystem, /sys_rollNextRunShopRound[\s\S]*runShopRandomWaitMin[\s\S]*fromRound/), 'run shop next visit rolls between configured min wait and current round');
check(has(gameSystem, /sys_maybeOfferRunShopBeforeRoundStart\s*\(\)\s*\{[\s\S]*sys_updateRunShopScheduleForRound\(\)[\s\S]*return\s+false/), 'round-start merchant schedule updates without blocking the banner');
check(has(gameSystem, /_runShopInventoryGeneratedForRound/), 'run shop inventory generation marker is persisted with run state');
check(has(gameSystem, /runShopStarterBoostDamageRounds/), 'starter merchant boost damage duration is persisted with run state');
check(has(gamePhase, /function\s+buildFallbackMarbleQueue\s*\(game\)/), 'gathering has fallback marble queue builder');
check(has(gamePhase, /phase_startGatheringPhase\s*\(\)\s*\{[\s\S]*this\.marbleQueue\s*=\s*buildFallbackMarbleQueue\(this\)/), 'gathering phase rebuilds missing marbleQueue before empty grind');
check(has(gamePhase, /while\s*\(\s*queue\.length\s*<\s*required\s*\)\s*\{[\s\S]*new\s+MarbleDefinition\(pickType\(\)\)/), 'fallback marble queue fills partial stale pools to the required count');
check(has(gamePhase, /runShopStarterBoostDamageRounds[\s\S]*flatDamageBonus[\s\S]*runShopStarterBoostDamageAmount/), 'starter merchant damage boost expires during round finalization');
check(has(gamePhase, /import\s*\{\s*calc_getCirclePolygonCollision,\s*calc_getCircleArcCollision\s*\}\s*from\s*['"]\.\/combat\/collision_shapes\.js['"]/), 'combat aim guide imports shared collision shape helpers');
check(has(gamePhase, /function\s+getCombatAimEnemyHit[\s\S]*enemy\.collisionShape\s*===\s*['"]polygon['"][\s\S]*calc_getCirclePolygonCollision[\s\S]*enemy\.collisionShape\s*===\s*['"]arc['"][\s\S]*calc_getCircleArcCollision/), 'combat aim guide respects polygon and arc enemy collision shapes');
check(has(gamePhase, /function\s+buildCombatAimScatterOffsets[\s\S]*extraScatterShots[\s\S]*scatterAngleReduction[\s\S]*Math\.floor\(scatterCount\s*\/\s*2\)\s*\+\s*\(scatterCount\s*%\s*2\)/), 'combat aim guide mirrors scatter layer branch count and resonance angle rules');
check(has(gamePhase, /const\s+allPegTypes\s*=\s*\[\s*['"]bounce['"]\s*,\s*['"]damage['"]\s*\]/), 'gathering random peg pool only includes pure bounce and damage pegs');
check(has(read('src/pinboard_modules.js'), /const\s+RANDOMIZABLE_PEG_TYPES\s*=\s*\[\s*['"]bounce['"]\s*,\s*['"]damage['"]\s*\]/), 'module pinboard random peg pool only includes pure bounce and damage pegs');

check(has(gameOver, /ui_clearTransientOverlays\s*\(\)/), 'gameover trigger clears transient overlays');
check(has(gameOver, /meta_addCurrency\(settled\)/), 'gameover settlement writes leftover run fragments through unified resource API');
check(has(read('src/ui/shop.js'), /meta_getResourceCount\(['"]rune_fragments['"]\)/), 'meta shop currency display reads unified rune fragment resource');
check(has(indexHtml, /id=["']shop-resource-overview["']/), 'meta shop has a visible resource overview container');
check(has(read('src/ui/shop.js'), /Object\.values\(META_SHOP_CONFIG\.resources\s*\|\|\s*\{\}\)\.forEach/), 'meta shop resource overview renders every configured resource');
check(has(read('src/ui/rune_launcher.js'), /meta_getResourceCount\(['"]rune_fragments['"]\)/), 'rune launcher shard display reads unified rune fragment resource');
check(has(indexHtml, /game\.ui_abandonRunToMeta\(\)/), 'pause abandon button uses ui_abandonRunToMeta');
check(has(indexHtml, /id=["']run-shop-status-dock["']/), 'run-shop countdown dock exists');
check(has(runShop, /const\s+visiblePhase\s*=\s*this\.phase\s*===\s*['"]gathering['"]\s*\|\|\s*this\.phase\s*===\s*['"]combat['"]/), 'run shop countdown remains visible in gathering and combat');
check(has(runShop, /kind:\s*['"]starter_boost['"]/), 'first run-shop visit can generate a free starter boost item');
check(has(runShop, /runShopStarterBoostDamageRounds/), 'starter boost item displays a temporary damage duration');
check(has(runShop, /ensureInventoryForCurrentVisit[\s\S]*_runShopInventoryGeneratedForRound/), 'run shop inventory is generated once per active visit');
check(has(runShop, /ui_updateRunShopScheduleUI\s*\(\)/), 'run shop exposes bottom countdown UI renderer');

console.log('\n===================================================');
console.log(`  Result: ${passed}/${passed + failed} passed`);
if (failures.length > 0) {
    console.log('\n  Failed checks:');
    failures.forEach(failure => console.log(`    - ${failure}`));
}
console.log('===================================================');

process.exit(failed > 0 ? 1 : 0);
