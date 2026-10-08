// Perk knobs (M7a). Perk numbers are server-side (the original client defs only carry names and sprites), so every
// value is survev's reconstruction (survev shared/defs/gameObjects/perkDefs.ts PerkProperties) unless the KB resolves
// a conflict towards the original v0.8.82 value; each line names its source. `game.rules.perks` is a mutable copy.

export interface PerkRules {
    /**
     * Size change per perk, summed and clamped to 0.75..2 (survev recalculateScale; perks.md "Size (scale) and haste").
     * Survev's values since the survev content wave's stage 5 (survev balance): gotw +0.2 and flak_jacket +0.1
     * (conflicts.md gotw-values / flak-size: 0.25 / 0.2 before), steelskin +0.4, leadership +0.25, small_arms -0.25,
     * trick_size +0.25.
     */
    scales: Readonly<Record<string, number>>;
    /** Leadership keeps adrenaline at 100 (survev perkDefs leadership.minBoost) */
    minBoost: Readonly<Record<string, number>>;
    /** haste speed bonus of Windwalk, Takedown and Inspire (GameConfig.player.hasteSpeedBonus 4.8) */
    hasteSpeedBonus: number;
    /** Windwalk: an enemy bullet passing within this distance of the holder's centre (survev maxTriggerDistance 5) */
    windwalkTriggerDistance: number;
    /** Windwalk haste duration (conflicts.md perk-windwalk-duration: 3 s) */
    windwalkDuration: number;
    /** Windwalk also triggers on enemy explosions centred within the trigger distance (conflicts.md perk-windwalk-explosions) */
    windwalkOnExplosions: boolean;
    /** Takedown: +25 HP, +25 adrenaline and a 3 s haste per kill (survev perkDefs takedown) */
    takedownHealth: number;
    takedownBoost: number;
    takedownHasteDuration: number;
    /** Splinter Rounds main bullet damage x0.6 (survev splinter.mainDamageMult) */
    splinterMainDamageMult: number;
    /** side bullets x0.5 of the main bullet (survev splitsDamageMult; conflicts.md perk-splinter-side-damage: 0.45) */
    splinterSideDamageMult: number;
    /** side bullets deviate random(0.2, 0.25) x max(spread, 1) degrees to each side (survev fireWeapon) */
    splinterDeviation: readonly [number, number];
    /** survev keeps the x0.6 main multiplier on `noSplinter` guns; the KB skips the whole perk (perk-splinter-nosplinter-main) */
    splinterMainOnNoSplinter: boolean;
    /** One in the Chamber: first and last round x1.25, not 12 gauge (survev chambered.damageMult) */
    chamberedDamageMult: number;
    /** High-Value Targets: bullet damage x1.25 against players holding a perk (survev targeting.damageMult) */
    targetingDamageMult: number;
    /** each ammo perk of the bullet's ammo: x1.12 (survev ammoBonusDamageMult; conflicts.md ammo-perk-mult: 1.08) */
    ammoBonusDamageMult: number;
    /** Hollow-points and OKAMI Bar: x1.08 on every bullet (survev isBulletSaturated) */
    saturatedDamageMult: number;
    /**
     * survev multiplies every matching bonus (Last Breath, Hollow-points / OKAMI Bar, each ammo perk); false applies
     * one `saturatedDamageMult` bonus per bullet (conflicts.md ammo-bonus-stacking, the v0.8.82 reading)
     */
    ammoBonusStacking: boolean;
    /** Hollow-points: bullets x1.1 as fast (survev bonus_assault.speedMult, weaponManager.ts:868-870) */
    bonusAssaultSpeedMult: number;
    /**
     * .45 in the Chamber: each .45 ACP bullet has a 0.166 chance to be empowered, x1.25 damage, x1.2 speed and no
     * spread (survev bonus_45, weaponManager.ts:875-885)
     */
    bonus45: { empoweredChance: number; empoweredDamageMult: number; empoweredSpeedMult: number };
    /** Flak Jacket: +3 frags and +2 MIRVs of bag room while held (survev flak_jacket.bonuses) */
    flakJacketBonuses: Readonly<Record<string, number>>;
    /**
     * Fabricate: every 10 s 8 explosives are rolled (frag 60, MIRV 35, strobe 5) and given one every 0.08 s up to the
     * bag's room (survev perkDefs.ts fabricate, player.ts:1846-1899; the original filled frags every 12 s)
     */
    fabricate: {
        refillInterval: number;
        giveInterval: number;
        count: number;
        weights: Readonly<Record<string, number>>;
    };
    /** 9mm Overpressure: spread x1.1, speed and range x1.2 (survev bonus_9mm; conflicts.md perk-9mm-overpressure-speed: 1.25) */
    bonus9mmSpreadMult: number;
    bonus9mmSpeedMult: number;
    bonus9mmDistanceMult: number;
    /** Small Arms: a held gun's equip speed modifier is replaced by +1 (survev small_arms.gunEquipSpeed) */
    smallArmsGunEquipSpeed: number;
    /** One With Nature: +2 speed in water instead of the -3 penalty (survev tree_climbing.waterSpeedBoost) */
    treeClimbingWaterSpeed: number;
    /**
     * Gift of the Woods regeneration in HP/s: survev's 1 HP/s (perkDefs.ts gotw.healthRegen); null ties it to the
     * tier-1 adrenaline heal rate of `rules.boostModel` (conflicts.md gotw-values). Never while downed
     * (conflicts.md gotw-while-downed).
     */
    gotwRegenRate: number | null;
    /** Inspiration: the bugle hastes teammates within 30 u for 3 s; one charge back every 8 s (survev playBugle) */
    inspirationRange: number;
    inspirationHasteDuration: number;
    bugleRechargeTime: number;
    /** Last Breath: teammates within 60 u get x1.08 bullet damage, +0.2 size and the Inspire haste for 5 s
     * (conflicts.md last-breath-duration: survev 5 s, the wikis' 6 s logged) */
    lastBreathRange: number;
    lastBreathDuration: number;
    lastBreathDamageMult: number;
    lastBreathScale: number;
    /** That Sucks: 1 bleed damage every 3 s (bleedTickRate x3), standing or downed (survev trick_drain) */
    trickDrainDamage: number;
    trickDrainInterval: number;
    /** Gabby Ghost: a random emote every 5-15 s (conflicts.md perk-gabby-interval) */
    chattyInterval: readonly [number, number];
    /** Martyrdom: 12 martyr_nades with a random velocity up to 5 (survev perkDefs martyrdom) */
    martyrdomCount: number;
    martyrdomMaxVel: number;
    /** roles that release Martyrdom grenades without the perk (survev player.ts kill: grenadier, demo) */
    martyrdomRoles: readonly string[];
    /**
     * Loot perks: a player whose perks are all non-droppable cannot pick up a loot perk once it holds this many
     * (conflicts.md perk-max-perks-rule: the 3 HUD slots; the fork refuses at 4). Holding a droppable perk swaps it.
     */
    lootPerkCap: number;
    /**
     * A promotion to a role of 4 or more perks drops every droppable loot perk first (the fork's HUD rule, survev
     * player.ts:945-953; conflicts.md perk-max-perks-rule keeps it behind this flag, off)
     */
    roleDropsLootPerks: boolean;
    /** perks beyond the original net limit (net.ts MaxPerks 8) are ignored */
    maxPerks: number;
    /**
     * Firepower lost: rounds above the normal magazine are deleted (conflicts.md perk-firepower-drop-ammo, fandom);
     * "inventory" returns them to the bag like survev.
     */
    firepowerExcess: "delete" | "inventory";
    /** Scavenger / Master Scavenger extra loot roll per destroyed obstacle (survev perkDefs scavenger lootTableConf) */
    scavengerTiers: Readonly<Record<string, string>>;
    /**
     * Pirate's Bounty (survev-only, the Gold Cutlass): a melee kill drops 3-4 rolls of `tier` at the victim, and with
     * `rareChance` one roll of `rareTier` (survev perkDefs.ts PerkProperties.pirate, player.ts:2727-2765;
     * wikigg/Pirate's_Bounty)
     */
    pirate: {
        minCount: number;
        maxCount: number;
        tier: string;
        rareChance: number;
        rareTier: string;
    };
    /** AP Rounds: armour reductions x0.8, obstacle damage x1.5 (survev perkDefs.ts:41-44; wikigg/AP_Rounds) */
    apRounds: { armorPenetration: number; obstacleMult: number };
    /** High-Velocity Rounds: bullet speed x1.4, range x1.3 (survev perkDefs.ts:141-144; wikigg/High-Velocity_Rounds) */
    highVelocity: { speedMult: number; distanceMult: number };
    /**
     * Hyperfragmentation: throws x2 speed and x1.75 aim range; its explosions' shrapnel x2 count (rounded up), x1.5
     * damage, x1.4 speed (survev perkDefs.ts:26-32, weaponManager.ts:1236-1247, explosion.ts:146-158;
     * wikigg/Hyperfragmentation)
     */
    ampedExplosives: {
        throwableRangeMult: number;
        throwableSpeedMult: number;
        shrapnelCountMult: number;
        shrapnelDamageMult: number;
        shrapnelSpeedMult: number;
    };
    /**
     * Combat Stimulants: for 5 s after the holder uses a heal or boost, its bullets deal x1.15 and its gun hits on
     * teammates heal them 6 % of the hit (survev perkDefs.ts:97-101, player.ts:1688-1705, 2423-2439)
     */
    combatStims: { bonusDamageMult: number; healPercent: number; effectDuration: number };
    /**
     * Indomitable Spirit: adrenaline decays x0.75; a fatal hit leaves 1 HP when the adrenaline covers the excess at 2
     * adrenaline per HP (survev perkDefs.ts:90-93, player.ts:1535-1541, 2493-2510; wikigg/Indomitable_Spirit)
     */
    lifeline: { decayMult: number; conversionRate: number };
}

