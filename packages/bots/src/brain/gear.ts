// Scope use (BrainFeatures.scope): the scope in use sets how far the bot sees (its snapshot covers the zoom radius).
// The smallest scope when an enemy is within 15 units or the bot is indoors (a close fight, like a player zooming
// out of a long scope), the largest one otherwise and whenever contacts were heard beyond the view. Switched through
// PlayerInput.useItem (the original InputMsg.useItem equips a scope from the bag), at most once a second.
import { v2 } from "@rebirth/core";
import { pointInBounds } from "../geom.ts";
import type { BrainCtx, Intent } from "./context.ts";
import { underRoof } from "./grenades.ts";

const SCOPES = ["1xscope", "2xscope", "4xscope", "8xscope", "15xscope"];
const CLOSE = 15;
/** The wanted scope is worked out at most this often. */
const CHECK_EVERY = 0.4;

/** Scopes the bot can switch to (the 1x is built in), smallest first. */
function owned(ctx: BrainCtx): string[] {
    return SCOPES.filter((s) => s === "1xscope" || (ctx.self.inventory[s] ?? 0) > 0 || ctx.self.scope === s);
}

/** The scope the bot wants now. */
export function wantedScope(ctx: BrainCtx): string {
    const { self, model, now } = ctx;
    const scopes = owned(ctx);
    const largest = scopes[scopes.length - 1];
    const heard = model.threats.unseenShooters().some((s) => now - s.lastShot < 5 && !pointInBounds(s.pos, model.view));
    if (heard) return largest;
    const close = ctx.visibleEnemies.some((e) => !e.downed && v2.distance(e.pos, self.pos) < CLOSE);
    if (close || underRoof(model, self.pos)) return scopes[0];
    return largest;
}

/** Switches the scope through Intent.useItem when another one fits better. */
export function manageScope(ctx: BrainCtx, intent: Intent): void {
    const sm = ctx.mem.smart;
    if (intent.useItem || ctx.now - sm.lastScope < 1 || ctx.now - sm.scopeCheckAt < CHECK_EVERY) return;
    sm.scopeCheckAt = ctx.now;
    const want = wantedScope(ctx);
    if (want === ctx.self.scope) return;
    sm.lastScope = ctx.now;
    intent.useItem = want;
}
