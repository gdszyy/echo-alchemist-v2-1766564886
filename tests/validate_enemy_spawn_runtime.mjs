/**
 * validate_enemy_spawn_runtime.mjs - Runtime smoke checks for V2 large enemy spawning.
 *
 * Usage:
 *   node tests/validate_enemy_spawn_runtime.mjs
 */

function installBrowserStubs() {
    const context2d = {
        save() {},
        restore() {},
        clearRect() {},
        fillRect() {},
        strokeRect() {},
        beginPath() {},
        closePath() {},
        arc() {},
        moveTo() {},
        lineTo() {},
        quadraticCurveTo() {},
        bezierCurveTo() {},
        fill() {},
        stroke() {},
        translate() {},
        rotate() {},
        scale() {},
        drawImage() {},
        createLinearGradient() { return { addColorStop() {} }; },
        createRadialGradient() { return { addColorStop() {} }; },
        measureText(text) { return { width: String(text || '').length * 8 }; },
        setTransform() {},
        fillText() {},
        strokeText() {},
    };

    globalThis.OffscreenCanvas = class {
        constructor(width, height) {
            this.width = width;
            this.height = height;
        }
        getContext() {
            return context2d;
        }
    };
    globalThis.HTMLCanvasElement = class {};
    globalThis.Image = class {
        set src(value) {
            this._src = value;
            if (typeof this.onload === 'function') queueMicrotask(() => this.onload());
        }
        get src() {
            return this._src;
        }
    };
    globalThis.document = {
        createElement(tagName) {
            if (tagName === 'canvas') {
                return {
                    width: 0,
                    height: 0,
                    getContext() { return context2d; },
                };
            }
            return {
                style: {},
                classList: { add() {}, remove() {}, toggle() {} },
                appendChild() {},
                remove() {},
                setAttribute() {},
                getContext() { return context2d; },
            };
        },
        getElementById() {
            return {
                innerText: '',
                textContent: '',
                style: {},
                classList: { add() {}, remove() {}, toggle() {} },
                appendChild() {},
                remove() {},
            };
        },
        body: { appendChild() {} },
    };
    globalThis.window = globalThis;
    globalThis.localStorage = {
        getItem() { return null; },
        setItem() {},
        removeItem() {},
    };
}

function makeRng(seed) {
    let state = seed >>> 0;
    return () => {
        state = (1664525 * state + 1013904223) >>> 0;
        return state / 0x100000000;
    };
}

function withRandom(randomFn, fn) {
    const original = Math.random;
    Math.random = randomFn;
    try {
        return fn();
    } finally {
        Math.random = original;
    }
}

function withImmediateTimers(fn) {
    const original = globalThis.setTimeout;
    globalThis.setTimeout = (callback) => {
        if (typeof callback === 'function') callback();
        return 0;
    };
    try {
        return fn();
    } finally {
        globalThis.setTimeout = original;
    }
}

function getEnemyOccupiedRects(enemy) {
    const centerY = enemy.dropTargetY ?? enemy.pos.y;
    if (Array.isArray(enemy.footprintMask) && enemy.footprintMask.length > 0) {
        const rows = enemy.footprintMask.length;
        const cols = Math.max(1, ...enemy.footprintMask.map(row => Array.isArray(row) ? row.length : 0));
        const cellW = enemy.width / Math.max(1, cols);
        const cellH = enemy.height / Math.max(1, rows);
        const originX = enemy.pos.x - enemy.width / 2;
        const originY = centerY - enemy.height / 2;
        const rects = [];
        for (let row = 0; row < rows; row++) {
            const maskRow = enemy.footprintMask[row] || [];
            for (let col = 0; col < cols; col++) {
                if (!maskRow[col]) continue;
                rects.push({
                    left: originX + col * cellW,
                    right: originX + (col + 1) * cellW,
                    top: originY + row * cellH,
                    bottom: originY + (row + 1) * cellH,
                });
            }
        }
        return rects;
    }
    return [{
        left: enemy.pos.x - enemy.width / 2,
        right: enemy.pos.x + enemy.width / 2,
        top: centerY - enemy.height / 2,
        bottom: centerY + enemy.height / 2,
    }];
}

function rectsOverlap(a, b) {
    return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
}

function makeGame(spawnSystem, config) {
    const game = {
        round: 1,
        enemies: [],
        enemyWidth: 60,
        enemyHeight: 50,
        combatGridTopY: 100,
        difficultyGrowthFactor: 1,
        nextRoundHpMultiplier: 1,
        postBossMultiplier: 1,
        marbleQueue: [],
        bossHistory: [],
        particles: [],
        particleCounts: { wind_slash: 0, line: 0, ember: 0, mist: 0, shard: 0, spark: 0, smoke: 0, venom: 0 },
        _particlePool: [],
        shockwaves: [],
        fireWaves: [],
        deathExplosions: [],
        impactBlasts: [],
        lightningBolts: [],
        floatingTexts: [],
        screenShakes: [],
        damageReported: 0,
        roundDamage: 0,
        currentShotDamage: 0,
        currentShotDamageByAttr: {},
        shotDamageMap: new Map(),
        frameDamageAccumulator: 0,
        _damageRecentSamples: [],
        perfQualityLevel: 'low',
        activeElementResonances: {},
        width: 360,
        height: 720,
        defeatLineY: 650,
        playerShield: 0,
        _wavePresetUsage: {},
        _wavePresetIntroShown: {},
        _wavePresetRoundUsed: null,
        _directorScriptUsage: {},
        _directorLastScriptId: null,
        calc_getRecentAverageDamage() { return 0; },
        combat_calculatePlayerExpectedDamage() { return 10; },
        sys_determineEnemyReward(enemy) { enemy.rewardType = 'gold'; },
        spawn_createShockwave() { this.shockwaves.push({}); },
        spawn_createImpactBlast(x, y, color) { this.impactBlasts.push({ x, y, color }); },
        spawn_createParticle(x, y, color, mode = 'normal') { this.particles.push({ x, y, color, mode }); },
        spawn_pushParticleWithLimit(particle) { this.particles.push(particle); },
        spawn_createFloatingText(x, y, text) { this.floatingTexts.push({ x, y, text }); },
        spawn_createSkillIgnition(x, y, color) { this.particles.push({ x, y, color, mode: 'skill_ignition' }); },
        triggerScreenShake(amount) { this.screenShakes.push(amount); },
        triggerScreenShakeAdvanced(amount, duration) { this.screenShakes.push({ amount, duration }); },
        combat_recordDamage(amount) { this.damageReported += amount || 0; },
        combat_reportDamage(amount) { this.damageReported += amount || 0; },
        ui_updateRoundDamage() {},
        ui_updateMultiplierUI() {},
        spawn_addScore() {},
        sys_saveRunState() {},
        calc_isAreaOccupied(centerX, centerY, width, height, excludeEnemy = null) {
            const query = {
                left: centerX - width / 2,
                right: centerX + width / 2,
                top: centerY - height / 2,
                bottom: centerY + height / 2,
            };
            return this.enemies.some((enemy) => {
                if (!enemy || !enemy.active) return false;
                if (enemy === excludeEnemy) return false;
                return getEnemyOccupiedRects(enemy).some(rect => rectsOverlap(query, rect));
            });
        },
    };

    for (const [key, value] of Object.entries(spawnSystem)) {
        if (typeof value === 'function') game[key] = value.bind(game);
    }

    game._spawnRuntimeConfig = config;
    return game;
}

function bindSystem(game, system) {
    for (const [key, value] of Object.entries(system)) {
        if (typeof value === 'function') game[key] = value.bind(game);
    }
}

function calcExpectedVenomEffectiveStacks(rawStacks) {
    const stacks = Math.max(0, Math.floor(rawStacks || 0));
    const venomCfg = CONFIG.mechanics.venom;
    const linearStacks = Math.max(0, Math.floor(venomCfg.linearStacks ?? 30));
    const overflowSqrtScale = Math.max(0, venomCfg.overflowSqrtScale ?? 6);
    if (stacks <= linearStacks) return stacks;
    return linearStacks + Math.sqrt(stacks - linearStacks) * overflowSqrtScale;
}

function calcExpectedVenomTick(rawStacks, dotMultiplier = 1) {
    return calcExpectedVenomEffectiveStacks(rawStacks) * (CONFIG.mechanics.venom.dotPerStack || 0.8) * dotMultiplier;
}

function countArchetypes(enemies) {
    const counts = {};
    for (const enemy of enemies) {
        if (!enemy || !enemy.active || !enemy.baseArchetype) continue;
        counts[enemy.baseArchetype] = (counts[enemy.baseArchetype] || 0) + 1;
    }
    return counts;
}

function assertLargeLimits(game) {
    const counts = countArchetypes(game.enemies);
    check((counts.maw || 0) <= 2, 'runtime maw active count <= 2');
    check((counts.hive || 0) <= 1, 'runtime hive active count <= 1');
    check((counts.siege || 0) <= 1, 'runtime siege active count <= 1');
    check((counts.carrier || 0) <= 1, 'runtime carrier active count <= 1');
    check((counts.gravityWell || 0) <= 1, 'runtime gravityWell active count <= 1');
    if ((counts.gravityWell || 0) > 0) {
        const otherLarge = Object.entries(counts).filter(([id, count]) => id !== 'gravityWell' && count > 0);
        check(otherLarge.length === 0, 'runtime gravityWell does not coexist with other large archetypes');
    }
}

function assertNoOverlap(game) {
    for (let i = 0; i < game.enemies.length; i++) {
        const a = game.enemies[i];
        if (!a || !a.active) continue;
        for (let j = i + 1; j < game.enemies.length; j++) {
            const b = game.enemies[j];
            if (!b || !b.active) continue;
            const overlaps = getEnemyOccupiedRects(a).some(rectA =>
                getEnemyOccupiedRects(b).some(rectB => rectsOverlap(rectA, rectB))
            );
            check(!overlaps, `runtime enemies do not overlap (${i}, ${j})`);
        }
    }
}

function assertGridDimensions(game) {
    for (const enemy of game.enemies) {
        if (!enemy || !enemy.active || !enemy.baseArchetype) continue;
        check(enemy.width === enemy.gridCols * game.enemyWidth, `${enemy.baseArchetype} width matches gridCols`);
        check(enemy.height === enemy.gridRows * game.enemyHeight, `${enemy.baseArchetype} height matches gridRows`);
    }
}

function assertArchetypeContract(enemy, archetypeId, meta, game, config) {
    const expectedShapes = {
        bastion: 'aabb',
        maw: 'polygon',
        deflector: 'polygon',
        echoSpire: 'polygon',
        prism: 'polygon',
        hive: 'aabb',
        siege: 'polygon',
        carrier: 'polygon',
        gravityWell: 'arc',
    };

    check(enemy.type === 'elite', `${archetypeId} is elite`);
    check(enemy.baseArchetype === archetypeId, `${archetypeId} stores baseArchetype`);
    check(enemy.gridCols === meta.cols, `${archetypeId} gridCols matches metadata`);
    check(enemy.gridRows === meta.rows, `${archetypeId} gridRows matches metadata`);
    check(enemy.width === meta.cols * game.enemyWidth, `${archetypeId} footprint width matches metadata`);
    check(enemy.height === meta.rows * game.enemyHeight, `${archetypeId} footprint height matches metadata`);
    check(enemy.affixes.includes(meta.affix), `${archetypeId} includes exclusive affix ${meta.affix}`);
    check(enemy.collisionShape === expectedShapes[archetypeId], `${archetypeId} collision shape matches visual contract`);

    if (enemy.collisionShape === 'polygon') {
        check(Array.isArray(enemy.collisionData?.vertices) && enemy.collisionData.vertices.length >= 4, `${archetypeId} polygon has vertices`);
    } else if (enemy.collisionShape === 'arc') {
        check(typeof enemy.collisionData?.radius === 'number' && enemy.collisionData.radius > 0, `${archetypeId} arc has positive radius`);
    } else {
        check(enemy.collisionData == null, `${archetypeId} aabb has no collisionData`);
    }

    if (meta.cols >= 2) {
        check(enemy.isWideEnemy === true, `${archetypeId} wide footprint flag is set`);
    }
    if (meta.rows >= 2 || meta.cols >= 3) {
        check(typeof enemy._moveInterval === 'number' && enemy._moveInterval >= 2, `${archetypeId} slow movement interval initialized`);
    }
    if (archetypeId === 'deflector') {
        check(enemy.wardBarrierMax > 0 && enemy.wardBarrier === enemy.wardBarrierMax, 'deflector ward barrier initialized');
    }
    if (archetypeId === 'hive') {
        check(enemy._hiveCooldown === (config.balance.affixes.hiveSpawnInterval || 2), 'hive cooldown initialized');
    }
    if (archetypeId === 'carrier') {
        check(enemy._carrierCooldown === (config.balance.affixes.carrierSpawnInterval || 1), 'carrier cooldown initialized');
    }
}

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

