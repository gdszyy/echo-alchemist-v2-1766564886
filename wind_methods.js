    /**
     * @method combat_wind_addAnchor
     * @description 添加风属性锚点，并处理法阵逻辑
     */
    combat_wind_addAnchor(x, y) {
        if (this.windAnchors.length >= 4) {
            const old = this.windAnchors.shift();
            this.combat_wind_triggerAnchorExplosion(old.x, old.y);
        }
        this.windAnchors.push({ x, y, life: 1.0 });
        this.spawn_createParticle(x, y, '#34d399', 'spark');
        if (this.windAnchors.length === 4) {
            this.combat_wind_triggerMagicCircle();
        }
    }

    combat_wind_triggerAnchorExplosion(x, y) {
        this.spawn_createExplosion(x, y, '#34d399', 40);
        const dmg = 5;
        this.enemies.forEach(e => {
            if (e.active && e.pos.dist(new Vec2(x, y)) < 60) {
                e.takeDamage(dmg);
            }
        });
    }

    combat_wind_triggerMagicCircle() {
        const anchors = this.windAnchors;
        let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
        anchors.forEach(a => {
            minX = Math.min(minX, a.x); maxX = Math.max(maxX, a.x);
            minY = Math.min(minY, a.y); maxY = Math.max(maxY, a.y);
        });
        const width = maxX - minX;
        const height = maxY - minY;
        const area = width * height;
        const ratio = Math.max(width/height, height/width);
        let sizeType = area < 15000 ? 'small' : 'large';
        let shapeType = ratio < 1.5 ? 'square' : 'rect';
        const currentRecipe = this.projectiles.find(p => p.config.wind)?.config || { wind: true };
        let element = 'wind';
        if (currentRecipe.explosive) element = 'wind_explosive';
        else if (currentRecipe.laser > 0) element = 'wind_light';
        this.combat_wind_executeCircleEffect(minX, minY, width, height, sizeType, shapeType, element);
        this.windAnchors = [];
    }

    combat_wind_executeCircleEffect(x, y, w, h, size, shape, element) {
        const centerX = x + w/2;
        const centerY = y + h/2;
        if (size === 'small') {
            if (element === 'wind') {
                const hasEnemy = this.enemies.some(e => e.active && e.pos.x > x && e.pos.x < x+w && e.pos.y > y && e.pos.y < y+h);
                if (hasEnemy) {
                    this.spawn_createFloatingText(centerX, centerY, "🌪️旋风", "#34d399");
                    for(let i=0; i<5; i++) {
                        setTimeout(() => {
                            this.enemies.forEach(e => {
                                if (e.active && e.pos.x > x && e.pos.x < x+w && e.pos.y > y && e.pos.y < y+h) {
                                    e.takeDamage(2);
                                    e.applyTemp(e.temp * 0.1);
                                }
                            });
                        }, i * 200);
                    }
                }
            } else if (element === 'wind_explosive') {
                this.spawn_createFloatingText(centerX, centerY, "🧨不稳定气流", "#fca5a5");
                for(let i=0; i<3; i++) {
                    this.spawn_createExplosion(x + Math.random()*w, y + Math.random()*h, '#fca5a5');
                }
            } else if (element === 'wind_light') {
                this.spawn_createFloatingText(centerX, centerY, "🕳️黑洞", "#0ea5e9");
                this.enemies.forEach(e => {
                    if (e.active && e.pos.x > x && e.pos.x < x+w && e.pos.y > y && e.pos.y < y+h) {
                        e.takeDamage(9999);
                    }
                });
            }
        } else if (shape === 'square') {
            if (element === 'wind') {
                this.spawn_createFloatingText(centerX, centerY, "🌪️大旋风", "#34d399");
                this.enemies.forEach(e => {
                    if (e.active && e.pos.x > x && e.pos.x < x+w && e.pos.y > y && e.pos.y < y+h) {
                        let dmg = 20;
                        if (e.temp >= 100) { dmg *= 2; e.applyTemp(-50); this.spawn_createFloatingText(e.pos.x, e.pos.y, "🔥火旋风", "#f97316"); }
                        else if (e.temp <= -100) { dmg *= 2; e.applyTemp(50); this.spawn_createFloatingText(e.pos.x, e.pos.y, "❄️冰旋风", "#06b6d4"); }
                        e.takeDamage(dmg);
                    }
                });
            } else if (element === 'wind_explosive') {
                this.spawn_createFloatingText(centerX, centerY, "💥内爆", "#fca5a5");
                this.enemies.forEach(e => {
                    if (e.active && e.pos.x > x && e.pos.x < x+w && e.pos.y > y && e.pos.y < y+h) {
                        e.takeDamage(15);
                        const dir = e.pos.sub(new Vec2(centerX, centerY)).norm();
                        e.pos = e.pos.add(dir.mult(40));
                    }
                });
            } else if (element === 'wind_light') {
                this.spawn_createFloatingText(centerX, centerY, "🛡️屏障", "#0ea5e9");
                this.enemies.forEach(e => {
                    if (e.active && e.pos.x > x && e.pos.x < x+w && e.pos.y > y && e.pos.y < y+h) {
                        e.takeDamage(30);
                    }
                });
            }
        } else {
            const isHorizontal = w > h;
            if (element === 'wind') {
                this.spawn_createFloatingText(centerX, centerY, "🌬️风道", "#34d399");
                this.enemies.forEach(e => {
                    const inPath = isHorizontal ? (e.pos.y > y && e.pos.y < y+h) : (e.pos.x > x && e.pos.x < x+w);
                    if (e.active && inPath) {
                        e.takeDamage(10);
                        this.enemies.forEach(other => {
                            if (other !== e && other.active) {
                                const dist = e.pos.dist(other.pos);
                                if (dist < 200) {
                                    const transfer = e.temp * (1 - dist/200) * 0.2;
                                    other.applyTemp(transfer);
                                    e.applyTemp(-transfer);
                                }
                            }
                        });
                    }
                });
            } else if (element === 'wind_explosive') {
                this.spawn_createFloatingText(centerX, centerY, "🌊冲击波", "#fca5a5");
                this.enemies.forEach(e => {
                    const inPath = isHorizontal ? (e.pos.y > y && e.pos.y < y+h) : (e.pos.x > x && e.pos.x < x+w);
                    if (e.active && inPath) {
                        e.takeDamage(20);
                        const pushDir = isHorizontal ? new Vec2(1, 0) : new Vec2(0, 1);
                        e.pos = e.pos.add(pushDir.mult(60));
                    }
                });
            } else if (element === 'wind_light') {
                this.spawn_createFloatingText(centerX, centerY, "⚡离子风暴", "#0ea5e9");
                this.enemies.forEach(e => {
                    const inPath = isHorizontal ? (e.pos.y > y && e.pos.y < y+h) : (e.pos.x > x && e.pos.x < x+w);
                    if (e.active && inPath) {
                        e.takeDamage(25);
                        this.spawn_createParticle(e.pos.x, e.pos.y, '#c084fc', 'spark');
                    }
                });
            }
        }
    }
