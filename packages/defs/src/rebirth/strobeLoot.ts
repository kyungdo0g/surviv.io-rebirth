// Loot of the rebirth variant strobes (rebirth/strobes.ts; deliberate addition requested by the user, 2026-10-07):
// rarer than the strobe, never floor loot, only in the rare crates (the gold air drops and the 50v50 military and gold
// military crates) of the modes whose air drops already hold strobes, so every other mode keeps its loot rules.
// The rare crates roll their throwables from their own table, RARE_THROWABLES_TABLE: each map's tier_airdrop_throwables
// plus, on those maps, the two variant strobes at a small weight. Elsewhere it is an exact copy, so the rare crates
// drop exactly what they did (same entries, weights and random draws). Normal air drops (crate_10 and the tier crates)
// keep tier_airdrop_throwables.
import type { LootSpawnDef, LootTableEntry, MapDef, MapObjectDef, ObstacleDef } from "../types/index.ts";
import { STROBE_VARIANT_TYPES } from "./strobes.ts";

export const RARE_THROWABLES_TABLE = "tier_airdrop_throwables_rare";
const THROWABLES = "tier_airdrop_throwables";

/**
 * Inner crates whose throwable rolls use RARE_THROWABLES_TABLE: the gold air drops (airdrop_crate_02 / 02x -> crate_11,
 * desert's crate_11de, savannah's crate_11sv, turkey's crate_11tr; survev crateDefs.ts:593-866) and the 50v50 military
 * crate (airdrop_crate_03 -> crate_12) and gold military crate (airdrop_crate_04 -> crate_13). The potato 50v50 crates
 * (crate_12po / crate_12dev) keep theirs: potato modes hand out throwables through their weapon swaps.
 */
export const RARE_THROWABLE_CRATES: readonly string[] = [
    "crate_11",
    "crate_11de",
    "crate_11sv",
    "crate_11tr",
    "crate_12",
    "crate_13",
];

/**
 * Chance of each variant strobe in one roll of the rare table: 5 % in the gold air drops, which roll it once (a gold
 * drop holds a variant strobe 1 time in 10); 1.25 % on 50v50 maps, whose military crates roll it 6-8 times (about 1
 * crate in 6 holds one). The strobe itself is far likelier there: 82 % of desert's gold drop rolls, 45 % of savannah's,
 * 22 % of woods', and 3 in every 50v50 gold military crate.
 */
export const STROBE_VARIANT_ROLL_SHARE = 0.05;
export const FACTION_STROBE_VARIANT_ROLL_SHARE = 0.0125;

type LootTables = Readonly<Record<string, readonly LootTableEntry[]>>;

/** Item names reachable from `tier` (nested tier_* tables followed). */
function reachable(tables: LootTables, tier: string, out = new Set<string>(), seen = new Set<string>()): Set<string> {
    if (seen.has(tier)) return out;
    seen.add(tier);
    for (const e of tables[tier] ?? []) {
        if (!e.name) continue;
        if (e.name.startsWith("tier_")) reachable(tables, e.name, out, seen);
        else out.add(e.name);
    }
    return out;
}

/**
 * Whether a map's rare crates drop the variant strobes: not in potato modes; on 50v50 maps (their gold military crate
 * holds 3 strobes, survev crateDefs.ts:813-842) and on every map whose air drop tables hold a strobe (desert,
 * savannah, the woods maps; survev desertDefs.ts:194-198, woodsDefs.ts:133-139, savannahDefs).
 */
export function dropsStrobeVariants(def: MapDef): boolean {
    if (def.gameMode.potatoMode) return false;
    if (def.gameMode.factionMode) return true;
    const tables = def.lootTable;
    return [THROWABLES, "tier_airdrop_uncommon", "tier_airdrop_rare"].some((t) => reachable(tables, t).has("strobe"));
}

const round6 = (v: number): number => Math.round(v * 1e6) / 1e6;

/** A map's rare throwables table: its tier_airdrop_throwables, plus the variant strobes where the map drops them. */
export function rareThrowablesTable(def: MapDef): LootTableEntry[] {
    const base = (def.lootTable[THROWABLES] ?? []).map((e) => ({ ...e }));
    if (!dropsStrobeVariants(def)) return base;
    const share = def.gameMode.factionMode ? FACTION_STROBE_VARIANT_ROLL_SHARE : STROBE_VARIANT_ROLL_SHARE;
    const total = base.reduce((sum, e) => sum + Math.max(0, e.weight), 0);
    // each variant takes `share` of the rolls: w / (total + 2w) = share
    const weight = round6((share * total) / (1 - STROBE_VARIANT_TYPES.length * share));
    return [...base, ...STROBE_VARIANT_TYPES.map((name) => ({ name, count: 1, weight }))];
}

/** Every map with a tier_airdrop_throwables table, with RARE_THROWABLES_TABLE added to a copy of its loot table. */
export function applyStrobeVariantLoot(maps: Readonly<Record<string, MapDef>>): Record<string, MapDef> {
    const out: Record<string, MapDef> = {};
    for (const [name, def] of Object.entries(maps)) {
        if (!def.lootTable[THROWABLES]) {
            out[name] = def;
            continue;
        }
        if (Object.hasOwn(def.lootTable, RARE_THROWABLES_TABLE))
            throw new Error(`${name}: ${RARE_THROWABLES_TABLE} exists`);
        out[name] = { ...def, lootTable: { ...def.lootTable, [RARE_THROWABLES_TABLE]: rareThrowablesTable(def) } };
    }
    return out;
}

/** Copies of the RARE_THROWABLE_CRATES whose tier_airdrop_throwables rolls use RARE_THROWABLES_TABLE. */
export function rareThrowableCrates(generated: Readonly<Record<string, MapObjectDef>>): Record<string, ObstacleDef> {
    const out: Record<string, ObstacleDef> = {};
    for (const id of RARE_THROWABLE_CRATES) {
        const crate = generated[id] as ObstacleDef;
        if (crate?.type !== "obstacle") throw new Error(`rare throwable crate "${id}" is not an obstacle`);
        if (!crate.loot.some((l) => l.tier === THROWABLES)) throw new Error(`${id} rolls no ${THROWABLES}`);
        const loot: LootSpawnDef[] = crate.loot.map((l) =>
            l.tier === THROWABLES ? { ...l, tier: RARE_THROWABLES_TABLE } : { ...l },
        );
        out[id] = { ...crate, loot };
    }
    return out;
}
