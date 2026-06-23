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
        lightningBolts: [],
        floatingTexts: [],
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
        sys_determineEnemyReward(enemy) { enemy.rewardType = 'gold'; },
        spawn_createShockwave() { this.shockwaves.push({}); },
        spawn_createParticle(x, y, color, mode = 'normal') { this.particles.push({ x, y, color, mode }); },
        spawn_pushParticleWithLimit(particle) { this.particles.push(particle); },
        spawn_createFloatingText(x, y, text) { this.floatingTexts.push({ x, y, text }); },
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

const [{ spawn_system }, { combat_system }, { game_phase }, { CONFIG }, { ENEMY_WAVE_PRESETS, ENEMY_WAVE_PRESET_ARCHETYPES }, { Enemy }] = await Promise.all([
    import('../src/spawn_system.js'),
    import('../src/combat_system.js'),
    import('../src/game_phase.js'),
    import('../src/config.js'),
    import('../src/wave_presets.js'),
    import('../src/entities.js'),
]);

console.log('===================================================');
console.log('  V2 large enemy runtime spawn validation');
console.log('===================================================\n');

const baseHP = CONFIG.balance.enemyBaseHp || 10;
const colWidth = 60;

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
    game.enemies = [boss, ordinary, target];
    boss.actionName = '吞噬';
    withRandom(() => 0.99, () => boss.executeTurnAction(game));
    check(!target.active && ordinary.active, 'Devourer devour prioritizes mawFeed minion over generic prey');
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
    check(target.affixes.includes('berserk') && !target.affixes.includes('devour'), 'Chimera feed is volatile but does not self-devour');
}

{
    const game = makeGame(spawn_system, CONFIG);
    globalThis.game = game;
    const boss = new Enemy(210, 200, 180, 100, 900, 1000, 'boss', ['berserk', 'devour']);
    boss.bossType = 'chimera';
    const target = new Enemy(30, 200, 60, 50, 120, 120, 'normal', []);
    game.enemies = [boss, target];

    const pulled = boss._chimeraAttractPrey(game);
    check(pulled === 1, 'Chimera maw attracts prey in +2 grid range');
    check(target.pos.x === 90 && target.dropTargetY === 200, 'Chimera pull moves prey exactly one legal grid cell');
    assertNoOverlap(game);
}

{
    const game = makeGame(spawn_system, CONFIG);
    globalThis.game = game;
    const boss = new Enemy(210, 200, 180, 100, 900, 1000, 'boss', ['berserk', 'devour']);
    boss.bossType = 'chimera';
    boss.temp = 10;
    const preyA = new Enemy(30, 200, 60, 50, 100, 100, 'normal', []);
    preyA.temp = 30;
    preyA.venomStacks = 2;
    preyA.swordMarks = 1;
    preyA.markTimer = 7;
    preyA.frozenCount = 2;
    const preyB = new Enemy(330, 200, 60, 50, 100, 100, 'elite', ['shield']);
    preyB.temp = -40;
    preyB.isFrozenCurrentTurn = true;
    preyB._irradiationStacks = 3;
    preyB.phaseShieldDisabledThisTurn = true;
    preyB.shieldCharges = 1;
    game.enemies = [boss, preyA, preyB];

    const devoured = boss._chimeraDevourTargets(game, { force: true });
    check(devoured === 2, 'Chimera devours every non-boss enemy in +2 grid range');
    check(!preyA.active && !preyB.active, 'Chimera devour removes all consumed enemies');
    check(boss.temp === 0, 'Chimera inherits temperature by addition');
    check(boss.venomStacks === 2 && boss.swordMarks === 1 && boss.markTimer === 7, 'Chimera inherits venom and sword mark negative states');
    check(boss.frozenCount === 2 && boss.isFrozenCurrentTurn === true, 'Chimera inherits freeze state markers');
    check(boss._irradiationStacks === 3 && boss.phaseShieldDisabledThisTurn === true, 'Chimera inherits additional negative status flags');
    check((boss.chimeraFeedStacks || 0) === 2 && (boss.chimeraInheritedStatusCount || 0) >= 6, 'Chimera records feed and inherited status stacks');
    check((boss.shieldCharges || 0) >= 3, 'Chimera digest converts consumed shield into shield layers');
}

{
    const game = makeGame(spawn_system, CONFIG);
    globalThis.game = game;
    const boss = new Enemy(210, 200, 180, 100, 1000, 1000, 'boss', ['berserk', 'devour']);
    boss.bossType = 'chimera';
    game.enemies = [boss];

    const spawned = boss._chimeraSpawnFeeders(game, 1);
    const feeder = game.enemies.find(enemy => enemy !== boss && enemy.bossOwnerId === 'chimera');
    check(spawned === 1 && !!feeder, 'Chimera summons a chaos feed enemy');
    check(feeder.bossMechanicTags.includes('chaosFeed') && feeder.affixes.includes('berserk'), 'Chimera summoned feed keeps chaosFeed identity');
    assertNoOverlap(game);
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
    assertNoOverlap(game);
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

    const armored = new Enemy(100, 100, 60, 50, 100, 100, 'normal', ['livingArmor']);
    armored._restoreLivingArmorForTurn();
    check(armored.livingArmorHp === 10, 'livingArmor initializes to 10% max HP');
    const bounceSource = { config: { bounce: 1, pierce: 0 }, bouncesLeft: 0, pos: { x: 100, y: 100 } };
    armored.takeDamage(8, bounceSource);
    check(armored.hp === 100 && armored.livingArmorHp === 2, 'livingArmor absorbs bounced damage before body HP');
    const pierceSource = { config: { bounce: 0, pierce: 1 }, bouncesLeft: 0, pos: { x: 100, y: 100 } };
    armored.takeDamage(2, pierceSource);
    check(armored.hp === 98 && armored.livingArmorBroken === true, 'pierce damages livingArmor and body together');
    armored._grantLivingArmor(200);
    check(armored.livingArmorHp === 20 && armored.livingArmorBroken === false, 'armorSpore can restore broken livingArmor');

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
