// Battle-royale loop over the wire (M4): AliveCounts on join and on deaths, the Kill broadcast, GameOver to the
// dying player and the winner, the room closing after the game-over grace period, Spectate requests, and find_game
// keeping new players out of games whose join window closed.
import { DamageType } from "@rebirth/defs";
import {
    type AliveCountsMsg,
    DisconnectReason,
    type GameOverMsg,
    HeadlessClient,
    type KillMsg,
    MsgType,
    type ServerMsg,
    SpectateAction,
} from "@rebirth/protocol";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { makeConfig } from "../src/config.ts";
import { type RunningServer, startServer } from "../src/server.ts";
import { roomOf, until } from "./helpers.ts";

let server: RunningServer;
const clients: HeadlessClient[] = [];

interface Probe {
    client: HeadlessClient;
    id: number;
    msgs: ServerMsg[];
}

async function join(name: string): Promise<Probe> {
    const client = new HeadlessClient({ baseUrl: server.url, name });
    const msgs: ServerMsg[] = [];
    client.onMessage((m) => msgs.push(m));
    await client.connect();
    clients.push(client);
    return { client, id: client.joined!.playerId, msgs };
}

function ofType<T extends ServerMsg["type"]>(p: Probe, type: T): Array<Extract<ServerMsg, { type: T }>> {
    return p.msgs.filter((m): m is Extract<ServerMsg, { type: T }> => m.type === type);
}

beforeAll(async () => {
    server = await startServer(makeConfig({ port: 0, log: false, gameOverGraceMs: 300, emptyGameGraceMs: 100 }));
});

afterEach(async () => {
    for (const c of clients.splice(0)) c.close();
    await until(() => server.sessions.size === 0, 3000, "sessions to close");
    // games that ended or emptied are removed; start the next test with a fresh game
    for (const room of [...server.host.rooms.values()]) server.host.closeRoom(room);
});

afterAll(async () => {
    await server.close();
});

