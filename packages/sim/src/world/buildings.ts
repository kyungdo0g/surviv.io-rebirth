// What a destroyed obstacle does to the building around it: stoves damage the roof and stop the chimney smoke, every
// broken wall brings the roof closer to collapsing (def `ceiling.destroy.wallCount`), a broken wall takes the doors
// hinged on it and the broken windows set in it down with it, decal anchors (pumpkin lights) take their decal.
// Also the heal regions of buildings (bathhouse steam room, oasis).
// Behaviour follows survev server/src/game/objects/building.ts (obstacleDestroyed), obstacle.ts (kill: isWall,
// isDecalAnchor) and player.ts (heal regions); docs/research/mechanics/doors-layers-ceilings.md "Roof collapse".
import { collider, v2 } from "@rebirth/core";
import type { DamageParams } from "../combat/damage.ts";
import type { SimContext } from "./context.ts";
import type { Building, Obstacle } from "./entities.ts";
import type { Player } from "./player.ts";
import { type Entity, sameLayer } from "./world.ts";

/** Doors break with a wall their hinge (a 0.5 circle at the door position) touches (survev obstacle.ts kill). */
const DOOR_HINGE_RAD = 0.5;
/** Broken windows are the indestructible 0.2 high low walls left by `destroyType` (survev obstacle.ts kill). */
const BROKEN_WINDOW_HEIGHT = 0.2;
/** Heal regions test a 0.1 circle at the player's position (survev player.ts). */
const HEAL_PROBE_RAD = 0.1;
/** Gore kill counters are sent in 8 bits. */
const MAX_GORE_KILLS = 255;

const scratch: Entity[] = [];

/** The building an obstacle is a direct child of, if any. */
export function parentBuildingOf(ctx: SimContext, obstacle: Obstacle): Building | undefined {
    if (!obstacle.parentId) return undefined;
    const parent = ctx.world.get(obstacle.parentId);
    return parent?.kind === "building" ? parent : undefined;
}

/** A child obstacle of `building` died: roof damage, occupied emitters, wall count (survev obstacleDestroyed). */
/**
 * Whether a destroyed wall counts towards the roof's `wallCount`: any wall (survev), but in a rebirth collapsing
 * building (`ceiling.destroy.collapse`) only its load-bearing walls (ObstacleDef.loadBearing, the brick shells): the
 * owner's rule is that broken exterior walls bring it down, and its wood partitions broken in a fight (or by a bot
 * breaking through) counted too before (review of PR #19: eight of the church's ten partitions caved it in).
 */
export function countsTowardRoof(building: Building, obstacle: Obstacle): boolean {
    if (!obstacle.isWall) return false;
    return !building.def.ceiling.destroy?.collapse || !!obstacle.def.loadBearing;
}

export function onBuildingObstacleDestroyed(building: Building, obstacle: Obstacle): void {
    const def = obstacle.def;
    if (def.damageCeiling) building.ceilingDamaged = true;
    if (def.disableBuildingOccupied) building.occupiedDisabled = true;
    if (countsTowardRoof(building, obstacle)) {
        building.wallsToDestroy--;
        if (building.wallsToDestroy <= 0) building.ceilingDead = true;
    }
}

/**
 * A destroyed wall also destroys, on its layer, every door whose hinge touches it and every broken window it
 * overlaps; `destroy` kills them with the same damage params (survev obstacle.ts kill, isWall).
 */
export function breakWallAttachments(
    ctx: SimContext,
    wall: Obstacle,
    params: DamageParams,
    destroy: (obstacle: Obstacle, params: DamageParams) => void,
): void {
    const hits: Obstacle[] = [];
    for (const obj of ctx.world.query(wall.bounds, scratch)) {
        if (obj.kind !== "obstacle" || obj === wall || obj.dead || !sameLayer(wall.layer, obj.layer)) continue;
        let hit = false;
        if (obj.door) {
            hit = collider.intersect(wall.collider, collider.createCircle(obj.pos, DOOR_HINGE_RAD)) !== null;
        } else if (obj.height === BROKEN_WINDOW_HEIGHT && obj.isWall && !obj.destructible) {
            hit = collider.intersect(wall.collider, obj.collider) !== null;
        }
        if (hit) hits.push(obj);
    }
    for (const obj of hits) destroy(obj, params);
}

/** A destroyed decal anchor removes the decals of its building lying at its position (survev isDecalAnchor). */
export function removeAnchoredDecals(ctx: SimContext, building: Building, anchor: Obstacle): void {
    for (const id of building.childIds) {
        const obj = ctx.world.get(id);
        if (obj?.kind === "decal" && v2.eq(obj.pos, anchor.pos, 0.01)) ctx.world.remove(obj);
    }
}

/**
 * Health per second a player at `pos` on `layer` gains from the heal regions of the buildings in `objs` (sum of the
 * regions its centre touches; buildings on its layer only).
 */
export function healRegionRate(pos: { x: number; y: number }, layer: number, objs: readonly Entity[]): number {
    let total = 0;
    const probe = collider.createCircle(pos, HEAL_PROBE_RAD);
    for (const obj of objs) {
        if (obj.kind !== "building" || obj.healRegions.length === 0 || !sameLayer(layer, obj.layer)) continue;
        for (const region of obj.healRegions) {
            if (collider.intersect(probe, region.collision)) total += region.healRate;
        }
    }
    return total;
}

/**
 * A player died: buildings on its layer whose gore region its circle touches count a kill on their gore decals
 * (the club bathhouse pool turns red; survev player.ts kill, building.ts onGoreRegionKill).
 */
export function goreRegionKill(ctx: SimContext, player: Player): void {
    for (const obj of ctx.world.query(player.bounds, scratch)) {
        if (obj.kind !== "building" || !obj.goreRegion || !sameLayer(player.layer, obj.layer)) continue;
        const r = obj.goreRegion;
        const dx = player.pos.x - Math.min(Math.max(player.pos.x, r.min.x), r.max.x);
        const dy = player.pos.y - Math.min(Math.max(player.pos.y, r.min.y), r.max.y);
        if (dx * dx + dy * dy >= player.rad * player.rad && (dx !== 0 || dy !== 0)) continue;
        for (const id of obj.childIds) {
            const decal = ctx.world.get(id);
            if (decal?.kind === "decal" && decal.def.gore)
                decal.goreKills = Math.min(decal.goreKills + 1, MAX_GORE_KILLS);
        }
    }
}
