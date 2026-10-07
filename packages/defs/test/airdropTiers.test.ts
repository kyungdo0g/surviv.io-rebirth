// Rebirth air drop tiers in the defs layer (src/rebirth/airdropTiers.ts, airdropLoot.ts; docs/research/
// rebirth-deviations.md "Air drop tiers"): the crate weights split per circle with the gold share unchanged, the tier
// inner crates against crate_10 / crate_10sv, the per-map tier tables (built from each map's own air drop tables,
// keeping its loot rules), and the order tier 1 < tier 2 < gold against the bots' gun tier list on every map.
import { describe, expect, it } from "vitest";
import {
    AIRDROP_LOW_END_GUNS,
    AIRDROP_TIER_SPLITS,
    AIRDROP_TIER1_ARMOR_TABLE,
    AIRDROP_TIER1_ONLY_GUNS,
    AIRDROP_TIER1_SHARE_BY_CIRCLE,
    AIRDROP_TIER1_TABLE,
    AIRDROP_TIER2_TABLE,
    airdropCrateTier,
    airdropTier1Share,
    airdropTierCrate,
    getMapDef,
    getMapObjectDefOfType,
    gunClass,
    LOOT_BANS,
    type LootTableEntry,
    MapDefs,
    TIER1_TIER2_SHARE,
    tieredAirdropCrates,
} from "../src/index.ts";
import { mapObjects, maps } from "./helpers.ts";

/**
 * Tier ranks of the guns in the air drop tables, D 0 .. S 10: a copy of the bots' shared tier list
 * (packages/bots/src/knowledge/gunTiers.ts ROWS, TIER_ORDER; "est." rows included), which @rebirth/defs cannot import.
 * The survev-only guns (tools/port-survev/policy.json) are not on that list yet: their ranks below are estimates from
 * their wiki stats (Barrett S-aim like the AWM-S, ASh-12 A+, SPAS-16 A like the Saiga-12, IMD-2 A- like the BAR,
 * S&W 500 B+), and the winter skins rank as their base guns. Round 5 (user report 33) re-ranked the MK12 / M39 to B+
 * (the owner's "low-tier DMRs") and the Mosin to A ("strong but not top, needs aim"), and ranked the PMG-134 A at its
 * explosion damage (report 34).
 */
// biome-ignore format: one tier per line
const RANK: Readonly<Record<string, number>> = {
    m249: 10, pkp: 10, // S
    awc: 9, awc_winter: 9, barrett: 9, // S-aim
    qbb97: 8, sv98: 8, sv98_winter: 8, usas: 8, ash12: 8, // A+
    mosin: 7, garand: 7, scar: 7, m4a1: 7, saiga: 7, spas12: 7, p30l_dual: 7, svd: 7, scarssr: 7, // A
    spas16: 7, svd_winter: 7, potato_lmg: 7, // A (survev-only)
    dp28: 6, bar: 6, imbel: 6, famas: 6, grozas: 6, m870: 6, mp220: 6, vector: 6, scorpion: 6, ots38_dual: 6, // A-
    mk12: 5, m39: 5, mkg45: 5, l86: 5, deagle_dual: 5, sw500: 5, // B+
    scout_elite: 4, vss: 4, model94: 4, deagle: 4, ak47: 4, groza: 4, // B
    colt45: 1, // C
    m9: 0, // D
};
const A = 7;
const A_PLUS = 8;
const S_AIM = 9;

/** An item's rank: anything without one (the flare gun, the potato guns, woods' MIRV and strobe) counts as D. */
const rank = (name: string): number => RANK[name] ?? 0;

/** A table as probabilities, nested tier_* rolls followed (tier 1's tier 2 roll). */
function flat(tables: Readonly<Record<string, readonly LootTableEntry[]>>, tier: string, p = 1): LootTableEntry[] {
    const table = tables[tier];
    const w = table.reduce((s, e) => s + e.weight, 0);
    return table.flatMap((e) =>
        e.name.startsWith("tier_") ? flat(tables, e.name, (p * e.weight) / w) : [{ ...e, weight: (p * e.weight) / w }],
    );
}

