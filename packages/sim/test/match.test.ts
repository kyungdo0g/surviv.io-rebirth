// Match lifecycle (M4): start condition and sandbox, join window, kill events and kill credit (gun, melee, gas,
// air drop), kill leader changes, a scripted 6-player solo match ending with one winner and ranks, GameOver
// delivery, disconnects.
import { v2 } from "@rebirth/core";
import { DamageType, getDefOfType, Input, WeaponSlot } from "@rebirth/defs";
import { describe, expect, it } from "vitest";
import { Game, type KillEvent, type Player, type Snapshot } from "../src/index.ts";
import { flatGame, giveGun, openSpot, send, spawnAt, steps } from "./combatHelpers.ts";
import { cachedMap } from "./helpers.ts";

function mainGame(init: ConstructorParameters<typeof Game>[1] = {}, seed = 7): Game {
    return new Game({ mapName: "main", seed }, { generation: cachedMap("main", 12345), spawnLoot: false, ...init });
}

/** Kills `victim` at once, credited to `killer` (0 for the environment) with `weapon`. */
function kill(
    game: Game,
    victim: Player,
    killer: Player | null,
    weapon = "ak47",
    damageType: number = DamageType.Player,
) {
    game.damagePlayer(victim, {
        amount: 1000,
        damageType,
        gameSourceType: killer ? weapon : undefined,
        sourceId: killer?.id ?? 0,
        dir: { x: 1, y: 0 },
    });
}

/** Starts a match at once: every player counts for the start condition immediately. */
function startedGame(n: number, init: ConstructorParameters<typeof Game>[1] = {}): { game: Game; players: Player[] } {
    const game = mainGame(init);
    game.rules.minActiveTime = 0;
    const players: Player[] = [];
    for (let i = 0; i < n; i++) players.push(game.getPlayer(game.addPlayer(`p${i}`))!);
    game.step();
    expect(game.started).toBe(true);
    return { game, players };
}

describe("start condition", () => {
    it("waits for two players alive for minActiveTime (10 s), then starts the gas", () => {
        const game = mainGame();
        game.addPlayer("alone");
        steps(game, 1500);
        expect(game.started).toBe(false);
        expect(game.gas.mode).toBe(0);
        expect(game.getSnapshot(game.addPlayer("second")).gas?.mode).toBe("inactive");
        steps(game, 999);
        expect(game.started).toBe(false);
        steps(game, 2);
        expect(game.started).toBe(true);
        const id = [...game.players()][0].id;
        const gas = game.getSnapshot(id).gas!;
        expect(gas.mode).toBe("waiting");
        expect(gas.circleIdx).toBe(0);
        expect(gas.duration).toBe(80);
        expect(game.match.startTick).toBe(game.tick - 1);
    });

    it("minPlayers is configurable", () => {
        const game = mainGame({ minPlayers: 1 });
        game.addPlayer("solo");
        steps(game, 1001);
        expect(game.started).toBe(true);
    });

    it("a sandbox starts on the first step with one player and never ends", () => {
        const game = mainGame({ sandbox: true });
        const me = game.getPlayer(game.addPlayer("me"))!;
        const dummy = game.getPlayer(game.addPlayer("dummy"))!;
        game.step();
        expect(game.started).toBe(true);
        expect(game.getSnapshot(me.id).gas?.mode).toBe("waiting");
        kill(game, dummy, me);
        steps(game, 10);
        expect(game.over).toBe(false);
        expect(game.canJoin()).toBe(true);
        kill(game, me, null, "", DamageType.Gas);
        steps(game, 10);
        expect(game.over).toBe(false);
        expect(game.aliveCount).toBe(0);
    });
});

describe("join window", () => {
    it("accepts joins until 60 s after the start, never after game over", () => {
        const { game, players } = startedGame(3);
        expect(game.canJoin()).toBe(true);
        steps(game, 5900);
        expect(game.canJoin()).toBe(true);
        steps(game, 101);
        expect(game.canJoin()).toBe(false);
        const g2 = startedGame(2).game;
        kill(g2, [...g2.players()][1], null, "", DamageType.Gas);
        expect(g2.over).toBe(true);
        expect(g2.canJoin()).toBe(false);
        expect(players.length).toBe(3);
    });

    it("refuses joins once the map's maxPlayers are alive", () => {
        const game = mainGame();
        game.rules.minActiveTime = 1e9;
        for (let i = 0; i < 80; i++) game.addPlayer(`p${i}`);
        expect(game.canJoin()).toBe(false);
        kill(game, [...game.players()][0], null, "", DamageType.Gas);
        expect(game.canJoin()).toBe(true);
    });
});

