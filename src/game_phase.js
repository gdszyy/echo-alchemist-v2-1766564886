import { 
    META_SHOP_CONFIG, ATTRIBUTES_FOR_SHOP, setDeepValue, CONFIG, RELIC_DB, SKILL_DB 
} from './config.js';
import { 
    Vec2, MarbleDefinition, SpecialSlot, FortuneWheel, TriangleSideWheel, GhostPeg, Peg, DropBall, Enemy, SwordQi, 
    SlashAnim, SonSword, Projectile, CloneSpore, Particle, SlashEffect, CollectionBeam, 
    Shockwave, LaserBeam, FloatingText, EnergyOrb, LightningBolt, FireWave, showToast, 
    rotateTowards, adjustColorBrightness, lerpColor, lerp, hexToRgba 
} from './entities.js';
import { UIManager, TrainingGround, TruthBook } from './systems.js';
import { audio } from './audio.js';
import { eventBus, EVENT_TYPES } from './event_bus.js';
import { RUNE_DB } from './rune_config.js';
import { sb as _sb } from './utils/perf.js';
import { EMITTER_PORT_OFFSET_Y } from './bitmap_icons.js';
import {
    calcDropDistribution,
    generateHeatmapData,
    adjustDistributionForEntry,
    getLayoutParams,
    getAllLayoutHints,
} from './plinko_physics.js';
import {
    buildModuleEntities,
    calcModuleSlotRect,
    createDefaultModuleLayout,
    ensureModuleLayoutInstances,
    getActiveModuleSlots,
    MODULE_DEFS,
    getModuleIdFromEntry,
    getModuleSpan,
    isModuleRef,
    selectFusionTargetPegs,
    setModulePegState,
} from './pinboard_modules.js';
import { calc_getCirclePolygonCollision, calc_getCircleArcCollision } from './combat/collision_shapes.js';

function getCombatAimEnemyHit(game, start, dir, maxDist, radius) {
    let closest = null;
    const enemies = Array.isArray(game.enemies) ? game.enemies : [];

    const rayAabbRange = (minX, maxX, minY, maxY) => {
        let tMin = -Infinity;
        let tMax = Infinity;
        let normal = null;

        if (Math.abs(dir.x) < 0.0001) {
            if (start.x < minX || start.x > maxX) return null;
        } else {
            const tx1 = (minX - start.x) / dir.x;
            const tx2 = (maxX - start.x) / dir.x;
            const nearX = Math.min(tx1, tx2);
            const farX = Math.max(tx1, tx2);
            if (nearX > tMin) normal = new Vec2(tx1 < tx2 ? -1 : 1, 0);
            tMin = Math.max(tMin, nearX);
            tMax = Math.min(tMax, farX);
        }

        if (Math.abs(dir.y) < 0.0001) {
            if (start.y < minY || start.y > maxY) return null;
        } else {
            const ty1 = (minY - start.y) / dir.y;
            const ty2 = (maxY - start.y) / dir.y;
            const nearY = Math.min(ty1, ty2);
            const farY = Math.max(ty1, ty2);
            if (nearY > tMin) normal = new Vec2(0, ty1 < ty2 ? -1 : 1);
            tMin = Math.max(tMin, nearY);
            tMax = Math.min(tMax, farY);
        }

        if (tMax < Math.max(0.01, tMin)) return null;
        return { enter: tMin > 0.01 ? tMin : tMax, exit: tMax, normal };
    };

    const shapeHitAt = (enemy, point) => {
        if (enemy.collisionShape === 'polygon' && enemy.collisionData) {
            const absoluteVertices = typeof enemy.getAbsoluteVertices === 'function'
                ? enemy.getAbsoluteVertices()
                : (enemy.collisionData.vertices || []).map(v => new Vec2(enemy.pos.x + v.x, enemy.pos.y + v.y));
            return calc_getCirclePolygonCollision(point, radius, absoluteVertices);
        }

        if (enemy.collisionShape === 'arc' && enemy.collisionData) {
            return calc_getCircleArcCollision(
                point,
                radius,
                enemy.pos,
                enemy.collisionData.radius,
                enemy.collisionData.startAngle,
                enemy.collisionData.endAngle,
                enemy.collisionData.thickness
            );
        }

        return null;
    };

    for (const enemy of enemies) {
        if (!enemy || !enemy.active) continue;
        if (typeof game.phase_isEnemyClearable === 'function' && !game.phase_isEnemyClearable(enemy)) continue;

        const halfW = (enemy.width || 0) / 2 + radius;
        const halfH = (enemy.height || 0) / 2 + radius;
        if (halfW <= 0 || halfH <= 0) continue;

        const minX = enemy.pos.x - halfW;
        const maxX = enemy.pos.x + halfW;
        const minY = enemy.pos.y - halfH;
        const maxY = enemy.pos.y + halfH;
        const range = rayAabbRange(minX, maxX, minY, maxY);
        if (!range) continue;

        if (enemy.collisionShape === 'polygon' || enemy.collisionShape === 'arc') {
            const endDist = Math.min(range.exit, maxDist);
            if (endDist <= 0.01 || range.enter >= maxDist) continue;
            const step = Math.max(2, Math.min(6, radius * 0.65));
            let prevDist = Math.max(0.01, range.enter - step);
            let found = null;

            for (let dist = Math.max(0.01, range.enter); dist <= endDist; dist += step) {
                const point = start.add(dir.mult(dist));
                const hit = shapeHitAt(enemy, point);
                if (!hit) {
                    prevDist = dist;
                    continue;
                }

                let lo = prevDist;
                let hi = dist;
                let refinedHit = hit;
                for (let iter = 0; iter < 7; iter++) {
                    const mid = (lo + hi) / 2;
                    const midHit = shapeHitAt(enemy, start.add(dir.mult(mid)));
                    if (midHit) {
                        hi = mid;
                        refinedHit = midHit;
                    } else {
                        lo = mid;
                    }
                }
                found = { dist: hi, normal: refinedHit.normal, enemy };
                break;
            }

            if (found && (!closest || found.dist < closest.dist)) {
                closest = found;
            }
            continue;
        }

        const dist = range.enter;
        if (dist <= 0.01 || dist >= maxDist) continue;
        if (!closest || dist < closest.dist) {
            closest = { dist, normal: range.normal, enemy };
        }
    }

    return closest;
}

function buildCombatAimGuide(game, start, dir, bounceCount = 3, options = {}) {
    const radius = CONFIG.physics.bulletRadius;
    const topBound = (game.combatGridTopY != null && game.enemyHeight != null)
        ? (game.combatGridTopY - game.enemyHeight / 2 + radius)
        : radius;
    const combatBounds = game.sys_getCombatBounds ? game.sys_getCombatBounds() : { left: 0, right: game.width };
    const leftBound = combatBounds.left + radius;
    const rightBound = combatBounds.right - radius;
    const bottomBound = game.height - radius;
    const points = [start];
    const bouncePoints = [];
    const enemyBouncePoints = [];
    let piercesLeft = Math.max(0, options.pierce || 0);
    let current = start;
    let currentDir = new Vec2(dir.x, dir.y);

    for (let i = 0; i < bounceCount; i++) {
        let hitDist = Infinity;
        let normal = null;
        let hitType = 'wall';

        if (currentDir.x > 0) {
            const dist = (rightBound - current.x) / currentDir.x;
            if (dist > 0.01 && dist < hitDist) {
                hitDist = dist;
                normal = 'x';
            }
        } else if (currentDir.x < 0) {
            const dist = (leftBound - current.x) / currentDir.x;
            if (dist > 0.01 && dist < hitDist) {
                hitDist = dist;
                normal = 'x';
            }
        }

        if (currentDir.y < 0) {
            const dist = (topBound - current.y) / currentDir.y;
            if (dist > 0.01 && dist < hitDist) {
                hitDist = dist;
                normal = 'y';
            }
        } else if (game.hasCombatWall && currentDir.y > 0) {
            const dist = (bottomBound - current.y) / currentDir.y;
            if (dist > 0.01 && dist < hitDist) {
                hitDist = dist;
                normal = 'y';
            }
        } else if (currentDir.y > 0) {
            const terminalDist = (bottomBound - current.y) / currentDir.y;
            if (terminalDist > 0.01 && terminalDist < hitDist) {
                points.push(current.add(currentDir.mult(terminalDist)));
                return { points, bouncePoints, enemyBouncePoints };
            }
        }

        const enemyHit = getCombatAimEnemyHit(game, current, currentDir, hitDist, radius);
        if (enemyHit && enemyHit.normal) {
            hitDist = enemyHit.dist;
            normal = enemyHit.normal;
            hitType = 'enemy';
        }

        if (!Number.isFinite(hitDist) || !normal) break;

        const hitPoint = current.add(currentDir.mult(hitDist));
        points.push(hitPoint);
        if (hitType === 'enemy' && piercesLeft > 0) {
            piercesLeft--;
            current = hitPoint.add(currentDir.mult(radius + 1));
            continue;
        }

        if (hitType === 'enemy') enemyBouncePoints.push(hitPoint);
        else bouncePoints.push(hitPoint);

        if (typeof normal === 'string') {
            if (normal === 'x') currentDir.x *= -1;
            else currentDir.y *= -1;
        } else {
            const dot = currentDir.dot(normal);
            currentDir = currentDir.sub(normal.mult(2 * dot)).norm();
        }
        current = hitPoint.add(currentDir.mult(0.5));
    }

    const tailLength = Math.min(Math.max(game.width, game.height) * 0.65, 460);
    points.push(current.add(currentDir.mult(tailLength)));
    return { points, bouncePoints, enemyBouncePoints };
}

function buildCombatAimGuides(game, start, dir, recipe) {
    const scatterOffsets = buildCombatAimScatterOffsets(game, recipe);
    const pierce = recipe ? Math.max(0, Math.floor(recipe.pierce || 0)) : 0;
    const guides = [{
        kind: 'main',
        guide: buildCombatAimGuide(game, start, dir, 3, { pierce }),
    }];

    scatterOffsets.forEach((angleOffset) => {
        guides.push({
            kind: 'scatter',
            guide: buildCombatAimGuide(game, start, dir.rotate(angleOffset), 3, { pierce }),
        });
    });

    return guides;
}

function buildCombatAimScatterOffsets(game, recipe) {
    if (!recipe || recipe.wind) return [];

    const baseScatter = Math.max(0, Math.floor(recipe.scatter || 0));
    if (baseScatter <= 0) return [];

    const scatterResonance = !recipe.isLaser && game.activeElementResonances
        ? game.activeElementResonances.scatter
        : null;
    const scatterResParams = scatterResonance ? scatterResonance.params : null;
    const extraScatterShots = scatterResParams ? Math.max(0, Math.floor(scatterResParams.extraScatterShots || 0)) : 0;
    const scatterAngleReduction = scatterResParams ? Math.max(0, Math.min(1, scatterResParams.scatterAngleReduction || 0)) : 0;
    const scatterCount = baseScatter + extraScatterShots;
    const guideCount = Math.floor(scatterCount / 2) + (scatterCount % 2);
    const baseAngleMult = recipe._scatterAngleMultiplier !== undefined ? recipe._scatterAngleMultiplier : 1.0;
    const scatterAngleMult = baseAngleMult * (1 - scatterAngleReduction);
    const offsets = [];

    for (let idx = 1; idx <= Math.min(guideCount, 6); idx++) {
        const sign = idx % 2 === 0 ? -1 : 1;
        const multiplier = Math.ceil(idx / 2);
        offsets.push(0.2 * multiplier * sign * scatterAngleMult);
    }

    return offsets;
}

function drawModuleFootprintOutline(ctx, rect, footprint, color, pulse = 0) {
    if (!ctx || !rect || !footprint) return false;
    const { x, y, w, h } = rect;
    const px = (v) => x + w * v;
    const py = (v) => y + h * v;
    const wobble = 1 + pulse * 0.04;

    ctx.save();
    ctx.setLineDash([]);
    ctx.lineWidth = 2;
    ctx.strokeStyle = color;
    ctx.fillStyle = 'rgba(15, 23, 42, 0.16)';
    ctx.beginPath();

    switch (footprint) {
        case 'fin-left':
            ctx.moveTo(px(0.20), py(0.18));
            ctx.lineTo(px(0.52), py(0.48));
            ctx.lineTo(px(0.80), py(0.84));
            break;
        case 'fin-right':
            ctx.moveTo(px(0.80), py(0.18));
            ctx.lineTo(px(0.48), py(0.48));
            ctx.lineTo(px(0.20), py(0.84));
            break;
        case 'diamond':
            ctx.moveTo(px(0.50), py(0.18));
            ctx.lineTo(px(0.76), py(0.48));
            ctx.lineTo(px(0.50), py(0.84));
            ctx.lineTo(px(0.24), py(0.48));
            ctx.closePath();
            break;
        case 'chamber':
            ctx.ellipse(px(0.50), py(0.52), w * 0.30 * wobble, h * 0.30, 0, 0, Math.PI * 2);
            break;
        case 'triangle-core':
            ctx.moveTo(px(0.50), py(0.18));
            ctx.lineTo(px(0.78), py(0.82));
            ctx.lineTo(px(0.22), py(0.82));
            ctx.closePath();
            break;
        case 'cup':
            ctx.moveTo(px(0.18), py(0.30));
            ctx.quadraticCurveTo(px(0.18), py(0.84), px(0.50), py(0.84));
            ctx.quadraticCurveTo(px(0.82), py(0.84), px(0.82), py(0.30));
            break;
        case 'yoke':
            ctx.moveTo(px(0.50), py(0.18));
            ctx.lineTo(px(0.50), py(0.48));
            ctx.moveTo(px(0.50), py(0.48));
            ctx.lineTo(px(0.24), py(0.82));
            ctx.moveTo(px(0.50), py(0.48));
            ctx.lineTo(px(0.76), py(0.82));
            break;
        case 'hourglass':
            ctx.moveTo(px(0.22), py(0.14));
            ctx.lineTo(px(0.78), py(0.14));
            ctx.lineTo(px(0.50), py(0.50));
            ctx.lineTo(px(0.78), py(0.86));
            ctx.lineTo(px(0.22), py(0.86));
            ctx.lineTo(px(0.50), py(0.50));
            ctx.closePath();
            break;
        case 'crescent':
            ctx.moveTo(px(0.22), py(0.28));
            ctx.quadraticCurveTo(px(0.86), py(0.10), px(0.78), py(0.62));
            ctx.quadraticCurveTo(px(0.72), py(0.90), px(0.34), py(0.78));
            break;
        case 'spiral':
            ctx.arc(px(0.50), py(0.50), Math.min(w, h) * 0.32, -0.3, Math.PI * 1.75);
            ctx.arc(px(0.50), py(0.50), Math.min(w, h) * 0.17, Math.PI * 1.75, Math.PI * 0.45, true);
            break;
        case 'prism':
            ctx.moveTo(px(0.50), py(0.18));
            ctx.lineTo(px(0.76), py(0.74));
            ctx.lineTo(px(0.24), py(0.74));
            ctx.closePath();
            ctx.moveTo(px(0.50), py(0.18));
            ctx.lineTo(px(0.50), py(0.84));
            break;
        case 'bridge':
            ctx.moveTo(px(0.12), py(0.72));
            ctx.quadraticCurveTo(px(0.50), py(0.20), px(0.88), py(0.72));
            ctx.moveTo(px(0.32), py(0.72));
            ctx.lineTo(px(0.68), py(0.72));
            break;
        default:
            return false;
    }

    ctx.stroke();
    ctx.restore();
    return true;
}

function pickBottomRewardType(game) {
    const cfg = CONFIG.gameplay || {};
    const types = Array.isArray(cfg.bottomRewardOnlyTypes) ? cfg.bottomRewardOnlyTypes : ['explosive', 'laser'];
    const baseWeights = cfg.bottomRewardZoneWeights || {};
    const runtimeWeights = game && game.unlockedWeights ? game.unlockedWeights : {};
    const weighted = types
        .map(type => ({ type, weight: Math.max(0, runtimeWeights[type] || baseWeights[type] || 0) }))
        .filter(item => item.weight > 0);
    if (!weighted.length) return types[0] || 'explosive';
    const total = weighted.reduce((sum, item) => sum + item.weight, 0);
    let r = Math.random() * total;
    for (const item of weighted) {
        r -= item.weight;
        if (r <= 0) return item.type;
    }
    return weighted[0].type;
}

function makeBottomRewardBarrier(x, y1, y2, rewardType) {
    const peg = new Peg(x, (y1 + y2) / 2, 'pink');
    peg.shape = 'barrier';
    peg.segment = { x1: x, y1, x2: x, y2 };
    peg.thickness = Math.max((CONFIG.physics.pegRadius || 4) * 2.15, 8.5);
    peg.radius = peg.thickness / 2;
    peg.level = 1;
    peg.layoutRole = 'bottom_reward_gate';
    peg.rewardLaneType = rewardType;
    return peg;
}

// @perf-impact: Bottom reward lanes add a small capped number of barrier Peg strokes and flat HUD bands; Peg shadow remains CONFIG.performance-gated.
function buildBottomRewardZones(game, maxPegY, canvasWidth, canvasHeight) {
    const cfg = CONFIG.gameplay || {};
    const chance = cfg.bottomRewardZoneChance ?? 0.25;
    if (Math.random() >= chance) return { zones: [], barriers: [] };

    const maxCount = Math.max(0, cfg.bottomRewardZoneMaxCount || 1);
    if (maxCount <= 0) return { zones: [], barriers: [] };

    const maxRadius = (CONFIG.physics.marbleRadius || 5.8) + (CONFIG.physics.maxMarbleSizeBonus || 0);
    const zoneWidth = Math.max(18, maxRadius * 2 * (cfg.bottomRewardZoneWidthMultiplier || 1.5));
    const zoneHeight = Math.max(34, cfg.bottomRewardZoneHeight || 48);
    const barrierHalf = Math.max((CONFIG.physics.pegRadius || 4) * 2.15, 8.5) / 2;
    const centerClearance = Math.min(zoneWidth / 2 - 2, maxRadius + barrierHalf);
    const top = Math.min(
        canvasHeight - zoneHeight - 28,
        Math.max(maxPegY + 46, canvasHeight - 128)
    );
    const minX = Math.max(18, (CONFIG.physics.marbleRadius || 5.8) * 2);
    const maxX = Math.max(minX, canvasWidth - zoneWidth - minX);
    const lanes = [
        canvasWidth * 0.28 - zoneWidth / 2,
        canvasWidth * 0.50 - zoneWidth / 2,
        canvasWidth * 0.72 - zoneWidth / 2,
    ].map(x => Math.max(minX, Math.min(maxX, x)));
    const shuffled = lanes
        .map(x => ({ x, roll: Math.random() }))
        .sort((a, b) => a.roll - b.roll)
        .map(item => item.x);
    const additionalChance = Math.max(0, Math.min(1, cfg.bottomRewardZoneAdditionalChance ?? 0.35));
    const targetCount = 1;
    let count = targetCount;
    while (count < Math.min(maxCount, shuffled.length) && Math.random() < additionalChance) {
        count++;
    }

    const zones = [];
    const barriers = [];
    for (let i = 0; i < count; i++) {
        const x = shuffled[i];
        const type = pickBottomRewardType(game);
        const display = CONFIG.ui.attributeDisplay[type] || {};
        const zone = {
            id: `bottom_reward_${type}_${Math.round(x)}_${Math.round(top)}_${i}`,
            x,
            y: top,
            w: zoneWidth,
            h: zoneHeight,
            entryX1: x + centerClearance,
            entryX2: x + zoneWidth - centerClearance,
            type,
            color: display.color || '#fbbf24',
            label: display.name || type,
        };
        zones.push(zone);
        barriers.push(
            makeBottomRewardBarrier(x, top, top + zoneHeight, type),
            makeBottomRewardBarrier(x + zoneWidth, top, top + zoneHeight, type),
        );
    }
    return { zones, barriers };
}

function drawBottomRewardZones(ctx, zones) {
    if (!ctx || !Array.isArray(zones) || zones.length === 0) return;
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '700 10px sans-serif';
    for (const zone of zones) {
        if (!zone) continue;
        const color = zone.color || '#fbbf24';
        ctx.globalAlpha = 0.16;
        ctx.fillStyle = color;
        ctx.fillRect(zone.x, zone.y, zone.w, zone.h);
        ctx.globalAlpha = 0.88;
        ctx.strokeStyle = color;
        ctx.lineWidth = 1.5;
        ctx.strokeRect(zone.x + 0.5, zone.y + 0.5, zone.w - 1, zone.h - 1);
        if (Number.isFinite(zone.entryX1) && Number.isFinite(zone.entryX2) && zone.entryX2 > zone.entryX1) {
            ctx.globalAlpha = 0.32;
            ctx.fillStyle = color;
            ctx.fillRect(zone.entryX1, zone.y, zone.entryX2 - zone.entryX1, zone.h);
        }
        ctx.globalAlpha = 1;
        ctx.fillStyle = '#f8fafc';
        ctx.fillText(`+${zone.label}`, zone.x + zone.w / 2, zone.y + zone.h / 2);
    }
    ctx.restore();
}

function buildFallbackMarbleQueue(game) {
    const cfg = CONFIG.gameplay || {};
    const required = Math.max(1, (cfg.selectionReq || 3));
    const existingPool = Array.isArray(game.marblesPool) ? game.marblesPool : [];
    const selected = Array.isArray(game.selectedMarbles) ? game.selectedMarbles : [];
    const queue = selected
        .map(i => existingPool[i])
        .filter(Boolean);

    for (const marble of existingPool) {
        if (queue.length >= required) break;
        if (marble && !queue.includes(marble)) queue.push(marble);
    }

    const rewardOnlyTypes = new Set(cfg.bottomRewardOnlyTypes || []);
    const weighted = Object.entries(game.unlockedWeights || CONFIG.probabilities || {})
        .filter(([type, weight]) => (weight || 0) > 0 && !rewardOnlyTypes.has(type) && type !== 'normal')
        .map(([type, weight]) => ({ type, weight }));
    const total = weighted.reduce((sum, item) => sum + item.weight, 0);
    const pickType = () => {
        if (total <= 0 || weighted.length === 0) return 'white';
        let roll = Math.random() * total;
        for (const item of weighted) {
            roll -= item.weight;
            if (roll <= 0) return item.type;
        }
        return weighted[0].type;
    };

    while (queue.length < required) {
        queue.push(new MarbleDefinition(pickType()));
    }
    return queue.slice(0, required);
}

