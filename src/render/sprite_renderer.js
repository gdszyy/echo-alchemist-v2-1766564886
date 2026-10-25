/**
 * src/render/sprite_renderer.js — Sprite Sheet 动画渲染器
 *
 * 职责：
 * - 加载 Sprite Sheet PNG + JSON 元数据
 * - 管理动画状态（当前动画、帧索引、帧计时）
 * - 提供 draw(ctx, x, y, w, h) 接口，在 ctx.save/restore 块内安全调用
 * - 无资源时 fallback 到矢量绘制（不阻断游戏运行）
 *
 * 使用方式：
 *   const sr = new SpriteRenderer('assets/sprites/enemies/golem_normal.png');
 *   sr.play('idle');
 *   sr.update(deltaTime);
 *   sr.draw(ctx, -w/2, -h/2, w, h);
 *
 * Sprite Sheet 格式约定：
 *   - 每行一个动画状态
 *   - 每列一帧（帧宽 = frameSize，帧高 = frameSize）
 *   - JSON 元数据格式：{ frameSize, animations: { [name]: { row, frames, fps } } }
 *
 * [Phase 5B Task 5.B2]
 * @module render/sprite_renderer
 */

// ─── 全局图片缓存（避免重复加载同一张 Sprite Sheet）───────────────────────
const _imageCache = new Map();   // path → HTMLImageElement
const _metaCache  = new Map();   // path → metadata JSON

/**
 * 异步加载图片，返回 Promise<HTMLImageElement>
 * @param {string} src
 * @returns {Promise<HTMLImageElement>}
 */
function _loadImage(src) {
    if (_imageCache.has(src)) return Promise.resolve(_imageCache.get(src));
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload  = () => { _imageCache.set(src, img); resolve(img); };
        img.onerror = () => reject(new Error(`SpriteRenderer: 图片加载失败 → ${src}`));
        img.src = src;
    });
}

/**
 * 异步加载 JSON 元数据
 * @param {string} src
 * @returns {Promise<object>}
 */
async function _loadMeta(src) {
    if (_metaCache.has(src)) return _metaCache.get(src);
    const res = await fetch(src);
    if (!res.ok) throw new Error(`SpriteRenderer: JSON 加载失败 → ${src}`);
    const data = await res.json();
    _metaCache.set(src, data);
    return data;
}

// ─── SpriteRenderer 类 ────────────────────────────────────────────────────

export class SpriteRenderer {
    /**
     * @param {string} sheetPath  - Sprite Sheet PNG 路径（相对于根目录）
     * @param {string} [metaPath] - JSON 元数据路径（默认与 sheetPath 同名，扩展名 .json）
     */
    constructor(sheetPath, metaPath) {
        this.sheetPath = sheetPath;
        this.metaPath  = metaPath || sheetPath.replace(/\.png$/i, '.json');

        /** @type {HTMLImageElement|null} 已加载的 Sprite Sheet 图片 */
        this._image = null;
        /** @type {object|null} 已加载的元数据 */
        this._meta  = null;
        /** @type {boolean} 是否已准备好绘制 */
        this.ready  = false;
        /** @type {boolean} 加载是否失败（fallback 模式） */
        this.failed = false;

        // 动画状态
        this._currentAnim = 'idle';
        this._frameIndex  = 0;
        this._elapsed     = 0;   // 当前帧已累计时间（秒）
        this._loop        = true;
        this._onEnd       = null; // 动画结束回调

        // 开始异步加载
        this._load();
    }

    // ─── 加载 ──────────────────────────────────────────────────────────────

    async _load() {
        try {
            const [img, meta] = await Promise.all([
                _loadImage(this.sheetPath),
                _loadMeta(this.metaPath),
            ]);
            this._image = img;
            this._meta  = meta;
            this.ready  = true;
        } catch (e) {
            console.warn(`[SpriteRenderer] 加载失败，启用 fallback 矢量绘制: ${e.message}`);
            this.failed = true;
        }
    }

    // ─── 静态工厂（预加载缓存）──────────────────────────────────────────────