describe("kill events and credit", () => {
    it("a gun kill credits the shooter and reaches every player once", () => {
        const game = flatGame();
        const spot = openSpot(game);
        const a = spawnAt(game, spot);
        const b = spawnAt(game, v2.add(spot, { x: 6, y: 0 }), { x: -1, y: 0 });
        const c = spawnAt(game, v2.add(spot, { x: 0, y: 30 }));
        giveGun(a, "m870", { reserve: 30 });
        for (const p of [a, b, c]) game.getSnapshot(p.id);
        for (let i = 0; i < 400 && !b.dead; i++) {
            send(game, a, { shootHold: true, shootStart: true });
            game.step();
        }
        expect(b.dead).toBe(true);
        const event: KillEvent = {
            targetId: b.id,
            killerId: a.id,
            killCreditId: a.id,
            killerKills: 1,
            damageType: DamageType.Player,
            source: "gun",
            itemSourceType: "m870",
            mapSourceType: "",
            downed: false,
            killed: true,
        };
        for (const p of [a, b, c]) expect(game.getSnapshot(p.id).kills).toEqual([event]);
        // delivered once
        game.step();
        expect(game.getSnapshot(c.id).kills).toEqual([]);
        expect(b.killedBy).toBe(a.id);
        expect(a.kills).toBe(1);
        expect(game.aliveCount).toBe(2);
    });

    it("a melee kill names the melee weapon", () => {
        const game = flatGame();
        const spot = openSpot(game);
        const a = spawnAt(game, spot);
        const b = spawnAt(game, v2.add(spot, { x: 1.6, y: 0 }), { x: -1, y: 0 });
        a.weaponManager.setWeapon(WeaponSlot.Melee, "machete", 0);
        a.weaponManager.setCurWeapIndex(WeaponSlot.Melee);
        a.weaponManager.freeSwitchTimer = 0;
        a.weaponManager.weapons[WeaponSlot.Melee].cooldown = 0;
        game.getSnapshot(a.id);
        const kills: KillEvent[] = [];
        for (let i = 0; i < 1500 && !b.dead; i++) {
            send(game, a, { shootHold: true, shootStart: true });
            game.step();
            kills.push(...(game.getSnapshot(a.id).kills ?? []));
        }
        expect(b.dead).toBe(true);
        expect(kills).toHaveLength(1);
        expect(kills[0]).toMatchObject({
            killerId: a.id,
            killCreditId: a.id,
            source: "melee",
            itemSourceType: "machete",
        });
    });

    it("the red zone kills without credit and ignores armor", () => {
        const { game, players } = startedGame(2);
        const [a, b] = players;
        b.helmet = "helmet03";
        b.chest = "chest03";
        b.perks.push("flak_jacket", "steelskin");
        // put b outside the circle and wait for the next 2 s damage tick
        game.teleportPlayer(b.id, { x: 1.5, y: 1.5 });
        game.gas.currentRad = 10;
        const before = b.health;
        for (let i = 0; i < 200 && b.health === before; i++) game.step();
        expect(before - b.health).toBeCloseTo(game.gas.damage, 9);
        expect(b.lastHit?.amount).toBeCloseTo(1.4, 9);
        b.health = 1;
        steps(game, 200);
        expect(b.dead).toBe(true);
        expect(b.killedBy).toBe(0);
        const k = game.getSnapshot(a.id).kills!.at(-1)!;
        expect(k).toMatchObject({
            targetId: b.id,
            killerId: 0,
            killCreditId: 0,
            damageType: DamageType.Gas,
            source: "gas",
        });
    });

    it("damage stats and time alive feed local.stats", () => {
        const { game, players } = startedGame(3);
        const [a, b] = players;
        steps(game, 250);
        game.damagePlayer(b, { amount: 30.4, damageType: DamageType.Player, sourceId: a.id });
        const s = game.getSnapshot(a.id).local.stats!;
        expect(s).toEqual({ kills: 0, damageDealt: 30, damageTaken: 0, timeAlive: 2 });
        expect(game.getSnapshot(b.id).local.stats?.damageTaken).toBe(30);
    });
});

