// What players know about the map's basements and bunkers (BrainFeatures.basements; owner 2026-10-08: "why don't the
// bots go underground? The military base's basement shows no sign of being looted"): which structures have an
// underground floor, where its stairs come up and roughly how much loot it holds. That is map knowledge, like a player
// who knows the military base has a big basement or that the Hydra bunker is full of lockers: the client ships the same
// defs and the minimap draws the structures. The worth of a floor is the loot value of the buildings that make it
// (knowledge/buildingValue.ts: containers and loot spawns in their defs, the chance of a good gun), summed and capped;
// nothing here reads a container or an item from a snapshot, nor whether the basement was looted already (a player finds
// that out by walking down). Cached per underground navigation (one per game, nav/underground.ts).
import { type Vec2, v2 } from "@rebirth/core";
import { getMapObjectDef, hasMapObjectDef } from "@rebirth/defs";
import type { MapData } from "@rebirth/sim";
import type { UndergroundGrid, UndergroundNav } from "../nav/underground.ts";
import { buildingLootValue } from "./buildingValue.ts";

/** A floor worth more than this is no more attractive (the military base's basement sums to ~2.6). */
const VALUE_CAP = 2.5;

export interface BasementSite {
    /** the underground grid (its id, structure, stairs and floor) */
    region: UndergroundGrid;
    /** structure def id */
    type: string;
    /** loot worth of its underground buildings (knowledge/buildingValue.ts scale: a warehouse ~0.7) */
    value: number;
    /** middle of the floor's bounds */
    center: Vec2;
}

const cache = new WeakMap<UndergroundNav, BasementSite[]>();

/** Loot worth of the underground floor of `region`: its layer-1 buildings' values, summed and capped. */
export function floorValue(map: MapData, region: UndergroundGrid): number {
    let v = 0;
    for (const o of map.objects) {
        if ((o.layer & 1) !== 1 || !hasMapObjectDef(o.type) || !region.onFloor(o.pos, 2)) continue;
        if (getMapObjectDef(o.type).type !== "building") continue;
        v += buildingLootValue(map.mapName, o.type);
    }
    return Math.min(VALUE_CAP, v);
}

/** Every basement and bunker of the map with stairs the bots can walk (one per underground grid). */
export function basementSites(map: MapData, ug: UndergroundNav): readonly BasementSite[] {
    let sites = cache.get(ug);
    if (sites) return sites;
    sites = [];
    for (const region of ug.regions) {
        if (!region.portals.some((p) => p.top && p.bottom)) continue;
        const b = region.bounds;
        sites.push({
            region,
            type: region.type,
            value: floorValue(map, region),
            center: v2.mul(v2.add(b.min, b.max), 0.5),
        });
    }
    cache.set(ug, sites);
    return sites;
}