installBrowserStubs();

const [{ spawn_system }, { combat_system }, { game_phase }, { CONFIG }, wavePresetModule, { Enemy }, { loot_calcRuneDrop }, { RUNE_DB }, visualAssetModule] = await Promise.all([
    import('../src/spawn_system.js'),
    import('../src/combat_system.js'),
    import('../src/game_phase.js'),
    import('../src/config.js'),
    import('../src/wave_presets.js'),
    import('../src/entities.js'),
    import('../src/loot_system.js'),
    import('../src/rune_config.js'),
    import('../src/data/enemy_visual_assets.js'),
]);
const {
    STATIC_FOOTPRINT_OVERLAY_AFFIXES,
    isStaticFootprintOverlayAffix,
    resolveEnemyVisualAsset,
} = visualAssetModule;
const {
    ENEMY_WAVE_PRESETS,
    ENEMY_WAVE_PRESET_ARCHETYPES,
    ENEMY_BASE_EXCLUSIVE_AFFIXES,
    normalizeEnemyAffixesForArchetype,
} = wavePresetModule;

console.log('===================================================');
console.log('  V2 large enemy runtime spawn validation');
console.log('===================================================\n');

const baseHP = CONFIG.balance.enemyBaseHp || 10;
const colWidth = 60;

{
    const expectedBossMoveIntervals = {
        ignis: 3,
        glacies: 4,
        mikro: 4,
        devourer: 3,
        viridis: 4,
        tesla: 3,
        chimera: 4,
        ouroboros: 4,
    };
    for (const [bossId, expectedInterval] of Object.entries(expectedBossMoveIntervals)) {
        const interval = CONFIG.balance.bossConfigs?.[bossId]?.moveInterval;
        check(interval === expectedInterval, `${bossId} boss moveInterval is ${expectedInterval}`);
        check(interval >= 2, `${bossId} boss moveInterval is never faster than every 2 turns`);
    }
    check(CONFIG.balance.bossConfigs.chimera.chimeraDigestInterval === 1, 'Chimera thermal devour is available every boss turn');
    check(CONFIG.balance.bossConfigs.chimera.chimeraDevourTargetsPerTurn === 2, 'Chimera thermal devour consumes two side-selected targets per boss turn');
    check(CONFIG.balance.bossConfigs.chimera.chimeraDigestShieldPerFeed === 0, 'Chimera devour does not grant flat shield outside thermal cancellation');
    check(CONFIG.balance.bossConfigs.chimera.chimeraThermalStackUnit === 1, 'Chimera thermal stacks map one-to-one from temperature');
    check(CONFIG.balance.bossConfigs.chimera.chimeraBerserkShieldMult === 2, 'Berserk Chimera doubles thermal cancellation shield output');
    check(
        CONFIG.balance.bossConfigs.chimera.chimeraLeftFeedTemp === -100
        && CONFIG.balance.bossConfigs.chimera.chimeraRightFeedTemp === 100,
        'Chimera thermal feed sides are configured as left cold and right hot'
    );

    const game = makeGame(spawn_system, CONFIG);
    globalThis.game = game;
    game.round = 40;
    game.spawn_spawnBoss('tesla', true);
    const spawnedBoss = game.enemies.find(enemy => enemy.bossType === 'tesla');
    check(!!spawnedBoss && spawnedBoss._moveInterval === expectedBossMoveIntervals.tesla, 'spawn_spawnBoss initializes configured slow boss movement interval');
    game.enemies = [];

    const cooldownBoss = new Enemy(180, 220, 180, 100, 300, 300, 'boss', []);
    cooldownBoss.type = 'boss';
    cooldownBoss.bossType = 'ignis';
    cooldownBoss.berserked = true;
    cooldownBoss._moveInterval = 3;
    cooldownBoss._moveCooldown = 2;
    cooldownBoss.executeTurnAction(game);
    check(cooldownBoss._moveCooldown === 1, 'berserk boss decrements movement cooldown instead of forcing immediate movement');

    const hasteBoss = new Enemy(180, 220, 180, 100, 300, 300, 'boss', ['haste']);
    hasteBoss.type = 'boss';
    hasteBoss.bossType = 'ignis';
    hasteBoss._moveInterval = 3;
    hasteBoss._moveCooldown = 0;
    const startY = hasteBoss.dropTargetY;
    hasteBoss.executeTurnAction(game);
    check(hasteBoss.dropTargetY === startY + game.enemyHeight, 'boss haste does not add a second movement step');
}

{
    const normalized = normalizeEnemyAffixesForArchetype('bastion', ['heavyArmor', 'haste', 'shield']);
    check(normalized.includes('heavyArmor'), 'bastion compatibility keeps heavyArmor identity');
    check(normalized.includes('shield'), 'bastion compatibility keeps compatible shield overlay');
    check(!normalized.includes('haste'), 'bastion compatibility removes haste conflict');

    const game = makeGame(spawn_system, CONFIG);
    game.round = 54;
    withRandom(() => 0, () => {
        const affixes = game.spawn_generateAffixes();
        check(
            !affixes.some(affix => ENEMY_BASE_EXCLUSIVE_AFFIXES.includes(affix)),
            'random affix generation excludes base-exclusive affixes'
        );
    });

    const noAffixElite = new Enemy(120, 120, 60, 50, 120, 120, 'elite', []);
    const noAffixAsset = resolveEnemyVisualAsset(noAffixElite);
    check(
        noAffixAsset.assetKey === 'eliteGolemAffixCombo:1x1:' && noAffixAsset.fallbackLevel === 'composite',
        '1x1 elite without affixes resolves to the elite golem no-affix body'
    );
    check(
        noAffixAsset.spritePath && noAffixAsset.spritePath.includes('enemy_elite_golem_noaffix_1x1_pass13_idle.png'),
        '1x1 elite no-affix body uses the pass13 sprite'
    );

    const shieldOnlyElite = new Enemy(120, 120, 60, 50, 120, 120, 'elite', ['shield']);
    const shieldOnlyAsset = resolveEnemyVisualAsset(shieldOnlyElite);
    check(
        shieldOnlyAsset.assetKey === 'eliteGolemAffixCombo:1x1:' && shieldOnlyAsset.fallbackLevel === 'composite',
        'overlay-only elite affixes keep the no-affix elite golem body'
    );
    check(
        shieldOnlyAsset.overlayPaths.some(item => item.affix === 'shield'),
        'shield remains a separate overlay on the no-affix elite golem body'
    );

    for (const affix of STATIC_FOOTPRINT_OVERLAY_AFFIXES) {
        check(isStaticFootprintOverlayAffix(affix), `${affix} is registered as a static footprint overlay affix`);

        const overlayOnlyElite = { type: 'elite', gridCols: 1, gridRows: 1, affixes: [affix] };
        const overlayOnlyAsset = resolveEnemyVisualAsset(overlayOnlyElite);
        check(
            overlayOnlyAsset.assetKey === 'eliteGolemAffixCombo:1x1:',
            `${affix} does not change the no-affix elite golem body key`
        );
        check(
            overlayOnlyAsset.overlayPaths.some(item => item.affix === affix),
            `${affix} remains in overlayPaths on the no-affix elite golem body`
        );

        const overlayOnHaste = { type: 'elite', gridCols: 1, gridRows: 1, affixes: ['haste', affix] };
        const overlayOnHasteAsset = resolveEnemyVisualAsset(overlayOnHaste);
        check(
            overlayOnHasteAsset.assetKey === 'eliteGolemAffixCombo:1x1:haste',
            `${affix} does not change the haste elite golem body key`
        );
        check(
            overlayOnHasteAsset.overlayPaths.some(item => item.affix === affix),
            `${affix} remains in overlayPaths on the haste elite golem body`
        );

        const overlayOnBastion = {
            type: 'elite',
            baseArchetype: 'bastion',
            gridCols: 3,
            gridRows: 1,
            affixes: ['heavyArmor', affix],
        };
        const overlayOnBastionAsset = resolveEnemyVisualAsset(overlayOnBastion);
        check(
            overlayOnBastionAsset.assetKey === 'bastion:3x1:heavyArmor',
            `${affix} does not change the bastion body key`
        );
        check(
            overlayOnBastionAsset.overlayPaths.some(item => item.affix === affix),
            `${affix} remains in overlayPaths on the bastion body`
        );
    }

    const hasted = new Enemy(120, 120, 60, 50, 120, 120, 'elite', ['haste', 'shield']);
    const hastedAsset = resolveEnemyVisualAsset(hasted);
    check(
        hastedAsset.assetKey === 'eliteGolemAffixCombo:1x1:haste' && hastedAsset.fallbackLevel === 'composite',
        'overlay affixes do not change the haste elite composite asset'
    );
    check(
        hastedAsset.overlayPaths.some(item => item.affix === 'shield'),
        'shield remains a separate overlay on haste elite composite asset'
    );

    const bastion = new Enemy(120, 120, 180, 50, 120, 120, 'elite', ['heavyArmor', 'shield']);
    bastion.baseArchetype = 'bastion';
    bastion.gridCols = 3;
    bastion.gridRows = 1;
    const bastionAsset = resolveEnemyVisualAsset(bastion);
    check(
        bastionAsset.assetKey === 'bastion:3x1:heavyArmor' && bastionAsset.fallbackLevel === 'composite',
        'overlay affixes do not change the bastion base composite asset'
    );
    check(
        bastionAsset.overlayPaths.some(item => item.affix === 'shield'),
        'shield remains a separate overlay on bastion base composite asset'
    );
}

{
    const game = makeGame(spawn_system, CONFIG);
    globalThis.game = game;

    const bearer = new Enemy(120, 120, 60, 50, 120, 120, 'elite', ['runeBearer']);
    withRandom(() => 0, () => bearer._tickRuneBearerForTurn(game));
    check(!!bearer._runeBearerTempAffix, 'runeBearer rolls one temporary affix at enemy turn start');
    check(bearer.affixes.includes(bearer._runeBearerTempAffix), 'runeBearer temporary affix is active for the turn');
    bearer._clearRuneBearerTempAffix();
    check(!bearer._runeBearerTempAffix, 'runeBearer temporary affix can be cleared cleanly');
    check(!bearer.affixes.includes('shield') && (bearer.shieldCharges || 0) === 0, 'runeBearer temporary shield layer is removed with the affix');

    const adaptive = new Enemy(160, 120, 60, 50, 120, 120, 'elite', ['adaptiveRune']);
    adaptive.takeDamage(10, { config: { pyro: 1 }, pos: adaptive.pos }, true);
    check(adaptive.adaptiveRuneElement === 'pyro', 'adaptiveRune records damage source element');
    adaptive.applyVenom(1);
    check(adaptive.adaptiveRuneElement === 'venom', 'adaptiveRune records status effect element');

    const drop = withRandom(() => 0, () => loot_calcRuneDrop(game, { forcedElement: 'venom' }));
    const rune = RUNE_DB.find(item => item.id === drop.runeId);
    check(!!rune && rune.element === 'venom', 'loot_calcRuneDrop forcedElement restricts rune family');
}

