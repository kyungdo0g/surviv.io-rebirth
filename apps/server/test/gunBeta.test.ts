// The new-gun beta switch through the server (rebirth GUN_BETA, docs/deploy.md): off by default, validated, and set on
// every game at creation, so the map's floor loot already holds the beta guns.
import { GUN_BETA_FLOOR_COPIES, GUN_BETA_GUNS, GUN_BETA_SURVEV_GUNS, getGunBetaGuns } from "@rebirth/defs";
import { describe, expect, it } from "vitest";
import { loadConfig, makeConfig } from "../src/config.ts";
import { GameHost } from "../src/host.ts";
import { GameRoom } from "../src/room.ts";

describe("new-gun beta (rebirth GUN_BETA)", () => {
    it("off by default; on / 1 / true turn it on, off / 0 / false off, in any case; anything else is refused", () => {
        expect(loadConfig({}).gunBeta).toBe(false);
        // docker compose passes "" for an unset variable: the default
        expect(loadConfig({ GUN_BETA: "" }).gunBeta).toBe(false);
        for (const on of ["on", "1", "true", "ON", "True", " on "]) {
            expect(loadConfig({ GUN_BETA: on }).gunBeta, on).toBe(true);
        }
        for (const off of ["off", "0", "false", "OFF", "False"]) {
            expect(loadConfig({ GUN_BETA: off }).gunBeta, off).toBe(false);
        }
        for (const text of ["yes", "beta", "2", "o n"]) {
            // the message names every accepted value
            expect(() => loadConfig({ GUN_BETA: text }), text).toThrow(
                /GUN_BETA: expected "on", "off", "1", "0", "true" or "false"/,
            );
        }
    });

    it("is set on every game before its map loot spawns", () => {
        const betaGuns = (gunBeta: boolean) => {
            const host = new GameHost(makeConfig({ log: false, botFill: 0, factionBotFill: 0, gunBeta }));
            const game = host.findRoom("main", 1)!.game;
            expect(game.rules.gunBeta).toBe(gunBeta);
            const n = [...game.loot.items.values()].filter((l) => GUN_BETA_GUNS.includes(l.type)).length;
            host.stop();
            return n;
        };
        const off = betaGuns(false);
        const on = betaGuns(true);
        expect(on).toBeGreaterThan(off);
    });

    it("with GUN_BETA on, every main game's floor holds every beta gun, the Barrett included (the owner could not find it)", () => {
        // games through the server's rooms (fixed seeds: the host picks random ones); each seed on its own
        const config = makeConfig({ log: false, botFill: 0, factionBotFill: 0, gunBeta: true });
        const guns = getGunBetaGuns("main");
        expect(guns).toEqual(GUN_BETA_GUNS);
        expect(guns).toEqual(expect.arrayContaining([...GUN_BETA_SURVEV_GUNS, "rpg7", "m202", "boys", "dshk"]));
        for (const seed of [1, 2, 3, 4]) {
            const room = new GameRoom(config, "main", seed, 0);
            const counts = new Map<string, number>();
            for (const l of room.game.loot.items.values()) counts.set(l.type, (counts.get(l.type) ?? 0) + 1);
            const missing = guns.filter((g) => (counts.get(g) ?? 0) < GUN_BETA_FLOOR_COPIES);
            expect(missing, `seed ${seed}`).toEqual([]);
        }
    });
});
