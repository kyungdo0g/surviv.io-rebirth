// Grenade numbers and the computed cook (round 3, user reports 24 and 27). Radii, fuses and throw speeds come from the
// defs (the frag's blast may grow in a rebirth balance change: never hard-code it); the flight model mirrors the
// simulation's projectile physics (sim combat/projectiles.ts GRAVITY 10.5 and GROUND_DRAG 2.3, weapons/throwable.ts
// spawn height 0.5 and the hand 0.5 ahead): a throw flies at its speed while in the air (velZ up, gravity down, about
// 1.04 s), then slides to a stop under ground drag; the mouse distance sets the speed so the slide ends at the planned
// point (brain/trigger.ts throwMouseLen, calibrated against the simulation).
// The cook (user report 24: "compute the hold: fuse - flight time to target, minus a human reaction margin, and only
// cook when there is a reason"): cook = fuse - flight - margin + noise, margin 0.2-0.6 s and noise sd 0.05-0.3 s by
// skill (the lower the skill, the earlier the release and the more scattered the burst), so the frag bursts about as
// it comes to rest at the target instead of lying there with seconds to spare. An air burst over low cover is thrown
// to land at the target and cooked to burst just before it lands (half the margin early), over the cover. Only with a
// reason: the target behind cover, denying a push or a revive, a burst over low cover, into smoke; otherwise the pin
// is pulled and the frag thrown at once. The cook is capped so the frag always leaves the hand before HAND_SAFETY of
// fuse is left (ThrowController enforces the same deadline).
// Round 4 (user reports 29 and 30): a frag thrown back on the run to cover an escape is never cooked (reason "escape":
// the pin is pulled and it goes at once), and inherits part of the thrower's motion (throwable playerVelMult), so
// the hand allows for its own run (runningThrowPoint: a beginner barely does, and its frag lands short); a frag's path
// can be checked for walls and trees it would bounce off (arcBlocker: tall obstacles stop it anywhere, low ones while
// it is on the ground); the longest throw and the blast's full-damage group radius come from the defs too.
import { type Collider, type Vec2, v2 } from "@rebirth/core";
import { GameConfig, GameObjectDefs, hasDef, type ThrowableDef } from "@rebirth/defs";
import { gaussian } from "../motor/noise.ts";
import { sameLayer } from "../nav/cellGrid.ts";
import type { SeenObstacle } from "../perception/world.ts";
import type { BrainCtx } from "./context.ts";

/** Simulation constants (sim combat/projectiles.ts, weapons/throwable.ts). */
const GRAVITY = 10.5;
const GROUND_DRAG = 2.3;
const SPAWN_HEIGHT = 0.5;
const HAND_REACH = 0.5;
/** The throwing hand relative to a player facing +x (sim weapons/throwable.ts HAND_OFFSET): the frag leaves from it. */
const HAND_OFFSET = { x: 0.5, y: -1 };
/** The flight counts as over when the slide has this little left to go (units). */
const ARRIVED = 1;
/** Collision radius of a flying frag (simulation: half the projectile's rad 1). */
const FRAG_BODY = 0.5;
/** A cooking frag is always thrown with at least this much fuse left (s). */
export const HAND_SAFETY = 0.35;

/**
 * Why a frag is cooked (the decision trace records it); "escape" (thrown back on the run, round 4) and "waste" (a
 * beginner's frag with no real reason) are never cooked.
 */
export type CookReason = "cover" | "airburst" | "push" | "revive" | "smoke" | "escape" | "waste" | "none";

export interface CookPlan {
    /** seconds to hold the cooking frag */
    cook: number;
    reason: CookReason;
    /** estimated flight time to the burst point, and the fuse */
    flight: number;
    fuse: number;
    /** "air": burst in the air at the target (thrown harder, over low cover); "land": burst as it comes to rest */
    mode: "land" | "air";
}

function throwableOf(item: string): ThrowableDef | undefined {
    if (!item || !hasDef(item)) return undefined;
    const d = GameObjectDefs[item];
    return d.type === "throwable" ? d : undefined;
}

