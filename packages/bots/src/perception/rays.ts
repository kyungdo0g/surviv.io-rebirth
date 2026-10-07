// Line-of-fire geometry: a segment against an obstacle collider, and the rays a shot can take at a body (bot overhaul
// COMBAT-9: the centre-to-centre ray made a half-exposed body count as fully covered, so the bot waited for the centre
// to clear and then snapped; diagnosis round 1 issue 2 RC0 and fix concern 3). A shot leaves from the gun, off the
// player's centre by the gun's barrel offset (sim weapons/gun.ts gunPos), and may aim at the body's edge (radius 1).
import { type Collider, type Vec2, v2 } from "@rebirth/core";
import { distToSegment } from "../geom.ts";

/** Whether the segment a -> b touches `col` (circle, or AABB by a slab test). */
export function segmentHitsCollider(col: Collider, a: Vec2, b: Vec2): boolean {
    if (col.type === 0) return distToSegment(col.pos, a, b) <= col.rad;
    // quick reject on the bounding box
    const minX = Math.min(a.x, b.x);
    const maxX = Math.max(a.x, b.x);
    const minY = Math.min(a.y, b.y);
    const maxY = Math.max(a.y, b.y);
    if (maxX < col.min.x || minX > col.max.x || maxY < col.min.y || minY > col.max.y) return false;
    let t0 = 0;
    let t1 = 1;
    const d = { x: b.x - a.x, y: b.y - a.y };
    for (const axis of ["x", "y"] as const) {
        const da = d[axis];
        if (Math.abs(da) < 1e-9) {
            if (a[axis] < col.min[axis] || a[axis] > col.max[axis]) return false;
            continue;
        }
        let ta = (col.min[axis] - a[axis]) / da;
        let tb = (col.max[axis] - a[axis]) / da;
        if (ta > tb) [ta, tb] = [tb, ta];
        t0 = Math.max(t0, ta);
        t1 = Math.min(t1, tb);
        if (t0 > t1) return false;
    }
    return true;
}

/** How far off the body's centre the edge rays aim (a little inside the radius 1, so a hit lands on the body). */
export const EDGE_AIM = 0.7;
/** Edge rays test this far off the centre (the metric's body ray: 0.9 of the radius). */
const EDGE_TEST = 0.9;

/**
 * The point to aim at to hit a body at `to` from `from` past the obstacles `clear` judges: its centre when that ray is
 * clear, else the edge (EDGE_AIM off the centre, across the line) whose ray is clear, or null when the whole body is
 * covered. The edge test uses EDGE_TEST, the same body ray the fairness metric uses.
 */
export function bodyAimPoint(from: Vec2, to: Vec2, clear: (a: Vec2, b: Vec2) => boolean): Vec2 | null {
    if (clear(from, to)) return to;
    const side = v2.perp(v2.normalizeSafe(v2.sub(to, from)));
    for (const s of [1, -1]) {
        if (clear(from, v2.add(to, v2.mul(side, s * EDGE_TEST)))) return v2.add(to, v2.mul(side, s * EDGE_AIM));
    }
    return null;
}
