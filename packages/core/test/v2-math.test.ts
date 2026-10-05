import { describe, expect, it } from "vitest";
import { createRng, math, v2 } from "../src/index.ts";

describe("v2", () => {
    it("creates, copies and sets", () => {
        expect(v2.create(3)).toEqual({ x: 3, y: 3 });
        expect(v2.create(1, 2)).toEqual({ x: 1, y: 2 });
        const a = v2.create(1, 2);
        const b = v2.copy(a);
        expect(b).toEqual(a);
        expect(b).not.toBe(a);
        const out = v2.create(0);
        expect(v2.set(out, a)).toBe(out);
        expect(out).toEqual({ x: 1, y: 2 });
    });

    it("does arithmetic without mutating inputs", () => {
        const a = v2.create(1, 2);
        const b = v2.create(3, -4);
        expect(v2.add(a, b)).toEqual({ x: 4, y: -2 });
        expect(v2.sub(a, b)).toEqual({ x: -2, y: 6 });
        expect(v2.mul(a, 3)).toEqual({ x: 3, y: 6 });
        expect(v2.mulElems(a, b)).toEqual({ x: 3, y: -8 });
        expect(v2.div(b, 2)).toEqual({ x: 1.5, y: -2 });
        expect(v2.neg(a)).toEqual({ x: -1, y: -2 });
        expect(v2.abs(b)).toEqual({ x: 3, y: 4 });
        expect(v2.floor(v2.create(1.7, -1.2))).toEqual({ x: 1, y: -2 });
        expect(v2.min(a, b)).toEqual({ x: 1, y: -4 });
        expect(v2.max(a, b)).toEqual({ x: 3, y: 2 });
        expect(a).toEqual({ x: 1, y: 2 });
    });

    it("measures lengths and distances", () => {
        const a = v2.create(3, 4);
        expect(v2.length(a)).toBe(5);
        expect(v2.lengthSqr(a)).toBe(25);
        expect(v2.distance(a, v2.create(0, 0))).toBe(5);
        expect(v2.distanceSqr(a, v2.create(1, 1))).toBe(13);
        expect(v2.dot(a, v2.create(2, 1))).toBe(10);
        expect(v2.det(v2.create(1, 0), v2.create(0, 1))).toBe(1);
    });

    it("normalizes with sensible zero handling", () => {
        expect(v2.eq(v2.normalize(v2.create(3, 4)), v2.create(0.6, 0.8))).toBe(true);
        expect(v2.normalize(v2.create(0, 0))).toEqual({ x: 1, y: 0 });
        expect(v2.normalizeSafe(v2.create(0, 0), v2.create(0, -1))).toEqual({ x: 0, y: -1 });
    });

    it("rotates counter-clockwise and reports angles", () => {
        expect(v2.eq(v2.rotate(v2.create(1, 0), Math.PI / 2), v2.create(0, 1))).toBe(true);
        expect(v2.eq(v2.rotate(v2.create(1, 2), Math.PI), v2.create(-1, -2))).toBe(true);
        expect(v2.eq(v2.perp(v2.create(1, 0)), v2.create(0, 1))).toBe(true);
        expect(v2.angle(v2.create(0, 1))).toBeCloseTo(Math.PI / 2);
        expect(v2.angle(v2.create(-1, 0))).toBeCloseTo(Math.PI);
    });

    it("lerps and compares with tolerance", () => {
        expect(v2.lerp(0.25, v2.create(0, 0), v2.create(4, 8))).toEqual({ x: 1, y: 2 });
        expect(v2.eq(v2.create(1, 1), v2.create(1.00005, 1))).toBe(true);
        expect(v2.eq(v2.create(1, 1), v2.create(1.001, 1))).toBe(false);
        expect(v2.eq(v2.create(1, 1), v2.create(1.001, 1), 0.01)).toBe(true);
    });

    it("draws deterministic unit vectors", () => {
        const a = createRng(5);
        const b = createRng(5);
        for (let i = 0; i < 100; i++) {
            const u = v2.randomUnit(a);
            expect(v2.length(u)).toBeCloseTo(1, 10);
            expect(u).toEqual(v2.randomUnit(b));
        }
    });
});

describe("math", () => {
    it("clamps, lerps and remaps", () => {
        expect(math.clamp(5, 0, 3)).toBe(3);
        expect(math.clamp(-1, 0, 3)).toBe(0);
        expect(math.clamp(2, 0, 3)).toBe(2);
        expect(math.lerp(0.5, 10, 20)).toBe(15);
        expect(math.delerp(15, 10, 20)).toBe(0.5);
        expect(math.delerp(25, 10, 20)).toBe(1);
        expect(math.remap(5, 0, 10, 100, 200)).toBe(150);
        expect(math.remap(50, 0, 10, 100, 200)).toBe(200);
        expect(math.remap(-5, 0, 10, 100, 200)).toBe(100);
        expect(math.smoothstep(0.5, 0, 1)).toBe(0.5);
        expect(math.smoothstep(2, 0, 1)).toBe(1);
    });

    it("compares floats", () => {
        expect(math.eqAbs(1, 1 + 1e-6)).toBe(true);
        expect(math.eqAbs(1, 1.001)).toBe(false);
        expect(math.eqRel(1e6, 1e6 + 1)).toBe(true);
        expect(math.eqRel(1e6, 1e6 + 100)).toBe(false);
    });

    it("converts angles", () => {
        expect(math.deg2rad(180)).toBeCloseTo(Math.PI);
        expect(math.rad2deg(Math.PI / 2)).toBeCloseTo(90);
        expect(math.fmod(-1, 4)).toBe(3);
        expect(math.fmod(5, 4)).toBe(1);
        expect(math.angleDiff(0, Math.PI / 2)).toBeCloseTo(Math.PI / 2);
        expect(math.angleDiff(0.1, Math.PI * 2 - 0.1)).toBeCloseTo(-0.2);
        expect(math.angleDiff(Math.PI * 2 - 0.1, 0.1)).toBeCloseTo(0.2);
    });

    it("maps orientations", () => {
        expect(math.oriToRad(0)).toBe(0);
        expect(math.oriToRad(1)).toBeCloseTo(Math.PI / 2);
        expect(math.oriToRad(2)).toBeCloseTo(Math.PI);
        expect(math.oriToRad(3)).toBeCloseTo(Math.PI * 1.5);
        expect(math.oriToRad(5)).toBeCloseTo(Math.PI / 2);
        expect(math.oriToAngle(3)).toBe(270);
        for (let ori = 0; ori < 4; ori++) {
            expect(math.radToOri(math.oriToRad(ori))).toBe(ori);
            expect(math.radToOri(math.oriToRad(ori) + 0.3)).toBe(ori);
        }
        expect(math.radToOri(-Math.PI / 2)).toBe(3);
    });

    it("addAdjust rotates the offset by quarter turns before adding", () => {
        const base = v2.create(10, 20);
        const offset = v2.create(2, 1);
        expect(math.addAdjust(base, offset, 0)).toEqual({ x: 12, y: 21 });
        expect(math.addAdjust(base, offset, 1)).toEqual({ x: 9, y: 22 });
        expect(math.addAdjust(base, offset, 2)).toEqual({ x: 8, y: 19 });
        expect(math.addAdjust(base, offset, 3)).toEqual({ x: 11, y: 18 });
        for (let ori = 0; ori < 4; ori++) {
            const rotated = v2.add(base, v2.rotate(offset, math.oriToRad(ori)));
            expect(v2.eq(math.addAdjust(base, offset, ori), rotated)).toBe(true);
        }
    });
});
