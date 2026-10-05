// Navigation grid and A*: the grid built from MapData blocks walls, windows and obstacles, leaves usable doors
// passable, marks water; A* finds complete paths around buildings and into them through doors, and the smoothed
// waypoints only cross walkable cells.
import { type Vec2, v2 } from "@rebirth/core";
import { describe, expect, it } from "vitest";
import { findPath } from "../src/nav/astar.ts";
import { NavGrid, NavTerrain } from "../src/nav/grid.ts";
import { cachedMap } from "./helpers.ts";

const gen = cachedMap("main", 12345);
const grid = new NavGrid(gen.mapData);
const house = gen.objects.find((o) => o.type === "house_red_02" && o.id === 1391)!;
const children = gen.objects.filter((o) => o.parentId === house.id);

function pathLength(start: Vec2, points: readonly Vec2[]): number {
    let len = 0;
    let prev = start;
    for (const p of points) {
        len += v2.distance(prev, p);
        prev = p;
    }
    return len;
}

describe("nav grid", () => {
    it("blocks walls and windows, keeps house doors passable and marks water", () => {
        expect(house).toBeDefined();
        const doors = children.filter((o) => o.type === "house_door_01");
        const windows = children.filter((o) => o.type === "house_window_01");
        expect(doors.length).toBeGreaterThanOrEqual(2);
        for (const d of doors) {
            expect(grid.doors.has(d.id)).toBe(true);
        }
        for (const w of windows) expect(grid.walkableAt(w.pos)).toBe(false);
        const wall = children.find((o) => o.type.startsWith("brick_wall_ext"))!;
        expect(grid.walkableAt(wall.pos)).toBe(false);
        // the river and the sea are water, the house floor is not
        let water = 0;
        let sea = 0;
        for (let i = 0; i < grid.w * grid.h; i++) {
            if (grid.terrain[i] === NavTerrain.Water) water++;
            if (grid.terrain[i] === NavTerrain.Sea) sea++;
        }
        expect(water).toBeGreaterThan(1000);
        expect(sea).toBeGreaterThan(10000);
        expect(grid.isWaterAt(house.pos)).toBe(false);
    });

    it("finds a path into a house through a door", () => {
        const outside = { x: house.pos.x, y: house.pos.y + 28 };
        const inside = { x: house.pos.x + 5, y: house.pos.y + 7 };
        expect(grid.walkableAt(inside)).toBe(true);
        const raw = findPath(grid, outside, inside, { raw: true })!;
        expect(raw.complete).toBe(true);
        const cells = raw.points.map((p) => grid.cellOf(p));
        expect(cells.every((c) => grid.walkable(c))).toBe(true);
        // walls and windows close the house: the way in crosses a door
        expect(cells.some((c) => grid.doorMask[c] === 1)).toBe(true);
        const smooth = findPath(grid, outside, inside)!;
        expect(smooth.complete).toBe(true);
        expect(smooth.points.length).toBeLessThan(raw.points.length);
        let prev = outside;
        for (const p of smooth.points) {
            expect(grid.lineWalkable(prev, p)).toBe(true);
            prev = p;
        }
        expect(v2.distance(smooth.points[smooth.points.length - 1], inside)).toBeLessThan(1.5);
    });

    it("finds a path around a building when the straight line is blocked", () => {
        const west = { x: house.pos.x - 22, y: house.pos.y };
        const east = { x: house.pos.x + 22, y: house.pos.y };
        expect(grid.walkableAt(west) && grid.walkableAt(east)).toBe(true);
        expect(grid.lineWalkable(west, east)).toBe(false);
        const res = findPath(grid, west, east)!;
        expect(res.complete).toBe(true);
        let prev = west;
        for (const p of res.points) {
            expect(grid.lineWalkable(prev, p)).toBe(true);
            prev = p;
        }
        expect(pathLength(west, res.points)).toBeGreaterThan(v2.distance(west, east));
        expect(v2.distance(prev, east)).toBeLessThan(1.5);
    });

    it("plans a long cross-map path within the node budget", () => {
        const a = grid.center(grid.nearestWalkable({ x: 150, y: 150 }, 20));
        const b = grid.center(grid.nearestWalkable({ x: 560, y: 560 }, 20));
        const res = findPath(grid, a, b)!;
        expect(res.complete).toBe(true);
        expect(res.points.length).toBeGreaterThan(0);
    });

    it("forgets obstacles seen destroyed and learns obstacles missing from MapData", () => {
        const own = new NavGrid(gen.mapData);
        const stone = gen.objects.find((o) => o.type === "stone_01")!;
        expect(own.walkableAt(stone.pos)).toBe(false);
        own.observeObstacle({
            id: stone.id,
            kind: "obstacle",
            type: stone.type,
            pos: stone.pos,
            layer: 0,
            ori: stone.ori,
            scale: stone.scale,
            healthT: 0,
            dead: true,
        });
        expect(own.walkableAt(stone.pos)).toBe(true);
        const spot = own.center(own.nearestWalkable({ x: 360, y: 360 }, 30));
        own.observeObstacle({
            id: 999999,
            kind: "obstacle",
            type: "crate_01",
            pos: spot,
            layer: 0,
            ori: 0,
            scale: 1,
            healthT: 1,
            dead: false,
        });
        expect(own.walkableAt(spot)).toBe(false);
    });
});
