// Smooth pursuit of the human motor model: the hand follows a delayed percept of the target (a ring buffer of the
// tracked point, `pursuitLag` behind), matching its velocity (Kv) and correcting the position error (Kp) with partial
// prediction over the lag, through the inertia of the arm (first-order lag, 50 ms). Speed-dependent noise across the
// line of sight (an Ornstein-Uhlenbeck process scaled by `speedNoise` x target speed) replaces the legacy
// aimErrorPerSpeed. References: Lisberger et al. 1987 (pursuit latency and gain). Calibration: scripts/aimbench.ts.
import { type Rng, type Vec2, v2 } from "@rebirth/core";
import type { MotorParams } from "../difficulty.ts";
import { STEP } from "./flick.ts";
import { OuProcess } from "./noise.ts";

/** Ring buffer length (substeps): 0.8 s of history covers any lag. */
const CAP = 80;
/** Half window of the target velocity estimate (substeps), centred on the perceived moment. */
const VEL_HALF = 2;
/** Arm inertia time constant (s). */
export const ARM_TAU = 0.05;
/** Correlation time of the pursuit velocity noise (s). */
const NOISE_TAU = 0.12;

export class Pursuit {
    /** cursor velocity (world units/s, relative to the player) */
    vel: Vec2 = { x: 0, y: 0 };
    private readonly buf: Vec2[] = Array.from({ length: CAP }, () => ({ x: 0, y: 0 }));
    private head = -1;
    private count = 0;
    private readonly noise: OuProcess;

    constructor(rng: Rng) {
        this.noise = new OuProcess(rng, NOISE_TAU, 1);
    }

    /** Forgets the tracked point's history (a new target). */
    reset(): void {
        this.count = 0;
    }

    /** Records the tracked point of the current substep. */
    push(p: Vec2): void {
        this.head = (this.head + 1) % CAP;
        this.buf[this.head] = p;
        if (this.count < CAP) this.count++;
    }

    /** The tracked point `steps` substeps ago (the oldest one when the history is shorter). */
    past(steps: number): Vec2 {
        if (this.count === 0) return { x: 0, y: 0 };
        const s = Math.min(steps, this.count - 1);
        return this.buf[(this.head - s + CAP) % CAP];
    }

    /** Velocity of the tracked point as perceived `steps` substeps ago (central difference around that moment). */
    velocityAt(steps: number): Vec2 {
        const lo = Math.max(0, Math.min(steps - VEL_HALF, this.count - 1));
        const hi = Math.min(steps + VEL_HALF, this.count - 1);
        if (hi <= lo) return { x: 0, y: 0 };
        return v2.div(v2.sub(this.past(lo), this.past(hi)), (hi - lo) * STEP);
    }

    /** Perceived (lagged) target velocity. */
    perceivedVelocity(m: MotorParams): Vec2 {
        return this.velocityAt(Math.round(m.pursuitLag / STEP));
    }

    /** One substep of pursuit from cursor `c`; returns the new cursor. */
    step(c: Vec2, m: MotorParams, noiseGain: number): Vec2 {
        const lag = Math.round(m.pursuitLag / STEP);
        const seen = this.past(lag);
        const vt = this.velocityAt(lag);
        const predicted = v2.add(seen, v2.mul(vt, m.pursuitLag * m.pursuitPred));
        let cmd = v2.add(v2.mul(vt, m.pursuitKv), v2.mul(v2.sub(predicted, c), m.pursuitKp));
        const n = this.noise.step(STEP);
        const speed = v2.length(vt);
        if (speed > 1e-6) {
            const across = v2.perp(v2.normalizeSafe(c, { x: 1, y: 0 }));
            cmd = v2.add(cmd, v2.mul(across, n * m.speedNoise * noiseGain * speed));
        }
        this.vel = v2.add(this.vel, v2.mul(v2.sub(cmd, this.vel), Math.min(1, STEP / ARM_TAU)));
        return v2.add(c, v2.mul(this.vel, STEP));
    }
}
