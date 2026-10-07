/**
 * src/render/art_boot.js — 美术模式启动钩子
 *
 * index.html 的入口模块必须先 import 本文件、再 import core.js：ES 模块按 import 顺序求值，
 * 这样像素模式的图标解析（img.src setter + <img> 属性观察）在任何模块创建 Image 之前就位。
 *
 * 像素模式下：
 * 1. 注册图标解析器：旧位图路径 → 程序化像素图（src/pixel/art_registry.js）；
 * 2. 为样式表引用的图标设置 --pxa-<slug> 变量（src/styles/pixel_assets.css 引用它们；框体类保持 none）；
 * 3. 界面文字里的彩色 emoji 换成像素图标（src/pixel/emoji_icons.js）。
 * @module render/art_boot
 */
import { installArtSrcShims, isPixelArtMode, setArtSrcResolver } from './art_mode.js';
import { artUrlForPath } from '../pixel/art_registry.js';
import { installEmojiIcons } from '../pixel/emoji_icons.js';
import { PIXEL_CSS_ART_PATHS, pixelCssVarName } from '../data/pixel_css_art_paths.js';

if (isPixelArtMode()) {
    setArtSrcResolver(artUrlForPath);
    try {
        const style = document.documentElement.style;
        for (const rel of PIXEL_CSS_ART_PATHS) {
            const url = artUrlForPath(`assets/${rel}`);
            if (url) style.setProperty(pixelCssVarName(rel), `url("${url}")`);
        }
    } catch (_) { /* non-browser */ }
    if (typeof document !== 'undefined') {
        if (document.body) installEmojiIcons(document.body);
        else document.addEventListener('DOMContentLoaded', () => installEmojiIcons(document.body), { once: true });
    }
}
installArtSrcShims();
