// 蝴蝶法阵核心逻辑

combat_wind_triggerButterflyCircle() {
    // 1. 获取锚点和配置
    const anchors = [...this.windAnchors];
    if (anchors.length < 4) return;
    
    // 2. 计算交叉线的交点（沙漏中心）
    const p = anchors;
    const intersection = this.getLineIntersectionPoint(p[0], p[2], p[1], p[3]);
    if (!intersection) return; // 如果无法计算交点，退出
    
    // 3. 获取子弹配置
    const currentRecipe = this.projectiles.find(proj => proj.config.wind)?.config || { wind: true };
    const bulletConfig = { ...currentRecipe };
    const avgBulletDamage = anchors.reduce((sum, a) => sum + (a.bulletDamage || 2), 0) / anchors.length;
    
    // 4. 计算 multicast（散射层数）
    const multicast = bulletConfig.multicast || 1;
    
    // 5. 计算伤害冷却（multicast越大，冷却越小）
    const baseCooldown = 42; // 默认42帧
    const cooldown = Math.max(10, Math.floor(baseCooldown / Math.sqrt(multicast)));
    
    // 6. 计算风刃数量（基于multicast）
    const bladeCount = 2 + multicast * 2; // 基础2条 + multicast * 2
    
    // 7. 创建蝴蝶法阵对象
    const butterflyCircle = {
        center: intersection,
        anchors: anchors,
        bulletConfig: bulletConfig,
        bulletDamage: avgBulletDamage,
        multicast: multicast,
        cooldown: cooldown,
        bladeCount: bladeCount,
        timer: 0,
        duration: 300, // 持续5秒（60fps * 5）
        active: true
    };
    
    // 8. 添加到游戏对象数组
    if (!this.butterflyCircles) this.butterflyCircles = [];
    this.butterflyCircles.push(butterflyCircle);
    
    // 9. 清空锚点
    this.windAnchors = [];
    
    // 10. 视觉反馈
    this.spawn_createFloatingText(intersection.x, intersection.y, "🦋蝴蝶法阵", "#34d399");
}

// 计算两条线段的交点
getLineIntersectionPoint(a, b, c, d) {
    const denom = (a.x - b.x) * (c.y - d.y) - (a.y - b.y) * (c.x - d.x);
    if (Math.abs(denom) < 0.001) return null; // 平行或重合
    
    const t = ((a.x - c.x) * (c.y - d.y) - (a.y - c.y) * (c.x - d.x)) / denom;
    
    return new Vec2(
        a.x + t * (b.x - a.x),
        a.y + t * (b.y - a.y)
    );
}

// 更新蝴蝶法阵
combat_wind_updateButterflyCircles(timeScale) {
    if (!this.butterflyCircles) return;
    
    for (let i = this.butterflyCircles.length - 1; i >= 0; i--) {
        const bc = this.butterflyCircles[i];
        
        // 更新计时器
        bc.timer += timeScale;
        bc.duration -= timeScale;
        
        // 检查是否到达发射冷却
        if (bc.timer >= bc.cooldown) {
            bc.timer = 0;
            this.combat_wind_fireButterflyBlades(bc);
        }
        
        // 检查是否结束
        if (bc.duration <= 0) {
            bc.active = false;
            this.butterflyCircles.splice(i, 1);
        }
    }
}

// 发射蝴蝶风刃
combat_wind_fireButterflyBlades(bc) {
    // 沿着交叉线的4个方向发射风刃
    const directions = [
        bc.anchors[0].sub(bc.center).norm(), // 方向1
        bc.anchors[1].sub(bc.center).norm(), // 方向2
        bc.anchors[2].sub(bc.center).norm(), // 方向3
        bc.anchors[3].sub(bc.center).norm()  // 方向4
    ];
    
    // 为每个方向生成风刃
    directions.forEach((dir, idx) => {
        for (let i = 0; i < Math.ceil(bc.bladeCount / 4); i++) {
            // 计算3D旋转角度（沿着中轴线旋转）
            const rotationPhase = (bc.timer / bc.cooldown) * Math.PI * 2;
            const bladeAngle = rotationPhase + (i / (bc.bladeCount / 4)) * Math.PI * 2;
            
            // 创建风刃对象
            const blade = {
                pos: new Vec2(bc.center.x, bc.center.y),
                vel: dir.mult(30 + Math.random() * 10), // 速度30-40
                bulletConfig: bc.bulletConfig,
                bulletDamage: bc.bulletDamage,
                size: 15 + Math.random() * 10,
                life: 1.0,
                angle: bladeAngle, // 3D旋转角度
                rotationAxis: dir, // 旋转轴
                active: true
            };
            
            if (!this.butterflyBlades) this.butterflyBlades = [];
            this.butterflyBlades.push(blade);
        }
    });
}
