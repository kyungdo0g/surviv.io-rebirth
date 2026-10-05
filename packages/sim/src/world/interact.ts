// Interactable obstacles (def `button`): finding what Interact reaches, using a button, and the per-tick timers of
// used buttons (an opened air drop crate dies `useDelay` seconds later and its `destroyType` crate appears).
// Behaviour follows survev server/src/game/objects/player.ts (getInteractableObstacles) and objects/obstacle.ts
// (interact, useButton, killTicker); docs/research/mechanics/airdrop-airstrike.md "Opening the crate".
import { collider, v2 } from "@rebirth/core";
import { destroyObstacle } from "../combat/combat.ts";
import type { SimContext } from "./context.ts";
import type { Obstacle } from "./entities.ts";
import type { Player } from "./player.ts";
import { sameLayer } from "./world.ts";

/** Search radius around the player for interactable obstacles (survev: rad + 5). */
const SEARCH_EXTRA = 5;
/** Cooldown after using a reusable button without its own `useCooldown` (survev obstacle.ts). */
const DEFAULT_USE_COOLDOWN = 0.1;

/**
 * Live buttons on the player's layer whose collider is within `interactionRad` of the player's circle, least
 * overlapping first (survev sorts by penetration). Doors are not interactable yet.
 */
export function interactableObstacles(ctx: SimContext, player: Player): Obstacle[] {
    const r = player.rad + SEARCH_EXTRA;
    const box = { min: v2.sub(player.pos, { x: r, y: r }), max: v2.add(player.pos, { x: r, y: r }) };
    const found: Array<{ pen: number; obstacle: Obstacle }> = [];
    for (const obj of ctx.world.query(box, player.scratch)) {
        if (obj.kind !== "obstacle" || obj.dead || !obj.button || !sameLayer(obj.layer, player.layer)) continue;
        // TODO(M4): doors (open/close on Interact, auto-open) and vat buttons
        const res = collider.intersect(
            collider.createCircle(player.pos, obj.interactionRad + player.rad),
            obj.collider,
        );
        if (res) found.push({ pen: res.pen, obstacle: obj });
    }
    return found.sort((a, b) => a.pen - b.pen).map((f) => f.obstacle);
}

/** Uses a button: flips it, consumes single-use buttons and schedules `destroyOnUse` obstacles to die. */
export function useObstacle(ctx: SimContext, obstacle: Obstacle, player: Player | null): void {
    const button = obstacle.button;
    const def = obstacle.def.button;
    if (obstacle.dead || !button || !def || !button.canUse) return;
    if (player && obstacle.interactCooldown > 0) return;
    obstacle.interactedBy = player?.id ?? 0;
    button.onOff = !button.onOff;
    button.seq++;
    if (def.useOnce) button.canUse = false;
    if (player && !def.useOnce) {
        obstacle.interactCooldown = def.useCooldown ?? DEFAULT_USE_COOLDOWN;
        button.canUse = false;
    }
    // TODO(M4): `useType` buttons open the doors of their building; TODO(M8): `roleToPromote` buttons promote
    if (def.destroyOnUse) obstacle.killTicker = def.useDelay;
    if (obstacle.killTicker > 0 || obstacle.interactCooldown > 0) ctx.activateObstacle(obstacle);
}

/** Advances one obstacle's timers; returns false once it needs no more updates. */
export function updateObstacleTimers(ctx: SimContext, obstacle: Obstacle, dt: number): boolean {
    if (obstacle.killTicker > 0) {
        obstacle.killTicker -= dt;
        if (obstacle.killTicker <= 1e-9) {
            obstacle.killTicker = 0;
            destroyObstacle(ctx, obstacle, { x: 0, y: 0 });
        }
    }
    if (obstacle.interactCooldown > 0) {
        obstacle.interactCooldown -= dt;
        const button = obstacle.button;
        // a reusable button cannot be used while cooling down, then flips back unless resetAfterCooldown is false
        if (button) button.canUse = obstacle.interactCooldown <= 1e-9;
        if (obstacle.interactCooldown <= 1e-9) {
            obstacle.interactCooldown = 0;
            if (button && (obstacle.def.button?.resetAfterCooldown ?? true)) {
                button.onOff = !button.onOff;
                button.seq++;
            }
        }
    }
    return !obstacle.dead && (obstacle.killTicker > 0 || obstacle.interactCooldown > 0);
}
