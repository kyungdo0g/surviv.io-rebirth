import { type Collider, Grid, type Vec2 } from "@rebirth/core";
import { getMapDef, getMapObjectDef, hasMapObjectDef, unscaledMapDef } from "@rebirth/defs";
import { describe, expect, it } from "vitest";
import { polygonArea } from "../src/geom/polygon.ts";
import { overlaps, toBounds, transformOri } from "../src/geom/transform.ts";
import { Game, type GeneratedObject, generateMap, getBoundingCollider } from "../src/index.ts";
import { cachedMap, objectsHash } from "./helpers.ts";

/**
 * Pinned digest of generateMap("main", 12345, solo); update deliberately when generation changes. Last change: the
 * hidden rooms grown and added (2026-10-10, "expand the content": every rebirth building's children moved).
 */
const MAIN_12345_HASH = "61fd713e903ee320";

/**
 * Area an object reserves against other top-level objects (what canSpawn tests against). A beach obstacle is tested at
 * scale 1 and spawned at its rolled scale (survev map.ts genOnBeach), so as the newcomer it checks its unscaled
 * footprint against the scaled ones already placed (`asCandidate`).
 */
function footprints(o: GeneratedObject, asCandidate = false): Collider[] {
    const def = getMapObjectDef(o.type);
    if (def.type === "obstacle") {
        const beachOnly = !!def.terrain?.beach && !def.terrain.grass;
        return [transformOri(getBoundingCollider(o.type), o.pos, o.ori, asCandidate && beachOnly ? 1 : o.scale)];
    }
    if (def.type === "building" || def.type === "structure") {
        if (def.mapObstacleBounds) return def.mapObstacleBounds.map((c) => transformOri(c, o.pos, o.ori, 1));
        return [transformOri(getBoundingCollider(o.type), o.pos, o.ori, 1.1)];
    }
    return [];
}

function topLevelCounts(objects: readonly GeneratedObject[]): Map<string, number> {
    const counts = new Map<string, number>();
    for (const o of objects) if (o.parentId === 0) counts.set(o.type, (counts.get(o.type) ?? 0) + 1);
    return counts;
}

