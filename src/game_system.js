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

export const game_system = {
/**
     * @method loop
     * @description 游戏主循环
     */
    /**
     * [SYS] 游戏主循环，由 requestAnimationFrame 驱动。
     * 负责更新游戏状态、渲染所有实体和 UI。
     */
    /**
     * [SYS] 游戏主循环，由 requestAnimationFrame 驱动。
     * 负责更新游戏状态、渲染所有实体和 UI。
     */
    sys_loop() {
        // [DEBUG] 确认循环存活
        const timeScale = this.timeScale; 

        // [DEBUG] 全局阶段监控

        // 处理震动衰减
        let shakeX = 0, shakeY = 0;
        if (this.screenShake > 0) {
            shakeX = (Math.random() - 0.5) * this.screenShake;
            shakeY = (Math.random() - 0.5) * this.screenShake;
            this.screenShake *= 0.9; // 快速衰减
            if (this.screenShake < 0.5) this.screenShake = 0;
        }

        this.ctx.save();
        


        // 应用震动偏移
        this.ctx.translate(shakeX, shakeY); 

        // 1. 基础渲染准备
        this.render_clearCanvas();

        // 2. 全局状态更新
        const smoothSpeed = 0.05 * timeScale;
        this.boardTilt.current.x += (this.boardTilt.target.x - this.boardTilt.current.x) * smoothSpeed;
        this.boardTilt.current.y += (this.boardTilt.target.y - this.boardTilt.current.y) * smoothSpeed;

        // 3. 背景层渲染
        if (this.phase !== 'combat' && this.phase !== 'training') {
            this.render_background();
        }

        // 4. 阶段逻辑与渲染分发
if (this.phase === 'truth_book') {
	            this.truthBook.update();
	        }
	        if (this.phase === 'training') {
	            this.trainingGround.update();
	        }
        switch (this.phase) {
            case 'gathering':
                this.phase_gathering_update(timeScale);
                break;
            case 'training':
            case 'combat':
                this.phase_combat_update(timeScale);
                break;
        }

        // 5. 特效与文字层渲柑
        this.render_floatingTexts(timeScale);
        
        // 5.5 风属性锥点渲柑（仅在战斗阶段或试炼场）
        if (this.phase === 'combat' || this.phase === 'training') {
            this.render_windAnchors();
            
            // 5.6 风属性法阵激活状态更新与渲柑 (支持多实例并行)
            for (let i = this.activeWindMatrices.length - 1; i >= 0; i--) {
                const matrix = this.activeWindMatrices[i];
                if (matrix.active) {
                    matrix.timer--;
                    
                    // 渲染该法阵实例的预兆特效
                    this.render_singleWindMatrix(matrix);
                    
                    // 倒计时结束，触发真正的技能
                    if (matrix.timer <= 0) {
                        matrix.active = false;
                        if (matrix.onComplete) matrix.onComplete();
                        // 从活跃列表中移除
                        this.activeWindMatrices.splice(i, 1);
                    }
                }
            }
        }

        // 6. 下一帧请求
        this.ctx.restore(); 
        requestAnimationFrame(() => this.sys_loop());
    },

/**
     * [RENDER] 渲染风属性锥点（独立渲染层）
     */
    /**
     * [RENDER] 绘制风道流速底色
     */
    drawWindTunnelFlow(rect, isHorizontal) {
        const offset = (Date.now() / 15) % 80; // 随时间位移
        this.ctx.save();
        
        // [优化]：不再使用 clip，而是让流动线横穿全屏
        this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
        this.ctx.lineWidth = 2;
        
        const canvasW = this.canvas.width;
        const canvasH = this.canvas.height;

        if (isHorizontal) {
            // 水平流动线：横跨整个屏幕宽度
            for (let x = -80; x < canvasW + 80; x += 40) {
                this.ctx.beginPath();
                this.ctx.moveTo(x + offset, rect.y);
                this.ctx.lineTo(x + offset - 30, rect.y + rect.h);
                this.ctx.stroke();
            }
        } else {
            // 垂直流动线：横跨整个屏幕高度
            for (let y = -80; y < canvasH + 80; y += 40) {
                this.ctx.beginPath();
                this.ctx.moveTo(rect.x, y + offset);
                this.ctx.lineTo(rect.x + rect.w, y + offset - 30);
                this.ctx.stroke();
            }
        }
        this.ctx.restore();
    },

/**
     * @method resize
     * @description 响应窗口大小变化，调整 Canvas 尺寸和游戏布局参数。
     */
    sys_resize() {
        const container = document.getElementById('game-container'); 
        if (!container) return;

        // --- 修改开始：强制 JS 同步窗口高度，解决部分安卓浏览器兼容问题 ---
        // 这一步会覆盖 CSS 的设置，确保 canvas 刚好填满可视区域
        container.style.height = `${window.innerHeight}px`;
        container.style.width = `${window.innerWidth}px`;
        // --- 修改结束 ---

        // [修复] 增加保底宽度获取逻辑
        const newWidth = container.clientWidth || window.innerWidth;
        const newHeight = container.clientHeight || window.innerHeight;

        this.width = this.canvas.width = newWidth; 
        this.height = this.canvas.height = newHeight; 
        

        // 动态调整失败判定线，防止在矮屏幕上太高
        this.defeatLineY = this.height - 120; // 稍微调低一点，给底部 UI 留空间
        
        this.enemyWidth = (this.width / CONFIG.gameplay.enemyCols); 
        this.enemyHeight = this.enemyWidth; 
        this.ui_updateUICache();
        
        // 如果是在收集阶段，且已经初始化过，可能需要重新计算钉子位置（可选）
        if (this.phase === 'gathering' && this.pegs && this.pegs.length > 0) {
            this.phase_gathering_initPachinko(true); 
        }
    },

/**
     * @method initGameStart
     * @description 初始化游戏开始状态 (生成初始敌人和进入选择阶段)。
     */
    sys_initGameStart() {
        // [META] 注入局外升级效果
        this.meta_applyUpgrades();

        // 重新生成初始敌人 (sys_resetGame 已经清空了敌人)
        const startY = 80; 
        for(let i=0; i<CONFIG.gameplay.startRows; i++) { 
            this.spawn_spawnEnemyRowAt(startY + i * this.enemyHeight); 
        }
        
        // 进入遗物选择阶段 (命运抉择)
        this.ui_showRelicSelection();
    },

/**
     * [AUTO-GENERATED] TODO: Add a description for sys_resetGame.
     */
    /**
     * [META] 读取存档 (模拟)
     */
    sys_loadSaveData() {
        const saved = localStorage.getItem('echo_alchemist_save');
        if (saved) {
            try {
                this.saveData = JSON.parse(saved);
            } catch(e) { console.error("Save load failed", e); }
        }
        // --- [新增] 开发福利 ---
        if ((this.saveData.currency || 0) < 2000) {
            this.saveData.currency = 2000;
            this.sys_saveData();
        }
        this.ui_updateMetaCurrency();
    },

/**
     * [META] 保存存档
     */
    sys_saveData() {
        localStorage.setItem('echo_alchemist_save', JSON.stringify(this.saveData));
    },

sys_resetGame() {
        this.runCurrency = 0; // 重置本局获得的货币
        this.gameOver = false;
        
        // 清空临时增强（游戏结束后重置）
        this.saveData.temporaryUpgrades = {};
        this.sys_saveData();
        this.round = 1;
        this.score = 0;
        this.scoreMultiplier = 1.0;
        
        // [關鍵] 重置解鎖權重回初始狀態
        this.unlockedWeights = { ...CONFIG.probabilities }; // 回到只有 white 和 bounce 的狀態
        this.guaranteedNextRound = [];
        this.ownedRelics = []; // 清空遺物
        
        // 清空實體
        this.enemies = [];
        this.projectiles = [];
        this.dropBalls = [];
        this.ammoQueue = [];
        this.marbleQueue = [];
        this.energyOrbs = [];
        this.spores = [];
        this.pegs = [];
        this.specialSlots = ["skill_point"];
        this.currentRows = CONFIG.gameplay.rows;
        this.skillPoints = 0; // 重置
	this.slotCount=1;
        this.ui.updateSkillPoints(this.skillPoints);

        // 重新生成初始敵人
        this.spawn_spawnEnemyRow(CONFIG.gameplay.startRows);
        
        // 重置 UI
        document.getElementById('combat-message').innerHTML = '';
        document.getElementById('score-num').innerText = '0';
        document.getElementById('round-num').innerText = '1';
    },

/**
     * @method setupInputs
     * @description 设置所有输入事件监听器（鼠标/触摸、按钮点击）。
     */
    sys_setupInputs() {
        // 辅助函数：获取鼠标/触摸在 Canvas 上的相对位置
        const handler = (e) => {
            const rect = this.canvas.getBoundingClientRect(); 
            let x = (e.touches && e.touches.length > 0) ? e.touches[0].clientX : e.clientX; 
            let y = (e.touches && e.touches.length > 0) ? e.touches[0].clientY : e.clientY; 
            
            return new Vec2(x - rect.left, y - rect.top);
        };
        // 绑定输入事件到 Canvas 和 Window
        this.canvas.addEventListener('mousedown', e => this.phase_handleInputStart(handler(e))); 
        this.canvas.addEventListener('touchstart', e => this.phase_handleInputStart(handler(e)), {passive: false});
        window.addEventListener('mousemove', e => this.input_handleInputMove(handler(e), e)); 
        window.addEventListener('touchmove', e => this.input_handleInputMove(handler(e), e), {passive: false});
        window.addEventListener('mouseup', () => this.input_handleInputEnd()); 
        window.addEventListener('touchend', () => this.input_handleInputEnd());
        document.getElementById('confirm-selection-btn').onclick = () => this.ui_confirmSelection(); // 确认选择按钮

        // 速度控制按钮
        const speedBtn = document.getElementById('speed-btn'); 
        speedBtn.onclick = () => { 
            if (this.timeScale === 1.0) this.timeScale = 2.0; 
            else if (this.timeScale === 2.0) this.timeScale = 3.0; 
            else if (this.timeScale === 3.0) this.timeScale = 0.42; 
            else this.timeScale = 1.0; 
            this.baseTimeScale = this.timeScale
            speedBtn.innerText = `⏩ x${this.timeScale}`; // 更新按钮文本
        };
        // 静音按钮
        const muteBtn = document.getElementById('mute-btn'); 
        muteBtn.onclick = () => { 
            audio.resume(); // 确保音频上下文已激活
            const isMuted = audio.toggleMute(); 
            muteBtn.innerText = isMuted ? '🔇' : '🔊'; 
        };
        
        // [新增] 伤害数字开关按钮
        const damageNumbersBtn = document.getElementById('damage-numbers-btn');
        damageNumbersBtn.onclick = () => {
            this.showDamageNumbers = !this.showDamageNumbers;
            damageNumbersBtn.style.opacity = this.showDamageNumbers ? '1' : '0.5';
            showToast(this.showDamageNumbers ? '伤害数字：开启' : '伤害数字：关闭');
        };
        //  陀螺仪权限申请与监听
        // 注意：iOS 13+ 需要用户交互（点击）才能申请权限
        const enableGyro = async () => {
            if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
                try {
                    const permission = await DeviceOrientationEvent.requestPermission();
                    if (permission === 'granted') {
                        this.boardTilt.enabled = true;
                        window.addEventListener('deviceorientation', e => this.input_handleOrientation(e));
                    }
            } else if ('ondeviceorientation' in window) {
                // 非 iOS 设备通常直接支持
                this.boardTilt.enabled = true;
                window.addEventListener('deviceorientation', e => this.input_handleOrientation(e));
            }
        };

        // 将权限申请绑定到第一次点击
        const initialClickHandler = () => {
            enableGyro();
            // 移除监听，避免每次点击都申请
            window.removeEventListener('click', initialClickHandler);
            window.removeEventListener('touchstart', initialClickHandler);
        };
        window.addEventListener('click', initialClickHandler);
        window.addEventListener('touchstart', initialClickHandler);
    },

//  处理设备倾斜
    /**
     * [AUTO-GENERATED] TODO: Add a description for input_handleOrientation.
     * @param {any} e - TODO: Describe this parameter.
     */
    input_handleOrientation(e) {
        if (!this.boardTilt.enabled) return;
        
        // gamma: 左倾/右倾 (-90 ~ 90)
        // beta:  前倾/后倾 (-180 ~ 180)
        
        // 限制最大倾斜角度 (例如 15度)，并归一化到 -1 ~ 1
        const maxTilt = 2; 
        
        let x = e.gamma || 0;
        let y = e.beta || 0;
        
        // 修正：通常手机竖拿时 beta 约为 45-90度。我们需要相对于“竖直握持”的偏移。
        // 这里简化处理：假设 beta 60度是基准
        y = y - 60; 

        // 钳制范围
        x = Math.max(-maxTilt, Math.min(maxTilt, x));
        y = Math.max(-maxTilt, Math.min(maxTilt, y));
        
        this.boardTilt.target.x = x / maxTilt; 
        this.boardTilt.target.y = y / maxTilt;
    },

/**
     * @method damageEnemy
     * @description 对敌人造成伤害并处理元素效果。
     * @param {Enemy} enemy - **重要参数** 目标敌人。
     * @param {Projectile} projectile - **重要参数** 造成伤害的弹丸。
     */
    /**
     * [COMBAT] 对敌人造成伤害的核心方法。
     * @param {Enemy} enemy - 目标敌人对象。
     * @param {object} projectile - 造成伤害的弹丸或来源对象。
     * @returns {number} 实际造成的伤害值。
     */
    // --- 视觉工具方法 ---
    triggerScreenShake(amount) {
        this.screenShake = amount;
    },

// 检测线段 AB 和 CD 是否相交
    checkLineIntersection(a, b, c, d) {
        const cross = (x, y, z) => (y.x - x.x) * (z.y - x.y) - (y.y - x.y) * (z.x - x.x);
        
        // 快速排斥实验
        if (Math.max(a.x, b.x) < Math.min(c.x, d.x) || Math.max(c.x, d.x) < Math.min(a.x, b.x) ||
            Math.max(a.y, b.y) < Math.min(c.y, d.y) || Math.max(c.y, d.y) < Math.min(a.y, b.y)) {
            return false;
        }

        // 跨立实验
        const f1 = cross(a, b, c) * cross(a, b, d);
        const f2 = cross(c, d, a) * cross(c, d, b);

        // 如果两个叉积都小于0，说明线段互相跨越
        return f1 < 0 && f2 < 0;
    },

// 检测四边形是否自相交 (蝴蝶形/沙漏形)
    isBowtieShape(anchors) {
        if (anchors.length < 4) return false;
        const p = anchors;
        // 检查对边是否相交：(0-1) 与 (2-3)，以及 (1-2) 与 (3-0)
        const cross1 = this.checkLineIntersection(p[0], p[1], p[2], p[3]);
        const cross2 = this.checkLineIntersection(p[1], p[2], p[3], p[0]);
        return cross1 || cross2;
    },

getLineIntersectionPoint(a, b, c, d) {
        const denom = (a.x - b.x) * (c.y - d.y) - (a.y - b.y) * (c.x - d.x);
        if (Math.abs(denom) < 0.001) return null;
        
        const t = ((a.x - c.x) * (c.y - d.y) - (a.y - c.y) * (c.x - d.x)) / denom;
        
        return new Vec2(
            a.x + t * (b.x - a.x),
            a.y + t * (b.y - a.y)
        );
    },

/**
     * @method resetMultiplier
     * @description 重置分数乘数。
     */
    sys_resetMultiplier() { 
        this.scoreMultiplier = 1.0; 
        this.ui_updateMultiplierUI(); 
        document.getElementById('multiplier-display').classList.remove('opacity-100'); 
        document.getElementById('multiplier-display').classList.add('opacity-0'); 
    },

/**
     * 初始化弹珠选择阶段
     */
    sys_initSelectionPhase() {
        this.phase_switchPhase('selection');
        this.spawn_generateMarbleOptions(); // 生成弹珠选项
        this.selectedMarbles = []; // 重置已选择弹珠
        document.getElementById('selected-count').innerText = '0'; 
        document.getElementById('confirm-selection-btn').disabled = true; 
        document.getElementById('recipe-hud-container').classList.add('hidden');
    },

/**
     * @method toggleMarbleSelection
     * @description 切换指定索引弹珠的选中状态。
     * @param {number} idx - **重要参数** 弹珠在 marblesPool 中的索引。
     * @param {HTMLElement} cardEl - **重要参数** 弹珠对应的 UI 元素。
     */
    sys_toggleMarbleSelection(idx, cardEl) { 
        if (this.selectedMarbles.includes(idx)) {
            // 取消选择
            this.selectedMarbles = this.selectedMarbles.filter(i => i !== idx); 
            cardEl.classList.remove('selected'); 
        } else { 
            // 选择 (最多 3 个)
            if (this.selectedMarbles.length < 3) { 
                this.selectedMarbles.push(idx); 
                cardEl.classList.add('selected'); 
            } 
        } 
        const count = this.selectedMarbles.length; 
        document.getElementById('selected-count').innerText = count; 
        document.getElementById('confirm-selection-btn').disabled = count !== 3; // 只有选满 3 个才能确认
    },

/**
     * @method initRecipeHUD
     * @description 初始化配方 HUD (隐藏)。
     */
    sys_initRecipeHUD() { 
        this.ui_renderRecipeHUD(); 
        const container = document.getElementById('recipe-hud-container'); 
        container.classList.add('hidden'); 
    },

/**
     * @method toggleHud
     * @description 切换 HUD 展开/折叠状态。
     */
    sys_toggleHud() { 
        this.hudExpanded = !this.hudExpanded; 
        this.ui_renderRecipeHUD(); 
    },

/**
     * 清除所有弹丸和爆发队列
     */
    /**
     * @method clearProjectiles
     * @description 清除所有现存的投射物。
     */
    data_clearProjectiles() {
        this.sonSwords = [];
        this.projectiles = []; 
        this.burstQueue = []; 
        this.spores = [];
        // [修复] 不应在此处清空 pegs 和 specialSlots，它们属于收集阶段的静态板面
        // this.pegs = [];
        // this.specialSlots = []; 
        this.fireWaves = []; // 清理火焰波
    },

/**
     * 获取当前的视觉偏移量
     */
        /**
     * @method getTiltOffset
     * @description 获取当前的视觉偏移量 (用于修正鼠标点击坐标)
     */
    input_getTiltOffset() {
        if (this.phase === 'combat') {
            const tilt = this.boardTilt.current;
            // [修正]：这里必须与 updateCombat 中"实体层"的系数 (-25, -20) 保持一致
            // 这样点击才会准确落在视觉上偏移了的敌人身上
            return new Vec2(tilt.x * -25, tilt.y * -20); 
        }
        return new Vec2(0, 0);
    },

//  检测是否有敌人被悬浮/点击
    /**
     * [AUTO-GENERATED] TODO: Add a description for input_checkEnemyHover.
     * @param {any} pos - TODO: Describe this parameter.
     */
    input_checkEnemyHover(pos) {
        // 只有战斗阶段且非敌人回合才允许查看
        if (this.phase !== 'combat' || this.isEnemyTurn) return null;

        let hit = null;
        // 逆序遍历，优先检测上层(视觉上)的敌人
        for(let i = this.enemies.length - 1; i >= 0; i--) {
            const e = this.enemies[i];
            if (!e.active) continue;
            
            // 简单的矩形碰撞检测
            const halfW = e.width / 2;
            const halfH = e.height / 2;
            if (pos.x >= e.pos.x - halfW && pos.x <= e.pos.x + halfW &&
                pos.y >= e.pos.y - halfH && pos.y <= e.pos.y + halfH) {
                hit = e;
                break;
            }
        }

        if (hit) {
            this.ui.showEnemyInfo(hit);
            // 给敌人加一个高亮框 (可选，复用你之前的 scanFeedbackTimer)
            // hit.scanFeedbackTimer = 0.5; // 微微闪亮
        } else {
            // 如果是在PC端鼠标移动，移开即关闭；移动端需要手动点关闭按钮或点空地
            // 为了体验统一，这里设定：如果正在Hover别的，就切过去；如果移到空地，暂时不自动关闭(防止误触)，
            // 或者：移到空地就关闭。这里采用“移到空地不自动关闭，依靠点击关闭或拖拽关闭”，体验较稳。
            // 但如果想要鼠标移开就消失：
            // this.ui.closeDrawer(); 
        }
        return hit;
    },

/**
     * @method handleInputEnd
     * @description 处理输入结束 (松手发射) - [修改版：直射模式]
     */
    // --- Game 类 ---
    /**
     * [AUTO-GENERATED] TODO: Add a description for input_handleInputEnd.
     */
    input_handleInputEnd() {

    if (this.isDragging) {
        // ... (战斗发射逻辑保持不变) ...
        this.isDragging = false;
        const cannonPos = new Vec2(this.width / 2, this.height - 80);
        const targetPos = this.lastMousePos;
        const aimVector = targetPos.sub(cannonPos);
        if (aimVector.y < -20) { 
            this.sys_resetMultiplier();
            // 保存计算好的力度，开启 flag
            this.pendingFireVelocity = aimVector.norm().mult(12);
            this.isChargingShot = true;
            this.chargeProgress = 0;
            
            // 给 UI 一个初始反馈（可选，比如让轨道瞬间亮一下）
            audio.playTone(800, 'sine', 0.1, 0.1); // 可选：吸收开始的音效
            // this.combat_fireNextShot(aimVector.norm().mult(12)); 
        }
    }
    
    // ---  收集阶段抓取结束逻辑 ---
    if (this.isTiltingGrip) {
        // 计算由于抓取产生的位移距离
        const dist = this.lastMousePos.dist(this.gripStartPos);
        
        // 如果移动距离很短 (< 10px)，说明是一次点击，而不是拖拽
        if (dist < 10) {
            showToast("請在上方區域點擊");
        }
        
        // 结束抓取
        this.isTiltingGrip = false;
        
        // 可选：松手后让板子回正
        if (!this.boardTilt.enabled) {
            this.boardTilt.target = {x: 0, y: 0};
        }
    }
},

/**
     * [AUTO-GENERATED] TODO: Add a description for input_handleInputMove.
     * @param {any} pos - TODO: Describe this parameter.
     * @param {any} e - TODO: Describe this parameter.
     */
    input_handleInputMove(pos, e) {
        const offset = this.input_getTiltOffset();
        const logicPos = pos.sub(offset);
        this.lastMousePos = logicPos;
        
        // 战斗拖拽瞄准
        if (this.isDragging) { 
            this.dragCurrent = logicPos; 
            e.preventDefault(); 
            return;
        } 
        
        //  收集阶段 - 手动拖拽倾斜
        if (this.phase === 'gathering' && this.isTiltingGrip && !this.boardTilt.enabled) {
            e.preventDefault();
            // 计算拖拽偏移量，模拟倾斜
            const deltaX = pos.x - this.gripStartPos.x;
            const deltaY = pos.y - this.gripStartPos.y;
            
            // 灵敏度系数
            const sensitivity = 0.005; 
            
            // 将偏移量叠加到目标倾斜值上
            this.boardTilt.target.x = Math.max(-1, Math.min(1, deltaX * sensitivity));
            this.boardTilt.target.y = Math.max(-1, Math.min(1, deltaY * sensitivity));
            return;
        }

        // [保留] 收集阶段 - 鼠标悬停倾斜 (PC端体验优化)
        // 如果没有在抓取，且没有陀螺仪，鼠标位置也会产生轻微倾斜
        if ((this.phase === 'gathering' || this.phase === 'combat') && !this.isTiltingGrip && !this.boardTilt.enabled) {
            const centerX = this.width / 2;
            const centerY = this.height / 2;
            // 悬停的幅度要小一点，防止太晕
            this.boardTilt.target.x = ((pos.x - centerX) / centerX) * 0.3;
            this.boardTilt.target.y = ((pos.y - centerY) / centerY) * 0.3;
        }

        // 战斗阶段悬浮检测
        if (this.phase === 'combat' && !this.ui.isOpen) {
             this.input_checkEnemyHover(logicPos);
        }
    },

/**
     * @method checkDefeat
     * @description 检查是否失败 (是否有敌人越过失败线)。
     * @returns {boolean} 是否失败。
     */
        /**
     * @method checkDefeat
     * @description 检查是否失败 (包含视差偏移计算)。
     * @returns {boolean} 是否失败。
     */
        /**
     * @method checkDefeat
     * @description 检查是否失败 (包含视差偏移计算)。
     */
    input_checkDefeat() { 
        // [修正]：使用实体层 Y 轴系数 (-20)
        const viewShiftY = this.boardTilt.current.y * -20;

        for(let e of this.enemies) { 
            // 判断：(敌人逻辑位置 + 视觉偏移) 是否超过 防线
            if (e.active && (e.pos.y + viewShiftY) > this.defeatLineY) {
                return true; 
            }
        } 
        return false; 
    },
};
