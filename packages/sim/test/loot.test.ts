import { createRng, v2 } from "@rebirth/core";
import { GameConfig, getDefOfType, getMapDef, Input, WeaponSlot } from "@rebirth/defs";
import { describe, expect, it } from "vitest";
import { Game, type Loot, pickEntry, rollLootList, rollTier } from "../src/index.ts";
import { flatGame, giveGun, openSpot, send, spawnAt, steps } from "./combatHelpers.ts";

const TABLES = getMapDef("main").lootTable;

/** Chi-square statistic of observed counts against weights; categories expected below 5 are pooled. */
function chiSquare(observed: Map<string, number>, weights: Map<string, number>, n: number) {
    const total = [...weights.values()].reduce((a, b) => a + b, 0);
    let stat = 0;
    let df = -1;
    let pooledObs = 0;
    let pooledExp = 0;
    for (const [key, w] of weights) {
        const exp = (w / total) * n;
        const obs = observed.get(key) ?? 0;
        if (exp < 5) {
            pooledObs += obs;
            pooledExp += exp;
            continue;
        }
        stat += (obs - exp) ** 2 / exp;
        df++;
    }
    if (pooledExp > 0) {
        stat += (pooledObs - pooledExp) ** 2 / pooledExp;
        df++;
    }
    return { stat, df };
}

/** Upper 0.1 % critical value of chi-square (Wilson-Hilferty approximation). */
function chiCritical(df: number): number {
    const z = 3.09;
    return df * (1 - 2 / (9 * df) + z * Math.sqrt(2 / (9 * df))) ** 3;
}

describe("loot tables", () => {
    it("rolls tier_guns in proportion to its weights (chi-square, 100k seeded rolls)", () => {
        const rng = createRng(2024);
        const table = TABLES.tier_guns;
        const n = 100_000;
        const observed = new Map<string, number>();
        for (let i = 0; i < n; i++) {
            const e = pickEntry(table, rng)!;
            observed.set(e.name, (observed.get(e.name) ?? 0) + 1);
        }
        const weights = new Map(table.map((e) => [e.name, e.weight]));
        const { stat, df } = chiSquare(observed, weights, n);
        expect(df).toBeGreaterThan(15);
        expect(stat).toBeLessThan(chiCritical(df));
    });

    it("follows nested tiers: tier_world sub-tables in proportion to their weights", () => {
        const rng = createRng(99);
        const n = 100_000;
        const subOf = new Map<string, string>();
        for (const e of TABLES.tier_world) {
            for (const sub of TABLES[e.name] ?? []) subOf.set(sub.name, e.name);
        }
        const observed = new Map<string, number>();
        let empty = 0;
        for (let i = 0; i < n; i++) {
            const item = rollTier(TABLES, "tier_world", rng);
            if (!item) {
                empty++;
                continue;
            }
            expect(item.name.startsWith("tier_")).toBe(false);
            const sub = subOf.get(item.name) ?? "?";
            observed.set(sub, (observed.get(sub) ?? 0) + 1);
        }
        expect(empty).toBe(0);
        const weights = new Map(TABLES.tier_world.map((e) => [e.name, e.weight]));
        // ammo and scope ids also appear in other sub-tables, so compare with a loose bound per table
        for (const [tier, w] of weights) {
            const expected = (w / [...weights.values()].reduce((a, b) => a + b, 0)) * n;
            expect(Math.abs((observed.get(tier) ?? 0) - expected)).toBeLessThan(Math.max(0.05 * expected, 400));
        }
    });

    it("rolls tierLoot min..max times and passes autoLoot through", () => {
        const rng = createRng(5);
        const items = rollLootList(
            TABLES,
            [
                { tier: "tier_ammo", min: 3, max: 3 },
                { type: "ak47", count: 1 },
            ],
            rng,
        );
        expect(items).toHaveLength(4);
        expect(items[3]).toEqual({ type: "ak47", count: 1, preload: false });
        for (const it of items.slice(0, 3)) expect(["9mm", "762mm", "556mm", "12gauge"]).toContain(it.type);
        expect(rollTier(TABLES, "tier_does_not_exist", rng)).toBeUndefined();
    });
});

