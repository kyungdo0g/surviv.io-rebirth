// The rebirth buildings' breakable partitions (the owner, 2026-10-10: "a pity: the walls can't be broken";
// rebirth/buildings/walls.ts): every building has interior walls a player can shoot or punch through, like survev's
// house_wall_int_*; and with every one of them broken the building still has no squeeze, and each hidden room still opens
// only by its own door (a broken partition never bypasses a puzzle or the arsenal's unlock).
import { getMapObjectDef, getMapObjectDefOfType, REBIRTH_WALL_INT_LENGTHS, rebirthWallInt } from "@rebirth/defs";
import { describe, expect, it } from "vitest";
import { probeBuilding } from "./buildingProbe.ts";

const REBIRTH = [
    "clinic_01",
    "firestation_01",
    "library_01",
    "radio_station_01",
    "outpost_01r",
    "arsenal_01",
    "blockhouse_01r",
    "military_base_01",
];

/** The buildings a type's children name (the military base is a structure of layer buildings and parts). */
function breakableWalls(type: string): number {
    const def = getMapObjectDef(type);
    if (def.type === "structure")
        return def.layers.reduce((n, l) => n + breakableWalls(l.type), 0);
    if (def.type !== "building") return 0;
    let n = 0;
    for (const c of def.mapObjects) {
        if (typeof c.type !== "string") continue;
        if (c.type.startsWith("rebirth_wall_int_")) n++;
        else if (getMapObjectDef(c.type).type === "building") n += breakableWalls(c.type);
    }
    return n;
}

describe("the rebirth buildings' breakable walls", () => {
    it("are survev's wooden interior wall, re-cut to every length", () => {
        const base = getMapObjectDefOfType("obstacle", "house_wall_int_4");
        for (const len of REBIRTH_WALL_INT_LENGTHS) {
            const d = getMapObjectDefOfType("obstacle", rebirthWallInt(len));
            expect([len, d.destructible, d.health, d.isWall, d.material]).toEqual([len, true, base.health, true, "wood"]);
            expect(d.extents).toEqual({ x: 0.5, y: len / 2 });
        }
    });

    for (const type of REBIRTH) {
        it(`${type}: has breakable partitions, and breaking them all opens no hidden room`, () => {
            expect(breakableWalls(type)).toBeGreaterThanOrEqual(3);
            const intact = probeBuilding(type);
            const broken = probeBuilding(type, { breakWalls: true });
            expect(broken.squeezes.map((g) => `${g.a} / ${g.b} ${g.width} at ${g.x}, ${g.y}`)).toEqual([]);
            // the floor reached from outside grows only by the partitions' own footprint, never by a hidden room
            const key = (r: typeof intact) => r.unlocks.map((u) => `${u.door} ${Math.round(u.area)}`).sort();
            expect(key(broken)).toEqual(key(intact));
        });
    }
});
