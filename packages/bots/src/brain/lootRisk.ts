// Which visible enemies make looting unsafe (bot overhaul LOOT-2). Any standing enemy on screen used to cut a
// container to 0.4 of its worth and loot to half: a crate an unarmed bot was punching dropped under the cutoff when an
// unarmed player walked into view far away, and the bot wandered off mid-crate (critique C1: 35 of 41 and 53 of 71
// enemies that interrupted a break were unarmed). Now only a threat damps: an armed enemy that shot lately, is within
// its gun's reach of the bot, or faces it; an unarmed one only within punching distance.
import { v2 } from "@rebirth/core";
import type { Contact } from "../perception/world.ts";
import { enemyGun, faces } from "./assess.ts";
import type { BrainCtx } from "./context.ts";

/** An unarmed enemy closer than this can punch the bot before it notices. */
const FIST_THREAT = 6;
/** An enemy that fired this recently is in a fight (maybe with the bot next). */
const SHOT_RECENT = 3;
/** Facing the bot within this angle and distance: about to shoot it. */
const FACING_DEG = 30;
const FACING_DIST = 40;

/** Whether a visible enemy threatens a bot that stops to loot. */
export function threatening(ctx: BrainCtx, e: Contact): boolean {
    if (!e.visible || e.downed || e.teammate) return false;
    const d = v2.distance(e.pos, ctx.self.pos);
    const gun = enemyGun(ctx, e);
    if (!gun) return d < FIST_THREAT;
    if (ctx.now - e.lastShotAt < SHOT_RECENT) return true;
    if (d <= Math.min(gun.range, gun.maxEngage)) return true;
    return d < FACING_DIST && faces(e, ctx.self.pos, FACING_DEG);
}

/** How a container's or an item's worth is damped by the enemies in view: 0.4 under threat, 0.9 when only seen. */
export function lootDamping(ctx: BrainCtx): number {
    let seen = false;
    for (const e of ctx.visibleEnemies) {
        if (e.downed) continue;
        if (threatening(ctx, e)) return 0.4;
        seen = true;
    }
    return seen ? 0.9 : 1;
}

/** Whether any visible enemy threatens the bot. */
export function underThreat(ctx: BrainCtx): boolean {
    return ctx.visibleEnemies.some((e) => threatening(ctx, e));
}
