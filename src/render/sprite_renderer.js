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

    // ─── 查询 ──────────────────────────────────────────────────────────────

    /** 当前动画名称 */
    get currentAnim() { return this._currentAnim; }

    /** 当前帧索引 */
    get frameIndex() { return this._frameIndex; }

    /** 是否有指定动画 */
    hasAnim(name) {
        return !!(this._meta && this._meta.animations[name]);
    }
}

// ─── 全局 Sprite Sheet 注册表 ─────────────────────────────────────────────
// 游戏启动时预加载所有已知 Sprite Sheet，避免运行时卡顿

import { ENEMY_V2_METADATA, ENEMY_V2_BY_ARCHETYPE } from '../data/enemy_v2_metadata.js';
import { resolveEnemyVisualAsset, loadEnemyVisualAssetManifest } from '../data/enemy_visual_assets.js';

const SPRITE_REGISTRY = {
    'golem_normal': 'assets/sprites/enemies/golem_normal.png',
    'golem_elite':  'assets/sprites/enemies/golem_elite.png',
    // V2 基底敵人 Sprite（占位资源，命名/manifest 与正式资源一致）
    ...ENEMY_V2_METADATA.reduce((acc, m) => {
        acc[m.resourceId] = m.spritePath;
        return acc;
    }, {}),
    // Boss Sprite（Phase C 完成后逐步填充）
    'boss_ignis':     'assets/sprites/bosses/boss_ignis.png',
    'boss_glacies':   'assets/sprites/bosses/boss_glacies.png',
    'boss_mikro':     'assets/sprites/bosses/boss_mikro.png',
    'boss_devourer':  'assets/sprites/bosses/boss_devourer.png',
    'boss_viridis':   'assets/sprites/bosses/boss_viridis.png',
    'boss_tesla':     'assets/sprites/bosses/boss_tesla.png',
    'boss_chimera':   'assets/sprites/bosses/boss_chimera.png',
    'boss_ouroboros': 'assets/sprites/bosses/boss_ouroboros.png',
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
        };
    } else {
        enemyInfo = {
            type: enemyTypeOrEnemy,
            bossType,
            baseArchetype,
            gridCols: 1,
            gridRows: 1,
            affixes: [],
        };
    }

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
