// Screen geometry of the cursor: the original client sizes its camera so the zoom radius (LocalPlayerState.zoom, in
// world units) spans half of the larger screen dimension (survev client camera; apps/client/src/render/camera.ts), so
// on a 16:9 screen the cursor can reach `zoom` units sideways and zoom / (16/9) up or down. The cursor is kept on the
// screen, away from the player's centre, and below a safety cap on its angular speed.
import { type Vec2, v2 } from "@rebirth/core";
import { VIEW_ASPECT } from "@rebirth/sim";
import { angleDelta, angleOf, dirOf } from "../geom.ts";

/** Closest the cursor comes to the player's centre (world units). */
export const MIN_RADIUS = 0.5;

/** Half extents of the visible screen (world units) for a zoom radius. */
export function halfScreen(zoom: number): Vec2 {
    return { x: zoom, y: zoom / VIEW_ASPECT };
}

/** Distance from the player to the screen edge along `dir` (unit). */
export function screenEdge(zoom: number, dir: Vec2): number {
    const h = halfScreen(zoom);
    const ex = Math.abs(dir.x) > 1e-9 ? h.x / Math.abs(dir.x) : Number.POSITIVE_INFINITY;
    const ey = Math.abs(dir.y) > 1e-9 ? h.y / Math.abs(dir.y) : Number.POSITIVE_INFINITY;
    return Math.min(ex, ey);
}

/**
 * The cursor moved from `prev` to `c` in one substep: keep it at least MIN_RADIUS from the player, turn it at most
 * `maxStep` radians, and keep it on the screen (scaled along its ray, so the aim direction is kept).
 */
export function limitCursor(zoom: number, prev: Vec2, c: Vec2, maxStep: number): Vec2 {
    let out = c;
    let len = v2.length(out);
    if (len < MIN_RADIUS) {
        out = v2.mul(len > 1e-9 ? v2.div(out, len) : v2.normalizeSafe(prev), MIN_RADIUS);
        len = MIN_RADIUS;
    }
    const a0 = angleOf(prev);
    const da = angleDelta(a0, angleOf(out));
    if (Math.abs(da) > maxStep) out = v2.mul(dirOf(a0 + Math.sign(da) * maxStep), len);
    const h = halfScreen(zoom);
    const s = Math.min(1, h.x / Math.max(Math.abs(out.x), 1e-9), h.y / Math.max(Math.abs(out.y), 1e-9));
    return s < 1 ? v2.mul(out, s) : out;
}
