/**
 * validate_launcher_settlement_ux.mjs - Goal D launcher / codex / settlement UX contracts.
 *
 * Usage:
 *   node tests/validate_launcher_settlement_ux.mjs
 */

import fs from 'fs';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { CONFIG } from '../src/config.js';
import { RUNE_DB, RUNEWORD_DB } from '../src/rune_config.js';
import { audio } from '../src/audio.js';

class FakeElement {
    constructor(id = '', tagName = 'div') {
        this.id = id;
        this.tagName = String(tagName || 'div').toUpperCase();
        this.children = [];
        this.parentElement = null;
        this.dataset = {};
        this.style = {};
        this.attributes = new Map();
        this.listeners = new Map();
        this.disabled = false;
        this.hidden = false;
        this.isConnected = true;
        this._innerHTML = '';
        this._className = '';
        this._classes = new Set();
        this.classList = {
            add: (...names) => names.forEach(name => this._classes.add(name)),
            remove: (...names) => names.forEach(name => this._classes.delete(name)),
            contains: name => this._classes.has(name),
            [Symbol.iterator]: () => this._classes.values(),
        };
    }

    set className(value) {
        this._className = String(value || '');
        this._classes = new Set(this._className.split(/\s+/).filter(Boolean));
    }

    get className() {
        return [...this._classes].join(' ');
    }

    set innerHTML(value) {
        this._innerHTML = String(value || '');
        if (this._innerHTML === '') this.children = [];
    }

    get innerHTML() { return this._innerHTML; }
    set textContent(value) { this._textContent = String(value ?? ''); }
    get textContent() { return this._textContent || ''; }

    appendChild(child) {
        child.parentElement = this;
        child.isConnected = true;
        this.children.push(child);
        return child;
    }

    insertBefore(child, before) {
        child.parentElement = this;
        child.isConnected = true;
        const index = this.children.indexOf(before);
        if (index < 0) this.children.push(child);
        else this.children.splice(index, 0, child);
        return child;
    }

    setAttribute(name, value) { this.attributes.set(name, String(value)); }
    getAttribute(name) { return this.attributes.has(name) ? this.attributes.get(name) : null; }
    removeAttribute(name) { this.attributes.delete(name); }

    addEventListener(type, listener) {
        if (!this.listeners.has(type)) this.listeners.set(type, []);
        this.listeners.get(type).push(listener);
    }

    dispatch(type, init = {}) {
        const event = {
            type,
            target: this,
            currentTarget: this,
            key: '',
            shiftKey: false,
            pointerType: '',
            defaultPrevented: false,
            propagationStopped: false,
            preventDefault() { this.defaultPrevented = true; },
            stopPropagation() { this.propagationStopped = true; },
            ...init,
        };
        for (const listener of this.listeners.get(type) || []) listener(event);
        return event;
    }

    _descendants() {
        return this.children.flatMap(child => [child, ...child._descendants()]);
    }

    querySelectorAll(selector) {
        const nodes = this._descendants();
        if (selector === '.rune-picker-option-active') {
            return nodes.filter(node => node.classList.contains('rune-picker-option-active'));
        }
        if (selector.startsWith('#')) return nodes.filter(node => node.id === selector.slice(1));
        if (selector.startsWith('.')) return nodes.filter(node => node.classList.contains(selector.slice(1)));
        if (selector.includes('button')) return nodes.filter(node => node.tagName === 'BUTTON' && !node.disabled);
        return [];
    }

    querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }
    contains(node) { return node === this || this._descendants().includes(node); }
    closest(selector) {
        if (selector === '.hidden' && this.classList.contains('hidden')) return this;
        return this.parentElement ? this.parentElement.closest(selector) : null;
    }
    focus() { globalThis.document.activeElement = this; this.focused = true; }
    scrollIntoView() { this.scrolledIntoView = true; }
    getBoundingClientRect() { return { top: 0, left: 0, width: 100, height: 40 }; }
    remove() {
        this.isConnected = false;
        if (this.parentElement) {
            this.parentElement.children = this.parentElement.children.filter(child => child !== this);
        }
    }
}

