// Breaking through what blocks the way (owner requests 2026-10-09/10; nav/breakThrough.ts, brain/breakThrough.ts):
// indoors and for the house rule's obstacles (the club's couch, the mansion's panels, the police station's interior
// walls, greenhouse glass) routes cross breakable obstacles and the bot breaks the one on its way once it sees it;
// glass walls elsewhere for a persona-driven share; crates and furniture in the open are walked around; explosive
// barrels and very sturdy obstacles never count.
import { createRng, type Vec2, v2 } from "@rebirth/core";
import { getMapObjectDef, type ObstacleDef } from "@rebirth/defs";
import { Game, type GeneratedObject, type GenerateMapResult, type MapObjectSpawn } from "@rebirth/sim";
import { describe, expect, it } from "vitest";
import { BreakThrough, breakShares } from "../src/brain/breakThrough.ts";
import { BRAIN_PRESETS } from "../src/brain/features.ts";
import { BotController } from "../src/controller.ts";
import { rotateOri } from "../src/geom.ts";
import { findPath } from "../src/nav/astar.ts";
import { BREAK_BITS, BreakClass, blockerAhead, breakClassOf } from "../src/nav/breakThrough.ts";
import { PathFollower } from "../src/nav/follower.ts";
import { NavGrid } from "../src/nav/grid.ts";
import { WorldModel } from "../src/perception/world.ts";
import { PERSONAS } from "../src/persona.ts";
import { cachedMap, firstOfType, flatGame, mainGame, openSpot, placePlayer } from "./helpers.ts";

type Piece = { type: string; pos: Vec2; ori?: number };

const def = (type: string) => getMapObjectDef(type) as ObstacleDef;

/**
 * A 20 x 20 room east of `c` whose only way in is an L-shaped corridor 7 wide (metal walls on the flat main terrain,
 * as in nav.labels.test.ts), with `blocker` across the corridor's first leg.
 */
function corridor(c: Vec2, blocker: string): { pieces: Piece[]; block: Vec2; room: Vec2; outside: Vec2 } {
    const at = (x: number, y: number) => v2.add(c, { x, y });
    const wall = (n: number, x: number, y: number, ori = 0): Piece => ({
        type: `metal_wall_ext_${n}`,
        pos: at(x, y),
        ori,
    });
    const pieces: Piece[] = [
        wall(23, 10, -10.5, 1),
        wall(23, 10, 10.5, 1),
        wall(23, 20.5, 0),
        wall(8, -0.5, -7),
        wall(8, -0.5, 7),
        wall(10, -5, 3.5, 1),
        wall(13, -9.5, -2.5),
        wall(13, -9.5, -15.5),
        wall(10, -1.5, -8),
        wall(9, -1.5, -17.5),
    ];
    const block = at(-5.5, -12);
    pieces.push({ type: blocker, pos: block });
    return { pieces, block, room: at(10, 0), outside: at(-5.5, -32) };
}

