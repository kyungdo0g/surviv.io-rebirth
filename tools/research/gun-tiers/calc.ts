// Shot timing, falloff, range jitter and armour for the gun-tier model (model.ts). A subset of the session's balance
// calculator, which mirrors packages/sim and was checked against the 444 survev TTK fixture cases; every rule cites
// the sim file it mirrors.

/** combat/bullets.ts: bullets move in 0.01 s steps (TICK_HZ 100). */
export const TICK_DT = 0.01;
/** GameConfig.player.radius: bullets hit a circle of this radius. */
export const PLAYER_RAD = 1;
/** combat/bullets.ts: range += remap(int(0..16), 0, 16, -1, 1) unless the bullet is noDistAdj. */
const DIST_ADJ_STEPS = 16;
/** rules.ts noDistAdjBullets (survev bulletDefs noDistAdj); a def's own `noDistAdj: true` also counts. */
const NO_DIST_ADJ = ["bullet_buckshot", "bullet_flechette", "bullet_frag", "bullet_birdshot"];

export interface GunDefLike {
    fireMode: string;
    maxClip: number;
    maxReload: number;
    maxReloadAlt?: number;
    reloadTime: number;
    reloadTimeAlt?: number;
    fireDelay: number;
    burstCount?: number;
    burstDelay?: number;
    switchDelay: number;
    shotSpread: number;
    moveSpread: number;
    barrelLength: number;
    barrelOffset?: number;
    isDual?: boolean;
    dualOffset?: number;
    recoilTime?: number;
    bulletCount: number;
    jitter?: number;
    headshotMult: number;
    bulletType: string;
    /** rebirth: total shots, no reload */
    charges?: number;
    /** rebirth (DP-12): shots per pump, then pumpDelay instead of fireDelay */
    pumpEvery?: number;
    pumpDelay?: number;
    /** rebirth (M202): a fixed fan this many degrees wide */
    fanAngle?: number;
}

export interface BulletDefLike {
    damage: number;
    falloff: number;
    distance: number;
    speed: number;
    noDistAdj?: boolean;
}

export interface ArmorLevel {
    helmet: number;
    chest: number;
}

/**
 * Damage dealt after the head multiplier and armour (combat/damage.ts computeDamage): x headshotMult on a headshot,
 * then `d -= d * chest` on body hits only, then `d -= d * helmet * (head ? 1 : 0.3)`.
 */
export function afterArmor(amount: number, head: boolean, headshotMult: number, armor: ArmorLevel): number {
    let d = amount;
    if (head) d *= headshotMult;
    if (!head) d -= d * armor.chest;
    d -= d * armor.helmet * (head ? 1 : 0.3);
    return d;
}

/** Distance from the muzzle to the near surface of a target `d` away, head-on (weapons/gun.ts: start = barrel end). */
export function hitDistance(gun: GunDefLike, d: number): number {
    return Math.max(0, d - gun.barrelLength - PLAYER_RAD);
}

/**
 * Bullet damage when it reaches a target `d` away (combat/bullets.ts): damage x lerp(t, 1, falloff), t = distance
 * travelled / range, read at the end of the tick in which the bullet crossed the body.
 */
export function bulletDamageAt(gun: GunDefLike, bullet: BulletDefLike, d: number): number {
    const D = bullet.distance;
    if (D <= 0) return 0;
    const step = Math.max(bullet.speed * TICK_DT, 1e-6);
    const ticks = Math.floor(hitDistance(gun, d) / step + 1e-9) + 1;
    const t = Math.min(1, Math.max(0, Math.min(D, ticks * step) / D));
    return bullet.damage * (1 + (bullet.falloff - 1) * t);
}

/** Share of bullets whose range reaches the target (combat/bullets.ts: range = distance + distAdj). */
export function rangeShare(gun: GunDefLike, bullet: BulletDefLike, d: number): number {
    const hd = hitDistance(gun, d);
    if (bullet.noDistAdj || NO_DIST_ADJ.includes(gun.bulletType)) return hd <= bullet.distance ? 1 : 0;
    let n = 0;
    for (let i = 0; i <= DIST_ADJ_STEPS; i++) if (bullet.distance - 1 + (2 * i) / DIST_ADJ_STEPS >= hd) n++;
    return n / (DIST_ADJ_STEPS + 1);
}

/** One reload action from `ammo` rounds (weapons/weaponManager.ts): the empty Mosin uses its alt reload. */
function reloadAction(gun: GunDefLike, ammo: number): { time: number; rounds: number } {
    const space = gun.maxClip - ammo;
    if (gun.reloadTimeAlt && ammo === 0) {
        return { time: gun.reloadTimeAlt, rounds: Math.min(gun.maxReloadAlt ?? gun.maxReload, space) };
    }
    return { time: gun.reloadTime, rounds: Math.min(gun.maxReload, space) };
}

/** Seconds to refill an empty magazine (shell guns chain their reload actions); Infinity for charge guns. */
export function fullReloadTime(gun: GunDefLike): number {
    if (gun.charges) return Number.POSITIVE_INFINITY;
    let ammo = 0;
    let t = 0;
    for (let i = 0; i < 1000 && ammo < gun.maxClip; i++) {
        const a = reloadAction(gun, ammo);
        if (a.rounds <= 0) break;
        t += a.time;
        ammo += a.rounds;
    }
    return t;
}

/** Delay after shot number `k` (1-based) of a run (weaponManager.ts: burst and pump cadence). */
function delayAfterShot(gun: GunDefLike, k: number): number {
    if (gun.fireMode === "burst") {
        const c = gun.burstCount ?? 1;
        return k % c === 0 ? gun.fireDelay : (gun.burstDelay ?? 0);
    }
    if (gun.pumpEvery && gun.pumpDelay !== undefined) return k % gun.pumpEvery === 0 ? gun.pumpDelay : gun.fireDelay;
    return gun.fireDelay;
}

/**
 * Times (s) of the first `n` shots of a run from a full magazine at t = 0. Firing resumes after one reload action
 * (a shell gun fires after each shell); charge guns cannot fire past their charges (Infinity).
 */
export function shotTimes(gun: GunDefLike, n: number): number[] {
    const out: number[] = [];
    let ammo = gun.charges ?? gun.maxClip;
    let t = 0;
    let runShot = 0;
    while (out.length < n) {
        if (ammo <= 0) {
            if (gun.charges) {
                while (out.length < n) out.push(Number.POSITIVE_INFINITY);
                break;
            }
            const a = reloadAction(gun, 0);
            t += a.time;
            ammo = a.rounds;
            runShot = 0;
        }
        out.push(t);
        ammo--;
        runShot++;
        t += delayAfterShot(gun, runShot);
    }
    return out;
}

/** Average seconds per shot at the maximum rate, without reloads (bursts and pumps averaged). */
export function shotInterval(gun: GunDefLike): number {
    if (gun.fireMode === "burst") {
        const c = gun.burstCount ?? 1;
        return ((c - 1) * (gun.burstDelay ?? 0) + gun.fireDelay) / c;
    }
    if (gun.pumpEvery && gun.pumpDelay !== undefined) {
        return ((gun.pumpEvery - 1) * gun.fireDelay + gun.pumpDelay) / gun.pumpEvery;
    }
    return gun.fireDelay;
}

/** Seconds from the first shot until the magazine (or the charges) is empty and a reload may start. */
export function magazineDumpTime(gun: GunDefLike): number {
    const clip = gun.charges ?? gun.maxClip;
    const times = shotTimes({ ...gun, charges: clip }, clip);
    return times[clip - 1] + delayAfterShot(gun, clip);
}
