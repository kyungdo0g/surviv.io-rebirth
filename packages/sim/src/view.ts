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
//
// M5a additions (throwables, explosions, smoke, heals and boosts, air strikes; backward compatible in the same way:
// optional in the types, always filled by the simulation and by the network decoder):
// - Snapshot: `explosions` (ExplosionEvent list: explosions in view since the viewer's previous snapshot, the
//   original UpdateMsg explosions), `projectiles` (ProjectileView list: thrown grenades, potato gun shots and air
//   strike bombs in view, the original Projectile objects), `smokes` (SmokeView list: smoke clouds in view, the
//   original Smoke objects) and `airstrikeZones` (AirstrikeZoneView list: every live 50v50 air strike zone, drawn
//   on the map). Projectiles and smokes are snapshot lists rather than new ObjectView kinds, so consumers' switches
//   over ObjectKind stay exhaustive; their ids are their own id spaces (not object ids).
// - PlayerInput: `useItem` (optional GameObjectDefs id of a bag item to use: heal, boost, scope or throwable; the
//   original InputMsg.useItem). The actions Input.UseBandage / UseHealthKit / UseSoda / UsePainkiller do the same
//   for their item, Input.EquipFragGrenade / EquipSmokeGrenade select that throwable.
// - Existing fields gain M5 values: PlayerView.anim "cook" / "throw" while a throwable is cooked and thrown;
//   PlayerView.action and LocalPlayerState.action "use" with the heal/boost item while one is used;
//   LocalPlayerState.boost decays and heals; LocalPlayerState.zoom is the 1x radius while the player is in smoke
//   (and 0.5 s after leaving it); MapIndicatorView "ping_airstrike" marks strobe and scheduled air strikes;
//   PlaneView "airstrike" planes; explosion scorch marks are DecalView objects (some fade after their def
//   lifetime); KillEvent / DamageSource "explosion" and "airstrike".
// - Smoke hides players: with `rules.smokeHidesPlayers` (default on) a player whose centre is inside a smoke cloud
//   is left out of other players' snapshots unless the viewer is within `rules.smokeRevealDistance` (rebirth rule:
//   the original client only draws the smoke above them). Bullets they fire are still reported.
//
// M5b additions (buildings: doors, ceilings, layers and stairs, puzzles, unlocks, obstacle behaviours; backward
// compatible in the same way: optional in the types, always filled by the simulation and by the network decoder):
// - Doors move: when a door opens, a hinged door's `ori` turns a quarter away from the opener around its hinge
//   (`pos` is the hinge and stays), a sliding door's `pos` moves by its def `slideOffset` along its local y axis;
//   closing restores both. The collider changes instantly (survev); clients animate towards the new pos/ori at the
//   def's `door.openSpeed`. ObstacleView `layer` may become 2/3 for doors next to stairs (usable from both floors).
// - ObstacleView.door: `seq` (increments when an interaction starts: play the def's `door.sound.change`, e.g. a vault
//   door's delayed opening). `locked` turns false when a scheduled unlock opens the door.
// - BuildingView: `puzzle` ({solved, errSeq}: on an `errSeq` change play the def's `puzzle.sound.fail` near the
//   pieces, once `solved` play `puzzle.sound.complete`), `occupiedDisabled` (a `disableBuildingOccupied` obstacle,
//   the stove, died: the occupied emitters such as chimney smoke stop for good). `ceilingDead` (the def's
//   `ceiling.destroy.wallCount` walls broke: play the collapse particles/sound and show the residue) and
//   `ceilingDamaged` (a `damageCeiling` obstacle died) are now driven by the simulation.
// - StructureView: `interiorSoundAlt` (a solved puzzle named by the def's `interiorSound.puzzle` switched the interior
//   music to `soundAlt`, e.g. the club after the bathhouse switch, the saloon piano stopping).
// - PlayerView: `healEffect` (standing in a building heal region, e.g. the bathhouse steam room: heal particles).
// - DecalView: `goreKills` (players killed in the building's gore region: the club pool turns red along the def's
//   `gore.fade`).
// - Layers: players walk between layer 0 (ground) and 1 (underground) over structure stairs, through the "on stairs"
//   layers 2 (upper half) and 3 (lower half); PlayerView.layer, LocalPlayerState.layer, projectiles and loot carry
//   them. Snapshots leave out players and loot on the other floor while neither the viewer nor the object is on
//   stairs (`rules.cullOtherFloors`, rebirth rule: the original client never draws the other floor, so this only
//   hides what a modified client could reveal). Map objects of both floors are always sent.
// - Snapshot: `recorders` (RecorderEvent list: recorders used in view since the viewer's previous snapshot; play the
//   recording `sound`). Scheduled unlocks (MapDef gameConfig.unlocks, e.g. the Cobalt twins bunker) open their doors
//   and add a "ping_unlock" MapIndicatorView at each door.
//
// M6a additions (teams, downed and revive, emotes and pings; backward compatible in the same way: optional in the types,
// always filled by the simulation in the modes they apply to, and by the network decoder):
// - Teams (GameOptions.teamMode 2 duo / 4 squad): players are grouped (PlayerInfoView.groupId is the real group, teamId
//   equals it; solo keeps one group per player). Teammates spawn within GameConfig.player.teammateSpawnRadius of the
//   group's spawn point, cannot hurt each other (unless the target is disconnected; self damage stays), and do not
//   collide (players never collide). The match ends when one group has living (downed included) players left;
//   GameOverEvent.teamId / winningTeamId are group ids, teamRank ranks groups and playerStats lists every member of
//   the viewer's group. A player who dies while its group plays on gets `playerStats` once; every member gets
//   `gameOver` once, when its group is eliminated or wins. `aliveCount` stays the number of living players.
// - Downed: in team modes lethal damage knocks the player down (PlayerView.downed; draw the crawl pose) unless no
//   teammate is left standing, in which case it dies and every downed teammate dies with it (team wipe). A downed
//   player bleeds, crawls slowly, has no weapon use (forced to the melee slot, a pan is worn on the back) and its
//   camera is forced to 1x. KillEvent `downed` true / `killed` false reports a knock (killerId = killCreditId = the
//   knocker); finishing a downed player credits the knocker for bleed-outs, environment kills and kills by its
//   team (KillEvent killerId 0 for bleed-outs: "finally bled out" / "finally killed").
// - Revive: Input.Interact (or Input.Revive) within 5 units of a downed teammate starts an 8 s revive (the client's
//   "Revive Teammate" prompt: own action "none", teammate downed and not already in a "revive" action, same layer):
//   the reviver's PlayerView.anim is "revive" and both players' action type is "revive";
//   LocalPlayerState.action.targetId is the revived player for the reviver (its own id for a Revivify self revive)
//   and 0 for the downed side. It ends when the two are more than 5 units apart, when either side cancels its action
//   (Input.Cancel, shooting, switching weapons, being knocked) or when the target dies; damage alone does not. The
//   revived player stands up with 24 HP. Revivify (self_revive) lets a downed holder revive itself the same way.
// - LocalPlayerState: `team` (TeamMemberView list, team modes only; never in solo), `action.targetId`.
// - Snapshot: `emotes` (EmoteEvent list since the viewer's previous snapshot: emotes of players in view, team-only
//   emotes and pings of the viewer's group). Clients send EmoteRequests (Game.emote / the Emote message); the server
//   throttles them like the original (6 in a row block emotes for 9 s, the counter decays by 1 every 3 s).
// - New types: TeamMemberView, EmoteEvent, EmoteRequest, AddPlayerOptions (viewTeams.ts); GameApi.addPlayer takes an
//   optional AddPlayerOptions (party key, auto fill), GameApi.emote(playerId, request).
//
// M7a additions (perks, roles, 50v50 Faction mode; backward compatible in the same way: optional in the types, always
// filled by the simulation (the faction fields only in faction mode) and by the network decoder):
// - PlayerView: `role` (GameObjectDefs role id or ""; draw the role's helmet/visor, and in faction mode the role's
//   `mapIcon` for the minimap), `perks` (PerkView list, at most 8; Cast Ironskin draws the black pan, Flak Jacket the
//   armour outline, Perky Shoot holders' victims burst into feathers), `haste` ({type, seq}: Windwalk / Takedown /
//   Inspire speed bursts; `seq` increments on every new haste and when it ends; draw the haste particles while
//   `type` is not "none"). `scale` now follows the perks (Leadership +25 %, Cast Ironskin +40 %, ...; 0.75..2).
// - LocalPlayerState: `role`, `perks` (the HUD perk slots; `droppable` marks the loot perk, which drops on death and is
//   swapped by the next loot perk; dropping it from the HUD needs the DropItem message, not implemented yet).
// - TeamMemberView: `role` (role of the member, "" for none: the original PlayerStatus role).
// - BulletEvent: `saturated` (darker tracer: ammo perks, Hollow-points, OKAMI Bar, Last Breath, One in the Chamber),
//   `thick` (thick tracer: One in the Chamber), `splinter` (a Splinter Rounds side bullet: small tracer). The
//   original bullet special-fx flags trailSaturated / trailThick / splinter + trailSmall.
// - Snapshot: `teamAliveCounts` (faction mode only: living players of [Red, Blue], the original AliveCounts message;
//   `aliveCount` stays their sum) and `factionStatus` (faction mode only: every member of the viewer's faction with
//   position, dead, downed and role, refreshed every `rules.roles.factionStatusInterval` = 0.5 s like the original
//   faction PlayerStatus; draw them on the minimap, role holders with their role's `mapIcon`). `local.team` stays the
//   viewer's squad (group) in faction mode.
// - Faction mode (map "faction", 50v50; GameOptions.teamMode 4, the original 50v50 squad queue): PlayerInfoView.teamId
//   is the faction (1 Red, 2 Blue: tint helmets with `baseTintRed` / `baseTintBlue`, draw the team arm patches) and
//   groupId the squad. Teammates are the whole faction (no friendly fire, knocks until the faction has nobody
//   standing), the match ends when one faction is left, GameOverEvent.teamId / winningTeamId are faction ids and its
//   playerStats list the viewer, then both factions' first Commanders once both exist.
// - Roles: RoleAnnouncementEvent now covers every role (faction roles, Lone Survivr, The Hunted, Cobalt classes) with
//   `assigned` on promotion and `killed` when the holder dies (`killerId` = its killer). Kill Leader announcements are
//   unchanged. MapIndicatorView types gain the role id "the_hunted" (pulsing marker following The Hunted) and loot ids
//   with a def `mapIndicator` ("helmet03_forest": the unclaimed Woods King helmet).
// - Emotes: a Commander's pings reach its whole faction; perks with `emoteOnPickup` emote on pickup; Gabby Ghost emotes
//   at random; the bugle's Inspiration and Last Breath make the affected teammates emote "emote_bugle_*_red/blue".
// - Cobalt: a player picks its class with `Game.selectRole(playerId, role)` (the original PerkModeRoleSelect message;
//   only the map's `perkModeRoles`, once); without a choice a random class comes after 20 s. Until then it cannot emote.
// - Spud Gun hits enlarge the target for a while (PlayerView.scale).
// - New types: PerkView, HasteName, FactionMemberView (viewMatch.ts, re-exported here with the M4 match types).
//
// M7b additions (event maps; backward compatible, see viewModes.ts for the full notes): PlayerView `frozen` /
// `frozenOri` (snowball and potato hits), the Cobalt class menu waiting room, potato emotes, GenerateMapResult
// `skipped`, `Game.dropItem`.
import type { Vec2 } from "@rebirth/core";
import type { AirstrikeZoneView, ExplosionEvent, ProjectileView, RecorderEvent, SmokeView } from "./viewEffects.ts";
import type {
    AirdropView,
    FactionMemberView,
    GameOverEvent,
    GasView,
    HasteName,
    KillEvent,
    KillLeaderView,
    MapIndicatorView,
    PerkView,
    PlaneView,
    PlayerStatsView,
    RoleAnnouncementEvent,
} from "./viewMatch.ts";
import type { EmoteEvent, TeamMemberView } from "./viewTeams.ts";

