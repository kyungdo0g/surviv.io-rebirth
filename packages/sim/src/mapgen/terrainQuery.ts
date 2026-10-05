// Point and box queries against terrain polygons (survev map.ts getGroundSurface / isOnWater, terrain part only).
import type { Bounds, Vec2 } from "@rebirth/core";
import { aabbIntersectsPolygonEdges, pointInBounds, pointInPolygon } from "../geom/polygon.ts";
import { boundsCorners } from "../geom/transform.ts";
import type { River, Terrain } from "./terrain.ts";

export type TerrainSurface = "water" | "riverbank" | "grass" | "sand";

function boundsOverlap(a: Bounds, b: Bounds): boolean {
    return a.min.x <= b.max.x && b.min.x <= a.max.x && a.min.y <= b.max.y && b.min.y <= a.max.y;
}

/** River (or lake) whose water polygon contains `pos`. */
export function riverWaterAt(terrain: Terrain, pos: Vec2): River | null {
    for (const river of terrain.rivers) {
        if (pointInBounds(pos, river.aabb) && pointInPolygon(pos, river.waterPoly)) {
            return river;
        }
    }
    return null;
}

/** Terrain-only water test: river/lake water or the sea outside the shore. */
export function isTerrainWater(terrain: Terrain, pos: Vec2): boolean {
    if (riverWaterAt(terrain, pos)) return true;
    return !pointInPolygon(pos, terrain.shore);
}

/** Ground surface of the bare terrain at `pos` (buildings and decals are handled by the world). */
export function terrainSurfaceAt(terrain: Terrain, pos: Vec2): TerrainSurface {
    let onRiverShore = false;
    for (const river of terrain.rivers) {
        if (pointInBounds(pos, river.aabb) && pointInPolygon(pos, river.shorePoly)) {
            onRiverShore = true;
            if (pointInPolygon(pos, river.waterPoly)) return "water";
        }
    }
    if (pointInPolygon(pos, terrain.grass)) return onRiverShore ? "riverbank" : "grass";
    if (pointInPolygon(pos, terrain.shore)) return "sand";
    return "water";
}

function aabbOnRiverPoly(terrain: Terrain, box: Bounds, which: "waterPoly" | "shorePoly"): boolean {
    for (const river of terrain.rivers) {
        if (!boundsOverlap(river.aabb, box)) continue;
        const poly = river[which];
        for (const c of boundsCorners(box)) {
            if (pointInPolygon(c, poly)) return true;
        }
        if (aabbIntersectsPolygonEdges(box.min, box.max, poly)) return true;
    }
    return false;
}

export function isAabbOnRiverWater(terrain: Terrain, box: Bounds): boolean {
    return aabbOnRiverPoly(terrain, box, "waterPoly");
}

export function isAabbOnRiverShore(terrain: Terrain, box: Bounds): boolean {
    return aabbOnRiverPoly(terrain, box, "shorePoly");
}
