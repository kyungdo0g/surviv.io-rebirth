// Where the new guns spawn (docs/design/new-gun-stats.md section 5 and new-gun-stats.json `loot`, which give main's
// rows; the other maps get the same rows under each map's rules, plan docs/design/survev-content-and-new-guns.md 4.1 /
// 5.8). One hook places them around the air drop tier derivation (rebirth/airdropLoot.ts), per map:
// 1. floor rows into the map's tier_guns / tier_shotguns, tier 2 rows into its tier_airdrop_uncommon (so they land in
//    tier 2 and in tier 1's 10 % tier 2 roll);
// 2. applyAirdropTierTables (unchanged);
// 3. tier 1 rows appended to tier_airdrop_tier1, and its tier 2 roll weighed again so it stays 10 % (main: 2.306667);
// 4. gold rows into the gold drop (tier_airdrop_rare), and 5.7x28 into the ammo crates where the P90 spawns.
// Map rules: the map's loot bans (gunClasses.ts LOOT_BANS: Savannah); a gun needs its class among the map's ground guns
// (Woods: shotguns and LMGs; Potato: pistols, SMGs, shotguns), launchers excepted in air drops ("from airdrops on every
// map"); on the floor also its ammo (Desert has no 9mm; the P90's 5.7x28 counts as 9mm) and launchers only on main, its
// seasonal copies and Desert. Maps without a table get no row: 50v50, Potato vs Tomato and Cobalt have no tier 1 table
// (their normal drop, tier_airdrop_uncommon, gets the tier 2 rows); potato's gold drop is its potato guns.
import { gunClass, LOOT_BANS } from "../gunClasses.ts";
import type { LootTableEntry, MapDef } from "../types/index.ts";
import { AIRDROP_TIER1_TABLE, AIRDROP_TIER2_TABLE, applyAirdropTierTables, TIER1_TIER2_SHARE } from "./airdropLoot.ts";
import { GOLD_DROP_TABLE } from "./survevGuns.ts";

/** Floor (main tier_guns) weights. */
export const NEW_GUN_FLOOR: Readonly<Record<string, number>> = {
    ak74: 1.5,
    g36c: 1.2,
    m16a4: 0.7,
    sig550: 0.1,
    g3: 0.2,
    honeybadger: 0.02,
    fal: 0.1,
    tec9: 3,
    vz61: 2,
    bizon: 3,
    asval: 0.05,
    p90: 0.02,
    m79: 0.02,
    gl06: 0.02,
    panzerfaust: 0.02,
    m60: 0.02,
    mg42: 0.005,
};
/** tier_shotguns weights. */
export const NEW_GUN_SHOTGUN_FLOOR: Readonly<Record<string, number>> = { dp12: 0.05 };
/** Floor rows of the Desert only (classic and 50v50 maps carry no .45 ACP). */
export const NEW_GUN_DESERT_FLOOR: Readonly<Record<string, number>> = { m1928: 0.5 };
export const DESERT_FLOOR_MAPS: readonly string[] = ["desert"];
/** tier_airdrop_tier1 weights, appended after the derivation. */
export const NEW_GUN_TIER1: Readonly<Record<string, number>> = {
    m16a4: 1,
    sig550: 1,
    g3: 1,
    fal: 1,
    m1928: 1,
    asval: 1.5,
    m79: 0.5,
    gl06: 0.5,
    panzerfaust: 0.5,
};
/** tier_airdrop_uncommon weights (tier 2), appended before the derivation. */
export const NEW_GUN_TIER2: Readonly<Record<string, number>> = {
    honeybadger: 0.75,
    mk14: 0.75,
    wa2000: 0.5,
    p90: 1.5,
    dp12: 1,
    m79: 1,
    m202: 0.2,
    m200: 0.25,
    boys: 0.75,
    m60: 1,
    mg42: 0.75,
};
/** survev's SPAS-16 takes the dropped SPAS-15's tier 2 slot on main, its seasonal copies and Desert (sheet 5). */
export const SPAS16_TIER2_WEIGHT = 1;
export const SPAS16_TIER2_MAPS: readonly string[] = ["main", "main_spring", "main_summer", "snow", "desert"];
/** Gold drop (tier_airdrop_rare) weights. */
export const NEW_GUN_GOLD: Readonly<Record<string, number>> = {
    aa12: 0.5,
    mgl: 0.5,
    rpg7: 0.5,
    m202: 0.25,
    m200: 0.5,
    hecate: 0.5,
    lynx: 0.5,
    dshk: 0.08,
};
/** Maps whose floor holds launchers ("on the floor only on main and desert"; main with its seasonal copies). */
export const FLOOR_LAUNCHER_MAPS: readonly string[] = ["main", "main_spring", "main_summer", "snow", "desert"];
/** Maps whose gold drop gets no new gun, with the reason. */
export const NEW_GUN_GOLD_SKIPPED: Readonly<Record<string, string>> = {
    potato: "its gold drop is the potato guns",
    potato_spring: "its gold drop is the potato guns",
};
/** The P90's ammo in the ammo crates of every map where the P90 spawns (sheet 4.5: weight 0.5, 50 rounds). */
export const NEW_AMMO_CRATE = { table: "tier_ammo_crate", item: "57mm", gun: "p90", weight: 0.5, count: 50 } as const;

