// A visible target whose whole body is behind cover (bot overhaul COMBAT-7/10/11; user reports 4 and 5 "they aim at
// each other and don't shoot", "it stared, threw a grenade, then suddenly shot"). The old plan held 11-26 units with
// the trigger released and waited for the per-think grenade roll (diagnosis round 1 issue 2 RC2), the crosshair glued
// to the target through the cover. Now:
// - the crosshair holds where the target last showed, or the edge of the cover on its side (a human holds an angle);
// - a frag is decided once per cover stand-off from the difficulty's grenade appetite and thrown as soon as its gates
//   hold (reaction, the target covered for a second, cooldown: brain/grenades.ts fragGates), never waited for while
//   standing; backing off to a throwing distance lasts at most 1.5 s;
// - a stand-off that stalls, or that MOVE's progress clock flags futile (PursuitMemory.futileTarget), gets a step
//   sideways to a spot with a line of fire: the side is fixed in the world frame by the two players' ids, so two bots
//   on either side of a tree step the same world way and the line between them clears it instead of pivoting about
//   it; the step is long enough to clear the obstacle at its distance and must be walkable in a straight line;
// - otherwise round the cover (BB2: a flank spot, else along the path, never stopping where it stands).
import { type Vec2, v2 } from "@rebirth/core";
import type { GunInfo } from "../knowledge/weapons.ts";
import { bodyAimPoint, segmentHitsCollider } from "../perception/rays.ts";
import type { Contact, WorldModel } from "../perception/world.ts";
import { FRAG_TYPES, freeDir, obstacleGeom } from "./combat.ts";
import { type BrainCtx, type Intent, nearFailedGoal, reachable } from "./context.ts";
import { flankSpot } from "./cover.ts";
import { fragMinDist } from "./fragMath.ts";
import { fragGates } from "./grenades.ts";

/** Covered this long: step aside to a spot with a shot (MOVE's futile clock is slower; this breaks short stalls). */
const STALL = 2.5;
/** A reposition spot is walked to for at most this long; no new stall step before REPO_COOLDOWN. */
const REPO_KEEP = 2;
const REPO_COOLDOWN = 4;
/** Backing off to a throwing distance lasts at most this long per stand-off (COMBAT-11). */
const BACK_OFF_CAP = 1.5;
/**
 * Frags: thrown from the frag's minimum distance (its blast in the defs less 2: 10 units, fragMath.ts) to FRAG_MAX;
 * closer than that plus 1 the bot backs off.
 */
const FRAG_MAX = 27;
/** Chance a cover stand-off gets a frag: grenadeRate x this (easy 0.25, normal and hard 1). */
const FRAG_APPETITE = 5;
/** The crosshair holds the spot the target last showed at for this long, while it stays this close to it. */
const LAST_CLEAR_HOLD = 2;
const LAST_CLEAR_NEAR = 4;
/** A sideways step longer than this is no step (the obstacle hugs the target): flank instead. */
const MAX_STEP = 8;
/** Clearance past the obstacle's edge the step aims for (the body's radius and a little). */
const CLEARANCE = 1.2;

/** The bullet-stopping obstacle between `from` and `to` closest to `to` (the one the target hides behind), or null. */
export function coverBetween(model: WorldModel, from: Vec2, to: Vec2): { c: Vec2; r: number } | null {
    let best: { c: Vec2; r: number } | null = null;
    let bestD = Number.POSITIVE_INFINITY;
    for (const o of model.obstacles) {
        if (!o.blocksBullets || !segmentHitsCollider(o.col, from, to)) continue;
        const g = obstacleGeom(o);
        const d = v2.distance(g.c, to);
        if (d < bestD) {
            bestD = d;
            best = g;
        }
    }
    return best;
}

/**
 * Where the crosshair rests on a target behind cover: where it last showed with a clear shot (lately and near where it
 * is now), else just past the edge of its cover on its side, at its distance.
 */
export function coverAim(ctx: BrainCtx, t: Contact): Vec2 {
    const f = ctx.mem.fight;
    const me = ctx.self.pos;
    if (
        f.lastClearPos &&
        f.expTarget === t.id &&
        ctx.now - f.lastClearAt < LAST_CLEAR_HOLD &&
        v2.distance(f.lastClearPos, t.pos) < LAST_CLEAR_NEAR
    )
        return v2.copy(f.lastClearPos);
    const cover = coverBetween(ctx.model, me, t.pos);
    if (!cover) return v2.copy(t.pos);
    const side = v2.perp(v2.normalizeSafe(v2.sub(cover.c, me)));
    const s = v2.dot(v2.sub(t.pos, cover.c), side) >= 0 ? 1 : -1;
    const edge = v2.add(cover.c, v2.mul(side, s * (cover.r + 1)));
    return v2.add(me, v2.mul(v2.normalizeSafe(v2.sub(edge, me)), v2.distance(me, t.pos)));
}

