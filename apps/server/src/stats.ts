// Rolling duration statistics (tick and netsync times) over a fixed window of recent samples.

export interface Percentiles {
    count: number;
    p50: number;
    p99: number;
    max: number;
    mean: number;
}

export class SampleWindow {
    private readonly samples: Float64Array;
    private next = 0;
    private filled = 0;
    /** samples recorded since creation */
    total = 0;

    constructor(size = 6000) {
        this.samples = new Float64Array(size);
    }

    add(value: number): void {
        this.samples[this.next] = value;
        this.next = (this.next + 1) % this.samples.length;
        if (this.filled < this.samples.length) this.filled++;
        this.total++;
    }

    reset(): void {
        this.next = 0;
        this.filled = 0;
    }

    summary(): Percentiles {
        const n = this.filled;
        if (n === 0) return { count: 0, p50: 0, p99: 0, max: 0, mean: 0 };
        const sorted = this.samples.slice(0, n).sort();
        let sum = 0;
        for (const v of sorted) sum += v;
        const at = (q: number) => sorted[Math.min(n - 1, Math.floor(q * n))];
        return { count: n, p50: at(0.5), p99: at(0.99), max: sorted[n - 1], mean: sum / n };
    }
}

/** Rounds every number of a summary to `digits` decimals (for JSON output). */
export function roundSummary(p: Percentiles, digits = 3): Percentiles {
    const f = 10 ** digits;
    const r = (v: number) => Math.round(v * f) / f;
    return { count: p.count, p50: r(p.p50), p99: r(p.p99), max: r(p.max), mean: r(p.mean) };
}
