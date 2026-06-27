/**
 * validate_potion_vfx_contract.mjs - Static checks for potion spell-form VFX metadata.
 *
 * Usage:
 *   node tests/validate_potion_vfx_contract.mjs
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const config = fs.readFileSync(path.join(repoRoot, 'src/config.js'), 'utf8');
const combat = fs.readFileSync(path.join(repoRoot, 'src/combat_system.js'), 'utf8');

const potionIds = [
    'potion_frost_seal',
    'potion_molten_flask',
    'potion_storm_lure',
    'potion_blade_shadow',
    'potion_collapse_vial',
    'potion_echo_phial',
    'potion_venom_mist',
    'potion_prism_focus',
    'potion_overload_vial',
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

function potionBlock(id) {
    const start = config.indexOf(`id: '${id}'`);
    if (start < 0) return '';
    const next = config.indexOf('\n    {', start + 1);
    const end = next > start ? next : config.indexOf('\n];', start);
    return config.slice(start, end);
}

console.log('Potion VFX contract validation');

for (const id of potionIds) {
    const block = potionBlock(id);
    check(block.length > 0, `${id} is defined`);
    check(/spellType:\s*'[^']+'/.test(block), `${id} declares spellType`);
    check(/formId:\s*'bottle'/.test(block), `${id} uses bottle form`);
    check(/nestingMode:\s*'shatter'/.test(block), `${id} uses shatter nesting`);
    check(/vfxProfile:\s*\{[\s\S]*targetMode:\s*'[^']+'[\s\S]*shatterStyle:\s*'[^']+'[\s\S]*label:\s*'[^']+'/.test(block), `${id} declares target/shatter/label VFX profile`);
}

check(/combat_getPotionVfxProfile\s*\(potionDef\)/.test(combat), 'combat_getPotionVfxProfile exists');
check(/combat_resolvePotionVfxPoint\s*\(targets\s*=\s*\[\],\s*opts\s*=\s*\{\}\)/.test(combat), 'combat_resolvePotionVfxPoint exists');
check(/combat_getPotionVfxBudget\s*\(targetMode\s*=\s*'cluster_center'\)/.test(combat), 'combat_getPotionVfxBudget exists');
check(/combat_spawnPotionVfxParticle\s*\(x,\s*y,\s*color,\s*mode\s*=\s*'spark'/.test(combat), 'potion VFX particle tuning helper exists');
check(/combat_emitPotionArcingTrail\s*\(profile,\s*origin,\s*point,\s*color,\s*targetMode\)/.test(combat), 'potion VFX arcing trail helper exists');
check(/combat_playPotionShatterVFX\s*\(profile,\s*targets,\s*ctx\)/.test(combat), 'potion shatter style dispatcher exists');
check(/combat_playPotionBottleVFX\s*\(potionDef,\s*targets\s*=\s*\[\],\s*opts\s*=\s*\{\}\)/.test(combat), 'combat_playPotionBottleVFX exists');
check(/@perf-impact:[^\n]*药瓶碎裂法术表现/.test(combat), 'potion bottle VFX helper is marked as perf-impact');
check(/spawn_createProjectileExplosion\(point\.x,\s*point\.y/.test(combat), 'enemy-target potion shatter reuses projectile explosion helper');
check(/spawn_createAssimilationPulse\?\.\(point\.x,\s*point\.y/.test(combat), 'ammo-socket potion shatter reuses assimilation pulse helper');
check(/spawn_createAssimilationWave\?\.\(point\.x,\s*point\.y/.test(combat), 'non-explosive potion styles reuse assimilation wave helper');
check(/new\s+LightningBolt\(/.test(combat), 'mark and overload potion styles can add budgeted short lightning bolts');

const shatterStyles = ['seal', 'mist_bloom', 'mark', 'shard_sigil', 'collapse_ring', 'overload_blast'];
for (const style of shatterStyles) {
    check(combat.includes(`profile.shatterStyle === '${style}'`), `shatter dispatcher handles ${style}`);
}

const helperCalls = combat.match(/combat_playPotionBottleVFX\(potionDef/g) || [];
check(helperCalls.length >= potionIds.length, `all potion branches call bottle VFX helper (${helperCalls.length}/${potionIds.length})`);

const total = passed + failed;
console.log(`Result: ${passed}/${total} passed`);
if (failed > 0) {
    console.log('Failures:');
    failures.forEach(item => console.log(`  - ${item}`));
    process.exit(1);
}
