// Rebirth buildings (the owner, 2026-10-08: "make a building yourself, one for the normal map and one only for
// 50v50", then "more of them, the maps get bigger"; docs/research/rebirth-deviations.md). Each is built like the
// original houses: invisible wall obstacles, original doors, windows and furniture, and a floor and roof image of its
// own. Those images are rebirth art (apps/client/public/rebirth/map/*.svg, drawn from the layouts by
// tools/assets/rebirthBuildingArt.ts, so the walls drawn on the floor are the walls that collide). One file per
// building in rebirth/buildings/; this module lists them, their art and where they spawn.
import type { LootSpawnerDef, MapDef, MapObjectDef } from "../types/index.ts";
import { ARSENAL_ART, ARSENAL_UNLOCK, arsenal } from "./buildings/arsenal.ts";
import {
    BLOCKHOUSE_CODE,
    BLOCKHOUSE_FACTIONS,
    BLOCKHOUSE_PUZZLE,
    blockhouse,
    blockhouseArt,
} from "./buildings/blockhouse.ts";
import { CLINIC_ART, CLINIC_PUZZLE, clinic, MEDICAL_LOOT_SPAWNER } from "./buildings/clinic.ts";
import { FIRESTATION_ART, FIRESTATION_PUZZLE, firestation } from "./buildings/firestation.ts";
import type { RebirthBuildingArt } from "./buildings/layout.ts";
import { LIBRARY_ART, LIBRARY_CODE, LIBRARY_PUZZLE, library } from "./buildings/library.ts";
import { MILITARY_ARMORY_PUZZLE } from "./buildings/military/armory.ts";
import { MILITARY_COMMAND_CODE, MILITARY_COMMAND_PUZZLE } from "./buildings/military/bunker.ts";
import { MILITARY_GATEHOUSE_PUZZLE } from "./buildings/military/guard.ts";
import { MILITARY_HQ_CODE, MILITARY_HQ_PUZZLE } from "./buildings/military/hq.ts";
import { MILITARY_INFIRMARY_PUZZLE } from "./buildings/military/infirmary.ts";
import { militaryBaseArt, militaryBaseDefs } from "./buildings/military/structure.ts";
import { OUTPOST_FACTIONS, OUTPOST_PUZZLE, outpost, outpostArt } from "./buildings/outpost.ts";
import { RADIO_ART, RADIO_CODE, RADIO_PUZZLE, radioStation } from "./buildings/radio.ts";

export * from "./buildings/arsenal.ts";
export * from "./buildings/blockhouse.ts";
export * from "./buildings/clinic.ts";
export * from "./buildings/firestation.ts";
export * from "./buildings/layout.ts";
export * from "./buildings/library.ts";
export * from "./buildings/military/armory.ts";
export * from "./buildings/military/bunker.ts";
export * from "./buildings/military/compound.ts";
export * from "./buildings/military/guard.ts";
export * from "./buildings/military/hq.ts";
export * from "./buildings/military/infirmary.ts";
export type {
    Box as MilitaryBox,
    MilitaryPart,
    PartImage,
    PartMapShape,
    Prop as MilitaryProp,
} from "./buildings/military/part.ts";
export * from "./buildings/military/structure.ts";
export * from "./buildings/military/yard.ts";
export * from "./buildings/outpost.ts";
export * from "./buildings/radio.ts";

/**
 * Codes of the rebirth buildings' puzzles (the sim's puzzle engine, world/puzzles.ts, reads them with survev's): the
 * switches' labels in the order that opens the building's hidden room.
 */
export const REBIRTH_PUZZLE_CODES: Readonly<Record<string, readonly string[]>> = {
    [CLINIC_PUZZLE]: ["1"],
    [RADIO_PUZZLE]: RADIO_CODE,
    [LIBRARY_PUZZLE]: LIBRARY_CODE,
    [FIRESTATION_PUZZLE]: ["1"],
    [OUTPOST_PUZZLE]: ["1"],
    [MILITARY_GATEHOUSE_PUZZLE]: ["1"],
    [MILITARY_COMMAND_PUZZLE]: MILITARY_COMMAND_CODE,
    // the hidden rooms added on 2026-10-10 ("expand the content")
    [BLOCKHOUSE_PUZZLE]: BLOCKHOUSE_CODE,
    [MILITARY_HQ_PUZZLE]: MILITARY_HQ_CODE,
    [MILITARY_ARMORY_PUZZLE]: ["1"],
    [MILITARY_INFIRMARY_PUZZLE]: ["1"],
};

/** Buildings whose heal regions the client draws (apps/client objects/healRegionFx.ts: glow, crosses, ring pulse). */
export const REBIRTH_HEAL_FX_BUILDINGS: ReadonlySet<string> = new Set(["clinic_01", "military_infirmary_01"]);

/**
 * 50v50 front-line buildings (sim mapgen placement.ts): a neutral one goes in a tenth touching the river line, a
 * faction's (`teamId`) in its own two tenths beside it, instead of anywhere or its spawn edge.
 */
