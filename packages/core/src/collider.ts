import { math } from "./math.ts";
import { type Vec2, v2 } from "./v2.ts";

/** Collider type tags, matching the original game's definition data. */
export const ColliderType = { Circle: 0, Aabb: 1 } as const;
export type ColliderType = (typeof ColliderType)[keyof typeof ColliderType];

export interface Circle {
    type: 0;
    pos: Vec2;
    rad: number;
}

export interface Aabb {
    type: 1;
    min: Vec2;
    max: Vec2;
}

export type Collider = Circle | Aabb;

/** Any axis-aligned box; `Aabb` colliders satisfy it structurally. */
export interface Bounds {
    min: Vec2;
    max: Vec2;
}

/** Contact result: move the first collider by `dir * pen` to separate it from the second. */
export interface Intersection {
    dir: Vec2;
    pen: number;
}

/** First surface hit along a ray; `normal` points back against the direction of travel. */
export interface RayHit {
    point: Vec2;
    normal: Vec2;
    dist: number;
}

const DIR_EPS = 1e-6;

function createCircle(pos: Vec2, rad: number): Circle {
    return { type: ColliderType.Circle, pos: v2.copy(pos), rad };
}

function createAabb(min: Vec2, max: Vec2): Aabb {
    return { type: ColliderType.Aabb, min: v2.copy(min), max: v2.copy(max) };
}

function createAabbExtents(center: Vec2, extents: Vec2): Aabb {
    return createAabb(v2.sub(center, extents), v2.add(center, extents));
}

function copy<T extends Collider>(col: T): T {
    return (col.type === ColliderType.Circle ? createCircle(col.pos, col.rad) : createAabb(col.min, col.max)) as T;
}

/**
 * Scales, then rotates (about the origin), then translates a collider. An AABB
 * becomes the bounding box of its transformed corners.
 */
function transform<T extends Collider>(col: T, pos: Vec2, rot: number, scale: number): T {
    if (col.type === ColliderType.Circle) {
        return createCircle(v2.add(v2.rotate(v2.mul(col.pos, scale), rot), pos), col.rad * scale) as T;
    }
    const corners = [col.min, { x: col.min.x, y: col.max.y }, { x: col.max.x, y: col.min.y }, col.max];
    const min = { x: Infinity, y: Infinity };
    const max = { x: -Infinity, y: -Infinity };
    for (const corner of corners) {
        const p = v2.rotate(v2.mul(corner, scale), rot);
        min.x = Math.min(min.x, p.x);
        min.y = Math.min(min.y, p.y);
        max.x = Math.max(max.x, p.x);
        max.y = Math.max(max.y, p.y);
    }
    return createAabb(v2.add(min, pos), v2.add(max, pos)) as T;
}

function toAabb(col: Collider): Aabb {
    if (col.type === ColliderType.Aabb) {
        return createAabb(col.min, col.max);
    }
    return createAabbExtents(col.pos, v2.create(col.rad));
}

/** Smallest AABB enclosing every collider in a non-empty list. */
function boundingAabb(list: readonly Collider[]): Aabb {
    if (list.length === 0) {
        throw new RangeError("boundingAabb: empty collider list");
    }
    const min = { x: Infinity, y: Infinity };
    const max = { x: -Infinity, y: -Infinity };
    for (const col of list) {
        const box = toAabb(col);
        min.x = Math.min(min.x, box.min.x);
        min.y = Math.min(min.y, box.min.y);
        max.x = Math.max(max.x, box.max.x);
        max.y = Math.max(max.y, box.max.y);
    }
    return createAabb(min, max);
}

/** Point containment, boundary inclusive. */
function contains(col: Collider, point: Vec2): boolean {
    if (col.type === ColliderType.Circle) {
        return v2.distanceSqr(point, col.pos) <= col.rad * col.rad;
    }
    return point.x >= col.min.x && point.x <= col.max.x && point.y >= col.min.y && point.y <= col.max.y;
}

/** Whether two boxes overlap or touch. */
function aabbOverlap(a: Bounds, b: Bounds): boolean {
    return a.min.x <= b.max.x && b.min.x <= a.max.x && a.min.y <= b.max.y && b.min.y <= a.max.y;
}