export type { AirstrikeZoneView, ExplosionEvent, ProjectileView, RecorderEvent, SmokeView } from "./viewEffects.ts";
export type {
    AirdropView,
    DamageSource,
    FactionMemberView,
    GameOverEvent,
    GasModeName,
    GasView,
    HasteName,
    KillEvent,
    KillLeaderView,
    MapIndicatorView,
    PerkView,
    PlaneType,
    PlaneView,
    PlayerStatsView,
    RoleAnnouncementEvent,
} from "./viewMatch.ts";
export type { AddPlayerOptions, EmoteEvent, EmoteRequest, TeamMemberView } from "./viewTeams.ts";

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
    /** standing in a building heal region (heal particles) (M5b) */
    healEffect?: boolean;
    /** GameObjectDefs role id, "" for none (M7a) */
    role?: string;
    /** perks in pickup / grant order, at most 8 (M7a) */
    perks?: PerkView[];
    /** current speed burst; `seq` increments when one starts or ends (M7a) */
    haste?: { type: HasteName; seq: number };
    /** hit by a snowball / potato: slowed, draw the map's frozen sprite over the body (M7b, viewModes.ts) */
    frozen?: boolean;
    /** quarter turns (0-3) of the frozen sprite, 0 when not frozen (M7b) */
    frozenOri?: number;
}

