// A whole 50v50 match of bots (M7a): 100 bots on the faction map, squads inside the Red / Blue factions, quarter-speed
// gas. It must end with one faction left, no bot exceptions and no team kills, with the faction roles handed out.
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
    }, 240_000);
});
