// Maps follow the player cap (defs mapDefForPlayers): a room passes its capacity (MAX_PLAYERS, FACTION_MAX_PLAYERS for
// 50v50) to its game, so a cap above the map's design count plays on a larger map, which the Map message carries; the
// default caps keep the maps' own sizes.
import { MsgType, ServerMsgDecoder } from "@rebirth/protocol";
import { describe, expect, it } from "vitest";
import { makeConfig } from "../src/config.ts";
import { GameRoom } from "../src/room.ts";

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
});
