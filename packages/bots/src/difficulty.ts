// Bot difficulty presets: reaction time, aim error and tracking, fire discipline, tactics and decision cadence.
// The numbers are tuned so an easy bot plays like a new player (late reactions, wide misses, no cover), a normal bot
// like an average one and a hard bot like a solid regular (fast, leads targets, peeks from cover, stops for long
// shots). None of them sees more than its own snapshot.
//
// Skill tiers (bot overhaul POPULATION-3): beginner, intermediate and expert are bands of a continuous skill s in [0, 1]
// (mechanics) with a correlated game sense g; skill.ts composes a DifficultyParams for any (s, g) and draws them per
// bot. The three presets below stay fixed points, unchanged, for replays, tests, the tournament gate and the aim-bench
// fixture: "easy", "normal" and "hard" are kept as the legacy names, aliases that carry the tier labels beginner,
// intermediate and expert (LEGACY_TIER). Since the tiers were calibrated, a beginner misses clearly more than "easy".

export type Difficulty = "easy" | "normal" | "hard";

/** Alias of Difficulty (a preset name). */
export type DifficultyName = Difficulty;

export const DIFFICULTIES: readonly Difficulty[] = ["easy", "normal", "hard"];

/** Skill tiers (초보 / 중수 / 고수): bands of the skill s, see skill.ts SKILL_TIERS. */
export type SkillTierName = "beginner" | "intermediate" | "expert";

export const SKILL_TIER_NAMES: readonly SkillTierName[] = ["beginner", "intermediate", "expert"];

/** The tier label each legacy preset name stands for (the presets keep their own fixed values). */
export const LEGACY_TIER: Readonly<Record<Difficulty, SkillTierName>> = {
    easy: "beginner",
    normal: "intermediate",
    hard: "expert",
};

/** The legacy preset family of a tier (DifficultyParams.name of params composed for that tier). */
export const TIER_FAMILY: Readonly<Record<SkillTierName, Difficulty>> = {
    beginner: "easy",
    intermediate: "normal",
    expert: "hard",
};

/** A difficulty a host can ask for: a legacy preset name or a skill tier. */
export type DifficultySetting = Difficulty | SkillTierName;

export function isSkillTier(s: string): s is SkillTierName {
    return (SKILL_TIER_NAMES as readonly string[]).includes(s);
}

export function isDifficultySetting(s: string): s is DifficultySetting {
    return isDifficulty(s) || isSkillTier(s);
}

/** Aim model: "legacy" is AimController (rate-limited turn plus a wandering error); "human" the cursor motor model. */
export type MotorModel = "legacy" | "human";

/**
 * Parameters of the human cursor motor model (motor/human.ts): ballistic flicks timed by Fitts' law with endpoint
 * scatter and occasional overcorrection, smooth pursuit of moving targets with a lag, tremor, and a trigger finger with
 * a confirmation delay. Screen units (su): 1 su = the zoom radius in world units (half the screen width). Unused while
 * `model` is "legacy".
 */
export interface MotorParams {
    model: MotorModel;
    /** Fitts' law movement time MT = fittsA + fittsB * log2(1 + D / W), seconds (x log-normal noise, sd 0.08) */
    fittsA: number;
    fittsB: number;
    /** standard deviation of a flick's endpoint across the movement, as a fraction of the flick amplitude D */
    endpointSigma: number;
    /** probability that a corrective submovement overshoots (gain 1.25-1.6) and needs another one */
    overcorrectP: number;
    /** smooth pursuit: delay of the eye/hand loop behind the target, seconds */
    pursuitLag: number;
    /** smooth pursuit gains: velocity matching (0..1) and position error correction (1/s) */
    pursuitKv: number;
    pursuitKp: number;
    /** fraction of the target's motion over the lag the pursuit predicts (0..1) */
    pursuitPred: number;
    /** pursuit noise across the line of sight, as a fraction of the target's speed (replaces aimErrorPerSpeed) */
    speedNoise: number;
    /** hand tremor amplitude (8-12 Hz), screen units: a stronger scope makes the same tremor larger in the world */
    tremor: number;
    /** on target while the cursor ray passes within 1.1 x triggerLooseness units of the believed lead point */
    triggerLooseness: number;
    /** mean seconds between the cursor reaching the target and the click (sd 30%) */
    confirmDelay: number;
}