const elements = new Map();
const body = new FakeElement('body', 'body');
const windowListeners = new Map();

globalThis.document = {
    body,
    activeElement: body,
    getElementById(id) { return elements.get(id) || null; },
    createElement(tag) { return new FakeElement('', tag); },
};
globalThis.window = {
    getComputedStyle() {
        return { display: 'flex', visibility: 'visible', opacity: '1', zIndex: '300' };
    },
    confirm: () => true,
    showToast: true,
    innerWidth: 390,
    addEventListener(type, listener) {
        if (!windowListeners.has(type)) windowListeners.set(type, []);
        windowListeners.get(type).push(listener);
    },
    dispatch(type, init = {}) {
        const event = { type, ...init };
        for (const listener of windowListeners.get(type) || []) listener(event);
        return event;
    },
};

let nextTimerId = 1;
const timers = new Map();
globalThis.setTimeout = callback => {
    const id = nextTimerId++;
    timers.set(id, callback);
    return id;
};
globalThis.clearTimeout = id => timers.delete(id);

function flushTimers() {
    const callbacks = [...timers.values()];
    timers.clear();
    callbacks.forEach(callback => callback());
}

audio.muted = true;

const { rune_launcher_system } = await import('../src/ui/rune_launcher.js');
const { game_over_mixin } = await import('../src/ui/game_over.js');
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const launcherSource = fs.readFileSync(path.join(repoRoot, 'src/ui/rune_launcher.js'), 'utf8');
const gameoverSource = fs.readFileSync(path.join(repoRoot, 'src/ui/game_over.js'), 'utf8');

let passed = 0;
let failed = 0;
const failures = [];

function check(condition, message) {
    if (condition) {
        passed += 1;
        return;
    }
    failed += 1;
    failures.push(message);
    console.log(`  x ${message}`);
}

function resetDom() {
    elements.clear();
    body.children = [];
    body.classList.remove('pc-mode');
    document.activeElement = body;
    window.innerWidth = 390;
    windowListeners.clear();
    timers.clear();
}

function register(element) {
    if (element.id) elements.set(element.id, element);
    return element;
}

function attachMethods(target, source) {
    Object.entries(source).forEach(([name, value]) => {
        if (typeof value === 'function') target[name] = value;
    });
    return target;
}

function makePickerDom() {
    const overlay = register(new FakeElement('rune-picker-overlay'));
    overlay.classList.add('hidden');
    const detail = register(new FakeElement('rune-picker-detail'));
    const list = register(new FakeElement('rune-picker-list'));
    const tooltip = register(new FakeElement('runeword-preview-tooltip'));
    tooltip.classList.add('hidden');
    const tooltipContent = register(new FakeElement('runeword-preview-content'));
    overlay.appendChild(detail);
    overlay.appendChild(list);
    overlay.appendChild(tooltip);
    tooltip.appendChild(tooltipContent);
    body.appendChild(overlay);
    return { overlay, detail, list, tooltip, tooltipContent };
}

function makePickerGame() {
    const game = attachMethods({
        runeInventory: [{ id: 'rune_pyro_1', level: 1 }],
        runeGrid: [
            null, null, null,
            null, { id: 'rune_pyro_2', level: 1 }, { id: 'rune_pyro_1', level: 1 },
            null, null, null,
        ],
    }, rune_launcher_system);
    game.ui_updateRuneGrid = () => {};
    return game;
}

console.log('Launcher and settlement UX validation');

// Touch short-press / long-press / cancel are tested against real registered handlers.
resetDom();
let pickerDom = makePickerDom();
let pickerGame = makePickerGame();
pickerGame.ui_openRunePicker(3);
let option = pickerDom.list.children[0];
option.dispatch('touchstart');
flushTimers();
check(!pickerDom.tooltip.classList.contains('hidden'), 'long press exposes a visible description');
option.dispatch('touchend');
check(pickerGame.runeInventory.length === 1 && pickerGame.runeGrid[3] == null, 'long-press touchend does not select a rune');

