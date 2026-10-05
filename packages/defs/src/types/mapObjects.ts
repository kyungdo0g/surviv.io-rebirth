// Map object definitions: obstacles, buildings, structures, decals and loot spawners.
import type { AABB, Collider, MinMax, Vec2 } from "./common.ts";

export interface TerrainSpawnDef {
    grass?: boolean;
    beach?: boolean;
    riverShore?: boolean;
    lakeCenter?: boolean;
    spawnPriority?: number;
    bridge?: { nearbyWidthMult: number };
    waterEdge?: { dir: Vec2; distMin: number; distMax: number };
    river?: { centerWeight: number };
    nearbyRiver?: { radMin: number; radMax: number; facingOri: number };
}

/** `tierLoot(tier, min, max)` or `autoLoot(type, count)` entry of a map object. */
export interface LootSpawnDef {
    tier?: string;
    min?: number;
    max?: number;
    type?: string;
    count?: number;
    props?: { preloadGuns?: boolean };
}

export interface ObstacleDef {
    type: "obstacle";
    /** coarse category: barrel, crate, airdrop, furniture, locker, toilet, pot, vending, ... */
    obstacleType?: string;
    scale: { createMin: number; createMax: number; destroy: number };
    collision: Collider;
    height: number;
    collidable: boolean;
    destructible: boolean;
    /** explosion id spawned on destruction */
    explosion?: string;
    health: number;
    hitParticle: string;
    explodeParticle: string | string[];
    reflectBullets: boolean;
    loot: LootSpawnDef[];
    map?: { display: boolean; color?: number; scale?: number };
    terrain?: TerrainSpawnDef;
    img: {
        sprite?: string;
        scale?: number;
        alpha?: number;
        tint?: number;
        zIdx?: number;
        residue?: string;
        mirrorX?: boolean;
        mirrorY?: boolean;
        randomRotation?: boolean;
    };
    sound: { bullet: string; punch: string; explode: string; enter: string };
    isWall?: boolean;
    isWindow?: boolean;
    isTree?: boolean;
    isBush?: boolean;
    isDecalAnchor?: boolean;
    material?: string;
    /** half extents of walls (computed by the original wall helpers) */
    extents?: Vec2;
    mapObstacleBounds?: Collider[];
    door?: {
        interactionRad: number;
        canUse: boolean;
        openSpeed: number;
        openOneWay: number | boolean;
        openDelay: number;
        openOnce: boolean;
        autoOpen: boolean;
        autoClose: boolean;
        autoCloseDelay: number;
        slideToOpen: boolean;
        slideOffset: number;
        spriteAnchor: Vec2;
        sound: { open: string; close: string; change: string; error: string };
        casingImg?: { sprite: string; pos: Vec2; scale: number; alpha: number; tint: number };
        locked?: boolean;
    };
    /** door hinge position (computed by the original door helper) */
    hinge?: Vec2;
    button?: {
        interactionRad: number;
        interactionText: string;
        useOnce: boolean;
        /** obstacle id activated by this button */
        useType?: string;
        useStyle?: "toggle" | "close" | "open";
        useLock?: "lock" | "unlock";
        useDelay: number;
        useDir: Vec2;
        useCooldown?: number;
        useExpiration?: number;
        resetAfterCooldown?: boolean;
        useImg: string;
        offImg?: string;
        sound: { on: string; off: string };
        destroyOnUse?: boolean;
        useParticle?: string;
    };
    /** map object spawned when destroyed; with smartLoot it is a prefix completed with `_${role}` */
    destroyType?: string;
    smartLoot?: boolean;
    stonePlated?: boolean;
    armorPlated?: boolean;
    aabb?: AABB;
    disableBuildingOccupied?: boolean;
    damageCeiling?: boolean;
    lootSpawn?: { offset: Vec2; speedMult: number };
    dropCollision?: AABB;
    airdropCrate?: boolean;
    swapWeaponOnDestroy?: boolean;
    regrow?: boolean;
    regrowTimer?: number;
    createSmoke?: boolean;
    /** faction team (survev-only map objects) */
    teamId?: number;
}

export interface FloorImage {
    sprite: string;
    scale: number;
    alpha: number;
    tint: number;
    rot?: number;
    pos?: Vec2;
    removeOnDamaged?: boolean;
    mirrorX?: boolean;
    mirrorY?: boolean;
}

