// Contract between the simulation and its consumers (client renderer, network encoder, bots, tests).
// The client only ever sees these view types: the loopback transport hands them over directly (M1) and the
// network protocol encodes/decodes exactly these shapes later (M3). Keep them plain, serializable data.
//
// M2 additions (all backward compatible: new fields are optional in the types so hand-written views, e.g. the
// client's dev fixtures, stay valid; the simulation always fills every one of them):
// - PlayerView: `anim`, `action`, `shot`, `wearingPan`.
// - LocalPlayerState: `scope`, `outfit`, `helmet`, `chest`, `backpack`, `action`, `cooldowns`, `kills`, `dead`,
//   `killedBy`. `weapons` now carries the real per-slot ammo and `inventory` the real item counts.
// - Snapshot: `bullets` (BulletEvent list: bullets fired near the viewer since its previous snapshot).
// - New types: PlayerAnim, PlayerAction, PlayerShot, BulletEvent, AnimType, ActionType.
//
// M4 additions (battle-royale loop; backward compatible in the same way: optional in the types, always filled by
// the simulation; the network decoder fills them too):
// - Snapshot: `gas` (GasView), `planes` (PlaneView list, planes in view), `airdrops` (AirdropView list, falling
//   crates in view), `mapIndicators` (MapIndicatorView list, minimap markers), `kills` (KillEvent list: every
//   kill in the game since the viewer's previous snapshot), `roleAnnouncements` (kill leader promoted / killed),
//   `aliveCount`, `killLeader` ({id, kills}, id 0 = none), `gameOver` (GameOverEvent, present once, in the
//   snapshot right after the viewer died or the match ended), `playerStats` (team modes only, M6),
//   `spectatingId` (0, or the id of the player being spectated), `playerInfos` (names and teams of the players
//   that joined since the viewer's previous snapshot; every player in its first snapshot) and `deletedPlayerIds`
//   (players removed from the game since then).
// - Spectating (the original activePlayerId): while a dead player spectates, its snapshots follow the spectated
//   player: `localPlayerId` is the spectated player's id, `local` its state and `objects` are culled around it.
//   `spectatingId` equals `localPlayerId` then; the client's own id is the one it got on join.
// - LocalPlayerState: `stats` (match stats so far, integers), `spectatorCount`.
// - ObstacleView: `button` (interactable obstacles: air drop crates, switches).
// - New types: GasView, GasModeName, PlaneView, PlaneType, AirdropView, MapIndicatorView, KillEvent,
//   DamageSource, RoleAnnouncementEvent, KillLeaderView, GameOverEvent, PlayerStatsView, MatchStats,
//   PlayerInfoView.
// Helpers living next to the contract: `gasCircle(gas)` (current red-zone circle) and `gasTimeLeft(gas)` in
// match/gas.ts, `damageSourceOf()` in match/events.ts.
// Match lifecycle knobs are construction options (GameInit in game.ts): the client's loopback passes
// `{ sandbox: true }` (the match starts on the first step with a single player, never ends and always accepts
// joins); servers pass `minPlayers`. Until the match starts `gas.mode` is "inactive" ("Waiting for players").
// Dead players spectate through `Game.spectate(id, "begin" | "next" | "prev")` (the Spectate message).
import type { Vec2 } from "@rebirth/core";

export interface RiverData {
    width: number;
    looped: boolean;
    points: Vec2[];
}

export interface PlaceData {
    name: string;
    pos: Vec2;
}

export interface GroundPatchData {
    min: Vec2;
    max: Vec2;
    color: number;
    roughness: number;
    offsetDist: number;
    order: number;
    useAsMapShape: boolean;
}

/** One map object as created at map generation (obstacles, buildings, structures, decals). */
export interface MapObjectSpawn {
    id: number;
    /** MapObjectDefs id */
    type: string;
    pos: Vec2;
    /** 0..3, rotation in 90° steps (counter-clockwise) */
    ori: number;
    scale: number;
    layer: number;
}

/** Everything needed to rebuild the static world; sent once on join (the original MapMsg). */
export interface MapData {
    /** MapDefs key, e.g. "main" */
    mapName: string;
    seed: number;
    width: number;
    height: number;
    shoreInset: number;
    grassInset: number;
    rivers: RiverData[];
    places: PlaceData[];
    groundPatches: GroundPatchData[];
    objects: MapObjectSpawn[];
}

export type ObjectKind = "player" | "obstacle" | "building" | "structure" | "decal" | "loot";

interface BaseView {
    id: number;
    kind: ObjectKind;
    /** def id (MapObjectDefs for map objects, GameObjectDefs for loot, "player" for players) */
    type: string;
    pos: Vec2;
    layer: number;
}

