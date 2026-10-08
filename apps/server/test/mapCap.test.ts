// Maps follow the player cap (defs mapDefForPlayers): a room passes its capacity (MAX_PLAYERS, FACTION_MAX_PLAYERS for
// 50v50) to its game, so a cap above the map's design count plays on a larger map, which the Map message carries; the
// default caps keep the maps' own sizes.
import { MsgType, ServerMsgDecoder } from "@rebirth/protocol";
import { MAX_PLAYERS_IN_GAME } from "@rebirth/sim";
import { describe, expect, it } from "vitest";
import { makeConfig } from "../src/config.ts";
import { GameHost } from "../src/host.ts";
import { GameRoom, type RoomMember } from "../src/room.ts";

/** The map width a client decodes from the room's Map message. */
function decodedWidth(room: GameRoom): number {
    const msg = new ServerMsgDecoder().decode(room.mapMsg).find((m) => m.type === MsgType.Map);
    if (!msg || msg.type !== MsgType.Map) throw new Error("no Map message");
    return msg.map.width;
}

describe("a room's player cap", () => {
    it("grows the map above the design count and the client decodes the size", () => {
        const room = new GameRoom(makeConfig({ log: false, maxPlayers: 160 }), "main", 3, 0, 4);
        expect(room.capacity).toBe(160);
        expect(room.game.options.maxPlayers).toBe(160);
        expect(room.game.mapData.width).toBe(1225);
        expect(decodedWidth(room)).toBe(1225);
        const faction = new GameRoom(makeConfig({ log: false, factionMaxPlayers: 200 }), "faction", 3, 0, 4);
        expect(faction.game.mapData.width).toBe(1415);
        expect(decodedWidth(faction)).toBe(1415);
    });

    it("keeps the maps' own sizes at the default caps and below them", () => {
        const config = makeConfig({ log: false });
        expect(new GameRoom(config, "main", 3, 0, 1).game.mapData.width).toBe(842);
        expect(new GameRoom(config, "main", 3, 0, 4).game.mapData.width).toBe(899);
        expect(new GameRoom(config, "faction", 3, 0, 4).game.mapData.width).toBe(1034);
        expect(new GameRoom(makeConfig({ log: false, maxPlayers: 1 }), "main", 3, 0, 1).game.mapData.width).toBe(842);
    });

    it("never lets a game hold more than 255 players, whoever routed or joined", () => {
        expect(MAX_PLAYERS_IN_GAME).toBe(255);
        const member: RoomMember = { ack: 0, bufferedAmount: 0, sendFrame: () => {} };
        const host = new GameHost(makeConfig({ log: false, maxPlayers: 255, botFill: 0 }));
        const room = host.createRoom("main");
        // players without a seat: bots or humans who left but stay in the game
        for (let i = 0; i < 254; i++) room.game.addPlayer(`gone ${i}`);
        expect([room.isFull, room.canJoin()]).toEqual([false, true]);
        // a party of 2 no longer fits this game: find_game opens another
        expect(host.findRoom("main", 1, 2)).not.toBe(room);
        expect(host.findRoom("main", 1, 1)).toBe(room);
        room.join(member, "last");
        expect(room.gamePlayerCount).toBe(255);
        // full for routing and for a Join that arrives anyway (session.join checks isFull)
        expect([room.isFull, room.canJoin()]).toEqual([true, false]);
        expect(host.findRoom("main", 1, 1)).not.toBe(room);
        for (let i = 0; i < 5; i++) room.tick();
    }, 60_000);
});
