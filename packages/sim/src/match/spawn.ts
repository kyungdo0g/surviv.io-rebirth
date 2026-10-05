// Spawn points: whether a player may spawn at a position, a random spawn point away from other groups, and a spawn
// point next to the group's spawn position for teammates (M6a).
// Behaviour follows survev server/src/game/map.ts getSpawnPos / getRandomSpawnPos / canPlayerSpawn.
import { type Bounds, collider, type Rng, type Vec2, v2 } from "@rebirth/core";
import { GameConfig } from "@rebirth/defs";
import { terrainSurfaceAt } from "../mapgen/terrainQuery.ts";
import type { Player } from "../world/player.ts";
import type { Entity, World } from "../world/world.ts";
import type { Group } from "./teams.ts";

/** Placement attempts for a spawn point (survev map.ts getRandomSpawnPos). */
const SPAWN_ATTEMPTS = 500;
/** Players never spawn this close to a falling or landed air drop (survev map.ts). */
const AIRDROP_SPAWN_CLEARANCE = 8;

/** What spawning needs from the game. */
export interface SpawnHost {
    readonly world: World;
    readonly mapData: { width: number; height: number; shoreInset: number };
    readonly planes: { readonly airdrops: ReadonlyArray<{ pos: Vec2 }> };
    players(): Iterable<Player>;
}

const scratch: Entity[] = [];

/** Whether a player may spawn at `pos`: on grass, dry, not inside obstacles or buildings (survev canPlayerSpawn). */
export function canPlayerSpawn(host: SpawnHost, pos: Vec2): boolean {
    const world = host.world;
    if (terrainSurfaceAt(world.terrain, pos) !== "grass") return false;
    if (world.isOnWater(pos, 0)) return false;
    // never under a falling air drop (survev map.ts getRandomSpawnPos; changelog 0.6.95)
    for (const drop of host.planes.airdrops) if (v2.distance(drop.pos, pos) < AIRDROP_SPAWN_CLEARANCE) return false;
    const rad = GameConfig.player.radius;
    const circle = collider.createCircle(pos, rad);
    const box: Bounds = { min: { x: pos.x - rad, y: pos.y - rad }, max: { x: pos.x + rad, y: pos.y + rad } };
    for (const obj of world.query(box, scratch)) {
        if (obj.layer !== 0) continue;
        if (obj.kind === "obstacle") {
            if (obj.blocking && collider.intersect(circle, obj.collider)) return false;
        } else if (obj.kind === "building") {
            for (const s of obj.surfaces) {
                if (s.colliders.some((c) => collider.intersect(circle, c))) return false;
            }
            for (const r of obj.zoomRegions) {
                if (r.zoomIn && collider.intersect(circle, { type: 1, min: r.zoomIn.min, max: r.zoomIn.max })) {
                    return false;
                }
            }
        }
    }
    return true;
}

/** Whether a living player of another group stands within minSpawnRad of `pos` (survev getRandomSpawnPos). */
function crowded(host: SpawnHost, pos: Vec2, group: Group | null): boolean {
    for (const p of host.players()) {
        if (p.dead || (group && p.group === group)) continue;
        if (v2.distance(p.pos, pos) < GameConfig.player.minSpawnRad) return true;
    }
    return false;
}

/** A random spawn point on the island away from other groups (the first player of a group, every solo player). */
export function randomSpawnPos(host: SpawnHost, rng: Rng, group: Group | null): Vec2 {
    const { width, height, shoreInset } = host.mapData;
    let fallback: Vec2 | null = null;
    for (let i = 0; i < SPAWN_ATTEMPTS; i++) {
        const pos = { x: rng.range(shoreInset, width - shoreInset), y: rng.range(shoreInset, height - shoreInset) };
        if (!canPlayerSpawn(host, pos)) continue;
        fallback ??= pos;
        if (!crowded(host, pos, group)) return pos;
    }
    return fallback ?? { x: width / 2, y: height / 2 };
}

/**
 * A spawn point for a teammate: uniform in the circle of GameConfig.player.teammateSpawnRadius (5) around the group's
 * spawn position (its first player's position, updated every second while the group can still fill; survev
 * getSpawnPos), away from other groups. Falls back to the spawn position itself.
 */
export function teammateSpawnPos(host: SpawnHost, rng: Rng, group: Group, center: Vec2): Vec2 {
    const rad = GameConfig.player.teammateSpawnRadius;
    let fallback: Vec2 | null = null;
    for (let i = 0; i < SPAWN_ATTEMPTS; i++) {
        const a = rng.range(0, Math.PI * 2);
        const r = rad * Math.sqrt(rng.next());
        const pos = { x: center.x + Math.cos(a) * r, y: center.y + Math.sin(a) * r };
        if (!canPlayerSpawn(host, pos)) continue;
        fallback ??= pos;
        if (!crowded(host, pos, group)) return pos;
    }
    return fallback ?? v2.copy(center);
}