    /**
     * 预加载 Sprite Sheet（在游戏启动时批量调用，避免首帧卡顿）
     * @param {string} sheetPath
     * @param {string} [metaPath]
     * @returns {SpriteRenderer}
     */
    static preload(sheetPath, metaPath) {
        return new SpriteRenderer(sheetPath, metaPath);
    }

    // ─── 动画控制 ──────────────────────────────────────────────────────────

    /**
     * 播放指定动画
     * @param {string} name     - 动画名称（对应 JSON 中的 animations key）
     * @param {object} [opts]   - 选项
     * @param {boolean} [opts.loop=true]  - 是否循环
     * @param {Function} [opts.onEnd]     - 动画结束回调（非循环时触发）
     * @param {boolean} [opts.restart=false] - 即使当前已是该动画也重置帧
     */
    play(name, opts = {}) {
        if (!this._meta) return;
        if (!this._meta.animations[name]) {
            console.warn(`[SpriteRenderer] 未知动画: ${name}`);
            return;
        }
        const restart = opts.restart || false;
        if (this._currentAnim === name && !restart) return;

        this._currentAnim = name;
        this._frameIndex  = 0;
        this._elapsed     = 0;
        this._loop        = opts.loop !== undefined ? opts.loop : true;
        this._onEnd       = opts.onEnd || null;
    }

    /**
     * 更新动画帧（每帧调用）
     * @param {number} dt - 上一帧到本帧的时间差（秒）
     */
    update(dt) {
        if (!this.ready || !this._meta) return;
        const anim = this._meta.animations[this._currentAnim];
        if (!anim) return;

        const frameDuration = 1 / (anim.fps || 8);
        this._elapsed += dt;

        while (this._elapsed >= frameDuration) {
            this._elapsed -= frameDuration;
            this._frameIndex++;
            if (this._frameIndex >= anim.frames) {
                if (this._loop) {
                    this._frameIndex = 0;
                } else {
                    this._frameIndex = anim.frames - 1;
                    if (this._onEnd) {
                        this._onEnd();
                        this._onEnd = null;
                    }
                }
            }
        }
    }

    // ─── 绘制 ──────────────────────────────────────────────────────────────

    /**
     * 在 Canvas 上绘制当前帧
     * 必须在 ctx.save() / ctx.restore() 块内调用，且坐标系已平移到实体中心。
     *
     * @param {CanvasRenderingContext2D} ctx
     * @param {number} x   - 绘制左上角 X（相对于实体中心，通常为 -w/2）
     * @param {number} y   - 绘制左上角 Y（相对于实体中心，通常为 -h/2）
     * @param {number} w   - 绘制宽度
     * @param {number} h   - 绘制高度
     * @param {number} [alpha=1] - 透明度（0~1）
     * @returns {boolean} 是否成功绘制位图（false = 使用了 fallback）
     */
    draw(ctx, x, y, w, h, alpha = 1) {
        if (!this.ready || !this._image || !this._meta) return false;

        const anim = this._meta.animations[this._currentAnim];
        if (!anim) return false;

        // 支持矩形帧：优先使用 manifest 顶层 frameWidth/frameHeight，
        // 其次使用 anim.frameWidth/frameHeight，最后回退到正方形 frameSize（默认 128）。
        const fs = this._meta.frameSize || 128;
        const fw = anim.frameWidth  || this._meta.frameWidth  || fs;
        const fh = anim.frameHeight || this._meta.frameHeight || fs;
        const srcX = this._frameIndex * fw;
        const srcY = anim.row * fh;

        const prevAlpha = ctx.globalAlpha;
        ctx.globalAlpha = prevAlpha * alpha;

        try {
            ctx.drawImage(
                this._image,
                srcX, srcY, fw, fh,   // 源矩形（Sprite Sheet 上的帧）
                x,    y,   w,  h      // 目标矩形（Canvas 上的绘制区域）
            );
        } catch (e) {
            console.warn('[SpriteRenderer] drawImage 失败:', e);
            ctx.globalAlpha = prevAlpha;
            return false;
        }

        ctx.globalAlpha = prevAlpha;
        return true;
    }

