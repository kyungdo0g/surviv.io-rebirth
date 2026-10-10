// Where the new guns spawn (src/rebirth/newGunLoot.ts; docs/design/new-gun-stats.md section 5): main's rows are the
// sheet's, every map follows its rules (loot bans, ground classes, Desert's lack of 9mm, launchers on the floor only on
// main and Desert), gold-only guns and rockets stay where the sheet allows them, tier 1's tier 2 roll stays 10 %, and
// the GUN_BETA tables (src/rebirth/gunBeta.ts) add the beta guns to every map's floor.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
    AIRDROP_TIER1_TABLE,
    AIRDROP_TIER2_TABLE,
    DESERT_FLOOR_MAPS,
    FLOOR_LAUNCHER_MAPS,
    GOLD_BONUS_TABLE,
    GOLD_DROP_TABLE,
    GUN_BETA_FLOOR_COPIES,
    GUN_BETA_FLOOR_SHARE,
    GUN_BETA_GUNS,
    GUN_BETA_SURVEV_GUNS,
    getDefOfType,
    getGunBetaGuns,
    getGunBetaLootTables,
    getMapDef,
    gunAmmo,
    gunClass,
    LOOT_BANS,
    type LootTableEntry,
    MapDefs,
    NEW_GUN_GOLD,
    NEW_GUN_GOLD_SKIPPED,
    NEW_GUN_IDS,
    NEW_GUN_TIER1,
    NEW_GUN_TIER2,
    OWNER_LOOT_WEIGHTS,
    RING_CASE_TABLE,
    TIER1_TIER2_SHARE,
} from "../src/index.ts";
import { maps as generatedMaps, REPO_ROOT } from "./helpers.ts";

const sheet = JSON.parse(readFileSync(`${REPO_ROOT}docs/design/new-gun-stats.json`, "utf8"));
const NEW = new Set(NEW_GUN_IDS);
const total = (t: readonly LootTableEntry[]) => t.reduce((s, e) => s + e.weight, 0);
/** The rows a table gained over the generated one (the rebirth only appends). */
function added(map: string, table: string): Record<string, number> {
    const before = generatedMaps[map].lootTable[table] ?? [];
    const after = getMapDef(map).lootTable[table] ?? [];
    expect(after.slice(0, before.length), `${map} ${table}`).toEqual(before);
    return Object.fromEntries(after.slice(before.length).map((e) => [e.name, e.weight]));
}
const newRows = (map: string, table: string) =>
    Object.fromEntries(Object.entries(added(map, table)).filter(([g]) => NEW.has(g)));

