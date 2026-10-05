// Exact quarter-turn transforms for map object colliders. Map objects only rotate in 90 degree steps (ori 0-3,
// counter-clockwise), so swapping components avoids the rounding noise of cos/sin.
import { type Bounds, type Collider, collider, type Vec2 } from "@rebirth/core";

/** `v` rotated by `ori` quarter turns counter-clockwise. */
export function rotateOri(v: Vec2, ori: number): Vec2 {
    switch (((ori % 4) + 4) % 4) {
        case 1:
            return { x: -v.y, y: v.x };
        case 2:
            return { x: -v.x, y: -v.y };
        case 3:
            return { x: v.y, y: -v.x };
        default:
            return { x: v.x, y: v.y };
    }
}

/** Scales, rotates by `ori` quarter turns, then translates a collider (AABBs stay exact). */
export function transformOri(col: Collider, pos: Vec2, ori: number, scale: number): Collider {
    if (col.type === 0) {
        const p = rotateOri({ x: col.pos.x * scale, y: col.pos.y * scale }, ori);
        return { type: 0, pos: { x: p.x + pos.x, y: p.y + pos.y }, rad: col.rad * scale };
    }
    const a = rotateOri({ x: col.min.x * scale, y: col.min.y * scale }, ori);
    const b = rotateOri({ x: col.max.x * scale, y: col.max.y * scale }, ori);
    return {
        type: 1,
        min: { x: Math.min(a.x, b.x) + pos.x, y: Math.min(a.y, b.y) + pos.y },
        max: { x: Math.max(a.x, b.x) + pos.x, y: Math.max(a.y, b.y) + pos.y },
    };
}

/** Plain copy of a definition collider (drops extra fields such as `height`). */
export function cleanCollider(col: Collider): Collider {
    return col.type === 0
        ? { type: 0, pos: { x: col.pos.x, y: col.pos.y }, rad: col.rad }
        : { type: 1, min: { x: col.min.x, y: col.min.y }, max: { x: col.max.x, y: col.max.y } };
}

/** Scales a collider about its own centre. */
export function scaleAboutCenter(col: Collider, scale: number): Collider {
    if (col.type === 0) {
        return { type: 0, pos: { x: col.pos.x, y: col.pos.y }, rad: col.rad * scale };
    }
    const cx = (col.min.x + col.max.x) * 0.5;
    const cy = (col.min.y + col.max.y) * 0.5;
    const ex = (col.max.x - col.min.x) * 0.5 * scale;
    const ey = (col.max.y - col.min.y) * 0.5 * scale;
    return { type: 1, min: { x: cx - ex, y: cy - ey }, max: { x: cx + ex, y: cy + ey } };
}

/** Overlap test with strictly positive penetration (touching shapes do not overlap). */
export function overlaps(a: Collider, b: Collider): boolean {
    return collider.intersect(a, b) !== null;
}

export function toBounds(col: Collider): Bounds {
    if (col.type === 1) {
        return { min: { x: col.min.x, y: col.min.y }, max: { x: col.max.x, y: col.max.y } };
    }
    return {
        min: { x: col.pos.x - col.rad, y: col.pos.y - col.rad },
        max: { x: col.pos.x + col.rad, y: col.pos.y + col.rad },
    };
}

export function unionBounds(a: Bounds, b: Bounds): Bounds {
    return {
        min: { x: Math.min(a.min.x, b.min.x), y: Math.min(a.min.y, b.min.y) },
        max: { x: Math.max(a.max.x, b.max.x), y: Math.max(a.max.y, b.max.y) },
    };
}

export function boundsCorners(b: Bounds): Vec2[] {
    return [
        { x: b.min.x, y: b.min.y },
        { x: b.max.x, y: b.min.y },
        { x: b.max.x, y: b.max.y },
        { x: b.min.x, y: b.max.y },
    ];
}
