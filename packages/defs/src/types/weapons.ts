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
    /** rebirth (new guns): never ricochets, explodes on metal like on anything else (rockets, the GL-06 round) */
    noReflect?: boolean;
    /** rebirth (new guns): the onHit explosion is a dud when the bullet stops before travelling this far */
    armDistance?: number;
    /** rebirth (new guns): no ±1 range jitter (as SimRules.noDistAdjBullets) */
    noDistAdj?: boolean;
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
    /**
     * rebirth: `carry` applies while the gun sits in either gun slot, summed over both; any gun may have it (the DShK
     * in its sheet def, the PMG-134 through rebirth/gunSpeeds.ts)
     */
    speed: { equip: number; attack: number; carry?: number };
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
        /** rebirth (new guns): plays when a single-use gun is discarded */
        discard?: string;
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
    /**
     * a launcher held like a rifle (rebirth, owner 2026-10-08): the M79, GL-06 and Milkor MGL take the rifle idle pose
     * with the hands over the gun; the other launchers keep the launcher pose (client objects/player.ts idlePoseName)
     */
    handHeld?: boolean;
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
    /**
     * rebirth (new guns, docs/design/new-gun-stats.md 4.2): shots the gun carries; it is never reloaded and its ammo
     * is pseudo ammo with no bag row (boys_ammo, panzerfaust_ammo, m202_ammo). maxClip = extendedClip = charges.
     */
    charges?: number;
    /** rebirth (new guns): the empty gun leaves its slot fireDelay after its last shot */
    discardWhenEmpty?: boolean;
    /** rebirth (new guns, DP-12): shots between pumps; shots inside a pair wait fireDelay */
    pumpEvery?: number;
    /** rebirth (new guns, DP-12): the wait after the pumpEvery-th shot (sound.cycle) */
    pumpDelay?: number;
    /** rebirth (new guns): spawns only from gold drops; never potato-swapped or role-rolled */
    goldOnly?: boolean;
    /**
     * rebirth (M202 FLASH, owner 2026-10-08): the bulletCount bullets of a shot leave the muzzle together in a fixed,
     * evenly spaced fan this many degrees wide (outermost to outermost, centred on the aim), with no random spread or
     * pellet jitter
     */
    fanAngle?: number;
    /** rebirth (M202 FLASH): the shooter slides this far back, against the aim, after a shot (collision-checked) */
    recoilKnockback?: number;
    /** rebirth (M202 FLASH): its bullets and their explosions break armour-plated obstacles, as a piercing melee */
    armorPiercing?: boolean;
    /** rebirth (M202 FLASH): its bullets and their explosions break stone-plated obstacles, as a piercing melee */
    stonePiercing?: boolean;
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
    /** rebirth: tint of the hand image (the original draws it untinted) */
    tint?: number;
    /** rebirth: the client draws the sprite in greyscale under `tint`, so the tint replaces its colours */
    recolor?: boolean;
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
    /** `recolor` (rebirth): the client draws the sprite in greyscale under `tint` (ThrowableHandImg.recolor) */
    worldImg: { sprite: string; scale: number; tint: number; recolor?: boolean };
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
    /** rebirth (Molotov): the burst leaves a burning area instead of dealing damage (sim world/fires.ts) */
    fire?: FireAreaDef;
    /** rebirth (flashbang): the burst blinds and deafens the players who see it, no damage (sim combat/flash.ts) */
    flash?: FlashDef;
}

/** A rebirth fire area (the Molotov's; docs/research/rebirth-deviations.md "Molotov and flashbang"). */
export interface FireAreaDef {
    /** radius of the burning ground, units */
    rad: number;
    /** seconds the ground burns */
    duration: number;
    /** damage of one burn tick (armour, helmets and Flak Jacket do not reduce it, like gas and bleeding) */
    damage: number;
    /** seconds between two burn ticks of one player */
    tickInterval: number;
    /** seconds a player keeps burning after leaving the area */
    afterburn: number;
    /** decal map object drawn while the ground burns (its def lifetime is `duration`) */
    decalType: string;
}

/** A rebirth flash (the flashbang's). */
export interface FlashDef {
    /** players farther than this are not affected, units */
    rad: number;
    /** full strength up to this distance, then falling linearly to 0 at `rad` */
    fullRad: number;
    /** seconds of full white screen at strength 1 (the client fades it out over `blindTime` x strength) */
    blindTime: number;
    /** seconds of muffled hearing at strength 1 */
    deafTime: number;
    /** hearing strength left behind a wall (no line of sight): the bang is heard, not seen */
    deafThroughWalls: number;
}