    /**
     * Draw a normalized source region from the current frame.
     *
     * @param {CanvasRenderingContext2D} ctx
     * @param {number} srcXRatio 0..1 source X inside the current frame
     * @param {number} srcYRatio 0..1 source Y inside the current frame
     * @param {number} srcWRatio 0..1 source width inside the current frame
     * @param {number} srcHRatio 0..1 source height inside the current frame
     * @param {number} x Destination X
     * @param {number} y Destination Y
     * @param {number} w Destination width
     * @param {number} h Destination height
     * @param {number} [alpha=1] 0..1 alpha multiplier
     * @returns {boolean} 是否成功绘制位图（false = 使用了 fallback）
     */
    // @perf-impact: Region drawing reuses the cached current frame and adds only caller-controlled drawImage calls; it creates no particles, gradients, shadowBlur, or new budget fields.
    drawRegion(ctx, srcXRatio, srcYRatio, srcWRatio, srcHRatio, x, y, w, h, alpha = 1) {
        if (!this.ready || !this._image || !this._meta) return false;

        const anim = this._meta.animations[this._currentAnim];
        if (!anim) return false;

        const fs = this._meta.frameSize || 128;
        const fw = anim.frameWidth  || this._meta.frameWidth  || fs;
        const fh = anim.frameHeight || this._meta.frameHeight || fs;
        const frameX = this._frameIndex * fw;
        const frameY = anim.row * fh;

        const rx = Math.max(0, Math.min(1, srcXRatio || 0));
        const ry = Math.max(0, Math.min(1, srcYRatio || 0));
        const rw = Math.max(0, Math.min(1 - rx, srcWRatio || 0));
        const rh = Math.max(0, Math.min(1 - ry, srcHRatio || 0));
        if (rw <= 0 || rh <= 0 || w <= 0 || h <= 0) return false;

        const prevAlpha = ctx.globalAlpha;
        ctx.globalAlpha = prevAlpha * alpha;

        try {
            ctx.drawImage(
                this._image,
                frameX + rx * fw, frameY + ry * fh, rw * fw, rh * fh,
                x, y, w, h
            );
        } catch (e) {
            console.warn('[SpriteRenderer] drawRegion drawImage 失败:', e);
            ctx.globalAlpha = prevAlpha;
            return false;
        }

        ctx.globalAlpha = prevAlpha;
        return true;
    }

    // ─── 查询 ──────────────────────────────────────────────────────────────

    /** 当前动画名称 */
    get currentAnim() { return this._currentAnim; }

    /** 当前帧索引 */
    get frameIndex() { return this._frameIndex; }

    /** 当前动画帧尺寸（用于 Boss 3:2 重绘资产按占格比例绘制） */
    getCurrentFrameDimensions() {
        if (!this._meta) return null;
        const anim = this._meta.animations && this._meta.animations[this._currentAnim];
        if (!anim) return null;
        const fs = this._meta.frameSize || 128;
        return {
            width: anim.frameWidth || this._meta.frameWidth || fs,
            height: anim.frameHeight || this._meta.frameHeight || fs
        };
    }

    /** 当前动画帧宽高比。旧 256 方形 Boss 资源返回 1，新 384x256 重绘资源返回 1.5。 */
    getCurrentFrameAspect() {
        const dims = this.getCurrentFrameDimensions();
        return dims && dims.height > 0 ? dims.width / dims.height : 1;
    }

    /** 是否有指定动画 */
    hasAnim(name) {
        return !!(this._meta && this._meta.animations[name]);
    }
}

// ─── 像素 sheet 渲染器（pixel-sheet@1）────────────────────────────────────
/**
 * PixelSheetSpriteRenderer — 用 `assets/pixel/enemies/*` 的原生像素 sheet 绘制敌人。
 *
 * 与旧 SpriteRenderer 的差别：
 *   - 帧矩形直接来自 sheet JSON 的 `frames[name] = {x,y,w,h}`，
 *     不是「frameIndex * frameWidth + row * frameHeight」的等宽网格假设。
 *   - 绘制尺寸按 sheet 的 `collision_mapping` 口径等比适配：
 *     画布长宽比 = (cols*26-2) : (rows*26-2)，等比居中放到调用方给的框里。
 *   - 像素美术强制关闭插值（imageSmoothingEnabled=false），避免糊化。
 *
 * 接口与 SpriteRenderer 对齐（ready/failed/play/update/draw/hasAnim），
 * 使 enemy.js 的绘制点无需区分实现；像素 sheet 不可用时自动回退旧位图渲染器。
 */
