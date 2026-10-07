// Map (mode) definitions: client-visible parts from the original client, server data (gameConfig, lootTable,
// mapGen) from survev. Field names follow survev's shared/defs/mapDefs.ts.
import type { Vec2 } from "./common.ts";

export interface LootTableEntry {
    /** game object id, another `tier_*` table, or "" for no drop */
    name: string;
    count: number;
    weight: number;
    preload?: boolean;
}

/** A value picked per faction team when a role is assigned (survev closures, serialized by the port). */
export interface ByTeam<T> {
    $byTeam: { red: T; blue: T };
}

/** A weighted random choice made when the value is used (survev util.weightedRandom, serialized by the port). */
export interface Weighted<T> {
    $weighted: Array<T & { weight: number }>;
}

export interface RoleWeapon {
    type: string;
    ammo: number;
    fillInv?: boolean;
}

export type RoleWeaponSpec = RoleWeapon | Weighted<RoleWeapon> | ByTeam<RoleWeapon | Weighted<RoleWeapon>>;

/** A role kit (survev roleDefs defaultItems): a role def's own, or a map's partial override. */
export interface RoleDefaultItems {
    weapons?: RoleWeaponSpec[];
    backpack?: string;
    helmet?: string | ByTeam<string>;
    chest?: string;
    outfit?: string | ByTeam<string>;
    /** the role's outfit cannot be swapped for a looted one (the Commander, the Captain) */
    noDropOutfit?: boolean;
    inventory?: Record<string, number>;
}

/** Partial role loadout applied by a map (survev server data). */
export interface RoleOverride {
    defaultItems?: RoleDefaultItems;
    [key: string]: unknown;
}

export type SpawnCount = number | { odds: number } | { small: number; large: number };

export interface MapDef {
    mapId: number;
    desc: {
        name: string;
        icon: string;
        buttonCss: string;
        buttonText?: string;
        backgroundImg?: string;
    };
    assets: {
        audio: Array<{ name: string; channel: string }>;
        atlases: string[];
    };
    biome: {
        colors: {
            background: number;
            water: number;
            waterRipple: number;
            beach: number;
            riverbank: number;
            grass: number;
            underground: number;
            playerSubmerge: number;
            playerGhillie: number;
            lakeWater?: number;
            lakeWaterRipple?: number;
            lakeRiverbank?: number;
        };
        valueAdjust: number;
        sound: { riverShore: string };
        particles: { camera: string };
        tracerColors: Record<string, Record<string, number>>;
        airdrop: { planeImg: string; planeSound: string; airdropImg: string };
        frozenSprites?: string[];
        /** survev-only (the original client hard-codes its ambience) */
        ambience?: { music: string; wind: string; river: string; waves: string };
    };
    gameMode: {
        maxPlayers: number;
        killLeaderEnabled: boolean;
        desertMode?: boolean;
        factionMode?: boolean;
        factions?: number;
        potatoMode?: boolean;
        woodsMode?: boolean;
        sniperMode?: boolean;
        perkMode?: boolean;
        perkModeRoles?: string[];
        turkeyMode?: boolean;
        spookyKillSounds?: boolean;
    };
    gameConfig: {
        planes: {
            timings: Array<{
                circleIdx: number;
                wait: number;
                options: {
                    /** GameConfig.Plane */
                    type: number;
                    numPlanes?: Array<{ count: number; weight: number }>;
                    airstrikeZoneRad?: number;
                    wait?: number;
                    delay?: number;
                    airdropType?: string;
                };
            }>;
            crates: Array<{ name: string; weight: number }>;
        };
        roles?: {
            timings: Array<{ role: string; circleIdx: number; wait: number }>;
            roleOverrides?: Record<string, RoleOverride>;
        };
        unlocks?: {
            timings: Array<{ type: string; stagger: number; circleIdx: number; wait: number }>;
        };
        bagSizes: Record<string, number[]>;
        bleedDamage: number;
        bleedDamageMult: number;
    };
    lootTable: Record<string, LootTableEntry[]>;
    mapGen: {
        map: {
            baseWidth: number;
            baseHeight: number;
            scale: { small: number; large: number };
            extension: number;
            shoreInset: number;
            grassInset: number;
            rivers: {
                lakes: Array<{
                    odds: number;
                    innerRad: number;
                    outerRad: number;
                    centerObj?: string;
                    noRiverObjs?: boolean;
                    riverMaskRad?: number;
                    spawnBound: { pos: Vec2; rad: number };
                }>;
                weights: Array<{ weight: number; widths: number[] }>;
                smoothness: number;
                masks: Array<{ pos?: Vec2; genOnShore?: boolean; rad: number }>;
                spawnCabins: boolean;
            };
        };
        places: Array<{ name: string; pos: Vec2; dontSpawnObjects?: boolean }>;
        bridgeTypes: { medium: string; large: string; xlarge: string };
        customSpawnRules: {
            locationSpawns: Array<{ type: string; pos: Vec2; rad: number; retryOnFailure: boolean }>;
            placeSpawns: string[];
        };
        /** single-element arrays (survev merges derived maps with mergeDeep) */
        densitySpawns: Array<Record<string, number>>;
        fixedSpawns: Array<Record<string, SpawnCount>>;
        randomSpawns: Array<{ spawns: string[]; choose: number }>;
        spawnReplacements: Array<Record<string, string>>;
        importantSpawns: string[];
    };
}