resetDom();
pickerDom = makePickerDom();
pickerGame = makePickerGame();
pickerGame.ui_openRunePicker(3);
option = pickerDom.list.children[0];
option.dispatch('touchstart');
option.dispatch('touchend');
check(pickerGame.runeInventory.length === 0 && pickerGame.runeGrid[3]?.id === 'rune_pyro_1', 'short touch selects exactly one rune');

resetDom();
pickerDom = makePickerDom();
pickerGame = makePickerGame();
pickerGame.ui_openRunePicker(3);
option = pickerDom.list.children[0];
option.dispatch('touchstart');
option.dispatch('touchcancel');
flushTimers();
check(pickerGame.runeInventory.length === 1 && pickerGame.runeGrid[3] == null, 'touchcancel clears press state without selecting');

resetDom();
pickerDom = makePickerDom();
pickerGame = makePickerGame();
pickerGame.ui_openRunePicker(3);
option = pickerDom.list.children[0];
const dragStart = option.dispatch('touchstart', { touches: [{ clientX: 20, clientY: 20 }] });
option.dispatch('touchmove', { touches: [{ clientX: 20, clientY: 42 }] });
option.dispatch('touchend', { changedTouches: [{ clientX: 20, clientY: 42 }] });
flushTimers();
check(!dragStart.defaultPrevented && pickerGame.runeInventory.length === 1 && pickerGame.runeGrid[3] == null, 'touch movement remains scrollable and cancels rune selection');

resetDom();
const pickerOpener = new FakeElement('picker-opener', 'button');
body.appendChild(pickerOpener);
pickerOpener.focus();
pickerDom = makePickerDom();
pickerGame = makePickerGame();
pickerGame.ui_openRunePicker(3);
option = pickerDom.list.children[0];
check(pickerDom.overlay.getAttribute('role') === 'dialog' && !!pickerDom.overlay.getAttribute('aria-label'), 'rune picker has a named dialog contract');
check(document.activeElement === option, 'rune picker moves focus to its first option');
const pickerTab = pickerDom.overlay.dispatch('keydown', { key: 'Tab' });
check(pickerTab.defaultPrevented && document.activeElement === option, 'rune picker traps Tab focus');
pickerDom.overlay.dispatch('keydown', { key: 'Escape' });
check(pickerDom.overlay.classList.contains('hidden') && document.activeElement === pickerOpener, 'picker Escape closes the top dialog and restores its opener');

// Launcher lease, dialog semantics, focus loop, Escape, and focus restoration.
resetDom();
const opener = new FakeElement('launcher-opener', 'button');
body.appendChild(opener);
opener.focus();
const panel = register(new FakeElement('phase-rune-launcher'));
panel.style.display = 'none';
const closeButton = new FakeElement('launcher-close', 'button');
closeButton.classList.add('rune-launcher-close-btn');
const lastButton = new FakeElement('launcher-last', 'button');
panel.appendChild(closeButton);
panel.appendChild(lastButton);
body.appendChild(panel);
const pickerOverlay = register(new FakeElement('rune-picker-overlay'));
pickerOverlay.classList.add('hidden');
const leaseToken = { owner: 'rune_launcher' };
const acquired = [];
const released = [];
const launcherGame = attachMethods({
    phase: 'gathering',
    saveData: {},
    sys_acquirePauseLease(ownerId) { acquired.push(ownerId); return leaseToken; },
    sys_releasePauseLease(token) { released.push(token); },
}, rune_launcher_system);
Object.assign(launcherGame, {
    ui_switchRuneTab() {},
    _ui_updateLauncherShardCount() {},
    ui_updatePotionAlchemyPanel() {},
    ui_initRuneGrid() {},
    ui_updateRuneGrid() {},
    _ui_hideRunewordBubble() {},
    ui_handlePotionAlchemyInterrupt() { return true; },
});
launcherGame.ui_openRuneLauncher();
check(acquired.length === 1 && acquired[0] === 'rune_launcher', 'launcher acquires exactly its own pause lease');
check(panel.getAttribute('role') === 'dialog' && !!(panel.getAttribute('aria-label') || panel.getAttribute('aria-labelledby')), 'launcher has a named dialog contract');
lastButton.focus();
const tabEvent = panel.dispatch('keydown', { key: 'Tab' });
check(tabEvent.defaultPrevented && document.activeElement === closeButton, 'Tab wraps focus inside the launcher dialog');
panel.dispatch('keydown', { key: 'Escape' });
check(released.length === 1 && released[0] === leaseToken, 'launcher releases the same opaque pause token once');
check(document.activeElement === opener, 'closing launcher restores focus to its opener');
launcherGame.ui_closeRuneLauncher();
check(released.length === 1, 'repeated launcher close does not release another owner token');
check(!/\bisPaused\s*=/.test(launcherSource), 'launcher never writes the shared isPaused flag directly');

