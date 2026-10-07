// Numbers of the rebirth "Enhanced hit effects" (user/2026-10-07-hit-feedback; docs/research/rebirth-deviations.md
// "Enhanced hit effects"): every effect scales with one intensity k = sqrt(damage / 100), so a 9 mm graze (k 0.30)
// reads differently from a 99-damage Barrett hit (k 0.995) while small hits stay visible. Pure functions and two tiny
// rate limiters, unit-tested in apps/client/test/hitFeedback.test.ts. None of this exists in v0.8.82.
import type { Vec2 } from "@rebirth/core";

/** Intensity of a hit of `damage` (summed per snapshot or per target per frame): sqrt(clamp(d, 0, 100) / 100). */
export function hitIntensity(damage: number): number {
    if (!(damage > 0)) return 0;
    return Math.sqrt(Math.min(damage, 100) / 100);
}

// --- edge vignette (the active player takes damage) ---

/** the vignette jumps to its peak, holds it this long, then falls VIGNETTE_DECAY per second */
export const VIGNETTE_HOLD = 0.05;
export const VIGNETTE_DECAY = 1.6;
export const VIGNETTE_MAX = 0.85;
/** below this health the vignette keeps a pulsing floor (the original HUD's 25 HP danger pulse, ui/hud.ts) */
export const LOW_HEALTH = 25;

/** Peak opacity of the vignette for a hit of intensity k: 0.39 for 9 damage, 0.80 for 99. */
export function vignettePeak(k: number): number {
    return 0.22 + 0.58 * k;
}

/** Vignette level after a new hit of peak `p`: the higher of the two plus a little stacking, capped. */
export function stackVignette(level: number, p: number): number {
    return Math.min(VIGNETTE_MAX, Math.max(level, p) + 0.08 * p);
}

/** Pulsing low-health floor at `t` seconds: 0.30 x (1 - hp / 25) below 25 HP, x 0.85-1 at 1.2 Hz. */
export function lowHealthFloor(health: number, t: number): number {
    if (!(health < LOW_HEALTH) || health <= 0) return 0;
    return 0.3 * (1 - health / LOW_HEALTH) * (0.85 + 0.15 * Math.sin(Math.PI * 2 * 1.2 * t));
}

// --- camera kick (only with Screen shake on) ---

/** cap of the accumulated kick in world units (a frag's shake is 0.2, survev camera.ts) */
export const KICK_CAP = 0.35;
/** exponential decay rate of the kick (1/s): a 39 ms half-life */
export const KICK_DECAY = 18;

/** Kick of a hit of intensity k in world units: about 3 px at 9 damage, 7 px at 99 (1x zoom). */
export function kickAmount(k: number): number {
    return 0.05 + 0.25 * k;
}

/** Adds a kick of `amount` along `dir` to `kick`, capping its length. */
export function addKick(kick: Vec2, dir: Vec2, amount: number): void {
    kick.x += dir.x * amount;
    kick.y += dir.y * amount;
    const len = Math.hypot(kick.x, kick.y);
    if (len > KICK_CAP) {
        kick.x *= KICK_CAP / len;
        kick.y *= KICK_CAP / len;
    }
}

// --- damage arcs (screen space) ---

export const ARC_HALF_ANGLE = (25 * Math.PI) / 180;
export const ARC_LIFE = 1;
export const ARC_FULL = 0.3;
export const MAX_ARCS = 4;

/** Arc radius around the player in screen pixels: 14 % of the smaller screen side, 80-140 px. */
export function arcRadius(screenWidth: number, screenHeight: number): number {
    return Math.min(140, Math.max(80, 0.14 * Math.min(screenWidth, screenHeight)));
}

/** Arc alpha over its life: full for ARC_FULL s, then a linear fade to 0 at ARC_LIFE. */
export function arcAlpha(age: number, k: number): number {
    const base = 0.55 + 0.4 * k;
    if (age <= ARC_FULL) return base;
    return Math.max(0, base * (1 - (age - ARC_FULL) / (ARC_LIFE - ARC_FULL)));
}

/**
 * Screen angle (radians, +y down) of an arc around `center` pointing at `target` (screen positions), or back along the
 * world direction `dir` the hit travelled (+y up) when the attacker is not visible; null when neither is known.
 */
export function arcAngle(center: Vec2, target: Vec2 | null, dir: Vec2 | null): number | null {
    if (target) {
        const dx = target.x - center.x;
        const dy = target.y - center.y;
        if (dx * dx + dy * dy > 1) return Math.atan2(dy, dx);
    }
    if (dir && (dir.x !== 0 || dir.y !== 0)) return Math.atan2(dir.y, -dir.x);
    return null;
}

