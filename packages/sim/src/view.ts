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
