// Teams (M6a): grouping by party key and auto fill, teammate spawns, no team damage (bullets, melee, explosions),
// group-based start, game over, ranks, PlayerStats / GameOver delivery and spectating teammates. Solo behaviour is
// covered by the M4 match tests, which still pass unchanged.
import { v2 } from "@rebirth/core";
import { DamageType, GameConfig, getDefOfType, WeaponSlot } from "@rebirth/defs";
import { describe, expect, it } from "vitest";
import { Game, type Player, type Snapshot, TEAMMATE_SPAWN_RADIUS } from "../src/index.ts";
import { giveGun, openSpot, send, steps } from "./combatHelpers.ts";
import { cachedMap } from "./helpers.ts";
import { addAt, flatTeamGame, hit, party } from "./teamHelpers.ts";

function realGame(teamMode: 1 | 2 | 4, seed = 9): Game {
    return new Game({ mapName: "main", seed, teamMode }, { generation: cachedMap("main", 12345), spawnLoot: false });
}

describe("grouping", () => {
    it("solo: every player is its own group and team, ids 1, 2, ... like M4", () => {
        const game = realGame(1);
        const ps = [0, 1, 2].map((i) => game.getPlayer(game.addPlayer(`p${i}`))!);
        expect(ps.map((p) => [p.teamId, p.groupId])).toEqual([
            [1, 1],
            [2, 2],
            [3, 3],
        ]);
        expect(game.getSnapshot(ps[0].id).local.team).toBeUndefined();
    });

    it("duo / squad: a party key keeps members together, auto fill completes groups, no-fill parties play alone", () => {
        const game = realGame(4);
        const add = (name: string, opts = {}) => game.getPlayer(game.addPlayer(name, opts))!;
        const a = [add("a0", { group: "A", partySize: 2 }), add("a1", { group: "A", partySize: 2 })];
        // two solo queuers fill party A's group (4 seats, 2 reserved)
        const s1 = add("s1");
        const s2 = add("s2");
        // the next solo queuer opens a new auto-fill group
        const s3 = add("s3");
        // a no-fill party of 1 never takes strangers
        const nf = add("nf", { group: "NF", autoFill: false });
        const s4 = add("s4");
        expect(new Set([...a, s1, s2].map((p) => p.groupId)).size).toBe(1);
        expect(s3.groupId).not.toBe(a[0].groupId);
        expect(nf.groupId).not.toBe(s3.groupId);
        expect(s4.groupId).toBe(s3.groupId);
        for (const p of [...a, s1, s2, s3, nf, s4]) expect(p.teamId).toBe(p.groupId);
        // PlayerInfos carry the real group
        const infos = game.getSnapshot(s1.id).playerInfos ?? [];
        expect(infos.find((i) => i.playerId === s1.id)).toMatchObject({ teamId: s1.groupId, groupId: s1.groupId });
        // a full group sends its key's latecomers to a new group
        const g = game.getPlayer(game.addPlayer("a2", { group: "A", partySize: 2 }))!;
        expect(g.groupId).not.toBe(a[0].groupId);
    });

    it("a duo party reserves both seats: a solo queuer never takes the second member's place", () => {
        const game = realGame(2);
        const lead = game.getPlayer(game.addPlayer("lead", { group: "P", partySize: 2 }))!;
        const solo = game.getPlayer(game.addPlayer("solo"))!;
        const mate = game.getPlayer(game.addPlayer("mate", { group: "P", partySize: 2 }))!;
        expect(mate.groupId).toBe(lead.groupId);
        expect(solo.groupId).not.toBe(lead.groupId);
    });

    it("teammates spawn within teammateSpawnRadius of their group's first player, other groups farther away", () => {
        const game = realGame(4, 21);
        const groups: Player[][] = [];
        for (let g = 0; g < 4; g++) {
            const key = `G${g}`;
            groups.push([0, 1, 2, 3].map((i) => game.getPlayer(game.addPlayer(`${key}${i}`, { group: key, partySize: 4 }))!));
        }
        for (const members of groups) {
            const lead = members[0];
            for (const p of members.slice(1)) {
                expect(v2.distance(p.pos, lead.pos)).toBeLessThanOrEqual(TEAMMATE_SPAWN_RADIUS + 1e-9);
                expect(game.canPlayerSpawn(p.pos)).toBe(true);
            }
        }
        for (let i = 0; i < groups.length; i++) {
            for (let j = i + 1; j < groups.length; j++) {
                const d = v2.distance(groups[i][0].pos, groups[j][0].pos);
                expect(d).toBeGreaterThanOrEqual(GameConfig.player.minSpawnRad);
            }
        }
        expect(TEAMMATE_SPAWN_RADIUS).toBe(5);
    });

    it("the group spawn position follows its first player while the group can still fill", () => {
        const game = flatTeamGame(2);
        const at = openSpot(game, 40);
        const lead = addAt(game, "lead", at, { group: "P", partySize: 2 });
        game.teleportPlayer(lead.id, v2.add(at, { x: 30, y: 0 }));
        steps(game, 120);
        const mate = game.getPlayer(game.addPlayer("mate", { group: "P", partySize: 2 }))!;
        expect(v2.distance(mate.pos, lead.pos)).toBeLessThanOrEqual(TEAMMATE_SPAWN_RADIUS + 1e-9);
    });
});