/** The blast of a throwable's explosion (defs explosionType rad, e.g. explosion_frag's), 0/0 for none. */
export function fragBlast(item: string): { min: number; max: number } {
    const t = throwableOf(item);
    const ex = t?.explosionType && hasDef(t.explosionType) ? GameObjectDefs[t.explosionType] : undefined;
    const rad = ex && ex.type === "explosion" ? (ex as { rad?: { min: number; max: number } }).rad : undefined;
    return rad ? { min: rad.min, max: rad.max } : { min: 0, max: 0 };
}

/** A body's radius (sim player): the blast reaches a body whose centre is this much past its outer radius. */
const BODY_RAD = 1;
/** Slack for a frag landing a little short of the aim (the hand's error, the slide). */
const SHORT_SLACK = 0.5;

/**
 * The nearest a frag is thrown at: its blast's outer radius (damage is measured to the body's surface, sim
 * combat/explosions.ts damageAt) plus the body radius and a little slack: explosion_frag rad.max + 1.5, read from the
 * defs (evaluation F3: at the old
 * outer radius less 2 a frag landing on its aim still hit its thrower; 8.6% of frags did, 1.3 HP per throw).
 */
export function fragMinDist(item: string): number {
    return Math.max(6, fragBlast(item).max + BODY_RAD + SHORT_SLACK);
}

/** No frag is started with a standing enemy this close (the full-damage radius plus 3: 8 for the frag). */
export function fragNoThrowNear(item: string): number {
    return fragBlast(item).min + 3;
}

/** The farthest a frag is planned at: a full-strength throw's resting point less 3 units (27 for the frag). */
export function fragMaxDist(item: string): number {
    return Math.round(standDist(item, throwableOf(item)?.throwPhysics.speed ?? 20) - 3);
}

/** Enemies this close to the target are caught in the same blast (its full-damage radius plus 1: 6 for the frag). */
export function fragGroupRadius(item: string): number {
    return fragBlast(item).min + 1;
}

/** Fuse of a cookable throwable (s), Infinity for one that does not cook (smoke). */
export function fuseOf(item: string): number {
    const t = throwableOf(item);
    return t?.cookable ? t.fuseTime : Number.POSITIVE_INFINITY;
}

/** The longest a cooking `item` may be held: its fuse less HAND_SAFETY (Infinity for a smoke). */
export function cookDeadline(item: string): number {
    return fuseOf(item) - HAND_SAFETY;
}

/** Seconds a throw stays in the air (spawned at 0.5 with velZ, down with gravity). */
export function airTime(item: string): number {
    const vz = throwableOf(item)?.throwPhysics.velZ ?? 5;
    return (vz + Math.sqrt(vz * vz + 2 * GRAVITY * SPAWN_HEIGHT)) / GRAVITY;
}

/** Where a throw at `speed` (u/s, from a standing thrower) comes to rest: the hand, the air time and the slide. */
export function standDist(item: string, speed: number): number {
    return HAND_REACH + speed * (airTime(item) + 1 / GROUND_DRAG);
}

/** The throw speed (u/s) that lands `item` (air plus slide) `dist` units from the thrower, capped at full strength. */
export function landSpeed(item: string, dist: number): number {
    const full = throwableOf(item)?.throwPhysics.speed ?? 20;
    return Math.min(full, Math.max(0, dist - HAND_REACH) / (airTime(item) + 1 / GROUND_DRAG));
}

/**
 * Seconds from the release until the throw reaches the point `dist` away: "land" thrown to come to rest there (the air
 * time plus the slide until ARRIVED short of it), "air" thrown to cover `dist` in the air (null when it cannot).
 */
export function flightTime(item: string, dist: number, mode: "land" | "air"): number | null {
    const air = airTime(item);
    if (mode === "air") {
        const full = throwableOf(item)?.throwPhysics.speed ?? 20;
        const v = Math.max(0, dist - HAND_REACH) / air;
        return v <= full ? air : null;
    }
    const v0 = landSpeed(item, dist);
    const slide = v0 / GROUND_DRAG;
    return air + (slide > ARRIVED ? Math.log(slide / ARRIVED) / GROUND_DRAG : 0);
}

