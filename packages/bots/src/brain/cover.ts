// Fighting from cover (BrainFeatures.cover): to reload or heal, or in a trade the bot loses in the open (A < -0.3,
// brain/assess.ts), it hides behind an obstacle that shields it from the target and peeks out to shoot: hide 0.6-1.5 s
// (reloading and healing there), step 1.5-2.5 units sideways to a spot with a clear line of fire (alternating sides,
// the crosshair already on where the enemy should appear: Intent.lookAt), shoot a burst, and step back after the
// burst, after taking a real hit, or when the enemy aims at it (its facing within 10 degrees) and shoots. While hidden
// it still shoots an enemy that walks into its line of fire. Mid-exchange it only takes cover a few steps away, never
// against an enemy rushing in, and not in a brawl. When the target drops out of sight it holds the last-seen angle
// from cover for a few seconds instead of walking into it, and with no line of fire it flanks around the obstacle
// instead of walking at the target. Every state has a hard cap (hide 7 s, peek 4 s, one cover session 20 s, holding an
// angle 3 s) so the bot never camps.
import { type Vec2, v2 } from "@rebirth/core";
import { Input } from "@rebirth/defs";
import { fightSlot, type HeldGun } from "../knowledge/arsenal.ts";
import type { Contact } from "../perception/world.ts";
import { ADVANTAGE_BAND, faces, pushAdvantageOf } from "./assess.ts";
import { findCover, findCoverFrom } from "./combat.ts";
import { type BrainCtx, type Intent, nearFailedGoal, reachable } from "./context.ts";
import type { SmartMemory } from "./smartMemory.ts";
import { healItem } from "./survival.ts";

/** Cover spots this close are worth taking before the shooting starts... */
const COVER_DIST = 10;
/** ...and only this close once it has (or when the old spot got exposed). */
const ENGAGED_COVER = 4;
const HIDE_MIN = 0.6;
const HIDE_MAX = 1.5;
const HIDE_CAP = 7;
const BURST_MIN = 0.9;
const BURST_MAX = 1.8;
const PEEK_CAP = 4;
/** A peek still without a shot after this long is given up. */
const PEEK_STUCK = 1.5;
/** A flank spot is kept this long while the target stays put. */
const FLANK_KEEP = 0.6;
/** Health lost during a peek that sends the bot back behind cover. */
const PEEK_HURT = 12;
const SESSION_CAP = 20;
const COOLDOWN = 8;
const HOLD_ANGLE_CAP = 3;
/** Closer than this the fight is a brawl: no peeking (for a few seconds). */
const BRAWL_DIST = 7;
const BRAWL_COOLDOWN = 3;
/** A cover session starts only against an enemy at least this far... */
const START_DIST = 12;
/** ...and not running at the bot faster than this (u/s). */
const RUSH_SPEED = 4;

function endCover(sm: SmartMemory): void {
    sm.cover = "none";
    sm.coverSpot = null;
    sm.peekSpot = null;
}

function enter(sm: SmartMemory, state: "hide" | "peek", now: number, until: number): void {
    sm.cover = state;
    sm.coverStateSince = now;
    sm.coverStateUntil = until;
}

/**
 * A spot 1.5-2.5 units sideways from the cover spot (up to 3.5 past wide obstacles) with a clear line of fire on
 * `target`, alternating sides.
 */
export function peekSpot(ctx: BrainCtx, spot: Vec2, target: Vec2): Vec2 | null {
    const { model, rng } = ctx;
    const sm = ctx.mem.smart;
    const side = v2.perp(v2.normalizeSafe(v2.sub(target, spot)));
    const first = rng.range(1.5, 2.5);
    for (const s of [sm.peekSide, -sm.peekSide]) {
        // 1.5-2.5 units clear most obstacles; wide ones need a little more
        for (const off of [first, 2, 2.5, 1.5, 3, 3.5]) {
            const p = v2.add(spot, v2.mul(side, s * off));
            if (!model.nav.walkableAt(p) || model.nav.isWaterAt(p)) continue;
            if (!model.lineOfFire(p, target) || !model.nav.lineWalkable(spot, p)) continue;
            sm.peekSide = -s;
            return p;
        }
    }
    // over the top of the cover: a step towards the target
    const p = v2.add(spot, v2.mul(v2.normalizeSafe(v2.sub(target, spot)), 1.5));
    return model.nav.walkableAt(p) && model.lineOfFire(p, target) ? p : null;
}

/**
 * The cover state machine for the visible target (called by planFight while the feature is on); returns false when
 * the bot should fight in the open instead (brawl range, a trade it clearly wins, no cover, caps reached).
 */