// PC uses a persistent non-modal region: opening it must not create a pause lease or steal focus.
resetDom();
body.classList.add('pc-mode');
window.innerWidth = 1280;
const pcOpener = new FakeElement('pc-launcher-opener', 'button');
body.appendChild(pcOpener);
pcOpener.focus();
const pcPanel = register(new FakeElement('phase-rune-launcher'));
pcPanel.style.display = 'flex';
const pcCloseButton = new FakeElement('pc-launcher-close', 'button');
pcCloseButton.classList.add('rune-launcher-close-btn');
pcPanel.appendChild(pcCloseButton);
body.appendChild(pcPanel);
const pcPickerOverlay = register(new FakeElement('rune-picker-overlay'));
pcPickerOverlay.classList.add('hidden');
const pcAcquired = [];
const pcReleased = [];
const pcLauncherGame = attachMethods({
    phase: 'gathering',
    saveData: {},
    sys_acquirePauseLease(ownerId) { pcAcquired.push(ownerId); return { ownerId }; },
    sys_releasePauseLease(token) { pcReleased.push(token); },
}, rune_launcher_system);
Object.assign(pcLauncherGame, {
    ui_switchRuneTab() {},
    _ui_updateLauncherShardCount() {},
    ui_updatePotionAlchemyPanel() {},
    ui_initRuneGrid() {},
    ui_updateRuneGrid() {},
    _ui_hideRunewordBubble() {},
    ui_handlePotionAlchemyInterrupt() { return true; },
});
pcLauncherGame.ui_openRuneLauncher();
check(pcAcquired.length === 0 && pcReleased.length === 0, 'PC persistent launcher does not acquire or release a pause lease');
check(pcPanel.getAttribute('role') === 'region' && pcPanel.getAttribute('aria-modal') == null, 'PC persistent launcher is a named non-modal region');
check(document.activeElement === pcOpener, 'PC persistent launcher does not focus its CSS-hidden close control');
window.innerWidth = 390;
window.dispatch('resize');
check(pcPanel.style.display === 'none' && pcPanel.getAttribute('aria-hidden') === 'true' && pcAcquired.length === 0, 'PC-to-mobile transition closes the persistent region until an explicit modal open');
body.classList.remove('pc-mode');

// A mobile modal that becomes the PC sidebar relinquishes only its own lease immediately.
resetDom();
const resizeOpener = new FakeElement('resize-launcher-opener', 'button');
body.appendChild(resizeOpener);
resizeOpener.focus();
const resizePanel = register(new FakeElement('phase-rune-launcher'));
resizePanel.style.display = 'none';
const resizeCloseButton = new FakeElement('resize-launcher-close', 'button');
resizeCloseButton.classList.add('rune-launcher-close-btn');
resizePanel.appendChild(resizeCloseButton);
body.appendChild(resizePanel);
const resizePickerOverlay = register(new FakeElement('rune-picker-overlay'));
resizePickerOverlay.classList.add('hidden');
const resizeToken = { owner: 'rune_launcher' };
const resizeReleased = [];
const resizeLauncherGame = attachMethods({
    phase: 'gathering',
    saveData: {},
    sys_acquirePauseLease() { return resizeToken; },
    sys_releasePauseLease(token) { resizeReleased.push(token); },
}, rune_launcher_system);
Object.assign(resizeLauncherGame, {
    ui_switchRuneTab() {},
    _ui_updateLauncherShardCount() {},
    ui_updatePotionAlchemyPanel() {},
    ui_initRuneGrid() {},
    ui_updateRuneGrid() {},
    _ui_hideRunewordBubble() {},
    ui_handlePotionAlchemyInterrupt() { return true; },
});
resizeLauncherGame.ui_openRuneLauncher();
window.innerWidth = 1280;
window.dispatch('resize');
check(resizeReleased.length === 1 && resizeReleased[0] === resizeToken && resizeLauncherGame._runeLauncherPauseToken == null, 'mobile-to-PC transition releases the launcher opaque token exactly once');
check(resizePanel.getAttribute('role') === 'region' && resizePanel.getAttribute('aria-modal') == null && document.activeElement === resizeOpener, 'mobile-to-PC transition ends modal semantics and restores the opener');