describe("generateMap main", () => {
    const gen = cachedMap("main", 12345);

    it("sizes the map from the def and team mode", () => {
        const cfg = getMapDef("main").mapGen.map;
        expect(gen.mapData.width).toBe(cfg.baseWidth * cfg.scale.small + cfg.extension);
        expect(gen.mapData.height).toBe(cfg.baseHeight * cfg.scale.small + cfg.extension);
        const squad = cachedMap("main", 12345, 4);
        expect(squad.mapData.width).toBe(cfg.baseWidth * cfg.scale.large + cfg.extension);
        expect(squad.scale).toBe("large");
        expect(gen.mapData.places.map((p) => p.name)).toEqual(getMapDef("main").mapGen.places.map((p) => p.name));
    });

    it("is deterministic (golden hash)", () => {
        const again = generateMap("main", 12345, 1);
        expect(again.mapData).toEqual(gen.mapData);
        expect(objectsHash(gen.objects)).toBe(MAIN_12345_HASH);
        expect(objectsHash(generateMap("main", 12346, 1).objects)).not.toBe(MAIN_12345_HASH);
    });

    it("generates without warnings and lists every object in mapData", () => {
        expect(gen.warnings).toEqual([]);
        expect(gen.mapData.objects.length).toBe(gen.objects.length);
        expect(gen.objects.length).toBeGreaterThan(1000);
        gen.objects.forEach((o, i) => {
            expect(gen.mapData.objects[i]).toEqual({
                id: o.id,
                type: o.type,
                pos: o.pos,
                ori: o.ori,
                scale: o.scale,
                layer: o.layer,
            });
        });
    });

    it("gives every object a unique id that resolves in the game world, parents first", () => {
        const ids = new Set<number>();
        for (const o of gen.objects) {
            expect(ids.has(o.id)).toBe(false);
            ids.add(o.id);
            if (o.parentId) expect(ids.has(o.parentId)).toBe(true);
            expect(hasMapObjectDef(o.type)).toBe(true);
        }
        const game = new Game({ mapName: "main", seed: 12345 });
        for (const o of game.mapData.objects) {
            const entity = game.world.get(o.id);
            expect(entity?.type).toBe(o.type);
            expect(entity?.pos).toEqual(o.pos);
        }
    });

    it("places every object inside the map", () => {
        const { width, height } = gen.mapData;
        for (const o of gen.objects) {
            expect(o.pos.x).toBeGreaterThanOrEqual(0);
            expect(o.pos.y).toBeGreaterThanOrEqual(0);
            expect(o.pos.x).toBeLessThanOrEqual(width);
            expect(o.pos.y).toBeLessThanOrEqual(height);
        }
    });

    it("never overlaps two top-level objects", () => {
        const { width, height } = gen.mapData;
        const lakeCenters: Vec2[] = gen.terrain.rivers.filter((r) => r.looped).map((r) => r.center);
        const top = gen.objects.filter(
            (o) => o.parentId === 0 && !lakeCenters.some((c) => c.x === o.pos.x && c.y === o.pos.y),
        );
        const grid = new Grid<{ id: number; col: Collider; owner: number }>(width, height, 32);
        let n = 0;
        const overlapsFound: string[] = [];
        for (const o of top) {
            for (const col of footprints(o, true)) {
                for (const other of grid.query(toBounds(col))) {
                    if (other.owner === o.id) continue;
                    const res = overlaps(col, other.col);
                    if (res) overlapsFound.push(`${o.type}#${o.id} overlaps #${other.owner}`);
                }
            }
            for (const col of footprints(o)) grid.insert({ id: ++n, col, owner: o.id }, toBounds(col));
        }
        expect(overlapsFound).toEqual([]);
    });

    it("spawns exactly the resolved fixed spawn counts", () => {
        const fixed = getMapDef("main").mapGen.fixedSpawns[0];
        const counts = topLevelCounts(gen.objects);
        for (const [type, spec] of Object.entries(fixed)) {
            if (typeof spec === "object" && "odds" in spec) continue;
            const expected = typeof spec === "number" ? spec : spec.small;
            expect([type, counts.get(type) ?? 0]).toEqual([type, expected]);
        }
        // odds spawns resolve to 0 or 1
        for (const [type, spec] of Object.entries(fixed)) {
            if (typeof spec === "object" && "odds" in spec) expect(counts.get(type) ?? 0).toBeLessThanOrEqual(1);
        }
        // randomSpawns: the def's choose of mansion / police / bank (survev's 2; 3 on the bigger map, rebirth/mapScale.ts)
        const chosen = ["mansion_structure_01", "police_01", "bank_01"].filter((t) => counts.has(t));
        expect(chosen.length).toBe(getMapDef("main").mapGen.randomSpawns[0].choose);
    });

    it("spawns density objects within 10% of density * shoreArea / 250000", () => {
        const shoreArea =
            polygonArea(gen.terrain.shore) - gen.terrain.rivers.reduce((s, r) => s + polygonArea(r.shorePoly), 0);
        expect(gen.shoreArea).toBeCloseTo(shoreArea, 6);
        const counts = topLevelCounts(gen.objects);
        for (const l of gen.lootSpawns) if (l.parentId === 0) counts.set(l.type, (counts.get(l.type) ?? 0) + 1);
        const density = getMapDef("main").mapGen.densitySpawns[0];
        for (const [type, d] of Object.entries(density)) {
            const expected = Math.round((d * shoreArea) / 250000);
            const actual = counts.get(type) ?? 0;
            expect(actual, type).toBeGreaterThanOrEqual(Math.floor(expected * 0.9));
            expect(actual, type).toBeLessThanOrEqual(Math.ceil(expected * 1.1));
        }
    });

    it("fills rivers with rocks and bridges", () => {
        const counts = topLevelCounts(gen.objects);
        expect(gen.mapData.rivers.length).toBeGreaterThan(0);
        expect(counts.get("stone_03") ?? 0).toBeGreaterThan(0);
        const bridges = [...counts].filter(([t]) => t.startsWith("bridge_")).reduce((s, [, c]) => s + c, 0);
        expect(bridges).toBeGreaterThan(0);
    });

    it("expands building children with the parent's orientation", () => {
        const house = gen.objects.find((o) => o.type === "house_red_01" && o.parentId === 0)!;
        const def = getMapObjectDef("house_red_01");
        if (def.type !== "building") throw new Error("expected a building");
        const children = gen.objects.filter((o) => o.parentId === house.id);
        expect(children.length).toBeGreaterThan(10);
        const door = children.find((c) => c.type === "house_door_01")!;
        const doorDef = def.mapObjects.find((m) => m.type === "house_door_01")!;
        const local = transformOri({ type: 0, pos: doorDef.pos, rad: 1 }, house.pos, house.ori, 1);
        if (local.type !== 0) throw new Error("expected a circle");
        expect(door.pos.x).toBeCloseTo(local.pos.x, 9);
        expect(door.pos.y).toBeCloseTo(local.pos.y, 9);
        expect(door.ori).toBe((doorDef.ori + house.ori) % 4);
    });

    it("completes in under 3 s", () => {
        const t0 = process.hrtime.bigint();
        generateMap("main", 777, 1);
        const ms = Number(process.hrtime.bigint() - t0) / 1e6;
        expect(ms).toBeLessThan(3000);
    });
});

