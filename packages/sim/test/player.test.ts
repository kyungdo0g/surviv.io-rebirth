import { v2 } from "@rebirth/core";
import { GameConfig, getDefOfType } from "@rebirth/defs";
import { describe, expect, it } from "vitest";
import { pointInPolygon } from "../src/geom/polygon.ts";
import {
    emptyInput,
    Game,
    type GeneratedObject,
    moveWithCollision,
    type Obstacle,
    Player,
    World,
} from "../src/index.ts";
import { box, cachedMap, findClearPath } from "./helpers.ts";

const DT = 0.01;

function newGame(): Game {
    return new Game({ mapName: "main", seed: 12345 });
}

function hold(
    game: Game,
    id: number,
    keys: Partial<Record<"moveUp" | "moveDown" | "moveLeft" | "moveRight", boolean>>,
) {
    game.setInput(id, { ...emptyInput(), ...keys });
}

/** A world with only the given obstacles (terrain from main 12345, objects replaced). */
function testWorld(obstacles: Array<Pick<GeneratedObject, "type" | "pos"> & Partial<GeneratedObject>>): World {
    const gen = cachedMap("main", 12345);
    const objects: GeneratedObject[] = obstacles.map((o, i) => ({
        id: i + 1,
        kind: "obstacle",
        ori: 0,
        scale: 1,
        layer: 0,
        parentId: 0,
        ...o,
    }));
    return new World({ ...gen, objects });
}

describe("player movement", () => {
    it("starts with fists, the base outfit and the default backpack", () => {
        const game = newGame();
        const p = game.getPlayer(game.addPlayer("a"))!;
        expect(p.activeWeapon).toBe("fists");
        expect(p.outfit).toBe("outfitBase");
        expect(p.backpack).toBe("backpack00");
        expect(p.helmet).toBe("");
        expect(p.chest).toBe("");
        expect(p.zoom).toBe(GameConfig.scopeZoomRadius.desktop["1xscope"]);
        // spawned on dry grass
        expect(game.world.isOnWater(p.pos, 0)).toBe(false);
        expect(pointInPolygon(p.pos, game.world.terrain.grass)).toBe(true);
    });

    it("moves at moveSpeed + fists equip speed (13 u/s) in a straight line", () => {
        const expected = GameConfig.player.moveSpeed + getDefOfType("melee", "fists").speed.equip;
        expect(expected).toBe(13);
        const game = newGame();
        const id = game.addPlayer("a");
        const start = findClearPath(game.world, { x: 1, y: 0 }, 14);
        game.teleportPlayer(id, start);
        hold(game, id, { moveRight: true });
        for (let i = 0; i < 100; i++) game.step();
        const p = game.getPlayer(id)!;
        const dist = v2.distance(p.pos, start);
        expect(dist).toBeGreaterThan(expected * 0.99);
        expect(dist).toBeLessThan(expected * 1.01);
        expect(p.pos.y).toBeCloseTo(start.y, 9);
    });

    it("moves diagonally at the same speed as straight", () => {
        const game = newGame();
        const id = game.addPlayer("a");
        const dir = v2.normalize({ x: -1, y: 1 });
        const start = findClearPath(game.world, dir, 14);
        game.teleportPlayer(id, start);
        hold(game, id, { moveLeft: true, moveUp: true });
        for (let i = 0; i < 100; i++) game.step();
        const p = game.getPlayer(id)!;
        expect(v2.distance(p.pos, start)).toBeCloseTo(13, 6);
        // +y is up: moveUp increases y
        expect(p.pos.y).toBeGreaterThan(start.y);
        expect(p.pos.x).toBeLessThan(start.x);
    });

    it("faces the mouse direction", () => {
        const game = newGame();
        const id = game.addPlayer("a");
        game.setInput(id, { ...emptyInput(), toMouseDir: { x: 0, y: -2 } });
        game.step();
        expect(game.getPlayer(id)!.dir).toEqual({ x: 0, y: -1 });
        expect(game.getSnapshot(id).objects.find((o) => o.id === id)).toMatchObject({
            kind: "player",
            dir: { x: 0, y: -1 },
        });
    });

    it("never penetrates a stone it is pushed against", () => {
        const game = newGame();
        const stones = game.mapData.objects.filter((o) => o.type === "stone_01");
        const world = game.world;
        // a stone with free space around it, on dry land
        const stone = stones
            .map((s) => world.get(s.id) as Obstacle)
            .find((s) => world.query(box(s.pos, 8)).length === 1 && !world.isOnWater(s.pos, 0))!;
        expect(stone).toBeDefined();
        if (stone.collider.type !== 0) throw new Error("stone_01 has a circle collider");
        const minDist = stone.collider.rad + GameConfig.player.radius;
        const id = game.addPlayer("a");
        game.teleportPlayer(id, { x: stone.pos.x - minDist - 2, y: stone.pos.y + 0.2 });
        hold(game, id, { moveRight: true });
        const p = game.getPlayer(id)!;
        let closest = Infinity;
        for (let i = 0; i < 200; i++) {
            game.step();
            const d = v2.distance(p.pos, stone.collider.pos);
            closest = Math.min(closest, d);
            expect(d).toBeGreaterThanOrEqual(minDist - 1e-9);
        }
        expect(closest).toBeLessThan(minDist + 0.01);
        // it slid around the stone instead of stopping
        expect(p.pos.x).toBeGreaterThan(stone.pos.x);
    });

    it("does not tunnel through a thin wall even far above max speed", () => {
        // shack_wall_top: 0.7 x 11.2 box
        const world = testWorld([{ type: "shack_wall_top", pos: { x: 300, y: 300 }, ori: 1 }]);
        const wall = world.get(1) as Obstacle;
        expect(wall.collider.type).toBe(1);
        const halfThickness = wall.collider.type === 1 ? (wall.collider.max.x - wall.collider.min.x) / 2 : 0;
        expect(halfThickness).toBeCloseTo(0.35, 9);
        for (const speed of [13, 19.65, 50, 150]) {
            const player = new Player(1000, "t", { x: 296, y: 300 });
            for (let tick = 0; tick < 100; tick++) {
                moveWithCollision(world, player, { x: 1, y: 0 }, speed, DT);
                expect(player.pos.x).toBeLessThanOrEqual(300 - halfThickness - player.rad + 1e-9);
            }
        }
    });

    it("is slowed by water to speed - waterSpeedPenalty", () => {
        const game = newGame();
        const world = game.world;
        const river = world.terrain.rivers.find((r) => !r.looped && r.waterWidth >= 8)!;
        expect(river).toBeDefined();
        // a river centre point with no rocks or bridges nearby
        const start = river.spline.points
            .slice(3, -3)
            .find(
                (p) =>
                    world.query(box(p, 4)).length === 0 &&
                    world.isOnWater(p, 0) &&
                    world.isOnWater({ x: p.x + 2, y: p.y }, 0),
            )!;
        expect(start).toBeDefined();
        const id = game.addPlayer("a");
        game.teleportPlayer(id, start);
        hold(game, id, { moveRight: true });
        for (let i = 0; i < 10; i++) game.step();
        const p = game.getPlayer(id)!;
        const expected = 13 - GameConfig.player.waterSpeedPenalty;
        expect(p.speed).toBe(expected);
        expect(v2.distance(p.pos, start)).toBeCloseTo(expected * 0.1, 6);
    });

    it("is clamped to the map", () => {
        const game = newGame();
        const id = game.addPlayer("a");
        game.teleportPlayer(id, { x: 2, y: 2 });
        hold(game, id, { moveLeft: true, moveDown: true });
        for (let i = 0; i < 50; i++) game.step();
        const p = game.getPlayer(id)!;
        expect(p.pos.x).toBeGreaterThanOrEqual(p.rad);
        expect(p.pos.y).toBeGreaterThanOrEqual(p.rad);
    });

    it("zooms in inside buildings and marks them occupied", () => {
        const game = newGame();
        const house = game.mapData.objects.find((o) => o.type === "house_red_01")!;
        const id = game.addPlayer("a");
        game.teleportPlayer(id, house.pos);
        game.step();
        const building = game.world.get(house.id);
        expect(building?.kind).toBe("building");
        expect(game.getPlayer(id)!.indoors).toBe(true);
        expect(building?.kind === "building" && building.occupied).toBe(true);
        const view = game.getSnapshot(id).objects.find((o) => o.id === house.id);
        expect(view).toMatchObject({ kind: "building", occupied: true });
        // leaving clears it
        game.teleportPlayer(id, { x: house.pos.x + 60, y: house.pos.y });
        game.step();
        expect(building?.kind === "building" && building.occupied).toBe(false);
    });

    it("runs a tick with one player in under 2 ms", () => {
        const game = newGame();
        const id = game.addPlayer("a");
        hold(game, id, { moveRight: true, moveUp: true });
        for (let i = 0; i < 50; i++) game.step();
        const ticks = 500;
        const t0 = process.hrtime.bigint();
        for (let i = 0; i < ticks; i++) game.step();
        const perTick = Number(process.hrtime.bigint() - t0) / 1e6 / ticks;
        expect(perTick).toBeLessThan(2);
    });
});