export const game_phase = {
/**
     * @method advanceWave
     * @description [DEAD CODE] 此方法从未被调用，其职责已由 phase_finalizeRound 完全承担。
     * [fix] 移除了幽灵调用 this.resolveTemperatureAndAdvance()：
     *   - 该方法在整个项目历史中从未被实现（只有调用，没有定义）
     *   - 温度结算逻辑已完整实现于 phase_enemy_processTurn() 中
     *   - 此方法本身也是死代码（无调用者），保留仅作历史参考
     */
    phase_advanceWave() { 
        // [fix] 移除幽灵调用：this.resolveTemperatureAndAdvance() 从未被实现
        // 温度结算已在 phase_enemy_processTurn() 中逐敌处理，无需在此重复
        // 根据场上敌人行数决定生成多少行新敌人
        const rows = new Set(this.enemies.filter(e=>e.active).map(e => Math.floor(e.pos.y))); 
        let spawnCount = 1; 
        if (rows.size < 3) spawnCount = 2; // 如果敌人行数少于3，则生成2行
        this.spawn_spawnEnemyRow(spawnCount); 
        
        // [BUGFIX #5b] 删除此处的 round++，避免与 phase_finalizeRound 中的 round++ 重复执行
        // 原 Bug: round++ 在 phase_advanceWave 和 phase_finalizeRound 中均执行，导致回合计数异常
        // 回合计数的唯一执行位置保留在 phase_finalizeRound 中
        this.prevRoundDamage = this.roundDamage; // 记录上一回合伤害
        this.roundDamage = 0; // 重置本回合伤害
        // 重置实时 DPS 滑窗
        this._damageRecentSamples = [];
        this._dps = 0;
        // 事件总线广播波次推进（[BUGFIX #5b] 保留：不在此处更新 DOM，由 UI 监听 wave:advance 事件处理）
        eventBus.emit(EVENT_TYPES.WAVE_ADVANCED, { round: this.round });
    },

/**
     * @method switchPhase
     * @description 切换游戏阶段。
     * @param {string} newPhase - **重要参数** 新阶段名称 ('selection', 'gathering', 'combat', 'gameover')。
     */
    phase_switchPhase(newPhase) {
        const oldPhase = this.phase;
        this.phase = newPhase;

        // [DEBUG-LOG] 记录每次 phase 切换的来源和调用栈
        // [BUGFIX] 使用 _isRuneLauncherOpen() 兼容 PC 模式和移动端模式
        const launcherVisible = this._isRuneLauncherOpen ? this._isRuneLauncherOpen() : false;
        if (launcherVisible) {
            console.warn('[phase_switchPhase] ⚠️ 符文发射器打开期间发生 phase 切换！' + oldPhase + ' -> ' + newPhase + '\n调用栈:', new Error().stack);
        } else {
            console.log('[phase_switchPhase] ' + oldPhase + ' -> ' + newPhase);
        }
        
        // 事件总线广播阶段切换
        eventBus.emit(EVENT_TYPES.PHASE_CHANGED, { from: oldPhase, to: newPhase });
        
        // [修复] 每次切换阶段时重置 container 的 3D 变换，防止研磨阶段的倾斜特效泄漏到其他阶段
        const container = document.getElementById('game-container');
        if (container) {
            container.style.transform = '';
            container.style.perspective = '';
            container.style.transition = '';
        }
        
        this.ui_updateUI(); // 更新 UI 界面
        // [重构] 将阶段标题的 DOM 操作集中到 ui_system.js 的 ui_onPhaseChange 方法中
        this.ui_onPhaseChange(newPhase);
    },

/**
     */
    phase_startGatheringPhase() {
        // 保存上一回合的伤害数据
        if (this.shotDamageHistory.length > 0) {
            this.roundDamageHistory.push({
                round: this.round,
                shots: this.shotDamageHistory.map(s => ({ total: s.total, byAttr: { ...s.byAttr } }))
            });
        }

        // --- [遗物 Hook] 混沌契约 (chaos_pact)：跳过研磨阶段，直接进入战斗 ---
        // 规则：契约持有者无法进行研磨；ammoQueue 复用上一回合的子弹快照，没有则用默认基础子弹兜底。
        // [v2 重构] 必须在切换到 gathering / 构建钉板之前判断并提前返回。
        if (this.ownedRelics && this.ownedRelics.includes('chaos_pact')) {
            const baseDmg = (CONFIG && CONFIG.gameplay && CONFIG.gameplay.baseDamage) || 1;
            const defaultRecipe = () => ({
                damage: baseDmg, bounce: 0, pierce: 0, scatter: 0, explosive: false,
                isMatryoshka: false, isLaser: false, nestedPayload: null, chainPayload: null,
                multicast: 0, flying_sword: 0, cryo: 0, pyro: 0, lightning: 0, laser: 0,
                wind: 0, overcharge: 0, level: 1, type: 'normal'
            });
            const snapshot = this._lastFiredAmmoSnapshot;
            if (snapshot && snapshot.length > 0) {
                this.ammoQueue = snapshot.map(r => ({ ...r }));
            } else {
                this.ammoQueue = [defaultRecipe(), defaultRecipe(), defaultRecipe()];
            }
            if (typeof showToast === 'function') showToast('混沌契约：跳过研磨，直接进入战斗！');
            if (typeof this.phase_startCombatPhase === 'function') this.phase_startCombatPhase();
            else this.phase_switchPhase('combat');
            return;
        }

        // Round-start banner switches to the gathering background before this initializer runs.
        // If that transitional state is saved/restored or a special flow cleared marbleQueue,
        // rebuild launchable marble definitions here instead of entering an empty grind.
        if (!Array.isArray(this.marbleQueue) || this.marbleQueue.length === 0) {
            this.marbleQueue = buildFallbackMarbleQueue(this);
            this.marblesPool = this.marbleQueue.slice();
            this.selectedMarbles = this.marbleQueue.map((_, idx) => idx);
        }

        this.phase_switchPhase('gathering');
        requestAnimationFrame(() => {
            this.ui_updateUICache();
        });
        // 确保每次进入收集阶段都初始化钉板，因为钉板可能在战斗阶段被清空
        // 或者在游戏重置后需要初始化。
        this.phase_gathering_initPachinko(this.round > 1);
        
        // --- 新增：初始化持久阈值变量 ---
        this.persistentThreshold = CONFIG.gameplay.initTriggerThreshold; 
        // -----------------------------
        this.ui.updateSkillPoints(this.skillPoints);
        this.ammoQueue = []; 
        this.dropBalls = []; 
        this.gatheringSessions = [];
        this.currentSession = null;
        this.activeMarbleIndex = 0; 
        this.combat_updateHitProgress(0, this.persistentThreshold);
        this.ui_updateGatheringQueueUI();
        this.ui_renderRecipeHUD();
        this.combat_updateMulticastDisplay(0);
        this.ui_renderRecipeHUD();

        // ==================== [v2 重构] 钉板编辑入口 ====================
        // 实时钉板已构建完成后，只显示「编辑钉板」入口；玩家点击入口才进入编辑态。
        // 常态研磨不叠加编辑虚框，避免把装备/卸下误做成直接点击画布。
        const skipEditor = this._isTutorialRun;
        if (!skipEditor && typeof this.ui_showModuleEditorEntry === 'function') {
            this.ui_showModuleEditorEntry();
        }
    },

/**
     */
    // @section:pachinko_board_layout - 弹珠台布局计算与钉子生成
    // [v2 模块化重写] 钉板由 CONFIG.gameplay.moduleCols/Rows 定义，解锁顺序通过 moduleUnlockOrder 居中展开。
    // 每个模块独立生成自己区域内的钉子/特殊槽。普通钉子会按当前 unlockedWeights 随机赋予属性，随后符文融合继续补充注入。

    phase_gathering_initPachinko_v2(shouldInherit = false) {
        const cfg = CONFIG.gameplay;
        const canvasWidth = (this.width && this.width > 0) ? this.width : 400;
        const canvasHeight = (this.height && this.height > 0) ? this.height : 600;
        const moduleBuildCtx = this;
        const totalSlots = (cfg.moduleCols || 4) * (cfg.moduleRows || 3);

        // 确保 currentModuleLayout 存在；长度不匹配时由 ensureModuleLayoutInstances 迁移到当前网格。
        if (!Array.isArray(this.currentModuleLayout)) {
            this.currentModuleLayout = createDefaultModuleLayout(totalSlots, cfg.moduleDefaultSlots || 3);
        }
        this.currentModuleLayout = ensureModuleLayoutInstances(
            this.currentModuleLayout,
            totalSlots,
            cfg.moduleDefaultSlots || 3
        );

        const previousPegs = [...(this.pegs || [])];
        this.pegs = [];
        this.specialSlots = [];

        let maxPegY = 0;
        const activeSlots = getActiveModuleSlots(
            this.unlockedModuleSlots || cfg.moduleDefaultSlots || 3,
            totalSlots,
            cfg
        );

        for (const i of activeSlots) {
            const entry = this.currentModuleLayout[i];
            // 跳过空槽和被多格模块覆盖的非锚点槽（{ ref: anchorIdx }）
            if (!entry || isModuleRef(entry)) continue;
            const moduleId = getModuleIdFromEntry(entry);
            if (!moduleId) continue;
            const span = getModuleSpan(moduleId);
            const rect = calcModuleSlotRect(i, canvasWidth, canvasHeight, cfg, span);
            const result = buildModuleEntities(entry, rect.x, rect.y, rect.w, rect.h, moduleBuildCtx, i);
            if (result.pegs && result.pegs.length > 0) {
                for (const p of result.pegs) {
                    p.moduleSlotIdx = i;
                    this.pegs.push(p);
                    if (p.pos.y > maxPegY) maxPegY = p.pos.y;
                }
            }
            if (result.specialSlots && result.specialSlots.length > 0) {
                for (const s of result.specialSlots) {
                    s.moduleSlotIdx = i;
                    this.specialSlots.push(s);
                }
            }
        }

        const bottomReward = buildBottomRewardZones(this, maxPegY, canvasWidth, canvasHeight);
        this.bottomRewardZones = bottomReward.zones;
        for (const barrier of bottomReward.barriers) {
            this.pegs.push(barrier);
            if (barrier.segment && barrier.segment.y2 > maxPegY) maxPegY = barrier.segment.y2;
        }

        this.boardBottomY = maxPegY;

        // [继承] 上一回合钉子按索引保留 type/level（仅当数量一致且非粉色）
        if (shouldInherit && previousPegs.length > 0) {
            for (let i = 0; i < this.pegs.length && i < previousPegs.length; i++) {
                const cur = this.pegs[i];
                const prev = previousPegs[i];
                if (prev && prev.type !== 'pink' && cur.type === 'normal') {
                    cur.type = prev.type;
                    cur.level = prev.level || 1;
                    if (prev.cooldownTimer !== undefined) cur.cooldownTimer = prev.cooldownTimer;
                }
            }
        }

        // [pink_slime 遗物] 额外随机粉色钉子
        const pinkCount = this.pinkPegCount || 0;
        for (let i = 0; i < pinkCount; i++) {
            if (this.pegs.length > 0) {
                const idx = Math.floor(Math.random() * this.pegs.length);
                this.pegs[idx].type = 'pink';
            }
        }

        // [unlock_slot 遗物 + slot_count_up] 在模块外额外创建特殊槽
        let effectiveSlots = [...(this.unlockedSlots || [])];
        if (!this.activeSkills || this.activeSkills.length === 0) {
            effectiveSlots = effectiveSlots.filter(t => t !== 'skill_point');
        }
        const effectiveSlotCount = Math.min(this.slotCount || 0, effectiveSlots.length > 0 ? this.slotCount : 0);
        if (effectiveSlots.length > 0 && effectiveSlotCount > 0) {
            const validIdx = this.pegs.map((p, i) => i).filter(i => this.pegs[i].type !== 'pink');
            const sortedByY = [...validIdx].sort((a, b) => this.pegs[b].pos.y - this.pegs[a].pos.y);
            const used = new Set();
            // 也排除已被模块产生的 specialSlots 占用的钉子
            for (const s of this.specialSlots) {
                if (s.pegIndex !== undefined) used.add(s.pegIndex);
                if (s.pegIndex2 !== undefined) used.add(s.pegIndex2);
            }
            let created = 0;
            for (let i = 0; i < sortedByY.length && created < effectiveSlotCount; i++) {
                const idxA = sortedByY[i];
                if (used.has(idxA)) continue;
                let bestIdxB = -1;
                let bestDist = Infinity;
                for (let j = i + 1; j < sortedByY.length; j++) {
                    const idxB = sortedByY[j];
                    if (used.has(idxB)) continue;
                    const dx = this.pegs[idxA].pos.x - this.pegs[idxB].pos.x;
                    const dy = this.pegs[idxA].pos.y - this.pegs[idxB].pos.y;
                    const d = Math.sqrt(dx * dx + dy * dy);
                    if (d < bestDist && d < 80) { bestDist = d; bestIdxB = idxB; }
                }
                if (bestIdxB === -1) continue;
                const pegA = this.pegs[idxA];
                const pegB = this.pegs[bestIdxB];
                const type = effectiveSlots[created % effectiveSlots.length];
                const slot = new SpecialSlot(pegA.pos.x, pegA.pos.y, pegB.pos.x, pegB.pos.y, type);
                slot.pegIndex = idxA;
                slot.pegIndex2 = bestIdxB;
                this.specialSlots.push(slot);
                used.add(idxA); used.add(bestIdxB);
                created++;
            }
        }

        // [初始 wind/sword 钉子] 仅第 1 回合且非继承时
        if (this.round === 1 && !shouldInherit) {
            const replaceWithSpecial = (count, type) => {
                if (!count || count <= 0) return;
                const normalPegs = this.pegs.filter(p => p.type === 'normal');
                for (let i = normalPegs.length - 1; i > 0; i--) {
                    const j = Math.floor(Math.random() * (i + 1));
                    [normalPegs[i], normalPegs[j]] = [normalPegs[j], normalPegs[i]];
                }
                for (let i = 0; i < Math.min(count, normalPegs.length); i++) {
                    normalPegs[i].type = type;
                    normalPegs[i].level = 1;
                }
            };
            const windPegsCount = this._isTutorialRun && this._tutorialInitWindPegs
                ? this._tutorialInitWindPegs : (cfg.initWindPegs || 0);
            const swordPegsCount = this._isTutorialRun && this._tutorialInitSwordPegs
                ? this._tutorialInitSwordPegs : (cfg.initSwordPegs || 0);
            replaceWithSpecial(windPegsCount, 'wind');
            replaceWithSpecial(swordPegsCount, 'flying_sword');
            if (this._isTutorialRun) {
                this.pegs.forEach(p => {
                    if (p.type === 'wind' || p.type === 'flying_sword') p.level = 3;
                });
            }
        }

        // ==================== [v2 符文融合] 应用 pendingFusions ====================
        // 将玩家在模块编辑器选择的符文随机注入到普通钉子上
        if (Array.isArray(this.pendingFusions) && this.pendingFusions.length > 0) {
            for (const f of this.pendingFusions) {
                if (!f || !f.element || !f.count) continue;
                const targets = selectFusionTargetPegs(this.pegs, f, canvasWidth, canvasHeight, false);
                for (const peg of targets) {
                    peg.type = f.element;
                    peg.level = Math.min(3, Math.max(peg.level || 1, f.sourceLevel || 1));
                    peg.infusedRuneId = f.runeId || null;
                    peg.fusionSourceLevel = f.sourceLevel || 1;
                    setModulePegState(this.currentModuleLayout[peg.moduleSlotIdx], peg, {
                        type: peg.type,
                        level: peg.level,
                        source: 'fusion',
                        infusedRuneId: peg.infusedRuneId,
                        fusionSourceLevel: peg.fusionSourceLevel,
                    });
                }
            }
            this.pendingFusions = [];
        }

        // [兼容] boardLayout='triangle' 仍然在底部生成两个倍率转盘
        this.ghostPegs = [];
        this.triangleSideWheels = [];
        if ((this.boardLayout || 'default') === 'triangle') {
            const wheelY = maxPegY + 40;
            const wheelXLeft = canvasWidth * 0.15;
            const wheelXRight = canvasWidth * 0.85;
            this.triangleSideWheels = [
                new TriangleSideWheel(wheelXLeft, wheelY, 'left', this),
                new TriangleSideWheel(wheelXRight, wheelY, 'right', this),
            ];
        }

        this.currentLayout = this.boardLayout || 'default';
        this._dropDistribution = null;
        this._heatmapData = null;
        this.ui_updateGatheringQueueUI();
        this.ui_renderRecipeHUD();
        console.log(`[Plinko v2] 模块化钉板初始化完成: ${this.pegs.length} 钉, ${this.specialSlots.length} 特殊槽, ${activeSlots.length}/${totalSlots} 槽位`);
    },

    // ==================== [兼容包装] ====================
    // 调用 v2 模块化实现；旧的 phase_gathering_initPachinko_legacy 保留作参考
    phase_gathering_initPachinko(shouldInherit = false) {
        return this.phase_gathering_initPachinko_v2(shouldInherit);
    },

    /**
     * [v2 重构] 在实时钉板画布上绘制「可编辑钉盘区域」虚框描边。
     * 每个已解锁的模块槽位用虚框标出；已装备组件的区域显示图标+名称，
     * 空区域显示「＋ 空槽」。点击命中只选中槽位，装备/卸下由库存栏按钮确认。
     * 仅在 this._moduleEditorActive 为真时由 phase_gathering_update 调用。
     */
    render_moduleEditorOverlay() {
        const rects = (typeof this._moduleEditor_getSlotRects === 'function')
            ? this._moduleEditor_getSlotRects() : [];
        if (!rects.length) return;
        const ctx = this.ctx;
        const t = Date.now();
        // 虚线流动 + 呼吸透明度
        const pulse = (Math.sin(t / 500) + 1) / 2; // 0~1
        ctx.save();
        ctx.lineWidth = 2;
        ctx.setLineDash([8, 6]);
        ctx.lineDashOffset = -(t / 60) % 14;
        ctx.font = '600 12px "Microsoft YaHei", sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        for (const { rect, moduleId } of rects) {
            const { x, y, w, h } = rect;
            const cx = x + w / 2;
            const cy = y + h / 2;
            const placed = !!moduleId;
            const accent = placed ? '#34d399' : '#67e8f9';

            // 区域淡色填充，提示可点击范围
            ctx.fillStyle = placed
                ? `rgba(52, 211, 153, ${0.06 + pulse * 0.05})`
                : `rgba(103, 232, 249, ${0.08 + pulse * 0.06})`;
            ctx.fillRect(x + 1, y + 1, w - 2, h - 2);

            // 虚框描边
            ctx.strokeStyle = accent;
            ctx.shadowBlur = _sb(6 + pulse * 4);
            ctx.shadowColor = accent;
            ctx.strokeRect(x + 1.5, y + 1.5, w - 3, h - 3);
            ctx.shadowBlur = 0;

            // 标签
            const def = placed ? MODULE_DEFS[moduleId] : null;
            if (def) {
                ctx.save();
                ctx.setLineDash([]);
                // @perf-impact: Module editor footprint outlines are flat strokes only; no particles, gradients, or extra shadowBlur.
                drawModuleFootprintOutline(ctx, rect, def.shape && def.shape.footprint, 'rgba(209, 250, 229, 0.72)', pulse);
                // 顶部名称底条
                ctx.fillStyle = 'rgba(2, 6, 23, 0.65)';
                const tagH = 16;
                ctx.fillRect(x + 1, y + 1, w - 2, tagH);
                ctx.fillStyle = '#d1fae5';
                ctx.font = '600 11px "Microsoft YaHei", sans-serif';
                ctx.fillText(`${def.icon || '▦'} ${def.name}`, cx, y + 1 + tagH / 2, w - 6);
                // 底部提示：点击只选中槽位，卸下由库存栏确认
                ctx.fillStyle = 'rgba(52, 211, 153, 0.85)';
                ctx.font = '600 10px "Microsoft YaHei", sans-serif';
                ctx.fillText('点击选择', cx, y + h - 9, w - 6);
                ctx.restore();
            } else {
                ctx.save();
                ctx.setLineDash([]);
                ctx.fillStyle = `rgba(103, 232, 249, ${0.7 + pulse * 0.3})`;
                ctx.font = '700 22px "Microsoft YaHei", sans-serif';
                ctx.fillText('＋', cx, cy - 6);
                ctx.fillStyle = 'rgba(148, 197, 220, 0.9)';
                ctx.font = '600 11px "Microsoft YaHei", sans-serif';
                ctx.fillText('空槽', cx, cy + 12, w - 6);
                ctx.restore();
            }
        }

        // @perf-impact: Module placement preview uses flat slot fills/strokes only; no particles, gradients, or shadowBlur.
        const placementPreview = this._moduleEditorPlacementPreview;
        if (placementPreview && Array.isArray(placementPreview.covered)) {
            const cfg = CONFIG.gameplay || {};
            const canvasWidth = (this.width && this.width > 0) ? this.width : 400;
            const canvasHeight = (this.height && this.height > 0) ? this.height : 600;
            const previewSlots = placementPreview.covered.length > 0
                ? placementPreview.covered
                : [placementPreview.slotIdx];
            const isTarget = placementPreview.mode === 'target';
            const ok = placementPreview.ok !== false;
            const stroke = isTarget ? '#67e8f9' : (ok ? '#22c55e' : '#fb7185');
            const fill = isTarget
                ? `rgba(103, 232, 249, ${0.10 + pulse * 0.05})`
                : (ok
                    ? `rgba(34, 197, 94, ${0.14 + pulse * 0.06})`
                    : `rgba(251, 113, 133, ${0.16 + pulse * 0.07})`);

            ctx.save();
            ctx.setLineDash(ok ? [] : [5, 4]);
            ctx.lineWidth = isTarget ? 2 : 3;
            ctx.strokeStyle = stroke;
            ctx.fillStyle = fill;
            for (const slotIdx of previewSlots) {
                if (!Number.isInteger(slotIdx) || slotIdx < 0) continue;
                const cell = calcModuleSlotRect(slotIdx, canvasWidth, canvasHeight, cfg, { cols: 1, rows: 1 });
                ctx.fillRect(cell.x + 3, cell.y + 3, cell.w - 6, cell.h - 6);
                ctx.strokeRect(cell.x + 3.5, cell.y + 3.5, cell.w - 7, cell.h - 7);
            }
            ctx.restore();
        }

        // @perf-impact: Rune fusion preview draws lightweight target rings only; no particles, gradients, or shadowBlur.
        const preview = this._moduleEditorRunePreview;
        if (preview) {
            const targets = selectFusionTargetPegs(this.pegs || [], {
                element: preview.element,
                count: preview.count,
                runeId: preview.runeId,
                sourceLevel: preview.level,
            }, this.width || 400, this.height || 600, false);
            if (targets.length > 0) {
                ctx.save();
                ctx.setLineDash([]);
                ctx.lineWidth = 2;
                ctx.strokeStyle = '#c4b5fd';
                ctx.fillStyle = `rgba(167, 139, 250, ${0.16 + pulse * 0.08})`;
                for (const peg of targets) {
                    const radius = Math.max((peg.radius || 4) + 5, 9);
                    ctx.beginPath();
                    ctx.arc(peg.pos.x, peg.pos.y, radius, 0, Math.PI * 2);
                    ctx.fill();
                    ctx.stroke();
                }
                ctx.restore();
            }
        }
        ctx.restore();
    },

    // [legacy] 旧的 10×5 平铺钉板生成器，保留作参考但不再被默认调用
    phase_gathering_initPachinko_legacy(shouldInherit = false) {
        // [修复] 使用动态行数
        const rows = this.currentRows || CONFIG.gameplay.rows;
        const baseCols = CONFIG.gameplay.cols || 10;
        const spacingX = CONFIG.gameplay.spacingX || 35;
        const spacingY = CONFIG.gameplay.spacingY || 32;
        // [钉盘形态遗物] 读取异型布局模式
        const boardLayout = this.boardLayout || 'default';
        
        // [修复] 修正 width 引用
        // 确保 this.width 在初始化时已正确设置，否则使用默认值 400
        const canvasWidth = (this.width && this.width > 0) ? this.width : 400; 
        const canvasHeight = (this.height && this.height > 0) ? this.height : 600;
        
        // [钉盘形态遗物] 使用 baseCols 计算水平居中偏移（布局基准宽度）
        const offsetX = (canvasWidth - (baseCols - 1) * spacingX) / 2;
        
        // [优化] 动态计算 offsetY，确保在矮屏幕下钉子不会被挤出屏幕
        // 预留顶部空间 (约占高度的 20%，但不超过 120px)
        const offsetY = Math.min(120, canvasHeight * 0.2);
        
        // [优化] 如果屏幕太矮，自动压缩垂直间距
        const adjustedSpacingY = (offsetY + rows * spacingY > canvasHeight - 50) 
            ? (canvasHeight - offsetY - 80) / rows 
            : spacingY;

        const previousPegs = [...this.pegs];
        this.pegs = [];
        this.specialSlots = [];
        let pegIndex = 0;
        let maxPegY = 0;

        for (let r = 0; r < rows; r++) {
            // ==================== [钉盘形态遗物] 异型布局逻辑 ====================
            // 根据 boardLayout 计算每行的列数和水平偏移
            let rowCols, rowOffsetX;
            const isOddRow = r % 2 !== 0;

            if (boardLayout === 'triangle') {
                // 三角形：顶行最宽，每行递减 1 列，最少保留 3 列
                const colsThisRow = Math.max(3, baseCols - r);
                rowCols = colsThisRow;
                // 水平居中：计算该行实际宽度，居中对齐
                const rowWidth = (colsThisRow - 1) * spacingX;
                rowOffsetX = (canvasWidth - rowWidth) / 2 - offsetX;
                // 保持标准交错偏移
                rowOffsetX += isOddRow ? spacingX / 2 : 0;

            } else if (boardLayout === 'diamond') {
                // 菱形：前半段每行 +1 列，后半段每行 -1 列
                const half = Math.floor(rows / 2);
                const colsDelta = r <= half ? r : (rows - 1 - r);
                const colsThisRow = Math.max(3, (baseCols - half) + colsDelta);
                rowCols = colsThisRow;
                const rowWidth = (colsThisRow - 1) * spacingX;
                rowOffsetX = (canvasWidth - rowWidth) / 2 - offsetX;
                rowOffsetX += isOddRow ? spacingX / 2 : 0;

            } else if (boardLayout === 'sparse') {
                // 稀疏间隔：偶数行正常列数，奇数行减 4 列居中
                // 设计意图：行与行之间不交错（奇数行纯居中），只有最后两行交错，
                // 以便弹珠顺利触发底部粉色陷阱效果并被底部反弹。
                const isLastTwoRows = (r >= rows - 2);
                if (!isOddRow) {
                    rowCols = baseCols;
                    rowOffsetX = 0; // 偶数行正常，不交错偏移
                } else {
                    const narrowCols = Math.max(3, baseCols - 4);
                    rowCols = narrowCols;
                    const rowWidth = (narrowCols - 1) * spacingX;
                    // 普通奇数行：纯居中，不加交错偏移（行间对齐，弹珠可直线穿越蓄力）
                    // 最后两行：加标准交错偏移，形成「底部粉色陷阱」必经区
                    const staggerOffset = isLastTwoRows ? spacingX / 2 : 0;
                    rowOffsetX = (canvasWidth - rowWidth) / 2 - offsetX + staggerOffset;
                }

            } else if (boardLayout === 'mirror_sync') {
                // 镜像同步：列数减 2，奇数行加标准交错偏移
                // [修复] 恢复奇偶行交错，防止弹珠直线穿透；镜像基于 x 坐标对称
                const syncCols = Math.max(3, baseCols - 2);
                rowCols = syncCols;
                const rowWidth = (syncCols - 1) * spacingX;
                // @section:pachinko_slot_setup - 底部槽位配置与属性分配
                rowOffsetX = (canvasWidth - rowWidth) / 2 - offsetX;
                rowOffsetX += isOddRow ? spacingX / 2 : 0; // 恢复标准交错

            } else if (boardLayout === 'wide_narrow') {
                // 宽窄交替：偶数行 +2 列，奇数行 -2 列
                // [修复] 奇数行加标准交错偏移，防止弹珠直线穿透
                if (!isOddRow) {
                    const wideCols = baseCols + 2;
                    rowCols = wideCols;
                    const rowWidth = (wideCols - 1) * spacingX;
                    rowOffsetX = (canvasWidth - rowWidth) / 2 - offsetX;
                } else {
                    const narrowCols = Math.max(3, baseCols - 2);
                    rowCols = narrowCols;
                    const rowWidth = (narrowCols - 1) * spacingX;
                    rowOffsetX = (canvasWidth - rowWidth) / 2 - offsetX + spacingX / 2;
                }

            } else {
                // default：标准交错矩形
                rowCols = isOddRow ? baseCols - 1 : baseCols;
                rowOffsetX = isOddRow ? spacingX / 2 : 0;
            }

            for (let c = 0; c < rowCols; c++) {
                const x = offsetX + rowOffsetX + c * spacingX;
                const y = offsetY + r * adjustedSpacingY;
                maxPegY = Math.max(maxPegY, y);

                let type = 'normal';
                let level = 1;

                // [继承逻辑]
                if (shouldInherit && previousPegs[pegIndex]) {
                    const prevPeg = previousPegs[pegIndex];
                    // 排除粉色钉子（假设它是临时Buff）
                    if (prevPeg.type !== 'pink') {
                        type = prevPeg.type;
                        level = prevPeg.level || 1;
                    } else {
                        type = this.phase_gathering_getRandomPegType();
                    }
                } else {
                    type = this.phase_gathering_getRandomPegType();
                }

                let p = new Peg(x, y, type);
                p.level = level;
                p.row = r;
                p.col = c;
                // [继承逻辑] 如果继承，保留当前的冷却状态
                if (shouldInherit && previousPegs[pegIndex]) {
                     p.cooldownTimer = previousPegs[pegIndex].cooldownTimer;
                }
                
                this.pegs.push(p);
                pegIndex++;
            }
        }

        // ==================== [布局位置标记] ====================
        // 在所有钉子创建完成后，根据布局类型标记功能性位置的 layoutRole
        // 供 Peg.draw 方法绘制专属视觉样式
        if (boardLayout !== 'default') {
            const totalRows = rows;
            const rowQ1 = Math.floor(totalRows * 0.25);
            const rowQ3 = Math.floor(totalRows * 0.75);

            for (const p of this.pegs) {
                const r = p.row;
                const c = p.col;

                if (boardLayout === 'diamond') {
                    // 中段（25%~75% 行）：触发「中段爆发」效果的区域
                    if (r >= rowQ1 && r <= rowQ3) {
                        p.layoutRole = 'diamond_mid';
                    }

                } else if (boardLayout === 'sparse') {
                    // 奇数行（窄行）：弹珠穿越此行未碰撞则蓄力
                    if (r % 2 !== 0) {
                        p.layoutRole = 'sparse_narrow';
                    }

                } else if (boardLayout === 'wide_narrow') {
                    // 偶数行（宽行）的边缘钉子（列号 0/1 或倒数 0/1）：触发「边缘共振」
                    if (r % 2 === 0) {
                        const rowPegs = this.pegs.filter(rp => rp.row === r);
                        const rowLen = rowPegs.length;
                        if (c <= 1 || c >= rowLen - 2) {
                            p.layoutRole = 'wide_edge';
                        }
                    }

                } else if (boardLayout === 'triangle') {
                    // 下半段（50%~100% 行）：漏斗收窄区，触发「漏斗共鸣」
                    if (r >= Math.floor(totalRows * 0.5)) {
                        p.layoutRole = 'triangle_funnel';
                    }

                // @section:pachinko_inherit_state - 继承上局状态（符文/弹珠/加成）
                } else if (boardLayout === 'mirror_sync') {
                    // 中轴附近钉子（列号 0 或最后一列）：镜像同步的对称轴标识
                    const rowPegs = this.pegs.filter(rp => rp.row === r);
                    const rowLen = rowPegs.length;
                    if (c === 0 || c === rowLen - 1) {
                        p.layoutRole = 'mirror_center';
                    }
                    // [镜像裂分] 中轴线特殊钉子：距离中心最近的钉子标记为 mirror_axis
                    // 每行只标记一颗最靠近中轴的钉子（奇数列数取中间列，偶数列数取中间偏左）
                    const midCol = Math.floor((rowLen - 1) / 2);
                    if (c === midCol) {
                        p.layoutRole = 'mirror_axis';
                    }
                }
            }
        }

        // [镜像同步] 预计算钉子的镜像索引
        // [修复] 交错后奇偶行的 x 坐标不再简单对称于列号，改为基于 x 坐标对称于画布中心
        if (boardLayout === 'mirror_sync') {
            const centerX = (this.width && this.width > 0) ? this.width / 2 : 200;
            for (let i = 0; i < this.pegs.length; i++) {
                const p = this.pegs[i];
                // 镜像 x = 2 * centerX - p.x，在同行中寻找 x 最近的钉子作为镜像
                const mirrorX = 2 * centerX - p.pos.x;
                const samRowPegs = this.pegs.filter((mp, mi) => mi !== i && mp.row === p.row);
                let bestMirror = null;
                let bestDist = Infinity;
                for (const mp of samRowPegs) {
                    const dist = Math.abs(mp.pos.x - mirrorX);
                    if (dist < bestDist) {
                        bestDist = dist;
                        bestMirror = mp;
                    }
                }
                // 容差：半个钉子间距内才认为是有效镜像
                if (bestMirror && bestDist < spacingX * 0.6 && bestMirror !== p) {
                    p.mirrorIdx = this.pegs.indexOf(bestMirror);
                }
            }
        }

        if (this.round === 1 && !shouldInherit) {
            const replaceWithSpecial = (count, type) => {
                if (!count || count <= 0) return;
                const normalPegs = this.pegs.filter(p => p.type === 'normal');
                for (let i = normalPegs.length - 1; i > 0; i--) {
                    const j = Math.floor(Math.random() * (i + 1));
                    [normalPegs[i], normalPegs[j]] = [normalPegs[j], normalPegs[i]];
                }
                for (let i = 0; i < Math.min(count, normalPegs.length); i++) {
                    normalPegs[i].type = type;
                    normalPegs[i].level = 1;
                }
            };
            // [爽游模式] 新手教程局使用专属字段的钉子数量，避免全局 CONFIG 被污染
            const windPegsCount = this._isTutorialRun && this._tutorialInitWindPegs
                ? this._tutorialInitWindPegs
                : CONFIG.gameplay.initWindPegs;
            const swordPegsCount = this._isTutorialRun && this._tutorialInitSwordPegs
                ? this._tutorialInitSwordPegs
                : CONFIG.gameplay.initSwordPegs;
            console.log('[PachinkoInit] wind:', windPegsCount, 'sword:', swordPegsCount);
            replaceWithSpecial(windPegsCount, 'wind');
            replaceWithSpecial(swordPegsCount, 'flying_sword');
            // [爽游模式] 新手教程局：将 wind/flying_sword 钉子等级提升到 3
            if (this._isTutorialRun) {
                this.pegs.forEach(p => {
                    if (p.type === 'wind' || p.type === 'flying_sword') {
                        p.level = 3;
                    }
                });
            }
        }

        this.boardBottomY = maxPegY;
        const pinkCount = this.pinkPegCount;
        for (let i = 0; i < pinkCount; i++) {
            if (this.pegs.length > 0) {
                const idx = Math.floor(Math.random() * this.pegs.length);
                this.pegs[idx].type = 'pink';
            }
        }

        // ==================== [sparse 布局专属] 最后两行强制交错粉色钉子 ====================
        // 设计意图：直道钉盘（sparse_interval）的最后两行永远有交错的粉色钉子，
        // 形成「底部粉色陷阱」，让弹珠在落底前必经一段高弹性区域，增加策略性。
        // 交错规则：倒数第2行（偶数列为粉色），倒数第1行（奇数列为粉色）
        if (boardLayout === 'sparse') {
            const lastRow = rows - 1;
            const secondLastRow = rows - 2;
            for (const p of this.pegs) {
                if (p.row === lastRow || p.row === secondLastRow) {
                    // 交错：最后一行奇数列粉色，倒数第二行偶数列粉色
                    const isLastRow = (p.row === lastRow);
                    const shouldBePink = isLastRow ? (p.col % 2 === 1) : (p.col % 2 === 0);
                    if (shouldBePink) {
                        p.type = 'pink';
                        p.level = 1;
                    }
                // @section:pachinko_special_pegs - 特殊钉子生成（布局角色分配）
                }
            }
        }

        // [技能系统迭代] 动态过滤 skill_point 槽：仅当玩家有已解锁技能时才生成技能点槽
        let effectiveSlots = [...this.unlockedSlots];
        if (!this.activeSkills || this.activeSkills.length === 0) {
            effectiveSlots = effectiveSlots.filter(t => t !== 'skill_point');
        }
        const effectiveSlotCount = Math.min(this.slotCount, effectiveSlots.length > 0 ? this.slotCount : 0);
        if (CONFIG.debug) console.log(`[DEBUG] Starting special slot creation: effectiveSlots=${JSON.stringify(effectiveSlots)}, slotCount=${effectiveSlotCount}`);
        if (effectiveSlots.length > 0 && effectiveSlotCount > 0) {
            const slotTypes = effectiveSlots;
            
            // [重构] 不再使用随机坐标匹配，而是直接从合法候选钉子池中抽取
            // 1. 筛选出所有合法的候选钉子索引 (非粉色且未被占用)
            // [双钉子连线模式 v2] 基于行列坐标的严格相邻匹配
            // 相邻定义：
            //   同行水平相邻：同一行，列号相差 1
            //   上下行断对角相邻：行号相差 1，列号相差 0 或 1（奇偶行偏移导致）

            // 1. 筛选候选钉子（非粉色）
            const validPegIndices2 = this.pegs
                .map((p, i) => i)
                .filter(i => this.pegs[i].type !== 'pink');

            // 2. 构建严格相邻对列表：只允许同行相邻或上下行断对角
            const strictPairs = [];
            const addedPairKeys = new Set();

            for (const idxA of validPegIndices2) {
                const pegA = this.pegs[idxA];
                if (pegA.row === undefined) continue;

                for (const idxB of validPegIndices2) {
                    if (idxB <= idxA) continue;
                    const pegB = this.pegs[idxB];
                    if (pegB.row === undefined) continue;

                    const dr = Math.abs(pegA.row - pegB.row);
                    const dc = Math.abs(pegA.col - pegB.col);

                    const isSameRowAdj = (dr === 0 && dc === 1);
                    const isDiagAdj   = (dr === 1 && dc <= 1);

                    if (isSameRowAdj || isDiagAdj) {
                        const key = `${idxA}-${idxB}`;
                        if (!addedPairKeys.has(key)) {
                            strictPairs.push([idxA, idxB]);
                            addedPairKeys.add(key);
                        }
                    }
                }
            }

            console.log(`[DEBUG] Found ${strictPairs.length} strict adjacent peg pairs`);

            // 3. 打乱对列表，随机选取所需数量的对
            for (let i = strictPairs.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [strictPairs[i], strictPairs[j]] = [strictPairs[j], strictPairs[i]];
            }

            let createdCount = 0;
            const usedPegs = new Set();

            for (const [idxA, idxB] of strictPairs) {
                if (createdCount >= effectiveSlotCount) break;
                if (usedPegs.has(idxA) || usedPegs.has(idxB)) continue;

                const pegA = this.pegs[idxA];
                const pegB = this.pegs[idxB];
                 // 按顺序分配类型：第 i 个槽使用 slotTypes[i]，确保类型确定性
                const type = slotTypes[createdCount % slotTypes.length];
                const slot = new SpecialSlot(pegA.pos.x, pegA.pos.y, pegB.pos.x, pegB.pos.y, type);
                slot.pegIndex  = idxA;
                slot.pegIndex2 = idxB;
                this.specialSlots.push(slot);
                createdCount++;
                usedPegs.add(idxA);
                usedPegs.add(idxB);

                // [镜像同步] 如果是镜像布局，尝试在镜像位置也生成一个
                if (boardLayout === 'mirror_sync') {
                    const mIdxA = pegA.mirrorIdx;
                    const mIdxB = pegB.mirrorIdx;
                    if (mIdxA !== -1 && mIdxB !== -1 && !usedPegs.has(mIdxA) && !usedPegs.has(mIdxB)) {
                        const mPegA = this.pegs[mIdxA];
                        const mPegB = this.pegs[mIdxB];
                        const mSlot = new SpecialSlot(mPegA.pos.x, mPegA.pos.y, mPegB.pos.x, mPegB.pos.y, type);
                        mSlot.pegIndex = mIdxA;
                        mSlot.pegIndex2 = mIdxB;
                        this.specialSlots.push(mSlot);
                        usedPegs.add(mIdxA);
                        usedPegs.add(mIdxB);
                        // 注意：镜像生成的槽位不计入 createdCount 限制，从而实现数量 x2
                    }
                }
            }

            // @section:pachinko_ui_init - 弹珠台 UI 初始化与事件绑定
            // 如果严格对不够，退化为单钉子水平短连线
            if (createdCount < effectiveSlotCount) {
                const usedIdx = new Set(this.specialSlots.flatMap(s => [s.pegIndex, s.pegIndex2]));
                const remaining = validPegIndices2.filter(i => !usedIdx.has(i));
                for (const idxA of remaining) {
                    if (createdCount >= effectiveSlotCount) break;
                    const pegA = this.pegs[idxA];
                    // 按顺序分配类型，与主逻辑保持一致
                    const type = slotTypes[createdCount % slotTypes.length];
                    const halfW = spacingX * 0.35;
                    const slot = new SpecialSlot(pegA.pos.x - halfW, pegA.pos.y, pegA.pos.x + halfW, pegA.pos.y, type);
                    slot.pegIndex  = idxA;
                    slot.pegIndex2 = idxA;
                    this.specialSlots.push(slot);
                    createdCount++;
                    console.log(`[DEBUG] Created fallback single-peg slot: type=${type}, pegIdx=${idxA}`);
                }
            }

            console.log(`[DEBUG] Finished special slot creation: final count=${this.specialSlots.length}, target=${effectiveSlotCount}`);
        } else {
            console.log(`[DEBUG] Skipping special slot creation: effectiveSlots.length=${effectiveSlots.length}, effectiveSlotCount=${effectiveSlotCount}`);
        }
        this.ui_updateGatheringQueueUI();
        this.ui_renderRecipeHUD();

        // [概率分析] 存储当前布局类型，并初始化落点分布缓存
        this.currentLayout = boardLayout;
        this._dropDistribution = null;  // 待首次发射时计算
        this._heatmapData = null;
        console.log(`[Plinko] 布局初始化完成: ${boardLayout}，物理参数:`, getLayoutParams(boardLayout).distributionHint);

        // ==================== [diamond 布局专属] 清空虚影钉子数组 ====================
        this.ghostPegs = [];

        // ==================== [triangle 布局专属] 底部左右倍率转盘初始化 ====================
        // 设计：三角钉盘底部左右各放一个倍率转盘，弹珠落入后触发属性翻倍
        // 转盘位置：底部最后一行的左侧和右侧，紧贴三角形底部边缘
        this.triangleSideWheels = [];
        if (boardLayout === 'triangle') {
            const wheelY = maxPegY + 40; // 转盘在最后一行钉子下方 40px
            const wheelXLeft  = canvasWidth * 0.15; // 左侧转盘：距左边缘 15%
            const wheelXRight = canvasWidth * 0.85; // 右侧转盘：距右边缘 15%
            this.triangleSideWheels = [
                new TriangleSideWheel(wheelXLeft,  wheelY, 'left',  this),
                new TriangleSideWheel(wheelXRight, wheelY, 'right', this),
            ];
            console.log(`[Triangle] 侧边倍率转盘已初始化: left=(${wheelXLeft.toFixed(0)}, ${wheelY.toFixed(0)}), right=(${wheelXRight.toFixed(0)}, ${wheelY.toFixed(0)})`);
        }
    },

