// JOIN_MIN_ALIVE: a started game with fewer survivors than the limit takes no new human, find_game opens a fresh game.
import { HeadlessClient } from "@rebirth/protocol";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { makeConfig } from "../src/config.ts";
import { type RunningServer, startServer } from "../src/server.ts";
import { roomOf, until } from "./helpers.ts";

let server: RunningServer;
const clients: Array<{ close(): void }> = [];

beforeAll(async () => {
    server = await startServer(makeConfig({ port: 0, log: false, botFill: 10, botFillIntervalMs: 0, joinMinAlive: 8 }));
});

afterAll(async () => {
    for (const c of clients) c.close();
    await server.close();
});

describe("JOIN_MIN_ALIVE", () => {
    it("lets newcomers in until the match started with fewer survivors than the limit", async () => {
        const alice = await HeadlessClient.join({ baseUrl: server.url, name: "alice" });
        clients.push(alice);
        const room = roomOf(server, alice.joined!.playerId);
        await until(() => room.game.aliveCount === 10, 3000, "the game to fill");
        expect(room.canJoin()).toBe(true);

        room.game.rules.minActiveTime = 0;
        await until(() => room.game.started, 3000, "the match to start");
        expect(room.canJoin()).toBe(true); // 10 alive, limit 8

        for (const p of [...room.game.players()].filter((q) => q.id !== alice.joined!.playerId).slice(0, 3)) {
            room.game.removePlayer(p.id);
        }
        expect(room.game.aliveCount).toBeLessThan(8);
        expect(room.canJoin()).toBe(false);

        const bob = await HeadlessClient.join({ baseUrl: server.url, name: "bob" });
        clients.push(bob);
        // player ids repeat across games, so find bob's game by name
        const bobRoom = [...server.host.rooms.values()].find((r) =>
            [...r.game.players()].some((q) => q.name === "bob"),
        );
        expect(bobRoom).toBeDefined();
        expect(bobRoom).not.toBe(room);
    });
});
