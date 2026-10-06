// Reviving under fire (duo, real simulation): a teammate is knocked down in the open with an armed enemy 25 units off
// aiming at it. The bot does not kneel down in the enemy's sights (8 s of standing still: both would die); it deals
// with the enemy first and revives once the teammate is no longer covered.
import { v2 } from "@rebirth/core";
import { DamageType } from "@rebirth/defs";
import { describe, expect, it } from "vitest";
import { BotController } from "../src/controller.ts";
import { flatGame, giveGun, openSpot, placePlayer, runUntil } from "./helpers.ts";

describe("revive under fire", () => {
    it("fights the enemy covering the downed teammate first, then revives", () => {
        const game = flatGame({ sandbox: true }, 2);
        const spot = openSpot(game);
        const party = { group: "duo", partySize: 2, autoFill: false };
        const me = placePlayer(game, "me", spot, party);
        const mate = placePlayer(game, "mate", v2.add(spot, { x: 3, y: 0 }), party);
        const enemy = placePlayer(game, "enemy", v2.add(spot, { x: 28, y: 4 }), { group: "e", autoFill: false });
        giveGun(me, "mp5");
        giveGun(enemy, "ak47");
        enemy.input = { ...enemy.input, toMouseDir: v2.normalizeSafe(v2.sub(mate.pos, enemy.pos)) };
        game.damagePlayer(mate, {
            amount: 999,
            damageType: DamageType.Player,
            gameSourceType: "ak47",
            sourceId: enemy.id,
            dir: { x: -1, y: 0 },
        });
        expect(mate.downed).toBe(true);
        const bot = new BotController(game, me.id, { seed: 7, difficulty: "normal" });
        let revivedWhileCovered = false;
        // the enemy stands there, aiming at the teammate: no revive while it lives
        runUntil(
            game,
            [bot],
            () => {
                if (!enemy.dead && me.action.type === "revive") revivedWhileCovered = true;
                return enemy.dead;
            },
            1500,
        );
        expect(revivedWhileCovered).toBe(false);
        expect(enemy.dead).toBe(true);
        // then it comes back for the teammate
        const t = runUntil(game, [bot], () => me.action.type === "revive" || !mate.downed, 800);
        expect(t).toBeGreaterThan(0);
    });
});
