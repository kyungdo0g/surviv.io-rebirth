// Noise sources of the cursor motor model: gaussian samples from the seeded rng, an Ornstein-Uhlenbeck process (a
// slowly wandering aim error that replaces the legacy errGoal redraws) and physiological hand tremor (two sinusoids
// per axis at 8-12 Hz, phases fixed at construction, so tremor costs no rng draw per tick).
import type { Rng, Vec2 } from "@rebirth/core";

/** Standard normal sample (Box-Muller) from a seeded rng. */
export function gaussian(rng: Rng): number {
    const u = Math.max(rng.next(), 1e-9);
    const v = rng.next();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

/**
 * Ornstein-Uhlenbeck process with time constant `tau` and stationary standard deviation `sigma`, stepped with the
 * exact discretisation (any step size gives the same statistics). Starts from a stationary draw.
 */
export class OuProcess {
    value: number;
    private readonly tau: number;
    private readonly rng: Rng;
    sigma: number;

    constructor(rng: Rng, tau: number, sigma: number) {
        this.rng = rng;
        this.tau = tau;
        this.sigma = sigma;
        this.value = gaussian(rng) * sigma;
    }

    step(dt: number): number {
        const a = Math.exp(-dt / this.tau);
        this.value = this.value * a + this.sigma * Math.sqrt(1 - a * a) * gaussian(this.rng);
        return this.value;
    }
}

/**
 * A smooth wandering error: an OU process (time constant `tau`) through a first-order low-pass (`smooth`), scaled so
 * the stationary standard deviation stays `sigma`. A bare OU process jumps by sigma x sqrt(2 dt / tau) every step;
 * the low-pass removes that jitter (tremor already covers the fast part) while keeping the slow wander.
 */
export class SmoothDrift {
    value: number;
    private readonly ou: OuProcess;
    private readonly smooth: number;

    constructor(rng: Rng, tau: number, smooth: number, sigma: number) {
        // stationary variance of OU(tau) through a low-pass(smooth) is tau / (tau + smooth) of the OU's
        this.ou = new OuProcess(rng, tau, sigma * Math.sqrt((tau + smooth) / tau));
        this.smooth = smooth;
        this.value = this.ou.value * Math.sqrt(tau / (tau + smooth));
    }

    step(dt: number): number {
        const raw = this.ou.step(dt);
        this.value += (raw - this.value) * (1 - Math.exp(-dt / this.smooth));
        return this.value;
    }
}

/** Hand tremor: per axis the mean of two sinusoids at U(8, 12) Hz with random phases, peak amplitude 1. */
export class Tremor {
    private readonly freq: number[];
    private readonly phase: number[];

    constructor(rng: Rng) {
        this.freq = Array.from({ length: 4 }, () => 2 * Math.PI * rng.range(8, 12));
        this.phase = Array.from({ length: 4 }, () => rng.range(0, 2 * Math.PI));
    }

    /** Tremor offset at time `t` (seconds) scaled by `amp` (world units). */
    at(t: number, amp: number): Vec2 {
        const f = this.freq;
        const p = this.phase;
        return {
            x: amp * 0.5 * (Math.sin(f[0] * t + p[0]) + Math.sin(f[1] * t + p[1])),
            y: amp * 0.5 * (Math.sin(f[2] * t + p[2]) + Math.sin(f[3] * t + p[3])),
        };
    }
}
