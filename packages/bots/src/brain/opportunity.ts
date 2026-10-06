// Opportunism (BrainFeatures.opportunism): an enemy that is reloading, healing or reviving cannot shoot back for a
// moment, and one that is badly hurt or just came out of another fight goes down fast; both are worth turning on.
// Target selection weighs them x1.5 and the fight presses them (brain/tactics.ts). What an enemy is busy with and
// its estimated health come from the intel provider (WorldModel.intel), built from the bot's own snapshots.
import type { Contact } from "../perception/world.ts";
import type { BrainCtx } from "./context.ts";

/** Estimated health below which an enemy counts as weakened. */
const LOW_HEALTH = 40;
const OPPORTUNITY = 1.5;

/** Busy with something that keeps it from shooting back: reloading, healing / boosting, reviving. */
export function isBusy(ctx: BrainCtx, c: Contact): boolean {
    if (c.reviving) return true;
    const a = ctx.model.intel.of(c.id).action;
    return a === "reload" || a === "use" || a === "revive";
}

/** Badly hurt, or just out of another fight (likely hurt and low on ammo). */
export function isWeakened(ctx: BrainCtx, c: Contact): boolean {
    const intel = ctx.model.intel.of(c.id);
    return intel.estHealth < LOW_HEALTH || intel.justFought;
}

/** Target selection weight of `c` for opportunism (1, or 1.5 for a busy or weakened enemy). */
export function opportunityMult(ctx: BrainCtx, c: Contact): number {
    if (c.downed) return 1;
    if (c.reviving) return OPPORTUNITY;
    const intel = ctx.model.intel.of(c.id);
    const busy = intel.action === "reload" || intel.action === "use" || intel.action === "revive";
    return busy || intel.estHealth < LOW_HEALTH || intel.justFought ? OPPORTUNITY : 1;
}
