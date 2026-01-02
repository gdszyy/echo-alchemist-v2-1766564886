/**
 * render3d/entities/enemy.js - 3D敌人渲染器
 * 
 * 职责：
 * - 创建离屏Canvas绘制敌人地板纹理
 * - 从entities.js的Enemy.draw()提取绘制逻辑
 * - 将Canvas作为纹理应用到3D地板平面
 * - 保持与2D版本的视觉一致性（血条、温度效果等）
 */

import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js';

/**
 * 颜色线性插值函数（从entities.js复制）
 */
function lerpColor(a, b, amount) {
    const ah = parseInt(a.replace(/#/g, ''), 16),
          ar = ah >> 16, ag = ah >> 8 & 0xff, ab = ah & 0xff,
          bh = parseInt(b.replace(/#/g, ''), 16),
          br = bh >> 16, bg = bh >> 8 & 0xff, bb = bh & 0xff,
          rr = ar + amount * (br - ar),
          rg = ag + amount * (bg - ag),
          rb = ab + amount * (bb - ab);
    return '#' + ((1 << 24) + (Math.round(rr) << 16) + (Math.round(rg) << 8) + Math.round(rb)).toString(16).slice(1);
}

/**
 * EnemyRenderer3D - 3D敌人渲染器
 */
export class EnemyRenderer3D {
    /**
     * 构造函数
     * @param {THREE.Scene} scene - Three.js场景对象
     */
    constructor(scene) {
        this.scene = scene;
        
        // 离屏Canvas用于绘制地板纹理
        this.floorCanvas = document.createElement('canvas');
        this.floorCanvas.width = 256;  // 纹理分辨率
        this.floorCanvas.height = 128;
        this.floorCtx = this.floorCanvas.getContext('2d');
        
        // Canvas纹理
        this.floorTexture = new THREE.CanvasTexture(this.floorCanvas);
        this.floorTexture.needsUpdate = true;
        
        // 存储敌人3D对象的映射 {enemyId: mesh}
        this.enemyMeshes = new Map();
        
        console.log('[EnemyRenderer3D] 初始化完成');
    }
    
    /**
     * 创建敌人的3D表示
     * @param {Enemy} enemy - 敌人实体对象
     * @returns {THREE.Group} 敌人的3D组对象
     */
    createEnemyMesh(enemy) {
        const group = new THREE.Group();
        
        // 1. 创建主体（立方体）
        const bodyWidth = enemy.width / 10;  // 缩放到3D空间
        const bodyHeight = enemy.height / 10;
        const bodyDepth = 1;
        
        const bodyGeometry = new THREE.BoxGeometry(bodyWidth, bodyHeight, bodyDepth);
        const bodyMaterial = new THREE.MeshStandardMaterial({
            color: 0x475569,
            metalness: 0.3,
            roughness: 0.7
        });
        const bodyMesh = new THREE.Mesh(bodyGeometry, bodyMaterial);
        bodyMesh.position.y = bodyHeight / 2; // 抬高到地面上
        group.add(bodyMesh);
        
        // 2. 创建地板平面（用于显示血条和温度效果）
        const floorGeometry = new THREE.PlaneGeometry(bodyWidth * 1.2, bodyDepth * 1.2);
        const floorMaterial = new THREE.MeshBasicMaterial({
            map: this.floorTexture,
            transparent: true,
            side: THREE.DoubleSide
        });
        const floorMesh = new THREE.Mesh(floorGeometry, floorMaterial);
        floorMesh.rotation.x = -Math.PI / 2; // 旋转到水平
        floorMesh.position.y = 0.01; // 略高于地面，避免z-fighting
        group.add(floorMesh);
        
        // 存储引用
        group.userData.bodyMesh = bodyMesh;
        group.userData.floorMesh = floorMesh;
        group.userData.enemy = enemy;
        
        return group;
    }
    
    /**
     * 绘制敌人地板纹理
     * 从entities.js的Enemy.draw()方法提取绘制逻辑
     * @param {Enemy} enemy - 敌人实体对象
     */
    drawEnemyFloor(enemy) {
        const ctx = this.floorCtx;
        const canvas = this.floorCanvas;
        
        // 清空画布
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        // 设置绘制参数（映射到Canvas空间）
        const w = canvas.width - 20;  // 留边距
        const h = canvas.height - 20;
        const r = 6; // 圆角半径
        const centerX = canvas.width / 2;
        const centerY = canvas.height / 2;
        
        ctx.save();
        ctx.translate(centerX, centerY);
        
        // === Layer 1: 容器裁剪 ===
        ctx.beginPath();
        ctx.roundRect(-w/2, -h/2, w, h, r);
        ctx.fillStyle = '#0f172a';
        ctx.fill();
        ctx.clip();
        
        // === Layer 2: 液体血条 (含延迟白条) ===
        
        // A. 计算高度比例
        const hpRatio = Math.max(0, Math.min(1, enemy.displayHp / enemy.maxHp));
        const whiteRatio = Math.max(0, Math.min(1, enemy.delayedHp / enemy.maxHp));
        const greenRatio = Math.max(0, Math.min(1, enemy.greenHp / enemy.maxHp));
        
        const fillHeight = h * hpRatio;
        const whiteHeight = h * whiteRatio;
        const greenHeight = h * greenRatio;
        
        const fillY = (h/2) - fillHeight;
        const whiteY = (h/2) - whiteHeight;
        const greenY = (h/2) - greenHeight;
        
        // B. 绘制白色延迟条 (在彩色条底下)
        if (whiteRatio > hpRatio) {
            ctx.fillStyle = '#ffffff';
            ctx.globalAlpha = 0.8;
            ctx.fillRect(-w/2, whiteY, w, whiteHeight);
            ctx.globalAlpha = 1.0;
        }
        
        // B2. 绘制绿色回血条 (在彩色条底下)
        if (greenRatio > hpRatio) {
            ctx.fillStyle = '#4ade80';
            ctx.globalAlpha = 0.6;
            ctx.fillRect(-w/2, greenY, w, greenHeight);
            ctx.globalAlpha = 1.0;
        }
        
        // C. 绘制真实彩色条 (盖在白条上面)
        let baseColor = '#475569';
        if (enemy.type === 'elite') baseColor = '#581c87';
        if (enemy.type === 'boss') baseColor = '#7f1d1d';
        
        // 温度变色逻辑
        if (enemy.temp > 0) {
            const t = Math.min(1, enemy.temp / 34);
            baseColor = lerpColor(baseColor, '#ea580c', t);
        } else if (enemy.temp < 0) {
            const t = Math.min(1, Math.abs(enemy.temp) / 34);
            baseColor = lerpColor(baseColor, '#0891b2', t);
        }
        
        ctx.fillStyle = baseColor;
        ctx.fillRect(-w/2, fillY, w, fillHeight);
        
        // D. 液面亮边
        if (hpRatio > 0 && hpRatio < 1) {
            ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
            ctx.fillRect(-w/2, fillY, w, 2);
        }
        
        // === Layer 3: 内部覆盖层 (Glow & Mist) ===
        
        // 过热 Stage 3: 内部炙热发光
        if (enemy.temp >= 67) {
            const glowAlpha = Math.min(0.6, (enemy.temp - 60) / 60);
            const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, w * 0.8);
            grad.addColorStop(0, `rgba(251, 146, 60, ${glowAlpha})`);
            grad.addColorStop(1, `rgba(251, 146, 60, 0)`);
            ctx.fillStyle = grad;
            ctx.fillRect(-w/2, -h/2, w, h);
        }
        
        // 过冷 Stage 2~4: 动态雾化蒙层
        if (enemy.temp <= -34) {
            ctx.save();
            ctx.globalCompositeOperation = 'screen';
            
            let mistOpacity = 0;
            if (enemy.isFrozenCurrentTurn || enemy.temp <= -100) mistOpacity = 0.5;
            else mistOpacity = Math.min(0.4, (Math.abs(enemy.temp) - 30) / 70);
            
            const time = Date.now() / 2500;
            
            // 绘制浮动雾团
            const patchCount = 2;
            for(let i = 0; i < patchCount; i++) {
                const seed = (enemy.visualSeed || 0) * 100 + i;
                const offsetX = Math.sin(seed + time) * (w * 0.25);
                const offsetY = Math.cos(seed + time * 1.2) * (h * 0.25);
                const size = w * (0.5 + Math.sin(time * 2 + i) * 0.1);
                
                const grad = ctx.createRadialGradient(offsetX, offsetY, 0, offsetX, offsetY, size);
                grad.addColorStop(0, `rgba(207, 250, 254, ${mistOpacity * 0.4})`);
                grad.addColorStop(1, `rgba(207, 250, 254, 0)`);
                
                ctx.fillStyle = grad;
                ctx.beginPath();
                ctx.arc(offsetX, offsetY, size, 0, Math.PI * 2);
                ctx.fill();
            }
            
            // 全身薄霜
            ctx.fillStyle = `rgba(165, 243, 252, ${mistOpacity * 0.15})`;
            ctx.fillRect(-w/2, -h/2, w, h);
            ctx.restore();
        }
        
        // === Layer 4: 内部边框 ===
        ctx.strokeStyle = '#334155';
        ctx.lineWidth = 2;
        if (enemy.type === 'elite') {
            ctx.strokeStyle = '#facc15';
            ctx.lineWidth = 3;
        }
        if (enemy.type === 'boss') {
            ctx.strokeStyle = '#ef4444';
            ctx.lineWidth = 4;
        }
        
        // 预警时边框闪烁白色
        if (enemy.actionPhase === 'telegraphing') {
            ctx.strokeStyle = '#ffffff';
            ctx.shadowColor = '#fff';
            ctx.shadowBlur = 15;
        }
        
        ctx.strokeRect(-w/2, -h/2, w, h);
        ctx.shadowBlur = 0;
        
        // === Layer 5: 文字与图标 ===
        
        // 词缀图标
        if (enemy.affixes && enemy.affixes.length > 0) {
            ctx.fillStyle = '#fff';
            ctx.font = '10px sans-serif';
            let icons = '';
            if(enemy.affixes.includes('shield')) icons += '🛡️';
            if(enemy.affixes.includes('haste')) icons += '⚡';
            if(enemy.affixes.includes('regen')) icons += '💚';
            if(enemy.affixes.includes('clone')) icons += '🦠';
            if(enemy.affixes.includes('berserk')) icons += '😡';
            if(enemy.affixes.includes('healer')) icons += '💖';
            if(enemy.affixes.includes('devour')) icons += '👅';
            if(enemy.affixes.includes('jump')) icons += '🦘';
            if(enemy.affixes.includes('elite')) icons += '💀';
            ctx.textAlign = 'center';
            ctx.fillText(icons, 0, -h/2 + 8);
        }
        
        // 生命值数字
        if (enemy.displayHp > 0) {
            ctx.fillStyle = '#fff';
            ctx.font = 'bold 14px sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            if (enemy.displayHp > enemy.hp + 1) ctx.fillStyle = '#fca5a5';
            ctx.fillText(Math.ceil(enemy.displayHp), 0, 2);
        }
        
        // 受击闪白
        if (enemy.hitTimer > 0) {
            ctx.fillStyle = `rgba(255, 255, 255, ${enemy.hitTimer / 10 * 0.6})`;
            ctx.fillRect(-w/2, -h/2, w, h);
        }
        
        ctx.restore();
        
        // 标记纹理需要更新
        this.floorTexture.needsUpdate = true;
    }
    
    /**
     * 更新敌人的3D表示
     * @param {Array<Enemy>} enemies - 敌人数组
     */
    updateEnemies(enemies) {
        // 清理不活跃的敌人
        const activeEnemyIds = new Set(enemies.filter(e => e.active).map(e => e.id));
        for (const [id, mesh] of this.enemyMeshes.entries()) {
            if (!activeEnemyIds.has(id)) {
                this.scene.remove(mesh);
                this.enemyMeshes.delete(id);
            }
        }
        
        // 更新或创建敌人
        for (const enemy of enemies) {
            if (!enemy.active) continue;
            
            let enemyGroup = this.enemyMeshes.get(enemy.id);
            
            // 如果敌人还没有3D表示，创建它
            if (!enemyGroup) {
                enemyGroup = this.createEnemyMesh(enemy);
                this.scene.add(enemyGroup);
                this.enemyMeshes.set(enemy.id, enemyGroup);
            }
            
            // 更新位置（将2D坐标映射到3D空间）
            // 假设2D游戏空间是800x600，映射到3D空间的-10到10范围
            enemyGroup.position.x = (enemy.pos.x - 400) / 40;
            enemyGroup.position.z = (enemy.pos.y - 300) / 40;
            
            // 更新地板纹理
            this.drawEnemyFloor(enemy);
        }
    }
    
    /**
     * 销毁渲染器
     */
    dispose() {
        // 清理所有敌人网格
        for (const mesh of this.enemyMeshes.values()) {
            this.scene.remove(mesh);
            if (mesh.geometry) mesh.geometry.dispose();
            if (mesh.material) {
                if (Array.isArray(mesh.material)) {
                    mesh.material.forEach(m => m.dispose());
                } else {
                    mesh.material.dispose();
                }
            }
        }
        this.enemyMeshes.clear();
        
        // 清理纹理
        if (this.floorTexture) {
            this.floorTexture.dispose();
        }
        
        console.log('[EnemyRenderer3D] 已销毁');
    }
}
