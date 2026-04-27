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
import {
    getUiBitmap,
    ORBITAL_SOCKET_MAP,
    ORBITAL_LINK_STRIP,
    ORBITAL_LINK_CAP,
    ORBITAL_LINK_FLOW,
    ORBITAL_INTAKE,
    EMITTER_BASE_SRC,
    EMITTER_CHARGING_SRCS,
    BG_MAIN_CANVAS_SRC,
    BG_EMITTER_ZONE_SRC,
    getAmmoIconSrcByKey,
} from './bitmap_icons.js';

export const render_system = {
/**
     * [RENDER] 清理画布并绘制背景色。
     */
    render_clearCanvas() {
        this.ctx.clearRect(0, 0, this.width, this.height);
        this.ctx.fillStyle = CONFIG.colors.bg;
        this.ctx.fillRect(0, 0, this.width, this.height);
        // 主底图位图（已生成 720×1280 暗黑赛博炼金风），未加载完成时回退到纯色底
        const bgMain = getUiBitmap(BG_MAIN_CANVAS_SRC);
        if (bgMain) {
            this.ctx.save();
            this.ctx.globalAlpha = 0.85;
            this.ctx.drawImage(bgMain, 0, 0, this.width, this.height);
            this.ctx.restore();
        }
        // 发射器区域（底部 220px 高的炼金台层），仅在战斗 / 研磨阶段叠加
        if (this.phase === 'combat' || this.phase === 'gathering') {
            const bgEmitter = getUiBitmap(BG_EMITTER_ZONE_SRC);
            if (bgEmitter) {
                const zoneH = 220;
                this.ctx.save();
                this.ctx.globalAlpha = 0.9;
                this.ctx.drawImage(bgEmitter, 0, this.height - zoneH, this.width, zoneH);
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

    render_windAnchors() {
        if (this.windAnchors && this.windAnchors.length > 0) {
            this.ctx.save();
            
            // 增强连线视觉：1.5倍宽度虚线 + 发光
            const linePulse = (Math.sin(Date.now() / 400) + 1) / 2;
            this.ctx.strokeStyle = 'rgba(52, 211, 153, ' + (0.5 + linePulse * 0.3) + ')';
            this.ctx.lineWidth = 3;
            this.ctx.setLineDash([8, 12]);
            this.ctx.shadowBlur = 10 + linePulse * 5;
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
                this.ctx.shadowBlur = 15 + pulse * 10;
                this.ctx.shadowColor = '#34d399';
                this.ctx.beginPath();
                this.ctx.arc(a.x, a.y, 8 + pulse * 4, 0, Math.PI * 2);
                this.ctx.fill();
                this.ctx.restore();
                
                // 绘制主体
                this.ctx.save();
                this.ctx.fillStyle = '#d1fae5';
                this.ctx.shadowBlur = 10;
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
                this.ctx.shadowBlur = 5;
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
        ctx.shadowBlur = 20 * progress;
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
            ctx.shadowBlur = 30;
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
     * @description 绘制发射器周围的属性轨道 (方案2：透明能量球环绕)
     */
    render_combat_launcherOrbitals(ctx, centerX, centerY, recipe) {
        if (!recipe) return;

        const stats = [];
        const mapping = {
            damage:    { val: recipe.damage > 2 ? recipe.damage : 0},
            bounce:    { val: recipe.bounce},
            pierce:    { val: recipe.pierce},
            scatter:   { val: recipe.scatter},
            cryo:      { val: recipe.cryo},
            multicast: { val: recipe.multicast},
            pyro:      { val: recipe.pyro},
            lightning: { val: recipe.lightning},
            laser:     { val: recipe.laser},
            explosive: { val: recipe.explosive ? 1 : 0},
            flying_sword: { val: recipe.flying_sword || 0 }
        };
        Object.keys(mapping).forEach(key => {
            // [icon-fix] 必须把 key 写回条目，否则下方 ORBITAL_SOCKET_MAP[stat.key] 永远拿到 undefined，
            // 导致 socket 位图永远走不进 if 分支，发射器环绕属性永远显示成 fallback 的彩色圆环。
            mapping[key].key = key;
            mapping[key].color = CONFIG.ui.attributeDisplay[key].color;
            mapping[key].icon = CONFIG.ui.attributeDisplay[key].icon;
            if (mapping[key].val > 0) stats.push(mapping[key]);
        });
        if (stats.length === 0) return;

        // --- 动画数值计算 ---
        let currentRotation = this.orbitalAngle;
        let baseRadius = 55;
        let globalAlpha = 1.0;
        let orbScale = 1.0;

        if (this.isChargingShot) {
            const t = this.chargeProgress;
            baseRadius = 55 * (1 - t * t); 
            currentRotation += t * 2; // 吸收时稍微加速旋转
            if (t > 0.8) globalAlpha = 1.0 - (t - 0.8) * 5;
            orbScale = 1 - t * 0.6;
        } 
        else if (this.isReloading) {
            const t = this.reloadProgress;
            // 使用 EaseInCubic，能量球会从远处缓缓启动，快撞击时猛地加速
            const easeVal = t * t * t; 
            const startDist = 450; // 从更远的地方（屏幕外）抓取回来
            const endDist = 55;
            baseRadius = startDist + (endDist - startDist) * easeVal;
            globalAlpha = easeVal;
            orbScale = 0.3 + 0.7 * easeVal;
            // 抓取时由于还没“合体”，产生轻微的抖动感
            const shake = (1 - t) * 5;
            baseRadius += (Math.random() - 0.5) * shake;
        }

        const radius = baseRadius;
        const stepAngle = (Math.PI * 2) / stats.length;
        
        ctx.save();
        ctx.translate(centerX, centerY);
        ctx.globalAlpha = Math.max(0, globalAlpha);

        // 绘制轨道线 (仅在非吸收状态画)
        if (radius > 15 && radius < 150) {
            ctx.beginPath();
            ctx.arc(0, 0, radius, 0, Math.PI * 2);
            ctx.strokeStyle = `rgba(255, 255, 255, ${0.1 * globalAlpha})`;
            ctx.lineWidth = 1;
            ctx.stroke();
        }

        // [bitmap-orbital] 预取连线相关位图（一次性 lookup）
        const linkStripImg = getUiBitmap(ORBITAL_LINK_STRIP);
        const linkCapImg   = getUiBitmap(ORBITAL_LINK_CAP);
        const flowFrameIdx = Math.floor((Date.now() / 90) % ORBITAL_LINK_FLOW.length);
        const flowImg      = getUiBitmap(ORBITAL_LINK_FLOW[flowFrameIdx]);

        stats.forEach((stat, index) => {
            const angle = stepAngle * index + currentRotation;
            const ox = Math.cos(angle) * radius;
            const oy = Math.sin(angle) * radius;

            // --- [报错防御点] ---
            // 如果计算出的位置不是有效的数字，跳过绘制，防止 createLinearGradient 崩溃
            if (!isFinite(ox) || !isFinite(oy)) return;

            const speedGlow = Math.min(1, this.spinBoost * 2); // 撞击后的高光
            const baseSize = Math.min(22, 14 + stat.val * 0.5);
            const currentSize = Math.max(0, baseSize * orbScale);

            // [bitmap-orbital] 优先使用元素 socket 贴图作为底座，未命中或未加载时 fallback 到原 arc
            const socketImg = getUiBitmap(ORBITAL_SOCKET_MAP[stat.key]);
            if (socketImg && currentSize > 4) {
                const socketSize = currentSize * 2.4; // 64×64 源图，按当前球径放大成"光环底座"
                ctx.save();
                ctx.shadowBlur = (8 + speedGlow * 18) * orbScale;
                ctx.shadowColor = stat.color;
                ctx.globalCompositeOperation = 'screen';
                ctx.drawImage(socketImg, ox - socketSize / 2, oy - socketSize / 2, socketSize, socketSize);
                ctx.restore();
            } else {
                ctx.shadowBlur = (10 + speedGlow * 20) * orbScale;
                ctx.shadowColor = stat.color;
                ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
                ctx.beginPath();
                ctx.arc(ox, oy, currentSize, 0, Math.PI * 2);
                ctx.fill();
                ctx.strokeStyle = stat.color;
                ctx.lineWidth = (2 + speedGlow * 2) * orbScale;
                ctx.stroke();
            }

            // 拖尾特效 (增强撞击爆发感)
            const totalTrail = this.spinBoost * 3 + (this.isReloading ? (1-this.reloadProgress) * 0.5 : 0);
            if (totalTrail > 0.05) {
                ctx.shadowBlur = 0;
                ctx.beginPath();
                ctx.strokeStyle = stat.color;
                ctx.lineWidth = 2 * orbScale;
                const dir = this.isReloading ? 1 : -1;
                ctx.arc(0, 0, radius, angle, angle + totalTrail * dir, this.isReloading);
                ctx.stroke();
            }

            // 绘制文字 (仅在大小合适时)
            // [bitmap-orbital-icon] 优先使用 AMMO_ICON_MAP 位图替代 emoji；位图未加载或属性
            // 无对应贴图（如 multicast）时回退到 emoji，保持视觉连续性。
            if (radius < 200 && currentSize > 8) {
                ctx.shadowBlur = 0; ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
                if (stat.isMulticast) {
                    ctx.font = `bold ${12 * orbScale}px monospace`;
                    ctx.fillText(`x${1 + stat.val}`, ox, oy);
                } else {
                    const iconSrc = getAmmoIconSrcByKey(stat.key);
                    const iconImg = iconSrc ? getUiBitmap(iconSrc) : null;
                    const iconBoxRaw = currentSize * 1.6;
                    if (stat.val > 1) {
                        const iconBox = iconBoxRaw * 0.85;
                        if (iconImg) {
                            ctx.drawImage(iconImg, ox - iconBox / 2, oy - 6 * orbScale - iconBox / 2, iconBox, iconBox);
                        } else {
                            ctx.font = `${10 * orbScale}px sans-serif`;
                            ctx.fillText(stat.icon, ox, oy - 5 * orbScale);
                        }
                        ctx.font = `bold ${9 * orbScale}px sans-serif`;
                        ctx.fillStyle = stat.color;
                        ctx.fillText(`${stat.val}`, ox, oy + 6 * orbScale);
                    } else {
                        if (iconImg) {
                            ctx.drawImage(iconImg, ox - iconBoxRaw / 2, oy - iconBoxRaw / 2, iconBoxRaw, iconBoxRaw);
                        } else {
                            ctx.font = `${14 * orbScale}px sans-serif`;
                            ctx.fillText(stat.icon, ox, oy);
                        }
                    }
                }
            }

            // --- 绘制连线：优先使用 strip 平铺贴图 + 端帽 + 流光，未加载时 fallback 到原 gradient ---
            if (radius > 10 && radius < 120) {
                const segLen = Math.hypot(ox, oy);
                const segAngle = Math.atan2(oy, ox);
                if (linkStripImg && segLen > 8) {
                    ctx.save();
                    ctx.globalCompositeOperation = 'screen';
                    ctx.globalAlpha = 0.55 * globalAlpha;
                    ctx.translate(0, 0);
                    ctx.rotate(segAngle);
                    // strip 高度按缩放调整，避免在 orbScale<1 时显得过粗
                    const stripH = 6 * orbScale;
                    ctx.drawImage(linkStripImg, 0, -stripH / 2, segLen, stripH);
                    ctx.restore();

                    // 流光：3 个错相位光点沿连线移动
                    if (flowImg) {
                        const flowSize = 8 * orbScale;
                        const phase = (Date.now() / 600) % 1;
                        ctx.save();
                        ctx.globalCompositeOperation = 'screen';
                        ctx.globalAlpha = 0.85 * globalAlpha;
                        for (let p = 0; p < 3; p++) {
                            const t = (phase + p / 3) % 1;
                            const fx = ox * t;
                            const fy = oy * t;
                            ctx.drawImage(flowImg, fx - flowSize / 2, fy - flowSize / 2, flowSize, flowSize);
                        }
                        ctx.restore();
                    }

                    // 端帽：覆盖连线两端硬切口
                    if (linkCapImg) {
                        const capSize = 12 * orbScale;
                        ctx.save();
                        ctx.globalCompositeOperation = 'screen';
                        ctx.globalAlpha = 0.7 * globalAlpha;
                        ctx.drawImage(linkCapImg, -capSize / 2, -capSize / 2, capSize, capSize);
                        ctx.drawImage(linkCapImg, ox - capSize / 2, oy - capSize / 2, capSize, capSize);
                        ctx.restore();
                    }
                } else {
                    ctx.save();
                    ctx.globalCompositeOperation = 'screen';
                    const grad = ctx.createLinearGradient(0, 0, ox, oy);
                    grad.addColorStop(0, 'rgba(255,255,255,0)');
                    grad.addColorStop(1, stat.color);
                    ctx.strokeStyle = grad;
                    ctx.globalAlpha = 0.3 * globalAlpha;
                    ctx.beginPath();
                    ctx.moveTo(0, 0);
                    ctx.lineTo(ox, oy);
                    ctx.stroke();
                    ctx.restore();
                }
            }

            // [bitmap-orbital] 装填吸入轨迹粒子：球离中心还很远时，每帧在球的拖尾位置叠一帧吸入纹理
            if (this.isReloading && radius > 120) {
                const intakeFrame = ORBITAL_INTAKE[Math.floor((Date.now() / 90) % ORBITAL_INTAKE.length)];
                const intakeImg = getUiBitmap(intakeFrame);
                if (intakeImg) {
                    const trailT = 0.25 + Math.random() * 0.5;
                    const tx = ox * trailT;
                    const ty = oy * trailT;
                    const sz = 24 * orbScale;
                    ctx.save();
                    ctx.globalCompositeOperation = 'screen';
                    ctx.globalAlpha = 0.6 * globalAlpha;
                    ctx.drawImage(intakeImg, tx - sz / 2, ty - sz / 2, sz, sz);
                    ctx.restore();
                }
            }
        });

        ctx.restore();
    },

    /**
     * [RENDER] 绘制发射器底座 + 蓄力动画帧。
     * 替代 game_phase 中的简单椭圆，未加载位图时退回原始绘制。
     * @param {CanvasRenderingContext2D} ctx
     * @param {number} cx
     * @param {number} cy
     * @param {boolean} isCharging
     * @param {number} chargeProgress  0~1
     */
    render_combat_launcherEmitterBase(ctx, cx, cy, isCharging, chargeProgress) {
        const baseImg = getUiBitmap(EMITTER_BASE_SRC);
        const baseSize = 96;
        if (baseImg) {
            ctx.save();
            ctx.drawImage(baseImg, cx - baseSize / 2, cy - baseSize / 2, baseSize, baseSize);
            ctx.restore();
        } else {
            ctx.save();
            ctx.fillStyle = 'rgba(15, 23, 42, 0.8)';
            ctx.beginPath();
            ctx.arc(cx, cy, 22, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        }

        if (isCharging) {
            const t = Math.max(0, Math.min(1, chargeProgress || 0));
            const idx = Math.min(EMITTER_CHARGING_SRCS.length - 1, Math.floor(t * EMITTER_CHARGING_SRCS.length));
            const chargeImg = getUiBitmap(EMITTER_CHARGING_SRCS[idx]);
            if (chargeImg) {
                ctx.save();
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
        ctx.shadowBlur = 12;
        ctx.shadowColor = cursorColor;
        ctx.fillStyle = cursorColor;
        ctx.beginPath();
        ctx.arc(cursorX, cursorY, cursorRadius + 3, 0, Math.PI * 2);
        ctx.fill();

        // --- 绘制光标主体 ---
        ctx.globalAlpha = cursorAlpha;
        ctx.shadowBlur = 8;
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
