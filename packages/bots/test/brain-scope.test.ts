// Scope use (BrainFeatures.scope): the bot keeps its largest scope (a close fight included: a small scope only hides
// the third party) and a better scope is worth a detour. Split out of brain-grenades.test.ts in the bot overhaul's
// stage 0. Owner: LOOT.
import { v2 } from "@rebirth/core";
import { describe, expect, it } from "vitest";
import { emptyIntent } from "../src/brain/context.ts";
import { bestLoot } from "../src/brain/explore.ts";
import { manageScope, scopeLootValue, wantedScope } from "../src/brain/gear.ts";
import { addEnemy, ctxOf, NOW, testWorld } from "./brain-world.ts";

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
