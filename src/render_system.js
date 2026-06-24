import { 
    META_SHOP_CONFIG, ATTRIBUTES_FOR_SHOP, setDeepValue, CONFIG, RELIC_DB, SKILL_DB 
} from './config.js';
import { 
    Vec2, MarbleDefinition, SpecialSlot, FortuneWheel, Peg, DropBall, Enemy, SwordQi, 
    SlashAnim, SonSword, Projectile, CloneSpore, Particle, SlashEffect, CollectionBeam, 
    Shockwave, LaserBeam, FloatingText, EnergyOrb, LightningBolt, FireWave, showToast, 
    rotateTowards, adjustColorBrightness, lerpColor, lerp, hexToRgba,
    MuzzleFlashV2, FiringBurst
} from './entities.js';
import { UIManager, TrainingGround, TruthBook } from './systems.js';
import { audio } from './audio.js';
import { sb as _sb } from './utils/perf.js';
import { pixiIsActive } from './render/pixi_bridge.js';
import {
    floatingText_pixiDestroy,
    muzzleFlashV2_pixiDestroy,
    firingBurst_pixiDestroy,
} from './render/pixi_effect_adapter.js';
import {
    getUiBitmap,
    EMITTER_BASE_SRC,
    EMITTER_BARREL_SRC,
    EMITTER_RING_SRC,
    EMITTER_DRAW_SIZE,
    EMITTER_BARREL_DRAW_SIZE,
    EMITTER_RING_DRAW_SIZE,
    EMITTER_PORT_OFFSET_Y,
    AIM_GUIDE_NODE_SRCS,
    EMITTER_MUZZLE_FLASH_SRCS,
    EMITTER_CHARGING_SRCS,
    BG_MAIN_CANVAS_SRC,
    BG_EMITTER_ZONE_SRC,
    BG_COMBAT_TABLE_SRC,
    BG_COMBAT_EMITTER_ZONE_SRC,
    COMBAT_WALL_LEFT_SRC,
    COMBAT_WALL_RIGHT_SRC,
    COMBAT_WALL_TOP_SRC,
    COMBAT_DEFEAT_LINE_SRC,
    getAmmoIconSrc,
    getAttributeIconSrcByKey,
} from './bitmap_icons.js';
import { getAmmoReadabilityProfile } from './utils/ammo_readability.js';

