// Unit tests of the balance-revert resolver on synthetic data.
import { describe, expect, it } from "vitest";
import { applyBalanceRevert, type RevertContext } from "./lib/balance.ts";

function context(): RevertContext {
    const map = () => ({
        lootTable: {
            tier_guns: [
                { name: "mp220", count: 1, weight: 2 },
                { name: "spas12", count: 1, weight: 2.5 },
                { name: "barrett", count: 1, weight: 1 },
            ],
        },
        mapGen: {
            fixedSpawns: [{ warehouse_01: { small: 1, large: 2 }, warehouse_03: 1 }],
            densitySpawns: [{}],
            spawnReplacements: [{}],
        },
        gameConfig: { planes: { crates: [] }, bleedDamage: 2 },
    });
    return {
        maps: { main: map(), desert: map() },
        gameConfig: { player: { moveSpeed: 12 }, bagSizes: { "9mm": [120, 240, 330, 420] } },
        originalGameConfigPaths: new Set(["bagSizes", "bagSizes.9mm"]),
        gameObjects: { ak47: { type: "gun", fireDelay: 0.1 } },
        mapObjects: { barrel_01: { type: "obstacle" }, oasis_01: { type: "building", ori: 0 } },
        mapObjectStatus: { oasis_01: "survev-only" },
    };
}

const entry = (e: Record<string, unknown>) => ({ confidence: "H", line: 1, note: "", ...e });

describe("applyBalanceRevert", () => {
    it("reverts a loot weight in one map", () => {
        const ctx = context();
        const [log] = applyBalanceRevert(
            [
                entry({
                    section: "lootTables",
                    target: "main.tier_guns",
                    field: "mp220",
                    forkValue: 2,
                    originalValue: 1.5,
                }),
            ],
            ctx,
        );
        expect(log.status).toBe("applied");
        expect(ctx.maps.main.lootTable.tier_guns[0].weight).toBe(1.5);
        expect(ctx.maps.desert.lootTable.tier_guns[0].weight).toBe(2);
    });

    it("applies to every map still holding the fork value when no map is named", () => {
        const ctx = context();
        ctx.maps.desert.lootTable.tier_guns[1].weight = 7;
        const [log] = applyBalanceRevert(
            [
                entry({
                    section: "lootTables",
                    target: "tier_guns",
                    field: "spas12.weight",
                    forkValue: 2.5,
                    originalValue: 3,
                }),
            ],
            ctx,
        );
        expect(log.status).toBe("applied");
        expect(log.targets).toEqual(["maps.main.lootTable.tier_guns.spas12"]);
        expect(ctx.maps.desert.lootTable.tier_guns[1].weight).toBe(7);
    });

    it("removes fork additions and re-adds fork removals", () => {
        const ctx = context();
        const logs = applyBalanceRevert(
            [
                entry({
                    section: "lootTables",
                    target: "main.tier_guns",
                    field: "barrett",
                    forkValue: 1,
                    originalValue: "absent",
                }),
                entry({
                    section: "lootTables",
                    target: "main:tier_guns",
                    field: "m870",
                    forkValue: "absent",
                    originalValue: 9,
                }),
                entry({
                    section: "mapSpawns",
                    target: "main",
                    field: "fixedSpawns.warehouse_03",
                    forkValue: 1,
                    originalValue: "removed",
                }),
                entry({
                    section: "mapSpawns",
                    target: "main.mapGen.fixedSpawns",
                    field: "warehouse_01",
                    originalValue: { small: 1, large: 1 },
                }),
            ],
            ctx,
        );
        expect(logs.map((l) => l.status)).toEqual(["applied", "applied", "applied", "applied"]);
        expect(ctx.maps.main.lootTable.tier_guns.map((e: any) => e.name)).toEqual(["mp220", "spas12", "m870"]);
        expect(ctx.maps.main.lootTable.tier_guns[2]).toEqual({ name: "m870", count: 1, weight: 9 });
        expect(ctx.maps.main.mapGen.fixedSpawns[0]).toEqual({ warehouse_01: { small: 1, large: 1 } });
    });

    it("reverts survev-only GameConfig keys and survev-only map objects", () => {
        const ctx = context();
        const logs = applyBalanceRevert(
            [
                entry({
                    section: "other",
                    target: "GameConfig.player",
                    field: "moveSpeed",
                    forkValue: 12,
                    originalValue: 11,
                }),
                entry({ section: "other", target: "oasis_01", field: "ori", originalValue: 1 }),
            ],
            ctx,
        );
        expect(logs.map((l) => l.status)).toEqual(["applied", "applied"]);
        expect(ctx.gameConfig.player.moveSpeed).toBe(11);
        expect(ctx.mapObjects.oasis_01.ori).toBe(1);
    });

    it("never touches original client data and skips what it cannot apply", () => {
        const ctx = context();
        const logs = applyBalanceRevert(
            [
                entry({ section: "guns", target: "ak47", field: "fireDelay", originalValue: 0.09 }),
                entry({ section: "other", target: "ak47", field: "fireDelay", originalValue: 0.09 }),
                entry({ section: "other", target: "barrel_01", field: "health", originalValue: 1 }),
                entry({ section: "other", target: "GameConfig.bagSizes", field: "9mm", originalValue: [1, 2, 3, 4] }),
                entry({ section: "perks", target: "steelskin", field: "damageReduction", originalValue: 0.5 }),
                entry({ section: "lootTables", target: "main.tier_guns", field: "mp220", originalValue: "unknown" }),
                entry({
                    section: "lootTables",
                    target: "main.tier_guns",
                    field: "mp220",
                    forkValue: 9,
                    originalValue: 1,
                }),
                { section: "lootTables" },
            ],
            ctx,
        );
        expect(logs.every((l) => l.status === "skipped")).toBe(true);
        expect(logs.map((l) => l.reason)).toEqual([
            expect.stringMatching(/client data/),
            expect.stringMatching(/game object ak47/),
            expect.stringMatching(/map object barrel_01/),
            expect.stringMatching(/original client/),
            expect.stringMatching(/not resolvable/),
            expect.stringMatching(/not concrete/),
            expect.stringMatching(/neither forkValue/),
            expect.stringMatching(/malformed/),
        ]);
        expect(ctx.gameObjects.ak47.fireDelay).toBe(0.1);
        expect(ctx.maps.main.lootTable.tier_guns[0].weight).toBe(2);
    });
});

