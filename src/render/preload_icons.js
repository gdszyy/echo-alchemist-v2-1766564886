/**
 * src/render/preload_icons.js — HUD/抽符/商店图标的预解码模块
 *
 * 职责：
 * - 在游戏启动时并行触发 AMMO/RUNE/RELIC 三张映射表中所有 PNG 的下载与解码
 * - 维护一个 src → HTMLImageElement 缓存，避免后续 <img> 元素首次出现时的 decode 抖动
 * - 失败不抛异常，单张图片失败不影响其他图标（fallback 仍可由调用方处理）
 *
 * 设计原则：
 * - 不暴露 Promise 等待 API：HUD/UI 层依然可以照常用 <img src=...>，
 *   浏览器 HTTP 缓存命中时会立即可用；而 decode 已经在启动时完成，
 *   首次实际渲染就不会再触发同步 decode。
 * - 总体积极小（~0.6 MB，<80 张）：一次性预加载收益 > 复杂度。
 *
 * @module render/preload_icons
 */

import { AMMO_ICON_MAP, RUNE_ICON_MAP, RELIC_ICON_MAP } from '../bitmap_icons.js';

/** 预解码后的图片缓存，src → HTMLImageElement（其它模块可读取，但 <img> 标签会自然命中 HTTP 缓存，无需手动接入）。 */
const _iconCache = new Map();

/**
 * 异步预热单张图片：触发下载 + decode，缓存到 _iconCache。
 * 静默失败（控制台 warn 一次），不影响后续调用方的 fallback 逻辑。
 * @param {string} src
 * @returns {Promise<void>}
 */
function _warmupIcon(src) {
    if (!src || _iconCache.has(src)) return Promise.resolve();
    return new Promise((resolve) => {
        const img = new Image();
        img.onload = async () => {
            try { if (img.decode) await img.decode(); } catch (_) { /* 忽略 decode 异常 */ }
            _iconCache.set(src, img);
            resolve();
        };
        img.onerror = () => {
            // 单张失败不阻塞整体预热流程
            console.warn(`[preload_icons] 图标加载失败，跳过: ${src}`);
            resolve();
        };
        img.src = src;
    });
}

/**
 * 预加载所有 HUD / 抽符 / 商店相关的图标。
 * 在游戏启动时调用一次，与 preloadAllSprites 并行触发，不阻塞主循环启动。
 * @returns {Promise<void>} 仅供测试场景 await，运行时无需等待
 */
export function preloadAllIcons() {
    const all = new Set();
    for (const map of [AMMO_ICON_MAP, RUNE_ICON_MAP, RELIC_ICON_MAP]) {
        for (const src of Object.values(map)) {
            if (src) all.add(src);
        }
    }
    const tasks = [];
    for (const src of all) tasks.push(_warmupIcon(src));
    const promise = Promise.all(tasks).then(() => {
        console.log(`[preload_icons] 预加载 ${_iconCache.size}/${all.size} 个图标`);
    });
    return promise;
}

/** 调试/测试用：返回当前已预热的图标数量。 */
export function getPreloadedIconCount() {
    return _iconCache.size;
}
