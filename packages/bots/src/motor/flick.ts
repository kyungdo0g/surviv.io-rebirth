// Ballistic cursor movements (flicks) of the human motor model. A flick is planned once: its duration follows Fitts'
// law (MT = a + b log2(D/W + 1), log-normal noise), its endpoint undershoots on average with scatter across the
// movement, its path is a quadratic Bezier curve bowed like a wrist arc, and it is traversed with the minimum-jerk time
// law s(tau) = 10 tau^3 - 15 tau^4 + 6 tau^5 (bell-shaped speed, peak 1.875 x mean). Positions are relative to the
// player, in world units. References: Fitts 1954; Flash & Hogan 1985 (minimum jerk); Meyer et al. 1988 (optimised
// submovements: primary undershoot plus corrective submovements). Calibration: scripts/aimbench.ts.
import { type Rng, type Vec2, v2 } from "@rebirth/core";
import { distToSegment } from "../geom.ts";
import { gaussian } from "./noise.ts";

/** Fixed integration substep of the motor (s): the 100 Hz controller and the ~33 Hz NetworkBot trace the same path. */
export const STEP = 0.01;
/** Half width of a player's hitbox for Fitts' W (world units): body radius 1 plus its outline, scale 1. */
export const HIT_HALF_WIDTH = 1.25;
/** Movement time bounds (s). */
export const MT_MIN = 0.08;
export const MT_MAX = 0.9;
/** A path that passes closer than this to the player bends away from it (world units). */
const CLEARANCE = 3;

export type FlickKind = "primary" | "correction" | "idle" | "throw";

export interface Flick {
    kind: FlickKind;
    /** start time (motor clock) and movement time (s) */
    t0: number;
    mt: number;
    /** start, Bezier control point and endpoint (relative to the player) */
    p0: Vec2;
    k: Vec2;
    p1: Vec2;
    /** the goal the movement was planned for (the endpoint misses it by the gain and the scatter) */
    goal: Vec2;
    /** distance to the goal at planning (Fitts' D) and the target width (W) */
    d: number;
    w: number;
    gain: number;
    /** curvature: control offset across the chord as a fraction of its length (max deviation / chord = kappa) */
    kappa: number;
}

export interface FlickSpec {
    kind: FlickKind;
    now: number;
    from: Vec2;
    goal: Vec2;
    /** target width at the goal (world units) */
    width: number;
    /** Fitts' law intercept and slope (s, s/bit) */
    fittsA: number;
    fittsB: number;
    /** endpoint = from + (goal - from) * gain + scatter */
    gain: number;
    /** endpoint scatter across the movement, standard deviation as a fraction of D */
    sigma: number;
    /** signed curvature along the chord normal that points to screen-up (+y) */
    kappa: number;
}

/** Minimum-jerk position profile: 0 at tau <= 0, 1 at tau >= 1, zero velocity and acceleration at both ends. */
export function minJerk(tau: number): number {
    if (tau <= 0) return 0;
    if (tau >= 1) return 1;
    const t3 = tau * tau * tau;
    return t3 * (10 - 15 * tau + 6 * tau * tau);
}

/** Point of a quadratic Bezier curve at parameter s. */
export function bezier(p0: Vec2, k: Vec2, p1: Vec2, s: number): Vec2 {
    const a = (1 - s) * (1 - s);
    const b = 2 * (1 - s) * s;
    const c = s * s;
    return { x: a * p0.x + b * k.x + c * p1.x, y: a * p0.y + b * k.y + c * p1.y };
}

/** Where the flick puts the cursor at time `t`. */
export function flickPoint(f: Flick, t: number): Vec2 {
    return bezier(f.p0, f.k, f.p1, minJerk((t - f.t0) / f.mt));
}

/** Fitts' law index of difficulty (bits). */
export function indexOfDifficulty(d: number, w: number): number {
    return Math.log2(d / Math.max(w, 1e-3) + 1);
}

/** Fitts' law movement time with log-normal noise (sd 0.08 in log), clamped to [MT_MIN, MT_MAX]. */
export function movementTime(rng: Rng, a: number, b: number, d: number, w: number): number {
    const mt = (a + b * indexOfDifficulty(d, w)) * Math.exp(gaussian(rng) * 0.08);
    return Math.min(MT_MAX, Math.max(MT_MIN, mt));
}

/** Unit normal of `dir` pointing to screen-up (+y; +x for a vertical chord). */
export function upNormal(dir: Vec2): Vec2 {
    const n = { x: -dir.y, y: dir.x };
    if (n.y < -1e-9 || (Math.abs(n.y) <= 1e-9 && n.x < 0)) return { x: -n.x, y: -n.y };
    return n;
}

/**
 * Curvature of a primary movement along `chord`: a wrist arc that bows horizontal strokes towards screen-up by the
 * bot's handedness `hand` (signed: negative bows down), plus noise; vertical strokes get the noise only (either side).
 */
export function wristKappa(rng: Rng, chord: Vec2, hand: number): number {
    const len = v2.length(chord);
    const cx = len > 1e-9 ? Math.abs(chord.x) / len : 0;
    return hand * cx + gaussian(rng) * 0.03;
}

/** Closest approach of a quadratic Bezier to the player (sampled). */
function clearance(p0: Vec2, k: Vec2, p1: Vec2): number {
    let min = Number.POSITIVE_INFINITY;
    for (let i = 0; i <= 16; i++) min = Math.min(min, v2.length(bezier(p0, k, p1, i / 16)));
    return min;
}

/** Plans a flick: draws its endpoint and duration and shapes its path. */
export function planFlick(rng: Rng, spec: FlickSpec): Flick {
    const { from, goal } = spec;
    const chord0 = v2.sub(goal, from);
    const d = v2.length(chord0);
    const u = d > 1e-9 ? v2.div(chord0, d) : { x: 1, y: 0 };
    const across = gaussian(rng) * spec.sigma * d;
    const p1 = v2.add(v2.add(from, v2.mul(chord0, spec.gain)), v2.mul(v2.perp(u), across));
    const mt = movementTime(rng, spec.fittsA, spec.fittsB, d, spec.width);
    const chord = v2.sub(p1, from);
    const len = v2.length(chord);
    const mid = v2.mul(v2.add(from, p1), 0.5);
    let kappa = spec.kappa;
    let normal = upNormal(len > 1e-9 ? v2.div(chord, len) : u);
    let k = v2.add(mid, v2.mul(normal, 2 * kappa * len));
    // a stroke across the player would swing the aim direction wildly: bow it around the player instead
    if (len > 1e-6 && distToSegment({ x: 0, y: 0 }, from, p1) < CLEARANCE) {
        const side = v2.dot(mid, normal);
        if (Math.abs(side) > 1e-6) normal = side > 0 ? normal : v2.neg(normal);
        else if (kappa < 0) normal = v2.neg(normal);
        const need = Math.min(CLEARANCE, 0.75 * Math.min(v2.length(from), v2.length(p1)));
        let mag = Math.max(Math.abs(kappa), 0.25);
        k = v2.add(mid, v2.mul(normal, 2 * mag * len));
        while (mag < 0.8 && clearance(from, k, p1) < need) {
            mag += 0.05;
            k = v2.add(mid, v2.mul(normal, 2 * mag * len));
        }
        kappa = mag * Math.sign(v2.dot(normal, upNormal(v2.div(chord, len))) || 1);
    }
    return {
        kind: spec.kind,
        t0: spec.now,
        mt,
        p0: v2.copy(from),
        k,
        p1,
        goal: v2.copy(goal),
        d,
        w: spec.width,
        gain: spec.gain,
        kappa,
    };
}
