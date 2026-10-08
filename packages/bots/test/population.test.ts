// The population suite (bot overhaul HARNESS): the acceptance thresholds on synthetic match samples (each rule passes,
// fails or stays N/A as written in the triage), the per-tier summaries, and one small real match through the suite.
import { describe, expect, it } from "vitest";
import { cellOf, DEFAULT_SUITE, runSuiteTask, suitePlan, summarizeSuite } from "../scripts/populationLib.ts";
import type { SkillTierName } from "../src/difficulty.ts";
import { type MatchSample, summarizeCell } from "../src/metrics/summary.ts";
import { evaluateCell, passed, THRESHOLDS } from "../src/metrics/thresholds.ts";
import { type BotMetrics, emptyBotMetrics, type MatchMetrics } from "../src/metrics/types.ts";

const TIERS: SkillTierName[] = ["beginner", "intermediate", "expert"];

/** A decided solo match of `n` bots (ids 1..n, tiers in turn); `edit` fills each bot's counters. */
function sample(
    n: number,
    edit: (m: BotMetrics, i: number) => void = () => {},
    over: Partial<MatchSample> = {},
    metrics: Partial<MatchMetrics> = {},
): MatchSample {
    const bots = Array.from({ length: n }, (_, i) => {
        const m = emptyBotMetrics(i + 1, {
            teamId: i + 1,
            tier: TIERS[i % 3],
            persona: "neutral",
            difficulty: "normal",
            brain: "smart",
        });
        edit(m, i);
        return m;
    });
    return {
        cell: "population/smart",
        mode: "solo",
        seed: 1,
        gameSeconds: 300,
        wallMs: 1000,
        over: true,
        exceptions: 0,
        errors: [],
        winningTeamId: 1,
        winners: [1],
        roles: {},
        players: bots.map((m) => ({
            id: m.id,
            teamId: m.teamId,
            kills: 0,
            dead: m.id !== 1,
            timeAlive: 100,
            bullets: 1000,
            bulletHits: 200 + 100 * (TIERS.indexOf(m.tier) + 1),
        })),
        idle: { episodes: 0, seconds: 0, over15: 0, over15ByBehaviour: {} },
        metrics: {
            bots,
            containers: { hit: 10, broken: 9, abandoned: 1, plated: 0 },
            airdrops: [],
            alive: [{ t: 60, alive: n }],
            ...metrics,
        },
        ...over,
    };
}

/** Every bot fired `targeted` shots at players, `off` of them off the screen. */
function shots(targeted: number, off: number) {
    return (m: BotMetrics) => {
        m.targetedShots = targeted;
        m.offScreenShots = off;
    };
}

function verdicts(samples: MatchSample[], cell = "population/smart"): Record<string, string> {
    const out: Record<string, string> = {};
    for (const r of evaluateCell(summarizeCell(cell, samples))) out[r.id] = r.verdict;
    return out;
}

