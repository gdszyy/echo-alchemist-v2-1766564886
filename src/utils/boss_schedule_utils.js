const DEFAULT_MINI_BOSS_ORDER = ['ignis', 'glacies', 'mikro', 'devourer'];
const DEFAULT_BIG_BOSS_ORDER = ['viridis', 'tesla', 'chimera', 'ouroboros'];
const FALLBACK_BOSS_ROUNDS = [5, 12, 19, 26, 33, 40, 47, 54];

export function normalizeBossKey(id) {
    const raw = String(id || '').replace(/^boss_/, '');
    return raw === 'micro' ? 'mikro' : raw;
}

export function getBossDisplayName(bossId, bossConfigs = null, bossDb = []) {
    const key = normalizeBossKey(bossId);
    if (!key) return 'Boss';
    const configName = bossConfigs?.[key]?.name;
    const dbEntry = (bossDb || []).find(entry => normalizeBossKey(entry?.id) === key);
    return configName || dbEntry?.name || key;
}

export function getBossShortName(bossId, bossConfigs = null, bossDb = []) {
    const fullName = getBossDisplayName(bossId, bossConfigs, bossDb);
    const parts = String(fullName).split(/[·・]/);
    return (parts[parts.length - 1] || fullName).trim();
}

function _uniqueKnownBosses(ids, fallbackOrder) {
    const fallbackSet = new Set(fallbackOrder);
    const unique = [];
    ids.forEach(id => {
        const key = normalizeBossKey(id);
        if (fallbackSet.has(key) && !unique.includes(key)) unique.push(key);
    });
    return unique.length > 0 ? unique : fallbackOrder;
}

export function getBossOrder(isBigBoss, curveConfig = null) {
    const segmentIds = (curveConfig?.THEME_SEGMENTS || [])
        .map(segment => normalizeBossKey(segment?.bossId))
        .filter(Boolean);
    return isBigBoss
        ? _uniqueKnownBosses(segmentIds, DEFAULT_BIG_BOSS_ORDER)
        : _uniqueKnownBosses(segmentIds, DEFAULT_MINI_BOSS_ORDER);
}

export function predictBossIdFromHistory(history, isBigBoss, curveConfig = null) {
    const order = getBossOrder(isBigBoss, curveConfig);
    const normalizedHistory = Array.isArray(history) ? history.map(normalizeBossKey) : [];
    const appeared = normalizedHistory.filter(id => order.includes(id));
    const remaining = order.filter(id => !appeared.includes(id));
    return remaining.length > 0 ? remaining[0] : order[appeared.length % order.length];
}

export function getNextBossRoundPreview(game, curveConfig = null) {
    if (!game) return null;

    const scheduledRound = Number(game._nextBossRound);
    if (Number.isFinite(scheduledRound) && scheduledRound > 0 && scheduledRound < 9000) {
        return scheduledRound;
    }

    const spawnCount = game._bossSpawnCount || 0;
    if (game._isTutorialRun) return spawnCount === 0 ? 2 : null;

    const segments = curveConfig?.THEME_SEGMENTS || [];
    if (segments.length > 0) {
        if (spawnCount < segments.length) return segments[spawnCount].endRound;
        const lastSegment = segments[segments.length - 1];
        const prevSegment = segments[segments.length - 2];
        const interval = lastSegment && prevSegment ? lastSegment.endRound - prevSegment.endRound : 7;
        return (game._lastBossSpawnRound || game.round || 1) + interval;
    }

    if (spawnCount < FALLBACK_BOSS_ROUNDS.length) return FALLBACK_BOSS_ROUNDS[spawnCount];
    return (game._lastBossSpawnRound || game.round || 1) + 7;
}

export function getBossPreviewInfo(game, curveConfig = null) {
    const nextRound = getNextBossRoundPreview(game, curveConfig);
    if (!nextRound) return null;

    const currentRound = Math.max(1, Number(game?.round) || 1);
    const pendingBossId = normalizeBossKey(game?._pendingBossSpawn?.bossId);
    const isBigBoss = pendingBossId
        ? !!game?._pendingBossSpawn?.isBigBoss
        : (game?._isTutorialRun ? true : (game?._bossSpawnCount || 0) >= 4);
    const bossId = pendingBossId || predictBossIdFromHistory(game?.bossHistory, isBigBoss, curveConfig);

    let history = Array.isArray(game?.bossHistory) ? game.bossHistory.map(normalizeBossKey) : [];
    if (pendingBossId && history[history.length - 1] === pendingBossId) {
        history = history.slice(0, -1);
    }
    const defeated = Array.isArray(game?.bossDefeatedLog)
        ? game.bossDefeatedLog.map(entry => normalizeBossKey(entry?.bossId))
        : [];

    return {
        bossId,
        currentRound,
        isBigBoss,
        isPending: !!pendingBossId,
        known: [...history, ...defeated].includes(bossId),
        nextRound,
        turnsUntil: Math.max(0, nextRound - currentRound),
    };
}