export class PixelSheetSpriteRenderer {
    /**
     * @param {{archetype:string, stem:string, jsonPath:string, pngPath:string, cols:number, rows:number}} descriptor
     * @param {() => (SpriteRenderer|null)} [legacyFactory] 旧位图链路的构造器（失败时回退用）
     */
    constructor(descriptor, legacyFactory) {
        this.descriptor  = descriptor || null;
        this.archetype   = descriptor ? descriptor.archetype : null;
        this.stem        = descriptor ? descriptor.stem : null;
        this.sheetPath   = descriptor ? descriptor.pngPath : null;
        this.metaPath    = descriptor ? descriptor.jsonPath : null;

        this._meta       = null;
        this._image      = null;
        this._canvasSize = null;
        this._ready      = false;
        this._failed     = false;
        this._delegate   = null;
        this._legacyFactory = typeof legacyFactory === 'function' ? legacyFactory : null;

        this._state        = { hpRatio: 1, hit: false, frozen: false, burning: false, death: false };
        this._requestedAnim = 'idle';
        this._frameName    = null;
        this._idleAlt      = 0;
        this._elapsed      = 0;

        this._load();
    }

    /** 像素 sheet 渲染器标记（enemy.js 据此走像素口径的绘制分支；已回退时返回 false） */
    get isPixelSheet() { return !this._delegate; }

    get ready()  { return this._delegate ? !!this._delegate.ready : this._ready; }
    get failed() { return this._delegate ? !!this._delegate.failed : this._failed; }
    get currentAnim() { return this._delegate ? this._delegate.currentAnim : this._requestedAnim; }
    /** 当前帧名（取证/调试用） */
    get frameName() { return this._frameName; }
    /** 当前帧源矩形（取证/调试用） */
    get frameRect() { return getFrameRect(this._meta, this._frameName); }

    async _load() {
        if (!this.descriptor) { this._fallback('descriptor 缺失'); return; }
        try {
            const meta = await loadPixelSheet(this.stem);
            if (!meta) { this._fallback('sheet 元数据不可用'); return; }
            const size = getSheetCanvasSize(meta);
            if (!size) { this._fallback('画布尺寸不可解'); return; }
            const img = await _loadImage(this.sheetPath);
            this._meta       = meta;
            this._canvasSize = size;
            this._image      = img;
            this._frameName  = this._resolveFrameName();
            this._ready      = true;
        } catch (e) {
            this._fallback(e && e.message ? e.message : '未知加载失败');
        }
    }

    _fallback(reason) {
        if (this._delegate) return;
        console.warn(`[PixelSheet] ${this.stem || '?'} 像素 sheet 不可用（${reason}），回退旧位图链路`);
        if (this._legacyFactory) {
            try {
                const legacy = this._legacyFactory();
                if (legacy) { this._delegate = legacy; return; }
            } catch (e) {
                console.warn(`[PixelSheet] 旧链路回退构造失败: ${e && e.message}`);
            }
        }
        this._failed = true;
    }

    /** 由 enemy.js 每帧写入的宿主状态（hp 比例 / 受击 / 冰冻 / 燃烧 / 死亡） */
    setOwnerState(state) {
        if (this._delegate) return;
        if (!state) return;
        this._state = {
            hpRatio: Number.isFinite(state.hpRatio) ? state.hpRatio : 1,
            hit: !!state.hit,
            frozen: !!state.frozen,
            burning: !!state.burning,
            death: !!state.death,
        };
    }

    /** 兼容 SpriteRenderer 的动画名接口：'idle' | 'hit' | ... */
    play(name, opts = {}) {
        if (this._delegate) {
            if (typeof this._delegate.play === 'function') this._delegate.play(name, opts);
            return;
        }
        if (typeof name === 'string' && name) this._requestedAnim = name;
        const next = this._resolveFrameName();
        if (next) this._frameName = next;
    }

