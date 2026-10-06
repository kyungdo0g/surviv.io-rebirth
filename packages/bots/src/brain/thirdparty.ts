// Third-partying (BrainFeatures.thirdparty; wave 2): move on a fight between two other players (gunfire heard on the
// threat board, enemies engaged with each other in EnemyIntel) and strike the weakened winner. Stub: never chosen until
// implemented.
import { type BrainCtx, emptyIntent, type Intent } from "./context.ts";

/** Utility of joining someone else's fight now (0..1); 0 keeps the behaviour out of the choice. */
export function thirdpartyScore(_ctx: BrainCtx): number {
    return 0;
}

export function planThirdparty(_ctx: BrainCtx): Intent {
    return emptyIntent("thirdparty");
}
