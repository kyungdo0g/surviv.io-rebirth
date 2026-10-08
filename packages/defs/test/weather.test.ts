// Rebirth rainy matches (rebirth/weather.ts; docs/research/rebirth-deviations.md "Rainy matches"): the weather roll of
// the map seed rains on about 30 % of the classic and 50v50 matches and never on the other maps (nor on the classic and
// 50v50 variants with camera particles of their own), deterministically, so every client of a match (all of them roll
// the same seed) sees the same weather.
import { describe, expect, it } from "vitest";
import { getMapDef, isRainyMatch, MapDefs, RAIN_CHANCE, RAINY_MAPS, weatherRoll } from "../src/index.ts";

const SEEDS = 10_000;

/** share of seeds 0..SEEDS-1 (or `seedOf(i)`) that rain on `mapName` */
function rainyShare(mapName: string, seedOf: (i: number) => number = (i) => i): number {
    let rainy = 0;
    for (let i = 0; i < SEEDS; i++) if (isRainyMatch(mapName, seedOf(i))) rainy++;
    return rainy / SEEDS;
}

describe("rainy matches", () => {
    it("rain on about 30 % of the classic and 50v50 seeds", () => {
        expect(RAIN_CHANCE).toBe(0.3);
        expect([...RAINY_MAPS].sort()).toEqual(["faction", "main", "main_summer"]);
        for (const mapName of RAINY_MAPS) {
            expect(MapDefs[mapName], mapName).toBeDefined();
            // no falling leaves, blossoms, snow or potatoes of their own to mix with the rain
            expect(getMapDef(mapName).biome.particles.camera, mapName).toBe("");
            const share = rainyShare(mapName);
            // 10k Bernoulli(0.3) draws: one standard deviation is 0.46 %
            expect(share, mapName).toBeGreaterThan(0.285);
            expect(share, mapName).toBeLessThan(0.315);
        }
    });

    it("stay near 30 % over the server's random 32-bit seeds (spread over the whole range)", () => {
        // a fixed multiplicative walk over the uint32 range, like the server's randomInt(0, 2^32 - 1)
        const share = rainyShare("faction", (i) => Math.imul(i + 1, 0x9e3779b1) >>> 0);
        expect(share).toBeGreaterThan(0.285);
        expect(share).toBeLessThan(0.315);
    });

    it("never rain on the event maps nor on the variants with their own camera particles (they keep their looks)", () => {
        const others = Object.keys(MapDefs).filter((name) => !RAINY_MAPS.includes(name));
        expect(others).toEqual(expect.arrayContaining(["halloween", "snow", "desert", "woods", "potato", "cobalt"]));
        // the spring blossoms and the Potato vs Tomato 50v50 event
        expect(getMapDef("main_spring").biome.particles.camera).toBe("falling_leaf_spring");
        expect(getMapDef("faction_potato").biome.particles.camera).toBe("falling_pvt");
        expect(rainyShare("main_spring")).toBe(0);
        expect(rainyShare("faction_potato")).toBe(0);
        for (const mapName of others) expect(rainyShare(mapName), mapName).toBe(0);
        expect(isRainyMatch("unknown_map", 2)).toBe(false);
    });

    it("are deterministic: the same seed always rolls the same weather, independent of the map", () => {
        for (let seed = 0; seed < 500; seed++) {
            expect(isRainyMatch("main", seed)).toBe(isRainyMatch("main", seed));
            expect(isRainyMatch("faction", seed)).toBe(isRainyMatch("main", seed));
            const roll = weatherRoll(seed);
            expect(roll).toBeGreaterThanOrEqual(0);
            expect(roll).toBeLessThan(1);
        }
        // pinned: clients of different builds must agree on a match's weather
        const rainy: number[] = [];
        for (let seed = 0; rainy.length < 8; seed++) if (isRainyMatch("main", seed)) rainy.push(seed);
        expect(rainy).toEqual([2, 4, 10, 17, 37, 42, 43, 44]);
        expect(weatherRoll(1)).toBeCloseTo(0.905096, 6);
        expect(weatherRoll(0xffffffff)).toBeCloseTo(0.007135, 6);
    });

    it("roll neighbouring seeds independently (no long dry or wet runs)", () => {
        let longest = 0;
        let run = 0;
        let prev = false;
        for (let seed = 0; seed < SEEDS; seed++) {
            const rainy = isRainyMatch("main", seed);
            run = rainy === prev ? run + 1 : 1;
            prev = rainy;
            longest = Math.max(longest, run);
        }
        // the longest dry run of 10k fair draws at p = 0.7 is about log(10k * 0.3) / -log(0.7), ~22
        expect(longest).toBeLessThan(40);
    });
});
