/**
 * Run lifecycle integrity contracts.
 *
 * Covers behavior that must remain deterministic without a browser and leaves
 * full focus traversal / refresh flows to the localhost:3002 browser gate.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');

let passed = 0;
const failures = [];
function check(condition, message) {
    if (condition) passed++;
    else {
        failures.push(message);
        console.log(`  x ${message}`);
    }
}

class MemoryStorage {
    constructor() { this.data = new Map(); }
    getItem(key) { return this.data.has(key) ? this.data.get(key) : null; }
    setItem(key, value) { this.data.set(key, String(value)); }
    removeItem(key) { this.data.delete(key); }
    clear() { this.data.clear(); }
}

class FakeClassList {
    constructor() { this.values = new Set(); }
    add(...names) { names.forEach(name => this.values.add(name)); }
    remove(...names) { names.forEach(name => this.values.delete(name)); }
    contains(name) { return this.values.has(name); }
    toggle(name, force) {
        const next = force === undefined ? !this.values.has(name) : !!force;
        next ? this.values.add(name) : this.values.delete(name);
        return next;
    }
}

class FakeElement {
    constructor(id = '') {
        this.id = id;
        this.style = {};
        this.dataset = {};
        this.attributes = new Map();
        this.classList = new FakeClassList();
        this.children = [];
        this.parentNode = null;
        this.isConnected = true;
        this.disabled = false;
        this.textContent = '';
        this.innerText = '';
        this.innerHTML = '';
        this.listeners = new Map();
    }
    setAttribute(name, value) { this.attributes.set(name, String(value)); }
    getAttribute(name) { return this.attributes.get(name) ?? null; }
    removeAttribute(name) { this.attributes.delete(name); }
    addEventListener(type, fn) { this.listeners.set(type, fn); }
    removeEventListener(type, fn) { if (this.listeners.get(type) === fn) this.listeners.delete(type); }
    appendChild(child) { child.parentNode = this; this.children.push(child); return child; }
    removeChild(child) { this.children = this.children.filter(entry => entry !== child); child.parentNode = null; }
    remove() { this.parentNode?.removeChild(this); this.isConnected = false; }
    querySelector(selector) { return this.queryMap?.get(selector) || null; }
    querySelectorAll() { return []; }
    focus() { globalThis.document.activeElement = this; }
    getBoundingClientRect() { return { left: 0, top: 0, width: 400, height: 700 }; }
}

class FakeClock {
    constructor() { this.nextId = 1; this.tasks = new Map(); }
    schedule(fn) { const id = this.nextId++; this.tasks.set(id, { fn, cancelled: false }); return id; }
    cancel(id) { const task = this.tasks.get(id); if (task) task.cancelled = true; }
    runAll({ includeCancelled = false } = {}) {
        const tasks = [...this.tasks.values()];
        this.tasks.clear();
        tasks.forEach(task => { if (includeCancelled || !task.cancelled) task.fn(); });
    }
}

const elements = new Map();
const body = new FakeElement('body');
elements.set('toast', new FakeElement('toast'));
elements.set('round-num', new FakeElement('round-num'));
globalThis.document = {
    body,
    activeElement: body,
    getElementById: id => elements.get(id) || null,
    createElement: tag => new FakeElement(tag),
    querySelectorAll: () => [],
    querySelector: () => null,
};
globalThis.localStorage = new MemoryStorage();
globalThis.window = {
    showToast() {},
    matchMedia: () => ({ matches: false }),
    addEventListener() {},
    removeEventListener() {},
};

const clock = new FakeClock();
globalThis.setTimeout = fn => clock.schedule(fn);
globalThis.clearTimeout = id => clock.cancel(id);
globalThis.requestAnimationFrame = fn => clock.schedule(fn);
globalThis.cancelAnimationFrame = id => clock.cancel(id);

const [{ game_system }, { ui_system }, { run_shop }, { shop_system }] = await Promise.all([
    import('../src/game_system.js'),
    import('../src/ui_system.js'),
    import('../src/ui/run_shop.js'),
    import('../src/ui/shop.js'),
]);

function bind(game, system) {
    for (const [name, value] of Object.entries(system)) {
        if (typeof value === 'function') game[name] = value.bind(game);
    }
    return game;
}

function makeLifecycleGame() {
    return bind({
        phase: 'combat',
        round: 1,
        width: 400,
        height: 700,
        enemies: [],
        pendingRoundStartRewards: [],
        fieldLootItems: [],
        projectiles: [],
        burstQueue: [],
        pendingShots: [],
        energyOrbs: [],
        dropBalls: [],
        gatheringSessions: [],
        triangleSideWheels: [],
    }, game_system);
}

// Replace-ammo selection is a durable selection checkpoint, including an
// intentionally empty or partial set chosen by the player.
{
    const game = bind(makeLifecycleGame(), ui_system);
    game.phase = 'selection';
    game.replaceAmmoContext = {
        active: true,
        newRecipes: [{ damage: 2 }],
        chargedRecipes: [{ damage: 5 }, { damage: 7 }],
        selectedIndices: [0, 2],
    };
    game.ui_renderReplaceAmmoUI = () => {};
    let saveCalls = 0;
    game.sys_saveRunState = () => { saveCalls++; return true; };
    check(game.ui_toggleReplaceAmmoCard(2) === true
        && game.replaceAmmoContext.selectedIndices.length === 1
        && game.replaceAmmoContext.selectedIndices[0] === 0
        && saveCalls === 1,
    'replace-ammo card toggles persist the exact in-progress selection');
}

console.log('===================================================');
console.log('  Run lifecycle integrity validation');
console.log('===================================================\n');

// Pause ownership: order-independent, duplicate-safe, stale-token safe.
{
    const game = makeLifecycleGame();
    const a = game.sys_acquirePauseLease('pause');
    const b = game.sys_acquirePauseLease('shop');
    check(a !== b && game.isPaused === true, 'pause leases return distinct opaque tokens');
    check(game.sys_releasePauseLease(a) === true && game.isPaused === true, 'releasing one nested lease keeps simulation paused');
    check(game.sys_releasePauseLease(a) === false && game.isPaused === true, 'duplicate lease release is harmless');
    check(game.sys_releasePauseLease({}) === false && game.isPaused === true, 'unknown lease release is harmless');
    check(game.sys_releasePauseLease(b) === true && game.isPaused === false, 'last lease release resumes simulation');
    const stale = game.sys_acquirePauseLease('old-run');
    game.sys_invalidateRunLifecycle('test');
    const fresh = game.sys_acquirePauseLease('new-run');
    check(game.sys_releasePauseLease(stale) === false && game.isPaused === true, 'old-run lease cannot release a new-run owner');
    check(game.sys_releasePauseLease(fresh) === true && game.isPaused === false, 'new-run lease still releases normally');

    let continuationRuns = 0;
    const outer = game.sys_acquirePauseLease('outer-overlay');
    const inner = game.sys_acquirePauseLease('inner-overlay');
    const deferred = game.sys_runOrDeferLifecycleContinuation(
        'paused-transition',
        () => continuationRuns++,
        { expectedPhase: 'combat' }
    );
    check(deferred === 'deferred' && continuationRuns === 0, 'pause lease parks a due state-machine continuation');
    game.sys_releasePauseLease(outer);
    check(continuationRuns === 0, 'nested pause owner keeps deferred lifecycle work frozen');
    game.sys_releasePauseLease(inner);
    check(continuationRuns === 1, 'last pause owner release flushes deferred lifecycle work once');
}

// Native cancellation is not the only guard: force a cancelled callback to run.
{
    const game = makeLifecycleGame();
    let mutations = 0;
    game.sys_scheduleLifecycleTimeout(() => mutations++, 10);
    game.sys_invalidateRunLifecycle('forced-clock');
    clock.runAll({ includeCancelled: true });
    check(mutations === 0, 'run epoch rejects a forced stale timeout callback');

    const phaseToken = game.sys_captureLifecycleToken({ phaseBound: true });
    game._phaseLifecycleEpoch++;
    check(game.sys_isLifecycleTokenCurrent(phaseToken) === false, 'phase epoch invalidates phase-bound continuations');

    const deferred = makeLifecycleGame();
    const runToken = deferred.sys_captureLifecycleToken();
    let resumed = 0;
    deferred.phase = 'truth_book';
    deferred.truthBookReturnState = { phase: 'combat' };
    const outcome = deferred.sys_runOrDeferLifecycleContinuation('truth-book-resume', () => resumed++, {
        token: runToken,
        expectedPhase: 'combat',
    });
    check(outcome === 'deferred' && resumed === 0, 'must-deliver continuation parks in a returnable temporary phase');
    deferred.phase = 'combat';
    check(deferred.sys_flushDeferredLifecycleContinuations() === 1 && resumed === 1, 'parked continuation runs once when its gameplay phase returns');

    let cancelled = 0;
    deferred.phase = 'truth_book';
    deferred.truthBookReturnState = { phase: 'combat' };
    deferred.sys_runOrDeferLifecycleContinuation('abandoned-deferred', () => resumed++, {
        token: deferred.sys_captureLifecycleToken(),
        expectedPhase: 'combat',
        onCancel: () => cancelled++,
    });
    deferred.sys_invalidateRunLifecycle('abandon-deferred');
    check(cancelled === 1 && resumed === 1, 'abandon cancels a parked continuation without running it');
}

// Banner and resolver callbacks cannot resurrect after abandon/reset.
{
    const game = makeLifecycleGame();
    let combatStarts = 0;
    game.phase_startCombatPhase = () => { combatStarts++; };
    game.sys_showRoundStartBanner({ durationMs: 1200, flowId: 'stale-banner' });
    game.phase = 'meta';
    game.sys_invalidateRunLifecycle('abandon');
    clock.runAll({ includeCancelled: true });
    check(combatStarts === 0 && game.phase === 'meta', 'abandon invalidates the round-start banner combat callback');

    let revealCallback = null;
    let grindStarts = 0;
    game.phase = 'combat';
    game.ui_playLootToCardAnimation = (_x, _y, _type, cb) => { revealCallback = cb; };
    game.sys_startMarblePackGrind = () => { grindStarts++; };
    game.sys_queueRoundStartReward({ id: 'pack-stale', type: 'marble_pack' });
    game.sys_startRoundStartResolver();
    game.sys_invalidateRunLifecycle('new-run');
    revealCallback?.();
    check(grindStarts === 0, 'old resolver animation callback cannot enter gathering in a new run');

    const interrupted = makeLifecycleGame();
    interrupted.sys_maybeOfferRunShopBeforeRoundStart = () => false;
    interrupted.ui_handlePotionAlchemyInterrupt = () => false;
    check(interrupted.sys_startRoundStartResolver() === false
        && !interrupted._roundStartTerminalKey
        && !interrupted._roundStartBannerFlowKey,
    'cancelled pre-banner interruption does not consume the terminal flow');
    interrupted.ui_handlePotionAlchemyInterrupt = () => true;
    check(interrupted.sys_startRoundStartResolver() === true
        && !!interrupted._roundStartTerminalKey,
    'terminal resolver can retry after a cancelled pre-banner interruption');
    interrupted.sys_invalidateRunLifecycle('cleanup');
    clock.runAll({ includeCancelled: true });
}

// A vetoed alchemy interrupt owns a single retry and cannot commit selection
// state before the draft has actually been resolved.
{
    const game = makeLifecycleGame();
    game.phase = 'selection';
    game._potionAlchemyDraft = { consumedRunes: [{ id: 'rune-in-furnace' }] };
    const newRecipe = { id: 'new-ammo', damage: 3 };
    const chargedRecipe = { id: 'charged-ammo', damage: 7 };
    game.ammoQueue = [newRecipe];
    game.replaceAmmoContext = {
        active: true,
        newRecipes: [],
        chargedRecipes: [chargedRecipe],
        selectedIndices: [0],
    };
    game.ui_handlePotionAlchemyInterrupt = () => false;
    let combatStarts = 0;
    game.phase_startCombatPhase = () => { combatStarts++; return true; };
    game.sys_confirmReplaceAmmo();
    check(game.replaceAmmoContext?.active === true
        && game.ammoQueue[0] === newRecipe
        && combatStarts === 0
        && !!game._potionBlockedContinuation,
    'vetoed alchemy interruption preserves replace-ammo state and owns one retry');

    game._potionAlchemyDraft = { consumedRunes: [] };
    game.ui_handlePotionAlchemyInterrupt = () => true;
    game.sys_getRunSavePoint = () => null;
    game.sys_saveRunState();
    game.sys_saveRunState();
    check(game.replaceAmmoContext === null
        && game.ammoQueue[0] === chargedRecipe
        && combatStarts === 1
        && !game._potionBlockedContinuation,
    'draft resolution save atomically retries the blocked combat transition once');
}

// Reward animations defer through a temporary phase instead of mutating behind it.
{
    const game = makeLifecycleGame();
    let revealCallback = null;
    let grants = 0;
    let resolverResumes = 0;
    game.ui_playLootToCardAnimation = (_x, _y, _type, callback) => { revealCallback = callback; };
    game.sys_grantRunResourcePack = () => { grants++; };
    game.sys_queueRoundStartReward({ id: 'temporary-phase-reward', type: 'run_resource_pack' });
    game.sys_startRoundStartResolver();
    game.sys_startRoundStartResolver = () => { resolverResumes++; return true; };
    game.phase = 'truth_book';
    game.truthBookReturnState = { phase: 'combat' };
    revealCallback?.();
    check(grants === 0 && resolverResumes === 0 && game._roundStartResolverActive === true,
        'reward animation completion parks while Truth Book owns the visible phase');
    game.phase = 'combat';
    check(game.sys_flushDeferredLifecycleContinuations() === 1
        && grants === 1
        && resolverResumes === 1,
    'parked reward animation commits exactly once after its gameplay phase returns');
}

// Reward identity and callback replay are idempotent.
{
    const game = makeLifecycleGame();
    const first = game.sys_queueRoundStartReward({ id: 'resource-1', type: 'run_resource_pack' });
    const duplicate = game.sys_queueRoundStartReward({ id: 'resource-1', type: 'run_resource_pack' });
    check(first === duplicate && game.pendingRoundStartRewards.length === 1, 'duplicate reward ID queues only once');

    let revealCallback = null;
    let grants = 0;
    let banners = 0;
    game.ui_playLootToCardAnimation = (_x, _y, _type, cb) => { revealCallback = cb; };
    game.sys_grantRunResourcePack = () => { grants++; };
    game.sys_maybeOfferRunShopBeforeRoundStart = () => false;
    game.sys_showRoundStartBanner = () => { banners++; return true; };
    game.sys_startRoundStartResolver();
    revealCallback?.();
    revealCallback?.();
    check(grants === 1, 'same resource reward callback grants exactly once');
    check(game.pendingRoundStartRewards.length === 0 && game._resolvedRoundStartRewardIds.has('resource-1'), 'reward completion is persisted by ID');
    check(banners === 1, 'duplicate reward callback cannot duplicate terminal continuation');
}

// Skip-relic shop purchases preserve resolver order and replace one queued pack.
{
    const game = bind(makeLifecycleGame(), run_shop);
    game.runFragments = 100;
    game._runShopReason = 'skip_relic';
    game._runShopSession = { id: 'run-shop-test', active: true };
    game.runShopInventory = [{
        itemId: 'pack-item-1',
        kind: 'marble_pack',
        packId: 'mixed',
        price: 18,
        name: 'pack',
    }];
    game.pendingRoundStartRewards = [
        { id: 'resource-before-pack', type: 'run_resource_pack', source: 'drop' },
        { id: 'queued-pack', type: 'marble_pack', packId: 'mixed', source: 'run_start' },
    ];
    let resolverStarts = 0;
    let directGrinds = 0;
    let silentClose = 0;
    game.sys_startRoundStartResolver = () => { resolverStarts++; return true; };
    game.sys_startMarblePackGrind = () => { directGrinds++; return true; };
    game.ui_hideRunShop = options => { if (options?.invokeOnClose === false) silentClose++; return true; };
    check(game.ui_buyRunShopItem('pack-item-1', 'run-shop-test') === true, 'skip-relic marble pack purchase is accepted once');
    check(game.pendingRoundStartRewards[0].id === 'resource-before-pack'
        && game.pendingRoundStartRewards[1].id === 'queued-pack'
        && game.pendingRoundStartRewards[1].source === 'run_shop_purchase',
    'pack purchase preserves earlier reward order and replaces the queued pack in place');
    check(resolverStarts === 1 && directGrinds === 0 && silentClose === 1, 'skip-relic pack resumes resolver instead of bypassing earlier rewards');
    const fragmentsAfterPurchase = game.runFragments;
    game._runShopSession.active = false;
    game.runShopInventory = [{ itemId: 'stale-item', kind: 'damage', price: 1, value: 99 }];
    check(game.ui_buyRunShopItem('stale-item', 'run-shop-test') === false
        && game.runFragments === fragmentsAfterPurchase,
    'a stale run-shop handler cannot buy from a closed or replaced session');
}

// A resource reward is durably committed before the next relic overlay owns
// the screen, closing the refresh window between adjacent rewards.
{
    localStorage.clear();
    const game = makeLifecycleGame();
    game.phase = 'combat';
    game.round = 4;
    game._roundStartCheckpointReady = true;
    game.ui_playLootToCardAnimation = (_x, _y, _type, callback) => callback();
    game.ui_showRelicSelection = options => {
        game._relicOverlaySession = { active: true, rewardId: options.rewardId };
        return true;
    };
    game.sys_queueRoundStartReward({ id: 'resource-before-relic', type: 'run_resource_pack', fragmentAmount: 11 });
    game.sys_queueRoundStartReward({ id: 'relic-after-resource', type: 'relic' });
    game.sys_startRoundStartResolver();
    const checkpoint = JSON.parse(localStorage.getItem('echo_alchemist_run_state'));
    check(checkpoint.runFragments === 11
        && checkpoint.pendingRoundStartRewards.length === 1
        && checkpoint.pendingRoundStartRewards[0].id === 'relic-after-resource'
        && checkpoint.resolvedRoundStartRewardIds.includes('resource-before-relic'),
    'resource-to-relic handoff persists grant and reward ID before opening the relic overlay');
    localStorage.clear();
}

// Reward-only marble relics still complete their settled overlay exactly once.
{
    const game = bind(makeLifecycleGame(), shop_system);
    const relic = {
        id: 'reward-only-test-relic',
        name: 'Reward Lane Lens',
        effect: 'unlock_marble',
        marbleType: 'laser',
        boost: 10,
    };
    game.ownedRelics = [];
    game.unlockedWeights = {};
    game._relicOverlaySession = {
        id: 'relic-test-session',
        active: true,
        settled: false,
        choiceIds: [relic.id],
    };
    let closes = 0;
    game.ui_closeRelicSelection = () => { closes++; return true; };
    game.combat_recomputeActiveSkills = () => {};
    check(game.ui_selectRelic(relic, { sessionId: 'relic-test-session' }) === true
        && closes === 1
        && game._relicOverlaySession.settled === true
        && game.ownedRelics.filter(id => id === relic.id).length === 1,
    'bottom-reward-only relic settles, grants and closes its overlay once');
    check(game.ui_selectRelic(relic, { sessionId: 'relic-test-session' }) === false
        && closes === 1
        && game.ownedRelics.filter(id => id === relic.id).length === 1,
    'stale relic card callback cannot duplicate a settled reward');
}

// Input cancellation clears every transient and never commits a shot.
{
    const game = makeLifecycleGame();
    game.boardTilt = { target: { x: 1, y: -1 }, current: { x: 0, y: 0 }, enabled: false };
    game.isDragging = true;
    game.dragStart = { x: 1, y: 2 };
    game.dragCurrent = { x: 3, y: 4 };
    game.isTiltingGrip = true;
    game.gripStartPos = { x: 5, y: 6 };
    game._activeInputIdentity = 'touch:9';
    game._activeInputType = 'touchstart';
    game.pendingFireVelocity = { x: 8, y: -8 };
    game.pendingFireOrigin = { x: 1, y: 1 };
    game.isChargingShot = true;
    game.chargeProgress = 0.8;
    let prevented = 0;
    game.input_handleInputCancel({ type: 'touchcancel', cancelable: true, preventDefault: () => prevented++ });
    check(!game.isDragging && !game.dragStart && !game.dragCurrent, 'input cancel clears drag state');
    check(!game.isTiltingGrip && !game.gripStartPos && game.boardTilt.target.x === 0 && game.boardTilt.target.y === 0, 'input cancel clears tilt grip state');
    check(!game._activeInputIdentity && !game._activeInputType, 'input cancel clears pointer identity');
    check(!game.pendingFireVelocity && !game.pendingFireOrigin && !game.isChargingShot && game.chargeProgress === 0, 'input cancel clears pending shot/charge without firing');
    game.input_handleInputCancel({ type: 'pointercancel', cancelable: true, preventDefault: () => prevented++ });
    check(prevented === 2, 'repeated touch/pointer cancellation is idempotent');
}

// Versioned safe checkpoints and bad-save degradation.
{
    localStorage.clear();
    const game = makeLifecycleGame();
    game.phase = 'selection';
    game.round = 7;
    game.score = 12;
    game.marblesPool = [{
        type: 'bounce',
        collected: [{ type: 'pyro', level: 2 }],
        runeSlots: [{ runeId: 'saved-rune', element: 'pyro', level: 2 }],
    }];
    game.selectedMarbles = [0];
    game.marbleQueue = [];
    game.ammoQueue = [{ damage: 3, pyro: 2 }];
    game._carryOverAmmo = [{ damage: 8, lightning: 3 }];
    game.skillChargeActualValue = 0.72;
    game.skillChargeLevel = 2;
    game.enemies = [{
        pos: { x: 40, y: -60 },
        width: 42,
        height: 42,
        hp: 21,
        maxHp: 30,
        type: 'normal',
        affixes: [],
        active: true,
        dropTargetY: 140,
        entranceTimer: 48,
        _entranceStartY: -80,
        _pendingEntrance: false,
        _spawnedThisTurn: true,
        hasActedThisTurn: true,
        rewardType: 'relic',
        _pendingRewardType: 'relic',
        _roundStartRewardQueued: false,
        venomStacks: 6,
        _wasFrozenLastTurn: true,
    }];
    game.pegs = [{
        pos: { x: 44, y: 88 },
        type: 'pink',
        level: 2,
        frozenTurns: 1,
        row: 1,
        col: 2,
        shape: 'barrier',
        segment: { x1: 44, y1: 70, x2: 44, y2: 110 },
        thickness: 9,
        radius: 4.5,
        layoutRole: 'bottom_reward_gate',
        rewardLaneType: 'laser',
    }];
    game.specialSlots = [];
    game.bottomRewardZones = [{
        id: 'saved-zone', type: 'laser', color: '#fff', label: 'Laser',
        x: 30, y: 90, w: 28, h: 48, entryX1: 38, entryX2: 50,
    }];
    game.boardBottomY = 110;
    game.runeGrid = Array(9).fill(null);
    game.activeRunewordEffects = { bloodthirst_growth: { level: 1, params: { damagePerKill: 1 } } };
    game.assimilationBoostRounds = { laser: Infinity };
    game.doubleAssimilationBoostRounds = { laser: Infinity };
    game.windAnchors = [{ x: 12, y: 34, life: 0.8, bulletDamage: 5, bulletConfig: { wind: 2 } }];
    game.stormCores = [{
        pos: { x: 56, y: 78 }, radius: 24, bulletDamage: 4, bulletConfig: { wind: 2 },
        energy: 2, energyRequired: 4, chargeTimer: 3, active: true, alpha: 0.8, pulsePhase: 1.2,
    }];
    game.runewordKillCount = 9;
    game._prevRoundCleared = true;
    game.persistentThreshold = 19;
    check(game.sys_saveRunState() === true, 'selection safe point saves successfully');
    const rawSafe = localStorage.getItem('echo_alchemist_run_state');
    const payload = JSON.parse(rawSafe);
    check(payload.schema === 'echo-alchemist-run-state' && payload.version === 2, 'run checkpoint carries schema and version');
    check(payload.resumePoint === 'selection' && payload.ammoQueue[0].pyro === 2, 'run checkpoint carries resume point and ammo queue');
    check(payload.persistentThreshold === 19, 'run checkpoint persists gathering threshold state');
    check(payload._carryOverAmmo[0].lightning === 3
        && payload.skillChargeActualValue === 0.72
        && payload.skillChargeLevel === 2,
    'run checkpoint preserves carry-over ammo and persistent skill charge');
    check(payload.enemies[0].dropTargetY === 140
        && payload.enemies[0].entranceTimer === 48
        && payload.enemies[0].hasActedThisTurn === true
        && payload.enemies[0].rewardType === 'relic'
        && payload.enemies[0].venomStacks === 6
        && payload.enemies[0].wasFrozenLastTurn === true,
    'run checkpoint preserves enemy entrance, action and reward ownership');
    check(payload.assimilationBoostRounds.laser === 'permanent'
        && payload.doubleAssimilationBoostRounds.laser === 'permanent',
    'permanent assimilation boosts use a JSON-safe sentinel');
    check(payload.pegs[0].type === 'pink'
        && payload.pegs[0].segment.y2 === 110
        && payload.bottomRewardZones[0].id === 'saved-zone',
    'gathering board checkpoint persists exact pink, barrier and reward-zone geometry');
    check(payload.windAnchors[0].bulletConfig.wind === 2
        && payload.stormCores[0].pos.x === 56
        && payload.runewordKillCount === 9
        && payload.prevRoundCleared === true,
    'run checkpoint preserves wind and cross-round runeword/director state');
    check(game.sys_getRunStateSummary().round === 7, 'valid checkpoint inspector exposes the real round');

    const makeRestoreGame = () => {
        const restoring = makeLifecycleGame();
        restoring.saveData = { temporaryUpgrades: {} };
        restoring.ui = { updateSkillPoints() {}, updateSkillBar() {} };
        restoring.activeSkills = [];
        restoring.sys_resetGame = function () {
            this.phase = 'meta';
            this.gameOver = false;
            this.projectiles = [];
            this.burstQueue = [];
            this.pendingShots = [];
            this.energyOrbs = [];
            this.dropBalls = [];
            this.gatheringSessions = [];
            this.triangleSideWheels = [];
            this.enemies = [];
            this.pegs = [];
            this.specialSlots = [];
            this.bottomRewardZones = [];
            this._roundStartResolverActive = false;
            this._roundStartBannerActive = false;
            this._roundStartRelicHookDelayActive = false;
            this._combatCheckpointReady = false;
            return true;
        };
        restoring.meta_applyUpgrades = () => {};
        restoring.combat_recomputeActiveSkills = () => {};
        restoring.combat_skillCharge_syncLegacyState = () => {};
        restoring.combat_skillCharge_initUI = () => {};
        restoring.phase_gathering_initPachinko = function () {
            this.pegs = [];
            this.specialSlots = [];
            this.bottomRewardZones = [];
        };
        restoring.phase_switchPhase = function (phase) { this.phase = phase; };
        restoring.ui_updateRuneCountDisplay = () => {};
        restoring.ui_updateMetaCurrency = () => {};
        restoring.ui_refreshSelectionModeUI = () => {};
        restoring.spawn_showMarblePreview = () => {};
        restoring.ui_initRuneGrid = () => {};
        restoring.ui_updateRuneGrid = () => {};
        restoring._restoreWriteAttempts = 0;
        restoring.spawn_generateMarbleOptions = function () {
            this._restoreWriteAttempts++;
            this.marblesPool = [{ type: 'fresh-generated', collected: [], runeSlots: [] }];
            this.sys_saveRunState();
        };
        return restoring;
    };

    const restoreSeedRaw = JSON.stringify({ ...payload, enemies: [] });
    localStorage.setItem('echo_alchemist_run_state', restoreSeedRaw);
    const firstRestore = makeRestoreGame();
    check(firstRestore.sys_loadRunState() === true
        && firstRestore._restoreWriteAttempts === 1
        && firstRestore._runStateRestoreActive === false,
    'real selection restore blocks re-entrant save writes during option rendering');
    check(firstRestore.marblesPool?.[0]?.runeSlots?.[0]?.runeId === 'saved-rune'
        && firstRestore.marblesPool?.[0]?.collected?.[0]?.type === 'pyro'
        && firstRestore.selectedMarbles[0] === 0,
    'real restore keeps complete saved marble definitions and selection');
    check(firstRestore.pegs?.[0]?.type === 'pink'
        && firstRestore.pegs?.[0]?.segment?.y2 === 110
        && firstRestore.bottomRewardZones?.[0]?.id === 'saved-zone'
        && firstRestore.assimilationBoostRounds.laser === Infinity
        && typeof firstRestore.stormCores?.[0]?.pos?.dist === 'function',
    'real restore reconstructs deterministic board geometry and permanent/runtime vector state');
    const firstRestoreRaw = localStorage.getItem('echo_alchemist_run_state');
    localStorage.setItem('echo_alchemist_run_state', firstRestoreRaw);
    const secondRestore = makeRestoreGame();
    check(secondRestore.sys_loadRunState() === true
        && secondRestore.marblesPool?.[0]?.runeSlots?.[0]?.runeId === 'saved-rune'
        && secondRestore.selectedMarbles[0] === 0,
    'a second refresh preserves the first restore without type-only selection drift');

    const replaceRestoreRaw = JSON.stringify({
        ...payload,
        enemies: [],
        marblesPool: [],
        selectedMarbles: [],
        replaceAmmoContext: {
            active: true,
            newRecipes: [{ damage: 3 }],
            chargedRecipes: [{ damage: 8 }, { damage: 13 }],
            selectedIndices: [0],
        },
    });
    localStorage.setItem('echo_alchemist_run_state', replaceRestoreRaw);
    const replaceRestore = makeRestoreGame();
    replaceRestore.ui_renderReplaceAmmoUI = () => {};
    check(replaceRestore.sys_loadRunState() === true
        && replaceRestore.replaceAmmoContext.selectedIndices.length === 1
        && replaceRestore.replaceAmmoContext.selectedIndices[0] === 0,
    'replace-ammo restore preserves a validated partial selection without auto-filling it');

    const mismatched = { ...payload, resumePoint: 'gathering_idle' };
    localStorage.setItem('echo_alchemist_run_state', JSON.stringify(mismatched));
    check(game.sys_hasRunState() === false, 'phase/resume-point mismatch is rejected instead of guessing a restore route');
    localStorage.setItem('echo_alchemist_run_state', restoreSeedRaw);

    localStorage.setItem('echo_alchemist_run_state', JSON.stringify({ ...payload, enemies: [null] }));
    check(game.sys_hasRunState() === false, 'malformed enemy records are rejected before Continue is displayed');
    localStorage.setItem('echo_alchemist_run_state', JSON.stringify({
        ...payload,
        enemies: [{ ...payload.enemies[0], footprintMask: [null] }],
    }));
    check(game.sys_hasRunState() === false, 'malformed nested enemy footprint masks are rejected before hydration');
    localStorage.setItem('echo_alchemist_run_state', JSON.stringify({
        ...payload,
        enemies: [{
            ...payload.enemies[0],
            collisionShape: 'polygon',
            collisionData: { vertices: {} },
        }],
    }));
    check(game.sys_hasRunState() === false, 'malformed polygon collision vertices are rejected before hydration');
    localStorage.setItem('echo_alchemist_run_state', JSON.stringify({ ...payload, runeGrid: {} }));
    check(game.sys_hasRunState() === false, 'non-array restore fields are rejected before Continue is displayed');
    localStorage.setItem('echo_alchemist_run_state', restoreSeedRaw);

    const failedRestore = makeRestoreGame();
    failedRestore.phase_gathering_initPachinko = () => { throw new Error('forced hydrate failure'); };
    check(failedRestore.sys_loadRunState() === false
        && failedRestore.phase === 'meta'
        && failedRestore._runStateRestoreActive === false
        && localStorage.getItem('echo_alchemist_run_state') === null,
    'a mid-hydration exception resets to meta and discards the partially applied checkpoint');
    localStorage.setItem('echo_alchemist_run_state', rawSafe);

    game.projectiles = [{ active: true }];
    check(game.sys_saveRunState() === false && localStorage.getItem('echo_alchemist_run_state') === rawSafe, 'unsafe projectile state cannot overwrite the last checkpoint');
    localStorage.setItem('echo_alchemist_run_state', '{broken');
    check(game.sys_hasRunState() === false && localStorage.getItem('echo_alchemist_run_state') === null, 'malformed checkpoint is hidden and discarded safely');
}

// Save-point ownership excludes transition windows and stale round-start latches.
{
    const game = makeLifecycleGame();
    game.phase = 'gathering';
    game.ammoQueue = [{ damage: 4 }];
    check(game.sys_getRunSavePoint() === null, 'settled gathering ammo blocks a duplicate-launch checkpoint during the transition window');

    game.phase = 'combat';
    game._roundStartCheckpointReady = false;
    game._combatCheckpointReady = false;
    game.pendingRoundStartRewards = [{ id: 'late-drop', type: 'run_resource_pack' }];
    check(game.sys_getRunSavePoint() === null, 'a partially consumed combat turn cannot overwrite the entry checkpoint');
    game._combatCheckpointReady = true;
    check(game.sys_getRunSavePoint() === 'combat_idle', 'only the post-initialization combat latch owns a combat checkpoint');
    game._roundStartCheckpointReady = true;
    check(game.sys_getRunSavePoint() === 'round_start', 'only the explicit finalized-round latch owns a round-start checkpoint');
    game.sys_invalidateRunLifecycle('checkpoint-test');
    check(game._roundStartCheckpointReady === false && game._combatCheckpointReady === false, 'run invalidation clears every checkpoint latch');

    const savedAmmo = [{ id: 'remaining-ammo', damage: 9 }];
    game.phase = 'meta';
    game.ammoQueue = savedAmmo;
    let phaseStarts = 0;
    let uiRefreshes = 0;
    game.phase_switchPhase = phase => { game.phase = phase; };
    game.phase_startCombatPhase = () => { phaseStarts++; };
    game.ui_updateUICache = () => { uiRefreshes++; };
    game.ui_updateAmmoUI = () => { uiRefreshes++; };
    game.ui_renderRecipeHUD = () => { uiRefreshes++; };
    check(game.sys_resumeCombatCheckpoint() === true
        && game.phase === 'combat'
        && game.ammoQueue === savedAmmo
        && phaseStarts === 0
        && uiRefreshes === 3,
    'combat checkpoint resume rebuilds UI without replaying round initialization or ammo compilation');
}

// Terminal abandon and repeat-open overlays keep single-owner semantics.
{
    const game = bind(makeLifecycleGame(), ui_system);
    const calls = [];
    let draftInterrupted = false;
    game.ui_closePause = () => calls.push('pause');
    game.ui_clearTransientOverlays = () => calls.push('transient');
    game.ui_handlePotionAlchemyInterrupt = (context, options) => {
        calls.push(`interrupt:${context}:${options?.confirm}`);
        draftInterrupted = true;
        return true;
    };
    game.ui_closeRuneLauncher = () => {
        calls.push(`launcher:${draftInterrupted}`);
        return draftInterrupted;
    };
    game.sys_clearRunState = () => calls.push('clear');
    game.sys_resetGame = () => calls.push('reset');
    game.phase_switchPhase = phase => calls.push(`phase:${phase}`);
    game.meta_updateContinueButton = () => calls.push('continue');
    game.ui_abandonRunToMeta();
    check(calls.indexOf('interrupt:abandon_run:false') < calls.indexOf('launcher:true'), 'abandon force-cancels an alchemy draft before closing the launcher');

    const layer = new FakeElement('module-editor-layer');
    const focusTarget = new FakeElement('module-editor-focus');
    layer.queryMap = new Map([[
        'button:not([disabled]), [href], input:not([disabled]), [tabindex]:not([tabindex="-1"])',
        focusTarget,
    ]]);
    elements.set('module-editor-layer', layer);
    const originalComplete = () => {};
    game._moduleEditorActive = true;
    game._moduleEditorState = { onComplete: originalComplete };
    check(game.ui_showModuleEditor(() => {}) === false
        && game._moduleEditorState.onComplete === originalComplete
        && document.activeElement === focusTarget,
    'repeat-opening the module editor preserves its original callback and restores focus');
    elements.delete('module-editor-layer');
}

// Continue button consumes validated metadata instead of displaying Round ?.
{
    const game = bind(makeLifecycleGame(), ui_system);
    const button = new FakeElement('meta-continue-btn');
    const roundLabel = new FakeElement('continue-round');
    button.queryMap = new Map([['.continue-round', roundLabel]]);
    elements.set('meta-continue-btn', button);
    game.sys_getRunStateSummary = () => ({ valid: true, round: 12, phase: 'combat' });
    game.meta_updateContinueButton();
    check(button.style.display === 'block' && button.disabled === false && roundLabel.textContent === 'Round 12', 'continue button displays validated Round 12');
    game.sys_getRunStateSummary = () => ({ valid: false, round: null });
    game.meta_updateContinueButton();
    check(button.style.display === 'none' && button.disabled === true && button.getAttribute('aria-disabled') === 'true', 'invalid checkpoint hides and disables Continue');
    elements.delete('meta-continue-btn');
}

// Source-level integration anchors for browser-only overlays and phase timers.
const gameSource = read('src/game_system.js');
const phaseSource = read('src/game_phase.js');
const uiSource = read('src/ui_system.js');
const runShopSource = read('src/ui/run_shop.js');
const shopSource = read('src/ui/shop.js');

check(/touchcancel[\s\S]{0,160}input_handleInputCancel/.test(gameSource), 'touchcancel is bound to shared cancellation cleanup');
check(/pointercancel[\s\S]{0,160}input_handleInputCancel/.test(gameSource), 'pointercancel is bound to shared cancellation cleanup');
check((phaseSource.match(/sys_scheduleLifecycleTimeout/g) || []).length >= 6, 'phase coordinator routes gameplay timers through lifecycle guards');
check((phaseSource.match(/sys_runOrDeferLifecycleContinuation/g) || []).length >= 4, 'must-deliver phase transitions defer across temporary phases');
check(/phase_startGatheringPhase\(\)[\s\S]{0,4200}sys_saveRunState/.test(phaseSource), 'gathering initializer owns its stable checkpoint');
check(/phase_startCombatPhase\(\)[\s\S]{0,9000}_combatCheckpointReady\s*=\s*true[\s\S]{0,260}sys_saveRunState[\s\S]{0,180}_combatCheckpointReady\s*=\s*false/.test(phaseSource), 'combat initialization exposes only one replay-safe checkpoint instant');
check(/phase_combat_update\([^)]*\)\s*{\s*if \(this\.gameOver\) return/.test(phaseSource), 'combat update stops scheduling gameover after the first terminal decision');
check(/phase_switchPhase\(newPhase\)[\s\S]{0,500}_phaseLifecycleEpoch/.test(phaseSource), 'real phase transitions advance the phase epoch');
check(/ui_openPause\(\)[\s\S]{0,700}sys_acquirePauseLease/.test(uiSource) && /ui_closePause\(\)[\s\S]{0,700}sys_releasePauseLease/.test(uiSource), 'pause overlay owns and releases only its lease');
check(!/ui_closePause\(\)[\s\S]{0,360}isPaused\s*=\s*false/.test(uiSource), 'pause close never directly unpauses another owner');
check(/ui_showChaosBulletSlotMachine[\s\S]{0,2200}sys_runOrDeferLifecycleContinuation/.test(uiSource), 'slot-machine animation defers and re-enters after a temporary phase interruption');
check(/_runShopSession\?\.active/.test(runShopSource) && /invokeOnClose:\s*false/.test(runShopSource), 'run shop repeat-open and takeover use an idempotent session');
check(/role',\s*'dialog'/.test(runShopSource) && /aria-modal/.test(runShopSource) && /aria-disabled/.test(runShopSource), 'run shop exposes dialog and disabled semantics');
check(/restoreFocusAfterRender/.test(runShopSource) && /focusedItemId/.test(runShopSource), 'run shop restores focus after inventory rerenders');
check(/_relicOverlaySession/.test(shopSource) && /session\.settled\s*=\s*true/.test(shopSource), 'relic actions settle their overlay session before effects');
check(/aria-labelledby',\s*'relic-dialog-title'/.test(shopSource) && /_trapDialogFocus/.test(shopSource) && /e\.key\s*!==\s*'Enter'/.test(shopSource), 'relic overlay exposes dialog, focus trap and keyboard activation');
check(/buyBtn\.disabled\s*=\s*!canAfford/.test(shopSource) && /buyBtn\.setAttribute\('aria-disabled'/.test(shopSource), 'meta shop disabled state is native and explained');

console.log('\n===================================================');
console.log(`  Result: ${passed}/${passed + failures.length} passed`);
if (failures.length) failures.forEach(message => console.log(`    - ${message}`));
console.log('===================================================');
if (failures.length) process.exit(1);
