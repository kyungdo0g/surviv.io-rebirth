// Server console: `give` hands a human a gun with ammo or a bag item, bots are never targets, bad input is refused.
import { HeadlessClient } from "@rebirth/protocol";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { makeConfig } from "../src/config.ts";
import { runCommand } from "../src/console.ts";
import { type RunningServer, startServer } from "../src/server.ts";
import { roomOf } from "./helpers.ts";

let server: RunningServer;
let client: HeadlessClient;

beforeAll(async () => {
    server = await startServer(makeConfig({ port: 0, log: false, botFill: 6, botFillIntervalMs: 0 }));
    client = await HeadlessClient.join({ baseUrl: server.url, name: "alice" });
});

afterAll(async () => {
    client.close();
    await server.close();
});

describe("console give", () => {
    it("lists only the human", () => {
        expect(runCommand(server, "players")).toMatch(/alice/);
        expect(runCommand(server, "players").split("\n")).toHaveLength(1);
    });

    it("gives a gun with full ammo and a bag item", () => {
        const room = roomOf(server, client.joined!.playerId);
        const player = room.game.getPlayer(client.joined!.playerId)!;
        expect(runCommand(server, "give alice m870")).toMatch(/m870 in slot 1/);
        expect(player.weaponManager.weapons[0].type).toBe("m870");
        expect(player.inv.get("12gauge")).toBe(player.inv.capacity("12gauge"));
        expect(runCommand(server, "give me bandage 5")).toMatch(/5x bandage/);
        expect(player.inv.get("bandage")).toBe(5);
    });

    it("refuses unknown players, items and bad counts", () => {
        expect(runCommand(server, "give nobody m870")).toMatch(/no player/);
        expect(runCommand(server, "give me notanitem")).toMatch(/unknown item/);
        expect(runCommand(server, "give me bandage 0")).toMatch(/bad count/);
        expect(runCommand(server, "give me")).toMatch(/usage/);
        expect(runCommand(server, "bogus")).toMatch(/unknown command/);
    });
});
