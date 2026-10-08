// survev server parity (docs/handoff/survev-content.md "Survev parity wave", item 2): behaviours of survev's server
// that the audit found missing or different. Each case cites the survev source it follows.
import { v2 } from "@rebirth/core";
import { DamageType, GameObjectDefs, WeaponSlot } from "@rebirth/defs";
import { describe, expect, it } from "vitest";
import {
    addPerk,
    defaultModeRules,
    Game,
    killPlayer,
    type Player,
    pickupLoot,
    randomDropCandidates,
    randomWeaponSwap,
} from "../src/index.ts";
import { flatGame, giveGun, openSpot, spawnAt, steps } from "./combatHelpers.ts";
import { cookAndThrow, holdThrowable } from "./fxHelpers.ts";
import { cachedMap } from "./helpers.ts";

/** A flat game on `mapName` with a killer and a victim 10 units apart. */
function duel(mapName: string): { game: Game; killer: Player; victim: Player } {
    const game = flatGame();
    Object.assign(game.options, { mapName });
    const pos = openSpot(game);
    const killer = spawnAt(game, pos);
    const victim = spawnAt(game, v2.add(pos, { x: 10, y: 0 }));
    return { game, killer, victim };
}

describe("throwable hits come from the explosion defs (survev explosion.ts:209-243, explosionsDefs.ts)", () => {
    it("every explosion with a freezeDuration has a rule; the heavy snowball slows 2 s, the heavy potato drops 2", () => {
        const hits = defaultModeRules().throwableHits;
        const frozen = Object.entries(GameObjectDefs).filter(
            ([, d]) => d.type === "explosion" && d.freezeDuration !== undefined,
        );
        expect(Object.keys(hits).sort()).toEqual(frozen.map(([id]) => id).sort());
        expect(hits.explosion_snowball_heavy).toMatchObject({ freeze: 2, dropRandomLoot: 1 });
        expect(hits.explosion_potato_heavy).toMatchObject({ freeze: 1, dropRandomLoot: 2 });
        expect(hits.explosion_potato_lmgshot).toMatchObject({ freeze: 0.25, dropRandomLoot: 0, viewShrink: 1.5 });
    });

    it("a heavy potato makes the target drop two random items", () => {
        const { game, killer, victim } = duel("potato");
        victim.inv.set("bandage", 6);
        expect(randomDropCandidates(victim).length).toBeGreaterThan(0);
        game.explosions.add("explosion_potato_heavy", v2.add(victim.pos, { x: -0.5, y: 0 }), victim.layer, {
            damageType: DamageType.Player,
            gameSourceType: "potato_heavy",
            weaponSourceType: "potato",
            sourceId: killer.id,
        });
        steps(game, 1);
        const dropped = [...game.loot.items.values()].filter((l) => l.type === "bandage");
        expect(dropped.length).toBe(2);
        expect(victim.inv.get("bandage") + dropped.reduce((n, l) => n + l.count, 0)).toBe(6);
    });
});

describe("potato swaps follow the weapon the hit started from (survev player.ts:2837-2845, 4046-4049)", () => {
    it("a heavy potato leaves the hand as potato_heavy but credits the potato in hand", () => {
        const { game, killer } = duel("potato");
        holdThrowable(killer, "potato", 3);
        cookAndThrow(game, killer, 110);
        const proj = game.projectiles.projectiles.find((p) => p.ownerId === killer.id);
        expect(proj).toMatchObject({ type: "potato_heavy", sourceType: "potato" });
    });

    it("a MIRV bomblet kill swaps the killer's MIRV (bomblets themselves are noPotatoSwap)", () => {
        const { game, killer, victim } = duel("potato");
        holdThrowable(killer, "mirv", 2);
        game.damagePlayer(victim, {
            amount: 1000,
            damageType: DamageType.Player,
            gameSourceType: "mirv_mini",
            weaponSourceType: "mirv",
            sourceId: killer.id,
            isExplosion: true,
        });
        expect(victim.dead).toBe(true);
        const slot = killer.weaponManager.weapons[WeaponSlot.Throwable].type;
        expect(slot).not.toBe("mirv");
        expect(GameObjectDefs[slot]?.type).toBe("throwable");
    });

    it("no swap when the victim's own hit kills it, nor for a Lone Survivr", () => {
        const { game, killer, victim } = duel("potato");
        holdThrowable(killer, "frag", 2);
        game.damagePlayer(victim, { amount: 10, damageType: DamageType.Player, sourceId: killer.id });
        expect(victim.lastDamagedBy).toBe(killer.id);
        // the victim's own frag finishes it: params.source is the victim
        game.damagePlayer(victim, {
            amount: 1000,
            damageType: DamageType.Player,
            gameSourceType: "frag",
            sourceId: victim.id,
            isExplosion: true,
        });
        expect(victim.dead).toBe(true);
        expect(killer.weaponManager.weapons[WeaponSlot.Throwable].type).toBe("frag");

        const other = duel("potato");
        holdThrowable(other.killer, "frag", 2);
        other.killer.role = "last_man";
        other.game.damagePlayer(other.victim, {
            amount: 1000,
            damageType: DamageType.Player,
            gameSourceType: "frag",
            sourceId: other.killer.id,
            isExplosion: true,
        });
        expect(other.victim.dead).toBe(true);
        expect(other.killer.weaponManager.weapons[WeaponSlot.Throwable].type).toBe("frag");
    });
});

