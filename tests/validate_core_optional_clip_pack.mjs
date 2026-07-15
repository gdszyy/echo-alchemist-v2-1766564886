import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const coreSource = fs.readFileSync(path.join(repoRoot, 'src', 'core.js'), 'utf8');

let passed = 0;
let failed = 0;

function check(condition, message) {
    if (condition) {
        passed += 1;
        console.log(`  PASS ${message}`);
        return;
    }
    failed += 1;
    console.error(`  FAIL ${message}`);
}

console.log('\nCore optional clip-pack startup validator');

check(
    !/^\s*import\s+\{?\s*loadClipPacks[\s\S]*?from\s+['"]\.\/music_clip_packs\.js['"];?/m.test(coreSource),
    'music_clip_packs.js is not a top-level static dependency',
);
check(/async function loadClipPacks\(\)/.test(coreSource), 'optional loader has a controlled async boundary');
check(/await import\(['"]\.\/music_clip_packs\.js['"]\)/.test(coreSource), 'optional loader uses dynamic import');
check(/async function loadClipPacks\(\)[\s\S]*?catch\s*\(error\)[\s\S]*?return false;[\s\S]*?\n\}/.test(coreSource), 'dynamic import failure returns the legacy fallback result');
check(/loadClipPacks\(\);/.test(coreSource), 'audio initialization still attempts the optional enhancement');

console.log(`\nResult: ${passed}/${passed + failed} passed`);
if (failed > 0) process.exitCode = 1;