    /** 该状态在当前 sheet 里是否有帧（enemy.js:837 用它决定要不要切 hit） */
    hasAnim(name) {
        if (this._delegate) return typeof this._delegate.hasAnim === 'function' ? this._delegate.hasAnim(name) : false;
        if (!this._meta) return false;
        if (name === 'idle') {
            return PIXEL_SHEET_STATE_FRAMES.idle.some(f => !!getFrameRect(this._meta, f));
        }
        const candidates = PIXEL_SHEET_STATE_FRAMES[name] || [];
        return candidates.some(f => !!getFrameRect(this._meta, f));
    }

    update(dt) {
        if (this._delegate) return this._delegate.update(dt);
        if (!this._ready) return;
        const step = Number.isFinite(dt) ? Math.max(0, dt) : 0;
        this._elapsed += step;

        const next = this._resolveFrameName();
        if (!next) return;
        const isIdle = PIXEL_SHEET_STATE_FRAMES.idle.includes(next);
        if (!isIdle) {
            this._frameName = next;
            this._elapsed = 0;
            return;
        }
        if (this._elapsed >= PIXEL_SHEET_IDLE_FRAME_SEC) {
            this._elapsed = 0;
            this._idleAlt++;
            this._frameName = this._resolveFrameName();
        }
    }

    draw(ctx, x, y, w, h, alpha = 1) {
        if (this._delegate) return this._delegate.draw(ctx, x, y, w, h, alpha);
        if (!this._ready || !this._image || !this._meta) return false;

        const rect = getFrameRect(this._meta, this._frameName || this._resolveFrameName());
        if (!rect) return false;

        const box = this._fitBox(w, h);
        if (!(box.w > 0) || !(box.h > 0)) return false;

        const prevAlpha  = ctx.globalAlpha;
        const prevSmooth = ctx.imageSmoothingEnabled;
        ctx.globalAlpha = prevAlpha * alpha;
        ctx.imageSmoothingEnabled = false;
        try {
            ctx.drawImage(
                this._image,
                rect.x, rect.y, rect.w, rect.h,
                x + box.dx, y + box.dy, box.w, box.h
            );
        } catch (e) {
            console.warn('[PixelSheet] drawImage 失败:', e);
            ctx.globalAlpha = prevAlpha;
            ctx.imageSmoothingEnabled = prevSmooth;
            return false;
        }
        ctx.globalAlpha = prevAlpha;
        ctx.imageSmoothingEnabled = prevSmooth;
        return true;
    }

    drawRegion() {
        if (this._delegate && typeof this._delegate.drawRegion === 'function') {
            return this._delegate.drawRegion.apply(this._delegate, arguments);
        }
        return false;
    }

    getCurrentFrameDimensions() {
        if (this._delegate && typeof this._delegate.getCurrentFrameDimensions === 'function') {
            return this._delegate.getCurrentFrameDimensions();
        }
        const rect = getFrameRect(this._meta, this._frameName);
        return rect ? { width: rect.w, height: rect.h } : null;
    }

    getCurrentFrameAspect() {
        if (this._delegate && typeof this._delegate.getCurrentFrameAspect === 'function') {
            return this._delegate.getCurrentFrameAspect();
        }
        return this._canvasSize ? this._canvasSize.aspect : 1;
    }

    /** 当前状态应显示的帧名（含 idle 两帧交替） */
    _resolveFrameName() {
        if (!this._meta) return null;
        const state = { ...this._state };
        if (this._requestedAnim === 'hit') state.hit = true;
        // 宿主状态里没有的动画名（cast/move 等）一律退回 idle 帧
        const picked = pickStateFrame(this._meta, state);
        if (!picked) return null;
        if (PIXEL_SHEET_STATE_FRAMES.idle.includes(picked)) {
            const idleFrames = PIXEL_SHEET_STATE_FRAMES.idle;
            const alt = idleFrames[this._idleAlt % idleFrames.length];
            if (getFrameRect(this._meta, alt)) return alt;
        }
        return picked;
    }

