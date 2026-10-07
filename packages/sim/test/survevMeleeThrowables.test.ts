// The survev-only melee weapons, throwables and Pirate's Bounty in the simulation (survev content wave, stage 1;
// specs pinned in packages/defs/test/survevContent.test.ts): the Ice Axe breaks stone-plated obstacles, the Cutlass
// cleaves, the Gold Cutlass gives Pirate's Bounty while carried (survev weaponManager.ts setWeapon) and a melee kill
// with it drops the bounty (survev player.ts:2727-2765), coconuts heal the thrower's side and slow enemies, tomatoes
// slow enemies and make them drop an item (survev explosion.ts:214-237).
import { v2 } from "@rebirth/core";
import { DamageType, getDefOfType, WeaponSlot } from "@rebirth/defs";
import { describe, expect, it } from "vitest";
import type { Obstacle, Player } from "../src/index.ts";
import { constantRng, flatGame, openSpot, send, spawnAt, steps } from "./combatHelpers.ts";
import { clearSpot, cookAndThrow, fxGame, holdThrowable, logExplosions } from "./fxHelpers.ts";

function arena(melee: string) {
    const origin = openSpot(flatGame(), 20);
    const game = flatGame([{ type: "stone_04", pos: v2.add(origin, { x: 0, y: 12 }) }]);
    game.combatRng = constantRng();
    const p = spawnAt(game, origin);
    p.weaponManager.setWeapon(WeaponSlot.Melee, melee, 0);
    p.weaponManager.setCurWeapIndex(WeaponSlot.Melee, true);
    p.weaponManager.weapons[WeaponSlot.Melee].cooldown = 0;
    return { game, p, def: getDefOfType("melee", melee) };
}

function swing(game: ReturnType<typeof flatGame>, p: Player): void {
    send(game, p, { shootHold: true, shootStart: true });
    game.step();
    send(game, p, {});
    steps(game, 80);
}

describe("survev-only melee", () => {
    it("the Ice Axe hits for 44 and breaks stone-plated obstacles", () => {
        const { game, p, def } = arena("iceaxe");
        const t = spawnAt(game, v2.add(p.pos, { x: def.attack.offset.x + 0.5, y: 0 }), { x: -1, y: 0 });
        swing(game, p);
        expect(100 - t.health).toBe(44);
        const stone = game.world.get(1) as Obstacle;
        expect(stone.def.stonePlated).toBe(true);
        game.damageObstacle(stone, { amount: 50, damageType: DamageType.Player, gameSourceType: "cutlass" });
        expect(stone.health).toBe(stone.maxHealth);
        game.damageObstacle(stone, { amount: 50, damageType: DamageType.Player, gameSourceType: "iceaxe" });
        expect(stone.health).toBe(stone.maxHealth - 50);
    });

    it("the Cutlass cleaves: both targets in its attack circle take 30", () => {
        const { game, p, def } = arena("cutlass");
        const x = def.attack.offset.x;
        const a = spawnAt(game, v2.add(p.pos, { x, y: -0.9 }), { x: -1, y: 0 });
        const b = spawnAt(game, v2.add(p.pos, { x, y: 0.9 }), { x: -1, y: 0 });
        swing(game, p);
        expect([100 - a.health, 100 - b.health]).toEqual([30, 30]);
    });

    it("the Gold Cutlass gives Pirate's Bounty while carried, and only while carried", () => {
        const { p } = arena("cutlass_gold");
        expect(p.hasPerk("pirate")).toBe(true);
        // switching slots keeps it: it is carried, not held
        p.weaponManager.setCurWeapIndex(WeaponSlot.Primary, true);
        expect(p.hasPerk("pirate")).toBe(true);
        p.weaponManager.setWeapon(WeaponSlot.Melee, "fists", 0);
        expect(p.hasPerk("pirate")).toBe(false);
        expect(p.perks).not.toContain("pirate");
    });

    it("a melee kill with Pirate's Bounty drops 3-4 extra items at the victim, a gun kill none", () => {
        const drops = (weapon: string) => {
            const { game, p } = arena("cutlass_gold");
            const victim = spawnAt(game, v2.add(p.pos, { x: 2, y: 0 }), { x: -1, y: 0 });
            // nothing on the victim to drop on death but the bounty
            victim.weaponManager.setWeapon(WeaponSlot.Melee, "fists", 0);
            const before = game.loot.items.size;
            victim.health = 1;
            game.damagePlayer(victim, {
                amount: 50,
                damageType: DamageType.Player,
                gameSourceType: weapon,
                sourceId: p.id,
            });
            expect(victim.dead).toBe(true);
            return game.loot.items.size - before;
        };
        const melee = drops("cutlass_gold");
        expect(melee).toBeGreaterThanOrEqual(3);
        expect(melee).toBeLessThanOrEqual(5);
        expect(drops("m9")).toBe(0);
    });
});

describe("survev-only throwables", () => {
    function hit(item: string, teammate: boolean) {
        const origin = clearSpot();
        const { game, p } = fxGame(origin);
        const target = spawnAt(game, { x: origin.x + 8, y: origin.y }, { x: -1, y: 0 });
        if (teammate) target.teamId = p.teamId;
        target.health = 50;
        target.inv.set("bandage", 10);
        holdThrowable(p, item, 3);
        const log = logExplosions(game);
        const lootBefore = game.loot.items.size;
        cookAndThrow(game, p, 2, 8);
        for (let i = 0; i < 200 && log.length === 0; i++) game.step();
        return { game, p, target, log, dropped: game.loot.items.size - lootBefore };
    }

    it("a coconut hit on an enemy deals 22 and slows it for 1 s", () => {
        const { target, log, dropped } = hit("coconut", false);
        expect(log.map((e) => e.type)).toEqual(["explosion_coconut"]);
        expect(50 - target.health).toBeCloseTo(22, 6);
        expect(target.frozen.ticker).toBeGreaterThan(0.9);
        expect(target.frozen.ticker).toBeLessThanOrEqual(1);
        expect(dropped).toBe(0);
    });

    it("a coconut hit on a teammate heals it 7 instead, with the heal effect for 0.5 s", () => {
        const { game, target } = hit("coconut", true);
        expect(target.health).toBe(57);
        expect(target.frozen.ticker).toBe(0);
        game.step();
        expect(target.healEffect).toBe(true);
        steps(game, 60);
        expect(target.healEffect).toBe(false);
    });

    it("a tomato hit on an enemy deals 11, slows it 0.5 s and makes it drop one item", () => {
        const { target, log, dropped } = hit("tomato", false);
        expect(log.map((e) => e.type)).toEqual(["explosion_tomato"]);
        expect(50 - target.health).toBeCloseTo(11, 6);
        expect(target.frozen.ticker).toBeGreaterThan(0.4);
        expect(target.frozen.ticker).toBeLessThanOrEqual(0.5);
        expect(dropped).toBe(1);
        expect(target.inv.get("bandage")).toBe(5);
    });
});
