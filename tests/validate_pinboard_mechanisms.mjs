import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const entities = read('src/entities.js');
const modules = read('src/pinboard_modules.js');
const runShop = read('src/ui/run_shop.js');

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

console.log('Pinboard mechanism contract validation');

check(/slot\.type\s*===\s*['"]launcher['"]/.test(entities), 'DropBall slot handling supports launcher slots');
check(/slot\.type\s*===\s*['"]energy_wheel['"]/.test(entities), 'DropBall slot handling supports energy wheel slots');
check(/tryActivate\(this\.session,\s*game,\s*this\)/.test(entities), 'SpecialSlot activation gate is used by DropBall');
check(/persistent:\s*true[\s\S]{1,220}['"]launcher['"]/.test(modules) || /['"]launcher['"][\s\S]{1,220}persistent:\s*true/.test(modules), 'At least one launcher module creates a persistent launcher slot');
check(/persistent:\s*true[\s\S]{1,240}['"]energy_wheel['"]/.test(modules) || /['"]energy_wheel['"][\s\S]{1,240}persistent:\s*true/.test(modules), 'At least one energy wheel module creates a persistent energy slot');

const expectedModules = [
    'launcher_gate_module',
    'pinwheel_capacitor_module',
    'turbine_loop_module',
    'swerve_cannon_module',
];
for (const id of expectedModules) {
    check(new RegExp(`MODULE_DEFS\\.${id}\\s*=`).test(modules), `${id} is registered in MODULE_DEFS`);
    check(new RegExp(`id:\\s*['"]${id}['"][\\s\\S]{1,260}price:\\s*[1-9]`).test(modules), `${id} has a non-zero shop price`);
}

check(/Object\.values\(MODULE_DEFS\)\.filter\(d => d\.price > 0 && !d\.isAttrPin\)/.test(runShop), 'run shop module pool still sources priced MODULE_DEFS entries');
check(/MODULE_SHOWCASE_TAG/.test(runShop), 'run shop can bias toward showcased new mechanism modules');

const total = passed + failed;
console.log(`Result: ${passed}/${total} passed`);
if (failed > 0) {
    console.log('Failures:');
    failures.forEach(item => console.log(`  - ${item}`));
    process.exit(1);
}