describe("map loot", () => {
    it("rolls every loot spawner at game creation, guns with their ammo beside them", () => {
        const game = new Game({ mapName: "main", seed: 12345 });
        const items = [...game.loot.items.values()];
        expect(items.length).toBeGreaterThan(game.generation.lootSpawns.length * 0.8);
        const guns = items.filter((l) => l.defType === "gun");
        expect(guns.length).toBeGreaterThan(5);
        for (const gun of guns) {
            const def = getDefOfType("gun", gun.type);
            const ammo = items.filter((l) => l.type === def.ammo && v2.distance(l.pos, gun.pos) < 1.6);
            if (def.ammoSpawnCount > 0 && GameConfig.bagSizes[def.ammo]) {
                expect(ammo.reduce((a, l) => a + l.count, 0)).toBe(def.ammoSpawnCount);
            }
        }
        // the same seed rolls the same loot
        const again = new Game({ mapName: "main", seed: 12345 });
        expect([...again.loot.items.values()].map((l) => `${l.type}:${l.count}`)).toEqual(
            items.map((l) => `${l.type}:${l.count}`),
        );
    });

    it("pushes overlapping items apart until they rest, then they sleep", () => {
        const game = flatGame();
        const spot = openSpot(game, 10);
        game.loot.addLoot("ak47", spot, 0, 1, { pushSpeed: 0 });
        steps(game, 300);
        const items = [...game.loot.items.values()];
        expect(items).toHaveLength(3);
        for (let i = 0; i < items.length; i++) {
            for (let j = i + 1; j < items.length; j++) {
                const a = items[i];
                const b = items[j];
                expect(v2.distance(a.pos, b.pos)).toBeGreaterThan(a.lootRad + b.lootRad - 0.05);
            }
        }
        expect(items.every((l) => !l.awake)).toBe(true);
    });

    it("slides a pushed item with drag and stops it", () => {
        const game = flatGame();
        const spot = openSpot(game, 20);
        const loot = game.loot.addLoot("bandage", spot, 0, 5, { pushSpeed: 10, dir: { x: 1, y: 0 } })!;
        steps(game, 1);
        const v0 = loot.vel.x;
        expect(v0).toBeCloseTo(10 / (1 + 0.01 * 2.5), 9);
        steps(game, 500);
        expect(loot.awake).toBe(false);
        // the geometric series of drag: about v / 2.5 units
        expect(loot.pos.x - spot.x).toBeGreaterThan(3);
        expect(loot.pos.x - spot.x).toBeLessThan(4.5);
    });
});