phase_gathering_getRandomPegType() { 
    // [BUGFIX #1] 恢复完整 pegTypes 数组，根据玩家已解锁属性动态过滤
    // 原 Bug: pegTypes 被硬编码为 ['bounce']，导致所有元素属性钉子无法生成
    // 初始随机属性钉只保留纯净弹珠属性；wind 是变异属性，不参与初始化随机刷新。
    // [设计约束] laser 已从钉子类型中移除：激光属性仅能通过弹珠本身或符文提供，不能由钉子给予。
    // 参考先例：lightning 属性同样不拥有对应钉子（见 .cursor/rules/config.md 第5节）。
    const allPegTypes = ['bounce', 'damage'];
    const pegTypes = allPegTypes.filter(t => (this.unlockedWeights[t] || 0) > 0);
    // 1. 获取 normal 的基础权重
    // 我们手动从 unlockedWeights 中取 white 作为普通钉子的权重基准（默认 100）
    const normalWeight = this.unlockedWeights['white'] || 100; 

    // 2. 计算当前所有“已解锁”类型的总权重
    let totalWeight = normalWeight;
    pegTypes.forEach(t => {
        // 只有在 unlockedWeights 中权重 > 0 的才会被计入
        totalWeight += (this.unlockedWeights[t] || 0);
    });
    
    // 3. 生成 0 到 totalWeight 之间的随机数
    let r = Math.random() * totalWeight;
    
    // 4. 区间判定：首先判定是否落在 normal 区间
    if (r < normalWeight) return 'normal';
    r -= normalWeight;
    
    // 5. 依次判定落在哪个特殊属性区间
    for (const t of pegTypes) {
        const w = this.unlockedWeights[t] || 0;
        if (w > 0) {
            if (r < w) return t; // 落在当前属性的权重区间内
            r -= w;
        }
    }
    
    return 'normal'; // 兜底返回
},

