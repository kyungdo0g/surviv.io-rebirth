// Skill tiers (bot overhaul POPULATION-3/4): beginner, intermediate and expert (초보 / 중수 / 고수) are bands of a
// continuous mechanics skill s in [0, 1], each bot drawing its own s inside its tier's band, plus a game sense g that
// follows s loosely (g = clamp(s + N(0, 0.2)): good aimers usually know the game, but not always).
//
// skillParams(s, g) composes the DifficultyParams every behaviour already reads: the mechanics fields (reaction, aim
// error, lead, bursts, clicks, strafing, the whole human motor and the human latencies) are interpolated in s between
// three anchors, NOVICE (s = 0), AVERAGE (s = 0.5) and the hard preset (s = 1); the decision fields (memory, cover,
// grenades, standing still, engage range, heal and boost thresholds, aggression) in g between the easy, normal and
// hard presets (boosts: 15 / 35 / 50, so beginners boost too), with thinkEvery 1 only for a high g. The anchors were
// calibrated with scripts/aimbench.ts --skill (docs/design/bot-population.md "Calibration"): a beginner misses clearly
// more than today's easy preset, an intermediate sits between easy and normal, an expert near hard. Every tier keeps a
// human reaction floor (REACTION_FLOOR, median seconds from on-screen exposure).
// Round 4 (user report 30): grenade craft and judgement go through the same two axes, no per-tier branches. The frag
// decisions (DifficultyParams.frag recall, coverWait, craft, waste, pathCheck) and the misjudgement of a fight
// (misjudge, overconfidence) follow g between the presets; the throwing hand (shortBias, rangeSd, lateralDeg,
// motionComp) follows s between NOVICE, AVERAGE and hard.
//
// Draws (drawSkill) use the persona/skill rng stream (bot.ts PERSONA_SALT), never the brain's or the motor's.
import type { Rng } from "@rebirth/core";
import {
    DIFFICULTY_PRESETS,
    type Difficulty,
    type DifficultyParams,
    type FragParams,
    LEGACY_TIER,
    type MotorParams,
    type SkillTierName,
    TIER_FAMILY,
} from "./difficulty.ts";
import { gaussian } from "./motor/noise.ts";

/** A bot's skill: its tier label, mechanics s and game sense g (both 0..1). BrainCtx.skill. */
export interface SkillProfile {
    tier: SkillTierName;
    s: number;
    g: number;
}

export interface SkillTierDef {
    /** band of s drawn uniformly per bot */
    band: readonly [number, number];
    /** representative s (aim-bench calibration point, the band's middle) */
    benchS: number;
    /** human floor of the median reaction from on-screen exposure, seconds (POPULATION-4) */
    reactionFloor: number;
}

/**
 * Tier bands (critique: experts capped at s 0.9 until COMBAT-4 adds the ~80 ms perception delay; hard = s 1 with zero
 * latency is superhuman against a networked player).
 */
export const SKILL_TIERS: Readonly<Record<SkillTierName, SkillTierDef>> = {
    beginner: { band: [0, 0.3], benchS: 0.15, reactionFloor: 0.35 },
    intermediate: { band: [0.35, 0.65], benchS: 0.5, reactionFloor: 0.25 },
    expert: { band: [0.75, 0.9], benchS: 0.825, reactionFloor: 0.18 },
};

/** Median reaction floors per tier (seconds from on-screen exposure): beginner 0.35, intermediate 0.25, expert 0.18. */
export const REACTION_FLOOR: Readonly<Record<SkillTierName, number>> = {
    beginner: SKILL_TIERS.beginner.reactionFloor,
    intermediate: SKILL_TIERS.intermediate.reactionFloor,
    expert: SKILL_TIERS.expert.reactionFloor,
};

/** Spread of the game sense around the skill: g = clamp(s + N(0, SENSE_SD)). */
export const SENSE_SD = 0.2;
/** Game sense from which a bot reloads smartly and dodges grenades. */
export const SENSE_SMART = 0.35;
/** Game sense from which a bot decides every snapshot (thinkEvery 1); below SENSE_SMART every third. */
export const SENSE_FAST = 0.85;

