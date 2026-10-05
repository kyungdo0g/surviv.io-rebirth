// Gear and consumables: ammo, heals, boosts, backpacks, helmets, chests, scopes.
import type { BaseLootDef } from "./common.ts";

export interface AmmoDef extends BaseLootDef {
    type: "ammo";
    minStackSize: number;
    special?: boolean;
    hideUi?: boolean;
}

interface ConsumableDef extends BaseLootDef {
    useTime: number;
    sound: { pickup: string; use: string };
    emitter: string;
    aura: { sprite: string; tint: number };
}

export interface HealDef extends ConsumableDef {
    type: "heal";
    heal: number;
    maxHeal: number;
}

export interface BoostDef extends ConsumableDef {
    type: "boost";
    boost: number;
}

export interface BackpackDef extends BaseLootDef {
    type: "backpack";
    level: number;
    playerRad: number;
    tint: number;
}

export interface HelmetDef extends BaseLootDef {
    type: "helmet";
    level: number;
    damageReduction: number;
    skinImg: {
        baseTint: number;
        baseTintRed: number;
        baseTintBlue: number;
        baseSprite: string;
        spriteScale?: number;
    };
    /** role this helmet belongs to (leader helmets) */
    role?: string;
    perk?: string;
}

export interface ChestDef extends BaseLootDef {
    type: "chest";
    level: number;
    damageReduction: number;
    skinImg: { baseTint: number; baseSprite: string };
}

export interface ScopeDef extends BaseLootDef {
    type: "scope";
    level: number;
}