{
    const game = makeGame(spawn_system, CONFIG);
    globalThis.game = game;
    bindSystem(game, game_phase);
    let recordedVenomDamage = 0;
    game.combat_reportDamage = () => {};
    game.combat_recordDamage = (amount, attrType) => {
        if (attrType === 'venom') recordedVenomDamage += amount || 0;
    };

    const target = new Enemy(160, 160, 60, 50, 10000, 10000, 'normal', []);
    target.venomStacks = 10000;
    game.enemies = [target];

    game.phase_enemy_processTurn(target);

    const expectedVenomDamage = Math.ceil(calcExpectedVenomTick(10000));
    const linearVenomDamage = Math.ceil(10000 * CONFIG.mechanics.venom.dotPerStack);
    const legacyTriangularTier = Math.floor((-1 + Math.sqrt(1 + 8 * 10000)) / 2);
    const legacyTriangularDamage = Math.ceil(legacyTriangularTier * CONFIG.mechanics.venom.dotPerStack);
    check(expectedVenomDamage < linearVenomDamage, 'venom DoT keeps high stack damage below pure linear scaling');
    check(expectedVenomDamage > legacyTriangularDamage, 'venom DoT keeps massive stack investment above the legacy triangular tier value');
    check(target.hp === 10000 - expectedVenomDamage, 'venom DoT uses diminishing effective stacks');
    check(recordedVenomDamage === expectedVenomDamage, 'venom DoT records actual venom damage amount');
}

{
    const game = makeGame(spawn_system, CONFIG);
    globalThis.game = game;
    bindSystem(game, game_phase);
    game.activeElementResonances = {
        cryo: { params: { frozenPhysDmgBonus: 0.3 } },
    };
    let recordedVenomDamage = 0;
    game.combat_reportDamage = () => {};
    game.combat_recordDamage = (amount, attrType) => {
        if (attrType === 'venom') recordedVenomDamage += amount || 0;
    };

    const target = new Enemy(160, 160, 60, 50, 1000, 1000, 'normal', []);
    target.venomStacks = 100;
    target._wasFrozenLastTurn = true;
    target.isFrozenCurrentTurn = true;
    game.enemies = [target];

    game.phase_enemy_processTurn(target);

    const baseTick = calcExpectedVenomTick(100);
    const expectedVenomDamage = Math.ceil(baseTick + baseTick * (1 + 0.3) * (CONFIG.mechanics.venom.thawExtraTickMultiplier ?? 1));
    check(target.hp === 1000 - expectedVenomDamage, 'venom thaw burst adds one extra poison tick with cryo damage amp');
    check(recordedVenomDamage === expectedVenomDamage, 'venom thaw burst records as venom damage');
    check(target.isFrozenCurrentTurn === false && target._wasFrozenLastTurn === false, 'thaw start clears frozen turn markers before enemy action gate');
    check(game.particles.some(p => p.mode === 'spark' && p.color === '#67e8f9') && game.floatingTexts.some(t => String(t.text).includes('解冻')), 'thaw start plays visible thaw feedback before venom burst');
}

{
    const game = makeGame(spawn_system, CONFIG);
    globalThis.game = game;
    bindSystem(game, combat_system);
    let recordedVenomDamage = 0;
    game.combat_recordDamage = (amount, attrType) => {
        if (attrType === 'venom') recordedVenomDamage += amount || 0;
    };

    const target = new Enemy(160, 160, 60, 50, 1000, 1000, 'normal', []);
    target.venomStacks = 10;
    game.enemies = [target];

    const lightningShot = {
        pos: { x: target.pos.x, y: target.pos.y },
        config: { damage: 10, lightning: 1, cryo: 0, pyro: 0, bounce: 0, pierce: 0, scatter: 0, multicast: 0, wind: 0, venom: 0, type: 'test' },
        chainHistory: [],
        isCopy: false,
        bouncesLeft: 0,
        piercesLeft: 0,
        shotId: 'lightning_venom_direct',
    };
    withRandom(() => 0.99, () => game.combat_damageEnemy(target, lightningShot));

    const expectedProc = Math.ceil(calcExpectedVenomTick(10) * (CONFIG.mechanics.venom.lightningProcRatio ?? 0.35));
    check(recordedVenomDamage === expectedProc, 'lightning hit immediately triggers configured partial venom tick');
    check(target.hp === 1000 - 10 - expectedProc, 'lightning venom proc stacks on top of direct lightning hit damage');

    const hpAfterProc = target.hp;
    const repeat = game.combat_lightningVenom_trigger(target, 'lightning_venom_direct', 0);
    check(repeat && repeat.triggered === false && target.hp === hpAfterProc, 'same shot cannot trigger lightning venom twice on one target');
}

{
    const game = makeGame(spawn_system, CONFIG);
    globalThis.game = game;
    bindSystem(game, combat_system);
    let recordedVenomDamage = 0;
    game.combat_recordDamage = (amount, attrType) => {
        if (attrType === 'venom') recordedVenomDamage += amount || 0;
    };

    const source = new Enemy(80, 160, 60, 50, 1000, 1000, 'normal', []);
    source.active = false;
    const target = new Enemy(150, 160, 60, 50, 1000, 1000, 'normal', []);
    target.venomStacks = 30;
    game.enemies = [source, target];

    const triggered = withImmediateTimers(() => withRandom(() => 0, () =>
        game.combat_lightning_triggerChain(source, 20, [], 1, 'lightning_venom_chain', 1.0)
    ));

    const expectedRatio = Math.max(
        CONFIG.mechanics.venom.lightningProcMinRatio ?? 0.20,
        (CONFIG.mechanics.venom.lightningProcRatio ?? 0.35) * (CONFIG.mechanics.venom.lightningProcChainFalloff ?? 0.85)
    );
    const expectedProc = Math.ceil(calcExpectedVenomTick(30) * expectedRatio);
    check(triggered === true, 'forced lightning chain can trigger from test source');
    check(recordedVenomDamage === expectedProc, 'lightning chain venom proc uses depth falloff ratio');
    check(target.hp === 1000 - 20 - expectedProc, 'lightning chain damage and venom proc both apply to chained target');
}

{
    const game = makeGame(spawn_system, CONFIG);
    globalThis.game = game;
    bindSystem(game, combat_system);

    const source = new Enemy(120, 160, 60, 50, 100, 100, 'normal', []);
    source.temp = 120;
    source.venomStacks = 11;
    source.active = false;
    const nearA = new Enemy(150, 160, 60, 50, 1000, 1000, 'normal', []);
    const nearB = new Enemy(190, 160, 60, 50, 1000, 1000, 'normal', []);
    const far = new Enemy(320, 160, 60, 50, 1000, 1000, 'normal', []);
    game.enemies = [source, nearA, nearB, far];

    game._triggerDeathFX(source, null);

    check((nearA.venomStacks || 0) === 6 && (nearB.venomStacks || 0) === 5, 'burning death explosion evenly distributes dead enemy venom stacks');
    check((far.venomStacks || 0) === 0, 'burning death venom spread respects fire spread radius');
}

{
    const game = makeGame(spawn_system, CONFIG);
    globalThis.game = game;
    bindSystem(game, combat_system);
    game.ownedRelics = ['ember_fuse'];

    const source = new Enemy(120, 160, 60, 50, 10000, 10000, 'normal', []);
    source.temp = 320;
    source.venomStacks = 100;
    const nearA = new Enemy(150, 160, 60, 50, 10000, 10000, 'normal', []);
    const nearB = new Enemy(190, 160, 60, 50, 10000, 10000, 'normal', []);
    const far = new Enemy(320, 160, 60, 50, 10000, 10000, 'normal', []);
    game.enemies = [source, nearA, nearB, far];

    const pyroShot = {
        pos: { x: source.pos.x, y: source.pos.y },
        config: { damage: 1, lightning: 0, cryo: 0, pyro: 8, bounce: 0, pierce: 0, scatter: 0, multicast: 0, wind: 0, venom: 0, type: 'test' },
        chainHistory: [],
        isCopy: false,
        bouncesLeft: 0,
        piercesLeft: 0,
    };
    withRandom(() => 0, () => game.combat_damageEnemy(source, pyroShot));

    const expectedSpread = Math.floor(100 * (CONFIG.mechanics.venom.pyroExplosionSpreadRatio ?? CONFIG.mechanics.pyro.heatConsumptionRate));
    const spreadTotal = (nearA.venomStacks || 0) + (nearB.venomStacks || 0);
    check(spreadTotal === expectedSpread, 'ember_fuse explosion spreads the configured ratio of source venom stacks');
    check(Math.abs((nearA.venomStacks || 0) - (nearB.venomStacks || 0)) <= 1, 'ember_fuse venom spread is evenly distributed across explosion targets');
    check((far.venomStacks || 0) === 0, 'ember_fuse venom spread respects explosion radius');
}

withRandom(() => 0, () => {
    const game = makeGame(spawn_system, CONFIG);
    game.round = 12;
    const ok = game.spawn_trySpawnWavePreset(100, baseHP, Array(CONFIG.gameplay.enemyCols).fill(false), colWidth);
    check(ok, 'forced preset path spawns at round 12');
    check(game.enemies.some(enemy => enemy.baseArchetype), 'forced preset includes at least one large archetype');
    check(!!game._directorScriptUsage.ward_filter, 'successful preset records director script usage');
    check(game._directorScriptUsage.ward_filter.lastBeatId === 'intro', 'director script usage records beat id');
    check(game._directorLastScriptId === 'ward_filter', 'director remembers last script id');
    assertLargeLimits(game);
    assertNoOverlap(game);
    assertGridDimensions(game);
});

withRandom(() => 0, () => {
    const game = makeGame(spawn_system, CONFIG);
    game.round = 12;
    game._directorScriptUsage = {
        ward_filter: { count: 1, lastRound: 11, lastPresetId: 'teach_deflection_ward', lastBeatId: 'intro' },
    };
    const preset = game.spawn_pickWavePreset({ directorProfile: { dominanceLevel: 3, emptyBoard: true, topPinned: true, overkill: true } });
    check(!!preset, 'director still finds a preset when recent script is cooling down');
    check(preset.scriptId !== 'ward_filter', 'director avoids repeating a cooling script');
});

{
    const game = makeGame(spawn_system, CONFIG);
    game.round = 6;
    game.roundDamage = 160;
    game.enemies.push(
        { active: true, pos: { x: 30, y: 100 }, width: 60, height: 50, hp: 10, maxHp: 20 },
        { active: true, pos: { x: 90, y: 105 }, width: 60, height: 50, hp: 8, maxHp: 20 },
    );
    const profile = game.spawn_getDirectorPressureProfile();
    check(profile.topPinned === true, 'director profile detects top-pinned enemies');
    check(profile.overkill === true, 'director profile detects recent damage overkill');
    check(profile.dominanceLevel >= 2, 'director profile escalates dominance level');

    const earlyPreset = ENEMY_WAVE_PRESETS.find(preset => preset.id === 'early_bastion_brace');
    check(!!earlyPreset, 'early bastion pressure preset is registered');
    check(
        game.spawn_scoreWavePresetForDirector(earlyPreset, profile) > 0,
        'director pressure profile boosts anti-compression preset weight'
    );
}

