import { describe, expect, it } from "vitest";
import { createRng, hashString } from "../src/index.ts";

const sequence = (seed: number, n = 1000) => {
    const rng = createRng(seed);
    return Array.from({ length: n }, () => rng.next());
};

describe("createRng", () => {
    it("is deterministic for equal seeds", () => {
        expect(sequence(42)).toEqual(sequence(42));
        expect(sequence(hashString("map-seed"))).toEqual(sequence(hashString("map-seed")));
    });

    it("diverges for different seeds, including fractional and large ones", () => {
        const seeds = [0, 1, 2, -1, 0.5, 2 ** 32, 2 ** 40 + 3, 4294967295];
        const sequences = seeds.map((seed) => sequence(seed));
        for (let i = 0; i < seeds.length; i++) {
            for (let j = i + 1; j < seeds.length; j++) {
                const same = sequences[i].filter((v, k) => v === sequences[j][k]).length;
                expect(same, `seeds ${seeds[i]} and ${seeds[j]}`).toBeLessThan(3);
            }
        }
    });

    it("produces floats in [0, 1)", () => {
        for (const v of sequence(7, 10000)) {
            expect(v).toBeGreaterThanOrEqual(0);
            expect(v).toBeLessThan(1);
        }
    });

    it("produces inclusive integer bounds", () => {
        const rng = createRng(3);
        const seen = new Set<number>();
        for (let i = 0; i < 10000; i++) {
            const v = rng.int(1, 6);
            expect(Number.isInteger(v)).toBe(true);
            expect(v).toBeGreaterThanOrEqual(1);
            expect(v).toBeLessThanOrEqual(6);
            seen.add(v);
        }
        expect([...seen].sort()).toEqual([1, 2, 3, 4, 5, 6]);
        expect(rng.int(5, 5)).toBe(5);
        expect(() => rng.int(3, 2)).toThrow(RangeError);
    });

    it("is roughly uniform", () => {
        const rng = createRng(11);
        const buckets = new Array<number>(10).fill(0);
        const draws = 100000;
        for (let i = 0; i < draws; i++) {
            buckets[rng.int(0, 9)]++;
        }
        const expected = draws / buckets.length;
        const chiSquare = buckets.reduce((sum, n) => sum + (n - expected) ** 2 / expected, 0);
        // 9 degrees of freedom: p = 0.001 critical value is ~27.9.
        expect(chiSquare).toBeLessThan(27.9);
        let mean = 0;
        for (let i = 0; i < draws; i++) {
            mean += rng.next() / draws;
        }
        expect(mean).toBeCloseTo(0.5, 2);
    });

    it("draws ranges and booleans", () => {
        const rng = createRng(5);
        let trues = 0;
        for (let i = 0; i < 10000; i++) {
            const v = rng.range(-2, 3);
            expect(v).toBeGreaterThanOrEqual(-2);
            expect(v).toBeLessThan(3);
            if (rng.bool(0.25)) {
                trues++;
            }
        }
        expect(trues / 10000).toBeCloseTo(0.25, 1);
        expect(rng.bool(0)).toBe(false);
        expect(rng.bool(1)).toBe(true);
    });

    it("picks, weights and shuffles", () => {
        const rng = createRng(9);
        const items = ["a", "b", "c", "d"];
        const picked = new Set<string>();
        for (let i = 0; i < 200; i++) {
            picked.add(rng.pick(items));
        }
        expect(picked.size).toBe(4);
        expect(() => rng.pick([])).toThrow(RangeError);

        const weights: Record<string, number> = { a: 1, b: 3, c: 0, d: -1 };
        const counts: Record<string, number> = { a: 0, b: 0, c: 0, d: 0 };
        for (let i = 0; i < 20000; i++) {
            counts[rng.weighted(items, (item) => weights[item])]++;
        }
        expect(counts.c).toBe(0);
        expect(counts.d).toBe(0);
        expect(counts.b / 20000).toBeCloseTo(0.75, 1);
        expect(() => rng.weighted(items, () => 0)).toThrow(RangeError);

        const deck = Array.from({ length: 52 }, (_, i) => i);
        const shuffled = rng.shuffle([...deck]);
        expect(shuffled).not.toEqual(deck);
        expect([...shuffled].sort((a, b) => a - b)).toEqual(deck);
        expect(createRng(1).shuffle([...deck])).toEqual(createRng(1).shuffle([...deck]));
    });
});

describe("hashString", () => {
    it("matches FNV-1a reference vectors", () => {
        expect(hashString("")).toBe(0x811c9dc5);
        expect(hashString("a")).toBe(0xe40c292c);
        expect(hashString("foobar")).toBe(0xbf9cf968);
    });

    it("hashes UTF-8 bytes", () => {
        expect(hashString("한글")).not.toBe(hashString("글한"));
        // "é" is U+00E9, encoded as C3 A9; hashing the UTF-16 unit 0xE9 would differ.
        let expected = 0x811c9dc5;
        for (const byte of [0xc3, 0xa9]) {
            expected = Math.imul(expected ^ byte, 0x01000193);
        }
        expect(hashString("é")).toBe(expected >>> 0);
    });
});
