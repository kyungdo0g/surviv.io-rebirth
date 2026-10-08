// A whole 50v50 match of bots (M7a, bot round 6): 100 bots on the faction map, squads inside the Red / Blue factions,
// quarter-speed gas, every bot on the default brain (the faction brain on). It must end with one faction left, no bot
// exceptions and no team kills, with the faction roles handed out, and the roles must be played: a bugle call or a
// revive happens somewhere in the match; the match metrics (HARNESS) track the two faction fronts.
import type { Game } from "@rebirth/sim";
import { describe, expect, it } from "vitest";
import { type MatchProbe, runMatch } from "../src/runner.ts";
import { QUICK_GAS } from "./helpers.ts";

/** Counts revives (a downed player standing up again) and bugle calls (read-only). */
class TeamPlayProbe implements MatchProbe {
    readonly name = "teamplay";
    revives = 0;
    bugles = 0;
    private readonly down = new Set<number>();
    readonly observer = {
        onShotFired: (_shooter: unknown, weapon: string) => {
            if (weapon === "bugle") this.bugles++;
        },
    };

    tick(game: Game): void {
        for (const p of game.players()) {
            if (p.dead) this.down.delete(p.id);
            else if (p.downed) this.down.add(p.id);
            else if (this.down.delete(p.id)) this.revives++;
        }
    }

    finish(): unknown {
        return { revives: this.revives, bugles: this.bugles };
    }
}

describe("50v50 bot match", () => {
    it("100 bots on the faction map: one faction wins, no exceptions, no team kills, roles handed out and played", () => {
        const teamplay = new TeamPlayProbe();
        const report = runMatch({
            faction: true,
            seed: 11,
            gasStages: QUICK_GAS,
            maxTicks: 30000,
            difficulty: "mixed",
            metrics: true,
            probes: [teamplay],
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
        // both factions got their Commander, Medic and Bugler (the v0.8.82 schedule: sim roles/roleRules.ts)
        expect(report.roles?.leader).toBe(2);
        expect(report.roles?.medic ?? 0).toBeGreaterThan(0);
        expect(report.roles?.bugler ?? 0).toBeGreaterThan(0);
        // the roles are played: somebody revived a faction member or blew the bugle
        expect(teamplay.bugles + teamplay.revives).toBeGreaterThan(0);
        // the metrics saw both factions face each other (centroid distance and spread every 30 s)
        const fronts = report.metrics?.faction ?? [];
        expect(fronts.length).toBeGreaterThan(0);
        expect(fronts[0].front).toBeGreaterThan(0);
        // (one thread runs the whole match with metrics on: 200-230 s of CPU and 250-560 s of wall time at load 8-13 on
        // 4 shared cores, where 240 s timed out before the bot overhaul's FIX stage too; user report 32 asked for more)
    }, 600_000);
});