{
    const game = makeGame(spawn_system, CONFIG);
    globalThis.game = game;

    const boss = new Enemy(120, 120, 180, 100, 1000, 1000, 'boss', ['radiantAegis']);
    boss.type = 'boss';
    boss._initRadiantAegis();
    check(boss.radiantAegisMax === 100, 'radiantAegis boss cap is 10% max HP');

    const elite = new Enemy(60, 120, 60, 50, 1000, 1000, 'elite', ['radiantAegis']);
    elite._initRadiantAegis();
    check(elite.radiantAegisMax === 50, 'radiantAegis elite cap is half strength at 5% max HP');

    const neighbor = new Enemy(230, 120, 60, 50, 100, 100, 'normal', []);
    const far = new Enemy(420, 120, 60, 50, 100, 100, 'normal', []);
    game.enemies = [boss, neighbor, far];
    boss._tickRadiantAegis(game);
    check(neighbor.shieldCharges === 1 && neighbor.affixes.includes('shield'), 'radiantAegis full boss grants one shield layer to adjacent enemy');
    check((neighbor._shieldAssimilationTimer || 0) > 0 && neighbor._shieldAssimilationFromX < 0, 'radiantAegis shield grant plays a source-facing shield assimilation effect on target');
    check(!neighbor._defenseImpactFx?.radiantAegis, 'radiantAegis shield grant does not masquerade as target-side radiant block feedback');
    check((far.shieldCharges || 0) === 0, 'radiantAegis does not shield enemies beyond one grid');

    boss.takeDamage(boss.radiantAegis);
    check(boss.radiantAegisBroken === true && boss.radiantAegis === 0, 'radiantAegis breaks when its numeric shield is depleted');
    const before = neighbor.shieldCharges;
    boss._tickRadiantAegis(game);
    check(neighbor.shieldCharges === before, 'broken radiantAegis no longer spreads shield layers');
}

{
    const game = makeGame(spawn_system, CONFIG);
    globalThis.game = game;
    for (const [key, value] of Object.entries(game_phase)) {
        if (typeof value === 'function') game[key] = value.bind(game);
    }

    const ignis = new Enemy(160, 160, 180, 100, 1000, 1000, 'boss', ['radiantAegis']);
    ignis.bossType = 'ignis';
    ignis.bossName = CONFIG.balance.bossConfigs.ignis.name;
    ignis.temp = 160;
    ignis.radiantAegisBroken = true;
    ignis.startTurnAction = () => {};
    game.enemies = [ignis];

    game.phase_enemy_processTurn(ignis);

    check(ignis.hp === 1000, 'Ignis overheat settlement does not deal burn damage');
    check((ignis.furnacePressureThreshold || 0) === CONFIG.balance.bossConfigs.ignis.furnacePressureThreshold, 'Ignis stores furnace pressure threshold');
    check((ignis.furnacePressure || 0) > 0, 'Ignis overheat overflow converts into furnace pressure');
    check(!ignis.radiantAegisBroken && (ignis.radiantAegis || 0) > 0, 'Ignis furnace pressure re-triggers radiant aegis pulse');
    check(ignis.temp < 100, 'Ignis overheat settlement vents temperature below burn threshold');
}

{
    const game = makeGame(spawn_system, CONFIG);
    globalThis.game = game;
    game.round = 12;
    const boss = new Enemy(180, 120, 180, 100, 1000, 1000, 'boss', ['jump', 'regen']);
    boss.bossType = 'glacies';
    boss.isBigBoss = false;
    const target = new Enemy(180, 220, 60, 50, 120, 120, 'normal', []);
    game.enemies = [boss, target];

    withImmediateTimers(() => withRandom(() => 0, () => {
        game.spawn_triggerBossEntranceShockwave(boss);
    }));

    check(target.type === 'elite', 'Glacies entrance converts ordinary enemy into frost stitch elite');
    check(target.bossOwnerId === 'glacies' && target.bossMinionRole === 'frost_stitch', 'Glacies entrance frost stitch stores boss metadata');
    check(target.bossMechanicTags.includes('frostStitch'), 'Glacies entrance frost stitch stores frostStitch tag');
    check(target.affixes.includes('regen') && target.affixes.includes('jump'), 'Glacies frost stitch receives regen+jump profile affixes');
}

{
    const game = makeGame(spawn_system, CONFIG);
    globalThis.game = game;
    const boss = new Enemy(180, 200, 180, 100, 1000, 1000, 'boss', ['jump', 'regen']);
    boss.bossType = 'glacies';
    const stitch = new Enemy(180, 250, 60, 50, 80, 120, 'elite', ['regen', 'jump']);
    stitch.bossOwnerId = 'glacies';
    stitch.bossMechanicTags = ['frostStitch'];
    const far = new Enemy(420, 250, 60, 50, 120, 120, 'normal', []);
    game.enemies = [boss, stitch, far];

    const pulse = boss._tickGlaciesFrostSeams(game);
    check(pulse.linked === 1, 'Glacies frost seam prioritizes frostStitch target');
    check((stitch.frostSeamTurns || 0) > 0 && stitch.bossMechanicTags.includes('frostSeam'), 'Glacies frost seam marks target with duration and tag');
    check(stitch.affixes.includes('shield') && (stitch.shieldCharges || 0) >= 1, 'Glacies frost seam grants an initial shield layer');
    check((far.frostSeamTurns || 0) === 0, 'Glacies frost seam ignores enemies outside +2 grid range');

    const beforeHeal = stitch.hp;
    const beforeTurns = stitch.frostSeamTurns;
    stitch._tickGlaciesFrostSeamForTurn(game);
    check(stitch.hp > beforeHeal && stitch.frostSeamTurns === beforeTurns - 1, 'Glacies frost seam heals and ticks down on enemy turn start');
}

{
    const game = makeGame(spawn_system, CONFIG);
    globalThis.game = game;
    const boss = new Enemy(180, 200, 180, 100, 1000, 1000, 'boss', ['jump', 'regen']);
    boss.bossType = 'glacies';
    const target = new Enemy(180, 250, 60, 50, 100, 100, 'normal', []);
    game.enemies = [boss, target];

    boss._applyGlaciesFrostSeam(game, target);
    target.affixes = target.affixes.filter(affix => affix !== 'shield');
    target.shieldCharges = 0;
    const normalHit = target.takeDamage(20, { config: { damage: 20, cryo: 0, pierce: 0, bounce: 0 }, pos: { x: target.pos.x, y: target.pos.y } });
    check(normalHit.actualDamage < 20 && normalHit.actualDamage > 10, 'Glacies frost seam reduces non-counter damage');
    check((target.frostSeamTurns || 0) > 0, 'non-counter damage does not break Glacies frost seam');

    target.hp = target.maxHp;
    boss._applyGlaciesFrostSeam(game, target);
    target.affixes = target.affixes.filter(affix => affix !== 'shield');
    target.shieldCharges = 0;
    const pierceHit = target.takeDamage(20, { config: { damage: 20, cryo: 0, pierce: 1, bounce: 0 }, pos: { x: target.pos.x, y: target.pos.y } });
    check((target.frostSeamTurns || 0) === 0, 'pierce hit cuts Glacies frost seam');
    check(pierceHit.actualDamage > 20, 'pierce cut gains bonus damage through frost seam');

    boss._applyGlaciesFrostSeam(game, target);
    target.affixes = target.affixes.filter(affix => affix !== 'shield');
    target.shieldCharges = 0;
    target.takeDamage(10, { config: { damage: 10, cryo: 1, pierce: 0, bounce: 0 }, pos: { x: target.pos.x, y: target.pos.y } });
    check((target.frostSeamTurns || 0) === 0 && (boss._glaciesSeamSkipTurns || 0) > 0, 'cryo hit freezes Glacies next frost seam tick');
    const skipped = boss._tickGlaciesFrostSeams(game);
    check(skipped.skipped === true && (target.frostSeamTurns || 0) === 0, 'frozen Glacies seam tick skips without re-linking target');
}

{
    const game = makeGame(spawn_system, CONFIG);
    globalThis.game = game;
    const boss = new Enemy(180, 200, 180, 100, 1000, 1000, 'boss', ['jump', 'regen']);
    boss.bossType = 'glacies';
    const target = new Enemy(180, 250, 60, 50, 100, 100, 'normal', []);
    game.enemies = [boss, target];
    game.pegs = [{ pos: { x: 180, y: 200 }, frozenTurns: 0 }];

    boss._glaciesPulseFrostSeamsOnLanding(game);
    check((target.frostSeamTurns || 0) > 0, 'Glacies landing pulse applies battlefield frost seam');
    check(game.pegs.every(peg => (peg.frozenTurns || 0) === 0), 'Glacies landing pulse does not freeze or modify pegs');
}

{
    const game = makeGame(spawn_system, CONFIG);
    globalThis.game = game;
    for (const [key, value] of Object.entries(combat_system)) {
        if (typeof value === 'function') game[key] = value.bind(game);
    }
    const boss = new Enemy(180, 200, 180, 100, 1000, 1000, 'boss', ['jump', 'regen']);
    boss.bossType = 'glacies';
    game.enemies = [boss];

    game.combat_triggerBossEnrage(boss);
    check(boss.berserked && boss._berserkedJumpRows === CONFIG.balance.bossConfigs.glacies.berserkedJumpRows, 'Glacies enrage still upgrades jump rows');
    check(boss._glaciesBerserkSeamBoost === true, 'Glacies enrage records frost seam boost');
    check(boss._berserkedFreezePegs !== true, 'Glacies enrage no longer enables peg freeze flag');
}

{
    const game = makeGame(spawn_system, CONFIG);
    globalThis.game = game;
    game.round = 19;
    const boss = new Enemy(180, 120, 180, 100, 1000, 1000, 'boss', ['clone', 'healer']);
    boss.bossType = 'mikro';
    boss.isBigBoss = false;
    const target = new Enemy(180, 220, 60, 50, 120, 120, 'normal', []);
    game.enemies = [boss, target];

    withImmediateTimers(() => withRandom(() => 0, () => {
        game.spawn_triggerBossEntranceShockwave(boss);
    }));

    check(target.type === 'elite', 'Mikro entrance converts ordinary enemy into elite fission cell');
    check(target.bossOwnerId === 'mikro' && target.bossMinionRole === 'fission_cell', 'Mikro entrance fission cell stores boss metadata');
    check(target.bossMechanicTags.includes('fissionLink'), 'Mikro entrance fission cell stores fissionLink tag');
    check(target.affixes.includes('clone') && target.affixes.includes('healer'), 'Mikro fission cell receives clone+healer profile affixes');

    boss.hp = boss.maxHp;
    const hit = boss.takeDamage(100, { config: { damage: 100, pierce: 0, cryo: 0, bounce: 0 }, pos: { x: boss.pos.x, y: boss.pos.y } });
    check(hit.actualDamage < 100 && boss.hp > 900, 'Mikro fissionLink minion contributes to mother damage reduction');
}

{
    const game = makeGame(spawn_system, CONFIG);
    globalThis.game = game;
    game.round = 26;
    const boss = new Enemy(180, 120, 180, 100, 1000, 1000, 'boss', ['devour', 'shield']);
    boss.bossType = 'devourer';
    boss.isBigBoss = false;
    const target = new Enemy(180, 220, 60, 50, 120, 120, 'normal', []);
    game.enemies = [boss, target];

    withImmediateTimers(() => withRandom(() => 0, () => {
        game.spawn_triggerBossEntranceShockwave(boss);
    }));

    check(target.type === 'elite', 'Devourer entrance converts ordinary enemy into elite maw thrall');
    check(target.bossOwnerId === 'devourer' && target.bossMinionRole === 'maw_thrall', 'Devourer entrance maw thrall stores boss metadata');
    check(target.bossMechanicTags.includes('mawFeed'), 'Devourer entrance maw thrall stores mawFeed tag');
    check(target.affixes.includes('devour') && target.affixes.includes('shield'), 'Devourer maw thrall receives devour+shield profile affixes');

    const ordinary = new Enemy(120, 220, 60, 50, 120, 120, 'normal', []);
    const far = new Enemy(999, 220, 60, 50, 120, 120, 'normal', []);
    game.enemies = [boss, ordinary, target, far];
    const shieldBefore = boss.shieldCharges || 0;
    boss.telegraphIntent = { key: 'devourer_maw' };
    boss.actionName = '深渊吞噬';
    withRandom(() => 0.99, () => boss.executeTurnAction(game));
    check(!target.active && !ordinary.active && far.active, 'Devourer maw devours every prey in the maw field and leaves outside prey alone');
    check((boss.shieldCharges || 0) > shieldBefore, 'Devourer maw converts consumed prey into shield layers');
}

