// Gameplay knobs whose original v0.8.82 value is not in the client data (server-only logic reconstructed by survev)
// or where the KB proposes a value that differs from survev. Every Game owns a mutable copy (`game.rules`), so tests
// and tools can switch a rule without touching the defaults.
import { GameConfig } from "@rebirth/defs";

export interface SimRules {
    /** chance that a bullet or melee hit is a headshot (survev gameConfig.ts headshotChance 0.15) */
    headshotChance: number;
    /**
     * Original rule: only sources with `headshotMult > 1` roll headshots, so the AWM-S, USAS-12, potato cannon,
     * bugle and every melee weapon never headshot. survev rolls for any `headshotMult` (fork commit c30b8d9a).
     * See docs/research/mechanics/damage-armor.md (CONFLICT headshot-mult-1-rule).
     */
    headshotNeedsMultAboveOne: boolean;
    /** Cast Ironskin reduction: 0.5 in 0.8.82, 0.45 in survev (damage-armor.md CONFLICT steelskin-reduction) */
    steelskinReduction: number;
    /** Flak Jacket reduction against non-explosion hits (survev perkDefs.ts flak_jacket.damageReduction) */
    flakJacketReduction: number;
    /** Flak Jacket reduction against explosions and shrapnel (survev perkDefs.ts explosionDamageReduction) */
    flakJacketExplosionReduction: number;
    /**
     * Bullets without the ±1 unit random range jitter. The original defs have no flag for it; survev marks shotgun
     * pellets `noDistAdj` (bulletDefs.ts) because pellets already scatter (bullets.md CONFLICT shotgun-distadj).
     */
    noDistAdjBullets: readonly string[];
    /**
     * survev's time-in-gas escalation: each gas tick deals `damage * (1 + gasDamageRampRate * timeInsideGas)`.
     * A 2026 fork addition with no trace in original sources (gas.md / conflicts.md CONFLICT gas-escalation): off.
     */
    gasDamageRamp: boolean;
    gasDamageRampRate: number;
    /** timeInsideGas only accumulates from this circle on (survev player.ts: circleIdx > 2) */
    gasDamageRampFromCircle: number;
    /**
     * Damage of a landing air drop crate. conflicts.md airdrop-crush-damage: the client-visible
     * GameConfig.airdrop.crushDamage (100) through the Flak Jacket / Cast Ironskin reductions; survev applies 1e10.
     */
    airdropCrushDamage: number;
    /** survev's instant kill (1e10) instead of `airdropCrushDamage` */
    airdropCrushInstantKill: boolean;
    /** whether helmets and vests reduce the crush damage (open question in the KB; off) */
    airdropCrushArmor: boolean;
    /** seconds after the start during which players may still join (survev game.ts canJoin: startedTime < 60) */
    joinWindowSeconds: number;
    /** kills needed to become kill leader (GameConfig.player.killLeaderMinKills) */
    killLeaderMinKills: number;
    /**
     * Seconds a player must have been alive to count for the start condition; a player leaving before that despawns
     * instead of staying in the game (survev player.ts canDespawn, GameConfig.player.minActiveTime).
     */
    minActiveTime: number;
    /** a spectator watching a player that died switches to another one after this many seconds (survev client.ts) */
    spectateSwitchDelay: number;
    /** cooldown of spectate next/prev when not watching teammates (survev client.ts getSpectateCooldown) */
    spectateCooldown: number;
    /**
     * Explosion damage falloff (conflicts.md explosion-falloff-curve): "step" = full damage inside rad.min (or when
     * the target touches the rad.min circle), else damage x (1 - dist / rad.max) (survev's current curve, "what
     * surviv used from the data we got"); "smooth" = linear from rad.min to rad.max (survev before 7a59be97).
     */
    explosionFalloff: "step" | "smooth";
    /**
     * Flak Jacket also applies its general reduction to explosions (fandom's 91 %); survev applies only the 0.9
     * explosion reduction (conflicts.md flak-explosion-reduction, unresolved: survev value, matches damage.json).
     */
    flakJacketStacksOnExplosions: boolean;
    /**
     * Boost heal rates per tier (conflicts.md boost-heal-tiers, open): "code" = survev boostHealAmounts
     * 0.5 / 1.25 / 1.5 / 1.75 HP/s, "wiki" = fandom 1 / 3.75 / 4.75 / 5 HP/s. Decay and speed bonus are the same.
     */
    boostModel: "code" | "wiki";
    /** Mass Medicate item use time multiplier (conflicts.md medic-use-time: x0.8 per two wikis; survev x0.75) */
    aoeHealUseTimeMult: number;
    /** Combat Medic: no slowdown while using items, plus this speed (survev perkDefs field_medic.speedBoost) */
    fieldMedicSpeedBonus: number;
    /** seconds a smoke emitter stays active; its clouds vanish then (conflicts.md smoke-duration: survev 16 s) */
    smokeDuration: number;
    /**
     * Rebirth rule: players whose centre is inside a smoke cloud are left out of other players' snapshots unless
     * the viewer is within `smokeRevealDistance` (the original only draws the smoke above them, so a modified
     * client could see through it).
     */
    smokeHidesPlayers: boolean;
    smokeRevealDistance: number;
    /**
     * Sideways offset between a strobe's strike lines (conflicts.md strobe-airstrike-offset: all on the strobe line
     * for 0.8.82; survev offsets 0 / 5 / 5 / 10 / 10)
     */
    strobeAirstrikeOffset: number;
    /** survev picks the side of the first offset strike at random ("was not in surviv"); off */
    strobeRandomSide: boolean;
    /**
     * Broken Arrow's extra strikes are counted when the strike warning appears (fandom; conflicts.md
     * broken-arrow-check-time) instead of when the strobe is thrown (survev)
     */
    brokenArrowAtPing: boolean;
    /** bullets whose Explosive Rounds use the quieter explosion_rounds_sg (survev bullet useExplosiveRoundsAlt) */
    explosiveRoundsAltBullets: readonly string[];
    /** Fabricate fills the pack with frag grenades every this many seconds (original rule, fandom Fabricate) */
    fabricateInterval: number;
    /**
     * Circle and wait overrides of MapDef gameConfig.unlocks timings, by unlocked type (conflicts.md
     * twins-unlock-time: the original twins bunker opened 0:45 into the third waiting phase, circle 2 + 5 s; the ported
     * cobalt def holds survev's fork timing, circle 1 + 30 s). `{}` restores the def timings.
     */
    unlockOverrides: Readonly<Record<string, { circleIdx: number; wait: number }>>;
    /**
     * Rebirth rule: players and loot on the other floor (layer 0 vs 1) are left out of snapshots while neither the
     * viewer nor the object is on stairs. The original sent every object in view but its client never draws the other
     * floor, so this only hides what a modified client could reveal.
     */
    cullOtherFloors: boolean;
    /**
     * Bleed escalation on maps whose `bleedDamageMult` is not 1 (Faction; conflicts.md bleed-escalation-shape):
     * "linear" = bleedDamage x downedCount x mult (survev), "compound" = bleedDamage x mult^downedCount (survev's first
     * implementation, closer to wiki.gg's "25 % faster than the previous time").
     */
    bleedEscalation: "linear" | "compound";
    /** invulnerability right after being downed (GameConfig.player.downedDamageBuffer 0.1 s; oracle revive.json) */
    downedDamageBuffer: number;
    /**
     * Players downed once the red zone has fully closed (radius <= 0.1) get 50 HP instead of 100 (survev 2025 fix
     * against endless Revivify loops; conflicts.md down-health-50: not in 0.8.82, off).
     */
    downHealthFinalCircle: boolean;
    /** survev adds the forced melee's equip bonus while downed (conflicts.md downed-melee-equip-bonus: off) */
    downedEquipBonus: boolean;
    /**
     * Reviver speed (conflicts.md reviver-speed): "half" = the normal speed formula x 0.5 (fandom "0.5x speed
     * multiplier"), "survev" = downedMoveSpeed + 2 plus the weapon's equip speed (survev's self-declared estimate).
     */
    reviverSpeed: "half" | "survev";
    /**
     * A teammate's completed revive of a Mass Medicate medic also revives the downed teammates in the medic's 6 unit
     * aura (conflicts.md medic-revived-aoe: wikis and the original client's aura; survev only on the medic's own revives).
     */
    medicRevivedAoe: boolean;
    /** seconds between team status refreshes: positions, dead, downed (original PlayerStatus rate, net.ts 0.25 s) */
    teamStatusInterval: number;
}

