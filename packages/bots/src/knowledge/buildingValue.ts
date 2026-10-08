// What a building is worth to someone looking for a good gun (bot round 6, user report 40: "players mostly drop to and
// route toward relatively big buildings whose loot has a good chance of high-tier guns: warehouse, mansion, police,
// bank, bunkers"), read from the defs of the map the bot plays:
// - every loot container (a destructible obstacle with a loot list) and loot spawner (loot_tier_*) among the building's
//   map objects (a random choice counts by its first option) adds its expected count of good guns: for each loot entry
//   the mean count times the chance that one draw of its tier (MapDef lootTable, followed through nested tiers) is a
//   gun of tier B+ or better (knowledge/gunTiers.ts), weighted up to 1 for an S-tier gun;
// - its size adds a little (the interior's zoom region area: more rooms, more floor loot);
// - a container counts a little on its own (whatever is in it may still be worth a detour).
// Cached per map and building type. Pure: no rng.
import { getMapObjectDef, hasDef, hasMapObjectDef, MapDefs } from "@rebirth/defs";
import { colliderBounds, obstacleDef, transformCollider } from "../geom.ts";
import { gunTier, TIER_BASE, tierRank } from "./gunTiers.ts";

/** A gun counts from this tier up, weighted (tier base - GOOD_FLOOR) / (S base - GOOD_FLOOR): B+ 0.2 .. S 1. */
const GOOD_TIER = tierRank("B+");
const GOOD_FLOOR = TIER_BASE.B;
/** Each container, and each 100 square units of interior, add this much (capped by SIZE_CAP). */
const PER_CONTAINER = 0.05;
const PER_AREA = 0.02;
const SIZE_CAP = 0.6;
/** Nested tiers are followed this deep. */
const MAX_DEPTH = 4;

const tierCache = new Map<string, number>();
const buildingCache = new Map<string, number>();

/** Worth of one item id as a good gun (0 for anything else). */
function gunWorth(id: string): number {
    const t = gunTier(id);
    if (!t || tierRank(t.tier) < GOOD_TIER) return 0;
    return (TIER_BASE[t.tier] - GOOD_FLOOR) / (TIER_BASE.S - GOOD_FLOOR);
}

/** Expected good-gun worth of one draw from `tier` on `mapName` (MapDef lootTable; nested tiers followed). */
export function tierGunWorth(mapName: string, tier: string, depth = 0): number {
    const key = `${mapName}:${tier}`;
    const hit = tierCache.get(key);
    if (hit !== undefined) return hit;
    if (!tier.startsWith("tier_")) return hasDef(tier) ? gunWorth(tier) : 0;
    const table = Object.hasOwn(MapDefs, mapName) ? MapDefs[mapName].lootTable[tier] : undefined;
    let w = 0;
    if (table && depth < MAX_DEPTH) {
        let total = 0;
        let sum = 0;
        for (const e of table) {
            if (!(e.weight > 0) || !e.name) continue;
            total += e.weight;
            sum +=
                e.weight * (e.name.startsWith("tier_") ? tierGunWorth(mapName, e.name, depth + 1) : gunWorth(e.name));
        }
        w = total > 0 ? sum / total : 0;
    }
    tierCache.set(key, w);
    return w;
}

type LootEntry = { tier?: string; type?: string; min?: number; max?: number; count?: number };

/** Expected good-gun worth of one container or loot spawner type on `mapName` (0 when it holds no loot). */
export function containerGunWorth(mapName: string, obstacleType: string): number {
    if (!hasMapObjectDef(obstacleType)) return 0;
    const def = getMapObjectDef(obstacleType) as { type: string; loot?: LootEntry[]; destructible?: boolean };
    if (def.type !== "obstacle" && def.type !== "loot_spawner") return 0;
    let w = 0;
    for (const l of def.loot ?? []) {
        const mean = l.tier ? ((l.min ?? 1) + (l.max ?? 1)) / 2 : (l.count ?? 1);
        w += mean * tierGunWorth(mapName, l.tier ?? l.type ?? "");
    }
    return w;
}

/** How much a building of `type` is worth to a gun hunter on `mapName` (see the header; 0 for no building). */
export function buildingLootValue(mapName: string, type: string): number {
    const key = `${mapName}:${type}`;
    const hit = buildingCache.get(key);
    if (hit !== undefined) return hit;
    let v = 0;
    if (hasMapObjectDef(type)) {
        const def = getMapObjectDef(type);
        if (def.type === "building") {
            let containers = 0;
            for (const child of (def as { mapObjects?: Array<{ type: string | Record<string, number> }> }).mapObjects ??
                []) {
                const t = typeof child.type === "string" ? child.type : (Object.keys(child.type)[0] ?? "");
                const o = hasMapObjectDef(t) ? getMapObjectDef(t) : undefined;
                if (!o) continue;
                if (
                    o.type === "loot_spawner" ||
                    (obstacleDef(t)?.destructible && (obstacleDef(t)?.loot.length ?? 0) > 0)
                ) {
                    v += containerGunWorth(mapName, t);
                    containers++;
                }
            }
            let area = 0;
            const zone = def.ceiling.zoomRegions.find((r) => r.zoomIn)?.zoomIn;
            if (zone) {
                const b = colliderBounds(transformCollider(zone, { x: 0, y: 0 }, 0, 1));
                area = (b.max.x - b.min.x) * (b.max.y - b.min.y);
            }
            v += Math.min(SIZE_CAP, containers * PER_CONTAINER + (area / 100) * PER_AREA);
        }
    }
    buildingCache.set(key, v);
    return v;
}