/** The legacy presets as skill profiles: their tier label and the s / g their aim-bench numbers match. */
export const PRESET_SKILL: Readonly<Record<Difficulty, Readonly<SkillProfile>>> = {
    easy: { tier: LEGACY_TIER.easy, s: 0.4, g: 0 },
    normal: { tier: LEGACY_TIER.normal, s: 0.75, g: 0.5 },
    hard: { tier: LEGACY_TIER.hard, s: 1, g: 1 },
};

/** Mechanics fields interpolated in s. */
interface SkillAnchor {
    reactionTime: [number, number];
    aimErrorDeg: number;
    aimErrorPerSpeed: number;
    acquireErrorMult: number;
    settleTime: number;
    errorPeriod: number;
    turnRateDeg: number;
    leadFactor: number;
    burstShots: [number, number];
    burstPause: [number, number];
    clickDelay: [number, number];
    strafeChance: number;
    exposureReaction: [number, number];
    onsetFloor: number;
    perceptionDelay: number;
    meleeLag: number;
    dodgeReaction: [number, number];
    motor: Omit<MotorParams, "model">;
    /** the throwing hand (round 4): how short and how scattered a throw lands, own motion allowed for */
    throwHand: Pick<FragParams, FragHandField>;
}

/** FragParams fields of the hand (interpolated in s); the rest are decisions (in g, between the presets). */
type FragHandField = "shortBias" | "rangeSd" | "lateralDeg" | "motionComp";
const FRAG_HAND: readonly FragHandField[] = ["shortBias", "rangeSd", "lateralDeg", "motionComp"];
const FRAG_SENSE = ["recall", "coverWait", "craft", "waste", "pathCheck"] as const;

/** s = 0: a first-time player (late, wide, sloppy tracking, no lead). */
const NOVICE: SkillAnchor = {
    // (evaluation F5: the flick onset floor and the exposure reaction of COMBAT-3/4 made the first shot 0.2 s slower
    // than the tier bands; [1, 1.6] before, AVERAGE [0.42, 0.68])
    reactionTime: [0.8, 1.3],
    aimErrorDeg: 18,
    aimErrorPerSpeed: 0.8,
    acquireErrorMult: 2.8,
    settleTime: 1,
    errorPeriod: 0.4,
    turnRateDeg: 220,
    leadFactor: 0,
    burstShots: [5, 10],
    burstPause: [0.5, 1],
    clickDelay: [0.3, 0.55],
    strafeChance: 0.15,
    exposureReaction: [0.42, 0.6],
    onsetFloor: 0.2,
    perceptionDelay: 0.08,
    meleeLag: 0.3,
    dodgeReaction: [0.55, 0.9],
    motor: {
        fittsA: 0.11,
        fittsB: 0.09,
        endpointSigma: 0.1,
        overcorrectP: 0.36,
        pursuitLag: 0.28,
        pursuitKv: 0.6,
        pursuitKp: 3,
        pursuitPred: 0.15,
        speedNoise: 0.36,
        tremor: 0.014,
        triggerLooseness: 3,
        confirmDelay: 0.18,
    },
    // a first throw: well short, wide, the own run not allowed for (a frag thrown back on the run lands at the feet)
    throwHand: { shortBias: 0.18, rangeSd: 0.16, lateralDeg: 7, motionComp: 0.1 },
};

