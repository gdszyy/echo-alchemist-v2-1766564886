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
const indexHtml = read('index.html');

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

check(has(gameSystem, /_proceedToFateMomentSelection\s*\(\)\s*\{[\s\S]*this\.fateMomentContext\s*=\s*\{[\s\S]*active:\s*true/), '_proceedToFateMomentSelection activates fateMomentContext');
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
check(has(gamePhase, /function\s+buildFallbackMarbleQueue\s*\(game\)/), 'gathering has fallback marble queue builder');
check(has(gamePhase, /phase_startGatheringPhase\s*\(\)\s*\{[\s\S]*this\.marbleQueue\s*=\s*buildFallbackMarbleQueue\(this\)/), 'gathering phase rebuilds missing marbleQueue before empty grind');
check(has(gamePhase, /while\s*\(\s*queue\.length\s*<\s*required\s*\)\s*\{[\s\S]*new\s+MarbleDefinition\(pickType\(\)\)/), 'fallback marble queue fills partial stale pools to the required count');

check(has(gameOver, /ui_clearTransientOverlays\s*\(\)/), 'gameover trigger clears transient overlays');
check(has(indexHtml, /game\.ui_abandonRunToMeta\(\)/), 'pause abandon button uses ui_abandonRunToMeta');

console.log('\n===================================================');
console.log(`  Result: ${passed}/${passed + failed} passed`);
if (failures.length > 0) {
    console.log('\n  Failed checks:');
    failures.forEach(failure => console.log(`    - ${failure}`));
}
console.log('===================================================');

process.exit(failed > 0 ? 1 : 0);
