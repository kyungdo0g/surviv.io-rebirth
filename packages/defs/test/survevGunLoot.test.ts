// Where the survev-only guns spawn on every map: survev's own placements on the maps we have (the port keeps them,
// tools/port-survev/lib/survevLoot.ts) plus the rebirth Barrett in the classic gold drop (rebirth/survevGuns.ts) and
// the owner's PMG-134 in the bathhouse ring case (rebirth/ownerLoot.ts).
// "Reachable" follows what each map can hand out (test/reach.ts). Placements that survev has in tables nothing on our
// maps reaches are pinned too, including unused baseline tables and other maps' copies of live sources.
// Classless crates never spawn in survev (docs/adr/0003-survev-baseline.md); their tables are not future content.
import { describe, expect, it } from "vitest";
import {
    GOLD_DROP_TABLE,
    getMapDef,
    MapDefs,
    NEW_GUN_GOLD,
    OWNER_LOOT_WEIGHTS,
    REBIRTH_GOLD_GUNS,
    SURVEV_GUN_SKINS,
    SURVEV_ONLY_GUNS,
} from "../src/index.ts";
import { maps as generatedMaps } from "./helpers.ts";
import { mapReach, reachablePlacements, unreachablePlacements } from "./reach.ts";

const GUNS = [...SURVEV_ONLY_GUNS, ...Object.keys(SURVEV_GUN_SKINS)];

/** The rebirth's SPAS-16 in the normal drop (tier 2) of main, its seasonal copies and Desert (rebirth/newGunLoot.ts). */
const SPAS16_TIER2 = ["tier_airdrop_tier2 1", "tier_airdrop_uncommon 1"];
/**
 * The owner's PMG-134 in the bathhouse ring case (case_07) of every map with the bathhouse but the potato modes
 * (rebirth/ownerLoot.ts, 2026-10-08); Savannah's bans keep it (a "special" gun, not an LMG: gunClasses.ts).
 */
const PMG_RING_CASE = ["tier_ring_case 0.001"];