export function defaultPerkRules(): PerkRules {
    return {
        scales: {
            leadership: 0.25,
            steelskin: 0.4,
            flak_jacket: 0.1,
            small_arms: -0.25,
            trick_size: 0.25,
            gotw: 0.2,
            // survev-only Assume Leadership (survev perkDefs.ts:9-12)
            assume_leadership: 0.15,
        },
        minBoost: { leadership: 100, assume_leadership: 50 },
        hasteSpeedBonus: 4.8,
        windwalkTriggerDistance: 5,
        windwalkDuration: 3,
        windwalkOnExplosions: true,
        takedownHealth: 25,
        takedownBoost: 25,
        takedownHasteDuration: 3,
        splinterMainDamageMult: 0.6,
        splinterSideDamageMult: 0.5,
        splinterDeviation: [0.2, 0.25],
        splinterMainOnNoSplinter: false,
        chamberedDamageMult: 1.25,
        targetingDamageMult: 1.25,
        ammoBonusDamageMult: 1.12,
        saturatedDamageMult: 1.08,
        ammoBonusStacking: true,
        bonusAssaultSpeedMult: 1.1,
        bonus45: { empoweredChance: 0.166, empoweredDamageMult: 1.25, empoweredSpeedMult: 1.2 },
        flakJacketBonuses: { frag: 3, mirv: 2 },
        fabricate: { refillInterval: 10, giveInterval: 0.08, count: 8, weights: { frag: 60, mirv: 35, strobe: 5 } },
        bonus9mmSpreadMult: 1.1,
        bonus9mmSpeedMult: 1.2,
        bonus9mmDistanceMult: 1.2,
        smallArmsGunEquipSpeed: 1,
        treeClimbingWaterSpeed: 2,
        gotwRegenRate: 1,
        inspirationRange: 30,
        inspirationHasteDuration: 3,
        bugleRechargeTime: 8,
        lastBreathRange: 60,
        lastBreathDuration: 5,
        lastBreathDamageMult: 1.08,
        lastBreathScale: 0.2,
        trickDrainDamage: 1,
        trickDrainInterval: 3,
        chattyInterval: [5, 15],
        martyrdomCount: 12,
        martyrdomMaxVel: 5,
        martyrdomRoles: ["grenadier", "demo"],
        lootPerkCap: 3,
        roleDropsLootPerks: false,
        maxPerks: 8,
        firepowerExcess: "delete",
        scavengerTiers: { scavenger: "tier_world", scavenger_adv: "tier_scavenger_adv" },
        pirate: { minCount: 3, maxCount: 4, tier: "tier_pirate", rareChance: 0.12, rareTier: "tier_pirate_rare" },
        apRounds: { armorPenetration: 0.8, obstacleMult: 1.5 },
        highVelocity: { speedMult: 1.4, distanceMult: 1.3 },
        ampedExplosives: {
            throwableRangeMult: 1.75,
            throwableSpeedMult: 2,
            shrapnelCountMult: 2,
            shrapnelDamageMult: 1.5,
            shrapnelSpeedMult: 1.4,
        },
        combatStims: { bonusDamageMult: 1.15, healPercent: 0.06, effectDuration: 5 },
        lifeline: { decayMult: 0.75, conversionRate: 2 },
    };
}

/** Ammo whose bullets the ammo perks empower (survev PerkProperties.ammoBonuses). */
export const AMMO_BONUS_PERKS: Readonly<Record<string, readonly string[]>> = {
    "9mm": ["treat_9mm", "bonus_9mm"],
    "762mm": ["treat_762"],
    "556mm": ["treat_556"],
    "12gauge": ["treat_12g"],
    "45acp": ["bonus_45"],
};

/** Perks empowering every bullet by the ammo bonus (survev isBulletSaturated: bonus_assault, treat_super). */
export const ALL_AMMO_BONUS_PERKS: readonly string[] = ["bonus_assault", "treat_super"];
