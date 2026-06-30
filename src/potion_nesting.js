const POTION_FORM_OPTION_DATA = [
    { formId: 'bottle', nestingMode: 'shatter', slotType: null, label: 'Bottle', spellTypes: ['burst', 'status', 'delay', 'construct', 'ammo_enchant'] },
    { formId: 'orb', nestingMode: 'rupture', slotType: null, label: 'Root Orb', spellTypes: ['burst', 'status', 'delay', 'construct'] },
    { formId: 'beam', nestingMode: 'hit', slotType: null, label: 'Beam', spellTypes: ['status', 'delay'] },
    { formId: 'meteor', nestingMode: 'impact', slotType: null, label: 'Meteor', spellTypes: ['burst', 'status', 'delay', 'construct'] },
    { formId: 'tower', nestingMode: 'tower_active', slotType: 'active', label: 'Active Tower', spellTypes: ['burst', 'status', 'delay'] },
    { formId: 'tower', nestingMode: 'tower_death', slotType: 'death', label: 'Death Tower', spellTypes: ['burst', 'status', 'delay'] },
];

const FORM_RULES = {
    bottle: { spellTypes: ['burst', 'status', 'delay', 'construct', 'ammo_enchant'], childForms: ['bottle', 'mine', 'slash', 'meteor', 'tower'], childSpellTypes: ['burst', 'status', 'delay', 'construct'] },
    orb: { spellTypes: ['burst', 'status', 'delay', 'construct'], childForms: ['bottle', 'mine', 'slash', 'meteor'], childSpellTypes: ['burst', 'status', 'delay', 'construct'] },
    mine: { spellTypes: ['burst', 'status', 'delay', 'construct'], childForms: ['bottle', 'slash'], childSpellTypes: ['burst', 'status', 'delay'] },
    beam: { spellTypes: ['status', 'delay'], childForms: ['bottle', 'slash'], childSpellTypes: ['status', 'delay'] },
    orbit: { spellTypes: ['status', 'delay'], childForms: ['bottle', 'slash'], childSpellTypes: ['status', 'delay'] },
    slash: { spellTypes: ['burst', 'status', 'delay'], childForms: ['bottle', 'mine'], childSpellTypes: ['burst', 'status', 'delay'] },
    meteor: { spellTypes: ['burst', 'status', 'delay', 'construct'], childForms: ['bottle', 'mine', 'slash'], childSpellTypes: ['burst', 'status', 'delay'] },
    sweeping_laser: { spellTypes: ['status', 'delay'], childForms: ['bottle', 'slash'], childSpellTypes: ['status', 'delay'] },
    tower: { spellTypes: ['burst', 'status', 'delay'], childForms: ['bottle', 'mine', 'slash', 'meteor'], childSpellTypes: ['burst', 'status', 'delay'] },
};

const FORBIDDEN_CHILD_SPELL_TYPES = new Set(['pure_damage', 'damage', 'projectile', 'orb', 'chain', 'chain_reaction', 'link', 'drain']);
const FORBIDDEN_NESTING_MODES = new Set(['chain', 'chain_reaction', 'on_damage', 'on_death']);

function fail(code, reason, status = 'rejected') {
    return { ok: false, code, ruleId: code, reason, status };
}

function pass(ruleId = 'potion_nesting_allowed', status = 'stable') {
    return { ok: true, code: ruleId, ruleId, reason: '', status };
}

export const POTION_FORM_OPTIONS = POTION_FORM_OPTION_DATA.map(option => ({ ...option, spellTypes: option.spellTypes.slice() }));

export function getPotionFormOption(formId = 'bottle', slotType = null) {
    const id = formId || 'bottle';
    const slot = slotType || null;
    if (id === 'tower') {
        return POTION_FORM_OPTIONS.find(option => option.formId === id && option.slotType === (slot || 'active'))
            || POTION_FORM_OPTIONS.find(option => option.formId === 'tower' && option.slotType === 'active');
    }
    return POTION_FORM_OPTIONS.find(option => option.formId === id) || POTION_FORM_OPTIONS[0];
}

export function isForbiddenPotionChildSpellType(spellType) {
    return FORBIDDEN_CHILD_SPELL_TYPES.has(spellType || '');
}

export function normalizePotionNode(node = {}) {
    const form = getPotionFormOption(node.formId || 'bottle', node.slotType || null);
    const children = Array.isArray(node.children) ? node.children.map(child => normalizePotionNode(child)) : [];
    return {
        nodeId: node.nodeId || 'node_unknown',
        potionId: node.potionId || node.spellContentId || null,
        spellContentId: node.spellContentId || node.potionId || null,
        spellType: node.spellType || 'burst',
        formId: form.formId,
        nestingMode: node.nestingMode || form.nestingMode,
        slotType: form.formId === 'tower' ? (node.slotType || form.slotType || 'active') : (node.slotType || form.slotType || null),
        sourceRunes: Array.isArray(node.sourceRunes) ? node.sourceRunes.slice() : [],
        children,
    };
}

