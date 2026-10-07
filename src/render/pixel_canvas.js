/**
 * src/render/pixel_canvas.js — 主画布像素风呈现管线（Canvas 2D）
 *
 * 像素模式下：
 * - 画布后备缓冲 = 低分辨率「美术像素」网格（约 targetWidth 宽），每个美术像素占整数个设备像素（k）；
 *   游戏逻辑坐标仍是 CSS 像素（game.width/height），每帧用 setTransform(sx, sy) 映射到缓冲，
 *   所以全部现有绘制代码（位图、矢量、粒子、文字）都落在同一张像素网格上，不会出现大小不一的像素。
 * - CSS `image-rendering: pixelated` 把缓冲按最近邻放大到屏幕（见 src/styles/pixel_theme.css）。
 * - 上下文补丁（只装在主画布这一个 ctx 实例上，位图模式不安装）：
 *   · drawImage：默认关闭平滑（最近邻）；只有按美术像素算缩小超过 1.6 倍时临时开平滑，避免下采样闪烁；
 *   · fillText / strokeText / measureText：改用像素字体（Fusion Pixel 12px，整数倍字号、落在整数像素上），
 *     描边改成 8 方向 1px 像素描边；
 *   · shadowBlur 恒为 0（模糊光晕与像素风冲突；发光改靠 'lighter' 叠加与色块）；
 *   · lineWidth 至少 1 个美术像素，细线不会糊成半透明。
 *
 * 方法依据：harness PSS pixel-art-production · pixel-perfect-web-presentation
 * （逻辑分辨率、关闭平滑、DPR 感知、整数倍吸附、pixelated 兜底）。
 * 规格：docs/design/pixel_art_mode.md
 * @module render/pixel_canvas
 */
import { artCanvasForSrc } from '../pixel/art_registry.js';
import { EMOJI_RE, emojiIconSpec } from '../pixel/art_registry_data.js';
import { getIcon } from '../pixel/icons.js';

const EMOJI_TEST = new RegExp(EMOJI_RE.source, 'u');

/** 把含 emoji 的文字拆成 [文字段 | 图标] 序列；没有可替换的 emoji 时返回 null */
function splitEmojiRuns(text) {
    if (!EMOJI_TEST.test(text)) return null;
    const runs = [];
    let last = 0;
    let any = false;
    EMOJI_RE.lastIndex = 0;
    let m;
    while ((m = EMOJI_RE.exec(text))) {
        const spec = emojiIconSpec(m[0]);
        if (!spec) continue;
        if (m.index > last) runs.push({ t: text.slice(last, m.index) });
        runs.push({ icon: getIcon(spec[0], spec[1]) });
        last = m.index + m[0].length;
        any = true;
    }
    if (!any) return null;
    if (last < text.length) runs.push({ t: text.slice(last) });
    return runs;
}

export const PIXEL_FONT_FAMILY = '"Fusion Pixel 12px Proportional SC"';
export const PIXEL_FONT_BASE_PX = 12;
/** 目标逻辑宽度（美术像素）。实际值按 DPR 取整到「每美术像素整数个设备像素」。 */
export const DEFAULT_PIXEL_TARGET_WIDTH = 288;
/** 非图片源（离屏 canvas 等）按美术像素算缩小超过该值时，drawImage 临时开启平滑。 */
const SMOOTH_DOWNSCALE_RATIO = 1.6;
/** 图片源缩小超过该值时走「精确贴合缓存」（见 fitToBuffer）。 */
const FIT_DOWNSCALE_RATIO = 1.04;
const FIT_CACHE_MAX = 384;

let _fontReady = false;
let _fontPromise = null;

