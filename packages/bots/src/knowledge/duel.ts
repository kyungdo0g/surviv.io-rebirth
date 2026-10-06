// Duel arithmetic for the fight assessment (brain/assess.ts): expected damage of one bullet against a player's armour,
// the chance that a bullet hits a player-sized target at a distance given the gun's spread and an aim error, and the
// damage per second that follows. Values come from the defs: armour damageReduction, gun spread, bullet damage,
// headshotChance (GameConfig.player), and the damage pipeline of sim/src/combat/damage.ts (chest on body hits,
// helmet x1 on the head and x0.3 on the body; docs/research/mechanics/damage-armor.md).
import { GameConfig, GameObjectDefs, hasDef } from "@rebirth/defs";
import type { GunInfo } from "./weapons.ts";

const DEG = Math.PI / 180;
const PLAYER_RAD = GameConfig.player.radius;
const HEADSHOT_CHANCE = GameConfig.player.headshotChance;
/** fists (melee) damage and cooldown, for unarmed fighters (defs "fists": damage 24, cooldownTime 0.25) */
const FIST_DPS = 24 / 0.25;
const FIST_REACH = 2.4;
/** an armed player backs off from fists: the unarmed one closes in at about this speed (u/s) */
const FIST_CLOSING = 4;

/** damageReduction of an armour piece (0 for none). */
export function damageReduction(id: string): number {
    if (!id || !hasDef(id)) return 0;
    return (GameObjectDefs[id] as { damageReduction?: number }).damageReduction ?? 0;
}

/** Expected damage of one bullet over its raw damage against this armour (headshots included, 1.15 unarmoured). */
export function armourFactor(helmet: string, chest: string, headshotMult = 2): number {
    const h = damageReduction(helmet);
    const c = damageReduction(chest);
    const body = (1 - HEADSHOT_CHANCE) * (1 - c) * (1 - 0.3 * h);
    const head = HEADSHOT_CHANCE * headshotMult * (1 - h);
    return body + head;
}

/** Error function (Abramowitz-Stegun 7.1.26, |error| < 1.5e-7). */
export function erf(x: number): number {
    const s = x < 0 ? -1 : 1;
    const a = Math.abs(x);
    const t = 1 / (1 + 0.3275911 * a);
    const y =
        1 -
        ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) *
            t *
            Math.exp(-a * a);
    return s * y;
}

/**
 * Chance that one bullet (pellet) of `gun` hits a player at `dist`: the target's half angle against the combined
 * deviation of a normal aim error (`aimSigmaDeg`) and the gun's uniform spread (+ move spread while moving).
 */
export function hitChance(gun: GunInfo, dist: number, aimSigmaDeg: number, moving: boolean): number {
    if (dist > gun.range) return 0;
    const half = Math.atan2(PLAYER_RAD, Math.max(dist, 0.5));
    const spread = (gun.def.shotSpread + (moving ? gun.def.moveSpread : 0)) * DEG;
    // a uniform deviation over [-spread/2, spread/2] has variance spread^2 / 12
    const sigma = Math.sqrt((aimSigmaDeg * DEG) ** 2 + (spread * spread) / 12);
    if (sigma < 1e-6) return 1;
    return erf(half / (sigma * Math.SQRT2));
}

/** Expected raw damage per second (before armour) of `gun` against a player at `dist`, magazine permitting. */
export function rawDps(gun: GunInfo, dist: number, aimSigmaDeg: number, moving: boolean): number {
    return (gun.damage * gun.def.bulletCount * hitChance(gun, dist, aimSigmaDeg, moving)) / gun.cycle;
}

/** Damage per second of fists at `dist` (0 out of reach; about half the swings land). */
export function fistDps(dist: number): number {
    return dist <= FIST_REACH + 0.6 ? FIST_DPS * 0.5 : 0;
}

/** Seconds an unarmed player needs to walk into punching reach of an armed one `dist` away. */
export function fistClosing(dist: number): number {
    return Math.max(0, dist - FIST_REACH) / FIST_CLOSING;
}

/** Long guns are fired standing still at range (DifficultyParams.standStillChance): no move spread then. */
export function firedMoving(gun: GunInfo, dist: number): boolean {
    return !((gun.cls === "sniper" || gun.cls === "dmr") && dist > 20);
}

/** Seconds to put another magazine in: one reload, or a few for guns that load shell by shell. */
export function reloadSeconds(gun: GunInfo, roundsWanted: number): number {
    const perReload = Math.max(1, gun.def.maxReload || gun.def.maxClip);
    return gun.def.reloadTime * Math.min(3, Math.ceil(Math.max(1, roundsWanted) / perReload));
}