/**
     * 开始战斗阶段
     */
    /**
     * @method startCombatPhase
     * @description 开始战斗阶段，初始化敌人和UI。
     */
    phase_startCombatPhase() { 
        this.isEnemyTurn = false;
        this.energyOrbs = [];
        this.sonSwordQueue = []; 
        this.sonSwordTimer = 0;
        this.phase_switchPhase('combat'); 
        // [BUGFIX #5a] 删除冗余的 this.phase = 'combat' 赋值
        // 原 Bug: phase_switchPhase 内部已赋值 this.phase = newPhase，此处重复赋值冗余
        // --- [核心修复 1]：修复属性访问错误 ---
        if (!this.ammoQueue) {
            this.ammoQueue = [];
        }

        // [feat] 每回合开始检查 ammoQueue：若为空则从 marbleQueue 重新编译充能。
        // 覆盖所有进入战斗的路径（无精华直接充能、有精华研磨后进入战斗均适用）。
        if (this.ammoQueue.length === 0 && this.marbleQueue && this.marbleQueue.length > 0) {
            this.ammoQueue = this.marbleQueue.map(marbleDef => {
                const collected = Array.isArray(marbleDef.collected) ? marbleDef.collected : [];
                const inheritedMulticast = Math.max(0, Math.floor(marbleDef.multicast || 0));
                const recipe = this.calc_compileCollectionToRecipe(marbleDef, collected, inheritedMulticast > 0);
                recipe.finalHits = 0;
                recipe.multicast = inheritedMulticast;
                return recipe;
            });
        }

        // [perfect-clear-upgrade] 上回合「围墙清空且仍有剩余弹药」蓄能升级保留下来的子弹，
        // prepend 回本回合 ammoQueue 首部，让升级首先生效。
        if (Array.isArray(this._carryOverAmmo) && this._carryOverAmmo.length > 0) {
            this.ammoQueue = [...this._carryOverAmmo, ...this.ammoQueue];
            this._carryOverAmmo = null;
        }
        // 子弹持有上限：基础 3 颗，对应三枚晶石核心充能位
        const _bulletCap = (CONFIG.gameplay.selectionReq || 3);
        if (this.ammoQueue.length > _bulletCap) {
            this.ammoQueue = this.ammoQueue.slice(0, _bulletCap);
        }
        // [perfect-clear-upgrade] 重置「本回合是否已触发蓄能升级」标志
        this._chargeUpgradeApplied = false;
        // [in-wall-clear-lottery] 重置「本回合是否已触发围墙清空抽奖」标志
        this._inWallClearTriggered = false;
        this._inWallClearLotteryActive = false;

        // [bullet-charge-fix] 拍摄本回合实际进入战斗的 ammoQueue 快照，作为下回合
        // 「子弹充能 / 精华触发时的充能子弹」的真实数据源。
        // 之前使用 marbleQueue 编译，导致玩家在子弹替换阶段保留了「上回合充能子弹」时，
        // 下回合反而以本回合 marbleQueue（即玩家「未选择/未发射」的新研磨子弹）作为充能源，
        // 出现「充能子弹混乱、不是上回合实际打出的子弹」的 BUG。
        if (Array.isArray(this.ammoQueue) && this.ammoQueue.length > 0) {
            this._lastFiredAmmoSnapshot = this.ammoQueue.map(r => ({ ...r }));
        }

        // [Feature 2: 围墙非空兜底] 进入战斗时若围墙内（pos.y > 0）确实没有任何活跃敌人，
        // 且不存在待入场 Boss / 画面外刚生成敌人，强制补一行 IN-WALL 敌人，避免空场打子弹。
        // finalizeRound 已尽量在清屏后预留一行 IN-WALL，本兜底用于其它异常路径。
        if (this.phase !== 'training' && Array.isArray(this.enemies)) {
            const hasInWallEnemy = this.enemies.some(e =>
                e.active && (
                    e.pos.y > 0 ||
                    (e.type === 'boss' && (e.entranceTimer > 0 || e._pendingEntrance)) ||
                    e._spawnedThisTurn
                )
            );
            if (!hasInWallEnemy && typeof this.spawn_spawnEnemyRowAt === 'function') {
                this.spawn_spawnEnemyRowAt(this.combatGridTopY);
            }
        }

        // [tsk-bullet-ui] 兜底保护：若 ammoQueue 与 marbleQueue 同时为空（例如玩家在
        // 纯净精华命运时刻点击「跳过研磨」获取符文，且上回合无 _chargedAmmoQueue），
        // 此时直接进入战斗会导致「彈藥耗盡」横幅一直显示且敌人回合无法推进。
        // 此处强制回退到研磨阶段，重新生成弹珠选择，避免无限敌人回合死循环。
        if (this.ammoQueue.length === 0 && (!this.marbleQueue || this.marbleQueue.length === 0)) {
            console.warn('[phase_startCombatPhase] ammoQueue 与 marbleQueue 均为空，回退到研磨阶段防止死循环');
            // 重置可能残留的命运时刻状态，确保进入标准研磨流程
            this.selectionMode = 'standard';
            this.fateMomentContext = null;
            this.pendingSelectionMode = null;
            this.replaceAmmoContext = null;
            this._chargedAmmoQueue = null;
            // 进入标准选择阶段（非命运时刻），让玩家选择弹珠后再进研磨
            if (typeof this.sys_initSelectionPhase === 'function') {
                this.sys_initSelectionPhase();
            } else {
                this.phase_switchPhase('selection');
            }
            return;
        }

        // --- [核心修复 2]：UI 渲染 ---
        // 修复后，上面的代码不再报错，这一行将被正确执行，HUD 会在进入战斗时立即出现
        this.ui_updateUI();
        this.ui_renderRecipeHUD(); 

        this.sys_resetMultiplier(); 
        this.burstQueue = []; 
        this.pendingShots = [];
        // [照射词条] 每回合开始时重置持续照射状态
        this._continuousLaserFiring = false;
        this._continuousLaserState = null;
        // [修复] 每回合开始时清除激光相关的视觉效果锁和淡出计时器，
        // 防止上一回合的 setTimeout/帧计数残留导致本回合 isVisualEffectActive 永远为 true
        this.isVisualEffectActive = false;
        this._laserFadeOutFrames = 0;
        // [修复-照射残留] 兜底清理：将所有处于 isContinuous 模式（decay=0）的残留激光强制淡出，
        // 防止任何路径下未追踪到 activeBeams 的连续激光在新回合永久滞留屏幕。
        if (this.particles && this.particles.length > 0) {
            for (const p of this.particles) {
                if (p instanceof LaserBeam && p.isContinuous && typeof p.startFadeOut === 'function') {
                    p.startFadeOut();
                }
            }
        }
        
        // [剑刃风暴] 重置回合首发子弹标记与更新定时器
        this._roundFirstShotId = null;
        this._bladeStormProjectile = null;
        this._bladeStormTimer = 0;
        
        // 初始化当前回合伤害记录
        this.shotDamageHistory = [];
        this.currentViewingRound = 0; 
        
        // [符文系统] 记录本回合开始时的敌人数量，用于动态掉落率计算
        this.spawnedEnemiesInRound = this.enemies.filter(e => e.active).length;

        // [词条 Hook] 每回合开始时重置敌人的回合状态标记
        // 包括元素聚变的火/冰/雷状态标记，以及绝对零度的命中计数器
        this.enemies.forEach(e => {
            e._pyroHitThisRound = false;
            e._cryoHitThisRound = false;
            e._lightningHitThisRound = false;
            e._absoluteZeroHitCount = 0;
            // [技能系统迭代] 重置技能相关状态标记
            e._forceFusionThisRound = false; // 棱光炮强制聚变标记
            if (e._frostPrisonAmp) e._frostPrisonAmp = 0; // 冰牢封印伤害加成每回合清除
        });
        
        // [充能符文系统] 初始化充能状态
        this.combat_runeCharge_init();
        
        if (this.ui) {
            this.ui.updateSkillPoints(this.skillPoints);
            this.ui.updateSkillBar(this.skillPoints, this.activeSkills);
        }

        // [演出时机修复] 在进入战斗阶段时，检测是否有待播放入场演出的 Boss。
        // 原来的 boss:spawned 事件和入场动画在 spawn_spawnBoss() 中立即触发，
        // 导致在研磨阶段就播放完毕而战斗时完全看不到演出。
        // 现在统一延迟到此处触发，确保玩家进入战斗阶段时能看到完整的 Boss 出场演出。
        const pendingBoss = this.enemies.find(e => e.active && e.type === 'boss' && e._pendingEntrance);
        if (pendingBoss) {
            pendingBoss._pendingEntrance = false;
            // 激活入场动画计时器
            pendingBoss.entranceTimer = 90;
            // 延迟一帧再触发事件，确保战斗阶段已完全切换后再播放全屏演出
            setTimeout(() => {
                eventBus.emit('boss:spawned', {
                    boss: pendingBoss,
                    bossId: pendingBoss.bossType,
                    bossName: pendingBoss.bossName,
                    isBigBoss: pendingBoss.isBigBoss,
                    round: this.round
                });
                showToast(`☠️ ${pendingBoss.bossName} 出现！`);
            }, 100);
        }
    },

    phase_gathering_createSession(marbleDef, marbleIndex) {
        const inheritedCollected = Array.isArray(marbleDef.collected)
            ? marbleDef.collected.map(item => (typeof item === 'string' ? item : { ...item }))
            : [];
        const runeSlotCollected = typeof marbleDef.getRuneSlotCollected === 'function'
            ? marbleDef.getRuneSlotCollected()
            : (Array.isArray(marbleDef.runeSlots)
                ? marbleDef.runeSlots
                    .filter(slot => slot && slot.element)
                    .map(slot => ({
                        type: slot.element,
                        level: Math.max(1, Math.floor(slot.statAmount || slot.level || 1)),
                        source: 'rune_slot',
                        runeId: slot.runeId,
                    }))
                : []);
        const session = {
            game: this,
            marbleIndex,
            marbleDef,
            collected: [...inheritedCollected, ...runeSlotCollected],
            multicast: Math.max(0, Math.floor(marbleDef.multicast || 0)),
            activeBalls: 1,
            currentHits: 0,
            nextTriggerThreshold: this.persistentThreshold,
            totalHits: 0,
            multicastAdded: [],
            isFinished: false,
        };
        if (marbleDef.type === 'laser') {
            session.collected.push('laser');
        } else if (marbleDef.type === 'colored' && marbleDef.type) {
            session.collected.push(marbleDef.type);
        }
        return session;
    },

    phase_gathering_launchMarbleBatch(pos) {
        const queue = Array.isArray(this.marbleQueue) ? this.marbleQueue.slice(0, CONFIG.gameplay.selectionReq || 3) : [];
        if (queue.length === 0) return false;
        this.gatheringSessions = [];
        this.currentSession = null;
        this.activeMarbleIndex = 0;
        this.combat_updateHitProgress(0, this.persistentThreshold);
        this.combat_updateMulticastDisplay(0);

        const spread = Math.min(30, Math.max(16, this.width / 18));
        const centerOffset = (queue.length - 1) / 2;
        queue.forEach((marbleDef, marbleIndex) => {
            const session = this.phase_gathering_createSession(marbleDef, marbleIndex);
            const offsetX = (marbleIndex - centerOffset) * spread;
            const spawnX = Math.max(20, Math.min(this.width - 20, pos.x + offsetX));
            const newBall = new DropBall(spawnX, 30 - marbleIndex * 6, marbleDef, session);
            newBall.vel.x += offsetX * 0.018;
            newBall.layoutParams = getLayoutParams(this.currentLayout || 'default');
            this.gatheringSessions.push(session);
            this.dropBalls.push(newBall);
            this._updateDropDistribution(spawnX);
        });
        this.currentSession = this.gatheringSessions[0] || null;
        this.ui_updateGatheringQueueUI();
        audio.playShoot();
        return true;
    },

/**
     * @method handleInputStart
     * @description 处理输入开始 (鼠标按下/触摸开始) - [修改版：直射模式]
     */
    phase_handleInputStart(pos) {
        audio.resume();
        const offset = this.input_getTiltOffset();
        const logicPos = pos.sub(offset); 
        
        this.lastMousePos = logicPos;

        // 处理 gameOver 状态的点击（gameover 阶段由其自身 UI 按鈕处理，此处直接忽略）
        if (this.gameOver) {
            return;
        }

        if (this.phase === 'combat') {
             const hitEnemy = this.input_checkEnemyHover(pos);
             if (hitEnemy) return; 
             if (this.ui.isOpen) {
                 this.ui.closeDrawer();
                 return;
             }
             if (!this.isEnemyTurn && this.ammoQueue.length > 0 && this.projectiles.length === 0 && this.burstQueue.length === 0) {
                this.isDragging = true;
                // [emitter-port] 发射口位于发射器素材上沿，偏移量统一来自 EMITTER_PORT_OFFSET_Y。
                this.dragStart = new Vec2(this.width / 2, this.height - 80 - EMITTER_PORT_OFFSET_Y);
                this.dragCurrent = logicPos;
                this.ui.closeDrawer();
            }
        }
        else if (this.phase === 'gathering') {
            if (this.isWheelSpinning) {
                showToast("請等待輪盤結算...");
                return;
            }
            if (this.dropBalls.length > 0 || this.energyOrbs.length > 0) {
                // showToast("充能中..."); // 移除正常情况下的提示
                return;
            }
            
            // ---  判断点击区域 ---
            // [BUGFIX] 将阈值从 0.4 提升至 0.85，使玩家点击钉盘绝大部分区域都能触发发射。
            // 原阈值 0.4 仅覆盖屏幕上方 40%，导致点击钉盘中下部区域时被错误路由到倾斜模式。
            // 底部手柄区域（height - 40 ± 40px）已在 input_handleInputStart 中提前拦截，无需在此重复判断。
            if (pos.y < this.height * 0.85) {
                // 上方区域：一次充能最多发射 3 颗弹珠，分别独立收集并在结束时生成子弹列表。
                this.phase_gathering_launchMarbleBatch(pos);
            } else {
                // ---  下方区域：进入“抓取倾斜”模式，暂不报错 ---
                this.isTiltingGrip = true;
                this.gripStartPos = pos;
                // 这里不显示 toast，等到松开时如果没动才显示
            }
        } 
    },

//  处理单个敌人的回合逻辑 (当波扫到它时调用)
    /**
     * @param {any} e - TODO: Describe this parameter.
     */
    phase_enemy_processTurn(e) {
        if (!e.active || e.hasActedThisTurn) return;

        e.hasActedThisTurn = true;

        // --- [新属性] 毒素 DoT 结算 ---
        // 公式：dmg = venomStacks × dotPerStack × dotMultiplier(共鸣)
        // 冻结（temp <= -80）时跳过本回合，但层数保留；解冻当回合一次性结算（按当前层数 ×1）。
        // 过热（temp >= 100）时每回合结算 2 次。
        // ignoreShield=true 共鸣下：对 shield 敌人 DoT 双倍（毒素本身 bypass 护盾减伤）。
        if ((e.venomStacks || 0) > 0) {
            const venomCfg = (CONFIG.mechanics && CONFIG.mechanics.venom) || {};
            const dotPerStack = venomCfg.dotPerStack || 0.8;
            const venomRes = this.activeElementResonances && this.activeElementResonances['venom'];
            const venomResParams = venomRes ? venomRes.params : null;
            const dotMultiplier = venomResParams ? (venomResParams.dotMultiplier || 1.0) : 1.0;
            const ignoreShield = venomResParams ? (venomResParams.ignoreShield || false) : false;

            const isFrozen = (e.temp <= -80);
            // 解冻当回合一次性结算：上回合冻结但本回合未冻 -> _venomFrozenAccum
            // 这里以 e._wasFrozenLastTurn 简易检测：若本帧冻结，标记 true，次回合解除时一次性结算。
            if (isFrozen) {
                // 冻结当回合不发作，仅标记
                e._wasFrozenLastTurn = true;
            } else {
                let ticks = 1;
                if (e.temp >= 100) ticks = 2;
                let oneShotMult = 1;
                if (e._wasFrozenLastTurn) {
                    // 解冻当回合一次性结算（按当前 stacks ×1）
                    oneShotMult = 1; // 维持公式一致：×当前 stacks 一次
                    e._wasFrozenLastTurn = false;
                }
                // 三角阈值：每累计 1, 2, 3, 4… 层才 +1 点伤害
                // stacks=1→1dmg, stacks=3→2dmg, stacks=6→3dmg, stacks=10→4dmg ...
                const venomTier = Math.floor((-1 + Math.sqrt(1 + 8 * e.venomStacks)) / 2);
                let dotDmg = (venomTier * dotPerStack * dotMultiplier) * ticks * oneShotMult;
                // 对 shield 敌人 DoT 双倍（共鸣 Tier3）
                if (ignoreShield && e.affixes && e.affixes.includes('shield')) {
                    dotDmg *= 2;
                }
                if (dotDmg > 0) {
                    const dmg = Math.max(1, Math.ceil(dotDmg));
                    // bypassShield=true 让毒素 DoT 不受护盾减伤
                    const r = e.takeDamage(dmg, null, true);
                    if (r && this.combat_recordDamage) this.combat_recordDamage(r.actualDamage, 'pyro', 'main');
                    if (this.spawn_createFloatingText) this.spawn_createFloatingText(e.pos.x, e.pos.y - 30, `☠️${dmg}`, '#84cc16');
                    if (this.spawn_createParticle) {
                        for (let i = 0; i < 3; i++) this.spawn_createParticle(e.pos.x, e.pos.y, '#84cc16', 'mist');
                    }
                }
            }
        }

        
        //  只要觸發了結算，強迫掃描波在接下來的 45 幀內保持慢速
        // 這樣即使敵人被燒死消失了，波浪也會慢慢掃過屍體位置，展現"擊殺確認"的感覺
        this.waveMomentumTimer = 45; 

        // --- 1. 温度结算逻辑 ---
        // 封装单次温度结算逻辑为函数，便于 berserk 重复执行
        // --- [属性共鸣] 冰霜共鸣：读取 freezeTempThreshold，动态调整冰冻触发门槛 ---
        const _cryoRes = this.activeElementResonances && this.activeElementResonances['cryo'];
        const _cryoResParams = _cryoRes ? _cryoRes.params : null;
        // 一阶: -60, 二阶: -40, 三阶: -20（默认: -100 必冻 / -50~-100 概率冻）
        const _freezeHardThreshold = _cryoResParams ? (_cryoResParams.freezeTempThreshold || -100) : -100;
        const _freezeSoftThreshold = _freezeHardThreshold + 50; // 概率触发起始点（比必冻阈值高50度）
        const _processTempOnce = () => {
            if (e.temp < 0) {
                let shouldFreeze = false;
                if (e.temp <= _freezeHardThreshold) {
                    shouldFreeze = true;
                } else if (e.temp <= _freezeSoftThreshold) {
                    const chance = (Math.abs(e.temp) - Math.abs(_freezeSoftThreshold)) / 50;
                    if (Math.random() < chance) shouldFreeze = true;
                }
                if (shouldFreeze && !(e.affixes && e.affixes.includes('siege'))) {
                    e.isFrozenCurrentTurn = true;
                    e.frozenCount = (e.frozenCount || 0) + 1;
                    this.spawn_createExplosion(e.pos.x, e.pos.y, '#06b6d4');
                    audio.playEffect('freeze');
                } else {
                    e.isFrozenCurrentTurn = false;
                    if (shouldFreeze && e.affixes && e.affixes.includes('siege')) {
                        this.spawn_createFloatingText(e.pos.x, e.pos.y - 35, 'FREEZE IMMUNE', '#facc15');
                    }
                }
                e.temp = Math.ceil(e.temp / 2);
            }
            if (e.temp > 0 && e.active) {
                if (e.temp < 100) {
                    e.temp = Math.max(0, e.temp - 5);
                } else {
                    const dot = 5 + (e.temp - 100);
                    e.takeDamage(dot);
                    this.combat_recordDamage(dot, 'pyro', 'main');
                    e.playBurnTickEffect(this, Math.floor(dot));
                    const decay = Math.floor(e.temp / 20);
                    e.temp = Math.max(0, e.temp - decay);
                }
            }
        };

        // [改动] berserk 词条：先执行两次温度结算，再 +20℃
        _processTempOnce();
        if (e.affixes && e.affixes.includes('berserk')) {
            _processTempOnce();
            e.temp += 20;
            this.spawn_createFloatingText(e.pos.x, e.pos.y - 30, '+20℃', '#f97316');
        }

        // --- 2. Ignis 狂暴阶段：温度急升 + 火焰溅射 ---
        if (e.active && e.type === 'boss' && e.bossType === 'ignis' && e._berserkedTempRise) {
            // 每回合温度上升
            e.temp += e._berserkedTempRise;
            this.spawn_createFloatingText(e.pos.x, e.pos.y - 30, `+${e._berserkedTempRise}℃`, '#f97316');

            // 火焰溅射：对周围半径内的其他活跃敌人造成火焰伤害
            if (e._berserkedFireSplash) {
                const { radius, damage } = e._berserkedFireSplash;
                // 橙红色火焰粒子视觉反馈（在 Ignis 周围生成）
                for (let i = 0; i < 12; i++) {
                    const angle = (i / 12) * Math.PI * 2;
                    const px = e.pos.x + Math.cos(angle) * (radius * 0.5);
                    const py = e.pos.y + Math.sin(angle) * (radius * 0.5);
                    this.spawn_createParticle(px, py, '#ff4500', 'ember');
                }
                for (let i = 0; i < 8; i++) {
                    this.spawn_createParticle(e.pos.x, e.pos.y, '#ff6b00', 'spark');
                }

                // 对周围敌人造成火焰溅射伤害
                const activeEnemies = this.enemies.filter(other =>
                    other.active && other !== e
                );
                activeEnemies.forEach(other => {
                    const dx = other.pos.x - e.pos.x;
                    const dy = other.pos.y - e.pos.y;
                    const dist = Math.sqrt(dx * dx + dy * dy);
                    if (dist <= radius) {
                        other.takeDamage(damage);
                        this.combat_recordDamage(damage, 'pyro', 'main');
                        // 被溅射敌人的火焰粒子特效
                        for (let i = 0; i < 4; i++) {
                            this.spawn_createParticle(other.pos.x, other.pos.y, '#ff4500', 'spark');
                        }
                        this.spawn_createFloatingText(other.pos.x, other.pos.y - 20, `🔥-${damage}`, '#f97316');
                    }
                });
            }
        }

        // --- 3. 行动逻辑 ---
        // 只有活着的敌人才移动
        if (e.active && e.isFrozenCurrentTurn == false) {
            // 奥罗波罗斯 Boss：回合开始时进行词缀轮转
            if (e.type === 'boss' && e.bossType === 'ouroboros' && typeof e._performOuroborosRotation === 'function') {
                e._performOuroborosRotation(this);
            }
            e.startTurnAction(this);
        }
    },

/**
     * @method phase_claimPendingRunes
     * @description 敌人动作后领取待入库符文：
     *   1. 充能符文（combo充能奖励）
     *   2. 场地掉落符文（回合结算自动拾取）
     * 对每个符文触发飞入背包动画，让玩家知道获得了这些符文。
     * 应在 phase_finalizeRound 之前调用（敌人动作后）。
     */
    phase_claimPendingRunes() {
        // 收集所有待领取符文（充能符文 + 掉落符文）
        const pendingRunes = [];

        // 1. 充能符文：如果充能有奖励，先入库再加入动画队列
        const chargeDef = this.runeChargeCurrentRune;
        if (chargeDef) {
            const chargeLevel = this.runeChargeCurrentLevel || 1;
            this.runeInventory.push({ id: chargeDef.id, level: chargeLevel });
            pendingRunes.push({ runeDef: chargeDef, level: chargeLevel, source: 'charge' });
            // 重置充能状态（不再在 combat_runeCharge_claimReward 中重复入库）
            this.runeChargeValue        = 0;
            this.runeChargeLevel        = 0;
            this.runeChargeCurrentRune  = null;
            this.runeChargeCurrentLevel = 1;
            // 音效
            try { if (audio?.playPowerup) audio.playPowerup(); } catch(e) {}
        }

        // 2. 掉落符文：将场地掉落符文入库，加入动画队列
        if (this.runeLootItems && this.runeLootItems.length > 0) {
            this.runeLootItems.forEach(loot => {
                if (!loot.active) return;
                const runeDef = RUNE_DB.find(r => r.id === loot.runeId);
                if (!runeDef) { loot.active = false; return; }
                const level = loot.level || 1;
                this.runeInventory.push({ id: loot.runeId, level });
                pendingRunes.push({ runeDef, level, source: 'loot', x: loot.x, y: loot.y });
                loot.active = false;
            });
            this.runeLootItems = [];
        }

        // 3. 如果有待领取符文，触发飞入背包动画事件
        if (pendingRunes.length > 0) {
            eventBus.emit(EVENT_TYPES.UI_RUNE_CLAIM_AFTER_ENEMY, { runes: pendingRunes });
            // 4. 延迟检测是否可以组成词条，如可以则展示气泡提示
            //    延迟 800ms 以等待符文飞入动画播放完毕
            setTimeout(() => {
                if (this._ui_checkRunewordBubble) {
                    // 重置气泡关闭标记（新符文入库应重新提示）
                    this._runewordBubbleDismissed = false;
                    this._ui_checkRunewordBubble();
                }
            }, 800);
        }
    },

