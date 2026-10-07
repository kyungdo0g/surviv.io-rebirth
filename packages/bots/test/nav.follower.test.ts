// Path follower fixes from the stuck-event investigation: no progress while the destination flips back and forth is a
// dither event, not a stuck event; a goal inside a wall fails at the end of its snapped plan instead of being replanned
// forever; a plan whose next legs a newly opened door blocks is replanned at once.
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
});
