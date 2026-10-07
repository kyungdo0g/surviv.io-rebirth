// Skill tiers (skill.ts, bot overhaul POPULATION-3/4): the bands, the composed parameters (s = 1 with g = 1 is the hard
// preset field by field; every error and latency shrinks as s rises; decisions follow g), the human reaction floors
// of every tier, the tier draws, the effective aim error, the legacy presets as tier aliases, and the server mix.
import { createRng } from "@rebirth/core";
import { describe, expect, it } from "vitest";
import {
    DIFFICULTY_PRESETS,
    type DifficultyParams,
    isDifficultySetting,
    isSkillTier,
    LEGACY_TIER,
    SKILL_TIER_NAMES,
    TIER_FAMILY,
} from "../src/difficulty.ts";
import {
    DEFAULT_SKILL_MIX,
    drawSkill,
    PRESET_SKILL,
    parseSkillMix,
    REACTION_FLOOR,
    SKILL_TIERS,
    skillOf,
    skillParams,
    skillSigma,
    tierOfSkill,
    tierParams,
} from "../src/skill.ts";

const median = (r: readonly [number, number]) => (r[0] + r[1]) / 2;
const STEPS = Array.from({ length: 21 }, (_, i) => i / 20);

/** Fields that only shrink as skill rises (errors, latencies, sloppiness). */
function shrinking(p: DifficultyParams): number[] {
    const m = p.motor;
    return [
        p.reactionTime[0],
        p.reactionTime[1],
        p.aimErrorDeg,
        p.aimErrorPerSpeed,
        p.acquireErrorMult,
        p.settleTime,
        p.errorPeriod,
        p.burstPause[0],
        p.burstPause[1],
        p.clickDelay[0],
        p.clickDelay[1],
        p.exposureReaction[0],
        p.exposureReaction[1],
        p.onsetFloor,
        p.meleeLag,
        p.dodgeReaction[0],
        p.dodgeReaction[1],
        m.fittsA,
        m.fittsB,
        m.endpointSigma,
        m.overcorrectP,
        m.pursuitLag,
        m.speedNoise,
        m.tremor,
        m.triggerLooseness,
        m.confirmDelay,
    ];
}

/** Fields that only grow as skill rises. */
function growing(p: DifficultyParams): number[] {
    return [p.leadFactor, p.strafeChance, p.turnRateDeg, p.motor.pursuitKv, p.motor.pursuitKp, p.motor.pursuitPred];
}

