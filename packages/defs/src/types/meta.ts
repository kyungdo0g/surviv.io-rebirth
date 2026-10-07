// Perks, roles, outfits, the loosely typed cosmetic/meta kinds, and the GameObjectDef union.
import type { BaseLoadoutItem, BaseLootDef, MapIndicatorDef } from "./common.ts";
import type { AmmoDef, BackpackDef, BoostDef, ChestDef, HealDef, HelmetDef, ScopeDef } from "./gear.ts";
import type { RoleDefaultItems, Weighted } from "./mapDef.ts";
import type { BulletDef, ExplosionDef, GunDef, MeleeDef, ThrowableDef } from "./weapons.ts";

export interface PerkDef extends BaseLootDef {
    type: "perk";
    emoteOnPickup?: string;
}

export interface RoleDef {
    type: "role";
    announce: boolean;
    killFeed?: { assign?: boolean; dead?: boolean; color?: string };
    sound: { assign?: string; dead?: string };
    mapIcon?: { alive: string; dead: string };
    /** perks granted with the role; survev's Lone Survivr rolls two of them (`{ $weighted: [{ type, weight }] }`) */
    perks?: Array<string | Weighted<{ type: string }>>;
    /** the role kit (survev defaultItems; survev balance, tools/port-survev SURVEV_GAMEPLAY_FIELDS) */
    defaultItems?: RoleDefaultItems;
    mapIndicator?: MapIndicatorDef;
    visorImg?: { baseSprite: string; spriteScale: number };
    guiImg?: string;
    color?: number;
}

export interface OutfitDef extends BaseLootDef, BaseLoadoutItem {
    type: "outfit";
    name: string;
    baseType: string;
    skinImg: {
        baseTint: number;
        baseSprite: string;
        handTint: number;
        handSprite: string;
        footTint: number;
        footSprite: string;
        backpackTint: number;
        backpackSprite: string;
    };
    ghillie?: boolean;
    /** costume outfits: obstacle the player looks like */
    obstacleType?: string;
    baseScale?: number;
}

/** Kinds the game only passes through (cosmetics, account meta); typed loosely. */
export interface EmoteDef {
    type: "emote";
    [key: string]: unknown;
}
export interface CrosshairDef {
    type: "crosshair";
    [key: string]: unknown;
}
export interface HealEffectDef {
    type: "heal_effect";
    [key: string]: unknown;
}
export interface BoostEffectDef {
    type: "boost_effect";
    [key: string]: unknown;
}
export interface PassDef {
    type: "pass";
    [key: string]: unknown;
}
export interface QuestDef {
    type: "quest";
    [key: string]: unknown;
}
export interface UnlockDef {
    type: "unlock";
    [key: string]: unknown;
}
export interface XpDef {
    type: "xp";
    [key: string]: unknown;
}
export interface PingDef {
    type: "ping";
    [key: string]: unknown;
}

export type GameObjectDef =
    | BulletDef
    | GunDef
    | MeleeDef
    | ThrowableDef
    | ExplosionDef
    | AmmoDef
    | HealDef
    | BoostDef
    | BackpackDef
    | HelmetDef
    | ChestDef
    | ScopeDef
    | PerkDef
    | RoleDef
    | OutfitDef
    | EmoteDef
    | CrosshairDef
    | HealEffectDef
    | BoostEffectDef
    | PassDef
    | QuestDef
    | UnlockDef
    | XpDef
    | PingDef;

export type GameObjectType = GameObjectDef["type"];
export type GameObjectDefOfType<T extends GameObjectType> = Extract<GameObjectDef, { type: T }>;

/** Items that can exist as loot on the ground. */
export type LootDef =
    | GunDef
    | MeleeDef
    | ThrowableDef
    | AmmoDef
    | HealDef
    | BoostDef
    | BackpackDef
    | HelmetDef
    | ChestDef
    | ScopeDef
    | PerkDef
    | OutfitDef;
