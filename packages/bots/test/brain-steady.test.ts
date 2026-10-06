// Steadiness (BrainFeatures.steady): three swaps between the same two behaviours within 8 s lock one of them out for
// 4 s (urgent scores and fights excepted), loot next to an armed enemy the bot just fled is left alone, and loot
// outside the next circle is not picked once the zone presses. Plus the basements hooks: the layer escape leaves an
// underground bot to the path follower, underground loot carries its floor in Intent.goalLayer.
import { type Vec2, v2 } from "@rebirth/core";
import { describe, expect, it } from "vitest";
import type { BehaviourName } from "../src/brain/context.ts";
import { bestLoot, planLoot } from "../src/brain/explore.ts";
import { planLayerEscape } from "../src/brain/layers.ts";
import { noteChoice, noteFlight, steadyGoal, steadyScores } from "../src/brain/steady.ts";
import type { UndergroundNav } from "../src/nav/underground.ts";
import { addEnemy, brainOf, NOW, setGas, testWorld } from "./brain-world.ts";

function opts(scores: Partial<Record<BehaviourName, number>>): Array<[BehaviourName, number, unknown]> {
    return Object.entries(scores).map(([k, v]) => [k as BehaviourName, v as number, null]);
}

describe("steadiness", () => {
    it("locks out one behaviour of a pair that swapped three times within 8 s", () => {
        const w = testWorld();
        const brain = brainOf(w, ["steady"]);
        const at = (t: number) => brain.context(NOW + t);
        noteChoice(at(0), "zone", "loot");
        noteChoice(at(1.5), "loot", "zone");
        const before = opts({ loot: 0.6, zone: 0.5 });
        steadyScores(at(2), before);
        expect(before[0][1]).toBe(0.6);
        noteChoice(at(3), "zone", "loot");
        // committed to the zone: loot is cut for 4 s, an urgent score gets through
        const during = opts({ loot: 0.6, zone: 0.5, heal: 0.9 });
        steadyScores(at(4), during);
        expect(during[0][1]).toBeCloseTo(0.24);
        expect(during[1][1]).toBe(0.5);
        const later = opts({ loot: 0.6 });
        steadyScores(at(7.5), later);
        expect(later[0][1]).toBe(0.6);
    });

    it("never locks out a fight", () => {
        const w = testWorld();
        const brain = brainOf(w, ["steady"]);
        for (let i = 0; i < 6; i++)
            noteChoice(brain.context(NOW + i), i % 2 ? "fight" : "loot", i % 2 ? "loot" : "fight");
        expect(brain.mem.smart.lockDrop).toBeNull();
    });

    it("leaves loot next to an enemy it just fled, and loot out of a pressing zone", () => {
        const w = testWorld();
        const near: Vec2 = v2.add(w.spot, { x: 20, y: 0 });
        const far: Vec2 = v2.add(w.spot, { x: -20, y: 0 });
        addEnemy(w, 2, { x: 25, y: 0 }, { activeWeapon: "ak47" });
        const brain = brainOf(w, ["steady"]);
        noteFlight(brain.context(NOW));
        expect(steadyGoal(brain.context(NOW + 1), near)).toBe(false);
        expect(steadyGoal(brain.context(NOW + 1), far)).toBe(true);
        expect(steadyGoal(brain.context(NOW + 9), near)).toBe(true);
        // the zone presses: only goals inside the next circle (with a margin)
        setGas(w, { x: 200, y: 0 }, 60, "moving");
        expect(steadyGoal(brain.context(NOW + 9), far)).toBe(false);
        expect(steadyGoal(brain.context(NOW + 9), v2.add(w.spot, { x: 190, y: 0 }))).toBe(true);
    });
});

describe("basements hooks", () => {
    const fakeUnderground = { handles: () => true, canPathTo: () => true } as unknown as UndergroundNav;

    it("an underground bot is left to the path follower instead of the stair escape", () => {
        const w = testWorld();
        w.model.self.layer = 1;
        expect(planLayerEscape(brainOf(w, []).context(NOW))).not.toBeNull();
        w.model.underground = fakeUnderground;
        expect(planLayerEscape(brainOf(w, ["basements"]).context(NOW))).toBeNull();
        expect(planLayerEscape(brainOf(w, []).context(NOW))).not.toBeNull();
    });

    it("underground loot is worth going down for, with its floor in Intent.goalLayer", () => {
        const w = testWorld();
        const pos = v2.add(w.spot, { x: 12, y: 0 });
        w.model.loot.set(77, { id: 77, type: "mp5", pos, count: 1, layer: 1, lastSeen: NOW });
        w.model.self.weapons[0] = { type: "", ammo: 0 };
        expect(bestLoot(brainOf(w, []).context(NOW))).toBeNull();
        w.model.underground = fakeUnderground;
        const ctx = brainOf(w, ["basements"]).context(NOW);
        const choice = bestLoot(ctx)!;
        expect(choice.loot.id).toBe(77);
        const plan = planLoot(ctx, choice);
        expect(plan.goalLayer).toBe(1);
        // standing right above it on the ground floor is not in reach
        w.model.self.pos = v2.copy(pos);
        const above = planLoot(
            brainOf(w, ["basements"]).context(NOW),
            bestLoot(brainOf(w, ["basements"]).context(NOW))!,
        );
        expect(above.actions).toEqual([]);
    });
});
