// The owner's requests of 2026-10-08 in the defs layer (docs/research/rebirth-deviations.md "Owner's loot and speed
// changes"; src/rebirth/ownerLootWeights.ts holds the weights, ownerLoot.ts, survevGuns.ts and airdropLoot.ts place
// them, gunSpeeds.ts and newGuns.json hold the speeds): every change pinned with its rough chances.
import { describe, expect, it } from "vitest";
import {
    AIRDROP_TIER1_ADDED_DMRS,
    AIRDROP_TIER1_TABLE,
    AIRDROP_TIER2_TABLE,
    CLUB_VAULT_BOX,
    CLUB_VAULT_BUILDING,
    CLUB_VAULT_TABLE,
    GOLD_BONUS_CRATES,
    GOLD_BONUS_TABLE,
    GOLD_DROP_TABLE,
    GUN_SPEED_OVERRIDES,
    getDefOfType,
    getGunBetaLootTables,
    getMapDef,
    getMapObjectDefOfType,
    LOOT_BANS,
    type LootTableEntry,
    MapDefs,
    MapObjectDefs,
    OWNER_CLASSIC_FLOOR_MAPS,
    OWNER_LOOT_WEIGHTS,
    REBIRTH_GOLD_GUNS,
    RING_CASE_TABLE,
    rebirthDeviations,
} from "../src/index.ts";
import { gameObjects, maps as generatedMaps, mapObjects } from "./helpers.ts";
import { mapReach } from "./reach.ts";

const total = (t: readonly LootTableEntry[]) => t.reduce((s, e) => s + e.weight, 0);
/** A table's chances in percent, by item. */
const percent = (t: readonly LootTableEntry[]) =>
    Object.fromEntries(t.map((e) => [e.name, (100 * e.weight) / total(t)]));
const share = (t: readonly LootTableEntry[], names: readonly string[]) =>
    total(t.filter((e) => names.includes(e.name))) / total(t);
const tables = (map: string) => getMapDef(map).lootTable;
const POTATO_MODES = ["faction_potato", "potato", "potato_spring"];
/** Map objects whose loot list names `tier` or `item` (the generated defs). */
const holders = (needle: string) =>
    Object.entries(mapObjects)
        .filter(([, d]) => JSON.stringify(d).includes(`"${needle}"`))
        .map(([id]) => id);

describe("the owner's weight table", () => {
    it("holds every weight of 2026-10-08 in one place", () => {
        expect(OWNER_LOOT_WEIGHTS).toEqual({
            classicFloor: { usas: 0.005 },
            goldDrop: { svd: 0.5, scarssr: 0.5 },
            airdropTier1: { l86: 1.25 },
            ringCase: { grozas: 0.825, ots38_dual: 0.163, pkp: 0.01, potato_lmg: 0.001, m79: 0.001 },
            clubVaultBoxes: { deposit_box_01: 1, deposit_box_02_club: 1 },
            clubVault: {
                hk416: 4,
                ak47: 4,
                mp5: 4,
                m870: 4,
                famas: 2.5,
                groza: 2.5,
                spas12: 2.5,
                ump9: 1.5,
                mp220: 1,
                dp28: 1,
                scar: 0.3,
                m4a1: 0.3,
                mk12: 0.3,
                saiga: 0.3,
            },
            m202: { airdropTier1: 0.05, airdropTier2: 0.05, goldMain: 0.25 },
            goldBonus: { m202: 0.1, "": 0.9 },
            panzerfaustFloor: { panzerfaust: 0.2 },
        });
        expect(OWNER_CLASSIC_FLOOR_MAPS).toEqual(["main", "main_spring", "main_summer"]);
    });
});

