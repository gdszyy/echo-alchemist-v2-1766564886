/**
 * validate_spell_vfx_design.mjs - Static checks for spell-form VFX design coverage.
 *
 * Usage:
 *   node tests/validate_spell_vfx_design.mjs
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const design = fs.readFileSync(path.join(repoRoot, 'docs/spell_vfx_design.md'), 'utf8');
const contract = fs.readFileSync(path.join(repoRoot, 'docs/rune_potion_spell_contract.md'), 'utf8');
const combat = fs.readFileSync(path.join(repoRoot, 'src/combat_system.js'), 'utf8');

const formIds = [
    'bottle',
    'orb',
    'mine',
    'beam',
    'orbit',
    'slash',
    'meteor',
    'sweeping_laser',
    'tower',
];

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

console.log('Spell VFX design validation');

check(contract.includes('spell_vfx_design.md'), 'rune potion contract links to spell VFX design');
check(/## 3\.\s+形态设计矩阵/.test(design), 'design has form matrix section');
check(/## 4\.\s+各形态表现规格/.test(design), 'design has per-form specification section');
check(/## 6\.\s+实现顺序/.test(design), 'design has implementation order section');
check(/## 7\.\s+验收清单/.test(design), 'design has acceptance checklist section');

for (const formId of formIds) {
    check(design.includes(`\`${formId}\``), `design covers ${formId}`);
}

const requiredRuntimeTerms = [
    'combat_playSpellFormVFX',
    'SPELL_FORM_VFX_PROFILES',
    'CONFIG.performance',
    '@perf-impact',
];

for (const term of requiredRuntimeTerms) {
    check(design.includes(term), `design references ${term}`);
}

check(/combat_playSpellFormVFX\s*\(spellDef,\s*targets\s*=\s*\[\],\s*opts\s*=\s*\{\}\)/.test(combat), 'combat has generic spell-form VFX dispatcher');
check(/profile\.formId\s*===\s*'bottle'[\s\S]{0,160}combat_playPotionBottleVFX/.test(combat), 'dispatcher preserves bottle VFX path');
const dispatcherBranches = {
    orb: 'combat_playSpellOrbVFX',
    mine: 'combat_playSpellMineVFX',
    orbit: 'combat_playSpellOrbitVFX',
    slash: 'combat_playSpellSlashVFX',
    beam: 'combat_playSpellBeamVFX',
    meteor: 'combat_playSpellMeteorVFX',
    sweeping_laser: 'combat_playSpellSweepingLaserVFX',
    tower: 'combat_playSpellTowerVFX',
};

for (const [formId, helperName] of Object.entries(dispatcherBranches)) {
    check(
        new RegExp(`profile\\.formId\\s*===\\s*'${formId}'[\\s\\S]{0,180}${helperName}`).test(combat),
        `dispatcher handles ${formId} form`
    );
    check(
        new RegExp(`${helperName}\\s*\\(profile,\\s*targets\\s*=\\s*\\[\\],\\s*ctx\\)`).test(combat),
        `${formId} form helper is defined`
    );
}

check(/new\s+SlashEffect\(/.test(combat) && /new\s+PierceCutEffect\(/.test(combat), 'slash form reuses slash/cut effects');
check(/new\s+LaserBeam\(/.test(combat), 'beam and meteor forms reuse LaserBeam');
check(/new\s+SlashAnim\(/.test(combat), 'orbit form reuses SlashAnim');
check(/spawn_createAssimilationWave/.test(combat), 'spell forms reuse assimilation wave budget');
check(/spawn_createAssimilationPulse/.test(combat), 'tower form reuses assimilation pulse budget');
check(/slotType:\s*potionDef\?\.slotType/.test(combat), 'spell VFX profile preserves slotType for tower branches');
check(/@perf-impact:[^\n]*Generic spell-form VFX dispatcher/.test(combat), 'spell-form dispatcher is marked as perf-impact');

const total = passed + failed;
console.log(`Result: ${passed}/${total} passed`);
if (failed > 0) {
    console.log('Failures:');
    failures.forEach(item => console.log(`  - ${item}`));
    process.exit(1);
}
