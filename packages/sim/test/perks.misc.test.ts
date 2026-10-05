// Timed and event perks (M7a): Gift of the Woods, the trick perks, Inspiration and the bugle, Last Breath, Martyrdom
// from roles, Scavenger and Master Scavenger, Endless Ammo, Rare Potato, Fabricate's interval. Values:
// docs/research/items/perks.md and conflicts.md (gotw-values, perk-gabby-interval, last-breath-duration), via
// rules.perks.
import { v2 } from "@rebirth/core";
import { DamageType, GameObjectDefs, WeaponSlot } from "@rebirth/defs";
import { describe, expect, it } from "vitest";
import { type Game, type Player, randomWeaponSwap } from "../src/index.ts";
import { addPerk, removePerk } from "../src/perks/perks.ts";
import { fireOnce, flatGame, giveGun, openSpot, spawnAt, steps } from "./combatHelpers.ts";

function setup(): { game: Game; p: Player } {
    const game = flatGame();
    const p = spawnAt(game, openSpot(game));
    return { game, p };
}

function watchEmotes(game: Game): Array<{ id: number; type: string }> {
    const out: Array<{ id: number; type: string }> = [];
    const add = game.addEmote.bind(game);
    game.addEmote = (player, type, item) => {
        out.push({ id: player.id, type });
        add(player, type, item);
    };
    return out;
}

describe("Gift of the Woods", () => {
    it("heals at the tier-1 adrenaline rate (0.5 HP/s with survev's table), never while downed (gotw-values)", () => {
        const { game, p } = setup();
        addPerk(p, "gotw");
        p.health = 50;
        steps(game, 200);
        expect(p.health).toBeCloseTo(51, 6);
        game.rules.boostModel = "wiki";
        steps(game, 100);
        expect(p.health).toBeCloseTo(52, 6);
        game.rules.perks.gotwRegenRate = 2;
        steps(game, 100);
        expect(p.health).toBeCloseTo(54, 6);
    });
});

describe("trick perks", () => {
    it("Dev Troll Special puts a full cursed M9 in the secondary slot, taken away with the perk", () => {
        const { p } = setup();
        addPerk(p, "trick_m9");
        expect(p.weaponManager.weapons[WeaponSlot.Secondary]).toMatchObject({ type: "m9_cursed", ammo: 15 });
        removePerk(p, "trick_m9");
        expect(p.weaponManager.weapons[WeaponSlot.Secondary].type).toBe("");
    });

    it("Gabby Ghost emotes a random emote every 5-15 s (conflicts.md perk-gabby-interval)", () => {
        const { game, p } = setup();
        const emotes = watchEmotes(game);
        addPerk(p, "trick_chatty");
        steps(game, 6100);
        const mine = emotes.filter((e) => e.id === p.id);
        // 61 s: the first emote at once, then one every 5-15 s
        expect(mine.length).toBeGreaterThanOrEqual(5);
        expect(mine.length).toBeLessThanOrEqual(14);
        expect(mine.every((e) => GameObjectDefs[e.type]?.type === "emote")).toBe(true);
    });

    it("That Sucks drains 1 HP every 3 s while standing (perks.md trick_drain)", () => {
        const { game, p } = setup();
        addPerk(p, "trick_drain");
        steps(game, 1);
        expect(p.health).toBe(99);
        steps(game, 899);
        expect(p.health).toBe(97);
        steps(game, 2);
        expect(p.health).toBe(96);
    });
});

describe("Inspiration and Last Breath", () => {
    it("the bugle hastes teammates within 30 u for 3 s and recharges one charge every 8 s (perks.md inspiration)", () => {
        const { game, p } = setup();
        const mate = spawnAt(game, v2.add(p.pos, { x: 20, y: 0 }));
        const far = spawnAt(game, v2.add(p.pos, { x: 50, y: 0 }));
        const enemy = spawnAt(game, v2.add(p.pos, { x: 10, y: 0 }));
        mate.teamId = far.teamId = p.teamId = 7;
        addPerk(p, "inspiration");
        giveGun(p, "bugle", { slot: WeaponSlot.Secondary });
        const emotes = watchEmotes(game);
        fireOnce(game, p);
        expect([p.haste.type, mate.haste.type, far.haste.type, enemy.haste.type]).toEqual([
            "inspire",
            "inspire",
            "none",
            "none",
        ]);
        // faction colours only (Red 1, Blue 2): no bugle emote on a non-faction team id
        expect(emotes.filter((e) => e.type.startsWith("emote_bugle"))).toEqual([]);
        expect(p.weaponManager.weapons[WeaponSlot.Secondary].ammo).toBe(0);
        steps(game, 299);
        expect(mate.haste.type).toBe("none");
        steps(game, 499);
        expect(p.weaponManager.weapons[WeaponSlot.Secondary].ammo).toBe(0);
        steps(game, 2);
        expect(p.weaponManager.weapons[WeaponSlot.Secondary].ammo).toBe(1);
        removePerk(p, "inspiration");
        expect(p.weaponManager.weapons[WeaponSlot.Secondary].type).toBe("");
    });

    it("Last Breath bloodlusts teammates within 60 u for 5 s: x1.08 damage, +20 % size, haste (last-breath-duration)", () => {
        const { game, p } = setup();
        const mate = spawnAt(game, v2.add(p.pos, { x: 40, y: 0 }));
        const enemy = spawnAt(game, v2.add(p.pos, { x: -10, y: 0 }));
        mate.teamId = p.teamId;
        p.teamId = mate.teamId = 1;
        const emotes = watchEmotes(game);
        addPerk(p, "final_bugle");
        game.damagePlayer(p, {
            amount: 500,
            damageType: DamageType.Player,
            sourceId: enemy.id,
            gameSourceType: "ak47",
        });
        expect(p.dead).toBe(true);
        expect(mate.lastBreathTicker).toBe(5);
        expect(mate.scale).toBeCloseTo(1.2, 9);
        expect(mate.haste.type).toBe("inspire");
        expect(enemy.lastBreathTicker).toBe(0);
        expect(emotes).toContainEqual({ id: mate.id, type: "emote_bugle_final_red" });
        giveGun(mate, "ak47", { reserve: 30 });
        fireOnce(game, mate);
        const bullet = game.bullets.active.find((b) => b.shooterId === mate.id)!;
        expect(bullet.damageMult).toBeCloseTo(1.08, 9);
        expect(bullet.saturated).toBe(true);
        steps(game, 500);
        expect(mate.lastBreathTicker).toBe(0);
        expect(mate.scale).toBe(1);
    });
});

