// Polygon and segment helpers used by terrain generation and terrain queries.
import type { Bounds, Vec2 } from "@rebirth/core";

/** Even-odd point-in-polygon test (boundary handling is unspecified). */
export function pointInPolygon(p: Vec2, poly: readonly Vec2[]): boolean {
    let inside = false;
    const n = poly.length;
    for (let i = 0, j = n - 1; i < n; j = i++) {
        const a = poly[i];
        const b = poly[j];
        if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) {
            inside = !inside;
        }
    }
    return inside;
}

/** Unsigned area (shoelace formula); equals the triangulated area for simple polygons. */
export function polygonArea(poly: readonly Vec2[]): number {
    let sum = 0;
    const n = poly.length;
    for (let i = 0, j = n - 1; i < n; j = i++) {
        sum += poly[j].x * poly[i].y - poly[i].x * poly[j].y;
    }
    return Math.abs(sum) * 0.5;
}

export function polygonBounds(poly: readonly Vec2[]): Bounds {
    const min = { x: Infinity, y: Infinity };
    const max = { x: -Infinity, y: -Infinity };
    for (const p of poly) {
        if (p.x < min.x) min.x = p.x;
        if (p.y < min.y) min.y = p.y;
        if (p.x > max.x) max.x = p.x;
        if (p.y > max.y) max.y = p.y;
    }
    return { min, max };
}

export function distToSegmentSq(p: Vec2, a: Vec2, b: Vec2): number {
    const abx = b.x - a.x;
    const aby = b.y - a.y;
    const lenSq = abx * abx + aby * aby;
    let t = lenSq > 0 ? ((p.x - a.x) * abx + (p.y - a.y) * aby) / lenSq : 0;
    t = t < 0 ? 0 : t > 1 ? 1 : t;
    const dx = a.x + abx * t - p.x;
    const dy = a.y + aby * t - p.y;
    return dx * dx + dy * dy;
}

function signedAreaTri(a: Vec2, b: Vec2, c: Vec2): number {
    return (a.x - c.x) * (b.y - c.y) - (a.y - c.y) * (b.x - c.x);
}

/** Proper crossing point of segments a0-a1 and b0-b1 (touching endpoints do not count). */
export function intersectSegmentSegment(a0: Vec2, a1: Vec2, b0: Vec2, b1: Vec2): Vec2 | null {
    const x1 = signedAreaTri(a0, a1, b1);
    const x2 = signedAreaTri(a0, a1, b0);
    if (x1 === 0 || x2 === 0 || x1 * x2 >= 0) {
        return null;
    }
    const x3 = signedAreaTri(b0, b1, a0);
    const x4 = x3 + x2 - x1;
    if (x3 * x4 >= 0) {
        return null;
    }
    const t = x3 / (x3 - x4);
    return { x: a0.x + (a1.x - a0.x) * t, y: a0.y + (a1.y - a0.y) * t };
}

/**
 * Smallest `t >= 0` such that `origin + dir * t` lies on an edge of `poly`, or undefined.
 * `dir` is not normalized, so `t` is in units of `dir`.
 */
export function rayPolygonIntersect(origin: Vec2, dir: Vec2, poly: readonly Vec2[]): number | undefined {
    let best = Infinity;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
        const a = poly[j];
        const b = poly[i];
        const sx = b.x - a.x;
        const sy = b.y - a.y;
        // perpendicular of the segment
        const px = sy;
        const py = -sx;
        const perpDotDir = dir.x * px + dir.y * py;
        if (Math.abs(perpDotDir) <= 1e-6) continue;
        const dx = a.x - origin.x;
        const dy = a.y - origin.y;
        const t = (px * dx + py * dy) / perpDotDir;
        const s = (dir.y * dx - dir.x * dy) / perpDotDir;
        if (t >= 0 && s >= 0 && s <= 1 && t < best) {
            best = t;
        }
    }
    return best === Infinity ? undefined : best;
}

/** Whether segment a-b touches the box (slab test). */
export function segmentIntersectsAabb(a: Vec2, b: Vec2, min: Vec2, max: Vec2): boolean {
    let tmin = 0;
    let tmax = 1;
    const d = { x: b.x - a.x, y: b.y - a.y };
    const axes: Array<"x" | "y"> = ["x", "y"];
    for (const k of axes) {
        if (Math.abs(d[k]) < 1e-9) {
            if (a[k] < min[k] || a[k] > max[k]) return false;
            continue;
        }
        let t1 = (min[k] - a[k]) / d[k];
        let t2 = (max[k] - a[k]) / d[k];
        if (t1 > t2) {
            const tmp = t1;
            t1 = t2;
            t2 = tmp;
        }
        if (t1 > tmin) tmin = t1;
        if (t2 < tmax) tmax = t2;
        if (tmin > tmax) return false;
    }
    return true;
}

/** Whether any polygon edge touches the box. */
export function aabbIntersectsPolygonEdges(min: Vec2, max: Vec2, poly: readonly Vec2[]): boolean {
    for (let i = 0; i < poly.length; i++) {
        const a = poly[i];
        const b = poly[i === poly.length - 1 ? 0 : i + 1];
        if (segmentIntersectsAabb(a, b, min, max)) return true;
    }
    return false;
}

/** Whether a box overlaps a polygon: a corner inside it or an edge crossing the box. */
export function aabbOverlapsPolygon(box: Bounds, poly: readonly Vec2[]): boolean {
    const { min, max } = box;
    const corners = [min, { x: max.x, y: min.y }, max, { x: min.x, y: max.y }];
    for (const c of corners) {
        if (pointInPolygon(c, poly)) return true;
    }
    return aabbIntersectsPolygonEdges(min, max, poly);
}

export function clampToBounds(p: Vec2, b: Bounds): Vec2 {
    return {
        x: p.x < b.min.x ? b.min.x : p.x > b.max.x ? b.max.x : p.x,
        y: p.y < b.min.y ? b.min.y : p.y > b.max.y ? b.max.y : p.y,
    };
}

export function pointInBounds(p: Vec2, b: Bounds): boolean {
    return p.x >= b.min.x && p.x <= b.max.x && p.y >= b.min.y && p.y <= b.max.y;
}

export function boundsInsideBounds(inner: Bounds, outer: Bounds): boolean {
    return (
        inner.min.x >= outer.min.x &&
        inner.min.y >= outer.min.y &&
        inner.max.x <= outer.max.x &&
        inner.max.y <= outer.max.y
    );
}
