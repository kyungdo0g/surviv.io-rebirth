// Random helpers for map generation on top of the seeded core rng.
import { createRng, hashString, type Rng, type Vec2 } from "@rebirth/core";

/** Independent deterministic stream for one generation stage, derived from the map seed. */
export function subRng(seed: number, label: string): Rng {
    return createRng((hashString(label) ^ (seed >>> 0)) >>> 0);
}

/** Uniform point inside a disc of radius `rad` centred on the origin. */
export function randomPointInCircle(rng: Rng, rad: number): Vec2 {
    const r = rad * Math.sqrt(rng.next());
    const a = rng.next() * Math.PI * 2;
    return { x: Math.cos(a) * r, y: Math.sin(a) * r };
}

export function randomPointInBounds(rng: Rng, min: Vec2, max: Vec2): Vec2 {
    return { x: rng.range(min.x, max.x), y: rng.range(min.y, max.y) };
}

/** Random point on one of the four map edges, `offset` units inside it (survev map.ts randomPointOnMapEdge). */
export function randomPointOnMapEdge(rng: Rng, width: number, height: number, offset = 0): Vec2 {
    const side = Math.floor(rng.range(0, 4));
    switch (side) {
        case 0:
            return { x: width - offset, y: rng.range(offset, height - offset) };
        case 1:
            return { x: rng.range(offset, width - offset), y: height - offset };
        case 2:
            return { x: offset, y: rng.range(offset, height - offset) };
        default:
            return { x: rng.range(offset, width - offset), y: offset };
    }
}

/** Calls `attempt` until it returns true or `maxAttempts` is reached (survev map.ts trySpawn). */
export function trySpawn(maxAttempts: number, attempt: () => boolean): boolean {
    for (let i = 0; i < maxAttempts; i++) {
        if (attempt()) return true;
    }
    return false;
}

/** Picks a key of a `{ id: weight }` object; zero weights never win (survev util.weightedRandomObject). */
export function weightedKey(rng: Rng, weights: Readonly<Record<string, number>>): string {
    const keys = Object.keys(weights).filter((k) => weights[k] > 0);
    if (keys.length === 0) return "";
    return rng.weighted(keys, (k) => weights[k]);
}