export const render_system = {
/**
     * [RENDER] 清理画布并绘制背景色。
     */
    render_clearCanvas() {
        this.ctx.clearRect(0, 0, this.width, this.height);
        this.ctx.fillStyle = CONFIG.colors.bg;
        this.ctx.fillRect(0, 0, this.width, this.height);
        // 主底图位图；战斗阶段使用更明确的反弹墙场地，其他阶段保留原共用底图。
        const bgMain = getUiBitmap(this.phase === 'combat' ? BG_COMBAT_TABLE_SRC : BG_MAIN_CANVAS_SRC);
        if (bgMain) {
            this.ctx.save();
            this.ctx.globalAlpha = 0.85;
            this.ctx.drawImage(bgMain, 0, 0, this.width, this.height);
            this.ctx.restore();
        }
        // 发射器区域（底部 220px 高的炼金台层），仅在战斗 / 研磨阶段叠加
        if (this.phase === 'combat' || this.phase === 'gathering') {
            const bgEmitter = getUiBitmap(this.phase === 'combat' ? BG_COMBAT_EMITTER_ZONE_SRC : BG_EMITTER_ZONE_SRC);
            if (bgEmitter) {
                const zoneH = Math.min(220, this.height * 0.24);
                const scale = Math.max(this.width / bgEmitter.width, zoneH / bgEmitter.height);
                const drawW = bgEmitter.width * scale;
                const drawH = bgEmitter.height * scale;
                const drawX = (this.width - drawW) / 2;
                const drawY = this.height - zoneH + (zoneH - drawH) / 2;
                this.ctx.save();
                this.ctx.beginPath();
                this.ctx.rect(0, this.height - zoneH, this.width, zoneH);
                this.ctx.clip();
                this.ctx.globalAlpha = 0.9;
                this.ctx.drawImage(bgEmitter, drawX, drawY, drawW, drawH);
                this.ctx.restore();
            }
        }
    },

/**
     * [RENDER] 绘制背景网格。
     */
    render_background() {
        this.ctx.save();
        const gridSpacing = 40;
        const tiltX = -this.boardTilt.current.x * 15; 
        const tiltY = this.boardTilt.current.y * 10;
        
        this.ctx.strokeStyle = 'rgba(71, 85, 105, 0.15)'; 
        this.ctx.lineWidth = 1;

        for (let x = (tiltX % gridSpacing); x < this.width; x += gridSpacing) {
            this.ctx.beginPath(); this.ctx.moveTo(x, 0); this.ctx.lineTo(x, this.height); this.ctx.stroke();
        }
        for (let y = (tiltY % gridSpacing); y < this.height; y += gridSpacing) {
            this.ctx.beginPath(); this.ctx.moveTo(0, y); this.ctx.lineTo(this.width, y); this.ctx.stroke();
        }
        this.ctx.restore();
    },

    /**
     * [RENDER] 绘制战斗可反弹边界墙。
     * 位图未加载时保留旧渐变线条 fallback，避免资产加载失败时丢失碰撞边界提示。
     */
    render_combat_walls(ctx, wallLeftX, wallRightX, wallTopY) {
        const wallH = Math.max(0, this.height - wallTopY);
        const leftImg = getUiBitmap(COMBAT_WALL_LEFT_SRC);
        const rightImg = getUiBitmap(COMBAT_WALL_RIGHT_SRC);
        const topImg = getUiBitmap(COMBAT_WALL_TOP_SRC);
        const wallW = Math.min(48, Math.max(28, (wallRightX - wallLeftX) * 0.055));
        const topH = Math.min(64, Math.max(42, this.enemyHeight * 0.72));
        const leftArtX = wallLeftX - wallW;
        const rightArtX = wallRightX;
        const topArtX = wallLeftX - wallW;
        const topArtW = (wallRightX - wallLeftX) + wallW * 2;
        const topArtY = wallTopY - topH;
        const hasWallArt = leftImg && rightImg && topImg;

        ctx.save();
        if (hasWallArt) {
            // @perf-impact: Combat wall V2 art adds up to three static drawImage calls per combat frame; no particles, gradients, or dynamic bitmap generation.
            ctx.globalAlpha = 0.9;
            // Keep decorative wall thickness outside the physics arena so enemies never overlap the art frame.
            ctx.drawImage(leftImg, leftArtX, wallTopY, wallW, wallH);
            ctx.drawImage(rightImg, rightArtX, wallTopY, wallW, wallH);
            ctx.drawImage(topImg, topArtX, topArtY, topArtW, topH);

            ctx.globalAlpha = 1;
            ctx.strokeStyle = 'rgba(148, 226, 232, 0.58)';
            ctx.lineWidth = 1.25;
            ctx.shadowColor = '#38bdf8';
            ctx.shadowBlur = _sb(8);
            ctx.beginPath();
            ctx.moveTo(wallLeftX, wallTopY);
            ctx.lineTo(wallLeftX, this.height);
            ctx.moveTo(wallRightX, wallTopY);
            ctx.lineTo(wallRightX, this.height);
            ctx.moveTo(wallLeftX, wallTopY);
            ctx.lineTo(wallRightX, wallTopY);
            ctx.stroke();
            ctx.restore();
            return;
        }

        const fallbackWallW = Math.min(20, wallW);
        const wallGradLeft = ctx.createLinearGradient(wallLeftX - fallbackWallW, 0, wallLeftX, 0);
        wallGradLeft.addColorStop(0, 'rgba(56, 189, 248, 0.25)');
        wallGradLeft.addColorStop(0.3, 'rgba(148, 163, 184, 0.1)');
        wallGradLeft.addColorStop(1, 'rgba(148, 163, 184, 0)');
        ctx.fillStyle = wallGradLeft;
        ctx.fillRect(wallLeftX - fallbackWallW, wallTopY, fallbackWallW, wallH);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.fillRect(wallLeftX - 1, wallTopY, 1, wallH);

        const wallGradRight = ctx.createLinearGradient(wallRightX + fallbackWallW, 0, wallRightX, 0);
        wallGradRight.addColorStop(0, 'rgba(56, 189, 248, 0.25)');
        wallGradRight.addColorStop(0.3, 'rgba(148, 163, 184, 0.1)');
        wallGradRight.addColorStop(1, 'rgba(148, 163, 184, 0)');
        ctx.fillStyle = wallGradRight;
        ctx.fillRect(wallRightX, wallTopY, fallbackWallW, wallH);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.fillRect(wallRightX, wallTopY, 1, wallH);

        ctx.strokeStyle = 'rgba(148, 163, 184, 0.4)';
        ctx.lineWidth = 2;
        ctx.shadowColor = '#38bdf8';
        ctx.shadowBlur = _sb(15);
        ctx.beginPath();
        ctx.moveTo(wallLeftX, wallTopY); ctx.lineTo(wallLeftX, this.height);
        ctx.moveTo(wallRightX, wallTopY); ctx.lineTo(wallRightX, this.height);
        ctx.moveTo(wallLeftX, wallTopY); ctx.lineTo(wallRightX, wallTopY);
        ctx.stroke();
        ctx.restore();
    },

    /**
     * [RENDER] 绘制战斗失败警戒线 / 护盾防线。
     * @perf-impact: Combat defeat line uses one static bitmap strip plus fixed-count line/text draws; high/medium keep small gated glow and low uses flat strokes only.
     */
    render_combat_defeatLine(ctx) {
        if (!Number.isFinite(this.defeatLineY)) return;
        const lineY = this.defeatLineY - 2;
        const shield = this.playerShield || 0;
        const enemies = Array.isArray(this.enemies) ? this.enemies : [];
        const dangerRange = Math.max(58, (this.enemyHeight || 42) * 1.45);
        const isDanger = enemies.some(e => e && !e.dead && e.pos && (e.pos.y + (e.height || this.enemyHeight || 0) / 2) >= lineY - dangerRange);
        const quality = this.perfQualityLevel || 'high';
        const lineImg = getUiBitmap(COMBAT_DEFEAT_LINE_SRC);
        const alpha = shield > 0 ? 0.9 : (isDanger ? 0.76 : 0.38);
        const color = shield > 0 ? '#93c5fd' : (isDanger ? '#f87171' : '#fbbf24');
        const label = shield > 0 ? `防线屏障 ${shield}` : (isDanger ? '警戒线 危险' : '警戒线');

        ctx.save();
        if (lineImg) {
            ctx.globalAlpha = alpha;
            ctx.drawImage(lineImg, 0, lineY - 16, this.width, 32);
        } else {
            ctx.globalAlpha = alpha * 0.75;
            ctx.fillStyle = shield > 0 ? 'rgba(147, 197, 253, 0.14)' : (isDanger ? 'rgba(248, 113, 113, 0.16)' : 'rgba(251, 191, 36, 0.10)');
            ctx.fillRect(0, lineY - 10, this.width, 20);
        }

        ctx.globalAlpha = 1;
        ctx.strokeStyle = color;
        ctx.lineWidth = shield > 0 || isDanger ? 2.5 : 1.5;
        ctx.setLineDash(shield > 0 ? [14, 10] : [18, 12]);
        ctx.lineDashOffset = -((Date.now() / (isDanger ? 90 : 150)) % 30);
        if (quality !== 'low') {
            ctx.shadowColor = color;
            ctx.shadowBlur = _sb(isDanger ? 12 : 7);
        }
        ctx.beginPath();
        ctx.moveTo(0, lineY);
        ctx.lineTo(this.width, lineY);
        ctx.stroke();

        ctx.setLineDash([]);
        ctx.shadowBlur = 0;
        ctx.font = 'bold 11px sans-serif';
        ctx.textAlign = 'right';
        ctx.fillStyle = shield > 0 ? 'rgba(191, 219, 254, 0.96)' : (isDanger ? 'rgba(254, 202, 202, 0.96)' : 'rgba(253, 230, 138, 0.82)');
        ctx.fillText(label, this.width - 16, lineY - 14);
        ctx.restore();
    },

    render_windAnchors() {
        if (this.windAnchors && this.windAnchors.length > 0) {
            this.ctx.save();
            
            // 增强连线视觉：1.5倍宽度虚线 + 发光
            const linePulse = (Math.sin(Date.now() / 400) + 1) / 2;
            this.ctx.strokeStyle = 'rgba(52, 211, 153, ' + (0.5 + linePulse * 0.3) + ')';
            this.ctx.lineWidth = 3;
            this.ctx.setLineDash([8, 12]);
            this.ctx.shadowBlur = _sb(10 + linePulse * 5);
            this.ctx.shadowColor = '#34d399';
            
            // [属性特效]：在连线上方绘制微小的风纹粒子
            if (Math.random() > 0.8) {
                const a1 = this.windAnchors[Math.floor(Math.random() * this.windAnchors.length)];
                const a2 = this.windAnchors[Math.floor(Math.random() * this.windAnchors.length)];
                if (a1 !== a2) {
                    const lerp = Math.random();
                    const px = a1.x + (a2.x - a1.x) * lerp;
                    const py = a1.y + (a2.y - a1.y) * lerp;
                    this.spawn_createParticle(px, py, '#34d399', 'spark');
                }
            }
            
            // 连线
            if (this.windAnchors.length > 1) {
                this.ctx.beginPath();
                this.ctx.moveTo(this.windAnchors[0].x, this.windAnchors[0].y);
                for (let i = 1; i < this.windAnchors.length; i++) {
                    this.ctx.lineTo(this.windAnchors[i].x, this.windAnchors[i].y);
                }
                if (this.windAnchors.length === 4) this.ctx.closePath();
                this.ctx.stroke();
            }
            
            // 添加粒子扩散动画（防止被敌人遮挡）
            this.windAnchors.forEach((a, idx) => {
                if (Math.random() < 0.1) { // 10%概率生成粒子
                    const angle = Math.random() * Math.PI * 2;
                    const radius = 5 + Math.random() * 10;
                    const px = a.x + Math.cos(angle) * radius;
                    const py = a.y + Math.sin(angle) * radius;
                    this.spawn_createParticle(px, py, '#34d399', 'spark');
                }
            });
            
            // 绘制锥点（增强视觉效果）
            this.windAnchors.forEach((a, idx) => {
                const pulse = (Math.sin(Date.now() / 200 + idx) + 1) / 2;
                
                // 绘制外圈发光
                this.ctx.save();
                this.ctx.globalAlpha = 0.3 + pulse * 0.3;
                this.ctx.fillStyle = '#34d399';
                this.ctx.shadowBlur = _sb(15 + pulse * 10);
                this.ctx.shadowColor = '#34d399';
                this.ctx.beginPath();
                this.ctx.arc(a.x, a.y, 8 + pulse * 4, 0, Math.PI * 2);
                this.ctx.fill();
                this.ctx.restore();
                
                // 绘制主体
                this.ctx.save();
                this.ctx.fillStyle = '#d1fae5';
                this.ctx.shadowBlur = _sb(10);
                this.ctx.shadowColor = '#34d399';
                this.ctx.beginPath();
                this.ctx.arc(a.x, a.y, 5, 0, Math.PI * 2);
                this.ctx.fill();
                
                // 绘制中心亮点
                this.ctx.fillStyle = '#ffffff';
                this.ctx.beginPath();
                this.ctx.arc(a.x, a.y, 2, 0, Math.PI * 2);
                this.ctx.fill();
                this.ctx.restore();
                
                // 编号 (1-4)，让玩家知道进度
                this.ctx.save();
                this.ctx.fillStyle = '#34d399';
                this.ctx.font = 'bold 12px Arial';
                this.ctx.shadowBlur = _sb(5);
                this.ctx.shadowColor = 'rgba(0,0,0,0.5)';
                this.ctx.fillText(idx + 1, a.x + 8, a.y - 8);
                this.ctx.restore();
            });
            this.ctx.restore();
        }
    },

/**
     * [RENDER] 绘制风属性法阵激活特效（预兆/咏唱阶段）
     * @description 根据阵法类型（风道/旋风/爆破）显示不同的视觉预兆效果
     * @param {object} matrix - 法阵实例对象
     */
    /**
     * [VISUAL] 绘制蝴蝶法阵的路径波预览 (内部渲染版)
     */
    render_butterflyPathWave(ctx, anchors, center, progress) {
        ctx.save();
        const alpha = 0.3 + progress * 0.5;
        ctx.strokeStyle = `rgba(52, 211, 153, ${alpha})`;
        ctx.lineWidth = 2 + progress * 2;
        ctx.setLineDash([10, 10]);
        anchors.forEach((a, i) => {
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(center.x, center.y);
            ctx.stroke();
            const segments = 8;
            const offset = (Date.now() / 150) % 1;
            for(let j=0; j<segments; j++) {
                const t = (j / segments + offset) % 1;
                const px = a.x + (center.x - a.x) * t;
                const py = a.y + (center.y - a.y) * t;
                ctx.fillStyle = "#fff";
                ctx.beginPath();
                ctx.arc(px, py, 1.5 + progress * 2, 0, Math.PI * 2);
                ctx.fill();
            }
        });
        ctx.restore();
    },

    render_singleWindMatrix(matrix) {
        // @section:wind_matrix_init - 初始化进度参数并生成风属粒子特效
        if (!matrix || !matrix.active) return;
        const { timer, maxTimer, rect, type, anchors, tunnelVector } = matrix;
        const t = 1 - (timer / maxTimer);
        const progress = t === 0 ? 0 : Math.pow(2, 10 * t - 10);
        const ctx = this.ctx;
        const time = Date.now();
        this.spawn_windSkillParticles(type, rect, progress);
        ctx.save();
        ctx.globalCompositeOperation = "lighter";
        ctx.beginPath();
        ctx.moveTo(anchors[0].x, anchors[0].y);
        anchors.forEach(a => {
            const shakeX = (Math.random() - 0.5) * (3 + progress * 5);
            const shakeY = (Math.random() - 0.5) * (3 + progress * 5);
            ctx.lineTo(a.x + shakeX, a.y + shakeY);
        });
        ctx.closePath();
        const flash = Math.sin(time / 20) > 0;
        ctx.strokeStyle = flash ? "#fff" : "#34d399";
        ctx.lineWidth = 2;
        ctx.shadowBlur = _sb(20 * progress);
        ctx.shadowColor = "#34d399";
        ctx.stroke();
        // @section:wind_matrix_tunnel - 隧道型风阵：渐变光带 + 方向箭头动画
        if (type === "tunnel") {
            const isHorizontal = rect.w > rect.h;
            const centerX = rect.x + rect.w/2;
            const centerY = rect.y + rect.h/2;
            ctx.beginPath();
            let grad;
            if (isHorizontal) {
                grad = ctx.createLinearGradient(0, centerY - rect.h/2, 0, centerY + rect.h/2);
                ctx.moveTo(rect.x, centerY);
                ctx.lineTo(rect.x + rect.w, centerY);
            } else {
                grad = ctx.createLinearGradient(centerX - rect.w/2, 0, centerX + rect.w/2, 0);
                ctx.moveTo(centerX, rect.y);
                ctx.lineTo(centerX, rect.y + rect.h);
            }
            grad.addColorStop(0, "rgba(52, 211, 153, 0)");
            grad.addColorStop(0.5, "rgba(52, 211, 153, 0.2)");
            grad.addColorStop(1, "rgba(52, 211, 153, 0)");
            ctx.strokeStyle = grad;
            ctx.lineWidth = isHorizontal ? rect.h : rect.w;
            ctx.stroke();
            const arrowCount = 8;
            const arrowSize = 20 + progress * 10;
            const arrowAlpha = 0.4 + progress * 0.6;
            ctx.fillStyle = `rgba(255, 255, 255, ${arrowAlpha})`;
            ctx.strokeStyle = `rgba(52, 211, 153, ${arrowAlpha})`;
            ctx.lineWidth = 2;
            for(let k=0; k<arrowCount; k++) {
                const arrowPos = ((time / 300) + k/arrowCount) % 1;
                ctx.beginPath();
                if (isHorizontal) {
                    const ax = rect.x + arrowPos * rect.w;
                    const ay = centerY;
                    ctx.moveTo(ax - arrowSize, ay - arrowSize/2);
                    ctx.lineTo(ax, ay);
                    ctx.lineTo(ax - arrowSize, ay + arrowSize/2);
                } else {
                    const ax = centerX;
                    const ay = rect.y + arrowPos * rect.h;
                    ctx.moveTo(ax - arrowSize/2, ay - arrowSize);
                    ctx.lineTo(ax, ay + arrowSize/2);
                    ctx.lineTo(ax + arrowSize/2, ay - arrowSize);
                }
                ctx.stroke();
            }
        // @section:wind_matrix_bowtie - 蝴蝶结形风阵：蝴蝶路径波局线动画
        } else if (this.isBowtieShape(anchors)) {
            const intersection = this.getLineIntersectionPoint(anchors[0], anchors[2], anchors[1], anchors[3]);
            if (intersection) {
                this.render_butterflyPathWave(ctx, anchors, intersection, progress);
            }
        // @section:wind_matrix_cyclone - 旋风型风阵：高速切割刃 + 逆向符文环动画
        } else if (type === 'cyclone') {
            // === 旋风：绞肉机法阵 (Shredder Circle) ===
            const cx = rect.x + rect.w / 2;
            const cy = rect.y + rect.h / 2;
            const maxR = Math.min(rect.w, rect.h) * 0.45;
            
            ctx.translate(cx, cy);

            // 1. 暴风眼：核心高亮，且剧烈震动
            const shake = (Math.random() - 0.5) * 5 * progress;
            ctx.beginPath();
            ctx.arc(shake, shake, maxR * 0.2, 0, Math.PI * 2);
            ctx.fillStyle = '#fff'; // 纯白核心
            ctx.shadowBlur = _sb(30);
            ctx.shadowColor = '#fff';
            ctx.fill();
            
            // 2. 内层：高速切割刃 (顺时针)
            ctx.save();
            ctx.rotate(time / 50); // 极速旋转
            ctx.beginPath();
            const bladeCount = 6;
            for(let i=0; i<bladeCount; i++) {
                const angle = (i / bladeCount) * Math.PI * 2;
                const r = maxR * 0.6;
                ctx.moveTo(Math.cos(angle)*r, Math.sin(angle)*r);
                ctx.quadraticCurveTo(
                    Math.cos(angle + 0.3) * r * 1.5, 
                    Math.sin(angle + 0.3) * r * 1.5, 
                    Math.cos(angle + 0.6) * r * 0.8, 
                    Math.sin(angle + 0.6) * r * 0.8
                );
            }
            ctx.strokeStyle = '#6ee7b7';
            ctx.lineWidth = 3;
            ctx.stroke();
            ctx.fillStyle = 'rgba(52, 211, 153, 0.3)';
            ctx.fill();
            ctx.restore();

            // 3. 外层：逆向符文环 (产生视觉撕裂感)
            ctx.save();
            ctx.rotate(-time / 100); 
            ctx.beginPath();
            ctx.arc(0, 0, maxR * 0.9, 0, Math.PI * 2);
            ctx.strokeStyle = `rgba(255, 255, 255, ${0.5 + progress * 0.5})`;
            ctx.lineWidth = 2;
            ctx.setLineDash([20, 30]); 
            ctx.stroke();
            
            for(let j=0; j<4; j++) {
                ctx.rotate(Math.PI / 2);
                ctx.beginPath();
                ctx.moveTo(maxR * 0.9, -5);
                ctx.lineTo(maxR * 1.2, 0); 
                ctx.lineTo(maxR * 0.9, 5);
                ctx.fillStyle = '#fff';
                ctx.fill();
            }
            ctx.restore();

            // 文字提示
            ctx.fillStyle = `rgba(255,255,255, ${progress})`;
            ctx.font = "bold 20px Cinzel";
            ctx.textAlign = "center";
            ctx.fillText("SHREDDER", 0, 0);

        } else {
            // 爆破：取消矩形闪烁，仅保留文字提示
            
            // 文字提示
            ctx.fillStyle = `rgba(255,255,255, ${progress})`;
            ctx.font = "bold 20px Cinzel";
            ctx.textAlign = "center";
            ctx.fillText("BURST", rect.x + rect.w/2, rect.y + rect.h/2);
        }

        ctx.restore();
    },

/**
     * [RENDER] 绘制并更新全局浮动文字。
     * @param {number} timeScale - 时间缩放系数。
     */
    render_floatingTexts(timeScale) {
        for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
            this.floatingTexts[i].update(timeScale);
            this.floatingTexts[i].draw(this.ctx);
            if (this.floatingTexts[i].life <= 0) {
                if (this.floatingTexts[i]._pixi) { floatingText_pixiDestroy(this.floatingTexts[i]._pixi); this.floatingTexts[i]._pixi = null; }
                this.floatingTexts.splice(i, 1);
            }
        }
    },

