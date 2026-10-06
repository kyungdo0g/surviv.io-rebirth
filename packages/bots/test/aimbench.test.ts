// Aim bench (scripts/aimbench.ts): a trial replays exactly from its seed, a normal bot shoots and hits a stationary
// target at 10 units with an AK, cells outside the scope's view never see the target, and the recorded baseline
// fixture covers every cell with the legacy motor.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { type AimBaseline, allCells, cellKey, cellVisible, runTrial, trialSeed } from "../scripts/aimbenchLib.ts";

describe("aim bench", () => {
    it("replays a trial from its seed and measures shots, hits and the kill", () => {
        const cell = {
            difficulty: "normal",
            gun: "ak47",
            distance: 10,
            scope: "1xscope",
            pattern: "stationary",
        } as const;
        const seed = trialSeed(1, cell, 0);
        const a = runTrial(cell, seed);
        expect(runTrial(cell, seed)).toEqual(a);
        expect(a.seen).toBe(true);
        expect(a.firstShot).toBeGreaterThan(0.1);
        expect(a.firstShot).toBeLessThan(2);
        expect(a.firstHit).toBeGreaterThanOrEqual(a.firstShot ?? 0);
        expect(a.hits).toBeGreaterThan(0);
        expect(a.hits).toBeLessThanOrEqual(a.bullets);
        expect(a.ttk).toBeGreaterThan(a.firstHit ?? 0);
    }, 30_000);

    it("a target outside the 1x view is never seen", () => {
        expect(cellVisible(35, "1xscope")).toBe(false);
        expect(cellVisible(35, "4xscope")).toBe(true);
        const r = runTrial(
            { difficulty: "hard", gun: "mosin", distance: 35, scope: "1xscope", pattern: "stationary" },
            1,
        );
        expect(r).toEqual({ seen: false, firstShot: null, firstHit: null, ttk: null, bullets: 0, hits: 0 });
    });

    it("the baseline fixture covers every cell with the legacy motor", () => {
        const base = JSON.parse(
            readFileSync(new URL("./fixtures/aim-baseline.json", import.meta.url), "utf8"),
        ) as AimBaseline;
        expect(base.motor).toBe("legacy");
        const cells = allCells(["easy", "normal", "hard"]);
        expect(Object.keys(base.cells).sort()).toEqual(cells.map(cellKey).sort());
        for (const d of ["easy", "normal", "hard"] as const) {
            const s = base.summary[d];
            expect(s?.firstShot).toBeGreaterThan(0);
            expect(s?.hitRate).toBeGreaterThan(0);
        }
        // harder bots react faster
        expect(base.summary.hard?.firstShot ?? 0).toBeLessThan(base.summary.easy?.firstShot ?? 0);
    });
});
