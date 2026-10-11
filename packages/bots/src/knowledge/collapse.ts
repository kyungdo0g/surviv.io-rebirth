// Collapsing buildings (the owner's wave 3, 2026-10-10; defs BuildingDef `ceiling.destroy.collapse`, sim
// world/collapse.ts): the gas station's store and the church cave in once `wallCount` of their load-bearing walls
// (ObstacleDef.loadBearing: the brick shells rebirth_wall_brk_*) are broken, and everyone on their floor dies. What a
// player can know of it: the defs, which the client ships (which buildings collapse, how many walls bring them down,
// which walls are the brick shell: drawn brick-red), and the shell walls it sees broken or badly damaged on its screen.
// This module reads the map's collapsing buildings from the defs; brain/collapse.ts keeps what each bot has seen.
import type { Bounds, Vec2 } from "@rebirth/core";
import { getMapObjectDef, hasMapObjectDef, type ObstacleDef } from "@rebirth/defs";
import type { MapData, MapObjectSpawn } from "@rebirth/sim";
import { colliderBounds, obstacleDef, rotateOri, transformCollider } from "../geom.ts";

/** A child is matched to its spawn within this distance (puzzleSites.ts MATCH_EPS). */
const MATCH_EPS = 0.05;

export interface CollapseSite {
    /** the building's map object id */
    id: number;
    type: string;
    layer: number;
    /** load-bearing walls broken that bring it down (def ceiling.destroy.wallCount) */
    wallCount: number;
    /** map object ids of its load-bearing walls */
    walls: readonly number[];
    /** world boxes of its floor (the floor surfaces sim collapse.ts kills on) */
    floor: readonly Bounds[];
}

/** Whether an obstacle def is a load-bearing wall of a collapsing building (ObstacleDef.loadBearing). */
export function isLoadBearing(def: ObstacleDef | undefined): boolean {
    return !!def?.loadBearing;
}

function spawnAt(map: MapData, type: string, p: Vec2): MapObjectSpawn | undefined {
    for (const o of map.objects) {
        if (o.type === type && Math.abs(o.pos.x - p.x) < MATCH_EPS && Math.abs(o.pos.y - p.y) < MATCH_EPS) return o;
    }
    return undefined;
}

const cache = new WeakMap<MapData, CollapseSite[]>();

/** Every collapsing building of a map with its load-bearing walls and floor (cached per map). */
export function collapseSites(map: MapData): CollapseSite[] {
    let sites = cache.get(map);
    if (sites) return sites;
    sites = [];
    for (const o of map.objects) {
        if (!hasMapObjectDef(o.type)) continue;
        const def = getMapObjectDef(o.type);
        if (def.type !== "building" || !def.ceiling.destroy?.collapse) continue;
        const walls: number[] = [];
        for (const c of def.mapObjects) {
            if (typeof c.type !== "string" || !isLoadBearing(obstacleDef(c.type))) continue;
            const at = { x: o.pos.x + rotateOri(c.pos, o.ori).x, y: o.pos.y + rotateOri(c.pos, o.ori).y };
            const w = spawnAt(map, c.type, at);
            if (w) walls.push(w.id);
        }
        const floor: Bounds[] = [];
        for (const s of def.floor.surfaces) {
            for (const col of s.collision) floor.push(colliderBounds(transformCollider(col, o.pos, o.ori, 1)));
        }
        sites.push({ id: o.id, type: o.type, layer: o.layer, wallCount: def.ceiling.destroy.wallCount, walls, floor });
    }
    cache.set(map, sites);
    return sites;
}

/** Whether `p` on `layer` stands on the site's floor (the area its collapse buries), grown by `slack`. */
export function onCollapseFloor(site: CollapseSite, p: Vec2, layer: number, slack = 0): boolean {
    if ((layer & 1) !== (site.layer & 1)) return false;
    return site.floor.some(
        (b) => p.x >= b.min.x - slack && p.x <= b.max.x + slack && p.y >= b.min.y - slack && p.y <= b.max.y + slack,
    );
}
