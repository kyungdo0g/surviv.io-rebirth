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
    };
}