describe("potato swap pool", () => {
    // survev meleeDefs.ts crowbar has no noPotatoSwap (the original's true); port lib/objects.ts SURVEV_ABSENT_IS_OFF
    it("the Crowbar swaps like any melee weapon", () => {
        const { game, killer } = duel("potato");
        killer.weaponManager.setWeapon(WeaponSlot.Melee, "crowbar", 0);
        expect((GameObjectDefs.crowbar as { noPotatoSwap?: boolean }).noPotatoSwap).toBeUndefined();
        randomWeaponSwap(game, killer, { amount: 1, damageType: DamageType.Player, gameSourceType: "crowbar" });
        const melee = killer.weaponManager.weapons[WeaponSlot.Melee].type;
        expect(melee).not.toBe("crowbar");
        expect(GameObjectDefs[melee]?.type).toBe("melee");
    });
});

/** A 50v50 game with `n` players (half per faction, squads of 4) that already started. */
function faction(n = 8): { game: Game; red: Player[]; blue: Player[] } {
    const game = new Game(
        { mapName: "faction", seed: 7, teamMode: 4 },
        { generation: cachedMap("faction", 7, 4), spawnLoot: false },
    );
    game.rules.minActiveTime = 0;
    const players = Array.from({ length: n }, (_, i) => game.getPlayer(game.addPlayer(`p${i}`))!);
    game.step();
    return { game, red: players.filter((p) => p.teamId === 1), blue: players.filter((p) => p.teamId === 2) };
}

function finish(game: Game, target: Player, source: Player): void {
    const hit = () =>
        game.damagePlayer(target, {
            amount: 1000,
            damageType: DamageType.Player,
            sourceId: source.id,
            dir: v2.create(1, 0),
        });
    hit();
    if (!target.downed) return;
    steps(game, 12);
    hit();
}

