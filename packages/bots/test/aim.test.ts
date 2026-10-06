// The human cursor motor model (motor/*), measured on synthetic movements with fixed seeds: primary flicks bow like a
// wrist arc with the bot's handedness, have one bell-shaped speed peak, follow Fitts' law and mostly undershoot;
// corrections are few; pursuit lags a moving target by about pursuitLag and its error grows with the target's speed;
// tremor sits at 8-12 Hz; the 100 Hz and 33 Hz update rates trace the same cursor; the aim never jumps (anti-cheat
// snap measure). Plus the throw release that waits for the cursor.
import { createRng, type Vec2, v2 } from "@rebirth/core";
import { describe, expect, it } from "vitest";
import { ThrowController } from "../src/brain/trigger.ts";
import { DIFFICULTIES, DIFFICULTY_PRESETS, type Difficulty, type DifficultyParams } from "../src/difficulty.ts";
import { type Flick, flickPoint, indexOfDifficulty, planFlick, STEP } from "../src/motor/flick.ts";
import { HumanMotor, type MotorGoal } from "../src/motor/human.ts";
import { gaussian } from "../src/motor/noise.ts";
import type { SelfState } from "../src/perception/world.ts";

const ZERO = { x: 0, y: 0 };

function humanParams(d: Difficulty): DifficultyParams {
    const p = DIFFICULTY_PRESETS[d];
    return { ...p, motor: { ...p.motor, model: "human" } };
}

/** Drives a motor at 100 Hz with a goal function of time; returns the output after every update. */
function drive(
    motor: HumanMotor,
    t0: number,
    ticks: number,
    goal: (t: number) => MotorGoal | null,
    moveDir: Vec2 | null = null,
    zoom = 28,
): Vec2[] {
    const out: Vec2[] = [];
    for (let i = 1; i <= ticks; i++) {
        const now = t0 + i * STEP;
        motor.update({ dt: STEP, now, zoom, goal: goal(now), selfVel: ZERO, moveDir, lookAt: null });
        out.push(v2.copy(motor.output));
    }
    return out;
}

function target(rel: Vec2, at: number, firstSeen: number, vel: Vec2 = ZERO): MotorGoal {
    return { kind: "target", key: 7, rel, vel, at, firstSeen, reaction: 0.3 };
}

interface Acquisition {
    flicks: Flick[];
    outputs: Vec2[];
    corrections: number;
    hand: number;
}

/** A bot walks (idle cursor) for 0.5 s, then a stationary target appears at a random bearing and distance. */
function acquire(params: DifficultyParams, seed: number): Acquisition {
    const rng = createRng(5000 + seed);
    const motor = new HumanMotor(params, createRng(9000 + seed));
    const flicks: Flick[] = [];
    motor.onFlick = (f) => flicks.push(f);
    const walk = v2.rotate({ x: 1, y: 0 }, rng.range(0, 2 * Math.PI));
    const outputs = drive(motor, 0, 50, () => null, walk);
    flicks.length = 0;
    const bearing = rng.range(0, 2 * Math.PI);
    const dist = rng.range(6, 25);
    const rel = { x: Math.cos(bearing) * dist, y: Math.sin(bearing) * dist * 0.55 };
    outputs.push(...drive(motor, 0.5, 150, () => target(rel, 0.5, 0.5)));
    return { flicks, outputs, corrections: motor.corrections, hand: motor.hand };
}

function median(xs: readonly number[]): number {
    const s = [...xs].sort((a, b) => a - b);
    return s[s.length >> 1];
}

/** Path of a flick sampled every millisecond. */
function samplePath(f: Flick): Vec2[] {
    const n = Math.max(2, Math.round(f.mt * 1000));
    return Array.from({ length: n + 1 }, (_, k) => flickPoint(f, f.t0 + (k / n) * f.mt));
}

function signedDeviation(f: Flick): number {
    const u = v2.normalize(v2.sub(f.p1, f.p0));
    let dev = 0;
    for (const q of samplePath(f)) {
        const d = v2.det(u, v2.sub(q, f.p0));
        if (Math.abs(d) > Math.abs(dev)) dev = d;
    }
    return dev;
}

