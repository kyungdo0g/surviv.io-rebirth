// Unit tests of the port policy (lib/policy.ts), the survev-only game objects and skins (lib/objects.ts) and the
// survev placements of ported items (lib/survevLoot.ts), on synthetic data.
import { describe, expect, it } from "vitest";
import { portGameConfig, portGameObjects } from "./lib/objects.ts";
import { parsePolicy } from "./lib/policy.ts";
import { keepSurvevPlacements, restoreSurvevPlacements } from "./lib/survevLoot.ts";

const policy = parsePolicy({
    survevOnlyGameObjects: ["barrett", "bullet_barrett"],
    survevSkins: { awc_winter: "awc" },
    survevGameConfig: ["bagSizes.50AE"],
});

describe("port policy", () => {
    it("rejects unknown keys and an id listed twice", () => {
        expect(() => parsePolicy({ survevOnlyGameObject: [] })).toThrow(/unknown keys/);
        expect(() => parsePolicy({ survevOnlyGameObjects: ["a"], survevSkins: { a: "b" } })).toThrow(/both/);
    });

    it("appends the survev-only ids after the original ones in survev order; a skin keeps its base's stats", () => {
        const live = { awc: { type: "gun", damage: 180, worldImg: { sprite: "gun-awc-01.img", scale: 0.5 } } };
        const survev = {
            bullet_barrett: { type: "bullet", damage: 99 },
            awc: { type: "gun", damage: 999, worldImg: { sprite: "gun-awc-01.img", scale: 0.5 } },
            barrett: { type: "gun", bulletType: "bullet_barrett" },
            awc_winter: {
                type: "gun",
                damage: 999,
                worldImg: { sprite: "gun-awc-02.img", scale: 0.5 },
                baseType: "awc",
            },
            iceaxe: { type: "melee" },
        };
        const out = portGameObjects(live, survev, policy);
        expect(Object.keys(out.defs)).toEqual(["awc", "bullet_barrett", "barrett", "awc_winter"]);
        expect(out.status).toEqual({
            awc: "original",
            bullet_barrett: "survev-only",
            barrett: "survev-only",
            awc_winter: "survev-only",
        });
        // the original awc's damage (180), survev's winter image and baseType
        expect(out.defs.awc_winter).toEqual({
            type: "gun",
            damage: 180,
            worldImg: { sprite: "gun-awc-02.img", scale: 0.5 },
            baseType: "awc",
        });
        expect(out.excluded).toEqual(["iceaxe"]);
        expect(() => portGameObjects(live, {}, policy)).toThrow(/not a survev game object/);
    });

    it("takes the policy's GameConfig paths from survev, cut to the original's length", () => {
        const live = { bagSizes: { "50AE": [49, 98, 147, 196], "9mm": [120, 240, 330, 420] } };
        const survev = { bagSizes: { "50AE": [50, 100, 150, 200, 250], "9mm": [120, 240, 330, 420, 510] } };
        const out = portGameConfig(live, survev, { "50AE": {}, "9mm": {} }, policy.survevGameConfig);
        expect(out.config.bagSizes).toEqual({ "50AE": [50, 100, 150, 200], "9mm": [120, 240, 330, 420] });
        expect(out.survev).toEqual([
            { path: "bagSizes.50AE", original: [49, 98, 147, 196], survev: [50, 100, 150, 200] },
        ]);
    });

    it("cuts survev-only bag rows to the original's levels and prunes rows of items not ported", () => {
        const live = { bagSizes: { "9mm": [120, 240, 330, 420] } };
        const survev = { bagSizes: { coconut: [3, 6, 9, 12, 15], tomato: [10, 20, 30, 40, 50] } };
        const out = portGameConfig(live, survev, { "9mm": {}, coconut: {} });
        expect(out.config.bagSizes).toEqual({ "9mm": [120, 240, 330, 420], coconut: [3, 6, 9, 12] });
        expect(out.prunes).toEqual([
            { path: "bagSizes.tomato", reason: "item not in the ported game objects" },
            { path: "bagSizes.coconut", reason: "cut to the original's 4 backpack levels" },
        ]);
    });
});

describe("survev placements of ported items", () => {
    const mapNames = ["main", "snow"];
    const entries = [
        {
            section: "lootTables",
            target: "main.lootTable.tier_airdrop_mythic[barrett]",
            forkValue: 1,
            originalValue: "absent",
        },
        // a skin swapped for its base: both entries stay unapplied
        {
            section: "lootTables",
            target: "snow.lootTable.tier_eye_block[awc_winter]",
            forkValue: 0.75,
            originalValue: "absent",
        },
        { section: "lootTables", target: "snow.lootTable.tier_eye_block[awc]", forkValue: "absent", originalValue: 1 },
        // the base elsewhere, or a reweight, is reverted as before
        { section: "lootTables", target: "main.lootTable.tier_eye_block[awc]", forkValue: "absent", originalValue: 1 },
        { section: "lootTables", target: "snow.lootTable.tier_eye_block[pkp]", forkValue: 0.75, originalValue: 1 },
        { section: "stats", target: "bullet_barrett.damage", forkValue: 99, originalValue: "absent" },
    ];

    it("skips the revert entries of ported items and of the base a ported skin replaced", () => {
        const ported = new Set(["barrett", "bullet_barrett", "awc_winter"]);
        const { apply, skipped } = keepSurvevPlacements(entries, ported, { awc_winter: "awc" }, mapNames);
        expect(skipped.map((s) => s.entry.target)).toEqual([
            "main.lootTable.tier_airdrop_mythic[barrett]",
            "snow.lootTable.tier_eye_block[awc_winter]",
            "snow.lootTable.tier_eye_block[awc]",
        ]);
        expect(skipped.every((s) => s.status === "skipped" && s.reason.includes("policy.json"))).toBe(true);
        expect((apply as typeof entries).map((e) => e.target)).toEqual([
            "main.lootTable.tier_eye_block[awc]",
            "snow.lootTable.tier_eye_block[pkp]",
            "bullet_barrett.damage",
        ]);
    });

    it("restores survev's entries a rebuilt table lost, unless banned or already there", () => {
        const maps = {
            savannah: { lootTable: { tier_guns: [{ name: "mosin", count: 1, weight: 1 }], tier_x: [] as any[] } },
        };
        const survevMaps = {
            savannah: {
                lootTable: {
                    tier_guns: [
                        { name: "mosin", count: 1, weight: 9 },
                        { name: "barrett", count: 1, weight: 0.06 },
                        { name: "ash12", count: 1, weight: 1 },
                    ],
                    tier_missing: [{ name: "barrett", count: 1, weight: 1 }],
                },
            },
        };
        const log = restoreSurvevPlacements(maps, survevMaps, new Set(["barrett", "ash12"]), { savannah: ["ash12"] });
        expect(maps.savannah.lootTable.tier_guns).toEqual([
            { name: "mosin", count: 1, weight: 1 },
            { name: "barrett", count: 1, weight: 0.06 },
        ]);
        expect(log).toEqual([
            { map: "savannah", tier: "tier_guns", item: "barrett", weight: 0.06, reason: "survev placement restored" },
        ]);
    });
});
