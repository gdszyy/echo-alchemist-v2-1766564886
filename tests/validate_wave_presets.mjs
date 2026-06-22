/**
 * validate_wave_presets.mjs — V2 large enemy wave preset static validation.
 *
 * Usage:
 *   node tests/validate_wave_presets.mjs
 */

import {
    ENEMY_WAVE_PRESETS,
    ENEMY_WAVE_PRESET_ARCHETYPES,
    DIRECTOR_SCRIPTS,
    DIRECTOR_SCRIPT_CONFIG,
    DIRECTOR_ACTOR_INTRO_ROUNDS,
} from '../src/wave_presets.js';

const ENEMY_COLS = 6;
const LARGE_LIMITS = {
    maw: 2,
    hive: 1,
    siege: 1,
    gravityWell: 1,
};

let passed = 0;
let failed = 0;
const failures = [];

function check(condition, message) {
    if (condition) {
        passed++;
    } else {
        failed++;
        failures.push(message);
        console.log(`  x ${message}`);
    }
}

function startCandidates(lane, cols) {
    const centerStart = Math.floor((ENEMY_COLS - cols) / 2);
    let starts = [];
    if (lane === 'left') {
        starts = Array.from({ length: ENEMY_COLS - cols + 1 }, (_, i) => i);
    } else if (lane === 'right') {
        starts = Array.from({ length: ENEMY_COLS - cols + 1 }, (_, i) => ENEMY_COLS - cols - i);
    } else if (lane === 'side') {
        starts = [0, ENEMY_COLS - cols];
        for (let i = 1; i <= ENEMY_COLS - cols - 1; i++) starts.push(i);
    } else {
        starts = [centerStart];
        for (let offset = 1; offset <= ENEMY_COLS; offset++) {
            if (centerStart - offset >= 0) starts.push(centerStart - offset);
            if (centerStart + offset <= ENEMY_COLS - cols) starts.push(centerStart + offset);
        }
    }
    return [...new Set(starts.filter(sc => sc >= 0 && sc <= ENEMY_COLS - cols))];
}

function placePresetSlots(preset) {
    const occupied = Array(ENEMY_COLS).fill(false);
    const placements = [];
    for (const slot of preset.slots || []) {
        const meta = ENEMY_WAVE_PRESET_ARCHETYPES[slot.archetype] || {};
        const cols = slot.cols || meta.cols || 1;
        const rows = slot.rows || meta.rows || 1;
        let placed = null;
        for (const startCol of startCandidates(slot.lane || 'center', cols)) {
            let free = true;
            for (let dc = 0; dc < cols; dc++) {
                if (occupied[startCol + dc]) {
                    free = false;
                    break;
                }
            }
            if (free) {
                placed = { startCol, cols, rows, slot };
                break;
            }
        }
        if (!placed) return { ok: false, placements };
        placements.push(placed);
        for (let dc = 0; dc < placed.cols; dc++) occupied[placed.startCol + dc] = true;
    }
    return { ok: true, placements };
}

function collectPresetActorAffixes(preset) {
    const affixes = new Set();
    for (const slot of preset.slots || []) {
        const meta = ENEMY_WAVE_PRESET_ARCHETYPES[slot.archetype] || {};
        if (meta.affix) affixes.add(meta.affix);
        for (const affix of slot.affixes || []) {
            if (affix) affixes.add(affix);
        }
    }
    return [...affixes];
}

console.log('═══════════════════════════════════════════════════');
console.log('  ENEMY_WAVE_PRESETS 静态结构校验');
console.log('═══════════════════════════════════════════════════\n');

const ids = new Set();
const scriptIds = new Set();
const scriptMap = new Map();
for (const script of DIRECTOR_SCRIPTS) {
    check(typeof script.id === 'string' && script.id.length > 0, `${script.id || '<missing>'}.script id non-empty`);
    check(!scriptIds.has(script.id), `${script.id}.script id unique`);
    scriptIds.add(script.id);
    scriptMap.set(script.id, script);
    check((script.repeatCooldownRounds || 0) >= 0, `${script.id}.repeatCooldownRounds valid`);
    check((script.maxUnfamiliarActors ?? DIRECTOR_SCRIPT_CONFIG.maxUnfamiliarActorsPerPreset) >= 0, `${script.id}.maxUnfamiliarActors valid`);
    check(Array.isArray(script.beats) && script.beats.length > 0, `${script.id}.beats non-empty`);
}

