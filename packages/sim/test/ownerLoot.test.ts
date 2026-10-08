// The owner's club and bathhouse loot of 2026-10-08 through the simulation (defs rebirth/ownerLoot.ts,
// ownerLootWeights.ts): the bathhouse's red ring case (case_07) drops at the owner's weights on main, the club's secret
// room boxes are generated at the owner's odds with the club's own gun box (deposit_box_02_club), which drops the
// owner's club guns, and the potato modes keep survev's rolls.
import { createRng } from "@rebirth/core";
import { CLUB_VAULT_BOX, CLUB_VAULT_TABLE, getMapDef, getMapObjectDefOfType, OWNER_LOOT_WEIGHTS } from "@rebirth/defs";
import { describe, expect, it } from "vitest";
import { rollLootList } from "../src/loot/lootTable.ts";
import { cachedMap } from "./helpers.ts";

/**
 * Item counts of `n` breaks of map object `id` on `map` (seeded); with `tier`, only the rolls of that loot entry (a
 * deposit box's tier_soviet roll can give a floor gun too).
 */
function breakMany(map: string, id: string, n: number, tier?: string): Map<string, number> {
    const tables = getMapDef(map).lootTable;
    const loot = getMapObjectDefOfType("obstacle", id).loot.filter((l) => !tier || l.tier === tier);
    expect(loot.length, `${id} ${tier}`).toBeGreaterThan(0);
    const rng = createRng(20261008);
    const counts = new Map<string, number>();
    for (let i = 0; i < n; i++) {
        for (const item of rollLootList(tables, loot, rng, (t) => expect.fail(`unknown tier ${t}`))) {
            counts.set(item.type, (counts.get(item.type) ?? 0) + 1);
        }
    }
    return counts;
}

describe("the bathhouse ring case on main", () => {
    it("Groza-S about 82.5 %, dual OTs-38 16.3 %, PKP 1 %, the PMG-134 and M79 now and then", () => {
        const n = 50_000;
        const counts = breakMany("main", "case_07", n);
        const share = (g: string) => (counts.get(g) ?? 0) / n;
        expect([...counts.keys()].sort()).toEqual(Object.keys(OWNER_LOOT_WEIGHTS.ringCase).sort());
        expect(share("grozas")).toBeCloseTo(0.825, 2);
        expect(share("ots38_dual")).toBeCloseTo(0.163, 2);
        expect(share("pkp")).toBeGreaterThan(0.007);
        expect(share("pkp")).toBeLessThan(0.013);
        for (const g of ["potato_lmg", "m79"]) {
            expect(share(g), g).toBeGreaterThan(0.0004);
            expect(share(g), g).toBeLessThan(0.002);
        }
        expect(counts.has("m9")).toBe(false);
    });
});

describe("the club's secret room", () => {
    it("generated boxes: deposit_box_01 or the club's gun box, about half each; never survev's deposit_box_02", () => {
        const types = new Map<string, number>();
        for (let seed = 1; seed <= 12; seed++) {
            const { objects } = cachedMap("main", seed);
            const clubs = new Set(objects.filter((o) => o.type === "club_01").map((o) => o.id));
            expect(clubs.size, `seed ${seed}`).toBe(1);
            for (const o of objects.filter((x) => clubs.has(x.parentId) && x.type.startsWith("deposit_box"))) {
                types.set(o.type, (types.get(o.type) ?? 0) + 1);
            }
        }
        // two boxes per club
        expect([...types.values()].reduce((a, b) => a + b, 0)).toBe(24);
        expect([...types.keys()].sort()).toEqual(["deposit_box_01", CLUB_VAULT_BOX]);
        expect(types.get(CLUB_VAULT_BOX)).toBeGreaterThan(4);
    });

    it("the club's gun box: one owner club gun (4.3 % an A gun) and survev's 1-2 tier_soviet items", () => {
        const n = 20_000;
        const box = getMapObjectDefOfType("obstacle", CLUB_VAULT_BOX);
        expect(box.loot.map((l) => `${l.tier} ${l.min}-${l.max}`)).toEqual([
            "tier_soviet 1-2",
            `${CLUB_VAULT_TABLE} 1-1`,
        ]);
        const guns = breakMany("main", CLUB_VAULT_BOX, n, CLUB_VAULT_TABLE);
        expect([...guns.keys()].sort()).toEqual(Object.keys(OWNER_LOOT_WEIGHTS.clubVault).sort());
        expect([...guns.values()].reduce((a, b) => a + b, 0)).toBe(n);
        const aGuns = ["scar", "m4a1", "mk12", "saiga"].reduce((s, g) => s + (guns.get(g) ?? 0), 0) / n;
        expect(aGuns).toBeCloseTo(0.0426, 2);
        expect((guns.get("ak47") ?? 0) / n).toBeCloseTo(4 / 28.2, 2);
        // the soviet roll is survev's: 1-2 items of the floor guns, armour and packs
        const soviet = [...breakMany("main", CLUB_VAULT_BOX, n, "tier_soviet").values()].reduce((a, b) => a + b, 0);
        expect(soviet / n).toBeGreaterThan(1.3);
        expect(soviet / n).toBeLessThan(1.7);
    });

    it("the potato modes keep survev's rolls: potato guns in the ring case, floor guns in the club's gun box", () => {
        const ring = breakMany("potato", "case_07", 2000);
        expect([...ring.keys()].sort()).toEqual(["potato_cannon", "potato_lmg", "potato_smg"]);
        const floor = new Set(getMapDef("potato").lootTable.tier_guns.map((e) => e.name));
        const guns = breakMany("potato", CLUB_VAULT_BOX, 2000, CLUB_VAULT_TABLE);
        for (const g of guns.keys()) expect(floor.has(g), g).toBe(true);
        // survev's floor roll, junk included: the M9 is the floor's commonest gun and in no owner table
        expect(guns.get("m9")).toBeGreaterThan(100);
        expect(Object.keys(OWNER_LOOT_WEIGHTS.clubVault)).not.toContain("m9");
    });
});
