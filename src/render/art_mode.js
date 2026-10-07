/**
 * src/render/art_mode.js — 美术模式（像素风 / 位图）切换与像素资源路径重定向
 *
 * 职责：
 * - 判定当前美术模式：URL `?art=pixel|bitmap` > localStorage `ea_art_mode` > 默认 'pixel'。
 *   index.html <head> 的内联脚本用同一规则给 <html> 加 `art-pixel` / `art-bitmap` 类（CSS 在首帧前生效）。
 * - resolveArtSrc(path)：像素模式下把旧位图引用换成程序化像素图（src/pixel/art_registry.js 经
 *   setArtSrcResolver 注册的解析器给出 data URL）；认不出的路径原样返回（截图报告会列出，用来补漏）。
 *   像素模式不使用旧位图，也不再使用旧位图的自动像素化件。
 * - installArtSrcShims()：像素模式下的兜底——HTMLImageElement.src setter 与 <img src> 属性变更
 *   统一过 resolveArtSrc，覆盖散落在各模块里的 `new Image()` / innerHTML 模板路径。
 *
 * 切换模式需要刷新页面（PixiJS 是否初始化、样式表都在启动时决定）。
 * 规格：docs/design/pixel_art_mode.md
 * @module render/art_mode
 */
export const ART_MODE_STORAGE_KEY = 'ea_art_mode';
export const ART_MODES = Object.freeze(['pixel', 'bitmap']);
const DEFAULT_ART_MODE = 'pixel';

function readArtMode() {
    try {
        if (typeof location !== 'undefined') {
            const q = new URLSearchParams(location.search).get('art');
            if (ART_MODES.includes(q)) return q;
        }
    } catch (_) { /* non-browser */ }
    try {
        const stored = typeof localStorage !== 'undefined' ? localStorage.getItem(ART_MODE_STORAGE_KEY) : null;
        if (ART_MODES.includes(stored)) return stored;
    } catch (_) { /* storage blocked */ }
    return DEFAULT_ART_MODE;
}

let _artMode = readArtMode();

export function getArtMode() {
    return _artMode;
}

export function isPixelArtMode() {
    return _artMode === 'pixel';
}

/** 仅供测试：强制模式（不写存储） */
export function _setArtModeForTest(mode) {
    if (ART_MODES.includes(mode)) _artMode = mode;
}

/** 持久化模式并刷新页面（URL 上的 ?art= 会被同步改写，避免刷新后又被 URL 覆盖） */
export function setArtModeAndReload(mode) {
    if (!ART_MODES.includes(mode)) return false;
    try { localStorage.setItem(ART_MODE_STORAGE_KEY, mode); } catch (_) { /* ignore */ }
    try {
        const url = new URL(location.href);
        if (url.searchParams.has('art')) url.searchParams.set('art', mode);
        location.replace(url.toString());
    } catch (_) {
        location.reload();
    }
    return true;
}

// ─── 路径映射 ────────────────────────────────────────────────

const _resolveCache = new Map();

/**
 * 从任意形式的资源引用里取出 assets/ 之后的相对路径。
 * 支持 '/assets/x.png?v=1'、'assets/x.png'、'../../assets/x.png'、绝对 URL。
 * @returns {{ head: string, rel: string, tail: string } | null}
 */
export function splitAssetPath(src) {
    if (typeof src !== 'string' || !src) return null;
    let i = src.indexOf('/assets/');
    let headEnd;
    if (i >= 0) {
        headEnd = i + '/assets/'.length;
    } else if (src.startsWith('assets/')) {
        i = 0;
        headEnd = 'assets/'.length;
    } else {
        return null;
    }
    const rest = src.slice(headEnd);
    const cut = rest.search(/[?#]/);
    const rel = cut >= 0 ? rest.slice(0, cut) : rest;
    const tail = cut >= 0 ? rest.slice(cut) : '';
    return { head: src.slice(0, headEnd), rel, tail };
}

let _artResolver = null;

/** 注册像素模式的图标解析器：(src) => dataURL | null（由 src/pixel/art_registry.js 提供） */
export function setArtSrcResolver(fn) {
    _artResolver = typeof fn === 'function' ? fn : null;
    _resolveCache.clear();
}

/**
 * 像素模式下把旧位图引用换成程序化像素图；位图模式、无解析器或认不出的路径原样返回。
 * @param {string} src
 * @returns {string}
 */
export function resolveArtSrc(src) {
    if (_artMode !== 'pixel' || typeof src !== 'string' || !_artResolver) return src;
    const cached = _resolveCache.get(src);
    if (cached !== undefined) return cached;
    let out = src;
    if (splitAssetPath(src)) out = _artResolver(src) || src;
    if (_resolveCache.size > 4096) _resolveCache.clear();
    _resolveCache.set(src, out);
    return out;
}

// ─── 兜底 shim ───────────────────────────────────────────────

let _shimsInstalled = false;

/**
 * 像素模式下安装两个兜底：
 * 1. HTMLImageElement.prototype.src setter → resolveArtSrc（覆盖 `img.src = ...` 的所有加载器）；
 * 2. MutationObserver：innerHTML / setAttribute 写入的 <img src> 也改写成程序化像素图。
 * CSS url() 走生成的 src/styles/pixel_assets.css（url → CSS 变量），不在这里处理。
 */
export function installArtSrcShims(root = typeof document !== 'undefined' ? document.documentElement : null) {
    if (_shimsInstalled || _artMode !== 'pixel' || typeof HTMLImageElement === 'undefined') return false;
    _shimsInstalled = true;
    const desc = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, 'src');
    if (desc && desc.set && desc.get) {
        Object.defineProperty(HTMLImageElement.prototype, 'src', {
            configurable: true,
            enumerable: desc.enumerable,
            get() { return desc.get.call(this); },
            set(v) { desc.set.call(this, resolveArtSrc(v)); },
        });
    }
    const rewrite = (img) => {
        const raw = img.getAttribute('src');
        if (!raw) return;
        const next = resolveArtSrc(raw);
        if (next !== raw) img.setAttribute('src', next);
    };
    if (root) {
        root.querySelectorAll('img[src]').forEach(rewrite);
        const mo = new MutationObserver((records) => {
            for (const r of records) {
                if (r.type === 'attributes') {
                    if (r.target.tagName === 'IMG') rewrite(r.target);
                    continue;
                }
                for (const n of r.addedNodes) {
                    if (n.nodeType !== 1) continue;
                    if (n.tagName === 'IMG') rewrite(n);
                    else if (n.querySelectorAll) n.querySelectorAll('img[src]').forEach(rewrite);
                }
            }
        });
        mo.observe(root, { subtree: true, childList: true, attributes: true, attributeFilter: ['src'] });
    }
    return true;
}