const acquisitions = new Map<Difficulty, Acquisition[]>();
function acquisitionsOf(d: Difficulty): Acquisition[] {
    let list = acquisitions.get(d);
    if (!list) {
        list = Array.from({ length: 300 }, (_, i) => acquire(humanParams(d), i));
        acquisitions.set(d, list);
    }
    return list;
}

function primaries(d: Difficulty): Array<{ f: Flick; hand: number }> {
    return acquisitionsOf(d).flatMap((a) =>
        a.flicks.filter((f) => f.kind === "primary").map((f) => ({ f, hand: a.hand })),
    );
}

describe("human motor: flicks", () => {
    for (const d of DIFFICULTIES) {
        it(`${d}: primary flicks bow like a wrist arc with the bot's handedness`, () => {
            const list = primaries(d);
            expect(list.length).toBeGreaterThanOrEqual(300);
            const curvature = list.map(({ f }) => Math.abs(signedDeviation(f)) / v2.distance(f.p0, f.p1));
            expect(median(curvature)).toBeGreaterThanOrEqual(0.03);
            expect(median(curvature)).toBeLessThanOrEqual(0.2);
            // horizontal strokes that do not pass the player (those bow away from it): deviation towards screen-up
            // (+y) for right-handed bots, down for left-handed ones
            let n = 0;
            let match = 0;
            for (const { f, hand } of list) {
                const u = v2.normalize(v2.sub(f.p1, f.p0));
                if (Math.abs(u.x) < 0.85 || Math.abs(f.kappa) >= 0.25) continue;
                const up = signedDeviation(f) * Math.sign(u.x) > 0;
                n++;
                if (up === hand > 0) match++;
            }
            expect(n).toBeGreaterThan(40);
            expect(match / n).toBeGreaterThanOrEqual(0.7);
        });

        it(`${d}: one bell-shaped speed peak near the middle of the movement`, () => {
            const peakAt: number[] = [];
            const ratio: number[] = [];
            let single = 0;
            const list = primaries(d);
            for (const { f } of list) {
                const pts = samplePath(f);
                const speed = pts.slice(1).map((p, i) => v2.distance(p, pts[i]));
                const mean = speed.reduce((a, b) => a + b, 0) / speed.length;
                const peak = Math.max(...speed);
                peakAt.push(speed.indexOf(peak) / speed.length);
                ratio.push(peak / mean);
                // local maxima above a fifth of the peak
                let maxima = 0;
                for (let i = 1; i < speed.length - 1; i++)
                    if (speed[i] > speed[i - 1] && speed[i] >= speed[i + 1] && speed[i] > 0.2 * peak) maxima++;
                if (maxima === 1) single++;
            }
            expect(single / list.length).toBeGreaterThanOrEqual(0.95);
            expect(median(peakAt)).toBeGreaterThanOrEqual(0.35);
            expect(median(peakAt)).toBeLessThanOrEqual(0.65);
            expect(median(ratio)).toBeGreaterThanOrEqual(1.6);
            expect(median(ratio)).toBeLessThanOrEqual(2.1);
        });

        it(`${d}: movement time follows Fitts' law`, () => {
            const m = humanParams(d).motor;
            const rng = createRng(77);
            const ids: number[] = [];
            const mts: number[] = [];
            for (let i = 0; i < 300; i++) {
                const id = 2.5 + (4 * i) / 299;
                const w = rng.range(1, 4);
                const dist = w * (2 ** id - 1);
                const from = { x: 10, y: 0 };
                const goal = v2.add(from, v2.rotate({ x: dist, y: 0 }, rng.range(0, 2 * Math.PI)));
                const f = planFlick(rng, {
                    kind: "primary",
                    now: 0,
                    from,
                    goal,
                    width: w,
                    fittsA: m.fittsA,
                    fittsB: m.fittsB,
                    gain: 1,
                    sigma: m.endpointSigma,
                    kappa: 0,
                });
                ids.push(indexOfDifficulty(f.d, f.w));
                mts.push(f.mt);
            }
            const mx = ids.reduce((a, b) => a + b) / ids.length;
            const my = mts.reduce((a, b) => a + b) / mts.length;
            let sxy = 0;
            let sxx = 0;
            let syy = 0;
            for (let i = 0; i < ids.length; i++) {
                sxy += (ids[i] - mx) * (mts[i] - my);
                sxx += (ids[i] - mx) ** 2;
                syy += (mts[i] - my) ** 2;
            }
            expect(sxy / sxx / m.fittsB).toBeGreaterThan(0.85);
            expect(sxy / sxx / m.fittsB).toBeLessThan(1.15);
            expect((sxy * sxy) / (sxx * syy)).toBeGreaterThan(0.8);
        });

        it(`${d}: primary flicks undershoot on average, 10-30% overshoot`, () => {
            const gains = primaries(d).map(({ f }) => v2.dot(v2.sub(f.p1, f.p0), v2.sub(f.goal, f.p0)) / f.d ** 2);
            const mean = gains.reduce((a, b) => a + b, 0) / gains.length;
            const over = gains.filter((g) => g > 1).length / gains.length;
            expect(mean).toBeGreaterThanOrEqual(0.92);
            expect(mean).toBeLessThanOrEqual(1);
            expect(over).toBeGreaterThanOrEqual(0.1);
            expect(over).toBeLessThanOrEqual(0.3);
        });

        it(`${d}: few corrective submovements`, () => {
            const counts = acquisitionsOf(d).map((a) => a.corrections);
            const zero = counts.filter((c) => c === 0).length / counts.length;
            const many = counts.filter((c) => c >= 2).length / counts.length;
            expect(zero).toBeGreaterThanOrEqual(0.4);
            expect(many).toBeLessThanOrEqual(0.2);
        });

        it(`${d}: the aim never jumps (no step over 30 degrees per 10 ms with the cursor 2.5+ units out)`, () => {
            let max = 0;
            for (const a of acquisitionsOf(d)) {
                for (let i = 1; i < a.outputs.length; i++) {
                    const p = a.outputs[i - 1];
                    const q = a.outputs[i];
                    if (v2.length(p) < 2.5 || v2.length(q) < 2.5) continue;
                    max = Math.max(max, Math.abs(Math.atan2(v2.det(p, q), v2.dot(p, q))));
                }
            }
            expect((max * 180) / Math.PI).toBeLessThanOrEqual(30);
        });
    }
});

