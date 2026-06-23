import { 
    META_SHOP_CONFIG, ATTRIBUTES_FOR_SHOP, setDeepValue, CONFIG, RELIC_DB, SKILL_DB 
} from './config.js';
import { 
    Vec2, MarbleDefinition, SpecialSlot, FortuneWheel, Peg, DropBall, Enemy, SwordQi, 
    SlashAnim, SonSword, Projectile, CloneSpore, Particle, SlashEffect, CollectionBeam, 
    Shockwave, LaserBeam, FloatingText, EnergyOrb, LightningBolt, FireWave, showToast, 
    rotateTowards, adjustColorBrightness, lerpColor, lerp, hexToRgba 
} from './entities.js';
import { UIManager, TrainingGround, TruthBook } from './systems.js';
import { audio } from './audio.js';
import { sb as _sb } from './utils/perf.js';
import {
    getUiBitmap,
    EMITTER_BASE_SRC,
    EMITTER_BARREL_SRC,
    EMITTER_DRAW_SIZE,
    EMITTER_BARREL_DRAW_SIZE,
    EMITTER_CHARGING_SRCS,
    BG_MAIN_CANVAS_SRC,
    BG_EMITTER_ZONE_SRC,
    BG_COMBAT_TABLE_SRC,
    BG_COMBAT_EMITTER_ZONE_SRC,
    COMBAT_WALL_LEFT_SRC,
    COMBAT_WALL_RIGHT_SRC,
    COMBAT_WALL_TOP_SRC,
    getAmmoIconSrc,
    getAmmoIconSrcByKey,
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
        const hasWallArt = leftImg && rightImg && topImg;

        ctx.save();
        if (hasWallArt) {
            // @perf-impact: Combat wall V2 art adds up to three static drawImage calls per combat frame; no particles, gradients, or dynamic bitmap generation.
            ctx.globalAlpha = 0.9;
            ctx.drawImage(leftImg, wallLeftX, wallTopY, wallW, wallH);
            ctx.drawImage(rightImg, wallRightX - wallW, wallTopY, wallW, wallH);
            ctx.drawImage(topImg, wallLeftX, wallTopY - topH + 8, wallRightX - wallLeftX, topH);

            ctx.globalAlpha = 1;
            ctx.strokeStyle = 'rgba(148, 226, 232, 0.58)';
            ctx.lineWidth = 1.25;
            ctx.shadowColor = '#38bdf8';
            ctx.shadowBlur = _sb(8);
            ctx.beginPath();
            ctx.moveTo(wallLeftX + 1, wallTopY);
            ctx.lineTo(wallLeftX + 1, this.height);
            ctx.moveTo(wallRightX - 1, wallTopY);
            ctx.lineTo(wallRightX - 1, this.height);
            ctx.moveTo(wallLeftX, wallTopY);
            ctx.lineTo(wallRightX, wallTopY);
            ctx.stroke();
            ctx.restore();
            return;
        }

        const wallGradLeft = ctx.createLinearGradient(wallLeftX, 0, wallLeftX + 20, 0);
        wallGradLeft.addColorStop(0, 'rgba(56, 189, 248, 0.25)');
        wallGradLeft.addColorStop(0.3, 'rgba(148, 163, 184, 0.1)');
        wallGradLeft.addColorStop(1, 'rgba(148, 163, 184, 0)');
        ctx.fillStyle = wallGradLeft;
        ctx.fillRect(wallLeftX, wallTopY, 20, wallH);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.fillRect(wallLeftX, wallTopY, 1, wallH);

        const wallGradRight = ctx.createLinearGradient(wallRightX, 0, wallRightX - 20, 0);
        wallGradRight.addColorStop(0, 'rgba(56, 189, 248, 0.25)');
        wallGradRight.addColorStop(0.3, 'rgba(148, 163, 184, 0.1)');
        wallGradRight.addColorStop(1, 'rgba(148, 163, 184, 0)');
        ctx.fillStyle = wallGradRight;
        ctx.fillRect(wallRightX - 20, wallTopY, 20, wallH);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.fillRect(wallRightX - 1, wallTopY, 1, wallH);

        ctx.strokeStyle = 'rgba(148, 163, 184, 0.4)';
        ctx.lineWidth = 2;
        ctx.shadowColor = '#38bdf8';
        ctx.shadowBlur = _sb(15);
        ctx.beginPath();
        ctx.moveTo(wallLeftX + 1, wallTopY); ctx.lineTo(wallLeftX + 1, this.height);
        ctx.moveTo(wallRightX - 1, wallTopY); ctx.lineTo(wallRightX - 1, this.height);
        ctx.moveTo(wallLeftX, wallTopY); ctx.lineTo(wallRightX, wallTopY);
        ctx.stroke();
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
     * [RENDER] 绘制发射器的下一发可读性信号：左屏读数、中央弹仓、底部装填格和连射能量条。
     * @perf-impact: 发射器下一发信号 - 每帧固定绘制 6 个装填格、5 段连射能量条和少量文本；low 档关闭 shadowBlur。
     */
    render_combat_launcherSignal(ctx, cx, cy, portX, portY, recipe, visual = {}) {
        if (!recipe) return;
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
        const screen = { x: -51 * bodyScale, y: -9 * bodyScale + recoilY, w: 19 * bodyScale, h: 38 * bodyScale };
        const capacitor = { x: 38 * bodyScale, y: -17 * bodyScale + recoilY, w: 14 * bodyScale, h: 47 * bodyScale };
        const magazine = {
            y: 43 * bodyScale + recoilY,
            centers: [-29, -18, -7, 7, 18, 29].map(x => x * bodyScale),
        };
        const pelletCount = profile.scatterPelletCount;

        const drawValueScreen = () => {
            ctx.save();
            const value = String(profile.damage);
            const maxValueWidth = screen.w - 2 * bodyScale;
            let valueSize = 8.5 * bodyScale;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillStyle = 'rgba(103, 232, 249, 0.82)';
            ctx.font = `bold ${4.2 * bodyScale}px Cinzel`;
            ctx.fillText('DMG', screen.x + screen.w / 2, screen.y + 7 * bodyScale);
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
            ctx.fillText(value, screen.x + screen.w / 2, screen.y + 18 * bodyScale);
            ctx.shadowBlur = 0;
            ctx.strokeStyle = `rgba(103, 232, 249, ${0.28 + pulse * 0.14})`;
            ctx.lineWidth = 0.5 * bodyScale;
            ctx.beginPath();
            ctx.moveTo(screen.x + 2 * bodyScale, screen.y + 25 * bodyScale);
            ctx.lineTo(screen.x + screen.w - 2 * bodyScale, screen.y + 25 * bodyScale);
            ctx.stroke();
            ctx.fillStyle = '#fef3c7';
            ctx.font = `bold ${5.8 * bodyScale}px Cinzel`;
            ctx.fillText(`S${Math.max(1, pelletCount)}`, screen.x + screen.w / 2, screen.y + 32 * bodyScale);
            ctx.restore();
        };

        const drawBurstStack = () => {
            ctx.save();
            ctx.globalAlpha = 0.94;
            const maxSegments = 5;
            const litSegments = Math.max(1, Math.min(maxSegments, profile.multicastCount));
            for (let i = 0; i < maxSegments; i++) {
                const lit = i < litSegments;
                const x = capacitor.x + 3 * bodyScale;
                const y = capacitor.y + capacitor.h - (6.8 + i * 6.7) * bodyScale;
                const w = capacitor.w - 6 * bodyScale;
                ctx.beginPath();
                ctx.roundRect(x, y, w, 4.8 * bodyScale, 2.2 * bodyScale);
                ctx.fillStyle = lit ? `rgba(251, 191, 36, ${0.72 + pulse * 0.18})` : 'rgba(30, 41, 59, 0.5)';
                if (lit && glowFx) {
                    ctx.shadowColor = '#f59e0b';
                    ctx.shadowBlur = _sb(4 + chargeProgress * 5);
                }
                ctx.fill();
                ctx.shadowBlur = 0;
                ctx.strokeStyle = lit ? 'rgba(255,255,255,0.5)' : 'rgba(100,116,139,0.34)';
                ctx.lineWidth = 0.7;
                ctx.stroke();
            }
            ctx.fillStyle = '#fef3c7';
            ctx.font = `bold ${5.8 * bodyScale}px Cinzel`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(`x${profile.multicastCount}`, capacitor.x + capacitor.w / 2, capacitor.y - 1.5 * bodyScale);
            ctx.restore();
        };

        const drawAttributeMagazine = () => {
            const loadEntries = profile.entries.length > 0 ? profile.entries : [profile.primary];
            ctx.save();
            for (let i = 0; i < 6; i++) {
                const lit = i < profile.loadCount;
                const entry = loadEntries[i % loadEntries.length] || profile.primary;
                const x = magazine.centers[i];
                const color = entry.color || accent;
                ctx.beginPath();
                ctx.arc(x, magazine.y, 5.2 * bodyScale, 0, Math.PI * 2);
                ctx.fillStyle = lit ? 'rgba(15, 23, 42, 0.86)' : 'rgba(30, 41, 59, 0.56)';
                ctx.globalAlpha = lit ? 0.95 : 0.55;
                ctx.fill();
                ctx.strokeStyle = lit ? color : 'rgba(100,116,139,0.45)';
                ctx.lineWidth = lit ? 1 * bodyScale : 0.75;
                ctx.stroke();
                if (lit) {
                    const smallIcon = getUiBitmap(getAmmoIconSrcByKey(entry.key));
                    if (glowFx) {
                        ctx.shadowColor = color;
                        ctx.shadowBlur = _sb(5);
                    }
                    if (smallIcon) {
                        ctx.drawImage(smallIcon, x - 3.2 * bodyScale, magazine.y - 3.2 * bodyScale, 6.4 * bodyScale, 6.4 * bodyScale);
                    } else {
                        ctx.fillStyle = color;
                        ctx.beginPath();
                        ctx.arc(x, magazine.y, 2.6 * bodyScale, 0, Math.PI * 2);
                        ctx.fill();
                    }
                    ctx.shadowBlur = 0;
                }
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
        drawValueScreen();
        drawBurstStack();
        drawAttributeMagazine();

        ctx.restore();
    },

    /**
     * [RENDER] 排队一次基于炮管方向的发射闪光。
     * @perf-impact: launcher barrel flash is a short-lived fixed-shape canvas overlay; it does not create particles, shockwaves, gradients, or new CONFIG.performance budgets.
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
        const now = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
        this._launcherBarrelFireFx = (this._launcherBarrelFireFx || []).slice(-4);
        this._launcherBarrelFireFx.push({
            dir,
            color,
            born: now,
            life: 220,
            intensity: recipe._openingSalvo ? 1.25 : 1,
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
        // @perf-impact: Combat emitter art draw uses one stationary base draw, an optional rotating barrel draw, short-lived barrel flash overlays, and the existing optional charging overlay; no particles or dynamic bitmap generation.
        const baseSize = EMITTER_DRAW_SIZE;
        const barrelSize = EMITTER_BARREL_DRAW_SIZE;
        const barrelRotation = (Number.isFinite(aimRotation) ? aimRotation : -Math.PI / 2) + Math.PI / 2;
        const recoilY = Math.sin(Math.max(0, Math.min(1, reloadProgress || 0)) * Math.PI) * 4;
        if (baseImg) {
            ctx.save();
            ctx.translate(0, recoilY);
            ctx.drawImage(baseImg, cx - baseSize / 2, cy - baseSize / 2, baseSize, baseSize);
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
            ctx.restore();
        }

        const now = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
        const quality = this.perfQualityLevel || 'high';
        const activeFx = [];
        (this._launcherBarrelFireFx || []).forEach(fx => {
            const age = now - fx.born;
            if (age < 0 || age > fx.life) return;
            activeFx.push(fx);
            const t = age / fx.life;
            const alpha = (1 - t) * (0.82 + (fx.intensity || 1) * 0.12);
            const dir = fx.dir || { x: 0, y: -1 };
            const rotation = Math.atan2(dir.y, dir.x) + Math.PI / 2;
            const stretch = 1 + t * 0.35;
            ctx.save();
            ctx.translate(cx, cy + recoilY);
            ctx.rotate(rotation);
            ctx.globalCompositeOperation = 'screen';
            ctx.globalAlpha = Math.max(0, Math.min(0.95, alpha));
            if (quality !== 'low') {
                ctx.shadowColor = fx.color || '#fef3c7';
                ctx.shadowBlur = _sb(12 * (1 - t));
            }
            ctx.fillStyle = fx.color || '#fef3c7';
            ctx.beginPath();
            ctx.ellipse(0, -30 * stretch, (5 + 9 * t) * (fx.intensity || 1), 22 * (1 - t * 0.15), 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.globalAlpha *= 0.72;
            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            ctx.ellipse(0, -39 * stretch, 3.2 + 5 * t, 10 * (1 - t * 0.2), 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.shadowBlur = 0;
            ctx.strokeStyle = fx.color || '#fef3c7';
            ctx.lineWidth = 1.2;
            ctx.beginPath();
            ctx.moveTo(-4 - 5 * t, -12);
            ctx.lineTo(0, -55 * stretch);
            ctx.lineTo(4 + 5 * t, -12);
            ctx.stroke();
            ctx.restore();
        });
        this._launcherBarrelFireFx = activeFx;

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