// Codex state derives activation from the current grid, ignoring a stale active-id cache.
resetDom();
const codexList = register(new FakeElement('rune-codex-list'));
register(new FakeElement('rune-codex-discovered-count'));
register(new FakeElement('rune-codex-total-count'));
const codexGame = attachMethods({
    saveData: {
        discoveredRunewords: ['runeword_meltdown', 'runeword_absolute_zero', 'runeword_thunderstorm'],
    },
    runeGrid: [
        { id: 'rune_pyro_1', level: 1 }, null, null,
        null, { id: 'rune_pyro_2', level: 1 }, null,
        null, null, { id: 'rune_pyro_1', level: 1 },
    ],
    runeInventory: [
        { id: 'rune_cryo_1', level: 1 },
        { id: 'rune_cryo_2', level: 1 },
        { id: 'rune_cryo_1', level: 1 },
    ],
    _activeRunewordIds: new Set(['runeword_thunderstorm']),
    _ui_renderCodexFilterBar() {},
    _ui_calcRunewordDynamicDesc() { return '动态说明'; },
}, rune_launcher_system);
codexGame.ui_renderRuneCodex();
const cardById = id => codexList.children.find(card => card.dataset.runewordId === id);
check(cardById('runeword_meltdown')?.dataset.codexState === 'active', 'codex marks the current grid parse as active even when the cache is stale');
check(cardById('runeword_absolute_zero')?.dataset.codexState === 'activatable', 'codex marks a discovered formula with enough materials as activatable');
check(cardById('runeword_thunderstorm')?.dataset.codexState === 'insufficient', 'codex marks a discovered formula with missing materials as insufficient');
check(codexList.children.some(card => card.dataset.codexState === 'undiscovered'), 'codex keeps undiscovered entries distinct');
check(!codexList.children.some(card => card.innerHTML.replace(/<[^>]+>/g, ' ').includes('runeword_')), 'codex visible copy does not leak internal runeword ids');

