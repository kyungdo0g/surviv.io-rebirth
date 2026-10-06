// M9 world feel: the footstep cadence (survev player.ts: a step every 4 units on land, a splash every 5 in water and on
// stepping in), the shot counter replay of gun kicks, and the world queries behind footsteps, bushes and ceiling
// reveals (ground surface lookup, survev collisionHelpers.scanCollider through walls and doorways).
import { MapObjectDefs } from "@rebirth/defs";
import type { ObjectView, Terrain } from "@rebirth/sim";
import { describe, expect, it } from "vitest";
import { shotsSince } from "../src/objects/player.ts";
import { STEP_DIST, StepCounter, WATER_STEP_DIST } from "../src/objects/playerSteps.ts";
import type { ObjectWorld } from "../src/objects/world.ts";
import { WorldQuery } from "../src/objects/worldQuery.ts";

function square(c: number, half: number) {
    return [
        { x: c - half, y: c - half },
        { x: c + half, y: c - half },
        { x: c + half, y: c + half },
        { x: c - half, y: c + half },
    ];
}

const TERRAIN: Terrain = {
    width: 200,
    height: 200,
    shore: square(100, 90),
    grass: square(100, 80),
    rivers: [],
    shoreBounds: { min: { x: 10, y: 10 }, max: { x: 190, y: 190 } },
    grassBounds: { min: { x: 20, y: 20 }, max: { x: 180, y: 180 } },
};

const MAP_DEF = {
    biome: {
        colors: { water: 0x3282ab, waterRipple: 0xb3f0ff },
        sound: { riverShore: "sand" },
    },
} as unknown as ConstructorParameters<typeof WorldQuery>[1];

let nextId = 1;
function obstacle(type: string, x: number, y: number, ori = 0): ObjectView {
    return { kind: "obstacle", id: nextId++, type, pos: { x, y }, layer: 0, ori, scale: 1, healthT: 1, dead: false };
}

function query(views: ObjectView[]): WorldQuery {
    const world = {
        forEachView(kind: string, cb: (v: ObjectView) => void) {
            for (const v of views) if (v.kind === kind) cb(v);
        },
    } as unknown as ObjectWorld;
    return new WorldQuery(TERRAIN, MAP_DEF, () => world);
}

describe("footstep cadence", () => {
    it("steps every 4 units on land", () => {
        const c = new StepCounter();
        const events: number[] = [];
        for (let frame = 1; frame <= 20; frame++) if (c.advance(1, false) === "step") events.push(frame);
        // more than 4 units: the 5th unit, then every 5 frames (the counter restarts at 0)
        expect(STEP_DIST).toBe(4);
        expect(events).toEqual([5, 10, 15, 20]);
    });

    it("splashes on stepping into water, then every 5 units", () => {
        const c = new StepCounter();
        expect(c.advance(0.5, false)).toBeNull();
        expect(c.advance(0.5, true)).toBe("water");
        const events: number[] = [];
        for (let frame = 1; frame <= 12; frame++) if (c.advance(1, true) === "water") events.push(frame);
        expect(WATER_STEP_DIST).toBe(5);
        expect(events).toEqual([6, 12]);
        // back on land the land cadence resumes from the distance walked so far
        expect(c.advance(1, false)).toBeNull();
    });

    it("plays nothing standing still", () => {
        const c = new StepCounter();
        for (let i = 0; i < 100; i++) expect(c.advance(0, false)).toBeNull();
    });
});

describe("gun kicks per shot", () => {
    it("replays every shot fired since the last snapshot, bounded", () => {
        expect(shotsSince(10, 10)).toBe(0);
        expect(shotsSince(10, 11)).toBe(1);
        expect(shotsSince(10, 13)).toBe(3);
        expect(shotsSince(0xfffe, 1)).toBe(3);
        expect(shotsSince(5, 500)).toBe(4);
    });
});

describe("world queries", () => {
    it("reads the terrain under a point", () => {
        const q = query([]);
        expect(q.groundSurface({ x: 100, y: 100 }, 0).type).toBe("grass");
        expect(q.groundSurface({ x: 15, y: 100 }, 0).type).toBe("sand");
        const sea = q.groundSurface({ x: 5, y: 100 }, 0);
        expect(sea.type).toBe("water");
        expect(sea.waterColor).toBe(0x3282ab);
        // deeper into the sea is more submerged: 0.6 at the shore, 1 from 16 units out
        expect(q.submersion({ x: 9.9, y: 100 }, sea)).toBeCloseTo(0.6, 1);
        expect(q.submersion({ x: -10, y: 100 }, sea)).toBe(1);
    });

    it("prefers a building floor over the terrain", () => {
        const house = {
            kind: "building",
            id: nextId++,
            type: "house_red_01",
            pos: { x: 100, y: 100 },
            layer: 0,
            ori: 0,
        };
        const q = query([house as unknown as ObjectView]);
        expect(q.groundSurface({ x: 100, y: 100 }, 0).type).toBe("house");
        expect(q.groundSurface({ x: 130, y: 100 }, 0).type).toBe("grass");
    });

    it("finds the bush a player stands in", () => {
        const q = query([obstacle("bush_01", 100, 100)]);
        expect(q.bushAt({ x: 100.5, y: 100 }, 0.25, 0)?.def.isBush).toBe(true);
        expect(q.bushAt({ x: 110, y: 100 }, 0.25, 0)).toBeNull();
        expect(q.bushAt({ x: 100.5, y: 100 }, 0.25, 1)).toBeNull();
    });

    describe("ceiling scan", () => {
        const region = { type: 1 as const, min: { x: 100, y: 95 }, max: { x: 110, y: 105 } };
        const scan = (q: WorldQuery, x: number) => q.scanCollider(region, { x, y: 100 }, 0, 0.5, 5.5, 5.5, 5);

        it("uses real wall defs", () => {
            expect(MapObjectDefs.brick_wall_ext_14).toBeDefined();
            expect(MapObjectDefs.brick_wall_ext_5).toBeDefined();
        });

        it("sees into a region within the scan distance", () => {
            const q = query([]);
            expect(scan(q, 97)).toBe(true);
            expect(scan(q, 105)).toBe(true);
            expect(scan(q, 90)).toBe(false);
        });

        it("is stopped by a wall", () => {
            const q = query([obstacle("brick_wall_ext_14", 99.5, 100)]);
            expect(scan(q, 97)).toBe(false);
            // inside the region the roof is always open
            expect(scan(q, 101)).toBe(true);
        });

        it("peeks through a doorway", () => {
            // two walls leave a 3-unit gap at the middle ray
            const q = query([obstacle("brick_wall_ext_5", 99.5, 104), obstacle("brick_wall_ext_5", 99.5, 96)]);
            expect(scan(q, 97)).toBe(true);
        });

        it("sees through windows", () => {
            const window = Object.entries(MapObjectDefs).find(
                ([, d]) => d.type === "obstacle" && d.isWindow && d.collision.type === 1,
            );
            expect(window).toBeDefined();
            const q = query([obstacle(window![0], 99.5, 100)]);
            expect(scan(q, 97)).toBe(true);
        });
    });
});
