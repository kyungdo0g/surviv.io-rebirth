// Perk knobs (M7a). Perk numbers are server-side (the original client defs only carry names and sprites), so every
// value is survev's reconstruction (survev shared/defs/gameObjects/perkDefs.ts PerkProperties) unless the KB resolves
// a conflict towards the original v0.8.82 value; each line names its source. `game.rules.perks` is a mutable copy.

export interface PerkRules {
    /**
     * Size change per perk, summed and clamped to 0.75..2 (survev recalculateScale; perks.md "Size (scale) and haste").
     * gotw +0.25 (conflicts.md gotw-values: fandom and survev's first value; fork 0.2), flak_jacket +0.2
     * (conflicts.md flak-size: survev pre-fork value), steelskin +0.4, leadership +0.25, small_arms -0.25,
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
    /** side bullets x0.45 of the main bullet: 27 % each (conflicts.md perk-splinter-side-damage; fork 0.5) */
    splinterSideDamageMult: number;
    /** side bullets deviate random(0.2, 0.25) x max(spread, 1) degrees to each side (survev fireWeapon) */
    splinterDeviation: readonly [number, number];
    /** survev keeps the x0.6 main multiplier on `noSplinter` guns; the KB skips the whole perk (perk-splinter-nosplinter-main) */
    splinterMainOnNoSplinter: boolean;
    /** One in the Chamber: first and last round x1.25, not 12 gauge (survev chambered.damageMult) */
    chamberedDamageMult: number;
    /** High-Value Targets: bullet damage x1.25 against players holding a perk (survev targeting.damageMult) */
    targetingDamageMult: number;
    /** ammo perks, Hollow-points, OKAMI Bar and Last Breath: +8 % (conflicts.md ammo-perk-mult: 1.08; fork 1.12) */
    ammoBonusDamageMult: number;
    /** survev multiplies every matching bonus; the KB applies at most one 8 % bonus per bullet (ammo-bonus-stacking) */
    ammoBonusStacking: boolean;
    /** 9mm Overpressure: spread x1.1, speed and range x1.25 (conflicts.md perk-9mm-overpressure-speed; fork 1.2) */
    bonus9mmSpreadMult: number;
    bonus9mmSpeedMult: number;
    bonus9mmDistanceMult: number;
    /** Small Arms: a held gun's equip speed modifier is replaced by +1 (survev small_arms.gunEquipSpeed) */
    smallArmsGunEquipSpeed: number;
    /** One With Nature: +2 speed in water instead of the -3 penalty (survev tree_climbing.waterSpeedBoost) */
    treeClimbingWaterSpeed: number;
    /**
     * Gift of the Woods regeneration in HP/s; null ties it to the tier-1 adrenaline heal rate of `rules.boostModel`
     * (conflicts.md gotw-values: 1 HP/s with fandom's boost table, 0.5 with survev's). Never while downed
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
    /** perks beyond the original net limit (net.ts MaxPerks 8) are ignored */
    maxPerks: number;
    /**
     * Firepower lost: rounds above the normal magazine are deleted (conflicts.md perk-firepower-drop-ammo, fandom);
     * "inventory" returns them to the bag like survev.
     */
    firepowerExcess: "delete" | "inventory";
    /** Scavenger / Master Scavenger extra loot roll per destroyed obstacle (survev perkDefs scavenger lootTableConf) */
    scavengerTiers: Readonly<Record<string, string>>;
}

export function defaultPerkRules(): PerkRules {
    return {
        scales: {
            leadership: 0.25,
            steelskin: 0.4,
            flak_jacket: 0.2,
            small_arms: -0.25,
            trick_size: 0.25,
            gotw: 0.25,
        },
        minBoost: { leadership: 100 },
        hasteSpeedBonus: 4.8,
        windwalkTriggerDistance: 5,
        windwalkDuration: 3,
        windwalkOnExplosions: true,
        takedownHealth: 25,
        takedownBoost: 25,
        takedownHasteDuration: 3,
        splinterMainDamageMult: 0.6,
        splinterSideDamageMult: 0.45,
        splinterDeviation: [0.2, 0.25],
        splinterMainOnNoSplinter: false,
        chamberedDamageMult: 1.25,
        targetingDamageMult: 1.25,
        ammoBonusDamageMult: 1.08,
        ammoBonusStacking: false,
        bonus9mmSpreadMult: 1.1,
        bonus9mmSpeedMult: 1.25,
        bonus9mmDistanceMult: 1.25,
        smallArmsGunEquipSpeed: 1,
        treeClimbingWaterSpeed: 2,
        gotwRegenRate: null,
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
        maxPerks: 8,
        firepowerExcess: "delete",
        scavengerTiers: { scavenger: "tier_world", scavenger_adv: "tier_scavenger_adv" },
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
