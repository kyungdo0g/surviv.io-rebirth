// Doors: Interact opens and closes them, hinged doors swing away from the opener, sliding doors move along their
// local y axis, automatic doors open for players coming near and close again after a delay, `openDelay` defers the
// toggle (vault doors), `openOnce` doors stay open, locked doors wait for a scheduled unlock, doors next to stairs
// work from both floors. The collider changes at once; clients animate the panel.
// Behaviour follows survev server/src/game/objects/obstacle.ts (interact, toggleDoor, delayedInteraction,
// checkNearByPlayers, checkLayer, getPlayerSide, unlock) and player.ts (auto doors); docs/research/mechanics/
// doors-layers-ceilings.md "Door behaviour" and maps/puzzles.md "Doors".
import { type Bounds, collider, math, type Vec2, v2 } from "@rebirth/core";
import { GameConfig } from "@rebirth/defs";
import { rotateOri, transformOri } from "../geom/transform.ts";
import type { SimContext } from "./context.ts";
import type { DelayedDoorAction, Obstacle } from "./entities.ts";
import type { Player } from "./player.ts";
import { type Entity, sameLayer, type World } from "./world.ts";

/** A player who opened or closed a door by hand waits this long before using it again (survev interact). */
export const DOOR_USE_COOLDOWN = 0.1;
/** Timer comparisons tolerate float drift of summed 0.01 s steps. */
const TIME_EPS = 1e-9;
/** survev checkLayer: these doors never switch layer next to stairs ("@hack"). */
const NO_LAYER_SWITCH = new Set(["house_door_01", "saloon_door_secret"]);

const scratch: Entity[] = [];

/** -1 when `pos` is on the door's +x side (the side its hinge axis points to), else 1 (survev getPlayerSide). */
export function playerSide(obstacle: Obstacle, pos: Vec2): number {
    const toDoor = v2.sub(obstacle.pos, pos);
    return v2.dot(toDoor, rotateOri({ x: 1, y: 0 }, obstacle.ori)) < 0 ? -1 : 1;
}

/** Defers a door action; it replaces any pending one (survev delayedInteraction). */
export function scheduleDoor(ctx: SimContext, obstacle: Obstacle, action: DelayedDoorAction): void {
    obstacle.delayedDoor = action;
    ctx.activateObstacle(obstacle);
}

/**
 * Opens a closed door or closes an open one, right now. A sliding door moves by `slideOffset`; a hinged door turns a
 * quarter around its hinge, towards the button's `useDir.x`, else the def's one-way side, else away from `player`
 * (side -1 without a player), and closing restores its closed orientation (survev toggleDoor).
 */
export function toggleDoor(ctx: SimContext, obstacle: Obstacle, player: Player | null, useDir?: Vec2): void {
    const door = obstacle.door;
    if (!door) return;
    door.open = !door.open;
    if (door.autoClose && door.open) {
        scheduleDoor(ctx, obstacle, { ticker: door.autoCloseDelay, type: "toggle", playerId: player?.id ?? 0 });
    }
    let pos = obstacle.pos;
    let ori = obstacle.ori;
    if (door.slideToOpen) {
        pos = door.open ? v2.add(door.closedPos, rotateOri({ x: 0, y: -door.slideOffset }, ori)) : door.closedPos;
    } else if (!door.open) {
        ori = door.closedOri;
    } else {
        let side = -1;
        if (useDir?.x) side = useDir.x;
        else if (door.openOneWay) side = door.openOneWay;
        else if (player) side = playerSide(obstacle, player.pos);
        ori = door.closedOri - side;
    }
    obstacle.setTransform(pos, ori);
    // loot resting against the panel may move now (survev forceLootUpdates)
    ctx.loot.wakeAround(obstacle.bounds, obstacle.layer);
    checkDoorLayer(ctx.world, obstacle);
}

/** Toggles towards `open` when the door is not already there (survev openDoor / closeDoor / setDoorState). */
export function setDoorOpen(
    ctx: SimContext,
    obstacle: Obstacle,
    open: boolean,
    player: Player | null,
    useDir?: Vec2,
): void {
    if (obstacle.door && obstacle.door.open !== open) toggleDoor(ctx, obstacle, player, useDir);
}

/**
 * A player (or an automatic trigger) uses a door: refused when it cannot be used, when it is an automatic door used
 * by hand, or (rebirth) when it is locked and the use is not automatic. `openOnce` disables it, `openDelay` defers
 * the toggle. Returns whether the door accepted the use (survev interact).
 */
export function interactDoor(ctx: SimContext, obstacle: Obstacle, player: Player | null, auto: boolean): boolean {
    const door = obstacle.door;
    if (!door || obstacle.dead || !door.canUse) return false;
    if (door.locked && !auto) return false;
    if (door.autoOpen && (!auto || door.open)) return false;
    door.seq++;
    if (door.openOnce) door.canUse = false;
    obstacle.interactedBy = player?.id ?? 0;
    if (door.openDelay > 0) {
        scheduleDoor(ctx, obstacle, { ticker: door.openDelay, type: "toggle", playerId: player?.id ?? 0 });
    } else {
        toggleDoor(ctx, obstacle, player);
    }
    if (player && !auto) {
        obstacle.interactCooldown = DOOR_USE_COOLDOWN;
        ctx.activateObstacle(obstacle);
    }
    return true;
}