describe("no team damage", () => {
    function squadPair() {
        const game = flatTeamGame(4);
        const at = openSpot(game, 40);
        const [a, b] = party(game, "A", 2, at, 3);
        const enemy = addAt(game, "enemy", v2.add(at, { x: 6, y: 0 }), { group: "E", autoFill: false });
        return { game, a, b, enemy };
    }

    it("teammates' bullets, melee and grenades do nothing; enemies and self damage still apply", () => {
        const { game, a, b, enemy } = squadPair();
        hit(game, b, 30, a);
        expect(b.health).toBe(100);
        expect(a.damageDealt).toBe(0);
        // a frag grenade from A hurts the enemy and A itself, not B
        game.explosions.add("explosion_frag", v2.add(a.pos, { x: 1.5, y: 0 }), 0, {
            gameSourceType: "frag",
            damageType: DamageType.Player,
            sourceId: a.id,
        });
        game.step();
        expect(b.health).toBe(100);
        expect(b.damageTaken).toBe(0);
        expect(a.damageTaken).toBeGreaterThan(0);
        hit(game, b, 30, enemy);
        expect(b.health).toBe(70);
    });

    it("melee swings prefer enemies and obstacles over teammates, and never hurt them", () => {
        const { game, a, b, enemy } = squadPair();
        // A between B (behind its fist) and nothing else: the swing reaches B only, which takes no damage
        game.teleportPlayer(b.id, v2.add(a.pos, { x: 1.4, y: 0 }));
        game.teleportPlayer(enemy.id, v2.add(a.pos, { x: 1.6, y: 0.3 }));
        a.weaponManager.weapons[WeaponSlot.Melee].cooldown = 0;
        send(game, a, { shootStart: true, shootHold: true });
        steps(game, 30);
        send(game, a, {});
        expect(b.health).toBe(100);
        expect(enemy.health).toBeLessThan(100);
    });

    it("a disconnected teammate can be hurt (no kill credit for finishing it)", () => {
        const { game, a, b } = squadPair();
        b.disconnected = true;
        hit(game, b, 30, a);
        expect(b.health).toBe(70);
        expect(a.damageDealt).toBe(0);
    });
});

/** Every snapshot of every player for `ticks` ticks (results arrive once). */
function collect(game: Game, players: readonly Player[], ticks: number, into: Map<number, Snapshot[]>): void {
    for (let i = 0; i < ticks; i++) {
        game.step();
        for (const p of players) {
            const list = into.get(p.id) ?? [];
            list.push(game.getSnapshot(p.id));
            into.set(p.id, list);
        }
    }
}

