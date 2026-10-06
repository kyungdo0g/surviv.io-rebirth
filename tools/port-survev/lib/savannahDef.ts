// Savannah map generation and loot tables applied by the port over the reverted def (moved from packages/sim, M7b). The port's balance revert compared
// survev HEAD with its pre-fork snapshot ae55c9a8, in which `savannah` was still a recoloured copy of Main, and so
// "reverted" Savannah to Main's spawns and loot (club, docks, huts, assault rifles, shotguns, 2x scopes; see
// packages/defs provenance.balanceRevert entries noted "survev had no own Savannah loot table before 2025-08").
// The data below is survev's first Savannah reconstruction (map generation bbe1a377 / e305bb67, loot tables
// 367a7b3d, both before its fork structures), with the KB conflict resolutions of docs/research/modes/savannah.md:
// one width-4 river (savannah-rivers), three crate lakes with the large one at the map centre (savannah-lakes),
// pre-fork crate counts (savannah-crate-counts), no Cloud Bunker, Oasis or alternate warehouse (fork structures), no
// Barrett / S&W 500 (savannah-fork-guns) and the pre-fork sniper weights (savannah-sv98-vs-awm).
import type { LootTableEntry, MapDef } from "../../../packages/defs/src/types/index.ts";

type MapGen = MapDef["mapGen"];

const e = (name: string, weight: number, count = 1): LootTableEntry => ({ name, count, weight });

/** survev 367a7b3d savannahDefs.ts lootTable (weights marked "?" there are survev estimates). */
export const SAVANNAH_LOOT: Readonly<Record<string, LootTableEntry[]>> = {
    tier_scopes: [e("4xscope", 5), e("8xscope", 1), e("15xscope", 0.02)],
    tier_guns: [
        e("scar", 1),
        e("scorpion", 1),
        e("mp5", 5),
        e("mac10", 6),
        e("ump9", 3),
        e("m1a1", 5),
        e("ot38", 4),
        e("colt45", 4),
        e("m9", 9),
        e("m1911", 9),
        e("flare_gun", 0.145),
        e("flare_gun_dual", 0.0025),
        e("model94", 6),
        e("blr", 6),
        e("scout_elite", 3),
        e("mk12", 2),
        e("m39", 2),
        e("vss", 1.5),
        e("mosin", 0.75),
        e("mkg45", 0.75),
        e("l86", 0.75),
        e("svd", 0.75),
        e("garand", 0.45),
        e("scarssr", 0.15),
        e("awc", 0.15),
        e("sv98", 0.1),
    ],
    tier_airdrop_uncommon: [
        e("mk12", 2.5),
        e("scar", 0.75),
        e("mosin", 2.5),
        e("m39", 2.5),
        e("sv98", 0.5),
        e("m9", 0.01),
        e("flare_gun", 0.5),
        e("mkg45", 2.5),
        e("vss", 2.5),
        e("l86", 0.75),
        e("svd", 0.75),
        e("scarssr", 0.15),
        e("awc", 0.15),
    ],
    tier_airdrop_rare: [
        e("garand", 6),
        e("awc", 3),
        e("scarssr", 3),
        e("sv98", 3),
        e("scorpion", 5),
        e("ots38_dual", 4.5),
    ],
    // ground ammo stacks hold 30 rounds instead of 60 (fandom Savannah_Map; savannah.md "Rules")
    tier_ammo: [e("9mm", 3, 30), e("45acp", 3, 30), e("762mm", 3, 30), e("556mm", 3, 30)],
    tier_ammo_crate: [
        e("9mm", 3, 30),
        e("45acp", 3, 30),
        e("762mm", 3, 30),
        e("556mm", 3, 30),
        e("308sub", 1, 5),
        e("flare", 1, 1),
    ],
    tier_airdrop_ammo: [e("9mm", 3, 30), e("45acp", 3, 30), e("762mm", 3, 30), e("556mm", 3, 30)],
    tier_chest: [
        e("mk12", 0.55),
        e("scar", 0.27),
        e("mosin", 0.55),
        e("m39", 0.55),
        e("sv98", 0.1),
        e("helmet02", 1),
        e("helmet03", 0.25),
        e("chest02", 1),
        e("chest03", 0.25),
        e("4xscope", 0.5),
        e("8xscope", 0.25),
    ],
    tier_hatchet: [e("vss", 1), e("svd", 1), e("l86", 1)],
    // strobes are rare loot and in grenade crates (savannah.md "Rules")
    tier_throwables: [e("frag", 1, 2), e("smoke", 1), e("strobe", 0.2), e("mirv", 0.05, 2)],
    tier_airdrop_throwables: [e("strobe", 1), e("mirv", 1, 2)],
};

