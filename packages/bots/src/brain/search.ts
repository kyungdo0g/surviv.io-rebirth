// Searching for a lost target (BrainFeatures.pursuit, bot overhaul round 3, user report 25: "if the target hides
// mid-chase, keep the last seen position / direction, search and prefire; a bot must not forget where the target
// went"). The world model forgets a contact a few seconds after it left view (DifficultyParams.memory 2-6 s), and the
// fight behaviour only walks to where it was seen while it is remembered, so a target that slipped off the screen or
// into a house was simply forgotten. Here the bot keeps its own record of the fight target as last seen (position,
// heading, where the bot stood then: PursuitMemory.track, written only while the target is on the screen, so the bot
// never learns where it is now) and, once the fight lets go of it, searches, in order:
// - COMBAT's record of the vanishing (perception/lastSeen.ts searchPoints: the door, bush or screen edge it went by,
//   where it was heading, where it was last seen; dropped once the search found nothing), else its last-seen spot;
// - the points its heading led to (its last speed kept up for 1.5 s, then 3 s: 4..36 units; a guess from what the bot
//   saw);
// - the places a player hides in this game next to that way (walls and stones hide nobody from a top-down screen: only
//   a roof, a bush or a table does, perception/sight.ts): bushes and tables (walked into: a body in a bush stays hidden
//   from next to it) and the inside of a building it was next to or heading for, the ones along its heading first.
// A spot is checked once the bot stands on it, or sees it on its screen from close by (not under a roof the bot is not
// under, not inside a bush); the search ends when every spot is checked, after the bot's patience (12 s for NEUTRAL,
// the persona's chasePatience otherwise, 4..20 s; a persona that never chases does not search), when the target was
// given up (brain/pursuit.ts), or when the target shows up again (the fight takes over and the record starts over).
// The crosshair glances at the spot being checked (COMBAT may prefire it: searchSpot), a target seen on the way is
// shot. Not while unarmed, badly hurt, with another enemy in view, in the gas or with the zone pressing; and only for
// an armed target lost while in the bot's reach (a runner already out of reach, or one never seen with a gun, was the
// endless chase of report 11).
import { type Bounds, type Vec2, v2 } from "@rebirth/core";
import { distToSegment, pointInBounds } from "../geom.ts";
import { concealerOf } from "../perception/foliage.ts";
import { searchPoints } from "../perception/lastSeen.ts";
import { roofRegions } from "../perception/roofs.ts";
import { concealed, onHumanScreen } from "../perception/sight.ts";
import type { WorldModel } from "../perception/world.ts";
import { fleeHealth } from "../persona.ts";
import { enemyGun } from "./assess.ts";
import { addCombatLayer } from "./combat.ts";
import { type BrainCtx, emptyIntent, type Intent, nearFailedGoal, reachable } from "./context.ts";
import { NEUTRAL_PATIENCE, shootRange } from "./pursuit.ts";
import type { SearchState, TargetTrack } from "./pursuitMemory.ts";
import { inStrike } from "./strikes.ts";
import { zonePressure } from "./survival.ts";

/** Out of sight this long before it counts as lost (a flicker behind a tree is not). */
const LOST_MIN = 0.5;
/** Search time bounds (s); NEUTRAL searches NEUTRAL_PATIENCE. */
const SEARCH_MIN = 4;
const SEARCH_MAX = 20;
/** Score (below the fight's 0.5 for a target just out of sight, so the fight's walk to the spot comes first). */
const SEARCH_SCORE = 0.44;
/**
 * Where the heading leads: its last speed kept up for 1.5 s, then for 3 s (4..36 units): a player that ran off the
 * screen kept running (a guess from what the bot saw, not where it is).
 */
const AHEAD_STEPS = [1.5, 3];
const AHEAD_MIN = 4;
const AHEAD_MAX = 36;
/** Hiding places within this of its way (the last-seen spot to the heading's point), at most HIDE_SPOTS of them. */
const HIDE_NEAR = 10;
const HIDE_SPOTS = 3;
/** A spot is checked from this close, or seen on the screen (not roofed, not in a bush) from CHECK_SEE. */
const CHECK_NEAR = 2.5;
const CHECK_SEE = 14;
/** A spot the bot has not reached after this long is skipped. */
const SPOT_TIMEOUT = 6;
/** Speed below which the heading means nothing. */
const MOVING = 1;
/** Zone pressure above which the zone comes first. */
const ZONE_PRESS = 0.5;