/** Negation that never produces -0, so axis-aligned results compare cleanly. */
function flip(a: Vec2): Vec2 {
    return { x: 0 - a.x, y: 0 - a.y };
}

function intersectCircleCircle(posA: Vec2, radA: number, posB: Vec2, radB: number): Intersection | null {
    const rad = radA + radB;
    const delta = v2.sub(posA, posB);
    const distSqr = v2.lengthSqr(delta);
    if (distSqr >= rad * rad) {
        return null;
    }
    const dist = Math.sqrt(distSqr);
    return {
        dir: dist > DIR_EPS ? v2.div(delta, dist) : v2.create(1, 0),
        pen: rad - dist,
    };
}

/** Pushes a circle out of a box, through the nearest face when the centre is inside it. */
function intersectCircleAabb(pos: Vec2, rad: number, min: Vec2, max: Vec2): Intersection | null {
    const inside = pos.x >= min.x && pos.x <= max.x && pos.y >= min.y && pos.y <= max.y;
    if (inside) {
        const faces = [
            { dist: pos.x - min.x, dir: v2.create(-1, 0) },
            { dist: max.x - pos.x, dir: v2.create(1, 0) },
            { dist: pos.y - min.y, dir: v2.create(0, -1) },
            { dist: max.y - pos.y, dir: v2.create(0, 1) },
        ];
        let nearest = faces[0];
        for (const face of faces) {
            if (face.dist < nearest.dist) {
                nearest = face;
            }
        }
        return { dir: nearest.dir, pen: nearest.dist + rad };
    }
    const closest = v2.create(math.clamp(pos.x, min.x, max.x), math.clamp(pos.y, min.y, max.y));
    const delta = v2.sub(pos, closest);
    const distSqr = v2.lengthSqr(delta);
    if (distSqr >= rad * rad) {
        return null;
    }
    const dist = Math.sqrt(distSqr);
    return {
        dir: dist > DIR_EPS ? v2.div(delta, dist) : v2.create(1, 0),
        pen: rad - dist,
    };
}

/** Separates along the axis of least penetration, away from `b`'s centre. */
function intersectAabbAabb(a: Bounds, b: Bounds): Intersection | null {
    const dx = (a.min.x + a.max.x - b.min.x - b.max.x) * 0.5;
    const dy = (a.min.y + a.max.y - b.min.y - b.max.y) * 0.5;
    const penX = (a.max.x - a.min.x + b.max.x - b.min.x) * 0.5 - Math.abs(dx);
    const penY = (a.max.y - a.min.y + b.max.y - b.min.y) * 0.5 - Math.abs(dy);
    if (penX <= 0 || penY <= 0) {
        return null;
    }
    if (penX <= penY) {
        return { dir: v2.create(dx < 0 ? -1 : 1, 0), pen: penX };
    }
    return { dir: v2.create(0, dy < 0 ? -1 : 1), pen: penY };
}

/** Overlap test between two colliders; see `Intersection` for the result convention. */
function intersect(a: Collider, b: Collider): Intersection | null {
    if (a.type === ColliderType.Circle) {
        return b.type === ColliderType.Circle
            ? intersectCircleCircle(a.pos, a.rad, b.pos, b.rad)
            : intersectCircleAabb(a.pos, a.rad, b.min, b.max);
    }
    if (b.type === ColliderType.Circle) {
        const res = intersectCircleAabb(b.pos, b.rad, a.min, a.max);
        return res && { dir: flip(res.dir), pen: res.pen };
    }
    return intersectAabbAabb(a, b);
}

/** Signed distance from a point to a box: negative inside (depth to the nearest face). */
function pointAabbDistance(p: Vec2, min: Vec2, max: Vec2): number {
    const dx = Math.max(min.x - p.x, p.x - max.x);
    const dy = Math.max(min.y - p.y, p.y - max.y);
    if (dx > 0 || dy > 0) {
        return Math.hypot(Math.max(dx, 0), Math.max(dy, 0));
    }
    return Math.max(dx, dy);
}