describe("acceptance thresholds", () => {
    it("every triage threshold is encoded", () => {
        const ids = THRESHOLDS.map((t) => t.id);
        for (const id of [
            "offscreen-shots",
            "concealed-first-shots",
            "exposure-p10",
            "chases-30",
            "chase-p95",
            "flees-60",
            "oscillation",
            "abandoned",
            "plated",
            "airdrop-inner",
            "frags-near",
            "weak-only-120",
            "wrong-slot",
            "s-tier",
            "holster",
            "boosts",
            "idle-15",
            "unsafe-revives",
            "hit-rate-tier",
            "win-share",
            "team-kills",
        ]) {
            expect(ids).toContain(id);
        }
    });

    it("judges rates only with enough samples", () => {
        // 30 targeted shots: too few to judge the off-screen share
        const few = verdicts([sample(3, shots(10, 5))]);
        expect(few["offscreen-shots"]).toBe("N/A");
        expect(few["exposure-p10"]).toBe("N/A");
        expect(few["s-tier"]).toBe("N/A");
        expect(few["win-share"]).toBe("N/A");
        expect(few["unsafe-revives"]).toBe("N/A"); // solo only
        const bad = verdicts([sample(3, shots(100, 2))]);
        expect(bad["offscreen-shots"]).toBe("FAIL");
        const good = verdicts([sample(3, shots(1000, 3))]);
        expect(good["offscreen-shots"]).toBe("PASS");
    });

    it("fails fast exposures, long chases and flights, oscillation, melee frags and unsafe revives", () => {
        const s = sample(3, (m, i) => {
            m.exposureLatency = Array.from({ length: 10 }, (_, k) => (k < 2 ? 0.05 : 0.4));
            if (i === 0) {
                m.chases = [
                    { duration: 45, patience: 30, unarmedTarget: true },
                    { duration: 40, patience: 30, unarmedTarget: false },
                ];
                m.flees = [61];
                m.oscMaxCycles = 2;
                m.fragReleases = 3;
                m.fragReleasesNear = 1;
                m.revives = 2;
                m.unsafeRevives = 1;
            }
        });
        const v = verdicts([{ ...s, mode: "duo" }]);
        expect(v["exposure-p10"]).toBe("FAIL");
        expect(v["chases-30"]).toBe("FAIL");
        expect(v["chase-p95"]).toBe("FAIL");
        expect(v["flees-60"]).toBe("FAIL");
        expect(v.oscillation).toBe("FAIL");
        expect(v["frags-near"]).toBe("FAIL");
        expect(v["unsafe-revives"]).toBe("FAIL");
        // the same with human timings and short episodes
        const ok = sample(3, (m) => {
            m.exposureLatency = Array.from({ length: 10 }, () => 0.3);
            m.chases = [{ duration: 12, patience: 10, unarmedTarget: false }];
            m.flees = [20];
            m.oscMaxCycles = 1;
            m.revives = 1;
        });
        const w = verdicts([{ ...ok, mode: "squad" }]);
        for (const id of ["exposure-p10", "chases-30", "chase-p95", "flees-60", "oscillation", "unsafe-revives"]) {
            expect(w[id]).toBe("PASS");
        }
    });

    it("pistol-only at 120 s, wrong-slot pistols, holstering, boosts and S-tier pickups", () => {
        const s = sample(30, (m, i) => {
            m.loadout = [
                {
                    t: 120,
                    alive: true,
                    best: i < 3 ? "D" : "A",
                    bestId: i < 3 ? "m9" : "ak47",
                    weakOnly: i < 3,
                    pistolOnly: i < 3,
                    unarmed: false,
                    seesBetter: false,
                },
            ];
            m.fightGunSamples = 10;
            m.wrongSlotPistol = i === 0 ? 1 : 0;
            m.travelSamples = 10;
            m.travelHolstered = 7;
            m.safeBoostSeconds = 30;
            m.safeBoostUses = 1;
            m.sTierSeen = i < 10 ? 1 : 0;
            m.sTierTaken = i < 9 ? 1 : 0;
        });
        const v = verdicts([s]);
        expect(v["weak-only-120"]).toBe("FAIL"); // 3 of 30 = 10%
        expect(v["wrong-slot"]).toBe("PASS"); // 1 of 300
        expect(v.holster).toBe("PASS"); // 70%
        expect(v.boosts).toBe("PASS"); // 30 uses in 15 safe minutes
        expect(v["s-tier"]).toBe("PASS"); // 9 of 10
    });

    it("hit rate must rise by tier; win share is judged on the population mix with enough decided matches", () => {
        const rising = verdicts([sample(9)]);
        expect(rising["hit-rate-tier"]).toBe("PASS");
        const flat = sample(9);
        for (const p of flat.players) p.bulletHits = 300;
        expect(verdicts([flat])["hit-rate-tier"]).toBe("FAIL");
        // 40 decided matches: the winner is bot 1 (beginner) 6 times, bot 2 (intermediate) 18, bot 3 (expert) 16
        const matches = Array.from({ length: 40 }, (_, k) => {
            const w = k < 6 ? 1 : k < 24 ? 2 : 3;
            return sample(3, () => {}, { winners: [w], winningTeamId: w, seed: k });
        });
        expect(verdicts(matches)["win-share"]).toBe("PASS");
        expect(verdicts(matches, "normal/smart")["win-share"]).toBe("N/A");
        const skewed = matches.map((m) => ({ ...m, winners: [3], winningTeamId: 3 }));
        expect(verdicts(skewed)["win-share"]).toBe("FAIL");
    });

    it("a 50v50 cell gates on exceptions and team kills only", () => {
        const s = sample(
            6,
            shots(1000, 500),
            { mode: "faction", cell: "faction/population/smart", teamKills: 0 },
            { faction: [{ t: 30, front: 200, spread: 30 }] },
        );
        const r = evaluateCell(summarizeCell(s.cell, [s]));
        const by = Object.fromEntries(r.map((x) => [x.id, x.verdict]));
        expect(by["offscreen-shots"]).toBe("INFO");
        expect(by["team-kills"]).toBe("PASS");
        expect(passed(r)).toBe(true);
        const tk = { ...s, teamKills: 2 };
        expect(passed(evaluateCell(summarizeCell(s.cell, [tk])))).toBe(false);
    });

    it("summaries group bots by tier and count wins per team member in team modes", () => {
        const s = sample(
            4,
            (m, i) => {
                m.teamId = i < 2 ? 1 : 2;
            },
            { mode: "duo" },
        );
        s.players = s.players.map((p, i) => ({ ...p, teamId: i < 2 ? 1 : 2 }));
        const c = summarizeCell("population/smart", [s]);
        expect(Object.keys(c.byTier).sort()).toEqual(["beginner", "expert", "intermediate"]);
        // team 1 (bots 1 and 2: beginner, intermediate) won: half a win each
        expect(c.byTier.beginner.wins).toBeCloseTo(0.5 + 0, 5);
        expect(c.byTier.intermediate.wins).toBeCloseTo(0.5, 5);
        expect(c.byTier.expert.wins).toBe(0);
        expect(c.overall.wins).toBeCloseTo(1, 5);
    });
});

