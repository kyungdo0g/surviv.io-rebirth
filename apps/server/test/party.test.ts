// Party rooms (M6a) over real sockets: create a room, join by code, room props and kicks, the leader starts and every
// member joins the same duo / squad game in the same group; lobby errors and limits; solo queueing into team modes
// through find_game; emotes through the game socket.
import { HeadlessClient } from "@rebirth/protocol";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { makeConfig } from "../src/config.ts";
import type { PartyServerMsg } from "../src/party.ts";
import { type RunningServer, startServer } from "../src/server.ts";
import { findGame, roomOf, until } from "./helpers.ts";

let server: RunningServer;
const lobbies: Lobby[] = [];
const clients: HeadlessClient[] = [];

/** A party lobby socket recording every server message. */
class Lobby {
    readonly ws: WebSocket;
    readonly msgs: PartyServerMsg[] = [];
    readonly opened: Promise<void>;
    closed = false;
    readonly ended: Promise<void>;

    constructor(path = "/team_v2") {
        this.ws = new WebSocket(`${server.url.replace("http", "ws")}${path}`);
        this.opened = new Promise((resolve, reject) => {
            this.ws.onopen = () => resolve();
            this.ws.onerror = () => reject(new Error("lobby socket error"));
        });
        this.opened.catch(() => {});
        this.ended = new Promise((resolve) => {
            this.ws.onclose = () => {
                this.closed = true;
                resolve();
            };
        });
        this.ws.onmessage = (ev) => this.msgs.push(JSON.parse(String(ev.data)) as PartyServerMsg);
        lobbies.push(this);
    }

    send(type: string, data?: unknown): void {
        this.ws.send(JSON.stringify(data === undefined ? { type } : { type, data }));
    }

    last<T extends PartyServerMsg["type"]>(type: T): Extract<PartyServerMsg, { type: T }> | undefined {
        for (let i = this.msgs.length - 1; i >= 0; i--) {
            const m = this.msgs[i];
            if (m.type === type) return m as Extract<PartyServerMsg, { type: T }>;
        }
        return undefined;
    }

    async next<T extends PartyServerMsg["type"]>(type: T, after = this.msgs.length) {
        await until(() => this.msgs.slice(after).some((m) => m.type === type), 3000, `lobby ${type}`);
        return this.msgs.slice(after).find((m) => m.type === type) as Extract<PartyServerMsg, { type: T }>;
    }
}

const roomData = (gameModeIdx: number, autoFill = true) => ({ region: "eu", autoFill, gameModeIdx });

async function createRoom(name: string, gameModeIdx = 1, autoFill = true): Promise<{ lobby: Lobby; code: string }> {
    const lobby = new Lobby();
    await lobby.opened;
    lobby.send("create", { roomData: roomData(gameModeIdx, autoFill), playerData: { name } });
    const state = await lobby.next("state");
    return { lobby, code: state.data.room.roomUrl.slice(1) };
}

async function joinRoom(code: string, name: string): Promise<Lobby> {
    const lobby = new Lobby();
    await lobby.opened;
    lobby.send("join", { roomUrl: `#${code}`, playerData: { name } });
    return lobby;
}

beforeAll(async () => {
    server = await startServer(
        makeConfig({ port: 0, log: false, partyJoinTimeoutMs: 300, emptyGameGraceMs: 100, joinTokenTtlMs: 2000 }),
    );
});

afterEach(async () => {
    for (const c of clients.splice(0)) c.close();
    for (const l of lobbies.splice(0)) if (!l.closed) l.ws.close();
    await until(() => server.sessions.size === 0 && server.partySockets.size === 0, 3000, "sockets to close");
});

afterAll(async () => {
    await server.close();
});

