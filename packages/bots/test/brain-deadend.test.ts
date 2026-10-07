// Dead ends (BrainFeatures.basements): a bot that stays within a few units of one spot for 10 s while its behaviours
// want to go farther walks back along its own trail for a few seconds; standing still on purpose is no trap.
import { v2 } from "@rebirth/core";
import { describe, expect, it } from "vitest";
import { emptyIntent } from "../src/brain/context.ts";
import { noteDeadEnd, planDeadEnd } from "../src/brain/deadEnd.ts";
import { brainOf, NOW, testWorld } from "./brain-world.ts";

describe("dead ends", () => {
    it("walks back along its trail after 10 s pressed against a dead end", () => {
        const w = testWorld();
        const brain = brainOf(w, ["basements"]);
        const start = v2.copy(w.spot);
        const far = v2.add(start, { x: 100, y: 0 });
        const want = emptyIntent("explore");
        want.goal = far;
        // 8 s walking in from the west, then stuck
        let t = NOW;
        for (let i = 0; i <= 8; i++, t += 1) {
            w.model.self.pos = v2.add(start, { x: -16 + 2 * i, y: 0 });
            const ctx = brain.context(t);
            expect(planDeadEnd(ctx)).toBeNull();
            noteDeadEnd(ctx, want);
        }
        let out = null;
        for (; t < NOW + 30 && !out; t += 1) {
            w.model.self.pos = v2.add(start, { x: (t % 2) * 0.5, y: 0 });
            const ctx = brain.context(t);
            out = planDeadEnd(ctx);
            if (!out) noteDeadEnd(ctx, want);
        }
        expect(out).not.toBeNull();
        expect(t - (NOW + 9)).toBeGreaterThanOrEqual(10);
        expect(t - (NOW + 9)).toBeLessThan(13);
        expect(out!.moveDir!.x).toBeLessThan(-0.5);
        // it keeps walking out for a few seconds, then lets the behaviours plan again (no new escape right away)
        expect(planDeadEnd(brain.context(t + 1))).not.toBeNull();
        expect(planDeadEnd(brain.context(t + 5))).toBeNull();
    });

    it("standing still on purpose (stop) or with a close goal is no trap", () => {
        const w = testWorld();
        const brain = brainOf(w, ["basements"]);
        const hold = emptyIntent("hold");
        hold.stop = true;
        const near = emptyIntent("loot");
        near.goal = v2.add(w.spot, { x: 3, y: 0 });
        for (let t = NOW; t < NOW + 25; t += 1) {
            const ctx = brain.context(t);
            expect(planDeadEnd(ctx)).toBeNull();
            noteDeadEnd(ctx, t < NOW + 12 ? hold : near);
        }
    });
});
