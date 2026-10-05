// Obstacle behaviour fields (M5b): regrow, armorPlated / stonePlated against melee, destroyType replacements,
// smartLoot class pods and their owned loot, the potato weapon swap, createSmoke, building heal regions, decal
// anchors, gore regions, faction team ids.
import { type Vec2, v2 } from "@rebirth/core";
import { DamageType, getDef, WeaponSlot } from "@rebirth/defs";
import { describe, expect, it } from "vitest";
import {
    destroyTypeOf,
    emptyInput,
    type Game,
    interactObstacle,
    type Loot,
    type Obstacle,
    type Player,
} from "../src/index.ts";
import { childObstacles, findBuilding, mapGame, placePlayer, stepSeconds } from "./buildingHelpers.ts";
import { flatGame, giveGun, type ObstacleSpec, openSpot, steps } from "./combatHelpers.ts";

/** A flat game with the given objects placed relative to an open spot, and that spot. */
function placed(specs: Array<Omit<ObstacleSpec, "pos"> & { offset?: Vec2 }>): { game: Game; at: Vec2 } {
    const at = v2.add(openSpot(flatGame(), 40), { x: 10, y: 0 });
    const game = flatGame(specs.map(({ offset, ...s }) => ({ ...s, pos: v2.add(at, offset ?? { x: 0, y: 0 }) })));
    return { game, at };
}

function obstacles(game: Game, type: string): Obstacle[] {
    return [...game.world.objects.values()].filter((o): o is Obstacle => o.kind === "obstacle" && o.type === type);
}

/** Swings the active melee weapon at whatever is in front for `ticks` ticks. */
function swing(game: Game, p: Player, ticks: number): void {
    game.setInput(p.id, { ...emptyInput(), toMouseDir: v2.copy(p.dir), shootStart: true, shootHold: true });
    steps(game, ticks);
    game.setInput(p.id, { ...emptyInput(), toMouseDir: v2.copy(p.dir) });
}

describe("regrow", () => {
    it("brings a destroyed potato back at full health after regrowTimer (60 s)", () => {
        const { game } = placed([{ type: "potato_01" }]);
        const potato = game.world.get(1) as Obstacle;
        game.damageObstacle(potato, { amount: 1000, damageType: DamageType.Player });
        expect(potato.dead).toBe(true);
        expect(potato.blocking).toBe(false);
        stepSeconds(game, 59.9);
        expect(potato.dead).toBe(true);
        stepSeconds(game, 0.2);
        expect(potato).toMatchObject({ dead: false, health: potato.maxHealth, healthT: 1, scale: potato.maxScale });
        expect(potato.blocking).toBe(true);
    });
});

describe("plating", () => {
    it("armorPlated crates ignore non-piercing melee but not armorPiercing weapons or air drops", () => {
        const { game, at } = placed([{ type: "crate_04" }]);
        const crate = game.world.get(1) as Obstacle;
        const p = placePlayer(game, v2.add(at, { x: -3.6, y: 0 }));
        swing(game, p, 60);
        expect(crate.health).toBe(crate.maxHealth);
        p.weaponManager.setWeapon(WeaponSlot.Melee, "woodaxe", 0);
        p.weaponManager.setCurWeapIndex(WeaponSlot.Melee);
        steps(game, 100);
        swing(game, p, 60);
        expect(crate.health).toBeLessThan(crate.maxHealth);
        const before = crate.health;
        game.damageObstacle(crate, { amount: 10, damageType: DamageType.Airdrop });
        expect(crate.health).toBe(before - 10);
    });

    it("stonePlated stones need a stonePiercing weapon", () => {
        const { game } = placed([{ type: "stone_04" }]);
        const stone = game.world.get(1) as Obstacle;
        for (const weapon of ["fists", "woodaxe", "katana"]) {
            game.damageObstacle(stone, { amount: 50, damageType: DamageType.Player, gameSourceType: weapon });
        }
        expect(stone.health).toBe(stone.maxHealth);
        game.damageObstacle(stone, { amount: 50, damageType: DamageType.Player, gameSourceType: "sledgehammer" });
        expect(stone.health).toBe(stone.maxHealth - 50);
    });
});

describe("destroyType and smartLoot", () => {
    it("an opened air drop crate turns into its destroyType crate", () => {
        const { game, at } = placed([{ type: "airdrop_crate_01" }]);
        const crate = game.world.get(1) as Obstacle;
        const p = placePlayer(game, v2.add(at, { x: 0, y: -4 }));
        interactObstacle(game, crate, p);
        stepSeconds(game, 2.6);
        expect(crate.dead).toBe(true);
        const [replacement] = obstacles(game, "crate_10");
        expect(replacement.pos).toEqual(crate.pos);
        expect(replacement.dead).toBe(false);
    });

    it("class shells turn into the opener's class crate whose loot is the opener's for 2 s", () => {
        const { game, at } = placed([{ type: "class_shell_01" }]);
        const shell = game.world.get(1) as Obstacle;
        const opener = placePlayer(game, v2.add(at, { x: 0, y: -4 }));
        const thief = placePlayer(game, v2.add(at, { x: 0, y: 4 }));
        // TODO(M7): Cobalt gives every player a class; without one survev spawns nothing
        expect(destroyTypeOf(shell, thief)).toBe("class_crate_common_");
        opener.role = "scout";
        interactObstacle(game, shell, opener);
        stepSeconds(game, 2.6);
        const [pod] = obstacles(game, "class_crate_common_scout");
        expect(pod).toBeDefined();
        expect(pod).toMatchObject({ applyLootOwner: true, lootOwnerId: opener.id });
        // the thief breaks the pod: the loot still goes to the opener standing close by
        game.damageObstacle(pod, { amount: 10_000, damageType: DamageType.Player, sourceId: thief.id });
        const loot = [...game.loot.items.values()];
        expect(loot.length).toBeGreaterThan(0);
        for (const l of loot) expect(l.ownerId).toBe(opener.id);
        stepSeconds(game, 2.1);
        for (const l of loot as Loot[]) expect(l.ownerId).toBe(0);
    });
});