    /** 按 sheet 画布长宽比把帧等比居中放进目标框 */
    _fitBox(w, h) {
        const aspect = this._canvasSize ? this._canvasSize.aspect : 1;
        if (!(w > 0) || !(h > 0) || !(aspect > 0)) return { dx: 0, dy: 0, w: 0, h: 0 };
        let dw = w;
        let dh = w / aspect;
        if (dh > h) { dh = h; dw = h * aspect; }
        return { dx: (w - dw) / 2, dy: (h - dh) / 2, w: dw, h: dh };
    }
}

// ─── 全局 Sprite Sheet 注册表 ─────────────────────────────────────────────
// 游戏启动时预加载所有已知 Sprite Sheet，避免运行时卡顿

import { ENEMY_V2_METADATA, ENEMY_V2_BY_ARCHETYPE } from '../data/enemy_v2_metadata.js';
import { resolveEnemyVisualAsset, loadEnemyVisualAssetManifest } from '../data/enemy_visual_assets.js';
import { BOSS_SPRITE_BOSS_IDS, getBossSpriteSheetPath } from '../data/boss_sprite_assets.js';
import {
    PIXEL_SHEET_IDLE_FRAME_SEC,
    PIXEL_SHEET_STATE_FRAMES,
    getFrameRect,
    getSheetCanvasSize,
    loadPixelSheet,
    pickStateFrame,
    resolvePixelSheetArchetype,
} from '../data/pixel_sheet.js';

const SPRITE_REGISTRY = {
    'golem_normal': 'assets/sprites/enemies/golem_normal.png',
    'golem_elite':  'assets/sprites/enemies/golem_elite.png',
    // V2 基底敵人 Sprite（占位资源，命名/manifest 与正式资源一致）
    ...ENEMY_V2_METADATA.reduce((acc, m) => {
        acc[m.resourceId] = m.spritePath;
        return acc;
    }, {}),
    // Boss Sprite：路径契约见 src/data/boss_sprite_assets.js。
    ...BOSS_SPRITE_BOSS_IDS.reduce((acc, bossId) => {
        acc[`boss_${bossId}`] = getBossSpriteSheetPath(bossId);
        return acc;
    }, {}),
};

/** 预加载的 SpriteRenderer 实例池 */
const _spritePool = new Map();

/**
 * 预加载所有已注册的 Sprite Sheet
 * 在游戏初始化时调用一次
 */
export function preloadAllSprites() {
    for (const [key, path] of Object.entries(SPRITE_REGISTRY)) {
        _spritePool.set(key, SpriteRenderer.preload(path));
    }
    console.log(`[SpriteRenderer] 预加载 ${_spritePool.size} 个 Sprite Sheet`);
}

/**
 * 为指定实体创建 SpriteRenderer 实例
 *
 * 选择优先级（V2 资源协议）：
 *   0) 若可解析到 composite 资源（baseArchetype + footprint + affixSet）→ 使用组合 Sprite
 *   1) 若 enemy 提供了 baseArchetype 且匹配 V2 基底 → 使用 V2 专属 Sprite
 *   2) Boss → boss_<bossType>
 *   3) elite → golem_elite（V2 基底未命中时的安全回退）
 *   4) normal → golem_normal
 * 任意一步资源未加载完成时，SpriteRenderer 内部会进入 failed 状态，
 * 由 Enemy.draw 回退到程序化矢量绘制，不会让敌人消失。
 *
 * 兼容两种调用约定：
 *   createSpriteRenderer('elite', null, 'bastion')                     // 旧式
 *   createSpriteRenderer({ type, bossType, baseArchetype, gridCols, gridRows, affixes }) // 新式：传入完整 enemy 信息
 *
 * @returns {SpriteRenderer|null}
 */
