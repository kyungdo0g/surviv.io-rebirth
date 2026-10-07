// Contract type of the rebirth hit feedback (user/2026-10-07-hit-feedback; docs/research/rebirth-deviations.md
// "Enhanced hit effects"): the damage the active player dealt and took since its previous snapshot. It is re-exported
// from view.ts; consumers import it from "@rebirth/sim" like every other view type. The original v0.8.82 never sent
// these facts: the client only guessed hits from tracers.
import type { Vec2 } from "@rebirth/core";

/**
 * One hit the active player dealt or took (Snapshot.hits; `targetId` or `sourceId` is always the active player).
 * Hits the damage pipeline drops (teammates, the Cobalt class menu, the buffer after a knock) and hits that deal no
 * damage are never listed. The other player's id is 0 when it is not in the viewer's view (hidden in smoke, on another
 * floor, out of range) or for the environment (gas, air drops).
 */
export interface HitEvent {
    targetId: number;
    /** the player who dealt it; 0 for the environment or when that player is not in view */
    sourceId: number;
    /** damage after the headshot multiplier and every reduction, clamped to the target's remaining health (> 0) */
    amount: number;
    /** defs DamageType (Player 0, Bleeding 1, Gas 2, Airdrop 3, Airstrike 4) */
    damageType: number;
    headshot: boolean;
    /** the helmet (headshot) or the chest armour (body hit) reduced it */
    armored: boolean;
    /** direction the hit travelled (unit vector); only on hits the active player took */
    dir?: Vec2;
}
