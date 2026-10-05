// Building roofs: the original client draws a building's ceiling over its interior unless the local player stands
// inside one of its zoom regions, so players and loot under someone else's roof are not visible from outside.
import type { Bounds } from "@rebirth/core";
import { getMapObjectDef, hasMapObjectDef } from "@rebirth/defs";
import type { BuildingView } from "@rebirth/sim";
import { colliderBounds, transformCollider } from "../geom.ts";

export interface Roof {
    id: number;
    /** world-space zoomIn regions under the ceiling */
    regions: Bounds[];
}

function regionsOf(b: BuildingView, cache: Map<number, Bounds[]>): Bounds[] {
    let regions = cache.get(b.id);
    if (regions) return regions;
    regions = [];
    if (hasMapObjectDef(b.type)) {
        const def = getMapObjectDef(b.type);
        if (def.type === "building") {
            for (const r of def.ceiling.zoomRegions) {
                if (r.zoomIn) regions.push(colliderBounds(transformCollider(r.zoomIn, b.pos, b.ori, 1)));
            }
        }
    }
    cache.set(b.id, regions);
    return regions;
}

/**
 * Roofs that still stand among `buildings` (ground floor only: underground floors have no ceiling to hide under).
 * `cache` keeps each building's regions by id (buildings never move).
 */
export function roofRegions(buildings: readonly BuildingView[], cache: Map<number, Bounds[]>): Roof[] {
    const out: Roof[] = [];
    for (const b of buildings) {
        if (b.ceilingDead || b.layer !== 0) continue;
        const regions = regionsOf(b, cache);
        if (regions.length) out.push({ id: b.id, regions });
    }
    return out;
}