describe("research file entry shapes", () => {
    it("handles [name] selectors, maps lists, count pseudo-fields and JSON-encoded values", () => {
        const ctx = context();
        ctx.maps.main.gameConfig.unlocks = { timings: [{ type: "bunker_01", circleIdx: 1, wait: 30 }] };
        const logs = applyBalanceRevert(
            [
                entry({
                    section: "lootTables",
                    target: "main.lootTable.tier_guns[spas12]",
                    field: "weight",
                    forkValue: 2.5,
                    originalValue: "3",
                    maps: ["main", "desert", "no_such_map"],
                }),
                entry({
                    section: "lootTables",
                    target: "main.lootTable.tier_guns[barrett]",
                    field: "weight",
                    originalValue: "absent (fork)",
                }),
                entry({
                    section: "mapSpawns",
                    target: "desert.mapGen.fixedSpawns.warehouse_03",
                    field: "count",
                    forkValue: 1,
                    originalValue: 3,
                }),
                entry({
                    section: "mapSpawns",
                    target: "desert.mapGen.fixedSpawns.warehouse_01",
                    field: "count",
                    originalValue: '{"small":2,"large":3}',
                }),
                entry({
                    section: "mapSpawns",
                    target: "desert.mapGen.densitySpawns.stone_01",
                    field: "count",
                    forkValue: "absent",
                    originalValue: 350,
                }),
                entry({
                    section: "other",
                    target: "main.gameConfig.unlocks.timings[bunker_01].wait",
                    field: "wait",
                    originalValue: 5,
                }),
            ],
            ctx,
        );
        expect(logs.map((l) => l.status)).toEqual(["applied", "applied", "applied", "applied", "applied", "applied"]);
        expect(logs[0].targets).toEqual([
            "maps.main.lootTable.tier_guns.spas12",
            "maps.desert.lootTable.tier_guns.spas12",
        ]);
        expect(ctx.maps.main.lootTable.tier_guns.map((e: any) => e.name)).toEqual(["mp220", "spas12"]);
        expect(ctx.maps.desert.mapGen.fixedSpawns[0]).toEqual({
            warehouse_01: { small: 2, large: 3 },
            warehouse_03: 3,
        });
        expect(ctx.maps.desert.mapGen.densitySpawns[0]).toEqual({ stone_01: 350 });
        expect(ctx.maps.main.gameConfig.unlocks.timings[0].wait).toBe(5);
    });

    it("rejects map spawn reverts naming map objects that do not exist", () => {
        const ctx = { ...context(), knownMapObjects: new Set(["house_red_01", "warehouse_01", "warehouse_03"]) };
        const logs = applyBalanceRevert(
            [
                entry({
                    section: "mapSpawns",
                    target: "mapGen.spawnReplacements.house_red_01",
                    field: "replacement",
                    forkValue: "absent",
                    originalValue: '"house_red_01b"',
                    maps: ["main"],
                }),
                entry({
                    section: "mapSpawns",
                    target: "main.mapGen.fixedSpawns.no_such_building",
                    field: "count",
                    forkValue: "absent",
                    originalValue: 1,
                }),
            ],
            ctx,
        );
        expect(logs.map((l) => l.status)).toEqual(["skipped", "skipped"]);
        expect(logs[0].reason).toMatch(/house_red_01b, a map object neither source defines/);
        expect(logs[1].reason).toMatch(/no_such_building/);
    });

    it("skips descriptions, multi-field entries and client sections", () => {
        const logs = applyBalanceRevert(
            [
                entry({
                    section: "roles",
                    target: "leader.defaultItems.inventory",
                    field: "bandage",
                    originalValue: "8xscope only",
                }),
                entry({
                    section: "other",
                    target: "main.gameConfig.unlocks",
                    field: "circleIdx/wait",
                    originalValue: 2,
                }),
                entry({
                    section: "stats",
                    target: "bullet_an94.damage",
                    field: "damage",
                    forkValue: 20,
                    originalValue: 17.5,
                }),
                entry({
                    section: "perks",
                    target: "PerkProperties.steelskin.damageReduction",
                    field: "damageReduction",
                    originalValue: 0.5,
                }),
            ],
            context(),
        );
        expect(logs.map((l) => l.reason)).toEqual([
            expect.stringMatching(/not concrete/),
            expect.stringMatching(/several fields/),
            expect.stringMatching(/client data/),
            expect.stringMatching(/not resolvable/),
        ]);
    });
});
