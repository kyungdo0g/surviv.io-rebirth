// survev server parity (docs/handoff/survev-content.md "Survev parity wave", item 2): behaviours of survev's server
// that the audit found missing or different. Each case cites the survev source it follows.
import { createRng, v2 } from "@rebirth/core";
import { DamageType, GameObjectDefs, WeaponSlot } from "@rebirth/defs";
import { describe, expect, it } from "vitest";
import {
    addPerk,
    applyGasDamage,
    canPlayerSpawn,
    defaultModeRules,
    Game,
    killPlayer,
    type Player,
    pickupLoot,
    randomDropCandidates,
    randomSpawnPos,
    randomWeaponSwap,
    terrainSurfaceAt,
} from "../src/index.ts";
import { survevBoxPush } from "../src/match/planes.ts";
import { fireOnce, flatGame, giveGun, openSpot, spawnAt, steps } from "./combatHelpers.ts";
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

describe("spawn points (survev map.ts getRandomSpawnPos / canPlayerSpawn)", () => {
    it("beach sand is a spawn point; water is not (survev only refuses isOnWater)", () => {
        const game = new Game(
            { mapName: "main", seed: 12345 },
            { generation: cachedMap("main", 12345), spawnLoot: false },
        );
        const { width, height, shoreInset } = game.mapData;
        let beach: { x: number; y: number } | undefined;
        for (let x = shoreInset; x < width / 2 && !beach; x += 1) {
            const pos = { x, y: height / 2 };
            if (terrainSurfaceAt(game.world.terrain, pos) === "sand" && !game.world.isOnWater(pos, 0)) beach = pos;
        }
        expect(beach).toBeDefined();
        expect(canPlayerSpawn(game, beach!)).toBe(true);
    });

    it("a spawn point keeps 16 u from an enemy's grenade on the ground layer, not from a teammate's", () => {
        const game = flatGame();
        const pos = openSpot(game, 80);
        const thrower = spawnAt(game, v2.add(pos, { x: 40, y: 0 }));
        holdThrowable(thrower, "frag", 3);
        cookAndThrow(game, thrower, 10, 0);
        const frag = game.projectiles.projectiles.find((p) => p.ownerId === thrower.id)!;
        expect(frag).toBeDefined();
        // the only open spot within reach: a box of 1 u around the grenade
        const near = { min: v2.sub(frag.pos, { x: 0.5, y: 0.5 }), max: v2.add(frag.pos, { x: 0.5, y: 0.5 }) };
        const rng = createRng(1);
        const spot = randomSpawnPos(game, rng, null, near);
        // every candidate is within 16 u of the grenade: none is clear, the first valid one is the fallback
        expect(v2.distance(spot, frag.pos)).toBeLessThan(16);
        const far = { min: v2.sub(frag.pos, { x: 30, y: 30 }), max: v2.add(frag.pos, { x: 30, y: 30 }) };
        for (let i = 0; i < 20; i++) {
            const p = randomSpawnPos(game, rng, null, far);
            expect(v2.distance(p, frag.pos)).toBeGreaterThanOrEqual(16);
        }
        // the thrower's own group ignores it
        const own = randomSpawnPos(game, rng, thrower.group, near);
        expect(v2.distance(own, frag.pos)).toBeLessThan(16);
    });
});

describe("air drops (survev plane.ts addAirdrop, airdrop.ts land)", () => {
    function untilLanded(game: Game): void {
        for (let i = 0; i < 6000; i++) {
            game.step();
            if (game.planes.planes.every((p) => p.actionComplete) && game.planes.airdrops.every((d) => d.landed)) {
                return;
            }
        }
        throw new Error("the crate did not land");
    }

    it("a landing crate crushes a tree whose canopy box it covers, not only its trunk (obstacleAABB)", () => {
        const spot = openSpot(flatGame(), 80);
        // trunk radius 1.55 at 6 u: clear of the 5x5 crate; the canopy box (5.75) reaches under it
        const game = flatGame([{ type: "tree_01", pos: v2.add(spot, { x: 6, y: 0 }) }]);
        const tree = [...game.world.objects.values()].find((o) => o.kind === "obstacle" && o.type === "tree_01")!;
        game.planes.addAirdrop(spot, "airdrop_crate_01");
        untilLanded(game);
        expect(tree.kind === "obstacle" && tree.dead).toBe(true);
    });

    it("an opened crate still keeps a new drop off its spot (dead shells stay in survev's grid)", () => {
        const game = flatGame();
        const spot = openSpot(game, 80);
        game.planes.addAirdrop(spot, "airdrop_crate_01");
        untilLanded(game);
        const shell = [...game.world.objects.values()].find(
            (o) => o.kind === "obstacle" && o.type === "airdrop_crate_01",
        )!;
        if (shell.kind !== "obstacle") throw new Error("no shell");
        shell.dead = true;
        expect(v2.distance(game.planes.findDropPos(spot, "airdrop_crate_01"), spot)).toBeGreaterThanOrEqual(5 - 1e-6);
    });

    it("box crates are pushed along the axis of the larger overlap (survev coldet.ts:405-428)", () => {
        const crate = { min: { x: 10, y: -2 }, max: { x: 15, y: 3 } };
        const box = { min: { x: -20, y: -10 }, max: { x: 20, y: 10 } };
        // x overlaps 10, y overlaps 12: survev moves the crate 12 along y (the core collider would take x)
        expect(survevBoxPush(crate, box)).toEqual({ x: 0, y: 12 });
        expect(survevBoxPush({ min: { x: 30, y: 0 }, max: { x: 35, y: 5 } }, box)).toBeNull();
    });
});

