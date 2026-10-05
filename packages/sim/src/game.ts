// Game: fixed-step authoritative simulation implementing the GameApi contract.
// Tick order follows survev server/src/game/game.ts: start check, gas, players (gas damage, input actions, boost,
// movement, weapons), loot, bullets (then their queued damage), projectiles, explosions, smoke, obstacle timers,
// building puzzles and scheduled unlocks (M5b), planes, air strikes and air drops, building occupancy, spectators,
// then the end-of-tick match results.
import { type Bounds, collider, type Rng, type Vec2, v2 } from "@rebirth/core";
import { DamageType, GameConfig, type GasStage } from "@rebirth/defs";
import { type GameApi, type GameOptions, type SpectateActionName, TICK_HZ } from "./api.ts";
import { BulletSystem } from "./combat/bullets.ts";
import { applyObstacleDamage, applyPlayerDamage } from "./combat/combat.ts";
import type { DamageParams } from "./combat/damage.ts";
import { ExplosionSystem } from "./combat/explosions.ts";
import { ProjectileSystem } from "./combat/projectiles.ts";
import { segmentIntersectsAabb } from "./geom/polygon.ts";
import { emptyInput, type PlayerInput } from "./input.ts";
import { spawnMapLoot } from "./loot/drops.ts";
import { LootSystem } from "./loot/loot.ts";
import { type GenerateMapResult, generateMap } from "./mapgen/generate.ts";
import { subRng } from "./mapgen/random.ts";
import { terrainSurfaceAt } from "./mapgen/terrainQuery.ts";
import { EventLog } from "./match/events.ts";
import { Gas } from "./match/gas.ts";
import { Match } from "./match/match.ts";
import { PlaneSystem } from "./match/planes.ts";
import { SpectateSystem } from "./match/spectate.ts";
import { UnlockSystem } from "./match/unlocks.ts";
import { defaultRules, type SimRules } from "./rules.ts";
import type { BulletEvent, MapData, ObjectView, PlayerInfoView, RecorderEvent, Snapshot } from "./view.ts";
import type { SimContext } from "./world/context.ts";
import { checkDoorLayer } from "./world/doors.ts";
import type { Building, Obstacle } from "./world/entities.ts";
import { updateObstacleTimers } from "./world/interact.ts";
import { floorsVisible } from "./world/layers.ts";
import { Player } from "./world/player.ts";
import { updatePuzzle } from "./world/puzzles.ts";
import { SmokeSystem } from "./world/smoke.ts";
import { type Entity, World } from "./world/world.ts";

/** Visible area margin around the camera, in world units (survev client.ts adds 4 to the zoom). */
export const VIEW_MARGIN = 4;
/** The client camera keeps a 16:9 aspect: `zoom` is half the larger screen dimension (survev client.ts). */
export const VIEW_ASPECT = 16 / 9;
/** Placement attempts for a spawn point (survev map.ts getRandomSpawnPos). */
const SPAWN_ATTEMPTS = 500;
/** Join / leave events are kept this long for viewers that skip snapshots. */
const PLAYER_EVENT_RETENTION_TICKS = 30 * TICK_HZ;
/** Players never spawn this close to a falling or landed air drop (survev map.ts). */
const AIRDROP_SPAWN_CLEARANCE = 8;
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

function playerInfo(p: Player): PlayerInfoView {
    return { playerId: p.id, teamId: p.teamId, groupId: p.teamId, name: p.name };
}

/** Optional construction parameters for tests, tools and the client's loopback. */
export interface GameInit {
    /** use this generated map instead of generating one from the options */
    generation?: GenerateMapResult;
    /** roll the map's loot spawners at creation (default true) */
    spawnLoot?: boolean;
    /**
     * Sandbox / loopback (M4): the match starts on the first step even with a single player, never ends (no game
     * over, no winner) and always accepts joins. The gas, planes and kill feed run as usual.
     */
    sandbox?: boolean;
    /**
     * Living players needed to start the match, each alive for `rules.minActiveTime` (10 s); default 2 like the
     * original (M4). Until then the gas stays "inactive" (the client shows "Waiting for players").
     */
    minPlayers?: number;
    /** gas stage table (default GameConfig.gas.stages; tools and tests use shorter ones) */
    gasStages?: readonly GasStage[];
}

