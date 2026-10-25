/**
 * Runtime loader for mined music clip packs.
 *
 * The current MusicEngine still has a pure-synthesis fallback path. This module
 * keeps the optional clip library from becoming a boot-time hard dependency.
 */

const DEFAULT_CLIP_PACKS = [
    {
        id: 'ignis_midi_mined_v1',
        url: new URL('../docs/architecture/music_processing/clip_pack.json', import.meta.url).href,
    },
];

let _loadPromise = null;

function getScope(explicitScope) {
    if (explicitScope) return explicitScope;
    if (typeof globalThis !== 'undefined') return globalThis;
    return null;
}

function ensureRegistry(scope) {
    if (!scope) return [];
    if (!Array.isArray(scope.CLIP_PACKS)) {
        scope.CLIP_PACKS = [];
    }
    return scope.CLIP_PACKS;
}

function normalizePack(pack, id) {
    if (!pack || typeof pack !== 'object') return null;
    if (!pack.id) {
        pack.id = pack.meta?.id || id;
    }
    return pack;
}

export function registerClipPack(pack, options = {}) {
    const scope = getScope(options.scope);
    const normalized = normalizePack(pack, options.id);
    if (!scope || !normalized) return null;

    const registry = ensureRegistry(scope);
    const existingIndex = registry.findIndex((item) => item && item.id === normalized.id);
    if (existingIndex >= 0) {
        registry[existingIndex] = normalized;
    } else {
        registry.push(normalized);
    }

    // Legacy demos and early arranger notes use singular CLIP_PACK.
    if (!scope.CLIP_PACK) {
        scope.CLIP_PACK = normalized;
    }

    return normalized;
}

export function getClipPacks(scope = getScope()) {
    return ensureRegistry(scope).slice();
}

export async function loadClipPacks(options = {}) {
    if (_loadPromise && !options.forceReload) {
        return _loadPromise;
    }

    const scope = getScope(options.scope);
    const packs = options.packs || DEFAULT_CLIP_PACKS;

    _loadPromise = (async () => {
        const loaded = [];

        if (typeof fetch !== 'function') {
            return loaded;
        }

        for (const packDef of packs) {
            try {
                const rawPack = packDef.data || await fetchClipPack(packDef.url);
                const registered = registerClipPack(rawPack, { scope, id: packDef.id });
                if (registered) loaded.push(registered);
            } catch (error) {
                console.warn('[MusicClipPacks] Optional clip pack failed to load:', packDef.id, error);
            }
        }

        return loaded;
    })();

    return _loadPromise;
}

async function fetchClipPack(url) {
    const response = await fetch(url, { cache: 'force-cache' });
    if (!response.ok) {
        throw new Error(`HTTP ${response.status} while loading ${url}`);
    }
    return response.json();
}
