// Endgame positioning (BrainFeatures.endgame, the "hold" behaviour): once ten players or fewer are left (with the next
// circle under 150 units), or the next circle is small (radius < 80), wandering and looting lose to holding a strong spot. The bot scores spots inside the
// next circle (searched at most every 2 s, among the obstacles it can see): bullet-blocking obstacles within 6 units
// (cover on several sides), closeness to the circle centre (the zone will not push it out), no water, little threat
// heat; it rotates there early in hops of at most 30 units from cover to cover, then holds, scanning around with its
// crosshair (Intent.lookAt). As soon as an enemy shows up the regular fight takes over (a hold below an unprovoked fight
// in the utility choice; standing still under fire loses), the gas and healing still win, and 30 s without an enemy in
// sight give looting and exploring 8 s. In team modes followers hold within 30 units of their leader (team.ts onLeash):
// a team spread over four endgame spots fights the last squad one at a time.
// BrainFeatures.pursuit (critique C8, persona campiness): a persona that camps (rolled once per bot from its
// campiness on the persona stream) holds three times as long before a break, but only with a B+ gun or better and
// armour (persona.ts mayCamp): the zone still comes first (spots are inside the next circle), and an under-armed camper
// keeps moving.
import { type Vec2, v2 } from "@rebirth/core";
import { hasAmmo } from "../knowledge/arsenal.ts";
import { gunRank } from "../knowledge/gunTiers.ts";
import { mayCamp } from "../persona.ts";
import { addCombatLayer, obstacleGeom } from "./combat.ts";
import { type BrainCtx, emptyIntent, type Intent, nearFailedGoal, reachable } from "./context.ts";
import { onLeash } from "./team.ts";

const ALIVE_LIMIT = 10;
const SMALL_CIRCLE = 80;
const FEW_ALIVE_CIRCLE = 150;
const SEARCH_EVERY = 2;
const COVER_RADIUS = 6;
const HOP = 30;
const SEARCH_RANGE = 70;
/** Below an unprovoked fight (DifficultyParams.aggression): holding replaces wandering, not fighting. */
const HOLD_SCORE = 0.5;
/** A hold without an enemy in sight for this long takes a break of QUIET_BREAK seconds. */
const QUIET_CAP = 30;
const QUIET_BREAK = 8;
/** An enemy seen this recently ends the hold (the fight takes over). */
const ENEMY_RECENT = 3;
/** pursuit: a camping persona's quiet cap is this many times QUIET_CAP. */
const CAMP_FACTOR = 3;

/** pursuit: whether this bot camps its hold (persona campiness rolled once, a B+ gun or better and armour). */
export function camps(ctx: BrainCtx): boolean {
    const p = ctx.persona;
    if (!ctx.features.pursuit || p.campiness <= 0) return false;
    const pm = ctx.mem.pursuit;
    if (pm.camper === null) pm.camper = ctx.personaRng.next() < p.campiness;
    if (!pm.camper) return false;
    let best = "";
    let rank = -1;
    for (const g of ctx.guns) {
        if (!hasAmmo(g)) continue;
        const r = gunRank(g.info.id);
        if (r > rank) {
            rank = r;
            best = g.info.id;
        }
    }
    return mayCamp(p, best, !!ctx.self.chest || !!ctx.self.helmet);
}

/**
 * Endgame conditions: a small next circle, or few players left once the circles have closed in somewhat (with a huge
 * zone left, ten players are spread over the map and a hold is just camping: skirmish and tournament ablations).
 */
export function endgameActive(ctx: BrainCtx): boolean {
    const gas = ctx.model.gas;
    if (!gas || gas.mode === "inactive") return false;
    const alive = ctx.model.aliveCount;
    return (alive > 0 && alive <= ALIVE_LIMIT && gas.radNew < FEW_ALIVE_CIRCLE) || gas.radNew < SMALL_CIRCLE;
}

/** How good a spot is to hold (higher is better), -Infinity when it is unusable. */
export function holdSpotScore(ctx: BrainCtx, p: Vec2): number {
    const { model } = ctx;
    const gas = model.gas;
    if (!gas) return Number.NEGATIVE_INFINITY;
    const centreDist = v2.distance(p, gas.posNew);
    if (centreDist > gas.radNew - 3 || !model.nav.walkableAt(p) || model.nav.isWaterAt(p)) {
        return Number.NEGATIVE_INFINITY;
    }
    if (!reachable(ctx, p, 1) || nearFailedGoal(ctx, p)) return Number.NEGATIVE_INFINITY;
    let cover = 0;
    for (const o of model.obstacles) {
        if (!o.blocksBullets || o.def.door) continue;
        const g = obstacleGeom(o);
        if (Math.abs(g.c.x - p.x) > COVER_RADIUS + g.r || Math.abs(g.c.y - p.y) > COVER_RADIUS + g.r) continue;
        if (v2.distance(g.c, p) - g.r < COVER_RADIUS) cover++;
        if (cover >= 4) break;
    }
    const centre = 1 - centreDist / Math.max(gas.radNew, 1);
    const heat = model.threats.heat(p, 15);
    const travel = v2.distance(p, ctx.self.pos) / 100;
    return Math.min(cover, 4) * 0.5 + centre * 1.5 - heat * 0.5 - travel;
}

