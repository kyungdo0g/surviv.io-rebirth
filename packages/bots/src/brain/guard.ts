// Guarding (BrainFeatures.guard; wave 2, team modes): stand over a downed, reviving or healing teammate facing the
// threat, instead of looting or wandering off. Stub: never chosen until implemented.
import { type BrainCtx, emptyIntent, type Intent } from "./context.ts";

/** Utility of guarding a teammate now (0..1); 0 keeps the behaviour out of the choice. */
export function guardScore(_ctx: BrainCtx): number {
    return 0;
}

export function planGuard(_ctx: BrainCtx): Intent {
    return emptyIntent("guard");
}
