// The human cursor motor model (motor model "human"): the bot moves a cursor like a hand moves a mouse. State: the
// cursor relative to the player (world units) and its velocity, integrated in fixed 10 ms substeps so the 100 Hz
// in-process controller and the ~33 Hz NetworkBot trace the same path. A new target is acquired with a ballistic flick
// (motor/flick.ts) that starts 55% of the brain's reaction time after the sighting (never before onsetFloor), then up
// to two corrective submovements, then smooth pursuit (motor/pursuit.ts). The hand works from a delayed percept of the
// target (the pursuit lag, partly extrapolated); the trigger finger judges "on target" from the same percept. A slowly
// wandering error (smoothed OU drift) shifts where the bot believes it should aim and hand tremor shakes the cursor
// (motor/noise.ts). The bot's own movement is predicted (efference copy) for SELF_COMP of the bearing change it causes,
// with a gain that wanders once that bearing turns fast (SELF_COMP_SD from WANDER_FROM, in full from WANDER_FULL: no
// hand cancels a fast turn of its own exactly; a fixed gain turned the cursor at a perfectly constant rate while the bot
// walked past a crate it aimed at, which the server's constant-aim detector flags; slow turns, a fight at range, keep
// the exact gain); the rest the pursuit has to follow. Without a target the cursor rests ahead of the walking direction
// (35 degree dead zone) or glances at Intent.lookAt; throws put it at the throw distance. The cursor stays on the visible screen
// (motor/screen.ts) and never turns faster than 1300 deg/s. Draws only from its own rng stream, so motor noise never
// shifts the brain's decisions.
import { type Rng, type Vec2, v2 } from "@rebirth/core";
import type { DifficultyParams, MotorParams } from "../difficulty.ts";
import { angleDelta, angleOf } from "../geom.ts";
import {
    capTurnRate,
    type Flick,
    type FlickKind,
    flickPoint,
    HIT_HALF_WIDTH,
    planFlick,
    STEP,
    wristKappa,
} from "./flick.ts";
import { gaussian, OuProcess, SmoothDrift, Tremor } from "./noise.ts";
import { Pursuit } from "./pursuit.ts";
import { limitCursor, MIN_RADIUS, screenEdge } from "./screen.ts";

/** The hand starts its flick this share of the brain's reaction after a sighting (never before params.onsetFloor). */
export const ONSET_SHARE = 0.55;
const DEG = Math.PI / 180;
/** Drift of the believed aim point: OU time constant (s), smoothing (s), stationary sd as a fraction of aimErrorDeg. */
const DRIFT_TAU = 0.35;
const DRIFT_SMOOTH = 0.1;
const DRIFT_SCALE = 0.6;
/** Fraction of the bearing change caused by the bot's own movement that the hand predicts... */
const SELF_COMP = 0.85;
/** ...with this wander of the gain (OU: sd as a fraction of SELF_COMP, correlation time in seconds)... */
const SELF_COMP_SD = 0.35;
const SELF_COMP_TAU = 0.05;
/**
 * ...when the bearing turns faster than WANDER_FROM (rad/s), in full from WANDER_FULL: the detector counts turns of
 * 1.5 degrees per input, 50 deg/s at the 33 Hz a NetworkBot sends.
 */
const WANDER_FROM = 0.6;
const WANDER_FULL = 1.2;
/** Safety cap on the cursor's angular speed (1300 deg/s), per substep. */
const MAX_STEP_ANGLE = 1300 * DEG * STEP;
/** Cursor radius bounds while aiming (world units) and the low-pass of the radius towards the target's distance. */
const MIN_AIM_RADIUS = 4;
const RADIUS_TAU = 0.4;
/** Targets closer than this get a comfortable cursor radius of U(6, 10) instead of their distance. */
const NEAR_DIST = 8;
/** Corrective submovements after the primary flick (3 submovements in all), then pursuit. */
const MAX_CORRECTIONS = 2;
/**
 * Pursuit re-flicks when the error exceeds this many hitbox widths for REFLICK_PERSIST seconds (a catch-up saccade
 * needs a lasting error: the lead point flipping with a strafing target is left to the pursuit).
 */
