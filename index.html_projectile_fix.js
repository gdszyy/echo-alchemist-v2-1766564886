class Projectile {
    constructor(x, y, vel, config, isCopy = false, shotId = null, isLast = false) {
        this.pos = new Vec2(x, y);
        this.vel = vel;
        this.config = config;
        this.shotId = shotId;
        this.isLast = isLast;
        this.maxBounces = config.bounce || 0;
        this.maxPierces = config.pierce || 0;
        const params = Projectile.calculateVisualParams(config, isCopy);
        this.radius = params.radius; 
        this.intensity = params.intensity;
        this.active = true;
        this.isCopy = isCopy;
        this.bouncesLeft = config.bounce || 0;
        this.piercesLeft = config.pierce || 0;
        this.hasAreaDamage = config.damage > 0;
        this.maxDurability = (this.maxBounces + this.maxPierces) || 1;
        this.hitCooldowns = new Map();
        this.destroyed = false;
        this.lifeTime = 60 * 15;
        this.chainHistory = [];
        this.trail = []; 
        this.rotation = 0;      
        this.deformation = { x: 1, y: 1 }; 
        this.targetDeformation = { x: 1, y: 1 }; 
        this.elasticity = 0.2;
        this.crackSeed = [];
        this.lastHitEnemy = null;
        for(let i=0; i<3; i++) {
            this.crackSeed.push({
                angle: Math.random() * Math.PI * 2,
                len: 0.3 + Math.random() * 0.4,
                jagged: (Math.random() - 0.5) * 0.5
            });
        }
    }

    static calculateVisualParams(config, isCopy) {
        const v = CONFIG.visuals;
        let r = v.baseRadius + Math.min(v.maxSizeBonus, (config.damage - 2) * v.damageGrowth);
        if (isCopy) r *= v.copyScale;
        if (config.explosive) r *= v.explosiveScale;
        if (config.pierce > 0) r *= v.arrowScale;
        let glow = 1.0 + (config.damage * v.glowPerDamage) / 10;
        glow = Math.min(v.maxGlow / v.glowBase, glow);
        return { radius: r, intensity: glow };
    }

    update(width, height, enemies, spawnCallback, timeScale) {
        if (!this.active) return;
        if (this.config.pierce > 0) {
            this.rotation = Math.atan2(this.vel.y, this.vel.x);
        } else if (this.config.scatter > 0) {
            this.rotation += 0.3 * timeScale; 
        } else {
            this.rotation += 0.1 * timeScale;
        }
        if (this.config.bounce > 0) {
            const speed = this.vel.mag();
            if (speed > 1) {
                const wobble = 1.0 + Math.sin(Date.now() / 100) * 0.1;
                this.targetDeformation = { x: 1/wobble, y: wobble };
            }
        }
        this.deformation.x += (this.targetDeformation.x - this.deformation.x) * this.elasticity * timeScale;
        this.deformation.y += (this.targetDeformation.y - this.deformation.y) * this.elasticity * timeScale;
        this.trail.push({x: this.pos.x, y: this.pos.y});
        if (this.trail.length > 8) this.trail.shift();
        for (const [enemy, timer] of this.hitCooldowns) {
            if (timer > 0) this.hitCooldowns.set(enemy, timer - timeScale);
            else this.hitCooldowns.delete(enemy);
        }
        this.lifeTime -= timeScale;
        if (this.lifeTime <= 0) { this.destroy(spawnCallback); return; }
        const fullMove = this.vel.mult(timeScale);
        const totalSpeed = fullMove.mag();
        let potentialEnemies = [];
        if (totalSpeed > this.radius) {
            potentialEnemies = enemies.filter(e => e.active && this.pos.dist(e.pos) < (totalSpeed + e.width));
        } else {
            potentialEnemies = enemies.filter(e => e.active && this.pos.dist(e.pos) < (this.radius + e.width));
        }
        const steps = Math.ceil(totalSpeed / (this.radius * 0.8));
        const subStepVel = fullMove.mult(1 / steps);
        for (let s = 0; s < steps; s++) {
            this._applyMove(subStepVel, width, height, spawnCallback);
            if (!this.active) return;
            for (let e of potentialEnemies) {
                if (!e.active) continue;
                const dx = this.pos.x - e.pos.x;
                const dy = this.pos.y - e.pos.y;
                const dist = Math.sqrt(dx*dx + dy*dy);
                if (dist < (e.width/2 + this.radius)) {
                    if (this.hitCooldowns.has(e)) continue;
                    this.hitCooldowns.set(e, CONFIG.gameplay.hitCooldowns);
                    this.lastHitEnemy = e;
                    this.onHit(e, enemies);
                    if (this.config.flying_sword) {
                        if (typeof game !== 'undefined') game.combat_flyingSword_assignTarget(e);
                    }
                    if (this.piercesLeft > 0) {
                        if (this.config.flying_sword) {
                            const pegLevel = this.config.level || 1;
                            if (this.hasAreaDamage) this.performSlashAttack(e, game.enemies);
                            if (typeof game !== 'undefined') {
                                const spawnX = e.pos.x + (Math.random()-0.5)*20;
                                const spawnY = e.pos.y + (Math.random()-0.5)*20;
                                game.combat_flyingSword_addSon(spawnX, spawnY, this, pegLevel, this.config);
                            }
                        }
                        this.piercesLeft--;
                        continue;
                    }
                    if (this.bouncesLeft > 0) {
                        this.bouncesLeft--;
                        if (this.config.wind && this.isLast) {
                            if (typeof game !== 'undefined') game.combat_wind_addAnchor(this.pos.x, this.pos.y);
                        }
                        const angle = Math.atan2(dy, dx);
                        const normal = new Vec2(Math.cos(angle), Math.sin(angle));
                        const dot = this.vel.dot(normal);
                        this.vel = this.vel.sub(normal.mult(2 * dot));
                        this.deformation = { x: 1.4, y: 0.6 };
                    } else {
                        this.destroy(spawnCallback);
                        return;
                    }
                }
            }
        }
        if (this.config.explosive) {
            if (Math.random() < 0.7) {
                const spark = new Particle(this.pos.x, this.pos.y, '#fbbf24', 'spark');
                spark.vel = this.vel.mult(-0.2).add(new Vec2((Math.random()-0.5)*2, (Math.random()-0.5)*2));
                game.particles.push(spark);
            }
        }
    }

    _applyMove(vel, width, height, spawnCallback) {
        this.pos = this.pos.add(vel);
        if (this.pos.x < this.radius) { 
            this.pos.x = this.radius; this.vel.x = Math.abs(this.vel.x); 
            if (this.config.wind && this.isLast && typeof game !== 'undefined') game.combat_wind_addAnchor(this.pos.x, this.pos.y);
            const angle = Math.abs(Math.atan2(this.vel.x, this.vel.y));
            if (angle < (10 * Math.PI / 180)) {
                const speed = this.vel.mag();
                const newAngle = angle + (1 * Math.PI / 180);
                this.vel.x = speed * Math.sin(newAngle);
                this.vel.y = speed * Math.cos(newAngle) * (this.vel.y > 0 ? 1 : -1);
            }
            if(this.config.bounce > 0) this.deformation = { x: 0.7, y: 1.3 };
            this.hitCooldowns.clear();
        }
        if (this.pos.x > width - this.radius) { 
            this.pos.x = width - this.radius; this.vel.x = -Math.abs(this.vel.x); 
            if (this.config.wind && this.isLast && typeof game !== 'undefined') game.combat_wind_addAnchor(this.pos.x, this.pos.y);
            const angle = Math.abs(Math.atan2(this.vel.x, this.vel.y));
            if (angle < (10 * Math.PI / 180)) {
                const speed = this.vel.mag();
                const newAngle = angle + (1 * Math.PI / 180);
                this.vel.x = -speed * Math.sin(newAngle);
                this.vel.y = speed * Math.cos(newAngle) * (this.vel.y > 0 ? 1 : -1);
            }
            if(this.config.bounce > 0) this.deformation = { x: 0.7, y: 1.3 };
            this.hitCooldowns.clear();
        }
        if (this.pos.y < this.radius) { 
            this.pos.y = this.radius; this.vel.y = Math.abs(this.vel.y); 
            if (this.config.wind && this.isLast && typeof game !== 'undefined') game.combat_wind_addAnchor(this.pos.x, this.pos.y);
            if(this.config.bounce > 0) this.deformation = { x: 1.3, y: 0.7 };
        }
        if (this.pos.y > height - this.radius) {
            if (game.hasCombatWall) {
                this.pos.y = height - this.radius; this.vel.y = -Math.abs(this.vel.y);
                if (this.config.wind && this.isLast && typeof game !== 'undefined') game.combat_wind_addAnchor(this.pos.x, this.pos.y);
            } else {
                this.destroy(spawnCallback);
            }
        }
    }

    onHit(enemy, allEnemies) {
        game.combat_damageEnemy(enemy, this);
    }

    performSlashAttack(enemy, enemies) {
        const angle = Math.random() * Math.PI * 2;
        const slash = new SlashEffect(enemy.pos.x, enemy.pos.y, angle, 120, this.config.getColor ? this.config.getColor() : '#0ea5e9');
        game.shockwaves.push(slash);
        enemies.forEach(e => {
            if (e !== enemy && e.active && e.pos.dist(enemy.pos) < 80) {
                e.takeDamage(this.config.damage * 0.3);
            }
        });
    }

    destroy(spawnCallback) {
        this.active = false; this.destroyed = true;
        if (this.config.nestedPayload && !this.isCopy) {
             let nextVel = this.vel.norm().mult(this.vel.mag() * 1.1); 
             if (nextVel.mag() < 2) nextVel = new Vec2(0, -5);
             spawnCallback({ x: this.pos.x, y: this.pos.y, vel: nextVel, config: this.config.nestedPayload });
        } else if (this.config.chainPayload && !this.isCopy) {
            let nextVel = this.vel; if (nextVel.mag() < 1) nextVel = new Vec2(0, 5);
            spawnCallback({ x: this.pos.x, y: this.pos.y, vel: nextVel.norm().mult(10), config: this.config.chainPayload });
        }
        if (this.config.type === 'flying_sword') {
            if (this.lastHitEnemy && this.lastHitEnemy.active) this.stickToEnemy(this.lastHitEnemy);
            else this.handleFlyingSwordFinish(null, game);
        }
    }

    stickToEnemy(enemy) {
        const pegLevel = this.config.level || 1;
        const hitAngle = Math.atan2(this.vel.y, this.vel.x);
        const randomAngle = hitAngle + (Math.random() - 0.5) * (Math.PI / 6);
        const randomOffsetX = (Math.random() - 0.5) * (enemy.width * 0.6);
        const randomOffsetY = (Math.random() - 0.5) * (enemy.height * 0.6);
        const stuckPos = enemy.pos.add(new Vec2(randomOffsetX, randomOffsetY));
        const stuckBlade = new SonSword(stuckPos.x, stuckPos.y, this, pegLevel, this.config);
        stuckBlade.state = 'stuck'; stuckBlade.stuckHost = enemy; stuckBlade.stuckOffset = new Vec2(randomOffsetX, randomOffsetY);
        stuckBlade.angle = randomAngle; stuckBlade.isMotherBlade = true; 
        enemy.addSwordCrack(stuckBlade.stuckOffset, randomAngle + Math.PI/2);
        game.sonSwords.push(stuckBlade); 
        if (enemy.stuckSwords) enemy.stuckSwords.push(stuckBlade);
        game.spawn_createFloatingText(stuckPos.x, stuckPos.y, "🗡️STUCK", "#0ea5e9");
        audio.playSlash();
        this.performSlashAttack(enemy, game.enemies);
        game.sonSwords.forEach(s => {
            if (s.mother === this && s !== stuckBlade && s.active) {
                if (pegLevel === 1) { s.active = false; game.spawn_createParticle(s.pos.x, s.pos.y, '#0ea5e9', 'mist'); } 
                else if (pegLevel === 2) { s.attacksLeft = s.maxAttacks; s.isAutoHunting = true; game.spawn_createFloatingText(s.pos.x, s.pos.y, "RESET", "#6366f1"); } 
                else if (pegLevel >= 3) { s.isAutoHunting = true; }
            }
        });
    }

    handleFlyingSwordFinish(enemy, game) {
        game.sonSwords.forEach(s => {
            if (s.mother === this && s.active) {
                s.active = false;
                game.spawn_createParticle(s.pos.x, s.pos.y, '#0ea5e9', 'mist');
            }
        });
    }

    draw(ctx) {
        if (!this.active && !this.destroyed) return;
        ctx.save();
        ctx.translate(this.pos.x, this.pos.y);
        ctx.rotate(this.rotation);
        ctx.scale(this.deformation.x, this.deformation.y);
        const color = this.config.getColor ? this.config.getColor() : '#ffffff';
        ctx.shadowBlur = 15 * this.intensity;
        ctx.shadowColor = color;
        ctx.fillStyle = color;
        ctx.beginPath();
        if (this.config.pierce > 0) {
            ctx.moveTo(this.radius * 1.5, 0);
            ctx.lineTo(-this.radius, -this.radius * 0.8);
            ctx.lineTo(-this.radius * 0.5, 0);
            ctx.lineTo(-this.radius, this.radius * 0.8);
        } else {
            ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
        }
        ctx.fill();
        ctx.restore();
    }
}
