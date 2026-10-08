// Per-map generation and loot invariants of the event maps (M7b). The validation test files run every case of
// MAP_CASES for VALIDATION_SEEDS seeds per team mode and collect the hard issues (exceptions, missing unique spawns,
// forbidden spawns, failed fixed spawns) and the soft placement warnings (river-dependent spawns that survev also
// gives up on: river cabins beside 16-wide rivers, bridge shacks on narrow rivers, a seventh Cobalt river).
import {
    type GameObjectDef,
    GameObjectDefs,
    getMapDef,
    getMapObjectDef,
    gunClass,
    hasDef,
    hasMapObjectDef,
    LOOT_BANS,
    type LootTableEntry,
} from "@rebirth/defs";
import { type GenerateMapResult, generateMap } from "../src/index.ts";

/** Seeds per map and team mode (MAPGEN_SEEDS overrides it for quick local runs). */
export const VALIDATION_SEEDS = Number(process.env.MAPGEN_SEEDS ?? 100);

export interface MapCase {
    map: string;
    /** team modes that select a distinct map scale (squads get the large island) */
    teamModes: ReadonlyArray<1 | 2 | 4>;
    /** top-level types that must spawn at least this many times */
    required: Readonly<Record<string, number>>;
    /** types that must exist somewhere (building children included) */
    requiredAnywhere?: readonly string[];
    /** top-level types that must never spawn */
    forbidden?: readonly string[];
    /** fixed spawns allowed to come up short (river-dependent placements) */
    softFixed?: readonly string[];
    /** average placement warnings per generated map allowed */
    maxWarnings: number;
    custom?: (g: GenerateMapResult) => string[];
}

/** Bridge-placed and riverside buildings: survev also fails them on some river layouts (generation.md). */
const RIVER_SOFT = ["shack_03a", "bunker_structure_05"];
const ROTATION = ["mansion_structure_01", "police_01", "bank_01"];

function countTop(g: GenerateMapResult): Map<string, number> {
    const counts = new Map<string, number>();
    for (const o of g.objects) if (o.parentId === 0) counts.set(o.type, (counts.get(o.type) ?? 0) + 1);
    for (const l of g.lootSpawns) if (l.parentId === 0) counts.set(l.type, (counts.get(l.type) ?? 0) + 1);
    return counts;
}

function chooseTwo(g: GenerateMapResult): string[] {
    const counts = countTop(g);
    const n = ROTATION.filter((t) => counts.has(t)).length;
    return n === 2 ? [] : [`random rotation spawned ${n} of mansion / police / bank (expected 2)`];
}

/** Every lake has one of the centre objects exactly at the lake centre (`types` lists every lake's, any order). */
function lakeCentres(type: string | readonly string[], lakes: number) {
    const types = typeof type === "string" ? Array.from({ length: lakes }, () => type) : type;
    return (g: GenerateMapResult): string[] => {
        const centres = g.terrain.rivers.filter((r) => r.looped).map((r) => r.center);
        const objs = g.objects.filter((o) => types.includes(o.type) && o.parentId === 0);
        const out: string[] = [];
        if (centres.length !== lakes) out.push(`${centres.length} lakes (expected ${lakes})`);
        const found: string[] = [];
        for (const c of centres) {
            const o = objs.find((x) => Math.abs(x.pos.x - c.x) < 1e-6 && Math.abs(x.pos.y - c.y) < 1e-6);
            if (o) found.push(o.type);
            else out.push(`lake at ${c.x.toFixed(1)},${c.y.toFixed(1)} has no ${[...new Set(types)].join(" / ")}`);
        }
        if (found.length === lakes && [...found].sort().join() !== [...types].sort().join()) {
            out.push(`lake centres ${found.join(", ")} (expected ${types.join(", ")})`);
        }
        return out;
    };
}