/** Angle of `v` unwrapped next to `prev`. */
function unwrap(prev: number, v: Vec2): number {
    let a = Math.atan2(v.y, v.x);
    while (a - prev > Math.PI) a -= 2 * Math.PI;
    while (a - prev < -Math.PI) a += 2 * Math.PI;
    return a;
}

/**
 * A target at `dist` whose bearing follows `angle(t)`, seen every 30 ms (snapshot rate) with its velocity. Returns,
 * per 10 ms tick, the unwrapped bearings of the output cursor, of the hand's cursor (no tremor), of the point the bot
 * believes it should aim at (target plus drift) and of the target.
 */
function orbit(params: DifficultyParams, seed: number, dist: number, angle: (t: number) => number, ticks: number) {
    const motor = new HumanMotor(params, createRng(seed));
    const series = { output: [] as number[], hand: [] as number[], believed: [] as number[], truth: [] as number[] };
    let last = { output: angle(0), hand: angle(0), believed: angle(0) };
    for (let i = 1; i <= ticks; i++) {
        const now = i * STEP;
        const at = Math.floor((now - 1e-9) / 0.03) * 0.03;
        const a = angle(at);
        const da = (angle(at + 1e-4) - a) / 1e-4;
        const rel = { x: Math.cos(a) * dist, y: Math.sin(a) * dist };
        const goal = target(rel, at, 0, v2.mul({ x: -Math.sin(a), y: Math.cos(a) }, da * dist));
        motor.update({ dt: STEP, now, zoom: 28, goal, selfVel: ZERO, moveDir: null, lookAt: null });
        last = {
            output: unwrap(last.output, motor.output),
            hand: unwrap(last.hand, motor.cursor),
            believed: unwrap(last.believed, motor.believed ?? motor.cursor),
        };
        series.output.push(last.output);
        series.hand.push(last.hand);
        series.believed.push(last.believed);
        series.truth.push(angle(now));
    }
    return series;
}