/** 预加载像素字体；就绪前文字补丁回落到原生 fillText。 */
export function loadPixelFont() {
    if (_fontPromise) return _fontPromise;
    if (typeof document === 'undefined' || !document.fonts || !document.fonts.load) {
        _fontPromise = Promise.resolve(false);
        return _fontPromise;
    }
    _fontPromise = document.fonts.load(`${PIXEL_FONT_BASE_PX}px ${PIXEL_FONT_FAMILY}`, '0Aa回')
        .then((faces) => {
            _fontReady = Array.isArray(faces) && faces.length > 0;
            return _fontReady;
        })
        .catch(() => false);
    return _fontPromise;
}

export function isPixelFontReady() {
    return _fontReady;
}

/**
 * 计算像素布局。
 * @param {number} cssW 画布 CSS 宽
 * @param {number} cssH 画布 CSS 高
 * @param {number} dpr devicePixelRatio
 * @param {number} [targetWidth] 目标美术像素宽
 * @returns {{k:number, bufW:number, bufH:number, sx:number, sy:number, cssPerArtPx:number}}
 */
export function computePixelLayout(cssW, cssH, dpr = 1, targetWidth = DEFAULT_PIXEL_TARGET_WIDTH) {
    const w = Math.max(1, cssW);
    const h = Math.max(1, cssH);
    const d = dpr > 0 ? dpr : 1;
    const tw = Math.max(64, targetWidth || DEFAULT_PIXEL_TARGET_WIDTH);
    // 每个美术像素占 k 个设备像素（整数），让最近邻放大后每个像素一样大
    const k = Math.max(1, Math.round((w * d) / tw));
    const bufW = Math.max(1, Math.round((w * d) / k));
    const bufH = Math.max(1, Math.round((h * d) / k));
    return { k, bufW, bufH, sx: bufW / w, sy: bufH / h, cssPerArtPx: k / d };
}

/** 读取目标宽度：URL ?pxw= 便于调参，其余走默认。 */
export function readPixelTargetWidth() {
    try {
        const v = parseInt(new URLSearchParams(location.search).get('pxw'), 10);
        if (Number.isFinite(v) && v >= 120 && v <= 960) return v;
    } catch (_) { /* non-browser */ }
    return DEFAULT_PIXEL_TARGET_WIDTH;
}

/** 每帧开头：把逻辑坐标映射到美术像素缓冲，并关闭平滑。 */
export function beginPixelFrame(ctx, layout) {
    if (!ctx || !layout) return;
    ctx.setTransform(layout.sx, 0, 0, layout.sy, 0, 0);
    ctx.imageSmoothingEnabled = false;
    ctx.__pxSmooth = false;
}

/** 把逻辑坐标吸附到美术像素格（用于屏幕震动等整体位移）。 */
export function snapToArtPixel(v, scale) {
    if (!scale) return v;
    return Math.round(v * scale) / scale;
}

// ─── 精确贴合缓存 ────────────────────────────────────────────
//
// 像素模式的图标都来自 src/pixel/art_registry.js（程序化像素图，导出时整数放大成 data URL）。
// drawImage 遇到这种图片时换回美术分辨率的小画布直接最近邻绘制，不经过平滑缩放。
// 其余图片源（理论上像素模式已没有旧位图；兜底）大幅缩小时先按缓冲像素精确重采样一份再 1:1 绘制，
// 避免最近邻缩小随机丢行。

let _fitCount = 0;
const _fitLru = new Map(); // `${id}|...` -> true（只记录顺序，用于淘汰）
let _imgIdSeq = 0;

function makeCanvas(w, h) {
    if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(w, h);
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    return c;
}

/**
 * 取（或生成）某张图某个源矩形在缓冲里 dwB×dhB 尺寸下的贴合版本。
 * @returns {HTMLCanvasElement|OffscreenCanvas|null}
 */