/** survev e305bb67 savannahDefs.ts mapGen, without the fork ids the v0.8.82 client lacks. */
export const SAVANNAH_MAPGEN: Pick<
    MapGen,
    "fixedSpawns" | "densitySpawns" | "randomSpawns" | "spawnReplacements" | "customSpawnRules" | "importantSpawns"
> & { rivers: Pick<MapGen["map"]["rivers"], "lakes" | "weights" | "spawnCabins"> } = {
    rivers: {
        // savannah-lakes: the large lake "fixed in the center" (fandom Savannah_Map / Lake), two random ones within 200
        lakes: [
            { odds: 1, innerRad: 32, outerRad: 48, centerObj: "crate_02sv_lake", spawnBound: { pos: c(), rad: 0 } },
            { odds: 1, innerRad: 16, outerRad: 32, centerObj: "crate_02sv_lake", spawnBound: { pos: c(), rad: 200 } },
            { odds: 1, innerRad: 16, outerRad: 32, centerObj: "crate_02sv_lake", spawnBound: { pos: c(), rad: 200 } },
        ],
        // savannah-rivers: one narrow river; 0.8.3 disabled cabins on Savannah (fandom Changelog)
        weights: [{ weight: 1, widths: [4] }],
        spawnCabins: false,
    },
    customSpawnRules: { locationSpawns: [], placeSpawns: [] },
    importantSpawns: [],
    densitySpawns: [
        {
            stone_01: 72,
            barrel_01: 48,
            propane_01: 24,
            stone_07: 6,
            crate_01: 50,
            crate_02sv: 4,
            crate_03: 8,
            crate_21b: 2,
            bush_01sv: 48,
            tree_01sv: 48,
            hedgehog_01: 24,
            tree_12: 24,
            container_01: 5,
            container_02: 5,
            container_03: 5,
            container_04: 5,
            shack_01: 7,
            outhouse_01: 5,
            loot_tier_1: 24,
            loot_tier_beach: 4,
        },
    ],
    // savannah.md "Structures": only shack, outhouse, warehouse, storm and egg bunker and mansion of the normal
    // buildings, plus the savannah structures (warehouse_03sv and chest_03sv are fork ids the client lacks)
    fixedSpawns: [
        {
            grassy_cover_01: { small: 8, large: 9 },
            grassy_cover_02: { small: 8, large: 9 },
            grassy_cover_03: { small: 8, large: 9 },
            grassy_cover_complex_01: { small: 2, large: 3 },
            brush_clump_01: { small: 11, large: 13 },
            brush_clump_02: { small: 11, large: 13 },
            brush_clump_03: { small: 11, large: 13 },
            perch_01: { small: 11, large: 13 },
            kopje_patch_01: { small: 2, large: 3 },
            savannah_patch_01: { small: 4, large: 5 },
            mansion_structure_01: 1,
            warehouse_01: { small: 3, large: 4 },
            cache_01sv: 1,
            cache_02sv: 1,
            cache_07: 1,
            bunker_structure_01sv: 1,
            bunker_structure_03: 1,
            chest_01: 1,
            mil_crate_05: { small: 6, large: 8 },
            tree_02: 3,
        },
    ],
    randomSpawns: [],
    // stone_03 -> stone_03sv is a fork id: river stones stay stone_03
    spawnReplacements: [{ tree_01: "tree_01sv", bush_01: "bush_01sv" }],
};

function c(): { x: number; y: number } {
    return { x: 0.5, y: 0.5 };
}
