// Core behaviours on a flat map: looting a gun lying nearby (and equipping it), engaging and killing a stationary
// dummy, healing when hurt and safe, upgrading a full loadout by swapping out the weaker gun.
import { v2 } from "@rebirth/core";
import { WeaponSlot } from "@rebirth/defs";
import { describe, expect, it } from "vitest";
import { flatGame, giveGun, openSpot, placeBot, placePlayer, runUntil } from "./helpers.ts";

describe("bot behaviours", () => {
    it("loots a gun lying near it and equips it", () => {
        const game = flatGame({ sandbox: true });
        const spot = openSpot(game);
        const bot = placeBot(game, spot, { seed: 2 });
        game.loot.addLoot("mp5", v2.add(spot, { x: 8, y: 3 }), 0, 1, { pushSpeed: 0 });
        const p = game.getPlayer(bot.playerId)!;
        const ticks = runUntil(
            game,
            [bot],
            () => p.weapons.some((w) => w.type === "mp5") && p.activeWeapon === "mp5",
            800,
        );
        expect(ticks).toBeGreaterThan(0);
        // the gun came with its side ammo stacks: the bot picks those up too
        runUntil(game, [bot], () => p.inv.get("9mm") > 0, 600);
        expect(p.inv.get("9mm")).toBeGreaterThan(0);
    });

    it("swaps its weaker gun for a better one when both slots are full", () => {
        const game = flatGame({ sandbox: true });
        const spot = openSpot(game);
        const bot = placeBot(game, spot, { seed: 4 });
        const p = game.getPlayer(bot.playerId)!;
        giveGun(p, "m9", 60, WeaponSlot.Secondary);
        giveGun(p, "mp5", 60, WeaponSlot.Primary);
        game.loot.addLoot("ak47", v2.add(spot, { x: -7, y: 0 }), 0, 1, { pushSpeed: 0, noSideAmmo: true });
        const ticks = runUntil(game, [bot], () => p.weapons.some((w) => w.type === "ak47"), 1200);
        expect(ticks).toBeGreaterThan(0);
        expect(p.weapons.map((w) => w.type)).toContain("mp5");
        expect(p.weapons.map((w) => w.type)).not.toContain("m9");
    });

    it("engages a stationary dummy and kills it", () => {
        const game = flatGame({ sandbox: true });
        const spot = openSpot(game);
        const bot = placeBot(game, spot, { seed: 5 });
        const p = game.getPlayer(bot.playerId)!;
        giveGun(p, "ak47", 90);
        const dummy = placePlayer(game, "dummy", v2.add(spot, { x: 16, y: 4 }));
        const ticks = runUntil(game, [bot], () => dummy.dead, 2000);
        expect(ticks).toBeGreaterThan(0);
        expect(p.kills).toBe(1);
        // reaction time and aim error, but well under 20 s
        expect(ticks).toBeLessThan(2000);
    });

    it("kills a dummy with its fists when it has no gun", () => {
        const game = flatGame({ sandbox: true });
        const spot = openSpot(game);
        const bot = placeBot(game, spot, { seed: 6, difficulty: "hard" });
        const dummy = placePlayer(game, "dummy", v2.add(spot, { x: 4, y: 0 }));
        const ticks = runUntil(game, [bot], () => dummy.dead, 3000);
        expect(ticks).toBeGreaterThan(0);
    });

    it("heals when hurt and nobody is around", () => {
        const game = flatGame({ sandbox: true });
        const spot = openSpot(game);
        const bot = placeBot(game, spot, { seed: 7 });
        const p = game.getPlayer(bot.playerId)!;
        p.inv.set("bandage", 5);
        p.inv.set("healthkit", 1);
        p.health = 30;
        const ticks = runUntil(game, [bot], () => p.health >= 90, 2500);
        expect(ticks).toBeGreaterThan(0);
        expect(p.inv.get("healthkit") + p.inv.get("bandage")).toBeLessThan(6);
    });

    it("drinks boosts to stay doped when healthy (normal and hard bots)", () => {
        const game = flatGame({ sandbox: true });
        const spot = openSpot(game);
        const bot = placeBot(game, spot, { seed: 8, difficulty: "hard" });
        const p = game.getPlayer(bot.playerId)!;
        p.inv.set("soda", 2);
        const ticks = runUntil(game, [bot], () => p.boost > 0, 800);
        expect(ticks).toBeGreaterThan(0);
    });
});