function fitToBuffer(img, sx, sy, sw, sh, dwB, dhB) {
    if (!img.__pxFitId) {
        try { img.__pxFitId = ++_imgIdSeq; img.__pxFit = new Map(); } catch (_) { return null; }
    }
    const key = `${sx},${sy},${sw},${sh},${dwB},${dhB}`;
    const lruKey = `${img.__pxFitId}|${key}`;
    let out = img.__pxFit.get(key);
    if (out) {
        _fitLru.delete(lruKey);
        _fitLru.set(lruKey, img);
        return out;
    }
    out = makeCanvas(dwB, dhB);
    const g = out.getContext('2d');
    g.imageSmoothingEnabled = true;
    g.imageSmoothingQuality = 'high';
    g.drawImage(img, sx, sy, sw, sh, 0, 0, dwB, dhB);
    img.__pxFit.set(key, out);
    _fitLru.set(lruKey, img);
    _fitCount++;
    while (_fitLru.size > FIT_CACHE_MAX) {
        const [oldKey, oldImg] = _fitLru.entries().next().value;
        _fitLru.delete(oldKey);
        if (oldImg && oldImg.__pxFit) oldImg.__pxFit.delete(oldKey.slice(oldKey.indexOf('|') + 1));
    }
    return out;
}

/** 调试用：贴合缓存统计 */
export function getPixelFitStats() {
    return { entries: _fitLru.size, created: _fitCount };
}

// ─── 上下文补丁 ──────────────────────────────────────────────

const _fontPxCache = new Map();

function fontPx(font) {
    let px = _fontPxCache.get(font);
    if (px === undefined) {
        const m = /(\d+(?:\.\d+)?)px/.exec(font || '');
        px = m ? parseFloat(m[1]) : 10;
        if (_fontPxCache.size > 256) _fontPxCache.clear();
        _fontPxCache.set(font, px);
    }
    return px;
}

/** 目标字号（缓冲像素）→ 像素字体整数倍字号 */
function pixelFontSizeFor(bufferPx) {
    return PIXEL_FONT_BASE_PX * Math.max(1, Math.round(bufferPx / PIXEL_FONT_BASE_PX));
}

// @perf-impact: 像素模式主画布每次 drawImage/fillText 多一次 getTransform；程序化图标按 Map 查回美术分辨率画布直接绘制；其余图片缩小走精确贴合缓存（LRU 384），之后 1:1 绘制；shadowBlur 恒为 0。缓冲仅约 287×509，填充率约为原 1/9。
/**
 * 给主画布 ctx 安装像素模式补丁。只调用一次；返回补丁信息。
 * @param {CanvasRenderingContext2D} ctx
 * @param {() => ({sx:number, sy:number}|null)} getLayout 返回当前像素布局
 */
