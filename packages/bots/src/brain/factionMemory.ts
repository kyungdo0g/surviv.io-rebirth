// State the 50v50 faction brain (BrainFeatures.faction, bot round 6) keeps between decisions; only its code paths
// write it, so every other brain leaves it at the defaults.
import type { Vec2 } from "@rebirth/core";

export class FactionMemory {
    /** where the squad is going (the leader's hold point near the front) and when it was chosen */
    objective: Vec2 | null = null;
    objectiveAt = Number.NEGATIVE_INFINITY;
    /** the objective is a push (local numbers favour us) or a fall back (outnumbered) */
    push = false;
    fallback = false;
    /** the front the objective was chosen against (where the bot looks while it holds) */
    front: Vec2 | null = null;
    /** a cover spot found near the objective, for the objective it was found for */
    cover: Vec2 | null = null;
    coverFor: Vec2 | null = null;
    /** a cover spot by the follower's formation slot (facing the front), for the slot it was found for */
    slotCover: Vec2 | null = null;
    slotCoverFor: Vec2 | null = null;
    /** a follower on its way back to its formation slot (hysteresis) */
    rallying = false;
    /** last bugle call, last Commander ping, last medic heal request */
    lastBugle = Number.NEGATIVE_INFINITY;
    lastLeaderPing = Number.NEGATIVE_INFINITY;
    lastMedicHeal = Number.NEGATIVE_INFINITY;
    /** last self revive request (Revivify) */
    lastSelfRevive = Number.NEGATIVE_INFINITY;
    /** goals kept off the far bank by the no-solo-crossing rule (diagnostics) */
    crossingsHeld = 0;
}
