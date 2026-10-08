// Kill-time model of the gun-tier rebuild (compute.ts; docs/design/gun-tiers.md 2.3-2.4). Pure functions, no I/O.
// Timing (bursts, pumps, reloads, the Mosin's alt reload, charges), falloff, range jitter and armour come from calc.ts.
// On top: an aim error (normal, per shot, shared by the pellets of a shell) over the gun's uniform spread, the
// target's dodge against slow bullets, dual and barrel offsets, exploding rounds and projectiles with shrapnel, cursor
// bursts (toMouseHit), arming distances and the M202's fixed fan.
import {
    type ArmorLevel,
    afterArmor,
    type BulletDefLike,
    bulletDamageAt,
    type GunDefLike,
    hitDistance,
    rangeShare,
    shotTimes,
} from "./calc.ts";

export const HP = 100;
/** GameConfig.player.headshotChance; only headshotMult > 1 rolls (sim rules.ts headshotNeedsMultAboveOne = true) */
export const HEADSHOT_CHANCE = 0.15;
/** sideways speed of a fighting target that the bullet's flight must guess (bots knowledge/duel.ts DODGE_SPEED) */
export const DODGE_SPEED = Number(process.env.DODGE ?? 3.5);
/** pellet start jitter scale (sim weapons/gun.ts JITTER_SCALE) and default jitter */
const JITTER_SCALE = 1.11;
const DEFAULT_JITTER = 0.25;
const DEG = 180 / Math.PI;

export interface Explosive {
    /** explosion damage on a direct hit (full: the target touches the rad.min circle, sim combat/explosions.ts) */
    damage: number;
    shrapnelCount: number;
    shrapnelDamage: number;
    /** chance that one shrapnel piece hits the target of a direct hit (contact geometry averaged) */
    shrapnelP: number;
    /** blast radii (splash of cursor bursts) and the shrapnel's range and variance */
    rad: { min: number; max: number };
    shrapnelDistance: number;
    shrapnelVariance: number;
    /** the bullet's arming distance: an explosion closer than this is a dud (rebirth bullet armDistance) */
    armDistance: number;
    /**
     * toMouseHit (USAS-12, GL-06): the round stops at the cursor, so a miss bursts at the target's range (sim
     * weapons/gun.ts clipDistance, combat/bullets.ts explodeOnHit at the end of the range)
     */
    cursor: boolean;
}

/** Everything the kill model needs about one gun. */
export interface ModelGun {
    gun: GunDefLike;
    bullet: BulletDefLike;
    /** projectile guns: speed and hit radius replace the bullet's (sim combat/projectiles.ts: rad / 4 + 1) */
    speed: number;
    hitRadius: number;
    explosive?: Explosive;
    canHeadshot: boolean;
    /** first-shot accuracy guns (recoilTime < 1e9, not burst): the paced mode fires every max(fireDelay, recoilTime) */
    fsa: boolean;
}

/** Overlap share of a uniform deviation u in [-s/2, s/2] (degrees) with [lo, hi]. */
function uniformShare(lo: number, hi: number, s: number): number {
    if (s <= 1e-9) return lo <= 0 && hi >= 0 ? 1 : 0;
    const a = Math.max(lo, -s / 2);
    const b = Math.min(hi, s / 2);
    return b > a ? (b - a) / s : 0;
}

/**
 * Chance that one pellet hits when the shot's systematic angular error is `a` degrees: the target (radius R) at muzzle
 * distance D subtends +-h; the pellet adds the gun's uniform spread and, for pellets after the first, the start jitter
 * seen from the target (lateral +-J x 1.11 over D).
 */
function pelletP(a: number, lo: number, hi: number, spread: number, jitterDeg: number): number {
    if (jitterDeg <= 1e-9) return uniformShare(lo - a, hi - a, spread);
    const N = 9;
    let s = 0;
    for (let i = 0; i < N; i++) {
        const v = -jitterDeg + (2 * jitterDeg * (i + 0.5)) / N;
        s += uniformShare(lo - a - v, hi - a - v, spread);
    }
    return s / N;
}

/** Normal grid over +-3.5 sigma (weights sum to 1); a single point for sigma 0. */
function normalGrid(sigma: number): Array<[number, number]> {
    if (sigma <= 1e-9) return [[0, 1]];
    const N = 31;
    const out: Array<[number, number]> = [];
    let tot = 0;
    for (let i = 0; i < N; i++) {
        const z = -3.5 + (7 * i) / (N - 1);
        const w = Math.exp(-0.5 * z * z);
        out.push([z * sigma, w]);
        tot += w;
    }
    return out.map(([x, w]) => [x, w / tot]);
}

