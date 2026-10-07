// The new-gun beta's floor copies (rules.gunBeta, server GUN_BETA; defs rebirth/gunBeta.ts): with the map loot, every
// beta gun the map allows is laid GUN_BETA_FLOOR_COPIES times at the map's floor gun spots (loot spawners whose rolls
// can give a tier_guns gun), so the owner finds each one on every map. The spots are shuffled with the loot rng, so a
// seed always gives the same floor; without the beta nothing here runs and no rng is drawn.
import {
    GUN_BETA_FLOOR_COPIES,
    getGunBetaGuns,
    getMapObjectDef,
    hasMapObjectDef,
    type LootTableEntry,
} from "@rebirth/defs";
import type { LootSpawn } from "../mapgen/generator.ts";
import type { SimContext } from "../world/context.ts";

type Tables = Readonly<Record<string, readonly LootTableEntry[]>>;

/** The floor gun table: the beta's copies go where floor guns can lie. */
const FLOOR_GUN_TABLE = "tier_guns";

/** Whether rolling `tier` can reach `target` (nested tier_* tables followed). */
function reaches(tables: Tables, tier: string, target: string, seen = new Set<string>()): boolean {
    if (tier === target) return true;
    if (seen.has(tier)) return false;
    seen.add(tier);
    for (const e of tables[tier] ?? []) {
        if (e.weight > 0 && e.name.startsWith("tier_") && reaches(tables, e.name, target, seen)) return true;
    }
    return false;
}

/** The map's loot spawner points whose rolls can give a floor gun, in spawn order. */
export function floorGunSpots(tables: Tables, spawns: readonly LootSpawn[]): LootSpawn[] {
    const byType = new Map<string, boolean>();
    return spawns.filter((spawn) => {
        let ok = byType.get(spawn.type);
        if (ok === undefined) {
            const def = hasMapObjectDef(spawn.type) ? getMapObjectDef(spawn.type) : undefined;
            ok =
                def?.type === "loot_spawner" &&
                def.loot.some((e) => !!e.tier && reaches(tables, e.tier, FLOOR_GUN_TABLE));
            byType.set(spawn.type, ok);
        }
        return ok;
    });
}

/**
 * Lays the beta's floor copies: copy after copy of the map's beta guns over the shuffled spots (one gun per spot while
 * spots last), each with its side ammo like a floor gun.
 */
export function spawnGunBetaCopies(ctx: SimContext, spawns: readonly LootSpawn[], tables: Tables): void {
    const guns = getGunBetaGuns(ctx.world.mapData.mapName);
    const spots = floorGunSpots(tables, spawns);
    if (guns.length === 0 || spots.length === 0) return;
    ctx.lootRng.shuffle(spots);
    let next = 0;
    for (let copy = 0; copy < GUN_BETA_FLOOR_COPIES; copy++) {
        for (const gun of guns) {
            const spot = spots[next++ % spots.length];
            ctx.loot.addLoot(gun, spot.pos, spot.layer, 1, { pushSpeed: 0, source: "map" });
        }
    }
}