/** s = 0.5: an average player (between today's easy and normal presets). */
const AVERAGE: SkillAnchor = {
    reactionTime: [0.22, 0.4],
    aimErrorDeg: 7,
    aimErrorPerSpeed: 0.45,
    acquireErrorMult: 2.2,
    settleTime: 0.6,
    errorPeriod: 0.28,
    turnRateDeg: 480,
    leadFactor: 0.35,
    burstShots: [4, 8],
    burstPause: [0.25, 0.5],
    clickDelay: [0.09, 0.22],
    strafeChance: 0.6,
    exposureReaction: [0.25, 0.36],
    onsetFloor: 0.17,
    perceptionDelay: 0.08,
    meleeLag: 0.2,
    dodgeReaction: [0.32, 0.52],
    motor: {
        fittsA: 0.062,
        fittsB: 0.058,
        endpointSigma: 0.05,
        overcorrectP: 0.17,
        pursuitLag: 0.14,
        pursuitKv: 0.8,
        pursuitKp: 5.5,
        pursuitPred: 0.45,
        speedNoise: 0.13,
        tremor: 0.0065,
        triggerLooseness: 1.55,
        confirmDelay: 0.09,
    },
    throwHand: { shortBias: 0.06, rangeSd: 0.08, lateralDeg: 3, motionComp: 0.55 },
};

/** s = 1: the hard preset's mechanics. */
function expertAnchor(): SkillAnchor {
    const h = DIFFICULTY_PRESETS.hard;
    const { model: _model, ...motor } = h.motor;
    return {
        reactionTime: h.reactionTime,
        aimErrorDeg: h.aimErrorDeg,
        aimErrorPerSpeed: h.aimErrorPerSpeed,
        acquireErrorMult: h.acquireErrorMult,
        settleTime: h.settleTime,
        errorPeriod: h.errorPeriod,
        turnRateDeg: h.turnRateDeg,
        leadFactor: h.leadFactor,
        burstShots: h.burstShots,
        burstPause: h.burstPause,
        clickDelay: h.clickDelay,
        strafeChance: h.strafeChance,
        exposureReaction: h.exposureReaction,
        onsetFloor: h.onsetFloor,
        perceptionDelay: h.perceptionDelay,
        meleeLag: h.meleeLag,
        dodgeReaction: h.dodgeReaction,
        motor,
        throwHand: {
            shortBias: h.frag.shortBias,
            rangeSd: h.frag.rangeSd,
            lateralDeg: h.frag.lateralDeg,
            motionComp: h.frag.motionComp,
        },
    };
}

/** Decision fields interpolated in g (easy at g 0, normal at 0.5, hard at 1). */
const SENSE_FIELDS = [
    "memory",
    "coverChance",
    "grenadeRate",
    "standStillChance",
    "rangeMult",
    "healBelow",
    "boostAbove",
    "aggression",
    "meleeAggression",
    "misjudge",
    "overconfidence",
] as const;

/**
 * Decision anchors at g 0 and 0.5 that differ from the easy and normal presets (g 1 is always hard): every tier keeps
 * its boost up when safe (user report 16: soda and pills; the easy preset never boosts, boostAbove 0). MOVE-6 owns
 * the behaviour.
 */
const SENSE_OVERRIDES: Partial<Record<(typeof SENSE_FIELDS)[number], readonly [number, number]>> = {
    boostAbove: [15, 35],
};

type Lerpable = number | number[] | { [k: string]: Lerpable };

/** a + (b - a) t, exactly b at t = 1 (so s = 1 is the hard preset to the last bit). */
function lerpNum(a: number, b: number, t: number): number {
    return t >= 1 ? b : t <= 0 ? a : a + (b - a) * t;
}

function lerpValue<T extends Lerpable>(a: T, b: T, t: number): T {
    if (typeof a === "number" && typeof b === "number") return lerpNum(a, b, t) as T;
    if (Array.isArray(a) && Array.isArray(b)) return a.map((x, i) => lerpNum(x, b[i] as number, t)) as T;
    const out: Record<string, Lerpable> = {};
    for (const k of Object.keys(a as object))
        out[k] = lerpValue((a as Record<string, Lerpable>)[k], (b as Record<string, Lerpable>)[k], t);
    return out as T;
}

/** Piecewise-linear interpolation between the three anchors at 0, 0.5 and 1. */
function threePoint<T extends Lerpable>(lo: T, mid: T, hi: T, x: number): T {
    const c = clamp01(x);
    return c <= 0.5 ? lerpValue(lo, mid, c / 0.5) : lerpValue(mid, hi, (c - 0.5) / 0.5);
}