describe("move speeds", () => {
    it("the PMG-134: carry -2, equip -1, attack -6 through the rebirth layer (survev equip -1.5, attack -6)", () => {
        expect(GUN_SPEED_OVERRIDES.map((o) => o.id)).toEqual(["potato_lmg"]);
        expect(gameObjects.potato_lmg.speed).toEqual({ equip: -1.5, attack: -6 });
        expect(getDefOfType("gun", "potato_lmg").speed).toEqual({ carry: -2, equip: -1, attack: -6 });
        expect(rebirthDeviations.find((d) => d.id === "potato_lmg" && d.field === "speed")).toMatchObject({
            original: { equip: -1.5, attack: -6 },
            rebirth: { carry: -2, equip: -1, attack: -6 },
        });
        // the DShK's scheme: carried -2, held -3
        const dshk = getDefOfType("gun", "dshk").speed;
        expect([dshk.carry, (dshk.carry ?? 0) + dshk.equip]).toEqual([-2, -3]);
    });

    it("the Barrett M107 and Hécate II keep their held slowdown (equip -1)", () => {
        expect(getDefOfType("gun", "barrett").speed).toEqual({ equip: -1, attack: -4 });
        expect(getDefOfType("gun", "hecate").speed).toEqual({ equip: -1, attack: -3 });
    });

    it("launchers: the M79, GL-06 and Milkor MGL no longer slow their holder; RPG-7, Panzerfaust and M202 do", () => {
        const equip = (id: string) => getDefOfType("gun", id).speed.equip;
        expect(["m79", "gl06", "mgl"].map(equip)).toEqual([0, 0, 0]);
        expect(["rpg7", "panzerfaust", "m202"].map(equip)).toEqual([-2, -1.5, -2.5]);
    });
});

describe("the USAS-12 on the classic floor", () => {
    it("main, spring and summer tier_guns end with the USAS-12 at the PKP's 0.005 (0.005 % of floor gun rolls)", () => {
        for (const map of OWNER_CLASSIC_FLOOR_MAPS) {
            const floor = tables(map).tier_guns;
            // the USAS-12, then the owner's Panzerfaust (M202 / Panzerfaust tests)
            expect(floor.slice(-2), map).toEqual([
                { name: "usas", count: 1, weight: 0.005 },
                { name: "panzerfaust", count: 1, weight: 0.2 },
            ]);
            expect(floor.find((e) => e.name === "pkp")?.weight, map).toBe(0.005);
            expect(percent(floor).usas, map).toBeCloseTo(0.0051, 4);
            expect(generatedMaps[map].lootTable.tier_guns.some((e: LootTableEntry) => e.name === "usas")).toBe(false);
        }
        for (const map of Object.keys(MapDefs).filter((m) => !OWNER_CLASSIC_FLOOR_MAPS.includes(m))) {
            expect(tables(map).tier_guns?.some((e) => e.name === "usas") ?? false, map).toBe(false);
        }
    });
});

describe("the SVD and SCAR-SSR in the gold drop", () => {
    it("main, its seasonal copies and snow: 0.5 each, 1 gold crate in 56 each (1.8 %)", () => {
        expect(Object.keys(REBIRTH_GOLD_GUNS)).toEqual(["main", "main_spring", "main_summer", "snow"]);
        for (const map of Object.keys(REBIRTH_GOLD_GUNS)) {
            const gold = tables(map)[GOLD_DROP_TABLE];
            expect(total(gold), map).toBeCloseTo(28.01, 6);
            expect(
                gold.filter((e) => ["svd", "scarssr"].includes(e.name)),
                map,
            ).toEqual([
                { name: "svd", count: 1, weight: 0.5 },
                { name: "scarssr", count: 1, weight: 0.5 },
            ]);
            expect(percent(gold).svd, map).toBeCloseTo(1.785, 2);
            expect(percent(gold).scarssr, map).toBeCloseTo(1.785, 2);
            // as rare as the new gold snipers, half the Barrett
            expect(gold.find((e) => e.name === "hecate")?.weight, map).toBe(0.5);
            expect(gold.find((e) => e.name === "barrett")?.weight, map).toBe(1);
        }
        // the event maps' gold drops are main's survev table plus the new guns, without these
        for (const map of ["halloween", "turkey", "birthday", "beach", "cobalt", "desert", "woods"]) {
            const names = tables(map)[GOLD_DROP_TABLE].map((e) => e.name);
            expect(names, map).not.toContain("svd");
            expect(names, map).not.toContain("scarssr");
        }
    });
});

