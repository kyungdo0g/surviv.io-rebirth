// Game: fixed-step authoritative simulation implementing the GameApi contract.
// Tick order follows survev server/src/game/game.ts: players (input actions, movement, weapons), loot, bullets
// (then their queued damage), building occupancy.
import { type Bounds, collider, type Rng, type Vec2, v2 } from "@rebirth/core";
import { GameConfig } from "@rebirth/defs";
import { type GameApi, type GameOptions, TICK_HZ } from "./api.ts";
import { BulletSystem } from "./combat/bullets.ts";
import { applyObstacleDamage, applyPlayerDamage } from "./combat/combat.ts";
import type { DamageParams } from "./combat/damage.ts";
import { segmentIntersectsAabb } from "./geom/polygon.ts";
import type { PlayerInput } from "./input.ts";
import { spawnMapLoot } from "./loot/drops.ts";
import { LootSystem } from "./loot/loot.ts";
import { type GenerateMapResult, generateMap } from "./mapgen/generate.ts";
import { subRng } from "./mapgen/random.ts";
import { terrainSurfaceAt } from "./mapgen/terrainQuery.ts";
import { defaultRules, type SimRules } from "./rules.ts";
import type { BulletEvent, MapData, ObjectView, Snapshot } from "./view.ts";
import type { SimContext } from "./world/context.ts";
import type { Building, Obstacle } from "./world/entities.ts";
import { Player } from "./world/player.ts";
import { type Entity, World } from "./world/world.ts";

/** Visible area margin around the camera, in world units (survev client.ts adds 4 to the zoom). */
export const VIEW_MARGIN = 4;
/** The client camera keeps a 16:9 aspect: `zoom` is half the larger screen dimension (survev client.ts). */
export const VIEW_ASPECT = 16 / 9;
/** Placement attempts for a spawn point (survev map.ts getRandomSpawnPos). */
const SPAWN_ATTEMPTS = 500;
/** Bullet reports older than this many ticks are forgotten (a client that slept longer misses them). */
const BULLET_REPORT_TICKS = TICK_HZ;

/** World-space rectangle a player with camera radius `zoom` at `pos` can see, margin included. */
export function viewBounds(pos: Vec2, zoom: number): Bounds {
    const halfW = zoom + VIEW_MARGIN;
    const halfH = zoom / VIEW_ASPECT + VIEW_MARGIN;
    return { min: { x: pos.x - halfW, y: pos.y - halfH }, max: { x: pos.x + halfW, y: pos.y + halfH } };
}

export function entityView(entity: Entity): ObjectView {
    return entity.toView();
}

/** Optional construction parameters for tests and tools. */
export interface GameInit {
    /** use this generated map instead of generating one from the options */
    generation?: GenerateMapResult;
    /** roll the map's loot spawners at creation (default true) */
    spawnLoot?: boolean;
}

export class Game implements GameApi, SimContext {
    readonly options: GameOptions;
    readonly mapData: MapData;
    readonly generation: GenerateMapResult;
    readonly world: World;
    /** gameplay knobs (see rules.ts); mutable per game */
    readonly rules: SimRules = defaultRules();
    /** spread, pellet jitter, bullet range jitter and headshots; replaceable by tests (e.g. a centered rng) */
    combatRng: Rng;
    /** loot tier rolls and drop motion */
    lootRng: Rng;
    readonly bullets: BulletSystem;
    readonly loot: LootSystem;
    private readonly players = new Map<number, Player>();
    /** ids each player saw in its previous snapshot */
    private readonly visible = new Map<number, Set<number>>();
    /** tick of each player's previous snapshot (bullet reports after it are new to that player) */
    private readonly lastSnapshotTick = new Map<number, number>();
    private readonly rng: Rng;
    private occupied = new Set<Building>();
    private tickCount = 0;
    private readonly scratch: Entity[] = [];

    constructor(options: GameOptions, init: GameInit = {}) {
        this.options = { ...options };
        this.generation = init.generation ?? generateMap(options.mapName, options.seed, options.teamMode ?? 1);
        this.mapData = this.generation.mapData;
        this.world = new World(this.generation);
        this.rng = subRng(options.seed, `game:${options.mapName}`);
        this.combatRng = subRng(options.seed, `combat:${options.mapName}`);
        this.lootRng = subRng(options.seed, `loot:${options.mapName}`);
        this.bullets = new BulletSystem(this);
        this.loot = new LootSystem(this.world, () => this.lootRng);
        if (init.spawnLoot ?? true) spawnMapLoot(this, this.generation.lootSpawns);
    }

    get tick(): number {
        return this.tickCount;
    }

    get time(): number {
        return this.tickCount / TICK_HZ;
    }

    getPlayer(id: number): Player | undefined {
        return this.players.get(id);
    }