/** The farthest an air burst reaches: what a full-strength throw covers in the air (about 21 units for the frag). */
export function airReach(item: string): number {
    return HAND_REACH + (throwableOf(item)?.throwPhysics.speed ?? 20) * airTime(item);
}

/**
 * The planned point of an air burst at `target` thrown from `from`: the throw must cover the distance in the air, so it
 * is aimed (mouse distance) at the point where that faster throw would come to rest, past the target on the same line.
 * Null when the target is beyond the air reach.
 */
export function airburstPoint(item: string, from: Vec2, target: Vec2): Vec2 | null {
    const d = v2.distance(from, target);
    const air = airTime(item);
    const full = throwableOf(item)?.throwPhysics.speed ?? 20;
    const v = Math.max(0, d - HAND_REACH) / air;
    if (v > full) return null;
    const rest = HAND_REACH + v * (air + 1 / GROUND_DRAG);
    return v2.add(from, v2.mul(v2.normalizeSafe(v2.sub(target, from)), rest));
}

/** The human reaction margin of a cook (s): 0.2 for the best hands, 0.6 for none (DifficultyParams via the skill s). */
export function cookMargin(ctx: BrainCtx): number {
    return 0.2 + 0.4 * (1 - ctx.skill.s);
}

/**
 * The cook of a frag thrown at a point `dist` away for `reason`, with the bot's margin and noise (sd 0.05-0.3 s by
 * skill, drawn from ctx.rng): "land" fuse - flight - margin + noise (it bursts `margin` after it comes to rest), "air"
 * fuse - (air time - margin / 2) + noise (thrown to land at the target, it bursts just before it lands, over the
 * cover); the bare minimum hold without a reason. Capped so the frag leaves the hand with HAND_SAFETY of fuse left.
 */
export function cookFor(ctx: BrainCtx, item: string, dist: number, reason: CookReason, mode: "land" | "air"): CookPlan {
    const fuse = fuseOf(item);
    const air = mode === "air" && flightTime(item, dist, "air") !== null;
    const margin = cookMargin(ctx);
    const flight = air ? airTime(item) - margin / 2 : (flightTime(item, dist, "land") as number);
    const minHold = GameConfig.player.cookTime;
    const used = air ? "air" : "land";
    // thrown back on the run: the pin is pulled and it goes at once (user report 29: never cooked; the simulation
    // still holds it for its minimum cook time)
    if (reason === "escape") return { cook: 0, reason, flight, fuse, mode: used };
    if (reason === "waste") return { cook: minHold, reason, flight, fuse, mode: used };
    if (reason === "none" || !Number.isFinite(fuse)) return { cook: minHold, reason: "none", flight, fuse, mode: used };
    const noise = gaussian(ctx.rng) * (0.05 + 0.25 * (1 - ctx.skill.s));
    const cap = Math.max(minHold, Math.min(fuse - flight - 0.05, cookDeadline(item) - 0.1));
    const cook = Math.min(cap, Math.max(minHold, fuse - flight - (air ? 0 : margin) + noise));
    return { cook, reason, flight, fuse, mode: used };
}

/**
 * The point to aim a throw at from `from` (cursor direction and mouse distance as for a standing throw) so that it
 * comes to rest at `target` although the thrower moves at `vel`: the throw inherits playerVelMult of that motion, and
 * the hand allows for `comp` (0..1) of it. With comp 0 it is the target itself (a frag thrown back on the run then
 * lands short, or even ahead of the runner).
 */
export function runningThrowPoint(item: string, from: Vec2, target: Vec2, vel: Vec2, comp: number): Vec2 {
    const t = throwableOf(item);
    const rel = v2.sub(target, from);
    const dist = v2.length(rel);
    if (!t || comp <= 0 || dist < 1e-6) return v2.copy(target);
    const want = v2.mul(v2.normalize(rel), landSpeed(item, dist));
    let thrown = v2.sub(want, v2.mul(vel, t.throwPhysics.playerVelMult * Math.min(1, comp)));
    const speed = v2.length(thrown);
    if (speed < 1e-3) thrown = v2.mul(v2.normalize(rel), 0.1);
    const full = t.throwPhysics.speed;
    const v = Math.min(full, v2.length(thrown));
    return v2.add(from, v2.mul(v2.normalize(thrown), standDist(item, v)));
}

