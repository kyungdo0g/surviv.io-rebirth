// Bots that stood still for minutes in real matches (spectated after death): two bots facing each other without a shot
// because a basement obstacle right below counted as cover between them, two bots on either side of a tree stopping
// short of going round it, a bot at a toilet behind an outhouse wall waiting to punch it. Each one now fights or
// moves on; the idle detector (stats) counts what is left.
import { v2 } from "@rebirth/core";
import { describe, expect, it } from "vitest";
import { BotController } from "../src/controller.ts";
import { IdleDetector } from "../src/idle.ts";
import { flatGame, giveGun, openSpot, placePlayer, runUntil } from "./helpers.ts";

function duel(obstacle: { type: string; layer: number } | null, gap: number) {
    const probe = flatGame({ sandbox: true });
    const mid = openSpot(probe);
    const game = flatGame(
        { sandbox: true },
        1,
        obstacle ? [{ type: obstacle.type, pos: mid, layer: obstacle.layer }] : [],
    );
    const bots = [-1, 1].map((side, i) => {
        const p = placePlayer(game, `b${i}`, v2.add(mid, { x: (side * gap) / 2, y: 0 }));
        giveGun(p, "mp5");
        return new BotController(game, p.id, { seed: 10 + i, difficulty: "normal" });
    });
    const players = bots.map((b) => game.getPlayer(b.playerId)!);
    return { game, bots, players };
}

describe("idle bots", () => {
    it("a basement crate right below two bots on the ground does not stop their shots", () => {
        const { game, bots, players } = duel({ type: "crate_01", layer: 1 }, 6);
        const hurt = () => players.some((p) => p.health < 100);
        expect(runUntil(game, bots, hurt, 400)).toBeGreaterThan(0);
        // the bot's own line of fire ignores the floor below
        const m = bots[0].bot.model;
        expect(m.obstacles.some((o) => o.view.layer === 1 && o.solid)).toBe(true);
        expect(m.lineOfFire(players[0].pos, players[1].pos)).toBe(true);
    });

    it("two bots on either side of a tree go round it and fight instead of facing each other", () => {
        const { game, bots, players } = duel({ type: "tree_01", layer: 0 }, 5.7);
        const hurt = () => players.some((p) => p.health < 100);
        expect(runUntil(game, bots, hurt, 1500)).toBeGreaterThan(0);
    });

    it("the idle detector reports a bot that stands still for 5 s without a reason", () => {
        const game = flatGame({ sandbox: true });
        const spot = openSpot(game);
        const p = placePlayer(game, "still", spot);
        const bot = new BotController(game, p.id, { seed: 1 });
        // an order to hold: standing still on purpose
        bot.bot.setOrder({ type: "hold" });
        const det = new IdleDetector();
        for (let i = 0; i < 800; i++) {
            bot.update();
            game.step();
            if (i % 10 === 0) det.sample(game.time, [bot], (id) => game.getPlayer(id));
        }
        expect(det.events).toHaveLength(0);
        // an order to walk somewhere it never moves to (its movement keys are cleared every tick)
        bot.bot.setOrder({ type: "goto", pos: v2.add(spot, { x: 40, y: 0 }) });
        for (let i = 0; i < 800; i++) {
            bot.update();
            game.setInput(p.id, { ...p.input, moveLeft: false, moveRight: false, moveUp: false, moveDown: false });
            game.step();
            if (i % 10 === 0) det.sample(game.time, [bot], (id) => game.getPlayer(id));
        }
        expect(det.events.length).toBe(1);
        const e = det.events[0];
        expect(e.playerId).toBe(p.id);
        expect(e.behaviour).toBe("order");
        expect(e.goalDist).toBeGreaterThan(30);
        expect(det.idleSecondsOf(p.id)).toBeGreaterThan(1);
    });
});
