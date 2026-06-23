/**
 * boss_sprite_assets.js - Boss base sprite redraw asset contract.
 *
 * Boss base sprites are separate from vulnerability overlays. The current
 * 256x256 sheets remain valid legacy assets; redrawn sheets should declare
 * 384x256 frames so the renderer can use the full 3x2 Boss footprint.
 */

export const BOSS_SPRITE_BOSS_IDS = [
    'ignis',
    'glacies',
    'mikro',
    'devourer',
    'viridis',
    'tesla',
    'chimera',
    'ouroboros'
];

export const BOSS_SPRITE_ROOT = 'assets/sprites/bosses';
export const BOSS_SPRITE_REDRAW_DRAFT_ROOT = `${BOSS_SPRITE_ROOT}/redraw_drafts`;

export const BOSS_SPRITE_LEGACY_FRAME_SIZE = {
    width: 256,
    height: 256
};

export const BOSS_SPRITE_REDRAW_FRAME_SIZE = {
    width: 384,
    height: 256,
    anchorX: 192,
    anchorY: 128
};

export const BOSS_SPRITE_IDLE_CONTRACT = {
    animation: 'idle',
    row: 0,
    minFrames: 6,
    fps: 6
};

export function getBossSpriteLegacySheetPath(bossId) {
    if (!bossId) return null;
    return `${BOSS_SPRITE_ROOT}/boss_${bossId}.png`;
}

export function getBossSpriteLegacyMetaPath(bossId) {
    if (!bossId) return null;
    return `${BOSS_SPRITE_ROOT}/boss_${bossId}.json`;
}

export function getBossSpriteRedrawDraftSheetPath(bossId) {
    if (!bossId) return null;
    return `${BOSS_SPRITE_REDRAW_DRAFT_ROOT}/boss_${bossId}_redraw_idle_draft_sheet.png`;
}

export function getBossSpriteRedrawDraftMetaPath(bossId) {
    if (!bossId) return null;
    return `${BOSS_SPRITE_REDRAW_DRAFT_ROOT}/boss_${bossId}_redraw_idle_draft_sheet.json`;
}

// @perf-impact: Boss runtime uses 384x256 redraw sheets through the existing single SpriteRenderer draw call.
export function getBossSpriteSheetPath(bossId) {
    return getBossSpriteRedrawDraftSheetPath(bossId);
}

export function getBossSpriteMetaPath(bossId) {
    return getBossSpriteRedrawDraftMetaPath(bossId);
}

export function getBossSpriteRawConceptPath(bossId) {
    if (!bossId) return null;
    return `${BOSS_SPRITE_ROOT}/raw/${bossId}_idle_raw.png`;
}

export function isKnownBossSpriteId(bossId) {
    return BOSS_SPRITE_BOSS_IDS.includes(bossId);
}