export interface ShotContext {
    d: number;
    /** shooter's aim error, degrees (normal sd) */
    aimSigma: number;
    armor: ArmorLevel;
    /** share of shots fired while moving (spread + moveSpread) */
    movingShare: number;
    /** paced FSA mode: no spread at all (sim weapons/gun.ts: recoilTicker >= recoilTime) */
    paced: boolean;
}

/** Damage outcomes of one pellet hit: [damage, probability] (body / head; explosion and shrapnel added). */
function hitOutcomes(mg: ModelGun, d: number, arm: ArmorLevel): Array<[number, number]> {
    const raw = mg.bullet.damage > 0 ? bulletDamageAt(mg.gun, mg.bullet, d) : 0;
    const body = afterArmor(raw, false, mg.gun.headshotMult, arm);
    const head = afterArmor(raw, true, mg.gun.headshotMult, arm);
    let base: Array<[number, number]> = mg.canHeadshot
        ? [
              [body, 1 - HEADSHOT_CHANCE],
              [head, HEADSHOT_CHANCE],
          ]
        : [[body, 1]];
    const ex = mg.explosive;
    // inside the arming distance the round is a dud: bullet damage only
    if (ex && hitDistance(mg.gun, d) >= ex.armDistance) {
        // explosions and shrapnel never headshot and take the body reductions (sim combat/damage.ts)
        const exp = afterArmor(ex.damage, false, 1, arm);
        const per = afterArmor(ex.shrapnelDamage, false, 1, arm);
        const pmf = binomPmf(ex.shrapnelCount, ex.shrapnelP);
        const next: Array<[number, number]> = [];
        for (const [dm, pm] of base)
            for (let k = 0; k < pmf.length; k++) if (pmf[k] > 1e-7) next.push([dm + exp + k * per, pm * pmf[k]]);
        base = next;
    }
    return base;
}

export function binomPmf(n: number, p: number): number[] {
    const out = new Array(n + 1).fill(0);
    out[0] = 1;
    for (let i = 0; i < n; i++) {
        for (let k = i + 1; k >= 1; k--) out[k] = out[k] * (1 - p) + out[k - 1] * p;
        out[0] *= 1 - p;
    }
    return out;
}

const key = (x: number) => Math.round(x * 1e4);

/** P(shrapnel range >= x): range = distance x (1 + U x variance) + distAdj (sim explosions.ts, bullets.ts distAdj) */
function shrapRange(ex: Explosive, x: number): number {
    let p = 0;
    for (let i = 0; i <= 16; i++) {
        const need = ((x - (-1 + i / 8)) / ex.shrapnelDistance - 1) / (ex.shrapnelVariance || 1e-9);
        p += 1 - Math.min(1, Math.max(0, need));
    }
    return p / 17;
}

/**
 * Splash of a burst whose centre is r from the target's centre (sim combat/explosions.ts damageAt, "step" falloff):
 * full damage while the body touches the rad.min circle, then damage x (1 - surface distance / rad.max); shrapnel
 * pieces hit with asin(1 / r) / pi of the directions, as far as they fly.
 */
function splashOutcomes(ex: Explosive, r: number, arm: ArmorLevel): Array<[number, number]> {
    const s = Math.max(0, r - 1);
    const raw = s <= ex.rad.min ? ex.damage : s >= ex.rad.max ? 0 : ex.damage * (1 - s / ex.rad.max);
    const dmg = afterArmor(raw, false, 1, arm);
    if (!ex.shrapnelCount) return [[dmg, 1]];
    const p = r <= 1 ? shrapRange(ex, 0) : (Math.asin(1 / r) / Math.PI) * shrapRange(ex, s);
    const per = afterArmor(ex.shrapnelDamage, false, 1, arm);
    const pmf = binomPmf(ex.shrapnelCount, p);
    return pmf.map((m, k) => [dmg + k * per, m] as [number, number]).filter(([, m]) => m > 1e-7);
}

/**
 * Outcomes of one cursor-burst round (single pellet): over the aim error and the uniform spread, the round either
 * meets the body (direct: bullet + full blast + contact shrapnel) or bursts where it stops, min(cursor, range) along
 * its line, splashing the target from there (no burst inside the arming distance).
 */