describe("other destruction effects", () => {
    it("potatoes swap the weapon that broke them for a random weapon of the same kind", () => {
        const { game, at } = placed([{ type: "potato_01" }]);
        const potato = game.world.get(1) as Obstacle;
        const p = placePlayer(game, v2.add(at, { x: -4, y: 0 }));
        giveGun(p, "ak47");
        game.damageObstacle(potato, {
            amount: 1000,
            damageType: DamageType.Player,
            gameSourceType: "ak47",
            sourceId: p.id,
        });
        const slot = p.weaponManager.weapons[WeaponSlot.Primary];
        const def = getDef(slot.type);
        expect(def.type).toBe("gun");
        expect(slot.type).not.toBe("ak47");
        expect((def as { noPotatoSwap?: boolean }).noPotatoSwap).toBeFalsy();
        // a non-swappable weapon is left alone
        const melee = placePlayer(game, v2.add(at, { x: 4, y: 0 }));
        melee.weaponManager.setWeapon(WeaponSlot.Melee, "machete", 0);
        game.damageObstacle(potato, { amount: 1000, damageType: DamageType.Player });
        stepSeconds(game, 60.1);
        game.damageObstacle(potato, {
            amount: 1000,
            damageType: DamageType.Player,
            gameSourceType: "machete",
            sourceId: melee.id,
        });
        expect(melee.weaponManager.weapons[WeaponSlot.Melee].type).toBe("machete");
    });

    it("fire extinguishers release smoke when destroyed", () => {
        const { game, at } = placed([{ type: "fire_ext_01" }]);
        game.damageObstacle(game.world.get(1) as Obstacle, { amount: 1000, damageType: DamageType.Player });
        stepSeconds(game, 0.5);
        const view = { min: v2.sub(at, { x: 20, y: 20 }), max: v2.add(at, { x: 20, y: 20 }) };
        expect(game.smokes.views(view).length).toBeGreaterThan(0);
    });

    it("decal anchors take the building decal at their position with them", () => {
        const at = v2.add(openSpot(flatGame(), 40), { x: 10, y: 0 });
        const game = flatGame([
            { type: "cache_pumpkin_01", kind: "building", pos: at },
            { type: "decal_light_01", kind: "decal", pos: at, parentId: 1 },
            { type: "pumpkin_01", pos: at, parentId: 1 },
            { type: "decal_light_01", kind: "decal", pos: v2.add(at, { x: 3, y: 0 }), parentId: 1 },
        ]);
        game.damageObstacle(game.world.get(3) as Obstacle, { amount: 1000, damageType: DamageType.Player });
        expect(game.world.get(2)).toBeUndefined();
        expect(game.world.get(4)).toBeDefined();
    });

    it("faction obstacles keep their team id", () => {
        const { game } = placed([{ type: "potato_01f" }, { type: "potato_01", offset: { x: 5, y: 0 } }]);
        expect((game.world.get(1) as Obstacle).teamId).toBe(2);
        expect((game.world.get(2) as Obstacle).teamId).toBe(0);
    });
});

describe("buildings", () => {
    it("heal regions heal players standing in them (3 HP/s in the bathhouse steam room), not in the gas", () => {
        const game = mapGame();
        const room = findBuilding(game, "bathhouse_sideroom_01");
        expect(room.healRegions.map((r) => r.healRate)).toEqual([3]);
        const p = placePlayer(game, room.pos, room.layer);
        p.health = 50;
        stepSeconds(game, 1);
        expect(p.health).toBeCloseTo(53, 6);
        expect(p.toView().healEffect).toBe(true);
        game.gas.currentRad = 0;
        stepSeconds(game, 1);
        expect(p.healEffect).toBe(false);
        expect(p.health).toBeLessThanOrEqual(53 + 1e-6);
        // health never goes above 100
        game.gas.currentRad = 1e6;
        p.health = 99.5;
        stepSeconds(game, 1);
        expect(p.health).toBe(100);
    });

    it("players killed in the club pool's gore region bloody its pool decal", () => {
        const game = mapGame();
        const bathhouse = findBuilding(game, "bathhouse_01");
        const pool = bathhouse.childIds
            .map((id) => game.world.get(id))
            .find((o) => o?.type === "decal_bathhouse_pool_01");
        if (pool?.kind !== "decal") throw new Error("no pool decal");
        const region = bathhouse.goreRegion!;
        const victim = placePlayer(game, v2.mul(v2.add(region.min, region.max), 0.5), bathhouse.layer);
        game.damagePlayer(victim, { amount: 500, damageType: DamageType.Player });
        expect(victim.dead).toBe(true);
        expect(pool.goreKills).toBe(1);
        expect(pool.toView().goreKills).toBe(1);
        expect(childObstacles(game, bathhouse).length).toBeGreaterThan(0);
    });
});
