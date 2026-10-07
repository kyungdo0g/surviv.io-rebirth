// The fight score (brain/fightScore.ts) as the fight assessment shapes it: push a won trade, do not start a lost one,
// and always fight back when shot at. Split out of brain-assess.test.ts in the bot overhaul's stage 0. Owner: MOVE.
import { v2 } from "@rebirth/core";
import { describe, expect, it } from "vitest";
import { fightScore } from "../src/brain/fightScore.ts";
import { addEnemy, ctxOf, faceTo, NOW, TableIntel, testWorld } from "./brain-world.ts";

describe("fight score", () => {
    it("the fight score pushes a won trade and does not start a lost one", () => {
        const w = testWorld();
        // 25 units away, not shooting at the bot: an unprovoked fight
        const e = addEnemy(w, 2, { x: 25, y: 0 });
        faceTo(e, v2.add(w.spot, { x: 0, y: 50 }));
        const plain = fightScore(ctxOf(w, []));
        const intel = new TableIntel();
        intel.table.set(2, { estHealth: 25 });
        w.model.intel = intel;
        expect(fightScore(ctxOf(w, ["assess"]))).toBeGreaterThan(plain);
        intel.table.clear();
        w.model.self.health = 25;
        expect(fightScore(ctxOf(w, ["assess"]))).toBeLessThanOrEqual(0.25);
        // shot at: it fights back whatever the assessment says
        e.lastShotAt = NOW - 0.5;
        expect(fightScore(ctxOf(w, ["assess"]))).toBeGreaterThanOrEqual(0.78);
    });
});