function cursorOutcomes(mg: ModelGun, c: ShotContext, D: number, sigma: number): Map<number, number> {
    const ex = mg.explosive as Explosive;
    const out = new Map<number, number>();
    // splash damage is continuous in the miss distance: 0.5 HP steps (rounded down) keep the kill DP's states few
    const add = (list: Array<[number, number]>, w: number) => {
        for (const [dm, p] of list) {
            const k = key(Math.floor(dm * 2 + 1e-9) / 2);
            out.set(k, (out.get(k) ?? 0) + p * w);
        }
    };
    const direct = hitOutcomes(mg, c.d, c.armor);
    const L = Math.min(D, mg.bullet.distance);
    const modes: Array<[number, number]> = c.paced
        ? [[0, 1]]
        : [
              [mg.gun.shotSpread, 1 - c.movingShare],
              [mg.gun.shotSpread + mg.gun.moveSpread, c.movingShare],
          ];
    const NU = 24;
    for (const [spread, wm] of modes) {
        if (wm <= 0) continue;
        for (const [a, wa] of normalGrid(sigma)) {
            for (let i = 0; i < NU; i++) {
                const u = spread > 0 ? -spread / 2 + (spread * (i + 0.5)) / NU : 0;
                const w = (wm * wa) / NU;
                const phi = ((a + u) * Math.PI) / 180;
                const lateral = D * Math.sin(phi);
                const entry = D * Math.cos(phi) - Math.sqrt(Math.max(0, 1 - lateral * lateral));
                if (Math.abs(lateral) <= 1 && entry <= L) {
                    add(direct, w);
                } else if (L < ex.armDistance) {
                    add([[0, 1]], w);
                } else {
                    const r = Math.hypot(L * Math.cos(phi) - D, L * Math.sin(phi));
                    add(splashOutcomes(ex, r, c.armor), w);
                }
            }
        }
    }
    return out;
}

/** Per-shot damage distribution: Map(damage key -> probability), misses included (key 0). */
export function shotOutcomes(mg: ModelGun, c: ShotContext): Map<number, number> {
    const out = new Map<number, number>();
    const D = Math.max(1e-6, c.d - mg.gun.barrelLength);
    const R = mg.hitRadius;
    const range = mg.bullet.distance > 0 ? rangeShare(mg.gun, mg.bullet, c.d) : 0;
    if (range <= 0) {
        out.set(0, 1);
        return out;
    }
    // the muzzle sits off the aim line by barrelOffset, or +-dualOffset for the alternating hands of a dual gun (sim
    // weapons/gun.ts gunOff): the target's window [beta - a, beta + a] seen from there
    const offs = mg.gun.isDual ? [mg.gun.dualOffset ?? 0, -(mg.gun.dualOffset ?? 0)] : [mg.gun.barrelOffset ?? 0];
    const windows = offs.map((o): [number, number] => {
        const L = Math.hypot(D, o);
        if (L <= R) return [-90, 90];
        const beta = Math.atan2(-o, D) * DEG;
        const half = Math.asin(R / L) * DEG;
        return [beta - half, beta + half];
    });
    const dodge = Math.atan(DODGE_SPEED / Math.max(mg.speed, 1)) * DEG;
    const sigma = Math.hypot(c.aimSigma, dodge);
    const jitter = mg.gun.bulletCount > 1 ? Math.atan(((mg.gun.jitter ?? DEFAULT_JITTER) * JITTER_SCALE) / D) * DEG : 0;
    if (mg.explosive?.cursor && mg.gun.bulletCount === 1) return cursorOutcomes(mg, c, D, sigma);
    const hits = hitOutcomes(mg, c.d, c.armor);
    const grid = normalGrid(sigma);
    // a fixed fan (the M202 FLASH, `fanAngle`; sim weapons/gun.ts fanDeviation): no random spread or jitter, and the
    // shooter aims the rocket line nearest the centre at the target, so the deviations are taken from that line
    const fanAngle = mg.gun.fanAngle;
    let fan: number[] | undefined;
    if (fanAngle !== undefined) {
        const n = mg.gun.bulletCount;
        const devs = Array.from({ length: n }, (_, i) => (n > 1 ? -fanAngle / 2 + (fanAngle * i) / (n - 1) : 0));
        const near = devs.reduce((m, x) => (Math.abs(x) < Math.abs(m) ? x : m), devs[0]);
        fan = devs.map((x) => x - near);
    }
    const modes: Array<[number, number]> = c.paced
        ? [[0, 1]]
        : [
              [mg.gun.shotSpread, 1 - c.movingShare],
              [mg.gun.shotSpread + mg.gun.moveSpread, c.movingShare],
          ];
    for (const [spread, wm] of modes) {
        if (wm <= 0) continue;
        for (const [a, wa0] of grid)
            for (const [lo, hi] of windows) {
                const wa = wa0 / windows.length;
                const p0 = fan ? 0 : range * pelletP(a, lo, hi, spread, 0);
                const pj = !fan && mg.gun.bulletCount > 1 ? range * pelletP(a, lo, hi, spread, jitter) : 0;
                let dist = new Map<number, number>([[0, 1]]);
                for (let i = 0; i < mg.gun.bulletCount; i++) {
                    const p = fan ? range * uniformShare(lo - a - fan[i], hi - a - fan[i], 0) : i === 0 ? p0 : pj;
                    if (p <= 1e-9) continue;
                    const next = new Map<number, number>();
                    for (const [k, m] of dist) {
                        next.set(k, (next.get(k) ?? 0) + m * (1 - p));
                        for (const [dm, ph] of hits) {
                            const nk = k + key(dm);
                            next.set(nk, (next.get(nk) ?? 0) + m * p * ph);
                        }
                    }
                    dist = next;
                }
                for (const [k, m] of dist) out.set(k, (out.get(k) ?? 0) + m * wa * wm);
            }
    }
    return out;
}