/** "revive": the reviver's 8 s revive animation (M6a) */
export type AnimType = "none" | "melee" | "cook" | "throw" | "revive";

export interface PlayerAnim {
    type: AnimType;
    seq: number;
}

/** "revive": reviving a teammate, being revived or self reviving (M6a) */
export type ActionType = "none" | "reload" | "use" | "revive";

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
    /**
     * Door state. `pos`/`ori` follow the door (see the M5b notes); `canUse` is false for doors only buttons or puzzles
     * move and after an `openOnce` door was used; `seq` increments when an interaction starts (M5b).
     */
    door?: { open: boolean; locked: boolean; canUse: boolean; seq?: number };
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
    /** the def's `ceiling.destroy.wallCount` walls were destroyed: the roof collapsed (M5b) */
    ceilingDead: boolean;
    /** a `damageCeiling` obstacle (stove) was destroyed: roof hole (M5b) */
    ceilingDamaged: boolean;
    /** a `disableBuildingOccupied` obstacle was destroyed: occupied emitters (chimney smoke) stop for good (M5b) */
    occupiedDisabled?: boolean;
    /** buildings with a def `puzzle`: solved, and a counter of failed attempts (M5b) */
    puzzle?: { solved: boolean; errSeq: number };
}

export interface StructureView extends BaseView {
    kind: "structure";
    ori: number;
    /** the def's interiorSound plays its `soundAlt` (its puzzle was solved) (M5b) */
    interiorSoundAlt?: boolean;
}

