// Event-map corrections applied by the port (moved from packages/sim/src/modes/mapFixes.ts, M7b). The balance revert
// compares survev against its pre-fork snapshot ae55c9a8, which is not the original for every map: Savannah was still
// a recoloured copy of Main there, Turkey lacked its squashes, and a few seasonal variants carried fork additions. Each
// correction below cites the KB page / conflict it follows.
//
// - savannah: survev's first Savannah reconstruction instead of the Main copy the balance revert produced
//   (savannahDef.ts), and the Savannah weapon bans on every loot table.
// - turkey: the 2019 "Fowl Play" map is the normal island plus green squashes (Perky Shoot) and the turkey gold drop
//   (turkey.md CONFLICT turkey-map-look / turkey-gold-airdrop).
// - desert: no fork Oasis lake (desert.md "Size and terrain": fork 2026-06), no alternate barn (CONFLICT
//   desert-alt-barn: removed in 0.8.5), PKP back to weight 3 in rare air drops (CONFLICT desert-pkp-airdrop-rare).
// - snow: one hardstone block (CONFLICT snow-hardstone-count).
// - main_spring / main_summer: two warehouses, no fork alternate warehouse (CONFLICT main-warehouses).
// - woods_snow / woods_spring / woods_summer / potato_spring: without fork ids and additions (cache_07w, workshop,
//   logging_complex_03x, stone_04x, eggs); woods_snow regains its red houses, woods_summer the autumn logging complex.

import type { LootTableEntry, MapDef, SpawnCount } from "../../../packages/defs/src/types/index.ts";
import { gunsOfClass } from "../../../packages/sim/src/modes/gunClasses.ts";
import { SAVANNAH_LOOT, SAVANNAH_MAPGEN } from "./savannahDef.ts";

type MapGen = MapDef["mapGen"];
type RiverConfig = MapGen["map"]["rivers"];

export interface MapDefFix {
    /** KB citation of the correction */
    reason: string;
    /** loot tables replaced whole */
    lootTable?: Readonly<Record<string, LootTableEntry[]>>;
    /** single loot entries: [tier, item, weight]; a new item is appended, weight null removes it */
    lootWeights?: ReadonlyArray<[string, string, number | null]>;
    /** mapGen keys replaced whole */
    mapGen?: Partial<
        Pick<
            MapGen,
            | "fixedSpawns"
            | "densitySpawns"
            | "randomSpawns"
            | "spawnReplacements"
            | "customSpawnRules"
            | "importantSpawns"
        >
    >;
    /** river config keys replaced whole */
    rivers?: Partial<RiverConfig>;
    /** fixed spawn counts set (null removes the spawn) */
    fixedSpawns?: Readonly<Record<string, SpawnCount | null>>;
    /** density spawn values set (null removes the spawn) */
    densitySpawns?: Readonly<Record<string, number | null>>;
    /** air drop crate weights replaced whole */
    planeCrates?: MapDef["gameConfig"]["planes"]["crates"];
}

const { rivers: savannahRivers, ...savannahMapGen } = SAVANNAH_MAPGEN;

export const MAP_FIXES: Readonly<Record<string, readonly MapDefFix[]>> = {
    savannah: [
        {
            reason: "savannah.md: survev's pre-fork Savannah reconstruction (the port reverted it to Main's spawns/loot)",
            mapGen: savannahMapGen,
            rivers: savannahRivers,
            lootTable: SAVANNAH_LOOT,
        },
    ],
    turkey: [
        {
            reason: "turkey.md CONFLICT turkey-map-look: 2019 = main + turkeyMode + green squashes (survev count 25)",
            densitySpawns: { squash_01: 25 },
        },
        {
            reason: "turkey.md CONFLICT turkey-gold-airdrop: airdrop_crate_02tr as the 1-in-11 gold crate",
            planeCrates: [
                { name: "airdrop_crate_01", weight: 10 },
                { name: "airdrop_crate_02tr", weight: 1 },
            ],
        },
    ],
    desert: [
        { reason: "desert.md: the Oasis lake is a fork addition (2026-06)", rivers: { lakes: [] } },
        { reason: "desert.md CONFLICT desert-alt-barn: removed from desert in 0.8.5", fixedSpawns: { barn_02d: null } },
        {
            reason: "desert.md CONFLICT desert-pkp-airdrop-rare: PKP 3 (0.7.51 'greatly increased')",
            lootWeights: [["tier_airdrop_rare", "pkp", 3]],
        },
    ],
    snow: [{ reason: "snow.md CONFLICT snow-hardstone-count: one stone_04", fixedSpawns: { stone_04x: null } }],
    main_spring: [{ reason: "main.md CONFLICT main-warehouses", fixedSpawns: { warehouse_01: 2, warehouse_03: null } }],
    main_summer: [{ reason: "main.md CONFLICT main-warehouses", fixedSpawns: { warehouse_01: 2, warehouse_03: null } }],
    woods_snow: [
        {
            reason:
                "woods.md Woods Snow: as woods with snow skins by replacement (3 logging_complex_03, 6 stone_04, red " +
                "houses); cache_01w, cache_07w, logging_complex_03x and stone_04x are fork ids / additions",
            fixedSpawns: {
                cache_01w: null,
                cache_07w: null,
                logging_complex_03x: null,
                stone_04x: null,
                house_red_01: 3,
            },
        },
    ],
    woods_spring: [
        {
            reason: "woods.md Woods Spring: cache_07w and the workshop are fork 0.2.2 additions, cache_01w a fork id",
            fixedSpawns: { cache_01w: null, cache_07w: null, workshop_complex_01: null },
        },
    ],
    woods_summer: [
        {
            reason:
                "woods.md Woods Summer: the pre-fork map was a recolour of autumn woods (autumn logging complex at the " +
                "centre); cache_07w and the workshop are fork 0.2.2 additions, cache_01w a fork id",
            fixedSpawns: { cache_01w: null, cache_07w: null, workshop_complex_01: null },
            mapGen: {
                customSpawnRules: {
                    locationSpawns: [
                        { type: "logging_complex_01", pos: { x: 0.5, y: 0.5 }, rad: 200, retryOnFailure: true },
                    ],
                    placeSpawns: [],
                },
            },
        },
    ],
    potato_spring: [
        {
            reason: "potato.md Potato Spring: the eggs are a fork addition (2025-04-01)",
            densitySpawns: { egg_01: null, egg_02: null, egg_03: null, egg_04: null },
        },
    ],
};

