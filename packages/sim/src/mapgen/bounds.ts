// Local-space bounding colliders of map object definitions, used for placement and broadphase bounds.
// Behaviour follows survev shared/utils/mapHelpers.ts and map.ts getBuildingBounds.
import { type Bounds, type Collider, collider, math, type Vec2 } from "@rebirth/core";
import { getMapObjectDef, hasMapObjectDef, type MapObjectDef } from "@rebirth/defs";
import { cleanCollider, toBounds, transformOri } from "../geom/transform.ts";

const cache = new Map<string, Collider>();

/** Candidate types of a building child: a plain id or every positively weighted key of a weights object. */
export function childTypeCandidates(type: string | Record<string, number>): string[] {
    if (typeof type === "string") return type ? [type] : [];
    return Object.keys(type).filter((k) => k !== "" && type[k] > 0);
}

function unionAll(list: Bounds[]): Bounds {
    const min = { x: Infinity, y: Infinity };
    const max = { x: -Infinity, y: -Infinity };
    for (const b of list) {
        min.x = Math.min(min.x, b.min.x);
        min.y = Math.min(min.y, b.min.y);
        max.x = Math.max(max.x, b.max.x);
        max.y = Math.max(max.y, b.max.y);
    }
    if (min.x > max.x) return { min: { x: -1, y: -1 }, max: { x: 1, y: 1 } };
    return { min, max };
}

function computeBoundingCollider(type: string): Collider {
    const def = getMapObjectDef(type);
    switch (def.type) {
        case "structure": {
            const boxes: Bounds[] = [];
            for (const layer of def.layers) {
                boxes.push(toBounds(transformOri(getBoundingCollider(layer.type), layer.pos, layer.ori, 1)));
            }
            for (const stair of def.stairs) boxes.push(toBounds(stair.collision));
            const b = unionAll(boxes);
            // small margin so loot leaving a stairwell still finds the structure (survev mapHelpers.ts)
            return collider.createAabb({ x: b.min.x - 1, y: b.min.y - 1 }, { x: b.max.x + 1, y: b.max.y + 1 });
        }
        case "building": {
            const boxes: Bounds[] = [];
            for (const surface of def.floor.surfaces) {
                for (const col of surface.collision) boxes.push(toBounds(col));
            }
            for (const region of def.ceiling.zoomRegions) {
                if (region.zoomIn) boxes.push(toBounds(region.zoomIn));
                if (region.zoomOut) boxes.push(toBounds(region.zoomOut));
            }
            for (const child of def.mapObjects) {
                // survev picks one random candidate here; the union of all candidates keeps this deterministic
                for (const childType of childTypeCandidates(child.type)) {
                    if (!hasMapObjectDef(childType)) continue;
                    const col = transformOri(getBoundingCollider(childType), child.pos, child.ori, child.scale);
                    boxes.push(toBounds(col));
                }
            }
            const b = unionAll(boxes);
            return collider.createAabb(b.min, b.max);
        }
        case "decal":
            return collider.toAabb(cleanCollider(def.collision));
        case "loot_spawner":
            return collider.createCircle({ x: 0, y: 0 }, 3);
        default:
            return cleanCollider(def.collision);
    }
}

/** Memoized local-space bounding collider of a map object type. */
export function getBoundingCollider(type: string): Collider {
    let col = cache.get(type);
    if (!col) {
        col = computeBoundingCollider(type);
        cache.set(type, col);
    }
    return col;
}

export function getBoundingAabb(type: string): Bounds {
    return toBounds(getBoundingCollider(type));
}

export interface LayeredCollider {
    layer: number;
    collision: Collider;
}

/** Building bounds are 15% larger so buildings never spawn right next to each other (survev map.ts). */
export const BUILDING_BOUND_SCALE = 1.15;
/** Scale of the obstacle bounds a building or structure without mapObstacleBounds reserves (survev map.ts). */
export const BUILDING_OBSTACLE_BOUND_SCALE = 1.1;

/** Everything a building or structure occupies, used to test whether it can spawn (survev getBuildingBounds). */
export function buildingSpawnBounds(type: string, layer: number, pos: Vec2, ori: number): LayeredCollider[] {
    const def = getMapObjectDef(type);
    if (def.type !== "building" && def.type !== "structure") return [];
    const out: LayeredCollider[] = [
        { layer, collision: transformOri(getBoundingCollider(type), pos, ori, BUILDING_BOUND_SCALE) },
    ];
    for (const col of def.bridgeLandBounds ?? []) out.push({ layer, collision: transformOri(col, pos, ori, 1) });
    for (const col of def.mapObstacleBounds ?? []) out.push({ layer, collision: transformOri(col, pos, ori, 1) });
    if (def.type === "building") {
        for (const child of def.mapObjects) {
            for (const childType of childTypeCandidates(child.type)) {
                if (!hasMapObjectDef(childType) || getMapObjectDef(childType).type !== "structure") continue;
                const childPos = math.addAdjust(pos, child.pos, ori);
                out.push(...buildingSpawnBounds(childType, layer, childPos, (ori + child.ori) % 4));
            }
        }
    } else {
        def.layers.forEach((layerDef, i) => {
            const childPos = math.addAdjust(pos, layerDef.pos, ori);
            out.push(...buildingSpawnBounds(layerDef.type, i, childPos, (ori + layerDef.ori) % 4));
        });
    }
    return out;
}

/** Bridge length (along its long axis) and width. */
function bridgeDims(type: string): { length: number; width: number } {
    const b = getBoundingAabb(type);
    const ex = (b.max.x - b.min.x) * 0.5;
    const ey = (b.max.y - b.min.y) * 0.5;
    return ex > ey ? { length: ex * 2, width: ey * 2 } : { length: ey * 2, width: ex * 2 };
}

/** Expanded box across a bridge: how closely bridges may spawn to one another (survev mapHelpers.ts). */
export function bridgeOverlapBounds(type: string, pos: Vec2, ori: number): Bounds {
    const def = getMapObjectDef(type) as Extract<MapObjectDef, { type: "building" | "structure" }>;
    const dims = bridgeDims(type);
    const mult = def.terrain.bridge?.nearbyWidthMult ?? 1;
    const ext = { x: dims.length * 1.5 * 0.5, y: dims.width * mult * 0.5 };
    const col = collider.createAabb({ x: -ext.x, y: -ext.y }, { x: ext.x, y: ext.y });
    return toBounds(transformOri(col, pos, ori, 1));
}
