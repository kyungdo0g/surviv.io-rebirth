// Game: fixed-step authoritative simulation implementing the GameApi contract.
// Tick order follows survev server/src/game/game.ts: start check, gas, players (gas damage, input actions, boost,
// movement, weapons), loot, bullets (then their queued damage), projectiles, explosions, smoke, dead bodies (M9),
// obstacle timers, building puzzles and scheduled unlocks (M5b), planes, air strikes and air drops, building occupancy,
// spectators, group spawns and team status (M6a), faction status and role schedules (M7a), then the match results.
import { type Bounds, type Rng, type Vec2, v2 } from "@rebirth/core";
import { DamageType, getMapDef } from "@rebirth/defs";
import { type GameApi, type GameOptions, type SpectateActionName, TICK_HZ } from "./api.ts";
import { BulletSystem } from "./combat/bullets.ts";
import { applyObstacleDamage, applyPlayerDamage } from "./combat/combat.ts";
import type { DamageParams } from "./combat/damage.ts";
import { ExplosionSystem } from "./combat/explosions.ts";
import { HitLog } from "./combat/hitLog.ts";
import { ProjectileSystem } from "./combat/projectiles.ts";
import { DEFAULT_MIN_PLAYERS, type GameInit } from "./gameInit.ts";
import { emptyInput, type PlayerInput } from "./input.ts";
import { spawnMapLoot } from "./loot/drops.ts";
import { LootSystem } from "./loot/loot.ts";
import { type GenerateMapResult, generateMap } from "./mapgen/generate.ts";
import { subRng } from "./mapgen/random.ts";
import { EmoteSystem } from "./match/emotes.ts";
import { EventLog } from "./match/events.ts";
import { FactionSystem } from "./match/faction.ts";
import { Gas } from "./match/gas.ts";
import { canDespawn, Match } from "./match/match.ts";
import type { CombatObserver } from "./match/observer.ts";
import { PlaneSystem } from "./match/planes.ts";
import { applyLoadout } from "./match/playerLoadout.ts";
import { bulletEventsIn, RecorderLog } from "./match/reports.ts";
import { canPlayerSpawn } from "./match/spawn.ts";
import { SpectateSystem } from "./match/spectate.ts";
import { TeamSystem } from "./match/teams.ts";
import { UnlockSystem } from "./match/unlocks.ts";
import { mapBagSizes } from "./modes/bagSizes.ts";
import { onClassChosen, startsWithoutClass, waitingRoom } from "./modes/classSelect.ts";
import { RoleSystem } from "./roles/roleSystem.ts";
import { defaultRules, type SimRules } from "./rules.ts";
import type {
    AddPlayerOptions,
    EmoteRequest,
    MapData,
    ObjectView,
    PlayerInfoView,
    RoleAnnouncementEvent,
    Snapshot,
} from "./view.ts";
import type { SimContext } from "./world/context.ts";
import { DeadBodySystem } from "./world/deadBodies.ts";
import { removeDisguise, updateDisguise, wearerOf } from "./world/disguise.ts";
import { checkDoorLayer } from "./world/doors.ts";
import { dropItem } from "./world/dropItem.ts";
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
/** Join / leave events (and emotes, M6a) are kept this long for viewers that skip snapshots. */
const PLAYER_EVENT_RETENTION_TICKS = 30 * TICK_HZ;
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
    return {
        playerId: p.id,
        teamId: p.teamId,
        groupId: p.groupId,
        name: p.name,
        heal: p.loadoutHeal,
        boost: p.loadoutBoost,
    };
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
    /** projectiles, explosions and smoke (M5); replaceable by tests */
    fxRng: Rng;
    /** role kits, promotion picks and perk rolls (M7a) */
    roleRng: Rng;
    readonly bullets: BulletSystem;
    readonly loot: LootSystem;
    /** thrown grenades, potato gun shots, air strike bombs (M5) */
    readonly projectiles: ProjectileSystem;
    /** explosions, resolved once per tick (M5) */
    readonly explosions: ExplosionSystem;
    /** smoke emitters and clouds (M5) */
    readonly smokes: SmokeSystem;
    /** where players died (M9) */
    readonly deadBodies: DeadBodySystem;
    /** red zone (M4) */
    readonly gas: Gas;
    /** match lifecycle: start, alive count, kills, kill leader, game over (M4) */
    readonly match: Match;
    /** planes, falling air drops and minimap indicators (M4) */
    readonly planes: PlaneSystem;
    readonly spectators: SpectateSystem;
    /** groups: solo one per player, duo / squad parties and auto fill (M6a) */
    readonly teams: TeamSystem;
    /** emotes and pings (M6a) */
    readonly emotes: EmoteSystem;
    /** 50v50: the Red / Blue factions above the groups, null on other maps (M7a) */
    readonly faction: FactionSystem | null;
    /** roles: 50v50 promotions, Lone Survivr, The Hunted, Woods King, Cobalt classes, indicators (M7a) */
    readonly roles: RoleSystem;
    /** scheduled door unlocks of MapDef gameConfig.unlocks (M5b) */
    readonly unlocks: UnlockSystem;
    /** buildings with a puzzle, updated every tick (M5b) */
    readonly puzzleBuildings: Building[];
    /** read-only combat notifications for the host (server anti-cheat telemetry, M8); never alters the game */
    observer: CombatObserver | null = null;
    /** damaging player hits for the dealer's and the target's snapshots (rebirth hit feedback) */
    readonly hitLog = new HitLog();
    private readonly playerMap = new Map<number, Player>();
    /** recorders used, reported once to viewers in range (event sequence numbers, like kills) (M5b) */
    private readonly recorderReports = new RecorderLog();
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
    /** Cobalt players waiting in the Twins bunker for their class (M7b) */
    private readonly waitingPlayers = new Set<number>();
    private tickCount = 0;
    private readonly scratch: Entity[] = [];

    constructor(options: GameOptions, init: GameInit = {}) {
        this.options = { ...options };
        const mode = getMapDef(options.mapName).gameMode;
        // 50v50 always plays in squads inside the factions (the original 50v50 squad queue, survev config)
        if (mode.factionMode) this.options.teamMode = 4;
        this.generation = init.generation ?? generateMap(options.mapName, options.seed, options.teamMode ?? 1);
        this.mapData = this.generation.mapData;
        this.world = new World(this.generation);
        this.rng = subRng(options.seed, `game:${options.mapName}`);
        this.combatRng = subRng(options.seed, `combat:${options.mapName}`);
        this.lootRng = subRng(options.seed, `loot:${options.mapName}`);
        this.fxRng = subRng(options.seed, `fx:${options.mapName}`);
        this.roleRng = subRng(options.seed, `roles:${options.mapName}`);
        this.bullets = new BulletSystem(this);
        this.loot = new LootSystem(this.world, () => this.lootRng);
        this.projectiles = new ProjectileSystem(this);
        this.explosions = new ExplosionSystem(this);
        this.smokes = new SmokeSystem(this);
        this.deadBodies = new DeadBodySystem(this.world);
        const gasRng = subRng(options.seed, `gas:${options.mapName}`);
        this.gas = new Gas(this.mapData.width, this.mapData.height, gasRng, init.gasStages);
        this.planes = new PlaneSystem(this, options.mapName, options.seed);
        this.unlocks = new UnlockSystem(this);
        this.gas.onCircle = (circleIdx) => {
            this.planes.scheduleCircle(circleIdx);
            this.unlocks.onCircle(circleIdx);
            this.roles.onCircle(circleIdx);
            this.faction?.onCircle(circleIdx);
        };
        this.puzzleBuildings = this.world.buildings.filter((b) => b.puzzle !== undefined);
        this.teams = new TeamSystem(this, this.options.teamMode ?? 1);
        this.faction = mode.factionMode
            ? new FactionSystem(this, mode.factions ?? 2, this.generation.factionSplitOri)
            : null;
        this.teams.faction = this.faction;
        this.roles = new RoleSystem(this);
        this.roles.faction = this.faction;
        this.emotes = new EmoteSystem(this);
        // doors next to stairs work from both floors (survev obstacle.ts constructor checkLayer)
        for (const obj of this.world.objects.values()) {
            if (obj.kind === "obstacle" && obj.door) checkDoorLayer(this.world, obj);
        }
        this.match = new Match(this, {
            sandbox: init.sandbox ?? false,
            minPlayers: init.minPlayers ?? DEFAULT_MIN_PLAYERS,
        });
        this.spectators = new SpectateSystem(this);
        this.rules.gunBeta = init.gunBeta ?? false;
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

    /** Whether a player may spawn at `pos`: dry, not inside obstacles or buildings (survev canPlayerSpawn). */
    canPlayerSpawn(pos: Vec2): boolean {
        return canPlayerSpawn(this, pos);
    }

    /** 1 solo, 2 duo, 4 squad (M6a) */
    get teamMode(): number {
        return this.teams.teamMode;
    }

    /**
     * Adds a player: solo players get their own group and a random spawn point; in team modes `opts` (party key, auto
     * fill) picks the group and teammates spawn next to the group's spawn position (M6a).
     */
    addPlayer(name: string, opts: AddPlayerOptions = {}): number {
        const id = this.world.allocId();
        const group = this.teams.assign(opts);
        // Cobalt: players choosing a class wait at the Twins bunker (M7b, modes/classSelect.ts)
        const room = waitingRoom(this);
        const player = new Player(id, name, room ? room.pos : this.teams.spawnPos(group, this.rng), opts.isMobile);
        if (room) {
            player.layer = room.layer;
            player.aimLayer = room.layer;
            this.waitingPlayers.add(id);
        }
        player.awaitingClass = startsWithoutClass(this.options.mapName);
        player.ctx = this;
        player.inv.sizes = mapBagSizes(this.options.mapName);
        this.teams.add(player, group, !room);
        applyLoadout(this, player, opts.loadout);
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
        this.waitingPlayers.delete(id);
        this.visible.delete(id);
        this.lastSnapshotTick.delete(id);
        this.lastEventSeq.delete(id);
        this.newViewers.delete(id);
        this.world.remove(player);
        removeDisguise(this, player);
        this.spectators.remove(id);
        // a revive in progress ends with the player
        player.cancelAction();
        this.teams.remove(player);
        this.match.onPlayerRemoved(player);
        this.leaveLog.push(this.nextEventSeq(), this.tickCount, id);
    }

    /**
     * The player's client left. A living, standing player that joined less than `rules.minActiveTime` ago despawns, but
     * a 50v50 role holder; any other player stays in the game, idle (survev client.ts onClose / player.ts canDespawn).
     */
    disconnectPlayer(id: number): void {
        const player = this.playerMap.get(id);
        if (!player) return;
        if (canDespawn(player, !!getMapDef(this.options.mapName).gameMode.factionMode, this.rules.minActiveTime)) {
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

    onLethalDamage(target: Player, params: DamageParams): void {
        this.teams.handlePlayerDeath(this, target, params);
    }

    onPlayerDowned(victim: Player, params: DamageParams, source: Player | undefined): void {
        this.match.onPlayerDowned(victim, params, source);
    }

    addEmote(player: Player, type: string, itemType = ""): void {
        this.emotes.add(player, type, itemType);
    }

    /** An emote or ping request of a player (the original Emote message; throttled, M6a). */
    emote(playerId: number, request: EmoteRequest): void {
        const player = this.playerMap.get(playerId);
        if (player && !player.disconnected) this.emotes.request(player, request);
    }

    activateObstacle(obstacle: Obstacle): void {
        this.activeObstacles.add(obstacle);
    }

    announceRole(event: RoleAnnouncementEvent): void {
        this.match.announce(event);
    }

    /** Cobalt class choice of a player (the original PerkModeRoleSelect message; M7a). Returns whether it was taken. */
    selectRole(playerId: number, role: string): boolean {
        const player = this.playerMap.get(playerId);
        return !!player && !player.disconnected && this.roles.selectClass(player, role);
    }

    /** A Cobalt class was assigned (chosen or after the timeout): leave the waiting room (M7b). */
    onClassChosen(player: Player): void {
        onClassChosen(this, player, this.waitingPlayers.delete(player.id), this.rng);
    }

    /** The drop-item action (the original DropItem message; M7b): armour, a gun, the melee, the loot perk, bag items. */
    dropItem(playerId: number, item: string, weapIdx = 0): void {
        const player = this.playerMap.get(playerId);
        if (player && !player.disconnected) dropItem(this, player, item, weapIdx);
    }

    onRecorderUsed(obstacle: Obstacle): void {
        const sound = obstacle.def.button?.sound.on ?? "";
        this.recorderReports.push(this.nextEventSeq(), this.tickCount, {
            id: obstacle.id,
            type: obstacle.type,
            sound,
            pos: v2.copy(obstacle.pos),
            layer: obstacle.layer,
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
        this.hitLog.tick = this.tickCount + 1;
        this.match.checkStart();
        this.gas.update();
        for (const player of this.playerMap.values()) {
            if (player.dead) continue;
            player.timeAlive += dt;
            this.applyGas(player, dt);
        }
        for (const player of this.playerMap.values()) {
            player.update(this, dt);
            updateDisguise(this, player);
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
        this.deadBodies.update(dt);
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
        this.teams.update(dt);
        this.faction?.update(dt);
        this.roles.update(dt);
        this.tickCount++;
        // hits dealt between steps (tools, tests) belong to the next tick, so the next snapshot lists them
        this.hitLog.tick = this.tickCount + 1;
        this.match.endTick();
        this.joinLog.prune(this.tickCount - PLAYER_EVENT_RETENTION_TICKS);
        this.leaveLog.prune(this.tickCount - PLAYER_EVENT_RETENTION_TICKS);
        this.emotes.updateSlotEmotes(dt, this.playerMap.values(), this.match.over);
        this.emotes.prune(this.tickCount - PLAYER_EVENT_RETENTION_TICKS);
        this.bullets.pruneReports(this.tickCount - BULLET_REPORT_TICKS);
        this.explosions.pruneReports(this.tickCount - BULLET_REPORT_TICKS);
        this.hitLog.prune(this.tickCount - BULLET_REPORT_TICKS);
        this.recorderReports.prune(this.tickCount - BULLET_REPORT_TICKS);
    }

    /**
     * Whether `other` is left out of `viewer`'s snapshot because it is a player or loot on the other floor while
     * neither of them is on stairs (rules.cullOtherFloors; map objects of both floors are always sent).
     */
    private otherFloor(viewer: Player, other: { kind: string; layer: number }): boolean {
        if (!this.rules.cullOtherFloors || (other.kind !== "player" && other.kind !== "loot")) return false;
        return !floorsVisible(viewer.layer, other.layer);
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
            const subject = wearerOf(this, obj) ?? obj;
            if (subject.kind === "player" && this.hiddenInSmoke(player, subject)) continue;
            if (subject !== player && this.otherFloor(player, subject)) continue;
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
        const bullets = bulletEventsIn(this.bullets.reports, sinceTick, view);
        this.lastSnapshotTick.set(playerId, this.tickCount);
        const seq = this.lastEventSeq.get(playerId) ?? this.eventSeq;
        this.lastEventSeq.set(playerId, this.eventSeq);
        const local = player.localState();
        const team = this.teams.teamView(player);
        if (team) local.team = team;
        const snapshot: Snapshot = {
            tick: this.tickCount,
            time: this.time,
            localPlayerId: player.id,
            local,
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
            recorders: this.recorderReports.eventsIn(seq, view),
            emotes: this.emotes.eventsFor(player, next, seq),
        };
        if (this.faction) {
            snapshot.teamAliveCounts = this.faction.aliveCounts();
            snapshot.factionStatus = this.faction.statusView(player);
        }
        const gameOver = this.match.resultSince(owner.id, seq);
        if (gameOver) snapshot.gameOver = gameOver;
        const hits = this.hitLog.eventsFor(player.id, sinceTick, this.tickCount, next);
        if (hits.length) snapshot.hits = hits;
        const stats = this.match.statsSince(owner.id, seq);
        if (stats) snapshot.playerStats = stats;
        return snapshot;
    }
}