/**
 * A spot a sideways step away with a line of fire on `t` (COMBAT-10), or null: the side comes from the world frame
 * (perpendicular to the line from the lower player id to the higher), the step clears the cover at its distance.
 */
export function repositionSpot(ctx: BrainCtx, t: Contact): Vec2 | null {
    const { model } = ctx;
    const me = ctx.self.pos;
    const d = v2.distance(me, t.pos);
    const cover = coverBetween(model, me, t.pos);
    if (!cover) return null;
    // shifting the bot by x moves the line at the cover by x (d - dc) / d (it pivots about the target)
    const dc = v2.distance(me, cover.c);
    const need = ((cover.r + CLEARANCE) * d) / Math.max(d - dc, 1);
    if (need > MAX_STEP) return null;
    const lowFirst = ctx.self.id < t.id;
    const side = v2.perp(v2.normalizeSafe(lowFirst ? v2.sub(t.pos, me) : v2.sub(me, t.pos)));
    for (const s of [1, -1]) {
        for (const off of [need, need + 1.5]) {
            const raw = v2.add(me, v2.mul(side, s * off));
            if (!model.nav.walkableAt(raw) || model.nav.isWaterAt(raw)) continue;
            const p = model.nav.center(model.nav.nearestWalkable(raw, 1));
            if (!model.nav.lineWalkable(me, p) || !reachable(ctx, p, 1) || nearFailedGoal(ctx, p)) continue;
            if (!bodyAimPoint(p, t.pos, (a, b) => model.lineOfFire(a, b))) continue;
            return p;
        }
    }
    return null;
}

/**
 * planFight's branch for a visible target behind cover (the whole body): frag, back off, reposition or go round, never
 * standing in place with the trigger released. Plans the movement into `intent`.
 */
export function planBlocked(ctx: BrainCtx, intent: Intent, info: GunInfo, d: number): void {
    const { self, model, mem, now, rng, params, features } = ctx;
    const t = ctx.target as Contact;
    const f = mem.fight;
    const me = self.pos;
    const fragType = FRAG_TYPES.find((it) => (self.inventory[it] ?? 0) > 0);
    const frags = fragType !== undefined;
    const fragMin = fragMinDist(fragType ?? "frag");
    // once per stand-off: whether this one gets a frag (the difficulty's appetite for grenades)
    if (frags && f.fragRolledAt < f.coveredSince) {
        f.fragRolledAt = now;
        f.fragWanted = rng.bool(Math.min(1, params.grenadeRate * FRAG_APPETITE));
    }
    if (frags && f.fragWanted) {
        if (d < fragMin + 1) {
            // too close to throw over that cover: back off to a safe distance, briefly
            if (f.backOffSince < f.coveredSince) f.backOffSince = now;
            const away =
                now - f.backOffSince < BACK_OFF_CAP ? freeDir(model, me, v2.normalizeSafe(v2.sub(me, t.pos))) : null;
            if (away) {
                intent.moveDir = away;
                return;
            }
        } else if (d <= FRAG_MAX && fragGates(ctx, t)) {
            // the throw starts this think (brain/grenades.ts skips its roll); the bot keeps moving meanwhile
            f.throwNow = now;
        }
    }
    const futile = mem.pursuit.isFutile(t.id) && f.futileDone !== t.id;
    const stalled = now - f.coveredSince > STALL && now >= f.repoCooldown;
    const walking = f.repoTarget === t.id && f.repoSpot !== null && now < f.repoUntil;
    if ((futile || stalled) && !walking) {
        const spot = repositionSpot(ctx, t);
        if (futile) f.futileDone = t.id;
        f.repoCooldown = now + REPO_COOLDOWN;
        if (spot) {
            f.repoTarget = t.id;
            f.repoSpot = spot;
            f.repoUntil = now + REPO_KEEP;
        } else if (futile && frags && d >= fragMin && d <= FRAG_MAX && fragGates(ctx, t)) {
            f.throwNow = now;
        }
    }
    if (f.repoTarget === t.id && f.repoSpot && now < f.repoUntil) {
        intent.goal = v2.copy(f.repoSpot);
        intent.arriveDist = 0.5;
        return;
    }
    // round the cover: a flank spot with a shot (cover feature), else along the path towards the target; within the
    // usual stopping distance already (two bots either side of a tree, a crate or a wall) keep walking round it
    const flank = features.cover ? flankSpot(ctx, t) : null;
    intent.goal = flank ?? v2.copy(t.pos);
    intent.arriveDist = flank ? 1 : Math.min(Math.max(6, info.idealMin), Math.max(0.5, d - 3));
}