/** Signed gap between two collider surfaces; negative when overlapping (equals `-pen`). */
function distance(a: Collider, b: Collider): number {
    if (a.type === ColliderType.Circle) {
        return b.type === ColliderType.Circle
            ? v2.distance(a.pos, b.pos) - a.rad - b.rad
            : pointAabbDistance(a.pos, b.min, b.max) - a.rad;
    }
    if (b.type === ColliderType.Circle) {
        return pointAabbDistance(b.pos, a.min, a.max) - b.rad;
    }
    const dx = Math.max(a.min.x - b.max.x, b.min.x - a.max.x);
    const dy = Math.max(a.min.y - b.max.y, b.min.y - a.max.y);
    return dx > 0 && dy > 0 ? Math.hypot(dx, dy) : Math.max(dx, dy);
}

/** Hit at the ray origin, used when the ray starts inside the collider. */
function startInsideHit(origin: Vec2, dir: Vec2): RayHit {
    return { point: v2.copy(origin), normal: flip(dir), dist: 0 };
}

function raycastCircle(origin: Vec2, dir: Vec2, maxDist: number, pos: Vec2, rad: number): RayHit | null {
    const m = v2.sub(origin, pos);
    const b = v2.dot(m, dir);
    const c = v2.dot(m, m) - rad * rad;
    if (c < 0) {
        return startInsideHit(origin, dir);
    }
    if (b > 0) {
        return null;
    }
    const discSqr = b * b - c;
    if (discSqr < 0) {
        return null;
    }
    const t = -b - Math.sqrt(discSqr);
    if (t > maxDist) {
        return null;
    }
    const point = v2.add(origin, v2.mul(dir, t));
    return { point, normal: v2.normalizeSafe(v2.sub(point, pos), flip(dir)), dist: t };
}

/** Slab test; `dir` must be unit length. */
function raycastAabb(origin: Vec2, dir: Vec2, maxDist: number, min: Vec2, max: Vec2): RayHit | null {
    let tEnter = -Infinity;
    let tExit = Infinity;
    let normal = flip(dir);
    if (Math.abs(dir.x) < DIR_EPS) {
        if (origin.x < min.x || origin.x > max.x) {
            return null;
        }
    } else {
        const t1 = (min.x - origin.x) / dir.x;
        const t2 = (max.x - origin.x) / dir.x;
        tEnter = Math.min(t1, t2);
        tExit = Math.max(t1, t2);
        normal = v2.create(dir.x > 0 ? -1 : 1, 0);
    }
    if (Math.abs(dir.y) < DIR_EPS) {
        if (origin.y < min.y || origin.y > max.y) {
            return null;
        }
    } else {
        const t1 = (min.y - origin.y) / dir.y;
        const t2 = (max.y - origin.y) / dir.y;
        const tNear = Math.min(t1, t2);
        if (tNear > tEnter) {
            tEnter = tNear;
            normal = v2.create(0, dir.y > 0 ? -1 : 1);
        }
        tExit = Math.min(tExit, Math.max(t1, t2));
    }
    if (tEnter > tExit || tEnter > maxDist) {
        return null;
    }
    if (tEnter < 0) {
        // The origin is inside the box, unless the whole box lies behind it.
        return tExit > 0 ? startInsideHit(origin, dir) : null;
    }
    return { point: v2.add(origin, v2.mul(dir, tEnter)), normal, dist: tEnter };
}

/**
 * First hit of a ray within `maxDist`. `dir` need not be normalized; a zero
 * direction is treated as +x. A ray that starts inside the collider hits
 * immediately at its origin.
 */
function intersectRay(col: Collider, origin: Vec2, dir: Vec2, maxDist = Infinity): RayHit | null {
    const unit = v2.normalize(dir);
    return col.type === ColliderType.Circle
        ? raycastCircle(origin, unit, maxDist, col.pos, col.rad)
        : raycastAabb(origin, unit, maxDist, col.min, col.max);
}

/** First hit along the segment a -> b. */
function intersectSegment(col: Collider, a: Vec2, b: Vec2): RayHit | null {
    const delta = v2.sub(b, a);
    return intersectRay(col, a, delta, v2.length(delta));
}

export const collider = {
    Type: ColliderType,
    createCircle,
    createAabb,
    createAabbExtents,
    copy,
    transform,
    toAabb,
    boundingAabb,
    contains,
    intersect,
    intersectSegment,
    intersectRay,
    distance,
    aabbOverlap,
};
