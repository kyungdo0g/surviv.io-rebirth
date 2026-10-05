import { describe, expect, it } from "vitest";
import { type Bounds, collider, createRng, Grid, type Rng, type Vec2, v2 } from "../src/index.ts";

interface Box {
    id: number;
    bounds: Bounds;
}

const WORLD = 1024;

function randomBounds(rng: Rng): Bounds {
    // Some boxes deliberately straddle or leave the grid area.
    const min = v2.create(rng.range(-50, WORLD + 20), rng.range(-50, WORLD + 20));
    const size = rng.bool(0.1) ? v2.create(rng.range(0, 200), rng.range(0, 200)) : v2.create(rng.range(0, 40));
    return { min, max: v2.add(min, size) };
}

function bruteQuery(boxes: Iterable<Box>, area: Bounds): number[] {
    const ids: number[] = [];
    for (const box of boxes) {
        if (collider.aabbOverlap(box.bounds, area)) {
            ids.push(box.id);
        }
    }
    return ids.sort((a, b) => a - b);
}

function brutePoint(boxes: Iterable<Box>, p: Vec2): number[] {
    return bruteQuery(boxes, { min: p, max: p });
}

const sortedIds = (objs: Box[]) => objs.map((o) => o.id).sort((a, b) => a - b);

function expectMatchesBruteForce(grid: Grid<Box>, live: Map<number, Box>, rng: Rng): void {
    const scratch: Box[] = [];
    for (let i = 0; i < 200; i++) {
        const area = randomBounds(rng);
        const found = grid.query(area, scratch);
        expect(found).toBe(scratch);
        expect(new Set(found).size).toBe(found.length);
        expect(sortedIds(found)).toEqual(bruteQuery(live.values(), area));

        const p = v2.create(rng.range(-20, WORLD + 20), rng.range(-20, WORLD + 20));
        expect(sortedIds(grid.queryPoint(p))).toEqual(brutePoint(live.values(), p));
    }
}

describe("Grid", () => {
    it("matches brute force over 500 random boxes through insert, update and remove", () => {
        const rng = createRng(2024);
        const grid = new Grid<Box>(WORLD, WORLD, 16);
        const live = new Map<number, Box>();
        for (let id = 1; id <= 500; id++) {
            const box = { id, bounds: randomBounds(rng) };
            live.set(id, box);
            grid.insert(box, box.bounds);
        }
        expect(grid.size).toBe(500);
        expectMatchesBruteForce(grid, live, rng);

        // Move half the boxes, some by small steps (same cells) and some far away.
        for (const box of rng.shuffle([...live.values()]).slice(0, 250)) {
            if (rng.bool()) {
                const step = v2.create(rng.range(-3, 3), rng.range(-3, 3));
                box.bounds = { min: v2.add(box.bounds.min, step), max: v2.add(box.bounds.max, step) };
            } else {
                box.bounds = randomBounds(rng);
            }
            grid.update(box, box.bounds);
        }
        expectMatchesBruteForce(grid, live, rng);

        for (const box of rng.shuffle([...live.values()]).slice(0, 100)) {
            expect(grid.remove(box)).toBe(true);
            live.delete(box.id);
        }
        expect(grid.size).toBe(400);
        expectMatchesBruteForce(grid, live, rng);
    });

    it("finds objects spanning many cells exactly once", () => {
        const grid = new Grid<Box>(256, 256, 16);
        const big = { id: 7, bounds: { min: v2.create(10, 10), max: v2.create(200, 200) } };
        grid.insert(big, big.bounds);
        expect(grid.query({ min: v2.create(0, 0), max: v2.create(256, 256) })).toEqual([big]);
        expect(grid.queryPoint(v2.create(100, 150))).toEqual([big]);
        expect(grid.queryPoint(v2.create(220, 150))).toEqual([]);
    });

    it("handles objects outside the grid area", () => {
        const grid = new Grid<Box>(64, 64, 16);
        const outside = { id: 1, bounds: { min: v2.create(-100, -100), max: v2.create(-90, -90) } };
        grid.insert(outside, outside.bounds);
        expect(grid.queryPoint(v2.create(-95, -95))).toEqual([outside]);
        expect(grid.queryPoint(v2.create(5, 5))).toEqual([]);
    });

    it("tracks membership and rejects duplicate inserts", () => {
        const grid = new Grid<Box>(64, 64);
        const box = { id: 3, bounds: { min: v2.create(1, 1), max: v2.create(2, 2) } };
        expect(grid.has(box)).toBe(false);
        expect(grid.remove(box)).toBe(false);
        grid.update(box, box.bounds);
        expect(grid.has(box)).toBe(true);
        expect(() => grid.insert(box, box.bounds)).toThrow();
        grid.clear();
        expect(grid.size).toBe(0);
        expect(grid.queryPoint(v2.create(1.5, 1.5))).toEqual([]);
    });
});