export function createSpriteRenderer(enemyTypeOrEnemy, bossType, baseArchetype) {
    // 归一化参数
    let enemyInfo;
    if (enemyTypeOrEnemy && typeof enemyTypeOrEnemy === 'object') {
        enemyInfo = {
            type: enemyTypeOrEnemy.type,
            bossType: enemyTypeOrEnemy.bossType,
            baseArchetype: enemyTypeOrEnemy.baseArchetype,
            gridCols: enemyTypeOrEnemy.gridCols,
            gridRows: enemyTypeOrEnemy.gridRows,
            affixes: enemyTypeOrEnemy.affixes,
            visualAssetKey: enemyTypeOrEnemy.visualAssetKey,
            bossOwnerId: enemyTypeOrEnemy.bossOwnerId,
            bossMinionRole: enemyTypeOrEnemy.bossMinionRole,
            bossMechanicTags: enemyTypeOrEnemy.bossMechanicTags,
        };
    } else {
        enemyInfo = {
            type: enemyTypeOrEnemy,
            bossType,
            baseArchetype,
            gridCols: 1,
            gridRows: 1,
            affixes: [],
            visualAssetKey: null,
            bossOwnerId: null,
            bossMinionRole: null,
            bossMechanicTags: [],
        };
    }

    // 0) 像素 sheet@1（原生像素美术）：命中已接线 archetype 时优先走像素渲染器。
    //    像素 sheet 加载 / 校验失败时，渲染器内部自动回退到下面的旧位图链路。
    const pixelSheetHit = enemyInfo.type !== 'boss' ? resolvePixelSheetArchetype(enemyInfo) : null;
    if (pixelSheetHit) {
        return new PixelSheetSpriteRenderer(pixelSheetHit, () => _createLegacySpriteRenderer(enemyInfo));
    }

    return _createLegacySpriteRenderer(enemyInfo);
}

/**
 * 旧位图链路（`enemy_visual_assets` 清单 → V2 metadata → golem 兜底）。
 * 像素 sheet 未接线 / 不可用时走这里；行为与接线前完全一致。
 * @param {object} enemyInfo
 * @returns {SpriteRenderer|null}
 */
function _createLegacySpriteRenderer(enemyInfo) {
    // 0) 资源协议解析（baseArchetype + footprint + affixSet → composite 资源）
    // 对所有非 Boss 敌人（含 1×1 residue）都走 manifest 解析，命中再使用，
    // 未命中再回到下面的 V2 metadata / golem 兜底。
    if (enemyInfo.type !== 'boss') {
        const resolved = resolveEnemyVisualAsset(enemyInfo);
        if (resolved && resolved.spritePath && (resolved.fallbackLevel === 'composite' || resolved.fallbackLevel === 'archetype')) {
            return new SpriteRenderer(resolved.spritePath, resolved.manifestPath || undefined);
        }
    }

    let key = null;

    // 1) V2 基底优先（普通/精英共用同一组资源）
    if (enemyInfo.baseArchetype && ENEMY_V2_BY_ARCHETYPE[enemyInfo.baseArchetype]) {
        key = ENEMY_V2_BY_ARCHETYPE[enemyInfo.baseArchetype].resourceId;
    } else if (enemyInfo.type === 'boss' && enemyInfo.bossType) {
        key = `boss_${enemyInfo.bossType}`;
    } else if (enemyInfo.type === 'elite') {
        key = 'golem_elite';
    } else if (enemyInfo.type === 'normal') {
        key = 'golem_normal';
    }

    if (!key) return null;

    const path = SPRITE_REGISTRY[key];
    if (!path) {
        // V2 基底配置但资源缺失 → 安全回退到 golem_elite，保证敌人可见
        if (enemyInfo.type === 'elite' || enemyInfo.baseArchetype) {
            return new SpriteRenderer(SPRITE_REGISTRY['golem_elite']);
        }
        return new SpriteRenderer(SPRITE_REGISTRY['golem_normal']);
    }

    // 如果预加载池中已有，返回共享实例的克隆（每个实体需要独立的动画状态）
    const pooled = _spritePool.get(key);
    if (pooled && pooled.ready) {
        return new SpriteRenderer(path);
    }
    return new SpriteRenderer(path);
}

// manifest 启动时尝试预加载（异步、不阻塞）
loadEnemyVisualAssetManifest();