export interface BuildingChildDef {
    /** map object id, "" for nothing, or `{ id: weight }` for a weighted random pick */
    type: string | Record<string, number>;
    pos: Vec2;
    scale: number;
    ori: number;
    inheritOri?: boolean;
    ignoreMapSpawnReplacement?: boolean;
    puzzlePiece?: string;
}

/**
 * Note: some original building defs also carry the named parameters of the factory that built them
 * (topLeftObs, porch_01, tree_loot, ...); they are kept in the data but not typed here.
 */
export interface BuildingDef {
    type: "building";
    map?: {
        display?: boolean;
        color?: number;
        scale?: number;
        shapes?: Array<{ collider: Collider; color: number }>;
        displayType?: string;
        hideFromClient?: boolean;
    };
    terrain: TerrainSpawnDef;
    ori?: number;
    oris?: number[];
    zIdx?: number;
    scale?: { createMin: number; createMax: number; destroy: number };
    mapObstacleBounds?: Collider[];
    floor: {
        surfaces: Array<{ type: string; collision: AABB[]; data?: Record<string, unknown> }>;
        imgs: FloorImage[];
    };
    ceiling: {
        zoomRegions: Array<{ zoomIn?: AABB; zoomOut?: AABB; zoom?: number; noZoom?: boolean }>;
        vision?: { dist?: number; width?: number; linger?: number; fadeRate?: number };
        imgs: FloorImage[];
        damage?: { obstacleCount: number };
        destroy?: { wallCount: number; particle: string; particleCount: number; residue: string; sound?: string };
        collision?: AABB[];
    };
    mapObjects: BuildingChildDef[];
    occupiedEmitters?: Array<{
        type: string;
        pos: Vec2;
        rot: number;
        scale: number;
        layer: number;
        parentToCeiling?: boolean;
        dir?: Vec2;
    }>;
    puzzle?: {
        name: string;
        completeUseType: string;
        completeOffDelay: number;
        completeUseDelay: number;
        errorResetDelay: number;
        pieceResetDelay: number;
        sound: { fail: string; complete: string };
    };
    mapGroundPatches?: Array<{
        bound: Collider;
        color: number;
        order?: number;
        roughness?: number;
        offsetDist?: number;
        useAsMapShape?: boolean;
    }>;
    bridgeLandBounds?: Collider[];
    bridgeWaterBounds?: Collider[];
    goreRegion?: Collider;
    soundEmitters?: Array<{
        sound: string;
        channel: string;
        pos: Vec2;
        range: MinMax;
        falloff: number;
        volume: number;
    }>;
    healRegions?: Array<{ collision: Collider; healRate: number }>;
    teamId?: number;
}

export interface StructureDef {
    type: "structure";
    terrain: TerrainSpawnDef;
    ori?: number;
    mapObstacleBounds?: Collider[];
    layers: Array<{ type: string; pos: Vec2; ori: number; underground?: boolean }>;
    stairs: Array<{ collision: AABB; downDir: Vec2; noCeilingReveal?: boolean; lootOnly?: boolean }>;
    mask: AABB[];
    structureType?: string;
    bunkerType?: string;
    interiorSound?: {
        sound: string;
        soundAlt: string;
        filter?: string;
        transitionTime: number;
        soundAltPlayTime?: number;
        outsideMaxDist: number;
        outsideVolume: number;
        undergroundVolume?: number;
        puzzle: string;
    };
    bridgeLandBounds?: Collider[];
    bridgeWaterBounds?: Collider[];
    teamId?: number;
}

export interface DecalDef {
    type: "decal";
    collision: Collider;
    height: number;
    terrain?: TerrainSpawnDef;
    img: {
        sprite: string;
        scale: number;
        alpha: number;
        tint: number;
        zIdx: number;
        ignoreAdjust?: boolean;
        flicker?: boolean;
        flickerMin?: number;
        flickerMax?: number;
        flickerRate?: number;
    };
    lifetime?: number | MinMax;
    fadeChance?: number;
    surface?: { type: "water"; data: { waterColor: number; rippleColor: number } };
    gore?: {
        fade: { start: number; end: number; pow: number; speed: number };
        tint?: number;
        alpha: number;
        waterColor?: number;
        rippleColor?: number;
    };
}

export interface LootSpawnerDef {
    type: "loot_spawner";
    loot: LootSpawnDef[];
    terrain?: TerrainSpawnDef;
}

export type MapObjectDef = ObstacleDef | BuildingDef | StructureDef | DecalDef | LootSpawnerDef;
export type MapObjectType = MapObjectDef["type"];
export type MapObjectDefOfType<T extends MapObjectType> = Extract<MapObjectDef, { type: T }>;