const REFLICK_WIDTHS = 2.5;
const REFLICK_PERSIST = 0.12;
const IDLE_DEADZONE = 35 * DEG;
const GLANCE_DEADZONE = 10 * DEG;
/** Throws: the cursor is ready within this distance of the throw point and below this speed. */
export const THROW_READY_DIST = 0.6;
export const THROW_READY_SPEED = 3;
/** Scale of the pursuit's speed noise (calibrated with scripts/aimbench.ts). */
const PURSUIT_NOISE_GAIN = 1;
/** At most this many substeps per update (a stalled connection does not replay seconds of motion). */
const MAX_SUBSTEPS = 50;
const THROW_KEY = -2;

/** Aim at a contact (key = its id) or at a point (key -1: an obstacle to break, a spot to watch). */
export interface TargetGoal {
    kind: "target";
    key: number;
    /** the brain's aim point (the target's position plus its lead) relative to the player at bot time `at` */
    rel: Vec2;
    /** the target's own velocity (world units/s) */
    vel: Vec2;
    at: number;
    /** start of the current sighting and the reaction time the brain drew for this target (bot clock, s) */
    firstSeen: number;
    reaction: number;
}

/** Put the cursor `len` units towards the throw point `rel` (relative to the player). */
export interface ThrowGoal {
    kind: "throw";
    rel: Vec2;
    len: number;
}

export type MotorGoal = TargetGoal | ThrowGoal;

export interface MotorInput {
    dt: number;
    /** bot clock at the end of this update (s) */
    now: number;
    /** zoom radius in world units (1 screen unit): half the screen width */
    zoom: number;
    goal: MotorGoal | null;
    /** the bot's own velocity (world units/s) */
    selfVel: Vec2;
    /** walking direction (unit) or null */
    moveDir: Vec2 | null;
    /** point to glance at while idle, relative to the player */
    lookAt: Vec2 | null;
}

type Phase = "hold" | "wait" | "flick" | "dwell" | "track";

export class HumanMotor {
    /** the hand's cursor relative to the player (no tremor) and its velocity (units/s) */
    cursor: Vec2;
    vel: Vec2 = { x: 0, y: 0 };
    /** cursor plus tremor: what the input carries (toMouseDir / toMouseLen) */
    output: Vec2;
    /**
     * Where the bot believes it should aim, as it perceives it now (lagged percept, partly extrapolated, drift
     * included) at the target's distance, relative to the player; the throw point while throwing; null idle.
     */
    aim: Vec2 | null = null;
    /** velocity of the aim point relative to the player (units/s) */
    aimVel: Vec2 = { x: 0, y: 0 };
    /** where the bot believes the aim point is right now (no perception lag; drift included), relative; null idle */
    believed: Vec2 | null = null;
    /** acquisitions so far: a new one restarts the trigger's confirmation */
    acquisition = 0;
    /** corrective submovements of the current acquisition */
    corrections = 0;
    /** called with every planned submovement (tests, diagnostics) */
    onFlick: ((f: Flick) => void) | null = null;
    /** handedness: wrist-arc curvature of horizontal strokes (negative bows down: left-handed) */
    readonly hand: number;
    readonly restRadius: number;
    private readonly params: DifficultyParams;
    private readonly m: MotorParams;
    private readonly rng: Rng;
    private readonly tremor: Tremor;
    private readonly drift: SmoothDrift;
    private readonly pursuit: Pursuit;
    /** wander of the efference copy's gain (SELF_COMP_SD) */
    private readonly selfGain: OuProcess;
    private zoom = 28;
    private k = -1;
    private pending = 0;
    private phase: Phase = "hold";
    private flick: Flick | null = null;
    /** frame angle when the flick was planned (own movement rotates the flick with the frame) */
    private flickPhi = 0;
    /** the current flick's own top speed per substep (flick.ts capTurnRate; Infinity: the safety cap only) */
    private flickCap = Number.POSITIVE_INFINITY;
    /** target motion a corrective stroke rides on (pursuit continues under it), compensated frame */
    private carry: Vec2 = { x: 0, y: 0 };
    private key = 0;
    private firstSeen = 0;
    private waitUntil = 0;
    private dwellUntil = 0;
    private idleAt = Number.POSITIVE_INFINITY;
    private offSince = Number.POSITIVE_INFINITY;
    private rc = 8;
    private nearR = 8;
    /** accumulated bearing compensation of the bot's own movement: the pursuit works in a frame rotated by it */
    private phi = 0;
    private lastPoint: { rel: Vec2; at: number } | null = null;