describe("match messages", () => {
    it("AliveCounts, Kill to everyone, GameOver to the loser and the winner, then the room closes", async () => {
        const alice = await join("alice");
        const bob = await join("bob");
        const room = roomOf(server, alice.id);
        expect(roomOf(server, bob.id)).toBe(room);
        expect(alice.client.joined?.started).toBe(false);
        await until(() => ofType(alice, MsgType.AliveCounts).some((m) => m.teamAliveCounts[0] === 2), 3000, "2 alive");
        // names arrive with the updates (the original PlayerInfos): alice's first one lists alice, a later one bob
        const names = () => {
            const out = new Map<number, string>();
            for (const m of ofType(alice, MsgType.Update)) {
                for (const p of m.snapshot.playerInfos ?? []) out.set(p.playerId, p.name);
            }
            return out;
        };
        await until(() => names().size === 2, 3000, "player infos");
        expect(names().get(alice.id)).toBe("alice");
        expect(names().get(bob.id)).toBe("bob");
        expect(ofType(bob, MsgType.AliveCounts)[0]?.teamAliveCounts).toEqual([2]);
        // waiting for players until both were alive 10 s; shorten that
        expect(alice.client.snapshot?.gas?.mode).toBe("inactive");
        room.game.rules.minActiveTime = 0;
        await alice.client.waitForSnapshot((s) => s.gas?.mode === "waiting");
        expect(room.game.started).toBe(true);

        const pb = room.game.getPlayer(bob.id)!;
        room.game.damagePlayer(pb, {
            amount: 500,
            damageType: DamageType.Player,
            gameSourceType: "ak47",
            sourceId: alice.id,
        });
        const expected: KillMsg = {
            type: MsgType.Kill,
            damageType: DamageType.Player,
            itemSourceType: "ak47",
            mapSourceType: "",
            targetId: bob.id,
            killerId: alice.id,
            killCreditId: alice.id,
            killerKills: 1,
            downed: false,
            killed: true,
        };
        await until(() => ofType(alice, MsgType.Kill).length > 0 && ofType(bob, MsgType.Kill).length > 0, 3000, "kill");
        expect(ofType(alice, MsgType.Kill)).toEqual([expected]);
        expect(ofType(bob, MsgType.Kill)).toEqual([expected]);
        await until(() => ofType(alice, MsgType.GameOver).length > 0 && ofType(bob, MsgType.GameOver).length > 0);
        const aliceTeam = room.game.getPlayer(alice.id)!.teamId;
        const loser: GameOverMsg = ofType(bob, MsgType.GameOver)[0];
        expect(loser).toMatchObject({ teamRank: 2, gameOver: true, winningTeamId: aliceTeam });
        expect(loser.playerStats[0]).toMatchObject({ playerId: bob.id, dead: true, kills: 0, damageTaken: 100 });
        const winner = ofType(alice, MsgType.GameOver)[0];
        expect(winner).toMatchObject({ teamId: aliceTeam, teamRank: 1, gameOver: true, winningTeamId: aliceTeam });
        expect(winner.playerStats[0]).toMatchObject({ playerId: alice.id, kills: 1, damageDealt: 100, dead: false });
        // one GameOver each, one AliveCounts per change
        const counts = (p: Probe) => ofType(p, MsgType.AliveCounts).map((m: AliveCountsMsg) => m.teamAliveCounts[0]);
        expect(counts(alice)).toEqual([1, 2, 1]);
        // the decoded snapshot carries the events too
        expect(alice.client.snapshot?.killLeader).toEqual({ id: 0, kills: 0 });
        // the room closes after the grace period
        expect(await alice.client.waitForDisconnect(3000)).toBe(DisconnectReason.GameClosed);
        expect(await bob.client.waitForDisconnect(3000)).toBe(DisconnectReason.GameClosed);
        expect(ofType(alice, MsgType.GameOver)).toHaveLength(1);
        expect(server.host.rooms.has(room.id)).toBe(false);
    });

    it("a dead player spectates its killer through Spectate messages", async () => {
        const a = await join("a");
        const b = await join("b");
        const c = await join("c");
        const room = roomOf(server, a.id);
        room.game.rules.minActiveTime = 0;
        await a.client.waitForSnapshot((s) => s.gas?.mode === "waiting");
        room.game.damagePlayer(room.game.getPlayer(c.id)!, {
            amount: 500,
            damageType: DamageType.Player,
            gameSourceType: "mp5",
            sourceId: b.id,
        });
        const snap = await c.client.waitForSnapshot((s) => s.gameOver !== undefined);
        expect(snap.gameOver).toMatchObject({ teamRank: 3, gameOver: false, winningTeamId: 0 });
        c.client.send({ type: MsgType.Spectate, action: SpectateAction.Begin });
        const spec = await c.client.waitForSnapshot((s) => s.spectatingId === b.id);
        expect(spec.localPlayerId).toBe(b.id);
        expect(spec.objects.some((o) => o.id === b.id)).toBe(true);
        await b.client.waitForSnapshot((s) => s.local.spectatorCount === 1);
        // living players cannot spectate
        a.client.send({ type: MsgType.Spectate, action: SpectateAction.Begin });
        const own = await a.client.waitForSnapshot();
        expect(own.spectatingId).toBe(0);
        expect(own.localPlayerId).toBe(a.id);
    });
});

describe("join window", () => {
    it("find_game does not route players into games past the join window or over", async () => {
        const first = await join("first");
        await join("second");
        const room = roomOf(server, first.id);
        room.game.rules.minActiveTime = 0;
        await first.client.waitForSnapshot((s) => s.gas?.mode === "waiting");
        // still within the window: joins the same game
        const third = await join("third");
        expect(roomOf(server, third.id)).toBe(room);
        // the window closes: the next player gets a new game
        room.game.rules.joinWindowSeconds = 0;
        expect(room.canJoin()).toBe(false);
        const late = await join("late");
        const lateRoom = roomOf(server, late.id);
        expect(lateRoom).not.toBe(room);
        expect(late.client.joined?.started).toBe(false);
        expect(server.host.findRoom("main")).toBe(lateRoom);
    });

    it("the minimum player count comes from MIN_PLAYERS", async () => {
        const solo = await startServer(makeConfig({ port: 0, log: false, minPlayers: 1 }));
        try {
            const c = await HeadlessClient.join({ baseUrl: solo.url });
            const room = [...solo.host.rooms.values()][0];
            room.game.rules.minActiveTime = 0.05;
            await c.waitForSnapshot((s) => s.gas?.mode === "waiting");
            expect(room.game.started).toBe(true);
            c.close();
        } finally {
            await solo.close();
        }
    });
});
