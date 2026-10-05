import { describe, expect, it } from "vitest";
import { pointInPolygon, polygonArea } from "../src/geom/polygon.ts";
import { buildTerrain, type MapData, terrainToShape } from "../src/index.ts";
import { cachedMap } from "./helpers.ts";

function bareMap(seed: number): MapData {
    return {
        mapName: "main",
        seed,
        width: 720,
        height: 720,
        shoreInset: 48,
        grassInset: 18,
        rivers: [],
        places: [],
        groundPatches: [],
        objects: [],
    };
}

describe("buildTerrain", () => {
    it("is deterministic: the same MapData gives identical polygons", () => {
        const { mapData } = cachedMap("main", 12345);
        const a = buildTerrain(mapData);
        const b = buildTerrain(structuredClone(mapData));
        expect(b).toEqual(a);
        expect(a.rivers.length).toBe(mapData.rivers.length);
    });

    it("matches the terrain map generation used", () => {
        const gen = cachedMap("main", 12345);
        expect(buildTerrain(gen.mapData)).toEqual(terrainToShape(gen.terrain));
    });

    it("depends on the seed", () => {
        expect(buildTerrain(bareMap(1)).shore).not.toEqual(buildTerrain(bareMap(2)).shore);
    });

    it("builds a jagged shore inside the map and a grass outline inside the shore", () => {
        const map = bareMap(77);
        const t = buildTerrain(map);
        // 64 subdivisions per side plus the 4 corners
        expect(t.shore.length).toBe(4 * 65);
        expect(t.grass.length).toBe(t.shore.length);
        for (const p of t.shore) {
            expect(p.x).toBeGreaterThanOrEqual(0);
            expect(p.y).toBeGreaterThanOrEqual(0);
            expect(p.x).toBeLessThanOrEqual(map.width);
            expect(p.y).toBeLessThanOrEqual(map.height);
            // shoreVariation 3 around the inset rectangle
            const dx = Math.min(Math.abs(p.x - 48), Math.abs(p.x - 672));
            const dy = Math.min(Math.abs(p.y - 48), Math.abs(p.y - 672));
            expect(Math.min(dx, dy)).toBeLessThanOrEqual(3 + 1e-9);
        }
        for (const p of t.grass) expect(pointInPolygon(p, t.shore)).toBe(true);
        const shoreArea = polygonArea(t.shore);
        expect(shoreArea).toBeGreaterThan(620 * 620);
        expect(shoreArea).toBeLessThan(630 * 630);
        expect(polygonArea(t.grass)).toBeLessThan(shoreArea);
    });

    it("builds river polygons clipped to the map with the bank around the water", () => {
        const { mapData } = cachedMap("main", 12345);
        const t = buildTerrain(mapData);
        expect(t.rivers.length).toBeGreaterThan(0);
        for (const river of t.rivers) {
            expect(river.center.length).toBeGreaterThan(10);
            expect(river.waterPoly.length).toBe(river.center.length * 2);
            expect(river.shorePoly.length).toBe(river.center.length * 2);
            for (const p of [...river.waterPoly, ...river.shorePoly]) {
                expect(p.x).toBeGreaterThanOrEqual(0);
                expect(p.y).toBeGreaterThanOrEqual(0);
                expect(p.x).toBeLessThanOrEqual(mapData.width);
                expect(p.y).toBeLessThanOrEqual(mapData.height);
            }
            const water = polygonArea(river.waterPoly);
            const shore = polygonArea(river.shorePoly);
            expect(water).toBeGreaterThan(0);
            expect(shore).toBeGreaterThan(water);
            // the centre line runs inside the water
            const inner = river.center.slice(1, -1);
            const inside = inner.filter((p) => pointInPolygon(p, river.waterPoly)).length;
            expect(inside / inner.length).toBeGreaterThan(0.9);
        }
    });

    it("builds lakes as closed rings", () => {
        const gen = cachedMap("woods", 12345);
        const lakes = buildTerrain(gen.mapData).rivers.filter((r) => r.looped);
        expect(lakes.length).toBe(1);
        const lake = lakes[0];
        expect(polygonArea(lake.waterPoly)).toBeGreaterThan(1000);
        // the island in the middle of the lake is dry
        const c = gen.terrain.rivers.find((r) => r.looped)!.center;
        expect(pointInPolygon(c, lake.waterPoly)).toBe(false);
    });
});