export function planCoverPeek(ctx: BrainCtx, intent: Intent, gun: HeldGun): boolean {
    const { self, model, now, rng, mem, params } = ctx;
    const sm = mem.smart;
    const t = ctx.target;
    if (!t) return false;
    sm.holdAngleTarget = 0;
    const me = self.pos;
    const d = ctx.targetDist;
    const adv = pushAdvantageOf(ctx);
    const maxClip = gun.info.def.maxClip;
    const needReload = self.action.type === "reload" || (gun.mag <= maxClip * 0.25 && gun.reserve > 0);
    const needHeal = self.health < 55 && (self.inventory.bandage ?? 0) + (self.inventory.healthkit ?? 0) > 0;
    const inReach = d <= Math.max(gun.info.maxEngage * params.rangeMult, 10);
    if (d < BRAWL_DIST) {
        // a brawl: fight it out in the open for a while (no flip-flopping between cover and brawl at one distance)
        sm.coverCooldown = Math.max(sm.coverCooldown, now + BRAWL_COOLDOWN);
        endCover(sm);
        return false;
    }
    // peeking pays only in a trade the bot loses in the open (duels against the baseline: in an even one the time
    // spent hidden costs more damage than the cover saves); reloading and healing always go behind cover
    const losing = adv < -ADVANTAGE_BAND;
    if (now < sm.coverCooldown || t.downed || !inReach || (!losing && !needReload && !needHeal)) {
        endCover(sm);
        return false;
    }
    // no new session against an enemy that is close or rushing in: it is in the open, shoot it
    const closing = v2.dot(t.vel, v2.normalizeSafe(v2.sub(me, t.pos)));
    if (sm.cover === "none" && (d < START_DIST || closing > RUSH_SPEED) && !needReload && !needHeal) return false;
    if (sm.coverTarget !== t.id || sm.cover === "none") {
        // mid-exchange, walking far to cover only eats bullets: then only cover a few steps away
        const engaged = now - t.lastShotAt < 2 || now - model.lastHurt < 2;
        const reach = engaged ? ENGAGED_COVER : COVER_DIST;
        const spot = findCoverFrom(
            model,
            me,
            t.pos,
            reach + 4,
            (p) => v2.distance(p, me) <= reach && reachable(ctx, p, 1) && !nearFailedGoal(ctx, p),
        );
        if (!spot) return false;
        sm.coverTarget = t.id;
        sm.coverSince = now;
        sm.coverSpot = spot;
        sm.peekSpot = null;
        enter(sm, "hide", now, now + rng.range(HIDE_MIN, HIDE_MAX));
    }
    if (now - sm.coverSince > SESSION_CAP) {
        sm.coverCooldown = now + COOLDOWN;
        endCover(sm);
        return false;
    }
    // the spot must still shield from where the target stands now
    if (!sm.coverSpot || model.lineOfFire(t.pos, sm.coverSpot)) {
        const spot = findCoverFrom(
            model,
            me,
            t.pos,
            ENGAGED_COVER + 4,
            (p) => v2.distance(p, me) <= ENGAGED_COVER && reachable(ctx, p, 1),
        );
        if (!spot) {
            endCover(sm);
            return false;
        }
        sm.coverSpot = spot;
        sm.peekSpot = null;
    }
    const spot = sm.coverSpot;
    intent.lookAt = v2.copy(t.pos);
    if (sm.cover === "hide") {
        // pre-aimed at the enemy; it still shoots whenever the enemy walks into its line of fire (a flank)
        if (!intent.fire) intent.aim = v2.copy(t.pos);
        const arrived = v2.distance(me, spot) < 1;
        if (arrived) intent.stop = true;
        else {
            intent.goal = v2.copy(spot);
            intent.arriveDist = 0.5;
        }
        // hidden from an enemy closing in: have the gun for where it will show up in hand
        if (!intent.fire && d < 18 && closing > 1) intent.slot = fightSlot(self, ctx.guns, Math.max(3, d * 0.5));
        if (arrived && !model.lineOfFire(t.pos, me) && self.action.type === "none") {
            if (gun.mag < maxClip && gun.reserve > 0 && now - mem.lastReloadRequest > 1) {
                mem.lastReloadRequest = now;
                intent.actions.push(Input.Reload);
            } else if (needHeal && now - mem.lastUseRequest > 0.6) {
                const item = healItem(ctx);
                if (item) {
                    mem.lastUseRequest = now;
                    intent.useItem = item;
                }
            }
        }
        const busy = self.action.type === "reload" || self.action.type === "use";
        const stateTime = now - sm.coverStateSince;
        const ready = (arrived || stateTime > 3) && now >= sm.coverStateUntil && !busy;
        if (!ready && stateTime < HIDE_CAP) return true;
        const peek = peekSpot(ctx, spot, t.pos);
        if (!peek) {
            endCover(sm);
            return false;
        }
        sm.peekSpot = peek;
        sm.peekHealth = self.health;
        // the burst timer starts once the bot stands on the peek spot
        enter(sm, "peek", now, Number.POSITIVE_INFINITY);
    }
    const peek = sm.peekSpot ?? spot;
    const atPeek = v2.distance(me, peek) < 0.8;
    if (atPeek) {
        intent.stop = true;
        if (!Number.isFinite(sm.coverStateUntil)) sm.coverStateUntil = now + rng.range(BURST_MIN, BURST_MAX);
    } else {
        intent.goal = v2.copy(peek);
        intent.arriveDist = 0.4;
    }
    const stateTime = now - sm.coverStateSince;
    // a peek that gives no shot (the spot cannot be reached, the enemy moved behind more cover) ends the session:
    // the regular fight flanks around instead
    const noShot = !model.lineOfFire(me, t.pos);
    if ((stateTime > PEEK_STUCK && !atPeek) || (atPeek && noShot && stateTime > PEEK_STUCK)) {
        sm.coverCooldown = now + BRAWL_COOLDOWN;
        endCover(sm);
        return false;
    }
    // a real hit (not a graze), or the enemy aiming and firing at it once the burst had its minimum
    const hurt = model.lastHurt > sm.coverStateSince + 0.15 && self.health < sm.peekHealth - PEEK_HURT;
    const aimedAt = faces(t, me, 10) && now - t.lastShotAt < 0.5 && stateTime > BURST_MIN;
    if (now >= sm.coverStateUntil || hurt || aimedAt || gun.mag <= 0 || stateTime > PEEK_CAP) {
        enter(sm, "hide", now, now + rng.range(HIDE_MIN, HIDE_MAX));
    }
    return true;
}