export interface PlayerView extends BaseView {
    kind: "player";
    /** unit facing direction */
    dir: Vec2;
    dead: boolean;
    downed: boolean;
    /** GameObjectDefs ids; "" when empty */
    activeWeapon: string;
    outfit: string;
    helmet: string;
    chest: string;
    backpack: string;
    /** world units; 1 = default body size */
    scale: number;
    /** current animation; `seq` increments every time an animation starts or is cancelled (M2) */
    anim?: PlayerAnim;
    /** current timed action (reload, item use); `seq` increments on every start and cancel (M2) */
    action?: PlayerAction;
    /** last gun shot, for muzzle flashes and recoil; `seq` increments on every trigger pull that fired (M2) */
    shot?: PlayerShot;
    /** a pan in the melee slot is worn on the back while another slot is selected (it reflects bullets) (M2) */
    wearingPan?: boolean;
}

export type AnimType = "none" | "melee" | "cook" | "throw";

export interface PlayerAnim {
    type: AnimType;
    seq: number;
}

export type ActionType = "none" | "reload" | "use";

export interface PlayerAction {
    type: ActionType;
    seq: number;
    /** GameObjectDefs id of the reloaded gun or used item; "" for none */
    item: string;
    /** total duration in seconds (0 for none) */
    duration: number;
}

export interface PlayerShot {
    seq: number;
    /** dual guns alternate barrels: true when the last shot came from the off hand (left, +dualOffset) */
    offHand: boolean;
}

export interface ObstacleView extends BaseView {
    kind: "obstacle";
    ori: number;
    /** current scale (obstacles shrink as they take damage) */
    scale: number;
    /** health / maxHealth in 0..1 */
    healthT: number;
    dead: boolean;
    door?: { open: boolean; locked: boolean; canUse: boolean };
    /**
     * Interactable obstacle (def `button`: air drop crates, switches) (M4). `onOff` flips and `seq` increments on
     * every use; `canUse` is false while it cannot be used (used once, cooling down). An air drop crate that was
     * used plays its opening for `button.useDelay` seconds, then dies and its `destroyType` crate appears.
     */
    button?: { onOff: boolean; canUse: boolean; seq: number };
}

export interface BuildingView extends BaseView {
    kind: "building";
    ori: number;
    /** true while any player is inside a ceiling zoom region (the roof fades) */
    occupied: boolean;
    ceilingDead: boolean;
    ceilingDamaged: boolean;
}

export interface StructureView extends BaseView {
    kind: "structure";
    ori: number;
}

export interface DecalView extends BaseView {
    kind: "decal";
    ori: number;
    scale: number;
}

export interface LootView extends BaseView {
    kind: "loot";
    count: number;
}

export type ObjectView = PlayerView | ObstacleView | BuildingView | StructureView | DecalView | LootView;

/** State only the owning player sees. */
export interface LocalPlayerState {
    health: number;
    boost: number;
    /** camera zoom radius in world units (scope dependent) */
    zoom: number;
    /** layer the camera renders (0 ground, 1 underground, 2/3 stairs) */
    layer: number;
    /** the four weapon slots (primary, secondary, melee, throwable); ammo is the loaded magazine */
    weapons: Array<{ type: string; ammo: number }>;
    curWeapIdx: number;
    /** item counts for every bag item (ammo, heals, boosts, throwables, scopes) */
    inventory: Record<string, number>;
    /** equipped scope id, e.g. "1xscope" (M2) */
    scope?: string;
    /** worn gear ids; "" when empty (M2) */
    outfit?: string;
    helmet?: string;
    chest?: string;
    backpack?: string;
    /** running timed action with its progress, for the reload/use bar (M2) */
    action?: { type: ActionType; item: string; time: number; duration: number };
    /** seconds until each weapon slot can fire/attack again (0 = ready) and until the next free switch (M2) */
    cooldowns?: { weapons: number[]; freeSwitch: number };
    kills?: number;
    dead?: boolean;
    /** id of the player credited with the kill, 0 when alive or killed by the environment */
    killedBy?: number;
    /** match stats so far (M4) */
    stats?: MatchStats;
    /** number of players spectating this player (M4) */
    spectatorCount?: number;
}

/** Match stats of one player, as shown on the death and win screens. Integers (damage rounded, whole seconds). */
export interface MatchStats {
    kills: number;
    damageDealt: number;
    damageTaken: number;
    /** seconds alive */
    timeAlive: number;
}