describe("kill leader", () => {
    it("needs 3 kills, moves to whoever overtakes, and is announced when promoted and killed", () => {
        const { game, players } = startedGame(10);
        const [a, b, ...rest] = players;
        const watcher = rest.pop()!;
        game.getSnapshot(watcher.id);
        kill(game, rest[0], a);
        kill(game, rest[1], a);
        expect(game.match.killLeader()).toEqual({ id: 0, kills: 0 });
        kill(game, rest[2], a);
        let snap = game.getSnapshot(watcher.id);
        expect(snap.killLeader).toEqual({ id: a.id, kills: 3 });
        expect(snap.roleAnnouncements).toEqual([
            { playerId: a.id, killerId: 0, role: "kill_leader", assigned: true, killed: false },
        ]);
        // b ties at 3: no change; b's 4th kill promotes b
        kill(game, rest[3], b);
        kill(game, rest[4], b);
        kill(game, rest[5], b);
        expect(game.match.killLeaderId).toBe(a.id);
        kill(game, rest[6], b);
        snap = game.getSnapshot(watcher.id);
        expect(snap.killLeader).toEqual({ id: b.id, kills: 4 });
        expect(snap.roleAnnouncements?.map((r) => [r.playerId, r.assigned])).toEqual([[b.id, true]]);
        // the leader dies: announced as killed, nobody left with more kills than the killer's
        kill(game, b, a);
        snap = game.getSnapshot(watcher.id);
        expect(snap.roleAnnouncements).toEqual([
            { playerId: b.id, killerId: a.id, role: "kill_leader", assigned: false, killed: true },
            { playerId: a.id, killerId: 0, role: "kill_leader", assigned: true, killed: false },
        ]);
        expect(snap.killLeader).toEqual({ id: a.id, kills: 4 });
        kill(game, a, null, "", DamageType.Gas);
        snap = game.getSnapshot(watcher.id);
        expect(snap.killLeader).toEqual({ id: 0, kills: 0 });
        expect(snap.roleAnnouncements?.[0]).toMatchObject({ playerId: a.id, killed: true, killerId: 0 });
    });
});

describe("a solo match", () => {
    it("6 scripted players: exactly one winner, ranks and GameOver results", () => {
        const game = mainGame();
        const players: Player[] = [];
        for (let i = 0; i < 6; i++) players.push(game.getPlayer(game.addPlayer(`p${i}`))!);
        const results = new Map<number, Snapshot["gameOver"][]>();
        const collect = () => {
            for (const p of players) {
                const g = game.getSnapshot(p.id).gameOver;
                if (g) results.set(p.id, [...(results.get(p.id) ?? []), g]);
            }
        };
        steps(game, 1001);
        expect(game.started).toBe(true);
        // one real gun kill, then scripted kills in a fixed order
        const [p0, p1, p2, p3, p4, p5] = players;
        game.teleportPlayer(p1.id, v2.add(p0.pos, { x: 5, y: 0 }));
        p0.dir = { x: 1, y: 0 };
        giveGun(p0, "m870", { reserve: 30 });
        for (let i = 0; i < 400 && !p1.dead; i++) {
            send(game, p0, { shootHold: true, shootStart: true, toMouseDir: v2.normalize(v2.sub(p1.pos, p0.pos)) });
            game.step();
            collect();
        }
        expect(p1.dead).toBe(true);
        kill(game, p2, p3, "mp5");
        game.step();
        collect();
        kill(game, p4, null, "", DamageType.Gas);
        game.step();
        collect();
        kill(game, p3, p5, "machete");
        game.step();
        collect();
        expect(game.over).toBe(false);
        expect(game.aliveCount).toBe(2);
        kill(game, p5, p0, "m870");
        expect(game.over).toBe(true);
        game.step();
        collect();
        steps(game, 20);
        collect();

        expect(game.match.winnerIds).toEqual([p0.id]);
        expect(game.match.winningTeamId).toBe(p0.teamId);
        // every player got exactly one result
        for (const p of players) expect(results.get(p.id)?.length).toBe(1);
        const rank = (p: Player) => results.get(p.id)![0]!.teamRank;
        expect([p0, p5, p3, p4, p2, p1].map(rank)).toEqual([1, 2, 3, 4, 5, 6]);
        const win = results.get(p0.id)![0]!;
        expect(win).toMatchObject({ teamId: p0.teamId, teamRank: 1, gameOver: true, winningTeamId: p0.teamId });
        expect(win.playerStats).toEqual([
            {
                playerId: p0.id,
                timeAlive: Math.floor(p0.timeAlive),
                kills: 2,
                dead: false,
                damageDealt: Math.round(p0.damageDealt),
                damageTaken: 0,
            },
        ]);
        // the runner-up learns the winner; earlier victims did not (the match was still running)
        expect(results.get(p5.id)![0]).toMatchObject({ teamRank: 2, gameOver: true, winningTeamId: p0.teamId });
        expect(results.get(p1.id)![0]).toMatchObject({ teamRank: 6, gameOver: false, winningTeamId: 0 });
        expect(results.get(p1.id)![0]!.playerStats[0]).toMatchObject({ playerId: p1.id, dead: true, kills: 0 });
        expect(game.match.ranking().map((r) => r.playerId)).toEqual([p0, p5, p3, p4, p2, p1].map((p) => p.id));
        expect(new Set(players.map((p) => p.teamId)).size).toBe(6);
    });

    it("leaving players: young ones despawn, the others stay idle; the last leaver ends the match", () => {
        const game = mainGame();
        const a = game.getPlayer(game.addPlayer("a"))!;
        const b = game.getPlayer(game.addPlayer("b"))!;
        const young = game.getPlayer(game.addPlayer("young"))!;
        steps(game, 500);
        game.disconnectPlayer(young.id);
        expect(game.getPlayer(young.id)).toBeUndefined();
        steps(game, 600);
        expect(game.started).toBe(true);
        game.disconnectPlayer(b.id);
        expect(game.getPlayer(b.id)?.disconnected).toBe(true);
        game.setInput(b.id, { ...b.input, moveUp: true });
        expect(b.input.moveUp).toBe(false);
        expect(game.aliveCount).toBe(2);
        game.removePlayer(b.id);
        expect(game.over).toBe(true);
        expect(game.match.winnerIds).toEqual([a.id]);
    });
});