export const MAP_CASES: readonly MapCase[] = [
    {
        map: "main",
        teamModes: [1, 4],
        // clinic_01: the rebirth building of the normal map (rebirth/buildings.ts)
        required: {
            club_complex_01: 1,
            greenhouse_01: 1,
            bunker_structure_02: 1,
            warehouse_complex_01: 1,
            hut_03: 1,
            clinic_01: 1,
        },
        softFixed: RIVER_SOFT,
        maxWarnings: 1.5,
        custom: chooseTwo,
    },
    {
        map: "main_spring",
        teamModes: [1, 4],
        // survev map generation (survev content wave stage 3): one warehouse is the Alternate Warehouse
        required: { club_complex_01: 1, greenhouse_01: 1, teahouse_01: 2, warehouse_01: 1, warehouse_03: 1 },
        softFixed: RIVER_SOFT,
        maxWarnings: 1.5,
        custom: chooseTwo,
    },
    {
        map: "main_summer",
        teamModes: [1, 4],
        required: { club_complex_01: 1, teahouse_complex_01su: 1, warehouse_01: 1, warehouse_03: 1 },
        softFixed: RIVER_SOFT,
        maxWarnings: 1.5,
        custom: chooseTwo,
    },
    {
        map: "desert",
        teamModes: [1, 4],
        // survev map generation: the Reserve replaces the small town's bank, the Oasis lake, the alternate barn
        required: {
            desert_town_01: 1,
            desert_town_02: 1,
            river_town_02: 1,
            greenhouse_02: 1,
            stone_05: 6,
            oasis_01: 1,
            barn_02d: 1,
            warehouse_03: 1,
        },
        requiredAnywhere: ["saloon_structure_01", "saloon_01", "police_01", "reserve_structure_01", "reserve_vault_01"],
        forbidden: ["club_complex_01", "warehouse_complex_01"],
        maxWarnings: 0.5,
        custom: lakeCentres("oasis_01", 1),
    },
    {
        map: "woods",
        teamModes: [1, 4],
        required: {
            logging_complex_01: 1,
            logging_complex_02: 1,
            logging_complex_03: 3,
            teapavilion_01w: 1,
            bunker_structure_07: 1,
            cache_03: 48,
        },
        requiredAnywhere: ["loot_tier_helmet_forest", "bunker_structure_06", "workshop_01", "gun_mount_07"],
        forbidden: ["club_complex_01"],
        maxWarnings: 0.5,
        custom: lakeCentres("teapavilion_01w", 1),
    },
    {
        map: "woods_snow",
        teamModes: [1, 4],
        required: {
            logging_complex_01: 1,
            logging_complex_03x: 2,
            teapavilion_01w: 1,
            bunker_structure_07: 1,
            workshop_complex_01w: 1,
            camp_01w: 2,
        },
        requiredAnywhere: ["loot_tier_helmet_forest", "campfire_01"],
        maxWarnings: 0.5,
        custom: lakeCentres("teapavilion_01w", 1),
    },
    {
        map: "woods_spring",
        teamModes: [1, 4],
        required: {
            logging_complex_01sp: 1,
            logging_complex_02sp: 1,
            teapavilion_01w: 1,
            bunker_structure_07: 1,
            workshop_complex_01: 1,
        },
        maxWarnings: 0.5,
        custom: lakeCentres("teapavilion_01w", 1),
    },
    {
        map: "woods_summer",
        teamModes: [1, 4],
        // survev map generation: the summer logging complex at the centre
        required: { logging_complex_01su: 1, teapavilion_01w: 1, bunker_structure_07: 1, workshop_complex_01: 1 },
        forbidden: ["logging_complex_01"],
        maxWarnings: 0.5,
        custom: (g) => {
            const n = countTop(g).get("logging_complex_01su") ?? 0;
            return [...(n === 1 ? [] : [`${n} logging_complex_01su`]), ...lakeCentres("teapavilion_01w", 1)(g)];
        },
    },
    {
        map: "snow",
        teamModes: [1, 4],
        // survev map generation: camps, three iced hardstones, the snow alternate warehouse
        required: { club_complex_01: 1, greenhouse_02: 1, tree_10: 100, crate_03x: 1, camp_01: 2, warehouse_03x: 1 },
        forbidden: ["tree_01", "greenhouse_01"],
        // survev's snow shack_03x stands at a bridge like shack_03a (survev modeBuildingDefs.ts:8800-8806)
        softFixed: [...RIVER_SOFT, "shack_03x"],
        maxWarnings: 1.5,
    },
    {
        map: "halloween",
        teamModes: [1, 4],
        required: {
            junkyard_01: 1,
            mansion_structure_02: 1,
            bunker_structure_07: 1,
            cache_pumpkin_01: 10,
            cache_pumpkin_03: 10,
            woodpile_01: 24,
        },
        forbidden: ["club_complex_01", "mansion_structure_01"],
        maxWarnings: 0.5,
    },
    {
        map: "potato",
        teamModes: [1, 4],
        required: { shilo_01: 1, club_complex_01: 1, potato_01: 20, potato_02: 20, potato_03: 20 },
        softFixed: RIVER_SOFT,
        maxWarnings: 1.5,
        custom: chooseTwo,
    },
    {
        map: "potato_spring",
        teamModes: [1, 4],
        required: { shilo_01: 1, potato_01: 20, potato_02: 20, potato_03: 20, egg_01: 1 },
        softFixed: RIVER_SOFT,
        maxWarnings: 1.5,
    },
    {
        map: "savannah",
        teamModes: [1, 4],
        required: {
            grassy_cover_01: 8,
            grassy_cover_02: 8,
            grassy_cover_03: 8,
            grassy_cover_complex_01: 2,
            perch_01: 11,
            kopje_patch_01: 2,
            savannah_patch_01: 4,
            mansion_structure_01: 1,
            bunker_structure_01sv: 1,
            bunker_structure_03: 1,
            mil_crate_05: 6,
            // survev map generation: the Cloud bunker lake, the Oasis, brush clumps, the alternate warehouse
            bunker_structure_10: 1,
            oasis_01sv: 1,
            brush_clump_01: 11,
            warehouse_03sv: 1,
        },
        requiredAnywhere: ["bunker_cloud_sublevel_01"],
        forbidden: [
            "club_complex_01",
            "warehouse_complex_01",
            "greenhouse_01",
            "hut_01",
            "cabin_01",
            "bank_01",
            "police_01",
        ],
        maxWarnings: 0.5,
        custom: lakeCentres(["bunker_structure_10", "oasis_01sv", "crate_02sv_lake", "crate_02sv_lake"], 4),
    },
    {
        map: "cobalt",
        teamModes: [1, 4],
        required: { bunker_structure_09: 1, class_shell_01: 40, club_complex_01: 1, cache_log_13: 1 },
        requiredAnywhere: ["bunker_twins_sublevel_01", "class_shell_03"],
        softFixed: RIVER_SOFT,
        maxWarnings: 1.5,
        custom: chooseTwo,
    },
    {
        map: "turkey",
        teamModes: [1, 4],
        required: { club_complex_01: 1, squash_01: 10 },
        softFixed: RIVER_SOFT,
        maxWarnings: 1.5,
        custom: chooseTwo,
    },
    {
        map: "faction",
        teamModes: [4],
        required: {
            river_town_01: 1,
            bank_01: 1,
            police_01: 1,
            mansion_structure_01: 1,
            warehouse_complex_01: 1,
            // the rebirth faction command posts, one per side (rebirth/buildings.ts)
            outpost_01r: 1,
            outpost_01b: 1,
        },
        softFixed: RIVER_SOFT,
        maxWarnings: 1.5,
        custom: (g) => {
            const counts = countTop(g);
            // survev's faction cache reskins (survev map generation, survev content wave stage 3)
            return ["cache_01f", "cache_02f", "cache_07f"]
                .filter((t) => counts.get(t) !== 1)
                .map((t) => `${t} x${counts.get(t) ?? 0} (expected 1)`);
        },
    },
    {
        map: "faction_potato",
        teamModes: [4],
        required: { river_town_01: 1, shilo_01: 1, bank_01: 1, police_01: 1, potato_01f: 10, tomato_01: 10 },
        softFixed: RIVER_SOFT,
        maxWarnings: 1.5,
    },
];