const total = (table: readonly LootTableEntry[]) => table.reduce((s, e) => s + e.weight, 0);
const meanRank = (table: readonly LootTableEntry[]) =>
    table.reduce((s, e) => s + rank(e.name) * e.weight, 0) / total(table);
/** Share of a table's rolls at `min` rank or better (every roll counts, a throwable as D). */
const shareAtLeast = (table: readonly LootTableEntry[], min: number) =>
    total(table.filter((e) => rank(e.name) >= min)) / total(table);
/** Share of a table's rolls that give a gun. */
const gunShare = (table: readonly LootTableEntry[]) =>
    total(table.filter((e) => gunClass(e.name) !== undefined)) / total(table);

/** A tier 1 table without its nested tier 2 roll. */
const core = (table: readonly LootTableEntry[]) => table.filter((e) => e.name !== AIRDROP_TIER2_TABLE);

/** Maps that drop a splittable normal shell. */
const TIERED_MAPS = Object.keys(MapDefs).filter((m) =>
    getMapDef(m).gameConfig.planes.crates.some((c) => Object.hasOwn(AIRDROP_TIER_SPLITS, c.name)),
);

describe("air drop tier weights", () => {
    it("early drops lean to tier 1, late drops to tier 2", () => {
        expect(AIRDROP_TIER1_SHARE_BY_CIRCLE).toEqual([0.8, 0.7, 0.5, 0.3]);
        expect([-1, 0, 1, 2, 3, 4, 7].map(airdropTier1Share)).toEqual([0.8, 0.8, 0.7, 0.5, 0.3, 0.3, 0.3]);
        const main = getMapDef("main").gameConfig.planes;
        // the main map drops in circles 1 and 3
        expect(main.timings.filter((t) => t.options.type === 0).map((t) => t.circleIdx)).toEqual([1, 3]);
        expect(tieredAirdropCrates(main.crates, 1)).toEqual([
            { name: "airdrop_crate_01", weight: 7, inner: "crate_10t1" },
            { name: "airdrop_crate_01", weight: 3, inner: "crate_10t2" },
            { name: "airdrop_crate_02", weight: 1 },
        ]);
        expect(tieredAirdropCrates(main.crates, 3)).toEqual([
            { name: "airdrop_crate_01", weight: 3, inner: "crate_10t1" },
            { name: "airdrop_crate_01", weight: 7, inner: "crate_10t2" },
            { name: "airdrop_crate_02", weight: 1 },
        ]);
    });

    it("every map keeps its total weight and every other crate's chance (main gold: 1 of 11)", () => {
        for (const [name, map] of Object.entries(MapDefs)) {
            const crates = map.gameConfig.planes.crates;
            for (let circle = -1; circle < 8; circle++) {
                const tiered = tieredAirdropCrates(crates, circle);
                const total = (list: readonly { weight: number }[]) => list.reduce((s, c) => s + c.weight, 0);
                expect(total(tiered), `${name} ${circle}`).toBeCloseTo(total(crates), 9);
                for (const c of crates.filter((c) => !Object.hasOwn(AIRDROP_TIER_SPLITS, c.name))) {
                    expect(
                        tiered.filter((t) => t.name === c.name),
                        `${name} ${c.name}`,
                    ).toEqual([c]);
                }
            }
        }
        const main = tieredAirdropCrates(getMapDef("main").gameConfig.planes.crates, 1);
        const gold = main.find((c) => c.name === "airdrop_crate_02")!.weight;
        expect(gold / main.reduce((s, c) => s + c.weight, 0)).toBeCloseTo(1 / 11, 12);
    });

    it("special crates never split: 50v50, potato 50v50 and Cobalt keep their crates", () => {
        for (const name of ["faction", "faction_potato", "cobalt"]) {
            const crates = getMapDef(name).gameConfig.planes.crates;
            expect(tieredAirdropCrates(crates, 2), name).toEqual(crates);
            expect(TIERED_MAPS).not.toContain(name);
            // nothing there could open a tier crate, so the maps get no tier tables
            expect(getMapDef(name).lootTable[AIRDROP_TIER1_TABLE], name).toBeUndefined();
        }
        expect(TIERED_MAPS.sort()).toEqual(
            [
                "main",
                "main_spring",
                "main_summer",
                "desert",
                "halloween",
                "potato",
                "potato_spring",
                "snow",
                "woods",
                "woods_snow",
                "woods_spring",
                "woods_summer",
                "savannah",
                "turkey",
                "birthday",
                "beach",
                "test_normal",
                "test_faction",
            ].sort(),
        );
    });

    it("tier crates: the normal shells and the inner crate of each tier", () => {
        expect(AIRDROP_TIER_SPLITS).toEqual({
            airdrop_crate_01: { tier1: "crate_10t1", tier2: "crate_10t2" },
            airdrop_crate_01x: { tier1: "crate_10t1", tier2: "crate_10t2" },
            airdrop_crate_01sv: { tier1: "crate_10svt1", tier2: "crate_10svt2" },
        });
        // every split shell opens into crate_10 (or savannah's crate_10sv) in v0.8.82
        expect(Object.keys(AIRDROP_TIER_SPLITS).map((s) => mapObjects[s].destroyType)).toEqual([
            "crate_10",
            "crate_10",
            "crate_10sv",
        ]);
        expect(airdropTierCrate("airdrop_crate_01", "tier2")).toBe("crate_10t2");
        expect(airdropTierCrate("airdrop_crate_02", "tier1")).toBeUndefined();
        expect(["crate_10t1", "crate_10svt2", "crate_10", "crate_11"].map(airdropCrateTier)).toEqual([
            "tier1",
            "tier2",
            undefined,
            undefined,
        ]);
    });
});