/** A random bearing: angular velocity redrawn every 30 ms (AR(1), at most 0.6 rad/s), integrated. */
function randomBearing(seed: number): (t: number) => number {
    const rng = createRng(seed);
    const w: number[] = [0];
    for (let i = 1; i < 2000; i++) w.push(Math.max(-0.6, Math.min(0.6, 0.85 * w[i - 1] + 0.35 * gaussian(rng))));
    const angleAt: number[] = [0];
    for (let i = 1; i < 2000; i++) angleAt.push(angleAt[i - 1] + w[i - 1] * 0.03);
    return (t) => {
        const k = Math.min(1998, Math.floor(t / 0.03));
        return angleAt[k] + w[k] * (t - k * 0.03);
    };
}

describe("human motor: pursuit, tremor, stepping", () => {
    for (const d of DIFFICULTIES) {
        it(`${d}: pursuit lags a moving target by about pursuitLag`, () => {
            // an unpredictable target (its velocity changes at random), so prediction cannot hide the delay: the
            // hand's angular velocity follows the target's by the perception lag (cross-correlation peak)
            const params = humanParams(d);
            const lags: number[] = [];
            for (let s = 0; s < 6; s++) {
                const { hand, truth } = orbit(params, 400 + s, 20, randomBearing(300 + s), 1200);
                const hv = hand.slice(1).map((a, i) => a - hand[i]);
                const tv = truth.slice(1).map((a, i) => a - truth[i]);
                let best = 0;
                let bestCorr = Number.NEGATIVE_INFINITY;
                for (let lag = 0; lag <= 40; lag++) {
                    let sum = 0;
                    for (let i = 300; i < hv.length; i++) sum += hv[i] * tv[i - lag];
                    if (sum > bestCorr) {
                        bestCorr = sum;
                        best = lag;
                    }
                }
                lags.push(best * STEP);
            }
            const lag = lags.reduce((a, b) => a + b, 0) / lags.length;
            expect(Math.abs(lag - params.motor.pursuitLag)).toBeLessThanOrEqual(0.03);
        });

        it(`${d}: tracking error grows with the target's speed`, () => {
            const params = humanParams(d);
            const rms = [0, 4, 8, 12].map((speed) => {
                let sum = 0;
                let n = 0;
                for (let s = 0; s < 8; s++) {
                    const w = speed / 15;
                    const a0 = s;
                    // the hand against the point it aims at (the drift is the bot's belief, not tracking error)
                    const { output, believed } = orbit(params, 60 + s, 15, (t) => a0 + w * t, 400);
                    for (let i = 150; i < output.length; i++) {
                        // wrapped: both series are unwrapped on their own (a flick may go round either way)
                        const e = output[i] - believed[i];
                        sum += Math.atan2(Math.sin(e), Math.cos(e)) ** 2;
                        n++;
                    }
                }
                return Math.sqrt(sum / n);
            });
            for (let i = 1; i < rms.length; i++) expect(rms[i]).toBeGreaterThan(rms[i - 1]);
            // it keeps up: a few degrees at full running speed, never a lost target
            expect((rms[3] * 180) / Math.PI).toBeLessThan(10);
        });
    }

    it("tremor shakes the cursor at 8-12 Hz", () => {
        const motor = new HumanMotor(humanParams("easy"), createRng(3));
        const rel = { x: 15, y: 3 };
        drive(motor, 0, 150, () => target(rel, 0, 0));
        // 2.56 s of steady aim at a still target: the output minus the hand's cursor is the tremor
        const xs: number[] = [];
        const ys: number[] = [];
        for (let i = 1; i <= 256; i++) {
            motor.update({
                dt: STEP,
                now: 1.5 + i * STEP,
                zoom: 28,
                goal: target(rel, 0, 0),
                selfVel: ZERO,
                moveDir: null,
                lookAt: null,
            });
            xs.push(motor.output.x - motor.cursor.x);
            ys.push(motor.output.y - motor.cursor.y);
        }
        let band = 0;
        let total = 0;
        for (let k = 1; k < 128; k++) {
            const f = k / (256 * STEP);
            let p = 0;
            for (const series of [xs, ys]) {
                let re = 0;
                let im = 0;
                for (let i = 0; i < 256; i++) {
                    re += series[i] * Math.cos((2 * Math.PI * k * i) / 256);
                    im -= series[i] * Math.sin((2 * Math.PI * k * i) / 256);
                }
                p += re * re + im * im;
            }
            total += p;
            if (f >= 8 && f <= 12) band += p;
        }
        expect(total).toBeGreaterThan(0);
        expect(band / total).toBeGreaterThan(0.8);
        // a few hundredths of a unit at 1x: visible, not a miss by itself
        expect(Math.max(...xs.map(Math.abs))).toBeLessThan(0.2);
    });

    it("100 Hz and 33 Hz updates trace the same cursor (fixed 10 ms substeps)", () => {
        const params = humanParams("normal");
        const fast = new HumanMotor(params, createRng(11));
        const slow = new HumanMotor(params, createRng(11));
        const walk = { x: 0, y: -1 };
        // observations every 30 ms: walk, a target appears and moves, then a throw, then idle again
        const goalAt = (t: number): MotorGoal | null => {
            if (t < 0.3) return null;
            if (t < 1.5)
                return target({ x: 12 + 4 * t, y: 6 - 3 * t }, Math.floor(t / 0.03) * 0.03, 0.3, { x: 4, y: -3 });
            if (t < 2.2) return { kind: "throw", rel: { x: -10, y: 4 }, len: 9 };
            return null;
        };
        for (let k = 0; k < 90; k++) {
            const t = k * 0.03;
            const goal = goalAt(t);
            for (let j = 1; j <= 3; j++)
                fast.update({
                    dt: STEP,
                    now: t + j * STEP,
                    zoom: 28,
                    goal,
                    selfVel: ZERO,
                    moveDir: walk,
                    lookAt: null,
                });
            slow.update({ dt: 0.03, now: t + 0.03, zoom: 28, goal, selfVel: ZERO, moveDir: walk, lookAt: null });
            expect(slow.output.x).toBeCloseTo(fast.output.x, 9);
            expect(slow.output.y).toBeCloseTo(fast.output.y, 9);
        }
        expect(fast.acquisition).toBe(2);
    });

    it("the cursor stays on the screen and never sits on the player", () => {
        const motor = new HumanMotor(humanParams("hard"), createRng(5));
        // a target far outside the 1x screen vertically, then one right on top of the player
        const outs = [
            ...drive(motor, 0, 100, () => target({ x: 2, y: 40 }, 0, 0)),
            ...drive(motor, 1, 100, () => ({ ...target({ x: 0.1, y: 0 }, 1, 1), key: 8 })),
        ];
        for (const o of outs) {
            expect(Math.abs(o.x)).toBeLessThanOrEqual(28 + 0.1);
            expect(Math.abs(o.y)).toBeLessThanOrEqual(28 / (16 / 9) + 0.1);
            expect(v2.length(o)).toBeGreaterThan(0.3);
        }
    });
});

describe("throws with the human motor", () => {
    const self = (): SelfState =>
        ({
            pos: { x: 100, y: 100 },
            curWeapIdx: 3,
            weapons: [{ type: "" }, { type: "" }, { type: "" }, { type: "frag", ammo: 1 }],
            inventory: { frag: 1 },
        }) as unknown as SelfState;

    function releaseTime(aimReady: (t: number) => boolean): number {
        const tc = new ThrowController();
        tc.start({ item: "frag", pos: { x: 110, y: 100 }, cook: 1 }, 0);
        tc.update(0, self(), aimReady(0));
        for (let t = STEP; t < 3; t += STEP) {
            const out = tc.update(t, self(), aimReady(t));
            if (!out.shootHold) return t;
        }
        return Number.POSITIVE_INFINITY;
    }

    it("releases once the cook is done and the cursor rests on the throw point", () => {
        expect(releaseTime(() => true)).toBeCloseTo(1, 1);
        expect(releaseTime((t) => t > 1.3)).toBeCloseTo(1.3, 1);
    });

    it("releases anyway when the cook is 0.6 s overdue", () => {
        expect(releaseTime(() => false)).toBeCloseTo(1.6, 1);
    });
});