/**
 * Grenade craft (round 4, user report 30: "beginners forget grenades, waste them, throw late, short or into walls;
 * intermediates use them sometimes and plainly; experts throw purposefully with good timing and placement"). The
 * decision fields follow the game sense g (skill.ts: the easy, normal and hard presets at g 0, 0.5 and 1), the hand
 * fields the mechanics s (NOVICE, AVERAGE and hard at s 0, 0.5 and 1). Read by the smart brain only
 * (BrainFeatures.grenades: brain/fragSkill.ts, grenades.ts, escapeFrag.ts); the baseline brain ignores them.
 */
export interface FragParams {
    /** chance the bot thinks of its frags at all in an engagement (one roll per target; beginners forget them) */
    recall: number;
    /** seconds a covered or hiding target must have been out of the line of fire before a frag goes at it */
    coverWait: number;
    /**
     * 0..1 purposeful use: scales the rate of the deliberate throws (denying a push, a revive or a heal, covering an
     * escape, flushing a building) and the chance of a burst over low cover instead of a plain throw
     */
    craft: number;
    /** frags per second thrown away at an enemy in the open or out of reach (only while there is no real reason) */
    waste: number;
    /** chance a throw's path is checked for walls and trees in the way (else the frag may bounce off them) */
    pathCheck: number;
    /** hand: a throw falls short by this fraction of its distance on average... */
    shortBias: number;
    /** ...with this spread of the distance (sd, as a fraction of it)... */
    rangeSd: number;
    /** ...and this sideways spread (sd, degrees) */
    lateralDeg: number;
    /** hand: the share of its own running speed the bot allows for when it throws on the run (0 none: it lands short) */
    motionComp: number;
}