/**
 * A spot on the ring around the target at about the current distance with a clear line of fire on it (going around
 * the obstacle between, nearest bearing first), or null.
 */
export function flankSpot(ctx: BrainCtx, t: Contact): Vec2 | null {
    const { model, now } = ctx;
    const sm = ctx.mem.smart;
    // the search costs a few line-of-fire tests: keep a found spot for a moment while the target stays put
    if (
        sm.flankAt > now - FLANK_KEEP &&
        sm.flankTarget === t.id &&
        sm.flankFrom &&
        v2.distance(sm.flankFrom, t.pos) < 2
    ) {
        if (!sm.flankSpot || model.lineOfFire(sm.flankSpot, t.pos)) return sm.flankSpot;
    }
    sm.flankAt = now;
    sm.flankTarget = t.id;
    sm.flankFrom = v2.copy(t.pos);
    sm.flankSpot = searchFlank(ctx, t);
    return sm.flankSpot;
}

function searchFlank(ctx: BrainCtx, t: Contact): Vec2 | null {
    const { model } = ctx;
    const me = ctx.self.pos;
    const r = Math.min(20, Math.max(6, ctx.targetDist));
    const base = Math.atan2(me.y - t.pos.y, me.x - t.pos.x);
    const side = ctx.mem.smart.peekSide;
    for (const step of [0.35, 0.7, 1.05, 1.4]) {
        for (const s of [side, -side]) {
            const a = base + s * step;
            const p = { x: t.pos.x + Math.cos(a) * r, y: t.pos.y + Math.sin(a) * r };
            if (!model.nav.walkableAt(p) || model.nav.isWaterAt(p) || !model.lineOfFire(p, t.pos)) continue;
            if (!reachable(ctx, p, 1) || nearFailedGoal(ctx, p)) continue;
            return p;
        }
    }
    return null;
}

/**
 * The target dropped out of sight and the trade is not clearly won: hold its last-seen angle from cover (crosshair on
 * the spot) for a few seconds instead of walking into it. Returns false once the cap ran out.
 */
export function holdLostAngle(ctx: BrainCtx, intent: Intent, t: Contact): boolean {
    const { model, now } = ctx;
    const sm = ctx.mem.smart;
    if (pushAdvantageOf(ctx) > ADVANTAGE_BAND || now - t.lastSeen > HOLD_ANGLE_CAP + 2) return false;
    if (sm.holdAngleTarget !== t.id) {
        sm.holdAngleTarget = t.id;
        sm.holdAngleSince = now;
    }
    if (now - sm.holdAngleSince > HOLD_ANGLE_CAP) return false;
    const me = ctx.self.pos;
    const keep = sm.coverSpot && v2.distance(sm.coverSpot, me) < 3 && !model.lineOfFire(t.pos, sm.coverSpot);
    const spot = keep ? sm.coverSpot : findCover(model, t.pos, 6);
    if (spot && v2.distance(spot, me) > 0.6) {
        intent.goal = v2.copy(spot);
        intent.arriveDist = 0.6;
    } else {
        intent.stop = true;
    }
    intent.aim = v2.copy(t.pos);
    intent.lookAt = v2.copy(t.pos);
    intent.fire = false;
    return true;
}
