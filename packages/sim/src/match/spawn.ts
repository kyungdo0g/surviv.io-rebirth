// Spawn points: whether a player may spawn at a position, a random spawn point away from other groups, and a spawn
// point next to the group's spawn position for teammates (M6a).
// Behaviour follows survev server/src/game/map.ts getSpawnPos / getRandomSpawnPos / canPlayerSpawn.
import { type Bounds, collider, type Rng, type Vec2, v2 } from "@rebirth/core";
import { GameConfig } from "@rebirth/defs";
import type { Player } from "../world/player.ts";
import type { Entity, World } from "../world/world.ts";
import type { Group } from "./teams.ts";

/** Placement attempts for a spawn point (survev map.ts getRandomSpawnPos). */
const SPAWN_ATTEMPTS = 500;
/** Players never spawn this close to a falling or landed air drop (survev map.ts). */
const AIRDROP_SPAWN_CLEARANCE = 8;
/** nor this close to an enemy's thrown projectile on the ground layer (survev map.ts:2218-2229; changelog 0.6.95) */
const PROJECTILE_SPAWN_CLEARANCE = 16;

/** What spawning needs from the game. */
export interface SpawnHost {
    readonly world: World;
    readonly mapData: { width: number; height: number; shoreInset: number };
    readonly planes: { readonly airdrops: ReadonlyArray<{ pos: Vec2 }> };
    readonly projectiles: { readonly projectiles: ReadonlyArray<{ pos: Vec2; layer: number; ownerId: number }> };
    players(): Iterable<Player>;
    getPlayer(id: number): Player | undefined;
}

const scratch: Entity[] = [];

/**
 * Whether a player may spawn at `pos`: dry (beach sand and river banks included), not inside obstacles or buildings
 * (survev canPlayerSpawn).
 */
export function canPlayerSpawn(host: SpawnHost, pos: Vec2): boolean {
    const world = host.world;
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

/**
 * Whether a living player of another group (50v50: of the other faction) stands within minSpawnRad of `pos`, or such
 * a player's thrown projectile lies on the ground layer within PROJECTILE_SPAWN_CLEARANCE (survev getRandomSpawnPos).
 */
function crowded(host: SpawnHost, pos: Vec2, group: Group | null, faction = 0): boolean {
    const friendly = (p: Player) => (group && p.group === group) || (faction !== 0 && p.teamId === faction);
    for (const p of host.players()) {
        if (p.dead || friendly(p)) continue;
        if (v2.distance(p.pos, pos) < GameConfig.player.minSpawnRad) return true;
    }
    for (const proj of host.projectiles.projectiles) {
        if (proj.layer !== 0 || v2.distance(proj.pos, pos) >= PROJECTILE_SPAWN_CLEARANCE) continue;
        const owner = host.getPlayer(proj.ownerId);
        if (owner && !friendly(owner)) return true;
    }
    return false;
}

/**
 * A random spawn point on the island away from other groups (the first player of a group, every solo player); 50v50
 * spawns inside `band`, the faction's side (M7a).
 */
export function randomSpawnPos(host: SpawnHost, rng: Rng, group: Group | null, band?: Bounds, faction = 0): Vec2 {
    const { width, height, shoreInset } = host.mapData;
    const area = band ?? {
        min: { x: shoreInset, y: shoreInset },
        max: { x: width - shoreInset, y: height - shoreInset },
    };
    let fallback: Vec2 | null = null;
    for (let i = 0; i < SPAWN_ATTEMPTS; i++) {
        const pos = { x: rng.range(area.min.x, area.max.x), y: rng.range(area.min.y, area.max.y) };
        if (!canPlayerSpawn(host, pos)) continue;
        fallback ??= pos;
        if (!crowded(host, pos, group, faction)) return pos;
    }
    return fallback ?? { x: (area.min.x + area.max.x) / 2, y: (area.min.y + area.max.y) / 2 };
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
        if (!crowded(host, pos, group, group.factionTeam)) return pos;
    }
    return fallback ?? v2.copy(center);
}