{
    const game = makeGame(spawn_system, CONFIG);
    globalThis.game = game;
    game.round = 20;
    const boss = new Enemy(180, 120, 180, 100, 1000, 1000, 'boss', []);
    boss.bossType = 'ignis';
    boss.isBigBoss = false;
    const target = new Enemy(180, 180, 60, 50, 120, 120, 'normal', []);
    game.enemies = [boss, target];

    withImmediateTimers(() => withRandom(() => 0, () => {
        game.spawn_triggerBossEntranceShockwave(boss);
    }));

    check(target.type === 'elite', 'Boss entrance converts ordinary enemy into elite minion');
    check(target.bossOwnerId === 'ignis', 'Boss entrance minion stores bossOwnerId');
    check(target.bossMinionRole === 'furnace_guard', 'Ignis entrance minion stores furnace_guard role');
    check(target.bossMechanicTags.includes('furnacePressure') && target.bossMechanicTags.includes('radiantAegis'), 'Ignis entrance minion stores mechanic tags');
    check(target.affixes.includes('shield') && target.affixes.includes('radiantAegis'), 'Ignis entrance minion receives profile affixes');
}

{
    const game = makeGame(spawn_system, CONFIG);
    globalThis.game = game;
    game.round = 33;
    const boss = new Enemy(180, 120, 180, 100, 1000, 1000, 'boss', ['regen', 'healer', 'livingArmor', 'armorSpore']);
    boss.bossType = 'viridis';
    boss.isBigBoss = true;
    const target = new Enemy(180, 220, 60, 50, 120, 120, 'normal', []);
    game.enemies = [boss, target];

    withImmediateTimers(() => withRandom(() => 0, () => {
        game.spawn_triggerBossEntranceShockwave(boss);
    }));

    check(target.type === 'elite', 'Viridis entrance converts ordinary enemy into elite spore vassal');
    check(target.bossOwnerId === 'viridis' && target.bossMinionRole === 'spore_vassal', 'Viridis entrance vassal stores boss metadata');
    check(target.bossMechanicTags.includes('sporeArmor'), 'Viridis entrance vassal stores sporeArmor tag');
    check(target.affixes.includes('armorSpore'), 'Viridis entrance vassal receives armorSpore profile affix');
}

{
    const game = makeGame(spawn_system, CONFIG);
    globalThis.game = game;
    const cfg = CONFIG.balance.bossConfigs.viridis;
    const boss = new Enemy(180, 160, 180, 100, 1000, 1000, 'boss', ['regen', 'healer', 'livingArmor', 'armorSpore']);
    boss.bossType = 'viridis';
    boss.viridisSporeBloom = cfg.sporeArmorThreshold;
    const vassal = new Enemy(180, 250, 60, 50, 120, 120, 'elite', ['regen', 'healer', 'armorSpore']);
    vassal.bossOwnerId = 'viridis';
    vassal.bossMechanicTags = ['sporeArmor'];
    vassal._grantLivingArmor(100);
    vassal.livingArmorHp = 1;
    game.enemies = [boss, vassal];

    const result = boss._tickViridisSporeArmor(game);
    check(result.granted > 0, 'Viridis spore bloom grants living armor when threshold is reached');
    check(vassal.livingArmorHp > 1 && vassal.bossMechanicTags.includes('sporeArmor'), 'Viridis spore armor refreshes marked vassal armor');
    check((boss.viridisSporeBloom || 0) < cfg.sporeArmorThreshold, 'Viridis spore armor spends bloom resource');
}

{
    const game = makeGame(spawn_system, CONFIG);
    globalThis.game = game;
    const boss = new Enemy(180, 160, 180, 100, 1000, 1000, 'boss', ['regen', 'healer', 'livingArmor', 'armorSpore']);
    boss.bossType = 'viridis';
    boss.viridisSporeBloom = 8;
    const vassal = new Enemy(180, 250, 60, 50, 120, 120, 'elite', ['armorSpore']);
    vassal.bossOwnerId = 'viridis';
    vassal.bossMechanicTags = ['sporeArmor'];
    vassal._grantLivingArmor(500);
    vassal.livingArmorHp = 5;
    game.enemies = [boss, vassal];

    vassal.takeDamage(10, { config: { damage: 10, pyro: 1, venom: 1, pierce: 0, bounce: 0 }, pos: { x: vassal.pos.x, y: vassal.pos.y } });
    check(vassal.livingArmorBroken && (vassal._viridisSporeCorrodedTurns || 0) > 0, 'pyro/venom hit corrodes and breaks Viridis spore armor');
    check((boss.viridisSporeBloom || 0) < 8, 'pyro/venom hit drains Viridis spore bloom');
    check((vassal.venomStacks || 0) > 0, 'venom counter leaves venom stacks on spore armor carrier');
}

{
    const game = makeGame(spawn_system, CONFIG);
    globalThis.game = game;
    const boss = new Enemy(180, 160, 180, 100, 1000, 1000, 'boss', ['regen', 'healer', 'livingArmor', 'armorSpore']);
    boss.bossType = 'viridis';
    const vassal = new Enemy(180, 250, 60, 50, 120, 120, 'elite', ['armorSpore']);
    vassal.bossOwnerId = 'viridis';
    vassal.bossMechanicTags = ['sporeArmor'];
    vassal._grantLivingArmor(100);
    vassal.livingArmorHp = 2;
    game.enemies = [boss, vassal];

    vassal.takeDamage(5, { config: { damage: 5, pyro: 0, venom: 0, pierce: 0, bounce: 1 }, bouncesLeft: 0, pos: { x: vassal.pos.x, y: vassal.pos.y } });
    check((boss.viridisSporeBloom || 0) > 0, 'non-counter living armor break feeds Viridis spore bloom');
}

{
    const game = makeGame(spawn_system, CONFIG);
    globalThis.game = game;
    game.round = 40;
    const boss = new Enemy(180, 120, 180, 100, 1000, 1000, 'boss', ['haste', 'clone']);
    boss.bossType = 'tesla';
    boss.isBigBoss = true;
    const target = new Enemy(180, 220, 60, 50, 120, 120, 'normal', []);
    game.enemies = [boss, target];

    withImmediateTimers(() => withRandom(() => 0, () => {
        game.spawn_triggerBossEntranceShockwave(boss);
    }));

    check(target.type === 'elite', 'Tesla entrance converts ordinary enemy into elite conductor');
    check(target.bossOwnerId === 'tesla' && target.bossMinionRole === 'conductor', 'Tesla entrance conductor stores boss metadata');
    check(target.bossMechanicTags.includes('teslaConductor'), 'Tesla entrance conductor stores teslaConductor tag');
    check(target.affixes.includes('clone') && !target.affixes.includes('haste'), 'Tesla entrance conductor starts as clone until charged');
}

{
    const game = makeGame(spawn_system, CONFIG);
    globalThis.game = game;
    const boss = new Enemy(180, 120, 180, 100, 1000, 1000, 'boss', ['haste', 'clone']);
    boss.bossType = 'tesla';
    boss.teslaFieldPowerMax = CONFIG.balance.bossConfigs.tesla.teslaFieldPowerMax;
    boss.teslaFieldPower = CONFIG.balance.bossConfigs.tesla.teslaFieldPowerMax;
    boss._teslaSummonCharge = CONFIG.balance.bossConfigs.tesla.teslaSummonThreshold;
    const target = new Enemy(60, 240, 60, 50, 120, 120, 'normal', []);
    game.enemies = [boss, target];

    withRandom(() => 0, () => {
        boss._tickTeslaNetwork(game);
    });

    const conductors = game.enemies.filter(enemy => enemy.bossOwnerId === 'tesla');
    check(target.affixes.includes('haste') && target.bossMechanicTags.includes('teslaConductor'), 'Tesla turn shock converts a random enemy into charged conductor');
    check((boss.teslaFieldPower || 0) > 0, 'Tesla conductor network keeps boss field power charged');
    check(conductors.length >= 2, 'Tesla field charge summons additional conductor');
    assertNoOverlap(game);
}

{
    const game = makeGame(spawn_system, CONFIG);
    globalThis.game = game;
    for (const [key, value] of Object.entries(combat_system)) {
        if (typeof value === 'function') game[key] = value.bind(game);
    }
    const boss = new Enemy(180, 120, 180, 100, 1000, 1000, 'boss', ['haste', 'clone']);
    boss.bossType = 'tesla';
    boss.teslaFieldPowerMax = CONFIG.balance.bossConfigs.tesla.teslaFieldPowerMax;
    const conductor = new Enemy(60, 220, 60, 50, 120, 120, 'elite', ['clone']);
    conductor.bossOwnerId = 'tesla';
    conductor.bossMechanicTags = ['teslaConductor'];
    game.enemies = [boss, conductor];

    const lightningShot = {
        pos: { x: conductor.pos.x, y: conductor.pos.y },
        config: { damage: 5, lightning: 1, cryo: 0, pyro: 0, bounce: 0, pierce: 0, scatter: 0, multicast: 0, wind: 0, type: 'test' },
        chainHistory: [],
        isCopy: false,
        bouncesLeft: 0,
        piercesLeft: 0,
    };
    withRandom(() => 0.99, () => game.combat_damageEnemy(conductor, lightningShot));
    check(conductor.affixes.includes('haste') && (conductor._teslaChargedTurns || 0) > 0, 'lightning damage grants haste to Tesla conductor');
    check((boss.teslaFieldPower || 0) > 0, 'lightning-charged conductor feeds Tesla field power');

    const fieldBeforeCryo = boss.teslaFieldPower;
    const cryoShot = {
        pos: { x: boss.pos.x, y: boss.pos.y },
        config: { damage: 5, lightning: 0, cryo: 1, pyro: 0, bounce: 0, pierce: 0, scatter: 0, multicast: 0, wind: 0, type: 'test' },
        chainHistory: [],
        isCopy: false,
        bouncesLeft: 0,
        piercesLeft: 0,
    };
    withRandom(() => 0.99, () => game.combat_damageEnemy(boss, cryoShot));
    check((boss.teslaFieldPower || 0) < fieldBeforeCryo, 'cryo hit drains Tesla field power');

    boss.teslaFieldPower = 20;
    const bounceShot = {
        pos: { x: boss.pos.x, y: boss.pos.y },
        config: { damage: 5, lightning: 0, cryo: 0, pyro: 0, bounce: 1, pierce: 0, scatter: 0, multicast: 0, wind: 0, type: 'test' },
        chainHistory: [],
        isCopy: false,
        bouncesLeft: 0,
        piercesLeft: 0,
    };
    withRandom(() => 0.99, () => game.combat_damageEnemy(boss, bounceShot));
    check((boss.teslaFieldPower || 0) < 20 && (boss._teslaGroundedTurns || 0) > 0, 'bounce hit grounds Tesla and drains field power');
}

{
    const game = makeGame(spawn_system, CONFIG);
    globalThis.game = game;
    game.round = 40;
    const boss = new Enemy(210, 200, 180, 100, 1000, 1000, 'boss', ['berserk', 'devour']);
    boss.bossType = 'chimera';
    boss.isBigBoss = true;
    const target = new Enemy(210, 300, 60, 50, 120, 120, 'normal', []);
    game.enemies = [boss, target];

    withImmediateTimers(() => withRandom(() => 0, () => {
        game.spawn_triggerBossEntranceShockwave(boss);
    }));

    check(target.type === 'elite', 'Chimera entrance converts ordinary enemy into elite chaos feed');
    check(target.bossOwnerId === 'chimera' && target.bossMinionRole === 'chaos_feed', 'Chimera entrance feed stores boss metadata');
    check(target.bossMechanicTags.includes('chaosFeed'), 'Chimera entrance feed stores chaosFeed tag');
    check(!target.affixes.includes('berserk') && !target.affixes.includes('devour'), 'Chimera entrance feed no longer receives berserk or self-devour affixes');
}

