// The bigger classic and 50v50 maps (the owner via the lead, 2026-10-08; packages/defs rebirth/mapScale.ts): 1.2 times
// per side with whole-unit widths, the other maps untouched, the per-map counts grown with the land area (coast,
// river and bridge spawns and odds kept), and buildings per unit of land within 10 % of the maps before the change.
import {
    getMapDef,
    getMapObjectDef,
    type MapDef,
    MapDefs,
    mapWidth,
    REBIRTH_MAP_SCALE,
    unscaledMapDef,
} from "@rebirth/defs";
import { describe, expect, it } from "vitest";
import { type GenerateMapResult, generateMap } from "../src/index.ts";

const SCALED = ["main", "main_spring", "main_summer", "snow", "faction", "faction_potato"];
const SEEDS = [1, 2, 3, 4, 5];

describe("rebirth map scale", () => {
    it("grows the classic family and 50v50 by 1.2 per side to whole-unit widths", () => {
        expect(Object.keys(REBIRTH_MAP_SCALE).sort()).toEqual([...SCALED].sort());
        for (const name of SCALED) expect([name, REBIRTH_MAP_SCALE[name]]).toEqual([name, 1.2]);
        for (const name of ["main", "main_spring", "main_summer", "snow"]) {
            const def = getMapDef(name);
            expect([name, mapWidth(def, "small"), mapWidth(def, "large")]).toEqual([name, 842, 899]);
            expect([mapWidth(unscaledMapDef(name), "small"), mapWidth(unscaledMapDef(name), "large")]).toEqual([
                720, 768,
            ]);
        }
        for (const name of ["faction", "faction_potato"]) {
            expect([name, mapWidth(getMapDef(name), "large")]).toEqual([name, 1034]);
            expect(mapWidth(unscaledMapDef(name), "large")).toBe(880);
        }
        // the generated maps take those sizes (squads: the large scale)
        expect(generateMap("main", 3, 1).mapData.width).toBe(842);
        expect(generateMap("main", 3, 4).mapData.width).toBe(899);
        expect(generateMap("faction", 3, 4).mapData.width).toBe(1034);
    });

    it("leaves every other map as ported", () => {
        for (const [name, def] of Object.entries(MapDefs)) {
            if (SCALED.includes(name)) continue;
            expect([name, def.mapGen]).toEqual([name, unscaledMapDef(name).mapGen]);
        }
    });

    it("grows the per-map counts with the land area, keeping coast, river and bridge spawns, odds and one-offs", () => {
        const main = getMapDef("main").mapGen;
        expect(main.randomSpawns[0].choose).toBe(3);
        expect(main.fixedSpawns[0]).toMatchObject({
            house_red_01: { small: 4, large: 6 },
            warehouse_01: { small: 1, large: 3 },
            tree_02: 4,
            // one-offs, odds
            warehouse_complex_01: 1,
            bunker_structure_01: { odds: 0.05 },
            // the coast and the bridges
            hut_01: 3,
            shack_03a: 2,
            shack_03b: { small: 2, large: 3 },
        });
        expect(getMapDef("faction").mapGen.fixedSpawns[0]).toMatchObject({
            warehouse_01f: 9,
            house_red_01: 6,
            barn_01: 6,
            hut_01: 4,
            bunker_structure_01: { odds: 1 },
            outpost_01r: 1,
        });
        expect(getMapDef("snow").mapGen.fixedSpawns[0]).toMatchObject({
            camp_01: { small: 3, large: 4 },
            stone_04x: 4,
        });
    });

    /** Top-level buildings and structures per 100 000 units² of land (inside the shore inset). */
    function density(def: MapDef, g: GenerateMapResult): number {
        const land = (g.mapData.width - 2 * def.mapGen.map.shoreInset) ** 2;
        let n = 0;
        for (const o of g.objects) {
            if (o.parentId !== 0) continue;
            const t = getMapObjectDef(o.type).type;
            if (t === "building" || t === "structure") n++;
        }
        return (n / land) * 1e5;
    }

    for (const name of SCALED) {
        const modes: Array<1 | 4> = name.startsWith("faction") ? [4] : [1, 4];
        for (const teamMode of modes) {
            it(`${name} (team mode ${teamMode}): buildings per land area within 10 % of the unscaled map`, () => {
                const scaledDef = getMapDef(name);
                const baseDef = unscaledMapDef(name);
                let scaled = 0;
                let base = 0;
                for (const seed of SEEDS) {
                    scaled += density(scaledDef, generateMap(name, seed, teamMode));
                    base += density(baseDef, generateMap(name, seed, teamMode, baseDef));
                }
                const ratio = scaled / base;
                expect(ratio, `${name}/${teamMode}: ${(ratio * 100 - 100).toFixed(1)} %`).toBeGreaterThan(0.9);
                expect(ratio, `${name}/${teamMode}: ${(ratio * 100 - 100).toFixed(1)} %`).toBeLessThan(1.1);
            }, 60_000);
        }
    }
});