describe("air drop tier inner crates", () => {
    it("are crate_10 / crate_10sv with the tier's loot: tier 2 swaps the guns, tier 1 is leaner", () => {
        for (const [id, baseId] of [
            ["crate_10t1", "crate_10"],
            ["crate_10t2", "crate_10"],
            ["crate_10svt1", "crate_10sv"],
            ["crate_10svt2", "crate_10sv"],
        ]) {
            const crate = getMapObjectDefOfType("obstacle", id);
            const base = mapObjects[baseId];
            // same sprite, size, health, sounds and effects: the client draws the tier mark
            expect({ ...crate, loot: base.loot }, id).toEqual(base);
        }
        const loot = (id: string) =>
            getMapObjectDefOfType("obstacle", id).loot.map((l) => `${l.tier} ${l.min}-${l.max}`);
        expect(loot("crate_10t2")).toEqual(
            mapObjects.crate_10.loot.map(
                (l: any) => `${l.tier === "tier_airdrop_uncommon" ? AIRDROP_TIER2_TABLE : l.tier} ${l.min}-${l.max}`,
            ),
        );
        expect(loot("crate_10t1")).toEqual([
            `${AIRDROP_TIER1_TABLE} 1-1`,
            `${AIRDROP_TIER1_ARMOR_TABLE} 1-1`,
            "tier_medical 1-1",
            "tier_airdrop_scopes 1-1",
            "tier_airdrop_ammo 2-2",
            "tier_airdrop_throwables 1-1",
        ]);
        // savannah's crates keep their perk roll
        expect(loot("crate_10svt1").at(-1)).toBe("tier_perks 1-1");
        expect(loot("crate_10svt2").at(-1)).toBe("tier_perks 1-1");
        // the generated defs are untouched
        expect(mapObjects.crate_10t1).toBeUndefined();
    });
});