{
    const game = makeGame(spawn_system, CONFIG);
    globalThis.game = game;
    const boss = new Enemy(210, 200, 180, 100, 900, 1000, 'boss', ['devour', 'shield']);
    boss.bossType = 'devourer';
    const target = new Enemy(30, 200, 60, 50, 120, 120, 'normal', []);
    game.enemies = [boss, target];

    const pulled = boss._devourerAttractPrey(game);
    check(pulled === 1, 'Devourer maw attracts prey in +2 grid range');
    check(target.pos.x === 90 && target.dropTargetY === 200, 'Devourer pull moves prey exactly one legal grid cell');
    assertNoOverlap(game);
}

{
    const game = makeGame(spawn_system, CONFIG);
    globalThis.game = game;
    const boss = new Enemy(210, 200, 180, 100, 900, 1000, 'boss', ['berserk', 'devour']);
    boss.bossType = 'chimera';
    const leftCold = new Enemy(90, 200, 60, 50, 100, 100, 'normal', []);
    leftCold.temp = -100;
    leftCold.venomStacks = 2;
    leftCold.swordMarks = 1;
    leftCold.markTimer = 7;
    leftCold.frozenCount = 2;
    const leftHot = new Enemy(150, 200, 60, 50, 100, 100, 'normal', []);
    leftHot.temp = 100;
    const rightHot = new Enemy(330, 200, 60, 50, 100, 100, 'elite', ['shield']);
    rightHot.temp = 100;
    rightHot.isFrozenCurrentTurn = true;
    rightHot._irradiationStacks = 3;
    rightHot.phaseShieldDisabledThisTurn = true;
    rightHot.shieldCharges = 1;
    const rightCold = new Enemy(390, 200, 60, 50, 100, 100, 'elite', []);
    rightCold.temp = -100;
    game.enemies = [boss, leftCold, leftHot, rightHot, rightCold];

    const devoured = withRandom(() => 0, () => boss._chimeraDevourTargets(game, { force: true }));
    check(devoured === 2, 'Chimera thermal devour consumes two side-selected enemies');
    check(!leftCold.active && leftHot.active, 'Chimera left-side devour prefers a low-temperature target');
    check(!rightHot.active && rightCold.active, 'Chimera right-side devour prefers a high-temperature target');
    check((boss.chimeraHeatStacks || 0) === 0 && (boss.chimeraFrostStacks || 0) === 0, 'Chimera heat and frost stacks cancel each other');
    check((boss.chimeraRadiantConversions || 0) === 100 && (boss.radiantAegis || 0) === 100, 'Chimera 100 heat plus 100 frost converts into 100 radiant shield');
    check(boss.affixes.includes('radiantAegis') && (boss.shieldCharges || 0) === 0, 'Chimera thermal cancellation uses radiant aegis instead of ordinary shield layers');
    check((boss.venomStacks || 0) === 0 && (boss.frozenCount || 0) === 0, 'Chimera no longer inherits non-temperature negative states');
    check((boss.chimeraFeedStacks || 0) === 2, 'Chimera records both side devours without devour-time feeder summons');
}

{
    const game = makeGame(spawn_system, CONFIG);
    globalThis.game = game;
    const boss = new Enemy(210, 200, 180, 100, 900, 1000, 'boss', ['berserk', 'devour']);
    boss.bossType = 'chimera';
    boss.berserked = true;
    boss.chimeraHeatStacks = 100;
    const prey = new Enemy(30, 200, 60, 50, 100, 100, 'normal', []);
    prey.temp = -100;
    game.enemies = [boss, prey];

    withRandom(() => 0, () => boss._chimeraDevourTargets(game, { force: true, count: 1 }));
    check((boss.chimeraRadiantConversions || 0) === 200 && (boss.radiantAegis || 0) === 200, 'Berserk Chimera doubles matched thermal cancellation into radiant shield');
}

{
    const game = makeGame(spawn_system, CONFIG);
    globalThis.game = game;
    const boss = new Enemy(210, 200, 180, 100, 900, 1000, 'boss', ['devour']);
    boss.bossType = 'chimera';
    boss.chimeraFrostStacks = 100;
    const ordinary = new Enemy(30, 200, 60, 50, 100, 100, 'normal', []);
    const feeder = new Enemy(330, 200, 60, 50, 100, 100, 'elite', []);
    feeder.temp = 100;
    feeder.bossOwnerId = 'chimera';
    feeder.bossMinionRole = 'chaos_feed';
    feeder.bossMechanicTags = ['chaosFeed', 'thermalFeed'];
    game.enemies = [boss, ordinary, feeder];

    const devoured = withRandom(() => 0, () => boss._chimeraDevourTargets(game, { force: true, count: 1 }));
    check(devoured === 1 && ordinary.active && !feeder.active, 'Chimera prioritizes thermal feed prey over ordinary enemies');
    check((boss.radiantAegis || 0) === 100, 'Priority thermal feed devour converts matched cores into radiant shield');
}

{
    const game = makeGame(spawn_system, CONFIG);
    globalThis.game = game;
    const boss = new Enemy(210, 200, 180, 100, 1000, 1000, 'boss', ['berserk', 'devour']);
    boss.bossType = 'chimera';
    game.enemies = [boss];

    const spawned = boss._chimeraSpawnFeeders(game, 2);
    const feeders = game.enemies.filter(enemy => enemy !== boss && enemy.bossOwnerId === 'chimera');
    const leftFeeders = feeders.filter(enemy => enemy.pos.x < boss.pos.x);
    const rightFeeders = feeders.filter(enemy => enemy.pos.x > boss.pos.x);
    check(spawned === 2 && feeders.length === 2, 'Chimera summons two chaos feed enemies when asked');
    check(feeders.every(feeder => feeder.bossMechanicTags.includes('chaosFeed') && feeder.bossMechanicTags.includes('thermalFeed') && !feeder.affixes.includes('berserk')), 'Chimera summoned feeds keep thermal identity without berserk');
    check(leftFeeders.length >= 1 && leftFeeders.every(feeder => feeder.temp === -100), 'Chimera summoned left-side feeds are cold');
    check(rightFeeders.length >= 1 && rightFeeders.every(feeder => feeder.temp === 100), 'Chimera summoned right-side feeds are hot');
    assertNoOverlap(game);
}

{
    const game = makeGame(spawn_system, CONFIG);
    globalThis.game = game;
    const boss = new Enemy(210, 200, 180, 100, 1000, 1000, 'boss', ['devour']);
    boss.bossType = 'chimera';
    boss.chimeraFrostStacks = 100;
    boss._chimeraDigestCooldown = 2;
    const prey = new Enemy(30, 200, 60, 50, 100, 100, 'normal', []);
    prey.temp = 100;
    game.enemies = [boss, prey];

    withRandom(() => 0, () => boss.startTurnAction(game));
    check(boss.telegraphIntent?.key === 'chimera_thermal_devour' && boss._chimeraDigestCooldown === 0, 'Chimera old digest cooldown is clamped so next turn can telegraph devour');
    const feedersBeforeExecute = game.enemies.filter(enemy => enemy !== boss && enemy.bossOwnerId === 'chimera' && enemy.bossMechanicTags?.includes('thermalFeed'));
    check(feedersBeforeExecute.length === 0, 'Chimera does not summon thermal feeds before resolving devour');
    withRandom(() => 0, () => boss.executeTurnAction(game));
    const feedersAfterExecute = game.enemies.filter(enemy => enemy !== boss && enemy.bossOwnerId === 'chimera' && enemy.bossMechanicTags?.includes('thermalFeed'));
    const leftFeeders = feedersAfterExecute.filter(enemy => enemy.pos.x < boss.pos.x);
    const rightFeeders = feedersAfterExecute.filter(enemy => enemy.pos.x > boss.pos.x);
    check(!prey.active && (boss.chimeraFeedStacks || 0) > 0 && (boss.radiantAegis || 0) >= 100, 'Chimera resolves thermal devour before summoning and gains matched radiant shield');
    check(
        feedersAfterExecute.length === 2
        && leftFeeders.length >= 1 && leftFeeders.every(enemy => enemy.temp === -100)
        && rightFeeders.length >= 1 && rightFeeders.every(enemy => enemy.temp === 100),
        'Chimera summons thermal feeds after devour resolves'
    );
}

{
    const game = makeGame(spawn_system, CONFIG);
    globalThis.game = game;
    const boss = new Enemy(210, 200, 180, 100, 1000, 1000, 'boss', ['devour']);
    boss.bossType = 'chimera';
    game.enemies = [boss];

    let idx = 0;
    const rolls = [0.99, 0, 0.99, 0];
    const cooldownOnly = boss._tickChimeraMawField(game, { summon: false });
    check(cooldownOnly.spawned === 0 && game.enemies.length === 1, 'Chimera turn-start maw tick does not summon before devour');
    const result = withRandom(() => rolls[idx++] ?? 0, () => boss._tickChimeraMawField(game));
    const feeders = game.enemies.filter(enemy => enemy !== boss && enemy.bossOwnerId === 'chimera' && enemy.bossMechanicTags.includes('thermalFeed'));
    const leftFeeders = feeders.filter(enemy => enemy.pos.x < boss.pos.x);
    const rightFeeders = feeders.filter(enemy => enemy.pos.x > boss.pos.x);
    check(result.spawned === 3 && feeders.length === 3, 'Chimera turn tick summons 2-3 thermal feeds');
    check(feeders.every(enemy => !enemy.affixes.includes('berserk')), 'Chimera thermal feeds do not carry berserk');
    check(
        leftFeeders.length >= 1 && leftFeeders.every(enemy => enemy.temp === -100)
        && rightFeeders.length >= 1 && rightFeeders.every(enemy => enemy.temp === 100),
        'Chimera thermal feeds spawn as cold on the left and hot on the right'
    );
    assertNoOverlap(game);
}

{
    const game = makeGame(spawn_system, CONFIG);
    globalThis.game = game;
    const boss = new Enemy(210, 200, 180, 100, 1000, 1000, 'boss', []);
    boss.bossType = 'ignis';
    boss.berserked = true;
    boss._moveInterval = 2;
    boss._moveCooldown = 1;
    game.enemies = [boss];

    boss.executeTurnAction(game);
    check(boss.dropTargetY === 200 && boss._moveCooldown === 0, 'Berserk boss waits when movement cooldown is active');
    boss.executeTurnAction(game);
    check(boss.dropTargetY === 250 && boss._moveCooldown === 1, 'Berserk boss moves only when its movement cooldown reaches zero');
}

{
    const game = makeGame(spawn_system, CONFIG);
    globalThis.game = game;
    const cfg = CONFIG.balance.bossConfigs.ouroboros;
    const boss = new Enemy(180, 160, 180, 100, 1000, 1000, 'boss', ['shield', 'haste']);
    boss.bossType = 'ouroboros';
    game.enemies = [boss];

    check((cfg.orbitAttachments || []).length === 6, 'Ouroboros config defines six orbit attachments');
    const first = boss._tickOuroborosOrbit(game);
    check(first.slot?.id === 'aegis' && boss.rotationIndex === 0, 'Ouroboros first orbit tick activates aegis attachment');
    check(boss.affixes.includes('shield') && boss.affixes.includes('haste'), 'Ouroboros current attachment applies its affix pair');
    const second = boss._tickOuroborosOrbit(game);
    check(second.slot?.id === 'graft' && boss.rotationIndex === 1, 'Ouroboros rotates to the next attachment each turn');
    check(boss.affixes.includes('regen') && boss.affixes.includes('healer'), 'Ouroboros second attachment changes active affixes');
}

