/**
 * REQ-20260717-first-run-tutorial T1 contract tests.
 *
 * Covers the tutorial-owned lifecycle only. The production phase/resolver
 * implementation is locked separately by validate_phase_contracts.mjs.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { eventBus, EVENT_TYPES } from '../src/event_bus.js';
import { tutorial_system } from '../src/tutorial_system.js';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const tutorialSource = fs.readFileSync(path.join(repoRoot, 'src/tutorial_system.js'), 'utf8').replace(/\r\n/g, '\n');

let passed = 0;
let failed = 0;
const failures = [];

function check(condition, label) {
    if (condition) {
        passed += 1;
        console.log(`  ✓ ${label}`);
        return;
    }
    failed += 1;
    failures.push(label);
    console.log(`  ✗ ${label}`);
}

function createTutorialGame(overrides = {}) {
    const game = {
        phase: 'meta',
        saveData: { tutorialCompleted: false },
        saveCalls: 0,
        removedDom: 0,
        sys_saveData() { this.saveCalls += 1; },
        sys_clearRunState() {},
        phase_switchPhase(nextPhase) { this.phase = nextPhase; },
    };

    for (const [key, value] of Object.entries(tutorial_system)) {
        if (typeof value === 'function') game[key] = value.bind(game);
        else if (Array.isArray(value)) game[key] = [...value];
        else game[key] = value;
    }

    game._tutorial_createDOM = () => {};
    game._tutorial_removeDOM = () => { game.removedDom += 1; };
    Object.assign(game, overrides);
    return game;
}

function withFakeSchedulers(run) {
    const original = {
        setTimeout: globalThis.setTimeout,
        clearTimeout: globalThis.clearTimeout,
        requestAnimationFrame: globalThis.requestAnimationFrame,
        cancelAnimationFrame: globalThis.cancelAnimationFrame,
    };
    let nextId = 1;
    const tasks = new Map();
    const schedule = (callback) => {
        const id = nextId++;
        tasks.set(id, callback);
        return id;
    };
    const cancel = id => tasks.delete(id);

    globalThis.setTimeout = schedule;
    globalThis.clearTimeout = cancel;
    globalThis.requestAnimationFrame = schedule;
    globalThis.cancelAnimationFrame = cancel;

    const controls = {
        pending: () => tasks.size,
        runAll() {
            while (tasks.size > 0) {
                const batch = [...tasks.entries()];
                tasks.clear();
                batch.forEach(([, callback]) => callback());
            }
        },
    };

    try {
        run(controls);
    } finally {
        globalThis.setTimeout = original.setTimeout;
        globalThis.clearTimeout = original.clearTimeout;
        if (original.requestAnimationFrame === undefined) delete globalThis.requestAnimationFrame;
        else globalThis.requestAnimationFrame = original.requestAnimationFrame;
        if (original.cancelAnimationFrame === undefined) delete globalThis.cancelAnimationFrame;
        else globalThis.cancelAnimationFrame = original.cancelAnimationFrame;
    }
}

function getStepBlock(id) {
    const marker = `id: '${id}'`;
    const start = tutorialSource.indexOf(marker);
    if (start < 0) return '';
    const next = tutorialSource.indexOf("\n    {\n        id: '", start + marker.length);
    return tutorialSource.slice(start, next < 0 ? tutorialSource.length : next);
}

console.log('===================================================');
console.log('  First-run tutorial flow contract validation');
console.log('===================================================');

const stepIds = [...tutorialSource.matchAll(/^\s{8}id:\s*'([^']+)'/gm)].map(match => match[1]);
check(
    JSON.stringify(stepIds) === JSON.stringify([
        'welcome',
        'start_run',
        'relic_selection',
        'gathering_intro',
        'combat_intro',
        'tutorial_complete',
    ]),
    'tutorial steps match the real relic -> marble_pack -> gathering -> combat flow'
);

const relicStep = getStepBlock('relic_selection');
const startRunStep = getStepBlock('start_run');
check(/position:\s*['"]top['"]/.test(startRunStep), 'start-run card stays above the highlighted home button');
check(/phase:\s*null/.test(relicStep), 'relic overlay does not invent a non-existent relic phase');
check(/data\.to\s*===\s*['"]gathering['"]/.test(relicStep), 'relic step waits for the real gathering transition');
check(!/data\.to\s*===\s*['"]selection['"]/.test(relicStep), 'relic step never waits for ordinary selection');
check(/coarsePointer/.test(relicStep) && /再次/.test(relicStep) && /单击/.test(relicStep), 'relic copy distinguishes coarse-pointer confirmation from desktop single click');

check(/const\s+guideH\s*=\s*rect\.height\s*\*\s*0\.85/.test(tutorialSource), 'gathering launch guide uses the real 85% input region');
check(!/const\s+guideH\s*=\s*rect\.height\s*\*\s*0\.4\b/.test(tutorialSource), 'obsolete 40% gathering input guidance is absent');
check(!/setTimeout\s*\(\s*\(\)\s*=>\s*this\.tutorial_start\(\)\s*,\s*800\s*\)/.test(tutorialSource), 'uncancellable fixed 800ms startup is removed');

const completionWrites = tutorialSource.match(/tutorialCompleted\s*=\s*true/g) || [];
check(completionWrites.length === 1, 'tutorial completion has one persisted write owner');
check(/tutorial_complete\s*\([^)]*\)\s*\{[\s\S]{0,500}tutorialCompleted\s*=\s*true/.test(tutorialSource), 'the persisted completion write belongs to tutorial_complete');
check(!/tutorial_end\s*\(\s*(?:true|false)\s*\)/.test(tutorialSource), 'tutorial_end is teardown-only and has no boolean completion call sites');

withFakeSchedulers(({ pending, runAll }) => {
    const phaseListenerBaseline = eventBus.listenerCount(EVENT_TYPES.PHASE_CHANGED);
    let starts = 0;
    const game = createTutorialGame({ tutorial_start() { starts += 1; } });

    game.tutorial_checkAndStart();
    check(pending() === 1, 'initial tutorial start is scheduled exactly once');
    check(eventBus.listenerCount(EVENT_TYPES.PHASE_CHANGED) === phaseListenerBaseline + 1, 'pending start owns one phase invalidation listener');

    eventBus.emit(EVENT_TYPES.PHASE_CHANGED, { from: 'meta', to: 'gathering' });
    check(pending() === 0, 'phase invalidation cancels the pending start');
    runAll();
    check(starts === 0, 'a cancelled start cannot create a stale tutorial');
    check(eventBus.listenerCount(EVENT_TYPES.PHASE_CHANGED) === phaseListenerBaseline, 'phase invalidation listener is cleaned after cancellation');

    game.phase = 'meta';
    game.saveData.tutorialCompleted = false;
    game.tutorial_checkAndStart();
    game.tutorial_checkAndStart();
    check(pending() === 1, 'rescheduling replaces the previous pending start');
    runAll();
    check(starts === 1, 'the latest valid pending start runs once');
    check(eventBus.listenerCount(EVENT_TYPES.PHASE_CHANGED) === phaseListenerBaseline, 'successful start also cleans its phase listener');

    game.phase = 'meta';
    game.saveData.tutorialCompleted = false;
    game.tutorial_checkAndStart();
    game.tutorial_skipAll();
    check(pending() === 0, 'skip cancels a pending start');
    runAll();
    check(starts === 1, 'skip prevents the cancelled start from reviving the tutorial');
    if (typeof game._tutorial_cancelPendingStart === 'function') game._tutorial_cancelPendingStart();
});

withFakeSchedulers(({ pending, runAll }) => {
    const phaseListenerBaseline = eventBus.listenerCount(EVENT_TYPES.PHASE_CHANGED);
    let nextCalls = 0;
    const game = createTutorialGame({
        _tutorialActive: true,
        _tutorialStepIndex: 2,
        tutorial_nextStep() { nextCalls += 1; },
    });
    const step = {
        waitForEvent: EVENT_TYPES.PHASE_CHANGED,
        waitForEventFilter: data => data?.to === 'gathering',
        autoAdvance: true,
    };

    game._tutorial_registerWaitEvent(step);
    eventBus.emit(EVENT_TYPES.PHASE_CHANGED, { from: 'meta', to: 'selection' });
    check(pending() === 0 && nextCalls === 0, 'non-matching phase events do not advance the tutorial');

    eventBus.emit(EVENT_TYPES.PHASE_CHANGED, { from: 'meta', to: 'gathering' });
    check(pending() === 0 && nextCalls === 1, 'matching phase event advances synchronously without a missable delay');
    eventBus.emit(EVENT_TYPES.PHASE_CHANGED, { from: 'meta', to: 'gathering' });
    check(nextCalls === 1, 'a consumed step event cannot advance twice');
    check(eventBus.listenerCount(EVENT_TYPES.PHASE_CHANGED) === phaseListenerBaseline, 'successful auto-advance leaves no listener behind');

    game._tutorial_registerWaitEvent(step);
    game._tutorial_cleanupListeners();
    check(pending() === 0, 'step cleanup leaves no scheduled work');
    eventBus.emit(EVENT_TYPES.PHASE_CHANGED, { from: 'meta', to: 'gathering' });
    runAll();
    check(nextCalls === 1, 'cleaned listener cannot move a later tutorial session');
    check(eventBus.listenerCount(EVENT_TYPES.PHASE_CHANGED) === phaseListenerBaseline, 'step cleanup removes its EventBus listener');
});

withFakeSchedulers(({ pending, runAll }) => {
    let starts = 0;
    const game = createTutorialGame({ tutorial_start() { starts += 1; } });
    game.tutorial_restartFromHome();
    game.tutorial_restartFromHome();
    check(pending() === 1, 'restarting from home replaces its previous pending start');
    runAll();
    check(starts === 1, 'the latest home restart starts once');
    if (typeof game._tutorial_cancelPendingStart === 'function') game._tutorial_cancelPendingStart();
});

{
    const game = createTutorialGame({ _tutorialActive: true });
    check(typeof game.tutorial_complete === 'function', 'tutorial_complete is the single completion API');
    if (typeof game.tutorial_complete === 'function') {
        game.tutorial_complete('flow');
        game.tutorial_complete('duplicate');
        check(game.saveData.tutorialCompleted === true, 'completion persists the tutorial flag');
        check(game.saveCalls === 1, 'duplicate completion is persistence-idempotent');
    }

    const teardownOnly = createTutorialGame({ _tutorialActive: true });
    teardownOnly.tutorial_end();
    check(teardownOnly.saveData.tutorialCompleted === false && teardownOnly.saveCalls === 0, 'tutorial_end only tears down and does not complete');

    const skipped = createTutorialGame({ _tutorialActive: true });
    skipped.tutorial_skipAll();
    check(skipped.saveData.tutorialCompleted === true && skipped.saveCalls === 1, 'skip uses the same persisted completion owner');
}

console.log('');
console.log('===================================================');
console.log(`  Result: ${passed}/${passed + failed} passed`);
if (failed > 0) {
    console.log('');
    console.log('  Failed checks:');
    failures.forEach(label => console.log(`    - ${label}`));
}
console.log('===================================================');

if (failed > 0) process.exit(1);
