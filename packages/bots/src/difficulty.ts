// Bot difficulty presets: reaction time, aim error and tracking, fire discipline, tactics and decision cadence.
// The numbers are tuned so an easy bot plays like a new player (late reactions, wide misses, no cover), a normal bot
// like an average one and a hard bot like a solid regular (fast, leads targets, peeks from cover, stops for long
// shots). None of them sees more than its own snapshot.

export type Difficulty = "easy" | "normal" | "hard";

export const DIFFICULTIES: readonly Difficulty[] = ["easy", "normal", "hard"];

export interface DifficultyParams {
    name: Difficulty;
    /** seconds from first seeing an enemy until the bot may fire at it [min, max] */
    reactionTime: [number, number];
    /** standard deviation of the aim error angle in degrees, against a standing target */
    aimErrorDeg: number;
    /** extra aim error per unit/s of target speed (degrees) */
    aimErrorPerSpeed: number;
    /** the error right after acquiring a target is this many times larger, decaying over `settleTime` */
    acquireErrorMult: number;
    settleTime: number;
    /** how often the aim error wanders to a new value (seconds) */
    errorPeriod: number;
    /** maximum aim turn rate, degrees per second */
    turnRateDeg: number;
    /** fraction of the target's travel during the bullet flight the bot leads by (0..1) */
    leadFactor: number;
    /** auto weapons fire bursts of this many shots at range [min, max] ... */
    burstShots: [number, number];
    /** ... separated by pauses of this many seconds [min, max] */
    burstPause: [number, number];
    /** extra delay between clicks of single-fire weapons, seconds [min, max] */
    clickDelay: [number, number];
    /** engages up to this fraction of the weapon's effective range */
    rangeMult: number;
    /** stands still for long shots (no move spread) with this probability per engagement */
    standStillChance: number;
    /** probability of strafing during a fight (vs walking straight) */
    strafeChance: number;
    /** probability of using cover while reloading / healing in a fight */
    coverChance: number;
    /** utility of starting a gunfight with an enemy that has not engaged the bot (it still fights back when shot) */
    aggression: number;
    /** utility of starting a fist fight with an unarmed player close by while unarmed (0 never) */
    meleeAggression: number;
    /** chance per second to throw a grenade when a good opportunity exists */
    grenadeRate: number;
    /** heals below this health when no enemy is close */
    healBelow: number;
    /** uses boosts (soda/pills) to stay above this boost when safe */
    boostAbove: number;
    /** seconds an enemy that left view is remembered */
    memory: number;
    /** decisions are taken every N snapshots */
    thinkEvery: number;
    /** dodges grenades landing nearby */
    dodgeGrenades: boolean;
    /** reloads in cover / switches to the other loaded gun instead of reloading under fire */
    smartReload: boolean;
}

export const DIFFICULTY_PRESETS: Readonly<Record<Difficulty, DifficultyParams>> = {
    easy: {
        name: "easy",
        reactionTime: [0.55, 0.95],
        aimErrorDeg: 7,
        aimErrorPerSpeed: 0.6,
        acquireErrorMult: 2.5,
        settleTime: 0.8,
        errorPeriod: 0.35,
        turnRateDeg: 300,
        leadFactor: 0,
        burstShots: [3, 6],
        burstPause: [0.35, 0.7],
        clickDelay: [0.15, 0.35],
        rangeMult: 0.7,
        standStillChance: 0,
        strafeChance: 0.25,
        coverChance: 0.1,
        aggression: 0.45,
        meleeAggression: 0.1,
        grenadeRate: 0.05,
        healBelow: 45,
        boostAbove: 0,
        memory: 2,
        thinkEvery: 3,
        dodgeGrenades: false,
        smartReload: false,
    },
    normal: {
        name: "normal",
        reactionTime: [0.3, 0.5],
        aimErrorDeg: 3.5,
        aimErrorPerSpeed: 0.35,
        acquireErrorMult: 2,
        settleTime: 0.5,
        errorPeriod: 0.25,
        turnRateDeg: 600,
        leadFactor: 0.5,
        burstShots: [4, 8],
        burstPause: [0.2, 0.45],
        clickDelay: [0.06, 0.18],
        rangeMult: 0.85,
        standStillChance: 0.4,
        strafeChance: 0.7,
        coverChance: 0.5,
        aggression: 0.56,
        meleeAggression: 0.2,
        grenadeRate: 0.2,
        healBelow: 60,
        boostAbove: 25,
        memory: 4,
        thinkEvery: 2,
        dodgeGrenades: true,
        smartReload: true,
    },
    hard: {
        name: "hard",
        reactionTime: [0.16, 0.28],
        aimErrorDeg: 1.6,
        aimErrorPerSpeed: 0.18,
        acquireErrorMult: 1.6,
        settleTime: 0.3,
        errorPeriod: 0.18,
        turnRateDeg: 1100,
        leadFactor: 0.9,
        burstShots: [6, 12],
        burstPause: [0.12, 0.3],
        clickDelay: [0.02, 0.08],
        rangeMult: 1,
        standStillChance: 0.85,
        strafeChance: 0.95,
        coverChance: 0.85,
        aggression: 0.68,
        meleeAggression: 0.3,
        grenadeRate: 0.4,
        healBelow: 70,
        boostAbove: 50,
        memory: 6,
        thinkEvery: 1,
        dodgeGrenades: true,
        smartReload: true,
    },
};

/** Preset by name; "mixed" or unknown names fall back to `fallback`. */
export function difficultyParams(d: Difficulty | DifficultyParams): DifficultyParams {
    return typeof d === "string" ? DIFFICULTY_PRESETS[d] : d;
}

export function isDifficulty(s: string): s is Difficulty {
    return (DIFFICULTIES as readonly string[]).includes(s);
}