{
    const game = makeGame(spawn_system, CONFIG);
    globalThis.game = game;
    const boss = new Enemy(180, 160, 180, 100, 1000, 1000, 'boss', ['clone', 'shield']);
    boss.bossType = 'ouroboros';
    game.enemies = [boss];

    const brood = boss._applyOuroborosAttachment(2, game);
    const result = boss._performOuroborosAttachmentAction(game, brood);
    const echoes = game.enemies.filter(e => e !== boss && e.bossOwnerId === 'ouroboros');
    check(result.spawned > 0 && echoes.length > 0, 'Ouroboros brood attachment summons orbit echo minions');
    check(echoes[0].bossMinionRole === 'orbit_echo' && echoes[0].bossMechanicTags.includes('orbitAttachment'), 'Ouroboros orbit echo stores boss minion metadata');
    check(echoes[0].bossMechanicTags.includes('orbit:brood'), 'Ouroboros orbit echo records the active attachment slot');
    check(echoes[0].collisionShape === 'polygon' && (echoes[0].collisionData?.vertices || []).length === 8, 'Ouroboros orbit echo uses the octagonal minion collision hull');
    check(echoes[0]._visualFrameKey === 'minion:ouroboros:1x1', 'Ouroboros orbit echo uses the matching material collision frame');
    const echoAsset = resolveEnemyVisualAsset(echoes[0]);
    check(echoAsset.assetKey === 'orbitEcho:brood' && echoAsset.fallbackLevel === 'composite', 'Ouroboros orbit echo resolves the brood companion sprite asset');
    check(echoes[0]._spriteRenderer?.sheetPath?.includes('enemy_ouroboros_orbit_echo_brood_1x1_idle.png'), 'Ouroboros orbit echo renderer uses the brood companion sprite sheet in runtime');
    assertNoOverlap(game);
}

{
    const game = makeGame(spawn_system, CONFIG);
    globalThis.game = game;
    const cfg = CONFIG.balance.bossConfigs.ouroboros;
    const boss = new Enemy(180, 160, 180, 100, 1000, 1000, 'boss', ['shield', 'haste']);
    boss.bossType = 'ouroboros';

    for (const slot of cfg.orbitAttachments || []) {
        game.enemies = [boss];
        const spawned = boss._ouroborosSpawnEchoes(game, 1, slot);
        const echo = game.enemies.find(e => e !== boss && e.bossOwnerId === 'ouroboros');
        const asset = echo ? resolveEnemyVisualAsset(echo) : null;
        check(spawned === 1 && !!echo, `Ouroboros ${slot.id} acceptance spawns an orbit echo through runtime logic`);
        check(echo?.bossMechanicTags?.includes(`orbit:${slot.id}`), `Ouroboros ${slot.id} echo stores its slot tag`);
        check(echo?.visualAssetKey === `orbitEcho:${slot.id}`, `Ouroboros ${slot.id} echo stores explicit visualAssetKey`);
        check(echo?.collisionShape === 'polygon' && (echo?.collisionData?.vertices || []).length === 8, `Ouroboros ${slot.id} echo keeps octagonal collision hull`);
        check(echo?._visualFrameKey === 'minion:ouroboros:1x1', `Ouroboros ${slot.id} echo keeps the material minion frame`);
        check(asset?.assetKey === `orbitEcho:${slot.id}` && asset?.fallbackLevel === 'composite', `Ouroboros ${slot.id} echo resolves its companion sprite asset`);
        check(echo?._spriteRenderer?.sheetPath?.includes(`enemy_ouroboros_orbit_echo_${slot.id}_1x1_idle.png`), `Ouroboros ${slot.id} echo renderer uses its companion sprite sheet`);
        assertNoOverlap(game);
    }
}

{
    const game = makeGame(spawn_system, CONFIG);
    globalThis.game = game;
    for (const [key, value] of Object.entries(combat_system)) {
        if (typeof value === 'function') game[key] = value.bind(game);
    }
    const boss = new Enemy(180, 160, 180, 100, 1000, 1000, 'boss', ['shield', 'haste']);
    boss.bossType = 'ouroboros';
    game.enemies = [boss];

    boss._applyOuroborosAttachment(0, game);
    const profile = game.combat_getBossVulnerabilityProfile(boss);
    boss._bossVulnerabilityProgress = Math.max(0, profile.breakThreshold - 1);
    const result = game.combat_updateBossVulnerabilityProgress(boss, { matchedAttr: 'pierce', profile }, 1);
    check(result.breakTriggered, 'Ouroboros current attachment break triggers boss vulnerability break');
    check((boss.ouroborosOrbitStates[0]?.disabledTurns || 0) > 0, 'Ouroboros break seals the current attachment');
    check(boss.rotationIndex !== 0 && (boss.ouroborosOrbitDisruptions || 0) > 0, 'Ouroboros break changes rotation rhythm instead of only dealing damage');
}

{
    const game = makeGame(spawn_system, CONFIG);
    globalThis.game = game;
    const cfg = CONFIG.balance.bossConfigs.ouroboros;
    const boss = new Enemy(180, 160, 180, 100, 1000, 1000, 'boss', ['shield', 'haste']);
    boss.bossType = 'ouroboros';
    game.enemies = [boss];

    boss._applyOuroborosAttachment(0, game);
    const threshold = boss._getOuroborosDamageGateThreshold();
    boss._ouroborosDamageGateProgress = threshold - 1;
    const hit = boss.takeDamage(1, { config: { damage: 1, pierce: 1 }, pos: { x: boss.pos.x, y: boss.pos.y } }, true);

    check(hit.hpDamage === 1 && boss._ouroborosDamageGateProgress === 0, 'Ouroboros damage gate only counts real HP damage and resets after firing');
    check(boss._ouroborosLastDamageGateAction?.slotId === 'aegis' && boss._ouroborosLastDamageGateAction?.action === 'shield', 'Ouroboros damage gate fires the currently active attachment action');
    check((boss.ouroborosOrbitStates[0]?.disabledTurns || 0) >= (cfg.orbitDamageGateDisruptTurns || 2), 'Ouroboros damage gate seals the fired attachment for two turns');
    check(boss.rotationIndex === 1 && boss.affixes.includes('regen') && boss.affixes.includes('healer'), 'Ouroboros damage gate switches to the next available attachment after firing');
}

{
    const game = makeGame(spawn_system, CONFIG);
    globalThis.game = game;
    for (const [key, value] of Object.entries(combat_system)) {
        if (typeof value === 'function') game[key] = value.bind(game);
    }
    const boss = new Enemy(180, 160, 180, 100, 1000, 1000, 'boss', ['shield', 'haste']);
    boss.bossType = 'ouroboros';
    game.enemies = [boss];

    boss._applyOuroborosAttachment(0, game);
    const profile = game.combat_getBossVulnerabilityProfile(boss);
    boss._bossVulnerabilityProgress = Math.max(0, profile.breakThreshold - 1);
    boss._ouroborosDamageGateProgress = boss._getOuroborosDamageGateThreshold() - 1;
    const bossVulnerability = game.combat_applyBossVulnerability(
        boss,
        { damage: 1, pierce: 1 },
        { config: { damage: 1, pierce: 1 }, pos: { x: boss.pos.x, y: boss.pos.y } },
        1
    );
    const beforeDisruptions = boss.ouroborosOrbitDisruptions || 0;
    const hit = boss.takeDamage(1, { config: { damage: 1, pierce: 1 }, pos: { x: boss.pos.x, y: boss.pos.y } }, true);
    const updated = game.combat_updateBossVulnerabilityProgress(boss, bossVulnerability, hit.hpDamage);

    check(updated.breakTriggered && updated.damageGateAlreadyShifted, 'Ouroboros damage gate and vulnerability can resolve on the same hit without losing exposure');
    check((boss.ouroborosOrbitDisruptions || 0) === beforeDisruptions + 1, 'Ouroboros same-hit damage gate prevents duplicate attachment disruption');
    check((boss.ouroborosOrbitStates[1]?.disabledTurns || 0) === 0, 'Ouroboros same-hit vulnerability does not seal the newly switched attachment');
}

{
    const game = makeGame(spawn_system, CONFIG);
    globalThis.game = game;

    const armored = new Enemy(100, 100, 60, 50, 100, 100, 'normal', ['livingArmor']);
    armored._restoreLivingArmorForTurn();
    check(armored.livingArmorHp === 10, 'livingArmor initializes to 10% max HP');
    const normalSource = { config: { damage: 8, bounce: 0, pierce: 0, cryo: 0, pyro: 0, lightning: 0, venom: 0, wind: 0 }, pos: { x: 100, y: 100 } };
    const normalBlock = armored.takeDamage(8, normalSource);
    check(armored.hp === 100 && armored.livingArmorHp === 2 && normalBlock.hpDamage === 0 && normalBlock.blockedBy === 'livingArmor', 'livingArmor fully absorbs normal physical projectile hits');
    check(armored._defenseImpactFx?.livingArmor?.membraneStack?.every(layer => layer.flipX === false), 'livingArmor tree shield membranes keep their source-art orientation');
    const pierceSource = { config: { bounce: 0, pierce: 1 }, bouncesLeft: 0, pos: { x: 100, y: 100 } };
    armored.takeDamage(2, pierceSource);
    check(armored.hp === 98 && armored.livingArmorBroken === true, 'pierce damages livingArmor and body together');
    armored._grantLivingArmor(200);
    check(armored.livingArmorHp === 20 && armored.livingArmorBroken === false, 'armorSpore can restore broken livingArmor');

    const shielded = new Enemy(130, 100, 60, 50, 100, 100, 'normal', ['shield']);
    shielded.shieldCharges = 1;
    shielded.takeDamage(8, { config: { damage: 8 }, pos: { x: 130, y: 140 } });
    check(shielded._defenseImpactFx?.shield?.membraneStack?.every(layer => layer.flipX === true), 'standard shield membranes keep the legacy mirrored orientation');

    const spore = new Enemy(160, 100, 60, 50, 200, 200, 'normal', ['armorSpore']);
    const target = new Enemy(220, 100, 60, 50, 100, 100, 'normal', []);
    game.enemies = [spore, target];
    withRandom(() => 0, () => spore._tickArmorSporeForTurn(game));
    check(target.livingArmorHp === 20 && target.livingArmorMax === 20, 'armorSpore grants armor based on distributor max HP');
    check(target._armorSporeTrailTimer > 0 && target._armorSporeTrailFromX === spore.pos.x, 'armorSpore marks target with a source flyline for fallback art');
    withRandom(() => 0, () => spore._tickArmorSporeForTurn(game));
    check(target.livingArmorMax === 30, 'armorSpore stacks existing livingArmor at 50% value');
    check(target.livingArmorBaseMax === 20 && target.livingArmorStacked === true, 'armorSpore marks stacked livingArmor for dynamic art states');
}

{
    const game = makeGame(spawn_system, CONFIG);
    globalThis.game = game;
    game.playerShield = 20;
    const breaker = new Enemy(100, 625, 120, 100, 100, 100, 'elite', ['siegeBreaker']);
    breaker.gridCols = 2;
    breaker.gridRows = 2;
    breaker.dropTargetY = game.defeatLineY - breaker.height / 2;
    breaker._tryResolveDefenseBarrierMove(game, game.enemyHeight);
    check(game.playerShield === 12, 'siegeBreaker barrier damage equals footprint cells times two');
}