export interface DifficultyParams {
    name: Difficulty;
    /** seconds from first seeing an enemy until the bot may fire at it [min, max] */
    reactionTime: [number, number];
    /**
     * standard deviation of the aim error angle in degrees, against a standing target (human motor: its drift of the
     * believed aim point has 0.6 x this)
     */
    aimErrorDeg: number;
    /** legacy aim: extra aim error per unit/s of target speed (degrees; the human motor uses motor.speedNoise) */
    aimErrorPerSpeed: number;
    /** legacy aim: the error right after acquiring a target is this many times larger, decaying over `settleTime` */
    acquireErrorMult: number;
    settleTime: number;
    /** legacy aim: how often the aim error wanders to a new value (seconds) */
    errorPeriod: number;
    /** legacy aim: maximum aim turn rate, degrees per second (the human motor: Fitts' law and a 1300 deg/s cap) */
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
    /** grenade craft and the throwing hand (round 4; the smart brain's grenades read it) */
    frag: FragParams;
    /**
     * judgement (round 4, user report 30): sd of a per-engagement error in how the bot judges a fight (added to the
     * assessment's advantage, ln of the time-to-kill ratio), and a bias towards believing it wins; beginners only
     */
    misjudge: number;
    overconfidence: number;
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
    /** cursor motor model: "human" (motor/human.ts, the default) or "legacy" (motor/legacy.ts, the wave 1 aim) */
    motor: MotorParams;
    // Human latencies (bot overhaul stage 0 contract; COMBAT implements the mechanisms in wave 1, nothing reads them
    // before). The tier data keeps the human floors (skill.ts REACTION_FLOOR).
    /**
     * seconds from a known target stepping out of cover (back on screen, line of fire opening) until the bot may fire
     * again [min, max]: a fresh, shorter reaction than `reactionTime` (about 0.6 x its mean)
     */
    exposureReaction: [number, number];
    /** absolute floor of a flick's onset after a sighting, seconds (motor/human.ts) */
    onsetFloor: number;
    /** perception latency of the snapshots the bot acts on, seconds (network and interpolation delay of a client) */
    perceptionDelay: number;
    /** melee: lag of the chase and swing percept behind the target's real position, seconds */
    meleeLag: number;
    /** seconds from a grenade's first on-screen sighting until the bot starts dodging [min, max] */
    dodgeReaction: [number, number];
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
        frag: {
            recall: 0.4,
            coverWait: 2.2,
            craft: 0.1,
            waste: 0.05,
            pathCheck: 0.15,
            shortBias: 0.1,
            rangeSd: 0.12,
            lateralDeg: 5,
            motionComp: 0.35,
        },
        misjudge: 0.6,
        overconfidence: 0.3,
        healBelow: 45,
        boostAbove: 0,
        memory: 2,
        thinkEvery: 3,
        dodgeGrenades: false,
        smartReload: false,
        exposureReaction: [0.3, 0.42],
        onsetFloor: 0.18,
        perceptionDelay: 0.08,
        meleeLag: 0.25,
        dodgeReaction: [0.45, 0.75],
        motor: {
            model: "human",
            fittsA: 0.08,
            fittsB: 0.07,
            endpointSigma: 0.05,
            overcorrectP: 0.22,
            pursuitLag: 0.16,
            pursuitKv: 0.8,
            pursuitKp: 5,
            pursuitPred: 0.45,
            speedNoise: 0.12,
            tremor: 0.006,
            triggerLooseness: 1.6,
            confirmDelay: 0.11,
        },
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
        frag: {
            recall: 1,
            coverWait: 1,
            craft: 0.5,
            waste: 0,
            pathCheck: 0.6,
            shortBias: 0.03,
            rangeSd: 0.05,
            lateralDeg: 2,
            motionComp: 0.75,
        },
        misjudge: 0,
        overconfidence: 0,
        healBelow: 60,
        boostAbove: 25,
        memory: 4,
        thinkEvery: 2,
        dodgeGrenades: true,
        smartReload: true,
        exposureReaction: [0.22, 0.32],
        onsetFloor: 0.16,
        perceptionDelay: 0.08,
        meleeLag: 0.18,
        dodgeReaction: [0.3, 0.5],
        motor: {
            model: "human",
            fittsA: 0.05,
            fittsB: 0.05,
            endpointSigma: 0.03,
            overcorrectP: 0.12,
            pursuitLag: 0.1,
            pursuitKv: 0.88,
            pursuitKp: 7,
            pursuitPred: 0.55,
            speedNoise: 0.08,
            tremor: 0.004,
            triggerLooseness: 1.25,
            confirmDelay: 0.07,
        },
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
        frag: {
            recall: 1,
            coverWait: 0.7,
            craft: 1,
            waste: 0,
            pathCheck: 1,
            shortBias: 0,
            rangeSd: 0.035,
            lateralDeg: 1.2,
            motionComp: 0.95,
        },
        misjudge: 0,
        overconfidence: 0,
        healBelow: 70,
        boostAbove: 50,
        memory: 6,
        thinkEvery: 1,
        dodgeGrenades: true,
        smartReload: true,
        exposureReaction: [0.16, 0.22],
        onsetFloor: 0.15,
        perceptionDelay: 0.08,
        meleeLag: 0.12,
        dodgeReaction: [0.22, 0.35],
        motor: {
            model: "human",
            fittsA: 0.03,
            fittsB: 0.028,
            endpointSigma: 0.02,
            overcorrectP: 0.06,
            pursuitLag: 0.045,
            pursuitKv: 0.95,
            pursuitKp: 9,
            pursuitPred: 0.8,
            speedNoise: 0.05,
            tremor: 0.003,
            triggerLooseness: 1.05,
            confirmDelay: 0.03,
        },
    },
};

/** Preset by name, or the custom parameters themselves (skill tiers: skill.ts tierParams / skillParams). */
export function difficultyParams(d: Difficulty | DifficultyParams): DifficultyParams {
    return typeof d === "string" ? DIFFICULTY_PRESETS[d] : d;
}

export function isDifficulty(s: string): s is Difficulty {
    return (DIFFICULTIES as readonly string[]).includes(s);
}