describe("match results in team modes", () => {
    it("starts with two groups ready, not two players of one group", () => {
        const game = realGame(2);
        game.rules.minActiveTime = 0;
        game.getPlayer(game.addPlayer("a0", { group: "A", partySize: 2 }));
        game.getPlayer(game.addPlayer("a1", { group: "A", partySize: 2 }));
        steps(game, 5);
        expect(game.started).toBe(false);
        game.addPlayer("b0", { group: "B" });
        game.step();
        expect(game.started).toBe(true);
    });

    it("squads: PlayerStats while the group plays on, GameOver to the whole group, ranks per group, one winner", () => {
        const game = flatTeamGame(4);
        game.rules.minActiveTime = 0;
        const at = openSpot(game, 60);
        const A = party(game, "A", 2, at, 3);
        const B = party(game, "B", 2, v2.add(at, { x: 0, y: 30 }), 3);
        const C = party(game, "C", 2, v2.add(at, { x: 0, y: 60 }), 3);
        const all = [...A, ...B, ...C];
        const snaps = new Map<number, Snapshot[]>();
        collect(game, all, 1, snaps);
        expect(game.started).toBe(true);
        expect(game.getSnapshot(A[0].id).local.team?.map((m) => m.playerId)).toEqual(A.map((p) => p.id));

        // C1 is knocked, then C0 dies: C1 is still downed -> team wipe, group C out (rank 3)
        hit(game, C[1], 200, A[0]);
        expect(C[1].downed).toBe(true);
        hit(game, C[0], 200, A[0]);
        expect(C[0].dead && C[1].dead).toBe(true);
        collect(game, all, 2, snaps);
        for (const p of C) {
            const results = (snaps.get(p.id) ?? []).flatMap((s) => (s.gameOver ? [s.gameOver] : []));
            expect(results.length).toBe(1);
            expect(results[0]).toMatchObject({ teamId: p.groupId, teamRank: 3, gameOver: false, winningTeamId: 0 });
            expect(results[0].playerStats.map((s) => s.playerId)).toEqual(C.map((q) => q.id));
            expect((snaps.get(p.id) ?? []).some((s) => s.playerStats)).toBe(false);
        }
        // A0 got the knock credit for C1 (team wipe) and the kill of C0
        expect(A[0].kills).toBe(2);

        // B0 dies alone while B1 stands: PlayerStats only
        hit(game, B[0], 200, A[1]);
        expect(B[0].downed).toBe(true);
        // past the 0.1 s damage buffer
        collect(game, all, 11, snaps);
        hit(game, B[0], 200, A[1]);
        expect(B[0].dead).toBe(true);
        collect(game, all, 2, snaps);
        const b0 = snaps.get(B[0].id) ?? [];
        expect(b0.filter((s) => s.playerStats).length).toBe(1);
        expect(b0.find((s) => s.playerStats)?.playerStats).toMatchObject({ playerId: B[0].id, dead: true });
        expect(b0.some((s) => s.gameOver)).toBe(false);
        expect(game.over).toBe(false);

        // B1 dies: group B is out, A wins
        hit(game, B[1], 200, A[1]);
        expect(B[1].dead).toBe(true);
        collect(game, all, 2, snaps);
        expect(game.over).toBe(true);
        expect(game.match.winningTeamId).toBe(A[0].groupId);
        expect(game.match.winnerIds).toEqual(A.map((p) => p.id));
        for (const p of B) {
            const go = (snaps.get(p.id) ?? []).flatMap((s) => (s.gameOver ? [s.gameOver] : []));
            expect(go.length).toBe(1);
            expect(go[0]).toMatchObject({ teamRank: 2, gameOver: true, winningTeamId: A[0].groupId });
            expect(go[0].playerStats.map((s) => s.playerId)).toEqual(B.map((q) => q.id));
        }
        for (const p of A) {
            const go = (snaps.get(p.id) ?? []).flatMap((s) => (s.gameOver ? [s.gameOver] : []));
            expect(go).toHaveLength(1);
            expect(go[0]).toMatchObject({ teamId: A[0].groupId, teamRank: 1, gameOver: true });
        }
        // group ranking: A 1, B 2, C 3
        const rank = new Map(game.match.ranking().map((r) => [r.playerId, r.rank]));
        expect(A.map((p) => rank.get(p.id))).toEqual([1, 1]);
        expect(B.map((p) => rank.get(p.id))).toEqual([2, 2]);
        expect(C.map((p) => rank.get(p.id))).toEqual([3, 3]);
        // the alive counter still counts players
        expect(game.getSnapshot(A[0].id).aliveCount).toBe(2);
    });

    it("a dead player spectates its living teammates first, and stays on its eliminated group", () => {
        const game = flatTeamGame(2);
        game.rules.minActiveTime = 0;
        const at = openSpot(game, 60);
        const [a0, a1] = party(game, "A", 2, at, 3);
        const [b0] = party(game, "B", 2, v2.add(at, { x: 0, y: 30 }), 3);
        party(game, "C", 1, v2.add(at, { x: 0, y: 60 }), 3);
        game.step();
        hit(game, a0, 200, b0);
        steps(game, 11);
        hit(game, a0, 200, b0);
        expect(a0.dead).toBe(true);
        game.spectate(a0.id, "begin");
        game.step();
        expect(game.spectatingId(a0.id)).toBe(a1.id);
        // next/prev stay within the group
        game.spectate(a0.id, "next");
        steps(game, 20);
        expect(game.spectatingId(a0.id)).toBe(a1.id);
        hit(game, a1, 200, b0);
        expect(a1.dead).toBe(true);
        steps(game, 300);
        expect(game.spectatingId(a0.id)).toBe(a1.id);
    });
});

describe("downed players and weapons", () => {
    it("a downed player cannot shoot, switch, heal or loot; the weapon manager is frozen", () => {
        const game = flatTeamGame(2);
        const at = openSpot(game, 40);
        const [a, b] = party(game, "A", 2, at, 3);
        giveGun(b, "ak47", { reserve: 90 });
        b.inv.set("bandage", 5);
        hit(game, b, 200);
        expect(b.downed).toBe(true);
        expect(b.curWeapIdx).toBe(WeaponSlot.Melee);
        const shots = b.shotSeq;
        send(game, b, { shootStart: true, shootHold: true, actions: [5, 11], useItem: "bandage" });
        steps(game, 50);
        expect(b.shotSeq).toBe(shots);
        expect(b.curWeapIdx).toBe(WeaponSlot.Melee);
        expect(b.action.type).toBe("none");
        expect(b.inv.get("bandage")).toBe(5);
        expect(b.zoom).toBe(GameConfig.scopeZoomRadius.desktop["1xscope"]);
        expect(b.boost).toBe(0);
        void a;
        void getDefOfType;
    });
});
