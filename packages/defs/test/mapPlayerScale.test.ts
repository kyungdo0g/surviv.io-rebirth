// Maps follow the player cap (the owner via the lead, 2026-10-08; defs data.ts mapDefForPlayers, rebirth/mapScale.ts):
// a cap above the map's design count grows the map by the square root of the ratio, at most twice the land area; at
// or below it (or with no cap) a game plays on the map's own def. Counts follow the land area except one-offs, the
// rebirth buildings, odds and coast, river and bridge spawns; random picks never exceed their pool.
import { describe, expect, it } from "vitest";
import {
    designPlayers,
    FACTION_DESIGN_PLAYERS,
    getMapDef,
    getMapObjectDef,
    MAX_PLAYER_AREA_FACTOR,
    type MapDef,
    MapDefs,
    mapDefForPlayers,
    mapWidth,
    playerAreaFactor,
    REBIRTH_BUILDING_SPAWNS,
    REBIRTH_MAP_SCALE,
    scaleMapDef,
    unscaledMapDef,
} from "../src/index.ts";

const widths = (def: MapDef) => [mapWidth(def, "small"), mapWidth(def, "large")];

describe("maps follow the player cap", () => {
    it("plays the map's own def with no cap or a cap at or below the design count", () => {
        for (const name of Object.keys(MapDefs)) {
            const own = getMapDef(name);
            const design = designPlayers(own);
            for (const cap of [undefined, 0, 1, 40, design]) expect(mapDefForPlayers(name, cap), name).toBe(own);
        }
    });

    it("designs 50v50 maps for 100 players and every other map for its mode's maxPlayers", () => {
        expect(FACTION_DESIGN_PLAYERS).toBe(100);
        for (const [name, def] of Object.entries(MapDefs)) {
            const want = def.gameMode.factionMode ? 100 : def.gameMode.maxPlayers;
            expect([name, designPlayers(def)]).toEqual([name, want]);
        }
        // test_faction's mode says 80, but its games take the server's 50v50 cap
        expect(designPlayers(getMapDef("test_faction"))).toBe(100);
        expect(MAX_PLAYER_AREA_FACTOR).toBe(2);
        const main = getMapDef("main");
        expect([90, 120, 160, 200, 255].map((c) => playerAreaFactor(main, c))).toEqual([1.125, 1.5, 2, 2, 2]);
    });

    it("rebuilds each map's own def from the unscaled one (the route a capped map takes)", () => {
        for (const name of Object.keys(MapDefs)) {
            const fixed = new Set(Object.keys(REBIRTH_BUILDING_SPAWNS[name] ?? {}));
            const grass = (type: string) => {
                if (fixed.has(type)) return false;
                const t = (getMapObjectDef(type) as { terrain?: Record<string, unknown> }).terrain;
                return !!t?.grass && !t.bridge && !t.waterEdge && !t.nearbyRiver;
            };
            const rebuilt = scaleMapDef(unscaledMapDef(name), REBIRTH_MAP_SCALE[name] ?? 1, grass);
            expect([name, rebuilt.mapGen]).toEqual([name, getMapDef(name).mapGen]);
        }
    });

    it("grows the side by the square root of cap / design, up to twice the land area", () => {
        for (const name of ["main", "main_spring", "main_summer", "snow"]) {
            expect([name, widths(mapDefForPlayers(name, 100))]).toEqual([name, [928, 992]]);
            for (const cap of [160, 200, 255])
                expect([name, cap, ...widths(mapDefForPlayers(name, cap))]).toEqual([name, cap, 1144, 1225]);
        }
        for (const name of ["faction", "faction_potato"]) {
            expect(widths(mapDefForPlayers(name, 150))).toEqual([1241, 1241]);
            for (const cap of [200, 255])
                expect([name, cap, ...widths(mapDefForPlayers(name, cap))]).toEqual([name, cap, 1415, 1415]);
        }
        // maps the rebirth's 1.2 left alone grow from the survev size
        expect(widths(mapDefForPlayers("cobalt", 160))).toEqual([972, 1040]);
        expect(widths(mapDefForPlayers("desert", 200))).toEqual([972, 972]);
        expect(widths(mapDefForPlayers("test_faction", 100))).toEqual(widths(getMapDef("test_faction")));
    });

    it("keeps one-offs, the rebirth buildings, odds and the map's game rules; picks stay within their pools", () => {
        for (const name of ["main", "main_spring", "main_summer", "snow", "faction", "faction_potato", "cobalt"]) {
            const own = getMapDef(name);
            const grown = mapDefForPlayers(name, 255);
            expect(grown).not.toBe(own);
            expect(mapDefForPlayers(name, 255)).toBe(grown);
            expect(grown.gameMode).toBe(own.gameMode);
            expect(grown.gameConfig).toBe(own.gameConfig);
            expect(grown.lootTable).toBe(own.lootTable);
            const ownSpawns = own.mapGen.fixedSpawns[0] ?? {};
            const grownSpawns = grown.mapGen.fixedSpawns[0] ?? {};
            for (const [type, c] of Object.entries(ownSpawns)) {
                if (c === 1) expect([name, type, grownSpawns[type]]).toEqual([name, type, 1]);
                if (typeof c === "object" && "odds" in c)
                    expect([name, type, grownSpawns[type]]).toEqual([name, type, c]);
            }
            for (const [type, n] of Object.entries(REBIRTH_BUILDING_SPAWNS[name] ?? {})) {
                expect([name, type, grownSpawns[type]]).toEqual([name, type, n]);
            }
            for (const r of grown.mapGen.randomSpawns) expect(r.choose).toBeLessThanOrEqual(r.spawns.length);
        }
        // the 50v50 arsenal opens by a scheduled unlock of the first of its type: still one
        expect(mapDefForPlayers("faction", 255).mapGen.fixedSpawns[0]?.arsenal_01).toBe(1);
    });

    it("grows the counts on the grass with the land area", () => {
        const own = getMapDef("main").mapGen.fixedSpawns[0];
        const grown = mapDefForPlayers("main", 160).mapGen.fixedSpawns[0];
        expect(own).toMatchObject({ house_red_01: { small: 4, large: 6 }, tree_02: 4, hut_01: 3 });
        // grown once from the survev counts by the land area (side less the 2 x 48 shore): small (1048 / 624)² ≈ 2.8,
        // large (1129 / 672)² ≈ 2.8 (survev house_red_01 3 / 4, tree_02 3); the coast's huts keep theirs
        expect(grown).toMatchObject({ house_red_01: { small: 8, large: 11 }, tree_02: 8, hut_01: 3 });
    });
});
