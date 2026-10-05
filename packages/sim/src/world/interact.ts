// Interactable obstacles (def `door` or `button`): finding what Interact reaches, using doors and buttons (a button
// may move the doors of its building, count as a puzzle piece, play a recording or destroy itself), and the per-tick
// timers of used obstacles (an opened air drop crate dies `useDelay` seconds later and its `destroyType` crate
// appears, cooldowns, deferred door actions, regrowing potatoes).
// Behaviour follows survev server/src/game/objects/player.ts (getInteractableObstacles) and objects/obstacle.ts
// (interact, useButton, update); docs/research/maps/puzzles.md "Buttons and interactables".
import { collider, v2 } from "@rebirth/core";
import { DamageType } from "@rebirth/defs";
import { destroyObstacle } from "../combat/combat.ts";
import { parentBuildingOf } from "./buildings.ts";
import type { SimContext } from "./context.ts";
import { interactDoor, scheduleDoor, updateDoorTimers } from "./doors.ts";
import type { Obstacle } from "./entities.ts";
import type { Player } from "./player.ts";
import { puzzlePieceToggled } from "./puzzles.ts";
import { sameLayer } from "./world.ts";

/** Search radius around the player for interactable obstacles (survev: rad + 5). */
const SEARCH_EXTRA = 5;
/** Cooldown after using a reusable button without its own `useCooldown` (survev obstacle.ts). */
const DEFAULT_USE_COOLDOWN = 0.1;
/** Timer comparisons tolerate float drift of summed 0.01 s steps. */
const TIME_EPS = 1e-9;

/**
 * Live doors and buttons on the player's layer whose collider is within `interactionRad` of the player's circle,
 * least overlapping first (survev sorts by penetration). Whether each accepts the use is decided by
 * `interactObstacle`.
 */
export function interactableObstacles(ctx: SimContext, player: Player): Obstacle[] {
    const r = player.rad + SEARCH_EXTRA;
    const box = { min: v2.sub(player.pos, { x: r, y: r }), max: v2.add(player.pos, { x: r, y: r }) };
    const found: Array<{ pen: number; obstacle: Obstacle }> = [];
    for (const obj of ctx.world.query(box, player.scratch)) {
        if (obj.kind !== "obstacle" || obj.dead || obj.interactionRad <= 0) continue;
        if (!sameLayer(obj.layer, player.layer)) continue;
        // TODO(M7): vat buttons (isVat) test the distance to their centre instead
        const res = collider.intersect(
            collider.createCircle(player.pos, obj.interactionRad + player.rad),
            obj.collider,
        );
        if (res) found.push({ pen: res.pen, obstacle: obj });
    }
    return found.sort((a, b) => a.pen - b.pen).map((f) => f.obstacle);
}

/**
 * A player (or an automatic trigger with `player` null / `auto`) uses an obstacle: its door toggles (see doors.ts)
 * and its button is pressed. A player's use starts the obstacle's cooldown (survev interact).
 */
export function interactObstacle(ctx: SimContext, obstacle: Obstacle, player: Player | null, auto = false): void {
    if (obstacle.dead) return;
    if (player && !auto && obstacle.interactCooldown > 0) return;
    // TODO(M8): buttons with roleToPromote refuse players who already hold that role
    if (obstacle.door) interactDoor(ctx, obstacle, player, auto);
    const button = obstacle.button;
    const def = obstacle.def.button;
    if (button && def && button.canUse) {
        obstacle.interactedBy = player?.id ?? 0;
        useButton(ctx, obstacle, player);
        if (player && !def.useOnce) {
            // a reusable button cannot be used while cooling down, then flips back (updateObstacleTimers)
            obstacle.interactCooldown = def.useCooldown ?? DEFAULT_USE_COOLDOWN;
            button.canUse = false;
            ctx.activateObstacle(obstacle);
        }
    }
}

/** Former name of `interactObstacle` (M4). */
export function useObstacle(ctx: SimContext, obstacle: Obstacle, player: Player | null): void {
    interactObstacle(ctx, obstacle, player);
}

