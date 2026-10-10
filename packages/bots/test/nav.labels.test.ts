// Component labels and per-game grids (nav/components.ts, nav/grid.ts NavGrid.forMap):
// - a crate blocking the only corridor into a room breaks: the room joins the bot's component at once (the labels used
//   to wait for 60 changes and 600 queries, and a bot in the crossing bunker's storage stood behind the broken crate
//   for 12 s), and a bot with a goal in the room gets its route within a second; a crate in the open breaking does not
//   relabel the grid; a leg on another grid is no join: the room stays given up while the crate stands;
// - each game's grid starts from the map's own state: games on one MapData (the tests reuse a generated map) used to
//   share one grid, so a door opened or a crate broken in one game was open or gone in the next.
import { createRng, type Vec2, v2 } from "@rebirth/core";
import { DamageType } from "@rebirth/defs";
import {
    Game,
    type GeneratedObject,
    type GenerateMapResult,
    interactObstacle,
    type MapObjectSpawn,
    type ObstacleView,
} from "@rebirth/sim";
import { describe, expect, it } from "vitest";
import { BotController } from "../src/controller.ts";
import { findPath } from "../src/nav/astar.ts";
import { doorKey } from "../src/nav/cellGrid.ts";
import { PathFollower } from "../src/nav/follower.ts";
import { NavGrid } from "../src/nav/grid.ts";
import { UndergroundNav } from "../src/nav/underground.ts";
import { WorldModel } from "../src/perception/world.ts";
import { cachedMap, firstOfType, flatGame, mainGame, openSpot, placePlayer } from "./helpers.ts";

type Piece = { type: string; pos: Vec2; ori?: number };

/**
 * A 20 x 20 room east of `c` whose only way in is an L-shaped corridor (metal walls on the flat main terrain): 7 wide
 * from its mouth 22 units north of `c`, south to `c`, then 9 units east into the room; a crate across its first leg.
 * A straight walk from the mouth to the room meets walls: only a planned route gets in.
 */
function corridorPieces(c: Vec2): { pieces: Piece[]; crate: Vec2; room: Vec2; outside: Vec2 } {
    const at = (x: number, y: number) => v2.add(c, { x, y });
    const wall = (n: number, x: number, y: number, ori = 0): Piece => ({
        type: `metal_wall_ext_${n}`,
        pos: at(x, y),
        ori,
    });
    const pieces: Piece[] = [
        // the room: x 0..20, y -10..10, open on the west between y -3 and 3
        wall(23, 10, -10.5, 1),
        wall(23, 10, 10.5, 1),
        wall(23, 20.5, 0),
        wall(8, -0.5, -7),
        wall(8, -0.5, 7),
        // the corridor's east leg (y -3..3, x -9..0) and its north leg (x -9..-2, y -22..-3)
        wall(10, -5, 3.5, 1),
        wall(13, -9.5, -2.5),
        wall(13, -9.5, -15.5),
        wall(10, -1.5, -8),
        wall(9, -1.5, -17.5),
    ];
    const crate = at(-5.5, -12);
    pieces.push({ type: "crate_01", pos: crate });
    return { pieces, crate, room: at(10, 0), outside: at(-5.5, -32) };
}

/** Whether the follower's plan leads from `pos` to `goal`: every leg passable, the last point at the goal. */
function routeTo(grid: NavGrid, pos: Vec2, points: readonly Vec2[], goal: Vec2): boolean {
    const end = points.at(-1);
    if (!end || v2.distance(end, goal) > 1.5) return false;
    let prev = pos;
    for (const q of points) {
        if (!grid.linePassable(prev, q)) return false;
        prev = q;
    }
    return true;
}

/** The flat main terrain with `pieces` in the game and in its MapData (the grid knows them from the start). */
function pieceGeneration(pieces: Piece[]): GenerateMapResult {
    const gen = cachedMap("main", 12345);
    const objects: GeneratedObject[] = pieces.map((p, i) => ({
        id: i + 1,
        kind: "obstacle",
        type: p.type,
        pos: v2.copy(p.pos),
        ori: p.ori ?? 0,
        scale: 1,
        layer: 0,
        parentId: 0,
    }));
    const spawns: MapObjectSpawn[] = objects.map((o) => ({
        id: o.id,
        type: o.type,
        pos: o.pos,
        ori: o.ori,
        scale: 1,
        layer: 0,
    }));
    return { ...gen, objects, lootSpawns: [], mapData: { ...gen.mapData, objects: spawns } };
}

function deadView(id: number, type: string, pos: Vec2): ObstacleView {
    return { id, kind: "obstacle", type, pos, layer: 0, ori: 0, scale: 1, healthT: 0, dead: true };
}