    constructor(params: DifficultyParams, rng: Rng) {
        this.params = params;
        this.m = params.motor;
        this.rng = rng;
        this.hand = rng.range(0.06, 0.16) * (rng.bool(0.1) ? -1 : 1);
        this.restRadius = rng.range(6, 12);
        this.tremor = new Tremor(rng);
        this.drift = new SmoothDrift(rng, DRIFT_TAU, DRIFT_SMOOTH, DRIFT_SCALE * params.aimErrorDeg * DEG);
        this.pursuit = new Pursuit(rng);
        this.selfGain = new OuProcess(rng, SELF_COMP_TAU, SELF_COMP_SD);
        this.cursor = { x: this.restRadius, y: 0 };
        this.output = v2.copy(this.cursor);
    }

    /** Motor clock (s): the time of the last substep. */
    get time(): number {
        return this.k * STEP;
    }

    get mouseDir(): Vec2 {
        return v2.normalizeSafe(this.output, { x: 1, y: 0 });
    }

    get mouseLen(): number {
        return v2.length(this.output);
    }

    /** Throws: the cursor rests on the throw point. */
    get aimReady(): boolean {
        if (this.key !== THROW_KEY || !this.aim) return false;
        return v2.distance(this.cursor, this.aim) <= THROW_READY_DIST && v2.length(this.vel) < THROW_READY_SPEED;
    }

    /** Advances the hand by `input.dt` in fixed substeps. */
    update(input: MotorInput): void {
        if (this.k < 0) this.k = Math.round((input.now - input.dt) / STEP);
        this.zoom = input.zoom;
        this.retarget(input);
        this.pending += input.dt;
        let n = Math.floor(this.pending / STEP + 1e-6);
        this.pending = Math.max(0, this.pending - n * STEP);
        if (n > MAX_SUBSTEPS) n = MAX_SUBSTEPS;
        for (let i = 0; i < n; i++) {
            this.k++;
            this.substep(input, this.k * STEP);
        }
        const trem = this.tremor.at(this.time, this.m.tremor * this.zoom);
        this.output = v2.add(this.cursor, trem);
    }

    /** A new goal (or a new sighting of the same target) starts a new acquisition. */
    private retarget(input: MotorInput): void {
        const g = input.goal;
        const key = !g ? 0 : g.kind === "throw" ? THROW_KEY : g.key;
        const t0 = this.time;
        const startBot = input.now - input.dt;
        if (key !== this.key) {
            this.key = key;
            this.flick = null;
            this.idleAt = Number.POSITIVE_INFINITY;
            this.lastPoint = null;
            if (!g) {
                this.phase = "hold";
                return;
            }
            this.begin();
            if (g.kind === "throw") {
                this.waitUntil = t0 + this.rng.range(0.02, 0.06);
                return;
            }
            this.firstSeen = g.firstSeen;
            this.waitUntil = t0 + this.onsetDelay(g, startBot);
            if (key < 0) this.lastPoint = { rel: g.rel, at: g.at };
            return;
        }
        if (g?.kind !== "target") return;
        if (g.key > 0 && g.firstSeen !== this.firstSeen) {
            // the target came back into view: reacquire unless the cursor still follows it
            this.firstSeen = g.firstSeen;
            const tracking = (this.phase === "track" || this.phase === "dwell") && this.withinReflick();
            if (!tracking) {
                this.begin();
                this.waitUntil = t0 + this.onsetDelay(g, startBot);
            }
        } else if (g.key < 0) {
            // a point goal that jumps (another obstacle, another spot) is a new acquisition
            const last = this.lastPoint;
            const expected = last ? v2.add(last.rel, v2.mul(input.selfVel, last.at - g.at)) : g.rel;
            if (v2.distance(expected, g.rel) > 3 && this.phase !== "wait") {
                this.begin();
                this.waitUntil = t0 + this.rng.range(0.05, 0.15);
            }
            this.lastPoint = { rel: g.rel, at: g.at };
        }
    }

    private begin(): void {
        this.acquisition++;
        this.corrections = 0;
        this.flick = null;
        this.phase = "wait";
        this.pursuit.reset();
        this.rc = v2.length(this.cursor);
        this.nearR = this.rng.range(6, 10);
        this.offSince = Number.POSITIVE_INFINITY;
    }