{
    const game = makeGame(spawn_system, CONFIG);
    globalThis.game = game;
    const phase = new Enemy(100, 100, 60, 50, 100, 100, 'normal', ['phaseShield', 'shield']);
    phase.shieldCharges = 2;
    phase._applyPhaseShieldInitialBonus();
    check(phase.shieldCharges === 4, 'phaseShield doubles initial shield charges');
    const phaseOnly = new Enemy(130, 100, 60, 50, 100, 100, 'normal', ['phaseShield']);
    phaseOnly._applyPhaseShieldInitialBonus();
    check(phaseOnly.shieldCharges === 2 && phaseOnly.affixes.includes('shield'), 'phaseShield alone grants doubled baseline shield semantics');
    phase._tickPhaseShieldForTurn(game);
    phase._tickPhaseShieldForTurn(game);
    phase._tickPhaseShieldForTurn(game);
    check(phase.phaseShieldDisabledThisTurn === true, 'phaseShield disables shields on its cycle turn');

    const reactor = new Enemy(180, 100, 60, 50, 100, 100, 'normal', ['overloadReactor']);
    reactor.takeDamage(45, { config: {}, pos: { x: 180, y: 100 } });
    check(reactor._overloadBonusThisTurn === 2, 'overloadReactor gains one bonus per 20% max HP damage');

    const lowImmune = new Enemy(260, 100, 60, 50, 100, 100, 'normal', ['lowDamageImmune']);
    const lowResult = lowImmune.takeDamage(4, { config: {}, pos: { x: 260, y: 100 } });
    check(lowImmune.hp === 100 && lowResult.lowDamageImmune === true, 'lowDamageImmune blocks final hits below 5% max HP');

    const energy = new Enemy(340, 100, 60, 50, 100, 100, 'normal', ['energyArmor']);
    energy.takeDamage(50, { config: {}, pos: { x: 340, y: 100 } });
    check(energy.hp === 80 && energy.energyArmorShield === 30, 'energyArmor caps high hit damage and stores overflow shield');

    const jumper = new Enemy(420, 100, 60, 50, 100, 100, 'normal', ['jump']);
    game.particles = [];
    jumper.takeDamage(12, { config: { damage: 12, cryo: 0, pierce: 0, bounce: 0 }, pos: { x: 420, y: 100 } });
    check(game.particles.some(p => p.mode === 'spark'), 'jump hit feedback uses spark particles');
    check(!game.particles.some(p => p.mode === 'shard'), 'jump hit feedback does not look like cryo shards');

    const shielded = new Enemy(500, 100, 60, 50, 100, 100, 'normal', ['shield']);
    shielded.shieldCharges = 1;
    game.particles = [];
    shielded.takeDamage(12, { config: { damage: 12, cryo: 0, pierce: 0, bounce: 0 }, pos: { x: 500, y: 100 } });
    check(game.particles.some(p => p.mode === 'spark'), 'shield break feedback uses spark particles');
    check(!game.particles.some(p => p.mode === 'shard'), 'shield break feedback does not look like cryo shards');

    const radiant = new Enemy(580, 100, 60, 50, 100, 100, 'normal', ['radiantAegis']);
    radiant.radiantAegis = 1;
    radiant.radiantAegisBroken = false;
    game.particles = [];
    radiant.takeDamage(12, { config: { damage: 12, cryo: 0, pierce: 0, bounce: 0 }, pos: { x: 580, y: 100 } });
    check(game.particles.some(p => p.mode === 'spark'), 'radiantAegis break feedback uses spark particles');
    check(!game.particles.some(p => p.mode === 'shard'), 'radiantAegis break feedback does not look like cryo shards');

    const carrier = new Enemy(180, 320, 180, 100, 300, 300, 'elite', ['carrier', 'shield']);
    carrier.baseArchetype = 'carrier';
    carrier.gridCols = 3;
    carrier.gridRows = 2;
    carrier.footprintCells = 5;
    carrier.footprintMask = [
        [1, 1, 1],
        [1, 0, 1],
    ];
    game.enemies = [carrier];
    carrier._carrierCooldown = 1;
    withRandom(() => 0, () => carrier._tickCarrierForTurn(game));
    const drone = game.enemies.find(e => e._isCarrierDrone);
    check(!!drone && drone.affixes.includes('haste') && drone.affixes.includes('jump'), 'carrier spawns haste+jump drone in bay slot 5');
    check(drone && drone.pos.x === carrier.pos.x && drone.pos.y === carrier.pos.y + game.enemyHeight / 2, 'carrier drone starts from the empty 5th footprint cell');
    check(drone && drone.hasActedThisTurn === true && drone.dropTargetY > drone.pos.y, 'carrier drone immediately moves on its spawn turn');
    check(drone && drone.affixes.includes('shield'), 'carrier drone inherits one host affix');
    check(carrier._getDefenseBarrierDamage(game) === 5, 'carrier uses five-cell U footprint for defense barrier damage');

    const bayCarrier = new Enemy(180, 320, 180, 100, 300, 300, 'elite', ['carrier']);
    bayCarrier.baseArchetype = 'carrier';
    bayCarrier.gridCols = 3;
    bayCarrier.gridRows = 2;
    bayCarrier.footprintCells = 5;
    bayCarrier.footprintMask = [
        [1, 1, 1],
        [1, 0, 1],
    ];
    const bayY = bayCarrier.pos.y + game.enemyHeight / 2;
    const oldDrone = new Enemy(bayCarrier.pos.x, bayY, 60, 50, 30, 30, 'normal', ['jump']);
    oldDrone.dropTargetY = bayY;
    game.enemies = [bayCarrier, oldDrone];
    bayCarrier._carrierCooldown = 1;
    withRandom(() => 0, () => bayCarrier._tickCarrierForTurn(game));
    const bayDrones = game.enemies.filter(e => e._isCarrierDrone);
    check(oldDrone.dropTargetY === bayY + game.enemyHeight, 'carrier pushes the previous bay occupant out before spawning');
    check(bayDrones.length === 1 && bayDrones[0].dropTargetY > oldDrone.dropTargetY, 'carrier new drone launches immediately after bay push-out');
    assertNoOverlap(game);

    {
        const blockedGame = makeGame(spawn_system, CONFIG);
        globalThis.game = blockedGame;
        const blockedCarrier = new Enemy(180, 320, 180, 100, 300, 300, 'elite', ['carrier']);
        blockedCarrier.baseArchetype = 'carrier';
        blockedCarrier.gridCols = 3;
        blockedCarrier.gridRows = 2;
        blockedCarrier.footprintCells = 5;
        blockedCarrier.footprintMask = [
            [1, 1, 1],
            [1, 0, 1],
        ];
        const blockedBayY = blockedCarrier.pos.y + blockedGame.enemyHeight / 2;
        const stuckDrone = new Enemy(blockedCarrier.pos.x, blockedBayY, 60, 50, 30, 30, 'normal', ['jump']);
        const blockerOne = new Enemy(blockedCarrier.pos.x, blockedBayY + blockedGame.enemyHeight, 60, 50, 30, 30, 'normal', []);
        const blockerTwo = new Enemy(blockedCarrier.pos.x, blockedBayY + blockedGame.enemyHeight * 2, 60, 50, 30, 30, 'normal', []);
        blockedGame.enemies = [blockedCarrier, stuckDrone, blockerOne, blockerTwo];
        blockedCarrier._carrierCooldown = 1;
        withRandom(() => 0, () => blockedCarrier._tickCarrierForTurn(blockedGame));
        check(stuckDrone.dropTargetY === blockedBayY, 'carrier keeps bay occupant in place when push-out has no legal target');
        check(!blockedGame.enemies.some(e => e._isCarrierDrone), 'carrier skips spawning when the occupied bay cannot be pushed out');
        assertNoOverlap(blockedGame);
    }
}


withRandom(() => 0, () => {
    const game = makeGame(spawn_system, CONFIG);
    game.round = 30;
    game.spawn_trySpawnArchetypes(100, baseHP, Array(CONFIG.gameplay.enemyCols).fill(false), colWidth, {});
    check(game.enemies.some(enemy => enemy.baseArchetype === 'gravityWell'), 'forced random archetype can spawn gravityWell');
    game.spawn_trySpawnArchetypes(360, baseHP, Array(CONFIG.gameplay.enemyCols).fill(false), colWidth, {});
    check(countArchetypes(game.enemies).gravityWell === 1, 'second random archetype does not duplicate gravityWell');
    assertLargeLimits(game);
    assertNoOverlap(game);
    assertGridDimensions(game);
});

withRandom(() => 0, () => {
    const game = makeGame(spawn_system, CONFIG);
    game.round = 30;
    game.enemies.push({
        active: true,
        baseArchetype: 'maw',
        gridCols: 2,
        gridRows: 2,
        pos: { x: 30, y: 1000 },
        width: 120,
        height: 100,
    });
    game.spawn_trySpawnArchetypes(100, baseHP, Array(CONFIG.gameplay.enemyCols).fill(false), colWidth, {});
    check(!game.enemies.some(enemy => enemy.baseArchetype === 'gravityWell'), 'random archetype skips gravityWell while another large is active');
    assertLargeLimits(game);
    assertGridDimensions(game);
});

withRandom(() => 0.25, () => {
    const game = makeGame(spawn_system, CONFIG);
    game.round = 30;
    for (const [archetypeId, meta] of Object.entries(ENEMY_WAVE_PRESET_ARCHETYPES)) {
        const before = game.enemies.length;
        game.spawn_spawnWavePresetSlot({
            slot: {
                archetype: archetypeId,
                cols: meta.cols,
                rows: meta.rows,
                affixes: [meta.affix],
            },
            startCol: 0,
            cols: meta.cols,
            rows: meta.rows,
            centerX: meta.cols * game.enemyWidth / 2,
            centerY: 2000 + before * 360,
            widthPx: meta.cols * game.enemyWidth,
            heightPx: meta.rows * game.enemyHeight,
        }, baseHP, colWidth, {});
        const enemy = game.enemies.at(-1);
        assertArchetypeContract(enemy, archetypeId, meta, game, CONFIG);
    }
});

{
    const game = makeGame(spawn_system, CONFIG);
    game.round = 30;
    game.spawn_spawnWavePresetSlot({
        slot: {
            archetype: 'bastion',
            cols: 3,
            rows: 1,
            affixes: ['heavyArmor', 'haste', 'shield'],
        },
        startCol: 0,
        cols: 3,
        rows: 1,
        centerX: 90,
        centerY: 240,
        widthPx: 180,
        heightPx: 50,
    }, baseHP, colWidth, {});
    const enemy = game.enemies.at(-1);
    check(enemy.affixes.includes('heavyArmor'), 'runtime bastion slot keeps heavyArmor');
    check(enemy.affixes.includes('shield'), 'runtime bastion slot keeps compatible shield');
    check(!enemy.affixes.includes('haste'), 'runtime bastion slot strips incompatible haste');
}

{
    const game = makeGame(spawn_system, CONFIG);
    globalThis.game = game;
    const bastion = new Enemy(160, 160, 180, 50, 200, 200, 'elite', ['heavyArmor']);
    bastion.baseArchetype = 'bastion';
    bastion.gridCols = 3;
    bastion.gridRows = 1;
    const boss = new Enemy(160, 160, 180, 100, 1000, 1000, 'boss', ['haste', 'clone']);
    boss.bossType = 'tesla';
    game.enemies = [bastion];
    withImmediateTimers(() => withRandom(() => 0, () => game.spawn_triggerBossEntranceShockwave(boss)));
    check(bastion.affixes.includes('heavyArmor'), 'boss shockwave keeps base required affix on bastion');
    check(
        !bastion.affixes.includes('haste') && !bastion.affixes.includes('clone'),
        'boss shockwave cannot add blocked speed/clone affixes to bastion'
    );
}

withRandom(makeRng(0xEC0A1), () => {
    const game = makeGame(spawn_system, CONFIG);
    let presetHits = 0;
    let randomArchetypeHits = 0;

    for (let round = 1; round <= 60; round++) {
        game.round = round;
        const beforePreset = game.enemies.length;
        const occupied = Array(CONFIG.gameplay.enemyCols).fill(false);
        const yPos = 100 + round * 260;
        const presetOk = game.spawn_trySpawnWavePreset(yPos, baseHP, occupied, colWidth);
        if (presetOk && game.enemies.length > beforePreset) presetHits++;

        if (!presetOk) {
            const beforeRandom = game.enemies.length;
            game.spawn_trySpawnArchetypes(yPos, baseHP, occupied, colWidth, {});
            if (game.enemies.length > beforeRandom) randomArchetypeHits++;
        }

        assertLargeLimits(game);
    }

    check(presetHits > 0, 'seeded 60-round simulation covers preset path');
    check(randomArchetypeHits > 0, 'seeded 60-round simulation covers random archetype path');
    assertNoOverlap(game);
    assertGridDimensions(game);
});

console.log('\n===================================================');
console.log(`  Result: ${passed}/${passed + failed} passed`);
if (failures.length > 0) {
    console.log('\n  Failed checks:');
    failures.forEach(failure => console.log(`    - ${failure}`));
}
console.log('===================================================');

process.exit(failed > 0 ? 1 : 0);
