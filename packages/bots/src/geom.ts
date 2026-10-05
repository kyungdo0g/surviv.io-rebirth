// Small geometry helpers shared by perception, navigation and the brain: map object colliders rebuilt from their defs
// (quarter-turn transforms, like the simulation), segment tests and angle arithmetic.
import { type Bounds, type Collider, collider, type Vec2, v2 } from "@rebirth/core";
import { getMapObjectDef, hasMapObjectDef, type ObstacleDef } from "@rebirth/defs";

/** `v` rotated by `ori` quarter turns counter-clockwise (map objects only rotate in 90 degree steps). */
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

/** Scales, rotates by `ori` quarter turns, then translates a def collider (AABBs stay exact). */
export function transformCollider(col: Collider, pos: Vec2, ori: number, scale: number): Collider {
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

export function colliderBounds(col: Collider): Bounds {
    if (col.type === 1) return { min: v2.copy(col.min), max: v2.copy(col.max) };
    return {
        min: { x: col.pos.x - col.rad, y: col.pos.y - col.rad },
        max: { x: col.pos.x + col.rad, y: col.pos.y + col.rad },
    };
}

/** Obstacle def by type, or undefined for unknown ids and other map object kinds. */
export function obstacleDef(type: string): ObstacleDef | undefined {
    if (!hasMapObjectDef(type)) return undefined;
    const def = getMapObjectDef(type);
    return def.type === "obstacle" ? def : undefined;
}

/** World collider of an obstacle at `pos`/`ori`/`scale`. */
export function obstacleCollider(def: ObstacleDef, pos: Vec2, ori: number, scale: number): Collider {
    return transformCollider(def.collision, pos, ori, scale);
}

/** Whether the segment a -> b touches `col`. */
export function segmentHits(col: Collider, a: Vec2, b: Vec2): boolean {
    return collider.intersectSegment(col, a, b) !== null;
}

/** Centre of a collider. */
export function colliderCenter(col: Collider): Vec2 {
    return col.type === 0 ? v2.copy(col.pos) : { x: (col.min.x + col.max.x) / 2, y: (col.min.y + col.max.y) / 2 };
}

/** Rough radius of a collider (circle radius, or half the box diagonal). */
export function colliderRadius(col: Collider): number {
    if (col.type === 0) return col.rad;
    return Math.hypot(col.max.x - col.min.x, col.max.y - col.min.y) / 2;
}

/** Distance from a point to a collider's surface (0 inside). */
export function distanceToCollider(p: Vec2, col: Collider): number {
    if (col.type === 0) return Math.max(0, v2.distance(p, col.pos) - col.rad);
    const dx = Math.max(col.min.x - p.x, 0, p.x - col.max.x);
    const dy = Math.max(col.min.y - p.y, 0, p.y - col.max.y);
    return Math.hypot(dx, dy);
}

export function pointInBounds(p: Vec2, b: Bounds): boolean {
    return p.x >= b.min.x && p.x <= b.max.x && p.y >= b.min.y && p.y <= b.max.y;
}

/** Signed smallest difference b - a between two angles, in (-PI, PI]. */
export function angleDelta(a: number, b: number): number {
    let d = (b - a) % (Math.PI * 2);
    if (d > Math.PI) d -= Math.PI * 2;
    if (d <= -Math.PI) d += Math.PI * 2;
    return d;
}

export function dirOf(angle: number): Vec2 {
    return { x: Math.cos(angle), y: Math.sin(angle) };
}

export function angleOf(v: Vec2): number {
    return Math.atan2(v.y, v.x);
}

/** Distance from point p to the segment a -> b. */
export function distToSegment(p: Vec2, a: Vec2, b: Vec2): number {
    const ab = v2.sub(b, a);
    const len2 = v2.lengthSqr(ab);
    const t = len2 > 0 ? Math.min(1, Math.max(0, v2.dot(v2.sub(p, a), ab) / len2)) : 0;
    return v2.distance(p, v2.add(a, v2.mul(ab, t)));
}