/** The flat main terrain with `pieces` in the game and in its MapData. */
function generationOf(pieces: Piece[]): GenerateMapResult {
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

const center = openSpot(flatGame(), 30);

describe("what is worth breaking through", () => {
    it("the house rule's types anywhere, anything breakable indoors, glass walls for some; not barrels nor sturdy walls", () => {
        for (const t of ["couch_01", "couch_03", "police_wall_int_4", "mansion_wall_int_5", "glass_wall_10"])
            expect(breakClassOf(def(t), t, false), t).toBe(BreakClass.HouseRule);
        expect(breakClassOf(def("crate_01"), "crate_01", false)).toBe(BreakClass.None);
        expect(breakClassOf(def("crate_01"), "crate_01", true)).toBe(BreakClass.HouseRule);
        expect(breakClassOf(def("bookshelf_01"), "bookshelf_01", true)).toBe(BreakClass.HouseRule);
        expect(breakClassOf(def("glass_wall_9"), "glass_wall_9", false)).toBe(BreakClass.Glass);
        // explosive, too sturdy, not destructible
        expect(breakClassOf(def("barrel_01"), "barrel_01", true)).toBe(BreakClass.None);
        expect(breakClassOf(def("glass_wall_12_2"), "glass_wall_12_2", true)).toBe(BreakClass.None);
        expect(breakClassOf(def("metal_wall_ext_23"), "metal_wall_ext_23", true)).toBe(BreakClass.None);
        // only explosions damage an obstacle with an explosion gate (a subway gate: 300 HP): never punched through
        const gated = { ...def("couch_01"), explosionGate: { explosionTypes: ["explosion_rocket"] } } as ObstacleDef;
        expect(breakClassOf(gated, "couch_01", true)).toBe(BreakClass.None);
    });

    it("nearly everyone follows the house rule; a bold, skilled persona breaks glass walls more often than a cautious one", () => {
        const [houseRule, glassNeutral] = breakShares(PERSONAS.neutral, { tier: "intermediate", s: 0.5, g: 0.5 });
        expect(houseRule).toBeGreaterThanOrEqual(0.8);
        const [, glassRusher] = breakShares(PERSONAS.rusher, { tier: "expert", s: 0.9, g: 0.9 });
        const [, glassRat] = breakShares(PERSONAS.rat, { tier: "beginner", s: 0.1, g: 0.1 });
        expect(glassRusher).toBeGreaterThan(glassNeutral);
        expect(glassNeutral).toBeGreaterThan(glassRat);
        // per bot, from its seed: about the shares over many seeds, none with the feature off
        let both = 0;
        for (let seed = 1; seed <= 400; seed++) {
            const b = new BreakThrough(true, PERSONAS.neutral, { tier: "intermediate", s: 0.5, g: 0.5 }, seed);
            if (b.mask & BREAK_BITS.HouseRule) both++;
            expect(new BreakThrough(false, PERSONAS.neutral, { tier: "intermediate", s: 0.5, g: 0.5 }, seed).mask).toBe(
                0,
            );
        }
        expect(Math.abs(both / 400 - houseRule)).toBeLessThan(0.06);
    });
});

describe("routes through breakable obstacles", () => {
    it("a room sealed by a couch: no route without breaking, a route through the couch for a bot that breaks it", () => {
        const layout = corridor(center, "couch_01");
        const grid = new NavGrid(generationOf(layout.pieces).mapData);
        expect(grid.walkableAt(layout.block)).toBe(false);
        expect(findPath(grid, layout.outside, layout.room)).toBeNull();
        const path = findPath(grid, layout.outside, layout.room, { breakMask: BREAK_BITS.HouseRule });
        expect(path?.complete).toBe(true);
        expect(v2.distance(path?.points.at(-1) ?? layout.outside, layout.room)).toBeLessThan(1.5);
        // a glass-only bot does not break the couch
        expect(findPath(grid, layout.outside, layout.room, { breakMask: BREAK_BITS.Glass })?.complete).not.toBe(true);
    });

    it("a crate in the open is walked around: it is no house rule outdoors", () => {
        const layout = corridor(center, "crate_01");
        const grid = new NavGrid(generationOf(layout.pieces).mapData);
        expect(findPath(grid, layout.outside, layout.room, { breakMask: BREAK_BITS.HouseRule })?.complete).not.toBe(
            true,
        );
    });

    it("the follower reports the couch on its way only once the bot sees it", () => {
        const layout = corridor(center, "couch_01");
        const gen = generationOf(layout.pieces);
        const grid = new NavGrid(gen.mapData);
        const m = new WorldModel(gen.mapData, grid);
        m.self.pos = v2.add(layout.block, { x: 0, y: -3.5 });
        const path = findPath(grid, m.self.pos, layout.room, { breakMask: BREAK_BITS.HouseRule });
        expect(path).not.toBeNull();
        // nothing in the snapshot yet: the map says a couch stands there, the bot has not seen it
        expect(blockerAhead(m, grid, m.self.pos, path?.points ?? [], 0, BREAK_BITS.HouseRule)).toBe(0);
        const reports: number[] = [];
        const f = new PathFollower(createRng(1), null, {
            breakMask: () => BREAK_BITS.HouseRule,
            blockerAhead: (id) => reports.push(id) > 0,
        });
        f.steerOn(m, grid, layout.room, 0);
        expect(reports).toEqual([]);
    });
});

describe("a bot breaks through (simulation)", () => {
    function run(blocker: string, brain: "smart" | "baseline") {
        const layout = corridor(center, blocker);
        const generation = generationOf(layout.pieces);
        const game = new Game({ mapName: "main", seed: 12345, teamMode: 1 }, { generation, spawnLoot: false });
        for (let k = 0; k < 4; k++) placePlayer(game, `dummy${k}`, v2.add(center, { x: -60 + k * 20, y: 60 }));
        const p = placePlayer(game, "bot", layout.outside);
        // a seed whose bot follows the house rule (most do)
        let seed = 1;
        while (!(new BotController(game, p.id, { seed, brain: "smart" }).bot.brain.breaker.mask & BREAK_BITS.HouseRule))
            seed++;
        const bot = new BotController(game, p.id, { seed, brain });
        bot.bot.setOrder({ type: "goto", pos: layout.room });
        const inRoom = () => p.pos.x > center.x && p.pos.x < center.x + 20 && Math.abs(p.pos.y - center.y) < 10;
        let ticks = 0;
        for (; ticks < 2000 && !inRoom(); ticks++) {
            bot.update();
            game.step();
        }
        const obstacle = game.world.get(layout.pieces.length);
        return { inRoom: inRoom(), ticks, broken: obstacle?.kind === "obstacle" && obstacle.dead, bot };
    }

    it("the couch across the corridor is punched through and the bot walks into the room", () => {
        const r = run("couch_01", "smart");
        expect(r.broken).toBe(true);
        expect(r.inRoom).toBe(true);
        expect(r.bot.bot.brain.breaker.acted).toBeGreaterThan(0);
        // the smart preset carries the feature; the baseline does not break it and stays out
        expect(BRAIN_PRESETS.smart.breakThrough).toBe(true);
        const base = run("couch_01", "baseline");
        expect(base.broken).toBe(false);
        expect(base.inRoom).toBe(false);
    }, 30_000);
});

describe("the house rule on the main map (simulation)", () => {
    it("a bot beside a greenhouse breaks the glass into it instead of walking round to a door", () => {
        const game = mainGame();
        const gh = firstOfType(cachedMap("main", 12345), "greenhouse_01");
        const at = (x: number, y: number) => v2.add(gh.pos, v2.mul(rotateOri({ x, y }, gh.ori), gh.scale));
        const doors = [at(2, 19.75), at(-2, -19.75)];
        let nearDoor = Number.POSITIVE_INFINITY;
        for (let k = 0; k < 4; k++) placePlayer(game, `dummy${k}`, v2.add(gh.pos, { x: -200 + k * 20, y: 200 }));
        const p = placePlayer(game, "bot", at(-19, -7.5));
        let seed = 1;
        while (!(new BotController(game, p.id, { seed, brain: "smart" }).bot.brain.breaker.mask & BREAK_BITS.HouseRule))
            seed++;
        const bot = new BotController(game, p.id, { seed, brain: "smart" });
        // (the aisle between the glass and the planters, 12 u from the nearer door round the end)
        const goal = at(-3, -7.5);
        bot.bot.setOrder({ type: "goto", pos: goal });
        const glassAlive = () =>
            [...game.world.objects.values()].filter(
                (o) =>
                    o.kind === "obstacle" && o.type === "glass_wall_10" && !o.dead && v2.distance(o.pos, gh.pos) < 30,
            ).length;
        const before = glassAlive();
        let ticks = 0;
        for (; ticks < 1500 && v2.distance(p.pos, goal) > 2; ticks++) {
            bot.update();
            game.step();
            for (const d of doors) nearDoor = Math.min(nearDoor, v2.distance(p.pos, d));
        }
        expect(v2.distance(p.pos, goal)).toBeLessThanOrEqual(2);
        expect(glassAlive()).toBeLessThan(before);
        // through the long side, not round by a door at the ends
        expect(nearDoor).toBeGreaterThan(8);
    }, 30_000);
});
