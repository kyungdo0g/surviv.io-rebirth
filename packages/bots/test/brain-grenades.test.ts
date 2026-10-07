// Smart grenades (BrainFeatures.grenades): frags land 1.5 units behind the cover an enemy hugs, go after an enemy last
// seen under a roof and after one healing behind cover, never at an enemy in the open nor closer than 10 units. Scope
// use is brain-scope.test.ts (LOOT). Owner: COMBAT.
import { v2 } from "@rebirth/core";
import { describe, expect, it } from "vitest";
import type { Brain } from "../src/brain/brain.ts";
import { behindCoverPoint, smartGrenade } from "../src/brain/grenades.ts";
import { addEnemy, addObstacle, brainOf, NOW, TableIntel, testWorld } from "./brain-world.ts";

/** The bot reacted to contact `id` long ago and has seen it behind cover since `since`. */
function reactAndCover(brain: Brain, id: number, since: number): void {
    brain.mem.engagedTarget = id;
    brain.mem.engageStart = NOW - 5;
    brain.mem.reaction = 0.3;
    brain.mem.fight.coverTarget = id;
    brain.mem.fight.coveredSince = since;
}

describe("smart grenades", () => {
    it("land 1.5 units behind the obstacle an enemy hides at", () => {
        const w = testWorld();
        addObstacle(w, { x: 18, y: 0 });
        const hider = v2.add(w.spot, { x: 21.5, y: 0 });
        const p = behindCoverPoint(w.model, w.spot, hider);
        expect(p.x).toBeGreaterThan(w.spot.x + 18);
        expect(v2.distance(p, hider)).toBeLessThan(2);
        // an enemy far behind the obstacle is targeted directly
        const far = v2.add(w.spot, { x: 27, y: 0 });
        expect(behindCoverPoint(w.model, w.spot, far)).toEqual(far);
    });

    it("go after an enemy healing behind cover", () => {
        const w = testWorld();
        w.model.self.inventory.frag = 2;
        addObstacle(w, { x: 16, y: 0 });
        addEnemy(w, 2, { x: 19.5, y: 0 });
        const intel = new TableIntel();
        intel.table.set(2, { action: "use" });
        w.model.intel = intel;
        const brain = brainOf(w, ["grenades"]);
        // not before the bot reacted to it, nor before it has been behind cover for a second (COMBAT-11)
        expect(smartGrenade(brain.context(NOW), 100)).toBeNull();
        reactAndCover(brain, 2, NOW - 2);
        // a long think interval makes the throw certain
        const plan = smartGrenade(brain.context(NOW), 100);
        expect(plan?.item).toBe("frag");
        expect(v2.distance(plan!.pos, w.model.contacts.get(2)!.pos)).toBeLessThan(2);
    });

    it("are not thrown at an enemy in the open, nor closer than 10 units", () => {
        const w = testWorld();
        w.model.self.inventory.frag = 2;
        addEnemy(w, 2, { x: 18, y: 0 });
        expect(smartGrenade(brainOf(w, ["grenades"]).context(NOW), 100)).toBeNull();
        const close = testWorld();
        close.model.self.inventory.frag = 2;
        addObstacle(close, { x: 4, y: 0 });
        addEnemy(close, 2, { x: 7, y: 0 });
        expect(smartGrenade(brainOf(close, ["grenades"]).context(NOW), 100)).toBeNull();
    });
});
