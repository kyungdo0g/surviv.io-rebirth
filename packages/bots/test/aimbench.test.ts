// Aim bench (scripts/aimbench.ts): a trial replays exactly from its seed, a normal bot shoots and hits a stationary
// target at 10 units with an AK, cells outside the scope's view never see the target, and the recorded baseline
// fixture covers every cell with the legacy motor. Skill tiers (POPULATION-6): a skill-level shooter on the human
// screen replays too, and the recorded tier calibration (test/fixtures/aim-tiers.json) holds the tier bands, the
// monotonicity between tiers, and a beginner clearly below the easy preset.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { type AimBaseline, allCells, cellKey, cellVisible, runTrial, trialSeed } from "../scripts/aimbenchLib.ts";
import { type AimTiers, type TIER_BANDS, tierGateFailures, tierOfLabel } from "../scripts/aimbenchTiers.ts";
import { SKILL_TIERS } from "../src/skill.ts";

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

    it("a skill-level shooter on the human screen replays from its seed", () => {
        const cell = {
            difficulty: "normal",
            skill: SKILL_TIERS.intermediate.benchS,
            view: "screen",
            gun: "ot38",
            distance: 20,
            scope: "1xscope",
            pattern: "strafe",
        } as const;
        expect(cellKey(cell)).toBe("s0.5/ot38/20/1x/strafe");
        expect(cellVisible(20, "1xscope", "screen")).toBe(true);
        expect(cellVisible(28, "1xscope", "screen")).toBe(false);
        expect(cellVisible(28, "1xscope")).toBe(true);
        const seed = trialSeed(1, cell, 0);
        const a = runTrial(cell, seed);
        expect(runTrial(cell, seed)).toEqual(a);
        expect(a.seen).toBe(true);
        expect(a.firstShot).toBeGreaterThan(0.25);
    }, 30_000);

    it("the tier calibration holds its bands, rises with the tier and sits clearly below the presets", () => {
        const t = JSON.parse(readFileSync(new URL("./fixtures/aim-tiers.json", import.meta.url), "utf8")) as AimTiers;
        expect(tierGateFailures(t.summaries)).toEqual([]);
        const by = Object.fromEntries(t.summaries.map((s) => [s.label, s]));
        const tier = (name: keyof typeof TIER_BANDS) => {
            const s = t.summaries.find((x) => tierOfLabel(x.label) === name);
            if (!s) throw new Error(`no ${name} in the fixture`);
            return s;
        };
        const [beginner, intermediate, expert] = [tier("beginner"), tier("intermediate"), tier("expert")];
        // the user lost to an OT-38 bot (report 9): beginners miss clearly more than the old easy preset...
        expect(beginner.hit).toBeLessThan(by.easy.hit - 0.04);
        expect(beginner.kill).toBeLessThan(by.easy.kill - 0.1);
        expect(beginner.firstShot).toBeGreaterThan(by.easy.firstShot);
        // ...intermediates (the most common tier) miss clearly more than normal, the old server default...
        expect(intermediate.hit).toBeLessThan(by.normal.hit - 0.07);
        expect(intermediate.kill).toBeLessThan(by.normal.kill - 0.1);
        expect(intermediate.ot38["strafe/10"].kill).toBeLessThan(by.normal.ot38["strafe/10"].kill - 0.15);
        // ...and experts react slower than hard
        expect(expert.firstShot).toBeGreaterThan(by.hard.firstShot);
        expect(beginner.trials).toBeGreaterThanOrEqual(t.trialsPerCell * 50);
    });
});
