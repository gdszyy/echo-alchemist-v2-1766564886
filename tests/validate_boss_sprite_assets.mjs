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
import zlib from 'node:zlib';
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
const DRAFT_DIR = 'assets/sprites/bosses/redraw_drafts';
const REQUIRED_PAINTERLY_SOURCE_BOSSES = new Set(['viridis', 'ouroboros']);
const HP_WINDOW_DRAFT = {
    width: 384,
    height: 256,
    minSubjectPixels: 6000,
    minWindowRatio: 0.08,
    maxWindowRatio: 0.42,
    minOutsideMeanAlpha: 220,
    maxOutsideLowAlphaRatio: 0.24,
    maxWindowMeanAlpha: 165,
    minWindowTransparentRatio: 0.55,
    maskAspectByBoss: {
        mikro: { min: 0.92, max: 1.08 }
    }
};

function getPainterlySourceRel(bossId) {
    return `${DRAFT_DIR}/source_ai/boss_${bossId}_redraw_source_2026-06-23.png`;
}

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
        colorType: bytes[25],
        compression: bytes[26],
        filter: bytes[27],
        interlace: bytes[28]
    };
}

function verifyPngSignature(bytes) {
    if (bytes.length < 33) throw new Error('file is too small for PNG IHDR');
    for (let i = 0; i < PNG_SIGNATURE.length; i++) {
        if (bytes[i] !== PNG_SIGNATURE[i]) throw new Error('invalid PNG signature');
    }
}

function paethPredictor(left, up, upLeft) {
    const p = left + up - upLeft;
    const pa = Math.abs(p - left);
    const pb = Math.abs(p - up);
    const pc = Math.abs(p - upLeft);
    if (pa <= pb && pa <= pc) return left;
    if (pb <= pc) return up;
    return upLeft;
}