describe("50v50: firing reveals the shooter (survev weaponManager.ts:1013-1025, player.ts:3651-3663)", () => {
    const ids = (game: Game, viewer: Player) =>
        (game.getSnapshot(viewer.id).factionStatus ?? []).map((m) => m.playerId);

    /** A Red shooter with an M9 facing away from a Blue enemy that stands within its own view radius of it. */
    function inSight() {
        const { game, red, blue } = faction();
        const [shooter] = red;
        const [enemy] = blue;
        game.teleportPlayer(enemy.id, v2.add(shooter.pos, { x: enemy.zoom - 5, y: 0 }));
        giveGun(shooter, "m9");
        shooter.dir = { x: 0, y: 1 };
        game.setInput(shooter.id, { ...shooter.input, toMouseDir: { x: 0, y: 1 } });
        return { game, red, blue, shooter, enemy };
    }

    it("off by default in the rebirth: a shot in an enemy's view reveals nothing (user/2026-10-08-faction-feedback)", () => {
        const { game, shooter, enemy } = inSight();
        expect(game.rules.roles.factionRevealTime).toBe(0);
        fireOnce(game, shooter);
        expect(shooter.timeUntilHidden).toBe(0);
        steps(game, 50);
        expect(ids(game, enemy)).not.toContain(shooter.id);
    });

    it("the knob on (survev's 1 s): a shot in an enemy's view puts the shooter on the enemy faction's rows for 1 s; out of view it does not", () => {
        const { game, blue, shooter, enemy } = inSight();
        game.rules.roles.factionRevealTime = 1;
        fireOnce(game, shooter);
        expect(shooter.timeUntilHidden).toBeGreaterThan(0.9);
        steps(game, 50);
        expect(ids(game, enemy)).toContain(shooter.id);
        // its own faction always lists it; the enemy's teammates see it too
        expect(ids(game, blue[1])).toContain(shooter.id);
        steps(game, 120);
        expect(shooter.timeUntilHidden).toBe(0);
        expect(ids(game, enemy)).not.toContain(shooter.id);

        // far away: no reveal
        game.teleportPlayer(enemy.id, v2.add(shooter.pos, { x: enemy.zoom + 20, y: 0 }));
        steps(game, 30);
        fireOnce(game, shooter);
        expect(shooter.timeUntilHidden).toBe(0);
    });
});

describe("gas (survev player.ts:1648-1669)", () => {
    /** A flat game whose gas covers everything and deals `damage` this tick. */
    function gassed(damage: number): { game: Game; p: Player } {
        const game = flatGame();
        const p = spawnAt(game, openSpot(game));
        game.gas.isInGas = () => true;
        game.gas.damage = damage;
        game.gas.doDamage = true;
        return { game, p };
    }

    it("rules.gasDisconnectedDamage: a disconnected player takes survev's flat 22 (off by default)", () => {
        const { game, p } = gassed(5);
        p.disconnected = true;
        applyGasDamage(game, p, 0.01);
        expect(100 - p.health).toBeCloseTo(5, 9);
        game.rules.gasDisconnectedDamage = 22;
        applyGasDamage(game, p, 0.01);
        expect(100 - p.health).toBeCloseTo(27, 9);
    });

    it("runs in the player's own update, after its boost, perks, downed buffer and bleeding", () => {
        const { game, p } = gassed(7);
        p.update(game, 0.01);
        expect(100 - p.health).toBeCloseTo(7, 9);
    });
});

describe("the Commander's automatic flare (rules.roles.leaderAutoFlare; survev player.ts:1478-1495)", () => {
    it("draws the flare gun and fires it through the gun path", () => {
        const { game, red } = faction();
        game.rules.roles.leaderAutoFlare = true;
        game.rules.roles.leaderAutoFlareDelay = 0.5;
        const [cmd] = red;
        game.roles.promote(cmd, "leader");
        const wm = cmd.weaponManager;
        const idx = wm.weapons.findIndex((w) => w.type === "flare_gun" || w.type === "flare_gun_dual");
        expect(idx).toBeGreaterThanOrEqual(0);
        const ammo = wm.weapons[idx].ammo;
        const planes = game.planes.planes.length;
        steps(game, 60);
        expect(cmd.firedFlare).toBe(true);
        expect(wm.curWeapIdx).toBe(idx);
        expect(wm.weapons[idx].ammo).toBe(ammo - 1);
        // the flare's air drop is called where the shot is fired (gun.ts)
        expect(game.planes.planes.length).toBe(planes + 1);
    });
});
