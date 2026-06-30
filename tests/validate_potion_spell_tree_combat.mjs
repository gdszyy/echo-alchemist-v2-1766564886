/**
 * validate_potion_spell_tree_combat.mjs - Runtime regression checks for potion spellTree combat behavior.
 *
 * Usage:
 *   node tests/validate_potion_spell_tree_combat.mjs
 */

globalThis.document = {
    getElementById() {
        return {
            innerText: '',
            classList: { add() {}, remove() {} },
            style: {},
        };
    },
};
globalThis.window = globalThis;

const [{ combat_system }, { POTION_SPELL_DB }] = await Promise.all([
    import('../src/combat_system.js'),
    import('../src/config.js'),
]);

let passed = 0;
let failed = 0;
const failures = [];

function check(condition, message) {
    if (condition) {
        passed += 1;
        return;
    }
    failed += 1;
    failures.push(message);
    console.log(`  x ${message}`);
}

function fakeCtx() {
    return {
        save() {},
        restore() {},
        beginPath() {},
        moveTo() {},
        lineTo() {},
        closePath() {},
        arc() {},
        fill() {},
        stroke() {},
        fillRect() {},
        strokeRect() {},
        set globalAlpha(value) { this._globalAlpha = value; },
        set strokeStyle(value) { this._strokeStyle = value; },
        set fillStyle(value) { this._fillStyle = value; },
        set lineWidth(value) { this._lineWidth = value; },
    };
}

function enemy(x = 240, y = 180) {
    return {
        active: true,
        pos: { x, y },
        width: 36,
        height: 42,
        hp: 100,
        maxHp: 100,
        damageTaken: 0,
        temp: 0,
        venom: 0,
        dropTargetY: y,
        takeDamage(dmg) {
            const actual = Math.max(0, Number(dmg) || 0);
            this.hp -= actual;
            this.damageTaken += actual;
            return { hpDamage: actual, actualDamage: actual, killed: this.hp <= 0 };
        },
        applyTemp(value) {
            this.temp += value;
        },
        applyVenom(value) {
            this.venom += value;
        },
    };
}

function siegeEnemy(x = 240, y = 180) {
    return {
        ...enemy(x, y),
        width: 72,
        height: 84,
        affixes: ['siegeBreaker'],
    };
}

function potion(id) {
    const def = (POTION_SPELL_DB || []).find(item => item.id === id);
    if (!def) throw new Error(`Missing potion ${id}`);
    return def;
}

function preparedFor(id, root, extra = {}) {
    return {
        potionId: id,
        charges: 1,
        maxCharges: 1,
        quality: 2,
        sourceRunes: [],
        spellTree: { root },
        ...extra,
    };
}

function bindCombat(game) {
    for (const [key, value] of Object.entries(combat_system)) {
        if (typeof value === 'function') game[key] = value.bind(game);
    }
    game.combat_recordDamage = () => {};
    return game;
}

function gameWith(enemies = [enemy()]) {
    return bindCombat({
        phase: 'combat',
        isEnemyTurn: false,
        potionAlchemyUnlocked: true,
        ownedRelics: ['relic_sage_apothecary'],
        width: 480,
        height: 720,
        enemyHeight: 48,
        round: 3,
        perfQualityLevel: 'high',
        enemies,
        ammoQueue: [{ damage: 10 }],
        lightningBolts: [],
        particles: [],
        shockwaves: [],
        knownPotionSpellIds: [],
        skillPoints: 0,
        activeSkills: [],
        _currentDamageShotId: 'test-potion',
        ui: { updateSkillBar() { this.updated = true; } },
        sys_saveRunState() { this.saved = true; },
        ui_updateAmmoUI() { this.ammoUpdated = true; },
        combat_recordDamage() {},
        spawn_addScore() {},
        spawn_createFloatingText() {},
        spawn_createParticle() { return { vel: { x: 0, y: 0 }, size: 1 }; },
        spawn_createSkillIgnition() {},
        spawn_createProjectileExplosion() {},
        spawn_createAssimilationPulse() {},
        spawn_createAssimilationWave() {},
        spawn_createShockwave() {},
        spawn_pushParticleWithLimit(item) { this.particles.push(item); },
        combat_playSkillImpactVFX() {},
        combat_lightning_triggerChain() {},
        combat_flyingSword_addSon() {},
        combat_flyingSword_assignTarget() {},
        ui_triggerScreenShake() {},
    });
}

console.log('Potion spellTree combat validation');