/**
     * @method phase_inWallClearTrigger
     * @description [in-wall-clear-lottery] 当围墙内（pos.y > 0）的敌人全部死亡时触发：
     *   1. 清空场上所有子弹（projectiles / sonSwords / burstQueue 等）。
     *   2. 拍摄当前 ammoQueue 快照作为老虎机抽奖输入，剩余子弹数量作为额外加成。
     *   3. 弹出「与跳过混沌精华一致」的子弹老虎机，按 (base + 剩余子弹数) 提升属性。
     *   4. 抽奖期间设置 `_inWallClearLotteryActive` 暂停标志，阻止 `phase_enemy_startLogic` 自动启动。
     *   5. 抽奖结束后立刻刷出至少 3 排画面外精英援军（强制 jump+haste 词条），随后解除暂停。
     * 整个流程每回合最多触发一次，由 `_inWallClearTriggered` 守卫。
     */
    phase_inWallClearTrigger() {
        if (this._inWallClearTriggered) return;
        if (this.gameOver) return;
        if (this.phase !== 'combat') return;
        // 已经处于敌人回合（例如手动调试触发），不再覆盖流程
        if (this.isEnemyTurn) return;
        this._inWallClearTriggered = true;
        // 与 perfect-clear-upgrade 互斥：避免后者在同一帧再次升级 ammoQueue
        this._chargeUpgradeApplied = true;

        const remaining = Array.isArray(this.ammoQueue) ? this.ammoQueue.length : 0;
        // 抽奖输入：优先使用当前剩余 ammoQueue；若为空（极少数发完才清场），退化到上一回合实际发射的快照
        let snapshot = (Array.isArray(this.ammoQueue) && this.ammoQueue.length > 0)
            ? this.ammoQueue.map(r => ({ ...r }))
            : (Array.isArray(this._lastFiredAmmoSnapshot) ? this._lastFiredAmmoSnapshot.map(r => ({ ...r })) : []);

        // 1. 清空场上所有飞行子弹（projectiles / sonSwords / burstQueue 等）
        if (typeof this.data_clearProjectiles === 'function') {
            this.data_clearProjectiles();
        }
        // 2. 清空 ammoQueue：让 playerTurnFinished 自然成立，但抽奖标志会阻断敌人回合启动
        this.ammoQueue = [];
        if (typeof this.ui_updateAmmoUI === 'function') this.ui_updateAmmoUI();
        if (typeof this.ui_renderRecipeHUD === 'function') this.ui_renderRecipeHUD();

        // 3. 标记抽奖暂停，开始老虎机
        this._inWallClearLotteryActive = true;
        showToast(`🎰 围墙清空！剩余 ${remaining} 发弹药 → 抽奖加成 +${remaining}`);

        const finishLottery = () => {
            // 4. 抽奖结束 → 刷新至少 3 排带 jump+haste 的精英援军
            if (typeof this.spawn_spawnEliteJumperRows === 'function') {
                this.spawn_spawnEliteJumperRows(3);
                showToast("⚡ 精英援军入场：跳跃 + 极速！");
                if (audio && typeof audio.playPowerup === 'function') audio.playPowerup();
            }
            // 5. 解除暂停，下一帧 phase_combat_update 会自动进入敌人回合
            this._inWallClearLotteryActive = false;
        };

        if (typeof this.sys_runInWallClearLottery === 'function' && snapshot.length > 0) {
            this.sys_runInWallClearLottery(snapshot, remaining, finishLottery);
        } else {
            // 无可抽奖子弹：跳过抽奖动画，直接刷援军并解除暂停
            finishLottery();
        }
    },

/**
     * @method startEnemyTurnLogic
     * @description 启动敌人回合：锁定状态、显示UI提示、并计算所有敌人的移动与技能
     */
    phase_enemy_startLogic() {
        this.isEnemyTurn = true;
        this.enemyTurnTimer = 0;

        // 初始化扫描波
        this.enemyWaveActive = true;
        this.enemyWaveY = this.height + 50; // 从屏幕最下方开始
        this.waveSpeed = 8 * this.timeScale; // 根据倍速调整扫描速度
        // 重置所有敌人的行动标记
        this.enemies.forEach(e => {
            e.hasActedThisTurn = false;
            e.isFrozenCurrentTurn = false; // 重置上一轮的冰冻状态
            // [照射词条] 回合结束时清零照射叠加层数，防止残留到下一回合
            if (e._irradiationStacks) e._irradiationStacks = 0;

            // [V2 echoRelay] 重置回合内的 echo 触发标记
            e._echoedThisTurn = false;

            // [V2 deflectionWard] 偏折屏障：若上一回合未被击破，则本回合开始恢复至满屏障值
            if (e.affixes && e.affixes.includes('deflectionWard')) {
                if (e.wardBarrierMax === undefined) {
                    const pct = (CONFIG.balance.affixes && CONFIG.balance.affixes.deflectionWardBarrierPct) || 0.10;
                    e.wardBarrierMax = Math.max(1, Math.floor(e.maxHp * pct));
                }
                if (!e.wardBrokenThisTurn) {
                    e.wardBarrier = e.wardBarrierMax;
                }
                e.wardBrokenThisTurn = false;
            }

            // [Boss 移动提示预计算]
            // 在回合开始时预计算 Boss 本回合是否会移动，以便 UI 标签能在回合开始时就显示正确提示
            if (e.type === 'boss' && e.bossType && typeof e._moveCooldown !== 'undefined') {
                if (e.berserked) {
                    e._willMoveThisTurn = true;
                } else {
                    e._willMoveThisTurn = (e._moveCooldown === 0);
                }
            }
        });

        // UI 提示
        const msgEl = document.getElementById('combat-message');
        if (msgEl) {
            msgEl.innerHTML = '<span class="text-yellow-400 font-bold text-xl drop-shadow-md">⚠️ ENEMY TURN</span>';
            msgEl.classList.remove('opacity-0');
            msgEl.classList.add('pop-anim'); 
        }
    },

/**
     * @method finalizeRound
     * @description [修改版] 回合结算，包含劣势补偿机制(自动极速)
     */
    phase_finalizeRound() {
        // 1. 统计当前存活敌人数据
        const activeEnemies = this.enemies.filter(e => e.active);
        // [清屏检测] 仅统计围墙内 (pos.y > 0) 且能被子弹击中的敌人。
        // 顶部两排（row 0 & row 1）位于顶部墙的死角内，子弹无法触及，因此不参与清场判定。
        const clearedThisRound = !activeEnemies.some(e => e.pos.y > 0 && this.phase_isEnemyClearable(e));
        // 使用 Set 统计有多少个不同的 Y 坐标（即有多少行）
        // Math.round 处理浮点误差，/50 是行高，确保归类准确
        const uniqueRows = new Set(activeEnemies.map(e => Math.round(e.pos.y / this.enemyHeight)));
        
        // 2. 触发条件判定：行数 <= 1 或 总数 <= 5
        if (uniqueRows.size <= 1 || activeEnemies.length <= 5) {
            let buffCount = 0;
            activeEnemies.forEach(e => {
                if (!e.affixes.includes('haste')) {
                    e.affixes.push('haste');
                    buffCount++;
                    // [视觉] 获得Buff的特效
                    this.spawn_createParticle(e.pos.x, e.pos.y, '#facc15', 'spark');
                }
            });
            
            if (buffCount > 0) {
                showToast("⚠️ 敵軍狂暴 (HASTE APPLIED) ⚠️");
                audio.playPowerup(); // 播放警示音
            }
        }

        // 3. [补充行] 结算时存活敌人 ≤5，额外多生成一行，并给原空列的新敌人赋予极速词条
        // 注意：此处仅在非 Boss 回合且存活敌人 ≤5 时触发（清屏时 activeEnemies.length === 0，不触发）
        // [issue-2] 改为画面外入场：调用 spawn_spawnEnemyRowOffScreen，新敌人从画面外滑入"队列"位置
        if (activeEnemies.length > 0 && activeEnemies.length <= 5) {
            const totalCols = CONFIG.gameplay.enemyCols;
            // 记录生成前已有敌人的列（用于对比找出原空列）
            const colsWithEnemiesBefore = new Set(
                activeEnemies.map(e => e._spawnColIndex).filter(c => c !== undefined)
            );
            // 额外生成一行（画面外入场，下回合敌人行动阶段移动进入网格顶部）
            this.spawn_spawnEnemyRowOffScreen(1);
            // 找出原本没有敌人的列（生成前的空列）
            const emptyCols = [];
            for (let c = 0; c < totalCols; c++) {
                if (!colsWithEnemiesBefore.has(c)) {
                    emptyCols.push(c);
                }
            }
            // 给新生成的、位于原空列的敌人赋予极速词条
            if (emptyCols.length > 0) {
                const newEnemies = this.enemies.filter(e => e.active && !activeEnemies.includes(e));
                let hasteCount = 0;
                newEnemies.forEach(e => {
                    if (emptyCols.includes(e._spawnColIndex) && !e.affixes.includes('haste')) {
                        e.affixes.push('haste');
                        hasteCount++;
                        this.spawn_createParticle(e.pos.x, e.pos.y, '#facc15', 'spark');
                    }
                });
                if (hasteCount > 0) {
                    showToast("⚡ 增援部隊！空列敵人獲得極速！");
                }
            }
        }

        // --- [符文领取] 充能符文和掉落符文的领取已提前到敌人动作后（phase_claimPendingRunes）执行
        // 仅将库存同步到存档（符文已在 phase_claimPendingRunes 中入库）
        this.saveData.runeInventory = (this.runeInventory || []).slice();
        this.sys_saveData();

        // --- [Glacies 狂暴] Peg 冻结回合数递减 ---
        if (this.pegs && Array.isArray(this.pegs)) {
            this.pegs.forEach(peg => {
                if (peg && peg.frozenTurns > 0) {
                    peg.frozenTurns--;
                }
            });
        }

        // --- 以下保持原有的回合结算逻辑 ---
        
        // =========================================
        // Boss 回合触发检测
        // =========================================
        // round++ 在下方执行，这里的 this.round 是即将到来的回合数
        const nextRound = this.round + 1;
        const bossCheck = this.spawn_checkBossRoundFor(nextRound);
        if (bossCheck.shouldSpawn) {
            // Boss 回合：不生成普通敌人行，改为生成 Boss
            const bossId = this.spawn_selectBossForRound(bossCheck.isBigBoss);
            // 延迟到回合切换后生成 Boss，确保 round++ 已执行
            this._pendingBossSpawn = { bossId, isBigBoss: bossCheck.isBigBoss };
        } else {
            // 普通回合：生成敌人行
            const rowCountCurrent = uniqueRows.size;
            let spawnCount = 1;
            if (rowCountCurrent < 4) spawnCount = 3;
            // [清屏奖励] 上一回合完成清屏，本回合至少推进 3 行敌人
            if (this._prevRoundCleared && spawnCount < 3) {
                spawnCount = 3;
                showToast('⚔️ 清屏反扑：敌军至少推进 3 行');
            }
            // [Feature 2: 围墙非空保证] 本回合清屏 → 下回合若全部从画面外滑入，将出现"围墙范围内
            // 短暂无敌人"的空窗（玩家若仍持有子弹会立刻被 perfect-clear-upgrade 再次结算）。
            // 因此清屏后第一行直接生成在网格顶部（IN-WALL），其余行保留画面外入场演出。
            if (clearedThisRound) {
                this.spawn_spawnEnemyRowAt(this.combatGridTopY);
                for (let i = 1; i < spawnCount; i++) {
                    this.spawn_spawnEnemyRowAt(
                        this.combatGridTopY - i * this.enemyHeight,
                        { offScreenEntrance: true }
                    );
                }
            } else {
                // [issue-2] 非清屏回合维持画面外入场，新敌人从画面外滑入网格顶部，避免凭空出现
                this.spawn_spawnEnemyRowOffScreen(spawnCount);
            }
        }
        // [清屏状态] 将本回合清屏结果写入标志位，供下一回合读取
        this._prevRoundCleared = clearedThisRound;

        // 重置倍率
        if (this.nextRoundHpMultiplier > 1) {
            showToast("強敵來襲！HP x" + this.nextRoundHpMultiplier);
            this.nextRoundHpMultiplier = 1;
        }

        // [修复] 回合切换时清空蝶蝶法阵和风刃，防止残留
        if (this.butterflyCircles) this.butterflyCircles = [];
        if (this.butterflyBlades) this.butterflyBlades = [];

        // [难度平衡] 战后高压因子递减
        if (this.postBossSurgeRoundsLeft > 0) {
            this.postBossSurgeRoundsLeft--;
            this.postBossMultiplier = Math.max(1.0, this.postBossMultiplier - 0.1);
            if (this.postBossSurgeRoundsLeft === 0) {
                this.postBossMultiplier = 1.0;
                console.log('[DifficultyBalance] 战后高压因子已恢复正常');
            }
        }
        // [Task C.2] 战后高压期：双词缀精英概率提升计数器递减
        if (this.postBossRoundsLeft > 0) {
            this.postBossRoundsLeft--;
            if (this.postBossRoundsLeft === 0) {
                console.log('[DifficultyBalance] 战后高压期结束，双词缀精英概率恢复正常');
            }
        }

        // [新增] 遗物效果递减：同化涌潮系列
        if (this.assimilationBoostRounds && typeof this.assimilationBoostRounds === 'object') {
            for (const mt of Object.keys(this.assimilationBoostRounds)) {
                if (this.assimilationBoostRounds[mt] > 0) {
                    this.assimilationBoostRounds[mt]--;
                    if (this.assimilationBoostRounds[mt] === 0) {
                        delete this.assimilationBoostRounds[mt];
                    }
                }
            }
        }
        if (this.doubleAssimilationBoostRounds && typeof this.doubleAssimilationBoostRounds === 'object') {
            for (const mt of Object.keys(this.doubleAssimilationBoostRounds)) {
                if (this.doubleAssimilationBoostRounds[mt] > 0) {
                    this.doubleAssimilationBoostRounds[mt]--;
                    if (this.doubleAssimilationBoostRounds[mt] === 0) {
                        delete this.doubleAssimilationBoostRounds[mt];
                    }
                }
            }
        }

        if ((this.runShopStarterBoostDamageRounds || 0) > 0) {
            this.runShopStarterBoostDamageRounds--;
            if (this.runShopStarterBoostDamageRounds <= 0) {
                const boostDamage = this.runShopStarterBoostDamageAmount || 0;
                this.flatDamageBonus = Math.max(0, (this.flatDamageBonus || 0) - boostDamage);
                this.runShopStarterBoostDamageAmount = 0;
            }
        }
        
        this.round++;
        this.prevRoundDamage = this.roundDamage;
        this.roundDamage = 0;
        eventBus.emit(EVENT_TYPES.UI_ROUND_NUM_UPDATE, { round: this.round });
        document.getElementById("round-num").innerText = this.round;

        // --- [遗物 Hook] 末日计时器 (doomsday_timer) & 回廊电弧 (corridor_arc) 回合开始触发 ---
        // 在 round++ 之后立即结算，使用新回合数作为伤害基数。
        let relicHookDelayMs = 0;
        if (typeof this.relic_runRoundStartHooks === 'function') {
            relicHookDelayMs = this.relic_runRoundStartHooks() || 0;
        }
        if (relicHookDelayMs > 0) {
            this._roundStartRelicHookDelayActive = true;
            setTimeout(() => {
                this._roundStartRelicHookDelayActive = false;
                this.phase_continueFinalizeRoundAfterRelicHooks();
            }, relicHookDelayMs);
            return;
        }
        this.phase_continueFinalizeRoundAfterRelicHooks();
        return;
    },

    phase_continueFinalizeRoundAfterRelicHooks() {
        // [DropV2] 紧急救援冷却计数器逐回合递减
        if (this.emergencyCooldown > 0) this.emergencyCooldown--;
        // [tsk-f35c6d10] 移除旧的小 Toast 回合提示，改由 sys_showRoundStartBanner 提供更醒目的大字居中提示

        // [爽游模式] 新手教程局：第 5 回合结算后触发胜利
        if (this._isTutorialRun && this.round > 5) {
            this.gameOver = true;
            this._isTutorialRunCleared = true; // 标记为胜利结局
            this._gameover_triggerPhase();
            return;
        }

        // 检查失败
        if (this.input_checkDefeat()) {
            this.gameOver = true;
            // [游戏结束] 切换到结算阶段
            this._gameover_triggerPhase();
            return;
        }

        document.getElementById('combat-message').innerHTML = '';
        // [BUGFIX tsk-gathering-phase-leak] 删除此处提前调用的 phase_gathering_initPachinko(true)。
        // 原 Bug：钉板在战斗结算时就被初始化，随后 sys_showRoundStartBanner() 切换到 gathering 阶段，
        //         Canvas 更新循环立即绘制已初始化的钉板，导致研磨阶段在每回合战斗结束后就提前出现。
        // 修复：钉板初始化的唯一入口是 phase_startGatheringPhase()，由 sys_showRoundStartBanner 在
        //       1.5 秒横幅结束后调用，确保研磨阶段只在命运抉择之后出现。

        // =========================================
        // 待执行 Boss 生成（round++ 后执行）
        // =========================================
        if (this._pendingBossSpawn) {
            const { bossId, isBigBoss } = this._pendingBossSpawn;
            this._pendingBossSpawn = null;
            this.spawn_spawnBoss(bossId, isBigBoss);
            // [Boss 调度] 记录本次 Boss 生成回合，用于计算击杀用时
            this._lastBossSpawnRound = this.round;
            if (!this._bossSpawnCount) this._bossSpawnCount = 0;
            this._bossSpawnCount++;
            console.log(`[BossSchedule] Boss #${this._bossSpawnCount} 已在 Round ${this.round} 生成`);
        }

        this.isEnemyTurn = false;

        if (this.ammoQueue.length === 0) {
            // [局内存档] 每回合结算完毕后自动存档，防止刷新丢失进度
            // round-start resolver 会在存档恢复时继续处理 pendingRoundStartRewards。
            this.sys_saveRunState();

            // [v2 局内商店] 不再每回合自动弹出；商店仅在「跳过遗物」(ui_skipRelic) 路径下打开。
            this.sys_startRoundStartResolver();
        }
    },

    /**
     * @method phase_playChargeUpgradeFX
     * @description [perfect-clear-upgrade] 播放剩余弹药"蓄能升级"显著特效。
     *              围墙清空时若仍有剩余子弹，触发本特效并将每发子弹累加属性 +1。
     * @perf-impact: 单次回合结算事件，固定上限：3 个 Shockwave + 1 个 HealWave + ~30~70 个 spark 粒子。
     *               所有创建均经过 spawn_create* 中的 perf budget 检查。
     */
    phase_playChargeUpgradeFX(leftoverCount = 1) {
        const cx = this.width / 2;
        const cy = this.height - 80;
        // 1. 中心三层 Shockwave（金/紫/青，错峰模拟蓄能层叠）
        if (typeof this.spawn_createShockwave === 'function') {
            this.spawn_createShockwave(cx, cy, '#fde047');
            setTimeout(() => this.spawn_createShockwave && this.spawn_createShockwave(cx, cy, '#a78bfa'), 90);
            setTimeout(() => this.spawn_createShockwave && this.spawn_createShockwave(cx, cy, '#22d3ee'), 180);
        }
        // 2. 大范围扩散光晕（复用 HealWave 的扩散环 + 中心光晕表达）
        if (typeof this.spawn_createHealWave === 'function') {
            this.spawn_createHealWave(cx, cy, 240);
        }
        // 3. 多方向闪电（向上向四周辐射），随剩余子弹数缩放
        if (typeof LightningBolt !== 'undefined' && Array.isArray(this.lightningBolts)) {
            const _budget = (CONFIG && CONFIG.performance && CONFIG.performance[this.perfQualityLevel || 'high']) || null;
            const limit = _budget ? _budget.lightningLimit : 12;
            const n = Math.min(8, 4 + leftoverCount);
            for (let i = 0; i < n && this.lightningBolts.length < limit; i++) {
                const ang = (Math.PI * 2 * i) / n - Math.PI / 2;
                const tx = cx + Math.cos(ang) * 220;
                const ty = cy + Math.sin(ang) * 220;
                this.lightningBolts.push(new LightningBolt(cx, cy, tx, ty));
            }
        }
        // 4. 大量金色 spark 粒子，数量随剩余子弹数线性增长
        const sparkCount = 28 + leftoverCount * 6;
        for (let i = 0; i < sparkCount; i++) {
            const angle = Math.random() * Math.PI * 2;
            const dist = 12 + Math.random() * 60;
            this.spawn_createParticle(cx + Math.cos(angle) * dist, cy + Math.sin(angle) * dist, '#fde047', 'spark');
        }
        // 5. 居中浮动文字提示
        if (typeof this.spawn_createFloatingText === 'function') {
            this.spawn_createFloatingText(cx, cy - 90, `+${leftoverCount} 蓄能升級！`, '#fde047');
        }
    },

    smartScientific(num, fractionDigits = 2) {
        // 1. 处理 0 和 非数字 的情况
        if (isNaN(num)) return "NaN";
        if (num === 0) return "0";

        const absVal = Math.abs(num);

        // 2. 设定阈值：绝对值 >= 10000 或 < 0.001 时使用科学计数法
        // 你可以根据需求修改这个范围
        if (absVal >= 10000 || absVal < 0.001) {
            // --- 方案 2 的美化逻辑 ---
            
            // 获取标准格式 (如 "1.23e+5")
            const str = num.toExponential(fractionDigits);
            
            // 分割底数和指数
            const [base, exponent] = str.split('e');
            
            // 去掉指数的正号 (如 "+5" -> "5")
            const cleanExponent = exponent.replace('+', '');
            
            // 返回美化格式
            return `${base} × 10^${cleanExponent}`;
        }

        // 3. 正常范围内的数字
        // 使用 parseFloat + toFixed 是为了处理 JS 浮点数精度问题 (如 0.1+0.2)
        // 并自动去掉末尾多余的 0 (例如 5.500 -> 5.5)
        return parseFloat(num.toFixed(fractionDigits)).toString();
    },
