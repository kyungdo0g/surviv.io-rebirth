// Contract between the simulation and its consumers (client renderer, network encoder, bots, tests).
// The client only ever sees these view types: the loopback transport hands them over directly (M1) and the
// network protocol encodes/decodes exactly these shapes later (M3). Keep them plain, serializable data.
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
    weapons: Array<{ type: string; ammo: number }>;
    curWeapIdx: number;
    inventory: Record<string, number>;
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
