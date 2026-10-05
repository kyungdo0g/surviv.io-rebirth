// Uniform Catmull-Rom spline through a list of points, used for river centre lines.
// Behaviour follows survev shared/utils/spline.ts (control point selection, closest-point refinement).
import { type Vec2, v2 } from "@rebirth/core";
import { distToSegmentSq } from "./polygon.ts";

interface ControlPoints {
    pt: number;
    p0: Vec2;
    p1: Vec2;
    p2: Vec2;
    p3: Vec2;
}

/**
 * Segment and local parameter for `t` in [0, 1]. Looped splines assume the first and last points coincide.
 */
export function getControlPoints(t: number, points: readonly Vec2[], looped: boolean): ControlPoints {
    const count = points.length;
    let i1: number;
    let i0: number;
    let i2: number;
    let i3: number;
    if (looped) {
        t = t - Math.floor(t);
        const i = Math.trunc(t * (count - 1));
        i1 = i;
        i2 = (i1 + 1) % (count - 1);
        i0 = i1 > 0 ? i1 - 1 : count - 2;
        i3 = (i2 + 1) % (count - 1);
    } else {
        t = t < 0 ? 0 : t > 1 ? 1 : t;
        const i = Math.trunc(t * (count - 1));
        i1 = i === count - 1 ? i - 1 : i;
        i2 = i1 + 1;
        i0 = i1 > 0 ? i1 - 1 : i1;
        i3 = i2 < count - 1 ? i2 + 1 : i2;
    }
    return { pt: t * (count - 1) - i1, p0: points[i0], p1: points[i1], p2: points[i2], p3: points[i3] };
}

export function catmullRom(t: number, p0: number, p1: number, p2: number, p3: number): number {
    return (
        0.5 *
        (2 * p1 + t * (-p0 + p2) + t * t * (2 * p0 - 5 * p1 + 4 * p2 - p3) + t * t * t * (-p0 + 3 * p1 - 3 * p2 + p3))
    );
}

function catmullRomDerivative(t: number, p0: number, p1: number, p2: number, p3: number): number {
    return 0.5 * (-p0 + p2 + 2 * t * (2 * p0 - 5 * p1 + 4 * p2 - p3) + 3 * t * t * (-p0 + 3 * p1 - 3 * p2 + p3));
}

/** Point on the Catmull-Rom curve through `points` at `t` in [0, 1]. */
export function catmullRomPoint(t: number, points: readonly Vec2[], looped: boolean): Vec2 {
    const { pt, p0, p1, p2, p3 } = getControlPoints(t, points, looped);
    return { x: catmullRom(pt, p0.x, p1.x, p2.x, p3.x), y: catmullRom(pt, p0.y, p1.y, p2.y, p3.y) };
}

export class Spline {
    readonly points: Vec2[];
    readonly looped: boolean;

    constructor(points: readonly Vec2[], looped: boolean) {
        if (points.length < 2) {
            throw new RangeError("Spline needs at least two points");
        }
        this.points = points.map((p) => v2.copy(p));
        this.looped = looped;
    }

    getPos(t: number): Vec2 {
        return catmullRomPoint(t, this.points, this.looped);
    }

    getTangent(t: number): Vec2 {
        const { pt, p0, p1, p2, p3 } = getControlPoints(t, this.points, this.looped);
        return {
            x: catmullRomDerivative(pt, p0.x, p1.x, p2.x, p3.x),
            y: catmullRomDerivative(pt, p0.y, p1.y, p2.y, p3.y),
        };
    }

    /** Unit normal: the tangent rotated 90 degrees counter-clockwise. */
    getNormal(t: number): Vec2 {
        return v2.perp(v2.normalizeSafe(this.getTangent(t), { x: 1, y: 0 }));
    }

    /** Approximate spline parameter of the curve point closest to `pos`. */
    getClosestT(pos: Vec2): number {
        const pts = this.points;
        let closestDistSq = Infinity;
        let seg = 0;
        for (let i = 0; i < pts.length - 1; i++) {
            const d = distToSegmentSq(pos, pts[i], pts[i + 1]);
            if (d < closestDistSq) {
                closestDistSq = d;
                seg = i;
            }
        }
        const s0 = pts[seg];
        const s1 = pts[seg + 1];
        const segV = v2.sub(s1, s0);
        const segLenSq = v2.dot(segV, segV);
        let segT = segLenSq > 0 ? v2.dot(v2.sub(pos, s0), segV) / segLenSq : 0;
        segT = segT < 0 ? 0 : segT > 1 ? 1 : segT;
        const len = pts.length - 1;
        const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
        const tMin = clamp01((seg + segT - 0.1) / len);
        const tMax = clamp01((seg + segT + 0.1) / len);

        // Refine by sampling the curve around the closest segment point.
        let nearestT = (seg + segT) / len;
        let nearestDistSq = Infinity;
        const iterations = 8;
        for (let i = 0; i <= iterations; i++) {
            const testT = tMin + (tMax - tMin) * (i / iterations);
            const d = v2.distanceSqr(this.getPos(testT), pos);
            if (d < nearestDistSq) {
                nearestT = testT;
                nearestDistSq = d;
            }
        }

        // Then step along the tangent once.
        const tangent = this.getTangent(nearestT);
        const tanLen = v2.length(tangent);
        if (tanLen > 0) {
            const nearest = this.getPos(nearestT);
            const offset = v2.dot(tangent, v2.sub(pos, nearest)) / tanLen;
            const offsetT = nearestT + offset / (tanLen * len);
            if (v2.distanceSqr(pos, this.getPos(offsetT)) < v2.distanceSqr(pos, nearest)) {
                nearestT = offsetT;
            }
        }
        return nearestT;
    }
}