/**
 * How far along the segment from `a` (direction `dir`, length `len`) a frag's body first touches `col` (its collider
 * grown by FRAG_BODY), or null when it does not.
 */
function entryDistance(col: Collider, a: Vec2, dir: Vec2, len: number): number | null {
    if (col.type === 0) {
        const r = col.rad + FRAG_BODY;
        const rel = v2.sub(col.pos, a);
        const along = v2.dot(rel, dir);
        const across2 = v2.lengthSqr(rel) - along * along;
        if (across2 > r * r) return null;
        const half = Math.sqrt(r * r - across2);
        return along - half <= len && along + half >= 0 ? Math.max(0, along - half) : null;
    }
    // slab test on the grown box
    let t0 = 0;
    let t1 = len;
    for (const axis of ["x", "y"] as const) {
        const lo = col.min[axis] - FRAG_BODY;
        const hi = col.max[axis] + FRAG_BODY;
        const d = dir[axis];
        if (Math.abs(d) < 1e-9) {
            if (a[axis] < lo || a[axis] > hi) return null;
            continue;
        }
        let ta = (lo - a[axis]) / d;
        let tb = (hi - a[axis]) / d;
        if (ta > tb) [ta, tb] = [tb, ta];
        t0 = Math.max(t0, ta);
        t1 = Math.min(t1, tb);
        if (t0 > t1) return null;
    }
    return t0;
}

/**
 * The line a frag thrown from a player at `from` towards `to` travels: it leaves the throwing hand (a unit to the side)
 * and flies parallel to the aim, so its path is the aim line shifted by the hand.
 */
export function throwLine(from: Vec2, to: Vec2): { from: Vec2; to: Vec2 } {
    const dir = v2.normalizeSafe(v2.sub(to, from), { x: 1, y: 0 });
    const hand = v2.rotate(HAND_OFFSET, Math.atan2(dir.y, dir.x));
    return { from: v2.add(from, hand), to: v2.add(to, hand) };
}

/** Height of a throw above the ground `x` units from the thrower when thrown at `speed` (0 once it lands). */
function heightAt(item: string, x: number, speed: number): number {
    const vz = throwableOf(item)?.throwPhysics.velZ ?? 5;
    if (speed <= 1e-6) return 0;
    const t = Math.max(0, x - HAND_REACH) / speed;
    if (t >= airTime(item)) return 0;
    return SPAWN_HEIGHT + vz * t - (GRAVITY * t * t) / 2;
}

/**
 * The first obstacle a frag thrown from `from` to come to rest at `to` would bounce off (simulation projectiles:
 * an obstacle taller than the frag's height at that point stops it, a low one only while it rolls on the ground;
 * bushes and other non-collidable obstacles let it through), or null. `mode` "air" is a throw that covers the distance
 * in the air (an air burst at `to`). Only what the bot has seen counts.
 */
export function arcBlocker(
    item: string,
    from: Vec2,
    to: Vec2,
    obstacles: readonly SeenObstacle[],
    layer: number,
    mode: "land" | "air" = "land",
): SeenObstacle | null {
    const dist = v2.distance(from, to);
    if (dist < 1e-6) return null;
    const dir = v2.normalize(v2.sub(to, from));
    const air = airTime(item);
    const speed = mode === "air" ? Math.max(0, dist - HAND_REACH) / air : landSpeed(item, dist);
    let best: SeenObstacle | null = null;
    let bestX = Number.POSITIVE_INFINITY;
    for (const o of obstacles) {
        if (!o.blocksMove || !sameLayer(layer, o.view.layer)) continue;
        // where along the path the frag reaches it
        const x = entryDistance(o.col, from, dir, dist);
        if (x === null || x >= bestX || o.def.height <= heightAt(item, x, speed) + 1e-6) continue;
        best = o;
        bestX = x;
    }
    return best;
}