describe("Martyrdom from roles", () => {
    it("the Grenadier releases martyr grenades on death without the perk (perks.md martyrdom)", () => {
        const { game, p } = setup();
        const victim = spawnAt(game, v2.add(p.pos, { x: 30, y: 0 }));
        victim.role = "grenadier";
        game.damagePlayer(victim, { amount: 500, damageType: DamageType.Player, sourceId: p.id });
        expect(game.projectiles.projectiles.filter((pr) => pr.type === "martyr_nade")).toHaveLength(12);
    });
});

describe("Scavenger", () => {
    const destroy = (perk: string | null) => {
        const game = flatGame();
        const spot = openSpot(game);
        const g2 = flatGame([{ type: "stone_01", pos: v2.add(spot, { x: 6, y: 0 }) }]);
        const p = spawnAt(g2, spot);
        if (perk) addPerk(p, perk);
        const stone = [...g2.world.objects.values()].find((o) => o.kind === "obstacle" && o.type === "stone_01")!;
        g2.damageObstacle(stone as never, { amount: 1e6, damageType: DamageType.Player, sourceId: p.id });
        return [...g2.loot.items.values()].map((l) => l.type);
    };

    it("adds one roll of tier_world, Master Scavenger one of tier_scavenger_adv (perks.md scavenger)", () => {
        expect(destroy(null)).toEqual([]);
        const world = destroy("scavenger");
        expect(world.length).toBeGreaterThan(0);
        const adv = destroy("scavenger_adv");
        expect(adv.length).toBeGreaterThan(0);
    });
});

describe("Endless Ammo, Rare Potato and Fabricate", () => {
    it("Endless Ammo reloads without taking ammo from the bag (perks.md endless_ammo)", () => {
        const { game, p } = setup();
        giveGun(p, "ak47", { reserve: 10, ammo: 0 });
        addPerk(p, "endless_ammo");
        p.weaponManager.tryReload();
        steps(game, 300);
        expect(p.weaponManager.activeSlot.ammo).toBe(30);
        expect(p.inv.get("762mm")).toBe(10);
    });

    it("Rare Potato only rolls quality weapons (perks.md rare_potato)", () => {
        const { game, p } = setup();
        addPerk(p, "rare_potato");
        giveGun(p, "mp5", { reserve: 0 });
        for (let i = 0; i < 20; i++) {
            const old = p.weaponManager.activeSlot.type;
            randomWeaponSwap(game, p, { amount: 0, damageType: DamageType.Player, gameSourceType: old });
            const now = p.weaponManager.activeSlot.type;
            expect((GameObjectDefs[now] as { quality?: number }).quality).toBe(1);
        }
    });

    it("Fabricate fills the pack with frag grenades every 12 s (conflicts.md perk-fabricate-rule)", () => {
        const { game, p } = setup();
        p.backpack = "backpack02";
        addPerk(p, "fabricate");
        steps(game, 1199);
        expect(p.inv.get("frag")).toBe(0);
        steps(game, 1);
        expect(p.inv.get("frag")).toBe(p.inv.capacity("frag"));
    });
});

describe("Spud Gun", () => {
    it("each hit enlarges the target by 0.06 up to +0.6, shrinking 2.5 s after the last hit (throwables.md)", () => {
        const { game, p } = setup();
        const target = spawnAt(game, v2.add(p.pos, { x: 30, y: 0 }));
        const shot = () =>
            game.explosions.add("explosion_potato_smgshot", target.pos, 0, {
                damageType: DamageType.Player,
                sourceId: p.id,
                gameSourceType: "potato_smg",
            });
        for (let i = 0; i < 3; i++) shot();
        game.step();
        expect(target.scale).toBeCloseTo(1.18, 9);
        steps(game, 249);
        expect(target.scale).toBeCloseTo(1.18, 9);
        // then -0.2 per second
        steps(game, 52);
        expect(target.scale).toBeGreaterThan(1.07);
        expect(target.scale).toBeLessThan(1.11);
        steps(game, 1000);
        expect(target.scale).toBe(1);
    });
});
