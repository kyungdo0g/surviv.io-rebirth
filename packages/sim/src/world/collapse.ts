// Collapsing buildings (rebirth; the owner, 2026-10-10: "the gas station and the church: their exterior walls can be
// broken; when a certain amount collapses the whole building caves in, every player inside dies, and the objects and
// items there are deleted: they are buried"). A building whose def sets `ceiling.destroy.collapse` caves in when its
// roof falls (its `wallCount` walls broken, buildings.ts onBuildingObstacleDestroyed): every player on its floor dies
// at once (DamageType.Collapse, items buried with it), every obstacle of the building (walls, doors, furniture, the
// children of its child buildings) and every loose obstacle and item on its floor disappear without loot, explosion or
// smoke. The client shows the roof's existing collapse particles, sound and residue (docs/research/rebirth-deviations.md).
import { type Bounds, collider, type Vec2, v2 } from "@rebirth/core";
import { DamageType } from "@rebirth/defs";
import { killPlayer } from "../combat/combat.ts";
import { wipeIfAllDowned } from "../match/teams.ts";
import type { SimContext } from "./context.ts";
import type { Building, Obstacle } from "./entities.ts";
import type { Player } from "./player.ts";
import { type Entity, sameLayer } from "./world.ts";

const scratch: Entity[] = [];

/** Whether destroying `obstacle` (a child of `building`) is what brings the collapsing building down. */
export function collapsesWith(building: Building, obstacle: Obstacle): boolean {
    // onBuildingObstacleDestroyed counts the wall next: the roof dies when wallsToDestroy reaches 0
    return (
        !!building.def.ceiling.destroy?.collapse &&
        !building.ceilingDead &&
        obstacle.isWall &&
        building.wallsToDestroy <= 1
    );
}

/** Whether `pos` lies on one of the building's floor surfaces (world space). */
export function insideCollapseArea(building: Building, pos: Vec2): boolean {
    return building.surfaces.some((s) => s.colliders.some((c) => collider.contains(c, pos)));
}

/** The box round the building's floor surfaces. */
function areaBounds(building: Building): Bounds {
    const min = { x: Number.POSITIVE_INFINITY, y: Number.POSITIVE_INFINITY };
    const max = { x: Number.NEGATIVE_INFINITY, y: Number.NEGATIVE_INFINITY };
    for (const s of building.surfaces) {
        for (const c of s.colliders) {
            const b = collider.toAabb(c);
            min.x = Math.min(min.x, b.min.x);
            min.y = Math.min(min.y, b.min.y);
            max.x = Math.max(max.x, b.max.x);
            max.y = Math.max(max.y, b.max.y);
        }
    }
    return { min, max };
}

/** Takes an obstacle out of the world silently: no loot, explosion, smoke or destroyType, its timers stopped. */
function buryObstacle(ctx: SimContext, obstacle: Obstacle): void {
    obstacle.kill();
    // the active-obstacle list drops it on its next update (interact.ts updateObstacleTimers returns false)
    obstacle.killTicker = 0;
    obstacle.regrowTicker = 0;
    obstacle.interactCooldown = 0;
    obstacle.delayedDoor = null;
    obstacle.useExpirationTicker = 0;
    obstacle.memorizedDoorState = null;
    ctx.world.remove(obstacle);
}

/** The obstacles of a building and of its child buildings. */
function descendantObstacles(ctx: SimContext, building: Building, out: Obstacle[]): Obstacle[] {
    for (const id of building.childIds) {
        const child = ctx.world.get(id);
        if (child?.kind === "obstacle") out.push(child);
        else if (child?.kind === "building") descendantObstacles(ctx, child, out);
    }
    return out;
}

/**
 * Brings a collapsing building down (called once, as its roof dies): kills and buries the players on its floor, then
 * its obstacles and the loot there. `creditId` is the player whose hit broke the last wall (0 / undefined: none).
 */
export function collapseBuilding(ctx: SimContext, building: Building, creditId?: number): void {
    building.ceilingDead = true;
    const bounds = areaBounds(building);
    const inside = (e: { pos: Vec2; layer: number }) =>
        sameLayer(building.layer, e.layer) && insideCollapseArea(building, e.pos);
    const found = [...ctx.world.query(bounds, scratch)];
    const credit = creditId ? ctx.getPlayer(creditId) : undefined;
    const victims = found.filter((e): e is Player => e.kind === "player" && !e.dead && !e.awaitingClass && inside(e));
    for (const player of victims) {
        killPlayer(
            ctx,
            player,
            {
                amount: 0,
                damageType: DamageType.Collapse,
                mapSourceType: building.type,
                sourceId: credit?.id,
                dir: v2.copy(player.dir),
            },
            credit?.id,
            { buried: true },
        );
    }
    // teams left with only downed members outside die with the buried (a team wipe)
    for (const player of victims) wipeIfAllDowned(ctx, player);
    // the building's own obstacles wherever they stand, and loose ones on its floor (broken windows, crates)
    const obstacles = descendantObstacles(ctx, building, []);
    for (const e of found) {
        if (e.kind === "obstacle" && !e.parentId && !e.isSkin && inside(e) && !obstacles.includes(e)) obstacles.push(e);
    }
    for (const o of obstacles) buryObstacle(ctx, o);
    // loot on the floor, re-queried after the deaths (a cooked grenade dropped, items pushed by the bodies)
    for (const e of [...ctx.world.query(bounds, scratch)]) {
        if (e.kind === "loot" && inside(e)) ctx.loot.remove(e);
    }
    // loot resting against the fallen walls from outside may move again
    for (const o of obstacles) ctx.loot.wakeAround(o.bounds, o.layer);
}