export interface DecalView extends BaseView {
    kind: "decal";
    ori: number;
    scale: number;
    /** decals with a def `gore` (club pool): players killed in the building's gore region, at most 255 (M5b) */
    goreKills?: number;
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
    /**
     * running timed action with its progress, for the reload/use bar (M2); `targetId` (M6a): the player being revived
     * for a reviver (its own id while self reviving), 0 otherwise
     */
    action?: { type: ActionType; item: string; time: number; duration: number; targetId?: number };
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
    /** team modes: every member of the player's group, itself included (M6a; absent in solo) */
    team?: TeamMemberView[];
    /** role id, "" for none (M7a) */
    role?: string;
    /** the HUD perk slots (M7a) */
    perks?: PerkView[];
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
    /** darker tracer (ammo perks, Hollow-points, OKAMI Bar, Last Breath, One in the Chamber) (M7a) */
    saturated?: boolean;
    /** thick tracer (One in the Chamber) (M7a) */
    thick?: boolean;
    /** a Splinter Rounds side bullet (small tracer) (M7a) */
    splinter?: boolean;
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
    /** explosions whose radius touches the view since the viewer's previous snapshot, in order (M5) */
    explosions?: ExplosionEvent[];
    /** flying projectiles in view: thrown grenades, potato gun shots, air strike bombs (M5) */
    projectiles?: ProjectileView[];
    /** smoke clouds touching the view (M5) */
    smokes?: SmokeView[];
    /** every live air strike zone (M5; 50v50 scheduled air strikes) */
    airstrikeZones?: AirstrikeZoneView[];
    /** recorders used in view since the viewer's previous snapshot, in order (M5b) */
    recorders?: RecorderEvent[];
    /** emotes and pings the viewer may see, since its previous snapshot, in order (M6a) */
    emotes?: EmoteEvent[];
    /** faction mode: living players of [Red, Blue] (the original AliveCounts) (M7a) */
    teamAliveCounts?: number[];
    /** faction mode: the viewer's faction for the minimap, in id order (M7a) */
    factionStatus?: FactionMemberView[];
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
