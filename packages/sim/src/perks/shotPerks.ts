// Perk modifiers of one gun shot (M7a): damage multipliers (Splinter main bullet, the 8 % ammo / Hollow-points /
// OKAMI Bar / Last Breath bonus, One in the Chamber), 9mm Overpressure's spread, speed and range, the tracer flags,
// and Splinter Rounds' side bullets. Behaviour follows survev server/src/game/weaponManager.ts isBulletSaturated and
// the "Perks" block of fireWeapon, with the KB's conflict resolutions in rules.perks (perks.md "Damage multipliers and
// stacking").
import type { GunDef } from "@rebirth/defs";
import type { Player } from "../world/player.ts";
import { ALL_AMMO_BONUS_PERKS, AMMO_BONUS_PERKS, type PerkRules } from "./perkRules.ts";

export interface ShotPerks {
    damageMult: number;
    spreadMult: number;
    speedMult: number;
    distanceMult: number;
    /** darker tracer (trailSaturated) */
    saturated: boolean;
    /** thick tracer (trailThick: One in the Chamber) */
    thick: boolean;
    /** fire the two Splinter Rounds side bullets */
    splinter: boolean;
}

/**
 * Number of 8 % bonuses a bullet of `ammo` gets: Last Breath, Hollow-points or OKAMI Bar, and every held perk of that
 * ammo (survev isBulletSaturated).
 */
export function ammoBonusCount(player: Player, ammo: string): number {
    let n = player.lastBreathTicker > 0 ? 1 : 0;
    if (ALL_AMMO_BONUS_PERKS.some((p) => player.hasPerk(p))) n++;
    const ammoPerks = AMMO_BONUS_PERKS[ammo];
    if (ammoPerks) for (const p of player.perks) if (ammoPerks.includes(p)) n++;
    return n;
}

/**
 * Modifiers of a shot of `def` fired by `player`; `ammoLeft` is the magazine after this round left it, `maxClip` the
 * magazine size (One in the Chamber: the first and the last round; never 12 gauge, since 0.8.8).
 */
export function shotPerks(player: Player, def: GunDef, ammoLeft: number, maxClip: number, rules: PerkRules): ShotPerks {
    const out: ShotPerks = {
        damageMult: 1,
        spreadMult: 1,
        speedMult: 1,
        distanceMult: 1,
        saturated: false,
        thick: false,
        splinter: false,
    };
    if (player.perks.length === 0 && player.lastBreathTicker <= 0) return out;
    if (player.hasPerk("splinter")) {
        // noSplinter guns (USAS-12, flare guns, potato guns, bugle) skip the perk (conflicts.md perk-splinter-nosplinter-main)
        out.splinter = !def.noSplinter;
        if (out.splinter || rules.splinterMainOnNoSplinter) out.damageMult *= rules.splinterMainDamageMult;
    }
    const bonuses = ammoBonusCount(player, def.ammo);
    if (bonuses > 0) {
        // at most one 8 % bonus per bullet unless survev's stacking is chosen (conflicts.md ammo-bonus-stacking)
        out.damageMult *= rules.ammoBonusDamageMult ** (rules.ammoBonusStacking ? bonuses : 1);
        out.saturated = true;
    }
    const chambered = player.hasPerk("chambered") && def.ammo !== "12gauge";
    if (chambered && (ammoLeft === 0 || ammoLeft === maxClip - 1)) {
        out.damageMult *= rules.chamberedDamageMult;
        out.saturated = true;
        out.thick = true;
    }
    if (def.ammo === "9mm" && player.hasPerk("bonus_9mm")) {
        out.spreadMult *= rules.bonus9mmSpreadMult;
        out.speedMult *= rules.bonus9mmSpeedMult;
        out.distanceMult *= rules.bonus9mmDistanceMult;
    }
    return out;
}