/**
 * A bullet fired near the viewer since its previous snapshot (the original UpdateMsg bullet records). The client
 * draws the tracer from `pos` along `dir` for at most `maxDist` units at the bullet def's speed.
 * A bullet is reported once when fired; when it hits a player after that report it is reported once more with the
 * same `id`, `hitPlayer` true and `endDist` set, so the client can stop the tracer there.
 */
export interface BulletEvent {
    /** bullet id, unique within a game (not an object id) */
    id: number;
    /** player who fired it (0 for none) */
    shooterId: number;
    /** GameObjectDefs bullet id */
    bulletType: string;
    /** weapon that fired it (GameObjectDefs id) */
    sourceType: string;
    /** start position */
    pos: Vec2;
    /** unit direction */
    dir: Vec2;
    layer: number;
    /** travel distance the client draws: the bullet's range cut at the first indestructible obstacle on its path */
    maxDist: number;
    /** 0 for a fired bullet, n for the n-th ricochet */
    reflectCount: number;
    /** whether the bullet hit a player (known when the bullet already stopped at report time) */
    hitPlayer: boolean;
    /** distance travelled when the bullet stopped; absent while it is still flying */
    endDist?: number;
    /** first bullet of a shot (muzzle flash, shot sound); false for extra pellets and ricochets */
    shotFx: boolean;
    /** dual guns: fired from the off hand */
    offHand: boolean;
}

/** One simulation snapshot as seen by one player (the original UpdateMsg, decoded). */
export interface Snapshot {
    tick: number;
    /** simulation time in seconds */
    time: number;
    localPlayerId: number;
    local: LocalPlayerState;
    /** full state of every object in the player's view this snapshot */
    objects: ObjectView[];
    /** ids that left the view or were destroyed since the previous snapshot */
    deletedIds: number[];
    /** bullets fired near the viewer since its previous snapshot (M2) */
    bullets?: BulletEvent[];
    /** red zone (M4) */
    gas?: GasView;
    /** air drop / air strike planes whose body (radius `planeRad`) touches the view (M4) */
    planes?: PlaneView[];
    /** falling air drop crates in view, kept 1 s after landing (M4) */
    airdrops?: AirdropView[];
    /**
     * Minimap markers, sent to everyone (M4). Live markers, plus the ones removed since the viewer's previous
     * snapshot with `dead` true (once); drop a marker when it arrives dead.
     */
    mapIndicators?: MapIndicatorView[];
    /** every kill in the game since the viewer's previous snapshot, in order (M4; the original Kill messages) */
    kills?: KillEvent[];
    /** role events since the viewer's previous snapshot (M4: kill leader promoted / killed) */
    roleAnnouncements?: RoleAnnouncementEvent[];
    /** living players (M4) */
    aliveCount?: number;
    /** current kill leader; id 0 while nobody has GameConfig.player.killLeaderMinKills kills (M4) */
    killLeader?: KillLeaderView;
    /** the viewer's result, present in exactly one snapshot: after it died, or when it won (M4) */
    gameOver?: GameOverEvent;
    /** team modes: stats of the viewer after it died while its team plays on, present once (M6; never in solo) */
    playerStats?: PlayerStatsView;
    /** id of the player being spectated (= localPlayerId while spectating), 0 when not spectating (M4) */
    spectatingId?: number;
    /**
     * Players that joined since the viewer's previous snapshot; every player of the game in the viewer's first
     * snapshot (M4; the original PlayerInfos). Keep them: kill feed, kill leader and result screens need the names.
     */
    playerInfos?: PlayerInfoView[];
    /** players removed from the game since the viewer's previous snapshot (M4; the original DeletePlayerIds) */
    deletedPlayerIds?: number[];
}

/** Public info of a player (the original PlayerInfos record, without the heal/boost cosmetics). */
export interface PlayerInfoView {
    playerId: number;
    /** team (solo: one per player; matches GameOverEvent.teamId / winningTeamId) */
    teamId: number;
    /** group (solo: the team id) */
    groupId: number;
    /** at most 16 UTF-8 bytes on the wire */
    name: string;
}

export type GasModeName = "inactive" | "waiting" | "moving";

/**
 * Red zone state (the original gas section plus its progress `gasT`). Before the match starts the gas is
 * "inactive" (the client shows "Waiting for players"). Each circle has a "waiting" stage (the next safe circle
 * `posNew`/`radNew` is shown, the zone does not move) and a "moving" stage (the zone closes linearly from
 * `posOld`/`radOld` to `posNew`/`radNew` over `duration`). The current circle is `gasCircle(gas)`.
 */