function clamp01(x: number): number {
    return Math.min(1, Math.max(0, x));
}

/** The tier whose band holds `s` (gaps between bands go to the nearer band). */
export function tierOfSkill(s: number): SkillTierName {
    if (s < (SKILL_TIERS.beginner.band[1] + SKILL_TIERS.intermediate.band[0]) / 2) return "beginner";
    if (s < (SKILL_TIERS.intermediate.band[1] + SKILL_TIERS.expert.band[0]) / 2) return "intermediate";
    return "expert";
}

/**
 * A [lo, hi] reaction range kept at or above a median `floor`: lo >= 0.8 floor and hi >= 1.2 floor (each bound only
 * ever raised, so the fields still shrink monotonically with s, and the median is at least the floor).
 */
function withFloor(range: readonly [number, number], floor: number): [number, number] {
    return [Math.max(range[0], 0.8 * floor), Math.max(range[1], 1.2 * floor)];
}

/**
 * DifficultyParams of a bot with mechanics `s` and game sense `g` (both clamped to 0..1). `tier` (default: the tier of
 * s) sets the reaction floor and the `name` (its legacy family, which trigger.ts reads for shot pacing).
 */
export function skillParams(s: number, g: number = s, tier: SkillTierName = tierOfSkill(s)): DifficultyParams {
    const m = threePoint<SkillAnchor & Lerpable>(
        NOVICE as SkillAnchor & Lerpable,
        AVERAGE as SkillAnchor & Lerpable,
        expertAnchor() as SkillAnchor & Lerpable,
        s,
    );
    const gs = clamp01(g);
    const sense = {} as Record<(typeof SENSE_FIELDS)[number], number>;
    for (const f of SENSE_FIELDS) {
        const [lo, mid] = SENSE_OVERRIDES[f] ?? [DIFFICULTY_PRESETS.easy[f], DIFFICULTY_PRESETS.normal[f]];
        sense[f] = threePoint(lo, mid, DIFFICULTY_PRESETS.hard[f], gs);
    }
    const frag = {} as FragParams;
    for (const f of FRAG_SENSE)
        frag[f] = threePoint(
            DIFFICULTY_PRESETS.easy.frag[f],
            DIFFICULTY_PRESETS.normal.frag[f],
            DIFFICULTY_PRESETS.hard.frag[f],
            gs,
        );
    for (const f of FRAG_HAND) frag[f] = m.throwHand[f];
    const floor = REACTION_FLOOR[tier];
    const roundPair = (r: [number, number]): [number, number] => [Math.round(r[0]), Math.max(1, Math.round(r[1]))];
    return {
        name: TIER_FAMILY[tier],
        reactionTime: withFloor(m.reactionTime, floor),
        aimErrorDeg: m.aimErrorDeg,
        aimErrorPerSpeed: m.aimErrorPerSpeed,
        acquireErrorMult: m.acquireErrorMult,
        settleTime: m.settleTime,
        errorPeriod: m.errorPeriod,
        turnRateDeg: m.turnRateDeg,
        leadFactor: m.leadFactor,
        burstShots: roundPair(m.burstShots),
        burstPause: m.burstPause,
        clickDelay: m.clickDelay,
        rangeMult: sense.rangeMult,
        standStillChance: sense.standStillChance,
        strafeChance: m.strafeChance,
        coverChance: sense.coverChance,
        aggression: sense.aggression,
        meleeAggression: sense.meleeAggression,
        grenadeRate: sense.grenadeRate,
        frag,
        misjudge: sense.misjudge,
        overconfidence: sense.overconfidence,
        healBelow: Math.round(sense.healBelow),
        boostAbove: Math.round(sense.boostAbove),
        memory: sense.memory,
        thinkEvery: gs >= SENSE_FAST ? 1 : gs >= SENSE_SMART ? 2 : 3,
        dodgeGrenades: gs >= SENSE_SMART,
        smartReload: gs >= SENSE_SMART,
        motor: { model: "human", ...m.motor },
        exposureReaction: withFloor(m.exposureReaction, floor),
        onsetFloor: m.onsetFloor,
        perceptionDelay: m.perceptionDelay,
        meleeLag: m.meleeLag,
        dodgeReaction: m.dodgeReaction,
    };
}