describe("pickup", () => {
    function looter() {
        const game = flatGame();
        const p = spawnAt(game, openSpot(game, 20));
        return { game, p };
    }

    function drop(game: Game, type: string, count: number, pos: { x: number; y: number }): Loot {
        return game.loot.addLoot(type, pos, 0, count, { pushSpeed: 0, noSideAmmo: true })!;
    }

    function interact(game: Game, p: ReturnType<typeof spawnAt>) {
        send(game, p, { actions: [Input.Interact] });
        game.step();
        send(game, p, {});
        steps(game, 25);
    }

    it("adds bag items up to the backpack capacity and leaves the rest on the ground", () => {
        const { game, p } = looter();
        p.inv.set("9mm", 100);
        drop(game, "9mm", 60, p.pos);
        interact(game, p);
        expect(p.inv.get("9mm")).toBe(GameConfig.bagSizes["9mm"][0]);
        const left = [...game.loot.items.values()];
        expect(left).toHaveLength(1);
        expect(left[0]).toMatchObject({ type: "9mm", count: 40 });
        expect(p.lastPickup?.result).toBe("success");
        // a full bag refuses
        interact(game, p);
        expect(p.lastPickup?.result).toBe("full");
        expect([...game.loot.items.values()][0].count).toBe(40);
    });

    it("only picks up loot within reach (player radius + loot radius)", () => {
        const { game, p } = looter();
        drop(game, "bandage", 1, v2.add(p.pos, { x: 2.2, y: 0 }));
        interact(game, p);
        expect(p.inv.get("bandage")).toBe(0);
        const near = drop(game, "bandage", 1, v2.add(p.pos, { x: 1.9, y: 0 }));
        interact(game, p);
        expect(p.inv.get("bandage")).toBe(1);
        expect(near.destroyed).toBe(true);
    });

    it("fills an empty gun slot and draws it when the melee slot is out", () => {
        const { game, p } = looter();
        drop(game, "ak47", 1, p.pos);
        interact(game, p);
        expect(p.weapons[WeaponSlot.Primary].type).toBe("ak47");
        expect(p.curWeapIdx).toBe(WeaponSlot.Primary);
        drop(game, "mp5", 1, p.pos);
        interact(game, p);
        expect(p.weapons[WeaponSlot.Secondary].type).toBe("mp5");
        expect(p.curWeapIdx).toBe(WeaponSlot.Primary);
    });

    it("swaps the held gun when both slots are full: the old gun drops, its magazine goes to the bag", () => {
        const { game, p } = looter();
        giveGun(p, "mp5", { slot: WeaponSlot.Secondary, reserve: 0 });
        giveGun(p, "ak47", { slot: WeaponSlot.Primary, reserve: 0 });
        p.weaponManager.weapons[WeaponSlot.Primary].ammo = 17;
        drop(game, "scar", 1, p.pos);
        interact(game, p);
        expect(p.weapons[WeaponSlot.Primary]).toMatchObject({ type: "scar", ammo: 0 });
        expect(p.weapons[WeaponSlot.Secondary].type).toBe("mp5");
        expect(p.inv.get("762mm")).toBe(17);
        const ground = [...game.loot.items.values()].map((l) => l.type);
        expect(ground).toEqual(["ak47"]);
        // the new gun is empty: it reloads from the bag once its switch delay is over (none for scar's ammo yet)
        expect(p.weapons[WeaponSlot.Primary].ammo).toBe(0);
        // picking up the same gun again is refused and leaves it on the ground
        drop(game, "scar", 1, p.pos);
        interact(game, p);
        expect(p.lastPickup?.result).toBe("alreadyOwned");
        expect([...game.loot.items.values()].filter((l) => l.type === "scar")).toHaveLength(1);
    });

    it("turns a matching second pistol into the dual version, keeping the magazine and dropping nothing", () => {
        const { game, p } = looter();
        giveGun(p, "ak47", { slot: WeaponSlot.Primary, reserve: 0 });
        giveGun(p, "m9", { slot: WeaponSlot.Secondary, reserve: 0 });
        p.weaponManager.weapons[WeaponSlot.Secondary].ammo = 9;
        drop(game, "m9", 1, p.pos);
        interact(game, p);
        expect(p.weapons[WeaponSlot.Secondary]).toMatchObject({ type: "m9_dual", ammo: 9 });
        expect(game.loot.items.size).toBe(0);
        // dual pistols fire 30-round magazines after a reload
        expect(getDefOfType("gun", "m9_dual").maxClip).toBe(30);
    });

    it("upgrades gear, refuses worse gear and drops the replaced piece", () => {
        const { game, p } = looter();
        drop(game, "helmet01", 1, p.pos);
        interact(game, p);
        expect(p.helmet).toBe("helmet01");
        drop(game, "helmet02", 1, p.pos);
        interact(game, p);
        expect(p.helmet).toBe("helmet02");
        expect([...game.loot.items.values()].map((l) => l.type)).toEqual(["helmet01"]);
        interact(game, p);
        expect(p.lastPickup?.result).toBe("betterItemEquipped");
        expect(p.helmet).toBe("helmet02");
        expect([...game.loot.items.values()].map((l) => l.type)).toEqual(["helmet01"]);
        // a bigger backpack raises every capacity; the level 0 pack is not dropped
        drop(game, "backpack02", 1, v2.add(p.pos, { x: 0, y: 0.5 }));
        interact(game, p);
        expect(p.backpack).toBe("backpack02");
        expect(p.inv.capacity("9mm")).toBe(GameConfig.bagSizes["9mm"][2]);
        expect([...game.loot.items.values()].some((l) => l.type === "backpack00")).toBe(false);
    });

    it("equips better scopes, swaps melee weapons and fills the throwable slot", () => {
        const { game, p } = looter();
        drop(game, "4xscope", 1, p.pos);
        interact(game, p);
        expect(p.scope).toBe("4xscope");
        expect(p.zoom).toBe(GameConfig.scopeZoomRadius.desktop["4xscope"]);
        send(game, p, { actions: [Input.EquipPrevScope] });
        game.step();
        expect(p.scope).toBe("1xscope");
        drop(game, "machete", 1, p.pos);
        interact(game, p);
        expect(p.weapons[WeaponSlot.Melee].type).toBe("machete");
        drop(game, "katana", 1, p.pos);
        interact(game, p);
        expect(p.weapons[WeaponSlot.Melee].type).toBe("katana");
        expect([...game.loot.items.values()].map((l) => l.type)).toContain("machete");
        drop(game, "frag", 3, p.pos);
        interact(game, p);
        expect(p.inv.get("frag")).toBe(3);
        expect(p.weapons[WeaponSlot.Throwable].type).toBe("frag");
    });

    it("waits the pickup cooldown between two pickups", () => {
        const { game, p } = looter();
        drop(game, "bandage", 1, p.pos);
        drop(game, "soda", 1, v2.add(p.pos, { x: 0.3, y: 0 }));
        send(game, p, { actions: [Input.Interact] });
        game.step();
        send(game, p, { actions: [Input.Interact] });
        game.step();
        expect(p.inv.get("bandage") + p.inv.get("soda")).toBe(1);
        steps(game, 10);
        send(game, p, { actions: [Input.Interact] });
        game.step();
        expect(p.inv.get("bandage") + p.inv.get("soda")).toBe(2);
    });
});
