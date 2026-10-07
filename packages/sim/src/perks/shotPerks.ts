// Perk modifiers of one gun shot (M7a; the survev-only Combat Stimulants, High-Velocity and AP Rounds since the survev
// content wave): damage multipliers (Splinter main bullet, the ammo / Hollow-points / OKAMI Bar / Last Breath bonuses,
// One in the Chamber), 9mm Overpressure's spread, speed and range, Hollow-points' speed, the tracer flags, .45 in the
// Chamber's empowered rounds and Splinter Rounds' side bullets. Behaviour follows survev server/src/game/weaponManager.ts isBulletSaturated and
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
    /** AP Rounds bullets (survev-only perk) */
    apRounds: boolean;
    /** .45 in the Chamber: each .45 ACP bullet may be empowered (rules.perks.bonus45) */
    bonus45: boolean;
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
        apRounds: false,
        bonus45: false,
    };
    if (player.perks.length === 0 && player.lastBreathTicker <= 0 && player.combatStimsTicker <= 0) return out;
    if (player.hasPerk("splinter")) {
        // noSplinter guns (USAS-12, flare guns, potato guns, bugle) skip the perk (conflicts.md perk-splinter-nosplinter-main)
        out.splinter = !def.noSplinter;
        if (out.splinter || rules.splinterMainOnNoSplinter) out.damageMult *= rules.splinterMainDamageMult;
    }
    const bonuses = ammoBonusCount(player, def.ammo);
    if (bonuses > 0) {
        out.damageMult *= rules.ammoBonusStacking ? saturationMult(player, def.ammo, rules) : rules.saturatedDamageMult;
        out.saturated = true;
    }
    // Combat Stimulants: x1.15 for 5 s after a heal or boost (survev weaponManager.ts:830-832)
    if (player.combatStimsTicker > 0) out.damageMult *= rules.combatStims.bonusDamageMult;
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
    // survev-only perks: High-Velocity Rounds x1.4 speed, x1.3 range; AP Rounds (survev weaponManager.ts:812-866)
    if (player.hasPerk("high_velocity")) {
        out.speedMult *= rules.highVelocity.speedMult;
        out.distanceMult *= rules.highVelocity.distanceMult;
    }
    // Hollow-points: x1.1 bullet speed (survev weaponManager.ts:868-870)
    if (player.hasPerk("bonus_assault")) out.speedMult *= rules.bonusAssaultSpeedMult;
    out.apRounds = player.hasPerk("ap_rounds");
    out.bonus45 = def.ammo === "45acp" && player.hasPerk("bonus_45");
    return out;
}

/**
 * survev isBulletSaturated: Last Breath x1.08, Hollow-points / OKAMI Bar x1.08, and x1.12 for each held perk of the
 * bullet's ammo, multiplied together (weaponManager.ts:692-713).
 */
function saturationMult(player: Player, ammo: string, rules: PerkRules): number {
    let mult = player.lastBreathTicker > 0 ? rules.lastBreathDamageMult : 1;
    if (ALL_AMMO_BONUS_PERKS.some((p) => player.hasPerk(p))) mult *= rules.saturatedDamageMult;
    const ammoPerks = AMMO_BONUS_PERKS[ammo];
    if (ammoPerks) for (const p of player.perks) if (ammoPerks.includes(p)) mult *= rules.ammoBonusDamageMult;
    return mult;
}
