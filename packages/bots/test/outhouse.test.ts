// The outhouse (the public toilet; owner report 2026-10-10: bots did not go in and loot it). Its toilet drops 2-3
// items, so exploring weighs it like a small house (brain/sweep.ts buildingPotential), and the bot counts it visited
// only once inside its roof (brain/explore.ts): at 6 u from its middle it stood outside and never saw the toilet.
import { describe, expect, it } from "vitest";
import { buildingPotential } from "../src/brain/sweep.ts";

describe("the outhouse", () => {
    it("is worth a walk: its toilet counts for 2-3 items, more than a crate and less than a red house", () => {
        expect(buildingPotential("outhouse_01")).toBeGreaterThanOrEqual(3);
        expect(buildingPotential("outhouse_01")).toBeLessThan(buildingPotential("house_red_01"));
    });
});