const center = openSpot(flatGame(), 30);
const layout = corridorPieces(center);
const generation = pieceGeneration(layout.pieces);
const crateId = layout.pieces.length;

describe("component labels", () => {
    it("join the room behind a corridor at once when the crate blocking it breaks", () => {
        const grid = new NavGrid(generation.mapData);
        const before = grid.relabels;
        expect(grid.walkableAt(layout.crate)).toBe(false);
        expect(grid.reachable(layout.outside, layout.room)).toBe(false);
        expect(findPath(grid, layout.outside, layout.room)).toBeNull();
        grid.observeObstacle(deadView(crateId, "crate_01", layout.crate));
        // the freed cells border both parts: one relabel, at the next query
        expect(grid.reachable(layout.outside, layout.room)).toBe(true);
        expect(grid.relabels).toBe(before + 1);
        const path = findPath(grid, layout.outside, layout.room);
        expect(path?.complete).toBe(true);
        expect(v2.distance(path?.points.at(-1) ?? layout.outside, layout.room)).toBeLessThan(1.5);
    });

    it("label a crate broken in the open with its surroundings, without relabelling the grid", () => {
        const grid = new NavGrid(generation.mapData);
        const spot = v2.add(center, { x: -25, y: 25 });
        const crate = { id: 999999, type: "crate_01", pos: spot };
        grid.observeObstacle({ ...deadView(crate.id, crate.type, crate.pos), healthT: 1, dead: false });
        // (a learnt obstacle only adds: the labels still call its cells' surroundings one component)
        grid.labelComponents();
        const before = grid.relabels;
        expect(grid.walkableAt(spot)).toBe(false);
        grid.observeObstacle(deadView(crate.id, crate.type, crate.pos));
        expect(grid.walkableAt(spot)).toBe(true);
        const around = grid.nearestWalkable(v2.add(spot, { x: 6, y: 0 }), 2);
        expect(grid.component(grid.cellOf(spot))).toBe(grid.component(around));
        expect(grid.relabels).toBe(before);
    });

    it("give a bot whose goal lies behind the crate its route within a second of the crate breaking", () => {
        const game = new Game({ mapName: "main", seed: 12345, teamMode: 1 }, { generation, spawnLoot: false });
        for (let k = 0; k < 4; k++) placePlayer(game, `dummy${k}`, v2.add(center, { x: -60 + k * 20, y: 60 }));
        const p = placePlayer(game, "bot", layout.outside);
        const bot = new BotController(game, p.id, { seed: 3, brain: "smart" });
        bot.bot.setOrder({ type: "goto", pos: layout.room });
        const step = () => {
            bot.update();
            game.step();
        };
        // three seconds with the crate across the corridor: no way in
        const inRoom = () => p.pos.x > center.x && p.pos.x < center.x + 20 && Math.abs(p.pos.y - center.y) < 10;
        for (let i = 0; i < 300; i++) step();
        expect(inRoom()).toBe(false);
        expect(routeTo(bot.bot.model.nav, p.pos, bot.bot.follower.points, layout.room)).toBe(false);
        const crate = game.world.get(crateId);
        if (crate?.kind !== "obstacle") throw new Error("no crate");
        game.damageObstacle(crate, { amount: 1000, damageType: DamageType.Player });
        expect(crate.dead).toBe(true);
        let routed = -1;
        for (let i = 0; i < 100 && routed < 0; i++) {
            step();
            if (routeTo(bot.bot.model.nav, p.pos, bot.bot.follower.points, layout.room)) routed = i;
        }
        expect(routed).toBeGreaterThanOrEqual(0);
        // ...and walks in
        for (let i = 0; i < 600 && !inRoom(); i++) step();
        expect(inRoom()).toBe(true);
    });

    it("keep the room given up while the crate stands, when the follower walks a leg on another grid meanwhile", () => {
        const grid = new NavGrid(generation.mapData);
        const m = new WorldModel(generation.mapData, grid);
        m.self.pos = v2.copy(layout.outside);
        const f = new PathFollower(createRng(4));
        // walked up to the reachable cell nearest the room, where the goal fails and is remembered as cut off
        let t = 0;
        let r = f.steerOn(m, grid, layout.room, t);
        while (!r.failed && t < 10) {
            const next = r.dir ? v2.add(m.self.pos, v2.mul(r.dir, 0.6)) : m.self.pos;
            if (grid.walkableAt(next)) m.self.pos = next;
            t += 0.05;
            r = f.steerOn(m, grid, layout.room, t);
        }
        expect(r.failed).toBe(true);
        // a leg on another grid (an underground floor's: its own join count) to a goal at hand
        const other = new NavGrid(generation.mapData);
        other.relabelSoon();
        expect(other.joins).not.toBe(grid.joins);
        const near = other.center(other.nearestWalkable(v2.add(m.self.pos, { x: 0, y: -3 }), 3));
        f.steerOn(m, other, near, t + 0.05);
        // back on the first grid nothing joined: the room still fails at once, without a new search
        const again = f.steerOn(m, grid, layout.room, t + 0.1);
        expect(again.failed).toBe(true);
        expect(f.points.length).toBe(0);
    });
});

