// A bot ordered to walk somewhere gets there on the real main map (seed 12345): 100 units across buildings and
// obstacles without getting stuck, into a house through its closed door, and deterministically (same seed, same run).
import { type Vec2, v2 } from "@rebirth/core";
import { describe, expect, it } from "vitest";
import { NavGrid } from "../src/nav/grid.ts";
import { cachedMap, mainGame, placeBot, runUntil } from "./helpers.ts";

const gen = cachedMap("main", 12345);
const house = gen.objects.find((o) => o.id === 1391 && o.type === "house_red_02")!;

function walkable(p: Vec2): Vec2 {
    const grid = NavGrid.forMap(gen.mapData);
    return grid.center(grid.nearestWalkable(p, 8));
}

function walk(start: Vec2, goal: Vec2, seed: number, maxTicks: number) {
    const game = mainGame();
    const bot = placeBot(game, start, { seed });
    bot.bot.setOrder({ type: "goto", pos: goal, arriveDist: 1 });
    const player = game.getPlayer(bot.playerId)!;
    const trail: Vec2[] = [];
    const ticks = runUntil(
        game,
        [bot],
        () => {
            if (game.tick % 50 === 0) trail.push(v2.copy(player.pos));
            return v2.distance(player.pos, goal) < 1.5;
        },
        maxTicks,
    );
    return { ticks, pos: v2.copy(player.pos), stuck: bot.bot.follower.stuckEvents, trail, game, player };
}

describe("bot walking", () => {
    it("walks 100 units across the house block without getting stuck", () => {
        const start = walkable({ x: house.pos.x - 50, y: house.pos.y + 2 });
        const goal = walkable({ x: house.pos.x + 50, y: house.pos.y + 2 });
        expect(v2.distance(start, goal)).toBeGreaterThan(95);
        // the straight line runs into the house
        expect(NavGrid.forMap(gen.mapData).lineWalkable(start, goal)).toBe(false);
        const run = walk(start, goal, 3, 3000);
        expect(run.ticks).toBeGreaterThan(0);
        // ~100-130 units at 12 u/s: well under 15 s
        expect(run.ticks).toBeLessThan(1500);
        expect(run.stuck).toBeLessThanOrEqual(2);
        expect(run.player.layer).toBe(0);
    });

    it("is deterministic for the same seed", () => {
        const start = walkable({ x: house.pos.x - 50, y: house.pos.y - 30 });
        const goal = walkable({ x: house.pos.x + 50, y: house.pos.y + 25 });
        const a = walk(start, goal, 11, 3000);
        const b = walk(start, goal, 11, 3000);
        expect(a.ticks).toBeGreaterThan(0);
        expect(b.ticks).toBe(a.ticks);
        expect(b.pos).toEqual(a.pos);
        expect(b.trail).toEqual(a.trail);
    });

    it("opens the closed door to get into a house", () => {
        const start = walkable({ x: house.pos.x + 12, y: house.pos.y + 24 });
        const inside = walkable({ x: house.pos.x + 5, y: house.pos.y + 7 });
        const run = walk(start, inside, 5, 2000);
        expect(run.ticks).toBeGreaterThan(0);
        const doors = gen.objects.filter((o) => o.parentId === house.id && o.type === "house_door_01");
        const opened = doors.some((d) => {
            const o = run.game.world.get(d.id);
            return o?.kind === "obstacle" && o.door?.open;
        });
        expect(opened).toBe(true);
    });
});