    /**
     * Delay before the primary flick: 55% of the brain's reaction time after the sighting (its fire gate stays), never
     * sooner than params.onsetFloor after it (bot overhaul COMBAT-4: the hard preset flicked 0.09-0.13 s after a target
     * appeared, below the human visuomotor floor; diagnosis round 1 issue 1 RC4).
     */
    private onsetDelay(g: TargetGoal, startBot: number): number {
        if (g.key < 0) return this.rng.range(0.05, 0.15);
        const onset = g.firstSeen + Math.max(ONSET_SHARE * g.reaction, this.params.onsetFloor);
        return Math.max(onset - startBot, 0.2 * g.reaction);
    }

    private substep(input: MotorInput, t: number): void {
        this.drift.step(STEP);
        this.selfGain.step(STEP);
        const prev = this.cursor;
        const prevPhi = this.phi;
        const g = input.goal;
        if (g?.kind === "target") this.stepTarget(g, input.selfVel, t);
        else if (g?.kind === "throw") this.stepThrow(g, t);
        else this.stepIdle(input, t);
        const cap = this.phase === "flick" ? Math.min(MAX_STEP_ANGLE, this.flickCap) : MAX_STEP_ANGLE;
        this.cursor = limitCursor(this.zoom, prev, this.cursor, cap);
        this.vel = v2.div(v2.sub(this.cursor, prev), STEP);
        // the hand moved only as far as the limits let it (pursuit velocity lives in the compensated frame)
        if (this.phase === "track") {
            const moved = v2.sub(v2.rotate(this.cursor, -this.phi), v2.rotate(prev, -prevPhi));
            this.pursuit.vel = v2.div(moved, STEP);
        }
    }

    private stepTarget(g: TargetGoal, selfVel: Vec2, t: number): void {
        const m = this.m;
        const relVel = v2.sub(g.vel, selfVel);
        const ahead = Math.max(-0.1, Math.min(0.2, t - g.at));
        const a = v2.rotate(v2.add(g.rel, v2.mul(relVel, ahead)), this.drift.value);
        const d = Math.max(v2.length(a), MIN_RADIUS);
        const dir = v2.div(a, d);
        // own movement: the bearing change it causes is predicted (no lag) for SELF_COMP of it
        const turn = v2.det(a, v2.neg(selfVel)) / (d * d);
        const wander = Math.min(1, Math.max(0, (Math.abs(turn) - WANDER_FROM) / (WANDER_FULL - WANDER_FROM)));
        const gain = SELF_COMP * Math.max(0, 1 + wander * this.selfGain.value);
        const dphi = gain * turn * STEP;
        this.phi += dphi;
        this.rc += ((d > NEAR_DIST ? d : this.nearR) - this.rc) * (STEP / RADIUS_TAU);
        this.pursuit.push(v2.rotate(v2.mul(dir, this.clampRadius(this.rc, dir)), -this.phi));
        // the percept the hand and the trigger finger work from: delayed by the pursuit lag, partly extrapolated
        const lag = Math.round(m.pursuitLag / STEP);
        const seen = v2.add(this.pursuit.past(lag), v2.mul(this.pursuit.velocityAt(lag), m.pursuitLag * m.pursuitPred));
        this.aim = v2.mul(v2.normalizeSafe(v2.rotate(seen, this.phi), dir), d);
        this.believed = a;
        this.aimVel = v2.rotate(relVel, this.drift.value);
        const engaged = this.phase === "flick" || this.phase === "dwell" || this.phase === "track";
        if (engaged) this.cursor = v2.rotate(this.cursor, dphi);
        switch (this.phase) {
            case "wait":
            case "hold":
                if (t >= this.waitUntil) this.primary(rotateDrift(g.vel, this.drift.value), t);
                return;
            case "flick":
                if (this.flick?.kind === "correction") {
                    // a correction happens while the eye already tracks: it rides on the target's perceived motion
                    this.carry = v2.add(this.carry, v2.mul(this.pursuit.perceivedVelocity(m), m.pursuitKv * STEP));
                }
                this.followFlick(t);
                return;
            case "dwell": {
                // the hand rests after the movement, carried along with the target's perceived motion
                const vt = v2.rotate(this.pursuit.perceivedVelocity(m), this.phi);
                this.cursor = v2.add(this.cursor, v2.mul(vt, m.pursuitKv * STEP));
                if (t >= this.dwellUntil) this.afterDwell(t);
                return;
            }
            case "track": {
                const cf = this.pursuit.step(v2.rotate(this.cursor, -this.phi), m, PURSUIT_NOISE_GAIN);
                this.cursor = v2.rotate(cf, this.phi);
                if (this.withinReflick()) {
                    this.offSince = Number.POSITIVE_INFINITY;
                } else if (this.offSince === Number.POSITIVE_INFINITY) {
                    this.offSince = t;
                } else if (t - this.offSince >= REFLICK_PERSIST - 1e-9) {
                    this.corrections = 0;
                    this.primary(rotateDrift(g.vel, this.drift.value), t);
                }
                return;
            }
        }
    }

