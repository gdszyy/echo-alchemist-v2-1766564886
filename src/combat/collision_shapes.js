import { Vec2 } from '../utils/math_utils.js';

export function calc_getCirclePolygonCollision(circlePos, circleRadius, polygonVertices) {
    if (!polygonVertices || polygonVertices.length < 3) return null;

    let closestDistSq = Infinity;
    let bestHit = null;

    for (let i = 0; i < polygonVertices.length; i++) {
        const p1 = polygonVertices[i];
        const p2 = polygonVertices[(i + 1) % polygonVertices.length];

        const lineVecX = p2.x - p1.x;
        const lineVecY = p2.y - p1.y;
        const lineLenSq = lineVecX * lineVecX + lineVecY * lineVecY;

        if (lineLenSq === 0) continue;

        let t = ((circlePos.x - p1.x) * lineVecX + (circlePos.y - p1.y) * lineVecY) / lineLenSq;
        t = Math.max(0, Math.min(1, t));

        const closestX = p1.x + t * lineVecX;
        const closestY = p1.y + t * lineVecY;

        const dx = circlePos.x - closestX;
        const dy = circlePos.y - closestY;
        const distSq = dx * dx + dy * dy;

        if (distSq < closestDistSq) {
            closestDistSq = distSq;
            bestHit = { closestX, closestY, distSq, dx, dy, lineVecX, lineVecY, t };
        }
    }

    if (bestHit && bestHit.distSq < (circleRadius + 2) * (circleRadius + 2)) {
        let normal;
        if (bestHit.distSq === 0) {
            const len = Math.sqrt(bestHit.lineVecX * bestHit.lineVecX + bestHit.lineVecY * bestHit.lineVecY);
            normal = new Vec2(-bestHit.lineVecY / len, bestHit.lineVecX / len);
        } else {
            const dist = Math.sqrt(bestHit.distSq);
            normal = new Vec2(bestHit.dx / dist, bestHit.dy / dist);
        }
        return {
            closestX: bestHit.closestX,
            closestY: bestHit.closestY,
            distSq: bestHit.distSq,
            normal: normal
        };
    }
    
    let inside = false;
    for (let i = 0, j = polygonVertices.length - 1; i < polygonVertices.length; j = i++) {
        const xi = polygonVertices[i].x, yi = polygonVertices[i].y;
        const xj = polygonVertices[j].x, yj = polygonVertices[j].y;
        
        const intersect = ((yi > circlePos.y) !== (yj > circlePos.y))
            && (circlePos.x < (xj - xi) * (circlePos.y - yi) / (yj - yi) + xi);
        if (intersect) inside = !inside;
    }

    if (inside && bestHit) {
        const len = Math.sqrt(bestHit.lineVecX * bestHit.lineVecX + bestHit.lineVecY * bestHit.lineVecY);
        const normal = new Vec2(-bestHit.lineVecY / len, bestHit.lineVecX / len);
        return {
            closestX: bestHit.closestX,
            closestY: bestHit.closestY,
            distSq: 0,
            normal: normal
        };
    }

    return null;
}

export function calc_getCircleArcCollision(circlePos, circleRadius, arcCenter, arcRadius, arcStartAngle, arcEndAngle, arcThickness) {
    const dx = circlePos.x - arcCenter.x;
    const dy = circlePos.y - arcCenter.y;
    const distToCenter = Math.sqrt(dx * dx + dy * dy);

    const halfThick = arcThickness / 2;
    const hitRadius = circleRadius + halfThick + 2;
    if (distToCenter < arcRadius - hitRadius || distToCenter > arcRadius + hitRadius) {
        return null;
    }

    let angle = Math.atan2(dy, dx);
    
    const normalizeAngle = (a) => {
        let res = a % (Math.PI * 2);
        if (res < 0) res += Math.PI * 2;
        return res;
    };

    const normAngle = normalizeAngle(angle);
    const normStart = normalizeAngle(arcStartAngle);
    const normEnd = normalizeAngle(arcEndAngle);

    let inArc = false;
    if (normStart < normEnd) {
        inArc = normAngle >= normStart && normAngle <= normEnd;
    } else {
        inArc = normAngle >= normStart || normAngle <= normEnd;
    }

    let closestX, closestY;
    if (inArc) {
        closestX = arcCenter.x + Math.cos(angle) * arcRadius;
        closestY = arcCenter.y + Math.sin(angle) * arcRadius;
    } else {
        const startX = arcCenter.x + Math.cos(arcStartAngle) * arcRadius;
        const startY = arcCenter.y + Math.sin(arcStartAngle) * arcRadius;
        const endX = arcCenter.x + Math.cos(arcEndAngle) * arcRadius;
        const endY = arcCenter.y + Math.sin(arcEndAngle) * arcRadius;

        const distToStartSq = (circlePos.x - startX) * (circlePos.x - startX) + (circlePos.y - startY) * (circlePos.y - startY);
        const distToEndSq = (circlePos.x - endX) * (circlePos.x - endX) + (circlePos.y - endY) * (circlePos.y - endY);

        if (distToStartSq < distToEndSq) {
            closestX = startX;
            closestY = startY;
        } else {
            closestX = endX;
            closestY = endY;
        }
    }

    const distVecX = circlePos.x - closestX;
    const distVecY = circlePos.y - closestY;
    const distSq = distVecX * distVecX + distVecY * distVecY;

    const effectiveRadius = circleRadius + halfThick + 2;
    if (distSq < effectiveRadius * effectiveRadius) {
        const dist = Math.sqrt(distSq);
        let normal;
        if (dist === 0) {
            normal = new Vec2(Math.cos(angle), Math.sin(angle));
            if (distToCenter < arcRadius) normal = normal.mult(-1);
        } else {
            normal = new Vec2(distVecX / dist, distVecY / dist);
        }
        return { closestX, closestY, distSq, normal };
    }

    return null;
}
