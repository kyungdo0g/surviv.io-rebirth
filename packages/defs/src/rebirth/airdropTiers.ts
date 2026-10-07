// Rebirth air drop tiers (deliberate rebirth deviation requested by the user, 2026-10-07; not in v0.8.82): a normal
// air drop opens into a tier 1 or a tier 2 inner crate instead of crate_10; the gold drop (airdrop_crate_02 ->
// crate_11, tier_airdrop_rare) and its mode variants are unchanged. Early drops lean to tier 1, late drops to tier 2,
// and the gold drop keeps its original share. The server turns it off with AIRDROP_TIERS=off (rules.airdropTiers).
// The shell stays the normal one (same type id on the wire): the sim picks the inner crate when it chooses the crate
// and keeps it server-side until the shell is opened, so tier 1 and tier 2 drops are the same object until then.
// docs/research/rebirth-deviations.md lists it; rebirth/airdropLoot.ts builds the inner crates and their loot tables.

/** Tiers of a normal air drop, worst first. */
export const AIRDROP_TIER_IDS = ["tier1", "tier2"] as const;
export type AirdropTier = (typeof AIRDROP_TIER_IDS)[number];

/**
 * Normal air drop shells that split into tiers, and the inner crate each tier opens into (instead of the shell's
 * destroyType). Every other crate of a map's `planes.crates` (gold drops, the 50v50 military crates, Cobalt's class
 * pods, the potato crates) keeps its original contents:
 * - airdrop_crate_01 (crate_10): main, woods, desert, halloween, turkey, potato, beach, birthday and the test maps;
 *   each map resolves the tier tables in its own loot table, like crate_10's tier_airdrop_uncommon.
 * - airdrop_crate_01x (snow's winter shell around crate_10): the same split; snow drops 4 crates (circles 0-3).
 * - airdrop_crate_01sv (savannah, crate_10sv: crate_10 plus a perk): split into crates that keep the perk.
 */
export const AIRDROP_TIER_SPLITS: Readonly<Record<string, Readonly<Record<AirdropTier, string>>>> = {
    airdrop_crate_01: { tier1: "crate_10t1", tier2: "crate_10t2" },
    airdrop_crate_01x: { tier1: "crate_10t1", tier2: "crate_10t2" },
    airdrop_crate_01sv: { tier1: "crate_10svt1", tier2: "crate_10svt2" },
};

/**
 * Inner crate a tiered shell's base crate maps to: the crate the shell opened into in v0.8.82, whose loot list the
 * tier crates are built from (rebirth/airdropLoot.ts).
 */
export const AIRDROP_TIER_BASE_CRATES: Readonly<Record<string, string>> = {
    crate_10t1: "crate_10",
    crate_10t2: "crate_10",
    crate_10svt1: "crate_10sv",
    crate_10svt2: "crate_10sv",
};

/**
 * Tier 1's share of a normal drop by the circle the drop is picked in (index = gas circleIdx, the last entry for every
 * later circle; flare drops before the first circle use the first). The main map drops at circles 1 and 3: 70 / 30
 * then 30 / 70, so the first drop is mostly a tier 1 crate and the second mostly a tier 2 crate ("early drops favour
 * tier 1, later drops tier 2"); snow (circles 0-3) and beach (0, 1, 3) step through more of the table.
 */
export const AIRDROP_TIER1_SHARE_BY_CIRCLE: readonly number[] = [0.8, 0.7, 0.5, 0.3];

/** Tier 1's share of a normal drop picked in circle `circleIdx`. */
export function airdropTier1Share(circleIdx: number): number {
    const table = AIRDROP_TIER1_SHARE_BY_CIRCLE;
    const i = Math.min(table.length - 1, Math.max(0, Math.floor(circleIdx)));
    return table[i];
}

/** One weighted crate choice: the shell type and, for a tiered drop, the inner crate it opens into. */
export interface AirdropCrateChoice {
    name: string;
    weight: number;
    /** inner crate instead of the shell's destroyType (tiered drops only) */
    inner?: string;
}

/**
 * The map's crate weights (MapDef.gameConfig.planes.crates) with every splittable normal shell replaced by its tier 1
 * and tier 2 drops, in place: weight x share and weight x (1 - share) (share from `circleIdx`). The total weight is
 * unchanged, so every other crate keeps its chance: the main map's gold drop stays 1 of 11.
 */
export function tieredAirdropCrates(
    crates: readonly { name: string; weight: number }[],
    circleIdx: number,
): AirdropCrateChoice[] {
    const share = airdropTier1Share(circleIdx);
    const out: AirdropCrateChoice[] = [];
    for (const c of crates) {
        const split = Object.hasOwn(AIRDROP_TIER_SPLITS, c.name) ? AIRDROP_TIER_SPLITS[c.name] : undefined;
        if (!split) {
            out.push({ name: c.name, weight: c.weight });
            continue;
        }
        // tier 2 takes the exact rest, so the total (and every other crate's chance) is unchanged
        const tier1 = Math.round(c.weight * share * 1e6) / 1e6;
        out.push({ name: c.name, weight: tier1, inner: split.tier1 });
        out.push({ name: c.name, weight: c.weight - tier1, inner: split.tier2 });
    }
    return out;
}

/** Inner crate a tiered drop of `shell` opens into, or undefined when the shell does not split. */
export function airdropTierCrate(shell: string, tier: AirdropTier): string | undefined {
    return Object.hasOwn(AIRDROP_TIER_SPLITS, shell) ? AIRDROP_TIER_SPLITS[shell][tier] : undefined;
}

const TIER_OF_CRATE = new Map<string, AirdropTier>();
for (const split of Object.values(AIRDROP_TIER_SPLITS)) {
    for (const tier of AIRDROP_TIER_IDS) TIER_OF_CRATE.set(split[tier], tier);
}

/** Tier of a rebirth inner crate (crate_10t1 -> "tier1"), undefined for every other map object. */
export function airdropCrateTier(type: string): AirdropTier | undefined {
    return TIER_OF_CRATE.get(type);
}

/** Ids of the rebirth tier inner crates, in registry order. */
export const AIRDROP_TIER_CRATES: readonly string[] = Object.keys(AIRDROP_TIER_BASE_CRATES);
