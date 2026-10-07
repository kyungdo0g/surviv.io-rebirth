// Where the survev-only guns spawn on every map: survev's own placements on the maps we have (the port keeps them,
// tools/port-survev/lib/survevLoot.ts) plus the rebirth Barrett in the classic gold drop (rebirth/survevGuns.ts).
// "Reachable" follows what each map can hand out (test/reach.ts). Placements that survev has in tables nothing on our
// maps reaches yet are pinned too: they become live with the later survev waves (the Pirate's Bounty kills, Cobalt's
// common Classless crate, 50v50's gold military crate); the crimson air drop and the Reserve came with stage 3.
import { describe, expect, it } from "vitest";
import {
    GOLD_DROP_TABLE,
    getMapDef,
    MapDefs,
    REBIRTH_GOLD_GUNS,
    SURVEV_GUN_SKINS,
    SURVEV_ONLY_GUNS,
} from "../src/index.ts";
import { maps as generatedMaps } from "./helpers.ts";
import { mapReach, reachablePlacements, unreachablePlacements } from "./reach.ts";

const GUNS = [...SURVEV_ONLY_GUNS, ...Object.keys(SURVEV_GUN_SKINS)];

/** Every reachable placement: map -> gun -> ["<table> <weight>"] (sources: survev's map defs at c6185e31). */
const REACHABLE: Readonly<Record<string, Readonly<Record<string, readonly string[]>>>> = {
    // rebirth: the Barrett in the gold drop (crate_11) of the classic map and its seasonal copies (snow below)
    main: { barrett: ["tier_airdrop_rare 1"] },
    main_spring: { barrett: ["tier_airdrop_rare 1"] },
    main_summer: { barrett: ["tier_airdrop_rare 1"] },
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
    woods: { imbel: ["tier_guns 2.75"], spas16: ["tier_airdrop_tier2 1", "tier_airdrop_uncommon 1"] },
    woods_snow: {
        imbel: ["tier_guns 2.75"],
        spas16: ["tier_airdrop_tier2 1", "tier_airdrop_uncommon 1"],
        svd_winter: ["tier_eye_block 1.5"],
        sv98_winter: ["tier_eye_block 1"],
        awc_winter: ["tier_eye_block 0.75"],
    },
    woods_spring: { imbel: ["tier_guns 2.75"], spas16: ["tier_airdrop_tier2 1", "tier_airdrop_uncommon 1"] },
    woods_summer: { imbel: ["tier_guns 2.75"], spas16: ["tier_airdrop_tier2 1", "tier_airdrop_uncommon 1"] },
    // savannah: the Barrett and the S&W 500 everywhere, rare (survev/shared/defs/maps/savannahDefs.ts:74-107)
    savannah: {
        barrett: ["tier_airdrop_rare 1.5", "tier_airdrop_tier2 0.075", "tier_airdrop_uncommon 0.075", "tier_guns 0.06"],
        sw500: ["tier_airdrop_rare 2", "tier_airdrop_tier2 0.25", "tier_airdrop_uncommon 0.25", "tier_guns 0.09"],
    },
    // cobalt: Tank and Demo class pods, Master Scavenger kills (survev/shared/defs/maps/baseDefs.ts:464, 494, 548), and
    // since survev's Twins bunker (survev content wave stage 3) the Classless rare crate
    cobalt: {
        imbel: ["tier_guns_common_tank 0.5"],
        spas16: ["tier_guns_rare_classless 1", "tier_guns_rare_demo 0.4", "tier_scavenger_adv 1"],
    },
    // desert (survev content wave stage 3): the crimson air drop and the Reserve's Gold Crimson Case
    // (tier_airdrop_crimson), the Reserve's wine racks (tier_revolvers; survev desertDefs.ts)
    desert: {
        barrett: ["tier_airdrop_crimson 1"],
        sw500: ["tier_airdrop_crimson 1", "tier_revolvers 0.5"],
        ash12: ["tier_airdrop_crimson 1"],
    },
};

/** Placements survev has that no object on our maps reaches yet, by table, with where they will come from. */
const LATER_WAVES: Readonly<Record<string, { guns: readonly string[]; source: string }>> = {
    tier_airdrop_crimson: { guns: ["ash12", "sw500", "barrett"], source: "other maps' copies (desert only, live)" },
    tier_revolvers: { guns: ["sw500"], source: "other maps' copies (the Reserve's wine racks, desert only, live)" },
    tier_pirate_rare: { guns: ["sw500", "ash12", "barrett"], source: "desert: Pirate's Bounty kills (Gold Cutlass)" },
    tier_airdrop_mythic: { guns: ["barrett"], source: "50v50 gold military crate (crate_13)" },
    tier_guns_common_classless: { guns: ["imbel"], source: "Cobalt Classless crates" },
    tier_guns_rare_classless: { guns: ["spas16"], source: "Cobalt Classless crates" },
    tier_guns_common_tank: { guns: ["imbel"], source: "Cobalt Tank class pods (other maps' copies)" },
    tier_guns_rare_demo: { guns: ["spas16"], source: "Cobalt Demo class pods (other maps' copies)" },
    tier_scavenger_adv: { guns: ["spas16"], source: "Master Scavenger (other maps' copies)" },
    tier_airdrop_potato: { guns: ["potato_lmg"], source: "potato-mode crates (other maps' copies)" },
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

    it("every other placement waits for a later survev wave (pinned with its future source)", () => {
        for (const name of Object.keys(MapDefs)) {
            for (const gun of GUNS) {
                for (const tier of unreachablePlacements(name, gun)) {
                    expect(LATER_WAVES[tier]?.guns, `${name} ${tier} ${gun}`).toContain(gun);
                }
            }
        }
        // Halloween, Turkey, Birthday and Beach hand out none of them yet
        for (const name of ["halloween", "turkey", "birthday", "beach"]) expect(REACHABLE[name]).toBeUndefined();
    });

    it("Potato vs Tomato's Lone Survivr carries the PMG-134 40 % of the time (survev factionPotatoDefs)", () => {
        expect(mapReach("faction_potato").loadoutItems.has("potato_lmg")).toBe(true);
        const options = JSON.stringify(getMapDef("faction_potato").gameConfig.roles?.roleOverrides?.last_man);
        expect(options).toContain('{"type":"potato_lmg","ammo":150,"fillInv":false,"weight":0.4}');
    });

    it("the rebirth Barrett: gold drop of main and its seasonal copies only, absent from the generated JSON", () => {
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
        for (const name of Object.keys(REBIRTH_GOLD_GUNS)) {
            const gold = getMapDef(name).lootTable[GOLD_DROP_TABLE];
            expect(gold.at(-1)).toEqual({ name: "barrett", count: 1, weight: 1 });
            // survev main's gold drop totals 22.68 (survev/shared/defs/maps/baseDefs.ts:612): 1 roll in 23.68
            expect(gold.reduce((s, e) => s + e.weight, 0)).toBeCloseTo(23.68, 6);
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
