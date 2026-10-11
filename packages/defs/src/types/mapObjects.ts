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
    /** no obstacle of the same type within this distance (survev: faction crates, Cobalt's class shells) */
    minDistanceFromSameType?: number;
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
        /** survev: the user is promoted to this role (the Augmenting Vat: "classless") */
        roleToPromote?: string;
        /** survev: an Augmenting Vat (client presentation) */
        isVat?: boolean;
        useParticle?: string;
    };
    /** map object spawned when destroyed; with smartLoot it is a prefix completed with `_${role}` */
    destroyType?: string;
    smartLoot?: boolean;
    stonePlated?: boolean;
    armorPlated?: boolean;
    /**
     * rebirth (wave 3 blast doors, rebirth/buildings/blastDoors.ts): only explosions damage it (no bullet, melee,
     * shrapnel or projectile impact; an air drop crate landing on it still does); with `explosionTypes` only those
     * explosion ids count. With `hitsToOpen` (the owner, 2026-10-11) its health counts hits, not damage: each listed
     * explosion that reaches it is one hit taking 1/n of the door for an id listed with n, so it opens to n such hits
     * (mixed ids add up their shares); nothing else hurts it, not even a landing crate
     */
    explosionGate?: { explosionTypes?: readonly string[]; hitsToOpen?: Readonly<Record<string, number>> };
    /**
     * rebirth (wave 3 collapsing buildings, rebirth/buildings/walls.ts): a load-bearing wall. In a building whose roof
     * collapses (`ceiling.destroy.collapse`) only these walls count towards `wallCount` (sim world/buildings.ts), so
     * breaking its wood partitions in a fight never brings it down
     */
    loadBearing?: boolean;
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
    /** survev: the child's own layer instead of the building's */
    layer?: number;
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
        destroy?: {
            wallCount: number;
            particle: string;
            particleCount: number;
            residue: string;
            sound?: string;
            /**
             * rebirth: when the roof falls (wallCount walls broken) the whole building caves in: everyone on its floor
             * dies (DamageType.Collapse), its obstacles and the loot on its floor are buried (sim world/collapse.ts)
             */
            collapse?: true;
        };
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
        /**
         * rebirth (the mall's keypad, 2026-10-11): a piece that is not the code's next step is an error at once,
         * instead of when the input reaches the code's length (survev)
         */
        wrongPieceResets?: boolean;
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
    /**
     * Rebirth (owner wave 3, 2026-10-10): an unlit building. A player standing under its ceiling on its own layer sees
     * the screen near black except a dim glow round themselves, muzzle flashes and explosions (client fx/darkness.ts).
     * Presentation only: the simulation ignores it. For a structure's underground floor use `layers[i].dark` instead.
     */
    dark?: true;
}

/** One floor of a structure: the building placed at `pos` (rotated by `ori`) on map layer = its index. */
export interface StructureLayerDef {
    type: string;
    pos: Vec2;
    ori: number;
    /** false: the floor counts as above ground (no ground cover, no underground audio); default true on layer 1 */
    underground?: boolean;
    /**
     * Rebirth (owner wave 3, 2026-10-10: the subway station's inside is pitch dark): the floor's building is unlit,
     * as `BuildingDef.dark` (client fx/darkness.ts; presentation only).
     */
    dark?: true;
}

export interface StructureDef {
    type: "structure";
    terrain: TerrainSpawnDef;
    ori?: number;
    mapObstacleBounds?: Collider[];
    layers: StructureLayerDef[];
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
