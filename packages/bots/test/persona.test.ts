// Personas (persona.ts, bot overhaul POPULATION-2): NEUTRAL is today's bot, the six personas stay in range and are
// drawn in the design mix (weighted draws and exact shuffle bags), the base desire keeps the S-rule guns on top and
// orders guns the way each persona likes them, persona and skill draws never shift the brain's random stream, and a
// neutral persona replays a match exactly.
import { createRng } from "@rebirth/core";
import { describe, expect, it } from "vitest";
import { Bot } from "../src/bot.ts";
import { DIFFICULTY_PRESETS } from "../src/difficulty.ts";
import { S_RULE_GUNS, tieredGuns } from "../src/knowledge/gunTiers.ts";
import {
    baseDesire,
    botPersona,
    byThoroughness,
    fleeHealth,
    isNeutral,
    mayCamp,
    NEUTRAL,
    PERSONA_MIX,
    PERSONA_NAMES,
    PERSONAS,
    type PersonaName,
    personaBag,
    personaParams,
    pickPersona,
    shuffleBag,
    withPersona,
} from "../src/persona.ts";
import { runMatch } from "../src/runner.ts";
import { flatGame, QUICK_GAS } from "./helpers.ts";

const SKILLS = [0, 0.15, 0.5, 0.825, 1];