describe("party rooms", () => {
    it("create, join by code, start: both members land in the same duo game and group", async () => {
        const { lobby: lead, code } = await createRoom("leader");
        expect(code).toMatch(/^[A-HJ-NP-Za-km-z1-9]{4}$/);
        const created = lead.last("state")!;
        expect(created.data).toMatchObject({
            localPlayerId: 0,
            room: { roomUrl: `#${code}`, gameModeIdx: 1, maxPlayers: 2, autoFill: true, region: "eu" },
            players: [{ name: "leader", playerId: 0, isLeader: true, inGame: false }],
        });
        const mate = await joinRoom(code, "mate");
        const joined = await mate.next("state");
        expect(joined.data.localPlayerId).toBe(1);
        expect(joined.data.players.map((p) => p.name)).toEqual(["leader", "mate"]);
        await until(() => lead.last("state")?.data.players.length === 2, 3000, "leader state");
        // only the leader starts
        mate.send("playGame", { version: 78, region: "eu", zones: [] });
        const before = lead.msgs.length;
        const mateBefore = mate.msgs.length;
        lead.send("playGame", { version: 78, region: "eu", zones: [] });
        const [a, b] = [await lead.next("joinGame", before), await mate.next("joinGame", mateBefore)];
        expect(a.data.url).toMatch(/^ws:\/\/127\.0\.0\.1:\d+\/play\?token=/);
        expect(a.data.token).not.toBe(b.data.token);
        await until(() => lead.last("state")?.data.players.every((p) => p.inGame) === true, 3000, "inGame");
        const ca = await HeadlessClient.joinUrl(a.data.url, { name: "leader" });
        const cb = await HeadlessClient.joinUrl(b.data.url, { name: "mate" });
        clients.push(ca, cb);
        expect(ca.joined?.teamMode).toBe(2);
        expect(ca.joined?.emotes.slice(0, 4)).toEqual([
            "emote_happyface",
            "emote_thumbsup",
            "emote_surviv",
            "emote_sadface",
        ]);
        const room = roomOf(server, ca.joined!.playerId);
        expect(roomOf(server, cb.joined!.playerId)).toBe(room);
        const pa = room.game.getPlayer(ca.joined!.playerId)!;
        const pb = room.game.getPlayer(cb.joined!.playerId)!;
        expect(pa.groupId).toBe(pb.groupId);
        expect(room.teamMode).toBe(2);
        // the team HUD rows reach both clients
        const snap = await cb.waitForSnapshot((s) => (s.local.team?.length ?? 0) === 2);
        expect(snap.local.team?.map((m) => m.name).sort()).toEqual(["leader", "mate"]);
        // a stranger queueing for duo alone does not take a party seat
        const solo = await findGame(server.url, { teamMode: 2 });
        const cs = await HeadlessClient.joinUrl(solo.url, { name: "solo" });
        clients.push(cs);
        const ps = roomOf(server, cs.joined!.playerId).game.getPlayer(cs.joined!.playerId)!;
        expect(ps.groupId).not.toBe(pa.groupId);
        // back in the lobby after the game
        lead.send("gameComplete");
        await until(() => lead.last("state")?.data.players[0].inGame === false, 3000, "gameComplete");
    });

    it("squad rooms: props are leader-only, lowering the size kicks the last members, kicks and leaders", async () => {
        const { lobby: lead, code } = await createRoom("lead", 2, false);
        const others = [await joinRoom(code, "m1"), await joinRoom(code, "m2"), await joinRoom(code, "m3")];
        await until(() => lead.last("state")?.data.players.length === 4, 3000, "4 members");
        // a fifth player gets join_full
        const late = await joinRoom(code, "late");
        expect((await late.next("error")).data.type).toBe("join_full");
        await late.ended;
        // a member cannot change the room
        others[0].send("setRoomProps", roomData(1));
        await new Promise((r) => setTimeout(r, 50));
        expect(lead.last("state")?.data.room.gameModeIdx).toBe(2);
        // name changes are allowed
        others[0].send("changeName", { name: "renamed\u0001" });
        await until(() => lead.last("state")?.data.players[1].name === "renamed", 3000, "rename");
        // the leader switches to duo: m2 and m3 are kicked
        lead.send("setRoomProps", roomData(1, true));
        await others[2].next("kicked");
        await others[1].ended;
        await others[2].ended;
        await until(() => lead.last("state")?.data.players.length === 2, 3000, "2 members");
        expect(lead.last("state")?.data.room).toMatchObject({ gameModeIdx: 1, maxPlayers: 2, autoFill: true });
        // the leader kicks m1, then leaves: the room disappears
        lead.send("kick", { playerId: 1 });
        await others[0].next("kicked");
        await until(() => lead.last("state")?.data.players.length === 1, 3000, "kick");
        lead.ws.close();
        await until(() => !server.lobby.rooms.has(code), 3000, "room removed");
    });

    it("the next member leads when the leader leaves; a no-fill party plays without strangers", async () => {
        const { lobby: lead, code } = await createRoom("lead", 2, false);
        const m1 = await joinRoom(code, "m1");
        const m2 = await joinRoom(code, "m2");
        await until(() => m2.last("state")?.data.players.length === 3, 3000, "3 members");
        lead.ws.close();
        await until(() => m1.last("state")?.data.players.length === 2, 3000, "leader left");
        expect(m1.last("state")?.data.localPlayerId).toBe(0);
        expect(m1.last("state")?.data.players[0]).toMatchObject({ name: "m1", isLeader: true });
        const [b1, b2] = [m1.msgs.length, m2.msgs.length];
        m1.send("playGame", {});
        const [j1, j2] = [await m1.next("joinGame", b1), await m2.next("joinGame", b2)];
        const c1 = await HeadlessClient.joinUrl(j1.data.url, { name: "m1" });
        const c2 = await HeadlessClient.joinUrl(j2.data.url, { name: "m2" });
        clients.push(c1, c2);
        const room = roomOf(server, c1.joined!.playerId);
        expect(room.teamMode).toBe(4);
        const g = room.game.getPlayer(c1.joined!.playerId)!.groupId;
        expect(room.game.getPlayer(c2.joined!.playerId)!.groupId).toBe(g);
        // a stranger queueing for squads gets another group: the party did not allow auto fill
        const solo = await findGame(server.url, { teamMode: 4 });
        const cs = await HeadlessClient.joinUrl(solo.url, { name: "solo" });
        clients.push(cs);
        expect(roomOf(server, cs.joined!.playerId).game.getPlayer(cs.joined!.playerId)!.groupId).not.toBe(g);
    });

    it("lobby errors and limits: unknown codes, messages before a room, malformed JSON, the join timeout", async () => {
        const nobody = await joinRoom("ZZZZ", "x");
        expect((await nobody.next("error")).data.type).toBe("join_not_found");
        await nobody.ended;
        const early = new Lobby("/team");
        await early.opened;
        early.send("keepAlive");
        await early.ended;
        const garbage = new Lobby();
        await garbage.opened;
        garbage.ws.send("{nope");
        await garbage.ended;
        const idle = new Lobby();
        await idle.opened;
        await idle.ended;
        // keepAlive is echoed for members
        const { lobby } = await createRoom("k");
        lobby.send("keepAlive");
        expect((await lobby.next("keepAlive")).type).toBe("keepAlive");
    });

    it("rate limits a flooding socket", async () => {
        const { lobby } = await createRoom("flood");
        for (let i = 0; i < 80; i++) lobby.send("keepAlive");
        await lobby.ended;
        expect(lobby.msgs.some((m) => m.type === "error" && m.data.type === "rate_limited")).toBe(true);
    });
});