for (const preset of ENEMY_WAVE_PRESETS) {
    check(typeof preset.id === 'string' && preset.id.length > 0, `${preset.id || '<missing>'}.id 非空`);
    check(!ids.has(preset.id), `${preset.id}.id 唯一`);
    ids.add(preset.id);

    check(Array.isArray(preset.roundRange) && preset.roundRange.length === 2, `${preset.id}.roundRange 格式正确`);
    if (Array.isArray(preset.roundRange) && preset.roundRange.length === 2) {
        check(preset.roundRange[0] <= preset.roundRange[1], `${preset.id}.roundRange 起止合法`);
    }
    check((preset.weight || 0) > 0, `${preset.id}.weight > 0`);
    check(Array.isArray(preset.slots) && preset.slots.length > 0, `${preset.id}.slots 非空`);
    check(typeof preset.scriptId === 'string' && preset.scriptId.length > 0, `${preset.id}.scriptId non-empty`);
    check(typeof preset.beatId === 'string' && preset.beatId.length > 0, `${preset.id}.beatId non-empty`);
    const script = scriptMap.get(preset.scriptId);
    check(!!script, `${preset.id}.scriptId registered`);
    const beat = script?.beats?.find(item => item.presetId === preset.id);
    check(!!beat, `${preset.id}.script beat registered`);
    if (beat) {
        check(
            beat.roundRange?.[0] === preset.roundRange?.[0] && beat.roundRange?.[1] === preset.roundRange?.[1],
            `${preset.id}.script beat roundRange matches preset`
        );
        check(Array.isArray(beat.actors) && beat.actors.length > 0, `${preset.id}.script beat actors non-empty`);
    }
    if (preset.directorTags !== undefined) {
        check(
            Array.isArray(preset.directorTags) && preset.directorTags.every(tag => typeof tag === 'string' && tag.length > 0),
            `${preset.id}.directorTags 格式正确`
        );
    }

    const largeCounts = {};
    for (const slot of preset.slots || []) {
        const archetype = slot.archetype || 'normal';
        const meta = ENEMY_WAVE_PRESET_ARCHETYPES[archetype];
        if (archetype !== 'normal') {
            check(!!meta, `${preset.id}.${archetype} 已注册`);
            if (meta) {
                check((slot.cols || meta.cols) === meta.cols, `${preset.id}.${archetype}.cols 匹配`);
                check((slot.rows || meta.rows) === meta.rows, `${preset.id}.${archetype}.rows 匹配`);
                check((slot.affixes || []).includes(meta.affix), `${preset.id}.${archetype}.affixes 包含专属词条 ${meta.affix}`);
            }
            largeCounts[archetype] = (largeCounts[archetype] || 0) + 1;
        }

        const cols = slot.cols || (meta && meta.cols) || 1;
        const rows = slot.rows || (meta && meta.rows) || 1;
        check(cols >= 1 && cols <= ENEMY_COLS, `${preset.id}.${archetype}.cols 在 1-${ENEMY_COLS}`);
        check(rows >= 1 && rows <= 3, `${preset.id}.${archetype}.rows 在 1-3`);
        check(['center', 'left', 'right', 'side', undefined].includes(slot.lane), `${preset.id}.${archetype}.lane 合法`);
    }

    for (const [archetype, limit] of Object.entries(LARGE_LIMITS)) {
        check((largeCounts[archetype] || 0) <= limit, `${preset.id}.${archetype} 数量 <= ${limit}`);
    }
    if (largeCounts.gravityWell) {
        const otherLarge = Object.keys(largeCounts).filter(k => k !== 'gravityWell' && largeCounts[k] > 0);
        check(otherLarge.length === 0, `${preset.id}.gravityWell 不与其它大型基底同 preset`);
    }

    const affixes = collectPresetActorAffixes(preset);
    for (const affix of affixes) {
        check(Number.isFinite(DIRECTOR_ACTOR_INTRO_ROUNDS[affix]), `${preset.id}.${affix} actor intro round registered`);
    }
    const firstRound = preset.roundRange?.[0] || 1;
    const unfamiliarAffixes = affixes.filter(affix => {
        const introRound = DIRECTOR_ACTOR_INTRO_ROUNDS[affix];
        return Number.isFinite(introRound)
            && firstRound >= introRound
            && firstRound - introRound <= (DIRECTOR_SCRIPT_CONFIG.unfamiliarRoundWindow || 0);
    });
    const unfamiliarLimit = preset.maxUnfamiliarActors
        ?? script?.maxUnfamiliarActors
        ?? DIRECTOR_SCRIPT_CONFIG.maxUnfamiliarActorsPerPreset;
    check(unfamiliarAffixes.length <= unfamiliarLimit, `${preset.id}.unfamiliar actors <= ${unfamiliarLimit}`);

    const placement = placePresetSlots(preset);
    check(placement.ok, `${preset.id} 可按 lane 放入 ${ENEMY_COLS} 列`);
    for (const p of placement.placements) {
        check(p.startCol >= 0 && p.startCol + p.cols <= ENEMY_COLS, `${preset.id}.${p.slot.archetype} 不越界`);
    }
}

console.log('\n═══════════════════════════════════════════════════');
console.log(`  校验结果: ${passed}/${passed + failed} 通过`);
if (failures.length > 0) {
    console.log('\n  失败项目:');
    failures.forEach(f => console.log(`    - ${f}`));
}
console.log('═══════════════════════════════════════════════════');

process.exit(failed > 0 ? 1 : 0);
