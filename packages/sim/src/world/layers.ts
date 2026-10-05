// Layers and stairs: objects walking over a structure's stairs switch between the ground (0) and the underground (1)
// floors through the "on stairs" layers 2 (upper half) and 3 (lower half). Players, thrown projectiles and loot use
// the same rule; `lootOnly` stairs (under bridges) only move loot.
// Behaviour follows survev server/src/game/objects/gameObject.ts (checkStairs, checkStructureStairs) and player.ts
// (aimLayer); docs/research/mechanics/doors-layers-ceilings.md "Stairs and layer transitions".
import { collider, math, type Vec2 } from "@rebirth/core";
import type { Stair } from "./entities.ts";
import type { Entity } from "./world.ts";

/** Result of a stairs check: the object's new layer and the stair it stands on (null when off every stair). */
export interface StairsResult {
    layer: number;
    stair: Stair | null;
}

/** Circle vs box overlap (survev coldet.testCircleAabb: centre inside counts, touching does not). */
function circleTouches(pos: Vec2, rad: number, min: Vec2, max: Vec2): boolean {
    const dx = pos.x - math.clamp(pos.x, min.x, max.x);
    const dy = pos.y - math.clamp(pos.y, min.y, max.y);
    return dx * dx + dy * dy < rad * rad || (dx === 0 && dy === 0);
}

/**
 * New layer of a circle at `pos` on `layer` among the broadphase objects `objs`. On a stair the object takes layer 3
 * when it overlaps only the lower half, 2 for the upper half, and the more penetrated half when it overlaps both;
 * off every stair, 2 becomes 0 and 3 becomes 1, so walking down moves 0 -> 2 -> 3 -> 1.
 */
export function checkStairs(
    pos: Vec2,
    rad: number,
    layer: number,
    objs: readonly Entity[],
    isLoot = false,
): StairsResult {
    let newLayer = layer;
    for (const obj of objs) {
        if (obj.kind !== "structure") continue;
        for (const stair of obj.stairs) {
            if (stair.lootOnly && !isLoot) continue;
            const c = stair.collision;
            if (!circleTouches(pos, rad, c.min, c.max)) continue;
            const circle = collider.createCircle(pos, rad);
            const down = collider.intersect(circle, { type: 1, min: stair.downAabb.min, max: stair.downAabb.max });
            const up = collider.intersect(circle, { type: 1, min: stair.upAabb.min, max: stair.upAabb.max });
            if (up && down) newLayer = up.pen > down.pen ? 2 : 3;
            else if (down) newLayer = 3;
            else if (up) newLayer = 2;
            return { layer: newLayer, stair };
        }
    }
    if (newLayer === 2) newLayer = 0;
    else if (newLayer === 3) newLayer = 1;
    return { layer: newLayer, stair: null };
}

/**
 * Layer of the bullets a player fires: on a stair, facing down the stairs (the facing's nearest quarter turn is the
 * stair's down orientation) shoots into the lower floor (3), facing up into the upper one (2), sideways on its own
 * layer (survev player.ts aimLayer).
 */
export function aimLayerOf(dir: Vec2, layer: number, stair: Stair | null): number {
    if (!stair) return layer;
    const ori = math.radToOri(Math.atan2(dir.y, dir.x));
    if (ori === stair.downOri) return 3;
    if (ori === stair.upOri) return 2;
    return layer;
}

/**
 * Whether a viewer on `viewerLayer` can see an object on `objLayer`: same floor, or either of them on the stairs
 * (the original client draws the underground group while the active layer is above 0 and hides it on the ground).
 */
export function floorsVisible(viewerLayer: number, objLayer: number): boolean {
    return ((viewerLayer ^ objLayer) & 1) === 0 || ((viewerLayer | objLayer) & 2) !== 0;
}