/**
 * Presses a button: it flips (`onOff`, `seq`), single-use and cooldown buttons lock, `useType` doors of its building
 * get a deferred action (`useStyle`, `useDelay`, `useDir`, `useLock`; `useExpiration` restores them later), a
 * puzzle piece switched on reports to its building, recorders play, `destroyOnUse` buttons die after `useDelay`
 * (survev useButton).
 */
export function useButton(ctx: SimContext, obstacle: Obstacle, _player: Player | null): void {
    const button = obstacle.button;
    const def = obstacle.def.button;
    if (obstacle.dead || !button || !def || !button.canUse) return;
    button.onOff = !button.onOff;
    button.seq++;
    if (def.useOnce || def.useCooldown) button.canUse = false;
    const building = parentBuildingOf(ctx, obstacle);
    if (def.useType && building) {
        for (const id of building.childIds) {
            const door = ctx.world.get(id);
            if (door?.kind !== "obstacle" || door.type !== def.useType || !door.door) continue;
            if (def.useExpiration) {
                door.useExpirationTicker = def.useExpiration + def.useDelay;
                door.memorizedDoorState = {
                    open: door.door.open,
                    canUse: door.door.canUse,
                    useDir: { x: door.door.closedOri - door.ori, y: 0 },
                };
            }
            scheduleDoor(ctx, door, {
                ticker: def.useDelay,
                type: def.useStyle ?? "toggle",
                playerId: 0,
                dir: v2.copy(def.useDir),
                lock: def.useLock,
            });
        }
    }
    if (button.onOff && obstacle.puzzlePiece && building) puzzlePieceToggled(ctx, building, obstacle);
    // recorders only play their recording (maps/puzzles.md "Recorders")
    if (obstacle.type.startsWith("recorder_")) ctx.onRecorderUsed(obstacle);
    if (def.destroyOnUse) {
        obstacle.killTicker = def.useDelay;
        ctx.activateObstacle(obstacle);
    }
    // TODO(M8): buttons with roleToPromote promote `player`
}

/** Advances one obstacle's timers; returns false once it needs no more updates. */
export function updateObstacleTimers(ctx: SimContext, obstacle: Obstacle, dt: number): boolean {
    if (obstacle.killTicker > 0) {
        obstacle.killTicker -= dt;
        if (obstacle.killTicker <= TIME_EPS) {
            obstacle.killTicker = 0;
            // obstacles killing themselves are opened air drops (survev: Airdrop damage, the opener as source)
            destroyObstacle(
                ctx,
                obstacle,
                { x: 0, y: 0 },
                {
                    damageType: DamageType.Airdrop,
                    sourceId: obstacle.interactedBy,
                },
            );
        }
    }
    if (obstacle.regrowTicker > 0) {
        obstacle.regrowTicker -= dt;
        if (obstacle.regrowTicker <= TIME_EPS) {
            obstacle.regrowTicker = 0;
            obstacle.regrow();
            ctx.loot.wakeAround(obstacle.bounds, obstacle.layer);
        }
    }
    if (obstacle.interactCooldown > 0) {
        obstacle.interactCooldown -= dt;
        const button = obstacle.button;
        // a reusable button cannot be used while cooling down, then flips back unless resetAfterCooldown is false
        if (button) button.canUse = obstacle.interactCooldown <= TIME_EPS;
        if (obstacle.interactCooldown <= TIME_EPS) {
            obstacle.interactCooldown = 0;
            if (button && (obstacle.def.button?.resetAfterCooldown ?? true)) {
                button.onOff = !button.onOff;
                button.seq++;
            }
        }
    }
    const doorBusy = obstacle.door ? updateDoorTimers(ctx, obstacle, dt) : false;
    return (
        doorBusy ||
        obstacle.regrowTicker > 0 ||
        (!obstacle.dead && (obstacle.killTicker > 0 || obstacle.interactCooldown > 0))
    );
}