/** Parameters of a tier's representative bot (its benchS, g = s). */
export function tierParams(tier: SkillTierName): DifficultyParams {
    const s = SKILL_TIERS[tier].benchS;
    return skillParams(s, s, tier);
}

/** A bot of `tier`: s uniform in the band, g = clamp(s + N(0, SENSE_SD)). Draws three numbers from `rng`. */
export function drawSkill(rng: Rng, tier: SkillTierName): SkillProfile {
    const [lo, hi] = SKILL_TIERS[tier].band;
    const s = lo + rng.next() * (hi - lo);
    const g = clamp01(s + gaussian(rng) * SENSE_SD);
    return { tier, s, g };
}

/** The skill profile a legacy preset (or custom parameters, by their name) stands for. */
export function skillOf(d: Difficulty | DifficultyParams): SkillProfile {
    const name = typeof d === "string" ? d : d.name;
    return { ...PRESET_SKILL[name] };
}

/** Percent mix of the server population (BOT_DIFFICULTY=mixed default, BOT_SKILL_MIX): 35 / 45 / 20. */
export const DEFAULT_SKILL_MIX: Readonly<Record<SkillTierName, number>> = {
    beginner: 35,
    intermediate: 45,
    expert: 20,
};

/** Parses "35,45,20" (beginner, intermediate, expert percentages or weights); throws on anything else. */
export function parseSkillMix(text: string): Record<SkillTierName, number> {
    const parts = text.split(",").map((p) => Number(p.trim()));
    if (parts.length !== 3 || parts.some((n) => !Number.isFinite(n) || n < 0) || parts.every((n) => n === 0))
        throw new Error(`skill mix must be three non-negative weights "beginner,intermediate,expert" (got "${text}")`);
    return { beginner: parts[0], intermediate: parts[1], expert: parts[2] };
}

/**
 * Effective aim error in degrees the bots' fight arithmetic should assume for a shooter of skill `s` (duel.hitChance
 * sigma), fitted to the calibration grid's hit rates of the single-bullet guns (scripts/aimbench.ts --skill, the shooter
 * moving half the time): against a standing target and against an ADAD strafe (12 u/s, reversing every 0.3-0.6 s).
 * The presets fit easy 2.8 / 12.9, normal 1.6 / 6.7, hard 0.7 / 6.4. LOOT uses it for assess.aimSigma (finding F8) and
 * fightSlot.
 */
export const SKILL_SIGMA: Readonly<{ s: readonly number[]; stationary: readonly number[]; strafe: readonly number[] }> =
    {
        s: [0, 0.15, 0.3, 0.5, 0.65, 0.825, 1],
        stationary: [7.7, 6.2, 5.4, 3.2, 2.7, 1.8, 0.8],
        strafe: [13.8, 13.3, 13.1, 10.3, 7.6, 6.3, 6],
    };

/** SKILL_SIGMA at `s` (linear between the fitted points); `strafing` 0 (standing target) .. 1 (full ADAD strafe). */
export function skillSigma(s: number, strafing = 0): number {
    const xs = SKILL_SIGMA.s;
    const c = clamp01(s);
    let i = 0;
    while (i < xs.length - 2 && c > xs[i + 1]) i++;
    const t = (c - xs[i]) / (xs[i + 1] - xs[i]);
    const at = (ys: readonly number[]) => ys[i] + (ys[i + 1] - ys[i]) * t;
    const k = clamp01(strafing);
    return at(SKILL_SIGMA.stationary) * (1 - k) + at(SKILL_SIGMA.strafe) * k;
}
