// Anti-cheat telemetry (M8): synthetic input streams for the heuristics (a perfect aimbot is flagged, a human-like
// player is not), the detectors on their own, threshold overrides and the match-level flag logic.
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createRng, type Rng } from "@rebirth/core";
import { emptyInput, type PlayerInput } from "@rebirth/sim";
import { describe, expect, it } from "vitest";
import { AimHistory, angleDeltaDeg, ConstantAimDetector, RateWindow, ramp } from "../src/anticheat/aim.ts";
import { MatchTelemetry } from "../src/anticheat/match.ts";
import { PlayerTelemetry } from "../src/anticheat/player.ts";
import { DEFAULT_THRESHOLDS, loadThresholds, mergeThresholds } from "../src/anticheat/thresholds.ts";

const FRAME_MS = 1000 / 60;
const DEG = Math.PI / 180;

function input(angle: number, len: number, move = 0): PlayerInput {
    return {
        ...emptyInput(),
        moveLeft: (move & 1) !== 0,
        moveRight: (move & 2) !== 0,
        moveUp: (move & 4) !== 0,
        moveDown: (move & 8) !== 0,
        toMouseDir: { x: Math.cos(angle), y: Math.sin(angle) },
        toMouseLen: len,
    };
}

/** Feeds a player's inputs at 60 Hz and its shots, keeping the clock. */
class Stream {
    readonly t: PlayerTelemetry;
    now = 0;
    angle = 0;
    move = 0;

    constructor(t: PlayerTelemetry) {
        this.t = t;
    }

    aim(angle: number, len = 12): void {
        this.now += FRAME_MS;
        this.angle = angle;
        this.t.onInput(input(angle, len, this.move), this.now);
    }

    /** One bullet of `gun` at the current time; `hit` puts it on an enemy `dist` units away. */
    shoot(gun: string, hit: boolean, dist: number): void {
        const shot = this.t.onShot(gun, 1, this.now);
        if (hit) this.t.onBulletHit(shot, dist);
    }
}

function sideOf(rng: Rng): number {
    return rng.next() < 0.5 ? -1 : 1;
}

/**
 * A "perfect" aimbot: wanders like a person, then the instant a target is chosen the aim jumps onto it in a single
 * input and fires; follow-up shots track the target exactly. Server spread still makes it miss a fifth of the time.
 */
function aimbotMatch(t: PlayerTelemetry, seed: number): void {
    const rng = createRng(seed);
    const s = new Stream(t);
    for (let e = 0; e < 20; e++) {
        for (let i = 0; i < 40; i++) s.aim(s.angle + rng.range(-0.6, 0.6) * DEG);
        const dist = rng.range(12, 30);
        let target = s.angle + sideOf(rng) * rng.range(60, 150) * DEG;
        const omega = rng.range(-2, 2) * DEG;
        s.aim(target, dist);
        for (let shot = 0; shot < 6; shot++) {
            s.shoot("ak47", rng.next() < 0.8, dist);
            for (let k = 0; k < 6; k++) {
                target += omega;
                s.aim(target, dist);
            }
        }
    }
}

/** Minimum-jerk position profile (human pointing movements have a bell-shaped speed curve). */
function minJerk(tau: number): number {
    return tau * tau * tau * (10 - 15 * tau + 6 * tau * tau);
}

/**
 * A human-like player: a new target is acquired with a flick spread over 8-15 inputs (bell-shaped speed, some
 * overshoot and a correction), the first shot follows a reaction delay, tracking is noisy, a third of the bullets
 * land, and movement keys change at a human pace.
 */
function humanMatch(t: PlayerTelemetry, seed: number): void {
    const rng = createRng(seed);
    const s = new Stream(t);
    const moves = [0, 1, 2, 4, 8, 5, 6, 9, 10];
    for (let e = 0; e < 20; e++) {
        for (let i = 0; i < 40; i++) {
            if (rng.next() < 0.06) s.move = moves[rng.int(0, moves.length - 1)];
            s.aim(s.angle + rng.range(-0.8, 0.8) * DEG);
        }
        const dist = rng.range(12, 30);
        const start = s.angle;
        const total = sideOf(rng) * rng.range(60, 150) * DEG;
        const overshoot = rng.range(1.03, 1.1);
        const n = rng.int(8, 15);
        for (let i = 1; i <= n; i++) {
            s.aim(start + total * overshoot * minJerk(i / n) + rng.range(-1, 1) * DEG, dist);
        }
        // correction back onto the target, then a reaction delay
        const settle = start + total;
        const m = rng.int(3, 6);
        const from = s.angle;
        for (let i = 1; i <= m; i++) s.aim(from + (settle - from) * minJerk(i / m) + rng.range(-0.5, 0.5) * DEG, dist);
        for (let i = rng.int(2, 6); i > 0; i--) s.aim(settle + rng.range(-1, 1) * DEG, dist);
        const omega = rng.range(-2, 2) * DEG;
        let target = settle;
        for (let shot = 0; shot < 6; shot++) {
            s.shoot("ak47", rng.next() < 0.35, dist);
            for (let k = 0; k < 6; k++) {
                target += omega;
                s.aim(target + rng.range(-1.5, 1.5) * DEG, dist);
            }
        }
    }
}

