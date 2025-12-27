    static drawVisuals(ctx, x, y, radius, config, rotation, intensity, deformation = {x:1, y:1}, integrity = 1.0, crackSeed = []) {
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(rotation);
        if (config.type === 'flying_sword') {
            // 修正角度：假設畫筆是朝右(0度)畫的，如果原圖是朝上則需旋轉
            // 這裡我們直接畫朝右的劍，與 velocity 方向一致

            const scale = radius / 6; // 根據半徑動態調整大小 (基礎半徑約7~10)

            // 1. 劍身發光 (Spirit Aura) - 隨耐久度減弱
            ctx.shadowBlur = 15 * intensity * integrity;
            ctx.shadowColor = '#0ea5e9'; // 青色光暈

            // 2. 劍身 (Blade) - 雙刃劍，指向右側
            ctx.beginPath();
            ctx.moveTo(32 * scale, 0);       // 劍尖 (最右)
            ctx.lineTo(8 * scale, -4 * scale); // 上刃
            ctx.lineTo(-12 * scale, -4 * scale); // 劍身後段
            ctx.lineTo(-12 * scale, 4 * scale);  // 劍身後段
            ctx.lineTo(8 * scale, 4 * scale);  // 下刃
            ctx.closePath();

            // 劍刃金屬漸變 (橫向)
            const bladeGrad = ctx.createLinearGradient(-10 * scale, -5*scale, -10 * scale, 5*scale);
            bladeGrad.addColorStop(0, '#e0f2fe');   // 亮白邊緣
            bladeGrad.addColorStop(0.5, '#0284c7'); // 深青中脊 (立體感)
            bladeGrad.addColorStop(1, '#e0f2fe');   // 亮白邊緣
            ctx.fillStyle = bladeGrad;
            ctx.fill();

            // 劍脊線 (Ridge)
            ctx.beginPath();
            ctx.moveTo(30 * scale, 0);
            ctx.lineTo(-12 * scale, 0);
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
            ctx.lineWidth = 1.5;
            ctx.stroke();

            // 3. 劍格 (Guard) - 祥雲/蝙蝠紋飾
            ctx.shadowBlur = 5;
            ctx.shadowColor = '#f59e0b';
            ctx.fillStyle = '#fbbf24'; // 金色
            ctx.beginPath();
            // 畫一個橫向的菱形或雲紋
            ctx.moveTo(-10 * scale, 0);
            ctx.quadraticCurveTo(-10 * scale, -10 * scale, -14 * scale, -8 * scale); // 上翼
            ctx.lineTo(-14 * scale, 8 * scale); // 下翼
            ctx.quadraticCurveTo(-10 * scale, 10 * scale, -10 * scale, 0);
            ctx.fill();

            // 4. 劍柄 (Hilt)
            ctx.fillStyle = '#451a03'; // 深褐色木柄
            ctx.fillRect(-22 * scale, -2 * scale, 10 * scale, 4 * scale);

            // 5. 劍首 (Pommel)
            ctx.beginPath();
            ctx.arc(-24 * scale, 0, 3 * scale, 0, Math.PI * 2);
            ctx.fillStyle = '#fbbf24';
            ctx.fill();

            // 6. 劍穗 (Tassel) - 隨時間飄動的紅穗
            // 使用 Math.sin 模擬風吹效果
            const time = Date.now() / 100;
            const swing = Math.sin(time) * 3 * scale;

            ctx.beginPath();
            ctx.moveTo(-26 * scale, 0); // 連接劍首
            // 貝塞爾曲線模擬向後飄動 (向左)
            ctx.bezierCurveTo(
                -35 * scale, swing,           // 控制點1
                -40 * scale, -swing,          // 控制點2
                -50 * scale, swing * 0.5      // 終點
            );

            ctx.shadowColor = '#ef4444';
            ctx.shadowBlur = 5;
            ctx.strokeStyle = '#ef4444'; // 紅色
            ctx.lineWidth = 2;
            ctx.lineCap = 'round';
            ctx.stroke();

            ctx.restore();
            return; // *** 繪製完畢，直接返回，跳過原本的圓球繪製 ***
        }

        if (config.explosive) {
            const time = Date.now();
            
            // 1. 高频脉冲 (每秒闪烁约 10 次)
            // 产生一个 0.0 ~ 1.0 的波动值
            const pulse = (Math.sin(time / 50) + 1) / 2; 

            // 2. 颜色闪烁 (核心过热警告)
            // 当脉冲达到峰值时，颜色由红色变为纯白，模拟临界状态
            let coreColor = '#ef4444'; // 基础红
            let glowColor = '#b91c1c'; // 深红光晕
            
            if (pulse > 0.7) {
                coreColor = '#ffffff'; // 闪白
                glowColor = '#fca5a5'; // 光晕变亮红
                intensity *= 1.5; // 光晕暴涨
            }

            // 3. 体积膨胀 (呼吸感)
            // 让子弹在 100% ~ 115% 大小之间震荡
            const scaleMod = 1.0 + pulse * 0.15;
            ctx.scale(deformation.x * scaleMod, deformation.y * scaleMod);

            // 4. 位置颤抖 (Jitter - 关键特效)
            // 就在原位置疯狂抖动，表现出能量无法控制的感觉
            const shakeAmount = 1.5; 
            ctx.translate((Math.random() - 0.5) * shakeAmount, (Math.random() - 0.5) * shakeAmount);

            // --- 绘制炸弹本体 ---
            // 光晕
            ctx.shadowBlur = CONFIG.visuals.glowBase * intensity * 1.5;
            ctx.shadowColor = glowColor;
            
            // 核心圆
            ctx.fillStyle = coreColor;
            ctx.beginPath();
            ctx.arc(0, 0, radius, 0, Math.PI * 2);
            ctx.fill();

            // 内部高光 (让它看起来像球体)
            ctx.shadowBlur = 0;
            ctx.fillStyle = 'rgba(255,255,255,0.4)';
            ctx.beginPath();
            ctx.arc(-radius*0.3, -radius*0.3, radius*0.3, 0, Math.PI*2);
            ctx.fill();

            ctx.restore();
            return; // *** 爆破弹绘制完毕，直接返回，跳过后续通用逻辑 ***
        }


        // 1. 决定形状 (修复：加回 crystal)
        let shapeType = 'circle';
        if (config.isMatryoshka) shapeType = 'matryoshka';
        else if (config.pierce > 0) shapeType = 'arrow';
        else if (config.scatter > 0) shapeType = 'star';
        else if (config.cryo > 0) shapeType = 'crystal'; // <--- 找回了丢失的冰霜形状判定
        else if (config.isLaser) shapeType = 'orb';

        // 2. 决定颜色
        let mainColors = [];
        let glowColors = [];
        
        if (config.isLaser) { 
            mainColors.push('#ffffff'); // 核心纯白
            glowColors.push(CONFIG.colors.laser); // 外圈天蓝
        }

        if (config.type === 'rainbow') { mainColors.push('rainbow'); glowColors.push('#ffffff'); }
        if (config.explosive) { mainColors.push('#fff'); glowColors.push('#ef4444'); }
        if (config.pyro > 0) { mainColors.push('#fdba74'); glowColors.push('#f97316'); }
        if (config.cryo > 0) { mainColors.push('#cffafe'); glowColors.push('#06b6d4'); }
        if (config.lightning > 0) { mainColors.push('#f3e8ff'); glowColors.push('#c084fc'); }
        if (config.pierce > 0 && mainColors.length === 0) { mainColors.push('#fee2e2'); glowColors.push('#ef4444'); }

        if (mainColors.length === 0) {
            if (config.bounce > 0) { mainColors.push('#dcfce7'); glowColors.push('#22c55e'); }
            else { mainColors.push('#f1f5f9'); glowColors.push('#94a3b8'); }
        }

        const mainColor = mainColors[mainColors.length - 1];
        const glowColor = glowColors[glowColors.length - 1];

        if (config.explosive && integrity > 0.1) {
            const time = Date.now();
            
            // 1. 高频脉冲 (每秒闪烁约 10 次)
            // 产生一个 0.0 ~ 1.0 的波动值
            const pulse = (Math.sin(time / 50) + 1) / 2; 

            // 2. 颜色闪烁 (核心过热)
            // 当脉冲达到峰值时，颜色由红色变为纯白
            if (pulse > 0.7) {
                // 混合白色：简单的逻辑是直接覆盖 mainColor
                // 视觉上会产生红-白-红的急促警报感
                mainColors[mainColors.length - 1] = '#ffffff'; 
                glowColors[glowColors.length - 1] = '#fca5a5'; // 光晕变亮红
                intensity *= 1.5; // 光晕暴涨
            }

            // 3. 体积膨胀 (呼吸感)
            // 让子弹在 100% ~ 115% 大小之间震荡
            const scaleMod = 1.0 + pulse * 0.15;
            deformation.x *= scaleMod;
            deformation.y *= scaleMod;

            // 4. 位置颤抖 (Jitter)
            // 就在原位置疯狂抖动，表现出能量无法控制
            const shakeAmount = 1.5; 
            ctx.translate((Math.random() - 0.5) * shakeAmount, (Math.random() - 0.5) * shakeAmount);
        }
        // ---  光球的特殊渲染逻辑 (绑定特效) ---
        if (shapeType === 'orb') {
            // 1. 动态脉冲 (模拟能量不稳定的感觉)
            const time = Date.now() / 200;
            const pulse = Math.sin(time) * 0.1 + 1.0; 
            
            // 2. 根据激光层数 (config.laser) 增强光晕和大小
            // config.laser 越高，球体越亮，核心越大
            const laserPower = config.laser || 0;
            const sizeMod = 1 + (laserPower * 0.1); 
            
            // 绘制强光晕 (多层叠加)
            ctx.shadowBlur = 20 * intensity * sizeMod;
            ctx.shadowColor = glowColor;
            
            // 外层光环
            ctx.fillStyle = glowColor;
            ctx.globalAlpha = 0.4;
            ctx.beginPath();
            ctx.arc(0, 0, radius * 1.2 * pulse * sizeMod, 0, Math.PI * 2);
            ctx.fill();

            // 内层核心 (高亮)
            ctx.shadowBlur = 10;
            ctx.shadowColor = '#fff';
            ctx.fillStyle = '#ffffff';
            ctx.globalAlpha = 1.0;
            ctx.beginPath();
            ctx.arc(0, 0, radius * 0.8 * sizeMod, 0, Math.PI * 2);
            ctx.fill();
            
            // 恢复上下文，跳过后续通用绘制
            ctx.restore();
            return; 
        }
        // 3. 绘制形状
        ctx.beginPath();
        if (shapeType === 'arrow') {
            // [优化] 增大箭头比例，使其在穿透层数高时依然清晰
            const arrowScale = 1.8; 
            ctx.moveTo(radius * arrowScale, 0); 
            ctx.lineTo(-radius * 0.8, radius * 0.7); 
            ctx.lineTo(-radius * 0.3, 0); 
            ctx.lineTo(-radius * 0.8, -radius * 0.7); 
        } else if (shapeType === 'star') {
            for (let i = 0; i < 4; i++) {
                ctx.rotate(Math.PI / 2);
                ctx.lineTo(radius, 0);
                ctx.lineTo(radius * 0.4, radius * 0.4);
            }
        } else if (shapeType === 'crystal') { // <--- 找回了丢失的菱形绘制逻辑
            ctx.moveTo(0, -radius * 1.3);
            ctx.lineTo(radius * 0.8, 0);
            ctx.lineTo(0, radius * 1.3);
            ctx.lineTo(-radius * 0.8, 0);
        } else if (shapeType === 'matryoshka') {
             ctx.arc(0, 0, radius, 0, Math.PI * 2);
        } else {
            // 默认圆形/流体
            if (config.pyro > 0) {
                const time = Date.now() / 50;
                // 使用多层波浪模拟火焰跳动
                for (let i = 0; i <= 30; i++) {
                    const angle = (i / 30) * Math.PI * 2;
                    // 基础波浪 + 高频抖动
                    const wave1 = Math.sin(time + angle * 3) * (radius * 0.15);
                    const wave2 = Math.sin(time * 1.5 + angle * 7) * (radius * 0.08);
                    const r = radius + wave1 + wave2;
                    ctx.lineTo(Math.cos(angle) * r, Math.sin(angle) * r);
                }
            } else {
                ctx.arc(0, 0, radius, 0, Math.PI * 2);
            }
        }
        ctx.closePath();

        // --- [视觉修改]：应用老化效果 ---
    
        // A. 光晕减弱
        ctx.shadowBlur = CONFIG.visuals.glowBase * intensity * integrity; // 越破损光晕越小
        ctx.shadowColor = glowColor;
        
        // B. 颜色变暗 (使用 globalAlpha 简单模拟或者在颜色上覆盖黑色层)
        // 这里我们填充主色
        if (mainColor === 'rainbow') {
            const grad = ctx.createLinearGradient(-radius, -radius, radius, radius);
            grad.addColorStop(0, '#fca5a5');
            grad.addColorStop(0.25, '#facc15');
            grad.addColorStop(0.5, '#4ade80');
            grad.addColorStop(0.75, '#60a5fa');
            grad.addColorStop(1, '#c084fc');
            ctx.fillStyle = grad;
        } else {
            ctx.fillStyle = mainColor;
        }
        ctx.fill();

        // 如果耐久度不满，覆盖一层半透明黑色，使其看起来变暗/脏
        if (integrity < 1.0) {
            ctx.fillStyle = `rgba(0, 0, 0, ${0.6 - 0.6 * integrity})`; // 最多 60% 的黑度
            ctx.fill();
        }

        // 4. 填充 (已在上方完成，此处为冗余代码，移除以避免覆盖彩虹渐变)

        // 5. 内部细节
        if (config.cryo > 0) {
            ctx.shadowBlur = 0;
            ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
            ctx.beginPath();
            if (shapeType === 'arrow') {
                ctx.moveTo(0, -radius * 0.25); ctx.lineTo(radius*0.3, 0); ctx.lineTo(0, radius*0.25); ctx.lineTo(-radius*0.3, 0);
            } else if (shapeType === 'crystal') {
                // 如果是菱形，内部画个小菱形高光
                ctx.moveTo(0, -radius * 0.6); 
                ctx.lineTo(radius * 0.3, 0); 
                ctx.lineTo(0, radius * 0.6); 
                ctx.lineTo(-radius * 0.3, 0);
            } else {
                for(let i=0; i<6; i++) {
                    const a = i * Math.PI / 3;
                    const r = radius * 0.5;
                    ctx.lineTo(Math.cos(a)*r, Math.sin(a)*r);
                }
            }
            ctx.fill();
        }

        // --- [视觉修改]：绘制裂纹 ---
        // 只有当完整度低于 60% 时才开始出现裂纹
        if (integrity < 0.6 && crackSeed && crackSeed.length > 0) {
            ctx.save();
            ctx.shadowBlur = 0; // 裂纹没有光晕
            ctx.lineWidth = 1.5; // 裂纹宽度
            // 裂纹颜色：深色，带一点点 glowColor 的余光
            ctx.strokeStyle = 'rgba(30, 41, 59, 0.8)'; 
            
            // 剪切路径，保证裂纹只画在子弹内部
            ctx.clip(); 

            crackSeed.forEach(seed => {
                ctx.beginPath();
                ctx.moveTo(0, 0); // 从中心裂开
                // 计算裂纹终点
                const r = radius * seed.len;
                const endX = Math.cos(seed.angle) * r;
                const endY = Math.sin(seed.angle) * r;
                
                // 画一个折线，增加破碎感
                const midX = endX * 0.5 + Math.cos(seed.angle + Math.PI/2) * (radius * seed.jagged);
                const midY = endY * 0.5 + Math.sin(seed.angle + Math.PI/2) * (radius * seed.jagged);
                
                ctx.lineTo(midX, midY);
                ctx.lineTo(endX, endY);
                ctx.stroke();
            });
            ctx.restore();
        }
        
        // --- [视觉修改]：如果弹性耗尽，绘制一个沉重的外边框 ---
        // 判断逻辑：如果 config 里本来有弹性，但现在 integrity 很低
        if (config.bounce > 0 && integrity < 0.2) {
            ctx.strokeStyle = '#475569'; // 铁灰色
            ctx.lineWidth = 2;
            ctx.stroke(); // 给圆球画个圈，表示它变成了实心铁球，不再Q弹
        }
        // --- [新增/修改]：子弹的狂暴电弧特效 ---
        if (config.lightning > 0) {
            ctx.save();
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            ctx.globalCompositeOperation = 'lighter'; // 高亮叠加

            // 1. 动态数量：层数越高，电弧越多
            // 子弹飞行速度快，每帧刷新会导致电弧疯狂跳动，这正符合“球状闪电”的不稳定感
            const arcCount = 1 + Math.floor(config.lightning / 2);

            ctx.shadowBlur = 8 + config.lightning;
            ctx.shadowColor = '#a855f7'; // Purple-500
            ctx.strokeStyle = '#e9d5ff'; // Purple-200 (同款高亮紫)
            
            for (let k = 0; k < arcCount; k++) {
                ctx.beginPath();
                
                // 随机起始角度
                const startAngle = Math.random() * Math.PI * 2;
                // 弧长比 DropBall 小一点，显得更紧凑
                const arcLen = 0.5 + Math.random() * 0.5; 
                
                // 3~5 段折线
                const segments = 3 + Math.floor(Math.random() * 2);

                for (let i = 0; i <= segments; i++) {
                    const t = i / segments;
                    const currentAngle = startAngle + t * arcLen;
                    
                    // 悬浮距离：半径的 1.1 ~ 1.4 倍
                    // 加上 deformation 修正，确保电弧跟随子弹被压扁/拉长
                    const jitter = (Math.random() - 0.5) * (radius * 0.3);
                    const dist = radius * 1.2 + jitter;
                    
                    const px = Math.cos(currentAngle) * dist;
                    const py = Math.sin(currentAngle) * dist;
                    
                    if (i === 0) ctx.moveTo(px, py);
                    else ctx.lineTo(px, py);
                }
                
                // 线条稍微细一点，因为子弹本来就小
                ctx.lineWidth = 0.8 + Math.random() * 1.2;
                ctx.stroke();
            }
            
            // 偶尔的核心闪烁 (High Voltage Flicker)
            if (Math.random() < 0.2) {
                ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
                ctx.beginPath();
                ctx.arc(0, 0, radius * 0.8, 0, Math.PI * 2);
                ctx.fill();
            }

            ctx.restore();
        }

        if (config.isMatryoshka) {
            ctx.shadowBlur = 0;
            ctx.fillStyle = '#d946ef'; 
            ctx.beginPath(); ctx.arc(0, -radius*0.2, radius*0.4, 0, Math.PI*2); ctx.fill(); 
            ctx.strokeStyle = '#fff'; ctx.lineWidth = 1; 
            ctx.beginPath(); ctx.arc(0, 0, radius*0.8, 0, Math.PI*2); ctx.stroke();
        }

        ctx.restore();
    }
