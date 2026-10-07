// Event maps through the server (M7b): the play buttons (MODES, /api/site_info), find_game resolving a button index to its
// map and queue, a named map playing its event queue, and every event map hosting a game that bots can join.
import { MapDefs } from "@rebirth/defs";
import { HeadlessClient } from "@rebirth/protocol";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { loadConfig, makeConfig } from "../src/config.ts";
import { GameHost } from "../src/host.ts";
import { defaultModes, defaultTeamMode, parseModes, resolveFindGame } from "../src/modes.ts";
import { type RunningServer, startServer } from "../src/server.ts";
import { roomOf, until } from "./helpers.ts";

describe("air drop tiers (rebirth AIRDROP_TIERS)", () => {
    it("on by default, off restores the v0.8.82 drops; anything else is refused", () => {
        expect(loadConfig({}).airdropTiers).toBe(true);
        expect(loadConfig({ AIRDROP_TIERS: "on" }).airdropTiers).toBe(true);
        expect(loadConfig({ AIRDROP_TIERS: "off" }).airdropTiers).toBe(false);
        // docker compose passes "" for an unset variable: the default
        expect(loadConfig({ AIRDROP_TIERS: "" }).airdropTiers).toBe(true);
        for (const text of ["0", "1", "true", "OFF", "yes", "tier2"]) {
            expect(() => loadConfig({ AIRDROP_TIERS: text }), text).toThrow(/AIRDROP_TIERS/);
        }
    });

    it("is copied into the rules of every game", () => {
        for (const airdropTiers of [true, false]) {
            const host = new GameHost(makeConfig({ log: false, botFill: 0, factionBotFill: 0, airdropTiers }));
            expect(host.findRoom("main", 1)!.game.rules.airdropTiers).toBe(airdropTiers);
            expect(host.findRoom("snow", 2)!.game.rules.airdropTiers).toBe(airdropTiers);
            host.stop();
        }
    });
});

describe("modes (unit)", () => {
    it("MODES lists up to three buttons; a missing team mode is the map's event queue", () => {
        expect(parseModes("main:1,desert,faction:1")).toEqual([
            { mapName: "main", teamMode: 1, enabled: true },
            { mapName: "desert", teamMode: 4, enabled: true },
            { mapName: "faction", teamMode: 4, enabled: true },
        ]);
        expect(() => parseModes("nope:1")).toThrow(/unknown map/);
        expect(() => parseModes("main:3")).toThrow(/team mode/);
        expect(() => parseModes("main,main,main,main")).toThrow(/three/);
        expect(loadConfig({ MODES: "halloween,woods_snow,potato:4" }).modes.map((m) => m.teamMode)).toEqual([1, 2, 4]);
        expect(loadConfig({}).modes).toEqual(defaultModes("main"));
    });

    it("event queues: desert / woods squads, woods snow duos, halloween solo, 50v50 squads (events.md)", () => {
        expect(defaultTeamMode("desert")).toBe(4);
        expect(defaultTeamMode("woods")).toBe(4);
        expect(defaultTeamMode("woods_snow")).toBe(2);
        expect(defaultTeamMode("halloween")).toBe(1);
        expect(defaultTeamMode("faction")).toBe(4);
        expect(defaultTeamMode("savannah")).toBe(1);
    });

    it("find_game: explicit team mode > button index > named map's queue > first button", () => {
        const modes = parseModes("main:1,cobalt:2,desert:4");
        expect(resolveFindGame(modes, {})).toEqual({ mapName: "main", teamMode: 1 });
        expect(resolveFindGame(modes, { gameModeIdx: 1 })).toEqual({ mapName: "cobalt", teamMode: 2 });
        expect(resolveFindGame(modes, { gameModeIdx: 2, teamMode: 1 })).toEqual({ mapName: "desert", teamMode: 1 });
        expect(resolveFindGame(modes, { mapName: "woods" })).toEqual({ mapName: "woods", teamMode: 4 });
        // a named map with a button index keeps the original index meaning (0 solo, 1 duo, 2 squad)
        expect(resolveFindGame(modes, { mapName: "savannah", gameModeIdx: 1 })).toEqual({
            mapName: "savannah",
            teamMode: 2,
        });
        expect(resolveFindGame(modes, { mapName: "faction", teamMode: 1 })).toEqual({
            mapName: "faction",
            teamMode: 4,
        });
    });
});

let server: RunningServer;
const clients: HeadlessClient[] = [];

beforeAll(async () => {
    server = await startServer(
        // one room per event map below plus the earlier tests' rooms, all within the empty-game grace period
        makeConfig({
            port: 0,
            log: false,
            emptyGameGraceMs: 2000,
            maxGames: 64,
            modes: parseModes("main:1,halloween:1,cobalt:4"),
        }),
    );
});

afterEach(async () => {
    for (const c of clients.splice(0)) c.close();
    await until(() => server.sessions.size === 0, 3000, "sessions to close");
});

afterAll(async () => {
    await server.close();
});

describe("event maps through the server", () => {
    it("/api/site_info lists the buttons", async () => {
        const res = await fetch(`${server.url}/api/site_info`);
        const body = (await res.json()) as { modes: unknown[]; clientTheme: string };
        expect(body.modes).toEqual(parseModes("main:1,halloween:1,cobalt:4"));
        expect(body.clientTheme).toBe("main");
    });

    it("a button index plays its map and queue; a named map its event queue", async () => {
        const res = await fetch(`${server.url}/api/find_game`, {
            method: "POST",
            body: JSON.stringify({ gameModeIdx: 2 }),
        });
        const { url } = (await res.json()) as { url: string };
        const c = await HeadlessClient.joinUrl(url, { name: "c" });
        clients.push(c);
        const room = roomOf(server, c.joined!.playerId);
        expect([room.game.options.mapName, room.game.teamMode]).toEqual(["cobalt", 4]);
        const d = await HeadlessClient.join({ baseUrl: server.url, name: "d", mapName: "woods_snow" });
        clients.push(d);
        const room2 = roomOf(server, d.joined!.playerId);
        expect([room2.game.options.mapName, room2.game.teamMode]).toEqual(["woods_snow", 2]);
    });

    it("the DropItem message drops half a bag stack (M7b)", async () => {
        const c = await HeadlessClient.join({ baseUrl: server.url, name: "dropper", mapName: "main" });
        clients.push(c);
        const p = roomOf(server, c.joined!.playerId).game.getPlayer(c.joined!.playerId)!;
        p.inv.set("bandage", 8);
        c.sendDropItem("bandage");
        await until(() => p.inv.get("bandage") === 4, 3000, "drop");
    });

    it("every original event map and seasonal variant hosts a game", async () => {
        const maps = [
            "desert",
            "woods",
            "faction",
            "potato",
            "savannah",
            "halloween",
            "cobalt",
            "snow",
            "turkey",
            "main_spring",
            "main_summer",
            "woods_snow",
            "woods_spring",
            "woods_summer",
            "potato_spring",
            "faction_potato",
        ];
        for (const mapName of maps) {
            expect(Object.hasOwn(MapDefs, mapName)).toBe(true);
            const c = await HeadlessClient.join({ baseUrl: server.url, name: mapName.slice(0, 8), mapName });
            clients.push(c);
            expect(c.map?.mapName).toBe(mapName);
            const room = roomOf(server, c.joined!.playerId);
            expect(room.game.options.mapName).toBe(mapName);
            c.close();
        }
    }, 120_000);
});