/** Default start condition: two players (survev gameModeManager isGameStarted: cantDespawnAliveCount > 1). */
export const DEFAULT_MIN_PLAYERS = 2;

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
    /** projectiles, explosions and smoke (M5); replaceable by tests */
    fxRng: Rng;
    readonly bullets: BulletSystem;
    readonly loot: LootSystem;
    /** thrown grenades, potato gun shots, air strike bombs (M5) */
    readonly projectiles: ProjectileSystem;
    /** explosions, resolved once per tick (M5) */
    readonly explosions: ExplosionSystem;
    /** smoke emitters and clouds (M5) */
    readonly smokes: SmokeSystem;
    /** red zone (M4) */
    readonly gas: Gas;
    /** match lifecycle: start, alive count, kills, kill leader, game over (M4) */
    readonly match: Match;
    /** planes, falling air drops and minimap indicators (M4) */
    readonly planes: PlaneSystem;
    readonly spectators: SpectateSystem;
    /** scheduled door unlocks of MapDef gameConfig.unlocks (M5b) */
    readonly unlocks: UnlockSystem;
    /** buildings with a puzzle, updated every tick (M5b) */
    readonly puzzleBuildings: Building[];
    private readonly playerMap = new Map<number, Player>();
    /** recorders used, reported once to viewers in range (event sequence numbers, like kills) (M5b) */
    private readonly recorderReports: Array<{ seq: number; tick: number; event: RecorderEvent }> = [];
    /** ids each player saw in its previous snapshot */
    private readonly visible = new Map<number, Set<number>>();
    /** tick of each player's previous snapshot (bullet reports after it are new to that player) */
    private readonly lastSnapshotTick = new Map<number, number>();
    /** event sequence number each player had seen at its previous snapshot (kills, results, indicators) */
    private readonly lastEventSeq = new Map<number, number>();
    private eventSeq = 0;
    /** joins and removals, reported once to every viewer (names for the kill feed) */
    private readonly joinLog = new EventLog<PlayerInfoView>();
    private readonly leaveLog = new EventLog<number>();
    /** players that did not take a snapshot yet: their first one lists every player */
    private readonly newViewers = new Set<number>();
    private readonly activeObstacles = new Set<Obstacle>();
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
        this.fxRng = subRng(options.seed, `fx:${options.mapName}`);
        this.bullets = new BulletSystem(this);
        this.loot = new LootSystem(this.world, () => this.lootRng);
        this.projectiles = new ProjectileSystem(this);
        this.explosions = new ExplosionSystem(this);
        this.smokes = new SmokeSystem(this);
        const gasRng = subRng(options.seed, `gas:${options.mapName}`);
        this.gas = new Gas(this.mapData.width, this.mapData.height, gasRng, init.gasStages);
        this.planes = new PlaneSystem(this, options.mapName, subRng(options.seed, `planes:${options.mapName}`));
        this.unlocks = new UnlockSystem(this);
        this.gas.onCircle = (circleIdx) => {
            this.planes.scheduleCircle(circleIdx);
            this.unlocks.onCircle(circleIdx);
        };
        this.puzzleBuildings = this.world.buildings.filter((b) => b.puzzle !== undefined);
        // doors next to stairs work from both floors (survev obstacle.ts constructor checkLayer)
        for (const obj of this.world.objects.values()) {
            if (obj.kind === "obstacle" && obj.door) checkDoorLayer(this.world, obj);
        }
        this.match = new Match(this, {
            sandbox: init.sandbox ?? false,
            minPlayers: init.minPlayers ?? DEFAULT_MIN_PLAYERS,
        });
        this.spectators = new SpectateSystem(this);
        if (init.spawnLoot ?? true) spawnMapLoot(this, this.generation.lootSpawns);
    }

    get tick(): number {
        return this.tickCount;
    }

    get time(): number {
        return this.tickCount / TICK_HZ;
    }

    getPlayer(id: number): Player | undefined {
        return this.playerMap.get(id);
    }

    /** Every player in the game (alive, dead and disconnected), in join order. */
    players(): IterableIterator<Player> {
        return this.playerMap.values();
    }

    /** The match started (the gas runs). */
    get started(): boolean {
        return this.match.started;
    }

    /** A winner was decided (hosts close the game after a grace period; the simulation keeps running). */
    get over(): boolean {
        return this.match.over;
    }

    get aliveCount(): number {
        return this.match.aliveCount;
    }

    /** Whether a new player may join (join window, player limit, game over; always in a sandbox). */
    canJoin(): boolean {
        return this.match.canJoin();
    }

    /** Next event sequence number (kills, results, indicator deaths are reported once per viewer). */
    nextEventSeq(): number {
        return ++this.eventSeq;
    }

    /** Whether a player may spawn at `pos`: on grass, dry, not inside obstacles or buildings (survev canPlayerSpawn). */
    canPlayerSpawn(pos: Vec2): boolean {
        if (terrainSurfaceAt(this.world.terrain, pos) !== "grass") return false;
        if (this.world.isOnWater(pos, 0)) return false;
        // never under a falling air drop (survev map.ts getRandomSpawnPos; changelog 0.6.95)
        for (const drop of this.planes.airdrops) if (v2.distance(drop.pos, pos) < AIRDROP_SPAWN_CLEARANCE) return false;
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
            for (const p of this.playerMap.values()) {
                if (!p.dead && v2.distance(p.pos, pos) < minDist) crowded = true;
            }
            if (!crowded) return pos;
        }
        return fallback ?? { x: width / 2, y: height / 2 };
    }

    addPlayer(name: string): number {
        const player = new Player(this.world.allocId(), name, this.findSpawnPos());
        player.ctx = this;
        player.teamId = this.match.allocTeamId();
        this.playerMap.set(player.id, player);
        this.world.add(player);
        this.visible.set(player.id, new Set());
        this.lastSnapshotTick.set(player.id, this.tickCount);
        this.joinLog.push(this.nextEventSeq(), this.tickCount, playerInfo(player));
        this.lastEventSeq.set(player.id, this.eventSeq);
        this.newViewers.add(player.id);
        return player.id;
    }

    removePlayer(id: number): void {
        const player = this.playerMap.get(id);
        if (!player) return;
        this.playerMap.delete(id);
        this.visible.delete(id);
        this.lastSnapshotTick.delete(id);
        this.lastEventSeq.delete(id);
        this.newViewers.delete(id);
        this.world.remove(player);
        this.spectators.remove(id);
        this.match.onPlayerRemoved(player);
        this.leaveLog.push(this.nextEventSeq(), this.tickCount, id);
    }

    /**
     * The player's client left. A living player that joined less than `rules.minActiveTime` ago despawns; any other
     * player stays in the game, idle (survev client.ts onClose / player.ts canDespawn).
     */
    disconnectPlayer(id: number): void {
        const player = this.playerMap.get(id);
        if (!player) return;
        if (!player.dead && player.timeAlive < this.rules.minActiveTime - 1e-9) {
            this.removePlayer(id);
            return;
        }
        player.disconnected = true;
        player.receiveInput({ ...emptyInput(), toMouseDir: v2.copy(player.dir) });
        this.spectators.remove(id);
    }

    setInput(playerId: number, input: PlayerInput): void {
        const player = this.playerMap.get(playerId);
        if (player && !player.disconnected) player.receiveInput(input);
    }

    /** Spectate request of a dead player (the original Spectate message): begin, next or prev. */
    spectate(playerId: number, action: SpectateActionName): void {
        const player = this.playerMap.get(playerId);
        if (player && !player.disconnected) this.spectators.request(player, action);
    }

    /** Id of the player `playerId` spectates (0 when it does not spectate). */
    spectatingId(playerId: number): number {
        return this.spectators.targetOf(playerId);
    }

    /** Moves a player instantly, optionally to another layer (tests and debug tools). */
    teleportPlayer(id: number, pos: Vec2, layer?: number): void {
        const player = this.playerMap.get(id);
        if (!player) return;
        if (layer !== undefined) {
            player.layer = layer;
            player.aimLayer = layer;
        }
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

    onPlayerKilled(victim: Player, params: DamageParams, credit: Player | undefined): void {
        this.match.onPlayerKilled(victim, params, credit);
    }

    activateObstacle(obstacle: Obstacle): void {
        this.activeObstacles.add(obstacle);
    }

    onRecorderUsed(obstacle: Obstacle): void {
        const sound = obstacle.def.button?.sound.on ?? "";
        this.recorderReports.push({
            seq: this.nextEventSeq(),
            tick: this.tickCount,
            event: { id: obstacle.id, type: obstacle.type, sound, pos: v2.copy(obstacle.pos), layer: obstacle.layer },
        });
    }

    wakeLoot(bounds: Bounds, layer: number): void {
        this.loot.wakeAround(bounds, layer);
    }

    /**
     * Gas damage at the start of a player's tick (survev player.ts update): every damageTickRate seconds, players
     * outside the circle take the stage damage (DamageType.Gas ignores armor). timeInsideGas feeds the optional
     * escalation rule.
     */
    private applyGas(player: Player, dt: number): void {
        const gas = this.gas;
        if (!gas.isInGas(player.pos)) {
            player.timeInsideGas = 0;
            return;
        }
        if (gas.circleIdx >= this.rules.gasDamageRampFromCircle) player.timeInsideGas += dt;
        if (!gas.doDamage || !(gas.damage > 0)) return;
        const mult = this.rules.gasDamageRamp ? 1 + this.rules.gasDamageRampRate * player.timeInsideGas : 1;
        this.damagePlayer(player, { amount: gas.damage * mult, damageType: DamageType.Gas, dir: v2.copy(player.dir) });
    }

    step(): void {
        const dt = 1 / TICK_HZ;
        // reports made during this step belong to the tick it completes
        this.bullets.tick = this.tickCount + 1;
        this.explosions.tick = this.tickCount + 1;
        this.match.checkStart();
        this.gas.update();
        for (const player of this.playerMap.values()) {
            if (player.dead) continue;
            player.timeAlive += dt;
            this.applyGas(player, dt);
        }
        for (const player of this.playerMap.values()) {
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
        this.projectiles.update(dt);
        this.explosions.update(dt);
        this.smokes.update(dt);
        for (const obstacle of [...this.activeObstacles]) {
            if (!updateObstacleTimers(this, obstacle, dt)) this.activeObstacles.delete(obstacle);
        }
        for (const building of this.puzzleBuildings) updatePuzzle(this, building, dt);
        this.unlocks.update(dt);
        this.planes.update(dt);
        // a building is occupied while any living player is inside one of its ceiling zoom regions
        const occupied = new Set<Building>();
        for (const player of this.playerMap.values()) {
            if (player.dead) continue;
            for (const b of player.occupiedBuildings) occupied.add(b);
        }
        for (const b of this.occupied) if (!occupied.has(b)) b.occupied = false;
        for (const b of occupied) b.occupied = true;
        this.occupied = occupied;
        this.spectators.update(dt);
        this.tickCount++;
        this.match.endTick();
        this.joinLog.prune(this.tickCount - PLAYER_EVENT_RETENTION_TICKS);
        this.leaveLog.prune(this.tickCount - PLAYER_EVENT_RETENTION_TICKS);
        this.bullets.pruneReports(this.tickCount - BULLET_REPORT_TICKS);
        this.explosions.pruneReports(this.tickCount - BULLET_REPORT_TICKS);
        let stale = 0;
        while (
            stale < this.recorderReports.length &&
            this.recorderReports[stale].tick < this.tickCount - BULLET_REPORT_TICKS
        ) {
            stale++;
        }
        if (stale > 0) this.recorderReports.splice(0, stale);
    }

    /**
     * Whether `other` is left out of `viewer`'s snapshot because it is a player or loot on the other floor while
     * neither of them is on stairs (rules.cullOtherFloors; map objects of both floors are always sent).
     */
    private otherFloor(viewer: Player, other: { kind: string; layer: number }): boolean {
        if (!this.rules.cullOtherFloors || (other.kind !== "player" && other.kind !== "loot")) return false;
        return !floorsVisible(viewer.layer, other.layer);
    }

    /** Recorders used after event sequence number `sinceSeq` inside `view`, in order. */
    private recorderEvents(sinceSeq: number, view: Bounds): RecorderEvent[] {
        const out: RecorderEvent[] = [];
        for (const { seq, event } of this.recorderReports) {
            const p = event.pos;
            if (seq <= sinceSeq || p.x < view.min.x || p.x > view.max.x || p.y < view.min.y || p.y > view.max.y) {
                continue;
            }
            out.push({ ...event, pos: v2.copy(p) });
        }
        return out;
    }

    /**
     * Whether `other` is left out of `viewer`'s snapshot because it hides in smoke (rules.smokeHidesPlayers): its
     * centre is inside a cloud and the viewer is farther than rules.smokeRevealDistance.
     */
    hiddenInSmoke(viewer: Player, other: Player): boolean {
        if (!this.rules.smokeHidesPlayers || other === viewer || other.dead) return false;
        if (v2.distance(viewer.pos, other.pos) <= this.rules.smokeRevealDistance) return false;
        return this.smokes.contains(other.pos, other.layer);
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
        const owner = this.playerMap.get(playerId);
        if (!owner) throw new Error(`getSnapshot: unknown player ${playerId}`);
        // a spectator sees what the spectated player sees (the original activePlayerId)
        const target = this.playerMap.get(this.spectators.targetOf(playerId));
        const player = target ?? owner;
        const prev = this.visible.get(playerId) ?? new Set<number>();
        const next = new Set<number>();
        const objects: ObjectView[] = [];
        const view = viewBounds(player.pos, player.zoom);
        for (const obj of this.world.query(view, this.scratch)) {
            if (obj.kind === "player" && this.hiddenInSmoke(player, obj)) continue;
            if (obj !== player && this.otherFloor(player, obj)) continue;
            next.add(obj.id);
        }
        // the active player is always included
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
        const sinceTick = this.lastSnapshotTick.get(playerId) ?? this.tickCount;
        const bullets = this.bulletEvents(sinceTick, view);
        this.lastSnapshotTick.set(playerId, this.tickCount);
        const seq = this.lastEventSeq.get(playerId) ?? this.eventSeq;
        this.lastEventSeq.set(playerId, this.eventSeq);
        const snapshot: Snapshot = {
            tick: this.tickCount,
            time: this.time,
            localPlayerId: player.id,
            local: player.localState(),
            objects,
            deletedIds,
            bullets,
            gas: this.gas.view(),
            planes: this.planes.planeViews(view),
            airdrops: this.planes.airdropViews(view),
            mapIndicators: this.planes.indicatorViews(seq),
            kills: this.match.kills.since(seq),
            roleAnnouncements: this.match.roles.since(seq),
            aliveCount: this.match.aliveCount,
            killLeader: this.match.killLeader(),
            spectatingId: target ? target.id : 0,
            playerInfos: this.newViewers.delete(playerId)
                ? [...this.playerMap.values()].sort((a, b) => a.id - b.id).map(playerInfo)
                : this.joinLog.since(seq),
            deletedPlayerIds: this.leaveLog.since(seq),
            explosions: this.explosions.events(sinceTick, view),
            projectiles: this.projectiles.views(view),
            smokes: this.smokes.views(view),
            airstrikeZones: this.planes.zoneViews(),
            recorders: this.recorderEvents(seq, view),
        };
        const gameOver = this.match.resultSince(owner.id, seq);
        if (gameOver) snapshot.gameOver = gameOver;
        return snapshot;
    }
}