const rootOrbTarget = enemy();
const rootOrbGame = gameWith([rootOrbTarget]);
rootOrbGame.preparedPotionSpell = preparedFor('potion_molten_flask', {
    nodeId: 'root_orb',
    potionId: 'potion_molten_flask',
    spellType: 'burst',
    formId: 'orb',
    nestingMode: 'rupture',
    children: [],
});
rootOrbGame.combat_activatePotionSpell();
check(rootOrbGame.preparedPotionSpell.charges === 0, 'root Orb consumes one charge when carrier is spawned');
check(rootOrbGame._potionOrbCarriers?.length === 1, 'root Orb creates a visible carrier runtime object');
check(rootOrbGame._potionOrbCarriers?.[0]?.children?.length === 0, 'root Orb carrier does not require children');
check(rootOrbTarget.damageTaken === 0, 'root Orb content waits for carrier arrival');
for (let i = 0; i < 40; i++) rootOrbGame.combat_updatePotionRuntime(1, fakeCtx());
check((rootOrbGame._potionOrbCarriers || []).length === 0, 'root Orb carrier is removed after arrival');
check(rootOrbTarget.damageTaken > 0, 'root Orb ruptures and releases potion content after flight');

const activeTowerTarget = enemy(232, 198);
const activeTowerGame = gameWith([activeTowerTarget]);
activeTowerGame.preparedPotionSpell = preparedFor('potion_venom_mist', {
    nodeId: 'active_tower',
    potionId: 'potion_venom_mist',
    spellType: 'status',
    formId: 'tower',
    nestingMode: 'tower_active',
    slotType: 'active',
    children: [],
});
activeTowerGame.combat_activatePotionSpell();
check(activeTowerGame._potionTowers?.[0]?.kind === 'potion_tower', 'active tower creates a formal potion_tower entity');
check(activeTowerGame._potionTowers?.[0]?.pulseInterval < 9999, 'active tower has a recurring pulse interval');
for (let i = 0; i < 80; i++) activeTowerGame.combat_updatePotionRuntime(1, fakeCtx());
check(activeTowerTarget.damageTaken > 0 || activeTowerTarget.venom > 0, 'active tower periodically targets enemies');

const targetA = enemy(220, 210);
const targetB = enemy(270, 212);
const targetFar = enemy(430, 212);
const targetSelectGame = gameWith([targetFar, targetB, targetA]);
const selectedTargets = targetSelectGame.combat_selectPotionTowerTargets({
    active: true,
    pos: { x: 230, y: 210 },
    radius: 80,
}, 2);
check(selectedTargets.length === 2, 'tower target selection respects range and limit');
check(selectedTargets[0] === targetA && selectedTargets[1] === targetB, 'tower target selection is nearest-first and deterministic');

const blockingTarget = siegeEnemy(240, 198);
const blockingGame = gameWith([blockingTarget]);
blockingGame.preparedPotionSpell = preparedFor('potion_frost_seal', {
    nodeId: 'blocking_tower',
    potionId: 'potion_frost_seal',
    spellType: 'status',
    formId: 'tower',
    nestingMode: 'tower_active',
    slotType: 'active',
    children: [],
});
blockingGame.combat_activatePotionSpell();
const blockingTower = blockingGame._potionTowers?.[0];
const towerHpBeforeBlock = blockingTower?.hp || 0;
const enemyYBeforeBlock = blockingTarget.pos.y;
blockingGame.combat_updatePotionRuntime(1, fakeCtx());
check(blockingTower.hp < towerHpBeforeBlock, 'tower takes contact damage when blocking an enemy');
check(blockingTarget.pos.y < enemyYBeforeBlock && blockingTarget.dropTargetY <= blockingTarget.pos.y, 'tower clamps blocked enemies above its hitbox');
const towerHpAfterFirstBlock = blockingTower.hp;
blockingGame.combat_updatePotionRuntime(1, fakeCtx());
check(blockingTower.hp === towerHpAfterFirstBlock, 'tower contact damage uses a cooldown instead of draining every frame');

const lifecycleTarget = enemy(240, 190);
const lifecycleGame = gameWith([lifecycleTarget]);
lifecycleGame.preparedPotionSpell = preparedFor('potion_venom_mist', {
    nodeId: 'lifecycle_tower',
    potionId: 'potion_venom_mist',
    spellType: 'status',
    formId: 'tower',
    nestingMode: 'tower_active',
    slotType: 'active',
    children: [],
});
lifecycleGame.combat_activatePotionSpell();
const lifecycleTower = lifecycleGame._potionTowers?.[0];
lifecycleTower.lifeFrames = 1;
lifecycleGame.combat_updatePotionRuntime(1, fakeCtx());
check((lifecycleGame._potionTowers || []).length === 0, 'tower lifecycle expiry removes the runtime object');

