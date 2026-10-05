/** Deterministic pseudo-random source; every simulation random draw goes through one of these. */
export interface Rng {
    /** Uniform float in [0, 1). */
    next(): number;
    /** Uniform integer in [min, maxInclusive]. */
    int(min: number, maxInclusive: number): number;
    /** Uniform float in [min, max). */
    range(min: number, max: number): number;
    /** True with probability `p`. */
    bool(p?: number): boolean;
    /** Uniformly chosen element of a non-empty array. */
    pick<T>(array: readonly T[]): T;
    /** Element chosen with probability proportional to `weightFn(item)`; non-positive weights never win. */
    weighted<T>(items: readonly T[], weightFn: (item: T) => number): T;
    /** Fisher-Yates shuffle in place; returns the same array. */
    shuffle<T>(array: T[]): T[];
}

const UINT32_RANGE = 4294967296;
const FNV_OFFSET_BASIS = 0x811c9dc5;
const FNV_PRIME = 0x01000193;

/** splitmix32 step generator, used only to expand a single seed into sfc32 state. */
function splitmix32(seed: number): () => number {
    let state = seed >>> 0;
    return () => {
        state = (state + 0x9e3779b9) | 0;
        let z = state;
        z = Math.imul(z ^ (z >>> 16), 0x85ebca6b);
        z = Math.imul(z ^ (z >>> 13), 0xc2b2ae35);
        return (z ^ (z >>> 16)) >>> 0;
    };
}

/** Folds any number (including fractions and values beyond 32 bits) into a 32-bit seed. */
function toSeed32(seed: number): number {
    let lo: number;
    let hi: number;
    if (Number.isSafeInteger(seed)) {
        lo = seed >>> 0;
        hi = Math.floor(seed / UINT32_RANGE) >>> 0;
    } else {
        const view = new DataView(new ArrayBuffer(8));
        view.setFloat64(0, seed, true);
        lo = view.getUint32(0, true);
        hi = view.getUint32(4, true);
    }
    return (lo ^ Math.imul(hi, 0x9e3779b1)) >>> 0;
}

/** Creates an sfc32 generator; equal seeds always yield identical sequences. */
export function createRng(seed: number): Rng {
    const expand = splitmix32(toSeed32(seed));
    let a = expand();
    let b = expand();
    let c = expand();
    let d = expand();

    function nextUint32(): number {
        const t = (((a + b) | 0) + d) | 0;
        d = (d + 1) | 0;
        a = b ^ (b >>> 9);
        b = (c + (c << 3)) | 0;
        c = (c << 21) | (c >>> 11);
        c = (c + t) | 0;
        return t >>> 0;
    }

    // Discard early outputs so closely related seeds diverge fully.
    for (let i = 0; i < 12; i++) {
        nextUint32();
    }

    const next = (): number => nextUint32() / UINT32_RANGE;

    const int = (min: number, maxInclusive: number): number => {
        const lo = Math.ceil(min);
        const hi = Math.floor(maxInclusive);
        if (hi < lo) {
            throw new RangeError(`rng.int: empty range [${min}, ${maxInclusive}]`);
        }
        return lo + Math.floor(next() * (hi - lo + 1));
    };

    const pick = <T>(array: readonly T[]): T => {
        if (array.length === 0) {
            throw new RangeError("rng.pick: empty array");
        }
        return array[Math.floor(next() * array.length)];
    };

    const weighted = <T>(items: readonly T[], weightFn: (item: T) => number): T => {
        let total = 0;
        let lastValid = -1;
        const weights = items.map((item, i) => {
            const w = weightFn(item);
            if (!(w > 0)) {
                return 0;
            }
            total += w;
            lastValid = i;
            return w;
        });
        if (lastValid < 0) {
            throw new RangeError("rng.weighted: no item has a positive weight");
        }
        let r = next() * total;
        for (let i = 0; i < weights.length; i++) {
            r -= weights[i];
            if (r < 0) {
                return items[i];
            }
        }
        // Floating-point rounding can leave a sliver past the last bucket.
        return items[lastValid];
    };

    const shuffle = <T>(array: T[]): T[] => {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(next() * (i + 1));
            const tmp = array[i];
            array[i] = array[j];
            array[j] = tmp;
        }
        return array;
    };

    return {
        next,
        int,
        range: (min, max) => min + next() * (max - min),
        bool: (p = 0.5) => next() < p,
        pick,
        weighted,
        shuffle,
    };
}

const utf8Encoder = new TextEncoder();

/** 32-bit FNV-1a hash of the string's UTF-8 bytes, for deriving numeric seeds from text. */
export function hashString(s: string): number {
    let hash = FNV_OFFSET_BASIS;
    for (const byte of utf8Encoder.encode(s)) {
        hash = Math.imul(hash ^ byte, FNV_PRIME);
    }
    return hash >>> 0;
}
