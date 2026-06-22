/**
 * validate_boss_sprite_assets.mjs
 * Validates Boss base sprite sheets for the redraw pipeline.
 *
 * Current 256x256 sheets are accepted as legacy-valid. Redrawn Boss sheets
 * should use 384x256 frames and declare frameWidth/frameHeight in JSON.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
    BOSS_SPRITE_BOSS_IDS,
    BOSS_SPRITE_IDLE_CONTRACT,
    BOSS_SPRITE_LEGACY_FRAME_SIZE,
    BOSS_SPRITE_REDRAW_FRAME_SIZE,
    getBossSpriteMetaPath,
    getBossSpriteRawConceptPath,
    getBossSpriteSheetPath
} from '../src/data/boss_sprite_assets.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

let passed = 0;
let failed = 0;
let legacy = 0;
let redraw = 0;
const failures = [];

function pass(message) {
    passed++;
    console.log(`  PASS ${message}`);
}

function fail(message) {
    failed++;
    failures.push(message);
    console.error(`  FAIL ${message}`);
}

function readPngInfo(fullPath) {
    const bytes = fs.readFileSync(fullPath);
    if (bytes.length < 33) throw new Error('file is too small for PNG IHDR');
    for (let i = 0; i < PNG_SIGNATURE.length; i++) {
        if (bytes[i] !== PNG_SIGNATURE[i]) throw new Error('invalid PNG signature');
    }
    const firstChunkType = bytes.toString('ascii', 12, 16);
    if (firstChunkType !== 'IHDR') throw new Error('first chunk is not IHDR');
    return {
        width: bytes.readUInt32BE(16),
        height: bytes.readUInt32BE(20),
        bitDepth: bytes[24],
        colorType: bytes[25]
    };
}

function getFrameSizeFromMeta(meta, anim) {
    const frameSize = meta.frameSize || BOSS_SPRITE_LEGACY_FRAME_SIZE.width;
    return {
        width: anim.frameWidth || meta.frameWidth || frameSize,
        height: anim.frameHeight || meta.frameHeight || frameSize
    };
}

function validateBossSprite(bossId) {
    const sheetRel = getBossSpriteSheetPath(bossId);
    const metaRel = getBossSpriteMetaPath(bossId);
    const rawRel = getBossSpriteRawConceptPath(bossId);
    const sheetPath = path.join(root, sheetRel);
    const metaPath = path.join(root, metaRel);

    if (!fs.existsSync(sheetPath)) {
        fail(`${bossId} missing sheet (${sheetRel})`);
        return;
    }
    if (!fs.existsSync(metaPath)) {
        fail(`${bossId} missing meta (${metaRel})`);
        return;
    }

    try {
        const png = readPngInfo(sheetPath);
        const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
        const idle = meta.animations && meta.animations[BOSS_SPRITE_IDLE_CONTRACT.animation];
        if (!idle) {
            fail(`${bossId} missing idle animation`);
            return;
        }
        if (idle.row !== BOSS_SPRITE_IDLE_CONTRACT.row) {
            fail(`${bossId} idle.row must be ${BOSS_SPRITE_IDLE_CONTRACT.row}`);
            return;
        }
        if ((idle.frames || 0) < BOSS_SPRITE_IDLE_CONTRACT.minFrames) {
            fail(`${bossId} idle.frames must be >= ${BOSS_SPRITE_IDLE_CONTRACT.minFrames}`);
            return;
        }

        const frame = getFrameSizeFromMeta(meta, idle);
        const isLegacy = frame.width === BOSS_SPRITE_LEGACY_FRAME_SIZE.width
            && frame.height === BOSS_SPRITE_LEGACY_FRAME_SIZE.height;
        const isRedraw = frame.width === BOSS_SPRITE_REDRAW_FRAME_SIZE.width
            && frame.height === BOSS_SPRITE_REDRAW_FRAME_SIZE.height;
        if (!isLegacy && !isRedraw) {
            fail(`${bossId} frame must be legacy 256x256 or redraw 384x256, got ${frame.width}x${frame.height}`);
            return;
        }

        const expectedSheetWidth = frame.width * idle.frames;
        const expectedSheetHeight = frame.height * Math.max(1, ...Object.values(meta.animations || {}).map(anim => (anim.row || 0) + 1));
        if (png.width < expectedSheetWidth || png.height < expectedSheetHeight) {
            fail(`${bossId} sheet too small for meta: png ${png.width}x${png.height}, expected at least ${expectedSheetWidth}x${expectedSheetHeight}`);
            return;
        }
        if (png.colorType !== 6 || png.bitDepth !== 8) {
            fail(`${bossId} sheet must be 8-bit RGBA PNG, got bitDepth=${png.bitDepth}, colorType=${png.colorType}`);
            return;
        }

        if (isRedraw) redraw++;
        if (isLegacy) legacy++;
        const rawStatus = fs.existsSync(path.join(root, rawRel)) ? ', raw concept present' : ', raw concept missing';
        pass(`${bossId} ${isRedraw ? 'redraw' : 'legacy'} ${frame.width}x${frame.height} frames=${idle.frames}${rawStatus}`);
    } catch (err) {
        fail(`${bossId} invalid Boss sprite: ${err.message}`);
    }
}

console.log('Boss base sprite asset validation');

for (const bossId of BOSS_SPRITE_BOSS_IDS) {
    validateBossSprite(bossId);
}

const total = passed + failed;
console.log(`\nResult: ${passed}/${total} passed (${redraw} redraw, ${legacy} legacy)`);
if (failures.length > 0) {
    console.log('Failures:');
    failures.forEach(item => console.log(`  - ${item}`));
}

process.exit(failed > 0 ? 1 : 0);