/** Every reachable placement: map -> gun -> ["<table> <weight>"] (sources: survev's map defs at c6185e31). */
const REACHABLE: Readonly<Record<string, Readonly<Record<string, readonly string[]>>>> = {
    // rebirth: the Barrett in the gold drop (crate_11) of the classic map and its seasonal copies (snow below), and
    // the SPAS-16 in the tier 2 slot of the dropped SPAS-15 (docs/design/new-gun-stats.md section 5)
    main: { barrett: ["tier_airdrop_rare 1"], spas16: SPAS16_TIER2, potato_lmg: PMG_RING_CASE },
    main_spring: { barrett: ["tier_airdrop_rare 1"], spas16: SPAS16_TIER2, potato_lmg: PMG_RING_CASE },
    main_summer: { barrett: ["tier_airdrop_rare 1"], spas16: SPAS16_TIER2, potato_lmg: PMG_RING_CASE },
    // the 50v50 military crate (crate_12: 2 x tier_airdrop_rare), survev/shared/defs/maps/factionDefs.ts:343-353
    faction: {
        barrett: ["tier_airdrop_rare 0.5"],
        ash12: ["tier_airdrop_rare 0.5"],
        spas16: ["tier_airdrop_rare 2"],
    },
    // Potato vs Tomato: its military crate rolls the potato guns through tier_airdrop_rare (and Lone Survivr, below)
    faction_potato: { spas16: ["tier_airdrop_rare 2"], potato_lmg: ["tier_airdrop_potato 1"] },
    // potato: the gold drop, the hatchet case and the ring case (survev/shared/defs/maps/potatoDefs.ts:148-160)
    potato: { potato_lmg: ["tier_airdrop_rare 1", "tier_hatchet 0.1", "tier_ring_case 0.2"] },
    potato_spring: { potato_lmg: ["tier_airdrop_rare 1", "tier_hatchet 0.1", "tier_ring_case 0.2"] },
    // snow: the winter skins replace their base (survev/shared/defs/maps/snowDefs.ts:109-188), and the rebirth Barrett
    // in its gold drop (crate_11 inside airdrop_crate_02x), as on main
    snow: {
        barrett: ["tier_airdrop_rare 1"],
        spas16: SPAS16_TIER2,
        potato_lmg: PMG_RING_CASE,
        svd_winter: ["tier_eye_block 1.5"],
        sv98_winter: [
            "tier_airdrop_tier2 0.5",
            "tier_airdrop_uncommon 0.5",
            "tier_chest 0.1",
            "tier_eye_block 1",
            "tier_guns 0.01",
            "tier_sv98 1",
        ],
        awc_winter: ["tier_airdrop_rare 3", "tier_eye_block 0.75"],
    },
    // woods: the IMD-2 on the ground like the BAR, the SPAS-16 in the normal drop (survev woodsDefs.ts:76, :137)
    woods: {
        imbel: ["tier_guns 2.75"],
        spas16: ["tier_airdrop_tier2 1", "tier_airdrop_uncommon 1"],
        potato_lmg: PMG_RING_CASE,
    },
    woods_snow: {
        imbel: ["tier_guns 2.75"],
        spas16: ["tier_airdrop_tier2 1", "tier_airdrop_uncommon 1"],
        potato_lmg: PMG_RING_CASE,
        svd_winter: ["tier_eye_block 1.5"],
        sv98_winter: ["tier_eye_block 1"],
        awc_winter: ["tier_eye_block 0.75"],
    },
    woods_spring: { imbel: ["tier_guns 2.75"], spas16: ["tier_airdrop_tier2 1", "tier_airdrop_uncommon 1"] },
    woods_summer: {
        imbel: ["tier_guns 2.75"],
        spas16: ["tier_airdrop_tier2 1", "tier_airdrop_uncommon 1"],
        potato_lmg: PMG_RING_CASE,
    },
    // savannah: the Barrett and the S&W 500 everywhere, rare (survev/shared/defs/maps/savannahDefs.ts:74-107)
    savannah: {
        barrett: ["tier_airdrop_rare 1.5", "tier_airdrop_tier2 0.075", "tier_airdrop_uncommon 0.075", "tier_guns 0.06"],
        sw500: ["tier_airdrop_rare 2", "tier_airdrop_tier2 0.25", "tier_airdrop_uncommon 0.25", "tier_guns 0.09"],
        potato_lmg: PMG_RING_CASE,
    },
    // cobalt: Tank and Demo class pods, Master Scavenger kills (survev/shared/defs/maps/baseDefs.ts:464, 494, 548), and
    // since survev's Twins bunker (survev content wave stage 3) the Classless rare crate
    cobalt: {
        imbel: ["tier_guns_common_tank 0.5"],
        spas16: ["tier_guns_rare_classless 1", "tier_guns_rare_demo 0.4", "tier_scavenger_adv 1"],
        potato_lmg: PMG_RING_CASE,
    },
    // Halloween, Turkey and Beach: only the owner's ring case (their gold drop is main's but without the rebirth guns)
    halloween: { potato_lmg: PMG_RING_CASE },
    turkey: { potato_lmg: PMG_RING_CASE },
    beach: { potato_lmg: PMG_RING_CASE },
    // the test maps have main's buildings
    test_normal: { potato_lmg: PMG_RING_CASE },
    test_faction: { potato_lmg: PMG_RING_CASE },
    // desert (survev content wave stage 3): the crimson air drop and the Reserve's Gold Crimson Case
    // (tier_airdrop_crimson), the Reserve's wine racks (tier_revolvers; survev desertDefs.ts), and the rebirth SPAS-16
    // in the normal drop's tier 2 slot
    desert: {
        barrett: ["tier_airdrop_crimson 1"],
        sw500: ["tier_airdrop_crimson 1", "tier_revolvers 0.5"],
        ash12: ["tier_airdrop_crimson 1"],
        spas16: SPAS16_TIER2,
    },
};

/** Unreachable placements, by table, with their source or reason for remaining unused. */
const UNREACHABLE_PLACEMENTS: Readonly<Record<string, { guns: readonly string[]; source: string }>> = {
    tier_airdrop_crimson: { guns: ["ash12", "sw500", "barrett"], source: "other maps' copies (desert only, live)" },
    tier_revolvers: { guns: ["sw500"], source: "other maps' copies (the Reserve's wine racks, desert only, live)" },
    tier_pirate_rare: { guns: ["sw500", "ash12", "barrett"], source: "desert: Pirate's Bounty kills (Gold Cutlass)" },
    tier_airdrop_mythic: { guns: ["barrett"], source: "50v50 gold military crate (crate_13)" },
    // ADR 0003 (docs/adr/0003-survev-baseline.md): neither Classless crate ever spawns in survev.
    // Keep these table/gun pairs pinned; the rare table is already reachable in Cobalt through the Twins bunker.
    tier_guns_common_classless: { guns: ["imbel"], source: "unused baseline table (Classless crates never spawn)" },
    tier_guns_rare_classless: { guns: ["spas16"], source: "other maps' copies (Cobalt Twins bunker, live)" },
    tier_guns_common_tank: { guns: ["imbel"], source: "Cobalt Tank class pods (other maps' copies)" },
    tier_guns_rare_demo: { guns: ["spas16"], source: "Cobalt Demo class pods (other maps' copies)" },
    tier_scavenger_adv: { guns: ["spas16"], source: "Master Scavenger (other maps' copies)" },
    tier_airdrop_potato: { guns: ["potato_lmg"], source: "potato-mode crates (other maps' copies)" },
    tier_ring_case: {
        guns: ["potato_lmg"],
        source: "the owner's ring case on maps without the bathhouse (desert, 50v50, woods spring, birthday)",
    },
};