describe("generateMap other maps", () => {
    const maps = ["desert", "woods", "savannah", "cobalt", "faction", "potato", "halloween", "snow"];
    for (const name of maps) {
        it(`${name} generates deterministically`, () => {
            const a = generateMap(name, 12345, 1);
            expect(a.objects.length).toBeGreaterThan(500);
            expect(a.warnings.every((w) => typeof w === "string")).toBe(true);
            const b = generateMap(name, 12345, 1);
            expect(objectsHash(b.objects)).toBe(objectsHash(a.objects));
        });
    }

    it("applies spawn replacements", () => {
        const snow = cachedMap("snow", 12345);
        const counts = topLevelCounts(snow.objects);
        expect(counts.get("tree_01") ?? 0).toBe(0);
        expect(counts.get("tree_10") ?? 0).toBeGreaterThan(100);
    });

    it("places lake centre objects in lakes", () => {
        const woods = cachedMap("woods", 12345);
        const lake = woods.terrain.rivers.find((r) => r.looped)!;
        const pavilions = woods.objects.filter((o) => o.type === "teapavilion_01w" && o.parentId === 0);
        expect(pavilions.length).toBe(1);
        expect(pavilions[0].pos).toEqual(lake.center);
    });
});

describe("generateMap rules (M7b)", () => {
    it("skips the crossing bunker quietly when no river is wider than 8 (survev genBridge)", () => {
        let checked = 0;
        for (let seed = 1; seed <= 12 && checked < 2; seed++) {
            const g = generateMap("main", seed, 1);
            if (g.terrain.rivers.some((r) => !r.looped && r.waterWidth > 8)) continue;
            checked++;
            expect(g.skipped).toContain("bunker_structure_05: no river wider than 8");
            expect(g.warnings.some((w) => w.includes("bunker_structure_05"))).toBe(false);
            expect(g.objects.some((o) => o.type === "bunker_structure_05")).toBe(false);
        }
        expect(checked).toBeGreaterThan(0);
    });

    it("regenerates a map whose landmark buildings did not fit (docks, bunkers, towns)", () => {
        // survev's main at its own size (on the bigger rebirth map nothing in seeds 1-200 fails to fit)
        const survevMain = unscaledMapDef("main");
        let regenerated = 0;
        for (let seed = 1; seed <= 40; seed++) {
            const g = generateMap("main", seed, 1, survevMain);
            if (!g.warnings.some((w) => w.includes("regenerating"))) continue;
            regenerated++;
            for (const t of ["warehouse_complex_01", "bunker_structure_02", "bunker_structure_03", "club_complex_01"]) {
                expect([seed, t, g.objects.some((o) => o.type === t && o.parentId === 0)]).toEqual([seed, t, true]);
            }
        }
        expect(regenerated).toBeGreaterThan(0);
    }, 60_000);
});