export function installPixelContextPatches(ctx, getLayout) {
    if (!ctx || ctx.__pixelPatched) return false;
    const proto = Object.getPrototypeOf(ctx);
    const nativeDrawImage = proto.drawImage;
    const nativeFillText = proto.fillText;
    const nativeMeasureText = proto.measureText;
    const lineWidthDesc = Object.getOwnPropertyDescriptor(proto, 'lineWidth');

    const setSmooth = (c, smooth) => {
        if (smooth !== c.__pxSmooth) {
            c.imageSmoothingEnabled = smooth;
            if (smooth) c.imageSmoothingQuality = 'medium';
            c.__pxSmooth = smooth;
        }
    };

    // drawImage：图片源缩小时走精确贴合缓存；放大或等大时最近邻；离屏 canvas 大幅缩小时临时开平滑
    ctx.drawImage = function pixelDrawImage(img, a1, a2, a3, a4, a5, a6, a7, a8) {
        const n = arguments.length;
        const layout = getLayout();
        if (!layout || !img) return nativeDrawImage.apply(this, arguments);
        let sx = 0;
        let sy = 0;
        let sw;
        let sh;
        let dx;
        let dy;
        let dw;
        let dh;
        if (n >= 9) {
            sx = a1; sy = a2; sw = a3; sh = a4; dx = a5; dy = a6; dw = a7; dh = a8;
        } else {
            sw = img.naturalWidth || img.width;
            sh = img.naturalHeight || img.height;
            dx = a1; dy = a2;
            dw = n >= 5 ? a3 : sw;
            dh = n >= 5 ? a4 : sh;
        }
        if (!(sw > 0) || !(sh > 0) || !dw || !dh) return nativeDrawImage.apply(this, arguments);

        const isImg = img.tagName === 'IMG';
        if (isImg) {
            // 程序化图标：换回美术分辨率画布，源矩形按放大倍数折回
            const art = artCanvasForSrc(img.currentSrc || img.src);
            if (art) {
                const k = (img.naturalWidth || art.width) / art.width;
                setSmooth(this, false);
                return nativeDrawImage.call(this, art, sx / k, sy / k, sw / k, sh / k, dx, dy, dw, dh);
            }
        }
        if (isImg && img.complete && img.naturalWidth > 0) {
            const m = this.getTransform();
            const scale = Math.hypot(m.a, m.b);
            const dwB = Math.round(Math.abs(dw) * scale);
            const dhB = Math.round(Math.abs(dh) * Math.hypot(m.c, m.d));
            const ratio = sw / Math.max(1, dwB);
            if (dwB >= 1 && dhB >= 1 && ratio > FIT_DOWNSCALE_RATIO && dwB * dhB <= 1 << 20) {
                const fit = fitToBuffer(img, Math.round(sx), Math.round(sy), Math.round(sw), Math.round(sh), dwB, dhB);
                if (fit) {
                    setSmooth(this, false);
                    // 无旋转时把左上角吸附到整缓冲像素，保证 1:1 映射
                    if (m.b === 0 && m.c === 0 && m.a !== 0 && m.d !== 0) {
                        const bx = Math.round(m.a * dx + m.e);
                        const by = Math.round(m.d * dy + m.f);
                        dx = (bx - m.e) / m.a;
                        dy = (by - m.f) / m.d;
                    }
                    return nativeDrawImage.call(this, fit, 0, 0, dwB, dhB, dx, dy, dw, dh);
                }
            }
            setSmooth(this, false);
            return nativeDrawImage.apply(this, arguments);
        }
        // 离屏 canvas / ImageBitmap：内容可能每帧变化，不缓存；大幅缩小时临时开平滑防闪烁
        const mt = this.getTransform();
        const ratio = sw / Math.max(1e-6, Math.abs(dw) * (Math.hypot(mt.a, mt.b) || layout.sx));
        setSmooth(this, ratio > SMOOTH_DOWNSCALE_RATIO);
        return nativeDrawImage.apply(this, arguments);
    };

    // 模糊阴影恒为 0
    Object.defineProperty(ctx, 'shadowBlur', {
        configurable: true,
        get() { return 0; },
        set(_) { /* pixel mode: no blur */ },
    });

    // 线宽至少 1 个美术像素
    if (lineWidthDesc && lineWidthDesc.set) {
        Object.defineProperty(ctx, 'lineWidth', {
            configurable: true,
            get() { return lineWidthDesc.get.call(this); },
            set(v) {
                const layout = getLayout();
                const min = layout ? 1 / layout.sx : 0;
                lineWidthDesc.set.call(this, Number.isFinite(v) ? Math.max(v, min) : v);
            },
        });
    }

    // 像素字体：整数倍字号 + 整数像素位置
    const drawPixelText = (c, text, x, y, maxWidth, outline) => {
        const m = c.getTransform();
        const scale = Math.hypot(m.a, m.b) || 1;
        const size = pixelFontSizeFor(fontPx(c.font) * scale);
        const bx = Math.round(m.a * x + m.c * y + m.e);
        const by = Math.round(m.b * x + m.d * y + m.f);
        const mw = maxWidth != null && Number.isFinite(maxWidth) ? Math.max(1, Math.round(maxWidth * scale)) : undefined;
        c.save();
        c.setTransform(1, 0, 0, 1, 0, 0);
        c.font = `${size}px ${PIXEL_FONT_FAMILY}`;
        const runs = typeof text === 'string' ? splitEmojiRuns(text) : null;
        if (runs) {
            // 彩色 emoji → 7×7 点阵图标（整数倍，随字号），与文字同一条基线排开
            const k = Math.max(1, Math.round(size / PIXEL_FONT_BASE_PX));
            const iw = 9 * k;
            const widths = runs.map((r) => (r.icon ? iw + k : nativeMeasureText.call(c, r.t).width));
            const total = widths.reduce((a, b) => a + b, 0);
            const align = c.textAlign;
            let cx = bx - (align === 'center' ? total / 2 : (align === 'right' || align === 'end') ? total : 0);
            const base = c.textBaseline;
            const iy = by - (base === 'middle' ? iw / 2 : (base === 'top' || base === 'hanging') ? 0 : iw);
            c.textAlign = 'left';
            const prevSmooth = c.imageSmoothingEnabled;
            c.imageSmoothingEnabled = false;
            runs.forEach((r, i) => {
                const x0 = Math.round(cx);
                if (r.icon) {
                    nativeDrawImage.call(c, r.icon, x0, Math.round(iy), iw, iw);
                } else if (outline) {
                    const t = Math.max(1, Math.round(outline * scale / 2));
                    const fill = c.fillStyle;
                    c.fillStyle = c.strokeStyle;
                    for (let dy = -t; dy <= t; dy++) for (let dx = -t; dx <= t; dx++) if (dx || dy) nativeFillText.call(c, r.t, x0 + dx, by + dy);
                    c.fillStyle = fill;
                } else {
                    nativeFillText.call(c, r.t, x0, by);
                }
                cx += widths[i];
            });
            c.imageSmoothingEnabled = prevSmooth;
            c.restore();
            return;
        }
        if (outline) {
            const t = Math.max(1, Math.round(outline * scale / 2));
            c.fillStyle = c.strokeStyle;
            for (let dy = -t; dy <= t; dy++) {
                for (let dx = -t; dx <= t; dx++) {
                    if (dx === 0 && dy === 0) continue;
                    if (mw !== undefined) nativeFillText.call(c, text, bx + dx, by + dy, mw);
                    else nativeFillText.call(c, text, bx + dx, by + dy);
                }
            }
        } else if (mw !== undefined) {
            nativeFillText.call(c, text, bx, by, mw);
        } else {
            nativeFillText.call(c, text, bx, by);
        }
        c.restore();
    };

    ctx.fillText = function pixelFillText(text, x, y, maxWidth) {
        if (!_fontReady) return nativeFillText.apply(this, arguments);
        drawPixelText(this, text, x, y, maxWidth, 0);
    };
    ctx.strokeText = function pixelStrokeText(text, x, y, maxWidth) {
        if (!_fontReady) return proto.strokeText.apply(this, arguments);
        drawPixelText(this, text, x, y, maxWidth, Math.max(1, this.lineWidth || 1));
    };
    ctx.measureText = function pixelMeasureText(text) {
        if (!_fontReady) return nativeMeasureText.call(this, text);
        const m = this.getTransform();
        const scale = Math.hypot(m.a, m.b) || 1;
        const size = pixelFontSizeFor(fontPx(this.font) * scale);
        const saved = this.font;
        this.font = `${size}px ${PIXEL_FONT_FAMILY}`;
        const tm = nativeMeasureText.call(this, text);
        this.font = saved;
        const k = 1 / scale;
        return {
            width: tm.width * k,
            actualBoundingBoxLeft: tm.actualBoundingBoxLeft * k,
            actualBoundingBoxRight: tm.actualBoundingBoxRight * k,
            actualBoundingBoxAscent: tm.actualBoundingBoxAscent * k,
            actualBoundingBoxDescent: tm.actualBoundingBoxDescent * k,
            fontBoundingBoxAscent: (tm.fontBoundingBoxAscent || 0) * k,
            fontBoundingBoxDescent: (tm.fontBoundingBoxDescent || 0) * k,
        };
    };

    ctx.__pixelPatched = true;
    return true;
}
