/**
 * validate_potion_nesting.mjs - Runtime checks for shared potion nesting rules.
 *
 * Usage:
 *   node tests/validate_potion_nesting.mjs
 */

import {
    buildPotionSpellTree,
    validatePotionNesting,
    validatePotionSpellTree,
} from '../src/potion_nesting.js';

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

function potion(id, spellType) {
    return { id, spellType };
}

console.log('Potion nesting validation');

const rootOrbNoChild = buildPotionSpellTree({
    potion: potion('potion_molten_flask', 'burst'),
    formId: 'orb',
    nestingMode: 'rupture',
    children: [],
});
check(validatePotionSpellTree(rootOrbNoChild).ok, 'root Orb without children is legal');

const orbWithStatusChild = {
    root: {
        nodeId: 'root',
        potionId: 'potion_molten_flask',
        spellType: 'burst',
        formId: 'orb',
        nestingMode: 'rupture',
        children: [{
            nodeId: 'child_status',
            potionId: 'potion_venom_mist',
            spellType: 'status',
            formId: 'bottle',
            nestingMode: 'shatter',
            children: [],
        }],
    },
};
check(validatePotionSpellTree(orbWithStatusChild).ok, 'Orb can rupture into an internal status/bottle child');

const orbIntoOrb = validatePotionNesting(
    { formId: 'orb', spellType: 'burst', nestingMode: 'rupture' },
    { formId: 'orb', spellType: 'status', nestingMode: 'rupture' }
);
check(!orbIntoOrb.ok && orbIntoOrb.code === 'orb_cannot_release_orb', 'Orb -> Orb is explicitly forbidden');

const beamIntoOrb = validatePotionNesting(
    { formId: 'beam', spellType: 'status', nestingMode: 'hit' },
    { formId: 'orb', spellType: 'status', nestingMode: 'rupture' }
);
check(!beamIntoOrb.ok && beamIntoOrb.code === 'beam_cannot_generate_orb', 'Beam hit -> Orb is explicitly forbidden');

const pureDamageChild = validatePotionNesting(
    { formId: 'bottle', spellType: 'burst', nestingMode: 'shatter' },
    { formId: 'bottle', spellType: 'pure_damage', nestingMode: 'shatter' }
);
check(!pureDamageChild.ok && pureDamageChild.code === 'pure_damage_chain_forbidden', 'pure damage child spells are forbidden');

const chainModeChild = validatePotionNesting(
    { formId: 'bottle', spellType: 'burst', nestingMode: 'shatter' },
    { formId: 'bottle', spellType: 'status', nestingMode: 'chain_reaction' }
);
check(!chainModeChild.ok && chainModeChild.code === 'chain_reaction_forbidden', 'chain reaction nesting modes are forbidden');

const towerActive = buildPotionSpellTree({
    potion: potion('potion_venom_mist', 'status'),
    formId: 'tower',
    slotType: 'active',
});
check(validatePotionSpellTree(towerActive).ok, 'active tower can carry a status spell');

const towerDualSlot = {
    root: {
        nodeId: 'tower_root',
        potionId: 'potion_venom_mist',
        spellType: 'status',
        formId: 'tower',
        nestingMode: 'tower_active',
        slotType: 'active',
        children: [{
            nodeId: 'death_child',
            potionId: 'potion_molten_flask',
            spellType: 'burst',
            formId: 'tower',
            nestingMode: 'tower_death',
            slotType: 'death',
            children: [],
        }],
    },
};
const towerDualSlotResult = validatePotionSpellTree(towerDualSlot);
check(!towerDualSlotResult.ok && ['tower_cannot_spawn_construct', 'child_form_forbidden', 'tower_dual_slot_mix'].includes(towerDualSlotResult.code), 'active/death tower slot mixing is rejected');

const siblingTowerMix = validatePotionNesting(
    { formId: 'bottle', spellType: 'burst', nestingMode: 'shatter' },
    { formId: 'tower', slotType: 'active', spellType: 'status', nestingMode: 'tower_active' },
    [{ formId: 'tower', slotType: 'death', spellType: 'burst', nestingMode: 'tower_death' }]
);
check(!siblingTowerMix.ok && siblingTowerMix.code === 'tower_dual_slot_mix', 'active/death sibling tower slots use a dedicated rejection code');

const towerConstructChild = validatePotionNesting(
    { formId: 'tower', slotType: 'active', spellType: 'status', nestingMode: 'tower_active' },
    { formId: 'bottle', spellType: 'construct', nestingMode: 'shatter' }
);
check(!towerConstructChild.ok && towerConstructChild.code === 'tower_cannot_spawn_construct', 'tower cannot spawn construct children');

const total = passed + failed;
console.log(`Result: ${passed}/${total} passed`);
if (failed > 0) {
    console.log('Failures:');
    failures.forEach(item => console.log(`  - ${item}`));
    process.exit(1);
}