describe("promotions (survev player.ts promoteToRole)", () => {
    it("never drop the kit's leftover 1x scope (survev inventoryManager.ts:154)", () => {
        const { game, killer: p } = duel("main");
        expect(p.inv.get("1xscope")).toBe(1);
        game.roles.promote(p, "lieutenant");
        game.roles.promote(p, "recon");
        expect([...game.loot.items.values()].some((l) => l.type === "1xscope")).toBe(false);
    });

    it("a role helmet is never swapped for one picked up by hand (survev player.ts:3861)", () => {
        const { game, killer: p } = duel("main");
        game.roles.promote(p, "lieutenant");
        expect(p.hasRoleHelmet).toBe(true);
        const roleHelmet = p.helmet;
        const loot = game.loot.addLoot("helmet04", p.pos, p.layer, 1)!;
        expect(pickupLoot(game, p, loot)).toBe("betterItemEquipped");
        expect(p.helmet).toBe(roleHelmet);
    });

    it("rules.perks.roleDropsLootPerks: a role of 4 or more perks drops the loot perks (off by default)", () => {
        const { game, killer: p } = duel("main");
        addPerk(p, "bonus_9mm", { droppable: true });
        game.roles.promote(p, "last_man");
        expect(p.hasPerk("bonus_9mm")).toBe(true);
        const other = duel("main");
        other.game.rules.perks.roleDropsLootPerks = true;
        addPerk(other.killer, "bonus_9mm", { droppable: true });
        other.game.roles.promote(other.killer, "last_man");
        expect(other.killer.hasPerk("bonus_9mm")).toBe(false);
        expect([...other.game.loot.items.values()].some((l) => l.type === "bonus_9mm")).toBe(true);
    });

    it("the Captain's guns are filled from the bag (its kit has no weapons; survev group.ts:172)", () => {
        const { game, red, blue } = faction();
        game.roles.promote(red[0], "leader");
        game.roles.promote(red[1], "lieutenant");
        giveGun(red[1], "ak47", { ammo: 5, reserve: 20 });
        finish(game, red[0], blue[0]);
        expect(red[1].role).toBe("captain");
        expect([red[1].weaponManager.weapons[WeaponSlot.Primary].ammo, red[1].inv.get("762mm")]).toEqual([25, 0]);
    });

    it("a Lone Survivr's pings reach the whole faction (survev client.ts:607-615)", () => {
        const { game, red } = faction(10);
        const [a, ...rest] = red;
        const mate = rest.find((p) => p.groupId !== a.groupId);
        expect(mate).toBeDefined();
        game.roles.promote(a, "last_man");
        game.emote(a.id, { type: "ping_danger", isPing: true, pos: v2.copy(a.pos) });
        game.step();
        expect((game.getSnapshot(mate!.id).emotes ?? []).map((e) => e.type)).toContain("ping_danger");
    });
});

describe("kill leader and despawning", () => {
    it("a teamkill re-checks the kill leader: the dead leader no longer counts (survev player.ts:2869-2891)", () => {
        const game = flatGame();
        Object.assign(game.options, { mapName: "main" });
        const pos = openSpot(game);
        const [a, b, c] = [0, 1, 2].map((i) => spawnAt(game, v2.add(pos, { x: i * 8, y: 0 })));
        game.rules.killLeaderMinKills = 1;
        [a.kills, b.kills, c.kills] = [3, 1, 2];
        game.match.killLeaderId = a.id;
        // a teammate's credit (friendly fire never reaches here through damage; survev credits one through e.g. a
        // finish after a knock)
        c.teamId = a.teamId;
        a.lastDamagedBy = c.id;
        killPlayer(game, a, { amount: 1000, damageType: DamageType.Player, sourceId: c.id });
        expect(a.dead).toBe(true);
        // no kill counted for the teamkill, but c is now the living player with the most kills
        expect(c.kills).toBe(2);
        expect(game.match.killLeaderId).toBe(c.id);
    });

    it("the start waits for sides with a player that can no longer despawn: a role holder or a downed one", () => {
        // survev gameModeManager.ts:49-63 cantDespawnAliveCount, player.ts:3116-3124 canDespawn
        const game = new Game(
            { mapName: "faction", seed: 7, teamMode: 4 },
            { generation: cachedMap("faction", 7, 4), spawnLoot: false },
        );
        game.rules.minActiveTime = 10;
        const players = Array.from({ length: 8 }, (_, i) => game.getPlayer(game.addPlayer(`p${i}`))!);
        const red = players.filter((p) => p.teamId === 1);
        const blue = players.filter((p) => p.teamId === 2);
        game.step();
        expect(game.match.started).toBe(false);
        game.roles.promote(red[0], "medic");
        game.step();
        expect(game.match.started).toBe(false);
        game.damagePlayer(blue[0], { amount: 1000, damageType: DamageType.Player, sourceId: red[1].id });
        expect(blue[0].downed).toBe(true);
        game.step();
        expect(game.match.started).toBe(true);
    });

    it("a 50v50 role holder never despawns on disconnect (survev canDespawn)", () => {
        const { game, red } = faction();
        game.rules.minActiveTime = 10;
        const fresh = red[0];
        fresh.timeAlive = 0;
        game.roles.promote(fresh, "medic");
        game.disconnectPlayer(fresh.id);
        expect(game.getPlayer(fresh.id)).toBeDefined();
        expect(fresh.disconnected).toBe(true);
        const plain = red[1];
        plain.timeAlive = 0;
        game.disconnectPlayer(plain.id);
        expect(game.getPlayer(plain.id)).toBeUndefined();
    });
});
