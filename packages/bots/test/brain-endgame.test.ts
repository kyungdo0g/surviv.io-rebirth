// Endgame holds (BrainFeatures.endgame): when it applies (few players in a closing zone, a small next circle), how spots are
// scored (cover within 6 units, closeness to the centre, no water, threat heat), the hold behaviour's score and its
// rotation in hops of at most 30 units, and the scanning crosshair while holding.
import { v2 } from "@rebirth/core";
import { describe, expect, it } from "vitest";
import { endgameActive, holdScore, holdSpotScore, planHold } from "../src/brain/endgame.ts";
import { healScore } from "../src/brain/survival.ts";
import { addEnemy, addObstacle, brainOf, ctxOf, FixedBoard, faceTo, NOW, setGas, testWorld } from "./brain-world.ts";

describe("endgame", () => {
    it("applies with ten players or fewer in a closing zone, or a next circle under 80 units", () => {
        const w = testWorld();
        expect(endgameActive(ctxOf(w, ["endgame"]))).toBe(false);
        setGas(w, { x: 0, y: 0 }, 150);
        expect(endgameActive(ctxOf(w, ["endgame"]))).toBe(false);
        // few players left, but the zone still huge: no endgame yet
        w.model.aliveCount = 9;
        expect(endgameActive(ctxOf(w, ["endgame"]))).toBe(false);
        setGas(w, { x: 0, y: 0 }, 120);
        expect(endgameActive(ctxOf(w, ["endgame"]))).toBe(true);
        w.model.aliveCount = 30;
        setGas(w, { x: 0, y: 0 }, 60);
        expect(endgameActive(ctxOf(w, ["endgame"]))).toBe(true);
        setGas(w, { x: 0, y: 0 }, 60, "inactive");
        expect(endgameActive(ctxOf(w, ["endgame"]))).toBe(false);
    });

    it("prefers spots with cover around, near the centre, away from threat heat", () => {
        const w = testWorld();
        setGas(w, { x: 0, y: 0 }, 60);
        addObstacle(w, { x: 20, y: 0 });
        addObstacle(w, { x: 24, y: 3 });
        const ctx = ctxOf(w, ["endgame"]);
        const covered = holdSpotScore(ctx, v2.add(w.spot, { x: 22, y: 5 }));
        const open = holdSpotScore(ctx, v2.add(w.spot, { x: -22, y: 5 }));
        expect(covered).toBeGreaterThan(open);
        expect(holdSpotScore(ctx, v2.add(w.spot, { x: 3, y: 0 }))).toBeGreaterThan(
            holdSpotScore(ctx, v2.add(w.spot, { x: 45, y: 0 })),
        );
        // outside the next circle: unusable
        expect(holdSpotScore(ctx, v2.add(w.spot, { x: 70, y: 0 }))).toBe(Number.NEGATIVE_INFINITY);
        const board = new FixedBoard();
        board.hot = [{ pos: v2.add(w.spot, { x: 22, y: 5 }), heat: 5 }];
        w.model.threats = board;
        expect(holdSpotScore(ctxOf(w, ["endgame"]), v2.add(w.spot, { x: 22, y: 5 }))).toBeLessThan(covered);
    });

    it("holds a spot in the endgame, but leaves it to the fight as soon as an enemy shows up", () => {
        const w = testWorld();
        setGas(w, { x: 10, y: 0 }, 60);
        addObstacle(w, { x: 12, y: 0 });
        const brain = brainOf(w, ["endgame"]);
        expect(holdScore(brain.context(NOW))).toBeGreaterThan(0.45);
        expect(brain.mem.smart.holdSpot).not.toBeNull();
        const plan = planHold(brain.context(NOW));
        expect(plan.behaviour).toBe("hold");
        expect(plan.goal ?? w.spot).toBeTruthy();
        expect(plan.lookAt).toBeDefined();
        const e = addEnemy(w, 2, { x: 15, y: 0 }, { lastShotAt: NOW - 0.2 });
        faceTo(e, w.spot);
        expect(holdScore(brain.context(NOW + 0.5))).toBe(0);
    });

    it("rotates in hops of at most 30 units and scans while holding", () => {
        const w = testWorld();
        setGas(w, { x: 60, y: 0 }, 50);
        // cover along the way and next to the centre
        addObstacle(w, { x: 25, y: 2 });
        addObstacle(w, { x: 62, y: 0 });
        const brain = brainOf(w, ["endgame"]);
        holdScore(brain.context(NOW));
        const spot = brain.mem.smart.holdSpot!;
        expect(v2.distance(spot, w.spot)).toBeGreaterThan(30);
        const plan = planHold(brain.context(NOW));
        expect(v2.distance(plan.goal!, w.spot)).toBeLessThanOrEqual(31);
        // at the spot: stand and sweep the crosshair
        w.model.self.pos = v2.copy(spot);
        const a = planHold(brain.context(NOW + 0.1)).lookAt!;
        const b = planHold(brain.context(NOW + 0.2)).lookAt!;
        expect(planHold(brain.context(NOW + 0.3)).stop).toBe(true);
        expect(v2.distance(a, b)).toBeGreaterThan(0.5);
    });

    it("a long quiet hold takes a break (no camping forever)", () => {
        const w = testWorld();
        setGas(w, { x: 10, y: 0 }, 60);
        addObstacle(w, { x: 12, y: 0 });
        const brain = brainOf(w, ["endgame"]);
        expect(holdScore(brain.context(NOW))).toBeGreaterThan(0.45);
        expect(holdScore(brain.context(NOW + 29))).toBeGreaterThan(0.45);
        expect(holdScore(brain.context(NOW + 31))).toBe(0);
        expect(holdScore(brain.context(NOW + 39))).toBeGreaterThan(0.45);
    });

    it("once the zone is gone, heals and boosts in the gas to outlast the others", () => {
        const w = testWorld();
        setGas(w, { x: 30, y: 0 }, 0, "moving");
        w.model.self.health = 60;
        w.model.self.inventory.bandage = 3;
        expect(healScore(ctxOf(w, ["endgame"]))).toBeGreaterThan(0.97);
        expect(healScore(ctxOf(w, []))).toBeLessThan(0.5);
        // not while the last enemy shoots it from close by
        addEnemy(w, 2, { x: 15, y: 0 });
        expect(healScore(ctxOf(w, ["endgame"]))).toBeLessThan(0.9);
    });
});