describe("spectating", () => {
    it("follows the killer, cycles with next/prev and moves on 2 s after the target died", () => {
        const { game, players } = startedGame(5);
        const [a, b, c, d, e] = players;
        kill(game, a, b, "mp5");
        game.spectate(c.id, "begin");
        expect(game.spectatingId(c.id)).toBe(0);
        game.spectate(a.id, "begin");
        expect(game.spectatingId(a.id)).toBe(b.id);
        let snap = game.getSnapshot(a.id);
        expect(snap.localPlayerId).toBe(b.id);
        expect(snap.spectatingId).toBe(b.id);
        expect(snap.local.health).toBe(b.health);
        expect(snap.objects.some((o) => o.id === b.id)).toBe(true);
        game.step();
        expect(b.spectatorCount).toBe(1);
        expect(game.getSnapshot(b.id).local.spectatorCount).toBe(1);
        // next: the following living player by id, prev goes back; 1 s cooldown in between
        game.spectate(a.id, "next");
        game.step();
        expect(game.spectatingId(a.id)).toBe(c.id);
        game.spectate(a.id, "prev");
        steps(game, 50);
        expect(game.spectatingId(a.id)).toBe(c.id);
        steps(game, 60);
        expect(game.spectatingId(a.id)).toBe(b.id);
        // the target dies: 2 s later the camera moves to its killer
        kill(game, b, e, "ak47");
        steps(game, 150);
        expect(game.spectatingId(a.id)).toBe(b.id);
        steps(game, 60);
        expect(game.spectatingId(a.id)).toBe(e.id);
        // a new spectator of b follows the killer chain: b was killed by e
        game.spectate(b.id, "begin");
        expect(game.spectatingId(b.id)).toBe(e.id);
        snap = game.getSnapshot(a.id);
        expect(snap.localPlayerId).toBe(e.id);
        expect(d.dead).toBe(false);
    });
});

describe("Interact with buttons", () => {
    it("Use and Interact reach a button within its interaction radius only", () => {
        const game = flatGame([{ type: "airdrop_crate_01", pos: { x: 360, y: 300 } }]);
        const crate = [...game.world.objects.values()].find((o) => o.kind === "obstacle")!;
        if (crate.kind !== "obstacle") throw new Error("expected an obstacle");
        const far = spawnAt(game, { x: 360, y: 300 - 2.5 - 1 - 2.2 });
        send(game, far, { actions: [Input.Interact] });
        game.step();
        expect(crate.button?.canUse).toBe(true);
        game.teleportPlayer(far.id, { x: 360, y: 300 - 2.5 - 1.5 });
        send(game, far, { actions: [Input.Use] });
        game.step();
        expect(crate.button).toEqual({ onOff: true, canUse: false, seq: 1 });
        expect(crate.interactedBy).toBe(far.id);
        expect(getDefOfType("gun", "m870").ammo).toBe("12gauge");
    });
});

describe("player infos", () => {
    it("the first snapshot lists every player, later ones the joins and removals since", () => {
        const game = mainGame();
        const a = game.addPlayer("alice");
        const b = game.addPlayer("bob");
        const first = game.getSnapshot(a);
        // the default loadout's heal and boost particles (survev content wave stage 4b)
        const fx = { heal: "heal_basic", boost: "boost_basic" };
        expect(first.playerInfos).toEqual([
            { playerId: a, teamId: 1, groupId: 1, name: "alice", ...fx },
            { playerId: b, teamId: 2, groupId: 2, name: "bob", ...fx },
        ]);
        expect(game.getSnapshot(a).playerInfos).toEqual([]);
        const c = game.addPlayer("carol");
        game.removePlayer(b);
        game.step();
        const next = game.getSnapshot(a);
        expect(next.playerInfos).toEqual([{ playerId: c, teamId: 3, groupId: 3, name: "carol", ...fx }]);
        expect(next.deletedPlayerIds).toEqual([b]);
        expect(game.getSnapshot(c).playerInfos?.map((p) => p.name)).toEqual(["alice", "carol"]);
    });
});
