import { type Bounds, hashString, type Vec2 } from "@rebirth/core";
import { type Entity, type GeneratedObject, type GenerateMapResult, generateMap, type World } from "../src/index.ts";

const cache = new Map<string, GenerateMapResult>();

/** generateMap memoized per test file (generation is deterministic, so sharing results is safe). */
export function cachedMap(mapName: string, seed: number, teamMode: 1 | 2 | 4 = 1): GenerateMapResult {
    const key = `${mapName}:${seed}:${teamMode}`;
    let result = cache.get(key);
    if (!result) {
        result = generateMap(mapName, seed, teamMode);
        cache.set(key, result);
    }
    return result;
}

/** Stable digest of a generated object list (coordinates rounded to 1e-4). */
export function objectsHash(objects: readonly GeneratedObject[]): string {
    const lines = objects.map(
        (o) =>
            `${o.id},${o.type},${o.pos.x.toFixed(4)},${o.pos.y.toFixed(4)},${o.ori},${o.scale.toFixed(4)},${o.layer},${o.parentId}`,
    );
    const text = lines.join("\n");
    // two independent 32-bit hashes (forward and reversed text) make accidental matches negligible
    const reversed = lines.slice().reverse().join("\n");
    return `${hashString(text).toString(16).padStart(8, "0")}${hashString(reversed).toString(16).padStart(8, "0")}`;
}

export function box(center: Vec2, halfW: number, halfH = halfW): Bounds {
    return { min: { x: center.x - halfW, y: center.y - halfH }, max: { x: center.x + halfW, y: center.y + halfH } };
}

/** Whether nothing that blocks or changes movement (obstacles, buildings, structures) touches `area`. */
export function areaIsClear(world: World, area: Bounds): boolean {
    const objs: Entity[] = world.query(area);
    return objs.every((o) => o.kind === "decal" || o.kind === "player");
}

/**
 * First grid position (scanning from the map centre outwards) where a square of half size `half` around
 * the start and the straight path of `length` along `dir` are clear of objects and water.
 */
export function findClearPath(world: World, dir: Vec2, length: number, half = 3, wantWater = false): Vec2 {
    const { width, height } = world;
    const step = 7;
    for (let ring = 0; ring < width / step; ring++) {
        for (let i = -ring; i <= ring; i++) {
            for (let j = -ring; j <= ring; j++) {
                if (Math.max(Math.abs(i), Math.abs(j)) !== ring) continue;
                const start = { x: width / 2 + i * step, y: height / 2 + j * step };
                if (pathIsClear(world, start, dir, length, half, wantWater)) return start;
            }
        }
    }
    throw new Error("no clear path found");
}

function pathIsClear(world: World, start: Vec2, dir: Vec2, length: number, half: number, wantWater: boolean): boolean {
    const n = Math.ceil(length / 1) + 1;
    for (let k = 0; k <= n; k++) {
        const p = { x: start.x + (dir.x * length * k) / n, y: start.y + (dir.y * length * k) / n };
        if (p.x < half || p.y < half || p.x > world.width - half || p.y > world.height - half) return false;
        if (!areaIsClear(world, box(p, half))) return false;
        if (world.isOnWater(p, 0) !== wantWater) return false;
    }
    return true;
}