/**
     * @method drawLauncherOrbitals
     * @description ??????????/??????????????????????????
     */
    render_combat_launcherOrbitals() {
        // Retired for the V3/V4 emitter art pass. Kept as a no-op for legacy callers.
    },
    /**
     * [RENDER] Draws generated aim guide node art with a flat fallback while the asset is loading.
     * @perf-impact: Aim guide nodes are fixed-size generated bitmap sprites; no particles, gradients, or new performance budgets.
     */
    render_combat_aimGuideNode(ctx, x, y, kind = 'wall', size = 18, alpha = 0.9) {
        const src = AIM_GUIDE_NODE_SRCS[kind] || AIM_GUIDE_NODE_SRCS.wall;
        const img = getUiBitmap(src);
        ctx.save();
        ctx.globalAlpha = alpha;
        if (img) {
            ctx.drawImage(img, x - size / 2, y - size / 2, size, size);
        } else {
            ctx.fillStyle = kind === 'enemy' ? 'rgba(250, 204, 21, 0.92)' : 'rgba(255, 255, 255, 0.78)';
            ctx.beginPath();
            ctx.arc(x, y, size * 0.18, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.restore();
    },
/**
     * [RENDER] 绘制发射器的下一发可读性信号：左屏读数、中央弹仓、底部装填格和连射能量条。
     * @perf-impact: 发射器下一发信号 - 每帧固定绘制 6 个装填格、5 段连射能量条和少量文本；low 档关闭 shadowBlur。
     */
    render_combat_launcherSignal(ctx, cx, cy, portX, portY, recipe, visual = {}) {
        if (!recipe) return;
        // Current-ammo readout lives on the launcher; the left wing starts at ammoQueue[1].
        const profile = getAmmoReadabilityProfile(recipe);
        const quality = this.perfQualityLevel || 'high';
        const glowFx = quality !== 'low';
        const accent = profile.primary.color || '#fbbf24';
        const time = Date.now();
        const pulse = (Math.sin(time / 260) + 1) / 2;
        ctx.save();
        ctx.translate(cx, cy);

        // @perf-impact: launcher readout UI uses fixed-count path/text/image draws; high/medium keep lightweight glow, low disables shadowBlur.
        const bodyScale = EMITTER_DRAW_SIZE / 128;
        const chargeProgress = Math.max(0, Math.min(1, visual.chargeProgress || 0));
        const reloadProgress = Math.max(0, Math.min(1, visual.reloadProgress || 0));
        const recoilY = visual.isReloading ? Math.sin(reloadProgress * Math.PI) * 4 * bodyScale : 0;
        const chamberX = 0;
        const chamberY = 7 * bodyScale + recoilY;
        const magazine = {
            y: 43 * bodyScale + recoilY,
            centers: [-29, -18, -7, 7, 18, 29].map(x => x * bodyScale),
        };
        const damageReadout = {
            x: -49 * bodyScale,
            y: 12 * bodyScale + recoilY,
        };
        const burstReadout = {
            x: 43 * bodyScale,
            y: 35 * bodyScale + recoilY,
        };

        const drawDamageReadout = () => {
            ctx.save();
            const value = String(profile.damage);
            const maxValueWidth = 23 * bodyScale;
            let valueSize = 10 * bodyScale;
            ctx.translate(damageReadout.x, damageReadout.y);
            ctx.rotate(-Math.PI / 2);
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillStyle = 'rgba(103, 232, 249, 0.82)';
            ctx.font = `bold ${4.6 * bodyScale}px Cinzel`;
            ctx.fillText('DMG', 0, -5.8 * bodyScale);
            ctx.fillStyle = '#f8fafc';
            do {
                ctx.font = `bold ${valueSize}px Cinzel`;
                if (ctx.measureText(value).width <= maxValueWidth || valueSize <= 5 * bodyScale) break;
                valueSize -= 0.5 * bodyScale;
            } while (true);
            if (glowFx) {
                ctx.shadowColor = accent;
                ctx.shadowBlur = _sb(5 + pulse * 4);
            }
            ctx.fillText(value, 0, 4.5 * bodyScale);
            ctx.restore();
        };

        const drawBurstReadout = () => {
            ctx.save();
            ctx.globalAlpha = 0.96;
            ctx.fillStyle = '#fef3c7';
            ctx.font = `bold ${8 * bodyScale}px Cinzel`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            if (glowFx) {
                ctx.shadowColor = '#f59e0b';
                ctx.shadowBlur = _sb(4 + chargeProgress * 4 + pulse * 3);
            }
            ctx.fillText(`x${profile.multicastCount}`, burstReadout.x, burstReadout.y);
            ctx.shadowBlur = 0;
            ctx.strokeStyle = `rgba(251, 191, 36, ${0.24 + pulse * 0.18})`;
            ctx.lineWidth = 0.9 * bodyScale;
            ctx.beginPath();
            ctx.moveTo(burstReadout.x - 8.5 * bodyScale, burstReadout.y + 6.2 * bodyScale);
            ctx.lineTo(burstReadout.x + 8.5 * bodyScale, burstReadout.y + 6.2 * bodyScale);
            ctx.stroke();
            ctx.restore();
        };

        const drawAttributeMagazine = () => {
            const attributeEntries = profile.entries.slice(0, 6);
            ctx.save();
            for (let i = 0; i < 6; i++) {
                const entry = attributeEntries[i];
                const x = magazine.centers[i];
                if (!entry) continue;
                const color = entry.color || accent;
                const smallIcon = getUiBitmap(getAttributeIconSrcByKey(entry.key));
                if (glowFx) {
                    ctx.shadowColor = color;
                    ctx.shadowBlur = _sb(4);
                }
                if (smallIcon) {
                    const iconSize = 9.8 * bodyScale;
                    ctx.globalAlpha = 0.96;
                    ctx.drawImage(smallIcon, x - iconSize / 2, magazine.y - iconSize / 2, iconSize, iconSize);
                } else {
                    ctx.fillStyle = color;
                    ctx.globalAlpha = 0.92;
                    ctx.beginPath();
                    ctx.arc(x, magazine.y, 4.2 * bodyScale, 0, Math.PI * 2);
                    ctx.fill();
                }
                ctx.shadowBlur = 0;
                ctx.globalAlpha = 1;
                ctx.font = `bold ${5.3 * bodyScale}px Cinzel`;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                const stackText = String(entry.value);
                const textY = magazine.y + 11.8 * bodyScale;
                ctx.lineWidth = 2 * bodyScale;
                ctx.strokeStyle = 'rgba(3, 7, 18, 0.92)';
                ctx.strokeText(stackText, x, textY);
                ctx.fillStyle = '#fef3c7';
                ctx.fillText(stackText, x, textY);
            }
            ctx.globalAlpha = 1;
            ctx.restore();
        };

        const drawLoadedProjectile = () => {
            const params = visual.params || Projectile.calculateVisualParams(recipe, false);
            const deformation = visual.deformation || { x: 1, y: 1 };
            const rotation = Number.isFinite(visual.previewRotation) ? visual.previewRotation : -Math.PI / 2;
            const projectileRadius = Math.max(7, Math.min(12 * bodyScale, params.radius * 0.82 * (1 + chargeProgress * 0.16)));
            Projectile.drawVisuals(
                ctx,
                chamberX,
                chamberY,
                projectileRadius,
                recipe,
                rotation,
                params.intensity,
                deformation
            );

        };

        drawLoadedProjectile();
        drawDamageReadout();
        drawBurstReadout();
        drawAttributeMagazine();

        ctx.restore();
    },

    /**
     * [RENDER] 排队一次基于炮管方向的发射闪光（含发射后热辉余烬冷却）。
     * @perf-impact: launcher barrel fire FX is a capped (<=4) list of short-lived canvas overlays. Each entry draws one bright radial bloom + cone during the flash window and one cooling ember radial gradient that fades over ~600-900ms; quality!=='low' gates the gradients/shadow. No particles, shockwaves, or new CONFIG.performance budgets.
     */
    render_queueLauncherBarrelFireEffect(vel, recipe = {}) {
        const dir = vel && typeof vel.norm === 'function' && vel.mag && vel.mag() > 0.001
            ? vel.norm()
            : { x: 0, y: -1 };
        const color = recipe.pyro > 0 || recipe.explosive ? '#fb923c'
            : recipe.cryo > 0 ? '#67e8f9'
            : recipe.lightning > 0 || recipe.overcharge > 0 ? '#c084fc'
            : recipe.venom > 0 ? '#86efac'
            : recipe.wind > 0 ? '#7dd3fc'
            : '#fef3c7';
        // 开幕齐射那一发打得更狠：火光更大、冷却余烬更久。（普通发射本身已是大火光基线）
        const charged = !!recipe._openingSalvo;
        const now = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
        this._launcherBarrelFireFx = (this._launcherBarrelFireFx || []).slice(-3);
        this._launcherBarrelFireFx.push({
            dir,
            color,
            born: now,
            flashLife: charged ? 210 : 150,   // 明亮发射火光持续时长
            life: charged ? 900 : 700,        // 含热辉余烬冷却的总时长
            intensity: charged ? 1.65 : 1,
            charged,
            _v2Spawned: false,  // [开炮 VFX 增强] 标记是否已创建 PixiJS V2 特效
        });
    },

    /**
     * [RENDER] 绘制发射器底座 + 蓄力动画帧。
     * 运行时只绘制当前美术资产；资源缺失时静默跳过，避免回退到旧简陋炮台。
     * @param {CanvasRenderingContext2D} ctx
     * @param {number} cx
     * @param {number} cy
     * @param {boolean} isCharging
     * @param {number} chargeProgress  0~1
     * @param {number} reloadProgress  0~1
     */
    render_combat_launcherEmitterBase(ctx, cx, cy, isCharging, chargeProgress, reloadProgress = 0, aimRotation = -Math.PI / 2) {
        const baseImg = getUiBitmap(EMITTER_BASE_SRC);
        const barrelImg = getUiBitmap(EMITTER_BARREL_SRC);
        const ringImg = getUiBitmap(EMITTER_RING_SRC);
        // @perf-impact: Combat emitter art draw uses one stationary base draw, an optional rotating barrel draw, short-lived barrel fire overlays (capped <=4: one bright bloom+cone during the flash window + one cooling ember radial gradient that fades over ~600-900ms, both gated by quality!=='low'), and the existing optional charging overlay; no particles or dynamic bitmap generation.
        const baseSize = EMITTER_DRAW_SIZE;
        const barrelSize = EMITTER_BARREL_DRAW_SIZE;
        const ringSize = EMITTER_RING_DRAW_SIZE;
        const quality = this.perfQualityLevel || 'high';
        const barrelRotation = (Number.isFinite(aimRotation) ? aimRotation : -Math.PI / 2) + Math.PI / 2;
        const recoilY = Math.sin(Math.max(0, Math.min(1, reloadProgress || 0)) * Math.PI) * 4;
        const now = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
        if (baseImg) {
            ctx.save();
            ctx.translate(0, recoilY);
            ctx.drawImage(baseImg, cx - baseSize / 2, cy - baseSize / 2, baseSize, baseSize);
            ctx.restore();
        }

        if (ringImg) {
            ctx.save();
            ctx.translate(cx, cy + recoilY + 4);
            ctx.rotate(barrelRotation);
            ctx.drawImage(
                ringImg,
                -ringSize / 2,
                -ringSize / 2,
                ringSize,
                ringSize
            );
            ctx.restore();
        }

        if (barrelImg) {
            ctx.save();
            ctx.translate(cx, cy + recoilY);
            ctx.rotate(barrelRotation);
            const barrelPivotX = barrelSize * 0.5;
            const barrelPivotY = barrelSize * 0.84;
            ctx.drawImage(
                barrelImg,
                -barrelPivotX,
                -barrelPivotY,
                barrelSize,
                barrelSize
            );
            if (isCharging) {
                const t = Math.max(0, Math.min(1, chargeProgress || 0));
                const pulse = 0.72 + Math.sin(now * 0.018) * 0.12;
                const chargeStartY = -barrelPivotY + 28;
                const chargeEndY = -barrelPivotY + 90;
                ctx.globalCompositeOperation = 'screen';
                ctx.lineCap = 'round';
                if (quality !== 'low') {
                    ctx.shadowColor = '#67e8f9';
                    ctx.shadowBlur = _sb(9 + t * 13);
                }

                ctx.globalAlpha = (0.18 + t * 0.36) * pulse;
                ctx.strokeStyle = '#164e63';
                ctx.lineWidth = 14 + t * 8;
                ctx.beginPath();
                ctx.moveTo(0, chargeStartY);
                ctx.lineTo(0, chargeEndY);
                ctx.stroke();

                ctx.globalAlpha = (0.38 + t * 0.48) * pulse;
                ctx.strokeStyle = '#67e8f9';
                ctx.lineWidth = 4 + t * 3.5;
                ctx.beginPath();
                ctx.moveTo(0, chargeStartY + 2);
                ctx.lineTo(0, chargeEndY - 3);
                ctx.stroke();

                ctx.globalAlpha = 0.38 + t * 0.42;
                ctx.strokeStyle = '#fef3c7';
                ctx.lineWidth = 1.4 + t * 1.2;
                const railOffset = 6 + t * 1.5;
                ctx.beginPath();
                ctx.moveTo(-railOffset, chargeStartY + 8);
                ctx.lineTo(-railOffset * 0.45, chargeEndY - 8);
                ctx.moveTo(railOffset, chargeStartY + 8);
                ctx.lineTo(railOffset * 0.45, chargeEndY - 8);
                ctx.stroke();

                const ringCount = quality === 'low' ? 1 : 3;
                for (let i = 0; i < ringCount; i++) {
                    const y = chargeStartY + 13 + i * 18 + Math.sin(now * 0.014 + i) * 1.5;
                    ctx.globalAlpha = (0.22 + t * 0.28) * (1 - i * 0.14);
                    ctx.beginPath();
                    ctx.ellipse(0, y, 8 + t * 4 - i * 0.6, 2.2 + t * 1.2, 0, 0, Math.PI * 2);
                    ctx.stroke();
                }
            }
            ctx.restore();
        }

        const activeFx = [];
        (this._launcherBarrelFireFx || []).forEach(fx => {
            const age = now - fx.born;
            const life = fx.life || 700;
            if (age < 0 || age > life) return;
            activeFx.push(fx);

            const dir = fx.dir || { x: 0, y: -1 };
            const rotation = Math.atan2(dir.y, dir.x) + Math.PI / 2;
            const intensity = fx.intensity || 1;
            const elementColor = fx.color || '#fef3c7';
            const muzzleX = cx + dir.x * EMITTER_PORT_OFFSET_Y;
            const muzzleY = cy + recoilY + dir.y * EMITTER_PORT_OFFSET_Y;

            // ── 冷却热辉余烬层（贯穿整段生命：白炽 → 元素色 → 暗烬，半径收缩、渐隐） ──
            // 让"发射好了"之后炮口还残留一团逐渐冷却的热辉，而不是瞬间消失。
            const coolT = age / life;                          // 0→1 整体进度
            const coolFade = Math.pow(1 - coolT, 1.5);         // 余烬淡出曲线
            const heatColor = lerpColor('#fff4d6', elementColor, Math.min(1, coolT * 1.8));
            const emberColor = lerpColor(heatColor, '#1a1206', Math.max(0, coolT - 0.45) * 1.5);
            const glowR = (20 + 16 * intensity) * (0.55 + 0.6 * coolFade);
            const coolAlpha = coolFade * (0.34 + 0.16 * intensity);
            if (coolAlpha > 0.012) {
                ctx.save();
                ctx.translate(muzzleX, muzzleY);
                ctx.rotate(rotation);
                ctx.globalCompositeOperation = 'screen';
                if (quality !== 'low') {
                    const grad = ctx.createRadialGradient(0, glowR * 0.18, 0, 0, glowR * 0.18, glowR);
                    grad.addColorStop(0, hexToRgba(emberColor, coolAlpha));
                    grad.addColorStop(0.45, hexToRgba(emberColor, coolAlpha * 0.5));
                    grad.addColorStop(1, hexToRgba(emberColor, 0));
                    ctx.fillStyle = grad;
                } else {
                    ctx.globalAlpha = coolAlpha * 0.8;
                    ctx.fillStyle = emberColor;
                }
                // 沿炮管轴向(纵向)略拉长，模拟炮口余温向管内回退
                ctx.beginPath();
                ctx.ellipse(0, glowR * 0.18, glowR * 0.72, glowR, 0, 0, Math.PI * 2);
                ctx.fill();
                ctx.restore();
            }

            // ── 发射火光层（仅前段：大而炸裂的白核爆发 + 喷口光锥 + 美术帧） ──
            const flashLife = fx.flashLife || 150;
            if (age <= flashLife) {
                const t = age / flashLife;                     // 0→1 火光进度
                const ease = 1 - Math.pow(1 - t, 2);
                const pop = Math.sin(Math.min(1, t) * Math.PI);
                const frameIndex = Math.min(
                    EMITTER_MUZZLE_FLASH_SRCS.length - 1,
                    Math.floor(t * EMITTER_MUZZLE_FLASH_SRCS.length)
                );
                const flashImg = getUiBitmap(EMITTER_MUZZLE_FLASH_SRCS[frameIndex]);
                const baseFlash = 78 + 46 * intensity;          // 大幅放大（原仅 34~42px）
                const flashSize = baseFlash * (0.72 + 0.42 * ease);
                const flashAlpha = Math.min(0.95, (1 - t) * (0.6 + 0.34 * intensity));

                ctx.save();
                ctx.translate(muzzleX, muzzleY);
                ctx.rotate(rotation);
                ctx.globalCompositeOperation = 'screen';

                if (quality !== 'low') {
                    // 1) 径向爆发泛光：白核 → 暖白 → 元素色 → 透明
                    const bloomR = flashSize * 0.8;
                    const bloomY = -flashSize * 0.18;
                    const bloom = ctx.createRadialGradient(0, bloomY, 0, 0, bloomY, bloomR);
                    bloom.addColorStop(0, hexToRgba('#ffffff', flashAlpha));
                    bloom.addColorStop(0.26, hexToRgba('#fff3c4', flashAlpha * 0.9));
                    bloom.addColorStop(0.62, hexToRgba(elementColor, flashAlpha * 0.5));
                    bloom.addColorStop(1, hexToRgba(elementColor, 0));
                    ctx.fillStyle = bloom;
                    ctx.beginPath();
                    ctx.arc(0, bloomY, bloomR, 0, Math.PI * 2);
                    ctx.fill();

                    // 2) 喷口冲击光锥：沿炮管方向(−Y)喷出的尖瓣
                    const coneLen = flashSize * (0.95 + 0.35 * pop);
                    const coneW = flashSize * 0.24;
                    ctx.globalAlpha = flashAlpha * 0.85;
                    ctx.fillStyle = hexToRgba('#fff7e0', 1);
                    ctx.beginPath();
                    ctx.moveTo(0, -coneLen);
                    ctx.quadraticCurveTo(coneW, -coneLen * 0.28, 0, flashSize * 0.2);
                    ctx.quadraticCurveTo(-coneW, -coneLen * 0.28, 0, -coneLen);
                    ctx.fill();
                    ctx.globalAlpha = 1;
                }

                // 3) 美术帧叠加（带元素色辉光）
                if (flashImg) {
                    if (quality !== 'low') {
                        ctx.shadowColor = elementColor;
                        ctx.shadowBlur = _sb(10 * (1 - t) * intensity);
                    }
                    ctx.globalAlpha = Math.min(1, flashAlpha + 0.1);
                    ctx.drawImage(flashImg, -flashSize / 2, -flashSize * 0.72, flashSize, flashSize);
                    ctx.shadowBlur = 0;
                }
                ctx.restore();
            }
        });
        this._launcherBarrelFireFx = activeFx;

        // ── [开炮 VFX 增强] 开炮反馈：屏幕震动 + 边缘闪光（不依赖 PixiJS） ──
        for (const fx of activeFx) {
            if (!fx._v2Spawned) {
                fx._v2Spawned = true;
                // 开炮屏幕震动（开幕齐射更强烈）
                if (fx.charged) {
                    if (typeof this.triggerScreenShake === 'function') this.triggerScreenShake(3);
                    if (typeof this.triggerScreenShakeAdvanced === 'function') this.triggerScreenShakeAdvanced(2, 8);
                }
                // 开炮边缘闪光标记
                this._fireFlashFrames = fx.charged ? 4 : 2;
            }
        }

        // ── [开炮 VFX 增强] PixiJS V2 特效：惰性创建 + 更新 + 绘制 + 清理 ──
        if (pixiIsActive()) {
            // 惰性创建：首次渲染时为每个火光 FX 创建 V2 特效
            for (const fx of activeFx) {
                if (fx._v2Spawned && !fx._v2Created) {
                    fx._v2Created = true;
                    const muzzleX = cx + fx.dir.x * EMITTER_PORT_OFFSET_Y;
                    const muzzleY = cy + recoilY + fx.dir.y * EMITTER_PORT_OFFSET_Y;
                    const angle = Math.atan2(fx.dir.y, fx.dir.x);

                    this._muzzleFlashesV2 = this._muzzleFlashesV2 || [];
                    this._muzzleFlashesV2.push(new MuzzleFlashV2(muzzleX, muzzleY, angle, fx.color, fx.intensity));

                    this._firingBursts = this._firingBursts || [];
                    this._firingBursts.push(new FiringBurst(muzzleX, muzzleY, angle, fx.color, fx.intensity));
                }
            }

            // 更新 & 绘制 MuzzleFlashV2
            const dtSec = (this.timeScale || 1) / 60;
            if (this._muzzleFlashesV2) {
                for (let i = this._muzzleFlashesV2.length - 1; i >= 0; i--) {
                    const mf = this._muzzleFlashesV2[i];
                    mf.update(dtSec);
                    mf.draw(ctx);
                    if (mf.dead) {
                        if (mf._pixi) { muzzleFlashV2_pixiDestroy(mf._pixi); mf._pixi = null; }
                        this._muzzleFlashesV2.splice(i, 1);
                    }
                }
            }

            // 更新 & 绘制 FiringBurst
            if (this._firingBursts) {
                for (let i = this._firingBursts.length - 1; i >= 0; i--) {
                    const fb = this._firingBursts[i];
                    fb.update(dtSec);
                    fb.draw(ctx);
                    if (fb.dead) {
                        if (fb._pixi) { firingBurst_pixiDestroy(fb._pixi); fb._pixi = null; }
                        this._firingBursts.splice(i, 1);
                    }
                }
            }
        }

        // ── [开炮 VFX 增强] 开炮边缘闪光（Canvas 2D 全屏叠加） ──
        if (this._fireFlashFrames > 0) {
            const flashAlpha = (this._fireFlashFrames / 4) * 0.08;
            ctx.save();
            // 抵消 translate(cx, cy) 以覆盖全屏
            ctx.translate(-cx, -cy);
            ctx.fillStyle = `rgba(255, 255, 255, ${flashAlpha})`;
            ctx.fillRect(0, 0, this.width, this.height);
            ctx.restore();
            this._fireFlashFrames--;
        }

        if (isCharging) {
            const t = Math.max(0, Math.min(1, chargeProgress || 0));
            const idx = Math.min(EMITTER_CHARGING_SRCS.length - 1, Math.floor(t * EMITTER_CHARGING_SRCS.length));
            const chargeImg = getUiBitmap(EMITTER_CHARGING_SRCS[idx]);
            if (chargeImg) {
                ctx.save();
                ctx.translate(0, recoilY);
                ctx.globalCompositeOperation = 'screen';
                ctx.globalAlpha = 0.6 + t * 0.4;
                ctx.drawImage(chargeImg, cx - baseSize / 2, cy - baseSize / 2, baseSize, baseSize);
                ctx.restore();
            }
        }
    },

/**
     * [RENDER] 绘制基于偏移量的屏幕边缘渐变泛光（Edge Vignette）。
     * @description 当手机/鼠标向左偏移时，屏幕左侧边缘出现蓝紫色发光；
     *              向右偏移时，右侧边缘发光。偏移越大，发光范围和透明度越高。
     * @param {CanvasRenderingContext2D} ctx - Canvas 2D 上下文
     * @param {object} tilt - 偏移对象，包含 x 属性（范围 -1 ~ 1）
     */
    drawTiltVignette(ctx, tilt) {
        const tiltX = tilt.x;
        const absTilt = Math.abs(tiltX);
        if (absTilt < 0.02) return; // 偏移量极小时不绘制，避免性能浪费

        ctx.save();
        ctx.globalCompositeOperation = 'screen'; // [T4-C] 从 'source-over' 改为 'screen'，让边缘泛光更有全息投影感

        const vignetteWidth = this.width * 0.35; // [修改] 泛光宽度从 0.45 降低到 0.35
        const maxAlpha = 0.35; // [T4-C] 最大透明度从 0.25 提升到 0.35，增强科幻感
        const alpha = absTilt * maxAlpha;

        if (tiltX < 0) {
            // 向左偏移：左侧边缘发光（蓝紫色）
            const grad = ctx.createLinearGradient(0, 0, vignetteWidth * absTilt, 0);
            grad.addColorStop(0, `rgba(99, 102, 241, ${alpha})`);   // Indigo-500
            grad.addColorStop(0.5, `rgba(139, 92, 246, ${alpha * 0.5})`); // Violet-500
            grad.addColorStop(1, 'rgba(139, 92, 246, 0)');
            ctx.fillStyle = grad;
            ctx.fillRect(0, 0, vignetteWidth * absTilt, this.height);
        } else {
            // 向右偏移：右侧边缘发光（蓝紫色）
            const startX = this.width - vignetteWidth * absTilt;
            const grad = ctx.createLinearGradient(this.width, 0, startX, 0);
            grad.addColorStop(0, `rgba(99, 102, 241, ${alpha})`);   // Indigo-500
            grad.addColorStop(0.5, `rgba(139, 92, 246, ${alpha * 0.5})`); // Violet-500
            grad.addColorStop(1, 'rgba(139, 92, 246, 0)');
            ctx.fillStyle = grad;
            ctx.fillRect(startX, 0, vignetteWidth * absTilt, this.height);
        }

        ctx.restore();
    },

/**
     * [RENDER] 绘制水平仪样式的偏移指示器（Tilt Gauge）。
     * @description 在屏幕底部绘制一个水平仪，中心为平衡点，光标随 boardTilt.current.x
     *              左右移动，偏移越大颜色越偏红。
     * @param {CanvasRenderingContext2D} ctx - Canvas 2D 上下文
     * @param {object} tilt - 偏移对象，包含 x 属性（范围 -1 ~ 1）
     */
    drawTiltIndicator(ctx, tilt) {
        const tiltX = Math.max(-1, Math.min(1, tilt.x)); // 限制在 -1 ~ 1 范围内

        ctx.save();

        // --- 布局参数 ---
        const gaugeWidth = this.width * 0.55;  // 仪表盘总宽度
        const gaugeHeight = 8;                  // 仪表盘轨道高度
        const gaugeX = (this.width - gaugeWidth) / 2; // 居中
        const gaugeY = this.height - 22;        // 距离底部 22px
        const cursorRadius = 7;                 // 光标半径

        // --- 颜色计算：偏移越大越红 ---
        const absTilt = Math.abs(tiltX);
        // 从青色(平衡) -> 黄色(中等偏移) -> 红色(大偏移)
        let r, g, b;
        if (absTilt < 0.5) {
            // 0 ~ 0.5: 青色 (0, 200, 255) -> 黄色 (255, 220, 0)
            const t = absTilt / 0.5;
            r = Math.round(0 + t * 255);
            g = Math.round(200 + t * 20);
            b = Math.round(255 - t * 255);
        } else {
            // 0.5 ~ 1: 黄色 (255, 220, 0) -> 红色 (255, 50, 0)
            const t = (absTilt - 0.5) / 0.5;
            r = 255;
            g = Math.round(220 - t * 170);
            b = 0;
        }
        const cursorColor = `rgb(${r}, ${g}, ${b})`;
        const cursorAlpha = 0.5 + absTilt * 0.5; // 偏移越大越不透明

        // --- 绘制轨道背景 ---
        ctx.globalAlpha = 0.6;
        ctx.fillStyle = 'rgba(15, 23, 42, 0.7)';
        const trackRadius = gaugeHeight / 2;
        ctx.beginPath();
        ctx.roundRect(gaugeX, gaugeY - trackRadius, gaugeWidth, gaugeHeight, trackRadius);
        ctx.fill();

        // --- 绘制轨道边框 ---
        ctx.strokeStyle = 'rgba(148, 163, 184, 0.4)';
        ctx.lineWidth = 1;
        ctx.stroke();

        // --- 绘制中心平衡线 ---
        ctx.globalAlpha = 0.7;
        ctx.strokeStyle = 'rgba(148, 163, 184, 0.8)';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([3, 3]);
        ctx.beginPath();
        ctx.moveTo(this.width / 2, gaugeY - trackRadius - 3);
        ctx.lineTo(this.width / 2, gaugeY + trackRadius + 3);
        ctx.stroke();
        ctx.setLineDash([]);

        // --- 计算光标位置 ---
        const cursorX = this.width / 2 + tiltX * (gaugeWidth / 2 - cursorRadius);
        const cursorY = gaugeY;

        // --- 绘制光标发光效果 ---
        ctx.globalAlpha = cursorAlpha * 0.4;
        ctx.shadowBlur = _sb(12);
        ctx.shadowColor = cursorColor;
        ctx.fillStyle = cursorColor;
        ctx.beginPath();
        ctx.arc(cursorX, cursorY, cursorRadius + 3, 0, Math.PI * 2);
        ctx.fill();

        // --- 绘制光标主体 ---
        ctx.globalAlpha = cursorAlpha;
        ctx.shadowBlur = _sb(8);
        ctx.shadowColor = cursorColor;
        ctx.fillStyle = cursorColor;
        ctx.beginPath();
        ctx.arc(cursorX, cursorY, cursorRadius, 0, Math.PI * 2);
        ctx.fill();

        // --- 绘制光标高光 ---
        ctx.globalAlpha = cursorAlpha * 0.8;
        ctx.shadowBlur = 0;
        ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
        ctx.beginPath();
        ctx.arc(cursorX - 2, cursorY - 2, cursorRadius * 0.4, 0, Math.PI * 2);
         ctx.fill();
        ctx.restore();
    },

    /**
     * [自适应性能] 在 Canvas 左上角绘制 FPS 和性能等级指示层。
     * 仅在调试模式或性能降级时显示，不影响游戏玩法。
     */
    render_perfOverlay() {
        // 仅在非 HIGH 等级时显示（提示玩家性能已降级）
        if (this.perfQualityLevel === 'high') return;
        const ctx = this.ctx;
        const level = this.perfQualityLevel;
        const fps = this.avgFps;
        const levelColor = level === 'medium' ? '#facc15' : '#f87171'; // 黄色=均衡，红色=省电
        const label = level === 'medium' ? '均衡模式' : '省电模式';
        ctx.save();
        ctx.globalAlpha = 0.75;
        ctx.fillStyle = 'rgba(0,0,0,0.55)';
        ctx.beginPath();
        ctx.roundRect(6, 6, 108, 36, 6);
        ctx.fill();
        ctx.globalAlpha = 1;
        ctx.font = 'bold 11px monospace';
        ctx.fillStyle = '#94a3b8';
        ctx.fillText(`FPS: ${fps}`, 14, 22);
        ctx.fillStyle = levelColor;
        ctx.fillText(label, 14, 36);
        ctx.restore();
    },
};
