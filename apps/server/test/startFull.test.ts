// Start when full (the owner's ruling of 2026-10-08, docs/research/rebirth-deviations.md "Start when full"): a game
// that reaches its player cap starts at once (START_WHEN_FULL, sim rules.startWhenFull), and the bot fill joins one bot
// per tick until the start (BOT_FILL_START_INTERVAL_MS 0), so a bot-filled 50v50 game is full and running about a
// second after it opens; after the start the bots trickle in at BOT_FILL_INTERVAL_MS for the rest of the join window.
import { MsgType, ServerMsgDecoder } from "@rebirth/protocol";
import { describe, expect, it } from "vitest";
import { loadConfig, makeConfig } from "../src/config.ts";
import { GameRoom, type RoomMember } from "../src/room.ts";

const member: RoomMember = { ack: 0, bufferedAmount: 0, sendFrame: () => {} };

function playersIn(room: GameRoom): number {
    return [...room.game.players()].length;
}

/** Joins a human and returns its id and the `started` flag of its Joined message. */
function joinHuman(room: GameRoom, name: string): { playerId: number; started: boolean } {
    const { playerId, frame } = room.join(member, name);
    const joined = new ServerMsgDecoder().decode(frame).find((m) => m.type === MsgType.Joined);
    if (!joined || joined.type !== MsgType.Joined) throw new Error("no Joined message");
    return { playerId, started: joined.started };
}

describe("config", () => {
    it("starts full games at once and fills one bot per tick before the start by default", () => {
        expect(loadConfig({})).toMatchObject({
            startWhenFull: true,
            botFillStartIntervalMs: 0,
            botFillIntervalMs: 250,
        });
        expect(loadConfig({ START_WHEN_FULL: "0", BOT_FILL_START_INTERVAL_MS: "100" })).toMatchObject({
            startWhenFull: false,
            botFillStartIntervalMs: 100,
        });
        expect(() => loadConfig({ BOT_FILL_START_INTERVAL_MS: "-1" })).toThrow(/BOT_FILL_START_INTERVAL_MS/);
        expect(() => loadConfig({ START_WHEN_FULL: "maybe" })).toThrow(/START_WHEN_FULL/);
        const room = new GameRoom(makeConfig({ log: false, startWhenFull: false }), "main", 3, 0);
        expect(room.game.rules.startWhenFull).toBe(false);
    });
});

describe("a bot-filled 50v50 room", () => {
    it("is full and started about a second after it opens; later humans take bot seats in the join window", () => {
        const room = new GameRoom(makeConfig({ log: false, factionBotFill: 100 }), "faction", 21, 0, 4);
        expect(room.capacity).toBe(100);
        // the first human arrives 0.3 s after find_game opened the room
        for (let i = 0; i < 30; i++) room.tick();
        expect(room.game.started).toBe(false);
        const first = joinHuman(room, "first");
        expect(first.started).toBe(false);
        let ticks = 30;
        while (!room.game.started && ticks < 300) {
            room.tick();
            ticks++;
        }
        // 99 bots, one per tick, then the full game starts on its next tick (survev would wait 10 s)
        expect(ticks).toBeLessThanOrEqual(101);
        expect(room.game.started).toBe(true);
        expect(room.game.aliveCount).toBe(100);
        expect(room.bots?.count).toBe(99);
        expect(room.game.canJoin()).toBe(false);
        // a human joining the running game takes the seat of a bot that has not fought, while the join window is open
        expect(room.canJoin()).toBe(true);
        const second = joinHuman(room, "second");
        expect(second.started).toBe(true);
        expect([room.game.aliveCount, room.bots?.count]).toEqual([100, 98]);
        // both humans leave young (despawned, survev canDespawn): the bots refill at BOT_FILL_INTERVAL_MS (25 ticks)
        room.leave(first.playerId, 0);
        room.leave(second.playerId, 0);
        expect(playersIn(room)).toBe(98);
        room.tick();
        expect(playersIn(room)).toBe(99);
        for (let i = 0; i < 24; i++) room.tick();
        expect(playersIn(room)).toBe(99);
        room.tick();
        expect(playersIn(room)).toBe(100);
        expect(room.bots?.errors).toBe(0);
    }, 180_000);

    it("a room whose MAX_PLAYERS is below the mode's 80 starts at once when the bots fill its 30 seats", () => {
        const room = new GameRoom(makeConfig({ log: false, maxPlayers: 30, botFill: 30 }), "main", 23, 0);
        expect(room.capacity).toBe(30);
        let ticks = 0;
        while (!room.game.started && ticks < 200) {
            room.tick();
            ticks++;
        }
        expect(ticks).toBeLessThanOrEqual(31);
        expect(room.game.aliveCount).toBe(30);
    }, 60_000);

    it("with START_WHEN_FULL=0 the full room waits for players alive 10 s, as survev", () => {
        const config = makeConfig({ log: false, factionBotFill: 100, startWhenFull: false });
        const room = new GameRoom(config, "faction", 22, 0, 4);
        for (let i = 0; i < 110; i++) room.tick();
        expect(playersIn(room)).toBe(100);
        expect(room.game.started).toBe(false);
    }, 180_000);
});
