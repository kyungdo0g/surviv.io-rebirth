// Round 3 and 4 match metrics (stage EVALUATE, user reports 19-30): the summaries and acceptance lines on synthetic
// records (deliberate containers without real interruptions, frags held too long, escape frags uncooked, the cook's
// rest time on the aim, concealment), and one small real match that fills the new counters.
import { describe, expect, it } from "vitest";
import { deliberateStats, fragStats, round3Lines, round3Stats } from "../src/metrics/round3Summary.ts";
import { emptyRound3, type FragRecord } from "../src/metrics/round3Types.ts";
import { emptyBotMetrics } from "../src/metrics/types.ts";
import { runMatch } from "../src/runner.ts";

function frag(edit: Partial<FragRecord>): FragRecord {
    return {
        t: 0,
        item: "frag",
        cook: 0.1,
        planned: 0,
        reason: "",
        fleeing: false,
        flight: 1.5,
        rest: 2.4,
        airborne: false,
        cookedOff: false,
        burstOff: 1,
        enemyDist: 20,
        blast: 12,
        enemyDmg: 0,
        teamDmg: 0,
        selfDmg: 0,
        enemiesHit: 0,
        ...edit,
    };
}

describe("round 3 metrics: summaries", () => {
    it("deliberate containers: real interruptions, unreachable and plated leave the rate", () => {
        const d = deliberateStats([
            {
                started: 100,
                broken: 90,
                abandoned: 10,
                ongoing: 0,
                plated: 1,
                reasons: { "left:fight": 4, died: 2, unreachable: 1, plated: 1, "left:zone": 2 },
            },
            undefined,
        ]);
        expect(d.interrupted).toBe(6);
        expect(d.unreachable).toBe(2);
        expect(d.completion.r).toBeCloseTo(90 / 92);
        expect(d.raw.r).toBeCloseTo(0.9);
    });

    it("frags: held too long, escape throws uncooked, rest on the aim, planned cooks without a reason", () => {
        const f = fragStats(
            [
                frag({ reason: "escape", cook: 0.1 }),
                frag({ reason: "escape", cook: 0.62, burstOff: 6 }),
                frag({ reason: "escape", cook: 3.66, rest: -1, flight: -1, airborne: true, burstOff: 18 }),
                frag({ reason: "cover", planned: 2, cook: 2, rest: 0.4, burstOff: 1, enemyDmg: 30, enemiesHit: 1 }),
                frag({ reason: "cover", planned: 2, cook: 2, rest: 1.6, burstOff: 8 }),
                frag({ reason: "none", planned: 1.5, cook: 1.5, rest: 0.5 }),
                frag({ cookedOff: true, cook: 4, planned: 2, reason: "cover", rest: -1, flight: -1 }),
            ],
            120,
            { "frag:forgot": 3, "cook:cover": 2 },
        );
        expect(f.throws).toBe(7);
        expect(f.perChanceMinute).toBeCloseTo(3.5);
        expect(f.escape).toBe(3);
        expect(f.escapeUncooked).toBe(1);
        expect(f.heldTooLong).toBe(1);
        expect(f.cookedOff).toBe(1);
        expect(f.cookedNoReason).toBe(1);
        expect(f.restOnAim.n).toBe(2);
        expect(f.hit.n).toBe(1);
        expect(f.forgot).toBe(3);
    });

    it("lines: bushes must hide, canopies only partly; unseen fire needs every reaction kind", () => {
        const a = emptyBotMetrics(1, {
            teamId: 1,
            tier: "beginner",
            persona: "rusher",
            difficulty: "easy",
            brain: "smart",
        });
        const r = emptyRound3();
        r.conceal.open = { samples: 1000, fire: 150 };
        r.conceal.canopy = { samples: 100, fire: 5 };
        r.conceal.bush = { samples: 100, fire: 0 };
        r.unseenEpisodes = 40;
        r.unseenReactions = { "cover+hold": 20, "run+none": 10, "push+return": 8, "none+none": 2 };
        a.r3 = r;
        const stats = round3Stats([a]);
        const lines = round3Lines(stats, {}, deliberateStats([]));
        const by = (id: string) => lines.find((l) => l.id === id)?.verdict;
        expect(by("r3-bush")).toBe("PASS");
        expect(by("r3-canopy")).toBe("PASS");
        expect(by("r3-unseen")).toBe("PASS");
        r.unseenReactions = { "cover+hold": 38, "none+none": 2 };
        expect(round3Lines(round3Stats([a]), {}, deliberateStats([])).find((l) => l.id === "r3-unseen")?.verdict).toBe(
            "FAIL",
        );
        r.conceal.canopy = { samples: 100, fire: 20 };
        expect(round3Lines(round3Stats([a]), {}, deliberateStats([])).find((l) => l.id === "r3-canopy")?.verdict).toBe(
            "FAIL",
        );
    });
});

describe("round 3 metrics: a real match", () => {
    it("fills the round 3 counters and the deliberate containers", () => {
        const report = runMatch({ seed: 3, bots: 24, difficulty: "normal", maxTicks: 9000, metrics: true });
        const m = report.metrics;
        if (!m) throw new Error("no metrics");
        expect(m.deliberate).toBeDefined();
        expect(m.deliberate?.started ?? 0).toBeGreaterThan(0);
        const s = round3Stats(m.bots);
        expect(s.conceal.open.d).toBeGreaterThan(0);
        expect(s.cover.samples).toBeGreaterThan(0);
        expect(s.lost.episodes).toBeGreaterThan(0);
        // a 24-bot match runs ~40 s alone and over 60 s when the machine is shared
    }, 180_000);
});