function telemetry(thresholds = DEFAULT_THRESHOLDS): PlayerTelemetry {
    return new PlayerTelemetry(7, "tester", "203.0.113.7", thresholds);
}

describe("synthetic streams", () => {
    it("flags a perfect aimbot (accuracy + snaps at the opening shot)", () => {
        for (const seed of [1, 2, 3]) {
            const t = telemetry();
            aimbotMatch(t, seed);
            const snap = t.snapshot();
            expect(snap.aim.snapRatio).toBe(1);
            expect(snap.accuracy).toBeGreaterThan(0.7);
            expect(snap.score).toBeGreaterThanOrEqual(DEFAULT_THRESHOLDS.flagScore);
            const codes = snap.components.map((c) => c.code);
            expect(codes).toContain("snap");
            expect(codes).toContain("accuracy");
        }
    });

    it("does not flag a human-like player", () => {
        for (const seed of [1, 2, 3, 4, 5]) {
            const t = telemetry();
            humanMatch(t, seed);
            const snap = t.snapshot();
            expect(snap.shots).toBe(120);
            expect(snap.aim.openingHits).toBeGreaterThan(0);
            expect(snap.aim.snapHits).toBe(0);
            expect(snap.aim.constantAimRuns).toBe(0);
            expect(snap.score).toBeLessThan(DEFAULT_THRESHOLDS.flagScore);
            expect(snap.score).toBe(0);
        }
    });

    it("a flick that ends right before the first shot is not a snap when it spans several inputs", () => {
        const t = telemetry();
        const s = new Stream(t);
        for (let e = 0; e < 10; e++) {
            s.now += 500;
            const start = s.angle;
            // 120 degrees in 6 inputs (peak step ~35 degrees), then the shot at once
            for (let i = 1; i <= 6; i++) s.aim(start + 120 * DEG * minJerk(i / 6), 20);
            s.shoot("mosin", true, 20);
        }
        expect(t.snapshot().aim).toMatchObject({ openingHits: 10, snapHits: 0 });
    });

    it("ignores aim swings with the cursor on the player and point-blank hits", () => {
        const t = telemetry();
        const s = new Stream(t);
        for (let e = 0; e < 10; e++) {
            s.now += 1000;
            // near the player a small mouse move swings the direction by 90 degrees
            s.aim(s.angle + 90 * DEG, 1);
            s.shoot("mosin", true, 20);
            s.now += 1000;
            s.aim(s.angle + 90 * DEG, 12);
            s.shoot("m870", true, 3);
        }
        const snap = t.snapshot();
        expect(snap.aim.snapHits).toBe(0);
        expect(snap.aim.openingHits).toBe(10);
    });

    it("detects a spin bot (constant aim deltas), input spam and movement key spam", () => {
        const t = telemetry();
        let now = 0;
        let angle = 0;
        // 20 s at 200 inputs/s, 7 degrees per input, strafing left/right every input
        for (let i = 0; i < 4000; i++) {
            now += 5;
            angle += 7 * DEG;
            t.onInput(input(angle, 10, i % 2 === 0 ? 1 : 2), now);
        }
        const snap = t.snapshot();
        const byCode = Object.fromEntries(snap.components.map((c) => [c.code, c.value]));
        expect(byCode.constant_aim).toBe(1);
        expect(byCode.input_rate).toBe(1);
        expect(byCode.move_spam).toBe(1);
        expect(snap.input.peakPerSecond).toBeGreaterThanOrEqual(199);
        // no shots: input oddities alone stay under the flag score
        expect(snap.score).toBe(50);
        expect(snap.score).toBeLessThan(DEFAULT_THRESHOLDS.flagScore);
    });

    it("needs enough bullets before accuracy counts", () => {
        const t = telemetry();
        const s = new Stream(t);
        for (let i = 0; i < 59; i++) {
            s.aim(0);
            s.shoot("ak47", true, 20);
        }
        expect(t.score().components.find((c) => c.code === "accuracy")).toBeUndefined();
        s.shoot("ak47", true, 20);
        expect(t.score().components.find((c) => c.code === "accuracy")?.value).toBe(1);
    });
});

