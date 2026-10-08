// Shared shapes of the original surviv.io definition format (v0.8.82).

export interface Vec2 {
    x: number;
    y: number;
}

export interface CircleCollider {
    type: 0;
    pos: Vec2;
    rad: number;
    /** present on colliders built by the original client helpers */
    height?: number;
}

export interface AabbCollider {
    type: 1;
    min: Vec2;
    max: Vec2;
    height?: number;
}

export type Collider = CircleCollider | AabbCollider;
export type AABB = AabbCollider;

export interface LootImg {
    sprite: string;
    scale: number;
    tint: number;
    border?: string;
    borderTint?: number;
    innerScale?: number;
    mirror?: boolean;
    rot?: number;
    /** loot pickup radius override (fists, knuckles) */
    rad?: number;
    /** ammo boxes */
    tintDark?: number;
    /** rebirth: tint of the image in the DOM HUD (the original HUD never tints; the variant strobes, rebirth/strobes.ts) */
    hudTint?: number;
}

export interface MapIndicatorDef {
    sprite: string;
    tint: number;
    pulse: boolean;
    pulseTint: number;
}

/** Fields shared by every item that can lie on the ground as loot. */
export interface BaseLootDef {
    name: string;
    baseType?: string;
    noDrop?: boolean;
    noDropOnDeath?: boolean;
    lootImg: LootImg;
    mapIndicator?: MapIndicatorDef;
    sound: {
        pickup?: string;
    };
}

export interface BaseLoadoutItem {
    name?: string;
    lore?: string;
    /** GameConfig.Rarity: 0 stock .. 5 mythic */
    rarity?: number;
}

export interface BaseWeaponDef extends BaseLootDef {
    quality?: number;
    noPotatoSwap?: boolean;
    perk?: string;
}

export interface MinMax {
    min: number;
    max: number;
}