export const REBIRTH_FRONT_LINE_BUILDINGS: ReadonlySet<string> = new Set([
    "arsenal_01",
    ...BLOCKHOUSE_FACTIONS.map((f) => f.id),
]);

/**
 * 50v50 home buildings (sim mapgen placement.ts): a faction's (`teamId`) goes in its own half outside its spawn tenth,
 * where `teamId` alone would put it on the spawn edge (the military bases are too big for that band).
 */
export const REBIRTH_OWN_HALF_BUILDINGS: ReadonlySet<string> = new Set(["military_base_01r", "military_base_01b"]);

/** Sprite ids of every rebirth building image, with their size (the client's sprite manifest entries). */
export function rebirthBuildingArt(): RebirthBuildingArt[] {
    return [
        CLINIC_ART,
        ...OUTPOST_FACTIONS.map((f) => outpostArt(f.teamId)),
        FIRESTATION_ART,
        LIBRARY_ART,
        RADIO_ART,
        ARSENAL_ART,
        ...BLOCKHOUSE_FACTIONS.map((f) => blockhouseArt(f.teamId)),
        ...militaryBaseArt(),
    ];
}

/** The rebirth buildings and the medical loot spawner; `generated` checks that every wall type exists. */
export function rebirthBuildings(generated: Readonly<Record<string, MapObjectDef>>): Record<string, MapObjectDef> {
    const known = (id: string) => Object.hasOwn(generated, id);
    const medical: LootSpawnerDef = {
        type: "loot_spawner",
        loot: [{ tier: "tier_medical", min: 1, max: 1, props: {} }],
    };
    return {
        [MEDICAL_LOOT_SPAWNER]: medical,
        clinic_01: clinic(known),
        ...Object.fromEntries(OUTPOST_FACTIONS.map((f) => [f.id, outpost(f, known)])),
        // the second wave (the owner, 2026-10-08: "more buildings, the maps get bigger"), after every earlier id
        firestation_01: firestation(known),
        library_01: library(known),
        radio_station_01: radioStation(known),
        arsenal_01: arsenal(known),
        ...Object.fromEntries(BLOCKHOUSE_FACTIONS.map((f) => [f.id, blockhouse(f, known)])),
        // the military bases (the owner, 2026-10-08), after every earlier id
        ...militaryBaseDefs(known),
    };
}

/** Where the rebirth buildings spawn: map -> fixedSpawns entries added (rebirth/index.ts applyRebirthMaps). */
export const REBIRTH_BUILDING_SPAWNS: Readonly<Record<string, Readonly<Record<string, number>>>> = {
    main: { clinic_01: 1, firestation_01: 1, library_01: 1, radio_station_01: 1, military_base_01: 1 },
    faction: {
        outpost_01r: 1,
        outpost_01b: 1,
        arsenal_01: 1,
        blockhouse_01r: 2,
        blockhouse_01b: 2,
        military_base_01r: 1,
        military_base_01b: 1,
    },
};

/**
 * Scheduled unlocks of rebirth buildings per map (MapDef gameConfig.unlocks.timings; sim match/unlocks.ts opens the
 * locked doors of the first building of the type, so each of these spawns exactly once).
 */
export const REBIRTH_BUILDING_UNLOCKS: Readonly<
    Record<string, ReadonlyArray<{ type: string; stagger: number; circleIdx: number; wait: number }>>
> = {
    faction: [ARSENAL_UNLOCK],
};

/**
 * The maps with the rebirth buildings in their fixed spawns and their scheduled unlocks in gameConfig (copies; a type
 * already listed throws).
 */
export function applyRebirthBuildingSpawns(maps: Readonly<Record<string, MapDef>>): Record<string, MapDef> {
    const out: Record<string, MapDef> = { ...maps };
    for (const [name, spawns] of Object.entries(REBIRTH_BUILDING_SPAWNS)) {
        const def = maps[name];
        if (!def) throw new Error(`rebirth buildings: no map "${name}"`);
        const [fixed = {}, ...rest] = def.mapGen.fixedSpawns;
        for (const type of Object.keys(spawns))
            if (Object.hasOwn(fixed, type)) throw new Error(`rebirth buildings: ${name} already spawns ${type}`);
        out[name] = { ...def, mapGen: { ...def.mapGen, fixedSpawns: [{ ...fixed, ...spawns }, ...rest] } };
    }
    for (const [name, timings] of Object.entries(REBIRTH_BUILDING_UNLOCKS)) {
        const def = out[name];
        if (!def) throw new Error(`rebirth buildings: no map "${name}"`);
        const have = def.gameConfig.unlocks?.timings ?? [];
        for (const t of timings) {
            if (have.some((h) => h.type === t.type))
                throw new Error(`rebirth buildings: ${name} already unlocks ${t.type}`);
            if (REBIRTH_BUILDING_SPAWNS[name]?.[t.type] !== 1) {
                throw new Error(`rebirth buildings: ${t.type} unlocks on ${name}, so it must spawn exactly once there`);
            }
        }
        out[name] = {
            ...def,
            gameConfig: { ...def.gameConfig, unlocks: { ...def.gameConfig.unlocks, timings: [...have, ...timings] } },
        };
    }
    return out;
}