    /** Whether a player may spawn at `pos`: on grass, dry, not inside obstacles or buildings (survev canPlayerSpawn). */
    canPlayerSpawn(pos: Vec2): boolean {
        if (terrainSurfaceAt(this.world.terrain, pos) !== "grass") return false;
        if (this.world.isOnWater(pos, 0)) return false;
        const rad = GameConfig.player.radius;
        const circle = collider.createCircle(pos, rad);
        const box = { min: { x: pos.x - rad, y: pos.y - rad }, max: { x: pos.x + rad, y: pos.y + rad } };
        for (const obj of this.world.query(box, this.scratch)) {
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

    private findSpawnPos(): Vec2 {
        const { width, height, shoreInset } = this.mapData;
        const minDist = GameConfig.player.minSpawnRad;
        let fallback: Vec2 | null = null;
        for (let i = 0; i < SPAWN_ATTEMPTS; i++) {
            const pos = {
                x: this.rng.range(shoreInset, width - shoreInset),
                y: this.rng.range(shoreInset, height - shoreInset),
            };
            if (!this.canPlayerSpawn(pos)) continue;
            fallback ??= pos;
            let crowded = false;
            for (const p of this.players.values()) {
                if (!p.dead && v2.distance(p.pos, pos) < minDist) crowded = true;
            }
            if (!crowded) return pos;
        }
        return fallback ?? { x: width / 2, y: height / 2 };
    }

    addPlayer(name: string): number {
        const player = new Player(this.world.allocId(), name, this.findSpawnPos());
        this.players.set(player.id, player);
        this.world.add(player);
        this.visible.set(player.id, new Set());
        this.lastSnapshotTick.set(player.id, this.tickCount);
        return player.id;
    }

    removePlayer(id: number): void {
        const player = this.players.get(id);
        if (!player) return;
        this.players.delete(id);
        this.visible.delete(id);
        this.lastSnapshotTick.delete(id);
        this.world.remove(player);
    }

    setInput(playerId: number, input: PlayerInput): void {
        this.players.get(playerId)?.receiveInput(input);
    }

    /** Moves a player instantly (tests and debug tools). */
    teleportPlayer(id: number, pos: Vec2): void {
        const player = this.players.get(id);
        if (!player) return;
        player.pos = this.world.clampToMap(pos, player.rad);
        player.posOld = v2.copy(player.pos);
        player.bounds = player.computeBounds();
        this.world.updateBounds(player);
    }

    damagePlayer(target: Player, params: DamageParams): void {
        applyPlayerDamage(this, target, params);
    }

    damageObstacle(obstacle: Obstacle, params: DamageParams): void {
        applyObstacleDamage(this, obstacle, params);
    }

    step(): void {
        const dt = 1 / TICK_HZ;
        // reports made during this step belong to the tick it completes
        this.bullets.tick = this.tickCount + 1;
        for (const player of this.players.values()) {
            player.update(this, dt);
        }
        this.loot.update(dt);
        this.bullets.update(dt);
        // bullet damage is applied after every bullet moved (survev BulletBarn.update)
        const damages = this.bullets.damages.splice(0);
        for (const d of damages) {
            if (d.target.kind === "player") this.damagePlayer(d.target, d.params);
            else this.damageObstacle(d.target, d.params);
        }
        // a building is occupied while any living player is inside one of its ceiling zoom regions
        const occupied = new Set<Building>();
        for (const player of this.players.values()) {
            if (player.dead) continue;
            for (const b of player.occupiedBuildings) occupied.add(b);
        }
        for (const b of this.occupied) if (!occupied.has(b)) b.occupied = false;
        for (const b of occupied) b.occupied = true;
        this.occupied = occupied;
        this.tickCount++;
        this.bullets.pruneReports(this.tickCount - BULLET_REPORT_TICKS);
    }

    /** Bullets reported after `sinceTick` whose drawn path crosses `view` (latest state, one entry per bullet). */
    private bulletEvents(sinceTick: number, view: Bounds): BulletEvent[] {
        const byId = new Map<number, BulletEvent>();
        for (const { tick, bullet } of this.bullets.reports) {
            if (tick <= sinceTick || byId.has(bullet.id)) continue;
            const end = v2.add(bullet.startPos, v2.mul(bullet.dir, bullet.clientDistance));
            if (!segmentIntersectsAabb(bullet.startPos, end, view.min, view.max)) continue;
            byId.set(bullet.id, BulletSystem.toEvent(bullet));
        }
        return [...byId.values()].sort((a, b) => a.id - b.id);
    }

    getSnapshot(playerId: number): Snapshot {
        const player = this.players.get(playerId);
        if (!player) throw new Error(`getSnapshot: unknown player ${playerId}`);
        const prev = this.visible.get(playerId) ?? new Set<number>();
        const next = new Set<number>();
        const objects: ObjectView[] = [];
        const view = viewBounds(player.pos, player.zoom);
        for (const obj of this.world.query(view, this.scratch)) {
            next.add(obj.id);
        }
        // the local player is always included
        next.add(player.id);
        const ids = [...next].sort((a, b) => a - b);
        for (const id of ids) {
            const obj = this.world.get(id);
            if (obj) objects.push(obj.toView());
        }
        const deletedIds: number[] = [];
        for (const id of prev) {
            if (!next.has(id)) deletedIds.push(id);
        }
        deletedIds.sort((a, b) => a - b);
        this.visible.set(playerId, next);
        const bullets = this.bulletEvents(this.lastSnapshotTick.get(playerId) ?? this.tickCount, view);
        this.lastSnapshotTick.set(playerId, this.tickCount);
        return {
            tick: this.tickCount,
            time: this.time,
            localPlayerId: player.id,
            local: player.localState(),
            objects,
            deletedIds,
            bullets,
        };
    }
}
