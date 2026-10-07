/**
 * src/pixel/emoji_icons.js — 像素模式：界面文字里的彩色 emoji → 像素点阵图标
 *
 * 旧 UI 用系统彩色 emoji 当图标（遗物、技能、词条、商店、按钮），与像素画是两种画法、两种光照。
 * 像素模式下观察 DOM 文本，把 emoji 换成 <img class="px-emoji">（程序化 7×7 图标，见
 * art_registry_data.js EMOJI_ICON）。「emoji + 词条名 / 属性名」时用该词条 / 属性自己的图标，
 * 这样菜单与战场读数是同一个图标。
 *
 * 不处理：隐藏的旧 DOM HUD（像素模式由画布绘制）、可编辑控件、<option>、data-no-px-emoji 子树。
 * 文本被游戏重新写入时会再次处理（MutationObserver）。
 * @module pixel/emoji_icons
 */
import { EMOJI_RE, emojiIconSpec } from './art_registry_data.js';
import { AFFIX_STYLE, ATTRIBUTE_STYLE } from './icons.js';
import { emojiArt, namedGlyphArt } from './art_registry.js';

const SKIP_TAGS = new Set(['SCRIPT', 'STYLE', 'TEXTAREA', 'INPUT', 'OPTION', 'SELECT', 'CANVAS', 'NOSCRIPT']);
// 像素模式下隐藏的旧 HUD（画布已绘制同样的信息），不必处理
const SKIP_IDS = new Set(['unified-top-bar', 'run-shop-status-dock', 'combat-bottom-dock', 'combat-message', 'hero-gauge-container', 'px-hud-hotspots']);

const NAMED = [
    ...Object.values(AFFIX_STYLE).map((s) => [s.name, s.icon, s.ramp]),
    ...Object.values(ATTRIBUTE_STYLE).map((s) => [s.name, s.icon, s.ramp]),
].sort((a, b) => b[0].length - a[0].length);

function namedAfter(text, from) {
    const rest = text.slice(from).replace(/^\s+/, '');
    if (!rest) return null;
    for (const [name, icon, ramp] of NAMED) {
        if (rest.startsWith(name)) return namedGlyphArt(icon, ramp);
    }
    return null;
}

function skipped(node) {
    for (let el = node.nodeType === 1 ? node : node.parentElement; el; el = el.parentElement) {
        if (SKIP_TAGS.has(el.tagName) || el.isContentEditable) return true;
        if (el.id && SKIP_IDS.has(el.id)) return true;
        if (el.hasAttribute && el.hasAttribute('data-no-px-emoji')) return true;
    }
    return false;
}

const TEST_RE = new RegExp(EMOJI_RE.source, 'u');

function replaceInTextNode(tn) {
    const text = tn.nodeValue;
    if (!text || !TEST_RE.test(text)) return;
    const parent = tn.parentNode;
    if (!parent || skipped(tn)) return;
    const frag = document.createDocumentFragment();
    let last = 0;
    let changed = false;
    // 模板可在父元素上指定语义图标（data-px-icon="字形:色阶"），例如局内碎片 = shard:fire
    const forced = parent.nodeType === 1 && parent.dataset && parent.dataset.pxIcon ? parent.dataset.pxIcon.split(':') : null;
    EMOJI_RE.lastIndex = 0;
    let m;
    while ((m = EMOJI_RE.exec(text))) {
        const seq = m[0];
        const end = m.index + seq.length;
        const art = forced
            ? namedGlyphArt(forced[0], forced[1] || 'slate')
            : ((emojiIconSpec(seq) && (namedAfter(text, end) || emojiArt(seq))) || null);
        if (!art) continue;
        if (m.index > last) frag.appendChild(document.createTextNode(text.slice(last, m.index)));
        const img = document.createElement('img');
        img.className = 'px-emoji';
        img.src = art.url;
        img.alt = '';
        img.setAttribute('aria-hidden', 'true');
        img.draggable = false;
        frag.appendChild(img);
        last = end;
        changed = true;
    }
    if (!changed) return;
    if (last < text.length) frag.appendChild(document.createTextNode(text.slice(last)));
    parent.replaceChild(frag, tn);
}

function walk(root) {
    if (!root) return;
    if (root.nodeType === 3) { replaceInTextNode(root); return; }
    if (root.nodeType !== 1 || skipped(root)) return;
    const tw = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const list = [];
    for (let n = tw.nextNode(); n; n = tw.nextNode()) if (TEST_RE.test(n.nodeValue)) list.push(n);
    list.forEach(replaceInTextNode);
}

let _installed = false;

// @perf-impact: 只在 DOM 文本变化时运行；先用正则快速判定有无 emoji，隐藏的旧 HUD 子树直接跳过。
/** 像素模式启动时调用一次 */
export function installEmojiIcons(root = document.body) {
    if (_installed || !root || typeof MutationObserver === 'undefined') return false;
    _installed = true;
    walk(root);
    const mo = new MutationObserver((records) => {
        for (const r of records) {
            if (r.type === 'characterData') replaceInTextNode(r.target);
            else for (const n of r.addedNodes) walk(n);
        }
    });
    mo.observe(root, { subtree: true, childList: true, characterData: true });
    return true;
}

/** 字符串里是否含有会被替换的 emoji（画布文字用） */
export function hasMappedEmoji(text) {
    if (!text || !TEST_RE.test(text)) return false;
    EMOJI_RE.lastIndex = 0;
    let m;
    while ((m = EMOJI_RE.exec(text))) if (emojiIconSpec(m[0])) return true;
    return false;
}