/**
     * @method updateCombat
     * @description 战斗阶段的游戏逻辑更新 (含可视化墙壁与分层视差)。
     */
    // @section:combat_update_timescale - 时间缩放与暂停状态检查
    phase_combat_update(timeScale) {
        if (this._relicCombatCinematicFrames > 0) {
            this._relicCombatCinematicFrames -= timeScale;
            this.isVisualEffectActive = true;
            if (this._relicCombatCinematicFrames <= 0) {
                this._relicCombatCinematicFrames = 0;
                if (!this._continuousLaserFiring && !(this._laserFadeOutFrames > 0)) {
                    this.isVisualEffectActive = false;
                }
            }
        }

        // === [新增] 处理子剑动态生成队列 ===
        if (this.sonSwordQueue.length > 0) {
            this.sonSwordTimer -= timeScale;
            
            if (this.sonSwordTimer <= 0) {
                // 取出一个生成请求
                const req = this.sonSwordQueue.shift();
                
                // 只要母剑还活着(或者没飞太远)，就生成子剑
                if (req.mother.active || !req.mother.destroyed) {
                    // 这里 startDelay 传 0，因为我们已经通过队列控制了时间
                    this.combat_flyingSword_addSon(req.x, req.y, req.mother, req.level, req.config, 0);
                    
                    // 播放一个轻微的生成音效 (可选)
                    // audio.playTone(600 + this.sonSwordQueue.length * 50, 'sine', 0.05, 0.1);
                }

                // [核心算法] 动态延迟计算
                // 剩余数量越多，延迟越短 (喷射而出)；剩余越少，延迟越长 (慢慢收尾)
                const fsCfg = CONFIG.mechanics.flying_sword;
                const remaining = this.sonSwordQueue.length;
                
                // 公式：基础延迟，每多一个排队减少 2帧，最快限制
                this.sonSwordTimer = Math.max(fsCfg.sonSwordDelayMin, fsCfg.sonSwordDelayBase - (remaining * 2));
            }
        }

        if (this.isChargingShot) {
            // 吸收速度：0.08 大约需要 12 帧 (0.2秒)，手感比较干脆
            this.chargeProgress += 0.08 * timeScale;
            
            if (this.chargeProgress >= 1.0) {
                // 动画结束，真正发射
                this.isChargingShot = false;
                this.chargeProgress = 0;
                if (this.pendingFireVelocity) {
                    this.combat_fireNextShot(this.pendingFireVelocity);
                    this.pendingFireVelocity = null;
                    // --- [新增] 发射后立即触发“能量注入”动画 ---
                    this.isReloading = true;
                    this.reloadProgress = 0;
                }
            }
        }
        // --- [修改] 2. 处理能量注入 (变慢 & 增加撞击反馈) ---
        if (this.isReloading) {
            // [修改点] 速度从 0.1 改为 0.035，让过程持续约 0.5秒，更具重量感
            this.reloadProgress += 0.035 * timeScale;
            
            if (this.reloadProgress >= 1.0) {
                this.isReloading = false;
                this.reloadProgress = 1.0;
                
                // [新增] 撞击时刻！给予轨道一个巨大的旋转初速度
                // 就像能量球狠狠砸在了轨道上，带动它疯狂旋转
                this.spinBoost = 0.002; 
            }
        }

        // --- [新增] 3. 计算轨道旋转物理 (惯性与阻力) ---
        // 基础旋转速度 (约为 0.5 rad/frame)
        const baseSpeed = 0.00012; 
        
        // 阻力衰减：每一帧速度乘以 0.92，快速慢下来
        this.spinBoost *= 0.95;
        if (this.spinBoost < 0.0001) this.spinBoost = 0;

        // 最终角度累加：基础速度 + 爆发速度
        // 在装填过程中(isReloading)，为了体现"未就位"，我们可以让轨道转得稍慢一点，或者反向转
        let currentFrameSpeed = baseSpeed + this.spinBoost;
        this.orbitalAngle += currentFrameSpeed * timeScale * 60; // *60 是为了适配 timeScale 的基准
        this.ui_updateSlowMotion();
        // [充能符文系统] 充能条自动衰减
        if (this.phase === 'combat' || this.phase === 'training') {
            this.combat_runeCharge_decay(timeScale);
        }
        const tilt = this.boardTilt.current;
        // @section:combat_update_entities - 实体批量更新（敌人/子弹/特效）
        const container = document.getElementById('game-container');
        if (container) {
            container.style.perspective = "1200px";
            const rotateX = tilt.y * -8;
            const rotateY = tilt.x * 8;
            const translateZ = -20;
            // container.style.transform = `rotateX(${rotateX}deg) rotateY(${rotateY}deg) translateZ(${translateZ}px)`;
            container.style.transform = `rotateX(0deg) rotateY(0deg) translateZ(0px)`;
        }

        // === 1. 计算视差参数 ===
        // 背景层 (地板)：正向移动
        const bgShiftX = tilt.x * 20;
        const bgShiftY = tilt.y * 15;

        // 实体层 (敌人/UI/墙壁)：反向移动
        const entityShiftX = tilt.x * -15;
        const entityShiftY = tilt.y * -10;

        // 应用 CSS 到 DOM UI
        // const skillBar = document.getElementById('skill-bar');
        // const hud = document.getElementById('recipe-hud-container');
        // const uiTransform = `translate3d(${entityShiftX}px, ${entityShiftY}px, 0)`;
        // if (skillBar) skillBar.style.transform = uiTransform;
        // if (hud) hud.style.transform = uiTransform;

        if (this.swordQis) {
            for (let i = this.swordQis.length - 1; i >= 0; i--) {
                const qi = this.swordQis[i];
                qi.update(timeScale, this.enemies, this); // 傳入 enemies 和 game 實例
                if (!qi.active) {
                    this.swordQis.splice(i, 1);
                }
            }
        }
        // --- 逻辑更新 ---
        for (let i = this.burstQueue.length - 1; i >= 0; i--) {
            const shot = this.burstQueue[i];
            shot.delay -= timeScale;
            if (shot.delay <= 0) {
                // [emitter-port] 子弹从发射器素材的上沿发射口生成，偏移量统一来自 EMITTER_PORT_OFFSET_Y。
                // [echo-origin] 若 shot 携带 x/y（如回响弹），则从该坐标发射，否则回退到发射器
                const spawnX = (typeof shot.x === 'number') ? shot.x : this.width/2;
                const spawnY = (typeof shot.y === 'number') ? shot.y : this.height - 80 - EMITTER_PORT_OFFSET_Y;
                this.spawn_spawnBullet(spawnX, spawnY, shot.vel, shot.recipe, shot.shotId, shot.isLast);
                audio.playShoot();
                this.burstQueue.splice(i, 1);
            }
        }
        if (this.waveMomentumTimer > 0) this.waveMomentumTimer -= timeScale;

        // ==========================================
        //  LAYER 0: 固定 UI 层 (防线)
        // Visual warning strip removed; defeatLineY still drives lose checks.

        // ==========================================
        //  LAYER 0: 背景层 (网格 & 扫描波)
        // ==========================================
        this.ctx.save();
        this.ctx.translate(bgShiftX, bgShiftY); 

            // A. 绘制背景网格 (双层刻线效果)
            this.ctx.save();
            const gridOffsetX = bgShiftX * 1.5;
            const gridOffsetY = bgShiftY * 1.5;
            this.ctx.beginPath();
            for (let x = -50; x < this.width + 50; x += 40) {
                this.ctx.moveTo(x, -50); this.ctx.lineTo(x, this.height + 50);
            }
            for (let y = -50; y < this.height + 50; y += 40) {
                this.ctx.moveTo(-50, y); this.ctx.lineTo(this.width + 50, y);
            }
            // 第一遍：沟槽阴影
            this.ctx.lineWidth = 2;
            this.ctx.strokeStyle = 'rgba(0, 0, 0, 0.5)';
            this.ctx.stroke();
            // 第二遍：发光刻线
            this.ctx.lineWidth = 1;
            this.ctx.strokeStyle = 'rgba(94, 163, 184, 0.18)';
            this.ctx.stroke();
            // 网格交叉点微小发光点
            this.ctx.globalAlpha = 0.08;
            this.ctx.fillStyle = 'rgba(255, 255, 255, 1)';
            for (let x = -50; x < this.width + 50; x += 40) {
                for (let y = -50; y < this.height + 50; y += 40) {
                    this.ctx.beginPath();
                    this.ctx.arc(x, y, 1.5, 0, Math.PI * 2);
                    this.ctx.fill();
                }
            }
            this.ctx.globalAlpha = 1;
            this.ctx.restore();

            // B. 绘制扫描波
            if (this.isEnemyTurn && this.enemyWaveActive) {
                const currentSpeed = this.calc_calculateWaveSpeed();
                this.enemyWaveY -= currentSpeed;

                this.ctx.save();
                this.ctx.globalCompositeOperation = 'lighter';
                
                const trailHeight = 220; 
                const gridGrad = this.ctx.createLinearGradient(0, this.enemyWaveY, 0, this.enemyWaveY + trailHeight);
                gridGrad.addColorStop(0, 'rgba(251, 191, 36, 0.5)'); 
                gridGrad.addColorStop(0.3, 'rgba(217, 119, 6, 0.2)'); 
                gridGrad.addColorStop(1, 'rgba(180, 83, 9, 0)');     
                this.ctx.strokeStyle = gridGrad;
                this.ctx.lineWidth = 1;
                this.ctx.beginPath();
                const cols = 8;
                for(let i=0; i<=cols; i++) {
                    const x = (this.width / cols) * i;
                    this.ctx.moveTo(x, this.enemyWaveY);
                    this.ctx.lineTo(x, this.enemyWaveY + trailHeight);
                }
                const gridSize = 40;
                const startGridY = Math.floor(this.enemyWaveY / gridSize) * gridSize;
                for(let y = startGridY; y < this.enemyWaveY + trailHeight; y += gridSize) {
                    if(y > this.enemyWaveY) { 
                        this.ctx.moveTo(0, y);
                        this.ctx.lineTo(this.width, y);
                    }
                }
                this.ctx.stroke();

                const time = Date.now() / 50; 
                this.ctx.beginPath();
                this.ctx.strokeStyle = '#ffffff'; 
                this.ctx.lineWidth = 4;
                this.ctx.shadowColor = '#fef08a'; 
                this.ctx.shadowBlur = _sb(20);
                for (let x = 0; x <= this.width; x += 10) {
                    const offset = Math.sin(x * 0.1 + time) * 2 + (Math.random() - 0.5) * 6;
                    const y = this.enemyWaveY + offset;
                    if (x === 0) this.ctx.moveTo(x, y);
                    else this.ctx.lineTo(x, y);
                }
                this.ctx.stroke();

                // [T4-B] 余晖线：在前沿线下方 20px 处绘制一条淡金色余晖
                this.ctx.beginPath();
                this.ctx.strokeStyle = 'rgba(251, 191, 36, 0.3)';
                this.ctx.lineWidth = 1.5;
                this.ctx.shadowBlur = 0;
                for (let x = 0; x <= this.width; x += 10) {
                    const offset = Math.sin(x * 0.1 + time) * 2 + (Math.random() - 0.5) * 6;
                    const y = this.enemyWaveY + offset + 20;
                    if (x === 0) this.ctx.moveTo(x, y);
                    else this.ctx.lineTo(x, y);
                }
                this.ctx.stroke();
                
                // @section:combat_update_collision - 碰撞检测与伤害结算调度
                this.ctx.fillStyle = '#fef3c7'; 
                for(let i=0; i<5; i++) {
                    const lx = Math.random() * this.width;
                    const ly = this.enemyWaveY + (Math.random() - 0.5) * 30;
                    const lw = Math.random() * 50 + 10;
                    this.ctx.fillRect(lx, ly, lw, 1);
                }
                this.ctx.restore();

                const triggerLine = this.enemyWaveY; 
                this.enemies.forEach(e => {
                    if (!e.active) return;
                    if (e.pos.y + e.height/2 >= triggerLine && !e.hasActedThisTurn) {
                        e.playScanFeedback();
                        this.phase_enemy_processTurn(e);
                    }
                });
                if (this.enemyWaveY < -50) {
                    this.enemyWaveActive = false;
                    this.enemyTurnTimer = 0;
                }
            }

        // [T4-A] 底部能量粉尘：基于时间的伪随机上升光点，增加场地空气感
        this.ctx.save();
        const dustTime = Date.now() / 60;
        for (let i = 0; i < 25; i++) {
            const baseX = (Math.sin(i * 137.508) * 0.5 + 0.5) * this.width;
            const speed = 0.6 + (i % 3) * 0.4;
            const dustY = this.defeatLineY - ((dustTime * speed + i * 91.3) % (this.defeatLineY * 0.8));
            const alpha = 0.08 + Math.sin(dustTime * 0.5 + i) * 0.04;
            const size = 1 + (i % 2) * 0.5;
            this.ctx.globalAlpha = Math.max(0, alpha);
            this.ctx.fillStyle = i % 3 === 0 ? '#38bdf8' : '#94a3b8';
            this.ctx.fillRect(baseX, dustY, size, size);
        }
        this.ctx.globalAlpha = 1;
        this.ctx.restore();

        this.ctx.restore(); 


        // ==========================================
        //  LAYER 2: 实体层 (墙壁 / 敌人 / 子弹)
        // ==========================================
        this.ctx.save();
        this.ctx.translate(entityShiftX, entityShiftY); 

            // --- [修复]：绘制可视化的边界墙壁（从顶部栏下边界开始，不遥挡顶部栏内容）---
            this.ctx.save();
            // 顶部栏下边界 Y（combatGridTopY - enemyHeight/2 即第一行敌人上边界，也是顶部栏底部）
            const wallTopY = this.combatGridTopY - this.enemyHeight / 2;
            const combatBounds = this.sys_getCombatBounds ? this.sys_getCombatBounds() : { left: 0, right: this.width };
            const wallLeftX = combatBounds.left;
            const wallRightX = combatBounds.right;
            // 左墙 (玻璃质感渐变)
            const wallGradLeft = this.ctx.createLinearGradient(wallLeftX, 0, wallLeftX + 20, 0);
            wallGradLeft.addColorStop(0, 'rgba(56, 189, 248, 0.25)');
            wallGradLeft.addColorStop(0.3, 'rgba(148, 163, 184, 0.1)');
            wallGradLeft.addColorStop(1, 'rgba(148, 163, 184, 0)');
            this.ctx.fillStyle = wallGradLeft;
            this.ctx.fillRect(wallLeftX, wallTopY, 20, this.height - wallTopY);
            // 左墙反光线
            this.ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
            this.ctx.fillRect(wallLeftX, wallTopY, 1, this.height - wallTopY);
            
            // 右墙 (玻璃质感渐变)
            const wallGradRight = this.ctx.createLinearGradient(wallRightX, 0, wallRightX - 20, 0);
            wallGradRight.addColorStop(0, 'rgba(56, 189, 248, 0.25)');
            wallGradRight.addColorStop(0.3, 'rgba(148, 163, 184, 0.1)');
            wallGradRight.addColorStop(1, 'rgba(148, 163, 184, 0)');
            this.ctx.fillStyle = wallGradRight;
            this.ctx.fillRect(wallRightX - 20, wallTopY, 20, this.height - wallTopY);
            // 右墙反光线
            this.ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
            this.ctx.fillRect(wallRightX - 1, wallTopY, 1, this.height - wallTopY);

            // 墙壁发光边框 (明确反弹线)
            this.ctx.strokeStyle = 'rgba(148, 163, 184, 0.4)'; // Slate-400
            this.ctx.lineWidth = 2;
            this.ctx.shadowColor = '#38bdf8';
            this.ctx.shadowBlur = _sb(15);
            this.ctx.beginPath();
            // 左边线（从顶部栏下边界开始）
            this.ctx.moveTo(wallLeftX + 1, wallTopY); this.ctx.lineTo(wallLeftX + 1, this.height);
            // 右边线（从顶部栏下边界开始）
            this.ctx.moveTo(wallRightX - 1, wallTopY); this.ctx.lineTo(wallRightX - 1, this.height);
            // 顶部线 (顶部栏下边界，不遥挡顶部栏)
            this.ctx.moveTo(wallLeftX, wallTopY); this.ctx.lineTo(wallRightX, wallTopY);
            this.ctx.stroke();
            this.ctx.restore();
            // ------------------------------------

            // C. 绘制游戏实体
            let activeEnemies = 0;
            let anyEnemyMoving = false;
            this.enemies.forEach(e => {
                if (e.active) {
                    e.update(this.timeScale, this);
                    e.draw(this.ctx);
                    // Boss 入场动画期间（pos.y 在屏幕外）也计入活跃敌人，防止误判完美清场
                    // [演出时机修复] 同时兼容 _pendingEntrance 状态（Boss 在屏幕外待机）
                    // [issue-2] 普通敌人画面外入场（_spawnedThisTurn）也计入活跃，避免误判完美清场
                    // 顶部两排敌人（row 0 / row 1）被顶部墙挡住，子弹无法击中，
                    // 不计入「围墙内活跃敌人」用以触发清场抽奖判定。
                    const inWallAndClearable = e.pos.y > 0 && this.phase_isEnemyClearable(e);
                    if (inWallAndClearable || (e.type === 'boss' && (e.entranceTimer > 0 || e._pendingEntrance)) || e._spawnedThisTurn) {
                        activeEnemies++;
                    }
                    if (Math.abs(e.pos.y - e.dropTargetY) > 1) anyEnemyMoving = true;
                }
            });

            // [猎人本能] 绘制持续标记特效：找到血量最低的活跃敌人并渲染动态瞄准十字准星
            if (this.ownedRelics && this.ownedRelics.includes('hunter_instinct')) {
                let hunterTarget = null;
                let lowestHp = Infinity;
                for (const e of this.enemies) {
                    if (e && e.active && e.hp > 0 && e.pos.y > 0) {
                        if (e.hp < lowestHp) { lowestHp = e.hp; hunterTarget = e; }
                    }
                }
                if (hunterTarget) {
                    const tx = hunterTarget.pos.x;
                    const ty = hunterTarget.pos.y;
                    const ew = (hunterTarget.width || 40) * 0.5;
                    const eh = (hunterTarget.height || 40) * 0.5;
                    // 动画参数：基于时间的脉动/旋转
                    const now = Date.now();
                    const pulse = (Math.sin(now / 200) + 1) / 2;       // 0→1 脉动
                    const spin = (now / 800) % (Math.PI * 2);           // 慢速旋转
                    const innerR = (ew + 4) + pulse * 4;                // 动态内径
                    const outerR = innerR + 10 + pulse * 3;
                    const alpha = 0.65 + pulse * 0.35;

                    this.ctx.save();
                    this.ctx.translate(tx, ty);
                    this.ctx.rotate(spin);
                    this.ctx.globalCompositeOperation = 'lighter';

                    // 外圈 — 橙红渐变光环
                    const grad = this.ctx.createRadialGradient(0, 0, innerR * 0.7, 0, 0, outerR);
                    grad.addColorStop(0, `rgba(239,68,68,0)`);
                    grad.addColorStop(0.5, `rgba(239,68,68,${alpha * 0.4})`);
                    grad.addColorStop(1, `rgba(239,68,68,0)`);
                    this.ctx.fillStyle = grad;
                    this.ctx.beginPath();
                    this.ctx.arc(0, 0, outerR, 0, Math.PI * 2);
                    this.ctx.fill();

                    // 主光环边线
                    this.ctx.strokeStyle = `rgba(239,68,68,${alpha})`;
                    this.ctx.lineWidth = 2;
                    this.ctx.shadowColor = '#ef4444';
                    this.ctx.shadowBlur = _sb(8 + pulse * 6);
                    this.ctx.beginPath();
                    this.ctx.arc(0, 0, innerR, 0, Math.PI * 2);
                    this.ctx.stroke();

                    // 四条角缺口准星线（每条 120° 间隔断口，形成 4 段弧）
                    const segAngles = [0, Math.PI * 0.5, Math.PI, Math.PI * 1.5];
                    const segSpan = Math.PI * 0.32;
                    this.ctx.lineWidth = 2.5;
                    this.ctx.strokeStyle = `rgba(251,113,133,${alpha})`;
                    for (const sa of segAngles) {
                        this.ctx.beginPath();
                        this.ctx.arc(0, 0, innerR + 6, sa - segSpan / 2, sa + segSpan / 2);
                        this.ctx.stroke();
                    }

                    // 中心十字（短划线）
                    const crossLen = 5 + pulse * 2;
                    this.ctx.lineWidth = 1.5;
                    this.ctx.strokeStyle = `rgba(239,68,68,${alpha * 0.9})`;
                    this.ctx.beginPath();
                    this.ctx.moveTo(-crossLen, 0); this.ctx.lineTo(crossLen, 0);
                    this.ctx.moveTo(0, -crossLen); this.ctx.lineTo(0, crossLen);
                    this.ctx.stroke();

                    this.ctx.restore();
                }
            }

            if (this.input_checkDefeat()) {
                this.gameOver = true;
                // [游戏结束] 切换到结算阶段
                this._gameover_triggerPhase();
            }

            // 更新和绘制弹丸
            for (let i = this.projectiles.length - 1; i >= 0; i--) { 
                const p = this.projectiles[i]; 
                if(p) { 
                    p.update(this.width, this.height, this.enemies, (spawnInfo) => { this.spawn_spawnBullet(spawnInfo.x, spawnInfo.y, spawnInfo.vel, spawnInfo.config, p.shotId); }, timeScale); 
                    p.draw(this.ctx); 
                    if (p.destroyed) {
                        // [修复] 当该shotId的所有子弹都销毁时，保存统计
                        if (p.shotId !== null && this.shotDamageMap.has(p.shotId)) {
                            const shotStats = this.shotDamageMap.get(p.shotId);
                            shotStats.destroyedCount++;
                            
                            // 当所有子弹都销毁时，保存统计
                            if (shotStats.destroyedCount >= shotStats.projectileCount && shotStats.total > 0) {
                                this.shotDamageHistory.push({
                                    total: shotStats.total,
                                    byAttr: { ...shotStats.byAttr }
                                });
                                // 增加容量到 10 发子弹，方便查看
                                if (this.shotDamageHistory.length > 10) {
                                    this.shotDamageHistory.shift();
                                }
                                this.ui_updateDamageStats();
                                this.shotDamageMap.delete(p.shotId);
                            }
                        }
                        this.projectiles.splice(i, 1);
                    } 
                } 
            }

            // 更新和绘制 FireWaves
            for (let i = this.fireWaves.length - 1; i >= 0; i--) {
                const fw = this.fireWaves[i];
                fw.update(timeScale);
                fw.draw(this.ctx);
                if (fw.life <= 0) this.fireWaves.splice(i, 1);
            }
            // @section:combat_update_wave_logic - 波次推进与 Boss 生成判断
            // 更新和绘制 IceWaves（冰冻状态死亡特效）
            if (this.iceWaves) {
                for (let i = this.iceWaves.length - 1; i >= 0; i--) {
                    const iw = this.iceWaves[i];
                    iw.update(timeScale);
                    iw.draw(this.ctx);
                    if (iw.life <= 0) this.iceWaves.splice(i, 1);
                }
            }
            // 更新和绘制 HealWaves（范围治疗扩散波特效）
            if (this.healWaves) {
                for (let i = this.healWaves.length - 1; i >= 0; i--) {
                    const hw = this.healWaves[i];
                    hw.update(timeScale);
                    hw.draw(this.ctx);
                    if (hw.life <= 0) this.healWaves.splice(i, 1);
                }
            }
            // 更新和绘制 DeathExplosions（分级死亡爆炸特效）
            if (this.deathExplosions) {
                for (let i = this.deathExplosions.length - 1; i >= 0; i--) {
                    const de = this.deathExplosions[i];
                    de.update(timeScale);
                    de.draw(this.ctx);
                    if (de.life <= 0) this.deathExplosions.splice(i, 1);
                }
            }
            // 更新和绘制 RewardDropEffects（遗物/精华掉落特效）
            if (this.rewardDropEffects) {
                for (let i = this.rewardDropEffects.length - 1; i >= 0; i--) {
                    const rde = this.rewardDropEffects[i];
                    rde.update(timeScale);
                    rde.draw(this.ctx);
                    if (rde.life <= 0) this.rewardDropEffects.splice(i, 1);
                }
            }

            // 更新和绘制特效（两指针原地压缩，避免 splice O(N²) 与临时数组分配；死亡粒子归还对象池）
            {
                const arr = this.particles;
                const counts = this.particleCounts;
                const pool = this._particlePool;
                let w = 0;
                for (let r = 0; r < arr.length; r++) {
                    const p = arr[r];
                    if (!p) continue;
                    p.update(timeScale);
                    p.draw(this.ctx);
                    if (p.life > 0) {
                        if (w !== r) arr[w] = p;
                        w++;
                    } else {
                        if (counts[p.mode] !== undefined && counts[p.mode] > 0) counts[p.mode]--;
                        if (pool.length < 200 && typeof p.reset === 'function') pool.push(p);
                    }
                }
                arr.length = w;
            }
            for(let i=this.shockwaves.length-1; i>=0; i--) { let s = this.shockwaves[i]; if(s) { s.update(timeScale); s.draw(this.ctx); if(s.alpha <= 0) this.shockwaves.splice(i,1); } } 
            for(let i=this.lightningBolts.length-1; i>=0; i--) { let b = this.lightningBolts[i]; b.update(timeScale); b.draw(this.ctx); if(b.life <= 0) this.lightningBolts.splice(i,1); } 
            for(let i=this.spores.length-1; i>=0; i--) { let s = this.spores[i]; if(s) { s.update(timeScale); s.draw(this.ctx); if(!s.active) this.spores.splice(i,1); } }
            if (this.swordQis) {
                this.swordQis.forEach(qi => qi.draw(this.ctx));
            }
            // 蝴蝶法阵更新和绘制
            this.combat_wind_updateButterflyCircles(timeScale);
            this.combat_wind_drawButterflyCircles(this.ctx);
            this.combat_wind_updateButterflyBlades(timeScale);
            this.combat_wind_drawButterflyBlades(this.ctx);
            // 风暴核心更新和绘制
            this.combat_wind_updateStormCores(timeScale);
            this.combat_wind_drawStormCores(this.ctx);
            // 活跃大旋风更新（基于 Tick 的同步伤害与粒子）
            this.combat_wind_updateActiveCyclones(timeScale);
            // 活跃暴风绞杀更新（基于 Tick 的同步切割伤害）
            this.combat_wind_updateActiveStrangles(timeScale);
            // 活跃风道更新（基于 Tick 的同步切割伤害）
            this.combat_wind_updateActiveTunnels(timeScale);
            // [照射词条] 持续照射状态机驱动（每 0.5s 重算一次激光）
            // [修复] 当 _laserFadeOutFrames > 0 时也需要驱动，以处理淡出等待帧计数
            if (this._continuousLaserFiring || this._laserFadeOutFrames > 0) {
                this.combat_continuousLaser_update(timeScale);
            }
            
            // [剑刃风暴词条] 绑定首个子弹的周期性风斩更新
            if (this.combat_bladeStorm_update) {
                this.combat_bladeStorm_update(timeScale);
            }
            // 拖拽瞄准线
            if (this.isDragging && this.projectiles.length === 0 && this.ammoQueue.length > 0 && this.burstQueue.length === 0) {
                // [emitter-port] 瞄准线起点对齐到发射器素材的上沿发射口
                const start = new Vec2(this.width / 2, this.height - 80 - EMITTER_PORT_OFFSET_Y);
                let force = this.lastMousePos.sub(start);
                
                if (force.y < -20) {
                    let dir = force.norm(); 
                    const aimRecipe = this.ammoQueue && this.ammoQueue.length > 0 ? this.ammoQueue[0] : null;
                    const guides = buildCombatAimGuides(this, start, dir, aimRecipe);
                    
                    this.ctx.save();
                    guides.forEach(({ kind, guide }, guideIndex) => {
                        const isMainGuide = kind === 'main';
                        this.ctx.strokeStyle = isMainGuide ? 'rgba(255, 255, 255, 0.55)' : 'rgba(250, 204, 21, 0.34)';
                        this.ctx.lineWidth = isMainGuide ? 2 : 1.4;
                        this.ctx.setLineDash(isMainGuide ? [6, 6] : [4, 8]);
                        this.ctx.beginPath();
                        guide.points.forEach((point, index) => {
                            if (index === 0) this.ctx.moveTo(point.x, point.y);
                            else this.ctx.lineTo(point.x, point.y);
                        });
                        this.ctx.stroke();

                        if (guideIndex > 0) return;

                        this.ctx.setLineDash([]);
                        this.ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
                        guide.bouncePoints.forEach((point, index) => {
                            this.ctx.beginPath();
                            this.ctx.arc(point.x, point.y, 3 + index * 0.5, 0, Math.PI * 2);
                            this.ctx.fill();
                        });
                        this.ctx.fillStyle = 'rgba(250, 204, 21, 0.92)';
                        guide.enemyBouncePoints.forEach((point, index) => {
                            this.ctx.beginPath();
                            this.ctx.arc(point.x, point.y, 4 + index * 0.4, 0, Math.PI * 2);
                            this.ctx.fill();
                        });
                        const endPoint = guide.points[guide.points.length - 1];
                        if (endPoint) {
                            this.ctx.beginPath();
                            this.ctx.arc(endPoint.x, endPoint.y, 3, 0, Math.PI * 2);
                            this.ctx.fill();
                        }
                    });
                    this.ctx.restore();

                    this.ctx.save();
                    this.ctx.translate(start.x, start.y);
                    this.ctx.rotate(Math.atan2(force.y, force.x));
                    this.ctx.fillStyle = '#6366f1';
                    this.ctx.beginPath();
                    this.ctx.arc(0, 0, 15, 0, Math.PI * 2);
                    this.ctx.fill();
                    this.ctx.fillStyle = '#818cf8';
                    this.ctx.fillRect(10, -6, 12, 12); 
                    this.ctx.restore();
                }
            } else if (this.projectiles.length === 0) {
                // [emitter-port] 空仓占位炮台对齐到发射器素材的上沿发射口
                const start = new Vec2(this.width / 2, this.height - 80 - EMITTER_PORT_OFFSET_Y);
                this.ctx.save();
                this.ctx.translate(start.x, start.y);
                this.ctx.rotate(-Math.PI / 2);
                this.ctx.fillStyle = '#475569';
                this.ctx.beginPath();
                this.ctx.arc(0, 0, 12, 0, Math.PI * 2);
                this.ctx.fill();
                this.ctx.fillRect(8, -4, 8, 8);
                this.ctx.restore();
            }

        this.sonSwords.forEach(s => s.update(timeScale, this.enemies, this));
        this.sonSwords.forEach(s => s.draw(this.ctx));
        // 清理不活跃的子剑
        this.sonSwords = this.sonSwords.filter(s => s.active);

        // --- 符文採落物渲染与自动拾取 ---
        if (this.runeLootItems && this.runeLootItems.length > 0) {
            for (let i = this.runeLootItems.length - 1; i >= 0; i--) {
                const loot = this.runeLootItems[i];
                if (!loot || !loot.active) {
                    this.runeLootItems.splice(i, 1);
                    continue;
                }
                // 绘制符文採落物
                loot.draw(this.ctx);
                // 当所有敌人被清除时，自动拾取尚在场地上的符文
                if (activeEnemies === 0 && loot.active) {
                    const runeDef = RUNE_DB.find(r => r.id === loot.runeId);
                    if (runeDef) {
                        // loot.level 由掉落生成时设置（Boss 掉落可能为 2+），默认为 1
                        // @section:combat_update_ui_sync - 战斗 HUD 同步更新
                        const runeObj = { id: loot.runeId, level: loot.level || 1 };
                        this.runeInventory.push(runeObj);
                        loot.active = false;
                        const runeName = runeDef.icon ? `${runeDef.icon} ${runeDef.name}` : runeDef.name;
                        showToast(`拾取符文：${runeName}`);
                    }
                }
            }
            // 清理已拾取的採落物
            this.runeLootItems = this.runeLootItems.filter(l => l && l.active);
        }

        // --- 持久掉落物渲染（遗物/精华宝石）---
        // [BUGFIX] fieldLootItems 必须在 LAYER 2（实体层）内渲染，原因：
        // 1. 享有与敌人相同的视差偏移（entityShiftX/Y），位置正确
        // 2. 只在 combat/training 阶段渲染，不会泄漏到 selection 等其他阶段
        if (this.fieldLootItems) {
            for (let i = this.fieldLootItems.length - 1; i >= 0; i--) {
                const item = this.fieldLootItems[i];
                if (item.active) {
                    item.update(timeScale);
                    item.draw(this.ctx);
                } else {
                    this.fieldLootItems.splice(i, 1);
                }
            }
        }

        this.ctx.restore(); // 结束实体层


        // --- UI Overlays ---
        if (this.gameOver) { 
            // [游戏结束] 已切换到 gameover 阶段，combat 渲染循环直接返回
            return; 
        }

        // [in-wall-clear-lottery] 围墙范围内（pos.y > 0）已无敌人时优先触发抽奖 + 精英援军流程。
        // 该触发会内部置 `_chargeUpgradeApplied = true`，覆盖原 perfect-clear-upgrade 路径。
        if (activeEnemies === 0 && this.phase === 'combat' && !this.gameOver
            && !this._inWallClearTriggered && !this.isEnemyTurn
            && typeof this.phase_inWallClearTrigger === 'function') {
            this.phase_inWallClearTrigger();
        }

        // [perfect-clear-upgrade] 兜底分支：若新机制未启用（如试炼场或抽奖跳过），
        // 仍然走原蓄能升级流程，将剩余子弹 +1 携带到下回合。
        if (activeEnemies === 0) {
            const hasLeftoverAmmo = this.ammoQueue.length > 0;
            if (hasLeftoverAmmo && !this._chargeUpgradeApplied) {
                this._chargeUpgradeApplied = true;
                const leftoverCount = this.ammoQueue.length;
                // 1. 维持原有奖励：分数倍率 + 下回合难度
                const scoreMult = Math.pow(CONFIG.balance.unusedAmmoScoreMult, leftoverCount);
                this.score *= scoreMult;
                this.nextRoundHpMultiplier = CONFIG.balance.nextRoundDifficultyMult;
                // 2. 对每发剩余子弹施加 +1 强化（所有可累加属性）
                const STACKABLE_KEYS = ['damage', 'pierce', 'bounce', 'scatter', 'pyro', 'cryo', 'lightning', 'laser', 'overcharge', 'wind'];
                const upgradedAmmo = this.ammoQueue.map(recipe => {
                    const enhanced = { ...recipe };
                    STACKABLE_KEYS.forEach(k => {
                        enhanced[k] = (enhanced[k] || 0) + 1;
                    });
                    if (enhanced.laser >= 1) enhanced.isLaser = true;
                    enhanced._chargeUpgraded = true;
                    return enhanced;
                });
                // 3. 携带升级子弹到下一回合（在 phase_startCombatPhase 中 prepend 回 ammoQueue）
                this._carryOverAmmo = upgradedAmmo;
                // 4. 清空当前队列，让 playerTurnFinished 自然成立、回合正常结算
                this.ammoQueue = [];
                // 5. 显著的蓄能发光升级特效
                this.phase_playChargeUpgradeFX(leftoverCount);
                showToast(`⚡ 完美清場！剩餘 ${leftoverCount} 發彈藥蓄能升級 +1！`);
                audio.playPowerup();
                this.ui_updateAmmoUI();
                this.ui_renderRecipeHUD();
                this.data_clearProjectiles();
            }
        }

        const playerTurnFinished = this.ammoQueue.length === 0 && 
                                   this.projectiles.length === 0 && 
                                   this.burstQueue.length === 0 &&
                           !this.isVisualEffectActive;

        if (playerTurnFinished && !this.gameOver) {
            // [in-wall-clear-lottery] 抽奖暂停期间禁止启动敌人回合，等待玩家关闭老虎机覆盖层
            if (this._inWallClearLotteryActive) return;
            // [回合开始横幅保护] 横幅期间不触发敌人行动，避免与上一回合结束时的敌人行动重复
            if (this._roundStartBannerActive) return;
            if (this._roundStartRelicHookDelayActive) return;
            // [遗物/命运时刻保护] 遗物或命运时刻 overlay 显示期间，必须等待玩家选择完毕
            // 否则会在 phase_finalizeRound 调用 sys_startRoundStartResolver 后立刻再次触发
            // phase_enemy_startLogic（因为 isEnemyTurn 已被置 false 且 ammoQueue 为空），
            // 表现为：遗物卡片弹出时背景中敌人继续行动、进入下一回合。
            // [BUGFIX tsk-agnet-stage] 不再使用 `pendingRoundStartRewards.length > 0` 作为守卫——该
            // 队列在「敌人战斗中掉落遗物/精华」时立刻被填充，但此时本回合的敌人回合尚未进行，
            // 加该守卫会让玩家在第 2/3 回合打完所有子弹后无法进入敌人回合。
            // 替代方案：`_roundStartResolverActive` 现已覆盖 loot 飞行动画期间（见
            // sys_startRoundStartResolver 的 relic 分支修复），余下的 overlay 显示阶段由下面的
            // `#phase-relic.active-phase` 检测；精华路径会切换到 selection 阶段，phase_combat_update
            // 不会再被调用，因此无需额外守卫。
            if (this._roundStartResolverActive) return;
            const _relicOverlay = document.getElementById('phase-relic');
            if (_relicOverlay && _relicOverlay.classList.contains('active-phase')) return;
            // 试炼场模式下，不自动进入敌人回合
            if (this.phase === 'training') {
                if (this.isEnemyTurn) {
                    if (this.enemyWaveActive) return;
                    if (anyEnemyMoving) {
                        this.enemyTurnTimer = 0; 
                        return;
                    }
                    this.enemyTurnTimer += this.timeScale;
                    if (this.enemyTurnTimer > 60) { 
                        this.isEnemyTurn = false;
                        this.enemyTurnTimer = 0;
                        this.enemies.forEach(e => e.hasActedThisTurn = false);
                        return;
                    }
                }
                return;
            }

            if (!this.isEnemyTurn) {
                this.phase_enemy_startLogic();
            } else {
                if (this.enemyWaveActive) return;
                if (anyEnemyMoving) {
                    this.enemyTurnTimer = 0; 
                    return;
                }
                this.enemyTurnTimer += this.timeScale;
                if (this.enemyTurnTimer > 60) { 
                    if (this.phase === 'training') {
                        // 试炼场不进入下一阶段，只重置敌人回合状态
                        this.isEnemyTurn = false;
                        this.enemyTurnTimer = 0;
                        this.enemies.forEach(e => e.hasActedThisTurn = false);
                    } else {
                        // [敌人动作后领取符文] 先领取待入库符文（飞入背包动画），再进入回合结算
                        // 使用 _runeClaimPending 标志防止重复触发
                        if (!this._runeClaimPending) {
                            this._runeClaimPending = true;
                            this.phase_claimPendingRunes();
                            // 延迟 600ms 让符文飞入动画播放完毕，再进入回合结算
                            setTimeout(() => {
                                this._runeClaimPending = false;
                                this.phase_finalizeRound();
                            }, 600);
                        }
                    }
                    return;
                }
            }
            return;
        }

        if (this.ammoQueue.length === 0 && this.projectiles.length === 0 && this.burstQueue.length === 0 && !this.gameOver) { 
            // 回合结束：先合并相交风暴核心，再衰减能量
            this.combat_wind_mergeStormCores();
            this.combat_wind_decayStormCoresEnergy();
            // @section:combat_update_phase_end - 战斗结束条件检查与阶段切换
            document.getElementById('combat-message').innerHTML = '<div class="bg-black/50 p-4 rounded-xl backdrop-blur-md border border-blue-500/50 pointer-events-none"><span class="text-blue-300 font-bold text-xl block mb-2">彈藥耗盡</span><span class="text-sm text-slate-300">點擊收集新彈药</span></div>'; 
        } else { 
            if (!this.gameOver) document.getElementById('combat-message').innerHTML = ''; 
        }
        // --- 修改开始：调整层级，先画轨道，再画炮台 ---
        this.ctx.save();
        // 应用与实体层相同的视差偏移
        this.ctx.translate(entityShiftX, entityShiftY);

        // [emitter-port] startPos = 发射器底座视觉中心；portPos = 实际发射口（沿素材上沿）
        const startPos = new Vec2(this.width / 2, this.height - 80);
        const portPos = new Vec2(startPos.x, startPos.y - EMITTER_PORT_OFFSET_Y);
        // [bitmap-emitter] 优先使用 emitter_base.png + emitter_charging_*.png 渲染发射器底座；
        // 位图未加载时 fallback 到原始 arc 椭圆。
        this.render_combat_launcherEmitterBase(this.ctx, startPos.x, startPos.y, this.isChargingShot, this.chargeProgress, this.isReloading ? this.reloadProgress : 0);
        let nextAmmo = this.ammoQueue.length > 0 ? this.ammoQueue[0] : null;

        if (nextAmmo) {
            const params = Projectile.calculateVisualParams(nextAmmo, false);
            let previewRotation =  -Math.PI / 2;
            let deformation = {x: 1, y: 1};

            if (this.isDragging) {
                const aimVector = this.dragCurrent.sub(this.dragStart);
                if (aimVector.mag() > 10) {
                    previewRotation = Math.atan2(aimVector.y, aimVector.x) ;
                    deformation = {x: 1.15, y: 0.85};
                }
            }
            if (this.isChargingShot) {
                const shake = Math.random() * 2; // 吸收时的剧烈抖动
                portPos.x += (Math.random()-0.5) * shake;
                portPos.y += (Math.random()-0.5) * shake;
                // 核心随着能量吸收变大变亮
                const absorbScale = 1.0 + this.chargeProgress * 0.3;
                deformation.x *= absorbScale;
                deformation.y *= absorbScale;
            }

            // 轨道仍以发射器底座为圆心绕飞
            this.render_combat_launcherOrbitals(this.ctx, startPos.x, startPos.y, nextAmmo);
            this.render_combat_launcherSignal(this.ctx, startPos.x, startPos.y, portPos.x, portPos.y, nextAmmo, {
                previewRotation,
                deformation,
                params,
                chargeProgress: this.chargeProgress,
                reloadProgress: this.isReloading ? this.reloadProgress : 0,
                isCharging: this.isChargingShot,
                isReloading: this.isReloading,
            });

        } else {
            // 空仓状态：占位圈贴在发射口
            this.ctx.fillStyle = '#1e293b';
            this.ctx.beginPath();
            this.ctx.arc(portPos.x, portPos.y, 10, 0, Math.PI * 2);
            this.ctx.fill();
            this.ctx.strokeStyle = '#475569';
            this.ctx.stroke();
        }
        this.ctx.restore();

        // --- [新增] 手机偏移提示强化：绘制边缘泛光 ---
        this.drawTiltVignette(this.ctx, this.boardTilt.current);
        // [移除] 删除底部倾斜指示条调用，设计上不够简洁且在战斗阶段会被结算 UI 遮挡
        // this.drawTiltIndicator(this.ctx, this.boardTilt.current);
        
    },

