const POTION_SPELL_CONTENT_RUNE_COUNT = 3;

const POTION_SPELL_CONTENT_RULES = Object.freeze({
    runeword_meltdown: { spellType: 'burst', potionId: 'potion_molten_flask', ruleId: 'rw_meltdown_burst' },
    runeword_absolute_zero: { spellType: 'status', potionId: 'potion_frost_seal', ruleId: 'rw_absolute_zero_status' },
    runeword_frost_nova: { spellType: 'status', potionId: 'potion_frost_seal', ruleId: 'rw_frost_nova_status' },
    runeword_thunderstorm: { spellType: 'status', potionId: 'potion_storm_lure', ruleId: 'rw_thunderstorm_status' },
    runeword_thunder_scatter: { disabled: true, spellType: 'chain_reaction', ruleId: 'rw_thunder_scatter_chain_forbidden' },
    runeword_kinetic_surge: { spellType: 'ammo_enchant', potionId: 'potion_prism_focus', ruleId: 'rw_kinetic_surge_ammo_enchant' },
    runeword_irradiation: { spellType: 'status', potionId: 'potion_prism_focus', ruleId: 'rw_irradiation_status' },
    runeword_toxic_bloom: { spellType: 'status', potionId: 'potion_venom_mist', ruleId: 'rw_toxic_bloom_status' },
    runeword_overload_core: { spellType: 'burst', potionId: 'potion_overload_vial', ruleId: 'rw_overload_core_burst' },
    runeword_echo_chamber: { spellType: 'ammo_enchant', potionId: 'potion_echo_phial', ruleId: 'rw_echo_chamber_ammo_enchant' },
    runeword_flame_sword: { spellType: 'construct', potionId: 'potion_blade_shadow', ruleId: 'rw_flame_sword_construct' },
    runeword_armor_piercing_meteor: { spellType: 'burst', potionId: 'potion_blade_shadow', ruleId: 'rw_armor_piercing_meteor_burst' },
    runeword_blazing_beam: { spellType: 'status', potionId: 'potion_molten_flask', ruleId: 'rw_blazing_beam_status' },
    runeword_lightning_shield: { spellType: 'construct', potionId: 'potion_storm_lure', ruleId: 'rw_lightning_shield_construct' },
    runeword_blade_storm: { spellType: 'construct', potionId: 'potion_blade_shadow', ruleId: 'rw_blade_storm_construct' },
    runeword_elemental_fusion: { spellType: 'burst', potionId: 'potion_collapse_vial', ruleId: 'rw_elemental_fusion_burst' },
    runeword_sword_resonance: { disabled: true, spellType: 'special_unlock', ruleId: 'rw_sword_resonance_special_unlock_forbidden' },
    runeword_storm_resonance: { disabled: true, spellType: 'special_unlock', ruleId: 'rw_storm_resonance_special_unlock_forbidden' },
    runeword_bloodthirst_edge: { disabled: true, spellType: 'pure_numeric', ruleId: 'rw_bloodthirst_edge_pure_numeric_forbidden' },
    runeword_scatter_matrix: { disabled: true, spellType: 'projectile_transform', ruleId: 'rw_scatter_matrix_projectile_transform_forbidden' },
    runeword_focused_fire: { disabled: true, spellType: 'pure_numeric', ruleId: 'rw_focused_fire_pure_numeric_forbidden' },
    runeword_mass_collapse: { spellType: 'burst', potionId: 'potion_collapse_vial', ruleId: 'rw_mass_collapse_burst' },
    runeword_kinetic_decay: { spellType: 'delay', potionId: 'potion_collapse_vial', ruleId: 'rw_kinetic_decay_delay' },
    runeword_echo_shot: { disabled: true, spellType: 'projectile_spawn', ruleId: 'rw_echo_shot_projectile_spawn_forbidden' },
    runeword_son_sword_summon: { spellType: 'construct', potionId: 'potion_blade_shadow', ruleId: 'rw_son_sword_summon_construct' },
    runeword_bullet_to_sword: { disabled: true, spellType: 'projectile_transform', ruleId: 'rw_bullet_to_sword_projectile_transform_forbidden' },
});

function getAlchemyRuneId(entry) {
    if (!entry) return null;
    if (typeof entry === 'string') return entry;
    return entry.id || entry.runeId || entry.def?.id || null;
}

function getAlchemyRuneLevel(entry) {
    const level = Number(entry?.level);
    return Number.isFinite(level) && level > 0 ? level : 1;
}

function getAlchemyRuneElement(entry) {
    return entry?.element || entry?.def?.element || entry?.def?.baseStat || null;
}

function countIds(ids) {
    return ids.reduce((acc, id) => {
        if (id) acc[id] = (acc[id] || 0) + 1;
        return acc;
    }, {});
}

function countsMatch(left, right) {
    const leftKeys = Object.keys(left);
    const rightKeys = Object.keys(right);
    if (leftKeys.length !== rightKeys.length) return false;
    return leftKeys.every(key => left[key] === right[key]);
}

function idsMatchUnordered(leftIds, rightIds) {
    return countsMatch(countIds(leftIds), countIds(rightIds));
}