describe("skill tiers", () => {
    it("bands are ordered and disjoint; experts are capped at s 0.9 until COMBAT-4", () => {
        expect(SKILL_TIER_NAMES).toEqual(["beginner", "intermediate", "expert"]);
        let last = -1;
        for (const t of SKILL_TIER_NAMES) {
            const { band, benchS } = SKILL_TIERS[t];
            expect(band[0]).toBeGreaterThan(last);
            expect(band[1]).toBeGreaterThan(band[0]);
            expect(benchS).toBeGreaterThanOrEqual(band[0]);
            expect(benchS).toBeLessThanOrEqual(band[1]);
            expect(tierOfSkill(benchS)).toBe(t);
            expect(tierOfSkill(band[0])).toBe(t);
            expect(tierOfSkill(band[1])).toBe(t);
            last = band[1];
        }
        expect(SKILL_TIERS.expert.band[1]).toBeLessThanOrEqual(0.9);
        expect(isSkillTier("expert")).toBe(true);
        expect(isSkillTier("hard")).toBe(false);
        expect(isDifficultySetting("hard") && isDifficultySetting("beginner")).toBe(true);
    });

    it("s = 1 with g = 1 is the hard preset field by field", () => {
        expect(skillParams(1, 1)).toEqual(DIFFICULTY_PRESETS.hard);
    });

    it("every error and latency shrinks as s rises, tracking and leading improve", () => {
        let prev = skillParams(0, 0.5);
        for (const s of STEPS.slice(1)) {
            const p = skillParams(s, 0.5, "beginner");
            const [a, b] = [shrinking(prev), shrinking(p)];
            for (let i = 0; i < a.length; i++)
                expect(b[i], `shrinking field ${i} at s=${s}`).toBeLessThanOrEqual(a[i] + 1e-12);
            const [c, d] = [growing(prev), growing(p)];
            for (let i = 0; i < c.length; i++)
                expect(d[i], `growing field ${i} at s=${s}`).toBeGreaterThanOrEqual(c[i] - 1e-12);
            prev = p;
        }
    });

    it("decisions follow the game sense g: easy at 0, normal at 0.5, hard at 1", () => {
        for (const [g, d] of [
            [0, "easy"],
            [0.5, "normal"],
            [1, "hard"],
        ] as const) {
            const p = skillParams(0.5, g);
            const ref = DIFFICULTY_PRESETS[d];
            for (const f of [
                "memory",
                "coverChance",
                "grenadeRate",
                "standStillChance",
                "rangeMult",
                "aggression",
            ] as const)
                expect(p[f], `${f} g=${g}`).toBeCloseTo(ref[f], 9);
            expect(p.healBelow).toBe(ref.healBelow);
            expect(p.thinkEvery).toBe(ref.thinkEvery);
            expect(p.smartReload).toBe(ref.smartReload);
            expect(p.dodgeGrenades).toBe(ref.dodgeGrenades);
        }
        // every tier boosts when safe (the easy preset never did)
        expect([0, 0.5, 1].map((g) => skillParams(0.5, g).boostAbove)).toEqual([15, 35, 50]);
        // a quick decision cadence only for a high sense
        expect(skillParams(1, 0.8).thinkEvery).toBe(2);
        expect(skillParams(0.2, 0.9).thinkEvery).toBe(1);
        expect(skillParams(0.9, 0.3).smartReload).toBe(false);
    });

    it("keeps the human reaction floors from on-screen exposure in every tier", () => {
        expect(REACTION_FLOOR).toEqual({ beginner: 0.35, intermediate: 0.25, expert: 0.18 });
        for (const t of SKILL_TIER_NAMES) {
            const [lo, hi] = SKILL_TIERS[t].band;
            for (let k = 0; k <= 20; k++) {
                const s = lo + ((hi - lo) * k) / 20;
                for (const g of [0, 0.5, 1]) {
                    const p = skillParams(s, g);
                    expect(median(p.reactionTime), `${t} s=${s}`).toBeGreaterThanOrEqual(REACTION_FLOOR[t] - 1e-12);
                    expect(median(p.exposureReaction), `${t} s=${s}`).toBeGreaterThanOrEqual(REACTION_FLOOR[t] - 1e-12);
                    expect(p.onsetFloor).toBeGreaterThanOrEqual(0.15);
                }
            }
        }
        // the floor raises the bounds of a range whose median falls below it: hard's [0.16, 0.28] as an intermediate
        const lifted = skillParams(1, 1, "intermediate").reactionTime;
        expect(lifted[0]).toBeCloseTo(0.2, 9);
        expect(lifted[1]).toBeCloseTo(0.3, 9);
    });

    it("a beginner is clearly slower and looser than the easy preset; tiers keep their legacy family name", () => {
        const b = tierParams("beginner");
        const easy = DIFFICULTY_PRESETS.easy;
        expect(median(b.reactionTime)).toBeGreaterThan(median(easy.reactionTime));
        expect(b.aimErrorDeg).toBeGreaterThan(easy.aimErrorDeg);
        expect(b.motor.triggerLooseness).toBeGreaterThan(easy.motor.triggerLooseness);
        for (const t of SKILL_TIER_NAMES) expect(tierParams(t).name).toBe(TIER_FAMILY[t]);
        expect(tierParams("expert").motor.model).toBe("human");
    });

    it("draws a skill inside the band and a sense around it, from the given stream only", () => {
        const a = createRng(11);
        const b = createRng(11);
        let gap = 0;
        for (let i = 0; i < 2000; i++) {
            const tier = SKILL_TIER_NAMES[i % 3];
            const k = drawSkill(a, tier);
            expect(drawSkill(b, tier)).toEqual(k);
            expect(k.tier).toBe(tier);
            expect(k.s).toBeGreaterThanOrEqual(SKILL_TIERS[tier].band[0]);
            expect(k.s).toBeLessThanOrEqual(SKILL_TIERS[tier].band[1]);
            expect(k.g).toBeGreaterThanOrEqual(0);
            expect(k.g).toBeLessThanOrEqual(1);
            gap += Math.abs(k.g - k.s);
        }
        // |N(0, 0.2)| has mean 0.16 (a little less where clamped)
        expect(gap / 2000).toBeGreaterThan(0.1);
        expect(gap / 2000).toBeLessThan(0.18);
    });

    it("the legacy presets are tier aliases with their own fixed values", () => {
        expect(LEGACY_TIER).toEqual({ easy: "beginner", normal: "intermediate", hard: "expert" });
        for (const d of ["easy", "normal", "hard"] as const) {
            expect(PRESET_SKILL[d].tier).toBe(LEGACY_TIER[d]);
            expect(skillOf(d)).toEqual(PRESET_SKILL[d]);
            expect(skillOf(DIFFICULTY_PRESETS[d])).toEqual(PRESET_SKILL[d]);
        }
        expect(PRESET_SKILL.easy.s).toBeLessThan(PRESET_SKILL.normal.s);
        expect(PRESET_SKILL.hard.s).toBe(1);
    });

    it("the effective aim error shrinks with skill and grows against a strafing target", () => {
        let last = Number.POSITIVE_INFINITY;
        for (const s of STEPS) {
            const st = skillSigma(s, 0);
            expect(st).toBeLessThanOrEqual(last);
            expect(skillSigma(s, 1)).toBeGreaterThan(st);
            expect(skillSigma(s, 0.5)).toBeCloseTo((st + skillSigma(s, 1)) / 2, 9);
            last = st;
        }
        expect(skillSigma(-1)).toBe(skillSigma(0));
        expect(skillSigma(2)).toBe(skillSigma(1));
    });

    it("the server mix is 35 / 45 / 20 and parses from BOT_SKILL_MIX", () => {
        expect(DEFAULT_SKILL_MIX).toEqual({ beginner: 35, intermediate: 45, expert: 20 });
        expect(parseSkillMix("35,45,20")).toEqual({ beginner: 35, intermediate: 45, expert: 20 });
        expect(parseSkillMix(" 1, 0 ,3")).toEqual({ beginner: 1, intermediate: 0, expert: 3 });
        for (const bad of ["", "1,2", "1,2,3,4", "a,b,c", "-1,2,3", "0,0,0"])
            expect(() => parseSkillMix(bad)).toThrow();
    });
});
