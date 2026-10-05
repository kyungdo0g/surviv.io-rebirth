// Grenades: the mouse distance the bots use lands throwables where they aim (checked against the simulation's throw
// physics), and a bot facing an enemy hiding behind cover throws a frag at it.
import { v2 } from "@rebirth/core";
import { WeaponSlot } from "@rebirth/defs";
import { emptyInput } from "@rebirth/sim";
import { describe, expect, it } from "vitest";
import { throwMouseLen } from "../src/brain/trigger.ts";
import { flatGame, giveGun, openSpot, placeBot, placePlayer, runUntil } from "./helpers.ts";

/** Throws `item` along +x with the bot's mouse distance for `dist`; returns where it exploded. */
function landing(item: string, dist: number): number {
    const game = flatGame({ sandbox: true });
    const spot = openSpot(game);
    const p = placePlayer(game, "thrower", spot);
    p.inv.set(item, 1);
    p.weaponManager.setWeapon(WeaponSlot.Throwable, item, 0);
    p.weaponManager.setCurWeapIndex(WeaponSlot.Throwable);
    const len = throwMouseLen(item, dist);
    const send = (o: object) =>
        game.setInput(p.id, { ...emptyInput(), toMouseDir: { x: 1, y: 0 }, toMouseLen: len, ...o });
    send({ shootStart: true, shootHold: true });
    game.step();
    for (let i = 0; i < 15; i++) {
        send({ shootHold: true });
        game.step();
    }
    send({});
    let x = spot.x;
    const all = { min: { x: 0, y: 0 }, max: { x: 1000, y: 1000 } };
    for (let i = 0; i < 600; i++) {
        game.step();
        const proj = game.projectiles.views(all);
        if (proj.length) x = proj[0].pos.x;
    }
    return x - spot.x;
}

describe("grenades", () => {
    it("land where the bot aims", () => {
        for (const d of [6, 12, 20, 26]) expect(Math.abs(landing("frag", d) - d)).toBeLessThan(1);
        for (const d of [3, 10, 18]) expect(Math.abs(landing("smoke", d) - d)).toBeLessThan(1);
    });

    it("a bot throws a frag at an enemy hiding behind cover", () => {
        // the flat terrain is the same for every flat game: find the spot first, then build the cover around it. The
        // target crouches in a ring of crates: no line of fire from anywhere, so a frag is the answer.
        const spot = openSpot(flatGame());
        const hide = v2.add(spot, { x: 15, y: 0 });
        const ring = [-1, 0, 1].flatMap((i) =>
            [-1, 0, 1]
                .filter((j) => i !== 0 || j !== 0)
                .map((j) => ({ type: "crate_01", pos: v2.add(hide, { x: i * 4.6, y: j * 4.6 }) })),
        );
        const game = flatGame({ sandbox: true }, 1, ring);
        const bot = placeBot(game, spot, { seed: 12, difficulty: "hard" });
        const p = game.getPlayer(bot.playerId)!;
        giveGun(p, "mp5", 120);
        p.inv.set("frag", 3);
        const target = placePlayer(game, "target", hide);
        const all = { min: { x: 0, y: 0 }, max: { x: 1000, y: 1000 } };
        let landed = { x: 0, y: 0 };
        const thrown = runUntil(game, [bot], () => p.inv.get("frag") < 3, 2000);
        expect(thrown).toBeGreaterThan(0);
        runUntil(
            game,
            [bot],
            () => {
                const proj = game.projectiles.views(all).find((q) => q.type === "frag");
                if (proj) landed = proj.pos;
                return !proj && landed.x !== 0;
            },
            600,
        );
        expect(v2.distance(landed, target.pos)).toBeLessThan(6);
    });
});
