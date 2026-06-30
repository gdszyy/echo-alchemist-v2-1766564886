/**
 * validate_potion_c6_nesting_ui.mjs - C6 multi-node potion nesting UI checks.
 *
 * Usage:
 *   node tests/validate_potion_c6_nesting_ui.mjs
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { RUNE_DB } from '../src/rune_config.js';
import { getPotionFormOption, validatePotionSpellTree } from '../src/potion_nesting.js';

class FakeElement {
    constructor(id = '') {
        this.id = id;
        this.children = [];
        this.dataset = {};
        this.style = {};
        this.innerHTML = '';
        this.innerText = '';
        this.textContent = '';
        this.className = '';
        this.disabled = false;
        this.title = '';
        const classes = new Set();
        this.classList = {
            add: (...names) => names.forEach(name => classes.add(name)),
            remove: (...names) => names.forEach(name => classes.delete(name)),
            contains: (name) => classes.has(name),
        };
    }

    appendChild(child) {
        this.children.push(child);
        return child;
    }

    addEventListener() {}
    remove() {}
    querySelector() { return null; }
    querySelectorAll() { return []; }
}

const elementCache = new Map();
globalThis.document = {
    getElementById(id) {
        if (!elementCache.has(id)) elementCache.set(id, new FakeElement(id));
        return elementCache.get(id);
    },
    createElement(tag) {
        return new FakeElement(tag);
    },
};
globalThis.window = { confirm: () => true, showToast: true };
globalThis.setTimeout = () => 0;
globalThis.clearTimeout = () => {};

const { rune_launcher_system } = await import('../src/ui/rune_launcher.js');

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
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

function rune(id, level = 1) {
    const def = RUNE_DB.find(item => item.id === id);
    if (!def) throw new Error(`Missing rune ${id}`);
    return { id, def, level, element: def.element || def.baseStat };
}

function attachPotionUiMethods(gameLike) {
    Object.entries(rune_launcher_system).forEach(([name, value]) => {
        if (typeof value === 'function') gameLike[name] = value;
    });
    return gameLike;
}

function makeGame() {
    const gameLike = attachPotionUiMethods({
        potionAlchemyUnlocked: true,
        runeInventory: [],
        runFragments: 0,
        round: 1,
        skillPoints: 0,
        activeSkills: [],
        _potionAlchemyDraft: null,
        _selectedPotionRuneIndices: new Set(),
        potionRecipeHistory: [],
        knownPotionSpellIds: [],
        preparedPotionSpell: null,
        ui: { updateSkillBar() {} },
    });
    Object.assign(gameLike, {
        _ui_renderPotionAlchemyInventory() {},
        _ui_updatePotionAlchemyPreview() {},
        _ui_updateRuneInventoryDisplay() {},
        _ui_renderPotionDraftRunes() {},
        _ui_renderPotionFormControls() {},
        _ui_showPotionActionResult(message, type) {
            this.lastPotionAction = { message, type };
        },
        ui_updateRuneGrid() {},
        ui_updatePotionAlchemyPanel() {},
        sys_saveRunState() {
            this.saved = true;
        },
    });
    gameLike._ui_resetPotionAlchemyDraft();
    return gameLike;
}

function setDraftForm(gameLike, formId, slotType = null) {
    const draft = gameLike._ui_getPotionAlchemyDraft();
    const form = getPotionFormOption(formId, slotType);
    draft.formId = form.formId;
    draft.nestingMode = form.nestingMode;
    draft.slotType = form.slotType;
}

function feedPendingNode(gameLike, runeIds) {
    const draft = gameLike._ui_getPotionAlchemyDraft();
    const runes = runeIds.map(id => rune(id));
    draft.pendingRunes = runes;
    draft.consumedRunes = (draft.consumedRunes || []).concat(runes);
    return gameLike._ui_resolvePotionRecipe(gameLike._ui_getPotionDraftRunes());
}

console.log('Potion C6 nesting UI validation');

const legalGame = makeGame();
setDraftForm(legalGame, 'orb');
const rootResult = feedPendingNode(legalGame, ['rune_pyro_1', 'rune_pyro_2', 'rune_pyro_1']);
check(rootResult.success, 'root spellContent can stabilize before nesting');
check(legalGame._ui_commitPotionAlchemyNode(rootResult), 'stable root can be committed to draft.root');
check(legalGame._ui_getPotionDraftRunes().length === 0, 'committing root clears current-node pending runes');

setDraftForm(legalGame, 'bottle');
const childResult = feedPendingNode(legalGame, ['rune_cryo_1', 'rune_cryo_2', 'rune_cryo_1']);
check(childResult.success, 'legal child spellContent can attach to existing root');
check(childResult.isNested === true, 'child result is marked as nested');
check(childResult.spellTree.root.children.length === 1, 'legal child is connected under root.children');
check(childResult.attachRuleId === 'orb_root_allows_bottle_status', 'legal nesting records the shared ruleId');
check(validatePotionSpellTree(childResult.spellTree).ok, 'legal multi-node tree passes shared recursive validation');
check(legalGame._ui_commitPotionAlchemyNode(childResult), 'legal multi-node tree can be committed');
check(legalGame._ui_getPotionAlchemyDraft().root.children.length === 1, 'committed draft keeps the child node');

legalGame.ui_confirmPotionAlchemy();
check(legalGame.preparedPotionSpell?.spellTree?.root?.children?.length === 1, 'sealed potion keeps the multi-node spellTree');
check(legalGame.knownPotionSpellIds.length === 1, 'final potion is only revealed after sealing');

const illegalGame = makeGame();
setDraftForm(illegalGame, 'orb');
check(illegalGame._ui_commitPotionAlchemyNode(feedPendingNode(illegalGame, ['rune_pyro_1', 'rune_pyro_2', 'rune_pyro_1'])), 'illegal test root is committed');
setDraftForm(illegalGame, 'orb');
const illegalChild = feedPendingNode(illegalGame, ['rune_cryo_1', 'rune_cryo_2', 'rune_cryo_1']);
check(!illegalChild.success, 'illegal child nesting is rejected');
check(illegalChild.status === 'collapse', 'illegal child nesting collapses the whole furnace');
check(illegalChild.rejectedBy === 'potion_nesting', 'illegal child failure comes from shared nesting validation');
check((illegalChild.validation?.ruleId || illegalChild.attachRuleId) === 'orb_cannot_release_orb', 'Orb to Orb nesting hits the explicit ruleId');

const refundGame = makeGame();
refundGame.runeInventory = [
    rune('rune_pyro_1'),
    rune('rune_pyro_2'),
    rune('rune_pyro_1'),
    rune('rune_cryo_1'),
    rune('rune_cryo_2'),
    rune('rune_cryo_1'),
];
setDraftForm(refundGame, 'orb');
for (let i = 0; i < 4; i += 1) refundGame._ui_consumePotionRune(0);
setDraftForm(refundGame, 'orb');
for (let i = 0; i < 2; i += 1) refundGame._ui_consumePotionRune(0);
const collapseBeforeConfirm = refundGame._ui_resolvePotionRecipe(refundGame._ui_getPotionDraftRunes());
check(!collapseBeforeConfirm.success && collapseBeforeConfirm.status === 'collapse', 'inventory-driven illegal child is collapsed before confirm');
check(refundGame.runeInventory.length === 0, 'all six fed runes are removed from inventory before failure handling');
refundGame.ui_confirmPotionAlchemy();
check(refundGame.runeInventory.length === 0, 'failed nested alchemy does not return consumed runes');
check(refundGame.runFragments > 0, 'failed nested alchemy grants only failure fragments');
check(refundGame.potionRecipeHistory.at(-1)?.outcome === 'failure', 'failed nested alchemy records a failure history item');

const uiSource = fs.readFileSync(path.join(repoRoot, 'src/ui/rune_launcher.js'), 'utf8');
const previewStart = uiSource.indexOf('    _ui_updatePotionAlchemyPreview() {');
const previewEnd = previewStart >= 0 ? uiSource.indexOf('    ui_clearPotionSelection()', previewStart) : -1;
check(previewStart >= 0 && previewEnd > previewStart, 'preview function source is discoverable');
if (previewStart >= 0 && previewEnd > previewStart) {
    const previewBody = uiSource.slice(previewStart, previewEnd);
    check(previewBody.includes('potion-unknown-node'), 'preview renders anonymous stable nodes');
    check(previewBody.includes('结构稳定') && previewBody.includes('法阵排斥') && previewBody.includes('结构坍塌'), 'preview only names structural states');
    check(!/result\.(spellContentId|runewordId)/.test(previewBody), 'preview does not render hidden ids');
    check(!/\$\{[^}]*spellType[^}]*\}/.test(previewBody), 'preview does not interpolate hidden spellType');
    check(!/result\.potion\.(name|desc|baseCharges|maxCharges)/.test(previewBody), 'preview does not reveal potion name, desc, or charges');
    check(!/attachRuleId/.test(previewBody), 'preview does not reveal nesting rule ids');
}

const total = passed + failed;
console.log(`Result: ${passed}/${total} passed`);
if (failed > 0) {
    console.log('Failures:');
    failures.forEach(item => console.log(`  - ${item}`));
    process.exit(1);
}
