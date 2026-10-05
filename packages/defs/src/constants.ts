// Enum-like constants of GameConfig as literal const objects (erasable TypeScript has no enums).
// test/gameConfig.test.ts checks they equal the values in generated/gameConfig.json.

export const ColliderType = { Circle: 0, Aabb: 1 } as const;

export const Input = {
    MoveLeft: 0,
    MoveRight: 1,
    MoveUp: 2,
    MoveDown: 3,
    Fire: 4,
    Reload: 5,
    Cancel: 6,
    Interact: 7,
    Revive: 8,
    Use: 9,
    Loot: 10,
    EquipPrimary: 11,
    EquipSecondary: 12,
    EquipMelee: 13,
    EquipThrowable: 14,
    EquipFragGrenade: 15,
    EquipSmokeGrenade: 16,
    EquipNextWeap: 17,
    EquipPrevWeap: 18,
    EquipLastWeap: 19,
    EquipOtherGun: 20,
    EquipPrevScope: 21,
    EquipNextScope: 22,
    UseBandage: 23,
    UseHealthKit: 24,
    UseSoda: 25,
    UsePainkiller: 26,
    StowWeapons: 27,
    SwapWeapSlots: 28,
    ToggleMap: 29,
    CycleUIMode: 30,
    EmoteMenu: 31,
    TeamPingMenu: 32,
    Fullscreen: 33,
    HideUI: 34,
    TeamPingSingle: 35,
    Count: 36,
} as const;

export const EmoteSlot = { Top: 0, Right: 1, Bottom: 2, Left: 3, Win: 4, Death: 5, Count: 6 } as const;
export const WeaponSlot = { Primary: 0, Secondary: 1, Melee: 2, Throwable: 3, Count: 4 } as const;
export const DamageType = { Player: 0, Bleeding: 1, Gas: 2, Airdrop: 3, Airstrike: 4 } as const;
/** `Count` is a survev addition */
export const Action = { None: 0, Reload: 1, ReloadAlt: 2, UseItem: 3, Revive: 4, Count: 5 } as const;
/** `DeployMelee`, `IdleMelee` and `Count` are survev additions (the original client stops at Revive) */
export const Anim = {
    None: 0,
    Melee: 1,
    Cook: 2,
    Throw: 3,
    CrawlForward: 4,
    CrawlBackward: 5,
    Revive: 6,
    DeployMelee: 7,
    IdleMelee: 8,
    Count: 9,
} as const;
export const GasMode = { Inactive: 0, Waiting: 1, Moving: 2 } as const;
export const Plane = { Airdrop: 0, Airstrike: 1 } as const;
export const HasteType = { None: 0, Windwalk: 1, Takedown: 2, Inspire: 3, Count: 4 } as const;
/** mapIds 0-7 exist in the original client; 8-10 are survev */
export const MapId = {
    Main: 0,
    Desert: 1,
    Woods: 2,
    Faction: 3,
    Potato: 4,
    Savannah: 5,
    Halloween: 6,
    Cobalt: 7,
    Birthday: 8,
    Beach: 9,
    FactionPotato: 10,
} as const;
export const Rarity = { Stock: 0, Common: 1, Uncommon: 2, Rare: 3, Epic: 4, Mythic: 5 } as const;
export const TeamMode = { Solo: 1, Duo: 2, Squad: 4 } as const;
export const FactionTeam = { Red: 1, Blue: 2 } as const;

export type ValueOf<T> = T[keyof T];
export type InputValue = ValueOf<typeof Input>;
export type WeaponSlotValue = ValueOf<typeof WeaponSlot>;
export type GasModeValue = ValueOf<typeof GasMode>;