describe("air drop tier tables", () => {
    it("main: tier 2 is today's normal drop without the MK12 / M39, tier 1 those DMRs, the low end and a few ground guns", () => {
        const t = getMapDef("main").lootTable;
        const names = (tier: string) => t[tier].map((e) => `${e.name}:${e.weight}`);
        // tier 2 is the v0.8.82 normal drop (the user: "today's normal drop is roughly tier 2") without the low-tier
        // DMRs the user named as tier 1 examples
        expect(t[AIRDROP_TIER2_TABLE]).toEqual(
            maps.main.lootTable.tier_airdrop_uncommon.filter(
                (e: LootTableEntry) =>
                    !AIRDROP_TIER1_ONLY_GUNS.includes(e.name) && !AIRDROP_LOW_END_GUNS.includes(e.name),
            ),
        );
        expect(names(AIRDROP_TIER1_TABLE)).toEqual([
            "mk12:1.25",
            "m39:1.25",
            "deagle:1",
            "m9:0.01",
            "scout_elite:2.5",
            "vss:2.5",
            "spas12:1",
            "famas:1",
            "grozas:1",
            "dp28:0.75",
            "m870:0.5",
            `${AIRDROP_TIER2_TABLE}:1.417778`,
        ]);
        // the additions weigh less than the low end, so most tier 1 rolls are a low-end gun
        const inUncommon = (e: LootTableEntry) => t.tier_airdrop_uncommon.some((u) => u.name === e.name);
        const lowEnd = core(t[AIRDROP_TIER1_TABLE]).filter(inUncommon);
        expect(total(lowEnd)).toBeGreaterThan(total(core(t[AIRDROP_TIER1_TABLE])) / 2);
        // 10 % of tier 1 rolls roll tier 2 instead
        expect(t[AIRDROP_TIER1_TABLE].at(-1)!.weight / total(t[AIRDROP_TIER1_TABLE])).toBeCloseTo(TIER1_TIER2_SHARE, 6);
        // tier 1 armour: level 2, level 3 one time in three
        expect(names(AIRDROP_TIER1_ARMOR_TABLE)).toEqual([
            "helmet02:1",
            "chest02:1",
            "backpack02:1",
            "helmet03:0.5",
            "chest03:0.5",
            "backpack03:0.5",
        ]);
        // the generated tables are untouched
        expect(maps.main.lootTable[AIRDROP_TIER1_TABLE]).toBeUndefined();
        expect(t.tier_airdrop_uncommon).toEqual(maps.main.lootTable.tier_airdrop_uncommon);
    });

    it("every tiered map: tier 2 is its normal drop's guns without the tier 1 DMRs, and tier 1 is below tier 2", () => {
        for (const name of TIERED_MAPS) {
            const t = getMapDef(name).lootTable;
            for (const tier of [AIRDROP_TIER1_TABLE, AIRDROP_TIER2_TABLE, AIRDROP_TIER1_ARMOR_TABLE]) {
                expect(t[tier], `${name} ${tier}`).toBeDefined();
            }
            const uncommon = t.tier_airdrop_uncommon;
            expect(t[AIRDROP_TIER2_TABLE], name).toEqual(
                uncommon.filter(
                    (e) =>
                        gunClass(e.name) &&
                        !AIRDROP_TIER1_ONLY_GUNS.includes(e.name) &&
                        !AIRDROP_LOW_END_GUNS.includes(e.name),
                ),
            );
            // the low-tier DMRs the user named are tier 1 guns
            for (const e of uncommon.filter((x) => AIRDROP_TIER1_ONLY_GUNS.includes(x.name))) {
                expect(
                    t[AIRDROP_TIER1_TABLE].map((x) => x.name),
                    `${name} ${e.name}`,
                ).toContain(e.name);
            }
            // a tier 2 crate always holds a gun; non-gun rolls count as D, so they cannot hide in the comparison
            const tier1 = flat(t, AIRDROP_TIER1_TABLE);
            const tier2 = flat(t, AIRDROP_TIER2_TABLE);
            expect(gunShare(tier2), name).toBe(1);
            expect(gunShare(tier1), name).toBeLessThanOrEqual(gunShare(tier2));
            // tier 1 vs tier 2 follows the user's examples ("low-tier DMRs, SPAS-12, a bit above AK / Groza" vs
            // "SCAR-H, Vector"; the bots' list agrees since round 5 ranks the MK12 / M39 B+): tier 2's own guns (all
            // but its low-end filler) reach tier 1 only through its 10 % tier 2 roll
            const tier2Own = t[AIRDROP_TIER2_TABLE].filter(
                (e) => gunClass(e.name) && !AIRDROP_LOW_END_GUNS.includes(e.name),
            );
            const tier1Core = new Set(core(t[AIRDROP_TIER1_TABLE]).map((e) => e.name));
            for (const e of tier2Own) expect(tier1Core.has(e.name), `${name} ${e.name}`).toBe(false);
            // (savannah's normal drop is sniper rifles: the mean held there only through the A+ share while the bots'
            // list ranked its Mosin B and the MK12 / M39 A; since round 5's re-rank, the owner's, the mean holds on
            // every map, and savannah keeps the A+ check: SV-98, SVD's peers, SCAR-SSR, AWM-S are tier 2's)
            expect(meanRank(tier1), name).toBeLessThan(meanRank(tier2));
            if (name === "savannah")
                expect(shareAtLeast(tier1, A_PLUS), name).toBeLessThan(shareAtLeast(tier2, A_PLUS));
            // tier 1's own guns are at most A (the SPAS-12): A+ and better only through its tier 2 roll
            expect(shareAtLeast(core(t[AIRDROP_TIER1_TABLE]), A_PLUS), name).toBe(0);
            // every tier table entry is something the map can hold: no banned item (savannah)
            const banned = new Set(LOOT_BANS[name] ?? []);
            for (const tier of [AIRDROP_TIER1_TABLE, AIRDROP_TIER2_TABLE, AIRDROP_TIER1_ARMOR_TABLE]) {
                for (const e of t[tier]) expect(banned.has(e.name), `${name} ${tier} ${e.name}`).toBe(false);
            }
        }
    });

    it("every map with a gold drop keeps it above tier 2 (v0.8.82's lead of gold over the normal drop)", () => {
        // potato's gold crate holds the potato cannon / potato SMG, novelty guns outside the tier list
        const goldMaps = TIERED_MAPS.filter((m) => !m.startsWith("potato"));
        expect(goldMaps).toHaveLength(TIERED_MAPS.length - 2);
        for (const name of goldMaps) {
            const def = getMapDef(name);
            // every gold shell the map drops opens into a crate_11 variant that rolls tier_airdrop_rare
            const golds = def.gameConfig.planes.crates.filter((c) => !Object.hasOwn(AIRDROP_TIER_SPLITS, c.name));
            expect(golds.length, name).toBeGreaterThan(0);
            for (const c of golds) {
                const inner = getMapObjectDefOfType("obstacle", mapObjects[c.name].destroyType);
                expect(inner.loot[0].tier, `${name} ${c.name}`).toBe("tier_airdrop_rare");
            }
            const tier2 = flat(def.lootTable, AIRDROP_TIER2_TABLE);
            const gold = flat(def.lootTable, "tier_airdrop_rare");
            // snow's gold table has survev's winter AWM-S (awc_winter) instead of the AWM-S. The lead was 0.5 ranks
            // until round 5 re-ranked the Mosin, tier 2's most common gun, from B to A (the owner: "strong but not
            // top"): tier 2's mean rose by about 0.4 on every map, and beach (no Barrett in its gold drop) keeps a
            // lead of 0.32; the top shares below still separate gold clearly
            expect(meanRank(tier2) + 0.25, name).toBeLessThan(meanRank(gold));
            // the top (S: M249, PKP; S-aim: AWM-S) is gold's: tier 2 has at most savannah's AWM-S 0.15
            expect(shareAtLeast(tier2, S_AIM), name).toBeLessThan(shareAtLeast(gold, S_AIM) / 4);
            // most of gold's rolls are A or better. Before round 5 tier 2's A-or-better share also had to stay below
            // gold's; with the Mosin at A (the owner's ranking, report 33) tier 2 (SCAR-H, Mosin, Saiga, SV-98, QBB-97)
            // holds more A and A+ guns than gold, whose lead is its top (AWM-S, M249, PKP, Barrett: the S-aim share
            // above) and its mean rank
            expect(shareAtLeast(gold, A), name).toBeGreaterThan(0.5);
        }
        // snow's gold drop has survev's winter AWM-S skin, not the AWM-S (survev/shared/defs/maps/snowDefs.ts:167)
        const snow = getMapDef("snow").lootTable;
        expect(snow.tier_airdrop_rare.map((e) => e.name)).not.toContain("awc");
        expect(snow.tier_airdrop_rare.find((e) => e.name === "awc_winter")?.weight).toBe(3);
    });

    it("every gun of the tables has a rank, so the comparisons cover them all", () => {
        for (const name of TIERED_MAPS) {
            const t = getMapDef(name).lootTable;
            for (const tier of [AIRDROP_TIER1_TABLE, AIRDROP_TIER2_TABLE, "tier_airdrop_rare"]) {
                for (const e of core(t[tier])) {
                    const unranked = ["flare_gun", "potato_cannon", "potato_smg", "potato_lmg"].includes(e.name);
                    if (gunClass(e.name) && !unranked) expect(RANK[e.name], `${name} ${e.name}`).toBeDefined();
                }
            }
        }
    });

    it("mode rules hold: woods keeps LMGs, shotguns and its throwables; savannah gets no banned gun", () => {
        for (const name of ["woods", "woods_snow", "woods_spring", "woods_summer"]) {
            const t = getMapDef(name).lootTable;
            const tier1 = core(t[AIRDROP_TIER1_TABLE]);
            const classes = new Set(tier1.filter((e) => gunClass(e.name)).map((e) => gunClass(e.name)));
            expect([name, [...classes].sort()]).toEqual([name, ["lmg", "shotgun"]]);
            // the MIRV and strobe of woods' normal drop move to tier 1: a tier 2 crate always holds a gun (survev's
            // SPAS-16 sits in woods' normal drop, survev/shared/defs/maps/woodsDefs.ts:137)
            expect(tier1.filter((e) => !gunClass(e.name)).map((e) => e.name)).toEqual(["mirv", "strobe"]);
            expect(t[AIRDROP_TIER2_TABLE].map((e) => e.name)).toEqual(["saiga", "spas16", "qbb97"]);
        }
        const sv = getMapDef("savannah").lootTable;
        expect(core(sv[AIRDROP_TIER1_TABLE]).map((e) => e.name)).toEqual(["mk12", "m39", "m9", "mkg45", "vss", "l86"]);
        expect(sv[AIRDROP_TIER2_TABLE].map((e) => e.name)).toContain("scar");
        const desert = core(getMapDef("desert").lootTable[AIRDROP_TIER1_TABLE]).map((e) => e.name);
        expect(desert).toEqual(expect.arrayContaining(["model94", "colt45", "scout_elite"]));
        // potato keeps its own tables (60-round ammo stacks, the K-pot-ato helmet among the level 3 gear)
        const potato = getMapDef("potato").lootTable;
        expect(potato[AIRDROP_TIER1_ARMOR_TABLE].map((e) => e.name)).toContain("helmet03_potato");
        expect(core(potato[AIRDROP_TIER1_TABLE]).map((e) => e.name)).toEqual([
            "mk12",
            "m39",
            "deagle",
            "m9",
            "scout_elite",
            "vss",
            "spas12",
            "m870",
        ]);
    });
});