const deathTowerTarget = enemy(242, 190);
const deathTowerGame = gameWith([deathTowerTarget]);
deathTowerGame.preparedPotionSpell = preparedFor('potion_molten_flask', {
    nodeId: 'death_tower',
    potionId: 'potion_molten_flask',
    spellType: 'burst',
    formId: 'tower',
    nestingMode: 'tower_death',
    slotType: 'death',
    children: [],
});
deathTowerGame.combat_activatePotionSpell();
const deathTower = deathTowerGame._potionTowers?.[0];
check(deathTower?.slotType === 'death', 'death tower keeps the death slot');
for (let i = 0; i < 40; i++) deathTowerGame.combat_updatePotionRuntime(1, fakeCtx());
check(deathTowerTarget.damageTaken === 0, 'death tower does not pulse before death');
deathTower.hp = 0;
deathTowerGame.combat_updatePotionRuntime(1, fakeCtx());
check(deathTowerTarget.damageTaken > 0, 'death tower releases its effect on destruction');
check((deathTowerGame._potionTowers || []).length === 0, 'destroyed death tower leaves runtime list');

const invalidGame = gameWith([enemy()]);
invalidGame.preparedPotionSpell = preparedFor('potion_molten_flask', {
    nodeId: 'invalid_root',
    potionId: 'potion_molten_flask',
    spellType: 'burst',
    formId: 'orb',
    nestingMode: 'rupture',
    children: [{
        nodeId: 'invalid_child',
        potionId: 'potion_venom_mist',
        spellType: 'status',
        formId: 'orb',
        nestingMode: 'rupture',
        children: [],
    }],
});
const invalidApplied = invalidGame.combat_applyPotionSpell(potion('potion_molten_flask'), invalidGame.preparedPotionSpell);
check(invalidApplied === false, 'combat rejects illegal Orb -> Orb tree');
check(!invalidGame._potionOrbCarriers, 'illegal tree does not spawn carrier runtime');

const invalidTowerGame = gameWith([enemy()]);
invalidTowerGame.preparedPotionSpell = preparedFor('potion_venom_mist', {
    nodeId: 'invalid_tower_root',
    potionId: 'potion_venom_mist',
    spellType: 'status',
    formId: 'tower',
    nestingMode: 'tower_active',
    slotType: 'active',
    children: [{
        nodeId: 'tower_child',
        potionId: 'potion_molten_flask',
        spellType: 'burst',
        formId: 'tower',
        nestingMode: 'tower_active',
        slotType: 'active',
        children: [],
    }],
});
invalidTowerGame.combat_activatePotionSpell();
check(invalidTowerGame.preparedPotionSpell.charges === 1, 'illegal tower-spawns-tower tree does not consume a charge');
check(!invalidTowerGame._potionTowers, 'illegal tower-spawns-tower tree does not spawn tower runtime');
check(!invalidTowerGame._potionOrbCarriers, 'illegal tower-spawns-tower tree does not spawn carrier runtime');

const towerSlotMixGame = gameWith([enemy()]);
towerSlotMixGame.preparedPotionSpell = preparedFor('potion_molten_flask', {
    nodeId: 'slot_mix_root',
    potionId: 'potion_molten_flask',
    spellType: 'burst',
    formId: 'bottle',
    nestingMode: 'shatter',
    children: [
        {
            nodeId: 'active_slot_child',
            potionId: 'potion_venom_mist',
            spellType: 'status',
            formId: 'tower',
            nestingMode: 'tower_active',
            slotType: 'active',
            children: [],
        },
        {
            nodeId: 'death_slot_child',
            potionId: 'potion_molten_flask',
            spellType: 'burst',
            formId: 'tower',
            nestingMode: 'tower_death',
            slotType: 'death',
            children: [],
        },
    ],
});
towerSlotMixGame.combat_activatePotionSpell();
check(towerSlotMixGame.preparedPotionSpell.charges === 1, 'active/death mixed tower tree does not consume a charge');
check(!towerSlotMixGame._potionTowers, 'active/death mixed tower tree does not spawn tower runtime');

const total = passed + failed;
console.log(`Result: ${passed}/${total} passed`);
if (failed > 0) {
    console.log('Failures:');
    failures.forEach(item => console.log(`  - ${item}`));
    process.exit(1);
}