describe("new guns on main: the sheet's rows", () => {
    const main = sheet.loot.main;

    it("floor, shotgun floor, tier 1, tier 2 and gold rows", () => {
        // the owner's USAS-12 joins main's floor after the sheet's rows (ownerLoot.ts, 2026-10-08)
        expect(added("main", "tier_guns")).toEqual({ ...main.tier_guns, ...OWNER_LOOT_WEIGHTS.classicFloor });
        expect(newRows("main", "tier_guns")).toEqual(main.tier_guns);
        expect(added("main", "tier_shotguns")).toEqual(main.tier_shotguns);
        expect(added("main", "tier_airdrop_uncommon")).toEqual(main.tier_airdrop_uncommon_appended);
        const { spas16: _, ...tier2 } = main.tier_airdrop_uncommon_appended;
        expect(NEW_GUN_TIER2).toEqual(tier2);
        expect(NEW_GUN_TIER1).toEqual(main.tier_airdrop_tier1_appended);
        expect(NEW_GUN_GOLD).toEqual(main.tier_airdrop_rare_appended);
        // the gold drop: the new rows, then the Barrett overlay with the owner's SVD and SCAR-SSR (survevGuns.ts)
        expect(added("main", GOLD_DROP_TABLE)).toEqual({
            ...main.tier_airdrop_rare_appended,
            barrett: 1,
            svd: 0.5,
            scarssr: 0.5,
        });
        expect(total(getMapDef("main").lootTable[GOLD_DROP_TABLE])).toBeCloseTo(28.01, 6);
        expect(added("desert", "tier_guns").m1928).toBe(main.desert_tier_guns.m1928);
        expect(added("main", "tier_ammo_crate")).toEqual({ "57mm": main.tier_ammo_crate["57mm"].weight });
        expect(getMapDef("main").lootTable.tier_ammo_crate.at(-1)).toEqual({ name: "57mm", count: 50, weight: 0.5 });
    });

    it("tier 1 gets its rows after the derivation and keeps a 10 % tier 2 roll (main 2.451111)", () => {
        const t1 = getMapDef("main").lootTable[AIRDROP_TIER1_TABLE];
        expect(Object.fromEntries(t1.filter((e) => NEW.has(e.name)).map((e) => [e.name, e.weight]))).toEqual(
            main.tier_airdrop_tier1_appended,
        );
        // the sheet's 20.76 (and its roll 2.306667) plus the owner's L86A2 1.25 (airdropLoot.ts) and M202 0.05
        // (OWNER_LOOT_WEIGHTS.m202, 2026-10-08)
        expect(t1.at(-1)).toEqual({ name: AIRDROP_TIER2_TABLE, count: 1, weight: 2.451111 });
        expect(total(t1.slice(0, -1))).toBeCloseTo(20.76 + 1.25 + 0.05, 6);
        for (const name of Object.keys(MapDefs)) {
            const t = getMapDef(name).lootTable[AIRDROP_TIER1_TABLE];
            if (!t) continue;
            expect(t.at(-1)!.weight / total(t), name).toBeCloseTo(TIER1_TIER2_SHARE, 5);
        }
    });

    it("the M79 is in both air drop tiers; the M200 and M202 in tier 2 and gold; tier 2 holds the SPAS-16", () => {
        const t = getMapDef("main").lootTable;
        const names = (tier: string) => t[tier].map((e) => e.name);
        expect(names(AIRDROP_TIER1_TABLE)).toContain("m79");
        expect(names(AIRDROP_TIER2_TABLE)).toEqual(expect.arrayContaining(["m79", "m200", "m202", "spas16"]));
        expect(names(GOLD_DROP_TABLE)).toEqual(expect.arrayContaining(["m200", "m202"]));
    });
});

