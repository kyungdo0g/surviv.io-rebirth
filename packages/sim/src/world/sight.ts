// Line of sight on one floor: the rule explosions use (combat/explosions.ts), a collidable obstacle taller than 0.5
// (walls, closed doors, trees, not crates) stops it. The rebirth's flashbang (combat/flash.ts) and the Molotov's fire
// (world/fires.ts) read it so neither reaches through a wall.
import { collider, type Vec2 } from "@rebirth/core";
import { type Entity, sameLayer, type World } from "./world.ts";

/** A collidable obstacle taller than this blocks the sight line (explosions.ts BLOCK_HEIGHT). */
export const SIGHT_BLOCK_HEIGHT = 0.5;

/** Whether nothing blocks the segment `a` -> `b` on `layer`. */
export function clearSight(world: World, a: Vec2, b: Vec2, layer: number, scratch: Entity[] = []): boolean {
    for (const obj of world.querySegment(a, b, scratch)) {
        if (obj.kind !== "obstacle" || obj.dead || !obj.collidable || obj.height <= SIGHT_BLOCK_HEIGHT) continue;
        if (!sameLayer(obj.layer, layer)) continue;
        // an obstacle the start point sits in (the grenade landed against a wall) does not hide the far side
        if (collider.intersect(obj.collider, collider.createCircle(a, 0.01))) continue;
        if (collider.intersectSegment(obj.collider, a, b)) return false;
    }
    return true;
}
