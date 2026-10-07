// Round 5 (user report 36, "bot-typical stiff movement"): the movement statistics (src/metrics/moveStats.ts) on
// synthetic tracks, then a population match whose bots must move within bands around the owner's gameplay videos
// (HUMAN_REFERENCE). The bot motor before round 5 sat outside nearly every band: key holds p50 0.19 s, 3.3 direction
// changes and 39 reversals per moving second / minute, 10.9 stops a minute, moving 78% of the time in runs of 1.1 s
// (median) to 6.8 s (p90), and 66 reversals a minute in the busiest tenth of its 10 s windows.
import { describe, expect, it } from "vitest";
import { addTrack, emptyCounts, HUMAN_REFERENCE, moveStats, TRACK_HZ } from "../src/metrics/moveStats.ts";
import { runMatch } from "../src/runner.ts";

/** A track from a per-frame velocity function (u/s) at TRACK_HZ. */
function track(seconds: number, vel: (t: number) => { x: number; y: number }): { xs: number[]; ys: number[] } {
    const xs = [0];
    const ys = [0];
    for (let i = 1; i <= seconds * TRACK_HZ; i++) {
        const v = vel(i / TRACK_HZ);
        xs.push(xs[i - 1] + v.x / TRACK_HZ);
        ys.push(ys[i - 1] + v.y / TRACK_HZ);
    }
    return { xs, ys };
}

describe("movement statistics", () => {
    it("a straight run: one long hold, no change, a straight line, no stop", () => {
        const c = emptyCounts();
        const t = track(20, () => ({ x: 12, y: 0 }));
        addTrack(c, t.xs, t.ys);
        const s = moveStats(c);
        expect(s.movingShare).toBeGreaterThan(0.95);
        expect(s.changesPerSec).toBe(0);
        expect(s.reversalsPerMin).toBe(0);
        expect(s.stopsPerMin).toBe(0);
        expect(s.straightP50).toBeCloseTo(1, 3);
        expect(s.holdP50).toBeGreaterThan(19);
    });

    it("a strafe flipping every 0.5 s with a stop every 2 s", () => {
        const c = emptyCounts();
        const t = track(60, (s) => {
            if (s % 2 > 1.6) return { x: 0, y: 0 };
            return { x: Math.floor(s / 0.5) % 2 ? -12 : 12, y: 0 };
        });
        addTrack(c, t.xs, t.ys);
        const s = moveStats(c);
        // 0.4 s stopped every 2 s: 30 stops a minute; flips at 0.5, 1.0, 1.5 and across the stop
        expect(s.stopsPerMin).toBeGreaterThan(27);
        expect(s.stopsPerMin).toBeLessThan(33);
        expect(s.reversalsPerMin).toBeGreaterThan(100);
        expect(s.holdP50).toBeGreaterThan(0.3);
        expect(s.holdP50).toBeLessThan(0.55);
        expect(s.straightP50).toBeLessThan(0.3);
    });

    it("8-way motion: a turn of 45 degrees is a change, not a reversal; gaps split the track", () => {
        const c = emptyCounts();
        const t = track(20, (s) => (Math.floor(s) % 2 ? { x: 12, y: 0 } : { x: 8.5, y: 8.5 }));
        // a teleport (respawn, a downed crawl left out) in the middle
        for (let i = 300; i < 310; i++) {
            t.xs[i] = Number.NaN;
            t.ys[i] = Number.NaN;
        }
        addTrack(c, t.xs, t.ys);
        const s = moveStats(c);
        expect(s.reversalsPerMin).toBe(0);
        expect(s.changesPerSec).toBeGreaterThan(0.8);
        expect(s.changesPerSec).toBeLessThan(1.1);
    });
});

describe("bots move like the owner's videos", () => {
    it("a population match: holds, changes, reversals, stops and runs within the human bands", () => {
        const tracks = new Map<number, { xs: number[]; ys: number[] }>();
        let frame = -1;
        const report = runMatch({
            seed: 7,
            bots: 32,
            difficulty: "population",
            population: { personas: true },
            maxTicks: 15000,
            onTick(game, bots) {
                const f = Math.floor((game.tick * TRACK_HZ) / 100);
                if (f === frame) return;
                frame = f;
                for (const b of bots) {
                    const p = game.getPlayer(b.playerId);
                    if (!p) continue;
                    let t = tracks.get(b.playerId);
                    if (!t) tracks.set(b.playerId, (t = { xs: [], ys: [] }));
                    const walking = !p.dead && !p.downed;
                    t.xs.push(walking ? p.pos.x : Number.NaN);
                    t.ys.push(walking ? p.pos.y : Number.NaN);
                }
            },
        });
        expect(report.exceptions).toBe(0);
        const c = emptyCounts();
        for (const t of tracks.values()) addTrack(c, t.xs, t.ys);
        const s = moveStats(c);
        const h = HUMAN_REFERENCE;
        const msg = JSON.stringify(s);
        expect(s.seconds, msg).toBeGreaterThan(1000);
        // bands around the human reference (round 5 bots: see scripts/movestats.ts for the full table)
        expect(s.holdP50, msg).toBeGreaterThan(h.holdP50 * 0.8);
        expect(s.holdP50, msg).toBeLessThan(h.holdP50 * 1.5);
        expect(s.holdP90, msg).toBeGreaterThan(h.holdP90 * 0.7);
        expect(s.holdP90, msg).toBeLessThan(h.holdP90 * 1.4);
        expect(s.changesPerSec, msg).toBeGreaterThan(h.changesPerSec * 0.7);
        expect(s.changesPerSec, msg).toBeLessThan(h.changesPerSec * 1.3);
        expect(s.reversalsPerMin, msg).toBeGreaterThan(h.reversalsPerMin * 0.5);
        expect(s.reversalsPerMin, msg).toBeLessThan(h.reversalsPerMin * 1.6);
        expect(s.stopsPerMin, msg).toBeGreaterThan(h.stopsPerMin * 0.75);
        expect(s.stopsPerMin, msg).toBeLessThan(h.stopsPerMin * 1.5);
        expect(s.movingShare, msg).toBeGreaterThan(h.movingShare - 0.08);
        expect(s.movingShare, msg).toBeLessThan(h.movingShare + 0.08);
        expect(s.moveRunP90, msg).toBeLessThan(h.moveRunP90 * 1.5);
        expect(s.straightP50, msg).toBeGreaterThan(h.straightP50 - 0.08);
        expect(s.windowRevP90, msg).toBeLessThan(h.windowRevP90 * 2);
    }, 240_000);
});
