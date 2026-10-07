// Smart grenades and scope use: frags land 1.5 units behind the cover an enemy hugs, go after an enemy last seen
// under a roof and after one healing behind cover; the bot keeps its largest scope (a close fight included: a small
// scope only hides the third party) and a better scope is worth a detour.
import { v2 } from "@rebirth/core";
import { describe, expect, it } from "vitest";
import { emptyIntent } from "../src/brain/context.ts";
import { bestLoot } from "../src/brain/explore.ts";
import { manageScope, scopeLootValue, wantedScope } from "../src/brain/gear.ts";
import { behindCoverPoint, smartGrenade } from "../src/brain/grenades.ts";
import { addEnemy, addObstacle, brainOf, ctxOf, NOW, TableIntel, testWorld } from "./brain-world.ts";

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
        // a long think interval makes the throw certain
        const plan = smartGrenade(brainOf(w, ["grenades"]).context(NOW), 100);
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

describe("scope", () => {
    it("keeps the largest scope it owns, in a close fight too", () => {
        const w = testWorld();
        w.model.self.inventory["4xscope"] = 1;
        w.model.self.inventory["2xscope"] = 1;
        w.model.self.scope = "2xscope";
        addEnemy(w, 2, { x: 10, y: 0 });
        const ctx = ctxOf(w, ["scope"]);
        expect(wantedScope(ctx)).toBe("4xscope");
        const intent = emptyIntent("fight");
        manageScope(ctx, intent);
        expect(intent.useItem).toBe("4xscope");
        // not again within a second
        const again = emptyIntent("fight");
        manageScope(ctx, again);
        expect(again.useItem).toBe("");
        // nothing to do with the largest one on
        w.model.self.scope = "4xscope";
        const done = emptyIntent("fight");
        manageScope(ctxOf(w, ["scope"]), done);
        expect(done.useItem).toBe("");
    });

    it("a better scope is worth a detour", () => {
        const w = testWorld();
        w.model.self.inventory["2xscope"] = 1;
        w.model.self.scope = "2xscope";
        expect(scopeLootValue(w.model.self, "4xscope")).toBeGreaterThan(40);
        expect(scopeLootValue(w.model.self, "2xscope")).toBe(0);
        expect(scopeLootValue(w.model.self, "bandage")).toBe(0);
        // a 4x scope 10 units away beats a bandage next to the bot only for the smart brain
        w.model.loot.set(70, {
            id: 70,
            type: "4xscope",
            pos: v2.add(w.spot, { x: 10, y: 0 }),
            count: 1,
            layer: 0,
            lastSeen: NOW,
        });
        w.model.loot.set(71, {
            id: 71,
            type: "bandage",
            pos: v2.add(w.spot, { x: 3, y: 0 }),
            count: 1,
            layer: 0,
            lastSeen: NOW,
        });
        expect(bestLoot(ctxOf(w, ["scope"]))?.loot.type).toBe("4xscope");
        expect(bestLoot(ctxOf(w, []))?.loot.type).toBe("bandage");
    });
});