describe("survev-only guns: loot placements", () => {
    it.each(Object.keys(MapDefs))("%s: each gun spawns exactly where intended", (name) => {
        const got: Record<string, string[]> = {};
        for (const gun of GUNS) {
            const placements = reachablePlacements(name, gun);
            if (placements.length > 0) got[gun] = placements;
        }
        expect(got).toEqual(REACHABLE[name] ?? {});
    });

    it("every unreachable placement is pinned with its source or unused-baseline reason", () => {
        for (const name of Object.keys(MapDefs)) {
            for (const gun of GUNS) {
                for (const tier of unreachablePlacements(name, gun)) {
                    expect(UNREACHABLE_PLACEMENTS[tier]?.guns, `${name} ${tier} ${gun}`).toContain(gun);
                }
            }
        }
        // Halloween, Turkey and Beach hand out only the ring case's PMG-134 (the owner's, 2026-10-08), Birthday none
        for (const name of ["halloween", "turkey", "beach"])
            expect(REACHABLE[name]).toEqual({ potato_lmg: PMG_RING_CASE });
        expect(REACHABLE.birthday).toBeUndefined();
    });

    it("Potato vs Tomato's Lone Survivr carries the PMG-134 40 % of the time (survev factionPotatoDefs)", () => {
        expect(mapReach("faction_potato").loadoutItems.has("potato_lmg")).toBe(true);
        const options = JSON.stringify(getMapDef("faction_potato").gameConfig.roles?.roleOverrides?.last_man);
        expect(options).toContain('{"type":"potato_lmg","ammo":150,"fillInv":false,"weight":0.4}');
    });

    it("the rebirth Barrett, the owner's SVD and SCAR-SSR: gold drop of main and its seasonal copies only", () => {
        expect(GOLD_DROP_TABLE).toBe("tier_airdrop_rare");
        expect(Object.keys(REBIRTH_GOLD_GUNS)).toEqual(["main", "main_spring", "main_summer", "snow"]);
        // the event maps share main's gold drop but are modes of their own: left out on purpose (rebirth/survevGuns.ts)
        const mainGold = generatedMaps.main.lootTable[GOLD_DROP_TABLE];
        for (const name of ["halloween", "turkey", "birthday", "beach", "cobalt"]) {
            expect(generatedMaps[name].lootTable[GOLD_DROP_TABLE], name).toEqual(mainGold);
            expect(
                getMapDef(name).lootTable[GOLD_DROP_TABLE].some((e) => e.name === "barrett"),
                name,
            ).toBe(false);
        }
        expect(OWNER_LOOT_WEIGHTS.goldDrop).toEqual({ svd: 0.5, scarssr: 0.5 });
        for (const name of Object.keys(REBIRTH_GOLD_GUNS)) {
            const gold = getMapDef(name).lootTable[GOLD_DROP_TABLE];
            expect(gold.slice(-3)).toEqual([
                { name: "barrett", count: 1, weight: 1 },
                { name: "svd", count: 1, weight: 0.5 },
                { name: "scarssr", count: 1, weight: 0.5 },
            ]);
            // survev main's gold drop totals 22.68 (survev/shared/defs/maps/baseDefs.ts:612): 1 roll in 23.68 with the
            // Barrett, 1 in 27.01 with the new guns' gold rows (3.33, rebirth/newGunLoot.ts; new-gun-stats.md section
            // 5), and 28.01 with the owner's SVD and SCAR-SSR
            const newGold = Object.values(NEW_GUN_GOLD).reduce((s, w) => s + w, 0);
            expect(newGold).toBeCloseTo(3.33, 9);
            expect(gold.reduce((s, e) => s + e.weight, 0)).toBeCloseTo(23.68 + newGold + 1, 6);
            expect(generatedMaps[name].lootTable[GOLD_DROP_TABLE].map((e: { name: string }) => e.name)).not.toContain(
                "barrett",
            );
        }
    });

    it("map loot bans hold: Savannah gets no ASh-12, IMD-2 or SPAS-16 (no assault rifles, LMGs, shotguns)", () => {
        for (const entries of Object.values(getMapDef("savannah").lootTable)) {
            for (const gun of ["ash12", "imbel", "spas16"])
                expect(
                    entries.some((e) => e.name === gun),
                    gun,
                ).toBe(false);
        }
    });
});