    private stepThrow(g: ThrowGoal, t: number): void {
        const dir = v2.normalizeSafe(g.rel, v2.normalizeSafe(this.cursor));
        const goal = v2.mul(dir, Math.min(Math.max(g.len, MIN_RADIUS), screenEdge(this.zoom, dir)));
        this.aim = goal;
        this.believed = goal;
        this.aimVel = { x: 0, y: 0 };
        this.pursuit.push(v2.rotate(goal, -this.phi));
        const err = v2.distance(this.cursor, goal);
        switch (this.phase) {
            case "wait":
            case "hold":
                if (t >= this.waitUntil) this.throwFlick(goal, t);
                return;
            case "flick":
                this.followFlick(t);
                return;
            case "dwell":
                if (t < this.dwellUntil) return;
                if (err > THROW_READY_DIST && this.corrections <= MAX_CORRECTIONS) {
                    this.corrections++;
                    const gain = 1 + 0.04 * gaussian(this.rng);
                    this.plan("correction", goal, 2 * THROW_READY_DIST, gain, 0.05 * gaussian(this.rng), t);
                } else {
                    this.startTracking();
                }
                return;
            case "track": {
                const cf = this.pursuit.step(v2.rotate(this.cursor, -this.phi), this.m, 0);
                this.cursor = v2.rotate(cf, this.phi);
                if (err > 4) {
                    this.corrections = 0;
                    this.throwFlick(goal, t);
                }
                return;
            }
        }
    }

    private throwFlick(goal: Vec2, t: number): void {
        const gain = 0.96 + 0.05 * gaussian(this.rng);
        const kappa = wristKappa(this.rng, v2.sub(goal, this.cursor), this.hand);
        this.plan("throw", goal, 2 * THROW_READY_DIST, gain, kappa, t);
    }

    private stepIdle(input: MotorInput, t: number): void {
        this.aim = null;
        this.believed = null;
        this.aimVel = { x: 0, y: 0 };
        if (this.phase === "flick" && this.flick) {
            this.cursor = flickPoint(this.flick, t);
            if (t >= this.flick.t0 + this.flick.mt - 1e-9) this.phase = "hold";
            return;
        }
        this.phase = "hold";
        let goal: Vec2 | null = null;
        let zone = IDLE_DEADZONE;
        const look = input.lookAt;
        if (look && v2.length(look) > 1e-3) {
            const dir = v2.normalize(look);
            goal = v2.mul(dir, this.clampRadius(v2.length(look), dir));
            zone = GLANCE_DEADZONE;
        } else if (input.moveDir) {
            const dir = v2.normalizeSafe(input.moveDir);
            goal = v2.mul(dir, Math.min(this.restRadius, screenEdge(this.zoom, dir)));
        }
        if (!goal || Math.abs(angleDelta(angleOf(this.cursor), angleOf(goal))) <= zone) {
            this.idleAt = Number.POSITIVE_INFINITY;
            return;
        }
        if (this.idleAt === Number.POSITIVE_INFINITY) {
            this.idleAt = t + (zone === GLANCE_DEADZONE ? this.rng.range(0.06, 0.2) : this.rng.range(0.1, 0.35));
        }
        if (t < this.idleAt) return;
        this.idleAt = Number.POSITIVE_INFINITY;
        const kappa = wristKappa(this.rng, v2.sub(goal, this.cursor), this.hand);
        this.plan("idle", goal, 0.35 * v2.length(goal), 0.96 + 0.05 * gaussian(this.rng), kappa, t);
    }

