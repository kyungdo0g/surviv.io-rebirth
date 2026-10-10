// The rebirth buildings walked with player-sized circles (buildingProbe.ts; the owner's rework, 2026-10-10: "far too
// cramped, some passages can't be walked through, no looting fun, the interactions open nothing"): no passage a player
// has to squeeze through (2 to 2.6 units between two obstacles on a route), next to no floor reached only that way, no
// free floor nobody can reach, and every hidden room's door opens onto loot with guns in it. survev's house_red_01 and
// bank_01 pass the same bar. tools/research/building-probe.ts prints the full table.
import { describe, expect, it } from "vitest";
import { probeBuilding } from "./buildingProbe.ts";

const REBIRTH = [
    "clinic_01",
    "firestation_01",
    "library_01",
    "radio_station_01",
    "outpost_01r",
    "outpost_01b",
    "arsenal_01",
    "blockhouse_01r",
    "blockhouse_01b",
    "military_base_01",
    "military_base_01r",
    "military_base_01b",
];

/** Each building's hidden rooms: its special doors (locked, puzzle or delayed) by type. */
const HIDDEN: Readonly<Record<string, readonly string[]>> = {
    clinic_01: ["vault_door_bathhouse"],
    firestation_01: ["cell_door_01"],
    library_01: ["saloon_door_secret"],
    radio_station_01: ["vault_door_bathhouse"],
    outpost_01r: ["cell_door_01"],
    outpost_01b: ["cell_door_01"],
    arsenal_01: ["lab_door_locked_01"],
    blockhouse_01r: [],
    blockhouse_01b: [],
    military_base_01: ["cell_door_01", "vault_door_main", "vault_door_bathhouse"],
    military_base_01r: ["cell_door_01", "vault_door_main", "vault_door_bathhouse"],
    military_base_01b: ["cell_door_01", "vault_door_main", "vault_door_bathhouse"],
};

describe("the rebirth buildings, walked", () => {
    for (const type of [...REBIRTH, "house_red_01", "bank_01"]) {
        it(`${type}: no squeeze on a route, no floor nobody reaches`, () => {
            const r = probeBuilding(type);
            expect(r.squeezes.map((g) => `${g.a} / ${g.b} ${g.width} at ${g.x}, ${g.y}`)).toEqual([]);
            // the probe's grid leaves a few cells in room corners (survev's bank: 5.5 u²)
            expect(r.layers.reduce((n, l) => n + l.cramped, 0)).toBeLessThanOrEqual(6);
            expect(r.layers.flatMap((l) => l.pockets.filter((p) => p.area >= 1))).toEqual([]);
        });
    }

    for (const type of REBIRTH) {
        it(`${type}: every hidden room opens onto loot with guns`, () => {
            const r = probeBuilding(type);
            expect(r.unlocks.map((u) => u.door).sort()).toEqual([...HIDDEN[type]].sort());
            for (const u of r.unlocks) {
                expect([u.door, u.area > 3, u.containers >= 3, u.guns >= 1.5]).toEqual([u.door, true, true, true]);
            }
        });
    }
});
