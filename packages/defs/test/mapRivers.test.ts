// More rivers (the owner, 2026-10-11; src/rebirth/mapRivers.ts, docs/research/rebirth-deviations.md "Bigger maps"):
// the classic family rolls 2 to 4 rivers, 50v50 its splitting river and 1 to 3 tributaries, on every map size a game
// plays (the player cap's grown maps included); the registry records survev's weights.
import { describe, expect, it } from "vitest";
import mapsJson from "../src/generated/maps.json" with { type: "json" };
import {
    applyRebirthMapRivers,
    getMapDef,
    type MapDef,
    MapDefs,
    mapDefForPlayers,
    REBIRTH_MAP_RIVERS,
    rebirthMapDeviations,
    unscaledMapDef,
} from "../src/index.ts";

const generated = mapsJson as unknown as Readonly<Record<string, MapDef>>;
const CHANGED = ["main", "main_spring", "main_summer", "snow", "faction", "faction_potato"];

describe("rebirth map rivers", () => {
    it("patches the classic family and 50v50 only", () => {
        expect(Object.keys(REBIRTH_MAP_RIVERS).sort()).toEqual([...CHANGED].sort());
        for (const [name, def] of Object.entries(MapDefs)) {
            const want = CHANGED.includes(name) ? REBIRTH_MAP_RIVERS[name] : generated[name].mapGen.map.rivers.weights;
            expect([name, def.mapGen.map.rivers.weights]).toEqual([name, want]);
            // the rest of the river config stays survev's
            const { weights: _a, ...rest } = def.mapGen.map.rivers;
            const { weights: _b, ...survev } = generated[name].mapGen.map.rivers;
            expect([name, rest]).toEqual([name, survev]);
        }
    });

    it("rolls 2 to 4 rivers, 50v50's splitting river first", () => {
        for (const name of CHANGED) {
            for (const { weight, widths } of REBIRTH_MAP_RIVERS[name]) {
                expect(weight).toBeGreaterThan(0);
                expect([name, widths.length >= 2 && widths.length <= 4]).toEqual([name, true]);
                if (getMapDef(name).gameMode.factionMode) expect(widths[0]).toBe(20);
            }
        }
    });

    it("keeps the rivers on the unscaled and the player-cap maps", () => {
        for (const name of CHANGED) {
            expect(unscaledMapDef(name).mapGen.map.rivers.weights).toEqual(REBIRTH_MAP_RIVERS[name]);
            expect(mapDefForPlayers(name, 255).mapGen.map.rivers.weights).toEqual(REBIRTH_MAP_RIVERS[name]);
        }
    });

    it("records each change with survev's weights", () => {
        expect(rebirthMapDeviations.map((d) => `${d.id}.${d.field}`)).toEqual(
            CHANGED.map((name) => `${name}.mapGen.map.rivers.weights`),
        );
        for (const d of rebirthMapDeviations) {
            expect(d.original).toEqual(generated[d.id].mapGen.map.rivers.weights);
            expect(d.rebirth).toEqual(REBIRTH_MAP_RIVERS[d.id]);
        }
        expect(() => applyRebirthMapRivers(generated, { nowhere: [] })).toThrow(/no map "nowhere"/);
    });
});