/**
 * Items that never spawn on a map: removed from every loot table of its def (a table left empty drops nothing).
 * Savannah: no shotguns, no assault rifles but the SCAR-H, no LMGs, no high-quality SMGs but the CZ-3A1, no 2x scopes
 * (savannah.md "Rules", fandom Savannah_Map).
 */
export const LOOT_BANS: Readonly<Record<string, readonly string[]>> = {
    savannah: [
        ...gunsOfClass("shotgun"),
        ...gunsOfClass("lmg"),
        ...gunsOfClass("assault").filter((g) => g !== "scar"),
        "vector",
        "vector45",
        "2xscope",
    ],
};

function setEntries<T>(target: Record<string, T>, edits: Readonly<Record<string, T | null>>): void {
    for (const [key, value] of Object.entries(edits)) {
        if (value === null) delete target[key];
        else target[key] = value;
    }
}

function setWeight(table: LootTableEntry[], item: string, weight: number | null): void {
    const i = table.findIndex((x) => x.name === item);
    if (weight === null) {
        if (i >= 0) table.splice(i, 1);
    } else if (i >= 0) {
        table[i].weight = weight;
    } else {
        table.push({ name: item, count: 1, weight });
    }
}

function applyFix(def: MapDef, fix: MapDefFix): void {
    if (fix.lootTable) for (const [tier, entries] of Object.entries(fix.lootTable)) def.lootTable[tier] = entries;
    for (const [tier, item, weight] of fix.lootWeights ?? []) {
        def.lootTable[tier] ??= [];
        setWeight(def.lootTable[tier], item, weight);
    }
    if (fix.mapGen) Object.assign(def.mapGen, fix.mapGen);
    if (fix.rivers) Object.assign(def.mapGen.map.rivers, fix.rivers);
    if (fix.fixedSpawns) setEntries((def.mapGen.fixedSpawns[0] ??= {}), fix.fixedSpawns);
    if (fix.densitySpawns) setEntries((def.mapGen.densitySpawns[0] ??= {}), fix.densitySpawns);
    if (fix.planeCrates) def.gameConfig.planes.crates = fix.planeCrates;
}

function applyBans(def: MapDef, banned: readonly string[]): void {
    const set = new Set(banned);
    for (const tier of Object.keys(def.lootTable)) {
        const kept = def.lootTable[tier].filter((x) => !set.has(x.name));
        def.lootTable[tier] = kept.length > 0 ? kept : [{ name: "", count: 1, weight: 1 }];
    }
}

export interface EventMapFixLog {
    map: string;
    reason: string;
}

/**
 * Applies MAP_FIXES and LOOT_BANS to the ported map defs in place (after the balance revert and the reskin revert,
 * before loot cleanup) and returns what was applied, for provenance.
 */
export function applyEventMapFixes(maps: Record<string, MapDef>): EventMapFixLog[] {
    const log: EventMapFixLog[] = [];
    for (const [name, fixes] of Object.entries(MAP_FIXES)) {
        const def = maps[name];
        if (!def) continue;
        for (const fix of fixes) {
            applyFix(def, fix);
            log.push({ map: name, reason: fix.reason });
        }
    }
    for (const [name, banned] of Object.entries(LOOT_BANS)) {
        const def = maps[name];
        if (!def) continue;
        applyBans(def, banned);
        log.push({ map: name, reason: `loot bans: ${banned.join(", ")}` });
    }
    return log;
}