describe("personas", () => {
    it("NEUTRAL reproduces today's constants", () => {
        expect(isNeutral(NEUTRAL)).toBe(true);
        expect(personaParams(undefined)).toBe(NEUTRAL);
        expect(personaParams("neutral")).toBe(NEUTRAL);
        for (const [cls, a] of Object.entries(NEUTRAL.classAffinity)) expect(a, cls).toBe(cls === "useless" ? 0 : 1);
        expect(NEUTRAL.chasePatience).toBe(Number.POSITIVE_INFINITY);
        expect(fleeHealth(NEUTRAL)).toBe(25);
        expect(byThoroughness(NEUTRAL, 70, 0.8)).toBe(70);
        expect(NEUTRAL.roamRadius).toBe(240);
        expect(NEUTRAL.mobility).toBe(0);
        expect(NEUTRAL.campiness).toBe(0);
        expect(Object.isFrozen(NEUTRAL)).toBe(true);
    });

    it("six personas with fields in range; the mix adds up to 100", () => {
        expect(PERSONA_NAMES).toHaveLength(6);
        expect(Object.values(PERSONA_MIX).reduce((a, b) => a + b, 0)).toBe(100);
        for (const name of PERSONA_NAMES) {
            const p = PERSONAS[name];
            expect(p.name).toBe(name);
            expect(isNeutral(p)).toBe(false);
            for (const f of [
                "riskTolerance",
                "lootThoroughness",
                "campiness",
                "mobility",
                "complementWeight",
            ] as const) {
                expect(p[f], `${name}.${f}`).toBeGreaterThanOrEqual(0);
                expect(p[f], `${name}.${f}`).toBeLessThanOrEqual(1);
            }
            for (const a of Object.values(p.classAffinity)) expect(a).toBeGreaterThanOrEqual(0);
            expect(p.chasePatience).toBeLessThanOrEqual(30);
            expect(p.roamRadius).toBeGreaterThan(0);
        }
        // the user's examples: rushers like close guns and can't snipe, marksmen the reverse
        expect(PERSONAS.rusher.classAffinity.smg).toBeGreaterThan(PERSONAS.rusher.classAffinity.sniper);
        expect(PERSONAS.marksman.classAffinity.sniper).toBeGreaterThan(PERSONAS.marksman.classAffinity.smg);
        expect(fleeHealth(PERSONAS.rat)).toBeGreaterThan(fleeHealth(PERSONAS.rusher));
        expect(withPersona(PERSONAS.rifleman, { campiness: 0.9 }).campiness).toBe(0.9);
    });

    it("draws by weight from its own rng: weighted picks follow the mix, bags hold it exactly", () => {
        const rng = createRng(7);
        const counts: Record<string, number> = {};
        const n = 20000;
        for (let i = 0; i < n; i++) {
            const p = pickPersona(rng);
            counts[p] = (counts[p] ?? 0) + 1;
        }
        for (const [name, w] of Object.entries(PERSONA_MIX))
            expect(Math.abs(counts[name] / n - w / 100)).toBeLessThan(0.015);
        const bag = personaBag(createRng(3), 50);
        const inBag: Record<string, number> = {};
        for (const p of bag) inBag[p] = (inBag[p] ?? 0) + 1;
        expect(inBag).toEqual({ rusher: 11, rifleman: 15, marksman: 7, camper: 5, looter: 7, rat: 5 });
        expect(personaBag(createRng(3), 50)).toEqual(bag);
        const tiers = shuffleBag(createRng(1), 20, { beginner: 35, intermediate: 45, expert: 20 });
        expect(tiers.filter((t) => t === "beginner")).toHaveLength(7);
        expect(tiers.filter((t) => t === "intermediate")).toHaveLength(9);
        expect(tiers.filter((t) => t === "expert")).toHaveLength(4);
        expect(shuffleBag(createRng(1), 0, PERSONA_MIX)).toEqual([]);
    });

    it("base desire: the S-rule guns top every persona at every skill", () => {
        for (const name of ["neutral", ...PERSONA_NAMES] as PersonaName[]) {
            const p = PERSONAS[name];
            for (const s of SKILLS) {
                let bestOther = 0;
                for (const g of tieredGuns())
                    if (!S_RULE_GUNS.has(g.id)) bestOther = Math.max(bestOther, baseDesire(g.id, p, s));
                for (const id of S_RULE_GUNS)
                    expect(baseDesire(id, p, s), `${name} ${id} s=${s}`).toBeGreaterThan(bestOther);
            }
        }
        expect(baseDesire("flare_gun", NEUTRAL, 1)).toBe(0);
        expect(baseDesire("bandage", NEUTRAL, 1)).toBe(0);
    });

    it("base desire follows each persona's taste", () => {
        for (const s of SKILLS) {
            const d = (name: PersonaName, id: string) => baseDesire(id, PERSONAS[name], s);
            // a beginner marksman still takes the Mosin over an AK (design 3); only the s = 0 tail prefers the AK
            if (s >= 0.15) expect(d("marksman", "mosin"), `s=${s}`).toBeGreaterThan(d("marksman", "ak47"));
            expect(d("rusher", "ak47"), `s=${s}`).toBeGreaterThan(d("rusher", "mosin"));
            expect(d("rusher", "spas12"), `s=${s}`).toBeGreaterThan(d("rusher", "mk12"));
            expect(d("rifleman", "ak47"), `s=${s}`).toBeGreaterThan(d("rifleman", "mp5"));
            expect(d("rifleman", "mp5"), `s=${s}`).toBeGreaterThan(d("rifleman", "m9"));
            // a rusher's mobility term: the DP-28 (moving spread 9) loses to an AK for it, not for a rifleman
            expect(d("rusher", "ak47") / d("rusher", "dp28")).toBeGreaterThan(
                d("rifleman", "ak47") / d("rifleman", "dp28"),
            );
        }
        // the critique's psychology: an expert marksman puts the AWM-S over its AK, a beginner rusher does not
        expect(baseDesire("awc", PERSONAS.marksman, 0.825)).toBeGreaterThan(
            baseDesire("ak47", PERSONAS.marksman, 0.825),
        );
        expect(baseDesire("awc", PERSONAS.rusher, 0.15)).toBeLessThan(baseDesire("ak47", PERSONAS.rusher, 0.15));
        // skill never makes a gun less wanted
        for (const g of tieredGuns())
            expect(baseDesire(g.id, NEUTRAL, 1)).toBeGreaterThanOrEqual(baseDesire(g.id, NEUTRAL, 0));
    });

    it("camping needs campiness, a B+ gun and armour", () => {
        expect(mayCamp(PERSONAS.camper, "m249", true)).toBe(true);
        // the MK12 is B+ by ruling (the P30L, the old example, is B since the stat rebuild)
        expect(mayCamp(PERSONAS.camper, "mk12", true)).toBe(true);
        expect(mayCamp(PERSONAS.camper, "ak47", true)).toBe(false);
        expect(mayCamp(PERSONAS.camper, "m249", false)).toBe(false);
        expect(mayCamp(PERSONAS.rusher, "m249", true)).toBe(false);
        expect(mayCamp(NEUTRAL, "m249", true)).toBe(false);
    });
});

