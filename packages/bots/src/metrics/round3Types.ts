// Round 3 and 4 match metrics (user reports 19-30, stage EVALUATE): the per-bot counters of the round 3 collector
// (metrics/round3.ts) and the match-level container record. Plain JSON, like the rest of MatchMetrics.

/** One frag (or MIRV) a bot threw, followed from its release to its burst on the simulation's projectile. */
export interface FragRecord {
    /** game time of the release */
    t: number;
    item: string;
    /** seconds the fuse ran in the hand (the def's fuse minus the projectile's fuse at release) */
    cook: number;
    /** the bot's planned cook (ThrowPlan.cook), -1 unknown */
    planned: number;
    /** why it was cooked (CombatMemory.planReason when the throw began), "" unknown */
    reason: string;
    /** the bot was running (behaviour flee or disengage) when it let go */
    fleeing: boolean;
    /** seconds from the release until it came to rest, -1 it burst before that */
    flight: number;
    /** seconds it lay at rest before the burst, -1 it burst before coming to rest */
    rest: number;
    /** it burst in the air (above the ground or the obstacle it lay on) */
    airborne: boolean;
    /** held past its fuse: it burst in the hand */
    cookedOff: boolean;
    /** distance from the burst to the point the bot aimed at, -1 unknown */
    burstOff: number;
    /** nearest standing enemy (same floor, true positions) at the burst, and the blast's outer radius */
    enemyDist: number;
    blast: number;
    /** damage its blast dealt to enemies, teammates and the thrower, and the enemies it hurt */
    enemyDmg: number;
    teamDmg: number;
    selfDmg: number;
    enemiesHit: number;
}

/** Samples of one kind of target (open ground, under a tree canopy, inside a bush) and how many were shot at. */
export interface ConcealSamples {
    samples: number;
    fire: number;
}

export interface Round3Bot {
    // report 20: fire from a shooter the bot could not see (off its 16:9 screen, or hidden)
    /** episodes (3 s quiet ends one), reactions by kind, seconds from the first bullet to the first reaction */
    unseenEpisodes: number;
    unseenReactions: Record<string, number>;
    unseenLatency: number[];
    /** 0.5 s samples during episodes, how many out of the true shooter's line of fire */
    unseenSamples: number;
    unseenSafeSamples: number;
    /** damage taken and deaths during episodes */
    unseenDamage: number;
    unseenDeaths: number;
    // report 23: a fight target in smoke
    smokeEpisodes: number;
    smokeReactions: Record<string, number>;
    /** shots fired at the smoke while the target hid in it, and hits on it */
    smokeShots: number;
    smokeHits: number;
    // reports 24, 29, 30: frags
    frags: FragRecord[];
    /** the combat decision trace's counts at the end (cook:<reason>, frag:forgot/blocked/sidestep, ...) */
    fragTrace: Record<string, number>;
    /** seconds with a frag in the bag and a standing enemy on the screen (the chance to use one) */
    fragChanceSeconds: number;
    // report 25: a fight target lost from sight
    lostEpisodes: number;
    /** ...of an armed target the bot fought in reach (the losses the design searches) */
    lostArmed: number;
    lostSearched: number;
    lostFound: number;
    lostFoundBySearch: number;
    /** searches given up without finding it, and seconds from the loss to the give-up / to finding it */
    lostGaveUp: number;
    giveUpTimes: number[];
    findTimes: number[];
    // report 26: concealment
    /** shots at a target under a tree canopy, first shots there (no shot at it for 3 s) */
    canopyShots: number;
    canopyFirstShots: number;
    /** enemies on the screen in reach with a clear line, by concealment, and how often the bot fired at them */
    conceal: { open: ConcealSamples; canopy: ConcealSamples; bush: ConcealSamples };
    // report 19: cover in fights
    /** fight samples against a standing enemy, with blocking cover within 5 u on the line, fully out of its fire */
    coverSamples: number;
    coverNear: number;
    coverHidden: number;
    // report 22: outfits
    outfitSwaps: number;
    /** ...with an enemy in view, hurt or under threat */
    outfitUnsafe: number;
}

/** Deliberately started containers of a match (a bot's own break target hit on "break" or "airdrop"). */
export interface DeliberateContainers {
    started: number;
    broken: number;
    abandoned: number;
    /** abandoned by the last release's reason (died, downed, left:<behaviour>, noProgress, stall, ...) */
    reasons: Record<string, number>;
    /** still being worked on when the match ended (left out of the rate) */
    ongoing: number;
    /** plated containers deliberately hit */
    plated: number;
}

export function emptyRound3(): Round3Bot {
    const cs = () => ({ samples: 0, fire: 0 });
    return {
        unseenEpisodes: 0,
        unseenReactions: {},
        unseenLatency: [],
        unseenSamples: 0,
        unseenSafeSamples: 0,
        unseenDamage: 0,
        unseenDeaths: 0,
        smokeEpisodes: 0,
        smokeReactions: {},
        smokeShots: 0,
        smokeHits: 0,
        frags: [],
        fragTrace: {},
        fragChanceSeconds: 0,
        lostEpisodes: 0,
        lostArmed: 0,
        lostSearched: 0,
        lostFound: 0,
        lostFoundBySearch: 0,
        lostGaveUp: 0,
        giveUpTimes: [],
        findTimes: [],
        canopyShots: 0,
        canopyFirstShots: 0,
        conceal: { open: cs(), canopy: cs(), bush: cs() },
        coverSamples: 0,
        coverNear: 0,
        coverHidden: 0,
        outfitSwaps: 0,
        outfitUnsafe: 0,
    };
}

/** Release reasons that are real interruptions (a fight, a flight, death), not a lazy bot. */
export const INTERRUPTIONS: ReadonlySet<string> = new Set([
    "died",
    "downed",
    "left:fight",
    "left:flee",
    "left:evade",
    "left:evacuate",
    "left:disengage",
    "left:thirdparty",
    "left:heal",
    "left:revive",
    "left:search",
]);

/** Release reasons of containers the bot could not break (blacklisted as unreachable or without a stand spot). */
export const UNREACHABLE: ReadonlySet<string> = new Set(["unreachable", "noStandSpot"]);