export function defaultRules(): SimRules {
    return {
        headshotChance: GameConfig.player.headshotChance,
        headshotNeedsMultAboveOne: true,
        steelskinReduction: 0.5,
        flakJacketReduction: 0.1,
        flakJacketExplosionReduction: 0.9,
        noDistAdjBullets: ["bullet_buckshot", "bullet_flechette", "bullet_frag", "bullet_birdshot"],
        gasDamageRamp: false,
        gasDamageRampRate: 0.025,
        gasDamageRampFromCircle: 3,
        airdropCrushDamage: GameConfig.airdrop.crushDamage,
        airdropCrushInstantKill: false,
        airdropCrushArmor: false,
        joinWindowSeconds: 60,
        killLeaderMinKills: GameConfig.player.killLeaderMinKills,
        minActiveTime: GameConfig.player.minActiveTime,
        spectateSwitchDelay: 2,
        spectateCooldown: 1,
        explosionFalloff: "step",
        flakJacketStacksOnExplosions: false,
        boostModel: "code",
        aoeHealUseTimeMult: 0.8,
        fieldMedicSpeedBonus: 1,
        smokeDuration: 16,
        smokeHidesPlayers: true,
        smokeRevealDistance: 5,
        strobeAirstrikeOffset: 0,
        strobeRandomSide: false,
        brokenArrowAtPing: true,
        explosiveRoundsAltBullets: ["bullet_buckshot", "bullet_flechette", "bullet_frag", "bullet_birdshot"],
        fabricateInterval: 12,
        unlockOverrides: { bunker_twins_sublevel_01: { circleIdx: 2, wait: 5 } },
        cullOtherFloors: true,
        bleedEscalation: "linear",
        downedDamageBuffer: GameConfig.player.downedDamageBuffer,
        downHealthFinalCircle: false,
        downedEquipBonus: false,
        reviverSpeed: "half",
        medicRevivedAoe: true,
        teamStatusInterval: 0.25,
    };
}

/** Heal rate in HP/s of each boost tier under `model` (boost.md "Tier table: code vs wikis"). */
export function boostHealAmounts(model: SimRules["boostModel"]): readonly number[] {
    return model === "wiki" ? [1, 3.75, 4.75, 5] : GameConfig.player.boostHealAmounts;
}