// Stable alchemy renders and executes two real actions while preserving the black-box preview.
resetDom();
register(new FakeElement('toast'));
const potionPreview = register(new FakeElement('potion-preview-card'));
const potionActions = new FakeElement('potion-actions');
const potionConfirm = register(new FakeElement('potion-confirm-btn', 'button'));
potionActions.appendChild(potionConfirm);
body.appendChild(potionPreview);
body.appendChild(potionActions);
const potionInventory = register(new FakeElement('potion-rune-inventory'));
const nextPotionRune = new FakeElement('next-potion-rune', 'button');
potionInventory.appendChild(nextPotionRune);
body.appendChild(potionInventory);
const stableDraft = {
    root: { id: 'secret-root-id' },
    consumedRunes: [{ id: 'rune_cryo_1' }, { id: 'rune_cryo_2' }, { id: 'rune_cryo_1' }],
    pendingRunes: [],
    state: 'form_ready',
};
const potionGame = attachMethods({ preparedPotionSpell: null }, rune_launcher_system);
let potionDraftReset = false;
let potionSaveCount = 0;
Object.assign(potionGame, {
    _ui_isPotionAlchemyUnlocked() { return true; },
    _ui_getPotionDraftRunes() { return []; },
    _ui_getPotionAlchemyDraft() { return stableDraft; },
    _ui_buildPotionResultFromSpellTree() {
        return {
            success: true,
            nodeCount: 1,
            potion: { id: 'secret-potion-id', name: '秘密药剂' },
            potionId: 'secret-potion-id',
            spellContentId: 'secret-spell-content-id',
            spellType: 'secret-beam-type',
            charges: 99,
            maxCharges: 99,
            quality: 1,
            sourceRunes: ['rune_cryo_1', 'rune_cryo_2', 'rune_cryo_1'],
            levelSum: 3,
            effect: { damage: 9999 },
            form: { formId: 'bottle', nestingMode: 'shatter', slotType: null },
            spellTree: { root: stableDraft.root },
        };
    },
    _ui_countPotionSpellNodes() { return 1; },
    _ui_renderPotionFormControls() {},
    _ui_renderPotionDraftRunes() {},
    _ui_resetPotionAlchemyDraft() { potionDraftReset = true; },
    _ui_updateRuneInventoryDisplay() {},
    ui_updateRuneGrid() {},
    ui_updatePotionAlchemyPanel() {},
    _ui_showPotionActionResult(message, type) { this.lastPotionAction = { message, type }; },
    sys_saveRunState() { potionSaveCount += 1; },
});
potionGame._ui_updatePotionAlchemyPreview();
const potionContinue = potionActions.children.find(child => child.id === 'potion-continue-btn');
check(!potionConfirm.disabled && potionConfirm.textContent === '手动接触封装' && potionContinue && !potionContinue.disabled && !potionContinue.classList.contains('hidden'), 'stable potion node renders enabled seal and continue CTAs');
const blackBoxCopy = potionPreview.innerHTML;
check(['secret-root-id', 'secret-potion-id', 'secret-spell-content-id', 'secret-beam-type', '99', '9999'].every(secret => !blackBoxCopy.includes(secret)), 'stable potion preview hides identity, type, charges, and effect values at runtime');
const stableDraftBeforeContinue = JSON.stringify(stableDraft);
potionContinue.dispatch('click');
check(document.activeElement === nextPotionRune && nextPotionRune.scrolledIntoView, 'continue-feeding CTA executes by moving focus to the next available rune');
check(JSON.stringify(stableDraft) === stableDraftBeforeContinue, 'continue-feeding CTA does not auto-consume or mutate the stable node');
check(potionGame.preparedPotionSpell == null, 'stable preview keeps potion identity unavailable before sealing');
potionGame.ui_confirmPotionAlchemy();
check(potionGame.preparedPotionSpell?.potionId === 'secret-potion-id' && potionGame.lastPotionAction?.type === 'success', 'seal action executes and reveals the prepared potion only after confirmation');
check(potionDraftReset && potionSaveCount === 1, 'successful seal resets the draft and persists run state once');
check(launcherSource.includes('局外符文碎片') && launcherSource.includes('局内碎片（仅本局）'), 'launcher copy distinguishes meta and in-run fragments');

// Settlement captures terminal values before runFragments is reset and renders the actual write.
const settlementGame = attachMethods({
    round: 6,
    runFragments: 11,
    runRuneFragmentsGained: 20,
    runKillCount: 0,
    roundDamageHistory: [],
    roundDamage: 0,
    bossDefeatedLog: [],
    ownedRelics: [],
    runeInventory: [],
    saveData: { resources: { rune_fragments: 40 }, runeFragments: 40, currency: 40 },
    meta_getResourceCount() { return this.saveData.resources.rune_fragments; },
    meta_addCurrency(amount) {
        this.saveData.resources.rune_fragments += amount;
        this.saveData.runeFragments = this.saveData.resources.rune_fragments;
        this.saveData.currency = this.saveData.resources.rune_fragments;
    },
    sys_clearRunState() {},
    ui_clearTransientOverlays() {},
    phase_switchPhase() {},
}, game_over_mixin);
settlementGame.gameover_show = function captureGameoverSnapshot(snapshot) {
    this.deliveredGameoverSnapshot = snapshot;
};
settlementGame._gameover_triggerPhase();
flushTimers();
const settlementSnapshot = settlementGame.deliveredGameoverSnapshot;
check(settlementGame.runFragments === 0 && settlementGame.saveData.resources.rune_fragments === 43, 'existing 30% settlement still writes floor(11 * 0.3) = 3');
check(settlementSnapshot?.runeFragmentsGained === 20, 'settlement snapshot keeps total fragments gained this run');
check(settlementSnapshot?.runFragmentsRemaining === 11, 'settlement snapshot keeps the terminal in-run remainder');
check(settlementSnapshot?.carryOutEligible === 3, 'settlement snapshot exposes the configured carry-out amount');
check(settlementSnapshot?.settledRuneFragments === 3, 'settlement snapshot exposes the actual meta-resource write');

