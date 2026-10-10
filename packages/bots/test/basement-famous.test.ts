// The basements every player knows (owner report 2026-10-10; brain/basement.ts): the military base's, the
// Chrysanthemum bunker's in the greenhouse and the Crimson Ring club's bathhouse. A bot that is no basement-goer still
// goes down them by its own draw (famousChance), more of the thorough and skilled ones.
import { describe, expect, it } from "vitest";
import { basementChance, famousChance, famousGoer } from "../src/brain/basement.ts";
import { BRAIN_PRESETS } from "../src/brain/features.ts";
import { PERSONAS } from "../src/persona.ts";
import { brainOf, NOW, testWorld } from "./brain-world.ts";

describe("famous basements", () => {
    it("are known to more bots than basements in general, thorough and skilled ones most", () => {
        const expert = { tier: "expert", s: 0.9, g: 0.9 } as const;
        const beginner = { tier: "beginner", s: 0.1, g: 0.1 } as const;
        expect(famousChance(PERSONAS.looter, expert)).toBeGreaterThan(famousChance(PERSONAS.rusher, expert));
        expect(famousChance(PERSONAS.rifleman, expert)).toBeGreaterThan(famousChance(PERSONAS.rifleman, beginner));
        expect(famousChance(PERSONAS.rusher, expert)).toBeGreaterThan(basementChance(PERSONAS.rusher, expert));
    });

    it("the draw is the bot's own and held (no rng draw from the brain)", () => {
        let goers = 0;
        for (let seed = 1; seed <= 200; seed++) {
            const brain = brainOf(testWorld(), BRAIN_PRESETS.smart, "normal", seed, { seed });
            const ctx = brain.context(NOW);
            const a = famousGoer(ctx);
            expect(famousGoer(brain.context(NOW + 1))).toBe(a);
            if (a) goers++;
        }
        expect(goers).toBeGreaterThan(40);
        expect(goers).toBeLessThan(180);
    });
});
