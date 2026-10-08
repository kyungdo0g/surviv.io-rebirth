// Path follower fixes from the stuck-event investigation: no progress while the destination flips back and forth is a
// dither event, not a stuck event; a goal inside a wall fails at the end of its snapped plan instead of being replanned
// forever; a plan whose next legs a newly opened door blocks is replanned at once; a goal with no route at all (a room
// walled in glass) is walked towards up to the reachable cell nearest it, where it fails, never straight at the goal
// along the wall (move-slide).
import { createRng, type Vec2, v2 } from "@rebirth/core";
import type { ObstacleView } from "@rebirth/sim";
import { describe, expect, it } from "vitest";
import { PathFollower } from "../src/nav/follower.ts";
import { NavGrid } from "../src/nav/grid.ts";
import { WorldModel } from "../src/perception/world.ts";
import { cachedMap, firstOfType } from "./helpers.ts";

const gen = cachedMap("main", 12345);
// the first unrotated red house (ori 0: the offsets below assume it)
const house = firstOfType(gen, "house_red_02", 0);

function modelAt(pos: Vec2, grid = NavGrid.forMap(gen.mapData)): WorldModel {
    const m = new WorldModel(gen.mapData, grid);
    m.self.pos = v2.copy(pos);
    return m;
}

function walkable(grid: NavGrid, p: Vec2): Vec2 {
    return grid.center(grid.nearestWalkable(p, 8));
}

describe("path follower", () => {
    it("counts no progress towards a flipping destination as dithering, towards one destination as stuck", () => {
        const grid = NavGrid.forMap(gen.mapData);
        const here = walkable(grid, { x: house.pos.x - 40, y: house.pos.y });
        const a = v2.add(here, { x: -20, y: 0 });
        const b = v2.add(here, { x: 0, y: 25 });
        const flip = new PathFollower(createRng(1));
        const m = modelAt(here);
        for (let k = 0; k < 40; k++) flip.steer(m, k % 2 === 0 ? a : b, k * 0.1);
        expect(flip.ditherEvents).toBeGreaterThan(0);
        expect(flip.stuckEvents).toBe(0);
        const same = new PathFollower(createRng(1));
        for (let k = 0; k < 40; k++) same.steer(m, a, k * 0.1);
        expect(same.stuckEvents).toBeGreaterThan(0);
        expect(same.ditherEvents).toBe(0);
    });

    it("fails a goal inside a wall at the end of its snapped plan", () => {
        const grid = NavGrid.forMap(gen.mapData);
        const wall = gen.objects.find((o) => o.parentId === house.id && o.type.startsWith("brick_wall_ext"))!;
        expect(grid.walkableAt(wall.pos)).toBe(false);
        const start = walkable(grid, v2.add(wall.pos, { x: 0, y: 12 }));
        const m = modelAt(start);
        const f = new PathFollower(createRng(2));
        let r = f.steer(m, wall.pos, 0);
        expect(r.failed).toBe(false);
        // walk the plan: teleport along its waypoints
        let t = 0;
        for (let guard = 0; guard < 50 && !r.failed && !r.arrived; guard++) {
            const wp = f.points[Math.min(f.points.length - 1, 0)];
            m.self.pos = v2.copy(wp ?? m.self.pos);
            f.points.shift();
            if (f.points.length === 0) f.points.push(v2.copy(m.self.pos));
            t += 0.1;
            r = f.steer(m, wall.pos, t);
        }
        expect(r.arrived).toBe(false);
        expect(r.failed).toBe(true);
        expect(r.dir).toBeNull();
    });

    it("replans when something new blocks the next legs of the plan (a crate dropped across the way)", () => {
        const grid = new NavGrid(gen.mapData);
        const outside = walkable(grid, v2.add(house.pos, { x: 0, y: 28 }));
        const inside = walkable(grid, v2.add(house.pos, { x: 5, y: 7 }));
        const m = modelAt(outside, grid);
        const f = new PathFollower(createRng(3));
        f.steer(m, inside, 0);
        const before = f.points.map((p) => v2.copy(p));
        expect(before.length).toBeGreaterThan(1);
        // an air drop crate lands on the middle of the second leg
        const mid = v2.lerp(0.5, before[0], before[1]);
        const crate: ObstacleView = {
            id: 999001,
            kind: "obstacle",
            type: "crate_01",
            pos: mid,
            layer: 0,
            ori: 0,
            scale: 1,
            healthT: 1,
            dead: false,
        };
        grid.observeObstacle(crate);
        expect(grid.linePassable(before[0], before[1])).toBe(false);
        f.steer(m, inside, 0.1);
        // checked against the changed grid at once (not at the next periodic refresh): replanned around the crate
        expect(f.points).not.toEqual(before);
        for (let k = 1; k < f.points.length; k++) expect(grid.linePassable(f.points[k - 1], f.points[k])).toBe(true);
    });

    it("walks a goal with no route only up to the reachable cell nearest it, then fails standing and keeps away", () => {
        // a 20 x 20 room walled in glass on all sides (no door: only breaking a wall lets a player in, like the
        // greenhouse bunker's compartment 3), in the open west of the red house
        const grid = new NavGrid(gen.mapData);
        const c = walkable(grid, { x: house.pos.x - 70, y: house.pos.y });
        const walls: Array<[number, number, number]> = [
            [10.5, -5, 0],
            [10.5, 5, 0],
            [-10.5, -5, 0],
            [-10.5, 5, 0],
            [-5.5, 10.5, 1],
            [5.5, 10.5, 1],
            [-5.5, -10.5, 1],
            [5.5, -10.5, 1],
        ];
        walls.forEach(([dx, dy, ori], i) => {
            const view: ObstacleView = {
                id: 999100 + i,
                kind: "obstacle",
                type: "glass_wall_10",
                pos: { x: c.x + dx, y: c.y + dy },
                layer: 0,
                ori,
                scale: 1,
                healthT: 1,
                dead: false,
            };
            grid.observeObstacle(view);
        });
        grid.labelComponents();
        const start = walkable(grid, v2.add(c, { x: 30, y: 6 }));
        expect(grid.reachable(start, c)).toBe(false);
        const m = modelAt(start, grid);
        const f = new PathFollower(createRng(4));
        // walk at 12 u/s, stopping where the grid is blocked (no sliding in this sketch: the plan itself must not
        // lead into the wall)
        let r = f.steer(m, c, 0);
        let t = 0;
        let moved = 0;
        while (!r.failed && t < 8) {
            if (r.dir) {
                const next = v2.add(m.self.pos, v2.mul(r.dir, 0.6));
                if (grid.walkableAt(next)) {
                    m.self.pos = next;
                    moved++;
                }
            }
            // every waypoint of the plan is reachable: it never ends at the goal inside the room
            const last = f.points[f.points.length - 1];
            if (last) expect(grid.reachable(start, last), `t=${t.toFixed(2)}`).toBe(true);
            t += 0.05;
            r = f.steer(m, c, t);
        }
        expect(moved).toBeGreaterThan(20);
        expect(r.failed).toBe(true);
        expect(r.dir).toBeNull();
        // it stopped at the east wall, beside the room, in a few seconds
        expect(t).toBeLessThan(4);
        expect(m.self.pos.x - c.x).toBeGreaterThan(11);
        expect(m.self.pos.x - c.x).toBeLessThan(15);
        // the bot gives the goal up (bot.ts clears the follower); asked again soon, it fails at once and stands
        f.clear();
        const again = f.steer(m, c, t + 1);
        expect(again.failed).toBe(true);
        expect(again.dir).toBeNull();
        expect(f.points.length).toBe(0);
    });
});
