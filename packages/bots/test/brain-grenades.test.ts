// Smart grenades and scope use: frags land 1.5 units behind the cover an enemy hugs, go after an enemy last seen
// under a roof and after one healing behind cover; the scope drops to the smallest one in a close fight and goes back
// to the largest one otherwise and when shooters are heard beyond the view.
import { v2 } from "@rebirth/core";
import { describe, expect, it } from "vitest";
import { emptyIntent } from "../src/brain/context.ts";
import { manageScope, wantedScope } from "../src/brain/gear.ts";
import { behindCoverPoint, smartGrenade } from "../src/brain/grenades.ts";
import { addEnemy, addObstacle, brainOf, ctxOf, FixedBoard, NOW, TableIntel, testWorld } from "./brain-world.ts";

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
    it("smallest scope in a close fight, largest otherwise", () => {
        const w = testWorld();
        w.model.self.inventory["4xscope"] = 1;
        w.model.self.inventory["2xscope"] = 1;
        w.model.self.scope = "4xscope";
        expect(wantedScope(ctxOf(w, ["scope"]))).toBe("4xscope");
        addEnemy(w, 2, { x: 10, y: 0 });
        const ctx = ctxOf(w, ["scope"]);
        expect(wantedScope(ctx)).toBe("1xscope");
        const intent = emptyIntent("fight");
        manageScope(ctx, intent);
        expect(intent.useItem).toBe("1xscope");
        // not again within a second
        const again = emptyIntent("fight");
        manageScope(ctx, again);
        expect(again.useItem).toBe("");
    });

    it("largest scope when shooters are heard beyond the view", () => {
        const w = testWorld();
        w.model.self.inventory["4xscope"] = 1;
        w.model.self.scope = "1xscope";
        addEnemy(w, 2, { x: 10, y: 0 });
        w.model.view = { min: v2.add(w.spot, { x: -20, y: -15 }), max: v2.add(w.spot, { x: 20, y: 15 }) };
        const board = new FixedBoard();
        board.shooters = [{ id: 9, pos: v2.add(w.spot, { x: 60, y: 0 }), lastShot: NOW - 1, shots: 3, weapon: "ak47" }];
        w.model.threats = board;
        expect(wantedScope(ctxOf(w, ["scope"]))).toBe("4xscope");
    });
});
