// Input-stream detectors of the anti-cheat telemetry (M8): the recent aim history (snap measure before a shot), the
// constant-aim-delta detector and per-second rate windows. Pure and clock-agnostic: callers pass times in ms.

const RAD2DEG = 180 / Math.PI;

/** Signed smallest rotation from angle `a` to angle `b`, in degrees within (-180, 180]. */
export function angleDeltaDeg(a: number, b: number): number {
    let d = (b - a) * RAD2DEG;
    d %= 360;
    if (d > 180) d -= 360;
    else if (d <= -180) d += 360;
    return d;
}

export interface AimSample {
    /** arrival time (ms) */
    t: number;
    /** aim angle (radians, atan2 of toMouseDir) */
    angle: number;
    /** cursor distance from the player (world units, toMouseLen) */
    len: number;
}

/** The last `capacity` aim samples, oldest first. */
export class AimHistory {
    private readonly samples: AimSample[] = [];
    private readonly capacity: number;

    constructor(capacity = 16) {
        this.capacity = capacity;
    }

    get size(): number {
        return this.samples.length;
    }

    get last(): AimSample | undefined {
        return this.samples[this.samples.length - 1];
    }

    push(sample: AimSample): void {
        this.samples.push(sample);
        if (this.samples.length > this.capacity) this.samples.shift();
    }

    /**
     * Largest aim change (degrees, absolute) between two consecutive samples among the last `steps` steps whose later
     * sample arrived at or after `since`, counting only steps where both samples have the cursor at least `minLen`
     * from the player (near the player a tiny mouse move swings the direction).
     */
    maxRecentStepDeg(steps: number, since: number, minLen: number): number {
        let max = 0;
        const s = this.samples;
        for (let i = s.length - 1, n = 0; i > 0 && n < steps; i--, n++) {
            const b = s[i];
            const a = s[i - 1];
            if (b.t < since) break;
            if (a.len < minLen || b.len < minLen) continue;
            max = Math.max(max, Math.abs(angleDeltaDeg(a.angle, b.angle)));
        }
        return max;
    }
}

export interface ConstantAimOptions {
    minRun: number;
    minDeltaDeg: number;
    toleranceDeg: number;
}

/**
 * Runs of consecutive aim deltas that stay constant (spin bots, scripted aim, aimbots tracking a target perfectly): a
 * run grows while each delta is at least `minDeltaDeg` and within `toleranceDeg` of the run's first delta; every
 * `minRun` deltas of a run count as one more run (a spin bot spinning for a minute counts many times). Human aim varies
 * far more than the wire quantization between frames.
 */
export class ConstantAimDetector {
    /** completed segments of minRun constant deltas */
    runs = 0;
    /** longest run seen (deltas) */
    longestRun = 0;
    private readonly opts: ConstantAimOptions;
    private runLen = 0;
    private runDelta = 0;

    constructor(opts: ConstantAimOptions) {
        this.opts = opts;
    }

    push(deltaDeg: number): void {
        const { minRun, minDeltaDeg, toleranceDeg } = this.opts;
        if (Math.abs(deltaDeg) < minDeltaDeg) {
            this.runLen = 0;
            return;
        }
        if (this.runLen > 0 && Math.abs(deltaDeg - this.runDelta) <= toleranceDeg) {
            this.runLen++;
        } else {
            this.runLen = 1;
            this.runDelta = deltaDeg;
        }
        if (this.runLen > this.longestRun) this.longestRun = this.runLen;
        if (this.runLen % minRun === 0) this.runs++;
    }
}

/** Events per wall-clock second (fixed one-second windows) and the seconds whose count exceeded `limit`. */
export class RateWindow {
    private readonly limit: number;
    private start = Number.NEGATIVE_INFINITY;
    private count = 0;
    private closedSpikes = 0;
    private closedPeak = 0;

    constructor(limit: number) {
        this.limit = limit;
    }

    add(now: number, n = 1): void {
        if (now - this.start >= 1000) {
            this.close();
            this.start = now;
        }
        this.count += n;
    }

    /** seconds over the limit, the current one included */
    get spikeSeconds(): number {
        return this.closedSpikes + (this.count > this.limit ? 1 : 0);
    }

    /** highest count of any second so far */
    get peak(): number {
        return Math.max(this.closedPeak, this.count);
    }

    private close(): void {
        if (this.count > this.closedPeak) this.closedPeak = this.count;
        if (this.count > this.limit) this.closedSpikes++;
        this.count = 0;
    }
}

/** 0 at or below `soft`, 1 at or above `hard`, linear in between. */
export function ramp(value: number, soft: number, hard: number): number {
    if (value <= soft) return 0;
    if (value >= hard || hard <= soft) return 1;
    return (value - soft) / (hard - soft);
}
