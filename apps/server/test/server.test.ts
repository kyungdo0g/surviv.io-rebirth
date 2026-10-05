// End-to-end server tests: a real server on port 0 and headless clients speaking the protocol over WebSockets.
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join as joinPath } from "node:path";
import { v2 } from "@rebirth/core";
import { getDefOfType, PROTOCOL_HASH, WeaponSlot } from "@rebirth/defs";
import { DisconnectReason, encodeClientMsg, HeadlessClient, MsgType } from "@rebirth/protocol";
import { emptyInput, SNAPSHOT_EVERY_TICKS } from "@rebirth/sim";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { makeConfig } from "../src/config.ts";
import { type RunningServer, startServer } from "../src/server.ts";
import { findGame, rawSocket, roomOf, sleep, until } from "./helpers.ts";

let server: RunningServer;
const clients: HeadlessClient[] = [];

async function join(name = "test"): Promise<HeadlessClient> {
    const c = await HeadlessClient.join({ baseUrl: server.url, name });
    clients.push(c);
    return c;
}

beforeAll(async () => {
    server = await startServer(
        makeConfig({ port: 0, log: false, joinTokenTtlMs: 300, joinTimeoutMs: 400, emptyGameGraceMs: 100 }),
    );
});

afterEach(async () => {
    for (const c of clients.splice(0)) c.close();
    await until(() => server.sessions.size === 0, 3000, "sessions to close");
});

afterAll(async () => {
    await server.close();
});

describe("HTTP", () => {
    it("answers /health", async () => {
        const res = await fetch(`${server.url}/health`);
        expect(res.status).toBe(200);
        expect(await res.json()).toMatchObject({ ok: true });
    });

    it("find_game returns a /play URL with a token and rejects unknown maps", async () => {
        const res = await findGame(server.url, { mapName: "main", region: "eu" });
        expect(res.url).toMatch(/^ws:\/\/127\.0\.0\.1:\d+\/play\?token=/);
        expect(res.url.endsWith(encodeURIComponent(res.token))).toBe(true);
        const bad = await fetch(`${server.url}/api/find_game`, {
            method: "POST",
            body: JSON.stringify({ mapName: "nope" }),
        });
        expect(bad.status).toBe(400);
        expect(await bad.json()).toEqual({ error: "invalid_map" });
        const garbage = await fetch(`${server.url}/api/find_game`, { method: "POST", body: "{" });
        expect(garbage.status).toBe(400);
    });

    it("serves a built client when one exists", async () => {
        const dist = mkdtempSync(joinPath(tmpdir(), "rebirth-dist-"));
        writeFileSync(joinPath(dist, "index.html"), "<!doctype html><title>rebirth</title>");
        writeFileSync(joinPath(dist, "app.js"), "console.log(1)");
        const web = await startServer(makeConfig({ port: 0, log: false, clientDist: dist }));
        try {
            expect(await (await fetch(`${web.url}/`)).text()).toContain("<title>rebirth</title>");
            const js = await fetch(`${web.url}/app.js`);
            expect(js.headers.get("content-type")).toMatch(/javascript/);
            expect(await (await fetch(`${web.url}/some/route`)).text()).toContain("rebirth");
            expect((await fetch(`${web.url}/health`)).status).toBe(200);
        } finally {
            await web.close();
            rmSync(dist, { recursive: true, force: true });
        }
    });
});