export interface KillResult {
    /**
     * expected seconds to kill (first shot at t = 0, plus the killing bullet's flight), Infinity if it cannot; for a
     * charge gun E[t | kill], to be combined with a backup gun (compute.ts ttkC)
     */
    ttk: number;
    /** charge guns: seconds until the last charge has landed (when a backup gun takes over) */
    tEnd?: number;
    /** expected shots fired */
    shots: number;
    /** chance of a kill at all (below 1 only for charge guns, or guns that cannot reach) */
    pKill: number;
}

/** Kill distribution over shots for a per-shot outcome distribution and the gun's shot times. */
export function killTime(mg: ModelGun, c: ShotContext, maxShots = 1200): KillResult {
    const outcomes = [...shotOutcomes(mg, c).entries()].filter(([, p]) => p > 1e-12);
    const hpKey = key(HP) - 1;
    const pMiss = outcomes.find(([k]) => k === 0)?.[1] ?? 0;
    if (pMiss >= 1 - 1e-9) return { ttk: Number.POSITIVE_INFINITY, shots: Number.POSITIVE_INFINITY, pKill: 0 };
    const gun = c.paced ? { ...mg.gun, fireDelay: Math.max(mg.gun.fireDelay, mg.gun.recoilTime ?? 0) } : mg.gun;
    const limit = mg.gun.charges ? Math.min(maxShots, mg.gun.charges) : maxShots;
    const times = shotTimes(gun, limit);
    const travel = hitDistance(mg.gun, c.d) / Math.max(mg.speed, 1e-6);
    let alive = new Map<number, number>([[0, 1]]);
    let tail = 1;
    let eT = 0;
    let eN = 0;
    let killed = 0;
    for (let k = 1; k <= limit && tail > 1e-5; k++) {
        const next = new Map<number, number>();
        let kk = 0;
        for (const [a, ma] of alive) {
            for (const [s, ps] of outcomes) {
                const nk = a + s;
                const m = ma * ps;
                if (nk >= hpKey) kk += m;
                else next.set(nk, (next.get(nk) ?? 0) + m);
            }
        }
        // merge near-equal states (keeps the state count small; 1e-4 HP resolution)
        alive = next;
        tail -= kk;
        killed += kk;
        eT += kk * (times[k - 1] + travel);
        eN += kk * k;
    }
    if (killed <= 1e-9) return { ttk: Number.POSITIVE_INFINITY, shots: Number.POSITIVE_INFINITY, pKill: 0 };
    if (!mg.gun.charges && tail > 0.01)
        return { ttk: Number.POSITIVE_INFINITY, shots: Number.POSITIVE_INFINITY, pKill: killed };
    // charge guns (Boys, Panzerfaust, M202): the target survives the last charge with 1 - P(kill)
    if (mg.gun.charges) return { ttk: eT / killed, shots: eN / killed, pKill: killed, tEnd: times[limit - 1] + travel };
    return { ttk: eT / killed, shots: eN / killed, pKill: 1 };
}
