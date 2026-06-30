/**
 * validate_potion_spell_content.mjs - C4 spellContent parsing checks.
 *
 * Usage:
 *   node tests/validate_potion_spell_content.mjs
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { RUNE_DB, RUNEWORD_DB } from '../src/rune_config.js';
import { POTION_SPELL_DB } from '../src/config.js';
import {
    POTION_SPELL_CONTENT_RUNE_COUNT,
    POTION_SPELL_CONTENT_RULES,
    resolvePotionSpellContent,
} from '../src/potion_spell_content.js';

globalThis.window = globalThis.window || {};
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
    return { id, def, level, element: def.element };
}

function attachPotionUiMethods(gameLike) {
    [
        '_ui_hydratePotionRuneRecord',
        '_ui_clonePotionNode',
        '_ui_countPotionSpellNodes',
        '_ui_resetPotionNodeForm',
        '_ui_buildPotionResultFromSpellTree',
        '_ui_buildPotionTreeCandidate',
        '_ui_commitPotionAlchemyNode',
        '_ui_getPotionAlchemyDraft',
        '_ui_getPotionDraftRunes',
        '_ui_getPotionAlchemyLedgerRunes',
        '_ui_estimatePotionRuneValue',
        '_ui_resolvePotionRecipe',
    ].forEach(name => {
        gameLike[name] = rune_launcher_system[name];
    });
    return gameLike;
}

function uiResolve(ids, draft = {}) {
    const gameLike = attachPotionUiMethods({
        _potionAlchemyDraft: {
            state: 'empty',
            consumedRunes: [],
            pendingRunes: [],
            formId: 'bottle',
            nestingMode: 'shatter',
            slotType: null,
            ...draft,
        },
    });
    return rune_launcher_system._ui_resolvePotionRecipe.call(gameLike, ids.map(id => rune(id)));
}

console.log('Potion spellContent C4 validation');

check(POTION_SPELL_CONTENT_RUNE_COUNT === 3, 'C4 parses one 3-rune root spellContent node');

const allRunewordIds = new Set(RUNEWORD_DB.map(item => item.id));
const allRuleIds = Object.keys(POTION_SPELL_CONTENT_RULES);
check(allRuleIds.every(id => allRunewordIds.has(id)), 'spellContent rules only reference existing RUNEWORD_DB ids');
check(RUNEWORD_DB.every(item => POTION_SPELL_CONTENT_RULES[item.id]), 'every current RUNEWORD_DB entry has a C4 spellContent rule');

const legal = resolvePotionSpellContent([
    rune('rune_pyro_1'),
    rune('rune_pyro_2'),
    rune('rune_pyro_1'),
], RUNEWORD_DB);
check(legal.success, 'legal RUNEWORD_DB formula parses as hidden spellContent');
check(legal.spellContentId === 'runeword_meltdown', 'legal parse records hidden spellContentId');
check(legal.spellType === 'burst', 'legal parse records hidden spellType');
check(legal.compatibilityPotionId === 'potion_molten_flask', 'legal parse maps to a static compatibility potionId');

const armor = resolvePotionSpellContent([
    rune('rune_pierce_2'),
    rune('rune_scatter_1'),
    rune('rune_pierce_1'),
], RUNEWORD_DB);
const blade = resolvePotionSpellContent([
    rune('rune_pierce_1'),
    rune('rune_pierce_2'),
    rune('rune_scatter_1'),
], RUNEWORD_DB);
check(armor.spellContentId === 'runeword_armor_piercing_meteor', 'alchemy formula center distinguishes armor-piercing meteor');
check(blade.spellContentId === 'runeword_blade_storm', 'alchemy formula center distinguishes blade storm with same rune multiset');

const unformed = resolvePotionSpellContent([
    rune('rune_pyro_1'),
    rune('rune_cryo_1'),
    rune('rune_bounce_1'),
], RUNEWORD_DB);
check(!unformed.success && unformed.status === 'unformed', 'non-runeword combination enters unformed path');

const disabled = resolvePotionSpellContent([
    rune('rune_lightning_1'),
    rune('rune_scatter_1'),
    rune('rune_lightning_2'),
], RUNEWORD_DB);
check(!disabled.success && disabled.rejectedBy === 'spell_content_rule', 'forbidden chain-like runeword enters explicit rejected path');

const uiResult = uiResolve(['rune_pyro_1', 'rune_pyro_2', 'rune_pyro_1']);
check(uiResult.success, 'rune launcher resolver accepts legal spellContent');
check(uiResult.potion.id === 'potion_molten_flask', 'rune launcher keeps static potionId compatibility');
check(POTION_SPELL_DB.some(item => item.id === uiResult.potion.id), 'compatibility potionId exists in POTION_SPELL_DB');
check(uiResult.spellTree.root.potionId === uiResult.potion.id, 'spellTree root keeps old potionId field');
check(uiResult.spellTree.root.spellContentId === 'runeword_meltdown', 'spellTree root stores hidden runeword spellContentId');
check(uiResult.spellTree.root.spellType === 'burst', 'spellTree root stores hidden spellType');

const beamResult = uiResolve(
    ['rune_pyro_1', 'rune_laser_1', 'rune_laser_2'],
    { formId: 'beam', nestingMode: 'hit', slotType: null }
);
check(beamResult.success && beamResult.spellTree.root.formId === 'beam', 'form validation uses hidden spellType instead of static potion spellType');

const uiSource = fs.readFileSync(path.join(repoRoot, 'src/ui/rune_launcher.js'), 'utf8');
const previewStart = uiSource.indexOf('    _ui_updatePotionAlchemyPreview() {');
const previewEnd = previewStart >= 0 ? uiSource.indexOf('    ui_clearPotionSelection()', previewStart) : -1;
check(previewStart >= 0 && previewEnd > previewStart, 'preview function source is discoverable');
if (previewStart >= 0 && previewEnd > previewStart) {
    const previewBody = uiSource.slice(previewStart, previewEnd);
    check(!/result\.(spellContentId|runewordId)/.test(previewBody), 'pre-seal preview does not render hidden ids');
    check(!/\$\{[^}]*spellType[^}]*\}/.test(previewBody), 'pre-seal preview does not interpolate hidden spellType');
    check(!/result\.potion\.(name|desc|baseCharges|maxCharges)/.test(previewBody), 'pre-seal preview does not reveal potion name, desc, or charges');
}

const total = passed + failed;
console.log(`Result: ${passed}/${total} passed`);
if (failed > 0) {
    console.log('Failures:');
    failures.forEach(item => console.log(`  - ${item}`));
    process.exit(1);
}