function readPngRgba(fullPath) {
    const bytes = fs.readFileSync(fullPath);
    verifyPngSignature(bytes);
    let offset = 8;
    let info = null;
    const idat = [];

    while (offset + 12 <= bytes.length) {
        const length = bytes.readUInt32BE(offset);
        const type = bytes.toString('ascii', offset + 4, offset + 8);
        const dataStart = offset + 8;
        const dataEnd = dataStart + length;
        if (dataEnd + 4 > bytes.length) throw new Error(`invalid PNG chunk ${type}`);
        if (type === 'IHDR') {
            info = {
                width: bytes.readUInt32BE(dataStart),
                height: bytes.readUInt32BE(dataStart + 4),
                bitDepth: bytes[dataStart + 8],
                colorType: bytes[dataStart + 9],
                compression: bytes[dataStart + 10],
                filter: bytes[dataStart + 11],
                interlace: bytes[dataStart + 12]
            };
        } else if (type === 'IDAT') {
            idat.push(bytes.subarray(dataStart, dataEnd));
        } else if (type === 'IEND') {
            break;
        }
        offset = dataEnd + 4;
    }

    if (!info) throw new Error('missing IHDR');
    if (info.bitDepth !== 8 || info.colorType !== 6) {
        throw new Error(`expected 8-bit RGBA PNG, got bitDepth=${info.bitDepth}, colorType=${info.colorType}`);
    }
    if (info.compression !== 0 || info.filter !== 0 || info.interlace !== 0) {
        throw new Error('unsupported PNG compression/filter/interlace mode');
    }
    if (idat.length === 0) throw new Error('missing IDAT data');

    const inflated = zlib.inflateSync(Buffer.concat(idat));
    const channels = 4;
    const bpp = 4;
    const rowBytes = info.width * channels;
    const expected = (rowBytes + 1) * info.height;
    if (inflated.length < expected) {
        throw new Error(`inflated PNG is too small: ${inflated.length}, expected at least ${expected}`);
    }

    const rgba = Buffer.alloc(rowBytes * info.height);
    let inOffset = 0;
    let outOffset = 0;
    for (let y = 0; y < info.height; y++) {
        const filterType = inflated[inOffset++];
        for (let x = 0; x < rowBytes; x++) {
            const raw = inflated[inOffset + x];
            const left = x >= bpp ? rgba[outOffset + x - bpp] : 0;
            const up = y > 0 ? rgba[outOffset + x - rowBytes] : 0;
            const upLeft = y > 0 && x >= bpp ? rgba[outOffset + x - rowBytes - bpp] : 0;
            let value;
            if (filterType === 0) value = raw;
            else if (filterType === 1) value = raw + left;
            else if (filterType === 2) value = raw + up;
            else if (filterType === 3) value = raw + Math.floor((left + up) / 2);
            else if (filterType === 4) value = raw + paethPredictor(left, up, upLeft);
            else throw new Error(`unsupported PNG row filter ${filterType}`);
            rgba[outOffset + x] = value & 0xff;
        }
        inOffset += rowBytes;
        outOffset += rowBytes;
    }

    return { ...info, rgba };
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

    if (!sheetRel.startsWith(`${DRAFT_DIR}/`) || !sheetRel.endsWith(`boss_${bossId}_redraw_idle_draft_sheet.png`)) {
        fail(`${bossId} runtime sheet must use redraw draft, got ${sheetRel}`);
        return;
    }
    if (metaRel !== sheetRel.replace(/\.png$/i, '.json')) {
        fail(`${bossId} runtime meta must sit beside redraw draft sheet, got ${metaRel}`);
        return;
    }

    if (!fs.existsSync(sheetPath)) {
        fail(`${bossId} missing sheet (${sheetRel})`);
        return;
    }
    if (!fs.existsSync(metaPath)) {
        fail(`${bossId} missing meta (${metaRel})`);
        return;
    }

    if (REQUIRED_PAINTERLY_SOURCE_BOSSES.has(bossId)) {
        const sourceRel = getPainterlySourceRel(bossId);
        const sourcePath = path.join(root, sourceRel);
        if (!fs.existsSync(sourcePath)) {
            fail(`${bossId} missing painterly redraw source (${sourceRel})`);
            return;
        }
        try {
            const sourcePng = readPngInfo(sourcePath);
            if (sourcePng.width < BOSS_SPRITE_REDRAW_FRAME_SIZE.width || sourcePng.height < BOSS_SPRITE_REDRAW_FRAME_SIZE.height) {
                fail(`${bossId} painterly redraw source is too small: ${sourcePng.width}x${sourcePng.height}`);
                return;
            }
            if (![2, 6].includes(sourcePng.colorType) || sourcePng.bitDepth !== 8) {
                fail(`${bossId} painterly redraw source must be 8-bit RGB/RGBA PNG, got bitDepth=${sourcePng.bitDepth}, colorType=${sourcePng.colorType}`);
                return;
            }
            pass(`${bossId} painterly redraw source present ${sourcePng.width}x${sourcePng.height}`);
        } catch (err) {
            fail(`${bossId} invalid painterly redraw source: ${err.message}`);
            return;
        }
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
        if (!isRedraw) {
            fail(`${bossId} runtime frame must be redraw 384x256, got ${frame.width}x${frame.height}${isLegacy ? ' legacy' : ''}`);
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

function validateHpReadableDraft(bossId) {
    const baseRel = path.join(DRAFT_DIR, `boss_${bossId}_base_draft_384x256.png`);
    const maskRel = path.join(DRAFT_DIR, `boss_${bossId}_hp_translucency_mask.png`);
    const previewRel = path.join(DRAFT_DIR, `boss_${bossId}_base_draft_hp_window_preview.png`);
    const basePath = path.join(root, baseRel);
    const maskPath = path.join(root, maskRel);
    const previewPath = path.join(root, previewRel);
    if (!fs.existsSync(basePath)) {
        fail(`${bossId} missing HP-readable 384x256 draft (${baseRel})`);
        return;
    }

    try {
        const png = readPngRgba(basePath);
        if (png.width !== HP_WINDOW_DRAFT.width || png.height !== HP_WINDOW_DRAFT.height) {
            fail(`${bossId} HP-window draft must be ${HP_WINDOW_DRAFT.width}x${HP_WINDOW_DRAFT.height}, got ${png.width}x${png.height}`);
            return;
        }
        if (!fs.existsSync(maskPath)) {
            fail(`${bossId} missing HP translucency mask (${maskRel})`);
            return;
        }
        const mask = readPngRgba(maskPath);
        if (mask.width !== HP_WINDOW_DRAFT.width || mask.height !== HP_WINDOW_DRAFT.height) {
            fail(`${bossId} HP translucency mask must be ${HP_WINDOW_DRAFT.width}x${HP_WINDOW_DRAFT.height}, got ${mask.width}x${mask.height}`);
            return;
        }

        let subject = 0;
        let windowPixels = 0;
        let windowAlphaSum = 0;
        let windowTransparent = 0;
        let outsidePixels = 0;
        let outsideAlphaSum = 0;
        let outsideLowAlpha = 0;
        let maskMinX = Infinity;
        let maskMinY = Infinity;
        let maskMaxX = -Infinity;
        let maskMaxY = -Infinity;
        let pixelIndex = 0;
        for (let i = 3; i < png.rgba.length; i += 4) {
            const alpha = png.rgba[i];
            const x = pixelIndex % png.width;
            const y = Math.floor(pixelIndex / png.width);
            pixelIndex++;
            if (alpha <= 0) continue;
            subject++;
            const maskAlpha = mask.rgba[i];
            if (maskAlpha > 48) {
                windowPixels++;
                windowAlphaSum += alpha;
                if (alpha <= 170) windowTransparent++;
                if (x < maskMinX) maskMinX = x;
                if (y < maskMinY) maskMinY = y;
                if (x > maskMaxX) maskMaxX = x;
                if (y > maskMaxY) maskMaxY = y;
            } else {
                outsidePixels++;
                outsideAlphaSum += alpha;
                if (alpha < 220) outsideLowAlpha++;
            }
        }
        if (subject < HP_WINDOW_DRAFT.minSubjectPixels) {
            fail(`${bossId} HP-window draft subject is too small: ${subject} pixels`);
            return;
        }
        const windowRatio = windowPixels / subject;
        if (windowRatio < HP_WINDOW_DRAFT.minWindowRatio || windowRatio > HP_WINDOW_DRAFT.maxWindowRatio) {
            fail(`${bossId} HP translucency mask coverage must be ${(HP_WINDOW_DRAFT.minWindowRatio * 100).toFixed(0)}%-${(HP_WINDOW_DRAFT.maxWindowRatio * 100).toFixed(0)}% of subject, got ${(windowRatio * 100).toFixed(1)}%`);
            return;
        }
        const aspectLimit = HP_WINDOW_DRAFT.maskAspectByBoss[bossId];
        if (aspectLimit) {
            const maskWidth = maskMaxX - maskMinX + 1;
            const maskHeight = maskMaxY - maskMinY + 1;
            const maskAspect = maskWidth / Math.max(1, maskHeight);
            if (maskAspect < aspectLimit.min || maskAspect > aspectLimit.max) {
                fail(`${bossId} HP translucency mask aspect must be ${aspectLimit.min}-${aspectLimit.max}, got ${maskAspect.toFixed(2)} (${maskWidth}x${maskHeight})`);
                return;
            }
        }
        const windowMeanAlpha = windowAlphaSum / Math.max(1, windowPixels);
        if (windowMeanAlpha > HP_WINDOW_DRAFT.maxWindowMeanAlpha) {
            fail(`${bossId} HP window mean alpha is too high: ${windowMeanAlpha.toFixed(1)}`);
            return;
        }
        const windowTransparentRatio = windowTransparent / Math.max(1, windowPixels);
        if (windowTransparentRatio < HP_WINDOW_DRAFT.minWindowTransparentRatio) {
            fail(`${bossId} HP window needs more translucent pixels, got ${(windowTransparentRatio * 100).toFixed(1)}%`);
            return;
        }
        const outsideMeanAlpha = outsideAlphaSum / Math.max(1, outsidePixels);
        if (outsideMeanAlpha < HP_WINDOW_DRAFT.minOutsideMeanAlpha) {
            fail(`${bossId} non-window body mean alpha is too low: ${outsideMeanAlpha.toFixed(1)}`);
            return;
        }
        const outsideLowAlphaRatio = outsideLowAlpha / Math.max(1, outsidePixels);
        if (outsideLowAlphaRatio > HP_WINDOW_DRAFT.maxOutsideLowAlphaRatio) {
            fail(`${bossId} too much non-window body is translucent: ${(outsideLowAlphaRatio * 100).toFixed(1)}%`);
            return;
        }
        if (!fs.existsSync(previewPath)) {
            fail(`${bossId} missing HP window preview (${previewRel})`);
            return;
        }
        const preview = readPngInfo(previewPath);
        if (preview.width !== HP_WINDOW_DRAFT.width || preview.height !== HP_WINDOW_DRAFT.height || preview.colorType !== 6) {
            fail(`${bossId} HP window preview must be ${HP_WINDOW_DRAFT.width}x${HP_WINDOW_DRAFT.height} RGBA`);
            return;
        }
        pass(`${bossId} HP-window mask coverage=${(windowRatio * 100).toFixed(1)}%, windowMean=${windowMeanAlpha.toFixed(1)}, bodyMean=${outsideMeanAlpha.toFixed(1)}`);
    } catch (err) {
        fail(`${bossId} invalid HP-window draft: ${err.message}`);
    }
}

function validateBossSpriteRuntimeDrawContract() {
    const enemyJsPath = path.join(root, 'src/entities/enemy.js');
    const code = fs.readFileSync(enemyJsPath, 'utf8');
    const methodStart = code.indexOf('_drawBossSpriteOutsideCollisionClip(ctx, w, h) {');
    const methodEnd = code.indexOf('_drawBossDecoration(ctx, w, h)', methodStart);
    if (methodStart < 0 || methodEnd <= methodStart) {
        fail('Boss runtime draw must expose a polygon clip-repair helper');
        return;
    }

    const helperCode = code.slice(methodStart, methodEnd);
    const decorationStart = methodEnd;
    const decorationEnd = code.indexOf('_drawArchetypeBody(ctx, w, h)', decorationStart);
    if (decorationEnd <= decorationStart) {
        fail('Boss runtime draw must keep Boss decoration before archetype rendering');
        return;
    }
    const decorationCode = code.slice(decorationStart, decorationEnd);
    const hasPostClipCall = code.includes('this._drawBossSpriteOutsideCollisionClip(ctx, w, h);');
    const clipsOnlyPolygonBosses = helperCode.includes("this.type !== 'boss' || this.collisionShape !== 'polygon'");
    const usesInverseClip = helperCode.includes("ctx.clip('evenodd')");
    const keepsFrameAspect = helperCode.includes('getCurrentFrameAspect') && helperCode.includes('bossSpriteAspect > 1.18');
    if (!hasPostClipCall || !clipsOnlyPolygonBosses || !usesInverseClip || !keepsFrameAspect) {
        fail('Boss runtime draw must repair polygon collision clipping without changing 384x256 frame aspect');
        return;
    }

    pass('Boss runtime draw repairs polygon collision clipping after the physics clip is restored');

    const scalesMikroAndDevourer = helperCode.includes('bossSpriteScale')
        && decorationCode.includes('bossSpriteScale')
        && code.includes("this.bossType === 'devourer'")
        && code.includes('1.14')
        && code.includes("this.bossType === 'mikro'")
        && code.includes('1.10');
    const appliesSpriteScale = helperCode.includes('w * bossSpriteScale')
        && helperCode.includes('h * bossSpriteScale')
        && helperCode.includes('Math.min(w, h) * bossSpriteScale')
        && decorationCode.includes('w * bossSpriteScale')
        && decorationCode.includes('h * bossSpriteScale')
        && decorationCode.includes('Math.min(w, h) * bossSpriteScale');
    if (!scalesMikroAndDevourer || !appliesSpriteScale) {
        fail('Boss runtime draw must enlarge Mikro and Devourer sprite art without changing collision data');
        return;
    }

    const softensOverlay = decorationCode.includes('bossEffectBreath')
        && decorationCode.includes('bossEffectAlpha')
        && decorationCode.includes('ctx.globalAlpha *= bossEffectAlpha')
        && decorationCode.includes('0.34')
        && decorationCode.includes('0.46');
    if (!softensOverlay) {
        fail('Boss runtime draw must soften programmatic Boss overlay effects with a breathing alpha gate');
        return;
    }

    pass('Boss runtime draw keeps Mikro/Devourer art larger and gates legacy overlay effects with breathing alpha');
}

console.log('Boss base sprite asset validation');

validateBossSpriteRuntimeDrawContract();

for (const bossId of BOSS_SPRITE_BOSS_IDS) {
    validateBossSprite(bossId);
    validateHpReadableDraft(bossId);
}

const total = passed + failed;
console.log(`\nResult: ${passed}/${total} passed (${redraw} redraw, ${legacy} legacy)`);
if (failures.length > 0) {
    console.log('Failures:');
    failures.forEach(item => console.log(`  - ${item}`));
}

process.exit(failed > 0 ? 1 : 0);
