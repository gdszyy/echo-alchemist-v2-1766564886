const DEFAULT_MINI_BOSS_ORDER = ['ignis', 'glacies', 'mikro', 'devourer'];
const DEFAULT_BIG_BOSS_ORDER = ['viridis', 'tesla', 'chimera', 'ouroboros'];

// =========================================
// 波次循环（Dome Keeper 式「挖 → 守」）
// 每回合 = 1 波；一个循环 = N 个普通波 + 1 个 Boss 波（Boss 波持续到 Boss 被击杀）。
// =========================================
export const DEFAULT_NORMAL_WAVES_PER_BOSS = 3;
/** 已生成 Boss、等待击杀期间 _nextBossRound 的占位值（>= 9000 视为未排期） */
export const BOSS_WAVE_IN_PROGRESS = 9999;

export function resolveNormalWavesPerBoss(value) {
    const n = Math.floor(Number(value));
    return Number.isFinite(n) && n >= 1 ? n : DEFAULT_NORMAL_WAVES_PER_BOSS;
}

/**
 * 计算下一个 Boss 波的回合号。
 * @param {number} lastBossKillRound - 上一个 Boss 被击杀的回合（尚无则传 0）
 * @param {number} [normalWavesPerBoss]
 * @returns {number} 首局为 N+1（默认 Round 4）；击杀于 K 回合则为 K+N+1
 */
export function computeNextBossRound(lastBossKillRound, normalWavesPerBoss) {
    const n = resolveNormalWavesPerBoss(normalWavesPerBoss);
    const base = Number(lastBossKillRound);
    return (Number.isFinite(base) && base > 0 ? base : 0) + n + 1;
}

export function findActiveBoss(game) {
    return (game?.enemies || []).find(enemy =>
        enemy && enemy.active && !enemy.isDead && enemy.hp > 0 && enemy.type === 'boss'
    ) || null;
}

function _lastBossKillRound(game) {
    const log = Array.isArray(game?.bossDefeatedLog) ? game.bossDefeatedLog : [];
    const last = log[log.length - 1];
    return last && Number.isFinite(Number(last.round)) ? Number(last.round) : 0;
}

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

export function getNextBossRoundPreview(game, curveConfig = null, normalWavesPerBoss = DEFAULT_NORMAL_WAVES_PER_BOSS) {
    if (!game) return null;

    const scheduledRound = Number(game._nextBossRound);
    if (Number.isFinite(scheduledRound) && scheduledRound > 0 && scheduledRound < 9000) {
        return scheduledRound;
    }

    const spawnCount = game._bossSpawnCount || 0;
    if (game._isTutorialRun) return spawnCount === 0 ? 2 : null;
    // Boss 波进行中：下一个 Boss 波要等本 Boss 被击杀后才排期
    if (findActiveBoss(game) || game._pendingBossSpawn) return null;
    // Boss 已离场但尚未经 boss:defeated 排期（DoT/AoE 击杀，回合结算时由 spawn_reconcileBossWave 收口）：
    // 按本回合击杀预告，避免 HUD 显示不存在的 Boss 波
    if (scheduledRound >= BOSS_WAVE_IN_PROGRESS && spawnCount > 0) {
        return computeNextBossRound(Number(game.round) || 0, normalWavesPerBoss);
    }

    return computeNextBossRound(_lastBossKillRound(game), normalWavesPerBoss);
}

/**
 * 当前波次信息（HUD / 横幅 / 钉板预告的唯一口径）。
 * @returns {{ round:number, cycle:number, waveInCycle:number, wavesPerCycle:number,
 *   normalWavesPerBoss:number, isBossWave:boolean, wavesUntilBoss:number,
 *   bossRoundsElapsed:number, nextBossRound:(number|null) }}
 */
export function getWaveInfo(game, normalWavesPerBoss = DEFAULT_NORMAL_WAVES_PER_BOSS) {
    let n = resolveNormalWavesPerBoss(normalWavesPerBoss);
    // 新手教程局：唯一 Boss 在 Round 2，按「1 个普通波 + Boss 波」展示
    if (game?._isTutorialRun) n = 1;
    const round = Math.max(1, Number(game?.round) || 1);
    const bossesSpawned = game?._bossSpawnCount || 0;
    const activeBoss = findActiveBoss(game);

    if (activeBoss) {
        const spawnRound = Number(game?._lastBossSpawnRound) || round;
        return {
            round,
            cycle: Math.max(1, bossesSpawned),
            waveInCycle: n + 1,
            wavesPerCycle: n + 1,
            normalWavesPerBoss: n,
            isBossWave: true,
            wavesUntilBoss: 0,
            bossRoundsElapsed: Math.max(1, round - spawnRound + 1),
            nextBossRound: null,
        };
    }

    const nextBossRound = getNextBossRoundPreview(game, null, n);
    const wavesUntilBoss = Number.isFinite(nextBossRound) ? Math.max(0, nextBossRound - round) : n;
    const waveInCycle = Math.min(n + 1, Math.max(1, n + 1 - wavesUntilBoss));
    return {
        round,
        cycle: bossesSpawned + 1,
        waveInCycle,
        wavesPerCycle: n + 1,
        normalWavesPerBoss: n,
        isBossWave: wavesUntilBoss === 0,
        wavesUntilBoss,
        bossRoundsElapsed: 0,
        nextBossRound: Number.isFinite(nextBossRound) ? nextBossRound : null,
    };
}

export function getBossPreviewInfo(game, curveConfig = null, normalWavesPerBoss = DEFAULT_NORMAL_WAVES_PER_BOSS) {
    const nextRound = getNextBossRoundPreview(game, curveConfig, normalWavesPerBoss);
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
