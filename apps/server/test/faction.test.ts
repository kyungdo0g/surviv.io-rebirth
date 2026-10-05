// 50v50 and Cobalt through the server (M7a): find_game routes any mode on the faction map into a squad game inside the
// factions that seats FACTION_MAX_PLAYERS, the team mode helpers, faction bot fill knowing the factions, and the
// PerkModeRoleSelect message reaching a Cobalt game.
import { HeadlessClient } from "@rebirth/protocol";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { effectiveTeamMode, isFactionMap, loadConfig, makeConfig, roomCapacity } from "../src/config.ts";
import { GameHost } from "../src/host.ts";
import { type RunningServer, startServer } from "../src/server.ts";
import { roomOf, until } from "./helpers.ts";

let server: RunningServer;
const clients: HeadlessClient[] = [];

beforeAll(async () => {
    server = await startServer(makeConfig({ port: 0, log: false, emptyGameGraceMs: 200 }));
});

afterEach(() => {
    for (const c of clients.splice(0)) c.close();
});

afterAll(async () => {
    await server.close();
});

describe("faction config", () => {
    it("50v50 plays squads in 100-player games; FACTION_BOT_FILL defaults to BOT_FILL scaled to 100", () => {
        expect(isFactionMap("faction") && isFactionMap("faction_potato") && !isFactionMap("main")).toBe(true);
        expect([effectiveTeamMode("faction", 1), effectiveTeamMode("main", 1), effectiveTeamMode("main", 2)]).toEqual([
            4, 1, 2,
        ]);
        const c = loadConfig({ BOT_FILL: "80" });
        expect([c.factionMaxPlayers, c.factionBotFill]).toEqual([100, 100]);
        expect(loadConfig({}).factionBotFill).toBe(0);
        expect(loadConfig({ BOT_FILL: "40", FACTION_BOT_FILL: "10" }).factionBotFill).toBe(10);
        expect([roomCapacity(c, "faction"), roomCapacity(c, "main")]).toEqual([100, 80]);
    });

    it("a faction room fills with bots of both factions up to its target", () => {
        const host = new GameHost(makeConfig({ log: false, botFill: 0, factionBotFill: 30, botFillIntervalMs: 0 }));
        const room = host.findRoom("faction", 1)!;
        expect(room.teamMode).toBe(4);
        expect(room.capacity).toBe(100);
        for (let i = 0; i < 40; i++) room.tick();
        const players = [...room.game.players()];
        expect(players).toHaveLength(30);
        expect(room.game.faction!.aliveCounts()).toEqual([15, 15]);
        host.stop();
    });
});

describe("faction games through find_game", () => {
    it("routes solo and duo queuers on the faction map into one squad game inside the factions", async () => {
        const a = await HeadlessClient.join({ baseUrl: server.url, name: "a", mapName: "faction" });
        const b = await HeadlessClient.join({ baseUrl: server.url, name: "b", mapName: "faction", teamMode: 2 });
        clients.push(a, b);
        expect(a.joined?.teamMode).toBe(4);
        const room = roomOf(server, a.joined!.playerId);
        expect(roomOf(server, b.joined!.playerId)).toBe(room);
        expect(room.capacity).toBe(100);
        const pa = room.game.getPlayer(a.joined!.playerId)!;
        const pb = room.game.getPlayer(b.joined!.playerId)!;
        expect([pa.teamId, pb.teamId]).toEqual([1, 2]);
        const snap = await a.waitForSnapshot((s) => s.teamAliveCounts !== undefined);
        expect(snap.teamAliveCounts).toEqual([1, 1]);
        expect(snap.factionStatus?.map((m) => m.playerId)).toEqual([pa.id]);
    });

    it("the PerkModeRoleSelect message picks a Cobalt class", async () => {
        const c = await HeadlessClient.join({ baseUrl: server.url, name: "c", mapName: "cobalt" });
        clients.push(c);
        const room = roomOf(server, c.joined!.playerId);
        const p = room.game.getPlayer(c.joined!.playerId)!;
        c.sendRoleSelect("leader");
        c.sendRoleSelect("sniper");
        await until(() => p.role !== "", 3000, "class choice");
        expect(p.role).toBe("sniper");
        const snap = await c.waitForSnapshot((s) => s.local.role === "sniper");
        expect(snap.local.perks?.map((x) => x.type)).toEqual(["chambered", "takedown"]);
    });
});