describe("joining", () => {
    it("sends Joined + Map, then an Update every SNAPSHOT_EVERY_TICKS ticks", async () => {
        const c = await join("alice");
        expect(c.joined?.playerId).toBeGreaterThan(0);
        expect(c.map?.mapName).toBe("main");
        expect(c.map?.objects.length).toBeGreaterThan(1000);
        const first = await c.waitForSnapshot();
        const second = await c.waitForSnapshot();
        expect(second.tick - first.tick).toBe(SNAPSHOT_EVERY_TICKS);
        expect(second.localPlayerId).toBe(c.joined?.playerId);
        const me = second.objects.find((o) => o.id === c.joined?.playerId);
        expect(me?.kind).toBe("player");
        expect(second.local.health).toBeCloseTo(100, 0);
        expect(second.local.weapons[second.local.curWeapIdx].type).toBe("fists");
        // the client's decoded copy matches the server's own view of the game
        const room = roomOf(server, c.joined!.playerId);
        expect(room.game.getPlayer(c.joined!.playerId)?.name).toBe("alice");
        c.ping();
        await until(() => c.rttMs >= 0, 2000, "pong");
    });

    it("rejects a mismatched protocol hash with invalid_protocol", async () => {
        const c = new HeadlessClient({ baseUrl: server.url, protocol: (PROTOCOL_HASH ^ 0x5a5a) >>> 0 });
        await expect(c.connect()).rejects.toThrow(/invalid_protocol/);
        expect(c.disconnectReason).toBe(DisconnectReason.InvalidProtocol);
    });

    it("tokens are single-use", async () => {
        const { url } = await findGame(server.url);
        const a = await HeadlessClient.joinUrl(url);
        clients.push(a);
        const b = new HeadlessClient();
        await expect(b.connectTo(url)).rejects.toThrow(/invalid_token/);
    });

    it("tokens expire", async () => {
        const { url } = await findGame(server.url);
        await sleep(400);
        const c = new HeadlessClient();
        await expect(c.connectTo(url)).rejects.toThrow(/invalid_token/);
        const missing = rawSocket(url.replace(/token=.*/, ""));
        expect(await missing.ended).toBe(DisconnectReason.InvalidToken);
    });

    it("closes a socket that never sends Join", async () => {
        const { url } = await findGame(server.url);
        const s = rawSocket(url);
        expect(await s.ended).toBe(DisconnectReason.JoinTimeout);
    });
});

describe("packet validation and limits", () => {
    it("disconnects on an invalid packet", async () => {
        const c = await join();
        c.sendRaw(new Uint8Array([200, 1, 2, 3]));
        expect(await c.waitForDisconnect()).toBe(DisconnectReason.InvalidPacket);
    });

    it("disconnects on an Input before Join and on a truncated message", async () => {
        const { url } = await findGame(server.url);
        const s = rawSocket(url);
        await s.opened;
        s.ws.send(encodeClientMsg({ type: MsgType.Input, input: emptyInput(1) }));
        expect(await s.ended).toBe(DisconnectReason.InvalidPacket);
        const c = await join();
        c.sendRaw(encodeClientMsg({ type: MsgType.Input, input: emptyInput(2) }).slice(0, 3));
        expect(await c.waitForDisconnect()).toBe(DisconnectReason.InvalidPacket);
    });

    it("rate limits a flooding socket", async () => {
        const c = await join();
        for (let i = 0; i < 600; i++) c.ping();
        expect(await c.waitForDisconnect()).toBe(DisconnectReason.RateLimited);
    });

    it("applies validated inputs and echoes the seq as ack", async () => {
        const c = await join();
        const id = c.joined!.playerId;
        const room = roomOf(server, id);
        const start = { ...room.game.getPlayer(id)!.pos };
        c.sendInput({ ...emptyInput(42), moveRight: true, toMouseDir: { x: 0, y: -3 }, toMouseLen: 500 });
        await c.waitForSnapshot(() => c.ack === 42);
        await sleep(200);
        const p = room.game.getPlayer(id)!;
        expect(p.input.toMouseDir.y).toBeCloseTo(-1, 3);
        expect(p.input.toMouseLen).toBe(64);
        expect(p.pos.x).not.toBe(start.x);
    });
});

