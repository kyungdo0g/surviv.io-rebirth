// Loot of the rebirth air drop tiers (rebirth/airdropTiers.ts; deliberate rebirth deviation requested by the user,
// 2026-10-07). Built per map from that map's own air drop tables, so every mode keeps its flavour and its loot rules
// (savannah's bans, woods' LMGs and shotguns, potato's and desert's own guns):
// - tier_airdrop_tier2 ("SCAR-H, Vector and the like"; the user: today's normal drop is roughly tier 2) is the guns of
//   the map's tier_airdrop_uncommon without its low end and the low-tier DMRs the user named for tier 1 (MK12, M39):
//   SCAR-H, Mosin, Saiga-12, Vector, SV-98, QBB-97 and the flare gun on main. Gold (crate_11, tier_airdrop_rare) is
//   unchanged and stays above it (main, bots' tier list: mean rank 5.3 / 6.0 / 6.9 for tier 1 / 2 / gold);
// - tier_airdrop_tier1 ("if you farm well you'd get it anyway, occasionally something nice": "low-tier DMRs, the
//   SPAS-12, guns a little above the AK-47 / Groza") is the low-tier DMRs, the low end of that table (low snipers, the
//   Desert Eagle), its non-gun entries (woods' MIRV and strobe), a few ground guns a little above the AK-47 / Groza and
//   the SPAS-12 at lower weights, and a 10 % chance of a tier 2 roll;
// - tier_airdrop_armor_tier1: level 2 gear, level 3 one time in three.
// The tier 2 inner crate is crate_10 (or crate_10sv) with tier 2 guns; the tier 1 crate is a little leaner.
import { gunClass, LOOT_BANS } from "../gunClasses.ts";
import type { LootSpawnDef, LootTableEntry, MapDef, MapObjectDef, ObstacleDef } from "../types/index.ts";
import { AIRDROP_TIER_BASE_CRATES, AIRDROP_TIER_SPLITS, airdropCrateTier } from "./airdropTiers.ts";

export const AIRDROP_TIER1_TABLE = "tier_airdrop_tier1";
export const AIRDROP_TIER2_TABLE = "tier_airdrop_tier2";
export const AIRDROP_TIER1_ARMOR_TABLE = "tier_airdrop_armor_tier1";
/** today's normal drop guns, which the tier tables are built from */
const UNCOMMON = "tier_airdrop_uncommon";
const ARMOR = "tier_airdrop_armor";

/**
 * Guns of a map's tier_airdrop_uncommon that tier 1 copies with their weight: the low end of today's normal drop (the
 * bots' tier list, packages/bots/src/knowledge/gunTiers.ts: VSS, Scout Elite, Desert Eagle B; Model 94 B est.; M9 D,
 * Peacemaker C; on savannah the MK45G and L86A2, B+ est.). They move to tier 1 only.
 */
export const AIRDROP_LOW_END_GUNS: readonly string[] = [
    "vss",
    "scout_elite",
    "deagle",
    "m9",
    "model94",
    "colt45",
    "mkg45",
    "l86",
];

/**
 * Guns of a map's tier_airdrop_uncommon that move to tier 1 only (with their weight): the low-tier DMRs the user named
 * as tier 1 examples (MK12 SPR, M39 EMR).
 */
export const AIRDROP_TIER1_ONLY_GUNS: readonly string[] = ["mk12", "m39"];
/** Their weight in tier 1 against the normal drop: "occasionally something nice", not most tier 1 rolls. */
export const TIER1_ONLY_WEIGHT_FACTOR = 0.5;

/**
 * Ground guns added to tier 1 (weight): the SPAS-12 the user named (A) and guns "slightly above the AK-47 / Groza"
 * (both B on the bots' list): the FAMAS, the Groza-S and the DP-28 (A-), and the M870 (A-) that farming finds anyway.
 * Together they weigh less than the low end they join (4.25 against main's 6.01), so most tier 1 rolls are a low-end
 * gun and tier 1 stays clearly below tier 2 (test/airdropTiers.test.ts). A map gets an addition only if its ground
 * guns (tier_guns) have that class and its rules do not ban it (gunClasses.ts LOOT_BANS): woods keeps LMGs and
 * shotguns, savannah gets none of them.
 */
