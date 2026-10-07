// Weapon definitions: guns, bullets, melee, throwables and explosions.
import type { BaseLoadoutItem, BaseWeaponDef, MinMax, Vec2 } from "./common.ts";

export interface BulletDef {
    type: "bullet";
    baseType?: string;
    damage: number;
    obstacleDamage: number;
    falloff: number;
    distance: number;
    speed: number;
    variance: number;
    shrapnel: boolean;
    /** key of GameConfig.tracerColors */
    tracerColor: string;
    tracerWidth: number;
    tracerLength: number;
    suppressed?: boolean;
    flareColor?: number;
    addFlare?: boolean;
    maxFlareScale?: number;
    skipCollision?: boolean;
    /** explosion id spawned where the bullet hits */
    onHit?: string;
}

export type FireMode = "auto" | "single" | "burst";

export interface GunDef extends BaseWeaponDef {
    type: "gun";
    fireMode: FireMode;
    caseTiming: "shoot" | "reload";
    /** ammo id (special guns use pseudo ammo without a def: 9mm_cursed, bugle_ammo) */
    ammo: string;
    ammoSpawnCount: number;
    maxClip: number;
    maxReload: number;
    extendedClip: number;
    extendedReload: number;
    reloadTime: number;
    fireDelay: number;
    switchDelay: number;
    barrelLength: number;
    barrelOffset: number;
    recoilTime: number;
    moveSpread: number;
    shotSpread: number;
    bulletCount: number;
    bulletType: string;
    /** bullet fired instead of bulletType when the matching bonus perk (bonus_9mm, bonus_45) is active */
    bulletTypeBonus?: string;
    headshotMult: number;
    speed: { equip: number; attack: number };
    worldImg: {
        sprite: string;
        scale: Vec2;
        tint: number;
        leftHandOffset?: Vec2;
        recoil: number;
        gunOffset?: Vec2;
        handsBelow?: boolean;
        magImg?: { sprite: string; pos: Vec2; top?: boolean };
    };
    particle: {
        shellScale: number;
        shellOffset: number;
        shellOffsetY?: number;
        shellForward?: number;
        shellReverse?: boolean;
        /** casing particle instead of the ammo's (survev: "50cal" for the Barrett and the ASh-12) */
        casing?: string;
    };
    sound: {
        shoot: string;
        reload: string;
        pickup: string;
        empty: string;
        deploy: string;
        cycle?: string;
        pull?: string;
        shootLast?: string;
        /** shoot sound per faction team id */
        shootTeam?: Record<string, string>;
        shootAlt?: string;
        reloadAlt?: string;
        fallOff?: number;
    };
    pullDelay?: number;
    isDual?: boolean;
    pistol?: boolean;
    dualOffset?: number;
    dualWieldType?: string;
    ammoInfinite?: boolean;
    burstDelay?: number;
    burstCount?: number;
    burstSounds?: number;
    outsideOnly?: boolean;
    ignoreEndlessAmmo?: boolean;
    noSplinter?: boolean;
    isLauncher?: boolean;
    projType?: string;
    deployGroup?: number;
    ignoreDetune?: boolean;
    aimDelay?: boolean;
    isBullpup?: boolean;
    jitter?: number;
    maxReloadAlt?: number;
    extendedReloadAlt?: number;
    reloadTimeAlt?: number;
    toMouseHit?: boolean;
    /** minigun hold pose (survev PMG-134) */
    isMinigun?: boolean;
}

export interface MeleeImg {
    sprite: string;
    pos: Vec2;
    rot: number;
    scale: Vec2;
    tint: number;
    leftHandOntop?: boolean;
    renderOnHand?: boolean;
}

export interface MeleeDef extends BaseWeaponDef, BaseLoadoutItem {
    type: "melee";
    name: string;
    autoAttack: boolean;
    switchDelay: number;
    damage: number;
    obstacleDamage: number;
    headshotMult: number;
    cleave?: boolean;
    armorPiercing?: boolean;
    stonePiercing?: boolean;
    /** perk the holder has while the weapon is in its slot (survev Gold Cutlass: pirate; weaponManager.ts setWeapon) */
    perk?: string;
    attack: {
        offset: Vec2;
        rad: number;
        damageTimes: number[];
        cooldownTime: number;
    };
    speed: { equip: number; attack?: number };
    anim: { idlePose: string; attackAnims: string[] };
    sound: {
        swing: string;
        deploy: string;
        playerHit: string;
        playerHit2?: string;
        pickup?: string;
        bullet?: string;
    };
    worldImg?: MeleeImg;
    hipImg?: MeleeImg;
    reflectSurface?: {
        equipped: { p0: Vec2; p1: Vec2 };
        unequipped: { p0: Vec2; p1: Vec2 };
    };
}

export interface ThrowableHandImg {
    sprite: string;
    pos?: Vec2;
    scale?: number;
}

export interface ThrowableDef extends BaseWeaponDef {
    type: "throwable";
    explosionType: string;
    inventoryOrder: number;
    cookable: boolean;
    explodeOnImpact: boolean;
    playerCollision: boolean;
    fuseTime: number;
    fuseVariance?: number;
    aimDistance: number;
    rad: number;
    throwPhysics: {
        playerVelMult: number;
        velZ: number;
        speed: number;
        spinVel: number;
        spinDrag: number;
        fixedCollisionHeight?: number;
        randomizeSpinDir?: boolean;
    };
    speed: { equip: number; attack: number };
    worldImg: { sprite: string; scale: number; tint: number };
    handImg?: Partial<Record<"equip" | "cook" | "throwing", { right: ThrowableHandImg; left: ThrowableHandImg }>>;
    useThrowParticles: boolean;
    sound: { pullPin: string; throwing: string; pickup: string; deploy: string };
    strikeDelay?: number;
    freezeOnImpact?: boolean;
    heavyType?: string;
    /** held this long (s) the throwable leaves as its `heavyType` (survev weaponManager.ts:1229-1234) */
    changeTime?: number;
    forceMaxThrowDistance?: boolean;
    emoteId?: number;
    destroyNonCollidables?: boolean;
    trail?: { maxLength: number; width: number; alpha: number; tint: number };
    numSplit?: number;
    splitType?: string;
}

export interface ExplosionDef {
    type: "explosion";
    damage: number;
    obstacleDamage: number;
    rad: MinMax;
    shrapnelCount: number;
    /** bullet id, "" for none */
    shrapnelType: string;
    explosionEffectType: string;
    /** decal map object id, "" for none */
    decalType: string;
    teamDamage?: boolean;
    /** survev: seconds a hit enemy is slowed (the simulation reads rules.modes.throwableHits instead) */
    freezeDuration?: number;
    /** survev: sprites drawn over a slowed player (the client draws the map's biome.frozenSprites) */
    frozenSprites?: string[];
    /** survev coconut: hits on the source's side heal `healAmount` (default 5) and deal no damage */
    healTeam?: boolean;
    healAmount?: number;
    /** survev: random items a hit enemy drops (the simulation reads rules.modes.throwableHits instead) */
    dropRandomLoot?: number;
}
