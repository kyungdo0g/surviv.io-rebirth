// Opportunism and third-partying: busy (reloading, healing, reviving) and weakened enemies weigh 1.5x in target
// selection and get pressed; a fight between two other players is watched from cover at the bot's ideal range until
// one of them falls or drops low, then the bot turns on the survivor; the wait is capped and being shot ends it.
import { v2 } from "@rebirth/core";
import { describe, expect, it } from "vitest";
import { selectTarget } from "../src/brain/combat.ts";
import { fightScore } from "../src/brain/fightScore.ts";
import { opportunityMult } from "../src/brain/opportunity.ts";
import { findTrade, planThirdparty, thirdpartyScore } from "../src/brain/thirdparty.ts";
import {
    addEnemy,
    addObstacle,
    brainOf,
    ctxOf,
    FixedBoard,
    faceTo,
    NOW,
    TableIntel,
    testWorld,
} from "./brain-world.ts";

describe("opportunism", () => {
    it("busy and weakened enemies weigh 1.5x in target selection", () => {
        const w = testWorld();
        const near = addEnemy(w, 2, { x: 15, y: 0 });
        const far = addEnemy(w, 3, { x: -19, y: 0 });
        expect(selectTarget(ctxOf(w, ["opportunism"]))?.id).toBe(near.id);
        const intel = new TableIntel();
        intel.table.set(3, { action: "reload" });
        w.model.intel = intel;
        const ctx = ctxOf(w, ["opportunism"]);
        expect(opportunityMult(ctx, far)).toBe(1.5);
        expect(opportunityMult(ctx, near)).toBe(1);
        expect(selectTarget(ctx)?.id).toBe(far.id);
        // the baseline ignores it
        expect(selectTarget(ctxOf(w, []))?.id).toBe(near.id);
        intel.table.set(3, { estHealth: 20 });
        expect(opportunityMult(ctxOf(w, ["opportunism"]), far)).toBe(1.5);
        intel.table.set(3, { justFought: true });
        expect(opportunityMult(ctxOf(w, ["opportunism"]), far)).toBe(1.5);
        far.reviving = true;
        intel.table.clear();
        expect(opportunityMult(ctxOf(w, ["opportunism"]), far)).toBe(1.5);
    });

    it("a busy enemy is worth fighting even when it has not engaged the bot", () => {
        const w = testWorld();
        const e = addEnemy(w, 2, { x: 25, y: 0 });
        faceTo(e, v2.add(e.pos, { x: 0, y: 10 }));
        const plain = fightScore(ctxOf(w, ["opportunism"]));
        const intel = new TableIntel();
        intel.table.set(2, { action: "use" });
        w.model.intel = intel;
        expect(fightScore(ctxOf(w, ["opportunism"]))).toBeGreaterThan(plain);
        expect(fightScore(ctxOf(w, ["opportunism"]))).toBeGreaterThanOrEqual(0.8);
    });
});

/** Two enemies 30 units off trading shots with each other. */
function tradeWorld() {
    const w = testWorld();
    const a = addEnemy(w, 2, { x: 40, y: -6 }, { lastShotAt: NOW - 0.3 });
    const b = addEnemy(w, 3, { x: 52, y: 6 }, { lastShotAt: NOW - 0.2 });
    faceTo(a, b.pos);
    faceTo(b, a.pos);
    return { w, a, b };
}

describe("third-partying", () => {
    it("spots two players trading shots, the nearer first", () => {
        const { w, a, b } = tradeWorld();
        const t = findTrade(ctxOf(w, ["thirdparty"]))!;
        expect(t.map((p) => p.id)).toEqual([a.id, b.id]);
        // one of them shooting at the bot is not someone else's fight
        faceTo(a, w.spot);
        expect(findTrade(ctxOf(w, ["thirdparty"]))).toBeNull();
    });

    it("spots it from intel and from shooters heard on the threat board", () => {
        const w = testWorld();
        const a = addEnemy(w, 2, { x: 40, y: 0 });
        addEnemy(w, 3, { x: 50, y: 0 });
        const intel = new TableIntel();
        intel.table.set(a.id, { engagedWith: 3 });
        w.model.intel = intel;
        expect(findTrade(ctxOf(w, ["thirdparty"]))?.map((p) => p.id)).toEqual([2, 3]);
        const w2 = testWorld();
        const board = new FixedBoard();
        board.shooters = [
            { id: 7, pos: v2.add(w2.spot, { x: 60, y: 0 }), lastShot: NOW - 0.5, shots: 6, weapon: "ak47" },
            { id: 8, pos: v2.add(w2.spot, { x: 75, y: 10 }), lastShot: NOW - 0.4, shots: 5, weapon: "mp5" },
        ];
        w2.model.threats = board;
        expect(findTrade(ctxOf(w2, ["thirdparty"]))?.map((p) => p.id)).toEqual([7, 8]);
    });

    it("watches from cover at its ideal range without shooting, then strikes the survivor", () => {
        const { w, a, b } = tradeWorld();
        addObstacle(w, { x: 22, y: -3 });
        const brain = brainOf(w, ["thirdparty"]);
        expect(thirdpartyScore(brain.context(NOW))).toBeGreaterThan(0.8);
        const plan = planThirdparty(brain.context(NOW));
        expect(plan.fire).toBe(false);
        expect(plan.slot).not.toBeNull();
        expect(plan.lookAt).toEqual(a.pos);
        const d = v2.distance(plan.goal!, a.pos);
        expect(d).toBeGreaterThan(8);
        expect(d).toBeLessThan(30);
        // a falls: the survivor becomes the target
        w.model.contacts.delete(a.id);
        b.lastSeen = NOW + 3;
        expect(thirdpartyScore(brain.context(NOW + 3))).toBe(0);
        expect(brain.mem.targetId).toBe(b.id);
        expect(brain.mem.smart.tpSurvivor).toBe(b.id);
    });

    it("strikes when one of them drops low", () => {
        const { w, a } = tradeWorld();
        const brain = brainOf(w, ["thirdparty"]);
        thirdpartyScore(brain.context(NOW));
        const intel = new TableIntel();
        intel.table.set(a.id, { estHealth: 25 });
        w.model.intel = intel;
        expect(thirdpartyScore(brain.context(NOW + 1))).toBe(0);
        expect(brain.mem.targetId).toBe(a.id);
    });

    it("gives up after 20 s, or at once when shot at", () => {
        const { w, a, b } = tradeWorld();
        const brain = brainOf(w, ["thirdparty"]);
        expect(thirdpartyScore(brain.context(NOW))).toBeGreaterThan(0);
        for (const c of [a, b]) {
            c.lastSeen = NOW + 21;
            c.lastShotAt = NOW + 21;
        }
        expect(thirdpartyScore(brain.context(NOW + 21))).toBe(0);
        // the cooldown keeps it out for a while
        expect(thirdpartyScore(brain.context(NOW + 22))).toBe(0);

        const fresh = tradeWorld();
        const b2 = brainOf(fresh.w, ["thirdparty"]);
        expect(thirdpartyScore(b2.context(NOW))).toBeGreaterThan(0);
        fresh.w.model.lastHurt = NOW + 0.5;
        expect(thirdpartyScore(b2.context(NOW + 0.6))).toBe(0);
    });
});