describe("multiplayer", () => {
    it("two clients see each other and bullets from one reach the other", async () => {
        const a = await join("a");
        const b = await join("b");
        const ida = a.joined!.playerId;
        const idb = b.joined!.playerId;
        const room = roomOf(server, ida);
        expect(roomOf(server, idb)).toBe(room);
        const pa = room.game.getPlayer(ida)!;
        // b stands 8 units to the right of a, a holds a loaded AK
        room.game.teleportPlayer(idb, v2.add(pa.pos, { x: 8, y: 0 }));
        await a.waitForSnapshot((s) => s.objects.some((o) => o.id === idb && o.kind === "player"));
        await b.waitForSnapshot((s) => s.objects.some((o) => o.id === ida && o.kind === "player"));
        const pb = room.game.getPlayer(idb)!;
        const def = getDefOfType("gun", "ak47");
        pa.weaponManager.setWeapon(WeaponSlot.Primary, "ak47", def.maxClip);
        pa.weaponManager.setCurWeapIndex(WeaponSlot.Primary);
        pa.weaponManager.freeSwitchTimer = 0;
        pa.weaponManager.weapons[WeaponSlot.Primary].cooldown = 0;
        const dir = v2.normalize(v2.sub(pb.pos, pa.pos));
        a.sendInput({ ...emptyInput(1), toMouseDir: dir, toMouseLen: 8, shootStart: true, shootHold: true });
        const seen = await b.waitForSnapshot((s) => (s.bullets ?? []).some((bl) => bl.shooterId === ida), 3000);
        const bullet = seen.bullets!.find((bl) => bl.shooterId === ida)!;
        expect(bullet.sourceType).toBe("ak47");
        // bullets start at the muzzle, a few units in front of the shooter
        expect(v2.distance(bullet.pos, pa.pos)).toBeLessThan(5);
        // a's shot shows on its player object in b's view too
        await b.waitForSnapshot((s) =>
            s.objects.some((o) => o.id === ida && o.kind === "player" && (o.shot?.seq ?? 0) > 0),
        );
        // when a leaves, b gets the deletion and the game drops the player
        a.close();
        await b.waitForSnapshot((s) => s.deletedIds.includes(ida));
        expect(room.game.getPlayer(ida)).toBeUndefined();
    });

    it("removes empty games after the grace period", async () => {
        const c = await join();
        const room = roomOf(server, c.joined!.playerId);
        c.close();
        await until(() => !server.host.rooms.has(room.id), 3000, "room removal");
    });
});

describe("limits needing their own server", () => {
    let small: RunningServer;
    beforeAll(async () => {
        small = await startServer(makeConfig({ port: 0, log: false, maxConnectionsPerIp: 2, maxPlayers: 1 }));
    });
    afterAll(async () => {
        await small.close();
    });

    it("creates a new game when the current one is full", async () => {
        const first = await HeadlessClient.join({ baseUrl: small.url });
        const second = await HeadlessClient.join({ baseUrl: small.url });
        expect(small.host.rooms.size).toBe(2);
        expect(roomOf(small, first.joined!.playerId)).not.toBe(roomOf(small, second.joined!.playerId));
        // a third socket from the same IP is refused at the upgrade
        const { url } = await findGame(small.url);
        const third = rawSocket(url);
        await expect(third.opened).rejects.toThrow();
        first.close();
        second.close();
        await until(() => small.connectionsPerIp.size === 0, 3000, "connection slots to free");
    });

    it("frees the per-IP slot of sockets refused after the upgrade", async () => {
        for (let i = 0; i < 4; i++) {
            const s = rawSocket(`${small.url.replace("http", "ws")}/play?token=bogus${i}`);
            expect(await s.ended).toBe(DisconnectReason.InvalidToken);
        }
        await until(() => small.connectionsPerIp.size === 0, 3000, "connection slots to free");
        const c = await HeadlessClient.join({ baseUrl: small.url });
        expect(c.joined?.playerId).toBeGreaterThan(0);
        c.close();
        await until(() => small.connectionsPerIp.size === 0, 3000, "connection slots to free");
    });
});