    /** The primary flick at the perceived target: lead it over the movement time, then plan the stroke. */
    private primary(ownVel: Vec2, t: number): void {
        const a = this.aim;
        if (!a) return;
        const m = this.m;
        const d = Math.max(v2.length(a), MIN_RADIUS);
        const dir = v2.div(a, d);
        const near = d <= NEAR_DIST;
        const r = this.clampRadius(near ? this.nearR : d * (1 + 0.12 * gaussian(this.rng)), dir);
        const w = (2 * HIT_HALF_WIDTH * r) / Math.max(d, 1);
        // where the target will be when the hand lands (the lead the bot is capable of)
        const mt0 = m.fittsA + m.fittsB * Math.log2(v2.distance(v2.mul(dir, r), this.cursor) / w + 1);
        const p = v2.add(a, v2.mul(ownVel, mt0 * this.params.leadFactor));
        const pd = v2.normalizeSafe(p, dir);
        const goal = v2.mul(pd, this.clampRadius(r, pd));
        const gain = 0.96 + 0.05 * gaussian(this.rng);
        const kappa = wristKappa(this.rng, v2.sub(goal, this.cursor), this.hand);
        this.rc = r;
        this.offSince = Number.POSITIVE_INFINITY;
        this.plan("primary", goal, w, gain, kappa, t);
    }

    /** After the dwell: a corrective submovement when the error is over half the hitbox half-angle, else pursuit. */
    private afterDwell(t: number): void {
        const a = this.aim;
        if (!a) return;
        const d = Math.max(v2.length(a), MIN_RADIUS);
        const half = Math.atan(HIT_HALF_WIDTH / d);
        const err = Math.abs(angleDelta(angleOf(this.cursor), angleOf(a)));
        // a sloppier trigger also accepts a sloppier aim: the threshold scales with triggerLooseness
        if (this.corrections < MAX_CORRECTIONS && err > 0.5 * half * this.m.triggerLooseness) {
            this.corrections++;
            const dir = v2.div(a, d);
            const r = this.clampRadius(this.rc, dir);
            const w = (2 * HIT_HALF_WIDTH * r) / Math.max(d, 1);
            const over = this.rng.bool(this.m.overcorrectP);
            const gain = over ? this.rng.range(1.25, 1.6) : 1 + 0.04 * gaussian(this.rng);
            this.plan("correction", v2.mul(dir, r), w, gain, 0.05 * gaussian(this.rng), t);
            return;
        }
        this.startTracking();
    }

    private startTracking(): void {
        this.phase = "track";
        this.offSince = Number.POSITIVE_INFINITY;
        this.pursuit.vel = v2.rotate(this.vel, -this.phi);
    }

    private plan(kind: FlickKind, goal: Vec2, width: number, gain: number, kappa: number, t: number): void {
        const m = this.m;
        this.flick = planFlick(this.rng, {
            kind,
            now: t,
            from: this.cursor,
            goal,
            width,
            fittsA: m.fittsA,
            fittsB: m.fittsB,
            gain,
            sigma: m.endpointSigma,
            kappa,
        });
        this.flickCap = capTurnRate(this.rng, this.flick) * STEP;
        this.flickPhi = this.phi;
        this.carry = { x: 0, y: 0 };
        this.phase = "flick";
        this.onFlick?.(this.flick);
    }

    /** The cursor on the planned stroke (rotated with the frame: own movement keeps being compensated). */
    private followFlick(t: number): void {
        const f = this.flick;
        if (!f) {
            this.startTracking();
            return;
        }
        this.cursor = v2.add(v2.rotate(flickPoint(f, t), this.phi - this.flickPhi), v2.rotate(this.carry, this.phi));
        if (t >= f.t0 + f.mt - 1e-9) {
            this.phase = "dwell";
            this.dwellUntil = t + this.rng.range(0.04, 0.09);
        }
    }

    private withinReflick(): boolean {
        const a = this.aim;
        if (!a) return true;
        const d = Math.max(v2.length(a), MIN_RADIUS);
        const width = 2 * Math.atan(HIT_HALF_WIDTH / d);
        return Math.abs(angleDelta(angleOf(this.cursor), angleOf(a))) <= REFLICK_WIDTHS * width;
    }

    private clampRadius(r: number, dir: Vec2): number {
        return Math.max(MIN_AIM_RADIUS, Math.min(r, screenEdge(this.zoom, dir)));
    }
}

function rotateDrift(v: Vec2, drift: number): Vec2 {
    return v2.rotate(v, drift);
}
