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

function readPngSize(relPath) {
    const filePath = path.join(repoRoot, relPath);
    if (!fs.existsSync(filePath)) return null;
    const buf = fs.readFileSync(filePath);
    if (buf.length < 24 || buf.toString('ascii', 1, 4) !== 'PNG') return null;
    return {
        width: buf.readUInt32BE(16),
        height: buf.readUInt32BE(20),
    };
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
const renderSystem = read('src/render_system.js');
const gameOver = read('src/ui/game_over.js');
const runShop = read('src/ui/run_shop.js');
const shop = read('src/ui/shop.js');
const indexHtml = read('index.html');
const spawnSystem = read('src/spawn_system.js');
const collisionSystem = read('src/combat/collision.js');
const projectile = read('src/entities/projectile.js');
const enemy = read('src/entities/enemy.js');
const config = read('src/config.js');
const calcUtils = read('src/calc_utils.js');
const systems = read('src/systems.js');
const enemyV2Metadata = read('src/data/enemy_v2_metadata.js');
const wavePresets = read('src/wave_presets.js');
const emitterGeometry = read('src/utils/emitter_geometry.js');
const targetingOverlayGenerator = read('scripts/generate_enemy_targeting_overlays.py');

check(has(uiSystem, /ui_resetCombatPhaseHud\s*\(options\s*=\s*\{\}\)/), 'ui_resetCombatPhaseHud exists');
check(has(calcUtils, /calc_isEnemyInsideCombatWalls\s*\(enemy\)[\s\S]*sys_getCombatBounds[\s\S]*bottom\s*>\s*bounds\.top/), 'combat clear counting uses wall-intersection helper');
check(!has(gamePhase, /pos\.y\s*>\s*0\s*&&\s*this\.phase_isEnemyClearable/), 'combat clear checks no longer gate enemies by pos.y > 0');
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
check(has(gameSystem, /sys_queueRoundStartReward\(\{\s*type:\s*['"]marble_pack['"][\s\S]{0,120}source:\s*['"]run_start['"]/), 'run start queues a mixed marble pack after the first relic');
check(has(gameSystem, /sys_startMarblePackGrind\s*\(reward\s*=\s*\{\}\)[\s\S]*phase_startGatheringPhase\(\)/), 'marble packs directly enter gathering grind');
check(!has(gameSystem, /sourceRewardType\s*===\s*['"]marble_pack['"]/), 'marble packs no longer enter selection mode');
check(has(runShop, /kind:\s*['"]marble_pack['"][\s\S]{0,180}name:\s*['"]杂色弹珠包['"]/), 'run shop sells mixed marble packs');
check(has(runShop, /it\.kind\s*===\s*['"]marble_pack['"][\s\S]{0,260}sys_startMarblePackGrind/), 'buying a marble pack starts grind immediately');
check(has(shop, /_grantRelicResourcePack\s*\(game,\s*multiplier\s*=\s*0\.5\)/), 'relic marble-weight bonuses grant run resource packs');
check(has(uiSystem, /type\s*===\s*['"]marble_pack['"][\s\S]{0,240}title\s*=\s*['"]杂色弹珠包['"]/), 'marble packs use a dedicated reveal animation card');
check(has(indexHtml, /#round-start-banner\s*\{[\s\S]{0,140}position:\s*absolute;[\s\S]{0,80}inset:\s*0;/), 'round-start banner centers inside the game container');
check(
    has(uiSystem, /const\s+isFateSelection\s*=\s*this\.selectionMode\s*===\s*['"]chaos_essence['"][\s\S]{0,120}this\.selectionMode\s*===\s*['"]pure_essence['"]/) &&
    has(uiSystem, /const\s+canReroll\s*=\s*isFateSelection\s*&&/),
    'marble packs are semantically distinct from fate selection reroll'
);
check(has(config, /combatSideInsetRatio\s*:\s*0\.08/), 'combat side inset ratio is configured');
check(has(config, /runShopMixedMarblePackPrice:\s*18/), 'mixed marble pack shop price is configured');
check(has(gameSystem, /combatGridLeftX[\s\S]*combatGridRightX[\s\S]*combatGridWidth[\s\S]*this\.enemyWidth\s*=\s*\(this\.combatGridWidth\s*\/\s*CONFIG\.gameplay\.enemyCols\)/), 'sys_resize derives enemy grid width from inset combat arena');
check(has(gameSystem, /sys_getCombatBounds\s*\(\)/), 'combat bounds helper exists');
check(has(gameSystem, /sys_getCombatColumnCenterX\s*\(col,\s*spanCols\s*=\s*1\)/), 'combat column center helper exists');
check(
    has(gamePhase, /wallLeftX\s*=\s*combatBounds\.left[\s\S]{0,160}wallRightX\s*=\s*combatBounds\.right[\s\S]{0,160}render_combat_walls\(this\.ctx,\s*wallLeftX,\s*wallRightX,\s*wallTopY\)/) &&
    has(renderSystem, /render_combat_walls\s*\(ctx,\s*wallLeftX,\s*wallRightX,\s*wallTopY\)[\s\S]*lineTo\(wallRightX,\s*wallTopY\)/),
    'combat walls are drawn at inset arena bounds'
);
check(has(gamePhase, /leftBound\s*=\s*combatBounds\.left\s*\+\s*radius[\s\S]*rightBound\s*=\s*combatBounds\.right\s*-\s*radius[\s\S]*rightBound\s*-\s*current\.x[\s\S]*leftBound\s*-\s*current\.x/), 'combat aim guide uses inset arena side walls');
check(
    has(emitterGeometry, /muzzle\s*=\s*base\.add\(aimDir\.mult\(EMITTER_PORT_OFFSET_Y\)\)/) &&
    has(emitterGeometry, /port:\s*new\s+Vec2\(base\.x,\s*base\.y\)/),
    'launcher geometry fires from turret center and keeps muzzle as visual endpoint'
);
check(has(gameSystem, /calcCombatLauncherGeometryToTarget\(this\.width,\s*this\.height,\s*targetPos\)[\s\S]{0,120}targetPos\.sub\(launcherGeometry\.port\)/), 'combat release velocity is calculated from the turret center anchor');
check(has(gamePhase, /calcCombatLauncherGeometryToTarget\(this\.width,\s*this\.height,\s*this\.lastMousePos\)[\s\S]{0,120}const\s+start\s*=\s*aimGeometry\.port/), 'combat aim guide starts at the turret center anchor');
check(has(gamePhase, /fallbackPort\s*=\s*calcCombatLauncherGeometry\(this\.width,\s*this\.height,\s*shot\.vel\)\.port[\s\S]{0,500}render_queueLauncherBarrelFireEffect\(shot\.vel,\s*shot\.recipe\)/), 'burstQueue shots, including greedy wheel refires, use turret-center fallback and barrel flash');
check(
    has(renderSystem, /render_queueLauncherBarrelFireEffect\s*\(vel,\s*recipe\s*=\s*\{\}\)/) &&
    has(renderSystem, /_launcherBarrelFireFx/) &&
    has(renderSystem, /globalCompositeOperation\s*=\s*['"]screen['"]/),
    'launcher barrel fire feedback is rendered from the emitter art layer'
);
check(!has(spawnSystem, /spawn_createLauncherFireEffect/), 'old launcher particle/shockwave muzzle VFX is removed');
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
check(has(enemy, /_tryResolveDefenseBarrierMove\s*\(game,\s*moveAmount\)/), 'enemies resolve guardian barrier movement before normal advance');
check(has(enemy, /this\.dropTargetY\s*=\s*barrierY[\s\S]{0,180}_defenseBarrierArrivedThisTurn\s*=\s*true/), 'guardian barrier first contact clamps enemy at the defense line without spending a layer');
check(has(enemy, /const\s+barrierDamage\s*=\s*this\._getDefenseBarrierDamage\(game\)[\s\S]{0,120}game\.playerShield\s*=\s*Math\.max\(0,\s*\(game\.playerShield\s*\|\|\s*0\)\s*-\s*barrierDamage\)[\s\S]{0,120}_defenseBarrierHitThisTurn\s*=\s*true/), 'guardian barrier later movement collision spends footprint-scaled shield layers');
check(has(enemy, /_getDefenseBarrierDamage\s*\(game\)[\s\S]{0,220}_getFootprintCells\(game\)[\s\S]{0,180}siegeBreakerDamageMult/), 'guardian barrier damage scales by enemy footprint and siegeBreaker multiplier');
check(has(gamePhase, /_defenseBarrierArrivedThisTurn\s*=\s*false[\s\S]{0,100}_defenseBarrierHitThisTurn\s*=\s*false/), 'guardian barrier per-turn collision flags reset at enemy phase start');
check(has(gamePhase, /_restoreLivingArmorForTurn[\s\S]{0,160}_tickPhaseShieldForTurn[\s\S]{0,160}_tickArmorSporeForTurn/), 'enemy turn start restores living armor, advances phase shield, and distributes armor spores');
check(
    has(enemy, /_tickBossPhysicsForTurn\s*\(\)[\s\S]{0,2600}bossType\s*===\s*['"]devourer['"][\s\S]{0,2600}bossType\s*===\s*['"]ouroboros['"]/) &&
    has(enemy, /_tickBossMechanicsForTurn\s*\(game\)[\s\S]{0,1200}_tickTeslaNetwork\(game\)[\s\S]{0,1200}_tickGlaciesFrostSeams\(game\)[\s\S]{0,1200}_tickViridisSporeArmor\(game\)[\s\S]{0,1200}_tickChimeraMawField\(game\)[\s\S]{0,1200}_tickOuroborosOrbit\(game\)/) &&
    has(enemy, /startTurnAction\s*\(game\)[\s\S]{0,220}_tickBossPhysicsForTurn\(\)[\s\S]{0,2600}_tickBossMechanicsForTurn\(game\)/),
    'Boss turn start uses centralized physics and mechanics tick gateways'
);
check(has(gamePhase, /防线屏障 \$\{this\.playerShield\}/), 'combat render exposes active guardian barrier layers at the defense line');
check(
    has(gameSystem, /if\s*\(\(this\.playerShield\s*\|\|\s*0\)\s*>\s*0\)/) &&
    has(gameSystem, /const\s+barrierY\s*=\s*this\.defeatLineY\s*-\s*e\.height\s*\/\s*2/) &&
    has(gameSystem, /e\.dropTargetY\s*=\s*Math\.min\(e\.dropTargetY,\s*barrierY\)/) &&
    has(gameSystem, /e\.pos\.y\s*=\s*Math\.min\(e\.pos\.y,\s*barrierY\)/),
    'defeat check clamps shielded enemies back to the barrier instead of consuming shield'
);
check(!has(gameSystem, /playerShield[\s\S]{0,220}e\.active\s*=\s*false/), 'guardian barrier no longer deletes enemies during defeat checks');
check(has(enemy, /blockedPierce:\s*isPierce/), 'deflectionWard damage result reports pierce blocking on absorbed pierce hits');
check(has(projectile, /const\s+blockedPierce\s*=\s*!!\(damageResult\s*&&\s*damageResult\.blockedPierce\)/), 'projectile collision reads blockedPierce from damage result');
check(has(projectile, /blockedPierce\s*&&\s*this\.piercesLeft\s*>\s*0[\s\S]{0,120}this\.piercesLeft--[\s\S]{0,180}NO PIERCE/), 'blocked pierce consumes a pierce layer and does not pass through the deflection ward');
check(has(projectile, /affixes\s*&&\s*e\.affixes\.includes\(['"]deflectShell['"]\)[\s\S]{0,520}deflectShellNormalRotateAmp[\s\S]{0,420}normal\s*=\s*new\s+Vec2/), 'deflectShell rotates the collision normal for 1x1 enemy bounce targeting');
check(has(read('src/combat_system.js'), /return\s+damageResult/), 'combat damage returns enemy takeDamage result to projectile collision');
check(has(config, /guardian_barrier[\s\S]{0,260}防线屏障[\s\S]{0,220}移动撞击消耗 1 层屏障/), 'guardian barrier relic copy describes defense-line collision layers');
check(
    has(config, /energyArmorThresholdPct/) &&
    has(config, /phaseShieldCycle/) &&
    has(config, /overloadStepPct/) &&
    has(config, /livingArmorPct/) &&
    has(config, /siegeBreakerDamageMult/) &&
    has(config, /carrierSpawnInterval/),
    'enemy-targeting affix config includes only the approved armor, barrier, overload, and carrier thresholds'
);
check(has(gameSystem, /energyArmorShield[\s\S]{0,260}livingArmorHp[\s\S]{0,260}livingArmorBaseMax[\s\S]{0,260}livingArmorStacked[\s\S]{0,260}phaseShieldTurn[\s\S]{0,260}overloadBonusThisTurn[\s\S]{0,260}carrierCooldown/), 'run save state persists enemy-targeting affix state');
const bossSaveFields = [
    /bossOwnerId:\s*e\.bossOwnerId/,
    /bossMinionRole:\s*e\.bossMinionRole/,
    /bossMechanicTags:\s*Array\.isArray\(e\.bossMechanicTags\)/,
    /furnacePressure:\s*e\.furnacePressure/,
    /viridisSporeBloom:\s*e\.viridisSporeBloom/,
    /teslaFieldPower:\s*e\.teslaFieldPower/,
    /teslaSummonCharge:\s*e\._teslaSummonCharge/,
    /frostSeamTurns:\s*e\.frostSeamTurns/,
    /chimeraDigestCooldown:\s*e\._chimeraDigestCooldown/,
    /_bossVulnerabilityProgress:\s*e\._bossVulnerabilityProgress/,
];
const bossLoadFields = [
    /e\.bossOwnerId\s*=\s*d\.bossOwnerId/,
    /e\.bossMinionRole\s*=\s*d\.bossMinionRole/,
    /e\.bossMechanicTags\s*=\s*Array\.isArray\(d\.bossMechanicTags\)/,
    /e\.furnacePressure\s*=\s*d\.furnacePressure/,
    /e\.viridisSporeBloom\s*=\s*d\.viridisSporeBloom/,
    /e\.teslaFieldPower\s*=\s*d\.teslaFieldPower/,
    /e\._teslaSummonCharge\s*=\s*d\.teslaSummonCharge/,
    /e\.frostSeamTurns\s*=\s*d\.frostSeamTurns/,
    /e\._chimeraDigestCooldown\s*=\s*d\.chimeraDigestCooldown/,
    /e\._bossVulnerabilityProgress\s*=\s*d\._bossVulnerabilityProgress/,
];
check(
    bossSaveFields.every(re => has(gameSystem, re)) && bossLoadFields.every(re => has(gameSystem, re)),
    'run save/load persists Boss mechanic resources, minion metadata, and vulnerability state'
);
check(has(enemy, "const affixes = ['haste', 'jump'];") && has(enemy, 'drone._isCarrierDrone = true;') && has(enemy, /_getCarrierBayPosition/) && has(enemy, /_pushCarrierBayOccupant/) && has(enemy, /_carrierLaunchDroneMovement/), 'carrier pushes bay occupants and immediately launches haste+jump drones from bay slot 5');
const enemyVisualAssets = read('src/data/enemy_visual_assets.js');
const enemySpriteManifest = read('assets/sprites/enemies/enemy_sprite_manifest.json');
check(
    has(enemyVisualAssets, /export function resolveDynamicEnemyOverlayPaths/) &&
    has(enemyVisualAssets, /energyArmorShield/) &&
    has(enemyVisualAssets, /livingArmorStacked/) &&
    has(enemyVisualAssets, /phaseShieldDisabledThisTurn/) &&
    has(enemyVisualAssets, /_overloadBonusThisTurn/) &&
    has(enemy, /resolveDynamicEnemyOverlayPaths\(this\)/) &&
    has(enemy, /overlayKey === this\._visualOverlayKey/),
    'stateful enemy-targeting overlays can be resolved without changing assetKey'
);
const targetingOverlayFiles = [
    'overlay_energy_armor_charged.png',
    'overlay_energy_armor_empty.png',
    'overlay_phase_shield_active.png',
    'overlay_phase_shield_disabled.png',
    'overlay_living_armor_high.png',
    'overlay_living_armor_mid.png',
    'overlay_living_armor_low.png',
    'overlay_living_armor_stack_high.png',
    'overlay_living_armor_stack_mid.png',
    'overlay_living_armor_stack_low.png',
    'overlay_overload_reactor_1.png',
    'overlay_overload_reactor_2.png',
    'overlay_overload_reactor_3.png',
    'overlay_affix_lowDamageImmune.png',
    'overlay_affix_armorSpore.png',
    'overlay_affix_siegeBreaker.png',
    'overlay_affix_carrier.png',
    'overlay_affix_deflectShell.png',
];
check(
    targetingOverlayFiles.every(file => fs.existsSync(path.join(repoRoot, 'assets/sprites/enemies/overlays', file))) &&
    has(enemySpriteManifest, /"dynamicOverlays"\s*:\s*\{[\s\S]*"energyArmor"[\s\S]*"phaseShield"[\s\S]*"livingArmor"[\s\S]*"overloadReactor"/) &&
    has(enemySpriteManifest, /"lowDamageImmune"\s*:\s*"overlay_affix_lowDamageImmune\.png"/) &&
    has(enemy, /hasReadyOverlay\s*=\s*\(id\)/) &&
    has(enemy, /targetingOverlayAffixes\.has\(item\.affix\)/),
    'enemy-targeting PNG border overlays are generated, manifest-registered, and prioritized over Canvas fallback'
);
const targetingOverlayFootprints = ['2x1', '1x2', '2x2', '3x1', '1x3', '2x3', '3x2', '3x3'];
const sampledFootprintOverlaySizes = [
    ['overlay_phase_shield_active_3x2.png', 384, 256],
    ['overlay_living_armor_high_2x3.png', 256, 384],
    ['overlay_affix_lowDamageImmune_3x1.png', 384, 128],
    ['overlay_affix_carrier_3x2.png', 384, 256],
    ['overlay_energy_armor_charged_2x1.png', 256, 128],
    ['overlay_overload_reactor_3_3x2.png', 384, 256],
];
check(
    has(enemyVisualAssets, /function\s+_resolveOverlayVariantFile\s*\(affix,\s*fileOrDef,\s*footprint\s*=\s*['"]1x1['"]\)/) &&
    has(enemyVisualAssets, /return\s+fileOrDef\.replace\([^\n]+`\_\$\{footprint\}\.png`\)/) &&
    has(enemyVisualAssets, /const\s+footprint\s*=\s*`\$\{cols\}x\$\{rows\}`/) &&
    has(enemyVisualAssets, /resolveDynamicEnemyOverlayPaths[\s\S]*const\s+footprint\s*=\s*`\$\{\(enemy\.gridCols\s*\|\|\s*1\)\}x\$\{\(enemy\.gridRows\s*\|\|\s*1\)\}`/) &&
    has(targetingOverlayGenerator, /FOOTPRINTS\s*=\s*\[\(1,\s*1\),\s*\(2,\s*1\),\s*\(1,\s*2\),\s*\(2,\s*2\),\s*\(3,\s*1\),\s*\(1,\s*3\),\s*\(2,\s*3\),\s*\(3,\s*2\),\s*\(3,\s*3\)\]/) &&
    has(targetingOverlayGenerator, /def\s+expand_overlay_to_footprint\s*\(src,\s*cols,\s*rows\):/) &&
    has(targetingOverlayGenerator, /def\s+carrier\s*\(\):[\s\S]{0,180}draw_segmented_frame\(img,\s*91,\s*"#67e8f9",\s*sides=\("top",\s*"left",\s*"right"\)/) &&
    targetingOverlayFootprints.every(footprint => targetingOverlayFiles.every(file => fs.existsSync(path.join(
        repoRoot,
        'assets/sprites/enemies/overlays',
        file.replace(/\.png$/, `_${footprint}.png`)
    )))) &&
    sampledFootprintOverlaySizes.every(([file, width, height]) => {
        const size = readPngSize(path.join('assets/sprites/enemies/overlays', file));
        return size && size.width === width && size.height === height;
    }) &&
    fs.existsSync(path.join(repoRoot, 'docs/design/enemy_targeting_overlay_footprints_contact_sheet.png')),
    'enemy-targeting PNG border overlays have footprint-specific variants and runtime size selection'
);
check(
    has(enemy, /_drawEnemyTargetingFallback\s*\(ctx,\s*w,\s*h\)/) &&
    has(enemy, /_armorSporeTrailTimer/) &&
    has(enemy, /case\s+['"]carrier['"]/) &&
    has(enemy, /fillRect\(-cellW\s*\/\s*2\s*\+\s*pad,\s*pad\s*\*\s*0\.55/) &&
    has(enemy, /hasAffix\(['"]deflectShell['"]\)[\s\S]{0,140}\(this\.gridCols\s*\|\|\s*1\)\s*<=\s*1/),
    'enemy-targeting affixes have Canvas fallback art for spore trails, carrier bay holes, and 1x1 deflect shells'
);
check(
    has(enemy, /@section:targeting_fallback_border_frame/) &&
    has(enemy, /drawEdgeSegment\s*=\s*\(/) &&
    has(enemy, /drawCornerBracket\s*=\s*\(/) &&
    has(enemy, /drawArrowHead\s*=\s*\(/) &&
    has(enemy, /edgePointToward\s*=\s*\(/) &&
    has(enemy, /hasAffix\(['"]carrier['"]\)[\s\S]{0,900}bayLeft[\s\S]{0,900}bayRight/) &&
    has(enemy, /hasAffix\(['"]deflectShell['"]\)[\s\S]{0,900}Math\.PI \* 0\.48/) &&
    has(enemy, /ctx\.restore\(\);\s*return;\s*\}\s*\}\s*_drawAffixBitmapOverlays/),
    'enemy-targeting Canvas fallback is border-frame art and returns before old center-blocking glyphs'
);
check(
    has(systems, /id:\s*['"]ev2_enemy_targeting_fallback['"]/) &&
    has(systems, /setupTargetingFallbackAcceptance/) &&
    has(systems, /name:\s*['"]蓄能甲['"]/) &&
    has(systems, /name:\s*['"]相位护盾·断['"]/) &&
    has(systems, /name:\s*['"]过量炉\+3['"]/) &&
    has(systems, /name:\s*['"]低伤免疫['"]/) &&
    has(systems, /name:\s*['"]活甲 >50%['"]/) &&
    has(systems, /name:\s*['"]叠甲 <20%['"]/) &&
    has(systems, /_armorSporeTrailFromX\s*=\s*sporeSource\.pos\.x/),
    'training ground exposes an enemy-targeting fallback acceptance scenario'
);
check(
    has(systems, /@section:enemy_v2_targeting_footprints/) &&
    has(systems, /id:\s*['"]ev2_enemy_targeting_footprints['"]/) &&
    has(systems, /setupTargetingFootprintAcceptance/) &&
    has(systems, /name:\s*['"]overload 3x3['"][\s\S]{0,140}affixes:\s*\[['"]overloadReactor['"]\][\s\S]{0,100}baseArchetype:\s*['"]gravityWell['"]/) &&
    has(systems, /name:\s*['"]phase 1x2['"][\s\S]{0,140}affixes:\s*\[['"]phaseShield['"],\s*['"]shield['"]\][\s\S]{0,100}baseArchetype:\s*['"]echoSpire['"]/) &&
    has(systems, /name:\s*['"]energy 2x1['"][\s\S]{0,140}affixes:\s*\[['"]energyArmor['"]\][\s\S]{0,100}baseArchetype:\s*['"]deflector['"]/) &&
    has(systems, /name:\s*['"]immune 3x1['"][\s\S]{0,140}affixes:\s*\[['"]lowDamageImmune['"]\][\s\S]{0,100}baseArchetype:\s*['"]bastion['"]/) &&
    has(systems, /name:\s*['"]living 2x3['"][\s\S]{0,140}affixes:\s*\[['"]livingArmor['"]\][\s\S]{0,100}baseArchetype:\s*['"]hive['"]/) &&
    has(systems, /name:\s*['"]carrier 3x2['"][\s\S]{0,140}affixes:\s*\[['"]carrier['"]\][\s\S]{0,100}baseArchetype:\s*['"]carrier['"]/) &&
    has(systems, /name:\s*['"]siege 3x1['"][\s\S]{0,140}affixes:\s*\[['"]siegeBreaker['"]\][\s\S]{0,100}baseArchetype:\s*['"]bastion['"]/),
    'training ground exposes a footprint-aware enemy-targeting overlay acceptance scenario'
);
check(has(spawnSystem, /footprintCells\s*=\s*5/) && has(spawnSystem, /\[1,\s*0,\s*1\]/) && has(config, /carrierSpawnInterval:\s*1/), 'carrier is a five-cell U footprint with empty slot 5 and spawns every turn');
check(has(systems, /针对提示：\$\{meta\.targeting\}/), 'V2 bestiary uses targeting tips rather than counter tips');
check(has(enemyV2Metadata, /targeting:\s*['"][^'"]*穿透会被拦下/), 'deflector metadata states pierce is blocked by the ward');
check(!has(enemyV2Metadata, /\bcounter:/), 'V2 enemy metadata no longer uses counter fields');
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
check(!has(read('src/pinboard_modules.js'), /const\s+defaultLayout\s*=\s*createDefaultModuleLayout\(count,\s*defaultSlots\)/), 'pinboard normalization does not refill intentionally emptied active slots');
check(has(read('src/ui_system.js'), /_moduleEditor_describeRuneTargets[\s\S]*槽位[\s\S]*_moduleEditor_buildRunePreviewChainHtml[\s\S]*作用位置/), 'pinboard rune fusion preview names the target module slot');
check(has(config, /id:\s*['"]pinboard_second_row['"][\s\S]*effect:\s*['"]module_row_unlock['"][\s\S]*targetSlots:\s*10/), 'relic database includes second-row pinboard unlock relic');
check(!has(config, /name:\s*['"]旧/), 'relic database no longer contains relic names starting with 旧');

check(has(gameOver, /ui_clearTransientOverlays\s*\(\)/), 'gameover trigger clears transient overlays');
check(has(gameOver, /meta_addCurrency\(settled\)/), 'gameover settlement writes leftover run fragments through unified resource API');
check(has(read('src/ui/shop.js'), /meta_getResourceCount\(['"]rune_fragments['"]\)/), 'meta shop currency display reads unified rune fragment resource');
check(has(indexHtml, /id=["']shop-resource-overview["']/), 'meta shop has a visible resource overview container');
check(has(read('src/ui/shop.js'), /Object\.values\(META_SHOP_CONFIG\.resources\s*\|\|\s*\{\}\)\.forEach/), 'meta shop resource overview renders every configured resource');
check(has(read('src/ui/shop.js'), /debugStartRelicIds[\s\S]*selectedSet[\s\S]*debugStartRelicId/), 'debug relic picker persists multiple next-run relics with legacy single-id compatibility');
check(has(read('src/game_system.js'), /debugStartRelicIds[\s\S]*debugStartRelics[\s\S]*forEach\(relic[\s\S]*ui_selectRelic\(relic,\s*\{\s*skipClose:\s*true/), 'new run applies every selected debug start relic');
check(has(indexHtml, /relic-debug-picker \.relic-card\.selected/), 'debug relic picker has visible multi-select state');
check(has(read('src/config.js'), /debugShopDefaultEnabled:\s*true/), 'debug tool category is visible by default');
check(has(read('src/ui/shop.js'), /debugShopDisabled[\s\S]*debugShopDefaultEnabled[\s\S]*echo_debug_shop['"]\)\s*===\s*['"]1/), 'meta shop debug tab honors default-on config and localStorage override');
check(has(read('src/ui_system.js'), /debugShopDisabled[\s\S]*debugShopDefaultEnabled[\s\S]*echo_debug_shop['"]\)\s*===\s*['"]1/), 'debug purchase guard honors default-on config and localStorage override');
check(has(read('src/ui/rune_launcher.js'), /meta_getResourceCount\(['"]rune_fragments['"]\)/), 'rune launcher shard display reads unified rune fragment resource');
check(has(indexHtml, /game\.ui_abandonRunToMeta\(\)/), 'pause abandon button uses ui_abandonRunToMeta');
check(has(indexHtml, /id=["']run-shop-status-dock["']/), 'run-shop countdown dock exists');
check(has(runShop, /const\s+visiblePhase\s*=\s*this\.phase\s*===\s*['"]gathering['"]\s*\|\|\s*this\.phase\s*===\s*['"]combat['"]/), 'run shop countdown remains visible in gathering and combat');
check(has(gamePhase, /multicast:\s*Math\.max\(0,\s*Math\.floor\(marbleDef\.multicast\s*\|\|\s*0\)\)/), 'gathering sessions inherit stored marble multicast layers');
check(has(gamePhase, /const\s+inheritedMulticast\s*=\s*Math\.max\(0,\s*Math\.floor\(marbleDef\.multicast\s*\|\|\s*0\)\)[\s\S]{0,220}recipe\.multicast\s*=\s*inheritedMulticast/), 'combat fallback compile preserves stored marble multicast layers');
check(has(indexHtml, /id=["']session-charge-stack["'][\s\S]{0,80}session-charge-stack/), 'gathering HUD has a three-session charge stack container');
check(has(read('src/ui/hud.js'), /_hud_renderSessionChargeStack[\s\S]{0,900}session-charge-row[\s\S]{0,360}session-charge-multicast/), 'gathering HUD renders per-marble charge and multicast rows');
check(has(read('src/ui/hud.js'), /UI_HIT_PROGRESS[\s\S]{0,220}_hud_renderSessionChargeStack/), 'hit progress updates refresh the per-marble charge stack');
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