describe("population suite", () => {
    it("plans seeds x modes x difficulties x brains plus the 50v50 smoke runs, one cell each", () => {
        const plan = suitePlan({ ...DEFAULT_SUITE, seeds: 2, difficulties: ["population", "normal"], faction: 1 });
        expect(plan).toHaveLength(2 * (3 * 2 + 1));
        expect(new Set(plan.map((t) => t.cell))).toEqual(
            new Set([
                cellOf("population", "smart", "solo"),
                cellOf("normal", "smart", "solo"),
                cellOf("population", "smart", "faction"),
                cellOf("normal", "smart", "faction"),
            ]),
        );
    });

    it("runs a small match with the metrics and evaluates every threshold", () => {
        const opts = { ...DEFAULT_SUITE, bots: 12, gasDiv: 8, maxTicks: 6000, seeds: 1, faction: 0 };
        const task = suitePlan({ ...opts, modes: ["duo"] })[0];
        const s = runSuiteTask(opts, task);
        expect(s.exceptions).toBe(0);
        expect(s.metrics.bots).toHaveLength(12);
        // the population mix with personas (the server's default) draws tiers and personas
        expect(new Set(s.metrics.bots.map((b) => b.tier)).size).toBeGreaterThan(1);
        expect(s.metrics.bots.some((b) => b.persona !== "neutral")).toBe(true);
        const [cell] = summarizeSuite([JSON.parse(JSON.stringify(s)) as MatchSample]);
        expect(cell.summary.cell).toBe("population/smart");
        expect(cell.results.map((r) => r.id)).toEqual(expect.arrayContaining(THRESHOLDS.map((t) => t.id)));
        expect(cell.results.find((r) => r.id === "exceptions")?.verdict).toBe("PASS");
    }, 120_000);
});