describe("detectors", () => {
    it("angleDeltaDeg wraps to (-180, 180]", () => {
        expect(angleDeltaDeg(0, 90 * DEG)).toBeCloseTo(90);
        expect(angleDeltaDeg(170 * DEG, -170 * DEG)).toBeCloseTo(20);
        expect(angleDeltaDeg(-170 * DEG, 170 * DEG)).toBeCloseTo(-20);
        expect(angleDeltaDeg(0, Math.PI)).toBeCloseTo(180);
    });

    it("AimHistory measures the largest recent step inside the window", () => {
        const h = new AimHistory(8);
        h.push({ t: 0, angle: 0, len: 10 });
        h.push({ t: 16, angle: 80 * DEG, len: 10 });
        h.push({ t: 33, angle: 82 * DEG, len: 10 });
        h.push({ t: 50, angle: 83 * DEG, len: 10 });
        expect(h.maxRecentStepDeg(3, 0, 2)).toBeCloseTo(80);
        expect(h.maxRecentStepDeg(2, 0, 2)).toBeCloseTo(2);
        expect(h.maxRecentStepDeg(3, 20, 2)).toBeCloseTo(2);
        expect(h.maxRecentStepDeg(3, 0, 11)).toBe(0);
    });

    it("ConstantAimDetector counts every minRun constant deltas in a row", () => {
        const d = new ConstantAimDetector({ minRun: 5, minDeltaDeg: 1, toleranceDeg: 0.2 });
        for (let i = 0; i < 12; i++) d.push(3 + (i % 2) * 0.1);
        expect(d.runs).toBe(2);
        d.push(0);
        for (let i = 0; i < 4; i++) d.push(-2);
        expect(d.runs).toBe(2);
        d.push(-2);
        expect(d.runs).toBe(3);
        // varying deltas and a still mouse never make a run
        for (let i = 0; i < 20; i++) d.push(i % 2 ? 3 : 5);
        for (let i = 0; i < 20; i++) d.push(0.5);
        expect(d.runs).toBe(3);
        expect(d.longestRun).toBe(12);
    });

    it("RateWindow counts seconds over the limit", () => {
        const w = new RateWindow(10);
        for (let i = 0; i < 15; i++) w.add(i * 10);
        expect(w.spikeSeconds).toBe(1);
        for (let i = 0; i < 5; i++) w.add(2000 + i);
        expect(w.spikeSeconds).toBe(1);
        expect(w.peak).toBe(15);
    });

    it("ramp", () => {
        expect(ramp(0.5, 0.6, 0.8)).toBe(0);
        expect(ramp(0.7, 0.6, 0.8)).toBeCloseTo(0.5);
        expect(ramp(0.9, 0.6, 0.8)).toBe(1);
    });
});

describe("thresholds", () => {
    it("merges overrides from ANTICHEAT_CONFIG and ANTICHEAT_FLAG_SCORE", () => {
        const dir = mkdtempSync(join(tmpdir(), "rebirth-ac-"));
        try {
            const file = join(dir, "anticheat.json");
            writeFileSync(file, JSON.stringify({ snap: { angleDeg: 30 }, accuracy: { auto: { soft: 0.5 } } }));
            const th = loadThresholds(file, 70);
            expect(th.flagScore).toBe(70);
            expect(th.snap.angleDeg).toBe(30);
            expect(th.snap.windowInputs).toBe(DEFAULT_THRESHOLDS.snap.windowInputs);
            expect(th.accuracy.auto).toEqual({ ...DEFAULT_THRESHOLDS.accuracy.auto, soft: 0.5 });
            writeFileSync(file, JSON.stringify({ snap: { angleDeg: -1 } }));
            expect(() => loadThresholds(file)).toThrow(/snap\.angleDeg/);
            writeFileSync(file, JSON.stringify({ nope: 1 }));
            expect(() => loadThresholds(file)).toThrow(/ANTICHEAT_CONFIG/);
        } finally {
            rmSync(dir, { recursive: true, force: true });
        }
    });

    it("no single heuristic reaches the default flag score", () => {
        for (const w of Object.values(DEFAULT_THRESHOLDS.weights)) {
            expect(w).toBeLessThan(DEFAULT_THRESHOLDS.flagScore);
        }
    });
});

describe("MatchTelemetry", () => {
    it("flags once, again only after the score rose by reflagDelta, and ignores untracked players", () => {
        // one run of 30 constant deltas: 12.5 points, two: 25
        const th = mergeThresholds({ flagScore: 10, reflagDelta: 10, constantAim: { hardRuns: 2 } });
        const m = new MatchTelemetry(
            { getPlayer: () => undefined },
            {
                gameId: "g1",
                mapName: "main",
                teamMode: 1,
                thresholds: th,
                clock: () => 1_000,
            },
        );
        m.track(5, "spinner", "198.51.100.4");
        let angle = 0;
        const spin = (n: number) => {
            for (let i = 0; i < n; i++) m.onInput(5, input((angle += 7 * DEG), 10));
        };
        // untracked player inputs are ignored
        m.onInput(6, input(0, 10));
        spin(31);
        const first = m.evaluate();
        expect(first).toHaveLength(1);
        expect(first[0]).toMatchObject({ gameId: "g1", playerId: 5, name: "spinner", ip: "198.51.100.4" });
        expect(first[0].score).toBe(13);
        expect(first[0].components[0].code).toBe("constant_aim");
        expect(m.evaluate()).toHaveLength(0);
        // a second run: +12.5 points
        m.onInput(5, input(angle, 10));
        spin(31);
        const again = m.evaluate();
        expect(again).toHaveLength(1);
        expect(again[0].score).toBe(25);
        expect(m.liveScores().map((s) => s.playerId)).toEqual([5]);
        expect(m.snapshot(6)).toBeNull();
    });
});