const settlementWrites = [];
const ratioLockGame = attachMethods({
    round: 6,
    runFragments: 100,
    runRuneFragmentsGained: 100,
    runKillCount: 0,
    roundDamageHistory: [],
    roundDamage: 0,
    bossDefeatedLog: [],
    ownedRelics: [],
    runeInventory: [],
    saveData: { resources: { rune_fragments: 40 }, runeFragments: 40, currency: 40 },
    meta_getResourceCount() { return this.saveData.resources.rune_fragments; },
    meta_addCurrency(amount) {
        settlementWrites.push(amount);
        this.saveData.resources.rune_fragments += amount;
        this.saveData.runeFragments = this.saveData.resources.rune_fragments;
        this.saveData.currency = this.saveData.resources.rune_fragments;
    },
    sys_clearRunState() {},
    ui_clearTransientOverlays() {},
    phase_switchPhase() {},
}, game_over_mixin);
ratioLockGame.gameover_show = function captureRatioLockSnapshot(snapshot) {
    this.deliveredGameoverSnapshot = snapshot;
};
ratioLockGame._gameover_triggerPhase();
flushTimers();
const ratioLockSnapshot = ratioLockGame.deliveredGameoverSnapshot;
check(CONFIG.gameplay.runShopEndOfRunFragmentSettle === 0.3, 'end-of-run carry-out ratio remains exactly 30%');
check(settlementWrites.length === 1 && settlementWrites[0] === 30, 'settlement writes floor(100 * 0.3) exactly once through meta_addCurrency');
check(ratioLockSnapshot?.carryOutEligible === 30 && ratioLockSnapshot?.settledRuneFragments === 30, 'settlement snapshot records both eligible and actual 30-fragment write');
check(ratioLockSnapshot?.metaRuneFragmentsAfter === 70 && ratioLockGame.saveData.resources.rune_fragments === 70, 'settlement snapshot and saved meta balance agree after the unified write');

const harvestHtml = game_over_mixin._gameover_renderHarvest.call(settlementGame, settlementSnapshot || {
    runeFragmentsGained: 20,
    runFragmentsRemaining: 0,
    carryOutRatio: 0.3,
    carryOutEligible: 0,
    settledRuneFragments: 0,
    runesGained: [],
});
check(['本局获得', '结算前剩余', '30% 可带出', '已结算'].every(label => harvestHtml.includes(label)), 'game-over harvest distinguishes all four settlement values');
check(harvestHtml.includes('局内碎片') && harvestHtml.includes('局外符文碎片'), 'game-over harvest names in-run and meta fragments separately');
check(gameoverSource.includes('Math.floor(leftover * ratio)'), 'settlement formula remains the existing floor(leftover * ratio) contract');

const total = passed + failed;
console.log(`Result: ${passed}/${total} passed`);
if (failed > 0) {
    console.log('Failures:');
    failures.forEach(item => console.log(`  - ${item}`));
    process.exit(1);
}

