// The hit-counted blast door's damage on screen (the owner, 2026-10-11; objects/gateDamage.ts): the door darkens with
// every launcher hit its health on the wire shows and smokes once hit; the subway gate and other obstacles are untouched.
import { BLAST_DOOR, getMapObjectDefOfType, SUBWAY_GATE } from "@rebirth/defs";
import { describe, expect, it } from "vitest";
import { gateScorch, gateSmokes, isHitCountedGate, SCORCH_MAX } from "../src/objects/gateDamage.ts";

describe("blast door damage", () => {
    it("only the hit-counted blast door shows it", () => {
        expect(isHitCountedGate(getMapObjectDefOfType("obstacle", BLAST_DOOR))).toBe(true);
        expect(isHitCountedGate(getMapObjectDefOfType("obstacle", SUBWAY_GATE))).toBe(false);
        expect(isHitCountedGate(getMapObjectDefOfType("obstacle", "barrel_01"))).toBe(false);
    });

    it("darkens a step with every RPG-7 rocket, and smokes once hit", () => {
        const steps = [6, 5, 4, 3, 2, 1].map((left) => gateScorch(left / 6));
        expect(steps[0]).toBe(1);
        for (let i = 1; i < steps.length; i++) expect(steps[i]).toBeLessThan(steps[i - 1]);
        expect(gateScorch(0)).toBeCloseTo(1 - SCORCH_MAX, 9);
        // the 8-bit health on the wire: one rocket still shows
        expect(gateScorch(Math.round((5 / 6) * 255) / 255)).toBeLessThan(1);
        expect([gateSmokes(1, false), gateSmokes(5 / 6, false), gateSmokes(5 / 6, true)]).toEqual([false, true, false]);
    });
});