/** Ammo the floor rule reads in its place: the P90 goes where the 9mm guns go (it is "not on the Desert floor"). */
const FLOOR_AMMO_ALIAS: Readonly<Record<string, string>> = { "57mm": "9mm" };

type Tables = Record<string, LootTableEntry[]>;
/** Tables only read. */
type ReadTables = Readonly<Record<string, readonly LootTableEntry[]>>;
/** Ammo id of a gun id (undefined for anything else). */
export type AmmoOf = (gun: string) => string | undefined;

/** What a map allows, read from its generated tables. */
export interface MapRules {
    name: string;
    banned: ReadonlySet<string>;
    groundClasses: ReadonlySet<string>;
    groundAmmo: ReadonlySet<string>;
}

/** Item names reachable from `tier` (nested tier_* tables followed). */
function reachable(tables: ReadTables, tier: string, out = new Set<string>()): Set<string> {
    for (const e of tables[tier] ?? []) {
        if (!e.name || out.has(e.name)) continue;
        out.add(e.name);
        if (e.name.startsWith("tier_")) reachable(tables, e.name, out);
    }
    return out;
}

/** A map's rules, read from its generated tables (before any row is added). */
export function newGunMapRules(name: string, tables: ReadTables, ammoOf: AmmoOf): MapRules {
    const ground = [...reachable(tables, "tier_guns")].filter((g) => gunClass(g) !== undefined);
    return {
        name,
        banned: new Set(LOOT_BANS[name] ?? []),
        groundClasses: new Set(ground.map((g) => gunClass(g) as string)),
        groundAmmo: new Set(ground.map((g) => ammoOf(g) ?? "")),
    };
}

/** Whether `gun` may lie on the map's floor. */
export function floorAllowed(rules: MapRules, gun: string, ammoOf: AmmoOf): boolean {
    if (rules.banned.has(gun)) return false;
    const cls = gunClass(gun);
    if (cls === "launcher") return FLOOR_LAUNCHER_MAPS.includes(rules.name);
    if (!cls || !rules.groundClasses.has(cls)) return false;
    const ammo = ammoOf(gun) ?? "";
    return rules.groundAmmo.has(FLOOR_AMMO_ALIAS[ammo] ?? ammo);
}

/** Whether `gun` may come out of the map's air drops. */
export function airdropAllowed(rules: MapRules, gun: string): boolean {
    if (rules.banned.has(gun)) return false;
    const cls = gunClass(gun);
    return cls === "launcher" || (cls !== undefined && rules.groundClasses.has(cls));
}

const rows = (weights: Readonly<Record<string, number>>, keep: (gun: string) => boolean): LootTableEntry[] =>
    Object.entries(weights)
        .filter(([gun]) => keep(gun))
        .map(([name, weight]) => ({ name, count: 1, weight }));

/** Rounded to 1e-6 (weights are shown in docs and tests). */
const round6 = (v: number): number => Math.round(v * 1e6) / 1e6;

