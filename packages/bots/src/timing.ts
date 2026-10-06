// A mergeable log-scale histogram of durations (milliseconds) for percentiles over many samples without keeping them:
// per-bot update times of a match (runMatch) and of a whole tournament (merged across matches and worker threads).
// Buckets are 2% wide from 1 microsecond up; percentiles are exact to that resolution.

const MIN_MS = 1e-3;
const STEP = Math.log(1.02);

export interface TimingSummary {
    n: number;
    mean: number;
    p50: number;
    p99: number;
    max: number;
}

export class TimingHistogram {
    /** bucket index -> count (sparse) */
    readonly buckets = new Map<number, number>();
    n = 0;
    sum = 0;
    max = 0;

    add(ms: number): void {
        const b = ms <= MIN_MS ? 0 : Math.floor(Math.log(ms / MIN_MS) / STEP) + 1;
        this.buckets.set(b, (this.buckets.get(b) ?? 0) + 1);
        this.n++;
        this.sum += ms;
        if (ms > this.max) this.max = ms;
    }

    merge(other: TimingHistogram | TimingHistogramJSON): this {
        const entries = other instanceof TimingHistogram ? other.buckets.entries() : Object.entries(other.buckets);
        for (const [k, c] of entries) this.buckets.set(Number(k), (this.buckets.get(Number(k)) ?? 0) + c);
        this.n += other.n;
        this.sum += other.sum;
        this.max = Math.max(this.max, other.max);
        return this;
    }

    /** Upper edge of the bucket holding quantile `q` (0..1). */
    quantile(q: number): number {
        if (this.n === 0) return 0;
        const rank = Math.min(this.n - 1, Math.floor(q * this.n));
        let seen = 0;
        for (const b of [...this.buckets.keys()].sort((x, y) => x - y)) {
            seen += this.buckets.get(b) ?? 0;
            if (seen > rank) return Math.min(this.max, b === 0 ? MIN_MS : MIN_MS * Math.exp(b * STEP));
        }
        return this.max;
    }

    summary(): TimingSummary {
        return {
            n: this.n,
            mean: this.n ? this.sum / this.n : 0,
            p50: this.quantile(0.5),
            p99: this.quantile(0.99),
            max: this.max,
        };
    }

    toJSON(): TimingHistogramJSON {
        return { buckets: Object.fromEntries(this.buckets), n: this.n, sum: this.sum, max: this.max };
    }

    static from(json: TimingHistogramJSON): TimingHistogram {
        return new TimingHistogram().merge(json);
    }
}

/** Plain form of a histogram (structured clone / JSON). */
export interface TimingHistogramJSON {
    buckets: Record<string, number>;
    n: number;
    sum: number;
    max: number;
}