export const TIER1_ADDED_GUNS: Readonly<Record<string, number>> = {
    spas12: 1,
    famas: 1,
    grozas: 1,
    dp28: 0.75,
    m870: 0.5,
};

/** Share of tier 1 rolls that roll the map's tier 2 table instead ("occasionally something nice"). */
export const TIER1_TIER2_SHARE = 0.1;

/** Tier 1 armor: one of these level 2 items (weight 1 each), or the map's level 3 air drop armor at this factor. */
const TIER1_LEVEL2_ARMOR = ["helmet02", "chest02", "backpack02"] as const;
const TIER1_LEVEL3_FACTOR = 0.5;

/**
 * The tier 1 inner crate's loot list against crate_10's: tier 1 guns and armor, 1 medical roll instead of 2, 2 ammo
 * stacks instead of 3, no outfit or melee roll (the scope, throwable and savannah perk rolls stay).
 */
const TIER1_TIERS: Readonly<Record<string, string>> = {
    [UNCOMMON]: AIRDROP_TIER1_TABLE,
    [ARMOR]: AIRDROP_TIER1_ARMOR_TABLE,
};
const TIER1_COUNTS: Readonly<Record<string, number>> = { tier_medical: 1, tier_airdrop_ammo: 2 };
const TIER1_DROPPED: ReadonlySet<string> = new Set(["tier_airdrop_outfits", "tier_airdrop_melee"]);

type LootTables = Readonly<Record<string, readonly LootTableEntry[]>>;

