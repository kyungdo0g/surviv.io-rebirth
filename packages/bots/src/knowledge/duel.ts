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

/** Sideways speed of a fighting target the bullet's flight has to guess (u/s): half of a strafe at running speed. */
const DODGE_SPEED = 3.5;

const falloffCache = new Map<string, number>();

/** Damage share a gun's bullet keeps at its full range (bullet def `falloff`, 1 without). */
function bulletFalloff(gun: GunInfo): number {
    let f = falloffCache.get(gun.id);
    if (f === undefined) {
        const b = hasDef(gun.def.bulletType) ? (GameObjectDefs[gun.def.bulletType] as { falloff?: number }) : {};
        f = GameConfig.bullet.falloff ? (b.falloff ?? 1) : 1;
        falloffCache.set(gun.id, f);
    }
    return f;
}

/** What `expectedTtk` assumes about the shot (aim error, the target's armour and health). */
export interface TtkOptions {
    /** the shooter's effective aim error, degrees (skill.ts skillSigma) */
    sigmaDeg: number;
    helmet?: string;
    chest?: string;
    /** the target's health (100) */
    health?: number;
    /** fired while moving (default: firedMoving, long guns stand still beyond 20 u) */
    moving?: boolean;
}

/** Shots `gun` needs on average to kill at `dist` (Infinity when it cannot hit). */
export function shotsToKill(gun: GunInfo, dist: number, o: TtkOptions): number {
    if (dist > gun.range) return Number.POSITIVE_INFINITY;
    // the target moves while the bullet flies: slow bullets miss more at range (guns.md bullet speeds)
    const flight = dist / Math.max(gun.bulletSpeed, 1);
    const dodgeDeg = (Math.atan2(DODGE_SPEED * flight, Math.max(dist, 1)) * 180) / Math.PI;
    const sigma = Math.hypot(o.sigmaDeg, dodgeDeg);
    const p = hitChance(gun, dist, sigma, o.moving ?? firedMoving(gun, dist));
    if (p <= 1e-4) return Number.POSITIVE_INFINITY;
    // damage falls off linearly to `falloff` at the bullet's range (sim combat/bullets.ts, GameConfig.bullet.falloff)
    const end = bulletFalloff(gun);
    const falloff = end + (1 - end) * (1 - Math.min(1, dist / Math.max(gun.range, 1)));
    const health = o.health ?? 100;
    const body = (1 - damageReduction(o.chest ?? "")) * (1 - 0.3 * damageReduction(o.helmet ?? ""));
    if (gun.def.bulletCount > 1) {
        // a shell lands its pellets by chance: whole shells of the expected damage
        const perShell =
            gun.def.bulletCount * p * gun.damage * falloff * armourFactor(o.helmet ?? "", o.chest ?? "", 1);
        return perShell > 1e-6 ? Math.ceil(health / perShell - 1e-9) : Number.POSITIVE_INFINITY;
    }
    // whole body hits (gunTiers bodyHitsToKill: a Mosin needs 3 through level 1 armour), each landing with chance p
    const perHit = gun.damage * falloff * body;
    if (perHit <= 1e-6) return Number.POSITIVE_INFINITY;
    return Math.ceil(health / perHit - 1e-9) / p;
}

/**
 * Expected seconds for `gun`, holding `mag` rounds with `reserve` in the bag, to kill a player at `dist`: the shots it
 * needs (shotsToKill) at the gun's cycle, plus the reloads to get them (a reload first when the magazine is empty).
 * The one time-to-kill model of the bots (bot overhaul LOOT-10, critique C6): the weapon to fight with
 * (arsenal.ts fightSlot) and the fight assessment (brain/assess.ts) both use it. Infinity when the rounds run out
 * first or the gun cannot hit.
 */
export function expectedTtk(gun: GunInfo, mag: number, reserve: number, dist: number, o: TtkOptions): number {
    const shots = shotsToKill(gun, dist, o);
    if (!Number.isFinite(shots) || shots > mag + reserve + 1e-9) return Number.POSITIVE_INFINITY;
    let t = Math.max(0, shots - 1) * gun.cycle;
    if (shots > mag) {
        const clip = Math.max(1, gun.def.maxClip);
        const missing = shots - mag;
        // per-shell guns reload `maxReload` rounds at a time; magazines refill whole
        const perReload = Math.max(1, gun.def.maxReload || clip);
        const reloads = Math.ceil(missing / perReload - 1e-9);
        t += reloads * gun.def.reloadTime;
    }
    return t;
}
