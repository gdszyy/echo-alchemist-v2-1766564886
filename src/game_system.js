/**
 * game_system.js - 游戏核心系统
 * 
 * 职责：
 * - 游戏主循环 (sys_loop)
 * - 输入管理 (input_xxx)
 * - 视差偏移计算
 */
import { Vec2, showToast } from './entities.js';
import { CONFIG } from './config.js';

export const game_system = {

    /**
     * @method sys_loop
     * @description 游戏主循环
     */
    sys_loop() {
        const timeScale = this.timeScale; 

        // 处理震动衰减
        let shakeX = 0, shakeY = 0;
        if (this.screenShake > 0) {
            shakeX = (Math.random() - 0.5) * this.screenShake;
            shakeY = (Math.random() - 0.5) * this.screenShake;
            this.screenShake *= 0.9; // 快速衰减
            if (this.screenShake < 0.5) this.screenShake = 0;
        }

        this.ctx.save();
        
        // 1. 计算全局视差偏移 (基于设备倾斜或鼠标)
        const offset = this.input_getTiltOffset();
        
        // 2. 绘制背景层 (最底层，不随视差移动)
        this.ctx.fillStyle = CONFIG.colors.bg;
        this.ctx.fillRect(0, 0, this.width, this.height);
        
        // 3. 绘制实体层 (随视差移动)
        this.ctx.save();
        this.ctx.translate(offset.x + shakeX, offset.y + shakeY);
        
        // 这里的绘制逻辑由各阶段的具体 render 函数完成
        if (this.phase === 'meta') this.meta_render();
        else if (this.phase === 'selection') this.ui_renderSelection();
        else if (this.phase === 'gathering') this.phase_gathering_update(timeScale);
        else if (this.phase === 'combat') this.phase_combat_update(timeScale);
        else if (this.phase === 'gameover') this.ui_renderGameOver();

        this.ctx.restore();

        // 4. 绘制 UI 层 (不随视差移动)
        this.ui_draw(this.ctx);

        // 5. 下一帧请求
        this.ctx.restore(); 
        requestAnimationFrame(() => this.sys_loop());
    },

    /**
     * @method input_getTiltOffset
     * @description 获取当前视差偏移量。
     */
    input_getTiltOffset() {
        return new Vec2(
            this.boardTilt.current.x * 20,
            this.boardTilt.current.y * 20
        );
    },

    /**
     * @method input_handleOrientation
     * @description 处理设备陀螺仪输入。
     */
    input_handleOrientation(e) {
        if (!this.boardTilt.enabled) return;

        const maxTilt = 30; // 最大倾斜角度
        let x = e.gamma || 0;
        let y = e.beta || 0;
        
        // 修正：通常手机竖拿时 beta 约为 45-90度。我们需要相对于"竖直握持"的偏移。
        y = y - CONFIG.gameplay.deviceTiltBaseAngle; 

        // 钳制范围
        x = Math.max(-maxTilt, Math.min(maxTilt, x));
        y = Math.max(-maxTilt, Math.min(maxTilt, y));
        
        // 归一化为 -1 到 1
        this.boardTilt.target.x = x / maxTilt;
        this.boardTilt.target.y = y / maxTilt;
    },

    input_handleInputStart(pos, e) {
        const offset = this.input_getTiltOffset();
        const logicPos = pos.sub(offset);
        this.lastMousePos = logicPos;

        if (this.phase === 'meta') {
            this.meta_handleClick(pos);
            return;
        }

        if (this.phase === 'selection') {
            this.ui_handleSelectionClick(pos);
            return;
        }

        if (this.phase === 'gathering') {
            // 检查是否点击了旋转盘
            if (this.fortuneWheel.active && this.fortuneWheel.isPointInside(logicPos)) {
                this.fortuneWheel.spin();
                return;
            }

            // 检查是否点击了抓取点 (用于手动模拟倾斜)
            const gripPos = new Vec2(this.width / 2, this.height - 40);
            if (pos.dist(gripPos) < 40) {
                this.isTiltingGrip = true;
                this.gripStartPos = pos;
                return;
            }
        }

        if (this.phase === 'combat') {
            this.phase_handleInputStart(logicPos);
        }
    },

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
        
        // 收集阶段 - 手动拖拽倾斜
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
        if ((this.phase === 'gathering' || this.phase === 'combat') && !this.isTiltingGrip && !this.boardTilt.enabled) {
            const centerX = this.width / 2;
            const centerY = this.height / 2;
            this.boardTilt.target.x = ((pos.x - centerX) / centerX) * 0.3;
            this.boardTilt.target.y = ((pos.y - centerY) / centerY) * 0.3;
        }

        // 战斗阶段悬浮检测
        if (this.phase === 'combat' && !this.ui.isOpen) {
             this.input_checkEnemyHover(logicPos);
        }
    },

    input_handleInputEnd(pos, e) {
        this.isTiltingGrip = false;
        
        if (this.isDragging) {
            this.isDragging = false;
            const start = new Vec2(this.width / 2, this.height - 80);
            const force = pos.sub(this.input_getTiltOffset()).sub(start);
            
            if (force.y < -20) {
                this.phase_fireBullet(force);
            }
            this.boardTilt.target = {x: 0, y: 0};
        }
    },

    /**
     * @method input_checkDefeat
     * @description 检查是否失败 (包含视差偏移计算)。
     */
    input_checkDefeat() { 
        const viewShiftY = this.boardTilt.current.y * -20;
        for(let e of this.enemies) { 
            if (e.active && (e.pos.y + viewShiftY) > this.defeatLineY) {
                return true; 
            }
        } 
        return false;
    },

    input_checkEnemyHover(pos) {
        this.enemies.forEach(e => {
            if (e.active) {
                const dist = pos.dist(e.pos);
                e.isHovered = dist < e.radius * 1.5;
            }
        });
    }

};