export interface GasView {
    mode: GasModeName;
    /** index into GameConfig.gas.stages; stages.length once the last stage has ended (the zone stays closed) */
    stage: number;
    /** -1 before the first circle; incremented when each waiting stage starts */
    circleIdx: number;
    /** duration of the current stage in seconds */
    duration: number;
    /** progress through the current stage, 0..1 (time left = duration * (1 - gasT)) */
    gasT: number;
    posOld: Vec2;
    posNew: Vec2;
    radOld: number;
    radNew: number;
    /** damage dealt every GameConfig.gas.damageTickRate seconds to players outside the circle (ignores armor) */
    damage: number;
}

export type PlaneType = "airdrop" | "airstrike";

export interface PlaneView {
    /** plane id (1..255, not an object id) */
    id: number;
    pos: Vec2;
    /** unit flight direction */
    dir: Vec2;
    planeType: PlaneType;
    /** the plane released its crate (air drop) or bombs (air strike) */
    actionComplete: boolean;
}

/** A falling air drop crate (the original Airdrop object). When it lands, the crate obstacle appears. */
export interface AirdropView {
    /** object id (unique among objects) */
    id: number;
    pos: Vec2;
    /** fall progress 0..1 over GameConfig.airdrop.fallTime */
    fallT: number;
    landed: boolean;
}

export interface MapIndicatorView {
    /** indicator id 0..15 (reused after the indicator died) */
    id: number;
    /** GameObjectDefs id, e.g. "ping_airdrop" (drawn with its `mapTexture`) */
    type: string;
    pos: Vec2;
    /** the indicator was removed: the client drops it */
    dead: boolean;
    equipped: boolean;
}

/** How a player died, derived from the damage type and the source defs (kill feed wording). */
export type DamageSource = "gun" | "melee" | "explosion" | "gas" | "bleed" | "airdrop" | "airstrike" | "other";

/** One kill (the original Kill message). */
export interface KillEvent {
    /** the player who died (or was downed, M6) */
    targetId: number;
    /** player whose hit caused it; 0 for the environment (gas, air drop) and for bleeding */
    killerId: number;
    /** player credited with the kill (0 for none; the victim itself for a suicide) */
    killCreditId: number;
    /** kill count of the credited player after this kill */
    killerKills: number;
    /** defs DamageType (Player 0, Bleeding 1, Gas 2, Airdrop 3, Airstrike 4) */
    damageType: number;
    source: DamageSource;
    /** GameObjectDefs id of the weapon, "" for none */
    itemSourceType: string;
    /** MapObjectDefs id of the obstacle that dealt it (exploding barrel), "" for none */
    mapSourceType: string;
    /** knocked down, not killed (team modes, M6: always false for now) */
    downed: boolean;
    killed: boolean;
}

/** A role event (the original RoleAnnouncement message): "promoted to Kill Leader!" / "killed Kill Leader!". */
export interface RoleAnnouncementEvent {
    playerId: number;
    /** who killed the role holder (0 when not killed) */
    killerId: number;
    /** GameObjectDefs role id, e.g. "kill_leader" */
    role: string;
    assigned: boolean;
    killed: boolean;
}

export interface KillLeaderView {
    /** 0 for none */
    id: number;
    kills: number;
}

/** End-of-life stats of one player (the original PlayerStats record; integers). */
export interface PlayerStatsView {
    playerId: number;
    /** whole seconds alive */
    timeAlive: number;
    kills: number;
    dead: boolean;
    damageDealt: number;
    damageTaken: number;
}

/** The viewer's match result (the original GameOver message). */
export interface GameOverEvent {
    /** the viewer's team (solo: a per-player id) */
    teamId: number;
    /** final rank of the viewer's team: 1 for the winner, else living teams + 1 when it was eliminated */
    teamRank: number;
    /** the match is over (a winner exists) */
    gameOver: boolean;
    /** team id of the winner, 0 while the match goes on */
    winningTeamId: number;
    /** stats of the viewer's team members (solo: the viewer) */
    playerStats: PlayerStatsView[];
}

/** Terrain polygons derived deterministically from MapData by `buildTerrain(map)` (client and server share it). */
export interface TerrainShape {
    /** island outline: water outside, beach inside */
    shore: Vec2[];
    /** grass outline (inset of the shore): beach between shore and grass */
    grass: Vec2[];
    rivers: Array<{
        width: number;
        looped: boolean;
        /** center spline sampled as points */
        center: Vec2[];
        /** water polygon */
        waterPoly: Vec2[];
        /** riverbank polygon (water widened by the bank width) */
        shorePoly: Vec2[];
    }>;
}
