// Small statistics toolkit of the bot tournament: Wilson score intervals, exact binomial tails, a paired t-test (the
// Student t distribution through the regularized incomplete beta function) and summaries. No dependencies.

/** Wilson score interval of a proportion `k / n` (95% by default). */
export function wilson(k: number, n: number, z = 1.959964): { p: number; lo: number; hi: number } {
    if (n <= 0) return { p: Number.NaN, lo: 0, hi: 1 };
    const p = k / n;
    const z2 = z * z;
    const den = 1 + z2 / n;
    const center = (p + z2 / (2 * n)) / den;
    const half = (z * Math.sqrt((p * (1 - p)) / n + z2 / (4 * n * n))) / den;
    return { p, lo: Math.max(0, center - half), hi: Math.min(1, center + half) };
}

/** ln Γ(x) (Lanczos, g = 7). */
export function lnGamma(x: number): number {
    const c = [
        0.9999999999998099, 676.5203681218851, -1259.1392167224028, 771.3234287776531, -176.6150291621406,
        12.507343278686905, -0.13857109526572012, 9.984369578019572e-6, 1.5056327351493116e-7,
    ];
    if (x < 0.5) return Math.log(Math.PI / Math.sin(Math.PI * x)) - lnGamma(1 - x);
    const xx = x - 1;
    let a = c[0];
    const t = xx + 7.5;
    for (let i = 1; i < 9; i++) a += c[i] / (xx + i);
    return 0.5 * Math.log(2 * Math.PI) + (xx + 0.5) * Math.log(t) - t + Math.log(a);
}

/** P(X >= k) for X ~ Binomial(n, p) (exact). */
export function binomialUpper(k: number, n: number, p = 0.5): number {
    if (k <= 0) return 1;
    if (k > n) return 0;
    let sum = 0;
    for (let i = k; i <= n; i++) {
        const lc = lnGamma(n + 1) - lnGamma(i + 1) - lnGamma(n - i + 1);
        sum += Math.exp(lc + i * Math.log(p) + (n - i) * Math.log(1 - p));
    }
    return Math.min(1, sum);
}

/** Continued fraction of the incomplete beta function (Numerical Recipes betacf). */
function betaCf(a: number, b: number, x: number): number {
    const tiny = 1e-300;
    let c = 1;
    let d = 1 - ((a + b) * x) / (a + 1);
    if (Math.abs(d) < tiny) d = tiny;
    d = 1 / d;
    let h = d;
    for (let m = 1; m <= 300; m++) {
        const m2 = 2 * m;
        let aa = (m * (b - m) * x) / ((a + m2 - 1) * (a + m2));
        d = 1 + aa * d;
        if (Math.abs(d) < tiny) d = tiny;
        c = 1 + aa / c;
        if (Math.abs(c) < tiny) c = tiny;
        d = 1 / d;
        h *= d * c;
        aa = (-(a + m) * (a + b + m) * x) / ((a + m2) * (a + m2 + 1));
        d = 1 + aa * d;
        if (Math.abs(d) < tiny) d = tiny;
        c = 1 + aa / c;
        if (Math.abs(c) < tiny) c = tiny;
        d = 1 / d;
        const del = d * c;
        h *= del;
        if (Math.abs(del - 1) < 1e-12) break;
    }
    return h;
}

/** Regularized incomplete beta I_x(a, b). */
export function incompleteBeta(x: number, a: number, b: number): number {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    const front = Math.exp(lnGamma(a + b) - lnGamma(a) - lnGamma(b) + a * Math.log(x) + b * Math.log(1 - x));
    return x < (a + 1) / (a + b + 2) ? (front * betaCf(a, b, x)) / a : 1 - (front * betaCf(b, a, 1 - x)) / b;
}

/** P(T <= t) for Student's t with `df` degrees of freedom. */
export function studentCdf(t: number, df: number): number {
    const tail = 0.5 * incompleteBeta(df / (df + t * t), df / 2, 0.5);
    return t >= 0 ? 1 - tail : tail;
}

export interface PairedTest {
    n: number;
    mean: number;
    sd: number;
    t: number;
    /** one-sided p-value for mean < 0 */
    pLess: number;
    /** two-sided p-value */
    pTwoSided: number;
}

/** One-sample t-test of paired differences against 0. */
export function pairedTTest(diffs: readonly number[]): PairedTest {
    const n = diffs.length;
    const mean = n ? diffs.reduce((a, b) => a + b, 0) / n : 0;
    const sd = n > 1 ? Math.sqrt(diffs.reduce((a, d) => a + (d - mean) ** 2, 0) / (n - 1)) : 0;
    if (n < 2) return { n, mean, sd, t: 0, pLess: 1, pTwoSided: 1 };
    if (sd === 0) {
        const p = mean < 0 ? 0 : mean > 0 ? 1 : 0.5;
        return {
            n,
            mean,
            sd,
            t: mean === 0 ? 0 : Math.sign(mean) * Number.POSITIVE_INFINITY,
            pLess: p,
            pTwoSided: mean === 0 ? 1 : 0,
        };
    }
    const t = mean / (sd / Math.sqrt(n));
    const cdf = studentCdf(t, n - 1);
    return { n, mean, sd, t, pLess: cdf, pTwoSided: 2 * Math.min(cdf, 1 - cdf) };
}

export function mean(xs: readonly number[]): number {
    return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0;
}
