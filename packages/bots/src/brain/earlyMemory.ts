// State of the early-game behaviours (bot round 6, user reports 38-41: brain/early.ts; early-game pacing:
// brain/earlyPace.ts); only their code paths write it.

/** A decision about one enemy, held until `until`. */
export interface HeldChoice {
    yes: boolean;
    until: number;
}

export class EarlyMemory {
    /** game time of the bot's first decision (its alive time counts from it) */
    bornAt = Number.NEGATIVE_INFINITY;
    /** fist rush decisions by enemy id (report 38) */
    readonly rush = new Map<number, HeldChoice>();
    /** answers to a fist rusher by enemy id: swap to melee or keep the gun (report 39) */
    readonly answer = new Map<number, HeldChoice>();
    /** early-game pacing (brain/earlyPace.ts): the bot's hunt roll (NaN: not drawn yet) and its last verdict */
    huntRoll = Number.NaN;
    hunting = false;
    /** early-game pacing: the last time each enemy provoked the bot (shot at it, hit it, rushed it, came close) */
    readonly provoked = new Map<number, number>();
    /** early-game pacing (brain/fists.ts losingFistFight): own health when each fist fight began, and when last on */
    readonly fistFights = new Map<number, { hp: number; last: number }>();
    /** the juke legs of a rush: side, angle off the way in, end of the leg */
    jukeSign = 1;
    jukeAngle = 0;
    jukeUntil = Number.NEGATIVE_INFINITY;
}