describe("the L86A2 in the tier 1 air drop", () => {
    it("main: a low-tier DMR at the MK12's / M39's tier 1 weight, never in tier 2", () => {
        expect(AIRDROP_TIER1_ADDED_DMRS).toEqual({ l86: 1.25 });
        const t = tables("main");
        const weight = (name: string) => t[AIRDROP_TIER1_TABLE].find((e) => e.name === name)?.weight;
        expect(weight("l86")).toBe(1.25);
        expect([weight("mk12"), weight("m39")]).toEqual([1.25, 1.25]);
        expect(t[AIRDROP_TIER2_TABLE].map((e) => e.name)).not.toContain("l86");
        // 1.25 of tier 1's 24.511111 (with its 10 % tier 2 roll): 5.1 % of tier 1 crates
        expect(percent(t[AIRDROP_TIER1_TABLE]).l86).toBeCloseTo(5.1, 2);
        expect(generatedMaps.main.lootTable.tier_airdrop_uncommon.map((e: LootTableEntry) => e.name)).not.toContain(
            "l86",
        );
    });

    it("every tiered map whose floor has DMRs; Savannah keeps its own 0.75; no DMR floor, no L86A2", () => {
        const withL86 = Object.keys(MapDefs).filter((m) =>
            tables(m)[AIRDROP_TIER1_TABLE]?.some((e) => e.name === "l86"),
        );
        expect(withL86).toEqual([
            "main",
            "main_spring",
            "main_summer",
            "desert",
            "halloween",
            "snow",
            "savannah",
            "turkey",
            "birthday",
            "beach",
            "test_normal",
            "test_faction",
        ]);
        for (const m of withL86.filter((x) => x !== "savannah")) {
            expect(tables(m)[AIRDROP_TIER1_TABLE].find((e) => e.name === "l86")?.weight, m).toBe(1.25);
        }
        expect(tables("savannah")[AIRDROP_TIER1_TABLE].find((e) => e.name === "l86")?.weight).toBe(0.75);
    });
});