/**
     * @method attemptCompleteGatheringTurn
     * @description 尝试完成收集回合。修复了最后一个能量球导致无法结算的BUG。
     */
    phase_gathering_attemptComplete() {
        if (this.isWheelSpinning) return;
        if (this.triangleSideWheels && this.triangleSideWheels.some(w => w.spinning)) return;

        const activeOrbsCount = this.energyOrbs.filter(orb => orb.active).length;
        const sessions = Array.isArray(this.gatheringSessions) && this.gatheringSessions.length > 0
            ? this.gatheringSessions
            : (this.currentSession ? [this.currentSession] : []);

        if (
            this.dropBalls.length > 0 ||
            activeOrbsCount > 0 ||
            sessions.some(session => session && session.activeBalls > 0)
        ) {
            return;
        }

        const pendingSessions = sessions.filter(session => session && !session.isFinished);
        if (pendingSessions.length === 0) return;

        pendingSessions.forEach(session => {
            session.isFinished = true;
            const marbleIndex = Number.isInteger(session.marbleIndex) ? session.marbleIndex : this.activeMarbleIndex;
            const marbleDef = this.marbleQueue[marbleIndex] || session.marbleDef;
            if (!marbleDef) return;

            marbleDef.collected = [...session.collected]
                .filter(item => !(item && typeof item === 'object' && item.source === 'rune_slot'));

            const totalMulticast = 1 + session.multicast;
            if (totalMulticast > 0) {
                const previousActive = this.activeMarbleIndex;
                this.activeMarbleIndex = marbleIndex;
                this.combat_playMulticastTransferEffect(totalMulticast);
                this.activeMarbleIndex = previousActive;
            }

            const recipe = this.calc_compileCollectionToRecipe(marbleDef, session.collected, session.multicast > 0);
            recipe.finalHits = session.totalHits;
            recipe.multicast = session.multicast;
            recipe._marbleIndex = marbleIndex;
            this.ammoQueue.push(recipe);

            marbleDef.multicast = session.multicast;
            marbleDef.finalHits = session.totalHits;
        });

        this.activeMarbleIndex = this.marbleQueue.length;
        this.ui_updateGatheringQueueUI();
        this.pegs.forEach(p => p.resetCooldown());
        this.currentSession = null;
        this.gatheringSessions = [];

        if (this.ammoQueue.length === 0) return;

        if (this._chargedAmmoQueue && this._chargedAmmoQueue.length > 0) {
            setTimeout(() => {
                if (typeof this.sys_initReplaceAmmoPhase === 'function') {
                    this.sys_initReplaceAmmoPhase();
                } else {
                    this.phase_startCombatPhase();
                }
            }, 500);
        } else {
            setTimeout(() => this.phase_startCombatPhase(), 500);
        }
    },
    
