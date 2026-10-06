// Tournament smoke test: two seeds of 16 bots on fast gas, each played straight and mirrored (in-process, no worker
// threads): the matches end without exceptions, the brains split evenly and swap in the mirror, and the aggregate and
// the gate come out well formed.
import { describe, expect, it } from "vitest";
import {
    aggregate,
    brainFor,
    DEFAULT_TOURNAMENT,
    evaluate,
    formatReport,
    matchPlan,
    runTournamentMatch,
} from "../scripts/tournamentLib.ts";

describe("tournament", () => {
    it("brains alternate by unit and swap in the mirrored match", () => {
        expect([0, 1, 2, 3].map((i) => brainFor(i, "solo", false))).toEqual(["smart", "baseline", "smart", "baseline"]);
        expect([0, 1, 2, 3].map((i) => brainFor(i, "duo", true))).toEqual(["baseline", "baseline", "smart", "smart"]);
        expect(matchPlan(5, 10)).toEqual([
            { seed: 10, mirrored: false },
            { seed: 10, mirrored: true },
            { seed: 11, mirrored: false },
            { seed: 11, mirrored: true },
            { seed: 12, mirrored: false },
            { seed: 12, mirrored: true },
        ]);
    });

    it("two mirrored seeds of 16 bots run cleanly and aggregate sanely", () => {
        const opts = { ...DEFAULT_TOURNAMENT, bots: 16, gasDiv: 4, maxTicks: 20000 };
        const results = matchPlan(4, 21).map((task) => runTournamentMatch(opts, task));
        for (const r of results) {
            expect(r.errors).toEqual([]);
            expect(r.exceptions).toBe(0);
            expect(r.over).toBe(true);
            expect(r.winnerBrain).not.toBeNull();
            expect(r.players.filter((p) => p.brain === "smart")).toHaveLength(8);
            expect(r.mixedTeams).toBe(0);
        }
        // the mirror swaps every bot's brain
        expect(results[1].players.map((p) => p.brain)).toEqual(
            results[0].players.map((p) => (p.brain === "smart" ? "baseline" : "smart")),
        );
        const report = aggregate(results, "solo");
        expect(report.matches).toBe(4);
        expect(report.pairs).toBe(2);
        expect(report.decided).toBe(4);
        expect(report.smart.bots + report.baseline.bots).toBe(64);
        expect(report.smart.wins + report.baseline.wins).toBe(4);
        expect(report.h2h.smartOnBaseline + report.h2h.baselineOnSmart).toBeGreaterThan(5);
        expect(report.h2h.lo).toBeLessThanOrEqual(report.h2h.share);
        expect(report.h2h.hi).toBeGreaterThanOrEqual(report.h2h.share);
        for (const s of [report.smart, report.baseline]) {
            expect(s.meanPlacement).toBeGreaterThan(1);
            expect(s.meanPlacement).toBeLessThan(16);
            expect(s.kills).toBeGreaterThan(0);
            expect(s.damageDealt).toBeGreaterThan(0);
            expect(s.hitRate).toBeGreaterThan(0);
            expect(s.hitRate).toBeLessThan(1);
            expect(s.survival).toBeGreaterThan(0);
        }
        const gate = evaluate(report);
        expect(gate.checks).toHaveLength(7);
        expect(formatReport(report, gate, "smart")).toContain("gate:");
    }, 240_000);
});
