// The bigger classic and 50v50 maps (the owner via the lead, 2026-10-08, and the owner, 2026-10-11; packages/defs
// rebirth/mapScale.ts): 1.32 times per side with whole-unit widths, 2 to 4 rivers (rebirth/mapRivers.ts), the other
// maps untouched, the per-map counts grown with the land area (coast, river and bridge spawns and odds kept), and
// buildings per unit of land within 10 % of the maps before the change.
import {
    getMapDef,
    getMapObjectDef,
    type MapDef,
    MapDefs,
    mapWidth,
    REBIRTH_MAP_RIVERS,
    REBIRTH_MAP_SCALE,
    unscaledMapDef,
} from "@rebirth/defs";
import { describe, expect, it } from "vitest";
import { type GenerateMapResult, generateMap } from "../src/index.ts";

const SCALED = ["main", "main_spring", "main_summer", "snow", "faction", "faction_potato"];
const SEEDS = [1, 2, 3, 4, 5];

describe("rebirth map scale", () => {
    it("grows the classic family and 50v50 by 1.32 per side to whole-unit widths", () => {
        expect(Object.keys(REBIRTH_MAP_SCALE).sort()).toEqual([...SCALED].sort());
        for (const name of SCALED) expect([name, REBIRTH_MAP_SCALE[name]]).toEqual([name, 1.32]);
        for (const name of ["main", "main_spring", "main_summer", "snow"]) {
            const def = getMapDef(name);
            expect([name, mapWidth(def, "small"), mapWidth(def, "large")]).toEqual([name, 915, 978]);
            expect([mapWidth(unscaledMapDef(name), "small"), mapWidth(unscaledMapDef(name), "large")]).toEqual([
                720, 768,
            ]);
        }
        for (const name of ["faction", "faction_potato"]) {
            expect([name, mapWidth(getMapDef(name), "large")]).toEqual([name, 1126]);
            expect(mapWidth(unscaledMapDef(name), "large")).toBe(880);
        }
        // the generated maps take those sizes (squads: the large scale)
        expect(generateMap("main", 3, 1).mapData.width).toBe(915);
        expect(generateMap("main", 3, 4).mapData.width).toBe(978);
        expect(generateMap("faction", 3, 4).mapData.width).toBe(1126);
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
            house_red_01: { small: 5, large: 7 },
            warehouse_01: { small: 2, large: 3 },
            tree_02: 5,
            // one-offs, odds
            warehouse_complex_01: 1,
            bunker_structure_01: { odds: 0.05 },
            // the coast and the bridges
            hut_01: 3,
            shack_03a: 2,
            shack_03b: { small: 2, large: 3 },
        });
        expect(getMapDef("faction").mapGen.fixedSpawns[0]).toMatchObject({
            warehouse_01f: 10,
            house_red_01: 7,
            barn_01: 7,
            hut_01: 4,
            bunker_structure_01: { odds: 1 },
            outpost_01r: 1,
        });
        expect(getMapDef("snow").mapGen.fixedSpawns[0]).toMatchObject({
            camp_01: { small: 3, large: 5 },
            stone_04x: 5,
        });
    });

    it("gives the classic family 2 to 4 rivers and 50v50 its splitting river with 1 to 3 tributaries", () => {
        for (const name of SCALED) {
            const weights = getMapDef(name).mapGen.map.rivers.weights;
            expect(weights).toEqual(REBIRTH_MAP_RIVERS[name]);
            const faction = name.startsWith("faction");
            for (const { widths } of weights) {
                expect(widths.length).toBeGreaterThanOrEqual(2);
                expect(widths.length).toBeLessThanOrEqual(4);
                if (faction) expect(widths[0]).toBe(20);
            }
        }
        // generated: every rolled river lands, side rivers join the first, and bridges cross them
        for (const [name, teamMode] of [
            ["main", 1],
            ["main", 4],
            ["snow", 4],
            ["faction", 4],
        ] as const) {
            for (const seed of SEEDS) {
                const g = generateMap(name, seed, teamMode);
                const rivers = g.terrain.rivers.filter((r) => !r.looped);
                expect([name, seed, rivers.length >= 2 && rivers.length <= 4]).toEqual([name, seed, true]);
                expect(g.warnings.filter((w) => w.includes("river"))).toEqual([]);
                if (name === "faction") expect(Math.max(...rivers.map((r) => r.waterWidth))).toBe(20);
                const bridges = g.objects.filter((o) => o.parentId === 0 && o.type.includes("bridge"));
                expect(bridges.length).toBeGreaterThanOrEqual(2);
            }
        }
    }, 60_000);

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
