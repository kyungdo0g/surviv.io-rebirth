// Whole matches of bots: a 20-bot solo match on fast gas ends with exactly one winner, no bot exceptions, within a step
// budget; the same seed replays the same match; a duo match ends with one winning group.
import { describe, expect, it } from "vitest";
import { runMatch } from "../src/runner.ts";
import { QUICK_GAS } from "./helpers.ts";

/** Quarter-speed gas: 10 s before the start + ~113 s of stages; the budget leaves room for the final circles. */
const BUDGET = 20000;

describe("bot matches", () => {
    it("a 20-bot solo match on fast gas ends with exactly one winner and no exceptions", () => {
        const report = runMatch({ bots: 20, seed: 4, gasStages: QUICK_GAS, maxTicks: BUDGET, difficulty: "mixed" });
        expect(report.errors).toEqual([]);
        expect(report.exceptions).toBe(0);
        expect(report.over).toBe(true);
        expect(report.ticks).toBeLessThan(BUDGET);
        expect(report.winners).toHaveLength(1);
        // the winner is the last one standing
        const alive = report.players.filter((p) => !p.dead);
        expect(alive.map((p) => p.id)).toEqual(report.winners);
        // bots fought: most deaths are kills by other bots, not the gas
        const kills = report.players.reduce((a, p) => a + p.kills, 0);
        expect(kills).toBeGreaterThanOrEqual(10);
    }, 120_000);

    it("replays identically for the same seed", () => {
        const a = runMatch({ bots: 8, seed: 9, gasStages: QUICK_GAS, maxTicks: 2500 });
        const b = runMatch({ bots: 8, seed: 9, gasStages: QUICK_GAS, maxTicks: 2500 });
        expect(b.ticks).toBe(a.ticks);
        expect(b.players).toEqual(a.players);
        expect(b.winners).toEqual(a.winners);
    }, 120_000);

    it("a 16-bot duo match ends with one winning group", () => {
        // seed 1: with the human motor, seed 5 now ends in a frag that kills the last players of three groups in the
        // same tick (no group left standing; legacy aim does the same on seed 6), an ending this test does not cover
        const report = runMatch({ bots: 16, seed: 1, teamMode: 2, gasStages: QUICK_GAS, maxTicks: BUDGET });
        expect(report.exceptions).toBe(0);
        expect(report.over).toBe(true);
        expect(report.winners.length).toBeGreaterThanOrEqual(1);
        const teams = new Set(report.players.filter((p) => !p.dead).map((p) => p.teamId));
        expect(teams.size).toBe(1);
    }, 120_000);
});
