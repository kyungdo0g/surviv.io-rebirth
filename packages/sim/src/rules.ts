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
}

export function defaultRules(): SimRules {
    return {
        headshotChance: GameConfig.player.headshotChance,
        headshotNeedsMultAboveOne: true,
        steelskinReduction: 0.5,
        flakJacketReduction: 0.1,
        flakJacketExplosionReduction: 0.9,
        noDistAdjBullets: ["bullet_buckshot", "bullet_flechette", "bullet_frag", "bullet_birdshot"],
    };
}