describe("new guns on every map: map rules", () => {
    const tableOf = (map: string) => getMapDef(map).lootTable;

    it.each(Object.keys(MapDefs))("%s: no banned gun, floor rules, gold-only guns only in the gold drop", (map) => {
        const tables = tableOf(map);
        const banned = new Set(LOOT_BANS[map] ?? []);
        for (const [tier, entries] of Object.entries(tables)) {
            for (const e of entries.filter((x) => NEW.has(x.name))) {
                const at = `${map} ${tier} ${e.name}`;
                expect(banned.has(e.name), at).toBe(false);
                if (getDefOfType("gun", e.name).goldOnly) expect(tier, at).toBe(GOLD_DROP_TABLE);
                // launchers lie on the floor of main and Desert only, but the owner's Panzerfaust (2026-10-08): every
                // map whose floor has the flare gun (ownerLoot.ts)
                if (tier === "tier_guns" && gunClass(e.name) === "launcher" && e.name !== "panzerfaust")
                    expect(FLOOR_LAUNCHER_MAPS, at).toContain(map);
                // the new guns sit only in the tables the hook writes, the M79 in the owner's ring case and the M202 in
                // the gold crates' bonus roll (ownerLoot.ts, 2026-10-08)
                expect(
                    [
                        "tier_guns",
                        "tier_shotguns",
                        "tier_airdrop_uncommon",
                        AIRDROP_TIER1_TABLE,
                        AIRDROP_TIER2_TABLE,
                        GOLD_DROP_TABLE,
                        ...(e.name === "m79" ? [RING_CASE_TABLE] : []),
                        ...(e.name === "m202" ? [GOLD_BONUS_TABLE] : []),
                    ],
                    at,
                ).toContain(tier);
            }
            // rockets, 40 mm and the single-use guns' charges are in no table; 5.7x28 only in the ammo crates
            for (const e of entries)
                expect(
                    ["rocket", "40mm", "boys_ammo", "panzerfaust_ammo", "m202_ammo"],
                    `${map} ${tier}`,
                ).not.toContain(e.name);
            if (tier !== "tier_ammo_crate")
                expect(
                    entries.map((x) => x.name),
                    `${map} ${tier}`,
                ).not.toContain("57mm");
        }
        // the floor keeps the map's flavour: no class its ground guns lack (but launchers), no ammo it lacks
        const ground = generatedMaps[map].lootTable.tier_guns ?? [];
        const classes = new Set(ground.map((e: LootTableEntry) => gunClass(e.name)));
        const ammo = new Set(ground.map((e: LootTableEntry) => gunAmmo(e.name)));
        for (const g of Object.keys(newRows(map, "tier_guns"))) {
            if (gunClass(g) === "launcher") continue;
            expect(classes.has(gunClass(g)), `${map} ${g}`).toBe(true);
            const a = gunAmmo(g) === "57mm" ? "9mm" : gunAmmo(g);
            expect(ammo.has(a), `${map} ${g} ${a}`).toBe(true);
        }
        // 5.7x28 in the ammo crates exactly where the P90 spawns
        const p90 = Object.values(tables).some((t) => t.some((e) => e.name === "p90"));
        const crate = (tables.tier_ammo_crate ?? []).some((e) => e.name === "57mm");
        expect(crate, map).toBe(p90 && !!tables.tier_ammo_crate);
    });

    it("Woods: shotguns and LMGs on the floor, launchers only from air drops", () => {
        for (const map of ["woods", "woods_snow", "woods_spring", "woods_summer"]) {
            expect(newRows(map, "tier_guns"), map).toEqual({ m60: 0.02, mg42: 0.005 });
            expect(newRows(map, "tier_shotguns"), map).toEqual({ dp12: 0.05 });
            expect(Object.keys(newRows(map, GOLD_DROP_TABLE)), map).toEqual(["aa12", "mgl", "rpg7", "m202", "dshk"]);
        }
    });

    it("Savannah: pistols, quality 0 SMGs, DMRs and snipers; no new shotgun, LMG, assault rifle or AS Val / P90", () => {
        // and the owner's Panzerfaust (its floor has the flare gun)
        expect(newRows("savannah", "tier_guns")).toEqual({ fal: 0.1, tec9: 3, vz61: 2, bizon: 3, panzerfaust: 0.2 });
        expect(Object.keys(newRows("savannah", "tier_airdrop_uncommon"))).toEqual([
            "mk14",
            "wa2000",
            "m79",
            "m202",
            "m200",
            "boys",
        ]);
        expect(Object.keys(newRows("savannah", GOLD_DROP_TABLE))).toEqual([
            "mgl",
            "rpg7",
            "m202",
            "m200",
            "hecate",
            "lynx",
        ]);
    });

    it("Desert: no 9mm guns on the floor, the M1928 there only; launchers on the floor of main and Desert only", () => {
        const desert = newRows("desert", "tier_guns");
        for (const g of ["tec9", "vz61", "bizon", "asval", "p90"]) expect(desert[g], g).toBeUndefined();
        expect(desert.m1928).toBe(0.5);
        expect(DESERT_FLOOR_MAPS).toEqual(["desert"]);
        for (const map of Object.keys(MapDefs).filter((m) => !DESERT_FLOOR_MAPS.includes(m))) {
            expect(newRows(map, "tier_guns").m1928, map).toBeUndefined();
        }
        for (const map of FLOOR_LAUNCHER_MAPS) {
            expect(newRows(map, "tier_guns"), map).toMatchObject({ m79: 0.02, gl06: 0.02, panzerfaust: 0.2 });
        }
        expect(newRows("halloween", "tier_guns").m79).toBeUndefined();
        expect(newRows("faction", "tier_guns").m79).toBeUndefined();
        // the owner's Panzerfaust (0.2) lies wherever the flare gun does, but in the potato modes (ownerLoot.ts)
        expect(newRows("faction", "tier_guns").panzerfaust).toBe(0.2);
        expect(newRows("halloween", "tier_guns").panzerfaust).toBe(0.2);
        for (const map of ["woods", "potato", "faction_potato", "birthday"]) {
            expect(newRows(map, "tier_guns").panzerfaust, map).toBeUndefined();
        }
    });

    it("maps without a table get no row: 50v50, Potato vs Tomato and Cobalt have no tier 1; potato's gold is potatoes", () => {
        for (const map of ["faction", "faction_potato", "cobalt"]) {
            expect(tableOf(map)[AIRDROP_TIER1_TABLE], map).toBeUndefined();
            // their normal drop gets the tier 2 rows
            expect(newRows(map, "tier_airdrop_uncommon").p90, map).toBe(1.5);
        }
        expect(Object.keys(NEW_GUN_GOLD_SKIPPED)).toEqual(["potato", "potato_spring"]);
        for (const map of Object.keys(NEW_GUN_GOLD_SKIPPED)) expect(newRows(map, GOLD_DROP_TABLE), map).toEqual({});
        for (const map of Object.keys(MapDefs).filter((m) => !Object.hasOwn(NEW_GUN_GOLD_SKIPPED, m))) {
            expect(Object.keys(newRows(map, GOLD_DROP_TABLE)).length, map).toBeGreaterThan(0);
        }
    });
});