function matchesRunewordFormula(runeword, runeIds) {
    const pattern = Array.isArray(runeword?.pattern) ? runeword.pattern : [];
    if (pattern.length !== runeIds.length) return false;

    const formula = runeword.spellFormula || {};
    if (formula.shape === 'loose_line' || pattern.length !== POTION_SPELL_CONTENT_RUNE_COUNT) {
        return idsMatchUnordered(runeIds, pattern);
    }

    const centerSlot = Number.isInteger(formula.centerSlot) ? formula.centerSlot : 1;
    if (runeIds[centerSlot] !== pattern[centerSlot]) return false;

    const endpointOrder = formula.endpointOrder || 'flex';
    const inputOuter = runeIds.filter((_, index) => index !== centerSlot);
    const patternOuter = pattern.filter((_, index) => index !== centerSlot);
    if (endpointOrder === 'fixed') {
        return inputOuter.every((id, index) => id === patternOuter[index]);
    }
    return idsMatchUnordered(inputOuter, patternOuter);
}

function buildSourceRunes(runes) {
    return runes.map((rune, index) => ({
        id: getAlchemyRuneId(rune),
        level: getAlchemyRuneLevel(rune),
        element: getAlchemyRuneElement(rune),
        formulaSlot: index,
    }));
}

function buildFailure(code, reason, extras = {}) {
    return {
        success: false,
        status: extras.status || 'rejected',
        code,
        reason,
        requiredCount: POTION_SPELL_CONTENT_RUNE_COUNT,
        ...extras,
    };
}

function buildSpellContent(runeword, rule, sourceRunes) {
    return {
        spellContentId: runeword.id,
        runewordId: runeword.id,
        effectId: runeword.effectId || null,
        spellType: rule.spellType,
        compatibilityPotionId: rule.potionId,
        sourceRunes,
        ruleId: rule.ruleId,
        hidden: true,
    };
}

function classifyRunewordForPotionContent(runeword, sourceRunes = []) {
    const rule = POTION_SPELL_CONTENT_RULES[runeword?.id];
    if (!rule) {
        return buildFailure('missing_spell_content_rule', 'This runeword has no potion spellContent rule.', {
            status: 'rejected',
            spellContentId: runeword?.id || null,
            runewordId: runeword?.id || null,
        });
    }
    if (rule.disabled || !rule.potionId) {
        return buildFailure(rule.ruleId || 'spell_content_forbidden', 'This runeword is not legal potion spellContent.', {
            status: 'rejected',
            rejectedBy: 'spell_content_rule',
            spellContentId: runeword.id,
            runewordId: runeword.id,
            spellType: rule.spellType,
            ruleId: rule.ruleId,
        });
    }

    const spellContent = buildSpellContent(runeword, rule, sourceRunes);
    return {
        success: true,
        status: 'matched',
        code: 'spell_content_matched',
        spellContent,
        spellContentId: spellContent.spellContentId,
        runewordId: spellContent.runewordId,
        spellType: spellContent.spellType,
        compatibilityPotionId: spellContent.compatibilityPotionId,
        potionId: spellContent.compatibilityPotionId,
        sourceRunes,
        ruleId: spellContent.ruleId,
    };
}

function resolvePotionSpellContent(selectedRunes = [], runewordDb = []) {
    const runes = Array.isArray(selectedRunes) ? selectedRunes.filter(Boolean) : [];
    const sourceRunes = buildSourceRunes(runes);
    const runeIds = sourceRunes.map(rune => rune.id);

    if (runes.length < POTION_SPELL_CONTENT_RUNE_COUNT) {
        return buildFailure('not_enough_runes', 'Not enough runes to form spellContent.', {
            status: 'pending',
            sourceRunes,
        });
    }
    if (runes.length > POTION_SPELL_CONTENT_RUNE_COUNT) {
        return buildFailure('single_node_rune_count_exceeded', 'Only one 3-rune spellContent node is supported.', {
            status: 'rejected',
            sourceRunes,
        });
    }
    if (runeIds.some(id => !id)) {
        return buildFailure('invalid_rune_entry', 'One or more rune entries are missing ids.', {
            status: 'rejected',
            sourceRunes,
        });
    }

    const matches = (runewordDb || []).filter(runeword => matchesRunewordFormula(runeword, runeIds));
    if (matches.length <= 0) {
        return buildFailure('no_runeword_spell_content', 'No RUNEWORD_DB formula matched these runes.', {
            status: 'unformed',
            sourceRunes,
        });
    }

    const matchedRuneword = matches[0];
    return classifyRunewordForPotionContent(matchedRuneword, sourceRunes);
}

function getPotionSpellContentRule(runewordId) {
    const rule = POTION_SPELL_CONTENT_RULES[runewordId];
    return rule ? { ...rule } : null;
}

export {
    POTION_SPELL_CONTENT_RUNE_COUNT,
    POTION_SPELL_CONTENT_RULES,
    classifyRunewordForPotionContent,
    getPotionSpellContentRule,
    matchesRunewordFormula,
    resolvePotionSpellContent,
};
