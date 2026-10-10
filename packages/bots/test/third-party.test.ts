// Third parties in a 1v1 (owner request 2026-10-10; brain/newcomer.ts): a bot in a duel that a third player joins
// mostly reacts to the newcomer (turns on it, or takes cover from it while finishing the first fight); a
// persona-driven minority stays tunnel-visioned on its first opponent.
import { v2 } from "@rebirth/core";
import { describe, expect, it } from "vitest";
import type { BrainProfile } from "../src/brain/brain.ts";
import { selectTarget } from "../src/brain/combat.ts";
import { emptyIntent } from "../src/brain/context.ts";
import { BRAIN_PRESETS } from "../src/brain/features.ts";
import { coverFromNewcomer, tunnelOdds, tunnelVision } from "../src/brain/newcomer.ts";
import { PERSONA_MIX, PERSONAS, type PersonaName } from "../src/persona.ts";
import { addEnemy, addObstacle, brainOf, faceTo, NOW, type TestWorld, testWorld } from "./brain-world.ts";

const SMART = BRAIN_PRESETS.smart;

/** The bot in a duel with A (id 2, 14 u east, shooting at it, fired at a moment ago) and B (id 3) joining from `b`. */
function duel(b = { x: -12, y: 6 }): TestWorld {
    const w = testWorld();
    const a = addEnemy(w, 2, { x: 14, y: 0 }, { lastShotAt: NOW - 0.3 });
    faceTo(a, w.spot);
    const n = addEnemy(w, 3, b, { lastShotAt: NOW - 0.2 });
    faceTo(n, w.spot);
    w.model.underFire = { time: NOW - 0.1, from: v2.add(w.spot, b), shooterId: 3 };
    return w;
}

function brainIn(w: TestWorld, features: typeof SMART, seed: number, persona?: PersonaName) {
    const profile = { seed, ...(persona ? { persona: PERSONAS[persona] } : {}) } as BrainProfile;
    const brain = brainOf(w, features, "normal", seed, profile);
    brain.mem.targetId = 2;
    brain.mem.fight.fireTarget = 2;
    brain.mem.fight.fireAt = NOW - 0.5;
    return brain;
}

describe("third parties in a 1v1", () => {
    it("tunnel vision is a minority: about a fifth to a quarter of the server's persona mix, bold personas more", () => {
        expect(tunnelOdds(brainIn(testWorld(), SMART, 1, "rusher").context(NOW))).toBeGreaterThan(
            tunnelOdds(brainIn(testWorld(), SMART, 1, "marksman").context(NOW)),
        );
        const names = Object.keys(PERSONA_MIX) as Array<keyof typeof PERSONA_MIX>;
        const total = names.reduce((a, n) => a + PERSONA_MIX[n], 0);
        let share = 0;
        for (const n of names) {
            let k = 0;
            for (let seed = 1; seed <= 200; seed++)
                if (tunnelVision(brainIn(testWorld(), SMART, seed, n).context(NOW))) k++;
            share += (PERSONA_MIX[n] / total) * (k / 200);
        }
        expect(share).toBeGreaterThan(0.15);
        expect(share).toBeLessThan(0.35);
    });

    it("a reacting bot turns on a newcomer close by; a tunnel-visioned one stays on its first opponent", () => {
        let reacting = -1;
        let tunnel = -1;
        for (let seed = 1; seed <= 60 && (reacting < 0 || tunnel < 0); seed++) {
            const brain = brainIn(duel({ x: -8, y: 0 }), SMART, seed);
            const ctx = brain.context(NOW);
            if (tunnelVision(ctx)) tunnel = selectTarget(ctx)?.id ?? 0;
            else reacting = selectTarget(ctx)?.id ?? 0;
        }
        expect(reacting).toBe(3);
        expect(tunnel).toBe(2);
    });

    it("a reacting bot that keeps its first opponent takes cover from the newcomer, still shooting at the first", () => {
        let checked = 0;
        for (let seed = 1; seed <= 60 && checked < 2; seed++) {
            const w = duel({ x: -20, y: 0 });
            addObstacle(w, { x: -2.5, y: 2 }, "stone_01");
            const brain = brainIn(w, SMART, seed);
            const ctx = brain.context(NOW);
            const intent = emptyIntent("fight");
            intent.targetId = 2;
            intent.fire = true;
            coverFromNewcomer(ctx, intent);
            if (tunnelVision(ctx)) {
                expect(intent.goal).toBeNull();
            } else {
                expect(intent.goal).not.toBeNull();
                expect(intent.fire).toBe(true);
                // behind the stone as the newcomer sees it
                expect(w.model.lineOfFire(v2.add(w.spot, { x: -20, y: 0 }), intent.goal ?? w.spot)).toBe(false);
            }
            checked++;
        }
        expect(checked).toBe(2);
    });
});