/** The best spot to hold among cover spots next to the obstacles in view (and the bot's own spot). */
function searchHoldSpot(ctx: BrainCtx): Vec2 | null {
    const { model, self } = ctx;
    const gas = model.gas;
    if (!gas) return null;
    const sm = ctx.mem.smart;
    const found: { best: Vec2 | null; score: number } = { best: null, score: Number.NEGATIVE_INFINITY };
    const consider = (p: Vec2, bonus: number) => {
        const s = holdSpotScore(ctx, p) + bonus;
        if (s > found.score) {
            found.score = s;
            found.best = p;
        }
    };
    if (sm.holdSpot) consider(sm.holdSpot, 0.3);
    consider(v2.copy(self.pos), 0.1);
    for (const o of model.obstacles) {
        if (!o.blocksBullets || o.def.door) continue;
        const { c, r } = obstacleGeom(o);
        if (r < 0.9 || r > 7) continue;
        if (v2.distance(c, self.pos) > SEARCH_RANGE) continue;
        // the side of the obstacle facing the circle centre: enemies come in from the edge (at the centre of its
        // navigation cell, where a player can stand: findCoverFrom)
        const toCentre = v2.normalizeSafe(v2.sub(gas.posNew, c));
        const raw = v2.add(c, v2.mul(toCentre, r * (o.col.type === 1 ? 0.75 : 1) + 1.3));
        if (!model.nav.walkableAt(raw)) continue;
        consider(model.nav.center(model.nav.nearestWalkable(raw, 1)), 0);
    }
    return found.best;
}

/** Utility of holding an endgame spot now (0..1). */
export function holdScore(ctx: BrainCtx): number {
    if (!endgameActive(ctx) || !ctx.armed || ctx.model.inGasNow()) return 0;
    const sm = ctx.mem.smart;
    if (ctx.now - sm.holdSearchAt >= SEARCH_EVERY || (sm.holdSpot && holdSpotScore(ctx, sm.holdSpot) === -Infinity)) {
        sm.holdSearchAt = ctx.now;
        sm.holdSpot = searchHoldSpot(ctx);
    }
    // team modes: followers hold near their leader (the leader's spot is the team's)
    if (!sm.holdSpot || !onLeash(ctx, sm.holdSpot)) return 0;
    // a hold is for positioning while nobody is around: any enemy seen lately is the fight behaviour's business
    if (ctx.enemies.some((e) => !e.downed && ctx.now - e.lastSeen < ENEMY_RECENT)) return 0;
    // never camp forever: a long quiet hold makes room for looting and exploring for a while
    if (ctx.enemies.some((e) => ctx.now - e.lastSeen < 1)) sm.holdQuietSince = ctx.now;
    if (!Number.isFinite(sm.holdQuietSince)) sm.holdQuietSince = ctx.now;
    const cap = camps(ctx) ? QUIET_CAP * CAMP_FACTOR : QUIET_CAP;
    if (ctx.now - sm.holdQuietSince > cap + QUIET_BREAK) sm.holdQuietSince = ctx.now;
    if (ctx.now - sm.holdQuietSince > cap) return 0;
    return HOLD_SCORE;
}

/** The next hop towards the hold spot: a cover spot at most 30 units on, closer to the spot. */
function nextHop(ctx: BrainCtx, spot: Vec2): Vec2 {
    const me = ctx.self.pos;
    const d = v2.distance(me, spot);
    if (d <= HOP) return spot;
    const dir = v2.normalizeSafe(v2.sub(spot, me));
    const ahead = v2.add(me, v2.mul(dir, HOP));
    let best: Vec2 | null = null;
    let bestCost = Number.POSITIVE_INFINITY;
    for (const o of ctx.model.obstacles) {
        if (!o.blocksBullets || o.def.door) continue;
        const { c, r } = obstacleGeom(o);
        if (r < 0.9 || r > 7) continue;
        const p = v2.add(c, v2.mul(v2.neg(dir), r * (o.col.type === 1 ? 0.75 : 1) + 1.3));
        const hop = v2.distance(me, p);
        if (hop > HOP || hop < 8 || v2.distance(p, spot) > d - 8 || !ctx.model.nav.walkableAt(p)) continue;
        const cost = v2.distance(p, ahead);
        if (cost < bestCost) {
            bestCost = cost;
            best = p;
        }
    }
    return best ?? ahead;
}

export function planHold(ctx: BrainCtx): Intent {
    const intent = emptyIntent("hold");
    const sm = ctx.mem.smart;
    const spot = sm.holdSpot;
    if (!spot) return intent;
    const me = ctx.self.pos;
    if (v2.distance(me, spot) > 1.2) {
        const hop = nextHop(ctx, spot);
        const cell = ctx.model.nav.nearestWalkable(hop, 4, ctx.myComp);
        intent.goal = cell >= 0 && hop !== spot ? ctx.model.nav.center(cell) : v2.copy(hop);
        intent.arriveDist = 1;
    } else {
        intent.stop = true;
    }
    // scan: the last known threat first, else sweep the half facing away from the centre
    const gas = ctx.model.gas;
    const known = ctx.enemies.find((e) => !e.downed && ctx.now - e.lastSeen < 8);
    if (known) intent.lookAt = v2.copy(known.pos);
    else {
        sm.holdScanAngle += 0.35;
        const out = gas ? Math.atan2(me.y - gas.posNew.y, me.x - gas.posNew.x) : 0;
        const a = out + Math.sin(sm.holdScanAngle) * 1.6;
        intent.lookAt = v2.add(me, { x: Math.cos(a) * 15, y: Math.sin(a) * 15 });
    }
    addCombatLayer(ctx, intent);
    return intent;
}