export interface SeedResult {
    issues: string[];
    warnings: string[];
    types: Set<string>;
}

/** Generates one map and checks the case's invariants. */
export function validateSeed(c: MapCase, seed: number, teamMode: 1 | 2 | 4): SeedResult {
    let g: GenerateMapResult;
    try {
        g = generateMap(c.map, seed, teamMode);
    } catch (err) {
        return {
            issues: [`exception: ${err instanceof Error ? err.message : String(err)}`],
            warnings: [],
            types: new Set(),
        };
    }
    const issues: string[] = [];
    const counts = countTop(g);
    for (const [type, min] of Object.entries(c.required)) {
        const n = counts.get(type) ?? 0;
        if (n < min) issues.push(`${type}: ${n} < ${min}`);
    }
    const types = new Set<string>([...g.objects.map((o) => o.type), ...g.lootSpawns.map((l) => l.type)]);
    for (const type of c.requiredAnywhere ?? []) if (!types.has(type)) issues.push(`no ${type}`);
    for (const type of c.forbidden ?? []) if (counts.has(type)) issues.push(`forbidden ${type} spawned`);
    const soft = new Set(c.softFixed ?? []);
    const located = new Map<string, number>();
    for (const s of g.spawnStats) {
        // a location spawn that failed is retried anywhere on the map (survev retryOnFailure): count both tries
        if (s.source === "location") located.set(s.type, (located.get(s.type) ?? 0) + s.spawned);
        if (s.source !== "fixed" && s.source !== "random") continue;
        if (s.spawned < s.requested && !soft.has(s.type)) {
            issues.push(`${s.source} spawn ${s.type}: ${s.spawned}/${s.requested}`);
        }
    }
    for (const [type, n] of located) if (n < 1) issues.push(`location spawn ${type} failed`);
    issues.push(...(c.custom?.(g) ?? []));
    return { issues, warnings: g.warnings, types };
}

