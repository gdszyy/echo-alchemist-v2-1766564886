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
        shockwaves: [],
        _wavePresetUsage: {},
        _wavePresetIntroShown: {},
        _wavePresetRoundUsed: null,
        calc_getRecentAverageDamage() { return 0; },
        sys_determineEnemyReward(enemy) { enemy.rewardType = 'gold'; },
        spawn_createShockwave() { this.shockwaves.push({}); },
        spawn_createParticle() { this.particles.push({}); },
        spawn_createFloatingText() {},
        calc_isAreaOccupied(centerX, centerY, width, height) {
            const left = centerX - width / 2;
            const right = centerX + width / 2;
            const top = centerY - height / 2;
            const bottom = centerY + height / 2;
            return this.enemies.some((enemy) => {
                if (!enemy || !enemy.active) return false;
                const enemyCenterY = enemy.dropTargetY ?? enemy.pos.y;
                const eLeft = enemy.pos.x - enemy.width / 2;
                const eRight = enemy.pos.x + enemy.width / 2;
                const eTop = enemyCenterY - enemy.height / 2;
                const eBottom = enemyCenterY + enemy.height / 2;
                return left < eRight && right > eLeft && top < eBottom && bottom > eTop;
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
            const ay = a.dropTargetY ?? a.pos.y;
            const by = b.dropTargetY ?? b.pos.y;
            const separated =
                a.pos.x + a.width / 2 <= b.pos.x - b.width / 2 ||
                b.pos.x + b.width / 2 <= a.pos.x - a.width / 2 ||
                ay + a.height / 2 <= by - b.height / 2 ||
                by + b.height / 2 <= ay - a.height / 2;
            check(separated, `runtime enemies do not overlap (${i}, ${j})`);
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

const [{ spawn_system }, { CONFIG }, { ENEMY_WAVE_PRESET_ARCHETYPES }] = await Promise.all([
    import('../src/spawn_system.js'),
    import('../src/config.js'),
    import('../src/wave_presets.js'),
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
    assertLargeLimits(game);
    assertNoOverlap(game);
    assertGridDimensions(game);
});

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