/** A scheduled unlock: the door opens by itself, stays unlocked and pings the map (survev unlock). */
export function unlockDoor(ctx: SimContext, obstacle: Obstacle): void {
    const door = obstacle.door;
    if (!door || obstacle.dead) return;
    interactDoor(ctx, obstacle, null, true);
    door.locked = false;
    ctx.planes.addPing("ping_unlock", obstacle.pos);
}

/**
 * Automatic doors open for a living player on their layer whose circle grown by `interactionRad` touches them,
 * unless locked or, for one-way doors, approached from the other side (survev player.ts update).
 */
export function autoOpenDoors(ctx: SimContext, player: Player, objs: readonly Entity[]): void {
    for (const obj of objs) {
        if (obj.kind !== "obstacle" || obj.dead) continue;
        const door = obj.door;
        if (!door || door.locked || !door.autoOpen || door.open || !sameLayer(player.layer, obj.layer)) continue;
        if (door.openOneWay && playerSide(obj, player.pos) !== door.openOneWay) continue;
        if (collider.intersect(collider.createCircle(player.pos, player.rad + obj.interactionRad), obj.collider)) {
            interactDoor(ctx, obj, player, true);
        }
    }
}

/**
 * Whether a living player on the door's layer still stands in the closed door's footprint grown by
 * `interactionRad`; if so the auto close is postponed by another `autoCloseDelay` (survev checkNearByPlayers).
 */
function postponeAutoClose(ctx: SimContext, obstacle: Obstacle): boolean {
    const door = obstacle.door;
    if (!door) return false;
    const r = obstacle.interactionRad + GameConfig.player.maxInteractionRad;
    const box: Bounds = { min: v2.sub(door.closedPos, { x: r, y: r }), max: v2.add(door.closedPos, { x: r, y: r }) };
    const closed = transformOri(obstacle.def.collision, door.closedPos, door.closedOri, obstacle.scale);
    for (const obj of ctx.world.query(box, scratch)) {
        if (obj.kind !== "player" || obj.dead || !sameLayer(obstacle.layer, obj.layer)) continue;
        if (collider.intersect(collider.createCircle(obj.pos, obstacle.interactionRad + obj.rad), closed)) {
            scheduleDoor(ctx, obstacle, { ticker: door.autoCloseDelay, type: "toggle", playerId: 0 });
            return true;
        }
    }
    return false;
}

/** Advances a door's deferred action and `useExpiration` timer; returns whether it needs more updates. */
export function updateDoorTimers(ctx: SimContext, obstacle: Obstacle, dt: number): boolean {
    const door = obstacle.door;
    const action = obstacle.delayedDoor;
    if (action) {
        action.ticker -= dt;
        if (action.ticker <= TIME_EPS) {
            obstacle.delayedDoor = null;
            // an open auto door waits while someone stands in the doorway (no lock change pending)
            const wait = door?.open && door.autoClose && !action.lock && postponeAutoClose(ctx, obstacle);
            if (!wait && door && !obstacle.dead) {
                const player = action.playerId ? (ctx.getPlayer(action.playerId) ?? null) : null;
                if (action.type === "toggle") toggleDoor(ctx, obstacle, player, action.dir);
                else setDoorOpen(ctx, obstacle, action.type === "open", player, action.dir);
                if (action.lock) {
                    door.canUse = action.lock === "unlock";
                    door.locked = !door.canUse;
                }
            }
        }
    }
    if (obstacle.useExpirationTicker > 0) {
        obstacle.useExpirationTicker -= dt;
        const memo = obstacle.memorizedDoorState;
        if (obstacle.useExpirationTicker <= TIME_EPS) {
            obstacle.useExpirationTicker = 0;
            obstacle.memorizedDoorState = null;
            if (memo && door && !obstacle.dead) {
                setDoorOpen(ctx, obstacle, memo.open, null, memo.useDir);
                door.canUse = memo.canUse;
                door.locked = !door.canUse;
            }
        }
    }
    return obstacle.delayedDoor !== null || obstacle.useExpirationTicker > 0;
}

/** Circle vs box overlap (survev coldet.test of a circle and an AABB). */
function circleTouchesBox(pos: Vec2, rad: number, b: Bounds): boolean {
    const dx = pos.x - math.clamp(pos.x, b.min.x, b.max.x);
    const dy = pos.y - math.clamp(pos.y, b.min.y, b.max.y);
    return dx * dx + dy * dy < rad * rad || (dx === 0 && dy === 0);
}

/**
 * Doors whose interaction circle (interactionRad + 1) touches a stair's lower half take layer 3, its upper half
 * layer 2, so they collide and can be used from both floors; else their spawn layer (survev checkLayer).
 */
export function checkDoorLayer(world: World, obstacle: Obstacle): void {
    if (!obstacle.door || NO_LAYER_SWITCH.has(obstacle.type)) return;
    let layer = obstacle.originalLayer;
    const rad = obstacle.interactionRad + 1;
    const pos = obstacle.pos;
    const box: Bounds = { min: v2.sub(pos, { x: rad, y: rad }), max: v2.add(pos, { x: rad, y: rad }) };
    for (const obj of world.query(box, scratch)) {
        if (obj.kind !== "structure") continue;
        for (const stair of obj.stairs) {
            if (circleTouchesBox(pos, rad, stair.downAabb)) layer = 3;
            else if (circleTouchesBox(pos, rad, stair.upAabb)) layer = 2;
        }
    }
    obstacle.layer = layer;
}
