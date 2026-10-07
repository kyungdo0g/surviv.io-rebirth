// What a human player sees (bot overhaul stage 0 contract, shared by COMBAT's perception and HARNESS's metrics): the
// visible screen is the zoom radius wide and zoom / VIEW_ASPECT tall around the player (16:9, the original desktop
// client); the snapshot reaches VIEW_MARGIN further on every side so objects do not pop in, and that margin is NOT on
// the screen. Concealment: bushes, tables, broken stairs and statue tops drawn over a player's whole body hide it
// (perception/foliage.ts, COMBAT-2); a tree canopy over it only makes it faint (round 3, user report 26: underCanopy).
// Signatures are fixed: change them only with every consumer.
import type { Bounds, Vec2 } from "@rebirth/core";
import { VIEW_ASPECT } from "@rebirth/sim";
import { BODY_RAD, canopyAmong, concealedAmong } from "./foliage.ts";
import type { WorldModel } from "./world.ts";

/** Half extents of the visible screen in world units at `zoom` (x: half width = zoom, y: half height). */
export function humanScreen(zoom: number): Vec2 {
    return { x: zoom, y: zoom / VIEW_ASPECT };
}

/**
 * Whether a body at `p` shows on the screen of a player at `selfPos` with `zoom`: inside the half extents grown by
 * `bodySlack` (a player's radius, 1, counts a body whose edge pokes in; 0 the centre only).
 */
export function onHumanScreen(selfPos: Vec2, zoom: number, p: Vec2, bodySlack = 0): boolean {
    const h = humanScreen(zoom);
    return Math.abs(p.x - selfPos.x) <= h.x + bodySlack && Math.abs(p.y - selfPos.y) <= h.y + bodySlack;
}

/** The visible screen of a player at `selfPos` with `zoom` as world bounds, grown by `slack` on every side. */
export function screenBounds(selfPos: Vec2, zoom: number, slack = 0): Bounds {
    const h = humanScreen(zoom);
    return {
        min: { x: selfPos.x - h.x - slack, y: selfPos.y - h.y - slack },
        max: { x: selfPos.x + h.x + slack, y: selfPos.y + h.y + slack },
    };
}

/**
 * Whether a player at `p` on `layer` is hidden from the model's bot by foliage or furniture drawn over its whole body
 * (bush, table, broken stairs, statue top: perception/foliage.ts), judged from the obstacles of the bot's latest
 * snapshot. Pure: a concealed player that shoots or is hit is revealed for a moment by WorldModel, not here.
 */
export function concealed(model: WorldModel, p: Vec2, layer: number): boolean {
    return concealedAmong(model.obstacles, p, layer, BODY_RAD);
}

/**
 * Whether a player at `p` on `layer` stands under a tree canopy (all of its body under the canopy's opaque core): a
 * human makes it out only faintly, so a bot engages it with less confidence (brain/faint.ts), never perfectly.
 */
export function underCanopy(model: WorldModel, p: Vec2, layer: number): boolean {
    return canopyAmong(model.obstacles, p, layer, BODY_RAD);
}