if (process.argv.includes('--serve-browser')) {
    const portArg = process.argv[process.argv.indexOf('--serve-browser') + 1];
    const port = Number(portArg) || 3004;
    const harnessHtml = `<!doctype html>
<html lang="zh-CN">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Launcher Settlement UX Browser Harness</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <link rel="stylesheet" href="/src/styles/bitmap_ui.css">
    <style>
        html, body { min-height: 100%; margin: 0; background: #020617; color: #e2e8f0; }
        #phase-gameover { display: block; min-height: 100vh; overflow-y: auto; }
        #gameover-content { max-width: 420px; margin: 0 auto; }
    </style>
</head>
<body>
    <section id="browser-touch-fixture" hidden>
        <button id="rune-cell-0" aria-label="符文配置格 1"></button>
        <div id="rune-picker-overlay" class="hidden">
            <div id="rune-picker-list"></div>
            <div id="rune-picker-detail"></div>
            <div id="runeword-preview-tooltip" class="hidden">
                <div id="runeword-preview-content"></div>
            </div>
        </div>
    </section>
    <main id="phase-gameover" aria-label="终局结算">
        <div id="gameover-content"></div>
    </main>
    <script type="module">
        import { game_over_mixin } from '/src/ui/game_over.js';
        import { rune_launcher_system } from '/src/ui/rune_launcher.js';
        const touchGame = Object.assign({
            runeInventory: [{ id: 'rune_pyro_1', level: 1 }],
            runeGrid: Array(9).fill(null),
            ui_updateRuneGrid() {},
        }, rune_launcher_system);
        touchGame.ui_openRunePicker(0);
        const touchOption = document.querySelector('#rune-picker-list button');
        const dispatchTouch = type => {
            const event = new TouchEvent(type, { bubbles: true, cancelable: true });
            touchOption.dispatchEvent(event);
            return event.constructor.name;
        };
        const touchCtor = dispatchTouch('touchstart');
        await new Promise(resolve => setTimeout(resolve, 560));
        dispatchTouch('touchend');
        document.body.dataset.touchLongPress = touchGame.runeGrid[0] == null && touchGame.runeInventory.length === 1 ? 'pass' : 'fail';
        dispatchTouch('touchstart');
        dispatchTouch('touchcancel');
        dispatchTouch('touchend');
        document.body.dataset.touchCancel = touchGame.runeGrid[0] == null && touchGame.runeInventory.length === 1 ? 'pass' : 'fail';
        document.body.dataset.touchEventConstructor = touchCtor;
        const game = Object.assign({
            _isTutorialRunCleared: false,
            sys_goToShop() {},
            sys_restartGame() {},
            sys_returnToMeta() {},
        }, game_over_mixin);
        window.game = game;
        game.gameover_show({
            totalRounds: 5,
            bossLog: [{ bossId: 'ignis', bossName: '炎核', round: 5, isBigBoss: false }],
            totalDamage: 1280,
            killCount: 18,
            relics: [],
            runeFragmentsGained: 20,
            runFragmentsRemaining: 11,
            carryOutRatio: 0.3,
            carryOutEligible: 3,
            settledRuneFragments: 3,
            metaRuneFragmentsAfter: 43,
            runesGained: [],
        });
        document.body.dataset.browserHarnessReady = 'true';
    </script>
</body>
</html>`;
    const mimeByExt = {
        '.css': 'text/css; charset=utf-8',
        '.html': 'text/html; charset=utf-8',
        '.js': 'text/javascript; charset=utf-8',
        '.mjs': 'text/javascript; charset=utf-8',
        '.png': 'image/png',
        '.svg': 'image/svg+xml',
    };
    const server = http.createServer((request, response) => {
        const pathname = decodeURIComponent(new URL(request.url, `http://127.0.0.1:${port}`).pathname);
        if (pathname === '/' || pathname === '/__launcher_settlement_harness__') {
            response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
            response.end(harnessHtml);
            return;
        }
        const resolved = path.resolve(repoRoot, pathname.replace(/^\/+/, ''));
        if (!resolved.startsWith(`${repoRoot}${path.sep}`) || !fs.existsSync(resolved) || !fs.statSync(resolved).isFile()) {
            response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
            response.end('Not found');
            return;
        }
        response.writeHead(200, { 'Content-Type': mimeByExt[path.extname(resolved).toLowerCase()] || 'application/octet-stream' });
        fs.createReadStream(resolved).pipe(response);
    });
    server.listen(port, '127.0.0.1', () => {
        console.log(`Browser harness: http://127.0.0.1:${port}/__launcher_settlement_harness__`);
    });
}
