// A whole 50v50 match of bots (M7a): 100 bots on the faction map, squads inside the Red / Blue factions, quarter-speed
// gas. It must end with one faction left, no bot exceptions and no team kills, with the faction roles handed out; the
// match metrics (HARNESS) track the two faction fronts.
import { describe, expect, it } from "vitest";
import { runMatch } from "../src/runner.ts";
import { QUICK_GAS } from "./helpers.ts";

describe("50v50 bot match", () => {
    it("100 bots on the faction map: one faction wins, no exceptions, no team kills, roles handed out", () => {
        const report = runMatch({
            faction: true,
            seed: 11,
            gasStages: QUICK_GAS,
            maxTicks: 30000,
            difficulty: "mixed",
            metrics: true,
        });
        expect(report.players).toHaveLength(100);
        expect(report.errors).toEqual([]);
        expect(report.exceptions).toBe(0);
        expect(report.over).toBe(true);
        expect(report.teamKills).toBe(0);
        // the winners are the survivors of one faction
        expect([1, 2]).toContain(report.winningTeamId);
        const alive = report.players.filter((p) => !p.dead);
        expect(alive.every((p) => p.teamId === report.winningTeamId)).toBe(true);
        expect(report.teamAliveCounts?.filter((n) => n > 0)).toHaveLength(1);
        // both factions got their Commander
        expect(report.roles?.leader).toBe(2);
        // the metrics saw both factions face each other (centroid distance and spread every 30 s)
        const fronts = report.metrics?.faction ?? [];
        expect(fronts.length).toBeGreaterThan(0);
        expect(fronts[0].front).toBeGreaterThan(0);
        // (one thread runs the whole match with metrics on: 200-230 s of CPU and 250-560 s of wall time at load 8-13 on
        // 4 shared cores, where 240 s timed out before the bot overhaul's FIX stage too; user report 32 asked for more)
    }, 600_000);
});
