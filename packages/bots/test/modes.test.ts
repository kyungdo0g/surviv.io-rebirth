// Bots on the event maps (M7b): short quick-gas matches on every original event map end with one winner and no bot
// exceptions; on Cobalt every bot leaves the class menu with a class within a few seconds (ClassPicker), and a Cobalt
// squad match ends with one group.
import { getMapDef } from "@rebirth/defs";
import { describe, expect, it } from "vitest";
import { runMatch } from "../src/runner.ts";
import { QUICK_GAS } from "./helpers.ts";

const BUDGET = 20000;

describe("bots on event maps", () => {
    for (const mapName of ["desert", "woods", "snow", "halloween", "potato", "savannah", "turkey"]) {
        it(`a 12-bot solo match on ${mapName} ends with one winner and no exceptions`, () => {
            const report = runMatch({ mapName, bots: 12, seed: 7, gasStages: QUICK_GAS, maxTicks: BUDGET });
            expect(report.errors).toEqual([]);
            expect(report.exceptions).toBe(0);
            expect(report.over).toBe(true);
            expect(report.winners).toHaveLength(1);
        }, 120_000);
    }

    it("Cobalt: every bot picks a class within 5 s, the match ends with one winner", () => {
        const classes = getMapDef("cobalt").gameMode.perkModeRoles ?? [];
        let allClassedAt = -1;
        const report = runMatch({
            mapName: "cobalt",
            bots: 12,
            seed: 8,
            gasStages: QUICK_GAS,
            maxTicks: BUDGET,
            onTick: (game) => {
                if (allClassedAt >= 0) return;
                const players = [...game.players()];
                if (players.every((p) => p.dead || (classes.includes(p.role) && !p.awaitingClass))) {
                    allClassedAt = game.time;
                }
            },
        });
        expect(report.exceptions).toBe(0);
        expect(report.over).toBe(true);
        expect(allClassedAt).toBeGreaterThan(0);
        expect(allClassedAt).toBeLessThan(5);
        const assigned = Object.entries(report.roles).reduce((n, [r, k]) => n + (classes.includes(r) ? k : 0), 0);
        expect(assigned).toBe(12);
    }, 120_000);

    it("Cobalt squads: a 16-bot match ends with one group and no exceptions", () => {
        const report = runMatch({
            mapName: "cobalt",
            bots: 16,
            seed: 9,
            teamMode: 4,
            gasStages: QUICK_GAS,
            maxTicks: BUDGET,
        });
        expect(report.exceptions).toBe(0);
        expect(report.over).toBe(true);
        expect(new Set(report.players.filter((p) => !p.dead).map((p) => p.teamId)).size).toBe(1);
    }, 120_000);
});