describe("per-game grids", () => {
    it("start a second game on the same map data with its doors closed and its crates whole", () => {
        const gen = cachedMap("main", 12345);
        const house = firstOfType(gen, "house_red_02", 0);
        const door = gen.objects.find((o) => o.parentId === house.id && o.type === "house_door_01");
        if (!door) throw new Error("no door");
        // the crate nearest the door, as the map has it
        const crates = gen.objects.filter((o) => o.type === "crate_01" && o.layer === 0);
        const crate = crates.sort((a, b) => v2.distance(a.pos, door.pos) - v2.distance(b.pos, door.pos))[0];
        const start = (name: string) => {
            const game = mainGame();
            // outside, between the door and the crate (at +25, -15 from it since the rebirth buildings' rework moved
            // main 12345's layout, 2026-10-10): both in view
            const p = placePlayer(game, name, v2.add(door.pos, { x: 12, y: -7 }));
            const bot = new BotController(game, p.id, { seed: 1, brain: "smart" });
            bot.bot.setOrder({ type: "hold" });
            return { game, bot };
        };
        const a = start("a");
        const gridA = a.bot.bot.model.nav;
        // game a: a player opens the door, the crate breaks, its bot sees both
        const opener = placePlayer(a.game, "opener", v2.add(door.pos, { x: 0, y: 2 }));
        const doorObj = a.game.world.get(door.id);
        if (doorObj?.kind !== "obstacle") throw new Error("no door obstacle");
        interactObstacle(a.game, doorObj, opener);
        const crateObj = a.game.world.get(crate.id);
        if (crateObj?.kind !== "obstacle") throw new Error("no crate obstacle");
        a.game.damageObstacle(crateObj, { amount: 1000, damageType: DamageType.Player });
        for (let i = 0; i < 60; i++) {
            a.bot.update();
            a.game.step();
        }
        expect(doorObj.door?.open).toBe(true);
        expect(gridA.isStamped(doorKey(door.id))).toBe(true);
        expect(gridA.isStamped(crate.id)).toBe(false);

        // game b on the same MapData: its own grid, the door closed and the crate there
        const b = start("b");
        const gridB = b.bot.bot.model.nav;
        expect(b.game.mapData).toBe(a.game.mapData);
        // (identity checks as booleans: a failing toBe deep-compares two grids for its message)
        expect(gridB === gridA).toBe(false);
        expect(gridB.isStamped(doorKey(door.id))).toBe(false);
        expect(gridB.isStamped(crate.id)).toBe(true);
        expect(gridB.walkableAt(crate.pos)).toBe(false);
        // the same cells as a grid built from the map; the bots of one game share it; game a keeps what it saw
        const fresh = new NavGrid(gen.mapData, { sealedDoors: true });
        expect(Buffer.compare(gridB.blocked, fresh.blocked)).toBe(0);
        expect(Buffer.compare(gridB.tight, fresh.tight)).toBe(0);
        expect(Buffer.compare(gridB.doorMask, fresh.doorMask)).toBe(0);
        const mate = new BotController(b.game, placePlayer(b.game, "mate", door.pos).id, { seed: 2, brain: "smart" });
        expect(mate.bot.model.nav === gridB).toBe(true);
        expect(gridA.isStamped(doorKey(door.id))).toBe(true);
        // underground navigation goes with the game's ground grid
        const ugA = a.bot.bot.model.underground;
        const ugB = b.bot.bot.model.underground;
        expect(!!ugA && !!ugB && ugB !== ugA).toBe(true);
        expect(mate.bot.model.underground === ugB).toBe(true);
        const ugFresh = new UndergroundNav(gen.mapData, fresh);
        expect(ugB?.regions.length).toBe(ugFresh.regions.length);
        ugFresh.regions.forEach((r, i) => {
            const copy = ugB?.regions[i];
            expect(copy?.structureId).toBe(r.structureId);
            expect(Buffer.compare(copy?.blocked ?? new Uint8Array(), r.blocked)).toBe(0);
            expect(copy?.portals.map((q) => q.top)).toEqual(r.portals.map((q) => q.top));
        });
    }, 60_000);
});
