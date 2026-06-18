import { CONFIG } from '../config.js';

const SIGNAL_KEYS = [
    'pyro', 'cryo', 'lightning', 'laser', 'pierce', 'bounce', 'scatter',
    'wind', 'flying_sword', 'resonance', 'venom', 'overcharge', 'echo'
];

function _num(value) {
    return Number.isFinite(Number(value)) ? Number(value) : 0;
}

function _displayFor(key) {
    return (CONFIG.ui && CONFIG.ui.attributeDisplay && CONFIG.ui.attributeDisplay[key])
        ? CONFIG.ui.attributeDisplay[key]
        : { name: key, icon: '', color: '#cbd5e1' };
}

function _clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

export function getAmmoSignalEntries(recipe) {
    if (!recipe) return [];

    const entries = [];
    for (const key of SIGNAL_KEYS) {
        let value = _num(recipe[key]);
        if (key === 'laser' && recipe.isLaser) value = Math.max(1, value);
        if (key === 'flying_sword' && recipe.type === 'flying_sword') value = Math.max(1, value);
        if (value <= 0) continue;

        const display = _displayFor(key);
        entries.push({
            key,
            value,
            name: display.name || key,
            icon: display.icon || '',
            color: display.color || '#cbd5e1',
        });
    }

    if (recipe.explosive && !entries.some(entry => entry.key === 'explosive')) {
        const display = _displayFor('explosive');
        entries.push({
            key: 'explosive',
            value: 1,
            name: display.name || '爆破',
            icon: display.icon || '!',
            color: display.color || '#fca5a5',
        });
    }

    return entries.sort((a, b) => b.value - a.value);
}

export function getAmmoReadabilityProfile(recipe) {
    const entries = getAmmoSignalEntries(recipe);
    const damage = Math.max(0, _num(recipe && recipe.damage));
    const multicast = Math.max(0, _num(recipe && recipe.multicast));
    const scatter = Math.max(0, _num(recipe && recipe.scatter));
    const pierce = Math.max(0, _num(recipe && recipe.pierce));
    const bounce = Math.max(0, _num(recipe && recipe.bounce));
    const totalStacks = entries.reduce((sum, entry) => sum + entry.value, 0);
    const attributeCount = entries.filter(entry => entry.key !== 'explosive').length;
    const specialBonus = (recipe && recipe.explosive ? 3 : 0)
        + (recipe && recipe.isLaser ? 2 : 0)
        + (recipe && recipe.isMatryoshka ? 2 : 0);

    const powerScore = damage
        + totalStacks * 1.35
        + multicast * 2.25
        + scatter * 0.9
        + pierce * 0.65
        + bounce * 0.45
        + specialBonus;

    let tier = 'c';
    let tierLabel = '不太行';
    let tierName = 'C';
    if (powerScore >= 24) {
        tier = 's';
        tierLabel = '超NB';
        tierName = 'S';
    } else if (powerScore >= 15) {
        tier = 'a';
        tierLabel = '很强';
        tierName = 'A';
    } else if (powerScore >= 8) {
        tier = 'b';
        tierLabel = '能打';
        tierName = 'B';
    }

    let shapeLabel = '基础弹';
    if (recipe && recipe.isLaser) shapeLabel = '光束炮';
    else if (recipe && recipe.explosive) shapeLabel = '爆破弹';
    else if (recipe && recipe.type === 'flying_sword') shapeLabel = '剑匣';
    else if (scatter >= 3) shapeLabel = '散射扇';
    else if (pierce >= 3) shapeLabel = '穿甲锥';
    else if (bounce >= 3) shapeLabel = '回弹芯';
    else if (attributeCount >= 3) shapeLabel = '复合弹';

    const primary = entries[0] || {
        key: 'damage',
        value: damage,
        name: '基础',
        icon: _displayFor('damage').icon || '',
        color: _displayFor('damage').color || '#a855f7',
    };

    const barrelCount = _clamp(1 + multicast + Math.floor(scatter / 3), 1, 6);
    const loadCount = _clamp(Math.ceil((totalStacks + Math.max(0, damage - 2)) / 4), 1, 6);
    const powerRatio = _clamp(powerScore / 28, 0.08, 1);
    const attributeSummary = entries.slice(0, 4).map(entry => `${entry.icon}${entry.value}`).join(' ');

    return {
        entries,
        damage,
        totalStacks,
        attributeCount,
        powerScore,
        powerRatio,
        tier,
        tierLabel,
        tierName,
        shapeLabel,
        primary,
        barrelCount,
        loadCount,
        multicast,
        summary: `${tierLabel} · ${shapeLabel} · 装填${loadCount} · ${barrelCount}管`,
        attributeSummary: attributeSummary || `DMG ${damage}`,
    };
}
