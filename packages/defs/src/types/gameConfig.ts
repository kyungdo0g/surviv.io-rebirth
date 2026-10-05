// GameConfig: the original client GameConfig deep-merged over survev's (original wins), plus survev server
// constants. src/index.ts assigns the JSON to this interface without a cast, so tsc checks the data against it.
import type {
    Action,
    Anim,
    DamageType,
    EmoteSlot,
    FactionTeam,
    GasMode,
    HasteType,
    Input,
    MapId,
    Plane,
    Rarity,
    TeamMode,
    WeaponSlot,
} from "../constants.ts";

type EnumOf<T> = { readonly [K in keyof T]: number };

export interface TracerColor {
    regular: number;
    saturated: number;
    chambered?: number;
    /** survev addition (armor-piercing rounds perk) */
    apSaturated?: number;
    alphaRate?: number;
    alphaMin?: number;
}

export interface GasStage {
    /** GameConfig.GasMode */
    mode: number;
    /** seconds */
    duration: number;
    /** fraction of the map size */
    rad: number;
    /** damage per tick */
    damage: number;
}

export interface RoleLoadoutItem {
    type: string;
    ammo: number;
}

export interface GameConfigDef {
    /** 78 = original v0.8.82 protocol */
    protocolVersion: number;
    Input: EnumOf<typeof Input>;
    EmoteSlot: EnumOf<typeof EmoteSlot>;
    WeaponSlot: EnumOf<typeof WeaponSlot>;
    WeaponType: string[];
    DamageType: EnumOf<typeof DamageType>;
    Action: EnumOf<typeof Action>;
    Anim: EnumOf<typeof Anim>;
    GasMode: EnumOf<typeof GasMode>;
    Plane: EnumOf<typeof Plane>;
    HasteType: EnumOf<typeof HasteType>;
    MapId: EnumOf<typeof MapId>;
    Rarity: EnumOf<typeof Rarity>;
    TeamMode: EnumOf<typeof TeamMode>;
    TeamModeToString: Record<string, string>;
    FactionTeam: EnumOf<typeof FactionTeam>;
    map: { gridSize: number; shoreVariation: number; grassVariation: number };
    player: {
        radius: number;
        maxVisualRadius: number;
        maxInteractionRad: number;
        health: number;
        reviveHealth: number;
        boostBreakpoints: number[];
        baseSwitchDelay: number;
        freeSwitchCooldown: number;
        bleedTickRate: number;
        reviveDuration: number;
        reviveRange: number;
        crawlTime: number;
        emoteSoftCooldown: number;
        emoteHardCooldown: number;
        emoteThreshold: number;
        throwableMaxMouseDist: number;
        cookTime: number;
        throwTime: number;
        meleeHeight: number;
        touchLootRadMult: number;
        medicHealRange: number;
        medicReviveRange: number;
        // survev server constants
        minActiveTime: number;
        boostDecay: number;
        boostMoveSpeed: number;
        boostHealAmounts: number[];
        scopeDelay: number;
        headshotChance: number;
        moveSpeed: number;
        waterSpeedPenalty: number;
        cookSpeedPenalty: number;
        frozenSpeedPenalty: number;
        hasteSpeedBonus: number;
        downedMoveSpeed: number;
        downedRezMoveSpeed: number;
        downedDamageBuffer: number;
        keepZoomWhileDowned: boolean;
        teammateSpawnRadius: number;
        spectateDeadTimeout: number;
        killLeaderMinKills: number;
        minSpawnRad: number;
        perkModeRoleSelectDuration: number;
        defaultItems: {
            weapons: RoleLoadoutItem[];
            outfit: string;
            backpack: string;
            helmet: string;
            chest: string;
            scope: string;
            perks: Array<{ type: string; droppable?: boolean }>;
            inventory: Record<string, number>;
        };
    };
    defaultEmoteLoadout: string[];
    airdrop: {
        actionOffset: number;
        fallTime: number;
        crushDamage: number;
        planeVel: number;
        planeRad: number;
        soundRangeMult: number;
        soundRangeDelta: number;
        soundRangeMax: number;
        fallOff: number;
    };
    airstrike: {
        actionOffset: number;
        bombJitter: number;
        bombOffset: number;
        bombVel: number;
        bombCount: number;
        planeVel: number;
        planeRad: number;
        soundRangeMult: number;
        soundRangeDelta: number;
        soundRangeMax: number;
        fallOff: number;
    };
    groupColors: number[];
    teamColors: number[];
    bullet: { maxReflect: number; reflectDistDecay: number; height: number; falloff: boolean };
    projectile: { maxHeight: number };
    structureLayerCount: number;
    tracerColors: Record<string, TracerColor>;
    scopeZoomRadius: { desktop: Record<string, number>; mobile: Record<string, number> };
    /** capacity per backpack level (0-3) for every inventory item */
    bagSizes: Record<string, number[]>;
    lootRadius: Record<string, number>;
    /** survev server data: gas damage tick and stage table (server/src/game/objects/gas.ts) */
    gas: { damageTickRate: number; stages: GasStage[] };
}