describe("obstacles", () => {
    it("shrink with health between createMax and destroy scale, and die at 0", () => {
        const world = testWorld([{ type: "stone_01", pos: { x: 300, y: 300 }, scale: 1.1 }]);
        const stone = world.get(1) as Obstacle;
        expect(stone.maxHealth).toBe(250);
        expect(stone.blocking).toBe(true);
        stone.damage(125);
        expect(stone.healthT).toBeCloseTo(0.5, 9);
        // lerp(0.5, 1.1 * 0.5, 1.1)
        expect(stone.scale).toBeCloseTo(0.825, 9);
        expect(stone.collider.type === 0 && stone.collider.rad).toBeCloseTo(1.6 * 0.825, 9);
        expect(world.query(box(stone.pos, 0.1)).includes(stone)).toBe(true);
        expect(stone.damage(500)).toBe(true);
        expect(stone.dead).toBe(true);
        expect(stone.scale).toBeCloseTo(0.55, 9);
        expect(stone.blocking).toBe(false);
        expect(stone.toView()).toMatchObject({ dead: true, healthT: 0 });
    });

    it("ignore damage when indestructible", () => {
        const world = testWorld([{ type: "brick_wall_ext_4", pos: { x: 300, y: 300 } }]);
        const wall = world.get(1) as Obstacle;
        expect(wall.damage(1000)).toBe(false);
        expect(wall.health).toBe(wall.maxHealth);
    });

    it("start closed when they are doors", () => {
        const world = testWorld([{ type: "house_door_01", pos: { x: 300, y: 300 } }]);
        const door = world.get(1) as Obstacle;
        expect(door.door?.open).toBe(false);
        expect(door.blocking).toBe(true);
        expect(door.toView().door).toEqual({ open: false, locked: false, canUse: true, seq: 0 });
    });
});
