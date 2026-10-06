// Disengage (BrainFeatures.disengage; wave 2): break off a fight the bot is losing (assessment says the enemy has the
// edge, low health without heals, outnumbered) by putting smoke or cover between itself and the enemy and leaving along
// the safe zone, instead of trading shots to the end. Stub: never chosen until implemented.
import { type BrainCtx, emptyIntent, type Intent } from "./context.ts";

/** Utility of disengaging now (0..1); 0 keeps the behaviour out of the choice. */
export function disengageScore(_ctx: BrainCtx): number {
    return 0;
}

export function planDisengage(_ctx: BrainCtx): Intent {
    return emptyIntent("disengage");
}