/** Item names reachable from `tier` (nested tier_* tables followed). */
function reachableItems(
    tables: LootTables,
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

/** Rounded to 1e-6 (weights are shown in docs and tests). */
const round6 = (v: number): number => Math.round(v * 1e6) / 1e6;

/**
 * The rebirth air drop tier tables of one map, built from its tables; {} for a map without normal air drop loot.
 * Tier 2 is the normal drop's guns minus the low end and the tier 1 DMRs; its other entries (woods' MIRV and strobe in the gun roll) move to tier 1, so a
 * tier 2 crate always holds a gun and a tier 1 crate's gun roll is now and then a throwable instead.
 */
export function airdropTierTables(mapName: string, tables: LootTables): Record<string, LootTableEntry[]> {
    const uncommon = tables[UNCOMMON];
    const armor = tables[ARMOR];
    if (!uncommon || !armor) return {};
    const isGun = (e: LootTableEntry) => gunClass(e.name) !== undefined;
    const tier1Only = (e: LootTableEntry) => AIRDROP_TIER1_ONLY_GUNS.includes(e.name);
    const lowOrTier1 = (e: LootTableEntry) => tier1Only(e) || AIRDROP_LOW_END_GUNS.includes(e.name);
    const guns = uncommon.filter((e) => isGun(e) && !lowOrTier1(e)).map((e) => ({ ...e }));
    const lowEnd = uncommon
        .filter(lowOrTier1)
        .map((e) => (tier1Only(e) ? { ...e, weight: round6(e.weight * TIER1_ONLY_WEIGHT_FACTOR) } : { ...e }));
    const nonGuns = uncommon.filter((e) => !isGun(e)).map((e) => ({ ...e }));
    const banned = new Set(LOOT_BANS[mapName] ?? []);
    const groundClasses = new Set([...reachableItems(tables, "tier_guns")].map((g) => gunClass(g)));
    const present = new Set(uncommon.map((e) => e.name));
    const added = Object.entries(TIER1_ADDED_GUNS)
        .filter(([g]) => !banned.has(g) && !present.has(g) && groundClasses.has(gunClass(g)))
        .map(([name, weight]) => ({ name, count: 1, weight }));
    const core = [...lowEnd, ...nonGuns, ...added];
    const coreWeight = core.reduce((sum, e) => sum + e.weight, 0);
    const tier1: LootTableEntry[] = [...core];
    if (guns.length > 0) {
        const weight = coreWeight > 0 ? round6((coreWeight * TIER1_TIER2_SHARE) / (1 - TIER1_TIER2_SHARE)) : 1;
        tier1.push({ name: AIRDROP_TIER2_TABLE, count: 1, weight });
    }
    const armorTier1: LootTableEntry[] = [
        ...TIER1_LEVEL2_ARMOR.map((name) => ({ name, count: 1, weight: 1 })),
        ...armor.map((e) => ({ ...e, weight: round6(e.weight * TIER1_LEVEL3_FACTOR) })),
    ];
    return {
        [AIRDROP_TIER1_TABLE]: tier1,
        // a map whose normal drop holds no gun keeps all of it for tier 2
        [AIRDROP_TIER2_TABLE]: guns.length > 0 ? guns : uncommon.map((e) => ({ ...e })),
        [AIRDROP_TIER1_ARMOR_TABLE]: armorTier1,
    };
}

/** Whether a map drops a normal shell that splits into tiers (only those maps get the tier tables). */
export function hasTieredAirdrops(def: MapDef): boolean {
    return def.gameConfig.planes.crates.some((c) => Object.hasOwn(AIRDROP_TIER_SPLITS, c.name));
}

/**
 * Every map def, those with a splittable normal shell with their tier tables added to a copy of their loot table (the
 * generated defs are not mutated). 50v50, Potato vs Tomato and Cobalt drop no such shell and stay as they are.
 */
export function applyAirdropTierTables(maps: Readonly<Record<string, MapDef>>): Record<string, MapDef> {
    const out: Record<string, MapDef> = {};
    for (const [name, def] of Object.entries(maps)) {
        const extra = hasTieredAirdrops(def) ? airdropTierTables(name, def.lootTable) : {};
        for (const id of Object.keys(extra)) {
            if (Object.hasOwn(def.lootTable, id)) throw new Error(`${name}: rebirth loot table "${id}" exists`);
        }
        out[name] = Object.keys(extra).length > 0 ? { ...def, lootTable: { ...def.lootTable, ...extra } } : def;
    }
    return out;
}

/** The tier 1 loot list of a base crate's list (see TIER1_TIERS / TIER1_COUNTS / TIER1_DROPPED). */
function tier1Loot(base: readonly LootSpawnDef[]): LootSpawnDef[] {
    const out: LootSpawnDef[] = [];
    for (const l of base) {
        if (!l.tier) {
            out.push({ ...l });
            continue;
        }
        if (TIER1_DROPPED.has(l.tier)) continue;
        const count = TIER1_COUNTS[l.tier];
        const tier = TIER1_TIERS[l.tier] ?? l.tier;
        out.push(count === undefined ? { ...l, tier } : { ...l, tier, min: count, max: count });
    }
    return out;
}

/**
 * The rebirth tier inner crates (rebirth-only map objects), built from the crate the shell opened into in v0.8.82
 * (crate_10 / crate_10sv): same sprite, size, health, sounds and break effects (the client marks the tier, apps/client
 * objects/crateTierMark.ts), with the tier's loot: tier 2 swaps tier_airdrop_uncommon for tier 2 guns; tier 1 is
 * leaner (tier1Loot).
 */
export function airdropTierCrates(generated: Readonly<Record<string, MapObjectDef>>): Record<string, ObstacleDef> {
    const out: Record<string, ObstacleDef> = {};
    for (const [id, baseId] of Object.entries(AIRDROP_TIER_BASE_CRATES)) {
        const base = generated[baseId] as ObstacleDef;
        if (base?.type !== "obstacle") throw new Error(`${id}: base crate "${baseId}" is not an obstacle`);
        const tier = airdropCrateTier(id);
        const loot =
            tier === "tier1"
                ? tier1Loot(base.loot)
                : base.loot.map((l) => (l.tier === UNCOMMON ? { ...l, tier: AIRDROP_TIER2_TABLE } : { ...l }));
        out[id] = { ...base, loot };
    }
    return out;
}