describe("GUN_BETA floor tables", () => {
    it("the new guns (duals made from two singles) and five survev-only guns", () => {
        expect(GUN_BETA_SURVEV_GUNS).toEqual(["barrett", "ash12", "sw500", "imbel", "spas16"]);
        expect(GUN_BETA_GUNS).toEqual([...NEW_GUN_IDS.filter((g) => !g.endsWith("_dual")), ...GUN_BETA_SURVEV_GUNS]);
        expect(GUN_BETA_GUNS).toHaveLength(46);
    });

    it("main: every beta gun on the floor, half of the floor gun rolls, nothing else changed", () => {
        const base = getMapDef("main").lootTable;
        const beta = getGunBetaLootTables("main");
        expect(beta).not.toBe(base);
        const rows = beta.tier_guns.slice(base.tier_guns.length);
        expect(beta.tier_guns.slice(0, base.tier_guns.length)).toEqual(base.tier_guns);
        expect(rows.map((e) => e.name)).toEqual(GUN_BETA_GUNS);
        expect(total(rows) / total(beta.tier_guns)).toBeCloseTo(GUN_BETA_FLOOR_SHARE, 5);
        for (const [tier, entries] of Object.entries(base))
            if (tier !== "tier_guns") expect(beta[tier], tier).toEqual(entries);
        // the map defs themselves keep the sheet's floor (the beta is a copy)
        expect(base.tier_guns.map((e) => e.name)).not.toContain("barrett");
        expect(getGunBetaLootTables("main")).toBe(beta);
    });

    it("map rules still hold: Savannah's bans, Woods' shotguns and LMGs (launchers on every map)", () => {
        const names = (map: string) => {
            const base = getMapDef(map).lootTable.tier_guns;
            return getGunBetaLootTables(map)
                .tier_guns.slice(base.length)
                .map((e) => e.name);
        };
        const savannah = names("savannah");
        for (const g of savannah) expect(LOOT_BANS.savannah, g).not.toContain(g);
        expect(savannah).toEqual(expect.arrayContaining(["barrett", "sw500", "rpg7", "boys"]));
        expect(savannah).not.toContain("ash12");
        const woods = names("woods");
        expect(new Set(woods.map((g) => gunClass(g)))).toEqual(new Set(["shotgun", "lmg", "launcher"]));
        for (const map of Object.keys(MapDefs)) {
            expect(names(map).length, map).toBeGreaterThan(5);
            // the guns laid GUN_BETA_FLOOR_COPIES times on the map's floor (sim loot/gunBeta.ts) are the same ones
            expect(getGunBetaGuns(map), map).toEqual(names(map));
        }
        expect(GUN_BETA_FLOOR_COPIES).toBe(2);
        expect(getGunBetaGuns("main")).toBe(getGunBetaGuns("main"));
    });
});