describe("the bathhouse ring case (case_07, tier_ring_case)", () => {
    it("is only in the bathhouse: case_07 in bathhouse_sideroom_02 (bathhouse_01 in club_structure_01)", () => {
        expect(holders(RING_CASE_TABLE)).toEqual(["case_07"]);
        expect(holders("case_07")).toEqual(["bathhouse_sideroom_02"]);
        expect(holders("bathhouse_sideroom_02")).toEqual(["bathhouse_01"]);
        expect(holders("bathhouse_01")).toEqual(["club_structure_01"]);
        // the desert ring case case_07de rolls the crimson table instead
        expect(mapObjects.case_07de.loot[0].tier).toBe("tier_airdrop_crimson");
        const reached = Object.keys(MapDefs).filter((m) => mapReach(m).tiers.get(RING_CASE_TABLE) === "case_07");
        expect(reached).toEqual([
            "main",
            "main_spring",
            "main_summer",
            "halloween",
            "potato",
            "potato_spring",
            "snow",
            "woods",
            "woods_snow",
            "woods_summer",
            "savannah",
            "cobalt",
            "turkey",
            "beach",
            "test_normal",
            "test_faction",
        ]);
    });

    it("every map but the potato modes: Groza-S 82.5 %, dual OTs-38 16.3 %, PKP 1 %, PMG-134 / M79 0.1 % each", () => {
        for (const map of Object.keys(MapDefs).filter((m) => !POTATO_MODES.includes(m) && m !== "savannah")) {
            const ring = tables(map)[RING_CASE_TABLE];
            expect(
                ring.map((e) => `${e.name}:${e.weight}`),
                map,
            ).toEqual(["grozas:0.825", "ots38_dual:0.163", "pkp:0.01", "potato_lmg:0.001", "m79:0.001"]);
            const p = percent(ring);
            expect(
                [p.grozas, p.ots38_dual, p.pkp, p.potato_lmg, p.m79].map((v) => +v.toFixed(2)),
                map,
            ).toEqual([82.5, 16.3, 1, 0.1, 0.1]);
            // survev's M9 is gone
            expect(
                ring.map((e) => e.name),
                map,
            ).not.toContain("m9");
        }
    });

    it("Savannah's bans drop the Groza-S and the PKP: dual OTs-38 98.8 %, PMG-134 and M79 0.6 % each", () => {
        const ring = tables("savannah")[RING_CASE_TABLE];
        expect(ring.map((e) => e.name)).toEqual(["ots38_dual", "potato_lmg", "m79"]);
        for (const e of ring) expect(LOOT_BANS.savannah).not.toContain(e.name);
        const p = percent(ring);
        expect([p.ots38_dual, p.potato_lmg, p.m79].map((v) => +v.toFixed(1))).toEqual([98.8, 0.6, 0.6]);
    });

    it("the potato modes keep survev's ring case (potato's potato guns; Potato vs Tomato has no bathhouse)", () => {
        for (const map of POTATO_MODES) {
            expect(getMapDef(map).gameMode.potatoMode, map).toBe(true);
            expect(tables(map)[RING_CASE_TABLE], map).toEqual(generatedMaps[map].lootTable[RING_CASE_TABLE]);
        }
        expect(tables("potato")[RING_CASE_TABLE].map((e) => e.name)).toEqual([
            "potato_cannon",
            "potato_smg",
            "potato_lmg",
        ]);
    });

    it("the M79 row follows the new guns' rule: normal loot, there with GUN_BETA off and on", () => {
        // the new guns are placed without the beta (rebirth/newGunLoot.ts: main's floor has the M79 at 0.02), and
        // the beta only appends tier_guns rows
        expect(tables("main").tier_guns.find((e) => e.name === "m79")?.weight).toBe(0.02);
        expect(getGunBetaLootTables("main")[RING_CASE_TABLE]).toEqual(tables("main")[RING_CASE_TABLE]);
    });
});

