// The browser client's WsTransport (apps/client/src/net/ws.ts) against the real server: join, map, snapshots
// through the Transport interface, throttled inputs reaching the game, and disconnect reasons.
import { PROTOCOL_HASH } from "@rebirth/defs";
import { DisconnectReason } from "@rebirth/protocol";
import { emptyInput, type MapData, type Snapshot } from "@rebirth/sim";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { describeDisconnect, WsTransport } from "../../client/src/net/ws.ts";
import { makeConfig } from "../src/config.ts";
import { type RunningServer, startServer } from "../src/server.ts";
import { roomOf, until } from "./helpers.ts";

let server: RunningServer;

beforeAll(async () => {
    server = await startServer(makeConfig({ port: 0, log: false }));
});

afterAll(async () => {
    await server.close();
});

describe("WsTransport", () => {
    it("joins, emits the map before snapshots and forwards inputs", async () => {
        const t = new WsTransport({ baseUrl: server.url, name: "web", pingIntervalMs: 1000 });
        const events: string[] = [];
        let map: MapData | null = null;
        let playerId = 0;
        const snaps: Snapshot[] = [];
        t.onJoin((m, id) => {
            events.push("join");
            map = m;
            playerId = id;
        });
        t.onSnapshot((s) => {
            events.push("snapshot");
            snaps.push(s);
        });
        await t.ready;
        await until(() => snaps.length >= 3, 3000, "snapshots");
        expect(events[0]).toBe("join");
        expect(map!.mapName).toBe("main");
        expect(snaps[2].localPlayerId).toBe(playerId);
        expect(snaps[2].objects.some((o) => o.id === playerId)).toBe(true);
        // a late subscriber still gets the join
        let late = 0;
        t.onJoin((_m, id) => {
            late = id;
        });
        expect(late).toBe(playerId);
        // the client calls sendInput every frame; the transport forwards changes, throttled
        const room = roomOf(server, playerId);
        const player = room.game.getPlayer(playerId)!;
        const x0 = player.pos.x;
        for (let i = 0; i < 20; i++) {
            t.sendInput({ ...emptyInput(i), moveRight: true, toMouseDir: { x: 0, y: 1 } });
            await new Promise((r) => setTimeout(r, 5));
        }
        await until(() => player.pos.x > x0 + 0.5, 3000, "player to move");
        expect(player.input.toMouseDir.y).toBeCloseTo(1, 3);
        // Join + one Ping + the inputs: identical inputs after the first change are not resent
        expect(t.connection.framesUp).toBeLessThan(6);
        await until(() => t.rttMs >= 0, 2000, "rtt");
        const reasons: string[] = [];
        t.onDisconnect((r) => reasons.push(r));
        t.close();
        expect(reasons).toEqual(["closed"]);
        await until(() => room.game.getPlayer(playerId) === undefined, 3000, "player removal");
    });

    it("reports a stale protocol through onDisconnect", async () => {
        const reasons: string[] = [];
        const t = new WsTransport({
            baseUrl: server.url,
            protocol: (PROTOCOL_HASH + 7) >>> 0,
            onDisconnect: (r) => reasons.push(r),
        });
        await expect(t.ready).rejects.toThrow();
        expect(reasons).toEqual([DisconnectReason.InvalidProtocol]);
        expect(describeDisconnect(reasons[0])).toMatch(/new version/);
    });

    it("reports an unreachable server", async () => {
        const reasons: string[] = [];
        const t = new WsTransport({ baseUrl: "http://127.0.0.1:1", onDisconnect: (r) => reasons.push(r) });
        await expect(t.ready).rejects.toThrow();
        expect(reasons).toEqual([DisconnectReason.FindGameFailed]);
    });
});