/** Step 1: floor and tier 2 rows. */
function withFloorAndTier2(name: string, def: MapDef, rules: MapRules, ammoOf: AmmoOf): MapDef {
    const tables: Tables = { ...def.lootTable };
    const append = (table: string, extra: LootTableEntry[]) => {
        if (tables[table] && extra.length > 0) tables[table] = [...tables[table], ...extra];
    };
    const floor = { ...NEW_GUN_FLOOR, ...(DESERT_FLOOR_MAPS.includes(name) ? NEW_GUN_DESERT_FLOOR : {}) };
    append(
        "tier_guns",
        rows(floor, (g) => floorAllowed(rules, g, ammoOf)),
    );
    append(
        "tier_shotguns",
        rows(NEW_GUN_SHOTGUN_FLOOR, (g) => floorAllowed(rules, g, ammoOf)),
    );
    const uncommon = tables.tier_airdrop_uncommon ?? [];
    const tier2 = rows(NEW_GUN_TIER2, (g) => airdropAllowed(rules, g));
    const spas16 = SPAS16_TIER2_MAPS.includes(name) && !uncommon.some((e) => e.name === "spas16");
    if (spas16 && airdropAllowed(rules, "spas16"))
        tier2.push({ name: "spas16", count: 1, weight: SPAS16_TIER2_WEIGHT });
    append("tier_airdrop_uncommon", tier2);
    return { ...def, lootTable: tables };
}

/** Steps 3 and 4: tier 1 rows (with the tier 2 roll weighed again), gold rows and the P90's ammo. */
function withTier1AndGold(name: string, def: MapDef, rules: MapRules): MapDef {
    const tables: Tables = { ...def.lootTable };
    const tier1 = tables[AIRDROP_TIER1_TABLE];
    if (tier1) {
        const core = [
            ...tier1.filter((e) => e.name !== AIRDROP_TIER2_TABLE),
            ...rows(NEW_GUN_TIER1, (g) => airdropAllowed(rules, g)),
        ];
        const roll = tier1.find((e) => e.name === AIRDROP_TIER2_TABLE);
        const coreWeight = core.reduce((s, e) => s + e.weight, 0);
        const weight = round6((coreWeight * TIER1_TIER2_SHARE) / (1 - TIER1_TIER2_SHARE));
        tables[AIRDROP_TIER1_TABLE] = roll ? [...core, { ...roll, weight }] : core;
    }
    const gold = tables[GOLD_DROP_TABLE];
    if (gold && !Object.hasOwn(NEW_GUN_GOLD_SKIPPED, name)) {
        tables[GOLD_DROP_TABLE] = [...gold, ...rows(NEW_GUN_GOLD, (g) => airdropAllowed(rules, g))];
    }
    const crate = tables[NEW_AMMO_CRATE.table];
    const hasGun = Object.values(tables).some((t) => t.some((e) => e.name === NEW_AMMO_CRATE.gun));
    if (crate && hasGun) {
        const { item: entryName, count, weight } = NEW_AMMO_CRATE;
        tables[NEW_AMMO_CRATE.table] = [...crate, { name: entryName, count, weight }];
    }
    return { ...def, lootTable: tables };
}

/**
 * The maps with the new guns' rows and the air drop tier tables (applyAirdropTierTables runs inside, between steps 1
 * and 3). The input is not mutated.
 */
export function applyNewGunLoot(maps: Readonly<Record<string, MapDef>>, ammoOf: AmmoOf): Record<string, MapDef> {
    const rules = new Map<string, MapRules>();
    const before: Record<string, MapDef> = {};
    for (const [name, def] of Object.entries(maps)) {
        rules.set(name, newGunMapRules(name, def.lootTable, ammoOf));
        before[name] = withFloorAndTier2(name, def, rules.get(name) as MapRules, ammoOf);
    }
    const tiered = applyAirdropTierTables(before);
    const out: Record<string, MapDef> = {};
    for (const [name, def] of Object.entries(tiered))
        out[name] = withTier1AndGold(name, def, rules.get(name) as MapRules);
    return out;
}