describe("the club's secret room (club_01: deposit_box_02_club, tier_club_vault)", () => {
    /** The bots' tier of each gun of the club table and of main's floor (packages/bots/src/knowledge/gunTiers.ts). */
    // biome-ignore format: one tier per line
    const TIER: Readonly<Record<string, string>> = {
        m249: "S", pkp: "S", qbb97: "A+", sv98: "A+", usas: "A+",
        scar: "A", m4a1: "A", saiga: "A", spas12: "A", mosin: "A",
        famas: "A-", m870: "A-", mp220: "A-", dp28: "A-", bar: "A-", vector: "A-",
        mk12: "B+", m39: "B+",
        hk416: "B", ak47: "B", groza: "B", mp5: "B", ump9: "B", deagle: "B", scout_elite: "B", vss: "B",
        mac10: "C+", m1100: "C", m93r: "C", ot38: "D", m9: "D", glock: "D",
    };
    const JUNK = ["m9", "ot38", "glock", "m93r", "m1100", "mac10", "flare_gun", "flare_gun_dual"];
    const A_GUNS = ["scar", "m4a1", "mk12", "saiga"];
    /** A child whose weighted type can give a deposit box (survev's or the club's gun box). */
    const isBox = (c: { type: unknown }) =>
        typeof c.type === "object" && Object.keys(c.type as object).some((t) => t.startsWith("deposit_box_02"));
    const boxes = (club: { mapObjects: Array<{ type: unknown; pos: { x: number; y: number } }> }) =>
        club.mapObjects.filter(isBox);

    it("club_01's secret room boxes: deposit_box_01 1 : deposit_box_02_club 1 (survev 3 : 1 deposit_box_02)", () => {
        expect([CLUB_VAULT_BUILDING, CLUB_VAULT_BOX, CLUB_VAULT_TABLE]).toEqual([
            "club_01",
            "deposit_box_02_club",
            "tier_club_vault",
        ]);
        expect(OWNER_LOOT_WEIGHTS.clubVaultBoxes).toEqual({ deposit_box_01: 1, deposit_box_02_club: 1 });
        const club = getMapObjectDefOfType("building", "club_01");
        const original = mapObjects.club_01;
        expect(boxes(original).map((c) => [c.type, c.pos])).toEqual([
            [
                { deposit_box_01: 3, deposit_box_02: 1 },
                { x: -4.25, y: 29.55 },
            ],
            [
                { deposit_box_01: 3, deposit_box_02: 1 },
                { x: 1.25, y: 29.55 },
            ],
        ]);
        expect(boxes(club).map((c) => [c.type, c.pos])).toEqual([
            [
                { deposit_box_01: 1, deposit_box_02_club: 1 },
                { x: -4.25, y: 29.55 },
            ],
            [
                { deposit_box_01: 1, deposit_box_02_club: 1 },
                { x: 1.25, y: 29.55 },
            ],
        ]);
        // nothing else of the club changes: the puzzle, the secret door and club_vault (the machete) are survev's
        const boxAt = new Set(club.mapObjects.map((c, i) => (isBox(c) ? i : -1)).filter((i) => i >= 0));
        expect(club.mapObjects.filter((_, i) => !boxAt.has(i))).toEqual(
            original.mapObjects.filter((_: unknown, i: number) => !boxAt.has(i)),
        );
        expect({ ...club, mapObjects: original.mapObjects }).toEqual(original);
        expect(MapObjectDefs.club_vault).toEqual(mapObjects.club_vault);
        // a gun box comes up 50 % of the time per box (survev 25 %): at least one of the two 75 % (survev 43.75 %)
        expect(1 - 0.5 ** 2).toBe(0.75);
        expect(1 - 0.75 ** 2).toBe(0.4375);
    });

    it("deposit_box_02_club is deposit_box_02 with its gun from tier_club_vault; deposit_box_02 is untouched", () => {
        const box = getMapObjectDefOfType("obstacle", CLUB_VAULT_BOX);
        expect(box.loot.map((l) => `${l.tier} ${l.min}-${l.max}`)).toEqual([
            "tier_soviet 1-2",
            `${CLUB_VAULT_TABLE} 1-1`,
        ]);
        expect({ ...box, loot: mapObjects.deposit_box_02.loot }).toEqual(mapObjects.deposit_box_02);
        expect(mapObjects[CLUB_VAULT_BOX]).toBeUndefined();
        // deposit_box_02 is shared with vault_01, vault_01b, the bathhouse and the Reserve
        expect(MapObjectDefs.deposit_box_02).toEqual(mapObjects.deposit_box_02);
        expect(holders("deposit_box_02")).toEqual([
            "vault_01",
            "vault_01b",
            "club_01",
            "bathhouse_sideroom_02",
            "reserve_01",
            "reserve_vault_01",
        ]);
        expect(MapObjectDefs.deposit_box_01).toEqual(mapObjects.deposit_box_01);
        // the bathhouse's containers but its ring case keep survev's loot
        for (const id of ["bathhouse_sideroom_02", "mil_crate_04", "crate_04"]) {
            expect(MapObjectDefs[id], id).toEqual(mapObjects[id]);
        }
        // every map can resolve the box's rolls
        for (const map of Object.keys(MapDefs)) {
            for (const l of box.loot) expect(Object.hasOwn(tables(map), l.tier!), `${map} ${l.tier}`).toBe(true);
        }
    });

    it("main: slightly better than tier_guns, mostly AK / HK416 / MP5 / M870 class, 4.3 % an A gun, nothing S", () => {
        const vault = tables("main")[CLUB_VAULT_TABLE];
        const p = percent(vault);
        expect(+total(vault).toFixed(6)).toBe(28.2);
        // the base: AK-47, HK416, MP5, M870 14.2 % each; FAMAS, Groza, SPAS-12 8.9 % each
        for (const g of ["hk416", "ak47", "mp5", "m870"]) expect(p[g], g).toBeCloseTo(14.18, 2);
        for (const g of ["famas", "groza", "spas12"]) expect(p[g], g).toBeCloseTo(8.87, 2);
        expect(share(vault, ["hk416", "ak47", "mp5", "m870", "famas", "groza", "spas12"])).toBeCloseTo(0.8333, 4);
        // the A guns: SCAR-H, M4A1, MK12, Saiga-12 1.06 % each
        expect(share(vault, A_GUNS)).toBeCloseTo(0.0426, 4);
        // nothing S or A+, no junk
        for (const e of vault) {
            expect(["S", "S-aim", "A+"], e.name).not.toContain(TIER[e.name]);
            expect(TIER[e.name], e.name).toBeDefined();
        }
        for (const g of JUNK) expect(p[g], g).toBeUndefined();
        // against main's floor: every club roll is a B or better gun; most floor rolls are not
        const floor = tables("main").tier_guns;
        const bOrBetter = (t: readonly LootTableEntry[]) =>
            share(
                t,
                t.filter((e) => ["S", "A+", "A", "A-", "B+", "B"].includes(TIER[e.name])).map((e) => e.name),
            );
        expect(bOrBetter(vault)).toBe(1);
        expect(bOrBetter(floor)).toBeLessThan(0.5);
        // per secret room: an A gun from at least one of the two boxes 4.2 % of the time (each a gun box half the time)
        expect(1 - (1 - 0.5 * share(vault, A_GUNS)) ** 2).toBeCloseTo(0.0422, 3);
    });

    it("other maps keep their floor rules: Desert no 9mm, Woods shotguns and LMGs, Savannah's bans", () => {
        const names = (map: string) => tables(map)[CLUB_VAULT_TABLE].map((e) => e.name);
        expect(names("desert")).toEqual([
            "hk416",
            "ak47",
            "m870",
            "famas",
            "groza",
            "spas12",
            "mp220",
            "dp28",
            "scar",
            "m4a1",
            "mk12",
            "saiga",
        ]);
        for (const map of ["woods", "woods_snow", "woods_spring", "woods_summer"]) {
            expect(names(map), map).toEqual(["m870", "spas12", "mp220", "dp28", "saiga"]);
        }
        // Savannah: MP5 65.6 %, UMP9 24.6 %, SCAR-H and MK12 4.9 % each
        const sv = tables("savannah")[CLUB_VAULT_TABLE];
        expect(names("savannah")).toEqual(["mp5", "ump9", "scar", "mk12"]);
        expect(Object.values(percent(sv)).map((v) => +v.toFixed(1))).toEqual([65.6, 24.6, 4.9, 4.9]);
        for (const map of ["main_spring", "main_summer", "snow", "halloween", "cobalt", "turkey", "beach"]) {
            expect(tables(map)[CLUB_VAULT_TABLE], map).toEqual(tables("main")[CLUB_VAULT_TABLE]);
        }
        // the club stands where the bathhouse does (club_complex_01)
        const withClub = Object.keys(MapDefs).filter((m) => mapReach(m).tiers.has(CLUB_VAULT_TABLE));
        expect(withClub).toEqual(Object.keys(MapDefs).filter((m) => mapReach(m).tiers.get(RING_CASE_TABLE)));
    });

    it("the potato modes keep survev's gun roll: one nested tier_guns roll (GUN_BETA rows included)", () => {
        for (const map of POTATO_MODES) {
            expect(tables(map)[CLUB_VAULT_TABLE], map).toEqual([{ name: "tier_guns", count: 1, weight: 1 }]);
        }
    });
});

