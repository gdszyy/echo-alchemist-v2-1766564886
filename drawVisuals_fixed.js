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
            return; // *** 繪製完畢，直接返回，跳过原本的圆球繪製 ***
        }
        
        // 1. 确定形状
        let shapeType = 'circle';
        if (config.pierce > 0) shapeType = 'arrow';
        if (config.scatter > 0) shapeType = 'star';
        if (config.isLaser) shapeType = 'orb';
        if (config.isMatryoshka) shapeType = 'matryoshka';
        if (config.wind) shapeType = 'crystal'; // 风属性使用菱形

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
        if (config.wind) { mainColors.push('#d1fae5'); glowColors.push('#34d399'); } // 风属性颜色
        if (config.pierce > 0 && mainColors.length === 0) { mainColors.push('#fee2e2'); glowColors.push('#ef4444'); }
        if (mainColors.length === 0) {
            if (config.bounce > 0) { mainColors.push('#dcfce7'); glowColors.push('#22c55e'); }
            else { mainColors.push('#f1f5f9'); glowColors.push('#94a3b8'); }
        }
        const mainColor = mainColors[mainColors.length - 1];
        const glowColor = glowColors[glowColors.length - 1];
        if (config.explosive && integrity > 0.1) {
            const time = Date.now();
            const pulse = (Math.sin(time / 50) + 1) / 2; 
            if (pulse > 0.7) {
                mainColors[mainColors.length - 1] = '#ffffff'; 
                glowColors[glowColors.length - 1] = '#fca5a5'; 
                intensity *= 1.5; 
            }
            const scaleMod = 1.0 + pulse * 0.15;
            deformation.x *= scaleMod;
            deformation.y *= scaleMod;
            const shakeAmount = 1.5; 
            ctx.translate((Math.random() - 0.5) * shakeAmount, (Math.random() - 0.5) * shakeAmount);
        }
        // ---  光球的特殊渲染逻辑 (绑定特效) ---
        if (shapeType === 'orb') {
            const time = Date.now() / 200;
            const pulse = Math.sin(time) * 0.1 + 1.0; 
            const laserPower = config.laser || 0;
            const sizeMod = 1 + (laserPower * 0.1); 
            ctx.shadowBlur = 20 * intensity * sizeMod;
            ctx.shadowColor = glowColor;
            ctx.fillStyle = glowColor;
            ctx.globalAlpha = 0.4;
            ctx.beginPath();
            ctx.arc(0, 0, radius * 1.2 * pulse * sizeMod, 0, Math.PI * 2);
            ctx.fill();
            ctx.shadowBlur = 10;
            ctx.shadowColor = '#fff';
            ctx.fillStyle = '#ffffff';
            ctx.globalAlpha = 1.0;
            ctx.beginPath();
            ctx.arc(0, 0, radius * 0.8 * sizeMod, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
            return; 
        }
        // 3. 绘制形状
        ctx.scale(deformation.x, deformation.y);
        ctx.beginPath();
        if (shapeType === 'arrow') {
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
        } else if (shapeType === 'crystal') { 
            ctx.moveTo(0, -radius * 1.3);
            ctx.lineTo(radius * 0.8, 0);
            ctx.lineTo(0, radius * 1.3);
            ctx.lineTo(-radius * 0.8, 0);
        } else if (shapeType === 'matryoshka') {
             ctx.arc(0, 0, radius, 0, Math.PI * 2);
        } else {
            if (config.pyro > 0) {
                const time = Date.now() / 50;
                for (let i = 0; i <= 30; i++) {
                    const angle = (i / 30) * Math.PI * 2;
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
        ctx.shadowBlur = CONFIG.visuals.glowBase * intensity * integrity; 
        ctx.shadowColor = glowColor;
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
        if (integrity < 1.0) {
            ctx.fillStyle = `rgba(0, 0, 0, ${0.6 - 0.6 * integrity})`; 
            ctx.fill();
        }
        if (config.cryo > 0) {
            ctx.shadowBlur = 0;
            ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
            ctx.beginPath();
            if (shapeType === 'arrow') {
                ctx.moveTo(0, -radius * 0.25); ctx.lineTo(radius*0.3, 0); ctx.lineTo(0, radius*0.25); ctx.lineTo(-radius*0.3, 0);
            } else if (shapeType === 'crystal') {
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
        if (integrity < 0.6 && crackSeed && crackSeed.length > 0) {
            ctx.save();
            ctx.shadowBlur = 0; 
            ctx.lineWidth = 1.5; 
            ctx.strokeStyle = 'rgba(30, 41, 59, 0.8)'; 
            ctx.clip(); 
            crackSeed.forEach(seed => {
                ctx.beginPath();
                ctx.moveTo(0, 0); 
                const r = radius * seed.len;
                const endX = Math.cos(seed.angle) * r;
                const endY = Math.sin(seed.angle) * r;
                const midX = endX * 0.5 + Math.cos(seed.angle + Math.PI/2) * (radius * seed.jagged);
                const midY = endY * 0.5 + Math.sin(seed.angle + Math.PI/2) * (radius * seed.jagged);
                ctx.lineTo(midX, midY);
                ctx.lineTo(endX, endY);
                ctx.stroke();
            });
            ctx.restore();
        }
        if (config.bounce > 0 && integrity < 0.2) {
            ctx.strokeStyle = '#475569'; 
            ctx.lineWidth = 2;
            ctx.stroke(); 
        }
        if (config.lightning > 0) {
            ctx.save();
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            ctx.globalCompositeOperation = 'lighter'; 
            const arcCount = 1 + Math.floor(config.lightning / 2);
            ctx.shadowBlur = 8 + config.lightning;
            ctx.shadowColor = '#a855f7'; 
            ctx.strokeStyle = '#e9d5ff'; 
            for (let k = 0; k < arcCount; k++) {
                ctx.beginPath();
                const startAngle = Math.random() * Math.PI * 2;
                const arcLen = 0.5 + Math.random() * 0.5; 
                const segments = 3 + Math.floor(Math.random() * 2);
                for (let i = 0; i <= segments; i++) {
                    const t = i / segments;
                    const currentAngle = startAngle + t * arcLen;
                    const jitter = (Math.random() - 0.5) * (radius * 0.3);
                    const dist = radius * 1.2 + jitter;
                    const px = Math.cos(currentAngle) * dist;
                    const py = Math.sin(currentAngle) * dist;
                    if (i === 0) ctx.moveTo(px, py);
                    else ctx.lineTo(px, py);
                }
                ctx.lineWidth = 0.8 + Math.random() * 1.2;
                ctx.stroke();
            }
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