describe("persona and skill determinism", () => {
    it("persona and skill draws never shift the brain's random stream", () => {
        const game = flatGame({ sandbox: true });
        const plain = new Bot(game.mapData, { seed: 42 });
        const tasted = new Bot(game.mapData, { seed: 42, persona: "rusher", skill: "expert" });
        const exact = new Bot(game.mapData, { seed: 42, persona: "marksman", skill: 0.3, sense: 0.9 });
        const draws = (b: Bot) => Array.from({ length: 8 }, () => b.rng.next());
        const ref = draws(plain);
        expect(draws(tasted)).toEqual(ref);
        expect(draws(exact)).toEqual(ref);
        expect(plain.persona).toBe(NEUTRAL);
        expect(plain.params).toBe(DIFFICULTY_PRESETS.normal);
        // a named persona carries the bot's own gun taste (owner 2026-10-08), drawn from its own stream
        expect(tasted.persona.name).toBe("rusher");
        expect(tasted.persona).toEqual(botPersona("rusher", 42));
        expect(tasted.skill.tier).toBe("expert");
        expect(exact.skill).toEqual({ tier: "beginner", s: 0.3, g: 0.9 });
        // the brain context carries them
        const ctx = tasted.brain.context(0);
        expect(ctx.persona).toBe(tasted.persona);
        expect(ctx.skill).toEqual(tasted.skill);
        // the same seed and tier always draws the same skill
        expect(new Bot(game.mapData, { seed: 42, skill: "expert" }).skill).toEqual(tasted.skill);
    });

    it("a neutral persona with a preset replays a match exactly", () => {
        const base = { bots: 8, seed: 9, gasStages: QUICK_GAS, maxTicks: 2500, difficulty: "mixed" as const };
        const a = runMatch(base);
        const b = runMatch({ ...base, assign: () => ({ persona: "neutral" }) });
        expect(b.ticks).toBe(a.ticks);
        expect(b.players).toEqual(a.players);
        expect(a.players.every((p) => p.persona === "neutral")).toBe(true);
    }, 120_000);

    it("difficulty population draws the tier mix and, when asked, personas; names stay the same", () => {
        const legacy = runMatch({ bots: 20, seed: 4, gasStages: QUICK_GAS, maxTicks: 30 });
        const pop = runMatch({
            bots: 20,
            seed: 4,
            gasStages: QUICK_GAS,
            maxTicks: 30,
            difficulty: "population",
            population: { personas: true },
        });
        expect(pop.players.map((p) => p.name)).toEqual(legacy.players.map((p) => p.name));
        const tiers: Record<string, number> = {};
        for (const p of pop.players) tiers[p.tier] = (tiers[p.tier] ?? 0) + 1;
        expect(tiers).toEqual({ beginner: 4, intermediate: 13, expert: 3 });
        expect(pop.players.every((p) => p.persona !== "neutral")).toBe(true);
        expect(legacy.players.every((p) => p.persona === "neutral")).toBe(true);
        expect(legacy.players.map((p) => p.tier)).toEqual(
            legacy.players.map((p) => ({ easy: "beginner", normal: "intermediate", hard: "expert" })[p.difficulty]),
        );
    }, 60_000);
});
