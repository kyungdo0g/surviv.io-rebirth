// Scope use (BrainFeatures.scope): the scope in use sets how far the bot sees (its snapshot covers the zoom radius:
// GameConfig.scopeZoomRadius, 28 units across half the screen with the 1x, 48 with the 4x; the view is 16:9, so the
// 1x shows only ~16 units up and down). Seeing an enemy before it sees you is the first shot, and the first hit
// decides most fights: tournament diagnostics (smart vs baseline) had the player hit first by an enemy it could not
// see lose ~90% of those exchanges. So the bot treats scopes as its eyes: better scopes are worth a detour
// (scopeLootValue, used by the loot choice) and it always keeps the largest one it owns. It never steps down to a
// small scope in a close fight (an earlier version did: that only blinded it to the third party watching the fight).
// Indoors a building's zoom region overrides the scope anyway (sim player.updateZoom). Switched through
// PlayerInput.useItem (the original InputMsg.useItem equips a scope from the bag), at most once a second.
import { GameObjectDefs, hasDef } from "@rebirth/defs";
import type { SelfState } from "../perception/world.ts";
import type { BrainCtx, Intent } from "./context.ts";

const SCOPES = ["1xscope", "2xscope", "4xscope", "8xscope", "15xscope"];
/** The wanted scope is worked out at most this often. */
const CHECK_EVERY = 0.4;
/** Loot value of a better scope than the one in use (knowledge/loot.ts scale: a first helmet is 56, a gun 95). */
const SCOPE_VALUE: Readonly<Record<string, number>> = { "2xscope": 38, "4xscope": 50, "8xscope": 56, "15xscope": 60 };

/** Scopes the bot can switch to (the 1x is built in), smallest first. */
function owned(ctx: BrainCtx): string[] {
    return SCOPES.filter((s) => s === "1xscope" || (ctx.self.inventory[s] ?? 0) > 0 || ctx.self.scope === s);
}

/** The scope the bot wants now: the largest it owns. */
export function wantedScope(ctx: BrainCtx): string {
    const scopes = owned(ctx);
    return scopes[scopes.length - 1];
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

/** Loot value of `item` when it is a scope better than every one the bot has (0 otherwise, or for other items). */
export function scopeLootValue(self: SelfState, item: string): number {
    if (!hasDef(item) || GameObjectDefs[item].type !== "scope") return 0;
    const best = Math.max(
        ...SCOPES.filter((s) => s === self.scope || (self.inventory[s] ?? 0) > 0).map((s) => SCOPES.indexOf(s)),
        0,
    );
    return SCOPES.indexOf(item) > best ? (SCOPE_VALUE[item] ?? 0) : 0;
}