export function validatePotionNode(node = {}, context = {}) {
    const normalized = normalizePotionNode(node);
    const rule = FORM_RULES[normalized.formId];
    if (!rule) return fail('unknown_parent_form', `Unsupported potion form: ${normalized.formId}`);
    if (!rule.spellTypes.includes(normalized.spellType)) {
        return fail('form_rejects_spell_type', `${normalized.formId} cannot carry ${normalized.spellType}`);
    }
    if (normalized.formId === 'tower' && !['active', 'death'].includes(normalized.slotType)) {
        return fail('tower_slot_required', 'Tower requires active or death slot');
    }
    if (normalized.formId === 'tower' && context.slotType && normalized.slotType !== context.slotType) {
        return fail('tower_dual_slot_mix', 'Active and death tower slots cannot mix in one tree');
    }
    return pass('potion_node_allowed', normalized.children.length > 0 ? 'extendable' : 'stable');
}

export function validatePotionNesting(parent = {}, child = {}, siblingChildren = []) {
    const p = normalizePotionNode(parent);
    const c = normalizePotionNode(child);
    const parentRule = FORM_RULES[p.formId];
    const childRule = FORM_RULES[c.formId];

    if (!parentRule) return fail('unknown_parent_form', `Unsupported parent form: ${p.formId}`);
    if (!childRule) return fail('unknown_child_form', `Unsupported child form: ${c.formId}`);
    if (p.formId === 'orb' && c.formId === 'orb') return fail('orb_cannot_release_orb', 'Orb cannot release another Orb');
    if (p.formId === 'beam' && c.formId === 'orb') return fail('beam_cannot_generate_orb', 'Beam hit cannot generate Orb');
    if (isForbiddenPotionChildSpellType(c.spellType)) return fail('pure_damage_chain_forbidden', `${c.spellType} cannot be a child spell`);
    if (FORBIDDEN_NESTING_MODES.has(c.nestingMode) || FORBIDDEN_NESTING_MODES.has(p.nestingMode)) {
        return fail('chain_reaction_forbidden', 'Chain-like nesting modes are forbidden');
    }
    if (p.formId === 'tower' && (c.formId === 'tower' || c.spellType === 'construct')) {
        return fail('tower_cannot_spawn_construct', 'Tower cannot spawn tower or construct children');
    }
    if (!parentRule.childForms.includes(c.formId)) return fail('child_form_forbidden', `${p.formId} cannot nest ${c.formId}`);
    if (!parentRule.childSpellTypes.includes(c.spellType)) return fail('child_spell_type_forbidden', `${p.formId} cannot nest ${c.spellType}`);

    const towerSlots = [p, c, ...(Array.isArray(siblingChildren) ? siblingChildren.map(item => normalizePotionNode(item)) : [])]
        .filter(node => node.formId === 'tower')
        .map(node => node.slotType || 'active');
    if (new Set(towerSlots).size > 1) {
        return fail('tower_dual_slot_mix', 'Active and death tower slots cannot mix in one tree');
    }
    return pass(`${p.formId}_${p.slotType || 'root'}_allows_${c.formId}_${c.spellType}`, c.children.length > 0 ? 'extendable' : 'stable');
}

export function validatePotionSpellTree(treeOrRoot = {}) {
    const root = normalizePotionNode(treeOrRoot.root || treeOrRoot);
    const visit = (node, context = {}) => {
        const nodeResult = validatePotionNode(node, context);
        if (!nodeResult.ok) return nodeResult;
        const children = Array.isArray(node.children) ? node.children.map(child => normalizePotionNode(child)) : [];
        const towerSlot = node.formId === 'tower' ? (node.slotType || 'active') : context.slotType;
        for (const child of children) {
            const edgeResult = validatePotionNesting(node, child, children);
            if (!edgeResult.ok) return edgeResult;
            const childResult = visit(child, { slotType: towerSlot });
            if (!childResult.ok) return childResult;
        }
        return pass(children.length > 0 ? 'potion_tree_extendable' : 'potion_tree_stable', children.length > 0 ? 'extendable' : 'stable');
    };
    return visit(root, {});
}

export function buildPotionSpellTree({ potion, formId = 'bottle', nestingMode = null, slotType = null, sourceRunes = [], children = [] } = {}) {
    const form = getPotionFormOption(formId || potion?.formId || 'bottle', slotType);
    const root = normalizePotionNode({
        nodeId: 'node_root',
        potionId: potion?.id || null,
        spellContentId: potion?.id || null,
        spellType: potion?.spellType || 'burst',
        formId: form.formId,
        nestingMode: nestingMode || form.nestingMode,
        slotType: form.slotType,
        sourceRunes,
        children,
    });
    return { root };
}