// --- hit marker and confirm sound (the active player deals damage) ---

export const MarkerVariant = { Body: 0, Armor: 1, Headshot: 2, Knock: 3, Kill: 4 } as const;
export type MarkerVariant = (typeof MarkerVariant)[keyof typeof MarkerVariant];

export interface MarkerStyle {
    tint: number;
    /** scale = base + perK x k */
    base: number;
    perK: number;
    life: number;
    ring: boolean;
}

/** Marker styles by variant: white body, blue armour, gold headshot, orange knock, red kill. */
export const MARKER_STYLES: Readonly<Record<MarkerVariant, MarkerStyle>> = {
    [MarkerVariant.Body]: { tint: 0xffffff, base: 1, perK: 0.4, life: 0.2, ring: false },
    [MarkerVariant.Armor]: { tint: 0x8ec5ff, base: 0.95, perK: 0.35, life: 0.2, ring: false },
    [MarkerVariant.Headshot]: { tint: 0xffcf33, base: 1.3, perK: 0.3, life: 0.3, ring: false },
    [MarkerVariant.Knock]: { tint: 0xff9933, base: 1.5, perK: 0, life: 0.4, ring: true },
    [MarkerVariant.Kill]: { tint: 0xff2b2b, base: 1.6, perK: 0, life: 0.45, ring: true },
};

/** Variant of a dealt hit from its flags (kill and knock come from the Kill event). */
export function hitVariant(headshot: boolean, armored: boolean): MarkerVariant {
    if (headshot) return MarkerVariant.Headshot;
    return armored ? MarkerVariant.Armor : MarkerVariant.Body;
}

/** The variant shown when several hits land in one snapshot: kill > knock > headshot > armour > body. */
export function strongerVariant(a: MarkerVariant, b: MarkerVariant): MarkerVariant {
    return a > b ? a : b;
}

/** pop-in: the marker starts at 1.3x its size and settles within 60 ms */
export const MARKER_POP = 1.3;
export const MARKER_POP_TIME = 0.06;
export const RING_LIFE = 0.35;

/** Marker scale and alpha at `age` seconds: the pop settles in 60 ms, alpha 1 until 40 % of the life, then fades. */
export function markerFrame(variant: MarkerVariant, k: number, age: number): { scale: number; alpha: number } {
    const style = MARKER_STYLES[variant];
    const size = style.base + style.perK * k;
    const pop = age < MARKER_POP_TIME ? MARKER_POP + (1 - MARKER_POP) * (age / MARKER_POP_TIME) : 1;
    const fadeStart = style.life * 0.4;
    const alpha = age <= fadeStart ? 1 : Math.max(0, 1 - (age - fadeStart) / (style.life - fadeStart));
    return { scale: size * pop, alpha };
}

export interface ConfirmSound {
    name: string;
    /** cents */
    detune: number;
    volumeScale: number;
}

/**
 * The short hit-confirm sound of a variant: original hit sounds pitched up (hits) or down (knock, kill), centred, on the
 * hits channel at about 0.05-0.1 of full volume (starting points, tuned by ear). Only sounds without canCoalesce or
 * maxInstances (the melee hits), so a confirm never merges into a world impact of the same name (audio.ts coalesce
 * keeps the first instance's pitch and pan) nor takes one of its instances: the original sounds play untouched.
 */
export function confirmSound(variant: MarkerVariant, k: number): ConfirmSound {
    switch (variant) {
        case MarkerVariant.Armor:
            return { name: "metal_punch_hit_01", detune: 400, volumeScale: 0.22 };
        case MarkerVariant.Headshot:
            return { name: "pan_hit_01", detune: 500, volumeScale: 0.25 };
        case MarkerVariant.Knock:
            return { name: "punch_hit_01", detune: -200, volumeScale: 0.5 };
        case MarkerVariant.Kill:
            return { name: "metal_punch_hit_02", detune: -500, volumeScale: 0.45 };
        default:
            return { name: "punch_hit_01", detune: 600, volumeScale: 0.25 + 0.15 * k };
    }
}

export const CONFIRM_SOUNDS = ["punch_hit_01", "metal_punch_hit_01", "metal_punch_hit_02", "pan_hit_01"];
/** at most one confirm sound per 70 ms (kill and knock skip the limit) */
export const CONFIRM_INTERVAL = 0.07;

// --- body flash and blood (any player hit, seen by everyone) ---

export interface FlashParams {
    /** peak alpha */
    alpha: number;
    /** total duration: white for FLASH_WHITE s, then red fading to 0 */
    duration: number;
}

export const FLASH_WHITE = 0.04;
export const FLASH_RED = 0xff3030;