describe("the M202 FLASH and the Panzerfaust (owner, 2026-10-08)", () => {
    it("the M202: barely ever in a normal air drop, now and then the gold drop's main gun", () => {
        const t = tables("main");
        const w = (tier: string) => t[tier].find((e) => e.name === "m202")?.weight;
        expect([w(AIRDROP_TIER1_TABLE), w(AIRDROP_TIER2_TABLE), w(GOLD_DROP_TABLE)]).toEqual([0.05, 0.05, 0.25]);
        // 0.2 % of main's tier 1 crates, 0.29 % of its tier 2 crates (the sheet's tier 2 had 0.2: 1.2 %)
        expect(percent(t[AIRDROP_TIER1_TABLE]).m202).toBeCloseTo(0.204, 3);
        expect(percent(t[AIRDROP_TIER2_TABLE]).m202).toBeCloseTo(0.293, 3);
        // the main gun of 1 gold crate in 112 (0.9 %)
        expect(percent(t[GOLD_DROP_TABLE]).m202).toBeCloseTo(0.893, 3);
    });

    it("the gold crates roll a bonus item last: the M202 1 time in 10, else nothing; none in the potato modes", () => {
        expect(GOLD_BONUS_CRATES).toEqual(["crate_11", "crate_11de", "crate_11sv", "crate_11tr", "crate_11h"]);
        for (const id of GOLD_BONUS_CRATES) {
            const crate = getMapObjectDefOfType("obstacle", id);
            expect(crate.loot[0].tier, id).toBe(GOLD_DROP_TABLE);
            expect(crate.loot.at(-1), id).toEqual({ tier: GOLD_BONUS_TABLE, min: 1, max: 1, props: {} });
            expect(crate.loot.slice(0, -1).length, id).toBe(mapObjects[id].loot.length);
        }
        for (const map of Object.keys(MapDefs)) {
            const bonus = tables(map)[GOLD_BONUS_TABLE];
            if (POTATO_MODES.includes(map)) expect(bonus, map).toEqual([{ name: "", count: 1, weight: 1 }]);
            else
                expect(bonus, map).toEqual([
                    { name: "m202", count: 1, weight: 0.1 },
                    { name: "", count: 1, weight: 0.9 },
                ]);
        }
        // the 50v50 military crates and every other crate keep their loot list
        expect(getMapObjectDefOfType("obstacle", "crate_13").loot.map((l) => l.tier)).not.toContain(GOLD_BONUS_TABLE);
    });

    it("the Panzerfaust: 0.2 on the floor of every map but the potato modes whose floor has the flare gun", () => {
        const withPanzerfaust = Object.keys(MapDefs).filter((m) =>
            tables(m).tier_guns.some((e) => e.name === "panzerfaust"),
        );
        expect(withPanzerfaust).toEqual(
            Object.keys(MapDefs).filter(
                (m) => !POTATO_MODES.includes(m) && tables(m).tier_guns.some((e) => e.name === "flare_gun"),
            ),
        );
        expect(withPanzerfaust).toEqual([
            "main",
            "main_spring",
            "main_summer",
            "desert",
            "faction",
            "halloween",
            "snow",
            "savannah",
            "cobalt",
            "turkey",
            "beach",
            "test_normal",
            "test_faction",
        ]);
        for (const map of withPanzerfaust) {
            const floor = tables(map).tier_guns;
            expect(
                floor.filter((e) => e.name === "panzerfaust"),
                map,
            ).toEqual([{ name: "panzerfaust", count: 1, weight: 0.2 }]);
        }
        // a little above the flare gun's 0.145: 0.2 % of main's floor gun rolls
        const main = tables("main").tier_guns;
        expect(main.find((e) => e.name === "flare_gun")?.weight).toBe(0.145);
        expect(percent(main).panzerfaust).toBeCloseTo(0.204, 3);
        // normal loot: GUN_BETA only adds rows on top
        expect(getGunBetaLootTables("main").tier_guns.slice(0, main.length)).toEqual(main);
    });
});
