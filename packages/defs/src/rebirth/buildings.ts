// Rebirth buildings (the owner, 2026-10-08: "make a building yourself, one for the normal map and one only for
// 50v50", then "more of them, the maps get bigger"; docs/research/rebirth-deviations.md). Each is built like the
// original houses: invisible wall obstacles, original doors, windows and furniture, and a floor and roof image of its
// own. Those images are rebirth art (apps/client/public/rebirth/map/*.svg, drawn from the layouts by
// tools/assets/rebirthBuildingArt.ts, so the walls drawn on the floor are the walls that collide). One file per
// building in rebirth/buildings/; this module lists them, their art and where they spawn.
import type { LootSpawnerDef, MapDef, MapObjectDef } from "../types/index.ts";
import { CLINIC_ART, clinic, MEDICAL_LOOT_SPAWNER } from "./buildings/clinic.ts";
import type { RebirthBuildingArt } from "./buildings/layout.ts";
import { OUTPOST_FACTIONS, outpost, outpostArt } from "./buildings/outpost.ts";

export * from "./buildings/clinic.ts";
export * from "./buildings/layout.ts";
export * from "./buildings/outpost.ts";

/** Buildings whose heal regions the client draws (apps/client objects/healRegionFx.ts: glow, crosses, ring pulse). */
export const REBIRTH_HEAL_FX_BUILDINGS: ReadonlySet<string> = new Set(["clinic_01"]);

/** Sprite ids of every rebirth building image, with their size (the client's sprite manifest entries). */
export function rebirthBuildingArt(): RebirthBuildingArt[] {
    return [CLINIC_ART, ...OUTPOST_FACTIONS.map((f) => outpostArt(f.teamId))];
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
    };
}

/** Where the rebirth buildings spawn: map -> fixedSpawns entries added (rebirth/index.ts applyRebirthMaps). */
export const REBIRTH_BUILDING_SPAWNS: Readonly<Record<string, Readonly<Record<string, number>>>> = {
    main: { clinic_01: 1 },
    faction: { outpost_01r: 1, outpost_01b: 1 },
};

/** The maps with the rebirth buildings in their fixed spawns (copies; a type already listed throws). */
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
    return out;
}