/** The search time of this bot (s), 0 for a persona that never chases. */
export function searchTime(ctx: BrainCtx): number {
    const p = ctx.persona.chasePatience;
    if (!Number.isFinite(p)) return NEUTRAL_PATIENCE;
    if (p <= 0) return 0;
    return Math.min(SEARCH_MAX, Math.max(SEARCH_MIN, p));
}

/** Records the fight target while it is on the screen (every think while the flag is on). */
export function noteTrack(ctx: BrainCtx): void {
    const t = ctx.target;
    const pm = ctx.mem.pursuit;
    if (pm.track && ctx.model.contacts.get(pm.track.id)?.dead) {
        pm.track = null;
        pm.search = null;
    }
    if (!t?.visible || t.downed || ctx.mem.current !== "fight" || ctx.mem.targetId !== t.id) return;
    pm.track = {
        id: t.id,
        pos: v2.copy(t.pos),
        vel: v2.copy(t.vel),
        time: ctx.now,
        from: v2.copy(ctx.self.pos),
        inReach: ctx.targetDist <= shootRange(ctx),
        armed: !!enemyGun(ctx, t),
    };
    if (pm.search?.id === t.id) pm.search = null;
}

const roofCache = new WeakMap<WorldModel, Map<number, Bounds[]>>();

/** Standing roofs in view with their zoomIn regions (perception/roofs.ts). */
function roofsOf(model: WorldModel): ReturnType<typeof roofRegions> {
    let cache = roofCache.get(model);
    if (!cache) {
        cache = new Map();
        roofCache.set(model, cache);
    }
    return roofRegions(model.buildings, cache);
}

/** Distance from `p` to the region box `b` (0 inside). */
function boxDistance(p: Vec2, b: Bounds): number {
    const dx = Math.max(b.min.x - p.x, 0, p.x - b.max.x);
    const dy = Math.max(b.min.y - p.y, 0, p.y - b.max.y);
    return Math.hypot(dx, dy);
}

/** The spots to check for the lost `tr`, in order (see the header). */
export function searchSpots(ctx: BrainCtx, tr: TargetTrack): Vec2[] {
    const { model } = ctx;
    const me = ctx.self.pos;
    const spots: Vec2[] = [];
    const usable = (p: Vec2) => reachable(ctx, p, 1.5) && !nearFailedGoal(ctx, p) && !inStrike(ctx, p);
    const walkable = (p: Vec2, slack: number): Vec2 | null => {
        const cell = model.nav.nearestWalkable(p, slack, ctx.myComp);
        return cell >= 0 ? model.nav.center(cell) : null;
    };
    const add = (p: Vec2 | null) => {
        if (p && usable(p) && v2.distance(me, p) > CHECK_NEAR && !spots.some((q) => v2.distance(q, p) < CHECK_NEAR))
            spots.push(p);
    };
    // COMBAT's record of the vanishing (perception/lastSeen.ts, taken the moment it dropped out of sight): the spot it
    // went by first (the door, the bush, the screen edge), where it was heading, where it was last seen
    const rec = model.lastSeen.get(tr.id);
    if (rec) for (const p of searchPoints(rec, ctx.now)) add(walkable(p, 2));
    else add(v2.copy(tr.pos));
    const last = rec ? rec.pos : tr.pos;
    const speed = rec ? rec.speed : v2.length(tr.vel);
    const heading = speed > MOVING ? (rec ? rec.heading : v2.mul(tr.vel, 1 / speed)) : null;
    let ahead = last;
    if (heading) {
        for (const secs of AHEAD_STEPS) {
            const lead = Math.min(AHEAD_MAX, Math.max(AHEAD_MIN, speed * secs));
            const p = walkable(v2.add(last, v2.mul(heading, lead)), 4);
            if (!p || v2.distance(p, ahead) < CHECK_NEAR) continue;
            ahead = p;
            add(p);
        }
    }
    // hiding places next to its way, the ones along its heading first
    const cost = (p: Vec2) =>
        distToSegment(p, last, ahead) - (heading ? 3 * v2.dot(v2.normalizeSafe(v2.sub(p, last)), heading) : 0);
    const hides: Array<{ p: Vec2; cost: number }> = [];
    for (const o of model.obstacles) {
        const k = concealerOf(o);
        if (!k || k.partial || k.layer !== 0) continue;
        if (distToSegment(k.c, last, ahead) > HIDE_NEAR) continue;
        const p = walkable(k.c, 2);
        if (p && usable(p)) hides.push({ p, cost: cost(k.c) });
    }
    for (const r of roofsOf(model)) {
        let near = Number.POSITIVE_INFINITY;
        let box: Bounds | null = null;
        for (const b of r.regions) {
            const d = Math.min(boxDistance(last, b), boxDistance(ahead, b));
            if (d < near) {
                near = d;
                box = b;
            }
        }
        if (!box || near > HIDE_NEAR / 2) continue;
        const p = walkable({ x: (box.min.x + box.max.x) / 2, y: (box.min.y + box.max.y) / 2 }, 4);
        if (p && usable(p)) hides.push({ p, cost: cost(p) });
    }
    hides.sort((x, y) => x.cost - y.cost);
    for (const h of hides.slice(0, HIDE_SPOTS)) add(h.p);
    return spots;
}

