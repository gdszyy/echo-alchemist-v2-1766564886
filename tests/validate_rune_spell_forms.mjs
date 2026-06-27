/**
 * validate_rune_spell_forms.mjs - Rune spell-form contract checks.
 *
 * Usage:
 *   node tests/validate_rune_spell_forms.mjs
 */

import { parseRuneGrid } from '../src/rune_system.js';
import { RUNEWORD_DB } from '../src/rune_config.js';

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

function activeById(grid, id, db = RUNEWORD_DB) {
    return parseRuneGrid(grid, db).activatedRunewords.find(rw => rw.id === id) || null;
}

console.log('Rune spell-form contract validation');

{
    const grid = [
        null, null, null,
        'rune_pyro_1', 'rune_pyro_2', 'rune_pyro_1',
        null, null, null,
    ];
    const result = parseRuneGrid(grid, RUNEWORD_DB);
    const rw = result.activatedRunewords.find(item => item.id === 'runeword_meltdown');
    check(!!rw, 'center-core axis activates meltdown');
    check(rw && rw.level === 1, 'single center axis gives meltdown Lv.1');
    check([3, 4, 5].every(idx => result.activatedCells.has(idx)), 'active cells include the matched center axis');
}

{
    const grid = [
        'rune_pyro_1', 'rune_pyro_2', 'rune_pyro_1',
        null, null, null,
        null, null, null,
    ];
    check(!activeById(grid, 'runeword_meltdown'), 'non-center line no longer activates a spell');
}

{
    const grid = [
        null, null, null,
        'rune_pyro_1', 'rune_pyro_1', 'rune_pyro_2',
        null, null, null,
    ];
    check(!activeById(grid, 'runeword_meltdown'), 'formula core rune must occupy the center cell');
}

{
    const grid = [
        null, null, null,
        'rune_cryo_2', 'rune_bounce_1', 'rune_cryo_1',
        null, null, null,
    ];
    check(!!activeById(grid, 'runeword_frost_nova'), 'outer reagents may be reversed around the center core');
}

{
    const grid = [
        'rune_pyro_1', 'rune_pyro_1', 'rune_pyro_1',
        'rune_pyro_1', 'rune_pyro_2', 'rune_pyro_1',
        'rune_pyro_1', 'rune_pyro_1', 'rune_pyro_1',
    ];
    const rw = activeById(grid, 'runeword_meltdown');
    check(rw && rw.level === 4, 'four center axes raise the same spell to Lv.4');
}

{
    const looseDb = [{
        id: 'test_loose_spell',
        name: 'Loose Spell',
        pattern: ['rune_pyro_1', 'rune_cryo_1', 'rune_bounce_1'],
        spellFormula: { shape: 'loose_line' },
    }];
    const grid = [
        'rune_bounce_1', 'rune_pyro_1', 'rune_cryo_1',
        null, null, null,
        null, null, null,
    ];
    check(!!activeById(grid, 'test_loose_spell', looseDb), 'loose_line formula preserves legacy unordered line matching');
}

const total = passed + failed;
console.log(`Result: ${passed}/${total} passed`);
if (failed > 0) {
    console.log('Failures:');
    failures.forEach(item => console.log(`  - ${item}`));
    process.exit(1);
}