// Gathering Phase Update
    /**
     * @method updateGathering
     * @description 收集階段的遊戲邏輯更新。
     * @param {number} [timeScale=1] - **重要參數** 時間縮放因子。
     */
    // @section:gathering_update_balls - 弹珠物理更新与碰撞处理
    phase_gathering_update(timeScale = 1) {
        // [修复] 确保 Canvas 状态干净
        this.ctx.save();
        this.ctx.globalAlpha = 1.0;
        this.ctx.globalCompositeOperation = 'source-over';
        this.ctx.shadowBlur = 0;
        this.ctx.shadowColor = 'transparent';

        // [修复] 移除 DOM 依赖的检查。如果遗物界面打开，phase 应该已经被切换到 'relic'
        // 并且主循环 (sys_loop) 会根据 phase 决定是否调用此函数。
        // 额外的 DOM 检查可能导致状态不同步。

        const tilt = this.boardTilt.current;


        const container = document.getElementById('game-container');
        if (container) {
            // 1. 设置透视距离，值越小 3D 感越强
            container.style.perspective = "1200px"; 
            
            // 2. 根据倾斜值旋转容器
            // rotateX 对应上下倾斜 (tilt.y)，rotateY 对应左右倾斜 (tilt.x)
            // 乘以 5 或 8 增加旋转角度的体感
            const rotateX = tilt.y * -8; 
            const rotateY = tilt.x * 8;
            const translateZ = -20; // 稍微向后退一点，防止边缘穿模

            container.style.transform = `rotateX(${rotateX}deg) rotateY(${rotateY}deg) translateZ(${translateZ}px)`;
            container.style.transition = "transform 0.1s ease-out"; // 平滑动画
        } else {
            console.warn("[DEBUG] phase_gathering_update: 未找到 game-container");
        }
        // 模拟板子边缘受光不均
        const grad = this.ctx.createRadialGradient(
            this.width / 2 + (tilt.x * 100), // 光心随倾斜移动
            this.height / 2 + (tilt.y * 100),
            this.width * 0.2,
            this.width / 2,
            this.height / 2,
            this.width * 0.8
        );
        grad.addColorStop(0, 'rgba(30, 41, 59, 0)');
        grad.addColorStop(1, `rgba(2, 6, 23, ${0.3 + Math.abs(tilt.x) * 0.2})`); // 倾斜越大边缘越暗

        this.ctx.fillStyle = grad;
        this.ctx.fillRect(0, 0, this.width, this.height);

        // [DEBUG] 确认渲染流程执行到此处

        // --- [新增] 绘制转盘 (在阴影和钉子之前) ---
        if (this.fortuneWheel.active) {
            this.fortuneWheel.update(timeScale);
            this.fortuneWheel.draw(this.ctx);
        }

        // --- [triangle 布局专属] 绘制底部侧边倍率转盘 ---
        if (this.triangleSideWheels && this.triangleSideWheels.length > 0) {
            for (const wheel of this.triangleSideWheels) {
                wheel.update(timeScale);
                wheel.draw(this.ctx);
            }
        }
        // 2.  计算动态光源位置
        // 假设光源在屏幕上方很远的地方。当板子向左倾斜 (tilt.x < 0) 时，
        // 阴影应该向左移动，或者说光源看起来像是在右边。
        // 这里的逻辑是：板子动，光不动 -> 相对运动
        const lightSourcePos = new Vec2(
            this.width / 2 - (tilt.x * 300), // X轴偏移：倾斜越大，光源相对位移越大
            -200 - (tilt.y * 100)            // Y轴偏移
        );
        const LIGHT_RADIUS = 150;
        const LIGHT_RADIUS_SQ = LIGHT_RADIUS * LIGHT_RADIUS;// 预计算平方，避免开根号
        // --- 绘制阴影 (传入动态光源) ---
        // DropBalls 发出的光
        this.dropBalls.forEach(ball => {
            if (!ball.active) return;
            this.pegs.forEach(p => {
                 // 这里是原有的小球光照阴影
                p.drawShadow(this.ctx, ball.pos, LIGHT_RADIUS);
            });
        });

        //  全局环境光阴影 (基于倾斜)
        // 让所有钉子都有一个基于板子倾斜的微弱基础阴影，增加立体感
        this.pegs.forEach(p => {
            // 我们利用 drawShadow 的逻辑，制造一个伪造的“太阳”
            p.drawShadow(this.ctx, lightSourcePos, 9999); // 半径很大，覆盖全屏
        });
        const lightSources = [...this.dropBalls];

        // --- 优化开始：只对范围内的钉子画阴影 ---
        lightSources.forEach(ball => {
            if (!ball.active) return;
            
            // 遍历所有钉子
            for (let i = 0; i < this.pegs.length; i++) {
                const p = this.pegs[i];
                // 简单的 AABB 预判或距离平方判断
                const dx = ball.pos.x - p.pos.x;
                // @section:gathering_update_slots - 槽位触发检测与属性收集
                const dy = ball.pos.y - p.pos.y;
                
                // 只有距离小于 LIGHT_RADIUS 时才绘制阴影
                // Math.abs 检查比乘法快，先做粗略筛选
                if (Math.abs(dx) < LIGHT_RADIUS && Math.abs(dy) < LIGHT_RADIUS) {
                    if ((dx*dx + dy*dy) < LIGHT_RADIUS_SQ) {
                        p.drawShadow(this.ctx, ball.pos, LIGHT_RADIUS);
                        p.calculateLight(ball.pos, LIGHT_RADIUS); // 光照计算也放这里
                    }
                }
            }
        });
        // 繪製釘子
        // [修复] 增加保底半径，防止 this.width 为 0 时钉子消失
        const pegRadius = Math.max(3.2, Math.min(5.6, CONFIG.physics.pegRadius || (this.width || 400) / 85));
        
        // [防御性检查] 如果钉子数组为空，尝试自动恢复
        if (this.pegs.length === 0) {
            console.warn("[DEBUG] 收集阶段钉子数组为空，尝试自动恢复...");
            this.phase_gathering_initPachinko();
        }

        drawBottomRewardZones(this.ctx, this.bottomRewardZones);

        this.pegs.forEach((p, idx) => { 
            p.update(); // 更新冷却和动画
            p.draw(this.ctx, pegRadius); 
            p.resetLight();
            
            // 调试日志：检查是否有槽位叠加在当前钉子上
            const hasSlot = this.specialSlots.some(s => s.pegIndex === idx);
            if (hasSlot && Math.random() < 0.01) {
                console.log(`[DEBUG] Rendering peg ${idx} with overlaid special slot at (${p.pos.x.toFixed(1)}, ${p.pos.y.toFixed(1)})`);
            }
        });

        
        lightSources.forEach(ball => {
            // 优化：只检查垂直距离接近的行，或者直接遍历所有 (钉子数量不多，直接遍历性能没问题)
            this.pegs.forEach(p => {
                // 简单的性能优化：如果Y轴距离太远就不用算平方根了
                if (Math.abs(ball.pos.y - p.pos.y) < LIGHT_RADIUS) {
                    p.calculateLight(ball.pos, LIGHT_RADIUS);
                }
            });
        });
        this.specialSlots = this.specialSlots.filter(s => !s.hit);
        // 繪製特殊槽位
        this.specialSlots.forEach(s => s.draw(this.ctx));

        // [v2 重构] 钉板编辑模式：在实时钉板上叠加可点击的虚框区域
        if (this._moduleEditorActive) {
            this.render_moduleEditorOverlay();
        }

        // --- [diamond 布局专属] 绘制裂变回响虚影钉子 ---
        if (this.ghostPegs && this.ghostPegs.length > 0) {
            for (let i = this.ghostPegs.length - 1; i >= 0; i--) {
                const gp = this.ghostPegs[i];
                gp.update(this.timeScale || 1);
                if (gp.active) {
                    gp.draw(this.ctx);
                } else {
                    this.ghostPegs.splice(i, 1);
                }
            }
        }

        // [修复] 结束收集阶段渲染，恢复 Canvas 状态
        this.ctx.restore();

        // --- 更新和绘制光柱 ---
        for (let i = this.collectionBeams.length - 1; i >= 0; i--) {
            const beam = this.collectionBeams[i];
            beam.update(timeScale);
            beam.draw(this.ctx);
            if (beam.life <= 0) this.collectionBeams.splice(i, 1);
        }
        // 更新和繪製下落的彈珠
        for (let i = this.dropBalls.length - 1; i >= 0; i--) {
            const ball = this.dropBalls[i];
            // **重要參數** result: 'finished' (落出屏幕), {type: 'collected', ...}, {type: 'slot', ...}, {action: 'split', ...}
            const result = ball.update(this.pegs, this.specialSlots, this.width, this.height, this.timeScale, tilt);
                
            //  绘制时也可以传入 tilt 做球体高光偏移 (可选)
            ball.draw(this.ctx, tilt);
            
            // --- [新增] 绘制球体牵徕线（仅在研磨阶段绘制）---
            if (ball.active && Math.abs(tilt.x) > 0.05) {
                const tiltStrength = Math.abs(tilt.x); // 0 ~ 1
                const lineAlpha = tiltStrength * 0.6;  // 透明度随倾斜增强
                const lineWidth = 1 + tiltStrength * 2; // 线宽随倾斜增强
                const dashLen = 6;
                const gapLen = 8;
                
                this.ctx.save();
                this.ctx.globalAlpha = lineAlpha;
                this.ctx.lineWidth = lineWidth;
                this.ctx.setLineDash([dashLen, gapLen]);
                this.ctx.lineDashOffset = -(Date.now() / 80) % (dashLen + gapLen); // 动态流动效果
                
                let edgeX, gradStart, gradEnd;
                if (tilt.x < 0) {
                    // 向左倾斜：牵徕线连到左边缘
                    edgeX = 0;
                    gradStart = this.ctx.createLinearGradient(ball.pos.x, ball.pos.y, edgeX, ball.pos.y);
                } else {
                    // @section:gathering_update_complete - 收集完成判断与结算触发
                    // 向右倾斜：牵徕线连到右边缘
                    edgeX = this.width;
                    gradStart = this.ctx.createLinearGradient(ball.pos.x, ball.pos.y, edgeX, ball.pos.y);
                }
                
                // 渐变颜色：球体中心为蓝紫色，边缘渐变透明
                gradStart.addColorStop(0, `rgba(139, 92, 246, ${lineAlpha})`);
                gradStart.addColorStop(0.5, `rgba(99, 102, 241, ${lineAlpha * 0.6})`);
                gradStart.addColorStop(1, 'rgba(99, 102, 241, 0)');
                
                this.ctx.strokeStyle = gradStart;
                this.ctx.shadowBlur = _sb(4 + tiltStrength * 6);
                this.ctx.shadowColor = 'rgba(139, 92, 246, 0.5)';
                
                this.ctx.beginPath();
                this.ctx.moveTo(ball.pos.x, ball.pos.y);
                this.ctx.lineTo(edgeX, ball.pos.y);
                this.ctx.stroke();
                
                this.ctx.restore();
            }
            
            if (result) {
                const session = ball.session || this.currentSession;
                const marbleIndex = session && Number.isInteger(session.marbleIndex)
                    ? session.marbleIndex
                    : this.activeMarbleIndex;
                const marbleDef = (this.marbleQueue && this.marbleQueue[marbleIndex]) || ball.def;
                // 處理彈珠落出屏幕
                if (result === 'finished') {
                    // 1. 生成光柱 (在球掉落的X轴位置，屏幕底部升起)
                    this.collectionBeams.push(new CollectionBeam(ball.pos.x, this.height));
                    
                    // 2. 触发 UI 卡片高亮
                    // 获取当前正在进行的配方卡片 DOM 元素
                    // 注意：nth-child 是从 1 开始的，activeMarbleIndex 是从 0 开始
                    const activeCardIdx = marbleIndex + 1;
                    const activeCard = document.querySelector(`#gathering-hud-mount .recipe-card:nth-child(${activeCardIdx})`);
                    
                    if (activeCard) {
                        // 先移除可能存在的类（以防万一），强制重绘，再添加
                        activeCard.classList.remove('locked-anim');
                        void activeCard.offsetWidth; // 触发 Reflow
                        activeCard.classList.add('locked-anim');
                    }

                    // 3. 播放一个确认音效 (比如 reload 或 magic)
                    audio.playCollect(); // 或者 audio.playTone(800, 'sine', 0.2)
                    // 弹珠落出屏幕
                    this.dropBalls.splice(i, 1);
                    if (session) session.activeBalls--;
                    
                    // --- ：不再直接結算，而是嘗試結算 ---
                    // 處理“能量球先落地，彈珠後死”的情況
                    this.phase_gathering_attemptComplete();

                } else if (result.type === 'collected') {
                    // 彈珠收集到材料
                    if (session) session.collected.push(result.material);
                    // 这样 UI (renderRecipeCard) 才能读取到变化
                    if (marbleDef) {
                        marbleDef.collected.push(result.material);
                    }
                    this.spawn_createHitFeedback(ball.pos.x, ball.pos.y, ball.vel, result.material, { session }); // 這裡也許要傳入屬性類型作為顏色依據
                    audio.playCollect();
                    this.ui_renderRecipeHUD();
                    
                } else if (result.type === 'reward_zone') {
                    this.spawn_createHitFeedback(ball.pos.x, ball.pos.y, ball.vel, result.material, { session });
                    audio.playCollect();
                    this.ui_renderRecipeHUD();
                    
                } else if (result.type === 'slot') {
                    // 彈珠擊中特殊槽位
                    if (result.slotType === 'recall') {
                        // 回溯槽位：將彈珠傳送回頂部
                        ball.pos.y = 50;
                        ball.vel = new Vec2(0, 2);
                        showToast("回溯!");
                    } else if (result.slotType === 'multicast') {
                        // 多重發射槽位：增加多重發射次數
                        if (session && !session.multicastAdded.includes(i)) {
                            session.multicast++;
                            session.multicastAdded.push(i);
                            showToast("+連射!");
                        }
                    } else if (result.slotType === 'split' && ball.canTriggerSplitSlot) {
                        // 分裂槽位：分裂彈珠
                        ball.canTriggerSplitSlot = false;
                        const newBall = new DropBall(ball.pos.x, ball.pos.y, ball.def, session);
                        newBall.vel = new Vec2(-ball.vel.x, ball.vel.y);
                        newBall.canTriggerSplitSlot = false;
                        this.dropBalls.push(newBall);
                        if (session) session.activeBalls++;
                        showToast("分裂!");
                    } else if (result.slotType === 'relic') {
                        // 調用遺物選擇
                        this.ui_showRelicSelection(); 
                        
                        // 將彈珠移除
                        this.dropBalls.splice(i, 1);
                        if (session) session.activeBalls--;
                    }
                } else if (result.action === 'split') {
                    // 處理 DropBall 內部觸發的分裂
                    const newBall1 = new DropBall(result.pos.x - 10, result.pos.y, result.def, session);
                    const newBall2 = new DropBall(result.pos.x + 10, result.pos.y, result.def, session);
                    newBall1.vel = new Vec2(-Math.abs(result.vel.x) - 2, result.vel.y);
                    newBall2.vel = new Vec2(Math.abs(result.vel.x) + 2, result.vel.y);
                    newBall1.canTriggerSplitSlot = false;
                    // @section:gathering_update_ui - 收集阶段 HUD 实时更新
                    newBall2.canTriggerSplitSlot = false;
                    this.dropBalls.push(newBall1, newBall2);
                    if (session) session.activeBalls += 1; 
                    this.dropBalls.splice(i, 1);
                    showToast("分裂!");
                } else if (result.action === 'mirror_clone') {
                    // [镜像裂分] 处理镜像轴线钉子触发的弹珠复制
                    // 复制弹珠：仅复制当前速度，不复制属性
                    // 分身弹珠的后续收集属性归入原弹珠（共享同一 session 实现）
                    const originalBall = result.originalBall;
                    // 创建分身弹珠：使用原弹珠的 def（属性定义）和 session（共享收集属性）
                    const cloneBall = new DropBall(result.mirrorX, result.pos.y, originalBall.def, session);
                    // 仅复制当前速度（水平分量取反，垂直分量相同）
                    cloneBall.vel = new Vec2(result.vel.x, result.vel.y);
                    // 分身弹珠不能再次触发镜像裂分，防止连锁增幅
                    cloneBall._mirrorAxisCooldown = 60; // 分身弹珠有更长冷却
                    cloneBall.canTriggerSplitSlot = false;
                    cloneBall.isMirrorClone = true; // 标记为镜像分身
                    this.dropBalls.push(cloneBall);
                    if (session) session.activeBalls++;
                    this.ui_renderRecipeHUD();

                } else if (result.action === 'rainbow_split') {
                    // 處理彩虹彈珠分裂
                    const colors = ['bounce', 'pierce', 'scatter'];
                    if (marbleDef) {
                        colors.forEach(c => {
                            marbleDef.collected.push(c);
                        });
                    }
                    colors.forEach((c, idx) => {
                        const shardDef = new MarbleDefinition(c);
                        const shard = new DropBall(result.pos.x + (idx - 1) * 20, result.pos.y, shardDef, session);
                        shard.vel = new Vec2((idx - 1) * 3, result.vel.y);
                        shard.isRainbowShard = true;
                        this.dropBalls.push(shard);

                        // --- [新增修复]：分裂时直接将对应的材料加入收集列表 ---
                        if (session) session.collected.push(c);
                    });
                    
                    if (session) session.activeBalls += 2; // -1 (本体) + 3 (碎片) = +2
                    this.dropBalls.splice(i, 1);
                    
                    // --- [新增修复]：刷新 UI 以显示新收集到的材料 ---
                    this.ui_renderRecipeHUD();
                    
                    showToast("彩虹分裂!");
                }
            }
        } 
        
        // --- 更新和繪製能量球 ---
        for (let i = this.energyOrbs.length - 1; i >= 0; i--) {
            const orb = this.energyOrbs[i];
            orb.update(timeScale);
            orb.draw(this.ctx);
            if (!orb.active) this.energyOrbs.splice(i, 1);
        }
        // 繪製粒子（两指针原地压缩，归还对象池；同步 particleCounts）
        {
            const arr = this.particles;
            const counts = this.particleCounts;
            const pool = this._particlePool;
            let w = 0;
            for (let r = 0; r < arr.length; r++) {
                const p = arr[r];
                if (!p) continue;
                p.update(this.timeScale);
                p.draw(this.ctx);
                if (p.life > 0) {
                    if (w !== r) arr[w] = p;
                    w++;
                } else {
                    if (counts[p.mode] !== undefined && counts[p.mode] > 0) counts[p.mode]--;
                    if (pool.length < 200 && typeof p.reset === 'function') pool.push(p);
                }
            }
            arr.length = w;
        }
        // 更新和繪製 Shockwaves
        for (let i = this.shockwaves.length - 1; i >= 0; i--) {
            let s = this.shockwaves[i];
            if (s) {
                s.update(timeScale);
                s.draw(this.ctx);
                if (s.alpha <= 0) this.shockwaves.splice(i, 1);
            }
        }
        // [注意] 研磨阶段的 container 3D 变换已在函数头部设置，此处不再重复设置（避免覆盖主要的 3D 旋转特效）
        // 之前的代码已在头部设置了正确的 rotateX/rotateY 特效

        // --- [新增] 手机偏移提示强化：绘制边缘泛光 ---
        this.drawTiltVignette(this.ctx, this.boardTilt.current);

        // --- [概率分析] 绘制落点热力图 ---
        // 只在没有弹珠正在运动时显示，避免干扰视觉
        if (this.dropBalls.length === 0 && this._heatmapData) {
            this._drawDropHeatmap(this.ctx);
        }

    },

    /**
     * [概率分析] 更新落点分布缓存
     * 在弹珠发射时调用，计算当前布局的落点概率分布
     *
     * @param {number} entryX - 弹珠入射 X 坐标
     */
    _updateDropDistribution(entryX) {
        const rows = this.currentRows || CONFIG.gameplay.rows;
        const cols = CONFIG.gameplay.cols || 10;
        const layout = this.currentLayout || 'default';
        const tiltBias = this.boardTilt ? this.boardTilt.current.x : 0;

        // 计算基础分布（基于当前布局和倾斜）
        const baseDistrib = calcDropDistribution(rows, cols, layout, tiltBias);

        // 根据入射位置修正分布
        this._dropDistribution = adjustDistributionForEntry(entryX, this.width, baseDistrib);

        // 生成热力图数据
        const boardBottomY = this.boardBottomY || (this.height * 0.7);
        this._heatmapData = generateHeatmapData(
            this._dropDistribution,
            this.width,
            boardBottomY,
            this.height,
            layout
        );
    },

    /**
     * [概率分析] 绘制落点热力图
     * 在钉盘底部显示概率分布可视化
     *
     * @param {CanvasRenderingContext2D} ctx
     */
    _drawDropHeatmap(ctx) {
        if (!this._heatmapData || this._heatmapData.length === 0) return;

        const layout = this.currentLayout || 'default';
        const hints = getAllLayoutHints();
        const hint = hints[layout] || hints.default;

        ctx.save();

        // 绘制分布柱状图
        for (const bar of this._heatmapData) {
            if (bar.height < 1) continue;

            // 渐变颜色：从底部向上渐变
            const grad = ctx.createLinearGradient(bar.x, bar.y + bar.height, bar.x, bar.y);
            grad.addColorStop(0, `${hint.color}00`);  // 底部透明
            grad.addColorStop(0.4, `${hint.color}${Math.round(bar.alpha * 0.6 * 255).toString(16).padStart(2, '0')}`);
            grad.addColorStop(1, `${hint.color}${Math.round(bar.alpha * 255).toString(16).padStart(2, '0')}`);

            ctx.fillStyle = grad;
            ctx.fillRect(bar.x, bar.y, bar.width, bar.height);

            // 高概率槽位添加光晕效果
            if (bar.alpha > 0.5) {
                ctx.shadowBlur = _sb(8);
                ctx.shadowColor = hint.color;
                ctx.fillStyle = `${hint.color}${Math.round(bar.alpha * 0.3 * 255).toString(16).padStart(2, '0')}`;
                ctx.fillRect(bar.x, bar.y, bar.width, 2);
                ctx.shadowBlur = 0;
            }
        }

        // 绘制布局分布特征标签
        const boardBottomY = this.boardBottomY || (this.height * 0.7);
        const labelY = boardBottomY + 8;
        ctx.font = '10px monospace';
        ctx.textAlign = 'center';
        ctx.fillStyle = `${hint.color}99`;
        ctx.fillText(hint.hint, this.width / 2, labelY);

        ctx.restore();
    },

    /**
     * 判断敌人是否处于"可被子弹击中"的可清场区域。
     * 顶部两排（row 0 / row 1）位于顶部墙的死角内，子弹无法触及，
     * 因此不应参与「围墙清空」判定（包括完美清场、in-wall 清场抽奖等）。
     *
     * 多行敌人（gridRows ≥ 2）只要有任一格延伸到 row 2 及以下，即视为可清场。
     *
     * @param {Object} e - 敌人对象（具有 pos.y / height / gridRows 字段）
     * @returns {boolean} 该敌人是否参与清场判定
     */
    phase_isEnemyClearable(e) {
        if (!e) return false;
        const eh = this.enemyHeight || 40;
        const topY = (typeof this.combatGridTopY === 'number') ? this.combatGridTopY : 90;
        // row 2 的上边界 = combatGridTopY + 1.5 × enemyHeight
        const row2TopEdge = topY + 1.5 * eh;
        const rows = e.gridRows || 1;
        const heightPx = (rows > 1) ? rows * eh : (e.height || eh);
        const bottomEdge = e.pos.y + heightPx / 2;
        // 留 1px 容差避免浮点误差
        return bottomEdge > row2TopEdge + 1;
    },
};