/** Whether a player at `p` would show on the bot's screen now: on it, not in a bush, not under a roof it is not under. */
function seeable(ctx: BrainCtx, p: Vec2): boolean {
    const { model, self } = ctx;
    if (!onHumanScreen(self.pos, self.zoom, p) || concealed(model, p, 0)) return false;
    for (const r of roofsOf(model)) {
        if (r.regions.some((b) => pointInBounds(p, b)) && !r.regions.some((b) => pointInBounds(self.pos, b)))
            return false;
    }
    return true;
}

/** Whether spot `p` is checked: the bot stands on it, or would see a player there from close by. */
function checked(ctx: BrainCtx, p: Vec2): boolean {
    const d = v2.distance(ctx.self.pos, p);
    return d < CHECK_NEAR || (d < CHECK_SEE && seeable(ctx, p));
}

function endSearch(ctx: BrainCtx): void {
    ctx.mem.pursuit.search = null;
    ctx.mem.pursuit.track = null;
}

/** Utility of searching for the lost fight target (BrainFeatures.pursuit): see the header. */
export function searchScore(ctx: BrainCtx): number {
    if (!ctx.features.pursuit) return 0;
    noteTrack(ctx);
    const pm = ctx.mem.pursuit;
    const tr = pm.track;
    if (!tr) return 0;
    const { now, model, self } = ctx;
    const c = model.contacts.get(tr.id);
    if (c?.visible || now - tr.time < LOST_MIN) return 0;
    const limit = searchTime(ctx);
    // a runner that was already out of reach, or never had a gun, is not hunted down (report 11: that was the endless
    // chase); a fight partner that slipped away is
    if (!tr.inReach || !tr.armed || pm.ignored.has(tr.id) || now - tr.time > limit + LOST_MIN || limit <= 0) {
        endSearch(ctx);
        return 0;
    }
    if (!ctx.armed || self.health < fleeHealth(ctx.persona) || model.inGasNow()) return 0;
    if (zonePressure(model) > ZONE_PRESS || ctx.visibleEnemies.some((e) => !e.downed)) return 0;
    let s = pm.search;
    if (!s || s.id !== tr.id) {
        const spots = searchSpots(ctx, tr);
        if (!spots.length) {
            endSearch(ctx);
            return 0;
        }
        s = { id: tr.id, spots, idx: 0, spotSince: now, started: now, until: tr.time + LOST_MIN + limit };
        pm.search = s;
    }
    advance(ctx, s);
    if (s.idx >= s.spots.length) {
        // every spot checked and nothing there: COMBAT's corner hold lets go of it too
        model.lastSeen.drop(tr.id);
        endSearch(ctx);
        return 0;
    }
    return SEARCH_SCORE;
}

/** Skips the spots already checked (or not reached in time). */
function advance(ctx: BrainCtx, s: SearchState): void {
    while (s.idx < s.spots.length) {
        const p = s.spots[s.idx];
        if (!checked(ctx, p) && ctx.now - s.spotSince < SPOT_TIMEOUT && !nearFailedGoal(ctx, p)) return;
        s.idx++;
        s.spotSince = ctx.now;
    }
}

/** The spot the search checks now (COMBAT may prefire it), or null. */
export function searchSpot(ctx: BrainCtx): Vec2 | null {
    const s = ctx.features.pursuit ? ctx.mem.pursuit.search : null;
    return s && s.idx < s.spots.length ? s.spots[s.idx] : null;
}

/** The search: walk to the next spot, crosshair glancing at it. */
export function planSearch(ctx: BrainCtx): Intent {
    const intent = emptyIntent("search");
    const spot = searchSpot(ctx);
    if (!spot) {
        intent.stop = true;
        return intent;
    }
    intent.goal = v2.copy(spot);
    intent.arriveDist = 1.2;
    addCombatLayer(ctx, intent);
    if (!intent.aim) intent.lookAt = v2.copy(spot);
    return intent;
}
