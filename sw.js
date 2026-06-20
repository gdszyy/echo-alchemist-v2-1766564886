/**
 * sw.js — Echo Alchemist V2 Service Worker
 *
 * 目的：让位图资源（assets/ 下的 PNG/JSON 等）在首次访问后持久缓存，
 * 跨刷新 / 跨会话不再重复下载；并顺带提供离线能力。
 *
 * 缓存策略：
 *   - assets/ 资源        → cache-first（运行时缓存，命中即返回，未命中再下载并写入缓存）
 *   - 导航 / *.js / HTML  → network-first（保证代码可更新），失败时回退缓存（离线可玩）
 *   - 跨域请求（CDN/字体）→ 不拦截，直接走网络
 *
 * 改美术或想强制所有客户端刷新资源时：bump 下方 CACHE_VERSION 即可。
 * 调试美术不想被缓存挡住时：访问页面时加 ?nosw（注册脚本会跳过 SW），
 * 或在 DevTools → Application → Service Workers 里 Unregister。
 */

const CACHE_VERSION = 'v20260620-enemy-normal-redo2';
const ASSET_CACHE = `echo-alchemist-assets-${CACHE_VERSION}`;
const CORE_CACHE = `echo-alchemist-core-${CACHE_VERSION}`;

// install 阶段只预缓存极少量核心文件，绝不预缓存庞大的 assets/。
const CORE_ASSETS = [
    './',
    './index.html',
    './src/core.js',
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CORE_CACHE)
            .then((cache) => cache.addAll(CORE_ASSETS).catch(() => {}))
            .then(() => self.skipWaiting())
    );
});

self.addEventListener('activate', (event) => {
    const keep = new Set([ASSET_CACHE, CORE_CACHE]);
    event.waitUntil(
        caches.keys()
            .then((names) => Promise.all(
                names.filter((n) => !keep.has(n)).map((n) => caches.delete(n))
            ))
            .then(() => self.clients.claim())
    );
});

/** 判断是否为 assets/ 下的位图/资源请求 */
function isAssetRequest(url) {
    return url.pathname.includes('/assets/');
}

/** cache-first：命中缓存直接返回；否则下载后写入缓存。 */
async function cacheFirst(request) {
    const cache = await caches.open(ASSET_CACHE);
    const cached = await cache.match(request);
    if (cached) return cached;
    const response = await fetch(request);
    // 仅缓存成功的、可缓存的响应（含 opaque 兜底由上层 same-origin 保证）
    if (response && response.ok) {
        cache.put(request, response.clone()).catch(() => {});
    }
    return response;
}

/** network-first：优先网络（拿到最新代码），失败回退缓存（离线可玩）。 */
async function networkFirst(request) {
    const cache = await caches.open(CORE_CACHE);
    try {
        const response = await fetch(request);
        if (response && response.ok) {
            cache.put(request, response.clone()).catch(() => {});
        }
        return response;
    } catch (err) {
        const cached = await cache.match(request);
        if (cached) return cached;
        return new Response('Service Worker network request failed and no cached response is available.', {
            status: 503,
            statusText: 'Service Unavailable',
            headers: { 'Content-Type': 'text/plain; charset=utf-8' },
        });
    }
}

self.addEventListener('fetch', (event) => {
    const { request } = event;

    // 只处理 GET
    if (request.method !== 'GET') return;

    const url = new URL(request.url);

    // 跨域请求（Tailwind CDN、Google Fonts 等）直接放行，不拦截
    if (url.origin !== self.location.origin) return;

    if (isAssetRequest(url)) {
        event.respondWith(cacheFirst(request));
        return;
    }

    // 导航请求、JS、HTML 等 → network-first
    if (request.mode === 'navigate' || url.pathname.endsWith('.js') || url.pathname.endsWith('.html')) {
        event.respondWith(networkFirst(request));
        return;
    }

    // 其余 same-origin 资源（如 favicon）→ cache-first 兜底，减少重复请求
    event.respondWith(cacheFirst(request));
});
