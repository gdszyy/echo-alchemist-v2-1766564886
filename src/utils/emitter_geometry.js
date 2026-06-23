import { EMITTER_PORT_OFFSET_Y } from '../bitmap_icons.js';
import { Vec2 } from './math_utils.js';

const FALLBACK_AIM_DIR = new Vec2(0, -1);

function toVec2(value) {
    if (!value || !Number.isFinite(value.x) || !Number.isFinite(value.y)) return null;
    return value instanceof Vec2 ? value : new Vec2(value.x, value.y);
}

function normalizeAimVector(value) {
    const vec = toVec2(value);
    if (!vec || vec.mag() <= 0.001) return FALLBACK_AIM_DIR;
    return vec.norm();
}

export function calcCombatLauncherBase(width, height) {
    return new Vec2(width / 2, height - 80);
}

export function calcCombatLauncherGeometry(width, height, aimVector = null) {
    const base = calcCombatLauncherBase(width, height);
    const aimDir = normalizeAimVector(aimVector);
    const muzzle = base.add(aimDir.mult(EMITTER_PORT_OFFSET_Y));
    return {
        base,
        port: new Vec2(base.x, base.y),
        muzzle,
        aimDir,
        barrelLength: EMITTER_PORT_OFFSET_Y,
        aimRotation: Math.atan2(aimDir.y, aimDir.x),
    };
}

export function calcCombatLauncherGeometryToTarget(width, height, target) {
    const base = calcCombatLauncherBase(width, height);
    const targetVec = toVec2(target);
    const aimVector = targetVec ? targetVec.sub(base) : FALLBACK_AIM_DIR;
    return calcCombatLauncherGeometry(width, height, aimVector);
}