type Tables = Readonly<Record<string, readonly LootTableEntry[]>>;

/** Items reachable from `tier` through nested tiers. */
export function reachableItems(
    tables: Tables,
    tier: string,
    out = new Set<string>(),
    seen = new Set<string>(),
): Set<string> {
    if (seen.has(tier)) return out;
    seen.add(tier);
    for (const e of tables[tier] ?? []) {
        if (!e.name) continue;
        if (e.name.startsWith("tier_")) reachableItems(tables, e.name, out, seen);
        else out.add(e.name);
    }
    return out;
}

/** Loot tiers an object can drop, following destroyType (and smartLoot class crates) and building children. */
export function tiersOfObject(
    type: string,
    classes: readonly string[],
    out = new Set<string>(),
    seen = new Set<string>(),
) {
    if (seen.has(type) || !hasMapObjectDef(type)) return out;
    seen.add(type);
    const def = getMapObjectDef(type);
    if (def.type === "obstacle" || def.type === "loot_spawner") {
        for (const l of def.loot) if (l.tier) out.add(l.tier);
    }
    if (def.type === "obstacle" && def.destroyType) {
        const next = def.smartLoot ? classes.map((r) => `${def.destroyType}_${r}`) : [def.destroyType];
        for (const t of next) tiersOfObject(t, classes, out, seen);
    }
    return out;
}

/** Static loot issues of a map: dangling entries, unknown tiers reachable from `types`, banned items. */
export function lootIssues(mapName: string, types: Iterable<string>): string[] {
    const def = getMapDef(mapName);
    const tables = def.lootTable;
    const issues: string[] = [];
    for (const [tier, entries] of Object.entries(tables)) {
        for (const e of entries) {
            if (e.name && !hasDef(e.name) && !tables[e.name]) issues.push(`${tier}: unknown item ${e.name}`);
        }
    }
    const classes = def.gameMode.perkModeRoles ?? [];
    const tiers = new Set<string>();
    const all = new Set(types);
    for (const crate of def.gameConfig.planes.crates) all.add(crate.name);
    for (const t of def.gameConfig.planes.timings) if (t.options.airdropType) all.add(t.options.airdropType);
    for (const type of all) tiersOfObject(type, classes, tiers);
    const items = new Set<string>();
    for (const tier of tiers) {
        if (!tables[tier]) issues.push(`tier ${tier} (reachable) missing from the loot table`);
        reachableItems(tables, tier, items);
    }
    for (const item of LOOT_BANS[mapName] ?? []) if (items.has(item)) issues.push(`banned ${item} can spawn`);
    for (const item of items) if (!hasDef(item)) issues.push(`reachable unknown item ${item}`);
    return issues;
}

/** Gun classes in a tier (recursively). */
export function gunClassesIn(mapName: string, tier: string): Set<string> {
    const items = reachableItems(getMapDef(mapName).lootTable, tier);
    const out = new Set<string>();
    for (const item of items) {
        const def = GameObjectDefs[item] as GameObjectDef | undefined;
        if (def?.type === "gun") out.add(gunClass(item) ?? `unclassified:${item}`);
    }
    return out;
}

/** Registers one vitest case per map and team mode of `maps` (used by the mapValidation.*.test.ts files). */
export function describeMapCases(
    maps: readonly string[],
    api: {
        describe: typeof import("vitest").describe;
        it: typeof import("vitest").it;
        expect: typeof import("vitest").expect;
    },
): void {
    const { describe, it, expect } = api;
    for (const map of maps) {
        const c = MAP_CASES.find((x) => x.map === map);
        if (!c) throw new Error(`no map case for ${map}`);
        describe(`map validation: ${map}`, () => {
            const types = new Set<string>();
            for (const teamMode of c.teamModes) {
                it(`${VALIDATION_SEEDS} seeds, team mode ${teamMode}: invariants hold and warnings stay rare`, () => {
                    const issues: string[] = [];
                    let warnings = 0;
                    for (let seed = 1; seed <= VALIDATION_SEEDS; seed++) {
                        const r = validateSeed(c, seed, teamMode);
                        for (const i of r.issues) issues.push(`seed ${seed}: ${i}`);
                        warnings += r.warnings.length;
                        for (const t of r.types) types.add(t);
                    }
                    expect(issues.slice(0, 20)).toEqual([]);
                    expect(warnings / VALIDATION_SEEDS).toBeLessThanOrEqual(c.maxWarnings);
                }, 600_000);
            }
            it("loot tables reference existing items, reachable tiers exist, banned items never spawn", () => {
                if (types.size === 0) for (const t of validateSeed(c, 1, c.teamModes[0]).types) types.add(t);
                expect(lootIssues(map, types)).toEqual([]);
            });
        });
    }
}