/**
 * Flash of a hit of intensity k; a known headshot is stronger and longer, a knock is a fixed strong flash. Written into
 * `out` when given (the per-frame callers reuse one object).
 */
export function flashParams(k: number, headshot = false, knock = false, out?: FlashParams): FlashParams {
    let alpha = 0.35 + 0.35 * k;
    let duration = 0.14 + 0.12 * k;
    if (headshot) {
        alpha += 0.15;
        duration += 0.06;
    }
    if (knock) {
        alpha = Math.max(alpha, 0.85);
        duration = Math.max(duration, 0.26);
    }
    const p = out ?? { alpha: 0, duration: 0 };
    p.alpha = Math.min(alpha, 0.9);
    p.duration = duration;
    return p;
}

/** Flash tint at `age`: white for the first FLASH_WHITE s, then red. */
export function flashTint(age: number): number {
    return age < FLASH_WHITE ? 0xffffff : FLASH_RED;
}

/** Flash alpha at `age` into a flash of peak `alpha` lasting `duration`: full while white, then fading to 0. */
export function flashAlpha(alpha: number, duration: number, age: number): number {
    if (age < FLASH_WHITE) return alpha;
    const t = (age - FLASH_WHITE) / Math.max(1e-6, duration - FLASH_WHITE);
    return Math.max(0, alpha * (1 - t));
}

/** Flash tint and alpha at `age` into a flash of `p` (tests; the flashes use flashTint / flashAlpha). */
export function flashFrame(p: FlashParams, age: number): { tint: number; alpha: number } {
    return { tint: flashTint(age), alpha: flashAlpha(p.alpha, p.duration, age) };
}

/** Extra blood splats for a hit of intensity k: 2 for 9 mm or AK, 3 Deagle, 4 Mosin, 5 Barrett or a full blast. */
export function extraBloodCount(k: number): number {
    return Math.round(1 + 4 * k);
}

// --- load limits: a big fight (80 players, dozens hit per frame) must cost about what it costs with the setting off ---

/** extra blood of the hits the viewer's player dealt or took and of its kills: splats per second, burst */
export const OWN_BLOOD_RATE = 96;
export const OWN_BLOOD_BURST = 32;
/** extra blood of everyone else's hits: a small fight stays under it, a big one shares it */
export const OTHER_BLOOD_RATE = 32;
export const OTHER_BLOOD_BURST = 10;
/** body flashes at once: the viewer's own hits take the place of other flashes, other hits wait for a free one */
export const MAX_FLASHES = 8;
/** other players' hits bleed extra only on bodies at least this many screen pixels in radius (not at 15x zoom) */
export const MIN_BLOOD_RADIUS_PX = 8;
/** other players hit in one frame beyond which each one's extra blood shrinks */
export const SHARED_BLOOD_TARGETS = 4;

/**
 * Extra blood for one of `others` other players hit in the same frame: extraBloodCount up to 4 players, then scaled by
 * 4 / others (at least 1), so a crowd spreads the budget over many bodies instead of the first few.
 */
export function sharedBloodCount(k: number, others: number): number {
    const n = extraBloodCount(k);
    if (others <= SHARED_BLOOD_TARGETS) return n;
    return Math.max(1, Math.round((n * SHARED_BLOOD_TARGETS) / others));
}

/**
 * Nominal damage of a bullet hit as the client sees it (no perks, armour or headshot): the def's damage split by
 * ricochets, with the distance falloff (survev bullet.ts: damage x lerp(travelled / distance, 1, falloff)).
 */
export function nominalBulletDamage(
    def: { damage: number; falloff?: number; distance: number },
    reflectCount: number,
    travelled: number,
): number {
    const t = def.distance > 0 ? Math.min(1, Math.max(0, travelled / def.distance)) : 0;
    const falloff = def.falloff ?? 1;
    return (def.damage / (reflectCount + 1)) * (1 + (falloff - 1) * t);
}

/** Token bucket: `rate` tokens per second up to `burst` (extra blood: OWN_BLOOD_RATE and OTHER_BLOOD_RATE). */
export class TokenBucket {
    private tokens: number;
    readonly rate: number;
    readonly burst: number;

    constructor(rate: number, burst: number) {
        this.rate = rate;
        this.burst = burst;
        this.tokens = burst;
    }

    refill(dt: number): void {
        this.tokens = Math.min(this.burst, this.tokens + this.rate * dt);
    }

    /** Takes up to `n` whole tokens; returns how many it got. */
    take(n: number): number {
        const got = Math.max(0, Math.min(n, Math.floor(this.tokens)));
        this.tokens -= got;
        return got;
    }

    get available(): number {
        return this.tokens;
    }
}