describe("team games through find_game and the game socket", () => {
    it("solo queuers auto fill one duo group; emotes and pings go over the Emote message", async () => {
        const a = await HeadlessClient.join({ baseUrl: server.url, name: "a", teamMode: 2 });
        const b = await HeadlessClient.join({ baseUrl: server.url, name: "b", teamMode: 2 });
        clients.push(a, b);
        const room = roomOf(server, a.joined!.playerId);
        expect(roomOf(server, b.joined!.playerId)).toBe(room);
        const pa = room.game.getPlayer(a.joined!.playerId)!;
        const pb = room.game.getPlayer(b.joined!.playerId)!;
        expect(pa.groupId).toBe(pb.groupId);
        a.sendEmote({ type: "ping_danger", isPing: true, pos: { x: 100, y: 200 } });
        const snap = await b.waitForSnapshot((s) => (s.emotes ?? []).some((e) => e.isPing));
        const ping = snap.emotes!.find((e) => e.isPing)!;
        expect(ping).toMatchObject({ playerId: pa.id, type: "ping_danger", isPing: true });
        expect(ping.pos!.x).toBeCloseTo(100, 1);
        expect(ping.pos!.y).toBeCloseTo(200, 1);
        // solo games stay separate from duo games
        const s = await HeadlessClient.join({ baseUrl: server.url, name: "s" });
        clients.push(s);
        expect(roomOf(server, s.joined!.playerId)).not.toBe(room);
        expect(s.joined?.teamMode).toBe(1);
    });
});
